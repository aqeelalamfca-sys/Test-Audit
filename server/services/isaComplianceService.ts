import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface ComplianceScore {
  isa: string;
  area: string;
  score: number;
  maxScore: number;
  percentage: number;
  status: 'COMPLIANT' | 'PARTIAL' | 'GAP' | 'CRITICAL';
  gaps: ComplianceGap[];
}

interface ComplianceGap {
  issue: string;
  impact: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  fix: string;
  isaReference: string;
}

interface HealthCheckResult {
  engagementId: string;
  overallScore: number;
  overallStatus: 'AUDIT_DEFENSIBLE' | 'AT_RISK' | 'NOT_DEFENSIBLE';
  isaScores: ComplianceScore[];
  criticalGaps: ComplianceGap[];
  autoFixesApplied: string[];
  recommendations: string[];
  timestamp: Date;
}

export class ISAComplianceService {

  async runHealthCheck(engagementId: string): Promise<HealthCheckResult> {
    const isaScores: ComplianceScore[] = [];
    const criticalGaps: ComplianceGap[] = [];
    const autoFixesApplied: string[] = [];

    const [
      isa230Score,
      isa220Score,
      isa300Score,
      isa315Score,
      isa320Score,
      isa330Score,
      isa450Score,
      isa500Score,
      isa530Score,
      isa560Score,
      isa570Score,
      isa700Score,
      isqm1Score
    ] = await Promise.all([
      this.checkISA230(engagementId),
      this.checkISA220(engagementId),
      this.checkISA300(engagementId),
      this.checkISA315(engagementId),
      this.checkISA320(engagementId),
      this.checkISA330(engagementId),
      this.checkISA450(engagementId),
      this.checkISA500(engagementId),
      this.checkISA530(engagementId),
      this.checkISA560(engagementId),
      this.checkISA570(engagementId),
      this.checkISA700(engagementId),
      this.checkISQM1(engagementId)
    ]);

    isaScores.push(
      isa230Score, isa220Score, isa300Score, isa315Score,
      isa320Score, isa330Score, isa450Score, isa500Score,
      isa530Score, isa560Score, isa570Score, isa700Score, isqm1Score
    );

    isaScores.forEach(score => {
      score.gaps.filter(g => g.priority === 'CRITICAL').forEach(g => criticalGaps.push(g));
    });

    const isaWeights: Record<string, number> = {
      'ISA 230': 1.5,
      'ISA 220': 1.2,
      'ISA 300': 1.0,
      'ISA 315': 1.3,
      'ISA 320': 1.2,
      'ISA 330': 1.4,
      'ISA 450': 1.3,
      'ISA 500': 1.4,
      'ISA 530': 1.0,
      'ISA 560': 1.1,
      'ISA 570': 1.2,
      'ISA 700-706': 1.3,
      'ISQM-1': 1.5
    };

    let weightedScore = 0;
    let totalWeight = 0;
    for (const score of isaScores) {
      const weight = isaWeights[score.isa] || 1.0;
      weightedScore += score.percentage * weight;
      totalWeight += weight;
    }
    const overallScore = Math.round(weightedScore / totalWeight);

    let overallStatus: 'AUDIT_DEFENSIBLE' | 'AT_RISK' | 'NOT_DEFENSIBLE';
    if (overallScore >= 90 && criticalGaps.length === 0) {
      overallStatus = 'AUDIT_DEFENSIBLE';
    } else if (overallScore >= 70) {
      overallStatus = 'AT_RISK';
    } else {
      overallStatus = 'NOT_DEFENSIBLE';
    }

    return {
      engagementId,
      overallScore,
      overallStatus,
      isaScores,
      criticalGaps,
      autoFixesApplied,
      recommendations: this.generateRecommendations(isaScores),
      timestamp: new Date()
    };
  }

