import { prisma } from "../db";
import {
  CANONICAL_PHASES,
  getPhaseByKey,
  getPrerequisitePhases,
  type CanonicalPhase,
  type PhaseGate,
} from "../../shared/phases";

export interface GateCheckResult {
  gateId: string;
  label: string;
  type: "hard" | "soft";
  passed: boolean;
  message: string;
  isaReference?: string;
}

export interface PhaseGateEvaluation {
  phaseKey: string;
  phaseLabel: string;
  canEnter: boolean;
  canComplete: boolean;
  prerequisitesMet: boolean;
  hardGatesPassed: boolean;
  softGatesPassed: boolean;
  gates: GateCheckResult[];
  blockers: string[];
  warnings: string[];
}

export interface EngagementGateSnapshot {
  engagementId: string;
  timestamp: Date;
  phases: PhaseGateEvaluation[];
  currentPhaseKey: string | null;
  nextAvailablePhaseKey: string | null;
}

async function getPhaseStatusMap(engagementId: string): Promise<Map<string, string>> {
  const phases = await prisma.phaseProgress.findMany({
    where: { engagementId },
    select: { phase: true, status: true },
  });
  const map = new Map<string, string>();
  for (const p of phases) {
    map.set(p.phase, p.status);
  }
  return map;
}

function isBackendPhaseActive(statusMap: Map<string, string>, backendPhase: string): boolean {
  const status = statusMap.get(backendPhase);
  return !!status && ["IN_PROGRESS", "UNDER_REVIEW", "COMPLETED", "LOCKED"].includes(status);
}

function isBackendPhaseCompleted(statusMap: Map<string, string>, backendPhase: string): boolean {
  const status = statusMap.get(backendPhase);
  return status === "COMPLETED" || status === "LOCKED";
}

async function evaluateGatesForPhase(
  engagementId: string,
  phase: CanonicalPhase,
  statusMap: Map<string, string>
): Promise<GateCheckResult[]> {
  const results: GateCheckResult[] = [];

  for (const gate of phase.completionGates) {
    const result = await evaluateSingleGate(engagementId, phase, gate, statusMap);
    results.push(result);
  }

  return results;
}

