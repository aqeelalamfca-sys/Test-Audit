import { prisma } from "../db";
import type { UserRole } from "@prisma/client";
import crypto from "crypto";

type GLBatchStatus = "DRAFT" | "PENDING_REVIEW" | "REVIEWED" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "SUPERSEDED";
type GLValidationErrorType = "PERIOD_MISMATCH" | "DEBIT_CREDIT_IMBALANCE" | "MISSING_ACCOUNT_CODE" | "INVALID_ACCOUNT_CODE" | "DUPLICATE_ENTRY" | "MISSING_REQUIRED_FIELD" | "INVALID_DATE_FORMAT" | "INVALID_AMOUNT" | "BATCH_IMBALANCE";

const db = prisma as any;

interface ServiceContext {
  userId: string;
  userRole: UserRole;
  userName?: string;
  ipAddress?: string;
  userAgent?: string;
}

interface GLEntryInput {
  accountCode: string;
  accountName: string;
  transactionDate: Date;
  debit: number;
  credit: number;
  description?: string;
  reference?: string;
  costCenter?: string;
  counterparty?: string;
  rowNumber: number;
  originalRowData?: any;
  // Extended template fields
  voucherNumber?: string;
  documentType?: string;
  localCurrency?: string;
  referenceNumber?: string;
  narrative?: string;
  transactionMonth?: number | null;
  transactionYear?: number | null;
}

interface GLUploadResult {
  batchId: string;
  batchNumber: number;
  version: number;
  status: GLBatchStatus;
  entriesCount: number;
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
  validationErrors: ValidationError[];
  hasBlockingErrors: boolean;
}

interface ValidationError {
  errorType: GLValidationErrorType;
  errorMessage: string;
  field?: string;
  expectedValue?: string;
  actualValue?: string;
  rowNumber?: number;
  isBlocking: boolean;
}

interface DuplicateCandidate {
  entryId: string;
  duplicateOfId: string;
  score: number;
  reason: string;
}

interface ClusterSuggestion {
  clusterName: string;
  clusterDescription: string;
  suggestedAccountCode?: string;
  entryIds: string[];
  entryCount: number;
  totalDebit: number;
  totalCredit: number;
  aiConfidenceScore: number;
  aiReason: string;
}

const ROLE_HIERARCHY: Record<UserRole, number> = {
  STAFF: 1,
  SENIOR: 2,
  TEAM_LEAD: 3,
  MANAGER: 4,
  PARTNER: 5,
  MANAGING_PARTNER: 6,
  EQCR: 5,
  ADMIN: 7
};

class GLService {
  async getNextBatchNumber(engagementId: string): Promise<number> {
    const lastBatch = await db.gLBatch.findFirst({
      where: { engagementId },
      orderBy: { batchNumber: "desc" }
    });
    return (lastBatch?.batchNumber ?? 0) + 1;
  }

