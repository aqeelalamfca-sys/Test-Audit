import { prisma } from '../db';
import { Decimal } from '@prisma/client/runtime/library';
import crypto from 'crypto';

export type BenchmarkType = 'REVENUE' | 'TOTAL_ASSETS' | 'PROFIT_BEFORE_TAX' | 'TOTAL_EQUITY' | 'GROSS_PROFIT' | 'TOTAL_EXPENSES' | 'CUSTOM';
export type MaterialityStatus = 'DRAFT' | 'PENDING_REVIEW' | 'REVIEWED' | 'PENDING_APPROVAL' | 'APPROVED' | 'SUPERSEDED';
export type EntityType = 'PRIVATE' | 'PUBLIC' | 'NFP' | 'GOVERNMENT';

interface BenchmarkConfig {
  id: string;
  benchmarkType: string;
  benchmarkName: string;
  minPercentage: number;
  maxPercentage: number;
  defaultPercentage: number;
  applicableEntityTypes: string[];
  applicableIndustries: string[];
  isActive: boolean;
}

interface MaterialityCalculationInput {
  engagementId: string;
  firmId: string;
  fiscalYear: number;
  periodStart: Date;
  periodEnd: Date;
  primaryBenchmarkType: BenchmarkType;
  primaryBenchmarkValue: number;
  appliedPercentage: number;
  performanceMaterialityPct?: number;
  trivialThresholdPct?: number;
  calculationNotes?: string;
  userId: string;
}

interface OverrideInput {
  calculationId: string;
  overrideType: 'OVERALL_MATERIALITY' | 'PERFORMANCE_MATERIALITY' | 'TRIVIAL_THRESHOLD';
  originalValue: number;
  overriddenValue: number;
  justification: string;
  riskBasedRationale: string;
  partnerApprovedById: string;
  partnerSignOffPin: string;
}

interface AuditLogInput {
  calculationId?: string;
  misstatementId?: string;
  engagementId: string;
  action: string;
  actionDescription: string;
  entityType: string;
  entityId: string;
  userId: string;
  userRole: string;
  userName?: string;
  previousStatus?: string;
  newStatus?: string;
  changedFields?: Record<string, unknown>;
  previousValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  overrideApplied?: boolean;
  overrideJustification?: string;
  partnerSignOff?: boolean;
  partnerSignOffPin?: string;
  ipAddress?: string;
  userAgent?: string;
}

class MaterialityService {
  async getDefaultBenchmarks(firmId: string): Promise<BenchmarkConfig[]> {
    const benchmarks = await prisma.materialityBenchmarkConfig.findMany({
      where: { firmId, isActive: true, engagementId: null },
      orderBy: { createdAt: 'asc' }
    });

    if (benchmarks.length === 0) {
      return this.createDefaultBenchmarks(firmId);
    }

    return benchmarks.map(b => ({
      id: b.id,
      benchmarkType: b.benchmarkType,
      benchmarkName: b.benchmarkName,
      minPercentage: Number(b.minPercentage),
      maxPercentage: Number(b.maxPercentage),
      defaultPercentage: Number(b.defaultPercentage),
      applicableEntityTypes: b.applicableEntityTypes,
      applicableIndustries: b.applicableIndustries,
      isActive: b.isActive
    }));
  }

