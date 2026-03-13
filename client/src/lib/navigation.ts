import {
  CANONICAL_PHASES,
  OLD_ROUTE_TO_NEW_SLUG,
} from "../../../shared/phases";

export interface PhaseProgress {
  phase: string;
  status: string;
  completionPercentage: number;
  lockedAt: string | null;
  approvedAt: string | null;
}

export interface EngagementWithPhases {
  id: string;
  currentPhase?: string;
  status?: string;
  onboardingLocked?: boolean;
  planningLocked?: boolean;
  executionLocked?: boolean;
  finalizationLocked?: boolean;
  phases?: PhaseProgress[];
  startedAt?: string | null;
  lastRoute?: string | null;
}

const PHASE_ORDER = CANONICAL_PHASES
  .filter(p => p.order >= 2)
  .map(p => p.backendPhase)
  .filter((v, i, a) => a.indexOf(v) === i);

const PHASE_ROUTES: Record<string, string> = {};
const _seen = new Set<string>();
for (const phase of CANONICAL_PHASES) {
  if (!_seen.has(phase.backendPhase)) {
    PHASE_ROUTES[phase.backendPhase] = phase.routeSlug;
    _seen.add(phase.backendPhase);
  }
}

export function getPhaseRoute(engagementId: string, phase: string): string {
  const phaseLower = phase?.toLowerCase() || "";
  const phaseUpper = phase?.toUpperCase().replace("-", "_") || "";
  
  if (PHASE_ROUTES[phaseUpper]) {
    return `/workspace/${engagementId}/${PHASE_ROUTES[phaseUpper]}`;
  }
  
  if (phaseLower.includes("requisition") || phaseLower === "information_requisition") {
    return `/workspace/${engagementId}/requisition`;
  }
  if (phaseLower.includes("pre-planning") || phaseLower === "pre_planning" || phaseLower === "preplanning") {
    return `/workspace/${engagementId}/pre-planning`;
  }
  if (phaseLower.includes("review") || phaseLower.includes("mapping")) {
    return `/workspace/${engagementId}/requisition?tab=review-coa&subtab=mapping`;
  }
  if (phaseLower.includes("planning")) {
    return `/workspace/${engagementId}/planning`;
  }
  if (phaseLower.includes("execution") || phaseLower.includes("fieldwork")) {
    return `/workspace/${engagementId}/execution`;
  }
  if (phaseLower.includes("fs-head") || phaseLower.includes("fs_head")) {
    return `/workspace/${engagementId}/fs-heads`;
  }
  if (phaseLower.includes("evidence")) {
    return `/workspace/${engagementId}/evidence`;
  }
  if (phaseLower.includes("output")) {
    return `/workspace/${engagementId}/outputs`;
  }
  if (phaseLower.includes("finalization")) {
    return `/workspace/${engagementId}/finalization`;
  }
  if (phaseLower.includes("deliverable") || phaseLower.includes("reporting")) {
    return `/workspace/${engagementId}/deliverables`;
  }
  if (phaseLower.includes("quality") || phaseLower.includes("eqcr")) {
    return `/workspace/${engagementId}/eqcr`;
  }
  if (phaseLower.includes("inspection")) {
    return `/workspace/${engagementId}/inspection`;
  }
  if (phaseLower.includes("onboarding")) {
    return `/workspace/${engagementId}/pre-planning`;
  }
  return `/workspace/${engagementId}/pre-planning`;
}

export function isPhaseCompleted(phases: PhaseProgress[] | undefined, phaseName: string): boolean {
  if (!phases) return false;
  const phase = phases.find(p => p.phase === phaseName);
  return phase?.status === "COMPLETED" || !!phase?.lockedAt;
}

export function isPhaseInProgress(phases: PhaseProgress[] | undefined, phaseName: string): boolean {
  if (!phases) return false;
  const phase = phases.find(p => p.phase === phaseName);
  return phase?.status === "IN_PROGRESS";
}

