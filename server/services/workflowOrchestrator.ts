import { prisma } from "../db";
import type { WorkflowPhase, GateStatus, ExceptionTaxonomy } from "@prisma/client";

const PHASE_CONFIG: { phase: WorkflowPhase; index: number; label: string; owner: string }[] = [
  { phase: "UPLOAD_PROFILE", index: 0, label: "Upload & Profiling", owner: "AI + Staff" },
  { phase: "DATA_QUALITY", index: 1, label: "Data Quality & Standardization", owner: "AI + Staff" },
  { phase: "TB_GL_RECON", index: 2, label: "TB ↔ GL Reconciliation", owner: "AI + Manager" },
  { phase: "FS_MAPPING", index: 3, label: "FS Mapping & Lead Schedules", owner: "AI + Manager" },
  { phase: "PLANNING_ANALYTICS", index: 4, label: "Analytics, Materiality & Risk", owner: "AI + Partner" },
  { phase: "SAMPLING", index: 5, label: "Population Build & Sampling", owner: "AI + Manager" },
  { phase: "EXECUTION_WP", index: 6, label: "Execution Workpapers", owner: "Staff + Manager" },
  { phase: "COMPLETION", index: 7, label: "Completion & Reporting", owner: "AI + Partner" },
];

export interface PhaseStatusResult {
  phase: WorkflowPhase;
  phaseIndex: number;
  label: string;
  owner: string;
  gateStatus: GateStatus;
  score: number | null;
  scoreLabel: string | null;
  blockerCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  totalExceptions: number;
  aiSummary: string | null;
  highlights: any;
  approvedById: string | null;
  approvedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
}

export interface WorkflowDashboard {
  engagementId: string;
  engagementCode: string;
  overallProgress: number;
  phasesCompleted: number;
  totalPhases: number;
  currentBlockers: number;
  phases: PhaseStatusResult[];
  recentExceptions: any[];
}

export async function computeWorkflowDashboard(engagementId: string): Promise<WorkflowDashboard> {
  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    select: {
      id: true,
      engagementCode: true,
      periodStart: true,
      periodEnd: true,
      fiscalYearEnd: true,
    },
  });

  if (!engagement) throw new Error("Engagement not found");

  const phases: PhaseStatusResult[] = [];
  let totalBlockers = 0;
  let completedCount = 0;

  for (const cfg of PHASE_CONFIG) {
    const result = await computePhaseStatus(engagementId, cfg.phase, cfg.index);
    phases.push({
      ...result,
      label: cfg.label,
      owner: cfg.owner,
    });
    if (result.gateStatus === "BLOCKED") totalBlockers += result.blockerCount;
    if (result.gateStatus === "PASSED" || result.gateStatus === "APPROVED") completedCount++;
  }

  const recentExceptions = await prisma.workflowException.findMany({
    where: { engagementId, status: "OPEN" },
    orderBy: [{ taxonomy: "asc" }, { createdAt: "desc" }],
    take: 20,
  });

  return {
    engagementId: engagement.id,
    engagementCode: engagement.engagementCode,
    overallProgress: Math.round((completedCount / PHASE_CONFIG.length) * 100),
    phasesCompleted: completedCount,
    totalPhases: PHASE_CONFIG.length,
    currentBlockers: totalBlockers,
    phases,
    recentExceptions,
  };
}

