import { Router, Response } from "express";
import { prisma } from "./db";
import { requireAuth, type AuthenticatedRequest } from "./auth";

const router = Router();

type LinkStatus = 'OK' | 'BROKEN' | 'AUTO_REPAIRED' | 'NEEDS_REVIEW' | 'LOCKED' | 'INACTIVE';
type LockType = 'NONE' | 'SOFT' | 'HARD' | 'ARCHIVE';

interface CanonicalChainNode {
  id: string;
  type: ChainNodeType;
  track: 'FS_LEVEL' | 'ASSERTION';
  status: LinkStatus;
  lockType: LockType;
  version: number;
  forwardLinks: string[];
  backwardLinks: string[];
  data: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  inactiveReason?: string;
}

type ChainNodeType = 
  | 'ENTITY_UNDERSTANDING' | 'FS_LEVEL_RISK' | 'OVERALL_RESPONSE'
  | 'FS_HEAD' | 'ASSERTION' | 'RMM' | 'PLANNED_RESPONSE' | 'CONTROLS_STRATEGY'
  | 'POPULATION' | 'SAMPLE' | 'PROCEDURE' | 'EVIDENCE_PACKAGE' | 'RESULT_EXCEPTION'
  | 'MISSTATEMENT_SUMMARY' | 'CONCLUSION';

interface BrokenLink {
  id: string;
  linkType: 'MAPPING' | 'POPULATION' | 'SAMPLING' | 'AUDIT_PROGRAM' | 'EVIDENCE' | 'CONTROLS' | 'RISK' | 'CONCLUSION';
  sourceId: string;
  sourceType: string;
  targetId: string | null;
  targetType: string | null;
  breakReason: string;
  severity: 'HIGH' | 'MEDIUM';
  canAutoRepair: boolean;
  repairAction: string | null;
  authorityLevel: number;
  detectedAt: string;
}

interface RepairLogEntry {
  id: string;
  timestamp: string;
  moduleImpacted: string;
  authorityLevel: number;
  action: 'LINK' | 'UNLINK' | 'REGENERATE' | 'MARK_INACTIVE' | 'CREATE_VERSION';
  beforeState: Record<string, any>;
  afterState: Record<string, any>;
  reason: string;
  confidenceScore: number;
  user: string;
  approvalRequired: boolean;
  reviewerSignOff: string | null;
  reviewerSignOffStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
}

interface RegeneratedArtifact {
  id: string;
  type: ChainNodeType;
  reason: string;
  fromVersion: number;
  toVersion: number;
  timestamp: string;
  dependentArtifacts: string[];
}

interface ChainHealthSummary {
  engagementId: string;
  scanTimestamp: string;
  overallScore: number;
  fsLevelTrack: {
    entityUnderstanding: LinkStatus;
    fsLevelRisks: { count: number; linked: number };
    overallResponses: { count: number; linked: number };
  };
  assertionTrack: {
    fsHeads: { total: number; withAssertions: number };
    assertions: { total: number; withRMM: number };
    rmm: { total: number; withResponse: number };
    plannedResponses: { total: number; withControls: number };
    controlsStrategy: { total: number; executed: number };
    populations: { total: number; frozen: number; tiedOut: number };
    samples: { total: number; linked: number };
    procedures: { total: number; executed: number; withEvidence: number };
    evidencePackages: { total: number; complete: number };
    resultsExceptions: { total: number; evaluated: number };
    misstatementSummary: { total: number; isa450Compliant: number };
    conclusions: { total: number; supported: number };
  };
  chainIntegrity: {
    totalNodes: number;
    linkedNodes: number;
    brokenLinks: number;
    inactiveNodes: number;
    lockedNodes: number;
  };
}

interface BreakRegister {
  highSeverity: BrokenLink[];
  mediumSeverity: BrokenLink[];
  byCategory: {
    mapping: BrokenLink[];
    population: BrokenLink[];
    sampling: BrokenLink[];
    auditProgram: BrokenLink[];
    evidence: BrokenLink[];
    controls: BrokenLink[];
    risk: BrokenLink[];
    conclusion: BrokenLink[];
  };
  totalBreaks: number;
}

interface AutoRepairLog {
  timestamp: string;
  entries: RepairLogEntry[];
  totalRepaired: number;
  totalFailed: number;
  authoritySequence: string[];
}

interface RegeneratedArtifacts {
  riskMatrix: RegeneratedArtifact[];
  responses: RegeneratedArtifact[];
  populations: RegeneratedArtifact[];
  samples: RegeneratedArtifact[];
  procedures: RegeneratedArtifact[];
  evidencePlaceholders: RegeneratedArtifact[];
  exceptionsLogic: RegeneratedArtifact[];
}

interface GateResult {
  gate: string;
  passed: boolean;
  isaReference: string;
  message: string;
  count: number;
}

interface IntegrityAgentOutput {
  chainHealthSummary: ChainHealthSummary;
  breakRegister: BreakRegister;
  autoRepairLog: AutoRepairLog;
  regeneratedArtifacts: RegeneratedArtifacts;
  gateResults: {
    overall: 'PASS' | 'FAIL';
    gates: GateResult[];
    needsReviewList: string[];
  };
}

const AUTHORITY_HIERARCHY: Record<string, number> = {
  MATERIALITY: 1,
  MAPPING: 2,
  RISKS: 3,
  CONTROLS_STRATEGY: 4,
  SAMPLING: 5,
  AUDIT_PROGRAM: 6,
  EVIDENCE: 7
};

const FS_HEAD_LABELS: Record<string, string> = {
  CASH_EQUIVALENTS: "Cash and Cash Equivalents",
  TRADE_RECEIVABLES: "Trade Receivables",
  INVENTORIES: "Inventories",
  PPE: "Property, Plant & Equipment",
  INTANGIBLE_ASSETS: "Intangible Assets",
  TRADE_PAYABLES: "Trade Payables",
  BORROWINGS: "Borrowings",
  REVENUE: "Revenue",
  COST_OF_SALES: "Cost of Sales",
  PROVISIONS: "Provisions",
  SHARE_CAPITAL: "Share Capital",
  RETAINED_EARNINGS: "Retained Earnings",
  OTHER_INCOME: "Other Income",
  OPERATING_EXPENSES: "Operating Expenses",
  FINANCE_COSTS: "Finance Costs",
  TAX_EXPENSE: "Tax Expense",
  ROU_ASSETS: "Right-of-Use Assets",
  INVESTMENTS: "Investments",
  LEASE_LIABILITIES: "Lease Liabilities"
};

