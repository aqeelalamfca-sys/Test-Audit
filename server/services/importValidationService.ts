// @ts-ignore - ExcelJS has no default export in types but works at runtime
import ExcelJS from 'exceljs';
import { v4 as uuidv4 } from 'uuid';
import {
  TEMPLATE_SHEETS,
  REQUIRED_SHEET_KEYS,
  ALL_SHEET_NAMES,
  type SheetKey,
  type SheetDef,
  type ColumnDef,
  type ImportValidationError,
  type ImportValidationResult,
  type ImportErrorSeverity,
  type ImportErrorCategory,
} from '../../shared/importSchema';

function normalizeSheetName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function matchSheetName(actualName: string): SheetKey | null {
  const normalized = normalizeSheetName(actualName);
  for (const [key, def] of Object.entries(TEMPLATE_SHEETS)) {
    if (normalizeSheetName(def.sheetName) === normalized) {
      return key as SheetKey;
    }
  }
  return null;
}

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function matchHeader(actualHeader: string, columns: ColumnDef[]): ColumnDef | null {
  const normalized = normalizeHeader(actualHeader);
  for (const col of columns) {
    if (normalizeHeader(col.header) === normalized) {
      return col;
    }
  }
  return null;
}

function makeError(
  severity: ImportErrorSeverity,
  category: ImportErrorCategory,
  sheet: string,
  ruleCode: string,
  message: string,
  opts?: { row?: number; column?: string; field?: string; expected?: string; actual?: string; fixHint?: string }
): ImportValidationError {
  return {
    id: uuidv4(),
    severity,
    category,
    sheet,
    ruleCode,
    message,
    row: opts?.row,
    column: opts?.column,
    field: opts?.field,
    expected: opts?.expected,
    actual: opts?.actual,
    fixHint: opts?.fixHint,
  };
}

export async function validateWorkbookStructure(buffer: Buffer): Promise<ImportValidationResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const errors: ImportValidationError[] = [];
  const sheetsFound: string[] = [];
  const sheetsMissing: string[] = [];
  const sheetsUnknown: string[] = [];
  const rowCounts: Record<string, number> = {};

  const actualSheetNames = workbook.worksheets
    .map(ws => ws.name)
    .filter(n => normalizeSheetName(n) !== normalizeSheetName('Template'));

  const matchedSheets = new Map<SheetKey, ExcelJS.Worksheet>();

  for (const ws of workbook.worksheets) {
    if (normalizeSheetName(ws.name) === normalizeSheetName('Template')) continue;

    const matched = matchSheetName(ws.name);
    if (matched) {
      matchedSheets.set(matched, ws);
      sheetsFound.push(TEMPLATE_SHEETS[matched].sheetName);
    } else {
      sheetsUnknown.push(ws.name);
      errors.push(makeError(
        'WARNING',
        'SHEET_UNKNOWN',
        ws.name,
        'UNKNOWN_SHEET',
        `Sheet "${ws.name}" is not recognized. Expected sheet names: ${ALL_SHEET_NAMES.join(', ')}. This sheet will be ignored.`,
        { fixHint: `Rename this sheet to one of: ${ALL_SHEET_NAMES.join(', ')}` }
      ));
    }
  }

  for (const reqKey of REQUIRED_SHEET_KEYS) {
    if (!matchedSheets.has(reqKey)) {
      const def = TEMPLATE_SHEETS[reqKey];
      sheetsMissing.push(def.sheetName);
      errors.push(makeError(
        'CRITICAL',
        'SHEET_MISSING',
        def.sheetName,
        `${reqKey}_SHEET_MISSING`,
        `Required sheet "${def.sheetName}" is missing. This sheet is mandatory for import.`,
        { fixHint: `Add a sheet named "${def.sheetName}" with the required columns.` }
      ));
    }
  }

  Array.from(matchedSheets.entries()).forEach(([sheetKey, ws]) => {
    const def = TEMPLATE_SHEETS[sheetKey];
    const sheetErrors = validateSheet(ws, def);
    errors.push(...sheetErrors.errors);
    rowCounts[def.sheetName] = sheetErrors.dataRowCount;
  });

  const crossRefErrors = validateCrossReferences(workbook, matchedSheets);
  errors.push(...crossRefErrors);

  const criticalCount = errors.filter(e => e.severity === 'CRITICAL').length;
  const errorCount = errors.filter(e => e.severity === 'ERROR').length;
  const warningCount = errors.filter(e => e.severity === 'WARNING').length;
  const infoCount = errors.filter(e => e.severity === 'INFO').length;

  return {
    valid: criticalCount === 0 && errorCount === 0,
    criticalCount,
    errorCount,
    warningCount,
    infoCount,
    errors,
    sheetsFound,
    sheetsMissing,
    sheetsUnknown,
    rowCounts,
  };
}

