import { prisma } from "../db";
import type { DataHealthCheck, DataHealthSummary } from "../../shared/importSchema";

export async function computeDataHealth(engagementId: string): Promise<DataHealthSummary> {
  const checks: DataHealthCheck[] = [];

  const tbCheck = await checkTBBalance(engagementId);
  checks.push(tbCheck);

  const glCheck = await checkGLBalance(engagementId);
  checks.push(glCheck);

  const tbGlRecon = await checkTBGLReconciliation(engagementId);
  checks.push(tbGlRecon);

  const apControl = await checkAPControlReconciliation(engagementId);
  checks.push(apControl);

  const arControl = await checkARControlReconciliation(engagementId);
  checks.push(arControl);

  const bankRecon = await checkBankReconciliation(engagementId);
  checks.push(bankRecon);

  const passCount = checks.filter(c => c.status === 'PASS').length;
  const failCount = checks.filter(c => c.status === 'FAIL').length;
  const warningCount = checks.filter(c => c.status === 'WARNING').length;
  const notRunCount = checks.filter(c => c.status === 'NOT_RUN').length;

  let overallStatus: 'PASS' | 'FAIL' | 'WARNING' | 'NOT_RUN' = 'PASS';
  if (failCount > 0) overallStatus = 'FAIL';
  else if (warningCount > 0) overallStatus = 'WARNING';
  else if (notRunCount === checks.length) overallStatus = 'NOT_RUN';

  return {
    overallStatus,
    passCount,
    failCount,
    warningCount,
    notRunCount,
    checks,
    lastRunAt: new Date().toISOString(),
  };
}