  private async createDefaultBenchmarks(firmId: string, createdById?: string): Promise<BenchmarkConfig[]> {
    const systemUserId = createdById || await this.getSystemUserId(firmId);
    
    const defaultConfigs = [
      {
        firmId,
        benchmarkType: 'REVENUE' as const,
        benchmarkName: 'Total Revenue',
        minPercentage: new Decimal(0.5),
        maxPercentage: new Decimal(2.0),
        defaultPercentage: new Decimal(1.0),
        applicableEntityTypes: ['PRIVATE', 'PUBLIC'],
        applicableIndustries: [] as string[],
        isaReference: 'ISA 320.A4',
        isActive: true,
        createdById: systemUserId
      },
      {
        firmId,
        benchmarkType: 'TOTAL_ASSETS' as const,
        benchmarkName: 'Total Assets',
        minPercentage: new Decimal(0.5),
        maxPercentage: new Decimal(2.0),
        defaultPercentage: new Decimal(1.0),
        applicableEntityTypes: ['PRIVATE', 'PUBLIC', 'NFP'],
        applicableIndustries: ['BANKING', 'INSURANCE', 'INVESTMENT'],
        isaReference: 'ISA 320.A4',
        isActive: true,
        createdById: systemUserId
      },
      {
        firmId,
        benchmarkType: 'PROFIT_BEFORE_TAX' as const,
        benchmarkName: 'Profit Before Tax',
        minPercentage: new Decimal(3.0),
        maxPercentage: new Decimal(10.0),
        defaultPercentage: new Decimal(5.0),
        applicableEntityTypes: ['PRIVATE', 'PUBLIC'],
        applicableIndustries: [] as string[],
        isaReference: 'ISA 320.A4',
        isActive: true,
        createdById: systemUserId
      },
      {
        firmId,
        benchmarkType: 'TOTAL_EQUITY' as const,
        benchmarkName: 'Total Equity',
        minPercentage: new Decimal(1.0),
        maxPercentage: new Decimal(5.0),
        defaultPercentage: new Decimal(2.0),
        applicableEntityTypes: ['PRIVATE', 'PUBLIC'],
        applicableIndustries: [] as string[],
        isaReference: 'ISA 320.A4',
        isActive: true,
        createdById: systemUserId
      },
      {
        firmId,
        benchmarkType: 'GROSS_PROFIT' as const,
        benchmarkName: 'Gross Profit',
        minPercentage: new Decimal(0.5),
        maxPercentage: new Decimal(3.0),
        defaultPercentage: new Decimal(1.5),
        applicableEntityTypes: ['PRIVATE', 'PUBLIC'],
        applicableIndustries: ['RETAIL', 'MANUFACTURING'],
        isaReference: 'ISA 320.A4',
        isActive: true,
        createdById: systemUserId
      },
      {
        firmId,
        benchmarkType: 'TOTAL_EXPENSES' as const,
        benchmarkName: 'Total Expenses',
        minPercentage: new Decimal(0.5),
        maxPercentage: new Decimal(2.0),
        defaultPercentage: new Decimal(1.0),
        applicableEntityTypes: ['NFP', 'GOVERNMENT'],
        applicableIndustries: [] as string[],
        isaReference: 'ISA 320.A4',
        isActive: true,
        createdById: systemUserId
      }
    ];

    const created = await prisma.$transaction(
      defaultConfigs.map(config => prisma.materialityBenchmarkConfig.create({ data: config }))
    );

    return created.map(b => ({
      id: b.id,
      benchmarkType: b.benchmarkType,
      benchmarkName: b.benchmarkName,
      minPercentage: Number(b.minPercentage),
      maxPercentage: Number(b.maxPercentage),
      defaultPercentage: Number(b.defaultPercentage),
      applicableEntityTypes: b.applicableEntityTypes,
      applicableIndustries: b.applicableIndustries,
      isActive: b.isActive
    }));
  }

  private async getSystemUserId(firmId: string): Promise<string> {
    const adminUser = await prisma.user.findFirst({
      where: { firmId, role: 'FIRM_ADMIN', isActive: true },
      select: { id: true }
    });
    if (adminUser) return adminUser.id;

    const anyUser = await prisma.user.findFirst({
      where: { firmId, isActive: true },
      select: { id: true }
    });
    if (anyUser) return anyUser.id;

    throw new Error('No active user found for firm to create benchmark configs');
  }

