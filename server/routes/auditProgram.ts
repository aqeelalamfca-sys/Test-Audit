import { Router, Request, Response } from "express";
import OpenAI from "openai";

const router = Router();

function getOpenAIClient(): OpenAI | null {
  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    return null;
  }
  return new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });
}

interface AccountHead {
  name: string;
  tbCoverage: string[];
  balance: number;
  materialityStatus: string;
  riskLevel: string;
  assertions: string[];
}

interface GenerateAuditProgramRequest {
  accountHeads: AccountHead[];
  overallMateriality: number;
  performanceMateriality: number;
  industryType: string;
  riskAssessment: string;
}

router.post("/generate", async (req: Request, res: Response) => {
  try {
    const openai = getOpenAIClient();
    if (!openai) {
      return res.status(503).json({ success: false, error: "AI service not configured. Please set up OpenAI API key." });
    }
    
    const { accountHeads, overallMateriality, performanceMateriality, industryType, riskAssessment }: GenerateAuditProgramRequest = req.body;

    const prompt = `You are an expert statutory auditor. Generate ISA-compliant audit procedures for each account head.

Context:
- Overall Materiality: ${overallMateriality}
- Performance Materiality: ${performanceMateriality}
- Industry Type: ${industryType}
- Risk Assessment: ${riskAssessment}

Account Heads to cover:
${accountHeads.map(ah => `
Account: ${ah.name}
TB Coverage: ${ah.tbCoverage.join(", ")}
Balance: ${ah.balance}
Materiality Status: ${ah.materialityStatus}
Risk Level: ${ah.riskLevel}
Relevant Assertions: ${ah.assertions.join(", ")}
`).join("\n")}

For each account head, generate:
1. 4-6 specific audit procedures (controls testing, substantive testing, analytical procedures)
2. Consider the risk level and tailor procedures accordingly
3. Include ISA references where applicable (ISA 300, 315, 330, 500, 505, 520, 530, 540, etc.)

Return as JSON array with this structure:
[
  {
    "accountHead": "string",
    "materialityStatus": "Material" | "Immaterial",
    "riskLevel": "High" | "Medium" | "Low",
    "assertions": ["string"],
    "procedures": [
      {
        "id": "string",
        "type": "Control" | "Substantive" | "Analytical",
        "description": "string",
        "isaReference": "string"
      }
    ]
  }
]`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are an expert statutory auditor specializing in ISA-compliant audit programs. Always respond with valid JSON." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content || "{}";
    const result = JSON.parse(content);
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Error generating audit program:", error);
    res.status(500).json({ success: false, error: "Failed to generate audit program" });
  }
});

