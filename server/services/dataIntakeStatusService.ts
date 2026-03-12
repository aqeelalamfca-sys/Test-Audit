import { prisma } from "../db";
import { Decimal } from "@prisma/client/runtime/library";
import {
  reconcileTBvsGL,
  reconcileARControl,
  reconcileAPControl,
  reconcileBankControl,
} from "./glCodeReconciliationService";

function toNumber(value: Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  return Number(value);
}

export type ModuleStatus =
  | "NOT_STARTED"
  | "UPLOADED"
  | "VALIDATED"
  | "RECONCILED"
  | "MAPPED"
  | "EXCEPTION_PENDING"
  | "READY"
  | "COMPLETED";

export interface ModuleStatusDetail {
  status: ModuleStatus;
  label: string;
  recordCount: number;
  lastUpdated: string | null;
  exceptions: number;
  completionPct: number;
  nextAction: string | null;
}

export interface DataIntakeStatus {
  engagementId: string;
  overallStatus: ModuleStatus;
  overallCompletionPct: number;
  dataQualityScore: number;
  totalExceptions: number;
  blockingExceptions: number;
  lastScanAt: string | null;
  modules: {
    import: ModuleStatusDetail;
    trialBalance: ModuleStatusDetail;
    generalLedger: ModuleStatusDetail;
    accountsReceivable: ModuleStatusDetail;
    accountsPayable: ModuleStatusDetail;
    bank: ModuleStatusDetail;
    confirmations: ModuleStatusDetail;
    fsMapping: ModuleStatusDetail;
    draftFS: ModuleStatusDetail;
  };
  reconciliation: {
    tbBalanced: GateVal;
    glBalanced: GateVal;
    tbGlTieOut: GateVal;
    arControl: GateVal;
    apControl: GateVal;
    bankControl: GateVal;
    allCodesMapped: GateVal;
    bsFooting: GateVal;
  };
  canComplete: boolean;
  completionBlockers: string[];
}

type GateVal = "PASS" | "FAIL" | "WARNING" | "NOT_RUN";