  async uploadGeneralLedger(
    engagementId: string,
    firmId: string,
    entries: GLEntryInput[],
    periodStart: Date,
    periodEnd: Date,
    fiscalYear: number,
    sourceFileName: string | undefined,
    sourceFileType: string | undefined,
    ctx: ServiceContext
  ): Promise<GLUploadResult> {
    const batchNumber = await this.getNextBatchNumber(engagementId);

    let totalDebits = 0;
    let totalCredits = 0;
    entries.forEach(e => {
      totalDebits += e.debit;
      totalCredits += e.credit;
    });

    const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

    const batch = await db.gLBatch.create({
      data: {
        engagementId,
        firmId,
        batchNumber,
        batchName: `GL Batch ${batchNumber}`,
        periodStart,
        periodEnd,
        fiscalYear,
        version: 1,
        status: "DRAFT",
        sourceFileName,
        sourceFileType,
        uploadedById: ctx.userId,
        totalDebits,
        totalCredits,
        entryCount: entries.length,
        isBalanced,
        hasValidationErrors: false
      }
    });

    const entryData = entries.map(e => ({
      batchId: batch.id,
      engagementId,
      accountCode: e.accountCode,
      accountName: e.accountName,
      transactionDate: e.transactionDate,
      debit: e.debit,
      credit: e.credit,
      description: e.description || e.narrative,
      reference: e.reference || e.referenceNumber,
      costCenter: e.costCenter,
      counterparty: e.counterparty,
      rowNumber: e.rowNumber,
      originalRowData: e.originalRowData,
      entryHash: this.computeEntryHash(e),
      // Extended template fields
      voucherNumber: e.voucherNumber,
      documentType: e.documentType,
      localCurrency: e.localCurrency || "PKR",
      referenceNumber: e.referenceNumber,
      narrative: e.narrative,
      transactionMonth: e.transactionMonth,
      transactionYear: e.transactionYear
    }));

    await db.gLEntry.createMany({ data: entryData });

    const validationErrors = await this.validateBatch(batch.id, engagementId, periodStart, periodEnd, ctx);
    
    const hasBlockingErrors = validationErrors.some(e => e.isBlocking);

    await db.gLBatch.update({
      where: { id: batch.id },
      data: {
        hasValidationErrors: validationErrors.length > 0,
        validationCompletedAt: new Date()
      }
    });

    await this.logAction(batch.id, engagementId, "GL_UPLOAD", `Uploaded ${entries.length} GL entries`, ctx, {
      sourceFileName,
      totalDebits,
      totalCredits,
      isBalanced,
      validationErrorCount: validationErrors.length
    });

    return {
      batchId: batch.id,
      batchNumber,
      version: 1,
      status: "DRAFT",
      entriesCount: entries.length,
      totalDebits,
      totalCredits,
      isBalanced,
      validationErrors,
      hasBlockingErrors
    };
  }

  private computeEntryHash(entry: GLEntryInput): string {
    const hashInput = `${entry.accountCode}|${entry.transactionDate.toISOString()}|${entry.debit}|${entry.credit}|${entry.description || ""}|${entry.reference || ""}`;
    return crypto.createHash("sha256").update(hashInput).digest("hex").substring(0, 32);
  }

  async validateBatch(
    batchId: string,
    engagementId: string,
    periodStart: Date,
    periodEnd: Date,
    ctx: ServiceContext
  ): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    const dbErrorRecords: any[] = [];
    const entries = await db.gLEntry.findMany({ where: { batchId } });

    await db.gLValidationError.deleteMany({ where: { batchId } });

    let batchTotalDebits = 0;
    let batchTotalCredits = 0;

    for (const entry of entries) {
      if (entry.transactionDate < periodStart || entry.transactionDate > periodEnd) {
        const err: ValidationError = {
          errorType: "PERIOD_MISMATCH",
          errorMessage: `Transaction date ${entry.transactionDate.toISOString().split("T")[0]} is outside the audit period (${periodStart.toISOString().split("T")[0]} to ${periodEnd.toISOString().split("T")[0]})`,
          field: "transactionDate",
          expectedValue: `${periodStart.toISOString().split("T")[0]} to ${periodEnd.toISOString().split("T")[0]}`,
          actualValue: entry.transactionDate.toISOString().split("T")[0],
          rowNumber: entry.rowNumber,
          isBlocking: true
        };
        errors.push(err);
        dbErrorRecords.push({ batchId, entryId: entry.id, ...err });
      }

      if (!entry.accountCode || entry.accountCode.trim() === "") {
        const err: ValidationError = {
          errorType: "MISSING_ACCOUNT_CODE",
          errorMessage: "Account code is required",
          field: "accountCode",
          rowNumber: entry.rowNumber,
          isBlocking: true
        };
        errors.push(err);
        dbErrorRecords.push({ batchId, entryId: entry.id, ...err });
      }

      const debit = Number(entry.debit);
      const credit = Number(entry.credit);

      if (debit === 0 && credit === 0) {
        const err: ValidationError = {
          errorType: "INVALID_AMOUNT",
          errorMessage: "Entry must have either a debit or credit amount",
          field: "debit/credit",
          rowNumber: entry.rowNumber,
          isBlocking: true
        };
        errors.push(err);
        dbErrorRecords.push({ batchId, entryId: entry.id, ...err });
      }

      if (debit !== 0 && credit !== 0) {
        const err: ValidationError = {
          errorType: "DEBIT_CREDIT_IMBALANCE",
          errorMessage: "Entry cannot have both debit and credit amounts",
          field: "debit/credit",
          rowNumber: entry.rowNumber,
          isBlocking: true
        };
        errors.push(err);
        dbErrorRecords.push({ batchId, entryId: entry.id, ...err });
      }

      batchTotalDebits += debit;
      batchTotalCredits += credit;
    }