  private async checkISA230(engagementId: string): Promise<ComplianceScore> {
    const gaps: ComplianceGap[] = [];
    let score = 0;
    const maxScore = 10;

    const [auditTrailCount, phaseProgress, signOffs] = await Promise.all([
      prisma.auditTrail.count({ where: { engagementId } }),
      prisma.phaseProgress.findMany({ where: { engagementId } }),
      prisma.signOffRegister.count({ where: { engagementId } })
    ]);

    if (auditTrailCount > 0) score += 3;
    else gaps.push({
      issue: 'No audit trail entries',
      impact: 'Cannot demonstrate work performed',
      priority: 'CRITICAL',
      fix: 'Enable audit logging for all actions',
      isaReference: 'ISA 230.8'
    });

    if (phaseProgress.length > 0) score += 2;
    
    const lockedPhases = phaseProgress.filter((p: any) => p.status === 'LOCKED' || p.status === 'COMPLETED');
    if (lockedPhases.length > 0) score += 2;
    else gaps.push({
      issue: 'No phases locked after completion',
      impact: 'Documentation can be modified after the fact',
      priority: 'HIGH',
      fix: 'Enforce phase locking upon completion',
      isaReference: 'ISA 230.14'
    });

    if (signOffs > 0) score += 3;
    else gaps.push({
      issue: 'No sign-offs recorded',
      impact: 'No evidence of review and approval',
      priority: 'HIGH',
      fix: 'Implement maker-checker sign-off workflow',
      isaReference: 'ISA 230.9'
    });

    return this.createScore('ISA 230', 'Audit Documentation', score, maxScore, gaps);
  }

  private async checkISA220(engagementId: string): Promise<ComplianceScore> {
    const gaps: ComplianceGap[] = [];
    let score = 0;
    const maxScore = 10;

    const [engagement, eqcr, independenceDeclarations] = await Promise.all([
      prisma.engagement.findUnique({ where: { id: engagementId } }),
      prisma.eQCRAssignment.findUnique({ where: { engagementId } }),
      prisma.independenceDeclaration.count({ where: { engagementId, status: 'CONFIRMED' } })
    ]);

    if (engagement?.engagementPartnerId) score += 2;
    else gaps.push({
      issue: 'No engagement partner assigned',
      impact: 'Leadership responsibility unclear',
      priority: 'CRITICAL',
      fix: 'Assign engagement partner',
      isaReference: 'ISA 220.11'
    });

    if (independenceDeclarations > 0) score += 3;
    else gaps.push({
      issue: 'No independence confirmations',
      impact: 'Independence requirement not documented',
      priority: 'HIGH',
      fix: 'Collect independence declarations from all team members',
      isaReference: 'ISA 220.15'
    });

    if ((engagement as any)?.engagementType === 'STATUTORY_AUDIT' && (engagement as any)?.listedEntity) {
      if (eqcr) score += 3;
      else gaps.push({
        issue: 'Listed entity without EQCR',
        impact: 'ISQM-1 violation for PIE',
        priority: 'CRITICAL',
        fix: 'Initiate EQCR process',
        isaReference: 'ISA 220.25'
      });
    } else {
      score += 3;
    }

    const signOffs = await prisma.signOffRegister.count({
      where: { engagementId, signOffType: 'FINALIZATION_APPROVAL' }
    });
    if (signOffs > 0) score += 2;

    return this.createScore('ISA 220', 'Quality Control', score, maxScore, gaps);
  }

  private async checkISA300(engagementId: string): Promise<ComplianceScore> {
    const gaps: ComplianceGap[] = [];
    let score = 0;
    const maxScore = 10;

    const [auditStrategy, riskAssessments, teamAllocation] = await Promise.all([
      prisma.auditStrategy.findUnique({ where: { engagementId } }),
      prisma.riskAssessment.count({ where: { engagementId } }),
      prisma.engagement.findUnique({
        where: { id: engagementId },
        select: { engagementPartnerId: true }
      })
    ]);

    if (auditStrategy) {
      score += 4;
      if (auditStrategy.partnerApprovedById) score += 2;
      else gaps.push({
        issue: 'Audit strategy not partner-approved',
        impact: 'Strategy may be inappropriate',
        priority: 'HIGH',
        fix: 'Obtain partner approval for audit strategy',
        isaReference: 'ISA 300.11'
      });
    } else {
      gaps.push({
        issue: 'No audit strategy documented',
        impact: 'Planning not formalized',
        priority: 'CRITICAL',
        fix: 'Create audit strategy document',
        isaReference: 'ISA 300.7'
      });
    }

    if (riskAssessments > 0) score += 2;

    if (teamAllocation?.engagementPartnerId) score += 2;
    else gaps.push({
      issue: 'Incomplete team allocation',
      impact: 'Resources not properly assigned',
      priority: 'MEDIUM',
      fix: 'Complete team allocation',
      isaReference: 'ISA 300.A11'
    });

    return this.createScore('ISA 300', 'Planning', score, maxScore, gaps);
  }

