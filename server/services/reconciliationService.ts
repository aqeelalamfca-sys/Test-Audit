import { prisma } from "../db";

export interface ReconciliationStatus {
  tbBalanced: boolean;
  glBalanced: boolean;
  tbGlReconciled: boolean;
  tbStatus: {
    totalDebits: number;
    totalCredits: number;
    difference: number;
    entryCount: number;
    hasData: boolean;
    status: string;
  };
  glStatus: {
    totalDebits: number;
    totalCredits: number;
    difference: number;
    entryCount: number;
    hasData: boolean;
    status: string;
  };
  glCodeRecon: {
    tbCodes: string[];
    glCodes: string[];
    unmatchedInTb: string[];
    unmatchedInGl: string[];
    amountMismatches: { code: string; tbAmount: number; glAmount: number; difference: number }[];
    duplicateGlCodes: string[];
    isReconciled: boolean;
  };
  phaseRequirements: {
    phase: string;
    canTransition: boolean;
    blockers: string[];
  }[];
}

export async function getReconciliationStatus(engagementId: string): Promise<ReconciliationStatus> {
  const [tbBatch, glBatch] = await Promise.all([
    prisma.tBBatch.findFirst({
      where: { engagementId },
      orderBy: { createdAt: "desc" },
      include: { entries: true }
    }),
    prisma.gLBatch.findFirst({
      where: { engagementId },
      orderBy: { createdAt: "desc" },
      include: { entries: true }
    }),
  ]);

  let tbTotalDebits = 0;
  let tbTotalCredits = 0;
  let tbHasData = !!tbBatch;
  if (tbBatch) {
    tbTotalDebits = Number(tbBatch.totalMovementDebit || 0);
    tbTotalCredits = Number(tbBatch.totalMovementCredit || 0);
    
    if (tbTotalDebits === 0 && tbTotalCredits === 0 && tbBatch.entries.length > 0) {
      for (const entry of tbBatch.entries) {
        tbTotalDebits += Number(entry.movementDebit || 0);
        tbTotalCredits += Number(entry.movementCredit || 0);
      }
    }
  } else {
    const importBalanceCount = await prisma.importAccountBalance.count({
      where: { engagementId, balanceType: 'CB' },
    });
    if (importBalanceCount > 0) {
      tbHasData = true;
      const glMovementTotals = await prisma.importJournalLine.aggregate({
        where: { journalHeader: { engagementId } },
        _sum: { debit: true, credit: true },
      });
      tbTotalDebits = Number(glMovementTotals._sum.debit || 0);
      tbTotalCredits = Number(glMovementTotals._sum.credit || 0);
    }
  }
  const tbDifference = Math.abs(tbTotalDebits - tbTotalCredits);
  const tbBalanced = tbHasData ? tbDifference < 0.01 : false;

  let glTotalDebits = 0;
  let glTotalCredits = 0;
  let glHasData = !!glBatch;
  if (glBatch) {
    glTotalDebits = Number(glBatch.totalDebits || 0);
    glTotalCredits = Number(glBatch.totalCredits || 0);
    
    if (glTotalDebits === 0 && glTotalCredits === 0 && glBatch.entries.length > 0) {
      for (const entry of glBatch.entries) {
        glTotalDebits += Number(entry.debit || 0);
        glTotalCredits += Number(entry.credit || 0);
      }
    }
  } else {
    const importGLTotals = await prisma.importJournalLine.aggregate({
      where: { journalHeader: { engagementId } },
      _sum: { debit: true, credit: true },
      _count: true,
    });
    if (importGLTotals._count > 0) {
      glHasData = true;
      glTotalDebits = Number(importGLTotals._sum.debit || 0);
      glTotalCredits = Number(importGLTotals._sum.credit || 0);
    }
  }
  const glDifference = Math.abs(glTotalDebits - glTotalCredits);
  const glBalanced = glHasData ? glDifference < 0.01 : false;

  const glCodeRecon = await computeGlCodeRecon(engagementId);
  const tbGlReconciled = glCodeRecon.isReconciled;

  const phaseRequirements = getPhaseRequirements(
    tbBalanced,
    glBalanced,
    tbGlReconciled,
    tbHasData,
    glHasData,
  );

  return {
    tbBalanced,
    glBalanced,
    tbGlReconciled,
    tbStatus: {
      totalDebits: tbTotalDebits,
      totalCredits: tbTotalCredits,
      difference: tbDifference,
      entryCount: tbBatch?.entries.length || 0,
      hasData: tbHasData,
      status: tbBatch?.status || (tbHasData ? "IMPORTED" : "NOT_UPLOADED")
    },
    glStatus: {
      totalDebits: glTotalDebits,
      totalCredits: glTotalCredits,
      difference: glDifference,
      entryCount: glBatch?.entries.length || 0,
      hasData: glHasData,
      status: glBatch?.status || (glHasData ? "IMPORTED" : "NOT_UPLOADED")
    },
    glCodeRecon,
    phaseRequirements
  };
}

