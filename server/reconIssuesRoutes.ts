import { Router, Response } from "express";
import { requireAuth, type AuthenticatedRequest } from "./auth";
import { prisma } from "./db";
import {
  runFullScan,
  getIssues,
  getIssueSummary,
  getGateStatus,
  resolveIssue,
  suppressIssue,
  generateDraftFSSnapshot,
  autoFixDeterministic,
} from "./services/reconIssuesEngine";

const router = Router();

router.post("/engagements/:engagementId/recon/scan", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const userId = req.user!.id;
    const result = await runFullScan(engagementId, userId);
    res.json(result);
  } catch (error) {
    console.error("Error running reconciliation scan:", error);
    res.status(500).json({ error: "Failed to run reconciliation scan" });
  }
});

router.get("/engagements/:engagementId/recon/issues", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { tab, severity, status } = req.query;
    const filters: Record<string, string> = {};
    if (tab) filters.tab = tab as string;
    if (severity) filters.severity = severity as string;
    if (status) filters.status = status as string;
    const issues = await getIssues(engagementId, filters);
    res.json(issues);
  } catch (error) {
    console.error("Error fetching recon issues:", error);
    res.status(500).json({ error: "Failed to fetch reconciliation issues" });
  }
});

router.get("/engagements/:engagementId/recon/summary", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const summary = await getIssueSummary(engagementId);
    res.json(summary);
  } catch (error) {
    console.error("Error fetching recon summary:", error);
    res.status(500).json({ error: "Failed to fetch reconciliation summary" });
  }
});

router.get("/engagements/:engagementId/recon/gates", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const gateStatus = await getGateStatus(engagementId);
    res.json(gateStatus);
  } catch (error) {
    console.error("Error fetching gate status:", error);
    res.status(500).json({ error: "Failed to fetch gate status" });
  }
});

router.patch("/engagements/:engagementId/recon/issues/:issueId/resolve", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { issueId } = req.params;
    const userId = req.user!.id;
    const { notes } = req.body;
    const result = await resolveIssue(issueId, userId, notes);
    res.json(result);
  } catch (error) {
    console.error("Error resolving issue:", error);
    res.status(500).json({ error: "Failed to resolve issue" });
  }
});

router.patch("/engagements/:engagementId/recon/issues/:issueId/suppress", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { issueId } = req.params;
    const userId = req.user!.id;
    const { notes } = req.body;
    if (!notes) {
      return res.status(400).json({ error: "Notes are required to suppress an issue" });
    }
    const result = await suppressIssue(issueId, userId, notes);
    res.json(result);
  } catch (error) {
    console.error("Error suppressing issue:", error);
    res.status(500).json({ error: "Failed to suppress issue" });
  }
});

router.post("/engagements/:engagementId/recon/draft-fs", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const userId = req.user!.id;
    const snapshot = await generateDraftFSSnapshot(engagementId, userId);
    res.json(snapshot);
  } catch (error) {
    console.error("Error generating Draft FS snapshot:", error);
    res.status(500).json({ error: "Failed to generate Draft FS snapshot" });
  }
});

router.get("/engagements/:engagementId/recon/draft-fs", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const snapshots = await prisma.draftFSSnapshot.findMany({
      where: { engagementId },
      orderBy: { generatedAt: "desc" },
    });
    res.json(snapshots);
  } catch (error) {
    console.error("Error fetching Draft FS snapshots:", error);
    res.status(500).json({ error: "Failed to fetch Draft FS snapshots" });
  }
});

router.post("/engagements/:engagementId/recon/fix-links", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const userId = req.user!.id;
    const result = await autoFixDeterministic(engagementId, userId);
    res.json(result);
  } catch (error) {
    console.error("Error running auto-fix:", error);
    res.status(500).json({ error: "Failed to run auto-fix" });
  }
});

export default router;
