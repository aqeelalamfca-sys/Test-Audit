import { prisma } from "../db";
import { FieldInstanceStatus, FieldDataSource, SignOffLevel } from "@prisma/client";
import { fieldBlueprints, FieldBlueprintSeed } from "../fieldBlueprints";

export interface PushRouterParams {
  engagementId: string;
  fiscalYearId?: string;
  tbBatchId?: string;
  glBatchId?: string;
  mappingSessionId?: string;
  targets: string[];
  userId: string;
}

export interface ReadinessResult {
  module: string;
  tab?: string;
  totalFields: number;
  completedFields: number;
  readinessPercentage: number;
  missingFields: Array<{
    fieldKey: string;
    label: string;
    reason: string;
  }>;
  isBlocked: boolean;
  signOffLevel: SignOffLevel;
}

export async function seedFieldBlueprints(): Promise<number> {
  let created = 0;
  
  for (const bp of fieldBlueprints) {
    const existing = await prisma.requiredFieldBlueprint.findUnique({
      where: {
        module_tab_fieldKey: {
          module: bp.module,
          tab: bp.tab,
          fieldKey: bp.fieldKey,
        },
      },
    });

    if (!existing) {
      await prisma.requiredFieldBlueprint.create({
        data: {
          module: bp.module,
          tab: bp.tab,
          fieldKey: bp.fieldKey,
          label: bp.label,
          description: bp.description,
          fieldType: bp.fieldType,
          required: bp.required,
          requiredWhen: bp.requiredWhen ? bp.requiredWhen : undefined,
          dataSource: bp.dataSource,
          defaultValue: bp.defaultValue !== undefined ? bp.defaultValue : undefined,
          validationRules: bp.validationRules,
          roleLockRule: bp.roleLockRule,
          minRoleToEdit: bp.minRoleToEdit,
          standardsRef: bp.standardsRef,
          orderIndex: bp.orderIndex,
        },
      });
      created++;
    }
  }
  
  return created;
}

export async function initializeFieldInstances(engagementId: string, userId: string): Promise<number> {
  const blueprints = await prisma.requiredFieldBlueprint.findMany({
    where: { isActive: true },
  });

  let created = 0;

  for (const bp of blueprints) {
    const existing = await prisma.requiredFieldInstance.findUnique({
      where: {
        engagementId_blueprintId: {
          engagementId,
          blueprintId: bp.id,
        },
      },
    });

    if (!existing) {
      await prisma.requiredFieldInstance.create({
        data: {
          engagementId,
          blueprintId: bp.id,
          module: bp.module,
          tab: bp.tab,
          fieldKey: bp.fieldKey,
          status: "MISSING",
          valueJson: bp.defaultValue,
          displayValue: bp.defaultValue ? String(bp.defaultValue) : null,
          updatedById: userId,
        },
      });
      created++;
    }
  }

  return created;
}

export async function pushRouter(params: PushRouterParams): Promise<Record<string, number>> {
  const results: Record<string, number> = {};
  
  for (const target of params.targets) {
    switch (target) {
      case "INFORMATION_REQUISITION":
        results[target] = await pushToInformationRequisition(params);
        break;
      case "PRE_PLANNING":
        results[target] = await pushToPrePlanning(params);
        break;
      case "PLANNING":
        results[target] = await pushToPlanning(params);
        break;
      case "EXECUTION":
        results[target] = await pushToExecution(params);
        break;
      case "FS_HEADS":
        results[target] = await pushToFSHeads(params);
        break;
      case "FINALIZATION":
        results[target] = await pushToFinalization(params);
        break;
      default:
        results[target] = 0;
    }
  }

  for (const module of params.targets) {
    await calculateModuleReadiness(params.engagementId, module);
  }

  return results;
}

