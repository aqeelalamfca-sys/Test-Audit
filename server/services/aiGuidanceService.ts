import OpenAI from "openai";
import { prisma } from "../db";

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
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

export interface GuidanceRequest {
  requestTitle: string;
  headOfAccounts: string;
  description: string;
  specificRequirements?: string;
  financialStatementCategory?: string;
  auditAssertion?: string;
  clientIndustry?: string;
  engagementType?: string;
}

export interface CompletenessCheckRequest {
  requestTitle: string;
  headOfAccounts: string;
  description: string;
  specificRequirements?: string;
  clientResponse: string;
  attachmentCount: number;
  attachmentTypes?: string[];
}

export interface GuidanceResponse {
  guidance: string;
  suggestedFormat?: string;
  commonMistakes?: string[];
  exampleResponse?: string;
  isaReferences?: string[];
}

export interface CompletenessScore {
  score: number;
  isComplete: boolean;
  missingElements: string[];
  suggestions: string[];
  qualityScore: number;
}

const HEAD_OF_ACCOUNTS_TEMPLATES: Record<string, GuidanceResponse> = {
  CORPORATE_DOCUMENTS: {
    guidance: "Please provide copies of all corporate documents including memorandum and articles of association, certificate of incorporation, any amendments, board resolutions, and minutes of shareholders/directors meetings for the audit period.",
    suggestedFormat: "PDF scans of original documents",
    commonMistakes: [
      "Providing outdated documents that don't reflect recent amendments",
      "Missing board resolutions for significant transactions",
      "Incomplete minutes of meetings"
    ],
    isaReferences: ["ISA 500", "ISA 200"]
  },
  FINANCIAL_STATEMENTS: {
    guidance: "Please provide complete trial balance as at year-end, comparative financial statements for the prior year, and any internal management accounts prepared during the year.",
    suggestedFormat: "Excel file with detailed trial balance, PDF of prior year audited statements",
    commonMistakes: [
      "Trial balance not balanced",
      "Missing account descriptions",
      "Comparative figures not matching prior year"
    ],
    isaReferences: ["ISA 510", "ISA 500", "ISA 450"]
  },
  BANK_INFORMATION: {
    guidance: "Please provide bank statements for all accounts for the entire audit period, bank reconciliations as at year-end, and bank confirmation letters. Include details of any bank facilities, guarantees, or security provided.",
    suggestedFormat: "PDF bank statements, Excel reconciliations",
    commonMistakes: [
      "Incomplete bank statements (missing months)",
      "Unreconciled items not explained",
      "Missing bank confirmation requests"
    ],
    isaReferences: ["ISA 505", "ISA 500"]
  },
  FIXED_ASSETS: {
    guidance: "Please provide the fixed asset register with additions, disposals, and depreciation for the year. Include purchase invoices for significant additions and board approvals for capital expenditure.",
    suggestedFormat: "Excel fixed asset register with cost, depreciation, and net book value",
    commonMistakes: [
      "Asset register not updated for current year transactions",
      "Depreciation rates not consistent with policy",
      "Missing documentation for disposals"
    ],
    isaReferences: ["ISA 500", "ISA 501"]
  },
  INVENTORY: {
    guidance: "Please provide inventory listings as at year-end with quantities, unit costs, and total values. Include slow-moving/obsolete inventory analysis, inventory count procedures, and any count sheets from year-end physical verification.",
    suggestedFormat: "Excel inventory listing with SKU, description, quantity, cost, and valuation",
    commonMistakes: [
      "Inventory not valued at lower of cost or NRV",
      "No provision for slow-moving items",
      "Count sheets not properly signed and dated"
    ],
    isaReferences: ["ISA 501", "ISA 500"]
  },
  RECEIVABLES: {
    guidance: "Please provide aged receivables listing as at year-end, customer confirmations or alternative evidence, provision for doubtful debts analysis, and details of any write-offs during the year.",
    suggestedFormat: "Excel aged receivables with customer names, amounts, and aging buckets",
    commonMistakes: [
      "Aging not properly calculated",
      "No documentation for provision methodology",
      "Credit notes issued post year-end not analyzed"
    ],
    isaReferences: ["ISA 505", "ISA 500", "ISA 540"]
  },
  PAYABLES: {
    guidance: "Please provide aged payables listing as at year-end, vendor statements or confirmations, unrecorded liabilities analysis, and details of goods received/services rendered but not invoiced.",
    suggestedFormat: "Excel aged payables with vendor names, amounts, and aging details",
    commonMistakes: [
      "Cutoff errors - invoices dated after year-end included",
      "Accruals not properly estimated",
      "Related party payables not disclosed"
    ],
    isaReferences: ["ISA 505", "ISA 500"]
  },
  LOANS_BORROWINGS: {
    guidance: "Please provide loan agreements, amortization schedules, bank confirmation letters for all borrowings, and details of covenants and compliance. Include interest rate details and any modifications to terms.",
    suggestedFormat: "PDF loan agreements, Excel amortization schedules",
    commonMistakes: [
      "Current/non-current classification incorrect",
      "Covenant breaches not disclosed",
      "Accrued interest not properly calculated"
    ],
    isaReferences: ["ISA 505", "ISA 500"]
  },
  EQUITY: {
    guidance: "Please provide share capital register, share certificates, board resolutions for any changes in capital, dividend declarations, and statutory forms filed with SECP.",
    suggestedFormat: "PDF share register and certificates, board resolutions",
    commonMistakes: [
      "Share register not updated",
      "Dividends declared but not recorded",
      "Statutory filings not complete"
    ],
    isaReferences: ["ISA 500"]
  },
  REVENUE: {
    guidance: "Please provide revenue analysis by major product/service category, significant customer contracts, sales cutoff analysis around year-end, and credit notes issued post year-end.",
    suggestedFormat: "Excel revenue breakdown with monthly/quarterly trends",
    commonMistakes: [
      "Revenue recognition not aligned with performance obligations",
      "Cutoff errors at period end",
      "Related party transactions not separately disclosed"
    ],
    isaReferences: ["ISA 240", "ISA 500", "ISA 550"]
  },
  COST_OF_SALES: {
    guidance: "Please provide cost breakdown by major categories, purchase analysis, inventory movement reconciliation (opening + purchases - closing = COGS), and supplier contracts for major purchases.",
    suggestedFormat: "Excel cost analysis with categories and reconciliation",
    commonMistakes: [
      "Inventory movement reconciliation not prepared",
      "Overhead allocation methodology not documented",
      "Import duties not properly accounted"
    ],
    isaReferences: ["ISA 500"]
  },
  OPERATING_EXPENSES: {
    guidance: "Please provide expense ledgers with supporting documentation for significant items, prepayment and accrual schedules, employee expense analysis, and any unusual or non-recurring items.",
    suggestedFormat: "Excel expense ledgers with monthly breakdown and supporting invoices",
    commonMistakes: [
      "Personal expenses included in business",
      "Accruals not properly estimated",
      "Missing supporting documentation for large items"
    ],
    isaReferences: ["ISA 500"]
  },
  TAXATION: {
    guidance: "Please provide tax computations, tax returns filed during the year, correspondence with tax authorities, details of tax assessments and appeals, and deferred tax calculations.",
    suggestedFormat: "PDF tax returns and assessments, Excel tax computations",
    commonMistakes: [
      "Deferred tax not calculated correctly",
      "Tax contingencies not disclosed",
      "WHT credits not properly documented"
    ],
    isaReferences: ["ISA 500", "ISA 540"]
  },
  PAYROLL: {
    guidance: "Please provide employee listing with salary details, payroll reconciliations, EOBI and provident fund submissions, income tax deductions and deposits, and any bonus or gratuity provisions.",
    suggestedFormat: "Excel payroll summary with employee-wise details",
    commonMistakes: [
      "Payroll not reconciled to GL",
      "Statutory deductions not deposited timely",
      "Gratuity/pension provisions not actuarially valued"
    ],
    isaReferences: ["ISA 500", "ISA 540"]
  },
  RELATED_PARTY: {
    guidance: "Please provide list of all related parties, related party transaction register, transfer pricing documentation, board approvals for related party transactions, and arm's length pricing evidence.",
    suggestedFormat: "Excel related party register with transaction details and balances",
    commonMistakes: [
      "Incomplete related party identification",
      "Transactions not at arm's length",
      "Required disclosures not complete"
    ],
    isaReferences: ["ISA 550"]
  },
  LEGAL_MATTERS: {
    guidance: "Please provide listing of all pending litigation, lawyer's confirmation letters, provisions for legal claims, contingent liability disclosures, and any material contracts or disputes.",
    suggestedFormat: "PDF lawyer letters, Excel litigation schedule",
    commonMistakes: [
      "Lawyer letters not obtained",
      "Provisions not properly estimated",
      "Contingencies not disclosed in notes"
    ],
    isaReferences: ["ISA 501", "ISA 500"]
  },
  INSURANCE: {
    guidance: "Please provide all insurance policies in force during the year, premium payments and coverage analysis, and any claims made or received during the period.",
    suggestedFormat: "PDF insurance policies, Excel summary of coverage",
    commonMistakes: [
      "Inadequate insurance coverage",
      "Premium prepayments not calculated",
      "Claims not properly accounted"
    ],
    isaReferences: ["ISA 500"]
  },
  LEASES: {
    guidance: "Please provide all lease agreements (property, vehicles, equipment), lease payment schedules, right-of-use asset and lease liability calculations under IFRS 16, and any lease modifications during the year.",
    suggestedFormat: "PDF lease agreements, Excel IFRS 16 calculations",
    commonMistakes: [
      "Short-term leases not properly identified",
      "Discount rate not appropriately determined",
      "Lease modifications not accounted"
    ],
    isaReferences: ["ISA 500", "ISA 540"]
  },
  INVESTMENTS: {
    guidance: "Please provide investment schedules with cost, fair value, and any impairment analysis. Include custody statements, dividend income analysis, and documentation supporting fair value measurements.",
    suggestedFormat: "Excel investment schedule with valuation details",
    commonMistakes: [
      "Fair value not properly determined",
      "Impairment indicators not assessed",
      "Dividend income not properly accounted"
    ],
    isaReferences: ["ISA 500", "ISA 540"]
  },
  OTHER: {
    guidance: "Please provide the requested documentation as specified in the request description. Ensure all documents are complete, clearly labeled, and include supporting evidence where applicable.",
    suggestedFormat: "Format as appropriate to the specific request",
    commonMistakes: [
      "Incomplete documentation",
      "Missing supporting evidence",
      "Documents not properly organized"
    ],
    isaReferences: ["ISA 500"]
  }
};

