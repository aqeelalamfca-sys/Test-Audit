import { prisma } from "../db";

interface Phase1OutputConfig {
  outputCode: string;
  outputName: string;
  sourceSheets: string[];
  isaTag: string;
  outputFormat: "XLSX" | "DOCX";
  triggerButton?: string;
}

const PHASE1_OUTPUT_CONFIGS: Phase1OutputConfig[] = [
  {
    outputCode: "IRL-BANK-001",
    outputName: "Bank Statements Checklist & Request",
    sourceSheets: ["TB_UPLOAD", "MASTER_BANK_ACCOUNTS"],
    isaTag: "ISA 500",
    outputFormat: "XLSX",
    triggerButton: "Generate Bank Request",
  },
  {
    outputCode: "IRL-INV-001",
    outputName: "Inventory Schedules Checklist & Request",
    sourceSheets: ["TB_UPLOAD"],
    isaTag: "ISA 500",
    outputFormat: "XLSX",
    triggerButton: "Generate Inventory Request",
  },
  {
    outputCode: "IRL-FAR-001",
    outputName: "Fixed Asset Register Checklist & Request",
    sourceSheets: ["TB_UPLOAD"],
    isaTag: "ISA 500",
    outputFormat: "XLSX",
    triggerButton: "Generate FAR Request",
  },
  {
    outputCode: "IRL-REV-001",
    outputName: "Revenue Invoice Sample Request & Checklist",
    sourceSheets: ["TB_UPLOAD", "GL_UPLOAD"],
    isaTag: "ISA 500",
    outputFormat: "XLSX",
    triggerButton: "Generate Revenue Request",
  },
  {
    outputCode: "IRL-PAY-001",
    outputName: "Payroll Records Request & Checklist",
    sourceSheets: ["TB_UPLOAD", "GL_UPLOAD"],
    isaTag: "ISA 500",
    outputFormat: "XLSX",
    triggerButton: "Generate Payroll Request",
  },
  {
    outputCode: "CONF-BANK-001",
    outputName: "Bank Confirmation Letter Pack",
    sourceSheets: ["GL_UPLOAD", "MASTER_BANK_ACCOUNTS"],
    isaTag: "ISA 505",
    outputFormat: "DOCX",
    triggerButton: "Generate Bank Confirmations",
  },
  {
    outputCode: "CONF-LEGAL-001",
    outputName: "Legal Confirmation Checklist & Letter Template",
    sourceSheets: ["TB_UPLOAD"],
    isaTag: "ISA 505",
    outputFormat: "DOCX",
    triggerButton: "Generate Legal Confirmations",
  },
  {
    outputCode: "CONF-AR-001",
    outputName: "AR Circularization Population Extract",
    sourceSheets: ["TB_UPLOAD", "GL_UPLOAD", "AR_AP_OPENITEMS"],
    isaTag: "ISA 505",
    outputFormat: "XLSX",
    triggerButton: "Generate AR Confirmations",
  },
  {
    outputCode: "CONF-AP-001",
    outputName: "AP Circularization Population Extract",
    sourceSheets: ["TB_UPLOAD", "GL_UPLOAD", "AR_AP_OPENITEMS"],
    isaTag: "ISA 505",
    outputFormat: "XLSX",
    triggerButton: "Generate AP Confirmations",
  },
];

export interface GenerationResult {
  success: boolean;
  outputsCreated: number;
  outputsSkipped: number;
  details: Array<{
    outputCode: string;
    outputName: string;
    status: "created" | "skipped" | "error";
    reason?: string;
  }>;
}

