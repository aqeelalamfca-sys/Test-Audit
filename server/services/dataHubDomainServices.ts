import { dataHub } from "./dataHub";
import type { UserRole } from "@prisma/client";

interface ServiceContext {
  userId: string;
  userRole: UserRole;
  ipAddress?: string;
  userAgent?: string;
}

interface ReadOptions {
  preferDraft?: boolean;
  versionId?: string;
}

interface WriteOptions {
  changeDescription?: string;
  isaReference?: string;
}

class LedgerService {
  private entityType = "LEDGER" as const;

  async getGeneralLedger(
    engagementId: string,
    periodId: string,
    ctx: ServiceContext,
    options: ReadOptions = {}
  ) {
    const entityCode = `GL-${periodId}`;
    return dataHub.read(
      engagementId,
      this.entityType,
      entityCode,
      ctx.userId,
      ctx.userRole,
      options
    );
  }

  async getApprovedGeneralLedger(
    engagementId: string,
    periodId: string,
    ctx: ServiceContext
  ) {
    const entityCode = `GL-${periodId}`;
    return dataHub.getLatestApproved(
      engagementId,
      this.entityType,
      entityCode,
      ctx.userId,
      ctx.userRole
    );
  }

  async startLedgerDraft(
    engagementId: string,
    periodId: string,
    ledgerData: {
      entries: Array<{
        accountCode: string;
        accountName: string;
        debit: number;
        credit: number;
        date: Date;
        reference?: string;
        description?: string;
      }>;
      metadata: {
        periodStart: Date;
        periodEnd: Date;
        currency: string;
        totalDebits: number;
        totalCredits: number;
      };
    },
    ctx: ServiceContext,
    options: WriteOptions = {}
  ) {
    const entityCode = `GL-${periodId}`;
    const entityName = `General Ledger - ${periodId}`;
    
    return dataHub.startDraft(
      engagementId,
      this.entityType,
      entityCode,
      entityName,
      ledgerData,
      ctx.userId,
      ctx.userRole,
      { ...options, isaReference: options.isaReference || "ISA 500" }
    );
  }

  async updateLedgerDraft(
    engagementId: string,
    periodId: string,
    ledgerData: any,
    ctx: ServiceContext,
    changeDescription?: string
  ) {
    const entityCode = `GL-${periodId}`;
    return dataHub.updateDraft(
      engagementId,
      this.entityType,
      entityCode,
      ledgerData,
      ctx.userId,
      ctx.userRole,
      changeDescription
    );
  }

  async submitLedgerForReview(
    engagementId: string,
    periodId: string,
    ctx: ServiceContext
  ) {
    const entityCode = `GL-${periodId}`;
    return dataHub.submitForReview(
      engagementId,
      this.entityType,
      entityCode,
      ctx.userId,
      ctx.userRole
    );
  }

  async getLedgerVersionHistory(engagementId: string, periodId: string) {
    const entityCode = `GL-${periodId}`;
    return dataHub.getVersionHistory(engagementId, this.entityType, entityCode);
  }
}

class TrialBalanceService {
  private entityType = "TRIAL_BALANCE" as const;

  async getTrialBalance(
    engagementId: string,
    periodId: string,
    ctx: ServiceContext,
    options: ReadOptions = {}
  ) {
    const entityCode = `TB-${periodId}`;
    return dataHub.read(
      engagementId,
      this.entityType,
      entityCode,
      ctx.userId,
      ctx.userRole,
      options
    );
  }

  async getApprovedTrialBalance(
    engagementId: string,
    periodId: string,
    ctx: ServiceContext
  ) {
    const entityCode = `TB-${periodId}`;
    return dataHub.getLatestApproved(
      engagementId,
      this.entityType,
      entityCode,
      ctx.userId,
      ctx.userRole
    );
  }

  async startTrialBalanceDraft(
    engagementId: string,
    periodId: string,
    tbData: {
      accounts: Array<{
        accountCode: string;
        accountName: string;
        category: string;
        subCategory?: string;
        openingDebit: number;
        openingCredit: number;
        movementDebit: number;
        movementCredit: number;
        closingDebit: number;
        closingCredit: number;
      }>;
      metadata: {
        periodStart: Date;
        periodEnd: Date;
        currency: string;
        totalOpeningDebit: number;
        totalOpeningCredit: number;
        totalClosingDebit: number;
        totalClosingCredit: number;
        isBalanced: boolean;
      };
    },
    ctx: ServiceContext,
    options: WriteOptions = {}
  ) {
    const entityCode = `TB-${periodId}`;
    const entityName = `Trial Balance - ${periodId}`;
    
    return dataHub.startDraft(
      engagementId,
      this.entityType,
      entityCode,
      entityName,
      tbData,
      ctx.userId,
      ctx.userRole,
      { ...options, isaReference: options.isaReference || "ISA 500, ISA 580" }
    );
  }