const ASSERTIONS_BY_CONTEXT = {
  transactions: ['Occurrence', 'Completeness', 'Accuracy', 'Cut-off', 'Classification'],
  balances: ['Existence', 'Rights & Obligations', 'Completeness', 'Valuation & Allocation', 'Classification'],
  disclosures: ['Occurrence & Rights', 'Completeness', 'Accuracy & Valuation', 'Presentation & Understandability']
};

const ALL_ASSERTIONS = [
  ...ASSERTIONS_BY_CONTEXT.transactions,
  ...ASSERTIONS_BY_CONTEXT.balances.filter(a => !ASSERTIONS_BY_CONTEXT.transactions.includes(a)),
  ...ASSERTIONS_BY_CONTEXT.disclosures.filter(a => 
    !ASSERTIONS_BY_CONTEXT.transactions.includes(a) && 
    !ASSERTIONS_BY_CONTEXT.balances.includes(a)
  )
];

function generateUniqueId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

async function getPlanningData(engagementId: string): Promise<any> {
  const planningMemo = await prisma.planningMemo.findUnique({
    where: { engagementId }
  });
  
  if (planningMemo?.teamBriefingNotes) {
    try {
      return JSON.parse(planningMemo.teamBriefingNotes);
    } catch {
      return {};
    }
  }
  return {};
}

async function savePlanningData(engagementId: string, data: any): Promise<void> {
  const existingPlanningMemo = await prisma.planningMemo.findUnique({
    where: { engagementId }
  });

  if (existingPlanningMemo) {
    await prisma.planningMemo.update({
      where: { engagementId },
      data: { teamBriefingNotes: JSON.stringify(data) }
    });
  } else {
    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId }
    });
    const team = await prisma.engagementTeam.findFirst({
      where: { engagementId }
    });
    const preparedById = team?.userId || engagement?.engagementPartnerId || 'system';
    await prisma.planningMemo.create({
      data: {
        engagementId,
        preparedById,
        teamBriefingNotes: JSON.stringify(data)
      }
    });
  }
}

function isLocked(lockType: LockType): boolean {
  return lockType === 'HARD' || lockType === 'ARCHIVE';
}

function canModify(lockType: LockType): boolean {
  return lockType === 'NONE' || lockType === 'SOFT';
}

async function scanFSLevelTrack(engagementId: string, planningData: any): Promise<{
  breaks: BrokenLink[];
  status: ChainHealthSummary['fsLevelTrack'];
}> {
  const breaks: BrokenLink[] = [];
  
  const entityUnderstanding = planningData.entityUnderstanding || planningData.riskAssessment?.entityCharacteristics;
  const fsLevelRisks = planningData.aiRiskAssessment?.fsLevelRisks || planningData.riskAssessment?.fsLevelRisks || [];
  const overallResponses = planningData.isa300Strategy?.step4_riskResponses?.fsLevelResponses || [];

  let entityStatus: LinkStatus = entityUnderstanding ? 'OK' : 'BROKEN';
  
  if (!entityUnderstanding) {
    breaks.push({
      id: generateUniqueId('BL-FS'),
      linkType: 'RISK',
      sourceId: 'entity-understanding',
      sourceType: 'ENTITY_UNDERSTANDING',
      targetId: null,
      targetType: null,
      breakReason: 'Entity Understanding not documented (ISA 315.11)',
      severity: 'HIGH',
      canAutoRepair: false,
      repairAction: 'Complete Entity Understanding questionnaire',
      authorityLevel: AUTHORITY_HIERARCHY.RISKS,
      detectedAt: new Date().toISOString()
    });
  }

  const linkedFsRisks = fsLevelRisks.filter((r: any) => 
    overallResponses.some((resp: any) => resp.riskId === r.id)
  );

  for (const risk of fsLevelRisks) {
    const hasResponse = overallResponses.some((resp: any) => resp.riskId === risk.id);
    if (!hasResponse) {
      breaks.push({
        id: generateUniqueId('BL-FS'),
        linkType: 'RISK',
        sourceId: risk.id,
        sourceType: 'FS_LEVEL_RISK',
        targetId: null,
        targetType: 'OVERALL_RESPONSE',
        breakReason: 'FS-Level Risk has no Overall Response (ISA 330.5)',
        severity: 'HIGH',
        canAutoRepair: true,
        repairAction: 'Generate overall audit response for FS-level risk',
        authorityLevel: AUTHORITY_HIERARCHY.RISKS,
        detectedAt: new Date().toISOString()
      });
    }
  }

  return {
    breaks,
    status: {
      entityUnderstanding: entityStatus,
      fsLevelRisks: { count: fsLevelRisks.length, linked: linkedFsRisks.length },
      overallResponses: { count: overallResponses.length, linked: overallResponses.length }
    }
  };
}

