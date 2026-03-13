/**
 * @deprecated LEGACY — replaced by phaseGateEngine.ts (canonical 19-phase system).
 * The enforcement engine's maker-checker and sign-off logic is partially retained
 * for routes that still consume it. New phase enforcement should use phaseGateEngine.ts.
 */
import { prisma } from "../db";
import type { UserRole, AuditPhase } from "@prisma/client";
import * as crypto from "crypto";
import { administrationService } from "./administrationService";
import { prePlanningService } from "./prePlanningService";

type EnforcementPhase = 
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

type SignOffCategory =
  | "FINANCIAL_STATEMENTS"
  | "RISK_ASSESSMENT"
  | "PROCEDURE_COMPLETION"
  | "ADJUSTMENTS_POSTING"
  | "CONCLUSIONS_OPINION"
  | "DELIVERABLES"
  | "QR_EQCR";

type AIInteractionAction = "ACCEPT" | "REJECT" | "EDIT" | "REGENERATE";

const PHASE_SEQUENCE: EnforcementPhase[] = [
  "ADMINISTRATION",
  "PRE_PLANNING",
  "REQUISITION",
  "PLANNING",
  "EXECUTION",
  "EVIDENCE",
  "FINALIZATION",
  "DELIVERABLES",
  "QR_EQCR",
  "INSPECTION"
];

const PRISMA_TO_ENFORCEMENT_MAP: Record<string, EnforcementPhase> = {
  "ONBOARDING": "ADMINISTRATION",
  "PRE_PLANNING": "PRE_PLANNING",
  "REQUISITION": "REQUISITION",
  "PLANNING": "PLANNING",
  "EXECUTION": "EXECUTION",
  "FINALIZATION": "FINALIZATION",
  "REPORTING": "DELIVERABLES",
  "EQCR": "QR_EQCR",
  "INSPECTION": "INSPECTION"
};

const ENFORCEMENT_TO_PRISMA_MAP: Record<EnforcementPhase, string> = {
  "ADMINISTRATION": "ONBOARDING",
  "PRE_PLANNING": "PRE_PLANNING",
  "REQUISITION": "REQUISITION",
  "PLANNING": "PLANNING",
  "EXECUTION": "EXECUTION",
  "EVIDENCE": "EXECUTION",
  "FINALIZATION": "FINALIZATION",
  "DELIVERABLES": "REPORTING",
  "QR_EQCR": "EQCR",
  "INSPECTION": "INSPECTION"
};

export function prismaPhaseToEnforcement(prismaPhase: AuditPhase | string): EnforcementPhase {
  return PRISMA_TO_ENFORCEMENT_MAP[prismaPhase] || "ADMINISTRATION";
}

export function enforcementToPrismaPhase(enfPhase: EnforcementPhase): string {
  return ENFORCEMENT_TO_PRISMA_MAP[enfPhase] || "ONBOARDING";
}

const PLANNING_SUB_PHASES = ["GL_UPLOAD", "TB_COMPILATION", "FS_PREPARATION"];
const EXECUTION_SUB_PHASES = ["ADJUSTMENTS", "ADJUSTED_FS"];

const ROLE_HIERARCHY: Record<UserRole, number> = {
  STAFF: 1,
  SENIOR: 2,
  MANAGER: 3,
  EQCR: 4,
  PARTNER: 5,
  FIRM_ADMIN: 6,
  SUPER_ADMIN: 99,
};

const SIGN_OFF_REQUIRED_ROLES: Record<SignOffCategory, UserRole[]> = {
  FINANCIAL_STATEMENTS: ["PARTNER", "FIRM_ADMIN"],
  RISK_ASSESSMENT: ["PARTNER", "FIRM_ADMIN"],
  PROCEDURE_COMPLETION: ["SENIOR", "MANAGER", "PARTNER", "FIRM_ADMIN"],
  ADJUSTMENTS_POSTING: ["PARTNER", "FIRM_ADMIN"],
  CONCLUSIONS_OPINION: ["PARTNER", "FIRM_ADMIN"],
  DELIVERABLES: ["PARTNER", "FIRM_ADMIN"],
  QR_EQCR: ["EQCR", "FIRM_ADMIN"],
};

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
  category: SignOffCategory;
  entityType: string;
  entityId: string;
  description: string;
  requiredRole: UserRole;
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

export interface AuditTrailEntry {
  userId: string;
  userRole: string;
  engagementId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  field?: string;
  beforeValue?: any;
  afterValue?: any;
  reason?: string;
  isaReference?: string;
  module?: string;
  screen?: string;
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: string;
  aiPromptHash?: string;
  aiOutputId?: string;
  aiAction?: "ACCEPT" | "REJECT" | "EDIT" | "REGENERATE";
}

export interface AIInteractionEntry {
  userId: string;
  userRole: string;
  engagementId?: string;
  promptText: string;
  outputText: string;
  action: "ACCEPT" | "REJECT" | "EDIT" | "REGENERATE";
  editedOutput?: string;
  contextType?: string;
  contextId?: string;
  module?: string;
  screen?: string;
  processingTimeMs?: number;
  tokenCount?: number;
  modelUsed?: string;
  ipAddress?: string;
  userAgent?: string;
}

