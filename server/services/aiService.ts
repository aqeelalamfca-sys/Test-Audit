import OpenAI from "openai";

type AIProvider = "openai" | "gemini" | "deepseek";

interface AIProviderConfig {
  provider: AIProvider;
  apiKey: string;
  enabled: boolean;
  baseUrl?: string;
}

interface AIGenerateOptions {
  prompt: string;
  context: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
}

interface AIGenerateResult {
  content: string;
  provider: AIProvider;
  promptTokens?: number;
  completionTokens?: number;
  error?: string;
}

interface AISettings {
  aiEnabled: boolean;
  preferredProvider: string;
  providerPriority: string[];
  openaiApiKey?: string | null;
  openaiEnabled: boolean;
  geminiApiKey?: string | null;
  geminiEnabled: boolean;
  deepseekApiKey?: string | null;
  deepseekEnabled: boolean;
  maxTokensPerResponse: number;
  requestTimeout: number;
}

const DEFAULT_SYSTEM_PROMPT = `You are an expert statutory auditor with deep knowledge of:
- International Standards on Auditing (ISA)
- ICAP (Institute of Chartered Accountants of Pakistan) requirements
- IESBA Code of Ethics
- Companies Act 2017 (Pakistan)
- SECP regulations
- ISQM 1 and ISQM 2

IMPORTANT: Your output is AI-ASSISTED and SUBJECT TO PROFESSIONAL JUDGMENT.
You do NOT replace auditor judgment, decisions, approvals, or conclusions.
Generate factual, professional audit documentation that requires human review.`;

const AI_FIELD_PROMPTS: Record<string, string> = {
  client_background: "Draft a comprehensive client background narrative including history, operations, and market position",
  nature_of_business: "Describe the entity's nature of business, principal activities, and operational structure",
  regulatory_environment: "Outline the regulatory environment and compliance requirements applicable to this entity",
  due_diligence_description: "Document due diligence and KYC procedures performed and findings",
  ethics_explanation: "Explain ethics and independence considerations for this engagement",
  acceptance_rationale: "Draft the rationale for accepting or continuing this audit engagement",
  
  risk_description: "Draft a description of the identified risk including nature, likelihood, and potential impact",
  materiality_rationale: "Draft the rationale for the materiality determination including benchmark selection",
  audit_strategy: "Draft the overall audit strategy narrative including approach and key focus areas",
  sampling_rationale: "Draft the rationale for the sampling approach without specifying sample sizes",
  audit_program_text: "Draft audit program procedures for the specified area",
  analytical_explanation: "Explain the analytical procedures performed and results observed",
  
  procedure_narrative: "Draft a narrative describing the audit procedure performed",
  variance_explanation: "Explain the variance identified and its potential causes",
  analytical_commentary: "Provide analytical commentary on the financial data trends observed",
  misstatement_explanation: "Explain the nature and cause of the identified misstatement",
  adjustment_justification: "Draft justification for the proposed audit adjustment",
  
  going_concern_narrative: "Draft the going concern assessment narrative based on indicators evaluated",
  subsequent_events_summary: "Summarize subsequent events identified and their impact assessment",
  overall_conclusion_wording: "Draft professional wording for the overall audit conclusion",
  management_letter_draft: "Draft management letter points based on findings",
  
  report_language: "Draft professional report language following ISA structure requirements",
  engagement_summary: "Draft an engagement summary narrative for documentation purposes",
  
  eqcr_summary: "Generate an engagement-wide EQCR summary synthesizing key judgments, risks, and significant matters",
};

async function generateWithOpenAI(
  config: AIProviderConfig,
  options: AIGenerateOptions
): Promise<AIGenerateResult> {
  const openai = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl || process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    timeout: options.timeout || 30000,
  });

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: options.systemPrompt || DEFAULT_SYSTEM_PROMPT },
      { role: "user", content: `${options.prompt}\n\nContext:\n${options.context}` },
    ],
    max_tokens: options.maxTokens || 2000,
    temperature: options.temperature || 0.7,
  });

  return {
    content: response.choices[0]?.message?.content || "",
    provider: "openai",
    promptTokens: response.usage?.prompt_tokens,
    completionTokens: response.usage?.completion_tokens,
  };
}

async function generateWithGemini(
  config: AIProviderConfig,
  options: AIGenerateOptions
): Promise<AIGenerateResult> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${config.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: `${options.systemPrompt || DEFAULT_SYSTEM_PROMPT}\n\n${options.prompt}\n\nContext:\n${options.context}` }
            ]
          }
        ],
        generationConfig: {
          maxOutputTokens: options.maxTokens || 2000,
          temperature: options.temperature || 0.7,
        }
      }),
      signal: AbortSignal.timeout(options.timeout || 30000),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  return {
    content,
    provider: "gemini",
  };
}

async function generateWithDeepSeek(
  config: AIProviderConfig,
  options: AIGenerateOptions
): Promise<AIGenerateResult> {
  const openai = new OpenAI({
    apiKey: config.apiKey,
    baseURL: "https://api.deepseek.com",
    timeout: options.timeout || 30000,
  });

  const response = await openai.chat.completions.create({
    model: "deepseek-chat",
    messages: [
      { role: "system", content: options.systemPrompt || DEFAULT_SYSTEM_PROMPT },
      { role: "user", content: `${options.prompt}\n\nContext:\n${options.context}` },
    ],
    max_tokens: options.maxTokens || 2000,
    temperature: options.temperature || 0.7,
  });

  return {
    content: response.choices[0]?.message?.content || "",
    provider: "deepseek",
    promptTokens: response.usage?.prompt_tokens,
    completionTokens: response.usage?.completion_tokens,
  };
}

