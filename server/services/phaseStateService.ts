import { prisma } from "../db";
import {
  CANONICAL_PHASES,
  getPhaseByKey,
  getWorkspacePhases,
  type CanonicalPhase,
  type PhaseStatus,
  PHASE_STATUS_ORDER,
  BACKEND_PHASE_MAP,
} from "../../shared/phases";
import { evaluatePhaseGates, type PhaseGateEvaluation } from "./phaseGateEngine";

export interface PhaseStateEntry {
  phaseKey: string;
  phaseLabel: string;
  description: string;
  order: number;
  group: string;
  backendPhase: string;
  status: PhaseStatus;
  completionPercentage: number;
  startedAt: Date | null;
  completedAt: Date | null;
  lockedAt: Date | null;
  lockedById: string | null;
  approvedById: string | null;
  approvedAt: Date | null;
  gateEvaluation: PhaseGateEvaluation | null;
}

export interface EngagementPhaseState {
  engagementId: string;
  currentPhaseKey: string | null;
  overallCompletion: number;
  phases: PhaseStateEntry[];
}

export interface PhaseTransitionResult {
  success: boolean;
  error?: string;
  previousStatus: PhaseStatus;
  newStatus: PhaseStatus;
  phaseKey: string;
}

type BackendPhaseStatus = "NOT_STARTED" | "IN_PROGRESS" | "UNDER_REVIEW" | "COMPLETED" | "LOCKED";

const VALID_STATUS_TRANSITIONS: Record<string, PhaseStatus[]> = {
  NOT_STARTED: ["IN_PROGRESS"],
  IN_PROGRESS: ["NEEDS_REVIEW", "COMPLETED"],
  NEEDS_REVIEW: ["IN_PROGRESS", "COMPLETED", "APPROVED"],
  BLOCKED: ["IN_PROGRESS", "NOT_STARTED"],
  COMPLETED: ["APPROVED", "LOCKED"],
  APPROVED: ["LOCKED"],
  LOCKED: [],
};

function backendStatusToCanonical(status: string): PhaseStatus {
  const map: Record<string, PhaseStatus> = {
    NOT_STARTED: "NOT_STARTED",
    IN_PROGRESS: "IN_PROGRESS",
    UNDER_REVIEW: "NEEDS_REVIEW",
    COMPLETED: "COMPLETED",
    LOCKED: "LOCKED",
  };
  return map[status] || "NOT_STARTED";
}

function canonicalToBackendStatus(status: PhaseStatus): BackendPhaseStatus {
  const map: Record<PhaseStatus, BackendPhaseStatus> = {
    NOT_STARTED: "NOT_STARTED",
    IN_PROGRESS: "IN_PROGRESS",
    NEEDS_REVIEW: "UNDER_REVIEW",
    BLOCKED: "NOT_STARTED",
    COMPLETED: "COMPLETED",
    APPROVED: "COMPLETED",
    LOCKED: "LOCKED",
  };
  return map[status] || "NOT_STARTED";
}

export async function validateEngagementAccess(
  engagementId: string,
  firmId: string | null
): Promise<{ valid: boolean; error?: string }> {
  if (!firmId) {
    return { valid: false, error: "User not associated with a firm" };
  }

  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    select: { id: true, firmId: true },
  });

  if (!engagement) {
    return { valid: false, error: "Engagement not found" };
  }

  if (engagement.firmId !== firmId) {
    return { valid: false, error: "Engagement not found" };
  }

  return { valid: true };
}