router.post("/suggest-clubbing", async (req: Request, res: Response) => {
  try {
    const openai = getOpenAIClient();
    if (!openai) {
      return res.status(503).json({ success: false, error: "AI service not configured. Please set up OpenAI API key." });
    }
    
    const { accounts, performanceMateriality } = req.body;

    const prompt = `Analyze these accounts and suggest which ones can be clubbed together for audit purposes.

Accounts:
${JSON.stringify(accounts, null, 2)}

Performance Materiality: ${performanceMateriality}

Rules for clubbing:
1. Individual balance < 10% of Performance Materiality
2. Similar nature of account
3. Same account category

Return JSON with structure:
{
  "clubs": [
    {
      "clubName": "string",
      "accounts": ["string"],
      "totalBalance": number,
      "rationale": "string"
    }
  ],
  "standalone": ["string"]
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are an expert statutory auditor. Respond with valid JSON only." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content || "{}";
    const result = JSON.parse(content);
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Error suggesting clubbing:", error);
    res.status(500).json({ success: false, error: "Failed to suggest account clubbing" });
  }
});

router.post("/enhance-procedure", async (req: Request, res: Response) => {
  try {
    const openai = getOpenAIClient();
    if (!openai) {
      return res.status(503).json({ success: false, error: "AI service not configured. Please set up OpenAI API key." });
    }
    
    const { procedure, accountHead, riskLevel } = req.body;

    const prompt = `Enhance this audit procedure to be more specific and ISA-compliant:

Current Procedure: ${procedure}
Account Head: ${accountHead}
Risk Level: ${riskLevel}

Provide an enhanced version that:
1. Is more detailed and specific
2. Includes sample size considerations
3. References relevant ISAs
4. Considers the risk level

Return JSON:
{
  "enhancedProcedure": "string",
  "sampleSize": "string",
  "isaReferences": ["string"],
  "estimatedEffort": "string"
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are an expert statutory auditor. Respond with valid JSON only." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content || "{}";
    const result = JSON.parse(content);
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Error enhancing procedure:", error);
    res.status(500).json({ success: false, error: "Failed to enhance procedure" });
  }
});

router.post("/generate-execution-guidance", async (req: Request, res: Response) => {
  try {
    const openai = getOpenAIClient();
    if (!openai) {
      return res.status(503).json({ success: false, error: "AI service not configured. Please set up OpenAI API key." });
    }
    
    const { context } = req.body;

    const prompt = `You are an expert statutory auditor. Provide practical guidance for execution phase audit procedures.

Context: ${context}

Provide brief, actionable guidance that helps the auditor:
1. Understand what evidence to gather
2. How to document findings appropriately
3. Key ISA requirements to consider
4. Professional skepticism considerations

Return JSON:
{
  "guidance": "string with 2-3 paragraphs of practical guidance"
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are an expert statutory auditor. Provide concise, ISA-compliant guidance. Respond with valid JSON only." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content || "{}";
    const result = JSON.parse(content);
    
    res.json({ success: true, guidance: result.guidance || "" });
  } catch (error) {
    console.error("Error generating execution guidance:", error);
    res.status(500).json({ success: false, error: "Failed to generate guidance" });
  }
});

router.post("/generate-walkthrough-narrative", async (req: Request, res: Response) => {
  try {
    const openai = getOpenAIClient();
    if (!openai) {
      return res.status(503).json({ success: false, error: "AI service not configured. Please set up OpenAI API key." });
    }
    
    const { processName, relatedAccountHeads, natureOfProcess, systemUsed } = req.body;

    const prompt = `You are an expert statutory auditor specializing in ISA 315 compliant system walkthroughs. Generate a detailed process flow narrative for the following process:

Process: ${processName}
Related Account Heads: ${relatedAccountHeads?.join(", ") || "Not specified"}
Nature of Process: ${natureOfProcess}
System/Application Used: ${systemUsed || "Not specified"}

Generate a numbered list of 7-10 detailed narrative steps that describe:
1. How the transaction is initiated (who initiates, trigger events)
2. What source documents are generated/used
3. Data entry procedures (who enters, what system, validation)
4. Authorization and approval workflow (who approves, levels, limits)
5. System or manual validation controls in place
6. Posting to general ledger (timing, automation level)
7. Reports generated and review process
8. Reconciliation procedures (if applicable)
9. Exception handling procedures
10. Period-end cut-off procedures

Each step should be specific to the ${processName} process and include:
- Who performs the action (role/department)
- What documents/records are involved
- Key control points
- System/manual nature of the step

Return JSON:
{
  "narrativeSteps": [
    "1. [Detailed step description]",
    "2. [Detailed step description]",
    ...
  ]
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are an expert statutory auditor specializing in ISA 315 compliant system walkthroughs and internal control documentation. Respond with valid JSON only." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content || "{}";
    const result = JSON.parse(content);
    
    res.json({ success: true, narrativeSteps: result.narrativeSteps || [] });
  } catch (error) {
    console.error("Error generating walkthrough narrative:", error);
    res.status(500).json({ success: false, error: "Failed to generate walkthrough narrative" });
  }
});

// AI Procedure Generation - Context-aware procedure generation based on company profile, laws, and standards
interface GenerateAIProceduresRequest {
  accountHead: string;
  tbCoverage: string[];
  materialityStatus: string;
  riskLevel: string;
  assertions: string[];
  industryType: string;
  overallMateriality: number;
  performanceMateriality: number;
  existingProcedures: string[];
  // Optional context for enhanced generation
  companyProfile?: {
    name?: string;
    country?: string;
    regulatoryFramework?: string;
    fiscalYear?: string;
    listedStatus?: string;
  };
}

router.post("/generate-ai-procedures", async (req: Request, res: Response) => {
  try {
    const openai = getOpenAIClient();
    if (!openai) {
      return res.status(503).json({ success: false, error: "AI service not configured. Please set up OpenAI API key." });
    }

    const { 
      accountHead, 
      tbCoverage, 
      materialityStatus, 
      riskLevel, 
      assertions,
      industryType,
      overallMateriality,
      performanceMateriality,
      existingProcedures,
      companyProfile
    }: GenerateAIProceduresRequest = req.body;

    // Determine applicable laws and standards based on context
    const country = companyProfile?.country || "Pakistan";
    const regulatoryFramework = companyProfile?.regulatoryFramework || "ICAP/SECP";
    const listedStatus = companyProfile?.listedStatus || "Unlisted";
    const fiscalYear = companyProfile?.fiscalYear || new Date().getFullYear().toString();

    const localLawsContext = country.toLowerCase() === "pakistan" ? `
Local Laws and Regulations (Pakistan):
- Companies Act 2017 (especially Fourth Schedule for audit report contents)
- Income Tax Ordinance 2001 (withholding tax, advance tax, minimum tax)
- Sales Tax Act 1990
- SECP Listed Companies Code of Corporate Governance 2019 (if listed)
- ICAP Code of Ethics (aligned with IESBA)
- State Bank Prudential Regulations (if banking sector)
- NEPRA/OGRA regulations (if energy sector)
` : country.toLowerCase() === "uk" ? `
Local Laws and Regulations (UK):
- UK Companies Act 2006
- UK Corporate Governance Code 2018
- FRC Ethical Standard 2019
- HMRC tax compliance requirements
- FCA regulations (if financial services)
` : `
International Standards:
- IFRS/IAS as primary accounting framework
- Local GAAP where applicable
- Local tax laws and regulations
`;

    const industrySpecificContext = getIndustryContext(industryType);

    const prompt = `You are an expert statutory auditor specializing in ${industryType} sector audits. Generate ISA-compliant audit procedures for the following account head.

CONTEXT:
Account Head: ${accountHead}
TB Coverage: ${tbCoverage.join(", ")}
Materiality Status: ${materialityStatus}
Risk Level: ${riskLevel}
Relevant Assertions: ${assertions.join(", ")}
Overall Materiality: ${overallMateriality.toLocaleString()}
Performance Materiality: ${performanceMateriality.toLocaleString()}
Industry: ${industryType}
Fiscal Year: ${fiscalYear}
Listed Status: ${listedStatus}

${localLawsContext}

${industrySpecificContext}

APPLICABLE AUDITING STANDARDS:
- International Standards on Auditing (ISA) - all relevant standards
- ISQM 1 (Quality Management)
- ISA 200 (Overall Objectives)
- ISA 230 (Audit Documentation)
- ISA 240 (Fraud)
- ISA 315 (Risk Assessment)
- ISA 330 (Responses to Assessed Risks)
- ISA 500-580 (Audit Evidence)
- ISA 700-720 (Reporting)

EXISTING PROCEDURES (avoid duplication):
${existingProcedures.length > 0 ? existingProcedures.map((p, i) => `${i + 1}. ${p}`).join("\n") : "None yet"}

REQUIREMENTS:
1. Generate 4-6 specific, actionable audit procedures
2. Each procedure must be tailored to the ${riskLevel} risk level
3. Include specific ISA references
4. Consider ${materialityStatus === "Material" ? "extensive substantive testing" : "limited testing"} approach
5. Include industry-specific considerations for ${industryType}
6. Consider local regulatory requirements
7. Vary procedure types: at least 1 Control, 2-3 Substantive, 1 Analytical

Return JSON with this exact structure:
{
  "procedures": [
    {
      "type": "Control" | "Substantive" | "Analytical",
      "description": "Detailed, specific procedure description",
      "isaReference": "ISA XXX.YY",
      "assertions": ["relevant assertions"],
      "sampleSizeGuidance": "Based on risk level, suggested sample size approach",
      "localCompliance": "Any local law/regulation considerations"
    }
  ],
  "riskConsiderations": "Brief explanation of risk-based approach taken",
  "industryConsiderations": "Industry-specific factors considered"
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { 
          role: "system", 
          content: `You are an expert statutory auditor with deep knowledge of:
- International Standards on Auditing (ISA)
- IFRS/IAS accounting standards
- Local laws and regulations (Pakistan ICAP/SECP, UK FRC, etc.)
- Industry-specific audit considerations
- Risk-based audit methodology

Always provide specific, actionable procedures with proper ISA references. Consider the materiality and risk levels when determining the nature, timing, and extent of procedures.

Respond with valid JSON only.` 
        },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      max_tokens: 3000,
    });

    const content = response.choices[0]?.message?.content || "{}";
    const result = JSON.parse(content);

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Error generating AI procedures:", error);
    res.status(500).json({ success: false, error: "Failed to generate AI procedures" });
  }
});

// Helper function to get industry-specific context
function getIndustryContext(industryType: string): string {
  const industryContexts: Record<string, string> = {
    "Manufacturing": `
Industry-Specific Considerations (Manufacturing):
- Inventory valuation methods (FIFO, weighted average)
- Work-in-progress accounting
- Standard costing and variances
- Production overhead allocation
- Slow-moving and obsolete inventory provisions
- Physical count procedures
- Cut-off testing for goods in transit`,
    
    "Banking": `
Industry-Specific Considerations (Banking/Financial Services):
- Loan portfolio and credit risk assessment
- Expected Credit Loss (ECL) provisioning under IFRS 9
- Investment securities valuation
- Regulatory capital adequacy
- SBP Prudential Regulations compliance
- Anti-money laundering controls
- Interest income recognition
- Off-balance sheet exposures`,
    
    "Retail": `
Industry-Specific Considerations (Retail):
- Point of sale controls
- Inventory shrinkage and markdown provisions
- Loyalty program liabilities
- Gift card breakage income
- Seasonal inventory considerations
- Returns and allowances
- Same-store sales analysis`,
    
    "Technology": `
Industry-Specific Considerations (Technology/Software):
- Revenue recognition for software (SaaS, licenses, services)
- Development cost capitalization vs expense
- Deferred revenue and contract liabilities
- Stock-based compensation
- Intangible asset valuation
- Customer acquisition costs`,
    
    "Construction": `
Industry-Specific Considerations (Construction/Real Estate):
- Percentage of completion revenue recognition
- Contract accounting under IFRS 15
- Construction in progress valuation
- Contract variations and claims
- Provision for losses on contracts
- Joint venture accounting`,
    
    "Healthcare": `
Industry-Specific Considerations (Healthcare/Pharmaceutical):
- Drug registration and regulatory compliance
- R&D expenditure treatment
- Inventory expiry provisions
- Clinical trial accruals
- Regulatory pricing considerations`,
    
    "Energy": `
Industry-Specific Considerations (Energy/Oil & Gas):
- Reserves estimation and depletion
- Exploration and evaluation costs (IFRS 6)
- Asset retirement obligations
- Production sharing contracts
- NEPRA/OGRA regulatory compliance`
  };

  return industryContexts[industryType] || `
Industry Considerations (${industryType}):
- Apply standard audit procedures
- Consider industry-specific risks and controls
- Review relevant industry regulations
- Assess business model and key revenue streams`;
}

export default router;
