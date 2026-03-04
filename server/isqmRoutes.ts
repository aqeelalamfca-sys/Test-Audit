import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "./db";
import { requireAuth, requireMinRole, requireRoles, logAuditTrail, AuthenticatedRequest } from "./auth";
import { logFirmControlActivity } from "./routes/firmControlComplianceLogRoutes";

const router = Router();

// ============================================
// GOVERNANCE & QUALITY MANAGEMENT STRUCTURE
// ============================================

router.get("/governance/structure", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const structure = await prisma.qualityManagementStructure.findFirst({
      where: { firmId },
      orderBy: { createdAt: "desc" },
    });

    res.json(structure);
  } catch (error) {
    console.error("Get governance structure error:", error);
    res.status(500).json({ error: "Failed to fetch governance structure" });
  }
});

router.post("/governance/structure", requireAuth, requireRoles("PARTNER", "ADMIN"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const schema = z.object({
      qualityManagementPartnerId: z.string().optional(),
      qualityCommitteeChairId: z.string().optional(),
      reportingStructure: z.any().optional(),
      governancePolicyPath: z.string().optional(),
      ethicalLeadershipPolicyPath: z.string().optional(),
      accountabilityPolicyPath: z.string().optional(),
      effectiveFrom: z.string().optional().transform(s => s ? new Date(s) : undefined),
    });

    const data = schema.parse(req.body);

    const structure = await prisma.qualityManagementStructure.create({
      data: {
        firmId,
        ...data,
        approvedById: req.user!.id,
        approvedDate: new Date(),
      },
    });

    await logAuditTrail(req.user!.id, "GOVERNANCE_STRUCTURE_CREATED", "quality_management_structure", structure.id, null, structure, undefined, "Governance structure updated", req.ip, req.get("user-agent"));

    void logFirmControlActivity({
      firmId,
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      entityType: "QualityManagementStructure",
      entityId: structure.id,
      controlDomain: "Governance & Leadership",
      action: "POLICY_UPDATED",
      status: "APPROVED",
      description: "Governance structure created/updated",
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    }).catch(() => {});

    res.status(201).json(structure);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Create governance structure error:", error);
    res.status(500).json({ error: "Failed to create governance structure" });
  }
});

// ============================================
// LEADERSHIP AFFIRMATIONS
// ============================================

router.get("/affirmations", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const affirmations = await prisma.leadershipAffirmation.findMany({
      where: { firmId },
      orderBy: { createdAt: "desc" },
    });

    res.json(affirmations);
  } catch (error) {
    console.error("Get affirmations error:", error);
    res.status(500).json({ error: "Failed to fetch affirmations" });
  }
});

router.post("/affirmations", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const schema = z.object({
      affirmationType: z.enum(["ANNUAL", "ONBOARDING", "SPECIAL"]),
      affirmationText: z.string().min(1),
      nextAffirmationDue: z.string().optional().transform(s => s ? new Date(s) : undefined),
    });

    const data = schema.parse(req.body);

    const affirmation = await prisma.leadershipAffirmation.create({
      data: {
        userId: req.user!.id,
        firmId,
        affirmationType: data.affirmationType,
        affirmationText: data.affirmationText,
        signoffDate: new Date(),
        nextAffirmationDue: data.nextAffirmationDue,
        ipAddress: req.ip,
      },
    });

    void logFirmControlActivity({
      firmId,
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      entityType: "LeadershipAffirmation",
      entityId: affirmation.id,
      controlDomain: "Governance & Leadership",
      action: "AFFIRMATION_SUBMITTED",
      status: "SUBMITTED",
      description: `${data.affirmationType} affirmation submitted`,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    }).catch(() => {});

    res.status(201).json(affirmation);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Create affirmation error:", error);
    res.status(500).json({ error: "Failed to create affirmation" });
  }
});

// ============================================
// INDEPENDENCE DECLARATIONS (FIRM-WIDE)
// ============================================

