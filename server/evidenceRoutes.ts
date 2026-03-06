import { Router, Response } from "express";
import { prisma } from "./db";
import { z } from "zod";
import * as crypto from "crypto";

const router = Router();

interface AuthenticatedRequest {
  user?: { id: string; firmId: string; role: string };
  params: any;
  body: any;
  query: any;
  ip?: string;
  get: (header: string) => string | undefined;
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: Function) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

function requireMinRole(minRole: string) {
  const roleHierarchy = ["STAFF", "SENIOR", "MANAGER", "PARTNER", "EQCR", "FIRM_ADMIN"];
  return (req: AuthenticatedRequest, res: Response, next: Function) => {
    const userRoleIndex = roleHierarchy.indexOf(req.user?.role || "");
    const minRoleIndex = roleHierarchy.indexOf(minRole);
    if (userRoleIndex < minRoleIndex) {
      return res.status(403).json({ error: `Minimum role required: ${minRole}` });
    }
    next();
  };
}

async function validateEngagementAccess(engagementId: string, userId: string, firmId: string | undefined) {
  if (!firmId) return { valid: false, error: "User not associated with a firm" };
  const engagement = await prisma.engagement.findFirst({
    where: { id: engagementId, firmId },
  });
  if (!engagement) return { valid: false, error: "Engagement not found" };
  return { valid: true, engagement };
}

async function logAuditTrail(
  userId: string, action: string, entityType: string, entityId: string | null,
  beforeValue: any, afterValue: any, engagementId: string, justification: string,
  ipAddress?: string, userAgent?: string
) {
  await prisma.auditTrail.create({
    data: { userId, action, entityType, entityId, beforeValue, afterValue, engagementId, justification, ipAddress, userAgent },
  });
}

// Evidence Files
router.get("/:engagementId/files", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) {
      return res.status(404).json({ error: access.error });
    }

    const { phase, cycle, status } = req.query;
    const where: any = { engagementId: req.params.engagementId };
    if (phase) where.phase = phase;
    if (cycle) where.cycle = cycle;
    if (status) where.status = status;

    const files = await prisma.evidenceFile.findMany({
      where,
      include: {
        uploadedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(files);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch files", details: error.message });
  }
});

router.post("/:engagementId/files", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) {
      return res.status(404).json({ error: access.error });
    }

    const phaseProgress = await prisma.phaseProgress.findFirst({
      where: { engagementId: req.params.engagementId, phase: req.body.phase, status: "LOCKED" },
    });

    if (phaseProgress) {
      return res.status(403).json({ error: "Cannot upload files to a locked phase" });
    }

    const checksum = crypto.createHash("md5").update(req.body.fileName + Date.now()).digest("hex");

    const file = await prisma.evidenceFile.create({
      data: {
        engagementId: req.params.engagementId,
        phase: req.body.phase,
        fileReference: req.body.fileReference,
        fileName: req.body.fileName,
        fileType: req.body.fileType,
        fileSize: req.body.fileSize,
        filePath: req.body.filePath,
        checksum,
        cycle: req.body.cycle,
        riskIds: req.body.riskIds || [],
        assertions: req.body.assertions || [],
        procedureIds: req.body.procedureIds || [],
        description: req.body.description,
        tags: req.body.tags || [],
        uploadedById: req.user!.id,
        retentionDate: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000), // 7 years
      },
      include: {
        uploadedBy: { select: { id: true, fullName: true, role: true } },
      },
    });

    await logAuditTrail(
      req.user!.id, "EVIDENCE_UPLOADED", "evidence_file", file.id,
      null, { fileName: file.fileName, phase: file.phase }, req.params.engagementId,
      `Evidence file ${file.fileReference} uploaded`,
      req.ip, req.get("user-agent")
    );

    res.status(201).json(file);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to upload file", details: error.message });
  }
});