export async function getEngagementPhaseState(
  engagementId: string,
  includeGates: boolean = false
): Promise<EngagementPhaseState> {
  const [engagement, phaseProgress] = await Promise.all([
    prisma.engagement.findUnique({
      where: { id: engagementId },
      select: { id: true, currentPhase: true },
    }),
    prisma.phaseProgress.findMany({
      where: { engagementId },
    }),
  ]);

  if (!engagement) {
    throw new Error(`Engagement ${engagementId} not found`);
  }

  const progressByPhase = new Map<string, typeof phaseProgress[0]>();
  for (const pp of phaseProgress) {
    progressByPhase.set(pp.phase, pp);
  }

  const workspacePhases = getWorkspacePhases();
  const phases: PhaseStateEntry[] = [];

  for (const canonical of workspacePhases) {
    const backendProgress = progressByPhase.get(canonical.backendPhase);
    const status = backendProgress
      ? backendStatusToCanonical(backendProgress.status)
      : "NOT_STARTED";

    let gateEvaluation: PhaseGateEvaluation | null = null;
    if (includeGates) {
      gateEvaluation = await evaluatePhaseGates(engagementId, canonical.key);
    }

    phases.push({
      phaseKey: canonical.key,
      phaseLabel: canonical.label,
      description: canonical.description,
      order: canonical.order,
      group: canonical.group,
      backendPhase: canonical.backendPhase,
      status,
      completionPercentage: backendProgress?.completionPercentage ?? 0,
      startedAt: backendProgress?.startedAt ?? null,
      completedAt: backendProgress?.completedAt ?? null,
      lockedAt: backendProgress?.lockedAt ?? null,
      lockedById: backendProgress?.lockedById ?? null,
      approvedById: backendProgress?.approvedById ?? null,
      approvedAt: backendProgress?.approvedAt ?? null,
      gateEvaluation,
    });
  }

  let currentPhaseKey: string | null = null;
  if (engagement.currentPhase) {
    const mappedKeys = BACKEND_PHASE_MAP[engagement.currentPhase];
    if (mappedKeys && mappedKeys.length > 0) {
      currentPhaseKey = mappedKeys[0];
    }
  }

  const totalPhases = phases.length;
  const overallCompletion = totalPhases > 0
    ? Math.round(phases.reduce((sum, p) => sum + p.completionPercentage, 0) / totalPhases)
    : 0;

  return {
    engagementId,
    currentPhaseKey,
    overallCompletion,
    phases,
  };
}

export async function getPhaseState(
  engagementId: string,
  phaseKey: string
): Promise<PhaseStateEntry | null> {
  const canonical = getPhaseByKey(phaseKey);
  if (!canonical) return null;

  const backendProgress = await prisma.phaseProgress.findFirst({
    where: { engagementId, phase: canonical.backendPhase },
  });

  const gateEvaluation = await evaluatePhaseGates(engagementId, phaseKey);

  const status = backendProgress
    ? backendStatusToCanonical(backendProgress.status)
    : "NOT_STARTED";

  return {
    phaseKey: canonical.key,
    phaseLabel: canonical.label,
    description: canonical.description,
    order: canonical.order,
    group: canonical.group,
    backendPhase: canonical.backendPhase,
    status,
    completionPercentage: backendProgress?.completionPercentage ?? 0,
    startedAt: backendProgress?.startedAt ?? null,
    completedAt: backendProgress?.completedAt ?? null,
    lockedAt: backendProgress?.lockedAt ?? null,
    lockedById: backendProgress?.lockedById ?? null,
    approvedById: backendProgress?.approvedById ?? null,
    approvedAt: backendProgress?.approvedAt ?? null,
    gateEvaluation,
  };
}