router.get("/independence/declarations", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();
    
    const firmUserIds = await prisma.user.findMany({
      where: { firmId },
      select: { id: true },
    });
    const userIds = firmUserIds.map(u => u.id);

    const declarations = await prisma.firmIndependenceDeclaration.findMany({
      where: { 
        declarationYear: year,
        userId: { in: userIds },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(declarations);
  } catch (error) {
    console.error("Get independence declarations error:", error);
    res.status(500).json({ error: "Failed to fetch independence declarations" });
  }
});

router.post("/independence/declarations", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const schema = z.object({
      declarationType: z.string().min(1),
      declarationYear: z.number().int(),
      clientId: z.string().optional(),
      engagementId: z.string().optional(),
      hasFinancialInterest: z.boolean().default(false),
      hasFamilyRelationship: z.boolean().default(false),
      hasBusinessRelationship: z.boolean().default(false),
      hasPreviousEmployment: z.boolean().default(false),
      giftsReceivedValue: z.number().optional(),
      hospitalityReceivedDetails: z.string().optional(),
      safeguardsImplemented: z.string().optional(),
      isIndependent: z.boolean().default(true),
    });

    const data = schema.parse(req.body);

    const declaration = await prisma.firmIndependenceDeclaration.create({
      data: {
        userId: req.user!.id,
        ...data,
        declarationDate: new Date(),
      },
    });

    if (req.user!.firmId) {
      void logFirmControlActivity({
        firmId: req.user!.firmId,
        actorUserId: req.user!.id,
        actorRole: req.user!.role,
        entityType: "FirmIndependenceDeclaration",
        entityId: declaration.id,
        controlDomain: "Ethical Requirements",
        action: "INDEPENDENCE_DECLARED",
        status: "SUBMITTED",
        description: `Independence declaration for year ${data.declarationYear}`,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      }).catch(() => {});
    }

    res.status(201).json(declaration);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Create independence declaration error:", error);
    res.status(500).json({ error: "Failed to create independence declaration" });
  }
});

router.get("/independence/compliance", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const year = new Date().getFullYear();
    
    const totalUsers = await prisma.user.count({ where: { firmId, isActive: true } });
    const firmUserIds = await prisma.user.findMany({
      where: { firmId },
      select: { id: true },
    });
    const userIds = firmUserIds.map(u => u.id);
    const declaredUsers = await prisma.firmIndependenceDeclaration.groupBy({
      by: ["userId"],
      where: { declarationYear: year, declarationType: "Annual", userId: { in: userIds } },
    });

    const compliancePercentage = totalUsers > 0 ? (declaredUsers.length / totalUsers) * 100 : 0;

    res.json({
      totalUsers,
      declaredUsers: declaredUsers.length,
      compliancePercentage: Math.round(compliancePercentage * 10) / 10,
      pendingUsers: totalUsers - declaredUsers.length,
    });
  } catch (error) {
    console.error("Get independence compliance error:", error);
    res.status(500).json({ error: "Failed to fetch independence compliance" });
  }
});

// ============================================
// FINANCIAL INTERESTS REGISTER
// ============================================

router.get("/financial-interests", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const interests = await prisma.financialInterest.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
    });

    res.json(interests);
  } catch (error) {
    console.error("Get financial interests error:", error);
    res.status(500).json({ error: "Failed to fetch financial interests" });
  }
});

router.post("/financial-interests", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const schema = z.object({
      entityName: z.string().min(1),
      relationshipType: z.enum(["DIRECT", "INDIRECT", "FAMILY"]),
      natureOfInterest: z.enum(["SHARES", "DEBENTURES", "LOANS", "OTHER"]),
      approximateValue: z.number().optional(),
      acquisitionDate: z.string().optional().transform(s => s ? new Date(s) : undefined),
      isAuditClient: z.boolean().default(false),
      clientId: z.string().optional(),
    });

    const data = schema.parse(req.body);

    const interest = await prisma.financialInterest.create({
      data: {
        userId: req.user!.id,
        ...data,
        reportedDate: new Date(),
      },
    });

    res.status(201).json(interest);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Create financial interest error:", error);
    res.status(500).json({ error: "Failed to create financial interest" });
  }
});

// ============================================
// GIFTS & HOSPITALITY REGISTER
// ============================================

router.get("/gifts-hospitality", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const gifts = await prisma.giftHospitality.findMany({
      where: { userId: req.user!.id },
      orderBy: { dateReceived: "desc" },
    });

    res.json(gifts);
  } catch (error) {
    console.error("Get gifts hospitality error:", error);
    res.status(500).json({ error: "Failed to fetch gifts hospitality" });
  }
});

