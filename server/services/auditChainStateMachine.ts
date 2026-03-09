import { prisma } from "../db";
import type { AuditPhase } from "@prisma/client";

export interface PhaseGateResult {
  allowed: boolean;
  phase: string;
  blockers: string[];
  prerequisites: { phase: string; required: string; current: string }[];
}

export interface ChainValidationResult {
  engagementId: string;
  timestamp: Date;
  isValid: boolean;
  phases: PhaseGateResult[];
  currentPhase: string | null;
  nextAvailablePhase: string | null;
}

interface PhaseDefinition {
  phase: AuditPhase;
  order: number;
  label: string;
  prerequisitePhases: AuditPhase[];
  gateCheck: (engagementId: string, phaseStatuses: Map<AuditPhase, string>) => Promise<PhaseGateResult>;
}

const CANONICAL_PHASE_ORDER: AuditPhase[] = [
  "ONBOARDING",
  "PRE_PLANNING",
  "REQUISITION",
  "PLANNING",
  "EXECUTION",
  "FINALIZATION",
  "REPORTING",
  "EQCR",
  "INSPECTION",
];

const SYSTEM_PHASE_ORDER: AuditPhase[] = [
  "ONBOARDING",
  "PRE_PLANNING",
  "PLANNING",
  "EXECUTION",
  "FINALIZATION",
  "REPORTING",
  "EQCR",
  "INSPECTION",
];

export function getSystemPhaseOrder(): AuditPhase[] {
  return [...SYSTEM_PHASE_ORDER];
}

const ACTIVE_STATUSES = ["IN_PROGRESS", "UNDER_REVIEW", "COMPLETED", "LOCKED"];

function isActiveOrCompleted(status: string | undefined): boolean {
  return !!status && ACTIVE_STATUSES.includes(status);
}

function isCompleted(status: string | undefined): boolean {
  return status === "COMPLETED" || status === "LOCKED";
}