  private async checkISA315(engagementId: string): Promise<ComplianceScore> {
    const gaps: ComplianceGap[] = [];
    let score = 0;
    const maxScore = 10;

    const risks = await prisma.riskAssessment.findMany({ where: { engagementId } });

    if (risks.length > 0) {
      score += 3;
      
      const significantRisks = risks.filter(r => r.isSignificantRisk);
      if (significantRisks.length > 0) score += 2;

      const fraudRisks = risks.filter(r => r.isFraudRisk);
      if (fraudRisks.length > 0) score += 2;
      else gaps.push({
        issue: 'No fraud risks identified (ISA 240 presumed risks)',
        impact: 'Fraud response procedures may be inadequate',
        priority: 'CRITICAL',
        fix: 'Document presumed fraud risks per ISA 240.26',
        isaReference: 'ISA 315.26'
      });

      const risksWithAssertions = risks.filter(r => r.assertion);
      if (risksWithAssertions.length === risks.length) score += 3;
      else gaps.push({
        issue: `${risks.length - risksWithAssertions.length} risks without assertion mapping`,
        impact: 'Response procedures cannot be targeted',
        priority: 'HIGH',
        fix: 'Map all risks to relevant assertions',
        isaReference: 'ISA 315.25'
      });
    } else {
      gaps.push({
        issue: 'No risk assessments documented',
        impact: 'RoMM not identified',
        priority: 'CRITICAL',
        fix: 'Perform risk assessment procedures',
        isaReference: 'ISA 315.5'
      });
    }

    return this.createScore('ISA 315', 'Risk Identification', score, maxScore, gaps);
  }

  private async checkISA320(engagementId: string): Promise<ComplianceScore> {
    const gaps: ComplianceGap[] = [];
    let score = 0;
    const maxScore = 10;

    const materiality = await prisma.materialityCalculation.findFirst({
      where: { engagementId, status: 'APPROVED' }
    });

    if (materiality) {
      score += 4;
      
      if (materiality.overallMateriality) score += 2;
      else gaps.push({
        issue: 'Overall materiality not set',
        impact: 'Cannot determine significant misstatements',
        priority: 'CRITICAL',
        fix: 'Calculate overall materiality',
        isaReference: 'ISA 320.10'
      });

      if (materiality.performanceMateriality) score += 2;
      else gaps.push({
        issue: 'Performance materiality not set',
        impact: 'Testing extent cannot be determined',
        priority: 'CRITICAL',
        fix: 'Set performance materiality (50-75% of OM)',
        isaReference: 'ISA 320.11'
      });

      if (materiality.trivialThreshold) score += 1;

      if (materiality.approvedById) score += 1;
      else gaps.push({
        issue: 'Materiality not partner-approved',
        impact: 'Judgment not validated',
        priority: 'HIGH',
        fix: 'Obtain partner approval',
        isaReference: 'ISA 320.A3'
      });
    } else {
      gaps.push({
        issue: 'No approved materiality calculation',
        impact: 'Audit scope undefined',
        priority: 'CRITICAL',
        fix: 'Calculate and approve materiality',
        isaReference: 'ISA 320.10'
      });
    }

    return this.createScore('ISA 320', 'Materiality', score, maxScore, gaps);
  }

