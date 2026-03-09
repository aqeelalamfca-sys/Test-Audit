import { prisma } from "../db";

export type StatusCode = "Grey" | "Green" | "Amber" | "Orange" | "Red";

export interface ISAPhaseRecord {
  isaId: string;
  isaName: string;
  phase: string;
  statusCode: StatusCode;
  completionPct: number;
  mandatoryDocsRequired: number;
  mandatoryDocsCompleted: number;
  signoffRequired: boolean;
  signoffDone: boolean;
  signoffRole: string;
  riskLinkRequired: boolean;
  riskLinkScore: number;
  lastUpdated: Date | null;
  owner: string;
  agingDays: number;
  blockingFlag: boolean;
  blockerReason: string;
}

export interface NoReportBlocker {
  isaId: string;
  isaName: string;
  gateDescription: string;
  passed: boolean;
  blockerDetails: string;
  owner: string;
  fixRoute: string;
}

export interface PhaseHeatbar {
  phase: string;
  completionPct: number;
  locked: boolean;
  greenCount: number;
  amberCount: number;
  orangeCount: number;
  redCount: number;
  greyCount: number;
}

export interface ComplianceSummary {
  overallScore: number;
  reportReady: boolean;
  redGapCount: number;
  orangeGapCount: number;
  amberGapCount: number;
  pendingSignoffs: number;
  eqcrStatus: string;
  significantRisksMissingLink: number;
  unadjustedVsPM: { unadjustedTotal: number; performanceMateriality: number; exceeds: boolean };
}

interface ISAPhaseMatrixEntry {
  isaId: string;
  isaName: string;
  phase: string;
  isStageGate: boolean;
  signoffRole: string;
  riskLinkRequired: boolean;
  noReportBlocker: boolean;
  weight: number;
}

interface PhaseProgressRecord {
  phase: string;
  status: string;
  completionPercentage: number;
  updatedAt: Date | null;
}

interface SignOffRecord {
  id: string;
  phase: string;
  status: string;
  signOffType: string | null;
  description: string | null;
  isaReference: string | null;
}

interface RiskRecord {
  id: string;
  riskDescription: string | null;
  isFraudRisk: boolean;
  isSignificantRisk: boolean;
  assertion: string | null;
}

interface TestRecord {
  id: string;
  riskId: string | null;
}

interface MisstatementRecord {
  id: string;
  status: string;
  misstatementAmount: number | string | null;
  isAboveTrivialThreshold: boolean | null;
}

interface MaterialityRecord {
  overallMateriality: number | string | null;
  performanceMateriality: number | string | null;
  status: string;
}

interface GCAssessmentRecord {
  overallConclusion: string | null;
  partnerApprovedById: string | null;
}

interface AuditReportRecord {
  opinionType: string | null;
  partnerApprovedById: string | null;
}

interface EvidenceFileRecord {
  id: string;
  sufficiencyRating: string | null;
  procedureIds: string[] | null;
  description: string | null;
}

interface EQCRRecord {
  verdict: string | null;
}

interface IndependenceRecord {
  id: string;
}

interface AuditStrategyRecord {
  partnerApprovedById: string | null;
}

interface EngagementRecord {
  id: string;
  engagementLetterSigned: boolean;
  preconditionsMet: boolean;
  managementAcknowledges: boolean;
  termsAgreed: boolean;
  engagementPartnerId: string | null;
  eqcrRequired: boolean;
  isRecurring: boolean | null;
  engagementName: string | null;
  name: string | null;
  clientName: string | null;
  yearEnd: string | Date | null;
  engagementType: string | null;
}

interface ComplianceContext {
  engagement: EngagementRecord;
  phaseMap: Map<string, PhaseProgressRecord>;
  signOffs: SignOffRecord[];
  completedSignOffs: SignOffRecord[];
  risks: RiskRecord[];
  tests: TestRecord[];
  misstatements: MisstatementRecord[];
  materiality: MaterialityRecord | null;
  gcAssessment: GCAssessmentRecord | null;
  auditReport: AuditReportRecord | null;
  evidenceFiles: EvidenceFileRecord[];
  eqcr: EQCRRecord | null;
  independenceDeclarations: IndependenceRecord[];
  auditStrategy: AuditStrategyRecord | null;
  auditTrailCount: number;
}

interface NoReportBlockerGate {
  isaId: string;
  isaName: string;
  gateDescription: string;
  fixRoute: string;
}

function countTrue(...conditions: boolean[]): number {
  return conditions.filter(Boolean).length;
}

function applyStageGate(
  isStageGate: boolean,
  docsCompleted: number,
  docsRequired: number,
  reason: string
): { blockingFlag: boolean; blockerReason: string } {
  if (isStageGate && docsCompleted < docsRequired) {
    return { blockingFlag: true, blockerReason: reason };
  }
  return { blockingFlag: false, blockerReason: "" };
}

function computeRiskCoverage(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
}