router.post("/gifts-hospitality", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const schema = z.object({
      clientId: z.string().optional(),
      dateReceived: z.string().transform(s => new Date(s)),
      description: z.string().min(1),
      estimatedValue: z.number().optional(),
      giverName: z.string().optional(),
      giverDesignation: z.string().optional(),
      actionTaken: z.enum(["RETAINED", "RETURNED", "DONATED", "SHARED"]).optional(),
      remarks: z.string().optional(),
    });

    const data = schema.parse(req.body);

    const gift = await prisma.giftHospitality.create({
      data: {
        userId: req.user!.id,
        ...data,
      },
    });

    res.status(201).json(gift);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Create gift hospitality error:", error);
    res.status(500).json({ error: "Failed to create gift hospitality" });
  }
});

// ============================================
// ETHICS BREACHES
// ============================================

router.get("/ethics-breaches", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const breaches = await prisma.ethicsBreach.findMany({
      where: { firmId },
      orderBy: { reportedDate: "desc" },
    });

    res.json(breaches);
  } catch (error) {
    console.error("Get ethics breaches error:", error);
    res.status(500).json({ error: "Failed to fetch ethics breaches" });
  }
});

router.post("/ethics-breaches", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const schema = z.object({
      breachType: z.string().min(1),
      description: z.string().min(1),
      personsInvolved: z.string().optional(),
    });

    const data = schema.parse(req.body);

    const breach = await prisma.ethicsBreach.create({
      data: {
        firmId,
        ...data,
        reportedById: req.user!.id,
        reportedDate: new Date(),
      },
    });

    void logFirmControlActivity({
      firmId,
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      entityType: "EthicsBreach",
      entityId: breach.id,
      controlDomain: "Ethical Requirements",
      action: "ETHICS_BREACH_REPORTED",
      status: "SUBMITTED",
      description: `Ethics breach reported: ${data.description?.substring(0, 80) || "No description"}`,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    }).catch(() => {});

    res.status(201).json(breach);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Create ethics breach error:", error);
    res.status(500).json({ error: "Failed to create ethics breach" });
  }
});

// ============================================
// STAFF COMPETENCY
// ============================================

router.get("/competency", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const firmUserIds = await prisma.user.findMany({
      where: { firmId },
      select: { id: true },
    });
    const userIds = firmUserIds.map(u => u.id);
    const where: any = { userId: { in: userIds } };

    const competencies = await prisma.staffCompetency.findMany({
      where,
      orderBy: { assessmentDate: "desc" },
    });

    res.json(competencies);
  } catch (error) {
    console.error("Get competency error:", error);
    res.status(500).json({ error: "Failed to fetch competency" });
  }
});

router.post("/competency", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const schema = z.object({
      userId: z.string().uuid(),
      technicalKnowledgeRating: z.enum(["EXPERT", "PROFICIENT", "COMPETENT", "BASIC", "NONE"]).optional(),
      industryExperienceYears: z.number().int().optional(),
      auditSoftwareProficiency: z.any().optional(),
      trainingNeedsIdentified: z.string().optional(),
      competencyGapAnalysis: z.string().optional(),
      developmentPlan: z.string().optional(),
      nextReviewDate: z.string().optional().transform(s => s ? new Date(s) : undefined),
    });

    const data = schema.parse(req.body);

    const targetUser = await prisma.user.findUnique({ where: { id: data.userId }, select: { firmId: true } });
    if (!targetUser || targetUser.firmId !== firmId) {
      return res.status(403).json({ error: "Cannot assess user from different firm" });
    }

    const competency = await prisma.staffCompetency.create({
      data: {
        ...data,
        assessmentDate: new Date(),
        assessedById: req.user!.id,
      },
    });

    res.status(201).json(competency);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Create competency error:", error);
    res.status(500).json({ error: "Failed to create competency" });
  }
});

// ============================================
// TRAINING & CPD
// ============================================

router.get("/training", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const trainings = await prisma.trainingCPD.findMany({
      where: { userId: req.user!.id },
      orderBy: { trainingDate: "desc" },
    });

    const totalHours = trainings.reduce((sum: number, t: any) => sum + (t.cpdHoursClaimed?.toNumber() || 0), 0);

    res.json({ trainings, totalHours });
  } catch (error) {
    console.error("Get training error:", error);
    res.status(500).json({ error: "Failed to fetch training" });
  }
});