async function checkTBBalance(engagementId: string): Promise<DataHealthCheck> {
  const tbBatch = await prisma.tBBatch.findFirst({
    where: { engagementId },
    select: { id: true },
  });

  if (!tbBatch) {
    const importCount = await prisma.importAccountBalance.count({ where: { engagementId } });
    if (importCount > 0) {
      const importBalances = await prisma.importAccountBalance.findMany({
        where: { engagementId, balanceType: 'CB' },
        select: { accountCode: true, debitAmount: true, creditAmount: true },
      });
      let closingDr = 0, closingCr = 0;
      for (const b of importBalances) {
        closingDr += Number(b.debitAmount || 0);
        closingCr += Number(b.creditAmount || 0);
      }
      const diff = Math.abs(closingDr - closingCr);
      if (diff < 1) {
        return {
          checkId: 'TB_BALANCE',
          name: 'Trial Balance Arithmetic',
          category: 'TB_BALANCE',
          status: 'PASS',
          message: `TB arithmetic verified (import data): ${importBalances.length} accounts, Closing DR ${closingDr.toLocaleString()}, Closing CR ${closingCr.toLocaleString()}`,
          details: { totalClosingDebit: closingDr, totalClosingCredit: closingCr, accountCount: importBalances.length, source: 'import' },
          blocking: true,
          isaRef: 'ISA 500',
        };
      }
      return {
        checkId: 'TB_BALANCE',
        name: 'Trial Balance Arithmetic',
        category: 'TB_BALANCE',
        status: 'FAIL',
        message: `TB Closing DR (${closingDr.toLocaleString()}) ≠ CR (${closingCr.toLocaleString()}). Difference: ${diff.toLocaleString()}`,
        details: { totalClosingDebit: closingDr, totalClosingCredit: closingCr, difference: diff, source: 'import' },
        blocking: true,
        isaRef: 'ISA 500',
      };
    }
    return {
      checkId: 'TB_BALANCE',
      name: 'Trial Balance Arithmetic',
      category: 'TB_BALANCE',
      status: 'NOT_RUN',
      message: 'No Trial Balance data uploaded.',
      blocking: true,
      isaRef: 'ISA 500',
    };
  }

  const tbEntries = await prisma.tBEntry.findMany({
    where: { batchId: tbBatch.id },
    select: {
      accountCode: true,
      openingBalance: true,
      movementDebit: true,
      movementCredit: true,
      closingDebit: true,
      closingCredit: true,
    },
  });

  if (tbEntries.length === 0) {
    return {
      checkId: 'TB_BALANCE',
      name: 'Trial Balance Arithmetic',
      category: 'TB_BALANCE',
      status: 'NOT_RUN',
      message: 'No TB entries found.',
      blocking: true,
      isaRef: 'ISA 500',
    };
  }

  let totalDebit = 0;
  let totalCredit = 0;
  let totalClosingDebit = 0;
  let totalClosingCredit = 0;
  const failedRows: string[] = [];

  for (const entry of tbEntries) {
    const opening = Number(entry.openingBalance || 0);
    const dr = Number(entry.movementDebit || 0);
    const cr = Number(entry.movementCredit || 0);
    const closingDr = Number(entry.closingDebit || 0);
    const closingCr = Number(entry.closingCredit || 0);

    totalDebit += dr;
    totalCredit += cr;
    totalClosingDebit += closingDr;
    totalClosingCredit += closingCr;

    const expectedClosing = opening + dr - cr;
    const actualClosing = closingDr - closingCr;
    if (Math.abs(expectedClosing - actualClosing) > 1) {
      failedRows.push(entry.accountCode);
    }
  }

  const totalBalance = Math.abs(totalClosingDebit - totalClosingCredit);
  const drCrBalance = Math.abs(totalDebit - totalCredit);

  if (failedRows.length > 0) {
    return {
      checkId: 'TB_BALANCE',
      name: 'Trial Balance Arithmetic',
      category: 'TB_BALANCE',
      status: 'FAIL',
      message: `${failedRows.length} account(s) failed Opening + Dr - Cr = Closing check: ${failedRows.slice(0, 5).join(', ')}${failedRows.length > 5 ? ` (+${failedRows.length - 5} more)` : ''}`,
      details: { failedAccounts: failedRows, totalDebit, totalCredit, totalClosingDebit, totalClosingCredit },
      blocking: true,
      isaRef: 'ISA 500',
    };
  }

  return {
    checkId: 'TB_BALANCE',
    name: 'Trial Balance Arithmetic',
    category: 'TB_BALANCE',
    status: 'PASS',
    message: `TB arithmetic verified: ${tbEntries.length} accounts, Closing DR ${totalClosingDebit.toLocaleString()}, Closing CR ${totalClosingCredit.toLocaleString()}`,
    details: { totalDebit, totalCredit, totalClosingDebit, totalClosingCredit, accountCount: tbEntries.length },
    blocking: true,
    isaRef: 'ISA 500',
  };
}

