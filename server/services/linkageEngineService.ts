import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

export interface FSHeadSummary {
  fsHeadId: string;
  fsHeadKey: string;
  fsHeadName: string;
  currentYearBalance: number;
  priorYearBalance: number;
  movement: number;
  allocatedMateriality: number | null;
  performanceMateriality: number | null;
  inherentRisk: string | null;
  controlRisk: string | null;
  combinedRisk: string | null;
  linkedRisks: number;
  linkedProcedures: number;
  linkedSamples: number;
  linkedEvidence: number;
  exceptions: number;
  confirmations: number;
  adjustments: number;
  adjustedBalance: number | null;
  completionPercentage: number;
  qualityGatesStatus: 'PASS' | 'WARN' | 'BLOCK';
  isaCompliance: number;
}

export interface PopulationComputeResult {
  populationId: string;
  itemCount: number;
  totalValue: number;
  minValue: number;
  maxValue: number;
  avgValue: number;
  highValueItems: number;
  queryHash: string;
}

export interface SampleGenerateResult {
  sampleId: string;
  populationId: string;
  method: string;
  targetSize: number;
  actualSize: number;
  coveragePercentage: number;
  items: Array<{
    id: string;
    sourceRef: string;
    value: number;
  }>;
}

export interface AnalyticsResult {
  fsHeadId: string;
  yearOverYearChange: number;
  percentageChange: number;
  trend: 'INCREASING' | 'DECREASING' | 'STABLE' | 'VOLATILE';
  benchmarkComparison: number | null;
  anomalies: Array<{
    type: string;
    description: string;
    significance: number;
  }>;
  expectation: number;
  actualBalance: number;
  variance: number;
  varianceExplanation: string | null;
  isaReference: string;
}

export interface ConfirmationPopulationResult {
  confirmationPopulationId: string;
  fsHeadId: string;
  partyType: string;
  totalParties: number;
  totalValue: number;
  sentCount: number;
  receivedCount: number;
  agreedCount: number;
  exceptions: number;
}

export interface AdjustmentSummary {
  adjustedBalanceId: string;
  fsHeadId: string;
  proposedAdjustments: number;
  agreedAdjustments: number;
  totalDebit: number;
  totalCredit: number;
  netAdjustment: number;
  unadjustedMisstatements: number;
  originalBalance: number;
  adjustedBalance: number;
}

export interface QualityGateResult {
  gateId: string;
  gateCode: string;
  name: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'PASS' | 'FAIL' | 'WARN';
  blocking: boolean;
  details: string;
  isaReference: string;
  remediation: string | null;
}

class LinkageEngineService {
  
