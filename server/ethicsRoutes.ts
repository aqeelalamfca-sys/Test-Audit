import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "./db";
import { requireAuth, requireRoles, AuthenticatedRequest } from "./auth";
import { logAuditTrail } from "./auth";

const router = Router();

// ============================================
// CLIENT ACCEPTANCE (ISA 210)
// ============================================

// Validate NTN format (Pakistan National Tax Number)
function validateNTN(ntn: string): { valid: boolean; message: string } {
  const ntnPattern = /^\d{7}-\d$/;
  if (!ntnPattern.test(ntn)) {
    return { valid: false, message: "NTN must be in format XXXXXXX-X (7 digits, hyphen, 1 digit)" };
  }
  return { valid: true, message: "Valid NTN format" };
}

// Validate STRN format (Sales Tax Registration Number)
function validateSTRN(strn: string): { valid: boolean; message: string } {
  const strnPattern = /^\d{13}$/;
  if (!strnPattern.test(strn)) {
    return { valid: false, message: "STRN must be 13 digits" };
  }
  return { valid: true, message: "Valid STRN format" };
}

// Validate SECP Registration Number format
function validateSECPNo(secpNo: string): { valid: boolean; message: string } {
  const patterns = [
    /^[A-Z]{3}\d{6}$/, // Limited company format
    /^\d{7}$/, // Numeric format
    /^[A-Z]\d{6}$/, // Alternative format
  ];
  
  if (patterns.some(p => p.test(secpNo))) {
    return { valid: true, message: "Valid SECP registration format" };
  }
  return { valid: false, message: "Invalid SECP registration number format" };
}

// Entity Verification endpoint
router.post("/clients/:clientId/verify-entity", requireAuth, requireRoles("MANAGER", "PARTNER", "FIRM_ADMIN"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { clientId } = req.params;
    const client = await prisma.client.findFirst({
      where: { 
        id: clientId,
        firmId: req.user!.role === "FIRM_ADMIN" ? undefined : req.user!.firmId!
      }
    });

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    const verificationResults: any = {
      clientId,
      clientName: client.name,
      verificationDate: new Date(),
      verifiedBy: req.user!.id,
      checks: []
    };

    // NTN Validation
    if (client.ntn) {
      const ntnResult = validateNTN(client.ntn);
      verificationResults.checks.push({
        type: "NTN",
        value: client.ntn,
        status: ntnResult.valid ? "VALID" : "INVALID",
        message: ntnResult.message,
        reference: "Companies Act 2017, Section 226"
      });
    }

    // STRN Validation
    if (client.strn) {
      const strnResult = validateSTRN(client.strn);
      verificationResults.checks.push({
        type: "STRN",
        value: client.strn,
        status: strnResult.valid ? "VALID" : "INVALID",
        message: strnResult.message,
        reference: "Sales Tax Act 1990"
      });
    }

    // SECP Registration Validation
    if (client.secpNo) {
      const secpResult = validateSECPNo(client.secpNo);
      verificationResults.checks.push({
        type: "SECP",
        value: client.secpNo,
        status: secpResult.valid ? "VALID" : "INVALID",
        message: secpResult.message,
        reference: "Companies Act 2017, Section 223"
      });
    }

    // Overall verification status
    const allValid = verificationResults.checks.every((c: any) => c.status === "VALID");
    verificationResults.overallStatus = allValid ? "VERIFIED" : "REQUIRES_REVIEW";

    await logAuditTrail(
      req.user!.id,
      "ENTITY_VERIFICATION",
      "client",
      clientId,
      null,
      verificationResults,
      undefined,
      "Entity verification performed",
      req.ip,
      req.get("user-agent")
    );

    res.json(verificationResults);
  } catch (error) {
    console.error("Entity verification error:", error);
    res.status(500).json({ error: "Failed to verify entity" });
  }
});

// Conflict of Interest Check
const conflictCheckSchema = z.object({
  conflictType: z.enum(["FINANCIAL_INTEREST", "BUSINESS_RELATIONSHIP", "FAMILY_RELATIONSHIP", "PRIOR_EMPLOYMENT", "NON_AUDIT_SERVICE", "OTHER"]),
  description: z.string().min(1),
  affectedUserId: z.string().optional(),
  affectedPartyName: z.string().optional(),
  relationshipDetails: z.string().optional(),
});

