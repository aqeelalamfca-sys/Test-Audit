import { Router, type Response } from "express";
import { prisma } from "../db";
import { requireAuth, requireMinRole, type AuthenticatedRequest } from "../auth";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import ExcelJS from "exceljs";
import { Readable } from "stream";

const router = Router();

const uploadDir = path.join(process.cwd(), "uploads", "checklist-evidence");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const evidenceStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `chk-ev-${uniqueSuffix}${ext}`);
  },
});

const evidenceUpload = multer({
  storage: evidenceStorage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/gif",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
      "text/csv",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Allowed: PDF, images, Word, Excel, CSV, text"));
    }
  },
});

const bulkUploadStorage = multer.memoryStorage();
const bulkUpload = multer({
  storage: bulkUploadStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/csv",
    ];
    if (allowedTypes.includes(file.mimetype) || file.originalname.endsWith(".csv")) {
      cb(null, true);
    } else {
      cb(new Error("Only Excel (.xlsx) or CSV files are allowed"));
    }
  },
});

const checklistItemSchema = z.object({
  ref: z.string(),
  description: z.string(),
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "NOT_APPLICABLE"]).default("PENDING"),
  notes: z.string().optional(),
  evidence: z.string().optional(),
  evidenceAttachments: z.array(z.object({
    id: z.string(),
    fileName: z.string(),
    filePath: z.string(),
    fileSize: z.number(),
    fileType: z.string(),
    uploadedAt: z.string(),
    uploadedBy: z.string().optional(),
  })).optional(),
  lawRegulation: z.string().optional(),
  sectionRule: z.string().optional(),
  applicability: z.string().optional(),
  complianceRequirement: z.string().optional(),
  complianceStatus: z.string().optional(),
  remarks: z.string().optional(),
});

const ALLOWED_CHECKLIST_TYPES = [
  "COMPANIES_ACT_2017",
  "FBR_TAX_COMPLIANCE",
  "FBR_WHT_RECONCILIATION",
  "FBR_NTN_VERIFICATION",
  "SECP_COMPLIANCE",
  "SECP_XBRL_READINESS",
  "ISA_DOCUMENTATION",
  "ISQM_QUALITY_CONTROL",
  "CUSTOM",
] as const;

const CHECKLIST_TYPE_LABELS: Record<string, string> = {
  COMPANIES_ACT_2017: "Companies Act 2017",
  FBR_TAX_COMPLIANCE: "FBR Tax Compliance",
  FBR_WHT_RECONCILIATION: "FBR WHT Reconciliation",
  FBR_NTN_VERIFICATION: "FBR NTN Verification",
  SECP_COMPLIANCE: "SECP Compliance",
  SECP_XBRL_READINESS: "SECP XBRL Readiness",
  ISA_DOCUMENTATION: "ISA Documentation",
  ISQM_QUALITY_CONTROL: "ISQM Quality Control",
  CUSTOM: "Custom Checklist",
};

const upsertChecklistSchema = z.object({
  checklistType: z.enum(ALLOWED_CHECKLIST_TYPES),
  checklistReference: z.string().min(1),
  items: z.array(checklistItemSchema),
});

router.get("/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId },
      select: { id: true },
    });
    if (!engagement) return res.status(404).json({ error: "Engagement not found" });

    const checklists = await prisma.complianceChecklist.findMany({
      where: { engagementId },
      include: {
        preparedBy: { select: { id: true, fullName: true } },
        reviewedBy: { select: { id: true, fullName: true } },
        partnerApprovedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    res.json(checklists);
  } catch (error) {
    console.error("Get compliance checklists error:", error);
    res.status(500).json({ error: "Failed to fetch compliance checklists" });
  }
});