async function computePhaseStatus(
  engagementId: string,
  phase: WorkflowPhase,
  phaseIndex: number
): Promise<PhaseStatusResult> {
  const existing = await prisma.workflowPhaseStatus.findUnique({
    where: { engagementId_phase: { engagementId, phase } },
  });

  const exceptions = await prisma.workflowException.groupBy({
    by: ["taxonomy"],
    where: { engagementId, phase, status: "OPEN" },
    _count: true,
  });

  const counts = { blocker: 0, high: 0, medium: 0, low: 0 };
  for (const e of exceptions) {
    if (e.taxonomy === "S1_BLOCKER") counts.blocker = e._count;
    else if (e.taxonomy === "S2_HIGH") counts.high = e._count;
    else if (e.taxonomy === "S3_MEDIUM") counts.medium = e._count;
    else if (e.taxonomy === "S4_LOW") counts.low = e._count;
  }

  let computed: { gateStatus: GateStatus; score: number | null; scoreLabel: string | null; aiSummary: string | null; highlights: any } = {
    gateStatus: "NOT_STARTED",
    score: null,
    scoreLabel: null,
    aiSummary: null,
    highlights: null,
  };

  switch (phase) {
    case "UPLOAD_PROFILE":
      computed = await computeUploadProfileStatus(engagementId);
      break;
    case "DATA_QUALITY":
      computed = await computeDataQualityStatus(engagementId);
      break;
    case "TB_GL_RECON":
      computed = await computeTBGLReconStatus(engagementId);
      break;
    case "FS_MAPPING":
      computed = await computeFSMappingStatus(engagementId);
      break;
    case "PLANNING_ANALYTICS":
      computed = await computePlanningStatus(engagementId);
      break;
    case "SAMPLING":
      computed = await computeSamplingStatus(engagementId);
      break;
    case "EXECUTION_WP":
      computed = await computeExecutionStatus(engagementId);
      break;
    case "COMPLETION":
      computed = await computeCompletionStatus(engagementId);
      break;
  }

  if (counts.blocker > 0 && computed.gateStatus !== "NOT_STARTED") {
    computed.gateStatus = "BLOCKED";
  }

  await prisma.workflowPhaseStatus.upsert({
    where: { engagementId_phase: { engagementId, phase } },
    update: {
      gateStatus: computed.gateStatus,
      score: computed.score,
      scoreLabel: computed.scoreLabel,
      totalExceptions: counts.blocker + counts.high + counts.medium + counts.low,
      blockerCount: counts.blocker,
      highCount: counts.high,
      mediumCount: counts.medium,
      lowCount: counts.low,
      aiSummary: computed.aiSummary,
      highlights: computed.highlights,
      startedAt: computed.gateStatus !== "NOT_STARTED" ? (existing?.startedAt || new Date()) : null,
      completedAt: (computed.gateStatus === "PASSED" || computed.gateStatus === "APPROVED") ? (existing?.completedAt || new Date()) : null,
    },
    create: {
      engagementId,
      phase,
      phaseIndex,
      gateStatus: computed.gateStatus,
      score: computed.score,
      scoreLabel: computed.scoreLabel,
      totalExceptions: counts.blocker + counts.high + counts.medium + counts.low,
      blockerCount: counts.blocker,
      highCount: counts.high,
      mediumCount: counts.medium,
      lowCount: counts.low,
      aiSummary: computed.aiSummary,
      highlights: computed.highlights,
      startedAt: computed.gateStatus !== "NOT_STARTED" ? new Date() : null,
    },
  });

  return {
    phase,
    phaseIndex,
    label: "",
    owner: "",
    gateStatus: computed.gateStatus,
    score: computed.score,
    scoreLabel: computed.scoreLabel,
    blockerCount: counts.blocker,
    highCount: counts.high,
    mediumCount: counts.medium,
    lowCount: counts.low,
    totalExceptions: counts.blocker + counts.high + counts.medium + counts.low,
    aiSummary: computed.aiSummary,
    highlights: computed.highlights,
    approvedById: existing?.approvedById || null,
    approvedAt: existing?.approvedAt || null,
    startedAt: existing?.startedAt || null,
    completedAt: existing?.completedAt || null,
  };
}