  private async checkISA330(engagementId: string): Promise<ComplianceScore> {
    const gaps: ComplianceGap[] = [];
    let score = 0;
    const maxScore = 10;

    const [risks, tests] = await Promise.all([
      prisma.riskAssessment.findMany({ where: { engagementId } }),
      prisma.substantiveTest.findMany({ where: { engagementId } })
    ]);

    if (tests.length > 0) {
      score += 3;
      
      const testsLinkedToRisks = tests.filter(t => t.riskId);
      if (testsLinkedToRisks.length > 0) score += 2;
      
      if (risks.length > 0) {
        const riskIds = risks.map(r => r.id);
        const coveredRisks = new Set(testsLinkedToRisks.map(t => t.riskId));
        const uncoveredRisks = riskIds.filter(id => !coveredRisks.has(id));
        
        if (uncoveredRisks.length === 0) score += 3;
        else gaps.push({
          issue: `${uncoveredRisks.length} risks without responsive procedures`,
          impact: 'RoMM not addressed',
          priority: 'CRITICAL',
          fix: 'Create substantive tests for all identified risks',
          isaReference: 'ISA 330.6'
        });
      }

      const testsWithConclusions = tests.filter(t => t.conclusion);
      if (testsWithConclusions.length === tests.length) score += 2;
      else gaps.push({
        issue: `${tests.length - testsWithConclusions.length} tests without conclusions`,
        impact: 'Test results not evaluated',
        priority: 'HIGH',
        fix: 'Document conclusions for all tests',
        isaReference: 'ISA 330.28'
      });
    } else {
      gaps.push({
        issue: 'No substantive tests performed',
        impact: 'Insufficient audit evidence',
        priority: 'CRITICAL',
        fix: 'Design and perform substantive procedures',
        isaReference: 'ISA 330.18'
      });
    }

    return this.createScore('ISA 330', 'Risk Response', score, maxScore, gaps);
  }

  private async checkISA450(engagementId: string): Promise<ComplianceScore> {
    const gaps: ComplianceGap[] = [];
    let score = 0;
    const maxScore = 10;

    const [misstatements, materiality] = await Promise.all([
      prisma.misstatement.findMany({ where: { engagementId } }),
      prisma.materialityCalculation.findFirst({ where: { engagementId, status: 'APPROVED' } })
    ]);

    score += 2;

    if (misstatements.length > 0) {
      const evaluated = misstatements.filter(m => m.isAboveTrivialThreshold !== null);
      if (evaluated.length === misstatements.length) score += 3;
      else gaps.push({
        issue: `${misstatements.length - evaluated.length} misstatements not evaluated against materiality`,
        impact: 'Cannot determine significance',
        priority: 'HIGH',
        fix: 'Evaluate all misstatements against materiality thresholds',
        isaReference: 'ISA 450.5'
      });

      const corrected = misstatements.filter(m => m.status === 'ADJUSTED');
      const uncorrected = misstatements.filter(m => m.status !== 'ADJUSTED');
      
      if (uncorrected.length > 0 && materiality) {
        const totalUncorrected = uncorrected.reduce((sum, m) => sum + Number(m.misstatementAmount || 0), 0);
        if (totalUncorrected > Number(materiality.performanceMateriality || 0)) {
          gaps.push({
            issue: `Uncorrected misstatements (${totalUncorrected.toLocaleString()}) exceed PM`,
            impact: 'May affect opinion',
            priority: 'CRITICAL',
            fix: 'Evaluate impact on opinion or request correction',
            isaReference: 'ISA 450.11'
          });
        } else {
          score += 3;
        }
      } else {
        score += 3;
      }

      score += 2;
    } else {
      score += 8;
    }

    return this.createScore('ISA 450', 'Misstatement Evaluation', score, maxScore, gaps);
  }

