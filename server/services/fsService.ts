import { PrismaClient, FSType, FSMappingStatus, FSMappingDecisionType, FSSnapshotStatus, FSCaptionType } from '@prisma/client';
import OpenAI from 'openai';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  return openaiClient;
}

interface AuditContext {
  userId: string;
  userRole: string;
  userName?: string;
  ipAddress?: string;
  userAgent?: string;
}

interface MappingSuggestion {
  tbEntryId: string;
  accountCode: string;
  accountName: string;
  closingBalance: number;
  suggestedCaptionId: string;
  suggestedCaptionCode: string;
  suggestedCaptionName: string;
  confidenceScore: number;
  reason: string;
  isImmaterial: boolean;
  suggestClubWith?: string;
}

interface ChartOfAccountsMapping {
  captionCode: string;
  captionName: string;
  accountPatterns: string[];
  keywords: string[];
}

export class FSService {
  private async logAudit(
    structureId: string,
    engagementId: string,
    action: string,
    actionDescription: string,
    entityType: string,
    entityId: string,
    context: AuditContext,
    options?: {
      previousStatus?: string;
      newStatus?: string;
      changedFields?: Record<string, any>;
      previousValues?: Record<string, any>;
      newValues?: Record<string, any>;
      aiInvolved?: boolean;
      aiModelUsed?: string;
      aiConfidenceScore?: number;
      rationale?: string;
    }
  ) {
    return prisma.fSAuditLog.create({
      data: {
        structureId,
        engagementId,
        action,
        actionDescription,
        entityType,
        entityId,
        previousStatus: options?.previousStatus,
        newStatus: options?.newStatus,
        userId: context.userId,
        userRole: context.userRole,
        userName: context.userName,
        changedFields: options?.changedFields,
        previousValues: options?.previousValues,
        newValues: options?.newValues,
        aiInvolved: options?.aiInvolved ?? false,
        aiModelUsed: options?.aiModelUsed,
        aiConfidenceScore: options?.aiConfidenceScore,
        rationale: options?.rationale,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        isaReference: 'ISA 230',
      },
    });
  }

  async createFSStructure(
    engagementId: string,
    firmId: string,
    data: {
      name: string;
      fsType: FSType;
      reportingFramework?: string;
      fiscalYear: number;
    },
    context: AuditContext
  ) {
    const existingVersion = await prisma.fSStructure.findFirst({
      where: {
        engagementId,
        fsType: data.fsType,
        isActive: true,
      },
      orderBy: { version: 'desc' },
    });

    const version = (existingVersion?.version ?? 0) + 1;

    const structure = await prisma.fSStructure.create({
      data: {
        engagementId,
        firmId,
        name: data.name,
        fsType: data.fsType,
        version,
        reportingFramework: data.reportingFramework ?? 'IFRS',
        fiscalYear: data.fiscalYear,
        createdById: context.userId,
      },
    });

    await this.logAudit(
      structure.id,
      engagementId,
      'STRUCTURE_CREATED',
      `Created ${data.fsType} structure version ${version}`,
      'FSStructure',
      structure.id,
      context,
      { newStatus: 'ACTIVE' }
    );

    return structure;
  }

  async createDefaultCaptions(
    structureId: string,
    engagementId: string,
    fsType: FSType,
    context: AuditContext
  ) {
    const captions = fsType === FSType.BALANCE_SHEET
      ? this.getDefaultBalanceSheetCaptions()
      : fsType === FSType.INCOME_STATEMENT
      ? this.getDefaultIncomeStatementCaptions()
      : [];

    const createdCaptions = [];
    for (const caption of captions) {
      const created = await prisma.fSCaption.create({
        data: {
          structureId,
          engagementId,
          captionCode: caption.code,
          captionName: caption.name,
          captionType: caption.type,
          displayOrder: caption.order,
          indentLevel: caption.indent,
          isCalculated: caption.isCalculated ?? false,
          calculationFormula: (caption as any).formula ?? null,
          isSubTotal: caption.isSubTotal ?? false,
          subtotalOfCaptionIds: (caption as any).subtotalOf ?? [],
        },
      });
      createdCaptions.push(created);
    }

    await this.logAudit(
      structureId,
      engagementId,
      'CAPTIONS_CREATED',
      `Created ${createdCaptions.length} default captions for ${fsType}`,
      'FSCaption',
      structureId,
      context
    );

    return createdCaptions;
  }