  async calculateMateriality(
    input: MaterialityCalculationInput,
    userRole: string,
    userName?: string
  ) {
    const benchmarkConfig = await prisma.materialityBenchmarkConfig.findFirst({
      where: {
        firmId: input.firmId,
        benchmarkType: input.primaryBenchmarkType,
        isActive: true
      }
    });

    if (!benchmarkConfig) {
      throw new Error(`No active benchmark configuration found for type: ${input.primaryBenchmarkType}`);
    }

    if (input.appliedPercentage < Number(benchmarkConfig.minPercentage) ||
        input.appliedPercentage > Number(benchmarkConfig.maxPercentage)) {
      throw new Error(
        `Selected percentage ${input.appliedPercentage}% is outside allowed range ` +
        `(${benchmarkConfig.minPercentage}% - ${benchmarkConfig.maxPercentage}%)`
      );
    }

    const overallMateriality = input.primaryBenchmarkValue * (input.appliedPercentage / 100);
    const performanceMaterialityPct = input.performanceMaterialityPct ?? 75;
    if (performanceMaterialityPct < 50 || performanceMaterialityPct > 75) {
      throw new Error('Performance Materiality percentage must be between 50% and 75% of Overall Materiality');
    }
    const performanceMateriality = overallMateriality * (performanceMaterialityPct / 100);

    const trivialThresholdPct = input.trivialThresholdPct ?? 5;
    if (trivialThresholdPct > 5) {
      throw new Error('Trivial Threshold cannot exceed 5% of Overall Materiality (ISA 450.A2)');
    }
    const trivialThreshold = overallMateriality * (trivialThresholdPct / 100);

    const existingCalc = await prisma.materialityCalculation.findFirst({
      where: {
        engagementId: input.engagementId,
        fiscalYear: input.fiscalYear,
        status: { notIn: ['SUPERSEDED'] }
      },
      orderBy: { version: 'desc' }
    });

    const version = existingCalc ? existingCalc.version + 1 : 1;

    if (existingCalc && existingCalc.status !== 'SUPERSEDED') {
      await prisma.materialityCalculation.update({
        where: { id: existingCalc.id },
        data: { status: 'SUPERSEDED' }
      });
    }

    const calculation = await prisma.materialityCalculation.create({
      data: {
        engagementId: input.engagementId,
        firmId: input.firmId,
        fiscalYear: input.fiscalYear,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        version,
        status: 'DRAFT',
        primaryBenchmarkId: benchmarkConfig.id,
        primaryBenchmarkType: input.primaryBenchmarkType,
        primaryBenchmarkValue: new Decimal(input.primaryBenchmarkValue),
        appliedPercentage: new Decimal(input.appliedPercentage),
        overallMateriality: new Decimal(overallMateriality),
        performanceMateriality: new Decimal(performanceMateriality),
        performanceMaterialityPct: new Decimal(performanceMaterialityPct),
        trivialThreshold: new Decimal(trivialThreshold),
        trivialThresholdPct: new Decimal(trivialThresholdPct),
        calculationNotes: input.calculationNotes,
        preparedById: input.userId,
        previousVersionId: existingCalc?.id
      }
    });

    await this.logAction({
      calculationId: calculation.id,
      engagementId: input.engagementId,
      action: 'MATERIALITY_CALCULATED',
      actionDescription: `Materiality calculated using ${input.primaryBenchmarkType} benchmark at ${input.appliedPercentage}%`,
      entityType: 'MaterialityCalculation',
      entityId: calculation.id,
      userId: input.userId,
      userRole,
      userName,
      newStatus: 'DRAFT',
      newValues: {
        overallMateriality,
        performanceMateriality,
        trivialThreshold,
        benchmarkType: input.primaryBenchmarkType,
        primaryBenchmarkValue: input.primaryBenchmarkValue,
        appliedPercentage: input.appliedPercentage
      }
    });

    return {
      ...calculation,
      overallMateriality: Number(calculation.overallMateriality),
      performanceMateriality: Number(calculation.performanceMateriality),
      trivialThreshold: Number(calculation.trivialThreshold),
      primaryBenchmarkValue: Number(calculation.primaryBenchmarkValue),
      appliedPercentage: Number(calculation.appliedPercentage),
      performanceMaterialityPct: Number(calculation.performanceMaterialityPct),
      trivialThresholdPct: Number(calculation.trivialThresholdPct)
    };
  }