router.post("/:engagementId/files/:fileId/supersede", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) {
      return res.status(404).json({ error: access.error });
    }

    const existing = await prisma.evidenceFile.findUnique({ where: { id: req.params.fileId } });
    if (!existing) {
      return res.status(404).json({ error: "File not found" });
    }

    const checksum = crypto.createHash("md5").update(req.body.fileName + Date.now()).digest("hex");

    const [oldFile, newFile] = await prisma.$transaction([
      prisma.evidenceFile.update({
        where: { id: req.params.fileId },
        data: { status: "SUPERSEDED", supersededReason: req.body.reason },
      }),
      prisma.evidenceFile.create({
        data: {
          engagementId: req.params.engagementId,
          phase: existing.phase,
          fileReference: existing.fileReference,
          fileName: req.body.fileName,
          fileType: req.body.fileType,
          fileSize: req.body.fileSize,
          filePath: req.body.filePath,
          checksum,
          version: existing.version + 1,
          cycle: existing.cycle,
          riskIds: existing.riskIds,
          assertions: existing.assertions,
          procedureIds: existing.procedureIds,
          description: req.body.description || existing.description,
          tags: existing.tags,
          uploadedById: req.user!.id,
          retentionDate: existing.retentionDate,
        },
        include: {
          uploadedBy: { select: { id: true, fullName: true, role: true } },
        },
      }),
    ]);

    await logAuditTrail(
      req.user!.id, "EVIDENCE_SUPERSEDED", "evidence_file", newFile.id,
      { previousVersion: existing.version }, { newVersion: newFile.version }, req.params.engagementId,
      `Evidence file ${existing.fileReference} superseded: ${req.body.reason}`,
      req.ip, req.get("user-agent")
    );

    res.json(newFile);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to supersede file", details: error.message });
  }
});

router.post("/:engagementId/files/:fileId/void", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) {
      return res.status(404).json({ error: access.error });
    }

    if (!req.body.reason) {
      return res.status(400).json({ error: "Reason required to void a file" });
    }

    const file = await prisma.evidenceFile.update({
      where: { id: req.params.fileId },
      data: { status: "VOIDED", voidedReason: req.body.reason },
    });

    await logAuditTrail(
      req.user!.id, "EVIDENCE_VOIDED", "evidence_file", file.id,
      null, { voidedReason: req.body.reason }, req.params.engagementId,
      `Evidence file ${file.fileReference} voided: ${req.body.reason}`,
      req.ip, req.get("user-agent")
    );

    res.json(file);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to void file", details: error.message });
  }
});

router.post("/:engagementId/files/:fileId/review", requireAuth, requireMinRole("SENIOR"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) {
      return res.status(404).json({ error: access.error });
    }

    const file = await prisma.evidenceFile.update({
      where: { id: req.params.fileId },
      data: {
        reviewedById: req.user!.id,
        reviewedDate: new Date(),
        reviewerNotes: req.body.notes,
        sufficiencyRating: req.body.sufficiencyRating,
      },
    });

    res.json(file);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to review file", details: error.message });
  }
});