function validateSheet(ws: ExcelJS.Worksheet, def: SheetDef): { errors: ImportValidationError[]; dataRowCount: number } {
  const errors: ImportValidationError[] = [];
  let dataRowCount = 0;

  const headerRow = ws.getRow(1);
  const actualHeaders: string[] = [];
  headerRow.eachCell((cell, colNumber) => {
    actualHeaders[colNumber - 1] = String(cell.value || '').trim();
  });

  if (actualHeaders.length === 0) {
    errors.push(makeError(
      'CRITICAL',
      'HEADER_MISSING',
      def.sheetName,
      `${def.key}_NO_HEADERS`,
      `Sheet "${def.sheetName}" has no header row.`,
      { fixHint: 'Add column headers in the first row matching the template.' }
    ));
    return { errors, dataRowCount: 0 };
  }

  const matchedCols = new Map<number, ColumnDef>();
  const foundHeaders = new Set<string>();

  for (let i = 0; i < actualHeaders.length; i++) {
    const h = actualHeaders[i];
    if (!h) continue;
    const col = matchHeader(h, def.columns);
    if (col) {
      matchedCols.set(i, col);
      foundHeaders.add(col.header);
    }
  }

  for (const col of def.columns) {
    if (col.required && !foundHeaders.has(col.header)) {
      errors.push(makeError(
        'CRITICAL',
        'HEADER_MISSING',
        def.sheetName,
        `${def.key}_HEADER_MISSING_${normalizeHeader(col.header).toUpperCase()}`,
        `Required column "${col.header}" is missing in sheet "${def.sheetName}".`,
        { column: col.header, fixHint: `Add a column named "${col.header}" to the header row.` }
      ));
    }
  }

  const hasCriticalHeaderErrors = errors.some(e => e.severity === 'CRITICAL');
  if (hasCriticalHeaderErrors) {
    return { errors, dataRowCount: 0 };
  }

  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    let hasData = false;
    const colEntries = Array.from(matchedCols.entries());
    for (const [colIdx] of colEntries) {
      const cell = row.getCell(colIdx + 1);
      if (cell.value !== null && cell.value !== undefined && String(cell.value).trim() !== '') {
        hasData = true;
        break;
      }
    }
    if (!hasData) return;

    dataRowCount++;

    for (const [colIdx, colDef] of colEntries) {
      const cell = row.getCell(colIdx + 1);
      const rawValue = cell.value;
      const strValue = rawValue !== null && rawValue !== undefined ? String(rawValue).trim() : '';

      if (colDef.required && strValue === '') {
        errors.push(makeError(
          'ERROR',
          'CELL_REQUIRED',
          def.sheetName,
          `${def.key}_REQUIRED_${normalizeHeader(colDef.header).toUpperCase()}`,
          `Row ${rowNumber}: Required field "${colDef.header}" is empty.`,
          { row: rowNumber, column: colDef.header, field: colDef.key, fixHint: `Provide a value for "${colDef.header}" in row ${rowNumber}.` }
        ));
        continue;
      }

      if (strValue === '') continue;

      if (colDef.type === 'NUMBER') {
        const num = typeof rawValue === 'number' ? rawValue : parseFloat(strValue.replace(/,/g, ''));
        if (isNaN(num)) {
          errors.push(makeError(
            'ERROR',
            'CELL_TYPE_MISMATCH',
            def.sheetName,
            `${def.key}_NOT_NUMBER_${normalizeHeader(colDef.header).toUpperCase()}`,
            `Row ${rowNumber}: "${colDef.header}" must be a number but found "${strValue}".`,
            { row: rowNumber, column: colDef.header, field: colDef.key, expected: 'number', actual: strValue }
          ));
        } else if (colDef.wholeNumberOnly && num !== Math.floor(num)) {
          errors.push(makeError(
            'WARNING',
            'CELL_WHOLE_NUMBER',
            def.sheetName,
            `${def.key}_DECIMAL_${normalizeHeader(colDef.header).toUpperCase()}`,
            `Row ${rowNumber}: "${colDef.header}" should be a whole number but found ${num}. Decimals will be rounded.`,
            { row: rowNumber, column: colDef.header, field: colDef.key, expected: 'whole number', actual: String(num) }
          ));
        }
      }

      if (colDef.type === 'DATE') {
        let dateValid = false;
        if (rawValue instanceof Date) {
          dateValid = !isNaN(rawValue.getTime());
        } else if (typeof rawValue === 'number') {
          dateValid = true;
        } else {
          const d = new Date(strValue);
          dateValid = !isNaN(d.getTime());
        }
        if (!dateValid) {
          errors.push(makeError(
            'ERROR',
            'CELL_TYPE_MISMATCH',
            def.sheetName,
            `${def.key}_NOT_DATE_${normalizeHeader(colDef.header).toUpperCase()}`,
            `Row ${rowNumber}: "${colDef.header}" must be a valid date but found "${strValue}".`,
            { row: rowNumber, column: colDef.header, field: colDef.key, expected: 'YYYY-MM-DD', actual: strValue }
          ));
        }
      }

      if (colDef.type === 'ENUM' && colDef.enumValues) {
        const upper = strValue.toUpperCase();
        if (!colDef.enumValues.map(v => v.toUpperCase()).includes(upper)) {
          errors.push(makeError(
            'ERROR',
            'CELL_ENUM_INVALID',
            def.sheetName,
            `${def.key}_INVALID_ENUM_${normalizeHeader(colDef.header).toUpperCase()}`,
            `Row ${rowNumber}: "${colDef.header}" has invalid value "${strValue}". Allowed: ${colDef.enumValues.join(', ')}.`,
            { row: rowNumber, column: colDef.header, field: colDef.key, expected: colDef.enumValues.join(', '), actual: strValue }
          ));
        }
      }
    }
  });

  if (def.minRows && dataRowCount < def.minRows) {
    errors.push(makeError(
      'WARNING',
      'SHEET_MISSING',
      def.sheetName,
      `${def.key}_MIN_ROWS`,
      `Sheet "${def.sheetName}" has only ${dataRowCount} data rows (minimum recommended: ${def.minRows}).`,
    ));
  }

  return { errors, dataRowCount };
}

