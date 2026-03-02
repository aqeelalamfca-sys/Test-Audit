import { Router, type Response } from "express";
import multer from "multer";
import { prisma } from "./db";
import { requireAuth, requireRoles, logAuditTrail, type AuthenticatedRequest } from "./auth";
import { administrationService } from "./services/administrationService";

const backupUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

const router = Router();

router.get("/stats", requireAuth, requireRoles("ADMIN", "PARTNER", "MANAGING_PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    
    const [totalUsers, totalClients, totalEngagements, activeSessions, recentAuditLogs] = await Promise.all([
      prisma.user.count({ where: firmId ? { firmId } : undefined }),
      prisma.client.count({ where: firmId ? { firmId } : undefined }),
      prisma.engagement.count({ where: firmId ? { firmId } : undefined }),
      prisma.session.count({ where: { expiresAt: { gt: new Date() } } }),
      prisma.auditTrail.findMany({
        take: 50,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { fullName: true, email: true, role: true } } }
      })
    ]);

    res.json({
      stats: {
        totalUsers,
        totalClients,
        totalEngagements,
        activeSessions
      },
      recentAuditLogs
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    res.status(500).json({ error: "Failed to fetch admin stats" });
  }
});

router.post("/initialize-data", requireAuth, requireRoles("ADMIN"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const industries = ["Manufacturing", "Retail", "Healthcare", "Technology", "Financial Services", "Real Estate", "Energy", "Telecommunications"];
    const riskLevels = ["LOW", "MEDIUM", "HIGH"] as const;
    const statuses = ["PENDING", "IN_PROGRESS", "COMPLETED", "NOT_APPLICABLE"] as const;

    const clientsCreated: string[] = [];
    for (let i = 0; i < 10; i++) {
      const client = await prisma.client.create({
        data: {
          firmId,
          name: `Sample Client ${i + 1} - ${industries[i % industries.length]}`,
          tradingName: `SC${i + 1} Trading`,
          ntn: `${1000000 + i}`,
          strn: `${2000000 + i}`,
          industry: industries[i % industries.length],
          email: `client${i + 1}@example.com`,
          phone: `+92 300 ${1234567 + i}`,
          address: `123 Business Street, Suite ${100 + i}, Karachi`,
          isActive: true,
          acceptanceStatus: "APPROVED",
        }
      });
      clientsCreated.push(client.id);
    }

    const engagementsCreated: string[] = [];
    for (let i = 0; i < clientsCreated.length; i++) {
      const fiscalYearEnd = new Date(2024, 11, 31);
      const engagement = await prisma.engagement.create({
        data: {
          firmId,
          clientId: clientsCreated[i],
          engagementCode: `ENG-2024-${String(i + 1).padStart(4, "0")}`,
          engagementType: "statutory_audit",
          status: i < 3 ? "ACTIVE" : i < 6 ? "DRAFT" : "COMPLETED",
          riskRating: riskLevels[i % 3],
          fiscalYearEnd,
          periodStart: new Date(2024, 0, 1),
          periodEnd: fiscalYearEnd,
          currentPhase: i < 3 ? "EXECUTION" : i < 6 ? "PLANNING" : "FINALIZATION",
          budgetHours: 100 + (i * 20),
          actualHours: Math.floor(Math.random() * 80),
        }
      });
      engagementsCreated.push(engagement.id);

      const phases = ["ONBOARDING", "PRE_PLANNING", "PLANNING", "EXECUTION", "FINALIZATION", "REPORTING", "EQCR", "INSPECTION"];
      for (let j = 0; j < phases.length; j++) {
        const phaseStatus = j < 3 ? "COMPLETED" : j === 3 ? "IN_PROGRESS" : "NOT_STARTED";
        await prisma.phaseProgress.create({
          data: {
            engagementId: engagement.id,
            phase: phases[j] as any,
            status: phaseStatus as any,
            completionPercentage: phaseStatus === "COMPLETED" ? 100 : phaseStatus === "IN_PROGRESS" ? Math.floor(Math.random() * 60) + 20 : 0,
            startedAt: j <= 3 ? new Date(2024, j, 1) : null,
            completedAt: phaseStatus === "COMPLETED" ? new Date(2024, j + 1, 15) : null,
          }
        });
      }

      await prisma.engagementTeam.create({
        data: {
          engagementId: engagement.id,
          userId: req.user!.id,
          role: req.user!.role,
          isLead: true,
        }
      });
    }

    const checklistSections = [
      { section: "Client Acceptance", items: ["Independence confirmed", "Engagement letter signed", "Prior auditor communication", "Risk assessment completed", "Team allocated"] },
      { section: "Planning", items: ["Materiality determined", "Audit strategy documented", "Risk assessment updated", "Audit program finalized", "Team briefing completed"] },
      { section: "Execution", items: ["Revenue testing completed", "Expense testing completed", "Asset verification done", "Liability confirmation received", "Equity roll-forward verified"] },
      { section: "Finalization", items: ["Subsequent events reviewed", "Going concern assessed", "Management representations obtained", "File assembly completed", "Partner review done"] }
    ];

    for (const engId of engagementsCreated.slice(0, 5)) {
      for (const section of checklistSections) {
        for (let idx = 0; idx < section.items.length; idx++) {
          const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
          await prisma.checklistItem.create({
            data: {
              engagementId: engId,
              phase: section.section === "Client Acceptance" ? "ONBOARDING" : section.section === "Planning" ? "PLANNING" : section.section === "Execution" ? "EXECUTION" : "FINALIZATION",
              section: section.section,
              title: section.items[idx],
              description: `Detailed procedure for: ${section.items[idx]}`,
              isaReference: `ISA ${300 + idx * 10}`,
              status: randomStatus,
              orderIndex: idx,
              notes: randomStatus === "COMPLETED" ? "Completed as per audit plan" : randomStatus === "NOT_APPLICABLE" ? "Not applicable for this engagement" : null,
              completedById: randomStatus === "COMPLETED" ? req.user!.id : null,
              completedAt: randomStatus === "COMPLETED" ? new Date() : null,
            }
          });
        }
      }
    }

    for (const engId of engagementsCreated.slice(0, 5)) {
      const noteTypes = ["Query", "Recommendation", "Finding", "Observation"];
      const severities = ["INFO", "WARNING", "CRITICAL"] as const;
      for (let n = 0; n < 5; n++) {
        await prisma.reviewNote.create({
          data: {
            engagementId: engId,
            phase: "EXECUTION",
            content: `${noteTypes[n % 4]}: Sample review note ${n + 1} for engagement review process`,
            severity: severities[n % 3],
            status: n < 2 ? "OPEN" : n < 4 ? "ADDRESSED" : "CLEARED",
            authorId: req.user!.id,
            resolvedById: n >= 2 ? req.user!.id : null,
            resolvedAt: n >= 2 ? new Date() : null,
          }
        });
      }
    }


    await logAuditTrail(
      req.user!.id,
      "DATA_INITIALIZATION",
      "system",
      undefined,
      undefined,
      { clientsCreated: clientsCreated.length, engagementsCreated: engagementsCreated.length },
      undefined,
      "Admin initialized sample audit data",
      req.ip,
      req.get("user-agent")
    );

    res.json({
      success: true,
      message: "Database populated with comprehensive audit data",
      summary: {
        clientsCreated: clientsCreated.length,
        engagementsCreated: engagementsCreated.length,
        checklistItemsCreated: checklistSections.reduce((acc, s) => acc + s.items.length, 0) * 5,
        reviewNotesCreated: 25,
        documentsCreated: 15
      }
    });
  } catch (error) {
    console.error("Data initialization error:", error);
    res.status(500).json({ error: "Failed to initialize data", details: String(error) });
  }
});

