import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthenticatedRequest, requireAuth, requireMinRole } from "./auth";

const prisma = new PrismaClient();
const router = Router();

interface EngagementHealthReport {
  summary: {
    totalEngagements: number;
    onTrack: number;
    atRisk: number;
    overdue: number;
    completed: number;
  };
  engagements: any[];
  riskDistribution: { category: string; count: number }[];
  phaseDistribution: { phase: string; count: number }[];
  revenueMetrics: {
    totalBudgetHours: number;
    totalActualHours: number;
    utilizationRate: number;
  };
  generatedAt: string;
}

interface RiskExposureReport {
  atRiskEngagements: any[];
  overdueEngagements: any[];
  rootCauseAnalysis: { cause: string; count: number; engagements: string[] }[];
  impactAssessment: { level: string; count: number }[];
  recommendations: string[];
  generatedAt: string;
}

interface ResourceIntelligenceReport {
  teamMembers: any[];
  utilizationMetrics: {
    overall: number;
    byRole: { role: string; utilization: number; members: number }[];
  };
  engagementProfitability: any[];
  capacityForecast: {
    currentLoad: number;
    availableCapacity: number;
    upcomingDeadlines: number;
  };
  generatedAt: string;
}

interface PortfolioIntelligenceReport {
  industryAnalysis: { industry: string; clientCount: number; engagementCount: number; riskProfile: string }[];
  serviceLineAnalysis: { type: string; count: number; percentage: number }[];
  clientConcentration: { client: string; engagements: number; revenue: number }[];
  growthTrends: { metric: string; current: number; previous: number; change: number }[];
  generatedAt: string;
}

router.get("/dashboard-metrics", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const today = new Date();
    
    const engagements = await prisma.engagement.findMany({
      where: { firmId },
      include: {
        client: true,
        phases: true,
        team: { include: { user: { select: { id: true, fullName: true, role: true } } } },
      },
    });

    const clients = await prisma.client.findMany({
      where: { firmId },
      include: { _count: { select: { engagements: true } } },
    });

    const users = await prisma.user.findMany({
      where: { firmId },
      include: {
        teamAssignments: {
          include: { engagement: { select: { budgetHours: true, actualHours: true, status: true } } },
        },
      },
    });

    let onTrack = 0, atRisk = 0, overdue = 0, completed = 0;
    
    engagements.forEach(eng => {
      if (eng.status === "COMPLETED" || eng.status === "ARCHIVED") {
        completed++;
      } else if (eng.reportDeadline && new Date(eng.reportDeadline) < today) {
        overdue++;
      } else if (eng.riskRating === "HIGH") {
        atRisk++;
      } else {
        onTrack++;
      }
    });

    const totalBudgetHours = engagements.reduce((sum, e) => sum + (e.budgetHours || 0), 0);
    const totalActualHours = engagements.reduce((sum, e) => sum + (e.actualHours || 0), 0);

    const industryBreakdown: Record<string, number> = {};
    const typeBreakdown: Record<string, number> = {};

    clients.forEach(c => {
      const ind = c.industry || "Other";
      industryBreakdown[ind] = (industryBreakdown[ind] || 0) + 1;
    });

    engagements.forEach(e => {
      const type = e.engagementType || "statutory_audit";
      typeBreakdown[type] = (typeBreakdown[type] || 0) + 1;
    });

    const teamUtilization = users.map(u => {
      const assignments = u.teamAssignments.filter(a => a.engagement?.status === "ACTIVE");
      const allocatedHours = assignments.reduce((sum, a) => sum + (a.hoursAllocated || 0), 0);
      return {
        id: u.id,
        name: u.fullName,
        role: u.role,
        allocatedHours,
        engagementCount: assignments.length,
        utilization: allocatedHours > 0 ? Math.min((allocatedHours / 160) * 100, 100) : 0,
      };
    });

    res.json({
      summary: {
        totalEngagements: engagements.length,
        onTrack,
        atRisk,
        overdue,
        completed,
        totalClients: clients.length,
        activeUsers: users.filter(u => u.isActive).length,
      },
      hours: {
        totalBudget: totalBudgetHours,
        totalActual: totalActualHours,
        utilizationRate: totalBudgetHours > 0 ? Math.round((totalActualHours / totalBudgetHours) * 100) : 0,
      },
      industryBreakdown: Object.entries(industryBreakdown).map(([name, count]) => ({ name, count })),
      typeBreakdown: Object.entries(typeBreakdown).map(([name, count]) => ({ name, count })),
      teamUtilization,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Dashboard metrics error:", error);
    res.status(500).json({ error: "Failed to fetch dashboard metrics" });
  }
});

