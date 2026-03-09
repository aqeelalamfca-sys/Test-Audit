import { prisma } from "../db";
import type { UserRole } from "@prisma/client";
import crypto from "crypto";

type TBBatchStatus = "DRAFT" | "PENDING_REVIEW" | "REVIEWED" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "SUPERSEDED";
type TBSourceType = "DERIVED_FROM_GL" | "CLIENT_PROVIDED";
type TBReconciliationStatus = "NOT_REQUIRED" | "PENDING" | "IN_PROGRESS" | "VARIANCE_FLAGGED" | "RECONCILED" | "APPROVED";

const db = prisma as any;

interface ServiceContext {
  userId: string;
  userRole: UserRole;
  userName?: string;
  ipAddress?: string;
  userAgent?: string;
}

interface TBEntryInput {
  accountCode: string;
  accountName: string;
  accountType?: string;
  accountCategory?: string;
  openingDebit: number;
  openingCredit: number;
  movementDebit?: number;
  movementCredit?: number;
  closingDebit: number;
  closingCredit: number;
  rowNumber: number;
  originalRowData?: any;
}

interface TBUploadResult {
  batchId: string;
  batchNumber: number;
  version: number;
  status: TBBatchStatus;
  sourceType: TBSourceType;
  entriesCount: number;
  isBalanced: boolean;
  validationErrors: any[];
  hasBlockingErrors: boolean;
  reconciliationRequired: boolean;
}

interface ReconciliationResult {
  batchId: string;
  reconciliationStatus: TBReconciliationStatus;
  totalVariances: number;
  variancesAboveMateriality: number;
  varianceDetails: any[];
}

const ROLE_HIERARCHY: Record<UserRole, number> = {
  STAFF: 1,
  SENIOR: 2,
  MANAGER: 3,
  EQCR: 4,
  PARTNER: 5,
  FIRM_ADMIN: 6,
  SUPER_ADMIN: 99,
};

class TBService {
  async getNextBatchNumber(engagementId: string): Promise<number> {
    const lastBatch = await db.tBBatch.findFirst({
      where: { engagementId },
      orderBy: { batchNumber: "desc" }
    });
    return (lastBatch?.batchNumber ?? 0) + 1;
  }