router.post("/training", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const schema = z.object({
      trainingDate: z.string().transform(s => new Date(s)),
      trainingType: z.enum(["TECHNICAL", "SOFT_SKILLS", "ETHICS", "INDUSTRY_SPECIFIC"]),
      topic: z.string().min(1),
      provider: z.string().optional(),
      durationHours: z.number().positive(),
      cpdHoursClaimed: z.number().optional(),
      certificatePath: z.string().optional(),
      effectivenessAssessment: z.string().optional(),
      appliedInPractice: z.boolean().default(false),
    });

    const data = schema.parse(req.body);

    const training = await prisma.trainingCPD.create({
      data: {
        userId: req.user!.id,
        ...data,
      },
    });

    res.status(201).json(training);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Create training error:", error);
    res.status(500).json({ error: "Failed to create training" });
  }
});

// ============================================
// CONSULTATIONS
// ============================================

router.get("/consultations", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const consultations = await prisma.consultationRegister.findMany({
      where: { firmId },
      orderBy: { consultationDate: "desc" },
    });

    res.json(consultations);
  } catch (error) {
    console.error("Get consultations error:", error);
    res.status(500).json({ error: "Failed to fetch consultations" });
  }
});

router.post("/consultations", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const schema = z.object({
      engagementId: z.string().optional(),
      consultationDate: z.string().transform(s => new Date(s)),
      consultationTopic: z.string().min(1),
      issueDescription: z.string().min(1),
      consultedWithId: z.string().optional(),
      consultationConclusion: z.string().optional(),
      documentationPath: z.string().optional(),
    });

    const data = schema.parse(req.body);

    const consultation = await prisma.consultationRegister.create({
      data: {
        firmId,
        ...data,
      },
    });

    res.status(201).json(consultation);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Create consultation error:", error);
    res.status(500).json({ error: "Failed to create consultation" });
  }
});

// ============================================
// MONITORING PLANS
// ============================================

router.get("/monitoring/plans", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const plans = await prisma.monitoringPlan.findMany({
      where: { firmId },
      include: { inspections: true },
      orderBy: { planYear: "desc" },
    });

    res.json(plans);
  } catch (error) {
    console.error("Get monitoring plans error:", error);
    res.status(500).json({ error: "Failed to fetch monitoring plans" });
  }
});

router.post("/monitoring/plans", requireAuth, requireRoles("PARTNER", "ADMIN"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const schema = z.object({
      planYear: z.number().int(),
      scopeOfMonitoring: z.string().optional(),
      engagementsSelected: z.array(z.string()).optional(),
      monitoringMethodology: z.string().optional(),
      resourcesAllocated: z.string().optional(),
      plannedStartDate: z.string().optional().transform(s => s ? new Date(s) : undefined),
      plannedEndDate: z.string().optional().transform(s => s ? new Date(s) : undefined),
    });

    const data = schema.parse(req.body);

    const plan = await prisma.monitoringPlan.create({
      data: {
        firmId,
        ...data,
        approvedById: req.user!.id,
        approvalDate: new Date(),
      },
    });

    res.status(201).json(plan);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Create monitoring plan error:", error);
    res.status(500).json({ error: "Failed to create monitoring plan" });
  }
});

// ============================================
// FILE INSPECTIONS
// ============================================

router.post("/monitoring/inspections", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const schema = z.object({
      monitoringPlanId: z.string().optional(),
      engagementId: z.string().optional(),
      inspectionDate: z.string().transform(s => new Date(s)),
      inspectionAreas: z.array(z.string()).optional(),
      findings: z.string().optional(),
      rating: z.enum(["SATISFACTORY", "NEEDS_IMPROVEMENT", "UNSATISFACTORY"]).optional(),
      recommendations: z.string().optional(),
    });

    const data = schema.parse(req.body);

    const inspection = await prisma.fileInspection.create({
      data: {
        ...data,
        inspectorId: req.user!.id,
      },
    });

    res.status(201).json(inspection);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Create inspection error:", error);
    res.status(500).json({ error: "Failed to create inspection" });
  }
});

// ============================================
// QUALITY DEFICIENCIES
// ============================================