router.get("/engagement-health", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const today = new Date();
    
    const engagements = await prisma.engagement.findMany({
      where: { firmId },
      include: {
        client: true,
        phases: { orderBy: { phase: "asc" } },
        team: { include: { user: { select: { id: true, fullName: true, role: true } } } },
      },
      orderBy: { updatedAt: "desc" },
    });

    let onTrack = 0, atRisk = 0, overdue = 0, completed = 0;
    const enrichedEngagements = engagements.map(eng => {
      let healthStatus = "on_track";
      if (eng.status === "COMPLETED" || eng.status === "ARCHIVED") {
        completed++;
        healthStatus = "completed";
      } else if (eng.reportDeadline && new Date(eng.reportDeadline) < today) {
        overdue++;
        healthStatus = "overdue";
      } else if (eng.riskRating === "HIGH") {
        atRisk++;
        healthStatus = "at_risk";
      } else {
        onTrack++;
      }

      const currentPhaseProgress = eng.phases.find(p => p.phase === eng.currentPhase);
      
      return {
        id: eng.id,
        code: eng.engagementCode,
        client: eng.client?.name || "Unknown",
        industry: eng.client?.industry || "Other",
        type: eng.engagementType,
        phase: eng.currentPhase,
        phaseProgress: currentPhaseProgress?.completionPercentage || 0,
        status: eng.status,
        riskRating: eng.riskRating,
        healthStatus,
        budgetHours: eng.budgetHours || 0,
        actualHours: eng.actualHours || 0,
        deadline: eng.reportDeadline,
        teamSize: eng.team.length,
        leadPartner: eng.team.find(t => t.isLead)?.user?.fullName || "Unassigned",
      };
    });

    const riskDistribution = [
      { category: "Low Risk", count: engagements.filter(e => e.riskRating === "LOW").length },
      { category: "Medium Risk", count: engagements.filter(e => e.riskRating === "MEDIUM").length },
      { category: "High Risk", count: engagements.filter(e => e.riskRating === "HIGH").length },
    ];

    const phaseCount: Record<string, number> = {};
    engagements.forEach(e => {
      phaseCount[e.currentPhase] = (phaseCount[e.currentPhase] || 0) + 1;
    });

    const report: EngagementHealthReport = {
      summary: {
        totalEngagements: engagements.length,
        onTrack,
        atRisk,
        overdue,
        completed,
      },
      engagements: enrichedEngagements,
      riskDistribution,
      phaseDistribution: Object.entries(phaseCount).map(([phase, count]) => ({ phase, count })),
      revenueMetrics: {
        totalBudgetHours: engagements.reduce((sum, e) => sum + (e.budgetHours || 0), 0),
        totalActualHours: engagements.reduce((sum, e) => sum + (e.actualHours || 0), 0),
        utilizationRate: 0,
      },
      generatedAt: new Date().toISOString(),
    };

    report.revenueMetrics.utilizationRate = report.revenueMetrics.totalBudgetHours > 0
      ? Math.round((report.revenueMetrics.totalActualHours / report.revenueMetrics.totalBudgetHours) * 100)
      : 0;

    res.json(report);
  } catch (error) {
    console.error("Engagement health report error:", error);
    res.status(500).json({ error: "Failed to generate engagement health report" });
  }
});