export async function generateGuidance(
  request: GuidanceRequest,
  engagementId?: string
): Promise<GuidanceResponse> {
  const startTime = Date.now();
  
  const template = HEAD_OF_ACCOUNTS_TEMPLATES[request.headOfAccounts] || HEAD_OF_ACCOUNTS_TEMPLATES.OTHER;
  
  if (!(process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY)) {
    if (engagementId) {
      await prisma.aIAssistanceLog.create({
        data: {
          engagementId,
          assistanceType: 'GUIDANCE',
          aiModelUsed: 'template-fallback',
          userQuery: JSON.stringify(request),
          aiResponse: template.guidance,
          responseTimeMs: Date.now() - startTime,
        },
      });
    }
    return template;
  }

  try {
    const systemPrompt = `You are an expert statutory auditor helping clients understand what information they need to provide for an audit. 
Your response should be clear, professional, and specific to the request.
Include practical guidance on format, common mistakes to avoid, and any specific requirements based on ISA standards.
Keep responses concise but comprehensive.`;

    const userPrompt = `Generate guidance for a client information request:
Title: ${request.requestTitle}
Category: ${request.headOfAccounts.replace(/_/g, ' ')}
Description: ${request.description}
${request.specificRequirements ? `Specific Requirements: ${request.specificRequirements}` : ''}
${request.financialStatementCategory ? `Financial Statement Area: ${request.financialStatementCategory}` : ''}
${request.auditAssertion ? `Audit Assertion: ${request.auditAssertion}` : ''}
${request.clientIndustry ? `Client Industry: ${request.clientIndustry}` : ''}

Please provide:
1. Clear guidance on what documents/information to provide
2. Suggested format for submission
3. Common mistakes to avoid
4. Any relevant ISA references`;

    const client = getOpenAIClient();
    if (!client) {
      return template;
    }
    
    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const aiResponse = completion.choices[0]?.message?.content || template.guidance;

    if (engagementId) {
      await prisma.aIAssistanceLog.create({
        data: {
          engagementId,
          assistanceType: 'GUIDANCE',
          aiModelUsed: 'gpt-4o',
          userQuery: JSON.stringify(request),
          aiResponse,
          responseTimeMs: Date.now() - startTime,
          confidenceScore: 0.9,
        },
      });
    }

    return {
      guidance: aiResponse,
      suggestedFormat: template.suggestedFormat,
      commonMistakes: template.commonMistakes,
      isaReferences: template.isaReferences,
    };
  } catch (error) {
    console.error('AI guidance generation error:', error);
    
    if (engagementId) {
      await prisma.aIAssistanceLog.create({
        data: {
          engagementId,
          assistanceType: 'GUIDANCE',
          aiModelUsed: 'template-fallback-error',
          userQuery: JSON.stringify(request),
          aiResponse: template.guidance,
          userFeedback: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          responseTimeMs: Date.now() - startTime,
        },
      });
    }
    
    return template;
  }
}

