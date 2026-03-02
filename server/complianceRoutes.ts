import { Router, type Response } from "express";
import { prisma } from "./db";
import { requireAuth, requireRoles, requireMinRole, type AuthenticatedRequest } from "./auth";

const router = Router();

const FEE_DEPENDENCY_THRESHOLD = 15;
const PARTNER_ROTATION_YEARS = 5;

interface EngagementWithBudget {
  id: string;
  engagementCode: string;
  budgetHours: number | null;
  actualHours: number | null;
  fiscalYearEnd: Date | null;
  status: string;
}

interface PartnerRotationResult {
  partner: { id: string; fullName: string; email: string };
  totalClients: number;
  clientsDueForRotation: Array<{
    clientId: string;
    clientName: string;
    years: number;
    firstEngagementDate: Date;
    engagementCount: number;
    yearsOverLimit: number;
    status: string;
  }>;
  clientsApproachingRotation: Array<{
    clientId: string;
    clientName: string;
    years: number;
    firstEngagementDate: Date;
    engagementCount: number;
    yearsUntilRotation: number;
  }>;
  hasRotationIssues: boolean;
}

interface ComplianceStatus {
  userId: string;
  fullName: string;
  role: string;
  hasDeclaration: boolean;
  declarationStatus: string;
  confirmedAtStart: boolean;
  confirmedAtCompletion: boolean;
  hasThreats: boolean;
  partnerApproved: boolean;
}

router.get("/fee-dependency/:engagementId", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const engagement = await prisma.engagement.findUnique({
      where: { id: req.params.engagementId },
      include: {
        client: true,
        firm: true,
      },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    if (engagement.firmId !== req.user!.firmId && req.user!.role !== "ADMIN") {
      return res.status(403).json({ error: "Access denied" });
    }

    const allClientEngagements = await prisma.engagement.findMany({
      where: {
        clientId: engagement.clientId,
        status: { in: ["ACTIVE", "COMPLETED"] },
      },
      select: {
        id: true,
        engagementCode: true,
        budgetHours: true,
        actualHours: true,
        fiscalYearEnd: true,
        status: true,
      },
    });

    const firmTotalRevenue = await prisma.engagement.aggregate({
      where: {
        firmId: engagement.firmId,
        status: { in: ["ACTIVE", "COMPLETED"] },
        fiscalYearEnd: {
          gte: new Date(new Date().getFullYear() - 1, 0, 1),
        },
      },
      _sum: {
        budgetHours: true,
      },
    });

    const clientTotalRevenue = allClientEngagements.reduce((sum: number, e: EngagementWithBudget) => sum + (e.budgetHours || 0), 0);
    const firmTotal = firmTotalRevenue._sum.budgetHours || 1;
    
    const feeDependencyPercentage = (clientTotalRevenue / firmTotal) * 100;
    const exceedsThreshold = feeDependencyPercentage > FEE_DEPENDENCY_THRESHOLD;

    res.json({
      clientName: engagement.client.name,
      clientEngagements: allClientEngagements,
      clientTotalBudgetHours: clientTotalRevenue,
      firmTotalBudgetHours: firmTotal,
      feeDependencyPercentage: Math.round(feeDependencyPercentage * 100) / 100,
      threshold: FEE_DEPENDENCY_THRESHOLD,
      exceedsThreshold,
      riskLevel: exceedsThreshold ? "HIGH" : feeDependencyPercentage > 10 ? "MEDIUM" : "LOW",
      isaReference: "IESBA Code Section 410 - Fee Dependency",
      recommendation: exceedsThreshold 
        ? "Fee dependency exceeds 15% threshold. Consider implementing safeguards or declining engagement."
        : "Fee dependency within acceptable limits.",
    });
  } catch (error) {
    console.error("Get fee dependency error:", error);
    res.status(500).json({ error: "Failed to calculate fee dependency" });
  }
});