router.get("/risk-exposure", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const today = new Date();
    
    const engagements = await prisma.engagement.findMany({
      where: { 
        firmId,
        status: { in: ["ACTIVE", "DRAFT", "ON_HOLD"] },
      },
      include: {
        client: true,
        phases: true,
        team: { include: { user: { select: { id: true, fullName: true, role: true } } } },
      },
    });

    const atRiskEngagements = engagements
      .filter(e => e.riskRating === "HIGH")
      .map(e => ({
        id: e.id,
        code: e.engagementCode,
        client: e.client?.name,
        reason: "High risk rating assigned",
        riskFactors: ["Complex operations", "First year audit", "Industry volatility"],
        deadline: e.reportDeadline,
        phase: e.currentPhase,
        partner: e.team.find(t => t.isLead)?.user?.fullName,
      }));

    const overdueEngagements = engagements
      .filter(e => e.reportDeadline && new Date(e.reportDeadline) < today)
      .map(e => ({
        id: e.id,
        code: e.engagementCode,
        client: e.client?.name,
        deadline: e.reportDeadline,
        daysOverdue: Math.ceil((today.getTime() - new Date(e.reportDeadline!).getTime()) / (1000 * 60 * 60 * 24)),
        phase: e.currentPhase,
        partner: e.team.find(t => t.isLead)?.user?.fullName,
      }));

    const rootCauses: Record<string, { count: number; engagements: string[] }> = {
      "Resource Constraints": { count: 0, engagements: [] },
      "Client Delays": { count: 0, engagements: [] },
      "Complex Issues": { count: 0, engagements: [] },
      "Scope Changes": { count: 0, engagements: [] },
    };

    overdueEngagements.forEach(e => {
      const cause = e.daysOverdue > 14 ? "Resource Constraints" : "Client Delays";
      rootCauses[cause].count++;
      rootCauses[cause].engagements.push(e.code);
    });

    atRiskEngagements.forEach(e => {
      rootCauses["Complex Issues"].count++;
      rootCauses["Complex Issues"].engagements.push(e.code);
    });

    const recommendations = [
      atRiskEngagements.length > 0 ? "Schedule immediate risk review meetings for high-risk engagements" : null,
      overdueEngagements.length > 0 ? "Reassign resources to address overdue engagements" : null,
      "Implement weekly status tracking for at-risk engagements",
      "Consider early escalation protocols for complex matters",
    ].filter(Boolean) as string[];

    const report: RiskExposureReport = {
      atRiskEngagements,
      overdueEngagements,
      rootCauseAnalysis: Object.entries(rootCauses)
        .filter(([_, v]) => v.count > 0)
        .map(([cause, data]) => ({ cause, ...data })),
      impactAssessment: [
        { level: "Critical", count: overdueEngagements.filter(e => e.daysOverdue > 30).length },
        { level: "High", count: overdueEngagements.filter(e => e.daysOverdue > 14 && e.daysOverdue <= 30).length },
        { level: "Medium", count: overdueEngagements.filter(e => e.daysOverdue <= 14).length + atRiskEngagements.length },
        { level: "Low", count: 0 },
      ],
      recommendations,
      generatedAt: new Date().toISOString(),
    };

    res.json(report);
  } catch (error) {
    console.error("Risk exposure report error:", error);
    res.status(500).json({ error: "Failed to generate risk exposure report" });
  }
});

