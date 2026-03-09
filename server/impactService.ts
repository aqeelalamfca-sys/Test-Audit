import { prisma } from "./db";

const db = prisma as any;

export enum ImpactSeverity {
  INFO = "INFO",
  WARNING = "WARNING",
  CRITICAL = "CRITICAL",
}

export enum ImpactStatus {
  PENDING = "PENDING",
  ACKNOWLEDGED = "ACKNOWLEDGED",
  RECOMPUTED = "RECOMPUTED",
  IGNORED = "IGNORED",
}

export interface ImpactTarget {
  module: string;
  entityType?: string;
  entityId?: string;
  description: string;
  severity?: ImpactSeverity;
  requiresRecompute?: boolean;
  autoRecomputable?: boolean;
}

export interface RegisterImpactParams {
  engagementId: string;
  sourceType: string;
  sourceId: string;
  sourceVersion?: number;
  changeType: string;
  changeDescription: string;
  targets: ImpactTarget[];
}

export interface ImpactFilters {
  status?: ImpactStatus;
  severity?: ImpactSeverity;
  sourceType?: string;
  impactedModule?: string;
  requiresRecompute?: boolean;
}

export async function registerImpact(params: RegisterImpactParams): Promise<any[]> {
  const {
    engagementId,
    sourceType,
    sourceId,
    sourceVersion,
    changeType,
    changeDescription,
    targets,
  } = params;

  const createdImpacts = await Promise.all(
    targets.map((target) =>
      db.upstreamImpact.create({
        data: {
          engagementId,
          sourceType,
          sourceId,
          sourceVersion,
          changeType,
          changeDescription,
          impactedModule: target.module,
          impactedEntityType: target.entityType,
          impactedEntityId: target.entityId,
          impactDescription: target.description,
          severity: target.severity || ImpactSeverity.WARNING,
          status: ImpactStatus.PENDING,
          requiresRecompute: target.requiresRecompute ?? true,
          autoRecomputable: target.autoRecomputable ?? false,
        },
      })
    )
  );

  return createdImpacts;
}

export async function getImpactsByEngagement(
  engagementId: string,
  filters?: ImpactFilters
): Promise<any[]> {
  const where: any = { engagementId };

  if (filters?.status) {
    where.status = filters.status;
  }
  if (filters?.severity) {
    where.severity = filters.severity;
  }
  if (filters?.sourceType) {
    where.sourceType = filters.sourceType;
  }
  if (filters?.impactedModule) {
    where.impactedModule = filters.impactedModule;
  }
  if (filters?.requiresRecompute !== undefined) {
    where.requiresRecompute = filters.requiresRecompute;
  }

  return db.upstreamImpact.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
  });
}

export async function getImpactById(impactId: string): Promise<any | null> {
  return db.upstreamImpact.findUnique({
    where: { id: impactId },
  });
}

export async function acknowledgeImpact(
  impactId: string,
  userId: string
): Promise<any> {
  return db.upstreamImpact.update({
    where: { id: impactId },
    data: {
      status: ImpactStatus.ACKNOWLEDGED,
      acknowledgedAt: new Date(),
      acknowledgedById: userId,
    },
  });
}

export async function resolveImpact(
  impactId: string,
  userId: string
): Promise<any> {
  return db.upstreamImpact.update({
    where: { id: impactId },
    data: {
      status: ImpactStatus.RECOMPUTED,
      recomputedAt: new Date(),
      recomputedById: userId,
    },
  });
}

export async function ignoreImpact(
  impactId: string,
  userId: string,
  reason: string
): Promise<any> {
  return db.upstreamImpact.update({
    where: { id: impactId },
    data: {
      status: ImpactStatus.IGNORED,
      ignoredAt: new Date(),
      ignoredById: userId,
      ignoreReason: reason,
    },
  });
}

export async function getUnresolvedCount(engagementId: string): Promise<number> {
  return db.upstreamImpact.count({
    where: {
      engagementId,
      status: ImpactStatus.PENDING,
    },
  });
}

export async function checkImpact(
  impactedEntityType: string,
  impactedEntityId: string,
  engagementId: string
): Promise<{ hasUnresolved: boolean; count: number; impacts: any[] }> {
  const impacts = await db.upstreamImpact.findMany({
    where: {
      engagementId,
      impactedEntityType,
      impactedEntityId,
      status: {
        in: [ImpactStatus.PENDING, ImpactStatus.ACKNOWLEDGED],
      },
    },
  });

  return {
    hasUnresolved: impacts.length > 0,
    count: impacts.length,
    impacts,
  };
}

export async function getImpactSummary(engagementId: string): Promise<{
  total: number;
  pending: number;
  acknowledged: number;
  recomputed: number;
  ignored: number;
  bySeverity: Record<string, number>;
  bySourceType: Record<string, number>;
  byModule: Record<string, number>;
  requiresRecomputeCount: number;
}> {
  const impacts = await db.upstreamImpact.findMany({
    where: { engagementId },
    select: {
      status: true,
      severity: true,
      sourceType: true,
      impactedModule: true,
      requiresRecompute: true,
    },
  });

  const summary = {
    total: impacts.length,
    pending: 0,
    acknowledged: 0,
    recomputed: 0,
    ignored: 0,
    bySeverity: {} as Record<string, number>,
    bySourceType: {} as Record<string, number>,
    byModule: {} as Record<string, number>,
    requiresRecomputeCount: 0,
  };

  for (const impact of impacts) {
    switch (impact.status) {
      case ImpactStatus.PENDING:
        summary.pending++;
        break;
      case ImpactStatus.ACKNOWLEDGED:
        summary.acknowledged++;
        break;
      case ImpactStatus.RECOMPUTED:
        summary.recomputed++;
        break;
      case ImpactStatus.IGNORED:
        summary.ignored++;
        break;
    }

    summary.bySeverity[impact.severity] =
      (summary.bySeverity[impact.severity] || 0) + 1;
    summary.bySourceType[impact.sourceType] =
      (summary.bySourceType[impact.sourceType] || 0) + 1;
    summary.byModule[impact.impactedModule] =
      (summary.byModule[impact.impactedModule] || 0) + 1;

    if (impact.requiresRecompute && impact.status === ImpactStatus.PENDING) {
      summary.requiresRecomputeCount++;
    }
  }

  return summary;
}

export async function bulkResolveImpacts(
  impactIds: string[],
  userId: string
): Promise<{ updated: number }> {
  const result = await db.upstreamImpact.updateMany({
    where: {
      id: { in: impactIds },
      status: { in: [ImpactStatus.PENDING, ImpactStatus.ACKNOWLEDGED] },
    },
    data: {
      status: ImpactStatus.RECOMPUTED,
      recomputedAt: new Date(),
      recomputedById: userId,
    },
  });

  return { updated: result.count };
}
