import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "./db";
import { requireAuth, requireRoles, AuthenticatedRequest } from "./auth";
import { logAuditTrail } from "./auth";

const router = Router();

// ============================================
// AML/CFT COMPLIANCE (AML Act 2010, FATF)
// ============================================

// Risk rating algorithm based on FATF Recommendation 10
function calculateAMLRiskScore(factors: {
  entityType: string;
  industry: string;
  hasPEP: boolean;
  foreignOwnership: boolean;
  highRiskCountry: boolean;
  cashIntensive: boolean;
  complexStructure: boolean;
  negativeNews: boolean;
}): { score: number; level: string; factors: string[] } {
  let score = 0;
  const riskFactors: string[] = [];

  // Entity type risk
  if (factors.entityType === "PRIVATE_LIMITED") score += 10;
  else if (factors.entityType === "PUBLIC_LIMITED") score += 5;
  else if (factors.entityType === "PARTNERSHIP") score += 15;
  else if (factors.entityType === "SOLE_PROPRIETORSHIP") score += 20;
  
  // Industry risk (per AML Act 2010 Schedule II)
  const highRiskIndustries = ["REAL_ESTATE", "CONSTRUCTION", "JEWELRY", "MONEY_SERVICES", "GAMING", "CRYPTOCURRENCY"];
  if (highRiskIndustries.includes(factors.industry)) {
    score += 25;
    riskFactors.push("High-risk industry under AML Act 2010");
  }

  // PEP status (FATF Recommendation 12)
  if (factors.hasPEP) {
    score += 30;
    riskFactors.push("Politically Exposed Person involvement");
  }

  // Foreign ownership
  if (factors.foreignOwnership) {
    score += 15;
    riskFactors.push("Foreign ownership structure");
  }

  // High-risk country (FATF grey/black list)
  if (factors.highRiskCountry) {
    score += 35;
    riskFactors.push("High-risk jurisdiction involvement");
  }

  // Cash-intensive business
  if (factors.cashIntensive) {
    score += 20;
    riskFactors.push("Cash-intensive business operations");
  }

  // Complex ownership structure
  if (factors.complexStructure) {
    score += 15;
    riskFactors.push("Complex ownership structure");
  }

  // Negative news/adverse media
  if (factors.negativeNews) {
    score += 20;
    riskFactors.push("Adverse media findings");
  }

  // Determine risk level
  let level: string;
  if (score >= 70) level = "HIGH";
  else if (score >= 40) level = "MEDIUM";
  else level = "LOW";

  return { score, level, factors: riskFactors };
}

// Calculate AML risk for client
router.post("/clients/:clientId/aml-risk-assessment", requireAuth, requireRoles("MANAGER", "PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { clientId } = req.params;
    const { 
      foreignOwnership = false,
      highRiskCountry = false,
      cashIntensive = false,
      complexStructure = false,
      negativeNews = false
    } = req.body;

    const client = await prisma.client.findFirst({
      where: { 
        id: clientId,
        firmId: req.user!.firmId!
      }
    });

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    // Check for PEP in UBOs
    const ubos = (client.ultimateBeneficialOwners as any[]) || [];
    const hasPEP = ubos.some((ubo: any) => ubo.isPEP === true);

    const riskAssessment = calculateAMLRiskScore({
      entityType: client.entityType || "PRIVATE_LIMITED",
      industry: client.industry || "OTHER",
      hasPEP,
      foreignOwnership,
      highRiskCountry,
      cashIntensive,
      complexStructure,
      negativeNews,
    });

    // Update client with AML risk score
    const updatedClient = await prisma.client.update({
      where: { id: clientId },
      data: {
        amlRiskScore: riskAssessment.score,
        amlScreeningDate: new Date(),
        amlScreeningResult: riskAssessment.level,
        riskFactors: riskAssessment.factors,
        pepCheckDone: true,
        pepCheckResult: hasPEP ? "PEP_IDENTIFIED" : "NO_PEP",
      }
    });

    await logAuditTrail(
      req.user!.id,
      "AML_RISK_ASSESSMENT",
      "client",
      clientId,
      client,
      updatedClient,
      undefined,
      "AML risk assessment completed: " + riskAssessment.level,
      req.ip,
      req.get("user-agent")
    );

    res.json({
      clientId,
      clientName: client.name,
      assessmentDate: new Date(),
      riskScore: riskAssessment.score,
      riskLevel: riskAssessment.level,
      riskFactors: riskAssessment.factors,
      pepStatus: hasPEP ? "PEP_IDENTIFIED" : "NO_PEP",
      regulatoryReference: "AML Act 2010, Section 7 - Customer Due Diligence",
    });
  } catch (error) {
    console.error("AML risk assessment error:", error);
    res.status(500).json({ error: "Failed to perform AML risk assessment" });
  }
});

