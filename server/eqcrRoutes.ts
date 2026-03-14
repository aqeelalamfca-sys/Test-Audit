import { Router, Response } from "express";
import { prisma } from "./db";
import { requireAuth, requireMinRole, logAuditTrail, type AuthenticatedRequest } from "./auth";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import { nanoid } from "nanoid";

const router = Router();

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "eqcr");
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
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "image/jpeg",
      "image/png"
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type"));
    }
  }
});

const DEFAULT_CHECKLIST_ITEMS = [
  { srNo: 1, checklistArea: "Review of significant judgments and estimates" },
  { srNo: 2, checklistArea: "Evaluation of audit team's assessment of risks" },
  { srNo: 3, checklistArea: "Review of significant matters requiring consultation" },
  { srNo: 4, checklistArea: "Review of financial statements and auditor's report" },
  { srNo: 5, checklistArea: "Evaluation of conclusions reached" },
  { srNo: 6, checklistArea: "Review of documentation of significant matters" },
  { srNo: 7, checklistArea: "Discussion with engagement partner" }
];

async function validateEngagementAccess(engagementId: string, firmId: string | null) {
  if (!firmId) return { valid: false, error: "User not associated with a firm" };
  const engagement = await prisma.engagement.findFirst({ where: { id: engagementId, firmId } });
  if (!engagement) return { valid: false, error: "Engagement not found" };
  return { valid: true, engagement };
}

router.get("/:engagementId/assignment", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const assignment = await prisma.eQCRAssignment.findUnique({
      where: { engagementId: req.params.engagementId },
      include: {
        assignedReviewer: { select: { id: true, fullName: true, role: true } },
        assignedBy: { select: { id: true, fullName: true, role: true } },
        comments: {
          include: {
            createdBy: { select: { id: true, fullName: true, role: true } },
            respondedBy: { select: { id: true, fullName: true, role: true } },
            clearedBy: { select: { id: true, fullName: true, role: true } }
          },
          orderBy: { createdAt: "desc" }
        },
        checklistItems: {
          include: {
            reviewedBy: { select: { id: true, fullName: true } },
            attachments: {
              include: { uploadedBy: { select: { id: true, fullName: true } } }
            }
          },
          orderBy: { srNo: "asc" }
        },
        partnerComment: {
          include: { createdBy: { select: { id: true, fullName: true, role: true } } }
        },
        signedReports: {
          where: { isCurrentVersion: true },
          include: { uploadedBy: { select: { id: true, fullName: true } } }
        }
      }
    });
    res.json(assignment);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch assignment", details: error.message });
  }
});

router.post("/:engagementId/assignment", requireAuth, requireMinRole("PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const assignment = await prisma.eQCRAssignment.upsert({
      where: { engagementId: req.params.engagementId },
      update: {
        isRequired: req.body.isRequired,
        requirementReason: req.body.requirementReason,
        assignedReviewerId: req.body.assignedReviewerId,
        assignedDate: req.body.assignedReviewerId ? new Date() : null,
        assignedById: req.body.assignedReviewerId ? req.user!.id : null,
        status: req.body.assignedReviewerId ? "ASSIGNED" : req.body.isRequired ? "PENDING_ASSIGNMENT" : "NOT_REQUIRED"
      },
      create: {
        engagementId: req.params.engagementId,
        isRequired: req.body.isRequired,
        requirementReason: req.body.requirementReason,
        assignedReviewerId: req.body.assignedReviewerId,
        assignedDate: req.body.assignedReviewerId ? new Date() : null,
        assignedById: req.body.assignedReviewerId ? req.user!.id : null,
        status: req.body.assignedReviewerId ? "ASSIGNED" : req.body.isRequired ? "PENDING_ASSIGNMENT" : "NOT_REQUIRED"
      },
      include: { assignedReviewer: { select: { id: true, fullName: true, role: true } } }
    });

    await logAuditTrail(
      req.user!.id,
      "EQCR_ASSIGNED",
      `EQCR ${req.body.isRequired ? "required" : "not required"}`,
      req.params.engagementId,
      { assignmentId: assignment.id }
    );
    res.json(assignment);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to save assignment", details: error.message });
  }
});