async function pushToInformationRequisition(params: PushRouterParams): Promise<number> {
  let updated = 0;
  
  if (params.tbBatchId) {
    const tbBatch = await prisma.tBBatch.findUnique({
      where: { id: params.tbBatchId },
      include: { entries: true },
    });

    if (tbBatch) {
      const hasBankAccounts = tbBatch.entries.some(e => 
        e.accountName?.toLowerCase().includes("bank") || 
        e.accountName?.toLowerCase().includes("cash")
      );
      if (hasBankAccounts) {
        updated += await updateFieldInstance(
          params.engagementId,
          "INFORMATION_REQUISITION",
          "DOCUMENT_CHECKLIST",
          "bank_statements",
          { required: true, source: "TB analysis detected bank accounts" },
          "TB_UPLOAD",
          params.tbBatchId,
          params.userId
        );
      }

      const hasInventory = tbBatch.entries.some(e => 
        e.accountName?.toLowerCase().includes("inventory") ||
        e.accountName?.toLowerCase().includes("stock")
      );
      if (hasInventory) {
        updated += await updateFieldInstance(
          params.engagementId,
          "INFORMATION_REQUISITION",
          "DOCUMENT_CHECKLIST",
          "inventory_schedules",
          { required: true, source: "TB analysis detected inventory accounts" },
          "TB_UPLOAD",
          params.tbBatchId,
          params.userId
        );
      }

      const hasFixedAssets = tbBatch.entries.some(e => 
        e.accountName?.toLowerCase().includes("fixed asset") ||
        e.accountName?.toLowerCase().includes("property") ||
        e.accountName?.toLowerCase().includes("equipment")
      );
      if (hasFixedAssets) {
        updated += await updateFieldInstance(
          params.engagementId,
          "INFORMATION_REQUISITION",
          "DOCUMENT_CHECKLIST",
          "fixed_asset_register",
          { required: true, source: "TB analysis detected fixed asset accounts" },
          "TB_UPLOAD",
          params.tbBatchId,
          params.userId
        );
      }
    }
  }

  if (params.glBatchId) {
    const glBatch = await prisma.gLBatch.findUnique({
      where: { id: params.glBatchId },
    });

    if (glBatch) {
      updated += await updateFieldInstance(
        params.engagementId,
        "INFORMATION_REQUISITION",
        "DOCUMENT_CHECKLIST",
        "revenue_invoices_sample",
        { required: true, glBatchId: params.glBatchId },
        "GL_UPLOAD",
        params.glBatchId,
        params.userId
      );

      updated += await updateFieldInstance(
        params.engagementId,
        "INFORMATION_REQUISITION",
        "DOCUMENT_CHECKLIST",
        "payroll_records",
        { required: true, glBatchId: params.glBatchId },
        "GL_UPLOAD",
        params.glBatchId,
        params.userId
      );
    }
  }

  return updated;
}

async function pushToPrePlanning(params: PushRouterParams): Promise<number> {
  let updated = 0;

  if (params.tbBatchId) {
    const tbBatch = await prisma.tBBatch.findUnique({
      where: { id: params.tbBatchId },
      include: { entries: true },
    });

    if (tbBatch) {
      const totalAssets = tbBatch.entries
        .filter(e => e.accountType?.toLowerCase().includes("asset"))
        .reduce((sum, e) => sum + (Number(e.closingBalance) || 0), 0);

      const totalRevenue = tbBatch.entries
        .filter(e => 
          e.accountType?.toLowerCase().includes("revenue") ||
          e.accountType?.toLowerCase().includes("income") ||
          e.accountName?.toLowerCase().includes("sales")
        )
        .reduce((sum, e) => sum + Math.abs(Number(e.closingBalance) || 0), 0);

      const totalEquity = tbBatch.entries
        .filter(e => 
          e.accountType?.toLowerCase().includes("equity") ||
          e.accountName?.toLowerCase().includes("capital") ||
          e.accountName?.toLowerCase().includes("retained")
        )
        .reduce((sum, e) => sum + (Number(e.closingBalance) || 0), 0);

      updated += await updateFieldInstance(
        params.engagementId,
        "PRE_PLANNING",
        "ENGAGEMENT_BASICS",
        "total_assets",
        totalAssets,
        "TB_UPLOAD",
        params.tbBatchId,
        params.userId
      );

      updated += await updateFieldInstance(
        params.engagementId,
        "PRE_PLANNING",
        "ENGAGEMENT_BASICS",
        "total_revenue",
        totalRevenue,
        "TB_UPLOAD",
        params.tbBatchId,
        params.userId
      );

      updated += await updateFieldInstance(
        params.engagementId,
        "PRE_PLANNING",
        "ENGAGEMENT_BASICS",
        "total_equity",
        totalEquity,
        "TB_UPLOAD",
        params.tbBatchId,
        params.userId
      );

      const engagement = await prisma.engagement.findUnique({
        where: { id: params.engagementId },
      });
      if (engagement?.periodEnd) {
        updated += await updateFieldInstance(
          params.engagementId,
          "PRE_PLANNING",
          "ENGAGEMENT_BASICS",
          "period_end_date",
          engagement.periodEnd.toISOString(),
          "TB_UPLOAD",
          params.tbBatchId,
          params.userId
        );
      }
    }
  }

  return updated;
}

