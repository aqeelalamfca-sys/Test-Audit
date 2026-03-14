import { Router, Response } from "express";
import { requireAuth, type AuthenticatedRequest, logAuditTrail } from "../auth";
import { prisma } from "../db";

const router = Router();

const ROLE_AUTHORITY: Record<string, number> = {
  STAFF: 1,
  SENIOR: 2,
  MANAGER: 3,
  EQCR: 4,
  PARTNER: 5,
  FIRM_ADMIN: 6,
  ADMIN: 6,
  SUPER_ADMIN: 7,
};

function getAuthorityLevel(role: string): number {
  return ROLE_AUTHORITY[role.toUpperCase()] || 1;
}

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function verifyEngagementAccess(req: AuthenticatedRequest, engagementId: string): Promise<boolean> {
  const firmId = req.user!.firmId;
  const userId = req.user!.id;
  const role = req.user!.role;
  const isPrivileged = ["PARTNER", "FIRM_ADMIN", "ADMIN", "SUPER_ADMIN"].includes(role);

  const engagement = await prisma.engagement.findFirst({
    where: {
      id: engagementId,
      ...(firmId ? { firmId } : {}),
      ...(!isPrivileged ? {
        OR: [
          { partnerId: userId },
          { managerId: userId },
          { teamMembers: { some: { userId } } },
        ],
      } : {}),
    },
    select: { id: true },
  });

  return !!engagement;
}

interface PageConclusionRow {
  id: string;
  engagementId: string;
  pageKey: string;
  userId: string;
  userName: string;
  userRole: string;
  authorityLevel: number;
  status: string;
  conclusionText: string;
  isSuperseded: boolean;
  supersededById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

router.get("/:engagementId/:pageKey", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, pageKey } = req.params;

    const hasAccess = await verifyEngagementAccess(req, engagementId);
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied to this engagement" });
    }

    const rows = await prisma.$queryRaw<PageConclusionRow[]>`
      SELECT id, "engagementId", "pageKey", "userId", "userName", "userRole",
             "authorityLevel", status, "conclusionText", "isSuperseded",
             "supersededById", "createdAt", "updatedAt"
      FROM "PageConclusion"
      WHERE "engagementId" = ${engagementId} AND "pageKey" = ${pageKey}
      ORDER BY "authorityLevel" ASC, "createdAt" ASC
    `;
    res.json(rows);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch conclusions";
    res.status(500).json({ error: message });
  }
});

router.post("/:engagementId/:pageKey", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, pageKey } = req.params;
    const { status, conclusionText } = req.body;
    const userId = req.user!.id;
    const userName = req.user!.name || req.user!.email || "Unknown";
    const userRole = (req.user!.role || "STAFF").toUpperCase();
    const authorityLevel = getAuthorityLevel(userRole);

    const hasAccess = await verifyEngagementAccess(req, engagementId);
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied to this engagement" });
    }

    if (!conclusionText || !status) {
      return res.status(400).json({ error: "Conclusion text and status are required" });
    }

    const validStatuses = ["Satisfactory", "Unsatisfactory", "Satisfactory with Recommendation", "N/A"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status value" });
    }

    const newId = generateUUID();

    await prisma.$transaction(async (tx) => {
      const existing = await tx.$queryRaw<PageConclusionRow[]>`
        SELECT id, status, "conclusionText"
        FROM "PageConclusion"
        WHERE "engagementId" = ${engagementId}
          AND "pageKey" = ${pageKey}
          AND "userId" = ${userId}
          AND "isSuperseded" = false
        ORDER BY "createdAt" DESC
        LIMIT 1
        FOR UPDATE
      `;

      const existingRow = existing.length > 0 ? existing[0] : null;

      if (existingRow) {
        await tx.$executeRaw`
          UPDATE "PageConclusion"
          SET "isSuperseded" = true, "supersededById" = ${newId}, "updatedAt" = NOW()
          WHERE id = ${existingRow.id}
        `;
      }

      await tx.$executeRaw`
        INSERT INTO "PageConclusion" (id, "engagementId", "pageKey", "userId", "userName", "userRole",
          "authorityLevel", status, "conclusionText", "isSuperseded", "supersededById", "createdAt", "updatedAt")
        VALUES (${newId}, ${engagementId}, ${pageKey}, ${userId}, ${userName}, ${userRole},
          ${authorityLevel}, ${status}, ${conclusionText}, false, ${null}, NOW(), NOW())
      `;

      logAuditTrail(
        userId,
        existingRow ? "CONCLUSION_UPDATED" : "CONCLUSION_CREATED",
        "PageConclusion",
        newId,
        existingRow ? { status: existingRow.status, text: existingRow.conclusionText } : undefined,
        { status, text: conclusionText },
        engagementId
      ).catch(() => {});
    });

    const result = await prisma.$queryRaw<PageConclusionRow[]>`
      SELECT * FROM "PageConclusion" WHERE id = ${newId}
    `;

    res.status(201).json(result[0]);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to save conclusion";
    res.status(500).json({ error: message });
  }
});

router.patch("/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, conclusionText } = req.body;
    const userId = req.user!.id;

    const existing = await prisma.$queryRaw<PageConclusionRow[]>`
      SELECT * FROM "PageConclusion" WHERE id = ${id}
    `;

    if (existing.length === 0) {
      return res.status(404).json({ error: "Conclusion not found" });
    }

    const row = existing[0];

    const hasAccess = await verifyEngagementAccess(req, row.engagementId);
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied to this engagement" });
    }

    if (row.userId !== userId) {
      return res.status(403).json({ error: "You can only edit your own conclusion" });
    }

    if (row.isSuperseded) {
      return res.status(403).json({ error: "Cannot edit a superseded conclusion" });
    }

    const validStatuses = ["Satisfactory", "Unsatisfactory", "Satisfactory with Recommendation", "N/A"];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status value" });
    }

    const newStatus = status || row.status;
    const newText = conclusionText || row.conclusionText;

    await prisma.$executeRaw`
      UPDATE "PageConclusion"
      SET status = ${newStatus}, "conclusionText" = ${newText}, "updatedAt" = NOW()
      WHERE id = ${id}
    `;

    const updated = await prisma.$queryRaw<PageConclusionRow[]>`
      SELECT * FROM "PageConclusion" WHERE id = ${id}
    `;

    logAuditTrail(
      userId,
      "CONCLUSION_EDITED",
      "PageConclusion",
      id,
      { status: row.status, text: row.conclusionText },
      { status: newStatus, text: newText },
      row.engagementId
    ).catch(() => {});

    res.json(updated[0]);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update conclusion";
    res.status(500).json({ error: message });
  }
});

export default router;
