import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "./db";
import { requireAuth, requireRoles, AuthenticatedRequest } from "./auth";
import { logAuditTrail } from "./auth";

const router = Router();

// ============================================
// ENGAGEMENT LETTER MANAGEMENT (ISA 210)
// ============================================

const engagementLetterSchema = z.object({
  auditObjective: z.string().optional(),
  auditScope: z.string().optional(),
  managementResponsibilities: z.string().optional(),
  auditorResponsibilities: z.string().optional(),
  reportingRequirements: z.string().optional(),
  proposedFee: z.number().optional(),
  feeStructure: z.any().optional(),
  paymentTerms: z.string().optional(),
  engagementStartDate: z.string().optional().transform(s => s ? new Date(s) : undefined),
  engagementEndDate: z.string().optional().transform(s => s ? new Date(s) : undefined),
  reportingDeadline: z.string().optional().transform(s => s ? new Date(s) : undefined),
  specialTerms: z.string().optional(),
  limitationsOfScope: z.string().optional(),
});

// Generate letter reference
function generateLetterReference(engagementCode: string, version: number): string {
  const date = new Date();
  const year = date.getFullYear();
  return "EL-" + engagementCode + "-" + year + "-V" + version;
}

// Create engagement letter
router.post("/engagements/:engagementId/letters", requireAuth, requireRoles("MANAGER", "PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const data = engagementLetterSchema.parse(req.body);

    const engagement = await prisma.engagement.findFirst({
      where: { 
        id: engagementId,
        firmId: req.user!.firmId!
      },
      include: { client: true }
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    // Get existing letters count for versioning
    const existingLetters = await prisma.engagementLetter.count({
      where: { engagementId }
    });

    const version = existingLetters + 1;
    const letterReference = generateLetterReference(engagement.engagementCode, version);

    const letter = await prisma.engagementLetter.create({
      data: {
        engagementId,
        letterReference,
        version,
        auditObjective: data.auditObjective || generateDefaultAuditObjective(engagement),
        auditScope: data.auditScope || generateDefaultAuditScope(engagement),
        managementResponsibilities: data.managementResponsibilities || getDefaultManagementResponsibilities(),
        auditorResponsibilities: data.auditorResponsibilities || getDefaultAuditorResponsibilities(),
        reportingRequirements: data.reportingRequirements,
        proposedFee: data.proposedFee,
        feeStructure: data.feeStructure,
        paymentTerms: data.paymentTerms,
        engagementStartDate: data.engagementStartDate,
        engagementEndDate: data.engagementEndDate,
        reportingDeadline: data.reportingDeadline,
        specialTerms: data.specialTerms,
        limitationsOfScope: data.limitationsOfScope,
        status: "DRAFT",
        preparedById: req.user!.id,
      },
      include: {
        preparedBy: { select: { id: true, fullName: true } },
        engagement: { 
          select: { 
            engagementCode: true,
            client: { select: { name: true } }
          }
        }
      }
    });

    await logAuditTrail(
      req.user!.id,
      "ENGAGEMENT_LETTER_CREATED",
      "engagement_letter",
      letter.id,
      null,
      letter,
      engagementId,
      "Engagement letter draft created",
      req.ip,
      req.get("user-agent")
    );

    res.status(201).json(letter);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("Create engagement letter error:", error);
    res.status(500).json({ error: "Failed to create engagement letter" });
  }
});

function generateDefaultAuditObjective(engagement: any): string {
  return "To express an opinion on the financial statements of " + engagement.client.name + 
    " for the financial year ending " + (engagement.fiscalYearEnd ? new Date(engagement.fiscalYearEnd).toLocaleDateString() : "[Date]") +
    " in accordance with International Standards on Auditing (ISAs) and the Companies Act 2017.";
}

function generateDefaultAuditScope(engagement: any): string {
  return "Our audit will be conducted in accordance with International Standards on Auditing (ISAs) and will include:\n" +
    "- Examination of the financial statements including the statement of financial position, statement of profit or loss, statement of changes in equity, and statement of cash flows\n" +
    "- Assessment of the accounting policies applied and significant accounting estimates\n" +
    "- Evaluation of the overall presentation of the financial statements\n" +
    "- Testing of internal controls relevant to the audit\n" +
    "- Substantive testing of transactions and balances";
}

function getDefaultManagementResponsibilities(): string {
  return "Management is responsible for:\n" +
    "1. Preparation and fair presentation of the financial statements in accordance with applicable financial reporting framework\n" +
    "2. Design, implementation and maintenance of internal control relevant to preparation of financial statements\n" +
    "3. Prevention and detection of fraud\n" +
    "4. Selection and application of appropriate accounting policies\n" +
    "5. Making accounting estimates that are reasonable in the circumstances\n" +
    "6. Providing auditors with access to all information relevant to the audit\n" +
    "7. Providing written representations as required by ISA 580";
}

function getDefaultAuditorResponsibilities(): string {
  return "Our responsibilities include:\n" +
    "1. Conducting the audit in accordance with ISAs and reporting on the financial statements\n" +
    "2. Obtaining reasonable assurance about whether the financial statements are free from material misstatement\n" +
    "3. Communicating significant matters arising from the audit to those charged with governance\n" +
    "4. Forming an opinion on the financial statements based on audit evidence obtained\n" +
    "5. Maintaining independence and objectivity throughout the engagement";
}

// Get engagement letters
router.get("/engagements/:engagementId/letters", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    
    const letters = await prisma.engagementLetter.findMany({
      where: { engagementId },
      include: {
        preparedBy: { select: { id: true, fullName: true } },
        partnerApprovedBy: { select: { id: true, fullName: true } }
      },
      orderBy: { version: "desc" }
    });

    res.json(letters);
  } catch (error) {
    console.error("Get engagement letters error:", error);
    res.status(500).json({ error: "Failed to fetch engagement letters" });
  }
});