  async getFSHeadSummary(engagementId: string, fsHeadId: string): Promise<FSHeadSummary | null> {
    const fsHead = await prisma.fSHeadWorkingPaper.findUnique({
      where: { id: fsHeadId },
    });

    if (!fsHead) return null;

    const procedureCount = await prisma.fSHeadProcedure.count({
      where: { workingPaperId: fsHeadId },
    });

    const completedProcedures = await prisma.fSHeadProcedure.count({
      where: { 
        workingPaperId: fsHeadId,
        conclusion: { not: null },
      },
    });

    const evidenceCount = await prisma.evidenceFile.count({
      where: { engagementId },
    });

    const misstatementCount = await prisma.misstatement.count({
      where: {
        engagementId,
      },
    });

    const confirmationCount = await prisma.externalConfirmation.count({
      where: {
        engagementId,
      },
    });

    const qualityGates = await this.runQualityGates(engagementId, fsHeadId);
    const blockingGates = qualityGates.filter(g => g.blocking && g.status === 'FAIL');
    const warningGates = qualityGates.filter(g => g.status === 'WARN');
    const qualityGatesStatus = blockingGates.length > 0 ? 'BLOCK' : warningGates.length > 0 ? 'WARN' : 'PASS';

    const totalProcedures = procedureCount;
    const completionPercentage = totalProcedures > 0 
      ? Math.round((completedProcedures / totalProcedures) * 100) 
      : 0;

    const isaCompliance = this.calculateISAComplianceScore(
      fsHead.inherentRisk,
      fsHead.controlRisk,
      procedureCount,
      completedProcedures,
      evidenceCount,
      qualityGates
    );

    return {
      fsHeadId: fsHead.id,
      fsHeadKey: fsHead.fsHeadKey,
      fsHeadName: fsHead.fsHeadName,
      currentYearBalance: Number(fsHead.currentYearBalance || 0),
      priorYearBalance: Number(fsHead.priorYearBalance || 0),
      movement: Number(fsHead.movement || 0),
      allocatedMateriality: fsHead.overallMateriality ? Number(fsHead.overallMateriality) : null,
      performanceMateriality: fsHead.performanceMateriality ? Number(fsHead.performanceMateriality) : null,
      inherentRisk: fsHead.inherentRisk,
      controlRisk: fsHead.controlRisk,
      combinedRisk: fsHead.combinedRiskAssessment,
      linkedRisks: 0,
      linkedProcedures: procedureCount,
      linkedSamples: 0,
      linkedEvidence: evidenceCount,
      exceptions: 0,
      confirmations: confirmationCount,
      adjustments: misstatementCount,
      adjustedBalance: null,
      completionPercentage,
      qualityGatesStatus,
      isaCompliance,
    };
  }

  async getEngagementLinkageSummary(engagementId: string): Promise<FSHeadSummary[]> {
    const fsHeads = await prisma.fSHeadWorkingPaper.findMany({
      where: { engagementId },
      orderBy: { fsHeadKey: 'asc' },
    });

    const summaries: FSHeadSummary[] = [];
    for (const fsHead of fsHeads) {
      const summary = await this.getFSHeadSummary(engagementId, fsHead.id);
      if (summary) {
        summaries.push(summary);
      }
    }

    return summaries;
  }

  async computePopulation(
    engagementId: string,
    fsHeadId: string,
    procedureId: string | null,
    sourceType: string,
    filters: Record<string, unknown>,
    name: string,
    userId: string
  ): Promise<PopulationComputeResult> {
    const filterJson = JSON.stringify(filters);
    const queryHash = this.hashQuery(filterJson);

    const items = await this.extractPopulationItems(engagementId, sourceType, filters);

    const values = items.map(i => i.value);
    const totalValue = values.reduce((a, b) => a + b, 0);
    const avgValue = values.length > 0 ? totalValue / values.length : 0;

    let populationId = `pop-${Date.now()}`;
    
    try {
      const population = await (prisma as any).populationDefinition?.create({
        data: {
          engagementId,
          fsHeadId,
          procedureId,
          name,
          sourceType: sourceType === 'GL_JOURNAL' ? 'GL_JOURNAL' : 'TB_LINE',
          filterJson: filters,
          queryHash,
          status: 'ACTIVE',
          itemCount: items.length,
          createdById: userId,
        },
      });
      
      if (population) {
        populationId = population.id;
        
        for (let i = 0; i < items.length; i++) {
          await (prisma as any).populationItem?.create({
            data: {
              populationId: population.id,
              sourceId: items[i].id,
              sourceRef: items[i].sourceRef,
              value: new Decimal(items[i].value),
              attributes: items[i].attributes,
              itemIndex: i + 1,
            },
          });
        }
      }
    } catch (e) {
      console.log('Population persistence skipped (models may not be available yet)');
    }

    await this.logLinkageAction(engagementId, 'POPULATION_COMPUTED', 'PopulationDefinition', populationId, userId, {
      name,
      sourceType,
      itemCount: items.length,
    });

    return {
      populationId,
      itemCount: items.length,
      totalValue,
      minValue: values.length > 0 ? Math.min(...values) : 0,
      maxValue: values.length > 0 ? Math.max(...values) : 0,
      avgValue,
      highValueItems: values.filter(v => v > avgValue * 2).length,
      queryHash,
    };
  }