router.get("/deficiencies", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const deficiencies = await prisma.qualityDeficiency.findMany({
      where: { firmId },
      include: { remediations: true },
      orderBy: { createdAt: "desc" },
    });

    res.json(deficiencies);
  } catch (error) {
    console.error("Get deficiencies error:", error);
    res.status(500).json({ error: "Failed to fetch deficiencies" });
  }
});

router.post("/deficiencies", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const schema = z.object({
      sourceType: z.enum(["MONITORING", "EQR", "INTERNAL_REVIEW", "EXTERNAL_INSPECTION"]),
      sourceReferenceId: z.string().optional(),
      deficiencyDescription: z.string().min(1),
      rootCauseAnalysis: z.string().optional(),
      severity: z.enum(["SEVERE", "SIGNIFICANT", "MINOR_LEVEL"]).optional(),
      pervasiveness: z.enum(["PERVASIVE", "LIMITED"]).optional(),
      assignedToId: z.string().optional(),
      targetResolutionDate: z.string().optional().transform(s => s ? new Date(s) : undefined),
    });

    const data = schema.parse(req.body);

    const deficiency = await prisma.qualityDeficiency.create({
      data: {
        firmId,
        ...data,
      },
    });

    res.status(201).json(deficiency);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Create deficiency error:", error);
    res.status(500).json({ error: "Failed to create deficiency" });
  }
});

// ============================================
// QUALITY OBJECTIVES & RISKS
// ============================================

router.get("/quality-objectives", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const objectives = await prisma.qualityObjective.findMany({
      where: { firmId },
      include: { risks: { include: { responses: true } } },
      orderBy: { isqmComponent: "asc" },
    });

    res.json(objectives);
  } catch (error) {
    console.error("Get quality objectives error:", error);
    res.status(500).json({ error: "Failed to fetch quality objectives" });
  }
});

router.post("/quality-objectives", requireAuth, requireRoles("PARTNER", "ADMIN"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const schema = z.object({
      isqmComponent: z.enum(["GOVERNANCE", "ETHICS", "CLIENT_ACCEPTANCE", "ENGAGEMENT_PERFORMANCE", "RESOURCES", "INFORMATION_COMMUNICATION"]),
      objectiveCode: z.string().min(1),
      objectiveDescription: z.string().min(1),
      isMandatory: z.boolean().default(true),
      effectiveFrom: z.string().optional().transform(s => s ? new Date(s) : undefined),
    });

    const data = schema.parse(req.body);

    const objective = await prisma.qualityObjective.create({
      data: {
        firmId,
        ...data,
      },
    });

    res.status(201).json(objective);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Create quality objective error:", error);
    res.status(500).json({ error: "Failed to create quality objective" });
  }
});

router.post("/quality-risks", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const schema = z.object({
      objectiveId: z.string().uuid(),
      riskCode: z.string().min(1),
      riskDescription: z.string().min(1),
      riskCategory: z.enum(["STRATEGIC", "OPERATIONAL", "COMPLIANCE", "FINANCIAL"]).optional(),
      likelihood: z.enum(["RARE", "UNLIKELY", "POSSIBLE", "LIKELY", "ALMOST_CERTAIN"]).optional(),
      impact: z.enum(["INSIGNIFICANT", "MINOR", "MODERATE", "MAJOR", "CATASTROPHIC"]).optional(),
      inherentRiskScore: z.number().int().optional(),
      residualRiskScore: z.number().int().optional(),
    });

    const data = schema.parse(req.body);

    const risk = await prisma.qualityRisk.create({
      data: {
        ...data,
        lastAssessmentDate: new Date(),
      },
    });

    res.status(201).json(risk);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Create quality risk error:", error);
    res.status(500).json({ error: "Failed to create quality risk" });
  }
});

// ============================================
// POLICY DOCUMENTS
// ============================================

router.get("/policies", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const policies = await prisma.policyDocument.findMany({
      where: { firmId, isActive: true },
      orderBy: [{ policyCategory: "asc" }, { policyName: "asc" }],
    });

    res.json(policies);
  } catch (error) {
    console.error("Get policies error:", error);
    res.status(500).json({ error: "Failed to fetch policies" });
  }
});