async function pushToPlanning(params: PushRouterParams): Promise<number> {
  let updated = 0;

  if (params.mappingSessionId) {
    const mappingSession = await prisma.mappingSession.findUnique({
      where: { id: params.mappingSessionId },
      include: { reconciliationItems: true },
    });

    if (mappingSession) {
      const bsItems = mappingSession.reconciliationItems.filter(i => 
        determineStatementType(i.tbAccountName || "").type === "BS"
      );
      const plItems = mappingSession.reconciliationItems.filter(i =>
        determineStatementType(i.tbAccountName || "").type === "PL"
      );

      const totalAssets = bsItems
        .filter(i => isAssetAccount(i.tbAccountName || ""))
        .reduce((sum, i) => sum + (Number(i.tbClosingBalance) || 0), 0);

      const totalLiabilities = bsItems
        .filter(i => isLiabilityAccount(i.tbAccountName || ""))
        .reduce((sum, i) => sum + Math.abs(Number(i.tbClosingBalance) || 0), 0);

      const totalEquity = bsItems
        .filter(i => isEquityAccount(i.tbAccountName || ""))
        .reduce((sum, i) => sum + (Number(i.tbClosingBalance) || 0), 0);

      const totalRevenue = plItems
        .filter(i => isRevenueAccount(i.tbAccountName || ""))
        .reduce((sum, i) => sum + Math.abs(Number(i.tbClosingBalance) || 0), 0);

      const totalExpenses = plItems
        .filter(i => isExpenseAccount(i.tbAccountName || ""))
        .reduce((sum, i) => sum + Math.abs(Number(i.tbClosingBalance) || 0), 0);

      const netProfit = totalRevenue - totalExpenses;

      updated += await updateFieldInstance(
        params.engagementId,
        "PLANNING",
        "FINANCIAL_STATEMENTS",
        "draft_bs_total_assets",
        totalAssets,
        "MAPPING",
        params.mappingSessionId,
        params.userId
      );

      updated += await updateFieldInstance(
        params.engagementId,
        "PLANNING",
        "FINANCIAL_STATEMENTS",
        "draft_bs_total_liabilities",
        totalLiabilities,
        "MAPPING",
        params.mappingSessionId,
        params.userId
      );

      updated += await updateFieldInstance(
        params.engagementId,
        "PLANNING",
        "FINANCIAL_STATEMENTS",
        "draft_bs_total_equity",
        totalEquity,
        "MAPPING",
        params.mappingSessionId,
        params.userId
      );

      updated += await updateFieldInstance(
        params.engagementId,
        "PLANNING",
        "FINANCIAL_STATEMENTS",
        "draft_pl_total_revenue",
        totalRevenue,
        "MAPPING",
        params.mappingSessionId,
        params.userId
      );

      updated += await updateFieldInstance(
        params.engagementId,
        "PLANNING",
        "FINANCIAL_STATEMENTS",
        "draft_pl_net_profit",
        netProfit,
        "MAPPING",
        params.mappingSessionId,
        params.userId
      );

      const fsHeadsLinked = mappingSession.reconciliationItems.map(i => ({
        accountCode: i.tbAccountCode,
        accountName: i.tbAccountName,
        fsHead: i.fsHead,
        balance: i.tbClosingBalance,
      }));

      updated += await updateFieldInstance(
        params.engagementId,
        "PLANNING",
        "FINANCIAL_STATEMENTS",
        "fs_heads_linked",
        fsHeadsLinked,
        "PUSH_ROUTER",
        params.mappingSessionId,
        params.userId
      );
    }
  }

  if (params.tbBatchId) {
    const tbBatch = await prisma.tBBatch.findUnique({
      where: { id: params.tbBatchId },
      include: { entries: true },
    });

    if (tbBatch) {
      const totalAssets = tbBatch.entries
        .filter(e => e.accountType?.toLowerCase().includes("asset"))
        .reduce((sum, e) => sum + (Number(e.closingBalance) || 0), 0);

      const totalRevenue = tbBatch.entries
        .filter(e => 
          e.accountType?.toLowerCase().includes("revenue") ||
          e.accountName?.toLowerCase().includes("sales")
        )
        .reduce((sum, e) => sum + Math.abs(Number(e.closingBalance) || 0), 0);

      const totalEquity = tbBatch.entries
        .filter(e => 
          e.accountType?.toLowerCase().includes("equity") ||
          e.accountName?.toLowerCase().includes("capital")
        )
        .reduce((sum, e) => sum + (Number(e.closingBalance) || 0), 0);

      const netProfit = tbBatch.entries
        .filter(e => 
          e.accountType?.toLowerCase().includes("revenue") ||
          e.accountType?.toLowerCase().includes("income") ||
          e.accountType?.toLowerCase().includes("expense")
        )
        .reduce((sum, e) => {
          const isIncome = e.accountType?.toLowerCase().includes("revenue") || 
                          e.accountType?.toLowerCase().includes("income");
          return sum + (isIncome ? Math.abs(Number(e.closingBalance) || 0) : -Math.abs(Number(e.closingBalance) || 0));
        }, 0);

      updated += await updateFieldInstance(
        params.engagementId,
        "PLANNING",
        "MATERIALITY",
        "pbt_benchmark",
        netProfit,
        "TB_UPLOAD",
        params.tbBatchId,
        params.userId
      );

      updated += await updateFieldInstance(
        params.engagementId,
        "PLANNING",
        "MATERIALITY",
        "revenue_benchmark",
        totalRevenue,
        "TB_UPLOAD",
        params.tbBatchId,
        params.userId
      );

      updated += await updateFieldInstance(
        params.engagementId,
        "PLANNING",
        "MATERIALITY",
        "assets_benchmark",
        totalAssets,
        "TB_UPLOAD",
        params.tbBatchId,
        params.userId
      );

      updated += await updateFieldInstance(
        params.engagementId,
        "PLANNING",
        "MATERIALITY",
        "equity_benchmark",
        totalEquity,
        "TB_UPLOAD",
        params.tbBatchId,
        params.userId
      );

      const suggestedMateriality = Math.round(totalRevenue * 0.005);
      const performanceMateriality = Math.round(suggestedMateriality * 0.75);

      updated += await updateFieldInstance(
        params.engagementId,
        "PLANNING",
        "MATERIALITY",
        "suggested_materiality",
        suggestedMateriality,
        "PUSH_ROUTER",
        params.tbBatchId,
        params.userId
      );

      updated += await updateFieldInstance(
        params.engagementId,
        "PLANNING",
        "MATERIALITY",
        "performance_materiality",
        performanceMateriality,
        "PUSH_ROUTER",
        params.tbBatchId,
        params.userId
      );

      const liquidityRatios = calculateLiquidityRatios(tbBatch.entries);
      updated += await updateFieldInstance(
        params.engagementId,
        "PLANNING",
        "ANALYTICAL",
        "liquidity_ratios",
        liquidityRatios,
        "TB_UPLOAD",
        params.tbBatchId,
        params.userId
      );

      const profitabilityRatios = calculateProfitabilityRatios(tbBatch.entries);
      updated += await updateFieldInstance(
        params.engagementId,
        "PLANNING",
        "ANALYTICAL",
        "profitability_ratios",
        profitabilityRatios,
        "TB_UPLOAD",
        params.tbBatchId,
        params.userId
      );

      const significantAccounts = tbBatch.entries
        .filter(e => Math.abs(Number(e.closingBalance) || 0) > suggestedMateriality)
        .map(e => ({
          accountCode: e.accountCode,
          accountName: e.accountName,
          balance: e.closingBalance,
          significant: true,
        }));

      updated += await updateFieldInstance(
        params.engagementId,
        "PLANNING",
        "RISK",
        "significant_accounts",
        significantAccounts,
        "TB_UPLOAD",
        params.tbBatchId,
        params.userId
      );
    }
  }

  if (params.glBatchId) {
    const glBatch = await prisma.gLBatch.findUnique({
      where: { id: params.glBatchId },
    });

    const glEntryCount = await prisma.gLEntry.count({
      where: { batchId: params.glBatchId },
    });

    if (glBatch) {
      updated += await updateFieldInstance(
        params.engagementId,
        "PLANNING",
        "TEAM_BRIEFING",
        "transaction_volume",
        glEntryCount,
        "GL_UPLOAD",
        params.glBatchId,
        params.userId
      );

      updated += await updateFieldInstance(
        params.engagementId,
        "PLANNING",
        "AUDIT_PROGRAM",
        "je_testing_required",
        true,
        "GL_UPLOAD",
        params.glBatchId,
        params.userId
      );

      updated += await updateFieldInstance(
        params.engagementId,
        "PLANNING",
        "AUDIT_PROGRAM",
        "cutoff_tests_required",
        true,
        "GL_UPLOAD",
        params.glBatchId,
        params.userId
      );
    }
  }

  return updated;
}

