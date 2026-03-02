import { Router, Response, Request } from "express";
import { prisma } from "./db";
import { requireAuth, requireRoles, logAuditTrail, type AuthenticatedRequest } from "./auth";
import type { UserRole } from "@prisma/client";
import * as crypto from "crypto";

const router = Router();

const TAB_TYPES = [
  "DASHBOARD", "AUDIT_PROGRAM", "CONTROLS_TESTING", "JE_TESTING",
  "SUBSTANTIVE_PROCEDURES", "ANALYTICAL_REVIEW", "CONFIRMATIONS",
  "SUBSEQUENT_EVENTS", "GOING_CONCERN", "ADJUSTMENTS", "WORKPAPERS"
] as const;

const PHASE_PREFIXES: Record<string, string> = {
  ONBOARDING: "OB",
  PRE_PLANNING: "PP",
  PLANNING: "PL",
  EXECUTION: "EX",
  FINALIZATION: "FN",
  REPORTING: "RP",
  EQCR: "EQ",
  INSPECTION: "IN"
};

function generateWorkpaperRef(phase: string, section: string, sequence: number): string {
  const prefix = PHASE_PREFIXES[phase] || "XX";
  const sectionCode = section?.substring(0, 3).toUpperCase() || "GEN";
  return `${prefix}-${sectionCode}-${String(sequence).padStart(4, "0")}`;
}

function generateIndexReference(phase: string, tabType: string, sequence: number): string {
  const prefix = PHASE_PREFIXES[phase] || "XX";
  const tabCode = tabType.substring(0, 2).toUpperCase();
  return `${prefix}.${tabCode}.${String(sequence).padStart(3, "0")}`;
}

router.get("/engagements/:engagementId/workpapers", requireAuth, async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { phase, section, status } = req.query;
    
    const where: any = { engagementId };
    if (phase) where.phase = phase;
    if (section) where.section = section;
    if (status) where.status = status;
    
    const workpapers = await prisma.workpaperRegistry.findMany({
      where,
      include: {
        versions: { orderBy: { version: "desc" }, take: 1 },
        evidenceLinks: true,
        procedure: { select: { id: true, title: true, isaReferences: true } }
      },
      orderBy: [{ phase: "asc" }, { workpaperRef: "asc" }]
    });
    
    res.json(workpapers);
  } catch (error) {
    console.error("Error fetching workpapers:", error);
    res.status(500).json({ error: "Failed to fetch workpapers" });
  }
});

router.post("/engagements/:engagementId/workpapers", requireAuth, async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    const userId = (req as any).user?.id;
    const { title, description, phase, section, fsArea, procedureId, linkedRiskIds, linkedAssertions } = req.body;
    
    const count = await prisma.workpaperRegistry.count({
      where: { engagementId, phase }
    });
    
    const workpaperRef = generateWorkpaperRef(phase, section, count + 1);
    
    const workpaper = await prisma.workpaperRegistry.create({
      data: {
        engagementId,
        procedureId,
        workpaperRef,
        title,
        description,
        phase,
        section,
        fsArea,
        linkedRiskIds: linkedRiskIds || [],
        linkedAssertions: linkedAssertions || [],
        preparedById: userId,
        preparedAt: new Date()
      }
    });
    
    await prisma.workpaperVersion.create({
      data: {
        workpaperId: workpaper.id,
        version: 1,
        content: { title, description },
        changeDescription: "Initial creation",
        changedById: userId
      }
    });
    
    await prisma.auditTrail.create({
      data: {
        engagementId,
        userId,
        action: "WORKPAPER_CREATED",
        entityType: "WorkpaperRegistry",
        entityId: workpaper.id,
        afterValue: { workpaperRef, title, phase }
      }
    });
    
    res.status(201).json(workpaper);
  } catch (error) {
    console.error("Error creating workpaper:", error);
    res.status(500).json({ error: "Failed to create workpaper" });
  }
});