export async function generatePhase1Outputs(
  engagementId: string,
  preparedById: string
): Promise<GenerationResult> {
  const result: GenerationResult = {
    success: true,
    outputsCreated: 0,
    outputsSkipped: 0,
    details: [],
  };

  try {
    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId },
    });

    if (!engagement) {
      result.success = false;
      result.details.push({
        outputCode: "N/A",
        outputName: "N/A",
        status: "error",
        reason: "Engagement not found",
      });
      return result;
    }

    const existingOutputs = await prisma.outputsRegistry.findMany({
      where: { engagementId },
      select: { outputCode: true, version: true },
    });

    const existingCodes = new Map<string, number>();
    for (const output of existingOutputs) {
      const currentVersion = existingCodes.get(output.outputCode) || 0;
      if (output.version > currentVersion) {
        existingCodes.set(output.outputCode, output.version);
      }
    }

    for (const config of PHASE1_OUTPUT_CONFIGS) {
      try {
        const existingVersion = existingCodes.get(config.outputCode);
        if (existingVersion !== undefined) {
          result.outputsSkipped++;
          result.details.push({
            outputCode: config.outputCode,
            outputName: config.outputName,
            status: "skipped",
            reason: `Already exists (v${existingVersion})`,
          });
          continue;
        }

        await prisma.outputsRegistry.create({
          data: {
            engagementId,
            outputCode: config.outputCode,
            outputName: config.outputName,
            phase: "REQUISITION" as any,
            triggerButton: config.triggerButton,
            sourceSheets: config.sourceSheets,
            isaTag: config.isaTag,
            outputFormat: config.outputFormat,
            status: "Draft",
            version: 1,
            preparedById,
            preparedAt: new Date(),
          },
        });

        result.outputsCreated++;
        result.details.push({
          outputCode: config.outputCode,
          outputName: config.outputName,
          status: "created",
        });
      } catch (error: any) {
        result.details.push({
          outputCode: config.outputCode,
          outputName: config.outputName,
          status: "error",
          reason: error.message || "Unknown error",
        });
      }
    }

    return result;
  } catch (error: any) {
    console.error("Error generating Phase 1 outputs:", error);
    result.success = false;
    result.details.push({
      outputCode: "N/A",
      outputName: "N/A",
      status: "error",
      reason: error.message || "Unknown error",
    });
    return result;
  }
}

export async function generateBankConfirmationOutputs(
  engagementId: string,
  preparedById: string,
  bankAccounts: Array<{ bankAccountId: string; partyId: string; bankName?: string }>
): Promise<GenerationResult> {
  const result: GenerationResult = {
    success: true,
    outputsCreated: 0,
    outputsSkipped: 0,
    details: [],
  };

  if (bankAccounts.length === 0) {
    return result;
  }

  try {
    const existingOutputs = await prisma.outputsRegistry.findMany({
      where: {
        engagementId,
        outputCode: { startsWith: "CONF-BANK-" },
      },
      select: { outputCode: true },
    });

    const existingCodes = new Set(existingOutputs.map((o: { outputCode: string }) => o.outputCode));

    for (let i = 0; i < bankAccounts.length; i++) {
      const bank = bankAccounts[i];
      const outputCode = `CONF-BANK-${String(i + 1).padStart(3, "0")}`;

      if (existingCodes.has(outputCode)) {
        result.outputsSkipped++;
        result.details.push({
          outputCode,
          outputName: `Bank Confirmation - ${bank.bankName || bank.partyId}`,
          status: "skipped",
          reason: "Already exists",
        });
        continue;
      }

      try {
        await prisma.outputsRegistry.create({
          data: {
            engagementId,
            outputCode,
            outputName: `Bank Confirmation - ${bank.bankName || bank.partyId}`,
            phase: "REQUISITION" as any,
            triggerButton: "Generate Bank Confirmation",
            sourceSheets: ["MASTER_BANK_ACCOUNTS", "GL_UPLOAD"],
            isaTag: "ISA 505",
            outputFormat: "DOCX",
            status: "Draft",
            version: 1,
            preparedById,
            preparedAt: new Date(),
          },
        });

        result.outputsCreated++;
        result.details.push({
          outputCode,
          outputName: `Bank Confirmation - ${bank.bankName || bank.partyId}`,
          status: "created",
        });
      } catch (error: any) {
        result.details.push({
          outputCode,
          outputName: `Bank Confirmation - ${bank.bankName || bank.partyId}`,
          status: "error",
          reason: error.message || "Unknown error",
        });
      }
    }

    return result;
  } catch (error: any) {
    console.error("Error generating bank confirmation outputs:", error);
    result.success = false;
    return result;
  }
}

export function getPhase1OutputConfigs(): Phase1OutputConfig[] {
  return [...PHASE1_OUTPUT_CONFIGS];
}

