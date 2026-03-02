import { prisma } from "../db";
import { FieldInstanceStatus, FieldDataSource, Prisma } from "@prisma/client";

export type FieldScopeType = "ENGAGEMENT" | "FS_HEAD" | "PROCEDURE" | "CONFIRMATION";
export type FetchRefreshPolicy = "ON_IMPORT" | "ON_OPEN" | "MANUAL" | "SCHEDULED";

export interface FetchContext {
  engagementId: string;
  scopeType: FieldScopeType;
  scopeId?: string;
  userId: string;
  forceRefresh?: boolean;
}

export interface ComputedValue {
  value: unknown;
  displayValue: string;
  sourceRefs: SourceRef[];
  drilldownData?: DrilldownItem[];
}

export interface SourceRef {
  sourceType: string;
  sourceId: string;
  sourceLabel: string;
  timestamp: Date;
}

export interface DrilldownItem {
  id: string;
  label: string;
  value: unknown;
  metadata?: Record<string, unknown>;
}

export interface FieldDefinition {
  blueprintId: string;
  fieldKey: string;
  label: string;
  description?: string;
  helpText?: string;
  inputType: string;
  fieldType: string;
  required: boolean;
  isReadonly: boolean;
  optionsJson?: unknown;
  validationRules?: unknown;
  isaTags?: string[];
  fetchRuleName?: string;
  fetchRuleDescription?: string;
  currentValue?: unknown;
  displayValue?: string;
  status: FieldInstanceStatus;
  signOffLevel: string;
  isLocked: boolean;
}

export async function getFieldDefinitions(
  engagementId: string,
  module: string,
  tab?: string,
  scopeType?: FieldScopeType,
  scopeId?: string
): Promise<FieldDefinition[]> {
  const whereClause: Prisma.RequiredFieldBlueprintWhereInput = {
    module,
    isActive: true,
  };
  
  if (tab) {
    whereClause.tab = tab;
  }

  if (scopeType) {
    whereClause.scopeType = scopeType;
  }

  const blueprints = await prisma.requiredFieldBlueprint.findMany({
    where: whereClause,
    orderBy: { orderIndex: "asc" },
  });

  const fetchRuleNames = blueprints
    .map((b) => b.fetchRuleName)
    .filter((name): name is string => !!name);
  
  const fetchRules = fetchRuleNames.length > 0
    ? await prisma.fetchRule.findMany({
        where: { ruleName: { in: fetchRuleNames } },
      })
    : [];
  
  const fetchRuleMap = new Map(fetchRules.map((r) => [r.ruleName, r]));

  const instanceWhere: Prisma.RequiredFieldInstanceWhereInput = {
    engagementId,
    blueprintId: { in: blueprints.map((b) => b.id) },
  };

  if (scopeType && scopeId) {
    instanceWhere.scopeType = scopeType;
    instanceWhere.scopeId = scopeId;
  }

  const instances = await prisma.requiredFieldInstance.findMany({
    where: instanceWhere,
  });

  const instanceMap = new Map(
    instances.map((i) => [`${i.blueprintId}:${i.scopeType || ""}:${i.scopeId || ""}`, i])
  );

  return blueprints.map((bp) => {
    const instanceKey = `${bp.id}:${scopeType || ""}:${scopeId || ""}`;
    const instance = instanceMap.get(instanceKey);
    const fetchRule = bp.fetchRuleName ? fetchRuleMap.get(bp.fetchRuleName) : undefined;
    
    const isaTags = bp.isaReference ? [bp.isaReference] : undefined;
    
    return {
      blueprintId: bp.id,
      fieldKey: bp.fieldKey,
      label: bp.label,
      description: bp.description ?? undefined,
      helpText: bp.helpText ?? undefined,
      inputType: bp.fieldType,
      fieldType: bp.fieldType,
      required: bp.required,
      isReadonly: bp.dataSource !== "USER_INPUT",
      optionsJson: bp.optionsJson,
      validationRules: bp.validationRules,
      isaTags,
      fetchRuleName: bp.fetchRuleName ?? undefined,
      fetchRuleDescription: fetchRule?.description ?? undefined,
      currentValue: instance?.valueJson,
      displayValue: instance?.displayValue ?? undefined,
      status: instance?.status ?? "MISSING",
      signOffLevel: instance?.signOffLevel ?? "NONE",
      isLocked: instance?.isLocked ?? false,
    };
  });
}