// Search
router.get("/:engagementId/files/search", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) {
      return res.status(404).json({ error: access.error });
    }

    const { q, tags, cycle, phase, riskId, assertion } = req.query;
    const where: any = { engagementId: req.params.engagementId, status: "ACTIVE" };

    if (q) {
      where.OR = [
        { fileName: { contains: q as string, mode: "insensitive" } },
        { fileReference: { contains: q as string, mode: "insensitive" } },
        { description: { contains: q as string, mode: "insensitive" } },
      ];
    }
    if (tags) where.tags = { hasSome: (tags as string).split(",") };
    if (cycle) where.cycle = cycle;
    if (phase) where.phase = phase;
    if (riskId) where.riskIds = { has: riskId };
    if (assertion) where.assertions = { has: assertion };

    const files = await prisma.evidenceFile.findMany({
      where,
      include: {
        uploadedBy: { select: { id: true, fullName: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(files);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to search files", details: error.message });
  }
});

// Audit File Assembly
router.get("/:engagementId/assembly", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) {
      return res.status(404).json({ error: access.error });
    }

    let assembly = await prisma.auditFileAssembly.findUnique({
      where: { engagementId: req.params.engagementId },
      include: {
        preparedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
        approvedBy: { select: { id: true, fullName: true, role: true } },
      },
    });

    if (!assembly) {
      const fileCount = await prisma.evidenceFile.count({
        where: { engagementId: req.params.engagementId, status: "ACTIVE" },
      });
      const reviewedCount = await prisma.evidenceFile.count({
        where: { engagementId: req.params.engagementId, status: "ACTIVE", reviewedById: { not: null } },
      });

      assembly = await prisma.auditFileAssembly.create({
        data: {
          engagementId: req.params.engagementId,
          totalFiles: fileCount,
          reviewedFiles: reviewedCount,
          assemblyDeadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days per ISA 230
        },
        include: {
          preparedBy: { select: { id: true, fullName: true, role: true } },
          reviewedBy: { select: { id: true, fullName: true, role: true } },
          approvedBy: { select: { id: true, fullName: true, role: true } },
        },
      });
    }

    res.json(assembly);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch assembly", details: error.message });
  }
});

router.post("/:engagementId/assembly/start", requireAuth, requireMinRole("SENIOR"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) {
      return res.status(404).json({ error: access.error });
    }

    const assembly = await prisma.auditFileAssembly.upsert({
      where: { engagementId: req.params.engagementId },
      update: {
        assemblyStatus: "in_progress",
        assemblyStartDate: new Date(),
        preparedById: req.user!.id,
      },
      create: {
        engagementId: req.params.engagementId,
        assemblyStatus: "in_progress",
        assemblyStartDate: new Date(),
        preparedById: req.user!.id,
        assemblyDeadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      },
    });

    await logAuditTrail(
      req.user!.id, "AUDIT_FILE_ASSEMBLY_STARTED", "audit_file_assembly", assembly.id,
      null, { assemblyStartDate: new Date() }, req.params.engagementId,
      "Audit file assembly started per ISA 230",
      req.ip, req.get("user-agent")
    );

    res.json(assembly);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to start assembly", details: error.message });
  }
});

router.post("/:engagementId/assembly/complete", requireAuth, requireMinRole("PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) {
      return res.status(404).json({ error: access.error });
    }

    const unreviewed = await prisma.evidenceFile.count({
      where: { engagementId: req.params.engagementId, status: "ACTIVE", reviewedById: null },
    });

    if (unreviewed > 0) {
      return res.status(400).json({ error: `${unreviewed} files have not been reviewed` });
    }

    const assembly = await prisma.auditFileAssembly.update({
      where: { engagementId: req.params.engagementId },
      data: {
        assemblyStatus: "completed",
        assemblyCompletedDate: new Date(),
        approvedById: req.user!.id,
        finalFileGenerated: true,
        finalFileGeneratedDate: new Date(),
      },
    });

    await prisma.evidenceFile.updateMany({
      where: { engagementId: req.params.engagementId, status: "ACTIVE" },
      data: { lockedWithPhase: true, lockedDate: new Date() },
    });

    await logAuditTrail(
      req.user!.id, "AUDIT_FILE_ASSEMBLY_COMPLETED", "audit_file_assembly", assembly.id,
      null, { assemblyCompletedDate: new Date() }, req.params.engagementId,
      "Audit file assembly completed and locked per ISA 230",
      req.ip, req.get("user-agent")
    );

    res.json(assembly);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to complete assembly", details: error.message });
  }
});