  private getDefaultBalanceSheetCaptions() {
    return [
      { code: 'ASSETS', name: 'ASSETS', type: FSCaptionType.HEADING, order: 1, indent: 0 },
      { code: 'CA', name: 'Current Assets', type: FSCaptionType.SUB_HEADING, order: 2, indent: 1 },
      { code: 'CA-CASH', name: 'Cash and Cash Equivalents', type: FSCaptionType.LINE_ITEM, order: 3, indent: 2 },
      { code: 'CA-AR', name: 'Trade and Other Receivables', type: FSCaptionType.LINE_ITEM, order: 4, indent: 2 },
      { code: 'CA-INV', name: 'Inventories', type: FSCaptionType.LINE_ITEM, order: 5, indent: 2 },
      { code: 'CA-PRE', name: 'Prepayments', type: FSCaptionType.LINE_ITEM, order: 6, indent: 2 },
      { code: 'CA-OTH', name: 'Other Current Assets', type: FSCaptionType.LINE_ITEM, order: 7, indent: 2 },
      { code: 'CA-TOTAL', name: 'Total Current Assets', type: FSCaptionType.SUB_TOTAL, order: 8, indent: 1, isSubTotal: true, isCalculated: true },
      { code: 'NCA', name: 'Non-Current Assets', type: FSCaptionType.SUB_HEADING, order: 9, indent: 1 },
      { code: 'NCA-PPE', name: 'Property, Plant and Equipment', type: FSCaptionType.LINE_ITEM, order: 10, indent: 2 },
      { code: 'NCA-INT', name: 'Intangible Assets', type: FSCaptionType.LINE_ITEM, order: 11, indent: 2 },
      { code: 'NCA-INV', name: 'Investment Properties', type: FSCaptionType.LINE_ITEM, order: 12, indent: 2 },
      { code: 'NCA-FINV', name: 'Financial Assets', type: FSCaptionType.LINE_ITEM, order: 13, indent: 2 },
      { code: 'NCA-DEF', name: 'Deferred Tax Assets', type: FSCaptionType.LINE_ITEM, order: 14, indent: 2 },
      { code: 'NCA-OTH', name: 'Other Non-Current Assets', type: FSCaptionType.LINE_ITEM, order: 15, indent: 2 },
      { code: 'NCA-TOTAL', name: 'Total Non-Current Assets', type: FSCaptionType.SUB_TOTAL, order: 16, indent: 1, isSubTotal: true, isCalculated: true },
      { code: 'ASSETS-TOTAL', name: 'TOTAL ASSETS', type: FSCaptionType.TOTAL, order: 17, indent: 0, isCalculated: true },
      { code: 'LIAB', name: 'LIABILITIES', type: FSCaptionType.HEADING, order: 18, indent: 0 },
      { code: 'CL', name: 'Current Liabilities', type: FSCaptionType.SUB_HEADING, order: 19, indent: 1 },
      { code: 'CL-AP', name: 'Trade and Other Payables', type: FSCaptionType.LINE_ITEM, order: 20, indent: 2 },
      { code: 'CL-BORROW', name: 'Short-term Borrowings', type: FSCaptionType.LINE_ITEM, order: 21, indent: 2 },
      { code: 'CL-TAX', name: 'Current Tax Liabilities', type: FSCaptionType.LINE_ITEM, order: 22, indent: 2 },
      { code: 'CL-PROV', name: 'Provisions', type: FSCaptionType.LINE_ITEM, order: 23, indent: 2 },
      { code: 'CL-OTH', name: 'Other Current Liabilities', type: FSCaptionType.LINE_ITEM, order: 24, indent: 2 },
      { code: 'CL-TOTAL', name: 'Total Current Liabilities', type: FSCaptionType.SUB_TOTAL, order: 25, indent: 1, isSubTotal: true, isCalculated: true },
      { code: 'NCL', name: 'Non-Current Liabilities', type: FSCaptionType.SUB_HEADING, order: 26, indent: 1 },
      { code: 'NCL-BORROW', name: 'Long-term Borrowings', type: FSCaptionType.LINE_ITEM, order: 27, indent: 2 },
      { code: 'NCL-LEASE', name: 'Lease Liabilities', type: FSCaptionType.LINE_ITEM, order: 28, indent: 2 },
      { code: 'NCL-DEF', name: 'Deferred Tax Liabilities', type: FSCaptionType.LINE_ITEM, order: 29, indent: 2 },
      { code: 'NCL-PROV', name: 'Long-term Provisions', type: FSCaptionType.LINE_ITEM, order: 30, indent: 2 },
      { code: 'NCL-OTH', name: 'Other Non-Current Liabilities', type: FSCaptionType.LINE_ITEM, order: 31, indent: 2 },
      { code: 'NCL-TOTAL', name: 'Total Non-Current Liabilities', type: FSCaptionType.SUB_TOTAL, order: 32, indent: 1, isSubTotal: true, isCalculated: true },
      { code: 'LIAB-TOTAL', name: 'TOTAL LIABILITIES', type: FSCaptionType.TOTAL, order: 33, indent: 0, isCalculated: true },
      { code: 'EQUITY', name: 'EQUITY', type: FSCaptionType.HEADING, order: 34, indent: 0 },
      { code: 'EQ-SHARE', name: 'Share Capital', type: FSCaptionType.LINE_ITEM, order: 35, indent: 1 },
      { code: 'EQ-PREM', name: 'Share Premium', type: FSCaptionType.LINE_ITEM, order: 36, indent: 1 },
      { code: 'EQ-RET', name: 'Retained Earnings', type: FSCaptionType.LINE_ITEM, order: 37, indent: 1 },
      { code: 'EQ-RES', name: 'Other Reserves', type: FSCaptionType.LINE_ITEM, order: 38, indent: 1 },
      { code: 'EQUITY-TOTAL', name: 'TOTAL EQUITY', type: FSCaptionType.TOTAL, order: 39, indent: 0, isCalculated: true },
      { code: 'LIAB-EQ-TOTAL', name: 'TOTAL LIABILITIES AND EQUITY', type: FSCaptionType.GRAND_TOTAL, order: 40, indent: 0, isCalculated: true },
    ];
  }