const PHASE_DEFINITIONS: PhaseDefinition[] = [
  {
    phase: "ONBOARDING",
    order: 0,
    label: "Onboarding",
    prerequisitePhases: [],
    gateCheck: async (_engagementId, _statuses) => ({
      allowed: true,
      phase: "ONBOARDING",
      blockers: [],
      prerequisites: [],
    }),
  },
  {
    phase: "PRE_PLANNING",
    order: 1,
    label: "Pre-Planning",
    prerequisitePhases: ["ONBOARDING"],
    gateCheck: async (_engagementId, statuses) => {
      const onboardingStatus = statuses.get("ONBOARDING");
      const blockers: string[] = [];
      const prerequisites: PhaseGateResult["prerequisites"] = [];

      if (!isActiveOrCompleted(onboardingStatus)) {
        blockers.push("ONBOARDING must be IN_PROGRESS or COMPLETED");
        prerequisites.push({ phase: "ONBOARDING", required: "IN_PROGRESS or COMPLETED", current: onboardingStatus || "NOT_STARTED" });
      }

      return { allowed: blockers.length === 0, phase: "PRE_PLANNING", blockers, prerequisites };
    },
  },
  {
    phase: "REQUISITION",
    order: 2,
    label: "Data Intake",
    prerequisitePhases: ["PRE_PLANNING"],
    gateCheck: async (_engagementId, statuses) => {
      const prePlanningStatus = statuses.get("PRE_PLANNING");
      const blockers: string[] = [];
      const prerequisites: PhaseGateResult["prerequisites"] = [];

      if (!isActiveOrCompleted(prePlanningStatus)) {
        blockers.push("PRE_PLANNING must be IN_PROGRESS or COMPLETED");
        prerequisites.push({ phase: "PRE_PLANNING", required: "IN_PROGRESS or COMPLETED", current: prePlanningStatus || "NOT_STARTED" });
      }

      return { allowed: blockers.length === 0, phase: "REQUISITION", blockers, prerequisites };
    },
  },
  {
    phase: "PLANNING",
    order: 3,
    label: "Planning",
    prerequisitePhases: ["REQUISITION"],
    gateCheck: async (engagementId, statuses) => {
      const requisitionStatus = statuses.get("REQUISITION");
      const blockers: string[] = [];
      const prerequisites: PhaseGateResult["prerequisites"] = [];

      if (!isActiveOrCompleted(requisitionStatus)) {
        blockers.push("REQUISITION must be IN_PROGRESS or COMPLETED");
        prerequisites.push({ phase: "REQUISITION", required: "IN_PROGRESS or COMPLETED", current: requisitionStatus || "NOT_STARTED" });
      }

      try {
        const tbCount = await prisma.trialBalance.count({ where: { engagementId } });
        if (tbCount === 0) {
          blockers.push("Trial Balance data must be uploaded before entering PLANNING");
        }
      } catch {
        // Table may not exist yet
      }

      try {
        const fsHeadCount = await prisma.fSHead.count({ where: { engagementId } });
        if (fsHeadCount === 0) {
          blockers.push("FS Head / COA structure must be defined before entering PLANNING");
        }
      } catch {
        // Table may not exist yet
      }

      return { allowed: blockers.length === 0, phase: "PLANNING", blockers, prerequisites };
    },
  },
  {
    phase: "EXECUTION",
    order: 4,
    label: "Execution",
    prerequisitePhases: ["PLANNING"],
    gateCheck: async (_engagementId, statuses) => {
      const planningStatus = statuses.get("PLANNING");
      const blockers: string[] = [];
      const prerequisites: PhaseGateResult["prerequisites"] = [];

      if (!isActiveOrCompleted(planningStatus)) {
        blockers.push("PLANNING must be IN_PROGRESS or COMPLETED");
        prerequisites.push({ phase: "PLANNING", required: "IN_PROGRESS or COMPLETED", current: planningStatus || "NOT_STARTED" });
      }

      return { allowed: blockers.length === 0, phase: "EXECUTION", blockers, prerequisites };
    },
  },
  {
    phase: "FINALIZATION",
    order: 5,
    label: "Finalization",
    prerequisitePhases: ["EXECUTION"],
    gateCheck: async (_engagementId, statuses) => {
      const executionStatus = statuses.get("EXECUTION");
      const blockers: string[] = [];
      const prerequisites: PhaseGateResult["prerequisites"] = [];

      if (!isActiveOrCompleted(executionStatus)) {
        blockers.push("EXECUTION must be IN_PROGRESS or COMPLETED");
        prerequisites.push({ phase: "EXECUTION", required: "IN_PROGRESS or COMPLETED", current: executionStatus || "NOT_STARTED" });
      }

      return { allowed: blockers.length === 0, phase: "FINALIZATION", blockers, prerequisites };
    },
  },
  {
    phase: "REPORTING",
    order: 6,
    label: "Reporting & Deliverables",
    prerequisitePhases: ["FINALIZATION"],
    gateCheck: async (_engagementId, statuses) => {
      const finalizationStatus = statuses.get("FINALIZATION");
      const blockers: string[] = [];
      const prerequisites: PhaseGateResult["prerequisites"] = [];

      if (!isCompleted(finalizationStatus)) {
        blockers.push("FINALIZATION must be COMPLETED");
        prerequisites.push({ phase: "FINALIZATION", required: "COMPLETED", current: finalizationStatus || "NOT_STARTED" });
      }

      return { allowed: blockers.length === 0, phase: "REPORTING", blockers, prerequisites };
    },
  },
  {
    phase: "EQCR",
    order: 7,
    label: "Engagement Quality Control Review",
    prerequisitePhases: ["FINALIZATION"],
    gateCheck: async (_engagementId, statuses) => {
      const finalizationStatus = statuses.get("FINALIZATION");
      const blockers: string[] = [];
      const prerequisites: PhaseGateResult["prerequisites"] = [];

      if (!isCompleted(finalizationStatus)) {
        blockers.push("FINALIZATION must be COMPLETED");
        prerequisites.push({ phase: "FINALIZATION", required: "COMPLETED", current: finalizationStatus || "NOT_STARTED" });
      }

      return { allowed: blockers.length === 0, phase: "EQCR", blockers, prerequisites };
    },
  },
  {
    phase: "INSPECTION",
    order: 8,
    label: "Inspection",
    prerequisitePhases: ["EQCR"],
    gateCheck: async (_engagementId, statuses) => {
      const eqcrStatus = statuses.get("EQCR");
      const blockers: string[] = [];
      const prerequisites: PhaseGateResult["prerequisites"] = [];

      if (!isCompleted(eqcrStatus)) {
        blockers.push("EQCR must be COMPLETED");
        prerequisites.push({ phase: "EQCR", required: "COMPLETED", current: eqcrStatus || "NOT_STARTED" });
      }

      return { allowed: blockers.length === 0, phase: "INSPECTION", blockers, prerequisites };
    },
  },
];

