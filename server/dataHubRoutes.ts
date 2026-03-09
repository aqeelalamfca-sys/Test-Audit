import { Router, Response } from "express";
import { z } from "zod";
import { dataHub } from "./services/dataHub";
import {
  ledgerService,
  tbService,
  fsService,
  riskService,
  procedureService,
  adjustmentService,
  evidenceService,
  signoffService,
  pdfPackService
} from "./services/dataHubDomainServices";
import { requireAuth, requireRoles, type AuthenticatedRequest } from "./auth";
import { prisma } from "./db";

const router = Router();

router.get("/entities/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const entityType = req.query.entityType as string | undefined;
    
    const entities = await dataHub.listEntities(engagementId, entityType as any);
    res.json(entities);
  } catch (error: any) {
    console.error("Error listing DataHub entities:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/entity/:engagementId/:entityType/:entityCode", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, entityType, entityCode } = req.params;
    const user = req.user!;
    const preferDraft = req.query.preferDraft === "true";
    const versionId = req.query.versionId as string | undefined;
    
    const result = await dataHub.read(
      engagementId,
      entityType as any,
      entityCode,
      user.id,
      user.role,
      { preferDraft, versionId }
    );
    
    if (!result) {
      return res.status(404).json({ error: "Entity or version not found" });
    }
    
    res.json(result);
  } catch (error: any) {
    console.error("Error reading DataHub entity:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/entity/:engagementId/:entityType/:entityCode/approved", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, entityType, entityCode } = req.params;
    const user = req.user!;
    
    const result = await dataHub.getLatestApproved(
      engagementId,
      entityType as any,
      entityCode,
      user.id,
      user.role
    );
    
    if (!result) {
      return res.status(404).json({ error: "No approved version found" });
    }
    
    res.json(result);
  } catch (error: any) {
    console.error("Error reading approved version:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/entity/:engagementId/:entityType/:entityCode/status", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, entityType, entityCode } = req.params;
    
    const status = await dataHub.getEntityStatus(engagementId, entityType as any, entityCode);
    
    if (!status) {
      return res.status(404).json({ error: "Entity not found" });
    }
    
    res.json(status);
  } catch (error: any) {
    console.error("Error getting entity status:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/entity/:engagementId/:entityType/:entityCode/history", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, entityType, entityCode } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;
    
    const history = await dataHub.getVersionHistory(engagementId, entityType as any, entityCode, limit);
    res.json(history);
  } catch (error: any) {
    console.error("Error getting version history:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/draft/start", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { engagementId, entityType, entityCode, entityName, data, changeDescription, isaReference } = req.body;
    
    const result = await dataHub.startDraft(
      engagementId,
      entityType,
      entityCode,
      entityName,
      data,
      user.id,
      user.role,
      { changeDescription, isaReference }
    );
    
    res.json(result);
  } catch (error: any) {
    console.error("Error starting draft:", error);
    res.status(400).json({ error: error.message });
  }
});

router.put("/draft/update", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { engagementId, entityType, entityCode, data, changeDescription } = req.body;
    
    const result = await dataHub.updateDraft(
      engagementId,
      entityType,
      entityCode,
      data,
      user.id,
      user.role,
      changeDescription
    );
    
    res.json(result);
  } catch (error: any) {
    console.error("Error updating draft:", error);
    res.status(400).json({ error: error.message });
  }
});

router.post("/draft/discard", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { engagementId, entityType, entityCode, reason } = req.body;
    
    const result = await dataHub.discardDraft(
      engagementId,
      entityType,
      entityCode,
      user.id,
      user.role,
      reason
    );
    
    res.json(result);
  } catch (error: any) {
    console.error("Error discarding draft:", error);
    res.status(400).json({ error: error.message });
  }
});

router.post("/workflow/submit-for-review", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { engagementId, entityType, entityCode } = req.body;
    
    const result = await dataHub.submitForReview(
      engagementId,
      entityType,
      entityCode,
      user.id,
      user.role
    );
    
    res.json(result);
  } catch (error: any) {
    console.error("Error submitting for review:", error);
    res.status(400).json({ error: error.message });
  }
});

router.post("/workflow/review", requireAuth, requireRoles("SENIOR", "MANAGER", "PARTNER", "EQCR", "FIRM_ADMIN"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { engagementId, entityType, entityCode, approved, comments, partnerPinUsed, digitalSignature } = req.body;
    
    const result = await dataHub.review(
      engagementId,
      entityType,
      entityCode,
      approved,
      user.id,
      user.role,
      {
        comments,
        partnerPinUsed,
        digitalSignature,
        ipAddress: req.ip || undefined,
        userAgent: req.headers["user-agent"] || undefined
      }
    );
    
    res.json(result);
  } catch (error: any) {
    console.error("Error reviewing:", error);
    res.status(400).json({ error: error.message });
  }
});