  private getDefaultIncomeStatementCaptions() {
    return [
      { code: 'REV', name: 'Revenue', type: FSCaptionType.HEADING, order: 1, indent: 0 },
      { code: 'REV-SALES', name: 'Sales Revenue', type: FSCaptionType.LINE_ITEM, order: 2, indent: 1 },
      { code: 'REV-SERV', name: 'Service Revenue', type: FSCaptionType.LINE_ITEM, order: 3, indent: 1 },
      { code: 'REV-OTH', name: 'Other Revenue', type: FSCaptionType.LINE_ITEM, order: 4, indent: 1 },
      { code: 'REV-TOTAL', name: 'Total Revenue', type: FSCaptionType.SUB_TOTAL, order: 5, indent: 0, isSubTotal: true, isCalculated: true },
      { code: 'COGS', name: 'Cost of Goods Sold', type: FSCaptionType.HEADING, order: 6, indent: 0 },
      { code: 'COGS-MAT', name: 'Raw Materials', type: FSCaptionType.LINE_ITEM, order: 7, indent: 1 },
      { code: 'COGS-LAB', name: 'Direct Labour', type: FSCaptionType.LINE_ITEM, order: 8, indent: 1 },
      { code: 'COGS-OH', name: 'Manufacturing Overhead', type: FSCaptionType.LINE_ITEM, order: 9, indent: 1 },
      { code: 'COGS-TOTAL', name: 'Total Cost of Goods Sold', type: FSCaptionType.SUB_TOTAL, order: 10, indent: 0, isSubTotal: true, isCalculated: true },
      { code: 'GP', name: 'GROSS PROFIT', type: FSCaptionType.TOTAL, order: 11, indent: 0, isCalculated: true, formula: 'REV-TOTAL - COGS-TOTAL' },
      { code: 'OPEX', name: 'Operating Expenses', type: FSCaptionType.HEADING, order: 12, indent: 0 },
      { code: 'OPEX-SELL', name: 'Selling and Distribution', type: FSCaptionType.LINE_ITEM, order: 13, indent: 1 },
      { code: 'OPEX-ADMIN', name: 'Administrative Expenses', type: FSCaptionType.LINE_ITEM, order: 14, indent: 1 },
      { code: 'OPEX-DEP', name: 'Depreciation and Amortisation', type: FSCaptionType.LINE_ITEM, order: 15, indent: 1 },
      { code: 'OPEX-OTH', name: 'Other Operating Expenses', type: FSCaptionType.LINE_ITEM, order: 16, indent: 1 },
      { code: 'OPEX-TOTAL', name: 'Total Operating Expenses', type: FSCaptionType.SUB_TOTAL, order: 17, indent: 0, isSubTotal: true, isCalculated: true },
      { code: 'OP', name: 'OPERATING PROFIT', type: FSCaptionType.TOTAL, order: 18, indent: 0, isCalculated: true, formula: 'GP - OPEX-TOTAL' },
      { code: 'FIN', name: 'Finance Items', type: FSCaptionType.HEADING, order: 19, indent: 0 },
      { code: 'FIN-INC', name: 'Finance Income', type: FSCaptionType.LINE_ITEM, order: 20, indent: 1 },
      { code: 'FIN-COST', name: 'Finance Costs', type: FSCaptionType.LINE_ITEM, order: 21, indent: 1 },
      { code: 'FIN-NET', name: 'Net Finance Items', type: FSCaptionType.SUB_TOTAL, order: 22, indent: 0, isSubTotal: true, isCalculated: true },
      { code: 'PBT', name: 'PROFIT BEFORE TAX', type: FSCaptionType.TOTAL, order: 23, indent: 0, isCalculated: true, formula: 'OP + FIN-NET' },
      { code: 'TAX', name: 'Income Tax Expense', type: FSCaptionType.LINE_ITEM, order: 24, indent: 0 },
      { code: 'PAT', name: 'PROFIT FOR THE YEAR', type: FSCaptionType.GRAND_TOTAL, order: 25, indent: 0, isCalculated: true, formula: 'PBT - TAX' },
    ];
  }