// ============================================
// COMPLIANCE SCREENING
// ============================================

const screeningSchema = z.object({
  screeningType: z.enum(["AML", "PEP", "SANCTIONS", "BLACKLIST", "DIRECTOR_DISQUALIFICATION", "LITIGATION"]),
  dataSource: z.string().optional(),
  searchCriteria: z.any().optional(),
  result: z.enum(["CLEAR", "MATCH_FOUND", "PENDING_REVIEW", "FALSE_POSITIVE", "CONFIRMED_MATCH"]).default("PENDING_REVIEW"),
  matchDetails: z.any().optional(),
  reviewNotes: z.string().optional(),
});

router.post("/clients/:clientId/screenings", requireAuth, requireRoles("SENIOR", "MANAGER", "PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { clientId } = req.params;
    const data = screeningSchema.parse(req.body);

    const client = await prisma.client.findFirst({
      where: { 
        id: clientId,
        firmId: req.user!.role === "ADMIN" ? undefined : req.user!.firmId!
      }
    });

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    const screening = await prisma.complianceScreening.create({
      data: {
        clientId,
        screeningType: data.screeningType,
        dataSource: data.dataSource,
        searchCriteria: data.searchCriteria,
        result: data.result,
        matchDetails: data.matchDetails,
        reviewNotes: data.reviewNotes,
        reviewedById: data.result !== "PENDING_REVIEW" ? req.user!.id : undefined,
        reviewedDate: data.result !== "PENDING_REVIEW" ? new Date() : undefined,
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year expiry
        regulatoryReference: getScreeningReference(data.screeningType),
      },
      include: {
        client: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, fullName: true } }
      }
    });

    // Update client screening fields
    if (data.screeningType === "SANCTIONS") {
      await prisma.client.update({
        where: { id: clientId },
        data: {
          sanctionsScreeningDate: new Date(),
          sanctionsScreeningResult: data.result,
        }
      });
    }

    await logAuditTrail(
      req.user!.id,
      "COMPLIANCE_SCREENING_CREATED",
      "compliance_screening",
      screening.id,
      null,
      screening,
      undefined,
      data.screeningType + " screening performed",
      req.ip,
      req.get("user-agent")
    );

    res.status(201).json(screening);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("Screening error:", error);
    res.status(500).json({ error: "Failed to create screening" });
  }
});

function getScreeningReference(type: string): string {
  const references: Record<string, string> = {
    "AML": "AML Act 2010, Section 7",
    "PEP": "FATF Recommendation 12",
    "SANCTIONS": "UN Security Council Resolutions",
    "BLACKLIST": "Companies Act 2017, Section 226",
    "DIRECTOR_DISQUALIFICATION": "Companies Act 2017, Section 153",
    "LITIGATION": "ISA 250 - Legal Matters",
  };
  return references[type] || "Regulatory Compliance";
}

// Get screenings for client
router.get("/clients/:clientId/screenings", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { clientId } = req.params;
    
    const screenings = await prisma.complianceScreening.findMany({
      where: { clientId },
      include: {
        reviewedBy: { select: { id: true, fullName: true } },
        partnerReviewedBy: { select: { id: true, fullName: true } }
      },
      orderBy: { screeningDate: "desc" }
    });

    res.json(screenings);
  } catch (error) {
    console.error("Get screenings error:", error);
    res.status(500).json({ error: "Failed to fetch screenings" });
  }
});

// Review screening result
router.patch("/screenings/:screeningId/review", requireAuth, requireRoles("MANAGER", "PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { screeningId } = req.params;
    const { result, reviewNotes, falsePositiveReason } = req.body;

    const existing = await prisma.complianceScreening.findUnique({
      where: { id: screeningId }
    });

    if (!existing) {
      return res.status(404).json({ error: "Screening not found" });
    }

    const screening = await prisma.complianceScreening.update({
      where: { id: screeningId },
      data: {
        result,
        reviewNotes,
        falsePositiveReason: result === "FALSE_POSITIVE" ? falsePositiveReason : undefined,
        reviewedById: req.user!.id,
        reviewedDate: new Date(),
        escalatedToPartner: result === "MATCH_FOUND" || result === "CONFIRMED_MATCH",
      }
    });

    await logAuditTrail(
      req.user!.id,
      "SCREENING_REVIEWED",
      "compliance_screening",
      screeningId,
      existing,
      screening,
      undefined,
      "Screening reviewed: " + result,
      req.ip,
      req.get("user-agent")
    );

    res.json(screening);
  } catch (error) {
    console.error("Review screening error:", error);
    res.status(500).json({ error: "Failed to review screening" });
  }
});

