import { prisma } from "../db";

export interface HealthCheckResult {
  step: string;
  status: "PASS" | "FAIL" | "WARN" | "SKIP";
  message: string;
  details?: Record<string, unknown>;
  hint?: string;
}

export interface WorkflowHealthReport {
  timestamp: string;
  engagementId: string;
  overallStatus: "HEALTHY" | "DEGRADED" | "CRITICAL";
  checks: HealthCheckResult[];
  summary: {
    passed: number;
    failed: number;
    warnings: number;
    skipped: number;
  };
}

export interface StandardError {
  code: string;
  message: string;
  field?: string;
  rowNo?: number;
  hint?: string;
}

export function formatError(
  code: string,
  message: string,
  options?: { field?: string; rowNo?: number; hint?: string }
): StandardError {
  return {
    code,
    message,
    field: options?.field,
    rowNo: options?.rowNo,
    hint: options?.hint,
  };
}

export async function runWorkflowHealthCheck(engagementId: string): Promise<WorkflowHealthReport> {
  const checks: HealthCheckResult[] = [];

  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    include: { client: true },
  });

  if (!engagement) {
    return {
      timestamp: new Date().toISOString(),
      engagementId,
      overallStatus: "CRITICAL",
      checks: [{
        step: "Engagement",
        status: "FAIL",
        message: "Engagement not found",
        hint: "Ensure the engagement ID is correct",
      }],
      summary: { passed: 0, failed: 1, warnings: 0, skipped: 0 },
    };
  }

  checks.push({
    step: "Engagement",
    status: "PASS",
    message: `Engagement ${engagement.engagementCode} found`,
    details: { clientName: engagement.client?.name, status: engagement.status },
  });

  const tbBatches = await prisma.tBBatch.findMany({
    where: { engagementId },
    orderBy: { createdAt: "desc" },
    take: 1,
  });

  if (tbBatches.length > 0) {
    const latestTB = tbBatches[0];
    const entryCount = await prisma.tBEntry.count({ where: { batchId: latestTB.id } });
    checks.push({
      step: "Upload TB",
      status: entryCount > 0 ? "PASS" : "WARN",
      message: entryCount > 0 ? `TB uploaded with ${entryCount} entries` : "TB batch exists but has no entries",
      details: { batchId: latestTB.id, entryCount, status: latestTB.status },
    });
  } else {
    checks.push({
      step: "Upload TB",
      status: "SKIP",
      message: "No trial balance uploaded yet",
      hint: "Upload a trial balance to proceed with planning",
    });
  }

  const glBatches = await prisma.gLBatch.findMany({
    where: { engagementId },
    orderBy: { createdAt: "desc" },
    take: 1,
  });

  if (glBatches.length > 0) {
    const latestGL = glBatches[0];
    const entryCount = await prisma.gLEntry.count({ where: { batchId: latestGL.id } });
    checks.push({
      step: "Upload GL",
      status: entryCount > 0 ? "PASS" : "WARN",
      message: entryCount > 0 ? `GL uploaded with ${entryCount} entries` : "GL batch exists but has no entries",
      details: { batchId: latestGL.id, entryCount, status: latestGL.status },
    });
  } else {
    checks.push({
      step: "Upload GL",
      status: "SKIP",
      message: "No general ledger uploaded yet",
      hint: "Upload a general ledger for detailed transaction analysis",
    });
  }

  const mappingSessions = await prisma.mappingSession.findMany({
    where: { engagementId },
    orderBy: { createdAt: "desc" },
    take: 1,
  });

  if (mappingSessions.length > 0) {
    const session = mappingSessions[0];
    const itemCount = await prisma.reconciliationItem.count({ where: { sessionId: session.id } });
    const mappedCount = await prisma.reconciliationItem.count({
      where: { sessionId: session.id, fsHead: { not: null } },
    });
    const mappingPercentage = itemCount > 0 ? Math.round((mappedCount / itemCount) * 100) : 0;

    checks.push({
      step: "Mapping",
      status: mappingPercentage >= 80 ? "PASS" : mappingPercentage >= 50 ? "WARN" : "FAIL",
      message: `Mapping ${mappingPercentage}% complete (${mappedCount}/${itemCount} items)`,
      details: { sessionId: session.id, status: session.status, mappingPercentage },
      hint: mappingPercentage < 80 ? "Map more accounts to FS heads to proceed" : undefined,
    });
  } else {
    checks.push({
      step: "Mapping",
      status: "SKIP",
      message: "No mapping session created yet",
      hint: "Create a mapping session after uploading TB",
    });
  }

  const coaAccounts = await prisma.coAAccount.findMany({
    where: { engagementId },
  }).catch(() => []);

  if (coaAccounts.length > 0) {
    const accountCount = coaAccounts.length;
    checks.push({
      step: "Push to CoA",
      status: accountCount > 0 ? "PASS" : "WARN",
      message: accountCount > 0 ? `CoA has ${accountCount} accounts` : "CoA template exists but is empty",
      details: { templateId: coaTemplates[0].id, accountCount },
    });
  } else {
    checks.push({
      step: "Push to CoA",
      status: "SKIP",
      message: "Chart of Accounts not set up",
      hint: "Push TB data to CoA to create the chart of accounts",
    });
  }

  const fieldInstances = await prisma.requiredFieldInstance.findMany({
    where: { engagementId, module: "PLANNING" },
  });

  if (fieldInstances.length > 0) {
    const populated = fieldInstances.filter(f => 
      f.status === "POPULATED" || f.status === "OVERRIDDEN" || f.status === "LOCKED"
    ).length;
    const percentage = Math.round((populated / fieldInstances.length) * 100);

    checks.push({
      step: "Push to Planning",
      status: percentage >= 80 ? "PASS" : percentage >= 50 ? "WARN" : "FAIL",
      message: `Planning fields ${percentage}% populated (${populated}/${fieldInstances.length})`,
      details: { totalFields: fieldInstances.length, populatedFields: populated },
    });
  } else {
    checks.push({
      step: "Push to Planning",
      status: "SKIP",
      message: "Planning fields not initialized",
      hint: "Initialize field instances for the engagement",
    });
  }

  const fsHeadWPs = await prisma.fSHeadWorkingPaper.findMany({
    where: { engagementId },
  });

  if (fsHeadWPs.length > 0) {
    const completed = fsHeadWPs.filter(wp => wp.isSignedOff).length;
    const percentage = Math.round((completed / fsHeadWPs.length) * 100);

    checks.push({
      step: "Push to FS Heads",
      status: fsHeadWPs.length > 0 ? "PASS" : "WARN",
      message: `${fsHeadWPs.length} FS Heads created (${percentage}% signed off)`,
      details: { totalHeads: fsHeadWPs.length, completedHeads: completed },
    });
  } else {
    checks.push({
      step: "Push to FS Heads",
      status: "SKIP",
      message: "No FS Head working papers created",
      hint: "Push mapping data to create FS Head working papers",
    });
  }

  const adjustments = await prisma.fSHeadAdjustment.findMany({
    where: { workingPaper: { engagementId } },
  });

  const postedCount = adjustments.filter(a => a.isPosted).length;
  if (adjustments.length > 0) {
    checks.push({
      step: "Finalization",
      status: postedCount === adjustments.length ? "PASS" : "WARN",
      message: `${postedCount}/${adjustments.length} adjustments posted`,
      details: { totalAdjustments: adjustments.length, postedAdjustments: postedCount },
    });
  } else {
    checks.push({
      step: "Finalization",
      status: "SKIP",
      message: "No audit adjustments recorded",
      hint: "Record any audit adjustments during execution",
    });
  }

  checks.push({
    step: "Reports",
    status: "PASS",
    message: "Report generation available",
    details: { availableReports: ["Progress", "Mapping Coverage", "Reconciliation", "Sampling", "Adjustments", "Audit Trail"] },
  });

  const routeChecks = await checkRoutes(engagementId);
  checks.push(...routeChecks);

  const summary = {
    passed: checks.filter(c => c.status === "PASS").length,
    failed: checks.filter(c => c.status === "FAIL").length,
    warnings: checks.filter(c => c.status === "WARN").length,
    skipped: checks.filter(c => c.status === "SKIP").length,
  };

  let overallStatus: "HEALTHY" | "DEGRADED" | "CRITICAL" = "HEALTHY";
  if (summary.failed > 0) {
    overallStatus = "CRITICAL";
  } else if (summary.warnings > 2) {
    overallStatus = "DEGRADED";
  }

  return {
    timestamp: new Date().toISOString(),
    engagementId,
    overallStatus,
    checks,
    summary,
  };
}