async function computeUploadProfileStatus(engagementId: string) {
  const uploads = await prisma.uploadVersion.findMany({
    where: { engagementId, status: "ACTIVE" },
    orderBy: { uploadedAt: "desc" },
    take: 1,
    select: { id: true, fileName: true, fileHash: true, uploadedAt: true, version: true },
  });

  const tbBatch = await prisma.tBBatch.findFirst({
    where: { engagementId },
    select: { id: true, entryCount: true, periodStart: true, periodEnd: true },
  });

  const glBatch = await prisma.gLBatch.findFirst({
    where: { engagementId },
    select: { id: true, entryCount: true },
  });

  const coaCount = await prisma.coAAccount.count({ where: { engagementId } });
  const partyCount = await prisma.importPartyBalance.count({ where: { engagementId } });
  const bankCount = await prisma.importBankAccount.count({ where: { engagementId } });

  if (!uploads.length && !tbBatch) {
    return {
      gateStatus: "NOT_STARTED" as GateStatus,
      score: null,
      scoreLabel: null,
      aiSummary: "No workbook uploaded yet. Upload an Excel workbook to begin.",
      highlights: null,
    };
  }

  const sheetsDetected = [];
  if (tbBatch) sheetsDetected.push({ sheet: "Trial Balance", rows: tbBatch.entryCount });
  if (glBatch) sheetsDetected.push({ sheet: "General Ledger", rows: glBatch.entryCount });
  if (coaCount > 0) sheetsDetected.push({ sheet: "Chart of Accounts", rows: coaCount });
  if (partyCount > 0) sheetsDetected.push({ sheet: "Parties", rows: partyCount });
  if (bankCount > 0) sheetsDetected.push({ sheet: "Bank Accounts", rows: bankCount });

  const missingSheets = [];
  if (!tbBatch) missingSheets.push("Trial Balance");

  const allPresent = missingSheets.length === 0;

  return {
    gateStatus: allPresent ? ("PASSED" as GateStatus) : ("BLOCKED" as GateStatus),
    score: Math.round((sheetsDetected.length / 5) * 100),
    scoreLabel: `${sheetsDetected.length}/5 sheets detected`,
    aiSummary: allPresent
      ? `Upload complete: ${sheetsDetected.map(s => `${s.sheet} (${s.rows} rows)`).join(", ")}`
      : `Missing required sheets: ${missingSheets.join(", ")}`,
    highlights: {
      upload: uploads[0] || null,
      sheets: sheetsDetected,
      missingSheets,
      period: tbBatch ? { start: tbBatch.periodStart, end: tbBatch.periodEnd } : null,
    },
  };
}