  private async checkISA500(engagementId: string): Promise<ComplianceScore> {
    const gaps: ComplianceGap[] = [];
    let score = 0;
    const maxScore = 10;

    const evidence = await prisma.evidenceFile.findMany({ where: { engagementId } });

    if (evidence.length > 0) {
      score += 3;

      const withSufficiency = evidence.filter(e => e.sufficiencyRating);
      if (withSufficiency.length === evidence.length) score += 2;
      else if (withSufficiency.length > evidence.length * 0.5) score += 1;
      else gaps.push({
        issue: `${evidence.length - withSufficiency.length} evidence files without sufficiency rating`,
        impact: 'Evidence adequacy not assessed',
        priority: 'MEDIUM',
        fix: 'Rate sufficiency of all evidence',
        isaReference: 'ISA 500.6'
      });

      const withReliability = evidence.filter((e: any) => e.reliabilityRating);
      if (withReliability.length === evidence.length) score += 2;
      else gaps.push({
        issue: `${evidence.length - withReliability.length} evidence files without reliability rating`,
        impact: 'Evidence quality not assessed',
        priority: 'MEDIUM',
        fix: 'Rate reliability of all evidence per ISA 500.A31',
        isaReference: 'ISA 500.A31'
      });

      const linkedToTests = evidence.filter(e => e.procedureIds.length > 0);
      if (linkedToTests.length > evidence.length * 0.8) score += 2;
      else gaps.push({
        issue: `${evidence.length - linkedToTests.length} evidence files not linked to procedures`,
        impact: 'Traceability incomplete',
        priority: 'HIGH',
        fix: 'Link all evidence to audit procedures',
        isaReference: 'ISA 500.6'
      });

      score += 1;
    } else {
      gaps.push({
        issue: 'No audit evidence uploaded',
        impact: 'No basis for conclusions',
        priority: 'CRITICAL',
        fix: 'Collect and document audit evidence',
        isaReference: 'ISA 500.6'
      });
    }

    return this.createScore('ISA 500', 'Audit Evidence', score, maxScore, gaps);
  }

  private async checkISA530(engagementId: string): Promise<ComplianceScore> {
    const gaps: ComplianceGap[] = [];
    let score = 0;
    const maxScore = 10;

    const tests = await prisma.substantiveTest.findMany({ where: { engagementId } });
    const sampledTests = tests.filter(t => t.sampleSize && t.sampleSize > 0);

    if (sampledTests.length > 0) {
      score += 2;

      const withPopulation = sampledTests.filter(t => t.populationValue || t.populationCount);
      if (withPopulation.length === sampledTests.length) score += 2;
      else gaps.push({
        issue: `${sampledTests.length - withPopulation.length} samples without population defined`,
        impact: 'Sample representativeness unknown',
        priority: 'CRITICAL',
        fix: 'Document population for all samples',
        isaReference: 'ISA 530.6'
      });

      const withMethod = sampledTests.filter(t => t.samplingMethod);
      if (withMethod.length === sampledTests.length) score += 2;
      else gaps.push({
        issue: `${sampledTests.length - withMethod.length} samples without method specified`,
        impact: 'Selection approach not documented',
        priority: 'HIGH',
        fix: 'Specify sampling method (Statistical/Non-statistical)',
        isaReference: 'ISA 530.7'
      });

      const withRationale = sampledTests.filter(t => t.samplingRationale);
      if (withRationale.length === sampledTests.length) score += 2;
      else gaps.push({
        issue: `${sampledTests.length - withRationale.length} samples without size rationale`,
        impact: 'Sample size justification missing',
        priority: 'HIGH',
        fix: 'Document rationale for sample size determination',
        isaReference: 'ISA 530.A11'
      });

      const withExceptions = sampledTests.filter(t => t.exceptionsFound !== null);
      if (withExceptions.length === sampledTests.length) score += 2;
      else gaps.push({
        issue: 'Exception tracking incomplete',
        impact: 'Cannot project to population',
        priority: 'MEDIUM',
        fix: 'Track exceptions for all samples',
        isaReference: 'ISA 530.12'
      });
    } else {
      gaps.push({
        issue: 'No sampling documented for substantive tests',
        impact: 'Testing extent not justified',
        priority: 'HIGH',
        fix: 'Document sampling approach for all tests',
        isaReference: 'ISA 530.6'
      });
      score += 4;
    }

    return this.createScore('ISA 530', 'Sampling', score, maxScore, gaps);
  }

