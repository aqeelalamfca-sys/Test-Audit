import { prisma } from "../db";

export interface FetchRuleSeed {
  ruleName: string;
  description: string;
  sourceType: "SQL" | "SERVICE" | "COMPUTED";
  sourceRef: string;
  refreshPolicy: "ON_IMPORT" | "ON_OPEN" | "MANUAL" | "SCHEDULED";
  selectJson?: unknown;
  filterJson?: unknown;
  drilldownJson?: unknown;
}

export const fetchRuleSeeds: FetchRuleSeed[] = [
  {
    ruleName: "tb.totalAssets",
    description: "Fetches total assets from approved Trial Balance",
    sourceType: "SERVICE",
    sourceRef: "computeTBField:total_assets",
    refreshPolicy: "ON_IMPORT",
    filterJson: { accountTypes: ["asset"] },
    drilldownJson: { showAccounts: true, groupBy: "accountType" },
  },
  {
    ruleName: "tb.totalLiabilities",
    description: "Fetches total liabilities from approved Trial Balance",
    sourceType: "SERVICE",
    sourceRef: "computeTBField:total_liabilities",
    refreshPolicy: "ON_IMPORT",
    filterJson: { accountTypes: ["liability"] },
    drilldownJson: { showAccounts: true, groupBy: "accountType" },
  },
  {
    ruleName: "tb.totalEquity",
    description: "Fetches total equity from approved Trial Balance",
    sourceType: "SERVICE",
    sourceRef: "computeTBField:total_equity",
    refreshPolicy: "ON_IMPORT",
    filterJson: { accountTypes: ["equity"] },
    drilldownJson: { showAccounts: true, groupBy: "accountType" },
  },
  {
    ruleName: "tb.totalRevenue",
    description: "Fetches total revenue from approved Trial Balance",
    sourceType: "SERVICE",
    sourceRef: "computeTBField:total_revenue",
    refreshPolicy: "ON_IMPORT",
    filterJson: { accountTypes: ["revenue", "income"] },
    drilldownJson: { showAccounts: true, groupBy: "accountType" },
  },
  {
    ruleName: "tb.totalExpenses",
    description: "Fetches total expenses from approved Trial Balance",
    sourceType: "SERVICE",
    sourceRef: "computeTBField:total_expenses",
    refreshPolicy: "ON_IMPORT",
    filterJson: { accountTypes: ["expense"] },
    drilldownJson: { showAccounts: true, groupBy: "accountType" },
  },
  {
    ruleName: "tb.netIncome",
    description: "Computes net income (revenue - expenses) from Trial Balance",
    sourceType: "COMPUTED",
    sourceRef: "computeTBField:net_income",
    refreshPolicy: "ON_IMPORT",
  },
  {
    ruleName: "tb.entryCount",
    description: "Counts total entries in Trial Balance",
    sourceType: "SERVICE",
    sourceRef: "computeTBField:tb_entry_count",
    refreshPolicy: "ON_IMPORT",
  },
  {
    ruleName: "gl.transactionCount",
    description: "Counts total transactions in General Ledger",
    sourceType: "SERVICE",
    sourceRef: "computeGLField:gl_transaction_count",
    refreshPolicy: "ON_IMPORT",
  },
  {
    ruleName: "gl.journalCount",
    description: "Counts unique journal entries in General Ledger",
    sourceType: "SERVICE",
    sourceRef: "computeGLField:gl_journal_count",
    refreshPolicy: "ON_IMPORT",
  },
  {
    ruleName: "fshead.openingBalance",
    description: "Fetches opening balance for FS Head",
    sourceType: "SERVICE",
    sourceRef: "computeFSHeadField:opening_balance",
    refreshPolicy: "ON_OPEN",
  },
  {
    ruleName: "fshead.closingBalance",
    description: "Fetches closing balance for FS Head",
    sourceType: "SERVICE",
    sourceRef: "computeFSHeadField:closing_balance",
    refreshPolicy: "ON_OPEN",
  },
  {
    ruleName: "fshead.movementNet",
    description: "Computes net movement for FS Head",
    sourceType: "COMPUTED",
    sourceRef: "computeFSHeadField:movement_net",
    refreshPolicy: "ON_OPEN",
  },
  {
    ruleName: "materiality.overallMateriality",
    description: "Fetches overall materiality setting",
    sourceType: "SERVICE",
    sourceRef: "computeMaterialityField:overall_materiality",
    refreshPolicy: "MANUAL",
  },
  {
    ruleName: "materiality.performanceMateriality",
    description: "Fetches performance materiality setting",
    sourceType: "SERVICE",
    sourceRef: "computeMaterialityField:performance_materiality",
    refreshPolicy: "MANUAL",
  },
  {
    ruleName: "materiality.trivialThreshold",
    description: "Fetches trivial threshold setting",
    sourceType: "SERVICE",
    sourceRef: "computeMaterialityField:trivial_threshold",
    refreshPolicy: "MANUAL",
  },
  {
    ruleName: "risk.inherentRisk",
    description: "Fetches inherent risk assessment for scope",
    sourceType: "SERVICE",
    sourceRef: "computeRiskField:inherent_risk",
    refreshPolicy: "ON_OPEN",
  },
  {
    ruleName: "risk.controlRisk",
    description: "Fetches control risk assessment for scope",
    sourceType: "SERVICE",
    sourceRef: "computeRiskField:control_risk",
    refreshPolicy: "ON_OPEN",
  },
  {
    ruleName: "risk.combinedRisk",
    description: "Computes combined risk from inherent and control risk",
    sourceType: "COMPUTED",
    sourceRef: "computeRiskField:combined_risk",
    refreshPolicy: "ON_OPEN",
  },
  {
    ruleName: "sampling.sampleSize",
    description: "Computes sample size based on materiality and risk",
    sourceType: "COMPUTED",
    sourceRef: "computeSamplingField:sample_size",
    refreshPolicy: "MANUAL",
  },
  {
    ruleName: "confirmation.responseRate",
    description: "Computes response rate for confirmations",
    sourceType: "COMPUTED",
    sourceRef: "computeConfirmationField:response_rate",
    refreshPolicy: "ON_OPEN",
  },
  {
    ruleName: "engagement.clientName",
    description: "Fetches client name from engagement",
    sourceType: "SERVICE",
    sourceRef: "computeEngagementField:client_name",
    refreshPolicy: "ON_OPEN",
  },
  {
    ruleName: "engagement.fiscalYearEnd",
    description: "Fetches fiscal year end date from engagement",
    sourceType: "SERVICE",
    sourceRef: "computeEngagementField:fiscal_year_end",
    refreshPolicy: "ON_OPEN",
  },
  {
    ruleName: "engagement.auditPartner",
    description: "Fetches audit partner name from engagement",
    sourceType: "SERVICE",
    sourceRef: "computeEngagementField:audit_partner",
    refreshPolicy: "ON_OPEN",
  },
];

export async function seedFetchRules(): Promise<number> {
  let created = 0;

  for (const rule of fetchRuleSeeds) {
    const existing = await prisma.fetchRule.findUnique({
      where: { ruleName: rule.ruleName },
    });

    if (!existing) {
      await prisma.fetchRule.create({
        data: {
          ruleName: rule.ruleName,
          description: rule.description,
          sourceType: rule.sourceType,
          sourceRef: rule.sourceRef,
          refreshPolicy: rule.refreshPolicy,
          selectJson: rule.selectJson ?? null,
          filterJson: rule.filterJson ?? null,
          drilldownJson: rule.drilldownJson ?? null,
        },
      });
      created++;
    }
  }

  return created;
}