async function computeGlCodeRecon(engagementId: string): Promise<ReconciliationStatus['glCodeRecon']> {
  // Try to get TB data from ImportAccountBalance first
  let tbBalances = await prisma.importAccountBalance.findMany({
    where: { engagementId },
    select: { accountCode: true, balanceType: true, debitAmount: true, creditAmount: true },
  });

  const tbOpeningByCode: Record<string, number> = {};
  const tbClosingByCode: Record<string, number> = {};
  const tbCodeCount: Record<string, number> = {};
  const tbMovementByCode: Record<string, number> = {};
  let usedDirectMovement = false;

  if (tbBalances.length > 0) {
    for (const row of tbBalances) {
      const code = row.accountCode;
      const net = Number(row.debitAmount || 0) - Number(row.creditAmount || 0);
      if (row.balanceType === 'OB') {
        tbOpeningByCode[code] = (tbOpeningByCode[code] || 0) + net;
      } else if (row.balanceType === 'CB') {
        tbClosingByCode[code] = (tbClosingByCode[code] || 0) + net;
        tbCodeCount[code] = (tbCodeCount[code] || 0) + 1;
      }
    }
  } else {
    const tbBatch = await prisma.tBBatch.findFirst({
      where: { engagementId },
      orderBy: { createdAt: "desc" },
      include: { entries: true }
    });

    if (tbBatch && tbBatch.entries.length > 0) {
      usedDirectMovement = true;
      for (const entry of tbBatch.entries) {
        const code = entry.accountCode;
        const closingNet = Number(entry.closingDebit || 0) - Number(entry.closingCredit || 0);
        const openingNet = Number(entry.openingDebit || 0) - Number(entry.openingCredit || 0);

        tbOpeningByCode[code] = (tbOpeningByCode[code] || 0) + openingNet;
        tbClosingByCode[code] = (tbClosingByCode[code] || 0) + closingNet;
        tbCodeCount[code] = (tbCodeCount[code] || 0) + 1;

        const md = Number(entry.movementDebit || 0);
        const mc = Number(entry.movementCredit || 0);
        if (md !== 0 || mc !== 0) {
          tbMovementByCode[code] = (tbMovementByCode[code] || 0) + (md - mc);
        } else {
          tbMovementByCode[code] = (tbMovementByCode[code] || 0) + (closingNet - openingNet);
        }
      }
    }
  }

  const allTbCodes = new Set([...Object.keys(tbOpeningByCode), ...Object.keys(tbClosingByCode)]);
  if (!usedDirectMovement) {
    for (const code of allTbCodes) {
      tbMovementByCode[code] = (tbClosingByCode[code] || 0) - (tbOpeningByCode[code] || 0);
    }
  }

  // Try to get GL data from ImportJournalLine first
  let glLines = await prisma.importJournalLine.findMany({
    where: { journalHeader: { engagementId } },
    select: { accountCode: true, debit: true, credit: true },
  });

  const glNetByCode: Record<string, number> = {};

  // Process ImportJournalLine if data exists
  if (glLines.length > 0) {
    for (const line of glLines) {
      const code = line.accountCode;
      const net = Number(line.debit || 0) - Number(line.credit || 0);
      glNetByCode[code] = (glNetByCode[code] || 0) + net;
    }
  } else {
    // Fallback to GLBatch/GLEntry if ImportJournalLine is empty
    const glBatch = await prisma.gLBatch.findFirst({
      where: { engagementId },
      orderBy: { createdAt: "desc" },
      include: { entries: true }
    });

    if (glBatch && glBatch.entries.length > 0) {
      for (const entry of glBatch.entries) {
        const code = entry.accountCode;
        const net = Number(entry.debit || 0) - Number(entry.credit || 0);
        glNetByCode[code] = (glNetByCode[code] || 0) + net;
      }
    }
  }

  const tbCodes = [...allTbCodes].sort();
  const glCodes = Object.keys(glNetByCode).sort();
  const tbCodeSet = new Set(tbCodes);
  const glCodeSet = new Set(glCodes);

  const duplicateGlCodes = Object.entries(tbCodeCount)
    .filter(([, count]) => count > 1)
    .map(([code]) => code)
    .sort();

  const unmatchedInTb = tbCodes.filter(c => !glCodeSet.has(c) && Math.abs(tbMovementByCode[c] || 0) >= 0.01);
  const unmatchedInGl = glCodes.filter(c => !tbCodeSet.has(c));

  const amountMismatches: { code: string; tbAmount: number; glAmount: number; difference: number }[] = [];
  for (const code of tbCodes) {
    if (!glCodeSet.has(code)) continue;
    const tbMovement = tbMovementByCode[code] || 0;
    const glAmt = glNetByCode[code] || 0;
    const diff = Math.abs(tbMovement - glAmt);
    if (diff >= 0.01) {
      amountMismatches.push({ code, tbAmount: tbMovement, glAmount: glAmt, difference: diff });
    }
  }

  const hasData = tbCodes.length > 0 || glCodes.length > 0;
  const isReconciled = hasData &&
    unmatchedInTb.length === 0 &&
    unmatchedInGl.length === 0 &&
    amountMismatches.length === 0 &&
    duplicateGlCodes.length === 0;

  return {
    tbCodes,
    glCodes,
    unmatchedInTb,
    unmatchedInGl,
    amountMismatches,
    duplicateGlCodes,
    isReconciled,
  };
}

