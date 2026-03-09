import { Router, Response } from "express";
import { requireAuth, AuthenticatedRequest, requireMinRole } from "./auth";
import { 
  runWorkflowHealthCheck, 
  scanForIssues,
  formatError,
  StandardError 
} from "./services/workflowHealthService";

const router = Router();

router.get("/workflow/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const report = await runWorkflowHealthCheck(engagementId);
    res.json(report);
  } catch (error) {
    console.error("Workflow health check error:", error);
    res.status(500).json(formatError(
      "HEALTH_CHECK_FAILED",
      "Failed to run workflow health check",
      { hint: "Check server logs for details" }
    ));
  }
});

router.get("/issues/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const issues = await scanForIssues(engagementId);
    
    const totalIssues = 
      issues.missingFields.length + 
      issues.duplicateFields.length + 
      issues.brokenLinkages.length +
      issues.orphanedData.length;

    res.json({
      engagementId,
      totalIssues,
      ...issues,
    });
  } catch (error) {
    console.error("Issue scan error:", error);
    res.status(500).json(formatError(
      "ISSUE_SCAN_FAILED",
      "Failed to scan for issues",
      { hint: "Check server logs for details" }
    ));
  }
});

router.get("/data-links", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const dataLinkMap = {
    version: "1.0",
    description: "AuditWise Data Flow Map - One Source of Truth",
    flows: [
      {
        id: "tb-to-mapping",
        source: "Trial Balance (TB)",
        target: "Mapping Session",
        endpoint: "/api/mapping/create-session",
        description: "TB entries flow to mapping for FS head assignment",
        prerequisites: ["TB batch must be validated"],
      },
      {
        id: "gl-to-mapping",
        source: "General Ledger (GL)",
        target: "Mapping Session",
        endpoint: "/api/mapping/link-gl",
        description: "GL entries linked for transaction-level analysis",
        prerequisites: ["GL batch must be validated", "Mapping session must exist"],
      },
      {
        id: "mapping-to-coa",
        source: "Mapping Session",
        target: "Chart of Accounts (CoA)",
        endpoint: "/api/push/coa",
        description: "Mapped accounts push to CoA template",
        prerequisites: ["Mapping must be at least 80% complete"],
      },
      {
        id: "mapping-to-planning",
        source: "Mapping Session",
        target: "Planning Module",
        endpoint: "/api/field-orchestration/push",
        description: "Financial data populates planning fields",
        prerequisites: ["Mapping approved", "Field instances initialized"],
        targets: ["PLANNING"],
      },
      {
        id: "tb-to-materiality",
        source: "Trial Balance",
        target: "Materiality Tab",
        endpoint: "/api/push/materiality",
        description: "TB totals populate materiality benchmarks",
        prerequisites: ["TB batch validated"],
      },
      {
        id: "tb-to-analytical",
        source: "Trial Balance",
        target: "Analytical Tab",
        endpoint: "/api/push/analytical",
        description: "TB balances calculate ratios and trends",
        prerequisites: ["TB batch validated"],
      },
      {
        id: "mapping-to-risk",
        source: "Mapping Session",
        target: "Risk Assessment Tab",
        endpoint: "/api/push/risk",
        description: "Significant accounts and risk candidates flow to risk",
        prerequisites: ["Mapping complete"],
      },
      {
        id: "gl-to-sampling",
        source: "General Ledger",
        target: "Sampling Tab",
        endpoint: "/api/push/sampling",
        description: "GL populations create sampling frames",
        prerequisites: ["GL batch validated"],
      },
      {
        id: "planning-to-program",
        source: "Planning Module",
        target: "Audit Program",
        endpoint: "/api/push/audit-program",
        description: "Risk assessment drives procedure selection",
        prerequisites: ["Risk assessment complete", "Materiality set"],
      },
      {
        id: "mapping-to-fsheads",
        source: "Mapping Session",
        target: "FS Head Working Papers",
        endpoint: "/api/push/fs-heads",
        description: "Creates working papers per FS head with balances",
        prerequisites: ["Mapping approved"],
      },
      {
        id: "fsheads-to-evidence",
        source: "FS Head Working Papers",
        target: "Evidence Vault",
        endpoint: "/api/evidence/link",
        description: "Evidence linked to FS head procedures",
        prerequisites: ["FS Head working paper created"],
      },
      {
        id: "adjustments-to-fs",
        source: "FS Head Adjustments",
        target: "Adjusted Financial Statements",
        endpoint: "/api/push/adjusted-fs",
        description: "Posted adjustments flow to final FS",
        prerequisites: ["Adjustments approved and posted"],
      },
      {
        id: "fs-to-deliverables",
        source: "Adjusted FS",
        target: "Deliverables",
        endpoint: "/api/deliverables/generate",
        description: "Final FS generates deliverable packages",
        prerequisites: ["All adjustments posted", "Partner approval"],
      },
      {
        id: "engagement-to-qcr",
        source: "Full Engagement",
        target: "Quality Control Review",
        endpoint: "/api/qcr/generate",
        description: "Engagement data populates QCR checklist",
        prerequisites: ["Finalization complete"],
      },
      {
        id: "qcr-to-inspection",
        source: "QCR Checklist",
        target: "Inspection Readiness",
        endpoint: "/api/inspection/prepare",
        description: "QCR results feed inspection preparation",
        prerequisites: ["QCR completed"],
      },
    ],
    statusFlow: [
      "NOT_STARTED",
      "READY",
      "IN_PROGRESS", 
      "NEEDS_REVIEW",
      "REVIEWED",
      "APPROVED",
      "LOCKED",
      "COMPLETED",
    ],
  };

  res.json(dataLinkMap);
});

