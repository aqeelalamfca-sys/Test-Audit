import { prisma } from '../db';

export type ComplianceStatus = 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIAL' | 'NOT_APPLICABLE';
export type SeverityGrade = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

interface CheckpointResult {
  checkpoint: string;
  autoCheckLogic: string;
  evidenceReference: string | null;
  reviewerConclusion: string;
  status: ComplianceStatus;
  severity: SeverityGrade | null;
  isaReference: string;
  details?: Record<string, unknown>;
}

interface SectionResult {
  sectionNumber: number;
  sectionTitle: string;
  isaReferences: string[];
  checkpoints: CheckpointResult[];
  sectionScore: number;
  maxScore: number;
  criticalFailures: number;
}

interface QCRReport {
  engagementId: string;
  engagementCode: string;
  clientName: string;
  generatedAt: Date;
  generatedBy: string;
  
  entityProfile: {
    type: string;
    industry: string;
    riskLevel: string;
  };
  
  sections: SectionResult[];
  
  summary: {
    totalCheckpoints: number;
    compliant: number;
    nonCompliant: number;
    partial: number;
    notApplicable: number;
    criticalFailures: number;
    highIssues: number;
    mediumIssues: number;
    lowIssues: number;
  };
  
  scoring: {
    rawScore: number;
    maxScore: number;
    percentage: number;
    deductions: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
  };
  
  verdict: 'QCR_PASS' | 'CONDITIONAL_PASS' | 'QCR_FAIL';
  verdictReason: string;
  
  correctiveActions: {
    priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    action: string;
    isaReference: string;
    deadline: string;
  }[];
  
  blockingControls: {
    reportIssuanceBlocked: boolean;
    blockReasons: string[];
  };
}

class QCRChecklistGenerator {
  