// Partner decision on screening match
router.patch("/screenings/:screeningId/partner-decision", requireAuth, requireRoles("PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { screeningId } = req.params;
    const { decision, notes } = req.body;

    const existing = await prisma.complianceScreening.findUnique({
      where: { id: screeningId }
    });

    if (!existing) {
      return res.status(404).json({ error: "Screening not found" });
    }

    const screening = await prisma.complianceScreening.update({
      where: { id: screeningId },
      data: {
        partnerReviewedById: req.user!.id,
        partnerReviewDate: new Date(),
        partnerDecision: decision,
        result: decision === "PROCEED" ? "FALSE_POSITIVE" : "CONFIRMED_MATCH",
      }
    });

    await logAuditTrail(
      req.user!.id,
      "SCREENING_PARTNER_DECISION",
      "compliance_screening",
      screeningId,
      existing,
      screening,
      undefined,
      "Partner decision on screening: " + decision,
      req.ip,
      req.get("user-agent")
    );

    res.json(screening);
  } catch (error) {
    console.error("Partner decision error:", error);
    res.status(500).json({ error: "Failed to process partner decision" });
  }
});

// ============================================
// KYC DOCUMENT MANAGEMENT
// ============================================

const kycDocumentSchema = z.object({
  documentType: z.string().min(1),
  documentName: z.string().min(1),
  documentNumber: z.string().optional(),
  issueDate: z.string().optional().transform(s => s ? new Date(s) : undefined),
  expiryDate: z.string().optional().transform(s => s ? new Date(s) : undefined),
  issuingAuthority: z.string().optional(),
  amlRelevant: z.boolean().default(false),
  regulatoryRequirement: z.string().optional(),
});

router.post("/clients/:clientId/kyc-documents", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { clientId } = req.params;
    const data = kycDocumentSchema.parse(req.body);

    const client = await prisma.client.findFirst({
      where: { 
        id: clientId,
        firmId: req.user!.role === "ADMIN" ? undefined : req.user!.firmId!
      }
    });

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    const document = await prisma.kYCDocument.create({
      data: {
        clientId,
        documentType: data.documentType,
        documentName: data.documentName,
        documentNumber: data.documentNumber,
        issueDate: data.issueDate,
        expiryDate: data.expiryDate,
        issuingAuthority: data.issuingAuthority,
        amlRelevant: data.amlRelevant,
        regulatoryRequirement: data.regulatoryRequirement,
        verificationStatus: "PENDING",
      },
      include: {
        client: { select: { id: true, name: true } }
      }
    });

    await logAuditTrail(
      req.user!.id,
      "KYC_DOCUMENT_ADDED",
      "kyc_document",
      document.id,
      null,
      document,
      undefined,
      "KYC document added: " + data.documentType,
      req.ip,
      req.get("user-agent")
    );

    res.status(201).json(document);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    console.error("KYC document error:", error);
    res.status(500).json({ error: "Failed to add KYC document" });
  }
});

