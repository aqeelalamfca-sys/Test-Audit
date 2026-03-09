import { Router, Response } from "express";
import { prePlanningService } from "./services/prePlanningService";
import { requireAuth, type AuthenticatedRequest } from "./auth";
import { prisma } from "./db";

const db = prisma as any;
const router = Router();

router.post("/initialize/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { isNewClient } = req.body;

    await prePlanningService.initializeGates(engagementId, isNewClient !== false);

    res.json({ success: true, message: "Pre-planning gates initialized" });
  } catch (error: any) {
    console.error("Error initializing pre-planning gates:", error);
    res.status(500).json({ error: error.message || "Failed to initialize pre-planning gates" });
  }
});

router.get("/status/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const status = await prePlanningService.getPrePlanningStatus(engagementId);
    res.json(status);
  } catch (error: any) {
    console.error("Error getting pre-planning status:", error);
    res.status(500).json({ error: error.message || "Failed to get pre-planning status" });
  }
});

router.get("/can-proceed/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const result = await prePlanningService.canProceedToPlanning(engagementId);
    res.json(result);
  } catch (error: any) {
    console.error("Error checking if can proceed to planning:", error);
    res.status(500).json({ error: error.message || "Failed to check planning access" });
  }
});

router.get("/gate/:gateId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { gateId } = req.params;
    const gate = await prePlanningService.getGateDetails(gateId);
    
    if (!gate) {
      return res.status(404).json({ error: "Gate not found" });
    }
    
    res.json(gate);
  } catch (error: any) {
    console.error("Error getting gate details:", error);
    res.status(500).json({ error: error.message || "Failed to get gate details" });
  }
});

router.put("/checklist-item/:itemId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { itemId } = req.params;
    const userId = req.user!.id;
    const { isCompleted, isNotApplicable, notApplicableReason, response, notes, documentIds } = req.body;

    const updated = await prePlanningService.updateChecklistItem(itemId, userId, {
      isCompleted,
      isNotApplicable,
      notApplicableReason,
      response,
      notes,
      documentIds
    });

    res.json(updated);
  } catch (error: any) {
    console.error("Error updating checklist item:", error);
    res.status(500).json({ error: error.message || "Failed to update checklist item" });
  }
});

router.post("/gate/:gateId/review", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { gateId } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const { approved, comments } = req.body;

    const result = await prePlanningService.reviewGate(gateId, userId, userRole, approved, comments);
    res.json(result);
  } catch (error: any) {
    console.error("Error reviewing gate:", error);
    res.status(500).json({ error: error.message || "Failed to review gate" });
  }
});

router.post("/gate/:gateId/signoff", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { gateId } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const { comments, partnerPinUsed } = req.body;
    const ipAddress = req.ip;
    const userAgent = req.headers["user-agent"];

    const signOff = await prePlanningService.signOffGate(gateId, userId, userRole, {
      comments,
      partnerPinUsed,
      ipAddress,
      userAgent
    });

    res.json(signOff);
  } catch (error: any) {
    console.error("Error signing off gate:", error);
    res.status(500).json({ error: error.message || "Failed to sign off gate" });
  }
});

router.get("/acceptance-decision/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const decision = await prePlanningService.getAcceptanceContinuanceDecision(engagementId);
    res.json(decision || {});
  } catch (error: any) {
    console.error("Error getting acceptance decision:", error);
    res.status(500).json({ error: error.message || "Failed to get acceptance decision" });
  }
});

router.put("/acceptance-decision/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const userId = req.user!.id;
    const firmId = req.user!.firmId;

    if (!firmId) {
      return res.status(400).json({ error: "User must be associated with a firm" });
    }

    const decision = await prePlanningService.updateAcceptanceContinuanceDecision(
      engagementId,
      firmId,
      userId,
      req.body
    );

    res.json(decision);
  } catch (error: any) {
    console.error("Error updating acceptance decision:", error);
    res.status(500).json({ error: error.message || "Failed to update acceptance decision" });
  }
});

