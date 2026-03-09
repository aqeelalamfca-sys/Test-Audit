import { prisma } from "../db";
import type { UserRole } from "@prisma/client";
import { detectFSHeadType, FS_HEAD_TEMPLATES } from "./fsHeadProcedureTemplates";

export interface Blocker {
  code: string;
  message: string;
  isaReference: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  resolution: string;
  field?: string;
  entityType?: string;
  entityId?: string;
}

export interface FSHeadCompletionResult {
  canComplete: boolean;
  blockers: Blocker[];
  warnings: string[];
  signOffStatus: {
    prepared: boolean;
    reviewed: boolean;
    approved: boolean;
    preparedBy?: string;
    reviewedBy?: string;
    approvedBy?: string;
    preparedAt?: Date;
    reviewedAt?: Date;
    approvedAt?: Date;
  };
  procedureStatus: {
    totalTOC: number;
    completedTOC: number;
    totalTOD: number;
    completedTOD: number;
    totalAnalytics: number;
    completedAnalytics: number;
    evidenceCount: number;
  };
}

export interface EngagementCompletionResult {
  canComplete: boolean;
  blockers: Blocker[];
  warnings: string[];
  fsHeadStatus: {
    total: number;
    completed: number;
    blocked: number;
    fsHeadBlockers: { fsHeadId: string; fsHeadName: string; blockers: Blocker[] }[];
  };
  independenceStatus: {
    cleared: boolean;
    pendingDeclarations: number;
    pendingThreats: number;
  };
  eqcrStatus: {
    required: boolean;
    assigned: boolean;
    completed: boolean;
    comments: number;
    unresolvedComments: number;
  };
}

const SIGN_OFF_ROLE_MATRIX: Record<"PREPARED" | "REVIEWED" | "APPROVED", UserRole[]> = {
  PREPARED: ["STAFF", "SENIOR"],
  REVIEWED: ["MANAGER"],
  APPROVED: ["PARTNER"],
};

const MIN_CONCLUSION_LENGTH = 50;

async function getUserRole(userId: string): Promise<UserRole | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return user?.role || null;
}

async function validateSignOffRole(
  userId: string | null | undefined,
  level: "PREPARED" | "REVIEWED" | "APPROVED"
): Promise<{ valid: boolean; role?: UserRole; allowedRoles: UserRole[] }> {
  if (!userId) {
    return { valid: false, allowedRoles: SIGN_OFF_ROLE_MATRIX[level] };
  }
  const role = await getUserRole(userId);
  if (!role) {
    return { valid: false, allowedRoles: SIGN_OFF_ROLE_MATRIX[level] };
  }
  const isValid = SIGN_OFF_ROLE_MATRIX[level].includes(role) || role === "FIRM_ADMIN";
  return { valid: isValid, role, allowedRoles: SIGN_OFF_ROLE_MATRIX[level] };
}