// Phase 2 outputs (Pre-Planning)
interface Phase2OutputConfig {
  outputCode: string;
  outputName: string;
  isaTag: string;
  outputFormat: "XLSX" | "DOCX";
  sourceSheets?: string[];
}

const PHASE2_OUTPUT_CONFIGS: Phase2OutputConfig[] = [
  {
    outputCode: "PP-ACC-001",
    outputName: "Engagement Acceptance/Continuance Pack",
    isaTag: "ISA 220",
    outputFormat: "DOCX",
    sourceSheets: ["CLIENT_INFO", "ACCEPTANCE_CHECKLIST"],
  },
  {
    outputCode: "PP-ENG-001",
    outputName: "Draft Engagement Letter",
    isaTag: "ISA 210",
    outputFormat: "DOCX",
    sourceSheets: ["CLIENT_INFO", "ENGAGEMENT_TERMS"],
  },
  {
    outputCode: "PP-MEMO-001",
    outputName: "Planning Memo Shell",
    isaTag: "ISA 300",
    outputFormat: "DOCX",
    sourceSheets: ["CLIENT_INFO", "RISK_ASSESSMENT"],
  },
  {
    outputCode: "PP-ENT-001",
    outputName: "Entity Profile Sheet",
    isaTag: "ISA 315",
    outputFormat: "XLSX",
    sourceSheets: ["CLIENT_INFO", "TB_UPLOAD"],
  },
  {
    outputCode: "PP-ANA-001",
    outputName: "Initial Analytical Snapshot",
    isaTag: "ISA 520",
    outputFormat: "XLSX",
    sourceSheets: ["TB_UPLOAD", "GL_UPLOAD"],
  },
];

export async function generatePhase2Outputs(
  engagementId: string,
  preparedById: string
): Promise<GenerationResult> {
  const result: GenerationResult = {
    success: true,
    outputsCreated: 0,
    outputsSkipped: 0,
    details: [],
  };

  try {
    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId },
    });

    if (!engagement) {
      result.success = false;
      result.details.push({
        outputCode: "N/A",
        outputName: "N/A",
        status: "error",
        reason: "Engagement not found",
      });
      return result;
    }

    const existingOutputs = await prisma.outputsRegistry.findMany({
      where: { engagementId },
      select: { outputCode: true, version: true },
    });

    const existingCodes = new Map<string, number>();
    for (const output of existingOutputs) {
      const currentVersion = existingCodes.get(output.outputCode) || 0;
      if (output.version > currentVersion) {
        existingCodes.set(output.outputCode, output.version);
      }
    }

    for (const config of PHASE2_OUTPUT_CONFIGS) {
      try {
        const existingVersion = existingCodes.get(config.outputCode);
        if (existingVersion !== undefined) {
          result.outputsSkipped++;
          result.details.push({
            outputCode: config.outputCode,
            outputName: config.outputName,
            status: "skipped",
            reason: `Already exists (v${existingVersion})`,
          });
          continue;
        }

        await prisma.outputsRegistry.create({
          data: {
            engagementId,
            outputCode: config.outputCode,
            outputName: config.outputName,
            phase: "PRE_PLANNING" as any,
            sourceSheets: config.sourceSheets || [],
            isaTag: config.isaTag,
            outputFormat: config.outputFormat,
            status: "Draft",
            version: 1,
            preparedById,
            preparedAt: new Date(),
          },
        });

        result.outputsCreated++;
        result.details.push({
          outputCode: config.outputCode,
          outputName: config.outputName,
          status: "created",
        });
      } catch (error: any) {
        result.details.push({
          outputCode: config.outputCode,
          outputName: config.outputName,
          status: "error",
          reason: error.message || "Unknown error",
        });
      }
    }

    return result;
  } catch (error: any) {
    console.error("Error generating Phase 2 outputs:", error);
    result.success = false;
    result.details.push({
      outputCode: "N/A",
      outputName: "N/A",
      status: "error",
      reason: error.message || "Unknown error",
    });
    return result;
  }
}

export function getPhase2OutputConfigs(): Phase2OutputConfig[] {
  return [...PHASE2_OUTPUT_CONFIGS];
}

