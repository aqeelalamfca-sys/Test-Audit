import { Router, Response } from "express";
import { prisma } from "../db";
import { requireAuth, type AuthenticatedRequest } from "../auth";
import { z } from "zod";
import OpenAI from "openai";

interface FieldConfig {
  key: string;
  label: string;
  promptHint?: string;
}

interface TabMapping {
  tabId: string;
  tabLabel: string;
  fields: FieldConfig[];
}

const PREPLANNING_FIELD_MAPPING: TabMapping[] = [
  {
    tabId: "acceptance",
    tabLabel: "Client Acceptance",
    fields: [
      { key: "decisionRationale", label: "Decision Rationale", promptHint: "Explain the rationale for accepting or continuing this audit engagement based on ISA 220 requirements" },
      { key: "evaluationNotes", label: "Evaluation Notes", promptHint: "Document the evaluation of client acceptance criteria including integrity, competence, and resources" },
      { key: "potentialThreats", label: "Potential Threats to Independence", promptHint: "Identify potential threats to independence as per IESBA Code and ICAP ethics requirements" },
      { key: "safeguards", label: "Safeguards", promptHint: "Document safeguards to mitigate identified threats to independence" },
      { key: "specialConsiderations", label: "Special Considerations", promptHint: "Note any special audit considerations such as industry-specific requirements, regulatory oversight, or complex transactions" },
      { key: "changeReasons", label: "Reasons for Auditor Change", promptHint: "Document reasons for change of auditor if applicable, including communications with predecessor auditor per ISA 300" },
      { key: "predecessorCommunication", label: "Predecessor Auditor Communications", promptHint: "Summarize communications with predecessor auditor as required by ISA 300 and ICAP guidelines" },
      { key: "fraudRisks", label: "Fraud Risks", promptHint: "Identify potential fraud risk factors based on ISA 240 requirements and client-specific circumstances" },
      { key: "businessRisks", label: "Business Risks", promptHint: "Document significant business risks that may affect the audit approach and financial statements" },
      { key: "goingConcernIndicators", label: "Going Concern Indicators", promptHint: "Note any indicators that may cast doubt on the entity's ability to continue as a going concern per ISA 570" },
      { key: "firmCompetence", label: "Firm Competence", promptHint: "Assess firm's competence to perform the audit including relevant industry experience and technical expertise" },
      { key: "firmResources", label: "Firm Resources", promptHint: "Evaluate availability of firm resources including staff, specialists, and time to complete the engagement" },
      { key: "independenceEvaluation", label: "Independence Evaluation", promptHint: "Document the independence evaluation including any threats and safeguards per IESBA and ICAP requirements" },
      { key: "legalRequirements", label: "Legal/Regulatory Requirements", promptHint: "Identify applicable legal and regulatory requirements including Companies Act 2017 and SECP regulations" },
      { key: "feeStructure", label: "Fee Structure", promptHint: "Document the proposed fee structure ensuring it does not create threats to independence" },
      { key: "budgetConsiderations", label: "Budget Considerations", promptHint: "Note budget considerations and resource allocation for the engagement" },
    ],
  },
  {
    tabId: "general-info",
    tabLabel: "General Information",
    fields: [
      { key: "subsidiaries", label: "Subsidiaries/Associates", promptHint: "List subsidiaries and associates relevant to group audit considerations per ISA 600" },
      { key: "keyContacts", label: "Key Contacts", promptHint: "Document key management contacts for the engagement including their roles and responsibilities" },
    ],
  },
  {
    tabId: "due-diligence",
    tabLabel: "Due Diligence & KYC",
    fields: [
      { key: "clientBackground", label: "Client Background", promptHint: "Provide comprehensive background on the client including history, operations, and market position" },
      { key: "sourceOfFunds", label: "Source of Funds", promptHint: "Document the entity's primary sources of funds and revenue as part of AML/KYC procedures" },
      { key: "businessReputation", label: "Business Reputation Assessment", promptHint: "Assess the client's business reputation based on available information and inquiries" },
      { key: "uboDetails", label: "UBO Details", promptHint: "Document Ultimate Beneficial Owners as required by AML regulations and FATF guidelines" },
      { key: "uboVerification", label: "UBO Verification Status", promptHint: "Document verification procedures performed for UBOs including documents reviewed" },
      { key: "highRiskJurisdictions", label: "High-Risk Jurisdictions", promptHint: "Note any business relationships with high-risk or sanctioned jurisdictions per FATF guidance" },
      { key: "regulatoryPenalties", label: "Previous Regulatory Penalties", promptHint: "Document any known regulatory penalties or enforcement actions against the entity" },
      { key: "litigationHistory", label: "Litigation History", promptHint: "Summarize known litigation history that may affect the audit or financial statements" },
    ],
  },
  {
    tabId: "entity_understanding",
    tabLabel: "Entity Understanding (ISA 315)",
    fields: [
      { key: "entityBackground", label: "Entity Background", promptHint: "Describe the entity's nature, legal structure, ownership, and size classification per ISA 315.A1-A30" },
      { key: "industryEnvironment", label: "Industry & External Environment", promptHint: "Analyze industry risks, regulatory environment, and economic factors affecting the entity per ISA 315.A31-A43" },
      { key: "businessOperations", label: "Business Operations", promptHint: "Document revenue streams, key customers/suppliers, seasonal patterns, and operational characteristics per ISA 315.A44-A60" },
      { key: "governanceStructure", label: "Governance & Management", promptHint: "Describe the governance structure, TCWG composition, and management competence assessment per ISA 315.A61-A75" },
      { key: "controlEnvironment", label: "Internal Control Environment", promptHint: "Assess the control environment, risk assessment process, information systems, and monitoring activities per ISA 315.A76-A105" },
      { key: "relatedParties", label: "Related Parties", promptHint: "Identify related parties, their relationships, and nature of transactions per ISA 550" },
      { key: "reportingFrameworkNotes", label: "Applicable Financial Reporting Framework", promptHint: "Document the applicable financial reporting framework (IFRS/SME) and any specific requirements relevant to the entity" },
    ],
  },
  {
    tabId: "risk_assessment",
    tabLabel: "Risk Assessment (ISA 315/240)",
    fields: [
      { key: "preliminaryRisks", label: "Preliminary Risk Identification", promptHint: "Identify and document preliminary risks by category (inherent, control, fraud) with assertion-level mapping per ISA 315" },
      { key: "fraudRiskFactors", label: "Fraud Risk Factors (ISA 240)", promptHint: "Assess fraud risk factors including pressure, opportunity, and rationalization indicators per ISA 240" },
      { key: "presumedRisks", label: "Presumed Risks", promptHint: "Document presumed risks including revenue recognition fraud risk (ISA 240.26) and management override of controls (ISA 240.31)" },
      { key: "goingConcernAssessment", label: "Going Concern Assessment (ISA 570)", promptHint: "Evaluate financial and operational indicators of going concern doubt, and document the preliminary conclusion per ISA 570" },
      { key: "significantAccounts", label: "Significant Account Identification", promptHint: "Identify significant accounts and disclosures based on trial balance data and performance materiality thresholds" },
      { key: "overallRiskAssessment", label: "Overall Risk Assessment", promptHint: "Document the combined assessment of inherent risk, control risk, and the overall engagement risk level" },
    ],
  },
  {
    tabId: "materiality",
    tabLabel: "Materiality (ISA 320)",
    fields: [
      { key: "benchmarkSelection", label: "Benchmark Selection Rationale", promptHint: "Justify the selected materiality benchmark (Revenue, Total Assets, PBT, Equity, Gross Profit) based on entity characteristics per ISA 320" },
      { key: "materialityComputation", label: "Materiality Computation Notes", promptHint: "Document the overall materiality calculation, performance materiality (50-75% of overall), and trivial threshold (typically 5%) per ISA 320" },
      { key: "componentMateriality", label: "Component Materiality", promptHint: "If group audit, document component materiality allocation and rationale per ISA 600" },
      { key: "materialityRationale", label: "Overall Materiality Rationale", promptHint: "Provide a comprehensive rationale for all materiality levels set, including considerations of prior period misstatements and entity-specific factors" },
    ],
  },
  {
    tabId: "audit_strategy",
    tabLabel: "Audit Strategy & TCWG (ISA 300/260)",
    fields: [
      { key: "overallStrategy", label: "Overall Audit Strategy", promptHint: "Document the overall audit strategy including scope, timing, direction, and planned audit approach (substantive vs combined) per ISA 300" },
      { key: "keyAreasOfFocus", label: "Key Areas of Focus", promptHint: "Identify key areas of audit focus based on risk assessment results, significant risks, and significant accounts" },
      { key: "resourceTimingPlan", label: "Resource & Timing Plan", promptHint: "Document planned hours by phase, key dates, specialist needs, and resource allocation for the engagement per ISA 300" },
      { key: "tcwgIdentification", label: "TCWG Identification", promptHint: "Identify Those Charged With Governance, their roles, and contact information per ISA 260" },
      { key: "plannedCommunications", label: "Planned Communications", promptHint: "Document the planned scope/timing of communications with TCWG, including significant findings approach and communication schedule per ISA 260" },
      { key: "planningMemoSummary", label: "Planning Memo Summary", promptHint: "Provide an AI-generated summary of all pre-planning conclusions, key decisions, and the overall audit approach" },
    ],
  },
];