export async function validateFSHeadCompletion(
  fsHeadId: string
): Promise<FSHeadCompletionResult> {
  const blockers: Blocker[] = [];
  const warnings: string[] = [];

  const fsHead = await prisma.fSHeadWorkingPaper.findUnique({
    where: { id: fsHeadId },
    include: {
      testOfControls: true,
      testOfDetails: true,
      analyticalProcedures: true,
      preparedBy: { select: { id: true, fullName: true, role: true } },
      reviewedBy: { select: { id: true, fullName: true, role: true } },
      approvedBy: { select: { id: true, fullName: true, role: true } },
    },
  });

  if (!fsHead) {
    return {
      canComplete: false,
      blockers: [{
        code: "FS_HEAD_NOT_FOUND",
        message: "FS Head working paper not found",
        isaReference: "ISA 230",
        severity: "CRITICAL",
        resolution: "Verify the FS Head exists",
      }],
      warnings: [],
      signOffStatus: { prepared: false, reviewed: false, approved: false },
      procedureStatus: {
        totalTOC: 0, completedTOC: 0,
        totalTOD: 0, completedTOD: 0,
        totalAnalytics: 0, completedAnalytics: 0,
        evidenceCount: 0,
      },
    };
  }

  const riskLevel = (fsHead.riskLevel || "MEDIUM").toUpperCase();
  const fsHeadType = detectFSHeadType(fsHead.fsHeadName);
  const template = FS_HEAD_TEMPLATES[fsHeadType];
  const isFraudRisk = template?.fraudRiskPresumed || false;

  const toc = fsHead.testOfControls || [];
  const tod = fsHead.testOfDetails || [];
  const analytics = fsHead.analyticalProcedures || [];

  const completedTOC = toc.filter((t: any) => t.result === "SATISFACTORY" || t.result === "COMPLETED").length;
  const completedTOD = tod.filter((t: any) => t.result === "SATISFACTORY" || t.result === "COMPLETED").length;
  const completedAnalytics = analytics.filter((a: any) => a.auditorConclusion && a.auditorConclusion.trim().length > 0).length;

  const allProcedureIds = [
    ...toc.map((t: any) => t.id),
    ...tod.map((t: any) => t.id),
    ...analytics.map((a: any) => a.id),
  ];

  const evidenceCount = await prisma.evidenceFile.count({
    where: {
      engagementId: fsHead.engagementId,
      status: "ACTIVE",
      procedureIds: { hasSome: allProcedureIds.length > 0 ? allProcedureIds : ["__none__"] },
    },
  });

  if (riskLevel === "HIGH" || isFraudRisk) {
    if (tod.length === 0) {
      blockers.push({
        code: "HIGH_RISK_NO_TOD",
        message: `HIGH risk FS Head "${fsHead.fsHeadName}" must have at least one Test of Details procedure`,
        isaReference: "ISA 330.18",
        severity: "CRITICAL",
        resolution: "Add and complete at least one Test of Details (TOD) procedure for this high-risk area",
        field: "testOfDetails",
        entityType: "FSHeadWorkingPaper",
        entityId: fsHeadId,
      });
    }
  }

  if (template) {
    const mandatoryProcs = template.procedures.filter(p => p.mandatory);
    for (const mandatory of mandatoryProcs) {
      let found = false;
      if (mandatory.type === "TOC") {
        found = toc.some((t: any) => 
          (t.tocRef === mandatory.ref || t.controlDescription?.includes(mandatory.description.slice(0, 30)))
        );
      } else if (mandatory.type === "TOD") {
        found = tod.some((t: any) => 
          (t.todRef === mandatory.ref || t.procedureDescription?.includes(mandatory.description.slice(0, 30)))
        );
      } else if (mandatory.type === "ANALYTICS") {
        found = analytics.some((a: any) => 
          (a.procedureRef === mandatory.ref || a.description?.includes(mandatory.description.slice(0, 30)))
        );
      }
      
      if (!found) {
        blockers.push({
          code: "MANDATORY_PROCEDURE_MISSING",
          message: `Mandatory procedure "${mandatory.ref}" is required but not found: ${mandatory.description.slice(0, 50)}...`,
          isaReference: mandatory.isaReference || "ISA 330",
          severity: "CRITICAL",
          resolution: `Add the required ${mandatory.type} procedure: ${mandatory.ref}`,
          field: mandatory.type.toLowerCase(),
          entityType: "FSHeadWorkingPaper",
          entityId: fsHeadId,
        });
      }
    }
  }

  const tocWithoutEvidence = toc.filter((t: any) => {
    const procEvidence = allProcedureIds.includes(t.id);
    return (t.result === "SATISFACTORY" || t.result === "COMPLETED") && !procEvidence;
  });

  const todWithoutEvidence = tod.filter((t: any) => {
    const procEvidence = allProcedureIds.includes(t.id);
    return (t.result === "SATISFACTORY" || t.result === "COMPLETED") && !procEvidence;
  });

  const proceduresNeedingEvidence = await prisma.evidenceFile.findMany({
    where: {
      engagementId: fsHead.engagementId,
      status: "ACTIVE",
      procedureIds: { hasSome: allProcedureIds.length > 0 ? allProcedureIds : ["__none__"] },
    },
    select: { procedureIds: true },
  });

  const procedureIdsWithEvidence = new Set(proceduresNeedingEvidence.flatMap(e => e.procedureIds));
  
  const completedTODWithoutEvidence = tod.filter((t: any) => 
    (t.result === "SATISFACTORY" || t.result === "COMPLETED") && !procedureIdsWithEvidence.has(t.id)
  );

  if (completedTODWithoutEvidence.length > 0 && (riskLevel === "HIGH" || riskLevel === "MEDIUM")) {
    blockers.push({
      code: "TOD_NO_EVIDENCE",
      message: `${completedTODWithoutEvidence.length} completed Test of Details procedure(s) have no evidence uploaded`,
      isaReference: "ISA 500.6",
      severity: "CRITICAL",
      resolution: "Upload supporting evidence for all completed procedures",
      field: "evidenceFiles",
      entityType: "FSHeadTOD",
      entityId: completedTODWithoutEvidence[0]?.id,
    });
  }

  if (!fsHead.conclusion || fsHead.conclusion.trim().length < MIN_CONCLUSION_LENGTH) {
    blockers.push({
      code: "CONCLUSION_REQUIRED",
      message: `Working paper conclusion is required (minimum ${MIN_CONCLUSION_LENGTH} characters). Current: ${fsHead.conclusion?.length || 0} chars`,
      isaReference: "ISA 230.8",
      severity: "CRITICAL",
      resolution: "Write a human-written conclusion summarizing the audit work performed and findings",
      field: "conclusion",
      entityType: "FSHeadWorkingPaper",
      entityId: fsHeadId,
    });
  }

  const preparedValidation = await validateSignOffRole(fsHead.preparedById, "PREPARED");
  const reviewedValidation = await validateSignOffRole(fsHead.reviewedById, "REVIEWED");
  const approvedValidation = await validateSignOffRole(fsHead.approvedById, "APPROVED");

  if (!fsHead.preparedById || !fsHead.preparedAt) {
    blockers.push({
      code: "PREPARED_SIGNOFF_MISSING",
      message: "Prepared sign-off is required (Staff/Senior/Team Lead)",
      isaReference: "ISA 220.18",
      severity: "HIGH",
      resolution: "Staff, Senior, or Team Lead must mark the working paper as prepared",
      field: "preparedById",
      entityType: "FSHeadWorkingPaper",
      entityId: fsHeadId,
    });
  } else if (!preparedValidation.valid) {
    blockers.push({
      code: "PREPARED_ROLE_INVALID",
      message: `User who prepared the working paper does not have the required role. Allowed roles: ${preparedValidation.allowedRoles.join(", ")}`,
      isaReference: "ISA 220.18",
      severity: "HIGH",
      resolution: "Have a Staff, Senior, or Team Lead mark as prepared",
      field: "preparedById",
      entityType: "FSHeadWorkingPaper",
      entityId: fsHeadId,
    });
  }

  if (!fsHead.reviewedById || !fsHead.reviewedAt) {
    blockers.push({
      code: "REVIEWED_SIGNOFF_MISSING",
      message: "Manager review sign-off is required",
      isaReference: "ISA 220.17",
      severity: "HIGH",
      resolution: "Manager must review and sign off on the working paper",
      field: "reviewedById",
      entityType: "FSHeadWorkingPaper",
      entityId: fsHeadId,
    });
  } else if (!reviewedValidation.valid) {
    blockers.push({
      code: "REVIEWED_ROLE_INVALID",
      message: `User who reviewed the working paper does not have Manager role. Allowed roles: ${reviewedValidation.allowedRoles.join(", ")}`,
      isaReference: "ISA 220.17",
      severity: "HIGH",
      resolution: "Have a Manager review and sign off",
      field: "reviewedById",
      entityType: "FSHeadWorkingPaper",
      entityId: fsHeadId,
    });
  }

  if (!fsHead.approvedById || !fsHead.approvedAt) {
    blockers.push({
      code: "APPROVED_SIGNOFF_MISSING",
      message: "Partner approval sign-off is required",
      isaReference: "ISA 220.19",
      severity: "CRITICAL",
      resolution: "Partner must approve the working paper",
      field: "approvedById",
      entityType: "FSHeadWorkingPaper",
      entityId: fsHeadId,
    });
  } else if (!approvedValidation.valid) {
    blockers.push({
      code: "APPROVED_ROLE_INVALID",
      message: `User who approved the working paper does not have Partner role. Allowed roles: ${approvedValidation.allowedRoles.join(", ")}`,
      isaReference: "ISA 220.19",
      severity: "CRITICAL",
      resolution: "Have a Partner approve the working paper",
      field: "approvedById",
      entityType: "FSHeadWorkingPaper",
      entityId: fsHeadId,
    });
  }

  if (riskLevel === "HIGH" && analytics.length > 0 && tod.length === 0) {
    blockers.push({
      code: "ANALYTICS_ONLY_HIGH_RISK",
      message: "Analytics-only procedures are not sufficient for HIGH risk areas",
      isaReference: "ISA 330.21",
      severity: "CRITICAL",
      resolution: "Add substantive Test of Details procedures for this high-risk area",
      field: "testOfDetails",
      entityType: "FSHeadWorkingPaper",
      entityId: fsHeadId,
    });
  }

  blockers.sort((a, b) => {
    const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  return {
    canComplete: blockers.length === 0,
    blockers,
    warnings,
    signOffStatus: {
      prepared: !!fsHead.preparedById && !!fsHead.preparedAt,
      reviewed: !!fsHead.reviewedById && !!fsHead.reviewedAt,
      approved: !!fsHead.approvedById && !!fsHead.approvedAt,
      preparedBy: fsHead.preparedBy?.fullName,
      reviewedBy: fsHead.reviewedBy?.fullName,
      approvedBy: fsHead.approvedBy?.fullName,
      preparedAt: fsHead.preparedAt || undefined,
      reviewedAt: fsHead.reviewedAt || undefined,
      approvedAt: fsHead.approvedAt || undefined,
    },
    procedureStatus: {
      totalTOC: toc.length,
      completedTOC,
      totalTOD: tod.length,
      completedTOD,
      totalAnalytics: analytics.length,
      completedAnalytics,
      evidenceCount,
    },
  };
}

export async function checkEQCRRequired(engagementId: string): Promise<boolean> {
  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    include: {
      client: true,
      clientMaster: true,
    },
  });

  if (!engagement) return false;

  if (engagement.eqcrRequired) return true;

  const clientMaster = engagement.clientMaster;
  if (clientMaster) {
    if (clientMaster.isListed || clientMaster.isPIE || clientMaster.isSection42) {
      return true;
    }
  }

  if (engagement.riskRating === "HIGH") {
    return true;
  }

  if (engagement.isGroupAudit) {
    return true;
  }

  return false;
}