  async getAIMappingSuggestions(
    structureId: string,
    engagementId: string,
    tbBatchId: string,
    performanceMateriality: number,
    context: AuditContext
  ): Promise<MappingSuggestion[]> {
    const [structure, tbBatch, captions] = await Promise.all([
      prisma.fSStructure.findUnique({ where: { id: structureId } }),
      prisma.tBBatch.findUnique({
        where: { id: tbBatchId },
        include: { entries: true },
      }),
      prisma.fSCaption.findMany({
        where: { structureId, captionType: FSCaptionType.LINE_ITEM },
        orderBy: { displayOrder: 'asc' },
      }),
    ]);

    if (!structure || !tbBatch) {
      throw new Error('Structure or TB batch not found');
    }

    const captionList = captions.map(c => ({
      id: c.id,
      code: c.captionCode,
      name: c.captionName,
    }));

    const tbEntries = tbBatch.entries.map(e => ({
      id: e.id,
      code: e.accountCode,
      name: e.accountName,
      type: e.accountType,
      category: e.accountCategory,
      closingBalance: Number(e.closingBalance),
    }));

    const prompt = `You are an expert financial auditor. Map trial balance accounts to financial statement captions.

FINANCIAL STATEMENT TYPE: ${structure.fsType}
REPORTING FRAMEWORK: ${structure.reportingFramework}
PERFORMANCE MATERIALITY: ${performanceMateriality}

AVAILABLE FS CAPTIONS (line items only):
${JSON.stringify(captionList, null, 2)}

TRIAL BALANCE ACCOUNTS TO MAP:
${JSON.stringify(tbEntries, null, 2)}

For each trial balance account, provide a JSON array with mappings. Consider:
1. Account codes and names to determine appropriate caption
2. Account type (Asset, Liability, Equity, Revenue, Expense)
3. Whether the account balance is immaterial (below performance materiality)
4. If immaterial, suggest clubbing with a related material account

Return JSON in this exact format:
{
  "mappings": [
    {
      "tbEntryId": "entry id",
      "accountCode": "account code",
      "accountName": "account name",
      "suggestedCaptionId": "caption id",
      "confidenceScore": 0.95,
      "reason": "Brief explanation for mapping",
      "isImmaterial": false,
      "suggestClubWith": null or "caption id to club with"
    }
  ]
}

Be precise with confidence scores:
- 0.95-1.0: Very confident (clear account name match)
- 0.80-0.94: Confident (reasonable inference)
- 0.60-0.79: Moderate (requires human review)
- Below 0.60: Low confidence (flag for manual mapping)`;

    try {
      const client = getOpenAI();
      if (!client) {
        throw new Error('OpenAI API key not configured');
      }
      const response = await client.chat.completions.create({
        model: 'gpt-5.1',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        max_completion_tokens: 8192,
      });

      const content = response.choices[0]?.message?.content || '{"mappings":[]}';
      const parsed = JSON.parse(content);

      const suggestions: MappingSuggestion[] = [];
      for (const mapping of parsed.mappings || []) {
        const tbEntry = tbEntries.find(e => e.id === mapping.tbEntryId);
        const caption = captionList.find(c => c.id === mapping.suggestedCaptionId);

        if (tbEntry && caption) {
          suggestions.push({
            tbEntryId: mapping.tbEntryId,
            accountCode: tbEntry.code,
            accountName: tbEntry.name,
            closingBalance: tbEntry.closingBalance,
            suggestedCaptionId: caption.id,
            suggestedCaptionCode: caption.code,
            suggestedCaptionName: caption.name,
            confidenceScore: mapping.confidenceScore,
            reason: mapping.reason,
            isImmaterial: mapping.isImmaterial || Math.abs(tbEntry.closingBalance) < performanceMateriality,
            suggestClubWith: mapping.suggestClubWith,
          });
        }
      }

      await this.logAudit(
        structureId,
        engagementId,
        'AI_SUGGESTIONS_GENERATED',
        `AI generated ${suggestions.length} mapping suggestions`,
        'FSMapping',
        structureId,
        context,
        {
          aiInvolved: true,
          aiModelUsed: 'gpt-5.1',
        }
      );

      return suggestions;
    } catch (error) {
      console.error('AI mapping suggestion error:', error);
      throw new Error('Failed to generate AI mapping suggestions');
    }
  }