export function getPhaseOrder(): AuditPhase[] {
  return [...CANONICAL_PHASE_ORDER];
}

export function getPhaseIndex(phase: AuditPhase): number {
  return CANONICAL_PHASE_ORDER.indexOf(phase);
}

export function canTransitionTo(currentPhase: AuditPhase, targetPhase: AuditPhase): boolean {
  const currentIndex = getPhaseIndex(currentPhase);
  const targetIndex = getPhaseIndex(targetPhase);
  if (currentIndex < 0 || targetIndex < 0) return false;
  return targetIndex <= currentIndex + 1;
}

export function getPrerequisites(phase: AuditPhase): AuditPhase[] {
  const def = PHASE_DEFINITIONS.find(d => d.phase === phase);
  return def ? [...def.prerequisitePhases] : [];
}

export async function validateChain(engagementId: string): Promise<ChainValidationResult> {
  const phaseRecords = await prisma.phaseProgress.findMany({
    where: { engagementId },
  });

  const statusMap = new Map<AuditPhase, string>();
  for (const record of phaseRecords) {
    statusMap.set(record.phase, record.status);
  }

  const phases: PhaseGateResult[] = [];
  let currentPhase: string | null = null;
  let nextAvailablePhase: string | null = null;
  let isValid = true;

  for (const def of PHASE_DEFINITIONS) {
    const result = await def.gateCheck(engagementId, statusMap);
    phases.push(result);

    const status = statusMap.get(def.phase);
    if (status === "IN_PROGRESS" || status === "UNDER_REVIEW") {
      currentPhase = def.phase;
    }

    if (!nextAvailablePhase && result.allowed && (!status || status === "NOT_STARTED")) {
      nextAvailablePhase = def.phase;
    }

    if (!result.allowed && isActiveOrCompleted(status)) {
      isValid = false;
    }
  }

  return {
    engagementId,
    timestamp: new Date(),
    isValid,
    phases,
    currentPhase,
    nextAvailablePhase,
  };
}

export async function getGateStatusForPhase(engagementId: string, phase: AuditPhase): Promise<PhaseGateResult> {
  const phaseRecords = await prisma.phaseProgress.findMany({
    where: { engagementId },
  });

  const statusMap = new Map<AuditPhase, string>();
  for (const record of phaseRecords) {
    statusMap.set(record.phase, record.status);
  }

  const def = PHASE_DEFINITIONS.find(d => d.phase === phase);
  if (!def) {
    return { allowed: false, phase, blockers: [`Unknown phase: ${phase}`], prerequisites: [] };
  }

  return def.gateCheck(engagementId, statusMap);
}

export const auditChainStateMachine = {
  getPhaseOrder,
  getSystemPhaseOrder,
  getPhaseIndex,
  canTransitionTo,
  getPrerequisites,
  validateChain,
  getGateStatusForPhase,
  CANONICAL_PHASE_ORDER,
  SYSTEM_PHASE_ORDER,
};