const ISA_PHASE_MATRIX: ISAPhaseMatrixEntry[] = [
  { isaId: "ISA_200", isaName: "ISA 200", phase: "pre-planning", isStageGate: false, signoffRole: "ENGAGEMENT_PARTNER", riskLinkRequired: false, noReportBlocker: false, weight: 1.0 },
  { isaId: "ISA_210", isaName: "ISA 210", phase: "pre-planning", isStageGate: true, signoffRole: "ENGAGEMENT_PARTNER", riskLinkRequired: false, noReportBlocker: true, weight: 1.3 },
  { isaId: "ISA_220", isaName: "ISA 220", phase: "pre-planning", isStageGate: true, signoffRole: "ENGAGEMENT_PARTNER", riskLinkRequired: false, noReportBlocker: true, weight: 1.2 },
  { isaId: "ISA_220_FIN", isaName: "ISA 220 (Revised)", phase: "finalization", isStageGate: true, signoffRole: "ENGAGEMENT_PARTNER", riskLinkRequired: false, noReportBlocker: true, weight: 1.2 },
  { isaId: "ISA_230", isaName: "ISA 230", phase: "execution", isStageGate: false, signoffRole: "ENGAGEMENT_PARTNER", riskLinkRequired: false, noReportBlocker: true, weight: 1.5 },
  { isaId: "ISA_240", isaName: "ISA 240", phase: "planning", isStageGate: true, signoffRole: "ENGAGEMENT_PARTNER", riskLinkRequired: true, noReportBlocker: false, weight: 1.2 },
  { isaId: "ISA_250", isaName: "ISA 250", phase: "planning", isStageGate: false, signoffRole: "ENGAGEMENT_PARTNER", riskLinkRequired: false, noReportBlocker: false, weight: 1.0 },
  { isaId: "ISA_260_PLAN", isaName: "ISA 260", phase: "planning", isStageGate: false, signoffRole: "ENGAGEMENT_PARTNER", riskLinkRequired: false, noReportBlocker: false, weight: 1.0 },
  { isaId: "ISA_260_FIN", isaName: "ISA 260", phase: "finalization", isStageGate: false, signoffRole: "ENGAGEMENT_PARTNER", riskLinkRequired: false, noReportBlocker: false, weight: 1.0 },
  { isaId: "ISA_265", isaName: "ISA 265", phase: "execution", isStageGate: false, signoffRole: "ENGAGEMENT_PARTNER", riskLinkRequired: false, noReportBlocker: false, weight: 1.0 },
  { isaId: "ISA_300", isaName: "ISA 300", phase: "planning", isStageGate: true, signoffRole: "ENGAGEMENT_PARTNER", riskLinkRequired: false, noReportBlocker: false, weight: 1.0 },
  { isaId: "ISA_315", isaName: "ISA 315", phase: "planning", isStageGate: true, signoffRole: "ENGAGEMENT_PARTNER", riskLinkRequired: true, noReportBlocker: true, weight: 1.3 },
  { isaId: "ISA_320", isaName: "ISA 320", phase: "planning", isStageGate: true, signoffRole: "ENGAGEMENT_PARTNER", riskLinkRequired: false, noReportBlocker: false, weight: 1.2 },
  { isaId: "ISA_330", isaName: "ISA 330", phase: "planning", isStageGate: true, signoffRole: "ENGAGEMENT_PARTNER", riskLinkRequired: true, noReportBlocker: true, weight: 1.4 },
  { isaId: "ISA_402", isaName: "ISA 402", phase: "planning", isStageGate: false, signoffRole: "ENGAGEMENT_PARTNER", riskLinkRequired: false, noReportBlocker: false, weight: 0.8 },
  { isaId: "ISA_450_EXEC", isaName: "ISA 450", phase: "execution", isStageGate: true, signoffRole: "ENGAGEMENT_PARTNER", riskLinkRequired: false, noReportBlocker: true, weight: 1.3 },
  { isaId: "ISA_450_FIN", isaName: "ISA 450", phase: "finalization", isStageGate: true, signoffRole: "ENGAGEMENT_PARTNER", riskLinkRequired: false, noReportBlocker: true, weight: 1.3 },
  { isaId: "ISA_500", isaName: "ISA 500", phase: "execution", isStageGate: false, signoffRole: "AUDIT_MANAGER", riskLinkRequired: false, noReportBlocker: false, weight: 1.4 },
  { isaId: "ISA_501", isaName: "ISA 501", phase: "execution", isStageGate: false, signoffRole: "AUDIT_MANAGER", riskLinkRequired: false, noReportBlocker: false, weight: 1.0 },
  { isaId: "ISA_505", isaName: "ISA 505", phase: "execution", isStageGate: false, signoffRole: "AUDIT_MANAGER", riskLinkRequired: false, noReportBlocker: false, weight: 1.0 },
  { isaId: "ISA_510", isaName: "ISA 510", phase: "pre-planning", isStageGate: false, signoffRole: "ENGAGEMENT_PARTNER", riskLinkRequired: false, noReportBlocker: false, weight: 0.8 },
  { isaId: "ISA_520_PLAN", isaName: "ISA 520", phase: "planning", isStageGate: false, signoffRole: "ENGAGEMENT_PARTNER", riskLinkRequired: false, noReportBlocker: false, weight: 1.0 },
  { isaId: "ISA_520_EXEC", isaName: "ISA 520", phase: "execution", isStageGate: false, signoffRole: "ENGAGEMENT_PARTNER", riskLinkRequired: false, noReportBlocker: false, weight: 1.0 },
  { isaId: "ISA_530", isaName: "ISA 530", phase: "planning", isStageGate: false, signoffRole: "ENGAGEMENT_PARTNER", riskLinkRequired: false, noReportBlocker: false, weight: 1.0 },
  { isaId: "ISA_540", isaName: "ISA 540", phase: "planning", isStageGate: false, signoffRole: "ENGAGEMENT_PARTNER", riskLinkRequired: false, noReportBlocker: false, weight: 1.0 },
  { isaId: "ISA_550", isaName: "ISA 550", phase: "planning", isStageGate: false, signoffRole: "ENGAGEMENT_PARTNER", riskLinkRequired: false, noReportBlocker: false, weight: 1.0 },
  { isaId: "ISA_560", isaName: "ISA 560", phase: "finalization", isStageGate: true, signoffRole: "ENGAGEMENT_PARTNER", riskLinkRequired: false, noReportBlocker: false, weight: 1.1 },
  { isaId: "ISA_570_PLAN", isaName: "ISA 570", phase: "planning", isStageGate: false, signoffRole: "ENGAGEMENT_PARTNER", riskLinkRequired: false, noReportBlocker: false, weight: 1.0 },
  { isaId: "ISA_570_FIN", isaName: "ISA 570", phase: "finalization", isStageGate: true, signoffRole: "ENGAGEMENT_PARTNER", riskLinkRequired: false, noReportBlocker: true, weight: 1.2 },
  { isaId: "ISA_580", isaName: "ISA 580", phase: "finalization", isStageGate: true, signoffRole: "ENGAGEMENT_PARTNER", riskLinkRequired: false, noReportBlocker: true, weight: 1.2 },
  { isaId: "ISA_600", isaName: "ISA 600 (Rev)", phase: "planning", isStageGate: false, signoffRole: "ENGAGEMENT_PARTNER", riskLinkRequired: false, noReportBlocker: false, weight: 0.8 },
  { isaId: "ISA_610", isaName: "ISA 610", phase: "planning", isStageGate: false, signoffRole: "ENGAGEMENT_PARTNER", riskLinkRequired: false, noReportBlocker: false, weight: 0.7 },
  { isaId: "ISA_620", isaName: "ISA 620", phase: "planning", isStageGate: false, signoffRole: "ENGAGEMENT_PARTNER", riskLinkRequired: false, noReportBlocker: false, weight: 0.7 },
  { isaId: "ISA_700", isaName: "ISA 700", phase: "finalization", isStageGate: true, signoffRole: "ENGAGEMENT_PARTNER", riskLinkRequired: false, noReportBlocker: true, weight: 1.3 },
  { isaId: "ISA_701", isaName: "ISA 701", phase: "finalization", isStageGate: false, signoffRole: "ENGAGEMENT_PARTNER", riskLinkRequired: true, noReportBlocker: false, weight: 1.0 },
  { isaId: "ISA_705", isaName: "ISA 705", phase: "finalization", isStageGate: true, signoffRole: "ENGAGEMENT_PARTNER", riskLinkRequired: false, noReportBlocker: false, weight: 1.0 },
  { isaId: "ISA_706", isaName: "ISA 706", phase: "finalization", isStageGate: false, signoffRole: "ENGAGEMENT_PARTNER", riskLinkRequired: false, noReportBlocker: false, weight: 0.8 },
  { isaId: "ISA_710", isaName: "ISA 710", phase: "finalization", isStageGate: false, signoffRole: "ENGAGEMENT_PARTNER", riskLinkRequired: false, noReportBlocker: false, weight: 0.8 },
  { isaId: "ISA_720", isaName: "ISA 720", phase: "finalization", isStageGate: false, signoffRole: "ENGAGEMENT_PARTNER", riskLinkRequired: false, noReportBlocker: false, weight: 0.8 },
  { isaId: "ISQM_1", isaName: "ISQM 1", phase: "eqcr", isStageGate: true, signoffRole: "PARTNER", riskLinkRequired: false, noReportBlocker: false, weight: 1.5 },
  { isaId: "IESBA", isaName: "IESBA Code", phase: "pre-planning", isStageGate: false, signoffRole: "ENGAGEMENT_PARTNER", riskLinkRequired: false, noReportBlocker: false, weight: 1.0 },
];