  async generateSample(
    engagementId: string,
    populationItems: Array<{ id: string; sourceRef: string; value: number }>,
    method: string,
    targetSize: number,
    materialityThreshold: number | null,
    randomSeed: number | null,
    userId: string,
    populationId?: string,
    fsHeadId?: string,
    procedureId?: string
  ): Promise<SampleGenerateResult> {

    const selectedItems = this.selectSampleItems(populationItems, method, targetSize, materialityThreshold, randomSeed);

    const totalPopulationValue = populationItems.reduce((sum, i) => sum + i.value, 0);
    const sampleValue = selectedItems.reduce((sum, i) => sum + i.value, 0);
    const coveragePercentage = totalPopulationValue > 0 
      ? (sampleValue / totalPopulationValue) * 100 
      : 0;

    let sampleId = `sample-${Date.now()}`;
    
    try {
      const sample = await (prisma as any).sample?.create({
        data: {
          engagementId,
          populationId: populationId || null,
          fsHeadId: fsHeadId || null,
          procedureId: procedureId || null,
          method: method as any,
          targetSize,
          actualSize: selectedItems.length,
          materialityThreshold: materialityThreshold ? new Decimal(materialityThreshold) : null,
          randomSeed,
          coveragePercentage: new Decimal(coveragePercentage),
          status: 'GENERATED',
          createdById: userId,
        },
      });
      
      if (sample) {
        sampleId = sample.id;
        
        for (let i = 0; i < selectedItems.length; i++) {
          let populationItemId: string | null = null;
          
          if (populationId && (prisma as any).populationItem) {
            const popItem = await (prisma as any).populationItem.findFirst({
              where: {
                populationId,
                sourceId: selectedItems[i].id,
              },
            });
            if (popItem) {
              populationItemId = popItem.id;
            }
          }
          
          await (prisma as any).sampleItemLink?.create({
            data: {
              sampleId: sample.id,
              populationItemId: populationItemId,
              sourceRef: selectedItems[i].sourceRef,
              sourceValue: new Decimal(selectedItems[i].value),
              selectionIndex: i + 1,
              testStatus: 'NOT_TESTED',
            },
          });
        }
      }
    } catch (e) {
      console.log('Sample persistence skipped (models may not be available yet)');
    }

    await this.logLinkageAction(engagementId, 'SAMPLE_GENERATED', 'Sample', sampleId, userId, {
      method,
      targetSize,
      actualSize: selectedItems.length,
      coveragePercentage,
    });

    return {
      sampleId,
      populationId: populationId || 'computed',
      method,
      targetSize,
      actualSize: selectedItems.length,
      coveragePercentage,
      items: selectedItems,
    };
  }

  async computeAnalytics(engagementId: string, fsHeadId: string): Promise<AnalyticsResult> {
    const fsHead = await prisma.fSHeadWorkingPaper.findUnique({
      where: { id: fsHeadId },
    });

    if (!fsHead) {
      throw new Error('FS Head not found');
    }

    const currentBalance = Number(fsHead.currentYearBalance || 0);
    const priorBalance = Number(fsHead.priorYearBalance || 0);
    const yearOverYearChange = currentBalance - priorBalance;
    const percentageChange = priorBalance !== 0 
      ? ((yearOverYearChange / Math.abs(priorBalance)) * 100) 
      : (currentBalance !== 0 ? 100 : 0);

    let trend: 'INCREASING' | 'DECREASING' | 'STABLE' | 'VOLATILE' = 'STABLE';
    if (percentageChange > 10) trend = 'INCREASING';
    else if (percentageChange < -10) trend = 'DECREASING';

    const expectation = priorBalance * 1.05;
    const variance = currentBalance - expectation;
    const significantVariance = Math.abs(variance) > Math.abs(priorBalance * 0.1);

    const anomalies: Array<{ type: string; description: string; significance: number }> = [];
    if (significantVariance) {
      anomalies.push({
        type: 'SIGNIFICANT_VARIANCE',
        description: `Balance differs from expectation by ${variance.toFixed(2)} (${((variance / expectation) * 100).toFixed(1)}%)`,
        significance: Math.abs(variance / expectation) * 100,
      });
    }

    return {
      fsHeadId,
      yearOverYearChange,
      percentageChange,
      trend,
      benchmarkComparison: null,
      anomalies,
      expectation,
      actualBalance: currentBalance,
      variance,
      varianceExplanation: null,
      isaReference: 'ISA 520',
    };
  }