// Get single letter
router.get("/letters/:letterId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { letterId } = req.params;
    
    const letter = await prisma.engagementLetter.findUnique({
      where: { id: letterId },
      include: {
        preparedBy: { select: { id: true, fullName: true, email: true } },
        partnerApprovedBy: { select: { id: true, fullName: true, email: true } },
        engagement: {
          include: {
            client: true,
            firm: true
          }
        }
      }
    });

    if (!letter) {
      return res.status(404).json({ error: "Engagement letter not found" });
    }

    res.json(letter);
  } catch (error) {
    console.error("Get letter error:", error);
    res.status(500).json({ error: "Failed to fetch engagement letter" });
  }
});

// Update engagement letter
router.patch("/letters/:letterId", requireAuth, requireRoles("MANAGER", "PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { letterId } = req.params;
    const data = engagementLetterSchema.parse(req.body);

    const existing = await prisma.engagementLetter.findUnique({
      where: { id: letterId }
    });

    if (!existing) {
      return res.status(404).json({ error: "Engagement letter not found" });
    }

    if (existing.status !== "DRAFT" && existing.status !== "PENDING_APPROVAL") {
      return res.status(400).json({ error: "Cannot edit letter in current status" });
    }

    const letter = await prisma.engagementLetter.update({
      where: { id: letterId },
      data: {
        ...data,
        status: "DRAFT", // Reset to draft if edited
      }
    });

    await logAuditTrail(
      req.user!.id,
      "ENGAGEMENT_LETTER_UPDATED",
      "engagement_letter",
      letterId,
      existing,
      letter,
      existing.engagementId,
      "Engagement letter updated",
      req.ip,
      req.get("user-agent")
    );

    res.json(letter);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("Update letter error:", error);
    res.status(500).json({ error: "Failed to update engagement letter" });
  }
});

// Submit for partner approval
router.patch("/letters/:letterId/submit", requireAuth, requireRoles("MANAGER", "PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { letterId } = req.params;

    const existing = await prisma.engagementLetter.findUnique({
      where: { id: letterId }
    });

    if (!existing) {
      return res.status(404).json({ error: "Engagement letter not found" });
    }

    if (existing.status !== "DRAFT") {
      return res.status(400).json({ error: "Letter must be in draft status to submit" });
    }

    const letter = await prisma.engagementLetter.update({
      where: { id: letterId },
      data: { status: "PENDING_APPROVAL" }
    });

    await logAuditTrail(
      req.user!.id,
      "ENGAGEMENT_LETTER_SUBMITTED",
      "engagement_letter",
      letterId,
      existing,
      letter,
      existing.engagementId,
      "Engagement letter submitted for approval",
      req.ip,
      req.get("user-agent")
    );

    res.json(letter);
  } catch (error) {
    console.error("Submit letter error:", error);
    res.status(500).json({ error: "Failed to submit engagement letter" });
  }
});

// Partner approval
router.patch("/letters/:letterId/approve", requireAuth, requireRoles("PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { letterId } = req.params;

    const existing = await prisma.engagementLetter.findUnique({
      where: { id: letterId }
    });

    if (!existing) {
      return res.status(404).json({ error: "Engagement letter not found" });
    }

    if (existing.status !== "PENDING_APPROVAL") {
      return res.status(400).json({ error: "Letter must be pending approval" });
    }

    const letter = await prisma.engagementLetter.update({
      where: { id: letterId },
      data: {
        status: "APPROVED",
        partnerApprovedById: req.user!.id,
        partnerApprovalDate: new Date(),
      }
    });

    await logAuditTrail(
      req.user!.id,
      "ENGAGEMENT_LETTER_APPROVED",
      "engagement_letter",
      letterId,
      existing,
      letter,
      existing.engagementId,
      "Engagement letter approved by partner",
      req.ip,
      req.get("user-agent")
    );

    res.json(letter);
  } catch (error) {
    console.error("Approve letter error:", error);
    res.status(500).json({ error: "Failed to approve engagement letter" });
  }
});

