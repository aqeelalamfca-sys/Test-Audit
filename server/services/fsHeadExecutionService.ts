import { prisma } from "../db";
import { detectFSHeadType, FS_HEAD_TEMPLATES } from "./fsHeadProcedureTemplates";

const db = prisma as any;

export interface FSHeadExecutionContext {
  engagement: {
    id: string;
    code: string;
    clientName: string;
    firmName: string;
    periodStart: string | null;
    periodEnd: string | null;
    fiscalYear: number;
    reportingFramework: string | null;
    riskRating: string;
    engagementPartner: string | null;
    engagementManager: string | null;
  };
  materiality: {
    overall: number;
    performance: number;
    trivial: number;
    basis: string | null;
    benchmark: string | null;
  };
  financials: {
    currentYearBalance: number;
    priorYearBalance: number;
    movement: number;
    movementPercent: number;
    isSignificant: boolean;
    significantReason: string | null;
    accountCount: number;
  };
  subLineItems: {
    code: string;
    name: string;
    priorYear: number;
    debit: number;
    credit: number;
    closingBalance: number;
    variancePercent: number;
  }[];
  linkedRisks: {
    id: string;
    riskDescription: string;
    inherentRisk: string;
    controlRisk: string;
    romm: string;
    assertion: string;
    assertionImpacts: string[];
    isFraudRisk: boolean;
    isSignificantRisk: boolean;
    plannedResponse: string | null;
    natureOfProcedures: string | null;
  }[];
  assertionMatrix: Record<string, {
    selected: boolean;
    risks: string[];
    procedures: string[];
  }>;
  auditProgram: {
    id: string;
    workpaperRef: string;
    title: string;
    description: string;
    procedureType: string;
    assertions: string[];
    isaReferences: string[];
    status: string;
    linkedRiskIds: string[];
  }[];
  planningFlags: {
    hasFraudRisk: boolean;
    hasSignificantRisk: boolean;
    hasGoingConcernRisk: boolean;
    hasRelatedPartyIssues: boolean;
    hasLegalComplianceIssues: boolean;
    controlRelianceDecision: string | null;
    isa540Triggered: boolean;
  };
  teamAssignment: {
    preparer: string | null;
    reviewer: string | null;
    partner: string | null;
  };
  template: {
    headType: string;
    displayName: string;
    keyAssertions: string[];
    keyRisks: { description: string; isaReference?: string }[];
    riskLevel: string;
    riskLocked: boolean;
    fraudRiskPresumed: boolean;
    isa540Triggered: boolean;
    mandatoryProcedures: { ref: string; type: string; description: string; isaReference: string }[];
    specialEnforcement: string[];
  } | null;
  completion: {
    contextComplete: boolean;
    assertionsComplete: boolean;
    proceduresComplete: boolean;
    evidenceComplete: boolean;
    conclusionComplete: boolean;
    reviewComplete: boolean;
    overallPercent: number;
    status: string;
  };
  procedureSummary: {
    totalTOC: number;
    completedTOC: number;
    totalTOD: number;
    completedTOD: number;
    totalAnalytics: number;
    completedAnalytics: number;
    totalProcedures: number;
    completedProcedures: number;
    mandatoryMissing: number;
  };
  evidenceSummary: {
    totalAttachments: number;
    requiredEvidence: number;
    linkedEvidence: number;
    completenessPercent: number;
  };
  issueSummary: {
    totalIssues: number;
    openIssues: number;
    totalMisstatements: number;
    materialMisstatements: number;
    proposedAdjustments: number;
  };
  reviewSummary: {
    totalReviewPoints: number;
    openReviewPoints: number;
    clearedReviewPoints: number;
  };
}