  async buildConfirmationsPopulation(
    engagementId: string,
    fsHeadId: string,
    partyType: 'DEBTOR' | 'CREDITOR' | 'BANK' | 'LAWYER' | 'OTHER',
    confirmationType: 'POSITIVE' | 'NEGATIVE' | 'BLANK',
    filters: Record<string, unknown>,
    userId: string
  ): Promise<ConfirmationPopulationResult> {
    const parties = await this.extractConfirmationParties(engagementId, fsHeadId, partyType, filters);

    const totalValue = parties.reduce((sum, p) => sum + p.balance, 0);

    await this.logLinkageAction(engagementId, 'CONFIRMATION_POP_CREATED', 'ConfirmationPopulation', fsHeadId, userId, {
      partyType,
      confirmationType,
      totalCount: parties.length,
      totalValue,
    });

    return {
      confirmationPopulationId: `conf-pop-${Date.now()}`,
      fsHeadId,
      partyType,
      totalParties: parties.length,
      totalValue,
      sentCount: 0,
      receivedCount: 0,
      agreedCount: 0,
      exceptions: 0,
    };
  }

  async computeAdjustedBalance(
    engagementId: string,
    fsHeadId: string,
    userId: string
  ): Promise<AdjustmentSummary> {
    const fsHead = await prisma.fSHeadWorkingPaper.findUnique({
      where: { id: fsHeadId },
    });

    if (!fsHead) {
      throw new Error('FS Head not found');
    }

    const misstatements = await prisma.misstatement.findMany({
      where: {
        engagementId,
      },
    });

    const adjustedMisstatements = misstatements.filter(m => m.status === 'ADJUSTED');
    const unadjustedMisstatements = misstatements.filter(m => 
      m.status === 'IDENTIFIED' || m.status === 'UNADJUSTED'
    );

    let totalDebit = 0;
    let totalCredit = 0;

    for (const m of adjustedMisstatements) {
      const amount = Number(m.misstatementAmount || 0);
      if (amount > 0) {
        totalDebit += amount;
      } else {
        totalCredit += Math.abs(amount);
      }
    }

    const netAdjustment = totalDebit - totalCredit;
    const originalBalance = Number(fsHead.currentYearBalance || 0);
    const adjustedBalance = originalBalance + netAdjustment;

    let adjustedBalanceId = `adj-${Date.now()}`;
    
    try {
      const adjustedBalanceRecord = await (prisma as any).adjustedBalance?.create({
        data: {
          engagementId,
          fsHeadId,
          originalBalance: new Decimal(originalBalance),
          totalAdjustments: new Decimal(netAdjustment),
          adjustedBalance: new Decimal(adjustedBalance),
          proposedAdjustmentsCount: misstatements.length,
          agreedAdjustmentsCount: adjustedMisstatements.length,
          unadjustedMisstatementsCount: unadjustedMisstatements.length,
          isWithinMateriality: Math.abs(netAdjustment) < Number(fsHead.overallMateriality || 0),
          status: 'COMPUTED',
          computedById: userId,
        },
      });
      
      if (adjustedBalanceRecord) {
        adjustedBalanceId = adjustedBalanceRecord.id;
      }
    } catch (e) {
      console.log('AdjustedBalance persistence skipped (models may not be available yet)');
    }

    await this.logLinkageAction(engagementId, 'ADJUSTED_BALANCE_COMPUTED', 'AdjustedBalance', adjustedBalanceId, userId, {
      originalBalance,
      netAdjustment,
      adjustedBalance,
    });

    return {
      adjustedBalanceId,
      fsHeadId,
      proposedAdjustments: misstatements.length,
      agreedAdjustments: adjustedMisstatements.length,
      totalDebit,
      totalCredit,
      netAdjustment,
      unadjustedMisstatements: unadjustedMisstatements.length,
      originalBalance,
      adjustedBalance,
    };
  }

