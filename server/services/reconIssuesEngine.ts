import { prisma } from "../db";
import { Decimal } from "@prisma/client/runtime/library";
import {
  reconcileTBvsGL,
  reconcileARControl,
  reconcileAPControl,
  reconcileBankControl,
} from "./glCodeReconciliationService";
import { runFullScan as runLinkIntegrityCheck, repairAllAutoRepairable } from "./linkIntegrityEngine";
import {
  ReconIssueSeverity,
  ReconIssueStatus,
  ReconIssueTab,
  ValidationStatus,
  DraftFSStatus,
} from "@prisma/client";
import crypto from "crypto";

export interface ScanResult {
  scanRunId: string;
  engagementId: string;
  issuesCreated: number;
  issuesByTab: Record<string, number>;
  issuesBySeverity: Record<string, number>;
  blockingCount: number;
  gateStatus: GateStatus;
  scannedAt: string;
}

export interface IssueSummary {
  total: number;
  byTab: Record<string, { high: number; medium: number; low: number; total: number }>;
  bySeverity: { high: number; medium: number; low: number };
  blocking: number;
  open: number;
}

export type GateValue = "PASS" | "FAIL" | "WARNING" | "NOT_RUN";

export interface GateStatus {
  tbBalanced: GateValue;
  glBalanced: GateValue;
  tbGlTieOut: GateValue;
  apReconciled: GateValue;
  arReconciled: GateValue;
  bankReconciled: GateValue;
  allCodesMapped: GateValue;
  mappingLocked: GateValue;
  bsFooting: GateValue;
  canApproveLock: boolean;
  canPushForward: boolean;
  lastScanAt: string | null;
}

interface IssueInput {
  engagementId: string;
  tab: ReconIssueTab;
  severity: ReconIssueSeverity;
  ruleCode: string;
  message: string;
  blocking: boolean;
  accountCode?: string;
  entityType?: string;
  entityId?: string;
  rowRef?: string;
  scanRunId: string;
}

function toNumber(value: Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  return Number(value);
}

