import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export type BreakSeverity = 'HIGH' | 'MEDIUM' | 'LOW';
export type BreakCategory = 
  | 'MAPPING_COA_FS'                   // HIGH: CoA/GL → FS Head mapping missing/invalid
  | 'POPULATION_GL_SOURCE'             // HIGH: Population → GL/sub-ledger source missing
  | 'PROCEDURE_SAMPLE_JUSTIFICATION'   // HIGH: Procedure not linked to sample OR non-sampling justification
  | 'SAMPLE_POPULATION_MISMATCH'       // MEDIUM: Sample not in population snapshot
  | 'EVIDENCE_ORPHAN'                  // MEDIUM: Evidence not linked to procedure
  | 'RISK_PROCEDURE_UNLINKED'          // MEDIUM: Risk without planned response
  | 'ASSERTION_MISSING'                // HIGH: FS Head without assertions
  | 'MATERIALITY_CASCADE'              // HIGH: Materiality missing/invalid
  | 'CONCLUSION_NO_EVIDENCE'           // HIGH: Conclusion without evidence
  | 'RMM_INCOMPLETE'                   // HIGH: Risk assessment incomplete
  | 'CONTROLS_DECISION_MISSING'        // MEDIUM: No controls strategy decision
  | 'STRATEGY_RISK_DISCONNECT';        // MEDIUM: Strategy doesn't address identified risks

export const ISA_REFERENCE_MAP: Record<BreakCategory, string> = {
  MAPPING_COA_FS: 'ISA 315',
  POPULATION_GL_SOURCE: 'ISA 530',
  PROCEDURE_SAMPLE_JUSTIFICATION: 'ISA 330/530',
  SAMPLE_POPULATION_MISMATCH: 'ISA 530',
  EVIDENCE_ORPHAN: 'ISA 500',
  RISK_PROCEDURE_UNLINKED: 'ISA 330',
  ASSERTION_MISSING: 'ISA 315',
  MATERIALITY_CASCADE: 'ISA 320',
  CONCLUSION_NO_EVIDENCE: 'ISA 500/450',
  RMM_INCOMPLETE: 'ISA 315.25-30',
  CONTROLS_DECISION_MISSING: 'ISA 330.7-8',
  STRATEGY_RISK_DISCONNECT: 'ISA 330.5-6',
};

export type GateStatus = 'PASS' | 'FAIL' | 'NEEDS_REVIEW';
export type LockType = 'NONE' | 'SOFT' | 'HARD' | 'ARCHIVE';

export interface ChainBreak {
  id: string;
  severity: BreakSeverity;
  category: BreakCategory;
  chainLevel: 'FS_LEVEL' | 'ASSERTION_TRACK';
  sourceEntity: string;
  sourceId: string;
  targetEntity: string | null;
  targetId: string | null;
  description: string;
  isaReference: string;
  autoRepairable: boolean;
  repairAction: string | null;
  detectedAt: Date;
}

export interface RepairAction {
  id: string;
  breakId: string;
  repairType: 'CREATE_LINK' | 'REGENERATE_ARTIFACT' | 'UPDATE_STATUS' | 'CASCADE_PROPAGATE' | 'MARK_INACTIVE';
  entityType: string;
  entityId: string;
  beforeState: Record<string, unknown>;
  afterState: Record<string, unknown>;
  reason: string;
  authorityLevel: number;
  performedAt: Date;
  performedBy: string;
  inactiveReason?: string;
}

export interface ChainHealthSummary {
  engagementId: string;
  timestamp: Date;
  fsLevelChainStatus: GateStatus;
  assertionTrackStatus: GateStatus;
  overallStatus: GateStatus;
  totalBreaks: number;
  highBreaks: number;
  mediumBreaks: number;
  autoRepaired: number;
  needsReview: string[];
  completenessScore: number;
  integrityScore: number;
  isaComplianceScore: number;
}

export interface RegeneratedArtifact {
  artifactType: string;
  artifactId: string;
  linkedTo: { entity: string; id: string }[];
  createdAt: Date;
  reason: string;
}

export interface GateCheckResult {
  overall: 'PASS' | 'FAIL';
  blockers: string[];
  warnings: string[];
  lockViolations: string[];
  conclusionTraceStatus: { fsHeadId: string; traced: boolean; gaps: string[] }[];
}

export interface ChainIntegrityResult {
  healthSummary: ChainHealthSummary;
  breakRegister: ChainBreak[];
  autoRepairLog: RepairAction[];
  regeneratedArtifacts: RegeneratedArtifact[];
  gateResult: {
    overall: GateStatus;
    fsLevel: GateStatus;
    assertionTrack: GateStatus;
    needsReviewList: string[];
  };
  gateCheckResult?: GateCheckResult;
  formattedReport?: string;
}

export type ChainNodeType = 
  | 'ENTITY_UNDERSTANDING' | 'FS_LEVEL_RISK' | 'OVERALL_RESPONSE'
  | 'FS_HEAD' | 'ASSERTION' | 'RMM' | 'PLANNED_RESPONSE' | 'CONTROLS_STRATEGY'
  | 'POPULATION' | 'SAMPLE_LIST' | 'PROCEDURE' | 'EVIDENCE' | 'RESULT' 
  | 'MISSTATEMENT' | 'CONCLUSION';

export type ChainNodeStatus = 'ACTIVE' | 'INACTIVE' | 'NEEDS_REVIEW' | 'DRAFT' | 'APPROVED' | 'LOCKED';

export interface ChainNode {
  nodeId: string;
  nodeType: ChainNodeType;
  entityId: string;
  entityName: string;
  parentLinks: { nodeId: string; linkType: string; }[];
  childLinks: { nodeId: string; linkType: string; }[];
  status: ChainNodeStatus;
  lockStatus: LockType;
  versionId: string | null;
  metadata: Record<string, unknown>;
}

export interface ChainGraph {
  engagementId: string;
  nodes: Map<string, ChainNode>;
  fsLevelChain: ChainNode[];
  assertionTracks: Map<string, ChainNode[]>;
  orphanNodes: ChainNode[];
  buildTimestamp: Date;
}

const AUTHORITY_HIERARCHY = {
  MATERIALITY: 1,
  MAPPING: 2,
  RISKS: 3,
  CONTROLS_STRATEGY: 4,
  POPULATION: 5,
  SAMPLING: 6,
  AUDIT_PROGRAM: 7,
  EVIDENCE: 8,
} as const;

export class AuditChainIntegrityService {
  private breakRegister: ChainBreak[] = [];
  private repairLog: RepairAction[] = [];
  private regeneratedArtifacts: RegeneratedArtifact[] = [];
  private userId: string = 'system';
  private chainGraph: ChainGraph | null = null;
  private lastArtifacts: Map<string, RegeneratedArtifact[]> = new Map();

  async runFullChainCheck(engagementId: string, userId: string = 'system', autoRepair: boolean = true): Promise<ChainIntegrityResult> {
    this.breakRegister = [];
    this.repairLog = [];
    this.regeneratedArtifacts = [];
    this.userId = userId;

    this.chainGraph = await this.buildChainGraph(engagementId);

    await this.validateFSLevelChain(engagementId);
    
    await this.validateAssertionTrack(engagementId);
    
    await this.detectBreaks(engagementId);
    
    if (autoRepair) {
      await this.performAutoRepairs(engagementId);
      await this.recomputeDownstreamOutputs(engagementId);
    }
    
    const healthSummary = await this.computeHealthSummary(engagementId);
    
    const gateCheckResult = await this.runFinalGateChecks(engagementId);
    
    const result: ChainIntegrityResult = {
      healthSummary,
      breakRegister: this.breakRegister,
      autoRepairLog: this.repairLog,
      regeneratedArtifacts: this.regeneratedArtifacts,
      gateResult: {
        overall: healthSummary.overallStatus,
        fsLevel: healthSummary.fsLevelChainStatus,
        assertionTrack: healthSummary.assertionTrackStatus,
        needsReviewList: healthSummary.needsReview,
      },
      gateCheckResult,
    };
    
    result.formattedReport = this.generateFormattedReport(result);
    
    return result;
  }

  async buildChainGraph(engagementId: string): Promise<ChainGraph> {
    const nodes = new Map<string, ChainNode>();
    const fsLevelChain: ChainNode[] = [];
    const assertionTracks = new Map<string, ChainNode[]>();
    const orphanNodes: ChainNode[] = [];

    const [
      engagement,
      client,
      riskAssessments,
      auditStrategy,
      auditPlan,
      fsHeads,
      procedures,
      evidenceFiles,
      substantiveTests,
      misstatements,
    ] = await Promise.all([
      prisma.engagement.findUnique({ where: { id: engagementId }, include: { client: true } }),
      prisma.client.findFirst({ where: { engagements: { some: { id: engagementId } } } }),
      prisma.riskAssessment.findMany({ where: { engagementId } }),
      prisma.auditStrategy.findFirst({ where: { engagementId } }),
      prisma.auditPlan.findFirst({ where: { engagementId } }),
      prisma.fSHeadWorkingPaper.findMany({ where: { engagementId } }),
      prisma.fSHeadProcedure.findMany({ where: { workingPaper: { engagementId } }, include: { workingPaper: true } }),
      prisma.evidenceFile.findMany({ where: { engagementId } }),
      prisma.substantiveTest.findMany({ where: { engagementId } }),
      prisma.misstatement.findMany({ where: { engagementId } }),
    ]);

    const entityUnderstandingNodeId = `entity-understanding-${engagementId}`;
    const entityUnderstandingNode: ChainNode = {
      nodeId: entityUnderstandingNodeId,
      nodeType: 'ENTITY_UNDERSTANDING',
      entityId: engagementId,
      entityName: client?.name || 'Entity Understanding',
      parentLinks: [],
      childLinks: [],
      status: this.mapEngagementStatus(engagement?.status),
      lockStatus: engagement?.status === 'COMPLETED' ? 'HARD' : 'NONE',
      versionId: null,
      metadata: {
        industry: client?.industry,
        regulatoryCategory: client?.regulatoryCategory,
      },
    };
    nodes.set(entityUnderstandingNodeId, entityUnderstandingNode);
    fsLevelChain.push(entityUnderstandingNode);

    const fsLevelRisks = riskAssessments.filter(r => 
      r.accountOrClass === 'FS_LEVEL' || r.accountOrClass === 'OVERALL'
    );
    
    for (const risk of fsLevelRisks) {
      const riskNodeId = `fs-level-risk-${risk.id}`;
      const riskNode: ChainNode = {
        nodeId: riskNodeId,
        nodeType: 'FS_LEVEL_RISK',
        entityId: risk.id,
        entityName: risk.riskDescription || `FS Level Risk - ${risk.accountOrClass}`,
        parentLinks: [{ nodeId: entityUnderstandingNodeId, linkType: 'DERIVED_FROM' }],
        childLinks: [],
        status: risk.status === 'APPROVED' ? 'APPROVED' : risk.status === 'LOCKED' ? 'LOCKED' : 'DRAFT',
        lockStatus: risk.status === 'LOCKED' ? 'HARD' : 'NONE',
        versionId: null,
        metadata: {
          inherentRisk: risk.inherentRisk,
          controlRisk: risk.controlRisk,
          riskOfMaterialMisstatement: risk.riskOfMaterialMisstatement,
        },
      };
      nodes.set(riskNodeId, riskNode);
      fsLevelChain.push(riskNode);
      entityUnderstandingNode.childLinks.push({ nodeId: riskNodeId, linkType: 'HAS_RISK' });
    }

    if (auditStrategy) {
      const strategyNodeId = `overall-response-${auditStrategy.id}`;
      const strategyNode: ChainNode = {
        nodeId: strategyNodeId,
        nodeType: 'OVERALL_RESPONSE',
        entityId: auditStrategy.id,
        entityName: 'Audit Strategy - Overall Response',
        parentLinks: fsLevelRisks.map(r => ({ nodeId: `fs-level-risk-${r.id}`, linkType: 'RESPONDS_TO' })),
        childLinks: [],
        status: auditStrategy.status === 'APPROVED' ? 'APPROVED' : auditStrategy.status === 'LOCKED' ? 'LOCKED' : 'DRAFT',
        lockStatus: auditStrategy.status === 'LOCKED' ? 'HARD' : 'NONE',
        versionId: null,
        metadata: {
          approach: auditStrategy.auditApproach,
          substantiveApproach: auditStrategy.substantiveApproach,
        },
      };
      nodes.set(strategyNodeId, strategyNode);
      fsLevelChain.push(strategyNode);
      
      for (const risk of fsLevelRisks) {
        const riskNode = nodes.get(`fs-level-risk-${risk.id}`);
        if (riskNode) {
          riskNode.childLinks.push({ nodeId: strategyNodeId, linkType: 'HAS_RESPONSE' });
        }
      }
    }

    for (const fsHead of fsHeads) {
      const fsHeadNodeId = `fs-head-${fsHead.id}`;
      const fsHeadNode: ChainNode = {
        nodeId: fsHeadNodeId,
        nodeType: 'FS_HEAD',
        entityId: fsHead.id,
        entityName: fsHead.fsHeadName,
        parentLinks: [],
        childLinks: [],
        status: this.mapFsHeadStatus(fsHead.status),
        lockStatus: fsHead.status === 'LOCKED' ? 'HARD' : fsHead.status === 'APPROVED' ? 'SOFT' : 'NONE',
        versionId: null,
        metadata: {
          fsHeadKey: fsHead.fsHeadKey,
          inherentRisk: fsHead.inherentRisk,
          controlRisk: fsHead.controlRisk,
          combinedRiskAssessment: fsHead.combinedRiskAssessment,
        },
      };
      nodes.set(fsHeadNodeId, fsHeadNode);

      const assertionTrack: ChainNode[] = [fsHeadNode];

      if (fsHead.inherentRisk && fsHead.controlRisk) {
        const rmmNodeId = `rmm-${fsHead.id}`;
        const rmmNode: ChainNode = {
          nodeId: rmmNodeId,
          nodeType: 'RMM',
          entityId: fsHead.id,
          entityName: `RMM - ${fsHead.fsHeadName}`,
          parentLinks: [{ nodeId: fsHeadNodeId, linkType: 'ASSESSED_FROM' }],
          childLinks: [],
          status: fsHeadNode.status,
          lockStatus: fsHeadNode.lockStatus,
          versionId: null,
          metadata: {
            inherentRisk: fsHead.inherentRisk,
            controlRisk: fsHead.controlRisk,
            combinedRisk: fsHead.combinedRiskAssessment,
          },
        };
        nodes.set(rmmNodeId, rmmNode);
        fsHeadNode.childLinks.push({ nodeId: rmmNodeId, linkType: 'HAS_RMM' });
        assertionTrack.push(rmmNode);
      }

      const fsHeadProcedures = procedures.filter(p => p.workingPaperId === fsHead.id);
      for (const proc of fsHeadProcedures) {
        const procNodeId = `procedure-${proc.id}`;
        const parentNodeId = fsHead.inherentRisk && fsHead.controlRisk ? `rmm-${fsHead.id}` : fsHeadNodeId;
        const procNode: ChainNode = {
          nodeId: procNodeId,
          nodeType: 'PROCEDURE',
          entityId: proc.id,
          entityName: proc.procedureRef || proc.description?.substring(0, 50) || `Procedure ${proc.id}`,
          parentLinks: [{ nodeId: parentNodeId, linkType: 'RESPONDS_TO_RISK' }],
          childLinks: [],
          status: proc.conclusion ? 'APPROVED' : 'DRAFT',
          lockStatus: 'NONE',
          versionId: null,
          metadata: {
            nature: proc.nature,
            assertions: proc.assertions,
            conclusion: proc.conclusion,
          },
        };
        nodes.set(procNodeId, procNode);
        assertionTrack.push(procNode);

        const parentNode = nodes.get(parentNodeId);
        if (parentNode) {
          parentNode.childLinks.push({ nodeId: procNodeId, linkType: 'HAS_PROCEDURE' });
        }

        const procEvidenceFiles = evidenceFiles.filter(e => e.procedureId === proc.id);
        for (const evidence of procEvidenceFiles) {
          const evidenceNodeId = `evidence-${evidence.id}`;
          const evidenceNode: ChainNode = {
            nodeId: evidenceNodeId,
            nodeType: 'EVIDENCE',
            entityId: evidence.id,
            entityName: evidence.fileName || `Evidence ${evidence.id}`,
            parentLinks: [{ nodeId: procNodeId, linkType: 'SUPPORTS' }],
            childLinks: [],
            status: evidence.status === 'REVIEWED' ? 'APPROVED' : 'DRAFT',
            lockStatus: 'NONE',
            versionId: null,
            metadata: {
              fileName: evidence.fileName,
              fileType: evidence.fileType,
              evidenceType: evidence.evidenceType,
            },
          };
          nodes.set(evidenceNodeId, evidenceNode);
          assertionTrack.push(evidenceNode);
          procNode.childLinks.push({ nodeId: evidenceNodeId, linkType: 'HAS_EVIDENCE' });
        }

        const procTests = substantiveTests.filter(t => t.procedureId === proc.id);
        for (const test of procTests) {
          const resultNodeId = `result-${test.id}`;
          const resultNode: ChainNode = {
            nodeId: resultNodeId,
            nodeType: 'RESULT',
            entityId: test.id,
            entityName: `Test Result - ${test.testType || 'Substantive'}`,
            parentLinks: [{ nodeId: procNodeId, linkType: 'EXECUTED_FROM' }],
            childLinks: [],
            status: test.status === 'COMPLETED' ? 'APPROVED' : test.status === 'REVIEWED' ? 'APPROVED' : 'DRAFT',
            lockStatus: 'NONE',
            versionId: null,
            metadata: {
              testType: test.testType,
              status: test.status,
              conclusion: test.conclusion,
            },
          };
          nodes.set(resultNodeId, resultNode);
          assertionTrack.push(resultNode);
          procNode.childLinks.push({ nodeId: resultNodeId, linkType: 'HAS_RESULT' });
        }
      }

      const fsHeadMisstatements = misstatements.filter(m => m.fsHeadId === fsHead.id);
      for (const misstatement of fsHeadMisstatements) {
        const misstatementNodeId = `misstatement-${misstatement.id}`;
        const misstatementNode: ChainNode = {
          nodeId: misstatementNodeId,
          nodeType: 'MISSTATEMENT',
          entityId: misstatement.id,
          entityName: `Misstatement - ${misstatement.description?.substring(0, 30) || misstatement.id}`,
          parentLinks: [{ nodeId: fsHeadNodeId, linkType: 'FOUND_IN' }],
          childLinks: [],
          status: misstatement.status === 'WAIVED' || misstatement.status === 'CORRECTED' ? 'APPROVED' : 'NEEDS_REVIEW',
          lockStatus: 'NONE',
          versionId: null,
          metadata: {
            amount: misstatement.amount,
            status: misstatement.status,
            classification: misstatement.classification,
          },
        };
        nodes.set(misstatementNodeId, misstatementNode);
        assertionTrack.push(misstatementNode);
        fsHeadNode.childLinks.push({ nodeId: misstatementNodeId, linkType: 'HAS_MISSTATEMENT' });
      }

      assertionTracks.set(fsHead.id, assertionTrack);
    }

    for (const [, node] of nodes) {
      if (node.parentLinks.length === 0 && node.nodeType !== 'ENTITY_UNDERSTANDING' && node.nodeType !== 'FS_HEAD') {
        orphanNodes.push(node);
      }
    }

    const orphanEvidence = evidenceFiles.filter(e => !e.procedureId);
    for (const evidence of orphanEvidence) {
      const evidenceNodeId = `evidence-${evidence.id}`;
      if (!nodes.has(evidenceNodeId)) {
        const orphanEvidenceNode: ChainNode = {
          nodeId: evidenceNodeId,
          nodeType: 'EVIDENCE',
          entityId: evidence.id,
          entityName: evidence.fileName || `Orphan Evidence ${evidence.id}`,
          parentLinks: [],
          childLinks: [],
          status: 'NEEDS_REVIEW',
          lockStatus: 'NONE',
          versionId: null,
          metadata: {
            fileName: evidence.fileName,
            isOrphan: true,
          },
        };
        nodes.set(evidenceNodeId, orphanEvidenceNode);
        orphanNodes.push(orphanEvidenceNode);
      }
    }

    return {
      engagementId,
      nodes,
      fsLevelChain,
      assertionTracks,
      orphanNodes,
      buildTimestamp: new Date(),
    };
  }

  private mapEngagementStatus(status: string | undefined): ChainNodeStatus {
    switch (status) {
      case 'COMPLETED': return 'APPROVED';
      case 'ARCHIVED': return 'LOCKED';
      case 'ACTIVE': return 'ACTIVE';
      case 'ON_HOLD': return 'INACTIVE';
      default: return 'DRAFT';
    }
  }