async function scanAssertionTrack(engagementId: string, planningData: any): Promise<{
  breaks: BrokenLink[];
  status: ChainHealthSummary['assertionTrack'];
}> {
  const breaks: BrokenLink[] = [];
  
  const coaAccounts = await prisma.coAAccount.findMany({ where: { engagementId } });
  const tbMappings = await prisma.tBMapping.findMany({ where: { engagementId } });
  
  const riskAssessment = planningData.aiRiskAssessment?.assertionLevelRisks || 
                         planningData.riskAssessment?.assertionLevelRisks || [];
  const strategy = planningData.isa300Strategy || {};
  const samplingData = planningData.isa530SamplingResult || {};
  const auditProgram = planningData.auditProgramResult || {};
  const materiality = planningData.isa320Materiality || {};

  const populations = samplingData.step2_populations || [];
  const sampleList = samplingData.step7_sampleList || [];
  const procedurePacks = auditProgram.step2_procedurePacks || [];

  const fsHeads = new Set<string>();
  coaAccounts.forEach((acc: any) => acc.fsLineItem && fsHeads.add(acc.fsLineItem));
  tbMappings.forEach((m: any) => m.lineItem && fsHeads.add(m.lineItem));

  for (const mapping of tbMappings) {
    const hasValidCoA = coaAccounts.some((acc: any) => 
      acc.fsLineItem === mapping.lineItem || acc.accountCode === mapping.accountCode
    );
    if (!hasValidCoA && mapping.lineItem) {
      breaks.push({
        id: generateUniqueId('BL-MAP'),
        linkType: 'MAPPING',
        sourceId: mapping.id,
        sourceType: 'TB_MAPPING',
        targetId: mapping.lineItem,
        targetType: 'COA_ACCOUNT',
        breakReason: 'CoA↔FS mapping broken - account not found',
        severity: 'HIGH',
        canAutoRepair: true,
        repairAction: 'Remap using current CoA structure',
        authorityLevel: AUTHORITY_HIERARCHY.MAPPING,
        detectedAt: new Date().toISOString()
      });
    }
  }

  const assertionsWithRMM = new Set<string>();
  for (const risk of riskAssessment) {
    const key = `${risk.fsHeadKey}-${risk.assertion}`;
    assertionsWithRMM.add(key);
    
    const hasResponse = strategy.step4_riskResponses?.assertionLevelResponses?.some(
      (r: any) => r.riskId === risk.id
    ) || procedurePacks.some((pack: any) => 
      pack.linkedRiskIds?.includes(risk.id) ||
      pack.procedures?.some((p: any) => p.linkedRiskIds?.includes(risk.id))
    );

    if (!hasResponse) {
      breaks.push({
        id: generateUniqueId('BL-RSK'),
        linkType: 'RISK',
        sourceId: risk.id,
        sourceType: 'RMM',
        targetId: null,
        targetType: 'PLANNED_RESPONSE',
        breakReason: `RMM for ${risk.fsHeadKey}/${risk.assertion} has no Planned Response (ISA 330.6)`,
        severity: 'HIGH',
        canAutoRepair: true,
        repairAction: 'Link risk to appropriate procedure pack',
        authorityLevel: AUTHORITY_HIERARCHY.RISKS,
        detectedAt: new Date().toISOString()
      });
    }
  }

  const populationIds = new Set(populations.map((p: any) => p.id));
  const frozenPopulations = populations.filter((p: any) => p.frozen || p.lockStatus === 'LOCKED');
  const tiedOutPopulations = populations.filter((p: any) => p.tiedOut || p.reconciled);

  for (const population of populations) {
    const glSource = population.sourceType || population.populationSource;
    if (!glSource) {
      breaks.push({
        id: generateUniqueId('BL-POP'),
        linkType: 'POPULATION',
        sourceId: population.id,
        sourceType: 'POPULATION',
        targetId: null,
        targetType: 'GL_SOURCE',
        breakReason: 'Population↔GL source not linked',
        severity: 'HIGH',
        canAutoRepair: true,
        repairAction: 'Link population to GL transaction source',
        authorityLevel: AUTHORITY_HIERARCHY.SAMPLING,
        detectedAt: new Date().toISOString()
      });
    }
  }

  const sampleIds = new Set(sampleList.map((s: any) => s.id));
  for (const sample of sampleList) {
    if (sample.populationReference && !populationIds.has(sample.populationReference)) {
      breaks.push({
        id: generateUniqueId('BL-SMP'),
        linkType: 'SAMPLING',
        sourceId: sample.id,
        sourceType: 'SAMPLE',
        targetId: sample.populationReference,
        targetType: 'POPULATION',
        breakReason: 'Sample↔Population mismatch',
        severity: 'MEDIUM',
        canAutoRepair: true,
        repairAction: 'Rebind sample to current population',
        authorityLevel: AUTHORITY_HIERARCHY.SAMPLING,
        detectedAt: new Date().toISOString()
      });
    }
  }

  let proceduresExecuted = 0;
  let proceduresWithEvidence = 0;
  const allProcedures: any[] = [];

  for (const pack of procedurePacks) {
    for (const procedure of (pack.procedures || [])) {
      allProcedures.push({ ...procedure, fsHeadKey: pack.fsHeadKey });
      
      if (procedure.executionStatus === 'COMPLETED') proceduresExecuted++;
      if (procedure.evidenceSlots?.some((s: any) => s.hasEvidence)) proceduresWithEvidence++;

      const hasValidLinks = (
        procedure.linkedFSHead || pack.fsHeadKey
      ) && (
        procedure.assertion || procedure.linkedAssertions?.length > 0
      ) && (
        procedure.linkedRiskIds?.length > 0 || procedure.riskReference
      );

      if (!hasValidLinks) {
        breaks.push({
          id: generateUniqueId('BL-PROC'),
          linkType: 'AUDIT_PROGRAM',
          sourceId: procedure.procedureId,
          sourceType: 'PROCEDURE',
          targetId: null,
          targetType: null,
          breakReason: 'Procedure not linked to FS Head+Assertion+Risk',
          severity: 'HIGH',
          canAutoRepair: true,
          repairAction: 'Link procedure to FS Head, Assertion, and Risk',
          authorityLevel: AUTHORITY_HIERARCHY.AUDIT_PROGRAM,
          detectedAt: new Date().toISOString()
      });
      }

      const isSampleBased = procedure.procedureType === 'ToD' || procedure.nature === 'Test of Details';
      if (isSampleBased) {
        if (!procedure.linkedSampleIds || procedure.linkedSampleIds.length === 0) {
          if (!procedure.nonSamplingJustification) {
            breaks.push({
              id: generateUniqueId('BL-PROC'),
              linkType: 'AUDIT_PROGRAM',
              sourceId: procedure.procedureId,
              sourceType: 'PROCEDURE',
              targetId: null,
              targetType: 'SAMPLE_LIST',
              breakReason: 'Procedure↔Sample not linked and no justification provided',
              severity: 'HIGH',
              canAutoRepair: true,
              repairAction: 'Link samples or provide non-sampling justification',
              authorityLevel: AUTHORITY_HIERARCHY.AUDIT_PROGRAM,
              detectedAt: new Date().toISOString()
            });
          }
        }
      }
    }
  }

  for (const sample of sampleList) {
    const hasProcedure = allProcedures.some(p => p.linkedSampleIds?.includes(sample.id));
    if (!hasProcedure) {
      breaks.push({
        id: generateUniqueId('BL-SMP'),
        linkType: 'SAMPLING',
        sourceId: sample.id,
        sourceType: 'SAMPLE',
        targetId: null,
        targetType: 'PROCEDURE',
        breakReason: 'Orphan sample - not linked to any procedure',
        severity: 'HIGH',
        canAutoRepair: true,
        repairAction: 'Link sample to appropriate ToD procedure',
        authorityLevel: AUTHORITY_HIERARCHY.SAMPLING,
        detectedAt: new Date().toISOString()
      });
    }

    if (!sample.evidenceSlotId && !sample.evidenceUploadSlot) {
      breaks.push({
        id: generateUniqueId('BL-EV'),
        linkType: 'EVIDENCE',
        sourceId: sample.id,
        sourceType: 'SAMPLE',
        targetId: null,
        targetType: 'EVIDENCE_SLOT',
        breakReason: 'Evidence orphan - sample missing evidence slot',
        severity: 'MEDIUM',
        canAutoRepair: true,
        repairAction: 'Create evidence slot for sample',
        authorityLevel: AUTHORITY_HIERARCHY.EVIDENCE,
        detectedAt: new Date().toISOString()
      });
    }
  }

  const resultsExceptions = planningData.resultsExceptions || [];
  const misstatements = planningData.misstatementSummary || planningData.isa450Summary || [];
  const conclusions = planningData.conclusions || [];

  for (const conclusion of conclusions) {
    const hasEvidence = conclusion.evidenceRefs?.length > 0 || conclusion.supportingEvidence;
    const hasMisstatementEval = conclusion.misstatementEvaluated || 
      misstatements.some((m: any) => m.fsHeadKey === conclusion.fsHeadKey);
    
    if (!hasEvidence || !hasMisstatementEval) {
      breaks.push({
        id: generateUniqueId('BL-CONC'),
        linkType: 'CONCLUSION',
        sourceId: conclusion.id || `conclusion-${conclusion.fsHeadKey}`,
        sourceType: 'CONCLUSION',
        targetId: null,
        targetType: hasEvidence ? 'MISSTATEMENT_EVALUATION' : 'EVIDENCE',
        breakReason: `Conclusion without ${!hasEvidence ? 'evidence' : 'misstatement evaluation'} (ISA 450)`,
        severity: 'HIGH',
        canAutoRepair: false,
        repairAction: !hasEvidence ? 'Link supporting evidence' : 'Complete ISA 450 misstatement evaluation',
        authorityLevel: AUTHORITY_HIERARCHY.EVIDENCE,
        detectedAt: new Date().toISOString()
      });
    }
  }

  return {
    breaks,
    status: {
      fsHeads: { total: fsHeads.size, withAssertions: assertionsWithRMM.size },
      assertions: { total: fsHeads.size * 5, withRMM: riskAssessment.length },
      rmm: { total: riskAssessment.length, withResponse: riskAssessment.length - breaks.filter(b => b.sourceType === 'RMM').length },
      plannedResponses: { total: procedurePacks.length, withControls: procedurePacks.filter((p: any) => p.controlsStrategy).length },
      controlsStrategy: { total: procedurePacks.length, executed: procedurePacks.filter((p: any) => p.controlsExecuted).length },
      populations: { total: populations.length, frozen: frozenPopulations.length, tiedOut: tiedOutPopulations.length },
      samples: { total: sampleList.length, linked: sampleList.length - breaks.filter(b => b.sourceType === 'SAMPLE' && b.linkType === 'SAMPLING').length },
      procedures: { total: allProcedures.length, executed: proceduresExecuted, withEvidence: proceduresWithEvidence },
      evidencePackages: { total: sampleList.length, complete: sampleList.filter((s: any) => s.evidenceComplete).length },
      resultsExceptions: { total: resultsExceptions.length, evaluated: resultsExceptions.filter((r: any) => r.evaluated).length },
      misstatementSummary: { total: misstatements.length, isa450Compliant: misstatements.filter((m: any) => m.isa450Compliant).length },
      conclusions: { total: conclusions.length, supported: conclusions.length - breaks.filter(b => b.sourceType === 'CONCLUSION').length }
    }
  };
}

