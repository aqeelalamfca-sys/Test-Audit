interface COAEntry {
  code: string;
  accountName: string;
  nature: 'DR' | 'CR';
}

interface OpeningBalance {
  code: string;
  accountName: string;
  openingDebit: number;
  openingCredit: number;
}

interface GLEntry {
  glCode: string;
  glName: string;
  voucherNo: string;
  postingDate: string;
  debit: number;
  credit: number;
  currency: string;
  voucherType: string;
  documentNo: string;
  narration: string;
}

interface TBRow {
  glCode: string;
  glName: string;
  openingBalance: number;
  debit: number;
  credit: number;
  closingDebit: number;
  closingCredit: number;
}

interface ARParty {
  customerId: string;
  customerName: string;
  openingDebit: number;
  openingCredit: number;
  closingDebit: number;
  closingCredit: number;
  glCode: string;
  email: string;
  phone: string;
}

interface APParty {
  vendorId: string;
  vendorName: string;
  openingDebit: number;
  openingCredit: number;
  closingDebit: number;
  closingCredit: number;
  glCode: string;
  email: string;
  phone: string;
}

interface BankMaster {
  bankAccountId: string;
  bankName: string;
  branch: string;
  accountNumber: string;
  accountType: string;
  currency: string;
  glCode: string;
}

interface BankBalance {
  bankAccountId: string;
  statementDate: string;
  bookBalance: number;
  statementBalance: number;
  reconciled: boolean;
}

export const DEMO_COA: COAEntry[] = [
  { code: '10001', accountName: 'Cash in Hand', nature: 'DR' },
  { code: '10002', accountName: 'Petty Cash', nature: 'DR' },
  { code: '10003', accountName: 'HBL Current Account', nature: 'DR' },
  { code: '10004', accountName: 'MCB Savings Account', nature: 'DR' },
  { code: '10005', accountName: 'Allied Bank Current Account', nature: 'DR' },
  { code: '10006', accountName: 'Fixed Deposit - HBL', nature: 'DR' },

  { code: '11001', accountName: 'Trade Receivables - Control', nature: 'DR' },
  { code: '11002', accountName: 'Customer - TechVision Systems', nature: 'DR' },
  { code: '11003', accountName: 'Customer - National Bank of Pakistan', nature: 'DR' },
  { code: '11004', accountName: 'Customer - Engro Digital', nature: 'DR' },
  { code: '11005', accountName: 'Staff Advances', nature: 'DR' },
  { code: '11006', accountName: 'Other Receivables', nature: 'DR' },
  { code: '11007', accountName: 'Prepayments', nature: 'DR' },
  { code: '11008', accountName: 'Advance Tax (WHT)', nature: 'DR' },

  { code: '12001', accountName: 'Raw Materials', nature: 'DR' },
  { code: '12002', accountName: 'Work in Progress', nature: 'DR' },
  { code: '12003', accountName: 'Finished Goods', nature: 'DR' },
  { code: '12004', accountName: 'Stores & Spares', nature: 'DR' },
  { code: '12005', accountName: 'Goods in Transit', nature: 'DR' },

  { code: '13001', accountName: 'Land', nature: 'DR' },
  { code: '13002', accountName: 'Building', nature: 'DR' },
  { code: '13003', accountName: 'Plant & Machinery', nature: 'DR' },
  { code: '13004', accountName: 'Furniture & Fixtures', nature: 'DR' },
  { code: '13005', accountName: 'Motor Vehicles', nature: 'DR' },
  { code: '13006', accountName: 'IT Equipment', nature: 'DR' },
  { code: '13007', accountName: 'Computer Software', nature: 'DR' },
  { code: '13008', accountName: 'Leasehold Improvements', nature: 'DR' },

  { code: '14001', accountName: 'Accumulated Depreciation - Building', nature: 'CR' },
  { code: '14002', accountName: 'Accumulated Depreciation - Plant & Machinery', nature: 'CR' },
  { code: '14003', accountName: 'Accumulated Depreciation - Furniture', nature: 'CR' },
  { code: '14004', accountName: 'Accumulated Depreciation - Vehicles', nature: 'CR' },
  { code: '14005', accountName: 'Accumulated Depreciation - IT Equipment', nature: 'CR' },
  { code: '14006', accountName: 'Accumulated Depreciation - Software', nature: 'CR' },
  { code: '14007', accountName: 'Accumulated Depreciation - Leasehold', nature: 'CR' },

  { code: '15001', accountName: 'Long-term Deposits', nature: 'DR' },
  { code: '15002', accountName: 'Deferred Tax Asset', nature: 'DR' },
  { code: '15003', accountName: 'Long-term Investments', nature: 'DR' },

  { code: '20001', accountName: 'Trade Payables - Control', nature: 'CR' },
  { code: '20002', accountName: 'Supplier - Dell Technologies', nature: 'CR' },
  { code: '20003', accountName: 'Supplier - Microsoft Pakistan', nature: 'CR' },
  { code: '20004', accountName: 'Accrued Expenses', nature: 'CR' },
  { code: '20005', accountName: 'WHT Payable', nature: 'CR' },
  { code: '20006', accountName: 'Sales Tax Payable', nature: 'CR' },
  { code: '20007', accountName: 'EOBI / Pension Payable', nature: 'CR' },
  { code: '20008', accountName: 'Advances from Customers', nature: 'CR' },

  { code: '21001', accountName: 'Running Finance - HBL', nature: 'CR' },
  { code: '21002', accountName: 'Short-term Loan - MCB', nature: 'CR' },
  { code: '21003', accountName: 'Current Portion of Long-term Loan', nature: 'CR' },

  { code: '22001', accountName: 'Long-term Loan - Allied Bank', nature: 'CR' },
  { code: '22002', accountName: 'Deferred Tax Liability', nature: 'CR' },
  { code: '22003', accountName: 'Gratuity Payable', nature: 'CR' },
  { code: '22004', accountName: 'Long-term Lease Liability', nature: 'CR' },

  { code: '30001', accountName: 'Share Capital', nature: 'CR' },
  { code: '30002', accountName: 'Share Premium', nature: 'CR' },
  { code: '30003', accountName: 'Retained Earnings', nature: 'CR' },
  { code: '30004', accountName: 'General Reserve', nature: 'CR' },
  { code: '30005', accountName: 'Revaluation Surplus', nature: 'CR' },

  { code: '40001', accountName: 'Software Development Revenue', nature: 'CR' },
  { code: '40002', accountName: 'Cloud Services Revenue', nature: 'CR' },
  { code: '40003', accountName: 'IT Consulting Revenue', nature: 'CR' },
  { code: '40004', accountName: 'Cybersecurity Revenue', nature: 'CR' },
  { code: '40005', accountName: 'Other Operating Income', nature: 'CR' },

  { code: '50001', accountName: 'Direct Labor Cost', nature: 'DR' },
  { code: '50002', accountName: 'Software Licenses Cost', nature: 'DR' },
  { code: '50003', accountName: 'Hardware Cost', nature: 'DR' },
  { code: '50004', accountName: 'Subcontractor Cost', nature: 'DR' },
  { code: '50005', accountName: 'Other Direct Costs', nature: 'DR' },

  { code: '51001', accountName: 'Salaries & Wages', nature: 'DR' },
  { code: '51002', accountName: 'Employee Benefits', nature: 'DR' },
  { code: '51003', accountName: 'Rent Expense', nature: 'DR' },
  { code: '51004', accountName: 'Utilities Expense', nature: 'DR' },
  { code: '51005', accountName: 'Insurance Expense', nature: 'DR' },
  { code: '51006', accountName: 'Repairs & Maintenance', nature: 'DR' },
  { code: '51007', accountName: 'Travel Expense', nature: 'DR' },
  { code: '51008', accountName: 'Communication Expense', nature: 'DR' },
  { code: '51009', accountName: 'Printing & Stationery', nature: 'DR' },
  { code: '51010', accountName: 'Miscellaneous Admin Expense', nature: 'DR' },

  { code: '52001', accountName: 'Marketing Expense', nature: 'DR' },
  { code: '52002', accountName: 'Sales Commission', nature: 'DR' },
  { code: '52003', accountName: 'Advertising Expense', nature: 'DR' },
  { code: '52004', accountName: 'Client Entertainment', nature: 'DR' },
  { code: '52005', accountName: 'Distribution Expense', nature: 'DR' },

  { code: '53001', accountName: 'Depreciation Expense', nature: 'DR' },
  { code: '53002', accountName: 'Amortization Expense', nature: 'DR' },

  { code: '54001', accountName: 'Legal Fees', nature: 'DR' },
  { code: '54002', accountName: 'Audit Fees', nature: 'DR' },
  { code: '54003', accountName: 'Consulting Fees', nature: 'DR' },
  { code: '54004', accountName: 'Tax Advisory Fees', nature: 'DR' },

  { code: '55001', accountName: 'Bank Charges', nature: 'DR' },
  { code: '55002', accountName: 'Interest on Loans', nature: 'DR' },
  { code: '55003', accountName: 'Lease Finance Cost', nature: 'DR' },

  { code: '56001', accountName: 'Interest Income', nature: 'CR' },
  { code: '56002', accountName: 'Gain on Disposal of Assets', nature: 'CR' },
  { code: '56003', accountName: 'Exchange Gain', nature: 'CR' },

  { code: '70001', accountName: 'Current Tax Expense', nature: 'DR' },
  { code: '70002', accountName: 'Deferred Tax Expense', nature: 'DR' },
];