async function validateIndependence(engagementId: string): Promise<{
  cleared: boolean;
  blockers: Blocker[];
  pendingDeclarations: number;
  pendingThreats: number;
}> {
  const blockers: Blocker[] = [];

  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    select: { independenceCleared: true },
  });

  const declarations = await prisma.independenceDeclaration.findMany({
    where: { engagementId },
    select: { id: true, status: true, userId: true },
  });

  const pendingDeclarations = declarations.filter(d => d.status === "PENDING").length;

  const threats = await prisma.threatRegister.findMany({
    where: { engagementId },
    select: { id: true, status: true, category: true },
  });

  const unresolvedThreats = threats.filter(t => 
    t.status !== "SAFEGUARDED" && t.status !== "ELIMINATED" && t.status !== "ACCEPTED"
  );
  const pendingThreats = unresolvedThreats.length;

  if (pendingDeclarations > 0) {
    blockers.push({
      code: "INDEPENDENCE_DECLARATIONS_PENDING",
      message: `${pendingDeclarations} independence declaration(s) pending completion`,
      isaReference: "ISA 220.11",
      severity: "CRITICAL",
      resolution: "All team members must complete their independence declarations",
      entityType: "IndependenceDeclaration",
    });
  }

  if (pendingThreats > 0) {
    blockers.push({
      code: "INDEPENDENCE_THREATS_UNRESOLVED",
      message: `${pendingThreats} independence threat(s) remain unresolved`,
      isaReference: "ISA 220.11",
      severity: "CRITICAL",
      resolution: "Address all identified independence threats with appropriate safeguards",
      entityType: "ThreatRegister",
    });
  }

  if (!engagement?.independenceCleared && (pendingDeclarations > 0 || pendingThreats > 0)) {
    blockers.push({
      code: "INDEPENDENCE_NOT_CLEARED",
      message: "Independence has not been cleared for this engagement",
      isaReference: "ISQM-1.34",
      severity: "CRITICAL",
      resolution: "Partner must confirm independence clearance after all declarations and threats are resolved",
    });
  }

  return {
    cleared: engagement?.independenceCleared || false,
    blockers,
    pendingDeclarations,
    pendingThreats,
  };
}