router.post("/workflow/approve", requireAuth, requireRoles("PARTNER", "FIRM_ADMIN"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { engagementId, entityType, entityCode, approved, comments, partnerPinUsed, digitalSignature } = req.body;
    
    const result = await dataHub.approve(
      engagementId,
      entityType,
      entityCode,
      approved,
      user.id,
      user.role,
      {
        comments,
        partnerPinUsed,
        digitalSignature,
        ipAddress: req.ip || undefined,
        userAgent: req.headers["user-agent"] || undefined
      }
    );
    
    res.json(result);
  } catch (error: any) {
    console.error("Error approving:", error);
    res.status(400).json({ error: error.message });
  }
});

router.post("/permissions/grant-draft", requireAuth, requireRoles("MANAGER", "PARTNER", "FIRM_ADMIN"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const grantedBy = req.user!;
    const { engagementId, userId, entityType, entityId, expiresAt, reason } = req.body;
    
    const result = await dataHub.grantDraftPermission(
      engagementId,
      userId,
      grantedBy.id,
      entityType,
      entityId,
      expiresAt ? new Date(expiresAt) : undefined,
      reason
    );
    
    res.json(result);
  } catch (error: any) {
    console.error("Error granting draft permission:", error);
    res.status(400).json({ error: error.message });
  }
});

router.post("/permissions/revoke-draft", requireAuth, requireRoles("MANAGER", "PARTNER", "FIRM_ADMIN"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const revokedBy = req.user!;
    const { permissionId, reason } = req.body;
    
    const result = await dataHub.revokeDraftPermission(permissionId, revokedBy.id, reason);
    res.json(result);
  } catch (error: any) {
    console.error("Error revoking draft permission:", error);
    res.status(400).json({ error: error.message });
  }
});