  async generateFromApprovedGL(
    engagementId: string,
    firmId: string,
    glBatchId: string,
    periodStart: Date,
    periodEnd: Date,
    fiscalYear: number,
    ctx: ServiceContext
  ): Promise<TBUploadResult> {
    const glBatch = await db.gLBatch.findUnique({
      where: { id: glBatchId },
      include: { entries: true }
    });

    if (!glBatch) {
      throw new Error("GL batch not found");
    }

    if (glBatch.status !== "APPROVED") {
      throw new Error("Can only generate TB from an approved GL batch (ISA 500)");
    }

    const glPeriodStart = new Date(glBatch.periodStart);
    const glPeriodEnd = new Date(glBatch.periodEnd);
    if (glPeriodStart.getTime() !== periodStart.getTime() || glPeriodEnd.getTime() !== periodEnd.getTime()) {
      throw new Error(`GL batch period (${glPeriodStart.toISOString()} - ${glPeriodEnd.toISOString()}) does not match requested TB period (${periodStart.toISOString()} - ${periodEnd.toISOString()}). Period alignment required per ISA 500.`);
    }

    const priorYearTB = await db.tBBatch.findFirst({
      where: {
        engagementId,
        fiscalYear: fiscalYear - 1,
        status: "APPROVED"
      },
      include: { entries: true },
      orderBy: { version: "desc" }
    });

    const priorClosingBalances = new Map<string, { debit: number; credit: number }>();
    if (priorYearTB) {
      for (const entry of priorYearTB.entries) {
        priorClosingBalances.set(entry.accountCode, {
          debit: Number(entry.closingDebit),
          credit: Number(entry.closingCredit)
        });
      }
    }

    const accountAggregates = new Map<string, {
      accountCode: string;
      accountName: string;
      openingDebit: number;
      openingCredit: number;
      movementDebit: number;
      movementCredit: number;
      closingDebit: number;
      closingCredit: number;
      glEntryIds: string[];
    }>();

    for (const entry of glBatch.entries) {
      const entryDate = new Date(entry.transactionDate);
      if (entryDate < periodStart || entryDate > periodEnd) {
        continue;
      }

      const key = entry.accountCode;
      if (!accountAggregates.has(key)) {
        const priorBalance = priorClosingBalances.get(key);
        accountAggregates.set(key, {
          accountCode: entry.accountCode,
          accountName: entry.accountName,
          openingDebit: priorBalance?.debit ?? 0,
          openingCredit: priorBalance?.credit ?? 0,
          movementDebit: 0,
          movementCredit: 0,
          closingDebit: 0,
          closingCredit: 0,
          glEntryIds: []
        });
      }
      const agg = accountAggregates.get(key)!;
      agg.movementDebit += Number(entry.debit);
      agg.movementCredit += Number(entry.credit);
      agg.glEntryIds.push(entry.id);
    }

    for (const agg of accountAggregates.values()) {
      const openingBalance = agg.openingDebit - agg.openingCredit;
      const netMovement = agg.movementDebit - agg.movementCredit;
      const closingBalance = openingBalance + netMovement;
      
      if (closingBalance >= 0) {
        agg.closingDebit = closingBalance;
        agg.closingCredit = 0;
      } else {
        agg.closingDebit = 0;
        agg.closingCredit = Math.abs(closingBalance);
      }
    }

    const batchNumber = await this.getNextBatchNumber(engagementId);

    let totalOpeningDebit = 0;
    let totalOpeningCredit = 0;
    let totalMovementDebit = 0;
    let totalMovementCredit = 0;
    let totalClosingDebit = 0;
    let totalClosingCredit = 0;

    const entries: TBEntryInput[] = [];
    let rowNumber = 1;

    for (const agg of accountAggregates.values()) {
      entries.push({
        accountCode: agg.accountCode,
        accountName: agg.accountName,
        openingDebit: agg.openingDebit,
        openingCredit: agg.openingCredit,
        movementDebit: agg.movementDebit,
        movementCredit: agg.movementCredit,
        closingDebit: agg.closingDebit,
        closingCredit: agg.closingCredit,
        rowNumber: rowNumber++
      });

      totalOpeningDebit += agg.openingDebit;
      totalOpeningCredit += agg.openingCredit;
      totalMovementDebit += agg.movementDebit;
      totalMovementCredit += agg.movementCredit;
      totalClosingDebit += agg.closingDebit;
      totalClosingCredit += agg.closingCredit;
    }

    const isBalanced = 
      Math.abs(totalOpeningDebit - totalOpeningCredit) < 0.01 &&
      Math.abs(totalClosingDebit - totalClosingCredit) < 0.01;

    const batch = await db.tBBatch.create({
      data: {
        engagementId,
        firmId,
        batchNumber,
        batchName: `TB from GL Batch ${glBatch.batchNumber}`,
        periodStart,
        periodEnd,
        fiscalYear,
        version: 1,
        status: "DRAFT",
        sourceType: "DERIVED_FROM_GL",
        sourceGLBatchId: glBatchId,
        uploadedById: ctx.userId,
        totalOpeningDebit,
        totalOpeningCredit,
        totalMovementDebit,
        totalMovementCredit,
        totalClosingDebit,
        totalClosingCredit,
        entryCount: entries.length,
        isBalanced,
        reconciliationStatus: "NOT_REQUIRED"
      }
    });

    for (const entry of entries) {
      const agg = accountAggregates.get(entry.accountCode)!;
      const openingBalance = entry.openingDebit - entry.openingCredit;
      const movementNet = entry.movementDebit! - entry.movementCredit!;
      const closingBalance = entry.closingDebit - entry.closingCredit;

      const tbEntry = await db.tBEntry.create({
        data: {
          batchId: batch.id,
          engagementId,
          accountCode: entry.accountCode,
          accountName: entry.accountName,
          openingDebit: entry.openingDebit,
          openingCredit: entry.openingCredit,
          movementDebit: entry.movementDebit,
          movementCredit: entry.movementCredit,
          closingDebit: entry.closingDebit,
          closingCredit: entry.closingCredit,
          openingBalance,
          movementNet,
          closingBalance,
          sourceType: "DERIVED_FROM_GL",
          glEntryCount: agg.glEntryIds.length,
          rowNumber: entry.rowNumber
        }
      });

      for (const glEntryId of agg.glEntryIds) {
        const glEntry = glBatch.entries.find((e: any) => e.id === glEntryId);
        await db.tBGLMapping.create({
          data: {
            tbBatchId: batch.id,
            tbEntryId: tbEntry.id,
            glBatchId,
            glEntryId,
            engagementId,
            debitAmount: Number(glEntry?.debit || 0),
            creditAmount: Number(glEntry?.credit || 0)
          }
        });
      }
    }

    const validationErrors = await this.validateBatch(batch.id, ctx);
    const hasBlockingErrors = validationErrors.some((e: any) => e.isBlocking);

    await this.logAction(batch.id, engagementId, "TB_GENERATED_FROM_GL", `Generated TB from approved GL batch ${glBatch.batchNumber}`, ctx, {
      sourceGLBatchId: glBatchId,
      entriesCount: entries.length,
      isBalanced
    });

    return {
      batchId: batch.id,
      batchNumber,
      version: 1,
      status: "DRAFT",
      sourceType: "DERIVED_FROM_GL",
      entriesCount: entries.length,
      isBalanced,
      validationErrors,
      hasBlockingErrors,
      reconciliationRequired: false
    };
  }