router.get("/audit-logs", requireAuth, requireRoles("ADMIN", "PARTNER", "MANAGING_PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;
    const engagementId = req.query.engagementId as string | undefined;
    const clientId = req.query.clientId as string | undefined;
    const action = req.query.action as string | undefined;
    const entityType = req.query.entityType as string | undefined;
    const userId = req.query.userId as string | undefined;

    const where: any = {};
    if (engagementId) where.engagementId = engagementId;
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (userId) where.userId = userId;

    if (clientId) {
      const engagements = await prisma.engagement.findMany({
        where: { clientId },
        select: { id: true },
      });
      where.engagementId = { in: engagements.map(e => e.id) };
    }

    const [logs, total] = await Promise.all([
      prisma.auditTrail.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { fullName: true, email: true, role: true } },
          engagement: { select: { engagementCode: true, client: { select: { name: true } } } },
        }
      }),
      prisma.auditTrail.count({ where })
    ]);

    res.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("Audit logs error:", error);
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});

router.get("/users-summary", requireAuth, requireRoles("ADMIN", "PARTNER", "MANAGING_PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    
    const users = await prisma.user.findMany({
      where: firmId ? { firmId } : undefined,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" }
    });

    const roleDistribution = await prisma.user.groupBy({
      by: ["role"],
      where: firmId ? { firmId } : undefined,
      _count: true
    });

    res.json({ users, roleDistribution });
  } catch (error) {
    console.error("Users summary error:", error);
    res.status(500).json({ error: "Failed to fetch users summary" });
  }
});

