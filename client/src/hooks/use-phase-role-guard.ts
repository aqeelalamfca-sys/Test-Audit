import { useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { useModuleReadOnly } from "@/components/sign-off-bar";
import { getPhaseByKey } from "../../../shared/phases";

export interface PhaseRoleGuard {
  canView: boolean;
  canEdit: boolean;
  canReview: boolean;
  canApprove: boolean;
  canReopen: boolean;
  canArchive: boolean;
  isReadOnly: boolean;
  userRole: string;
  phaseKey: string;
}

export function usePhaseRoleGuard(phaseKey: string, signOffPhase?: string): PhaseRoleGuard {
  const { user } = useAuth();
  const userRole = (user?.role || "STAFF").toUpperCase();
  const effectiveSignOffPhase = signOffPhase || phaseKey;
  const { isReadOnly } = useModuleReadOnly(effectiveSignOffPhase, phaseKey);

  return useMemo(() => {
    const phase = getPhaseByKey(phaseKey);
    const perms = phase?.rolePermissions;

    if (!perms) {
      return {
        canView: true,
        canEdit: !isReadOnly,
        canReview: false,
        canApprove: false,
        canReopen: false,
        canArchive: false,
        isReadOnly,
        userRole,
        phaseKey,
      };
    }

    const canView = perms.canView.includes(userRole) || userRole === "FIRM_ADMIN";
    const canEdit = (perms.canPrepare.includes(userRole) || userRole === "FIRM_ADMIN") && !isReadOnly;
    const canReview = perms.canReview.includes(userRole) || userRole === "FIRM_ADMIN";
    const canApprove = perms.canApprove.includes(userRole) || userRole === "FIRM_ADMIN";
    const canReopen = perms.canReopen.includes(userRole) || userRole === "FIRM_ADMIN";
    const canArchive = perms.canArchive.includes(userRole) || userRole === "FIRM_ADMIN";

    return {
      canView,
      canEdit,
      canReview,
      canApprove,
      canReopen,
      canArchive,
      isReadOnly,
      userRole,
      phaseKey,
    };
  }, [phaseKey, userRole, isReadOnly]);
}