router.post("/:engagementId", requireAuth, requireMinRole("SENIOR"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId },
      select: { id: true },
    });
    if (!engagement) return res.status(404).json({ error: "Engagement not found" });

    const data = upsertChecklistSchema.parse(req.body);

    const totalItems = data.items.length;
    const completedItems = data.items.filter((i) => i.status === "COMPLETED").length;
    const notApplicableItems = data.items.filter((i) => i.status === "NOT_APPLICABLE").length;
    const isComplete = totalItems > 0 && completedItems + notApplicableItems === totalItems;

    const checklist = await prisma.complianceChecklist.upsert({
      where: {
        engagementId_checklistType: {
          engagementId,
          checklistType: data.checklistType,
        },
      },
      create: {
        engagementId,
        checklistType: data.checklistType,
        checklistReference: data.checklistReference,
        items: data.items as unknown as Record<string, unknown>[],
        totalItems,
        completedItems,
        notApplicableItems,
        isComplete,
        preparedById: req.user!.id,
        preparedDate: new Date(),
      },
      update: {
        checklistReference: data.checklistReference,
        items: data.items as unknown as Record<string, unknown>[],
        totalItems,
        completedItems,
        notApplicableItems,
        isComplete,
        updatedAt: new Date(),
      },
      include: {
        preparedBy: { select: { id: true, fullName: true } },
        reviewedBy: { select: { id: true, fullName: true } },
        partnerApprovedBy: { select: { id: true, fullName: true } },
      },
    });

    res.status(200).json(checklist);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("Save compliance checklist error:", error);
    res.status(500).json({ error: "Failed to save compliance checklist" });
  }
});

router.get("/:engagementId/template/:checklistType", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { checklistType } = req.params;
    const label = CHECKLIST_TYPE_LABELS[checklistType] || checklistType;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "AuditWise";
    workbook.created = new Date();

    const ws = workbook.addWorksheet(label.substring(0, 31));

    ws.columns = [
      { header: "Sr. No.", key: "srNo", width: 8 },
      { header: "Law / Regulation", key: "lawRegulation", width: 30 },
      { header: "Section / Rule", key: "sectionRule", width: 20 },
      { header: "Applicability", key: "applicability", width: 18 },
      { header: "Compliance Requirement", key: "complianceRequirement", width: 40 },
      { header: "Compliance Status", key: "complianceStatus", width: 18 },
      { header: "Evidence Reference", key: "evidence", width: 25 },
      { header: "Remarks", key: "remarks", width: 30 },
    ];

    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4CAF50" } };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };

    for (let i = 1; i <= 5; i++) {
      ws.addRow({
        srNo: i,
        lawRegulation: "",
        sectionRule: "",
        applicability: "Applicable",
        complianceRequirement: "",
        complianceStatus: "",
        evidence: "",
        remarks: "",
      });
    }

    const instructionsWs = workbook.addWorksheet("Instructions");
    instructionsWs.getColumn(1).width = 60;
    instructionsWs.addRow(["AuditWise — Compliance Checklist Upload Template"]);
    instructionsWs.getRow(1).font = { bold: true, size: 14 };
    instructionsWs.addRow([""]);
    instructionsWs.addRow(["Instructions:"]);
    instructionsWs.getRow(3).font = { bold: true };
    instructionsWs.addRow(["1. Fill in the checklist items in the first sheet"]);
    instructionsWs.addRow(["2. Sr. No. will be auto-assigned on import — you can leave it blank"]);
    instructionsWs.addRow(["3. Applicability values: Applicable, Not Applicable, Conditionally Applicable"]);
    instructionsWs.addRow(["4. Compliance Status values: Compliant, Non-Compliant, Partially Compliant, Not Applicable, Under Review"]);
    instructionsWs.addRow(["5. Evidence Reference is a text description — attach actual files after import"]);
    instructionsWs.addRow(["6. You can add as many rows as needed"]);
    instructionsWs.addRow([""]);
    instructionsWs.addRow([`Checklist Type: ${label}`]);
    instructionsWs.addRow([`Generated: ${new Date().toLocaleDateString("en-GB")}`]);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${label.replace(/\s+/g, "_")}_Template.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Template download error:", error);
    res.status(500).json({ error: "Failed to generate template" });
  }
});

