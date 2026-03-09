import { prisma } from "../db";
import type { AuditPhase } from "@prisma/client";
import crypto from "crypto";

export interface IntegrityIssue {
  id: string;
  severity: 'HIGH' | 'MED';
  category: 'ORPHAN_RECORD' | 'MAPPING_BREAK' | 'PHASE_INCONSISTENCY' | 'DATA_MISSING' | 'REFERENCE_BROKEN';
  module: string;
  description: string;
  affectedEntity: string;
  affectedId: string;
  autoRepairable: boolean;
  repairAction?: string;
  beforeState?: any;
  afterState?: any;
  status: 'DETECTED' | 'AUTO_REPAIRED' | 'NEEDS_REVIEW' | 'RESOLVED';
}

export interface ScanResult {
  engagementId: string;
  timestamp: Date;
  issues: IntegrityIssue[];
  summary: {
    total: number;
    high: number;
    med: number;
    autoRepairable: number;
    needsReview: number;
    byCategory: Record<string, number>;
  };
}

const ALL_PHASES: AuditPhase[] = [
  "ONBOARDING",
  "PRE_PLANNING",
  "REQUISITION",
  "PLANNING",
  "EXECUTION",
  "FINALIZATION",
  "REPORTING",
  "EQCR",
  "INSPECTION",
];

function makeIssueId(): string {
  return `LI-${crypto.randomBytes(6).toString('hex')}`;
}

const issueStore = new Map<string, IntegrityIssue[]>();

function getStoredIssues(engagementId: string): IntegrityIssue[] {
  return issueStore.get(engagementId) || [];
}

function storeIssues(engagementId: string, issues: IntegrityIssue[]): void {
  issueStore.set(engagementId, issues);
}

