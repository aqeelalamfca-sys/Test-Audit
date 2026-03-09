import { prisma } from "../db";
import { Decimal } from "@prisma/client/runtime/library";

export interface ReconciliationItem {
  glCode: string;
  glName: string;
  sourceAmount: number;
  targetAmount: number;
  difference: number;
  differencePercent: number;
  status: 'MATCHED' | 'VARIANCE' | 'MISSING_SOURCE' | 'MISSING_TARGET';
  drilldownAvailable: boolean;
}

export interface ReconciliationResult {
  reconciliationType: 'TB_GL' | 'AR_CONTROL' | 'AP_CONTROL' | 'BANK_CONTROL';
  status: 'PASS' | 'FAIL' | 'WARNING' | 'NOT_RUN';
  tolerance: number;
  matchedCount: number;
  varianceCount: number;
  totalVariance: number;
  items: ReconciliationItem[];
  summary: {
    sourceTotal: number;
    targetTotal: number;
    netDifference: number;
  };
  generatedAt: string;
}

export interface AllReconciliationsResult {
  tbGl: ReconciliationResult;
  arControl: ReconciliationResult;
  apControl: ReconciliationResult;
  bankControl: ReconciliationResult;
  overallStatus: 'PASS' | 'FAIL' | 'WARNING';
}

export interface DrilldownResult {
  glCode: string;
  glName: string;
  reconciliationType: string;
  sourceItems: DrilldownItem[];
  targetItems: DrilldownItem[];
  sourceTotal: number;
  targetTotal: number;
  difference: number;
}

export interface DrilldownItem {
  id: string;
  description: string;
  amount: number;
  date?: string;
  reference?: string;
}

function toNumber(value: Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  return Number(value);
}

function calculateDifferencePercent(source: number, target: number): number {
  if (source === 0 && target === 0) return 0;
  const base = Math.max(Math.abs(source), Math.abs(target));
  if (base === 0) return 0;
  return Math.abs(target - source) / base;
}

function determineStatus(
  sourceAmount: number,
  targetAmount: number,
  tolerance: number
): ReconciliationItem['status'] {
  const diff = Math.abs(targetAmount - sourceAmount);
  const base = Math.max(Math.abs(sourceAmount), Math.abs(targetAmount));
  
  if (base === 0 && diff === 0) return 'MATCHED';
  if (sourceAmount === 0 && targetAmount !== 0) return 'MISSING_SOURCE';
  if (targetAmount === 0 && sourceAmount !== 0) return 'MISSING_TARGET';
  
  const percentDiff = diff / base;
  return percentDiff <= tolerance ? 'MATCHED' : 'VARIANCE';
}

function determineOverallStatus(items: ReconciliationItem[]): ReconciliationResult['status'] {
  if (items.length === 0) return 'NOT_RUN';
  
  const hasVariance = items.some(i => i.status === 'VARIANCE');
  const hasMissing = items.some(i => i.status === 'MISSING_SOURCE' || i.status === 'MISSING_TARGET');
  
  if (hasVariance) return 'FAIL';
  if (hasMissing) return 'WARNING';
  return 'PASS';
}