const PHASE_TO_PRISMA: Record<string, string> = {
  "pre-planning": "PRE_PLANNING",
  "planning": "PLANNING",
  "execution": "EXECUTION",
  "finalization": "FINALIZATION",
  "deliverables": "REPORTING",
  "eqcr": "EQCR",
};

const PRISMA_TO_PHASE: Record<string, string> = {
  PRE_PLANNING: "pre-planning",
  PLANNING: "planning",
  EXECUTION: "execution",
  FINALIZATION: "finalization",
  REPORTING: "deliverables",
  EQCR: "eqcr",
};

const NO_REPORT_BLOCKER_GATES: NoReportBlockerGate[] = [
  { isaId: "ISA_210", isaName: "ISA 210", gateDescription: "Engagement terms agreed and engagement letter signed", fixRoute: "/engagements/{id}/pre-planning/acceptance" },
  { isaId: "ISA_315", isaName: "ISA 315+330", gateDescription: "Risk assessment completed with responsive procedures linked to all identified risks", fixRoute: "/engagements/{id}/planning/risk-assessment" },
  { isaId: "ISA_330", isaName: "ISA 315+330", gateDescription: "Responses to assessed risks designed and executed for all significant risks", fixRoute: "/engagements/{id}/planning/audit-program" },
  { isaId: "ISA_450", isaName: "ISA 450", gateDescription: "Misstatements evaluated — uncorrected misstatements below performance materiality", fixRoute: "/engagements/{id}/execution/misstatements" },
  { isaId: "ISA_570", isaName: "ISA 570", gateDescription: "Going concern assessment completed with partner review", fixRoute: "/engagements/{id}/finalization/going-concern" },
  { isaId: "ISA_580", isaName: "ISA 580", gateDescription: "Written representations obtained from management", fixRoute: "/engagements/{id}/finalization/written-representations" },
  { isaId: "ISA_220", isaName: "ISA 220", gateDescription: "Quality management confirmed — independence, EQCR (if required), direction & supervision documented", fixRoute: "/engagements/{id}/pre-planning/team" },
  { isaId: "ISA_700", isaName: "ISA 700+", gateDescription: "Opinion formed, report drafted, and partner-approved", fixRoute: "/engagements/{id}/finalization/reporting-opinion" },
];

