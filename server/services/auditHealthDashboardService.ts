import { PrismaClient } from "@prisma/client";
import { isaComplianceService } from "./isaComplianceService";

const prisma = new PrismaClient();

export interface HealthScorePanel {
  auditHealthScore: number;
  status: 'GREEN' | 'AMBER' | 'RED';
  auditDefensibility: 'YES' | 'AT_RISK' | 'NO';
  lastScan: Date;
  lockedForReporting: boolean;
  criticalFailures: number;
  totalGaps: number;
}

export interface ISAComplianceRow {
  isa: string;
  area: string;
  status: 'GREEN' | 'AMBER' | 'RED';
  compliancePercent: number;
  keyIssue: string | null;
  gapCount: number;
}

export interface CriticalAlert {
  id: string;
  message: string;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  impactedISA: string;
  requiredAction: string;
  blocking: boolean;
  category: string;
}

export interface DataIntegrityNode {
  stage: string;
  status: 'COMPLETE' | 'PARTIAL' | 'MISSING' | 'ERROR';
  issues: string[];
  lastUpdated: Date | null;
}

export interface AIDiagnostic {
  area: string;
  insight: string;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  suggestedAction: string;
  confidence: number;
}

export interface EvidenceCoverage {
  assertion: string;
  coveragePercent: number;
  evidenceStatus: 'COMPLETE' | 'PARTIAL' | 'MISSING';
  linkedTests: number;
  linkedEvidence: number;
}

export interface MisstatementRow {
  id: string;
  reference: string;
  description: string;
  amount: number;
  status: string;
  fsImpact: boolean;
  materialityPercent: number;
}

export interface QualityControl {
  control: string;
  status: boolean;
  required: boolean;
  isaReference: string;
  blocksReport: boolean;
}

export interface AutoFixItem {
  id: string;
  issue: string;
  isaReference: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  fixDescription: string;
  fixType: 'FIELD' | 'LINKAGE' | 'WORKFLOW' | 'APPROVAL';
  autoFixAvailable: boolean;
  requiresReview: boolean;
}

export interface HealthCertificate {
  eligible: boolean;
  score: number;
  criticalFailures: number;
  allRisksAddressed: boolean;
  eqcrComplete: boolean;
  fileLocked: boolean;
  blockers: string[];
  generatedAt: Date | null;
  verifiedBy: string | null;
}

class AuditHealthDashboardService {