router.post("/policies", requireAuth, requireRoles("PARTNER", "ADMIN"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const schema = z.object({
      policyCategory: z.string().min(1),
      policyName: z.string().min(1),
      policyNumber: z.string().optional(),
      versionNumber: z.string().optional(),
      effectiveDate: z.string().optional().transform(s => s ? new Date(s) : undefined),
      reviewDate: z.string().optional().transform(s => s ? new Date(s) : undefined),
      documentPath: z.string().optional(),
    });

    const data = schema.parse(req.body);

    const policy = await prisma.policyDocument.create({
      data: {
        firmId,
        ...data,
        approvedById: req.user!.id,
        approvalDate: new Date(),
      },
    });

    res.status(201).json(policy);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Create policy error:", error);
    res.status(500).json({ error: "Failed to create policy" });
  }
});

// ============================================
// ANNUAL QUALITY EVALUATION
// ============================================

router.get("/evaluation", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();

    const evaluation = await prisma.annualQualityEvaluation.findFirst({
      where: { firmId, evaluationYear: year },
    });

    res.json(evaluation);
  } catch (error) {
    console.error("Get evaluation error:", error);
    res.status(500).json({ error: "Failed to fetch evaluation" });
  }
});

router.post("/evaluation", requireAuth, requireRoles("PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const schema = z.object({
      evaluationYear: z.number().int(),
      overallConclusion: z.string().optional(),
      governanceRating: z.string().optional(),
      ethicsRating: z.string().optional(),
      clientAcceptanceRating: z.string().optional(),
      engagementPerformanceRating: z.string().optional(),
      resourcesRating: z.string().optional(),
      informationRating: z.string().optional(),
      systemEffective: z.boolean().optional(),
      improvementActions: z.array(z.any()).optional(),
    });

    const data = schema.parse(req.body);

    const evaluation = await prisma.annualQualityEvaluation.upsert({
      where: { firmId_evaluationYear: { firmId, evaluationYear: data.evaluationYear } },
      update: {
        ...data,
        evaluationDate: new Date(),
        partnerSignOffId: req.user!.id,
        partnerSignOffDate: new Date(),
      },
      create: {
        firmId,
        ...data,
        evaluationDate: new Date(),
        partnerSignOffId: req.user!.id,
        partnerSignOffDate: new Date(),
      },
    });

    res.json(evaluation);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Create evaluation error:", error);
    res.status(500).json({ error: "Failed to create evaluation" });
  }
});

// ============================================
// ISQM DASHBOARD
// ============================================

router.get("/dashboard", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const year = new Date().getFullYear();

    const firmUserIds = await prisma.user.findMany({
      where: { firmId },
      select: { id: true },
    });
    const userIds = firmUserIds.map(u => u.id);

    const [
      totalUsers,
      independenceDeclarations,
      openDeficiencies,
      trainings,
      affirmations,
      breaches,
    ] = await Promise.all([
      prisma.user.count({ where: { firmId, isActive: true } }),
      prisma.firmIndependenceDeclaration.groupBy({
        by: ["userId"],
        where: { declarationYear: year, declarationType: "Annual", userId: { in: userIds } },
      }),
      prisma.qualityDeficiency.count({ where: { firmId, status: { in: ["Open", "In_Progress"] } } }),
      prisma.trainingCPD.aggregate({
        where: { userId: { in: userIds } },
        _sum: { cpdHoursClaimed: true },
      }),
      prisma.leadershipAffirmation.count({ where: { firmId } }),
      prisma.ethicsBreach.count({ where: { firmId, status: { not: "Closed" } } }),
    ]);

    const independenceCompliance = totalUsers > 0 ? (independenceDeclarations.length / totalUsers) * 100 : 0;

    res.json({
      independenceCompliance: Math.round(independenceCompliance * 10) / 10,
      totalUsers,
      declaredUsers: independenceDeclarations.length,
      openDeficiencies,
      totalTrainingHours: trainings._sum.cpdHoursClaimed?.toNumber() || 0,
      leadershipAffirmations: affirmations,
      openBreaches: breaches,
    });
  } catch (error) {
    console.error("Get ISQM dashboard error:", error);
    res.status(500).json({ error: "Failed to fetch ISQM dashboard" });
  }
});

// ============================================
// UPDATE ENDPOINTS (PUT)
// ============================================