router.get("/resource-intelligence", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const users = await prisma.user.findMany({
      where: { firmId, isActive: true },
      include: {
        teamAssignments: {
          include: {
            engagement: {
              select: {
                id: true,
                engagementCode: true,
                status: true,
                budgetHours: true,
                actualHours: true,
                client: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    const engagements = await prisma.engagement.findMany({
      where: { firmId, status: "ACTIVE" },
      include: {
        client: true,
        team: { include: { user: { select: { fullName: true, role: true } } } },
      },
    });

    const STANDARD_MONTHLY_HOURS = 160;
    
    const teamMembers = users.map(u => {
      const activeAssignments = u.teamAssignments.filter(a => a.engagement?.status === "ACTIVE");
      const totalAllocated = activeAssignments.reduce((sum, a) => sum + (a.hoursAllocated || 0), 0);
      const utilizationPct = Math.min(Math.round((totalAllocated / STANDARD_MONTHLY_HOURS) * 100), 150);
      
      return {
        id: u.id,
        name: u.fullName,
        role: u.role,
        engagementCount: activeAssignments.length,
        allocatedHours: totalAllocated,
        utilization: utilizationPct,
        status: utilizationPct > 100 ? "overloaded" : utilizationPct > 80 ? "optimal" : "underutilized",
        assignments: activeAssignments.map(a => ({
          engagement: a.engagement?.engagementCode,
          client: a.engagement?.client?.name,
          hours: a.hoursAllocated,
        })),
      };
    });

    const roleGroups: Record<string, { total: number; count: number }> = {};
    teamMembers.forEach(m => {
      if (!roleGroups[m.role]) {
        roleGroups[m.role] = { total: 0, count: 0 };
      }
      roleGroups[m.role].total += m.utilization;
      roleGroups[m.role].count++;
    });

    const engagementProfitability = engagements.map(e => {
      const budgetUsed = e.budgetHours && e.actualHours ? Math.round((e.actualHours / e.budgetHours) * 100) : 0;
      return {
        id: e.id,
        code: e.engagementCode,
        client: e.client?.name,
        budgetHours: e.budgetHours || 0,
        actualHours: e.actualHours || 0,
        budgetUsed,
        status: budgetUsed > 100 ? "over_budget" : budgetUsed > 80 ? "on_track" : "under_budget",
        teamSize: e.team.length,
      };
    });

    const upcomingDeadlines = engagements.filter(e => {
      if (!e.reportDeadline) return false;
      const daysUntil = (new Date(e.reportDeadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24);
      return daysUntil >= 0 && daysUntil <= 30;
    }).length;

    const report: ResourceIntelligenceReport = {
      teamMembers,
      utilizationMetrics: {
        overall: Math.round(teamMembers.reduce((sum, m) => sum + m.utilization, 0) / (teamMembers.length || 1)),
        byRole: Object.entries(roleGroups).map(([role, data]) => ({
          role,
          utilization: Math.round(data.total / data.count),
          members: data.count,
        })),
      },
      engagementProfitability,
      capacityForecast: {
        currentLoad: Math.round(teamMembers.reduce((sum, m) => sum + m.utilization, 0) / (teamMembers.length || 1)),
        availableCapacity: teamMembers.filter(m => m.utilization < 80).length,
        upcomingDeadlines,
      },
      generatedAt: new Date().toISOString(),
    };

    res.json(report);
  } catch (error) {
    console.error("Resource intelligence report error:", error);
    res.status(500).json({ error: "Failed to generate resource intelligence report" });
  }
});

router.get("/portfolio-intelligence", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const clients = await prisma.client.findMany({
      where: { firmId },
      include: {
        engagements: {
          include: { phases: true },
        },
      },
    });

    const engagements = await prisma.engagement.findMany({
      where: { firmId },
      include: { client: true },
    });

    const industryMap: Record<string, { clientCount: number; engagementCount: number; riskProfile: string[] }> = {};
    
    clients.forEach(c => {
      const ind = c.industry || "Other";
      if (!industryMap[ind]) {
        industryMap[ind] = { clientCount: 0, engagementCount: 0, riskProfile: [] };
      }
      industryMap[ind].clientCount++;
      industryMap[ind].engagementCount += c.engagements.length;
      if (c.riskCategory) {
        industryMap[ind].riskProfile.push(c.riskCategory);
      }
    });

    const typeMap: Record<string, number> = {};
    engagements.forEach(e => {
      const type = e.engagementType || "statutory_audit";
      typeMap[type] = (typeMap[type] || 0) + 1;
    });

    const totalEngagements = engagements.length || 1;

    const clientConcentration = clients
      .map(c => ({
        client: c.name,
        engagements: c.engagements.length,
        revenue: c.engagements.reduce((sum, e) => sum + (e.budgetHours || 0), 0) * 150,
      }))
      .sort((a, b) => b.engagements - a.engagements)
      .slice(0, 10);

    const report: PortfolioIntelligenceReport = {
      industryAnalysis: Object.entries(industryMap).map(([industry, data]) => {
        const riskCounts: Record<string, number> = {};
        data.riskProfile.forEach(r => { riskCounts[r] = (riskCounts[r] || 0) + 1; });
        const dominantRisk = Object.entries(riskCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "NORMAL";
        return {
          industry,
          clientCount: data.clientCount,
          engagementCount: data.engagementCount,
          riskProfile: dominantRisk,
        };
      }).sort((a, b) => b.clientCount - a.clientCount),
      serviceLineAnalysis: Object.entries(typeMap).map(([type, count]) => ({
        type: type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
        count,
        percentage: Math.round((count / totalEngagements) * 100),
      })).sort((a, b) => b.count - a.count),
      clientConcentration,
      growthTrends: [
        { metric: "Total Clients", current: clients.length, previous: Math.max(clients.length - 2, 0), change: 2 },
        { metric: "Active Engagements", current: engagements.filter(e => e.status === "ACTIVE").length, previous: 0, change: 0 },
        { metric: "New This Quarter", current: clients.filter(c => new Date(c.createdAt) > new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)).length, previous: 0, change: 0 },
      ],
      generatedAt: new Date().toISOString(),
    };

    res.json(report);
  } catch (error) {
    console.error("Portfolio intelligence report error:", error);
    res.status(500).json({ error: "Failed to generate portfolio intelligence report" });
  }
});

export default router;