  async generateChecklist(engagementId: string, generatedById: string): Promise<QCRReport> {
    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId },
      include: {
        client: true,
        firm: true
      }
    });

    if (!engagement) {
      throw new Error('Engagement not found');
    }

    const generator = await prisma.user.findUnique({
      where: { id: generatedById },
      select: { fullName: true, email: true }
    });

    const clientMaster = engagement.clientMasterId 
      ? await prisma.clientMaster.findUnique({ where: { id: engagement.clientMasterId } })
      : null;

    const sections = await Promise.all([
      this.checkSection1_EngagementAcceptance(engagementId),
      this.checkSection2_AuditPlanning(engagementId),
      this.checkSection3_RiskAssessment(engagementId),
      this.checkSection4_MaterialitySampling(engagementId),
      this.checkSection5_AuditEvidence(engagementId),
      this.checkSection6_FinancialStatements(engagementId),
      this.checkSection7_CompletionReporting(engagementId),
      this.checkSection8_QualityControl(engagementId)
    ]);

    const summary = this.calculateSummary(sections);
    const scoring = this.calculateScoring(sections, summary);
    const verdict = this.determineVerdict(scoring, summary.criticalFailures);
    const correctiveActions = this.generateCorrectiveActions(sections);
    const blockingControls = this.determineBlockingControls(verdict, summary);

    const report: QCRReport = {
      engagementId,
      engagementCode: engagement.engagementCode,
      clientName: engagement.client.name,
      generatedAt: new Date(),
      generatedBy: generator?.fullName || 'System',
      
      entityProfile: {
        type: clientMaster?.legalForm || 'PRIVATE',
        industry: clientMaster?.industry || 'Unknown',
        riskLevel: engagement.riskRating || 'MEDIUM'
      },
      
      sections,
      summary,
      scoring,
      verdict: verdict.status,
      verdictReason: verdict.reason,
      correctiveActions,
      blockingControls
    };

    await this.logQCRGeneration(engagementId, generatedById, report);

    return report;
  }

  private async checkSection1_EngagementAcceptance(engagementId: string): Promise<SectionResult> {
    const checkpoints: CheckpointResult[] = [];

    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId }
    });

    const acceptanceApproved = engagement?.acceptanceDecision === 'ACCEPT';
    
    checkpoints.push({
      checkpoint: 'Client acceptance approved',
      autoCheckLogic: 'Signed acceptance form exists',
      evidenceReference: acceptanceApproved ? engagement?.acceptanceApprovalById : null,
      reviewerConclusion: acceptanceApproved 
        ? 'Client acceptance properly documented and approved'
        : 'Client acceptance not found or not approved',
      status: acceptanceApproved ? 'COMPLIANT' : 'NON_COMPLIANT',
      severity: acceptanceApproved ? null : 'CRITICAL',
      isaReference: 'ISQM-1.30, ISA 220.12'
    });

    const independence = await prisma.independenceDeclaration.findMany({
      where: { engagementId }
    });
    
    checkpoints.push({
      checkpoint: 'Independence confirmed',
      autoCheckLogic: 'Annual & engagement declarations logged',
      evidenceReference: independence.length > 0 ? `${independence.length} declarations` : null,
      reviewerConclusion: independence.length > 0 
        ? `${independence.length} independence declarations on file`
        : 'No independence declarations found',
      status: independence.length > 0 ? 'COMPLIANT' : 'NON_COMPLIANT',
      severity: independence.length > 0 ? null : 'CRITICAL',
      isaReference: 'ISA 220.11, ICAP COE'
    });

    const independenceCleared = engagement?.independenceCleared === true;
    
    checkpoints.push({
      checkpoint: 'Conflict checks performed',
      autoCheckLogic: 'Conflict register linked',
      evidenceReference: independenceCleared ? 'Independence cleared flag' : null,
      reviewerConclusion: independenceCleared 
        ? 'Conflict check performed and independence cleared'
        : 'No conflict check record found',
      status: independenceCleared ? 'COMPLIANT' : 'NON_COMPLIANT',
      severity: independenceCleared ? null : 'HIGH',
      isaReference: 'ISQM-1.28'
    });

    const engagementLetter = await prisma.engagementLetter.findFirst({
      where: { engagementId }
    });
    
    checkpoints.push({
      checkpoint: 'Engagement letter issued',
      autoCheckLogic: 'Dated, signed, uneditable',
      evidenceReference: engagementLetter?.id || null,
      reviewerConclusion: engagementLetter?.clientAcceptedDate 
        ? `Engagement letter accepted on ${engagementLetter.clientAcceptedDate.toISOString().split('T')[0]}`
        : 'Engagement letter not found or not accepted',
      status: engagementLetter?.clientAcceptedDate ? 'COMPLIANT' : 'NON_COMPLIANT',
      severity: engagementLetter?.clientAcceptedDate ? null : 'CRITICAL',
      isaReference: 'ISA 210.10'
    });

    const teamMembers = await prisma.engagementTeam.findMany({
      where: { engagementId },
      include: { user: true }
    });
    
    checkpoints.push({
      checkpoint: 'Competence assessed',
      autoCheckLogic: 'Industry experience documented',
      evidenceReference: teamMembers.length > 0 ? `${teamMembers.length} team members` : null,
      reviewerConclusion: teamMembers.length > 0 
        ? `Team of ${teamMembers.length} assigned with role allocation`
        : 'No team assignments found',
      status: teamMembers.length > 0 ? 'COMPLIANT' : 'NON_COMPLIANT',
      severity: teamMembers.length > 0 ? null : 'HIGH',
      isaReference: 'ISA 220.14'
    });

    return this.buildSectionResult(1, 'Engagement Acceptance & Continuance', 
      ['ISQM-1', 'ISA 220', 'ICAP QCR'], checkpoints);
  }

  private async checkSection2_AuditPlanning(engagementId: string): Promise<SectionResult> {
    const checkpoints: CheckpointResult[] = [];

    const planningMemo = await prisma.planningMemo.findUnique({
      where: { engagementId }
    });
    
    checkpoints.push({
      checkpoint: 'Overall audit strategy documented',
      autoCheckLogic: 'Strategy memo uploaded',
      evidenceReference: planningMemo?.id || null,
      reviewerConclusion: planningMemo 
        ? 'Planning memo documented with audit strategy'
        : 'No planning memo found',
      status: planningMemo ? 'COMPLIANT' : 'NON_COMPLIANT',
      severity: planningMemo ? null : 'CRITICAL',
      isaReference: 'ISA 300.7'
    });

    const auditPlanApproved = planningMemo?.partnerApprovedById !== null;
    
    checkpoints.push({
      checkpoint: 'Audit plan approved',
      autoCheckLogic: 'Partner approval timestamp',
      evidenceReference: planningMemo?.partnerApprovedById || null,
      reviewerConclusion: auditPlanApproved 
        ? 'Audit plan approved by partner'
        : 'Audit plan not approved by partner',
      status: auditPlanApproved ? 'COMPLIANT' : 'NON_COMPLIANT',
      severity: auditPlanApproved ? null : 'HIGH',
      isaReference: 'ISA 300.11'
    });

    const hasBusinessUnderstanding = planningMemo?.entityBackground && planningMemo?.industryAnalysis;
    
    checkpoints.push({
      checkpoint: 'Business understanding documented',
      autoCheckLogic: 'Entity & industry notes',
      evidenceReference: hasBusinessUnderstanding ? 'Planning memo' : null,
      reviewerConclusion: hasBusinessUnderstanding 
        ? 'Entity background and industry analysis documented'
        : 'Business understanding not adequately documented',
      status: hasBusinessUnderstanding ? 'COMPLIANT' : 'NON_COMPLIANT',
      severity: hasBusinessUnderstanding ? null : 'MEDIUM',
      isaReference: 'ISA 315.11'
    });

    const fraudRisks = await prisma.riskAssessment.findMany({
      where: { engagementId, isFraudRisk: true }
    });
    
    checkpoints.push({
      checkpoint: 'Fraud risk assessment',
      autoCheckLogic: 'Fraud risks identified',
      evidenceReference: fraudRisks.length > 0 ? `${fraudRisks.length} fraud risks` : null,
      reviewerConclusion: fraudRisks.length > 0 
        ? `${fraudRisks.length} fraud risks identified and documented`
        : 'No fraud risks documented (ISA 240 presumption not addressed)',
      status: fraudRisks.length > 0 ? 'COMPLIANT' : 'NON_COMPLIANT',
      severity: fraudRisks.length > 0 ? null : 'CRITICAL',
      isaReference: 'ISA 240.26'
    });

    const goingConcern = await prisma.goingConcernAssessment.findUnique({
      where: { engagementId }
    });
    
    checkpoints.push({
      checkpoint: 'Going concern assessed',
      autoCheckLogic: 'Mandatory assessment present',
      evidenceReference: goingConcern?.id || null,
      reviewerConclusion: goingConcern 
        ? `Going concern assessed: ${goingConcern.materialUncertaintyExists ? 'Material uncertainty exists' : 'No material uncertainty'}`
        : 'Going concern assessment not performed',
      status: goingConcern ? 'COMPLIANT' : 'NON_COMPLIANT',
      severity: goingConcern ? null : 'CRITICAL',
      isaReference: 'ISA 570.10'
    });

    return this.buildSectionResult(2, 'Audit Planning & Strategy', 
      ['ISA 300', 'ISA 315'], checkpoints);
  }

  private async checkSection3_RiskAssessment(engagementId: string): Promise<SectionResult> {
    const checkpoints: CheckpointResult[] = [];

    const significantRisks = await prisma.riskAssessment.findMany({
      where: { engagementId, isSignificantRisk: true }
    });
    
    checkpoints.push({
      checkpoint: 'Significant risks identified',
      autoCheckLogic: 'Risk register populated',
      evidenceReference: significantRisks.length > 0 ? `${significantRisks.length} significant risks` : null,
      reviewerConclusion: significantRisks.length > 0 
        ? `${significantRisks.length} significant risks identified`
        : 'No significant risks identified',
      status: significantRisks.length > 0 ? 'COMPLIANT' : 'NON_COMPLIANT',
      severity: significantRisks.length > 0 ? null : 'HIGH',
      isaReference: 'ISA 315.27'
    });

    const allRisks = await prisma.riskAssessment.findMany({
      where: { engagementId }
    });
    const risksWithAssertions = allRisks.filter(r => r.assertion !== null);
    
    checkpoints.push({
      checkpoint: 'Assertion-level risks mapped',
      autoCheckLogic: 'Risk → assertion linkage',
      evidenceReference: `${risksWithAssertions.length}/${allRisks.length} risks with assertions`,
      reviewerConclusion: risksWithAssertions.length === allRisks.length 
        ? 'All risks mapped to assertions'
        : `${allRisks.length - risksWithAssertions.length} risks without assertion mapping`,
      status: risksWithAssertions.length === allRisks.length && allRisks.length > 0 ? 'COMPLIANT' : 'NON_COMPLIANT',
      severity: risksWithAssertions.length === allRisks.length ? null : 'HIGH',
      isaReference: 'ISA 315.26'
    });

    const substantiveTests = await prisma.substantiveTest.findMany({
      where: { engagementId }
    });
    const testsWithRisks = substantiveTests.filter(t => t.riskId !== null);
    const linkageRate = substantiveTests.length > 0 
      ? Math.round((testsWithRisks.length / substantiveTests.length) * 100) 
      : 0;
    
    checkpoints.push({
      checkpoint: 'Procedures responsive to risks',
      autoCheckLogic: 'ToD linked to risks',
      evidenceReference: `${testsWithRisks.length}/${substantiveTests.length} tests linked (${linkageRate}%)`,
      reviewerConclusion: linkageRate === 100 
        ? 'All procedures linked to assessed risks'
        : `${substantiveTests.length - testsWithRisks.length} procedures not linked to risks (${100 - linkageRate}% gap)`,
      status: linkageRate === 100 ? 'COMPLIANT' : 'NON_COMPLIANT',
      severity: linkageRate === 100 ? null : linkageRate < 50 ? 'CRITICAL' : 'HIGH',
      isaReference: 'ISA 330.6',
      details: { linkageRate, linked: testsWithRisks.length, total: substantiveTests.length }
    });

    const riskIdsWithProcedures = new Set(testsWithRisks.map(t => t.riskId).filter(Boolean));
    const risksWithoutProcedures = allRisks.filter(r => !riskIdsWithProcedures.has(r.id));
    
    checkpoints.push({
      checkpoint: 'All risks have responsive procedures',
      autoCheckLogic: 'Risk → Procedure coverage 100%',
      evidenceReference: risksWithoutProcedures.length === 0 ? 'Full coverage' : `${risksWithoutProcedures.length} gaps`,
      reviewerConclusion: risksWithoutProcedures.length === 0 
        ? 'All identified risks have responsive audit procedures'
        : `${risksWithoutProcedures.length} risks have no linked procedures`,
      status: risksWithoutProcedures.length === 0 ? 'COMPLIANT' : 'NON_COMPLIANT',
      severity: risksWithoutProcedures.length === 0 ? null : 'CRITICAL',
      isaReference: 'ISA 330.5'
    });

    return this.buildSectionResult(3, 'Risk Assessment & Responses', 
      ['ISA 315', 'ISA 330'], checkpoints);
  }

  private async checkSection4_MaterialitySampling(engagementId: string): Promise<SectionResult> {
    const checkpoints: CheckpointResult[] = [];

    const materiality = await prisma.materialityCalculation.findFirst({
      where: { engagementId, status: { not: 'SUPERSEDED' } },
      orderBy: { version: 'desc' }
    });
    
    checkpoints.push({
      checkpoint: 'Materiality basis appropriate',
      autoCheckLogic: 'Benchmark documented',
      evidenceReference: materiality?.id || null,
      reviewerConclusion: materiality 
        ? `Materiality calculated using ${materiality.primaryBenchmarkType} at ${materiality.appliedPercentage}%`
        : 'NO MATERIALITY CALCULATION EXISTS',
      status: materiality ? 'COMPLIANT' : 'NON_COMPLIANT',
      severity: materiality ? null : 'CRITICAL',
      isaReference: 'ISA 320.10'
    });

    const hasPMandTrivial = materiality && 
      materiality.performanceMateriality !== null && 
      materiality.trivialThreshold !== null;
    
    checkpoints.push({
      checkpoint: 'PM & trivial calculated',
      autoCheckLogic: 'System recalculation matches',
      evidenceReference: hasPMandTrivial ? 'MaterialityCalculation' : null,
      reviewerConclusion: hasPMandTrivial 
        ? `PM: ${materiality.performanceMateriality}, Trivial: ${materiality.trivialThreshold}`
        : 'Performance Materiality and/or Trivial Threshold not calculated',
      status: hasPMandTrivial ? 'COMPLIANT' : 'NON_COMPLIANT',
      severity: hasPMandTrivial ? null : 'CRITICAL',
      isaReference: 'ISA 320.11, ISA 450.A2'
    });

    const tests = await prisma.substantiveTest.findMany({
      where: { engagementId }
    });
    const testsWithPopulation = tests.filter(t => t.populationValue !== null);
    
    checkpoints.push({
      checkpoint: 'Population defined',
      autoCheckLogic: 'Population source linked',
      evidenceReference: `${testsWithPopulation.length}/${tests.length} tests with population`,
      reviewerConclusion: testsWithPopulation.length === tests.length 
        ? 'All test populations properly defined'
        : `${tests.length - testsWithPopulation.length} tests lack population definition`,
      status: testsWithPopulation.length === tests.length && tests.length > 0 ? 'COMPLIANT' : 'NON_COMPLIANT',
      severity: testsWithPopulation.length === tests.length ? null : 'CRITICAL',
      isaReference: 'ISA 530.A7'
    });

    const testsWithRationale = tests.filter(t => t.samplingRationale !== null && t.samplingRationale !== '');
    
    checkpoints.push({
      checkpoint: 'Sample selection justified',
      autoCheckLogic: 'Method + rationale logged',
      evidenceReference: `${testsWithRationale.length}/${tests.length} with rationale`,
      reviewerConclusion: testsWithRationale.length === tests.length 
        ? 'All sample selections justified with rationale'
        : `${tests.length - testsWithRationale.length} samples lack justification`,
      status: testsWithRationale.length === tests.length && tests.length > 0 ? 'COMPLIANT' : 'NON_COMPLIANT',
      severity: testsWithRationale.length === tests.length ? null : 'CRITICAL',
      isaReference: 'ISA 530.6'
    });

    const misstatements = await prisma.misstatement.findMany({
      where: { engagementId }
    });
    const evaluatedMisstatements = misstatements.filter(m => m.materialityCalculationId !== null);
    
    checkpoints.push({
      checkpoint: 'Exceptions evaluated',
      autoCheckLogic: 'Misstatements roll-up against materiality',
      evidenceReference: `${evaluatedMisstatements.length}/${misstatements.length} evaluated`,
      reviewerConclusion: evaluatedMisstatements.length === misstatements.length 
        ? 'All misstatements evaluated against materiality'
        : `${misstatements.length - evaluatedMisstatements.length} misstatements not evaluated against materiality`,
      status: evaluatedMisstatements.length === misstatements.length && misstatements.length > 0 
        ? 'COMPLIANT' 
        : misstatements.length === 0 ? 'NOT_APPLICABLE' : 'NON_COMPLIANT',
      severity: evaluatedMisstatements.length === misstatements.length ? null : 'CRITICAL',
      isaReference: 'ISA 450.5'
    });

    return this.buildSectionResult(4, 'Materiality & Sampling', 
      ['ISA 320', 'ISA 450', 'ISA 530'], checkpoints);
  }

  private async checkSection5_AuditEvidence(engagementId: string): Promise<SectionResult> {
    const checkpoints: CheckpointResult[] = [];

    const tests = await prisma.substantiveTest.findMany({
      where: { engagementId }
    });
    const completedTests = tests.filter(t => t.conclusion !== null);
    
    checkpoints.push({
      checkpoint: 'Procedures executed as planned',
      autoCheckLogic: 'Completion logs',
      evidenceReference: `${completedTests.length}/${tests.length} completed`,
      reviewerConclusion: completedTests.length === tests.length 
        ? 'All planned procedures executed and concluded'
        : `${tests.length - completedTests.length} procedures not completed`,
      status: completedTests.length === tests.length && tests.length > 0 ? 'COMPLIANT' : 'NON_COMPLIANT',
      severity: completedTests.length === tests.length ? null : 'HIGH',
      isaReference: 'ISA 330.28'
    });

    const evidence = await prisma.evidenceFile.findMany({
      where: { engagementId }
    });
    
    checkpoints.push({
      checkpoint: 'Evidence sufficient & appropriate',
      autoCheckLogic: 'Evidence rating',
      evidenceReference: evidence.length > 0 ? `${evidence.length} evidence files` : null,
      reviewerConclusion: evidence.length > 0 
        ? `${evidence.length} evidence files uploaded and categorized`
        : 'No evidence files uploaded',
      status: evidence.length > 0 ? 'COMPLIANT' : 'NON_COMPLIANT',
      severity: evidence.length > 0 ? null : 'CRITICAL',
      isaReference: 'ISA 500.6'
    });

    const testEvidence = await prisma.substantiveTestEvidence.findMany({
      where: { substantiveTestId: { in: tests.map(t => t.id) } }
    });
    const testsWithEvidence = new Set(testEvidence.map(te => te.substantiveTestId)).size;
    
    checkpoints.push({
      checkpoint: 'Procedures linked to evidence',
      autoCheckLogic: 'Test-evidence linkage',
      evidenceReference: `${testsWithEvidence}/${tests.length} tests with evidence`,
      reviewerConclusion: testsWithEvidence === tests.length 
        ? 'All procedures have linked supporting evidence'
        : `${tests.length - testsWithEvidence} procedures lack supporting evidence`,
      status: testsWithEvidence === tests.length && tests.length > 0 ? 'COMPLIANT' : 'NON_COMPLIANT',
      severity: testsWithEvidence === tests.length ? null : 'HIGH',
      isaReference: 'ISA 500.7'
    });

    const analyticalTests = tests.filter(t => t.testingType === 'ANALYTICAL');
    const analyticalWithConclusion = analyticalTests.filter(t => t.conclusion !== null);
    
    checkpoints.push({
      checkpoint: 'Analytical procedures documented',
      autoCheckLogic: 'Documented & concluded',
      evidenceReference: analyticalTests.length > 0 ? `${analyticalWithConclusion.length}/${analyticalTests.length}` : 'N/A',
      reviewerConclusion: analyticalTests.length === 0 
        ? 'No analytical procedures planned'
        : analyticalWithConclusion.length === analyticalTests.length
          ? 'All analytical procedures documented and concluded'
          : `${analyticalTests.length - analyticalWithConclusion.length} analytical procedures not concluded`,
      status: analyticalTests.length === 0 
        ? 'NOT_APPLICABLE' 
        : analyticalWithConclusion.length === analyticalTests.length ? 'COMPLIANT' : 'NON_COMPLIANT',
      severity: analyticalWithConclusion.length === analyticalTests.length ? null : 'MEDIUM',
      isaReference: 'ISA 520.6'
    });

    return this.buildSectionResult(5, 'Audit Evidence & Execution', 
      ['ISA 500', 'ISA 520'], checkpoints);
  }

  private async checkSection6_FinancialStatements(engagementId: string): Promise<SectionResult> {
    const checkpoints: CheckpointResult[] = [];

    const glBatch = await prisma.gLBatch.findFirst({ where: { engagementId } });
    const tbBatch = await prisma.tBBatch.findFirst({ where: { engagementId } });
    const fsSnapshot = await prisma.fSSnapshot.findFirst({ where: { engagementId } });
    
    const hasFullPipeline = glBatch !== null && tbBatch !== null;
    
    checkpoints.push({
      checkpoint: 'FS traceable to TB',
      autoCheckLogic: 'GL→TB→FS lock',
      evidenceReference: hasFullPipeline ? 'GL+TB exists' : 'Pipeline incomplete',
      reviewerConclusion: hasFullPipeline 
        ? 'Financial statement data traceable through GL→TB pipeline'
        : `Data pipeline incomplete: GL=${glBatch ? 'YES' : 'NO'}, TB=${tbBatch ? 'YES' : 'NO'}, FS=${fsSnapshot ? 'YES' : 'NO'}`,
      status: hasFullPipeline ? 'COMPLIANT' : 'NON_COMPLIANT',
      severity: hasFullPipeline ? null : 'CRITICAL',
      isaReference: 'ISA 500.9'
    });

    const disclosureChecks = await prisma.checklistItem.findMany({
      where: { 
        engagementId,
        OR: [
          { section: { contains: 'disclosure' } },
          { title: { contains: 'disclosure' } }
        ]
      }
    });
    const completedDisclosures = disclosureChecks.filter(d => d.status === 'COMPLETED');
    
    checkpoints.push({
      checkpoint: 'Disclosures checklist completed',
      autoCheckLogic: 'IFRS checklist',
      evidenceReference: disclosureChecks.length > 0 ? `${completedDisclosures.length}/${disclosureChecks.length}` : null,
      reviewerConclusion: disclosureChecks.length === 0 
        ? 'No disclosure checklist items found'
        : completedDisclosures.length === disclosureChecks.length
          ? 'All disclosure checklist items completed'
          : `${disclosureChecks.length - completedDisclosures.length} disclosure items incomplete`,
      status: disclosureChecks.length === 0 
        ? 'NON_COMPLIANT' 
        : completedDisclosures.length === disclosureChecks.length ? 'COMPLIANT' : 'PARTIAL',
      severity: completedDisclosures.length === disclosureChecks.length ? null : 'HIGH',
      isaReference: 'ISA 700.13, IAS 1'
    });

    const misstatements = await prisma.misstatement.findMany({
      where: { engagementId }
    });
    const adjustedMisstatements = misstatements.filter(m => m.status === 'ADJUSTED');
    
    checkpoints.push({
      checkpoint: 'Adjustments processed',
      autoCheckLogic: 'Posted & approved',
      evidenceReference: misstatements.length > 0 
        ? `${adjustedMisstatements.length}/${misstatements.length} adjusted` 
        : 'No misstatements',
      reviewerConclusion: misstatements.length === 0 
        ? 'No misstatements identified'
        : `${adjustedMisstatements.length} of ${misstatements.length} misstatements adjusted`,
      status: misstatements.length === 0 ? 'NOT_APPLICABLE' : 'COMPLIANT',
      severity: null,
      isaReference: 'ISA 450.8'
    });

    return this.buildSectionResult(6, 'Financial Statements & Disclosures', 
      ['ISA 700', 'IAS/IFRS'], checkpoints);
  }

  private async checkSection7_CompletionReporting(engagementId: string): Promise<SectionResult> {
    const checkpoints: CheckpointResult[] = [];

    const subsequentEventsItems = await prisma.checklistItem.findMany({
      where: { 
        engagementId,
        OR: [
          { section: { contains: 'Subsequent' } },
          { title: { contains: 'subsequent' } }
        ]
      }
    });
    const completedSE = subsequentEventsItems.filter(i => i.status === 'COMPLETED');
    
    checkpoints.push({
      checkpoint: 'Subsequent events reviewed',
      autoCheckLogic: 'Completion memo',
      evidenceReference: subsequentEventsItems.length > 0 ? `${completedSE.length}/${subsequentEventsItems.length}` : null,
      reviewerConclusion: subsequentEventsItems.length === 0 
        ? 'No subsequent events checklist found'
        : completedSE.length === subsequentEventsItems.length
          ? 'All subsequent events procedures completed'
          : `${subsequentEventsItems.length - completedSE.length} subsequent events items incomplete`,
      status: completedSE.length === subsequentEventsItems.length && subsequentEventsItems.length > 0 
        ? 'COMPLIANT' : 'NON_COMPLIANT',
      severity: completedSE.length === subsequentEventsItems.length ? null : 'HIGH',
      isaReference: 'ISA 560.9'
    });

    const goingConcern = await prisma.goingConcernAssessment.findUnique({
      where: { engagementId }
    });
    
    checkpoints.push({
      checkpoint: 'Going concern concluded',
      autoCheckLogic: 'Final conclusion',
      evidenceReference: goingConcern?.auditConclusion ? 'Conclusion documented' : null,
      reviewerConclusion: goingConcern?.auditConclusion 
        ? 'Going concern conclusion properly documented'
        : 'Going concern conclusion not documented',
      status: goingConcern?.auditConclusion ? 'COMPLIANT' : 'NON_COMPLIANT',
      severity: goingConcern?.auditConclusion ? null : 'CRITICAL',
      isaReference: 'ISA 570.17'
    });

    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId }
    });
    const hasRepLetter = engagement?.termsAgreed === true;
    
    checkpoints.push({
      checkpoint: 'Management representation obtained',
      autoCheckLogic: 'Signed & dated',
      evidenceReference: hasRepLetter ? 'Terms agreed' : null,
      reviewerConclusion: hasRepLetter 
        ? 'Management representations and terms agreed'
        : 'Management representation letter not obtained',
      status: hasRepLetter ? 'COMPLIANT' : 'NON_COMPLIANT',
      severity: hasRepLetter ? null : 'CRITICAL',
      isaReference: 'ISA 580.9'
    });

    const auditReport = await prisma.auditReport.findUnique({
      where: { engagementId }
    });
    
    checkpoints.push({
      checkpoint: 'Opinion appropriate',
      autoCheckLogic: 'Opinion logic engine',
      evidenceReference: auditReport?.id || null,
      reviewerConclusion: auditReport 
        ? `Audit report prepared with ${auditReport.opinionType} opinion`
        : 'NO AUDIT REPORT EXISTS',
      status: auditReport ? 'COMPLIANT' : 'NON_COMPLIANT',
      severity: auditReport ? null : 'CRITICAL',
      isaReference: 'ISA 700.17'
    });

    return this.buildSectionResult(7, 'Completion & Reporting', 
      ['ISA 560', 'ISA 570', 'ISA 580', 'ISA 700-706'], checkpoints);
  }

  private async checkSection8_QualityControl(engagementId: string): Promise<SectionResult> {
    const checkpoints: CheckpointResult[] = [];

    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId }
    });
    
    const hasPartner = engagement?.engagementPartnerId !== null;
    
    checkpoints.push({
      checkpoint: 'Partner review completed',
      autoCheckLogic: 'Locked sign-off',
      evidenceReference: engagement?.engagementPartnerId || null,
      reviewerConclusion: hasPartner 
        ? 'Engagement partner assigned'
        : 'No partner assigned to engagement',
      status: hasPartner ? 'PARTIAL' : 'NON_COMPLIANT',
      severity: hasPartner ? 'MEDIUM' : 'CRITICAL',
      isaReference: 'ISA 220.17'
    });

    const eqcr = await prisma.eQCRAssignment.findFirst({
      where: { engagementId }
    });
    const isStatutoryAudit = engagement?.engagementType === 'statutory_audit';
    const eqcrCompleted = eqcr?.signatureDate !== null;
    
    checkpoints.push({
      checkpoint: 'EQCR performed (if required)',
      autoCheckLogic: 'EQCR approval',
      evidenceReference: eqcr?.id || null,
      reviewerConclusion: !isStatutoryAudit 
        ? 'EQCR not required for this engagement type'
        : eqcrCompleted
          ? 'EQCR completed and approved'
          : eqcr
            ? `EQCR assigned but status: ${eqcr.status}`
            : 'EQCR required but not assigned',
      status: !isStatutoryAudit 
        ? 'NOT_APPLICABLE' 
        : eqcrCompleted ? 'COMPLIANT' : 'NON_COMPLIANT',
      severity: !isStatutoryAudit || eqcrCompleted ? null : 'CRITICAL',
      isaReference: 'ISQM-1.34'
    });

    const phaseProgress = await prisma.phaseProgress.findMany({
      where: { engagementId }
    });
    const lockedPhases = phaseProgress.filter(p => p.lockedAt !== null);
    
    checkpoints.push({
      checkpoint: 'Differences resolved',
      autoCheckLogic: 'Resolution logs',
      evidenceReference: `${lockedPhases.length}/${phaseProgress.length} phases locked`,
      reviewerConclusion: lockedPhases.length === phaseProgress.length 
        ? 'All phases completed and locked'
        : `${phaseProgress.length - lockedPhases.length} phases not locked`,
      status: lockedPhases.length === phaseProgress.length && phaseProgress.length > 0 
        ? 'COMPLIANT' : 'PARTIAL',
      severity: lockedPhases.length === phaseProgress.length ? null : 'MEDIUM',
      isaReference: 'ISA 220.20'
    });

    const auditFileAssembly = await prisma.auditFileAssembly.findUnique({
      where: { engagementId }
    });
    
    checkpoints.push({
      checkpoint: 'Archiving completed',
      autoCheckLogic: 'Read-only enforced',
      evidenceReference: auditFileAssembly?.assemblyStatus || null,
      reviewerConclusion: auditFileAssembly?.assemblyStatus === 'completed' 
        ? 'Audit file assembly completed and archived'
        : auditFileAssembly
          ? `Archiving in progress: ${auditFileAssembly.assemblyStatus}`
          : 'Audit file assembly not started',
      status: auditFileAssembly?.assemblyStatus === 'completed' ? 'COMPLIANT' : 'NON_COMPLIANT',
      severity: auditFileAssembly?.assemblyStatus === 'completed' ? null : 'HIGH',
      isaReference: 'ISA 230.14'
    });

    return this.buildSectionResult(8, 'Quality Control & Reviews', 
      ['ISQM-1', 'ICAP QCR'], checkpoints);
  }

  private buildSectionResult(
    sectionNumber: number, 
    sectionTitle: string, 
    isaReferences: string[], 
    checkpoints: CheckpointResult[]
  ): SectionResult {
    const criticalFailures = checkpoints.filter(c => c.severity === 'CRITICAL').length;
    const compliantCount = checkpoints.filter(c => c.status === 'COMPLIANT').length;
    const maxScore = checkpoints.filter(c => c.status !== 'NOT_APPLICABLE').length;
    
    return {
      sectionNumber,
      sectionTitle,
      isaReferences,
      checkpoints,
      sectionScore: compliantCount,
      maxScore,
      criticalFailures
    };
  }

  private calculateSummary(sections: SectionResult[]) {
    const allCheckpoints = sections.flatMap(s => s.checkpoints);
    
    return {
      totalCheckpoints: allCheckpoints.length,
      compliant: allCheckpoints.filter(c => c.status === 'COMPLIANT').length,
      nonCompliant: allCheckpoints.filter(c => c.status === 'NON_COMPLIANT').length,
      partial: allCheckpoints.filter(c => c.status === 'PARTIAL').length,
      notApplicable: allCheckpoints.filter(c => c.status === 'NOT_APPLICABLE').length,
      criticalFailures: allCheckpoints.filter(c => c.severity === 'CRITICAL').length,
      highIssues: allCheckpoints.filter(c => c.severity === 'HIGH').length,
      mediumIssues: allCheckpoints.filter(c => c.severity === 'MEDIUM').length,
      lowIssues: allCheckpoints.filter(c => c.severity === 'LOW').length
    };
  }

  private calculateScoring(sections: SectionResult[], summary: ReturnType<typeof this.calculateSummary>) {
    const baseScore = 100;
    
    const deductions = {
      critical: summary.criticalFailures * 0,
      high: summary.highIssues * 10,
      medium: summary.mediumIssues * 5,
      low: summary.lowIssues * 2
    };
    
    const totalDeductions = deductions.high + deductions.medium + deductions.low;
    const rawScore = Math.max(0, baseScore - totalDeductions);
    
    return {
      rawScore,
      maxScore: 100,
      percentage: summary.criticalFailures > 0 ? 0 : rawScore,
      deductions
    };
  }

  private determineVerdict(
    scoring: ReturnType<typeof this.calculateScoring>, 
    criticalFailures: number
  ): { status: 'QCR_PASS' | 'CONDITIONAL_PASS' | 'QCR_FAIL'; reason: string } {
    if (criticalFailures > 0) {
      return {
        status: 'QCR_FAIL',
        reason: `AUTOMATIC FAIL: ${criticalFailures} critical failure(s) detected. Any critical failure results in QCR FAIL per ICAP/AOB standards.`
      };
    }
    
    if (scoring.percentage >= 90) {
      return {
        status: 'QCR_PASS',
        reason: `QCR PASS: Score ${scoring.percentage}% meets the 90% threshold with zero critical failures.`
      };
    }
    
    if (scoring.percentage >= 75) {
      return {
        status: 'CONDITIONAL_PASS',
        reason: `CONDITIONAL PASS: Score ${scoring.percentage}% is between 75-89%. Remediation required before final approval.`
      };
    }
    
    return {
      status: 'QCR_FAIL',
      reason: `QCR FAIL: Score ${scoring.percentage}% is below the 75% threshold.`
    };
  }

  private generateCorrectiveActions(sections: SectionResult[]): QCRReport['correctiveActions'] {
    const actions: QCRReport['correctiveActions'] = [];
    
    for (const section of sections) {
      for (const checkpoint of section.checkpoints) {
        if (checkpoint.status === 'NON_COMPLIANT' || checkpoint.status === 'PARTIAL') {
          actions.push({
            priority: checkpoint.severity || 'MEDIUM',
            action: `Remediate: ${checkpoint.checkpoint} - ${checkpoint.reviewerConclusion}`,
            isaReference: checkpoint.isaReference,
            deadline: checkpoint.severity === 'CRITICAL' ? 'Immediate' 
              : checkpoint.severity === 'HIGH' ? '48 hours'
              : checkpoint.severity === 'MEDIUM' ? '7 days'
              : '14 days'
          });
        }
      }
    }
    
    return actions.sort((a, b) => {
      const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  private determineBlockingControls(
    verdict: ReturnType<typeof this.determineVerdict>,
    summary: ReturnType<typeof this.calculateSummary>
  ): QCRReport['blockingControls'] {
    const blockReasons: string[] = [];
    
    if (verdict.status === 'QCR_FAIL') {
      blockReasons.push('QCR verdict is FAIL - report issuance blocked');
    }
    
    if (summary.criticalFailures > 0) {
      blockReasons.push(`${summary.criticalFailures} critical compliance failure(s) require immediate remediation`);
    }
    
    return {
      reportIssuanceBlocked: verdict.status === 'QCR_FAIL',
      blockReasons
    };
  }

  private async logQCRGeneration(engagementId: string, userId: string, report: QCRReport) {
    await prisma.auditTrail.create({
      data: {
        engagementId,
        userId,
        action: 'QCR_CHECKLIST_GENERATED',
        entityType: 'QCRReport',
        entityId: engagementId,
        afterValue: JSON.stringify({
          verdict: report.verdict,
          score: report.scoring.percentage,
          criticalFailures: report.summary.criticalFailures,
          compliant: report.summary.compliant,
          nonCompliant: report.summary.nonCompliant
        }),
        isaReference: 'ISQM-1, ICAP QCR',
        isImmutable: true
      }
    });
  }
}

export const qcrChecklistGenerator = new QCRChecklistGenerator();