  async uploadExternalTB(
    engagementId: string,
    firmId: string,
    entries: TBEntryInput[],
    periodStart: Date,
    periodEnd: Date,
    fiscalYear: number,
    sourceFileName: string | undefined,
    sourceFileType: string | undefined,
    ctx: ServiceContext
  ): Promise<TBUploadResult> {
    const batchNumber = await this.getNextBatchNumber(engagementId);

    let totalOpeningDebit = 0;
    let totalOpeningCredit = 0;
    let totalMovementDebit = 0;
    let totalMovementCredit = 0;
    let totalClosingDebit = 0;
    let totalClosingCredit = 0;

    entries.forEach(e => {
      totalOpeningDebit += e.openingDebit;
      totalOpeningCredit += e.openingCredit;
      totalMovementDebit += e.movementDebit || 0;
      totalMovementCredit += e.movementCredit || 0;
      totalClosingDebit += e.closingDebit;
      totalClosingCredit += e.closingCredit;
    });

    const isBalanced = 
      Math.abs(totalOpeningDebit - totalOpeningCredit) < 0.01 &&
      Math.abs(totalClosingDebit - totalClosingCredit) < 0.01;

    const approvedGLBatch = await db.gLBatch.findFirst({
      where: { engagementId, status: "APPROVED" }
    });

    const reconciliationRequired = !!approvedGLBatch;

    const batch = await db.tBBatch.create({
      data: {
        engagementId,
        firmId,
        batchNumber,
        batchName: `TB Batch ${batchNumber}`,
        periodStart,
        periodEnd,
        fiscalYear,
        version: 1,
        status: "DRAFT",
        sourceType: "CLIENT_PROVIDED",
        sourceFileName,
        sourceFileType,
        uploadedById: ctx.userId,
        totalOpeningDebit,
        totalOpeningCredit,
        totalMovementDebit,
        totalMovementCredit,
        totalClosingDebit,
        totalClosingCredit,
        entryCount: entries.length,
        isBalanced,
        reconciliationStatus: reconciliationRequired ? "PENDING" : "NOT_REQUIRED"
      }
    });

    const entryData = entries.map(e => ({
      batchId: batch.id,
      engagementId,
      accountCode: e.accountCode,
      accountName: e.accountName,
      accountType: e.accountType,
      accountCategory: e.accountCategory,
      openingDebit: e.openingDebit,
      openingCredit: e.openingCredit,
      movementDebit: e.movementDebit || 0,
      movementCredit: e.movementCredit || 0,
      closingDebit: e.closingDebit,
      closingCredit: e.closingCredit,
      openingBalance: e.openingDebit - e.openingCredit,
      movementNet: (e.movementDebit || 0) - (e.movementCredit || 0),
      closingBalance: e.closingDebit - e.closingCredit,
      sourceType: "CLIENT_PROVIDED",
      rowNumber: e.rowNumber,
      originalRowData: e.originalRowData
    }));

    await db.tBEntry.createMany({ data: entryData });

    const validationErrors = await this.validateBatch(batch.id, ctx);
    const hasBlockingErrors = validationErrors.some((e: any) => e.isBlocking);

    await this.logAction(batch.id, engagementId, "TB_UPLOAD", `Uploaded external TB with ${entries.length} entries`, ctx, {
      sourceFileName,
      entriesCount: entries.length,
      isBalanced,
      reconciliationRequired
    });

    return {
      batchId: batch.id,
      batchNumber,
      version: 1,
      status: "DRAFT",
      sourceType: "CLIENT_PROVIDED",
      entriesCount: entries.length,
      isBalanced,
      validationErrors,
      hasBlockingErrors,
      reconciliationRequired
    };
  }