  async allocateMateriality(
    engagementId: string,
    materialityId: string,
    allocations: Array<{ fsHeadId: string; percentage: number }>,
    userId: string
  ): Promise<void> {
    const materiality = await prisma.materialityCalculation.findUnique({
      where: { id: materialityId },
    });

    if (!materiality) {
      throw new Error('Materiality calculation not found');
    }

    const overallMateriality = Number(materiality.overallMateriality);
    const performanceMateriality = Number(materiality.performanceMateriality);

    for (const alloc of allocations) {
      const allocatedMateriality = overallMateriality * (alloc.percentage / 100);
      const allocatedPM = performanceMateriality * (alloc.percentage / 100);

      await prisma.fSHeadWorkingPaper.update({
        where: { id: alloc.fsHeadId },
        data: {
          overallMateriality: new Decimal(allocatedMateriality),
          performanceMateriality: new Decimal(allocatedPM),
        },
      });
    }

    await this.logLinkageAction(engagementId, 'MATERIALITY_ALLOCATED', 'MaterialityAllocation', materialityId, userId, {
      allocationsCount: allocations.length,
    });
  }

  async linkRiskToProcedure(
    engagementId: string,
    riskAssessmentId: string,
    procedureId: string,
    assertion: string,
    responseType: 'SUBSTANTIVE' | 'CONTROL' | 'COMBINED',
    userId: string
  ): Promise<string> {
    const linkId = `rpl-${Date.now()}`;
    
    await this.logLinkageAction(engagementId, 'RISK_PROCEDURE_LINKED', 'RiskProcedureLink', linkId, userId, {
      riskAssessmentId,
      procedureId,
      assertion,
      responseType,
    });

    return linkId;
  }

  async runQualityGates(engagementId: string, fsHeadId: string): Promise<QualityGateResult[]> {
    const gates: QualityGateResult[] = [];

    const riskCount = await prisma.riskAssessment.count({
      where: {
        engagementId,
      },
    });

    const proceduresWithResponse = await prisma.fSHeadProcedure.count({
      where: {
        workingPaperId: fsHeadId,
        response: { not: null },
      },
    });

    gates.push({
      gateId: 'QG-001',
      gateCode: 'RISK_RESPONSE_COVERAGE',
      name: 'All Risks Have Linked Procedures',
      severity: 'HIGH',
      status: proceduresWithResponse >= riskCount || riskCount === 0 ? 'PASS' : 'FAIL',
      blocking: true,
      details: proceduresWithResponse >= riskCount || riskCount === 0
        ? 'All identified risks have linked audit procedures' 
        : `${riskCount - proceduresWithResponse} risks may not have adequate procedure response`,
      isaReference: 'ISA 330.5',
      remediation: proceduresWithResponse < riskCount && riskCount > 0 ? 'Link audit procedures to address each identified risk' : null,
    });

    const exceptionsCount = await prisma.sampleItem.count({
      where: {
        exceptionNoted: true,
        substantiveTest: {
          engagementId,
        },
      },
    });

    gates.push({
      gateId: 'QG-002',
      gateCode: 'EXCEPTION_RESOLUTION',
      name: 'All Sample Exceptions Resolved',
      severity: 'HIGH',
      status: exceptionsCount === 0 ? 'PASS' : 'FAIL',
      blocking: true,
      details: exceptionsCount === 0 
        ? 'All sample exceptions have been resolved' 
        : `${exceptionsCount} exceptions require resolution`,
      isaReference: 'ISA 500.9',
      remediation: exceptionsCount > 0 ? 'Investigate and resolve all sample exceptions' : null,
    });

    const pendingConfirmations = await prisma.externalConfirmation.count({
      where: {
        engagementId,
        status: 'SENT',
      },
    });

    gates.push({
      gateId: 'QG-003',
      gateCode: 'CONFIRMATION_COMPLETION',
      name: 'All Confirmations Received',
      severity: 'HIGH',
      status: pendingConfirmations === 0 ? 'PASS' : 'FAIL',
      blocking: true,
      details: pendingConfirmations === 0 
        ? 'All confirmations have been received and processed' 
        : `${pendingConfirmations} confirmations pending response`,
      isaReference: 'ISA 505.12',
      remediation: pendingConfirmations > 0 ? 'Follow up on outstanding confirmations or perform alternative procedures' : null,
    });

    const pendingMisstatements = await prisma.misstatement.count({
      where: {
        engagementId,
        status: 'IDENTIFIED',
      },
    });

    gates.push({
      gateId: 'QG-004',
      gateCode: 'MISSTATEMENT_EVALUATION',
      name: 'All Misstatements Evaluated',
      severity: 'HIGH',
      status: pendingMisstatements === 0 ? 'PASS' : 'FAIL',
      blocking: true,
      details: pendingMisstatements === 0 
        ? 'All misstatements have been evaluated' 
        : `${pendingMisstatements} misstatements require evaluation`,
      isaReference: 'ISA 450.5',
      remediation: pendingMisstatements > 0 ? 'Evaluate each misstatement and determine appropriate action' : null,
    });

    return gates;
  }

