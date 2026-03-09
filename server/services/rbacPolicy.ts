import type { UserRole } from "@prisma/client";
import { prisma } from "../db";

export type SignOffType = "PREPARED" | "REVIEWED" | "APPROVED";

export type FSHeadAction =
  | "PREPARE"
  | "EDIT_PROCEDURE"
  | "UPLOAD_EVIDENCE"
  | "REVIEW"
  | "APPROVE_STAFF_WORK"
  | "REVIEW_MANAGER_WORK"
  | "SIGN_OFF"
  | "VIEW_SUMMARY"
  | "VIEW_BLOCKERS"
  | "VIEW_DETAILS"
  | "EDIT_DETAILS"
  | "DELETE"
  | "LOCK"
  | "UNLOCK";

export type EntityType =
  | "FS_HEAD"
  | "WORKING_PAPER"
  | "PROCEDURE"
  | "EVIDENCE"
  | "ADJUSTMENT"
  | "TOC"
  | "TOD"
  | "ANALYTICAL"
  | "ENGAGEMENT";

export interface PermissionResult {
  allowed: boolean;
  reason?: string;
  roleLevel: number;
  requiredLevel: number;
}

export interface PartnerReviewSummary {
  engagementId: string;
  engagementName: string;
  clientName: string;
  periodEnd: Date | null;
  overallStatus: string;
  fsHeads: FSHeadSummary[];
  blockers: BlockerItem[];
  signOffStatus: {
    prepared: number;
    reviewed: number;
    approved: number;
    total: number;
  };
  materialityThreshold: number | null;
  totalMisstatements: number;
  riskAssessmentComplete: boolean;
}

export interface FSHeadSummary {
  id: string;
  fsHeadKey: string;
  fsHeadName: string;
  currentYearBalance: number | null;
  priorYearBalance: number | null;
  movement: number | null;
  movementPercentage: number | null;
  status: string;
  isPrepared: boolean;
  isReviewed: boolean;
  isApproved: boolean;
  openReviewPoints: number;
  proceduresComplete: number;
  proceduresTotal: number;
  riskLevel: string | null;
}

export interface BlockerItem {
  id: string;
  type: "REVIEW_POINT" | "MISSING_EVIDENCE" | "INCOMPLETE_PROCEDURE" | "UNAPPROVED_ADJUSTMENT";
  entityType: EntityType;
  entityId: string;
  entityName: string;
  description: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  raisedAt: Date;
  raisedBy: string | null;
}

export interface PermissionLogEntry {
  timestamp: Date;
  userId: string;
  userRole: UserRole;
  action: string;
  entityType: EntityType;
  entityId?: string;
  allowed: boolean;
  reason?: string;
}

const permissionLogs: PermissionLogEntry[] = [];
const MAX_LOG_SIZE = 10000;

const ROLE_HIERARCHY: Record<UserRole, number> = {
  STAFF: 1,
  SENIOR: 2,
  MANAGER: 3,
  EQCR: 4,
  PARTNER: 5,
  FIRM_ADMIN: 6,
  SUPER_ADMIN: 99,
};

const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
  STAFF: "Staff",
  SENIOR: "Senior",
  MANAGER: "Manager",
  EQCR: "EQCR Reviewer",
  PARTNER: "Partner",
  FIRM_ADMIN: "Firm Admin",
  SUPER_ADMIN: "Super Admin",
};

const ACTION_REQUIRED_LEVELS: Record<FSHeadAction, number> = {
  PREPARE: 1,
  EDIT_PROCEDURE: 1,
  UPLOAD_EVIDENCE: 1,
  VIEW_DETAILS: 1,
  VIEW_SUMMARY: 1,
  VIEW_BLOCKERS: 1,
  REVIEW: 3,
  APPROVE_STAFF_WORK: 3,
  REVIEW_MANAGER_WORK: 5,
  EDIT_DETAILS: 1,
  SIGN_OFF: 5,
  DELETE: 5,
  LOCK: 5,
  UNLOCK: 5,
};

const STAFF_ACTIONS: FSHeadAction[] = [
  "PREPARE",
  "EDIT_PROCEDURE",
  "UPLOAD_EVIDENCE",
  "VIEW_DETAILS",
  "VIEW_SUMMARY",
  "VIEW_BLOCKERS",
  "EDIT_DETAILS",
];