export async function checkCompleteness(
  request: CompletenessCheckRequest,
  requestId?: string
): Promise<CompletenessScore> {
  const startTime = Date.now();
  
  const baseScore = calculateBaseCompletenessScore(request);
  
  if (!(process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY)) {
    if (requestId) {
      await prisma.aIAssistanceLog.create({
        data: {
          requestId,
          assistanceType: 'COMPLETENESS_CHECK',
          aiModelUsed: 'rule-based',
          userQuery: JSON.stringify(request),
          aiResponse: JSON.stringify(baseScore),
          responseTimeMs: Date.now() - startTime,
        },
      });
    }
    return baseScore;
  }

  try {
    const systemPrompt = `You are an expert statutory auditor reviewing client responses for completeness.
Evaluate if the response adequately addresses the information request.
Be practical and consider the specific requirements mentioned.
Return your assessment as JSON only.`;

    const userPrompt = `Evaluate this client response for completeness:

Request Title: ${request.requestTitle}
Category: ${request.headOfAccounts.replace(/_/g, ' ')}
Description: ${request.description}
${request.specificRequirements ? `Specific Requirements: ${request.specificRequirements}` : ''}

Client Response: ${request.clientResponse}
Attachments Provided: ${request.attachmentCount} file(s)
${request.attachmentTypes ? `File Types: ${request.attachmentTypes.join(', ')}` : ''}

Return a JSON object with:
{
  "score": (0-100 completeness score),
  "isComplete": (true/false if response is sufficient),
  "missingElements": ["list of missing items"],
  "suggestions": ["suggestions for improvement"],
  "qualityScore": (0-100 quality assessment)
}`;

    const client = getOpenAIClient();
    if (!client) {
      return baseScore;
    }
    
    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: "json_object" },
    });

    const responseText = completion.choices[0]?.message?.content || '{}';
    let aiResult: CompletenessScore;
    
    try {
      aiResult = JSON.parse(responseText);
    } catch {
      aiResult = baseScore;
    }

    if (requestId) {
      await prisma.aIAssistanceLog.create({
        data: {
          requestId,
          assistanceType: 'COMPLETENESS_CHECK',
          aiModelUsed: 'gpt-4o',
          userQuery: JSON.stringify(request),
          aiResponse: responseText,
          responseTimeMs: Date.now() - startTime,
          confidenceScore: aiResult.score / 100,
        },
      });
    }

    return {
      score: aiResult.score ?? baseScore.score,
      isComplete: aiResult.isComplete ?? baseScore.isComplete,
      missingElements: aiResult.missingElements ?? baseScore.missingElements,
      suggestions: aiResult.suggestions ?? baseScore.suggestions,
      qualityScore: aiResult.qualityScore ?? baseScore.qualityScore,
    };
  } catch (error) {
    console.error('AI completeness check error:', error);
    
    if (requestId) {
      await prisma.aIAssistanceLog.create({
        data: {
          requestId,
          assistanceType: 'COMPLETENESS_CHECK',
          aiModelUsed: 'rule-based-fallback',
          userQuery: JSON.stringify(request),
          aiResponse: JSON.stringify(baseScore),
          userFeedback: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          responseTimeMs: Date.now() - startTime,
        },
      });
    }
    
    return baseScore;
  }
}

