import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, type AuthenticatedRequest } from "../auth";
import { createNotifications } from "./userNotificationRoutes";

const router = Router();

const PRIVILEGED_ROLES = ["FIRM_ADMIN", "PARTNER", "MANAGER", "EQCR"];

const noteInclude = {
  author: { select: { id: true, fullName: true, role: true, username: true } },
  resolvedBy: { select: { id: true, fullName: true, role: true } },
  assignees: {
    include: {
      user: { select: { id: true, fullName: true, role: true, username: true } },
    },
  },
  engagement: {
    select: {
      id: true,
      engagementCode: true,
      engagementType: true,
      fiscalYearEnd: true,
      client: { select: { id: true, name: true } },
    },
  },
  threads: {
    include: {
      author: { select: { id: true, fullName: true, role: true } },
    },
    orderBy: { createdAt: "asc" as const },
  },
};

router.get("/my", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const firmId = req.user!.firmId;
    const { status, severity, noteType, engagementId } = req.query;

    const notes = await prisma.reviewNote.findMany({
      where: {
        engagement: { firmId },
        assignees: { some: { userId } },
        ...(status && { status: status as string }),
        ...(severity && { severity: severity as string }),
        ...(noteType && { noteType: noteType as string }),
        ...(engagementId && { engagementId: engagementId as string }),
      },
      include: noteInclude,
      orderBy: { updatedAt: "desc" },
      take: 200,
    });

    res.json(notes);
  } catch (error) {
    console.error("Get my review notes error:", error);
    res.status(500).json({ error: "Failed to fetch review notes" });
  }
});

router.get("/created-by-me", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const firmId = req.user!.firmId;
    const { status, engagementId } = req.query;

    const notes = await prisma.reviewNote.findMany({
      where: {
        engagement: { firmId },
        authorId: userId,
        ...(status && { status: status as string }),
        ...(engagementId && { engagementId: engagementId as string }),
      },
      include: noteInclude,
      orderBy: { updatedAt: "desc" },
      take: 200,
    });

    res.json(notes);
  } catch (error) {
    console.error("Get created notes error:", error);
    res.status(500).json({ error: "Failed to fetch review notes" });
  }
});

router.get("/all", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    const userRole = req.user!.role;

    if (!PRIVILEGED_ROLES.includes(userRole)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    const { status, severity, noteType, engagementId, assigneeId } = req.query;

    const notes = await prisma.reviewNote.findMany({
      where: {
        engagement: { firmId },
        ...(status && { status: status as string }),
        ...(severity && { severity: severity as string }),
        ...(noteType && { noteType: noteType as string }),
        ...(engagementId && { engagementId: engagementId as string }),
        ...(assigneeId && { assignees: { some: { userId: assigneeId as string } } }),
      },
      include: noteInclude,
      orderBy: { updatedAt: "desc" },
      take: 500,
    });

    res.json(notes);
  } catch (error) {
    console.error("Get all review notes error:", error);
    res.status(500).json({ error: "Failed to fetch review notes" });
  }
});

router.get("/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const note = await prisma.reviewNote.findUnique({
      where: { id: req.params.id },
      include: noteInclude,
    });

    if (!note || note.engagement.client === null) {
      return res.status(404).json({ error: "Note not found" });
    }

    const eng = await prisma.engagement.findUnique({
      where: { id: note.engagementId },
      select: { firmId: true },
    });

    if (eng?.firmId !== req.user!.firmId) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json(note);
  } catch (error) {
    console.error("Get review note error:", error);
    res.status(500).json({ error: "Failed to fetch review note" });
  }
});

const VALID_PHASES = ["ONBOARDING", "PRE_PLANNING", "PLANNING", "EXECUTION", "FINALIZATION", "REPORTING", "EQCR", "INSPECTION"] as const;
const VALID_STATUSES = ["OPEN", "ADDRESSED", "CLEARED"] as const;
const VALID_SEVERITIES = ["INFO", "LOW", "MEDIUM", "WARNING", "HIGH", "CRITICAL"] as const;

interface NoteWithAssignees {
  authorId: string;
  assignees?: Array<{ userId: string }>;
}

function isAuthorAssigneeOrPrivileged(note: NoteWithAssignees, userId: string, userRole: string): boolean {
  if (PRIVILEGED_ROLES.includes(userRole)) return true;
  if (note.authorId === userId) return true;
  if (note.assignees?.some((a) => a.userId === userId)) return true;
  return false;
}

