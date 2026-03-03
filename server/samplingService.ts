import { prisma } from "./db";
import type { SamplingMethod, GLEntry } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

interface ServiceContext {
  userId: string;
  userRole: string;
  userName?: string;
  firmId: string;
}

interface SamplingConfig {
  method: SamplingMethod;
  sampleSize: number;
  confidenceLevel?: number;
  materialityThreshold?: number;
  tolerableError?: number;
  expectedError?: number;
  randomSeed?: number;
  stratificationRanges?: { min: number; max: number; name: string }[];
  targetedCriteria?: {
    highValue?: boolean;
    highValueThreshold?: number;
    unusualJournals?: boolean;
    weekendPostings?: boolean;
    roundAmounts?: boolean;
    relatedPartyKeywords?: string[];
  };
}

interface SampledItem {
  glEntryId: string;
  itemNumber: number;
  selectionReason: string;
  voucherNumber: string | null;
  transactionDate: Date;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  amount: number;
  description: string | null;
  reference: string | null;
  stratum?: string;
  cumulativeValue?: number;
}

interface SamplingResult {
  runId: string;
  runNumber: number;
  method: SamplingMethod;
  populationCount: number;
  populationValue: number;
  sampleSize: number;
  sampleValue: number;
  coveragePercentage: number;
  samplingInterval?: number;
  items: SampledItem[];
  itemsNotSelectedCount: number;
}

class SamplingService {
  private seededRandom(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
  }

  async generateSample(
    engagementId: string,
    config: SamplingConfig,
    context: ServiceContext
  ): Promise<SamplingResult> {
    const glBatch = await prisma.gLBatch.findFirst({
      where: { engagementId, status: "APPROVED" },
      orderBy: { version: "desc" },
    });

    if (!glBatch) {
      throw new Error("No approved GL batch found for this engagement");
    }

    const allEntries = await prisma.gLEntry.findMany({
      where: { batchId: glBatch.id, hasErrors: false },
      orderBy: { transactionDate: "asc" },
    });

    if (allEntries.length === 0) {
      throw new Error("No valid GL entries found in the approved batch");
    }

    const population = allEntries.map((e) => ({
      ...e,
      amount: Math.abs(Number(e.debit) - Number(e.credit)),
    }));

    const populationValue = population.reduce((sum, e) => sum + e.amount, 0);
    const populationCount = population.length;

    let selectedItems: SampledItem[];
    let samplingInterval: number | undefined;

    switch (config.method) {
      case "MONETARY_UNIT_SAMPLING":
        const musResult = this.monetaryUnitSampling(population, config);
        selectedItems = musResult.items;
        samplingInterval = musResult.interval;
        break;
      case "STATISTICAL_RANDOM":
        selectedItems = this.randomSampling(population, config);
        break;
      case "STATISTICAL_SYSTEMATIC":
        const sysResult = this.systematicSampling(population, config);
        selectedItems = sysResult.items;
        samplingInterval = sysResult.interval;
        break;
      case "STATISTICAL_STRATIFIED":
        selectedItems = this.stratifiedSampling(population, config);
        break;
      case "NON_STATISTICAL_JUDGMENTAL":
        selectedItems = this.targetedSampling(population, config);
        break;
      default:
        selectedItems = this.randomSampling(population, config);
    }

    const sampleValue = selectedItems.reduce((sum, i) => sum + i.amount, 0);
    const coveragePercentage = populationValue > 0 ? (sampleValue / populationValue) * 100 : 0;

    const runNumber = await this.getNextRunNumber(engagementId);

    const samplingRun = await prisma.samplingRun.create({
      data: {
        engagementId,
        firmId: context.firmId,
        runNumber,
        runName: `${config.method} Sample - Run ${runNumber}`,
        samplingMethod: config.method,
        populationCount,
        populationValue: new Decimal(populationValue),
        sampleSize: selectedItems.length,
        sampleValue: new Decimal(sampleValue),
        coveragePercentage: new Decimal(coveragePercentage),
        confidenceLevel: config.confidenceLevel ? new Decimal(config.confidenceLevel) : null,
        materialityThreshold: config.materialityThreshold ? new Decimal(config.materialityThreshold) : null,
        tolerableError: config.tolerableError ? new Decimal(config.tolerableError) : null,
        expectedError: config.expectedError ? new Decimal(config.expectedError) : null,
        samplingInterval: samplingInterval ? new Decimal(samplingInterval) : null,
        targetedCriteria: config.targetedCriteria || null,
        stratificationRanges: config.stratificationRanges || null,
        randomSeed: config.randomSeed,
        createdById: context.userId,
      },
    });

    await prisma.samplingRunItem.createMany({
      data: selectedItems.map((item) => ({
        samplingRunId: samplingRun.id,
        glEntryId: item.glEntryId,
        itemNumber: item.itemNumber,
        selectionReason: item.selectionReason,
        voucherNumber: item.voucherNumber,
        transactionDate: item.transactionDate,
        accountCode: item.accountCode,
        accountName: item.accountName,
        debit: new Decimal(item.debit),
        credit: new Decimal(item.credit),
        amount: new Decimal(item.amount),
        description: item.description,
        reference: item.reference,
        stratum: item.stratum,
        cumulativeValue: item.cumulativeValue ? new Decimal(item.cumulativeValue) : null,
      })),
    });

    return {
      runId: samplingRun.id,
      runNumber,
      method: config.method,
      populationCount,
      populationValue,
      sampleSize: selectedItems.length,
      sampleValue,
      coveragePercentage,
      samplingInterval,
      items: selectedItems,
      itemsNotSelectedCount: populationCount - selectedItems.length,
    };
  }