router.post("/clients/:clientId/conflict-checks", requireAuth, requireRoles("SENIOR", "MANAGER", "PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { clientId } = req.params;
    const data = conflictCheckSchema.parse(req.body);

    const client = await prisma.client.findFirst({
      where: { 
        id: clientId,
        firmId: req.user!.firmId!
      }
    });

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    const conflict = await prisma.conflictOfInterest.create({
      data: {
        clientId,
        firmId: req.user!.firmId!,
        conflictType: data.conflictType,
        description: data.description,
        affectedUserId: data.affectedUserId,
        affectedPartyName: data.affectedPartyName,
        relationshipDetails: data.relationshipDetails,
        identifiedById: req.user!.id,
        status: "IDENTIFIED",
      },
      include: {
        identifiedBy: { select: { id: true, fullName: true, email: true } },
        affectedUser: { select: { id: true, fullName: true, email: true } },
      }
    });

    await logAuditTrail(
      req.user!.id,
      "CONFLICT_IDENTIFIED",
      "conflict_of_interest",
      conflict.id,
      null,
      conflict,
      undefined,
      "Conflict of interest identified: " + data.conflictType,
      req.ip,
      req.get("user-agent")
    );

    res.status(201).json(conflict);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("Conflict check error:", error);
    res.status(500).json({ error: "Failed to create conflict check" });
  }
});

// Get conflicts for a client
router.get("/clients/:clientId/conflict-checks", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { clientId } = req.params;
    
    const conflicts = await prisma.conflictOfInterest.findMany({
      where: { 
        clientId,
        firmId: req.user!.role === "FIRM_ADMIN" ? undefined : req.user!.firmId!
      },
      include: {
        identifiedBy: { select: { id: true, fullName: true, email: true } },
        reviewedBy: { select: { id: true, fullName: true, email: true } },
        partnerApprovedBy: { select: { id: true, fullName: true, email: true } },
        affectedUser: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: "desc" }
    });

    res.json(conflicts);
  } catch (error) {
    console.error("Get conflicts error:", error);
    res.status(500).json({ error: "Failed to fetch conflicts" });
  }
});

// Resolve conflict
router.patch("/conflicts/:conflictId/resolve", requireAuth, requireRoles("MANAGER", "PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { conflictId } = req.params;
    const { safeguardsApplied, safeguardEffectiveness, reviewNotes } = req.body;

    const existing = await prisma.conflictOfInterest.findFirst({
      where: { 
        id: conflictId,
        firmId: req.user!.role === "FIRM_ADMIN" ? undefined : req.user!.firmId!
      }
    });

    if (!existing) {
      return res.status(404).json({ error: "Conflict not found" });
    }

    const conflict = await prisma.conflictOfInterest.update({
      where: { id: conflictId },
      data: {
        status: "SAFEGUARDED",
        safeguardsApplied,
        safeguardEffectiveness,
        reviewedById: req.user!.id,
        reviewedDate: new Date(),
        reviewNotes,
      },
      include: {
        identifiedBy: { select: { id: true, fullName: true } },
        reviewedBy: { select: { id: true, fullName: true } },
      }
    });

    await logAuditTrail(
      req.user!.id,
      "CONFLICT_RESOLVED",
      "conflict_of_interest",
      conflictId,
      existing,
      conflict,
      undefined,
      "Conflict of interest resolved with safeguards",
      req.ip,
      req.get("user-agent")
    );

    res.json(conflict);
  } catch (error) {
    console.error("Resolve conflict error:", error);
    res.status(500).json({ error: "Failed to resolve conflict" });
  }
});

// Partner approval for conflict
router.patch("/conflicts/:conflictId/partner-approve", requireAuth, requireRoles("PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { conflictId } = req.params;
    const { decision, notes } = req.body;

    const existing = await prisma.conflictOfInterest.findFirst({
      where: { 
        id: conflictId,
        firmId: req.user!.firmId!
      }
    });

    if (!existing) {
      return res.status(404).json({ error: "Conflict not found" });
    }

    const conflict = await prisma.conflictOfInterest.update({
      where: { id: conflictId },
      data: {
        status: decision === "ACCEPT" ? "ACCEPTED" : "REJECTED",
        partnerApprovedById: req.user!.id,
        partnerApprovalDate: new Date(),
        partnerDecision: decision,
        resolutionNotes: notes,
        resolutionDate: new Date(),
      }
    });

    await logAuditTrail(
      req.user!.id,
      decision === "ACCEPT" ? "CONFLICT_APPROVED" : "CONFLICT_REJECTED",
      "conflict_of_interest",
      conflictId,
      existing,
      conflict,
      undefined,
      "Partner " + (decision === "ACCEPT" ? "approved" : "rejected") + " conflict resolution",
      req.ip,
      req.get("user-agent")
    );

    res.json(conflict);
  } catch (error) {
    console.error("Partner approval error:", error);
    res.status(500).json({ error: "Failed to process partner approval" });
  }
});