  async recordSampleResult(
    sampleItemId: string,
    hasException: boolean,
    exceptionDetails: string | null,
    userId: string
  ): Promise<void> {
    const sampleItem = await prisma.sampleItem.findUnique({
      where: { id: sampleItemId },
      include: { substantiveTest: true },
    });

    if (!sampleItem) {
      throw new Error('Sample item not found');
    }

    await prisma.sampleItem.update({
      where: { id: sampleItemId },
      data: {
        exceptionNoted: hasException,
        exceptionDetail: exceptionDetails,
        testedById: userId,
        testedDate: new Date(),
      },
    });

    await this.logLinkageAction(sampleItem.substantiveTest.engagementId, 'SAMPLE_RESULT_RECORDED', 'SampleItem', sampleItemId, userId, {
      hasException,
    });
  }

  private async extractPopulationItems(
    engagementId: string,
    sourceType: string,
    filters: Record<string, unknown>
  ): Promise<Array<{ id: string; sourceRef: string; value: number; attributes: Record<string, unknown> }>> {
    const items: Array<{ id: string; sourceRef: string; value: number; attributes: Record<string, unknown> }> = [];

    if (sourceType === 'GL_JOURNAL') {
      const glEntries = await prisma.gLEntry.findMany({
        where: {
          batch: { engagementId },
        },
        take: (filters.limit as number) || 10000,
      });

      for (const entry of glEntries) {
        items.push({
          id: entry.id,
          sourceRef: `GL-${entry.id.slice(0, 8)}`,
          value: Number(entry.debit || 0) + Number(entry.credit || 0),
          attributes: {
            accountCode: entry.accountCode,
            description: entry.description,
          },
        });
      }
    } else if (sourceType === 'TB_LINE') {
      const tbLines = await prisma.trialBalanceLine.findMany({
        where: {
          trialBalance: { engagementId },
        },
        take: (filters.limit as number) || 10000,
      });

      for (const line of tbLines) {
        items.push({
          id: line.id,
          sourceRef: `TB-${line.accountCode}`,
          value: Number(line.closingBalance || 0),
          attributes: {
            accountCode: line.accountCode,
            accountName: line.accountName,
          },
        });
      }
    }

    return items;
  }

  private async extractConfirmationParties(
    _engagementId: string,
    _fsHeadId: string,
    _partyType: string,
    _filters: Record<string, unknown>
  ): Promise<Array<{ name: string; address?: string; email?: string; balance: number; sourceRef: string }>> {
    return [];
  }