  async createMappingsFromSuggestions(
    structureId: string,
    engagementId: string,
    tbBatchId: string,
    suggestions: MappingSuggestion[],
    context: AuditContext
  ) {
    const createdMappings = [];

    for (const suggestion of suggestions) {
      const tbEntry = await prisma.tBEntry.findUnique({
        where: { id: suggestion.tbEntryId },
      });

      if (!tbEntry) continue;

      const mapping = await prisma.fSMapping.create({
        data: {
          structureId,
          captionId: suggestion.suggestedCaptionId,
          engagementId,
          tbBatchId,
          tbEntryId: suggestion.tbEntryId,
          accountCode: suggestion.accountCode,
          accountName: suggestion.accountName,
          tbClosingBalance: tbEntry.closingBalance,
          mappedAmount: tbEntry.closingBalance,
          aiSuggested: true,
          aiConfidenceScore: suggestion.confidenceScore,
          aiSuggestionReason: suggestion.reason,
          aiModelUsed: 'gpt-5.1',
          aiSuggestedAt: new Date(),
          isImmaterial: suggestion.isImmaterial,
          clubbedWithCaptionId: suggestion.suggestClubWith,
          status: FSMappingStatus.DRAFT,
          preparedById: context.userId,
          preparedAt: new Date(),
        },
      });

      createdMappings.push(mapping);
    }

    await this.logAudit(
      structureId,
      engagementId,
      'MAPPINGS_CREATED',
      `Created ${createdMappings.length} AI-suggested mappings`,
      'FSMapping',
      structureId,
      context,
      {
        aiInvolved: true,
        aiModelUsed: 'gpt-5.1',
      }
    );

    return createdMappings;
  }

  async recordMappingDecision(
    mappingId: string,
    engagementId: string,
    decision: {
      decisionType: FSMappingDecisionType;
      rationale: string;
      newCaptionId?: string;
      newAmount?: number;
      splitDetails?: any;
      regroupDetails?: any;
    },
    context: AuditContext
  ) {
    const mapping = await prisma.fSMapping.findUnique({
      where: { id: mappingId },
    });

    if (!mapping) {
      throw new Error('Mapping not found');
    }

    const decisionRecord = await prisma.fSMappingDecision.create({
      data: {
        mappingId,
        engagementId,
        decisionType: decision.decisionType,
        rationale: decision.rationale,
        previousCaptionId: mapping.captionId,
        newCaptionId: decision.newCaptionId || mapping.captionId,
        previousAmount: mapping.mappedAmount,
        newAmount: decision.newAmount,
        splitDetails: decision.splitDetails,
        regroupDetails: decision.regroupDetails,
        aiSuggestionAccepted: mapping.aiSuggested && decision.decisionType === FSMappingDecisionType.ACCEPT,
        aiOverrideReason: mapping.aiSuggested && decision.decisionType !== FSMappingDecisionType.ACCEPT
          ? decision.rationale
          : null,
        decidedById: context.userId,
      },
    });

    if (decision.decisionType === FSMappingDecisionType.MODIFY && decision.newCaptionId) {
      await prisma.fSMapping.update({
        where: { id: mappingId },
        data: {
          captionId: decision.newCaptionId,
          mappedAmount: decision.newAmount ?? mapping.mappedAmount,
        },
      });
    } else if (decision.decisionType === FSMappingDecisionType.REJECT) {
      await prisma.fSMapping.delete({ where: { id: mappingId } });
    } else if (decision.decisionType === FSMappingDecisionType.SPLIT && decision.splitDetails) {
      for (const split of decision.splitDetails.splits || []) {
        await prisma.fSMapping.create({
          data: {
            structureId: mapping.structureId,
            captionId: split.captionId,
            engagementId,
            tbBatchId: mapping.tbBatchId,
            tbEntryId: mapping.tbEntryId,
            accountCode: mapping.accountCode,
            accountName: mapping.accountName,
            tbClosingBalance: mapping.tbClosingBalance,
            mappedAmount: split.amount,
            isSplit: true,
            splitFromMappingId: mappingId,
            splitPercentage: split.percentage,
            status: FSMappingStatus.DRAFT,
            preparedById: context.userId,
            preparedAt: new Date(),
          },
        });
      }
      await prisma.fSMapping.delete({ where: { id: mappingId } });
    }

    await this.logAudit(
      mapping.structureId,
      engagementId,
      `MAPPING_${decision.decisionType}`,
      `${decision.decisionType} decision for account ${mapping.accountCode}`,
      'FSMappingDecision',
      decisionRecord.id,
      context,
      {
        aiInvolved: mapping.aiSuggested,
        rationale: decision.rationale,
      }
    );

    return decisionRecord;
  }