// Get all attachments for an engagement (TabAttachment + RequestAttachment)
router.get("/:engagementId/all-attachments", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) {
      return res.status(404).json({ error: access.error });
    }

    const { isPermanent } = req.query;

    // Fetch TabAttachments
    const tabAttachmentsWhere: any = { engagementId: req.params.engagementId };
    if (isPermanent === 'true') tabAttachmentsWhere.isPermanent = true;
    if (isPermanent === 'false') tabAttachmentsWhere.isPermanent = false;

    const tabAttachments = await prisma.tabAttachment.findMany({
      where: tabAttachmentsWhere,
      include: {
        uploadedBy: { select: { id: true, fullName: true, role: true } },
      },
      orderBy: { uploadedAt: "desc" },
    });

    // Fetch RequestAttachments via InformationRequest
    const requestAttachments = await prisma.requestAttachment.findMany({
      where: {
        request: { engagementId: req.params.engagementId },
        isActive: true,
        ...(isPermanent === 'true' ? { isPermanent: true } : {}),
        ...(isPermanent === 'false' ? { isPermanent: false } : {}),
      },
      include: {
        request: { select: { id: true, requestTitle: true, headOfAccounts: true, srNumber: true } },
        uploadedBy: { select: { id: true, fullName: true, role: true } },
        uploadedByContact: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { uploadedAt: "desc" },
    });

    // Combine and normalize the results
    const allAttachments = [
      ...tabAttachments.map(a => ({
        id: a.id,
        source: "TAB" as const,
        fileName: a.fileName,
        fileType: a.fileType,
        fileSize: a.fileSize,
        filePath: a.filePath,
        phase: a.phase,
        tabType: a.tabType,
        tabSection: a.tabSection,
        description: a.description,
        workpaperRef: a.workpaperRef,
        isPermanent: a.isPermanent,
        uploadedAt: a.uploadedAt,
        uploadedBy: a.uploadedBy,
        uploadedByContact: null as { id: string; name: string; email?: string } | null,
        requestInfo: null as { id: string; title: string; srNumber: number } | null,
      })),
      ...requestAttachments.map(a => ({
        id: a.id,
        source: "REQUEST" as const,
        fileName: a.fileName,
        fileType: a.fileType,
        fileSize: a.fileSize ? Number(a.fileSize) : null,
        filePath: a.storagePath,
        phase: "REQUISITION" as const,
        tabType: "requisition",
        tabSection: a.request?.headOfAccounts || null,
        description: a.uploadNotes,
        workpaperRef: null,
        isPermanent: a.isPermanent,
        uploadedAt: a.uploadedAt,
        uploadedBy: a.uploadedBy,
        uploadedByContact: a.uploadedByContact ? { 
          id: a.uploadedByContact.id, 
          name: `${a.uploadedByContact.firstName} ${a.uploadedByContact.lastName}`.trim(), 
          email: a.uploadedByContact.email 
        } : null,
        requestInfo: a.request ? { id: a.request.id, title: a.request.requestTitle, srNumber: a.request.srNumber } : null,
      })),
    ].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

    // Calculate stats
    const stats = {
      total: allAttachments.length,
      permanent: allAttachments.filter(a => a.isPermanent).length,
      yearly: allAttachments.filter(a => !a.isPermanent).length,
      documents: allAttachments.filter(a => ['pdf', 'doc', 'docx', 'xls', 'xlsx'].some(ext => a.fileType?.toLowerCase().includes(ext))).length,
      images: allAttachments.filter(a => ['jpg', 'jpeg', 'png', 'gif', 'svg'].some(ext => a.fileType?.toLowerCase().includes(ext))).length,
      totalSize: allAttachments.reduce((sum, a) => sum + (a.fileSize || 0), 0),
    };

    res.json({ attachments: allAttachments, stats });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch attachments", details: error.message });
  }
});