const createSchema = z.object({
  engagementId: z.string().uuid(),
  phase: z.enum(VALID_PHASES),
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  noteType: z.enum(["ISSUE", "QUESTION", "TODO"]).default("ISSUE"),
  severity: z.enum(VALID_SEVERITIES).default("INFO"),
  sectionKey: z.string().optional(),
  dueDate: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  assigneeIds: z.array(z.string().uuid()).optional(),
  checklistItemId: z.string().uuid().optional(),
});

router.post("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = createSchema.parse(req.body);

    const engagement = await prisma.engagement.findUnique({
      where: { id: data.engagementId },
      select: { id: true, firmId: true, status: true },
    });

    if (!engagement || engagement.firmId !== req.user!.firmId) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    if (engagement.status === "COMPLETED" || engagement.status === "ARCHIVED") {
      return res.status(400).json({ error: "Cannot add notes to a completed or archived engagement" });
    }

    if (data.assigneeIds && data.assigneeIds.length > 0) {
      const validUsers = await prisma.user.count({
        where: {
          id: { in: data.assigneeIds },
          firmId: req.user!.firmId,
          status: "ACTIVE",
        },
      });
      if (validUsers !== data.assigneeIds.length) {
        return res.status(400).json({ error: "One or more assignees are not valid firm members" });
      }
    }

    const note = await prisma.reviewNote.create({
      data: {
        engagementId: data.engagementId,
        authorId: req.user!.id,
        phase: data.phase,
        title: data.title,
        content: data.content,
        noteType: data.noteType,
        severity: data.severity,
        sectionKey: data.sectionKey,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        checklistItemId: data.checklistItemId,
        assignees: data.assigneeIds && data.assigneeIds.length > 0 ? {
          create: data.assigneeIds.map((uid) => ({
            userId: uid,
            assignedById: req.user!.id,
          })),
        } : undefined,
      },
      include: noteInclude,
    });

    if (data.assigneeIds && data.assigneeIds.length > 0) {
      const recipientIds = data.assigneeIds.filter((uid) => uid !== req.user!.id);
      const engCode = note.engagement?.engagementCode || "";
      const clientName = note.engagement?.client?.name || "";
      createNotifications(recipientIds, {
        type: "REVIEW_NOTE_ASSIGNED",
        title: "New review note assigned",
        message: `${req.user!.fullName} assigned you a ${data.noteType.toLowerCase()}: "${data.title}" — ${clientName} ${engCode}`,
        referenceId: note.id,
        referenceType: "REVIEW_NOTE",
      });
    }

    res.status(201).json(note);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("Create review note error:", error);
    res.status(500).json({ error: "Failed to create review note" });
  }
});

const statusTransitionSchema = z.object({
  status: z.enum(["OPEN", "ADDRESSED", "CLEARED"]),
  resolution: z.string().optional(),
});

router.patch("/:id/status", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const existing = await prisma.reviewNote.findUnique({
      where: { id: req.params.id },
      include: {
        engagement: { select: { firmId: true } },
        assignees: { select: { userId: true } },
      },
    });

    if (!existing) return res.status(404).json({ error: "Note not found" });
    if (existing.engagement.firmId !== req.user!.firmId) return res.status(403).json({ error: "Access denied" });
    if (existing.isLocked) return res.status(400).json({ error: "This note is locked (engagement finalized)" });

    if (!isAuthorAssigneeOrPrivileged(existing, req.user!.id, req.user!.role)) {
      return res.status(403).json({ error: "You must be the author, assignee, or a manager to update this note" });
    }

    const data = statusTransitionSchema.parse(req.body);

    const allowedTransitions: Record<string, string[]> = {
      OPEN: ["ADDRESSED"],
      ADDRESSED: ["OPEN", "CLEARED"],
      CLEARED: ["OPEN"],
    };

    if (!allowedTransitions[existing.status]?.includes(data.status)) {
      return res.status(400).json({ error: `Cannot transition from ${existing.status} to ${data.status}` });
    }

    if (data.status === "CLEARED" && !PRIVILEGED_ROLES.includes(req.user!.role)) {
      return res.status(403).json({ error: "Only managers or above can clear review notes" });
    }

    if (data.status === "CLEARED" && (!data.resolution || data.resolution.trim().length === 0)) {
      return res.status(400).json({ error: "Resolution is required when clearing a note" });
    }

    const updateData: {
      status: string;
      resolution?: string;
      resolvedById?: string | null;
      resolvedAt?: Date | null;
    } = {
      status: data.status,
      resolution: data.resolution,
    };

    if (data.status === "CLEARED") {
      updateData.resolvedById = req.user!.id;
      updateData.resolvedAt = new Date();
    }

    if (data.status === "OPEN") {
      updateData.resolvedById = null;
      updateData.resolvedAt = null;
      updateData.resolution = undefined;
    }

    const note = await prisma.reviewNote.update({
      where: { id: req.params.id },
      data: updateData,
      include: noteInclude,
    });

    const allInvolved = new Set<string>();
    if (existing.authorId) allInvolved.add(existing.authorId);
    existing.assignees?.forEach((a) => allInvolved.add(a.userId));
    allInvolved.delete(req.user!.id);

    const statusLabel = data.status === "CLEARED" ? "cleared" : data.status === "ADDRESSED" ? "addressed" : "reopened";
    createNotifications([...allInvolved], {
      type: "REVIEW_NOTE_STATUS",
      title: `Review note ${statusLabel}`,
      message: `${req.user!.fullName} ${statusLabel} the note: "${existing.title}"`,
      referenceId: existing.id,
      referenceType: "REVIEW_NOTE",
    });

    res.json(note);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed" });
    console.error("Update review note status error:", error);
    res.status(500).json({ error: "Failed to update status" });
  }
});