async function evaluateSingleGate(
  engagementId: string,
  phase: CanonicalPhase,
  gate: PhaseGate,
  statusMap: Map<string, string>
): Promise<GateCheckResult> {
  let passed = false;
  let message = `Gate not yet satisfied: ${gate.description}`;

  try {
    switch (gate.id) {
      case "client-exists": {
        const eng = await prisma.engagement.findUnique({
          where: { id: engagementId },
          select: { clientId: true },
        });
        passed = !!eng?.clientId;
        if (passed) message = "Client record exists";
        break;
      }

      case "engagement-exists": {
        const eng = await prisma.engagement.findUnique({
          where: { id: engagementId },
          select: { id: true },
        });
        passed = !!eng;
        if (passed) message = "Engagement record exists";
        break;
      }

      case "team-assigned": {
        const teamCount = await prisma.engagementTeam.count({
          where: { engagementId },
        });
        passed = teamCount > 0;
        if (passed) message = `${teamCount} team member(s) assigned`;
        break;
      }

      case "acceptance-checklist": {
        const accDecision = await prisma.acceptanceContinuanceDecision.findUnique({
          where: { engagementId },
          select: { id: true, decision: true },
        });
        passed = !!accDecision && !!accDecision.decision;
        if (passed) message = "Acceptance checklist addressed";
        break;
      }

      case "continuance-assessed": {
        const contDecision = await prisma.acceptanceContinuanceDecision.findUnique({
          where: { engagementId },
          select: { id: true, decision: true, isReengagement: true },
        });
        passed = !!contDecision && (!!contDecision.decision || !contDecision.isReengagement);
        if (passed) message = "Continuance assessment completed";
        break;
      }

      case "engagement-letter-issued": {
        const letter = await prisma.engagementLetter.findFirst({
          where: { engagementId },
          select: { id: true, status: true },
        });
        passed = !!letter && ["APPROVED", "SENT", "ACCEPTED"].includes(letter.status);
        if (!letter) {
          const accDecisionForLetter = await prisma.acceptanceContinuanceDecision.findUnique({
            where: { engagementId },
            select: { partnerApprovedAt: true },
          });
          passed = !!accDecisionForLetter?.partnerApprovedAt;
        }
        if (passed) message = "Engagement letter issued or acceptance approved";
        break;
      }

      case "acceptance-approved": {
        const approvedDecision = await prisma.acceptanceContinuanceDecision.findUnique({
          where: { engagementId },
          select: { partnerApprovedAt: true, decision: true },
        });
        passed = !!approvedDecision?.partnerApprovedAt && approvedDecision.decision === "APPROVED";
        if (passed) message = "Acceptance approved by partner";
        break;
      }

      case "independence-confirmed": {
        const teamForIndep = await prisma.engagementTeam.findMany({
          where: { engagementId },
          select: { userId: true },
        });
        const indepDeclarations = await prisma.independenceDeclaration.findMany({
          where: { engagementId },
          select: { userId: true },
        });
        const teamIds = teamForIndep.map(t => t.userId);
        const declaredIds = indepDeclarations.map(d => d.userId);
        const pendingIndep = teamIds.filter(id => !declaredIds.includes(id));
        passed = teamIds.length > 0 && pendingIndep.length === 0;
        if (passed) message = `All ${teamIds.length} team members confirmed independence`;
        else message = `${pendingIndep.length} of ${teamIds.length} team members have not declared`;
        break;
      }

      case "conflicts-resolved": {
        const engForConflicts = await prisma.engagement.findUnique({
          where: { id: engagementId },
          select: { clientId: true },
        });
        if (engForConflicts) {
          const unresolvedConflicts = await prisma.conflictOfInterest.count({
            where: {
              clientId: engForConflicts.clientId,
              status: { in: ["IDENTIFIED", "UNDER_REVIEW"] },
            },
          });
          passed = unresolvedConflicts === 0;
          if (passed) message = "All conflicts resolved";
          else message = `${unresolvedConflicts} unresolved conflict(s)`;
        }
        break;
      }

      case "ethics-declarations": {
        const ethicsConf = await prisma.ethicsConfirmation.findUnique({
          where: { engagementId },
          select: { allDeclarationsComplete: true, allThreatsResolved: true },
        });
        passed = !!ethicsConf?.allDeclarationsComplete;
        if (passed) message = "Ethics declarations complete";
        break;
      }

      case "ethics-approved": {
        const ethicsApproval = await prisma.ethicsConfirmation.findUnique({
          where: { engagementId },
          select: { isLocked: true, lockedById: true },
        });
        passed = !!ethicsApproval?.isLocked;
        if (passed) message = "Ethics conclusion approved by partner";
        break;
      }

      case "tb-uploaded": {
        const tbCount = await prisma.trialBalanceLine.count({
          where: { trialBalance: { engagementId } },
        });
        passed = tbCount > 0;
        if (passed) message = `${tbCount} TB rows imported`;
        break;
      }

      case "gl-uploaded": {
        const glCount = await prisma.gLEntry.count({
          where: { engagementId },
        });
        passed = glCount > 0;
        if (passed) message = `GL entries imported`;
        break;
      }

      case "batch-tracked": {
        const batchCount = await prisma.importBatch.count({
          where: { engagementId },
        });
        passed = batchCount > 0;
        if (passed) message = `${batchCount} upload batch(es) tracked`;
        break;
      }

      case "template-checked": {
        const validatedBatch = await prisma.importBatch.findFirst({
          where: { engagementId, validatedAt: { not: null } },
        });
        passed = !!validatedBatch;
        if (passed) message = "Template format verified";
        break;
      }

      case "tb-validated": {
        const tbRows = await prisma.trialBalanceLine.count({
          where: { trialBalance: { engagementId } },
        });
        if (tbRows === 0) {
          message = "No TB data to validate";
          break;
        }
        const tbBlockers = await prisma.reconIssue.count({
          where: { engagementId, tab: "TB", blocking: true, resolvedAt: null },
        });
        passed = tbRows > 0 && tbBlockers === 0;
        if (passed) message = "TB data validated — no blockers";
        else message = `${tbBlockers} unresolved TB blocker(s)`;
        break;
      }

      case "gl-reconciled": {
        const glCount = await prisma.gLEntry.count({
          where: { engagementId },
        });
        if (glCount === 0) {
          message = "No GL data to reconcile";
          break;
        }
        const reconBlockers = await prisma.reconIssue.count({
          where: { engagementId, tab: "GL", blocking: true, resolvedAt: null },
        });
        passed = glCount > 0 && reconBlockers === 0;
        if (passed) message = "GL reconciled to TB — no blockers";
        else message = `${reconBlockers} unresolved GL reconciliation blocker(s)`;
        break;
      }

      case "duplicates-cleared": {
        const dupIssues = await prisma.reconIssue.count({
          where: {
            engagementId,
            ruleCode: { contains: "DUPLICATE" },
            blocking: true,
            resolvedAt: null,
          },
        });
        passed = dupIssues === 0;
        if (passed) message = "No unresolved duplicate entries";
        else message = `${dupIssues} unresolved duplicate issue(s)`;
        break;
      }

      case "blockers-resolved": {
        const allBlockers = await prisma.reconIssue.count({
          where: { engagementId, blocking: true, resolvedAt: null },
        });
        passed = allBlockers === 0;
        if (passed) message = "All validation blockers resolved";
        else message = `${allBlockers} unresolved blocker(s) remain`;
        break;
      }

      case "coa-mapped": {
        const totalAccounts = await prisma.coAAccount.count({ where: { engagementId } });
        const mappedCount = await prisma.coAAccount.count({
          where: { engagementId, fsLineItem: { not: null } },
        });
        passed = totalAccounts > 0 && mappedCount > 0;
        if (passed) message = `${mappedCount}/${totalAccounts} accounts mapped to FS line items`;
        else if (totalAccounts === 0) message = "No CoA accounts loaded";
        else message = `${mappedCount}/${totalAccounts} mapped — mapping required`;
        break;
      }

      case "fs-heads-mapped": {
        const fsHeadCount = await prisma.fSHead.count({
          where: { engagementId },
        });
        passed = fsHeadCount > 0;
        if (passed) message = `${fsHeadCount} FS heads assigned`;
        else message = "No FS heads created — generate from mappings";
        break;
      }

      case "lead-schedules-grouped": {
        const fsHeadCount = await prisma.fSHead.count({
          where: { engagementId },
        });
        passed = fsHeadCount > 0;
        if (passed) message = `${fsHeadCount} lead schedule group(s) available`;
        else message = "Lead schedules not yet grouped";
        break;
      }

      case "unmapped-reviewed": {
        const totalAccounts = await prisma.coAAccount.count({ where: { engagementId } });
        const mappedCount = await prisma.coAAccount.count({
          where: { engagementId, fsLineItem: { not: null } },
        });
        const flaggedCount = await prisma.coAAccount.count({
          where: { engagementId, fsLineItem: null, notesDisclosureRef: { not: null } },
        });
        const unmappedUnflagged = totalAccounts - mappedCount - flaggedCount;
        passed = totalAccounts > 0 && unmappedUnflagged === 0;
        if (passed) message = "All accounts mapped or explicitly flagged";
        else if (totalAccounts === 0) message = "No CoA accounts loaded";
        else message = `${unmappedUnflagged} account(s) neither mapped nor flagged`;
        break;
      }

      case "mapping-score-met": {
        const totalAccounts = await prisma.coAAccount.count({ where: { engagementId } });
        const mappedCount = await prisma.coAAccount.count({
          where: { engagementId, fsLineItem: { not: null } },
        });
        const score = totalAccounts > 0 ? Math.round((mappedCount / totalAccounts) * 100) : 0;
        passed = score >= 95;
        if (passed) message = `Mapping completeness ${score}% — threshold met`;
        else if (totalAccounts === 0) message = "No CoA accounts loaded";
        else message = `Mapping completeness ${score}% — need 95% minimum`;
        break;
      }

      case "benchmark-selected": {
        const matCalc = await prisma.materialityCalculation.findFirst({
          where: { engagementId },
          select: { primaryBenchmarkType: true },
        });
        passed = !!matCalc?.primaryBenchmarkType;
        if (passed) message = `Benchmark: ${matCalc!.primaryBenchmarkType}`;
        else message = "No benchmark selected";
        break;
      }

      case "materiality-calculated": {
        const matCalc = await prisma.materialityCalculation.findFirst({
          where: { engagementId },
          select: { id: true, overallMateriality: true, performanceMateriality: true },
        });
        passed = !!matCalc;
        if (passed) message = "Materiality calculated";
        else message = "Materiality not yet calculated";
        break;
      }

      case "qualitative-assessed": {
        const matCalc = await prisma.materialityCalculation.findFirst({
          where: { engagementId },
          select: { riskFactorsConsidered: true, calculationNotes: true },
        });
        passed = !!(matCalc && (matCalc.riskFactorsConsidered.length > 0 || matCalc.calculationNotes));
        if (passed) message = "Qualitative factors documented";
        else message = "Qualitative factors not yet assessed";
        break;
      }

      case "materiality-approved": {
        const matCalc = await prisma.materialityCalculation.findFirst({
          where: { engagementId },
          select: { approvedAt: true },
        });
        passed = !!matCalc?.approvedAt;
        if (passed) message = "Materiality approved by partner";
        else message = "Awaiting partner approval";
        break;
      }

      case "risks-identified":
      case "entity-risks-documented": {
        const riskCount = await prisma.riskAssessment.count({
          where: { engagementId },
        });
        passed = riskCount > 0;
        if (passed) message = `${riskCount} risks documented`;
        break;
      }

      case "fs-level-risks-mapped": {
        const fsRiskCount = await prisma.riskAssessment.count({
          where: { engagementId, fsArea: { not: null } },
        });
        passed = fsRiskCount > 0;
        if (passed) message = `${fsRiskCount} risks mapped to FS areas`;
        else message = "No risks mapped to FS areas";
        break;
      }

      case "assertion-risks-linked": {
        const assertionRiskCount = await prisma.riskAssessment.count({
          where: { engagementId, assertionImpacts: { isEmpty: false } },
        });
        passed = assertionRiskCount > 0;
        if (passed) message = `${assertionRiskCount} risks linked to assertions`;
        else message = "No risks linked to assertions";
        break;
      }

      case "significant-risks-identified": {
        const sigRiskCount = await prisma.riskAssessment.count({
          where: { engagementId, isSignificantRisk: true },
        });
        passed = sigRiskCount > 0;
        if (passed) message = `${sigRiskCount} significant risks identified`;
        else message = "No significant risks flagged";
        break;
      }

      case "fraud-risks-assessed": {
        const fraudRiskCount = await prisma.riskAssessment.count({
          where: { engagementId, isFraudRisk: true },
        });
        passed = fraudRiskCount > 0;
        if (passed) message = `${fraudRiskCount} fraud risks assessed`;
        else message = "Fraud risk assessment not completed";
        break;
      }

      case "risk-register-complete": {
        const totalRisks = await prisma.riskAssessment.count({
          where: { engagementId },
        });
        const risksWithResponse = await prisma.riskAssessment.count({
          where: { engagementId, plannedResponse: { not: null } },
        });
        passed = totalRisks > 0 && risksWithResponse >= totalRisks * 0.8;
        if (passed) message = `${risksWithResponse}/${totalRisks} risks have planned responses`;
        else message = totalRisks === 0 ? "No risks in register" : `${risksWithResponse}/${totalRisks} risks have responses (80% required)`;
        break;
      }

      case "risk-conclusion-documented": {
        const hasRisks = await prisma.riskAssessment.count({ where: { engagementId } });
        const hasFraud = await prisma.riskAssessment.count({ where: { engagementId, isFraudRisk: true } });
        const hasSignificant = await prisma.riskAssessment.count({ where: { engagementId, isSignificantRisk: true } });
        passed = hasRisks > 0 && hasFraud > 0 && hasSignificant > 0;
        if (passed) message = "Risk conclusion documented with fraud and significant risks";
        else message = "Risk conclusion incomplete — need risks, fraud assessment, and significant risks";
        break;
      }

      case "strategy-documented": {
        const strategy = await prisma.auditStrategy.findFirst({
          where: { engagementId },
          select: { overallStrategy: true, auditApproach: true },
        });
        passed = !!(strategy?.overallStrategy || strategy?.auditApproach);
        if (passed) message = "Audit strategy documented";
        else message = "Audit strategy not yet documented";
        break;
      }

      case "scope-defined": {
        const scopeStrategy = await prisma.auditStrategy.findFirst({
          where: { engagementId },
          select: { substantiveApproach: true, controlsReliance: true },
        });
        passed = !!(scopeStrategy?.substantiveApproach || scopeStrategy?.controlsReliance);
        if (passed) message = "Audit scope defined";
        else message = "Audit scope not yet defined";
        break;
      }

      case "team-allocated": {
        const teamCount = await prisma.engagementTeam.count({
          where: { engagementId },
        });
        passed = teamCount > 0;
        if (passed) message = `${teamCount} team members allocated`;
        else message = "No team members allocated";
        break;
      }

      case "planning-memo-complete": {
        const memo = await prisma.planningMemo.findFirst({
          where: { engagementId },
          select: { id: true },
        });
        passed = !!memo;
        if (passed) message = "Planning memo exists";
        else message = "Planning memo not yet created";
        break;
      }

      case "procedures-linked": {
        const procCount = await prisma.engagementProcedure.count({
          where: { engagementId },
        });
        const linkedCount = await prisma.engagementProcedure.count({
          where: { engagementId, linkedRiskIds: { isEmpty: false } },
        });
        passed = procCount > 0 && linkedCount > 0;
        if (passed) message = `${linkedCount}/${procCount} procedures linked to risks`;
        else message = procCount === 0 ? "No procedures defined" : "No procedures linked to risks";
        break;
      }

      case "high-risk-procedures-exist": {
        const highRisks = await prisma.riskAssessment.findMany({
          where: {
            engagementId,
            OR: [
              { riskOfMaterialMisstatement: "HIGH" },
              { riskOfMaterialMisstatement: "SIGNIFICANT" },
              { isSignificantRisk: true },
            ],
          },
          select: { id: true, fsArea: true },
        });
        if (highRisks.length === 0) {
          passed = true;
          message = "No high-risk areas identified";
        } else {
          const highRiskIds = highRisks.map(r => r.id);
          const procsForHighRisk = await prisma.engagementProcedure.findMany({
            where: { engagementId },
            select: { linkedRiskIds: true },
          });
          const coveredRiskIds = new Set<string>();
          for (const proc of procsForHighRisk) {
            for (const riskId of proc.linkedRiskIds) {
              if (highRiskIds.includes(riskId)) coveredRiskIds.add(riskId);
            }
          }
          passed = coveredRiskIds.size >= highRisks.length;
          if (passed) message = `All ${highRisks.length} high-risk areas have procedures`;
          else message = `${coveredRiskIds.size}/${highRisks.length} high-risk areas covered — ${highRisks.length - coveredRiskIds.size} still need procedures`;
        }
        break;
      }

      case "assertions-covered": {
        const procsWithAssertions = await prisma.engagementProcedure.count({
          where: { engagementId, assertions: { isEmpty: false } },
        });
        const totalProcs = await prisma.engagementProcedure.count({
          where: { engagementId },
        });
        passed = totalProcs > 0 && procsWithAssertions >= totalProcs * 0.8;
        if (passed) message = `${procsWithAssertions}/${totalProcs} procedures have assertion coverage`;
        else message = totalProcs === 0 ? "No procedures defined" : `${procsWithAssertions}/${totalProcs} procedures have assertions (80% required)`;
        break;
      }

      case "sampling-populations-defined": {
        const samplingProcs = await prisma.engagementProcedure.findMany({
          where: {
            engagementId,
            sampleSize: { not: null, gt: 0 },
          },
          select: { id: true, populationSize: true, samplingMethod: true },
        });
        if (samplingProcs.length === 0) {
          passed = true;
          message = "No sampling-dependent procedures";
        } else {
          const withPopulation = samplingProcs.filter(p => p.populationSize && p.populationSize > 0 && p.samplingMethod).length;
          passed = withPopulation >= samplingProcs.length;
          if (passed) message = `All ${samplingProcs.length} sampling procedures have population and method defined`;
          else message = `${withPopulation}/${samplingProcs.length} sampling procedures have population defined`;
        }
        break;
      }

      case "sampling-defined":
      case "sampling-rationale-documented": {
        const samplingFrames = await prisma.samplingFrame.count({
          where: { engagementId },
        });
        const procsWithSampling = await prisma.engagementProcedure.count({
          where: { engagementId, sampleSize: { not: null, gt: 0 } },
        });
        passed = samplingFrames > 0 || procsWithSampling > 0;
        if (passed) message = `${samplingFrames} sampling frames, ${procsWithSampling} procedures with sample sizes`;
        else message = "No sampling parameters defined";
        break;
      }

      case "reviewer-status-clear": {
        const totalProcsForReview = await prisma.engagementProcedure.count({
          where: { engagementId },
        });
        const reviewedProcs = await prisma.engagementProcedure.count({
          where: { engagementId, reviewedById: { not: null } },
        });
        passed = totalProcsForReview === 0 || reviewedProcs >= totalProcsForReview * 0.5;
        if (passed) message = totalProcsForReview === 0 ? "No procedures to review" : `${reviewedProcs}/${totalProcsForReview} procedures reviewed`;
        else message = `${reviewedProcs}/${totalProcsForReview} procedures reviewed (50% required)`;
        break;
      }

      case "procedures-executed": {
        const totalExecProcs = await prisma.engagementProcedure.count({
          where: { engagementId },
        });
        const notStartedProcs = await prisma.engagementProcedure.count({
          where: { engagementId, status: "NOT_STARTED" },
        });
        if (totalExecProcs === 0) {
          passed = false;
          message = "No procedures assigned for execution";
        } else {
          passed = notStartedProcs === 0;
          if (passed) message = `All ${totalExecProcs} procedures have been executed`;
          else message = `${notStartedProcs}/${totalExecProcs} procedures still NOT_STARTED`;
        }
        break;
      }

      case "workpapers-documented": {
        const totalWpProcs = await prisma.engagementProcedure.count({
          where: { engagementId },
        });
        const procsWithWp = await prisma.engagementProcedure.count({
          where: { engagementId, workpaperRef: { not: null } },
        });
        if (totalWpProcs === 0) {
          passed = false;
          message = "No procedures to document";
        } else {
          passed = procsWithWp >= totalWpProcs * 0.8;
          if (passed) message = `${procsWithWp}/${totalWpProcs} procedures have workpaper references`;
          else message = `${procsWithWp}/${totalWpProcs} procedures documented (80% required)`;
        }
        break;
      }

      case "critical-exceptions-resolved": {
        const unresolvedMisstatements = await prisma.misstatement.count({
          where: {
            engagementId,
            status: "IDENTIFIED",
          },
        });
        passed = unresolvedMisstatements === 0;
        if (passed) message = "No unresolved critical exceptions";
        else message = `${unresolvedMisstatements} unresolved misstatement(s) require attention`;
        break;
      }

      case "conclusions-documented": {
        const completedProcsForConc = await prisma.engagementProcedure.count({
          where: { engagementId, status: "COMPLETED" },
        });
        const completedWithConclusion = await prisma.engagementProcedure.count({
          where: { engagementId, status: "COMPLETED", conclusion: { not: null } },
        });
        if (completedProcsForConc === 0) {
          passed = true;
          message = "No completed procedures yet";
        } else {
          passed = completedWithConclusion >= completedProcsForConc;
          if (passed) message = `All ${completedProcsForConc} completed procedures have conclusions`;
          else message = `${completedWithConclusion}/${completedProcsForConc} completed procedures have conclusions`;
        }
        break;
      }

      case "review-notes-cleared": {
        const totalReviewNotes = await prisma.reviewNote.count({
          where: { engagementId, phase: "EXECUTION" },
        });
        const resolvedNotes = await prisma.reviewNote.count({
          where: { engagementId, phase: "EXECUTION", status: { in: ["ADDRESSED", "CLEARED"] } },
        });
        if (totalReviewNotes === 0) {
          passed = true;
          message = "No review notes for execution";
        } else {
          passed = resolvedNotes >= totalReviewNotes * 0.75;
          if (passed) message = `${resolvedNotes}/${totalReviewNotes} review notes resolved`;
          else message = `${resolvedNotes}/${totalReviewNotes} review notes resolved (75% required)`;
        }
        break;
      }

      case "evidence-attached": {
        const evidenceCount = await prisma.evidenceFile.count({
          where: { engagementId, phase: "EXECUTION" },
        });
        passed = evidenceCount > 0;
        if (passed) message = `${evidenceCount} evidence file(s) attached`;
        else message = "No evidence files attached for execution";
        break;
      }

      case "evidence-linked": {
        const executedProcs = await prisma.engagementProcedure.findMany({
          where: { engagementId, status: { in: ["COMPLETED", "IN_PROGRESS"] } },
          select: { id: true },
        });
        const evidenceFiles = await prisma.evidenceFile.findMany({
          where: { engagementId, phase: "EXECUTION", status: "ACTIVE" },
          select: { procedureIds: true },
        });
        const linkedProcIds = new Set(evidenceFiles.flatMap(e => e.procedureIds));
        const unlinkedProcs = executedProcs.filter(p => !linkedProcIds.has(p.id));
        if (executedProcs.length === 0) {
          passed = true;
          message = "No executed procedures to link";
        } else {
          passed = unlinkedProcs.length === 0;
          if (passed) message = `All ${executedProcs.length} executed procedure(s) have linked evidence`;
          else message = `${unlinkedProcs.length} of ${executedProcs.length} executed procedure(s) lack linked evidence`;
        }
        break;
      }

      case "evidence-categorized": {
        const uncategorizedEvidence = await prisma.evidenceFile.count({
          where: { engagementId, phase: "EXECUTION", status: "ACTIVE", sourceType: null },
        });
        const totalActiveEvidence = await prisma.evidenceFile.count({
          where: { engagementId, phase: "EXECUTION", status: "ACTIVE" },
        });
        if (totalActiveEvidence === 0) {
          passed = true;
          message = "No evidence files to categorize";
        } else {
          passed = uncategorizedEvidence === 0;
          if (passed) message = `All ${totalActiveEvidence} evidence file(s) categorized`;
          else message = `${uncategorizedEvidence} of ${totalActiveEvidence} evidence file(s) missing source type categorization`;
        }
        break;
      }

      case "sufficiency-confirmed": {
        const highRiskProcs = await prisma.engagementProcedure.findMany({
          where: { engagementId, status: { in: ["COMPLETED", "IN_PROGRESS"] } },
          select: { id: true, linkedRiskIds: true },
        });
        const assessedRisks = await prisma.assessedRisk.findMany({
          where: { engagementId, riskOfMaterialMisstatement: { in: ["HIGH", "SIGNIFICANT"] } },
          select: { id: true },
        });
        const highRiskIds = new Set(assessedRisks.map(r => r.id));
        const highRiskProcedures = highRiskProcs.filter(p => p.linkedRiskIds.some(rid => highRiskIds.has(rid)));

        if (highRiskProcedures.length === 0) {
          passed = true;
          message = "No high-risk procedures to assess";
        } else {
          const evidenceForProcs = await prisma.evidenceFile.findMany({
            where: { engagementId, phase: "EXECUTION", status: "ACTIVE" },
            select: { procedureIds: true, sufficiencyRating: true },
          });
          const procsWithInsufficientEvidence = highRiskProcedures.filter(proc => {
            const linkedEvidence = evidenceForProcs.filter(e => e.procedureIds.includes(proc.id));
            if (linkedEvidence.length === 0) return true;
            return linkedEvidence.every(e => !e.sufficiencyRating || e.sufficiencyRating === "INSUFFICIENT" || e.sufficiencyRating === "MARGINAL");
          });
          passed = procsWithInsufficientEvidence.length === 0;
          if (passed) message = `All ${highRiskProcedures.length} high-risk procedure(s) have sufficient evidence`;
          else message = `${procsWithInsufficientEvidence.length} of ${highRiskProcedures.length} high-risk procedure(s) lack adequate evidence`;
        }
        break;
      }

      case "version-history-maintained": {
        const supersededWithoutReason = await prisma.evidenceFile.count({
          where: { engagementId, status: "SUPERSEDED", supersededReason: null },
        });
        passed = supersededWithoutReason === 0;
        if (passed) message = "All superseded files have documented reasons";
        else message = `${supersededWithoutReason} superseded file(s) lack documented reasons`;
        break;
      }

      case "reviewer-comments-addressed": {
        const evidenceWithUnreviewedNotes = await prisma.evidenceFile.count({
          where: {
            engagementId,
            phase: "EXECUTION",
            status: "ACTIVE",
            reviewerNotes: { not: null },
            reviewedById: null,
          },
        });
        passed = evidenceWithUnreviewedNotes === 0;
        if (passed) message = "All reviewer comments addressed";
        else message = `${evidenceWithUnreviewedNotes} evidence file(s) have unaddressed reviewer comments`;
        break;
      }

      case "critical-findings-resolved": {
        const criticalObs = await db.observation.count({
          where: {
            engagementId,
            severity: { in: ["CRITICAL", "HIGH"] },
            status: { in: ["OPEN", "UNDER_REVIEW"] },
          },
        });
        passed = criticalObs === 0;
        if (passed) message = "All critical/high-severity findings resolved";
        else message = `${criticalObs} critical/high finding(s) remain unresolved`;
        break;
      }

      case "management-responses-obtained": {
        const obsNeedingResponse = await db.observation.count({
          where: {
            engagementId,
            status: { in: ["OPEN", "UNDER_REVIEW"] },
            severity: { in: ["CRITICAL", "HIGH", "MEDIUM"] },
            managementResponse: null,
          },
        });
        passed = obsNeedingResponse === 0;
        if (passed) message = "All observations have management responses";
        else message = `${obsNeedingResponse} observation(s) awaiting management response`;
        break;
      }

      case "partner-review-observations": {
        const critHighObs = await db.observation.findMany({
          where: {
            engagementId,
            severity: { in: ["CRITICAL", "HIGH"] },
          },
          select: { partnerApprovedById: true },
        });
        const unreviewed = critHighObs.filter((o: any) => !o.partnerApprovedById).length;
        passed = unreviewed === 0 || critHighObs.length === 0;
        if (passed) message = "Partner review complete for critical/high observations";
        else message = `${unreviewed} critical/high observation(s) pending partner review`;
        break;
      }

      case "adjustments-summarized": {
        const adjCount = await db.auditAdjustment.count({
          where: { engagementId },
        });
        passed = adjCount > 0;
        if (passed) message = `${adjCount} adjustment(s) in summary`;
        else message = "No adjustments recorded — create at least one adjustment entry";
        break;
      }

      case "sad-classified": {
        const uncorrected = await db.auditAdjustment.findMany({
          where: {
            engagementId,
            adjustmentType: "UNCORRECTED",
            isClearlyTrivial: false,
          },
          select: { misstatementClassification: true },
        });
        const unclassified = uncorrected.filter((a: any) => !a.misstatementClassification).length;
        passed = unclassified === 0;
        if (passed) message = "All non-trivial uncorrected misstatements classified";
        else message = `${unclassified} uncorrected misstatement(s) need classification (factual/judgmental/projected)`;
        break;
      }

      case "management-acceptance-recorded": {
        const adjTotal = await db.auditAdjustment.count({ where: { engagementId } });
        const adjPending = await db.auditAdjustment.count({
          where: { engagementId, managementAccepted: null },
        });
        passed = adjPending === 0 || adjTotal === 0;
        if (passed) message = "Management acceptance recorded for all adjustments";
        else message = `${adjPending} adjustment(s) pending management acceptance`;
        break;
      }

      case "cumulative-effect-assessed": {
        const uncorrectedAdj = await db.auditAdjustment.findMany({
          where: { engagementId, adjustmentType: "UNCORRECTED" },
          select: { netImpact: true },
        });
        const cumulativeUncorrected = uncorrectedAdj.reduce((sum: number, a: any) => sum + Math.abs(Number(a.netImpact) || 0), 0);
        passed = cumulativeUncorrected === 0 || uncorrectedAdj.length === 0;
        if (passed) message = "No uncorrected misstatements or cumulative effect is zero";
        else message = `Cumulative uncorrected misstatements: ${cumulativeUncorrected.toLocaleString()} — review against materiality`;
        break;
      }

      case "completion-checklist":
      case "subsequent-events":
      case "going-concern":
      case "representation-letter": {
        passed = isBackendPhaseActive(statusMap, "FINALIZATION");
        if (passed) message = "Finalization phase active";
        break;
      }

      case "finalization-approved": {
        passed = isBackendPhaseCompleted(statusMap, "FINALIZATION");
        if (passed) message = "Finalization completed";
        break;
      }

      case "opinion-determined":
      case "reports-generated": {
        passed = isBackendPhaseActive(statusMap, "REPORTING");
        if (passed) message = "Reporting phase active";
        break;
      }

      case "report-pack-frozen":
      case "eqcr-issues-resolved":
      case "eqcr-release": {
        passed = isBackendPhaseActive(statusMap, "EQCR");
        if (passed) message = "EQCR phase active";
        break;
      }

      case "eqcr-released": {
        passed = isBackendPhaseCompleted(statusMap, "EQCR");
        if (passed) message = "EQCR completed";
        break;
      }

      case "archive-snapshot": {
        passed = isBackendPhaseActive(statusMap, "INSPECTION");
        if (passed) message = "Inspection phase active";
        break;
      }

      default: {
        message = `No evaluator implemented for gate: ${gate.id}`;
        break;
      }
    }
  } catch (error) {
    message = `Gate evaluation error: ${error instanceof Error ? error.message : String(error)}`;
  }

  return {
    gateId: gate.id,
    label: gate.label,
    type: gate.type,
    passed,
    message,
    isaReference: gate.isaReference,
  };
}