function buildBreakRegister(breaks: BrokenLink[]): BreakRegister {
  return {
    highSeverity: breaks.filter(b => b.severity === 'HIGH'),
    mediumSeverity: breaks.filter(b => b.severity === 'MEDIUM'),
    byCategory: {
      mapping: breaks.filter(b => b.linkType === 'MAPPING'),
      population: breaks.filter(b => b.linkType === 'POPULATION'),
      sampling: breaks.filter(b => b.linkType === 'SAMPLING'),
      auditProgram: breaks.filter(b => b.linkType === 'AUDIT_PROGRAM'),
      evidence: breaks.filter(b => b.linkType === 'EVIDENCE'),
      controls: breaks.filter(b => b.linkType === 'CONTROLS'),
      risk: breaks.filter(b => b.linkType === 'RISK'),
      conclusion: breaks.filter(b => b.linkType === 'CONCLUSION')
    },
    totalBreaks: breaks.length
  };
}

async function executeAutoRepair(
  engagementId: string,
  breaks: BrokenLink[],
  planningData: any,
  userId: string
): Promise<{
  repairLog: AutoRepairLog;
  regeneratedArtifacts: RegeneratedArtifacts;
  updatedPlanningData: any;
}> {
  const entries: RepairLogEntry[] = [];
  const regenerated: RegeneratedArtifacts = {
    riskMatrix: [],
    responses: [],
    populations: [],
    samples: [],
    procedures: [],
    evidencePlaceholders: [],
    exceptionsLogic: []
  };

  const sortedBreaks = [...breaks]
    .filter(b => b.canAutoRepair)
    .sort((a, b) => a.authorityLevel - b.authorityLevel);

  const authoritySequence = [...new Set(sortedBreaks.map(b => 
    Object.entries(AUTHORITY_HIERARCHY).find(([_, v]) => v === b.authorityLevel)?.[0] || 'UNKNOWN'
  ))];

  for (const brk of sortedBreaks) {
    try {
      const beforeState = { sourceId: brk.sourceId, targetId: brk.targetId };
      let afterState: Record<string, any> = {};
      let action: RepairLogEntry['action'] = 'LINK';
      let repaired = false;
      let confidenceScore = 0;
      let approvalRequired = false;

      switch (brk.linkType) {
        case 'MAPPING':
          action = 'LINK';
          afterState = { sourceId: brk.sourceId, targetId: `remapped-${Date.now()}` };
          confidenceScore = 85;
          repaired = true;
          break;

        case 'POPULATION':
          const populations = planningData.isa530SamplingResult?.step2_populations || [];
          const popIndex = populations.findIndex((p: any) => p.id === brk.sourceId);
          if (popIndex >= 0) {
            populations[popIndex].linkStatus = 'AUTO_REPAIRED';
            populations[popIndex].sourceType = populations[popIndex].sourceType || 'GL Transactions';
            afterState = { populationId: brk.sourceId, sourceType: populations[popIndex].sourceType };
            confidenceScore = 90;
            repaired = true;
            regenerated.populations.push({
              id: brk.sourceId,
              type: 'POPULATION',
              reason: brk.breakReason,
              fromVersion: populations[popIndex].version || 1,
              toVersion: (populations[popIndex].version || 1) + 1,
              timestamp: new Date().toISOString(),
              dependentArtifacts: []
            });
          }
          break;

        case 'SAMPLING':
          if (brk.sourceType === 'SAMPLE') {
            const sampleList = planningData.isa530SamplingResult?.step7_sampleList || [];
            const sampleIndex = sampleList.findIndex((s: any) => s.id === brk.sourceId);
            
            if (sampleIndex >= 0 && brk.targetType === 'PROCEDURE') {
              const procedurePacks = planningData.auditProgramResult?.step2_procedurePacks || [];
              const sample = sampleList[sampleIndex];
              
              for (const pack of procedurePacks) {
                if (pack.fsHeadKey === sample.fsHeadKey) {
                  const todProc = (pack.procedures || []).find((p: any) => 
                    (p.procedureType === 'ToD' || p.nature === 'Test of Details') &&
                    p.assertion === sample.assertion
                  );
                  if (todProc) {
                    if (!todProc.linkedSampleIds) todProc.linkedSampleIds = [];
                    if (!todProc.linkedSampleIds.includes(sample.id)) {
                      todProc.linkedSampleIds.push(sample.id);
                    }
                    afterState = { sampleId: sample.id, procedureId: todProc.procedureId };
                    confidenceScore = 92;
                    repaired = true;
                    break;
                  }
                }
              }
            }
          }
          break;

        case 'RISK':
          if (brk.sourceType === 'RMM' || brk.sourceType === 'FS_LEVEL_RISK') {
            approvalRequired = true;
            action = 'REGENERATE';
            afterState = { riskId: brk.sourceId, draftResponseCreated: true };
            confidenceScore = 75;
            repaired = true;
            regenerated.responses.push({
              id: `response-${brk.sourceId}`,
              type: 'PLANNED_RESPONSE',
              reason: brk.breakReason,
              fromVersion: 0,
              toVersion: 1,
              timestamp: new Date().toISOString(),
              dependentArtifacts: [brk.sourceId]
            });
          }
          break;

        case 'AUDIT_PROGRAM':
          if (brk.sourceType === 'PROCEDURE') {
            const procedurePacks = planningData.auditProgramResult?.step2_procedurePacks || [];
            
            for (const pack of procedurePacks) {
              const procIndex = (pack.procedures || []).findIndex((p: any) => p.procedureId === brk.sourceId);
              if (procIndex >= 0) {
                const proc = pack.procedures[procIndex];
                
                if (!proc.linkedFSHead) proc.linkedFSHead = pack.fsHeadKey;
                if (!proc.assertion && !proc.linkedAssertions?.length) {
                  proc.assertion = 'Existence';
                }
                
                if (brk.targetType === 'SAMPLE_LIST') {
                  const sampleList = planningData.isa530SamplingResult?.step7_sampleList || [];
                  const matchingSamples = sampleList.filter((s: any) =>
                    s.fsHeadKey === pack.fsHeadKey && s.assertion === proc.assertion
                  );
                  proc.linkedSampleIds = matchingSamples.map((s: any) => s.id);
                  afterState = { procedureId: brk.sourceId, linkedSamples: proc.linkedSampleIds.length };
                } else {
                  afterState = { procedureId: brk.sourceId, linkedFSHead: proc.linkedFSHead };
                }
                
                confidenceScore = 88;
                repaired = true;
                regenerated.procedures.push({
                  id: brk.sourceId,
                  type: 'PROCEDURE',
                  reason: brk.breakReason,
                  fromVersion: proc.version || 1,
                  toVersion: (proc.version || 1) + 1,
                  timestamp: new Date().toISOString(),
                  dependentArtifacts: proc.linkedSampleIds || []
                });
                break;
              }
            }
          }
          break;

        case 'EVIDENCE':
          if (brk.sourceType === 'SAMPLE') {
            const sampleList = planningData.isa530SamplingResult?.step7_sampleList || [];
            const sampleIndex = sampleList.findIndex((s: any) => s.id === brk.sourceId);
            if (sampleIndex >= 0) {
              const slotId = generateUniqueId('EV-SLOT');
              sampleList[sampleIndex].evidenceSlotId = slotId;
              sampleList[sampleIndex].evidenceUploadSlot = slotId;
              afterState = { sampleId: brk.sourceId, evidenceSlotId: slotId };
              confidenceScore = 95;
              repaired = true;
              regenerated.evidencePlaceholders.push({
                id: slotId,
                type: 'EVIDENCE_PACKAGE',
                reason: 'Created evidence slot for sample',
                fromVersion: 0,
                toVersion: 1,
                timestamp: new Date().toISOString(),
                dependentArtifacts: [brk.sourceId]
              });
            }
          }
          break;
      }

      if (repaired) {
        entries.push({
          id: generateUniqueId('REPAIR'),
          timestamp: new Date().toISOString(),
          moduleImpacted: brk.linkType,
          authorityLevel: brk.authorityLevel,
          action,
          beforeState,
          afterState,
          reason: brk.breakReason,
          confidenceScore,
          user: userId,
          approvalRequired,
          reviewerSignOff: null,
          reviewerSignOffStatus: approvalRequired ? 'PENDING' : null
        });
      }
    } catch (err) {
      // Log repair failure but continue
    }
  }

  if (!planningData.linkageMonitor) planningData.linkageMonitor = {};
  planningData.linkageMonitor.repairLog = [
    ...(planningData.linkageMonitor.repairLog || []),
    ...entries
  ];
  planningData.linkageMonitor.lastRepairTimestamp = new Date().toISOString();

  return {
    repairLog: {
      timestamp: new Date().toISOString(),
      entries,
      totalRepaired: entries.length,
      totalFailed: sortedBreaks.length - entries.length,
      authoritySequence
    },
    regeneratedArtifacts: regenerated,
    updatedPlanningData: planningData
  };
}