// Phase 3 outputs (Planning)
interface Phase3OutputConfig {
  outputCode: string;
  outputName: string;
  tabId: string;
  isaTag: string;
  outputFormat: "XLSX" | "DOCX";
  sourceSheets?: string[];
  triggerButton?: string;
}

const PHASE3_OUTPUT_CONFIGS: Phase3OutputConfig[] = [
  // Tab 1: Financial Statements (tabId: "fs")
  {
    outputCode: "FSP-MAP-001",
    outputName: "Account Mapping Report",
    tabId: "fs",
    isaTag: "ISA 500",
    outputFormat: "XLSX",
    sourceSheets: ["TB_UPLOAD", "GL_UPLOAD", "COA_MAPPING"],
    triggerButton: "Generate Mapping Report",
  },
  {
    outputCode: "FSP-TOT-001",
    outputName: "Draft FS Totals Summary",
    tabId: "fs",
    isaTag: "ISA 500",
    outputFormat: "XLSX",
    sourceSheets: ["TB_UPLOAD", "FS_HEADS"],
    triggerButton: "Generate Totals Summary",
  },
  {
    outputCode: "FSP-LEAD-001",
    outputName: "FS Head Lead Schedules",
    tabId: "fs",
    isaTag: "ISA 500",
    outputFormat: "XLSX",
    sourceSheets: ["TB_UPLOAD", "FS_HEADS", "GL_UPLOAD"],
    triggerButton: "Generate Lead Schedules",
  },
  // Tab 2: Risk Assessment (tabId: "risk")
  {
    outputCode: "PL-RISK-001",
    outputName: "Risk Register",
    tabId: "risk",
    isaTag: "ISA 315",
    outputFormat: "XLSX",
    sourceSheets: ["RISK_ASSESSMENT", "FS_LEVEL_RISKS"],
    triggerButton: "Generate Risk Register",
  },
  {
    outputCode: "PL-FRAUD-001",
    outputName: "Fraud Risk Memo",
    tabId: "risk",
    isaTag: "ISA 240",
    outputFormat: "DOCX",
    sourceSheets: ["FRAUD_RISK", "RISK_ASSESSMENT"],
    triggerButton: "Generate Fraud Risk Memo",
  },
  // Tab 3: Preliminary Analytics (tabId: "analytics")
  {
    outputCode: "PL-ANA-001",
    outputName: "Analytics Report",
    tabId: "analytics",
    isaTag: "ISA 520",
    outputFormat: "XLSX",
    sourceSheets: ["TB_UPLOAD", "GL_UPLOAD", "ANALYTICAL_DATA"],
    triggerButton: "Generate Analytics Report",
  },
  // Tab 4: Materiality (tabId: "materiality")
  {
    outputCode: "PL-MAT-001",
    outputName: "Materiality Memo",
    tabId: "materiality",
    isaTag: "ISA 320",
    outputFormat: "DOCX",
    sourceSheets: ["MATERIALITY_CALC", "TB_UPLOAD"],
    triggerButton: "Generate Materiality Memo",
  },
  // Tab 5: Strategy & Approach (tabId: "strategy")
  {
    outputCode: "PL-STRAT-001",
    outputName: "Audit Strategy Memo",
    tabId: "strategy",
    isaTag: "ISA 300",
    outputFormat: "DOCX",
    sourceSheets: ["AUDIT_STRATEGY", "RISK_ASSESSMENT"],
    triggerButton: "Generate Strategy Memo",
  },
  {
    outputCode: "PL-CTRL-001",
    outputName: "Controls Reliance Decision Log",
    tabId: "strategy",
    isaTag: "ISA 330",
    outputFormat: "XLSX",
    sourceSheets: ["CONTROLS_ASSESSMENT", "WALKTHROUGHS"],
    triggerButton: "Generate Controls Log",
  },
  // Tab 6: Sampling (tabId: "sampling")
  {
    outputCode: "PL-SAMP-001",
    outputName: "Sampling Plan",
    tabId: "sampling",
    isaTag: "ISA 530",
    outputFormat: "XLSX",
    sourceSheets: ["SAMPLING_PARAMS", "TB_UPLOAD"],
    triggerButton: "Generate Sampling Plan",
  },
  {
    outputCode: "PL-SEL-001",
    outputName: "Sample Selection Output",
    tabId: "sampling",
    isaTag: "ISA 530",
    outputFormat: "XLSX",
    sourceSheets: ["GL_UPLOAD", "SAMPLING_PARAMS"],
    triggerButton: "Generate Selection Output",
  },
  // Tab 7: Audit Program (tabId: "program")
  {
    outputCode: "PL-PROG-001",
    outputName: "Audit Program",
    tabId: "program",
    isaTag: "ISA 300",
    outputFormat: "XLSX",
    sourceSheets: ["AUDIT_PROGRAM", "FS_HEADS", "RISK_ASSESSMENT"],
    triggerButton: "Generate Audit Program",
  },
  {
    outputCode: "PL-JE-001",
    outputName: "JE Testing Plan",
    tabId: "program",
    isaTag: "ISA 240",
    outputFormat: "XLSX",
    sourceSheets: ["GL_UPLOAD", "JE_TESTING"],
    triggerButton: "Generate JE Testing Plan",
  },
  // Tab 8: QC Checklist (tabId: "qc")
  {
    outputCode: "PL-QC-001",
    outputName: "QC/EQCR Trigger Memo",
    tabId: "qc",
    isaTag: "ISA 220",
    outputFormat: "DOCX",
    sourceSheets: ["QC_CHECKLIST", "EQCR_ASSESSMENT"],
    triggerButton: "Generate QC Memo",
  },
];