function validateCrossReferences(workbook: ExcelJS.Workbook, matchedSheets: Map<SheetKey, ExcelJS.Worksheet>): ImportValidationError[] {
  const errors: ImportValidationError[] = [];

  const tbSheet = matchedSheets.get('TRIAL_BALANCE');
  const glSheet = matchedSheets.get('GL');
  const partiesSheet = matchedSheets.get('PARTIES');
  const openItemsSheet = matchedSheets.get('OPEN_ITEMS');

  const tbGlCodes = new Set<string>();
  if (tbSheet) {
    const tbHeaders = getHeaders(tbSheet);
    const glCodeIdx = findHeaderIdx(tbHeaders, 'GL_Code');
    if (glCodeIdx >= 0) {
      tbSheet.eachRow((row, rn) => {
        if (rn === 1) return;
        const val = String(row.getCell(glCodeIdx + 1).value || '').trim();
        if (val) tbGlCodes.add(val);
      });
    }
  }

  const partyIds = new Set<string>();
  if (partiesSheet) {
    const pHeaders = getHeaders(partiesSheet);
    const pidIdx = findHeaderIdx(pHeaders, 'Party_ID');
    if (pidIdx >= 0) {
      partiesSheet.eachRow((row, rn) => {
        if (rn === 1) return;
        const val = String(row.getCell(pidIdx + 1).value || '').trim();
        if (val) partyIds.add(val);
      });
    }
  }

  if (glSheet && tbGlCodes.size > 0) {
    const glHeaders = getHeaders(glSheet);
    const glCodeIdx = findHeaderIdx(glHeaders, 'GL_Code');
    const partyIdIdx = findHeaderIdx(glHeaders, 'Party_ID');

    if (glCodeIdx >= 0) {
      const orphanGlCodes = new Set<string>();
      glSheet.eachRow((row, rn) => {
        if (rn === 1) return;
        const code = String(row.getCell(glCodeIdx + 1).value || '').trim();
        if (code && !tbGlCodes.has(code) && !orphanGlCodes.has(code)) {
          orphanGlCodes.add(code);
          errors.push(makeError(
            'ERROR',
            'REF_INTEGRITY',
            'GL',
            'GL_CODE_NOT_IN_TB',
            `GL row ${rn}: GL_Code "${code}" does not exist in Trial Balance. All GL codes must be defined in TB.`,
            { row: rn, column: 'GL_Code', field: 'glCode', expected: 'Existing TB GL_Code', actual: code, fixHint: `Add GL_Code "${code}" to the Trial Balance sheet, or correct the GL_Code in the GL sheet.` }
          ));
        }
      });
    }

    if (partyIdIdx >= 0 && partyIds.size > 0) {
      const orphanParties = new Set<string>();
      glSheet.eachRow((row, rn) => {
        if (rn === 1) return;
        const pid = String(row.getCell(partyIdIdx + 1).value || '').trim();
        if (pid && !partyIds.has(pid) && !orphanParties.has(pid)) {
          orphanParties.add(pid);
          errors.push(makeError(
            'WARNING',
            'REF_INTEGRITY',
            'GL',
            'GL_PARTY_NOT_IN_PARTIES',
            `GL row ${rn}: Party_ID "${pid}" does not exist in Parties sheet.`,
            { row: rn, column: 'Party_ID', field: 'partyId', expected: 'Existing Party_ID', actual: pid, fixHint: `Add Party_ID "${pid}" to the Parties sheet.` }
          ));
        }
      });
    }
  }

  if (openItemsSheet && partyIds.size > 0) {
    const oiHeaders = getHeaders(openItemsSheet);
    const pidIdx = findHeaderIdx(oiHeaders, 'Party_ID');
    if (pidIdx >= 0) {
      const orphanParties = new Set<string>();
      openItemsSheet.eachRow((row, rn) => {
        if (rn === 1) return;
        const pid = String(row.getCell(pidIdx + 1).value || '').trim();
        if (pid && !partyIds.has(pid) && !orphanParties.has(pid)) {
          orphanParties.add(pid);
          errors.push(makeError(
            'WARNING',
            'REF_INTEGRITY',
            'Open Items',
            'OI_PARTY_NOT_IN_PARTIES',
            `Open Items row ${rn}: Party_ID "${pid}" does not exist in Parties sheet.`,
            { row: rn, column: 'Party_ID', field: 'partyId', expected: 'Existing Party_ID', actual: pid, fixHint: `Add Party_ID "${pid}" to the Parties sheet.` }
          ));
        }
      });
    }
  }

  if (tbSheet) {
    const tbHeaders = getHeaders(tbSheet);
    const glCodeIdx = findHeaderIdx(tbHeaders, 'GL_Code');
    if (glCodeIdx >= 0) {
      const seenCodes = new Map<string, number>();
      tbSheet.eachRow((row, rn) => {
        if (rn === 1) return;
        const code = String(row.getCell(glCodeIdx + 1).value || '').trim();
        if (!code) return;
        if (seenCodes.has(code)) {
          errors.push(makeError(
            'ERROR',
            'DUPLICATE_KEY',
            'Trial Balance',
            'TB_DUPLICATE_GL_CODE',
            `Trial Balance row ${rn}: Duplicate GL_Code "${code}" (first seen at row ${seenCodes.get(code)}).`,
            { row: rn, column: 'GL_Code', field: 'glCode', fixHint: `Remove duplicate or merge rows for GL_Code "${code}".` }
          ));
        } else {
          seenCodes.set(code, rn);
        }
      });
    }
  }

  return errors;
}