  async updateTrialBalanceDraft(
    engagementId: string,
    periodId: string,
    tbData: any,
    ctx: ServiceContext,
    changeDescription?: string
  ) {
    const entityCode = `TB-${periodId}`;
    return dataHub.updateDraft(
      engagementId,
      this.entityType,
      entityCode,
      tbData,
      ctx.userId,
      ctx.userRole,
      changeDescription
    );
  }

  async submitTrialBalanceForReview(
    engagementId: string,
    periodId: string,
    ctx: ServiceContext
  ) {
    const entityCode = `TB-${periodId}`;
    return dataHub.submitForReview(
      engagementId,
      this.entityType,
      entityCode,
      ctx.userId,
      ctx.userRole
    );
  }

  async getTrialBalanceVersionHistory(engagementId: string, periodId: string) {
    const entityCode = `TB-${periodId}`;
    return dataHub.getVersionHistory(engagementId, this.entityType, entityCode);
  }
}

class FinancialStatementsService {
  private entityType = "FINANCIAL_STATEMENTS" as const;

  async getFinancialStatements(
    engagementId: string,
    periodId: string,
    statementType: "BALANCE_SHEET" | "INCOME_STATEMENT" | "CASH_FLOW" | "EQUITY_CHANGES" | "NOTES",
    ctx: ServiceContext,
    options: ReadOptions = {}
  ) {
    const entityCode = `FS-${statementType}-${periodId}`;
    return dataHub.read(
      engagementId,
      this.entityType,
      entityCode,
      ctx.userId,
      ctx.userRole,
      options
    );
  }

  async getApprovedFinancialStatements(
    engagementId: string,
    periodId: string,
    statementType: "BALANCE_SHEET" | "INCOME_STATEMENT" | "CASH_FLOW" | "EQUITY_CHANGES" | "NOTES",
    ctx: ServiceContext
  ) {
    const entityCode = `FS-${statementType}-${periodId}`;
    return dataHub.getLatestApproved(
      engagementId,
      this.entityType,
      entityCode,
      ctx.userId,
      ctx.userRole
    );
  }

  async startFinancialStatementsDraft(
    engagementId: string,
    periodId: string,
    statementType: "BALANCE_SHEET" | "INCOME_STATEMENT" | "CASH_FLOW" | "EQUITY_CHANGES" | "NOTES",
    fsData: {
      lineItems: Array<{
        caption: string;
        currentPeriod: number;
        priorPeriod: number;
        note?: string;
        category?: string;
        subCategory?: string;
      }>;
      totals: Record<string, number>;
      metadata: {
        reportingFramework: string;
        currency: string;
        periodEnd: Date;
        comparativePeriodEnd?: Date;
      };
    },
    ctx: ServiceContext,
    options: WriteOptions = {}
  ) {
    const entityCode = `FS-${statementType}-${periodId}`;
    const entityName = `${statementType.replace(/_/g, " ")} - ${periodId}`;
    
    return dataHub.startDraft(
      engagementId,
      this.entityType,
      entityCode,
      entityName,
      fsData,
      ctx.userId,
      ctx.userRole,
      { ...options, isaReference: options.isaReference || "ISA 700, ISA 705, ISA 706" }
    );
  }

  async updateFinancialStatementsDraft(
    engagementId: string,
    periodId: string,
    statementType: string,
    fsData: any,
    ctx: ServiceContext,
    changeDescription?: string
  ) {
    const entityCode = `FS-${statementType}-${periodId}`;
    return dataHub.updateDraft(
      engagementId,
      this.entityType,
      entityCode,
      fsData,
      ctx.userId,
      ctx.userRole,
      changeDescription
    );
  }

  async submitFinancialStatementsForReview(
    engagementId: string,
    periodId: string,
    statementType: string,
    ctx: ServiceContext
  ) {
    const entityCode = `FS-${statementType}-${periodId}`;
    return dataHub.submitForReview(
      engagementId,
      this.entityType,
      entityCode,
      ctx.userId,
      ctx.userRole
    );
  }