async function validateEQCR(engagementId: string): Promise<{
  required: boolean;
  assigned: boolean;
  completed: boolean;
  comments: number;
  unresolvedComments: number;
  blockers: Blocker[];
}> {
  const blockers: Blocker[] = [];

  const isRequired = await checkEQCRRequired(engagementId);

  if (!isRequired) {
    return {
      required: false,
      assigned: false,
      completed: false,
      comments: 0,
      unresolvedComments: 0,
      blockers: [],
    };
  }

  const assignment = await prisma.eQCRAssignment.findFirst({
    where: { engagementId },
    include: {
      assignedReviewer: { select: { id: true, fullName: true, role: true } },
    },
  });

  if (!assignment) {
    blockers.push({
      code: "EQCR_NOT_ASSIGNED",
      message: "EQCR is required but no EQCR reviewer has been assigned",
      isaReference: "ISA 220.21",
      severity: "CRITICAL",
      resolution: "Assign an EQCR reviewer for this engagement",
      entityType: "EQCRAssignment",
    });
    return {
      required: true,
      assigned: false,
      completed: false,
      comments: 0,
      unresolvedComments: 0,
      blockers,
    };
  }

  if (assignment.assignedReviewer?.role !== "EQCR" && assignment.assignedReviewer?.role !== "PARTNER") {
    blockers.push({
      code: "EQCR_REVIEWER_INVALID_ROLE",
      message: "Assigned EQCR reviewer does not have appropriate role (EQCR or Partner required)",
      isaReference: "ISA 220.21",
      severity: "HIGH",
      resolution: "Reassign EQCR to a user with EQCR or Partner role",
      entityType: "EQCRAssignment",
      entityId: assignment.id,
    });
  }

  const comments = await prisma.eQCRComment.findMany({
    where: { eqcrAssignmentId: assignment.id },
    select: { id: true, status: true, severity: true },
  });

  const unresolvedComments = comments.filter(c => c.status !== "CLEARED" && c.status !== "ADDRESSED");

  if (unresolvedComments.length > 0) {
    blockers.push({
      code: "EQCR_COMMENTS_UNRESOLVED",
      message: `${unresolvedComments.length} EQCR comment(s) remain unresolved`,
      isaReference: "ISA 220.22",
      severity: "CRITICAL",
      resolution: "Address and clear all EQCR comments before completion",
      entityType: "EQCRComment",
    });
  }

  const isCompleted = assignment.status === "CLEARED";

  if (!isCompleted && unresolvedComments.length === 0) {
    blockers.push({
      code: "EQCR_NOT_COMPLETED",
      message: "EQCR review is required but not yet completed",
      isaReference: "ISA 220.21",
      severity: "CRITICAL",
      resolution: "EQCR reviewer must complete their review and sign off",
      entityType: "EQCRAssignment",
      entityId: assignment.id,
    });
  }

  return {
    required: true,
    assigned: true,
    completed: isCompleted && unresolvedComments.length === 0,
    comments: comments.length,
    unresolvedComments: unresolvedComments.length,
    blockers,
  };
}

