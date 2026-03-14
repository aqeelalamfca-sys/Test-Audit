/**
 * @deprecated LEGACY — sub-tab phase engine for data intake workflow.
 * Retained for the information-requisition page tab management.
 * New phase logic should use shared/phases.ts + phaseGateEngine.ts.
 */
import { prisma } from "../db";

type WorkflowTabKey = 'summary' | 'tb' | 'gl' | 'ap' | 'ar' | 'bank' | 'confirmations' | 'mapping' | 'draft-fs';
type TabStatus = 'NOT_STARTED' | 'BLOCKED' | 'READY' | 'IN_PROGRESS' | 'COMPLETED' | 'NEEDS_REVIEW';

interface TabPhaseState {
  tabKey: WorkflowTabKey;
  status: TabStatus;
  version: number;
  lastCompletedAt: string | null;
  lastModifiedAt: string | null;
  upstreamDirty: boolean;
  upstreamChangedTabs: WorkflowTabKey[];
  gatesPassed: boolean;
  outputVersion: number;
  completionPercent: number;
}

interface PhaseEngineState {
  tabs: Record<WorkflowTabKey, TabPhaseState>;
  activeTab: WorkflowTabKey;
  canProceed: boolean;
  blockingReasons: string[];
  lastComputedAt: string;
}

const TAB_ORDER: WorkflowTabKey[] = ['summary', 'tb', 'gl', 'ap', 'ar', 'bank', 'confirmations', 'mapping', 'draft-fs'];

const TAB_DEPENDENCIES: Record<WorkflowTabKey, WorkflowTabKey[]> = {
  'summary': [],
  'tb': ['summary'],
  'gl': ['summary'],
  'ap': ['summary'],
  'ar': ['summary'],
  'bank': ['summary'],
  'confirmations': ['ap', 'ar', 'bank'],
  'mapping': ['tb', 'gl'],
  'draft-fs': ['mapping', 'tb'],
};