async function pushToExecution(params: PushRouterParams): Promise<number> {
  let updated = 0;

  const fsHeadWPs = await prisma.fSHeadWorkingPaper.findMany({
    where: { engagementId: params.engagementId },
  });

  if (fsHeadWPs.length > 0) {
    const fsHeadsList = fsHeadWPs.map(wp => ({
      id: wp.id,
      fsHead: wp.fsHead,
      statementType: wp.statementType,
      riskLevel: wp.riskLevel,
      tbBalance: wp.tbBalance,
    }));

    updated += await updateFieldInstance(
      params.engagementId,
      "EXECUTION",
      "FS_HEAD_SECTIONS",
      "fs_heads_list",
      fsHeadsList,
      "PUSH_ROUTER",
      null,
      params.userId
    );

    const risksPerFsHead = fsHeadWPs.map(wp => ({
      fsHead: wp.fsHead,
      riskLevel: wp.riskLevel,
      riskFactors: wp.riskLevel === "HIGH" ? ["Material balance", "Revenue/Receivables"] : [],
    }));

    updated += await updateFieldInstance(
      params.engagementId,
      "EXECUTION",
      "FS_HEAD_SECTIONS",
      "risks_per_fs_head",
      risksPerFsHead,
      "PUSH_ROUTER",
      null,
      params.userId
    );

    const assertionsPerFsHead = fsHeadWPs.map(wp => ({
      fsHead: wp.fsHead,
      assertions: getDefaultAssertions(wp.statementType || "BS"),
    }));

    updated += await updateFieldInstance(
      params.engagementId,
      "EXECUTION",
      "FS_HEAD_SECTIONS",
      "assertions_per_fs_head",
      assertionsPerFsHead,
      "PUSH_ROUTER",
      null,
      params.userId
    );
  }

  return updated;
}