  async validateBatch(batchId: string, ctx: ServiceContext): Promise<any[]> {
    const errors: any[] = [];
    const batch = await db.tBBatch.findUnique({
      where: { id: batchId },
      include: { entries: true }
    });

    if (!batch) return errors;

    await db.tBValidationError.deleteMany({ where: { batchId } });

    let totalOpeningDebit = 0;
    let totalOpeningCredit = 0;
    let totalClosingDebit = 0;
    let totalClosingCredit = 0;
    const accountCodes = new Set<string>();

    for (const entry of batch.entries) {
      if (!entry.accountCode || entry.accountCode.trim() === "") {
        const err = {
          errorType: "MISSING_ACCOUNT_CODE",
          errorMessage: "Account code is required",
          field: "accountCode",
          rowNumber: entry.rowNumber,
          isBlocking: true
        };
        errors.push(err);
        await db.tBValidationError.create({ data: { batchId, entryId: entry.id, ...err } });
      }

      if (accountCodes.has(entry.accountCode)) {
        const err = {
          errorType: "DUPLICATE_ACCOUNT",
          errorMessage: `Duplicate account code: ${entry.accountCode}`,
          field: "accountCode",
          actualValue: entry.accountCode,
          rowNumber: entry.rowNumber,
          isBlocking: true
        };
        errors.push(err);
        await db.tBValidationError.create({ data: { batchId, entryId: entry.id, ...err } });
      }
      accountCodes.add(entry.accountCode);

      totalOpeningDebit += Number(entry.openingDebit);
      totalOpeningCredit += Number(entry.openingCredit);
      totalClosingDebit += Number(entry.closingDebit);
      totalClosingCredit += Number(entry.closingCredit);

      const expectedClosing = 
        (Number(entry.openingDebit) - Number(entry.openingCredit)) +
        (Number(entry.movementDebit) - Number(entry.movementCredit));
      const actualClosing = Number(entry.closingDebit) - Number(entry.closingCredit);

      if (Math.abs(expectedClosing - actualClosing) >= 0.01) {
        const err = {
          errorType: "BALANCE_MISMATCH",
          errorMessage: `Closing balance doesn't match. Expected: ${expectedClosing.toFixed(2)}, Actual: ${actualClosing.toFixed(2)}`,
          field: "closingBalance",
          expectedValue: expectedClosing.toFixed(2),
          actualValue: actualClosing.toFixed(2),
          rowNumber: entry.rowNumber,
          isBlocking: true
        };
        errors.push(err);
        await db.tBValidationError.create({ data: { batchId, entryId: entry.id, ...err } });
      }
    }

    if (Math.abs(totalOpeningDebit - totalOpeningCredit) >= 0.01) {
      const err = {
        errorType: "OPENING_IMBALANCE",
        errorMessage: `Opening balances not balanced. Debits: ${totalOpeningDebit.toFixed(2)}, Credits: ${totalOpeningCredit.toFixed(2)}`,
        field: "openingBalance",
        expectedValue: "0.00",
        actualValue: Math.abs(totalOpeningDebit - totalOpeningCredit).toFixed(2),
        isBlocking: true
      };
      errors.push(err);
      await db.tBValidationError.create({ data: { batchId, ...err } });
    }

    if (Math.abs(totalClosingDebit - totalClosingCredit) >= 0.01) {
      const err = {
        errorType: "CLOSING_IMBALANCE",
        errorMessage: `Closing balances not balanced. Debits: ${totalClosingDebit.toFixed(2)}, Credits: ${totalClosingCredit.toFixed(2)}`,
        field: "closingBalance",
        expectedValue: "0.00",
        actualValue: Math.abs(totalClosingDebit - totalClosingCredit).toFixed(2),
        isBlocking: true
      };
      errors.push(err);
      await db.tBValidationError.create({ data: { batchId, ...err } });
    }

    await db.tBBatch.update({
      where: { id: batchId },
      data: {
        hasValidationErrors: errors.length > 0,
        validationCompletedAt: new Date(),
        isBalanced: Math.abs(totalOpeningDebit - totalOpeningCredit) < 0.01 &&
                    Math.abs(totalClosingDebit - totalClosingCredit) < 0.01
      }
    });

    return errors;
  }