export async function refreshAutoFields(context: FetchContext): Promise<number> {
  const whereClause: Prisma.RequiredFieldBlueprintWhereInput = {
    isActive: true,
    dataSource: { in: ["TB_UPLOAD", "GL_UPLOAD", "MAPPING", "PUSH_ROUTER"] },
  };

  if (context.scopeType) {
    whereClause.scopeType = context.scopeType;
  }

  const blueprints = await prisma.requiredFieldBlueprint.findMany({
    where: whereClause,
  });

  const fetchRuleNames = blueprints
    .map((b) => b.fetchRuleName)
    .filter((name): name is string => !!name);
  
  const fetchRules = fetchRuleNames.length > 0
    ? await prisma.fetchRule.findMany({
        where: { ruleName: { in: fetchRuleNames } },
      })
    : [];
  
  const fetchRuleMap = new Map(fetchRules.map((r) => [r.ruleName, r]));

  let refreshed = 0;

  for (const bp of blueprints) {
    const instanceWhere: Prisma.RequiredFieldInstanceWhereInput = {
      engagementId: context.engagementId,
      blueprintId: bp.id,
    };

    if (context.scopeType && context.scopeId) {
      instanceWhere.scopeType = context.scopeType;
      instanceWhere.scopeId = context.scopeId;
    }

    const instance = await prisma.requiredFieldInstance.findFirst({
      where: instanceWhere,
    });

    if (instance?.status === "OVERRIDDEN" || instance?.isLocked) {
      continue;
    }

    const fetchRule = bp.fetchRuleName ? fetchRuleMap.get(bp.fetchRuleName) : undefined;
    const shouldRefresh = shouldRefreshByPolicy(fetchRule?.refreshPolicy, context.forceRefresh);
    
    if (!shouldRefresh && instance) {
      continue;
    }

    try {
      const computed = await computeFieldValueByFetchRule(bp, fetchRule, context);
      if (computed) {
        await upsertFieldInstance(bp.id, context, computed);
        refreshed++;
      }
    } catch (error) {
      console.error(`Failed to refresh field ${bp.fieldKey}:`, error);
    }
  }

  return refreshed;
}

function shouldRefreshByPolicy(policy: string | undefined, forceRefresh?: boolean): boolean {
  if (forceRefresh) return true;
  if (!policy) return true;
  
  switch (policy) {
    case "ON_OPEN":
      return true;
    case "ON_TB_CHANGE":
    case "ON_GL_CHANGE":
    case "ON_IMPORT":
      return true;
    case "MANUAL":
      return false;
    default:
      return true;
  }
}

async function computeFieldValueByFetchRule(
  blueprint: { dataSource: FieldDataSource; fieldKey: string; fetchRuleName: string | null },
  fetchRule: { sourceType: string; sourceRef: string | null } | undefined,
  context: FetchContext
): Promise<ComputedValue | null> {
  if (fetchRule) {
    return await computeBySourceType(fetchRule.sourceType, fetchRule.sourceRef, blueprint.fieldKey, context);
  }
  return await computeFieldValueBySource(blueprint.dataSource, blueprint.fieldKey, context);
}

async function computeBySourceType(
  sourceType: string,
  sourceRef: string | null,
  fieldKey: string,
  context: FetchContext
): Promise<ComputedValue | null> {
  if (sourceType === "SERVICE" && sourceRef) {
    const [serviceName, serviceFieldKey] = sourceRef.split(":");
    const computeFieldKey = serviceFieldKey || fieldKey;
    
    switch (serviceName) {
      case "computeTBField":
        return await computeTBField(computeFieldKey, context);
      case "computeGLField":
        return await computeGLField(computeFieldKey, context);
      case "computeMaterialityField":
        return await computeMaterialityField(computeFieldKey, context);
      case "computeRiskField":
        return await computeRiskField(computeFieldKey, context);
      case "computeSamplingField":
        return await computeSamplingField(computeFieldKey, context);
      case "computeConfirmationField":
        return await computeConfirmationField(computeFieldKey, context);
      case "computeFSHeadField":
        return await computeFSHeadField(computeFieldKey, context);
      case "computeEngagementField":
        return await computeEngagementField(computeFieldKey, context);
      default:
        console.warn(`Unknown service handler: ${serviceName}`);
        return null;
    }
  }

  switch (sourceType) {
    case "TB_COMPUTED":
    case "COMPUTED":
      if (sourceRef?.startsWith("computeTBField:")) {
        return await computeTBField(sourceRef.split(":")[1] || fieldKey, context);
      }
      if (sourceRef?.startsWith("computeGLField:")) {
        return await computeGLField(sourceRef.split(":")[1] || fieldKey, context);
      }
      return await computeTBField(fieldKey, context);
    case "GL_COMPUTED":
      return await computeGLField(fieldKey, context);
    case "MATERIALITY":
      return await computeMaterialityField(fieldKey, context);
    case "RISK_ASSESSMENT":
      return await computeRiskField(fieldKey, context);
    case "SAMPLING":
      return await computeSamplingField(fieldKey, context);
    case "CONFIRMATION":
      return await computeConfirmationField(fieldKey, context);
    default:
      return null;
  }
}