function getAIEligibleFields(tabId: string): FieldConfig[] {
  const tab = PREPLANNING_FIELD_MAPPING.find((t: TabMapping) => t.tabId === tabId);
  return tab?.fields || [];
}

const db = prisma as any;
const router = Router();

const PREPLANNING_SYSTEM_PROMPT = `You are an expert statutory auditor in Pakistan with deep knowledge of:
- International Standards on Auditing (ISA)
- ICAP (Institute of Chartered Accountants of Pakistan) requirements
- IESBA Code of Ethics
- Companies Act 2017 (Pakistan)
- SECP regulations
- AML/CFT requirements (FATF guidelines)
- ISQM 1 and ISQM 2

When generating content for pre-planning documentation:
1. Be professional, factual, and consistent with provided client/engagement data
2. Use Pakistan statutory audit context where relevant
3. Use conditional language when data is incomplete: "Based on the information available..." / "Management indicated..."
4. Do NOT change or fabricate names, dates, NTN, registration numbers, or any identifiers
5. Keep responses concise but detailed enough for audit documentation (typically 6-10 lines per field)
6. Reference applicable ISA standards where appropriate without citing specific sections unless explicitly provided
7. Maintain an objective, professional tone suitable for audit workpapers`;

const generateContextSchema = z.object({
  engagementId: z.string(),
  tabId: z.string(),
  fieldKeys: z.array(z.string()).optional(),
  existingFieldValues: z.record(z.string()).optional(),
  action: z.enum(["fill", "rephrase"]),
  selectedFieldKey: z.string().optional(),
});