router.post("/:engagementId/start-review", requireAuth, requireMinRole("EQCR"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const existingAssignment = await prisma.eQCRAssignment.findUnique({
      where: { engagementId: req.params.engagementId }
    });

    if (!existingAssignment) {
      return res.status(404).json({ error: "EQCR assignment not found" });
    }

    const existingItems = await prisma.eQCRChecklistItem.count({
      where: { eqcrAssignmentId: existingAssignment.id }
    });

    if (existingItems === 0) {
      await prisma.eQCRChecklistItem.createMany({
        data: DEFAULT_CHECKLIST_ITEMS.map(item => ({
          eqcrAssignmentId: existingAssignment.id,
          srNo: item.srNo,
          checklistArea: item.checklistArea
        }))
      });
    }

    const assignment = await prisma.eQCRAssignment.update({
      where: { engagementId: req.params.engagementId },
      data: { status: "IN_PROGRESS", reviewStartDate: new Date() },
      include: {
        checklistItems: { orderBy: { srNo: "asc" } }
      }
    });

    await logAuditTrail(
      req.user!.id,
      "EQCR_REVIEW_STARTED",
      "EQCR review started",
      req.params.engagementId,
      { assignmentId: assignment.id }
    );
    res.json(assignment);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to start review", details: error.message });
  }
});

router.get("/:engagementId/checklist-items", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const assignment = await prisma.eQCRAssignment.findUnique({
      where: { engagementId: req.params.engagementId }
    });

    if (!assignment) {
      return res.json([]);
    }

    const items = await prisma.eQCRChecklistItem.findMany({
      where: { eqcrAssignmentId: assignment.id },
      include: {
        reviewedBy: { select: { id: true, fullName: true } },
        attachments: {
          include: { uploadedBy: { select: { id: true, fullName: true } } }
        }
      },
      orderBy: { srNo: "asc" }
    });
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch checklist items", details: error.message });
  }
});

router.put("/:engagementId/checklist-items/:itemId", requireAuth, requireMinRole("EQCR"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const assignment = await prisma.eQCRAssignment.findUnique({
      where: { engagementId: req.params.engagementId }
    });

    if (!assignment || assignment.isFinalized) {
      return res.status(400).json({ error: "EQCR is finalized and cannot be modified" });
    }

    const updateData: Record<string, any> = {
      reviewedById: req.user!.id,
      reviewedAt: new Date()
    };
    
    if (req.body.descriptionOfReview !== undefined) {
      updateData.descriptionOfReview = req.body.descriptionOfReview;
    }
    if (req.body.isAIAssisted !== undefined) {
      updateData.isAIAssisted = req.body.isAIAssisted;
    }
    if (req.body.aiDraftContent !== undefined) {
      updateData.aiDraftContent = req.body.aiDraftContent;
    }
    if (req.body.response !== undefined) {
      updateData.response = req.body.response;
    }
    if (req.body.remarks !== undefined) {
      updateData.remarks = req.body.remarks;
    }

    const item = await prisma.eQCRChecklistItem.update({
      where: { id: req.params.itemId },
      data: updateData,
      include: {
        reviewedBy: { select: { id: true, fullName: true } },
        attachments: true
      }
    });

    await logAuditTrail(
      req.user!.id,
      "EQCR_CHECKLIST_UPDATED",
      `Updated checklist item: ${item.checklistArea}`,
      req.params.engagementId,
      { itemId: item.id, response: req.body.response }
    );
    res.json(item);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update checklist item", details: error.message });
  }
});

router.post("/:engagementId/checklist-items", requireAuth, requireMinRole("EQCR"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const assignment = await prisma.eQCRAssignment.findUnique({
      where: { engagementId: req.params.engagementId }
    });

    if (!assignment || assignment.isFinalized) {
      return res.status(400).json({ error: "Cannot add items to finalized EQCR" });
    }

    const maxSrNo = await prisma.eQCRChecklistItem.findFirst({
      where: { eqcrAssignmentId: assignment.id },
      orderBy: { srNo: "desc" },
      select: { srNo: true }
    });

    const item = await prisma.eQCRChecklistItem.create({
      data: {
        eqcrAssignmentId: assignment.id,
        srNo: (maxSrNo?.srNo || 0) + 1,
        checklistArea: req.body.checklistArea
      }
    });

    await logAuditTrail(
      req.user!.id,
      "EQCR_CHECKLIST_ITEM_ADDED",
      `Added custom checklist item: ${req.body.checklistArea}`,
      req.params.engagementId,
      { itemId: item.id }
    );
    res.json(item);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to add checklist item", details: error.message });
  }
});