  async submitForReview(
    calculationId: string,
    userId: string,
    userRole: string,
    userName?: string
  ) {
    const calculation = await prisma.materialityCalculation.findUnique({
      where: { id: calculationId }
    });

    if (!calculation) {
      throw new Error('Materiality calculation not found');
    }

    if (calculation.status !== 'DRAFT') {
      throw new Error('Only DRAFT calculations can be submitted for review');
    }

    const updated = await prisma.materialityCalculation.update({
      where: { id: calculationId },
      data: { status: 'PENDING_REVIEW' }
    });

    await this.logAction({
      calculationId,
      engagementId: calculation.engagementId,
      action: 'SUBMITTED_FOR_REVIEW',
      actionDescription: 'Materiality calculation submitted for review',
      entityType: 'MaterialityCalculation',
      entityId: calculationId,
      userId,
      userRole,
      userName,
      previousStatus: 'DRAFT',
      newStatus: 'PENDING_REVIEW'
    });

    return updated;
  }

  async reviewCalculation(
    calculationId: string,
    reviewerId: string,
    reviewerRole: string,
    reviewerName?: string,
    approved: boolean = true,
    comments?: string
  ) {
    const calculation = await prisma.materialityCalculation.findUnique({
      where: { id: calculationId }
    });

    if (!calculation) {
      throw new Error('Materiality calculation not found');
    }

    if (calculation.status !== 'PENDING_REVIEW') {
      throw new Error('Only PENDING_REVIEW calculations can be reviewed');
    }

    if (calculation.preparedById === reviewerId) {
      throw new Error('Preparer cannot review their own calculation (ISA 220 - Segregation of duties)');
    }

    const newStatus = approved ? 'REVIEWED' : 'DRAFT';

    const updated = await prisma.materialityCalculation.update({
      where: { id: calculationId },
      data: {
        status: newStatus,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        reviewerComments: comments
      }
    });

    await this.logAction({
      calculationId,
      engagementId: calculation.engagementId,
      action: approved ? 'REVIEWED_APPROVED' : 'REVIEWED_REJECTED',
      actionDescription: approved 
        ? 'Materiality calculation reviewed and approved for partner approval'
        : `Materiality calculation rejected: ${comments || 'No comments provided'}`,
      entityType: 'MaterialityCalculation',
      entityId: calculationId,
      userId: reviewerId,
      userRole: reviewerRole,
      userName: reviewerName,
      previousStatus: 'PENDING_REVIEW',
      newStatus
    });

    return updated;
  }

  async submitForApproval(
    calculationId: string,
    userId: string,
    userRole: string,
    userName?: string
  ) {
    const calculation = await prisma.materialityCalculation.findUnique({
      where: { id: calculationId }
    });

    if (!calculation) {
      throw new Error('Materiality calculation not found');
    }

    if (calculation.status !== 'REVIEWED') {
      throw new Error('Only REVIEWED calculations can be submitted for approval');
    }

    const updated = await prisma.materialityCalculation.update({
      where: { id: calculationId },
      data: { status: 'PENDING_APPROVAL' }
    });

    await this.logAction({
      calculationId,
      engagementId: calculation.engagementId,
      action: 'SUBMITTED_FOR_APPROVAL',
      actionDescription: 'Materiality calculation submitted for partner approval',
      entityType: 'MaterialityCalculation',
      entityId: calculationId,
      userId,
      userRole,
      userName,
      previousStatus: 'REVIEWED',
      newStatus: 'PENDING_APPROVAL'
    });

    return updated;
  }