class AuditEnforcementEngine {
  async getEngagementStatus(engagementId: string): Promise<EnforcementStatus> {
    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId }
    });

    const enforcementGates = await (prisma as any).enforcementGate?.findMany({
      where: { engagementId }
    }).catch(() => []) || [];

    const makerCheckerWorkflows = await (prisma as any).makerCheckerWorkflow?.findMany({
      where: { engagementId, isComplete: false, isCancelled: false }
    }).catch(() => []) || [];

    const signOffRegisters = await prisma.signOffRegister.findMany({
      where: { engagementId, status: { in: ["REQUIRED", "PENDING_REVIEW"] } }
    }).catch(() => []);

    if (!engagement) {
      throw new Error("Engagement not found");
    }

    // Get pre-planning status BEFORE computing phase status
    const prePlanningStatus = await prePlanningService.getPrePlanningStatus(engagementId);
    const canProceedToPlanning = await prePlanningService.canProceedToPlanning(engagementId);

    const phaseStatus: Record<EnforcementPhase, PhaseGateStatus> = {} as any;
    const blockedReasons: BlockedReason[] = [];

    for (const phase of PHASE_SEQUENCE) {
      const phaseGates = enforcementGates.filter((g: any) => g.phase === phase);
      const passedGates = phaseGates.filter((g: any) => g.isPassed).length;
      const blockers = phaseGates.filter((g: any) => !g.isPassed && g.isBlocking).map((g: any) => g.blockedReason || g.description);
      
      // For REQUISITION phase, use PhaseProgress table (no enforcement gates in schema)
      if (phase === "REQUISITION") {
        const previousPhaseIndex = PHASE_SEQUENCE.indexOf(phase) - 1;
        const previousPhaseComplete = previousPhaseIndex < 0 || 
          (phaseStatus[PHASE_SEQUENCE[previousPhaseIndex]]?.isComplete ?? false);
        const reqProgress = await prisma.phaseProgress.findFirst({
          where: { engagementId, phase: "REQUISITION" }
        });
        const isReqComplete = reqProgress?.status === "COMPLETED" && reqProgress?.completionPercentage === 100;
        const reqBlockers: string[] = [];
        if (!previousPhaseComplete) {
          reqBlockers.push(`Previous phase ${PHASE_SEQUENCE[previousPhaseIndex]} not complete`);
        }
        if (!isReqComplete && !reqProgress) {
          reqBlockers.push("Data intake not started");
        }
        phaseStatus[phase] = {
          phase,
          isAccessible: previousPhaseComplete,
          isComplete: isReqComplete,
          isLocked: false,
          blockers: reqBlockers,
          gatesPassed: isReqComplete ? 1 : 0,
          totalGates: 1
        };
        if (!previousPhaseComplete) {
          blockedReasons.push({
            phase,
            reason: `Previous phase ${PHASE_SEQUENCE[previousPhaseIndex]} not complete`,
            resolution: `Complete all requirements in ${PHASE_SEQUENCE[previousPhaseIndex]} phase`,
            isaReference: "ISA 300"
          });
        }
        continue;
      }

      // For PRE_PLANNING phase, use actual pre-planning gate status
      if (phase === "PRE_PLANNING") {
        const previousPhaseIndex = PHASE_SEQUENCE.indexOf(phase) - 1;
        const previousPhaseComplete = previousPhaseIndex < 0 || 
          (phaseStatus[PHASE_SEQUENCE[previousPhaseIndex]]?.isComplete ?? true);
        
        const totalGates = prePlanningStatus.gates.length;
        const completedGates = prePlanningStatus.gates.filter(g => g.status === "COMPLETED").length;
        
        phaseStatus[phase] = {
          phase,
          isAccessible: true,
          isComplete: prePlanningStatus.isComplete,
          isLocked: false,
          blockers: prePlanningStatus.blockedReasons.map(br => br.reason),
          gatesPassed: completedGates,
          totalGates: totalGates
        };
        continue;
      }

      // For PLANNING phase, track pre-planning status but don't block
      if (phase === "PLANNING") {
        phaseStatus[phase] = {
          phase,
          isAccessible: true,
          isComplete: passedGates === phaseGates.length && phaseGates.length > 0,
          isLocked: false,
          blockers: [],
          gatesPassed: passedGates,
          totalGates: phaseGates.length
        };
        continue;
      }
      
      const previousPhaseIndex = PHASE_SEQUENCE.indexOf(phase) - 1;
      const previousPhaseComplete = previousPhaseIndex < 0 || 
        (phaseStatus[PHASE_SEQUENCE[previousPhaseIndex]]?.isComplete ?? false);

      phaseStatus[phase] = {
        phase,
        isAccessible: true,
        isComplete: passedGates === phaseGates.length && phaseGates.length > 0,
        isLocked: phase === "INSPECTION" ? this.isPhaseLockedForEngagement(engagement, phase) : false,
        blockers,
        gatesPassed: passedGates,
        totalGates: phaseGates.length
      };

      if (!previousPhaseComplete && phase !== "ADMINISTRATION") {
        blockedReasons.push({
          phase,
          reason: `Previous phase ${PHASE_SEQUENCE[previousPhaseIndex]} not complete`,
          resolution: `Complete all requirements in ${PHASE_SEQUENCE[previousPhaseIndex]} phase`,
          isaReference: "ISA 300"
        });
      }

      for (const gate of phaseGates.filter((g: any) => !g.isPassed && g.isBlocking)) {
        blockedReasons.push({
          phase,
          subPhase: gate.subPhase || undefined,
          reason: gate.blockedReason || gate.description,
          isaReference: gate.isaReference || undefined,
          dependency: gate.dependencies?.join(", "),
          resolution: `Complete: ${gate.description}`
        });
      }
    }

    // Add pre-planning pending sign-offs to the list
    const prePlanningPendingSignOffs: PendingSignOff[] = prePlanningStatus.pendingSignOffs.map(pending => ({
      id: `pre-planning-${pending.gate}`,
      category: "PROCEDURE_COMPLETION" as SignOffCategory,
      entityType: "PrePlanningGate",
      entityId: pending.gate,
      description: `${pending.gate.replace(/_/g, " ")} sign-off required`,
      requiredRole: pending.requiredRole as UserRole,
      isaReference: pending.isaReference
    }));

    const signOffRegisterPending: PendingSignOff[] = signOffRegisters.map((so: any) => ({
      id: so.id,
      category: so.signOffType as unknown as SignOffCategory,
      entityType: "SignOffRegister",
      entityId: so.id,
      description: so.description,
      requiredRole: so.requiredRole as UserRole,
      isaReference: so.isaReference || undefined
    }));

    const pendingSignOffs: PendingSignOff[] = [...prePlanningPendingSignOffs, ...signOffRegisterPending];

    const makerCheckerPending: MakerCheckerStatus[] = makerCheckerWorkflows.map((mc: any) => ({
      id: mc.id,
      entityType: mc.entityType,
      entityId: mc.entityId,
      currentStage: mc.currentStage,
      preparerId: mc.preparerId,
      reviewerId: mc.reviewerId || undefined,
      approverId: mc.approverId || undefined
    }));

    const currentPhase = this.determineCurrentPhase(phaseStatus);
    const isInspectionMode = engagement.finalizationLocked || false;

    return {
      engagementId,
      currentPhase,
      phaseStatus,
      blockedReasons,
      pendingSignOffs,
      makerCheckerPending,
      isLocked: isInspectionMode,
      isInspectionMode
    };
  }

  private determineCurrentPhase(phaseStatus: Record<EnforcementPhase, PhaseGateStatus>): EnforcementPhase {
    for (const phase of PHASE_SEQUENCE) {
      if (!phaseStatus[phase].isComplete) {
        return phase;
      }
    }
    return "INSPECTION";
  }

  private isPhaseLockedForEngagement(engagement: any, phase: EnforcementPhase): boolean {
    switch (phase) {
      case "ADMINISTRATION":
      case "PRE_PLANNING":
        return engagement.onboardingLocked;
      case "PLANNING":
        return engagement.planningLocked;
      case "EXECUTION":
      case "EVIDENCE":
        return engagement.executionLocked;
      case "FINALIZATION":
      case "DELIVERABLES":
      case "QR_EQCR":
        return engagement.finalizationLocked;
      case "INSPECTION":
        return true;
      default:
        return false;
    }
  }

  async checkPhaseAccess(
    engagementId: string,
    targetPhase: EnforcementPhase,
    userId: string,
    userRole: UserRole
  ): Promise<{ allowed: boolean; reason?: string; blockers?: BlockedReason[] }> {
    const status = await this.getEngagementStatus(engagementId);
    const blockers: BlockedReason[] = [];

    if (status.isInspectionMode) {
      return {
        allowed: false,
        reason: "Engagement is in read-only inspection mode",
        blockers: [{
          phase: targetPhase,
          reason: "Engagement is in inspection mode",
          resolution: "Contact Partner to unlock if amendments needed",
          isaReference: "ISQM 1"
        }]
      };
    }

    const targetIndex = PHASE_SEQUENCE.indexOf(targetPhase);
    for (let i = 0; i < targetIndex; i++) {
      const prevPhase = PHASE_SEQUENCE[i];
      const prevStatus = status.phaseStatus[prevPhase];
      if (prevStatus && !prevStatus.isComplete && prevPhase !== "EVIDENCE") {
        blockers.push({
          phase: targetPhase,
          reason: `Prerequisite phase ${prevPhase} is not complete`,
          resolution: `Complete all requirements in ${prevPhase} before accessing ${targetPhase}`,
          isaReference: "ISA 300.A2"
        });
      }
    }

    const openReviewNotes = await prisma.reviewNote.findMany({
      where: {
        engagementId,
        status: "OPEN",
        severity: { in: ["CRITICAL", "WARNING"] }
      }
    }).catch(() => []);

    const phaseReviewNotes = openReviewNotes.filter((n: any) => {
      const notePhase = PRISMA_TO_ENFORCEMENT_MAP[n.phase] || n.phase;
      const notePhaseIndex = PHASE_SEQUENCE.indexOf(notePhase as EnforcementPhase);
      return notePhaseIndex >= 0 && notePhaseIndex < targetIndex;
    });

    if (phaseReviewNotes.length > 0) {
      blockers.push({
        phase: targetPhase,
        reason: `${phaseReviewNotes.length} open review note(s) in preceding phases must be cleared`,
        resolution: "Address all CRITICAL and WARNING review notes before progressing",
        isaReference: "ISA 220.20"
      });
    }

    if (blockers.length > 0) {
      return {
        allowed: false,
        reason: blockers.map(b => b.reason).join("; "),
        blockers
      };
    }

    return { allowed: true };
  }

  async canPerformAction(
    engagementId: string,
    action: string,
    entityType: string,
    userId: string,
    userRole: UserRole,
    phase: EnforcementPhase
  ): Promise<{ allowed: boolean; reason?: string; requiredSignOff?: SignOffCategory }> {
    const status = await this.getEngagementStatus(engagementId);

    if (status.isInspectionMode) {
      return {
        allowed: false,
        reason: "Engagement is in read-only inspection mode"
      };
    }

    if (status.phaseStatus[phase]?.isLocked) {
      return {
        allowed: false,
        reason: `Phase ${phase} is locked. Partner unlock required.`
      };
    }

    const signOffActions = ["FINALIZE", "APPROVE", "SIGN_OFF", "POST", "ISSUE"];
    if (signOffActions.some(a => action.toUpperCase().includes(a))) {
      const category = this.mapActionToSignOffCategory(action, entityType);
      if (category) {
        const requiredRoles = SIGN_OFF_REQUIRED_ROLES[category];
        if (!requiredRoles.includes(userRole)) {
          return {
            allowed: false,
            reason: `${category} sign-off requires role: ${requiredRoles.join(" or ")}`,
            requiredSignOff: category
          };
        }
      }
    }

    return { allowed: true };
  }

  private mapActionToSignOffCategory(action: string, entityType: string): SignOffCategory | null {
    const upperAction = action.toUpperCase();
    const upperEntity = entityType.toUpperCase();

    if (upperEntity.includes("FINANCIAL") || upperEntity.includes("FS")) {
      return "FINANCIAL_STATEMENTS";
    }
    if (upperEntity.includes("RISK")) {
      return "RISK_ASSESSMENT";
    }
    if (upperEntity.includes("PROCEDURE")) {
      return "PROCEDURE_COMPLETION";
    }
    if (upperEntity.includes("ADJUSTMENT") || upperEntity.includes("AJE")) {
      return "ADJUSTMENTS_POSTING";
    }
    if (upperEntity.includes("OPINION") || upperEntity.includes("CONCLUSION")) {
      return "CONCLUSIONS_OPINION";
    }
    if (upperEntity.includes("DELIVERABLE") || upperEntity.includes("REPORT")) {
      return "DELIVERABLES";
    }
    if (upperEntity.includes("EQCR") || upperEntity.includes("QCR")) {
      return "QR_EQCR";
    }

    return null;
  }

  async validateMakerChecker(
    engagementId: string,
    entityType: string,
    entityId: string,
    action: "PREPARE" | "REVIEW" | "APPROVE",
    userId: string,
    userRole: UserRole
  ): Promise<{ allowed: boolean; reason?: string }> {
    const workflow = await (prisma as any).makerCheckerWorkflow?.findUnique({
      where: {
        engagementId_entityType_entityId: {
          engagementId,
          entityType,
          entityId
        }
      }
    });

    if (action === "PREPARE") {
      if (workflow && !workflow.isCancelled) {
        return { allowed: false, reason: "Workflow already exists for this entity" };
      }
      return { allowed: true };
    }

    if (!workflow) {
      return { allowed: false, reason: "No workflow found. Entity must be prepared first." };
    }

    if (action === "REVIEW") {
      if (workflow.currentStage !== "PREPARED") {
        return { allowed: false, reason: `Cannot review. Current stage is ${workflow.currentStage}` };
      }
      if (workflow.preparerId === userId) {
        return { allowed: false, reason: "Maker-checker violation: Preparer cannot review their own work (ISA 220)" };
      }
      if (ROLE_HIERARCHY[userRole] < ROLE_HIERARCHY.MANAGER) {
        return { allowed: false, reason: "Review requires Manager role or above" };
      }
      return { allowed: true };
    }

    if (action === "APPROVE") {
      if (workflow.currentStage !== "REVIEWED") {
        return { allowed: false, reason: `Cannot approve. Current stage is ${workflow.currentStage}` };
      }
      if (workflow.preparerId === userId || workflow.reviewerId === userId) {
        return { allowed: false, reason: "Maker-checker violation: Preparer/Reviewer cannot approve (ISA 220)" };
      }
      if (!["PARTNER", "FIRM_ADMIN"].includes(userRole)) {
        return { allowed: false, reason: "Approval requires Partner role" };
      }
      return { allowed: true };
    }

    return { allowed: false, reason: "Invalid action" };
  }

  async createMakerCheckerWorkflow(
    engagementId: string,
    entityType: string,
    entityId: string,
    preparerId: string,
    comments?: string
  ): Promise<{ success: boolean; workflowId?: string; error?: string }> {
    try {
      const existing = await (prisma as any).makerCheckerWorkflow.findUnique({
        where: {
          engagementId_entityType_entityId: {
            engagementId,
            entityType,
            entityId
          }
        }
      });

      if (existing && !existing.isCancelled) {
        return { success: false, error: "Workflow already exists" };
      }

      const workflow = await (prisma as any).makerCheckerWorkflow.create({
        data: {
          engagementId,
          entityType,
          entityId,
          workflowType: "STANDARD",
          currentStage: "PREPARED",
          preparerId,
          preparerComments: comments
        }
      });

      return { success: true, workflowId: workflow.id };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async advanceWorkflow(
    engagementId: string,
    entityType: string,
    entityId: string,
    action: "REVIEW" | "APPROVE",
    userId: string,
    userRole: UserRole,
    comments?: string,
    status?: string
  ): Promise<{ success: boolean; error?: string }> {
    const validation = await this.validateMakerChecker(engagementId, entityType, entityId, action, userId, userRole);
    if (!validation.allowed) {
      return { success: false, error: validation.reason };
    }

    try {
      if (action === "REVIEW") {
        await (prisma as any).makerCheckerWorkflow.update({
          where: {
            engagementId_entityType_entityId: {
              engagementId,
              entityType,
              entityId
            }
          },
          data: {
            currentStage: "REVIEWED",
            reviewerId: userId,
            reviewedAt: new Date(),
            reviewerComments: comments,
            reviewStatus: status || "APPROVED"
          }
        });
      } else if (action === "APPROVE") {
        await (prisma as any).makerCheckerWorkflow.update({
          where: {
            engagementId_entityType_entityId: {
              engagementId,
              entityType,
              entityId
            }
          },
          data: {
            currentStage: "APPROVED",
            approverId: userId,
            approvedAt: new Date(),
            approverComments: comments,
            approvalStatus: status || "APPROVED",
            isComplete: true
          }
        });
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async logAuditTrail(entry: AuditTrailEntry): Promise<string> {
    const record = await (prisma.auditTrail.create as any)({
      data: {
        userId: entry.userId,
        userRole: entry.userRole,
        engagementId: entry.engagementId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        field: entry.field,
        beforeValue: entry.beforeValue,
        afterValue: entry.afterValue,
        reason: entry.reason,
        isaReference: entry.isaReference,
        module: entry.module,
        screen: entry.screen,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        deviceInfo: entry.deviceInfo,
        aiPromptHash: entry.aiPromptHash,
        aiOutputId: entry.aiOutputId,
        aiAction: entry.aiAction,
        isImmutable: true
      }
    });

    return record.id;
  }

  async logAIInteraction(entry: AIInteractionEntry): Promise<{ id: string; outputId: string }> {
    const promptHash = crypto.createHash("sha256").update(entry.promptText).digest("hex");
    const outputId = `ai-${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;

    const record = await (prisma as any).aIInteractionLog.create({
      data: {
        userId: entry.userId,
        userRole: entry.userRole,
        engagementId: entry.engagementId,
        promptHash,
        promptText: entry.promptText,
        outputId,
        outputText: entry.outputText,
        action: entry.action,
        editedOutput: entry.editedOutput,
        contextType: entry.contextType,
        contextId: entry.contextId,
        module: entry.module,
        screen: entry.screen,
        processingTimeMs: entry.processingTimeMs,
        tokenCount: entry.tokenCount,
        modelUsed: entry.modelUsed,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent
      }
    });

    await this.logAuditTrail({
      userId: entry.userId,
      userRole: entry.userRole,
      engagementId: entry.engagementId,
      action: `AI_${entry.action}`,
      entityType: "AIInteraction",
      entityId: record.id,
      aiPromptHash: promptHash,
      aiOutputId: outputId,
      aiAction: entry.action,
      module: entry.module,
      screen: entry.screen,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent
    });

    return { id: record.id, outputId };
  }

  async initializeEngagementGates(engagementId: string, userId: string, userRole: string): Promise<void> {
    const existingGates = await (prisma as any).enforcementGate.findMany({
      where: { engagementId }
    });

    if (existingGates.length > 0) {
      return;
    }

    const gates = [
      { phase: "ADMINISTRATION" as EnforcementPhase, gateType: "CLIENT_ACCEPTANCE", description: "Client acceptance approved", isaReference: "ISA 210, ISQM 1" },
      { phase: "ADMINISTRATION" as EnforcementPhase, gateType: "ENGAGEMENT_LETTER", description: "Engagement letter signed", isaReference: "ISA 210" },
      { phase: "ADMINISTRATION" as EnforcementPhase, gateType: "INDEPENDENCE_CONFIRMED", description: "Independence confirmed by all team members", isaReference: "ISA 220, IESBA Code" },
      { phase: "PRE_PLANNING" as EnforcementPhase, gateType: "TEAM_ASSIGNED", description: "Audit team assigned", isaReference: "ISA 220" },
      { phase: "PRE_PLANNING" as EnforcementPhase, gateType: "PRIOR_YEAR_REVIEWED", description: "Prior year matters reviewed", isaReference: "ISA 315" },
      { phase: "PLANNING" as EnforcementPhase, gateType: "GL_UPLOADED", description: "General Ledger uploaded", isaReference: "ISA 230", subPhase: "GL_UPLOAD" },
      { phase: "PLANNING" as EnforcementPhase, gateType: "TB_COMPILED", description: "Trial Balance compiled from GL", isaReference: "ISA 230", subPhase: "TB_COMPILATION" },
      { phase: "PLANNING" as EnforcementPhase, gateType: "FS_PREPARED", description: "Financial Statements prepared from TB", isaReference: "ISA 320", subPhase: "FS_PREPARATION" },
      { phase: "PLANNING" as EnforcementPhase, gateType: "MATERIALITY_SET", description: "Materiality calculated and approved", isaReference: "ISA 320", requiredSignOff: "RISK_ASSESSMENT" as SignOffCategory },
      { phase: "PLANNING" as EnforcementPhase, gateType: "RISK_ASSESSMENT_COMPLETE", description: "Risk assessment completed and approved", isaReference: "ISA 315", requiredSignOff: "RISK_ASSESSMENT" as SignOffCategory },
      { phase: "EXECUTION" as EnforcementPhase, gateType: "PROCEDURES_COMPLETE", description: "All audit procedures completed", isaReference: "ISA 330", requiredSignOff: "PROCEDURE_COMPLETION" as SignOffCategory },
      { phase: "EXECUTION" as EnforcementPhase, gateType: "ADJUSTMENTS_REVIEWED", description: "Proposed adjustments reviewed", isaReference: "ISA 450", subPhase: "ADJUSTMENTS" },
      { phase: "EXECUTION" as EnforcementPhase, gateType: "ADJUSTMENTS_POSTED", description: "Approved adjustments posted to adjusted FS", isaReference: "ISA 450", subPhase: "ADJUSTED_FS", requiredSignOff: "ADJUSTMENTS_POSTING" as SignOffCategory },
      { phase: "EVIDENCE" as EnforcementPhase, gateType: "EVIDENCE_COMPLETE", description: "All evidence collected and linked", isaReference: "ISA 500" },
      { phase: "EVIDENCE" as EnforcementPhase, gateType: "EVIDENCE_REVIEWED", description: "Evidence reviewed for sufficiency", isaReference: "ISA 500, ISA 520" },
      { phase: "FINALIZATION" as EnforcementPhase, gateType: "SUBSEQUENT_EVENTS", description: "Subsequent events reviewed", isaReference: "ISA 560" },
      { phase: "FINALIZATION" as EnforcementPhase, gateType: "GOING_CONCERN", description: "Going concern assessment complete", isaReference: "ISA 570" },
      { phase: "FINALIZATION" as EnforcementPhase, gateType: "REPRESENTATIONS_OBTAINED", description: "Written representations obtained", isaReference: "ISA 580" },
      { phase: "FINALIZATION" as EnforcementPhase, gateType: "CONCLUSION_FORMED", description: "Audit conclusion formed", isaReference: "ISA 700", requiredSignOff: "CONCLUSIONS_OPINION" as SignOffCategory },
      { phase: "DELIVERABLES" as EnforcementPhase, gateType: "REPORT_DRAFTED", description: "Audit report drafted", isaReference: "ISA 700" },
      { phase: "DELIVERABLES" as EnforcementPhase, gateType: "REPORT_APPROVED", description: "Audit report approved by Partner", isaReference: "ISA 700, ISA 220", requiredSignOff: "DELIVERABLES" as SignOffCategory },
      { phase: "DELIVERABLES" as EnforcementPhase, gateType: "REPORT_ISSUED", description: "Audit report issued", isaReference: "ISA 700", requiredSignOff: "DELIVERABLES" as SignOffCategory },
      { phase: "QR_EQCR" as EnforcementPhase, gateType: "EQCR_ASSIGNED", description: "EQCR reviewer assigned (if required)", isaReference: "ISA 220, ISQM 1" },
      { phase: "QR_EQCR" as EnforcementPhase, gateType: "EQCR_COMPLETE", description: "EQCR review completed", isaReference: "ISA 220, ISQM 1", requiredSignOff: "QR_EQCR" as SignOffCategory },
      { phase: "INSPECTION" as EnforcementPhase, gateType: "FILE_ASSEMBLED", description: "Audit file assembled", isaReference: "ISA 230" },
      { phase: "INSPECTION" as EnforcementPhase, gateType: "FILE_LOCKED", description: "Audit file locked for inspection", isaReference: "ISA 230" },
    ];

    await (prisma as any).enforcementGate.createMany({
      data: gates.map(gate => ({
        engagementId,
        phase: gate.phase,
        subPhase: (gate as any).subPhase,
        gateType: gate.gateType,
        description: gate.description,
        isaReference: gate.isaReference,
        isBlocking: true,
        isPassed: false,
        requiredSignOff: (gate as any).requiredSignOff,
        dependencies: [],
        blockedReason: `Pending: ${gate.description}`
      }))
    });

    await this.logAuditTrail({
      userId,
      userRole,
      engagementId,
      action: "INITIALIZE_ENFORCEMENT_GATES",
      entityType: "EnforcementEngine",
      entityId: engagementId,
      isaReference: "ISA 230, ISQM 1",
      module: "enforcement"
    });
  }

  async passGate(
    engagementId: string,
    gateType: string,
    userId: string,
    userRole: UserRole,
    comments?: string
  ): Promise<{ success: boolean; error?: string }> {
    const gate = await (prisma as any).enforcementGate.findFirst({
      where: { engagementId, gateType }
    });

    if (!gate) {
      return { success: false, error: `Gate ${gateType} not found` };
    }

    if (gate.isPassed) {
      return { success: true };
    }

    if (gate.requiredSignOff) {
      const requiredRoles = SIGN_OFF_REQUIRED_ROLES[gate.requiredSignOff as SignOffCategory];
      if (requiredRoles && !requiredRoles.includes(userRole)) {
        return { success: false, error: `Gate requires ${gate.requiredSignOff} sign-off by ${requiredRoles.join(" or ")}` };
      }
    }

    await (prisma as any).enforcementGate.update({
      where: { id: gate.id },
      data: {
        isPassed: true,
        passedById: userId,
        passedAt: new Date(),
        passedComments: comments,
        blockedReason: null
      }
    });

    await this.logAuditTrail({
      userId,
      userRole,
      engagementId,
      action: "PASS_ENFORCEMENT_GATE",
      entityType: "EnforcementGate",
      entityId: gate.id,
      field: "isPassed",
      beforeValue: false,
      afterValue: true,
      reason: comments,
      isaReference: gate.isaReference || undefined,
      module: "enforcement"
    });

    return { success: true };
  }

  async getWhyBlocked(engagementId: string, phase?: EnforcementPhase): Promise<BlockedReason[]> {
    const status = await this.getEngagementStatus(engagementId);
    
    if (phase) {
      return status.blockedReasons.filter(b => b.phase === phase);
    }
    
    return status.blockedReasons;
  }

  isAIOutputNonAuthoritative(): boolean {
    return true;
  }

  getAIOutputLabel(): string {
    return "AI-Assisted – Subject to Professional Judgment";
  }

  async getFirmEnforcementSettings(firmId: string) {
    const settings = await administrationService.getFirmSettings(firmId);
    return {
      enforceRBAC: settings?.enforceRBAC ?? true,
      makerCheckerMode: settings?.makerCheckerMode ?? "THREE_TIER",
      makerCheckerEntities: settings?.makerCheckerEntities ?? ["FINANCIAL_STATEMENTS", "RISK_ASSESSMENT", "ADJUSTMENTS", "OPINION"],
      allowSelfApproval: settings?.allowSelfApproval ?? false,
      requireDifferentApprovers: settings?.requireDifferentApprovers ?? true,
      requireDigitalSignatures: settings?.requireDigitalSignatures ?? true,
      requirePartnerPIN: settings?.requirePartnerPIN ?? true,
      aiRequiresHumanApproval: settings?.aiRequiresHumanApproval ?? true,
      aiOutputLabel: settings?.aiOutputLabel ?? "AI-Assisted – Subject to Professional Judgment",
      immutableAuditTrail: settings?.immutableAuditTrail ?? true,
      logFieldChanges: settings?.logFieldChanges ?? true
    };
  }

  async validateMakerCheckerForFirm(
    firmId: string,
    entityType: string,
    preparerId: string,
    reviewerId?: string,
    approverId?: string
  ): Promise<{ valid: boolean; error?: string }> {
    const settings = await this.getFirmEnforcementSettings(firmId);

    if (settings.makerCheckerMode === "DISABLED") {
      return { valid: true };
    }

    if (!settings.makerCheckerEntities.includes(entityType)) {
      return { valid: true };
    }

    if (!settings.allowSelfApproval) {
      if (reviewerId && preparerId === reviewerId) {
        return { valid: false, error: "Preparer cannot be the reviewer (no self-approval allowed)" };
      }
      if (approverId && preparerId === approverId) {
        return { valid: false, error: "Preparer cannot be the approver (no self-approval allowed)" };
      }
    }

    if (settings.requireDifferentApprovers && reviewerId && approverId) {
      if (reviewerId === approverId) {
        return { valid: false, error: "Reviewer and approver must be different users" };
      }
    }

    return { valid: true };
  }

  async getRoleSignOffCapabilities(firmId: string, role: UserRole) {
    const roleConfigs = await administrationService.getRoleConfigurations(firmId);
    const roleConfig = roleConfigs.find((r: any) => r.role === role);

    return {
      canActAsReviewer: roleConfig?.canActAsReviewer ?? false,
      canActAsApprover: roleConfig?.canActAsApprover ?? false,
      signOffCategories: roleConfig?.signOffCategories ?? [],
      accessiblePhases: roleConfig?.accessiblePhases ?? [],
      requiresPartnerPIN: roleConfig?.requiresPartnerPIN ?? false,
      hierarchyLevel: roleConfig?.hierarchyLevel ?? 1
    };
  }

  async canUserSignOff(
    firmId: string,
    userId: string,
    userRole: UserRole,
    signOffCategory: SignOffCategory
  ): Promise<{ allowed: boolean; reason?: string }> {
    const capabilities = await this.getRoleSignOffCapabilities(firmId, userRole);
    
    if (!capabilities.signOffCategories.includes(signOffCategory)) {
      return { 
        allowed: false, 
        reason: `Role ${userRole} is not authorized for ${signOffCategory} sign-offs` 
      };
    }

    return { allowed: true };
  }

  async canUserAccessPhase(
    firmId: string,
    userRole: UserRole,
    phase: EnforcementPhase
  ): Promise<{ allowed: boolean; reason?: string }> {
    const capabilities = await this.getRoleSignOffCapabilities(firmId, userRole);
    
    if (!capabilities.accessiblePhases.includes(phase)) {
      return { 
        allowed: false, 
        reason: `Role ${userRole} does not have access to ${phase} phase` 
      };
    }

    return { allowed: true };
  }

  async evaluateEngagementRequirements(
    firmId: string,
    engagementData: {
      totalAssets?: number;
      totalRevenue?: number;
      riskLevel?: string;
      entityType?: string;
      industry?: string;
      isPIE?: boolean;
    }
  ) {
    return administrationService.evaluateEngagementFlags(firmId, engagementData);
  }

  async getAIGovernanceConfig(firmId: string) {
    const settings = await administrationService.getFirmSettings(firmId);
    return {
      aiEnabled: settings?.aiEnabled ?? true,
      aiRequiresHumanApproval: settings?.aiRequiresHumanApproval ?? true,
      aiOutputLabel: settings?.aiOutputLabel ?? "AI-Assisted – Subject to Professional Judgment",
      logAllAIInteractions: settings?.logAllAIInteractions ?? true,
      isNonAuthoritative: true,
      editableByUser: true
    };
  }

  async submitPhaseForReview(
    engagementId: string,
    phase: EnforcementPhase,
    userId: string,
    userRole: UserRole | string,
    comments?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const status = await this.getEngagementStatus(engagementId);
      const phaseStatus = status.phaseStatus[phase];

      if (!phaseStatus) {
        return { success: false, error: `Unknown phase: ${phase}` };
      }

      const signOffTypeMap: Record<EnforcementPhase, string> = {
          "ADMINISTRATION": "ENGAGEMENT_ACCEPTANCE",
          "PRE_PLANNING": "ENGAGEMENT_ACCEPTANCE",
          "REQUISITION": "REQUISITION_APPROVAL",
          "PLANNING": "PLANNING_APPROVAL",
          "EXECUTION": "EXECUTION_APPROVAL",
          "EVIDENCE": "SUBSTANTIVE_TESTING_APPROVAL",
          "FINALIZATION": "FINALIZATION_APPROVAL",
          "DELIVERABLES": "REPORT_APPROVAL",
          "QR_EQCR": "EQCR_CLEARANCE",
          "INSPECTION": "ARCHIVAL_APPROVAL"
        };
        
        const prismaPhase = enforcementToPrismaPhase(phase);
        
        await prisma.signOffRegister.create({
          data: {
            engagementId,
            signOffType: signOffTypeMap[phase] as any,
            phase: prismaPhase as any,
            description: `${phase} phase submitted for review`,
            status: "PENDING_REVIEW",
            requiredRole: "MANAGER",
            preparedById: userId,
            preparedAt: new Date(),
            preparerComments: comments || undefined,
            isaReference: "ISA 220, ISA 300"
          }
        });

      await this.logAuditTrail({
        userId,
        userRole: userRole as string,
        engagementId,
        action: "SUBMIT_FOR_REVIEW",
        entityType: "Phase",
        entityId: phase,
        reason: comments,
        isaReference: "ISA 220"
      });

      return { success: true };
    } catch (error: any) {
      console.error("Submit phase for review error:", error);
      return { success: false, error: error.message || "Failed to submit phase" };
    }
  }

  async approvePhase(
    engagementId: string,
    phase: EnforcementPhase,
    approved: boolean,
    userId: string,
    userRole: UserRole | string,
    comments?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const pendingReview = await prisma.signOffRegister.findFirst({
        where: {
          engagementId,
          status: "PENDING_REVIEW",
          description: { contains: phase }
        }
      });

      if (!pendingReview) {
        return { success: false, error: `No pending review found for phase ${phase}` };
      }

      await prisma.signOffRegister.update({
        where: { id: pendingReview.id },
        data: {
          status: approved ? "APPROVED" : "REJECTED",
          reviewedById: userId,
          reviewedAt: new Date(),
          reviewerComments: comments || undefined
        }
      });

      if (approved) {
        const lockField = this.getPhaseLockField(phase);
        if (lockField) {
          await prisma.engagement.update({
            where: { id: engagementId },
            data: { [lockField]: true }
          });
        }
      }

      await this.logAuditTrail({
        userId,
        userRole: userRole as string,
        engagementId,
        action: approved ? "APPROVE_PHASE" : "REJECT_PHASE",
        entityType: "Phase",
        entityId: phase,
        reason: comments,
        isaReference: "ISA 220"
      });

      return { success: true };
    } catch (error: any) {
      console.error("Approve phase error:", error);
      return { success: false, error: error.message || "Failed to approve phase" };
    }
  }

  async lockPhase(
    engagementId: string,
    phase: EnforcementPhase,
    lock: boolean,
    userId: string,
    userRole: UserRole | string,
    comments?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const lockField = this.getPhaseLockField(phase);
      if (!lockField) {
        return { success: false, error: `Cannot lock/unlock phase ${phase}` };
      }

      await prisma.engagement.update({
        where: { id: engagementId },
        data: { [lockField]: lock }
      });

      await this.logAuditTrail({
        userId,
        userRole: userRole as string,
        engagementId,
        action: lock ? "LOCK_PHASE" : "UNLOCK_PHASE",
        entityType: "Phase",
        entityId: phase,
        reason: comments,
        isaReference: "ISA 220, ISA 230"
      });

      return { success: true };
    } catch (error: any) {
      console.error("Lock phase error:", error);
      return { success: false, error: error.message || "Failed to update phase lock status" };
    }
  }

  async validateApprovalPrerequisites(
    engagementId: string,
    phase: EnforcementPhase,
    userId: string,
    userRole: UserRole
  ): Promise<{ allowed: boolean; reason?: string; missing: string[] }> {
    const missing: string[] = [];

    const openReviewNotes = await prisma.reviewNote.findMany({
      where: {
        engagementId,
        status: "OPEN",
        severity: { in: ["CRITICAL", "WARNING"] }
      }
    }).catch(() => []);

    if (openReviewNotes.length > 0) {
      missing.push(`${openReviewNotes.length} open review note(s) require resolution`);
    }

    const sectionSignOffs = await prisma.sectionSignOff.findMany({
      where: { engagementId, phase: phase as any }
    }).catch(() => []);

    const unprepared = sectionSignOffs.filter(s => !s.preparedById);
    if (unprepared.length > 0) {
      missing.push(`${unprepared.length} section(s) not yet prepared`);
    }

    const unreviewed = sectionSignOffs.filter(s => s.preparedById && !s.reviewedById);
    if (unreviewed.length > 0) {
      missing.push(`${unreviewed.length} section(s) prepared but not reviewed`);
    }

    if (!["PARTNER", "FIRM_ADMIN"].includes(userRole)) {
      missing.push("Partner role required for phase approval");
    }

    if (missing.length > 0) {
      return {
        allowed: false,
        reason: missing.join("; "),
        missing
      };
    }
    return { allowed: true, missing: [] };
  }

  async trackPostApprovalEdit(
    engagementId: string,
    phase: EnforcementPhase,
    entityType: string,
    entityId: string,
    userId: string,
    userRole: string,
    field: string,
    beforeValue: any,
    afterValue: any
  ): Promise<void> {
    try {
      await prisma.engagement.update({
        where: { id: engagementId },
        data: { version: { increment: 1 } }
      });
    } catch {
    }

    await this.logAuditTrail({
      userId,
      userRole,
      engagementId,
      action: "POST_APPROVAL_EDIT",
      entityType,
      entityId,
      field,
      beforeValue: JSON.stringify(beforeValue),
      afterValue: JSON.stringify(afterValue),
      reason: "Edit after approval - version bumped",
      isaReference: "ISA 230.14"
    });
  }

  private getPhaseLockField(phase: EnforcementPhase): string | null {
    switch (phase) {
      case "ADMINISTRATION":
      case "PRE_PLANNING":
        return "onboardingLocked";
      case "PLANNING":
        return "planningLocked";
      case "EXECUTION":
      case "EVIDENCE":
        return "executionLocked";
      case "FINALIZATION":
      case "DELIVERABLES":
      case "QR_EQCR":
        return "finalizationLocked";
      default:
        return null;
    }
  }
}

export const enforcementEngine = new AuditEnforcementEngine();