router.get("/context/:engagementId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;

    const engagement = await db.engagement.findUnique({
      where: { id: engagementId },
      include: {
        client: true,
        clientMaster: {
          include: {
            owners: true,
            directors: true,
            contacts: true,
          },
        },
        team: {
          include: {
            user: {
              select: { id: true, fullName: true, email: true, role: true },
            },
          },
        },
      },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const context = {
      engagement: {
        id: engagement.id,
        engagementCode: engagement.engagementCode,
        engagementType: engagement.engagementType,
        reportingFramework: engagement.reportingFramework,
        currentPhase: engagement.currentPhase,
        status: engagement.status,
        riskRating: engagement.riskRating,
        periodStart: engagement.periodStart,
        periodEnd: engagement.periodEnd,
        fiscalYearEnd: engagement.fiscalYearEnd,
        priorAuditor: engagement.priorAuditor,
        priorAuditorReason: engagement.priorAuditorReason,
        eqcrRequired: engagement.eqcrRequired,
        eqcrRationale: engagement.eqcrRationale,
      },
      client: engagement.client ? {
        id: engagement.client.id,
        name: engagement.client.name,
        tradingName: engagement.client.tradingName,
        industry: engagement.client.industry,
        subIndustry: engagement.client.subIndustry,
      } : null,
      clientMaster: engagement.clientMaster ? {
        legalName: engagement.clientMaster.legalName,
        tradeName: engagement.clientMaster.tradeName,
        ntn: engagement.clientMaster.ntn,
        strn: engagement.clientMaster.strn,
        secpRegNo: engagement.clientMaster.secpRegNo,
        legalForm: engagement.clientMaster.legalForm,
        dateOfIncorporation: engagement.clientMaster.dateOfIncorporation,
        registeredAddress: engagement.clientMaster.registeredAddress,
        registeredCity: engagement.clientMaster.registeredCity,
        registeredProvince: engagement.clientMaster.registeredProvince,
        businessAddress: engagement.clientMaster.businessAddress,
        phone: engagement.clientMaster.phone,
        email: engagement.clientMaster.email,
        website: engagement.clientMaster.website,
        industry: engagement.clientMaster.industry,
        subIndustry: engagement.clientMaster.subIndustry,
        natureOfBusiness: engagement.clientMaster.natureOfBusiness,
        principalLineOfBusiness: engagement.clientMaster.principalLineOfBusiness,
        regulatoryBodies: engagement.clientMaster.regulatoryBodies,
        listedStatus: engagement.clientMaster.listedStatus,
        stockExchange: engagement.clientMaster.stockExchange,
        parentCompanyName: engagement.clientMaster.parentCompanyName,
        owners: engagement.clientMaster.owners?.map((o: any) => ({
          name: o.name,
          holdingPercentage: o.holdingPercentage,
          isUBO: o.isUBO,
          isPEP: o.isPEP,
        })),
        directors: engagement.clientMaster.directors?.map((d: any) => ({
          name: d.name,
          designation: d.designation,
        })),
        contacts: engagement.clientMaster.contacts?.map((c: any) => ({
          name: c.name,
          role: c.role,
          email: c.email,
        })),
      } : null,
      team: engagement.team?.map((t: any) => ({
        role: t.role,
        userName: t.user?.fullName,
        userRole: t.user?.role,
      })),
    };

    res.json(context);
  } catch (error) {
    console.error("Get preplanning context error:", error);
    res.status(500).json({ error: "Failed to fetch context" });
  }
});

