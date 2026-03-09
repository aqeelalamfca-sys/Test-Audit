import { prisma } from "../db";
import { Decimal } from "@prisma/client/runtime/library";

function toNumber(val: Decimal | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number") return val;
  return Number(val);
}

export interface ReportExportMetadata {
  reportType: string;
  generatedAt: Date;
  generatedBy: string;
  engagementId: string;
  engagementCode: string | null;
  clientName: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  exportFormats: ("PDF" | "EXCEL" | "CSV")[];
}

export interface EngagementProgressReport {
  exportMetadata: ReportExportMetadata;
  summary: {
    overallCompletionPercentage: number;
    completedPhases: number;
    totalPhases: number;
    currentPhase: string;
    status: string;
  };
  phases: {
    phase: string;
    status: string;
    completionPercentage: number;
    startedAt: Date | null;
    completedAt: Date | null;
    lockedAt: Date | null;
    isLocked: boolean;
  }[];
  modules: {
    module: string;
    completedItems: number;
    totalItems: number;
    completionPercentage: number;
  }[];
}

export interface MappingCoverageReport {
  exportMetadata: ReportExportMetadata;
  summary: {
    totalAccounts: number;
    mappedAccounts: number;
    unmappedAccounts: number;
    mappingCoverageByCount: number;
    mappingCoverageByValue: number;
    totalValueMapped: number;
    totalValueUnmapped: number;
  };
  mappedList: {
    accountCode: string;
    accountName: string;
    fsLineItem: string | null;
    closingBalance: number;
  }[];
  unmappedList: {
    accountCode: string;
    accountName: string;
    closingBalance: number;
    suggestedFSLine: string | null;
  }[];
}

export interface TBGLReconciliationReport {
  exportMetadata: ReportExportMetadata;
  summary: {
    totalItems: number;
    matchedCount: number;
    differenceCount: number;
    missingInGL: number;
    missingInTB: number;
    isReconciled: boolean;
    reconciledDifference: number;
    tbTotal: number;
    glTotal: number;
  };
  differences: {
    accountCode: string;
    accountName: string;
    tbAmount: number;
    glAmount: number;
    difference: number;
    resolutionStatus: string;
    resolutionNote: string | null;
    resolvedBy: string | null;
    resolvedAt: Date | null;
  }[];
  resolutionSummary: {
    resolved: number;
    pending: number;
    excluded: number;
  };
}

export interface SamplingReport {
  exportMetadata: ReportExportMetadata;
  summary: {
    totalSamplingRuns: number;
    totalPopulation: number;
    totalSampleSize: number;
    overallCoveragePercentage: number;
    coverageByValue: number;
  };
  runs: {
    runId: string;
    method: string;
    createdAt: Date;
    populationSize: number;
    sampleSize: number;
    coveragePercentage: number;
    confidenceLevel: number | null;
    materialityThreshold: number | null;
    criteria: Record<string, any>;
    createdBy: string;
  }[];
  samplesByArea: {
    area: string;
    populationCount: number;
    sampleCount: number;
    coverage: number;
  }[];
}

export interface AdjustmentsSummaryReport {
  exportMetadata: ReportExportMetadata;
  summary: {
    totalAdjustments: number;
    postedAdjustments: number;
    unpostedAdjustments: number;
    totalPostedAmount: number;
    totalUnpostedAmount: number;
    performanceMateriality: number;
    percentOfPM: number;
    fsImpact: "MATERIAL" | "NOT_MATERIAL";
    isaReference: string;
  };
  adjustments: {
    id: string;
    reference: string;
    description: string;
    debitAmount: number;
    creditAmount: number;
    netAmount: number;
    status: string;
    isPosted: boolean;
    fsCaption: string | null;
    createdAt: Date;
    createdBy: string;
    approvedAt: Date | null;
    approvedBy: string | null;
  }[];
  byFSCaption: {
    fsCaption: string;
    postedAmount: number;
    unpostedAmount: number;
    adjustmentCount: number;
  }[];
  isa450Compliance: {
    aggregatedUncorrected: number;
    clearlyClearlyTrivial: number;
    materialityThreshold: number;
    requiresModification: boolean;
    managementRepresentationRequired: boolean;
  };
}