export async function generatePhase3Outputs(
  engagementId: string,
  tabId: string | null,
  preparedById: string
): Promise<GenerationResult> {
  const result: GenerationResult = {
    success: true,
    outputsCreated: 0,
    outputsSkipped: 0,
    details: [],
  };

  try {
    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId },
    });

    if (!engagement) {
      result.success = false;
      result.details.push({
        outputCode: "N/A",
        outputName: "N/A",
        status: "error",
        reason: "Engagement not found",
      });
      return result;
    }

    const existingOutputs = await prisma.outputsRegistry.findMany({
      where: { engagementId },
      select: { outputCode: true, version: true },
    });

    const existingCodes = new Map<string, number>();
    for (const output of existingOutputs) {
      const currentVersion = existingCodes.get(output.outputCode) || 0;
      if (output.version > currentVersion) {
        existingCodes.set(output.outputCode, output.version);
      }
    }

    // Filter by tabId if provided
    const configsToGenerate = tabId
      ? PHASE3_OUTPUT_CONFIGS.filter(c => c.tabId === tabId)
      : PHASE3_OUTPUT_CONFIGS;

    for (const config of configsToGenerate) {
      try {
        const existingVersion = existingCodes.get(config.outputCode);
        if (existingVersion !== undefined) {
          result.outputsSkipped++;
          result.details.push({
            outputCode: config.outputCode,
            outputName: config.outputName,
            status: "skipped",
            reason: `Already exists (v${existingVersion})`,
          });
          continue;
        }

        await prisma.outputsRegistry.create({
          data: {
            engagementId,
            outputCode: config.outputCode,
            outputName: config.outputName,
            phase: "PLANNING" as any,
            triggerButton: config.triggerButton,
            sourceSheets: config.sourceSheets || [],
            isaTag: config.isaTag,
            outputFormat: config.outputFormat,
            status: "Draft",
            version: 1,
            preparedById,
            preparedAt: new Date(),
          },
        });

        result.outputsCreated++;
        result.details.push({
          outputCode: config.outputCode,
          outputName: config.outputName,
          status: "created",
        });
      } catch (error: any) {
        result.details.push({
          outputCode: config.outputCode,
          outputName: config.outputName,
          status: "error",
          reason: error.message || "Unknown error",
        });
      }
    }

    return result;
  } catch (error: any) {
    console.error("Error generating Phase 3 outputs:", error);
    result.success = false;
    result.details.push({
      outputCode: "N/A",
      outputName: "N/A",
      status: "error",
      reason: error.message || "Unknown error",
    });
    return result;
  }
}

