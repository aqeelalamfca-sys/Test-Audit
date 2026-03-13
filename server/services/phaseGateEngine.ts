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

      case "acceptance-checklist":
      case "engagement-letter": {
        passed = isBackendPhaseActive(statusMap, "PRE_PLANNING");
        if (passed) message = "Pre-planning phase is active";
        break;
      }

      case "independence-confirmed":
      case "ethics-declarations": {
        passed = isBackendPhaseActive(statusMap, "PRE_PLANNING");
        if (passed) message = "Pre-planning phase is active";
        break;
      }

      case "tb-uploaded": {
        const tbCount = await prisma.trialBalanceLine.count({
          where: { engagementId },
        });
        passed = tbCount > 0;
        if (passed) message = `${tbCount} TB rows imported`;
        break;
      }

      case "gl-uploaded": {
        const glCount = await prisma.glEntry.count({
          where: { engagementId },
        });
        passed = glCount > 0;
        if (passed) message = `GL entries imported`;
        break;
      }

      case "tb-validated": {
        const tbRows = await prisma.trialBalanceLine.count({
          where: { engagementId },
        });
        passed = tbRows > 0;
        if (passed) message = "TB data present and validated";
        break;
      }

      case "gl-reconciled": {
        passed = isBackendPhaseActive(statusMap, "REQUISITION");
        if (passed) message = "Data intake phase active";
        break;
      }

      case "coa-mapped": {
        const mappedCount = await prisma.coAAccount.count({
          where: { engagementId, fsLineItem: { not: null } },
        });
        passed = mappedCount > 0;
        if (passed) message = `${mappedCount} accounts mapped to FS heads`;
        break;
      }

      case "fs-draft-generated": {
        const fsHeadCount = await prisma.fSHead.count({
          where: { engagementId },
        });
        passed = fsHeadCount > 0;
        if (passed) message = `${fsHeadCount} FS heads generated`;
        break;
      }

      case "materiality-calculated": {
        const matCalc = await prisma.materialityCalculation.findFirst({
          where: { engagementId },
          select: { id: true },
        });
        passed = !!matCalc;
        if (passed) message = "Materiality calculated";
        break;
      }

      case "materiality-approved": {
        const matCalc = await prisma.materialityCalculation.findFirst({
          where: { engagementId },
          select: { approvedAt: true },
        });
        passed = !!matCalc?.approvedAt;
        if (passed) message = "Materiality approved";
        break;
      }

      case "risks-identified": {
        const riskCount = await prisma.riskAssessment.count({
          where: { engagementId },
        });
        passed = riskCount > 0;
        if (passed) message = `${riskCount} risks identified`;
        break;
      }

      case "fraud-risks-assessed": {
        passed = isBackendPhaseActive(statusMap, "PLANNING");
        if (passed) message = "Planning phase active";
        break;
      }

      case "strategy-documented":
      case "planning-memo-complete": {
        const memo = await prisma.planningMemo.findFirst({
          where: { engagementId },
          select: { id: true },
        });
        passed = !!memo;
        if (passed) message = "Planning memo exists";
        break;
      }

      case "procedures-linked": {
        const procCount = await prisma.engagementProcedure.count({
          where: { engagementId },
        });
        passed = procCount > 0;
        if (passed) message = `${procCount} procedures linked`;
        break;
      }

      case "sampling-defined": {
        passed = isBackendPhaseActive(statusMap, "EXECUTION");
        if (passed) message = "Execution phase active";
        break;
      }

      case "procedures-executed":
      case "workpapers-documented": {
        passed = isBackendPhaseActive(statusMap, "EXECUTION");
        if (passed) message = "Execution phase active";
        break;
      }

      case "evidence-linked":
      case "evidence-sufficient": {
        passed = isBackendPhaseActive(statusMap, "EXECUTION");
        if (passed) message = "Execution phase active";
        break;
      }

      case "critical-findings-resolved":
      case "review-notes-cleared": {
        passed = isBackendPhaseActive(statusMap, "EXECUTION");
        if (passed) message = "Execution phase active";
        break;
      }

      case "adjustments-summarized":
      case "sad-classified": {
        passed = isBackendPhaseActive(statusMap, "EXECUTION");
        if (passed) message = "Execution phase active";
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

  const prerequisitesMet = prerequisites.every(prereq => {
    const active = isBackendPhaseActive(statusMap, prereq.backendPhase);
    if (!active) {
      blockers.push(`Prerequisite "${prereq.label}" (${prereq.backendPhase}) is not active or completed`);
    }
    return active;
  });

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