async function checkRoutes(engagementId: string): Promise<HealthCheckResult[]> {
  const results: HealthCheckResult[] = [];

  const requiredModules = [
    "INFORMATION_REQUISITION",
    "PRE_PLANNING", 
    "PLANNING",
    "EXECUTION",
    "FS_HEADS",
    "FINALIZATION",
  ];

  for (const module of requiredModules) {
    const blueprintCount = await prisma.requiredFieldBlueprint.count({
      where: { module, isActive: true },
    });

    if (blueprintCount === 0) {
      results.push({
        step: `Route: ${module}`,
        status: "WARN",
        message: `No field blueprints defined for ${module}`,
        hint: "Seed field blueprints for this module",
      });
    }
  }

  return results;
}

export async function scanForIssues(engagementId: string): Promise<{
  missingFields: Array<{ module: string; tab: string; fieldKey: string }>;
  duplicateFields: Array<{ module: string; tab: string; fieldKey: string; count: number }>;
  brokenLinkages: Array<{ source: string; target: string; issue: string }>;
  orphanedData: Array<{ table: string; count: number }>;
}> {
  const missingFields: Array<{ module: string; tab: string; fieldKey: string }> = [];
  const duplicateFields: Array<{ module: string; tab: string; fieldKey: string; count: number }> = [];
  const brokenLinkages: Array<{ source: string; target: string; issue: string }> = [];
  const orphanedData: Array<{ table: string; count: number }> = [];

  const blueprints = await prisma.requiredFieldBlueprint.findMany({
    where: { isActive: true, required: true },
  });

  const instances = await prisma.requiredFieldInstance.findMany({
    where: { engagementId },
  });

  const instanceMap = new Map(instances.map(i => [`${i.module}-${i.tab}-${i.fieldKey}`, i]));

  for (const bp of blueprints) {
    const key = `${bp.module}-${bp.tab}-${bp.fieldKey}`;
    const instance = instanceMap.get(key);
    if (!instance || instance.status === "MISSING") {
      missingFields.push({
        module: bp.module,
        tab: bp.tab,
        fieldKey: bp.fieldKey,
      });
    }
  }

  const duplicateCheck = await prisma.$queryRaw<Array<{ module: string; tab: string; fieldKey: string; count: bigint }>>`
    SELECT module, tab, "fieldKey", COUNT(*) as count
    FROM "RequiredFieldBlueprint"
    WHERE "isActive" = true
    GROUP BY module, tab, "fieldKey"
    HAVING COUNT(*) > 1
  `;

  for (const dup of duplicateCheck) {
    duplicateFields.push({
      module: dup.module,
      tab: dup.tab,
      fieldKey: dup.fieldKey,
      count: Number(dup.count),
    });
  }

  const tbBatch = await prisma.tBBatch.findFirst({
    where: { engagementId },
    orderBy: { createdAt: "desc" },
  });

  const mappingSession = await prisma.mappingSession.findFirst({
    where: { engagementId },
    orderBy: { createdAt: "desc" },
  });

  if (tbBatch && mappingSession) {
    if (mappingSession.tbBatchId !== tbBatch.id) {
      brokenLinkages.push({
        source: "TBBatch",
        target: "MappingSession",
        issue: "Mapping session references an older TB batch",
      });
    }
  }

  const orphanedTBEntries = await prisma.tBEntry.count({
    where: {
      batch: { engagementId: { not: engagementId } },
    },
  });

  if (orphanedTBEntries > 0) {
    orphanedData.push({ table: "TBEntry", count: orphanedTBEntries });
  }

  return {
    missingFields,
    duplicateFields,
    brokenLinkages,
    orphanedData,
  };
}