// Client Acceptance Decision
const acceptanceDecisionSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  memo: z.string().min(10, "Acceptance memo must be at least 10 characters"),
  riskCategory: z.enum(["LOW", "NORMAL", "HIGH", "PROHIBITED"]).optional(),
});

router.patch("/clients/:clientId/acceptance-decision", requireAuth, requireRoles("PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { clientId } = req.params;
    const data = acceptanceDecisionSchema.parse(req.body);

    const existing = await prisma.client.findFirst({
      where: { 
        id: clientId,
        firmId: req.user!.firmId!
      }
    });

    if (!existing) {
      return res.status(404).json({ error: "Client not found" });
    }

    // Check for unresolved conflicts
    const unresolvedConflicts = await prisma.conflictOfInterest.count({
      where: {
        clientId,
        status: { in: ["IDENTIFIED", "UNDER_REVIEW"] }
      }
    });

    if (data.decision === "APPROVED" && unresolvedConflicts > 0) {
      return res.status(400).json({ 
        error: "Cannot approve client with unresolved conflicts",
        unresolvedConflicts
      });
    }

    const client = await prisma.client.update({
      where: { id: clientId },
      data: {
        acceptanceStatus: data.decision,
        acceptanceDate: new Date(),
        acceptanceApprovedById: req.user!.id,
        acceptanceMemo: data.memo,
        riskCategory: data.riskCategory || existing.riskCategory,
      }
    });

    await logAuditTrail(
      req.user!.id,
      data.decision === "APPROVED" ? "CLIENT_ACCEPTED" : "CLIENT_REJECTED",
      "client",
      clientId,
      existing,
      client,
      undefined,
      "Client " + data.decision.toLowerCase() + " by partner",
      req.ip,
      req.get("user-agent")
    );

    res.json(client);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("Acceptance decision error:", error);
    res.status(500).json({ error: "Failed to process acceptance decision" });
  }
});

// ============================================
// PREVIOUS AUDITOR COMMUNICATION (ISA 300/510)
// ============================================

const prevAuditorCommSchema = z.object({
  previousAuditorName: z.string().min(1),
  previousAuditorFirm: z.string().optional(),
  previousAuditorContact: z.string().optional(),
  communicationType: z.string().min(1),
  communicationDate: z.string().transform(s => new Date(s)),
  responseReceived: z.boolean().default(false),
  responseDate: z.string().optional().transform(s => s ? new Date(s) : undefined),
  responseContent: z.string().optional(),
  disagreementsNoted: z.boolean().default(false),
  disagreementDetails: z.string().optional(),
  accessToWorkpapers: z.boolean().default(false),
  accessNotes: z.string().optional(),
  significantMatters: z.string().optional(),
  impactOnAcceptance: z.string().optional(),
});

router.post("/engagements/:engagementId/previous-auditor-comm", requireAuth, requireRoles("MANAGER", "PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const data = prevAuditorCommSchema.parse(req.body);

    const engagement = await prisma.engagement.findFirst({
      where: { 
        id: engagementId,
        firmId: req.user!.firmId!
      }
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const comm = await prisma.previousAuditorCommunication.create({
      data: {
        clientId: engagement.clientId,
        engagementId,
        previousAuditorName: data.previousAuditorName,
        previousAuditorFirm: data.previousAuditorFirm,
        previousAuditorContact: data.previousAuditorContact,
        communicationType: data.communicationType,
        communicationDate: data.communicationDate,
        responseReceived: data.responseReceived,
        responseDate: data.responseDate,
        responseContent: data.responseContent,
        disagreementsNoted: data.disagreementsNoted,
        disagreementDetails: data.disagreementDetails,
        accessToWorkpapers: data.accessToWorkpapers,
        accessNotes: data.accessNotes,
        significantMatters: data.significantMatters,
        impactOnAcceptance: data.impactOnAcceptance,
        preparedById: req.user!.id,
      },
      include: {
        preparedBy: { select: { id: true, fullName: true } }
      }
    });

    await logAuditTrail(
      req.user!.id,
      "PREV_AUDITOR_COMM_CREATED",
      "previous_auditor_communication",
      comm.id,
      null,
      comm,
      engagementId,
      "Previous auditor communication documented",
      req.ip,
      req.get("user-agent")
    );

    res.status(201).json(comm);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("Previous auditor comm error:", error);
    res.status(500).json({ error: "Failed to create previous auditor communication" });
  }
});

router.get("/engagements/:engagementId/previous-auditor-comm", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    
    const comms = await prisma.previousAuditorCommunication.findMany({
      where: { engagementId },
      include: {
        preparedBy: { select: { id: true, fullName: true, email: true } }
      },
      orderBy: { communicationDate: "desc" }
    });

    res.json(comms);
  } catch (error) {
    console.error("Get previous auditor comm error:", error);
    res.status(500).json({ error: "Failed to fetch previous auditor communications" });
  }
});