export async function getDataIntakeStatus(engagementId: string): Promise<DataIntakeStatus> {
  const [
    importBatches,
    tbBatch,
    tbEntryCount,
    glEntryCount,
    arCount,
    apCount,
    bankCount,
    confirmationCount,
    coaCount,
    mappedCount,
    mappingVersion,
    draftSnapshot,
    reconGate,
    openIssues,
    blockingIssues,
    summaryRun,
  ] = await Promise.all([
    prisma.importBatch.findMany({
      where: { engagementId },
      orderBy: { createdAt: "desc" },
      take: 1,
      select: { id: true, createdAt: true, status: true, totalRows: true, processedRows: true, errorCount: true },
    }).catch(() => []),
    prisma.tBBatch.findFirst({
      where: { engagementId },
      orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true },
    }).catch(() => null),
    prisma.tBEntry.count({ where: { engagementId } }).catch(() => 0),
    prisma.gLEntry.count({ where: { engagementId } }).catch(() => 0),
    prisma.importPartyBalance.count({
      where: { engagementId, partyType: { in: ["CUSTOMER", "AR"] } },
    }).catch(() => 0),
    prisma.importPartyBalance.count({
      where: { engagementId, partyType: { in: ["VENDOR", "AP", "SUPPLIER"] } },
    }).catch(() => 0),
    prisma.importBankBalance.count({ where: { engagementId } }).catch(() => 0),
    prisma.externalConfirmation.count({ where: { engagementId } }).catch(() => 0),
    prisma.coAAccount.count({ where: { engagementId } }).catch(() => 0),
    prisma.mappingAllocation.count({ where: { engagementId } }).catch(() => 0),
    prisma.coAFSMappingVersion.findFirst({
      where: { engagementId },
      orderBy: { versionNumber: "desc" },
      select: { id: true, status: true, updatedAt: true },
    }).catch(() => null),
    prisma.draftFSSnapshot.findFirst({
      where: { engagementId },
      orderBy: { generatedAt: "desc" },
      select: { id: true, bsFootingPass: true, generatedAt: true, status: true },
    }).catch(() => null),
    prisma.reconGateStatus.findUnique({ where: { engagementId } }).catch(() => null),
    prisma.reconIssue.count({
      where: { engagementId, status: "OPEN" },
    }).catch(() => 0),
    prisma.reconIssue.count({
      where: { engagementId, status: "OPEN", blocking: true },
    }).catch(() => 0),
    prisma.summaryRun.findFirst({
      where: { engagementId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, tbArithmeticStatus: true, glDrCrStatus: true },
    }).catch(() => null),
  ]);

  const latestBatch = importBatches[0] || null;
  const hasImport = !!latestBatch;
  const hasTB = tbEntryCount > 0;
  const hasGL = glEntryCount > 0;
  const hasAR = arCount > 0;
  const hasAP = apCount > 0;
  const hasBank = bankCount > 0;
  const hasCoa = coaCount > 0;
  const hasMapping = mappedCount > 0;
  const hasDraftFS = !!draftSnapshot;

  const tbBalanced: GateVal = reconGate?.tbBalanced as GateVal || (summaryRun?.tbArithmeticStatus as GateVal) || "NOT_RUN";
  const glBalanced: GateVal = reconGate?.glBalanced as GateVal || (summaryRun?.glDrCrStatus as GateVal) || "NOT_RUN";
  const tbGlTieOut: GateVal = reconGate?.tbGlTieOut as GateVal || "NOT_RUN";
  const arControl: GateVal = reconGate?.arReconciled as GateVal || "NOT_RUN";
  const apControl: GateVal = reconGate?.apReconciled as GateVal || "NOT_RUN";
  const bankControl: GateVal = reconGate?.bankReconciled as GateVal || "NOT_RUN";
  const allCodesMapped: GateVal = reconGate?.allCodesMapped as GateVal || (coaCount === 0 ? "NOT_RUN" : mappedCount >= coaCount ? "PASS" : "FAIL");
  const bsFooting: GateVal = reconGate?.bsFooting as GateVal || (draftSnapshot?.bsFootingPass ? "PASS" : draftSnapshot ? "FAIL" : "NOT_RUN");

  function computeModuleStatus(
    hasData: boolean,
    count: number,
    isBalanced: GateVal,
    isReconciled: GateVal,
    exceptions: number
  ): ModuleStatus {
    if (!hasData) return "NOT_STARTED";
    if (exceptions > 0) return "EXCEPTION_PENDING";
    if (isReconciled === "PASS") return "RECONCILED";
    if (isBalanced === "PASS") return "VALIDATED";
    return "UPLOADED";
  }

  const issuesByTab = await prisma.reconIssue.groupBy({
    by: ["tab"],
    where: { engagementId, status: "OPEN" },
    _count: { id: true },
  }).catch(() => []);

  const exceptionsMap: Record<string, number> = {};
  for (const g of issuesByTab) {
    exceptionsMap[g.tab] = g._count.id;
  }

  const tbExceptions = (exceptionsMap["TB"] || 0);
  const glExceptions = (exceptionsMap["GL"] || 0);
  const arExceptions = (exceptionsMap["AR"] || 0);
  const apExceptions = (exceptionsMap["AP"] || 0);
  const bankExceptions = (exceptionsMap["BANK"] || 0);
  const confirmExceptions = (exceptionsMap["CONFIRMATIONS"] || 0);
  const mappingExceptions = (exceptionsMap["MAPPING"] || 0);
  const draftFsExceptions = (exceptionsMap["DRAFT_FS"] || 0);

  const importModule: ModuleStatusDetail = {
    status: hasImport ? "UPLOADED" : "NOT_STARTED",
    label: "Import",
    recordCount: latestBatch?.totalRows || 0,
    lastUpdated: latestBatch?.createdAt?.toISOString() || null,
    exceptions: 0,
    completionPct: hasImport ? 100 : 0,
    nextAction: hasImport ? null : "Upload data workbook",
  };

  const tbModule: ModuleStatusDetail = {
    status: computeModuleStatus(hasTB, tbEntryCount, tbBalanced, tbGlTieOut, tbExceptions),
    label: "Trial Balance",
    recordCount: tbEntryCount,
    lastUpdated: tbBatch?.createdAt?.toISOString() || null,
    exceptions: tbExceptions,
    completionPct: !hasTB ? 0 : tbBalanced === "PASS" ? (tbGlTieOut === "PASS" ? 100 : 75) : 50,
    nextAction: !hasTB ? "Upload trial balance" : tbBalanced !== "PASS" ? "Fix TB balance differences" : tbGlTieOut !== "PASS" ? "Reconcile TB with GL" : null,
  };

  const glModule: ModuleStatusDetail = {
    status: computeModuleStatus(hasGL, glEntryCount, glBalanced, tbGlTieOut, glExceptions),
    label: "General Ledger",
    recordCount: glEntryCount,
    lastUpdated: null,
    exceptions: glExceptions,
    completionPct: !hasGL ? 0 : glBalanced === "PASS" ? (tbGlTieOut === "PASS" ? 100 : 75) : 50,
    nextAction: !hasGL ? "Upload general ledger" : glBalanced !== "PASS" ? "Fix GL balance differences" : null,
  };

  const arModule: ModuleStatusDetail = {
    status: !hasAR ? "NOT_STARTED" : arControl === "PASS" ? "RECONCILED" : arExceptions > 0 ? "EXCEPTION_PENDING" : "UPLOADED",
    label: "Accounts Receivable",
    recordCount: arCount,
    lastUpdated: null,
    exceptions: arExceptions,
    completionPct: !hasAR ? 0 : arControl === "PASS" ? 100 : 50,
    nextAction: !hasAR ? (hasTB ? "Upload AR sub-ledger" : null) : arControl !== "PASS" ? "Resolve AR control differences" : null,
  };

  const apModule: ModuleStatusDetail = {
    status: !hasAP ? "NOT_STARTED" : apControl === "PASS" ? "RECONCILED" : apExceptions > 0 ? "EXCEPTION_PENDING" : "UPLOADED",
    label: "Accounts Payable",
    recordCount: apCount,
    lastUpdated: null,
    exceptions: apExceptions,
    completionPct: !hasAP ? 0 : apControl === "PASS" ? 100 : 50,
    nextAction: !hasAP ? (hasTB ? "Upload AP sub-ledger" : null) : apControl !== "PASS" ? "Resolve AP control differences" : null,
  };

  const bankModule: ModuleStatusDetail = {
    status: !hasBank ? "NOT_STARTED" : bankControl === "PASS" ? "RECONCILED" : bankExceptions > 0 ? "EXCEPTION_PENDING" : "UPLOADED",
    label: "Bank",
    recordCount: bankCount,
    lastUpdated: null,
    exceptions: bankExceptions,
    completionPct: !hasBank ? 0 : bankControl === "PASS" ? 100 : 50,
    nextAction: !hasBank ? (hasTB ? "Upload bank data" : null) : bankControl !== "PASS" ? "Resolve bank control differences" : null,
  };

  const confirmModule: ModuleStatusDetail = {
    status: confirmationCount === 0 ? "NOT_STARTED" : confirmExceptions > 0 ? "EXCEPTION_PENDING" : "READY",
    label: "Confirmations",
    recordCount: confirmationCount,
    lastUpdated: null,
    exceptions: confirmExceptions,
    completionPct: confirmationCount === 0 ? 0 : confirmExceptions > 0 ? 50 : 100,
    nextAction: confirmationCount === 0 ? "Generate confirmation requests" : null,
  };

  const mappingPct = coaCount > 0 ? Math.round((mappedCount / coaCount) * 100) : 0;
  const isMappingApproved = mappingVersion?.status === "APPROVED" || mappingVersion?.status === "LOCKED";
  const fsMappingModule: ModuleStatusDetail = {
    status: !hasCoa ? "NOT_STARTED"
      : isMappingApproved ? "COMPLETED"
      : mappingPct === 100 ? "READY"
      : mappingPct > 0 ? "MAPPED"
      : mappingExceptions > 0 ? "EXCEPTION_PENDING"
      : "UPLOADED",
    label: "FS Mapping",
    recordCount: mappedCount,
    lastUpdated: mappingVersion?.updatedAt?.toISOString() || null,
    exceptions: mappingExceptions,
    completionPct: isMappingApproved ? 100 : mappingPct,
    nextAction: !hasCoa ? null
      : mappingPct < 100 ? `Map ${coaCount - mappedCount} unmapped accounts`
      : !isMappingApproved ? "Approve mapping version"
      : null,
  };

  const draftFSModule: ModuleStatusDetail = {
    status: !hasDraftFS ? "NOT_STARTED"
      : draftSnapshot?.bsFootingPass ? "COMPLETED"
      : draftFsExceptions > 0 ? "EXCEPTION_PENDING"
      : "UPLOADED",
    label: "Draft Financial Statements",
    recordCount: hasDraftFS ? 1 : 0,
    lastUpdated: draftSnapshot?.generatedAt?.toISOString() || null,
    exceptions: draftFsExceptions,
    completionPct: !hasDraftFS ? 0 : draftSnapshot?.bsFootingPass ? 100 : 50,
    nextAction: !hasDraftFS ? (isMappingApproved ? "Generate Draft FS" : "Complete FS Mapping first")
      : !draftSnapshot?.bsFootingPass ? "Fix balance sheet footing differences" : null,
  };

  const moduleStatuses = [
    importModule, tbModule, glModule, arModule, apModule,
    bankModule, confirmModule, fsMappingModule, draftFSModule,
  ];

  const coreModules = [importModule, tbModule, glModule, fsMappingModule, draftFSModule];
  const overallCompletionPct = Math.round(
    coreModules.reduce((sum, m) => sum + m.completionPct, 0) / coreModules.length
  );

  const completionBlockers: string[] = [];
  if (!hasTB) completionBlockers.push("Trial Balance not uploaded");
  if (tbBalanced !== "PASS" && hasTB) completionBlockers.push("Trial Balance not balanced");
  if (!hasGL) completionBlockers.push("General Ledger not uploaded");
  if (tbGlTieOut === "FAIL") completionBlockers.push("TB and GL not reconciled");
  if (allCodesMapped !== "PASS" && hasCoa) completionBlockers.push("Not all accounts mapped to FS heads");
  if (!isMappingApproved && hasCoa) completionBlockers.push("Mapping version not approved");
  if (bsFooting === "FAIL") completionBlockers.push("Balance sheet footing check failed");
  if (blockingIssues > 0) completionBlockers.push(`${blockingIssues} blocking exception(s) remain open`);

  const canComplete = completionBlockers.length === 0 && hasTB && hasGL && hasDraftFS;

  let dataQualityScore = 100;
  if (!hasTB) dataQualityScore -= 30;
  else if (tbBalanced !== "PASS") dataQualityScore -= 20;
  if (!hasGL) dataQualityScore -= 20;
  else if (glBalanced !== "PASS") dataQualityScore -= 15;
  if (tbGlTieOut === "FAIL") dataQualityScore -= 15;
  if (allCodesMapped === "FAIL") dataQualityScore -= 10;
  if (bsFooting === "FAIL") dataQualityScore -= 10;
  if (blockingIssues > 0) dataQualityScore -= Math.min(10, blockingIssues * 2);
  dataQualityScore = Math.max(0, dataQualityScore);

  const statusPriority: ModuleStatus[] = ["NOT_STARTED", "UPLOADED", "EXCEPTION_PENDING", "VALIDATED", "RECONCILED", "MAPPED", "READY", "COMPLETED"];
  let overallStatus: ModuleStatus = "COMPLETED";
  for (const m of coreModules) {
    const idx = statusPriority.indexOf(m.status);
    const currentIdx = statusPriority.indexOf(overallStatus);
    if (idx < currentIdx) overallStatus = m.status;
  }

  return {
    engagementId,
    overallStatus,
    overallCompletionPct,
    dataQualityScore,
    totalExceptions: openIssues,
    blockingExceptions: blockingIssues,
    lastScanAt: reconGate?.lastScanAt?.toISOString() || null,
    modules: {
      import: importModule,
      trialBalance: tbModule,
      generalLedger: glModule,
      accountsReceivable: arModule,
      accountsPayable: apModule,
      bank: bankModule,
      confirmations: confirmModule,
      fsMapping: fsMappingModule,
      draftFS: draftFSModule,
    },
    reconciliation: {
      tbBalanced,
      glBalanced,
      tbGlTieOut,
      arControl,
      apControl,
      bankControl,
      allCodesMapped,
      bsFooting,
    },
    canComplete,
    completionBlockers,
  };
}

export async function triggerPostImportReconciliation(
  engagementId: string,
  userId: string
): Promise<{ scanTriggered: boolean; message: string }> {
  try {
    const { runFullScan } = await import("./reconIssuesEngine");
    const result = await runFullScan(engagementId, userId);
    return {
      scanTriggered: true,
      message: `Reconciliation scan completed: ${result.issuesCreated} issues found (${result.blockingCount} blocking)`,
    };
  } catch (error) {
    console.error("Post-import reconciliation failed:", error);
    return {
      scanTriggered: false,
      message: "Reconciliation scan failed - will retry on next access",
    };
  }
}