router.post("/:engagementId/bulk-upload", requireAuth, requireMinRole("SENIOR"), bulkUpload.single("file"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId },
      select: { id: true },
    });
    if (!engagement) return res.status(404).json({ error: "Engagement not found" });

    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const { checklistType, checklistReference } = req.body;
    if (!checklistType || !ALLOWED_CHECKLIST_TYPES.includes(checklistType as typeof ALLOWED_CHECKLIST_TYPES[number])) {
      return res.status(400).json({ error: "Invalid or missing checklistType" });
    }
    if (!checklistReference) {
      return res.status(400).json({ error: "checklistReference is required" });
    }

    const workbook = new ExcelJS.Workbook();
    const isCSV = file.mimetype === "text/csv" || file.originalname.endsWith(".csv");
    try {
      if (isCSV) {
        const csvString = file.buffer.toString("utf-8");
        const readable = new Readable();
        readable.push(csvString);
        readable.push(null);
        await workbook.csv.read(readable);
      } else {
        await workbook.xlsx.load(file.buffer);
      }
    } catch (parseErr) {
      return res.status(400).json({ error: "Failed to parse the uploaded file. Please ensure it is a valid .xlsx or .csv file." });
    }

    const ws = workbook.worksheets[0];
    if (!ws) return res.status(400).json({ error: "No worksheet found in the uploaded file" });

    const headerRow = ws.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      headers[colNumber] = String(cell.value || "").toLowerCase().trim();
    });

    const colMap: Record<string, number> = {};
    const fieldMappings: Record<string, string[]> = {
      lawRegulation: ["law / regulation", "law/regulation", "law", "regulation", "act"],
      sectionRule: ["section / rule", "section/rule", "section", "rule"],
      applicability: ["applicability"],
      complianceRequirement: ["compliance requirement", "requirement", "description"],
      complianceStatus: ["compliance status", "status"],
      evidence: ["evidence", "evidence reference"],
      remarks: ["remarks", "notes", "comment", "comments"],
    };

    for (const [field, patterns] of Object.entries(fieldMappings)) {
      for (let c = 1; c <= headers.length; c++) {
        if (headers[c] && patterns.some(p => headers[c].includes(p))) {
          colMap[field] = c;
          break;
        }
      }
    }

    const statusMap: Record<string, string> = {
      "compliant": "COMPLETED",
      "non-compliant": "IN_PROGRESS",
      "non compliant": "IN_PROGRESS",
      "partially compliant": "IN_PROGRESS",
      "not applicable": "NOT_APPLICABLE",
      "n/a": "NOT_APPLICABLE",
      "under review": "PENDING",
      "pending": "PENDING",
    };

    const items: z.infer<typeof checklistItemSchema>[] = [];

    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;

      const getCellValue = (col: number | undefined): string => {
        if (!col) return "";
        const cell = row.getCell(col);
        return String(cell.value || "").trim();
      };

      const lawReg = getCellValue(colMap.lawRegulation);
      const compReq = getCellValue(colMap.complianceRequirement);
      const section = getCellValue(colMap.sectionRule);

      if (!lawReg && !compReq && !section) return;

      const rawStatus = getCellValue(colMap.complianceStatus).toLowerCase();
      const mappedStatus = statusMap[rawStatus] || "PENDING";

      items.push({
        ref: String(items.length + 1),
        description: compReq || lawReg || "",
        status: mappedStatus as "PENDING" | "IN_PROGRESS" | "COMPLETED" | "NOT_APPLICABLE",
        lawRegulation: lawReg,
        sectionRule: section,
        applicability: getCellValue(colMap.applicability) || "Applicable",
        complianceRequirement: compReq,
        complianceStatus: getCellValue(colMap.complianceStatus) || "Pending",
        evidence: getCellValue(colMap.evidence),
        remarks: getCellValue(colMap.remarks),
      });
    });

    if (items.length === 0) {
      return res.status(400).json({ error: "No data rows found in the file. Please check the template format." });
    }

    const totalItems = items.length;
    const completedItems = items.filter((i) => i.status === "COMPLETED").length;
    const notApplicableItems = items.filter((i) => i.status === "NOT_APPLICABLE").length;
    const isComplete = totalItems > 0 && completedItems + notApplicableItems === totalItems;

    const checklist = await prisma.complianceChecklist.upsert({
      where: {
        engagementId_checklistType: {
          engagementId,
          checklistType,
        },
      },
      create: {
        engagementId,
        checklistType,
        checklistReference,
        items: items as unknown as Record<string, unknown>[],
        totalItems,
        completedItems,
        notApplicableItems,
        isComplete,
        preparedById: req.user!.id,
        preparedDate: new Date(),
      },
      update: {
        checklistReference,
        items: items as unknown as Record<string, unknown>[],
        totalItems,
        completedItems,
        notApplicableItems,
        isComplete,
        updatedAt: new Date(),
      },
      include: {
        preparedBy: { select: { id: true, fullName: true } },
        reviewedBy: { select: { id: true, fullName: true } },
        partnerApprovedBy: { select: { id: true, fullName: true } },
      },
    });

    res.json({
      success: true,
      checklist,
      imported: items.length,
      columnsMatched: Object.keys(colMap),
    });
  } catch (error) {
    console.error("Bulk upload checklist error:", error);
    res.status(500).json({ error: "Failed to import checklist from file" });
  }
});