async function computeDataQualityStatus(engagementId: string) {
  const latestSummary = await prisma.summaryRun.findFirst({
    where: { engagementId },
    orderBy: { createdAt: "desc" },
    include: { exceptions: { where: { isResolved: false } } },
  });

  if (!latestSummary) {
    return {
      gateStatus: "NOT_STARTED" as GateStatus,
      score: null,
      scoreLabel: null,
      aiSummary: "Data quality checks have not been run yet.",
      highlights: null,
    };
  }

  const checks = [
    { name: "TB Arithmetic", status: latestSummary.tbArithmeticStatus, msg: latestSummary.tbArithmeticMessage },
    { name: "GL Dr/Cr Balance", status: latestSummary.glDrCrStatus, msg: latestSummary.glDrCrMessage },
    { name: "TB-GL Tie-Out", status: latestSummary.tbGlTieOutStatus, msg: latestSummary.tbGlTieOutMessage },
    { name: "TB-GL Totals", status: latestSummary.tbGlTotalsStatus, msg: latestSummary.tbGlTotalsMessage },
  ];

  const passCount = checks.filter(c => c.status === "PASS").length;
  const failCount = checks.filter(c => c.status === "FAIL").length;
  const score = Math.round((passCount / checks.length) * 100);

  const criticalExceptions = latestSummary.exceptions.filter(e => e.severity === "CRITICAL").length;
  const errorExceptions = latestSummary.exceptions.filter(e => e.severity === "ERROR").length;

  let gateStatus: GateStatus = "IN_PROGRESS";
  if (failCount === 0 && criticalExceptions === 0) gateStatus = "PASSED";
  else if (failCount > 0 || criticalExceptions > 0) gateStatus = "BLOCKED";

  const summaryParts = [];
  if (failCount > 0) summaryParts.push(`${failCount} check(s) failed`);
  if (criticalExceptions > 0) summaryParts.push(`${criticalExceptions} critical exception(s)`);
  if (errorExceptions > 0) summaryParts.push(`${errorExceptions} error(s)`);
  if (summaryParts.length === 0) summaryParts.push("All data quality checks passed");

  return {
    gateStatus,
    score,
    scoreLabel: `DQ Score: ${score}/100`,
    aiSummary: summaryParts.join(". ") + ".",
    highlights: {
      checks,
      overallStatus: latestSummary.overallStatus,
      summaryRunId: latestSummary.id,
      counts: {
        tbRows: latestSummary.tbRowCount,
        glEntries: latestSummary.glEntryCount,
        exceptions: latestSummary.exceptionCount,
        critical: latestSummary.criticalExceptionCount,
      },
      totals: {
        tbOpeningDr: Number(latestSummary.tbOpeningDebitTotal),
        tbOpeningCr: Number(latestSummary.tbOpeningCreditTotal),
        tbClosingDr: Number(latestSummary.tbClosingDebitTotal),
        tbClosingCr: Number(latestSummary.tbClosingCreditTotal),
        glDr: Number(latestSummary.glDebitTotal),
        glCr: Number(latestSummary.glCreditTotal),
      },
    },
  };
}

async function computeTBGLReconStatus(engagementId: string) {
  const latestSummary = await prisma.summaryRun.findFirst({
    where: { engagementId },
    orderBy: { createdAt: "desc" },
  });

  if (!latestSummary) {
    return {
      gateStatus: "NOT_STARTED" as GateStatus,
      score: null,
      scoreLabel: null,
      aiSummary: "TB-GL reconciliation not started.",
      highlights: null,
    };
  }

  const reconDiff = Number(latestSummary.tbGlMovementDiff);
  const reconStatus = latestSummary.tbGlTieOutStatus;
  const totalsStatus = latestSummary.tbGlTotalsStatus;

  const mappingSessions = await prisma.mappingSession.findMany({
    where: { engagementId },
    select: { id: true },
  });
  const sessionIds = mappingSessions.map(s => s.id);
  const reconItems = sessionIds.length > 0
    ? await prisma.reconciliationItem.count({ where: { sessionId: { in: sessionIds } } })
    : 0;

  let gateStatus: GateStatus = "IN_PROGRESS";
  let rootCause: string | null = null;

  if (reconStatus === "PASS" && totalsStatus === "PASS") {
    gateStatus = "PASSED";
  } else if (reconStatus === "FAIL" || totalsStatus === "FAIL") {
    gateStatus = "BLOCKED";
    if (reconDiff !== 0) {
      if (reconDiff > 0) rootCause = "GL total exceeds TB movement — possible prior-year entries in GL or TB imported as closing only.";
      else rootCause = "TB movement exceeds GL total — possible missing GL entries or incomplete GL extraction.";
    }
  }

  const score = reconStatus === "PASS" ? 100 : reconDiff === 0 ? 100 : Math.max(0, 100 - Math.min(100, Math.abs(reconDiff) / 1000));

  return {
    gateStatus,
    score: Math.round(score),
    scoreLabel: reconDiff === 0 ? "Fully Reconciled" : `Difference: ${reconDiff.toLocaleString()}`,
    aiSummary: rootCause || (gateStatus === "PASSED" ? "TB and GL are fully reconciled." : "Reconciliation in progress."),
    highlights: {
      reconDiff,
      reconStatus,
      totalsStatus,
      reconItemCount: reconItems,
      suggestedRootCause: rootCause,
      deltaDR: Number(latestSummary.deltaDR),
      deltaCR: Number(latestSummary.deltaCR),
    },
  };
}

