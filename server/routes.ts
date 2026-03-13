import type { Express, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { prisma } from "./db";
import { authMiddleware, jwtAuthMiddleware, requireAuth, requireMinRole, requireRoles, logAuditTrail, type AuthenticatedRequest } from "./auth";
import { invalidatePhaseCache, requirePhaseUnlocked } from "./middleware/auditLock";
import authRoutes from "./authRoutes";
import clientRoutes from "./clientRoutes";
import ethicsRoutes from "./ethicsRoutes";
import planningRoutes from "./planningRoutes";
import controlsRoutes from "./controlsRoutes";
import substantiveRoutes from "./substantiveRoutes";
import analyticalRoutes from "./analyticalRoutes";
import evidenceRoutes from "./evidenceRoutes";
import finalizationRoutes from "./finalizationRoutes";
import eqcrRoutes from "./eqcrRoutes";
import inspectionRoutes from "./inspectionRoutes";
import firmRoutes from "./firmRoutes";
import userManagementRoutes from "./userManagementRoutes";
import complianceRoutes from "./complianceRoutes";
import amlRoutes from "./amlRoutes";
import engagementLetterRoutes from "./engagementLetterRoutes";
import clientMasterRoutes from "./clientMasterRoutes";
import substantiveTestingRoutes from "./substantiveTestingRoutes";
import auditProgramRoutes from "./auditProgramRoutes";
import isqmRoutes from "./isqmRoutes";
import permissionRoutes from "./permissionRoutes";
import intelligenceRoutes from "./intelligenceRoutes";
import qcrRoutes from "./qcrRoutes";
import aiRoutes from "./aiRoutes";
import preplanningAiRoutes from "./routes/preplanning-ai";
import documentRoutes from "./documentRoutes";
import trialBalanceRoutes from "./trialBalanceRoutes";
import deliverablesRoutes from "./deliverablesRoutes";
import pdfDocumentationRoutes from "./pdfDocumentationRoutes";
import signOffRoutes from "./signOffRoutes";
import sectionSignOffRoutes from "./sectionSignOffRoutes";
import workpaperRoutes from "./workpaperRoutes";
import adminRoutes from "./adminRoutes";
import clientPortalRoutes from "./clientPortalRoutes";
import enforcementRoutes from "./enforcementRoutes";
import coaRoutes from "./coaRoutes";
import fsHeadRoutes from "./fsHeadRoutes";
import fsHeadAIRoutes from "./routes/fsHeadAIRoutes";
import samplingRoutes from "./samplingRoutes";
import fsDraftRoutes from "./fsDraftRoutes";
import pushRoutes from "./pushRoutes";
import mappingRoutes from "./mappingRoutes";
import fieldOrchestrationRoutes from "./fieldOrchestrationRoutes";
import { fetchEngineRouter } from "./fetchEngineRoutes";
import linkageEngineRoutes from "./linkageEngineRoutes";
import healthRoutes from "./healthRoutes";
import workflowRoutes from "./workflowRoutes";
import reportingRoutes from "./reportingRoutes";
import workbookRoutes from "./workbookRoutes";
import outputsRoutes from "./outputsRoutes";
import fieldRegistryRoutes from "./fieldRegistryRoutes";
import reconciliationRoutes from "./reconciliationRoutes";
import reviewMappingRoutes from "./routes/reviewMappingRoutes";
import phaseStateRoutes from "./routes/phaseStateRoutes";
import dataHubRoutes from "./dataHubRoutes";
import observationRoutes from "./observationRoutes";
import auditAdjustmentRoutes from "./auditAdjustmentRoutes";
import glCodeRoutes from "./glCodeRoutes";
import controlPackRoutes from "./controlPackRoutes";
import aiRiskAssessmentRoutes from "./aiRiskAssessmentRoutes";
import planningAnalyticsRoutes from "./planningAnalyticsRoutes";
import isa320MaterialityRoutes from "./isa320MaterialityRoutes";
import isa300StrategyRoutes from "./isa300StrategyRoutes";
import isa530SamplingRoutes from "./isa530SamplingRoutes";
import linkageMonitorRoutes from "./linkageMonitorRoutes";
import chainIntegrityRoutes from "./chainIntegrityRoutes";
import linkIntegrityRoutes from "./linkIntegrityRoutes";
import reconIssuesRoutes from "./reconIssuesRoutes";
import dataIntakeRoutes from "./dataIntakeRoutes";
import hardControlsRoutes from "./hardControlsRoutes";
import aiUtilityRoutes from "./routes/aiUtilityRoutes";
import finalizationBoardRoutes from "./finalizationBoardRoutes";
import firmWideControlsRoutes from "./firmWideControlsRoutes";
import regulatoryComplianceRoutes from "./routes/regulatoryComplianceRoutes";
import simulationRoutes from "./routes/simulationRoutes";
import complianceExportRoutes from "./routes/complianceExportRoutes";
import planningDashboardRoutes from "./planningDashboardRoutes";
import reviewNoteRoutes from "./routes/reviewNoteRoutes";
import userNotificationRoutes from "./routes/userNotificationRoutes";
import opinionEngineRoutes from "./opinionEngineRoutes";
import firmControlComplianceLogRoutes from "./routes/firmControlComplianceLogRoutes";
import { attachEnforcementContext, enforceInspectionMode } from "./middleware/enforcementMiddleware";
import { withTenantContext } from "./middleware/tenantDbContext";
import { generateInformationRequestLetter } from "./exportInfoRequestLetter";
import { aiRateLimit, authRateLimit } from "./middleware/rateLimiter";
import { subscriptionGuard } from "./middleware/subscriptionGuard";
import { z } from "zod";
import type { AuditPhase } from "@prisma/client";

/**
 * Backend storage phases (Prisma AuditPhase enum values).
 * For the canonical 19-phase workflow, see shared/phases.ts CANONICAL_PHASES.
 */
const PHASE_ORDER = [
  "ONBOARDING",
  "PRE_PLANNING",
  "PLANNING",
  "EXECUTION",
  "FINALIZATION",
  "REPORTING",
  "EQCR",
  "INSPECTION",
] as const;

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use(jwtAuthMiddleware);

  const SUBSCRIPTION_GUARD_EXCLUDED = ["/api/auth", "/api/platform", "/api/health", "/api/logs", "/__healthz"];
  app.use((req: AuthenticatedRequest, res, next) => {
    const path = req.originalUrl || req.path;
    if (SUBSCRIPTION_GUARD_EXCLUDED.some(prefix => path.startsWith(prefix))) {
      return next();
    }
    if (!path.startsWith("/api/")) {
      return next();
    }
    return subscriptionGuard(req, res, next);
  });

  // Parse optional active context headers on all requests
  app.use((req: AuthenticatedRequest, res, next) => {
    req.activeClientId = (req.headers["x-active-client-id"] as string) || null;
    req.activePeriodId = (req.headers["x-active-period-id"] as string) || null;
    next();
  });

  app.use("/api/auth", authRateLimit, authRoutes);
  app.use("/api/clients", clientRoutes);

  app.get("/api/clients/:id/engagement-periods", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const clientId = req.params.id;
      const firmId = req.user!.firmId;
      if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

      // Only return engagements for which the user is assigned to the team (or is an admin/partner)
      const isPrivileged = ["PARTNER", "FIRM_ADMIN"].includes(req.user!.role);

      const engagements = await prisma.engagement.findMany({
        where: {
          clientId,
          firmId,
          ...(isPrivileged ? {} : { team: { some: { userId: req.user!.id } } })
        },
        select: { id: true, engagementCode: true, periodStart: true, periodEnd: true, status: true, fiscalYearEnd: true },
        orderBy: { fiscalYearEnd: "desc" }
      });

      if (!engagements) return res.status(404).json({ error: "No engagements found" });

      res.json(engagements.map(e => ({ id: e.id, periodLabel: e.engagementCode || `${e.fiscalYearEnd}`, startDate: e.periodStart, endDate: e.periodEnd, status: e.status })));
    } catch (error) {
      console.error("Client engagement periods error:", error);
      res.status(500).json({ error: "Failed to fetch engagement periods" });
    }
  });
  app.use("/api/ethics", ethicsRoutes);
  app.use("/api/planning", planningRoutes);
  app.use("/api/planning-dashboard", planningDashboardRoutes);
  app.use("/api/controls", controlsRoutes);
  app.use("/api/substantive", substantiveRoutes);
  app.use("/api/analytical", analyticalRoutes);
  app.use("/api/evidence", evidenceRoutes);
  app.use("/api/finalization", finalizationRoutes);
  app.use("/api/finalization-board", finalizationBoardRoutes);
  app.use("/api/eqcr", eqcrRoutes);
  app.use("/api/inspection", inspectionRoutes);
  app.use("/api/firms", firmRoutes);
  app.use("/api/users", userManagementRoutes);
  app.use("/api/enforcement", enforcementRoutes);

  app.use(attachEnforcementContext());
  app.use(enforceInspectionMode());
  app.use("/api/compliance", complianceRoutes);
  app.use("/api/compliance-export", complianceExportRoutes);
  app.use("/api/aml", amlRoutes);
  app.use("/api/engagement-letters", engagementLetterRoutes);
  app.use("/api/client-master", clientMasterRoutes);
  app.use("/api/substantive-testing", substantiveTestingRoutes);
  app.use("/api/audit-program", auditProgramRoutes);
  app.use("/api/isqm", isqmRoutes);
  app.use("/api/firm-wide-controls", firmWideControlsRoutes);
  app.use("/api/firm-control-compliance-log", firmControlComplianceLogRoutes);
  app.use("/api/rbac", permissionRoutes);
  app.use("/api/intelligence", intelligenceRoutes);
  app.use("/api/qcr", qcrRoutes);
  app.use("/api/ai", aiRateLimit, aiRoutes);
  app.use("/api/ai/preplanning", aiRateLimit, preplanningAiRoutes);
  app.use("/api/documents", documentRoutes);
  app.use("/api/trial-balance", trialBalanceRoutes);
  app.use("/api/deliverables", deliverablesRoutes);
  app.use("/api/pdf-documentation", pdfDocumentationRoutes);
  app.use("/api/sign-offs", signOffRoutes);
  app.use("/api/section-signoffs", sectionSignOffRoutes);
  app.use("/api/workpapers", workpaperRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/client-portal", clientPortalRoutes);
  app.use(coaRoutes);
  app.use(fsHeadRoutes);
  app.use("/api/fs-heads-ai", fsHeadAIRoutes);
  app.use("/api/sampling", samplingRoutes);
  app.use("/api/fs-draft", fsDraftRoutes);
  app.use("/api/push", pushRoutes);
  app.use("/api/mapping", mappingRoutes);
  app.use("/api/review-mapping", reviewMappingRoutes);
  app.use("/api/phase-state", phaseStateRoutes);
  app.use("/api/field-orchestration", fieldOrchestrationRoutes);
  app.use("/api/fetch-engine", fetchEngineRouter);
  app.use("/api/linkage-engine", linkageEngineRoutes);
  app.use("/api/chain-integrity", chainIntegrityRoutes);
  app.use("/api/health", healthRoutes);
  app.use("/api/workflow", workflowRoutes);
  app.use("/api/reports", reportingRoutes);
  app.use("/api/audit", workbookRoutes);
  app.use("/api", outputsRoutes);
  app.use("/api/field-registry", fieldRegistryRoutes);
  app.use("/api", reconciliationRoutes);
  app.use("/api/data-hub", dataHubRoutes);
  app.use("/api/observations", observationRoutes);
  app.use("/api/audit-adjustments", auditAdjustmentRoutes);
  app.use("/api/engagements", glCodeRoutes);
  app.use("/api/engagements", controlPackRoutes);
  app.use("/api/ai-risk-assessment", aiRateLimit, aiRiskAssessmentRoutes);
  app.use("/api/ai-utilities", aiRateLimit, requireAuth, aiUtilityRoutes);
  app.use("/api/planning-analytics", planningAnalyticsRoutes);
  app.use("/api/isa320-materiality", isa320MaterialityRoutes);
  app.use("/api/isa300-strategy", isa300StrategyRoutes);
  app.use("/api/isa530-sampling", isa530SamplingRoutes);
  app.use("/api/linkage-monitor", linkageMonitorRoutes);
  app.use("/api/link-integrity", linkIntegrityRoutes);
  app.use("/api", reconIssuesRoutes);
  app.use("/api", dataIntakeRoutes);
  app.use(hardControlsRoutes);
  app.use("/api/compliance/checklists", regulatoryComplianceRoutes);
  app.use("/api/simulation", simulationRoutes);
  app.use("/api/review-notes-v2", reviewNoteRoutes);
  app.use("/api/notifications", userNotificationRoutes);
  app.use("/api/opinion-engine", opinionEngineRoutes);

  // Phase Gate Engine API
  const { evaluatePhaseGates, evaluateAllGates, canAdvanceToPhase } = await import("./services/phaseGateEngine");

  async function verifyEngagementAccess(req: AuthenticatedRequest, res: Response): Promise<boolean> {
    const engagementId = req.params.engagementId;
    const firmId = req.user!.firmId;
    const userId = req.user!.id;
    const role = req.user!.role;
    const isPrivileged = ["PARTNER", "FIRM_ADMIN"].includes(role);

    const engagement = await prisma.engagement.findFirst({
      where: {
        id: engagementId,
        firmId,
        ...(isPrivileged ? {} : { team: { some: { userId } } }),
      },
      select: { id: true },
    });

    if (!engagement) {
      res.status(404).json({ error: "Engagement not found or access denied" });
      return false;
    }
    return true;
  }

  app.get("/api/phase-gates/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!(await verifyEngagementAccess(req, res))) return;
      const snapshot = await evaluateAllGates(req.params.engagementId);
      res.json(snapshot);
    } catch (error) {
      console.error("Phase gate evaluation error:", error);
      res.status(500).json({ error: "Failed to evaluate phase gates" });
    }
  });

  app.get("/api/phase-gates/:engagementId/:phaseKey", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!(await verifyEngagementAccess(req, res))) return;
      const evaluation = await evaluatePhaseGates(req.params.engagementId, req.params.phaseKey);
      res.json(evaluation);
    } catch (error) {
      console.error("Phase gate evaluation error:", error);
      res.status(500).json({ error: "Failed to evaluate phase gate" });
    }
  });

  app.post("/api/phase-gates/:engagementId/:phaseKey/advance", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!(await verifyEngagementAccess(req, res))) return;
      const result = await canAdvanceToPhase(req.params.engagementId, req.params.phaseKey);
      res.json(result);
    } catch (error) {
      console.error("Phase advance check error:", error);
      res.status(500).json({ error: "Failed to check phase advancement" });
    }
  });

  app.get("/api/ai/phase/:phaseKey/capabilities", requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const { getPhaseAIConfig } = await import("./services/aiPhaseOrchestrator");
      const config = getPhaseAIConfig(_req.params.phaseKey);
      if (!config) {
        return res.status(404).json({ error: "Phase not found or has no AI capabilities" });
      }
      res.json(config);
    } catch (error) {
      console.error("AI phase capabilities error:", error);
      res.status(500).json({ error: "Failed to load AI phase capabilities" });
    }
  });

  app.get("/api/ai/phases/capabilities", requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const { getAllPhaseAIConfigs } = await import("./services/aiPhaseOrchestrator");
      res.json(getAllPhaseAIConfigs());
    } catch (error) {
      console.error("AI phases capabilities error:", error);
      res.status(500).json({ error: "Failed to load AI phase capabilities" });
    }
  });

  app.post("/api/ai/phase/:phaseKey/generate", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { engagementId, capabilityId, additionalContext } = req.body;
      if (!engagementId || !capabilityId) {
        return res.status(400).json({ error: "engagementId and capabilityId are required" });
      }
      const firmId = req.user!.firmId;
      const userId = req.user!.id;
      const userRole = req.user!.role;
      const engagement = await prisma.engagement.findFirst({
        where: { id: engagementId, firmId },
      });
      if (!engagement) {
        return res.status(404).json({ error: "Engagement not found or access denied" });
      }
      if (!["PARTNER", "FIRM_ADMIN"].includes(userRole)) {
        const membership = await prisma.engagementTeam.findFirst({
          where: { engagementId, userId },
        });
        if (!membership) {
          return res.status(403).json({ error: "Not a member of this engagement team" });
        }
      }
      const { generatePhaseAIContent, getPhaseAIConfig } = await import("./services/aiPhaseOrchestrator");
      const { getPhaseByKey } = await import("../shared/phases");
      const result = await generatePhaseAIContent({
        engagementId,
        phaseKey: req.params.phaseKey,
        capabilityId,
        additionalContext,
        firmId,
      });

      const phase = getPhaseByKey(req.params.phaseKey);
      if (!phase?.backendPhase) {
        return res.status(400).json({ error: "Invalid phase key" });
      }
      const backendPhase = phase.backendPhase;
      const confidence = typeof result.confidence === "number" ? result.confidence : 0.75;
      try {
        await prisma.aISuggestion.upsert({
          where: {
            engagementId_phase_section_fieldKey: {
              engagementId,
              phase: backendPhase as any,
              section: req.params.phaseKey,
              fieldKey: capabilityId,
            },
          },
          create: {
            engagementId,
            phase: backendPhase as any,
            section: req.params.phaseKey,
            fieldKey: capabilityId,
            aiValue: result.content,
            confidence,
            rationale: result.disclaimer,
            citations: [],
            status: "AI_SUGGESTED",
            modelVersion: result.provider || "gpt-4o",
            modelProvider: result.provider?.split("-")[0] || "openai",
            generatedById: userId,
          },
          update: {
            aiValue: result.content,
            confidence,
            rationale: result.disclaimer,
            modelVersion: result.provider || "gpt-4o",
            generatedAt: new Date(),
          },
        });
        await prisma.aIAuditLog.create({
          data: {
            engagementId,
            phase: backendPhase as any,
            section: req.params.phaseKey,
            fieldKey: capabilityId,
            action: "AI_GENERATE",
            newValue: result.content?.substring(0, 2000),
            newStatus: "AI_SUGGESTED",
            aiConfidence: confidence,
            aiRationale: result.disclaimer,
            userId,
            userName: req.user?.username,
            userRole,
          },
        });
      } catch (persistErr) {
        console.error("AI suggestion persist warning:", persistErr);
      }

      res.json(result);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : "AI generation failed";
      console.error("AI phase generation error:", error);
      res.status(500).json({ error: errMsg });
    }
  });

  app.get("/api/ai/phase-suggestions/:engagementId/:phaseKey", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { engagementId, phaseKey } = req.params;
      const firmId = req.user!.firmId;
      const engagement = await prisma.engagement.findFirst({
        where: { id: engagementId, firmId },
        select: { id: true },
      });
      if (!engagement) {
        return res.status(404).json({ error: "Engagement not found" });
      }
      const { getPhaseByKey } = await import("../shared/phases");
      const phase = getPhaseByKey(phaseKey);
      const backendPhase = phase?.backendPhase;

      const suggestions = await prisma.aISuggestion.findMany({
        where: {
          engagementId,
          ...(backendPhase ? { phase: backendPhase as any } : {}),
          section: phaseKey,
        },
        orderBy: { generatedAt: "desc" },
        include: {
          generatedBy: { select: { fullName: true, role: true } },
          overriddenBy: { select: { fullName: true, role: true } },
        },
      });

      const auditLogs = await prisma.aIAuditLog.findMany({
        where: {
          engagementId,
          section: phaseKey,
        },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          user: { select: { fullName: true, role: true } },
        },
      });

      res.json({
        success: true,
        suggestions: suggestions.map((s: any) => ({
          id: s.id,
          fieldKey: s.fieldKey,
          aiValue: s.aiValue,
          userValue: s.userValue,
          status: s.status,
          confidence: s.confidence,
          rationale: s.rationale,
          citations: s.citations,
          isaReference: s.isaReference,
          modelVersion: s.modelVersion,
          generatedAt: s.generatedAt,
          generatedBy: s.generatedBy?.fullName,
          overriddenAt: s.overriddenAt,
          overriddenBy: s.overriddenBy?.fullName,
          overrideReason: s.overrideReason,
        })),
        auditLog: auditLogs.map((l: any) => ({
          id: l.id,
          fieldKey: l.fieldKey,
          action: l.action,
          previousValue: l.previousValue?.substring(0, 200),
          newValue: l.newValue?.substring(0, 200),
          previousStatus: l.previousStatus,
          newStatus: l.newStatus,
          aiConfidence: l.aiConfidence,
          userName: l.user?.fullName || l.userName,
          userRole: l.user?.role || l.userRole,
          createdAt: l.createdAt,
        })),
      });
    } catch (error: unknown) {
      console.error("Phase suggestions error:", error);
      res.status(500).json({ error: "Failed to fetch phase suggestions" });
    }
  });

  app.post("/api/ai/phase-suggestions/:engagementId/:phaseKey/accept", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { engagementId, phaseKey } = req.params;
      const { fieldKey, userValue, overrideReason } = req.body;
      if (!fieldKey) return res.status(400).json({ error: "fieldKey is required" });

      const firmId = req.user!.firmId;
      const engagement = await prisma.engagement.findFirst({
        where: { id: engagementId, firmId },
        select: { id: true },
      });
      if (!engagement) return res.status(404).json({ error: "Engagement not found" });

      const { getPhaseByKey } = await import("../shared/phases");
      const phase = getPhaseByKey(phaseKey);
      if (!phase?.backendPhase) return res.status(400).json({ error: "Invalid phase key" });
      const backendPhase = phase.backendPhase as any;

      const existing = await prisma.aISuggestion.findUnique({
        where: {
          engagementId_phase_section_fieldKey: {
            engagementId,
            phase: backendPhase,
            section: phaseKey,
            fieldKey,
          },
        },
      });

      const isEdited = userValue && existing?.aiValue && userValue !== existing.aiValue;
      const finalStatus = isEdited ? "USER_OVERRIDE" : "USER_ACCEPTED";

      await prisma.aISuggestion.upsert({
        where: {
          engagementId_phase_section_fieldKey: {
            engagementId,
            phase: backendPhase,
            section: phaseKey,
            fieldKey,
          },
        },
        create: {
          engagementId,
          phase: backendPhase,
          section: phaseKey,
          fieldKey,
          userValue: userValue || existing?.aiValue,
          status: finalStatus,
          confidence: 1,
          rationale: overrideReason || "Accepted by user",
          overriddenAt: new Date(),
          overriddenById: req.user!.id,
          overrideReason,
        },
        update: {
          userValue: userValue || undefined,
          status: finalStatus,
          overriddenAt: new Date(),
          overriddenById: req.user!.id,
          overrideReason,
        },
      });

      await prisma.aIAuditLog.create({
        data: {
          engagementId,
          phase: backendPhase,
          section: phaseKey,
          fieldKey,
          action: isEdited ? "USER_OVERRIDE" : "USER_ACCEPT",
          previousValue: existing?.aiValue?.substring(0, 2000),
          newValue: (userValue || existing?.aiValue)?.substring(0, 2000),
          previousStatus: existing?.status as any,
          newStatus: finalStatus,
          userId: req.user!.id,
          userName: req.user?.username,
          userRole: req.user?.role,
        },
      });

      res.json({ success: true, status: finalStatus });
    } catch (error: unknown) {
      console.error("Accept suggestion error:", error);
      res.status(500).json({ error: "Failed to accept suggestion" });
    }
  });

  app.post("/api/ai/phase-suggestions/:engagementId/:phaseKey/reject", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { engagementId, phaseKey } = req.params;
      const { fieldKey } = req.body;
      if (!fieldKey) return res.status(400).json({ error: "fieldKey is required" });

      const firmId = req.user!.firmId;
      const engagement = await prisma.engagement.findFirst({
        where: { id: engagementId, firmId },
        select: { id: true },
      });
      if (!engagement) return res.status(404).json({ error: "Engagement not found" });

      const { getPhaseByKey } = await import("../shared/phases");
      const phase = getPhaseByKey(phaseKey);
      if (!phase?.backendPhase) return res.status(400).json({ error: "Invalid phase key" });
      const backendPhase = phase.backendPhase as any;

      const existing = await prisma.aISuggestion.findUnique({
        where: {
          engagementId_phase_section_fieldKey: {
            engagementId,
            phase: backendPhase,
            section: phaseKey,
            fieldKey,
          },
        },
      });

      if (existing) {
        await prisma.aISuggestion.update({
          where: { id: existing.id },
          data: {
            status: "MANUAL",
            revertedAt: new Date(),
            revertedById: req.user!.id,
          },
        });
      }

      await prisma.aIAuditLog.create({
        data: {
          engagementId,
          phase: backendPhase,
          section: phaseKey,
          fieldKey,
          action: "USER_REJECT",
          previousValue: existing?.aiValue?.substring(0, 2000),
          previousStatus: existing?.status as any,
          newStatus: "MANUAL",
          userId: req.user!.id,
          userName: req.user?.username,
          userRole: req.user?.role,
        },
      });

      res.json({ success: true, status: "MANUAL" });
    } catch (error: unknown) {
      console.error("Reject suggestion error:", error);
      res.status(500).json({ error: "Failed to reject suggestion" });
    }
  });

  app.get("/api/workspace/:engagementId/planning", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { engagementId } = req.params;
      const firmId = req.user!.firmId;
      const engagement = await prisma.engagement.findFirst({
        where: { id: engagementId, firmId },
        select: { id: true },
      });
      if (!engagement) return res.status(404).json({ error: "Engagement not found" });

      const memo = await prisma.planningMemo.findUnique({
        where: { engagementId },
      });

      if (!memo?.teamBriefingNotes) {
        return res.json({ success: true, data: null });
      }

      try {
        const data = JSON.parse(memo.teamBriefingNotes);
        return res.json({ success: true, data: { data } });
      } catch {
        return res.json({ success: true, data: null });
      }
    } catch (error: any) {
      console.error("Load planning data error:", error);
      res.status(500).json({ error: "Failed to load planning data", details: error.message });
    }
  });

  app.post("/api/workspace/:engagementId/planning/draft", requireAuth, requirePhaseUnlocked("PLANNING"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { engagementId } = req.params;
      const firmId = req.user!.firmId;
      const engagement = await prisma.engagement.findFirst({
        where: { id: engagementId, firmId },
        select: { id: true },
      });
      if (!engagement) return res.status(404).json({ error: "Engagement not found" });

      const payload = req.body?.data || req.body;
      const jsonStr = JSON.stringify(payload);

      const existing = await prisma.planningMemo.findUnique({ where: { engagementId } });
      if (existing) {
        await prisma.planningMemo.update({
          where: { engagementId },
          data: { teamBriefingNotes: jsonStr },
        });
      } else {
        const team = await prisma.engagementTeam.findFirst({ where: { engagementId } });
        await prisma.planningMemo.create({
          data: {
            engagementId,
            preparedById: team?.userId || req.user!.id,
            teamBriefingNotes: jsonStr,
          },
        });
      }

      res.json({ success: true, message: "Draft saved" });
    } catch (error: any) {
      console.error("Save planning draft error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.put("/api/workspace/:engagementId/planning", requireAuth, requirePhaseUnlocked("PLANNING"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { engagementId } = req.params;
      const firmId = req.user!.firmId;
      const engagement = await prisma.engagement.findFirst({
        where: { id: engagementId, firmId },
        select: { id: true },
      });
      if (!engagement) return res.status(404).json({ error: "Engagement not found" });

      const payload = req.body?.data || req.body;
      const jsonStr = JSON.stringify(payload);

      const existing = await prisma.planningMemo.findUnique({ where: { engagementId } });
      if (existing) {
        await prisma.planningMemo.update({
          where: { engagementId },
          data: { teamBriefingNotes: jsonStr },
        });
      } else {
        const team = await prisma.engagementTeam.findFirst({ where: { engagementId } });
        await prisma.planningMemo.create({
          data: {
            engagementId,
            preparedById: team?.userId || req.user!.id,
            teamBriefingNotes: jsonStr,
          },
        });
      }

      logAuditTrail(
        req.user!.id,
        "PLANNING_DATA_SAVED",
        "planning_memo",
        engagementId,
        null,
        null,
        engagementId,
        "Planning data saved",
        req.ip,
        req.get("user-agent")
      ).catch(err => console.error("Audit trail error:", err));

      res.json({ success: true, message: "Planning data saved" });
    } catch (error: any) {
      console.error("Save planning data error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get("/api/secp/opinions", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const firmId = req.user!.firmId;
      if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

      const engagements = await prisma.engagement.findMany({
        where: { firmId },
        include: {
          client: { select: { name: true } },
          auditReport: {
            select: {
              opinionType: true,
              reportDate: true,
              reportReference: true,
              releasedDate: true,
              releasedToClient: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      });

      const opinions = engagements.map((eng) => ({
        engagementId: eng.id,
        engagementName: eng.engagementCode || "",
        clientName: eng.client?.name || "",
        yearEnd: eng.periodEnd ? eng.periodEnd.toISOString() : eng.fiscalYearEnd ? eng.fiscalYearEnd.toISOString() : "",
        opinionType: eng.auditReport?.opinionType || "NOT_APPLICABLE",
        status: eng.auditReport?.releasedToClient ? "ISSUED" : eng.auditReport ? "FINAL" : eng.status || "DRAFT",
        deliveredDate: eng.auditReport?.releasedDate?.toISOString() || null,
        reportReference: eng.auditReport?.reportReference || null,
      }));

      res.json(opinions);
    } catch (error) {
      console.error("SECP opinions error:", error);
      res.status(500).json({ error: "Failed to fetch opinion data" });
    }
  });

  app.get("/api/dashboard/stats", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const firmId = req.user!.firmId;
      if (!firmId) {
        return res.status(400).json({ error: "User not associated with a firm" });
      }

      const result = await withTenantContext(firmId, async (tx) => {
        const [
          activeEngagements,
          totalClients,
          openReviewNotes,
          engagements,
        ] = await Promise.all([
          tx.engagement.count({
            where: { firmId, status: "ACTIVE" },
          }),
          tx.client.count({
            where: { firmId, isActive: true },
          }),
          tx.reviewNote.count({
            where: {
              engagement: { firmId },
              status: "OPEN",
            },
          }),
          tx.engagement.findMany({
            where: { firmId },
            include: {
              client: true,
              phases: true,
              team: { include: { user: true } },
              _count: { select: { reviewNotes: { where: { status: "OPEN" } } } },
            },
            orderBy: { updatedAt: "desc" },
            take: 10,
          }),
        ]);

        const phaseDistribution = await tx.phaseProgress.groupBy({
          by: ["status"],
          where: {
            engagement: { firmId, status: "ACTIVE" },
          },
          _count: true,
        });

        return {
          stats: {
            activeEngagements,
            totalClients,
            openReviewNotes,
            completedThisMonth: 0,
          },
          engagements: engagements.map((eng) => ({
            ...eng,
            openReviewNotes: eng._count.reviewNotes,
          })),
          phaseDistribution,
        };
      });

      res.json(result);
    } catch (error) {
      console.error("Dashboard error:", error);
      res.status(500).json({ error: "Failed to fetch dashboard data" });
    }
  });

  app.get("/api/engagements", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const firmId = req.user!.firmId;
      if (!firmId) {
        return res.status(400).json({ error: "User not associated with a firm" });
      }

      const engagements = await withTenantContext(firmId, async (tx) => {
        return tx.engagement.findMany({
          where: { firmId },
          include: {
            client: true,
            phases: true,
            team: { include: { user: { select: { id: true, fullName: true, role: true } } } },
          },
          orderBy: { updatedAt: "desc" },
        });
      });

      res.json(engagements);
    } catch (error) {
      console.error("Get engagements error:", error);
      res.status(500).json({ error: "Failed to fetch engagements" });
    }
  });

  app.get("/api/engagements/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const firmId = req.user!.firmId;
      if (!firmId) {
        return res.status(400).json({ error: "User not associated with a firm" });
      }

      const engagement = await withTenantContext(firmId, async (tx) => {
        return tx.engagement.findUnique({
          where: { id: req.params.id },
          include: {
            client: true,
            firm: true,
            phases: { orderBy: { phase: "asc" } },
            team: { include: { user: { select: { id: true, fullName: true, role: true, email: true } } } },
            financialPeriods: true,
            _count: { select: { reviewNotes: true, checklistItems: true, documents: true } },
          },
        });
      });

      if (!engagement) {
        return res.status(404).json({ error: "Engagement not found" });
      }

      if (engagement.firmId !== firmId) {
        return res.status(403).json({ error: "Access denied" });
      }

      res.json(engagement);
    } catch (error) {
      console.error("Get engagement error:", error);
      res.status(500).json({ error: "Failed to fetch engagement" });
    }
  });

  const nullableUuid = z.string().uuid().nullish().transform(v => v || undefined);
  const nullableStr = z.string().nullish().transform(v => v || undefined);
  const nullableNum = z.number().nullish().transform(v => v ?? undefined);

  const createEngagementSchema = z.object({
    clientId: z.string().uuid(),
    engagementCode: nullableStr,
    engagementType: z.string().default("statutory_audit"),
    reportingFramework: z.enum(["IFRS", "IFRS_SME", "LOCAL_GAAP", "AFRS", "GAAP_PK", "IPSAS", "ISLAMIC", "OTHER"]).nullish(),
    sizeClassification: nullableStr,
    periodStart: z.string().min(1, "Period start is required"),
    periodEnd: z.string().min(1, "Period end is required"),
    riskRating: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
    fiscalYearEnd: nullableStr,
    fieldworkStartDate: nullableStr,
    fieldworkEndDate: nullableStr,
    reportDeadline: nullableStr,
    filingDeadline: nullableStr,
    budgetHours: nullableNum,
    isGroupAudit: z.boolean().default(false),
    isComponentAudit: z.boolean().default(false),
    eqcrRationale: nullableStr,
    shareCapital: nullableNum,
    authorizedCapital: nullableNum,
    paidUpCapital: nullableNum,
    numberOfEmployees: nullableNum,
    lastYearRevenue: nullableNum,
    previousYearRevenue: nullableNum,
    companyCategory: nullableStr,
    priorAuditor: nullableStr,
    priorAuditorEmail: z.string().email().nullish().or(z.literal("")).transform(v => v || undefined),
    priorAuditorPhone: nullableStr,
    priorAuditorAddress: nullableStr,
    priorAuditOpinion: nullableStr,
    priorAuditorReason: nullableStr,
    udin: nullableStr,
    managementIntegrity: nullableStr,
    eqcrRequired: z.boolean().default(false),
    eqcrPartnerUserId: nullableUuid,
    engagementPartnerId: nullableUuid,
    engagementManagerId: nullableUuid,
    teamLeadId: nullableUuid,
  });

  app.post("/api/engagements", requireAuth, requireMinRole("SENIOR"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const firmId = req.user!.firmId;
      if (!firmId) {
        return res.status(400).json({ error: "User not associated with a firm" });
      }

      const data = createEngagementSchema.parse(req.body);

      const fullEngagement = await withTenantContext(firmId, async (tx) => {
        const client = await tx.client.findFirst({
          where: { id: data.clientId, firmId },
        });

        if (!client) {
          throw Object.assign(new Error("Client not found"), { statusCode: 404 });
        }

        if (data.sizeClassification) {
          await tx.client.update({
            where: { id: data.clientId },
            data: { sizeClassification: data.sizeClassification },
          });
        }

        const generateUniqueCode = async (preferredCode?: string): Promise<string> => {
          if (preferredCode) {
            const existing = await tx.engagement.findUnique({ where: { engagementCode: preferredCode } });
            if (!existing) return preferredCode;
          }
          const periodYear = new Date(data.periodEnd).getFullYear();
          const clientCode = client.name.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X');
          const count = await tx.engagement.count({ where: { firmId, clientId: data.clientId } });
          const baseCode = `${clientCode}-${periodYear}-${String(count + 1).padStart(3, '0')}`;
          const baseExisting = await tx.engagement.findUnique({ where: { engagementCode: baseCode } });
          if (!baseExisting) return baseCode;
          return `${clientCode}-${periodYear}-${String(count + 1).padStart(3, '0')}-${Math.random().toString(36).slice(2, 6)}`;
        };

        const engagementCode = await generateUniqueCode(data.engagementCode);

        const engagementData: any = {
          firmId,
          clientId: data.clientId,
          engagementCode,
          engagementType: data.engagementType,
          riskRating: data.riskRating,
          periodStart: new Date(data.periodStart),
          periodEnd: new Date(data.periodEnd),
          fiscalYearEnd: data.fiscalYearEnd ? new Date(data.fiscalYearEnd) : new Date(data.periodEnd),
          reportingFramework: data.reportingFramework || undefined,
          fieldworkStartDate: data.fieldworkStartDate ? new Date(data.fieldworkStartDate) : null,
          fieldworkEndDate: data.fieldworkEndDate ? new Date(data.fieldworkEndDate) : null,
          reportDeadline: data.reportDeadline ? new Date(data.reportDeadline) : null,
          filingDeadline: data.filingDeadline ? new Date(data.filingDeadline) : null,
          isGroupAudit: data.isGroupAudit || false,
          isComponentAudit: data.isComponentAudit || false,
          eqcrRationale: data.eqcrRationale || null,
          budgetHours: data.budgetHours,
          shareCapital: data.shareCapital,
          authorizedCapital: data.authorizedCapital,
          paidUpCapital: data.paidUpCapital,
          numberOfEmployees: data.numberOfEmployees,
          lastYearRevenue: data.lastYearRevenue,
          previousYearRevenue: data.previousYearRevenue,
          companyCategory: data.companyCategory,
          priorAuditor: data.priorAuditor,
          priorAuditorEmail: data.priorAuditorEmail || null,
          priorAuditorPhone: data.priorAuditorPhone || null,
          priorAuditorAddress: data.priorAuditorAddress || null,
          priorAuditOpinion: data.priorAuditOpinion || null,
          priorAuditorReason: data.priorAuditorReason,
          udin: data.udin || null,
          managementIntegrity: data.managementIntegrity,
          eqcrRequired: data.eqcrRequired || false,
          engagementPartnerId: data.engagementPartnerId || null,
          engagementManagerId: data.engagementManagerId || null,
          teamLeadId: data.teamLeadId || null,
        };

        let engagement: any;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            engagement = await tx.engagement.create({ data: engagementData });
            break;
          } catch (err: any) {
            if (err?.code === 'P2002' && attempt < 2) {
              engagementData.engagementCode = await generateUniqueCode();
              continue;
            }
            throw err;
          }
        }
        if (!engagement) throw new Error("Failed to create engagement after retries");

        if (data.eqcrRequired && data.eqcrPartnerUserId) {
          await tx.eQCRAssignment.create({
            data: {
              engagementId: engagement.id,
              isRequired: true,
              requirementReason: "Assigned at engagement creation",
              status: "ASSIGNED",
              assignedReviewerId: data.eqcrPartnerUserId,
              assignedDate: new Date(),
              assignedById: req.user!.id,
            },
          });
        }

        for (const phase of PHASE_ORDER) {
          await tx.phaseProgress.create({
            data: {
              engagementId: engagement.id,
              phase,
              status: phase === "ONBOARDING" ? "IN_PROGRESS" : "NOT_STARTED",
              completionPercentage: 0,
              startedAt: phase === "ONBOARDING" ? new Date() : null,
            },
          });
        }

        await tx.engagementTeam.create({
          data: {
            engagementId: engagement.id,
            userId: req.user!.id,
            role: req.user!.role,
            isLead: !data.engagementPartnerId && !data.engagementManagerId,
          },
        });

        if (data.engagementPartnerId && data.engagementPartnerId !== req.user!.id) {
          const partner = await tx.user.findUnique({ where: { id: data.engagementPartnerId } });
          if (partner && partner.firmId === firmId) {
            await tx.engagementTeam.create({
              data: {
                engagementId: engagement.id,
                userId: data.engagementPartnerId,
                role: partner.role,
                isLead: true,
              },
            });
          }
        }

        if (data.engagementManagerId && 
            data.engagementManagerId !== req.user!.id && 
            data.engagementManagerId !== data.engagementPartnerId) {
          const manager = await tx.user.findUnique({ where: { id: data.engagementManagerId } });
          if (manager && manager.firmId === firmId) {
            await tx.engagementTeam.create({
              data: {
                engagementId: engagement.id,
                userId: data.engagementManagerId,
                role: manager.role,
                isLead: false,
              },
            });
          }
        }

        if (data.teamLeadId && 
            data.teamLeadId !== req.user!.id && 
            data.teamLeadId !== data.engagementPartnerId &&
            data.teamLeadId !== data.engagementManagerId) {
          const teamLead = await tx.user.findUnique({ where: { id: data.teamLeadId } });
          if (teamLead && teamLead.firmId === firmId) {
            await tx.engagementTeam.create({
              data: {
                engagementId: engagement.id,
                userId: data.teamLeadId,
                role: teamLead.role,
                isLead: false,
              },
            });
          }
        }

        return tx.engagement.findUnique({
          where: { id: engagement.id },
          include: { client: true, phases: true, team: { include: { user: true } } },
        });
      });

      logAuditTrail(
        req.user!.id,
        "ENGAGEMENT_CREATED",
        "engagement",
        fullEngagement!.id,
        null,
        fullEngagement,
        fullEngagement!.id,
        "New engagement created",
        req.ip,
        req.get("user-agent")
      ).catch(err => console.error("Audit trail log error:", err));

      res.status(201).json(fullEngagement);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      if (error?.statusCode === 404) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Create engagement error:", error);
      res.status(500).json({ error: "Failed to create engagement" });
    }
  });

  app.patch("/api/engagements/:id", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const firmId = req.user!.firmId;
      if (!firmId) {
        return res.status(400).json({ error: "User not associated with a firm" });
      }

      const updateSchema = z.object({
        engagementType: z.string().optional(),
        status: z.enum(["DRAFT", "ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"]).optional(),
        riskRating: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
        currentPhase: z.enum(PHASE_ORDER).optional(),
        budgetHours: z.number().optional(),
        actualHours: z.number().optional(),
        fiscalYearEnd: z.string().optional().nullable(),
        periodStart: z.string().optional().nullable(),
        periodEnd: z.string().optional().nullable(),
        fieldworkStartDate: z.string().optional().nullable(),
        fieldworkEndDate: z.string().optional().nullable(),
        reportDeadline: z.string().optional().nullable(),
        filingDeadline: z.string().optional().nullable(),
        reportingFramework: z.enum(["IFRS", "IFRS_SME", "LOCAL_GAAP", "AFRS", "GAAP_PK", "IPSAS", "ISLAMIC", "OTHER"]).optional(),
        applicableLaw: z.string().optional().nullable(),
        priorAuditor: z.string().optional().nullable(),
        priorAuditorReason: z.string().optional().nullable(),
        priorAuditorEmail: z.string().optional().nullable(),
        priorAuditorPhone: z.string().optional().nullable(),
        priorAuditorAddress: z.string().optional().nullable(),
        priorAuditOpinion: z.string().optional().nullable(),
        udin: z.string().optional().nullable(),
        shareCapital: z.number().optional().nullable(),
        authorizedCapital: z.number().optional().nullable(),
        paidUpCapital: z.number().optional().nullable(),
        numberOfEmployees: z.number().optional().nullable(),
        lastYearRevenue: z.number().optional().nullable(),
        previousYearRevenue: z.number().optional().nullable(),
        companyCategory: z.string().optional().nullable(),
        eqcrRequired: z.boolean().optional(),
        engagementPartnerId: z.string().uuid().optional().nullable(),
        engagementManagerId: z.string().uuid().optional().nullable(),
        teamLeadId: z.string().uuid().optional().nullable(),
      });

      const data = updateSchema.parse(req.body);

      const updateData: any = {};
      if (data.engagementType !== undefined) updateData.engagementType = data.engagementType;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.riskRating !== undefined) updateData.riskRating = data.riskRating;
      if (data.currentPhase !== undefined) updateData.currentPhase = data.currentPhase;
      if (data.budgetHours !== undefined) updateData.budgetHours = data.budgetHours;
      if (data.actualHours !== undefined) updateData.actualHours = data.actualHours;
      if (data.fiscalYearEnd !== undefined) updateData.fiscalYearEnd = data.fiscalYearEnd ? new Date(data.fiscalYearEnd) : null;
      if (data.periodStart !== undefined) updateData.periodStart = data.periodStart ? new Date(data.periodStart) : null;
      if (data.periodEnd !== undefined) updateData.periodEnd = data.periodEnd ? new Date(data.periodEnd) : null;
      if (data.fieldworkStartDate !== undefined) updateData.fieldworkStartDate = data.fieldworkStartDate ? new Date(data.fieldworkStartDate) : null;
      if (data.fieldworkEndDate !== undefined) updateData.fieldworkEndDate = data.fieldworkEndDate ? new Date(data.fieldworkEndDate) : null;
      if (data.reportDeadline !== undefined) updateData.reportDeadline = data.reportDeadline ? new Date(data.reportDeadline) : null;
      if (data.filingDeadline !== undefined) updateData.filingDeadline = data.filingDeadline ? new Date(data.filingDeadline) : null;
      if (data.reportingFramework !== undefined) updateData.reportingFramework = data.reportingFramework;
      if (data.applicableLaw !== undefined) updateData.applicableLaw = data.applicableLaw;
      if (data.priorAuditor !== undefined) updateData.priorAuditor = data.priorAuditor;
      if (data.priorAuditorReason !== undefined) updateData.priorAuditorReason = data.priorAuditorReason;
      if (data.priorAuditorEmail !== undefined) updateData.priorAuditorEmail = data.priorAuditorEmail;
      if (data.priorAuditorPhone !== undefined) updateData.priorAuditorPhone = data.priorAuditorPhone;
      if (data.priorAuditorAddress !== undefined) updateData.priorAuditorAddress = data.priorAuditorAddress;
      if (data.priorAuditOpinion !== undefined) updateData.priorAuditOpinion = data.priorAuditOpinion;
      if (data.udin !== undefined) updateData.udin = data.udin;
      if (data.shareCapital !== undefined) updateData.shareCapital = data.shareCapital;
      if (data.authorizedCapital !== undefined) updateData.authorizedCapital = data.authorizedCapital;
      if (data.paidUpCapital !== undefined) updateData.paidUpCapital = data.paidUpCapital;
      if (data.numberOfEmployees !== undefined) updateData.numberOfEmployees = data.numberOfEmployees;
      if (data.lastYearRevenue !== undefined) updateData.lastYearRevenue = data.lastYearRevenue;
      if (data.previousYearRevenue !== undefined) updateData.previousYearRevenue = data.previousYearRevenue;
      if (data.companyCategory !== undefined) updateData.companyCategory = data.companyCategory;
      if (data.eqcrRequired !== undefined) updateData.eqcrRequired = data.eqcrRequired;
      if (data.engagementPartnerId !== undefined) updateData.engagementPartnerId = data.engagementPartnerId;
      if (data.engagementManagerId !== undefined) updateData.engagementManagerId = data.engagementManagerId;
      if (data.teamLeadId !== undefined) updateData.teamLeadId = data.teamLeadId;

      const { updated, previousData } = await withTenantContext(firmId, async (tx) => {
        const existing = await tx.engagement.findUnique({
          where: { id: req.params.id },
        });

        if (!existing) {
          throw Object.assign(new Error("Engagement not found"), { statusCode: 404 });
        }

        if (existing.firmId !== firmId) {
          throw Object.assign(new Error("Access denied"), { statusCode: 403 });
        }

        const result = await tx.engagement.update({
          where: { id: req.params.id },
          data: updateData,
        });

        return { updated: result, previousData: existing };
      });

      logAuditTrail(
        req.user!.id,
        "ENGAGEMENT_UPDATED",
        "engagement",
        updated.id,
        previousData,
        updated,
        updated.id,
        req.body.justification || "Engagement updated",
        req.ip,
        req.get("user-agent")
      ).catch(err => console.error("Audit trail log error:", err));

      res.json(updated);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      if (error?.statusCode === 404) {
        return res.status(404).json({ error: error.message });
      }
      if (error?.statusCode === 403) {
        return res.status(403).json({ error: error.message });
      }
      console.error("Update engagement error:", error);
      res.status(500).json({ error: "Failed to update engagement" });
    }
  });

  app.get("/api/engagements/:id/phases", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const phases = await prisma.phaseProgress.findMany({
        where: { engagementId: req.params.id },
        orderBy: { phase: "asc" },
      });

      res.json(phases);
    } catch (error) {
      console.error("Get phases error:", error);
      res.status(500).json({ error: "Failed to fetch phases" });
    }
  });

  // POST /api/engagements/:id/start - Start an engagement (idempotent, seeds workspace)
  app.post("/api/engagements/:id/start", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const firmId = req.user!.firmId;

      const engagement = await prisma.engagement.findUnique({
        where: { id },
        include: { phases: true, team: true },
      });

      if (!engagement) {
        return res.status(404).json({ error: "Engagement not found" });
      }

      if (engagement.firmId !== firmId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Check if user has access (is on the team or is admin/partner)
      const isPrivileged = ["PARTNER", "FIRM_ADMIN"].includes(req.user!.role);
      const isTeamMember = engagement.team.some(t => t.userId === userId);
      if (!isPrivileged && !isTeamMember) {
        return res.status(403).json({ error: "You are not assigned to this engagement" });
      }

      // If already started, just return the resume route
      if (engagement.startedAt) {
        const userProgress = await prisma.engagementUserProgress.findUnique({
          where: { engagementId_userId: { engagementId: id, userId } },
        });
        const resumeRoute = userProgress?.lastRoute || engagement.lastRoute || `/engagement/${id}/pre-planning`;
        return res.json({
          engagementId: id,
          startedAt: engagement.startedAt,
          currentPhase: engagement.currentPhase,
          resumeRoute,
          alreadyStarted: true,
        });
      }

      // Seed workspace (idempotent - only create if not exists)
      const defaultRoute = `/workspace/${id}/pre-planning`;
      
      // Create baseline phase progress if not exists
      const existingPhases = await prisma.phaseProgress.findMany({ where: { engagementId: id } });
      if (existingPhases.length === 0) {
        for (const phase of PHASE_ORDER) {
          await prisma.phaseProgress.upsert({
            where: { engagementId_phase: { engagementId: id, phase } },
            update: {},
            create: {
              engagementId: id,
              phase,
              status: phase === "PRE_PLANNING" ? "IN_PROGRESS" : "NOT_STARTED",
              completionPercentage: 0,
              startedAt: phase === "PRE_PLANNING" ? new Date() : null,
            },
          });
        }
      }

      // Update engagement as started
      const updated = await prisma.engagement.update({
        where: { id },
        data: {
          startedAt: new Date(),
          status: "ACTIVE",
          currentPhase: "PRE_PLANNING",
          lastRoute: defaultRoute,
          lastActivityAt: new Date(),
        },
      });

      // Create/update user progress
      await prisma.engagementUserProgress.upsert({
        where: { engagementId_userId: { engagementId: id, userId } },
        update: { lastRoute: defaultRoute, lastPhase: "PRE_PLANNING" },
        create: { engagementId: id, userId, lastRoute: defaultRoute, lastPhase: "PRE_PLANNING" },
      });

      await logAuditTrail(
        userId,
        "ENGAGEMENT_STARTED",
        "engagement",
        id,
        { startedAt: null },
        { startedAt: updated.startedAt },
        id,
        "Engagement started and workspace seeded",
        req.ip,
        req.get("user-agent")
      );

      res.json({
        engagementId: id,
        startedAt: updated.startedAt,
        currentPhase: updated.currentPhase,
        resumeRoute: defaultRoute,
        alreadyStarted: false,
      });
    } catch (error) {
      console.error("Start engagement error:", error);
      res.status(500).json({ error: "Failed to start engagement" });
    }
  });

  // GET /api/engagements/:id/resume - Get the resume route for an engagement
  app.get("/api/engagements/:id/resume", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const firmId = req.user!.firmId;

      const engagement = await prisma.engagement.findUnique({
        where: { id },
        include: { team: true },
      });

      if (!engagement) {
        return res.status(404).json({ error: "Engagement not found" });
      }

      if (engagement.firmId !== firmId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Check if user has access
      const isPrivileged = ["PARTNER", "FIRM_ADMIN"].includes(req.user!.role);
      const isTeamMember = engagement.team.some(t => t.userId === userId);
      if (!isPrivileged && !isTeamMember) {
        return res.status(403).json({ error: "You are not assigned to this engagement" });
      }

      // Determine resume route priority: user progress > engagement lastRoute > default
      const userProgress = await prisma.engagementUserProgress.findUnique({
        where: { engagementId_userId: { engagementId: id, userId } },
      });

      const defaultRoute = `/workspace/${id}/pre-planning`;
      let resumeRoute = userProgress?.lastRoute || engagement.lastRoute || defaultRoute;

      const validRoutePatterns = [
        /^\/workspace\/[^\/]+\/(pre-planning|requisition|planning|execution|fs-heads|evidence|finalization|deliverables|eqcr|inspection)$/,
        /^\/engagement\/[^\/]+\/(pre-planning|planning|execution|finalization|eqcr|inspection)$/,
        /^\/engagements$/,
      ];
      const isValidRoute = validRoutePatterns.some(pattern => pattern.test(resumeRoute));
      if (!isValidRoute) {
        resumeRoute = defaultRoute;
      }

      res.json({
        resumeRoute,
        currentPhase: userProgress?.lastPhase || engagement.currentPhase,
        isStarted: !!engagement.startedAt,
      });
    } catch (error) {
      console.error("Get resume route error:", error);
      res.status(500).json({ error: "Failed to get resume route" });
    }
  });

  // PATCH /api/engagements/:id/progress - Update user's last visited route
  app.patch("/api/engagements/:id/progress", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const firmId = req.user!.firmId;

      const progressSchema = z.object({
        lastRoute: z.string().optional(),
        lastPhase: z.enum(PHASE_ORDER).optional(),
      });

      const data = progressSchema.parse(req.body);

      const engagement = await prisma.engagement.findUnique({
        where: { id },
      });

      if (!engagement) {
        return res.status(404).json({ error: "Engagement not found" });
      }

      if (engagement.firmId !== firmId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Update user progress
      const userProgress = await prisma.engagementUserProgress.upsert({
        where: { engagementId_userId: { engagementId: id, userId } },
        update: {
          lastRoute: data.lastRoute,
          lastPhase: data.lastPhase,
        },
        create: {
          engagementId: id,
          userId,
          lastRoute: data.lastRoute,
          lastPhase: data.lastPhase,
        },
      });

      // Also update engagement-level tracking
      await prisma.engagement.update({
        where: { id },
        data: {
          lastRoute: data.lastRoute,
          lastActivityAt: new Date(),
          ...(data.lastPhase ? { currentPhase: data.lastPhase } : {}),
        },
      });

      res.json({ success: true, userProgress });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Update progress error:", error);
      res.status(500).json({ error: "Failed to update progress" });
    }
  });

  app.put("/api/engagements/:id/team", requireAuth, requireRoles("FIRM_ADMIN", "PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const engagement = await prisma.engagement.findUnique({
        where: { id: req.params.id },
        include: { team: { include: { user: { select: { id: true, fullName: true } } } } },
      });

      if (!engagement || engagement.firmId !== req.user!.firmId) {
        return res.status(404).json({ error: "Engagement not found" });
      }

      const teamSchema = z.object({
        team: z.array(z.object({
          userId: z.string(),
          role: z.string(),
          isLead: z.boolean().optional(),
        })),
        eqcrRequired: z.boolean().optional(),
      });

      const { team, eqcrRequired } = teamSchema.parse(req.body);

      const userIds = team.map(m => m.userId);
      if (userIds.length > 0) {
        const validUsers = await prisma.user.findMany({
          where: { id: { in: userIds }, firmId: req.user!.firmId },
          select: { id: true, fullName: true },
        });
        const validIds = new Set(validUsers.map(u => u.id));
        const invalidIds = userIds.filter(id => !validIds.has(id));
        if (invalidIds.length > 0) {
          return res.status(400).json({ error: "Invalid user IDs: users not found in your firm" });
        }
      }

      const beforeSnapshot = engagement.team.map(t => ({
        role: t.role,
        userId: t.userId,
        fullName: t.user?.fullName || "Unknown",
      }));

      await prisma.engagementTeam.deleteMany({
        where: { engagementId: req.params.id },
      });

      for (const member of team) {
        await prisma.engagementTeam.create({
          data: {
            engagementId: req.params.id,
            userId: member.userId,
            role: member.role,
            isLead: member.isLead || false,
          },
        });
      }

      if (eqcrRequired !== undefined) {
        await prisma.engagement.update({
          where: { id: req.params.id },
          data: { eqcrRequired },
        });
      }

      const afterUsers = userIds.length > 0
        ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, fullName: true } })
        : [];
      const userMap = new Map(afterUsers.map(u => [u.id, u.fullName]));
      const afterSnapshot = team.map(t => ({
        role: t.role,
        userId: t.userId,
        fullName: userMap.get(t.userId) || "Unknown",
      }));

      await logAuditTrail(
        req.user!.id,
        "TEAM_UPDATED",
        "engagement",
        engagement.id,
        beforeSnapshot,
        afterSnapshot,
        engagement.id,
        "Team allocation updated",
        req.ip,
        req.get("user-agent")
      );

      const updated = await prisma.engagement.findUnique({
        where: { id: req.params.id },
        include: { team: { include: { user: true } } },
      });

      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Update team error:", error);
      res.status(500).json({ error: "Failed to update team" });
    }
  });

  app.get("/api/engagements/:id/team-history", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const engagement = await prisma.engagement.findUnique({
        where: { id: req.params.id },
        select: { id: true, firmId: true },
      });

      if (!engagement || engagement.firmId !== req.user!.firmId) {
        return res.status(404).json({ error: "Engagement not found" });
      }

      const history = await prisma.auditTrail.findMany({
        where: {
          engagementId: req.params.id,
          action: "TEAM_UPDATED",
        },
        include: {
          user: { select: { id: true, fullName: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      res.json(history);
    } catch (error) {
      console.error("Get team history error:", error);
      res.status(500).json({ error: "Failed to fetch team history" });
    }
  });

  app.patch("/api/engagements/:id/phases/:phase/lock", requireAuth, requireRoles("PARTNER", "EQCR"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id, phase } = req.params;

      const engagement = await prisma.engagement.findUnique({
        where: { id },
        include: { phases: true },
      });

      if (!engagement || engagement.firmId !== req.user!.firmId) {
        return res.status(404).json({ error: "Engagement not found" });
      }

      const phaseProgress = engagement.phases.find((p) => p.phase === phase);
      if (!phaseProgress) {
        return res.status(404).json({ error: "Phase not found" });
      }

      if (phaseProgress.status === "LOCKED" || phaseProgress.status === "COMPLETED") {
        return res.status(400).json({ error: "Phase is already locked" });
      }

      const phaseIndex = PHASE_ORDER.indexOf(phase as typeof PHASE_ORDER[number]);
      for (let i = 0; i < phaseIndex; i++) {
        const prevPhase = engagement.phases.find((p) => p.phase === PHASE_ORDER[i]);
        if (prevPhase && prevPhase.status !== "COMPLETED" && prevPhase.status !== "LOCKED") {
          return res.status(400).json({ error: `Previous phase ${PHASE_ORDER[i]} must be completed first` });
        }
      }

      if (req.user!.role === "PARTNER" && !phaseProgress.approvedById) {
        const updated = await prisma.phaseProgress.update({
          where: { id: phaseProgress.id },
          data: {
            status: "UNDER_REVIEW",
            lockedById: req.user!.id,
            lockedAt: new Date(),
          },
        });

        await logAuditTrail(
          req.user!.id,
          "PHASE_LOCKED_PENDING_APPROVAL",
          "phase_progress",
          phaseProgress.id,
          phaseProgress,
          updated,
          id,
          "Phase locked, pending EQCR approval",
          req.ip,
          req.get("user-agent")
        );

        invalidatePhaseCache(id);
        return res.json(updated);
      }

      if (req.user!.role === "EQCR" && phaseProgress.lockedById) {
        const updated = await prisma.phaseProgress.update({
          where: { id: phaseProgress.id },
          data: {
            status: "COMPLETED",
            approvedById: req.user!.id,
            approvedAt: new Date(),
            completedAt: new Date(),
          },
        });

        invalidatePhaseCache(id);

        const nextPhaseIndex = phaseIndex + 1;
        if (nextPhaseIndex < PHASE_ORDER.length) {
          await prisma.phaseProgress.updateMany({
            where: {
              engagementId: id,
              phase: PHASE_ORDER[nextPhaseIndex],
            },
            data: {
              status: "IN_PROGRESS",
              startedAt: new Date(),
            },
          });

          await prisma.engagement.update({
            where: { id },
            data: { currentPhase: PHASE_ORDER[nextPhaseIndex] },
          });
        }

        await logAuditTrail(
          req.user!.id,
          "PHASE_APPROVED_AND_COMPLETED",
          "phase_progress",
          phaseProgress.id,
          phaseProgress,
          updated,
          id,
          "Phase approved by EQCR and completed",
          req.ip,
          req.get("user-agent")
        );

        return res.json(updated);
      }

      return res.status(400).json({ error: "Dual authorization required: Partner must lock first, then EQCR must approve" });
    } catch (error) {
      console.error("Lock phase error:", error);
      res.status(500).json({ error: "Failed to lock phase" });
    }
  });

  app.get("/api/engagements/:id/checklist", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const phase = req.query.phase as string | undefined;

      const items = await prisma.checklistItem.findMany({
        where: {
          engagementId: req.params.id,
          ...(phase && { phase: phase as AuditPhase }),
        },
        include: {
          assignedTo: { select: { id: true, fullName: true } },
          completedBy: { select: { id: true, fullName: true } },
        },
        orderBy: [{ section: "asc" }, { orderIndex: "asc" }],
      });

      res.json(items);
    } catch (error) {
      console.error("Get checklist error:", error);
      res.status(500).json({ error: "Failed to fetch checklist" });
    }
  });

  app.patch("/api/checklist/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const existing = await prisma.checklistItem.findUnique({
        where: { id: req.params.id },
        include: { engagement: true },
      });

      if (!existing) {
        return res.status(404).json({ error: "Checklist item not found" });
      }

      if (existing.engagement.firmId !== req.user!.firmId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const updateSchema = z.object({
        status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "NOT_APPLICABLE"]).optional(),
        notes: z.string().optional(),
        assignedToId: z.string().uuid().optional(),
      });

      const data = updateSchema.parse(req.body);

      const updateData: any = { ...data };
      if (data.status === "COMPLETED") {
        updateData.completedById = req.user!.id;
        updateData.completedAt = new Date();
      }

      const item = await prisma.checklistItem.update({
        where: { id: req.params.id },
        data: updateData,
      });

      await logAuditTrail(
        req.user!.id,
        "CHECKLIST_ITEM_UPDATED",
        "checklist_item",
        item.id,
        existing,
        item,
        existing.engagementId,
        req.body.justification || "Checklist item updated",
        req.ip,
        req.get("user-agent")
      );

      res.json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Update checklist error:", error);
      res.status(500).json({ error: "Failed to update checklist item" });
    }
  });

  app.get("/api/engagements/:id/review-notes", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const phase = req.query.phase as string | undefined;

      const notes = await prisma.reviewNote.findMany({
        where: {
          engagementId: req.params.id,
          ...(phase && { phase: phase as AuditPhase }),
        },
        include: {
          author: { select: { id: true, fullName: true, role: true } },
          resolvedBy: { select: { id: true, fullName: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      res.json(notes);
    } catch (error) {
      console.error("Get review notes error:", error);
      res.status(500).json({ error: "Failed to fetch review notes" });
    }
  });

  app.post("/api/engagements/:id/review-notes", requireAuth, requireMinRole("SENIOR"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const engagement = await prisma.engagement.findUnique({
        where: { id: req.params.id },
      });

      if (!engagement || engagement.firmId !== req.user!.firmId) {
        return res.status(404).json({ error: "Engagement not found" });
      }

      const createSchema = z.object({
        phase: z.enum(PHASE_ORDER),
        content: z.string().min(1),
        severity: z.enum(["INFO", "LOW", "MEDIUM", "WARNING", "HIGH", "CRITICAL"]).default("INFO"),
        checklistItemId: z.string().uuid().optional(),
      });

      const data = createSchema.parse(req.body);

      const note = await prisma.reviewNote.create({
        data: {
          engagementId: req.params.id,
          authorId: req.user!.id,
          phase: data.phase,
          content: data.content,
          severity: data.severity,
          checklistItemId: data.checklistItemId,
        },
        include: {
          author: { select: { id: true, fullName: true, role: true } },
        },
      });

      await logAuditTrail(
        req.user!.id,
        "REVIEW_NOTE_CREATED",
        "review_note",
        note.id,
        null,
        note,
        req.params.id,
        "Review note created",
        req.ip,
        req.get("user-agent")
      );

      res.status(201).json(note);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Create review note error:", error);
      res.status(500).json({ error: "Failed to create review note" });
    }
  });

  app.patch("/api/review-notes/:id", requireAuth, requireMinRole("SENIOR"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const existing = await prisma.reviewNote.findUnique({
        where: { id: req.params.id },
        include: { engagement: true },
      });

      if (!existing) {
        return res.status(404).json({ error: "Review note not found" });
      }

      if (existing.engagement.firmId !== req.user!.firmId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Clearing notes requires at least MANAGER role
      if (req.body.status === "CLEARED" && !["MANAGER", "PARTNER", "FIRM_ADMIN"].includes(req.user!.role)) {
        return res.status(403).json({ error: "Only managers or above can clear review notes" });
      }

      const updateSchema = z.object({
        status: z.enum(["OPEN", "ADDRESSED", "CLEARED"]).optional(),
        resolution: z.string().optional(),
      });

      const data = updateSchema.parse(req.body);

      const updateData: any = { ...data };
      if (data.status === "CLEARED") {
        updateData.resolvedById = req.user!.id;
        updateData.resolvedAt = new Date();
      }

      const note = await prisma.reviewNote.update({
        where: { id: req.params.id },
        data: updateData,
      });

      await logAuditTrail(
        req.user!.id,
        "REVIEW_NOTE_UPDATED",
        "review_note",
        note.id,
        existing,
        note,
        existing.engagementId,
        req.body.justification || "Review note updated",
        req.ip,
        req.get("user-agent")
      );

      res.json(note);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Update review note error:", error);
      res.status(500).json({ error: "Failed to update review note" });
    }
  });

  app.get("/api/engagements/:id/audit-trail", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const trail = await prisma.auditTrail.findMany({
        where: { engagementId: req.params.id },
        include: {
          user: { select: { id: true, fullName: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });

      res.json(trail);
    } catch (error) {
      console.error("Get audit trail error:", error);
      res.status(500).json({ error: "Failed to fetch audit trail" });
    }
  });

  // GET /api/engagements/:id/control - Get consolidated engagement control data
  app.get("/api/engagements/:id/control", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const firmId = req.user!.firmId;

      const engagement = await prisma.engagement.findUnique({
        where: { id },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              tradingName: true,
              ntn: true,
              secpNo: true,
              address: true,
              email: true,
              phone: true,
              ceoName: true,
              cfoName: true,
            },
          },
          firm: true,
          phases: { orderBy: { phase: "asc" } },
          team: { include: { user: { select: { id: true, fullName: true, role: true } } } },
        },
      });

      if (!engagement) {
        return res.status(404).json({ error: "Engagement not found" });
      }

      if (engagement.firmId !== firmId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Get started by user if startedAt exists
      let startedBy: { id: string; fullName: string } | null = null;
      if (engagement.startedAt) {
        const startLog = await prisma.auditTrail.findFirst({
          where: { engagementId: id, action: "ENGAGEMENT_STARTED" },
          include: { user: { select: { id: true, fullName: true } } },
          orderBy: { createdAt: "asc" },
        });
        startedBy = startLog?.user || null;
      }

      // Get last activity
      const lastActivity = await prisma.auditTrail.findFirst({
        where: { engagementId: id },
        include: { user: { select: { id: true, fullName: true } } },
        orderBy: { createdAt: "desc" },
      });

      // Get user's progress for this engagement
      const userProgress = await prisma.engagementUserProgress.findUnique({
        where: { engagementId_userId: { engagementId: id, userId } },
      });

      res.json({
        ...engagement,
        startedBy,
        lastActivityAt: lastActivity?.createdAt || null,
        lastActivityBy: lastActivity?.user || null,
        lastRoute: userProgress?.lastRoute || engagement.lastRoute,
        canEdit: ["FIRM_ADMIN", "PARTNER", "MANAGER"].includes(req.user!.role),
      });
    } catch (error) {
      console.error("Get engagement control error:", error);
      res.status(500).json({ error: "Failed to fetch engagement control data" });
    }
  });

  // GET /api/engagements/:id/activity - Get recent activity log
  app.get("/api/engagements/:id/activity", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

      const engagement = await prisma.engagement.findUnique({
        where: { id },
      });

      if (!engagement) {
        return res.status(404).json({ error: "Engagement not found" });
      }

      if (engagement.firmId !== req.user!.firmId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const activity = await prisma.auditTrail.findMany({
        where: { engagementId: id },
        include: {
          user: { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      });

      const formattedActivity = activity.map((entry) => ({
        id: entry.id,
        action: entry.action.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
        entityType: entry.entityType,
        entityId: entry.entityId,
        details: entry.justification,
        performedAt: entry.createdAt,
        performedBy: entry.user,
      }));

      res.json(formattedActivity);
    } catch (error) {
      console.error("Get engagement activity error:", error);
      res.status(500).json({ error: "Failed to fetch engagement activity" });
    }
  });

  // ============== FIRM-SIDE INFORMATION REQUISITION ENDPOINTS ==============

  // GET /api/engagements/:id/requisitions - Get all requisitions for an engagement (firm-side)
  app.get("/api/engagements/:id/requisitions", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const firmId = req.user!.firmId;
      if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

      const engagement = await prisma.engagement.findFirst({
        where: { id, firmId },
      });

      if (!engagement) {
        return res.status(404).json({ error: "Engagement not found" });
      }

      const requests = await prisma.informationRequest.findMany({
        where: { engagementId: id },
        include: {
          attachments: {
            select: { id: true, fileName: true, fileSize: true, storagePath: true, uploadedAt: true }
          }
        },
        orderBy: { srNumber: "asc" },
      });

      // Map storagePath to fileUrl for frontend compatibility
      const mappedRequests = requests.map(r => ({
        ...r,
        attachments: r.attachments.map(a => ({
          ...a,
          fileUrl: a.storagePath,
        }))
      }));

      res.json(mappedRequests);
    } catch (error) {
      console.error("Get requisitions error:", error);
      res.status(500).json({ error: "Failed to fetch requisitions" });
    }
  });

  // POST /api/engagements/:id/requisitions - Create new requisition (firm-side)
  app.post("/api/engagements/:id/requisitions", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const firmId = req.user!.firmId;
      if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

      const engagement = await prisma.engagement.findFirst({
        where: { id, firmId },
        include: { client: { select: { id: true } } },
      });

      if (!engagement) {
        return res.status(404).json({ error: "Engagement not found" });
      }

      const schema = z.object({
        headOfAccounts: z.enum([
          'CORPORATE_DOCUMENTS', 'FINANCIAL_STATEMENTS', 'BANK_INFORMATION', 'FIXED_ASSETS',
          'INVENTORY', 'RECEIVABLES', 'PAYABLES', 'LOANS_BORROWINGS', 'EQUITY', 'REVENUE',
          'COST_OF_SALES', 'OPERATING_EXPENSES', 'TAXATION', 'PAYROLL', 'RELATED_PARTY',
          'LEGAL_MATTERS', 'INSURANCE', 'LEASES', 'INVESTMENTS', 'OTHER'
        ]),
        description: z.string().min(1),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().default('MEDIUM'),
      });

      const parsed = schema.parse(req.body);

      // Get next srNumber
      const lastRequest = await prisma.informationRequest.findFirst({
        where: { engagementId: id },
        orderBy: { srNumber: "desc" },
      });
      const nextSrNumber = (lastRequest?.srNumber || 0) + 1;

      // Generate request code
      const requestCode = `REQ-${engagement.engagementCode}-${String(nextSrNumber).padStart(3, '0')}`;

      const request = await prisma.informationRequest.create({
        data: {
          firmId,
          engagementId: id,
          clientId: engagement.clientId,
          srNumber: nextSrNumber,
          requestCode,
          requestTitle: parsed.description.slice(0, 50),
          headOfAccounts: parsed.headOfAccounts,
          description: parsed.description,
          priority: parsed.priority,
          status: 'PENDING',
          createdById: req.user!.id,
        },
      });

      await logAuditTrail(
        req.user!.id,
        'CREATE',
        'InformationRequest',
        request.id,
        id,
        { headOfAccounts: parsed.headOfAccounts, description: parsed.description },
        undefined
      );

      res.status(201).json(request);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error("Create requisition error:", error);
      res.status(500).json({ error: "Failed to create requisition" });
    }
  });

  // PATCH /api/requisitions/:id - Update requisition (firm-side)
  app.patch("/api/requisitions/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const firmId = req.user!.firmId;
      if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

      const existingRequest = await prisma.informationRequest.findFirst({
        where: { id, firmId },
      });

      if (!existingRequest) {
        return res.status(404).json({ error: "Requisition not found" });
      }

      const schema = z.object({
        headOfAccounts: z.enum([
          'CORPORATE_DOCUMENTS', 'FINANCIAL_STATEMENTS', 'BANK_INFORMATION', 'FIXED_ASSETS',
          'INVENTORY', 'RECEIVABLES', 'PAYABLES', 'LOANS_BORROWINGS', 'EQUITY', 'REVENUE',
          'COST_OF_SALES', 'OPERATING_EXPENSES', 'TAXATION', 'PAYROLL', 'RELATED_PARTY',
          'LEGAL_MATTERS', 'INSURANCE', 'LEASES', 'INVESTMENTS', 'OTHER'
        ]).optional(),
        description: z.string().optional(),
        provided: z.enum(['YES', 'NO']).optional(),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
      });

      const parsed = schema.parse(req.body);

      const updateData: any = {
        updatedById: req.user!.id,
      };

      if (parsed.headOfAccounts) updateData.headOfAccounts = parsed.headOfAccounts;
      if (parsed.description) {
        updateData.description = parsed.description;
        updateData.requestTitle = parsed.description.slice(0, 50);
      }
      if (parsed.priority) updateData.priority = parsed.priority;

      if (parsed.provided !== undefined) {
        updateData.provided = parsed.provided;
        if (parsed.provided === 'YES') {
          updateData.providedDate = new Date();
          if (existingRequest.status === 'PENDING') {
            updateData.status = 'COMPLETED';
          }
        } else {
          updateData.providedDate = null;
        }
      }

      const updated = await prisma.informationRequest.update({
        where: { id },
        data: updateData,
      });

      await logAuditTrail(
        req.user!.id,
        'UPDATE',
        'InformationRequest',
        id,
        existingRequest.engagementId,
        parsed,
        undefined
      );

      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error("Update requisition error:", error);
      res.status(500).json({ error: "Failed to update requisition" });
    }
  });

  // DELETE /api/requisitions/:id - Delete requisition (firm-side, requires MANAGER+)
  app.delete("/api/requisitions/:id", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const firmId = req.user!.firmId;
      if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });

      const existingRequest = await prisma.informationRequest.findFirst({
        where: { id, firmId },
      });

      if (!existingRequest) {
        return res.status(404).json({ error: "Requisition not found" });
      }

      await prisma.informationRequest.delete({
        where: { id },
      });

      await logAuditTrail(
        req.user!.id,
        'DELETE',
        'InformationRequest',
        id,
        existingRequest.engagementId,
        { requestCode: existingRequest.requestCode },
        undefined
      );

      res.json({ success: true });
    } catch (error) {
      console.error("Delete requisition error:", error);
      res.status(500).json({ error: "Failed to delete requisition" });
    }
  });

  // GET /api/engagements/:id/requisitions/export-word - Export requisitions as Word document
  app.get("/api/engagements/:id/requisitions/export-word", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const firmId = req.user!.firmId;
      const includeProvided = req.query.includeProvided === "true";
      
      if (!firmId) {
        return res.status(400).json({ error: "User not associated with a firm" });
      }

      const engagement = await prisma.engagement.findFirst({
        where: { id, firmId },
        include: { client: true },
      });

      if (!engagement) {
        return res.status(404).json({ error: "Engagement not found" });
      }

      const buffer = await generateInformationRequestLetter({
        engagementId: id,
        firmId,
        includeProvided,
      });

      const fileName = `Information_Request_Letter_${engagement.engagementCode || "engagement"}_${new Date().toISOString().split("T")[0]}.docx`;

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.send(buffer);
    } catch (error) {
      console.error("Export requisitions Word error:", error);
      res.status(500).json({ error: "Failed to export requisitions as Word document" });
    }
  });

  // GET /api/clients/:id/engagements - Get engagements for a client
  app.get("/api/clients/:id/engagements", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const firmId = req.user!.firmId;
      const client = await prisma.client.findUnique({ where: { id: req.params.id } });
      
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      if (client.firmId !== firmId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const engagements = await prisma.engagement.findMany({
        where: { clientId: req.params.id },
        include: {
          team: {
            include: { user: { select: { id: true, fullName: true, role: true } } },
          },
          phases: true,
        },
        orderBy: { fiscalYearEnd: "desc" },
      });

      res.json(engagements);
    } catch (error) {
      console.error("Get client engagements error:", error);
      res.status(500).json({ error: "Failed to fetch engagements" });
    }
  });

  // GET /api/clients/:id/documents - Get client documents
  app.get("/api/clients/:id/documents", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const firmId = req.user!.firmId;
      const client = await prisma.client.findUnique({ where: { id: req.params.id } });
      
      if (!client || client.firmId !== firmId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const documents = await prisma.kYCDocument.findMany({
        where: { clientId: req.params.id, deletedAt: null },
        include: { uploadedBy: { select: { id: true, fullName: true } } },
        orderBy: { uploadedAt: "desc" },
      });

      res.json(documents);
    } catch (error) {
      console.error("Get client documents error:", error);
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });

  // POST /api/clients/:id/documents - Upload client document
  app.post("/api/clients/:id/documents", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const firmId = req.user!.firmId;
      const client = await prisma.client.findUnique({ where: { id: req.params.id } });
      
      if (!client || client.firmId !== firmId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const docSchema = z.object({
        documentType: z.string().min(1),
        documentName: z.string().min(1),
        documentNumber: z.string().optional(),
        storagePath: z.string().optional(),
        originalFileName: z.string().optional(),
        mimeType: z.string().optional(),
        fileSize: z.number().optional(),
        notes: z.string().optional(),
      });

      const data = docSchema.parse(req.body);

      const doc = await prisma.kYCDocument.create({
        data: {
          clientId: req.params.id,
          documentType: data.documentType,
          documentName: data.documentName,
          documentNumber: data.documentNumber,
          storagePath: data.storagePath,
          originalFileName: data.originalFileName,
          mimeType: data.mimeType,
          fileSize: data.fileSize,
          uploadedById: req.user!.id,
        },
      });

      res.status(201).json(doc);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Create document error:", error);
      res.status(500).json({ error: "Failed to create document" });
    }
  });

  // PATCH /api/clients/:clientId/documents/:docId - Update document metadata
  app.patch("/api/clients/:clientId/documents/:docId", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const firmId = req.user!.firmId;
      const client = await prisma.client.findUnique({ where: { id: req.params.clientId } });
      
      if (!client || client.firmId !== firmId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const updateSchema = z.object({
        documentName: z.string().min(1).optional(),
        documentType: z.string().min(1).optional(),
        documentNumber: z.string().optional().nullable(),
      });

      const data = updateSchema.parse(req.body);

      const doc = await prisma.kYCDocument.update({
        where: { id: req.params.docId },
        data,
      });

      res.json(doc);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Update document error:", error);
      res.status(500).json({ error: "Failed to update document" });
    }
  });

  // DELETE /api/clients/:clientId/documents/:docId - Soft delete document
  app.delete("/api/clients/:clientId/documents/:docId", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const firmId = req.user!.firmId;
      const client = await prisma.client.findUnique({ where: { id: req.params.clientId } });
      
      if (!client || client.firmId !== firmId) {
        return res.status(403).json({ error: "Access denied" });
      }

      await prisma.kYCDocument.update({
        where: { id: req.params.docId },
        data: {
          deletedAt: new Date(),
          deletedById: req.user!.id,
        },
      });

      res.status(204).send();
    } catch (error) {
      console.error("Delete document error:", error);
      res.status(500).json({ error: "Failed to delete document" });
    }
  });

  app.get("/api/firm/users", requireAuth, requireRoles("FIRM_ADMIN", "PARTNER"), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const firmId = req.user!.firmId;
      if (!firmId) {
        return res.status(400).json({ error: "User not associated with a firm" });
      }

      const users = await prisma.user.findMany({
        where: { firmId },
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
        orderBy: { fullName: "asc" },
      });

      res.json(users);
    } catch (error) {
      console.error("Get firm users error:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.get("/api/guide-issues", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });
    try {
      const issues = await prisma.firmFeedback.findMany({
        where: { firmId },
        include: { createdBy: { select: { fullName: true, role: true } } },
        orderBy: { createdAt: "desc" },
      });
      res.json(issues);
    } catch (error) {
      console.error("Error fetching guide issues:", error);
      res.status(500).json({ error: "Failed to fetch issues" });
    }
  });

  app.post("/api/guide-issues", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });
    const feedbackSchema = z.object({
      moduleKey: z.string().min(1),
      title: z.string().min(1).max(200),
      description: z.string().min(1).max(2000),
      priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
    });
    const parsed = feedbackSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
    const { moduleKey, title, description, priority } = parsed.data;
    try {
      const issue = await prisma.firmFeedback.create({
        data: {
          firmId,
          moduleKey,
          title,
          description,
          priority,
          status: "open",
          createdById: req.user!.id,
        },
        include: { createdBy: { select: { fullName: true, role: true } } },
      });
      res.status(201).json(issue);
    } catch (error) {
      console.error("Error creating guide issue:", error);
      res.status(500).json({ error: "Failed to create issue" });
    }
  });

  app.patch("/api/guide-issues/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });
    const role = req.user!.role;
    if (!["PARTNER", "FIRM_ADMIN"].includes(role)) {
      return res.status(403).json({ message: "Only Admin/Partner can update issue status" });
    }
    const { status } = req.body;
    if (!status || !["open", "in_review", "acknowledged", "resolved", "fixed"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    try {
      const existing = await prisma.firmFeedback.findFirst({
        where: { id: req.params.id, firmId },
      });
      if (!existing) return res.status(404).json({ error: "Issue not found" });
      const updated = await prisma.firmFeedback.update({
        where: { id: req.params.id },
        data: { status },
        include: { createdBy: { select: { fullName: true, role: true } } },
      });
      res.json(updated);
    } catch (error) {
      console.error("Error updating guide issue:", error);
      res.status(500).json({ error: "Failed to update issue" });
    }
  });

  app.delete("/api/guide-issues/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: "User not associated with a firm" });
    const role = req.user!.role;
    if (!["PARTNER", "FIRM_ADMIN"].includes(role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    try {
      const existing = await prisma.firmFeedback.findFirst({
        where: { id: req.params.id, firmId },
      });
      if (!existing) return res.status(404).json({ error: "Issue not found" });
      await prisma.firmFeedback.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting guide issue:", error);
      res.status(500).json({ error: "Failed to delete issue" });
    }
  });

  app.get("/api/version", (req, res) => {
    res.json({
      version: process.env.npm_package_version || "1.0.0",
      commitHash: process.env.REPL_SLUG || "dev",
      buildDate: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    });
  });

  return httpServer;
}