  private async checkISA560(engagementId: string): Promise<ComplianceScore> {
    const gaps: ComplianceGap[] = [];
    let score = 0;
    const maxScore = 10;

    const events = await prisma.subsequentEvent.findMany({ where: { engagementId } });
    const checklist = await prisma.complianceChecklist.findFirst({ where: { engagementId } });

    if (checklist) {
      score += 3;
      
      if ((checklist as any).subsequentEventsReviewed) score += 3;
      else gaps.push({
        issue: 'Subsequent events review not completed',
        impact: 'Events after year-end not considered',
        priority: 'HIGH',
        fix: 'Complete subsequent events review procedures',
        isaReference: 'ISA 560.6'
      });

      if ((checklist as any).subsequentEventsDate) score += 2;
    } else {
      gaps.push({
        issue: 'Finalization checklist not initiated',
        impact: 'Completion procedures not tracked',
        priority: 'HIGH',
        fix: 'Create finalization checklist',
        isaReference: 'ISA 560.6'
      });
    }

    if (events.length > 0) {
      const evaluated = events.filter((e: any) => e.reviewedById);
      if (evaluated.length === events.length) score += 2;
      else gaps.push({
        issue: `${events.length - evaluated.length} subsequent events not evaluated`,
        impact: 'FS impact not assessed',
        priority: 'HIGH',
        fix: 'Evaluate all identified subsequent events',
        isaReference: 'ISA 560.9'
      });
    } else {
      score += 2;
    }

    return this.createScore('ISA 560', 'Subsequent Events', score, maxScore, gaps);
  }

  private async checkISA570(engagementId: string): Promise<ComplianceScore> {
    const gaps: ComplianceGap[] = [];
    let score = 0;
    const maxScore = 10;

    const gcAssessment = await prisma.goingConcernAssessment.findFirst({ where: { engagementId } });

    if (gcAssessment) {
      score += 4;

      if ((gcAssessment as any).auditConclusion) score += 2;
      else gaps.push({
        issue: 'Going concern conclusion not documented',
        impact: 'GC assessment incomplete',
        priority: 'HIGH',
        fix: 'Document going concern conclusion',
        isaReference: 'ISA 570.17'
      });

      if (gcAssessment.partnerApprovedById) score += 2;
      else gaps.push({
        issue: 'Going concern not partner-reviewed',
        impact: 'Critical judgment not validated',
        priority: 'HIGH',
        fix: 'Obtain partner review of GC assessment',
        isaReference: 'ISA 570.A33'
      });

      if (gcAssessment.managementAssessmentPeriod) score += 2;
    } else {
      gaps.push({
        issue: 'No going concern assessment',
        impact: 'Entity ability to continue not evaluated',
        priority: 'CRITICAL',
        fix: 'Perform going concern assessment',
        isaReference: 'ISA 570.10'
      });
    }

    return this.createScore('ISA 570', 'Going Concern', score, maxScore, gaps);
  }

  private async checkISA700(engagementId: string): Promise<ComplianceScore> {
    const gaps: ComplianceGap[] = [];
    let score = 0;
    const maxScore = 10;

    const report = await prisma.auditReport.findUnique({ where: { engagementId } });

    if (report) {
      score += 3;

      if (report.opinionType) score += 2;
      else gaps.push({
        issue: 'Opinion type not determined',
        impact: 'Report cannot be issued',
        priority: 'CRITICAL',
        fix: 'Determine appropriate opinion type',
        isaReference: 'ISA 700.10'
      });

      if (report.partnerApprovedById) score += 2;
      else gaps.push({
        issue: 'Report not partner-approved',
        impact: 'Quality control incomplete',
        priority: 'CRITICAL',
        fix: 'Obtain partner approval before issuance',
        isaReference: 'ISA 700.44'
      });

      if (report.signedById) score += 2;
      if (report.signedDate) score += 1;
    } else {
      gaps.push({
        issue: 'No audit report drafted',
        impact: 'Engagement cannot be completed',
        priority: 'HIGH',
        fix: 'Draft audit report',
        isaReference: 'ISA 700.21'
      });
    }

    return this.createScore('ISA 700-706', 'Reporting', score, maxScore, gaps);
  }

