import { Router, Request, Response } from "express";
import { PrismaClient, AuditPhase, UserRole } from "@prisma/client";
import { requireAuth, requireRoles } from "./auth";
import { SIGN_OFF_AUTHORITY, canMarkSignOff, canUnlockSignOff, SignOffLevel } from "./services/signOffAuthority";

const router = Router();
const prisma = new PrismaClient();

function enforceSignOffAuthority(
  req: Request,
  res: Response,
  signOffLevel: SignOffLevel
): boolean {
  const user = (req as any).user;
  if (!user?.role) {
    res.status(401).json({ error: "Authentication required" });
    return false;
  }

  const authority = canMarkSignOff(user.role as UserRole, signOffLevel);
  if (!authority.allowed) {
    res.status(403).json({
      error: authority.reason,
      requiredRoles: authority.allowedRoles,
      yourRole: user.role,
    });
    return false;
  }
  return true;
}

type SignOffTypeKey = 
  | "ENGAGEMENT_ACCEPTANCE"
  | "ENGAGEMENT_CONTINUANCE"
  | "INDEPENDENCE_CLEARANCE"
  | "ENGAGEMENT_LETTER_APPROVAL"
  | "PLANNING_APPROVAL"
  | "RISK_ASSESSMENT_APPROVAL"
  | "MATERIALITY_APPROVAL"
  | "AUDIT_STRATEGY_APPROVAL"
  | "EXECUTION_APPROVAL"
  | "CONTROLS_TESTING_APPROVAL"
  | "SUBSTANTIVE_TESTING_APPROVAL"
  | "FINALIZATION_APPROVAL"
  | "GOING_CONCERN_APPROVAL"
  | "SUBSEQUENT_EVENTS_CLEARANCE"
  | "WRITTEN_REPRESENTATIONS_APPROVAL"
  | "EQCR_CLEARANCE"
  | "REPORT_APPROVAL"
  | "REPORT_ISSUANCE"
  | "FILE_ASSEMBLY_APPROVAL"
  | "ARCHIVAL_APPROVAL";

const SIGN_OFF_ISA_REFERENCES: Record<SignOffTypeKey, string> = {
  ENGAGEMENT_ACCEPTANCE: "ISA 210/220",
  ENGAGEMENT_CONTINUANCE: "ISA 210/220",
  INDEPENDENCE_CLEARANCE: "ISA 220/IESBA",
  ENGAGEMENT_LETTER_APPROVAL: "ISA 210",
  PLANNING_APPROVAL: "ISA 300",
  RISK_ASSESSMENT_APPROVAL: "ISA 315",
  MATERIALITY_APPROVAL: "ISA 320",
  AUDIT_STRATEGY_APPROVAL: "ISA 300",
  EXECUTION_APPROVAL: "ISA 330",
  CONTROLS_TESTING_APPROVAL: "ISA 330/265",
  SUBSTANTIVE_TESTING_APPROVAL: "ISA 500/530",
  FINALIZATION_APPROVAL: "ISA 700",
  GOING_CONCERN_APPROVAL: "ISA 570",
  SUBSEQUENT_EVENTS_CLEARANCE: "ISA 560",
  WRITTEN_REPRESENTATIONS_APPROVAL: "ISA 580",
  EQCR_CLEARANCE: "ISQM 2",
  REPORT_APPROVAL: "ISA 700/705/706",
  REPORT_ISSUANCE: "ISA 700",
  FILE_ASSEMBLY_APPROVAL: "ISA 230",
  ARCHIVAL_APPROVAL: "ISA 230",
};