function runQualityGates(breaks: BrokenLink[], planningData: any): {
  overall: 'PASS' | 'FAIL';
  gates: GateResult[];
  needsReviewList: string[];
} {
  const gates: GateResult[] = [];
  const needsReviewList: string[] = [];

  const orphanSamples = breaks.filter(b => 
    b.sourceType === 'SAMPLE' && b.breakReason.includes('Orphan')
  );
  gates.push({
    gate: 'No orphan samples (ISA 530.A13)',
    passed: orphanSamples.length === 0,
    isaReference: 'ISA 530.A13',
    message: orphanSamples.length === 0 
      ? 'All samples linked to procedures' 
      : `${orphanSamples.length} orphan samples detected`,
    count: orphanSamples.length
  });
  if (orphanSamples.length > 0) {
    needsReviewList.push(...orphanSamples.map(s => s.sourceId));
  }

  const orphanRisks = breaks.filter(b => 
    (b.sourceType === 'RMM' || b.sourceType === 'FS_LEVEL_RISK') && 
    b.targetType === 'PLANNED_RESPONSE'
  );
  gates.push({
    gate: 'No orphan risks (ISA 330.6)',
    passed: orphanRisks.length === 0,
    isaReference: 'ISA 330.6',
    message: orphanRisks.length === 0 
      ? 'All risks have planned responses' 
      : `${orphanRisks.length} risks without responses`,
    count: orphanRisks.length
  });

  const procedureWithoutLinks = breaks.filter(b =>
    b.sourceType === 'PROCEDURE' && b.breakReason.includes('not linked to FS Head')
  );
  gates.push({
    gate: 'Every procedure linked to FS Head+Assertion+Risk',
    passed: procedureWithoutLinks.length === 0,
    isaReference: 'ISA 330.28',
    message: procedureWithoutLinks.length === 0
      ? 'All procedures properly linked'
      : `${procedureWithoutLinks.length} procedures missing linkage`,
    count: procedureWithoutLinks.length
  });

  const procedureWithoutSamples = breaks.filter(b =>
    b.sourceType === 'PROCEDURE' && b.targetType === 'SAMPLE_LIST'
  );
  gates.push({
    gate: 'Sample-based procedures have samples or justification',
    passed: procedureWithoutSamples.length === 0,
    isaReference: 'ISA 530.10',
    message: procedureWithoutSamples.length === 0
      ? 'All sample-based procedures have samples'
      : `${procedureWithoutSamples.length} procedures missing samples`,
    count: procedureWithoutSamples.length
  });

  const conclusionsWithoutSupport = breaks.filter(b => b.sourceType === 'CONCLUSION');
  gates.push({
    gate: 'No conclusion without evidence + misstatement evaluation',
    passed: conclusionsWithoutSupport.length === 0,
    isaReference: 'ISA 450.11',
    message: conclusionsWithoutSupport.length === 0
      ? 'All conclusions properly supported'
      : `${conclusionsWithoutSupport.length} unsupported conclusions`,
    count: conclusionsWithoutSupport.length
  });

  const mappingBreaks = breaks.filter(b => b.linkType === 'MAPPING' && b.severity === 'HIGH');
  gates.push({
    gate: 'CoA↔FS mapping integrity',
    passed: mappingBreaks.length === 0,
    isaReference: 'ISA 315.18',
    message: mappingBreaks.length === 0
      ? 'Mapping integrity verified'
      : `${mappingBreaks.length} mapping breaks detected`,
    count: mappingBreaks.length
  });

  const populationGLBreaks = breaks.filter(b => 
    b.linkType === 'POPULATION' && b.targetType === 'GL_SOURCE'
  );
  gates.push({
    gate: 'Population↔GL source linkage',
    passed: populationGLBreaks.length === 0,
    isaReference: 'ISA 530.5',
    message: populationGLBreaks.length === 0
      ? 'All populations linked to GL source'
      : `${populationGLBreaks.length} populations without GL source`,
    count: populationGLBreaks.length
  });

  const repairLog = planningData.linkageMonitor?.repairLog || [];
  const pendingApprovals = repairLog.filter((r: RepairLogEntry) => r.reviewerSignOffStatus === 'PENDING');
  gates.push({
    gate: 'All auto-repairs reviewed',
    passed: pendingApprovals.length === 0,
    isaReference: 'ISA 230.8',
    message: pendingApprovals.length === 0
      ? 'No pending repair approvals'
      : `${pendingApprovals.length} repairs pending review`,
    count: pendingApprovals.length
  });
  if (pendingApprovals.length > 0) {
    needsReviewList.push(...pendingApprovals.map((r: RepairLogEntry) => r.id));
  }

  const highSeverityBreaks = breaks.filter(b => b.severity === 'HIGH');
  const overall = highSeverityBreaks.length === 0 && 
    gates.filter(g => g.gate.includes('orphan') || g.gate.includes('mapping') || g.gate.includes('conclusion')).every(g => g.passed)
    ? 'PASS' : 'FAIL';

  return { overall, gates, needsReviewList };
}