// ============================================
// INDEPENDENCE ASSESSMENT (IESBA CODE)
// ============================================

// Get independence declarations for engagement
router.get("/engagements/:engagementId/independence-declarations", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    
    const declarations = await prisma.independenceDeclaration.findMany({
      where: { engagementId },
      include: {
        user: { select: { id: true, fullName: true, email: true, role: true } },
        partner: { select: { id: true, fullName: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    res.json(declarations);
  } catch (error) {
    console.error("Get declarations error:", error);
    res.status(500).json({ error: "Failed to fetch independence declarations" });
  }
});

// Submit independence declaration
const declarationSchema = z.object({
  hasFinancialInterest: z.boolean().default(false),
  financialInterestDetails: z.string().optional(),
  hasBusinessRelationship: z.boolean().default(false),
  businessRelationshipDetails: z.string().optional(),
  hasFamilyRelationship: z.boolean().default(false),
  familyRelationshipDetails: z.string().optional(),
  hasPriorService: z.boolean().default(false),
  priorServiceDetails: z.string().optional(),
  hasOtherThreat: z.boolean().default(false),
  otherThreatDetails: z.string().optional(),
  confirmationStatement: z.string().min(1),
});

router.post("/engagements/:engagementId/independence-declarations", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const data = declarationSchema.parse(req.body);

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId }
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    // Check if user is on the team
    const teamMember = await prisma.engagementTeam.findFirst({
      where: {
        engagementId,
        userId: req.user!.id
      }
    });

    if (!teamMember && req.user!.role !== "FIRM_ADMIN" && req.user!.role !== "PARTNER") {
      return res.status(403).json({ error: "You must be on the engagement team to submit a declaration" });
    }

    // Check if declaration already exists
    const existing = await prisma.independenceDeclaration.findFirst({
      where: {
        engagementId,
        userId: req.user!.id
      }
    });

    if (existing) {
      return res.status(400).json({ error: "Declaration already submitted. Use update endpoint to modify." });
    }

    const declaration = await prisma.independenceDeclaration.create({
      data: {
        engagementId,
        userId: req.user!.id,
        ...data,
        status: "CONFIRMED",
        confirmedAtStart: true,
        confirmedAtStartDate: new Date(),
      },
      include: {
        user: { select: { id: true, fullName: true, email: true } }
      }
    });

    await logAuditTrail(
      req.user!.id,
      "INDEPENDENCE_DECLARATION_SUBMITTED",
      "independence_declaration",
      declaration.id,
      null,
      declaration,
      engagementId,
      "Independence declaration submitted",
      req.ip,
      req.get("user-agent")
    );

    res.status(201).json(declaration);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("Submit declaration error:", error);
    res.status(500).json({ error: "Failed to submit independence declaration" });
  }
});

// Partner approval for declaration
router.patch("/declarations/:declarationId/partner-approve", requireAuth, requireRoles("PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { declarationId } = req.params;
    const { comments } = req.body;

    const existing = await prisma.independenceDeclaration.findUnique({
      where: { id: declarationId }
    });

    if (!existing) {
      return res.status(404).json({ error: "Declaration not found" });
    }

    const declaration = await prisma.independenceDeclaration.update({
      where: { id: declarationId },
      data: {
        partnerId: req.user!.id,
        partnerApprovalDate: new Date(),
        partnerComments: comments,
      },
      include: {
        user: { select: { id: true, fullName: true } },
        partner: { select: { id: true, fullName: true } }
      }
    });

    await logAuditTrail(
      req.user!.id,
      "DECLARATION_PARTNER_APPROVED",
      "independence_declaration",
      declarationId,
      existing,
      declaration,
      existing.engagementId,
      "Partner approved independence declaration",
      req.ip,
      req.get("user-agent")
    );

    res.json(declaration);
  } catch (error) {
    console.error("Partner approval error:", error);
    res.status(500).json({ error: "Failed to approve declaration" });
  }
});

// ============================================
// THREAT REGISTER & SAFEGUARDS
// ============================================