async function checkGLBalance(engagementId: string): Promise<DataHealthCheck> {
  const glBatch = await prisma.gLBatch.findFirst({
    where: { engagementId },
    select: { id: true },
  });

  if (!glBatch) {
    const importGLCount = await prisma.importJournalLine.count({
      where: { journalHeader: { engagementId } },
    });
    if (importGLCount > 0) {
      const importTotals = await prisma.importJournalLine.aggregate({
        where: { journalHeader: { engagementId } },
        _sum: { debit: true, credit: true },
        _count: true,
      });
      const totalDr = Number(importTotals._sum.debit || 0);
      const totalCr = Number(importTotals._sum.credit || 0);
      const diff = Math.abs(totalDr - totalCr);
      if (diff < 1) {
        return {
          checkId: 'GL_BALANCE',
          name: 'GL Debit = Credit Balance',
          category: 'GL_BALANCE',
          status: 'PASS',
          message: `GL balanced (import data): ${importTotals._count} entries, Total ${totalDr.toLocaleString()}`,
          details: { totalDebit: totalDr, totalCredit: totalCr, entryCount: importTotals._count, source: 'import' },
          blocking: true,
          isaRef: 'ISA 500',
        };
      }
      return {
        checkId: 'GL_BALANCE',
        name: 'GL Debit = Credit Balance',
        category: 'GL_BALANCE',
        status: 'FAIL',
        message: `GL DR (${totalDr.toLocaleString()}) ≠ CR (${totalCr.toLocaleString()}). Difference: ${diff.toLocaleString()}`,
        details: { totalDebit: totalDr, totalCredit: totalCr, difference: diff, entryCount: importTotals._count, source: 'import' },
        blocking: true,
        isaRef: 'ISA 500',
      };
    }
    return {
      checkId: 'GL_BALANCE',
      name: 'GL Debit = Credit Balance',
      category: 'GL_BALANCE',
      status: 'NOT_RUN',
      message: 'No General Ledger data uploaded.',
      blocking: true,
      isaRef: 'ISA 500',
    };
  }

  const totals = await prisma.gLEntry.aggregate({
    where: { batchId: glBatch.id },
    _sum: { debit: true, credit: true },
    _count: true,
  });

  const totalDr = Number(totals._sum.debit || 0);
  const totalCr = Number(totals._sum.credit || 0);
  const diff = Math.abs(totalDr - totalCr);

  if (diff > 1) {
    return {
      checkId: 'GL_BALANCE',
      name: 'GL Debit = Credit Balance',
      category: 'GL_BALANCE',
      status: 'FAIL',
      message: `GL total Debit (${totalDr.toLocaleString()}) does not equal total Credit (${totalCr.toLocaleString()}). Difference: ${diff.toLocaleString()}`,
      details: { totalDebit: totalDr, totalCredit: totalCr, difference: diff, entryCount: totals._count },
      blocking: true,
      isaRef: 'ISA 500',
    };
  }

  return {
    checkId: 'GL_BALANCE',
    name: 'GL Debit = Credit Balance',
    category: 'GL_BALANCE',
    status: 'PASS',
    message: `GL balanced: ${totals._count} entries, Total ${totalDr.toLocaleString()}`,
    details: { totalDebit: totalDr, totalCredit: totalCr, entryCount: totals._count },
    blocking: true,
    isaRef: 'ISA 500',
  };
}

