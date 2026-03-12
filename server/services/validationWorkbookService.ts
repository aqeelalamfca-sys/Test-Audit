import ExcelJS from "exceljs";
import { withTenantContext } from "../middleware/tenantDbContext";

interface TBRow {
  accountCode: string;
  accountName: string | null;
  accountClass: string | null;
  fsHeadKey: string | null;
  openingDebit: number;
  openingCredit: number;
  closingDebit: number;
  closingCredit: number;
  obNet: number;
  cbNet: number;
  tbNetMovement: number;
}

interface GLAggRow {
  accountCode: string;
  accountName: string | null;
  totalDebit: number;
  totalCredit: number;
  glNetMovement: number;
  entryCount: number;
  hasBlankNarration: boolean;
  earliestDate: Date | null;
  latestDate: Date | null;
}

interface PartyRow {
  partyCode: string;
  partyName: string | null;
  partyType: string;
  controlAccountCode: string;
  balanceType: string;
  balance: number;
  drcr: string;
}

interface BankRow {
  bankAccountCode: string;
  bankName: string;
  accountNo: string;
  accountTitle: string;
  glCode: string;
  closingBalance: number;
  drcr: string;
}

interface EngagementMeta {
  clientName: string;
  firmName: string;
  periodEnd: string;
  engagementCode: string;
}

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } };
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
const SECTION_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E2F3" } };
const SECTION_FONT: Partial<ExcelJS.Font> = { bold: true, size: 11, color: { argb: "FF1F4E79" } };
const PASS_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC6EFCE" } };
const FAIL_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFC7CE" } };
const WARN_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFEB9C" } };
const INFO_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDDEBF7" } };
const NUMBER_FMT = '#,##0.00';
const INT_FMT = '#,##0';

function styleHeaderRow(ws: ExcelJS.Worksheet) {
  const row = ws.getRow(1);
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF000000" } },
      right: { style: "thin", color: { argb: "FF4472C4" } },
    };
  });
  row.height = 32;
  ws.views = [{ state: "frozen", ySplit: 1, xSplit: 0 }];
}

function applyAutoFilter(ws: ExcelJS.Worksheet) {
  if (ws.rowCount > 1) {
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: ws.rowCount, column: ws.columnCount } };
  }
}

function addSectionRow(ws: ExcelJS.Worksheet, text: string, colCount: number) {
  const row = ws.addRow([text]);
  row.font = SECTION_FONT;
  ws.mergeCells(row.number, 1, row.number, colCount);
  row.getCell(1).fill = SECTION_FILL;
  row.getCell(1).alignment = { horizontal: "left", vertical: "middle" };
  row.height = 24;
  return row;
}

function statusFill(status: string): ExcelJS.Fill {
  if (status === "PASS") return PASS_FILL;
  if (status === "FAIL" || status === "CRITICAL" || status === "High") return FAIL_FILL;
  if (status === "WARN" || status === "WARNING" || status === "Medium") return WARN_FILL;
  if (status === "INFO" || status === "Low") return INFO_FILL;
  return { type: "pattern", pattern: "none" };
}

function addConditionalFormatting(ws: ExcelJS.Worksheet, col: string, lastRow: number) {
  ws.addConditionalFormatting({
    ref: `${col}2:${col}${lastRow}`,
    rules: [
      {
        type: "containsText",
        operator: "containsText",
        text: "FAIL",
        priority: 1,
        style: { fill: FAIL_FILL, font: { bold: true, color: { argb: "FF9C0006" } } },
      },
      {
        type: "containsText",
        operator: "containsText",
        text: "PASS",
        priority: 2,
        style: { fill: PASS_FILL, font: { color: { argb: "FF006100" } } },
      },
      {
        type: "containsText",
        operator: "containsText",
        text: "WARN",
        priority: 3,
        style: { fill: WARN_FILL, font: { color: { argb: "FF9C6500" } } },
      },
      {
        type: "containsText",
        operator: "containsText",
        text: "MISMATCH",
        priority: 4,
        style: { fill: FAIL_FILL, font: { bold: true, color: { argb: "FF9C0006" } } },
      },
    ],
  });
}

