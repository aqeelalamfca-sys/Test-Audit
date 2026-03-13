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
        const criticalObs = await prisma.observation.count({
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
        const obsNeedingResponse = await prisma.observation.count({
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
        const critHighObs = await prisma.observation.findMany({
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
        const adjCount = await prisma.auditAdjustment.count({
          where: { engagementId },
        });
        passed = adjCount > 0;
        if (passed) message = `${adjCount} adjustment(s) in summary`;
        else message = "No adjustments recorded — create at least one adjustment entry";
        break;
      }

      case "sad-classified": {
        const uncorrected = await prisma.auditAdjustment.findMany({
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
        const adjTotal = await prisma.auditAdjustment.count({ where: { engagementId } });
        const adjPending = await prisma.auditAdjustment.count({
          where: { engagementId, managementAccepted: null },
        });
        passed = adjPending === 0 || adjTotal === 0;
        if (passed) message = "Management acceptance recorded for all adjustments";
        else message = `${adjPending} adjustment(s) pending management acceptance`;
        break;
      }

      case "cumulative-effect-assessed": {
        const uncorrectedAdj = await prisma.auditAdjustment.findMany({
          where: { engagementId, adjustmentType: "UNCORRECTED" },
          select: { netImpact: true },
        });
        const cumulativeUncorrected = uncorrectedAdj.reduce((sum: number, a: any) => sum + Math.abs(Number(a.netImpact) || 0), 0);
        passed = cumulativeUncorrected === 0 || uncorrectedAdj.length === 0;
        if (passed) message = "No uncorrected misstatements or cumulative effect is zero";
        else message = `Cumulative uncorrected misstatements: ${cumulativeUncorrected.toLocaleString()} — review against materiality`;
        break;
      }

      case "completion-checklist": {
        const checklists = await prisma.complianceChecklist.findMany({
          where: { engagementId, checklistType: "COMPLETION" },
          select: { status: true },
        });
        const allDone = checklists.length > 0 && checklists.every((c: any) => c.status === "COMPLETED" || c.status === "REVIEWED" || c.status === "APPROVED");
        passed = allDone;
        if (passed) message = `${checklists.length} completion checklist item(s) addressed`;
        else message = checklists.length === 0 ? "No completion checklist created" : `${checklists.filter((c: any) => c.status !== "COMPLETED" && c.status !== "REVIEWED" && c.status !== "APPROVED").length} checklist item(s) still pending`;
        break;
      }

      case "subsequent-events": {
        const events = await prisma.subsequentEvent.findMany({
          where: { engagementId },
          select: { id: true, impactAssessment: true, reviewedById: true },
        });
        passed = events.length === 0 || events.every((e: any) => e.impactAssessment && e.reviewedById);
        if (events.length === 0) message = "No subsequent events identified (review documented)";
        else if (passed) message = `${events.length} subsequent event(s) reviewed and assessed`;
        else message = `${events.filter((e: any) => !e.impactAssessment || !e.reviewedById).length} event(s) pending assessment/review`;
        break;
      }

      case "going-concern": {
        const gcAssessment = await prisma.goingConcernAssessment.findFirst({
          where: { engagementId },
          select: { overallConclusion: true, basisForConclusion: true },
        });
        passed = !!(gcAssessment?.overallConclusion && gcAssessment?.basisForConclusion);
        if (passed) message = "Going concern assessment documented with conclusion";
        else message = gcAssessment ? "Going concern assessment incomplete — conclusion or basis missing" : "No going concern assessment documented";
        break;
      }

      case "representation-letter": {
        const reps = await prisma.writtenRepresentation.findMany({
          where: { engagementId },
          select: { status: true, representationType: true },
        });
        const mgmtRep = reps.find((r: any) => r.representationType === "MANAGEMENT" || r.representationType === "GENERAL");
        passed = !!(mgmtRep && (mgmtRep.status === "OBTAINED" || mgmtRep.status === "SIGNED" || mgmtRep.status === "COMPLETED"));
        if (passed) message = "Management representation letter obtained";
        else message = reps.length === 0 ? "No representation letters created" : "Management representation letter not yet obtained/signed";
        break;
      }

      case "findings-addressed": {
        const openObs = await prisma.observation.count({
          where: { engagementId, status: { in: ["OPEN", "UNDER_REVIEW"] }, severity: { in: ["HIGH", "CRITICAL"] } },
        });
        const pendingAdj = await prisma.auditAdjustment.count({
          where: { engagementId, status: "IDENTIFIED" },
        });
        passed = openObs === 0 && pendingAdj === 0;
        if (passed) message = "All critical findings resolved and adjustments finalized";
        else {
          const parts = [];
          if (openObs > 0) parts.push(`${openObs} critical/high finding(s) unresolved`);
          if (pendingAdj > 0) parts.push(`${pendingAdj} adjustment(s) still at identified status`);
          message = parts.join("; ");
        }
        break;
      }

      case "required-signoffs": {
        const memo = await prisma.completionMemo.findUnique({
          where: { engagementId },
          select: { managerReviewedById: true, partnerApprovedById: true },
        });
        passed = !!(memo?.managerReviewedById && memo?.partnerApprovedById);
        if (passed) message = "Manager and partner sign-offs obtained";
        else if (memo?.managerReviewedById) message = "Manager signed off — partner approval pending";
        else message = "Completion memo not yet reviewed by manager";
        break;
      }

      case "disclosure-reviewed":
      case "final-analytics-done": {
        passed = isBackendPhaseActive(statusMap, "FINALIZATION");
        if (passed) message = gate.id === "disclosure-reviewed" ? "Disclosure review in progress" : "Final analytics in progress";
        break;
      }

      case "completion-memo-done": {
        const memoExists = await prisma.completionMemo.findUnique({
          where: { engagementId },
          select: { id: true, overallConclusion: true },
        });
        passed = !!(memoExists?.overallConclusion);
        if (passed) message = "Completion memo prepared with overall conclusion";
        else message = memoExists ? "Completion memo started but overall conclusion missing" : "No completion memo created";
        break;
      }

      case "partner-review-ready": {
        const memoForReview = await prisma.completionMemo.findUnique({
          where: { engagementId },
          select: { managerReviewedById: true, overallConclusion: true },
        });
        const gcForReview = await prisma.goingConcernAssessment.findFirst({
          where: { engagementId },
          select: { overallConclusion: true },
        });
        const openCritical = await prisma.observation.count({
          where: { engagementId, status: { in: ["OPEN", "UNDER_REVIEW"] }, severity: { in: ["HIGH", "CRITICAL"] } },
        });
        passed = !!(memoForReview?.managerReviewedById && memoForReview?.overallConclusion && gcForReview?.overallConclusion && openCritical === 0);
        if (passed) message = "All completion procedures done — ready for partner review";
        else {
          const issues = [];
          if (!memoForReview?.overallConclusion) issues.push("completion memo incomplete");
          if (!memoForReview?.managerReviewedById) issues.push("manager review pending");
          if (!gcForReview?.overallConclusion) issues.push("going concern not concluded");
          if (openCritical > 0) issues.push(`${openCritical} critical findings unresolved`);
          message = `Not ready: ${issues.join(", ")}`;
        }
        break;
      }

      case "finalization-approved": {
        const finMemo = await prisma.completionMemo.findUnique({
          where: { engagementId },
          select: { partnerApprovedById: true },
        });
        passed = !!(finMemo?.partnerApprovedById) || isBackendPhaseCompleted(statusMap, "FINALIZATION");
        if (passed) message = "Finalization approved — ready for opinion formation";
        else message = "Finalization phase must be completed and approved before generating opinion";
        break;
      }

      case "opinion-determined": {
        const engine = await prisma.opinionEngine.findFirst({
          where: { engagementId },
          orderBy: { version: "desc" },
          select: { recommendedCategory: true, partnerDecision: true },
        });
        passed = !!(engine?.recommendedCategory || engine?.partnerDecision === "ACCEPTED");
        if (passed) message = `Opinion type determined: ${engine?.recommendedCategory || "pending partner decision"}`;
        else message = "Audit opinion type must be selected and documented";
        break;
      }

      case "basis-documented": {
        const engineBasis = await prisma.opinionEngine.findFirst({
          where: { engagementId },
          orderBy: { version: "desc" },
          select: { recommendedCategory: true, justification: true },
        });
        if (!engineBasis) {
          passed = false;
          message = "No opinion engine record — run opinion analysis first";
        } else if (engineBasis.recommendedCategory === "UNMODIFIED") {
          passed = true;
          message = "Unmodified opinion — standard basis paragraph applies";
        } else {
          passed = !!(engineBasis.justification && engineBasis.justification.length > 20);
          if (passed) message = "Basis for modification documented";
          else message = "Modified opinion requires a documented basis for modification (ISA 705)";
        }
        break;
      }

      case "kam-documented": {
        const engineKam = await prisma.opinionEngine.findFirst({
          where: { engagementId },
          orderBy: { version: "desc" },
          select: { id: true },
        });
        const kamFindings = engineKam ? await prisma.opinionEngineFinding.count({
          where: { engineId: engineKam.id, category: "KEY_AUDIT_MATTER" },
        }) : 0;
        passed = kamFindings > 0;
        if (passed) message = `${kamFindings} key audit matter(s) documented`;
        else message = "Key audit matters should be identified (ISA 701) — soft requirement";
        break;
      }

      case "fs-pack-ready": {
        const fsDeliverables = await prisma.deliverable.count({
          where: { engagementId, deliverableType: { in: ["AUDIT_REPORT", "ENGAGEMENT_SUMMARY"] }, status: { in: ["FINAL", "ISSUED"] } },
        });
        passed = fsDeliverables > 0;
        if (passed) message = `${fsDeliverables} financial statement deliverable(s) finalized`;
        else message = "Complete financial statement pack must be assembled before report issuance";
        break;
      }

      case "management-letter-done": {
        const mgmtLetter = await prisma.deliverable.findFirst({
          where: { engagementId, deliverableType: "MANAGEMENT_LETTER" },
          select: { status: true },
        });
        passed = !!(mgmtLetter && (mgmtLetter.status === "DRAFT" || mgmtLetter.status === "FINAL" || mgmtLetter.status === "ISSUED"));
        if (passed) message = `Management letter prepared (${mgmtLetter!.status})`;
        else message = "Management letter / internal control letter should be prepared (ISA 265)";
        break;
      }

      case "deliverables-checklist-complete": {
        const allDeliverables = await prisma.deliverable.findMany({
          where: { engagementId },
          select: { status: true, deliverableType: true },
        });
        const requiredTypes = ["AUDIT_REPORT"];
        const hasRequired = requiredTypes.every(type => allDeliverables.some(d => d.deliverableType === type));
        passed = hasRequired && allDeliverables.length > 0;
        if (passed) message = `${allDeliverables.length} deliverable(s) tracked — all required types present`;
        else message = allDeliverables.length === 0 ? "No deliverables created" : "Required deliverable types missing (AUDIT_REPORT)";
        break;
      }

      case "report-package-generated": {
        const reportDelivs = await prisma.deliverable.count({
          where: { engagementId, status: { in: ["FINAL", "ISSUED"] } },
        });
        passed = reportDelivs > 0;
        if (passed) message = `${reportDelivs} deliverable(s) in final/issued status`;
        else message = "Report package should be generated and reviewed";
        break;
      }

      case "release-approved": {
        const issuedReport = await prisma.deliverable.findFirst({
          where: { engagementId, deliverableType: "AUDIT_REPORT", status: "ISSUED" },
          select: { issuedById: true, approvedById: true },
        });
        passed = !!(issuedReport?.approvedById && issuedReport?.issuedById);
        if (passed) message = "Audit report approved and issued";
        else if (issuedReport?.approvedById) message = "Report approved but not yet issued";
        else message = "Partner must approve the final report for release";
        break;
      }

      case "reports-generated": {
        const reportsGen = await prisma.deliverable.count({
          where: { engagementId, status: { in: ["DRAFT", "FINAL", "ISSUED"] } },
        });
        passed = reportsGen > 0;
        if (passed) message = `${reportsGen} report(s) generated`;
        else message = "Final audit report should be generated";
        break;
      }

      case "report-pack-frozen": {
        const frozenDeliverables = await prisma.deliverable.count({
          where: { engagementId, status: { in: ["FINAL", "ISSUED"] } },
        });
        passed = frozenDeliverables > 0;
        if (passed) message = `Report pack frozen (${frozenDeliverables} deliverable(s) finalized)`;
        else message = "Report pack must contain at least one finalized deliverable before EQCR";
        break;
      }

      case "eqcr-issues-resolved": {
        const eqcrAssignmentIssues = await prisma.eQCRAssignment.findUnique({
          where: { engagementId },
          include: {
            comments: { where: { status: { not: "CLEARED" } } },
            checklistItems: { where: { response: "NO", OR: [{ remarks: null }, { remarks: "" }] } },
          },
        });
        if (!eqcrAssignmentIssues) {
          passed = false;
          message = "EQCR assignment not found";
        } else {
          const openComments = eqcrAssignmentIssues.comments.length;
          const unremarkedNo = eqcrAssignmentIssues.checklistItems.length;
          passed = openComments === 0 && unremarkedNo === 0;
          if (passed) message = "All EQCR issues resolved";
          else message = `${openComments} open comment(s) and ${unremarkedNo} unresolved checklist item(s) remain`;
        }
        break;
      }

      case "eqcr-release": {
        const eqcrAssignmentRelease = await prisma.eQCRAssignment.findUnique({
          where: { engagementId },
          include: { partnerComment: true },
        });
        if (!eqcrAssignmentRelease) {
          passed = false;
          message = "EQCR assignment not found";
        } else if (!eqcrAssignmentRelease.isRequired) {
          passed = true;
          message = "EQCR not required for this engagement";
        } else {
          const cleared = eqcrAssignmentRelease.isFinalized &&
            (eqcrAssignmentRelease.partnerComment?.clearanceStatus === "CLEARED" ||
             eqcrAssignmentRelease.partnerComment?.clearanceStatus === "CLEARED_WITH_CONDITIONS");
          passed = !!cleared;
          if (passed) message = `EQCR release signed (${eqcrAssignmentRelease.partnerComment?.clearanceStatus})`;
          else if (eqcrAssignmentRelease.isFinalized) message = "EQCR finalized but clearance not granted";
          else message = "EQCR must be finalized with clearance before release";
        }
        break;
      }

      case "eqcr-released": {
        const eqcrReleased = await prisma.eQCRAssignment.findUnique({
          where: { engagementId },
          include: { partnerComment: true },
        });
        if (!eqcrReleased) {
          passed = false;
          message = "EQCR assignment not found";
        } else if (!eqcrReleased.isRequired) {
          passed = true;
          message = "EQCR not required — auto-passed";
        } else {
          passed = !!eqcrReleased.isFinalized &&
            (eqcrReleased.partnerComment?.clearanceStatus === "CLEARED" ||
             eqcrReleased.partnerComment?.clearanceStatus === "CLEARED_WITH_CONDITIONS");
          if (passed) message = "EQCR released and cleared";
          else message = "EQCR must be finalized with clearance before archiving";
        }
        break;
      }

      case "archive-readiness-checked": {
        const readiness = await prisma.inspectionReadiness.findUnique({
          where: { engagementId },
        });
        if (!readiness) {
          passed = false;
          message = "Inspection readiness has not been checked yet";
        } else {
          passed = readiness.overallReadiness >= 80;
          if (passed) message = `Archive readiness verified (${readiness.overallReadiness}%)`;
          else message = `Readiness score too low (${readiness.overallReadiness}%) — must be ≥80%`;
        }
        break;
      }

      case "archive-sealed": {
        const archiveSeal = await prisma.archivePackage.findUnique({
          where: { engagementId },
        });
        if (!archiveSeal) {
          passed = false;
          message = "Archive package has not been created";
        } else {
          passed = archiveSeal.status === "SEALED" || archiveSeal.status === "RELEASED";
          if (passed) message = `Archive sealed on ${archiveSeal.sealedAt?.toISOString().split("T")[0] || "N/A"}`;
          else message = `Archive status is "${archiveSeal.status}" — must be sealed first`;
        }
        break;
      }

      case "archive-index-generated": {
        const archiveIndex = await prisma.archivePackage.findUnique({
          where: { engagementId },
        });
        passed = !!archiveIndex?.archiveIndex;
        if (passed) message = "Archive index has been generated";
        else message = "Archive index has not been generated yet";
        break;
      }

      case "archive-released": {
        const archiveRelease = await prisma.archivePackage.findUnique({
          where: { engagementId },
        });
        if (!archiveRelease) {
          passed = false;
          message = "Archive package has not been created";
        } else {
          passed = archiveRelease.status === "RELEASED";
          if (passed) message = `Archive released on ${archiveRelease.releasedAt?.toISOString().split("T")[0] || "N/A"}`;
          else message = `Archive status is "${archiveRelease.status}" — must be released`;
        }
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
