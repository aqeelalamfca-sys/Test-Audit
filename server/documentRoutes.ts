import { Router, Response } from "express";
import { prisma } from "./db";
import { requireAuth, type AuthenticatedRequest } from "./auth";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const router = Router();

const uploadDir = path.join(process.cwd(), "uploads", "documents");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `doc-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type"));
    }
  },
});

function generateFileRef(): string {
  return `DOC-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

router.post("/upload", requireAuth, upload.single("file"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const file = req.file;
    const { documentType, engagementId } = req.body;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const fileBuffer = await fs.promises.readFile(file.path);
    const fileHeader = fileBuffer.toString('utf8', 0, Math.min(100, fileBuffer.length));
    
    if (fileHeader.includes('<!DOCTYPE') || fileHeader.includes('<html')) {
      await fs.promises.unlink(file.path);
      return res.status(400).json({ error: "Invalid file: HTML content detected. Please upload a valid document." });
    }

    if (!engagementId || !documentType) {
      return res.status(400).json({ error: "Missing engagementId or documentType" });
    }

    const firmId = req.user?.firmId;
    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const document = await prisma.evidenceFile.create({
      data: {
        engagementId,
        phase: "PRE_PLANNING",
        fileReference: generateFileRef(),
        fileName: file.originalname,
        fileType: file.mimetype,
        fileSize: file.size,
        filePath: file.path,
        description: documentType,
        uploadedById: req.user!.id,
        cycle: "preplanning_documents",
      },
    });

    console.log(`[UPLOAD] File uploaded: ${document.fileName} (${document.fileSize} bytes)`);

    res.json({
      success: true,
      document: {
        id: document.id,
        fileName: document.fileName,
        documentType: document.description,
        fileSize: document.fileSize,
      },
    });
  } catch (error: any) {
    console.error("Document upload error:", error);
    res.status(500).json({ error: error.message || "Failed to upload document" });
  }
});

router.get("/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { documentType } = req.query;

    const where: any = { 
      engagementId,
      cycle: "preplanning_documents",
    };
    
    if (documentType) {
      where.description = documentType;
    }

    const documents = await prisma.evidenceFile.findMany({
      where,
      include: {
        uploadedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(documents);
  } catch (error: any) {
    console.error("Get documents error:", error);
    res.status(500).json({ error: "Failed to fetch documents" });
  }
});

router.delete("/:documentId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { documentId } = req.params;

    const document = await prisma.evidenceFile.findUnique({
      where: { id: documentId },
      include: { engagement: true },
    });

    if (!document || document.engagement.firmId !== req.user?.firmId) {
      return res.status(404).json({ error: "Document not found" });
    }

    if (document.filePath && fs.existsSync(document.filePath)) {
      fs.unlinkSync(document.filePath);
    }

    await prisma.evidenceFile.delete({
      where: { id: documentId },
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error("Delete document error:", error);
    res.status(500).json({ error: "Failed to delete document" });
  }
});

router.get("/download/:documentId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { documentId } = req.params;

    const document = await prisma.evidenceFile.findUnique({
      where: { id: documentId },
      include: { engagement: true },
    });

    if (!document || document.engagement.firmId !== req.user?.firmId) {
      return res.status(404).json({ error: "Document not found" });
    }

    if (!document.filePath || !fs.existsSync(document.filePath)) {
      return res.status(404).json({ error: "File not found on server" });
    }

    console.log(`[DOWNLOAD] Downloading file: ${document.fileName}`);
    const stats = fs.statSync(document.filePath);

    // Set proper headers for file download
    res.setHeader('Content-Type', document.fileType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(document.fileName)}"`);
    res.setHeader('Content-Length', stats.size.toString());
    res.setHeader('Cache-Control', 'no-cache');
    
    // Stream the file
    const fileStream = fs.createReadStream(document.filePath);
    
    fileStream.on('error', (error) => {
      console.error("[DOWNLOAD ERROR] Stream error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to stream file" });
      }
    });
    
    fileStream.pipe(res);
  } catch (error: any) {
    console.error("Download document error:", error);
    res.status(500).json({ error: "Failed to download document" });
  }
});

export default router;
