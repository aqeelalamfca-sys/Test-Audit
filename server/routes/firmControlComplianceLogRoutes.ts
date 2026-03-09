import { Router, Response } from "express";
import { requireAuth, requireMinRole, AuthenticatedRequest } from "../auth";
import { prisma } from "../db";

const router = Router();

const CONTROL_DOMAINS = [
  "Governance & Leadership",
  "Ethical Requirements",
  "Acceptance & Continuance",
  "Engagement Performance",
  "Resources",
  "Information & Communication",
  "Monitoring & Remediation",
  "ISQM 2 / Engagement Quality Review",
];

const VALID_STATUSES = ["SUBMITTED", "REVIEWED", "APPROVED", "PENDING", "REJECTED"];

const VALID_ACTIONS = [
  "CONTROL_CREATED",
  "CONTROL_UPDATED",
  "CONTROL_REVIEWED",
  "CONTROL_APPROVED",
  "CONTROL_REJECTED",
  "OBJECTIVE_SUBMITTED",
  "OBJECTIVE_REVIEWED",
  "RISK_ASSESSED",
  "RISK_UPDATED",
  "RESPONSE_DESIGNED",
  "RESPONSE_IMPLEMENTED",
  "MONITORING_PLANNED",
  "MONITORING_EXECUTED",
  "INSPECTION_COMPLETED",
  "DEFICIENCY_IDENTIFIED",
  "DEFICIENCY_REMEDIATED",
  "AFFIRMATION_SUBMITTED",
  "INDEPENDENCE_DECLARED",
  "ETHICS_BREACH_REPORTED",
  "CONSULTATION_LOGGED",
  "POLICY_UPDATED",
];

router.get("/", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm context" });

    const {
      page = "1",
      limit = "50",
      search,
      role,
      controlDomain,
      status,
      action,
      userId,
      startDate,
      endDate,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = Math.min(parseInt(limit as string), 100);

    const where: any = { firmId };

    if (search) {
      where.OR = [
        { description: { contains: search as string, mode: "insensitive" } },
        { action: { contains: search as string, mode: "insensitive" } },
        { entityType: { contains: search as string, mode: "insensitive" } },
        { controlDomain: { contains: search as string, mode: "insensitive" } },
      ];
    }
    if (role) where.actorRole = role as string;
    if (controlDomain) where.controlDomain = controlDomain as string;
    if (status) where.status = status as string;
    if (action) where.action = action as string;
    if (userId) where.actorUserId = userId as string;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const orderBy: any = {};
    const validSortFields = ["createdAt", "action", "status", "controlDomain", "actorRole"];
    const field = validSortFields.includes(sortBy as string) ? sortBy as string : "createdAt";
    orderBy[field] = sortOrder === "asc" ? "asc" : "desc";

    const [logs, total, domainCounts, statusCounts, roleCounts] = await Promise.all([
      prisma.firmControlActivityLog.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          actor: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
            },
          },
        },
      }),
      prisma.firmControlActivityLog.count({ where }),
      prisma.firmControlActivityLog.groupBy({
        by: ["controlDomain"],
        where: { firmId },
        _count: true,
      }),
      prisma.firmControlActivityLog.groupBy({
        by: ["status"],
        where: { firmId },
        _count: true,
      }),
      prisma.firmControlActivityLog.groupBy({
        by: ["actorRole"],
        where: { firmId },
        _count: true,
      }),
    ]);

    res.json({
      logs,
      total,
      page: parseInt(page as string),
      limit: take,
      totalPages: Math.ceil(total / take),
      facets: {
        domains: domainCounts.map((d) => ({ domain: d.controlDomain, count: d._count })),
        statuses: statusCounts.map((s) => ({ status: s.status, count: s._count })),
        roles: roleCounts.map((r) => ({ role: r.actorRole, count: r._count })),
      },
      meta: {
        controlDomains: CONTROL_DOMAINS,
        validStatuses: VALID_STATUSES,
        validActions: VALID_ACTIONS,
      },
    });
  } catch (error) {
    console.error("Firm control compliance log error:", error);
    res.status(500).json({ error: "Failed to retrieve compliance logs" });
  }
});