  async submitMappingsForReview(
    structureId: string,
    mappingIds: string[],
    context: AuditContext
  ) {
    const updated = await prisma.fSMapping.updateMany({
      where: {
        id: { in: mappingIds },
        structureId,
        status: FSMappingStatus.DRAFT,
      },
      data: {
        status: FSMappingStatus.PENDING_REVIEW,
      },
    });

    const structure = await prisma.fSStructure.findUnique({
      where: { id: structureId },
    });

    if (structure) {
      await this.logAudit(
        structureId,
        structure.engagementId,
        'MAPPINGS_SUBMITTED_FOR_REVIEW',
        `Submitted ${updated.count} mappings for review`,
        'FSMapping',
        structureId,
        context,
        { previousStatus: 'DRAFT', newStatus: 'PENDING_REVIEW' }
      );
    }

    return updated;
  }

  async reviewMappings(
    structureId: string,
    mappingIds: string[],
    approved: boolean,
    comments: string,
    context: AuditContext
  ) {
    const mappingsToReview = await prisma.fSMapping.findMany({
      where: {
        id: { in: mappingIds },
        structureId,
        status: FSMappingStatus.PENDING_REVIEW,
      },
    });

    for (const mapping of mappingsToReview) {
      if (mapping.preparedById === context.userId) {
        throw new Error(`Cannot review mapping ${mapping.id} - same user prepared and reviewing (ISA 220 maker-checker violation)`);
      }
    }

    const newStatus = approved ? FSMappingStatus.REVIEWED : FSMappingStatus.DRAFT;

    const updated = await prisma.fSMapping.updateMany({
      where: {
        id: { in: mappingIds },
        structureId,
        status: FSMappingStatus.PENDING_REVIEW,
      },
      data: {
        status: newStatus,
        reviewedById: context.userId,
        reviewedAt: new Date(),
        reviewerComments: comments,
      },
    });

    const structure = await prisma.fSStructure.findUnique({
      where: { id: structureId },
    });

    if (structure) {
      await this.logAudit(
        structureId,
        structure.engagementId,
        approved ? 'MAPPINGS_REVIEWED' : 'MAPPINGS_RETURNED',
        `${approved ? 'Reviewed' : 'Returned'} ${updated.count} mappings`,
        'FSMapping',
        structureId,
        context,
        {
          previousStatus: 'PENDING_REVIEW',
          newStatus: newStatus,
          rationale: comments,
        }
      );
    }

    return updated;
  }