export interface AuditTrailReport {
  exportMetadata: ReportExportMetadata;
  summary: {
    totalEvents: number;
    uniqueUsers: number;
    dateRange: {
      from: Date | null;
      to: Date | null;
    };
    eventsByType: Record<string, number>;
  };
  events: {
    id: string;
    timestamp: Date;
    userId: string;
    userName: string;
    userRole: string;
    action: string;
    entityType: string;
    entityId: string | null;
    module: string | null;
    beforeValue: any;
    afterValue: any;
    ipAddress: string | null;
    justification: string | null;
  }[];
  byUser: {
    userId: string;
    userName: string;
    eventCount: number;
    lastActivity: Date;
  }[];
  byModule: {
    module: string;
    eventCount: number;
  }[];
}

interface DateRangeFilter {
  from?: Date;
  to?: Date;
}

class ReportingService {
  private async getExportMetadata(
    engagementId: string,
    userId: string,
    reportType: string
  ): Promise<ReportExportMetadata> {
    const [engagement, user] = await Promise.all([
      prisma.engagement.findUnique({
        where: { id: engagementId },
        include: { client: { select: { name: true } } },
      }),
      prisma.user.findUnique({ where: { id: userId } }),
    ]);

    return {
      reportType,
      generatedAt: new Date(),
      generatedBy: user?.fullName || "System",
      engagementId,
      engagementCode: engagement?.engagementCode || null,
      clientName: engagement?.client?.name || null,
      periodStart: engagement?.periodStart || null,
      periodEnd: engagement?.periodEnd || null,
      exportFormats: ["PDF", "EXCEL", "CSV"],
    };
  }

  async generateEngagementProgressReport(
    engagementId: string,
    userId: string
  ): Promise<EngagementProgressReport> {
    const exportMetadata = await this.getExportMetadata(
      engagementId,
      userId,
      "Engagement Progress Report"
    );

    const [engagement, phaseProgress, checklists, riskAssessments, substantiveTests, evidenceFiles] =
      await Promise.all([
        prisma.engagement.findUnique({
          where: { id: engagementId },
          select: { currentPhase: true, status: true },
        }),
        prisma.phaseProgress.findMany({
          where: { engagementId },
          orderBy: { createdAt: "asc" },
        }),
        prisma.checklistItem.findMany({
          where: { engagementId },
          select: { id: true, phase: true, status: true },
        }),
        prisma.riskAssessment.count({ where: { engagementId } }),
        prisma.substantiveTest.findMany({
          where: { engagementId },
          select: { id: true, conclusion: true, riskId: true },
        }),
        prisma.evidenceFile.count({ where: { engagementId } }),
      ]);

    const phases = phaseProgress.map((p) => ({
      phase: p.phase,
      status: p.status,
      completionPercentage: p.completionPercentage,
      startedAt: p.startedAt,
      completedAt: p.completedAt,
      lockedAt: p.lockedAt,
      isLocked: !!p.lockedAt,
    }));

    const totalCompletion =
      phaseProgress.length > 0
        ? Math.round(
            phaseProgress.reduce((sum, p) => sum + p.completionPercentage, 0) /
              phaseProgress.length
          )
        : 0;

    const completedPhases = phaseProgress.filter(
      (p) => p.status === "COMPLETED" || p.status === "LOCKED"
    ).length;

    const checklistsByPhase: Record<string, { total: number; completed: number }> = {};
    checklists.forEach((c) => {
      if (!checklistsByPhase[c.phase]) {
        checklistsByPhase[c.phase] = { total: 0, completed: 0 };
      }
      checklistsByPhase[c.phase].total++;
      if (c.status === "COMPLETED") {
        checklistsByPhase[c.phase].completed++;
      }
    });

    const testsWithConclusion = substantiveTests.filter(
      (t) => t.conclusion && t.conclusion.length > 0
    );
    const testsLinkedToRisks = substantiveTests.filter((t) => t.riskId);

    const modules = [
      {
        module: "Risk Assessment",
        completedItems: riskAssessments,
        totalItems: Math.max(riskAssessments, 1),
        completionPercentage: riskAssessments > 0 ? 100 : 0,
      },
      {
        module: "Substantive Testing",
        completedItems: testsWithConclusion.length,
        totalItems: substantiveTests.length,
        completionPercentage:
          substantiveTests.length > 0
            ? Math.round((testsWithConclusion.length / substantiveTests.length) * 100)
            : 0,
      },
      {
        module: "Risk-Test Linkage",
        completedItems: testsLinkedToRisks.length,
        totalItems: riskAssessments,
        completionPercentage:
          riskAssessments > 0
            ? Math.round((testsLinkedToRisks.length / riskAssessments) * 100)
            : 0,
      },
      {
        module: "Evidence Collection",
        completedItems: evidenceFiles,
        totalItems: Math.max(evidenceFiles, substantiveTests.length),
        completionPercentage:
          substantiveTests.length > 0
            ? Math.min(100, Math.round((evidenceFiles / substantiveTests.length) * 100))
            : 0,
      },
      ...Object.entries(checklistsByPhase).map(([phase, data]) => ({
        module: `${phase} Checklist`,
        completedItems: data.completed,
        totalItems: data.total,
        completionPercentage:
          data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
      })),
    ];

    return {
      exportMetadata,
      summary: {
        overallCompletionPercentage: totalCompletion,
        completedPhases,
        totalPhases: phaseProgress.length,
        currentPhase: engagement?.currentPhase || "ONBOARDING",
        status: engagement?.status || "DRAFT",
      },
      phases,
      modules,
    };
  }