// Update Independence Declaration
router.put("/independence/declarations/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    // Verify ownership
    const existing = await prisma.firmIndependenceDeclaration.findFirst({
      where: { id, userId: req.user!.id },
    });
    if (!existing) return res.status(404).json({ error: "Declaration not found" });

    const schema = z.object({
      declarationType: z.string().optional(),
      declarationYear: z.number().optional(),
      hasFinancialInterest: z.boolean().optional(),
      hasFamilyRelationship: z.boolean().optional(),
      hasBusinessRelationship: z.boolean().optional(),
      hasPreviousEmployment: z.boolean().optional(),
      giftsReceivedValue: z.number().optional(),
      hospitalityReceivedDetails: z.string().optional(),
      safeguardsImplemented: z.string().optional(),
      isIndependent: z.boolean().optional(),
    });

    const data = schema.parse(req.body);
    const updated = await prisma.firmIndependenceDeclaration.update({
      where: { id },
      data,
    });

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Update independence declaration error:", error);
    res.status(500).json({ error: "Failed to update declaration" });
  }
});

// Update Financial Interest
router.put("/financial-interests/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.financialInterest.findFirst({
      where: { id, userId: req.user!.id },
    });
    if (!existing) return res.status(404).json({ error: "Financial interest not found" });

    const schema = z.object({
      entityName: z.string().optional(),
      natureOfInterest: z.string().optional(),
      relationshipType: z.string().optional(),
      approximateValue: z.number().optional(),
      acquisitionDate: z.string().optional().transform(s => s ? new Date(s) : undefined),
      isAuditClient: z.boolean().optional(),
      status: z.string().optional(),
    });

    const data = schema.parse(req.body);
    const updated = await prisma.financialInterest.update({
      where: { id },
      data: data as any,
    });

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Update financial interest error:", error);
    res.status(500).json({ error: "Failed to update financial interest" });
  }
});

// Update Gift/Hospitality
router.put("/gifts-hospitality/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.giftHospitality.findFirst({
      where: { id, userId: req.user!.id },
    });
    if (!existing) return res.status(404).json({ error: "Gift/hospitality record not found" });

    const schema = z.object({
      description: z.string().optional(),
      dateReceived: z.string().optional().transform(s => s ? new Date(s) : undefined),
      estimatedValue: z.number().optional(),
      giverName: z.string().optional(),
      giverDesignation: z.string().optional(),
      actionTaken: z.string().optional(),
      remarks: z.string().optional(),
    });

    const data = schema.parse(req.body);
    const updated = await prisma.giftHospitality.update({
      where: { id },
      data: data as any,
    });

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Update gift/hospitality error:", error);
    res.status(500).json({ error: "Failed to update gift/hospitality" });
  }
});

// Update Ethics Breach
router.put("/ethics-breaches/:id", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const existing = await prisma.ethicsBreach.findFirst({
      where: { id, firmId },
    });
    if (!existing) return res.status(404).json({ error: "Ethics breach not found" });

    const schema = z.object({
      reportedDate: z.string().optional().transform(s => s ? new Date(s) : undefined),
      breachType: z.string().optional(),
      description: z.string().optional(),
      personsInvolved: z.string().optional(),
      status: z.string().optional(),
      resolutionDate: z.string().optional().transform(s => s ? new Date(s) : undefined),
      actionTaken: z.string().optional(),
      remediation: z.string().optional(),
    });

    const data = schema.parse(req.body);
    const updated = await prisma.ethicsBreach.update({
      where: { id },
      data,
    });

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Update ethics breach error:", error);
    res.status(500).json({ error: "Failed to update ethics breach" });
  }
});

// Update Competency Assessment
router.put("/competency/:id", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const existing = await prisma.staffCompetency.findFirst({
      where: { id },
    });
    if (!existing) return res.status(404).json({ error: "Competency assessment not found" });
    
    const competencyUser = await prisma.user.findUnique({ where: { id: existing.userId } });
    if (!competencyUser || competencyUser.firmId !== firmId) {
      return res.status(403).json({ error: "Not authorized to update this competency record" });
    }

    const schema = z.object({
      technicalKnowledgeRating: z.string().optional(),
      industryExperienceYears: z.number().optional(),
      trainingNeedsIdentified: z.string().optional(),
      competencyGapAnalysis: z.string().optional(),
      developmentPlan: z.string().optional(),
      nextReviewDate: z.string().optional().transform(s => s ? new Date(s) : undefined),
    });

    const data = schema.parse(req.body);
    const updated = await prisma.staffCompetency.update({
      where: { id },
      data: data as any,
    });

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Update competency assessment error:", error);
    res.status(500).json({ error: "Failed to update competency assessment" });
  }
});