  async approveMappings(
    structureId: string,
    mappingIds: string[],
    comments: string,
    context: AuditContext
  ) {
    const structure = await prisma.fSStructure.findUnique({
      where: { id: structureId },
    });

    if (!structure) {
      throw new Error('Structure not found');
    }

    const mappingsToApprove = await prisma.fSMapping.findMany({
      where: {
        id: { in: mappingIds },
        structureId,
        status: { in: [FSMappingStatus.REVIEWED, FSMappingStatus.PENDING_APPROVAL] },
      },
    });

    for (const mapping of mappingsToApprove) {
      if (mapping.preparedById === context.userId) {
        throw new Error(`Cannot approve mapping ${mapping.id} - same user prepared and approving (ISA 220 maker-checker violation)`);
      }
      if (mapping.reviewedById === context.userId) {
        throw new Error(`Cannot approve mapping ${mapping.id} - same user reviewed and approving (ISA 220 maker-checker violation)`);
      }
    }

    const updated = await prisma.fSMapping.updateMany({
      where: {
        id: { in: mappingIds },
        structureId,
        status: { in: [FSMappingStatus.REVIEWED, FSMappingStatus.PENDING_APPROVAL] },
      },
      data: {
        status: FSMappingStatus.APPROVED,
        approvedById: context.userId,
        approvedAt: new Date(),
        approverComments: comments,
      },
    });

    await this.logAudit(
      structureId,
      structure.engagementId,
      'MAPPINGS_APPROVED',
      `Partner approved ${updated.count} mappings`,
      'FSMapping',
      structureId,
      context,
      {
        previousStatus: 'REVIEWED',
        newStatus: 'APPROVED',
        rationale: comments,
      }
    );

    return updated;
  }

  async getUnmappedAccounts(structureId: string, tbBatchId: string) {
    const mappedEntryIds = await prisma.fSMapping.findMany({
      where: { structureId, tbBatchId },
      select: { tbEntryId: true },
    });

    const mappedIds = new Set(mappedEntryIds.map(m => m.tbEntryId));

    const allEntries = await prisma.tBEntry.findMany({
      where: { batchId: tbBatchId },
    });

    return allEntries.filter(e => !mappedIds.has(e.id));
  }

  async canGenerateSnapshot(structureId: string, tbBatchId: string): Promise<{
    canProceed: boolean;
    blockers: string[];
    warnings: string[];
  }> {
    const blockers: string[] = [];
    const warnings: string[] = [];

    const unmapped = await this.getUnmappedAccounts(structureId, tbBatchId);
    if (unmapped.length > 0) {
      blockers.push(`${unmapped.length} accounts are not mapped to any FS caption`);
    }

    const unapprovedMappings = await prisma.fSMapping.count({
      where: {
        structureId,
        tbBatchId,
        status: { not: FSMappingStatus.APPROVED },
      },
    });

    if (unapprovedMappings > 0) {
      blockers.push(`${unapprovedMappings} mappings are not yet approved`);
    }

    const lowConfidenceMappings = await prisma.fSMapping.count({
      where: {
        structureId,
        tbBatchId,
        aiSuggested: true,
        aiConfidenceScore: { lt: 0.8 },
      },
    });

    if (lowConfidenceMappings > 0) {
      warnings.push(`${lowConfidenceMappings} AI-suggested mappings have confidence below 80%`);
    }

    return {
      canProceed: blockers.length === 0,
      blockers,
      warnings,
    };
  }