export async function updatePhaseStatus(
  engagementId: string,
  phaseKey: string,
  newStatus: PhaseStatus,
  userId: string
): Promise<PhaseTransitionResult> {
  const canonical = getPhaseByKey(phaseKey);
  if (!canonical) {
    return { success: false, error: `Unknown phase: ${phaseKey}`, previousStatus: "NOT_STARTED", newStatus, phaseKey };
  }

  const existing = await prisma.phaseProgress.findFirst({
    where: { engagementId, phase: canonical.backendPhase },
  });

  const currentStatus: PhaseStatus = existing
    ? backendStatusToCanonical(existing.status)
    : "NOT_STARTED";

  const allowedTransitions = VALID_STATUS_TRANSITIONS[currentStatus] || [];
  if (!allowedTransitions.includes(newStatus)) {
    return {
      success: false,
      error: `Cannot transition from ${currentStatus} to ${newStatus}. Allowed: ${allowedTransitions.join(", ") || "none"}`,
      previousStatus: currentStatus,
      newStatus,
      phaseKey,
    };
  }

  const backendStatus = canonicalToBackendStatus(newStatus);
  const now = new Date();

  const updateData: Record<string, unknown> = {
    status: backendStatus,
  };

  if (newStatus === "IN_PROGRESS" && currentStatus === "NOT_STARTED") {
    updateData.startedAt = now;
  }
  if (newStatus === "COMPLETED" || newStatus === "APPROVED") {
    updateData.completedAt = now;
    updateData.completionPercentage = 100;
  }
  if (newStatus === "APPROVED") {
    updateData.approvedById = userId;
    updateData.approvedAt = now;
  }
  if (newStatus === "LOCKED") {
    updateData.lockedById = userId;
    updateData.lockedAt = now;
  }

  if (existing) {
    await prisma.phaseProgress.update({
      where: { id: existing.id },
      data: updateData as Record<string, unknown>,
    });
  } else {
    const createData = {
      engagementId,
      phase: canonical.backendPhase,
      status: backendStatus,
      completionPercentage: newStatus === "COMPLETED" || newStatus === "APPROVED" ? 100 : 0,
      startedAt: newStatus === "IN_PROGRESS" ? now : null,
      completedAt: newStatus === "COMPLETED" ? now : null,
    };
    await prisma.$executeRawUnsafe(
      `INSERT INTO "PhaseProgress" ("id", "engagementId", "phase", "status", "completionPercentage", "startedAt", "completedAt", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2::"AuditPhase", $3::"PhaseStatus", $4, $5, $6, NOW(), NOW())`,
      createData.engagementId,
      createData.phase,
      createData.status,
      createData.completionPercentage,
      createData.startedAt,
      createData.completedAt
    );
  }

  return {
    success: true,
    previousStatus: currentStatus,
    newStatus,
    phaseKey,
  };
}

export async function updatePhaseCompletion(
  engagementId: string,
  phaseKey: string,
  completionPercentage: number
): Promise<boolean> {
  const canonical = getPhaseByKey(phaseKey);
  if (!canonical) return false;

  const clamped = Math.max(0, Math.min(100, Math.round(completionPercentage)));

  const existing = await prisma.phaseProgress.findFirst({
    where: { engagementId, phase: canonical.backendPhase },
  });

  if (!existing) {
    return false;
  }

  await prisma.phaseProgress.update({
    where: { id: existing.id },
    data: { completionPercentage: clamped },
  });

  return true;
}

export async function initializeEngagementPhases(
  engagementId: string,
  startPhase: string = "PRE_PLANNING"
): Promise<void> {
  const backendPhases = [
    "ONBOARDING", "PRE_PLANNING", "REQUISITION", "PLANNING",
    "EXECUTION", "FINALIZATION", "REPORTING", "EQCR", "INSPECTION"
  ];

  for (let i = 0; i < backendPhases.length; i++) {
    const phase = backendPhases[i];
    const existing = await prisma.phaseProgress.findFirst({
      where: { engagementId, phase },
    });

    if (!existing) {
      const status = phase === startPhase ? "IN_PROGRESS" : "NOT_STARTED";
      const startedAt = phase === startPhase ? new Date() : null;
      await prisma.$executeRawUnsafe(
        `INSERT INTO "PhaseProgress" ("id", "engagementId", "phase", "status", "completionPercentage", "startedAt", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2::"AuditPhase", $3::"PhaseStatus", 0, $4, NOW(), NOW())`,
        engagementId,
        phase,
        status,
        startedAt
      );
    }
  }
}

export function getCanonicalStatusValues(): { key: PhaseStatus; label: string }[] {
  return PHASE_STATUS_ORDER
    .filter(s => s !== "LOCKED")
    .map(s => ({
      key: s,
      label: s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
    }));
}

export function isValidStatusTransition(from: PhaseStatus, to: PhaseStatus): boolean {
  const allowed = VALID_STATUS_TRANSITIONS[from] || [];
  return allowed.includes(to);
}

export function getPhaseRegistry() {
  return CANONICAL_PHASES.map(p => ({
    key: p.key,
    label: p.label,
    description: p.description,
    routeSlug: p.routeSlug,
    order: p.order,
    group: p.group,
    prerequisiteKeys: p.prerequisiteKeys,
    requiredInputs: p.requiredInputs,
    rolePermissions: p.rolePermissions,
    aiCapabilities: p.aiCapabilities,
    outputArtifacts: p.outputArtifacts,
    completionGates: p.completionGates.map(g => ({
      id: g.id,
      label: g.label,
      type: g.type,
      description: g.description,
      isaReference: g.isaReference,
    })),
  }));
}