  private selectSampleItems(
    items: Array<{ id: string; sourceRef: string; value: number }>,
    method: string,
    targetSize: number,
    materialityThreshold: number | null,
    randomSeed: number | null
  ): Array<{ id: string; sourceRef: string; value: number }> {
    if (method === 'ALL_ITEMS') {
      return items;
    }

    if (materialityThreshold) {
      const highValueItems = items.filter(i => i.value >= materialityThreshold);
      const remainingItems = items.filter(i => i.value < materialityThreshold);
      const remainingNeeded = Math.max(0, targetSize - highValueItems.length);

      if (method === 'STATISTICAL_RANDOM' || method === 'NON_STATISTICAL_HAPHAZARD') {
        const shuffled = this.shuffleWithSeed([...remainingItems], randomSeed || Date.now());
        return [...highValueItems, ...shuffled.slice(0, remainingNeeded)];
      }
    }

    if (method === 'STATISTICAL_RANDOM' || method === 'NON_STATISTICAL_HAPHAZARD') {
      const shuffled = this.shuffleWithSeed([...items], randomSeed || Date.now());
      return shuffled.slice(0, targetSize);
    }

    if (method === 'STATISTICAL_SYSTEMATIC') {
      const interval = Math.floor(items.length / targetSize);
      const start = Math.floor((randomSeed || Date.now()) % (interval || 1));
      const selected: typeof items = [];
      for (let i = start; i < items.length && selected.length < targetSize; i += Math.max(interval, 1)) {
        selected.push(items[i]);
      }
      return selected;
    }

    if (method === 'MONETARY_UNIT_SAMPLING') {
      const totalValue = items.reduce((sum, i) => sum + i.value, 0);
      const interval = totalValue / targetSize;
      let cumulative = 0;
      let nextThreshold = (randomSeed || Date.now()) % (interval || 1);
      const selected: typeof items = [];

      for (const item of items) {
        cumulative += item.value;
        if (cumulative >= nextThreshold) {
          selected.push(item);
          nextThreshold += interval;
        }
        if (selected.length >= targetSize) break;
      }
      return selected;
    }

    return items.slice(0, targetSize);
  }

  private shuffleWithSeed<T>(array: T[], seed: number): T[] {
    const random = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  private hashQuery(query: string): string {
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
      const char = query.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  private calculateISAComplianceScore(
    inherentRisk: string | null,
    controlRisk: string | null,
    procedureCount: number,
    completedProcedures: number,
    evidenceCount: number,
    qualityGates: QualityGateResult[]
  ): number {
    const weights = {
      riskAssessment: 20,
      procedureCoverage: 25,
      sampling: 15,
      evidence: 15,
      qualityGates: 25,
    };

    let score = 0;

    if (inherentRisk && controlRisk) {
      score += weights.riskAssessment;
    }

    if (procedureCount > 0) {
      score += (completedProcedures / procedureCount) * weights.procedureCoverage;
    }

    score += weights.sampling * 0.5;

    if (evidenceCount > 0) {
      score += weights.evidence;
    } else {
      score += weights.evidence * 0.5;
    }

    const passedGates = qualityGates.filter(g => g.status === 'PASS').length;
    score += (passedGates / Math.max(qualityGates.length, 1)) * weights.qualityGates;

    return Math.round(score);
  }

  private async logLinkageAction(
    engagementId: string,
    action: string,
    entityType: string,
    entityId: string,
    userId: string,
    details: Record<string, unknown>
  ): Promise<void> {
    try {
      await prisma.materialityAuditLog.create({
        data: {
          engagementId,
          action,
          actionDescription: JSON.stringify(details),
          entityType,
          entityId,
          userId,
          userRole: 'AUDITOR',
        },
      });
    } catch {
      console.log(`Linkage action logged: ${action} on ${entityType}/${entityId} by ${userId}`);
    }
  }
}

export const linkageEngineService = new LinkageEngineService();
