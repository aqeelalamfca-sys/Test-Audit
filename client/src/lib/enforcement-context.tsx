import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export type EnforcementPhase = 
  | "ADMINISTRATION"
  | "PRE_PLANNING"
  | "REQUISITION"
  | "PLANNING"
  | "EXECUTION"
  | "EVIDENCE"
  | "FINALIZATION"
  | "DELIVERABLES"
  | "QR_EQCR"
  | "INSPECTION";

export interface PhaseGateStatus {
  phase: EnforcementPhase;
  isAccessible: boolean;
  isComplete: boolean;
  isLocked: boolean;
  blockers: string[];
  gatesPassed: number;
  totalGates: number;
}

export interface BlockedReason {
  phase: EnforcementPhase;
  subPhase?: string;
  reason: string;
  isaReference?: string;
  dependency?: string;
  resolution: string;
}

export interface PendingSignOff {
  id: string;
  category: string;
  entityType: string;
  entityId: string;
  description: string;
  requiredRole: string;
  isaReference?: string;
}

export interface MakerCheckerStatus {
  id: string;
  entityType: string;
  entityId: string;
  currentStage: string;
  preparerId: string;
  reviewerId?: string;
  approverId?: string;
}

export interface EnforcementStatus {
  engagementId: string;
  currentPhase: EnforcementPhase;
  currentSubPhase?: string;
  phaseStatus: Record<EnforcementPhase, PhaseGateStatus>;
  blockedReasons: BlockedReason[];
  pendingSignOffs: PendingSignOff[];
  makerCheckerPending: MakerCheckerStatus[];
  isLocked: boolean;
  isInspectionMode: boolean;
}

export interface AIConfig {
  isNonAuthoritative: boolean;
  label: string;
  requiresHumanApproval: boolean;
  editableByUser: boolean;
}

interface EnforcementContextType {
  status: EnforcementStatus | null;
  aiConfig: AIConfig | null;
  isLoading: boolean;
  error: Error | null;
  refreshStatus: () => void;
  canAccessPhase: (phase: EnforcementPhase) => boolean;
  getPhaseProgress: (phase: EnforcementPhase) => { passed: number; total: number; percent: number };
  getBlockedReasons: (phase?: EnforcementPhase) => BlockedReason[];
  isPhaseBlocked: (phase: EnforcementPhase) => boolean;
  pendingWorkflowsForEntity: (entityType: string, entityId: string) => MakerCheckerStatus | undefined;
}

const EnforcementContext = createContext<EnforcementContextType | null>(null);

export function useEnforcement() {
  const context = useContext(EnforcementContext);
  if (!context) {
    throw new Error("useEnforcement must be used within EnforcementProvider");
  }
  return context;
}

export function useEnforcementOptional() {
  return useContext(EnforcementContext);
}

interface EnforcementProviderProps {
  children: ReactNode;
  engagementId: string | null;
}

export function EnforcementProvider({ children, engagementId }: EnforcementProviderProps) {
  const queryClient = useQueryClient();

  const { data: status, isLoading: statusLoading, error: statusError, refetch: refetchStatus } = useQuery<EnforcementStatus>({
    queryKey: ["enforcement-status", engagementId],
    queryFn: async () => {
      if (!engagementId) return null;
      const tkn = localStorage.getItem('auditwise_token');
      const res = await fetch(`/api/enforcement/status/${engagementId}`, {
        headers: { ...(tkn ? { Authorization: `Bearer ${tkn}` } : {}) },
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to fetch enforcement status");
      return res.json();
    },
    enabled: !!engagementId,
    staleTime: 30000,
    refetchInterval: 60000
  });

  const { data: aiConfig } = useQuery<AIConfig>({
    queryKey: ["enforcement-ai-config"],
    queryFn: async () => {
      const tkn2 = localStorage.getItem('auditwise_token');
      const res = await fetch("/api/enforcement/ai-config", {
        headers: { ...(tkn2 ? { Authorization: `Bearer ${tkn2}` } : {}) },
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to fetch AI config");
      return res.json();
    },
    staleTime: 300000
  });

  const refreshStatus = useCallback(() => {
    refetchStatus();
  }, [refetchStatus]);

  const canAccessPhase = useCallback((_phase: EnforcementPhase): boolean => {
    return true;
  }, []);

  const getPhaseProgress = useCallback((phase: EnforcementPhase) => {
    if (!status) return { passed: 0, total: 0, percent: 0 };
    const phaseStatus = status.phaseStatus[phase];
    if (!phaseStatus) return { passed: 0, total: 0, percent: 0 };
    const percent = phaseStatus.totalGates > 0 
      ? Math.round((phaseStatus.gatesPassed / phaseStatus.totalGates) * 100)
      : 0;
    return { passed: phaseStatus.gatesPassed, total: phaseStatus.totalGates, percent };
  }, [status]);

  const getBlockedReasons = useCallback((phase?: EnforcementPhase): BlockedReason[] => {
    if (!status) return [];
    if (phase) {
      return status.blockedReasons.filter(b => b.phase === phase);
    }
    return status.blockedReasons;
  }, [status]);

  const isPhaseBlocked = useCallback((_phase: EnforcementPhase): boolean => {
    return false;
  }, []);

  const pendingWorkflowsForEntity = useCallback((entityType: string, entityId: string) => {
    if (!status) return undefined;
    return status.makerCheckerPending.find(
      mc => mc.entityType === entityType && mc.entityId === entityId
    );
  }, [status]);

  const value: EnforcementContextType = {
    status: status ?? null,
    aiConfig: aiConfig ?? null,
    isLoading: statusLoading,
    error: statusError as Error | null,
    refreshStatus,
    canAccessPhase,
    getPhaseProgress,
    getBlockedReasons,
    isPhaseBlocked,
    pendingWorkflowsForEntity
  };

  return (
    <EnforcementContext.Provider value={value}>
      {children}
    </EnforcementContext.Provider>
  );
}