router.get("/users", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm context" });

    const users = await prisma.user.findMany({
      where: { firmId },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        designation: true,
      },
      orderBy: { fullName: "asc" },
    });

    const userActivity = await prisma.firmControlActivityLog.groupBy({
      by: ["actorUserId"],
      where: { firmId },
      _count: true,
      _max: { createdAt: true },
    });

    const activityMap = new Map(
      userActivity.map((ua) => [ua.actorUserId, { count: ua._count, lastActivity: ua._max.createdAt }])
    );

    const enrichedUsers = users.map((u) => ({
      ...u,
      activityCount: activityMap.get(u.id)?.count || 0,
      lastActivity: activityMap.get(u.id)?.lastActivity || null,
    }));

    res.json({ users: enrichedUsers });
  } catch (error) {
    console.error("Firm control users error:", error);
    res.status(500).json({ error: "Failed to retrieve users" });
  }
});

router.get("/summary", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm context" });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [totalLogs, last30Days, pendingCount, approvedCount, byDomain, byAction, recentActivity] = await Promise.all([
      prisma.firmControlActivityLog.count({ where: { firmId } }),
      prisma.firmControlActivityLog.count({ where: { firmId, createdAt: { gte: thirtyDaysAgo } } }),
      prisma.firmControlActivityLog.count({ where: { firmId, status: "PENDING" } }),
      prisma.firmControlActivityLog.count({ where: { firmId, status: "APPROVED" } }),
      prisma.firmControlActivityLog.groupBy({
        by: ["controlDomain"],
        where: { firmId },
        _count: true,
      }),
      prisma.firmControlActivityLog.groupBy({
        by: ["action"],
        where: { firmId },
        _count: true,
        orderBy: { _count: { action: "desc" } },
        take: 10,
      }),
      prisma.firmControlActivityLog.findMany({
        where: { firmId },
        take: 5,
        orderBy: { createdAt: "desc" },
        include: {
          actor: { select: { fullName: true, role: true } },
        },
      }),
    ]);

    res.json({
      totalLogs,
      last30Days,
      pendingCount,
      approvedCount,
      byDomain: byDomain.map((d) => ({ domain: d.controlDomain || "Unclassified", count: d._count })),
      topActions: byAction.map((a) => ({ action: a.action, count: a._count })),
      recentActivity,
    });
  } catch (error) {
    console.error("Firm control summary error:", error);
    res.status(500).json({ error: "Failed to retrieve summary" });
  }
});

router.get("/:logId", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(403).json({ error: "No firm context" });

    const log = await prisma.firmControlActivityLog.findFirst({
      where: { id: req.params.logId, firmId },
      include: {
        actor: { select: { id: true, fullName: true, email: true, role: true, designation: true } },
      },
    });

    if (!log) return res.status(404).json({ error: "Log entry not found" });
    res.json(log);
  } catch (error) {
    console.error("Firm control log detail error:", error);
    res.status(500).json({ error: "Failed to retrieve log entry" });
  }
});

export function logFirmControlActivity(params: {
  firmId: string;
  actorUserId: string;
  actorRole: string;
  entityType: string;
  entityId?: string;
  controlDomain?: string;
  action: string;
  status?: string;
  description?: string;
  beforeJson?: any;
  afterJson?: any;
  ipAddress?: string;
  userAgent?: string;
}) {
  return prisma.firmControlActivityLog.create({
    data: {
      firmId: params.firmId,
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
      entityType: params.entityType,
      entityId: params.entityId || null,
      controlDomain: params.controlDomain || null,
      action: params.action,
      status: params.status || "SUBMITTED",
      description: params.description || null,
      beforeJson: params.beforeJson || undefined,
      afterJson: params.afterJson || undefined,
      ipAddress: params.ipAddress || null,
      userAgent: params.userAgent || null,
    },
  }).catch((err) => {
    console.error("Failed to log firm control activity:", err);
  });
}

export default router;