const coaMap = new Map<string, string>();
DEMO_COA.forEach(a => coaMap.set(a.code, a.accountName));
function acctName(code: string): string {
  return coaMap.get(code) || code;
}

const openingBalancesRaw: Record<string, number> = {
  '10001': 2850000,
  '10002': 450000,
  '10003': 45200000,
  '10004': 18500000,
  '10005': 12800000,
  '10006': 25000000,

  '11001': 68500000,
  '11002': 0,
  '11003': 0,
  '11004': 0,
  '11005': 3200000,
  '11006': 1850000,
  '11007': 4500000,
  '11008': 8200000,

  '12001': 15600000,
  '12002': 22400000,
  '12003': 18500000,
  '12004': 3200000,
  '12005': 5800000,

  '13001': 85000000,
  '13002': 120000000,
  '13003': 45000000,
  '13004': 8500000,
  '13005': 18000000,
  '13006': 35000000,
  '13007': 22000000,
  '13008': 12000000,

  '14001': -24000000,
  '14002': -13500000,
  '14003': -3400000,
  '14004': -7200000,
  '14005': -14000000,
  '14006': -8800000,
  '14007': -4800000,

  '15001': 5500000,
  '15002': 4200000,
  '15003': 15000000,

  '20001': -52000000,
  '20002': 0,
  '20003': 0,
  '20004': -12500000,
  '20005': -4800000,
  '20006': -8200000,
  '20007': -2100000,
  '20008': -15000000,

  '21001': -18000000,
  '21002': -25000000,
  '21003': -12000000,

  '22001': -48000000,
  '22002': -6500000,
  '22003': -8500000,
  '22004': -15000000,

  '30001': -100000000,
  '30002': -25000000,
  '30003': -118750000,
  '30004': -20000000,
  '30005': -35000000,
};

const totalOpeningCheck = Object.values(openingBalancesRaw).reduce((s, v) => s + v, 0);
if (totalOpeningCheck !== 0) {
  openingBalancesRaw['30003'] -= totalOpeningCheck;
}

export const DEMO_OPENING_BALANCES: OpeningBalance[] = DEMO_COA.map(a => {
  const bal = openingBalancesRaw[a.code] || 0;
  return {
    code: a.code,
    accountName: a.accountName,
    openingDebit: bal > 0 ? bal : 0,
    openingCredit: bal < 0 ? Math.abs(bal) : 0,
  };
});

let voucherCounters: Record<string, number> = {
  JV: 0, BPV: 0, BRV: 0, PV: 0, RV: 0, INV: 0, CN: 0, DN: 0,
};
let refCounter = 0;

function nextVoucher(docType: string): string {
  voucherCounters[docType] = (voucherCounters[docType] || 0) + 1;
  return `${docType}-${String(voucherCounters[docType]).padStart(5, '0')}`;
}

function nextRef(): string {
  refCounter++;
  return `REF-${String(refCounter).padStart(6, '0')}`;
}