router.post("/generate", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user?.firmId;
    const userId = req.user?.id;

    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const data = generateContextSchema.parse(req.body);

    const settings = await db.aISettings.findUnique({
      where: { firmId },
    });

    const aiEnabled = settings?.aiEnabled ?? true;
    const hasApiKey = settings?.openaiApiKey || process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

    if (!aiEnabled) {
      return res.status(403).json({ error: "AI is disabled. Please enable AI in Settings." });
    }

    if (!hasApiKey) {
      return res.status(400).json({ error: "No API key configured. Please add an API key in Settings to use AI features." });
    }

    const engagement = await db.engagement.findUnique({
      where: { id: data.engagementId },
      include: {
        client: true,
        clientMaster: {
          include: {
            owners: true,
            directors: true,
            contacts: true,
          },
        },
      },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const tabMapping = PREPLANNING_FIELD_MAPPING.find(t => t.tabId === data.tabId);
    if (!tabMapping) {
      return res.status(400).json({ error: "Invalid tab ID" });
    }

    const eligibleFields = getAIEligibleFields(data.tabId);
    const fieldsToProcess = data.fieldKeys 
      ? eligibleFields.filter(f => data.fieldKeys!.includes(f.key))
      : eligibleFields;

    if (fieldsToProcess.length === 0) {
      return res.status(400).json({ error: "No AI-eligible fields found for this tab" });
    }

    let financialContext = "";
    const financialTabs = ["entity_understanding", "risk_assessment", "materiality", "audit_strategy"];
    if (financialTabs.includes(data.tabId)) {
      const tbBalances = await db.importAccountBalance.findMany({
        where: { engagementId: data.engagementId, balanceType: "CB" },
        select: {
          accountCode: true,
          accountName: true,
          accountClass: true,
          debitAmount: true,
          creditAmount: true,
        },
      });

      let totalAssets = 0, totalLiabilities = 0, totalEquity = 0, totalRevenue = 0, totalExpenses = 0;
      for (const bal of tbBalances) {
        const net = parseFloat(String(bal.debitAmount || 0)) - parseFloat(String(bal.creditAmount || 0));
        if (bal.accountClass === "ASSET") totalAssets += net;
        else if (bal.accountClass === "LIABILITY") totalLiabilities += Math.abs(net);
        else if (bal.accountClass === "EQUITY") totalEquity += Math.abs(net);
        else if (bal.accountClass === "INCOME") totalRevenue += Math.abs(net);
        else if (bal.accountClass === "EXPENSE") totalExpenses += net;
      }

      const pbt = totalRevenue - totalExpenses;
      const glCount = await db.gLEntry.count({ where: { engagementId: data.engagementId } });

      financialContext = `\n\n=== FINANCIAL DATA (from Trial Balance) ===
Total Assets: ${totalAssets.toLocaleString()}
Total Liabilities: ${totalLiabilities.toLocaleString()}
Total Equity: ${totalEquity.toLocaleString()}
Total Revenue: ${totalRevenue.toLocaleString()}
Total Expenses: ${totalExpenses.toLocaleString()}
Profit Before Tax: ${pbt.toLocaleString()}
Number of TB Accounts: ${tbBalances.length}
Number of GL Entries: ${glCount}
Current Ratio: ${totalLiabilities > 0 ? (totalAssets / totalLiabilities).toFixed(2) : 'N/A'}
Debt to Equity: ${totalEquity > 0 ? (totalLiabilities / totalEquity).toFixed(2) : 'N/A'}`;
    }

    const contextData = buildContextString(engagement, data.existingFieldValues || {}) + financialContext;

    const openai = new OpenAI({
      apiKey: settings?.openaiApiKey || process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });

    const results: Record<string, { content: string; aiGenerated: boolean; timestamp: string }> = {};

    if (data.action === "fill") {
      for (const field of fieldsToProcess) {
        const existingValue = data.existingFieldValues?.[field.key] || "";
        
        if (existingValue.trim()) {
          continue;
        }

        const userPrompt = buildFillPrompt(field, contextData, tabMapping.tabLabel);

        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: PREPLANNING_SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          max_tokens: settings?.maxTokensPerResponse || 1000,
          temperature: 0.7,
        });

        const content = response.choices[0]?.message?.content || "";

        results[field.key] = {
          content: content.trim(),
          aiGenerated: true,
          timestamp: new Date().toISOString(),
        };
      }
    } else if (data.action === "rephrase" && data.selectedFieldKey) {
      const field = eligibleFields.find(f => f.key === data.selectedFieldKey);
      if (!field) {
        return res.status(400).json({ error: "Field not found or not eligible for AI" });
      }

      const existingValue = data.existingFieldValues?.[data.selectedFieldKey] || "";
      if (!existingValue.trim()) {
        return res.status(400).json({ error: "No existing content to rephrase" });
      }

      const userPrompt = buildRephrasePrompt(field, existingValue, contextData);

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: PREPLANNING_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        max_tokens: settings?.maxTokensPerResponse || 1500,
        temperature: 0.7,
      });

      const content = response.choices[0]?.message?.content || "";

      results[data.selectedFieldKey] = {
        content: content.trim(),
        aiGenerated: true,
        timestamp: new Date().toISOString(),
      };
    }

    await db.aIUsageLog.create({
      data: {
        firmId,
        userId,
        engagementId: data.engagementId,
        section: `preplanning_${data.tabId}`,
        action: data.action,
        aiProvider: "openai",
        aiDraftContent: JSON.stringify(results),
        userConfirmed: false,
      },
    });

    res.json({
      results,
      fieldsProcessed: Object.keys(results).length,
    });
  } catch (error: any) {
    console.error("Preplanning AI generate error:", error);
    if (error?.status === 429) {
      return res.status(429).json({ error: "API quota exhausted. Please try again later." });
    }
    res.status(500).json({ error: "AI generation failed. Please try again." });
  }
});