export async function scanOrphanRecords(engagementId: string): Promise<IntegrityIssue[]> {
  const issues: IntegrityIssue[] = [];

  try {
    const evidenceFiles = await prisma.evidenceFile.findMany({
      where: { engagementId },
      select: { id: true, fileName: true, fileReference: true },
    });

    for (const ef of evidenceFiles) {
      let linked = false;
      try {
        const linkCount = await (prisma as any).evidenceProcedureLink?.count({
          where: { evidenceFileId: ef.id },
        });
        linked = (linkCount ?? 1) > 0;
      } catch {
        linked = true;
      }
      if (!linked) {
        issues.push({
          id: makeIssueId(),
          severity: 'MED',
          category: 'ORPHAN_RECORD',
          module: 'Evidence',
          description: `Evidence file "${ef.fileName}" (ref: ${ef.fileReference}) has no linked audit procedure`,
          affectedEntity: 'EvidenceFile',
          affectedId: ef.id,
          autoRepairable: false,
          repairAction: 'Link evidence to appropriate audit procedure or mark as general engagement document',
          status: 'NEEDS_REVIEW',
        });
      }
    }
  } catch {
    // EvidenceFile table may not have data
  }

  try {
    const riskAssessments = await prisma.riskAssessment.findMany({
      where: { engagementId },
      select: { id: true, accountOrClass: true, riskDescription: true },
    });

    const engagement = await prisma.engagement.findUnique({ where: { id: engagementId } });
    if (!engagement) {
      issues.push({
        id: makeIssueId(),
        severity: 'HIGH',
        category: 'ORPHAN_RECORD',
        module: 'Engagement',
        description: `Engagement ${engagementId} not found in the system`,
        affectedEntity: 'Engagement',
        affectedId: engagementId,
        autoRepairable: false,
        status: 'DETECTED',
      });
    }
  } catch {
    // Risk assessment table may not exist
  }

  try {
    const fsHeadWPs = await (prisma as any).fSHeadWorkingPaper?.findMany({
      where: { engagementId },
      select: { id: true, fsHeadKey: true, fsHeadName: true },
    });

    if (fsHeadWPs) {
      for (const wp of fsHeadWPs) {
        try {
          const fsHead = await prisma.fSHead.findFirst({
            where: { engagementId, code: wp.fsHeadKey },
          });
          if (!fsHead) {
            issues.push({
              id: makeIssueId(),
              severity: 'MED',
              category: 'REFERENCE_BROKEN',
              module: 'FSHeadWorkingPaper',
              description: `Working paper "${wp.fsHeadName}" references FS Head code "${wp.fsHeadKey}" which does not exist`,
              affectedEntity: 'FSHeadWorkingPaper',
              affectedId: wp.id,
              autoRepairable: false,
              repairAction: 'Create matching FS Head or update working paper reference',
              status: 'NEEDS_REVIEW',
            });
          }
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // FSHeadWorkingPaper may not exist
  }

  return issues;
}

export async function scanMappingTieouts(engagementId: string): Promise<IntegrityIssue[]> {
  const issues: IntegrityIssue[] = [];

  try {
    const fsHeads = await prisma.fSHead.findMany({
      where: { engagementId, isActive: true },
      include: { lines: true },
    });

    for (const head of fsHeads) {
      if (!head.lines || head.lines.length === 0) {
        issues.push({
          id: makeIssueId(),
          severity: 'MED',
          category: 'MAPPING_BREAK',
          module: 'FSHead',
          description: `FS Head "${head.name}" (${head.code}) has no mapped COA/TB line items`,
          affectedEntity: 'FSHead',
          affectedId: head.id,
          autoRepairable: false,
          repairAction: 'Map COA accounts to this FS Head through the mapping interface',
          status: 'NEEDS_REVIEW',
        });
      }
    }
  } catch {
    // FSHead table may not have data
  }

  try {
    const trialBalances = await prisma.trialBalance.findMany({
      where: { engagementId },
      include: { lineItems: true },
    });

    for (const tb of trialBalances) {
      if (tb.lineItems) {
        for (const line of tb.lineItems) {
          try {
            const matchingFSHead = await prisma.fSHead.findFirst({
              where: { engagementId },
              include: {
                lines: {
                  where: { accountCode: line.accountCode },
                },
              },
            });
            const hasMapping = matchingFSHead && matchingFSHead.lines && matchingFSHead.lines.length > 0;
            if (!hasMapping) {
              issues.push({
                id: makeIssueId(),
                severity: 'HIGH',
                category: 'MAPPING_BREAK',
                module: 'TrialBalance',
                description: `TB line "${line.accountName}" (code: ${line.accountCode}) has no matching FS Head mapping`,
                affectedEntity: 'TrialBalanceLine',
                affectedId: line.id,
                autoRepairable: false,
                repairAction: 'Map this account code to an appropriate FS Head',
                status: 'DETECTED',
              });
            }
          } catch {
            // ignore individual line check failures
          }
        }
      }
    }
  } catch {
    // TB table may not exist or have data
  }

  return issues;
}

export async function scanPhaseConsistency(engagementId: string): Promise<IntegrityIssue[]> {
  const issues: IntegrityIssue[] = [];

  try {
    const existingPhases = await prisma.phaseProgress.findMany({
      where: { engagementId },
    });

    const existingPhaseSet = new Set(existingPhases.map(p => p.phase));

    for (const phase of ALL_PHASES) {
      if (!existingPhaseSet.has(phase)) {
        issues.push({
          id: makeIssueId(),
          severity: 'HIGH',
          category: 'PHASE_INCONSISTENCY',
          module: 'PhaseProgress',
          description: `Phase progress record for "${phase}" is missing`,
          affectedEntity: 'PhaseProgress',
          affectedId: `${engagementId}:${phase}`,
          autoRepairable: true,
          repairAction: `Create PhaseProgress record for ${phase} with NOT_STARTED status`,
          beforeState: null,
          afterState: { phase, status: 'NOT_STARTED', completionPercentage: 0 },
          status: 'DETECTED',
        });
      }
    }

    let previousPhaseCompleted = true;
    for (const phase of ALL_PHASES) {
      const record = existingPhases.find(p => p.phase === phase);
      if (record) {
        const isActive = ["IN_PROGRESS", "UNDER_REVIEW", "COMPLETED", "LOCKED"].includes(record.status);
        if (isActive && !previousPhaseCompleted && phase !== "ONBOARDING") {
          issues.push({
            id: makeIssueId(),
            severity: 'MED',
            category: 'PHASE_INCONSISTENCY',
            module: 'PhaseProgress',
            description: `Phase "${phase}" is ${record.status} but a prior phase was not completed`,
            affectedEntity: 'PhaseProgress',
            affectedId: record.id,
            autoRepairable: false,
            repairAction: 'Review phase sequence and ensure prior phases are properly completed',
            status: 'NEEDS_REVIEW',
          });
        }
        previousPhaseCompleted = record.status === "COMPLETED" || record.status === "LOCKED";
      } else {
        previousPhaseCompleted = false;
      }
    }
  } catch {
    // PhaseProgress table may not exist
  }

  return issues;
}

export async function scanDataCompleteness(engagementId: string): Promise<IntegrityIssue[]> {
  const issues: IntegrityIssue[] = [];

  try {
    const phases = await prisma.phaseProgress.findMany({ where: { engagementId } });
    const statusMap = new Map(phases.map(p => [p.phase, p.status]));

    const planningStatus = statusMap.get("PLANNING");
    if (planningStatus && ["IN_PROGRESS", "COMPLETED", "LOCKED"].includes(planningStatus)) {
      try {
        const tbCount = await prisma.trialBalance.count({ where: { engagementId } });
        if (tbCount === 0) {
          issues.push({
            id: makeIssueId(),
            severity: 'HIGH',
            category: 'DATA_MISSING',
            module: 'TrialBalance',
            description: 'PLANNING phase is active but no Trial Balance data has been uploaded',
            affectedEntity: 'TrialBalance',
            affectedId: engagementId,
            autoRepairable: false,
            repairAction: 'Upload Trial Balance data through the Data Intake module',
            status: 'DETECTED',
          });
        }
      } catch {
        // TB table may not exist
      }

      try {
        const fsHeadCount = await prisma.fSHead.count({ where: { engagementId } });
        if (fsHeadCount === 0) {
          issues.push({
            id: makeIssueId(),
            severity: 'HIGH',
            category: 'DATA_MISSING',
            module: 'FSHead',
            description: 'PLANNING phase is active but no FS Heads have been defined',
            affectedEntity: 'FSHead',
            affectedId: engagementId,
            autoRepairable: false,
            repairAction: 'Define FS Head structure through the FS Head management interface',
            status: 'DETECTED',
          });
        }
      } catch {
        // FSHead table may not exist
      }
    }

    const executionStatus = statusMap.get("EXECUTION");
    if (executionStatus && ["IN_PROGRESS", "COMPLETED", "LOCKED"].includes(executionStatus)) {
      try {
        const riskCount = await prisma.riskAssessment.count({ where: { engagementId } });
        if (riskCount === 0) {
          issues.push({
            id: makeIssueId(),
            severity: 'HIGH',
            category: 'DATA_MISSING',
            module: 'RiskAssessment',
            description: 'EXECUTION phase is active but no Risk Assessments have been performed',
            affectedEntity: 'RiskAssessment',
            affectedId: engagementId,
            autoRepairable: false,
            repairAction: 'Complete risk assessment in the Planning phase before proceeding',
            status: 'DETECTED',
          });
        }
      } catch {
        // RiskAssessment table may not exist
      }
    }

    const finalizationStatus = statusMap.get("FINALIZATION");
    if (finalizationStatus && ["IN_PROGRESS", "COMPLETED", "LOCKED"].includes(finalizationStatus)) {
      try {
        const evidenceCount = await prisma.evidenceFile.count({ where: { engagementId } });
        if (evidenceCount === 0) {
          issues.push({
            id: makeIssueId(),
            severity: 'MED',
            category: 'DATA_MISSING',
            module: 'Evidence',
            description: 'FINALIZATION phase is active but no evidence files have been uploaded',
            affectedEntity: 'EvidenceFile',
            affectedId: engagementId,
            autoRepairable: false,
            repairAction: 'Upload supporting evidence files',
            status: 'DETECTED',
          });
        }
      } catch {
        // EvidenceFile table may not exist
      }
    }
  } catch {
    // PhaseProgress table may not exist
  }

  return issues;
}

export async function repairIssue(engagementId: string, issueId: string): Promise<IntegrityIssue | null> {
  const storedIssues = getStoredIssues(engagementId);
  const issue = storedIssues.find(i => i.id === issueId);
  if (!issue) return null;
  if (!issue.autoRepairable) {
    issue.status = 'NEEDS_REVIEW';
    storeIssues(engagementId, storedIssues);
    return issue;
  }

  try {
    if (issue.category === 'PHASE_INCONSISTENCY' && issue.affectedEntity === 'PhaseProgress') {
      const phaseName = issue.affectedId.split(':')[1] as AuditPhase;
      if (phaseName) {
        const existing = await prisma.phaseProgress.findFirst({
          where: { engagementId, phase: phaseName },
        });
        if (!existing) {
          await prisma.phaseProgress.create({
            data: {
              engagementId,
              phase: phaseName,
              status: 'NOT_STARTED',
              completionPercentage: 0,
            },
          });
          issue.status = 'AUTO_REPAIRED';
          issue.afterState = { phase: phaseName, status: 'NOT_STARTED', completionPercentage: 0 };
        } else {
          issue.status = 'RESOLVED';
        }
      }
    }
  } catch (err) {
    console.error(`Auto-repair failed for issue ${issueId}:`, err);
    issue.status = 'NEEDS_REVIEW';
  }

  storeIssues(engagementId, storedIssues);
  return issue;
}

export async function repairAllAutoRepairable(engagementId: string): Promise<IntegrityIssue[]> {
  const storedIssues = getStoredIssues(engagementId);
  const repairable = storedIssues.filter(i => i.autoRepairable && i.status === 'DETECTED');
  const results: IntegrityIssue[] = [];

  for (const issue of repairable) {
    const repaired = await repairIssue(engagementId, issue.id);
    if (repaired) results.push(repaired);
  }

  return results;
}

export async function acknowledgeIssue(engagementId: string, issueId: string): Promise<IntegrityIssue | null> {
  const storedIssues = getStoredIssues(engagementId);
  const issue = storedIssues.find(i => i.id === issueId);
  if (!issue) return null;
  issue.status = 'RESOLVED';
  storeIssues(engagementId, storedIssues);
  return issue;
}

export async function runFullScan(engagementId: string): Promise<ScanResult> {
  const [orphans, mappings, phaseConsistency, dataCompleteness] = await Promise.all([
    scanOrphanRecords(engagementId),
    scanMappingTieouts(engagementId),
    scanPhaseConsistency(engagementId),
    scanDataCompleteness(engagementId),
  ]);

  const allIssues = [...orphans, ...mappings, ...phaseConsistency, ...dataCompleteness];

  storeIssues(engagementId, allIssues);

  const byCategory: Record<string, number> = {};
  for (const issue of allIssues) {
    byCategory[issue.category] = (byCategory[issue.category] || 0) + 1;
  }

  return {
    engagementId,
    timestamp: new Date(),
    issues: allIssues,
    summary: {
      total: allIssues.length,
      high: allIssues.filter(i => i.severity === 'HIGH').length,
      med: allIssues.filter(i => i.severity === 'MED').length,
      autoRepairable: allIssues.filter(i => i.autoRepairable).length,
      needsReview: allIssues.filter(i => i.status === 'NEEDS_REVIEW').length,
      byCategory,
    },
  };
}

export const linkIntegrityEngine = {
  scanOrphanRecords,
  scanMappingTieouts,
  scanPhaseConsistency,
  scanDataCompleteness,
  runFullScan,
  repairIssue,
  repairAllAutoRepairable,
  acknowledgeIssue,
  getStoredIssues,
};