// Update Training
router.put("/training/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.trainingCPD.findFirst({
      where: { id, userId: req.user!.id },
    });
    if (!existing) return res.status(404).json({ error: "Training record not found" });

    const schema = z.object({
      trainingDate: z.string().optional().transform(s => s ? new Date(s) : undefined),
      trainingType: z.string().optional(),
      topic: z.string().optional(),
      provider: z.string().optional(),
      durationHours: z.number().optional(),
      cpdHoursClaimed: z.number().optional(),
    });

    const data = schema.parse(req.body);
    const updated = await prisma.trainingCPD.update({
      where: { id },
      data: data as any,
    });

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Update training error:", error);
    res.status(500).json({ error: "Failed to update training" });
  }
});

// Update Monitoring Plan
router.put("/monitoring/plans/:id", requireAuth, requireRoles("PARTNER", "ADMIN"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const existing = await prisma.monitoringPlan.findFirst({
      where: { id, firmId },
    });
    if (!existing) return res.status(404).json({ error: "Monitoring plan not found" });

    const schema = z.object({
      planYear: z.number().optional(),
      scopeOfMonitoring: z.string().optional(),
      monitoringMethodology: z.string().optional(),
      plannedStartDate: z.string().optional().transform(s => s ? new Date(s) : undefined),
      plannedEndDate: z.string().optional().transform(s => s ? new Date(s) : undefined),
      resourcesAllocated: z.string().optional(),
    });

    const data = schema.parse(req.body);
    const updated = await prisma.monitoringPlan.update({
      where: { id },
      data,
    });

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Update monitoring plan error:", error);
    res.status(500).json({ error: "Failed to update monitoring plan" });
  }
});

// Update Deficiency
router.put("/deficiencies/:id", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const existing = await prisma.qualityDeficiency.findFirst({
      where: { id, firmId },
    });
    if (!existing) return res.status(404).json({ error: "Deficiency not found" });

    const schema = z.object({
      sourceType: z.string().optional(),
      severity: z.string().optional(),
      deficiencyDescription: z.string().optional(),
      rootCauseAnalysis: z.string().optional(),
      pervasiveness: z.string().optional(),
      targetResolutionDate: z.string().optional().transform(s => s ? new Date(s) : undefined),
    });

    const data = schema.parse(req.body);
    const updated = await prisma.qualityDeficiency.update({
      where: { id },
      data: data as any,
    });

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Update deficiency error:", error);
    res.status(500).json({ error: "Failed to update deficiency" });
  }
});

// Update Quality Objective
router.put("/quality-objectives/:id", requireAuth, requireRoles("PARTNER", "ADMIN"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const existing = await prisma.qualityObjective.findFirst({
      where: { id, firmId },
    });
    if (!existing) return res.status(404).json({ error: "Quality objective not found" });

    const schema = z.object({
      isqmComponent: z.string().optional(),
      objectiveCode: z.string().optional(),
      objectiveDescription: z.string().optional(),
      effectiveFrom: z.string().optional().transform(s => s ? new Date(s) : undefined),
      isMandatory: z.boolean().optional(),
    });

    const data = schema.parse(req.body);
    const updated = await prisma.qualityObjective.update({
      where: { id },
      data: data as any,
    });

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Update quality objective error:", error);
    res.status(500).json({ error: "Failed to update quality objective" });
  }
});

// Update Policy
router.put("/policies/:id", requireAuth, requireRoles("PARTNER", "ADMIN"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const existing = await prisma.policyDocument.findFirst({
      where: { id, firmId },
    });
    if (!existing) return res.status(404).json({ error: "Policy not found" });

    const schema = z.object({
      policyCategory: z.string().optional(),
      policyNumber: z.string().optional(),
      policyName: z.string().optional(),
      versionNumber: z.string().optional(),
      effectiveDate: z.string().optional().transform(s => s ? new Date(s) : undefined),
      reviewDate: z.string().optional().transform(s => s ? new Date(s) : undefined),
    });

    const data = schema.parse(req.body);
    const updated = await prisma.policyDocument.update({
      where: { id },
      data: data as any,
    });

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Update policy error:", error);
    res.status(500).json({ error: "Failed to update policy" });
  }
});

export default router;