export async function getEnhancedExecutionContext(
  engagementId: string,
  fsHeadKey: string
): Promise<FSHeadExecutionContext> {
  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    include: {
      client: { select: { name: true } },
      firm: { select: { name: true } },
      engagementPartner: { select: { fullName: true } },
      engagementManager: { select: { fullName: true } },
    },
  });

  if (!engagement) throw new Error("Engagement not found");

  const coaAccounts = await prisma.coAAccount.findMany({
    where: { engagementId, fsLineItem: { not: null } },
    select: { fsLineItem: true, accountCode: true, accountName: true, accountClass: true, nature: true, id: true },
  });

  const matchingAccounts = coaAccounts.filter(
    (a) => a.fsLineItem?.toLowerCase().replace(/[^a-z0-9]/g, "-") === fsHeadKey
  );
  const matchingAccountCodes = matchingAccounts.map((a) => a.accountCode);
  const matchingAccountIds = matchingAccounts.map((a) => a.id);
  const fsLineItem = matchingAccounts[0]?.fsLineItem || fsHeadKey;

  const importBalancesCB = await prisma.importAccountBalance.findMany({
    where: { engagementId, balanceType: "CB" },
    select: { accountCode: true, debitAmount: true, creditAmount: true },
  });
  const importBalancesOB = await prisma.importAccountBalance.findMany({
    where: { engagementId, balanceType: "OB" },
    select: { accountCode: true, debitAmount: true, creditAmount: true },
  });

  const currentBalanceMap = new Map<string, number>();
  const priorBalanceMap = new Map<string, number>();
  const debitMap = new Map<string, number>();
  const creditMap = new Map<string, number>();

  if (importBalancesCB.length > 0) {
    for (const ib of importBalancesCB) {
      currentBalanceMap.set(ib.accountCode, Number(ib.debitAmount || 0) - Number(ib.creditAmount || 0));
      debitMap.set(ib.accountCode, Number(ib.debitAmount || 0));
      creditMap.set(ib.accountCode, Number(ib.creditAmount || 0));
    }
    for (const ib of importBalancesOB) {
      priorBalanceMap.set(ib.accountCode, Number(ib.debitAmount || 0) - Number(ib.creditAmount || 0));
    }
  } else {
    const tbLines = await prisma.trialBalanceLine.findMany({
      where: { trialBalance: { engagementId } },
      select: { accountCode: true, closingBalance: true, openingBalance: true },
    });
    for (const tl of tbLines) {
      currentBalanceMap.set(tl.accountCode, Number(tl.closingBalance) || 0);
      priorBalanceMap.set(tl.accountCode, Number(tl.openingBalance) || 0);
    }
  }

  const subLineItems = matchingAccounts.map((acc) => {
    const cy = currentBalanceMap.get(acc.accountCode) || 0;
    const py = priorBalanceMap.get(acc.accountCode) || 0;
    const dr = debitMap.get(acc.accountCode) || 0;
    const cr = creditMap.get(acc.accountCode) || 0;
    const varPct = py !== 0 ? ((cy - py) / Math.abs(py)) * 100 : cy !== 0 ? 100 : 0;
    return {
      code: acc.accountCode,
      name: acc.accountName,
      priorYear: py,
      debit: dr,
      credit: cr,
      closingBalance: cy,
      variancePercent: Math.round(varPct * 10) / 10,
    };
  });

  const currentYearBalance = subLineItems.reduce((s, a) => s + a.closingBalance, 0);
  const priorYearBalance = subLineItems.reduce((s, a) => s + a.priorYear, 0);
  const movement = currentYearBalance - priorYearBalance;
  const movementPercent = priorYearBalance !== 0 ? ((movement) / Math.abs(priorYearBalance)) * 100 : currentYearBalance !== 0 ? 100 : 0;

  const materialityAssessment = await prisma.materialityAssessment.findFirst({
    where: { engagementId },
    orderBy: { createdAt: "desc" },
  });

  const overallMat = Number(materialityAssessment?.overallMateriality) || 0;
  const perfMat = Number(materialityAssessment?.performanceMateriality) || 0;
  const trivialMat = Number(materialityAssessment?.trivialThreshold) || 0;

  const isSignificant = Math.abs(currentYearBalance) >= perfMat && perfMat > 0;

  const fsAreaMapping: Record<string, string> = {
    cash: "CASH_AND_BANK", receivables: "RECEIVABLES", inventory: "INVENTORIES",
    payables: "PAYABLES", revenue: "REVENUE", expenses: "OPERATING_EXPENSES",
    ppe: "FIXED_ASSETS", provisions: "PROVISIONS", equity: "EQUITY",
    investments: "INVESTMENTS", borrowings: "BORROWINGS", intangibles: "INTANGIBLES",
  };
  const mappedFsArea = fsAreaMapping[fsHeadKey.toLowerCase().replace(/-/g, "")] || null;

  const riskAssessments = await prisma.riskAssessment.findMany({
    where: {
      engagementId,
      OR: [
        ...(mappedFsArea ? [{ fsArea: mappedFsArea as any }] : []),
        ...(fsLineItem ? [{ accountOrClass: { contains: fsLineItem.split(" ")[0], mode: "insensitive" as const } }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
  });

  const linkedRisks = riskAssessments.map((r) => ({
    id: r.id,
    riskDescription: r.riskDescription || "",
    inherentRisk: r.inherentRisk || "MODERATE",
    controlRisk: r.controlRisk || "MODERATE",
    romm: r.riskOfMaterialMisstatement || "MODERATE",
    assertion: r.assertion || "",
    assertionImpacts: (r as any).assertionImpacts || [],
    isFraudRisk: r.isFraudRisk || false,
    isSignificantRisk: (r as any).isSignificantRisk || r.inherentRisk === "HIGH" || r.isFraudRisk || false,
    plannedResponse: r.plannedResponse || null,
    natureOfProcedures: r.natureOfProcedures || null,
  }));

  const ALL_ASSERTIONS = ["Existence", "Completeness", "Accuracy", "Valuation", "Rights & Obligations", "Cut-off", "Classification", "Presentation & Disclosure"];
  const assertionMatrix: Record<string, { selected: boolean; risks: string[]; procedures: string[] }> = {};
  for (const a of ALL_ASSERTIONS) {
    const linkedR = linkedRisks.filter((r) => r.assertion === a || r.assertionImpacts.includes(a));
    assertionMatrix[a] = {
      selected: linkedR.length > 0,
      risks: linkedR.map((r) => r.id),
      procedures: [],
    };
  }

  let auditProgram: FSHeadExecutionContext["auditProgram"] = [];
  if (matchingAccountIds.length > 0) {
    const procedures = await prisma.engagementProcedure.findMany({
      where: { engagementId, linkedAccountIds: { hasSome: matchingAccountIds } },
      orderBy: { workpaperRef: "asc" },
    });
    auditProgram = procedures.map((p) => ({
      id: p.id,
      workpaperRef: p.workpaperRef || "",
      title: p.title || "",
      description: p.description || "",
      procedureType: p.procedureType || "SUBSTANTIVE",
      assertions: p.assertions || [],
      isaReferences: p.isaReferences || [],
      status: p.status || "NOT_STARTED",
      linkedRiskIds: (p as any).linkedRiskIds || [],
    }));

    for (const proc of auditProgram) {
      for (const a of proc.assertions) {
        if (assertionMatrix[a]) {
          assertionMatrix[a].procedures.push(proc.id);
        }
      }
    }
  }

  const hasFraudRisk = linkedRisks.some((r) => r.isFraudRisk);
  const hasSignificantRisk = linkedRisks.some((r) => r.isSignificantRisk);

  let hasGoingConcernRisk = false;
  let hasRelatedPartyIssues = false;
  let hasLegalComplianceIssues = false;
  try {
    const extPlanning = await prisma.extendedPlanningData.findFirst({
      where: { engagementId },
      select: { data: true },
    });
    if (extPlanning?.data) {
      const d = extPlanning.data as any;
      hasGoingConcernRisk = d.goingConcern?.overallAssessment === "significant_doubt" || d.goingConcern?.overallAssessment === "material_uncertainty";
      hasRelatedPartyIssues = (d.relatedParties?.parties?.length || 0) > 0;
      hasLegalComplianceIssues = d.lawsRegulations?.complianceIssues?.length > 0;
    }
  } catch {}

  const headType = detectFSHeadType(fsLineItem);
  const templateData = FS_HEAD_TEMPLATES[headType] || null;
  const template = templateData
    ? {
        headType: templateData.headType,
        displayName: templateData.displayName,
        keyAssertions: templateData.keyAssertions,
        keyRisks: templateData.keyRisks,
        riskLevel: templateData.riskLevel,
        riskLocked: templateData.riskLocked,
        fraudRiskPresumed: templateData.fraudRiskPresumed,
        isa540Triggered: templateData.isa540Triggered,
        mandatoryProcedures: templateData.procedures.filter((p) => p.mandatory).map((p) => ({
          ref: p.ref, type: p.type, description: p.description, isaReference: p.isaReference,
        })),
        specialEnforcement: templateData.specialEnforcement,
      }
    : null;

  const teamMembers = await prisma.engagementTeam.findMany({
    where: { engagementId },
    include: { user: { select: { fullName: true, role: true } } },
  });
  const preparer = teamMembers.find((t) => t.user.role === "STAFF" || t.user.role === "SENIOR")?.user.fullName || null;
  const reviewer = teamMembers.find((t) => t.user.role === "MANAGER")?.user.fullName || engagement.engagementManager?.fullName || null;
  const partner = engagement.engagementPartner?.fullName || null;

  let workingPaper: any = null;
  try {
    workingPaper = await db.fSHeadWorkingPaper.findUnique({
      where: { engagementId_fsHeadKey: { engagementId, fsHeadKey } },
      include: {
        procedures: true,
        reviewPoints: true,
        attachments: true,
        testOfControls: true,
        testOfDetails: true,
        analyticalProcedures: true,
      },
    });
  } catch {}

  const toc = workingPaper?.testOfControls || [];
  const tod = workingPaper?.testOfDetails || [];
  const analytics = workingPaper?.analyticalProcedures || [];
  const attachments = workingPaper?.attachments || [];
  const reviewPoints = workingPaper?.reviewPoints || [];

  const completedTOC = toc.filter((t: any) => t.result === "SATISFACTORY" || t.result === "COMPLETED").length;
  const completedTOD = tod.filter((t: any) => t.result === "SATISFACTORY" || t.result === "COMPLETED").length;
  const completedAnalytics = analytics.filter((a: any) => a.auditorConclusion?.trim()?.length > 0 || a.conclusion?.trim()?.length > 0).length;
  const totalProcedures = toc.length + tod.length + analytics.length;
  const completedProcedures = completedTOC + completedTOD + completedAnalytics;

  let mandatoryMissing = 0;
  if (templateData) {
    const mandatoryProcs = templateData.procedures.filter((p) => p.mandatory);
    for (const mp of mandatoryProcs) {
      let found = false;
      if (mp.type === "TOC") found = toc.some((t: any) => t.tocRef === mp.ref || t.controlDescription?.includes(mp.description.slice(0, 30)));
      else if (mp.type === "TOD") found = tod.some((t: any) => t.todRef === mp.ref || t.procedureDescription?.includes(mp.description.slice(0, 30)));
      else if (mp.type === "ANALYTICS") found = analytics.some((a: any) => a.procedureRef === mp.ref || a.description?.includes(mp.description.slice(0, 30)));
      if (!found) mandatoryMissing++;
    }
  }

  const requiredEvidence = Math.max(completedProcedures, 1);
  const evidenceCompleteness = requiredEvidence > 0 ? Math.min(100, Math.round((attachments.length / requiredEvidence) * 100)) : 0;

  let totalIssues = 0;
  let openIssues = 0;
  let totalMisstatements = 0;
  let materialMisstatements = 0;
  let proposedAdjustments = 0;
  try {
    const adjustments = await prisma.auditAdjustment.findMany({
      where: { engagementId },
    });
    totalIssues = adjustments.length;
    openIssues = adjustments.filter((a) => a.status === "IDENTIFIED" || a.status === "PROPOSED").length;
    totalMisstatements = adjustments.filter((a) => a.isMaterial !== undefined).length;
    materialMisstatements = adjustments.filter((a) => a.isMaterial === true).length;
    proposedAdjustments = adjustments.filter((a) => a.adjustmentType === "PROPOSED" || a.adjustmentType === "REQUIRED").length;
  } catch {}

  const openReviewPoints = reviewPoints.filter((rp: any) => rp.status === "OPEN" || rp.status === "PENDING").length;
  const clearedReviewPoints = reviewPoints.filter((rp: any) => rp.status === "CLEARED" || rp.status === "RESOLVED").length;

  const contextComplete = subLineItems.length > 0;
  const assertionsComplete = linkedRisks.length > 0;
  const proceduresComplete = totalProcedures > 0 && mandatoryMissing === 0;
  const evidenceComplete = attachments.length > 0 && evidenceCompleteness >= 50;
  const conclusionComplete = !!workingPaper?.conclusion && workingPaper.conclusion.trim().length >= 50;
  const reviewComplete = workingPaper?.status === "APPROVED";

  const completionWeights = { context: 10, assertions: 15, procedures: 30, evidence: 20, conclusion: 15, review: 10 };
  let overallPercent =
    (contextComplete ? completionWeights.context : 0) +
    (assertionsComplete ? completionWeights.assertions : 0) +
    (proceduresComplete ? completionWeights.procedures : totalProcedures > 0 ? Math.round(completionWeights.procedures * (completedProcedures / Math.max(totalProcedures, 1))) : 0) +
    (evidenceComplete ? completionWeights.evidence : attachments.length > 0 ? Math.round(completionWeights.evidence * 0.5) : 0) +
    (conclusionComplete ? completionWeights.conclusion : 0) +
    (reviewComplete ? completionWeights.review : 0);

  if (workingPaper?.status === "APPROVED") overallPercent = 100;

  const status = workingPaper?.status || "NOT_STARTED";

  return {
    engagement: {
      id: engagement.id,
      code: engagement.engagementCode,
      clientName: engagement.client?.name || "",
      firmName: engagement.firm?.name || "",
      periodStart: engagement.periodStart?.toISOString() || null,
      periodEnd: engagement.periodEnd?.toISOString() || null,
      fiscalYear: engagement.periodEnd ? engagement.periodEnd.getFullYear() : new Date().getFullYear(),
      reportingFramework: engagement.reportingFramework || null,
      riskRating: engagement.riskRating || "MEDIUM",
      engagementPartner: engagement.engagementPartner?.fullName || null,
      engagementManager: engagement.engagementManager?.fullName || null,
    },
    materiality: {
      overall: overallMat,
      performance: perfMat,
      trivial: trivialMat,
      basis: (materialityAssessment as any)?.basis || null,
      benchmark: (materialityAssessment as any)?.benchmarkUsed || null,
    },
    financials: {
      currentYearBalance,
      priorYearBalance,
      movement,
      movementPercent: Math.round(movementPercent * 10) / 10,
      isSignificant,
      significantReason: isSignificant ? `Balance exceeds performance materiality (${perfMat.toLocaleString()})` : null,
      accountCount: matchingAccounts.length,
    },
    subLineItems,
    linkedRisks,
    assertionMatrix,
    auditProgram,
    planningFlags: {
      hasFraudRisk,
      hasSignificantRisk,
      hasGoingConcernRisk,
      hasRelatedPartyIssues,
      hasLegalComplianceIssues,
      controlRelianceDecision: null,
      isa540Triggered: template?.isa540Triggered || false,
    },
    teamAssignment: { preparer, reviewer, partner },
    template,
    completion: {
      contextComplete,
      assertionsComplete,
      proceduresComplete,
      evidenceComplete,
      conclusionComplete,
      reviewComplete,
      overallPercent,
      status,
    },
    procedureSummary: {
      totalTOC: toc.length,
      completedTOC,
      totalTOD: tod.length,
      completedTOD,
      totalAnalytics: analytics.length,
      completedAnalytics,
      totalProcedures,
      completedProcedures,
      mandatoryMissing,
    },
    evidenceSummary: {
      totalAttachments: attachments.length,
      requiredEvidence,
      linkedEvidence: attachments.length,
      completenessPercent: evidenceCompleteness,
    },
    issueSummary: {
      totalIssues,
      openIssues,
      totalMisstatements,
      materialMisstatements,
      proposedAdjustments,
    },
    reviewSummary: {
      totalReviewPoints: reviewPoints.length,
      openReviewPoints,
      clearedReviewPoints,
    },
  };
}

export async function getEngagementExecutionSummary(engagementId: string) {
  const coaAccounts = await prisma.coAAccount.findMany({
    where: { engagementId, fsLineItem: { not: null } },
    select: { fsLineItem: true, accountCode: true },
  });

  const fsHeadKeys = new Set<string>();
  for (const acc of coaAccounts) {
    if (acc.fsLineItem) {
      fsHeadKeys.add(acc.fsLineItem.toLowerCase().replace(/[^a-z0-9]/g, "-"));
    }
  }

  const workingPapers = await db.fSHeadWorkingPaper.findMany({
    where: { engagementId },
    include: {
      testOfControls: { select: { id: true, result: true } },
      testOfDetails: { select: { id: true, result: true } },
      analyticalProcedures: { select: { id: true, conclusion: true, auditorConclusion: true } },
      reviewPoints: { select: { id: true, status: true } },
      attachments: { select: { id: true } },
    },
  });

  const wpMap = new Map(workingPapers.map((wp: any) => [wp.fsHeadKey, wp]));

  let totalProcedures = 0;
  let completedProcedures = 0;
  let totalReviewPoints = 0;
  let openReviewPoints = 0;
  let totalEvidence = 0;
  let headsWithEvidence = 0;
  let headsWithConclusion = 0;
  let approvedHeads = 0;

  for (const wp of workingPapers) {
    const toc = (wp as any).testOfControls || [];
    const tod = (wp as any).testOfDetails || [];
    const ana = (wp as any).analyticalProcedures || [];
    const rps = (wp as any).reviewPoints || [];
    const atts = (wp as any).attachments || [];

    totalProcedures += toc.length + tod.length + ana.length;
    completedProcedures += toc.filter((t: any) => t.result === "SATISFACTORY" || t.result === "COMPLETED").length;
    completedProcedures += tod.filter((t: any) => t.result === "SATISFACTORY" || t.result === "COMPLETED").length;
    completedProcedures += ana.filter((a: any) => a.auditorConclusion?.trim()?.length > 0 || a.conclusion?.trim()?.length > 0).length;

    totalReviewPoints += rps.length;
    openReviewPoints += rps.filter((r: any) => r.status === "OPEN" || r.status === "PENDING").length;

    totalEvidence += atts.length;
    if (atts.length > 0) headsWithEvidence++;
    if ((wp as any).conclusion?.trim()?.length > 0) headsWithConclusion++;
    if ((wp as any).status === "APPROVED") approvedHeads++;
  }

  let totalIssues = 0;
  let openIssues = 0;
  try {
    const adjustments = await prisma.auditAdjustment.findMany({
      where: { engagementId },
      select: { status: true },
    });
    totalIssues = adjustments.length;
    openIssues = adjustments.filter((a) => a.status === "IDENTIFIED" || a.status === "PROPOSED").length;
  } catch {}

  return {
    totalHeads: fsHeadKeys.size,
    approvedHeads,
    inProgressHeads: workingPapers.filter((wp: any) => wp.status !== "APPROVED" && wp.status !== "NOT_STARTED" && wp.status !== "DRAFT").length,
    notStartedHeads: fsHeadKeys.size - workingPapers.length,
    totalProcedures,
    completedProcedures,
    openProcedures: totalProcedures - completedProcedures,
    totalReviewPoints,
    openReviewPoints,
    totalEvidence,
    headsWithEvidence,
    headsWithConclusion,
    totalIssues,
    openIssues,
    overallCompletion: fsHeadKeys.size > 0 ? Math.round((approvedHeads / fsHeadKeys.size) * 100) : 0,
  };
}