  private monetaryUnitSampling(
    population: (GLEntry & { amount: number })[],
    config: SamplingConfig
  ): { items: SampledItem[]; interval: number } {
    const totalValue = population.reduce((sum, e) => sum + e.amount, 0);
    const sampleSize = Math.min(config.sampleSize, population.length);
    const interval = totalValue / sampleSize;

    const random = config.randomSeed ? this.seededRandom(config.randomSeed) : Math.random;
    const startingPoint = random() * interval;

    const items: SampledItem[] = [];
    let cumulativeValue = 0;
    let sampleNumber = 0;
    let nextSelection = startingPoint;

    for (const entry of population) {
      const previousCumulative = cumulativeValue;
      cumulativeValue += entry.amount;

      while (nextSelection <= cumulativeValue && sampleNumber < sampleSize) {
        sampleNumber++;
        items.push({
          glEntryId: entry.id,
          itemNumber: sampleNumber,
          selectionReason: `MUS: Selected at cumulative value ${nextSelection.toFixed(2)} (interval: ${interval.toFixed(2)})`,
          voucherNumber: entry.reference,
          transactionDate: entry.transactionDate,
          accountCode: entry.accountCode,
          accountName: entry.accountName,
          debit: Number(entry.debit),
          credit: Number(entry.credit),
          amount: entry.amount,
          description: entry.description,
          reference: entry.reference,
          cumulativeValue: nextSelection,
        });
        nextSelection += interval;
      }
    }

    return { items, interval };
  }

  private randomSampling(
    population: (GLEntry & { amount: number })[],
    config: SamplingConfig
  ): SampledItem[] {
    const sampleSize = Math.min(config.sampleSize, population.length);
    const random = config.randomSeed ? this.seededRandom(config.randomSeed) : Math.random;

    const shuffled = [...population].sort(() => random() - 0.5);
    const selected = shuffled.slice(0, sampleSize);

    return selected.map((entry, index) => ({
      glEntryId: entry.id,
      itemNumber: index + 1,
      selectionReason: "Random selection",
      voucherNumber: entry.reference,
      transactionDate: entry.transactionDate,
      accountCode: entry.accountCode,
      accountName: entry.accountName,
      debit: Number(entry.debit),
      credit: Number(entry.credit),
      amount: entry.amount,
      description: entry.description,
      reference: entry.reference,
    }));
  }

