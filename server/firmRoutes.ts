import { Router, type Response } from "express";
import { prisma } from "./db";
import { requireAuth, requireRoles, logAuditTrail, type AuthenticatedRequest, hashPassword } from "./auth";
import { z } from "zod";

const router = Router();

const createFirmSchema = z.object({
  name: z.string().min(1, "Firm name is required"),
  licenseNo: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
});

const updateFirmSchema = createFirmSchema.partial();

router.get("/", requireAuth, requireRoles("ADMIN"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firms = await prisma.firm.findMany({
      include: {
        _count: {
          select: {
            users: true,
            clients: true,
            engagements: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    res.json(firms);
  } catch (error) {
    console.error("Get firms error:", error);
    res.status(500).json({ error: "Failed to fetch firms" });
  }
});

router.get("/current", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const firm = await prisma.firm.findUnique({
      where: { id: firmId },
      include: {
        _count: {
          select: {
            users: true,
            clients: true,
            engagements: true,
          },
        },
      },
    });

    if (!firm) {
      return res.status(404).json({ error: "Firm not found" });
    }

    res.json(firm);
  } catch (error) {
    console.error("Get current firm error:", error);
    res.status(500).json({ error: "Failed to fetch firm" });
  }
});

router.get("/:id", requireAuth, requireRoles("ADMIN"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firm = await prisma.firm.findUnique({
      where: { id: req.params.id },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            username: true,
            fullName: true,
            role: true,
            isActive: true,
            lastLoginAt: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            clients: true,
            engagements: true,
          },
        },
      },
    });

    if (!firm) {
      return res.status(404).json({ error: "Firm not found" });
    }

    res.json(firm);
  } catch (error) {
    console.error("Get firm error:", error);
    res.status(500).json({ error: "Failed to fetch firm" });
  }
});

router.post("/", requireAuth, requireRoles("ADMIN"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = createFirmSchema.parse(req.body);

    const firm = await prisma.firm.create({
      data,
    });

    await logAuditTrail(
      req.user!.id,
      "FIRM_CREATED",
      "firm",
      firm.id,
      null,
      { name: firm.name },
      undefined,
      "New audit firm created",
      req.ip,
      req.get("user-agent")
    );

    res.status(201).json(firm);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("Create firm error:", error);
    res.status(500).json({ error: "Failed to create firm" });
  }
});

router.patch("/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isAdmin = req.user!.role === "ADMIN";
    const isOwnFirm = req.user!.firmId === req.params.id;
    const isPartner = req.user!.role === "PARTNER";

    if (!isAdmin && !(isOwnFirm && isPartner)) {
      return res.status(403).json({ error: "Only Admin or firm Partner can update firm" });
    }

    const existing = await prisma.firm.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      return res.status(404).json({ error: "Firm not found" });
    }

    const data = updateFirmSchema.parse(req.body);

    const firm = await prisma.firm.update({
      where: { id: req.params.id },
      data,
    });

    await logAuditTrail(
      req.user!.id,
      "FIRM_UPDATED",
      "firm",
      firm.id,
      existing,
      firm,
      undefined,
      "Firm profile updated",
      req.ip,
      req.get("user-agent")
    );

    res.json(firm);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("Update firm error:", error);
    res.status(500).json({ error: "Failed to update firm" });
  }
});

router.delete("/:id", requireAuth, requireRoles("ADMIN"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firm = await prisma.firm.findUnique({
      where: { id: req.params.id },
      include: {
        _count: {
          select: { users: true, engagements: true },
        },
      },
    });

    if (!firm) {
      return res.status(404).json({ error: "Firm not found" });
    }

    if (firm._count.engagements > 0) {
      return res.status(400).json({ error: "Cannot delete firm with active engagements" });
    }

    await prisma.firm.delete({
      where: { id: req.params.id },
    });

    await logAuditTrail(
      req.user!.id,
      "FIRM_DELETED",
      "firm",
      req.params.id,
      { name: firm.name },
      null,
      undefined,
      "Firm deleted",
      req.ip,
      req.get("user-agent")
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Delete firm error:", error);
    res.status(500).json({ error: "Failed to delete firm" });
  }
});

router.get("/:id/stats", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isAdmin = req.user!.role === "ADMIN";
    const isOwnFirm = req.user!.firmId === req.params.id;

    if (!isAdmin && !isOwnFirm) {
      return res.status(403).json({ error: "Access denied" });
    }

    const [
      totalUsers,
      activeUsers,
      totalClients,
      activeEngagements,
      completedEngagements,
    ] = await Promise.all([
      prisma.user.count({ where: { firmId: req.params.id } }),
      prisma.user.count({ where: { firmId: req.params.id, isActive: true } }),
      prisma.client.count({ where: { firmId: req.params.id, isActive: true } }),
      prisma.engagement.count({ where: { firmId: req.params.id, status: "ACTIVE" } }),
      prisma.engagement.count({ where: { firmId: req.params.id, status: "COMPLETED" } }),
    ]);

    const usersByRole = await prisma.user.groupBy({
      by: ["role"],
      where: { firmId: req.params.id },
      _count: true,
    });

    res.json({
      totalUsers,
      activeUsers,
      totalClients,
      activeEngagements,
      completedEngagements,
      usersByRole: usersByRole.map(r => ({ role: r.role, count: r._count })),
    });
  } catch (error) {
    console.error("Get firm stats error:", error);
    res.status(500).json({ error: "Failed to fetch firm stats" });
  }
});

export default router;
