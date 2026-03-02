import type { UserRole } from "@prisma/client";

export type SignOffLevel = "PREPARED" | "REVIEWED" | "APPROVED";

export interface SignOffAuthorityResult {
  allowed: boolean;
  reason?: string;
  allowedRoles: UserRole[];
  label: string;
}

const SIGN_OFF_AUTHORITY_MATRIX: Record<SignOffLevel, UserRole[]> = {
  PREPARED: ["STAFF", "SENIOR", "TEAM_LEAD"],
  REVIEWED: ["MANAGER"],
  APPROVED: ["PARTNER"],
};

const SIGN_OFF_LABELS: Record<SignOffLevel, string> = {
  PREPARED: "Prepared (Associate / Senior / Team Lead)",
  REVIEWED: "Reviewed (Manager only)",
  APPROVED: "Approved (Partner only)",
};

const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
  STAFF: "Associate",
  SENIOR: "Senior",
  TEAM_LEAD: "Team Lead",
  MANAGER: "Manager",
  PARTNER: "Partner",
  MANAGING_PARTNER: "Managing Partner",
  EQCR: "EQCR Reviewer",
  ADMIN: "Administrator",
};

export function canMarkSignOff(
  userRole: UserRole,
  signOffLevel: SignOffLevel
): SignOffAuthorityResult {
  const allowedRoles = SIGN_OFF_AUTHORITY_MATRIX[signOffLevel];
  const allowed = allowedRoles.includes(userRole) || userRole === "ADMIN";

  return {
    allowed,
    reason: allowed
      ? undefined
      : `Only ${getAllowedRolesDisplay(signOffLevel)} can mark ${signOffLevel.toLowerCase()}`,
    allowedRoles,
    label: SIGN_OFF_LABELS[signOffLevel],
  };
}

export function getAllowedRolesDisplay(signOffLevel: SignOffLevel): string {
  const roles = SIGN_OFF_AUTHORITY_MATRIX[signOffLevel];
  const displayNames = roles.map((r) => ROLE_DISPLAY_NAMES[r] || r);
  
  if (displayNames.length === 1) {
    return displayNames[0];
  } else if (displayNames.length === 2) {
    return displayNames.join(" or ");
  } else {
    return displayNames.slice(0, -1).join(", ") + ", or " + displayNames.slice(-1);
  }
}

export function getSignOffLabel(signOffLevel: SignOffLevel): string {
  return SIGN_OFF_LABELS[signOffLevel];
}

export function getRoleDisplayName(role: UserRole): string {
  return ROLE_DISPLAY_NAMES[role] || role;
}

export function canUnlockSignOff(userRole: UserRole): boolean {
  return userRole === "PARTNER" || userRole === "MANAGING_PARTNER" || userRole === "ADMIN";
}

export function isFieldLockedAfterReview(reviewedAt: Date | null): boolean {
  return reviewedAt !== null;
}

export function isFieldLockedAfterApproval(approvedAt: Date | null): boolean {
  return approvedAt !== null;
}

export function getSignOffTooltip(
  signOffLevel: SignOffLevel,
  userRole: UserRole,
  isMarked: boolean
): string {
  const authority = canMarkSignOff(userRole, signOffLevel);
  
  if (isMarked) {
    return `${signOffLevel} marked - ${authority.label}`;
  }
  
  if (!authority.allowed) {
    return `You cannot mark ${signOffLevel.toLowerCase()}. ${authority.reason}`;
  }
  
  return `Click to mark as ${signOffLevel.toLowerCase()} - ${authority.label}`;
}

export const SIGN_OFF_AUTHORITY = {
  PREPARED_ROLES: SIGN_OFF_AUTHORITY_MATRIX.PREPARED,
  REVIEWED_ROLES: SIGN_OFF_AUTHORITY_MATRIX.REVIEWED,
  APPROVED_ROLES: SIGN_OFF_AUTHORITY_MATRIX.APPROVED,
  canMark: canMarkSignOff,
  canUnlock: canUnlockSignOff,
  getLabel: getSignOffLabel,
  getTooltip: getSignOffTooltip,
  getRoleDisplayName,
  getAllowedRolesDisplay,
};

export default SIGN_OFF_AUTHORITY;