router.post("/:engagementId/checklist-items/:itemId/upload", requireAuth, requireMinRole("EQCR"), upload.single("file"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      fs.unlinkSync(file.path);
      return res.status(404).json({ error: access.error });
    }

    const assignment = await prisma.eQCRAssignment.findUnique({
      where: { engagementId: req.params.engagementId }
    });

    if (!assignment || assignment.isFinalized) {
      fs.unlinkSync(file.path);
      return res.status(400).json({ error: "Cannot upload to finalized EQCR" });
    }

    const attachment = await prisma.eQCRChecklistFile.create({
      data: {
        checklistItemId: req.params.itemId,
        fileName: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        filePath: file.path,
        uploadedById: req.user!.id
      },
      include: { uploadedBy: { select: { id: true, fullName: true } } }
    });

    await logAuditTrail(
      req.user!.id,
      "EQCR_FILE_UPLOADED",
      `Uploaded file: ${file.originalname}`,
      req.params.engagementId,
      { attachmentId: attachment.id, itemId: req.params.itemId }
    );
    res.json(attachment);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to upload file", details: error.message });
  }
});

router.delete("/:engagementId/checklist-files/:fileId", requireAuth, requireMinRole("EQCR"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const file = await prisma.eQCRChecklistFile.findUnique({
      where: { id: req.params.fileId }
    });

    if (!file) return res.status(404).json({ error: "File not found" });

    if (fs.existsSync(file.filePath)) {
      fs.unlinkSync(file.filePath);
    }

    await prisma.eQCRChecklistFile.delete({ where: { id: req.params.fileId } });

    await logAuditTrail(
      req.user!.id,
      "EQCR_FILE_DELETED",
      `Deleted file: ${file.originalName}`,
      req.params.engagementId,
      { fileId: req.params.fileId }
    );
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete file", details: error.message });
  }
});