router.post('/:engagementId/full-scan', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const userId = req.user?.id || 'system';

    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId }
    });

    if (!engagement) {
      return res.status(404).json({ success: false, error: 'Engagement not found' });
    }

    const planningData = await getPlanningData(engagementId);

    const [fsLevelResult, assertionResult] = await Promise.all([
      scanFSLevelTrack(engagementId, planningData),
      scanAssertionTrack(engagementId, planningData)
    ]);

    const allBreaks = [...fsLevelResult.breaks, ...assertionResult.breaks];
    const breakRegister = buildBreakRegister(allBreaks);

    const { repairLog, regeneratedArtifacts, updatedPlanningData } = await executeAutoRepair(
      engagementId,
      allBreaks,
      planningData,
      userId
    );

    const gateResults = runQualityGates(allBreaks, updatedPlanningData);

    const overallScore = Math.max(0, 100 - (breakRegister.highSeverity.length * 10) - (breakRegister.mediumSeverity.length * 5));

    const chainHealthSummary: ChainHealthSummary = {
      engagementId,
      scanTimestamp: new Date().toISOString(),
      overallScore,
      fsLevelTrack: fsLevelResult.status,
      assertionTrack: assertionResult.status,
      chainIntegrity: {
        totalNodes: assertionResult.status.fsHeads.total + assertionResult.status.assertions.total + 
                    assertionResult.status.procedures.total + assertionResult.status.samples.total,
        linkedNodes: assertionResult.status.rmm.withResponse + assertionResult.status.samples.linked + 
                     assertionResult.status.procedures.executed,
        brokenLinks: breakRegister.totalBreaks,
        inactiveNodes: 0,
        lockedNodes: assertionResult.status.populations.frozen
      }
    };

    const output: IntegrityAgentOutput = {
      chainHealthSummary,
      breakRegister,
      autoRepairLog: repairLog,
      regeneratedArtifacts,
      gateResults
    };

    updatedPlanningData.linkageMonitor = {
      ...updatedPlanningData.linkageMonitor,
      lastFullScan: output,
      lastScanTimestamp: new Date().toISOString()
    };

    await savePlanningData(engagementId, updatedPlanningData);

    res.json({
      success: true,
      data: output
    });

  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to run full chain scan' });
  }
});