async function checkTBGLReconciliation(engagementId: string): Promise<DataHealthCheck> {
  const tbBatch = await prisma.tBBatch.findFirst({ where: { engagementId }, select: { id: true } });
  const glBatch = await prisma.gLBatch.findFirst({ where: { engagementId }, select: { id: true } });

  if (!tbBatch || !glBatch) {
    const importTBCount = await prisma.importAccountBalance.count({ where: { engagementId } });
    const importGLCount = await prisma.importJournalLine.count({ where: { journalHeader: { engagementId } } });
    if (importTBCount > 0 && importGLCount > 0) {
      return {
        checkId: 'TB_GL_RECON',
        name: 'TB-GL Reconciliation',
        category: 'TB_GL_RECON',
        status: 'WARNING',
        message: 'TB and GL data uploaded. Sync to core tables pending for full reconciliation.',
        blocking: false,
        isaRef: 'ISA 500',
      };
    }
    const hasSome = importTBCount > 0 || importGLCount > 0;
    return {
      checkId: 'TB_GL_RECON',
      name: 'TB-GL Reconciliation',
      category: 'TB_GL_RECON',
      status: 'NOT_RUN',
      message: hasSome ? 'Both TB and GL data are required for reconciliation.' : 'Both TB and GL data are required for reconciliation.',
      blocking: true,
      isaRef: 'ISA 500',
    };
  }

  const tbEntries = await prisma.tBEntry.findMany({
    where: { batchId: tbBatch.id },
    select: { accountCode: true, movementDebit: true, movementCredit: true },
  });

  const glAggregates = await prisma.gLEntry.groupBy({
    by: ['accountCode'],
    where: { batchId: glBatch.id },
    _sum: { debit: true, credit: true },
  });

  const glByCode = new Map<string, { dr: number; cr: number }>();
  for (const agg of glAggregates) {
    glByCode.set(agg.accountCode, {
      dr: Number(agg._sum.debit || 0),
      cr: Number(agg._sum.credit || 0),
    });
  }

  const mismatches: { code: string; tbMovement: number; glMovement: number; diff: number }[] = [];
  const orphanGlCodes: string[] = [];

  for (const tb of tbEntries) {
    const tbMovement = Number(tb.movementDebit || 0) - Number(tb.movementCredit || 0);
    const gl = glByCode.get(tb.accountCode);
    const glMovement = gl ? (gl.dr - gl.cr) : 0;
    const diff = Math.abs(tbMovement - glMovement);

    if (diff > 1) {
      mismatches.push({ code: tb.accountCode, tbMovement, glMovement, diff });
    }
    glByCode.delete(tb.accountCode);
  }

  for (const [code] of Array.from(glByCode.entries())) {
    orphanGlCodes.push(code);
  }

  if (mismatches.length > 0 || orphanGlCodes.length > 0) {
    const msgs: string[] = [];
    if (mismatches.length > 0) {
      msgs.push(`${mismatches.length} account(s) have TB-GL movement mismatches: ${mismatches.slice(0, 3).map(m => `${m.code} (diff: ${m.diff.toLocaleString()})`).join(', ')}`);
    }
    if (orphanGlCodes.length > 0) {
      msgs.push(`${orphanGlCodes.length} GL code(s) not in TB: ${orphanGlCodes.slice(0, 3).join(', ')}`);
    }

    return {
      checkId: 'TB_GL_RECON',
      name: 'TB-GL Reconciliation',
      category: 'TB_GL_RECON',
      status: 'FAIL',
      message: msgs.join('. '),
      details: { mismatches: mismatches.slice(0, 10), orphanGlCodes: orphanGlCodes.slice(0, 10) },
      blocking: true,
      isaRef: 'ISA 500',
    };
  }

  return {
    checkId: 'TB_GL_RECON',
    name: 'TB-GL Reconciliation',
    category: 'TB_GL_RECON',
    status: 'PASS',
    message: `TB-GL reconciled: All ${tbEntries.length} TB accounts match GL movements.`,
    details: { matchedAccounts: tbEntries.length },
    blocking: true,
    isaRef: 'ISA 500',
  };
}