export async function reconcileTBvsGL(
  engagementId: string,
  tolerance: number = 0.01
): Promise<ReconciliationResult> {
  const coaAccounts = await prisma.coAAccount.findMany({
    where: { engagementId },
    select: {
      accountCode: true,
      accountName: true,
      periodDr: true,
      periodCr: true,
      closingBalance: true,
    },
  });

  const tbEntries = await prisma.tBEntry.findMany({
    where: { engagementId },
    select: {
      accountCode: true,
      accountName: true,
      movementNet: true,
      closingBalance: true,
    },
  });

  const glEntries = await prisma.gLEntry.findMany({
    where: { engagementId },
    select: {
      accountCode: true,
      debit: true,
      credit: true,
    },
  });

  const tbByCode = new Map<string, { name: string; balance: number }>();
  for (const tb of tbEntries) {
    const code = tb.accountCode?.trim();
    if (!code) continue;
    const existing = tbByCode.get(code);
    const balance = toNumber(tb.closingBalance);
    if (existing) {
      existing.balance += balance;
    } else {
      tbByCode.set(code, { name: tb.accountName || '', balance });
    }
  }

  const glByCode = new Map<string, { debit: number; credit: number }>();
  for (const gl of glEntries) {
    const code = gl.accountCode?.trim();
    if (!code) continue;
    const existing = glByCode.get(code);
    const debit = toNumber(gl.debit);
    const credit = toNumber(gl.credit);
    if (existing) {
      existing.debit += debit;
      existing.credit += credit;
    } else {
      glByCode.set(code, { debit, credit });
    }
  }

  const allCodes = new Set<string>();
  coaAccounts.forEach(a => a.accountCode && allCodes.add(a.accountCode.trim()));
  tbByCode.forEach((_, code) => allCodes.add(code));
  glByCode.forEach((_, code) => allCodes.add(code));

  const coaMap = new Map<string, string>();
  coaAccounts.forEach(a => {
    if (a.accountCode) {
      coaMap.set(a.accountCode.trim(), a.accountName || '');
    }
  });

  const items: ReconciliationItem[] = [];
  let sourceTotal = 0;
  let targetTotal = 0;

  for (const glCode of allCodes) {
    const tbData = tbByCode.get(glCode);
    const glData = glByCode.get(glCode);
    
    const sourceAmount = tbData?.balance || 0;
    const targetAmount = glData ? (glData.debit - glData.credit) : 0;
    const glName = coaMap.get(glCode) || tbData?.name || glCode;
    
    const difference = targetAmount - sourceAmount;
    const differencePercent = calculateDifferencePercent(sourceAmount, targetAmount);
    const status = determineStatus(sourceAmount, targetAmount, tolerance);
    
    sourceTotal += sourceAmount;
    targetTotal += targetAmount;
    
    items.push({
      glCode,
      glName,
      sourceAmount,
      targetAmount,
      difference,
      differencePercent,
      status,
      drilldownAvailable: true,
    });
  }

  const matchedCount = items.filter(i => i.status === 'MATCHED').length;
  const varianceCount = items.filter(i => i.status === 'VARIANCE').length;
  const totalVariance = items
    .filter(i => i.status === 'VARIANCE')
    .reduce((sum, i) => sum + Math.abs(i.difference), 0);

  return {
    reconciliationType: 'TB_GL',
    status: determineOverallStatus(items),
    tolerance,
    matchedCount,
    varianceCount,
    totalVariance,
    items: items.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference)),
    summary: {
      sourceTotal,
      targetTotal,
      netDifference: targetTotal - sourceTotal,
    },
    generatedAt: new Date().toISOString(),
  };
}

export async function reconcileARControl(
  engagementId: string,
  tolerance: number = 0.01
): Promise<ReconciliationResult> {
  const arBalances = await prisma.importPartyBalance.findMany({
    where: {
      engagementId,
      partyType: { in: ['CUSTOMER', 'AR'] },
    },
    select: {
      controlAccountCode: true,
      partyCode: true,
      partyName: true,
      balance: true,
      drcr: true,
    },
  });

  const coaAccounts = await prisma.coAAccount.findMany({
    where: { engagementId },
    select: {
      accountCode: true,
      accountName: true,
      closingBalance: true,
    },
  });

  const coaMap = new Map<string, { name: string; balance: number }>();
  for (const coa of coaAccounts) {
    const code = coa.accountCode?.trim();
    if (code) {
      coaMap.set(code, {
        name: coa.accountName || '',
        balance: toNumber(coa.closingBalance),
      });
    }
  }

  const arByControlCode = new Map<string, number>();
  for (const ar of arBalances) {
    const code = ar.controlAccountCode?.trim();
    if (!code) continue;
    const balance = toNumber(ar.balance);
    const signedBalance = ar.drcr === 'CR' ? -balance : balance;
    const existing = arByControlCode.get(code) || 0;
    arByControlCode.set(code, existing + signedBalance);
  }

  const allCodes = new Set<string>();
  arByControlCode.forEach((_, code) => allCodes.add(code));

  const items: ReconciliationItem[] = [];
  let sourceTotal = 0;
  let targetTotal = 0;

  for (const glCode of allCodes) {
    const arBalance = arByControlCode.get(glCode) || 0;
    const coaData = coaMap.get(glCode);
    const tbBalance = coaData?.balance || 0;
    const glName = coaData?.name || glCode;
    
    const sourceAmount = arBalance;
    const targetAmount = tbBalance;
    const difference = targetAmount - sourceAmount;
    const differencePercent = calculateDifferencePercent(sourceAmount, targetAmount);
    const status = determineStatus(sourceAmount, targetAmount, tolerance);
    
    if (status === 'VARIANCE') {
      console.warn(`Tie-out difference exceeds tolerance for GL_CODE ${glCode}: Δ ${difference.toFixed(2)}`);
    }
    
    sourceTotal += sourceAmount;
    targetTotal += targetAmount;
    
    items.push({
      glCode,
      glName,
      sourceAmount,
      targetAmount,
      difference,
      differencePercent,
      status,
      drilldownAvailable: true,
    });
  }

  const matchedCount = items.filter(i => i.status === 'MATCHED').length;
  const varianceCount = items.filter(i => i.status === 'VARIANCE').length;
  const totalVariance = items
    .filter(i => i.status === 'VARIANCE')
    .reduce((sum, i) => sum + Math.abs(i.difference), 0);

  return {
    reconciliationType: 'AR_CONTROL',
    status: items.length === 0 ? 'NOT_RUN' : determineOverallStatus(items),
    tolerance,
    matchedCount,
    varianceCount,
    totalVariance,
    items: items.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference)),
    summary: {
      sourceTotal,
      targetTotal,
      netDifference: targetTotal - sourceTotal,
    },
    generatedAt: new Date().toISOString(),
  };
}

