import { Router, Request, Response } from "express";
import { prisma } from "./db";
import { requireAuth } from "./auth";
import type { AuditPhase, UserRole } from "@prisma/client";

const router = Router();

const PREPARE_ROLES: UserRole[] = ["STAFF", "SENIOR"];
const REVIEW_ROLES: UserRole[] = ["MANAGER"];
const APPROVE_ROLES: UserRole[] = ["PARTNER"];

function hasRole(userRole: string, allowedRoles: UserRole[]): boolean {
  return allowedRoles.includes(userRole as UserRole) || userRole === "FIRM_ADMIN";
}

const VALID_PHASES: string[] = [
  "ONBOARDING", "PRE_PLANNING", "REQUISITION", "PLANNING",
  "EXECUTION", "FINALIZATION", "REPORTING", "EQCR", "INSPECTION"
];

function normalizePhase(phase: string): AuditPhase | null {
  const upper = phase.toUpperCase().replace(/-/g, "_");
  const mapping: Record<string, string> = {
    "PRE_PLANNING": "PRE_PLANNING",
    "PREPLANNING": "PRE_PLANNING",
    "DATA_INTAKE": "REQUISITION",
    "REQUISITION": "REQUISITION",
    "PLANNING": "PLANNING",
    "EXECUTION": "EXECUTION",
    "FINALIZATION": "FINALIZATION",
    "REPORTING": "REPORTING",
    "EQCR": "EQCR",
    "INSPECTION": "INSPECTION",
    "ONBOARDING": "ONBOARDING",
    "FS_HEADS": "EXECUTION",
    "EVIDENCE": "EXECUTION",
  };
  const mapped = mapping[upper] || (VALID_PHASES.includes(upper) ? upper : null);
  return mapped as AuditPhase | null;
}

router.get("/:engagementId/:phase/summary", requireAuth, async (req: Request, res: Response) => {
  try {
    const { engagementId, phase } = req.params;
    const auditPhase = normalizePhase(phase);
    if (!auditPhase) return res.json({ total: 0, prepared: 0, reviewed: 0, approved: 0 });

    const signoffs = await prisma.sectionSignOff.findMany({
      where: { engagementId, phase: auditPhase },
    });

    res.json({
      total: signoffs.length,
      prepared: signoffs.filter(s => !!s.preparedById).length,
      reviewed: signoffs.filter(s => !!s.reviewedById).length,
      approved: signoffs.filter(s => !!s.partnerApprovedById).length,
    });
  } catch (error) {
    console.error("Error fetching sign-off summary:", error);
    res.status(500).json({ error: "Failed to fetch sign-off summary" });
  }
});

router.get("/:engagementId/:phase/:section", requireAuth, async (req: Request, res: Response) => {
  try {
    const { engagementId, phase, section } = req.params;
    const auditPhase = normalizePhase(phase);
    if (!auditPhase) return res.status(200).json({ status: "DRAFT" });

    const signoff = await prisma.sectionSignOff.findUnique({
      where: {
        engagementId_section_phase: {
          engagementId,
          section: decodeURIComponent(section),
          phase: auditPhase,
        },
      },
      include: {
        preparedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
        partnerApprovedBy: { select: { id: true, fullName: true, role: true } },
      },
    });

    if (!signoff) return res.json({ status: "DRAFT" });

    let status: string = "DRAFT";
    if (signoff.partnerApprovedById) {
      status = signoff.isComplete ? "LOCKED" : "APPROVED";
    } else if (signoff.reviewedById) {
      status = "REVIEWED";
    } else if (signoff.preparedById) {
      status = "PREPARED";
    }

    res.json({
      id: signoff.id,
      status,
      preparedById: signoff.preparedById,
      preparedByName: signoff.preparedBy?.fullName,
      preparedDate: signoff.preparedDate?.toISOString(),
      reviewedById: signoff.reviewedById,
      reviewedByName: signoff.reviewedBy?.fullName,
      reviewedDate: signoff.reviewedDate?.toISOString(),
      approvedById: signoff.partnerApprovedById,
      approvedByName: signoff.partnerApprovedBy?.fullName,
      approvedDate: signoff.partnerApprovalDate?.toISOString(),
    });
  } catch (error) {
    console.error("Error fetching section sign-off:", error);
    res.status(500).json({ error: "Failed to fetch section sign-off" });
  }
});