class ISAPhaseComplianceService {

  private async fetchComplianceContext(engagementId: string): Promise<ComplianceContext | null> {
    const [
      engagement,
      phaseProgresses,
      signOffs,
      risks,
      tests,
      misstatements,
      materiality,
      gcAssessment,
      auditReport,
      evidenceFiles,
      eqcr,
      independenceDeclarations,
      auditStrategy,
      auditTrailCount,
    ] = await Promise.all([
      prisma.engagement.findUnique({ where: { id: engagementId } }),
      prisma.phaseProgress.findMany({ where: { engagementId } }),
      prisma.signOffRegister.findMany({ where: { engagementId } }),
      prisma.riskAssessment.findMany({ where: { engagementId } }),
      prisma.substantiveTest.findMany({ where: { engagementId } }),
      prisma.misstatement.findMany({ where: { engagementId } }),
      prisma.materialityCalculation.findFirst({ where: { engagementId, status: "APPROVED" } }),
      prisma.goingConcernAssessment.findFirst({ where: { engagementId } }),
      prisma.auditReport.findUnique({ where: { engagementId } }),
      prisma.evidenceFile.findMany({ where: { engagementId } }),
      prisma.eQCRAssignment.findUnique({ where: { engagementId } }),
      prisma.independenceDeclaration.findMany({ where: { engagementId } }),
      prisma.auditStrategy.findUnique({ where: { engagementId } }),
      prisma.auditTrail.count({ where: { engagementId } }),
    ]);

    if (!engagement) return null;

    const phaseMap = new Map<string, PhaseProgressRecord>();
    for (const p of phaseProgresses) {
      phaseMap.set(p.phase, p as unknown as PhaseProgressRecord);
    }

    const completedSignOffs = (signOffs as unknown as SignOffRecord[]).filter(
      (s) => s.status === "COMPLETED" || s.status === "APPROVED"
    );

    return {
      engagement: engagement as unknown as EngagementRecord,
      phaseMap,
      signOffs: signOffs as unknown as SignOffRecord[],
      completedSignOffs,
      risks: risks as unknown as RiskRecord[],
      tests: tests as unknown as TestRecord[],
      misstatements: misstatements as unknown as MisstatementRecord[],
      materiality: materiality as unknown as MaterialityRecord | null,
      gcAssessment: gcAssessment as unknown as GCAssessmentRecord | null,
      auditReport: auditReport as unknown as AuditReportRecord | null,
      evidenceFiles: evidenceFiles as unknown as EvidenceFileRecord[],
      eqcr: eqcr as unknown as EQCRRecord | null,
      independenceDeclarations: independenceDeclarations as unknown as IndependenceRecord[],
      auditStrategy: auditStrategy as unknown as AuditStrategyRecord | null,
      auditTrailCount,
    };
  }

  private computeRecordsFromContext(ctx: ComplianceContext): ISAPhaseRecord[] {
    const records: ISAPhaseRecord[] = [];
    for (const entry of ISA_PHASE_MATRIX) {
      records.push(this.computeISAPhaseRecord(entry, ctx));
    }
    return records;
  }

  async computeEngagementCompliance(engagementId: string): Promise<ISAPhaseRecord[]> {
    const ctx = await this.fetchComplianceContext(engagementId);
    if (!ctx) return [];
    return this.computeRecordsFromContext(ctx);
  }

  private resolveSignoffStatus(entry: ISAPhaseMatrixEntry, signOffs: SignOffRecord[]): boolean {
    const baseId = entry.isaId.replace(/_PLAN$/, "").replace(/_EXEC$/, "").replace(/_FIN$/, "");
    const matching = signOffs.filter((s) => {
      const isaRef = (s.isaReference || "").replace(/\s/g, "_").toUpperCase();
      return isaRef.includes(baseId);
    });
    return matching.some((s) => s.status === "COMPLETED" || s.status === "APPROVED");
  }