export async function reconcileAPControl(
  engagementId: string,
  tolerance: number = 0.01
): Promise<ReconciliationResult> {
  const apBalances = await prisma.importPartyBalance.findMany({
    where: {
      engagementId,
      partyType: { in: ['VENDOR', 'AP'] },
    },
    select: {
      controlAccountCode: true,
      partyCode: true,
      partyName: true,
      balance: true,
      drcr: true,
    },
  });

  const coaAccounts = await prisma.coAAccount.findMany({
    where: { engagementId },
    select: {
      accountCode: true,
      accountName: true,
      closingBalance: true,
    },
  });

  const coaMap = new Map<string, { name: string; balance: number }>();
  for (const coa of coaAccounts) {
    const code = coa.accountCode?.trim();
    if (code) {
      coaMap.set(code, {
        name: coa.accountName || '',
        balance: toNumber(coa.closingBalance),
      });
    }
  }

  const apByControlCode = new Map<string, number>();
  for (const ap of apBalances) {
    const code = ap.controlAccountCode?.trim();
    if (!code) continue;
    const balance = toNumber(ap.balance);
    const signedBalance = ap.drcr === 'DR' ? -balance : balance;
    const existing = apByControlCode.get(code) || 0;
    apByControlCode.set(code, existing + signedBalance);
  }

  const allCodes = new Set<string>();
  apByControlCode.forEach((_, code) => allCodes.add(code));

  const items: ReconciliationItem[] = [];
  let sourceTotal = 0;
  let targetTotal = 0;

  for (const glCode of allCodes) {
    const apBalance = apByControlCode.get(glCode) || 0;
    const coaData = coaMap.get(glCode);
    const tbBalance = coaData?.balance || 0;
    const glName = coaData?.name || glCode;
    
    const sourceAmount = apBalance;
    const targetAmount = tbBalance;
    const difference = targetAmount - sourceAmount;
    const differencePercent = calculateDifferencePercent(sourceAmount, targetAmount);
    const status = determineStatus(sourceAmount, targetAmount, tolerance);
    
    if (status === 'VARIANCE') {
      console.warn(`Tie-out difference exceeds tolerance for GL_CODE ${glCode}: Δ ${difference.toFixed(2)}`);
    }
    
    sourceTotal += sourceAmount;
    targetTotal += targetAmount;
    
    items.push({
      glCode,
      glName,
      sourceAmount,
      targetAmount,
      difference,
      differencePercent,
      status,
      drilldownAvailable: true,
    });
  }

  const matchedCount = items.filter(i => i.status === 'MATCHED').length;
  const varianceCount = items.filter(i => i.status === 'VARIANCE').length;
  const totalVariance = items
    .filter(i => i.status === 'VARIANCE')
    .reduce((sum, i) => sum + Math.abs(i.difference), 0);

  return {
    reconciliationType: 'AP_CONTROL',
    status: items.length === 0 ? 'NOT_RUN' : determineOverallStatus(items),
    tolerance,
    matchedCount,
    varianceCount,
    totalVariance,
    items: items.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference)),
    summary: {
      sourceTotal,
      targetTotal,
      netDifference: targetTotal - sourceTotal,
    },
    generatedAt: new Date().toISOString(),
  };
}