// Get threats for engagement
router.get("/engagements/:engagementId/threats", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    
    const threats = await prisma.threatRegister.findMany({
      where: { engagementId },
      include: {
        identifiedBy: { select: { id: true, fullName: true } },
        resolvedBy: { select: { id: true, fullName: true } },
        partnerApprovedBy: { select: { id: true, fullName: true } },
        safeguards: {
          include: {
            implementedBy: { select: { id: true, fullName: true } },
            verifiedBy: { select: { id: true, fullName: true } }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    res.json(threats);
  } catch (error) {
    console.error("Get threats error:", error);
    res.status(500).json({ error: "Failed to fetch threats" });
  }
});

// Create threat
const threatSchema = z.object({
  category: z.enum(["SELF_INTEREST", "SELF_REVIEW", "ADVOCACY", "FAMILIARITY", "INTIMIDATION"]),
  description: z.string().min(10),
  severity: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  affectedParties: z.array(z.string()).default([]),
  isaReference: z.string().optional(),
});

router.post("/engagements/:engagementId/threats", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const data = threatSchema.parse(req.body);

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId }
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const threat = await prisma.threatRegister.create({
      data: {
        engagementId,
        category: data.category,
        description: data.description,
        severity: data.severity,
        affectedParties: data.affectedParties,
        isaReference: data.isaReference || "IESBA Code - " + data.category,
        identifiedById: req.user!.id,
        status: "IDENTIFIED",
      },
      include: {
        identifiedBy: { select: { id: true, fullName: true } }
      }
    });

    await logAuditTrail(
      req.user!.id,
      "THREAT_IDENTIFIED",
      "threat_register",
      threat.id,
      null,
      threat,
      engagementId,
      "Independence threat identified: " + data.category,
      req.ip,
      req.get("user-agent")
    );

    res.status(201).json(threat);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("Create threat error:", error);
    res.status(500).json({ error: "Failed to create threat" });
  }
});

// Add safeguard to threat
const safeguardSchema = z.object({
  description: z.string().min(10),
  safeguardType: z.string().min(1),
  evidenceDescription: z.string().optional(),
  effectiveness: z.string().optional(),
});

router.post("/threats/:threatId/safeguards", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { threatId } = req.params;
    const data = safeguardSchema.parse(req.body);

    const threat = await prisma.threatRegister.findUnique({
      where: { id: threatId }
    });

    if (!threat) {
      return res.status(404).json({ error: "Threat not found" });
    }

    const safeguard = await prisma.safeguard.create({
      data: {
        threatId,
        engagementId: threat.engagementId,
        description: data.description,
        safeguardType: data.safeguardType,
        evidenceDescription: data.evidenceDescription,
        effectiveness: data.effectiveness,
        implementedById: req.user!.id,
        isaReference: "IESBA Code - Safeguards",
      },
      include: {
        implementedBy: { select: { id: true, fullName: true } }
      }
    });

    // Update threat status to SAFEGUARDED if it was just IDENTIFIED
    if (threat.status === "IDENTIFIED") {
      await prisma.threatRegister.update({
        where: { id: threatId },
        data: { status: "SAFEGUARDED" }
      });
    }

    await logAuditTrail(
      req.user!.id,
      "SAFEGUARD_IMPLEMENTED",
      "safeguard",
      safeguard.id,
      null,
      safeguard,
      threat.engagementId,
      "Safeguard implemented for threat",
      req.ip,
      req.get("user-agent")
    );

    res.status(201).json(safeguard);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("Create safeguard error:", error);
    res.status(500).json({ error: "Failed to create safeguard" });
  }
});

// Partner approval for threat resolution
router.patch("/threats/:threatId/partner-approve", requireAuth, requireRoles("PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { threatId } = req.params;
    const { decision, comments } = req.body;

    const existing = await prisma.threatRegister.findUnique({
      where: { id: threatId },
      include: { safeguards: true }
    });

    if (!existing) {
      return res.status(404).json({ error: "Threat not found" });
    }

    if (existing.safeguards.length === 0 && decision === "ACCEPT") {
      return res.status(400).json({ error: "Cannot approve threat without safeguards" });
    }

    const threat = await prisma.threatRegister.update({
      where: { id: threatId },
      data: {
        status: decision === "ACCEPT" ? "ACCEPTED" : "ELIMINATED",
        partnerApprovedById: req.user!.id,
        partnerApprovalDate: new Date(),
        partnerComments: comments,
        resolvedById: req.user!.id,
        resolvedDate: new Date(),
        resolutionNotes: comments,
      }
    });

    await logAuditTrail(
      req.user!.id,
      "THREAT_PARTNER_APPROVED",
      "threat_register",
      threatId,
      existing,
      threat,
      existing.engagementId,
      "Partner " + (decision === "ACCEPT" ? "accepted" : "eliminated") + " threat",
      req.ip,
      req.get("user-agent")
    );

    res.json(threat);
  } catch (error) {
    console.error("Threat partner approval error:", error);
    res.status(500).json({ error: "Failed to process partner approval" });
  }
});

// ============================================
// NON-AUDIT SERVICES TRACKING
// ============================================