  async reconcileWithGL(
    batchId: string,
    performanceMateriality: number,
    ctx: ServiceContext
  ): Promise<ReconciliationResult> {
    const batch = await db.tBBatch.findUnique({
      where: { id: batchId },
      include: { entries: true }
    });

    if (!batch) {
      throw new Error("TB batch not found");
    }

    const approvedGLBatch = await db.gLBatch.findFirst({
      where: { engagementId: batch.engagementId, status: "APPROVED" },
      include: { entries: true },
      orderBy: { version: "desc" }
    });

    if (!approvedGLBatch) {
      await db.tBBatch.update({
        where: { id: batchId },
        data: { reconciliationStatus: "NOT_REQUIRED" }
      });
      return {
        batchId,
        reconciliationStatus: "NOT_REQUIRED",
        totalVariances: 0,
        variancesAboveMateriality: 0,
        varianceDetails: []
      };
    }

    await db.tBReconciliation.deleteMany({ where: { tbBatchId: batchId } });

    const glAggregates = new Map<string, { debit: number; credit: number }>();
    for (const entry of approvedGLBatch.entries) {
      const key = entry.accountCode;
      if (!glAggregates.has(key)) {
        glAggregates.set(key, { debit: 0, credit: 0 });
      }
      const agg = glAggregates.get(key)!;
      agg.debit += Number(entry.debit);
      agg.credit += Number(entry.credit);
    }

    const varianceDetails: any[] = [];
    let variancesAboveMateriality = 0;
    let totalVarianceAmount = 0;

    for (const tbEntry of batch.entries) {
      const glAgg = glAggregates.get(tbEntry.accountCode);
      const glNetMovement = glAgg ? (glAgg.debit - glAgg.credit) : 0;
      const tbNetMovement = Number(tbEntry.movementDebit) - Number(tbEntry.movementCredit);
      const varianceAmount = tbNetMovement - glNetMovement;

      if (Math.abs(varianceAmount) >= 0.01) {
        const isAboveMateriality = Math.abs(varianceAmount) > performanceMateriality;
        if (isAboveMateriality) variancesAboveMateriality++;
        totalVarianceAmount += Math.abs(varianceAmount);

        const reconciliation = await db.tBReconciliation.create({
          data: {
            tbBatchId: batchId,
            tbEntryId: tbEntry.id,
            engagementId: batch.engagementId,
            reconciliationType: "ACCOUNT_LEVEL",
            accountCode: tbEntry.accountCode,
            tbAmount: tbNetMovement,
            glAmount: glNetMovement,
            varianceAmount,
            variancePercentage: glNetMovement !== 0 ? (varianceAmount / Math.abs(glNetMovement)) * 100 : 100,
            performanceMateriality,
            isAboveMateriality,
            materialityFlagReason: isAboveMateriality ? "Variance exceeds performance materiality" : null,
            isResolved: false
          }
        });

        await db.tBEntry.update({
          where: { id: tbEntry.id },
          data: {
            hasVariance: true,
            varianceAmount
          }
        });

        varianceDetails.push({
          accountCode: tbEntry.accountCode,
          accountName: tbEntry.accountName,
          tbAmount: tbNetMovement,
          glAmount: glNetMovement,
          varianceAmount,
          isAboveMateriality,
          reconciliationId: reconciliation.id
        });
      }
    }

    let glTotalDebit = 0;
    let glTotalCredit = 0;
    for (const agg of glAggregates.values()) {
      glTotalDebit += agg.debit;
      glTotalCredit += agg.credit;
    }

    const tbTotalMovementDebit = Number(batch.totalMovementDebit);
    const tbTotalMovementCredit = Number(batch.totalMovementCredit);
    const controlTotalVariance = (tbTotalMovementDebit - tbTotalMovementCredit) - (glTotalDebit - glTotalCredit);

    if (Math.abs(controlTotalVariance) >= 0.01) {
      await db.tBReconciliation.create({
        data: {
          tbBatchId: batchId,
          engagementId: batch.engagementId,
          reconciliationType: "CONTROL_TOTAL",
          tbAmount: tbTotalMovementDebit - tbTotalMovementCredit,
          glAmount: glTotalDebit - glTotalCredit,
          varianceAmount: controlTotalVariance,
          variancePercentage: (glTotalDebit - glTotalCredit) !== 0 ? 
            (controlTotalVariance / Math.abs(glTotalDebit - glTotalCredit)) * 100 : 100,
          performanceMateriality,
          isAboveMateriality: Math.abs(controlTotalVariance) > performanceMateriality,
          isResolved: false
        }
      });
    }

    const newStatus: TBReconciliationStatus = variancesAboveMateriality > 0 ? "VARIANCE_FLAGGED" : 
      (varianceDetails.length > 0 ? "IN_PROGRESS" : "RECONCILED");

    await db.tBBatch.update({
      where: { id: batchId },
      data: {
        reconciliationStatus: newStatus,
        hasUnresolvedVariances: variancesAboveMateriality > 0,
        varianceCount: varianceDetails.length,
        totalVarianceAmount
      }
    });

    await this.logAction(batchId, batch.engagementId, "TB_RECONCILIATION", 
      `GL↔TB reconciliation completed. ${varianceDetails.length} variances found, ${variancesAboveMateriality} above materiality.`, ctx, {
      performanceMateriality,
      totalVariances: varianceDetails.length,
      variancesAboveMateriality,
      totalVarianceAmount
    });

    return {
      batchId,
      reconciliationStatus: newStatus,
      totalVariances: varianceDetails.length,
      variancesAboveMateriality,
      varianceDetails
    };
  }