// ============================================
// FIRM SETTINGS (Administration Module)
// ============================================

router.get("/firm-settings", requireAuth, requireRoles("ADMIN", "MANAGING_PARTNER", "PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }
    const settings = await administrationService.getFirmSettings(firmId);
    res.json(settings);
  } catch (error) {
    console.error("Error fetching firm settings:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.put("/firm-settings", requireAuth, requireRoles("ADMIN", "MANAGING_PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    if (!user.firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const { changeReason, ...updates } = req.body;
    const settings = await administrationService.updateFirmSettings(
      user.firmId,
      updates,
      user.id,
      user.role,
      changeReason,
      req.ip || undefined,
      req.headers["user-agent"] || undefined
    );
    res.json(settings);
  } catch (error) {
    console.error("Error updating firm settings:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.get("/firm-profile", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const firm = await prisma.firm.findUnique({
      where: { id: firmId },
      select: {
        id: true, name: true, licenseNo: true, address: true, phone: true, email: true,
        establishmentDate: true, registrationNumber: true, taxId: true, regulatoryBody: true,
        website: true, country: true, city: true, headOfficeAddress: true, logoUrl: true,
        numberOfPartners: true, partners: true, offices: true,
      }
    });
    if (!firm) return res.status(404).json({ error: "Firm not found" });
    res.json(firm);
  } catch (error) {
    console.error("Error fetching firm profile:", error);
    res.status(500).json({ error: "Failed to fetch firm profile" });
  }
});