async function computeFSMappingStatus(engagementId: string) {
  const totalAccounts = await prisma.coAAccount.count({ where: { engagementId } });
  const mappedAccounts = await prisma.coAAccount.count({
    where: { engagementId, fsLineItem: { not: null } },
  });
  const unmappedAccounts = totalAccounts - mappedAccounts;

  const tbEntries = await prisma.tBEntry.findMany({
    where: { batch: { engagementId } },
    select: { accountCode: true, closingDebit: true, closingCredit: true },
  });

  const unmappedCoa = await prisma.coAAccount.findMany({
    where: { engagementId, OR: [{ fsLineItem: null }, { fsLineItem: "" }] },
    select: { accountCode: true, accountName: true },
  });

  const unmappedCodes = new Set(unmappedCoa.map(a => a.accountCode));
  let unmappedMaterialValue = 0;
  for (const tb of tbEntries) {
    if (unmappedCodes.has(tb.accountCode)) {
      unmappedMaterialValue += Math.abs(Number(tb.closingDebit) - Number(tb.closingCredit));
    }
  }

  const fsHeadWPs = await prisma.fSHeadWorkingPaper.count({ where: { engagementId } });

  if (totalAccounts === 0) {
    return {
      gateStatus: "NOT_STARTED" as GateStatus,
      score: null,
      scoreLabel: null,
      aiSummary: "No accounts found. Upload data first.",
      highlights: null,
    };
  }

  const mappingPct = Math.round((mappedAccounts / totalAccounts) * 100);
  let gateStatus: GateStatus = "IN_PROGRESS";
  if (mappingPct === 100) gateStatus = "PASSED";
  else if (unmappedMaterialValue > 0 && unmappedAccounts > 0) gateStatus = "BLOCKED";

  return {
    gateStatus,
    score: mappingPct,
    scoreLabel: `${mappedAccounts}/${totalAccounts} mapped (${mappingPct}%)`,
    aiSummary: gateStatus === "PASSED"
      ? "All accounts mapped to FS hierarchy."
      : `${unmappedAccounts} unmapped account(s) with material value of ${unmappedMaterialValue.toLocaleString()}.`,
    highlights: {
      totalAccounts,
      mappedAccounts,
      unmappedAccounts,
      unmappedMaterialValue,
      leadScheduleCount: fsHeadWPs,
      topUnmapped: unmappedCoa.slice(0, 10),
    },
  };
}

async function computePlanningStatus(engagementId: string) {
  const materialitySets = await prisma.materialitySet.findMany({
    where: { engagementId },
    select: { id: true, status: true, overallMateriality: true, performanceMateriality: true },
  });

  const riskAssessments = await prisma.riskAssessment.count({ where: { engagementId } });

  const analyticalProcs = await prisma.analyticalProcedure.count({ where: { engagementId } });

  const hasApprovedMateriality = materialitySets.some(m => m.status === "APPROVED");
  const hasMateriality = materialitySets.length > 0;

  let gateStatus: GateStatus = "NOT_STARTED";
  if (hasApprovedMateriality && riskAssessments > 0) gateStatus = "APPROVED";
  else if (hasMateriality || riskAssessments > 0 || analyticalProcs > 0) gateStatus = "IN_PROGRESS";

  const score = Math.round(
    ((hasMateriality ? 40 : 0) + (hasApprovedMateriality ? 20 : 0) + (riskAssessments > 0 ? 20 : 0) + (analyticalProcs > 0 ? 20 : 0))
  );

  const parts: string[] = [];
  if (hasApprovedMateriality) parts.push("Materiality approved");
  else if (hasMateriality) parts.push("Materiality drafted, pending approval");
  if (riskAssessments > 0) parts.push(`${riskAssessments} risk(s) assessed`);
  if (analyticalProcs > 0) parts.push(`${analyticalProcs} analytical procedure(s) documented`);

  return {
    gateStatus,
    score,
    scoreLabel: hasApprovedMateriality ? "Materiality Approved" : hasMateriality ? "Draft" : riskAssessments > 0 ? "In Progress" : "Not Started",
    aiSummary: parts.length > 0
      ? parts.join(". ") + "."
      : "Planning analytics not started.",
    highlights: {
      materialitySets: materialitySets.map(m => ({
        id: m.id,
        status: m.status,
        om: Number(m.overallMateriality),
        pm: Number(m.performanceMateriality),
      })),
      riskCount: riskAssessments,
      analyticsCount: analyticalProcs,
    },
  };
}