  async approveCalculation(
    calculationId: string,
    partnerId: string,
    partnerRole: string,
    partnerName?: string,
    signOffPin?: string
  ) {
    const calculation = await prisma.materialityCalculation.findUnique({
      where: { id: calculationId }
    });

    if (!calculation) {
      throw new Error('Materiality calculation not found');
    }

    if (calculation.status !== 'PENDING_APPROVAL') {
      throw new Error('Only PENDING_APPROVAL calculations can be approved');
    }

    if (calculation.preparedById === partnerId) {
      throw new Error('Preparer cannot approve their own calculation (ISA 220)');
    }

    if (calculation.reviewedById === partnerId) {
      throw new Error('Reviewer cannot approve the same calculation (ISA 220)');
    }

    if (!['PARTNER', 'FIRM_ADMIN'].includes(partnerRole)) {
      throw new Error('Only Partners can approve materiality calculations');
    }

    if (!signOffPin || signOffPin.length < 4) {
      throw new Error('Partner sign-off PIN is required for approval (minimum 4 characters)');
    }

    const partner = await prisma.user.findUnique({
      where: { id: partnerId },
      select: { id: true, partnerPin: true }
    });

    if (!partner?.partnerPin) {
      throw new Error('Partner sign-off PIN not configured. Please configure your PIN in user settings before approving.');
    }

    const hashedInputPin = crypto.createHash('sha256').update(signOffPin).digest('hex');
    if (hashedInputPin !== partner.partnerPin) {
      throw new Error('Invalid partner sign-off PIN');
    }

    const updated = await prisma.materialityCalculation.update({
      where: { id: calculationId },
      data: {
        status: 'APPROVED',
        approvedById: partnerId,
        approvedAt: new Date(),
        partnerSignOffId: partnerId,
        partnerSignOffPin: signOffPin,
        partnerSignOffAt: new Date()
      }
    });

    await this.logAction({
      calculationId,
      engagementId: calculation.engagementId,
      action: 'PARTNER_APPROVED',
      actionDescription: 'Materiality calculation approved by partner with digital sign-off',
      entityType: 'MaterialityCalculation',
      entityId: calculationId,
      userId: partnerId,
      userRole: partnerRole,
      userName: partnerName,
      previousStatus: 'PENDING_APPROVAL',
      newStatus: 'APPROVED',
      partnerSignOff: true
    });

    return updated;
  }