router.post("/:engagementId/:phase/:section/prepare", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!hasRole(user.role, PREPARE_ROLES)) {
      return res.status(403).json({ error: "Only Staff/Senior/Team Lead can prepare" });
    }

    const { engagementId, phase, section } = req.params;
    const auditPhase = normalizePhase(phase);
    if (!auditPhase) return res.status(400).json({ error: "Invalid phase" });

    const decodedSection = decodeURIComponent(section);
    const ipAddress = req.headers["x-forwarded-for"]?.toString() || req.socket.remoteAddress || "";
    const deviceInfo = req.headers["user-agent"]?.toString().substring(0, 250) || "";

    const existing = await prisma.sectionSignOff.findUnique({
      where: { engagementId_section_phase: { engagementId, section: decodedSection, phase: auditPhase } },
    });
    const previousStatus = existing
      ? existing.partnerApprovedById ? "APPROVED" : existing.reviewedById ? "REVIEWED" : existing.preparedById ? "PREPARED" : "DRAFT"
      : "DRAFT";

    const signoff = await prisma.sectionSignOff.upsert({
      where: {
        engagementId_section_phase: {
          engagementId,
          section: decodedSection,
          phase: auditPhase,
        },
      },
      update: {
        preparedById: user.id,
        preparedDate: new Date(),
        reviewedById: null,
        reviewedDate: null,
        partnerApprovedById: null,
        partnerApprovalDate: null,
        isComplete: false,
      },
      create: {
        engagementId,
        section: decodedSection,
        phase: auditPhase,
        preparedById: user.id,
        preparedDate: new Date(),
      },
    });

    await prisma.auditTrail.create({
      data: {
        engagementId,
        userId: user.id,
        userRole: user.role,
        action: "SECTION_PREPARED",
        entityType: "SectionSignOff",
        entityId: signoff.id,
        module: decodedSection,
        screen: auditPhase,
        ipAddress,
        deviceInfo,
        beforeValue: { status: previousStatus },
        afterValue: { status: "PREPARED", section: decodedSection, phase: auditPhase },
      },
    });

    res.json({ success: true, status: "PREPARED" });
  } catch (error) {
    console.error("Error marking section as prepared:", error);
    res.status(500).json({ error: "Failed to mark as prepared" });
  }
});

router.post("/:engagementId/:phase/:section/review", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!hasRole(user.role, REVIEW_ROLES)) {
      return res.status(403).json({ error: "Only Manager can review" });
    }

    const { engagementId, phase, section } = req.params;
    const auditPhase = normalizePhase(phase);
    if (!auditPhase) return res.status(400).json({ error: "Invalid phase" });

    const decodedSection = decodeURIComponent(section);
    const ipAddress = req.headers["x-forwarded-for"]?.toString() || req.socket.remoteAddress || "";
    const deviceInfo = req.headers["user-agent"]?.toString().substring(0, 250) || "";

    const existing = await prisma.sectionSignOff.findUnique({
      where: {
        engagementId_section_phase: {
          engagementId,
          section: decodedSection,
          phase: auditPhase,
        },
      },
    });

    if (!existing?.preparedById) {
      return res.status(400).json({ error: "Section must be prepared before review" });
    }

    if (existing.preparedById === user.id) {
      return res.status(403).json({ error: "Segregation of Duties: Cannot review your own work" });
    }

    if (existing.partnerApprovedById) {
      return res.status(409).json({ error: "Cannot modify after approval" });
    }

    await prisma.sectionSignOff.update({
      where: { id: existing.id },
      data: {
        reviewedById: user.id,
        reviewedDate: new Date(),
      },
    });

    await prisma.auditTrail.create({
      data: {
        engagementId,
        userId: user.id,
        userRole: user.role,
        action: "SECTION_REVIEWED",
        entityType: "SectionSignOff",
        entityId: existing.id,
        module: decodedSection,
        screen: auditPhase,
        ipAddress,
        deviceInfo,
        beforeValue: { status: "PREPARED" },
        afterValue: { status: "REVIEWED", section: decodedSection, phase: auditPhase },
      },
    });

    res.json({ success: true, status: "REVIEWED" });
  } catch (error) {
    console.error("Error reviewing section:", error);
    res.status(500).json({ error: "Failed to review section" });
  }
});