export async function generateValidationWorkbook(
  engagementId: string,
  firmId: string
): Promise<Buffer> {

  const tbRows: TBRow[] = [];
  const glAgg: Map<string, GLAggRow> = new Map();
  const partyRows: PartyRow[] = [];
  const bankRows: BankRow[] = [];
  let meta: EngagementMeta = { clientName: "", firmName: "", periodEnd: "", engagementCode: "" };
  const duplicateTbCodes: string[] = [];
  const duplicateGlTransactions: Array<{ journalId: string; voucherNo: string; accountCode: string; count: number }> = [];
  const invalidDateEntries: Array<{ accountCode: string; voucherNo: string; date: string }> = [];

  await withTenantContext(firmId, async (tx) => {
    const engagement = await tx.engagement.findUnique({
      where: { id: engagementId },
      include: {
        client: { select: { name: true, displayName: true } },
        firm: { select: { name: true, displayName: true } },
      },
    });
    if (engagement) {
      meta = {
        clientName: engagement.client?.displayName || engagement.client?.name || "",
        firmName: engagement.firm?.displayName || engagement.firm?.name || "",
        periodEnd: engagement.periodEnd ? new Date(engagement.periodEnd).toISOString().split("T")[0] : "",
        engagementCode: engagement.engagementCode || engagement.id,
      };
    }

    const obRows = await tx.importAccountBalance.findMany({
      where: { engagementId, balanceType: "OB" },
      select: { accountCode: true, accountName: true, debitAmount: true, creditAmount: true, accountClass: true, fsHeadKey: true },
    });
    const cbRows = await tx.importAccountBalance.findMany({
      where: { engagementId, balanceType: "CB" },
      select: { accountCode: true, accountName: true, debitAmount: true, creditAmount: true, accountClass: true, fsHeadKey: true },
    });

    const obCodeCounts = new Map<string, number>();
    for (const r of obRows) {
      const trimmed = r.accountCode.trim();
      obCodeCounts.set(trimmed, (obCodeCounts.get(trimmed) || 0) + 1);
    }
    const cbCodeCounts = new Map<string, number>();
    for (const r of cbRows) {
      const trimmed = r.accountCode.trim();
      cbCodeCounts.set(trimmed, (cbCodeCounts.get(trimmed) || 0) + 1);
    }
    for (const [code, count] of obCodeCounts) {
      if (count > 1) duplicateTbCodes.push(`${code} (OB x${count})`);
    }
    for (const [code, count] of cbCodeCounts) {
      if (count > 1) duplicateTbCodes.push(`${code} (CB x${count})`);
    }

    const obMap = new Map(obRows.map(r => [r.accountCode.trim(), r]));
    const cbMap = new Map(cbRows.map(r => [r.accountCode.trim(), r]));

    const allCodes = new Set([...obMap.keys(), ...cbMap.keys()]);
    for (const code of allCodes) {
      const ob = obMap.get(code);
      const cb = cbMap.get(code);
      const obDr = Number(ob?.debitAmount ?? 0);
      const obCr = Number(ob?.creditAmount ?? 0);
      const cbDr = Number(cb?.debitAmount ?? 0);
      const cbCr = Number(cb?.creditAmount ?? 0);
      const obNet = obDr - obCr;
      const cbNet = cbDr - cbCr;
      tbRows.push({
        accountCode: code,
        accountName: ob?.accountName ?? cb?.accountName ?? null,
        accountClass: cb?.accountClass ?? ob?.accountClass ?? null,
        fsHeadKey: cb?.fsHeadKey ?? ob?.fsHeadKey ?? null,
        openingDebit: obDr,
        openingCredit: obCr,
        closingDebit: cbDr,
        closingCredit: cbCr,
        obNet,
        cbNet,
        tbNetMovement: cbNet - obNet,
      });
    }
    tbRows.sort((a, b) => a.accountCode.localeCompare(b.accountCode));

    const glHeaders = await tx.importJournalHeader.findMany({
      where: { engagementId },
      select: { id: true, journalId: true, voucherNo: true, voucherDate: true },
    });
    const headerDateMap = new Map(glHeaders.map(h => [h.id, h.voucherDate]));
    const headerInfoMap = new Map(glHeaders.map(h => [h.id, { journalId: h.journalId, voucherNo: h.voucherNo, voucherDate: h.voucherDate }]));

    const periodEndDate = meta.periodEnd ? new Date(meta.periodEnd) : null;
    const periodStartDate = periodEndDate ? new Date(periodEndDate.getFullYear() - 1, periodEndDate.getMonth(), periodEndDate.getDate() + 1) : null;

    const glLines = await tx.importJournalLine.findMany({
      where: { journalHeader: { engagementId } },
      select: { accountCode: true, accountName: true, debit: true, credit: true, narration: true, description: true, journalHeaderId: true },
    });

    const txnFingerprints = new Map<string, number>();
    for (const line of glLines) {
      const code = line.accountCode.trim();
      const dr = Number(line.debit);
      const cr = Number(line.credit);
      const hasBlankNarr = !line.narration && !line.description;
      const headerInfo = headerInfoMap.get(line.journalHeaderId);
      const voucherDate = headerDateMap.get(line.journalHeaderId) ?? null;

      if (voucherDate && periodEndDate && periodStartDate) {
        if (voucherDate > periodEndDate || voucherDate < periodStartDate) {
          invalidDateEntries.push({
            accountCode: code,
            voucherNo: headerInfo?.voucherNo ?? "",
            date: voucherDate.toISOString().split("T")[0],
          });
        }
      }

      const fingerprint = `${headerInfo?.voucherNo ?? ""}|${code}|${dr}|${cr}`;
      txnFingerprints.set(fingerprint, (txnFingerprints.get(fingerprint) || 0) + 1);

      const existing = glAgg.get(code);
      if (existing) {
        existing.totalDebit += dr;
        existing.totalCredit += cr;
        existing.glNetMovement += (dr - cr);
        existing.entryCount++;
        if (hasBlankNarr) existing.hasBlankNarration = true;
        if (!existing.accountName && line.accountName) existing.accountName = line.accountName;
        if (voucherDate) {
          if (!existing.earliestDate || voucherDate < existing.earliestDate) existing.earliestDate = voucherDate;
          if (!existing.latestDate || voucherDate > existing.latestDate) existing.latestDate = voucherDate;
        }
      } else {
        glAgg.set(code, {
          accountCode: code,
          accountName: line.accountName,
          totalDebit: dr,
          totalCredit: cr,
          glNetMovement: dr - cr,
          entryCount: 1,
          hasBlankNarration: hasBlankNarr,
          earliestDate: voucherDate,
          latestDate: voucherDate,
        });
      }
    }

    for (const [fp, count] of txnFingerprints) {
      if (count > 1) {
        const parts = fp.split("|");
        duplicateGlTransactions.push({
          journalId: "",
          voucherNo: parts[0],
          accountCode: parts[1],
          count,
        });
      }
    }

    const parties = await tx.importPartyBalance.findMany({
      where: { engagementId },
      select: {
        partyCode: true, partyName: true, partyType: true,
        controlAccountCode: true, balanceType: true, balance: true, drcr: true,
      },
    });
    for (const p of parties) {
      partyRows.push({
        partyCode: p.partyCode,
        partyName: p.partyName,
        partyType: p.partyType,
        controlAccountCode: p.controlAccountCode.trim(),
        balanceType: p.balanceType,
        balance: Number(p.balance),
        drcr: p.drcr,
      });
    }

    const bankAccounts = await tx.importBankAccount.findMany({
      where: { engagementId },
      select: { bankAccountCode: true, bankName: true, accountNo: true, accountTitle: true },
    });
    const bankBalances = await tx.importBankBalance.findMany({
      where: { engagementId },
      orderBy: { asOfDate: "desc" },
      select: { bankAccountCode: true, glBankAccountCode: true, closingBalance: true, drcr: true },
    });
    const balMap = new Map<string, typeof bankBalances[0]>();
    for (const b of bankBalances) {
      if (!balMap.has(b.bankAccountCode)) {
        balMap.set(b.bankAccountCode, b);
      }
    }
    for (const ba of bankAccounts) {
      const bal = balMap.get(ba.bankAccountCode);
      bankRows.push({
        bankAccountCode: ba.bankAccountCode,
        bankName: ba.bankName,
        accountNo: ba.accountNo,
        accountTitle: ba.accountTitle,
        glCode: (bal?.glBankAccountCode ?? "").trim(),
        closingBalance: Number(bal?.closingBalance ?? 0),
        drcr: bal?.drcr ?? "DR",
      });
    }
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "AuditWise";
  workbook.created = new Date();

  buildControlSummary(workbook, tbRows, glAgg, partyRows, bankRows, meta, duplicateTbCodes, duplicateGlTransactions, invalidDateEntries);
  buildTBValidation(workbook, tbRows, glAgg);
  buildGLvsTBValidation(workbook, tbRows, glAgg, meta, duplicateGlTransactions, invalidDateEntries);
  buildSubledgerValidation(workbook, tbRows, partyRows, bankRows, glAgg);
  buildExceptionsReport(workbook, tbRows, glAgg, partyRows, bankRows, meta, duplicateTbCodes, duplicateGlTransactions, invalidDateEntries);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function buildControlSummary(
  wb: ExcelJS.Workbook,
  tbRows: TBRow[],
  glAgg: Map<string, GLAggRow>,
  partyRows: PartyRow[],
  bankRows: BankRow[],
  meta: EngagementMeta,
  duplicateTbCodes: string[],
  duplicateGlTransactions: Array<{ journalId: string; voucherNo: string; accountCode: string; count: number }>,
  invalidDateEntries: Array<{ accountCode: string; voucherNo: string; date: string }>
) {
  const ws = wb.addWorksheet("Control_Summary");

  ws.columns = [
    { header: "Control Check", key: "check", width: 44 },
    { header: "Value / Count", key: "value", width: 24 },
    { header: "Status", key: "status", width: 14 },
    { header: "Notes / Auditor Remarks", key: "notes", width: 50 },
  ];
  styleHeaderRow(ws);

  const tbCodeSet = new Set(tbRows.map(r => r.accountCode));
  const glCodeSet = new Set(glAgg.keys());
  const matchedCodes = [...tbCodeSet].filter(c => glCodeSet.has(c));
  const codesOnlyInGL = [...glCodeSet].filter(c => !tbCodeSet.has(c));
  const codesOnlyInTBWithMov = tbRows.filter(r => !glCodeSet.has(r.accountCode) && Math.abs(r.tbNetMovement) > 0);
  const codesOnlyInTBNoMov = tbRows.filter(r => !glCodeSet.has(r.accountCode) && Math.abs(r.tbNetMovement) === 0);

  const tbTotalOBDr = tbRows.reduce((s, r) => s + r.openingDebit, 0);
  const tbTotalOBCr = tbRows.reduce((s, r) => s + r.openingCredit, 0);
  const tbTotalCBDr = tbRows.reduce((s, r) => s + r.closingDebit, 0);
  const tbTotalCBCr = tbRows.reduce((s, r) => s + r.closingCredit, 0);
  const tbNetMovTotal = tbRows.reduce((s, r) => s + r.tbNetMovement, 0);

  const glTotalDr = Array.from(glAgg.values()).reduce((s, r) => s + r.totalDebit, 0);
  const glTotalCr = Array.from(glAgg.values()).reduce((s, r) => s + r.totalCredit, 0);
  const glNetMovTotal = Array.from(glAgg.values()).reduce((s, r) => s + r.glNetMovement, 0);
  const glEntryCount = Array.from(glAgg.values()).reduce((s, r) => s + r.entryCount, 0);

  const obBalance = Math.abs(tbTotalOBDr - tbTotalOBCr);
  const cbBalance = Math.abs(tbTotalCBDr - tbTotalCBCr);
  const glBalance = Math.abs(glTotalDr - glTotalCr);
  const netMovDiff = Math.abs(tbNetMovTotal - glNetMovTotal);

  const tbUnmapped = tbRows.filter(r => !r.fsHeadKey).length;
  const tbBlankNames = tbRows.filter(r => !r.accountName || r.accountName.trim() === "").length;
  const tbZeroBal = tbRows.filter(r => Math.abs(r.cbNet) < 0.01 && Math.abs(r.obNet) < 0.01).length;
  const tbDualBal = tbRows.filter(r => r.closingDebit > 0 && r.closingCredit > 0).length;

  const glBlankNarr = Array.from(glAgg.values()).filter(r => r.hasBlankNarration).length;

  const cbPartySumByCtrl = new Map<string, number>();
  for (const p of partyRows.filter(pp => pp.balanceType === "CB")) {
    const signed = p.drcr === "DR" ? p.balance : -p.balance;
    cbPartySumByCtrl.set(p.controlAccountCode, (cbPartySumByCtrl.get(p.controlAccountCode) || 0) + signed);
  }
  let subReconPassCount = 0;
  let subReconFailCount = 0;
  const tbMap = new Map(tbRows.map(r => [r.accountCode, r]));
  for (const [ctrl, subTotal] of cbPartySumByCtrl) {
    const tb = tbMap.get(ctrl);
    const tbNet = tb ? tb.cbNet : 0;
    if (Math.abs(subTotal - tbNet) < 1) subReconPassCount++;
    else subReconFailCount++;
  }

  const tolerance = 1;

  const addCheck = (check: string, value: string | number, status: string, notes: string) => {
    const row = ws.addRow({ check, value, status, notes });
    if (status) row.getCell("status").fill = statusFill(status);
    return row;
  };

  addSectionRow(ws, "ENGAGEMENT INFORMATION", 4);
  addCheck("Client Name", meta.clientName, "", "");
  addCheck("Firm Name", meta.firmName, "", "");
  addCheck("Engagement Code", meta.engagementCode, "", "");
  addCheck("Period End Date", meta.periodEnd, "", "");
  addCheck("Workbook Generated", new Date().toISOString().split("T")[0], "", "");
  ws.addRow({});

  addSectionRow(ws, "DATA COMPLETENESS", 4);
  addCheck("TB Account Count", tbRows.length, tbRows.length > 0 ? "PASS" : "FAIL", "");
  addCheck("GL Entry Count", glEntryCount, glEntryCount > 0 ? "PASS" : "FAIL", "");
  addCheck("GL Unique Account Count", glAgg.size, "", "");
  addCheck("Party Balance Count (AR/AP)", partyRows.length, "", "");
  addCheck("Bank Account Count", bankRows.length, "", "");
  ws.addRow({});

  addSectionRow(ws, "GL CODE RECONCILIATION", 4);
  addCheck("Matched GL Codes (TB & GL)", matchedCodes.length, matchedCodes.length > 0 ? "PASS" : "FAIL", "");
  addCheck("GL Codes in GL only (not in TB)", codesOnlyInGL.length, codesOnlyInGL.length === 0 ? "PASS" : "WARN", codesOnlyInGL.length > 0 ? codesOnlyInGL.slice(0, 8).join(", ") + (codesOnlyInGL.length > 8 ? ` (+${codesOnlyInGL.length - 8} more)` : "") : "");
  addCheck("TB Codes with movement but no GL", codesOnlyInTBWithMov.length, codesOnlyInTBWithMov.length === 0 ? "PASS" : "WARN", codesOnlyInTBWithMov.length > 0 ? codesOnlyInTBWithMov.slice(0, 8).map(r => r.accountCode).join(", ") : "");
  addCheck("TB Codes without movement, no GL", codesOnlyInTBNoMov.length, "", "Static balances (no period activity)");
  ws.addRow({});

  addSectionRow(ws, "TB BALANCE CHECKS", 4);
  addCheck("TB Opening Balance (DR - CR)", (tbTotalOBDr - tbTotalOBCr).toFixed(2), obBalance <= tolerance ? "PASS" : "FAIL", obBalance <= tolerance ? "Balanced" : `Difference: ${obBalance.toFixed(2)}`);
  addCheck("TB Closing Balance (DR - CR)", (tbTotalCBDr - tbTotalCBCr).toFixed(2), cbBalance <= tolerance ? "PASS" : "FAIL", cbBalance <= tolerance ? "Balanced" : `Difference: ${cbBalance.toFixed(2)}`);
  addCheck("GL Total DR - CR", (glTotalDr - glTotalCr).toFixed(2), glBalance <= tolerance ? "PASS" : "WARN", glBalance <= tolerance ? "Balanced" : `Difference: ${glBalance.toFixed(2)}`);
  ws.addRow({});

  addSectionRow(ws, "TB-GL NET MOVEMENT RECONCILIATION", 4);
  addCheck("TB Net Movement Total (CB_net - OB_net)", tbNetMovTotal.toFixed(2), "", "");
  addCheck("GL Net Movement Total (GL_DR - GL_CR)", glNetMovTotal.toFixed(2), "", "");
  addCheck("Net Movement Difference", netMovDiff.toFixed(2), netMovDiff <= tolerance ? "PASS" : "FAIL", netMovDiff <= tolerance ? "Reconciled" : `Difference: ${netMovDiff.toFixed(2)}`);
  ws.addRow({});

  addSectionRow(ws, "DATA QUALITY CHECKS", 4);
  addCheck("TB Accounts without FS Head mapping", tbUnmapped, tbUnmapped === 0 ? "PASS" : "WARN", tbUnmapped > 0 ? "Accounts need FS line mapping" : "All mapped");
  addCheck("TB Accounts with blank names", tbBlankNames, tbBlankNames === 0 ? "PASS" : "WARN", "");
  addCheck("TB Accounts with zero balances (OB & CB)", tbZeroBal, "", "");
  addCheck("TB Accounts with dual DR/CR closing balance", tbDualBal, tbDualBal === 0 ? "PASS" : "WARN", tbDualBal > 0 ? "Unusual: both DR and CR closing" : "");
  addCheck("GL Accounts with blank narrations", glBlankNarr, glBlankNarr === 0 ? "PASS" : "WARN", glBlankNarr > 0 ? "Entries without description" : "");
  addCheck("Duplicate TB GL codes (after trim)", duplicateTbCodes.length, duplicateTbCodes.length === 0 ? "PASS" : "FAIL", duplicateTbCodes.length > 0 ? duplicateTbCodes.slice(0, 5).join(", ") : "No duplicates");
  addCheck("Duplicate GL transactions", duplicateGlTransactions.length, duplicateGlTransactions.length === 0 ? "PASS" : "WARN", duplicateGlTransactions.length > 0 ? `${duplicateGlTransactions.length} potential duplicate groups` : "No duplicates");
  addCheck("GL entries with dates outside period", invalidDateEntries.length, invalidDateEntries.length === 0 ? "PASS" : "WARN", invalidDateEntries.length > 0 ? `${invalidDateEntries.length} entries outside ${meta.periodEnd || "period"}` : "All within period");
  ws.addRow({});

  addSectionRow(ws, "SUBLEDGER RECONCILIATION SUMMARY", 4);
  addCheck("Subledger control accounts reconciled", subReconPassCount, subReconPassCount > 0 ? "PASS" : "", "");
  addCheck("Subledger control accounts unreconciled", subReconFailCount, subReconFailCount === 0 ? "PASS" : "FAIL", "");
  addCheck("Bank accounts loaded", bankRows.length, "", "");
  ws.addRow({});

  addSectionRow(ws, "OVERALL RECONCILIATION STATUS", 4);
  const tbBalOk = obBalance <= tolerance && cbBalance <= tolerance;
  const glReconOk = netMovDiff <= tolerance;
  const subReconOk = subReconFailCount === 0;
  const dataQualOk = duplicateTbCodes.length === 0 && duplicateGlTransactions.length === 0;
  const overallStatus = tbBalOk && glReconOk && subReconOk && dataQualOk ? "PASS" : (glReconOk && tbBalOk ? "WARN" : "FAIL");
  addCheck("TB Balances", tbBalOk ? "Balanced" : "Unbalanced", tbBalOk ? "PASS" : "FAIL", "");
  addCheck("GL-TB Reconciliation", glReconOk ? "Reconciled" : "Unreconciled", glReconOk ? "PASS" : "FAIL", "");
  addCheck("Subledger Reconciliation", subReconOk ? "All reconciled" : `${subReconFailCount} unreconciled`, subReconOk ? "PASS" : "FAIL", "");
  addCheck("Data Integrity", dataQualOk ? "No duplicates" : "Issues found", dataQualOk ? "PASS" : "WARN", "");
  addCheck("OVERALL STATUS", overallStatus, overallStatus, overallStatus === "PASS" ? "All checks passed" : "Review exceptions");
  ws.addRow({});

  addSectionRow(ws, "NAVIGATION", 4);
  const sheetLinks = [
    { name: "TB_Validation", desc: "Trial Balance detail validation" },
    { name: "GL_vs_TB_Validation", desc: "GL vs TB reconciliation detail" },
    { name: "Subledger_Validation", desc: "Subledger & Bank reconciliation" },
    { name: "Exceptions_Report", desc: "All exceptions and findings" },
  ];
  for (const link of sheetLinks) {
    const linkRow = ws.addRow({ check: link.name, value: link.desc, status: "", notes: "" });
    linkRow.getCell("check").value = { text: link.name, hyperlink: `#'${link.name}'!A1` } as any;
    linkRow.getCell("check").font = { color: { argb: "FF0070C0" }, underline: true };
  }
  ws.addRow({});

  addSectionRow(ws, "TOTALS REFERENCE", 4);
  addCheck("TB Opening Debit Total", tbTotalOBDr.toFixed(2), "", "");
  addCheck("TB Opening Credit Total", tbTotalOBCr.toFixed(2), "", "");
  addCheck("TB Closing Debit Total", tbTotalCBDr.toFixed(2), "", "");
  addCheck("TB Closing Credit Total", tbTotalCBCr.toFixed(2), "", "");
  addCheck("GL Debit Total", glTotalDr.toFixed(2), "", "");
  addCheck("GL Credit Total", glTotalCr.toFixed(2), "", "");

  addConditionalFormatting(ws, "C", ws.rowCount);
}

function buildTBValidation(wb: ExcelJS.Workbook, tbRows: TBRow[], glAgg: Map<string, GLAggRow>) {
  const ws = wb.addWorksheet("TB_Validation");

  ws.columns = [
    { header: "GL Code", key: "code", width: 16 },
    { header: "Account Name", key: "name", width: 32 },
    { header: "Account Class", key: "accClass", width: 16 },
    { header: "FS Head", key: "fsHead", width: 18 },
    { header: "OB Debit", key: "obDr", width: 16 },
    { header: "OB Credit", key: "obCr", width: 16 },
    { header: "OB Net (DR-CR)", key: "obNet", width: 16 },
    { header: "CB Debit", key: "cbDr", width: 16 },
    { header: "CB Credit", key: "cbCr", width: 16 },
    { header: "CB Net (DR-CR)", key: "cbNet", width: 16 },
    { header: "Net Movement", key: "netMov", width: 16 },
    { header: "Cross-Cast (OB+Mov=CB)", key: "crossCast", width: 22 },
    { header: "In GL?", key: "inGl", width: 10 },
    { header: "Blank Name?", key: "blankName", width: 12 },
    { header: "Zero Balance?", key: "zeroBal", width: 13 },
    { header: "Dual DR/CR?", key: "dualBal", width: 12 },
    { header: "FS Mapped?", key: "fsMapped", width: 12 },
    { header: "Unusual Sign?", key: "unusualSign", width: 14 },
    { header: "Checks", key: "checks", width: 14 },
  ];
  styleHeaderRow(ws);

  for (const tb of tbRows) {
    const inGl = glAgg.has(tb.accountCode);
    const blankName = !tb.accountName || tb.accountName.trim() === "";
    const zeroBal = Math.abs(tb.cbNet) < 0.01 && Math.abs(tb.obNet) < 0.01;
    const dualBal = tb.closingDebit > 0 && tb.closingCredit > 0;
    const fsMapped = !!tb.fsHeadKey;

    let unusualSign = false;
    if (tb.accountClass) {
      const assetLike = ["ASSET", "EXPENSE"].includes(tb.accountClass.toUpperCase());
      if (assetLike && tb.cbNet < -1) unusualSign = true;
      const liabLike = ["LIABILITY", "EQUITY", "INCOME", "REVENUE"].includes(tb.accountClass.toUpperCase());
      if (liabLike && tb.cbNet > 1) unusualSign = true;
    }

    const crossCastExpected = tb.obNet + tb.tbNetMovement;
    const crossCastDiff = Math.abs(crossCastExpected - tb.cbNet);
    const crossCastPass = crossCastDiff < 1;

    const issues: string[] = [];
    if (blankName) issues.push("BLANK_NAME");
    if (dualBal) issues.push("DUAL_BAL");
    if (!fsMapped) issues.push("NO_FS");
    if (unusualSign) issues.push("UNUSUAL_SIGN");
    if (!inGl && Math.abs(tb.tbNetMovement) > 0) issues.push("NO_GL");
    if (!crossCastPass && inGl) issues.push("CROSS_CAST");

    const checksStatus = issues.length === 0 ? "PASS" : issues.length <= 1 ? "WARN" : "FAIL";

    const row = ws.addRow({
      code: tb.accountCode,
      name: tb.accountName ?? "",
      accClass: tb.accountClass ?? "",
      fsHead: tb.fsHeadKey ?? "",
      obDr: tb.openingDebit,
      obCr: tb.openingCredit,
      obNet: tb.obNet,
      cbDr: tb.closingDebit,
      cbCr: tb.closingCredit,
      cbNet: tb.cbNet,
      netMov: tb.tbNetMovement,
      crossCast: crossCastPass ? "PASS" : `FAIL (${crossCastDiff.toFixed(2)})`,
      inGl: inGl ? "YES" : "NO",
      blankName: blankName ? "YES" : "",
      zeroBal: zeroBal ? "YES" : "",
      dualBal: dualBal ? "YES" : "",
      fsMapped: fsMapped ? "YES" : "NO",
      unusualSign: unusualSign ? "YES" : "",
      checks: checksStatus,
    });

    for (let c = 5; c <= 11; c++) {
      row.getCell(c).numFmt = NUMBER_FMT;
    }
    if (!crossCastPass) row.getCell("crossCast").fill = FAIL_FILL;
    row.getCell("checks").fill = statusFill(checksStatus);
    if (blankName) row.getCell("blankName").fill = WARN_FILL;
    if (dualBal) row.getCell("dualBal").fill = WARN_FILL;
    if (!fsMapped) row.getCell("fsMapped").fill = WARN_FILL;
    if (unusualSign) row.getCell("unusualSign").fill = FAIL_FILL;
    if (!inGl) row.getCell("inGl").fill = WARN_FILL;
  }

  const totRow = ws.addRow({
    code: "TOTAL",
    name: `${tbRows.length} accounts`,
    accClass: "",
    fsHead: "",
    obDr: tbRows.reduce((s, r) => s + r.openingDebit, 0),
    obCr: tbRows.reduce((s, r) => s + r.openingCredit, 0),
    obNet: tbRows.reduce((s, r) => s + r.obNet, 0),
    cbDr: tbRows.reduce((s, r) => s + r.closingDebit, 0),
    cbCr: tbRows.reduce((s, r) => s + r.closingCredit, 0),
    cbNet: tbRows.reduce((s, r) => s + r.cbNet, 0),
    netMov: tbRows.reduce((s, r) => s + r.tbNetMovement, 0),
    crossCast: "",
    inGl: "",
    blankName: "",
    zeroBal: "",
    dualBal: "",
    fsMapped: "",
    unusualSign: "",
    checks: "",
  });
  totRow.font = { bold: true };
  for (let c = 5; c <= 11; c++) {
    totRow.getCell(c).numFmt = NUMBER_FMT;
  }

  const obDiff = Math.abs(tbRows.reduce((s, r) => s + r.openingDebit, 0) - tbRows.reduce((s, r) => s + r.openingCredit, 0));
  const cbDiff = Math.abs(tbRows.reduce((s, r) => s + r.closingDebit, 0) - tbRows.reduce((s, r) => s + r.closingCredit, 0));
  if (obDiff >= 1) totRow.getCell("obNet").fill = FAIL_FILL;
  if (cbDiff >= 1) totRow.getCell("cbNet").fill = FAIL_FILL;

  addConditionalFormatting(ws, "S", ws.rowCount);
  applyAutoFilter(ws);
}

function buildGLvsTBValidation(
  wb: ExcelJS.Workbook,
  tbRows: TBRow[],
  glAgg: Map<string, GLAggRow>,
  meta: EngagementMeta,
  duplicateGlTransactions: Array<{ journalId: string; voucherNo: string; accountCode: string; count: number }>,
  invalidDateEntries: Array<{ accountCode: string; voucherNo: string; date: string }>
) {
  const ws = wb.addWorksheet("GL_vs_TB_Validation");

  ws.columns = [
    { header: "GL Code", key: "code", width: 16 },
    { header: "TB Account Name", key: "tbName", width: 28 },
    { header: "GL Account Name", key: "glName", width: 28 },
    { header: "Name Match?", key: "nameMatch", width: 13 },
    { header: "TB Net Movement", key: "tbNetMov", width: 18 },
    { header: "GL Net Movement", key: "glNetMov", width: 18 },
    { header: "Net Difference", key: "netDiff", width: 18 },
    { header: "GL Total DR", key: "glDr", width: 16 },
    { header: "GL Total CR", key: "glCr", width: 16 },
    { header: "GL Entries", key: "entries", width: 12 },
    { header: "Blank Narrations?", key: "blankNarr", width: 16 },
    { header: "Earliest GL Date", key: "earlyDate", width: 16 },
    { header: "Latest GL Date", key: "lateDate", width: 16 },
    { header: "In TB?", key: "inTb", width: 10 },
    { header: "In GL?", key: "inGl", width: 10 },
    { header: "Dup Transactions?", key: "dupTxn", width: 18 },
    { header: "Invalid Dates?", key: "invDate", width: 16 },
    { header: "Match Status", key: "match", width: 14 },
  ];
  styleHeaderRow(ws);

  const dupByCode = new Map<string, number>();
  for (const d of duplicateGlTransactions) {
    dupByCode.set(d.accountCode, (dupByCode.get(d.accountCode) || 0) + d.count);
  }
  const invDateByCode = new Map<string, number>();
  for (const e of invalidDateEntries) {
    invDateByCode.set(e.accountCode, (invDateByCode.get(e.accountCode) || 0) + 1);
  }

  const tbMap = new Map(tbRows.map(r => [r.accountCode, r]));
  const allCodes = new Set([...tbMap.keys(), ...glAgg.keys()]);
  const sortedCodes = Array.from(allCodes).sort();

  for (const code of sortedCodes) {
    const tb = tbMap.get(code);
    const gl = glAgg.get(code);
    const tbNetMov = tb?.tbNetMovement ?? 0;
    const glNetMov = gl?.glNetMovement ?? 0;
    const netDiff = tbNetMov - glNetMov;
    const inTb = !!tb;
    const inGl = !!gl;

    const tbName = tb?.accountName ?? "";
    const glName = gl?.accountName ?? "";
    const nameMatch = (!inTb || !inGl) ? "" :
      tbName.toLowerCase().trim() === glName.toLowerCase().trim() ? "YES" :
      !glName ? "N/A" : "NO";

    const dupCount = dupByCode.get(code) || 0;
    const invDateCount = invDateByCode.get(code) || 0;

    let matchStatus = "MATCH";
    if (!inTb) matchStatus = "GL_ONLY";
    else if (!inGl) matchStatus = "TB_ONLY";
    else if (Math.abs(netDiff) >= 1) matchStatus = "MISMATCH";

    const row = ws.addRow({
      code,
      tbName,
      glName,
      nameMatch,
      tbNetMov,
      glNetMov,
      netDiff,
      glDr: gl?.totalDebit ?? 0,
      glCr: gl?.totalCredit ?? 0,
      entries: gl?.entryCount ?? 0,
      blankNarr: gl?.hasBlankNarration ? "YES" : "",
      earlyDate: gl?.earliestDate ? gl.earliestDate.toISOString().split("T")[0] : "",
      lateDate: gl?.latestDate ? gl.latestDate.toISOString().split("T")[0] : "",
      inTb: inTb ? "YES" : "NO",
      inGl: inGl ? "YES" : "NO",
      dupTxn: dupCount > 0 ? `YES (${dupCount})` : "",
      invDate: invDateCount > 0 ? `YES (${invDateCount})` : "",
      match: matchStatus,
    });

    for (let c = 5; c <= 9; c++) {
      row.getCell(c).numFmt = NUMBER_FMT;
    }

    row.getCell("match").fill = statusFill(matchStatus === "MATCH" ? "PASS" : "FAIL");
    if (matchStatus === "MISMATCH") row.getCell("netDiff").fill = FAIL_FILL;
    if (nameMatch === "NO") row.getCell("nameMatch").fill = WARN_FILL;
    if (gl?.hasBlankNarration) row.getCell("blankNarr").fill = WARN_FILL;
    if (dupCount > 0) row.getCell("dupTxn").fill = WARN_FILL;
    if (invDateCount > 0) row.getCell("invDate").fill = WARN_FILL;
  }

  const matchCount = sortedCodes.filter(c => tbMap.has(c) && glAgg.has(c) && Math.abs((tbMap.get(c)!.tbNetMovement) - (glAgg.get(c)!.glNetMovement)) < 1).length;
  const mismatchCount = sortedCodes.filter(c => tbMap.has(c) && glAgg.has(c) && Math.abs((tbMap.get(c)!.tbNetMovement) - (glAgg.get(c)!.glNetMovement)) >= 1).length;
  const glOnlyCount = sortedCodes.filter(c => !tbMap.has(c)).length;
  const tbOnlyCount = sortedCodes.filter(c => !glAgg.has(c)).length;
  ws.addRow({});
  const sumRow = ws.addRow({
    code: "SUMMARY",
    tbName: `Total: ${sortedCodes.length} codes`,
    glName: "",
    nameMatch: "",
    tbNetMov: tbRows.reduce((s, r) => s + r.tbNetMovement, 0),
    glNetMov: Array.from(glAgg.values()).reduce((s, r) => s + r.glNetMovement, 0),
    netDiff: tbRows.reduce((s, r) => s + r.tbNetMovement, 0) - Array.from(glAgg.values()).reduce((s, r) => s + r.glNetMovement, 0),
    glDr: Array.from(glAgg.values()).reduce((s, r) => s + r.totalDebit, 0),
    glCr: Array.from(glAgg.values()).reduce((s, r) => s + r.totalCredit, 0),
    entries: Array.from(glAgg.values()).reduce((s, r) => s + r.entryCount, 0),
    blankNarr: "",
    earlyDate: "",
    lateDate: "",
    inTb: "",
    inGl: "",
    dupTxn: "",
    invDate: "",
    match: `${matchCount}M/${mismatchCount}X/${glOnlyCount}GL/${tbOnlyCount}TB`,
  });
  sumRow.font = { bold: true };
  for (let c = 5; c <= 9; c++) {
    sumRow.getCell(c).numFmt = NUMBER_FMT;
  }

  addConditionalFormatting(ws, "R", ws.rowCount);
  applyAutoFilter(ws);
}

function buildSubledgerValidation(
  wb: ExcelJS.Workbook,
  tbRows: TBRow[],
  partyRows: PartyRow[],
  bankRows: BankRow[],
  glAgg: Map<string, GLAggRow>
) {
  const ws = wb.addWorksheet("Subledger_Validation");

  ws.columns = [
    { header: "Subledger Type", key: "type", width: 18 },
    { header: "Control GL Code", key: "glCode", width: 18 },
    { header: "Party/Bank Code", key: "subCode", width: 18 },
    { header: "Party/Bank Name", key: "subName", width: 28 },
    { header: "Balance Type", key: "balType", width: 14 },
    { header: "Sub Balance", key: "subBal", width: 18 },
    { header: "DR/CR", key: "drcr", width: 10 },
    { header: "TB Net (DR-CR)", key: "tbNet", width: 18 },
    { header: "GL Net Movement", key: "glNet", width: 18 },
    { header: "Sub vs TB Diff", key: "diff", width: 18 },
    { header: "Exception Count", key: "excCount", width: 14 },
    { header: "Status", key: "status", width: 12 },
  ];
  styleHeaderRow(ws);

  const tbMap = new Map(tbRows.map(r => [r.accountCode, r]));

  const controlGroups = new Map<string, { type: string; totalSub: number; items: PartyRow[] }>();
  for (const p of partyRows) {
    const key = `${p.partyType}|${p.controlAccountCode}|${p.balanceType}`;
    const grp = controlGroups.get(key);
    const signedBal = p.drcr === "DR" ? p.balance : -p.balance;
    if (grp) {
      grp.totalSub += signedBal;
      grp.items.push(p);
    } else {
      controlGroups.set(key, { type: p.partyType, totalSub: signedBal, items: [p] });
    }
  }

  for (const [key, grp] of controlGroups) {
    const parts = key.split("|");
    const ctrlCode = parts[1];
    const balType = parts[2];

    addSectionRow(ws, `${grp.type} - Control Account: ${ctrlCode} (${balType})`, 12);

    for (const p of grp.items) {
      const signedBal = p.drcr === "DR" ? p.balance : -p.balance;
      const row = ws.addRow({
        type: p.partyType,
        glCode: p.controlAccountCode,
        subCode: p.partyCode,
        subName: p.partyName ?? "",
        balType: p.balanceType,
        subBal: signedBal,
        drcr: p.drcr,
        tbNet: "",
        glNet: "",
        diff: "",
        excCount: "",
        status: "",
      });
      row.getCell("subBal").numFmt = NUMBER_FMT;
    }

    const tb = tbMap.get(ctrlCode);
    const tbNet = tb ? (balType === "CB" ? tb.cbNet : tb.obNet) : 0;
    const gl = glAgg.get(ctrlCode);
    const glNetMov = gl?.glNetMovement ?? 0;
    const diff = grp.totalSub - tbNet;
    const excCount = grp.items.filter(p => {
      const signed = p.drcr === "DR" ? p.balance : -p.balance;
      return Math.abs(signed) < 0.01;
    }).length;
    const status = Math.abs(diff) < 1 ? "PASS" : "FAIL";

    const sumRow = ws.addRow({
      type: `${grp.type} TOTAL`,
      glCode: ctrlCode,
      subCode: `${grp.items.length} parties`,
      subName: "",
      balType: balType,
      subBal: grp.totalSub,
      drcr: "",
      tbNet,
      glNet: glNetMov,
      diff,
      excCount,
      status,
    });
    sumRow.font = { bold: true };
    sumRow.getCell("status").fill = statusFill(status);
    for (const colKey of ["subBal", "tbNet", "glNet", "diff"]) {
      sumRow.getCell(colKey).numFmt = NUMBER_FMT;
    }

    ws.addRow({});
  }

  if (bankRows.length > 0) {
    addSectionRow(ws, "BANK ACCOUNTS", 12);
    for (const b of bankRows) {
      const tb = tbMap.get(b.glCode);
      const tbNet = tb ? tb.cbNet : 0;
      const gl = glAgg.get(b.glCode);
      const glNetMov = gl?.glNetMovement ?? 0;
      const signedBal = b.drcr === "DR" ? b.closingBalance : -b.closingBalance;
      const diff = signedBal - tbNet;
      const status = Math.abs(diff) < 1 ? "PASS" : "FAIL";

      const row = ws.addRow({
        type: "BANK",
        glCode: b.glCode,
        subCode: b.bankAccountCode,
        subName: `${b.bankName} - ${b.accountTitle} (${b.accountNo})`,
        balType: "CB",
        subBal: signedBal,
        drcr: b.drcr,
        tbNet,
        glNet: glNetMov,
        diff,
        excCount: "",
        status,
      });
      row.getCell("status").fill = statusFill(status);
      for (const colKey of ["subBal", "tbNet", "glNet", "diff"]) {
        row.getCell(colKey).numFmt = NUMBER_FMT;
      }
    }
  }

  addConditionalFormatting(ws, "L", ws.rowCount);
  applyAutoFilter(ws);
}

function buildExceptionsReport(
  wb: ExcelJS.Workbook,
  tbRows: TBRow[],
  glAgg: Map<string, GLAggRow>,
  partyRows: PartyRow[],
  bankRows: BankRow[],
  meta: EngagementMeta,
  duplicateTbCodes: string[],
  duplicateGlTransactions: Array<{ journalId: string; voucherNo: string; accountCode: string; count: number }>,
  invalidDateEntries: Array<{ accountCode: string; voucherNo: string; date: string }>
) {
  const ws = wb.addWorksheet("Exceptions_Report");

  ws.columns = [
    { header: "Exception ID", key: "excId", width: 14 },
    { header: "Source Area", key: "source", width: 18 },
    { header: "Category", key: "category", width: 24 },
    { header: "Severity", key: "severity", width: 12 },
    { header: "GL Code", key: "code", width: 16 },
    { header: "Account Name", key: "accName", width: 28 },
    { header: "Description", key: "desc", width: 50 },
    { header: "Expected", key: "expected", width: 22 },
    { header: "Actual", key: "actual", width: 22 },
    { header: "Difference", key: "diff", width: 16 },
    { header: "Status", key: "status", width: 14 },
    { header: "Reviewer Comments", key: "reviewer", width: 30 },
    { header: "Management Response", key: "mgmt", width: 30 },
    { header: "Resolution", key: "resolution", width: 30 },
  ];
  styleHeaderRow(ws);

  let seq = 0;
  const tbMap = new Map(tbRows.map(r => [r.accountCode, r]));

  const addException = (source: string, category: string, severity: string, code: string, accName: string, desc: string, expected: string, actual: string, diff: string) => {
    seq++;
    const excId = `EXC-${String(seq).padStart(4, "0")}`;
    const row = ws.addRow({
      excId,
      source,
      category,
      severity,
      code,
      accName,
      desc,
      expected,
      actual,
      diff,
      status: "OPEN",
      reviewer: "",
      mgmt: "",
      resolution: "",
    });
    row.getCell("severity").fill = statusFill(severity);
    row.getCell("status").fill = WARN_FILL;
    if (diff && parseFloat(diff) !== 0) row.getCell("diff").numFmt = NUMBER_FMT;
    return row;
  };

  const tbTotalOBDr = tbRows.reduce((s, r) => s + r.openingDebit, 0);
  const tbTotalOBCr = tbRows.reduce((s, r) => s + r.openingCredit, 0);
  const tbTotalCBDr = tbRows.reduce((s, r) => s + r.closingDebit, 0);
  const tbTotalCBCr = tbRows.reduce((s, r) => s + r.closingCredit, 0);
  if (Math.abs(tbTotalOBDr - tbTotalOBCr) >= 1) {
    addException("TB", "TB Balance", "High", "", "", `TB Opening Balance doesn't balance: DR ${tbTotalOBDr.toFixed(2)} vs CR ${tbTotalOBCr.toFixed(2)}`, "DR = CR", `Diff: ${(tbTotalOBDr - tbTotalOBCr).toFixed(2)}`, Math.abs(tbTotalOBDr - tbTotalOBCr).toFixed(2));
  }
  if (Math.abs(tbTotalCBDr - tbTotalCBCr) >= 1) {
    addException("TB", "TB Balance", "High", "", "", `TB Closing Balance doesn't balance: DR ${tbTotalCBDr.toFixed(2)} vs CR ${tbTotalCBCr.toFixed(2)}`, "DR = CR", `Diff: ${(tbTotalCBDr - tbTotalCBCr).toFixed(2)}`, Math.abs(tbTotalCBDr - tbTotalCBCr).toFixed(2));
  }

  for (const [code, gl] of glAgg) {
    if (!tbMap.has(code)) {
      addException("GL", "GL Code Mismatch", "Medium", code, gl.accountName ?? "", `GL code exists in GL (${gl.entryCount} entries) but not in TB`, "Present in TB", "Missing", "");
    }
  }

  for (const tb of tbRows) {
    if (!glAgg.has(tb.accountCode) && Math.abs(tb.tbNetMovement) > 0) {
      addException("TB", "GL Code Mismatch", "Medium", tb.accountCode, tb.accountName ?? "", `TB code has net movement (${tb.tbNetMovement.toFixed(2)}) but no GL entries`, "GL entries present", "No GL entries", "");
    }
  }

  for (const [code] of glAgg) {
    const tb = tbMap.get(code);
    if (tb) {
      const gl = glAgg.get(code)!;
      const netDiff = tb.tbNetMovement - gl.glNetMovement;
      if (Math.abs(netDiff) >= 1) {
        addException("RECON", "TB-GL Net Movement Mismatch", "High", code, tb.accountName ?? "", `TB net movement doesn't match GL net movement`, `TB Net: ${tb.tbNetMovement.toFixed(2)}`, `GL Net: ${gl.glNetMovement.toFixed(2)}`, netDiff.toFixed(2));
      }
    }
  }

  for (const [code] of glAgg) {
    const tb = tbMap.get(code);
    if (tb) {
      const gl = glAgg.get(code)!;
      const tbName = (tb.accountName ?? "").toLowerCase().trim();
      const glName = (gl.accountName ?? "").toLowerCase().trim();
      if (glName && tbName && glName !== tbName) {
        addException("RECON", "Account Name Mismatch", "Low", code, "", `TB name "${tb.accountName}" differs from GL name "${gl.accountName}"`, tb.accountName ?? "", gl.accountName ?? "", "");
      }
    }
  }

  for (const tb of tbRows) {
    if (tb.closingDebit > 0 && tb.closingCredit > 0) {
      addException("TB", "Dual Balance", "Low", tb.accountCode, tb.accountName ?? "", `Account has both DR (${tb.closingDebit.toFixed(2)}) and CR (${tb.closingCredit.toFixed(2)}) closing balances`, "Single-sided", `DR: ${tb.closingDebit.toFixed(2)}, CR: ${tb.closingCredit.toFixed(2)}`, "");
    }
  }

  for (const tb of tbRows) {
    if (!tb.accountName || tb.accountName.trim() === "") {
      addException("TB", "Data Quality", "Medium", tb.accountCode, "", `Account has a blank name`, "Account name present", "Blank", "");
    }
  }

  for (const tb of tbRows) {
    if (!tb.fsHeadKey) {
      addException("TB", "FS Mapping", "Low", tb.accountCode, tb.accountName ?? "", `Account is not mapped to an FS head/line item`, "FS head mapped", "Unmapped", "");
    }
  }

  for (const tb of tbRows) {
    if (tb.accountClass) {
      const assetLike = ["ASSET", "EXPENSE"].includes(tb.accountClass.toUpperCase());
      if (assetLike && tb.cbNet < -1) {
        addException("TB", "Unusual Sign", "Medium", tb.accountCode, tb.accountName ?? "", `${tb.accountClass} account has negative net closing balance (${tb.cbNet.toFixed(2)})`, "Positive (DR) balance", `Net: ${tb.cbNet.toFixed(2)}`, "");
      }
      const liabLike = ["LIABILITY", "EQUITY", "INCOME", "REVENUE"].includes(tb.accountClass.toUpperCase());
      if (liabLike && tb.cbNet > 1) {
        addException("TB", "Unusual Sign", "Medium", tb.accountCode, tb.accountName ?? "", `${tb.accountClass} account has positive net closing balance (${tb.cbNet.toFixed(2)})`, "Negative (CR) balance", `Net: ${tb.cbNet.toFixed(2)}`, "");
      }
    }
  }

  for (const gl of glAgg.values()) {
    if (gl.hasBlankNarration) {
      addException("GL", "Data Quality", "Medium", gl.accountCode, gl.accountName ?? "", `GL entries found with blank narration/description`, "Narration present", "Blank narration(s)", "");
    }
  }

  const cbPartySumByCtrl = new Map<string, number>();
  for (const p of partyRows.filter(pp => pp.balanceType === "CB")) {
    const signed = p.drcr === "DR" ? p.balance : -p.balance;
    cbPartySumByCtrl.set(p.controlAccountCode, (cbPartySumByCtrl.get(p.controlAccountCode) || 0) + signed);
  }
  for (const [ctrl, subTotal] of cbPartySumByCtrl) {
    const tb = tbMap.get(ctrl);
    const tbNet = tb ? tb.cbNet : 0;
    const diff = subTotal - tbNet;
    if (Math.abs(diff) >= 1) {
      addException("SUBLEDGER", "Subledger Recon", "High", ctrl, tb?.accountName ?? "", `Subledger total (${subTotal.toFixed(2)}) doesn't match TB net (${tbNet.toFixed(2)})`, `TB Net: ${tbNet.toFixed(2)}`, `Sub Total: ${subTotal.toFixed(2)}`, diff.toFixed(2));
    }
  }

  for (const b of bankRows) {
    const tb = tbMap.get(b.glCode);
    const tbNet = tb ? tb.cbNet : 0;
    const signedBal = b.drcr === "DR" ? b.closingBalance : -b.closingBalance;
    const diff = signedBal - tbNet;
    if (Math.abs(diff) >= 1) {
      addException("BANK", "Bank Recon", "High", b.glCode, `${b.bankName} - ${b.accountTitle}`, `Bank balance (${signedBal.toFixed(2)}) doesn't match TB net (${tbNet.toFixed(2)})`, `TB Net: ${tbNet.toFixed(2)}`, `Bank: ${signedBal.toFixed(2)}`, diff.toFixed(2));
    }
  }

  for (const dupCode of duplicateTbCodes) {
    addException("TB", "Duplicate GL Code", "High", dupCode, "", `Duplicate GL code detected in TB data after trimming: ${dupCode}`, "Unique codes", "Duplicate", "");
  }

  for (const dup of duplicateGlTransactions) {
    addException("GL", "Duplicate Transaction", "Medium", dup.accountCode, "", `Potential duplicate GL transaction: voucher ${dup.voucherNo || "N/A"}, account ${dup.accountCode} appears ${dup.count} times with same amounts`, "Unique entries", `${dup.count} duplicates`, "");
  }

  const invDateGrouped = new Map<string, string[]>();
  for (const e of invalidDateEntries) {
    const existing = invDateGrouped.get(e.accountCode) || [];
    if (existing.length < 3) existing.push(e.date);
    invDateGrouped.set(e.accountCode, existing);
  }
  for (const [code, dates] of invDateGrouped) {
    const tb = tbMap.get(code);
    addException("GL", "Invalid Date", "Medium", code, tb?.accountName ?? "", `GL entries with dates outside engagement period: ${dates.join(", ")}${invDateGrouped.get(code)!.length >= 3 ? " ..." : ""}`, `Within ${meta.periodEnd || "period"}`, "Outside period", "");
  }

  if (seq === 0) {
    ws.addRow({
      excId: "",
      source: "",
      category: "",
      severity: "",
      code: "",
      accName: "",
      desc: "No exceptions found - all validations passed",
      expected: "",
      actual: "",
      diff: "",
      status: "",
      reviewer: "",
      mgmt: "",
      resolution: "",
    });
  }

  if (seq > 0) {
    ws.getColumn("status").eachCell((cell, rowNum) => {
      if (rowNum > 1) {
        cell.dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: ['"OPEN,IN PROGRESS,RESOLVED,CLOSED,N/A"'],
        };
      }
    });
    ws.getColumn("severity").eachCell((cell, rowNum) => {
      if (rowNum > 1) {
        cell.dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: ['"High,Medium,Low"'],
        };
      }
    });
  }

  addConditionalFormatting(ws, "D", ws.rowCount);
  addConditionalFormatting(ws, "K", ws.rowCount);
  applyAutoFilter(ws);
}