  async getFinancialStatementsVersionHistory(
    engagementId: string,
    periodId: string,
    statementType: string
  ) {
    const entityCode = `FS-${statementType}-${periodId}`;
    return dataHub.getVersionHistory(engagementId, this.entityType, entityCode);
  }

  async getAllFinancialStatements(
    engagementId: string,
    periodId: string,
    ctx: ServiceContext
  ) {
    const statementTypes = ["BALANCE_SHEET", "INCOME_STATEMENT", "CASH_FLOW", "EQUITY_CHANGES", "NOTES"] as const;
    const results: Record<string, any> = {};

    for (const type of statementTypes) {
      const result = await this.getApprovedFinancialStatements(engagementId, periodId, type, ctx);
      if (result) {
        results[type] = result;
      }
    }

    return results;
  }
}

class RiskService {
  private entityType = "RISK_ASSESSMENT" as const;

  async getRiskAssessment(
    engagementId: string,
    areaCode: string,
    ctx: ServiceContext,
    options: ReadOptions = {}
  ) {
    const entityCode = `RISK-${areaCode}`;
    return dataHub.read(
      engagementId,
      this.entityType,
      entityCode,
      ctx.userId,
      ctx.userRole,
      options
    );
  }

  async getApprovedRiskAssessment(
    engagementId: string,
    areaCode: string,
    ctx: ServiceContext
  ) {
    const entityCode = `RISK-${areaCode}`;
    return dataHub.getLatestApproved(
      engagementId,
      this.entityType,
      entityCode,
      ctx.userId,
      ctx.userRole
    );
  }

  async startRiskAssessmentDraft(
    engagementId: string,
    areaCode: string,
    areaName: string,
    riskData: {
      inherentRisk: "LOW" | "MEDIUM" | "HIGH";
      controlRisk: "LOW" | "MEDIUM" | "HIGH";
      detectionRisk: "LOW" | "MEDIUM" | "HIGH";
      overallRisk: "LOW" | "MEDIUM" | "HIGH";
      riskFactors: Array<{
        factor: string;
        description: string;
        impact: string;
        likelihood: string;
      }>;
      assertions: Array<{
        assertion: string;
        riskLevel: string;
        response: string;
      }>;
      significantRisks: Array<{
        description: string;
        auditResponse: string;
      }>;
      aiAssisted?: boolean;
      aiConfidence?: number;
    },
    ctx: ServiceContext,
    options: WriteOptions = {}
  ) {
    const entityCode = `RISK-${areaCode}`;
    const entityName = `Risk Assessment - ${areaName}`;
    
    return dataHub.startDraft(
      engagementId,
      this.entityType,
      entityCode,
      entityName,
      riskData,
      ctx.userId,
      ctx.userRole,
      { ...options, isaReference: options.isaReference || "ISA 315, ISA 330" }
    );
  }

  async updateRiskAssessmentDraft(
    engagementId: string,
    areaCode: string,
    riskData: any,
    ctx: ServiceContext,
    changeDescription?: string
  ) {
    const entityCode = `RISK-${areaCode}`;
    return dataHub.updateDraft(
      engagementId,
      this.entityType,
      entityCode,
      riskData,
      ctx.userId,
      ctx.userRole,
      changeDescription
    );
  }

  async submitRiskAssessmentForReview(
    engagementId: string,
    areaCode: string,
    ctx: ServiceContext
  ) {
    const entityCode = `RISK-${areaCode}`;
    return dataHub.submitForReview(
      engagementId,
      this.entityType,
      entityCode,
      ctx.userId,
      ctx.userRole
    );
  }

  async getAllRiskAssessments(engagementId: string) {
    return dataHub.listEntities(engagementId, this.entityType);
  }
}

class ProcedureService {
  private entityType = "AUDIT_PROCEDURE" as const;

  async getProcedure(
    engagementId: string,
    procedureCode: string,
    ctx: ServiceContext,
    options: ReadOptions = {}
  ) {
    const entityCode = `PROC-${procedureCode}`;
    return dataHub.read(
      engagementId,
      this.entityType,
      entityCode,
      ctx.userId,
      ctx.userRole,
      options
    );
  }

  async getApprovedProcedure(
    engagementId: string,
    procedureCode: string,
    ctx: ServiceContext
  ) {
    const entityCode = `PROC-${procedureCode}`;
    return dataHub.getLatestApproved(
      engagementId,
      this.entityType,
      entityCode,
      ctx.userId,
      ctx.userRole
    );
  }