router.post("/:engagementId/:phase/:section/approve", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!hasRole(user.role, APPROVE_ROLES)) {
      return res.status(403).json({ error: "Only Partner/Managing Partner can approve" });
    }

    const { engagementId, phase, section } = req.params;
    const auditPhase = normalizePhase(phase);
    if (!auditPhase) return res.status(400).json({ error: "Invalid phase" });

    const decodedSection = decodeURIComponent(section);
    const ipAddress = req.headers["x-forwarded-for"]?.toString() || req.socket.remoteAddress || "";
    const deviceInfo = req.headers["user-agent"]?.toString().substring(0, 250) || "";

    const existing = await prisma.sectionSignOff.findUnique({
      where: {
        engagementId_section_phase: {
          engagementId,
          section: decodedSection,
          phase: auditPhase,
        },
      },
    });

    if (!existing?.preparedById) {
      return res.status(400).json({ error: "Section must be prepared before approval" });
    }

    if (!existing.reviewedById) {
      return res.status(400).json({ error: "Section must be reviewed before approval" });
    }

    if (existing.preparedById === user.id) {
      return res.status(403).json({ error: "Segregation of Duties: Cannot approve your own work" });
    }

    await prisma.sectionSignOff.update({
      where: { id: existing.id },
      data: {
        partnerApprovedById: user.id,
        partnerApprovalDate: new Date(),
        isComplete: true,
      },
    });

    await prisma.auditTrail.create({
      data: {
        engagementId,
        userId: user.id,
        userRole: user.role,
        action: "SECTION_APPROVED",
        entityType: "SectionSignOff",
        entityId: existing.id,
        module: decodedSection,
        screen: auditPhase,
        ipAddress,
        deviceInfo,
        beforeValue: { status: "REVIEWED" },
        afterValue: { status: "APPROVED", section: decodedSection, phase: auditPhase, locked: true },
      },
    });

    res.json({ success: true, status: "APPROVED" });
  } catch (error) {
    console.error("Error approving section:", error);
    res.status(500).json({ error: "Failed to approve section" });
  }
});

router.post("/:engagementId/:phase/:section/return", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!hasRole(user.role, REVIEW_ROLES) && !hasRole(user.role, APPROVE_ROLES)) {
      return res.status(403).json({ error: "Only Manager/Partner can return" });
    }

    const { engagementId, phase, section } = req.params;
    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: "Reason is required for return" });
    }

    const auditPhase = normalizePhase(phase);
    if (!auditPhase) return res.status(400).json({ error: "Invalid phase" });

    const decodedSection = decodeURIComponent(section);
    const ipAddress = req.headers["x-forwarded-for"]?.toString() || req.socket.remoteAddress || "";
    const deviceInfo = req.headers["user-agent"]?.toString().substring(0, 250) || "";

    const existing = await prisma.sectionSignOff.findUnique({
      where: {
        engagementId_section_phase: {
          engagementId,
          section: decodedSection,
          phase: auditPhase,
        },
      },
    });

    if (!existing) {
      return res.status(404).json({ error: "Section sign-off not found" });
    }

    const previousStatus = existing.partnerApprovedById ? "APPROVED" : existing.reviewedById ? "REVIEWED" : existing.preparedById ? "PREPARED" : "DRAFT";

    await prisma.sectionSignOff.update({
      where: { id: existing.id },
      data: {
        reviewedById: null,
        reviewedDate: null,
        partnerApprovedById: null,
        partnerApprovalDate: null,
        isComplete: false,
      },
    });

    await prisma.auditTrail.create({
      data: {
        engagementId,
        userId: user.id,
        userRole: user.role,
        action: "SECTION_RETURNED",
        entityType: "SectionSignOff",
        entityId: existing.id,
        module: decodedSection,
        screen: auditPhase,
        reason,
        ipAddress,
        deviceInfo,
        beforeValue: { status: previousStatus },
        afterValue: { status: "PREPARED", section: decodedSection, phase: auditPhase, returnReason: reason },
      },
    });

    res.json({ success: true, status: "RETURNED" });
  } catch (error) {
    console.error("Error returning section:", error);
    res.status(500).json({ error: "Failed to return section" });
  }
});