const MANAGER_ACTIONS: FSHeadAction[] = [
  ...STAFF_ACTIONS,
  "REVIEW",
  "APPROVE_STAFF_WORK",
  "REVIEW_MANAGER_WORK",
];

const PARTNER_ACTIONS: FSHeadAction[] = [
  "VIEW_SUMMARY",
  "VIEW_BLOCKERS",
  "SIGN_OFF",
  "LOCK",
  "UNLOCK",
];

const EQCR_ACTIONS: FSHeadAction[] = [
  "VIEW_DETAILS",
  "VIEW_SUMMARY",
  "VIEW_BLOCKERS",
];

const FIRM_ADMIN_ACTIONS: FSHeadAction[] = [
  "PREPARE",
  "EDIT_PROCEDURE",
  "UPLOAD_EVIDENCE",
  "VIEW_DETAILS",
  "VIEW_SUMMARY",
  "VIEW_BLOCKERS",
  "REVIEW",
  "APPROVE_STAFF_WORK",
  "REVIEW_MANAGER_WORK",
  "EDIT_DETAILS",
  "SIGN_OFF",
  "DELETE",
  "LOCK",
  "UNLOCK",
];

const ROLE_PERMISSIONS: Record<UserRole, FSHeadAction[]> = {
  STAFF: STAFF_ACTIONS,
  SENIOR: STAFF_ACTIONS,
  MANAGER: MANAGER_ACTIONS,
  EQCR: EQCR_ACTIONS,
  PARTNER: PARTNER_ACTIONS,
  FIRM_ADMIN: FIRM_ADMIN_ACTIONS,
  SUPER_ADMIN: [],
};

const SIGN_OFF_REQUIRED_ROLES: Record<SignOffType, UserRole[]> = {
  PREPARED: ["STAFF", "SENIOR"],
  REVIEWED: ["MANAGER"],
  APPROVED: ["PARTNER"],
};

function logPermission(entry: PermissionLogEntry): void {
  permissionLogs.push(entry);
  if (permissionLogs.length > MAX_LOG_SIZE) {
    permissionLogs.shift();
  }
  
  const logLevel = entry.allowed ? "info" : "warn";
  console[logLevel](
    `[RBAC] ${entry.timestamp.toISOString()} | User: ${entry.userId} (${entry.userRole}) | ` +
    `Action: ${entry.action} on ${entry.entityType}${entry.entityId ? `:${entry.entityId}` : ""} | ` +
    `Result: ${entry.allowed ? "ALLOWED" : "DENIED"}${entry.reason ? ` | Reason: ${entry.reason}` : ""}`
  );
}

export function getRoleLevel(role: UserRole): number {
  return ROLE_HIERARCHY[role] ?? 0;
}

export function getRoleDisplayName(role: UserRole): string {
  return ROLE_DISPLAY_NAMES[role] ?? role;
}

export function isRoleAtLeast(userRole: UserRole, requiredRole: UserRole): boolean {
  return getRoleLevel(userRole) >= getRoleLevel(requiredRole);
}

export function checkPermission(action: string, role: UserRole): boolean {
  if (role === "FIRM_ADMIN") {
    return true;
  }
  
  const allowedActions = ROLE_PERMISSIONS[role] ?? [];
  return allowedActions.includes(action as FSHeadAction);
}

export function checkPermissionWithDetails(
  action: FSHeadAction,
  role: UserRole
): PermissionResult {
  const roleLevel = getRoleLevel(role);
  const requiredLevel = ACTION_REQUIRED_LEVELS[action] ?? 99;
  
  if (role === "FIRM_ADMIN") {
    return {
      allowed: true,
      roleLevel,
      requiredLevel,
    };
  }
  
  if (role === "EQCR") {
    const allowed = EQCR_ACTIONS.includes(action);
    return {
      allowed,
      roleLevel,
      requiredLevel,
      reason: allowed ? undefined : "EQCR role has read-only access",
    };
  }
  
  const allowedActions = ROLE_PERMISSIONS[role] ?? [];
  const allowed = allowedActions.includes(action);
  
  return {
    allowed,
    roleLevel,
    requiredLevel,
    reason: allowed
      ? undefined
      : `Action '${action}' requires ${getRoleDisplayName(role === "PARTNER" ? "MANAGER" : "PARTNER")} level or higher`,
  };
}