  async resolveVariance(
    reconciliationId: string,
    resolutionType: string,
    resolutionNote: string,
    evidenceIds: string[],
    ctx: ServiceContext
  ): Promise<{ success: boolean; error?: string }> {
    const reconciliation = await db.tBReconciliation.findUnique({
      where: { id: reconciliationId },
      include: { tbBatch: true, tbEntry: true }
    });

    if (!reconciliation) {
      return { success: false, error: "Reconciliation record not found" };
    }

    if (!resolutionNote) {
      return { success: false, error: "Resolution note is required (ISA 230)" };
    }

    if (reconciliation.isAboveMateriality && evidenceIds.length === 0) {
      return { success: false, error: "Evidence is required for material variances (ISA 500)" };
    }

    await db.tBReconciliation.update({
      where: { id: reconciliationId },
      data: {
        isResolved: true,
        resolutionType,
        resolutionNote,
        evidenceIds,
        resolvedById: ctx.userId,
        resolvedAt: new Date()
      }
    });

    if (reconciliation.tbEntryId) {
      await db.tBEntry.update({
        where: { id: reconciliation.tbEntryId },
        data: {
          varianceExplained: true,
          varianceNote: resolutionNote,
          varianceEvidenceId: evidenceIds[0] || null
        }
      });
    }

    const unresolvedCount = await db.tBReconciliation.count({
      where: { tbBatchId: reconciliation.tbBatchId, isResolved: false }
    });

    const unresolvedMaterialCount = await db.tBReconciliation.count({
      where: { tbBatchId: reconciliation.tbBatchId, isResolved: false, isAboveMateriality: true }
    });

    await db.tBBatch.update({
      where: { id: reconciliation.tbBatchId },
      data: {
        reconciliationStatus: unresolvedCount === 0 ? "RECONCILED" : 
          (unresolvedMaterialCount > 0 ? "VARIANCE_FLAGGED" : "IN_PROGRESS"),
        hasUnresolvedVariances: unresolvedMaterialCount > 0
      }
    });

    await this.logAction(reconciliation.tbBatchId, reconciliation.tbBatch.engagementId, 
      "TB_VARIANCE_RESOLVED", `Variance resolved for account ${reconciliation.accountCode || 'control total'}`, ctx, {
      reconciliationId,
      resolutionType,
      varianceAmount: reconciliation.varianceAmount,
      evidenceCount: evidenceIds.length
    });

    return { success: true };
  }

  async getBatch(batchId: string, ctx: ServiceContext) {
    const batch = await db.tBBatch.findUnique({
      where: { id: batchId },
      include: {
        entries: { orderBy: { rowNumber: "asc" } },
        validationErrors: true,
        reconciliations: true,
        uploadedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
        approvedBy: { select: { id: true, fullName: true, role: true } },
        sourceGLBatch: { select: { id: true, batchNumber: true, status: true } }
      }
    });

    if (batch) {
      await this.logAction(batch.id, batch.engagementId, "TB_VIEW", "Viewed TB batch", ctx);
    }

    return batch;
  }

  async getBatchesForEngagement(engagementId: string, includeSuperseded: boolean = false) {
    const where: any = { engagementId };
    if (!includeSuperseded) {
      where.status = { not: "SUPERSEDED" };
    }
    return db.tBBatch.findMany({
      where,
      orderBy: [{ batchNumber: "desc" }, { version: "desc" }],
      include: {
        uploadedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
        approvedBy: { select: { id: true, fullName: true, role: true } }
      }
    });
  }