export async function computePhaseEngine(engagementId: string): Promise<PhaseEngineState> {
  const [uploadVersion, tbBatch, glBatch, importBatch, summaryRun] = await Promise.all([
    prisma.uploadVersion.findFirst({
      where: { engagementId, status: 'ACTIVE' },
      select: { id: true, createdAt: true, updatedAt: true },
    }),
    prisma.tBBatch.findFirst({
      where: { engagementId },
      select: { id: true, createdAt: true, updatedAt: true },
    }),
    prisma.gLBatch.findFirst({
      where: { engagementId },
      select: { id: true, createdAt: true, updatedAt: true },
    }),
    prisma.importBatch.findFirst({
      where: { engagementId, status: 'READY' },
      select: { id: true, createdAt: true, updatedAt: true },
    }),
    prisma.summaryRun.findFirst({
      where: { engagementId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, createdAt: true,
        overallStatus: true,
        tbRowCount: true, glEntryCount: true,
        apRowCount: true, arRowCount: true, bankRowCount: true,
      },
    }),
  ]);

  const [tbCount, glCount, apCount, arCount, bankAccounts, bankBalances, coaMappingCount, totalCoaAccounts] = await Promise.all([
    tbBatch ? prisma.tBEntry.count({ where: { batchId: tbBatch.id } }) : 0,
    glBatch ? prisma.gLEntry.count({ where: { batchId: glBatch.id } }) : 0,
    prisma.importPartyBalance.count({ where: { engagementId, partyType: 'VENDOR' } }),
    prisma.importPartyBalance.count({ where: { engagementId, partyType: 'CUSTOMER' } }),
    prisma.importBankAccount.count({ where: { engagementId } }),
    prisma.importBankBalance.count({ where: { engagementId } }),
    prisma.coAAccount.count({ where: { engagementId, fsLineItem: { not: null } } }),
    prisma.coAAccount.count({ where: { engagementId } }),
  ]);

  const hasUpload = !!uploadVersion;
  const hasSummary = !!summaryRun;
  const summaryPassed = summaryRun?.overallStatus === 'PASS';
  const hasTB = tbCount > 0;
  const hasGL = glCount > 0;
  const hasAP = apCount > 0;
  const hasAR = arCount > 0;
  const hasBank = bankAccounts > 0;
  const hasBankBalances = bankBalances > 0;
  const mappingComplete = totalCoaAccounts > 0 && coaMappingCount === totalCoaAccounts;
  const mappingStarted = coaMappingCount > 0;

  const uploadTime = uploadVersion?.createdAt?.toISOString() || null;
  const summaryTime = summaryRun?.createdAt?.toISOString() || null;

  function makeDefault(key: WorkflowTabKey): TabPhaseState {
    return {
      tabKey: key,
      status: 'NOT_STARTED',
      version: 0,
      lastCompletedAt: null,
      lastModifiedAt: null,
      upstreamDirty: false,
      upstreamChangedTabs: [],
      gatesPassed: false,
      outputVersion: 0,
      completionPercent: 0,
    };
  }

  const tabs: Record<WorkflowTabKey, TabPhaseState> = {} as any;
  for (const key of TAB_ORDER) {
    tabs[key] = makeDefault(key);
  }

  // Summary tab
  if (!hasUpload) {
    tabs.summary.status = 'READY';
    tabs.summary.completionPercent = 0;
  } else if (hasSummary && summaryPassed) {
    tabs.summary.status = 'COMPLETED';
    tabs.summary.completionPercent = 100;
    tabs.summary.lastCompletedAt = summaryTime;
    tabs.summary.gatesPassed = true;
    tabs.summary.version = 1;
    tabs.summary.outputVersion = 1;
  } else if (hasSummary) {
    tabs.summary.status = 'NEEDS_REVIEW';
    tabs.summary.completionPercent = 80;
    tabs.summary.lastModifiedAt = summaryTime;
    tabs.summary.version = 1;
  } else {
    tabs.summary.status = 'IN_PROGRESS';
    tabs.summary.completionPercent = 30;
    tabs.summary.lastModifiedAt = uploadTime;
  }

  // TB tab
  if (!hasSummary) {
    tabs.tb.status = 'BLOCKED';
  } else if (hasTB) {
    tabs.tb.status = 'COMPLETED';
    tabs.tb.completionPercent = 100;
    tabs.tb.gatesPassed = true;
    tabs.tb.version = 1;
    tabs.tb.outputVersion = 1;
    tabs.tb.lastCompletedAt = tbBatch?.createdAt?.toISOString() || null;
  } else {
    tabs.tb.status = 'READY';
  }

  // GL tab
  if (!hasSummary) {
    tabs.gl.status = 'BLOCKED';
  } else if (hasGL) {
    tabs.gl.status = 'COMPLETED';
    tabs.gl.completionPercent = 100;
    tabs.gl.gatesPassed = true;
    tabs.gl.version = 1;
    tabs.gl.outputVersion = 1;
    tabs.gl.lastCompletedAt = glBatch?.createdAt?.toISOString() || null;
  } else {
    tabs.gl.status = 'READY';
  }

  // AP tab
  if (!hasSummary) {
    tabs.ap.status = 'BLOCKED';
  } else if (hasAP) {
    tabs.ap.status = 'COMPLETED';
    tabs.ap.completionPercent = 100;
    tabs.ap.gatesPassed = true;
    tabs.ap.version = 1;
    tabs.ap.outputVersion = 1;
  } else {
    tabs.ap.status = 'READY';
  }

  // AR tab
  if (!hasSummary) {
    tabs.ar.status = 'BLOCKED';
  } else if (hasAR) {
    tabs.ar.status = 'COMPLETED';
    tabs.ar.completionPercent = 100;
    tabs.ar.gatesPassed = true;
    tabs.ar.version = 1;
    tabs.ar.outputVersion = 1;
  } else {
    tabs.ar.status = 'READY';
  }

  // Bank tab
  if (!hasSummary) {
    tabs.bank.status = 'BLOCKED';
  } else if (hasBank && hasBankBalances) {
    tabs.bank.status = 'COMPLETED';
    tabs.bank.completionPercent = 100;
    tabs.bank.gatesPassed = true;
    tabs.bank.version = 1;
    tabs.bank.outputVersion = 1;
  } else if (hasBank) {
    tabs.bank.status = 'IN_PROGRESS';
    tabs.bank.completionPercent = 50;
  } else {
    tabs.bank.status = 'READY';
  }

  // Confirmations tab
  const confirmDeps = [tabs.ap, tabs.ar, tabs.bank];
  const anyConfirmDepReady = confirmDeps.some(d => d.status === 'COMPLETED' || d.status === 'READY');
  if (!hasSummary) {
    tabs.confirmations.status = 'BLOCKED';
  } else if (anyConfirmDepReady) {
    tabs.confirmations.status = 'READY';
    tabs.confirmations.completionPercent = 0;
  } else {
    tabs.confirmations.status = 'NOT_STARTED';
  }

  // Mapping tab
  if (!hasTB) {
    tabs.mapping.status = 'BLOCKED';
  } else if (mappingComplete) {
    tabs.mapping.status = 'COMPLETED';
    tabs.mapping.completionPercent = 100;
    tabs.mapping.gatesPassed = true;
    tabs.mapping.version = 1;
    tabs.mapping.outputVersion = 1;
  } else if (mappingStarted) {
    tabs.mapping.status = 'IN_PROGRESS';
    tabs.mapping.completionPercent = totalCoaAccounts > 0
      ? Math.round((coaMappingCount / totalCoaAccounts) * 100)
      : 0;
  } else {
    tabs.mapping.status = 'READY';
  }

  // Draft FS tab
  if (!mappingComplete || !hasTB) {
    tabs['draft-fs'].status = 'BLOCKED';
  } else {
    tabs['draft-fs'].status = 'READY';
  }

  // Upstream dirty detection
  if (uploadVersion && summaryRun) {
    const uploadDate = uploadVersion.updatedAt || uploadVersion.createdAt;
    const summaryDate = summaryRun.createdAt;
    if (uploadDate > summaryDate) {
      for (const key of TAB_ORDER) {
        if (key !== 'summary') {
          tabs[key].upstreamDirty = true;
          tabs[key].upstreamChangedTabs = ['summary'];
          if (tabs[key].status === 'COMPLETED') {
            tabs[key].status = 'NEEDS_REVIEW';
          }
        }
      }
    }
  }

  // Determine active tab and blocking reasons
  let activeTab: WorkflowTabKey = 'summary';
  const blockingReasons: string[] = [];

  for (const key of TAB_ORDER) {
    if (tabs[key].status === 'IN_PROGRESS' || tabs[key].status === 'READY') {
      activeTab = key;
      break;
    }
    if (tabs[key].status === 'NEEDS_REVIEW') {
      activeTab = key;
      break;
    }
  }

  if (!hasUpload && !hasSummary) {
    blockingReasons.push('Upload an Excel file to begin the workflow.');
  }
  if (tabs.mapping.status === 'BLOCKED') {
    blockingReasons.push('Complete TB upload before mapping can begin.');
  }
  if (tabs['draft-fs'].status === 'BLOCKED') {
    blockingReasons.push('Complete all account mappings before generating Draft FS.');
  }

  const canProceed = blockingReasons.length === 0;

  return {
    tabs,
    activeTab,
    canProceed,
    blockingReasons,
    lastComputedAt: new Date().toISOString(),
  };
}