function getEnabledProviders(settings: AISettings): AIProviderConfig[] {
  const providers: AIProviderConfig[] = [];
  
  const priority = settings.providerPriority || ["openai", "gemini", "deepseek"];
  
  for (const providerName of priority) {
    switch (providerName) {
      case "openai":
        const openaiKey = settings.openaiApiKey || process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
        if (settings.openaiEnabled && openaiKey) {
          providers.push({
            provider: "openai",
            apiKey: openaiKey,
            enabled: true,
            baseUrl: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
          });
        }
        break;
      case "gemini":
        if (settings.geminiEnabled && settings.geminiApiKey) {
          providers.push({
            provider: "gemini",
            apiKey: settings.geminiApiKey,
            enabled: true,
          });
        }
        break;
      case "deepseek":
        if (settings.deepseekEnabled && settings.deepseekApiKey) {
          providers.push({
            provider: "deepseek",
            apiKey: settings.deepseekApiKey,
            enabled: true,
          });
        }
        break;
    }
  }
  
  return providers;
}

export async function generateAIContent(
  settings: AISettings,
  options: AIGenerateOptions
): Promise<AIGenerateResult> {
  if (!settings.aiEnabled) {
    return {
      content: "",
      provider: "openai",
      error: "AI is disabled. Please enable AI in Settings.",
    };
  }

  const providers = getEnabledProviders(settings);
  
  if (providers.length === 0) {
    return {
      content: "",
      provider: "openai",
      error: "No AI providers are configured. Please add an API key in Settings.",
    };
  }

  const errors: string[] = [];
  
  for (const config of providers) {
    try {
      const generateFn = {
        openai: generateWithOpenAI,
        gemini: generateWithGemini,
        deepseek: generateWithDeepSeek,
      }[config.provider];

      const result = await generateFn(config, {
        ...options,
        maxTokens: options.maxTokens || settings.maxTokensPerResponse,
        timeout: options.timeout || settings.requestTimeout,
      });
      
      return result;
    } catch (error: any) {
      const errorMsg = `${config.provider}: ${error.message || "Unknown error"}`;
      errors.push(errorMsg);
      console.error(`AI provider ${config.provider} failed:`, error);
      continue;
    }
  }

  return {
    content: "",
    provider: providers[0]?.provider || "openai",
    error: `All AI providers failed. Errors: ${errors.join("; ")}`,
  };
}

export async function testProviderConnection(
  provider: AIProvider,
  apiKey: string
): Promise<{ success: boolean; message: string; latency?: number }> {
  const startTime = Date.now();
  
  try {
    const testPrompt = "Respond with exactly: 'Connection successful'";
    
    switch (provider) {
      case "openai":
        const openai = new OpenAI({
          apiKey,
          baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
          timeout: 15000,
        });
        await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: testPrompt }],
          max_tokens: 50,
        });
        break;
        
      case "gemini":
        const geminiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: testPrompt }] }],
              generationConfig: { maxOutputTokens: 50 },
            }),
            signal: AbortSignal.timeout(15000),
          }
        );
        if (!geminiResponse.ok) {
          throw new Error(`HTTP ${geminiResponse.status}`);
        }
        break;
        
      case "deepseek":
        const deepseek = new OpenAI({
          apiKey,
          baseURL: "https://api.deepseek.com",
          timeout: 15000,
        });
        await deepseek.chat.completions.create({
          model: "deepseek-chat",
          messages: [{ role: "user", content: testPrompt }],
          max_tokens: 50,
        });
        break;
    }
    
    const latency = Date.now() - startTime;
    return {
      success: true,
      message: `Connection successful (${latency}ms)`,
      latency,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Connection failed",
    };
  }
}

export function getFieldPrompt(fieldKey: string): string {
  return AI_FIELD_PROMPTS[fieldKey] || "Generate professional audit documentation for this field";
}

export function buildContextPrompt(
  fieldKey: string,
  engagement: any,
  existingContent?: string,
  action: "generate" | "rephrase" = "generate"
): string {
  const basePrompt = getFieldPrompt(fieldKey);
  
  if (action === "rephrase" && existingContent) {
    return `Rephrase and improve the following text while maintaining its meaning:

Original text:
${existingContent}

${basePrompt}

Requirements:
- Maintain factual accuracy
- Improve professional tone and structure
- Keep ISA-compliant language
- Target length: 6-12 lines`;
  }
  
  return `${basePrompt}

Requirements:
- Be professional, factual, and consistent with provided data
- Use conditional language when data is incomplete: "Based on available information..."
- Do NOT fabricate specific facts, dates, or figures not provided
- Reference applicable ISA standards where relevant
- Target length: 6-10 lines`;
}

export const PROHIBITED_AI_FIELDS = [
  "riskLevel",
  "riskRating",
  "materialityAmount",
  "performanceMateriality",
  "trivialThreshold",
  "auditOpinion",
  "opinionType",
  "isApproved",
  "approvedBy",
  "signedOff",
  "partnerApproval",
  "managerApproval",
  "testResult",
  "conclusion",
  "evidenceSufficient",
  "sampleSize",
];

export function isAIProhibitedField(fieldKey: string): boolean {
  return PROHIBITED_AI_FIELDS.some(
    (prohibited) => 
      fieldKey.toLowerCase().includes(prohibited.toLowerCase()) ||
      prohibited.toLowerCase().includes(fieldKey.toLowerCase())
  );
}

export { AIProvider, AIGenerateOptions, AIGenerateResult, AISettings };