export async function runFullScan(
  engagementId: string,
  userId: string
): Promise<ScanResult> {
  const scanRunId = crypto.randomUUID();

  const issues: IssueInput[] = [];

  // ── Step 1: TB Balance Check (CY/PY) ──
  const latestTBBatch = await prisma.tBBatch
    .findFirst({
      where: { engagementId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    })
    .catch(() => null);

  if (latestTBBatch) {
    const tbEntries = await prisma.tBEntry
      .findMany({
        where: { engagementId, batchId: latestTBBatch.id },
        select: {
          closingDebit: true,
          closingCredit: true,
          openingDebit: true,
          openingCredit: true,
        },
      })
      .catch(() => []);

    if (tbEntries.length > 0) {
      let totalClosingDebit = 0;
      let totalClosingCredit = 0;
      let totalOpeningDebit = 0;
      let totalOpeningCredit = 0;
      for (const entry of tbEntries) {
        totalClosingDebit += toNumber(entry.closingDebit);
        totalClosingCredit += toNumber(entry.closingCredit);
        totalOpeningDebit += toNumber(entry.openingDebit);
        totalOpeningCredit += toNumber(entry.openingCredit);
      }

      const cyDiff = Math.abs(totalClosingDebit - totalClosingCredit);
      if (cyDiff >= 1) {
        issues.push({
          engagementId,
          tab: ReconIssueTab.TB,
          severity: ReconIssueSeverity.HIGH,
          ruleCode: "TB_NOT_BALANCED_CY",
          message: `TB closing balance not balanced: Debit ${totalClosingDebit.toFixed(2)} vs Credit ${totalClosingCredit.toFixed(2)} (diff ${cyDiff.toFixed(2)})`,
          blocking: true,
          scanRunId,
        });
      }

      const pyDiff = Math.abs(totalOpeningDebit - totalOpeningCredit);
      if (pyDiff >= 1) {
        issues.push({
          engagementId,
          tab: ReconIssueTab.TB,
          severity: ReconIssueSeverity.HIGH,
          ruleCode: "TB_NOT_BALANCED_PY",
          message: `TB opening balance not balanced: Debit ${totalOpeningDebit.toFixed(2)} vs Credit ${totalOpeningCredit.toFixed(2)} (diff ${pyDiff.toFixed(2)})`,
          blocking: true,
          scanRunId,
        });
      }
    } else {
      issues.push({
        engagementId,
        tab: ReconIssueTab.TB,
        severity: ReconIssueSeverity.HIGH,
        ruleCode: "TB_NO_DATA",
        message: "No trial balance data found for this engagement",
        blocking: true,
        scanRunId,
      });
    }
  } else {
    issues.push({
      engagementId,
      tab: ReconIssueTab.TB,
      severity: ReconIssueSeverity.HIGH,
      ruleCode: "TB_NO_DATA",
      message: "No trial balance data found for this engagement",
      blocking: true,
      scanRunId,
    });
  }

  // ── Step 2: GL Balance Check (CY) + Duplicate Detection ──
  const glEntries = await prisma.gLEntry
    .findMany({
      where: { engagementId },
      select: {
        debit: true,
        credit: true,
        voucherNumber: true,
        rowNumber: true,
      },
    })
    .catch(() => []);

  if (glEntries.length > 0) {
    let totalDebit = 0;
    let totalCredit = 0;
    for (const gl of glEntries) {
      totalDebit += toNumber(gl.debit);
      totalCredit += toNumber(gl.credit);
    }

    const glDiff = Math.abs(totalDebit - totalCredit);
    if (glDiff >= 1) {
      issues.push({
        engagementId,
        tab: ReconIssueTab.GL,
        severity: ReconIssueSeverity.HIGH,
        ruleCode: "GL_NOT_BALANCED_CY",
        message: `GL not balanced: Debit ${totalDebit.toFixed(2)} vs Credit ${totalCredit.toFixed(2)} (diff ${glDiff.toFixed(2)})`,
        blocking: true,
        scanRunId,
      });
    }

    const docLineCount = new Map<string, number>();
    for (const gl of glEntries) {
      if (gl.voucherNumber) {
        const key = `${gl.voucherNumber}|${gl.rowNumber}`;
        docLineCount.set(key, (docLineCount.get(key) || 0) + 1);
      }
    }
    for (const [key, count] of docLineCount) {
      if (count > 1) {
        issues.push({
          engagementId,
          tab: ReconIssueTab.GL,
          severity: ReconIssueSeverity.HIGH,
          ruleCode: "GL_DUPLICATE_DOC_LINE",
          message: `Duplicate GL entry detected: ${key} appears ${count} times`,
          blocking: true,
          rowRef: key,
          scanRunId,
        });
      }
    }
  } else {
    issues.push({
      engagementId,
      tab: ReconIssueTab.GL,
      severity: ReconIssueSeverity.MEDIUM,
      ruleCode: "GL_NO_DATA",
      message: "No general ledger data found for this engagement",
      blocking: false,
      scanRunId,
    });
  }

  // ── Step 3-4: TB/GL Reconciliation + AR/AP/Bank Controls ──
  const [tbGlResult, arResult, apResult, bankResult] = await Promise.all([
    reconcileTBvsGL(engagementId).catch(() => null),
    reconcileARControl(engagementId).catch(() => null),
    reconcileAPControl(engagementId).catch(() => null),
    reconcileBankControl(engagementId).catch(() => null),
  ]);

  if (tbGlResult) {
    for (const item of tbGlResult.items) {
      if (item.status === "VARIANCE") {
        issues.push({
          engagementId,
          tab: ReconIssueTab.TB,
          severity: ReconIssueSeverity.HIGH,
          ruleCode: "TB_GL_VARIANCE",
          message: `TB/GL variance on ${item.glCode} (${item.glName}): diff ${item.difference.toFixed(2)}`,
          blocking: true,
          accountCode: item.glCode,
          scanRunId,
        });
      } else if (
        item.status === "MISSING_SOURCE" ||
        item.status === "MISSING_TARGET"
      ) {
        issues.push({
          engagementId,
          tab: ReconIssueTab.TB,
          severity: ReconIssueSeverity.MEDIUM,
          ruleCode: "TB_GL_MISSING",
          message: `TB/GL ${item.status === "MISSING_SOURCE" ? "missing in TB" : "missing in GL"}: ${item.glCode} (${item.glName})`,
          blocking: false,
          accountCode: item.glCode,
          scanRunId,
        });
      }
    }
  }

  if (arResult) {
    for (const item of arResult.items) {
      if (item.status === "VARIANCE") {
        issues.push({
          engagementId,
          tab: ReconIssueTab.AR,
          severity: ReconIssueSeverity.HIGH,
          ruleCode: "AR_CONTROL_VARIANCE",
          message: `AR control variance on ${item.glCode} (${item.glName}): diff ${item.difference.toFixed(2)}`,
          blocking: true,
          accountCode: item.glCode,
          scanRunId,
        });
      } else if (
        item.status === "MISSING_SOURCE" ||
        item.status === "MISSING_TARGET"
      ) {
        issues.push({
          engagementId,
          tab: ReconIssueTab.AR,
          severity: ReconIssueSeverity.MEDIUM,
          ruleCode: "AR_CONTROL_MISSING",
          message: `AR control ${item.status === "MISSING_SOURCE" ? "missing sub-ledger" : "missing control"}: ${item.glCode} (${item.glName})`,
          blocking: false,
          accountCode: item.glCode,
          scanRunId,
        });
      }
    }
  }

  if (apResult) {
    for (const item of apResult.items) {
      if (item.status === "VARIANCE") {
        issues.push({
          engagementId,
          tab: ReconIssueTab.AP,
          severity: ReconIssueSeverity.HIGH,
          ruleCode: "AP_CONTROL_VARIANCE",
          message: `AP control variance on ${item.glCode} (${item.glName}): diff ${item.difference.toFixed(2)}`,
          blocking: true,
          accountCode: item.glCode,
          scanRunId,
        });
      } else if (
        item.status === "MISSING_SOURCE" ||
        item.status === "MISSING_TARGET"
      ) {
        issues.push({
          engagementId,
          tab: ReconIssueTab.AP,
          severity: ReconIssueSeverity.MEDIUM,
          ruleCode: "AP_CONTROL_MISSING",
          message: `AP control ${item.status === "MISSING_SOURCE" ? "missing sub-ledger" : "missing control"}: ${item.glCode} (${item.glName})`,
          blocking: false,
          accountCode: item.glCode,
          scanRunId,
        });
      }
    }
  }

  if (bankResult) {
    for (const item of bankResult.items) {
      if (item.status === "VARIANCE") {
        issues.push({
          engagementId,
          tab: ReconIssueTab.BANK,
          severity: ReconIssueSeverity.HIGH,
          ruleCode: "BANK_CONTROL_VARIANCE",
          message: `Bank control variance on ${item.glCode} (${item.glName}): diff ${item.difference.toFixed(2)}`,
          blocking: true,
          accountCode: item.glCode,
          scanRunId,
        });
      } else if (
        item.status === "MISSING_SOURCE" ||
        item.status === "MISSING_TARGET"
      ) {
        issues.push({
          engagementId,
          tab: ReconIssueTab.BANK,
          severity: ReconIssueSeverity.MEDIUM,
          ruleCode: "BANK_CONTROL_MISSING",
          message: `Bank control ${item.status === "MISSING_SOURCE" ? "missing sub-ledger" : "missing control"}: ${item.glCode} (${item.glName})`,
          blocking: false,
          accountCode: item.glCode,
          scanRunId,
        });
      }
    }
  }

  // ── Step 5: Confirmations Completeness ──
  const [arPartyCount, apPartyCount] = await Promise.all([
    prisma.importPartyBalance
      .count({ where: { engagementId, partyType: { in: ["CUSTOMER", "AR"] } } })
      .catch(() => 0),
    prisma.importPartyBalance
      .count({ where: { engagementId, partyType: { in: ["SUPPLIER", "AP", "VENDOR"] } } })
      .catch(() => 0),
  ]);

  const confirmationPopulations = await prisma.confirmationPopulation
    .findMany({
      where: { engagementId },
      select: { id: true, status: true },
    })
    .catch(() => []);

  const externalConfirmations = await prisma.externalConfirmation
    .findMany({
      where: { engagementId },
      select: { id: true, status: true },
    })
    .catch(() => []);

  const hasDebtorsCreditors = arPartyCount > 0 || apPartyCount > 0;
  const hasConfirmations = confirmationPopulations.length > 0 || externalConfirmations.length > 0;

  if (hasDebtorsCreditors && !hasConfirmations) {
    issues.push({
      engagementId,
      tab: ReconIssueTab.CONFIRMATIONS,
      severity: ReconIssueSeverity.MEDIUM,
      ruleCode: "CONFIRMATIONS_MISSING",
      message: "Engagement has debtors/creditors but no confirmation requests have been created",
      blocking: false,
      scanRunId,
    });
  }

  if (externalConfirmations.length > 0) {
    const pendingConfirmations = externalConfirmations.filter(
      (c) => c.status !== "SENT" && c.status !== "RECEIVED"
    );
    if (pendingConfirmations.length > 0) {
      issues.push({
        engagementId,
        tab: ReconIssueTab.CONFIRMATIONS,
        severity: ReconIssueSeverity.MEDIUM,
        ruleCode: "CONFIRMATIONS_INCOMPLETE",
        message: `${pendingConfirmations.length} confirmation(s) have not been sent or received`,
        blocking: false,
        scanRunId,
      });
    }
  }

  const [mappingVersion, importBatchCount, coaAccounts, mappingAllocations] =
    await Promise.all([
      prisma.coAFSMappingVersion
        .findFirst({
          where: { engagementId },
          orderBy: { versionNumber: "desc" },
        })
        .catch(() => null),
      prisma.importBatch
        .count({ where: { engagementId } })
        .catch(() => 0),
      prisma.coAAccount
        .findMany({
          where: { engagementId },
          select: { accountCode: true, accountName: true },
        })
        .catch(() => []),
      prisma.mappingAllocation
        .findMany({
          where: { engagementId },
          select: { accountCode: true },
        })
        .catch(() => []),
    ]);

  if (importBatchCount === 0) {
    issues.push({
      engagementId,
      tab: ReconIssueTab.SUMMARY,
      severity: ReconIssueSeverity.HIGH,
      ruleCode: "NO_DATA_UPLOADED",
      message: "No data has been uploaded for this engagement",
      blocking: true,
      scanRunId,
    });
  }

  const mappedCodes = new Set(mappingAllocations.map((m) => m.accountCode));
  const unmappedAccounts = coaAccounts.filter(
    (a) => !mappedCodes.has(a.accountCode)
  );

  if (unmappedAccounts.length > 0) {
    for (const acct of unmappedAccounts) {
      issues.push({
        engagementId,
        tab: ReconIssueTab.MAPPING,
        severity: ReconIssueSeverity.HIGH,
        ruleCode: "COA_UNMAPPED",
        message: `CoA account ${acct.accountCode} (${acct.accountName}) is not mapped to any FS head`,
        blocking: true,
        accountCode: acct.accountCode,
        scanRunId,
      });
    }
  }

  if (!mappingVersion || mappingVersion.status !== "APPROVED") {
    const statusLabel = mappingVersion
      ? mappingVersion.status
      : "no version exists";
    issues.push({
      engagementId,
      tab: ReconIssueTab.MAPPING,
      severity: ReconIssueSeverity.HIGH,
      ruleCode: "MAPPING_NOT_APPROVED",
      message: `Mapping version is not approved (current: ${statusLabel})`,
      blocking: true,
      scanRunId,
    });
  }

  // ── Step 7: Draft FS Footing ──
  const latestSnapshot = await prisma.draftFSSnapshot
    .findFirst({
      where: { engagementId },
      orderBy: { generatedAt: "desc" },
      select: { bsFootingPass: true },
    })
    .catch(() => null);

  if (latestSnapshot) {
    if (!latestSnapshot.bsFootingPass) {
      issues.push({
        engagementId,
        tab: ReconIssueTab.DRAFT_FS,
        severity: ReconIssueSeverity.HIGH,
        ruleCode: "BS_FOOTING_FAIL",
        message: "Balance sheet footing check failed: Assets ≠ Liabilities + Equity",
        blocking: true,
        scanRunId,
      });
    }
  } else if (mappingVersion && mappingVersion.status === "APPROVED") {
    issues.push({
      engagementId,
      tab: ReconIssueTab.DRAFT_FS,
      severity: ReconIssueSeverity.MEDIUM,
      ruleCode: "DRAFT_FS_NO_SNAPSHOT",
      message: "Mapping is approved but no Draft FS snapshot has been generated",
      blocking: false,
      scanRunId,
    });
  }

  await prisma.reconIssue.deleteMany({
    where: {
      engagementId,
      scanRunId: { not: null },
    },
  });

  if (issues.length > 0) {
    await prisma.reconIssue.createMany({
      data: issues.map((i) => ({
        engagementId: i.engagementId,
        tab: i.tab,
        severity: i.severity,
        ruleCode: i.ruleCode,
        message: i.message,
        blocking: i.blocking,
        accountCode: i.accountCode || null,
        entityType: i.entityType || null,
        entityId: i.entityId || null,
        rowRef: i.rowRef || null,
        scanRunId: i.scanRunId,
        status: ReconIssueStatus.OPEN,
      })),
    });
  }

  const latestSummaryRun = await prisma.summaryRun
    .findFirst({
      where: { engagementId },
      orderBy: { createdAt: "desc" },
    })
    .catch(() => null);

  const tbBalanced: GateValue = latestSummaryRun
    ? (latestSummaryRun.tbArithmeticStatus as GateValue)
    : "NOT_RUN";
  const glBalanced: GateValue = latestSummaryRun
    ? (latestSummaryRun.glDrCrStatus as GateValue)
    : "NOT_RUN";
  const tbGlTieOut: GateValue = tbGlResult
    ? (tbGlResult.status as GateValue)
    : "NOT_RUN";
  const apReconciled: GateValue = apResult
    ? (apResult.status as GateValue)
    : "NOT_RUN";
  const arReconciled: GateValue = arResult
    ? (arResult.status as GateValue)
    : "NOT_RUN";
  const bankReconciled: GateValue = bankResult
    ? (bankResult.status as GateValue)
    : "NOT_RUN";

  const allCodesMapped: GateValue =
    coaAccounts.length === 0
      ? "NOT_RUN"
      : unmappedAccounts.length === 0
        ? "PASS"
        : "FAIL";

  const mappingLocked: GateValue = !mappingVersion
    ? "NOT_RUN"
    : mappingVersion.status === "APPROVED" || mappingVersion.status === "LOCKED"
      ? "PASS"
      : "FAIL";

  const bsFooting: GateValue = latestSnapshot
    ? latestSnapshot.bsFootingPass
      ? "PASS"
      : "FAIL"
    : "NOT_RUN";

  const canApproveLock =
    tbBalanced === "PASS" &&
    tbGlTieOut === "PASS" &&
    apReconciled !== "FAIL" &&
    arReconciled !== "FAIL" &&
    bankReconciled !== "FAIL" &&
    allCodesMapped === "PASS";

  const canPushForward =
    canApproveLock && mappingLocked === "PASS" && bsFooting === "PASS";

  const now = new Date();

  await prisma.reconGateStatus.upsert({
    where: { engagementId },
    create: {
      engagementId,
      tbBalanced: tbBalanced as ValidationStatus,
      glBalanced: glBalanced as ValidationStatus,
      tbGlTieOut: tbGlTieOut as ValidationStatus,
      apReconciled: apReconciled as ValidationStatus,
      arReconciled: arReconciled as ValidationStatus,
      bankReconciled: bankReconciled as ValidationStatus,
      allCodesMapped: allCodesMapped as ValidationStatus,
      mappingLocked: mappingLocked as ValidationStatus,
      bsFooting: bsFooting as ValidationStatus,
      canApproveLock,
      canPushForward,
      lastScanAt: now,
      lastScanById: userId,
    },
    update: {
      tbBalanced: tbBalanced as ValidationStatus,
      glBalanced: glBalanced as ValidationStatus,
      tbGlTieOut: tbGlTieOut as ValidationStatus,
      apReconciled: apReconciled as ValidationStatus,
      arReconciled: arReconciled as ValidationStatus,
      bankReconciled: bankReconciled as ValidationStatus,
      allCodesMapped: allCodesMapped as ValidationStatus,
      mappingLocked: mappingLocked as ValidationStatus,
      bsFooting: bsFooting as ValidationStatus,
      canApproveLock,
      canPushForward,
      lastScanAt: now,
      lastScanById: userId,
    },
  });

  const issuesByTab: Record<string, number> = {};
  const issuesBySeverity: Record<string, number> = {};
  for (const i of issues) {
    issuesByTab[i.tab] = (issuesByTab[i.tab] || 0) + 1;
    issuesBySeverity[i.severity] = (issuesBySeverity[i.severity] || 0) + 1;
  }

  return {
    scanRunId,
    engagementId,
    issuesCreated: issues.length,
    issuesByTab,
    issuesBySeverity,
    blockingCount: issues.filter((i) => i.blocking).length,
    gateStatus: {
      tbBalanced,
      glBalanced,
      tbGlTieOut,
      apReconciled,
      arReconciled,
      bankReconciled,
      allCodesMapped,
      mappingLocked,
      bsFooting,
      canApproveLock,
      canPushForward,
      lastScanAt: now.toISOString(),
    },
    scannedAt: now.toISOString(),
  };
}

export async function getIssues(
  engagementId: string,
  filters?: { tab?: string; severity?: string; status?: string }
) {
  const where: any = { engagementId };

  if (filters?.tab) {
    where.tab = filters.tab as ReconIssueTab;
  }
  if (filters?.severity) {
    where.severity = filters.severity as ReconIssueSeverity;
  }
  if (filters?.status) {
    where.status = filters.status as ReconIssueStatus;
  }

  return prisma.reconIssue.findMany({
    where,
    orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
  });
}

export async function getIssueSummary(
  engagementId: string
): Promise<IssueSummary> {
  const allIssues = await prisma.reconIssue.findMany({
    where: { engagementId },
    select: { tab: true, severity: true, status: true, blocking: true },
  });

  const byTab: Record<
    string,
    { high: number; medium: number; low: number; total: number }
  > = {};
  const bySeverity = { high: 0, medium: 0, low: 0 };
  let blocking = 0;
  let open = 0;

  for (const issue of allIssues) {
    if (!byTab[issue.tab]) {
      byTab[issue.tab] = { high: 0, medium: 0, low: 0, total: 0 };
    }
    byTab[issue.tab].total++;

    if (issue.severity === ReconIssueSeverity.HIGH) {
      byTab[issue.tab].high++;
      bySeverity.high++;
    } else if (issue.severity === ReconIssueSeverity.MEDIUM) {
      byTab[issue.tab].medium++;
      bySeverity.medium++;
    } else {
      byTab[issue.tab].low++;
      bySeverity.low++;
    }

    if (issue.blocking) blocking++;
    if (issue.status === ReconIssueStatus.OPEN) open++;
  }

  return {
    total: allIssues.length,
    byTab,
    bySeverity,
    blocking,
    open,
  };
}

export async function getGateStatus(
  engagementId: string
): Promise<GateStatus> {
  const existing = await prisma.reconGateStatus.findUnique({
    where: { engagementId },
  });

  if (existing) {
    return {
      tbBalanced: existing.tbBalanced as GateValue,
      glBalanced: existing.glBalanced as GateValue,
      tbGlTieOut: existing.tbGlTieOut as GateValue,
      apReconciled: existing.apReconciled as GateValue,
      arReconciled: existing.arReconciled as GateValue,
      bankReconciled: existing.bankReconciled as GateValue,
      allCodesMapped: existing.allCodesMapped as GateValue,
      mappingLocked: existing.mappingLocked as GateValue,
      bsFooting: existing.bsFooting as GateValue,
      canApproveLock: existing.canApproveLock,
      canPushForward: existing.canPushForward,
      lastScanAt: existing.lastScanAt?.toISOString() ?? null,
    };
  }

  return {
    tbBalanced: "NOT_RUN",
    glBalanced: "NOT_RUN",
    tbGlTieOut: "NOT_RUN",
    apReconciled: "NOT_RUN",
    arReconciled: "NOT_RUN",
    bankReconciled: "NOT_RUN",
    allCodesMapped: "NOT_RUN",
    mappingLocked: "NOT_RUN",
    bsFooting: "NOT_RUN",
    canApproveLock: false,
    canPushForward: false,
    lastScanAt: null,
  };
}

export async function resolveIssue(
  issueId: string,
  userId: string,
  notes?: string
) {
  return prisma.reconIssue.update({
    where: { id: issueId },
    data: {
      status: ReconIssueStatus.FIXED,
      resolvedById: userId,
      resolvedAt: new Date(),
      resolutionNotes: notes || null,
    },
  });
}

export async function suppressIssue(
  issueId: string,
  userId: string,
  notes: string
) {
  return prisma.reconIssue.update({
    where: { id: issueId },
    data: {
      status: ReconIssueStatus.SUPPRESSED,
      resolvedById: userId,
      resolvedAt: new Date(),
      resolutionNotes: notes,
    },
  });
}

export async function generateDraftFSSnapshot(
  engagementId: string,
  userId: string
) {
  const assetKeywords = ['CASH', 'RECEIVABLES', 'INVENTORIES', 'PPE', 'INTANGIBLE', 'INVESTMENTS', 'ASSET', 'RIGHT_OF_USE', 'DEFERRED_TAX_ASSETS', 'PREPAYMENTS'];
  const liabilityKeywords = ['PAYABLES', 'BORROWINGS', 'LIABILITIES', 'DEFERRED_TAX', 'PROVISIONS', 'ACCRUALS', 'TAX_LIABILITIES'];
  const equityKeywords = ['CAPITAL', 'RESERVES', 'SURPLUS', 'EQUITY', 'RETAINED_EARNINGS'];
  const incomeKeywords = ['REVENUE', 'INCOME', 'SALES'];
  const expenseKeywords = ['COST', 'EXPENSE', 'DEPRECIATION', 'FINANCE_COSTS', 'TAX_EXPENSE', 'EMPLOYEE', 'ADMINISTRATIVE', 'SELLING'];

  const classifyFsLineItem = (fsLineItem: string): string => {
    const upper = fsLineItem.toUpperCase();
    if (assetKeywords.some(kw => upper.includes(kw))) return 'Assets';
    if (liabilityKeywords.some(kw => upper.includes(kw))) return 'Liabilities';
    if (equityKeywords.some(kw => upper.includes(kw))) return 'Equity';
    if (incomeKeywords.some(kw => upper.includes(kw))) return 'Income';
    if (expenseKeywords.some(kw => upper.includes(kw))) return 'Expenses';
    return 'Other';
  };

  const allocations = await prisma.mappingAllocation.findMany({
    where: { engagementId },
    include: {
      fsHead: {
        select: {
          id: true,
          code: true,
          name: true,
          statementType: true,
          netBalance: true,
        },
      },
    },
  });

  const coaAccounts = await prisma.coAAccount.findMany({
    where: { engagementId },
    select: {
      accountCode: true,
      accountName: true,
      closingBalance: true,
      nature: true,
      fsLineItem: true,
    },
  });

  const balanceByCode = new Map<string, number>();
  for (const acct of coaAccounts) {
    balanceByCode.set(acct.accountCode, toNumber(acct.closingBalance));
  }

  const categoryTotals: Record<string, number> = {
    Assets: 0,
    Liabilities: 0,
    Equity: 0,
    Income: 0,
    Expenses: 0,
  };

  const snapshotLines: Array<{
    fsHeadCode: string;
    fsHeadName: string;
    statementType: string;
    category: string;
    accountCode: string;
    allocationPct: number;
    allocatedAmount: number;
  }> = [];

  if (allocations.length > 0) {
    for (const alloc of allocations) {
      const rawBalance = balanceByCode.get(alloc.accountCode) || 0;
      const pct = toNumber(alloc.allocationPct) / 100;

      const combined = `${alloc.fsHead.code} ${alloc.fsHead.name}`.toUpperCase();
      let category: string;

      if (alloc.fsHead.statementType === "PL") {
        if (expenseKeywords.some(kw => combined.includes(kw))) {
          category = "Expenses";
        } else if (incomeKeywords.some(kw => combined.includes(kw))) {
          category = "Income";
        } else {
          category = "Expenses";
        }
      } else if (alloc.fsHead.statementType === "BS") {
        if (liabilityKeywords.some(kw => combined.includes(kw))) {
          category = "Liabilities";
        } else if (equityKeywords.some(kw => combined.includes(kw))) {
          category = "Equity";
        } else {
          category = "Assets";
        }
      } else {
        category = classifyFsLineItem(alloc.fsHead.code) || "Other";
      }

      const isCreditNormal = category === "Liabilities" || category === "Equity" || category === "Income";
      const balance = isCreditNormal ? -rawBalance : rawBalance;
      const allocatedAmount = balance * pct;

      if (categoryTotals[category] !== undefined) {
        categoryTotals[category] += allocatedAmount;
      }

      snapshotLines.push({
        fsHeadCode: alloc.fsHead.code,
        fsHeadName: alloc.fsHead.name,
        statementType: alloc.fsHead.statementType,
        category,
        accountCode: alloc.accountCode,
        allocationPct: toNumber(alloc.allocationPct),
        allocatedAmount,
      });
    }
  } else {
    for (const acct of coaAccounts) {
      if (!acct.fsLineItem) continue;
      const balance = toNumber(acct.closingBalance);
      const category = classifyFsLineItem(acct.fsLineItem);

      if (category === 'Assets') {
        categoryTotals.Assets += balance;
      } else if (category === 'Liabilities') {
        categoryTotals.Liabilities += Math.abs(balance);
      } else if (category === 'Equity') {
        categoryTotals.Equity += Math.abs(balance);
      } else if (category === 'Income') {
        categoryTotals.Income += Math.abs(balance);
      } else if (category === 'Expenses') {
        categoryTotals.Expenses += balance;
      }

      const stType = (category === 'Income' || category === 'Expenses') ? 'PL' : 'BS';
      snapshotLines.push({
        fsHeadCode: acct.accountCode,
        fsHeadName: acct.fsLineItem,
        statementType: stType,
        category,
        accountCode: acct.accountCode,
        allocationPct: 100,
        allocatedAmount: balance,
      });
    }
  }

  const totalAssets = categoryTotals.Assets;
  const totalLiabilities = categoryTotals.Liabilities;
  const totalEquity = categoryTotals.Equity;
  const totalIncome = categoryTotals.Income;
  const totalExpenses = categoryTotals.Expenses;
  const netIncome = totalIncome - totalExpenses;

  const bsFootingDiff = Math.abs(
    totalAssets - (totalLiabilities + totalEquity + netIncome)
  );
  const bsFootingPass = bsFootingDiff <= 1.0;

  const lastSnapshot = await prisma.draftFSSnapshot
    .findFirst({
      where: { engagementId },
      orderBy: { runNumber: "desc" },
      select: { runNumber: true },
    })
    .catch(() => null);

  const runNumber = (lastSnapshot?.runNumber || 0) + 1;

  const mappingVersion = await prisma.coAFSMappingVersion
    .findFirst({
      where: { engagementId },
      orderBy: { versionNumber: "desc" },
      select: { id: true },
    })
    .catch(() => null);

  const snapshot = await prisma.draftFSSnapshot.create({
    data: {
      engagementId,
      runNumber,
      status: DraftFSStatus.GENERATED,
      totalAssets: new Decimal(totalAssets.toFixed(2)),
      totalLiabilities: new Decimal(totalLiabilities.toFixed(2)),
      totalEquity: new Decimal(totalEquity.toFixed(2)),
      totalIncome: new Decimal(totalIncome.toFixed(2)),
      totalExpenses: new Decimal(totalExpenses.toFixed(2)),
      netIncome: new Decimal(netIncome.toFixed(2)),
      bsFootingPass,
      bsFootingDiff: new Decimal(bsFootingDiff.toFixed(2)),
      mappingVersionId: mappingVersion?.id || null,
      snapshotData: {
        lines: snapshotLines,
        categoryTotals,
      },
      generatedById: userId,
      generatedAt: new Date(),
    },
  });

  const bsFootingStatus = bsFootingPass ? ValidationStatus.PASS : ValidationStatus.FAIL;
  await prisma.reconGateStatus
    .upsert({
      where: { engagementId },
      create: {
        engagementId,
        bsFooting: bsFootingStatus,
        lastScanById: userId,
      },
      update: { bsFooting: bsFootingStatus },
    })
    .catch(err => console.error("Recon gate status upsert (BS footing) failed:", err));

  return snapshot;
}

export async function autoFixDeterministic(
  engagementId: string,
  userId: string
): Promise<{
  fixed: number;
  needsReview: number;
  details: Array<{ ruleCode: string; action: string; status: string }>;
}> {
  const openIssues = await prisma.reconIssue.findMany({
    where: {
      engagementId,
      status: ReconIssueStatus.OPEN,
    },
  });

  const details: Array<{ ruleCode: string; action: string; status: string }> = [];
  let fixed = 0;
  let needsReview = 0;

  for (const issue of openIssues) {
    if (issue.ruleCode === "GL_DUPLICATE_DOC_LINE") {
      needsReview++;
      details.push({
        ruleCode: issue.ruleCode,
        action: "Marked for manual review — duplicate entries require user decision",
        status: "NEEDS_REVIEW",
      });
      await prisma.reconIssue.update({
        where: { id: issue.id },
        data: {
          status: ReconIssueStatus.OPEN,
          resolutionNotes: "Auto-fix: requires manual review to resolve duplicates",
        },
      });
    } else if (issue.ruleCode === "TB_GL_MISSING") {
      needsReview++;
      details.push({
        ruleCode: issue.ruleCode,
        action: "Flagged for link integrity repair",
        status: "NEEDS_REVIEW",
      });
    }
  }

  const repairResult = await repairAllAutoRepairable(engagementId).catch(() => []);
  for (const repaired of repairResult) {
    if (repaired.status === "AUTO_REPAIRED") {
      fixed++;
      details.push({
        ruleCode: repaired.category,
        action: repaired.repairAction || "Auto-repaired structural issue",
        status: "FIXED",
      });
    } else {
      needsReview++;
      details.push({
        ruleCode: repaired.category,
        action: repaired.description,
        status: "NEEDS_REVIEW",
      });
    }
  }

  return { fixed, needsReview, details };
}