router.post('/:engagementId/scan', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;

    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId }
    });

    if (!engagement) {
      return res.status(404).json({ success: false, error: 'Engagement not found' });
    }

    const planningData = await getPlanningData(engagementId);

    const [fsLevelResult, assertionResult] = await Promise.all([
      scanFSLevelTrack(engagementId, planningData),
      scanAssertionTrack(engagementId, planningData)
    ]);

    const allBreaks = [...fsLevelResult.breaks, ...assertionResult.breaks];
    const breakRegister = buildBreakRegister(allBreaks);
    const gateResults = runQualityGates(allBreaks, planningData);

    const overallScore = Math.max(0, 100 - (breakRegister.highSeverity.length * 10) - (breakRegister.mediumSeverity.length * 5));

    const scanResult = {
      engagementId,
      scanTimestamp: new Date().toISOString(),
      overallScore,
      brokenLinks: allBreaks,
      qualityGates: gateResults.gates,
      breakRegister,
      summaryByType: {
        mapping: { total: breakRegister.byCategory.mapping.length, broken: breakRegister.byCategory.mapping.length, percentage: 0 },
        population: { total: breakRegister.byCategory.population.length, broken: breakRegister.byCategory.population.length, percentage: 0 },
        sampling: { total: breakRegister.byCategory.sampling.length, broken: breakRegister.byCategory.sampling.length, percentage: 0 },
        auditProgram: { total: breakRegister.byCategory.auditProgram.length, broken: breakRegister.byCategory.auditProgram.length, percentage: 0 },
        evidence: { total: breakRegister.byCategory.evidence.length, broken: breakRegister.byCategory.evidence.length, percentage: 0 }
      }
    };

    planningData.linkageMonitor = {
      ...planningData.linkageMonitor,
      lastScan: scanResult,
      lastScanTimestamp: scanResult.scanTimestamp
    };

    await savePlanningData(engagementId, planningData);

    res.json({
      success: true,
      data: scanResult
    });

  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to run integrity scan' });
  }
});

router.get('/:engagementId/report', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const planningData = await getPlanningData(engagementId);
    const lastScan = planningData.linkageMonitor?.lastFullScan || planningData.linkageMonitor?.lastScan;

    if (!lastScan) {
      return res.status(404).json({
        success: false,
        error: 'No scan report found. Run a scan first.'
      });
    }

    res.json({
      success: true,
      data: lastScan
    });

  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch report' });
  }
});