async function pushToFSHeads(params: PushRouterParams): Promise<number> {
  let updated = 0;

  const fsHeadWPs = await prisma.fSHeadWorkingPaper.findMany({
    where: { engagementId: params.engagementId },
  });

  if (fsHeadWPs.length > 0) {
    const fsHeadsWithBalances = fsHeadWPs.map(wp => ({
      id: wp.id,
      fsHead: wp.fsHead,
      statementType: wp.statementType,
      tbBalance: wp.tbBalance,
      materialityThreshold: wp.materialityThreshold,
    }));

    updated += await updateFieldInstance(
      params.engagementId,
      "FS_HEADS",
      "DASHBOARD",
      "fs_heads_with_balances",
      fsHeadsWithBalances,
      "PUSH_ROUTER",
      null,
      params.userId
    );
  }

  if (params.glBatchId) {
    const glEntries = await prisma.gLEntry.findMany({
      where: { batchId: params.glBatchId },
      select: { accountCode: true, accountName: true, debitAmount: true, creditAmount: true },
    });

    const populationByAccount: Record<string, { count: number; amount: number }> = {};
    for (const entry of glEntries) {
      const key = entry.accountCode || entry.accountName || "unknown";
      if (!populationByAccount[key]) {
        populationByAccount[key] = { count: 0, amount: 0 };
      }
      populationByAccount[key].count++;
      populationByAccount[key].amount += Math.abs(Number(entry.debitAmount) || 0) + Math.abs(Number(entry.creditAmount) || 0);
    }

    updated += await updateFieldInstance(
      params.engagementId,
      "FS_HEADS",
      "DASHBOARD",
      "population_statistics",
      populationByAccount,
      "GL_UPLOAD",
      params.glBatchId,
      params.userId
    );
  }

  return updated;
}