export async function evaluatePhaseGates(
  engagementId: string,
  phaseKey: string
): Promise<PhaseGateEvaluation> {
  const phase = getPhaseByKey(phaseKey);
  if (!phase) {
    return {
      phaseKey,
      phaseLabel: phaseKey,
      canEnter: false,
      canComplete: false,
      prerequisitesMet: false,
      hardGatesPassed: false,
      softGatesPassed: false,
      gates: [],
      blockers: [`Unknown phase: ${phaseKey}`],
      warnings: [],
    };
  }

  const statusMap = await getPhaseStatusMap(engagementId);
  const prerequisites = getPrerequisitePhases(phaseKey);
  const blockers: string[] = [];
  const warnings: string[] = [];

  let prerequisitesMet = true;
  for (const prereq of prerequisites) {
    const active = isBackendPhaseActive(statusMap, prereq.backendPhase);
    if (!active) {
      blockers.push(`Prerequisite "${prereq.label}" (${prereq.backendPhase}) is not active or completed`);
      prerequisitesMet = false;
      continue;
    }
    const prereqPhase = CANONICAL_PHASES.find(p => p.key === prereq.key);
    if (prereqPhase) {
      const prereqGates = await evaluateGatesForPhase(engagementId, prereqPhase, statusMap);
      const prereqHardGatesFailed = prereqGates.filter(g => g.type === "hard" && !g.passed);
      if (prereqHardGatesFailed.length > 0) {
        blockers.push(`Prerequisite "${prereq.label}" has unmet hard gates: ${prereqHardGatesFailed.map(g => g.label).join(", ")}`);
        prerequisitesMet = false;
      }
    }
  }

  const gateResults = await evaluateGatesForPhase(engagementId, phase, statusMap);
  const gates: GateCheckResult[] = gateResults;

  const hardGatesPassed = gates.filter(g => g.type === "hard").every(g => g.passed);
  const softGatesPassed = gates.filter(g => g.type === "soft").every(g => g.passed);

  gates.filter(g => !g.passed && g.type === "soft").forEach(g => {
    warnings.push(`${g.label}: ${g.message}`);
  });

  return {
    phaseKey: phase.key,
    phaseLabel: phase.label,
    canEnter: prerequisitesMet,
    canComplete: prerequisitesMet && hardGatesPassed,
    prerequisitesMet,
    hardGatesPassed,
    softGatesPassed,
    gates,
    blockers,
    warnings,
  };
}