router.patch("/workpapers/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    const { title, description, conclusion, status, linkedRiskIds, linkedAssertions, linkedFsNotes } = req.body;
    
    const existing = await prisma.workpaperRegistry.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "Workpaper not found" });
    }
    if (existing.isLocked) {
      return res.status(403).json({ error: "Workpaper is locked and cannot be modified" });
    }
    
    const newVersion = existing.currentVersion + 1;
    
    const [workpaper] = await prisma.$transaction([
      prisma.workpaperRegistry.update({
        where: { id },
        data: {
          title: title ?? existing.title,
          description: description ?? existing.description,
          conclusion: conclusion ?? existing.conclusion,
          status: status ?? existing.status,
          linkedRiskIds: linkedRiskIds ?? existing.linkedRiskIds,
          linkedAssertions: linkedAssertions ?? existing.linkedAssertions,
          linkedFsNotes: linkedFsNotes ?? existing.linkedFsNotes,
          currentVersion: newVersion
        }
      }),
      prisma.workpaperVersion.create({
        data: {
          workpaperId: id,
          version: newVersion,
          content: { title, description, conclusion },
          changeDescription: req.body.changeDescription || "Updated workpaper",
          changedById: userId
        }
      })
    ]);
    
    await prisma.auditTrail.create({
      data: {
        engagementId: existing.engagementId,
        userId,
        action: "WORKPAPER_UPDATED",
        entityType: "WorkpaperRegistry",
        entityId: id,
        beforeValue: { version: existing.currentVersion },
        afterValue: { version: newVersion, status }
      }
    });
    
    res.json(workpaper);
  } catch (error) {
    console.error("Error updating workpaper:", error);
    res.status(500).json({ error: "Failed to update workpaper" });
  }
});

router.post("/workpapers/:id/review", requireAuth, requireRoles("SENIOR", "MANAGER", "PARTNER", "ADMIN"), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    
    const workpaper = await prisma.workpaperRegistry.update({
      where: { id },
      data: {
        status: "REVIEWED",
        reviewedById: userId,
        reviewedAt: new Date()
      }
    });
    
    await prisma.auditTrail.create({
      data: {
        engagementId: workpaper.engagementId,
        userId,
        action: "WORKPAPER_REVIEWED",
        entityType: "WorkpaperRegistry",
        entityId: id,
        afterValue: { reviewedAt: new Date() }
      }
    });
    
    res.json(workpaper);
  } catch (error) {
    console.error("Error reviewing workpaper:", error);
    res.status(500).json({ error: "Failed to review workpaper" });
  }
});

router.post("/workpapers/:id/approve", requireAuth, requireRoles("PARTNER", "ADMIN"), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    
    const workpaper = await prisma.workpaperRegistry.update({
      where: { id },
      data: {
        status: "APPROVED",
        approvedById: userId,
        approvedAt: new Date()
      }
    });
    
    await prisma.auditTrail.create({
      data: {
        engagementId: workpaper.engagementId,
        userId,
        action: "WORKPAPER_APPROVED",
        entityType: "WorkpaperRegistry",
        entityId: id,
        afterValue: { approvedAt: new Date() }
      }
    });
    
    res.json(workpaper);
  } catch (error) {
    console.error("Error approving workpaper:", error);
    res.status(500).json({ error: "Failed to approve workpaper" });
  }
});

router.get("/workpapers/:id/versions", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const versions = await prisma.workpaperVersion.findMany({
      where: { workpaperId: id },
      orderBy: { version: "desc" }
    });
    
    res.json(versions);
  } catch (error) {
    console.error("Error fetching versions:", error);
    res.status(500).json({ error: "Failed to fetch versions" });
  }
});

router.post("/workpapers/:id/evidence-link", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { evidenceFileId, crossReference, description } = req.body;
    
    const link = await prisma.workpaperEvidenceLink.create({
      data: {
        workpaperId: id,
        evidenceFileId,
        crossReference,
        description
      }
    });
    
    res.status(201).json(link);
  } catch (error) {
    console.error("Error creating evidence link:", error);
    res.status(500).json({ error: "Failed to create evidence link" });
  }
});