  async applyOverride(input: OverrideInput, userName?: string) {
    const calculation = await prisma.materialityCalculation.findUnique({
      where: { id: input.calculationId }
    });

    if (!calculation) {
      throw new Error('Materiality calculation not found');
    }

    if (calculation.status !== 'APPROVED') {
      throw new Error('Only APPROVED calculations can have overrides applied');
    }

    const partner = await prisma.user.findUnique({
      where: { id: input.partnerApprovedById },
      select: { id: true, role: true, partnerPin: true }
    });

    if (!partner || !['PARTNER', 'FIRM_ADMIN'].includes(partner.role)) {
      throw new Error('Only Partners can approve materiality overrides');
    }

    if (!input.partnerSignOffPin || input.partnerSignOffPin.length < 4) {
      throw new Error('Partner sign-off PIN is required for override approval (minimum 4 characters)');
    }

    if (!partner.partnerPin) {
      throw new Error('Partner sign-off PIN not configured. Please configure your PIN in user settings before approving overrides.');
    }

    const hashedInputPin = crypto.createHash('sha256').update(input.partnerSignOffPin).digest('hex');
    if (hashedInputPin !== partner.partnerPin) {
      throw new Error('Invalid partner sign-off PIN');
    }

    const fieldOverridden = input.overrideType === 'OVERALL_MATERIALITY' 
      ? 'overallMateriality' 
      : input.overrideType === 'PERFORMANCE_MATERIALITY' 
        ? 'performanceMateriality' 
        : 'trivialThreshold';

    const override = await prisma.materialityOverride.create({
      data: {
        calculationId: input.calculationId,
        engagementId: calculation.engagementId,
        overrideType: input.overrideType,
        fieldOverridden,
        originalValue: new Decimal(input.originalValue),
        overriddenValue: new Decimal(input.overriddenValue),
        justification: input.justification,
        riskBasedRationale: input.riskBasedRationale,
        partnerApprovedById: input.partnerApprovedById,
        partnerApprovedAt: new Date(),
        partnerSignOffPin: input.partnerSignOffPin
      }
    });

    const updateData: Record<string, Decimal | boolean> = { hasOverride: true };
    if (input.overrideType === 'OVERALL_MATERIALITY') {
      updateData.overallMateriality = new Decimal(input.overriddenValue);
    } else if (input.overrideType === 'PERFORMANCE_MATERIALITY') {
      updateData.performanceMateriality = new Decimal(input.overriddenValue);
    } else if (input.overrideType === 'TRIVIAL_THRESHOLD') {
      updateData.trivialThreshold = new Decimal(input.overriddenValue);
    }

    await prisma.materialityCalculation.update({
      where: { id: input.calculationId },
      data: updateData
    });

    await this.logAction({
      calculationId: input.calculationId,
      engagementId: calculation.engagementId,
      action: 'OVERRIDE_APPLIED',
      actionDescription: `${input.overrideType} overridden from ${input.originalValue} to ${input.overriddenValue}`,
      entityType: 'MaterialityOverride',
      entityId: override.id,
      userId: input.partnerApprovedById,
      userRole: partner.role,
      userName,
      overrideApplied: true,
      overrideJustification: input.justification,
      partnerSignOff: true,
      previousValues: { [input.overrideType]: input.originalValue },
      newValues: { [input.overrideType]: input.overriddenValue }
    });

    return override;
  }

  async publishToEngagement(
    calculationId: string,
    publisherId: string,
    publisherRole: string,
    publisherName?: string
  ) {
    const calculation = await prisma.materialityCalculation.findUnique({
      where: { id: calculationId }
    });

    if (!calculation) {
      throw new Error('Materiality calculation not found');
    }

    if (calculation.status !== 'APPROVED') {
      throw new Error('Only APPROVED calculations can be published');
    }

    if (!['PARTNER', 'FIRM_ADMIN'].includes(publisherRole)) {
      throw new Error('Only Partners can publish materiality thresholds');
    }

    const updated = await prisma.materialityCalculation.update({
      where: { id: calculationId },
      data: {
        publishedAt: new Date(),
        publishedById: publisherId
      }
    });

    await this.logAction({
      calculationId,
      engagementId: calculation.engagementId,
      action: 'PUBLISHED',
      actionDescription: `Materiality thresholds published: OM=${Number(calculation.overallMateriality)}, PM=${Number(calculation.performanceMateriality)}, Trivial=${Number(calculation.trivialThreshold)}. Propagated to risk assessments, sampling, and variance flags.`,
      entityType: 'MaterialityCalculation',
      entityId: calculationId,
      userId: publisherId,
      userRole: publisherRole,
      userName: publisherName,
      previousStatus: 'APPROVED',
      newStatus: 'APPROVED',
      newValues: {
        overallMateriality: Number(calculation.overallMateriality),
        performanceMateriality: Number(calculation.performanceMateriality),
        trivialThreshold: Number(calculation.trivialThreshold),
        propagatedToRiskAssessments: true,
        propagatedToSampling: true,
        propagatedToVarianceFlags: true
      }
    });

    return updated;
  }

