import { prisma } from "../db";

interface FieldRegistryEntry {
  fieldCode: string;
  label: string;
  module: string;
  tab?: string;
  dataType: string;
  sourceSheet?: string;
  computeRule?: string;
  isaTag?: string;
  visibilityRoles: string[];
  isEditable: boolean;
  auditTrailOn: boolean;
}

const DEFAULT_FIELD_REGISTRY: FieldRegistryEntry[] = [
  // Trial Balance derived fields
  {
    fieldCode: "TB_TOTAL_ASSETS",
    label: "Total Assets",
    module: "planning",
    tab: "financial-statements",
    dataType: "currency",
    sourceSheet: "TB_UPLOAD",
    computeRule: "SUM(closingBalance WHERE accountClass='ASSET')",
    isaTag: "ISA 315.A72",
    visibilityRoles: ["STAFF", "SENIOR", "MANAGER", "PARTNER", "EQCR", "FIRM_ADMIN"],
    isEditable: false,
    auditTrailOn: true
  },
  {
    fieldCode: "TB_TOTAL_LIABILITIES",
    label: "Total Liabilities",
    module: "planning",
    tab: "financial-statements",
    dataType: "currency",
    sourceSheet: "TB_UPLOAD",
    computeRule: "SUM(closingBalance WHERE accountClass='LIABILITY')",
    isaTag: "ISA 315.A72",
    visibilityRoles: ["STAFF", "SENIOR", "MANAGER", "PARTNER", "EQCR", "FIRM_ADMIN"],
    isEditable: false,
    auditTrailOn: true
  },
  {
    fieldCode: "TB_TOTAL_EQUITY",
    label: "Total Equity",
    module: "planning",
    tab: "financial-statements",
    dataType: "currency",
    sourceSheet: "TB_UPLOAD",
    computeRule: "SUM(closingBalance WHERE accountClass='EQUITY')",
    isaTag: "ISA 315.A72",
    visibilityRoles: ["STAFF", "SENIOR", "MANAGER", "PARTNER", "EQCR", "FIRM_ADMIN"],
    isEditable: false,
    auditTrailOn: true
  },
  {
    fieldCode: "TB_TOTAL_REVENUE",
    label: "Total Revenue",
    module: "planning",
    tab: "financial-statements",
    dataType: "currency",
    sourceSheet: "TB_UPLOAD",
    computeRule: "SUM(closingBalance WHERE accountClass='INCOME')",
    isaTag: "ISA 315.A72",
    visibilityRoles: ["STAFF", "SENIOR", "MANAGER", "PARTNER", "EQCR", "FIRM_ADMIN"],
    isEditable: false,
    auditTrailOn: true
  },
  {
    fieldCode: "TB_NET_INCOME",
    label: "Net Income",
    module: "planning",
    tab: "financial-statements",
    dataType: "currency",
    sourceSheet: "TB_UPLOAD",
    computeRule: "SUM(closingBalance WHERE accountClass='INCOME') - SUM(closingBalance WHERE accountClass='EXPENSE')",
    isaTag: "ISA 315.A72",
    visibilityRoles: ["STAFF", "SENIOR", "MANAGER", "PARTNER", "EQCR", "FIRM_ADMIN"],
    isEditable: false,
    auditTrailOn: true
  },
  {
    fieldCode: "TB_PERIOD_END_DATE",
    label: "Period End Date",
    module: "pre-planning",
    tab: "engagement-info",
    dataType: "date",
    sourceSheet: "TB_UPLOAD",
    computeRule: "MAX(periodEndDate)",
    visibilityRoles: ["STAFF", "SENIOR", "MANAGER", "PARTNER", "EQCR", "FIRM_ADMIN"],
    isEditable: false,
    auditTrailOn: true
  },
  {
    fieldCode: "TB_CURRENCY",
    label: "Reporting Currency",
    module: "pre-planning",
    tab: "engagement-info",
    dataType: "text",
    sourceSheet: "TB_UPLOAD",
    computeRule: "FIRST(currency)",
    visibilityRoles: ["STAFF", "SENIOR", "MANAGER", "PARTNER", "EQCR", "FIRM_ADMIN"],
    isEditable: false,
    auditTrailOn: true
  },
  {
    fieldCode: "TB_ACCOUNT_COUNT",
    label: "Number of Accounts",
    module: "planning",
    tab: "financial-statements",
    dataType: "number",
    sourceSheet: "TB_UPLOAD",
    computeRule: "COUNT(accounts)",
    visibilityRoles: ["STAFF", "SENIOR", "MANAGER", "PARTNER", "EQCR", "FIRM_ADMIN"],
    isEditable: false,
    auditTrailOn: true
  },
  // General Ledger derived fields
  {
    fieldCode: "GL_JOURNAL_COUNT",
    label: "Journal Entry Count",
    module: "execution",
    tab: "journal-testing",
    dataType: "number",
    sourceSheet: "GL_UPLOAD",
    computeRule: "COUNT(DISTINCT voucherNo)",
    isaTag: "ISA 240.33",
    visibilityRoles: ["STAFF", "SENIOR", "MANAGER", "PARTNER", "EQCR", "FIRM_ADMIN"],
    isEditable: false,
    auditTrailOn: true
  },
  {
    fieldCode: "GL_VOUCHER_COUNT",
    label: "Total Voucher Count",
    module: "execution",
    tab: "journal-testing",
    dataType: "number",
    sourceSheet: "GL_UPLOAD",
    computeRule: "COUNT(voucherNo)",
    visibilityRoles: ["STAFF", "SENIOR", "MANAGER", "PARTNER", "EQCR", "FIRM_ADMIN"],
    isEditable: false,
    auditTrailOn: true
  },
  {
    fieldCode: "GL_PERIOD_FROM",
    label: "GL Period Start",
    module: "planning",
    tab: "financial-statements",
    dataType: "date",
    sourceSheet: "GL_UPLOAD",
    computeRule: "MIN(transactionDate)",
    visibilityRoles: ["STAFF", "SENIOR", "MANAGER", "PARTNER", "EQCR", "FIRM_ADMIN"],
    isEditable: false,
    auditTrailOn: true
  },
  {
    fieldCode: "GL_PERIOD_TO",
    label: "GL Period End",
    module: "planning",
    tab: "financial-statements",
    dataType: "date",
    sourceSheet: "GL_UPLOAD",
    computeRule: "MAX(transactionDate)",
    visibilityRoles: ["STAFF", "SENIOR", "MANAGER", "PARTNER", "EQCR", "FIRM_ADMIN"],
    isEditable: false,
    auditTrailOn: true
  },
  // Materiality fields
  {
    fieldCode: "MAT_OVERALL",
    label: "Overall Materiality",
    module: "planning",
    tab: "materiality",
    dataType: "currency",
    sourceSheet: "MATERIALITY",
    computeRule: "FETCH(materialityCalculation.overallMateriality)",
    isaTag: "ISA 320.10",
    visibilityRoles: ["SENIOR", "MANAGER", "PARTNER", "EQCR", "FIRM_ADMIN"],
    isEditable: false,
    auditTrailOn: true
  },
  {
    fieldCode: "MAT_PERFORMANCE",
    label: "Performance Materiality",
    module: "planning",
    tab: "materiality",
    dataType: "currency",
    sourceSheet: "MATERIALITY",
    computeRule: "FETCH(materialityCalculation.performanceMateriality)",
    isaTag: "ISA 320.11",
    visibilityRoles: ["SENIOR", "MANAGER", "PARTNER", "EQCR", "FIRM_ADMIN"],
    isEditable: false,
    auditTrailOn: true
  },
  {
    fieldCode: "MAT_TRIVIAL",
    label: "Trivial Threshold (SUD)",
    module: "planning",
    tab: "materiality",
    dataType: "currency",
    sourceSheet: "MATERIALITY",
    computeRule: "FETCH(materialityCalculation.trivialThreshold)",
    isaTag: "ISA 450.5",
    visibilityRoles: ["SENIOR", "MANAGER", "PARTNER", "EQCR", "FIRM_ADMIN"],
    isEditable: false,
    auditTrailOn: true
  },
  // Risk Assessment fields
  {
    fieldCode: "RISK_HIGH_COUNT",
    label: "High Risk FS Heads Count",
    module: "planning",
    tab: "risk-assessment",
    dataType: "number",
    sourceSheet: "RISK_ASSESSMENT",
    computeRule: "COUNT(WHERE inherentRisk='HIGH')",
    isaTag: "ISA 315.26",
    visibilityRoles: ["SENIOR", "MANAGER", "PARTNER", "EQCR", "FIRM_ADMIN"],
    isEditable: false,
    auditTrailOn: true
  },
  {
    fieldCode: "RISK_MEDIUM_COUNT",
    label: "Medium Risk FS Heads Count",
    module: "planning",
    tab: "risk-assessment",
    dataType: "number",
    sourceSheet: "RISK_ASSESSMENT",
    computeRule: "COUNT(WHERE inherentRisk='MEDIUM')",
    isaTag: "ISA 315.26",
    visibilityRoles: ["SENIOR", "MANAGER", "PARTNER", "EQCR", "FIRM_ADMIN"],
    isEditable: false,
    auditTrailOn: true
  },
  {
    fieldCode: "RISK_LOW_COUNT",
    label: "Low Risk FS Heads Count",
    module: "planning",
    tab: "risk-assessment",
    dataType: "number",
    sourceSheet: "RISK_ASSESSMENT",
    computeRule: "COUNT(WHERE inherentRisk='LOW')",
    isaTag: "ISA 315.26",
    visibilityRoles: ["SENIOR", "MANAGER", "PARTNER", "EQCR", "FIRM_ADMIN"],
    isEditable: false,
    auditTrailOn: true
  }
];

export async function seedFieldRegistry(): Promise<number> {
  let created = 0;
  
  for (const entry of DEFAULT_FIELD_REGISTRY) {
    const existing = await prisma.fieldRegistry.findUnique({
      where: { fieldCode: entry.fieldCode }
    });
    
    if (!existing) {
      await prisma.fieldRegistry.create({
        data: entry
      });
      created++;
    }
  }
  
  return created;
}

export async function getDefaultFieldRegistry(): Promise<FieldRegistryEntry[]> {
  return DEFAULT_FIELD_REGISTRY;
}