router.get("/permissions/check-draft/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { engagementId } = req.params;
    const entityType = req.query.entityType as string | undefined;
    const entityId = req.query.entityId as string | undefined;
    
    const hasPermission = await dataHub.hasDraftPermission(
      engagementId,
      user.id,
      entityType as any,
      entityId
    );
    
    res.json({ hasPermission });
  } catch (error: any) {
    console.error("Error checking draft permission:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/ledger/:engagementId/:periodId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { engagementId, periodId } = req.params;
    const preferDraft = req.query.preferDraft === "true";
    
    const result = await ledgerService.getGeneralLedger(
      engagementId,
      periodId,
      { userId: user.id, userRole: user.role },
      { preferDraft }
    );
    
    if (!result) {
      return res.status(404).json({ error: "Ledger not found" });
    }
    
    res.json(result);
  } catch (error: any) {
    console.error("Error getting ledger:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/trial-balance/:engagementId/:periodId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { engagementId, periodId } = req.params;
    const preferDraft = req.query.preferDraft === "true";
    
    const result = await tbService.getTrialBalance(
      engagementId,
      periodId,
      { userId: user.id, userRole: user.role },
      { preferDraft }
    );
    
    if (!result) {
      return res.status(404).json({ error: "Trial balance not found" });
    }
    
    res.json(result);
  } catch (error: any) {
    console.error("Error getting trial balance:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/financial-statements/:engagementId/:periodId/:statementType", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { engagementId, periodId, statementType } = req.params;
    const preferDraft = req.query.preferDraft === "true";
    
    const result = await fsService.getFinancialStatements(
      engagementId,
      periodId,
      statementType as any,
      { userId: user.id, userRole: user.role },
      { preferDraft }
    );
    
    if (!result) {
      return res.status(404).json({ error: "Financial statements not found" });
    }
    
    res.json(result);
  } catch (error: any) {
    console.error("Error getting financial statements:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/financial-statements/:engagementId/:periodId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { engagementId, periodId } = req.params;
    
    const result = await fsService.getAllFinancialStatements(
      engagementId,
      periodId,
      { userId: user.id, userRole: user.role }
    );
    
    res.json(result);
  } catch (error: any) {
    console.error("Error getting all financial statements:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/risk-assessments/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const risks = await riskService.getAllRiskAssessments(engagementId);
    res.json(risks);
  } catch (error: any) {
    console.error("Error getting risk assessments:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/risk-assessment/:engagementId/:areaCode", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { engagementId, areaCode } = req.params;
    const preferDraft = req.query.preferDraft === "true";
    
    const result = await riskService.getRiskAssessment(
      engagementId,
      areaCode,
      { userId: user.id, userRole: user.role },
      { preferDraft }
    );
    
    if (!result) {
      return res.status(404).json({ error: "Risk assessment not found" });
    }
    
    res.json(result);
  } catch (error: any) {
    console.error("Error getting risk assessment:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/procedures/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const procedures = await procedureService.getAllProcedures(engagementId);
    res.json(procedures);
  } catch (error: any) {
    console.error("Error getting procedures:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/procedure/:engagementId/:procedureCode", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { engagementId, procedureCode } = req.params;
    const preferDraft = req.query.preferDraft === "true";
    
    const result = await procedureService.getProcedure(
      engagementId,
      procedureCode,
      { userId: user.id, userRole: user.role },
      { preferDraft }
    );
    
    if (!result) {
      return res.status(404).json({ error: "Procedure not found" });
    }
    
    res.json(result);
  } catch (error: any) {
    console.error("Error getting procedure:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/adjustments/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const adjustments = await adjustmentService.getAllAdjustments(engagementId);
    res.json(adjustments);
  } catch (error: any) {
    console.error("Error getting adjustments:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/adjustments/:engagementId/summary", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { engagementId } = req.params;
    
    const summary = await adjustmentService.getAdjustmentsSummary(
      engagementId,
      { userId: user.id, userRole: user.role }
    );
    
    res.json(summary);
  } catch (error: any) {
    console.error("Error getting adjustments summary:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/evidence/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const evidence = await evidenceService.getAllEvidence(engagementId);
    res.json(evidence);
  } catch (error: any) {
    console.error("Error getting evidence:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/signoff-registers/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const registers = await signoffService.getAllSignOffRegisters(engagementId);
    res.json(registers);
  } catch (error: any) {
    console.error("Error getting sign-off registers:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/pdf-packs/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const packs = await pdfPackService.getAllPDFPacks(engagementId);
    res.json(packs);
  } catch (error: any) {
    console.error("Error getting PDF packs:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// UNIFIED DATA HUB CRUD ROUTES FOR DATASETS
// ============================================================

const VALID_DATASETS = ["tb", "gl", "ap", "ar", "bank", "other"] as const;
type DatasetType = typeof VALID_DATASETS[number];

// Map dataset types to party types for ImportPartyBalance
const PARTY_TYPE_MAP: Record<string, string> = {
  ap: "VENDOR",
  ar: "CUSTOMER", 
  other: "OTHER"
};

// Zod schemas for each dataset
const tbCreateSchema = z.object({
  accountCode: z.string().min(1, "Account code is required"),
  accountName: z.string().optional().default(""),
  openingBalance: z.union([z.number(), z.string().transform(v => parseFloat(v) || 0)]).optional().default(0),
  debits: z.union([z.number(), z.string().transform(v => parseFloat(v) || 0)]).optional().default(0),
  credits: z.union([z.number(), z.string().transform(v => parseFloat(v) || 0)]).optional().default(0),
  closingBalance: z.union([z.number(), z.string().transform(v => parseFloat(v) || 0)]).optional().default(0),
  priorYearBalance: z.union([z.number(), z.string().transform(v => parseFloat(v) || 0)]).optional().nullable(),
  budgetAmount: z.union([z.number(), z.string().transform(v => parseFloat(v) || 0)]).optional().nullable(),
});

const tbUpdateSchema = tbCreateSchema.partial();

const glCreateSchema = z.object({
  accountCode: z.string().min(1, "Account code is required"),
  accountName: z.string().optional().default(""),
  transactionDate: z.string().min(1, "Transaction date is required"),
  debit: z.union([z.number(), z.string().transform(v => parseFloat(v) || 0)]).optional().default(0),
  credit: z.union([z.number(), z.string().transform(v => parseFloat(v) || 0)]).optional().default(0),
  voucherNumber: z.string().optional().nullable(),
  documentType: z.string().optional().nullable(),
  narrative: z.string().optional().nullable(),
  referenceNumber: z.string().optional().nullable(),
  costCenter: z.string().optional().nullable(),
  counterparty: z.string().optional().nullable(),
});

const glUpdateSchema = glCreateSchema.partial();

const partyBalanceCreateSchema = z.object({
  partyCode: z.string().min(1, "Party code is required"),
  partyName: z.string().optional().nullable(),
  controlAccountCode: z.string().min(1, "Control account code is required"),
  balanceType: z.enum(["OB", "CB"]).default("CB"),
  asOfDate: z.string().min(1, "As of date is required"),
  balance: z.union([z.number(), z.string().transform(v => parseFloat(v) || 0)]).default(0),
  drcr: z.enum(["DR", "CR"]).default("DR"),
  partyEmail: z.string().email().optional().nullable().or(z.literal("")),
  partyAddress: z.string().optional().nullable(),
  attentionTo: z.string().optional().nullable(),
});

const partyBalanceUpdateSchema = partyBalanceCreateSchema.partial();

const bankAccountCreateSchema = z.object({
  bankAccountCode: z.string().min(1, "Bank account code is required"),
  bankName: z.string().min(1, "Bank name is required"),
  accountNo: z.string().min(1, "Account number is required"),
  accountTitle: z.string().min(1, "Account title is required"),
  branchName: z.string().optional().nullable(),
  branchAddress: z.string().optional().nullable(),
  iban: z.string().optional().nullable(),
  relationshipManager: z.string().optional().nullable(),
  bankEmail: z.string().email().optional().nullable().or(z.literal("")),
  currency: z.string().optional().default("PKR"),
});

const bankAccountUpdateSchema = bankAccountCreateSchema.partial();

// ============================================================
// VALIDATION FUNCTIONS FOR DATASET ROWS
// ============================================================

interface ValidationError {
  field: string;
  message: string;
  type: 'error' | 'warning';
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

// TB Validation: Balance checks and required fields
function validateTBRow(data: any, allRows?: any[]): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  
  // Required fields
  if (!data.accountCode || data.accountCode.trim() === '') {
    errors.push({ field: 'accountCode', message: 'Account code is required', type: 'error' });
  }
  if (!data.accountName || data.accountName.trim() === '') {
    errors.push({ field: 'accountName', message: 'Account name is required', type: 'error' });
  }
  
  // Balance warnings (individual row level - DR/CR balance check is typically at aggregate level)
  const openingDr = parseFloat(data.openingDebit) || 0;
  const openingCr = parseFloat(data.openingCredit) || 0;
  const movementDr = parseFloat(data.movementDebit) || parseFloat(data.debits) || 0;
  const movementCr = parseFloat(data.movementCredit) || parseFloat(data.credits) || 0;
  const closingDr = parseFloat(data.closingDebit) || 0;
  const closingCr = parseFloat(data.closingCredit) || 0;
  
  // For individual rows, opening + movement should approximately equal closing
  const expectedClosingDr = openingDr + movementDr;
  const expectedClosingCr = openingCr + movementCr;
  
  if (Math.abs(closingDr - expectedClosingDr) > 0.01 && closingDr !== 0) {
    warnings.push({ 
      field: 'closingDebit', 
      message: 'Closing DR may not reconcile with Opening DR + Movement DR', 
      type: 'warning' 
    });
  }
  
  if (Math.abs(closingCr - expectedClosingCr) > 0.01 && closingCr !== 0) {
    warnings.push({ 
      field: 'closingCredit', 
      message: 'Closing CR may not reconcile with Opening CR + Movement CR', 
      type: 'warning' 
    });
  }
  
  return { valid: errors.length === 0, errors, warnings };
}

// GL Validation: Debit/Credit cannot both be non-zero, required fields
function validateGLRow(data: any): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  
  // Required fields
  if (!data.accountCode || data.accountCode.trim() === '') {
    errors.push({ field: 'accountCode', message: 'Account code is required', type: 'error' });
  }
  if (!data.transactionDate) {
    errors.push({ field: 'transactionDate', message: 'Transaction date is required', type: 'error' });
  }
  
  // Debit and credit cannot both be non-zero
  const debit = parseFloat(data.debit) || 0;
  const credit = parseFloat(data.credit) || 0;
  
  if (debit !== 0 && credit !== 0) {
    errors.push({ 
      field: 'debit', 
      message: 'Debit and credit cannot both be non-zero in the same row', 
      type: 'error' 
    });
    errors.push({ 
      field: 'credit', 
      message: 'Debit and credit cannot both be non-zero in the same row', 
      type: 'error' 
    });
  }
  
  // At least one of debit or credit should have a value
  if (debit === 0 && credit === 0) {
    warnings.push({ 
      field: 'debit', 
      message: 'Entry has no debit or credit value', 
      type: 'warning' 
    });
  }
  
  // Validate date format
  if (data.transactionDate && isNaN(Date.parse(data.transactionDate))) {
    errors.push({ field: 'transactionDate', message: 'Invalid date format', type: 'error' });
  }
  
  return { valid: errors.length === 0, errors, warnings };
}

// AP/AR Validation: Required fields, positive amount
function validatePartyBalanceRow(data: any): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  
  // Required fields
  if (!data.partyCode || data.partyCode.trim() === '') {
    errors.push({ field: 'partyCode', message: 'Party code is required', type: 'error' });
  }
  if (!data.partyName || data.partyName.trim() === '') {
    errors.push({ field: 'partyName', message: 'Party name is required', type: 'error' });
  }
  
  // Amount/Balance validation
  const balance = parseFloat(data.balance) || parseFloat(data.amount) || 0;
  if (balance < 0) {
    errors.push({ 
      field: 'balance', 
      message: 'Amount/Balance must be positive (use DR/CR to indicate direction)', 
      type: 'error' 
    });
  }
  
  if (balance === 0) {
    warnings.push({ 
      field: 'balance', 
      message: 'Balance is zero - verify if this is correct', 
      type: 'warning' 
    });
  }
  
  // Date validation
  if (data.asOfDate && isNaN(Date.parse(data.asOfDate))) {
    errors.push({ field: 'asOfDate', message: 'Invalid date format', type: 'error' });
  }
  
  return { valid: errors.length === 0, errors, warnings };
}

// Bank Validation: Required fields, valid balance
function validateBankAccountRow(data: any): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  
  // Required fields
  if (!data.bankName || data.bankName.trim() === '') {
    errors.push({ field: 'bankName', message: 'Bank name is required', type: 'error' });
  }
  if (!data.accountNo || data.accountNo.trim() === '') {
    errors.push({ field: 'accountNo', message: 'Account number is required', type: 'error' });
  }
  if (!data.currency || data.currency.trim() === '') {
    errors.push({ field: 'currency', message: 'Currency is required', type: 'error' });
  }
  
  // Statement balance validation (if provided)
  if (data.statementBalance !== undefined && data.statementBalance !== null && data.statementBalance !== '') {
    const balance = parseFloat(data.statementBalance);
    if (isNaN(balance)) {
      errors.push({ 
        field: 'statementBalance', 
        message: 'Statement balance must be a valid number', 
        type: 'error' 
      });
    }
  }
  
  // IBAN format check (basic)
  if (data.iban && data.iban.trim() !== '') {
    const ibanClean = data.iban.replace(/\s/g, '');
    if (ibanClean.length < 15 || ibanClean.length > 34) {
      warnings.push({ 
        field: 'iban', 
        message: 'IBAN length seems incorrect (should be 15-34 characters)', 
        type: 'warning' 
      });
    }
  }
  
  return { valid: errors.length === 0, errors, warnings };
}

// Master validation function that routes to appropriate validator
function validateDatasetRow(dataset: string, data: any, allRows?: any[]): ValidationResult {
  switch (dataset) {
    case 'tb':
      return validateTBRow(data, allRows);
    case 'gl':
      return validateGLRow(data);
    case 'ap':
    case 'ar':
    case 'other':
      return validatePartyBalanceRow(data);
    case 'bank':
      return validateBankAccountRow(data);
    default:
      return { valid: true, errors: [], warnings: [] };
  }
}

// Aggregate validation for TB (checks total DR = CR)
async function validateTBAggregates(engagementId: string, trialBalanceId: string): Promise<ValidationResult> {
  const warnings: ValidationError[] = [];
  
  const aggregates = await prisma.trialBalanceLine.aggregate({
    where: { trialBalanceId },
    _sum: {
      openingBalance: true,
      debits: true,
      credits: true,
      closingBalance: true,
    }
  });
  
  const openingBalance = aggregates._sum.openingBalance || 0;
  const totalDebits = Number(aggregates._sum.debits || 0);
  const totalCredits = Number(aggregates._sum.credits || 0);
  
  if (Math.abs(totalDebits - totalCredits) > 0.01) {
    warnings.push({
      field: '_aggregate',
      message: `Trial Balance is out of balance: Total Debits (${totalDebits.toLocaleString()}) ≠ Total Credits (${totalCredits.toLocaleString()})`,
      type: 'warning'
    });
  }
  
  return { valid: true, errors: [], warnings };
}

// Aggregate validation for GL (checks batch balance)
async function validateGLBatchBalance(batchId: string): Promise<ValidationResult> {
  const warnings: ValidationError[] = [];
  
  const aggregates = await prisma.gLEntry.aggregate({
    where: { batchId },
    _sum: {
      debit: true,
      credit: true,
    }
  });
  
  const totalDebit = Number(aggregates._sum.debit || 0);
  const totalCredit = Number(aggregates._sum.credit || 0);
  
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    warnings.push({
      field: '_aggregate',
      message: `Batch is out of balance: Total Debits (${totalDebit.toLocaleString()}) ≠ Total Credits (${totalCredit.toLocaleString()})`,
      type: 'warning'
    });
  }
  
  return { valid: true, errors: [], warnings };
}

// Helper to create audit trail entry
async function createAuditTrailEntry(
  engagementId: string,
  userId: string,
  userRole: string,
  action: string,
  entityType: string,
  entityId: string,
  beforeValue: any,
  afterValue: any
) {
  return prisma.auditTrail.create({
    data: {
      engagementId,
      userId,
      userRole,
      action,
      entityType: `dataset_${entityType}`,
      entityId,
      beforeValue: beforeValue ? JSON.parse(JSON.stringify(beforeValue)) : null,
      afterValue: afterValue ? JSON.parse(JSON.stringify(afterValue)) : null,
      module: "DATA_HUB",
      screen: "DATA_MANAGEMENT",
    }
  });
}

// Helper to get or create default batch/TB for an engagement
async function getOrCreateDefaultBatch(engagementId: string, userId: string): Promise<string> {
  const existing = await prisma.importBatch.findFirst({
    where: { engagementId, status: "APPROVED" },
    orderBy: { uploadedAt: "desc" },
  });
  if (existing) return existing.id;
  
  // Create a new batch if none exists
  const batch = await prisma.importBatch.create({
    data: {
      engagementId,
      batchNumber: `BATCH-${Date.now()}`,
      status: "APPROVED",
      uploadedById: userId,
    }
  });
  return batch.id;
}

async function getOrCreateDefaultTrialBalance(engagementId: string, userId: string): Promise<string> {
  const existing = await prisma.trialBalance.findFirst({
    where: { engagementId },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing.id;
  
  // Create a new TB if none exists
  const tb = await prisma.trialBalance.create({
    data: {
      engagementId,
      periodEnd: new Date(),
      importedById: userId,
    }
  });
  return tb.id;
}

// GET /engagements/:engagementId/data/:dataset - List with pagination
router.get("/engagements/:engagementId/data/:dataset", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, dataset } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 50, 500);
    const search = (req.query.search as string) || "";
    const sortField = (req.query.sortField as string) || "createdAt";
    const sortOrder = (req.query.sortOrder as string) === "asc" ? "asc" : "desc";
    
    if (!VALID_DATASETS.includes(dataset as DatasetType)) {
      return res.status(400).json({ error: `Invalid dataset type. Must be one of: ${VALID_DATASETS.join(", ")}` });
    }
    
    const skip = (page - 1) * pageSize;
    
    let data: any[] = [];
    let totalCount = 0;
    
    switch (dataset) {
      case "tb": {
        const where: any = {
          trialBalance: { engagementId }
        };
        if (search) {
          where.OR = [
            { accountCode: { contains: search, mode: "insensitive" } },
            { accountName: { contains: search, mode: "insensitive" } },
          ];
        }
        [data, totalCount] = await Promise.all([
          prisma.trialBalanceLine.findMany({
            where,
            skip,
            take: pageSize,
            orderBy: { [sortField]: sortOrder },
            include: { trialBalance: { select: { periodEnd: true, periodType: true } } },
          }),
          prisma.trialBalanceLine.count({ where }),
        ]);
        break;
      }
      
      case "gl": {
        const where: any = { engagementId };
        if (search) {
          where.OR = [
            { accountCode: { contains: search, mode: "insensitive" } },
            { accountName: { contains: search, mode: "insensitive" } },
            { voucherNumber: { contains: search, mode: "insensitive" } },
            { narrative: { contains: search, mode: "insensitive" } },
          ];
        }
        [data, totalCount] = await Promise.all([
          prisma.gLEntry.findMany({
            where,
            skip,
            take: pageSize,
            orderBy: { [sortField]: sortOrder },
          }),
          prisma.gLEntry.count({ where }),
        ]);
        break;
      }
      
      case "ap":
      case "ar":
      case "other": {
        const partyType = PARTY_TYPE_MAP[dataset];
        const where: any = { engagementId, partyType };
        if (search) {
          where.OR = [
            { partyCode: { contains: search, mode: "insensitive" } },
            { partyName: { contains: search, mode: "insensitive" } },
            { controlAccountCode: { contains: search, mode: "insensitive" } },
          ];
        }
        [data, totalCount] = await Promise.all([
          prisma.importPartyBalance.findMany({
            where,
            skip,
            take: pageSize,
            orderBy: { [sortField]: sortOrder },
          }),
          prisma.importPartyBalance.count({ where }),
        ]);
        break;
      }
      
      case "bank": {
        const where: any = { engagementId };
        if (search) {
          where.OR = [
            { bankAccountCode: { contains: search, mode: "insensitive" } },
            { bankName: { contains: search, mode: "insensitive" } },
            { accountNo: { contains: search, mode: "insensitive" } },
            { accountTitle: { contains: search, mode: "insensitive" } },
          ];
        }
        [data, totalCount] = await Promise.all([
          prisma.importBankAccount.findMany({
            where,
            skip,
            take: pageSize,
            orderBy: { [sortField]: sortOrder },
          }),
          prisma.importBankAccount.count({ where }),
        ]);
        break;
      }
    }
    
    const totalPages = Math.ceil(totalCount / pageSize);
    res.json({
      data,
      meta: {
        page,
        pageSize,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error: any) {
    console.error("Error fetching dataset:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /engagements/:engagementId/data/:dataset - Create row
router.post("/engagements/:engagementId/data/:dataset", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, dataset } = req.params;
    const user = req.user!;
    
    if (!VALID_DATASETS.includes(dataset as DatasetType)) {
      return res.status(400).json({ error: `Invalid dataset type. Must be one of: ${VALID_DATASETS.join(", ")}` });
    }
    
    // Run dataset-specific validation
    const validationResult = validateDatasetRow(dataset, req.body);
    if (!validationResult.valid) {
      return res.status(400).json({ 
        error: "Validation failed", 
        validationErrors: validationResult.errors,
        validationWarnings: validationResult.warnings 
      });
    }
    
    let created: any;
    let aggregateWarnings: ValidationError[] = validationResult.warnings;
    
    switch (dataset) {
      case "tb": {
        const validated = tbCreateSchema.parse(req.body);
        const trialBalanceId = await getOrCreateDefaultTrialBalance(engagementId, user.id);
        created = await prisma.trialBalanceLine.create({
          data: {
            trialBalanceId,
            accountCode: validated.accountCode,
            accountName: validated.accountName || "",
            openingBalance: validated.openingBalance,
            debits: validated.debits,
            credits: validated.credits,
            closingBalance: validated.closingBalance,
            priorYearBalance: validated.priorYearBalance,
            budgetAmount: validated.budgetAmount,
          }
        });
        break;
      }
      
      case "gl": {
        const validated = glCreateSchema.parse(req.body);
        const batchId = await getOrCreateDefaultBatch(engagementId, user.id);
        const maxRow = await prisma.gLEntry.findFirst({
          where: { engagementId },
          orderBy: { rowNumber: "desc" },
          select: { rowNumber: true },
        });
        created = await prisma.gLEntry.create({
          data: {
            batchId,
            engagementId,
            accountCode: validated.accountCode,
            accountName: validated.accountName || "",
            transactionDate: new Date(validated.transactionDate),
            debit: validated.debit,
            credit: validated.credit,
            voucherNumber: validated.voucherNumber,
            documentType: validated.documentType,
            narrative: validated.narrative,
            referenceNumber: validated.referenceNumber,
            costCenter: validated.costCenter,
            counterparty: validated.counterparty,
            rowNumber: (maxRow?.rowNumber || 0) + 1,
          }
        });
        break;
      }
      
      case "ap":
      case "ar":
      case "other": {
        const validated = partyBalanceCreateSchema.parse(req.body);
        const batchId = await getOrCreateDefaultBatch(engagementId, user.id);
        const partyType = PARTY_TYPE_MAP[dataset];
        created = await prisma.importPartyBalance.create({
          data: {
            batchId,
            engagementId,
            partyCode: validated.partyCode,
            partyName: validated.partyName,
            partyType,
            controlAccountCode: validated.controlAccountCode,
            balanceType: validated.balanceType,
            asOfDate: new Date(validated.asOfDate),
            balance: validated.balance,
            drcr: validated.drcr,
            partyEmail: validated.partyEmail || null,
            partyAddress: validated.partyAddress,
            attentionTo: validated.attentionTo,
          }
        });
        break;
      }
      
      case "bank": {
        const validated = bankAccountCreateSchema.parse(req.body);
        const batchId = await getOrCreateDefaultBatch(engagementId, user.id);
        created = await prisma.importBankAccount.create({
          data: {
            batchId,
            engagementId,
            bankAccountCode: validated.bankAccountCode,
            bankName: validated.bankName,
            accountNo: validated.accountNo,
            accountTitle: validated.accountTitle,
            branchName: validated.branchName,
            branchAddress: validated.branchAddress,
            iban: validated.iban,
            relationshipManager: validated.relationshipManager,
            bankEmail: validated.bankEmail || null,
            currency: validated.currency,
          }
        });
        break;
      }
    }
    
    // Create audit trail entry
    await createAuditTrailEntry(
      engagementId,
      user.id,
      user.role,
      "CREATE",
      dataset,
      created.id,
      null,
      created
    );
    
    // Return created data with any validation warnings
    res.status(201).json({ 
      ...created, 
      _validationWarnings: aggregateWarnings.length > 0 ? aggregateWarnings : undefined 
    });
  } catch (error: any) {
    console.error("Error creating dataset row:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

// PATCH /engagements/:engagementId/data/:dataset/:rowId - Update row
router.patch("/engagements/:engagementId/data/:dataset/:rowId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, dataset, rowId } = req.params;
    const user = req.user!;
    
    if (!VALID_DATASETS.includes(dataset as DatasetType)) {
      return res.status(400).json({ error: `Invalid dataset type. Must be one of: ${VALID_DATASETS.join(", ")}` });
    }
    
    // Run dataset-specific validation
    const validationResult = validateDatasetRow(dataset, req.body);
    if (!validationResult.valid) {
      return res.status(400).json({ 
        error: "Validation failed", 
        validationErrors: validationResult.errors,
        validationWarnings: validationResult.warnings 
      });
    }
    
    let beforeValue: any;
    let updated: any;
    let aggregateWarnings: ValidationError[] = validationResult.warnings;
    
    switch (dataset) {
      case "tb": {
        beforeValue = await prisma.trialBalanceLine.findUnique({ where: { id: rowId } });
        if (!beforeValue) {
          return res.status(404).json({ error: "Record not found" });
        }
        const validated = tbUpdateSchema.parse(req.body);
        updated = await prisma.trialBalanceLine.update({
          where: { id: rowId },
          data: validated,
        });
        break;
      }
      
      case "gl": {
        beforeValue = await prisma.gLEntry.findUnique({ where: { id: rowId } });
        if (!beforeValue) {
          return res.status(404).json({ error: "Record not found" });
        }
        const validated = glUpdateSchema.parse(req.body);
        const updateData: any = { ...validated };
        if (validated.transactionDate) {
          updateData.transactionDate = new Date(validated.transactionDate);
        }
        updated = await prisma.gLEntry.update({
          where: { id: rowId },
          data: updateData,
        });
        break;
      }
      
      case "ap":
      case "ar":
      case "other": {
        beforeValue = await prisma.importPartyBalance.findUnique({ where: { id: rowId } });
        if (!beforeValue) {
          return res.status(404).json({ error: "Record not found" });
        }
        const validated = partyBalanceUpdateSchema.parse(req.body);
        const updateData: any = { ...validated };
        if (validated.asOfDate) {
          updateData.asOfDate = new Date(validated.asOfDate);
        }
        updated = await prisma.importPartyBalance.update({
          where: { id: rowId },
          data: updateData,
        });
        break;
      }
      
      case "bank": {
        beforeValue = await prisma.importBankAccount.findUnique({ where: { id: rowId } });
        if (!beforeValue) {
          return res.status(404).json({ error: "Record not found" });
        }
        const validated = bankAccountUpdateSchema.parse(req.body);
        updated = await prisma.importBankAccount.update({
          where: { id: rowId },
          data: validated,
        });
        break;
      }
    }
    
    // Create audit trail entry
    await createAuditTrailEntry(
      engagementId,
      user.id,
      user.role,
      "UPDATE",
      dataset,
      rowId,
      beforeValue,
      updated
    );
    
    // Return updated data with any validation warnings
    res.json({ 
      ...updated, 
      _validationWarnings: aggregateWarnings.length > 0 ? aggregateWarnings : undefined 
    });
  } catch (error: any) {
    console.error("Error updating dataset row:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

// DELETE /engagements/:engagementId/data/:dataset/:rowId - Delete row
router.delete("/engagements/:engagementId/data/:dataset/:rowId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId, dataset, rowId } = req.params;
    const user = req.user!;
    
    if (!VALID_DATASETS.includes(dataset as DatasetType)) {
      return res.status(400).json({ error: `Invalid dataset type. Must be one of: ${VALID_DATASETS.join(", ")}` });
    }
    
    let beforeValue: any;
    
    switch (dataset) {
      case "tb": {
        beforeValue = await prisma.trialBalanceLine.findUnique({ where: { id: rowId } });
        if (!beforeValue) {
          return res.status(404).json({ error: "Record not found" });
        }
        await prisma.trialBalanceLine.delete({ where: { id: rowId } });
        break;
      }
      
      case "gl": {
        beforeValue = await prisma.gLEntry.findUnique({ where: { id: rowId } });
        if (!beforeValue) {
          return res.status(404).json({ error: "Record not found" });
        }
        await prisma.gLEntry.delete({ where: { id: rowId } });
        break;
      }
      
      case "ap":
      case "ar":
      case "other": {
        beforeValue = await prisma.importPartyBalance.findUnique({ where: { id: rowId } });
        if (!beforeValue) {
          return res.status(404).json({ error: "Record not found" });
        }
        await prisma.importPartyBalance.delete({ where: { id: rowId } });
        break;
      }
      
      case "bank": {
        beforeValue = await prisma.importBankAccount.findUnique({ where: { id: rowId } });
        if (!beforeValue) {
          return res.status(404).json({ error: "Record not found" });
        }
        await prisma.importBankAccount.delete({ where: { id: rowId } });
        break;
      }
    }
    
    // Create audit trail entry
    await createAuditTrailEntry(
      engagementId,
      user.id,
      user.role,
      "DELETE",
      dataset,
      rowId,
      beforeValue,
      null
    );
    
    res.json({ success: true, message: "Record deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting dataset row:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