async function computeSamplingStatus(engagementId: string) {
  const populations = await prisma.populationDefinition.findMany({
    where: { engagementId },
    select: { id: true, name: true, status: true, populationCount: true, populationValue: true },
  });

  const samples = await prisma.sample.findMany({
    where: { engagementId },
    select: { id: true, method: true, targetSize: true, actualSize: true, status: true },
  });

  if (populations.length === 0) {
    return {
      gateStatus: "NOT_STARTED" as GateStatus,
      score: null,
      scoreLabel: null,
      aiSummary: "No populations built yet.",
      highlights: null,
    };
  }

  const builtPops = populations.filter(p => p.status !== "DRAFT").length;
  const approvedSamples = samples.filter(s => s.status === "APPROVED").length;
  const totalItems = populations.reduce((sum, p) => sum + (p.populationCount || 0), 0);
  const totalValue = populations.reduce((sum, p) => sum + Number(p.populationValue || 0), 0);
  const selectedItems = samples.reduce((sum, s) => sum + (s.actualSize || s.targetSize), 0);
  const coveragePct = totalItems > 0 ? Math.round((selectedItems / totalItems) * 100) : 0;

  let gateStatus: GateStatus = "IN_PROGRESS";
  if (approvedSamples > 0 && approvedSamples >= samples.length) gateStatus = "APPROVED";
  else if (samples.length > 0) gateStatus = "IN_PROGRESS";

  return {
    gateStatus,
    score: Math.min(100, Math.round((builtPops / Math.max(1, populations.length)) * 50 + (approvedSamples / Math.max(1, samples.length)) * 50)),
    scoreLabel: `${populations.length} population(s), ${samples.length} sample(s)`,
    aiSummary: `${populations.length} population(s) built with ${totalItems.toLocaleString()} items (${totalValue.toLocaleString()} value). ${selectedItems} items selected. Coverage: ${coveragePct}%.`,
    highlights: {
      populations: populations.slice(0, 5),
      sampleCount: samples.length,
      approvedSamples,
      totalItems,
      totalValue,
      selectedItems,
      coveragePct,
    },
  };
}