  async submitForReview(batchId: string, ctx: ServiceContext): Promise<{ success: boolean; error?: string }> {
    const batch = await db.tBBatch.findUnique({
      where: { id: batchId },
      include: { 
        validationErrors: { where: { isBlocking: true, isResolved: false } },
        reconciliations: { where: { isResolved: false, isAboveMateriality: true } }
      }
    });

    if (!batch) {
      return { success: false, error: "Batch not found" };
    }

    if (batch.status !== "DRAFT") {
      return { success: false, error: "Only draft batches can be submitted for review" };
    }

    if (batch.validationErrors.length > 0) {
      return { success: false, error: `Cannot submit: ${batch.validationErrors.length} blocking validation errors must be resolved` };
    }

    if (batch.reconciliationStatus === "VARIANCE_FLAGGED" && batch.reconciliations.length > 0) {
      return { success: false, error: `Cannot submit: ${batch.reconciliations.length} material variances must be resolved with evidence (ISA 500)` };
    }

    await db.tBBatch.update({
      where: { id: batchId },
      data: { status: "PENDING_REVIEW" }
    });

    await this.logAction(batchId, batch.engagementId, "TB_SUBMIT_FOR_REVIEW", "Submitted TB for review", ctx);

    return { success: true };
  }

  async reviewBatch(
    batchId: string,
    approved: boolean,
    comments: string | undefined,
    ctx: ServiceContext
  ): Promise<{ success: boolean; error?: string }> {
    const batch = await db.tBBatch.findUnique({ where: { id: batchId } });

    if (!batch) {
      return { success: false, error: "Batch not found" };
    }

    if (batch.status !== "PENDING_REVIEW") {
      return { success: false, error: "Batch is not pending review" };
    }

    if (ROLE_HIERARCHY[ctx.userRole] < ROLE_HIERARCHY["SENIOR"]) {
      return { success: false, error: "Reviewer must be Senior level or above (ISA 220)" };
    }

    if (batch.uploadedById === ctx.userId) {
      return { success: false, error: "Maker-checker violation: Preparer cannot review their own work (ISA 220)" };
    }

    const newStatus: TBBatchStatus = approved ? "REVIEWED" : "REJECTED";

    await db.tBBatch.update({
      where: { id: batchId },
      data: {
        status: newStatus,
        reviewedAt: new Date(),
        reviewedById: ctx.userId,
        reviewerComments: comments
      }
    });

    await this.logAction(batchId, batch.engagementId, approved ? "TB_REVIEWED" : "TB_REVIEW_REJECTED",
      approved ? "TB batch reviewed" : "TB batch review rejected", ctx, { comments });

    return { success: true };
  }

  async submitForApproval(batchId: string, ctx: ServiceContext): Promise<{ success: boolean; error?: string }> {
    const batch = await db.tBBatch.findUnique({ where: { id: batchId } });

    if (!batch) {
      return { success: false, error: "Batch not found" };
    }

    if (batch.status !== "REVIEWED") {
      return { success: false, error: "Only reviewed batches can be submitted for partner approval" };
    }

    await db.tBBatch.update({
      where: { id: batchId },
      data: { status: "PENDING_APPROVAL" }
    });

    await this.logAction(batchId, batch.engagementId, "TB_SUBMIT_FOR_APPROVAL", "Submitted TB for partner approval", ctx);

    return { success: true };
  }

  async approveBatch(
    batchId: string,
    partnerPin: string | undefined,
    comments: string | undefined,
    ctx: ServiceContext
  ): Promise<{ success: boolean; error?: string }> {
    const batch = await db.tBBatch.findUnique({
      where: { id: batchId },
      include: { 
        validationErrors: { where: { isBlocking: true, isResolved: false } },
        reconciliations: { where: { isResolved: false, isAboveMateriality: true } }
      }
    });

    if (!batch) {
      return { success: false, error: "Batch not found" };
    }

    if (batch.status !== "PENDING_APPROVAL") {
      return { success: false, error: "Batch is not pending partner approval" };
    }

    if (ROLE_HIERARCHY[ctx.userRole] < ROLE_HIERARCHY["PARTNER"]) {
      return { success: false, error: "Only Partners can approve TB batches (ISA 220)" };
    }

    if (batch.uploadedById === ctx.userId || batch.reviewedById === ctx.userId) {
      return { success: false, error: "Maker-checker violation: Approver cannot be the preparer or reviewer (ISA 220)" };
    }

    if (batch.validationErrors.length > 0) {
      return { success: false, error: "Cannot approve: Batch has unresolved blocking validation errors" };
    }

    if (batch.reconciliations.length > 0) {
      return { success: false, error: `Cannot approve: ${batch.reconciliations.length} material variances are unresolved (ISA 500)` };
    }

    await db.tBBatch.update({
      where: { id: batchId },
      data: {
        status: "APPROVED",
        approvedAt: new Date(),
        approvedById: ctx.userId,
        approverComments: comments,
        partnerPin,
        isLocked: true,
        lockedAt: new Date(),
        lockedById: ctx.userId,
        reconciliationStatus: batch.reconciliationStatus === "RECONCILED" ? "APPROVED" : batch.reconciliationStatus,
        reconciliationApprovedAt: batch.reconciliationStatus === "RECONCILED" ? new Date() : null,
        reconciliationApprovedById: batch.reconciliationStatus === "RECONCILED" ? ctx.userId : null
      }
    });

    await this.logAction(batchId, batch.engagementId, "TB_PARTNER_APPROVED", 
      "TB batch approved by Partner and locked", ctx, { comments, hasPartnerPin: !!partnerPin });

    return { success: true };
  }