function getHeaders(ws: ExcelJS.Worksheet): string[] {
  const headers: string[] = [];
  ws.getRow(1).eachCell((cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value || '').trim();
  });
  return headers;
}

function findHeaderIdx(headers: string[], target: string): number {
  const norm = normalizeHeader(target);
  return headers.findIndex(h => normalizeHeader(h) === norm);
}

export async function generateErrorReport(errors: ImportValidationError[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'AuditWise';
  wb.created = new Date();

  const ws = wb.addWorksheet('Import Errors');

  const headerStyle: Partial<ExcelJS.Style> = {
    font: { bold: true, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC0392B' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: {
      top: { style: 'thin' }, left: { style: 'thin' },
      bottom: { style: 'thin' }, right: { style: 'thin' },
    },
  };

  ws.columns = [
    { header: '#', key: 'idx', width: 6 },
    { header: 'Severity', key: 'severity', width: 12 },
    { header: 'Category', key: 'category', width: 18 },
    { header: 'Sheet', key: 'sheet', width: 18 },
    { header: 'Row', key: 'row', width: 8 },
    { header: 'Column', key: 'column', width: 18 },
    { header: 'Message', key: 'message', width: 60 },
    { header: 'Expected', key: 'expected', width: 25 },
    { header: 'Actual', key: 'actual', width: 25 },
    { header: 'How to Fix', key: 'fixHint', width: 50 },
    { header: 'Rule Code', key: 'ruleCode', width: 25 },
  ];

  ws.getRow(1).eachCell(cell => { cell.style = headerStyle; });

  const severityColors: Record<string, string> = {
    CRITICAL: 'FFE74C3C',
    ERROR: 'FFF39C12',
    WARNING: 'FFF1C40F',
    INFO: 'FF3498DB',
  };

  const sorted = [...errors].sort((a, b) => {
    const order = { CRITICAL: 0, ERROR: 1, WARNING: 2, INFO: 3 };
    return (order[a.severity] ?? 4) - (order[b.severity] ?? 4);
  });

  sorted.forEach((err, idx) => {
    const row = ws.addRow({
      idx: idx + 1,
      severity: err.severity,
      category: err.category,
      sheet: err.sheet,
      row: err.row || '',
      column: err.column || '',
      message: err.message,
      expected: err.expected || '',
      actual: err.actual || '',
      fixHint: err.fixHint || '',
      ruleCode: err.ruleCode,
    });

    const color = severityColors[err.severity];
    if (color) {
      row.getCell(2).fill = {
        type: 'pattern', pattern: 'solid',
        fgColor: { argb: color },
      };
      row.getCell(2).font = { bold: true, color: { argb: err.severity === 'WARNING' ? 'FF000000' : 'FFFFFFFF' } };
    }
  });

  const summarySheet = wb.addWorksheet('Summary');
  summarySheet.columns = [
    { header: 'Metric', key: 'metric', width: 30 },
    { header: 'Value', key: 'value', width: 20 },
  ];
  summarySheet.getRow(1).eachCell(cell => { cell.style = headerStyle; });

  const criticalCount = errors.filter(e => e.severity === 'CRITICAL').length;
  const errorCount = errors.filter(e => e.severity === 'ERROR').length;
  const warningCount = errors.filter(e => e.severity === 'WARNING').length;

  summarySheet.addRows([
    { metric: 'Total Issues', value: errors.length },
    { metric: 'Critical (Blocking)', value: criticalCount },
    { metric: 'Errors (Blocking)', value: errorCount },
    { metric: 'Warnings (Non-blocking)', value: warningCount },
    { metric: 'Info', value: errors.filter(e => e.severity === 'INFO').length },
    { metric: '', value: '' },
    { metric: 'Import Allowed?', value: criticalCount === 0 && errorCount === 0 ? 'YES' : 'NO - Fix CRITICAL and ERROR issues' },
  ]);

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