// Mark as sent to client
router.patch("/letters/:letterId/send", requireAuth, requireRoles("PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { letterId } = req.params;

    const existing = await prisma.engagementLetter.findUnique({
      where: { id: letterId }
    });

    if (!existing) {
      return res.status(404).json({ error: "Engagement letter not found" });
    }

    if (existing.status !== "APPROVED") {
      return res.status(400).json({ error: "Letter must be approved before sending" });
    }

    const letter = await prisma.engagementLetter.update({
      where: { id: letterId },
      data: {
        status: "SENT",
        sentToClientDate: new Date(),
      }
    });

    await logAuditTrail(
      req.user!.id,
      "ENGAGEMENT_LETTER_SENT",
      "engagement_letter",
      letterId,
      existing,
      letter,
      existing.engagementId,
      "Engagement letter sent to client",
      req.ip,
      req.get("user-agent")
    );

    res.json(letter);
  } catch (error) {
    console.error("Send letter error:", error);
    res.status(500).json({ error: "Failed to mark letter as sent" });
  }
});

// Record client acceptance
router.patch("/letters/:letterId/client-response", requireAuth, requireRoles("MANAGER", "PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { letterId } = req.params;
    const { accepted, signatory, rejectionReason } = req.body;

    const existing = await prisma.engagementLetter.findUnique({
      where: { id: letterId }
    });

    if (!existing) {
      return res.status(404).json({ error: "Engagement letter not found" });
    }

    if (existing.status !== "SENT") {
      return res.status(400).json({ error: "Letter must be sent to client first" });
    }

    const letter = await prisma.engagementLetter.update({
      where: { id: letterId },
      data: {
        status: accepted ? "ACCEPTED" : "REJECTED",
        clientSignatory: signatory,
        clientAcceptedDate: accepted ? new Date() : undefined,
        clientRejectedDate: !accepted ? new Date() : undefined,
        clientRejectionReason: !accepted ? rejectionReason : undefined,
      }
    });

    // If accepted, update engagement status
    if (accepted) {
      await prisma.engagement.update({
        where: { id: existing.engagementId },
        data: { status: "ACTIVE" }
      });
    }

    await logAuditTrail(
      req.user!.id,
      accepted ? "ENGAGEMENT_LETTER_ACCEPTED" : "ENGAGEMENT_LETTER_REJECTED",
      "engagement_letter",
      letterId,
      existing,
      letter,
      existing.engagementId,
      "Client " + (accepted ? "accepted" : "rejected") + " engagement letter",
      req.ip,
      req.get("user-agent")
    );

    res.json(letter);
  } catch (error) {
    console.error("Client response error:", error);
    res.status(500).json({ error: "Failed to record client response" });
  }
});

// Generate letter PDF content
router.get("/letters/:letterId/generate", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { letterId } = req.params;
    
    const letter = await prisma.engagementLetter.findUnique({
      where: { id: letterId },
      include: {
        engagement: {
          include: {
            client: true,
            firm: true
          }
        },
        preparedBy: { select: { fullName: true } },
        partnerApprovedBy: { select: { fullName: true } }
      }
    });

    if (!letter) {
      return res.status(404).json({ error: "Engagement letter not found" });
    }

    const content = {
      letterReference: letter.letterReference,
      date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
      firmName: letter.engagement.firm.name,
      firmAddress: letter.engagement.firm.address,
      clientName: letter.engagement.client.name,
      clientAddress: letter.engagement.client.address,
      sections: [
        { title: "Audit Objective", content: letter.auditObjective },
        { title: "Scope of Audit", content: letter.auditScope },
        { title: "Management Responsibilities", content: letter.managementResponsibilities },
        { title: "Auditor Responsibilities", content: letter.auditorResponsibilities },
        { title: "Reporting Requirements", content: letter.reportingRequirements },
        { title: "Fees and Payment Terms", content: letter.proposedFee ? "Proposed Fee: PKR " + letter.proposedFee.toLocaleString() + "\n" + (letter.paymentTerms || "") : null },
        { title: "Engagement Period", content: letter.engagementStartDate && letter.engagementEndDate ? 
          "From " + new Date(letter.engagementStartDate).toLocaleDateString() + " to " + new Date(letter.engagementEndDate).toLocaleDateString() : null },
        { title: "Special Terms", content: letter.specialTerms },
        { title: "Limitations of Scope", content: letter.limitationsOfScope },
      ].filter(s => s.content),
      footer: {
        preparedBy: letter.preparedBy?.fullName,
        approvedBy: letter.partnerApprovedBy?.fullName,
        isaReference: "ISA 210 - Agreeing the Terms of Audit Engagements"
      }
    };

    res.json(content);
  } catch (error) {
    console.error("Generate letter error:", error);
    res.status(500).json({ error: "Failed to generate letter content" });
  }
});

export default router;