router.post("/:id/messages", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const note = await prisma.reviewNote.findUnique({
      where: { id: req.params.id },
      include: {
        engagement: { select: { firmId: true } },
        assignees: { select: { userId: true } },
      },
    });

    if (!note) return res.status(404).json({ error: "Note not found" });
    if (note.engagement.firmId !== req.user!.firmId) return res.status(403).json({ error: "Access denied" });
    if (note.isLocked) return res.status(400).json({ error: "Note is locked" });

    if (!isAuthorAssigneeOrPrivileged(note, req.user!.id, req.user!.role)) {
      return res.status(403).json({ error: "You must be the author, assignee, or a manager to reply" });
    }

    const { message } = req.body;
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ error: "Message is required" });
    }

    const thread = await prisma.reviewThread.create({
      data: {
        reviewNoteId: req.params.id,
        authorId: req.user!.id,
        message: message.trim(),
      },
      include: {
        author: { select: { id: true, fullName: true, role: true } },
      },
    });

    await prisma.reviewNote.update({
      where: { id: req.params.id },
      data: { updatedAt: new Date() },
    });

    const allInvolved = new Set<string>();
    if (note.authorId) allInvolved.add(note.authorId);
    note.assignees?.forEach((a) => allInvolved.add(a.userId));
    allInvolved.delete(req.user!.id);

    createNotifications([...allInvolved], {
      type: "REVIEW_NOTE_REPLY",
      title: "New reply on review note",
      message: `${req.user!.fullName} replied on: "${note.title}"`,
      referenceId: note.id,
      referenceType: "REVIEW_NOTE",
    });

    res.status(201).json(thread);
  } catch (error) {
    console.error("Add review note message error:", error);
    res.status(500).json({ error: "Failed to add message" });
  }
});

router.get("/engagement/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const engagement = await prisma.engagement.findUnique({
      where: { id: req.params.engagementId },
      select: { firmId: true },
    });

    if (!engagement || engagement.firmId !== req.user!.firmId) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const { phase, status } = req.query;

    const notes = await prisma.reviewNote.findMany({
      where: {
        engagementId: req.params.engagementId,
        ...(phase && { phase: phase as string }),
        ...(status && { status: status as string }),
      },
      include: noteInclude,
      orderBy: { createdAt: "desc" },
    });

    res.json(notes);
  } catch (error) {
    console.error("Get engagement review notes error:", error);
    res.status(500).json({ error: "Failed to fetch review notes" });
  }
});

router.get("/stats/summary", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const firmId = req.user!.firmId;

    const [myOpen, myTotal, createdOpen, createdTotal] = await Promise.all([
      prisma.reviewNote.count({
        where: { engagement: { firmId }, assignees: { some: { userId } }, status: "OPEN" },
      }),
      prisma.reviewNote.count({
        where: { engagement: { firmId }, assignees: { some: { userId } } },
      }),
      prisma.reviewNote.count({
        where: { engagement: { firmId }, authorId: userId, status: "OPEN" },
      }),
      prisma.reviewNote.count({
        where: { engagement: { firmId }, authorId: userId },
      }),
    ]);

    res.json({ myOpen, myTotal, createdOpen, createdTotal });
  } catch (error) {
    console.error("Get review note stats error:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

export default router;