router.post("/:engagementId/:phase/:section/lock", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!hasRole(user.role, APPROVE_ROLES)) {
      return res.status(403).json({ error: "Only Partner can lock" });
    }

    const { engagementId, phase, section } = req.params;
    const auditPhase = normalizePhase(phase);
    if (!auditPhase) return res.status(400).json({ error: "Invalid phase" });

    const decodedSection = decodeURIComponent(section);
    const ipAddress = req.headers["x-forwarded-for"]?.toString() || req.socket.remoteAddress || "";
    const deviceInfo = req.headers["user-agent"]?.toString().substring(0, 250) || "";

    const existing = await prisma.sectionSignOff.findUnique({
      where: {
        engagementId_section_phase: {
          engagementId,
          section: decodedSection,
          phase: auditPhase,
        },
      },
    });

    if (!existing?.partnerApprovedById) {
      return res.status(400).json({ error: "Section must be approved before locking" });
    }

    await prisma.sectionSignOff.update({
      where: { id: existing.id },
      data: { isComplete: true },
    });

    await prisma.auditTrail.create({
      data: {
        engagementId,
        userId: user.id,
        userRole: user.role,
        action: "SECTION_LOCKED",
        entityType: "SectionSignOff",
        entityId: existing.id,
        module: decodedSection,
        screen: auditPhase,
        ipAddress,
        deviceInfo,
        beforeValue: { status: "APPROVED" },
        afterValue: { status: "LOCKED", section: decodedSection, phase: auditPhase },
      },
    });

    res.json({ success: true, status: "LOCKED" });
  } catch (error) {
    console.error("Error locking section:", error);
    res.status(500).json({ error: "Failed to lock section" });
  }
});

router.post("/:engagementId/:phase/:section/complete", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { engagementId, phase, section } = req.params;
    const auditPhase = normalizePhase(phase);
    if (!auditPhase) return res.status(400).json({ error: "Invalid phase" });

    const decodedSection = decodeURIComponent(section);
    const ipAddress = req.headers["x-forwarded-for"]?.toString() || req.socket.remoteAddress || "";
    const deviceInfo = req.headers["user-agent"]?.toString().substring(0, 250) || "";

    const existing = await prisma.sectionSignOff.findUnique({
      where: {
        engagementId_section_phase: {
          engagementId,
          section: decodedSection,
          phase: auditPhase,
        },
      },
    });

    const currentStatus = existing
      ? existing.partnerApprovedById
        ? "APPROVED"
        : existing.reviewedById
          ? "REVIEWED"
          : existing.preparedById
            ? "PREPARED"
            : "DRAFT"
      : "DRAFT";

    if (currentStatus === "DRAFT" && hasRole(user.role, PREPARE_ROLES)) {
      const signoff = await prisma.sectionSignOff.upsert({
        where: {
          engagementId_section_phase: { engagementId, section: decodedSection, phase: auditPhase },
        },
        update: {
          preparedById: user.id,
          preparedDate: new Date(),
          reviewedById: null,
          reviewedDate: null,
          partnerApprovedById: null,
          partnerApprovalDate: null,
          isComplete: false,
        },
        create: {
          engagementId,
          section: decodedSection,
          phase: auditPhase,
          preparedById: user.id,
          preparedDate: new Date(),
        },
      });

      await prisma.auditTrail.create({
        data: {
          engagementId, userId: user.id, userRole: user.role,
          action: "SECTION_COMPLETE_PREPARED",
          entityType: "SectionSignOff", entityId: signoff.id,
          module: decodedSection, screen: auditPhase,
          ipAddress, deviceInfo,
          beforeValue: { status: "DRAFT" },
          afterValue: { status: "PREPARED", section: decodedSection, phase: auditPhase },
        },
      });

      return res.json({ success: true, status: "PREPARED", isLocked: false });
    }

    if (currentStatus === "PREPARED" && hasRole(user.role, REVIEW_ROLES)) {
      if (existing!.preparedById === user.id) {
        return res.status(403).json({ error: "Segregation of Duties: Cannot review your own work" });
      }

      await prisma.sectionSignOff.update({
        where: { id: existing!.id },
        data: { reviewedById: user.id, reviewedDate: new Date() },
      });

      await prisma.auditTrail.create({
        data: {
          engagementId, userId: user.id, userRole: user.role,
          action: "SECTION_COMPLETE_REVIEWED",
          entityType: "SectionSignOff", entityId: existing!.id,
          module: decodedSection, screen: auditPhase,
          ipAddress, deviceInfo,
          beforeValue: { status: "PREPARED" },
          afterValue: { status: "REVIEWED", section: decodedSection, phase: auditPhase },
        },
      });

      return res.json({ success: true, status: "REVIEWED", isLocked: false });
    }

    if (currentStatus === "REVIEWED" && hasRole(user.role, APPROVE_ROLES)) {
      if (existing!.preparedById === user.id) {
        return res.status(403).json({ error: "Segregation of Duties: Cannot approve your own work" });
      }

      if (auditPhase === "FINALIZATION") {
        const board = await prisma.finalizationBoard.findFirst({
          where: { engagementId },
          orderBy: { generatedAt: "desc" },
        });

        if (!board) {
          return res.status(409).json({
            error: "Finalization approval blocked",
            blockers: ["Finalization Control Board has not been generated. Generate the board first to assess readiness."],
            message: "Generate the Finalization Control Board before approving.",
          });
        }

        const blockers: string[] = [];
        if (board.riskLevel === "HIGH" && board.highSeverityIssues > 0) {
          blockers.push(`Risk rating is HIGH with ${board.highSeverityIssues} unresolved high severity issue(s)`);
        }
        if (board.pendingExecutionItems > 0) {
          blockers.push(`${board.pendingExecutionItems} execution procedure(s) still pending`);
        }
        if (board.missingEvidence > 0) {
          blockers.push(`${board.missingEvidence} procedure(s) missing evidence references (ISA 500)`);
        }
        if (blockers.length > 0) {
          return res.status(409).json({
            error: "Finalization approval blocked",
            blockers,
            message: "Resolve all blockers before approving finalization. Regenerate the Finalization Control Board for updated status.",
          });
        }
      }

      await prisma.sectionSignOff.update({
        where: { id: existing!.id },
        data: {
          partnerApprovedById: user.id,
          partnerApprovalDate: new Date(),
          isComplete: true,
        },
      });

      await prisma.auditTrail.create({
        data: {
          engagementId, userId: user.id, userRole: user.role,
          action: "SECTION_COMPLETE_APPROVED",
          entityType: "SectionSignOff", entityId: existing!.id,
          module: decodedSection, screen: auditPhase,
          ipAddress, deviceInfo,
          beforeValue: { status: "REVIEWED" },
          afterValue: { status: "APPROVED", section: decodedSection, phase: auditPhase, locked: true },
        },
      });

      return res.json({ success: true, status: "APPROVED", isLocked: true });
    }

    if (currentStatus === "APPROVED") {
      return res.status(409).json({ error: "Section is already approved and locked" });
    }

    return res.status(403).json({
      error: `Not authorized. Current status: ${currentStatus}. Your role: ${user.role}`,
    });
  } catch (error) {
    console.error("Error completing section:", error);
    res.status(500).json({ error: "Failed to complete section" });
  }
});