const SIGN_OFF_DESCRIPTIONS: Record<SignOffTypeKey, string> = {
  ENGAGEMENT_ACCEPTANCE: "Partner approval of engagement acceptance decision",
  ENGAGEMENT_CONTINUANCE: "Partner approval of engagement continuance decision",
  INDEPENDENCE_CLEARANCE: "Independence and ethics clearance confirmation",
  ENGAGEMENT_LETTER_APPROVAL: "Partner approval of engagement letter terms",
  PLANNING_APPROVAL: "Partner approval of overall audit strategy and plan",
  RISK_ASSESSMENT_APPROVAL: "Partner approval of risk assessment results",
  MATERIALITY_APPROVAL: "Partner approval of materiality determination",
  AUDIT_STRATEGY_APPROVAL: "Partner approval of audit strategy document",
  EXECUTION_APPROVAL: "Manager/Partner approval to proceed with execution phase",
  CONTROLS_TESTING_APPROVAL: "Approval of internal controls testing conclusions",
  SUBSTANTIVE_TESTING_APPROVAL: "Approval of substantive testing procedures and conclusions",
  FINALIZATION_APPROVAL: "Partner approval of finalization phase completion",
  GOING_CONCERN_APPROVAL: "Partner approval of going concern assessment",
  SUBSEQUENT_EVENTS_CLEARANCE: "Partner clearance of subsequent events review",
  WRITTEN_REPRESENTATIONS_APPROVAL: "Partner approval of management representations",
  EQCR_CLEARANCE: "EQCR reviewer clearance (if applicable)",
  REPORT_APPROVAL: "Partner approval of audit report content and opinion",
  REPORT_ISSUANCE: "Partner authorization to issue audit report",
  FILE_ASSEMBLY_APPROVAL: "Partner approval of audit file assembly",
  ARCHIVAL_APPROVAL: "Partner approval for file archival",
};

const PHASE_SIGN_OFFS: Record<AuditPhase, SignOffTypeKey[]> = {
  ONBOARDING: ["ENGAGEMENT_ACCEPTANCE", "INDEPENDENCE_CLEARANCE", "ENGAGEMENT_LETTER_APPROVAL"],
  PRE_PLANNING: ["ENGAGEMENT_CONTINUANCE"],
  PLANNING: ["PLANNING_APPROVAL", "RISK_ASSESSMENT_APPROVAL", "MATERIALITY_APPROVAL", "AUDIT_STRATEGY_APPROVAL"],
  EXECUTION: ["EXECUTION_APPROVAL", "CONTROLS_TESTING_APPROVAL", "SUBSTANTIVE_TESTING_APPROVAL"],
  FINALIZATION: ["FINALIZATION_APPROVAL", "GOING_CONCERN_APPROVAL", "SUBSEQUENT_EVENTS_CLEARANCE", "WRITTEN_REPRESENTATIONS_APPROVAL"],
  REPORTING: ["REPORT_APPROVAL", "REPORT_ISSUANCE"],
  EQCR: ["EQCR_CLEARANCE"],
  INSPECTION: ["FILE_ASSEMBLY_APPROVAL", "ARCHIVAL_APPROVAL"],
};

router.get("/sign-off-authority", requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  res.json({
    userRole: user?.role,
    authorityMatrix: {
      PREPARED: { 
        allowedRoles: SIGN_OFF_AUTHORITY.PREPARED_ROLES,
        label: SIGN_OFF_AUTHORITY.getLabel("PREPARED"),
        canMark: SIGN_OFF_AUTHORITY.canMark(user?.role, "PREPARED").allowed,
      },
      REVIEWED: { 
        allowedRoles: SIGN_OFF_AUTHORITY.REVIEWED_ROLES,
        label: SIGN_OFF_AUTHORITY.getLabel("REVIEWED"),
        canMark: SIGN_OFF_AUTHORITY.canMark(user?.role, "REVIEWED").allowed,
      },
      APPROVED: { 
        allowedRoles: SIGN_OFF_AUTHORITY.APPROVED_ROLES,
        label: SIGN_OFF_AUTHORITY.getLabel("APPROVED"),
        canMark: SIGN_OFF_AUTHORITY.canMark(user?.role, "APPROVED").allowed,
      },
    },
    canUnlock: SIGN_OFF_AUTHORITY.canUnlock(user?.role),
  });
});