router.put("/firm-profile", requireAuth, requireRoles("ADMIN", "MANAGING_PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const {
      name, licenseNo, address, phone, email, establishmentDate,
      registrationNumber, taxId, regulatoryBody, website, country, city,
      headOfficeAddress, logoUrl, numberOfPartners, partners, offices
    } = req.body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (licenseNo !== undefined) updateData.licenseNo = licenseNo;
    if (address !== undefined) updateData.address = address;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (establishmentDate !== undefined) updateData.establishmentDate = establishmentDate ? new Date(establishmentDate) : null;
    if (registrationNumber !== undefined) updateData.registrationNumber = registrationNumber;
    if (taxId !== undefined) updateData.taxId = taxId;
    if (regulatoryBody !== undefined) updateData.regulatoryBody = regulatoryBody;
    if (website !== undefined) updateData.website = website;
    if (country !== undefined) updateData.country = country;
    if (city !== undefined) updateData.city = city;
    if (headOfficeAddress !== undefined) updateData.headOfficeAddress = headOfficeAddress;
    if (logoUrl !== undefined) updateData.logoUrl = logoUrl;
    if (numberOfPartners !== undefined) updateData.numberOfPartners = numberOfPartners ? parseInt(numberOfPartners) : null;
    if (partners !== undefined) updateData.partners = partners;
    if (offices !== undefined) updateData.offices = offices;

    const firm = await prisma.firm.update({
      where: { id: firmId },
      data: updateData,
    });

    await logAuditTrail(
      req.user!.id,
      "UPDATE",
      "FirmProfile",
      firmId,
      undefined,
      updateData,
      undefined,
      "Firm profile updated",
      req.ip || undefined,
      req.headers["user-agent"] || undefined
    );

    res.json(firm);
  } catch (error) {
    console.error("Error updating firm profile:", error);
    res.status(500).json({ error: "Failed to update firm profile" });
  }
});