export function getPhase3OutputConfigs(): Phase3OutputConfig[] {
  return [...PHASE3_OUTPUT_CONFIGS];
}

export function getPhase3OutputsByTab(tabId: string): Phase3OutputConfig[] {
  return PHASE3_OUTPUT_CONFIGS.filter(c => c.tabId === tabId);
}

// Phase 4 outputs (Execution)
interface Phase4OutputConfig {
  outputCode: string;
  outputName: string;
  tab: string;
  isaTag: string;
  outputFormat: "XLSX" | "DOCX";
  phase: string;
  sourceSheets?: string[];
}

const PHASE4_OUTPUT_CONFIGS: Phase4OutputConfig[] = [
  // FS Head Working Paper Pack - one per FS Head
  { outputCode: "EX-WP-CASH", outputName: "Cash & Bank Working Papers Pack", tab: "cash", isaTag: "ISA 500", outputFormat: "XLSX", phase: "EXECUTION", sourceSheets: ["TB_UPLOAD", "GL_UPLOAD", "BANK_RECS"] },
  { outputCode: "EX-WP-AR", outputName: "Accounts Receivable Working Papers Pack", tab: "receivables", isaTag: "ISA 500", outputFormat: "XLSX", phase: "EXECUTION", sourceSheets: ["TB_UPLOAD", "GL_UPLOAD", "AR_AGING"] },
  { outputCode: "EX-WP-INV", outputName: "Inventory Working Papers Pack", tab: "inventory", isaTag: "ISA 500", outputFormat: "XLSX", phase: "EXECUTION", sourceSheets: ["TB_UPLOAD", "GL_UPLOAD", "INV_COUNT"] },
  { outputCode: "EX-WP-PPE", outputName: "Property, Plant & Equipment Working Papers Pack", tab: "ppe", isaTag: "ISA 500", outputFormat: "XLSX", phase: "EXECUTION", sourceSheets: ["TB_UPLOAD", "GL_UPLOAD", "FAR"] },
  { outputCode: "EX-WP-AP", outputName: "Accounts Payable Working Papers Pack", tab: "payables", isaTag: "ISA 500", outputFormat: "XLSX", phase: "EXECUTION", sourceSheets: ["TB_UPLOAD", "GL_UPLOAD", "AP_AGING"] },
  { outputCode: "EX-WP-REV", outputName: "Revenue Working Papers Pack", tab: "revenue", isaTag: "ISA 500", outputFormat: "XLSX", phase: "EXECUTION", sourceSheets: ["TB_UPLOAD", "GL_UPLOAD", "SALES_ANALYSIS"] },
  { outputCode: "EX-WP-EXP", outputName: "Expenses Working Papers Pack", tab: "expenses", isaTag: "ISA 500", outputFormat: "XLSX", phase: "EXECUTION", sourceSheets: ["TB_UPLOAD", "GL_UPLOAD", "EXPENSE_ANALYSIS"] },
  // Exception Tracker
  { outputCode: "EX-EXC-001", outputName: "Exceptions & Findings Register", tab: "all", isaTag: "ISA 450", outputFormat: "XLSX", phase: "EXECUTION", sourceSheets: ["EXCEPTIONS", "FINDINGS"] },
  // Journal Entry Testing
  { outputCode: "EX-JET-001", outputName: "Journal Entry Testing Workbook", tab: "jet", isaTag: "ISA 240", outputFormat: "XLSX", phase: "EXECUTION", sourceSheets: ["GL_UPLOAD", "JE_TESTING"] },
  // Confirmation Tracker
  { outputCode: "EX-CONF-001", outputName: "Confirmation Status Tracker", tab: "confirmations", isaTag: "ISA 505", outputFormat: "XLSX", phase: "EXECUTION", sourceSheets: ["CONFIRMATIONS", "AR_AP_OPENITEMS"] },
];

export interface OutputGenerationResult {
  success: boolean;
  outputsCreated: number;
  outputsSkipped: number;
  details: Array<{
    outputCode: string;
    outputName: string;
    status: "created" | "skipped" | "error";
    reason?: string;
  }>;
}