  private computeISAPhaseRecord(entry: ISAPhaseMatrixEntry, ctx: ComplianceContext): ISAPhaseRecord {
    const prismaPhase = PHASE_TO_PRISMA[entry.phase] || "PLANNING";
    const phaseProgress = ctx.phaseMap.get(prismaPhase);
    const lastUpdated: Date | null = phaseProgress?.updatedAt ?? null;
    const signoffDone = this.resolveSignoffStatus(entry, ctx.signOffs);
    const owner = entry.signoffRole;

    const result = this.evaluateISA(entry, ctx, phaseProgress ?? null);

    const completionPct = result.docsRequired > 0
      ? Math.round((result.docsCompleted / result.docsRequired) * 100)
      : 0;
    const statusCode = this.determineStatus(completionPct, phaseProgress ?? null);
    const agingDays = lastUpdated
      ? Math.max(0, Math.floor((Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60 * 24)))
      : 0;

    return {
      isaId: entry.isaId,
      isaName: entry.isaName,
      phase: entry.phase,
      statusCode,
      completionPct,
      mandatoryDocsRequired: result.docsRequired,
      mandatoryDocsCompleted: result.docsCompleted,
      signoffRequired: entry.isStageGate,
      signoffDone,
      signoffRole: entry.signoffRole,
      riskLinkRequired: entry.riskLinkRequired,
      riskLinkScore: result.riskLinkScore,
      lastUpdated,
      owner,
      agingDays,
      blockingFlag: result.blockingFlag,
      blockerReason: result.blockerReason,
    };
  }