router.post('/:engagementId/auto-repair', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const userId = req.user?.id || 'system';

    const planningData = await getPlanningData(engagementId);
    const lastScan = planningData.linkageMonitor?.lastScan;

    if (!lastScan) {
      return res.status(400).json({
        success: false,
        error: 'Run a scan before attempting auto-repair'
      });
    }

    const { repairLog, regeneratedArtifacts, updatedPlanningData } = await executeAutoRepair(
      engagementId,
      lastScan.brokenLinks || [],
      planningData,
      userId
    );

    await savePlanningData(engagementId, updatedPlanningData);

    res.json({
      success: true,
      data: {
        repairLog,
        regeneratedArtifacts,
        reviewRequired: repairLog.entries.some(e => e.approvalRequired)
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to run auto-repair' });
  }
});

router.get('/:engagementId/coverage-heatmap', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const planningData = await getPlanningData(engagementId);

    const risks = planningData.aiRiskAssessment?.assertionLevelRisks || 
                  planningData.riskAssessment?.assertionLevelRisks || [];
    const sampleList = planningData.isa530SamplingResult?.step7_sampleList || [];
    const procedurePacks = planningData.auditProgramResult?.step2_procedurePacks || [];

    const fsHeadKeys = new Set<string>();
    risks.forEach((r: any) => fsHeadKeys.add(r.fsHeadKey));
    sampleList.forEach((s: any) => fsHeadKeys.add(s.fsHeadKey));
    procedurePacks.forEach((p: any) => fsHeadKeys.add(p.fsHeadKey));

    const heatmap = Array.from(fsHeadKeys).map(fsHeadKey => {
      const assertions = ALL_ASSERTIONS.map(assertion => {
        const riskLinked = risks.some((r: any) => r.fsHeadKey === fsHeadKey && r.assertion === assertion);
        const procedureLinked = procedurePacks.some((pack: any) =>
          pack.fsHeadKey === fsHeadKey && pack.procedures?.some((p: any) => p.assertion === assertion)
        );
        const sampleLinked = sampleList.some((s: any) => s.fsHeadKey === fsHeadKey && s.assertion === assertion);
        const evidenceLinked = sampleList.some((s: any) =>
          s.fsHeadKey === fsHeadKey && s.assertion === assertion && s.evidenceUploadSlot
        );

        let overallStatus: LinkStatus = 'OK';
        if (!riskLinked && !procedureLinked) overallStatus = 'NEEDS_REVIEW';
        else if (!sampleLinked || !evidenceLinked) overallStatus = 'BROKEN';

        return { assertion, riskLinked, procedureLinked, sampleLinked, evidenceLinked, overallStatus };
      });

      const linkedCount = assertions.filter(a => a.riskLinked && a.procedureLinked && a.sampleLinked).length;
      const overallCoverage = Math.round((linkedCount / ALL_ASSERTIONS.length) * 100);

      return {
        fsHeadKey,
        fsHeadLabel: FS_HEAD_LABELS[fsHeadKey] || fsHeadKey,
        assertions,
        overallCoverage
      };
    });

    const overallCoverage = heatmap.length > 0
      ? Math.round(heatmap.reduce((sum, h) => sum + h.overallCoverage, 0) / heatmap.length)
      : 0;

    res.json({
      success: true,
      data: {
        heatmap,
        overallCoverage,
        fsHeadCount: heatmap.length,
        assertionCount: ALL_ASSERTIONS.length,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to generate coverage heatmap' });
  }
});

router.post('/:engagementId/validate-push', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const planningData = await getPlanningData(engagementId);

    const [fsLevelResult, assertionResult] = await Promise.all([
      scanFSLevelTrack(engagementId, planningData),
      scanAssertionTrack(engagementId, planningData)
    ]);

    const allBreaks = [...fsLevelResult.breaks, ...assertionResult.breaks];
    const gateResults = runQualityGates(allBreaks, planningData);

    const blockers: string[] = [];
    const warnings: string[] = [];

    const highSeverityBreaks = allBreaks.filter(b => b.severity === 'HIGH');
    if (highSeverityBreaks.length > 0) {
      blockers.push(`${highSeverityBreaks.length} high-severity broken links must be resolved`);
    }

    for (const gate of gateResults.gates) {
      if (!gate.passed) {
        if (gate.gate.includes('orphan') || gate.gate.includes('mapping') || gate.gate.includes('conclusion')) {
          blockers.push(`Quality gate failed: ${gate.message}`);
        } else {
          warnings.push(`Quality gate warning: ${gate.message}`);
        }
      }
    }

    const mediumSeverityBreaks = allBreaks.filter(b => b.severity === 'MEDIUM');
    if (mediumSeverityBreaks.length > 0) {
      warnings.push(`${mediumSeverityBreaks.length} medium-severity issues - recommended to resolve`);
    }

    res.json({
      success: true,
      data: {
        canPush: blockers.length === 0,
        blockers,
        warnings,
        qualityGatesSummary: gateResults.gates,
        needsReviewList: gateResults.needsReviewList
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to validate push' });
  }
});

router.post('/:engagementId/approve-repair/:repairId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, repairId } = req.params;
    const { approved } = req.body;
    const reviewerId = req.user?.id || 'unknown';

    const planningData = await getPlanningData(engagementId);

    const repairLog = planningData.linkageMonitor?.repairLog || [];
    const repairIndex = repairLog.findIndex((r: RepairLogEntry) => r.id === repairId);

    if (repairIndex < 0) {
      return res.status(404).json({ success: false, error: 'Repair entry not found' });
    }

    repairLog[repairIndex].reviewerSignOff = reviewerId;
    repairLog[repairIndex].reviewerSignOffStatus = approved ? 'APPROVED' : 'REJECTED';

    planningData.linkageMonitor.repairLog = repairLog;

    await savePlanningData(engagementId, planningData);

    res.json({
      success: true,
      data: {
        repairId,
        status: approved ? 'APPROVED' : 'REJECTED',
        reviewerId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to approve repair' });
  }
});

router.get('/:engagementId/repair-log', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const planningData = await getPlanningData(engagementId);

    const repairLog = planningData.linkageMonitor?.repairLog || [];

    res.json({
      success: true,
      data: {
        repairLog,
        totalRepairs: repairLog.length,
        pendingApprovals: repairLog.filter((r: RepairLogEntry) => r.reviewerSignOffStatus === 'PENDING').length,
        approvedRepairs: repairLog.filter((r: RepairLogEntry) => r.reviewerSignOffStatus === 'APPROVED').length,
        rejectedRepairs: repairLog.filter((r: RepairLogEntry) => r.reviewerSignOffStatus === 'REJECTED').length,
        byAuthority: Object.entries(AUTHORITY_HIERARCHY).map(([name, level]) => ({
          authority: name,
          level,
          repairs: repairLog.filter((r: RepairLogEntry) => r.authorityLevel === level).length
        }))
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch repair log' });
  }
});

router.post('/:engagementId/mark-inactive/:nodeId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, nodeId } = req.params;
    const { reason } = req.body;
    const userId = req.user?.id || 'system';

    const planningData = await getPlanningData(engagementId);

    if (!planningData.linkageMonitor) planningData.linkageMonitor = {};
    if (!planningData.linkageMonitor.inactiveNodes) planningData.linkageMonitor.inactiveNodes = [];

    planningData.linkageMonitor.inactiveNodes.push({
      nodeId,
      reason: reason || 'Marked inactive by user',
      markedBy: userId,
      timestamp: new Date().toISOString()
    });

    planningData.linkageMonitor.repairLog = [
      ...(planningData.linkageMonitor.repairLog || []),
      {
        id: generateUniqueId('REPAIR'),
        timestamp: new Date().toISOString(),
        moduleImpacted: 'NODE',
        authorityLevel: 0,
        action: 'MARK_INACTIVE',
        beforeState: { nodeId, status: 'ACTIVE' },
        afterState: { nodeId, status: 'INACTIVE', reason },
        reason: reason || 'Marked inactive by user',
        confidenceScore: 100,
        user: userId,
        approvalRequired: false,
        reviewerSignOff: null,
        reviewerSignOffStatus: null
      }
    ];

    await savePlanningData(engagementId, planningData);

    res.json({
      success: true,
      data: {
        nodeId,
        status: 'INACTIVE',
        reason,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to mark node as inactive' });
  }
});

export default router;