router.get("/partner-rotation", requireAuth, requireRoles("ADMIN", "PARTNER", "EQCR"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.role === "ADMIN" ? (req.query.firmId as string | undefined) : req.user!.firmId;
    
    if (!firmId) {
      return res.status(400).json({ error: "Firm ID required" });
    }

    const partners = await prisma.user.findMany({
      where: {
        firmId,
        role: "PARTNER",
        isActive: true,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
      },
    });

    const partnerRotationData: PartnerRotationResult[] = await Promise.all(
      partners.map(async (partner: { id: string; fullName: string; email: string }) => {
        const engagements = await prisma.engagementTeam.findMany({
          where: {
            userId: partner.id,
            isLead: true,
          },
          include: {
            engagement: {
              select: {
                id: true,
                engagementCode: true,
                clientId: true,
                client: { select: { id: true, name: true } },
                fiscalYearEnd: true,
                createdAt: true,
                status: true,
              },
            },
          },
        });

        const clientYears: Record<string, { clientName: string; years: number; firstEngagementDate: Date; engagementCount: number }> = {};
        
        for (const assignment of engagements) {
          const clientId = assignment.engagement.clientId;
          const clientName = assignment.engagement.client.name;
          const engagementYear = assignment.engagement.fiscalYearEnd 
            ? new Date(assignment.engagement.fiscalYearEnd).getFullYear()
            : new Date(assignment.engagement.createdAt).getFullYear();
          
          if (!clientYears[clientId]) {
            clientYears[clientId] = {
              clientName,
              years: 0,
              firstEngagementDate: assignment.engagement.createdAt,
              engagementCount: 0,
            };
          }
          
          clientYears[clientId].engagementCount++;
          
          if (assignment.engagement.createdAt < clientYears[clientId].firstEngagementDate) {
            clientYears[clientId].firstEngagementDate = assignment.engagement.createdAt;
          }
        }

        const currentYear = new Date().getFullYear();
        for (const clientId in clientYears) {
          const firstYear = new Date(clientYears[clientId].firstEngagementDate).getFullYear();
          clientYears[clientId].years = currentYear - firstYear + 1;
        }

        const clientsDueForRotation = Object.entries(clientYears)
          .filter(([_, data]) => data.years >= PARTNER_ROTATION_YEARS)
          .map(([clientId, data]) => ({
            clientId,
            ...data,
            yearsOverLimit: data.years - PARTNER_ROTATION_YEARS,
            status: data.years > PARTNER_ROTATION_YEARS ? "OVERDUE" : "DUE",
          }));

        const clientsApproachingRotation = Object.entries(clientYears)
          .filter(([_, data]) => data.years >= PARTNER_ROTATION_YEARS - 1 && data.years < PARTNER_ROTATION_YEARS)
          .map(([clientId, data]) => ({
            clientId,
            ...data,
            yearsUntilRotation: PARTNER_ROTATION_YEARS - data.years,
          }));

        return {
          partner: {
            id: partner.id,
            fullName: partner.fullName,
            email: partner.email,
          },
          totalClients: Object.keys(clientYears).length,
          clientsDueForRotation,
          clientsApproachingRotation,
          hasRotationIssues: clientsDueForRotation.length > 0,
        };
      })
    );

    const summary = {
      totalPartners: partners.length,
      partnersWithRotationIssues: partnerRotationData.filter((p: PartnerRotationResult) => p.hasRotationIssues).length,
      totalClientsDueForRotation: partnerRotationData.reduce((sum: number, p: PartnerRotationResult) => sum + p.clientsDueForRotation.length, 0),
      rotationThresholdYears: PARTNER_ROTATION_YEARS,
      isaReference: "IESBA Code Section 540 - Long Association",
    };

    res.json({
      summary,
      partners: partnerRotationData,
    });
  } catch (error) {
    console.error("Get partner rotation error:", error);
    res.status(500).json({ error: "Failed to get partner rotation data" });
  }
});

router.get("/independence-summary/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const engagement = await prisma.engagement.findUnique({
      where: { id: req.params.engagementId },
      include: {
        team: {
          include: {
            user: { select: { id: true, fullName: true, role: true } },
          },
        },
        independenceDeclarations: {
          include: {
            user: { select: { id: true, fullName: true, role: true } },
            partner: { select: { id: true, fullName: true } },
          },
        },
        threatRegister: {
          include: {
            identifiedBy: { select: { fullName: true } },
            resolvedBy: { select: { fullName: true } },
            safeguards: true,
          },
        },
      },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    if (engagement.firmId !== req.user!.firmId && req.user!.role !== "ADMIN") {
      return res.status(403).json({ error: "Access denied" });
    }

    const teamMembers = engagement.team.map((t: { user: { id: string; fullName: string; role: string } }) => t.user);
    const declarations = engagement.independenceDeclarations;
    
    type DeclarationType = typeof declarations[number];
    const declarationsByUser = new Map<string, DeclarationType>(declarations.map((d: DeclarationType) => [d.userId, d]));
    
    const complianceStatus: ComplianceStatus[] = teamMembers.map((member: { id: string; fullName: string; role: string }) => {
      const declaration = declarationsByUser.get(member.id);
      return {
        userId: member.id,
        fullName: member.fullName,
        role: member.role,
        hasDeclaration: !!declaration,
        declarationStatus: declaration?.status || "MISSING",
        confirmedAtStart: declaration?.confirmedAtStart || false,
        confirmedAtCompletion: declaration?.confirmedAtCompletion || false,
        hasThreats: declaration 
          ? (declaration.hasFinancialInterest || declaration.hasBusinessRelationship || 
             declaration.hasFamilyRelationship || declaration.hasPriorService || declaration.hasOtherThreat)
          : false,
        partnerApproved: !!declaration?.partnerApprovalDate,
      };
    });

    type ThreatType = typeof engagement.threatRegister[number];
    const unresolvedThreats = engagement.threatRegister.filter((t: ThreatType) => 
      t.status === "IDENTIFIED" || t.status === "UNRESOLVED"
    );

    const isFullyCompliant = 
      complianceStatus.every((s: ComplianceStatus) => s.hasDeclaration && s.confirmedAtStart) &&
      unresolvedThreats.length === 0;

    res.json({
      engagementId: engagement.id,
      engagementCode: engagement.engagementCode,
      teamSize: teamMembers.length,
      complianceStatus,
      declarationsComplete: complianceStatus.filter((s: ComplianceStatus) => s.hasDeclaration).length,
      declarationsMissing: complianceStatus.filter((s: ComplianceStatus) => !s.hasDeclaration).length,
      startConfirmationsComplete: complianceStatus.filter((s: ComplianceStatus) => s.confirmedAtStart).length,
      completionConfirmationsComplete: complianceStatus.filter((s: ComplianceStatus) => s.confirmedAtCompletion).length,
      threats: {
        total: engagement.threatRegister.length,
        unresolved: unresolvedThreats.length,
        items: engagement.threatRegister,
      },
      isFullyCompliant,
      isaReference: "ISA 220 & IESBA Code Section 400",
    });
  } catch (error) {
    console.error("Get independence summary error:", error);
    res.status(500).json({ error: "Failed to get independence summary" });
  }
});

export default router;