router.get("/engagements/:engagementId/sign-offs", requireAuth, async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    const signOffs = await (prisma as any).signOffRegister.findMany({
      where: { engagementId },
      include: {
        preparedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
        approvedBy: { select: { id: true, fullName: true, role: true } },
        rejectedBy: { select: { id: true, fullName: true, role: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    res.json(signOffs);
  } catch (error) {
    console.error("Error fetching sign-offs:", error);
    res.status(500).json({ error: "Failed to fetch sign-offs" });
  }
});

router.get("/engagements/:engagementId/sign-offs/dashboard", requireAuth, async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    const signOffs = await (prisma as any).signOffRegister.findMany({
      where: { engagementId },
      include: {
        approvedBy: { select: { id: true, fullName: true } },
      },
    });

    const summary = {
      total: signOffs.length,
      approved: signOffs.filter((s: any) => s.status === "APPROVED").length,
      pending: signOffs.filter((s: any) => s.status === "REQUIRED" || s.status === "PENDING_REVIEW").length,
      rejected: signOffs.filter((s: any) => s.status === "REJECTED").length,
      waived: signOffs.filter((s: any) => s.status === "WAIVED").length,
      byPhase: {} as Record<string, { total: number; approved: number; pending: number }>,
      blocking: signOffs.filter((s: any) => s.isBlocking && s.status !== "APPROVED" && s.status !== "WAIVED"),
    };

    for (const signOff of signOffs) {
      if (!summary.byPhase[signOff.phase]) {
        summary.byPhase[signOff.phase] = { total: 0, approved: 0, pending: 0 };
      }
      summary.byPhase[signOff.phase].total++;
      if (signOff.status === "APPROVED") {
        summary.byPhase[signOff.phase].approved++;
      } else if (signOff.status === "REQUIRED" || signOff.status === "PENDING_REVIEW") {
        summary.byPhase[signOff.phase].pending++;
      }
    }

    res.json(summary);
  } catch (error) {
    console.error("Error fetching sign-off dashboard:", error);
    res.status(500).json({ error: "Failed to fetch sign-off dashboard" });
  }
});

router.post("/engagements/:engagementId/sign-offs/initialize", requireAuth, requireRoles("PARTNER", "FIRM_ADMIN"), async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId },
      select: { currentPhase: true, eqcrRequired: true },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const existingSignOffs = await (prisma as any).signOffRegister.findMany({
      where: { engagementId },
      select: { signOffType: true },
    });
    const existingTypes = new Set(existingSignOffs.map((s: any) => s.signOffType));

    const signOffsToCreate: any[] = [];

    for (const [phase, types] of Object.entries(PHASE_SIGN_OFFS)) {
      for (const signOffType of types) {
        if (!existingTypes.has(signOffType)) {
          if (signOffType === "EQCR_CLEARANCE" && !engagement.eqcrRequired) {
            continue;
          }
          signOffsToCreate.push({
            engagementId,
            signOffType,
            phase: phase as AuditPhase,
            isaReference: SIGN_OFF_ISA_REFERENCES[signOffType],
            description: SIGN_OFF_DESCRIPTIONS[signOffType],
            status: "REQUIRED",
            requiredRole: signOffType.includes("EQCR") ? "EQCR" : "PARTNER",
            isBlocking: true,
            evidenceRequired: true,
          });
        }
      }
    }

    if (signOffsToCreate.length > 0) {
      await (prisma as any).signOffRegister.createMany({ data: signOffsToCreate });
    }

    const allSignOffs = await (prisma as any).signOffRegister.findMany({
      where: { engagementId },
      orderBy: { createdAt: "asc" },
    });

    res.json({ message: `Initialized ${signOffsToCreate.length} sign-offs`, signOffs: allSignOffs });
  } catch (error) {
    console.error("Error initializing sign-offs:", error);
    res.status(500).json({ error: "Failed to initialize sign-offs" });
  }
});

router.patch("/sign-offs/:id/submit", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!enforceSignOffAuthority(req, res, "PREPARED")) return;
    
    const { id } = req.params;
    const { comments } = req.body;
    const user = (req as any).user;
    const userId = user?.id;
    const ipAddress = req.headers["x-forwarded-for"]?.toString() || req.socket.remoteAddress || "";
    const deviceInfo = req.headers["user-agent"]?.toString().substring(0, 250) || "";

    const existingSignOff = await (prisma as any).signOffRegister.findUnique({
      where: { id },
    });
    
    if (existingSignOff?.reviewedAt) {
      return res.status(409).json({
        error: "Cannot modify Prepared sign-off after Review has been completed",
        lockedBy: "REVIEWED",
      });
    }

    const previousStatus = existingSignOff?.status || "REQUIRED";

    const signOff = await (prisma as any).signOffRegister.update({
      where: { id },
      data: {
        status: "PENDING_REVIEW",
        preparedById: userId,
        preparedAt: new Date(),
        preparerComments: comments,
      },
    });

    await prisma.auditTrail.create({
      data: {
        engagementId: signOff.engagementId,
        userId,
        userRole: user?.role,
        action: "SIGN_OFF_SUBMITTED",
        entityType: "SignOffRegister",
        entityId: signOff.id,
        ipAddress,
        deviceInfo,
        beforeValue: { status: previousStatus },
        afterValue: { signOffType: signOff.signOffType, status: "PENDING_REVIEW" },
      },
    });

    res.json(signOff);
  } catch (error) {
    console.error("Error submitting sign-off:", error);
    res.status(500).json({ error: "Failed to submit sign-off" });
  }
});