  private evaluateISA(
    entry: ISAPhaseMatrixEntry,
    ctx: ComplianceContext,
    phaseProgress: PhaseProgressRecord | null
  ): { docsRequired: number; docsCompleted: number; riskLinkScore: number; blockingFlag: boolean; blockerReason: string } {
    let riskLinkScore = 0;

    switch (entry.isaId) {
      case "ISA_210": {
        const docsCompleted = countTrue(
          !!ctx.engagement.engagementLetterSigned,
          !!ctx.engagement.preconditionsMet,
          !!ctx.engagement.managementAcknowledges,
          !!ctx.engagement.termsAgreed
        );
        const gate = applyStageGate(entry.isStageGate, docsCompleted, 4, `Missing ${4 - docsCompleted} engagement precondition(s)`);
        return { docsRequired: 4, docsCompleted, riskLinkScore, ...gate };
      }

      case "ISA_220":
      case "ISA_220_FIN": {
        const eqcrSatisfied = ctx.engagement.eqcrRequired ? !!ctx.eqcr : true;
        const docsCompleted = countTrue(
          !!ctx.engagement.engagementPartnerId,
          ctx.independenceDeclarations.length > 0,
          eqcrSatisfied
        );
        const gate = applyStageGate(entry.isStageGate, docsCompleted, 3, "Quality management requirements incomplete");
        return { docsRequired: 3, docsCompleted, riskLinkScore, ...gate };
      }

      case "ISA_200": {
        const docsCompleted = countTrue(
          !!ctx.engagement.engagementLetterSigned,
          ctx.independenceDeclarations.length > 0
        );
        return { docsRequired: 2, docsCompleted, riskLinkScore, blockingFlag: false, blockerReason: "" };
      }

      case "ISA_230": {
        const lockedPhases = Array.from(ctx.phaseMap.values()).filter(
          (p) => p.status === "LOCKED" || p.status === "COMPLETED"
        );
        const docsCompleted = countTrue(
          ctx.auditTrailCount > 0,
          lockedPhases.length > 0,
          ctx.completedSignOffs.length > 0
        );
        const gate = applyStageGate(true, docsCompleted, 3, "Audit documentation incomplete");
        return { docsRequired: 3, docsCompleted, riskLinkScore, ...gate };
      }

      case "ISA_240": {
        const fraudRisks = ctx.risks.filter((r) => r.isFraudRisk);
        const risksWithAssertions = ctx.risks.filter((r) => r.assertion);
        const docsCompleted = countTrue(
          fraudRisks.length > 0,
          ctx.risks.length > 0,
          risksWithAssertions.length > 0 && risksWithAssertions.length === ctx.risks.length
        );
        if (entry.riskLinkRequired) {
          riskLinkScore = computeRiskCoverage(fraudRisks.length, ctx.risks.length);
        }
        return { docsRequired: 3, docsCompleted, riskLinkScore, blockingFlag: false, blockerReason: "" };
      }

      case "ISA_300": {
        const docsCompleted = countTrue(
          !!ctx.auditStrategy,
          !!ctx.auditStrategy?.partnerApprovedById,
          !!ctx.engagement.engagementPartnerId
        );
        const gate = applyStageGate(entry.isStageGate, docsCompleted, 3, "Audit strategy not complete or approved");
        return { docsRequired: 3, docsCompleted, riskLinkScore, ...gate };
      }

      case "ISA_315": {
        const sigRisks = ctx.risks.filter((r) => r.isSignificantRisk);
        const fraudRisks = ctx.risks.filter((r) => r.isFraudRisk);
        const withAssertions = ctx.risks.filter((r) => r.assertion);
        const docsCompleted = countTrue(
          ctx.risks.length > 0,
          sigRisks.length > 0,
          fraudRisks.length > 0,
          withAssertions.length === ctx.risks.length && ctx.risks.length > 0
        );
        if (entry.riskLinkRequired) {
          riskLinkScore = computeRiskCoverage(withAssertions.length, ctx.risks.length);
        }
        const gate = applyStageGate(entry.isStageGate, docsCompleted, 4, `Risk assessment incomplete: ${4 - docsCompleted} items missing`);
        return { docsRequired: 4, docsCompleted, riskLinkScore, ...gate };
      }

      case "ISA_320": {
        const docsCompleted = countTrue(
          !!ctx.materiality,
          !!ctx.materiality?.overallMateriality,
          !!ctx.materiality?.performanceMateriality
        );
        const gate = applyStageGate(entry.isStageGate, docsCompleted, 3, "Materiality not fully determined");
        return { docsRequired: 3, docsCompleted, riskLinkScore, ...gate };
      }

      case "ISA_330": {
        const linkedTests = ctx.tests.filter((t) => t.riskId);
        const riskIds = new Set(ctx.risks.map((r) => r.id));
        const coveredRisks = new Set(linkedTests.map((t) => t.riskId));
        const allCovered = ctx.risks.length > 0 && [...riskIds].every((id) => coveredRisks.has(id));
        const docsCompleted = countTrue(
          ctx.tests.length > 0,
          linkedTests.length > 0,
          allCovered
        );
        if (entry.riskLinkRequired) {
          riskLinkScore = computeRiskCoverage(coveredRisks.size, riskIds.size);
        }
        const gate = applyStageGate(entry.isStageGate, docsCompleted, 3, "Responses to assessed risks not fully designed");
        return { docsRequired: 3, docsCompleted, riskLinkScore, ...gate };
      }

      case "ISA_450_EXEC":
      case "ISA_450_FIN": {
        const evaluated = ctx.misstatements.filter((m) => m.isAboveTrivialThreshold !== null);
        let docsCompleted = 0;
        let blockingFlag = false;
        let blockerReason = "";

        if (ctx.misstatements.length === 0 || evaluated.length === ctx.misstatements.length) docsCompleted++;

        if (ctx.materiality) {
          const uncorrected = ctx.misstatements.filter((m) => m.status !== "ADJUSTED");
          const totalUncorrected = uncorrected.reduce((sum, m) => sum + Number(m.misstatementAmount || 0), 0);
          const pm = Number(ctx.materiality.performanceMateriality || 0);
          if (totalUncorrected <= pm) {
            docsCompleted++;
          } else {
            blockingFlag = true;
            blockerReason = `Uncorrected misstatements (${totalUncorrected.toLocaleString()}) exceed PM`;
          }
        } else {
          docsCompleted++;
        }
        return { docsRequired: 2, docsCompleted, riskLinkScore, blockingFlag, blockerReason };
      }

      case "ISA_500": {
        const withSufficiency = ctx.evidenceFiles.filter((e) => e.sufficiencyRating);
        const linkedToTests = ctx.evidenceFiles.filter((e) => e.procedureIds && e.procedureIds.length > 0);
        const hasEnoughSufficiency = ctx.evidenceFiles.length > 0 && withSufficiency.length >= ctx.evidenceFiles.length * 0.5;
        const hasEnoughLinkage = ctx.evidenceFiles.length > 0 && linkedToTests.length >= ctx.evidenceFiles.length * 0.8;
        const docsCompleted = countTrue(
          ctx.evidenceFiles.length > 0,
          hasEnoughSufficiency,
          hasEnoughLinkage
        );
        return { docsRequired: 3, docsCompleted, riskLinkScore, blockingFlag: false, blockerReason: "" };
      }

      case "ISA_501":
      case "ISA_505": {
        const keywords = entry.isaId === "ISA_501"
          ? ["inventory", "litigation", "segment"]
          : ["confirmation", "external"];
        const relevantEvidence = ctx.evidenceFiles.filter((e) => {
          const desc = (e.description || "").toLowerCase();
          return keywords.some((kw) => desc.includes(kw));
        });
        const docsCompleted = countTrue(relevantEvidence.length > 0, ctx.tests.length > 0);
        return { docsRequired: 2, docsCompleted, riskLinkScore, blockingFlag: false, blockerReason: "" };
      }

      case "ISA_510": {
        const docsCompleted = countTrue(ctx.engagement.isRecurring !== false, ctx.evidenceFiles.length > 0);
        return { docsRequired: 2, docsCompleted, riskLinkScore, blockingFlag: false, blockerReason: "" };
      }

      case "ISA_540": {
        const estimateRisks = ctx.risks.filter((r) => {
          const desc = (r.riskDescription || "").toLowerCase();
          return desc.includes("estimate") || desc.includes("fair value") || desc.includes("provision") || desc.includes("impairment");
        });
        const docsCompleted = countTrue(estimateRisks.length > 0 || ctx.risks.length > 0, ctx.tests.length > 0);
        return { docsRequired: 2, docsCompleted, riskLinkScore, blockingFlag: false, blockerReason: "" };
      }

      case "ISA_550": {
        const docsCompleted = countTrue(ctx.risks.length > 0, ctx.tests.length > 0);
        return { docsRequired: 2, docsCompleted, riskLinkScore, blockingFlag: false, blockerReason: "" };
      }

      case "ISA_560": {
        const seSignOffs = ctx.signOffs.filter((s) => {
          const desc = (s.description || "").toLowerCase();
          return desc.includes("subsequent") || desc.includes("isa 560");
        });
        const docsCompleted = countTrue(
          seSignOffs.length > 0,
          seSignOffs.some((s) => s.status === "COMPLETED" || s.status === "APPROVED")
        );
        const gate = applyStageGate(entry.isStageGate, docsCompleted, 2, "Subsequent events review not completed");
        return { docsRequired: 2, docsCompleted, riskLinkScore, ...gate };
      }

      case "ISA_265": {
        const docsCompleted = countTrue(ctx.tests.length > 0, ctx.completedSignOffs.length > 0);
        return { docsRequired: 2, docsCompleted, riskLinkScore, blockingFlag: false, blockerReason: "" };
      }

      case "ISA_705":
      case "ISA_706":
      case "ISA_708":
      case "ISA_710":
      case "ISA_720": {
        const docsCompleted = countTrue(!!ctx.auditReport, !!ctx.auditReport?.partnerApprovedById);
        const gate = applyStageGate(entry.isStageGate, docsCompleted, 2, `${entry.isaName} requirements not met — report not finalized`);
        return { docsRequired: 2, docsCompleted, riskLinkScore, ...gate };
      }

      case "ISA_570_PLAN":
      case "ISA_570_FIN": {
        const docsCompleted = countTrue(
          !!ctx.gcAssessment,
          !!ctx.gcAssessment?.overallConclusion,
          !!ctx.gcAssessment?.partnerApprovedById
        );
        const gate = applyStageGate(entry.isStageGate, docsCompleted, 3, "Going concern assessment incomplete");
        return { docsRequired: 3, docsCompleted, riskLinkScore, ...gate };
      }

      case "ISA_580": {
        const reps = ctx.signOffs.filter((s) => {
          const desc = (s.description || "").toLowerCase();
          return desc.includes("representation") || desc.includes("isa 580");
        });
        const docsCompleted = countTrue(
          reps.length > 0,
          reps.some((r) => r.status === "COMPLETED" || r.status === "APPROVED")
        );
        const gate = applyStageGate(entry.isStageGate, docsCompleted, 2, "Written representations not obtained");
        return { docsRequired: 2, docsCompleted, riskLinkScore, ...gate };
      }

      case "ISA_700": {
        const docsCompleted = countTrue(
          !!ctx.auditReport,
          !!ctx.auditReport?.opinionType,
          !!ctx.auditReport?.partnerApprovedById
        );
        const gate = applyStageGate(entry.isStageGate, docsCompleted, 3, "Audit report not complete or partner-approved");
        return { docsRequired: 3, docsCompleted, riskLinkScore, ...gate };
      }

      case "ISA_701": {
        const sigRisks = ctx.risks.filter((r) => r.isSignificantRisk);
        const docsCompleted = countTrue(!!ctx.auditReport, sigRisks.length > 0);
        if (entry.riskLinkRequired) {
          riskLinkScore = sigRisks.length > 0 ? 100 : 0;
        }
        return { docsRequired: 2, docsCompleted, riskLinkScore, blockingFlag: false, blockerReason: "" };
      }

      case "ISQM_1": {
        const partnerSignOffs = ctx.completedSignOffs.filter(
          (s) => s.signOffType === "PARTNER_SIGN_OFF" || s.signOffType === "PARTNER_REVIEW"
        );
        const eqcrSatisfied = ctx.engagement.eqcrRequired
          ? ctx.eqcr?.verdict === "APPROVED"
          : true;
        const docsCompleted = countTrue(
          !!ctx.engagement.engagementPartnerId,
          partnerSignOffs.length > 0,
          eqcrSatisfied
        );
        return { docsRequired: 3, docsCompleted, riskLinkScore, blockingFlag: false, blockerReason: "" };
      }

      default: {
        let docsCompleted = 0;
        if (phaseProgress) {
          const pct = phaseProgress.completionPercentage || 0;
          if (pct >= 50) docsCompleted++;
          if (pct >= 100) docsCompleted++;
        }
        return { docsRequired: 2, docsCompleted, riskLinkScore, blockingFlag: false, blockerReason: "" };
      }
    }
  }