function buildContextString(engagement: any, existingValues: Record<string, string>): string {
  const parts: string[] = [];

  parts.push("=== ENGAGEMENT INFORMATION ===");
  parts.push(`Engagement Code: ${engagement.engagementCode}`);
  parts.push(`Engagement Type: ${engagement.engagementType?.replace(/_/g, ' ') || 'Statutory Audit'}`);
  parts.push(`Reporting Framework: ${engagement.reportingFramework || 'IFRS'}`);
  parts.push(`Risk Rating: ${engagement.riskRating || 'Medium'}`);
  
  if (engagement.periodStart && engagement.periodEnd) {
    parts.push(`Audit Period: ${new Date(engagement.periodStart).toLocaleDateString()} to ${new Date(engagement.periodEnd).toLocaleDateString()}`);
  }
  if (engagement.fiscalYearEnd) {
    parts.push(`Fiscal Year End: ${new Date(engagement.fiscalYearEnd).toLocaleDateString()}`);
  }
  if (engagement.priorAuditor) {
    parts.push(`Prior Auditor: ${engagement.priorAuditor}`);
    if (engagement.priorAuditorReason) {
      parts.push(`Reason for Change: ${engagement.priorAuditorReason}`);
    }
  }

  if (engagement.client) {
    parts.push("\n=== CLIENT INFORMATION ===");
    parts.push(`Client Name: ${engagement.client.name}`);
    if (engagement.client.tradingName) parts.push(`Trading Name: ${engagement.client.tradingName}`);
    if (engagement.client.industry) parts.push(`Industry: ${engagement.client.industry}`);
    if (engagement.client.subIndustry) parts.push(`Sub-Industry: ${engagement.client.subIndustry}`);
  }

  if (engagement.clientMaster) {
    const cm = engagement.clientMaster;
    parts.push("\n=== CLIENT MASTER DATA ===");
    parts.push(`Legal Name: ${cm.legalName}`);
    if (cm.tradeName) parts.push(`Trade Name: ${cm.tradeName}`);
    if (cm.ntn) parts.push(`NTN: ${cm.ntn}`);
    if (cm.secpRegNo) parts.push(`SECP Registration: ${cm.secpRegNo}`);
    if (cm.legalForm) parts.push(`Legal Form: ${cm.legalForm?.replace(/_/g, ' ')}`);
    if (cm.dateOfIncorporation) parts.push(`Date of Incorporation: ${new Date(cm.dateOfIncorporation).toLocaleDateString()}`);
    if (cm.registeredAddress) parts.push(`Registered Address: ${cm.registeredAddress}, ${cm.registeredCity || ''}, ${cm.registeredProvince || ''}`);
    if (cm.businessAddress) parts.push(`Business Address: ${cm.businessAddress}`);
    if (cm.industry) parts.push(`Industry: ${cm.industry}`);
    if (cm.subIndustry) parts.push(`Sub-Industry: ${cm.subIndustry}`);
    if (cm.natureOfBusiness) parts.push(`Nature of Business: ${cm.natureOfBusiness}`);
    if (cm.principalLineOfBusiness) parts.push(`Principal Line of Business: ${cm.principalLineOfBusiness}`);
    if (cm.regulatoryBodies?.length) parts.push(`Regulatory Bodies: ${cm.regulatoryBodies.join(', ')}`);
    if (cm.listedStatus) parts.push(`Listed Status: ${cm.listedStatus}`);
    if (cm.stockExchange) parts.push(`Stock Exchange: ${cm.stockExchange}`);
    if (cm.parentCompanyName) parts.push(`Parent Company: ${cm.parentCompanyName}`);

    if (cm.owners?.length) {
      parts.push("\nKey Shareholders/Owners:");
      cm.owners.forEach((o: any) => {
        let ownerInfo = `- ${o.name}`;
        if (o.holdingPercentage) ownerInfo += ` (${o.holdingPercentage}%)`;
        if (o.isUBO) ownerInfo += " [UBO]";
        if (o.isPEP) ownerInfo += " [PEP]";
        parts.push(ownerInfo);
      });
    }

    if (cm.directors?.length) {
      parts.push("\nDirectors:");
      cm.directors.forEach((d: any) => {
        parts.push(`- ${d.name}${d.designation ? ` (${d.designation})` : ''}`);
      });
    }

    if (cm.contacts?.length) {
      parts.push("\nKey Contacts:");
      cm.contacts.forEach((c: any) => {
        parts.push(`- ${c.name}${c.role ? ` (${c.role})` : ''}${c.email ? ` - ${c.email}` : ''}`);
      });
    }
  }

  const filledFields = Object.entries(existingValues).filter(([_, v]) => v && v.trim());
  if (filledFields.length > 0) {
    parts.push("\n=== ALREADY DOCUMENTED INFORMATION ===");
    filledFields.forEach(([key, value]) => {
      parts.push(`${key}: ${value}`);
    });
  }

  return parts.join("\n");
}

function buildFillPrompt(field: any, contextData: string, tabLabel: string): string {
  return `Based on the following client and engagement context, generate professional audit documentation for the "${field.label}" field in the "${tabLabel}" section of the Pre-Planning phase.

${field.promptHint ? `Guidance: ${field.promptHint}` : ''}

Context:
${contextData}

Requirements:
- Generate 6-10 lines of professional audit documentation
- Be factual and consistent with the provided data
- Use conditional language for inferences: "Based on available information..." or "Management has indicated..."
- Do not fabricate specific facts, dates, or figures not provided in the context
- Reference applicable ISA standards where relevant
- Maintain Pakistan statutory audit context where appropriate

Generate the content for "${field.label}":`;
}

function buildRephrasePrompt(field: any, existingContent: string, contextData: string): string {
  return `Rephrase and expand the following text into a more detailed, professional audit documentation suitable for workpapers.

Original Text:
${existingContent}

Context for Reference:
${contextData}

Requirements:
- Maintain the original meaning and factual content
- Expand with more professional and detailed language
- Add relevant audit terminology and structure
- Keep the same tone but make it more suitable for audit documentation
- Reference applicable ISA standards where relevant
- Target length: 8-12 lines

Provide the rephrased and expanded version:`;
}

export default router;