const nonAuditServiceSchema = z.object({
  serviceName: z.string().min(1),
  serviceDescription: z.string().optional(),
  serviceType: z.string().min(1),
  startDate: z.string().optional().transform(s => s ? new Date(s) : undefined),
  endDate: z.string().optional().transform(s => s ? new Date(s) : undefined),
  isOngoing: z.boolean().default(false),
  feeAmount: z.number().optional(),
  threatCategory: z.enum(["SELF_INTEREST", "SELF_REVIEW", "ADVOCACY", "FAMILIARITY", "INTIMIDATION"]).optional(),
  threatLevel: z.string().optional(),
  safeguardsApplied: z.string().optional(),
  independenceImpact: z.string().optional(),
  prohibitedService: z.boolean().default(false),
  prohibitionReason: z.string().optional(),
});

router.post("/clients/:clientId/non-audit-services", requireAuth, requireRoles("MANAGER", "PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { clientId } = req.params;
    const data = nonAuditServiceSchema.parse(req.body);

    const client = await prisma.client.findFirst({
      where: { 
        id: clientId,
        firmId: req.user!.firmId!
      }
    });

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    const service = await prisma.nonAuditService.create({
      data: {
        clientId,
        firmId: req.user!.firmId!,
        serviceName: data.serviceName,
        serviceDescription: data.serviceDescription,
        serviceType: data.serviceType,
        startDate: data.startDate,
        endDate: data.endDate,
        isOngoing: data.isOngoing,
        feeAmount: data.feeAmount,
        threatCategory: data.threatCategory,
        threatLevel: data.threatLevel,
        safeguardsApplied: data.safeguardsApplied,
        independenceImpact: data.independenceImpact,
        prohibitedService: data.prohibitedService,
        prohibitionReason: data.prohibitionReason,
      },
      include: {
        client: { select: { id: true, name: true } }
      }
    });

    await logAuditTrail(
      req.user!.id,
      "NON_AUDIT_SERVICE_CREATED",
      "non_audit_service",
      service.id,
      null,
      service,
      undefined,
      "Non-audit service recorded: " + data.serviceName,
      req.ip,
      req.get("user-agent")
    );

    res.status(201).json(service);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("Non-audit service error:", error);
    res.status(500).json({ error: "Failed to create non-audit service" });
  }
});

router.get("/clients/:clientId/non-audit-services", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { clientId } = req.params;
    
    const services = await prisma.nonAuditService.findMany({
      where: { 
        clientId,
        firmId: req.user!.role === "FIRM_ADMIN" ? undefined : req.user!.firmId!
      },
      include: {
        approvedBy: { select: { id: true, fullName: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    res.json(services);
  } catch (error) {
    console.error("Get non-audit services error:", error);
    res.status(500).json({ error: "Failed to fetch non-audit services" });
  }
});

// Partner approval for non-audit service
router.patch("/non-audit-services/:serviceId/approve", requireAuth, requireRoles("PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { serviceId } = req.params;
    const { notes } = req.body;

    const existing = await prisma.nonAuditService.findFirst({
      where: { 
        id: serviceId,
        firmId: req.user!.firmId!
      }
    });

    if (!existing) {
      return res.status(404).json({ error: "Non-audit service not found" });
    }

    if (existing.prohibitedService) {
      return res.status(400).json({ error: "Cannot approve prohibited service" });
    }

    const service = await prisma.nonAuditService.update({
      where: { id: serviceId },
      data: {
        approvedById: req.user!.id,
        approvalDate: new Date(),
        approvalNotes: notes,
      }
    });

    await logAuditTrail(
      req.user!.id,
      "NON_AUDIT_SERVICE_APPROVED",
      "non_audit_service",
      serviceId,
      existing,
      service,
      undefined,
      "Non-audit service approved by partner",
      req.ip,
      req.get("user-agent")
    );

    res.json(service);
  } catch (error) {
    console.error("Approve non-audit service error:", error);
    res.status(500).json({ error: "Failed to approve non-audit service" });
  }
});

// ============================================
// ACCEPTANCE PHASE DATA (Save/Load form data as JSON blob)
// ============================================

router.get("/engagements/:engagementId/acceptance-data", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;

    const decision = await prisma.acceptanceContinuanceDecision.findUnique({
      where: { engagementId },
    });

    if (!decision) {
      return res.json({ exists: false, data: null });
    }

    res.json({ exists: true, data: decision });
  } catch (error) {
    console.error("Get acceptance data error:", error);
    res.status(500).json({ error: "Failed to fetch acceptance data" });
  }
});