  async startProcedureDraft(
    engagementId: string,
    procedureCode: string,
    procedureName: string,
    procedureData: {
      objective: string;
      scope: string;
      population: string;
      sampleSize?: number;
      sampleMethod?: string;
      steps: Array<{
        stepNumber: number;
        description: string;
        expectedOutcome: string;
        actualResult?: string;
        status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "NOT_APPLICABLE";
        evidenceRef?: string[];
      }>;
      conclusion?: string;
      exceptionsFound?: boolean;
      exceptions?: Array<{
        description: string;
        impact: string;
        resolution: string;
      }>;
    },
    ctx: ServiceContext,
    options: WriteOptions = {}
  ) {
    const entityCode = `PROC-${procedureCode}`;
    const entityName = `Audit Procedure - ${procedureName}`;
    
    return dataHub.startDraft(
      engagementId,
      this.entityType,
      entityCode,
      entityName,
      procedureData,
      ctx.userId,
      ctx.userRole,
      { ...options, isaReference: options.isaReference || "ISA 330, ISA 500" }
    );
  }

  async updateProcedureDraft(
    engagementId: string,
    procedureCode: string,
    procedureData: any,
    ctx: ServiceContext,
    changeDescription?: string
  ) {
    const entityCode = `PROC-${procedureCode}`;
    return dataHub.updateDraft(
      engagementId,
      this.entityType,
      entityCode,
      procedureData,
      ctx.userId,
      ctx.userRole,
      changeDescription
    );
  }

  async submitProcedureForReview(
    engagementId: string,
    procedureCode: string,
    ctx: ServiceContext
  ) {
    const entityCode = `PROC-${procedureCode}`;
    return dataHub.submitForReview(
      engagementId,
      this.entityType,
      entityCode,
      ctx.userId,
      ctx.userRole
    );
  }

  async getAllProcedures(engagementId: string) {
    return dataHub.listEntities(engagementId, this.entityType);
  }
}

class AdjustmentService {
  private entityType = "ADJUSTMENT" as const;

  async getAdjustment(
    engagementId: string,
    adjustmentCode: string,
    ctx: ServiceContext,
    options: ReadOptions = {}
  ) {
    const entityCode = `ADJ-${adjustmentCode}`;
    return dataHub.read(
      engagementId,
      this.entityType,
      entityCode,
      ctx.userId,
      ctx.userRole,
      options
    );
  }

  async getApprovedAdjustment(
    engagementId: string,
    adjustmentCode: string,
    ctx: ServiceContext
  ) {
    const entityCode = `ADJ-${adjustmentCode}`;
    return dataHub.getLatestApproved(
      engagementId,
      this.entityType,
      entityCode,
      ctx.userId,
      ctx.userRole
    );
  }

  async startAdjustmentDraft(
    engagementId: string,
    adjustmentCode: string,
    adjustmentData: {
      type: "PROPOSED" | "PASSED" | "UNCORRECTED";
      description: string;
      entries: Array<{
        accountCode: string;
        accountName: string;
        debit: number;
        credit: number;
      }>;
      netEffect: number;
      materialityImpact: {
        isAboveTrivial: boolean;
        isAbovePerformance: boolean;
        isAboveOverall: boolean;
        percentageOfMateriality: number;
      };
      auditArea: string;
      isaReference?: string;
      clientAccepted?: boolean;
      clientResponse?: string;
    },
    ctx: ServiceContext,
    options: WriteOptions = {}
  ) {
    const entityCode = `ADJ-${adjustmentCode}`;
    const entityName = `Audit Adjustment - ${adjustmentCode}`;
    
    return dataHub.startDraft(
      engagementId,
      this.entityType,
      entityCode,
      entityName,
      adjustmentData,
      ctx.userId,
      ctx.userRole,
      { ...options, isaReference: options.isaReference || "ISA 450" }
    );
  }

  async updateAdjustmentDraft(
    engagementId: string,
    adjustmentCode: string,
    adjustmentData: any,
    ctx: ServiceContext,
    changeDescription?: string
  ) {
    const entityCode = `ADJ-${adjustmentCode}`;
    return dataHub.updateDraft(
      engagementId,
      this.entityType,
      entityCode,
      adjustmentData,
      ctx.userId,
      ctx.userRole,
      changeDescription
    );
  }

  async submitAdjustmentForReview(
    engagementId: string,
    adjustmentCode: string,
    ctx: ServiceContext
  ) {
    const entityCode = `ADJ-${adjustmentCode}`;
    return dataHub.submitForReview(
      engagementId,
      this.entityType,
      entityCode,
      ctx.userId,
      ctx.userRole
    );
  }