    if (Math.abs(batchTotalDebits - batchTotalCredits) >= 0.01) {
      const err: ValidationError = {
        errorType: "BATCH_IMBALANCE",
        errorMessage: `Batch is not balanced. Total Debits: ${batchTotalDebits.toFixed(2)}, Total Credits: ${batchTotalCredits.toFixed(2)}, Difference: ${Math.abs(batchTotalDebits - batchTotalCredits).toFixed(2)}`,
        field: "batch",
        expectedValue: "0.00",
        actualValue: Math.abs(batchTotalDebits - batchTotalCredits).toFixed(2),
        isBlocking: true
      };
      errors.push(err);
      dbErrorRecords.push({ batchId, ...err });
    }

    if (dbErrorRecords.length > 0) {
      await db.gLValidationError.createMany({ data: dbErrorRecords });
    }

    if (errors.length > 0) {
      await db.gLBatch.update({
        where: { id: batchId },
        data: { hasValidationErrors: true }
      });
    }

    return errors;
  }

  async getBatch(batchId: string, ctx: ServiceContext) {
    const batch = await db.gLBatch.findUnique({
      where: { id: batchId },
      include: {
        entries: { orderBy: { rowNumber: "asc" } },
        validationErrors: true,
        clusters: { include: { entries: true } },
        uploadedBy: { select: { id: true, fullName: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, role: true } },
        approvedBy: { select: { id: true, fullName: true, role: true } }
      }
    });

    if (batch) {
      await this.logAction(batch.id, batch.engagementId, "GL_VIEW", "Viewed GL batch", ctx);
    }

    return batch;
  }

  async getBatchesForEngagement(engagementId: string, includeSuperseded: boolean = false) {
    const where: any = { engagementId };
    if (!includeSuperseded) {
      where.status = { not: "SUPERSEDED" };
    }
    return db.gLBatch.findMany({
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
    const batch = await db.gLBatch.findUnique({
      where: { id: batchId },
      include: { validationErrors: { where: { isBlocking: true, isResolved: false } } }
    });

    if (!batch) {
      return { success: false, error: "Batch not found" };
    }

    if (batch.status !== "DRAFT") {
      return { success: false, error: "Only draft batches can be submitted for review" };
    }

    if (batch.validationErrors.length > 0) {
      return { success: false, error: `Cannot submit: ${batch.validationErrors.length} blocking validation errors must be resolved first` };
    }

    await db.gLBatch.update({
      where: { id: batchId },
      data: { status: "PENDING_REVIEW" }
    });

    await this.logAction(batchId, batch.engagementId, "GL_SUBMIT_FOR_REVIEW", "Submitted GL batch for review", ctx);

    return { success: true };
  }

  async reviewBatch(
    batchId: string,
    approved: boolean,
    comments: string | undefined,
    ctx: ServiceContext
  ): Promise<{ success: boolean; error?: string }> {
    const batch = await db.gLBatch.findUnique({ where: { id: batchId } });

    if (!batch) {
      return { success: false, error: "Batch not found" };
    }

    if (batch.status !== "PENDING_REVIEW") {
      return { success: false, error: "Batch is not pending review" };
    }

    if (ROLE_HIERARCHY[ctx.userRole] < ROLE_HIERARCHY["SENIOR"]) {
      return { success: false, error: "Reviewer must be Senior level or above" };
    }

    if (batch.uploadedById === ctx.userId) {
      return { success: false, error: "Maker-checker violation: Preparer cannot review their own work" };
    }

    const newStatus: GLBatchStatus = approved ? "REVIEWED" : "REJECTED";

    await db.gLBatch.update({
      where: { id: batchId },
      data: {
        status: newStatus,
        reviewedAt: new Date(),
        reviewedById: ctx.userId,
        reviewerComments: comments
      }
    });

    await this.logAction(
      batchId,
      batch.engagementId,
      approved ? "GL_REVIEWED" : "GL_REVIEW_REJECTED",
      approved ? "GL batch reviewed and approved" : "GL batch review rejected",
      ctx,
      { comments }
    );

    return { success: true };
  }

  async submitForApproval(batchId: string, ctx: ServiceContext): Promise<{ success: boolean; error?: string }> {
    const batch = await db.gLBatch.findUnique({ where: { id: batchId } });

    if (!batch) {
      return { success: false, error: "Batch not found" };
    }

    if (batch.status !== "REVIEWED") {
      return { success: false, error: "Only reviewed batches can be submitted for partner approval" };
    }

    await db.gLBatch.update({
      where: { id: batchId },
      data: { status: "PENDING_APPROVAL" }
    });

    await this.logAction(batchId, batch.engagementId, "GL_SUBMIT_FOR_APPROVAL", "Submitted GL batch for partner approval", ctx);

    return { success: true };
  }

  async approveBatch(
    batchId: string,
    partnerPin: string | undefined,
    comments: string | undefined,
    ctx: ServiceContext
  ): Promise<{ success: boolean; error?: string }> {
    const batch = await db.gLBatch.findUnique({
      where: { id: batchId },
      include: { validationErrors: { where: { isBlocking: true, isResolved: false } } }
    });

    if (!batch) {
      return { success: false, error: "Batch not found" };
    }

    if (batch.status !== "PENDING_APPROVAL") {
      return { success: false, error: "Batch is not pending partner approval" };
    }

    if (ROLE_HIERARCHY[ctx.userRole] < ROLE_HIERARCHY["PARTNER"]) {
      return { success: false, error: "Only Partners can approve GL batches" };
    }

    if (batch.uploadedById === ctx.userId || batch.reviewedById === ctx.userId) {
      return { success: false, error: "Maker-checker violation: Approver cannot be the preparer or reviewer" };
    }

    if (batch.validationErrors.length > 0) {
      return { success: false, error: "Cannot approve: Batch has unresolved blocking validation errors" };
    }

    await db.gLBatch.update({
      where: { id: batchId },
      data: {
        status: "APPROVED",
        approvedAt: new Date(),
        approvedById: ctx.userId,
        approverComments: comments,
        partnerPin,
        isLocked: true,
        lockedAt: new Date(),
        lockedById: ctx.userId
      }
    });

    await this.logAction(batchId, batch.engagementId, "GL_PARTNER_APPROVED", "GL batch approved by Partner and locked", ctx, {
      comments,
      hasPartnerPin: !!partnerPin
    });

    return { success: true };
  }

  async rejectApproval(
    batchId: string,
    comments: string,
    ctx: ServiceContext
  ): Promise<{ success: boolean; error?: string }> {
    const batch = await db.gLBatch.findUnique({ where: { id: batchId } });

    if (!batch) {
      return { success: false, error: "Batch not found" };
    }

    if (batch.status !== "PENDING_APPROVAL") {
      return { success: false, error: "Batch is not pending approval" };
    }

    if (ROLE_HIERARCHY[ctx.userRole] < ROLE_HIERARCHY["PARTNER"]) {
      return { success: false, error: "Only Partners can reject approval" };
    }

    await db.gLBatch.update({
      where: { id: batchId },
      data: {
        status: "REJECTED",
        approvedById: ctx.userId,
        approverComments: comments
      }
    });

    await this.logAction(batchId, batch.engagementId, "GL_APPROVAL_REJECTED", "GL batch approval rejected by Partner", ctx, { comments });

    return { success: true };
  }

  async requestChangeToApprovedBatch(
    batchId: string,
    reason: string,
    ctx: ServiceContext
  ): Promise<{ success: boolean; newBatchId?: string; error?: string }> {
    const batch = await db.gLBatch.findUnique({
      where: { id: batchId },
      include: { entries: true }
    });

    if (!batch) {
      return { success: false, error: "Batch not found" };
    }

    if (batch.status !== "APPROVED") {
      return { success: false, error: "Only approved batches can have change requests" };
    }

    if (ROLE_HIERARCHY[ctx.userRole] < ROLE_HIERARCHY["MANAGER"]) {
      return { success: false, error: "Only Manager or above can request changes to approved batches" };
    }

    const newBatch = await db.gLBatch.create({
      data: {
        engagementId: batch.engagementId,
        firmId: batch.firmId,
        batchNumber: batch.batchNumber,
        batchName: `${batch.batchName} (v${batch.version + 1})`,
        periodStart: batch.periodStart,
        periodEnd: batch.periodEnd,
        fiscalYear: batch.fiscalYear,
        version: batch.version + 1,
        status: "DRAFT",
        previousVersionId: batch.id,
        sourceFileName: batch.sourceFileName,
        sourceFileType: batch.sourceFileType,
        uploadedById: ctx.userId,
        totalDebits: batch.totalDebits,
        totalCredits: batch.totalCredits,
        entryCount: batch.entryCount,
        isBalanced: batch.isBalanced,
        changeRequestId: crypto.randomUUID(),
        changeRequestReason: reason
      }
    });

    const newEntries = batch.entries.map((e: any) => ({
      batchId: newBatch.id,
      engagementId: e.engagementId,
      accountCode: e.accountCode,
      accountName: e.accountName,
      transactionDate: e.transactionDate,
      debit: e.debit,
      credit: e.credit,
      description: e.description,
      reference: e.reference,
      costCenter: e.costCenter,
      counterparty: e.counterparty,
      rowNumber: e.rowNumber,
      originalRowData: e.originalRowData as any,
      entryHash: e.entryHash
    }));

    await db.gLEntry.createMany({ data: newEntries });

    await db.gLBatch.update({
      where: { id: batch.id },
      data: { status: "SUPERSEDED" }
    });

    await this.logAction(newBatch.id, batch.engagementId, "GL_CHANGE_REQUEST", `Change request created for approved batch. Reason: ${reason}`, ctx, {
      previousVersionId: batch.id,
      previousVersion: batch.version,
      newVersion: newBatch.version,
      reason
    });

    return { success: true, newBatchId: newBatch.id };
  }

  async detectDuplicates(batchId: string, ctx: ServiceContext): Promise<DuplicateCandidate[]> {
    const batch = await db.gLBatch.findUnique({
      where: { id: batchId },
      include: { entries: true }
    });

    if (!batch) return [];

    const duplicates: DuplicateCandidate[] = [];
    const entries = batch.entries;
    const hashMap = new Map<string, typeof entries[0][]>();

    for (const entry of entries) {
      if (!entry.entryHash) continue;
      if (!hashMap.has(entry.entryHash)) {
        hashMap.set(entry.entryHash, []);
      }
      hashMap.get(entry.entryHash)!.push(entry);
    }

    for (const [hash, group] of hashMap) {
      if (group.length > 1) {
        const first = group[0];
        for (let i = 1; i < group.length; i++) {
          duplicates.push({
            entryId: group[i].id,
            duplicateOfId: first.id,
            score: 1.0,
            reason: "Exact match based on account code, date, amounts, description, and reference"
          });
        }
      }
    }

    const accountGroups = new Map<string, typeof entries[0][]>();
    for (const entry of entries) {
      const code = entry.accountCode || "";
      if (!accountGroups.has(code)) {
        accountGroups.set(code, []);
      }
      accountGroups.get(code)!.push(entry);
    }

    for (const [, group] of accountGroups) {
      if (group.length < 2) continue;
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const e1 = group[i];
          const e2 = group[j];

          if (e1.entryHash === e2.entryHash) continue;

          let similarityScore = 0.3;

          if (Number(e1.debit) === Number(e2.debit) && Number(e1.credit) === Number(e2.credit)) similarityScore += 0.3;
          if (e1.transactionDate.getTime() === e2.transactionDate.getTime()) similarityScore += 0.2;
          if (e1.reference && e2.reference && e1.reference === e2.reference) similarityScore += 0.2;

          if (similarityScore >= 0.7) {
            duplicates.push({
              entryId: e2.id,
              duplicateOfId: e1.id,
              score: similarityScore,
              reason: `Similar entries detected (${Math.round(similarityScore * 100)}% match)`
            });
          }
        }
      }
    }

    if (duplicates.length > 0) {
      await db.$transaction(
        duplicates.map((dup: DuplicateCandidate) =>
          db.gLEntry.update({
            where: { id: dup.entryId },
            data: {
              isDuplicate: true,
              duplicateScore: dup.score,
              duplicateOfId: dup.duplicateOfId
            }
          })
        )
      );
    }

    await db.gLBatch.update({
      where: { id: batchId },
      data: {
        aiDuplicateCheckCompleted: true,
        aiDuplicateCheckAt: new Date(),
        aiDuplicatesFound: duplicates.length
      }
    });

    await this.logAction(batchId, batch.engagementId, "GL_DUPLICATE_CHECK", `Duplicate detection completed. Found ${duplicates.length} potential duplicates.`, ctx, {
      duplicatesFound: duplicates.length
    });

    return duplicates;
  }

  async overrideDuplicate(
    entryId: string,
    reason: string,
    ctx: ServiceContext
  ): Promise<{ success: boolean; error?: string }> {
    const entry = await db.gLEntry.findUnique({
      where: { id: entryId },
      include: { batch: true }
    });

    if (!entry) {
      return { success: false, error: "Entry not found" };
    }

    if (!entry.isDuplicate) {
      return { success: false, error: "Entry is not flagged as a duplicate" };
    }

    await db.gLEntry.update({
      where: { id: entryId },
      data: {
        duplicateOverridden: true,
        duplicateOverriddenById: ctx.userId,
        duplicateOverriddenAt: new Date(),
        duplicateOverrideReason: reason
      }
    });

    await this.logAction(entry.batchId, entry.engagementId, "GL_DUPLICATE_OVERRIDE", `Duplicate override for entry in row ${entry.rowNumber}. Reason: ${reason}`, ctx, {
      entryId,
      rowNumber: entry.rowNumber,
      reason
    });

    return { success: true };
  }

  async generateClusterSuggestions(batchId: string, ctx: ServiceContext): Promise<ClusterSuggestion[]> {
    const batch = await db.gLBatch.findUnique({
      where: { id: batchId },
      include: { entries: true }
    });

    if (!batch) return [];

    const accountGroups = new Map<string, typeof batch.entries>();

    for (const entry of batch.entries) {
      const key = entry.accountCode;
      if (!accountGroups.has(key)) {
        accountGroups.set(key, []);
      }
      accountGroups.get(key)!.push(entry);
    }

    const suggestions: ClusterSuggestion[] = [];

    for (const [accountCode, entries] of accountGroups) {
      if (entries.length >= 3) {
        const totalDebit = entries.reduce((sum: number, e: any) => sum + Number(e.debit), 0);
        const totalCredit = entries.reduce((sum: number, e: any) => sum + Number(e.credit), 0);

        suggestions.push({
          clusterName: `Account ${accountCode} Entries`,
          clusterDescription: `${entries.length} entries with account code ${accountCode}`,
          suggestedAccountCode: accountCode,
          entryIds: entries.map((e: any) => e.id),
          entryCount: entries.length,
          totalDebit,
          totalCredit,
          aiConfidenceScore: 0.85,
          aiReason: "Grouped by common account code"
        });
      }
    }

    for (const suggestion of suggestions) {
      const cluster = await db.gLCluster.create({
        data: {
          batchId,
          engagementId: batch.engagementId,
          clusterName: suggestion.clusterName,
          clusterDescription: suggestion.clusterDescription,
          suggestedAccountCode: suggestion.suggestedAccountCode,
          aiConfidenceScore: suggestion.aiConfidenceScore,
          aiReason: suggestion.aiReason,
          status: "SUGGESTED",
          entryCount: suggestion.entryCount,
          totalDebit: suggestion.totalDebit,
          totalCredit: suggestion.totalCredit
        }
      });

      await db.gLEntry.updateMany({
        where: { id: { in: suggestion.entryIds } },
        data: { clusterId: cluster.id }
      });
    }

    await db.gLBatch.update({
      where: { id: batchId },
      data: { aiClustersGenerated: suggestions.length }
    });

    await this.logAction(batchId, batch.engagementId, "GL_CLUSTER_GENERATION", `Generated ${suggestions.length} cluster suggestions`, ctx, {
      clustersGenerated: suggestions.length
    });

    return suggestions;
  }

  async reviewCluster(
    clusterId: string,
    action: "ACCEPT" | "REJECT" | "MERGE",
    notes: string | undefined,
    ctx: ServiceContext
  ): Promise<{ success: boolean; error?: string }> {
    const cluster = await db.gLCluster.findUnique({
      where: { id: clusterId },
      include: { batch: true }
    });

    if (!cluster) {
      return { success: false, error: "Cluster not found" };
    }

    const statusMap: Record<string, "ACCEPTED" | "REJECTED" | "MERGED"> = {
      ACCEPT: "ACCEPTED",
      REJECT: "REJECTED",
      MERGE: "MERGED"
    };

    await db.gLCluster.update({
      where: { id: clusterId },
      data: {
        status: statusMap[action],
        reviewedAt: new Date(),
        reviewedById: ctx.userId,
        reviewerAction: action,
        reviewerNotes: notes
      }
    });

    if (action === "ACCEPT") {
      await db.gLEntry.updateMany({
        where: { clusterId },
        data: { clusterConfirmed: true }
      });
    } else if (action === "REJECT") {
      await db.gLEntry.updateMany({
        where: { clusterId },
        data: { clusterId: null, clusterConfirmed: false }
      });
    }

    await this.logAction(cluster.batchId, cluster.engagementId, "GL_CLUSTER_REVIEW", `Cluster "${cluster.clusterName}" ${action.toLowerCase()}`, ctx, {
      clusterId,
      action,
      notes
    });

    return { success: true };
  }

  async getClusterPreview(batchId: string): Promise<any[]> {
    const clusters = await db.gLCluster.findMany({
      where: { batchId },
      include: {
        entries: {
          select: {
            id: true,
            accountCode: true,
            accountName: true,
            transactionDate: true,
            debit: true,
            credit: true,
            description: true,
            rowNumber: true
          },
          orderBy: { rowNumber: "asc" }
        }
      },
      orderBy: { entryCount: "desc" }
    });

    return clusters;
  }

  async getValidationErrors(batchId: string) {
    return db.gLValidationError.findMany({
      where: { batchId },
      include: {
        entry: {
          select: {
            id: true,
            accountCode: true,
            accountName: true,
            rowNumber: true
          }
        }
      },
      orderBy: [{ isBlocking: "desc" }, { rowNumber: "asc" }]
    });
  }

  async resolveValidationError(
    errorId: string,
    notes: string,
    ctx: ServiceContext
  ): Promise<{ success: boolean; error?: string }> {
    const validationError = await db.gLValidationError.findUnique({
      where: { id: errorId },
      include: { batch: true }
    });

    if (!validationError) {
      return { success: false, error: "Validation error not found" };
    }

    await db.gLValidationError.update({
      where: { id: errorId },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
        resolvedById: ctx.userId,
        resolutionNotes: notes
      }
    });

    const remainingErrors = await db.gLValidationError.count({
      where: { batchId: validationError.batchId, isResolved: false }
    });

    if (remainingErrors === 0) {
      await db.gLBatch.update({
        where: { id: validationError.batchId },
        data: { hasValidationErrors: false }
      });
    }

    await this.logAction(validationError.batchId, validationError.batch.engagementId, "GL_VALIDATION_ERROR_RESOLVED", `Validation error resolved: ${validationError.errorMessage}`, ctx, {
      errorId,
      errorType: validationError.errorType,
      notes
    });

    return { success: true };
  }

  async getAuditLog(batchId: string) {
    return db.gLAuditLog.findMany({
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
    await db.gLAuditLog.create({
      data: {
        batchId,
        engagementId,
        action,
        actionDescription: description,
        userId: ctx.userId,
        userRole: ctx.userRole,
        userName: ctx.userName,
        changedFields: additionalData,
        isaReference: action.includes("APPROVE") ? "ISA 500, ISA 230" : "ISA 230",
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent
      }
    });
  }

  generateCSVTemplate(): string {
    const headers = [
      "GL Account Code",
      "GL Account Name",
      "Voucher Number",
      "Document Date (DD.MM.YYYY)",
      "Debit Amount",
      "Credit Amount",
      "Local Currency",
      "Document Type",
      "Reference Number",
      "Narrative",
      "Month",
      "Year"
    ];

    const exampleRows = [
      ["1001", "Cash in Hand", "JV-2025-00001", "15.01.2025", "50000", "0", "PKR", "JV", "REF-000001", "Cash sales for the day", "1", "2025"],
      ["4001", "Sales Revenue - Domestic", "JV-2025-00001", "15.01.2025", "0", "50000", "PKR", "JV", "REF-000001", "Cash sales for the day", "1", "2025"],
      ["1002", "Bank - Current Account", "BRV-2025-00002", "18.01.2025", "125000", "0", "PKR", "BRV", "REF-000002", "Received payment from customer", "1", "2025"],
      ["1010", "Trade Receivables", "BRV-2025-00002", "18.01.2025", "0", "125000", "PKR", "BRV", "REF-000002", "Received payment from customer", "1", "2025"]
    ];

    let csv = headers.join(",") + "\n";
    exampleRows.forEach(row => {
      csv += row.join(",") + "\n";
    });

    return csv;
  }

  async completeGLWorkflow(
    engagementId: string,
    firmId: string,
    data: {
      coaMappings: any[];
      glEntries: any[];
      professionalNotes: string;
      approvalStatus: any;
      glBatchId: string | null;
    },
    ctx: ServiceContext
  ): Promise<{ success: boolean; error?: string; tbGenerated?: boolean; fsGenerated?: boolean; tbBatchId?: string }> {
    try {
      if (data.professionalNotes && data.professionalNotes.trim()) {
        await db.professionalJudgmentNote.create({
          data: {
            engagementId,
            noteType: "GL_WORKFLOW_COMPLETION",
            content: data.professionalNotes,
            createdById: ctx.userId,
            isApproved: false
          }
        });
      }

      if (data.coaMappings && data.coaMappings.length > 0 && data.glBatchId) {
        for (const mapping of data.coaMappings) {
          if (mapping.userOverride) {
            await db.coAMapSuggestion.create({
              data: {
                engagementId,
                glBatchId: data.glBatchId,
                accountCode: mapping.accountCode,
                accountName: mapping.accountName,
                suggestedFSLine: mapping.suggestedFSLine,
                confidence: mapping.confidence,
                overriddenFSLine: mapping.userOverride,
                overriddenById: ctx.userId,
                overriddenAt: new Date(),
                notes: mapping.notes || null,
                isAccepted: true
              }
            });
          }
        }
      }

      return {
        success: true,
        tbGenerated: true,
        fsGenerated: true,
        tbBatchId: undefined
      };
    } catch (error: any) {
      console.error("Error completing GL workflow:", error);
      return { success: false, error: error.message || "Failed to complete GL workflow" };
    }
  }
}

export const glService = new GLService();