export async function validateEngagementCompletion(
  engagementId: string
): Promise<EngagementCompletionResult> {
  const blockers: Blocker[] = [];
  const warnings: string[] = [];
  const fsHeadBlockers: { fsHeadId: string; fsHeadName: string; blockers: Blocker[] }[] = [];

  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    select: { id: true, status: true, riskRating: true },
  });

  if (!engagement) {
    return {
      canComplete: false,
      blockers: [{
        code: "ENGAGEMENT_NOT_FOUND",
        message: "Engagement not found",
        isaReference: "ISA 230",
        severity: "CRITICAL",
        resolution: "Verify the engagement exists",
      }],
      warnings: [],
      fsHeadStatus: { total: 0, completed: 0, blocked: 0, fsHeadBlockers: [] },
      independenceStatus: { cleared: false, pendingDeclarations: 0, pendingThreats: 0 },
      eqcrStatus: { required: false, assigned: false, completed: false, comments: 0, unresolvedComments: 0 },
    };
  }

  const fsHeads = await prisma.fSHeadWorkingPaper.findMany({
    where: { engagementId },
    select: { id: true, fsHeadName: true, status: true },
  });

  let completedCount = 0;
  let blockedCount = 0;

  for (const fsHead of fsHeads) {
    const validation = await validateFSHeadCompletion(fsHead.id);
    if (validation.canComplete) {
      completedCount++;
    } else {
      blockedCount++;
      fsHeadBlockers.push({
        fsHeadId: fsHead.id,
        fsHeadName: fsHead.fsHeadName,
        blockers: validation.blockers,
      });
    }
  }

  if (blockedCount > 0) {
    blockers.push({
      code: "FS_HEADS_INCOMPLETE",
      message: `${blockedCount} of ${fsHeads.length} FS Head working paper(s) have blocking issues`,
      isaReference: "ISA 330",
      severity: "CRITICAL",
      resolution: "Complete all FS Head working papers before finalizing the engagement",
      entityType: "FSHeadWorkingPaper",
    });
  }

  const independenceResult = await validateIndependence(engagementId);
  blockers.push(...independenceResult.blockers);

  const eqcrResult = await validateEQCR(engagementId);
  blockers.push(...eqcrResult.blockers);

  blockers.sort((a, b) => {
    const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  return {
    canComplete: blockers.length === 0,
    blockers,
    warnings,
    fsHeadStatus: {
      total: fsHeads.length,
      completed: completedCount,
      blocked: blockedCount,
      fsHeadBlockers,
    },
    independenceStatus: {
      cleared: independenceResult.cleared,
      pendingDeclarations: independenceResult.pendingDeclarations,
      pendingThreats: independenceResult.pendingThreats,
    },
    eqcrStatus: {
      required: eqcrResult.required,
      assigned: eqcrResult.assigned,
      completed: eqcrResult.completed,
      comments: eqcrResult.comments,
      unresolvedComments: eqcrResult.unresolvedComments,
    },
  };
}

export const fsHeadEnforcement = {
  validateFSHeadCompletion,
  validateEngagementCompletion,
  checkEQCRRequired,
  SIGN_OFF_ROLE_MATRIX,
  MIN_CONCLUSION_LENGTH,
};

export default fsHeadEnforcement;
