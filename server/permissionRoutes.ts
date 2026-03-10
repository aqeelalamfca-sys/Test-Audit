import { Router, Response } from "express";
import { prisma } from "./db";
import { z } from "zod";
import { requireAuth, requireMinRole, AuthenticatedRequest } from "./auth";
import { getUserEffectivePermissions, seedPermissions } from "./seedPermissions";

const router = Router();

router.get("/permissions", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const permissions = await prisma.permission.findMany({
      where: { isActive: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
    
    res.json(permissions);
  } catch (error) {
    console.error("Get permissions error:", error);
    res.status(500).json({ error: "Failed to fetch permissions" });
  }
});

router.get("/permissions/roles", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    
    const rolePermissions = await prisma.rolePermission.findMany({
      where: {
        OR: [{ firmId: null }, { firmId }],
      },
      include: { permission: true },
    });
    
    const effectiveMap: Record<string, Record<string, { perm: any; isGranted: boolean; isFirmOverride: boolean }>> = {};
    for (const rp of rolePermissions) {
      if (!effectiveMap[rp.role]) effectiveMap[rp.role] = {};
      const existing = effectiveMap[rp.role][rp.permission.code];
      if (rp.firmId) {
        effectiveMap[rp.role][rp.permission.code] = { perm: rp.permission, isGranted: rp.isGranted, isFirmOverride: true };
      } else if (!existing || !existing.isFirmOverride) {
        effectiveMap[rp.role][rp.permission.code] = { perm: rp.permission, isGranted: rp.isGranted, isFirmOverride: false };
      }
    }
    
    const grouped: Record<string, { code: string; name: string; category: string }[]> = {};
    for (const [role, permMap] of Object.entries(effectiveMap)) {
      grouped[role] = [];
      for (const [code, entry] of Object.entries(permMap)) {
        if (entry.isGranted) {
          grouped[role].push({
            code: entry.perm.code,
            name: entry.perm.name,
            category: entry.perm.category,
          });
        }
      }
    }
    
    res.json(grouped);
  } catch (error) {
    console.error("Get role permissions error:", error);
    res.status(500).json({ error: "Failed to fetch role permissions" });
  }
});

router.get("/permissions/user/:userId", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const firmId = req.user!.firmId;
    
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { firmId: true, role: true, fullName: true },
    });
    
    if (!targetUser || targetUser.firmId !== firmId) {
      return res.status(403).json({ error: "Cannot access user from different firm" });
    }
    
    const effectivePermissions = await getUserEffectivePermissions(userId);
    
    const allPermissions = await prisma.permission.findMany({
      where: { isActive: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
    
    const rolePermissions = await prisma.rolePermission.findMany({
      where: {
        role: targetUser.role,
        OR: [{ firmId: null }, { firmId }],
        isGranted: true,
      },
      select: { permissionId: true },
    });
    const rolePermissionIds = new Set(rolePermissions.map(rp => rp.permissionId));
    
    const overrides = await prisma.userPermissionOverride.findMany({
      where: { userId },
      include: { permission: true, grantedBy: { select: { fullName: true } } },
    });
    const overrideMap = new Map(overrides.map(o => [o.permissionId, o]));
    
    const permissionsWithStatus = allPermissions.map(perm => {
      const override = overrideMap.get(perm.id);
      const isFromRole = rolePermissionIds.has(perm.id);
      const isEffective = effectivePermissions.includes(perm.code);
      
      return {
        ...perm,
        isFromRole,
        isEffective,
        hasOverride: !!override,
        overrideGranted: override?.isGranted,
        overrideReason: override?.reason,
        overrideExpiresAt: override?.expiresAt,
        overrideGrantedBy: override?.grantedBy?.fullName,
      };
    });
    
    res.json({
      user: { id: userId, fullName: targetUser.fullName, role: targetUser.role },
      permissions: permissionsWithStatus,
    });
  } catch (error) {
    console.error("Get user permissions error:", error);
    res.status(500).json({ error: "Failed to fetch user permissions" });
  }
});

router.post("/permissions/user/:userId/override", requireAuth, requireMinRole("FIRM_ADMIN"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const firmId = req.user!.firmId;
    
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { firmId: true },
    });
    
    if (!targetUser || targetUser.firmId !== firmId) {
      return res.status(403).json({ error: "Cannot modify user from different firm" });
    }
    
    const schema = z.object({
      permissionCode: z.string(),
      isGranted: z.boolean(),
      reason: z.string().optional(),
      expiresAt: z.string().optional().transform(s => s ? new Date(s) : undefined),
    });
    
    const data = schema.parse(req.body);
    
    const permission = await prisma.permission.findUnique({ where: { code: data.permissionCode } });
    if (!permission) {
      return res.status(404).json({ error: "Permission not found" });
    }
    
    const override = await prisma.userPermissionOverride.upsert({
      where: { userId_permissionId: { userId, permissionId: permission.id } },
      update: {
        isGranted: data.isGranted,
        reason: data.reason,
        expiresAt: data.expiresAt,
        grantedById: req.user!.id,
      },
      create: {
        userId,
        permissionId: permission.id,
        isGranted: data.isGranted,
        reason: data.reason,
        expiresAt: data.expiresAt,
        grantedById: req.user!.id,
      },
    });
    
    res.json(override);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Create permission override error:", error);
    res.status(500).json({ error: "Failed to create permission override" });
  }
});

router.delete("/permissions/user/:userId/override/:permissionCode", requireAuth, requireMinRole("FIRM_ADMIN"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, permissionCode } = req.params;
    const firmId = req.user!.firmId;
    
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { firmId: true },
    });
    
    if (!targetUser || targetUser.firmId !== firmId) {
      return res.status(403).json({ error: "Cannot modify user from different firm" });
    }
    
    const permission = await prisma.permission.findUnique({ where: { code: permissionCode } });
    if (!permission) {
      return res.status(404).json({ error: "Permission not found" });
    }
    
    await prisma.userPermissionOverride.deleteMany({
      where: { userId, permissionId: permission.id },
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error("Delete permission override error:", error);
    res.status(500).json({ error: "Failed to delete permission override" });
  }
});

router.get("/permissions/my", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const permissions = await getUserEffectivePermissions(req.user!.id);
    res.json({ permissions });
  } catch (error) {
    console.error("Get my permissions error:", error);
    res.status(500).json({ error: "Failed to fetch permissions" });
  }
});

router.post("/permissions/seed", requireAuth, requireMinRole("FIRM_ADMIN"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    await seedPermissions();
    res.json({ success: true, message: "Permissions seeded successfully" });
  } catch (error) {
    console.error("Seed permissions error:", error);
    res.status(500).json({ error: "Failed to seed permissions" });
  }
});

export default router;