  private async checkISQM1(engagementId: string): Promise<ComplianceScore> {
    const gaps: ComplianceGap[] = [];
    let score = 0;
    const maxScore = 10;

    const [engagement, eqcr, signOffs, auditTrail] = await Promise.all([
      prisma.engagement.findUnique({ 
        where: { id: engagementId },
        include: { firm: true }
      }),
      prisma.eQCRAssignment.findUnique({ where: { engagementId } }),
      prisma.signOffRegister.findMany({ where: { engagementId } }),
      prisma.auditTrail.count({ where: { engagementId } })
    ]);

    if (engagement?.firm) score += 2;

    const partnerSignOffs = signOffs.filter((s: any) => 
      s.signOffType === 'PARTNER_SIGN_OFF' || s.signOffType === 'PARTNER_REVIEW'
    );
    if (partnerSignOffs.length > 0) score += 2;
    else gaps.push({
      issue: 'No partner sign-offs recorded',
      impact: 'Quality review not evidenced',
      priority: 'HIGH',
      fix: 'Implement partner review sign-off',
      isaReference: 'ISQM-1.34'
    });

    const managerReviews = signOffs.filter((s: any) => s.signOffType === 'MANAGER_REVIEW');
    if (managerReviews.length > 0) score += 2;

    if ((engagement as any)?.engagementType === 'STATUTORY_AUDIT' && (engagement as any)?.listedEntity) {
      if ((eqcr as any)?.eqcrPartnerId) score += 2;
      else gaps.push({
        issue: 'EQCR not assigned for listed entity',
        impact: 'ISQM-1 violation',
        priority: 'CRITICAL',
        fix: 'Assign EQCR partner',
        isaReference: 'ISQM-1.38'
      });

      if ((eqcr as any)?.verdict === 'APPROVED') score += 2;
      else if (eqcr) gaps.push({
        issue: 'EQCR not approved',
        impact: 'Report cannot be issued',
        priority: 'CRITICAL',
        fix: 'Complete EQCR approval',
        isaReference: 'ISQM-1.38'
      });
    } else {
      score += 4;
    }

    return this.createScore('ISQM-1', 'Quality Management', score, maxScore, gaps);
  }

  private createScore(
    isa: string,
    area: string,
    score: number,
    maxScore: number,
    gaps: ComplianceGap[]
  ): ComplianceScore {
    const percentage = Math.round((score / maxScore) * 100);
    let status: ComplianceScore['status'];
    
    if (percentage >= 85) status = 'COMPLIANT';
    else if (percentage >= 60) status = 'PARTIAL';
    else if (percentage >= 40) status = 'GAP';
    else status = 'CRITICAL';

    return { isa, area, score, maxScore, percentage, status, gaps };
  }

  private generateRecommendations(scores: ComplianceScore[]): string[] {
    const recommendations: string[] = [];
    
    const critical = scores.filter(s => s.status === 'CRITICAL');
    const gaps = scores.filter(s => s.status === 'GAP');

    if (critical.length > 0) {
      recommendations.push(`URGENT: Address ${critical.length} critical ISA compliance areas before report issuance`);
      critical.forEach(s => {
        recommendations.push(`- ${s.isa}: ${s.gaps[0]?.fix || 'Review and remediate'}`);
      });
    }

    if (gaps.length > 0) {
      recommendations.push(`HIGH PRIORITY: Remediate ${gaps.length} ISA areas with significant gaps`);
    }

    const lowSampling = scores.find(s => s.isa === 'ISA 530' && s.percentage < 60);
    if (lowSampling) {
      recommendations.push('Sampling documentation is weak - document population, method, and rationale for all samples');
    }

    const lowEvidence = scores.find(s => s.isa === 'ISA 500' && s.percentage < 70);
    if (lowEvidence) {
      recommendations.push('Evidence sufficiency/reliability ratings needed - rate all evidence files');
    }

    return recommendations;
  }
}

export const isaComplianceService = new ISAComplianceService();