async function logFieldAuditEvent(
  instanceId: string,
  engagementId: string,
  userId: string,
  action: string,
  previousValue: unknown,
  newValue: unknown
): Promise<void> {
  try {
    await prisma.fieldAuditLog.create({
      data: {
        instanceId,
        engagementId,
        userId,
        action,
        beforeJson: previousValue as Prisma.InputJsonValue ?? Prisma.JsonNull,
        afterJson: newValue as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    console.error("Failed to log field audit event:", error);
  }
}

export async function computeFieldValueBySource(
  dataSource: FieldDataSource,
  fieldKey: string,
  context: FetchContext
): Promise<ComputedValue | null> {
  switch (dataSource) {
    case "TB_UPLOAD":
      return await computeTBField(fieldKey, context);
    case "GL_UPLOAD":
      return await computeGLField(fieldKey, context);
    case "MAPPING":
      return await computeMappingField(fieldKey, context);
    default:
      return null;
  }
}

async function computeTBField(fieldKey: string, context: FetchContext): Promise<ComputedValue | null> {
  const tbBatch = await prisma.tBBatch.findFirst({
    where: { engagementId: context.engagementId, status: "APPROVED" },
    orderBy: { createdAt: "desc" },
    include: { entries: true },
  });

  if (!tbBatch) return null;

  switch (fieldKey) {
    case "total_assets":
      return computeTotalByType(tbBatch, ["asset"]);
    case "total_liabilities":
      return computeTotalByType(tbBatch, ["liability"]);
    case "total_equity":
      return computeTotalByType(tbBatch, ["equity"]);
    case "total_revenue":
      return computeTotalByType(tbBatch, ["revenue", "income"]);
    case "total_expenses":
      return computeTotalByType(tbBatch, ["expense"]);
    case "net_income":
      return await computeNetIncome(tbBatch);
    case "tb_entry_count":
      return {
        value: tbBatch.entries.length,
        displayValue: tbBatch.entries.length.toString(),
        sourceRefs: [createTBSourceRef(tbBatch)],
      };
    default:
      return null;
  }
}

function computeTotalByType(
  tbBatch: { id: string; batchName: string; createdAt: Date; entries: Array<{ id: string; accountName: string; accountCode: string; accountType: string | null; closingBalance: Prisma.Decimal }> },
  types: string[]
): ComputedValue {
  const matchingEntries = tbBatch.entries.filter((e) =>
    types.some((t) => 
      e.accountType?.toLowerCase().includes(t) || 
      e.accountName?.toLowerCase().includes(t)
    )
  );

  const total = matchingEntries.reduce((sum, entry) => {
    return sum + Number(entry.closingBalance || 0);
  }, 0);

  return {
    value: total,
    displayValue: formatCurrency(total),
    sourceRefs: [createTBSourceRef(tbBatch)],
    drilldownData: matchingEntries.map((e) => ({
      id: e.id,
      label: e.accountName || e.accountCode,
      value: Number(e.closingBalance || 0),
      metadata: { accountCode: e.accountCode, accountType: e.accountType },
    })),
  };
}

async function computeNetIncome(
  tbBatch: { id: string; batchName: string; createdAt: Date; entries: Array<{ accountType: string | null; accountName: string; closingBalance: Prisma.Decimal }> }
): Promise<ComputedValue> {
  const revenue = tbBatch.entries.filter((e) =>
    e.accountType?.toLowerCase().includes("revenue") ||
    e.accountType?.toLowerCase().includes("income") ||
    e.accountName?.toLowerCase().includes("sales")
  ).reduce((sum, e) => sum + Math.abs(Number(e.closingBalance || 0)), 0);

  const expenses = tbBatch.entries.filter((e) =>
    e.accountType?.toLowerCase().includes("expense") ||
    e.accountName?.toLowerCase().includes("cost")
  ).reduce((sum, e) => sum + Math.abs(Number(e.closingBalance || 0)), 0);

  const netIncome = revenue - expenses;

  return {
    value: netIncome,
    displayValue: formatCurrency(netIncome),
    sourceRefs: [createTBSourceRef(tbBatch)],
  };
}

function createTBSourceRef(tbBatch: { id: string; batchName: string; createdAt: Date }): SourceRef {
  return {
    sourceType: "TB_BATCH",
    sourceId: tbBatch.id,
    sourceLabel: `TB: ${tbBatch.batchName}`,
    timestamp: tbBatch.createdAt,
  };
}

async function computeGLField(fieldKey: string, context: FetchContext): Promise<ComputedValue | null> {
  const glBatch = await prisma.gLBatch.findFirst({
    where: { engagementId: context.engagementId },
    orderBy: { createdAt: "desc" },
  });

  if (!glBatch) return null;

  switch (fieldKey) {
    case "gl_transaction_count":
      const count = await prisma.gLEntry.count({
        where: { batchId: glBatch.id },
      });
      return {
        value: count,
        displayValue: count.toLocaleString(),
        sourceRefs: [
          {
            sourceType: "GL_BATCH",
            sourceId: glBatch.id,
            sourceLabel: `GL: ${glBatch.batchName}`,
            timestamp: glBatch.createdAt,
          },
        ],
      };
    case "gl_journal_count":
      const entries = await prisma.gLEntry.findMany({
        where: { batchId: glBatch.id },
        select: { voucherNumber: true },
        distinct: ["voucherNumber"],
      });
      const journalCount = entries.length;
      return {
        value: journalCount,
        displayValue: journalCount.toLocaleString(),
        sourceRefs: [
          {
            sourceType: "GL_BATCH",
            sourceId: glBatch.id,
            sourceLabel: `GL: ${glBatch.batchName}`,
            timestamp: glBatch.createdAt,
          },
        ],
      };
    default:
      return null;
  }
}

async function computeMappingField(fieldKey: string, context: FetchContext): Promise<ComputedValue | null> {
  return null;
}

async function computeFSHeadField(fieldKey: string, context: FetchContext): Promise<ComputedValue | null> {
  if (!context.scopeId) return null;

  const fsHead = await prisma.fSHead.findUnique({
    where: { id: context.scopeId },
    include: {
      tbEntries: true,
    },
  });

  if (!fsHead) return null;

  const sourceRef: SourceRef = {
    sourceType: "FS_HEAD",
    sourceId: fsHead.id,
    sourceLabel: `FS Head: ${fsHead.caption}`,
    timestamp: fsHead.updatedAt,
  };

  switch (fieldKey) {
    case "opening_balance":
      const openingTotal = fsHead.tbEntries.reduce((sum, e) => sum + Number(e.openingBalance || 0), 0);
      return {
        value: openingTotal,
        displayValue: formatCurrency(openingTotal),
        sourceRefs: [sourceRef],
        drilldownData: fsHead.tbEntries.map(e => ({
          id: e.id,
          label: e.accountName,
          value: Number(e.openingBalance || 0),
          metadata: { accountCode: e.accountCode },
        })),
      };
    case "closing_balance":
      const closingTotal = fsHead.tbEntries.reduce((sum, e) => sum + Number(e.closingBalance || 0), 0);
      return {
        value: closingTotal,
        displayValue: formatCurrency(closingTotal),
        sourceRefs: [sourceRef],
        drilldownData: fsHead.tbEntries.map(e => ({
          id: e.id,
          label: e.accountName,
          value: Number(e.closingBalance || 0),
          metadata: { accountCode: e.accountCode },
        })),
      };
    case "movement_net":
      const opening = fsHead.tbEntries.reduce((sum, e) => sum + Number(e.openingBalance || 0), 0);
      const closing = fsHead.tbEntries.reduce((sum, e) => sum + Number(e.closingBalance || 0), 0);
      const movement = closing - opening;
      return {
        value: movement,
        displayValue: formatCurrency(movement),
        sourceRefs: [sourceRef],
      };
    default:
      return null;
  }
}

async function computeEngagementField(fieldKey: string, context: FetchContext): Promise<ComputedValue | null> {
  const engagement = await prisma.engagement.findUnique({
    where: { id: context.engagementId },
    include: {
      client: true,
      period: true,
      teamMembers: {
        include: { user: true },
        where: { role: "Partner" },
      },
    },
  });

  if (!engagement) return null;

  const sourceRef: SourceRef = {
    sourceType: "ENGAGEMENT",
    sourceId: engagement.id,
    sourceLabel: `Engagement: ${engagement.engagementCode}`,
    timestamp: engagement.updatedAt,
  };

  switch (fieldKey) {
    case "client_name":
      return {
        value: engagement.client?.legalName,
        displayValue: engagement.client?.legalName || "N/A",
        sourceRefs: [sourceRef],
      };
    case "fiscal_year_end":
      const fyeDate = engagement.period?.fiscalYearEnd;
      return {
        value: fyeDate?.toISOString(),
        displayValue: fyeDate ? fyeDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "N/A",
        sourceRefs: [sourceRef],
      };
    case "audit_partner":
      const partner = engagement.teamMembers[0]?.user;
      return {
        value: partner?.id,
        displayValue: partner ? `${partner.firstName} ${partner.lastName}` : "N/A",
        sourceRefs: [sourceRef],
      };
    default:
      return null;
  }
}

async function upsertFieldInstance(
  blueprintId: string,
  context: FetchContext,
  computed: ComputedValue
): Promise<void> {
  const blueprint = await prisma.requiredFieldBlueprint.findUnique({
    where: { id: blueprintId },
  });

  if (!blueprint) return;

  const whereClause: Prisma.RequiredFieldInstanceWhereInput = {
    engagementId: context.engagementId,
    blueprintId,
  };

  if (context.scopeType && context.scopeId) {
    whereClause.scopeType = context.scopeType;
    whereClause.scopeId = context.scopeId;
  }

  const existing = await prisma.requiredFieldInstance.findFirst({
    where: whereClause,
  });

  const data: Prisma.RequiredFieldInstanceUpdateInput = {
    valueJson: computed.value as Prisma.InputJsonValue,
    displayValue: computed.displayValue,
    sourceRef: computed.sourceRefs.length > 0 ? computed.sourceRefs[0].sourceId : null,
    status: "POPULATED" as FieldInstanceStatus,
    updatedById: context.userId,
    scopeType: context.scopeType || null,
    scopeId: context.scopeId || null,
  };

  if (existing) {
    await prisma.requiredFieldInstance.update({
      where: { id: existing.id },
      data,
    });

    await prisma.fieldAuditLog.create({
      data: {
        instanceId: existing.id,
        engagementId: context.engagementId,
        action: "FETCH_REFRESH",
        beforeJson: existing.valueJson ?? Prisma.JsonNull,
        afterJson: computed.value as Prisma.InputJsonValue,
        userId: context.userId,
      },
    });
  } else {
    const newInstance = await prisma.requiredFieldInstance.create({
      data: {
        engagementId: context.engagementId,
        blueprintId,
        module: blueprint.module,
        tab: blueprint.tab,
        fieldKey: blueprint.fieldKey,
        ...data,
      },
    });

    await prisma.fieldAuditLog.create({
      data: {
        instanceId: newInstance.id,
        engagementId: context.engagementId,
        action: "FETCH_CREATE",
        afterJson: computed.value as Prisma.InputJsonValue,
        userId: context.userId,
      },
    });
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export async function getDrilldownData(
  blueprintId: string,
  context: FetchContext
): Promise<DrilldownItem[]> {
  const blueprint = await prisma.requiredFieldBlueprint.findUnique({
    where: { id: blueprintId },
  });

  if (!blueprint) return [];

  const computed = await computeFieldValueBySource(blueprint.dataSource, blueprint.fieldKey, context);
  return computed?.drilldownData || [];
}

export async function overrideFieldValue(
  instanceId: string,
  newValue: unknown,
  overrideReason: string,
  userId: string
): Promise<void> {
  const instance = await prisma.requiredFieldInstance.findUnique({
    where: { id: instanceId },
    include: { blueprint: true },
  });

  if (!instance) {
    throw new Error("Field instance not found");
  }

  if (instance.isLocked) {
    throw new Error("Cannot override locked field");
  }

  const previousValue = instance.valueJson;

  await prisma.requiredFieldInstance.update({
    where: { id: instanceId },
    data: {
      valueJson: newValue as Prisma.InputJsonValue,
      displayValue: String(newValue),
      status: "OVERRIDDEN",
      overrideSnapshot: previousValue ?? Prisma.JsonNull,
      overrideReason,
      updatedById: userId,
    },
  });

  await prisma.fieldAuditLog.create({
    data: {
      instanceId,
      engagementId: instance.engagementId,
      action: "OVERRIDE",
      beforeJson: previousValue ?? Prisma.JsonNull,
      afterJson: newValue as Prisma.InputJsonValue,
      userId,
      sourceType: "USER_OVERRIDE",
      sourceRef: overrideReason,
    },
  });
}

export async function lockField(
  instanceId: string,
  lockReason: string,
  userId: string
): Promise<void> {
  const instance = await prisma.requiredFieldInstance.findUnique({
    where: { id: instanceId },
  });

  if (!instance) {
    throw new Error("Field instance not found");
  }

  await prisma.requiredFieldInstance.update({
    where: { id: instanceId },
    data: {
      isLocked: true,
      lockedById: userId,
      lockedAt: new Date(),
      lockReason,
    },
  });

  await prisma.fieldAuditLog.create({
    data: {
      instanceId,
      engagementId: instance.engagementId,
      action: "LOCK",
      userId,
      sourceRef: lockReason,
    },
  });
}

export async function unlockField(instanceId: string, userId: string): Promise<void> {
  const instance = await prisma.requiredFieldInstance.findUnique({
    where: { id: instanceId },
  });

  if (!instance) {
    throw new Error("Field instance not found");
  }

  await prisma.requiredFieldInstance.update({
    where: { id: instanceId },
    data: {
      isLocked: false,
      lockedById: null,
      lockedAt: null,
      lockReason: null,
    },
  });

  await prisma.fieldAuditLog.create({
    data: {
      instanceId,
      engagementId: instance.engagementId,
      action: "UNLOCK",
      userId,
    },
  });
}

export async function getFieldAuditHistory(
  engagementId: string,
  fieldKey?: string
): Promise<Array<{
  id: string;
  action: string;
  beforeJson: unknown;
  afterJson: unknown;
  userId: string;
  createdAt: Date;
}>> {
  const logs = await prisma.fieldAuditLog.findMany({
    where: { engagementId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return logs.map((log) => ({
    id: log.id,
    action: log.action,
    beforeJson: log.beforeJson,
    afterJson: log.afterJson,
    userId: log.userId,
    createdAt: log.createdAt,
  }));
}

export async function signOffField(
  instanceId: string,
  signOffLevel: "PREPARED" | "REVIEWED" | "APPROVED",
  userId: string
): Promise<void> {
  const instance = await prisma.requiredFieldInstance.findUnique({
    where: { id: instanceId },
  });

  if (!instance) {
    throw new Error("Field instance not found");
  }

  const updateData: Prisma.RequiredFieldInstanceUpdateInput = {
    signOffLevel,
  };

  switch (signOffLevel) {
    case "PREPARED":
      updateData.preparedBy = { connect: { id: userId } };
      updateData.preparedAt = new Date();
      break;
    case "REVIEWED":
      updateData.reviewedBy = { connect: { id: userId } };
      updateData.reviewedAt = new Date();
      break;
    case "APPROVED":
      updateData.approvedBy = { connect: { id: userId } };
      updateData.approvedAt = new Date();
      break;
  }

  await prisma.requiredFieldInstance.update({
    where: { id: instanceId },
    data: updateData,
  });

  await prisma.fieldAuditLog.create({
    data: {
      instanceId,
      engagementId: instance.engagementId,
      action: `SIGN_OFF_${signOffLevel}`,
      userId,
    },
  });
}