  async getHealthScorePanel(engagementId: string): Promise<HealthScorePanel> {
    const healthCheck = await isaComplianceService.runHealthCheck(engagementId);
    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId },
      select: { status: true }
    });

    let status: 'GREEN' | 'AMBER' | 'RED' = 'GREEN';
    if (healthCheck.overallScore < 75) status = 'RED';
    else if (healthCheck.overallScore < 90) status = 'AMBER';

    let defensibility: 'YES' | 'AT_RISK' | 'NO' = 'YES';
    if (healthCheck.overallStatus === 'NOT_DEFENSIBLE') defensibility = 'NO';
    else if (healthCheck.overallStatus === 'AT_RISK') defensibility = 'AT_RISK';

    return {
      auditHealthScore: healthCheck.overallScore,
      status,
      auditDefensibility: defensibility,
      lastScan: new Date(),
      lockedForReporting: engagement?.status === 'ARCHIVED' || engagement?.status === 'COMPLETED',
      criticalFailures: healthCheck.criticalGaps.filter(g => g.priority === 'CRITICAL').length,
      totalGaps: healthCheck.criticalGaps.length
    };
  }

  async getISAComplianceMatrix(engagementId: string): Promise<ISAComplianceRow[]> {
    const healthCheck = await isaComplianceService.runHealthCheck(engagementId);
    
    return healthCheck.isaScores.map(score => {
      const gaps = healthCheck.criticalGaps.filter(g => g.isaReference.includes(score.isa));
      let status: 'GREEN' | 'AMBER' | 'RED' = 'GREEN';
      if (score.percentage < 60) status = 'RED';
      else if (score.percentage < 85) status = 'AMBER';

      return {
        isa: score.isa,
        area: score.area,
        status,
        compliancePercent: score.percentage,
        keyIssue: gaps.length > 0 ? gaps[0].issue : null,
        gapCount: gaps.length
      };
    });
  }

  async getCriticalAlerts(engagementId: string): Promise<CriticalAlert[]> {
    const alerts: CriticalAlert[] = [];

    const [
      fsLines,
      riskAssessments,
      substantiveTests,
      misstatements,
      eqcr,
      auditReport
    ] = await Promise.all([
      prisma.fSLine.findMany({
        where: { engagementId },
      }).then(lines => lines.map((l: any) => ({ ...l, tbMappings: [] }))).catch(() => []),
      prisma.riskAssessment.findMany({ where: { engagementId } }),
      prisma.substantiveTest.findMany({ 
        where: { engagementId }
      }),
      prisma.misstatement.findMany({ where: { engagementId } }),
      prisma.eQCRAssignment.findFirst({ where: { engagementId } }),
      prisma.auditReport.findFirst({ where: { engagementId } })
    ]);

    const unmappedFS = fsLines.filter(fs => fs.tbMappings.length === 0);
    if (unmappedFS.length > 0) {
      alerts.push({
        id: `alert-fs-unmapped`,
        message: `${unmappedFS.length} FS line item(s) without TB linkage`,
        riskLevel: 'HIGH',
        impactedISA: 'ISA 700',
        requiredAction: 'Map all FS lines to Trial Balance accounts',
        blocking: true,
        category: 'DATA_INTEGRITY'
      });
    }

    const highRisks = riskAssessments.filter(r => 
      r.inherentRisk === 'HIGH' || r.controlRisk === 'HIGH'
    );
    const testsWithRisk = substantiveTests.filter(t => t.riskId);
    const unaddressedRisks = highRisks.filter(r => 
      !testsWithRisk.some(t => t.riskId === r.id)
    );
    if (unaddressedRisks.length > 0) {
      alerts.push({
        id: `alert-risk-unaddressed`,
        message: `${unaddressedRisks.length} significant RoMM without substantive procedures`,
        riskLevel: 'HIGH',
        impactedISA: 'ISA 330',
        requiredAction: 'Link substantive tests to all significant risks',
        blocking: true,
        category: 'RISK_RESPONSE'
      });
    }

    const incompleteTests = substantiveTests.filter(t => 
      t.reviewedById === null && t.managerApprovedById === null && t.partnerApprovedById === null
    );
    if (incompleteTests.length > 0) {
      alerts.push({
        id: `alert-tests-incomplete`,
        message: `${incompleteTests.length} substantive test(s) not concluded`,
        riskLevel: 'MEDIUM',
        impactedISA: 'ISA 330',
        requiredAction: 'Complete and document conclusions for all tests',
        blocking: incompleteTests.length > 3,
        category: 'EXECUTION'
      });
    }

    const unresolvedMisstatements = misstatements.filter(m => 
      m.status !== 'RESOLVED' && m.status !== 'WAIVED'
    );
    if (unresolvedMisstatements.length > 0) {
      alerts.push({
        id: `alert-misstatements`,
        message: `${unresolvedMisstatements.length} misstatement(s) not resolved or reflected in FS`,
        riskLevel: 'HIGH',
        impactedISA: 'ISA 450',
        requiredAction: 'Evaluate and resolve all identified misstatements',
        blocking: true,
        category: 'MISSTATEMENTS'
      });
    }

    if (auditReport && !eqcr?.completedAt) {
      const engagement = await prisma.engagement.findUnique({
        where: { id: engagementId },
        select: { entityType: true }
      });
      if (engagement?.entityType === 'Listed') {
        alerts.push({
          id: `alert-eqcr-missing`,
          message: 'EQCR not signed but audit report drafted (Listed Entity)',
          riskLevel: 'HIGH',
          impactedISA: 'ISQM-1',
          requiredAction: 'Complete EQCR review before report issuance',
          blocking: true,
          category: 'QUALITY_CONTROL'
        });
      }
    }

    const testsWithoutEvidence = substantiveTests.filter(t => (t.evidenceLinks?.length || 0) === 0);
    if (testsWithoutEvidence.length > 0) {
      alerts.push({
        id: `alert-evidence-missing`,
        message: `${testsWithoutEvidence.length} test(s) without supporting evidence`,
        riskLevel: 'MEDIUM',
        impactedISA: 'ISA 500',
        requiredAction: 'Attach audit evidence to all substantive tests',
        blocking: false,
        category: 'EVIDENCE'
      });
    }

    return alerts.sort((a, b) => {
      const priority = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return priority[a.riskLevel] - priority[b.riskLevel];
    });
  }

  async getDataIntegrityFlow(engagementId: string): Promise<DataIntegrityNode[]> {
    const [gl, tb, fs] = await Promise.all([
      prisma.gLBatch.findFirst({ 
        where: { engagementId },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.trialBalance.findFirst({ 
        where: { engagementId },
        include: { lineItems: true }
      }),
      prisma.fSHead.findFirst({ 
        where: { engagementId }
      }).catch(() => null)
    ]);

    const nodes: DataIntegrityNode[] = [];

    nodes.push({
      stage: 'GL',
      status: gl ? (gl.status === 'APPROVED' ? 'COMPLETE' : 'PARTIAL') : 'MISSING',
      issues: gl ? [] : ['No GL data uploaded'],
      lastUpdated: gl?.createdAt || null
    });

    if (tb) {
      const tbLines = (tb as any).lineItems || [];
      const unmappedLines = tbLines.filter((l: any) => !l.fsLineItemId);
      nodes.push({
        stage: 'TB',
        status: unmappedLines.length === 0 ? 'COMPLETE' : 'PARTIAL',
        issues: unmappedLines.length > 0 ? [`${unmappedLines.length} unmapped TB lines`] : [],
        lastUpdated: tb.updatedAt
      });
    } else {
      nodes.push({
        stage: 'TB',
        status: 'MISSING',
        issues: ['No Trial Balance generated'],
        lastUpdated: null
      });
    }

    if (fs) {
      const fsHeads = await prisma.fSHead.findMany({ where: { engagementId } });
      const hasIS = fsHeads.some((h: any) => h.statementType === 'INCOME_STATEMENT' || h.category === 'INCOME');
      const hasBS = fsHeads.some((h: any) => h.statementType === 'BALANCE_SHEET' || h.category === 'BALANCE');

      nodes.push({
        stage: 'IS',
        status: hasIS ? 'COMPLETE' : 'MISSING',
        issues: hasIS ? [] : ['Income Statement not generated'],
        lastUpdated: (fs as any).updatedAt || null
      });

      nodes.push({
        stage: 'BS',
        status: hasBS ? 'COMPLETE' : 'MISSING',
        issues: hasBS ? [] : ['Balance Sheet not generated'],
        lastUpdated: (fs as any).updatedAt || null
      });

      const hasNotes = fsHeads.some((h: any) => h.statementType === 'NOTES');
      nodes.push({
        stage: 'Notes',
        status: hasNotes ? 'COMPLETE' : 'MISSING',
        issues: hasNotes ? [] : ['Notes to FS not generated'],
        lastUpdated: (fs as any).updatedAt || null
      });
    } else {
      nodes.push(
        { stage: 'IS', status: 'MISSING', issues: ['No Financial Statements'], lastUpdated: null },
        { stage: 'BS', status: 'MISSING', issues: ['No Financial Statements'], lastUpdated: null },
        { stage: 'Notes', status: 'MISSING', issues: ['No Notes to FS'], lastUpdated: null }
      );
    }

    return nodes;
  }

  async getAIDiagnostics(engagementId: string): Promise<AIDiagnostic[]> {
    const diagnostics: AIDiagnostic[] = [];

    const [riskAssessments, substantiveTests, tb] = await Promise.all([
      prisma.riskAssessment.findMany({ where: { engagementId } }),
      prisma.substantiveTest.findMany({ 
        where: { engagementId }
      }),
      prisma.trialBalance.findFirst({
        where: { engagementId },
        include: { lineItems: true }
      })
    ]);

    const highRiskAreas = riskAssessments.filter(r => 
      r.inherentRisk === 'HIGH' || r.combinedRisk === 'HIGH'
    );

    for (const risk of highRiskAreas.slice(0, 5)) {
      const relatedTests = substantiveTests.filter(t => t.riskId === risk.id);
      const evidenceCount = relatedTests.reduce((sum, t) => sum + (t.evidenceLinks?.length || 0), 0);

      diagnostics.push({
        area: risk.assertion || risk.fsCaption || 'Unknown Area',
        insight: `High risk area with ${relatedTests.length} test(s) and ${evidenceCount} evidence file(s)`,
        riskLevel: evidenceCount < 3 ? 'HIGH' : 'MEDIUM',
        suggestedAction: evidenceCount < 3 
          ? 'Expand sample size and gather additional corroborating evidence'
          : 'Review evidence sufficiency and document conclusions',
        confidence: 0.85
      });
    }

    const lowRiskAreas = riskAssessments.filter(r => 
      r.inherentRisk === 'LOW' && r.controlRisk === 'LOW'
    );
    if (lowRiskAreas.length > 0) {
      diagnostics.push({
        area: 'Low Risk Areas',
        insight: `${lowRiskAreas.length} area(s) assessed as low risk`,
        riskLevel: 'LOW',
        suggestedAction: 'Analytical procedures may be sufficient for low-risk areas',
        confidence: 0.90
      });
    }

    const tbAny = tb as any;
    if (tbAny?.lineItems) {
      const receivables = tbAny.lineItems.filter((l: any) => 
        l.accountName?.toLowerCase().includes('receivable') ||
        l.accountName?.toLowerCase().includes('debtors')
      );
      const oldBalances = receivables.filter((l: any) => Number(l.openingBalance) > 0);
      if (oldBalances.length > 0) {
        diagnostics.push({
          area: 'Receivables',
          insight: `${oldBalances.length} receivable account(s) with opening balances`,
          riskLevel: 'MEDIUM',
          suggestedAction: 'Consider external confirmations for significant balances',
          confidence: 0.80
        });
      }
    }

    return diagnostics;
  }

  async getEvidenceCoverage(engagementId: string): Promise<EvidenceCoverage[]> {
    const assertions = ['Existence', 'Completeness', 'Valuation', 'Rights', 'Presentation', 'Occurrence', 'Accuracy', 'Cut-off'];
    
    const [riskAssessments, substantiveTests] = await Promise.all([
      prisma.riskAssessment.findMany({ where: { engagementId } }),
      prisma.substantiveTest.findMany({ 
        where: { engagementId }
      })
    ]);

    return assertions.map(assertion => {
      const relevantRisks = riskAssessments.filter(r => 
        r.assertion?.toUpperCase().includes(assertion.toUpperCase())
      );
      const relevantTests = substantiveTests.filter(t => {
        return t.testObjective?.toUpperCase().includes(assertion.toUpperCase()) ||
          t.assertion?.toUpperCase().includes(assertion.toUpperCase()) ||
          relevantRisks.some(r => r.id === t.riskId);
      });
      const evidenceCount = relevantTests.reduce((sum, t) => sum + (t.evidenceLinks?.length || 0), 0);

      let coverage = 0;
      if (relevantTests.length > 0) {
        const completedTests = relevantTests.filter(t => 
          t.reviewedById !== null || t.managerApprovedById !== null || t.partnerApprovedById !== null
        );
        coverage = Math.round((completedTests.length / relevantTests.length) * 100);
      }

      return {
        assertion,
        coveragePercent: coverage,
        evidenceStatus: coverage >= 90 ? 'COMPLETE' : coverage >= 50 ? 'PARTIAL' : 'MISSING',
        linkedTests: relevantTests.length,
        linkedEvidence: evidenceCount
      };
    });
  }

  async getMisstatementTracker(engagementId: string): Promise<{ rows: MisstatementRow[], summary: any }> {
    const [misstatements, materiality] = await Promise.all([
      prisma.misstatement.findMany({ where: { engagementId } }),
      prisma.materialityCalculation.findFirst({ 
        where: { engagementId },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    const pm = Number(materiality?.performanceMateriality || 0);

    const rows: MisstatementRow[] = misstatements.map((m, idx) => ({
      id: m.id,
      reference: `ADJ-${String(idx + 1).padStart(2, '0')}`,
      description: m.description || 'Misstatement',
      amount: Number(m.misstatementAmount || 0),
      status: m.status,
      fsImpact: (m.status as string) === 'RESOLVED',
      materialityPercent: pm > 0 ? Math.round((Number(m.misstatementAmount || 0) / pm) * 100) : 0
    }));

    const totalMisstatements = rows.reduce((sum, r) => sum + r.amount, 0);
    const unresolvedTotal = rows
      .filter(r => r.status !== 'RESOLVED')
      .reduce((sum, r) => sum + r.amount, 0);

    return {
      rows,
      summary: {
        totalCount: rows.length,
        totalAmount: totalMisstatements,
        unresolvedAmount: unresolvedTotal,
        performanceMateriality: pm,
        percentOfPM: pm > 0 ? Math.round((unresolvedTotal / pm) * 100) : 0,
        opinionImpact: unresolvedTotal > pm ? 'MATERIAL' : 'NOT_MATERIAL'
      }
    };
  }

  async getQualityControls(engagementId: string): Promise<QualityControl[]> {
    const [
      engagement,
      independence,
      eqcr,
      signOffs,
      completionChecklist
    ] = await Promise.all([
      prisma.engagement.findUnique({ 
        where: { id: engagementId },
        include: { client: true }
      }),
      prisma.independenceDeclaration.findFirst({ where: { engagementId } }),
      prisma.eQCRAssignment.findFirst({ where: { engagementId } }),
      prisma.signOffRegister.findMany({ where: { engagementId } }),
      prisma.complianceChecklist.findFirst({ where: { engagementId } })
    ]);

    const partnerSignOff = signOffs.find(s => 
      (s as any).signOffType === 'PARTNER_SIGN_OFF'
    );

    const isListed = engagement?.entityType === 'Listed';
    const eqcrRequired = isListed;

    return [
      {
        control: 'Engagement Acceptance',
        status: !!engagement?.client,
        required: true,
        isaReference: 'ISQM-1.30',
        blocksReport: true
      },
      {
        control: 'Independence Declaration',
        status: !!independence?.declarationDate,
        required: true,
        isaReference: 'ISQM-1.21',
        blocksReport: true
      },
      {
        control: 'EQCR Required',
        status: eqcrRequired,
        required: false,
        isaReference: 'ISQM-1.34',
        blocksReport: false
      },
      {
        control: 'EQCR Completed',
        status: !!eqcr?.completedAt,
        required: eqcrRequired,
        isaReference: 'ISQM-1.34',
        blocksReport: eqcrRequired
      },
      {
        control: 'Partner Sign-Off',
        status: !!partnerSignOff,
        required: true,
        isaReference: 'ISA 220.40',
        blocksReport: true
      },
      {
        control: 'File Lock',
        status: engagement?.status === 'ARCHIVED' || engagement?.status === 'COMPLETED',
        required: true,
        isaReference: 'ISA 230.14',
        blocksReport: true
      },
      {
        control: 'Completion Checklist',
        status: !!completionChecklist,
        required: true,
        isaReference: 'ISA 220.39',
        blocksReport: false
      }
    ];
  }

  async getAutoFixItems(engagementId: string): Promise<AutoFixItem[]> {
    const healthCheck = await isaComplianceService.runHealthCheck(engagementId);
    
    return healthCheck.criticalGaps.map((gap, idx) => ({
      id: `fix-${idx + 1}`,
      issue: gap.issue,
      isaReference: gap.isaReference,
      severity: gap.priority as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
      fixDescription: gap.fix,
      fixType: this.determineFixType(gap.fix),
      autoFixAvailable: this.canAutoFix(gap.fix),
      requiresReview: gap.priority === 'CRITICAL' || gap.priority === 'HIGH'
    }));
  }

  private determineFixType(fix: string): 'FIELD' | 'LINKAGE' | 'WORKFLOW' | 'APPROVAL' {
    const lower = fix.toLowerCase();
    if (lower.includes('link') || lower.includes('map') || lower.includes('connect')) return 'LINKAGE';
    if (lower.includes('approv') || lower.includes('sign') || lower.includes('review')) return 'APPROVAL';
    if (lower.includes('complete') || lower.includes('generate') || lower.includes('create')) return 'WORKFLOW';
    return 'FIELD';
  }

  private canAutoFix(fix: string): boolean {
    const lower = fix.toLowerCase();
    return lower.includes('generate') || lower.includes('calculate') || lower.includes('create');
  }

  async getHealthCertificate(engagementId: string): Promise<HealthCertificate> {
    const [healthScore, qualityControls, alerts] = await Promise.all([
      this.getHealthScorePanel(engagementId),
      this.getQualityControls(engagementId),
      this.getCriticalAlerts(engagementId)
    ]);

    const blockers: string[] = [];

    if (healthScore.auditHealthScore < 90) {
      blockers.push(`Health score ${healthScore.auditHealthScore}% below 90% threshold`);
    }

    if (healthScore.criticalFailures > 0) {
      blockers.push(`${healthScore.criticalFailures} critical ISA failure(s)`);
    }

    const blockingAlerts = alerts.filter(a => a.blocking);
    if (blockingAlerts.length > 0) {
      blockers.push(`${blockingAlerts.length} blocking alert(s) unresolved`);
    }

    const requiredControls = qualityControls.filter(c => c.required && c.blocksReport);
    const missingControls = requiredControls.filter(c => !c.status);
    if (missingControls.length > 0) {
      missingControls.forEach(c => blockers.push(`${c.control} not completed`));
    }

    const eqcrControl = qualityControls.find(c => c.control === 'EQCR Completed');
    const fileLockControl = qualityControls.find(c => c.control === 'File Lock');

    return {
      eligible: blockers.length === 0,
      score: healthScore.auditHealthScore,
      criticalFailures: healthScore.criticalFailures,
      allRisksAddressed: alerts.filter(a => a.category === 'RISK_RESPONSE' && a.blocking).length === 0,
      eqcrComplete: eqcrControl?.status || !eqcrControl?.required || false,
      fileLocked: fileLockControl?.status || false,
      blockers,
      generatedAt: blockers.length === 0 ? new Date() : null,
      verifiedBy: null
    };
  }

  async getFullDashboard(engagementId: string) {
    const [
      healthScore,
      isaMatrix,
      criticalAlerts,
      dataIntegrity,
      aiDiagnostics,
      evidenceCoverage,
      misstatements,
      qualityControls,
      autoFixes,
      healthCertificate
    ] = await Promise.all([
      this.getHealthScorePanel(engagementId),
      this.getISAComplianceMatrix(engagementId),
      this.getCriticalAlerts(engagementId),
      this.getDataIntegrityFlow(engagementId),
      this.getAIDiagnostics(engagementId),
      this.getEvidenceCoverage(engagementId),
      this.getMisstatementTracker(engagementId),
      this.getQualityControls(engagementId),
      this.getAutoFixItems(engagementId),
      this.getHealthCertificate(engagementId)
    ]);

    return {
      healthScore,
      isaMatrix,
      criticalAlerts,
      dataIntegrity,
      aiDiagnostics,
      evidenceCoverage,
      misstatements,
      qualityControls,
      autoFixes,
      healthCertificate,
      generatedAt: new Date()
    };
  }
}

export const auditHealthDashboardService = new AuditHealthDashboardService();