router.put("/engagements/:engagementId/acceptance-data", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { formData } = req.body;

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const existing = await prisma.acceptanceContinuanceDecision.findUnique({
      where: { engagementId },
    });

    let result;
    if (existing) {
      result = await prisma.acceptanceContinuanceDecision.update({
        where: { engagementId },
        data: {
          isNewClient: formData.isNewClient ?? existing.isNewClient,
          isReengagement: formData.isReengagement ?? existing.isReengagement,
          clientIntegrityRating: formData.clientIntegrityRating,
          clientIntegrityNotes: formData.clientIntegrityNotes,
          managementIntegrityRating: formData.managementIntegrityRating,
          managementIntegrityNotes: formData.managementIntegrityNotes,
          engagementRiskLevel: formData.engagementRiskLevel,
          engagementRiskFactors: formData.engagementRiskFactors,
          priorAuditorContacted: formData.priorAuditorContacted ?? false,
          priorAuditorContactDate: formData.priorAuditorContactDate ? new Date(formData.priorAuditorContactDate) : null,
          priorAuditorResponse: formData.priorAuditorResponse,
          priorAuditorConcerns: formData.priorAuditorConcerns,
          competenceConfirmed: formData.competenceConfirmed ?? false,
          competenceNotes: formData.competenceNotes,
          resourcesAvailable: formData.resourcesAvailable ?? false,
          resourcesNotes: formData.resourcesNotes,
          independenceCleared: formData.independenceCleared ?? false,
          independenceClearanceDate: formData.independenceClearanceDate ? new Date(formData.independenceClearanceDate) : null,
          independenceIssues: formData.independenceIssues,
          ethicalRequirementsMet: formData.ethicalRequirementsMet ?? false,
          ethicalIssues: formData.ethicalIssues,
          decision: formData.decision,
          decisionRationale: formData.decisionRationale,
        },
      });
    } else {
      result = await prisma.acceptanceContinuanceDecision.create({
        data: {
          engagementId,
          firmId: engagement.firmId,
          isNewClient: formData.isNewClient ?? true,
          isReengagement: formData.isReengagement ?? false,
          clientIntegrityRating: formData.clientIntegrityRating,
          clientIntegrityNotes: formData.clientIntegrityNotes,
          managementIntegrityRating: formData.managementIntegrityRating,
          managementIntegrityNotes: formData.managementIntegrityNotes,
          engagementRiskLevel: formData.engagementRiskLevel,
          engagementRiskFactors: formData.engagementRiskFactors,
          competenceConfirmed: formData.competenceConfirmed ?? false,
          competenceNotes: formData.competenceNotes,
          resourcesAvailable: formData.resourcesAvailable ?? false,
          resourcesNotes: formData.resourcesNotes,
          decision: formData.decision,
          decisionRationale: formData.decisionRationale,
        },
      });
    }

    await logAuditTrail(
      req.user!.id,
      "ACCEPTANCE_DATA_SAVED",
      "acceptance_continuance_decision",
      result.id,
      existing,
      result,
      engagementId,
      "Acceptance & continuance form data saved",
      req.ip,
      req.get("user-agent")
    );

    res.json(result);
  } catch (error) {
    console.error("Save acceptance data error:", error);
    res.status(500).json({ error: "Failed to save acceptance data" });
  }
});

router.patch("/engagements/:engagementId/acceptance-approve", requireAuth, requireRoles("PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { decision, rationale, comments } = req.body;

    if (!decision || !["APPROVED", "REJECTED"].includes(decision)) {
      return res.status(400).json({ error: "Decision must be APPROVED or REJECTED" });
    }
    if (!rationale || rationale.length < 10) {
      return res.status(400).json({ error: "Rationale must be at least 10 characters" });
    }

    const existing = await prisma.acceptanceContinuanceDecision.findUnique({
      where: { engagementId },
    });

    if (!existing) {
      return res.status(404).json({ error: "No acceptance data found. Complete the acceptance form first." });
    }

    const result = await prisma.acceptanceContinuanceDecision.update({
      where: { engagementId },
      data: {
        decision: decision,
        decisionRationale: rationale,
        decisionDate: new Date(),
        decisionById: req.user!.id,
        partnerApprovedAt: decision === "APPROVED" ? new Date() : null,
        partnerApprovedById: decision === "APPROVED" ? req.user!.id : null,
        partnerComments: comments,
      },
    });

    await logAuditTrail(
      req.user!.id,
      decision === "APPROVED" ? "ACCEPTANCE_APPROVED" : "ACCEPTANCE_REJECTED",
      "acceptance_continuance_decision",
      result.id,
      existing,
      result,
      engagementId,
      `Acceptance ${decision.toLowerCase()} by partner: ${rationale}`,
      req.ip,
      req.get("user-agent")
    );

    res.json(result);
  } catch (error) {
    console.error("Acceptance approval error:", error);
    res.status(500).json({ error: "Failed to process acceptance approval" });
  }
});