  private systematicSampling(
    population: (GLEntry & { amount: number })[],
    config: SamplingConfig
  ): { items: SampledItem[]; interval: number } {
    const sampleSize = Math.min(config.sampleSize, population.length);
    const interval = Math.floor(population.length / sampleSize);
    const random = config.randomSeed ? this.seededRandom(config.randomSeed) : Math.random;
    const startingPoint = Math.floor(random() * interval);

    const items: SampledItem[] = [];
    let sampleNumber = 0;

    for (let i = startingPoint; i < population.length && sampleNumber < sampleSize; i += interval) {
      const entry = population[i];
      sampleNumber++;
      items.push({
        glEntryId: entry.id,
        itemNumber: sampleNumber,
        selectionReason: `Systematic: Item ${i + 1} (interval: every ${interval}th item)`,
        voucherNumber: entry.reference,
        transactionDate: entry.transactionDate,
        accountCode: entry.accountCode,
        accountName: entry.accountName,
        debit: Number(entry.debit),
        credit: Number(entry.credit),
        amount: entry.amount,
        description: entry.description,
        reference: entry.reference,
      });
    }

    return { items, interval };
  }

  private stratifiedSampling(
    population: (GLEntry & { amount: number })[],
    config: SamplingConfig
  ): SampledItem[] {
    const ranges = config.stratificationRanges || [
      { min: 0, max: 10000, name: "Low (<10K)" },
      { min: 10000, max: 100000, name: "Medium (10K-100K)" },
      { min: 100000, max: 1000000, name: "High (100K-1M)" },
      { min: 1000000, max: Infinity, name: "Very High (>1M)" },
    ];

    const strata: Map<string, (GLEntry & { amount: number })[]> = new Map();
    for (const range of ranges) {
      strata.set(range.name, []);
    }

    for (const entry of population) {
      for (const range of ranges) {
        if (entry.amount >= range.min && entry.amount < range.max) {
          strata.get(range.name)?.push(entry);
          break;
        }
      }
    }

    const items: SampledItem[] = [];
    let sampleNumber = 0;
    const totalPopulation = population.length;
    const random = config.randomSeed ? this.seededRandom(config.randomSeed) : Math.random;

    for (const [stratumName, stratumEntries] of strata.entries()) {
      if (stratumEntries.length === 0) continue;

      const proportion = stratumEntries.length / totalPopulation;
      const stratumSampleSize = Math.max(1, Math.round(config.sampleSize * proportion));
      const actualSampleSize = Math.min(stratumSampleSize, stratumEntries.length);

      const shuffled = [...stratumEntries].sort(() => random() - 0.5);
      const selected = shuffled.slice(0, actualSampleSize);

      for (const entry of selected) {
        sampleNumber++;
        items.push({
          glEntryId: entry.id,
          itemNumber: sampleNumber,
          selectionReason: `Stratified: ${stratumName} (${stratumEntries.length} items in stratum)`,
          voucherNumber: entry.reference,
          transactionDate: entry.transactionDate,
          accountCode: entry.accountCode,
          accountName: entry.accountName,
          debit: Number(entry.debit),
          credit: Number(entry.credit),
          amount: entry.amount,
          description: entry.description,
          reference: entry.reference,
          stratum: stratumName,
        });
      }
    }

    return items;
  }