async function computeExecutionStatus(engagementId: string) {
  const workpapers = await prisma.fSHeadWorkingPaper.findMany({
    where: { engagementId },
    select: { id: true, fsHeadName: true, status: true, auditStatus: true, tocCompleted: true, todCompleted: true, analyticsCompleted: true },
  });

  const misstatements = await prisma.misstatement.findMany({
    where: { engagementId },
    select: { id: true, misstatementAmount: true, misstatementType: true, status: true },
  });

  if (workpapers.length === 0) {
    return {
      gateStatus: "NOT_STARTED" as GateStatus,
      score: null,
      scoreLabel: null,
      aiSummary: "No workpapers created yet.",
      highlights: null,
    };
  }

  const completedWPs = workpapers.filter(w => w.status === "APPROVED" || w.status === "REVIEWED").length;
  const inProgressWPs = workpapers.filter(w => w.status === "IN_PROGRESS" || w.status === "DRAFT").length;
  const totalMisstatements = misstatements.length;
  const unresolvedMisstatements = misstatements.filter(m => m.status !== "WAIVED").length;
  const totalMisstmtAmount = misstatements.reduce((sum, m) => sum + Math.abs(Number(m.misstatementAmount || 0)), 0);

  const score = Math.round((completedWPs / workpapers.length) * 100);
  let gateStatus: GateStatus = "IN_PROGRESS";
  if (completedWPs === workpapers.length) gateStatus = "PASSED";

  return {
    gateStatus,
    score,
    scoreLabel: `${completedWPs}/${workpapers.length} workpapers complete`,
    aiSummary: `${completedWPs} of ${workpapers.length} workpapers completed. ${inProgressWPs} in progress. ${unresolvedMisstatements} unresolved misstatement(s) totaling ${totalMisstmtAmount.toLocaleString()}.`,
    highlights: {
      totalWorkpapers: workpapers.length,
      completed: completedWPs,
      inProgress: inProgressWPs,
      misstatements: {
        total: totalMisstatements,
        unresolved: unresolvedMisstatements,
        totalAmount: totalMisstmtAmount,
      },
    },
  };
}

async function computeCompletionStatus(engagementId: string) {
  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    select: {
      status: true,
      finalizationLocked: true,
    },
  });

  if (!engagement) {
    return {
      gateStatus: "NOT_STARTED" as GateStatus,
      score: null,
      scoreLabel: null,
      aiSummary: "Engagement not found.",
      highlights: null,
    };
  }

  const auditReport = await prisma.auditReport.findFirst({ where: { engagementId } });
  const managementLetter = await prisma.managementLetter.findFirst({ where: { engagementId } });
  const completionMemo = await prisma.completionMemo.findFirst({ where: { engagementId } });

  const components = {
    auditReport: !!auditReport,
    managementLetter: !!managementLetter,
    completionMemo: !!completionMemo,
    finalizationLocked: engagement.finalizationLocked,
  };

  const completedComponents = Object.values(components).filter(Boolean).length;
  const score = Math.round((completedComponents / 4) * 100);

  let gateStatus: GateStatus = "NOT_STARTED";
  if (engagement.status === "COMPLETED" || engagement.status === "ARCHIVED") gateStatus = "APPROVED";
  else if (completedComponents > 0) gateStatus = "IN_PROGRESS";

  const readinessBlockers: string[] = [];
  if (!components.auditReport) readinessBlockers.push("Audit report not drafted");
  if (!components.completionMemo) readinessBlockers.push("Completion memo missing");
  if (!components.finalizationLocked) readinessBlockers.push("Finalization not locked");

  return {
    gateStatus,
    score,
    scoreLabel: `Report Readiness: ${score}%`,
    aiSummary: readinessBlockers.length === 0
      ? "All completion deliverables ready. Pending partner final approval."
      : `Blockers: ${readinessBlockers.join("; ")}.`,
    highlights: {
      components,
      readinessBlockers,
      engagementStatus: engagement.status,
    },
  };
}