  private mapFsHeadStatus(status: string | undefined): ChainNodeStatus {
    switch (status) {
      case 'APPROVED': return 'APPROVED';
      case 'LOCKED': return 'LOCKED';
      case 'IN_PROGRESS': return 'ACTIVE';
      case 'UNDER_REVIEW': return 'NEEDS_REVIEW';
      default: return 'DRAFT';
    }
  }

  private async validateFSLevelChain(engagementId: string): Promise<void> {
    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId },
      include: {
        client: true,
      },
    });

    if (!engagement) {
      this.addBreak({
        severity: 'HIGH',
        category: 'MAPPING_COA_FS',
        chainLevel: 'FS_LEVEL',
        sourceEntity: 'Engagement',
        sourceId: engagementId,
        targetEntity: null,
        targetId: null,
        description: 'Engagement not found',
        isaReference: 'ISA 300.7',
        autoRepairable: false,
        repairAction: null,
      });
      return;
    }

    const entityUnderstanding = await this.checkEntityUnderstanding(engagementId);
    if (!entityUnderstanding.complete) {
      for (const gap of entityUnderstanding.gaps) {
        this.addBreak({
          severity: gap.critical ? 'HIGH' : 'MEDIUM',
          category: 'MAPPING_COA_FS',
          chainLevel: 'FS_LEVEL',
          sourceEntity: 'EntityUnderstanding',
          sourceId: engagementId,
          targetEntity: gap.area,
          targetId: null,
          description: gap.description,
          isaReference: 'ISA 315.11-24',
          autoRepairable: false,
          repairAction: gap.remediation,
        });
      }
    }

    const fsLevelRisks = await this.checkFSLevelRisks(engagementId);
    if (!fsLevelRisks.complete) {
      for (const gap of fsLevelRisks.gaps) {
        this.addBreak({
          severity: 'HIGH',
          category: 'RISK_PROCEDURE_UNLINKED',
          chainLevel: 'FS_LEVEL',
          sourceEntity: 'RiskAssessment',
          sourceId: engagementId,
          targetEntity: 'FSLevelRisk',
          targetId: null,
          description: gap.description,
          isaReference: 'ISA 315.25-30',
          autoRepairable: gap.autoFixable,
          repairAction: gap.remediation,
        });
      }
    }

    const overallResponses = await this.checkOverallResponses(engagementId);
    if (!overallResponses.complete) {
      for (const gap of overallResponses.gaps) {
        this.addBreak({
          severity: 'MEDIUM',
          category: 'PROCEDURE_SAMPLE_JUSTIFICATION',
          chainLevel: 'FS_LEVEL',
          sourceEntity: 'AuditPlan',
          sourceId: engagementId,
          targetEntity: 'OverallResponse',
          targetId: null,
          description: gap.description,
          isaReference: 'ISA 330.5-6',
          autoRepairable: gap.autoFixable,
          repairAction: gap.remediation,
        });
      }
    }

    await this.validateFSLevelChainLinkages(engagementId, entityUnderstanding, fsLevelRisks, overallResponses);
  }

  private async validateFSLevelChainLinkages(
    engagementId: string,
    entityUnderstanding: { complete: boolean; gaps: Array<any> },
    fsLevelRisks: { complete: boolean; gaps: Array<any> },
    overallResponses: { complete: boolean; gaps: Array<any> }
  ): Promise<void> {
    if (!entityUnderstanding.complete && fsLevelRisks.complete) {
      this.addBreak({
        severity: 'HIGH',
        category: 'MAPPING_COA_FS',
        chainLevel: 'FS_LEVEL',
        sourceEntity: 'EntityUnderstanding',
        sourceId: engagementId,
        targetEntity: 'FSLevelRisks',
        targetId: null,
        description: 'FS-Level chain break: Risks identified without complete entity understanding (ISA 315 requires understanding before risk identification)',
        isaReference: 'ISA 315.5',
        autoRepairable: false,
        repairAction: 'Complete entity understanding documentation before finalizing risk assessments',
      });
    }

    if (!fsLevelRisks.complete && overallResponses.complete) {
      this.addBreak({
        severity: 'HIGH',
        category: 'RISK_PROCEDURE_UNLINKED',
        chainLevel: 'FS_LEVEL',
        sourceEntity: 'FSLevelRisks',
        sourceId: engagementId,
        targetEntity: 'OverallResponses',
        targetId: null,
        description: 'FS-Level chain break: Overall responses defined without complete FS-level risk assessment',
        isaReference: 'ISA 330.5',
        autoRepairable: false,
        repairAction: 'Complete FS-level risk assessments before defining overall responses',
      });
    }

    const riskAssessments = await prisma.riskAssessment.findMany({
      where: { engagementId },
    });
    const auditPlan = await prisma.auditPlan.findFirst({
      where: { engagementId },
    });

    if (riskAssessments.length > 0 && auditPlan) {
      const fsLevelRiskIds = riskAssessments
        .filter(r => r.accountOrClass === 'FS_LEVEL' || r.accountOrClass === 'OVERALL')
        .map(r => r.id);

      const riskProcedureLinks = await prisma.riskProcedureLink.findMany({
        where: { 
          engagementId,
          riskId: { in: fsLevelRiskIds },
        },
      });

      const linkedRiskIds = new Set(riskProcedureLinks.map(l => l.riskId));
      const unlinkedFsLevelRisks = fsLevelRiskIds.filter(id => !linkedRiskIds.has(id));

      if (unlinkedFsLevelRisks.length > 0) {
        this.addBreak({
          severity: 'HIGH',
          category: 'RISK_PROCEDURE_UNLINKED',
          chainLevel: 'FS_LEVEL',
          sourceEntity: 'RiskAssessment',
          sourceId: unlinkedFsLevelRisks[0],
          targetEntity: 'AuditPlan',
          targetId: auditPlan.id,
          description: `${unlinkedFsLevelRisks.length} FS-level risk(s) not linked to overall audit responses in plan`,
          isaReference: 'ISA 330.6',
          autoRepairable: true,
          repairAction: 'Link FS-level risks to appropriate overall responses',
        });
      }
    }
  }

  private async checkEntityUnderstanding(engagementId: string): Promise<{
    complete: boolean;
    gaps: Array<{ area: string; description: string; critical: boolean; remediation: string }>;
  }> {
    const gaps: Array<{ area: string; description: string; critical: boolean; remediation: string }> = [];

    const [client, engagement, checklistItems] = await Promise.all([
      prisma.client.findFirst({
        where: { engagements: { some: { id: engagementId } } },
      }),
      prisma.engagement.findUnique({ where: { id: engagementId } }),
      prisma.checklistItem.findMany({ where: { engagementId } }),
    ]);

    if (!client?.industry) {
      gaps.push({
        area: 'BusinessNature',
        description: 'Entity business nature not documented',
        critical: true,
        remediation: 'Document nature of business, industry, and operations',
      });
    }

    if (!client?.regulatoryCategory) {
      gaps.push({
        area: 'RegulatoryEnvironment',
        description: 'Regulatory environment not documented',
        critical: false,
        remediation: 'Document applicable regulatory framework',
      });
    }

    const isaItems = checklistItems.filter(item => 
      item.section?.includes('ISA 315') || item.title?.includes('Entity Understanding')
    );
    const completedIsaItems = isaItems.filter(item => item.status === 'COMPLETED');
    
    if (isaItems.length > 0 && completedIsaItems.length < isaItems.length * 0.8) {
      gaps.push({
        area: 'EntityUnderstandingChecklist',
        description: `ISA 315 understanding checklist ${Math.round((completedIsaItems.length / isaItems.length) * 100)}% complete`,
        critical: completedIsaItems.length < isaItems.length * 0.5,
        remediation: 'Complete entity understanding checklist items',
      });
    }

    return {
      complete: gaps.filter(g => g.critical).length === 0,
      gaps,
    };
  }

  private async checkFSLevelRisks(engagementId: string): Promise<{
    complete: boolean;
    gaps: Array<{ description: string; autoFixable: boolean; remediation: string }>;
  }> {
    const gaps: Array<{ description: string; autoFixable: boolean; remediation: string }> = [];

    const riskAssessments = await prisma.riskAssessment.findMany({
      where: { engagementId },
    });

    if (riskAssessments.length === 0) {
      gaps.push({
        description: 'No risk assessments documented for engagement',
        autoFixable: true,
        remediation: 'Generate initial risk assessment based on entity understanding',
      });
    }

    const fsLevelRisks = riskAssessments.filter(r => 
      r.accountOrClass === 'FS_LEVEL' || r.accountOrClass === 'OVERALL'
    );

    if (fsLevelRisks.length === 0 && riskAssessments.length > 0) {
      gaps.push({
        description: 'No FS-level risks documented (only assertion-level risks exist)',
        autoFixable: true,
        remediation: 'Add FS-level risk assessment per ISA 315.25',
      });
    }

    const riskLinkages = await prisma.riskProcedureLink.findMany({
      where: { engagementId },
    });

    const unlinkedRisks = riskAssessments.filter(r => 
      !riskLinkages.some(l => l.riskId === r.id)
    );

    if (unlinkedRisks.length > 0) {
      gaps.push({
        description: `${unlinkedRisks.length} risk(s) not linked to any audit procedure`,
        autoFixable: false,
        remediation: 'Link risks to responsive audit procedures per ISA 330',
      });
    }

    return {
      complete: gaps.length === 0,
      gaps,
    };
  }

  private async checkOverallResponses(engagementId: string): Promise<{
    complete: boolean;
    gaps: Array<{ description: string; autoFixable: boolean; remediation: string }>;
  }> {
    const gaps: Array<{ description: string; autoFixable: boolean; remediation: string }> = [];

    const auditPlan = await prisma.auditPlan.findFirst({
      where: { engagementId, status: { in: ['APPROVED', 'LOCKED'] } },
    });

    if (!auditPlan) {
      const draftPlan = await prisma.auditPlan.findFirst({
        where: { engagementId, status: 'DRAFT' },
      });

      if (!draftPlan) {
        gaps.push({
          description: 'No audit plan documented',
          autoFixable: true,
          remediation: 'Create audit plan with overall responses',
        });
      } else {
        gaps.push({
          description: 'Audit plan exists but not approved',
          autoFixable: false,
          remediation: 'Review and approve audit plan',
        });
      }
    }

    const materialitySet = await prisma.materialitySet.findFirst({
      where: { engagementId, status: { in: ['APPROVED', 'LOCKED'] } },
    });

    if (!materialitySet) {
      gaps.push({
        description: 'No approved materiality determination',
        autoFixable: false,
        remediation: 'Determine and approve materiality per ISA 320',
      });
    }

    return {
      complete: gaps.length === 0,
      gaps,
    };
  }

  private async validateAssertionTrack(engagementId: string): Promise<void> {
    const fsHeads = await prisma.fSHeadWorkingPaper.findMany({
      where: { engagementId },
    });

    for (const fsHead of fsHeads) {
      await this.validateFSHeadChain(engagementId, fsHead);
    }
  }

  private async validateFSHeadChain(
    engagementId: string, 
    fsHead: { id: string; fsHeadKey: string; fsHeadName: string; inherentRisk: string | null; controlRisk: string | null; status: string }
  ): Promise<void> {
    
    const accounts = await prisma.coAAccount.findMany({
      where: { 
        engagementId,
        fsLineItem: fsHead.fsHeadKey,
      },
    });

    if (accounts.length === 0) {
      this.addBreak({
        severity: 'HIGH',
        category: 'MAPPING_COA_FS',
        chainLevel: 'ASSERTION_TRACK',
        sourceEntity: 'FSHeadWorkingPaper',
        sourceId: fsHead.id,
        targetEntity: 'CoAAccount',
        targetId: null,
        description: `FS Head "${fsHead.fsHeadName}" has no mapped CoA accounts`,
        isaReference: 'ISA 315.A128',
        autoRepairable: false,
        repairAction: 'Map GL accounts to this FS head',
      });
    }

    if (!fsHead.inherentRisk || !fsHead.controlRisk) {
      this.addBreak({
        severity: 'HIGH',
        category: 'ASSERTION_MISSING',
        chainLevel: 'ASSERTION_TRACK',
        sourceEntity: 'FSHeadWorkingPaper',
        sourceId: fsHead.id,
        targetEntity: 'RiskAssessment',
        targetId: null,
        description: `FS Head "${fsHead.fsHeadName}" missing ${!fsHead.inherentRisk ? 'inherent' : ''} ${!fsHead.controlRisk ? 'control' : ''} risk assessment`,
        isaReference: 'ISA 315.25-30',
        autoRepairable: true,
        repairAction: 'Set default risk assessment based on FS head characteristics',
      });
    }

    const procedures = await prisma.fSHeadProcedure.findMany({
      where: { workingPaperId: fsHead.id },
    });

    if (procedures.length === 0) {
      this.addBreak({
        severity: 'HIGH',
        category: 'PROCEDURE_SAMPLE_JUSTIFICATION',
        chainLevel: 'ASSERTION_TRACK',
        sourceEntity: 'FSHeadWorkingPaper',
        sourceId: fsHead.id,
        targetEntity: 'FSHeadProcedure',
        targetId: null,
        description: `FS Head "${fsHead.fsHeadName}" has no audit procedures defined`,
        isaReference: 'ISA 330.18',
        autoRepairable: true,
        repairAction: 'Generate default procedures based on FS head type and risk',
      });
    }

    for (const procedure of procedures) {
      await this.validateProcedureChain(engagementId, fsHead, procedure);
    }

    const adjustments = await prisma.fSHeadAdjustment.findMany({
      where: { workingPaperId: fsHead.id },
    });

    const pendingAdjustments = adjustments.filter(a => 
      !a.isPosted && a.managementAccepted !== true
    );

    if (pendingAdjustments.length > 0 && fsHead.status === 'APPROVED') {
      this.addBreak({
        severity: 'HIGH',
        category: 'CONCLUSION_NO_EVIDENCE',
        chainLevel: 'ASSERTION_TRACK',
        sourceEntity: 'FSHeadWorkingPaper',
        sourceId: fsHead.id,
        targetEntity: 'FSHeadAdjustment',
        targetId: null,
        description: `FS Head concluded but has ${pendingAdjustments.length} unresolved adjustments`,
        isaReference: 'ISA 450.8',
        autoRepairable: false,
        repairAction: 'Resolve or waive pending adjustments before conclusion',
      });
    }

    await this.validateAssertionTrackChainLinkages(engagementId, fsHead, procedures, accounts.length);
  }

  private async validateAssertionTrackChainLinkages(
    engagementId: string,
    fsHead: { id: string; fsHeadKey: string; fsHeadName: string; inherentRisk: string | null; controlRisk: string | null; status: string },
    procedures: Array<{ id: string; description: string; nature: string | null; conclusion: string | null }>,
    mappedAccountCount: number
  ): Promise<void> {
    const riskAssessments = await prisma.riskAssessment.findMany({
      where: { 
        engagementId,
        accountOrClass: fsHead.fsHeadKey,
      },
    });

    const hasRMM = fsHead.inherentRisk && fsHead.controlRisk;

    if (mappedAccountCount > 0 && !hasRMM) {
      this.addBreak({
        severity: 'HIGH',
        category: 'ASSERTION_MISSING',
        chainLevel: 'ASSERTION_TRACK',
        sourceEntity: 'CoAAccount',
        sourceId: fsHead.id,
        targetEntity: 'RiskOfMaterialMisstatement',
        targetId: null,
        description: `Chain break: FS Head "${fsHead.fsHeadName}" has ${mappedAccountCount} mapped accounts but no RMM assessment`,
        isaReference: 'ISA 315.25',
        autoRepairable: true,
        repairAction: 'Assess inherent and control risk for this FS head',
      });
    }

    if (hasRMM && procedures.length === 0) {
      this.addBreak({
        severity: 'HIGH',
        category: 'PROCEDURE_SAMPLE_JUSTIFICATION',
        chainLevel: 'ASSERTION_TRACK',
        sourceEntity: 'RiskOfMaterialMisstatement',
        sourceId: fsHead.id,
        targetEntity: 'PlannedResponse',
        targetId: null,
        description: `Chain break: FS Head "${fsHead.fsHeadName}" has RMM but no planned response (procedures)`,
        isaReference: 'ISA 330.6',
        autoRepairable: true,
        repairAction: 'Define audit procedures responsive to assessed risks',
      });
    }

    for (const procedure of procedures) {
      const riskLinks = await prisma.riskProcedureLink.findMany({
        where: { procedureId: procedure.id, engagementId },
      });

      if (riskLinks.length === 0 && riskAssessments.length > 0) {
        this.addBreak({
          severity: 'MEDIUM',
          category: 'RISK_PROCEDURE_UNLINKED',
          chainLevel: 'ASSERTION_TRACK',
          sourceEntity: 'FSHeadProcedure',
          sourceId: procedure.id,
          targetEntity: 'RiskAssessment',
          targetId: null,
          description: `Procedure "${procedure.description.substring(0, 40)}..." not linked to any assessed risk`,
          isaReference: 'ISA 330.18',
          autoRepairable: true,
          repairAction: 'Link procedure to relevant risk assessment(s)',
        });
      }

      const attachments = await prisma.fSHeadAttachment.findMany({
        where: { procedureId: procedure.id },
      });

      const testResults = await (prisma as any).testResult?.findMany({
        where: { procedureId: procedure.id },
      }) || [];

      if (procedure.conclusion && attachments.length === 0 && testResults.length === 0) {
        this.addBreak({
          severity: 'HIGH',
          category: 'CONCLUSION_NO_EVIDENCE',
          chainLevel: 'ASSERTION_TRACK',
          sourceEntity: 'FSHeadProcedure',
          sourceId: procedure.id,
          targetEntity: 'Evidence',
          targetId: null,
          description: `Procedure concluded without evidence or test results documented`,
          isaReference: 'ISA 500.6',
          autoRepairable: false,
          repairAction: 'Document evidence and test results before concluding',
        });
      }
    }

    if (fsHead.status === 'APPROVED') {
      const proceduresWithoutConclusion = procedures.filter(p => !p.conclusion);
      if (proceduresWithoutConclusion.length > 0) {
        this.addBreak({
          severity: 'HIGH',
          category: 'CONCLUSION_NO_EVIDENCE',
          chainLevel: 'ASSERTION_TRACK',
          sourceEntity: 'FSHeadWorkingPaper',
          sourceId: fsHead.id,
          targetEntity: 'FSHeadProcedure',
          targetId: proceduresWithoutConclusion[0].id,
          description: `FS Head approved but ${proceduresWithoutConclusion.length} procedure(s) have no conclusion`,
          isaReference: 'ISA 330.28',
          autoRepairable: false,
          repairAction: 'Conclude all procedures before approving FS head',
        });
      }
    }
  }

  private async validateProcedureChain(
    engagementId: string,
    fsHead: { id: string; fsHeadKey: string; fsHeadName: string },
    procedure: { id: string; description: string; nature: string | null; conclusion: string | null }
  ): Promise<void> {
    
    const populations = await (prisma as any).populationDefinition?.findMany({
      where: { 
        engagementId,
        OR: [
          { fsHeadId: fsHead.id },
          { procedureId: procedure.id },
        ],
      },
    }) || [];

    const samples = await (prisma as any).sample?.findMany({
      where: {
        engagementId,
        OR: [
          { fsHeadId: fsHead.id },
          { procedureId: procedure.id },
        ],
      },
    }) || [];

    const procedureNature = procedure.nature?.toUpperCase() || '';
    const needsSampling = procedureNature.includes('TEST') || 
                          procedureNature.includes('TOD') ||
                          procedureNature.includes('TOC') ||
                          procedureNature.includes('DETAIL') ||
                          procedureNature.includes('CONTROL');

    if (needsSampling && populations.length === 0) {
      this.addBreak({
        severity: 'HIGH',
        category: 'POPULATION_GL_SOURCE',
        chainLevel: 'ASSERTION_TRACK',
        sourceEntity: 'FSHeadProcedure',
        sourceId: procedure.id,
        targetEntity: 'PopulationDefinition',
        targetId: null,
        description: `Procedure "${procedure.description.substring(0, 50)}..." requires sampling but has no population defined`,
        isaReference: 'ISA 530.5',
        autoRepairable: true,
        repairAction: 'Generate population from GL/TB based on FS head mapping',
      });
    }

    if (needsSampling && populations.length > 0 && samples.length === 0) {
      this.addBreak({
        severity: 'HIGH',
        category: 'SAMPLE_POPULATION_MISMATCH',
        chainLevel: 'ASSERTION_TRACK',
        sourceEntity: 'FSHeadProcedure',
        sourceId: procedure.id,
        targetEntity: 'Sample',
        targetId: null,
        description: `Procedure has population(s) but no sample generated`,
        isaReference: 'ISA 530.8',
        autoRepairable: true,
        repairAction: 'Generate sample from population using appropriate method',
      });
    }

    for (const sample of samples) {
      if (sample.populationId) {
        const matchingPop = populations.find((p: any) => p.id === sample.populationId);
        if (!matchingPop) {
          this.addBreak({
            severity: 'MEDIUM',
            category: 'SAMPLE_POPULATION_MISMATCH',
            chainLevel: 'ASSERTION_TRACK',
            sourceEntity: 'Sample',
            sourceId: sample.id,
            targetEntity: 'PopulationDefinition',
            targetId: sample.populationId,
            description: 'Sample references non-existent or mislinked population',
            isaReference: 'ISA 530.A3',
            autoRepairable: false,
            repairAction: 'Verify and correct population linkage',
          });
        }
      }
    }

    const attachments = await prisma.fSHeadAttachment.findMany({
      where: { procedureId: procedure.id },
    });

    if (procedure.conclusion && attachments.length === 0) {
      this.addBreak({
        severity: 'MEDIUM',
        category: 'EVIDENCE_ORPHAN',
        chainLevel: 'ASSERTION_TRACK',
        sourceEntity: 'FSHeadProcedure',
        sourceId: procedure.id,
        targetEntity: 'FSHeadAttachment',
        targetId: null,
        description: `Procedure concluded but has no supporting evidence attached`,
        isaReference: 'ISA 500.6',
        autoRepairable: false,
        repairAction: 'Attach supporting evidence before conclusion',
      });
    }

  }

  private async detectBreaks(engagementId: string): Promise<void> {
    await this.detectMaterialityCascadeBreaks(engagementId);
    await this.detectMappingBreaks(engagementId);
    await this.detectEvidenceOrphans(engagementId);
    await this.validateChainGraphIntegrity(engagementId);
    this.detectBreaksFromGraph();
  }

  async validateChainGraphIntegrity(engagementId: string): Promise<void> {
    if (!this.chainGraph) {
      this.chainGraph = await this.buildChainGraph(engagementId);
    }

    const graph = this.chainGraph;

    for (const [, node] of graph.nodes) {
      switch (node.nodeType) {
        case 'FS_HEAD':
          this.validateFsHeadNode(node);
          break;
        case 'PROCEDURE':
          this.validateProcedureNode(node);
          break;
        case 'EVIDENCE':
          this.validateEvidenceNode(node);
          break;
        case 'CONCLUSION':
          this.validateConclusionNode(node);
          break;
        case 'RMM':
          this.validateRmmNode(node);
          break;
        case 'CONTROLS_STRATEGY':
          this.validateControlsStrategyNode(node);
          break;
        case 'OVERALL_RESPONSE':
          this.validateOverallResponseNode(node, graph);
          break;
      }
    }

    for (const orphan of graph.orphanNodes) {
      const severity = this.getOrphanSeverity(orphan.nodeType);
      const category = this.getOrphanCategory(orphan.nodeType);
      
      this.addBreak({
        severity,
        category,
        chainLevel: orphan.nodeType === 'FS_LEVEL_RISK' || orphan.nodeType === 'OVERALL_RESPONSE' 
          ? 'FS_LEVEL' 
          : 'ASSERTION_TRACK',
        sourceEntity: orphan.nodeType,
        sourceId: orphan.entityId,
        targetEntity: null,
        targetId: null,
        description: `Orphan ${orphan.nodeType} node "${orphan.entityName}" has no parent links in the audit chain`,
        isaReference: ISA_REFERENCE_MAP[category],
        autoRepairable: orphan.nodeType === 'EVIDENCE',
        repairAction: orphan.nodeType === 'EVIDENCE' 
          ? 'Link evidence to appropriate procedure' 
          : 'Establish required chain linkages',
      });
    }

    await this.validateRmmCompleteness(engagementId, graph);
    await this.validateControlsDecisions(engagementId, graph);
    await this.validateStrategyRiskAlignment(engagementId, graph);
  }

  private validateFsHeadNode(node: ChainNode): void {
    const hasRmmOrAssertion = node.childLinks.some(link => 
      link.linkType === 'HAS_RMM' || link.linkType === 'HAS_ASSERTION'
    );

    if (!hasRmmOrAssertion) {
      this.addBreak({
        severity: 'HIGH',
        category: 'ASSERTION_MISSING',
        chainLevel: 'ASSERTION_TRACK',
        sourceEntity: 'FS_HEAD',
        sourceId: node.entityId,
        targetEntity: 'RMM',
        targetId: null,
        description: `FS Head "${node.entityName}" has no RMM or assertion assessment linked`,
        isaReference: ISA_REFERENCE_MAP.ASSERTION_MISSING,
        autoRepairable: true,
        repairAction: 'Assess inherent and control risk for this FS head',
      });
    }
  }

  private validateProcedureNode(node: ChainNode): void {
    const hasEvidence = node.childLinks.some(link => link.linkType === 'HAS_EVIDENCE');
    const hasResult = node.childLinks.some(link => link.linkType === 'HAS_RESULT');
    const hasSampleLink = node.childLinks.some(link => link.linkType === 'HAS_SAMPLE');
    const hasConclusion = node.metadata?.conclusion;

    if (hasConclusion && !hasEvidence && !hasResult) {
      this.addBreak({
        severity: 'HIGH',
        category: 'CONCLUSION_NO_EVIDENCE',
        chainLevel: 'ASSERTION_TRACK',
        sourceEntity: 'PROCEDURE',
        sourceId: node.entityId,
        targetEntity: 'EVIDENCE',
        targetId: null,
        description: `Procedure "${node.entityName}" has conclusion but no evidence or results linked`,
        isaReference: ISA_REFERENCE_MAP.CONCLUSION_NO_EVIDENCE,
        autoRepairable: false,
        repairAction: 'Document evidence and test results before concluding',
      });
    }

    const needsSampling = (node.metadata?.nature as string)?.toUpperCase()?.match(/TEST|TOD|TOC|DETAIL|CONTROL/);
    if (needsSampling && !hasSampleLink && !hasEvidence) {
      this.addBreak({
        severity: 'HIGH',
        category: 'PROCEDURE_SAMPLE_JUSTIFICATION',
        chainLevel: 'ASSERTION_TRACK',
        sourceEntity: 'PROCEDURE',
        sourceId: node.entityId,
        targetEntity: 'SAMPLE_LIST',
        targetId: null,
        description: `Procedure "${node.entityName}" requires sampling but has no sample or evidence linked`,
        isaReference: ISA_REFERENCE_MAP.PROCEDURE_SAMPLE_JUSTIFICATION,
        autoRepairable: true,
        repairAction: 'Link to sample list or document non-sampling justification',
      });
    }
  }

  private validateEvidenceNode(node: ChainNode): void {
    const hasProcedureParent = node.parentLinks.some(link => link.linkType === 'SUPPORTS');

    if (!hasProcedureParent && node.parentLinks.length === 0) {
      this.addBreak({
        severity: 'MEDIUM',
        category: 'EVIDENCE_ORPHAN',
        chainLevel: 'ASSERTION_TRACK',
        sourceEntity: 'EVIDENCE',
        sourceId: node.entityId,
        targetEntity: 'PROCEDURE',
        targetId: null,
        description: `Evidence "${node.entityName}" is not linked to any procedure`,
        isaReference: ISA_REFERENCE_MAP.EVIDENCE_ORPHAN,
        autoRepairable: false,
        repairAction: 'Link evidence to relevant procedure or mark as general documentation',
      });
    }
  }

  private validateConclusionNode(node: ChainNode): void {
    const hasEvidenceParent = node.parentLinks.some(link => 
      link.linkType === 'SUPPORTED_BY_EVIDENCE' || link.linkType === 'HAS_EVIDENCE'
    );
    const hasResultParent = node.parentLinks.some(link => 
      link.linkType === 'DERIVED_FROM_RESULT' || link.linkType === 'HAS_RESULT'
    );

    if (!hasEvidenceParent && !hasResultParent) {
      this.addBreak({
        severity: 'HIGH',
        category: 'CONCLUSION_NO_EVIDENCE',
        chainLevel: 'ASSERTION_TRACK',
        sourceEntity: 'CONCLUSION',
        sourceId: node.entityId,
        targetEntity: 'EVIDENCE',
        targetId: null,
        description: `Conclusion node "${node.entityName}" has no evidence or result parent`,
        isaReference: ISA_REFERENCE_MAP.CONCLUSION_NO_EVIDENCE,
        autoRepairable: false,
        repairAction: 'Link conclusion to supporting evidence and test results',
      });
    }
  }

  private validateRmmNode(node: ChainNode): void {
    const hasInherentRisk = node.metadata?.inherentRisk;
    const hasControlRisk = node.metadata?.controlRisk;
    const hasCombinedRisk = node.metadata?.combinedRisk;

    if (!hasInherentRisk || !hasControlRisk) {
      this.addBreak({
        severity: 'HIGH',
        category: 'RMM_INCOMPLETE',
        chainLevel: 'ASSERTION_TRACK',
        sourceEntity: 'RMM',
        sourceId: node.entityId,
        targetEntity: null,
        targetId: null,
        description: `RMM for "${node.entityName}" is incomplete: missing ${!hasInherentRisk ? 'inherent risk' : ''} ${!hasControlRisk ? 'control risk' : ''}`,
        isaReference: ISA_REFERENCE_MAP.RMM_INCOMPLETE,
        autoRepairable: true,
        repairAction: 'Complete risk assessment with inherent and control risk ratings',
      });
    }

    const hasPlannedResponse = node.childLinks.some(link => 
      link.linkType === 'HAS_PROCEDURE' || link.linkType === 'HAS_RESPONSE'
    );

    if (hasCombinedRisk && !hasPlannedResponse) {
      this.addBreak({
        severity: 'MEDIUM',
        category: 'RISK_PROCEDURE_UNLINKED',
        chainLevel: 'ASSERTION_TRACK',
        sourceEntity: 'RMM',
        sourceId: node.entityId,
        targetEntity: 'PLANNED_RESPONSE',
        targetId: null,
        description: `RMM for "${node.entityName}" has no planned audit response linked`,
        isaReference: ISA_REFERENCE_MAP.RISK_PROCEDURE_UNLINKED,
        autoRepairable: true,
        repairAction: 'Link RMM to responsive audit procedures',
      });
    }
  }

  private validateControlsStrategyNode(node: ChainNode): void {
    const hasDecision = node.metadata?.decision || node.metadata?.approach;

    if (!hasDecision) {
      this.addBreak({
        severity: 'MEDIUM',
        category: 'CONTROLS_DECISION_MISSING',
        chainLevel: 'ASSERTION_TRACK',
        sourceEntity: 'CONTROLS_STRATEGY',
        sourceId: node.entityId,
        targetEntity: null,
        targetId: null,
        description: `Controls strategy for "${node.entityName}" has no documented decision`,
        isaReference: ISA_REFERENCE_MAP.CONTROLS_DECISION_MISSING,
        autoRepairable: false,
        repairAction: 'Document controls reliance decision per ISA 330.7-8',
      });
    }
  }

  private validateOverallResponseNode(node: ChainNode, graph: ChainGraph): void {
    const fsLevelRisks = graph.fsLevelChain.filter(n => n.nodeType === 'FS_LEVEL_RISK');
    
    if (fsLevelRisks.length > 0) {
      const linkedRiskIds = new Set(node.parentLinks.map(link => link.nodeId));
      const unlinkedRisks = fsLevelRisks.filter(risk => !linkedRiskIds.has(risk.nodeId));

      if (unlinkedRisks.length > 0) {
        this.addBreak({
          severity: 'MEDIUM',
          category: 'STRATEGY_RISK_DISCONNECT',
          chainLevel: 'FS_LEVEL',
          sourceEntity: 'OVERALL_RESPONSE',
          sourceId: node.entityId,
          targetEntity: 'FS_LEVEL_RISK',
          targetId: unlinkedRisks[0].entityId,
          description: `Audit strategy does not address ${unlinkedRisks.length} identified FS-level risk(s)`,
          isaReference: ISA_REFERENCE_MAP.STRATEGY_RISK_DISCONNECT,
          autoRepairable: false,
          repairAction: 'Link strategy to all identified FS-level risks',
        });
      }
    }
  }

  private async validateRmmCompleteness(engagementId: string, graph: ChainGraph): Promise<void> {
    for (const [fsHeadId, track] of graph.assertionTracks) {
      const fsHeadNode = track.find(n => n.nodeType === 'FS_HEAD');
      const rmmNode = track.find(n => n.nodeType === 'RMM');

      if (fsHeadNode && !rmmNode) {
        const hasRiskData = fsHeadNode.metadata?.inherentRisk && fsHeadNode.metadata?.controlRisk;
        if (!hasRiskData) {
          this.addBreak({
            severity: 'HIGH',
            category: 'RMM_INCOMPLETE',
            chainLevel: 'ASSERTION_TRACK',
            sourceEntity: 'FS_HEAD',
            sourceId: fsHeadNode.entityId,
            targetEntity: 'RMM',
            targetId: null,
            description: `FS Head "${fsHeadNode.entityName}" has no complete RMM assessment`,
            isaReference: ISA_REFERENCE_MAP.RMM_INCOMPLETE,
            autoRepairable: true,
            repairAction: 'Complete inherent and control risk assessment',
          });
        }
      }
    }
  }

  private async validateControlsDecisions(engagementId: string, graph: ChainGraph): Promise<void> {
    const auditStrategy = await prisma.auditStrategy.findFirst({
      where: { engagementId },
    });

    if (auditStrategy && !auditStrategy.controlsReliance && !auditStrategy.substantiveApproach) {
      this.addBreak({
        severity: 'MEDIUM',
        category: 'CONTROLS_DECISION_MISSING',
        chainLevel: 'FS_LEVEL',
        sourceEntity: 'AuditStrategy',
        sourceId: auditStrategy.id,
        targetEntity: null,
        targetId: null,
        description: 'Audit strategy has no controls reliance or substantive approach decision',
        isaReference: ISA_REFERENCE_MAP.CONTROLS_DECISION_MISSING,
        autoRepairable: false,
        repairAction: 'Document controls reliance decision in audit strategy',
      });
    }
  }

  private async validateStrategyRiskAlignment(engagementId: string, graph: ChainGraph): Promise<void> {
    const riskAssessments = await prisma.riskAssessment.findMany({
      where: { engagementId },
    });

    const auditStrategy = await prisma.auditStrategy.findFirst({
      where: { engagementId },
    });

    const significantRisks = riskAssessments.filter(r => 
      r.riskOfMaterialMisstatement === 'SIGNIFICANT' || r.inherentRisk === 'HIGH'
    );

    if (significantRisks.length > 0 && auditStrategy) {
      const riskProcedureLinks = await prisma.riskProcedureLink.findMany({
        where: { 
          engagementId,
          riskId: { in: significantRisks.map(r => r.id) },
        },
      });

      const linkedRiskIds = new Set(riskProcedureLinks.map(l => l.riskId));
      const unaddressedRisks = significantRisks.filter(r => !linkedRiskIds.has(r.id));

      if (unaddressedRisks.length > 0) {
        this.addBreak({
          severity: 'HIGH',
          category: 'STRATEGY_RISK_DISCONNECT',
          chainLevel: 'FS_LEVEL',
          sourceEntity: 'AuditStrategy',
          sourceId: auditStrategy.id,
          targetEntity: 'RiskAssessment',
          targetId: unaddressedRisks[0].id,
          description: `${unaddressedRisks.length} significant risk(s) have no linked audit response in strategy`,
          isaReference: ISA_REFERENCE_MAP.STRATEGY_RISK_DISCONNECT,
          autoRepairable: false,
          repairAction: 'Address all significant risks with specific audit responses',
        });
      }
    }
  }

  private getOrphanSeverity(nodeType: ChainNodeType): BreakSeverity {
    switch (nodeType) {
      case 'FS_HEAD':
      case 'FS_LEVEL_RISK':
      case 'OVERALL_RESPONSE':
      case 'RMM':
      case 'CONCLUSION':
        return 'HIGH';
      case 'PROCEDURE':
      case 'CONTROLS_STRATEGY':
        return 'MEDIUM';
      case 'EVIDENCE':
      case 'RESULT':
      case 'SAMPLE_LIST':
      case 'POPULATION':
        return 'MEDIUM';
      default:
        return 'LOW';
    }
  }

  private getOrphanCategory(nodeType: ChainNodeType): BreakCategory {
    switch (nodeType) {
      case 'FS_HEAD':
        return 'MAPPING_COA_FS';
      case 'EVIDENCE':
        return 'EVIDENCE_ORPHAN';
      case 'PROCEDURE':
        return 'PROCEDURE_SAMPLE_JUSTIFICATION';
      case 'RMM':
        return 'RMM_INCOMPLETE';
      case 'CONCLUSION':
        return 'CONCLUSION_NO_EVIDENCE';
      case 'POPULATION':
        return 'POPULATION_GL_SOURCE';
      case 'SAMPLE_LIST':
        return 'SAMPLE_POPULATION_MISMATCH';
      case 'CONTROLS_STRATEGY':
        return 'CONTROLS_DECISION_MISSING';
      case 'OVERALL_RESPONSE':
        return 'STRATEGY_RISK_DISCONNECT';
      default:
        return 'RISK_PROCEDURE_UNLINKED';
    }
  }

  detectBreaksFromGraph(): void {
    if (!this.chainGraph) return;

    const graph = this.chainGraph;

    for (const orphan of graph.orphanNodes) {
      const existingBreak = this.breakRegister.find(b => 
        b.sourceId === orphan.entityId && 
        (b.category === 'EVIDENCE_ORPHAN' || b.description.includes('Orphan'))
      );
      if (existingBreak) continue;

      const severity = this.getOrphanSeverity(orphan.nodeType);
      const category = this.getOrphanCategory(orphan.nodeType);

      this.addBreak({
        severity,
        category,
        chainLevel: 'ASSERTION_TRACK',
        sourceEntity: orphan.nodeType,
        sourceId: orphan.entityId,
        targetEntity: null,
        targetId: null,
        description: `Orphan ${orphan.nodeType} "${orphan.entityName}" detected without proper chain linkage`,
        isaReference: ISA_REFERENCE_MAP[category],
        autoRepairable: orphan.nodeType === 'EVIDENCE',
        repairAction: this.getOrphanRepairAction(orphan.nodeType),
      });
    }

    for (const [fsHeadId, track] of graph.assertionTracks) {
      this.validateAssertionTrackLinkages(track);
    }

    this.validatePopulationSourceLinks(graph);
    this.validateSamplePopulationMembership(graph);
  }

  private validateAssertionTrackLinkages(track: ChainNode[]): void {
    const fsHead = track.find(n => n.nodeType === 'FS_HEAD');
    const rmm = track.find(n => n.nodeType === 'RMM');
    const procedures = track.filter(n => n.nodeType === 'PROCEDURE');
    const evidence = track.filter(n => n.nodeType === 'EVIDENCE');
    const results = track.filter(n => n.nodeType === 'RESULT');

    if (fsHead && !rmm && procedures.length > 0) {
      const existingBreak = this.breakRegister.find(b => 
        b.sourceId === fsHead.entityId && b.category === 'RMM_INCOMPLETE'
      );
      if (!existingBreak) {
        this.addBreak({
          severity: 'HIGH',
          category: 'RMM_INCOMPLETE',
          chainLevel: 'ASSERTION_TRACK',
          sourceEntity: 'FS_HEAD',
          sourceId: fsHead.entityId,
          targetEntity: 'RMM',
          targetId: null,
          description: `FS Head "${fsHead.entityName}" has procedures but no RMM - chain link missing between FS Head and Procedures`,
          isaReference: ISA_REFERENCE_MAP.RMM_INCOMPLETE,
          autoRepairable: true,
          repairAction: 'Assess RMM before defining procedures',
        });
      }
    }

    for (const proc of procedures) {
      const procEvidence = evidence.filter(e => 
        e.parentLinks.some(l => l.nodeId === proc.nodeId)
      );
      const procResults = results.filter(r => 
        r.parentLinks.some(l => l.nodeId === proc.nodeId)
      );

      if (proc.metadata?.conclusion && procEvidence.length === 0 && procResults.length === 0) {
        const existingBreak = this.breakRegister.find(b => 
          b.sourceId === proc.entityId && b.category === 'CONCLUSION_NO_EVIDENCE'
        );
        if (!existingBreak) {
          this.addBreak({
            severity: 'HIGH',
            category: 'CONCLUSION_NO_EVIDENCE',
            chainLevel: 'ASSERTION_TRACK',
            sourceEntity: 'PROCEDURE',
            sourceId: proc.entityId,
            targetEntity: 'EVIDENCE',
            targetId: null,
            description: `Procedure "${proc.entityName}" concluded without evidence or results in track`,
            isaReference: ISA_REFERENCE_MAP.CONCLUSION_NO_EVIDENCE,
            autoRepairable: false,
            repairAction: 'Add supporting evidence before concluding',
          });
        }
      }
    }
  }

  private validatePopulationSourceLinks(graph: ChainGraph): void {
    const populations = Array.from(graph.nodes.values()).filter(n => n.nodeType === 'POPULATION');

    for (const pop of populations) {
      const hasGlSource = pop.metadata?.sourceType === 'GL_JOURNAL' || 
                          pop.metadata?.sourceType === 'GL_ENTRY' ||
                          pop.parentLinks.some(l => l.linkType === 'DERIVED_FROM_GL');

      if (!hasGlSource && !pop.metadata?.filterJson) {
        this.addBreak({
          severity: 'HIGH',
          category: 'POPULATION_GL_SOURCE',
          chainLevel: 'ASSERTION_TRACK',
          sourceEntity: 'POPULATION',
          sourceId: pop.entityId,
          targetEntity: 'GL_SOURCE',
          targetId: null,
          description: `Population "${pop.entityName}" has no defined GL/sub-ledger source`,
          isaReference: ISA_REFERENCE_MAP.POPULATION_GL_SOURCE,
          autoRepairable: true,
          repairAction: 'Define population source from GL or sub-ledger',
        });
      }
    }
  }

  private validateSamplePopulationMembership(graph: ChainGraph): void {
    const samples = Array.from(graph.nodes.values()).filter(n => n.nodeType === 'SAMPLE_LIST');
    const populations = Array.from(graph.nodes.values()).filter(n => n.nodeType === 'POPULATION');

    for (const sample of samples) {
      const populationLink = sample.parentLinks.find(l => l.linkType === 'SELECTED_FROM');
      
      if (!populationLink) {
        const popId = sample.metadata?.populationId as string;
        const matchingPop = populations.find(p => p.entityId === popId);

        if (!matchingPop) {
          this.addBreak({
            severity: 'MEDIUM',
            category: 'SAMPLE_POPULATION_MISMATCH',
            chainLevel: 'ASSERTION_TRACK',
            sourceEntity: 'SAMPLE_LIST',
            sourceId: sample.entityId,
            targetEntity: 'POPULATION',
            targetId: popId || null,
            description: `Sample "${sample.entityName}" is not linked to a valid population`,
            isaReference: ISA_REFERENCE_MAP.SAMPLE_POPULATION_MISMATCH,
            autoRepairable: false,
            repairAction: 'Link sample to valid population or regenerate sample',
          });
        }
      }
    }
  }

  private getOrphanRepairAction(nodeType: ChainNodeType): string {
    switch (nodeType) {
      case 'EVIDENCE':
        return 'Link evidence to appropriate procedure';
      case 'PROCEDURE':
        return 'Link procedure to FS Head and RMM assessment';
      case 'RMM':
        return 'Link RMM to FS Head and define responsive procedures';
      case 'POPULATION':
        return 'Define population source and link to procedure';
      case 'SAMPLE_LIST':
        return 'Link sample to population and procedure';
      case 'CONCLUSION':
        return 'Link conclusion to supporting evidence and results';
      default:
        return 'Establish required chain linkages';
    }
  }

  private async detectMaterialityCascadeBreaks(engagementId: string): Promise<void> {
    const materialitySet = await prisma.materialitySet.findFirst({
      where: { engagementId, status: { in: ['APPROVED', 'LOCKED'] } },
      orderBy: { versionId: 'desc' },
    });

    if (!materialitySet) return;

    const fsHeads = await prisma.fSHeadWorkingPaper.findMany({
      where: { engagementId },
    });

    for (const fsHead of fsHeads) {
      if (fsHead.overallMateriality && materialitySet.overallMateriality) {
        const allocated = Number(fsHead.overallMateriality);
        const overall = Number(materialitySet.overallMateriality);
        
        if (allocated > overall) {
          this.addBreak({
            severity: 'HIGH',
            category: 'MATERIALITY_CASCADE',
            chainLevel: 'ASSERTION_TRACK',
            sourceEntity: 'FSHeadWorkingPaper',
            sourceId: fsHead.id,
            targetEntity: 'MaterialitySet',
            targetId: materialitySet.id,
            description: `FS Head allocated materiality (${allocated}) exceeds overall materiality (${overall})`,
            isaReference: 'ISA 320.11',
            autoRepairable: true,
            repairAction: 'Recalculate allocated materiality within overall threshold',
          });
        }
      }
    }
  }

  private async detectMappingBreaks(engagementId: string): Promise<void> {
    const accounts = await prisma.coAAccount.findMany({
      where: { engagementId },
    });

    const fsHeads = await prisma.fSHeadWorkingPaper.findMany({
      where: { engagementId },
    });

    const fsHeadKeys = new Set(fsHeads.map(f => f.fsHeadKey));

    const unmappedAccounts = accounts.filter(a => !a.fsLineItem || a.fsLineItem.trim() === '');
    
    if (unmappedAccounts.length > 0) {
      const totalBalance = unmappedAccounts.reduce((sum, a) => 
        sum + Math.abs(Number(a.closingBalance || 0)), 0
      );
      
      this.addBreak({
        severity: totalBalance > 0 ? 'HIGH' : 'MEDIUM',
        category: 'MAPPING_COA_FS',
        chainLevel: 'ASSERTION_TRACK',
        sourceEntity: 'CoAAccount',
        sourceId: 'multiple',
        targetEntity: 'FSHead',
        targetId: null,
        description: `${unmappedAccounts.length} CoA account(s) not mapped to any FS line item (total balance: ${totalBalance.toFixed(2)})`,
        isaReference: 'ISA 315.A128',
        autoRepairable: false,
        repairAction: 'Map accounts to appropriate FS line items',
      });
    }

    const mismappedAccounts = accounts.filter(a => 
      a.fsLineItem && !fsHeadKeys.has(a.fsLineItem)
    );

    if (mismappedAccounts.length > 0) {
      this.addBreak({
        severity: 'HIGH',
        category: 'MAPPING_COA_FS',
        chainLevel: 'ASSERTION_TRACK',
        sourceEntity: 'CoAAccount',
        sourceId: 'multiple',
        targetEntity: 'FSHeadWorkingPaper',
        targetId: null,
        description: `${mismappedAccounts.length} account(s) mapped to non-existent FS heads`,
        isaReference: 'ISA 315.A128',
        autoRepairable: true,
        repairAction: 'Create missing FS head working papers or remap accounts',
      });
    }
  }

  private async detectEvidenceOrphans(engagementId: string): Promise<void> {
    const evidence = await prisma.evidenceFile.findMany({
      where: { engagementId },
    });

    const orphanedEvidence: typeof evidence = [];

    for (const ev of evidence) {
      const hasLinks = await this.checkEvidenceLinks(ev.id);
      if (!hasLinks) {
        orphanedEvidence.push(ev);
      }
    }

    if (orphanedEvidence.length > 0) {
      this.addBreak({
        severity: 'MEDIUM',
        category: 'EVIDENCE_ORPHAN',
        chainLevel: 'ASSERTION_TRACK',
        sourceEntity: 'EvidenceFile',
        sourceId: 'multiple',
        targetEntity: null,
        targetId: null,
        description: `${orphanedEvidence.length} evidence file(s) not linked to any procedure or working paper`,
        isaReference: 'ISA 500.6',
        autoRepairable: false,
        repairAction: 'Link evidence to relevant procedures or mark as general documentation',
      });
    }
  }

  private async checkEvidenceLinks(evidenceId: string): Promise<boolean> {
    const outputLinks = await prisma.outputEvidence.count({
      where: { evidenceId },
    });
    if (outputLinks > 0) return true;

    const obsLinks = await prisma.observationEvidence.count({
      where: { evidenceFileId: evidenceId },
    });
    if (obsLinks > 0) return true;

    return false;
  }

  private async performAutoRepairs(engagementId: string): Promise<void> {
    const repairableBreaks = this.breakRegister
      .filter(b => b.autoRepairable)
      .sort((a, b) => this.getAuthorityLevel(a.category) - this.getAuthorityLevel(b.category));

    await this.logAuditTrail(
      engagementId,
      'AUTO_REPAIR_START',
      'Engagement',
      engagementId,
      `Starting auto-repair for ${repairableBreaks.length} breaks (authority order: Materiality → Evidence)`
    );

    for (const brk of repairableBreaks) {
      const lockStatus = await this.checkLockStatus(brk.sourceEntity, brk.sourceId, engagementId);
      
      if (lockStatus === 'HARD' || lockStatus === 'ARCHIVE') {
        brk.autoRepairable = false;
        brk.repairAction = `Cannot auto-repair: ${lockStatus} lock active. Create new version.`;
        continue;
      }

      await this.repairBreakByAuthority(engagementId, brk);
    }

    await this.logAuditTrail(
      engagementId,
      'AUTO_REPAIR_COMPLETE',
      'Engagement',
      engagementId,
      `Completed auto-repair: ${this.repairLog.length} repairs, ${this.regeneratedArtifacts.length} artifacts generated`
    );
  }

  private async repairBreakByAuthority(engagementId: string, brk: ChainBreak): Promise<void> {
    const authorityLevel = this.getAuthorityLevel(brk.category);

    switch (authorityLevel) {
      case AUTHORITY_HIERARCHY.MATERIALITY:
        await this.repairMaterialityIssues(engagementId, brk);
        break;
      case AUTHORITY_HIERARCHY.MAPPING:
        await this.repairMappingIssues(engagementId, brk);
        break;
      case AUTHORITY_HIERARCHY.RISKS:
        await this.repairRiskIssues(engagementId, brk);
        break;
      case AUTHORITY_HIERARCHY.CONTROLS_STRATEGY:
        await this.repairControlsStrategyIssues(engagementId, brk);
        break;
      case AUTHORITY_HIERARCHY.SAMPLING:
        if (brk.category === 'POPULATION_GL_SOURCE') {
          await this.repairPopulationIssues(engagementId, brk);
        } else if (brk.category === 'SAMPLE_POPULATION_MISMATCH') {
          await this.repairSamplingIssues(engagementId, brk);
        }
        break;
      case AUTHORITY_HIERARCHY.AUDIT_PROGRAM:
        await this.repairAuditProgramIssues(engagementId, brk);
        break;
      case AUTHORITY_HIERARCHY.EVIDENCE:
        await this.repairEvidenceIssues(engagementId, brk);
        break;
      default:
        await this.repairBreak(engagementId, brk);
    }
  }

  private async repairMaterialityIssues(engagementId: string, brk: ChainBreak): Promise<void> {
    const beforeState: Record<string, unknown> = {};
    const afterState: Record<string, unknown> = {};

    try {
      const existingMateriality = await prisma.materialitySet.findFirst({
        where: { engagementId },
        orderBy: { versionId: 'desc' },
      });

      beforeState.hasMateriality = !!existingMateriality;
      beforeState.currentValue = existingMateriality ? Number(existingMateriality.overallMateriality) : null;

      if (!existingMateriality) {
        const financials = await prisma.trialBalance.findFirst({
          where: { engagementId },
          include: { entries: true },
        });

        let draftMateriality = 50000;
        let benchmark = 'DEFAULT';
        let benchmarkValue = 0;

        if (financials?.entries) {
          const revenueEntries = financials.entries.filter(e => 
            e.accountCode?.toLowerCase().includes('revenue') || 
            e.accountCode?.toLowerCase().includes('sales') ||
            e.lineItemName?.toLowerCase().includes('revenue')
          );
          const totalRevenue = revenueEntries.reduce((sum, e) => sum + Math.abs(Number(e.creditAmount || 0)), 0);

          const assetEntries = financials.entries.filter(e =>
            e.accountCode?.toLowerCase().includes('asset') ||
            e.lineItemName?.toLowerCase().includes('asset')
          );
          const totalAssets = assetEntries.reduce((sum, e) => sum + Math.abs(Number(e.debitAmount || 0)), 0);

          if (totalRevenue > 0) {
            draftMateriality = totalRevenue * 0.05;
            benchmark = 'REVENUE';
            benchmarkValue = totalRevenue;
          } else if (totalAssets > 0) {
            draftMateriality = totalAssets * 0.01;
            benchmark = 'TOTAL_ASSETS';
            benchmarkValue = totalAssets;
          }
        }

        const newMaterialitySet = await prisma.materialitySet.create({
          data: {
            engagementId,
            overallMateriality: new Prisma.Decimal(draftMateriality),
            performanceMateriality: new Prisma.Decimal(draftMateriality * 0.75),
            trivialThreshold: new Prisma.Decimal(draftMateriality * 0.05),
            basis: benchmark,
            basisValue: new Prisma.Decimal(benchmarkValue),
            percentage: benchmark === 'REVENUE' ? new Prisma.Decimal(5) : new Prisma.Decimal(1),
            status: 'DRAFT',
            versionId: 1,
            notes: `Auto-generated materiality using ${benchmark} benchmark. NEEDS_REVIEW before approval.`,
          },
        });

        afterState.materialityId = newMaterialitySet.id;
        afterState.overallMateriality = draftMateriality;
        afterState.benchmark = benchmark;
        afterState.status = 'DRAFT';

        this.regeneratedArtifacts.push({
          artifactType: 'MaterialitySet',
          artifactId: newMaterialitySet.id,
          linkedTo: [{ entity: 'Engagement', id: engagementId }],
          createdAt: new Date(),
          reason: `Auto-generated draft materiality: ${draftMateriality.toFixed(0)} (${benchmark} * ${benchmark === 'REVENUE' ? '5%' : '1%'})`,
        });
      } else if (brk.category === 'MATERIALITY_CASCADE') {
        await this.repairMaterialityCascade(engagementId, brk, beforeState, afterState);
      }

      this.repairLog.push({
        id: `repair-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        breakId: brk.id,
        repairType: existingMateriality ? 'CASCADE_PROPAGATE' : 'REGENERATE_ARTIFACT',
        entityType: 'MaterialitySet',
        entityId: brk.sourceId,
        beforeState,
        afterState,
        reason: brk.description,
        authorityLevel: AUTHORITY_HIERARCHY.MATERIALITY,
        performedAt: new Date(),
        performedBy: this.userId,
      });

      brk.autoRepairable = false;
      brk.repairAction = 'REPAIRED';

    } catch (error) {
      console.error(`Failed to repair materiality issue ${brk.id}:`, error);
    }
  }

  private async repairMappingIssues(engagementId: string, brk: ChainBreak): Promise<void> {
    const beforeState: Record<string, unknown> = {};
    const afterState: Record<string, unknown> = {};

    try {
      if (brk.description.includes('non-existent FS heads')) {
        const accounts = await prisma.coAAccount.findMany({
          where: { engagementId },
        });

        const fsHeads = await prisma.fSHeadWorkingPaper.findMany({
          where: { engagementId },
        });

        const fsHeadKeys = new Set(fsHeads.map(f => f.fsHeadKey));
        const mismappedAccounts = accounts.filter(a => 
          a.fsLineItem && !fsHeadKeys.has(a.fsLineItem)
        );

        beforeState.mismappedCount = mismappedAccounts.length;

        const missingFsHeadKeys = [...new Set(mismappedAccounts.map(a => a.fsLineItem).filter(Boolean))];
        const created: string[] = [];

        for (const key of missingFsHeadKeys) {
          if (!key) continue;

          const existingFsHead = await prisma.fSHeadWorkingPaper.findFirst({
            where: { engagementId, fsHeadKey: key },
          });

          if (existingFsHead && existingFsHead.status === 'APPROVED') {
            const newVersion = await prisma.fSHeadWorkingPaper.create({
              data: {
                engagementId,
                fsHeadKey: key,
                fsHeadName: this.generateFsHeadName(key),
                status: 'DRAFT',
                inherentRisk: 'MODERATE',
                controlRisk: 'MODERATE',
                combinedRiskAssessment: 'MODERATE',
              },
            });
            created.push(newVersion.id);
          } else if (!existingFsHead) {
            const priorMapping = await this.findSimilarMapping(engagementId, key);

            const newFsHead = await prisma.fSHeadWorkingPaper.create({
              data: {
                engagementId,
                fsHeadKey: key,
                fsHeadName: priorMapping?.fsHeadName || this.generateFsHeadName(key),
                status: 'DRAFT',
                inherentRisk: priorMapping?.inherentRisk || 'MODERATE',
                controlRisk: priorMapping?.controlRisk || 'MODERATE',
                combinedRiskAssessment: priorMapping?.combinedRiskAssessment || 'MODERATE',
              },
            });

            created.push(newFsHead.id);

            this.regeneratedArtifacts.push({
              artifactType: 'FSHeadWorkingPaper',
              artifactId: newFsHead.id,
              linkedTo: mismappedAccounts
                .filter(a => a.fsLineItem === key)
                .map(a => ({ entity: 'CoAAccount', id: a.id })),
              createdAt: new Date(),
              reason: `Auto-created FS head for mapped accounts with key "${key}"${priorMapping ? ' (based on similar mapping)' : ''}`,
            });
          }
        }

        afterState.createdFsHeads = created;
        afterState.status = 'NEEDS_REVIEW';
      }

      this.repairLog.push({
        id: `repair-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        breakId: brk.id,
        repairType: 'REGENERATE_ARTIFACT',
        entityType: brk.sourceEntity,
        entityId: brk.sourceId,
        beforeState,
        afterState,
        reason: brk.description,
        authorityLevel: AUTHORITY_HIERARCHY.MAPPING,
        performedAt: new Date(),
        performedBy: this.userId,
      });

      brk.autoRepairable = false;
      brk.repairAction = 'REPAIRED';

    } catch (error) {
      console.error(`Failed to repair mapping issue ${brk.id}:`, error);
    }
  }

  private async findSimilarMapping(engagementId: string, fsHeadKey: string): Promise<{
    fsHeadName: string;
    inherentRisk: string | null;
    controlRisk: string | null;
    combinedRiskAssessment: string | null;
  } | null> {
    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId },
      include: { client: true },
    });

    if (!engagement?.clientId) return null;

    const priorEngagements = await prisma.engagement.findMany({
      where: {
        clientId: engagement.clientId,
        id: { not: engagementId },
      },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });

    for (const prior of priorEngagements) {
      const similarFsHead = await prisma.fSHeadWorkingPaper.findFirst({
        where: {
          engagementId: prior.id,
          OR: [
            { fsHeadKey },
            { fsHeadKey: { contains: fsHeadKey.substring(0, 3), mode: 'insensitive' } },
          ],
        },
      });

      if (similarFsHead) {
        return {
          fsHeadName: similarFsHead.fsHeadName,
          inherentRisk: similarFsHead.inherentRisk,
          controlRisk: similarFsHead.controlRisk,
          combinedRiskAssessment: similarFsHead.combinedRiskAssessment,
        };
      }
    }

    return null;
  }

  private async repairRiskIssues(engagementId: string, brk: ChainBreak): Promise<void> {
    const beforeState: Record<string, unknown> = {};
    const afterState: Record<string, unknown> = {};

    try {
      if (brk.category === 'ASSERTION_MISSING') {
        const fsHead = await prisma.fSHeadWorkingPaper.findUnique({
          where: { id: brk.sourceId },
        });

        if (!fsHead) return;

        beforeState.inherentRisk = fsHead.inherentRisk;
        beforeState.controlRisk = fsHead.controlRisk;
        beforeState.hasAssertions = false;

        const defaultAssertions = this.getDefaultAssertions(fsHead.fsHeadKey);

        await prisma.fSHeadWorkingPaper.update({
          where: { id: brk.sourceId },
          data: {
            inherentRisk: fsHead.inherentRisk || 'MODERATE',
            controlRisk: fsHead.controlRisk || 'MODERATE',
            combinedRiskAssessment: this.computeCombinedRisk(
              fsHead.inherentRisk || 'MODERATE',
              fsHead.controlRisk || 'MODERATE'
            ),
          },
        });

        afterState.inherentRisk = fsHead.inherentRisk || 'MODERATE';
        afterState.controlRisk = fsHead.controlRisk || 'MODERATE';
        afterState.assertions = defaultAssertions;
        afterState.status = 'NEEDS_REVIEW';
      } else if (brk.category === 'RMM_INCOMPLETE') {
        const fsHead = await prisma.fSHeadWorkingPaper.findUnique({
          where: { id: brk.sourceId },
        });

        if (!fsHead) return;

        beforeState.inherentRisk = fsHead.inherentRisk;
        beforeState.controlRisk = fsHead.controlRisk;

        const existingRisks = await prisma.riskAssessment.findMany({
          where: {
            engagementId,
            accountOrClass: fsHead.fsHeadKey,
          },
        });

        if (existingRisks.length === 0) {
          const justificationRecord = await prisma.riskAssessment.create({
            data: {
              engagementId,
              accountOrClass: fsHead.fsHeadKey,
              assertion: 'ALL',
              riskDescription: `No specific RMM identified for ${fsHead.fsHeadName}. Standard audit procedures apply.`,
              inherentRisk: 'LOW',
              controlRisk: 'LOW',
              riskOfMaterialMisstatement: 'LOW',
              plannedResponse: 'Perform standard substantive procedures based on FS head characteristics',
              assessedById: this.userId,
              status: 'DRAFT',
            },
          });

          afterState.justificationRecordId = justificationRecord.id;
          afterState.riskDescription = 'No identified RMM - standard procedures';
        }

        await prisma.fSHeadWorkingPaper.update({
          where: { id: brk.sourceId },
          data: {
            inherentRisk: fsHead.inherentRisk || 'MODERATE',
            controlRisk: fsHead.controlRisk || 'MODERATE',
            combinedRiskAssessment: this.computeCombinedRisk(
              fsHead.inherentRisk || 'MODERATE',
              fsHead.controlRisk || 'MODERATE'
            ),
          },
        });

        afterState.inherentRisk = fsHead.inherentRisk || 'MODERATE';
        afterState.controlRisk = fsHead.controlRisk || 'MODERATE';
        afterState.status = 'NEEDS_REVIEW';
      }

      this.repairLog.push({
        id: `repair-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        breakId: brk.id,
        repairType: 'UPDATE_STATUS',
        entityType: brk.sourceEntity,
        entityId: brk.sourceId,
        beforeState,
        afterState,
        reason: brk.description,
        authorityLevel: AUTHORITY_HIERARCHY.RISKS,
        performedAt: new Date(),
        performedBy: this.userId,
      });

      brk.autoRepairable = false;
      brk.repairAction = 'REPAIRED';

    } catch (error) {
      console.error(`Failed to repair risk issue ${brk.id}:`, error);
    }
  }

  private getDefaultAssertions(fsHeadKey: string): string[] {
    const key = fsHeadKey.toUpperCase();
    
    if (key.includes('REVENUE') || key.includes('SALES')) {
      return ['OCCURRENCE', 'COMPLETENESS', 'ACCURACY', 'CUT_OFF', 'CLASSIFICATION'];
    } else if (key.includes('RECEIVABLE') || key.includes('AR')) {
      return ['EXISTENCE', 'COMPLETENESS', 'VALUATION', 'RIGHTS'];
    } else if (key.includes('CASH') || key.includes('BANK')) {
      return ['EXISTENCE', 'COMPLETENESS', 'RIGHTS'];
    } else if (key.includes('INVENTORY') || key.includes('STOCK')) {
      return ['EXISTENCE', 'COMPLETENESS', 'VALUATION', 'RIGHTS'];
    } else if (key.includes('PAYABLE') || key.includes('AP')) {
      return ['COMPLETENESS', 'EXISTENCE', 'VALUATION', 'OBLIGATIONS'];
    } else if (key.includes('PPE') || key.includes('FIXED') || key.includes('ASSET')) {
      return ['EXISTENCE', 'COMPLETENESS', 'VALUATION', 'RIGHTS'];
    } else {
      return ['EXISTENCE', 'COMPLETENESS', 'ACCURACY', 'VALUATION'];
    }
  }

  private async repairControlsStrategyIssues(engagementId: string, brk: ChainBreak): Promise<void> {
    const beforeState: Record<string, unknown> = {};
    const afterState: Record<string, unknown> = {};

    try {
      const auditStrategy = await prisma.auditStrategy.findFirst({
        where: { engagementId },
      });

      if (!auditStrategy) return;

      beforeState.controlsReliance = auditStrategy.controlsReliance;
      beforeState.substantiveApproach = auditStrategy.substantiveApproach;

      const controlProcedures = await prisma.fSHeadProcedure.findMany({
        where: {
          workingPaper: { engagementId },
          nature: { in: ['TOC', 'TEST_OF_CONTROLS', 'CONTROLS_TEST'] },
        },
      });

      const hasControlTests = controlProcedures.length > 0;

      if (hasControlTests && !auditStrategy.controlsReliance) {
        await prisma.auditStrategy.update({
          where: { id: auditStrategy.id },
          data: {
            controlsReliance: 'YES',
            status: 'DRAFT',
          },
        });
        afterState.controlsReliance = 'YES';
        afterState.message = 'Controls reliance indicated based on existing ToC procedures';
      } else if (!hasControlTests) {
        const substantiveProcedures = await prisma.fSHeadProcedure.findMany({
          where: {
            workingPaper: { engagementId },
            nature: { in: ['TOD', 'TEST_OF_DETAILS', 'SUBSTANTIVE'] },
          },
        });

        if (substantiveProcedures.length < 5) {
          afterState.warning = 'Substantive-only approach but limited procedures exist';
          afterState.recommendation = 'Consider strengthening substantive procedures';
        }

        await prisma.auditStrategy.update({
          where: { id: auditStrategy.id },
          data: {
            controlsReliance: 'NO',
            substantiveApproach: 'SUBSTANTIVE_ONLY',
            status: 'DRAFT',
          },
        });
        afterState.controlsReliance = 'NO';
        afterState.substantiveApproach = 'SUBSTANTIVE_ONLY';
      }

      afterState.status = 'NEEDS_REVIEW';

      this.repairLog.push({
        id: `repair-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        breakId: brk.id,
        repairType: 'UPDATE_STATUS',
        entityType: 'AuditStrategy',
        entityId: auditStrategy.id,
        beforeState,
        afterState,
        reason: brk.description,
        authorityLevel: AUTHORITY_HIERARCHY.CONTROLS_STRATEGY,
        performedAt: new Date(),
        performedBy: this.userId,
      });

      brk.autoRepairable = false;
      brk.repairAction = 'REPAIRED';

    } catch (error) {
      console.error(`Failed to repair controls strategy issue ${brk.id}:`, error);
    }
  }

  private async repairPopulationIssues(engagementId: string, brk: ChainBreak): Promise<void> {
    const beforeState: Record<string, unknown> = {};
    const afterState: Record<string, unknown> = {};

    try {
      const procedure = await prisma.fSHeadProcedure.findUnique({
        where: { id: brk.sourceId },
        include: { workingPaper: true },
      });

      if (!procedure || !procedure.workingPaper) return;

      beforeState.populationCount = 0;
      beforeState.hasGlSource = false;

      const accounts = await prisma.coAAccount.findMany({
        where: {
          engagementId,
          fsLineItem: procedure.workingPaper.fsHeadKey,
        },
      });

      const glEntries = await prisma.gLEntry.findMany({
        where: {
          engagementId,
          accountCode: { in: accounts.map(a => a.accountCode) },
        },
      });

      if (glEntries.length === 0) {
        afterState.populationCount = 0;
        afterState.reason = 'No GL entries found for mapped accounts';
        return;
      }

      const snapshotId = `snapshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const totalValue = glEntries.reduce((sum, e) => 
        sum + Math.abs(Number(e.debitAmount || 0)) + Math.abs(Number(e.creditAmount || 0)), 0
      );

      const population = await (prisma as any).populationDefinition?.create({
        data: {
          engagementId,
          fsHeadId: procedure.workingPaper.id,
          procedureId: procedure.id,
          name: `Auto-generated population for ${procedure.procedureRef || procedure.description?.substring(0, 30)}`,
          sourceType: 'GL_JOURNAL',
          filterJson: { 
            accountCodes: accounts.map(a => a.accountCode),
            snapshotId,
            generatedAt: new Date().toISOString(),
          },
          status: 'ACTIVE',
          itemCount: glEntries.length,
          totalValue: new Prisma.Decimal(totalValue),
          completenessProof: `Generated from ${glEntries.length} GL entries totaling ${totalValue.toFixed(2)}`,
          createdById: this.userId,
        },
      });

      if (population) {
        this.regeneratedArtifacts.push({
          artifactType: 'PopulationDefinition',
          artifactId: population.id,
          linkedTo: [
            { entity: 'FSHeadProcedure', id: procedure.id },
            { entity: 'FSHeadWorkingPaper', id: procedure.workingPaper.id },
          ],
          createdAt: new Date(),
          reason: `Auto-generated population from GL entries with snapshot ${snapshotId}`,
        });

        afterState.populationId = population.id;
        afterState.itemCount = glEntries.length;
        afterState.totalValue = totalValue;
        afterState.snapshotId = snapshotId;
      }

      this.repairLog.push({
        id: `repair-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        breakId: brk.id,
        repairType: 'REGENERATE_ARTIFACT',
        entityType: 'PopulationDefinition',
        entityId: population?.id || brk.sourceId,
        beforeState,
        afterState,
        reason: brk.description,
        authorityLevel: AUTHORITY_HIERARCHY.SAMPLING,
        performedAt: new Date(),
        performedBy: this.userId,
      });

      brk.autoRepairable = false;
      brk.repairAction = 'REPAIRED';

    } catch (error) {
      console.error(`Failed to repair population issue ${brk.id}:`, error);
    }
  }

  private async repairSamplingIssues(engagementId: string, brk: ChainBreak): Promise<void> {
    const beforeState: Record<string, unknown> = {};
    const afterState: Record<string, unknown> = {};

    try {
      if (brk.description.includes('no sample generated')) {
        await this.repairMissingSample(engagementId, brk, beforeState, afterState);
      } else if (brk.description.includes('not linked to a valid population')) {
        const sample = await (prisma as any).sample?.findUnique({
          where: { id: brk.sourceId },
        });

        if (sample) {
          beforeState.sampleId = sample.id;
          beforeState.status = sample.status;

          await this.markAsInactive('Sample', sample.id, 'Superseded - not linked to valid population');

          const procedure = await prisma.fSHeadProcedure.findUnique({
            where: { id: sample.procedureId },
            include: { workingPaper: true },
          });

          if (procedure) {
            const population = await (prisma as any).populationDefinition?.findFirst({
              where: { procedureId: procedure.id },
            });

            if (population) {
              const newSample = await (prisma as any).sample?.create({
                data: {
                  engagementId,
                  populationId: population.id,
                  fsHeadId: procedure.workingPaper?.id,
                  procedureId: procedure.id,
                  method: sample.method || 'MUS',
                  targetSize: sample.targetSize || 25,
                  actualSize: 0,
                  status: 'GENERATED',
                  createdById: this.userId,
                },
              });

              if (newSample) {
                afterState.newSampleId = newSample.id;
                afterState.linkedPopulationId = population.id;

                this.regeneratedArtifacts.push({
                  artifactType: 'Sample',
                  artifactId: newSample.id,
                  linkedTo: [
                    { entity: 'PopulationDefinition', id: population.id },
                    { entity: 'FSHeadProcedure', id: procedure.id },
                  ],
                  createdAt: new Date(),
                  reason: 'Regenerated sample to replace invalid/orphan sample',
                });
              }
            }
          }
        }
      }

      this.repairLog.push({
        id: `repair-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        breakId: brk.id,
        repairType: beforeState.sampleId ? 'MARK_INACTIVE' : 'REGENERATE_ARTIFACT',
        entityType: 'Sample',
        entityId: brk.sourceId,
        beforeState,
        afterState,
        reason: brk.description,
        authorityLevel: AUTHORITY_HIERARCHY.SAMPLING,
        performedAt: new Date(),
        performedBy: this.userId,
        inactiveReason: beforeState.sampleId ? 'Superseded - not linked to valid population' : undefined,
      });

      brk.autoRepairable = false;
      brk.repairAction = 'REPAIRED';

    } catch (error) {
      console.error(`Failed to repair sampling issue ${brk.id}:`, error);
    }
  }

  private async repairAuditProgramIssues(engagementId: string, brk: ChainBreak): Promise<void> {
    const beforeState: Record<string, unknown> = {};
    const afterState: Record<string, unknown> = {};

    try {
      if (brk.sourceEntity === 'FSHeadWorkingPaper') {
        await this.repairMissingProcedures(engagementId, brk, beforeState, afterState);
      } else if (brk.sourceEntity === 'PROCEDURE' || brk.sourceEntity === 'FSHeadProcedure') {
        const procedure = await prisma.fSHeadProcedure.findUnique({
          where: { id: brk.sourceId },
          include: { workingPaper: true },
        });

        if (!procedure) return;

        beforeState.procedureId = procedure.id;
        beforeState.hasSampleLink = false;

        const sample = await (prisma as any).sample?.findFirst({
          where: { procedureId: procedure.id },
        });

        if (!sample) {
          const riskAssessment = await prisma.riskAssessment.findFirst({
            where: {
              engagementId,
              accountOrClass: procedure.workingPaper?.fsHeadKey,
            },
          });

          const isLowRisk = riskAssessment?.riskOfMaterialMisstatement === 'LOW';

          if (isLowRisk) {
            await prisma.fSHeadProcedure.update({
              where: { id: procedure.id },
              data: {
                nonSamplingJustification: 'Low risk area - analytical procedures sufficient without detailed sampling',
              },
            });
            afterState.nonSamplingJustification = 'Low risk - analytical sufficient';
          } else {
            const population = await (prisma as any).populationDefinition?.findFirst({
              where: { procedureId: procedure.id },
            });

            if (population) {
              const newSample = await (prisma as any).sample?.create({
                data: {
                  engagementId,
                  populationId: population.id,
                  fsHeadId: procedure.workingPaper?.id,
                  procedureId: procedure.id,
                  method: 'MUS',
                  targetSize: 25,
                  actualSize: 0,
                  status: 'GENERATED',
                  createdById: this.userId,
                },
              });

              if (newSample) {
                afterState.linkedSampleId = newSample.id;

                this.regeneratedArtifacts.push({
                  artifactType: 'Sample',
                  artifactId: newSample.id,
                  linkedTo: [{ entity: 'FSHeadProcedure', id: procedure.id }],
                  createdAt: new Date(),
                  reason: 'Auto-linked sample to orphan procedure',
                });
              }
            }
          }
        }
      }

      this.repairLog.push({
        id: `repair-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        breakId: brk.id,
        repairType: 'REGENERATE_ARTIFACT',
        entityType: brk.sourceEntity,
        entityId: brk.sourceId,
        beforeState,
        afterState,
        reason: brk.description,
        authorityLevel: AUTHORITY_HIERARCHY.AUDIT_PROGRAM,
        performedAt: new Date(),
        performedBy: this.userId,
      });

      brk.autoRepairable = false;
      brk.repairAction = 'REPAIRED';

    } catch (error) {
      console.error(`Failed to repair audit program issue ${brk.id}:`, error);
    }
  }

  private async repairEvidenceIssues(engagementId: string, brk: ChainBreak): Promise<void> {
    const beforeState: Record<string, unknown> = {};
    const afterState: Record<string, unknown> = {};

    try {
      const orphanEvidence = await prisma.evidenceFile.findMany({
        where: {
          engagementId,
          procedureId: null,
        },
      });

      beforeState.orphanCount = orphanEvidence.length;
      const linkedCount = 0;
      const needsReviewCount = 0;

      for (const evidence of orphanEvidence) {
        const matchedProcedure = await this.findBestMatchingProcedure(engagementId, evidence);

        if (matchedProcedure) {
          await prisma.evidenceFile.update({
            where: { id: evidence.id },
            data: {
              procedureId: matchedProcedure.id,
              status: 'NEEDS_REVIEW',
            },
          });

          this.regeneratedArtifacts.push({
            artifactType: 'EvidenceLink',
            artifactId: evidence.id,
            linkedTo: [{ entity: 'FSHeadProcedure', id: matchedProcedure.id }],
            createdAt: new Date(),
            reason: `Auto-linked evidence "${evidence.fileName}" to procedure "${matchedProcedure.procedureRef}" based on metadata matching`,
          });
        } else {
          await prisma.evidenceFile.update({
            where: { id: evidence.id },
            data: {
              status: 'NEEDS_REVIEW',
            },
          });
        }
      }

      afterState.linkedCount = linkedCount;
      afterState.needsReviewCount = needsReviewCount;
      afterState.status = 'NEEDS_REVIEW';

      this.repairLog.push({
        id: `repair-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        breakId: brk.id,
        repairType: 'CREATE_LINK',
        entityType: 'EvidenceFile',
        entityId: brk.sourceId,
        beforeState,
        afterState,
        reason: brk.description,
        authorityLevel: AUTHORITY_HIERARCHY.EVIDENCE,
        performedAt: new Date(),
        performedBy: this.userId,
      });

      brk.autoRepairable = false;
      brk.repairAction = 'REPAIRED';

    } catch (error) {
      console.error(`Failed to repair evidence issue ${brk.id}:`, error);
    }
  }

  private async findBestMatchingProcedure(engagementId: string, evidence: {
    id: string;
    fileName: string | null;
    fileType: string | null;
    createdAt: Date;
    uploadedById: string | null;
    tags?: string[] | null;
  }): Promise<{ id: string; procedureRef: string | null } | null> {
    const procedures = await prisma.fSHeadProcedure.findMany({
      where: {
        workingPaper: { engagementId },
      },
      include: { workingPaper: true },
    });

    if (procedures.length === 0) return null;

    let bestMatch: { id: string; procedureRef: string | null; score: number } | null = null;

    for (const proc of procedures) {
      let score = 0;

      if (evidence.fileName) {
        const fileName = evidence.fileName.toLowerCase();
        const fsHeadKey = proc.workingPaper?.fsHeadKey?.toLowerCase() || '';
        const fsHeadName = proc.workingPaper?.fsHeadName?.toLowerCase() || '';
        const procRef = proc.procedureRef?.toLowerCase() || '';

        if (fileName.includes(fsHeadKey)) score += 30;
        if (fileName.includes(fsHeadName)) score += 25;
        if (fileName.includes(procRef)) score += 20;

        if (fileName.includes('bank') && (fsHeadKey.includes('cash') || fsHeadKey.includes('bank'))) score += 15;
        if (fileName.includes('invoice') && (fsHeadKey.includes('revenue') || fsHeadKey.includes('receivable'))) score += 15;
        if (fileName.includes('confirm') && procRef.includes('conf')) score += 15;
      }

      if (score > 0 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { id: proc.id, procedureRef: proc.procedureRef, score };
      }
    }

    return bestMatch && bestMatch.score >= 25 ? { id: bestMatch.id, procedureRef: bestMatch.procedureRef } : null;
  }

  private async markAsInactive(entityType: string, entityId: string, reason: string): Promise<void> {
    const timestamp = new Date();

    try {
      switch (entityType) {
        case 'Sample':
          await (prisma as any).sample?.update({
            where: { id: entityId },
            data: {
              status: 'INACTIVE',
              notes: `Marked inactive: ${reason} (${timestamp.toISOString()})`,
            },
          });
          break;

        case 'PopulationDefinition':
          await (prisma as any).populationDefinition?.update({
            where: { id: entityId },
            data: {
              status: 'INACTIVE',
            },
          });
          break;

        case 'FSHeadWorkingPaper':
          await prisma.fSHeadWorkingPaper.update({
            where: { id: entityId },
            data: {
              status: 'SUPERSEDED',
            },
          });
          break;

        case 'FSHeadProcedure':
          await prisma.fSHeadProcedure.update({
            where: { id: entityId },
            data: {
              conclusion: `[INACTIVE] ${reason}`,
            },
          });
          break;

        case 'EvidenceFile':
          await prisma.evidenceFile.update({
            where: { id: entityId },
            data: {
              status: 'ARCHIVED',
            },
          });
          break;

        case 'MaterialitySet':
          await prisma.materialitySet.update({
            where: { id: entityId },
            data: {
              status: 'SUPERSEDED',
            },
          });
          break;

        case 'RiskAssessment':
          await prisma.riskAssessment.update({
            where: { id: entityId },
            data: {
              status: 'SUPERSEDED',
            },
          });
          break;

        default:
          console.warn(`markAsInactive: Unknown entity type ${entityType}`);
          return;
      }

      this.repairLog.push({
        id: `inactive-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        breakId: `manual-inactive-${entityId}`,
        repairType: 'MARK_INACTIVE',
        entityType,
        entityId,
        beforeState: { status: 'ACTIVE' },
        afterState: { status: 'INACTIVE', reason, timestamp: timestamp.toISOString() },
        reason,
        authorityLevel: 99,
        performedAt: timestamp,
        performedBy: this.userId,
        inactiveReason: reason,
      });

      await this.logAuditTrail(
        '',
        'MARK_INACTIVE',
        entityType,
        entityId,
        `Entity marked inactive: ${reason}`
      );

    } catch (error) {
      console.error(`Failed to mark ${entityType} ${entityId} as inactive:`, error);
    }
  }

  private async repairBreak(engagementId: string, brk: ChainBreak): Promise<void> {
    const beforeState: Record<string, unknown> = {};
    const afterState: Record<string, unknown> = {};
    let repairType: RepairAction['repairType'] = 'UPDATE_STATUS';

    try {
      switch (brk.category) {
        case 'ASSERTION_MISSING':
          await this.repairMissingRiskAssessment(engagementId, brk, beforeState, afterState);
          repairType = 'UPDATE_STATUS';
          break;

        case 'PROCEDURE_SAMPLE_JUSTIFICATION':
          if (brk.sourceEntity === 'FSHeadWorkingPaper') {
            await this.repairMissingProcedures(engagementId, brk, beforeState, afterState);
            repairType = 'REGENERATE_ARTIFACT';
          }
          break;

        case 'POPULATION_GL_SOURCE':
          await this.repairMissingPopulation(engagementId, brk, beforeState, afterState);
          repairType = 'REGENERATE_ARTIFACT';
          break;

        case 'SAMPLE_POPULATION_MISMATCH':
          if (brk.description.includes('no sample generated')) {
            await this.repairMissingSample(engagementId, brk, beforeState, afterState);
            repairType = 'REGENERATE_ARTIFACT';
          }
          break;

        case 'MATERIALITY_CASCADE':
          await this.repairMaterialityCascade(engagementId, brk, beforeState, afterState);
          repairType = 'CASCADE_PROPAGATE';
          break;

        case 'MAPPING_COA_FS':
          if (brk.description.includes('non-existent FS heads')) {
            await this.repairMismappedAccounts(engagementId, brk, beforeState, afterState);
            repairType = 'REGENERATE_ARTIFACT';
          }
          break;

        case 'RISK_PROCEDURE_UNLINKED':
          if (brk.description.includes('No risk assessments')) {
            await this.repairMissingRiskAssessments(engagementId, brk, beforeState, afterState);
            repairType = 'REGENERATE_ARTIFACT';
          }
          break;

        default:
          return;
      }

      this.repairLog.push({
        id: `repair-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        breakId: brk.id,
        repairType,
        entityType: brk.sourceEntity,
        entityId: brk.sourceId,
        beforeState,
        afterState,
        reason: brk.description,
        authorityLevel: this.getAuthorityLevel(brk.category),
        performedAt: new Date(),
        performedBy: this.userId,
      });

      brk.autoRepairable = false;
      brk.repairAction = 'REPAIRED';

    } catch (error) {
      console.error(`Failed to repair break ${brk.id}:`, error);
    }
  }

  private async repairMissingRiskAssessment(
    engagementId: string, 
    brk: ChainBreak,
    beforeState: Record<string, unknown>,
    afterState: Record<string, unknown>
  ): Promise<void> {
    const fsHead = await prisma.fSHeadWorkingPaper.findUnique({
      where: { id: brk.sourceId },
    });

    if (!fsHead) return;

    beforeState.inherentRisk = fsHead.inherentRisk;
    beforeState.controlRisk = fsHead.controlRisk;

    const defaultInherentRisk = 'MODERATE';
    const defaultControlRisk = 'MODERATE';

    await prisma.fSHeadWorkingPaper.update({
      where: { id: brk.sourceId },
      data: {
        inherentRisk: fsHead.inherentRisk || defaultInherentRisk,
        controlRisk: fsHead.controlRisk || defaultControlRisk,
        combinedRiskAssessment: this.computeCombinedRisk(
          fsHead.inherentRisk || defaultInherentRisk,
          fsHead.controlRisk || defaultControlRisk
        ),
      },
    });

    afterState.inherentRisk = fsHead.inherentRisk || defaultInherentRisk;
    afterState.controlRisk = fsHead.controlRisk || defaultControlRisk;

    await this.logAuditTrail(engagementId, 'CHAIN_AUTO_REPAIR', 'FSHeadWorkingPaper', brk.sourceId, 
      `Set default risk assessment: IR=${afterState.inherentRisk}, CR=${afterState.controlRisk}`);
  }

  private async repairMissingProcedures(
    engagementId: string,
    brk: ChainBreak,
    beforeState: Record<string, unknown>,
    afterState: Record<string, unknown>
  ): Promise<void> {
    const fsHead = await prisma.fSHeadWorkingPaper.findUnique({
      where: { id: brk.sourceId },
    });

    if (!fsHead) return;

    beforeState.procedureCount = 0;

    const defaultProcedures = this.generateDefaultProcedures(fsHead);

    for (const proc of defaultProcedures) {
      const created = await prisma.fSHeadProcedure.create({
        data: {
          workingPaperId: brk.sourceId,
          procedureRef: proc.ref,
          description: proc.description,
          nature: proc.type,
          assertions: [proc.assertion],
          isaReference: proc.isaReference,
        },
      });

      this.regeneratedArtifacts.push({
        artifactType: 'FSHeadProcedure',
        artifactId: created.id,
        linkedTo: [{ entity: 'FSHeadWorkingPaper', id: brk.sourceId }],
        createdAt: new Date(),
        reason: 'Auto-generated default procedure per ISA 330',
      });
    }

    afterState.procedureCount = defaultProcedures.length;
    afterState.procedures = defaultProcedures.map(p => p.ref);
  }

  private generateDefaultProcedures(fsHead: { fsHeadKey: string; fsHeadName: string; inherentRisk: string | null }): Array<{
    ref: string;
    description: string;
    type: string;
    assertion: string;
    isaReference: string;
  }> {
    const procedures: Array<{
      ref: string;
      description: string;
      type: string;
      assertion: string;
      isaReference: string;
    }> = [];

    const key = fsHead.fsHeadKey.toUpperCase();
    const idx = 1;

    if (key.includes('REVENUE') || key.includes('SALES') || key.includes('INCOME')) {
      procedures.push({
        ref: `${key}-TOD-${idx}`,
        description: 'Select sample of revenue transactions and vouch to supporting documentation',
        type: 'TEST_OF_DETAILS',
        assertion: 'OCCURRENCE',
        isaReference: 'ISA 330.A42',
      });
      procedures.push({
        ref: `${key}-CUT-${idx + 1}`,
        description: 'Test revenue cut-off at period end',
        type: 'TEST_OF_DETAILS',
        assertion: 'CUT_OFF',
        isaReference: 'ISA 330.A43',
      });
    } else if (key.includes('RECEIVABLE') || key.includes('DEBTOR') || key.includes('AR')) {
      procedures.push({
        ref: `${key}-CONF-${idx}`,
        description: 'Send external confirmations to debtors',
        type: 'CONFIRMATION',
        assertion: 'EXISTENCE',
        isaReference: 'ISA 505.7',
      });
      procedures.push({
        ref: `${key}-AGE-${idx + 1}`,
        description: 'Review aged receivables analysis and test allowance for doubtful accounts',
        type: 'ANALYTICAL',
        assertion: 'VALUATION',
        isaReference: 'ISA 540.8',
      });
    } else if (key.includes('CASH') || key.includes('BANK')) {
      procedures.push({
        ref: `${key}-CONF-${idx}`,
        description: 'Obtain bank confirmations',
        type: 'CONFIRMATION',
        assertion: 'EXISTENCE',
        isaReference: 'ISA 505.7',
      });
      procedures.push({
        ref: `${key}-REC-${idx + 1}`,
        description: 'Test bank reconciliation at period end',
        type: 'TEST_OF_DETAILS',
        assertion: 'COMPLETENESS',
        isaReference: 'ISA 330.A49',
      });
    } else if (key.includes('INVENTORY') || key.includes('STOCK')) {
      procedures.push({
        ref: `${key}-OBS-${idx}`,
        description: 'Attend physical inventory count',
        type: 'INSPECTION',
        assertion: 'EXISTENCE',
        isaReference: 'ISA 501.4',
      });
      procedures.push({
        ref: `${key}-VAL-${idx + 1}`,
        description: 'Test inventory valuation including NRV assessment',
        type: 'TEST_OF_DETAILS',
        assertion: 'VALUATION',
        isaReference: 'ISA 501.8',
      });
    } else if (key.includes('PAYABLE') || key.includes('CREDITOR') || key.includes('AP')) {
      procedures.push({
        ref: `${key}-CONF-${idx}`,
        description: 'Send confirmations to major suppliers',
        type: 'CONFIRMATION',
        assertion: 'COMPLETENESS',
        isaReference: 'ISA 505.7',
      });
      procedures.push({
        ref: `${key}-CUT-${idx + 1}`,
        description: 'Perform payables cut-off testing',
        type: 'TEST_OF_DETAILS',
        assertion: 'CUT_OFF',
        isaReference: 'ISA 330.A43',
      });
    } else if (key.includes('PPE') || key.includes('FIXED') || key.includes('ASSET')) {
      procedures.push({
        ref: `${key}-ADD-${idx}`,
        description: 'Test additions to fixed assets during the year',
        type: 'TEST_OF_DETAILS',
        assertion: 'EXISTENCE',
        isaReference: 'ISA 330.A42',
      });
      procedures.push({
        ref: `${key}-DEP-${idx + 1}`,
        description: 'Recalculate depreciation and test useful life assumptions',
        type: 'RECALCULATION',
        assertion: 'VALUATION',
        isaReference: 'ISA 330.A45',
      });
    } else {
      procedures.push({
        ref: `${key}-ANA-${idx}`,
        description: `Perform analytical review of ${fsHead.fsHeadName}`,
        type: 'ANALYTICAL',
        assertion: 'OCCURRENCE',
        isaReference: 'ISA 520.5',
      });
      procedures.push({
        ref: `${key}-TOD-${idx + 1}`,
        description: `Select sample and vouch to supporting documentation`,
        type: 'TEST_OF_DETAILS',
        assertion: 'ACCURACY',
        isaReference: 'ISA 330.A42',
      });
    }

    return procedures;
  }

  private async repairMissingPopulation(
    engagementId: string,
    brk: ChainBreak,
    beforeState: Record<string, unknown>,
    afterState: Record<string, unknown>
  ): Promise<void> {
    const procedure = await prisma.fSHeadProcedure.findUnique({
      where: { id: brk.sourceId },
      include: { workingPaper: true },
    });

    if (!procedure || !procedure.workingPaper) return;

    beforeState.populationCount = 0;

    const accounts = await prisma.coAAccount.findMany({
      where: {
        engagementId,
        fsLineItem: procedure.workingPaper.fsHeadKey,
      },
    });

    const glEntries = await prisma.gLEntry.findMany({
      where: {
        engagementId,
        accountCode: { in: accounts.map(a => a.accountCode) },
      },
    });

    if (glEntries.length === 0) {
      afterState.populationCount = 0;
      afterState.reason = 'No GL entries found for mapped accounts';
      return;
    }

    const population = await (prisma as any).populationDefinition?.create({
      data: {
        engagementId,
        fsHeadId: procedure.workingPaper.id,
        procedureId: procedure.id,
        name: `Auto-generated population for ${procedure.procedureRef || procedure.description.substring(0, 30)}`,
        sourceType: 'GL_JOURNAL',
        filterJson: { accountCodes: accounts.map(a => a.accountCode) },
        status: 'ACTIVE',
        itemCount: glEntries.length,
        createdById: this.userId,
      },
    });

    if (population) {
      this.regeneratedArtifacts.push({
        artifactType: 'PopulationDefinition',
        artifactId: population.id,
        linkedTo: [
          { entity: 'FSHeadProcedure', id: procedure.id },
          { entity: 'FSHeadWorkingPaper', id: procedure.workingPaper.id },
        ],
        createdAt: new Date(),
        reason: 'Auto-generated population from GL entries per ISA 530',
      });

      afterState.populationId = population.id;
      afterState.itemCount = glEntries.length;
    }
  }

  private async repairMissingSample(
    engagementId: string,
    brk: ChainBreak,
    beforeState: Record<string, unknown>,
    afterState: Record<string, unknown>
  ): Promise<void> {
    const procedure = await prisma.fSHeadProcedure.findUnique({
      where: { id: brk.sourceId },
      include: { workingPaper: true },
    });

    if (!procedure) return;

    const population = await (prisma as any).populationDefinition?.findFirst({
      where: { procedureId: procedure.id },
    });

    if (!population) return;

    const materialitySet = await prisma.materialitySet.findFirst({
      where: { engagementId, status: { in: ['APPROVED', 'LOCKED'] } },
      orderBy: { versionId: 'desc' },
    });

    const materialityThreshold = materialitySet 
      ? Number(materialitySet.performanceMateriality) 
      : 10000;

    beforeState.sampleCount = 0;

    const targetSize = Math.min(25, Math.max(10, Math.ceil(population.itemCount * 0.1)));

    const sample = await (prisma as any).sample?.create({
      data: {
        engagementId,
        populationId: population.id,
        fsHeadId: procedure.workingPaper?.id,
        procedureId: procedure.id,
        method: 'MUS',
        targetSize,
        actualSize: 0,
        materialityThreshold: new Prisma.Decimal(materialityThreshold),
        status: 'GENERATED',
        createdById: this.userId,
      },
    });

    if (sample) {
      this.regeneratedArtifacts.push({
        artifactType: 'Sample',
        artifactId: sample.id,
        linkedTo: [
          { entity: 'PopulationDefinition', id: population.id },
          { entity: 'FSHeadProcedure', id: procedure.id },
        ],
        createdAt: new Date(),
        reason: 'Auto-generated sample shell per ISA 530 (items to be selected)',
      });

      afterState.sampleId = sample.id;
      afterState.targetSize = targetSize;
    }
  }

  private async repairMaterialityCascade(
    engagementId: string,
    brk: ChainBreak,
    beforeState: Record<string, unknown>,
    afterState: Record<string, unknown>
  ): Promise<void> {
    const materialitySet = await prisma.materialitySet.findFirst({
      where: { engagementId, status: { in: ['APPROVED', 'LOCKED'] } },
      orderBy: { versionId: 'desc' },
    });

    if (!materialitySet) return;

    const fsHead = await prisma.fSHeadWorkingPaper.findUnique({
      where: { id: brk.sourceId },
    });

    if (!fsHead) return;

    beforeState.allocatedMateriality = Number(fsHead.overallMateriality);

    const correctedMateriality = Number(materialitySet.performanceMateriality);

    await prisma.fSHeadWorkingPaper.update({
      where: { id: brk.sourceId },
      data: {
        overallMateriality: new Prisma.Decimal(correctedMateriality),
        performanceMateriality: new Prisma.Decimal(correctedMateriality * 0.75),
      },
    });

    afterState.allocatedMateriality = correctedMateriality;

    await this.logAuditTrail(engagementId, 'MATERIALITY_CASCADE_REPAIR', 'FSHeadWorkingPaper', brk.sourceId,
      `Corrected allocated materiality from ${beforeState.allocatedMateriality} to ${correctedMateriality}`);
  }

  private async repairMismappedAccounts(
    engagementId: string,
    brk: ChainBreak,
    beforeState: Record<string, unknown>,
    afterState: Record<string, unknown>
  ): Promise<void> {
    const accounts = await prisma.coAAccount.findMany({
      where: { engagementId },
    });

    const fsHeads = await prisma.fSHeadWorkingPaper.findMany({
      where: { engagementId },
    });

    const fsHeadKeys = new Set(fsHeads.map(f => f.fsHeadKey));
    const mismappedAccounts = accounts.filter(a => 
      a.fsLineItem && !fsHeadKeys.has(a.fsLineItem)
    );

    beforeState.mismappedCount = mismappedAccounts.length;

    const missingFsHeadKeys = [...new Set(mismappedAccounts.map(a => a.fsLineItem).filter(Boolean))];

    const created: string[] = [];
    for (const key of missingFsHeadKeys) {
      if (!key) continue;

      const existing = await prisma.fSHeadWorkingPaper.findFirst({
        where: { engagementId, fsHeadKey: key },
      });

      if (!existing) {
        const newFsHead = await prisma.fSHeadWorkingPaper.create({
          data: {
            engagementId,
            fsHeadKey: key,
            fsHeadName: this.generateFsHeadName(key),
            status: 'DRAFT',
            inherentRisk: 'MODERATE',
            controlRisk: 'MODERATE',
            combinedRiskAssessment: 'MODERATE',
          },
        });

        created.push(newFsHead.id);

        this.regeneratedArtifacts.push({
          artifactType: 'FSHeadWorkingPaper',
          artifactId: newFsHead.id,
          linkedTo: mismappedAccounts
            .filter(a => a.fsLineItem === key)
            .map(a => ({ entity: 'CoAAccount', id: a.id })),
          createdAt: new Date(),
          reason: `Auto-created FS head for mapped accounts with key "${key}"`,
        });
      }
    }

    afterState.createdFsHeads = created;
  }

  private async repairMissingRiskAssessments(
    engagementId: string,
    brk: ChainBreak,
    beforeState: Record<string, unknown>,
    afterState: Record<string, unknown>
  ): Promise<void> {
    beforeState.riskCount = 0;

    const fsLevelRisk = await prisma.riskAssessment.create({
      data: {
        engagementId,
        accountOrClass: 'FS_LEVEL',
        assertion: 'OCCURRENCE',
        riskDescription: 'Management override of controls',
        inherentRisk: 'HIGH',
        controlRisk: 'MODERATE',
        riskOfMaterialMisstatement: 'SIGNIFICANT',
        plannedResponse: 'Design and perform procedures to test for management override',
        assessedById: this.userId,
      },
    });

    this.regeneratedArtifacts.push({
      artifactType: 'RiskAssessment',
      artifactId: fsLevelRisk.id,
      linkedTo: [{ entity: 'Engagement', id: engagementId }],
      createdAt: new Date(),
      reason: 'Auto-created FS-level risk per ISA 240 (management override)',
    });

    afterState.riskCount = 1;
    afterState.riskId = fsLevelRisk.id;
  }

  private generateFsHeadName(key: string): string {
    const words = key.split(/[-_\s]+/).map(w => 
      w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    );
    return words.join(' ');
  }

  private computeCombinedRisk(inherentRisk: string, controlRisk: string): string {
    const riskMatrix: Record<string, Record<string, string>> = {
      LOW: { LOW: 'LOW', MODERATE: 'LOW', HIGH: 'MODERATE' },
      MODERATE: { LOW: 'LOW', MODERATE: 'MODERATE', HIGH: 'HIGH' },
      HIGH: { LOW: 'MODERATE', MODERATE: 'HIGH', HIGH: 'SIGNIFICANT' },
    };

    return riskMatrix[inherentRisk]?.[controlRisk] || 'MODERATE';
  }

  private getAuthorityLevel(category: BreakCategory): number {
    const mapping: Record<BreakCategory, number> = {
      MATERIALITY_CASCADE: AUTHORITY_HIERARCHY.MATERIALITY,
      MAPPING_COA_FS: AUTHORITY_HIERARCHY.MAPPING,
      RISK_PROCEDURE_UNLINKED: AUTHORITY_HIERARCHY.RISKS,
      ASSERTION_MISSING: AUTHORITY_HIERARCHY.RISKS,
      RMM_INCOMPLETE: AUTHORITY_HIERARCHY.RISKS,
      CONTROLS_DECISION_MISSING: AUTHORITY_HIERARCHY.CONTROLS_STRATEGY,
      STRATEGY_RISK_DISCONNECT: AUTHORITY_HIERARCHY.CONTROLS_STRATEGY,
      POPULATION_GL_SOURCE: AUTHORITY_HIERARCHY.SAMPLING,
      SAMPLE_POPULATION_MISMATCH: AUTHORITY_HIERARCHY.SAMPLING,
      PROCEDURE_SAMPLE_JUSTIFICATION: AUTHORITY_HIERARCHY.AUDIT_PROGRAM,
      EVIDENCE_ORPHAN: AUTHORITY_HIERARCHY.EVIDENCE,
      CONCLUSION_NO_EVIDENCE: AUTHORITY_HIERARCHY.EVIDENCE,
    };
    return mapping[category] || 99;
  }

  private async checkLockStatus(entityType: string, entityId: string, engagementId: string): Promise<LockType> {
    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId },
      select: { status: true, finalizationLocked: true },
    });

    if (engagement?.status === 'ARCHIVED') {
      return 'ARCHIVE';
    }

    if (engagement?.status === 'COMPLETED' || engagement?.finalizationLocked) {
      return 'HARD';
    }

    if (entityType === 'FSHeadWorkingPaper') {
      const fsHead = await prisma.fSHeadWorkingPaper.findUnique({
        where: { id: entityId },
      });
      if (fsHead?.status === 'LOCKED') {
        return 'HARD';
      }
      if (fsHead?.status === 'APPROVED') {
        return 'SOFT';
      }
    }

    if (entityType === 'MaterialitySet') {
      const ms = await prisma.materialitySet.findUnique({
        where: { id: entityId },
      });
      if (ms?.status === 'LOCKED') return 'HARD';
    }

    if (entityType === 'AuditPlan') {
      const plan = await prisma.auditPlan.findUnique({
        where: { id: entityId },
      });
      if (plan?.status === 'LOCKED') return 'HARD';
    }

    return 'NONE';
  }

  private async computeHealthSummary(engagementId: string): Promise<ChainHealthSummary> {
    const highBreaks = this.breakRegister.filter(b => b.severity === 'HIGH');
    const mediumBreaks = this.breakRegister.filter(b => b.severity === 'MEDIUM');
    const autoRepaired = this.repairLog.length;

    const fsLevelBreaks = this.breakRegister.filter(b => b.chainLevel === 'FS_LEVEL');
    const assertionBreaks = this.breakRegister.filter(b => b.chainLevel === 'ASSERTION_TRACK');

    const fsLevelUnresolved = fsLevelBreaks.filter(b => b.repairAction !== 'REPAIRED');
    const assertionUnresolved = assertionBreaks.filter(b => b.repairAction !== 'REPAIRED');

    const fsLevelStatus: GateStatus = fsLevelUnresolved.some(b => b.severity === 'HIGH')
      ? 'FAIL'
      : fsLevelUnresolved.length > 0
        ? 'NEEDS_REVIEW'
        : 'PASS';

    const assertionTrackStatus: GateStatus = assertionUnresolved.some(b => b.severity === 'HIGH')
      ? 'FAIL'
      : assertionUnresolved.length > 0
        ? 'NEEDS_REVIEW'
        : 'PASS';

    const overallStatus: GateStatus = 
      fsLevelStatus === 'FAIL' || assertionTrackStatus === 'FAIL'
        ? 'FAIL'
        : fsLevelStatus === 'NEEDS_REVIEW' || assertionTrackStatus === 'NEEDS_REVIEW'
          ? 'NEEDS_REVIEW'
          : 'PASS';

    const needsReview = this.breakRegister
      .filter(b => b.repairAction !== 'REPAIRED' && !b.autoRepairable)
      .map(b => `${b.category}: ${b.description}`);

    const totalItems = await this.countTotalChainItems(engagementId);
    const linkedItems = await this.countLinkedItems(engagementId);
    const completenessScore = totalItems > 0 ? Math.round((linkedItems / totalItems) * 100) : 0;

    const integrityScore = Math.max(0, 100 - (highBreaks.length * 15) - (mediumBreaks.length * 5));

    const isaScores = await this.getISAComplianceScores(engagementId);
    const isaComplianceScore = isaScores.length > 0 
      ? Math.round(isaScores.reduce((sum, s) => sum + s, 0) / isaScores.length)
      : 0;

    return {
      engagementId,
      timestamp: new Date(),
      fsLevelChainStatus: fsLevelStatus,
      assertionTrackStatus,
      overallStatus,
      totalBreaks: this.breakRegister.length,
      highBreaks: highBreaks.length,
      mediumBreaks: mediumBreaks.length,
      autoRepaired,
      needsReview,
      completenessScore,
      integrityScore,
      isaComplianceScore,
    };
  }

  private async countTotalChainItems(engagementId: string): Promise<number> {
    const [fsHeads, procedures, accounts] = await Promise.all([
      prisma.fSHeadWorkingPaper.count({ where: { engagementId } }),
      prisma.fSHeadProcedure.count({ 
        where: { workingPaper: { engagementId } } 
      }),
      prisma.coAAccount.count({ where: { engagementId } }),
    ]);
    return fsHeads + procedures + accounts;
  }

  private async countLinkedItems(engagementId: string): Promise<number> {
    const [linkedAccounts, proceduresWithConclusion] = await Promise.all([
      prisma.coAAccount.count({ 
        where: { engagementId, fsLineItem: { not: null } } 
      }),
      prisma.fSHeadProcedure.count({ 
        where: { 
          workingPaper: { engagementId },
          conclusion: { not: null },
        } 
      }),
    ]);
    return linkedAccounts + proceduresWithConclusion;
  }

  private async getISAComplianceScores(engagementId: string): Promise<number[]> {
    return [75];
  }

  private addBreak(brk: Omit<ChainBreak, 'id' | 'detectedAt'>): void {
    this.breakRegister.push({
      ...brk,
      id: `brk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      detectedAt: new Date(),
    });
  }

  async recomputeDownstreamOutputs(engagementId: string): Promise<void> {
    await this.logAuditTrail(
      engagementId,
      'DOWNSTREAM_RECOMPUTE_START',
      'Engagement',
      engagementId,
      'Starting downstream artifact regeneration after repairs'
    );

    await this.regenerateRiskMatrix(engagementId);
    await this.regeneratePlannedResponses(engagementId);
    await this.regenerateSamplingFrames(engagementId);
    await this.regenerateAuditProgram(engagementId);
    await this.regenerateMisstatementSummary(engagementId);
    await this.regenerateDraftConclusions(engagementId);

    this.lastArtifacts.set(engagementId, [...this.regeneratedArtifacts]);

    await this.logAuditTrail(
      engagementId,
      'DOWNSTREAM_RECOMPUTE_COMPLETE',
      'Engagement',
      engagementId,
      `Regenerated ${this.regeneratedArtifacts.length} downstream artifacts`
    );
  }

  getLastArtifacts(engagementId: string): RegeneratedArtifact[] {
    return this.lastArtifacts.get(engagementId) || [];
  }

  private async regenerateRiskMatrix(engagementId: string): Promise<void> {
    try {
      const [materialitySet, fsHeads, riskAssessments] = await Promise.all([
        prisma.materialitySet.findFirst({
          where: { engagementId },
          orderBy: { versionId: 'desc' },
        }),
        prisma.fSHeadWorkingPaper.findMany({
          where: { engagementId },
        }),
        prisma.riskAssessment.findMany({
          where: { engagementId },
        }),
      ]);

      const overallMateriality = materialitySet ? Number(materialitySet.overallMateriality) : 50000;

      for (const fsHead of fsHeads) {
        if (fsHead.status === 'LOCKED') continue;

        const fsHeadRisks = riskAssessments.filter(r => r.accountOrClass === fsHead.fsHeadKey);
        
        let aggregatedInherentRisk = 'MODERATE';
        let aggregatedControlRisk = 'MODERATE';
        
        if (fsHeadRisks.length > 0) {
          const highInherent = fsHeadRisks.some(r => r.inherentRisk === 'HIGH');
          const highControl = fsHeadRisks.some(r => r.controlRisk === 'HIGH');
          aggregatedInherentRisk = highInherent ? 'HIGH' : 
            fsHeadRisks.some(r => r.inherentRisk === 'MODERATE') ? 'MODERATE' : 'LOW';
          aggregatedControlRisk = highControl ? 'HIGH' : 
            fsHeadRisks.some(r => r.controlRisk === 'MODERATE') ? 'MODERATE' : 'LOW';
        }

        const combinedRisk = this.computeCombinedRisk(aggregatedInherentRisk, aggregatedControlRisk);

        await prisma.fSHeadWorkingPaper.update({
          where: { id: fsHead.id },
          data: {
            inherentRisk: aggregatedInherentRisk,
            controlRisk: aggregatedControlRisk,
            combinedRiskAssessment: combinedRisk,
          },
        });
      }

      for (const risk of riskAssessments) {
        if (risk.status === 'LOCKED' || risk.status === 'APPROVED') continue;

        const computedRMM = this.computeCombinedRisk(
          risk.inherentRisk || 'MODERATE',
          risk.controlRisk || 'MODERATE'
        );

        await prisma.riskAssessment.update({
          where: { id: risk.id },
          data: {
            riskOfMaterialMisstatement: computedRMM,
          },
        });
      }

      this.regeneratedArtifacts.push({
        artifactType: 'RiskMatrix',
        artifactId: `risk-matrix-${engagementId}`,
        linkedTo: [
          { entity: 'Engagement', id: engagementId },
          ...fsHeads.map(f => ({ entity: 'FSHeadWorkingPaper', id: f.id })),
          ...riskAssessments.map(r => ({ entity: 'RiskAssessment', id: r.id })),
        ],
        createdAt: new Date(),
        reason: `Recalculated risk matrix for ${fsHeads.length} FS heads and ${riskAssessments.length} risk assessments based on materiality ${overallMateriality}`,
      });

    } catch (error) {
      console.error('Failed to regenerate risk matrix:', error);
    }
  }

  private async regeneratePlannedResponses(engagementId: string): Promise<void> {
    try {
      const [riskAssessments, auditStrategy, controlTests] = await Promise.all([
        prisma.riskAssessment.findMany({
          where: { engagementId },
        }),
        prisma.auditStrategy.findFirst({
          where: { engagementId },
        }),
        prisma.controlTest.findMany({
          where: { control: { engagementId } },
          include: { control: true },
        }),
      ]);

      const controlRelianceMap = new Map<string, boolean>();
      for (const test of controlTests) {
        const canRely = test.conclusion === 'EFFECTIVE' || test.conclusion === 'SATISFACTORY';
        const fsHeadKey = test.control?.processArea || 'GENERAL';
        if (!controlRelianceMap.has(fsHeadKey) || canRely) {
          controlRelianceMap.set(fsHeadKey, canRely);
        }
      }

      const updatedResponses: string[] = [];

      for (const risk of riskAssessments) {
        if (risk.status === 'LOCKED') continue;

        const riskLevel = risk.riskOfMaterialMisstatement || 'MODERATE';
        const canRelyOnControls = controlRelianceMap.get(risk.accountOrClass) || false;

        let nature = 'SUBSTANTIVE';
        let timing = 'YEAR_END';
        let extent = 'MODERATE';

        if (riskLevel === 'HIGH') {
          nature = 'SUBSTANTIVE';
          timing = 'YEAR_END';
          extent = 'EXTENSIVE';
        } else if (riskLevel === 'MODERATE') {
          nature = canRelyOnControls ? 'COMBINED' : 'SUBSTANTIVE';
          timing = canRelyOnControls ? 'INTERIM_AND_YEAR_END' : 'YEAR_END';
          extent = 'MODERATE';
        } else {
          nature = canRelyOnControls ? 'CONTROLS_FOCUSED' : 'SUBSTANTIVE';
          timing = canRelyOnControls ? 'INTERIM' : 'YEAR_END';
          extent = 'LIMITED';
        }

        const plannedResponse = `Nature: ${nature}; Timing: ${timing}; Extent: ${extent}; Controls Reliance: ${canRelyOnControls ? 'Yes' : 'No'}`;

        await prisma.riskAssessment.update({
          where: { id: risk.id },
          data: {
            plannedResponse,
          },
        });

        updatedResponses.push(risk.id);
      }

      if (auditStrategy && auditStrategy.status !== 'LOCKED') {
        const hasHighRisks = riskAssessments.some(r => r.riskOfMaterialMisstatement === 'HIGH');
        const canRelyOnControlsOverall = Array.from(controlRelianceMap.values()).some(v => v);

        await prisma.auditStrategy.update({
          where: { id: auditStrategy.id },
          data: {
            substantiveApproach: hasHighRisks ? 'PRIMARILY_SUBSTANTIVE' : 
              canRelyOnControlsOverall ? 'COMBINED_APPROACH' : 'SUBSTANTIVE_ONLY',
          },
        });
      }

      this.regeneratedArtifacts.push({
        artifactType: 'PlannedResponses',
        artifactId: `planned-responses-${engagementId}`,
        linkedTo: [
          { entity: 'Engagement', id: engagementId },
          ...updatedResponses.map(id => ({ entity: 'RiskAssessment', id })),
          ...(auditStrategy ? [{ entity: 'AuditStrategy', id: auditStrategy.id }] : []),
        ],
        createdAt: new Date(),
        reason: `Updated ${updatedResponses.length} planned responses based on risk levels and controls reliance decisions`,
      });

    } catch (error) {
      console.error('Failed to regenerate planned responses:', error);
    }
  }

  private async regenerateSamplingFrames(engagementId: string): Promise<void> {
    try {
      const [populations, samplingRuns, materialitySet] = await Promise.all([
        prisma.populationDefinition.findMany({
          where: { engagementId },
        }).catch(() => []),
        prisma.samplingRun.findMany({
          where: { engagementId },
        }),
        prisma.materialitySet.findFirst({
          where: { engagementId },
          orderBy: { versionId: 'desc' },
        }),
      ]);

      const performanceMateriality = materialitySet ? Number(materialitySet.performanceMateriality) : 37500;

      for (const population of populations) {
        const existingRun = samplingRuns.find(r => r.populationId === population.id);
        
        const populationTotal = population.items.reduce((sum, item) => 
          sum + Math.abs(Number(item.amount || 0)), 0
        );
        const populationSize = population.items.length;

        let sampleSize = Math.min(25, populationSize);
        if (populationTotal > performanceMateriality * 10) {
          sampleSize = Math.min(60, populationSize);
        } else if (populationTotal > performanceMateriality * 5) {
          sampleSize = Math.min(40, populationSize);
        }

        const seed = Date.now() + Math.floor(Math.random() * 1000000);
        const seedRandom = this.seededRandom(seed);
        
        const sortedItems = [...population.items].sort((a, b) => 
          Math.abs(Number(b.amount || 0)) - Math.abs(Number(a.amount || 0))
        );
        
        const keyItems = sortedItems.filter(item => 
          Math.abs(Number(item.amount || 0)) >= performanceMateriality
        );
        
        const remainingItems = sortedItems.filter(item => 
          Math.abs(Number(item.amount || 0)) < performanceMateriality
        );
        
        const randomSampleCount = Math.max(0, sampleSize - keyItems.length);
        const shuffled = remainingItems.sort(() => seedRandom() - 0.5);
        const randomSample = shuffled.slice(0, randomSampleCount);
        
        const selectedItems = [...keyItems, ...randomSample];
        const selectedIds = selectedItems.map(item => item.id);

        if (existingRun) {
          await prisma.samplingRun.update({
            where: { id: existingRun.id },
            data: {
              sampleSize,
              selectedItems: selectedIds,
              metadata: {
                seed,
                keyItemsCount: keyItems.length,
                randomSampleCount,
                performanceMateriality,
                regeneratedAt: new Date().toISOString(),
              },
            },
          });
        } else {
          await prisma.samplingRun.create({
            data: {
              engagementId,
              populationId: population.id,
              samplingMethodology: 'MUS_WITH_KEY_ITEMS',
              confidenceLevel: 95,
              tolerableError: new Prisma.Decimal(performanceMateriality),
              expectedError: new Prisma.Decimal(0),
              sampleSize,
              selectedItems: selectedIds,
              status: 'DRAFT',
              createdById: this.userId,
              metadata: {
                seed,
                keyItemsCount: keyItems.length,
                randomSampleCount,
                performanceMateriality,
                regeneratedAt: new Date().toISOString(),
              },
            },
          });
        }

        this.regeneratedArtifacts.push({
          artifactType: 'SamplingFrame',
          artifactId: `sampling-frame-${population.id}`,
          linkedTo: [
            { entity: 'AuditPopulation', id: population.id },
            { entity: 'Engagement', id: engagementId },
          ],
          createdAt: new Date(),
          reason: `Rebuilt sampling frame: ${sampleSize} items selected (${keyItems.length} key items, ${randomSampleCount} random) from population of ${populationSize} items. Seed: ${seed}`,
        });
      }

    } catch (error) {
      console.error('Failed to regenerate sampling frames:', error);
    }
  }

  private seededRandom(seed: number): () => number {
    let s = seed;
    return () => {
      s = Math.sin(s) * 10000;
      return s - Math.floor(s);
    };
  }

  private async regenerateAuditProgram(engagementId: string): Promise<void> {
    try {
      const [fsHeads, procedures, riskAssessments] = await Promise.all([
        prisma.fSHeadWorkingPaper.findMany({
          where: { engagementId },
        }),
        prisma.fSHeadProcedure.findMany({
          where: { workingPaper: { engagementId } },
          include: { workingPaper: true },
        }),
        prisma.riskAssessment.findMany({
          where: { engagementId },
        }),
      ]);

      const updatedProcedures: string[] = [];

      for (const fsHead of fsHeads) {
        const fsHeadProcedures = procedures.filter(p => p.workingPaperId === fsHead.id);
        const fsHeadRisks = riskAssessments.filter(r => r.accountOrClass === fsHead.fsHeadKey);
        
        const highestRisk = fsHeadRisks.reduce((highest, r) => {
          if (r.riskOfMaterialMisstatement === 'HIGH') return 'HIGH';
          if (r.riskOfMaterialMisstatement === 'MODERATE' && highest !== 'HIGH') return 'MODERATE';
          return highest;
        }, 'LOW' as string);

        for (const proc of fsHeadProcedures) {
          let evidenceRequirements = proc.evidenceRequirements || '';
          
          if (highestRisk === 'HIGH') {
            evidenceRequirements = 'External confirmations required; Full population testing or extensive sampling; Third-party evidence preferred; Management representations insufficient alone';
          } else if (highestRisk === 'MODERATE') {
            evidenceRequirements = 'External or internal documentation acceptable; Representative sampling; Analytical procedures supported by corroborating evidence';
          } else {
            evidenceRequirements = 'Internal documentation acceptable; Limited sampling or analytical procedures; Inquiry with corroboration';
          }

          await prisma.fSHeadProcedure.update({
            where: { id: proc.id },
            data: {
              evidenceRequirements,
            },
          });

          updatedProcedures.push(proc.id);
        }

        if (fsHeadProcedures.length === 0 && fsHead.status !== 'LOCKED') {
          const defaultAssertions = this.getDefaultAssertions(fsHead.fsHeadKey);
          
          const newProcedure = await prisma.fSHeadProcedure.create({
            data: {
              workingPaperId: fsHead.id,
              procedureRef: `${fsHead.fsHeadKey}-001`,
              description: `Standard substantive procedure for ${fsHead.fsHeadName}`,
              nature: highestRisk === 'HIGH' ? 'INSPECTION' : 'ANALYTICAL',
              assertions: defaultAssertions,
              evidenceRequirements: highestRisk === 'HIGH' 
                ? 'External confirmations required; Full population testing or extensive sampling'
                : 'Internal documentation acceptable; Representative sampling',
            },
          });

          updatedProcedures.push(newProcedure.id);
        }
      }

      this.regeneratedArtifacts.push({
        artifactType: 'AuditProgram',
        artifactId: `audit-program-${engagementId}`,
        linkedTo: [
          { entity: 'Engagement', id: engagementId },
          ...updatedProcedures.map(id => ({ entity: 'FSHeadProcedure', id })),
        ],
        createdAt: new Date(),
        reason: `Updated ${updatedProcedures.length} audit procedures with evidence requirements based on risk assessments`,
      });

    } catch (error) {
      console.error('Failed to regenerate audit program:', error);
    }
  }

  private async regenerateMisstatementSummary(engagementId: string): Promise<void> {
    try {
      const [misstatements, materialitySet] = await Promise.all([
        prisma.misstatement.findMany({
          where: { engagementId },
          include: { fsHead: true },
        }),
        prisma.materialitySet.findFirst({
          where: { engagementId },
          orderBy: { versionId: 'desc' },
        }),
      ]);

      const overallMateriality = materialitySet ? Number(materialitySet.overallMateriality) : 50000;
      const trivialThreshold = materialitySet ? Number(materialitySet.trivialThreshold) : overallMateriality * 0.05;

      const evaluationResults: Array<{
        id: string;
        classification: string;
        materialityStatus: string;
      }> = [];

      for (const misstatement of misstatements) {
        if (misstatement.status === 'LOCKED') continue;

        const amount = Math.abs(Number(misstatement.amount || 0));
        
        let materialityStatus = 'TRIVIAL';
        if (amount >= overallMateriality) {
          materialityStatus = 'MATERIAL';
        } else if (amount >= trivialThreshold) {
          materialityStatus = 'ABOVE_TRIVIAL';
        }

        let classification = misstatement.classification || 'UNCORRECTED';
        if (misstatement.status === 'CORRECTED') {
          classification = 'CORRECTED';
        } else if (misstatement.status === 'WAIVED') {
          classification = 'WAIVED';
        }

        await prisma.misstatement.update({
          where: { id: misstatement.id },
          data: {
            classification,
          },
        });

        evaluationResults.push({
          id: misstatement.id,
          classification,
          materialityStatus,
        });
      }

      const uncorrectedTotal = misstatements
        .filter(m => m.status !== 'CORRECTED' && m.status !== 'WAIVED')
        .reduce((sum, m) => sum + Math.abs(Number(m.amount || 0)), 0);

      const aggregateMaterialityStatus = uncorrectedTotal >= overallMateriality 
        ? 'MATERIAL_IN_AGGREGATE' 
        : uncorrectedTotal >= trivialThreshold 
          ? 'ABOVE_TRIVIAL_IN_AGGREGATE' 
          : 'IMMATERIAL_IN_AGGREGATE';

      this.regeneratedArtifacts.push({
        artifactType: 'MisstatementSummary',
        artifactId: `misstatement-summary-${engagementId}`,
        linkedTo: [
          { entity: 'Engagement', id: engagementId },
          ...evaluationResults.map(r => ({ entity: 'Misstatement', id: r.id })),
        ],
        createdAt: new Date(),
        reason: `Evaluated ${misstatements.length} misstatements against materiality (${overallMateriality}). Aggregate uncorrected: ${uncorrectedTotal} (${aggregateMaterialityStatus}). Corrected: ${misstatements.filter(m => m.status === 'CORRECTED').length}, Waived: ${misstatements.filter(m => m.status === 'WAIVED').length}`,
      });

    } catch (error) {
      console.error('Failed to regenerate misstatement summary:', error);
    }
  }

  private async regenerateDraftConclusions(engagementId: string): Promise<void> {
    try {
      const [fsHeads, procedures, misstatements, evidenceFiles, substantiveTests] = await Promise.all([
        prisma.fSHeadWorkingPaper.findMany({
          where: { engagementId },
        }),
        prisma.fSHeadProcedure.findMany({
          where: { workingPaper: { engagementId } },
        }),
        prisma.misstatement.findMany({
          where: { engagementId },
        }),
        prisma.evidenceFile.findMany({
          where: { engagementId },
        }),
        prisma.substantiveTest.findMany({
          where: { engagementId },
        }),
      ]);

      const conclusionArtifacts: string[] = [];

      for (const fsHead of fsHeads) {
        if (fsHead.status === 'LOCKED') continue;

        const fsHeadProcedures = procedures.filter(p => p.workingPaperId === fsHead.id);
        const fsHeadMisstatements = misstatements.filter(m => m.fsHeadId === fsHead.id);
        const fsHeadTests = substantiveTests.filter(t => t.fsHeadId === fsHead.id);

        const totalProcedures = fsHeadProcedures.length;
        const completedProcedures = fsHeadProcedures.filter(p => p.conclusion).length;
        
        const evidenceForProcedures = fsHeadProcedures.flatMap(p => 
          evidenceFiles.filter(e => e.procedureId === p.id)
        );
        
        const uncorrectedMisstatements = fsHeadMisstatements.filter(
          m => m.status !== 'CORRECTED' && m.status !== 'WAIVED'
        );
        const uncorrectedAmount = uncorrectedMisstatements.reduce(
          (sum, m) => sum + Math.abs(Number(m.amount || 0)), 0
        );

        const completedTests = fsHeadTests.filter(t => 
          t.status === 'COMPLETED' || t.status === 'REVIEWED'
        );

        const gaps: string[] = [];
        
        if (totalProcedures === 0) {
          gaps.push('No audit procedures defined');
        } else if (completedProcedures < totalProcedures) {
          gaps.push(`${totalProcedures - completedProcedures} procedures incomplete`);
        }
        
        if (evidenceForProcedures.length === 0 && totalProcedures > 0) {
          gaps.push('No evidence linked to procedures');
        }
        
        if (uncorrectedMisstatements.length > 0) {
          gaps.push(`${uncorrectedMisstatements.length} uncorrected misstatements (${uncorrectedAmount})`);
        }

        let conclusionBasis = '';
        let draftConclusion = '';

        if (gaps.length === 0 && completedProcedures === totalProcedures && totalProcedures > 0) {
          conclusionBasis = `Based on ${completedProcedures} completed procedures with ${evidenceForProcedures.length} evidence items. ${completedTests.length} substantive tests completed. No uncorrected misstatements.`;
          draftConclusion = `SATISFACTORY: Sufficient appropriate audit evidence obtained for ${fsHead.fsHeadName}. No material misstatements identified.`;
        } else if (gaps.length > 0) {
          conclusionBasis = `Procedures: ${completedProcedures}/${totalProcedures} completed. Evidence items: ${evidenceForProcedures.length}. Tests: ${completedTests.length}. Misstatements: ${fsHeadMisstatements.length} (${uncorrectedMisstatements.length} uncorrected).`;
          draftConclusion = `INCOMPLETE: Additional work required for ${fsHead.fsHeadName}. Gaps: ${gaps.join('; ')}`;
        } else {
          conclusionBasis = `No procedures defined. Unable to form conclusion.`;
          draftConclusion = `NOT STARTED: Audit work for ${fsHead.fsHeadName} has not commenced.`;
        }

        await prisma.fSHeadWorkingPaper.update({
          where: { id: fsHead.id },
          data: {
            conclusion: draftConclusion,
            notes: `${fsHead.notes || ''}\n\n[AUTO-GENERATED CONCLUSION BASIS - ${new Date().toISOString()}]\n${conclusionBasis}\nGaps: ${gaps.length > 0 ? gaps.join('; ') : 'None identified'}`.trim(),
          },
        });

        conclusionArtifacts.push(fsHead.id);

        this.regeneratedArtifacts.push({
          artifactType: 'DraftConclusion',
          artifactId: `draft-conclusion-${fsHead.id}`,
          linkedTo: [
            { entity: 'FSHeadWorkingPaper', id: fsHead.id },
            { entity: 'Engagement', id: engagementId },
            ...fsHeadProcedures.map(p => ({ entity: 'FSHeadProcedure', id: p.id })),
            ...fsHeadMisstatements.map(m => ({ entity: 'Misstatement', id: m.id })),
          ],
          createdAt: new Date(),
          reason: `Draft conclusion for ${fsHead.fsHeadName}: ${draftConclusion.substring(0, 50)}... Basis: ${completedProcedures}/${totalProcedures} procedures, ${evidenceForProcedures.length} evidence items, ${gaps.length} gaps identified`,
        });
      }

    } catch (error) {
      console.error('Failed to regenerate draft conclusions:', error);
    }
  }

  private async logAuditTrail(
    engagementId: string,
    action: string,
    entityType: string,
    entityId: string,
    details: string
  ): Promise<void> {
    try {
      await prisma.auditTrail.create({
        data: {
          engagementId,
          userId: this.userId,
          action,
          entityType,
          entityId,
          reason: details,
        },
      });
    } catch (e) {
      console.error('Failed to log audit trail:', e);
    }
  }

  async runFinalGateChecks(engagementId: string): Promise<GateCheckResult> {
    const blockers: string[] = [];
    const warnings: string[] = [];
    
    const highSeverityBreaks = this.breakRegister.filter(b => b.severity === 'HIGH');
    if (highSeverityBreaks.length > 0) {
      for (const breakItem of highSeverityBreaks) {
        blockers.push(`HIGH severity break: ${breakItem.description} (${breakItem.category}) - ISA Ref: ${breakItem.isaReference}`);
      }
    }
    
    const conclusionTraceStatus = await this.validateConclusionTraceability(engagementId);
    const untracedConclusions = conclusionTraceStatus.filter(c => !c.traced);
    if (untracedConclusions.length > 0) {
      for (const untraced of untracedConclusions) {
        blockers.push(`FS Head ${untraced.fsHeadId} conclusion not fully traced: ${untraced.gaps.join('; ')}`);
      }
    }
    
    const lockViolations = this.checkLockCompliance();
    if (lockViolations.length > 0) {
      for (const violation of lockViolations) {
        blockers.push(`Lock violation: ${violation}`);
      }
    }
    
    const mediumBreaks = this.breakRegister.filter(b => b.severity === 'MEDIUM');
    if (mediumBreaks.length > 0) {
      for (const breakItem of mediumBreaks) {
        warnings.push(`MEDIUM severity break: ${breakItem.description} (${breakItem.category})`);
      }
    }
    
    const lowBreaks = this.breakRegister.filter(b => b.severity === 'LOW');
    if (lowBreaks.length > 0) {
      warnings.push(`${lowBreaks.length} LOW severity breaks detected - review recommended`);
    }
    
    const partiallyTracedConclusions = conclusionTraceStatus.filter(c => c.traced && c.gaps.length > 0);
    if (partiallyTracedConclusions.length > 0) {
      for (const partial of partiallyTracedConclusions) {
        warnings.push(`FS Head ${partial.fsHeadId} has minor traceability gaps: ${partial.gaps.join('; ')}`);
      }
    }

    const overall: 'PASS' | 'FAIL' = blockers.length === 0 ? 'PASS' : 'FAIL';

    return {
      overall,
      blockers,
      warnings,
      lockViolations,
      conclusionTraceStatus,
    };
  }

  async validateConclusionTraceability(engagementId: string): Promise<Array<{ fsHeadId: string; traced: boolean; gaps: string[] }>> {
    const result: Array<{ fsHeadId: string; traced: boolean; gaps: string[] }> = [];

    const fsHeads = await prisma.fSHeadWorkingPaper.findMany({
      where: { engagementId },
    });

    for (const fsHead of fsHeads) {
      const gaps: string[] = [];
      
      const procedures = await prisma.fSHeadProcedure.findMany({
        where: { workingPaperId: fsHead.id },
      });
      
      const evidenceFiles = await prisma.evidenceFile.findMany({
        where: { 
          engagementId,
          procedureId: { in: procedures.map(p => p.id) },
        },
      });
      
      const substantiveTests = await prisma.substantiveTest.findMany({
        where: {
          engagementId,
          OR: [
            { procedureId: { in: procedures.map(p => p.id) } },
            { fsHeadId: fsHead.id },
          ],
        },
      });
      
      const misstatements = await prisma.misstatement.findMany({
        where: { 
          engagementId,
          fsHeadId: fsHead.id,
        },
      });

      if (fsHead.conclusion) {
        if (procedures.length === 0) {
          gaps.push('Conclusion exists without any procedures defined');
        }
        
        if (evidenceFiles.length === 0) {
          gaps.push('Conclusion exists without any evidence linked to procedures');
        }
        
        const proceduresWithConclusions = procedures.filter(p => p.conclusion);
        if (procedures.length > 0 && proceduresWithConclusions.length < procedures.length) {
          gaps.push(`${procedures.length - proceduresWithConclusions.length} of ${procedures.length} procedures missing conclusions`);
        }
        
        const completedTests = substantiveTests.filter(t => 
          t.status === 'COMPLETED' || t.status === 'REVIEWED'
        );
        if (substantiveTests.length > 0 && completedTests.length < substantiveTests.length) {
          gaps.push(`${substantiveTests.length - completedTests.length} of ${substantiveTests.length} tests incomplete`);
        }
        
        const unresolvedMisstatements = misstatements.filter(m => 
          m.status !== 'CORRECTED' && m.status !== 'WAIVED' && m.status !== 'IMMATERIAL'
        );
        if (unresolvedMisstatements.length > 0) {
          gaps.push(`${unresolvedMisstatements.length} misstatements unresolved (not corrected, waived, or confirmed immaterial)`);
        }
      } else {
        if (fsHead.status === 'APPROVED' || fsHead.status === 'LOCKED') {
          gaps.push('FS Head marked as approved/locked but has no conclusion');
        }
      }

      const isFullyTraced = gaps.length === 0 && (
        fsHead.conclusion !== null || 
        (fsHead.status !== 'APPROVED' && fsHead.status !== 'LOCKED')
      );

      result.push({
        fsHeadId: fsHead.id,
        traced: isFullyTraced,
        gaps,
      });
    }

    return result;
  }

  checkLockCompliance(): string[] {
    const violations: string[] = [];

    for (const repair of this.repairLog) {
      if (this.chainGraph) {
        const node = this.chainGraph.nodes.get(`${repair.entityType.toLowerCase()}-${repair.entityId}`);
        
        if (node) {
          if (node.lockStatus === 'HARD') {
            violations.push(
              `Attempted modification to HARD locked item: ${repair.entityType} (${repair.entityId}) - Action: ${repair.repairType}`
            );
          }
          if (node.lockStatus === 'ARCHIVE') {
            violations.push(
              `Attempted modification to ARCHIVE locked item: ${repair.entityType} (${repair.entityId}) - Action: ${repair.repairType}`
            );
          }
        }
      }
      
      const beforeState = repair.beforeState as Record<string, unknown>;
      const afterState = repair.afterState as Record<string, unknown>;
      
      if (beforeState?.lockStatus === 'HARD' || beforeState?.status === 'LOCKED') {
        violations.push(
          `Repair log shows modification to previously HARD locked entity: ${repair.entityType} (${repair.entityId})`
        );
      }
      if (beforeState?.lockStatus === 'ARCHIVE' || beforeState?.status === 'ARCHIVED') {
        violations.push(
          `Repair log shows modification to ARCHIVED entity: ${repair.entityType} (${repair.entityId})`
        );
      }
    }

    return violations;
  }

  generateFormattedReport(result: ChainIntegrityResult): string {
    const lines: string[] = [];
    const timestamp = new Date().toISOString();
    
    lines.push('==========================================');
    lines.push('AUDIT CHAIN INTEGRITY REPORT');
    lines.push(`Engagement: ${result.healthSummary.engagementId}`);
    lines.push(`Generated: ${timestamp}`);
    lines.push('==========================================');
    lines.push('');
    
    lines.push('SECTION 1: CHAIN HEALTH SUMMARY');
    lines.push('--------------------------------------');
    
    const nodeTypeCounts: Record<string, number> = {};
    const lockCounts: Record<string, number> = { HARD: 0, SOFT: 0, ARCHIVE: 0, NONE: 0 };
    const statusCounts: Record<string, number> = { ACTIVE: 0, NEEDS_REVIEW: 0, INACTIVE: 0, DRAFT: 0, APPROVED: 0, LOCKED: 0 };
    let totalLinks = 0;
    
    if (this.chainGraph) {
      for (const [, node] of this.chainGraph.nodes) {
        nodeTypeCounts[node.nodeType] = (nodeTypeCounts[node.nodeType] || 0) + 1;
        lockCounts[node.lockStatus] = (lockCounts[node.lockStatus] || 0) + 1;
        statusCounts[node.status] = (statusCounts[node.status] || 0) + 1;
        totalLinks += node.parentLinks.length + node.childLinks.length;
      }
    }
    
    const totalNodes = Object.values(nodeTypeCounts).reduce((a, b) => a + b, 0);
    lines.push(`Total Nodes: ${totalNodes} by type`);
    
    const nodeTypeLabels: Record<string, string> = {
      'ENTITY_UNDERSTANDING': 'Entity Understanding',
      'FS_LEVEL_RISK': 'FS Level Risks',
      'OVERALL_RESPONSE': 'Overall Responses',
      'FS_HEAD': 'FS Heads',
      'ASSERTION': 'Assertions',
      'RMM': 'Risk of Material Misstatement',
      'PLANNED_RESPONSE': 'Planned Responses',
      'CONTROLS_STRATEGY': 'Controls Strategy',
      'POPULATION': 'Populations',
      'SAMPLE_LIST': 'Sample Lists',
      'PROCEDURE': 'Procedures',
      'EVIDENCE': 'Evidence',
      'RESULT': 'Results',
      'MISSTATEMENT': 'Misstatements',
      'CONCLUSION': 'Conclusions',
    };
    
    for (const [type, count] of Object.entries(nodeTypeCounts)) {
      const label = nodeTypeLabels[type] || type;
      lines.push(`- ${label}: ${count}`);
    }
    
    lines.push(`Total Links: ${Math.floor(totalLinks / 2)}`);
    lines.push('Lock Status:');
    lines.push(`- HARD: ${lockCounts.HARD || 0}`);
    lines.push(`- SOFT: ${lockCounts.SOFT || 0}`);
    lines.push(`- ARCHIVE: ${lockCounts.ARCHIVE || 0}`);
    lines.push('Status Distribution:');
    lines.push(`- ACTIVE: ${statusCounts.ACTIVE || 0}`);
    lines.push(`- NEEDS_REVIEW: ${statusCounts.NEEDS_REVIEW || 0}`);
    lines.push(`- INACTIVE: ${statusCounts.INACTIVE || 0}`);
    lines.push(`- DRAFT: ${statusCounts.DRAFT || 0}`);
    lines.push(`- APPROVED: ${statusCounts.APPROVED || 0}`);
    lines.push(`- LOCKED: ${statusCounts.LOCKED || 0}`);
    lines.push('');
    lines.push(`Completeness Score: ${result.healthSummary.completenessScore}%`);
    lines.push(`Integrity Score: ${result.healthSummary.integrityScore}%`);
    lines.push(`ISA Compliance Score: ${result.healthSummary.isaComplianceScore}%`);
    lines.push('');
    
    lines.push('SECTION 2: BREAK REGISTER');
    lines.push('--------------------------------------');
    
    if (result.breakRegister.length === 0) {
      lines.push('No breaks detected.');
    } else {
      lines.push('| ID | Severity | Type | Impacted | Root Cause | Fix Action | Status |');
      lines.push('|-----|----------|------|----------|------------|------------|--------|');
      
      for (const brk of result.breakRegister) {
        const id = brk.id.substring(0, 8);
        const impacted = `${brk.sourceEntity} -> ${brk.targetEntity || 'N/A'}`;
        const rootCause = brk.description.substring(0, 40) + (brk.description.length > 40 ? '...' : '');
        const fixAction = brk.repairAction ? brk.repairAction.substring(0, 30) + (brk.repairAction.length > 30 ? '...' : '') : 'Manual review';
        const status = brk.autoRepairable ? 'AUTO' : 'MANUAL';
        
        lines.push(`| ${id} | ${brk.severity} | ${brk.category} | ${impacted} | ${rootCause} | ${fixAction} | ${status} |`);
      }
    }
    lines.push('');
    
    lines.push('SECTION 3: AUTO-REPAIR LOG');
    lines.push('--------------------------------------');
    
    if (result.autoRepairLog.length === 0) {
      lines.push('No auto-repairs performed.');
    } else {
      lines.push('| Item | Before | After | Authority | Evidence/Logic | Status |');
      lines.push('|------|--------|-------|-----------|----------------|--------|');
      
      for (const repair of result.autoRepairLog) {
        const item = `${repair.entityType}:${repair.entityId.substring(0, 8)}`;
        const beforeStr = JSON.stringify(repair.beforeState).substring(0, 20) + '...';
        const afterStr = JSON.stringify(repair.afterState).substring(0, 20) + '...';
        const authority = `Level ${repair.authorityLevel}`;
        const evidence = repair.reason.substring(0, 30) + (repair.reason.length > 30 ? '...' : '');
        const status = repair.inactiveReason ? 'INACTIVE' : 'APPLIED';
        
        lines.push(`| ${item} | ${beforeStr} | ${afterStr} | ${authority} | ${evidence} | ${status} |`);
      }
    }
    lines.push('');
    
    lines.push('SECTION 4: REGENERATED ARTIFACTS');
    lines.push('--------------------------------------');
    
    const artifactsByType: Record<string, RegeneratedArtifact[]> = {};
    for (const artifact of result.regeneratedArtifacts) {
      if (!artifactsByType[artifact.artifactType]) {
        artifactsByType[artifact.artifactType] = [];
      }
      artifactsByType[artifact.artifactType].push(artifact);
    }
    
    const artifactTypeLabels: Record<string, string> = {
      'RiskMatrix': 'Risk Matrix',
      'PlannedResponse': 'Planned Responses',
      'SamplingFrame': 'Sampling Frames',
      'AuditProgram': 'Audit Program',
      'MisstatementSummary': 'Misstatement Summary',
      'EvidencePlaceholder': 'Evidence Placeholders',
      'DraftConclusion': 'Draft Conclusions',
    };
    
    for (const [type, label] of Object.entries(artifactTypeLabels)) {
      const artifacts = artifactsByType[type] || [];
      if (artifacts.length > 0) {
        const changes = artifacts.map(a => a.reason.substring(0, 50)).join('; ');
        lines.push(`- ${label}: ${artifacts.length} changes - ${changes}...`);
      } else {
        lines.push(`- ${label}: No changes`);
      }
    }
    
    const otherTypes = Object.keys(artifactsByType).filter(t => !artifactTypeLabels[t]);
    for (const type of otherTypes) {
      const artifacts = artifactsByType[type];
      lines.push(`- ${type}: ${artifacts.length} changes`);
    }
    
    lines.push('');
    
    lines.push('SECTION 5: GATING RESULT');
    lines.push('--------------------------------------');
    
    const gateCheck = result.gateCheckResult;
    lines.push(`Overall Status: ${gateCheck?.overall || result.gateResult.overall}`);
    lines.push(`FS Level Chain: ${result.gateResult.fsLevel}`);
    lines.push(`Assertion Track: ${result.gateResult.assertionTrack}`);
    lines.push('');
    
    if (result.gateResult.needsReviewList.length > 0) {
      lines.push('Remaining NEEDS_REVIEW items:');
      for (const item of result.gateResult.needsReviewList) {
        lines.push(`- ${item}`);
      }
    } else {
      lines.push('Remaining NEEDS_REVIEW items: None');
    }
    lines.push('');
    
    if (gateCheck && gateCheck.blockers.length > 0) {
      lines.push('Blockers (FAIL):');
      for (const blocker of gateCheck.blockers) {
        lines.push(`- ${blocker}`);
      }
    } else {
      lines.push('Blockers: None');
    }
    lines.push('');
    
    if (gateCheck && gateCheck.warnings.length > 0) {
      lines.push('Warnings:');
      for (const warning of gateCheck.warnings) {
        lines.push(`- ${warning}`);
      }
    }
    lines.push('');
    
    if (gateCheck && gateCheck.lockViolations.length > 0) {
      lines.push('Lock Violations:');
      for (const violation of gateCheck.lockViolations) {
        lines.push(`- ${violation}`);
      }
    }
    lines.push('');
    
    if (gateCheck && gateCheck.conclusionTraceStatus.length > 0) {
      lines.push('Conclusion Traceability Status:');
      for (const trace of gateCheck.conclusionTraceStatus) {
        const status = trace.traced ? 'TRACED' : 'NOT TRACED';
        const gapsStr = trace.gaps.length > 0 ? ` - Gaps: ${trace.gaps.join('; ')}` : '';
        lines.push(`- FS Head ${trace.fsHeadId}: ${status}${gapsStr}`);
      }
    }
    
    lines.push('');
    lines.push('==========================================');
    lines.push('END OF REPORT');
    lines.push('==========================================');
    
    return lines.join('\n');
  }
}

export const auditChainIntegrityService = new AuditChainIntegrityService();