// Update attachment permanence status (TabAttachment)
router.patch("/:engagementId/tab-attachments/:attachmentId/permanence", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) {
      return res.status(404).json({ error: access.error });
    }

    const { isPermanent } = req.body;
    if (typeof isPermanent !== 'boolean') {
      return res.status(400).json({ error: "isPermanent must be a boolean" });
    }

    const attachment = await prisma.tabAttachment.update({
      where: { id: req.params.attachmentId },
      data: {
        isPermanent,
        permanentMarkedById: req.user!.id,
        permanentMarkedAt: new Date(),
      },
    });

    await logAuditTrail(
      req.user!.id, "ATTACHMENT_PERMANENCE_UPDATED", "tab_attachment", attachment.id,
      null, { isPermanent }, req.params.engagementId,
      `Attachment marked as ${isPermanent ? 'permanent' : 'yearly'}`,
      req.ip, req.get("user-agent")
    );

    res.json(attachment);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update attachment", details: error.message });
  }
});

// Update attachment permanence status (RequestAttachment)
router.patch("/:engagementId/request-attachments/:attachmentId/permanence", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) {
      return res.status(404).json({ error: access.error });
    }

    const { isPermanent } = req.body;
    if (typeof isPermanent !== 'boolean') {
      return res.status(400).json({ error: "isPermanent must be a boolean" });
    }

    const attachment = await prisma.requestAttachment.update({
      where: { id: req.params.attachmentId },
      data: {
        isPermanent,
        permanentMarkedById: req.user!.id,
        permanentMarkedAt: new Date(),
      },
    });

    await logAuditTrail(
      req.user!.id, "ATTACHMENT_PERMANENCE_UPDATED", "request_attachment", attachment.id,
      null, { isPermanent }, req.params.engagementId,
      `Attachment marked as ${isPermanent ? 'permanent' : 'yearly'}`,
      req.ip, req.get("user-agent")
    );

    res.json(attachment);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update attachment", details: error.message });
  }
});

// Get permanent attachments for a client (for client documents tab)
router.get("/client/:clientId/permanent-documents", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    // Verify client belongs to the firm
    const client = await prisma.client.findFirst({
      where: { id: req.params.clientId, firmId },
    });
    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    // Fetch all engagements for this client
    const engagements = await prisma.engagement.findMany({
      where: { clientId: req.params.clientId, firmId },
      select: { id: true, engagementCode: true, periodStart: true, periodEnd: true },
    });
    const engagementIds = engagements.map(e => e.id);

    // Fetch permanent TabAttachments
    const tabAttachments = await prisma.tabAttachment.findMany({
      where: {
        engagementId: { in: engagementIds },
        isPermanent: true,
      },
      include: {
        engagement: { select: { id: true, engagementCode: true, periodStart: true, periodEnd: true } },
        uploadedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { uploadedAt: "desc" },
    });

    // Fetch permanent RequestAttachments
    const requestAttachments = await prisma.requestAttachment.findMany({
      where: {
        request: { engagementId: { in: engagementIds } },
        isPermanent: true,
        isActive: true,
      },
      include: {
        request: {
          select: {
            id: true,
            requestTitle: true,
            headOfAccounts: true,
            engagement: { select: { id: true, engagementCode: true, periodStart: true, periodEnd: true } },
          },
        },
        uploadedBy: { select: { id: true, fullName: true } },
        uploadedByContact: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { uploadedAt: "desc" },
    });

    // Normalize and combine
    const permanentDocuments = [
      ...tabAttachments.map(a => ({
        id: a.id,
        source: "TAB" as const,
        fileName: a.fileName,
        fileType: a.fileType,
        fileSize: a.fileSize,
        filePath: a.filePath,
        description: a.description,
        tabType: a.tabType,
        uploadedAt: a.uploadedAt,
        uploadedBy: a.uploadedBy?.fullName || "Unknown",
        engagementCode: a.engagement?.engagementCode,
        engagementId: a.engagementId,
      })),
      ...requestAttachments.map(a => ({
        id: a.id,
        source: "REQUEST" as const,
        fileName: a.fileName,
        fileType: a.fileType,
        fileSize: a.fileSize ? Number(a.fileSize) : null,
        filePath: a.storagePath,
        description: a.uploadNotes,
        tabType: a.request?.headOfAccounts || "requisition",
        uploadedAt: a.uploadedAt,
        uploadedBy: a.uploadedBy?.fullName || (a.uploadedByContact ? `${a.uploadedByContact.firstName} ${a.uploadedByContact.lastName}`.trim() : "Client"),
        engagementCode: a.request?.engagement?.engagementCode,
        engagementId: a.request?.engagement?.id,
      })),
    ].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

    res.json(permanentDocuments);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch permanent documents", details: error.message });
  }
});

