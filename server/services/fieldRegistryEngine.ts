import { prisma } from "../db";
import { Prisma } from "@prisma/client";
import crypto from "crypto";

export interface ComputedFieldResult {
  fieldCode: string;
  value: string | null;
  numericValue: number | null;
  sourceHash: string;
  success: boolean;
  error?: string;
}

function generateSourceHash(data: unknown): string {
  const str = JSON.stringify(data);
  return crypto.createHash("md5").update(str).digest("hex");
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

export async function computeFieldsForEngagement(
  engagementId: string,
  userId?: string
): Promise<ComputedFieldResult[]> {
  const results: ComputedFieldResult[] = [];
  
  const [tbResults, glResults, matResults, riskResults] = await Promise.all([
    computeTBFields(engagementId, userId),
    computeGLFields(engagementId, userId),
    computeMaterialityFields(engagementId, userId),
    computeRiskFields(engagementId, userId)
  ]);
  
  results.push(...tbResults, ...glResults, ...matResults, ...riskResults);
  
  return results;
}

export async function computeTBFields(
  engagementId: string,
  userId?: string
): Promise<ComputedFieldResult[]> {
  const results: ComputedFieldResult[] = [];
  
  const tbBatch = await prisma.tBBatch.findFirst({
    where: { engagementId, status: "APPROVED" },
    orderBy: { createdAt: "desc" },
    include: { entries: true }
  });
  
  if (!tbBatch) {
    return results;
  }
  
  const entries = tbBatch.entries;
  const sourceHash = generateSourceHash({ batchId: tbBatch.id, entryCount: entries.length });
  
  // TB_TOTAL_ASSETS
  const assets = entries.filter(e => 
    e.accountType?.toLowerCase().includes("asset") ||
    e.accountClass?.toLowerCase().includes("asset")
  );
  const totalAssets = assets.reduce((sum, e) => sum + Number(e.closingBalance || 0), 0);
  results.push(await storeComputedField(engagementId, "TB_TOTAL_ASSETS", formatCurrency(totalAssets), totalAssets, sourceHash, userId));
  
  // TB_TOTAL_LIABILITIES
  const liabilities = entries.filter(e => 
    e.accountType?.toLowerCase().includes("liability") ||
    e.accountClass?.toLowerCase().includes("liability")
  );
  const totalLiabilities = liabilities.reduce((sum, e) => sum + Math.abs(Number(e.closingBalance || 0)), 0);
  results.push(await storeComputedField(engagementId, "TB_TOTAL_LIABILITIES", formatCurrency(totalLiabilities), totalLiabilities, sourceHash, userId));
  
  // TB_TOTAL_EQUITY
  const equity = entries.filter(e => 
    e.accountType?.toLowerCase().includes("equity") ||
    e.accountClass?.toLowerCase().includes("equity")
  );
  const totalEquity = equity.reduce((sum, e) => sum + Math.abs(Number(e.closingBalance || 0)), 0);
  results.push(await storeComputedField(engagementId, "TB_TOTAL_EQUITY", formatCurrency(totalEquity), totalEquity, sourceHash, userId));
  
  // TB_TOTAL_REVENUE
  const revenue = entries.filter(e => 
    e.accountType?.toLowerCase().includes("income") ||
    e.accountType?.toLowerCase().includes("revenue") ||
    e.accountClass?.toLowerCase().includes("income")
  );
  const totalRevenue = revenue.reduce((sum, e) => sum + Math.abs(Number(e.closingBalance || 0)), 0);
  results.push(await storeComputedField(engagementId, "TB_TOTAL_REVENUE", formatCurrency(totalRevenue), totalRevenue, sourceHash, userId));
  
  // TB_NET_INCOME
  const expenses = entries.filter(e => 
    e.accountType?.toLowerCase().includes("expense") ||
    e.accountClass?.toLowerCase().includes("expense")
  );
  const totalExpenses = expenses.reduce((sum, e) => sum + Math.abs(Number(e.closingBalance || 0)), 0);
  const netIncome = totalRevenue - totalExpenses;
  results.push(await storeComputedField(engagementId, "TB_NET_INCOME", formatCurrency(netIncome), netIncome, sourceHash, userId));
  
  // TB_ACCOUNT_COUNT
  const accountCount = entries.length;
  results.push(await storeComputedField(engagementId, "TB_ACCOUNT_COUNT", accountCount.toString(), accountCount, sourceHash, userId));
  
  // TB_PERIOD_END_DATE
  if (tbBatch.periodEnd) {
    const periodEndDate = tbBatch.periodEnd.toISOString().split("T")[0];
    results.push(await storeComputedField(engagementId, "TB_PERIOD_END_DATE", periodEndDate, null, sourceHash, userId));
  }
  
  // TB_CURRENCY
  if (tbBatch.currency) {
    results.push(await storeComputedField(engagementId, "TB_CURRENCY", tbBatch.currency, null, sourceHash, userId));
  }
  
  return results;
}

export async function computeGLFields(
  engagementId: string,
  userId?: string
): Promise<ComputedFieldResult[]> {
  const results: ComputedFieldResult[] = [];
  
  const glBatch = await prisma.gLBatch.findFirst({
    where: { engagementId },
    orderBy: { createdAt: "desc" }
  });
  
  if (!glBatch) {
    return results;
  }
  
  const sourceHash = generateSourceHash({ batchId: glBatch.id });
  
  // GL_JOURNAL_COUNT (distinct voucher numbers)
  const distinctVouchers = await prisma.gLEntry.findMany({
    where: { batchId: glBatch.id },
    select: { voucherNumber: true },
    distinct: ["voucherNumber"]
  });
  const journalCount = distinctVouchers.length;
  results.push(await storeComputedField(engagementId, "GL_JOURNAL_COUNT", journalCount.toString(), journalCount, sourceHash, userId));
  
  // GL_VOUCHER_COUNT (total entries)
  const voucherCount = await prisma.gLEntry.count({
    where: { batchId: glBatch.id }
  });
  results.push(await storeComputedField(engagementId, "GL_VOUCHER_COUNT", voucherCount.toString(), voucherCount, sourceHash, userId));
  
  // GL_PERIOD_FROM and GL_PERIOD_TO
  const dateRange = await prisma.gLEntry.aggregate({
    where: { batchId: glBatch.id },
    _min: { transactionDate: true },
    _max: { transactionDate: true }
  });
  
  if (dateRange._min.transactionDate) {
    const periodFrom = dateRange._min.transactionDate.toISOString().split("T")[0];
    results.push(await storeComputedField(engagementId, "GL_PERIOD_FROM", periodFrom, null, sourceHash, userId));
  }
  
  if (dateRange._max.transactionDate) {
    const periodTo = dateRange._max.transactionDate.toISOString().split("T")[0];
    results.push(await storeComputedField(engagementId, "GL_PERIOD_TO", periodTo, null, sourceHash, userId));
  }
  
  return results;
}

export async function computeMaterialityFields(
  engagementId: string,
  userId?: string
): Promise<ComputedFieldResult[]> {
  const results: ComputedFieldResult[] = [];
  
  const matCalc = await prisma.materialityCalculation.findFirst({
    where: { engagementId, status: "APPROVED" },
    orderBy: { createdAt: "desc" }
  });
  
  if (!matCalc) {
    return results;
  }
  
  const sourceHash = generateSourceHash({ calcId: matCalc.id });
  
  // MAT_OVERALL
  if (matCalc.overallMateriality) {
    const overall = Number(matCalc.overallMateriality);
    results.push(await storeComputedField(engagementId, "MAT_OVERALL", formatCurrency(overall), overall, sourceHash, userId));
  }
  
  // MAT_PERFORMANCE
  if (matCalc.performanceMateriality) {
    const performance = Number(matCalc.performanceMateriality);
    results.push(await storeComputedField(engagementId, "MAT_PERFORMANCE", formatCurrency(performance), performance, sourceHash, userId));
  }
  
  // MAT_TRIVIAL
  if (matCalc.trivialThreshold) {
    const trivial = Number(matCalc.trivialThreshold);
    results.push(await storeComputedField(engagementId, "MAT_TRIVIAL", formatCurrency(trivial), trivial, sourceHash, userId));
  }
  
  return results;
}

export async function computeRiskFields(
  engagementId: string,
  userId?: string
): Promise<ComputedFieldResult[]> {
  const results: ComputedFieldResult[] = [];
  
  const riskAssessments = await prisma.riskAssessment.findMany({
    where: { engagementId }
  });
  
  if (riskAssessments.length === 0) {
    return results;
  }
  
  const sourceHash = generateSourceHash({ assessmentCount: riskAssessments.length });
  
  // RISK_HIGH_COUNT
  const highRiskCount = riskAssessments.filter(r => r.inherentRisk === "HIGH").length;
  results.push(await storeComputedField(engagementId, "RISK_HIGH_COUNT", highRiskCount.toString(), highRiskCount, sourceHash, userId));
  
  // RISK_MEDIUM_COUNT
  const mediumRiskCount = riskAssessments.filter(r => r.inherentRisk === "MEDIUM").length;
  results.push(await storeComputedField(engagementId, "RISK_MEDIUM_COUNT", mediumRiskCount.toString(), mediumRiskCount, sourceHash, userId));
  
  // RISK_LOW_COUNT
  const lowRiskCount = riskAssessments.filter(r => r.inherentRisk === "LOW").length;
  results.push(await storeComputedField(engagementId, "RISK_LOW_COUNT", lowRiskCount.toString(), lowRiskCount, sourceHash, userId));
  
  return results;
}

export async function storeComputedField(
  engagementId: string,
  fieldCode: string,
  value: string | null,
  numericValue: number | null,
  sourceHash: string,
  userId?: string
): Promise<ComputedFieldResult> {
  try {
    const fieldRegistry = await prisma.fieldRegistry.findUnique({
      where: { fieldCode }
    });
    
    if (!fieldRegistry) {
      return {
        fieldCode,
        value,
        numericValue,
        sourceHash,
        success: false,
        error: `Field registry entry not found for ${fieldCode}`
      };
    }
    
    const existing = await prisma.computedField.findUnique({
      where: { engagementId_fieldCode: { engagementId, fieldCode } }
    });
    
    if (existing?.isOverridden) {
      return {
        fieldCode,
        value: existing.overrideValue,
        numericValue: existing.numericValue,
        sourceHash,
        success: true
      };
    }
    
    await prisma.computedField.upsert({
      where: { engagementId_fieldCode: { engagementId, fieldCode } },
      update: {
        value,
        numericValue,
        sourceHash,
        computedAt: new Date(),
        computedById: userId || null
      },
      create: {
        engagementId,
        fieldCode,
        value,
        numericValue,
        sourceHash,
        computedById: userId || null
      }
    });
    
    return {
      fieldCode,
      value,
      numericValue,
      sourceHash,
      success: true
    };
  } catch (error) {
    console.error(`Error storing computed field ${fieldCode}:`, error);
    return {
      fieldCode,
      value,
      numericValue,
      sourceHash,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

export async function getComputedFieldsForEngagement(
  engagementId: string
): Promise<{
  fields: Array<{
    fieldCode: string;
    label: string;
    value: string | null;
    numericValue: number | null;
    dataType: string;
    module: string;
    tab: string | null;
    isOverridden: boolean;
    overrideValue: string | null;
    computedAt: Date;
  }>;
}> {
  const computedFields = await prisma.computedField.findMany({
    where: { engagementId },
    include: {
      fieldRegistry: true
    }
  });
  
  return {
    fields: computedFields.map(cf => ({
      fieldCode: cf.fieldCode,
      label: cf.fieldRegistry.label,
      value: cf.isOverridden ? cf.overrideValue : cf.value,
      numericValue: cf.numericValue,
      dataType: cf.fieldRegistry.dataType,
      module: cf.fieldRegistry.module,
      tab: cf.fieldRegistry.tab,
      isOverridden: cf.isOverridden,
      overrideValue: cf.overrideValue,
      computedAt: cf.computedAt
    }))
  };
}

export async function overrideComputedField(
  engagementId: string,
  fieldCode: string,
  overrideValue: string,
  overrideReason: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const existing = await prisma.computedField.findUnique({
      where: { engagementId_fieldCode: { engagementId, fieldCode } }
    });
    
    if (!existing) {
      return { success: false, error: "Computed field not found" };
    }
    
    await prisma.computedField.update({
      where: { id: existing.id },
      data: {
        isOverridden: true,
        overrideValue,
        overrideReason,
        overriddenById: userId,
        overriddenAt: new Date()
      }
    });
    
    return { success: true };
  } catch (error) {
    console.error("Error overriding computed field:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function clearFieldOverride(
  engagementId: string,
  fieldCode: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const existing = await prisma.computedField.findUnique({
      where: { engagementId_fieldCode: { engagementId, fieldCode } }
    });
    
    if (!existing) {
      return { success: false, error: "Computed field not found" };
    }
    
    await prisma.computedField.update({
      where: { id: existing.id },
      data: {
        isOverridden: false,
        overrideValue: null,
        overrideReason: null,
        overriddenById: null,
        overriddenAt: null
      }
    });
    
    return { success: true };
  } catch (error) {
    console.error("Error clearing field override:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