router.post("/:engagementId/:phase/:section/unlock", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== "FIRM_ADMIN") {
      return res.status(403).json({ error: "Only Admin can override unlock" });
    }

    const { engagementId, phase, section } = req.params;
    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: "Reason is required for admin unlock" });
    }

    const auditPhase = normalizePhase(phase);
    if (!auditPhase) return res.status(400).json({ error: "Invalid phase" });

    const decodedSection = decodeURIComponent(section);
    const ipAddress = req.headers["x-forwarded-for"]?.toString() || req.socket.remoteAddress || "";
    const deviceInfo = req.headers["user-agent"]?.toString().substring(0, 250) || "";

    const existing = await prisma.sectionSignOff.findUnique({
      where: {
        engagementId_section_phase: { engagementId, section: decodedSection, phase: auditPhase },
      },
    });

    if (!existing) {
      return res.status(404).json({ error: "Section sign-off not found" });
    }

    const previousStatus = existing.partnerApprovedById ? "APPROVED" : existing.reviewedById ? "REVIEWED" : existing.preparedById ? "PREPARED" : "DRAFT";

    await prisma.sectionSignOff.update({
      where: { id: existing.id },
      data: {
        preparedById: null,
        preparedDate: null,
        reviewedById: null,
        reviewedDate: null,
        partnerApprovedById: null,
        partnerApprovalDate: null,
        isComplete: false,
      },
    });

    await prisma.auditTrail.create({
      data: {
        engagementId, userId: user.id, userRole: user.role,
        action: "SECTION_ADMIN_UNLOCK",
        entityType: "SectionSignOff", entityId: existing.id,
        module: decodedSection, screen: auditPhase,
        reason,
        ipAddress, deviceInfo,
        beforeValue: { status: previousStatus },
        afterValue: { status: "DRAFT", section: decodedSection, phase: auditPhase, unlockReason: reason },
      },
    });

    res.json({ success: true, status: "DRAFT", isLocked: false });
  } catch (error) {
    console.error("Error unlocking section:", error);
    res.status(500).json({ error: "Failed to unlock section" });
  }
});

export default router;