  async canProceedToFS(engagementId: string): Promise<{ canProceed: boolean; blockers: string[] }> {
    const blockers: string[] = [];

    const approvedTB = await db.tBBatch.findFirst({
      where: { engagementId, status: "APPROVED" }
    });

    if (!approvedTB) {
      blockers.push("No approved Trial Balance exists. TB must be approved before proceeding to Financial Statements.");
    }

    const clientProvidedTB = await db.tBBatch.findFirst({
      where: { 
        engagementId, 
        sourceType: "CLIENT_PROVIDED",
        status: { not: "SUPERSEDED" }
      }
    });

    const approvedGL = await db.gLBatch.findFirst({
      where: { engagementId, status: "APPROVED" }
    });

    if (clientProvidedTB && approvedGL) {
      if (clientProvidedTB.reconciliationStatus !== "APPROVED") {
        blockers.push("GL↔TB reconciliation is required but not approved. Complete reconciliation before proceeding to FS.");
      }
    }

    const unresolvedVariances = await db.tBReconciliation.count({
      where: { 
        tbBatch: { engagementId },
        isResolved: false,
        isAboveMateriality: true
      }
    });

    if (unresolvedVariances > 0) {
      blockers.push(`${unresolvedVariances} material variances remain unresolved with evidence (ISA 500).`);
    }

    return {
      canProceed: blockers.length === 0,
      blockers
    };
  }

  async getValidationErrors(batchId: string) {
    return db.tBValidationError.findMany({
      where: { batchId },
      include: {
        entry: { select: { id: true, accountCode: true, accountName: true, rowNumber: true } }
      },
      orderBy: [{ isBlocking: "desc" }, { rowNumber: "asc" }]
    });
  }

  async getReconciliations(batchId: string) {
    return db.tBReconciliation.findMany({
      where: { tbBatchId: batchId },
      include: {
        tbEntry: { select: { id: true, accountCode: true, accountName: true } },
        resolvedBy: { select: { id: true, fullName: true } },
        reviewedBy: { select: { id: true, fullName: true } }
      },
      orderBy: [{ isAboveMateriality: "desc" }, { isResolved: "asc" }]
    });
  }

  async getAuditLog(batchId: string) {
    return db.tBAuditLog.findMany({
      where: { batchId },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, fullName: true, role: true } }
      }
    });
  }

  private async logAction(
    batchId: string,
    engagementId: string,
    action: string,
    description: string,
    ctx: ServiceContext,
    additionalData?: any
  ) {
    await db.tBAuditLog.create({
      data: {
        batchId,
        engagementId,
        action,
        actionDescription: description,
        userId: ctx.userId,
        userRole: ctx.userRole,
        userName: ctx.userName,
        changedFields: additionalData,
        isaReference: action.includes("APPROVE") || action.includes("RECONCIL") ? "ISA 500, ISA 230" : "ISA 230",
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent
      }
    });
  }

  generateCSVTemplate(): string {
    const headers = [
      "Account Code",
      "Account Name",
      "Opening Debit",
      "Opening Credit",
      "Movement Debit (Optional)",
      "Movement Credit (Optional)",
      "Closing Debit",
      "Closing Credit"
    ];

    const exampleRows = [
      ["1000", "Cash and Cash Equivalents", "50000.00", "0.00", "25000.00", "15000.00", "60000.00", "0.00"],
      ["2000", "Accounts Payable", "0.00", "30000.00", "10000.00", "20000.00", "0.00", "40000.00"],
      ["3000", "Share Capital", "0.00", "100000.00", "0.00", "0.00", "0.00", "100000.00"]
    ];

    let csv = headers.join(",") + "\n";
    exampleRows.forEach(row => {
      csv += row.join(",") + "\n";
    });

    return csv;
  }
}

export const tbService = new TBService();