export function getCurrentActivePhase(phases: PhaseProgress[] | undefined): string {
  if (!phases || phases.length === 0) return "ONBOARDING";
  
  for (const phaseName of PHASE_ORDER) {
    const phase = phases.find(p => p.phase === phaseName);
    if (phase?.status === "IN_PROGRESS") {
      return phaseName;
    }
  }
  
  for (let i = PHASE_ORDER.length - 1; i >= 0; i--) {
    const phaseName = PHASE_ORDER[i];
    const phase = phases.find(p => p.phase === phaseName);
    if (phase?.status === "COMPLETED" || phase?.lockedAt) {
      if (i < PHASE_ORDER.length - 1) {
        return PHASE_ORDER[i + 1];
      }
      return phaseName;
    }
  }
  
  return "ONBOARDING";
}

export function hasAnyPhaseData(phases: PhaseProgress[] | undefined): boolean {
  if (!phases || phases.length === 0) return false;
  
  return phases.some(p => 
    p.status === "IN_PROGRESS" || 
    p.status === "COMPLETED" || 
    (p.completionPercentage && p.completionPercentage > 0) ||
    !!p.lockedAt
  );
}

export function getSmartWorkspaceRoute(engagement: EngagementWithPhases): string {
  const { id, phases, startedAt, lastRoute } = engagement;
  
  // If engagement has been started and has a saved lastRoute, use it
  if (startedAt && lastRoute) {
    return lastRoute;
  }
  
  const hasData = hasAnyPhaseData(phases);
  
  if (!hasData) {
    return `/workspace/${id}/acceptance`;
  }
  
  if (phases && phases.length > 0) {
    let lastActivePhaseIndex = -1;
    
    for (let i = PHASE_ORDER.length - 1; i >= 0; i--) {
      const phaseName = PHASE_ORDER[i];
      const phase = phases.find(p => p.phase === phaseName);
      
      if (phase?.status === "IN_PROGRESS" || 
          (phase?.completionPercentage && phase.completionPercentage > 0)) {
        lastActivePhaseIndex = i;
        break;
      }
    }
    
    if (lastActivePhaseIndex >= 0) {
      const lastActivePhaseName = PHASE_ORDER[lastActivePhaseIndex];
      const lastActivePhase = phases.find(p => p.phase === lastActivePhaseName);
      
      const isLocked = !!lastActivePhase?.lockedAt || lastActivePhase?.status === "COMPLETED";
      
      if (isLocked && lastActivePhaseIndex < PHASE_ORDER.length - 1) {
        const nextPhaseName = PHASE_ORDER[lastActivePhaseIndex + 1];
        return `/workspace/${id}/${PHASE_ROUTES[nextPhaseName]}`;
      }
      
      return `/workspace/${id}/${PHASE_ROUTES[lastActivePhaseName]}`;
    }
    
    for (let i = 0; i < PHASE_ORDER.length; i++) {
      const phaseName = PHASE_ORDER[i];
      const phase = phases.find(p => p.phase === phaseName);
      const isCompleted = phase?.status === "COMPLETED" || !!phase?.lockedAt;
      
      if (!isCompleted) {
        return `/workspace/${id}/${PHASE_ROUTES[phaseName]}`;
      }
    }
  }
  
  return `/workspace/${id}/acceptance`;
}

export function getButtonLabel(engagement: EngagementWithPhases): { label: string; tooltip: string } {
  const { phases, startedAt } = engagement;
  
  // If engagement has been started (startedAt is set), show Resume
  if (startedAt) {
    return { label: "Resume", tooltip: "Continue from last saved stage" };
  }
  
  const hasData = hasAnyPhaseData(phases);
  
  if (!hasData) {
    return { label: "Start", tooltip: "Begin with pre-planning" };
  }
  
  return { label: "Resume", tooltip: "Continue from last saved stage" };
}

export function isEngagementStarted(engagement: EngagementWithPhases): boolean {
  return !!engagement.startedAt;
}