  async getPublishedMateriality(engagementId: string, fiscalYear?: number) {
    const whereClause: Record<string, unknown> = {
      engagementId,
      status: 'PUBLISHED',
      isPublished: true
    };

    if (fiscalYear) {
      whereClause.fiscalYear = fiscalYear;
    }

    const calculation = await prisma.materialityCalculation.findFirst({
      where: whereClause,
      orderBy: { publishedAt: 'desc' },
      include: {
        overrides: true,
        preparedBy: { select: { id: true, fullName: true, email: true } },
        reviewedBy: { select: { id: true, fullName: true, email: true } },
        approvedBy: { select: { id: true, fullName: true, email: true } },
        publishedBy: { select: { id: true, fullName: true, email: true } }
      }
    });

    if (!calculation) {
      return null;
    }

    return {
      ...calculation,
      overallMateriality: Number(calculation.overallMateriality),
      performanceMateriality: Number(calculation.performanceMateriality),
      trivialThreshold: Number(calculation.trivialThreshold),
      primaryBenchmarkValue: Number(calculation.primaryBenchmarkValue),
      appliedPercentage: Number(calculation.appliedPercentage),
      performanceMaterialityPct: Number(calculation.performanceMaterialityPct),
      trivialThresholdPct: Number(calculation.trivialThresholdPct)
    };
  }

  async evaluateMisstatement(
    misstatementId: string,
    misstatementAmount: number,
    engagementId: string
  ) {
    const materiality = await this.getPublishedMateriality(engagementId);

    if (!materiality) {
      throw new Error('No published materiality found for this engagement');
    }

    const isAboveTrivialThreshold = misstatementAmount > materiality.trivialThreshold;
    const isAbovePM = misstatementAmount > materiality.performanceMateriality;
    const isAboveOverallMateriality = misstatementAmount > materiality.overallMateriality;

    await prisma.misstatement.update({
      where: { id: misstatementId },
      data: {
        materialityCalculationId: materiality.id,
        isAboveTrivialThreshold,
        isAbovePM,
        isAboveOverallMateriality
      }
    });

    return {
      misstatementId,
      misstatementAmount,
      thresholds: {
        trivialThreshold: materiality.trivialThreshold,
        performanceMateriality: materiality.performanceMateriality,
        overallMateriality: materiality.overallMateriality
      },
      evaluation: {
        isAboveTrivialThreshold,
        isAbovePM,
        isAboveOverallMateriality,
        classification: isAboveOverallMateriality 
          ? 'MATERIAL' 
          : isAbovePM 
            ? 'SIGNIFICANT' 
            : isAboveTrivialThreshold 
              ? 'CLEARLY_TRIVIAL_EXCEEDED'
              : 'CLEARLY_TRIVIAL'
      }
    };
  }

  async getMisstatementSummary(engagementId: string, calculationId?: string) {
    const whereClause: Record<string, unknown> = { engagementId };
    if (calculationId) {
      whereClause.materialityCalculationId = calculationId;
    }

    const misstatements = await prisma.misstatement.findMany({
      where: whereClause,
      orderBy: { identifiedDate: 'desc' }
    });

    const summary = {
      total: misstatements.length,
      adjusted: misstatements.filter(m => m.status === 'ADJUSTED').length,
      unadjusted: misstatements.filter(m => m.status === 'UNADJUSTED').length,
      waived: misstatements.filter(m => m.status === 'WAIVED').length,
      identified: misstatements.filter(m => m.status === 'IDENTIFIED').length,
      aboveTrivialThreshold: misstatements.filter(m => m.isAboveTrivialThreshold).length,
      abovePM: misstatements.filter(m => m.isAbovePM).length,
      aboveOverallMateriality: misstatements.filter(m => m.isAboveOverallMateriality).length,
      totalUnadjustedAmount: misstatements
        .filter(m => m.status === 'UNADJUSTED')
        .reduce((sum, m) => sum + Number(m.misstatementAmount || 0), 0),
      byType: {
        FACTUAL: misstatements.filter(m => m.misstatementType === 'FACTUAL').length,
        JUDGMENTAL: misstatements.filter(m => m.misstatementType === 'JUDGMENTAL').length,
        PROJECTED: misstatements.filter(m => m.misstatementType === 'PROJECTED').length
      }
    };

    return {
      summary,
      misstatements: misstatements.map(m => ({
        ...m,
        misstatementAmount: Number(m.misstatementAmount),
        projectedMisstatement: m.projectedMisstatement ? Number(m.projectedMisstatement) : null
      }))
    };
  }