router.post("/:engagementId/ai-assist/:itemId", requireAuth, requireMinRole("EQCR"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const item = await prisma.eQCRChecklistItem.findUnique({
      where: { id: req.params.itemId }
    });

    if (!item) return res.status(404).json({ error: "Checklist item not found" });

    const engagement = await prisma.engagement.findUnique({
      where: { id: req.params.engagementId },
      include: {
        client: { select: { name: true } },
        riskAssessments: { take: 5, orderBy: { createdAt: "desc" } },
        materialityAssessments: { take: 1, orderBy: { createdAt: "desc" } }
      }
    });

    let aiSuggestion = "";
    const area = item.checklistArea.toLowerCase();

    if (area.includes("judgment") || area.includes("estimate")) {
      aiSuggestion = `Reviewed significant judgments and estimates made by the engagement team for ${engagement?.client?.name || "the entity"}. Examined the reasonableness of assumptions used in accounting estimates, including revenue recognition timing, allowance for doubtful accounts, and depreciation methods. Verified that estimation methodologies are consistently applied and appropriately disclosed. Assessed management's process for identifying items requiring estimation and the competence of those involved.`;
    } else if (area.includes("risk")) {
      aiSuggestion = `Evaluated the audit team's risk assessment procedures and their identification of significant risks. Reviewed risk assessment documentation including understanding of the entity and its environment per ISA 315. Assessed whether fraud risk factors per ISA 240 were appropriately considered. Verified that identified risks were properly linked to audit responses and that the risk assessment was updated throughout the engagement.`;
    } else if (area.includes("consultation")) {
      aiSuggestion = `Reviewed all matters requiring consultation during the engagement. Examined consultation documentation for complex accounting treatments, unusual transactions, and disagreements within the team. Verified that consultations were conducted with appropriate personnel and that conclusions reached were properly documented and implemented in the audit approach.`;
    } else if (area.includes("financial statement") || area.includes("report")) {
      aiSuggestion = `Reviewed the draft financial statements and auditor's report for compliance with applicable financial reporting framework and ISAs. Verified consistency between audit findings and the proposed audit opinion. Examined that all required disclosures are complete and accurate. Assessed whether the auditor's report format and language comply with ISA 700/705/706 requirements.`;
    } else if (area.includes("conclusion")) {
      aiSuggestion = `Evaluated the conclusions reached by the engagement team on all significant matters. Reviewed the sufficiency and appropriateness of audit evidence obtained to support key conclusions. Assessed whether conclusions are consistent with the work performed and properly documented. Verified that all significant matters have been satisfactorily resolved.`;
    } else if (area.includes("documentation")) {
      aiSuggestion = `Reviewed the documentation of significant matters throughout the engagement file. Assessed compliance with ISA 230 documentation requirements. Verified that the audit file contains sufficient and appropriate documentation to enable an experienced auditor to understand the nature, timing, and extent of procedures performed, evidence obtained, and conclusions reached.`;
    } else if (area.includes("discussion") || area.includes("partner")) {
      aiSuggestion = `Held discussions with the engagement partner regarding significant findings, judgments made, and conclusions reached. Discussed any concerns about the audit approach, scope limitations, or client relationships. Confirmed the engagement partner's involvement in key decisions and their satisfaction with the resolution of significant matters.`;
    } else {
      aiSuggestion = `Performed review procedures for this area in accordance with ISQM 2 requirements. Examined relevant documentation, assessed the appropriateness of the audit approach, and evaluated the conclusions reached by the engagement team. No significant exceptions noted requiring further follow-up.`;
    }

    res.json({
      suggestion: aiSuggestion,
      isAIGenerated: true,
      generatedAt: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to generate AI suggestion", details: error.message });
  }
});

router.post("/:engagementId/generate-summary", requireAuth, requireMinRole("EQCR"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const engagement = await prisma.engagement.findUnique({
      where: { id: req.params.engagementId },
      include: {
        client: { select: { name: true, ntn: true } },
        riskAssessments: { take: 10, orderBy: { createdAt: "desc" } },
        materialityAssessments: { take: 1, orderBy: { createdAt: "desc" } },
        misstatements: true,
        goingConcernAssessment: true,
        auditReport: true
      }
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const materiality = engagement.materialityAssessments[0];
    const significantRisks = engagement.riskAssessments.filter((r) => r.isSignificantRisk);
    const uncorrectedMisstatements = engagement.misstatements.filter((m) => m.status === "UNADJUSTED" || m.status === "WAIVED");

    const summary = `
ENGAGEMENT QUALITY CONTROL REVIEW SUMMARY
=========================================

ENGAGEMENT OVERVIEW
------------------
Client: ${engagement.client?.name || "N/A"}
NTN: ${engagement.client?.ntn || "N/A"}
Engagement Type: ${engagement.engagementType || "Statutory Audit"}
Reporting Period: ${engagement.periodStart ? new Date(engagement.periodStart).toLocaleDateString() : "N/A"} to ${engagement.periodEnd ? new Date(engagement.periodEnd).toLocaleDateString() : "N/A"}
Current Phase: ${engagement.currentPhase}
Risk Rating: ${engagement.riskRating}

MATERIALITY
-----------
Overall Materiality: ${materiality?.overallMateriality ? `PKR ${materiality.overallMateriality.toLocaleString()}` : "Not determined"}
Performance Materiality: ${materiality?.performanceMateriality ? `PKR ${materiality.performanceMateriality.toLocaleString()}` : "Not determined"}
AMPT Threshold: ${materiality?.amptThreshold ? `PKR ${materiality.amptThreshold.toLocaleString()}` : "Not determined"}
Basis: ${materiality ? `${materiality.benchmark} @ ${materiality.benchmarkPercentage}% of PKR ${materiality.benchmarkAmount.toLocaleString()}` : "N/A"}

SIGNIFICANT RISKS IDENTIFIED
----------------------------
${significantRisks.length > 0 ? significantRisks.map((r, i) => `${i + 1}. ${r.accountOrClass} - ${r.riskDescription || "N/A"} (RMM: ${r.riskOfMaterialMisstatement})`).join("\n") : "No significant risks identified above normal audit risks."}

KEY JUDGMENTS AND ESTIMATES
---------------------------
Significant judgments were made in the following areas:
- Revenue recognition and timing
- Allowance for expected credit losses
- Useful lives of property, plant and equipment
- Fair value measurements where applicable
- Going concern assessment

MISSTATEMENTS AND ADJUSTMENTS
-----------------------------
Total Identified Misstatements: ${engagement.misstatements.length}
Uncorrected Misstatements: ${uncorrectedMisstatements.length}
${uncorrectedMisstatements.length > 0 ? "Management has represented that uncorrected misstatements are immaterial both individually and in aggregate." : "All identified misstatements have been corrected."}

GOING CONCERN ASSESSMENT
------------------------
Assessment Status: ${engagement.goingConcernAssessment ? "Completed" : "Pending"}
Conclusion: ${engagement.goingConcernAssessment?.auditConclusion || "Assessment not yet completed"}

AUDIT OPINION
-------------
Opinion Type: ${engagement.auditReport?.opinionType || "Not yet determined"}
Report Date: ${engagement.auditReport?.reportDate ? new Date(engagement.auditReport.reportDate).toLocaleDateString() : "Not yet issued"}

ISA COMPLIANCE
--------------
This engagement has been conducted in accordance with International Standards on Auditing (ISAs) and ISQM 1/ISQM 2 requirements. Key compliance areas reviewed include:
- ISA 200: Overall objectives and conduct
- ISA 220: Quality management for an audit
- ISA 240: Fraud risk procedures
- ISA 315: Risk identification and assessment
- ISA 330: Responses to assessed risks
- ISA 450: Evaluation of misstatements
- ISA 700-706: Forming opinion and reporting

---
This summary was automatically generated by the AuditWise system.
Generated: ${new Date().toISOString()}
`.trim();

    await prisma.eQCRAssignment.update({
      where: { engagementId: req.params.engagementId },
      data: {
        aiGeneratedSummary: summary,
        aiSummaryGeneratedAt: new Date()
      }
    });

    await logAuditTrail(
      req.user!.id,
      "EQCR_SUMMARY_GENERATED",
      "AI-generated EQCR summary created",
      req.params.engagementId,
      {}
    );

    res.json({ summary, generatedAt: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to generate summary", details: error.message });
  }
});

router.post("/:engagementId/generate-unresolved-summary", requireAuth, requireMinRole("EQCR"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const assignment = await prisma.eQCRAssignment.findUnique({
      where: { engagementId: req.params.engagementId },
      include: {
        checklistItems: { orderBy: { srNo: "asc" } },
        comments: {
          include: {
            createdBy: { select: { fullName: true } },
            respondedBy: { select: { fullName: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        partnerComment: true,
      },
    });

    if (!assignment) return res.status(404).json({ error: "EQCR assignment not found" });

    const openComments = assignment.comments.filter(c => c.status !== "CLEARED");
    const noItemsWithoutRemarks = assignment.checklistItems.filter(i => i.response === "NO" && !i.remarks);
    const incompleteItems = assignment.checklistItems.filter(i => !i.response);

    const summary = `
EQCR UNRESOLVED ISSUES SUMMARY
===============================
Generated: ${new Date().toISOString()}

OVERVIEW
--------
Total Checklist Items: ${assignment.checklistItems.length}
Incomplete Items (no response): ${incompleteItems.length}
Items Marked "No" Without Remarks: ${noItemsWithoutRemarks.length}
Open Comments/Matters: ${openComments.length}
Clearance Status: ${assignment.partnerComment?.clearanceStatus || "Not determined"}

${incompleteItems.length > 0 ? `
INCOMPLETE CHECKLIST ITEMS
--------------------------
${incompleteItems.map((item, i) => `${i + 1}. Sr.${item.srNo} — ${item.checklistArea}: Response not yet provided`).join("\n")}
` : ""}
${noItemsWithoutRemarks.length > 0 ? `
"NO" RESPONSES REQUIRING REMARKS
---------------------------------
${noItemsWithoutRemarks.map((item, i) => `${i + 1}. Sr.${item.srNo} — ${item.checklistArea}: Marked "No" but no remarks documented`).join("\n")}
` : ""}
${openComments.length > 0 ? `
OPEN COMMENTS/MATTERS
---------------------
${openComments.map((c, i) => `${i + 1}. [${c.severity}] ${c.commentReference || "General"} — ${c.area || "N/A"}
   Comment: ${c.comment}
   Status: ${c.status}
   Raised By: ${c.createdBy?.fullName || "Unknown"} on ${new Date(c.createdAt).toLocaleDateString()}
   ${c.response ? `Response: ${c.response} by ${c.respondedBy?.fullName || "Unknown"}` : "No response yet"}
`).join("\n")}
` : ""}
RESOLUTION REQUIREMENTS
-----------------------
${incompleteItems.length > 0 ? "✗ All checklist items must have a response" : "✓ All checklist items responded"}
${noItemsWithoutRemarks.length > 0 ? "✗ Remarks required for all 'No' responses" : "✓ All 'No' items have remarks"}
${openComments.length > 0 ? "✗ All open comments must be addressed and cleared" : "✓ No open comments"}
${!assignment.partnerComment?.overallConclusion ? "✗ Overall conclusion not yet documented" : "✓ Overall conclusion documented"}
${!assignment.partnerComment?.clearanceStatus ? "✗ Clearance status not yet determined" : `✓ Clearance: ${assignment.partnerComment.clearanceStatus}`}

---
This summary was automatically generated by the AuditWise system.
`.trim();

    await logAuditTrail(
      req.user!.id,
      "EQCR_UNRESOLVED_SUMMARY_GENERATED",
      "AI-generated unresolved issues summary created",
      req.params.engagementId,
      {}
    );

    res.json({ summary, generatedAt: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to generate unresolved issues summary", details: error.message });
  }
});

router.get("/:engagementId/stats", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const assignment = await prisma.eQCRAssignment.findUnique({
      where: { engagementId: req.params.engagementId },
      include: {
        checklistItems: true,
        comments: true,
        partnerComment: true,
        signedReports: { where: { isCurrentVersion: true } },
      },
    });

    if (!assignment) {
      return res.json({
        exists: false,
        isRequired: false,
        status: "NOT_STARTED",
        totalItems: 0,
        completedItems: 0,
        noItemsWithoutRemarks: 0,
        openComments: 0,
        totalComments: 0,
        hasConclusion: false,
        hasClearance: false,
        clearanceStatus: null,
        hasSignedReport: false,
        isFinalized: false,
      });
    }

    const completedItems = assignment.checklistItems.filter(i => i.response).length;
    const noItemsWithoutRemarks = assignment.checklistItems.filter(i => i.response === "NO" && !i.remarks).length;
    const openComments = assignment.comments.filter(c => c.status !== "CLEARED").length;

    res.json({
      exists: true,
      isRequired: assignment.isRequired,
      status: assignment.status,
      totalItems: assignment.checklistItems.length,
      completedItems,
      noItemsWithoutRemarks,
      openComments,
      totalComments: assignment.comments.length,
      hasConclusion: !!assignment.partnerComment?.overallConclusion,
      hasClearance: !!assignment.partnerComment?.clearanceStatus,
      clearanceStatus: assignment.partnerComment?.clearanceStatus || null,
      hasSignedReport: assignment.signedReports.length > 0,
      isFinalized: assignment.isFinalized,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch EQCR stats", details: error.message });
  }
});

router.post("/:engagementId/partner-comments", requireAuth, requireMinRole("EQCR"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const assignment = await prisma.eQCRAssignment.findUnique({
      where: { engagementId: req.params.engagementId }
    });

    if (!assignment) return res.status(404).json({ error: "EQCR assignment not found" });
    if (assignment.isFinalized) return res.status(400).json({ error: "EQCR is finalized and cannot be modified" });

    const comment = await prisma.eQCRPartnerComment.upsert({
      where: { eqcrAssignmentId: assignment.id },
      update: {
        overallConclusion: req.body.overallConclusion,
        mattersForAttention: req.body.mattersForAttention,
        clearanceConditions: req.body.clearanceConditions,
        hasClearance: req.body.hasClearance,
        clearanceStatus: req.body.clearanceStatus
      },
      create: {
        eqcrAssignmentId: assignment.id,
        overallConclusion: req.body.overallConclusion,
        mattersForAttention: req.body.mattersForAttention,
        clearanceConditions: req.body.clearanceConditions,
        hasClearance: req.body.hasClearance,
        clearanceStatus: req.body.clearanceStatus,
        createdById: req.user!.id
      },
      include: { createdBy: { select: { id: true, fullName: true, role: true } } }
    });

    await logAuditTrail(
      req.user!.id,
      "EQCR_PARTNER_COMMENT_SAVED",
      "EQCR partner comments updated",
      req.params.engagementId,
      { hasClearance: req.body.hasClearance, clearanceStatus: req.body.clearanceStatus }
    );
    res.json(comment);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to save partner comments", details: error.message });
  }
});

router.post("/:engagementId/upload-signed-report", requireAuth, requireMinRole("EQCR"), upload.single("file"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) {
      fs.unlinkSync(file.path);
      return res.status(404).json({ error: access.error });
    }

    const assignment = await prisma.eQCRAssignment.findUnique({
      where: { engagementId: req.params.engagementId }
    });

    if (!assignment) {
      fs.unlinkSync(file.path);
      return res.status(404).json({ error: "EQCR assignment not found" });
    }

    if (assignment.isFinalized) {
      fs.unlinkSync(file.path);
      return res.status(400).json({ error: "EQCR is finalized and cannot be modified" });
    }

    const existingReports = await prisma.eQCRSignedReport.findMany({
      where: { eqcrAssignmentId: assignment.id },
      orderBy: { version: "desc" }
    });

    const nextVersion = existingReports.length > 0 ? existingReports[0].version + 1 : 1;

    await prisma.eQCRSignedReport.updateMany({
      where: { eqcrAssignmentId: assignment.id },
      data: { isCurrentVersion: false }
    });

    const report = await prisma.eQCRSignedReport.create({
      data: {
        eqcrAssignmentId: assignment.id,
        fileName: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        filePath: file.path,
        version: nextVersion,
        isCurrentVersion: true,
        uploadedById: req.user!.id
      },
      include: { uploadedBy: { select: { id: true, fullName: true } } }
    });

    await logAuditTrail(
      req.user!.id,
      "EQCR_SIGNED_REPORT_UPLOADED",
      `Uploaded signed EQCR report v${nextVersion}`,
      req.params.engagementId,
      { reportId: report.id, version: nextVersion }
    );
    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to upload signed report", details: error.message });
  }
});

router.post("/:engagementId/finalize", requireAuth, requireMinRole("EQCR"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const assignment = await prisma.eQCRAssignment.findUnique({
      where: { engagementId: req.params.engagementId },
      include: {
        checklistItems: true,
        comments: true,
        partnerComment: true,
        signedReports: { where: { isCurrentVersion: true } }
      }
    });

    if (!assignment) return res.status(404).json({ error: "EQCR assignment not found" });

    if (assignment.isFinalized) return res.status(400).json({ error: "EQCR is already finalized" });

    const incompleteItems = assignment.checklistItems.filter(item => !item.response);
    if (incompleteItems.length > 0) {
      return res.status(400).json({
        error: "All checklist items must have a response",
        incompleteCount: incompleteItems.length
      });
    }

    const noItemsWithoutRemarks = assignment.checklistItems.filter(
      item => item.response === "NO" && (!item.remarks || !item.remarks.trim())
    );
    if (noItemsWithoutRemarks.length > 0) {
      return res.status(400).json({
        error: "Remarks required for items with 'No' response",
        count: noItemsWithoutRemarks.length
      });
    }

    const unclearedComments = assignment.comments.filter(c => c.status !== "CLEARED");
    if (unclearedComments.length > 0) {
      return res.status(400).json({
        error: "All EQCR comments must be cleared before finalization",
        count: unclearedComments.length
      });
    }

    if (!assignment.partnerComment?.overallConclusion) {
      return res.status(400).json({ error: "EQCR Partner overall conclusion is required" });
    }

    if (!assignment.partnerComment?.clearanceStatus) {
      return res.status(400).json({ error: "EQCR Clearance Status must be selected" });
    }

    if (assignment.signedReports.length === 0) {
      return res.status(400).json({ error: "Signed EQCR report must be uploaded" });
    }

    const updated = await prisma.eQCRAssignment.update({
      where: { engagementId: req.params.engagementId },
      data: {
        isFinalized: true,
        finalizedAt: new Date(),
        finalizedById: req.user!.id,
        status: "CLEARED",
        clearanceDate: new Date(),
        reviewCompletedDate: new Date()
      }
    });

    await logAuditTrail(
      req.user!.id,
      "EQCR_FINALIZED",
      "EQCR review finalized and locked",
      req.params.engagementId,
      { assignmentId: assignment.id }
    );
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to finalize EQCR", details: error.message });
  }
});

router.post("/:engagementId/reopen", requireAuth, requireMinRole("PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    if (!req.body.reason) {
      return res.status(400).json({ error: "Reason for reopening is required" });
    }

    const assignment = await prisma.eQCRAssignment.update({
      where: { engagementId: req.params.engagementId },
      data: {
        isFinalized: false,
        status: "IN_PROGRESS"
      }
    });

    await logAuditTrail(
      req.user!.id,
      "EQCR_REOPENED",
      `EQCR reopened: ${req.body.reason}`,
      req.params.engagementId,
      { reason: req.body.reason }
    );
    res.json(assignment);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to reopen EQCR", details: error.message });
  }
});

router.post("/:engagementId/comments", requireAuth, requireMinRole("EQCR"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const assignment = await prisma.eQCRAssignment.findUnique({ where: { engagementId: req.params.engagementId } });
    if (!assignment) return res.status(404).json({ error: "EQCR assignment not found" });
    if (assignment.isFinalized) return res.status(400).json({ error: "EQCR is finalized and cannot be modified" });

    const comment = await prisma.eQCRComment.create({
      data: {
        eqcrAssignmentId: assignment.id,
        commentReference: req.body.commentReference,
        area: req.body.area,
        comment: req.body.comment,
        severity: req.body.severity || "INFO",
        createdById: req.user!.id
      },
      include: { createdBy: { select: { id: true, fullName: true, role: true } } }
    });

    await prisma.eQCRAssignment.update({
      where: { id: assignment.id },
      data: { status: "PENDING_CLEARANCE" }
    });

    await logAuditTrail(
      req.user!.id,
      "EQCR_COMMENT_ADDED",
      `EQCR comment: ${req.body.commentReference}`,
      req.params.engagementId,
      { commentId: comment.id }
    );
    res.status(201).json(comment);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to add comment", details: error.message });
  }
});

router.post("/:engagementId/comments/:commentId/respond", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const assignment = await prisma.eQCRAssignment.findUnique({ where: { engagementId: req.params.engagementId } });
    if (!assignment) return res.status(404).json({ error: "EQCR assignment not found" });
    if (assignment.isFinalized) return res.status(400).json({ error: "EQCR is finalized and cannot be modified" });

    const existingComment = await prisma.eQCRComment.findFirst({
      where: { id: req.params.commentId, eqcrAssignmentId: assignment.id }
    });
    if (!existingComment) return res.status(404).json({ error: "Comment not found for this engagement" });

    const comment = await prisma.eQCRComment.update({
      where: { id: req.params.commentId },
      data: {
        response: req.body.response,
        respondedById: req.user!.id,
        respondedDate: new Date(),
        status: "ADDRESSED"
      }
    });

    await logAuditTrail(
      req.user!.id,
      "EQCR_COMMENT_RESPONDED",
      "EQCR comment response",
      req.params.engagementId,
      { commentId: comment.id }
    );
    res.json(comment);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to respond", details: error.message });
  }
});