async function checkAPControlReconciliation(engagementId: string): Promise<DataHealthCheck> {
  const apParties = await prisma.importPartyBalance.findMany({
    where: { engagementId, partyType: 'VENDOR' },
    select: { partyCode: true, balance: true, controlAccountCode: true },
  });

  if (apParties.length === 0) {
    return {
      checkId: 'AP_CONTROL',
      name: 'AP vs Control Account Reconciliation',
      category: 'AP_CONTROL',
      status: 'NOT_RUN',
      message: 'No AP (vendor) party data available.',
      blocking: false,
      isaRef: 'ISA 505',
    };
  }

  const tbBatch = await prisma.tBBatch.findFirst({ where: { engagementId }, select: { id: true } });
  if (!tbBatch) {
    return {
      checkId: 'AP_CONTROL',
      name: 'AP vs Control Account Reconciliation',
      category: 'AP_CONTROL',
      status: 'NOT_RUN',
      message: 'No TB data to compare AP control account balances.',
      blocking: false,
      isaRef: 'ISA 505',
    };
  }

  const controlCodes = new Set<string>();
  let apTotal = 0;
  for (const p of apParties) {
    apTotal += Number(p.balance || 0);
    if (p.controlAccountCode) controlCodes.add(p.controlAccountCode);
  }

  if (controlCodes.size === 0) {
    return {
      checkId: 'AP_CONTROL',
      name: 'AP vs Control Account Reconciliation',
      category: 'AP_CONTROL',
      status: 'WARNING',
      message: 'AP parties exist but no control account codes are assigned.',
      details: { apTotal, partyCount: apParties.length },
      blocking: false,
      isaRef: 'ISA 505',
    };
  }

  const tbEntries = await prisma.tBEntry.findMany({
    where: { batchId: tbBatch.id, accountCode: { in: Array.from(controlCodes) } },
    select: { accountCode: true, closingDebit: true, closingCredit: true },
  });

  let controlTotal = 0;
  for (const tb of tbEntries) {
    controlTotal += Number(tb.closingCredit || 0) - Number(tb.closingDebit || 0);
  }

  const diff = Math.abs(apTotal - controlTotal);

  if (diff > 1) {
    return {
      checkId: 'AP_CONTROL',
      name: 'AP vs Control Account Reconciliation',
      category: 'AP_CONTROL',
      status: 'FAIL',
      message: `AP subledger total (${apTotal.toLocaleString()}) does not match control account total (${controlTotal.toLocaleString()}). Difference: ${diff.toLocaleString()}`,
      details: { apTotal, controlTotal, difference: diff, controlCodes: Array.from(controlCodes) },
      blocking: false,
      isaRef: 'ISA 505',
    };
  }

  return {
    checkId: 'AP_CONTROL',
    name: 'AP vs Control Account Reconciliation',
    category: 'AP_CONTROL',
    status: 'PASS',
    message: `AP reconciled: Subledger total matches control account(s) ${Array.from(controlCodes).join(', ')}`,
    details: { apTotal, controlTotal, controlCodes: Array.from(controlCodes) },
    blocking: false,
    isaRef: 'ISA 505',
  };
}

async function checkARControlReconciliation(engagementId: string): Promise<DataHealthCheck> {
  const arParties = await prisma.importPartyBalance.findMany({
    where: { engagementId, partyType: 'CUSTOMER' },
    select: { partyCode: true, balance: true, controlAccountCode: true },
  });

  if (arParties.length === 0) {
    return {
      checkId: 'AR_CONTROL',
      name: 'AR vs Control Account Reconciliation',
      category: 'AR_CONTROL',
      status: 'NOT_RUN',
      message: 'No AR (customer) party data available.',
      blocking: false,
      isaRef: 'ISA 505',
    };
  }

  const tbBatch = await prisma.tBBatch.findFirst({ where: { engagementId }, select: { id: true } });
  if (!tbBatch) {
    return {
      checkId: 'AR_CONTROL',
      name: 'AR vs Control Account Reconciliation',
      category: 'AR_CONTROL',
      status: 'NOT_RUN',
      message: 'No TB data to compare AR control account balances.',
      blocking: false,
      isaRef: 'ISA 505',
    };
  }

  const controlCodes = new Set<string>();
  let arTotal = 0;
  for (const p of arParties) {
    arTotal += Number(p.balance || 0);
    if (p.controlAccountCode) controlCodes.add(p.controlAccountCode);
  }

  if (controlCodes.size === 0) {
    return {
      checkId: 'AR_CONTROL',
      name: 'AR vs Control Account Reconciliation',
      category: 'AR_CONTROL',
      status: 'WARNING',
      message: 'AR parties exist but no control account codes are assigned.',
      details: { arTotal, partyCount: arParties.length },
      blocking: false,
      isaRef: 'ISA 505',
    };
  }

  const tbEntries = await prisma.tBEntry.findMany({
    where: { batchId: tbBatch.id, accountCode: { in: Array.from(controlCodes) } },
    select: { accountCode: true, closingDebit: true, closingCredit: true },
  });

  let controlTotal = 0;
  for (const tb of tbEntries) {
    controlTotal += Number(tb.closingDebit || 0) - Number(tb.closingCredit || 0);
  }

  const diff = Math.abs(arTotal - controlTotal);

  if (diff > 1) {
    return {
      checkId: 'AR_CONTROL',
      name: 'AR vs Control Account Reconciliation',
      category: 'AR_CONTROL',
      status: 'FAIL',
      message: `AR subledger total (${arTotal.toLocaleString()}) does not match control account total (${controlTotal.toLocaleString()}). Difference: ${diff.toLocaleString()}`,
      details: { arTotal, controlTotal, difference: diff, controlCodes: Array.from(controlCodes) },
      blocking: false,
      isaRef: 'ISA 505',
    };
  }

  return {
    checkId: 'AR_CONTROL',
    name: 'AR vs Control Account Reconciliation',
    category: 'AR_CONTROL',
    status: 'PASS',
    message: `AR reconciled: Subledger total matches control account(s) ${Array.from(controlCodes).join(', ')}`,
    details: { arTotal, controlTotal, controlCodes: Array.from(controlCodes) },
    blocking: false,
    isaRef: 'ISA 505',
  };
}