export async function generatePhase4Outputs(
  engagementId: string,
  fsHeadTab?: string,
  preparedById?: string
): Promise<OutputGenerationResult> {
  const result: OutputGenerationResult = {
    success: true,
    outputsCreated: 0,
    outputsSkipped: 0,
    details: [],
  };

  try {
    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId },
    });

    if (!engagement) {
      result.success = false;
      result.details.push({
        outputCode: "N/A",
        outputName: "N/A",
        status: "error",
        reason: "Engagement not found",
      });
      return result;
    }

    const existingOutputs = await prisma.outputsRegistry.findMany({
      where: { engagementId },
      select: { outputCode: true, version: true },
    });

    const existingCodes = new Map<string, number>();
    for (const output of existingOutputs) {
      const currentVersion = existingCodes.get(output.outputCode) || 0;
      if (output.version > currentVersion) {
        existingCodes.set(output.outputCode, output.version);
      }
    }

    // Filter by fsHeadTab if provided
    const configsToGenerate = fsHeadTab
      ? PHASE4_OUTPUT_CONFIGS.filter(c => c.tab === fsHeadTab || c.tab === "all")
      : PHASE4_OUTPUT_CONFIGS;

    for (const config of configsToGenerate) {
      try {
        const existingVersion = existingCodes.get(config.outputCode);
        if (existingVersion !== undefined) {
          result.outputsSkipped++;
          result.details.push({
            outputCode: config.outputCode,
            outputName: config.outputName,
            status: "skipped",
            reason: `Already exists (v${existingVersion})`,
          });
          continue;
        }

        await prisma.outputsRegistry.create({
          data: {
            engagementId,
            outputCode: config.outputCode,
            outputName: config.outputName,
            phase: "EXECUTION" as any,
            triggerButton: "Generate WP Pack",
            sourceSheets: config.sourceSheets || [],
            isaTag: config.isaTag,
            outputFormat: config.outputFormat,
            status: "Draft",
            version: 1,
            preparedById: preparedById || undefined,
            preparedAt: new Date(),
          },
        });

        result.outputsCreated++;
        result.details.push({
          outputCode: config.outputCode,
          outputName: config.outputName,
          status: "created",
        });
      } catch (error: any) {
        result.details.push({
          outputCode: config.outputCode,
          outputName: config.outputName,
          status: "error",
          reason: error.message || "Unknown error",
        });
      }
    }

    return result;
  } catch (error: any) {
    console.error("Error generating Phase 4 outputs:", error);
    result.success = false;
    result.details.push({
      outputCode: "N/A",
      outputName: "N/A",
      status: "error",
      reason: error.message || "Unknown error",
    });
    return result;
  }
}

export function getPhase4OutputConfigs(): Phase4OutputConfig[] {
  return [...PHASE4_OUTPUT_CONFIGS];
}

export function getPhase4OutputsByTab(tab: string): Phase4OutputConfig[] {
  return PHASE4_OUTPUT_CONFIGS.filter(c => c.tab === tab || c.tab === "all");
}

// Phase 5 outputs (Finalization)
interface Phase5OutputConfig {
  outputCode: string;
  outputName: string;
  isaTag: string;
  outputFormat: "XLSX" | "DOCX";
  phase: string;
  sourceSheets?: string[];
}