async function pushToFinalization(params: PushRouterParams): Promise<number> {
  let updated = 0;

  if (params.mappingSessionId) {
    const mappingSession = await prisma.mappingSession.findUnique({
      where: { id: params.mappingSessionId },
      include: { reconciliationItems: true },
    });

    if (mappingSession) {
      const unadjustedFS = mappingSession.reconciliationItems.reduce((acc, item) => {
        const fsHead = item.fsHead || "Unclassified";
        if (!acc[fsHead]) {
          acc[fsHead] = { debit: 0, credit: 0 };
        }
        acc[fsHead].debit += Number(item.tbClosingBalance) > 0 ? Number(item.tbClosingBalance) : 0;
        acc[fsHead].credit += Number(item.tbClosingBalance) < 0 ? Math.abs(Number(item.tbClosingBalance)) : 0;
        return acc;
      }, {} as Record<string, { debit: number; credit: number }>);

      updated += await updateFieldInstance(
        params.engagementId,
        "FINALIZATION",
        "ADJUSTED_FS",
        "unadjusted_fs",
        unadjustedFS,
        "MAPPING",
        params.mappingSessionId,
        params.userId
      );
    }
  }

  const adjustments = await prisma.fSHeadAdjustment.findMany({
    where: {
      workingPaper: { engagementId: params.engagementId },
      isPosted: true,
    },
  });

  if (adjustments.length > 0) {
    const adjustmentsSummary = adjustments.map(adj => ({
      ref: adj.adjustmentRef,
      description: adj.description,
      debit: adj.debitAmount,
      credit: adj.creditAmount,
      fsImpact: adj.fsImpact,
      isMaterial: adj.isMaterial,
    }));

    updated += await updateFieldInstance(
      params.engagementId,
      "FINALIZATION",
      "ADJUSTED_FS",
      "audit_adjustments",
      adjustmentsSummary,
      "PUSH_ROUTER",
      null,
      params.userId
    );
  }

  return updated;
}

async function updateFieldInstance(
  engagementId: string,
  module: string,
  tab: string,
  fieldKey: string,
  value: unknown,
  dataSource: string,
  sourceRef: string | null,
  userId: string
): Promise<number> {
  const blueprint = await prisma.requiredFieldBlueprint.findUnique({
    where: {
      module_tab_fieldKey: { module, tab, fieldKey },
    },
  });

  if (!blueprint) {
    return 0;
  }

  const existingInstance = await prisma.requiredFieldInstance.findUnique({
    where: {
      engagementId_blueprintId: {
        engagementId,
        blueprintId: blueprint.id,
      },
    },
  });

  const newStatus: FieldInstanceStatus = value !== null && value !== undefined ? "POPULATED" : "MISSING";
  const displayValue = value !== null ? (typeof value === "object" ? JSON.stringify(value) : String(value)) : null;

  if (existingInstance) {
    if (existingInstance.status === "OVERRIDDEN" || existingInstance.isLocked) {
      return 0;
    }

    const beforeJson = {
      value: existingInstance.valueJson,
      status: existingInstance.status,
    };

    await prisma.requiredFieldInstance.update({
      where: { id: existingInstance.id },
      data: {
        valueJson: value as any,
        displayValue,
        status: newStatus,
        sourceRef,
        sourceBatchId: dataSource === "TB_UPLOAD" || dataSource === "GL_UPLOAD" ? sourceRef : existingInstance.sourceBatchId,
        sourceMappingId: dataSource === "MAPPING" ? sourceRef : existingInstance.sourceMappingId,
        updatedById: userId,
      },
    });

    await prisma.fieldAuditLog.create({
      data: {
        instanceId: existingInstance.id,
        engagementId,
        action: "AUTO_POPULATE",
        beforeJson,
        afterJson: { value, status: newStatus },
        sourceType: dataSource,
        sourceRef,
        userId,
      },
    });

    return 1;
  } else {
    const newInstance = await prisma.requiredFieldInstance.create({
      data: {
        engagementId,
        blueprintId: blueprint.id,
        module,
        tab,
        fieldKey,
        valueJson: value as any,
        displayValue,
        status: newStatus,
        sourceRef,
        sourceBatchId: dataSource === "TB_UPLOAD" || dataSource === "GL_UPLOAD" ? sourceRef : null,
        sourceMappingId: dataSource === "MAPPING" ? sourceRef : null,
        updatedById: userId,
      },
    });

    await prisma.fieldAuditLog.create({
      data: {
        instanceId: newInstance.id,
        engagementId,
        action: "CREATE",
        afterJson: { value, status: newStatus },
        sourceType: dataSource,
        sourceRef,
        userId,
      },
    });

    return 1;
  }
}