export function isPartnerReviewMode(role: UserRole): boolean {
  return role === "PARTNER";
}

export function canEditInPartnerMode(role: UserRole): boolean {
  return role === "FIRM_ADMIN";
}

export async function hasPermission(
  userId: string,
  action: string,
  entityType: EntityType,
  entityId?: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  
  if (!user) {
    logPermission({
      timestamp: new Date(),
      userId,
      userRole: "STAFF",
      action,
      entityType,
      entityId,
      allowed: false,
      reason: "User not found",
    });
    return false;
  }
  
  const result = checkPermissionWithDetails(action as FSHeadAction, user.role);
  
  logPermission({
    timestamp: new Date(),
    userId,
    userRole: user.role,
    action,
    entityType,
    entityId,
    allowed: result.allowed,
    reason: result.reason,
  });
  
  return result.allowed;
}

export async function canSignOff(
  userId: string,
  fsHeadId: string,
  signOffType: SignOffType
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  
  if (!user) {
    logPermission({
      timestamp: new Date(),
      userId,
      userRole: "STAFF",
      action: `SIGN_OFF_${signOffType}`,
      entityType: "FS_HEAD",
      entityId: fsHeadId,
      allowed: false,
      reason: "User not found",
    });
    return false;
  }
  
  if (user.role === "FIRM_ADMIN") {
    logPermission({
      timestamp: new Date(),
      userId,
      userRole: user.role,
      action: `SIGN_OFF_${signOffType}`,
      entityType: "FS_HEAD",
      entityId: fsHeadId,
      allowed: true,
    });
    return true;
  }
  
  const requiredRoles = SIGN_OFF_REQUIRED_ROLES[signOffType];
  const allowed = requiredRoles.includes(user.role);
  
  logPermission({
    timestamp: new Date(),
    userId,
    userRole: user.role,
    action: `SIGN_OFF_${signOffType}`,
    entityType: "FS_HEAD",
    entityId: fsHeadId,
    allowed,
    reason: allowed
      ? undefined
      : `Sign-off type '${signOffType}' requires one of: ${requiredRoles.map(getRoleDisplayName).join(", ")}`,
  });
  
  return allowed;
}