  private targetedSampling(
    population: (GLEntry & { amount: number })[],
    config: SamplingConfig
  ): SampledItem[] {
    const criteria = config.targetedCriteria || {};
    const items: SampledItem[] = [];
    let sampleNumber = 0;
    const selectedIds = new Set<string>();

    const addItem = (entry: GLEntry & { amount: number }, reason: string) => {
      if (selectedIds.has(entry.id) || items.length >= config.sampleSize) return;
      selectedIds.add(entry.id);
      sampleNumber++;
      items.push({
        glEntryId: entry.id,
        itemNumber: sampleNumber,
        selectionReason: reason,
        voucherNumber: entry.reference,
        transactionDate: entry.transactionDate,
        accountCode: entry.accountCode,
        accountName: entry.accountName,
        debit: Number(entry.debit),
        credit: Number(entry.credit),
        amount: entry.amount,
        description: entry.description,
        reference: entry.reference,
      });
    };

    if (criteria.highValue) {
      const threshold = criteria.highValueThreshold || 100000;
      for (const entry of population) {
        if (entry.amount >= threshold) {
          addItem(entry, `High value: Amount ${entry.amount.toLocaleString()} >= threshold ${threshold.toLocaleString()}`);
        }
      }
    }

    if (criteria.unusualJournals) {
      const journalPatterns = ["adj", "adjustment", "manual", "correction", "reversal", "reclassification"];
      for (const entry of population) {
        const desc = (entry.description || "").toLowerCase();
        const ref = (entry.reference || "").toLowerCase();
        if (journalPatterns.some((p) => desc.includes(p) || ref.includes(p))) {
          addItem(entry, `Unusual journal: Contains adjustment/manual/correction keywords`);
        }
      }
    }

    if (criteria.weekendPostings) {
      for (const entry of population) {
        const day = entry.transactionDate.getDay();
        if (day === 0 || day === 6) {
          addItem(entry, `Weekend posting: Posted on ${day === 0 ? "Sunday" : "Saturday"}`);
        }
      }
    }

    if (criteria.roundAmounts) {
      for (const entry of population) {
        if (entry.amount >= 1000 && entry.amount % 1000 === 0) {
          addItem(entry, `Round amount: ${entry.amount.toLocaleString()} is a round number`);
        }
      }
    }

    if (criteria.relatedPartyKeywords && criteria.relatedPartyKeywords.length > 0) {
      for (const entry of population) {
        const desc = (entry.description || "").toLowerCase();
        const counterparty = (entry.counterparty || "").toLowerCase();
        for (const keyword of criteria.relatedPartyKeywords) {
          if (desc.includes(keyword.toLowerCase()) || counterparty.includes(keyword.toLowerCase())) {
            addItem(entry, `Related party keyword: Contains "${keyword}"`);
            break;
          }
        }
      }
    }

    return items;
  }

  private async getNextRunNumber(engagementId: string): Promise<number> {
    const lastRun = await prisma.samplingRun.findFirst({
      where: { engagementId },
      orderBy: { runNumber: "desc" },
    });
    return (lastRun?.runNumber || 0) + 1;
  }

  async getSamplingRuns(engagementId: string) {
    return prisma.samplingRun.findMany({
      where: { engagementId },
      include: {
        createdBy: { select: { id: true, fullName: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getSamplingRunItems(runId: string) {
    const run = await prisma.samplingRun.findUnique({
      where: { id: runId },
      include: {
        createdBy: { select: { id: true, fullName: true } },
      },
    });

    if (!run) {
      throw new Error("Sampling run not found");
    }

    const items = await prisma.samplingRunItem.findMany({
      where: { samplingRunId: runId },
      orderBy: { itemNumber: "asc" },
    });

    return {
      run,
      items,
    };
  }

  async deleteSamplingRun(runId: string, context: ServiceContext) {
    const run = await prisma.samplingRun.findUnique({
      where: { id: runId },
    });

    if (!run) {
      throw new Error("Sampling run not found");
    }

    if (run.firmId !== context.firmId) {
      throw new Error("Unauthorized");
    }

    await prisma.samplingRun.delete({
      where: { id: runId },
    });

    return { success: true };
  }

  generateCSVExport(items: SampledItem[], firmName?: string): string {
    const headers = [
      "Item #",
      "Voucher Number",
      "Transaction Date",
      "Account Code",
      "Account Name",
      "Debit",
      "Credit",
      "Amount",
      "Description",
      "Selection Reason",
      "Stratum",
    ];

    const rows = items.map((item) => [
      item.itemNumber,
      item.voucherNumber || "",
      item.transactionDate ? new Date(item.transactionDate).toISOString().split("T")[0] : "",
      item.accountCode,
      item.accountName,
      item.debit,
      item.credit,
      item.amount,
      (item.description || "").replace(/"/g, '""'),
      (item.selectionReason || "").replace(/"/g, '""'),
      item.stratum || "",
    ]);

    const preamble = [
      `"${firmName || "AuditWise"}"`,
      `"Sampling Run Export"`,
      `"Generated: ${new Date().toLocaleDateString()}"`,
      "",
    ];

    return [...preamble, headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
  }
}

export const samplingService = new SamplingService();