router.post("/:engagementId/evidence-upload/:checklistType/:itemRef", requireAuth, requireMinRole("SENIOR"), evidenceUpload.single("file"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, checklistType, itemRef } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId },
      select: { id: true },
    });
    if (!engagement) return res.status(404).json({ error: "Engagement not found" });

    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const checklist = await prisma.complianceChecklist.findFirst({
      where: { engagementId, checklistType },
    });
    if (!checklist) return res.status(404).json({ error: "Checklist not found" });

    const items = (checklist.items as unknown as Record<string, unknown>[]) || [];
    const itemIndex = items.findIndex((item: Record<string, unknown>) => item.ref === itemRef);
    if (itemIndex === -1) return res.status(404).json({ error: "Checklist item not found" });

    const attachment = {
      id: crypto.randomUUID(),
      fileName: file.originalname,
      filePath: file.path,
      fileSize: file.size,
      fileType: file.mimetype,
      uploadedAt: new Date().toISOString(),
      uploadedBy: req.user!.id,
    };

    const item = items[itemIndex] as Record<string, unknown>;
    const existingAttachments = (item.evidenceAttachments as Record<string, unknown>[]) || [];
    existingAttachments.push(attachment);
    item.evidenceAttachments = existingAttachments;
    items[itemIndex] = item;

    await prisma.complianceChecklist.update({
      where: { id: checklist.id },
      data: {
        items: items as unknown as Record<string, unknown>[],
        updatedAt: new Date(),
      },
    });

    res.json({
      success: true,
      attachment: {
        id: attachment.id,
        fileName: attachment.fileName,
        fileSize: attachment.fileSize,
        fileType: attachment.fileType,
        uploadedAt: attachment.uploadedAt,
      },
    });
  } catch (error) {
    console.error("Evidence upload error:", error);
    res.status(500).json({ error: "Failed to upload evidence file" });
  }
});