function fmtDate(month: number, day: number): string {
  return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/2024`;
}

function addJournal(
  entries: GLEntry[],
  docType: string,
  date: string,
  lines: Array<{ code: string; debit: number; credit: number; narrative: string }>
): void {
  const vn = nextVoucher(docType);
  for (const line of lines) {
    entries.push({
      glCode: line.code,
      glName: acctName(line.code),
      voucherNo: vn,
      postingDate: date,
      debit: line.debit,
      credit: line.credit,
      currency: 'PKR',
      voucherType: docType,
      documentNo: nextRef(),
      narration: line.narrative,
    });
  }
}

function generateGLEntries(): GLEntry[] {
  const entries: GLEntry[] = [];

  for (let m = 1; m <= 12; m++) {
    const dt = fmtDate(m, 25);

    addJournal(entries, 'JV', dt, [
      { code: '51001', debit: 12500000, credit: 0, narrative: `Salaries & wages - ${monthName(m)} 2024` },
      { code: '51002', debit: 2100000, credit: 0, narrative: `Employee benefits - ${monthName(m)} 2024` },
      { code: '20005', debit: 0, credit: 625000, narrative: `WHT on salaries - ${monthName(m)} 2024` },
      { code: '20007', debit: 0, credit: 175000, narrative: `EOBI contribution - ${monthName(m)} 2024` },
      { code: '10003', debit: 0, credit: 13800000, narrative: `Salary payment via HBL - ${monthName(m)} 2024` },
    ]);

    addJournal(entries, 'BPV', fmtDate(m, 5), [
      { code: '51003', debit: 2500000, credit: 0, narrative: `Office rent - ${monthName(m)} 2024` },
      { code: '10003', debit: 0, credit: 2500000, narrative: `Rent payment via HBL - ${monthName(m)} 2024` },
    ]);

    addJournal(entries, 'BPV', fmtDate(m, 10), [
      { code: '51004', debit: 850000, credit: 0, narrative: `Utilities - electricity & gas - ${monthName(m)} 2024` },
      { code: '10005', debit: 0, credit: 850000, narrative: `Utilities payment via Allied Bank - ${monthName(m)} 2024` },
    ]);

    addJournal(entries, 'PV', fmtDate(m, 15), [
      { code: '51008', debit: 120000, credit: 0, narrative: `Communication expense - ${monthName(m)} 2024` },
      { code: '51009', debit: 45000, credit: 0, narrative: `Printing & stationery - ${monthName(m)} 2024` },
      { code: '10002', debit: 0, credit: 165000, narrative: `Petty cash payment - ${monthName(m)} 2024` },
    ]);
  }

  const salesData = [
    { m: 1, amt: 42000000, cust: '11001', cos: 25200000 },
    { m: 2, amt: 38500000, cust: '11001', cos: 23100000 },
    { m: 3, amt: 55000000, cust: '11001', cos: 33000000 },
    { m: 4, amt: 48000000, cust: '11001', cos: 28800000 },
    { m: 5, amt: 52000000, cust: '11001', cos: 31200000 },
    { m: 6, amt: 65000000, cust: '11001', cos: 39000000 },
    { m: 7, amt: 72000000, cust: '11001', cos: 43200000 },
    { m: 8, amt: 78000000, cust: '11001', cos: 46800000 },
    { m: 9, amt: 85000000, cust: '11001', cos: 51000000 },
    { m: 10, amt: 92000000, cust: '11001', cos: 55200000 },
    { m: 11, amt: 110000000, cust: '11001', cos: 66000000 },
    { m: 12, amt: 115000000, cust: '11001', cos: 69000000 },
  ];

  const revenueAccounts = ['40001', '40002', '40003', '40004'];
  const revSplits = [0.45, 0.25, 0.20, 0.10];

  for (const s of salesData) {
    const lines: Array<{ code: string; debit: number; credit: number; narrative: string }> = [];
    lines.push({ code: s.cust, debit: s.amt, credit: 0, narrative: `Sales invoice - ${monthName(s.m)} 2024` });

    let allocated = 0;
    for (let i = 0; i < revenueAccounts.length; i++) {
      const isLast = i === revenueAccounts.length - 1;
      const portion = isLast ? (s.amt - allocated) : Math.round(s.amt * revSplits[i]);
      allocated += portion;
      lines.push({ code: revenueAccounts[i], debit: 0, credit: portion, narrative: `${acctName(revenueAccounts[i])} - ${monthName(s.m)} 2024` });
    }
    addJournal(entries, 'INV', fmtDate(s.m, 20), lines);

    const cosAccounts = ['50001', '50002', '50003', '50004', '50005'];
    const cosSplits = [0.40, 0.20, 0.15, 0.15, 0.10];
    const cosLines: Array<{ code: string; debit: number; credit: number; narrative: string }> = [];
    let cosAllocated = 0;
    for (let i = 0; i < cosAccounts.length; i++) {
      const isLast = i === cosAccounts.length - 1;
      const portion = isLast ? (s.cos - cosAllocated) : Math.round(s.cos * cosSplits[i]);
      cosAllocated += portion;
      cosLines.push({ code: cosAccounts[i], debit: portion, credit: 0, narrative: `Cost of sales - ${acctName(cosAccounts[i])} - ${monthName(s.m)} 2024` });
    }
    cosLines.push({ code: '20001', debit: 0, credit: s.cos, narrative: `Payable for cost of sales - ${monthName(s.m)} 2024` });
    addJournal(entries, 'JV', fmtDate(s.m, 22), cosLines);
  }

  const salesTaxRate = 0.17;
  for (let m = 1; m <= 12; m++) {
    const stAmt = Math.round(salesData[m - 1].amt * salesTaxRate * 0.05);
    addJournal(entries, 'JV', fmtDate(m, 28), [
      { code: '20006', debit: stAmt, credit: 0, narrative: `Sales tax adjustment - ${monthName(m)} 2024` },
      { code: '11008', debit: 0, credit: stAmt, narrative: `WHT adjustment against sales tax - ${monthName(m)} 2024` },
    ]);
  }

  for (let m = 1; m <= 12; m++) {
    const receiptAmt = Math.round(salesData[m - 1].amt * 0.88);
    addJournal(entries, 'BRV', fmtDate(m, 28), [
      { code: '10003', debit: Math.round(receiptAmt * 0.60), credit: 0, narrative: `Customer receipts via HBL - ${monthName(m)} 2024` },
      { code: '10004', debit: Math.round(receiptAmt * 0.25), credit: 0, narrative: `Customer receipts via MCB - ${monthName(m)} 2024` },
      { code: '10005', debit: receiptAmt - Math.round(receiptAmt * 0.60) - Math.round(receiptAmt * 0.25), credit: 0, narrative: `Customer receipts via Allied - ${monthName(m)} 2024` },
      { code: '11001', debit: 0, credit: receiptAmt, narrative: `Receivables collection - ${monthName(m)} 2024` },
    ]);
  }

  for (let m = 1; m <= 12; m++) {
    const payAmt = Math.round(salesData[m - 1].cos * 0.85);
    addJournal(entries, 'BPV', fmtDate(m, 18), [
      { code: '20001', debit: payAmt, credit: 0, narrative: `Supplier payments - ${monthName(m)} 2024` },
      { code: '10003', debit: 0, credit: Math.round(payAmt * 0.50), narrative: `Supplier payment via HBL - ${monthName(m)} 2024` },
      { code: '10004', debit: 0, credit: Math.round(payAmt * 0.30), narrative: `Supplier payment via MCB - ${monthName(m)} 2024` },
      { code: '10005', debit: 0, credit: payAmt - Math.round(payAmt * 0.50) - Math.round(payAmt * 0.30), narrative: `Supplier payment via Allied - ${monthName(m)} 2024` },
    ]);
  }

  for (let q = 0; q < 4; q++) {
    const m = [3, 6, 9, 12][q];
    addJournal(entries, 'JV', fmtDate(m, 30), [
      { code: '53001', debit: 6250000, credit: 0, narrative: `Depreciation charge - Q${q + 1} 2024` },
      { code: '14001', debit: 0, credit: 1500000, narrative: `Depreciation - Building Q${q + 1} 2024` },
      { code: '14002', debit: 0, credit: 1125000, narrative: `Depreciation - Plant & Machinery Q${q + 1} 2024` },
      { code: '14003', debit: 0, credit: 425000, narrative: `Depreciation - Furniture Q${q + 1} 2024` },
      { code: '14004', debit: 0, credit: 900000, narrative: `Depreciation - Vehicles Q${q + 1} 2024` },
      { code: '14005', debit: 0, credit: 1750000, narrative: `Depreciation - IT Equipment Q${q + 1} 2024` },
      { code: '14006', debit: 0, credit: 350000, narrative: `Depreciation - Software Q${q + 1} 2024` },
      { code: '14007', debit: 0, credit: 200000, narrative: `Depreciation - Leasehold Q${q + 1} 2024` },
    ]);

    addJournal(entries, 'JV', fmtDate(m, 30), [
      { code: '53002', debit: 1375000, credit: 0, narrative: `Amortization charge - Q${q + 1} 2024` },
      { code: '14006', debit: 0, credit: 1375000, narrative: `Software amortization - Q${q + 1} 2024` },
    ]);
  }

  for (let q = 0; q < 4; q++) {
    const m = [3, 6, 9, 12][q];
    addJournal(entries, 'JV', fmtDate(m, 28), [
      { code: '55002', debit: 3200000, credit: 0, narrative: `Interest on loans - Q${q + 1} 2024` },
      { code: '22001', debit: 0, credit: 800000, narrative: `Interest accrual - LT loan Q${q + 1} 2024` },
      { code: '21001', debit: 0, credit: 1200000, narrative: `Interest accrual - running finance Q${q + 1} 2024` },
      { code: '21002', debit: 0, credit: 1200000, narrative: `Interest accrual - ST loan Q${q + 1} 2024` },
    ]);
  }

  for (let m = 1; m <= 12; m++) {
    addJournal(entries, 'BPV', fmtDate(m, 20), [
      { code: '55001', debit: 85000, credit: 0, narrative: `Bank charges - ${monthName(m)} 2024` },
      { code: '10003', debit: 0, credit: 85000, narrative: `Bank charges deducted - HBL - ${monthName(m)} 2024` },
    ]);
  }

  for (let q = 0; q < 4; q++) {
    const m = [3, 6, 9, 12][q];
    addJournal(entries, 'JV', fmtDate(m, 28), [
      { code: '55003', debit: 750000, credit: 0, narrative: `Lease finance cost - Q${q + 1} 2024` },
      { code: '22004', debit: 0, credit: 750000, narrative: `Lease liability interest - Q${q + 1} 2024` },
    ]);
  }

  for (let q = 0; q < 4; q++) {
    const m = [3, 6, 9, 12][q];
    addJournal(entries, 'BRV', fmtDate(m, 15), [
      { code: '10004', debit: 1875000, credit: 0, narrative: `Interest received on deposits - Q${q + 1} 2024` },
      { code: '56001', debit: 0, credit: 1875000, narrative: `Interest income - Q${q + 1} 2024` },
    ]);
  }

  addJournal(entries, 'JV', fmtDate(6, 15), [
    { code: '10001', debit: 2500000, credit: 0, narrative: 'Proceeds from sale of old vehicle' },
    { code: '14004', debit: 1800000, credit: 0, narrative: 'Accumulated depreciation on disposed vehicle' },
    { code: '13005', debit: 0, credit: 3800000, narrative: 'Disposal of motor vehicle - cost' },
    { code: '56002', debit: 0, credit: 500000, narrative: 'Gain on disposal of vehicle' },
  ]);

  addJournal(entries, 'JV', fmtDate(9, 30), [
    { code: '56003', debit: 0, credit: 1200000, narrative: 'Exchange gain on foreign receivables' },
    { code: '11006', debit: 1200000, credit: 0, narrative: 'Exchange gain recognized on receivables' },
  ]);

  for (let q = 0; q < 4; q++) {
    const m = [3, 6, 9, 12][q];
    const amounts = [350000, 420000, 380000, 450000];
    addJournal(entries, 'BPV', fmtDate(m, 12), [
      { code: '51007', debit: amounts[q], credit: 0, narrative: `Travel expense - Q${q + 1} 2024` },
      { code: '10003', debit: 0, credit: amounts[q], narrative: `Travel payment via HBL - Q${q + 1} 2024` },
    ]);
  }

  for (let q = 0; q < 4; q++) {
    const m = [3, 6, 9, 12][q];
    addJournal(entries, 'BPV', fmtDate(m, 15), [
      { code: '51005', debit: 575000, credit: 0, narrative: `Insurance premium - Q${q + 1} 2024` },
      { code: '10003', debit: 0, credit: 575000, narrative: `Insurance payment via HBL - Q${q + 1} 2024` },
    ]);
  }

  for (let q = 0; q < 4; q++) {
    const m = [3, 6, 9, 12][q];
    const amounts = [280000, 320000, 350000, 450000];
    addJournal(entries, 'BPV', fmtDate(m, 20), [
      { code: '51006', debit: amounts[q], credit: 0, narrative: `Repairs & maintenance - Q${q + 1} 2024` },
      { code: '10005', debit: 0, credit: amounts[q], narrative: `R&M payment via Allied Bank - Q${q + 1} 2024` },
    ]);
  }

  for (let m = 1; m <= 12; m++) {
    addJournal(entries, 'BPV', fmtDate(m, 22), [
      { code: '51010', debit: 95000, credit: 0, narrative: `Miscellaneous admin - ${monthName(m)} 2024` },
      { code: '10002', debit: 0, credit: 95000, narrative: `Petty cash - misc admin - ${monthName(m)} 2024` },
    ]);
  }

  for (let m = 1; m <= 12; m++) {
    const commAmt = Math.round(salesData[m - 1].amt * 0.025);
    addJournal(entries, 'JV', fmtDate(m, 28), [
      { code: '52002', debit: commAmt, credit: 0, narrative: `Sales commission - ${monthName(m)} 2024` },
      { code: '20004', debit: 0, credit: commAmt, narrative: `Accrued sales commission - ${monthName(m)} 2024` },
    ]);
  }

  for (let q = 0; q < 4; q++) {
    const m = [3, 6, 9, 12][q];
    const amounts = [1500000, 1800000, 2200000, 2800000];
    addJournal(entries, 'BPV', fmtDate(m, 10), [
      { code: '52001', debit: amounts[q], credit: 0, narrative: `Marketing expense - Q${q + 1} 2024` },
      { code: '10003', debit: 0, credit: amounts[q], narrative: `Marketing payment via HBL - Q${q + 1} 2024` },
    ]);
  }

  for (let q = 0; q < 4; q++) {
    const m = [3, 6, 9, 12][q];
    addJournal(entries, 'BPV', fmtDate(m, 14), [
      { code: '52003', debit: 650000, credit: 0, narrative: `Advertising expense - Q${q + 1} 2024` },
      { code: '10003', debit: 0, credit: 650000, narrative: `Advertising payment via HBL - Q${q + 1} 2024` },
    ]);
  }

  for (let q = 0; q < 4; q++) {
    const m = [3, 6, 9, 12][q];
    addJournal(entries, 'BPV', fmtDate(m, 16), [
      { code: '52004', debit: 180000, credit: 0, narrative: `Client entertainment - Q${q + 1} 2024` },
      { code: '52005', debit: 220000, credit: 0, narrative: `Distribution expense - Q${q + 1} 2024` },
      { code: '10003', debit: 0, credit: 400000, narrative: `S&D payments via HBL - Q${q + 1} 2024` },
    ]);
  }

  addJournal(entries, 'BPV', fmtDate(3, 20), [
    { code: '54001', debit: 1200000, credit: 0, narrative: 'Legal fees - H1 2024' },
    { code: '10003', debit: 0, credit: 1200000, narrative: 'Legal fees payment via HBL' },
  ]);
  addJournal(entries, 'BPV', fmtDate(9, 20), [
    { code: '54001', debit: 800000, credit: 0, narrative: 'Legal fees - H2 2024' },
    { code: '10003', debit: 0, credit: 800000, narrative: 'Legal fees payment via HBL' },
  ]);

  addJournal(entries, 'BPV', fmtDate(6, 30), [
    { code: '54002', debit: 2500000, credit: 0, narrative: 'Audit fees - FY 2024' },
    { code: '10003', debit: 0, credit: 2500000, narrative: 'Audit fees payment via HBL' },
  ]);

  addJournal(entries, 'BPV', fmtDate(4, 15), [
    { code: '54003', debit: 1800000, credit: 0, narrative: 'IT consulting fees - H1 2024' },
    { code: '10003', debit: 0, credit: 1800000, narrative: 'Consulting fees payment via HBL' },
  ]);
  addJournal(entries, 'BPV', fmtDate(10, 15), [
    { code: '54003', debit: 1500000, credit: 0, narrative: 'IT consulting fees - H2 2024' },
    { code: '10003', debit: 0, credit: 1500000, narrative: 'Consulting fees payment via HBL' },
  ]);

  addJournal(entries, 'BPV', fmtDate(6, 15), [
    { code: '54004', debit: 900000, credit: 0, narrative: 'Tax advisory fees - H1 2024' },
    { code: '10003', debit: 0, credit: 900000, narrative: 'Tax advisory payment via HBL' },
  ]);
  addJournal(entries, 'BPV', fmtDate(12, 15), [
    { code: '54004', debit: 1100000, credit: 0, narrative: 'Tax advisory fees - H2 2024' },
    { code: '10003', debit: 0, credit: 1100000, narrative: 'Tax advisory payment via HBL' },
  ]);

  for (let q = 0; q < 4; q++) {
    const m = [3, 6, 9, 12][q];
    addJournal(entries, 'JV', fmtDate(m, 30), [
      { code: '22003', debit: 0, credit: 1500000, narrative: `Gratuity provision - Q${q + 1} 2024` },
      { code: '51002', debit: 1500000, credit: 0, narrative: `Gratuity expense provision - Q${q + 1} 2024` },
    ]);
  }

  for (let q = 0; q < 4; q++) {
    const m = [3, 6, 9, 12][q];
    addJournal(entries, 'BPV', fmtDate(m, 15), [
      { code: '21003', debit: 3000000, credit: 0, narrative: `LT loan installment payment - Q${q + 1} 2024` },
      { code: '10003', debit: 0, credit: 3000000, narrative: `Loan repayment via HBL - Q${q + 1} 2024` },
    ]);
  }

  addJournal(entries, 'JV', fmtDate(1, 1), [
    { code: '21003', debit: 0, credit: 12000000, narrative: 'Reclassify current portion of LT loan - FY 2024' },
    { code: '22001', debit: 12000000, credit: 0, narrative: 'Transfer current portion from LT loan' },
  ]);

  addJournal(entries, 'JV', fmtDate(3, 15), [
    { code: '11005', debit: 1500000, credit: 0, narrative: 'Staff advances - Q1 2024' },
    { code: '10003', debit: 0, credit: 1500000, narrative: 'Staff advance payment via HBL' },
  ]);
  addJournal(entries, 'JV', fmtDate(6, 30), [
    { code: '10003', debit: 800000, credit: 0, narrative: 'Staff advance recovery - salary deduction' },
    { code: '11005', debit: 0, credit: 800000, narrative: 'Recovery of staff advances' },
  ]);
  addJournal(entries, 'JV', fmtDate(9, 15), [
    { code: '11005', debit: 1200000, credit: 0, narrative: 'Staff advances - Q3 2024' },
    { code: '10003', debit: 0, credit: 1200000, narrative: 'Staff advance payment via HBL' },
  ]);
  addJournal(entries, 'JV', fmtDate(12, 30), [
    { code: '10003', debit: 600000, credit: 0, narrative: 'Staff advance recovery - year end' },
    { code: '11005', debit: 0, credit: 600000, narrative: 'Recovery of staff advances' },
  ]);

  addJournal(entries, 'JV', fmtDate(1, 15), [
    { code: '11007', debit: 3000000, credit: 0, narrative: 'Prepaid insurance - annual premium' },
    { code: '10003', debit: 0, credit: 3000000, narrative: 'Insurance prepayment via HBL' },
  ]);
  addJournal(entries, 'JV', fmtDate(12, 31), [
    { code: '51005', debit: 3000000, credit: 0, narrative: 'Amortization of prepaid insurance' },
    { code: '11007', debit: 0, credit: 3000000, narrative: 'Prepaid insurance expensed' },
  ]);

  addJournal(entries, 'BRV', fmtDate(2, 15), [
    { code: '10003', debit: 8000000, credit: 0, narrative: 'Customer advance received - Project Alpha' },
    { code: '20008', debit: 0, credit: 8000000, narrative: 'Advance from customer - Project Alpha' },
  ]);
  addJournal(entries, 'JV', fmtDate(8, 30), [
    { code: '20008', debit: 5000000, credit: 0, narrative: 'Advance adjusted against revenue - Project Alpha' },
    { code: '40005', debit: 0, credit: 5000000, narrative: 'Other operating income - advance adjustment' },
  ]);

  addJournal(entries, 'JV', fmtDate(7, 15), [
    { code: '13006', debit: 8500000, credit: 0, narrative: 'Purchase of IT equipment - servers' },
    { code: '10003', debit: 0, credit: 8500000, narrative: 'IT equipment payment via HBL' },
  ]);
  addJournal(entries, 'JV', fmtDate(10, 1), [
    { code: '13007', debit: 4500000, credit: 0, narrative: 'Purchase of ERP software module' },
    { code: '10003', debit: 0, credit: 4500000, narrative: 'Software purchase payment via HBL' },
  ]);

  addJournal(entries, 'JV', fmtDate(12, 31), [
    { code: '70001', debit: 28000000, credit: 0, narrative: 'Current tax expense - FY 2024' },
    { code: '20005', debit: 0, credit: 28000000, narrative: 'Income tax payable - FY 2024' },
  ]);
  addJournal(entries, 'JV', fmtDate(12, 31), [
    { code: '70002', debit: 3500000, credit: 0, narrative: 'Deferred tax expense - FY 2024' },
    { code: '22002', debit: 0, credit: 3500000, narrative: 'Deferred tax liability increase - FY 2024' },
  ]);

  for (let q = 0; q < 4; q++) {
    const m = [3, 6, 9, 12][q];
    addJournal(entries, 'BPV', fmtDate(m, 25), [
      { code: '20005', debit: 2500000, credit: 0, narrative: `WHT remittance to FBR - Q${q + 1} 2024` },
      { code: '10003', debit: 0, credit: 2500000, narrative: `WHT payment via HBL - Q${q + 1} 2024` },
    ]);
  }

  for (let m = 1; m <= 12; m++) {
    addJournal(entries, 'BPV', fmtDate(m, 20), [
      { code: '20006', debit: 1200000, credit: 0, narrative: `Sales tax remittance - ${monthName(m)} 2024` },
      { code: '10003', debit: 0, credit: 1200000, narrative: `Sales tax payment via HBL - ${monthName(m)} 2024` },
    ]);
  }

  addJournal(entries, 'DN', fmtDate(4, 10), [
    { code: '11001', debit: 1500000, credit: 0, narrative: 'Debit note - additional charges to client' },
    { code: '40005', debit: 0, credit: 1500000, narrative: 'Additional service charges billed' },
  ]);
  addJournal(entries, 'CN', fmtDate(5, 15), [
    { code: '40001', debit: 2200000, credit: 0, narrative: 'Credit note - project scope reduction' },
    { code: '11001', debit: 0, credit: 2200000, narrative: 'Credit note issued to customer' },
  ]);
  addJournal(entries, 'CN', fmtDate(8, 20), [
    { code: '40002', debit: 1800000, credit: 0, narrative: 'Credit note - cloud service SLA penalty' },
    { code: '11001', debit: 0, credit: 1800000, narrative: 'Credit note - SLA penalty adjustment' },
  ]);
  addJournal(entries, 'DN', fmtDate(11, 5), [
    { code: '11001', debit: 2800000, credit: 0, narrative: 'Debit note - delayed payment surcharge' },
    { code: '40005', debit: 0, credit: 2800000, narrative: 'Late payment surcharge billed' },
  ]);

  addJournal(entries, 'RV', fmtDate(2, 28), [
    { code: '10001', debit: 350000, credit: 0, narrative: 'Cash receipt from walk-in client' },
    { code: '40005', debit: 0, credit: 350000, narrative: 'Walk-in consultation income' },
  ]);
  addJournal(entries, 'RV', fmtDate(5, 10), [
    { code: '10001', debit: 500000, credit: 0, narrative: 'Cash receipt - training workshop' },
    { code: '40005', debit: 0, credit: 500000, narrative: 'Training workshop income' },
  ]);
  addJournal(entries, 'RV', fmtDate(8, 15), [
    { code: '10001', debit: 420000, credit: 0, narrative: 'Cash receipt - documentation fees' },
    { code: '40005', debit: 0, credit: 420000, narrative: 'Documentation fees income' },
  ]);
  addJournal(entries, 'RV', fmtDate(11, 20), [
    { code: '10001', debit: 380000, credit: 0, narrative: 'Cash receipt - ad-hoc support' },
    { code: '40005', debit: 0, credit: 380000, narrative: 'Ad-hoc support income' },
  ]);

  addJournal(entries, 'JV', fmtDate(3, 31), [
    { code: '12001', debit: 2500000, credit: 0, narrative: 'Raw materials purchase - Q1' },
    { code: '12002', debit: 1800000, credit: 0, narrative: 'WIP additions - Q1' },
    { code: '12003', debit: 0, credit: 3200000, narrative: 'Finished goods transferred out - Q1' },
    { code: '12005', debit: 1500000, credit: 0, narrative: 'Goods in transit - Q1' },
    { code: '20001', debit: 0, credit: 2600000, narrative: 'Inventory purchases payable - Q1' },
  ]);
  addJournal(entries, 'JV', fmtDate(6, 30), [
    { code: '12001', debit: 3000000, credit: 0, narrative: 'Raw materials purchase - Q2' },
    { code: '12002', debit: 2200000, credit: 0, narrative: 'WIP additions - Q2' },
    { code: '12003', debit: 0, credit: 3800000, narrative: 'Finished goods transferred out - Q2' },
    { code: '12005', debit: 0, credit: 1200000, narrative: 'Goods in transit received - Q2' },
    { code: '20001', debit: 0, credit: 200000, narrative: 'Inventory purchases payable - Q2' },
  ]);
  addJournal(entries, 'JV', fmtDate(9, 30), [
    { code: '12001', debit: 2800000, credit: 0, narrative: 'Raw materials purchase - Q3' },
    { code: '12002', debit: 0, credit: 2500000, narrative: 'WIP transferred to finished goods - Q3' },
    { code: '12003', debit: 2000000, credit: 0, narrative: 'Finished goods additions - Q3' },
    { code: '12004', debit: 500000, credit: 0, narrative: 'Stores & spares purchase - Q3' },
    { code: '20001', debit: 0, credit: 2800000, narrative: 'Inventory purchases payable - Q3' },
  ]);
  addJournal(entries, 'JV', fmtDate(12, 31), [
    { code: '12001', debit: 0, credit: 3500000, narrative: 'Raw materials consumed - Q4' },
    { code: '12002', debit: 1500000, credit: 0, narrative: 'WIP additions - Q4' },
    { code: '12003', debit: 3000000, credit: 0, narrative: 'Finished goods additions - Q4' },
    { code: '12004', debit: 0, credit: 800000, narrative: 'Stores consumed - Q4' },
    { code: '12005', debit: 0, credit: 200000, narrative: 'Goods in transit cleared - Q4' },
  ]);

  addJournal(entries, 'JV', fmtDate(6, 30), [
    { code: '20004', debit: 8000000, credit: 0, narrative: 'Accrued expenses settled - H1 2024' },
    { code: '10003', debit: 0, credit: 8000000, narrative: 'Accrued expenses payment via HBL' },
  ]);
  addJournal(entries, 'JV', fmtDate(12, 31), [
    { code: '20004', debit: 6000000, credit: 0, narrative: 'Accrued expenses settled - H2 2024' },
    { code: '10003', debit: 0, credit: 6000000, narrative: 'Accrued expenses payment via HBL' },
  ]);

  addJournal(entries, 'JV', fmtDate(10, 1), [
    { code: '10002', debit: 500000, credit: 0, narrative: 'Petty cash replenishment' },
    { code: '10003', debit: 0, credit: 500000, narrative: 'Petty cash transfer from HBL' },
  ]);

  addJournal(entries, 'JV', fmtDate(12, 31), [
    { code: '15002', debit: 800000, credit: 0, narrative: 'Deferred tax asset adjustment - FY 2024' },
    { code: '70002', debit: 0, credit: 800000, narrative: 'DTA recognized against deferred tax expense' },
  ]);

  return entries;
}

function monthName(m: number): string {
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return names[m - 1];
}

export const DEMO_GL_ENTRIES: GLEntry[] = generateGLEntries();

function computeTBData(): TBRow[] {
  const glSums = new Map<string, { debits: number; credits: number }>();
  for (const entry of DEMO_GL_ENTRIES) {
    const existing = glSums.get(entry.glCode) || { debits: 0, credits: 0 };
    existing.debits += entry.debit;
    existing.credits += entry.credit;
    glSums.set(entry.glCode, existing);
  }

  return DEMO_COA.map(a => {
    const ob = openingBalancesRaw[a.code] || 0;
    const gl = glSums.get(a.code) || { debits: 0, credits: 0 };
    const closingNet = ob + gl.debits - gl.credits;
    return {
      glCode: a.code,
      glName: a.accountName,
      openingBalance: ob,
      debit: gl.debits,
      credit: gl.credits,
      closingDebit: closingNet > 0 ? closingNet : 0,
      closingCredit: closingNet < 0 ? Math.abs(closingNet) : 0,
    };
  });
}

export const DEMO_TB_DATA: TBRow[] = computeTBData();

function getTBClosing(code: string): number {
  const row = DEMO_TB_DATA.find(r => r.glCode === code);
  return row ? (row.closingDebit - row.closingCredit) : 0;
}

function generateARParties(): ARParty[] {
  const controlClosing = getTBClosing('11001');

  const parties = [
    { customerId: 'AR-001', customerName: 'TechVision Systems (Pvt.) Ltd', email: 'accounts@techvision.pk', phone: '+92-21-35431200' },
    { customerId: 'AR-002', customerName: 'National Bank of Pakistan', email: 'vendor.mgmt@nbp.com.pk', phone: '+92-21-99221000' },
    { customerId: 'AR-003', customerName: 'Engro Digital Solutions', email: 'finance@engro.com', phone: '+92-21-35298200' },
    { customerId: 'AR-004', customerName: 'K-Electric Limited', email: 'procurement@ke.com.pk', phone: '+92-21-99000000' },
    { customerId: 'AR-005', customerName: 'Pakistan Telecommunication Co.', email: 'ap@ptcl.net.pk', phone: '+92-51-2271100' },
    { customerId: 'AR-006', customerName: 'Habib Bank Limited', email: 'vendor@hbl.com', phone: '+92-21-32418000' },
    { customerId: 'AR-007', customerName: 'Allied Bank Limited', email: 'procurement@abl.com', phone: '+92-42-36316000' },
    { customerId: 'AR-008', customerName: 'NUST University', email: 'finance@nust.edu.pk', phone: '+92-51-9085100' },
    { customerId: 'AR-009', customerName: 'Jazz/Mobilink', email: 'procurement@jazz.com.pk', phone: '+92-42-111529929' },
    { customerId: 'AR-010', customerName: 'Systems Limited', email: 'accounts@systemsltd.com', phone: '+92-42-35761999' },
    { customerId: 'AR-011', customerName: 'Telenor Pakistan', email: 'procurement@telenor.com.pk', phone: '+92-51-111345100' },
    { customerId: 'AR-012', customerName: 'FWO Construction', email: 'finance@fwo.com.pk', phone: '+92-51-9271500' },
    { customerId: 'AR-013', customerName: 'Pakistan State Oil', email: 'vendor@pso.com.pk', phone: '+92-21-35633061' },
    { customerId: 'AR-014', customerName: 'Sui Southern Gas Co.', email: 'accounts@ssgc.com.pk', phone: '+92-21-99021000' },
    { customerId: 'AR-015', customerName: 'Dawood Hercules Corp.', email: 'finance@dawoodhercules.com', phone: '+92-42-36306671' },
    { customerId: 'AR-016', customerName: 'Lucky Cement Ltd', email: 'procurement@lucky-cement.com', phone: '+92-21-38104261' },
    { customerId: 'AR-017', customerName: 'Fauji Fertilizer Co.', email: 'vendor@ffc.com.pk', phone: '+92-51-9272610' },
    { customerId: 'AR-018', customerName: 'NetSol Technologies', email: 'ap@netsoltech.com', phone: '+92-42-35727096' },
  ];

  const openingAR = 68500000;
  const weights = [12, 10, 9, 8, 7, 7, 6, 6, 5, 5, 4, 4, 4, 3, 3, 3, 2, 2];
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  const openingAmounts: number[] = [];
  let openingSum = 0;
  for (let i = 0; i < weights.length; i++) {
    const isLast = i === weights.length - 1;
    const amt = isLast ? (openingAR - openingSum) : Math.round(openingAR * weights[i] / totalWeight);
    openingAmounts.push(amt);
    openingSum += amt;
  }

  const closingAmounts: number[] = [];
  let closingSum = 0;
  const closingWeights = [14, 11, 10, 8, 7, 6, 6, 5, 5, 5, 4, 4, 3, 3, 3, 2, 2, 2];
  const closingTotalWeight = closingWeights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < closingWeights.length; i++) {
    const isLast = i === closingWeights.length - 1;
    const amt = isLast ? (controlClosing - closingSum) : Math.round(controlClosing * closingWeights[i] / closingTotalWeight);
    closingAmounts.push(amt);
    closingSum += amt;
  }

  return parties.map((p, i) => ({
    ...p,
    openingDebit: openingAmounts[i],
    openingCredit: 0,
    closingDebit: closingAmounts[i] > 0 ? closingAmounts[i] : 0,
    closingCredit: closingAmounts[i] < 0 ? Math.abs(closingAmounts[i]) : 0,
    glCode: '11001',
  }));
}

function generateAPParties(): APParty[] {
  const controlClosing = getTBClosing('20001');
  const absClosing = Math.abs(controlClosing);

  const parties = [
    { vendorId: 'AP-001', vendorName: 'Dell Technologies Pakistan', email: 'ar@dell.com.pk', phone: '+92-21-35833100' },
    { vendorId: 'AP-002', vendorName: 'Microsoft Pakistan (Pvt.) Ltd', email: 'billing@microsoft.pk', phone: '+92-21-35296500' },
    { vendorId: 'AP-003', vendorName: 'Oracle Corporation Pakistan', email: 'ar@oracle.pk', phone: '+92-21-35862000' },
    { vendorId: 'AP-004', vendorName: 'Cisco Systems Pakistan', email: 'billing@cisco.pk', phone: '+92-51-2878900' },
    { vendorId: 'AP-005', vendorName: 'Amazon Web Services', email: 'billing@aws.amazon.com', phone: '+1-206-2661000' },
    { vendorId: 'AP-006', vendorName: 'HP Pakistan', email: 'ar@hp.com.pk', phone: '+92-42-35761200' },
    { vendorId: 'AP-007', vendorName: 'SAP Pakistan', email: 'billing@sap.pk', phone: '+92-21-35297300' },
    { vendorId: 'AP-008', vendorName: 'Zameen.com Technologies', email: 'finance@zameen.com', phone: '+92-42-35734300' },
    { vendorId: 'AP-009', vendorName: 'TPS Pakistan', email: 'accounts@tpsonline.com', phone: '+92-21-35311670' },
    { vendorId: 'AP-010', vendorName: 'LMKT (Pvt.) Ltd', email: 'finance@lmkt.com', phone: '+92-51-8731500' },
    { vendorId: 'AP-011', vendorName: 'Inbox Business Technologies', email: 'ar@inbox.pk', phone: '+92-21-34387400' },
    { vendorId: 'AP-012', vendorName: 'Nayatel (Pvt.) Ltd', email: 'billing@nayatel.com', phone: '+92-51-111629283' },
    { vendorId: 'AP-013', vendorName: 'Pakistan Cables Ltd', email: 'sales@pakistancables.com', phone: '+92-21-35060261' },
    { vendorId: 'AP-014', vendorName: 'Artistic Milliners', email: 'finance@artisticmilliners.com', phone: '+92-21-35060800' },
    { vendorId: 'AP-015', vendorName: 'Avanceon Limited', email: 'ar@avanceon.com', phone: '+92-42-35294858' },
    { vendorId: 'AP-016', vendorName: 'TPL Trakker', email: 'billing@tpltrakker.com', phone: '+92-21-34329530' },
    { vendorId: 'AP-017', vendorName: 'i2c Inc. Pakistan', email: 'ar@i2cinc.com', phone: '+92-42-35762300' },
    { vendorId: 'AP-018', vendorName: 'Teradata Pakistan', email: 'billing@teradata.pk', phone: '+92-51-2891200' },
  ];

  const openingAP = 52000000;
  const weights = [11, 10, 9, 8, 7, 7, 6, 6, 5, 5, 4, 4, 4, 3, 3, 3, 3, 2];
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  const openingAmounts: number[] = [];
  let openingSum = 0;
  for (let i = 0; i < weights.length; i++) {
    const isLast = i === weights.length - 1;
    const amt = isLast ? (openingAP - openingSum) : Math.round(openingAP * weights[i] / totalWeight);
    openingAmounts.push(amt);
    openingSum += amt;
  }

  const closingAmounts: number[] = [];
  let closingSum = 0;
  const closingWeights = [12, 10, 9, 8, 7, 7, 6, 5, 5, 5, 4, 4, 4, 3, 3, 3, 3, 2];
  const closingTotalWeight = closingWeights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < closingWeights.length; i++) {
    const isLast = i === closingWeights.length - 1;
    const amt = isLast ? (absClosing - closingSum) : Math.round(absClosing * closingWeights[i] / closingTotalWeight);
    closingAmounts.push(amt);
    closingSum += amt;
  }

  return parties.map((p, i) => ({
    ...p,
    openingDebit: 0,
    openingCredit: openingAmounts[i],
    closingDebit: 0,
    closingCredit: closingAmounts[i],
    glCode: '20001',
  }));
}

export const DEMO_AR_PARTIES: ARParty[] = generateARParties();
export const DEMO_AP_PARTIES: APParty[] = generateAPParties();

export const DEMO_BANK_MASTER: BankMaster[] = [
  {
    bankAccountId: 'HBL-001',
    bankName: 'Habib Bank Limited',
    branch: 'I-9 Islamabad Branch',
    accountNumber: '1234-5678-9012-01',
    accountType: 'Current',
    currency: 'PKR',
    glCode: '10003',
  },
  {
    bankAccountId: 'MCB-001',
    bankName: 'MCB Bank Limited',
    branch: 'Blue Area Islamabad Branch',
    accountNumber: '9876-5432-1098-01',
    accountType: 'Savings',
    currency: 'PKR',
    glCode: '10004',
  },
  {
    bankAccountId: 'ABL-001',
    bankName: 'Allied Bank Limited',
    branch: 'F-8 Islamabad Branch',
    accountNumber: '5555-6666-7777-01',
    accountType: 'Current',
    currency: 'PKR',
    glCode: '10005',
  },
  {
    bankAccountId: 'HBL-FD-001',
    bankName: 'Habib Bank Limited',
    branch: 'I-9 Islamabad Branch',
    accountNumber: 'FD-2024-001',
    accountType: 'Fixed Deposit',
    currency: 'PKR',
    glCode: '10006',
  },
];

export const DEMO_BANK_BALANCES: BankBalance[] = DEMO_BANK_MASTER.map(bank => {
  const tbClosing = getTBClosing(bank.glCode);
  return {
    bankAccountId: bank.bankAccountId,
    statementDate: '12/31/2024',
    bookBalance: tbClosing,
    statementBalance: tbClosing,
    reconciled: true,
  };
});

function validateAllData(): void {
  const errors: string[] = [];

  const totalOpeningDebits = DEMO_OPENING_BALANCES.reduce((s, r) => s + r.openingDebit, 0);
  const totalOpeningCredits = DEMO_OPENING_BALANCES.reduce((s, r) => s + r.openingCredit, 0);
  if (Math.abs(totalOpeningDebits - totalOpeningCredits) > 1) {
    errors.push(`Opening balances don't balance: DR=${totalOpeningDebits} CR=${totalOpeningCredits}`);
  }

  const voucherSums = new Map<string, { debits: number; credits: number }>();
  for (const entry of DEMO_GL_ENTRIES) {
    const existing = voucherSums.get(entry.voucherNo) || { debits: 0, credits: 0 };
    existing.debits += entry.debit;
    existing.credits += entry.credit;
    voucherSums.set(entry.voucherNo, existing);
  }
  for (const [vn, sums] of voucherSums) {
    if (Math.abs(sums.debits - sums.credits) > 1) {
      errors.push(`Voucher ${vn} doesn't balance: DR=${sums.debits} CR=${sums.credits}`);
    }
  }

  for (const tb of DEMO_TB_DATA) {
    const ob = openingBalancesRaw[tb.glCode] || 0;
    const expectedClosing = ob + tb.debit - tb.credit;
    if (Math.abs((tb.closingDebit - tb.closingCredit) - expectedClosing) > 1) {
      errors.push(`TB ${tb.glCode}: closing ${tb.closingDebit - tb.closingCredit} != expected ${expectedClosing}`);
    }
  }

  const totalClosingDebits = DEMO_TB_DATA.reduce((s, r) => s + r.closingDebit, 0);
  const totalClosingCredits = DEMO_TB_DATA.reduce((s, r) => s + r.closingCredit, 0);
  if (Math.abs(totalClosingDebits - totalClosingCredits) > 1) {
    errors.push(`TB closing doesn't balance: DR=${totalClosingDebits} CR=${totalClosingCredits}`);
  }

  const arTotal = DEMO_AR_PARTIES.reduce((s, p) => s + p.closingDebit - p.closingCredit, 0);
  const arControl = getTBClosing('11001');
  if (Math.abs(arTotal - arControl) > 1) {
    errors.push(`AR parties total ${arTotal} != control account 11001 closing ${arControl}`);
  }

  const apTotal = DEMO_AP_PARTIES.reduce((s, p) => s + p.closingCredit - p.closingDebit, 0);
  const apControl = Math.abs(getTBClosing('20001'));
  if (Math.abs(apTotal - apControl) > 1) {
    errors.push(`AP parties total ${apTotal} != control account 20001 closing ${apControl}`);
  }

  for (const bank of DEMO_BANK_BALANCES) {
    const master = DEMO_BANK_MASTER.find(m => m.bankAccountId === bank.bankAccountId);
    if (master) {
      const tbClosing = getTBClosing(master.glCode);
      if (Math.abs(bank.bookBalance - tbClosing) > 1) {
        errors.push(`Bank ${bank.bankAccountId} balance ${bank.bookBalance} != GL ${master.glCode} closing ${tbClosing}`);
      }
    }
  }

  if (DEMO_GL_ENTRIES.length < 500) {
    errors.push(`GL entries count ${DEMO_GL_ENTRIES.length} is less than required 500`);
  }

  if (errors.length > 0) {
    console.error('DEMO DATA VALIDATION ERRORS:');
    errors.forEach(e => console.error(`  - ${e}`));
    throw new Error(`Demo data validation failed with ${errors.length} errors:\n${errors.join('\n')}`);
  }

  console.log(`Demo data validation passed:`);
  console.log(`  - COA: ${DEMO_COA.length} accounts`);
  console.log(`  - GL Entries: ${DEMO_GL_ENTRIES.length} transactions`);
  console.log(`  - TB Rows: ${DEMO_TB_DATA.length}`);
  console.log(`  - AR Parties: ${DEMO_AR_PARTIES.length}`);
  console.log(`  - AP Parties: ${DEMO_AP_PARTIES.length}`);
  console.log(`  - Bank Accounts: ${DEMO_BANK_MASTER.length}`);
  console.log(`  - Opening Balance: DR=${totalOpeningDebits.toLocaleString()} CR=${totalOpeningCredits.toLocaleString()}`);
  console.log(`  - TB Closing: DR=${totalClosingDebits.toLocaleString()} CR=${totalClosingCredits.toLocaleString()}`);
}

validateAllData();
