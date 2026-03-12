import ExcelJS from "exceljs";
import { withTenantContext } from "../middleware/tenantDbContext";

interface TBRow {
  accountCode: string;
  accountName: string | null;
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
  totalDebit: number;
  totalCredit: number;
  glNetMovement: number;
  entryCount: number;
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

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } };
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
const PASS_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC6EFCE" } };
const FAIL_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFC7CE" } };
const WARN_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFEB9C" } };
const NUMBER_FMT = '#,##0.00';

function styleHeaderRow(ws: ExcelJS.Worksheet) {
  const row = ws.getRow(1);
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF000000" } },
    };
  });
  row.height = 28;
  ws.views = [{ state: "frozen", ySplit: 1, xSplit: 0 }];
}

function applyAutoFilter(ws: ExcelJS.Worksheet) {
  if (ws.rowCount > 1) {
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: ws.rowCount, column: ws.columnCount } };
  }
}

export async function generateValidationWorkbook(
  engagementId: string,
  firmId: string
): Promise<Buffer> {

  const tbRows: TBRow[] = [];
  const glAgg: Map<string, GLAggRow> = new Map();
  const partyRows: PartyRow[] = [];
  const bankRows: BankRow[] = [];

  await withTenantContext(firmId, async (tx) => {
    const obRows = await tx.importAccountBalance.findMany({
      where: { engagementId, balanceType: "OB" },
      select: { accountCode: true, accountName: true, debitAmount: true, creditAmount: true },
    });
    const cbRows = await tx.importAccountBalance.findMany({
      where: { engagementId, balanceType: "CB" },
      select: { accountCode: true, accountName: true, debitAmount: true, creditAmount: true },
    });

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

    const glLines = await tx.importJournalLine.findMany({
      where: { journalHeader: { engagementId } },
      select: { accountCode: true, debit: true, credit: true },
    });
    for (const line of glLines) {
      const code = line.accountCode.trim();
      const dr = Number(line.debit);
      const cr = Number(line.credit);
      const existing = glAgg.get(code);
      if (existing) {
        existing.totalDebit += dr;
        existing.totalCredit += cr;
        existing.glNetMovement += (dr - cr);
        existing.entryCount++;
      } else {
        glAgg.set(code, {
          accountCode: code,
          totalDebit: dr,
          totalCredit: cr,
          glNetMovement: dr - cr,
          entryCount: 1,
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
        controlAccountCode: p.controlAccountCode,
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
        glCode: bal?.glBankAccountCode ?? "",
        closingBalance: Number(bal?.closingBalance ?? 0),
        drcr: bal?.drcr ?? "DR",
      });
    }
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "AuditWise";
  workbook.created = new Date();

  buildControlSummary(workbook, tbRows, glAgg, partyRows, bankRows);
  buildTBValidation(workbook, tbRows);
  buildGLvsTBValidation(workbook, tbRows, glAgg);
  buildSubledgerValidation(workbook, tbRows, partyRows, bankRows);
  buildExceptionsReport(workbook, tbRows, glAgg, partyRows, bankRows);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function buildControlSummary(
  wb: ExcelJS.Workbook,
  tbRows: TBRow[],
  glAgg: Map<string, GLAggRow>,
  partyRows: PartyRow[],
  bankRows: BankRow[]
) {
  const ws = wb.addWorksheet("Control_Summary");

  ws.columns = [
    { header: "Control Check", key: "check", width: 40 },
    { header: "Value / Count", key: "value", width: 22 },
    { header: "Status", key: "status", width: 14 },
    { header: "Notes", key: "notes", width: 45 },
  ];
  styleHeaderRow(ws);

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

  const tbCodeSet = new Set(tbRows.map(r => r.accountCode));
  const glCodeSet = new Set(glAgg.keys());
  const codesOnlyInGL = [...glCodeSet].filter(c => !tbCodeSet.has(c));
  const codesOnlyInTB = [...tbCodeSet].filter(c => !glCodeSet.has(c));

  const tolerance = 1;

  const checks = [
    { check: "TB Account Count", value: tbRows.length, status: tbRows.length > 0 ? "PASS" : "FAIL", notes: "" },
    { check: "GL Entry Count", value: glEntryCount, status: glEntryCount > 0 ? "PASS" : "FAIL", notes: "" },
    { check: "GL Unique Account Count", value: glAgg.size, status: "", notes: "" },
    { check: "Party Balance Count (AR+AP)", value: partyRows.length, status: "", notes: "" },
    { check: "Bank Account Count", value: bankRows.length, status: "", notes: "" },
    { check: "", value: "", status: "", notes: "" },
    { check: "TB Opening Balance (DR - CR)", value: (tbTotalOBDr - tbTotalOBCr).toFixed(2), status: obBalance <= tolerance ? "PASS" : "FAIL", notes: obBalance <= tolerance ? "Balanced" : `Difference: ${obBalance.toFixed(2)}` },
    { check: "TB Closing Balance (DR - CR)", value: (tbTotalCBDr - tbTotalCBCr).toFixed(2), status: cbBalance <= tolerance ? "PASS" : "FAIL", notes: cbBalance <= tolerance ? "Balanced" : `Difference: ${cbBalance.toFixed(2)}` },
    { check: "GL Total DR - CR", value: (glTotalDr - glTotalCr).toFixed(2), status: glBalance <= tolerance ? "PASS" : "WARN", notes: glBalance <= tolerance ? "Balanced" : `Difference: ${glBalance.toFixed(2)}` },
    { check: "", value: "", status: "", notes: "" },
    { check: "TB Net Movement vs GL Net Movement", value: netMovDiff.toFixed(2), status: netMovDiff <= tolerance ? "PASS" : "FAIL", notes: `TB Net Mov: ${tbNetMovTotal.toFixed(2)} | GL Net Mov: ${glNetMovTotal.toFixed(2)}` },
    { check: "GL Codes in GL but not TB", value: codesOnlyInGL.length, status: codesOnlyInGL.length === 0 ? "PASS" : "WARN", notes: codesOnlyInGL.length > 0 ? codesOnlyInGL.slice(0, 10).join(", ") + (codesOnlyInGL.length > 10 ? "..." : "") : "" },
    { check: "GL Codes in TB but not GL (with movement)", value: codesOnlyInTB.filter(c => { const r = tbRows.find(t => t.accountCode === c); return r && Math.abs(r.tbNetMovement) > 0; }).length, status: codesOnlyInTB.filter(c => { const r = tbRows.find(t => t.accountCode === c); return r && Math.abs(r.tbNetMovement) > 0; }).length === 0 ? "PASS" : "WARN", notes: "" },
    { check: "", value: "", status: "", notes: "" },
    { check: "TB Opening Debit Total", value: tbTotalOBDr.toFixed(2), status: "", notes: "" },
    { check: "TB Opening Credit Total", value: tbTotalOBCr.toFixed(2), status: "", notes: "" },
    { check: "TB Closing Debit Total", value: tbTotalCBDr.toFixed(2), status: "", notes: "" },
    { check: "TB Closing Credit Total", value: tbTotalCBCr.toFixed(2), status: "", notes: "" },
    { check: "TB Net Movement Total", value: tbNetMovTotal.toFixed(2), status: "", notes: "(CB_Net - OB_Net)" },
    { check: "GL Debit Total", value: glTotalDr.toFixed(2), status: "", notes: "" },
    { check: "GL Credit Total", value: glTotalCr.toFixed(2), status: "", notes: "" },
    { check: "GL Net Movement Total", value: glNetMovTotal.toFixed(2), status: "", notes: "(GL_DR - GL_CR)" },
  ];

  for (const c of checks) {
    const row = ws.addRow(c);
    if (c.status === "PASS") row.getCell("status").fill = PASS_FILL;
    else if (c.status === "FAIL") row.getCell("status").fill = FAIL_FILL;
    else if (c.status === "WARN") row.getCell("status").fill = WARN_FILL;
  }
}

function buildTBValidation(wb: ExcelJS.Workbook, tbRows: TBRow[]) {
  const ws = wb.addWorksheet("TB_Validation");

  ws.columns = [
    { header: "GL Code", key: "code", width: 16 },
    { header: "Account Name", key: "name", width: 32 },
    { header: "OB Debit", key: "obDr", width: 16 },
    { header: "OB Credit", key: "obCr", width: 16 },
    { header: "OB Net (DR-CR)", key: "obNet", width: 16 },
    { header: "CB Debit", key: "cbDr", width: 16 },
    { header: "CB Credit", key: "cbCr", width: 16 },
    { header: "CB Net (DR-CR)", key: "cbNet", width: 16 },
    { header: "Net Movement", key: "netMov", width: 16 },
    { header: "Has OB?", key: "hasOb", width: 10 },
    { header: "Has CB?", key: "hasCb", width: 10 },
    { header: "Balance Check", key: "balCheck", width: 14 },
  ];
  styleHeaderRow(ws);

  for (const tb of tbRows) {
    const hasOb = tb.openingDebit !== 0 || tb.openingCredit !== 0;
    const hasCb = tb.closingDebit !== 0 || tb.closingCredit !== 0;
    const hasBothDrCr = (tb.closingDebit > 0 && tb.closingCredit > 0) || (tb.openingDebit > 0 && tb.openingCredit > 0);
    const balCheck = hasBothDrCr ? "WARN" : "OK";

    const row = ws.addRow({
      code: tb.accountCode,
      name: tb.accountName ?? "",
      obDr: tb.openingDebit,
      obCr: tb.openingCredit,
      obNet: tb.obNet,
      cbDr: tb.closingDebit,
      cbCr: tb.closingCredit,
      cbNet: tb.cbNet,
      netMov: tb.tbNetMovement,
      hasOb: hasOb ? "YES" : "NO",
      hasCb: hasCb ? "YES" : "NO",
      balCheck,
    });

    for (let c = 3; c <= 9; c++) {
      row.getCell(c).numFmt = NUMBER_FMT;
    }
    if (balCheck === "WARN") {
      row.getCell("balCheck").fill = WARN_FILL;
    }
  }

  const totRow = ws.addRow({
    code: "TOTAL",
    name: "",
    obDr: tbRows.reduce((s, r) => s + r.openingDebit, 0),
    obCr: tbRows.reduce((s, r) => s + r.openingCredit, 0),
    obNet: tbRows.reduce((s, r) => s + r.obNet, 0),
    cbDr: tbRows.reduce((s, r) => s + r.closingDebit, 0),
    cbCr: tbRows.reduce((s, r) => s + r.closingCredit, 0),
    cbNet: tbRows.reduce((s, r) => s + r.cbNet, 0),
    netMov: tbRows.reduce((s, r) => s + r.tbNetMovement, 0),
    hasOb: "",
    hasCb: "",
    balCheck: "",
  });
  totRow.font = { bold: true };
  for (let c = 3; c <= 9; c++) {
    totRow.getCell(c).numFmt = NUMBER_FMT;
  }

  const obDiff = Math.abs(tbRows.reduce((s, r) => s + r.openingDebit, 0) - tbRows.reduce((s, r) => s + r.openingCredit, 0));
  const cbDiff = Math.abs(tbRows.reduce((s, r) => s + r.closingDebit, 0) - tbRows.reduce((s, r) => s + r.closingCredit, 0));
  if (obDiff >= 1) {
    totRow.getCell("obNet").fill = FAIL_FILL;
  }
  if (cbDiff >= 1) {
    totRow.getCell("cbNet").fill = FAIL_FILL;
  }

  applyAutoFilter(ws);
}

function buildGLvsTBValidation(wb: ExcelJS.Workbook, tbRows: TBRow[], glAgg: Map<string, GLAggRow>) {
  const ws = wb.addWorksheet("GL_vs_TB_Validation");

  ws.columns = [
    { header: "GL Code", key: "code", width: 16 },
    { header: "Account Name", key: "name", width: 32 },
    { header: "TB Net Movement", key: "tbNetMov", width: 18 },
    { header: "GL Net Movement", key: "glNetMov", width: 18 },
    { header: "Net Difference", key: "netDiff", width: 18 },
    { header: "GL Total DR", key: "glDr", width: 16 },
    { header: "GL Total CR", key: "glCr", width: 16 },
    { header: "GL Entries", key: "entries", width: 12 },
    { header: "In TB?", key: "inTb", width: 10 },
    { header: "In GL?", key: "inGl", width: 10 },
    { header: "Match Status", key: "match", width: 14 },
  ];
  styleHeaderRow(ws);

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

    let matchStatus = "MATCH";
    if (!inTb) matchStatus = "GL_ONLY";
    else if (!inGl) matchStatus = "TB_ONLY";
    else if (Math.abs(netDiff) >= 1) matchStatus = "MISMATCH";

    const row = ws.addRow({
      code,
      name: tb?.accountName ?? "",
      tbNetMov,
      glNetMov,
      netDiff,
      glDr: gl?.totalDebit ?? 0,
      glCr: gl?.totalCredit ?? 0,
      entries: gl?.entryCount ?? 0,
      inTb: inTb ? "YES" : "NO",
      inGl: inGl ? "YES" : "NO",
      match: matchStatus,
    });

    for (let c = 3; c <= 7; c++) {
      row.getCell(c).numFmt = NUMBER_FMT;
    }

    if (matchStatus === "MATCH") {
      row.getCell("match").fill = PASS_FILL;
    } else {
      row.getCell("match").fill = FAIL_FILL;
      if (matchStatus === "MISMATCH") {
        row.getCell("netDiff").fill = FAIL_FILL;
      }
    }
  }

  applyAutoFilter(ws);
}

function buildSubledgerValidation(
  wb: ExcelJS.Workbook,
  tbRows: TBRow[],
  partyRows: PartyRow[],
  bankRows: BankRow[]
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
    { header: "Difference", key: "diff", width: 18 },
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

    for (const p of grp.items) {
      const signedBal = p.drcr === "DR" ? p.balance : -p.balance;

      ws.addRow({
        type: p.partyType,
        glCode: p.controlAccountCode,
        subCode: p.partyCode,
        subName: p.partyName ?? "",
        balType: p.balanceType,
        subBal: signedBal,
        drcr: p.drcr,
        tbNet: "",
        diff: "",
        status: "",
      });
    }

    const tb = tbMap.get(ctrlCode);
    const tbNet = tb ? (balType === "CB" ? tb.cbNet : tb.obNet) : 0;
    const diff = Math.abs(grp.totalSub - tbNet);
    const status = diff < 1 ? "PASS" : "FAIL";

    const sumRow = ws.addRow({
      type: `${grp.type} TOTAL`,
      glCode: ctrlCode,
      subCode: "",
      subName: "",
      balType: balType,
      subBal: grp.totalSub,
      drcr: "",
      tbNet,
      diff: grp.totalSub - tbNet,
      status,
    });
    sumRow.font = { bold: true };
    sumRow.getCell("status").fill = status === "PASS" ? PASS_FILL : FAIL_FILL;
    for (const colKey of ["subBal", "tbNet", "diff"]) {
      sumRow.getCell(colKey).numFmt = NUMBER_FMT;
    }

    ws.addRow({});
  }

  if (bankRows.length > 0) {
    ws.addRow({ type: "--- BANK ACCOUNTS ---" });
    for (const b of bankRows) {
      const tb = tbMap.get(b.glCode);
      const tbNet = tb ? tb.cbNet : 0;
      const signedBal = b.drcr === "DR" ? b.closingBalance : -b.closingBalance;
      const diff = signedBal - tbNet;
      const status = Math.abs(diff) < 1 ? "PASS" : "FAIL";

      const row = ws.addRow({
        type: "BANK",
        glCode: b.glCode,
        subCode: b.bankAccountCode,
        subName: `${b.bankName} - ${b.accountTitle}`,
        balType: "CB",
        subBal: signedBal,
        drcr: b.drcr,
        tbNet,
        diff,
        status,
      });
      row.getCell("status").fill = status === "PASS" ? PASS_FILL : FAIL_FILL;
      for (const colKey of ["subBal", "tbNet", "diff"]) {
        row.getCell(colKey).numFmt = NUMBER_FMT;
      }
    }
  }

  applyAutoFilter(ws);
}

function buildExceptionsReport(
  wb: ExcelJS.Workbook,
  tbRows: TBRow[],
  glAgg: Map<string, GLAggRow>,
  partyRows: PartyRow[],
  bankRows: BankRow[]
) {
  const ws = wb.addWorksheet("Exceptions_Report");

  ws.columns = [
    { header: "#", key: "seq", width: 6 },
    { header: "Category", key: "category", width: 22 },
    { header: "Severity", key: "severity", width: 12 },
    { header: "GL Code", key: "code", width: 16 },
    { header: "Description", key: "desc", width: 55 },
    { header: "Expected", key: "expected", width: 20 },
    { header: "Actual", key: "actual", width: 20 },
    { header: "Difference", key: "diff", width: 16 },
  ];
  styleHeaderRow(ws);

  let seq = 0;
  const tbMap = new Map(tbRows.map(r => [r.accountCode, r]));

  for (const [code, gl] of glAgg) {
    if (!tbMap.has(code)) {
      seq++;
      const row = ws.addRow({
        seq,
        category: "GL Code Mismatch",
        severity: "WARNING",
        code,
        desc: `GL code "${code}" exists in GL but not in TB`,
        expected: "Present in TB",
        actual: "Missing",
        diff: "",
      });
      row.getCell("severity").fill = WARN_FILL;
    }
  }

  for (const tb of tbRows) {
    if (!glAgg.has(tb.accountCode) && Math.abs(tb.tbNetMovement) > 0) {
      seq++;
      const row = ws.addRow({
        seq,
        category: "GL Code Mismatch",
        severity: "WARNING",
        code: tb.accountCode,
        desc: `TB code "${tb.accountCode}" has net movement (${tb.tbNetMovement.toFixed(2)}) but no GL entries`,
        expected: "GL entries present",
        actual: "No GL entries",
        diff: "",
      });
      row.getCell("severity").fill = WARN_FILL;
    }
  }

  for (const [code] of glAgg) {
    const tb = tbMap.get(code);
    if (tb) {
      const gl = glAgg.get(code)!;
      const netDiff = tb.tbNetMovement - gl.glNetMovement;
      if (Math.abs(netDiff) >= 1) {
        seq++;
        const row = ws.addRow({
          seq,
          category: "TB-GL Net Movement Mismatch",
          severity: "ERROR",
          code,
          desc: `TB net movement doesn't match GL net movement`,
          expected: `TB Net: ${tb.tbNetMovement.toFixed(2)}`,
          actual: `GL Net: ${gl.glNetMovement.toFixed(2)}`,
          diff: netDiff.toFixed(2),
        });
        row.getCell("severity").fill = FAIL_FILL;
      }
    }
  }

  const tbTotalOBDr = tbRows.reduce((s, r) => s + r.openingDebit, 0);
  const tbTotalOBCr = tbRows.reduce((s, r) => s + r.openingCredit, 0);
  const tbTotalCBDr = tbRows.reduce((s, r) => s + r.closingDebit, 0);
  const tbTotalCBCr = tbRows.reduce((s, r) => s + r.closingCredit, 0);
  if (Math.abs(tbTotalOBDr - tbTotalOBCr) >= 1) {
    seq++;
    ws.addRow({
      seq,
      category: "TB Balance",
      severity: "CRITICAL",
      code: "",
      desc: `TB Opening Balance doesn't balance: DR ${tbTotalOBDr.toFixed(2)} vs CR ${tbTotalOBCr.toFixed(2)}`,
      expected: "DR = CR",
      actual: `Diff: ${(tbTotalOBDr - tbTotalOBCr).toFixed(2)}`,
      diff: Math.abs(tbTotalOBDr - tbTotalOBCr).toFixed(2),
    }).getCell("severity").fill = FAIL_FILL;
  }
  if (Math.abs(tbTotalCBDr - tbTotalCBCr) >= 1) {
    seq++;
    ws.addRow({
      seq,
      category: "TB Balance",
      severity: "CRITICAL",
      code: "",
      desc: `TB Closing Balance doesn't balance: DR ${tbTotalCBDr.toFixed(2)} vs CR ${tbTotalCBCr.toFixed(2)}`,
      expected: "DR = CR",
      actual: `Diff: ${(tbTotalCBDr - tbTotalCBCr).toFixed(2)}`,
      diff: Math.abs(tbTotalCBDr - tbTotalCBCr).toFixed(2),
    }).getCell("severity").fill = FAIL_FILL;
  }

  for (const tb of tbRows) {
    const hasBothDrCr = (tb.closingDebit > 0 && tb.closingCredit > 0);
    if (hasBothDrCr) {
      seq++;
      const row = ws.addRow({
        seq,
        category: "Dual Balance",
        severity: "INFO",
        code: tb.accountCode,
        desc: `Account has both debit (${tb.closingDebit.toFixed(2)}) and credit (${tb.closingCredit.toFixed(2)}) closing balances`,
        expected: "Single-sided balance",
        actual: `DR: ${tb.closingDebit.toFixed(2)}, CR: ${tb.closingCredit.toFixed(2)}`,
        diff: "",
      });
      row.getCell("severity").fill = WARN_FILL;
    }
  }

  if (seq === 0) {
    ws.addRow({
      seq: "",
      category: "",
      severity: "",
      code: "",
      desc: "No exceptions found - all validations passed",
      expected: "",
      actual: "",
      diff: "",
    });
  }

  applyAutoFilter(ws);
}