export async function calculateModuleReadiness(
  engagementId: string,
  module: string,
  tab?: string
): Promise<ReadinessResult> {
  const whereClause: any = {
    engagementId,
    module,
    blueprint: { required: true },
  };
  if (tab) {
    whereClause.tab = tab;
  }

  const instances = await prisma.requiredFieldInstance.findMany({
    where: whereClause,
    include: { blueprint: true },
  });

  const totalFields = instances.length;
  const completedFields = instances.filter(i => 
    i.status === "POPULATED" || i.status === "OVERRIDDEN" || i.status === "LOCKED"
  ).length;

  const readinessPercentage = totalFields > 0 ? Math.round((completedFields / totalFields) * 100) : 0;

  const missingFields = instances
    .filter(i => i.status === "MISSING")
    .map(i => ({
      fieldKey: i.fieldKey,
      label: i.blueprint.label,
      reason: `Required for ${i.blueprint.standardsRef || "compliance"}`,
    }));

  const signOffLevel = await getModuleSignOffLevel(engagementId, module, tab);

  const isBlocked = totalFields > 0 && completedFields < totalFields;

  await prisma.moduleReadiness.upsert({
    where: {
      engagementId_module_tab: {
        engagementId,
        module,
        tab: tab || "",
      },
    },
    update: {
      totalFields,
      completedFields,
      readinessPercentage,
      missingFieldKeys: missingFields.map(f => f.fieldKey),
      signOffLevel,
      isBlocked,
      lastCalculatedAt: new Date(),
    },
    create: {
      engagementId,
      module,
      tab: tab || null,
      totalFields,
      completedFields,
      readinessPercentage,
      missingFieldKeys: missingFields.map(f => f.fieldKey),
      signOffLevel,
      isBlocked,
    },
  });

  return {
    module,
    tab,
    totalFields,
    completedFields,
    readinessPercentage,
    missingFields,
    isBlocked,
    signOffLevel,
  };
}

async function getModuleSignOffLevel(
  engagementId: string,
  module: string,
  tab?: string
): Promise<SignOffLevel> {
  const whereClause: any = { engagementId, module };
  if (tab) {
    whereClause.tab = tab;
  }

  const instances = await prisma.requiredFieldInstance.findMany({
    where: whereClause,
    select: { signOffLevel: true },
  });

  if (instances.length === 0) return "NONE";

  const hasApproved = instances.some(i => i.signOffLevel === "APPROVED");
  const hasReviewed = instances.some(i => i.signOffLevel === "REVIEWED");
  const hasPrepared = instances.some(i => i.signOffLevel === "PREPARED");

  if (hasApproved && instances.every(i => i.signOffLevel === "APPROVED")) {
    return "APPROVED";
  }
  if (hasReviewed || hasApproved) {
    return "REVIEWED";
  }
  if (hasPrepared) {
    return "PREPARED";
  }
  return "NONE";
}