router.post("/finalize/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const { comments, partnerPinUsed } = req.body;
    const ipAddress = req.ip;
    const userAgent = req.headers["user-agent"];

    const result = await prePlanningService.finalizePrePlanning(engagementId, userId, userRole, {
      comments,
      partnerPinUsed,
      ipAddress,
      userAgent
    });

    res.json(result);
  } catch (error: any) {
    console.error("Error finalizing pre-planning:", error);
    res.status(500).json({ error: error.message || "Failed to finalize pre-planning" });
  }
});

router.get("/context/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;

    const engagement = await db.engagement.findUnique({
      where: { id: engagementId },
      include: {
        client: true,
        clientMaster: {
          include: {
            owners: true,
            directors: true,
            contacts: true,
          },
        },
        team: {
          include: {
            user: {
              select: { id: true, fullName: true, email: true, role: true },
            },
          },
        },
      },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const tbBalances = await db.importAccountBalance.findMany({
      where: { engagementId, balanceType: "CB" },
      select: {
        accountCode: true,
        accountName: true,
        accountClass: true,
        accountSubclass: true,
        fsHeadKey: true,
        debitAmount: true,
        creditAmount: true,
      },
    });

    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    let totalRevenue = 0;
    let totalExpenses = 0;
    let totalDebit = 0;
    let totalCredit = 0;

    for (const bal of tbBalances) {
      const debit = parseFloat(String(bal.debitAmount || 0));
      const credit = parseFloat(String(bal.creditAmount || 0));
      totalDebit += debit;
      totalCredit += credit;
      const net = debit - credit;

      switch (bal.accountClass) {
        case "ASSET":
          totalAssets += net;
          break;
        case "LIABILITY":
          totalLiabilities += Math.abs(net);
          break;
        case "EQUITY":
          totalEquity += Math.abs(net);
          break;
        case "INCOME":
          totalRevenue += Math.abs(net);
          break;
        case "EXPENSE":
          totalExpenses += net;
          break;
      }
    }

    const profitBeforeTax = totalRevenue - totalExpenses;
    const grossProfit = totalRevenue - totalExpenses;

    const glEntryCount = await db.gLEntry.count({
      where: { engagementId },
    });

    let priorYearData: any = null;
    if (engagement.client?.id) {
      const priorEngagement = await db.engagement.findFirst({
        where: {
          clientId: engagement.client.id,
          id: { not: engagementId },
          status: { in: ["COMPLETED", "ARCHIVED"] },
        },
        orderBy: { periodEnd: "desc" },
        select: {
          id: true,
          engagementCode: true,
          periodStart: true,
          periodEnd: true,
          riskRating: true,
          status: true,
          acceptanceDecision: true,
        },
      });

      if (priorEngagement) {
        const priorTbBalances = await db.importAccountBalance.findMany({
          where: { engagementId: priorEngagement.id, balanceType: "CB" },
          select: {
            accountClass: true,
            debitAmount: true,
            creditAmount: true,
          },
        });

        let priorRevenue = 0;
        let priorAssets = 0;
        let priorExpenses = 0;
        let priorLiabilities = 0;
        let priorEquity = 0;

        for (const bal of priorTbBalances) {
          const debit = parseFloat(String(bal.debitAmount || 0));
          const credit = parseFloat(String(bal.creditAmount || 0));
          const net = debit - credit;

          if (bal.accountClass === "INCOME") priorRevenue += Math.abs(net);
          if (bal.accountClass === "ASSET") priorAssets += net;
          if (bal.accountClass === "EXPENSE") priorExpenses += net;
          if (bal.accountClass === "LIABILITY") priorLiabilities += Math.abs(net);
          if (bal.accountClass === "EQUITY") priorEquity += Math.abs(net);
        }

        const [priorPrePlanningData, priorMisstatements, priorControlDeficiencies] = await Promise.all([
          db.workspaceModuleData.findUnique({
            where: {
              engagementId_pageKey: {
                engagementId: priorEngagement.id,
                pageKey: "pre-planning",
              },
            },
            select: { data: true, isDraft: true },
          }),
          db.misstatement.findMany({
            where: { engagementId: priorEngagement.id },
            select: {
              id: true,
              misstatementReference: true,
              fsArea: true,
              accountName: true,
              misstatementType: true,
              status: true,
              misstatementAmount: true,
              description: true,
              affectedAssertions: true,
              isAboveTrivialThreshold: true,
              isAbovePM: true,
              isAboveOverallMateriality: true,
            },
          }),
          db.controlDeficiency.findMany({
            where: { engagementId: priorEngagement.id },
            select: {
              id: true,
              deficiencyReference: true,
              cycle: true,
              deficiencyDescription: true,
              severity: true,
              affectedAccounts: true,
              affectedAssertions: true,
              remediationStatus: true,
              impactOnAuditApproach: true,
            },
          }),
        ]);

        const misstatementSummary = {
          count: priorMisstatements.length,
          totalAmount: priorMisstatements.reduce(
            (sum: number, m: any) => sum + parseFloat(String(m.misstatementAmount || 0)),
            0
          ),
          byArea: priorMisstatements.reduce((acc: any, m: any) => {
            if (!acc[m.fsArea]) acc[m.fsArea] = { count: 0, totalAmount: 0 };
            acc[m.fsArea].count++;
            acc[m.fsArea].totalAmount += parseFloat(String(m.misstatementAmount || 0));
            return acc;
          }, {}),
          items: priorMisstatements,
        };

        priorYearData = {
          engagementId: priorEngagement.id,
          engagementCode: priorEngagement.engagementCode,
          periodStart: priorEngagement.periodStart,
          periodEnd: priorEngagement.periodEnd,
          riskRating: priorEngagement.riskRating,
          status: priorEngagement.status,
          acceptanceDecision: priorEngagement.acceptanceDecision,
          financials: {
            revenue: priorRevenue,
            totalAssets: priorAssets,
            totalLiabilities: priorLiabilities,
            totalEquity: priorEquity,
            totalExpenses: priorExpenses,
            profitBeforeTax: priorRevenue - priorExpenses,
          },
          prePlanningData: priorPrePlanningData?.data || null,
          prePlanningIsDraft: priorPrePlanningData?.isDraft ?? null,
          misstatements: misstatementSummary,
          controlDeficiencies: priorControlDeficiencies,
        };
      }
    }

    const obBalances = await db.importAccountBalance.findMany({
      where: { engagementId, balanceType: "OB" },
      select: {
        accountCode: true,
        accountName: true,
        accountClass: true,
        debitAmount: true,
        creditAmount: true,
      },
    });

    let obTotalDebit = 0;
    let obTotalCredit = 0;
    for (const bal of obBalances) {
      obTotalDebit += parseFloat(String(bal.debitAmount || 0));
      obTotalCredit += parseFloat(String(bal.creditAmount || 0));
    }

    const context = {
      engagement: {
        id: engagement.id,
        engagementCode: engagement.engagementCode,
        engagementType: engagement.engagementType,
        reportingFramework: engagement.reportingFramework,
        currentPhase: engagement.currentPhase,
        status: engagement.status,
        riskRating: engagement.riskRating,
        periodStart: engagement.periodStart,
        periodEnd: engagement.periodEnd,
        fiscalYearEnd: engagement.fiscalYearEnd,
        priorAuditor: engagement.priorAuditor,
        priorAuditorReason: engagement.priorAuditorReason,
        eqcrRequired: engagement.eqcrRequired,
        eqcrRationale: engagement.eqcrRationale,
        isGroupAudit: engagement.isGroupAudit,
        isComponentAudit: engagement.isComponentAudit,
        budgetHours: engagement.budgetHours,
        shareCapital: engagement.shareCapital,
        numberOfEmployees: engagement.numberOfEmployees,
        lastYearRevenue: engagement.lastYearRevenue,
        previousYearRevenue: engagement.previousYearRevenue,
      },
      client: engagement.client
        ? {
            id: engagement.client.id,
            name: engagement.client.name,
            tradingName: engagement.client.tradingName,
            industry: engagement.client.industry,
            subIndustry: engagement.client.subIndustry,
          }
        : null,
      clientMaster: engagement.clientMaster
        ? {
            legalName: engagement.clientMaster.legalName,
            tradeName: engagement.clientMaster.tradeName,
            ntn: engagement.clientMaster.ntn,
            strn: engagement.clientMaster.strn,
            secpRegNo: engagement.clientMaster.secpRegNo,
            legalForm: engagement.clientMaster.legalForm,
            dateOfIncorporation: engagement.clientMaster.dateOfIncorporation,
            registeredAddress: engagement.clientMaster.registeredAddress,
            registeredCity: engagement.clientMaster.registeredCity,
            registeredProvince: engagement.clientMaster.registeredProvince,
            businessAddress: engagement.clientMaster.businessAddress,
            phone: engagement.clientMaster.phone,
            email: engagement.clientMaster.email,
            website: engagement.clientMaster.website,
            industry: engagement.clientMaster.industry,
            subIndustry: engagement.clientMaster.subIndustry,
            natureOfBusiness: engagement.clientMaster.natureOfBusiness,
            principalLineOfBusiness: engagement.clientMaster.principalLineOfBusiness,
            regulatoryBodies: engagement.clientMaster.regulatoryBodies,
            listedStatus: engagement.clientMaster.listedStatus,
            stockExchange: engagement.clientMaster.stockExchange,
            parentCompanyName: engagement.clientMaster.parentCompanyName,
            owners: engagement.clientMaster.owners?.map((o: any) => ({
              name: o.name,
              holdingPercentage: o.holdingPercentage,
              isUBO: o.isUBO,
              isPEP: o.isPEP,
            })),
            directors: engagement.clientMaster.directors?.map((d: any) => ({
              name: d.name,
              designation: d.designation,
            })),
            contacts: engagement.clientMaster.contacts?.map((c: any) => ({
              name: c.name,
              role: c.role,
              email: c.email,
            })),
          }
        : null,
      team: engagement.team?.map((t: any) => ({
        role: t.role,
        userName: t.user?.fullName,
        userEmail: t.user?.email,
        userRole: t.user?.role,
      })),
      tbTotals: {
        totalDebit,
        totalCredit,
        totalAssets,
        totalLiabilities,
        totalEquity,
        totalRevenue,
        totalExpenses,
        profitBeforeTax,
        grossProfit,
        accountCount: tbBalances.length,
      },
      tbAccounts: tbBalances.map((bal: any) => ({
        accountCode: bal.accountCode,
        accountName: bal.accountName,
        accountClass: bal.accountClass,
        accountSubclass: bal.accountSubclass,
        fsHeadKey: bal.fsHeadKey,
        debitAmount: parseFloat(String(bal.debitAmount || 0)),
        creditAmount: parseFloat(String(bal.creditAmount || 0)),
        netBalance: parseFloat(String(bal.debitAmount || 0)) - parseFloat(String(bal.creditAmount || 0)),
      })),
      materialityBenchmarks: {
        revenue: totalRevenue,
        totalAssets,
        profitBeforeTax,
        equity: totalEquity,
        grossProfit,
      },
      glStats: {
        entryCount: glEntryCount,
      },
      openingBalances: {
        accountCount: obBalances.length,
        totalDebit: obTotalDebit,
        totalCredit: obTotalCredit,
        accounts: obBalances.map((bal: any) => ({
          accountCode: bal.accountCode,
          accountName: bal.accountName,
          accountClass: bal.accountClass,
          debitAmount: parseFloat(String(bal.debitAmount || 0)),
          creditAmount: parseFloat(String(bal.creditAmount || 0)),
          netBalance: parseFloat(String(bal.debitAmount || 0)) - parseFloat(String(bal.creditAmount || 0)),
        })),
      },
      priorYearData,
    };

    res.json(context);
  } catch (error: any) {
    console.error("Error getting pre-planning context:", error);
    res.status(500).json({ error: error.message || "Failed to get pre-planning context" });
  }
});

export default router;