export async function evaluateAllGates(
  engagementId: string
): Promise<EngagementGateSnapshot> {
  const workspacePhases = CANONICAL_PHASES.filter(p => p.order >= 2);
  const phases: PhaseGateEvaluation[] = [];

  for (const phase of workspacePhases) {
    const evaluation = await evaluatePhaseGates(engagementId, phase.key);
    phases.push(evaluation);
  }

  let currentPhaseKey: string | null = null;
  let nextAvailablePhaseKey: string | null = null;

  const statusMap = await getPhaseStatusMap(engagementId);

  for (const phase of workspacePhases) {
    const backendStatus = statusMap.get(phase.backendPhase);
    if (backendStatus === "IN_PROGRESS" || backendStatus === "UNDER_REVIEW") {
      currentPhaseKey = phase.key;
    }
  }

  for (const phase of workspacePhases) {
    const backendStatus = statusMap.get(phase.backendPhase);
    if (!backendStatus || backendStatus === "NOT_STARTED") {
      const eval_ = phases.find(p => p.phaseKey === phase.key);
      if (eval_?.canEnter) {
        nextAvailablePhaseKey = phase.key;
        break;
      }
    }
  }

  return {
    engagementId,
    timestamp: new Date(),
    phases,
    currentPhaseKey,
    nextAvailablePhaseKey,
  };
}

export async function canAdvanceToPhase(
  engagementId: string,
  targetPhaseKey: string
): Promise<{ allowed: boolean; blockers: string[]; warnings: string[] }> {
  const evaluation = await evaluatePhaseGates(engagementId, targetPhaseKey);
  return {
    allowed: evaluation.canEnter,
    blockers: evaluation.blockers,
    warnings: evaluation.warnings,
  };
}