  async getCalculation(calculationId: string) {
    const calculation = await prisma.materialityCalculation.findUnique({
      where: { id: calculationId },
      include: {
        primaryBenchmark: true,
        overrides: true,
        preparedBy: { select: { id: true, fullName: true, email: true } },
        reviewedBy: { select: { id: true, fullName: true, email: true } },
        approvedBy: { select: { id: true, fullName: true, email: true } },
        publishedBy: { select: { id: true, fullName: true, email: true } },
        auditLogs: {
          orderBy: { createdAt: 'desc' },
          take: 50
        }
      }
    });

    if (!calculation) {
      return null;
    }

    return {
      ...calculation,
      overallMateriality: Number(calculation.overallMateriality),
      performanceMateriality: Number(calculation.performanceMateriality),
      trivialThreshold: Number(calculation.trivialThreshold),
      primaryBenchmarkValue: Number(calculation.primaryBenchmarkValue),
      appliedPercentage: Number(calculation.appliedPercentage),
      performanceMaterialityPct: Number(calculation.performanceMaterialityPct),
      trivialThresholdPct: Number(calculation.trivialThresholdPct)
    };
  }

  async getCalculationsForEngagement(engagementId: string) {
    const calculations = await prisma.materialityCalculation.findMany({
      where: { engagementId },
      orderBy: [{ fiscalYear: 'desc' }, { version: 'desc' }],
      include: {
        preparedBy: { select: { id: true, fullName: true, email: true } },
        reviewedBy: { select: { id: true, fullName: true, email: true } },
        approvedBy: { select: { id: true, fullName: true, email: true } }
      }
    });

    return calculations.map(c => ({
      ...c,
      overallMateriality: Number(c.overallMateriality),
      performanceMateriality: Number(c.performanceMateriality),
      trivialThreshold: Number(c.trivialThreshold),
      primaryBenchmarkValue: Number(c.primaryBenchmarkValue),
      appliedPercentage: Number(c.appliedPercentage),
      performanceMaterialityPct: Number(c.performanceMaterialityPct),
      trivialThresholdPct: Number(c.trivialThresholdPct)
    }));
  }

  async getAuditLogs(calculationId: string) {
    return prisma.materialityAuditLog.findMany({
      where: { calculationId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, fullName: true, email: true } }
      }
    });
  }

  private async logAction(input: AuditLogInput) {
    await prisma.materialityAuditLog.create({
      data: {
        calculationId: input.calculationId,
        misstatementId: input.misstatementId,
        engagementId: input.engagementId,
        action: input.action,
        actionDescription: input.actionDescription,
        entityType: input.entityType,
        entityId: input.entityId,
        userId: input.userId,
        userRole: input.userRole,
        userName: input.userName,
        previousStatus: input.previousStatus,
        newStatus: input.newStatus,
        changedFields: input.changedFields ? JSON.stringify(input.changedFields) : undefined,
        previousValues: input.previousValues ? JSON.stringify(input.previousValues) : undefined,
        newValues: input.newValues ? JSON.stringify(input.newValues) : undefined,
        overrideApplied: input.overrideApplied ?? false,
        overrideJustification: input.overrideJustification,
        partnerSignOff: input.partnerSignOff ?? false,
        partnerSignOffPin: input.partnerSignOffPin,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent
      }
    });
  }
}

export const materialityService = new MaterialityService();