  async getAllAdjustments(engagementId: string) {
    return dataHub.listEntities(engagementId, this.entityType);
  }

  async getAdjustmentsSummary(engagementId: string, ctx: ServiceContext) {
    const adjustments = await this.getAllAdjustments(engagementId);
    
    let totalProposed = 0;
    let totalPassed = 0;
    let totalUncorrected = 0;
    
    for (const adj of adjustments) {
      if (adj.hasApprovedVersion) {
        const result = await this.getApprovedAdjustment(engagementId, adj.entityCode.replace("ADJ-", ""), ctx);
        if (result?.data) {
          const amount = result.data.netEffect || 0;
          if (result.data.type === "PROPOSED") totalProposed += amount;
          if (result.data.type === "PASSED") totalPassed += amount;
          if (result.data.type === "UNCORRECTED") totalUncorrected += amount;
        }
      }
    }
    
    return {
      count: adjustments.length,
      totalProposed,
      totalPassed,
      totalUncorrected,
      netUncorrected: totalUncorrected
    };
  }
}

class EvidenceService {
  private entityType = "EVIDENCE" as const;

  async getEvidence(
    engagementId: string,
    evidenceCode: string,
    ctx: ServiceContext,
    options: ReadOptions = {}
  ) {
    const entityCode = `EVD-${evidenceCode}`;
    return dataHub.read(
      engagementId,
      this.entityType,
      entityCode,
      ctx.userId,
      ctx.userRole,
      options
    );
  }

  async getApprovedEvidence(
    engagementId: string,
    evidenceCode: string,
    ctx: ServiceContext
  ) {
    const entityCode = `EVD-${evidenceCode}`;
    return dataHub.getLatestApproved(
      engagementId,
      this.entityType,
      entityCode,
      ctx.userId,
      ctx.userRole
    );
  }

  async startEvidenceDraft(
    engagementId: string,
    evidenceCode: string,
    evidenceName: string,
    evidenceData: {
      type: "DOCUMENT" | "CONFIRMATION" | "OBSERVATION" | "INQUIRY" | "RECALCULATION" | "REPERFORMANCE" | "ANALYTICAL";
      description: string;
      source: "INTERNAL" | "EXTERNAL";
      reliability: "HIGH" | "MEDIUM" | "LOW";
      relevance: string;
      fileRefs?: string[];
      linkedProcedures?: string[];
      linkedAssertions?: string[];
      auditArea: string;
      obtainedDate: Date;
      obtainedBy: string;
      contentHash?: string;
    },
    ctx: ServiceContext,
    options: WriteOptions = {}
  ) {
    const entityCode = `EVD-${evidenceCode}`;
    const entityName = `Audit Evidence - ${evidenceName}`;
    
    return dataHub.startDraft(
      engagementId,
      this.entityType,
      entityCode,
      entityName,
      evidenceData,
      ctx.userId,
      ctx.userRole,
      { ...options, isaReference: options.isaReference || "ISA 500, ISA 230" }
    );
  }

  async updateEvidenceDraft(
    engagementId: string,
    evidenceCode: string,
    evidenceData: any,
    ctx: ServiceContext,
    changeDescription?: string
  ) {
    const entityCode = `EVD-${evidenceCode}`;
    return dataHub.updateDraft(
      engagementId,
      this.entityType,
      entityCode,
      evidenceData,
      ctx.userId,
      ctx.userRole,
      changeDescription
    );
  }

  async submitEvidenceForReview(
    engagementId: string,
    evidenceCode: string,
    ctx: ServiceContext
  ) {
    const entityCode = `EVD-${evidenceCode}`;
    return dataHub.submitForReview(
      engagementId,
      this.entityType,
      entityCode,
      ctx.userId,
      ctx.userRole
    );
  }

  async getAllEvidence(engagementId: string) {
    return dataHub.listEntities(engagementId, this.entityType);
  }
}

class SignOffService {
  private entityType = "SIGNOFF" as const;

  async getSignOffRegister(
    engagementId: string,
    registerCode: string,
    ctx: ServiceContext,
    options: ReadOptions = {}
  ) {
    const entityCode = `SIGNOFF-${registerCode}`;
    return dataHub.read(
      engagementId,
      this.entityType,
      entityCode,
      ctx.userId,
      ctx.userRole,
      options
    );
  }

  async getApprovedSignOffRegister(
    engagementId: string,
    registerCode: string,
    ctx: ServiceContext
  ) {
    const entityCode = `SIGNOFF-${registerCode}`;
    return dataHub.getLatestApproved(
      engagementId,
      this.entityType,
      entityCode,
      ctx.userId,
      ctx.userRole
    );
  }