router.post("/run-all/:engagementId", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    
    const healthReport = await runWorkflowHealthCheck(engagementId);
    const issueReport = await scanForIssues(engagementId);

    const summary = {
      timestamp: new Date().toISOString(),
      engagementId,
      healthStatus: healthReport.overallStatus,
      checksPassed: healthReport.summary.passed,
      checksFailed: healthReport.summary.failed,
      checksWarning: healthReport.summary.warnings,
      totalIssues: 
        issueReport.missingFields.length + 
        issueReport.duplicateFields.length + 
        issueReport.brokenLinkages.length,
      recommendations: generateRecommendations(healthReport, issueReport),
    };

    res.json({
      summary,
      healthReport,
      issueReport,
    });
  } catch (error) {
    console.error("Full health check error:", error);
    res.status(500).json(formatError(
      "FULL_CHECK_FAILED",
      "Failed to run complete health check",
      { hint: "Check server logs for details" }
    ));
  }
});

function generateRecommendations(
  healthReport: Awaited<ReturnType<typeof runWorkflowHealthCheck>>,
  issueReport: Awaited<ReturnType<typeof scanForIssues>>
): string[] {
  const recommendations: string[] = [];

  const failedChecks = healthReport.checks.filter(c => c.status === "FAIL");
  const skippedChecks = healthReport.checks.filter(c => c.status === "SKIP");

  if (skippedChecks.some(c => c.step === "Upload TB")) {
    recommendations.push("Upload a Trial Balance to begin the audit workflow");
  }

  if (skippedChecks.some(c => c.step === "Mapping")) {
    recommendations.push("Create a mapping session to link TB accounts to FS heads");
  }

  if (failedChecks.some(c => c.step === "Mapping")) {
    recommendations.push("Complete mapping to at least 80% before proceeding to planning");
  }

  if (issueReport.missingFields.length > 0) {
    recommendations.push(`Initialize ${issueReport.missingFields.length} missing required fields`);
  }

  if (issueReport.brokenLinkages.length > 0) {
    recommendations.push("Fix broken data linkages to ensure data integrity");
  }

  if (recommendations.length === 0) {
    recommendations.push("Workflow is healthy - no immediate actions required");
  }

  return recommendations;
}

export default router;