// ============================================
// INDEPENDENCE PHASE APPROVAL
// ============================================

router.patch("/engagements/:engagementId/ethics-approve", requireAuth, requireRoles("PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { notes } = req.body;

    const [declarations, threats, team] = await Promise.all([
      prisma.independenceDeclaration.findMany({ where: { engagementId } }),
      prisma.threatRegister.findMany({ where: { engagementId } }),
      prisma.engagementTeam.findMany({ where: { engagementId } }),
    ]);

    const teamMemberIds = team.map((t: { userId: string }) => t.userId);
    const declarationUserIds = declarations.map((d: { userId: string }) => d.userId);
    const pendingCount = teamMemberIds.filter((id: string) => !declarationUserIds.includes(id)).length;

    const unresolvedThreats = threats.filter((t: { status: string }) =>
      t.status === "IDENTIFIED" || t.status === "UNRESOLVED"
    );

    if (pendingCount > 0) {
      return res.status(400).json({
        error: `Cannot approve: ${pendingCount} team member(s) have not submitted independence declarations`,
      });
    }

    if (unresolvedThreats.length > 0) {
      return res.status(400).json({
        error: `Cannot approve: ${unresolvedThreats.length} unresolved threat(s) remain`,
      });
    }

    const existing = await prisma.ethicsConfirmation.findUnique({
      where: { engagementId },
    });

    let result;
    if (existing) {
      result = await prisma.ethicsConfirmation.update({
        where: { engagementId },
        data: {
          allDeclarationsComplete: true,
          allThreatsResolved: true,
          isLocked: true,
          lockedById: req.user!.id,
          lockedDate: new Date(),
          completionConfirmedById: req.user!.id,
          completionConfirmedDate: new Date(),
          completionConfirmationNotes: notes,
        },
      });
    } else {
      result = await prisma.ethicsConfirmation.create({
        data: {
          engagementId,
          allDeclarationsComplete: true,
          allThreatsResolved: true,
          isLocked: true,
          lockedById: req.user!.id,
          lockedDate: new Date(),
          startConfirmedById: req.user!.id,
          startConfirmedDate: new Date(),
          completionConfirmedById: req.user!.id,
          completionConfirmedDate: new Date(),
          completionConfirmationNotes: notes,
        },
      });
    }

    await logAuditTrail(
      req.user!.id,
      "ETHICS_INDEPENDENCE_APPROVED",
      "ethics_confirmation",
      result.id,
      existing,
      result,
      engagementId,
      "Independence & Ethics phase approved by partner",
      req.ip,
      req.get("user-agent")
    );

    res.json(result);
  } catch (error) {
    console.error("Ethics approval error:", error);
    res.status(500).json({ error: "Failed to approve ethics" });
  }
});

// ============================================
// ETHICS CONFIRMATION / STATUS
// ============================================

router.get("/engagements/:engagementId/ethics-status", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;

    const [declarations, threats, confirmation] = await Promise.all([
      prisma.independenceDeclaration.findMany({
        where: { engagementId },
        include: { user: { select: { id: true, fullName: true } } }
      }),
      prisma.threatRegister.findMany({
        where: { engagementId },
        include: { safeguards: true }
      }),
      prisma.ethicsConfirmation.findUnique({
        where: { engagementId }
      })
    ]);

    const team = await prisma.engagementTeam.findMany({
      where: { engagementId },
      include: { user: { select: { id: true, fullName: true } } }
    });

    const teamMemberIds = team.map((t: { userId: string }) => t.userId);
    const declarationUserIds = declarations.map((d: { userId: string }) => d.userId);
    const pendingDeclarations = teamMemberIds.filter((id: string) => !declarationUserIds.includes(id));

    const unresolvedThreats = threats.filter((t: { status: string }) => 
      t.status === "IDENTIFIED" || t.status === "UNRESOLVED"
    );

    const status = {
      totalTeamMembers: team.length,
      declarationsSubmitted: declarations.length,
      pendingDeclarations: pendingDeclarations.length,
      pendingMembers: team.filter((t: { userId: string }) => pendingDeclarations.includes(t.userId)),
      totalThreats: threats.length,
      unresolvedThreats: unresolvedThreats.length,
      allDeclarationsComplete: pendingDeclarations.length === 0,
      allThreatsResolved: unresolvedThreats.length === 0,
      isLocked: confirmation?.isLocked || false,
      confirmation,
    };

    res.json(status);
  } catch (error) {
    console.error("Get ethics status error:", error);
    res.status(500).json({ error: "Failed to fetch ethics status" });
  }
});

export default router;