  async startSignOffRegisterDraft(
    engagementId: string,
    registerCode: string,
    registerName: string,
    signOffData: {
      category: string;
      phase: string;
      requiredSignOffs: Array<{
        role: string;
        category: string;
        required: boolean;
        signedOffBy?: string;
        signedOffAt?: Date;
        comments?: string;
      }>;
      status: "PENDING" | "PARTIAL" | "COMPLETE";
      completionPercentage: number;
    },
    ctx: ServiceContext,
    options: WriteOptions = {}
  ) {
    const entityCode = `SIGNOFF-${registerCode}`;
    const entityName = `Sign-Off Register - ${registerName}`;
    
    return dataHub.startDraft(
      engagementId,
      this.entityType,
      entityCode,
      entityName,
      signOffData,
      ctx.userId,
      ctx.userRole,
      { ...options, isaReference: options.isaReference || "ISA 220, ISQM 1" }
    );
  }

  async getAllSignOffRegisters(engagementId: string) {
    return dataHub.listEntities(engagementId, this.entityType);
  }
}

class PDFPackService {
  private entityType = "PDF_PACK" as const;

  async getPDFPack(
    engagementId: string,
    packCode: string,
    ctx: ServiceContext,
    options: ReadOptions = {}
  ) {
    const entityCode = `PDF-${packCode}`;
    return dataHub.read(
      engagementId,
      this.entityType,
      entityCode,
      ctx.userId,
      ctx.userRole,
      options
    );
  }

  async getApprovedPDFPack(
    engagementId: string,
    packCode: string,
    ctx: ServiceContext
  ) {
    const entityCode = `PDF-${packCode}`;
    return dataHub.getLatestApproved(
      engagementId,
      this.entityType,
      entityCode,
      ctx.userId,
      ctx.userRole
    );
  }

  async startPDFPackDraft(
    engagementId: string,
    packCode: string,
    packName: string,
    packData: {
      type: "AUDIT_REPORT" | "MANAGEMENT_LETTER" | "ENGAGEMENT_LETTER" | "REPRESENTATION_LETTER" | "INSPECTION_PACK";
      sections: Array<{
        sectionCode: string;
        sectionName: string;
        content: string;
        dataRefs?: string[];
        pageNumber?: number;
      }>;
      metadata: {
        generatedAt: Date;
        templateVersion: string;
        includesSignature: boolean;
        reportDate?: Date;
      };
      fileRef?: string;
      contentHash?: string;
    },
    ctx: ServiceContext,
    options: WriteOptions = {}
  ) {
    const entityCode = `PDF-${packCode}`;
    const entityName = `PDF Pack - ${packName}`;
    
    return dataHub.startDraft(
      engagementId,
      this.entityType,
      entityCode,
      entityName,
      packData,
      ctx.userId,
      ctx.userRole,
      { ...options, isaReference: options.isaReference || "ISA 700, ISA 230" }
    );
  }

  async updatePDFPackDraft(
    engagementId: string,
    packCode: string,
    packData: any,
    ctx: ServiceContext,
    changeDescription?: string
  ) {
    const entityCode = `PDF-${packCode}`;
    return dataHub.updateDraft(
      engagementId,
      this.entityType,
      entityCode,
      packData,
      ctx.userId,
      ctx.userRole,
      changeDescription
    );
  }

  async submitPDFPackForReview(
    engagementId: string,
    packCode: string,
    ctx: ServiceContext
  ) {
    const entityCode = `PDF-${packCode}`;
    return dataHub.submitForReview(
      engagementId,
      this.entityType,
      entityCode,
      ctx.userId,
      ctx.userRole
    );
  }

  async getAllPDFPacks(engagementId: string) {
    return dataHub.listEntities(engagementId, this.entityType);
  }
}

export const ledgerService = new LedgerService();
export const tbService = new TrialBalanceService();
export const fsService = new FinancialStatementsService();
export const riskService = new RiskService();
export const procedureService = new ProcedureService();
export const adjustmentService = new AdjustmentService();
export const evidenceService = new EvidenceService();
export const signoffService = new SignOffService();
export const pdfPackService = new PDFPackService();

export {
  LedgerService,
  TrialBalanceService,
  FinancialStatementsService,
  RiskService,
  ProcedureService,
  AdjustmentService,
  EvidenceService,
  SignOffService,
  PDFPackService
};