  private determineStatus(completionPct: number, phaseProgress: PhaseProgressRecord | null): StatusCode {
    if (!phaseProgress || (phaseProgress.status === "NOT_STARTED" && completionPct === 0)) return "Grey";
    if (completionPct >= 100) return "Green";
    if (completionPct >= 75) return "Amber";
    if (completionPct >= 50) return "Orange";
    return "Red";
  }

  private resolveBlockersFromRecords(records: ISAPhaseRecord[], engagementId: string): NoReportBlocker[] {
    const recordMap = new Map(records.map((r) => [r.isaId, r]));

    return NO_REPORT_BLOCKER_GATES.map((gate) => {
      const record = recordMap.get(gate.isaId)
        || recordMap.get(gate.isaId + "_FIN")
        || recordMap.get(gate.isaId + "_EXEC");

      const passed = record ? record.completionPct >= 100 && !record.blockingFlag : false;

      return {
        isaId: gate.isaId,
        isaName: gate.isaName,
        gateDescription: gate.gateDescription,
        passed,
        blockerDetails: record?.blockingFlag
          ? record.blockerReason
          : (passed ? "" : "Requirements not fully met"),
        owner: record?.owner || "ENGAGEMENT_PARTNER",
        fixRoute: gate.fixRoute.replace("{id}", engagementId),
      };
    });
  }