  async generateMappingCoverageReport(
    engagementId: string,
    userId: string
  ): Promise<MappingCoverageReport> {
    const exportMetadata = await this.getExportMetadata(
      engagementId,
      userId,
      "Mapping Coverage Report"
    );

    const [coaAccounts, tbBatch] = await Promise.all([
      prisma.coAAccount.findMany({
        where: { engagementId },
        orderBy: { accountCode: "asc" },
      }),
      prisma.tBBatch.findFirst({
        where: { engagementId, status: { in: ["APPROVED", "REVIEWED"] } },
        include: { entries: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const tbEntries = tbBatch?.entries || [];
    const tbByCode = new Map<string, { accountName: string; closingBalance: number }>();

    for (const entry of tbEntries) {
      const existing = tbByCode.get(entry.accountCode) || {
        accountName: entry.accountName,
        closingBalance: 0,
      };
      tbByCode.set(entry.accountCode, {
        accountName: entry.accountName,
        closingBalance: existing.closingBalance + toNumber(entry.closingDebit) - toNumber(entry.closingCredit),
      });
    }

    const mappedList: MappingCoverageReport["mappedList"] = [];
    const unmappedList: MappingCoverageReport["unmappedList"] = [];
    let totalValueMapped = 0;
    let totalValueUnmapped = 0;

    for (const account of coaAccounts) {
      const tbData = tbByCode.get(account.accountCode);
      const closingBalance = tbData?.closingBalance || 0;
      const absBalance = Math.abs(closingBalance);

      if (account.fsLineItem) {
        mappedList.push({
          accountCode: account.accountCode,
          accountName: account.accountName,
          fsLineItem: account.fsLineItem,
          closingBalance,
        });
        totalValueMapped += absBalance;
      } else {
        unmappedList.push({
          accountCode: account.accountCode,
          accountName: account.accountName,
          closingBalance,
          suggestedFSLine: account.aiSuggestedFSLine || null,
        });
        totalValueUnmapped += absBalance;
      }
    }

    for (const [code, data] of tbByCode) {
      const hasCoA = coaAccounts.some((a) => a.accountCode === code);
      if (!hasCoA) {
        unmappedList.push({
          accountCode: code,
          accountName: data.accountName,
          closingBalance: data.closingBalance,
          suggestedFSLine: null,
        });
        totalValueUnmapped += Math.abs(data.closingBalance);
      }
    }

    const totalAccounts = mappedList.length + unmappedList.length;
    const totalValue = totalValueMapped + totalValueUnmapped;

    return {
      exportMetadata,
      summary: {
        totalAccounts,
        mappedAccounts: mappedList.length,
        unmappedAccounts: unmappedList.length,
        mappingCoverageByCount: totalAccounts > 0 ? Math.round((mappedList.length / totalAccounts) * 100) : 0,
        mappingCoverageByValue: totalValue > 0 ? Math.round((totalValueMapped / totalValue) * 100) : 0,
        totalValueMapped,
        totalValueUnmapped,
      },
      mappedList,
      unmappedList: unmappedList.sort((a, b) => Math.abs(b.closingBalance) - Math.abs(a.closingBalance)),
    };
  }

  async generateTBGLReconciliationReport(
    engagementId: string,
    userId: string
  ): Promise<TBGLReconciliationReport> {
    const exportMetadata = await this.getExportMetadata(
      engagementId,
      userId,
      "TB/GL Reconciliation Report"
    );

    const session = await prisma.mappingSession.findFirst({
      where: { engagementId },
      include: {
        reconciliationItems: {
          include: {
            manualMatchedBy: { select: { fullName: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!session) {
      return {
        exportMetadata,
        summary: {
          totalItems: 0,
          matchedCount: 0,
          differenceCount: 0,
          missingInGL: 0,
          missingInTB: 0,
          isReconciled: false,
          reconciledDifference: 0,
          tbTotal: 0,
          glTotal: 0,
        },
        differences: [],
        resolutionSummary: { resolved: 0, pending: 0, excluded: 0 },
      };
    }

    const items = session.reconciliationItems;
    const differences = items
      .filter((i) => i.matchStatus === "DIFFERENCE" || i.matchStatus === "MISSING_IN_GL" || i.matchStatus === "MISSING_IN_TB")
      .map((i) => ({
        accountCode: i.accountCode,
        accountName: i.accountName,
        tbAmount: toNumber(i.tbClosingDebit) - toNumber(i.tbClosingCredit),
        glAmount: toNumber(i.glTotalDebit) - toNumber(i.glTotalCredit),
        difference: toNumber(i.differenceDebit) - toNumber(i.differenceCredit),
        resolutionStatus: i.isManualMatch ? "RESOLVED" : i.matchStatus === "EXCLUDED" ? "EXCLUDED" : "PENDING",
        resolutionNote: i.manualMatchNote,
        resolvedBy: i.manualMatchedBy?.fullName || null,
        resolvedAt: i.manualMatchedAt,
      }));

    const resolved = items.filter((i) => i.isManualMatch).length;
    const excluded = items.filter((i) => i.matchStatus === "EXCLUDED").length;
    const pending = differences.length - resolved - excluded;

    return {
      exportMetadata,
      summary: {
        totalItems: items.length,
        matchedCount: session.matchedCount || 0,
        differenceCount: session.differenceCount || 0,
        missingInGL: session.missingInGLCount || 0,
        missingInTB: session.missingInTBCount || 0,
        isReconciled: session.isReconciled || false,
        reconciledDifference: toNumber(session.reconciledDifference),
        tbTotal: toNumber(session.tbTotalClosingDebit) - toNumber(session.tbTotalClosingCredit),
        glTotal: toNumber(session.glTotalDebit) - toNumber(session.glTotalCredit),
      },
      differences,
      resolutionSummary: { resolved, pending, excluded },
    };
  }

  async generateSamplingReport(
    engagementId: string,
    userId: string,
    dateRange?: DateRangeFilter
  ): Promise<SamplingReport> {
    const exportMetadata = await this.getExportMetadata(engagementId, userId, "Sampling Report");

    const whereClause: any = { engagementId };
    if (dateRange?.from) whereClause.createdAt = { ...whereClause.createdAt, gte: dateRange.from };
    if (dateRange?.to) whereClause.createdAt = { ...whereClause.createdAt, lte: dateRange.to };

    const samplingRuns = await prisma.samplingRun.findMany({
      where: whereClause,
      include: {
        createdBy: { select: { fullName: true } },
        _count: { select: { sampleItems: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    let totalPopulation = 0;
    let totalSampleSize = 0;
    let totalPopulationValue = 0;
    let totalSampleValue = 0;

    const runs = samplingRuns.map((run) => {
      const popSize = run.populationSize || 0;
      const sampleSize = run._count.sampleItems;
      totalPopulation += popSize;
      totalSampleSize += sampleSize;
      totalPopulationValue += toNumber(run.populationValue);
      totalSampleValue += toNumber(run.sampleValue);

      return {
        runId: run.id,
        method: run.samplingMethod,
        createdAt: run.createdAt,
        populationSize: popSize,
        sampleSize,
        coveragePercentage: popSize > 0 ? Math.round((sampleSize / popSize) * 100) : 0,
        confidenceLevel: toNumber(run.confidenceLevel),
        materialityThreshold: toNumber(run.materialityThreshold),
        criteria: (run.selectionCriteria as Record<string, any>) || {},
        createdBy: run.createdBy?.fullName || "Unknown",
      };
    });

    const samplesByArea: { area: string; populationCount: number; sampleCount: number; coverage: number }[] = [];
    const areaMap = new Map<string, { pop: number; sample: number }>();

    for (const run of samplingRuns) {
      const area = run.testArea || "General";
      const existing = areaMap.get(area) || { pop: 0, sample: 0 };
      areaMap.set(area, {
        pop: existing.pop + (run.populationSize || 0),
        sample: existing.sample + run._count.sampleItems,
      });
    }

    for (const [area, data] of areaMap) {
      samplesByArea.push({
        area,
        populationCount: data.pop,
        sampleCount: data.sample,
        coverage: data.pop > 0 ? Math.round((data.sample / data.pop) * 100) : 0,
      });
    }

    return {
      exportMetadata,
      summary: {
        totalSamplingRuns: samplingRuns.length,
        totalPopulation,
        totalSampleSize,
        overallCoveragePercentage: totalPopulation > 0 ? Math.round((totalSampleSize / totalPopulation) * 100) : 0,
        coverageByValue:
          totalPopulationValue > 0 ? Math.round((totalSampleValue / totalPopulationValue) * 100) : 0,
      },
      runs,
      samplesByArea,
    };
  }

  async generateAdjustmentsSummaryReport(
    engagementId: string,
    userId: string
  ): Promise<AdjustmentsSummaryReport> {
    const exportMetadata = await this.getExportMetadata(engagementId, userId, "Adjustments Summary Report");

    const [misstatements, materiality] = await Promise.all([
      prisma.misstatement.findMany({
        where: { engagementId },
        include: {
          identifiedBy: { select: { fullName: true } },
          partnerApprovedBy: { select: { fullName: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.materialityCalculation.findFirst({
        where: { engagementId },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const performanceMateriality = toNumber(materiality?.performanceMateriality);
    const clearlyTrivialThreshold = performanceMateriality * 0.05;

    let totalPostedAmount = 0;
    let totalUnpostedAmount = 0;
    const byFSCaptionMap = new Map<
      string,
      { postedAmount: number; unpostedAmount: number; adjustmentCount: number }
    >();

    const adjustments = misstatements.map((m, idx) => {
      const netAmount = toNumber(m.misstatementAmount);
      const isPosted = m.status === "ADJUSTED" || m.status === "RESOLVED";
      const fsCaption = m.fsCaption || "Unclassified";

      if (isPosted) {
        totalPostedAmount += Math.abs(netAmount);
      } else {
        totalUnpostedAmount += Math.abs(netAmount);
      }

      const existing = byFSCaptionMap.get(fsCaption) || {
        postedAmount: 0,
        unpostedAmount: 0,
        adjustmentCount: 0,
      };
      byFSCaptionMap.set(fsCaption, {
        postedAmount: existing.postedAmount + (isPosted ? Math.abs(netAmount) : 0),
        unpostedAmount: existing.unpostedAmount + (isPosted ? 0 : Math.abs(netAmount)),
        adjustmentCount: existing.adjustmentCount + 1,
      });

      return {
        id: m.id,
        reference: `ADJ-${String(idx + 1).padStart(3, "0")}`,
        description: m.description || "Audit adjustment",
        debitAmount: netAmount > 0 ? netAmount : 0,
        creditAmount: netAmount < 0 ? Math.abs(netAmount) : 0,
        netAmount,
        status: m.status,
        isPosted,
        fsCaption: m.fsCaption,
        createdAt: m.createdAt,
        createdBy: m.identifiedBy?.fullName || "Unknown",
        approvedAt: m.partnerApprovedAt,
        approvedBy: m.partnerApprovedBy?.fullName || null,
      };
    });

    const byFSCaption = Array.from(byFSCaptionMap.entries()).map(([fsCaption, data]) => ({
      fsCaption,
      ...data,
    }));

    const postedCount = adjustments.filter((a) => a.isPosted).length;
    const percentOfPM = performanceMateriality > 0 ? Math.round((totalUnpostedAmount / performanceMateriality) * 100) : 0;
    const fsImpact = totalUnpostedAmount > performanceMateriality ? "MATERIAL" : "NOT_MATERIAL";

    const clearlyTrivialAmount = adjustments
      .filter((a) => !a.isPosted && Math.abs(a.netAmount) <= clearlyTrivialThreshold)
      .reduce((sum, a) => sum + Math.abs(a.netAmount), 0);

    return {
      exportMetadata,
      summary: {
        totalAdjustments: adjustments.length,
        postedAdjustments: postedCount,
        unpostedAdjustments: adjustments.length - postedCount,
        totalPostedAmount,
        totalUnpostedAmount,
        performanceMateriality,
        percentOfPM,
        fsImpact,
        isaReference: "ISA 450 - Evaluation of Misstatements",
      },
      adjustments,
      byFSCaption,
      isa450Compliance: {
        aggregatedUncorrected: totalUnpostedAmount,
        clearlyClearlyTrivial: clearlyTrivialAmount,
        materialityThreshold: performanceMateriality,
        requiresModification: totalUnpostedAmount > performanceMateriality,
        managementRepresentationRequired: totalUnpostedAmount > 0,
      },
    };
  }

  async generateAuditTrailReport(
    engagementId: string,
    userId: string,
    dateRange?: DateRangeFilter
  ): Promise<AuditTrailReport> {
    const exportMetadata = await this.getExportMetadata(engagementId, userId, "Audit Trail Report");

    const whereClause: any = { engagementId };
    if (dateRange?.from) whereClause.createdAt = { ...whereClause.createdAt, gte: dateRange.from };
    if (dateRange?.to) whereClause.createdAt = { ...whereClause.createdAt, lte: dateRange.to };

    const auditLogs = await prisma.auditTrail.findMany({
      where: whereClause,
      include: {
        user: { select: { fullName: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const eventsByType: Record<string, number> = {};
    const byUserMap = new Map<string, { userName: string; eventCount: number; lastActivity: Date }>();
    const byModuleMap = new Map<string, number>();

    const events = auditLogs.map((log) => {
      eventsByType[log.action] = (eventsByType[log.action] || 0) + 1;

      const existing = byUserMap.get(log.userId) || {
        userName: log.user?.fullName || "Unknown",
        eventCount: 0,
        lastActivity: log.createdAt,
      };
      byUserMap.set(log.userId, {
        userName: log.user?.fullName || "Unknown",
        eventCount: existing.eventCount + 1,
        lastActivity: existing.lastActivity > log.createdAt ? existing.lastActivity : log.createdAt,
      });

      const module = log.module || log.entityType || "General";
      byModuleMap.set(module, (byModuleMap.get(module) || 0) + 1);

      return {
        id: log.id,
        timestamp: log.createdAt,
        userId: log.userId,
        userName: log.user?.fullName || "Unknown",
        userRole: log.user?.role || "Unknown",
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        module: log.module,
        beforeValue: log.beforeValue,
        afterValue: log.afterValue,
        ipAddress: log.ipAddress,
        justification: log.justification,
      };
    });

    const byUser = Array.from(byUserMap.entries()).map(([userId, data]) => ({
      userId,
      ...data,
    }));

    const byModule = Array.from(byModuleMap.entries()).map(([module, eventCount]) => ({
      module,
      eventCount,
    }));

    const timestamps = events.map((e) => e.timestamp);

    return {
      exportMetadata,
      summary: {
        totalEvents: events.length,
        uniqueUsers: byUserMap.size,
        dateRange: {
          from: timestamps.length > 0 ? new Date(Math.min(...timestamps.map((t) => t.getTime()))) : null,
          to: timestamps.length > 0 ? new Date(Math.max(...timestamps.map((t) => t.getTime()))) : null,
        },
        eventsByType,
      },
      events,
      byUser: byUser.sort((a, b) => b.eventCount - a.eventCount),
      byModule: byModule.sort((a, b) => b.eventCount - a.eventCount),
    };
  }
}

export const reportingService = new ReportingService();