router.get("/clients/:clientId/kyc-documents", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { clientId } = req.params;
    
    const documents = await prisma.kYCDocument.findMany({
      where: { clientId },
      include: {
        verifiedBy: { select: { id: true, fullName: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    // Check for expiring documents
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    const documentsWithStatus = documents.map((doc: { expiryDate: Date | null; [key: string]: any }) => ({
      ...doc,
      expiryStatus: doc.expiryDate 
        ? (doc.expiryDate < now ? "EXPIRED" : (doc.expiryDate < thirtyDaysFromNow ? "EXPIRING_SOON" : "VALID"))
        : "NO_EXPIRY"
    }));

    res.json(documentsWithStatus);
  } catch (error) {
    console.error("Get KYC documents error:", error);
    res.status(500).json({ error: "Failed to fetch KYC documents" });
  }
});

// Verify KYC document
router.patch("/kyc-documents/:documentId/verify", requireAuth, requireRoles("SENIOR", "MANAGER", "PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { documentId } = req.params;
    const { status, notes } = req.body;

    const existing = await prisma.kYCDocument.findUnique({
      where: { id: documentId }
    });

    if (!existing) {
      return res.status(404).json({ error: "KYC document not found" });
    }

    const document = await prisma.kYCDocument.update({
      where: { id: documentId },
      data: {
        verificationStatus: status,
        verifiedById: req.user!.id,
        verifiedDate: new Date(),
        verificationNotes: notes,
        isValid: status === "VERIFIED",
        invalidReason: status === "REJECTED" ? notes : undefined,
      }
    });

    await logAuditTrail(
      req.user!.id,
      "KYC_DOCUMENT_VERIFIED",
      "kyc_document",
      documentId,
      existing,
      document,
      undefined,
      "KYC document verification: " + status,
      req.ip,
      req.get("user-agent")
    );

    res.json(document);
  } catch (error) {
    console.error("Verify KYC document error:", error);
    res.status(500).json({ error: "Failed to verify KYC document" });
  }
});

// ============================================
// COMPLIANCE SUMMARY
// ============================================

router.get("/clients/:clientId/compliance-summary", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { clientId } = req.params;

    const client = await prisma.client.findFirst({
      where: { 
        id: clientId,
        firmId: req.user!.role === "ADMIN" ? undefined : req.user!.firmId!
      }
    });

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    const [screenings, kycDocuments, conflicts] = await Promise.all([
      prisma.complianceScreening.findMany({
        where: { clientId },
        orderBy: { screeningDate: "desc" }
      }),
      prisma.kYCDocument.findMany({
        where: { clientId }
      }),
      prisma.conflictOfInterest.findMany({
        where: { clientId }
      })
    ]);

    const now = new Date();
    const expiredDocs = kycDocuments.filter((d: { expiryDate: Date | null }) => d.expiryDate && d.expiryDate < now);
    const pendingVerification = kycDocuments.filter((d: { verificationStatus: string }) => d.verificationStatus === "PENDING");
    const matchedScreenings = screenings.filter((s: { result: string }) => s.result === "MATCH_FOUND" || s.result === "CONFIRMED_MATCH");
    const unresolvedConflicts = conflicts.filter((c: { status: string }) => c.status === "IDENTIFIED" || c.status === "UNDER_REVIEW");

    const summary = {
      clientId,
      clientName: client.name,
      acceptanceStatus: client.acceptanceStatus,
      amlRiskLevel: client.amlScreeningResult || "NOT_ASSESSED",
      amlRiskScore: client.amlRiskScore,
      lastAmlScreening: client.amlScreeningDate,
      pepStatus: client.pepCheckResult || "NOT_CHECKED",
      sanctionsStatus: client.sanctionsScreeningResult || "NOT_CHECKED",
      kycStatus: {
        totalDocuments: kycDocuments.length,
        verified: kycDocuments.filter((d: { verificationStatus: string }) => d.verificationStatus === "VERIFIED").length,
        pending: pendingVerification.length,
        expired: expiredDocs.length,
      },
      screeningStatus: {
        total: screenings.length,
        clear: screenings.filter((s: { result: string }) => s.result === "CLEAR").length,
        matches: matchedScreenings.length,
        pendingReview: screenings.filter((s: { result: string }) => s.result === "PENDING_REVIEW").length,
      },
      conflictStatus: {
        total: conflicts.length,
        resolved: conflicts.filter((c: { status: string }) => c.status === "ACCEPTED" || c.status === "SAFEGUARDED").length,
        unresolved: unresolvedConflicts.length,
      },
      overallCompliance: determineOverallCompliance(client, expiredDocs, matchedScreenings, unresolvedConflicts, pendingVerification),
      regulatoryReferences: [
        "AML Act 2010, Section 7 - Customer Due Diligence",
        "FATF Recommendation 10 - Customer Due Diligence",
        "Companies Act 2017, Section 226 - Auditor's Rights",
        "IESBA Code - Independence Requirements"
      ]
    };

    res.json(summary);
  } catch (error) {
    console.error("Compliance summary error:", error);
    res.status(500).json({ error: "Failed to generate compliance summary" });
  }
});

function determineOverallCompliance(
  client: any,
  expiredDocs: any[],
  matchedScreenings: any[],
  unresolvedConflicts: any[],
  pendingVerification: any[]
): string {
  if (client.acceptanceStatus === "REJECTED") return "REJECTED";
  if (matchedScreenings.length > 0) return "HIGH_RISK";
  if (unresolvedConflicts.length > 0) return "PENDING_REVIEW";
  if (expiredDocs.length > 0 || pendingVerification.length > 0) return "INCOMPLETE";
  if (client.acceptanceStatus === "APPROVED") return "COMPLIANT";
  return "PENDING";
}

export default router;