  async generateSnapshot(
    structureId: string,
    engagementId: string,
    tbBatchId: string,
    snapshotName: string,
    snapshotType: string,
    context: AuditContext
  ) {
    const readinessCheck = await this.canGenerateSnapshot(structureId, tbBatchId);
    if (!readinessCheck.canProceed) {
      throw new Error(`Cannot generate snapshot: ${readinessCheck.blockers.join(', ')}`);
    }

    const [structure, tbBatch] = await Promise.all([
      prisma.fSStructure.findUnique({ where: { id: structureId } }),
      prisma.tBBatch.findUnique({ where: { id: tbBatchId } }),
    ]);

    if (!structure || !tbBatch) {
      throw new Error('Structure or TB batch not found');
    }

    const existingVersion = await prisma.fSSnapshot.findFirst({
      where: { structureId, snapshotType },
      orderBy: { version: 'desc' },
    });

    const version = (existingVersion?.version ?? 0) + 1;

    if (existingVersion && existingVersion.status !== FSSnapshotStatus.SUPERSEDED) {
      await prisma.fSSnapshot.update({
        where: { id: existingVersion.id },
        data: { status: FSSnapshotStatus.SUPERSEDED },
      });
    }

    const mappings = await prisma.fSMapping.findMany({
      where: {
        structureId,
        tbBatchId,
        status: FSMappingStatus.APPROVED,
      },
      include: { caption: true },
    });

    const captions = await prisma.fSCaption.findMany({
      where: { structureId },
      orderBy: { displayOrder: 'asc' },
    });

    const captionAmounts: Record<string, number> = {};
    for (const mapping of mappings) {
      const captionId = mapping.captionId;
      captionAmounts[captionId] = (captionAmounts[captionId] || 0) + Number(mapping.mappedAmount);
    }

    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    let totalRevenue = 0;
    let totalExpenses = 0;

    for (const [captionId, amount] of Object.entries(captionAmounts)) {
      const caption = captions.find(c => c.id === captionId);
      if (!caption) continue;

      const code = caption.captionCode.toUpperCase();
      if (code.startsWith('CA-') || code.startsWith('NCA-')) {
        totalAssets += amount;
      } else if (code.startsWith('CL-') || code.startsWith('NCL-')) {
        totalLiabilities += amount;
      } else if (code.startsWith('EQ-')) {
        totalEquity += amount;
      } else if (code.startsWith('REV-')) {
        totalRevenue += amount;
      } else if (code.startsWith('COGS-') || code.startsWith('OPEX-')) {
        totalExpenses += amount;
      }
    }

    const netIncome = totalRevenue - totalExpenses;

    const snapshotDataString = JSON.stringify({ mappings: mappings.map(m => m.id), captionAmounts });
    const contentHash = createHash('sha256').update(snapshotDataString).digest('hex');

    const snapshot = await prisma.fSSnapshot.create({
      data: {
        structureId,
        engagementId,
        firmId: structure.firmId,
        snapshotName,
        snapshotType,
        version,
        status: FSSnapshotStatus.DRAFT,
        fsType: structure.fsType,
        fiscalYear: structure.fiscalYear,
        periodStart: tbBatch.periodStart,
        periodEnd: tbBatch.periodEnd,
        totalAssets: structure.fsType === FSType.BALANCE_SHEET ? totalAssets : null,
        totalLiabilities: structure.fsType === FSType.BALANCE_SHEET ? totalLiabilities : null,
        totalEquity: structure.fsType === FSType.BALANCE_SHEET ? totalEquity : null,
        totalRevenue: structure.fsType === FSType.INCOME_STATEMENT ? totalRevenue : null,
        totalExpenses: structure.fsType === FSType.INCOME_STATEMENT ? totalExpenses : null,
        netIncome: structure.fsType === FSType.INCOME_STATEMENT ? netIncome : null,
        tbBatchId,
        tbBatchVersion: tbBatch.version,
        unmappedAccountCount: 0,
        mappedAccountCount: mappings.length,
        isComplete: true,
        contentHash,
        preparedById: context.userId,
        preparedAt: new Date(),
        aiLabeled: mappings.some(m => m.aiSuggested),
        aiLabelDetails: { 
          aiMappedCount: mappings.filter(m => m.aiSuggested).length,
          humanMappedCount: mappings.filter(m => !m.aiSuggested).length,
        },
      },
    });

    for (const caption of captions) {
      const amount = captionAmounts[caption.id] || 0;
      const mappingsForCaption = mappings.filter(m => m.captionId === caption.id);

      await prisma.fSSnapshotLine.create({
        data: {
          snapshotId: snapshot.id,
          captionId: caption.id,
          captionCode: caption.captionCode,
          captionName: caption.captionName,
          captionType: caption.captionType,
          displayOrder: caption.displayOrder,
          indentLevel: caption.indentLevel,
          currentPeriodAmount: amount,
          mappedAccountCodes: mappingsForCaption.map(m => m.accountCode),
          mappedAccountCount: mappingsForCaption.length,
          isCalculated: caption.isCalculated,
          calculationFormula: caption.calculationFormula,
        },
      });
    }

    await this.logAudit(
      structureId,
      engagementId,
      'SNAPSHOT_GENERATED',
      `Generated ${snapshotType} snapshot version ${version}`,
      'FSSnapshot',
      snapshot.id,
      context,
      {
        newStatus: 'DRAFT',
        aiInvolved: mappings.some(m => m.aiSuggested),
      }
    );

    return snapshot;
  }

  async getStructure(structureId: string) {
    return prisma.fSStructure.findUnique({
      where: { id: structureId },
      include: {
        captions: { orderBy: { displayOrder: 'asc' } },
        mappings: { include: { caption: true, tbEntry: true } },
        snapshots: { orderBy: { version: 'desc' } },
      },
    });
  }

  async getSnapshot(snapshotId: string) {
    return prisma.fSSnapshot.findUnique({
      where: { id: snapshotId },
      include: {
        lines: { orderBy: { displayOrder: 'asc' } },
        structure: true,
      },
    });
  }

  async getAuditLogs(structureId: string, limit = 100) {
    return prisma.fSAuditLog.findMany({
      where: { structureId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}

export const fsService = new FSService();