export async function runPhaseExceptionScan(engagementId: string, phase: WorkflowPhase): Promise<number> {
  let created = 0;

  if (phase === "DATA_QUALITY" || phase === "UPLOAD_PROFILE") {
    const summary = await prisma.summaryRun.findFirst({
      where: { engagementId },
      orderBy: { createdAt: "desc" },
      include: { exceptions: true },
    });

    if (summary) {
      for (const ex of summary.exceptions) {
        if (ex.isResolved) continue;

        let taxonomy: ExceptionTaxonomy = "S4_LOW";
        if (ex.severity === "CRITICAL") taxonomy = "S1_BLOCKER";
        else if (ex.severity === "ERROR") taxonomy = "S2_HIGH";
        else if (ex.severity === "WARNING") taxonomy = "S3_MEDIUM";

        const existing = await prisma.workflowException.findFirst({
          where: { engagementId, ruleId: ex.ruleCode, rowId: ex.rowId, status: "OPEN" },
        });

        if (!existing) {
          await prisma.workflowException.create({
            data: {
              engagementId,
              phase: phase === "UPLOAD_PROFILE" ? "UPLOAD_PROFILE" : "DATA_QUALITY",
              taxonomy,
              ruleId: ex.ruleCode,
              description: ex.message,
              sheet: ex.dataset,
              rowId: ex.rowId,
              accountCode: ex.accountCode,
              amountImpact: ex.difference,
              suggestedFix: taxonomy === "S4_LOW" ? "Auto-fixable: formatting standardization" : null,
            },
          });
          created++;
        }
      }
    }
  }

  if (phase === "TB_GL_RECON") {
    const summary = await prisma.summaryRun.findFirst({
      where: { engagementId },
      orderBy: { createdAt: "desc" },
    });

    if (summary && summary.tbGlTieOutStatus === "FAIL") {
      const diff = Number(summary.tbGlMovementDiff);
      const existing = await prisma.workflowException.findFirst({
        where: { engagementId, phase: "TB_GL_RECON", ruleId: "RECON_TB_GL_DIFF", status: "OPEN" },
      });

      if (!existing) {
        await prisma.workflowException.create({
          data: {
            engagementId,
            phase: "TB_GL_RECON",
            taxonomy: "S1_BLOCKER",
            ruleId: "RECON_TB_GL_DIFF",
            description: `TB-GL reconciliation difference of ${diff.toLocaleString()}`,
            amountImpact: diff,
            rootCause: diff > 0
              ? "GL total exceeds TB movement — possible prior-year GL entries or TB imported as closing-only"
              : "TB movement exceeds GL total — possible missing GL entries",
            suggestedFix: "Review GL date range and TB basis (movement vs closing)",
          },
        });
        created++;
      }
    }
  }

  if (phase === "FS_MAPPING") {
    const unmapped = await prisma.coAAccount.findMany({
      where: { engagementId, OR: [{ fsLineItem: null }, { fsLineItem: "" }] },
      select: { accountCode: true, accountName: true },
    });

    for (const acc of unmapped.slice(0, 50)) {
      const existing = await prisma.workflowException.findFirst({
        where: { engagementId, phase: "FS_MAPPING", ruleId: "UNMAPPED_ACCOUNT", accountCode: acc.accountCode, status: "OPEN" },
      });

      if (!existing) {
        await prisma.workflowException.create({
          data: {
            engagementId,
            phase: "FS_MAPPING",
            taxonomy: "S2_HIGH",
            ruleId: "UNMAPPED_ACCOUNT",
            description: `Account ${acc.accountCode} (${acc.accountName}) not mapped to FS hierarchy`,
            accountCode: acc.accountCode,
            suggestedFix: "Map to appropriate FS line item using description matching",
          },
        });
        created++;
      }
    }
  }

  return created;
}

export async function resolveWorkflowException(
  exceptionId: string,
  userId: string,
  note: string
): Promise<any> {
  return prisma.workflowException.update({
    where: { id: exceptionId },
    data: {
      status: "RESOLVED",
      resolvedById: userId,
      resolvedAt: new Date(),
      resolvedNote: note,
    },
  });
}

export async function bulkResolveExceptions(
  engagementId: string,
  phase: WorkflowPhase,
  taxonomy: ExceptionTaxonomy,
  userId: string,
  note: string
): Promise<number> {
  const result = await prisma.workflowException.updateMany({
    where: { engagementId, phase, taxonomy, status: "OPEN" },
    data: {
      status: "RESOLVED",
      resolvedById: userId,
      resolvedAt: new Date(),
      resolvedNote: note,
    },
  });
  return result.count;
}

export function getPhaseConfig() {
  return PHASE_CONFIG;
}