router.post("/:engagementId/comments/:commentId/clear", requireAuth, requireMinRole("EQCR"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const access = await validateEngagementAccess(req.params.engagementId, req.user!.firmId);
    if (!access.valid) return res.status(404).json({ error: access.error });

    const assignment = await prisma.eQCRAssignment.findUnique({ where: { engagementId: req.params.engagementId } });
    if (!assignment) return res.status(404).json({ error: "EQCR assignment not found" });
    if (assignment.isFinalized) return res.status(400).json({ error: "EQCR is finalized and cannot be modified" });

    const existingComment = await prisma.eQCRComment.findFirst({
      where: { id: req.params.commentId, eqcrAssignmentId: assignment.id }
    });
    if (!existingComment) return res.status(404).json({ error: "Comment not found for this engagement" });

    const comment = await prisma.eQCRComment.update({
      where: { id: req.params.commentId },
      data: { clearedById: req.user!.id, clearedDate: new Date(), status: "CLEARED" }
    });

    await logAuditTrail(
      req.user!.id,
      "EQCR_COMMENT_CLEARED",
      "EQCR comment cleared",
      req.params.engagementId,
      { commentId: comment.id }
    );
    res.json(comment);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to clear", details: error.message });
  }
});

router.get("/files/:fileName", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const filePath = path.join(UPLOAD_DIR, req.params.fileName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }
    res.sendFile(filePath);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to retrieve file", details: error.message });
  }
});

export default router;