  async getNoReportBlockers(engagementId: string): Promise<NoReportBlocker[]> {
    const records = await this.computeEngagementCompliance(engagementId);
    return this.resolveBlockersFromRecords(records, engagementId);
  }

  async getPhaseHeatbar(engagementId: string): Promise<PhaseHeatbar[]> {
    const records = await this.computeEngagementCompliance(engagementId);
    const phaseProgresses = await prisma.phaseProgress.findMany({ where: { engagementId } });
    const lockedPhases = new Set(
      phaseProgresses
        .filter((p) => p.status === "LOCKED" || p.status === "COMPLETED")
        .map((p) => PRISMA_TO_PHASE[p.phase] || p.phase.toLowerCase())
    );

    const phases = ["pre-planning", "planning", "execution", "finalization", "deliverables", "eqcr"];
    return phases.map((phase) => {
      const phaseRecords = records.filter((r) => r.phase === phase);
      if (phaseRecords.length === 0) {
        return { phase, completionPct: 0, locked: lockedPhases.has(phase), greenCount: 0, amberCount: 0, orangeCount: 0, redCount: 0, greyCount: 0 };
      }
      const totalPct = phaseRecords.reduce((sum, r) => sum + r.completionPct, 0);
      return {
        phase,
        completionPct: Math.round(totalPct / phaseRecords.length),
        locked: lockedPhases.has(phase),
        greenCount: phaseRecords.filter((r) => r.statusCode === "Green").length,
        amberCount: phaseRecords.filter((r) => r.statusCode === "Amber").length,
        orangeCount: phaseRecords.filter((r) => r.statusCode === "Orange").length,
        redCount: phaseRecords.filter((r) => r.statusCode === "Red").length,
        greyCount: phaseRecords.filter((r) => r.statusCode === "Grey").length,
      };
    });
  }

  async getComplianceSummary(engagementId: string): Promise<ComplianceSummary> {
    const ctx = await this.fetchComplianceContext(engagementId);
    if (!ctx) {
      return {
        overallScore: 0, reportReady: false, redGapCount: 0, orangeGapCount: 0,
        amberGapCount: 0, pendingSignoffs: 0, eqcrStatus: "N/A",
        significantRisksMissingLink: 0,
        unadjustedVsPM: { unadjustedTotal: 0, performanceMateriality: 0, exceeds: false },
      };
    }

    const records = this.computeRecordsFromContext(ctx);
    const blockers = this.resolveBlockersFromRecords(records, engagementId);

    let weightedScore = 0;
    let totalWeight = 0;
    for (const entry of ISA_PHASE_MATRIX) {
      const record = records.find((r) => r.isaId === entry.isaId);
      if (record) {
        weightedScore += record.completionPct * entry.weight;
        totalWeight += entry.weight;
      }
    }
    const overallScore = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;

    const allBlockersPassed = blockers.every((b) => b.passed);
    const reportReady = allBlockersPassed && overallScore >= 80;

    const redGapCount = records.filter((r) => r.statusCode === "Red").length;
    const orangeGapCount = records.filter((r) => r.statusCode === "Orange").length;
    const amberGapCount = records.filter((r) => r.statusCode === "Amber").length;

    const pendingSignoffs = ctx.signOffs.filter(
      (s) => s.status === "REQUIRED" || s.status === "PENDING_REVIEW"
    ).length;

    let eqcrStatus = "Not Required";
    if (ctx.engagement.eqcrRequired) {
      eqcrStatus = ctx.eqcr
        ? (ctx.eqcr.verdict === "APPROVED" ? "Approved" : "In Progress")
        : "Pending";
    }

    const significantRisks = ctx.risks.filter((r) => r.isSignificantRisk);
    const riskIds = new Set(significantRisks.map((r) => r.id));
    const linkedRiskIds = new Set(
      ctx.tests.filter((t) => t.riskId && riskIds.has(t.riskId)).map((t) => t.riskId)
    );
    const significantRisksMissingLink = riskIds.size - linkedRiskIds.size;

    const uncorrected = ctx.misstatements.filter((m) => m.status !== "ADJUSTED");
    const unadjustedTotal = uncorrected.reduce((sum, m) => sum + Number(m.misstatementAmount || 0), 0);
    const performanceMateriality = Number(ctx.materiality?.performanceMateriality || 0);

    return {
      overallScore,
      reportReady,
      redGapCount,
      orangeGapCount,
      amberGapCount,
      pendingSignoffs,
      eqcrStatus,
      significantRisksMissingLink,
      unadjustedVsPM: {
        unadjustedTotal,
        performanceMateriality,
        exceeds: unadjustedTotal > performanceMateriality && performanceMateriality > 0,
      },
    };
  }
}

export const isaPhaseComplianceService = new ISAPhaseComplianceService();