export async function reconcileBankControl(
  engagementId: string,
  tolerance: number = 0.01
): Promise<ReconciliationResult> {
  const bankBalances = await prisma.importBankBalance.findMany({
    where: { engagementId },
    select: {
      glBankAccountCode: true,
      bankAccountCode: true,
      closingBalance: true,
      drcr: true,
    },
  });

  const coaAccounts = await prisma.coAAccount.findMany({
    where: { engagementId },
    select: {
      accountCode: true,
      accountName: true,
      closingBalance: true,
    },
  });

  const coaMap = new Map<string, { name: string; balance: number }>();
  for (const coa of coaAccounts) {
    const code = coa.accountCode?.trim();
    if (code) {
      coaMap.set(code, {
        name: coa.accountName || '',
        balance: toNumber(coa.closingBalance),
      });
    }
  }

  const bankByGLCode = new Map<string, number>();
  for (const bank of bankBalances) {
    const code = bank.glBankAccountCode?.trim();
    if (!code) continue;
    const balance = toNumber(bank.closingBalance);
    const signedBalance = bank.drcr === 'CR' ? -balance : balance;
    const existing = bankByGLCode.get(code) || 0;
    bankByGLCode.set(code, existing + signedBalance);
  }

  const allCodes = new Set<string>();
  bankByGLCode.forEach((_, code) => allCodes.add(code));

  const items: ReconciliationItem[] = [];
  let sourceTotal = 0;
  let targetTotal = 0;

  for (const glCode of allCodes) {
    const bankBalance = bankByGLCode.get(glCode) || 0;
    const coaData = coaMap.get(glCode);
    const tbBalance = coaData?.balance || 0;
    const glName = coaData?.name || glCode;
    
    const sourceAmount = bankBalance;
    const targetAmount = tbBalance;
    const difference = targetAmount - sourceAmount;
    const differencePercent = calculateDifferencePercent(sourceAmount, targetAmount);
    const status = determineStatus(sourceAmount, targetAmount, tolerance);
    
    if (status === 'VARIANCE') {
      console.warn(`Tie-out difference exceeds tolerance for GL_CODE ${glCode}: Δ ${difference.toFixed(2)}`);
    }
    
    sourceTotal += sourceAmount;
    targetTotal += targetAmount;
    
    items.push({
      glCode,
      glName,
      sourceAmount,
      targetAmount,
      difference,
      differencePercent,
      status,
      drilldownAvailable: true,
    });
  }

  const matchedCount = items.filter(i => i.status === 'MATCHED').length;
  const varianceCount = items.filter(i => i.status === 'VARIANCE').length;
  const totalVariance = items
    .filter(i => i.status === 'VARIANCE')
    .reduce((sum, i) => sum + Math.abs(i.difference), 0);

  return {
    reconciliationType: 'BANK_CONTROL',
    status: items.length === 0 ? 'NOT_RUN' : determineOverallStatus(items),
    tolerance,
    matchedCount,
    varianceCount,
    totalVariance,
    items: items.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference)),
    summary: {
      sourceTotal,
      targetTotal,
      netDifference: targetTotal - sourceTotal,
    },
    generatedAt: new Date().toISOString(),
  };
}

export async function getAllReconciliations(
  engagementId: string,
  tolerance: number = 0.01
): Promise<AllReconciliationsResult> {
  const [tbGl, arControl, apControl, bankControl] = await Promise.all([
    reconcileTBvsGL(engagementId, tolerance),
    reconcileARControl(engagementId, tolerance),
    reconcileAPControl(engagementId, tolerance),
    reconcileBankControl(engagementId, tolerance),
  ]);

  const statuses = [tbGl.status, arControl.status, apControl.status, bankControl.status];
  
  let overallStatus: 'PASS' | 'FAIL' | 'WARNING';
  if (statuses.includes('FAIL')) {
    overallStatus = 'FAIL';
  } else if (statuses.includes('WARNING')) {
    overallStatus = 'WARNING';
  } else if (statuses.every(s => s === 'NOT_RUN')) {
    overallStatus = 'WARNING';
  } else {
    overallStatus = 'PASS';
  }

  return {
    tbGl,
    arControl,
    apControl,
    bankControl,
    overallStatus,
  };
}