function calculateBaseCompletenessScore(request: CompletenessCheckRequest): CompletenessScore {
  let score = 0;
  const missingElements: string[] = [];
  const suggestions: string[] = [];

  if (request.clientResponse && request.clientResponse.length > 50) {
    score += 40;
  } else if (request.clientResponse && request.clientResponse.length > 0) {
    score += 20;
    suggestions.push("Please provide a more detailed response explaining the information provided.");
  } else {
    missingElements.push("No written response provided");
    suggestions.push("Please provide a written explanation of the attached documents or requested information.");
  }

  if (request.attachmentCount > 0) {
    score += 30;
    if (request.attachmentCount >= 2) {
      score += 10;
    }
  } else {
    missingElements.push("No supporting documents attached");
    suggestions.push("Please attach relevant supporting documents (PDF, Excel, or image files).");
  }

  const categoryExpectations: Record<string, string[]> = {
    BANK_INFORMATION: ["bank statement", "reconciliation", "confirmation"],
    FIXED_ASSETS: ["register", "additions", "depreciation"],
    INVENTORY: ["listing", "count", "valuation"],
    RECEIVABLES: ["aging", "confirmation", "provision"],
    PAYABLES: ["aging", "statement", "accruals"],
    TAXATION: ["computation", "return", "assessment"],
    RELATED_PARTY: ["list", "transaction", "approval"],
    LEGAL_MATTERS: ["lawyer", "litigation", "contingency"],
  };

  const expectations = categoryExpectations[request.headOfAccounts];
  if (expectations) {
    const responseText = request.clientResponse?.toLowerCase() || '';
    const matchedExpectations = expectations.filter(e => responseText.includes(e));
    if (matchedExpectations.length === 0) {
      score -= 10;
      suggestions.push(`Consider addressing: ${expectations.join(', ')}`);
    } else if (matchedExpectations.length >= expectations.length / 2) {
      score += 10;
    }
  }

  score = Math.max(0, Math.min(100, score));

  const qualityScore = Math.min(score + 10, 100);

  return {
    score,
    isComplete: score >= 70,
    missingElements,
    suggestions,
    qualityScore,
  };
}