function determineStatementType(accountName: string): { type: "BS" | "PL" } {
  const normalized = accountName.toLowerCase();
  const bsKeywords = ["asset", "liability", "liabilities", "equity", "capital", "payable", "receivable", 
    "cash", "bank", "inventory", "property", "equipment", "investment", "loan", "borrowing"];
  
  for (const kw of bsKeywords) {
    if (normalized.includes(kw)) {
      return { type: "BS" };
    }
  }
  return { type: "PL" };
}

function isAssetAccount(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes("asset") || n.includes("receivable") || n.includes("cash") || 
         n.includes("bank") || n.includes("inventory") || n.includes("property");
}

function isLiabilityAccount(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes("liability") || n.includes("liabilities") || n.includes("payable") || 
         n.includes("loan") || n.includes("borrowing") || n.includes("accrual");
}

function isEquityAccount(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes("equity") || n.includes("capital") || n.includes("retained") || n.includes("reserve");
}

function isRevenueAccount(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes("revenue") || n.includes("income") || n.includes("sales");
}

function isExpenseAccount(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes("expense") || n.includes("cost") || n.includes("depreciation") || n.includes("amortization");
}

function calculateLiquidityRatios(entries: any[]): Record<string, number> {
  const currentAssets = entries
    .filter(e => e.accountType?.toLowerCase().includes("current asset"))
    .reduce((sum, e) => sum + (Number(e.closingBalance) || 0), 0);

  const inventory = entries
    .filter(e => e.accountName?.toLowerCase().includes("inventory"))
    .reduce((sum, e) => sum + (Number(e.closingBalance) || 0), 0);

  const currentLiabilities = entries
    .filter(e => e.accountType?.toLowerCase().includes("current liab"))
    .reduce((sum, e) => sum + Math.abs(Number(e.closingBalance) || 0), 0);

  const currentRatio = currentLiabilities > 0 ? currentAssets / currentLiabilities : 0;
  const quickRatio = currentLiabilities > 0 ? (currentAssets - inventory) / currentLiabilities : 0;

  return {
    currentRatio: Math.round(currentRatio * 100) / 100,
    quickRatio: Math.round(quickRatio * 100) / 100,
  };
}

function calculateProfitabilityRatios(entries: any[]): Record<string, number> {
  const revenue = entries
    .filter(e => e.accountType?.toLowerCase().includes("revenue"))
    .reduce((sum, e) => sum + Math.abs(Number(e.closingBalance) || 0), 0);

  const cogs = entries
    .filter(e => e.accountName?.toLowerCase().includes("cost of"))
    .reduce((sum, e) => sum + Math.abs(Number(e.closingBalance) || 0), 0);

  const totalAssets = entries
    .filter(e => e.accountType?.toLowerCase().includes("asset"))
    .reduce((sum, e) => sum + (Number(e.closingBalance) || 0), 0);

  const totalEquity = entries
    .filter(e => e.accountType?.toLowerCase().includes("equity"))
    .reduce((sum, e) => sum + (Number(e.closingBalance) || 0), 0);

  const expenses = entries
    .filter(e => e.accountType?.toLowerCase().includes("expense"))
    .reduce((sum, e) => sum + Math.abs(Number(e.closingBalance) || 0), 0);

  const netProfit = revenue - cogs - expenses;
  const grossMargin = revenue > 0 ? ((revenue - cogs) / revenue) * 100 : 0;
  const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  const roa = totalAssets > 0 ? (netProfit / totalAssets) * 100 : 0;
  const roe = totalEquity > 0 ? (netProfit / totalEquity) * 100 : 0;

  return {
    grossMargin: Math.round(grossMargin * 100) / 100,
    netMargin: Math.round(netMargin * 100) / 100,
    roa: Math.round(roa * 100) / 100,
    roe: Math.round(roe * 100) / 100,
  };
}

function getDefaultAssertions(statementType: string): string[] {
  if (statementType === "BS") {
    return ["Existence", "Rights and Obligations", "Completeness", "Valuation", "Classification"];
  }
  return ["Occurrence", "Completeness", "Accuracy", "Cut-off", "Classification"];
}