router.get("/firm-settings/history", requireAuth, requireRoles("ADMIN", "MANAGING_PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }
    const limit = parseInt(req.query.limit as string) || 50;
    const history = await administrationService.getFirmSettingsHistory(firmId, limit);
    res.json(history);
  } catch (error) {
    console.error("Error fetching settings history:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// ============================================
// ROLE CONFIGURATIONS
// ============================================

router.get("/role-configurations", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }
    const roles = await administrationService.getRoleConfigurations(firmId);
    res.json(roles);
  } catch (error) {
    console.error("Error fetching role configurations:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.put("/role-configurations/:role", requireAuth, requireRoles("ADMIN", "MANAGING_PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    if (!user.firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const roleConfig = await administrationService.updateRoleConfiguration(
      user.firmId,
      req.params.role as any,
      req.body,
      user.id,
      user.role,
      req.ip || undefined,
      req.headers["user-agent"] || undefined
    );
    res.json(roleConfig);
  } catch (error) {
    console.error("Error updating role configuration:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// ============================================
// GOVERNANCE POLICIES
// ============================================

router.get("/governance-policies", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }
    const policies = await administrationService.getGovernancePolicies(firmId);
    res.json(policies);
  } catch (error) {
    console.error("Error fetching governance policies:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.post("/governance-policies", requireAuth, requireRoles("ADMIN", "MANAGING_PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    if (!user.firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const policy = await administrationService.createGovernancePolicy(
      user.firmId,
      req.body,
      user.id,
      user.role,
      req.ip || undefined,
      req.headers["user-agent"] || undefined
    );
    res.json(policy);
  } catch (error) {
    console.error("Error creating governance policy:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.put("/governance-policies/:policyCode", requireAuth, requireRoles("ADMIN", "MANAGING_PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    if (!user.firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const policy = await administrationService.updateGovernancePolicy(
      user.firmId,
      req.params.policyCode,
      req.body,
      user.id,
      user.role,
      req.ip || undefined,
      req.headers["user-agent"] || undefined
    );
    res.json(policy);
  } catch (error) {
    console.error("Error updating governance policy:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// ============================================
// DOCUMENT TEMPLATES
// ============================================

router.get("/document-templates", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }
    const category = req.query.category as string | undefined;
    const templates = await administrationService.getDocumentTemplates(firmId, category);
    res.json(templates);
  } catch (error) {
    console.error("Error fetching document templates:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.post("/document-templates", requireAuth, requireRoles("ADMIN", "MANAGING_PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    if (!user.firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const template = await administrationService.createDocumentTemplate(
      user.firmId,
      req.body,
      user.id,
      user.role,
      req.ip || undefined,
      req.headers["user-agent"] || undefined
    );
    res.json(template);
  } catch (error) {
    console.error("Error creating document template:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.put("/document-templates/:templateCode", requireAuth, requireRoles("ADMIN", "MANAGING_PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    if (!user.firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const template = await administrationService.updateDocumentTemplate(
      user.firmId,
      req.params.templateCode,
      req.body,
      user.id,
      user.role,
      req.ip || undefined,
      req.headers["user-agent"] || undefined
    );
    res.json(template);
  } catch (error) {
    console.error("Error updating document template:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// ============================================
// ENGAGEMENT FLAGS (QR/EQCR Configuration)
// ============================================

router.get("/engagement-flags", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }
    const flags = await administrationService.getEngagementFlagConfigs(firmId);
    res.json(flags);
  } catch (error) {
    console.error("Error fetching engagement flags:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.post("/engagement-flags", requireAuth, requireRoles("ADMIN", "MANAGING_PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    if (!user.firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const flag = await administrationService.createEngagementFlagConfig(
      user.firmId,
      req.body,
      user.id,
      user.role,
      req.ip || undefined,
      req.headers["user-agent"] || undefined
    );
    res.json(flag);
  } catch (error) {
    console.error("Error creating engagement flag:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.put("/engagement-flags/:flagCode", requireAuth, requireRoles("ADMIN", "MANAGING_PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    if (!user.firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const flag = await administrationService.updateEngagementFlagConfig(
      user.firmId,
      req.params.flagCode,
      req.body,
      user.id,
      user.role,
      req.ip || undefined,
      req.headers["user-agent"] || undefined
    );
    res.json(flag);
  } catch (error) {
    console.error("Error updating engagement flag:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.post("/engagement-flags/evaluate", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const result = await administrationService.evaluateEngagementFlags(firmId, req.body);
    res.json(result);
  } catch (error) {
    console.error("Error evaluating engagement flags:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// ============================================
// USER ROLE MANAGEMENT
// ============================================

router.put("/users/:userId/role", requireAuth, requireRoles("ADMIN", "MANAGING_PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    if (!user.firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const { role, reason } = req.body;
    const updated = await administrationService.updateUserRole(
      user.firmId,
      req.params.userId,
      role,
      user.id,
      user.role,
      reason,
      req.ip || undefined,
      req.headers["user-agent"] || undefined
    );
    res.json(updated);
  } catch (error) {
    console.error("Error updating user role:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.get("/users/:userId/permission-overrides", requireAuth, requireRoles("ADMIN", "MANAGING_PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const overrides = await administrationService.getPermissionOverridesForUser(req.params.userId);
    res.json(overrides);
  } catch (error) {
    console.error("Error fetching permission overrides:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.post("/users/:userId/permission-overrides", requireAuth, requireRoles("ADMIN", "MANAGING_PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    if (!user.firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const { permissionId, isGranted, reason, expiresAt } = req.body;
    const override = await administrationService.createPermissionOverride(
      user.firmId,
      req.params.userId,
      permissionId,
      isGranted,
      user.id,
      user.role,
      reason,
      expiresAt ? new Date(expiresAt) : undefined,
      req.ip || undefined,
      req.headers["user-agent"] || undefined
    );
    res.json(override);
  } catch (error) {
    console.error("Error creating permission override:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// ============================================
// ADMINISTRATION AUDIT LOG
// ============================================

router.get("/admin-audit-log", requireAuth, requireRoles("ADMIN", "MANAGING_PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const filters = {
      entityType: req.query.entityType as string | undefined,
      userId: req.query.userId as string | undefined,
      action: req.query.action as string | undefined,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      limit: parseInt(req.query.limit as string) || 100
    };

    const logs = await administrationService.getAdminAuditLog(firmId, filters);
    res.json(logs);
  } catch (error) {
    console.error("Error fetching admin audit log:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// ============================================
// MAKER-CHECKER CONFIGURATION
// ============================================

router.get("/maker-checker/mode", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }
    const mode = await administrationService.getMakerCheckerMode(firmId);
    res.json({ mode });
  } catch (error) {
    console.error("Error fetching maker-checker mode:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.post("/maker-checker/check-required", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }
    const { entityType } = req.body;
    const required = await administrationService.checkMakerCheckerRequired(firmId, entityType);
    res.json({ required });
  } catch (error) {
    console.error("Error checking maker-checker requirement:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// ============================================
// ROLE PERMISSIONS MANAGEMENT
// ============================================

router.get("/role-permissions/:role", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const role = req.params.role;

    const rolePermissions = await prisma.rolePermission.findMany({
      where: {
        role: role as any,
        OR: [
          { firmId: null },
          { firmId: user.firmId }
        ]
      },
      include: { permission: true }
    });
    res.json(rolePermissions);
  } catch (error) {
    console.error("Error fetching role permissions:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.put("/role-permissions", requireAuth, requireRoles("ADMIN", "MANAGING_PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    if (!user.firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const { role, permissionId, isGranted } = req.body;

    const existing = await prisma.rolePermission.findFirst({
      where: {
        role: role as any,
        permissionId,
        firmId: user.firmId
      }
    });

    let result;
    if (existing) {
      result = await prisma.rolePermission.update({
        where: { id: existing.id },
        data: { isGranted }
      });
    } else {
      result = await prisma.rolePermission.create({
        data: {
          role: role as any,
          permissionId,
          firmId: user.firmId,
          isGranted
        }
      });
    }

    await administrationService.logAdminAction({
      firmId: user.firmId,
      action: isGranted ? "GRANT_ROLE_PERMISSION" : "REVOKE_ROLE_PERMISSION",
      entityType: "RolePermission",
      entityId: result.id,
      entityName: `${role} - ${permissionId}`,
      newValue: { role, permissionId, isGranted },
      module: "ADMINISTRATION",
      screen: "Role Permissions",
      userId: user.id,
      userRole: user.role,
      ipAddress: req.ip || undefined,
      userAgent: req.headers["user-agent"] || undefined
    });

    res.json(result);
  } catch (error) {
    console.error("Error updating role permission:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.get("/backup/download", requireAuth, requireRoles("ADMIN"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    const [
      firm, firmSettings, users, clients, engagements, documentTemplates,
      aiSettings, roleConfigurations
    ] = await Promise.all([
      prisma.firm.findUnique({ where: { id: firmId } }),
      prisma.firmSettings.findFirst({ where: { firmId } }),
      prisma.user.findMany({ where: { firmId }, select: { id: true, email: true, username: true, fullName: true, role: true, isActive: true, createdAt: true } }),
      prisma.client.findMany({ where: { firmId } }),
      prisma.engagement.findMany({ where: { firmId } }),
      (prisma as any).documentTemplate?.findMany({ where: { firmId } }) || [],
      prisma.aISettings.findFirst({ where: { firmId }, select: { aiEnabled: true, preferredProvider: true, providerPriority: true, openaiEnabled: true, geminiEnabled: true, deepseekEnabled: true, maxTokensPerResponse: true, autoSuggestionsEnabled: true, manualTriggerOnly: true, requestTimeout: true } }),
      prisma.roleConfiguration.findMany({ where: { firmId } }),
    ]);

    const backup = {
      meta: {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        exportedBy: req.user!.email,
        firmId,
        firmName: firm?.name || "Unknown",
        platform: "AuditWise",
      },
      firm,
      firmSettings,
      users,
      clients,
      engagements,
      documentTemplates,
      aiSettings,
      roleConfigurations,
    };

    const filename = `auditwise-backup-${firm?.name?.replace(/[^a-zA-Z0-9]/g, "_") || "firm"}-${new Date().toISOString().split("T")[0]}.json`;

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(JSON.stringify(backup, null, 2));
  } catch (error) {
    console.error("Backup download error:", error);
    res.status(500).json({ error: "Failed to generate backup" });
  }
});

router.post("/backup/restore", requireAuth, requireRoles("ADMIN"), backupUpload.single("backup"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

    if (!req.file) return res.status(400).json({ error: "No backup file uploaded" });

    let backup: any;
    try {
      backup = JSON.parse(req.file.buffer.toString("utf-8"));
    } catch {
      return res.status(400).json({ error: "Invalid backup file format. Must be a valid JSON file." });
    }

    if (!backup.meta || backup.meta.platform !== "AuditWise") {
      return res.status(400).json({ error: "Invalid backup file. This does not appear to be an AuditWise backup." });
    }

    const restored: string[] = [];
    const errors: string[] = [];

    if (backup.firm) {
      try {
        const { id, createdAt, updatedAt, ...firmData } = backup.firm;
        await prisma.firm.update({ where: { id: firmId }, data: firmData });
        restored.push("Firm profile");
      } catch (e: any) { errors.push(`Firm profile: ${e.message}`); }
    }

    if (backup.firmSettings) {
      try {
        const { id, firmId: _, createdAt, updatedAt, ...settingsData } = backup.firmSettings;
        await prisma.firmSettings.upsert({
          where: { firmId },
          create: { firmId, ...settingsData },
          update: settingsData,
        });
        restored.push("Firm settings");
      } catch (e: any) { errors.push(`Firm settings: ${e.message}`); }
    }

    if (backup.clients?.length) {
      let clientCount = 0;
      for (const client of backup.clients) {
        try {
          const { id, firmId: _, createdAt, updatedAt, ...clientData } = client;
          const existing = await prisma.client.findFirst({
            where: { firmId, name: clientData.name },
          });
          if (!existing) {
            await prisma.client.create({ data: { ...clientData, firmId } });
            clientCount++;
          }
        } catch (e: any) { errors.push(`Client ${client.name}: ${e.message}`); }
      }
      if (clientCount > 0) restored.push(`${clientCount} clients`);
    }

    if (backup.documentTemplates?.length) {
      let templateCount = 0;
      for (const template of backup.documentTemplates) {
        try {
          const { id, firmId: _, createdAt, updatedAt, createdById, updatedById, ...templateData } = template;
          const existing = await (prisma as any).documentTemplate?.findFirst({
            where: { firmId, templateCode: templateData.templateCode },
          });
          if (!existing) {
            await (prisma as any).documentTemplate?.create({ data: { ...templateData, firmId } });
            templateCount++;
          }
        } catch (e: any) { errors.push(`Template ${template.templateCode}: ${e.message}`); }
      }
      if (templateCount > 0) restored.push(`${templateCount} document templates`);
    }

    if (backup.roleConfigurations?.length) {
      let roleCount = 0;
      for (const config of backup.roleConfigurations) {
        try {
          const { id, firmId: _, ...configData } = config;
          const existing = await prisma.roleConfiguration.findFirst({
            where: { firmId, role: configData.role },
          });
          if (!existing) {
            await prisma.roleConfiguration.create({ data: { ...configData, firmId } });
            roleCount++;
          }
        } catch (e: any) { errors.push(`Role config ${config.role}: ${e.message}`); }
      }
      if (roleCount > 0) restored.push(`${roleCount} role configurations`);
    }

    await logAuditTrail(
      req.user!.id, "RESTORE", "Backup", firmId, undefined,
      { restored, errors, backupMeta: backup.meta },
      undefined, "Backup restored",
      req.ip || undefined, req.headers["user-agent"] || undefined
    );

    res.json({
      success: true,
      restored,
      errors,
      message: errors.length > 0
        ? `Restored: ${restored.join(", ")}. ${errors.length} item(s) had issues.`
        : `Successfully restored: ${restored.join(", ")}.`,
    });
  } catch (error) {
    console.error("Backup restore error:", error);
    res.status(500).json({ error: "Failed to restore backup" });
  }
});

export default router;