const PHASE5_OUTPUT_CONFIGS: Phase5OutputConfig[] = [
  // Completion Documents
  { outputCode: "FIN-COMP-001", outputName: "Audit Completion Checklist", isaTag: "ISA 220", outputFormat: "XLSX", phase: "FINALIZATION", sourceSheets: ["CHECKLIST", "SIGNOFFS"] },
  { outputCode: "FIN-MEMO-001", outputName: "Audit Completion Memo", isaTag: "ISA 230", outputFormat: "DOCX", phase: "FINALIZATION", sourceSheets: ["AUDIT_SUMMARY", "KEY_FINDINGS"] },
  { outputCode: "FIN-ADJ-001", outputName: "Summary of Audit Adjustments", isaTag: "ISA 450", outputFormat: "XLSX", phase: "FINALIZATION", sourceSheets: ["AJE_REGISTER", "TB_UPLOAD"] },
  { outputCode: "FIN-RL-001", outputName: "Management Representation Letter", isaTag: "ISA 580", outputFormat: "DOCX", phase: "FINALIZATION", sourceSheets: ["CLIENT_INFO", "REPRESENTATIONS"] },
  { outputCode: "FIN-FS-001", outputName: "Final Audited Financial Statements", isaTag: "ISA 700", outputFormat: "XLSX", phase: "FINALIZATION", sourceSheets: ["TB_UPLOAD", "FS_HEADS", "AJE_REGISTER"] },
  { outputCode: "FIN-RPT-001", outputName: "Audit Report Draft", isaTag: "ISA 700", outputFormat: "DOCX", phase: "FINALIZATION", sourceSheets: ["AUDIT_OPINION", "FS_HEADS"] },
  { outputCode: "FIN-GOV-001", outputName: "Governance Letter / Management Letter", isaTag: "ISA 260", outputFormat: "DOCX", phase: "FINALIZATION", sourceSheets: ["CONTROL_DEFICIENCIES", "FINDINGS"] },
  // Sign-off Documents
  { outputCode: "FIN-SIGN-001", outputName: "Partner Sign-Off Sheet", isaTag: "ISA 220", outputFormat: "DOCX", phase: "FINALIZATION", sourceSheets: ["APPROVALS", "SIGNOFFS"] },
  { outputCode: "FIN-ARC-001", outputName: "Audit File Archive Checklist", isaTag: "ISA 230", outputFormat: "XLSX", phase: "FINALIZATION", sourceSheets: ["FILE_INDEX", "ARCHIVE_CHECKLIST"] },
];

export async function generatePhase5Outputs(
  engagementId: string,
  preparedById?: string
): Promise<OutputGenerationResult> {
  const result: OutputGenerationResult = {
    success: true,
    outputsCreated: 0,
    outputsSkipped: 0,
    details: [],
  };

  try {
    const engagement = await prisma.engagement.findUnique({
      where: { id: engagementId },
    });

    if (!engagement) {
      result.success = false;
      result.details.push({
        outputCode: "N/A",
        outputName: "N/A",
        status: "error",
        reason: "Engagement not found",
      });
      return result;
    }

    const existingOutputs = await prisma.outputsRegistry.findMany({
      where: { engagementId },
      select: { outputCode: true, version: true },
    });

    const existingCodes = new Map<string, number>();
    for (const output of existingOutputs) {
      const currentVersion = existingCodes.get(output.outputCode) || 0;
      if (output.version > currentVersion) {
        existingCodes.set(output.outputCode, output.version);
      }
    }

    for (const config of PHASE5_OUTPUT_CONFIGS) {
      try {
        const existingVersion = existingCodes.get(config.outputCode);
        if (existingVersion !== undefined) {
          result.outputsSkipped++;
          result.details.push({
            outputCode: config.outputCode,
            outputName: config.outputName,
            status: "skipped",
            reason: `Already exists (v${existingVersion})`,
          });
          continue;
        }

        await prisma.outputsRegistry.create({
          data: {
            engagementId,
            outputCode: config.outputCode,
            outputName: config.outputName,
            phase: "FINALIZATION" as any,
            triggerButton: "Generate Document",
            sourceSheets: config.sourceSheets || [],
            isaTag: config.isaTag,
            outputFormat: config.outputFormat,
            status: "Draft",
            version: 1,
            preparedById: preparedById || undefined,
            preparedAt: new Date(),
          },
        });

        result.outputsCreated++;
        result.details.push({
          outputCode: config.outputCode,
          outputName: config.outputName,
          status: "created",
        });
      } catch (error: any) {
        result.details.push({
          outputCode: config.outputCode,
          outputName: config.outputName,
          status: "error",
          reason: error.message || "Unknown error",
        });
      }
    }

    return result;
  } catch (error: any) {
    console.error("Error generating Phase 5 outputs:", error);
    result.success = false;
    result.details.push({
      outputCode: "N/A",
      outputName: "N/A",
      status: "error",
      reason: error.message || "Unknown error",
    });
    return result;
  }
}

export function getPhase5OutputConfigs(): Phase5OutputConfig[] {
  return [...PHASE5_OUTPUT_CONFIGS];
}