router.patch("/sign-offs/:id/review", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!enforceSignOffAuthority(req, res, "REVIEWED")) return;
    
    const { id } = req.params;
    const { comments } = req.body;
    const user = (req as any).user;
    const userId = user?.id;
    const ipAddress = req.headers["x-forwarded-for"]?.toString() || req.socket.remoteAddress || "";
    const deviceInfo = req.headers["user-agent"]?.toString().substring(0, 250) || "";

    const existingSignOff = await (prisma as any).signOffRegister.findUnique({
      where: { id },
    });
    
    if (existingSignOff?.approvedAt) {
      return res.status(409).json({
        error: "Cannot modify Reviewed sign-off after Approval has been completed",
        lockedBy: "APPROVED",
      });
    }

    const previousStatus = existingSignOff?.status || "PENDING_REVIEW";

    const signOff = await (prisma as any).signOffRegister.update({
      where: { id },
      data: {
        reviewedById: userId,
        reviewedAt: new Date(),
        reviewerComments: comments,
      },
    });

    await prisma.auditTrail.create({
      data: {
        engagementId: signOff.engagementId,
        userId,
        userRole: user?.role,
        action: "SIGN_OFF_REVIEWED",
        entityType: "SignOffRegister",
        entityId: signOff.id,
        ipAddress,
        deviceInfo,
        beforeValue: { status: previousStatus },
        afterValue: { signOffType: signOff.signOffType, status: "REVIEWED" },
      },
    });

    res.json(signOff);
  } catch (error) {
    console.error("Error reviewing sign-off:", error);
    res.status(500).json({ error: "Failed to review sign-off" });
  }
});

router.patch("/sign-offs/:id/approve", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!enforceSignOffAuthority(req, res, "APPROVED")) return;
    
    const { id } = req.params;
    const { comments, partnerPin } = req.body;
    const user = (req as any).user;
    const ipAddress = req.headers["x-forwarded-for"]?.toString() || req.socket.remoteAddress || "";
    const deviceInfo = req.headers["user-agent"]?.toString().substring(0, 250) || "";

    const existingSignOff = await (prisma as any).signOffRegister.findUnique({
      where: { id },
    });
    if (!existingSignOff) {
      return res.status(404).json({ error: "Sign-off not found" });
    }

    const previousStatus = existingSignOff.status;

    if (existingSignOff.requiredRole === "PARTNER" || user.role === "PARTNER") {
      if (!partnerPin) {
        return res.status(400).json({ error: "Partner PIN is required for this approval" });
      }
      const partnerUser = await prisma.user.findUnique({
        where: { id: user.id },
      });
      if ((partnerUser as any)?.partnerPin !== partnerPin) {
        return res.status(403).json({ error: "Invalid Partner PIN" });
      }
    }

    const signOff = await (prisma as any).signOffRegister.update({
      where: { id },
      data: {
        status: "APPROVED",
        approvedById: user.id,
        approvedAt: new Date(),
        approverComments: comments,
      },
    });

    await prisma.auditTrail.create({
      data: {
        engagementId: signOff.engagementId,
        userId: user.id,
        userRole: user.role,
        action: "SIGN_OFF_APPROVED",
        entityType: "SignOffRegister",
        entityId: signOff.id,
        ipAddress,
        deviceInfo,
        beforeValue: { status: previousStatus },
        afterValue: { signOffType: signOff.signOffType, status: "APPROVED" },
      },
    });

    res.json(signOff);
  } catch (error) {
    console.error("Error approving sign-off:", error);
    res.status(500).json({ error: "Failed to approve sign-off" });
  }
});

