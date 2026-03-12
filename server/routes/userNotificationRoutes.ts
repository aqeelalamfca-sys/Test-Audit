import { Router, Response } from "express";
import { prisma } from "../db";
import { requireAuth, type AuthenticatedRequest } from "../auth";

const router = Router();

router.get("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = parseInt(req.query.offset as string) || 0;
    const unreadOnly = req.query.unreadOnly === "true";

    const where: any = { userId };
    if (unreadOnly) where.isRead = false;

    const [notifications, unreadCount] = await Promise.all([
      prisma.userNotification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.userNotification.count({
        where: { userId, isRead: false },
      }),
    ]);

    res.json({ notifications, unreadCount });
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

router.patch("/:id/read", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const notification = await prisma.userNotification.findUnique({
      where: { id: req.params.id },
    });

    if (!notification || notification.userId !== req.user!.id) {
      return res.status(404).json({ error: "Notification not found" });
    }

    await prisma.userNotification.update({
      where: { id: req.params.id },
      data: { isRead: true },
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Mark notification read error:", error);
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
});

router.patch("/mark-all-read", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await prisma.userNotification.updateMany({
      where: { userId: req.user!.id, isRead: false },
      data: { isRead: true },
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Mark all read error:", error);
    res.status(500).json({ error: "Failed to mark all as read" });
  }
});

export default router;

export async function createNotifications(
  userIds: string[],
  data: {
    type: string;
    title: string;
    message: string;
    referenceId?: string;
    referenceType?: string;
  }
) {
  if (userIds.length === 0) return;

  const uniqueIds = [...new Set(userIds)];

  try {
    await prisma.userNotification.createMany({
      data: uniqueIds.map((userId) => ({
        userId,
        type: data.type,
        title: data.title,
        message: data.message,
        referenceId: data.referenceId,
        referenceType: data.referenceType,
      })),
    });
  } catch (error) {
    console.error("Failed to create notifications:", error);
  }
}