export async function getPartnerReviewData(
  engagementId: string
): Promise<PartnerReviewSummary> {
  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    include: {
      client: {
        select: { name: true },
      },
      fsHeadWorkingPapers: {
        include: {
          procedures: true,
          reviewPoints: {
            where: {
              status: { not: "CLEARED" },
            },
          },
          attachments: true,
        },
      },
      materialityAssessments: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      misstatements: true,
      riskAssessments: true,
    },
  });
  
  if (!engagement) {
    throw new Error(`Engagement not found: ${engagementId}`);
  }
  
  const fsHeads: FSHeadSummary[] = engagement.fsHeadWorkingPapers.map((wp) => ({
    id: wp.id,
    fsHeadKey: wp.fsHeadKey,
    fsHeadName: wp.fsHeadName,
    currentYearBalance: wp.currentYearBalance ? Number(wp.currentYearBalance) : null,
    priorYearBalance: wp.priorYearBalance ? Number(wp.priorYearBalance) : null,
    movement: wp.movement ? Number(wp.movement) : null,
    movementPercentage: wp.movementPercentage ? Number(wp.movementPercentage) : null,
    status: wp.isLocked ? "LOCKED" : wp.approvedById ? "APPROVED" : wp.reviewedById ? "REVIEWED" : wp.preparedById ? "PREPARED" : "DRAFT",
    isPrepared: !!wp.preparedById,
    isReviewed: !!wp.reviewedById,
    isApproved: !!wp.approvedById,
    openReviewPoints: wp.reviewPoints.length,
    proceduresComplete: wp.procedures.filter((p) => p.conclusion !== null && p.conclusion !== "").length,
    proceduresTotal: wp.procedures.length,
    riskLevel: wp.riskLevel,
  }));
  
  const blockers: BlockerItem[] = [];
  
  for (const wp of engagement.fsHeadWorkingPapers) {
    for (const rp of wp.reviewPoints) {
      blockers.push({
        id: rp.id,
        type: "REVIEW_POINT",
        entityType: "WORKING_PAPER",
        entityId: wp.id,
        entityName: wp.fsHeadName,
        description: rp.description || "Open review point",
        severity: rp.severity === "CRITICAL" ? "CRITICAL" : rp.severity === "WARNING" ? "WARNING" : "INFO",
        raisedAt: rp.raisedAt || new Date(),
        raisedBy: rp.raisedById,
      });
    }
    
    const incompleteProcedures = wp.procedures.filter((p) => !p.conclusion || p.conclusion === "");
    for (const proc of incompleteProcedures) {
      blockers.push({
        id: proc.id,
        type: "INCOMPLETE_PROCEDURE",
        entityType: "PROCEDURE",
        entityId: wp.id,
        entityName: wp.fsHeadName,
        description: `Procedure '${proc.procedureRef || proc.id}' is incomplete`,
        severity: "WARNING",
        raisedAt: proc.createdAt,
        raisedBy: null,
      });
    }
    
    if (wp.procedures.length > 0) {
      const hasEvidence = wp.attachments.length > 0;
      if (!hasEvidence) {
        blockers.push({
          id: `missing-evidence-${wp.id}`,
          type: "MISSING_EVIDENCE",
          entityType: "WORKING_PAPER",
          entityId: wp.id,
          entityName: wp.fsHeadName,
          description: "No evidence uploaded for this FS Head",
          severity: "WARNING",
          raisedAt: wp.createdAt,
          raisedBy: null,
        });
      }
    }
  }
  
  const signOffStatus = {
    prepared: fsHeads.filter((h) => h.isPrepared).length,
    reviewed: fsHeads.filter((h) => h.isReviewed).length,
    approved: fsHeads.filter((h) => h.isApproved).length,
    total: fsHeads.length,
  };
  
  const latestMateriality = engagement.materialityAssessments[0];
  
  return {
    engagementId: engagement.id,
    engagementName: engagement.engagementCode,
    clientName: engagement.client?.name || "Unknown Client",
    periodEnd: engagement.periodEnd,
    overallStatus: engagement.status,
    fsHeads,
    blockers: blockers.sort((a, b) => {
      const severityOrder = { CRITICAL: 0, WARNING: 1, INFO: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    }),
    signOffStatus,
    materialityThreshold: latestMateriality?.performanceMateriality
      ? Number(latestMateriality.performanceMateriality)
      : null,
    totalMisstatements: engagement.misstatements.length,
    riskAssessmentComplete: engagement.riskAssessments.length > 0,
  };
}

export function getPermissionLogs(limit: number = 100): PermissionLogEntry[] {
  return permissionLogs.slice(-limit);
}

export function clearPermissionLogs(): void {
  permissionLogs.length = 0;
}

export function getAllowedActionsForRole(role: UserRole): FSHeadAction[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function getRequiredRolesForSignOff(signOffType: SignOffType): UserRole[] {
  return SIGN_OFF_REQUIRED_ROLES[signOffType];
}

export function createPermissionMiddleware(requiredAction: FSHeadAction) {
  return async (req: any, res: any, next: any) => {
    const userId = req.user?.id;
    const entityType = req.params.entityType || "FS_HEAD";
    const entityId = req.params.id || req.params.fsHeadId;
    
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    const allowed = await hasPermission(userId, requiredAction, entityType, entityId);
    
    if (!allowed) {
      return res.status(403).json({
        error: "Permission denied",
        action: requiredAction,
        message: `You do not have permission to perform action: ${requiredAction}`,
      });
    }
    
    next();
  };
}

export const RBAC = {
  ROLE_HIERARCHY,
  ROLE_DISPLAY_NAMES,
  ROLE_PERMISSIONS,
  SIGN_OFF_REQUIRED_ROLES,
  ACTION_REQUIRED_LEVELS,
  
  checkPermission,
  checkPermissionWithDetails,
  hasPermission,
  canSignOff,
  getPartnerReviewData,
  
  isPartnerReviewMode,
  canEditInPartnerMode,
  isRoleAtLeast,
  getRoleLevel,
  getRoleDisplayName,
  
  getAllowedActionsForRole,
  getRequiredRolesForSignOff,
  getPermissionLogs,
  clearPermissionLogs,
  
  createPermissionMiddleware,
};

export default RBAC;