function getPhaseRequirements(
  tbBalanced: boolean,
  glBalanced: boolean,
  tbGlReconciled: boolean,
  hasTB: boolean,
  hasGL: boolean,
): { phase: string; canTransition: boolean; blockers: string[] }[] {
  return [
    {
      phase: "PRE_PLANNING",
      canTransition: true,
      blockers: []
    },
    {
      phase: "PLANNING",
      canTransition: hasTB,
      blockers: !hasTB ? ["Trial Balance must be uploaded"] : []
    },
    {
      phase: "EXECUTION",
      canTransition: hasTB && tbBalanced && hasGL && glBalanced,
      blockers: [
        ...(!hasTB ? ["Trial Balance must be uploaded"] : []),
        ...(!tbBalanced ? ["Trial Balance must be balanced"] : []),
        ...(!hasGL ? ["General Ledger must be uploaded"] : []),
        ...(!glBalanced ? ["General Ledger must be balanced"] : []),
      ]
    },
    {
      phase: "FINALIZATION",
      canTransition: hasTB && hasGL && tbBalanced && glBalanced && tbGlReconciled,
      blockers: [
        ...(!hasTB ? ["Trial Balance must be uploaded"] : []),
        ...(!hasGL ? ["General Ledger must be uploaded"] : []),
        ...(!tbBalanced ? ["Trial Balance must be balanced"] : []),
        ...(!glBalanced ? ["General Ledger must be balanced"] : []),
        ...(!tbGlReconciled ? ["TB/GL code-wise reconciliation must pass"] : []),
      ]
    },
    {
      phase: "REPORTING",
      canTransition: hasTB && tbBalanced && hasGL && glBalanced && tbGlReconciled,
      blockers: [
        ...(!hasTB ? ["Trial Balance must be uploaded"] : []),
        ...(!tbBalanced ? ["Trial Balance must be balanced"] : []),
        ...(!hasGL ? ["General Ledger must be uploaded"] : []),
        ...(!glBalanced ? ["General Ledger must be balanced"] : []),
        ...(!tbGlReconciled ? ["TB/GL code-wise reconciliation must pass"] : []),
      ]
    },
    {
      phase: "EQCR",
      canTransition: hasTB && tbBalanced && hasGL && glBalanced,
      blockers: [
        ...(!hasTB ? ["Trial Balance must be uploaded"] : []),
        ...(!tbBalanced ? ["Trial Balance must be balanced"] : []),
        ...(!hasGL ? ["General Ledger must be uploaded"] : []),
        ...(!glBalanced ? ["General Ledger must be balanced"] : []),
      ]
    }
  ];
}

export async function validatePhaseTransition(
  engagementId: string,
  targetPhase: string
): Promise<{ canTransition: boolean; blockers: string[] }> {
  const status = await getReconciliationStatus(engagementId);
  
  const phaseReq = status.phaseRequirements.find(p => p.phase === targetPhase);
  if (!phaseReq) {
    return { canTransition: true, blockers: [] };
  }
  
  return {
    canTransition: phaseReq.canTransition,
    blockers: phaseReq.blockers
  };
}