export async function getReconciliationDrilldown(
  engagementId: string,
  reconciliationType: string,
  glCode: string
): Promise<DrilldownResult> {
  const coaAccount = await prisma.coAAccount.findFirst({
    where: { engagementId, accountCode: glCode },
    select: { accountName: true, closingBalance: true },
  });

  const glName = coaAccount?.accountName || glCode;
  const sourceItems: DrilldownItem[] = [];
  const targetItems: DrilldownItem[] = [];
  let sourceTotal = 0;
  let targetTotal = 0;

  switch (reconciliationType) {
    case 'TB_GL': {
      const tbEntries = await prisma.tBEntry.findMany({
        where: { engagementId, accountCode: glCode },
        select: {
          id: true,
          accountName: true,
          closingBalance: true,
        },
      });

      const glEntries = await prisma.gLEntry.findMany({
        where: { engagementId, accountCode: glCode },
        select: {
          id: true,
          description: true,
          narrative: true,
          transactionDate: true,
          voucherNumber: true,
          debit: true,
          credit: true,
        },
      });

      for (const tb of tbEntries) {
        const balance = toNumber(tb.closingBalance);
        sourceTotal += balance;
        sourceItems.push({
          id: tb.id,
          description: tb.accountName || 'TB Entry',
          amount: balance,
        });
      }

      for (const gl of glEntries) {
        const net = toNumber(gl.debit) - toNumber(gl.credit);
        targetTotal += net;
        targetItems.push({
          id: gl.id,
          description: gl.narrative || gl.description || 'GL Entry',
          amount: net,
          date: gl.transactionDate?.toISOString().split('T')[0],
          reference: gl.voucherNumber || undefined,
        });
      }
      break;
    }

    case 'AR_CONTROL': {
      const arBalances = await prisma.importPartyBalance.findMany({
        where: {
          engagementId,
          controlAccountCode: glCode,
          partyType: { in: ['CUSTOMER', 'AR'] },
        },
        select: {
          id: true,
          partyCode: true,
          partyName: true,
          balance: true,
          drcr: true,
        },
      });

      for (const ar of arBalances) {
        const balance = toNumber(ar.balance);
        const signedBalance = ar.drcr === 'CR' ? -balance : balance;
        sourceTotal += signedBalance;
        sourceItems.push({
          id: ar.id,
          description: `${ar.partyCode} - ${ar.partyName || 'Customer'}`,
          amount: signedBalance,
        });
      }

      targetTotal = toNumber(coaAccount?.closingBalance);
      targetItems.push({
        id: 'coa-balance',
        description: `COA/TB Balance: ${glName}`,
        amount: targetTotal,
      });
      break;
    }

    case 'AP_CONTROL': {
      const apBalances = await prisma.importPartyBalance.findMany({
        where: {
          engagementId,
          controlAccountCode: glCode,
          partyType: { in: ['VENDOR', 'AP'] },
        },
        select: {
          id: true,
          partyCode: true,
          partyName: true,
          balance: true,
          drcr: true,
        },
      });

      for (const ap of apBalances) {
        const balance = toNumber(ap.balance);
        const signedBalance = ap.drcr === 'DR' ? -balance : balance;
        sourceTotal += signedBalance;
        sourceItems.push({
          id: ap.id,
          description: `${ap.partyCode} - ${ap.partyName || 'Vendor'}`,
          amount: signedBalance,
        });
      }

      targetTotal = toNumber(coaAccount?.closingBalance);
      targetItems.push({
        id: 'coa-balance',
        description: `COA/TB Balance: ${glName}`,
        amount: targetTotal,
      });
      break;
    }

    case 'BANK_CONTROL': {
      const bankBalances = await prisma.importBankBalance.findMany({
        where: {
          engagementId,
          glBankAccountCode: glCode,
        },
        select: {
          id: true,
          bankAccountCode: true,
          closingBalance: true,
          drcr: true,
          asOfDate: true,
        },
      });

      for (const bank of bankBalances) {
        const balance = toNumber(bank.closingBalance);
        const signedBalance = bank.drcr === 'CR' ? -balance : balance;
        sourceTotal += signedBalance;
        sourceItems.push({
          id: bank.id,
          description: `Bank Account: ${bank.bankAccountCode}`,
          amount: signedBalance,
          date: bank.asOfDate?.toISOString().split('T')[0],
        });
      }

      targetTotal = toNumber(coaAccount?.closingBalance);
      targetItems.push({
        id: 'coa-balance',
        description: `COA/TB Balance: ${glName}`,
        amount: targetTotal,
      });
      break;
    }

    default:
      throw new Error(`Unknown reconciliation type: ${reconciliationType}`);
  }

  return {
    glCode,
    glName,
    reconciliationType,
    sourceItems,
    targetItems,
    sourceTotal,
    targetTotal,
    difference: targetTotal - sourceTotal,
  };
}