async function checkBankReconciliation(engagementId: string): Promise<DataHealthCheck> {
  const bankBalances = await prisma.importBankBalance.findMany({
    where: { engagementId },
    select: { bankAccountCode: true, glBankAccountCode: true, closingBalance: true },
  });

  if (bankBalances.length === 0) {
    return {
      checkId: 'BANK_RECON',
      name: 'Bank Account vs GL Reconciliation',
      category: 'BANK_RECON',
      status: 'NOT_RUN',
      message: 'No bank balance data available.',
      blocking: false,
      isaRef: 'ISA 505',
    };
  }

  const tbBatch = await prisma.tBBatch.findFirst({ where: { engagementId }, select: { id: true } });
  if (!tbBatch) {
    return {
      checkId: 'BANK_RECON',
      name: 'Bank Account vs GL Reconciliation',
      category: 'BANK_RECON',
      status: 'NOT_RUN',
      message: 'No TB data to compare bank GL balances.',
      blocking: false,
      isaRef: 'ISA 505',
    };
  }

  const glCodes = [...new Set(bankBalances.map(b => b.glBankAccountCode).filter(Boolean))];
  if (glCodes.length === 0) {
    return {
      checkId: 'BANK_RECON',
      name: 'Bank Account vs GL Reconciliation',
      category: 'BANK_RECON',
      status: 'WARNING',
      message: 'Bank balances exist but no GL codes are assigned.',
      details: { bankCount: bankBalances.length },
      blocking: false,
      isaRef: 'ISA 505',
    };
  }

  const tbEntries = await prisma.tBEntry.findMany({
    where: { batchId: tbBatch.id, accountCode: { in: glCodes } },
    select: { accountCode: true, closingDebit: true, closingCredit: true },
  });

  const tbByCode = new Map<string, number>();
  for (const tb of tbEntries) {
    tbByCode.set(tb.accountCode, Number(tb.closingDebit || 0) - Number(tb.closingCredit || 0));
  }

  const missing: string[] = [];
  for (const code of glCodes) {
    if (!tbByCode.has(code)) {
      missing.push(code);
    }
  }

  if (missing.length > 0) {
    return {
      checkId: 'BANK_RECON',
      name: 'Bank Account vs GL Reconciliation',
      category: 'BANK_RECON',
      status: 'WARNING',
      message: `${missing.length} bank GL code(s) not found in Trial Balance: ${missing.slice(0, 5).join(', ')}`,
      details: { missingCodes: missing, matchedCount: glCodes.length - missing.length },
      blocking: false,
      isaRef: 'ISA 505',
    };
  }

  return {
    checkId: 'BANK_RECON',
    name: 'Bank Account vs GL Reconciliation',
    category: 'BANK_RECON',
    status: 'PASS',
    message: `All ${bankBalances.length} bank balance records have matching GL codes in Trial Balance.`,
    details: { bankCount: bankBalances.length, matchedCodes: glCodes },
    blocking: false,
    isaRef: 'ISA 505',
  };
}