router.delete("/:engagementId/evidence/:checklistType/:itemRef/:attachmentId", requireAuth, requireMinRole("SENIOR"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, checklistType, itemRef, attachmentId } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId },
      select: { id: true },
    });
    if (!engagement) return res.status(404).json({ error: "Engagement not found" });

    const checklist = await prisma.complianceChecklist.findFirst({
      where: { engagementId, checklistType },
    });
    if (!checklist) return res.status(404).json({ error: "Checklist not found" });

    const items = (checklist.items as unknown as Record<string, unknown>[]) || [];
    const itemIndex = items.findIndex((item: Record<string, unknown>) => item.ref === itemRef);
    if (itemIndex === -1) return res.status(404).json({ error: "Checklist item not found" });

    const item = items[itemIndex] as Record<string, unknown>;
    const attachments = (item.evidenceAttachments as Record<string, unknown>[]) || [];
    const attachmentIndex = attachments.findIndex((a: Record<string, unknown>) => a.id === attachmentId);
    if (attachmentIndex === -1) return res.status(404).json({ error: "Attachment not found" });

    const removed = attachments[attachmentIndex] as Record<string, unknown>;
    const filePath = removed.filePath as string;
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch { }
    }

    attachments.splice(attachmentIndex, 1);
    item.evidenceAttachments = attachments;
    items[itemIndex] = item;

    await prisma.complianceChecklist.update({
      where: { id: checklist.id },
      data: {
        items: items as unknown as Record<string, unknown>[],
        updatedAt: new Date(),
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Delete evidence error:", error);
    res.status(500).json({ error: "Failed to delete evidence file" });
  }
});

router.get("/:engagementId/evidence-download/:checklistType/:itemRef/:attachmentId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, checklistType, itemRef, attachmentId } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId },
      select: { id: true },
    });
    if (!engagement) return res.status(404).json({ error: "Engagement not found" });

    const checklist = await prisma.complianceChecklist.findFirst({
      where: { engagementId, checklistType },
    });
    if (!checklist) return res.status(404).json({ error: "Checklist not found" });

    const items = (checklist.items as unknown as Record<string, unknown>[]) || [];
    const item = items.find((i: Record<string, unknown>) => i.ref === itemRef) as Record<string, unknown> | undefined;
    if (!item) return res.status(404).json({ error: "Item not found" });

    const attachments = (item.evidenceAttachments as Record<string, unknown>[]) || [];
    const attachment = attachments.find((a: Record<string, unknown>) => a.id === attachmentId) as Record<string, unknown> | undefined;
    if (!attachment) return res.status(404).json({ error: "Attachment not found" });

    const filePath = attachment.filePath as string;
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found on disk" });
    }

    res.download(filePath, attachment.fileName as string);
  } catch (error) {
    console.error("Evidence download error:", error);
    res.status(500).json({ error: "Failed to download evidence file" });
  }
});

router.get("/:engagementId/export", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId },
      include: {
        client: { select: { name: true } },
        firm: { select: { name: true } },
      },
    });
    if (!engagement) return res.status(404).json({ error: "Engagement not found" });

    const checklists = await prisma.complianceChecklist.findMany({
      where: { engagementId },
      include: {
        preparedBy: { select: { fullName: true } },
        reviewedBy: { select: { fullName: true } },
        partnerApprovedBy: { select: { fullName: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    const exportData = {
      exportedAt: new Date().toISOString(),
      firm: engagement.firm?.name ?? null,
      client: engagement.client?.name ?? null,
      engagementCode: engagement.engagementCode,
      periodStart: engagement.periodStart,
      periodEnd: engagement.periodEnd,
      checklists: checklists.map((cl) => ({
        type: cl.checklistType,
        reference: cl.checklistReference,
        totalItems: cl.totalItems,
        completedItems: cl.completedItems,
        notApplicableItems: cl.notApplicableItems,
        isComplete: cl.isComplete,
        preparedBy: cl.preparedBy?.fullName ?? null,
        preparedDate: cl.preparedDate,
        reviewedBy: cl.reviewedBy?.fullName ?? null,
        reviewedDate: cl.reviewedDate,
        partnerApprovedBy: cl.partnerApprovedBy?.fullName ?? null,
        partnerApprovalDate: cl.partnerApprovalDate,
        items: cl.items,
      })),
    };

    res.json(exportData);
  } catch (error) {
    console.error("Export compliance checklists error:", error);
    res.status(500).json({ error: "Failed to export compliance checklists" });
  }
});

export default router;