router.get("/engagements/:engagementId/tab-attachments", requireAuth, async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { tabType, phase, entityType, entityId } = req.query;
    
    const where: any = { engagementId };
    if (tabType) where.tabType = tabType;
    if (phase) where.phase = phase;
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    
    const attachments = await (prisma as any).tabAttachment.findMany({
      where,
      include: {
        uploadedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } }
      },
      orderBy: { createdAt: "desc" }
    });
    
    res.json(attachments);
  } catch (error) {
    console.error("Error fetching tab attachments:", error);
    res.status(500).json({ error: "Failed to fetch attachments" });
  }
});

router.post("/engagements/:engagementId/tab-attachments", requireAuth, async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    const userId = (req as any).user?.id;
    const { 
      tabType, tabSection, entityType, entityId, 
      fileName, fileType, fileSize, filePath, 
      description, tags, phase, isaReference 
    } = req.body;
    
    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId },
      select: { onboardingLocked: true, planningLocked: true, executionLocked: true, finalizationLocked: true }
    });
    const phaseProgress = await prisma.phaseProgress.findFirst({
      where: { engagementId, phase }
    });
    const phaseLockMap: Record<string, boolean> = {
      ONBOARDING: engagement?.onboardingLocked || false,
      PRE_PLANNING: engagement?.onboardingLocked || false,
      PLANNING: engagement?.planningLocked || false,
      EXECUTION: engagement?.executionLocked || false,
      FINALIZATION: engagement?.finalizationLocked || false,
      REPORTING: engagement?.finalizationLocked || false,
      EQCR: engagement?.finalizationLocked || false,
      INSPECTION: engagement?.finalizationLocked || false
    };
    if (phaseLockMap[phase] || phaseProgress?.status === "LOCKED") {
      return res.status(403).json({ error: "Cannot upload attachments to a locked phase" });
    }
    
    const count = await (prisma as any).tabAttachment.count({
      where: { engagementId, tabType, phase }
    });
    
    const indexReference = generateIndexReference(phase, tabType, count + 1);
    const checksum = crypto.createHash("md5").update(fileName + Date.now()).digest("hex");
    
    const attachment = await (prisma as any).tabAttachment.create({
      data: {
        engagementId,
        tabType,
        tabSection,
        entityType,
        entityId,
        fileName,
        fileType,
        fileSize,
        filePath,
        checksum,
        indexReference,
        description,
        tags: tags || [],
        phase,
        isaReference: isaReference || "ISA 230",
        uploadedById: userId
      },
      include: {
        uploadedBy: { select: { id: true, fullName: true, role: true } }
      }
    });
    
    await prisma.auditTrail.create({
      data: {
        engagementId,
        userId,
        action: "TAB_ATTACHMENT_UPLOADED",
        entityType: "TabAttachment",
        entityId: attachment.id,
        afterValue: { fileName, tabType, indexReference, phase }
      }
    });
    
    res.status(201).json(attachment);
  } catch (error) {
    console.error("Error creating tab attachment:", error);
    res.status(500).json({ error: "Failed to create attachment" });
  }
});

router.post("/tab-attachments/:id/review", requireAuth, requireRoles("SENIOR", "MANAGER", "PARTNER", "ADMIN"), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    const { notes } = req.body;
    
    const attachment = await (prisma as any).tabAttachment.update({
      where: { id },
      data: {
        reviewedById: userId,
        reviewedAt: new Date(),
        reviewerNotes: notes
      }
    });
    
    await prisma.auditTrail.create({
      data: {
        engagementId: attachment.engagementId,
        userId,
        action: "TAB_ATTACHMENT_REVIEWED",
        entityType: "TabAttachment",
        entityId: id,
        afterValue: { reviewedAt: new Date() }
      }
    });
    
    res.json(attachment);
  } catch (error) {
    console.error("Error reviewing attachment:", error);
    res.status(500).json({ error: "Failed to review attachment" });
  }
});