export async function analyzeDocument(
  fileName: string,
  fileType: string,
  requestId?: string
): Promise<{ documentType: string; extractedData: Record<string, unknown>; verificationStatus: string }> {
  const startTime = Date.now();
  
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  let documentType = 'Unknown';
  
  if (['pdf', 'doc', 'docx'].includes(extension)) {
    if (fileName.toLowerCase().includes('bank')) documentType = 'Bank Statement';
    else if (fileName.toLowerCase().includes('invoice')) documentType = 'Invoice';
    else if (fileName.toLowerCase().includes('agreement') || fileName.toLowerCase().includes('contract')) documentType = 'Agreement/Contract';
    else if (fileName.toLowerCase().includes('certificate')) documentType = 'Certificate';
    else documentType = 'Document';
  } else if (['xls', 'xlsx', 'csv'].includes(extension)) {
    documentType = 'Spreadsheet';
    if (fileName.toLowerCase().includes('trial')) documentType = 'Trial Balance';
    else if (fileName.toLowerCase().includes('register')) documentType = 'Register';
    else if (fileName.toLowerCase().includes('aging')) documentType = 'Aging Report';
  } else if (['jpg', 'jpeg', 'png', 'gif'].includes(extension)) {
    documentType = 'Image/Scan';
  }

  const result = {
    documentType,
    extractedData: {
      fileName,
      fileType,
      analyzedAt: new Date().toISOString(),
    },
    verificationStatus: 'PENDING_REVIEW',
  };

  if (requestId) {
    await prisma.aIAssistanceLog.create({
      data: {
        requestId,
        assistanceType: 'DOCUMENT_ANALYSIS',
        aiModelUsed: 'rule-based',
        userQuery: JSON.stringify({ fileName, fileType }),
        aiResponse: JSON.stringify(result),
        responseTimeMs: Date.now() - startTime,
      },
    });
  }

  return result;
}

export default {
  generateGuidance,
  checkCompleteness,
  analyzeDocument,
};