router.patch("/sign-offs/:id/reject", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!enforceSignOffAuthority(req, res, "REVIEWED")) return;
    
    const { id } = req.params;
    const { reason } = req.body;
    const user = (req as any).user;
    const userId = user?.id;
    const ipAddress = req.headers["x-forwarded-for"]?.toString() || req.socket.remoteAddress || "";
    const deviceInfo = req.headers["user-agent"]?.toString().substring(0, 250) || "";

    if (!reason) {
      return res.status(400).json({ error: "Rejection reason is required" });
    }

    const existingSignOff = await (prisma as any).signOffRegister.findUnique({
      where: { id },
    });
    const previousStatus = existingSignOff?.status || "PENDING_REVIEW";

    const signOff = await (prisma as any).signOffRegister.update({
      where: { id },
      data: {
        status: "REJECTED",
        rejectedById: userId,
        rejectedAt: new Date(),
        rejectionReason: reason,
      },
    });

    await prisma.auditTrail.create({
      data: {
        engagementId: signOff.engagementId,
        userId,
        userRole: user?.role,
        action: "SIGN_OFF_REJECTED",
        entityType: "SignOffRegister",
        entityId: signOff.id,
        reason,
        ipAddress,
        deviceInfo,
        beforeValue: { status: previousStatus },
        afterValue: { signOffType: signOff.signOffType, status: "REJECTED", reason },
      },
    });

    res.json(signOff);
  } catch (error) {
    console.error("Error rejecting sign-off:", error);
    res.status(500).json({ error: "Failed to reject sign-off" });
  }
});

router.patch("/sign-offs/:id/unlock", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const { reason, level } = req.body;
    const ipAddress = req.headers["x-forwarded-for"]?.toString() || req.socket.remoteAddress || "";
    const deviceInfo = req.headers["user-agent"]?.toString().substring(0, 250) || "";

    if (!canUnlockSignOff(user.role)) {
      return res.status(403).json({
        error: "Only Partner can unlock sign-offs",
        requiredRoles: ["PARTNER", "FIRM_ADMIN"],
        yourRole: user.role,
      });
    }

    if (!reason) {
      return res.status(400).json({ error: "Unlock reason is mandatory" });
    }

    const existingSignOff = await (prisma as any).signOffRegister.findUnique({
      where: { id },
    });
    const previousStatus = existingSignOff?.status || "APPROVED";

    const updateData: any = {};
    if (level === "PREPARED" || level === "ALL") {
      updateData.preparedById = null;
      updateData.preparedAt = null;
      updateData.preparerComments = null;
    }
    if (level === "REVIEWED" || level === "ALL") {
      updateData.reviewedById = null;
      updateData.reviewedAt = null;
      updateData.reviewerComments = null;
    }
    if (level === "APPROVED" || level === "ALL") {
      updateData.approvedById = null;
      updateData.approvedAt = null;
      updateData.approverComments = null;
      updateData.status = "REQUIRED";
    }

    const signOff = await (prisma as any).signOffRegister.update({
      where: { id },
      data: updateData,
    });

    await prisma.auditTrail.create({
      data: {
        engagementId: signOff.engagementId,
        userId: user.id,
        userRole: user.role,
        action: "SIGN_OFF_UNLOCKED",
        entityType: "SignOffRegister",
        entityId: signOff.id,
        reason,
        ipAddress,
        deviceInfo,
        beforeValue: { status: previousStatus },
        afterValue: { 
          signOffType: signOff.signOffType, 
          unlockedLevel: level, 
          reason,
          unlockedBy: user.fullName || user.email,
        },
      },
    });

    res.json(signOff);
  } catch (error) {
    console.error("Error unlocking sign-off:", error);
    res.status(500).json({ error: "Failed to unlock sign-off" });
  }
});

router.get("/engagements/:engagementId/phase-transition-check", requireAuth, async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { targetPhase } = req.query;

    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId },
      select: { currentPhase: true },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const requiredSignOffs = PHASE_SIGN_OFFS[engagement.currentPhase as AuditPhase] || [];
    const signOffs = await (prisma as any).signOffRegister.findMany({
      where: {
        engagementId,
        signOffType: { in: requiredSignOffs },
      },
    });

    const blockingSignOffs = signOffs.filter((s: any) => s.isBlocking && s.status !== "APPROVED" && s.status !== "WAIVED");

    const canTransition = blockingSignOffs.length === 0;

    res.json({
      canTransition,
      currentPhase: engagement.currentPhase,
      targetPhase,
      blockingSignOffs: blockingSignOffs.map((s: any) => ({
        type: s.signOffType,
        status: s.status,
        description: s.description,
        isaReference: s.isaReference,
      })),
      message: canTransition
        ? "All required sign-offs are complete. Phase transition is allowed."
        : `${blockingSignOffs.length} blocking sign-off(s) must be approved before phase transition.`,
    });
  } catch (error) {
    console.error("Error checking phase transition:", error);
    res.status(500).json({ error: "Failed to check phase transition" });
  }
});