// Cross-Phase Links Summary - Get linked risks, tests, and misstatements
router.get("/:engagementId/cross-phase-links", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.id, req.user!.firmId);
    if (!access.valid) {
      return res.status(404).json({ error: access.error });
    }

    const engagementId = req.params.engagementId;

    // Get risks with evidence counts
    const risks = await prisma.riskAssessment.findMany({
      where: { engagementId },
      select: {
        id: true,
        accountOrClass: true,
        assertion: true,
        riskOfMaterialMisstatement: true,
        isSignificantRisk: true,
        isFraudRisk: true,
      },
    });

    // Get evidence files linked to each risk
    const riskEvidenceCounts = await prisma.evidenceFile.groupBy({
      by: ['riskIds'],
      where: { engagementId, status: 'ACTIVE', riskIds: { isEmpty: false } },
      _count: true,
    });

    const risksWithCounts = risks.map(risk => {
      const linkedCount = riskEvidenceCounts.filter(
        ec => (ec.riskIds as string[])?.includes(risk.id)
      ).reduce((sum, ec) => sum + ec._count, 0);
      return {
        ...risk,
        linkedEvidenceCount: linkedCount,
      };
    }).filter(r => r.linkedEvidenceCount > 0);

    // Get substantive tests with evidence links
    const testsWithEvidence = await prisma.substantiveTest.findMany({
      where: { engagementId },
      include: {
        evidenceFiles: {
          select: { id: true },
        },
      },
    });

    const tests = testsWithEvidence
      .filter(t => t.evidenceFiles.length > 0)
      .map(t => ({
        id: t.id,
        testCode: t.testReference,
        testName: t.testObjective,
        fsArea: t.fsArea,
        status: t.conclusion ? 'COMPLETED' : 'IN_PROGRESS',
        conclusion: t.conclusion,
        linkedEvidenceCount: t.evidenceFiles.length,
      }));

    // Get misstatements with evidence through their linked substantive tests
    const misstatementsWithTestEvidence = await prisma.misstatement.findMany({
      where: { 
        engagementId,
        substantiveTestId: { not: null },
      },
      select: {
        id: true,
        description: true,
        misstatementAmount: true,
        misstatementType: true,
        status: true,
        substantiveTest: {
          select: {
            id: true,
            evidenceFiles: { select: { id: true } },
          },
        },
      },
    });

    // Only include misstatements where the linked test has evidence
    const misstatementsWithCounts = misstatementsWithTestEvidence
      .filter(m => m.substantiveTest && m.substantiveTest.evidenceFiles.length > 0)
      .map(m => ({
        id: m.id,
        description: m.description,
        amount: Number(m.misstatementAmount) || 0,
        type: m.misstatementType,
        corrected: m.status === 'ADJUSTED',
        linkedEvidenceCount: m.substantiveTest?.evidenceFiles.length || 0,
      }));

    const totalLinkedEvidence = 
      risksWithCounts.reduce((sum, r) => sum + r.linkedEvidenceCount, 0) +
      tests.reduce((sum, t) => sum + t.linkedEvidenceCount, 0) +
      misstatementsWithCounts.reduce((sum, m) => sum + m.linkedEvidenceCount, 0);

    res.json({
      risks: risksWithCounts,
      tests,
      misstatements: misstatementsWithCounts,
      totalLinkedEvidence,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch cross-phase links", details: error.message });
  }
});

export default router;
