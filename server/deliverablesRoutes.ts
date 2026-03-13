import { Router, Response } from "express";
import { prisma } from "./db";
import { requireAuth, requireMinRole, logAuditTrail, type AuthenticatedRequest } from "./auth";
import { computePreDraftBlockers, computePreReportBlockers } from "./services/preReportBlockerService";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import { nanoid } from "nanoid";

const router = Router();

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "deliverables");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const uniqueName = `${nanoid()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only PDF, Word, and Excel files are allowed."));
    }
  }
});

const deliverableSchema = z.object({
  deliverableType: z.enum(["AUDIT_REPORT", "MANAGEMENT_LETTER", "ENGAGEMENT_SUMMARY", "TIME_SUMMARY", "OTHER"]),
  customTypeName: z.string().optional(),
  opinionType: z.enum(["UNMODIFIED", "QUALIFIED", "ADVERSE", "DISCLAIMER", "NOT_APPLICABLE"]).optional(),
  remarks: z.string().optional(),
  deliveredDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  status: z.enum(["DRAFT", "FINAL", "ISSUED"]).optional()
});

async function verifyEngagementAccess(engagementId: string, firmId: string | null): Promise<{ engagement: any; error?: string }> {
  if (!firmId) {
    return { engagement: null, error: "User not associated with a firm" };
  }
  
  const engagement = await prisma.engagement.findFirst({
    where: { 
      id: engagementId,
      firmId: firmId
    }
  });
  
  if (!engagement) {
    return { engagement: null, error: "Engagement not found or access denied" };
  }
  
  return { engagement };
}

async function verifyDeliverableAccess(deliverableId: string, firmId: string | null): Promise<{ deliverable: any; error?: string }> {
  if (!firmId) {
    return { deliverable: null, error: "User not associated with a firm" };
  }
  
  const deliverable = await prisma.deliverable.findFirst({
    where: { 
      id: deliverableId,
      engagement: {
        firmId: firmId
      }
    },
    include: {
      engagement: true
    }
  });
  
  if (!deliverable) {
    return { deliverable: null, error: "Deliverable not found or access denied" };
  }
  
  return { deliverable };
}

router.get("/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;
    
    const { engagement, error } = await verifyEngagementAccess(engagementId, firmId);
    if (error) {
      return res.status(403).json({ error });
    }
    
    const deliverables = await prisma.deliverable.findMany({
      where: { engagementId },
      include: {
        preparedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
        approvedBy: { select: { id: true, fullName: true, role: true } },
        issuedBy: { select: { id: true, fullName: true, role: true } },
        files: {
          include: {
            uploadedBy: { select: { id: true, fullName: true } }
          },
          orderBy: { version: "desc" }
        }
      },
      orderBy: { createdAt: "desc" }
    });
    
    res.json(deliverables);
  } catch (error) {
    console.error("Error fetching deliverables:", error);
    res.status(500).json({ error: "Failed to fetch deliverables" });
  }
});

router.post("/:engagementId", requireAuth, requireMinRole("SENIOR"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const data = deliverableSchema.parse(req.body);
    const firmId = req.user!.firmId;
    
    const { engagement, error } = await verifyEngagementAccess(engagementId, firmId);
    if (error) {
      return res.status(403).json({ error });
    }
    
    const deliverable = await prisma.deliverable.create({
      data: {
        engagementId,
        deliverableType: data.deliverableType,
        customTypeName: data.customTypeName,
        opinionType: data.opinionType,
        remarks: data.remarks,
        deliveredDate: data.deliveredDate,
        status: "DRAFT",
        preparedById: req.user!.id,
        preparedAt: new Date()
      },
      include: {
        preparedBy: { select: { id: true, fullName: true, role: true } },
        files: true
      }
    });
    
    logAuditTrail(
      req.user!.id, "DELIVERABLE_CREATED", "deliverable", deliverable.id,
      null, { type: data.deliverableType }, engagementId,
      `Created deliverable: ${data.deliverableType}`, req.ip, req.get("user-agent")
    ).catch(err => console.error("Audit trail error:", err));
    
    res.json(deliverable);
  } catch (error) {
    console.error("Error creating deliverable:", error);
    res.status(500).json({ error: "Failed to create deliverable" });
  }
});

router.put("/:id", requireAuth, requireMinRole("SENIOR"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = deliverableSchema.partial().parse(req.body);
    const firmId = req.user!.firmId;
    
    const { deliverable: existing, error } = await verifyDeliverableAccess(id, firmId);
    if (error) {
      return res.status(403).json({ error });
    }
    
    if (existing.status === "FINAL" || existing.status === "ISSUED") {
      return res.status(400).json({ error: "Cannot modify a finalized or issued deliverable" });
    }
    
    if (data.status && data.status !== "DRAFT") {
      return res.status(400).json({ error: "Status can only be changed through review/approve/issue workflow" });
    }
    
    const deliverable = await prisma.deliverable.update({
      where: { id },
      data: {
        deliverableType: data.deliverableType,
        customTypeName: data.customTypeName,
        opinionType: data.opinionType,
        remarks: data.remarks,
        deliveredDate: data.deliveredDate,
        updatedAt: new Date()
      },
      include: {
        preparedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
        approvedBy: { select: { id: true, fullName: true, role: true } },
        files: { where: { isCurrentVersion: true } }
      }
    });
    
    logAuditTrail(
      req.user!.id, "DELIVERABLE_UPDATED", "deliverable", id,
      null, { changes: data }, existing.engagementId,
      `Updated deliverable: ${deliverable.deliverableType}`, req.ip, req.get("user-agent")
    ).catch(err => console.error("Audit trail error:", err));
    
    res.json(deliverable);
  } catch (error) {
    console.error("Error updating deliverable:", error);
    res.status(500).json({ error: "Failed to update deliverable" });
  }
});

router.post("/:id/review", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const firmId = req.user!.firmId;
    
    const { deliverable: existing, error } = await verifyDeliverableAccess(id, firmId);
    if (error) {
      return res.status(403).json({ error });
    }
    
    if (existing.status !== "DRAFT") {
      return res.status(400).json({ error: "Can only review deliverables in DRAFT status" });
    }
    
    const deliverable = await prisma.deliverable.update({
      where: { id },
      data: {
        reviewedById: req.user!.id,
        reviewedAt: new Date()
      }
    });
    
    logAuditTrail(
      req.user!.id, "DELIVERABLE_REVIEWED", "deliverable", id,
      null, { reviewedById: req.user!.id }, deliverable.engagementId,
      `Reviewed deliverable: ${deliverable.deliverableType}`, req.ip, req.get("user-agent")
    ).catch(err => console.error("Audit trail error:", err));
    
    res.json(deliverable);
  } catch (error) {
    console.error("Error reviewing deliverable:", error);
    res.status(500).json({ error: "Failed to review deliverable" });
  }
});

router.post("/:id/approve", requireAuth, requireMinRole("PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const firmId = req.user!.firmId;
    
    const { deliverable: existing, error } = await verifyDeliverableAccess(id, firmId);
    if (error) {
      return res.status(403).json({ error });
    }
    
    if (existing.status !== "DRAFT") {
      return res.status(400).json({ error: "Can only approve deliverables in DRAFT status" });
    }
    
    if (!existing.reviewedById) {
      return res.status(400).json({ error: "Deliverable must be reviewed before approval" });
    }
    
    const deliverable = await prisma.deliverable.update({
      where: { id },
      data: {
        approvedById: req.user!.id,
        approvedAt: new Date(),
        status: "FINAL"
      }
    });
    
    logAuditTrail(
      req.user!.id, "DELIVERABLE_APPROVED", "deliverable", id,
      null, { approvedById: req.user!.id }, deliverable.engagementId,
      `Approved deliverable: ${deliverable.deliverableType}`, req.ip, req.get("user-agent")
    ).catch(err => console.error("Audit trail error:", err));
    
    res.json(deliverable);
  } catch (error) {
    console.error("Error approving deliverable:", error);
    res.status(500).json({ error: "Failed to approve deliverable" });
  }
});

router.post("/:id/issue", requireAuth, requireMinRole("PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const firmId = req.user!.firmId;
    
    const { deliverable: existing, error } = await verifyDeliverableAccess(id, firmId);
    if (error) {
      return res.status(403).json({ error });
    }
    
    if (existing.status !== "FINAL") {
      return res.status(400).json({ error: "Deliverable must be in FINAL status to issue" });
    }
    
    if (!existing.deliveredDate) {
      return res.status(400).json({ error: "Delivered date is required to issue" });
    }
    
    if (existing.deliverableType === "AUDIT_REPORT" && !existing.opinionType) {
      return res.status(400).json({ error: "Opinion type is required for Audit Report" });
    }

    if (existing.deliverableType === "AUDIT_REPORT") {
      const releaseCheck = await computePreReportBlockers(existing.engagementId);
      if (!releaseCheck.readyForRelease) {
        return res.status(400).json({ error: "Pre-report blockers exist", blockers: releaseCheck.issues.map(i => i.message) });
      }
    } else {
      const draftCheck = await computePreDraftBlockers(existing.engagementId);
      if (!draftCheck.readyForDraft) {
        return res.status(400).json({ error: "Completion-phase blockers exist", blockers: draftCheck.issues.map(i => i.message) });
      }
    }
    
    const deliverable = await prisma.deliverable.update({
      where: { id },
      data: {
        issuedById: req.user!.id,
        issuedAt: new Date(),
        status: "ISSUED"
      }
    });
    
    logAuditTrail(
      req.user!.id, "DELIVERABLE_ISSUED", "deliverable", id,
      null, { opinionType: deliverable.opinionType }, deliverable.engagementId,
      `Issued deliverable: ${deliverable.deliverableType}`, req.ip, req.get("user-agent")
    ).catch(err => console.error("Audit trail error:", err));
    
    res.json(deliverable);
  } catch (error) {
    console.error("Error issuing deliverable:", error);
    res.status(500).json({ error: "Failed to issue deliverable" });
  }
});

router.post("/:id/upload", requireAuth, requireMinRole("SENIOR"), upload.single("file"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const file = req.file;
    const firmId = req.user!.firmId;
    
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    
    const { deliverable, error } = await verifyDeliverableAccess(id, firmId);
    if (error) {
      fs.unlinkSync(file.path);
      return res.status(403).json({ error });
    }
    
    if (deliverable.status === "FINAL" || deliverable.status === "ISSUED") {
      fs.unlinkSync(file.path);
      return res.status(400).json({ error: "Cannot upload files to a finalized or issued deliverable" });
    }
    
    const existingFiles = await prisma.deliverableFile.findMany({
      where: { deliverableId: id },
      orderBy: { version: "desc" }
    });
    
    const nextVersion = existingFiles.length > 0 ? existingFiles[0].version + 1 : 1;
    
    await prisma.deliverableFile.updateMany({
      where: { deliverableId: id },
      data: { isCurrentVersion: false }
    });
    
    const deliverableFile = await prisma.deliverableFile.create({
      data: {
        deliverableId: id,
        fileName: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        filePath: file.path,
        version: nextVersion,
        isCurrentVersion: true,
        uploadedById: req.user!.id
      },
      include: {
        uploadedBy: { select: { id: true, fullName: true } }
      }
    });
    
    logAuditTrail(
      req.user!.id, "DELIVERABLE_FILE_UPLOADED", "deliverable_file", deliverableFile.id,
      null, { deliverableId: id, version: nextVersion, fileName: file.originalname }, deliverable.engagementId,
      `Uploaded file: ${file.originalname} (v${nextVersion})`, req.ip, req.get("user-agent")
    ).catch(err => console.error("Audit trail error:", err));
    
    res.json(deliverableFile);
  } catch (error) {
    console.error("Error uploading file:", error);
    res.status(500).json({ error: "Failed to upload file" });
  }
});

router.get("/:id/files", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const firmId = req.user!.firmId;
    
    const { deliverable, error } = await verifyDeliverableAccess(id, firmId);
    if (error) {
      return res.status(403).json({ error });
    }
    
    const files = await prisma.deliverableFile.findMany({
      where: { deliverableId: id },
      include: {
        uploadedBy: { select: { id: true, fullName: true } }
      },
      orderBy: { version: "desc" }
    });
    
    res.json(files);
  } catch (error) {
    console.error("Error fetching files:", error);
    res.status(500).json({ error: "Failed to fetch files" });
  }
});

router.get("/file/:fileId/download", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { fileId } = req.params;
    const firmId = req.user!.firmId;
    
    const file = await prisma.deliverableFile.findFirst({
      where: { 
        id: fileId,
        deliverable: {
          engagement: {
            firmId: firmId || undefined
          }
        }
      },
      include: {
        deliverable: {
          include: { engagement: true }
        }
      }
    });
    
    if (!file) {
      return res.status(404).json({ error: "File not found or access denied" });
    }
    
    if (!fs.existsSync(file.filePath)) {
      return res.status(404).json({ error: "File not found on disk" });
    }
    
    logAuditTrail(
      req.user!.id, "DELIVERABLE_FILE_DOWNLOADED", "deliverable_file", fileId,
      null, { deliverableId: file.deliverableId, fileName: file.originalName }, file.deliverable.engagementId,
      `Downloaded file: ${file.originalName}`, req.ip, req.get("user-agent")
    ).catch(err => console.error("Audit trail error:", err));
    
    res.download(file.filePath, file.originalName);
  } catch (error) {
    console.error("Error downloading file:", error);
    res.status(500).json({ error: "Failed to download file" });
  }
});

router.delete("/file/:fileId", requireAuth, requireMinRole("SENIOR"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { fileId } = req.params;
    const firmId = req.user!.firmId;
    
    const file = await prisma.deliverableFile.findFirst({
      where: { 
        id: fileId,
        deliverable: {
          engagement: {
            firmId: firmId || undefined
          }
        }
      },
      include: { deliverable: true }
    });
    
    if (!file) {
      return res.status(404).json({ error: "File not found or access denied" });
    }
    
    if (file.deliverable.status === "FINAL" || file.deliverable.status === "ISSUED") {
      return res.status(400).json({ error: "Cannot delete files from a finalized or issued deliverable" });
    }
    
    if (fs.existsSync(file.filePath)) {
      fs.unlinkSync(file.filePath);
    }
    
    await prisma.deliverableFile.delete({
      where: { id: fileId }
    });
    
    if (file.isCurrentVersion) {
      const previousVersion = await prisma.deliverableFile.findFirst({
        where: { deliverableId: file.deliverableId },
        orderBy: { version: "desc" }
      });
      
      if (previousVersion) {
        await prisma.deliverableFile.update({
          where: { id: previousVersion.id },
          data: { isCurrentVersion: true }
        });
      }
    }
    
    logAuditTrail(
      req.user!.id, "DELIVERABLE_FILE_DELETED", "deliverable_file", fileId,
      null, { deliverableId: file.deliverableId, fileName: file.originalName }, file.deliverable.engagementId,
      `Deleted file: ${file.originalName}`, req.ip, req.get("user-agent")
    ).catch(err => console.error("Audit trail error:", err));
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting file:", error);
    res.status(500).json({ error: "Failed to delete file" });
  }
});

export default router;