router.post("/tab-attachments/:id/supersede", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    const { fileName, fileType, fileSize, filePath, reason } = req.body;
    
    const existing = await (prisma as any).tabAttachment.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "Attachment not found" });
    }
    if (existing.isLocked) {
      return res.status(403).json({ error: "Cannot supersede a locked attachment" });
    }
    
    const checksum = crypto.createHash("md5").update(fileName + Date.now()).digest("hex");
    
    const newAttachment = await prisma.$transaction(async (tx: any) => {
      const created = await tx.tabAttachment.create({
        data: {
          engagementId: existing.engagementId,
          tabType: existing.tabType,
          tabSection: existing.tabSection,
          entityType: existing.entityType,
          entityId: existing.entityId,
          fileName,
          fileType,
          fileSize,
          filePath,
          checksum,
          indexReference: existing.indexReference,
          description: existing.description,
          tags: existing.tags,
          phase: existing.phase,
          isaReference: existing.isaReference,
          version: existing.version + 1,
          uploadedById: userId
        }
      });
      
      await tx.tabAttachment.update({
        where: { id },
        data: { 
          supersededById: created.id,
          supersededReason: reason
        }
      });
      
      return created;
    });
    
    await prisma.auditTrail.create({
      data: {
        engagementId: existing.engagementId,
        userId,
        action: "TAB_ATTACHMENT_SUPERSEDED",
        entityType: "TabAttachment",
        entityId: newAttachment.id,
        beforeValue: { previousId: id, version: existing.version },
        afterValue: { newVersion: existing.version + 1, reason }
      }
    });
    
    res.status(201).json(newAttachment);
  } catch (error) {
    console.error("Error superseding attachment:", error);
    res.status(500).json({ error: "Failed to supersede attachment" });
  }
});

router.get("/engagements/:engagementId/workpaper-index", requireAuth, async (req: Request, res: Response) => {
  try {
    const { engagementId } = req.params;
    
    const [workpapers, tabAttachments, evidenceFiles] = await Promise.all([
      prisma.workpaperRegistry.findMany({
        where: { engagementId },
        select: {
          id: true, workpaperRef: true, title: true, phase: true, section: true,
          status: true, preparedAt: true, reviewedAt: true, approvedAt: true, currentVersion: true
        },
        orderBy: [{ phase: "asc" }, { workpaperRef: "asc" }]
      }),
      (prisma as any).tabAttachment.findMany({
        where: { engagementId },
        select: {
          id: true, indexReference: true, fileName: true, tabType: true, phase: true,
          version: true, uploadedAt: true, reviewedAt: true
        },
        orderBy: [{ phase: "asc" }, { indexReference: "asc" }]
      }),
      prisma.evidenceFile.findMany({
        where: { engagementId, status: "ACTIVE" },
        select: {
          id: true, fileReference: true, fileName: true, phase: true, cycle: true,
          version: true, uploadedDate: true, reviewedDate: true
        },
        orderBy: [{ phase: "asc" }, { fileReference: "asc" }]
      })
    ]);
    
    const index = {
      workpapers: workpapers.map(wp => ({
        ...wp,
        type: "WORKPAPER",
        reference: wp.workpaperRef
      })),
      tabAttachments: tabAttachments.map((ta: any) => ({
        ...ta,
        type: "TAB_ATTACHMENT",
        reference: ta.indexReference
      })),
      evidenceFiles: evidenceFiles.map(ef => ({
        ...ef,
        type: "EVIDENCE_FILE",
        reference: ef.fileReference
      })),
      summary: {
        totalWorkpapers: workpapers.length,
        totalTabAttachments: tabAttachments.length,
        totalEvidenceFiles: evidenceFiles.length,
        byPhase: {} as Record<string, { workpapers: number; attachments: number; evidence: number }>
      }
    };
    
    const phases = ["ONBOARDING", "PRE_PLANNING", "PLANNING", "EXECUTION", "FINALIZATION", "REPORTING", "EQCR", "INSPECTION"];
    phases.forEach(phase => {
      index.summary.byPhase[phase] = {
        workpapers: workpapers.filter(w => w.phase === phase).length,
        attachments: tabAttachments.filter((t: any) => t.phase === phase).length,
        evidence: evidenceFiles.filter(e => e.phase === phase).length
      };
    });
    
    res.json(index);
  } catch (error) {
    console.error("Error generating workpaper index:", error);
    res.status(500).json({ error: "Failed to generate workpaper index" });
  }
});

export default router;