router.get("/engagements/:engagementId/acceptance", requireAuth, async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    let acceptance = await (prisma as any).engagementAcceptance.findUnique({
      where: { engagementId },
      include: {
        managerReviewedBy: { select: { id: true, fullName: true } },
        partnerApprovedBy: { select: { id: true, fullName: true } },
      },
    });

    if (!acceptance) {
      acceptance = await (prisma as any).engagementAcceptance.create({
        data: { engagementId },
        include: {
          managerReviewedBy: { select: { id: true, fullName: true } },
          partnerApprovedBy: { select: { id: true, fullName: true } },
        },
      });
    }

    res.json(acceptance);
  } catch (error) {
    console.error("Error fetching acceptance:", error);
    res.status(500).json({ error: "Failed to fetch acceptance" });
  }
});

router.patch("/engagements/:engagementId/acceptance", requireAuth, async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    const updates = req.body;
    const userId = (req as any).user?.id;

    const acceptance = await (prisma as any).engagementAcceptance.upsert({
      where: { engagementId },
      create: { engagementId, ...updates },
      update: updates,
    });

    await prisma.auditTrail.create({
      data: {
        engagementId,
        userId,
        action: "ACCEPTANCE_UPDATED",
        entityType: "EngagementAcceptance",
        entityId: acceptance.id,
        afterValue: updates,
      },
    });

    res.json(acceptance);
  } catch (error) {
    console.error("Error updating acceptance:", error);
    res.status(500).json({ error: "Failed to update acceptance" });
  }
});

router.patch("/engagements/:engagementId/acceptance/manager-review", requireAuth, requireRoles("MANAGER", "PARTNER", "FIRM_ADMIN"), async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { comments } = req.body;
    const userId = (req as any).user?.id;

    const acceptance = await (prisma as any).engagementAcceptance.update({
      where: { engagementId },
      data: {
        managerReviewedById: userId,
        managerReviewedAt: new Date(),
        managerComments: comments,
      },
    });

    await prisma.auditTrail.create({
      data: {
        engagementId,
        userId,
        action: "ACCEPTANCE_MANAGER_REVIEWED",
        entityType: "EngagementAcceptance",
        entityId: acceptance.id,
        afterValue: { managerReviewedById: userId, comments },
      },
    });

    res.json(acceptance);
  } catch (error) {
    console.error("Error submitting manager review:", error);
    res.status(500).json({ error: "Failed to submit manager review" });
  }
});

router.patch("/engagements/:engagementId/acceptance/partner-approve", requireAuth, requireRoles("PARTNER", "FIRM_ADMIN"), async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { comments, decision, partnerPin } = req.body;
    const user = (req as any).user;

    if (!partnerPin) {
      return res.status(400).json({ error: "Partner PIN is required for engagement acceptance approval" });
    }
    const partnerUser = await prisma.user.findUnique({
      where: { id: user.id },
    });
    if ((partnerUser as any)?.partnerPin !== partnerPin) {
      return res.status(403).json({ error: "Invalid Partner PIN" });
    }

    const acceptance = await (prisma as any).engagementAcceptance.update({
      where: { engagementId },
      data: {
        partnerApprovedById: user.id,
        partnerApprovedAt: new Date(),
        partnerComments: comments,
        acceptanceDecision: decision,
      },
    });

    await prisma.engagement.update({
      where: { id: engagementId },
      data: {
        acceptanceDecision: decision,
        acceptanceApprovalById: user.id,
        acceptanceApprovalDate: new Date(),
      },
    });

    const signOff = await (prisma as any).signOffRegister.findFirst({
      where: { engagementId, signOffType: "ENGAGEMENT_ACCEPTANCE" },
    });

    if (signOff) {
      await (prisma as any).signOffRegister.update({
        where: { id: signOff.id },
        data: {
          status: decision === "ACCEPTED" || decision === "CONDITIONALLY_ACCEPTED" ? "APPROVED" : "REJECTED",
          approvedById: user.id,
          approvedAt: new Date(),
          approverComments: comments,
        },
      });
    }

    await prisma.auditTrail.create({
      data: {
        engagementId,
        userId: user.id,
        action: "ACCEPTANCE_PARTNER_APPROVED",
        entityType: "EngagementAcceptance",
        entityId: acceptance.id,
        afterValue: { decision, partnerApprovedById: user.id },
      },
    });

    res.json(acceptance);
  } catch (error) {
    console.error("Error submitting partner approval:", error);
    res.status(500).json({ error: "Failed to submit partner approval" });
  }
});

export default router;
