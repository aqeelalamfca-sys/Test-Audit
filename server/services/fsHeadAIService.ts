import { prisma } from "../db";
import { generateAIContent } from "./aiService";

const db = prisma as any;

export interface GeneratedProcedure {
  procedureRef: string;
  description: string;
  type: "TOC" | "TOD" | "ANALYTICS";
  isaReference: string;
  assertions: string[];
  estimatedTime: string;
  riskLevel: string;
}

export interface GeneratedControl {
  tocRef: string;
  controlDescription: string;
  controlOwner: string;
  controlFrequency: string;
  controlType: string;
  testSteps: string;
  sampleSize: number;
  assertions: string[];
}

export interface GeneratedTOD {
  todRef: string;
  procedureDescription: string;
  assertions: string[];
  populationDescription: string;
  samplingMethod: string;
  sampleSize: number;
  testSteps: string;
}

export interface GeneratedAnalytical {
  procedureRef: string;
  analyticalType: string;
  description: string;
  thresholdPercentage: number;
  expectation: string;
}

export interface GeneratedRiskArea {
  riskRef: string;
  riskDescription: string;
  riskCategory: string;
  inherentRisk: "HIGH" | "MEDIUM" | "LOW";
  controlRisk: "HIGH" | "MEDIUM" | "LOW";
  assertions: string[];
  isaReference: string;
  responseStrategy: string;
}

export interface AuditApproach {
  approach: "COMBINED" | "SUBSTANTIVE_ONLY";
  rationale: string;
  controlReliance: boolean;
  riskLevel: string;
}

const ACCOUNT_TYPE_PROCEDURES: Record<string, GeneratedProcedure[]> = {
  "Cash and Cash Equivalents": [
    {
      procedureRef: "AP-CASH-001",
      description: "Obtain bank confirmations for all bank accounts and reconcile to general ledger",
      type: "TOD",
      isaReference: "ISA 500, ISA 505",
      assertions: ["Existence", "Completeness", "Valuation"],
      estimatedTime: "2 hours",
      riskLevel: "LOW"
    },
    {
      procedureRef: "AP-CASH-002",
      description: "Review bank reconciliations for all months and test reconciling items",
      type: "TOC",
      isaReference: "ISA 330",
      assertions: ["Existence", "Accuracy"],
      estimatedTime: "1.5 hours",
      riskLevel: "MEDIUM"
    },
    {
      procedureRef: "AP-CASH-003",
      description: "Test cash cutoff by examining receipts and disbursements around period end",
      type: "TOD",
      isaReference: "ISA 500",
      assertions: ["Cutoff"],
      estimatedTime: "1 hour",
      riskLevel: "MEDIUM"
    },
    {
      procedureRef: "AP-CASH-004",
      description: "Perform analytical review comparing cash movements to prior year",
      type: "ANALYTICS",
      isaReference: "ISA 520",
      assertions: ["Completeness", "Accuracy"],
      estimatedTime: "0.5 hours",
      riskLevel: "LOW"
    }
  ],
  "Trade Receivables": [
    {
      procedureRef: "AP-AR-001",
      description: "Perform aging analysis and test allowance for doubtful accounts calculation",
      type: "TOD",
      isaReference: "ISA 540",
      assertions: ["Valuation", "Existence"],
      estimatedTime: "3 hours",
      riskLevel: "HIGH"
    },
    {
      procedureRef: "AP-AR-002",
      description: "Send positive confirmations to sample of customers and follow up on exceptions",
      type: "TOD",
      isaReference: "ISA 505",
      assertions: ["Existence", "Rights"],
      estimatedTime: "4 hours",
      riskLevel: "MEDIUM"
    },
    {
      procedureRef: "AP-AR-003",
      description: "Test sales cutoff by examining invoices and shipping documents around period end",
      type: "TOD",
      isaReference: "ISA 500",
      assertions: ["Cutoff", "Completeness"],
      estimatedTime: "2 hours",
      riskLevel: "HIGH"
    },
    {
      procedureRef: "AP-AR-004",
      description: "Review credit approval process and test authorization controls",
      type: "TOC",
      isaReference: "ISA 315, ISA 330",
      assertions: ["Accuracy", "Authorization"],
      estimatedTime: "1.5 hours",
      riskLevel: "MEDIUM"
    }
  ],
  "Inventory": [
    {
      procedureRef: "AP-INV-001",
      description: "Observe physical inventory count and perform test counts",
      type: "TOD",
      isaReference: "ISA 501",
      assertions: ["Existence", "Completeness"],
      estimatedTime: "8 hours",
      riskLevel: "HIGH"
    },
    {
      procedureRef: "AP-INV-002",
      description: "Test inventory costing methodology and recalculate FIFO/weighted average",
      type: "TOD",
      isaReference: "ISA 500",
      assertions: ["Valuation", "Accuracy"],
      estimatedTime: "3 hours",
      riskLevel: "HIGH"
    },
    {
      procedureRef: "AP-INV-003",
      description: "Analyze slow-moving and obsolete inventory and test NRV calculations",
      type: "TOD",
      isaReference: "ISA 540",
      assertions: ["Valuation"],
      estimatedTime: "2 hours",
      riskLevel: "MEDIUM"
    },
    {
      procedureRef: "AP-INV-004",
      description: "Review inventory perpetual system controls and reconciliation to GL",
      type: "TOC",
      isaReference: "ISA 330",
      assertions: ["Completeness", "Accuracy"],
      estimatedTime: "1.5 hours",
      riskLevel: "MEDIUM"
    }
  ],
  "Property, Plant and Equipment": [
    {
      procedureRef: "AP-PPE-001",
      description: "Vouch additions to supporting documentation (invoices, contracts, capitalization memos)",
      type: "TOD",
      isaReference: "ISA 500",
      assertions: ["Existence", "Accuracy", "Classification"],
      estimatedTime: "3 hours",
      riskLevel: "MEDIUM"
    },
    {
      procedureRef: "AP-PPE-002",
      description: "Recalculate depreciation expense and test useful life assumptions",
      type: "TOD",
      isaReference: "ISA 540",
      assertions: ["Valuation", "Accuracy"],
      estimatedTime: "2 hours",
      riskLevel: "LOW"
    },
    {
      procedureRef: "AP-PPE-003",
      description: "Physical verification of sample of fixed assets",
      type: "TOD",
      isaReference: "ISA 500",
      assertions: ["Existence"],
      estimatedTime: "2 hours",
      riskLevel: "LOW"
    },
    {
      procedureRef: "AP-PPE-004",
      description: "Test capital expenditure authorization controls",
      type: "TOC",
      isaReference: "ISA 330",
      assertions: ["Authorization", "Completeness"],
      estimatedTime: "1 hour",
      riskLevel: "LOW"
    }
  ],
  "Trade Payables": [
    {
      procedureRef: "AP-PAY-001",
      description: "Perform vendor statement reconciliations for key suppliers",
      type: "TOD",
      isaReference: "ISA 500",
      assertions: ["Completeness", "Existence"],
      estimatedTime: "2 hours",
      riskLevel: "MEDIUM"
    },
    {
      procedureRef: "AP-PAY-002",
      description: "Search for unrecorded liabilities by reviewing post-period payments",
      type: "TOD",
      isaReference: "ISA 500",
      assertions: ["Completeness"],
      estimatedTime: "2.5 hours",
      riskLevel: "HIGH"
    },
    {
      procedureRef: "AP-PAY-003",
      description: "Test purchase cutoff by examining invoices around period end",
      type: "TOD",
      isaReference: "ISA 500",
      assertions: ["Cutoff", "Completeness"],
      estimatedTime: "1.5 hours",
      riskLevel: "MEDIUM"
    },
    {
      procedureRef: "AP-PAY-004",
      description: "Test three-way matching controls (PO, receipt, invoice)",
      type: "TOC",
      isaReference: "ISA 330",
      assertions: ["Accuracy", "Authorization"],
      estimatedTime: "1.5 hours",
      riskLevel: "MEDIUM"
    }
  ],
  "Revenue": [
    {
      procedureRef: "AP-REV-001",
      description: "Test revenue recognition in accordance with applicable accounting standard",
      type: "TOD",
      isaReference: "ISA 500, ISA 540",
      assertions: ["Accuracy", "Cutoff", "Occurrence"],
      estimatedTime: "4 hours",
      riskLevel: "HIGH"
    },
    {
      procedureRef: "AP-REV-002",
      description: "Vouch sample of sales transactions to supporting documents",
      type: "TOD",
      isaReference: "ISA 500",
      assertions: ["Occurrence", "Accuracy"],
      estimatedTime: "3 hours",
      riskLevel: "MEDIUM"
    },
    {
      procedureRef: "AP-REV-003",
      description: "Perform sales cutoff testing around period end",
      type: "TOD",
      isaReference: "ISA 500",
      assertions: ["Cutoff"],
      estimatedTime: "2 hours",
      riskLevel: "HIGH"
    },
    {
      procedureRef: "AP-REV-004",
      description: "Test sales order approval and credit check controls",
      type: "TOC",
      isaReference: "ISA 330",
      assertions: ["Accuracy", "Authorization"],
      estimatedTime: "1.5 hours",
      riskLevel: "MEDIUM"
    },
    {
      procedureRef: "AP-REV-005",
      description: "Perform analytical review of revenue trends vs prior year and budget",
      type: "ANALYTICS",
      isaReference: "ISA 520",
      assertions: ["Completeness", "Occurrence"],
      estimatedTime: "1 hour",
      riskLevel: "MEDIUM"
    }
  ],
  "Cost of Sales": [
    {
      procedureRef: "AP-COS-001",
      description: "Test gross margin reasonableness and compare to prior periods",
      type: "ANALYTICS",
      isaReference: "ISA 520",
      assertions: ["Accuracy", "Completeness"],
      estimatedTime: "1 hour",
      riskLevel: "MEDIUM"
    },
    {
      procedureRef: "AP-COS-002",
      description: "Vouch sample of purchase transactions to supporting documentation",
      type: "TOD",
      isaReference: "ISA 500",
      assertions: ["Occurrence", "Accuracy"],
      estimatedTime: "2 hours",
      riskLevel: "MEDIUM"
    },
    {
      procedureRef: "AP-COS-003",
      description: "Test inventory cost flow and COGS calculation",
      type: "TOD",
      isaReference: "ISA 500",
      assertions: ["Valuation", "Accuracy"],
      estimatedTime: "2 hours",
      riskLevel: "MEDIUM"
    }
  ],
  "Operating Expenses": [
    {
      procedureRef: "AP-OPEX-001",
      description: "Perform analytical review of expenses vs prior year and budget",
      type: "ANALYTICS",
      isaReference: "ISA 520",
      assertions: ["Completeness", "Accuracy"],
      estimatedTime: "1.5 hours",
      riskLevel: "LOW"
    },
    {
      procedureRef: "AP-OPEX-002",
      description: "Vouch sample of expense transactions to supporting documentation",
      type: "TOD",
      isaReference: "ISA 500",
      assertions: ["Occurrence", "Accuracy"],
      estimatedTime: "2 hours",
      riskLevel: "LOW"
    },
    {
      procedureRef: "AP-OPEX-003",
      description: "Test expense approval controls",
      type: "TOC",
      isaReference: "ISA 330",
      assertions: ["Authorization"],
      estimatedTime: "1 hour",
      riskLevel: "LOW"
    }
  ]
};

const DEFAULT_PROCEDURES: GeneratedProcedure[] = [
  {
    procedureRef: "AP-GEN-001",
    description: "Obtain trial balance and agree to general ledger",
    type: "TOD",
    isaReference: "ISA 500",
    assertions: ["Completeness", "Accuracy"],
    estimatedTime: "0.5 hours",
    riskLevel: "LOW"
  },
  {
    procedureRef: "AP-GEN-002",
    description: "Perform analytical review comparing to prior year",
    type: "ANALYTICS",
    isaReference: "ISA 520",
    assertions: ["Accuracy", "Completeness"],
    estimatedTime: "1 hour",
    riskLevel: "MEDIUM"
  },
  {
    procedureRef: "AP-GEN-003",
    description: "Vouch sample of transactions to supporting documentation",
    type: "TOD",
    isaReference: "ISA 500",
    assertions: ["Occurrence", "Accuracy"],
    estimatedTime: "2 hours",
    riskLevel: "MEDIUM"
  }
];

export async function generateAuditProcedures(
  engagementId: string,
  fsHeadKey: string,
  fsHeadName: string
): Promise<GeneratedProcedure[]> {
  const matchingProcedures = ACCOUNT_TYPE_PROCEDURES[fsHeadName] || 
    Object.entries(ACCOUNT_TYPE_PROCEDURES).find(([key]) => 
      fsHeadName.toLowerCase().includes(key.toLowerCase()) ||
      key.toLowerCase().includes(fsHeadName.toLowerCase())
    )?.[1] ||
    DEFAULT_PROCEDURES;

  return matchingProcedures.map((proc, idx) => ({
    ...proc,
    procedureRef: `AP-${fsHeadKey.slice(0, 3).toUpperCase()}-${String(idx + 1).padStart(3, '0')}`
  }));
}

export async function generateTOCItems(
  engagementId: string,
  fsHeadKey: string,
  fsHeadName: string
): Promise<GeneratedControl[]> {
  const controlTemplates: Record<string, GeneratedControl[]> = {
    "Cash and Cash Equivalents": [
      {
        tocRef: `C-${fsHeadKey.slice(0, 3).toUpperCase()}-001`,
        controlDescription: "Monthly bank reconciliation prepared and reviewed by Finance Manager",
        controlOwner: "Finance Manager",
        controlFrequency: "Monthly",
        controlType: "Detective",
        testSteps: "1. Select 3 months (e.g., Jan, Apr, Sep)\n2. Obtain reconciliation reports\n3. Verify mathematical accuracy\n4. Check management review sign-off\n5. Trace reconciling items to resolution",
        sampleSize: 3,
        assertions: ["Existence", "Accuracy"]
      },
      {
        tocRef: `C-${fsHeadKey.slice(0, 3).toUpperCase()}-002`,
        controlDescription: "Dual signature required for payments above threshold",
        controlOwner: "Treasury",
        controlFrequency: "Per Transaction",
        controlType: "Preventive",
        testSteps: "1. Select sample of 25 payments above threshold\n2. Verify dual signatures present\n3. Confirm signatories are authorized\n4. Document any exceptions",
        sampleSize: 25,
        assertions: ["Authorization", "Accuracy"]
      }
    ],
    "Trade Receivables": [
      {
        tocRef: `C-${fsHeadKey.slice(0, 3).toUpperCase()}-001`,
        controlDescription: "Credit approval required for new customers and credit limit changes",
        controlOwner: "Credit Manager",
        controlFrequency: "Per Transaction",
        controlType: "Preventive",
        testSteps: "1. Select sample of 20 new customers\n2. Verify credit application completed\n3. Confirm credit check performed\n4. Verify approval by authorized personnel",
        sampleSize: 20,
        assertions: ["Authorization", "Valuation"]
      },
      {
        tocRef: `C-${fsHeadKey.slice(0, 3).toUpperCase()}-002`,
        controlDescription: "Monthly review of aged receivables by Finance Director",
        controlOwner: "Finance Director",
        controlFrequency: "Monthly",
        controlType: "Detective",
        testSteps: "1. Select 3 months\n2. Obtain aging reports\n3. Verify evidence of review\n4. Check follow-up actions documented",
        sampleSize: 3,
        assertions: ["Valuation", "Existence"]
      }
    ],
    "Revenue": [
      {
        tocRef: `C-${fsHeadKey.slice(0, 3).toUpperCase()}-001`,
        controlDescription: "Sales order approval required before shipment",
        controlOwner: "Sales Manager",
        controlFrequency: "Per Transaction",
        controlType: "Preventive",
        testSteps: "1. Select sample of 25 sales orders\n2. Verify approval before delivery\n3. Check credit terms authorized\n4. Confirm pricing accuracy",
        sampleSize: 25,
        assertions: ["Occurrence", "Accuracy"]
      },
      {
        tocRef: `C-${fsHeadKey.slice(0, 3).toUpperCase()}-002`,
        controlDescription: "Automatic three-way matching of invoice, order, and delivery",
        controlOwner: "System",
        controlFrequency: "Per Transaction",
        controlType: "Preventive",
        testSteps: "1. Review system configuration\n2. Select sample of 30 invoices\n3. Verify matching performed\n4. Test exception handling",
        sampleSize: 30,
        assertions: ["Accuracy", "Completeness"]
      }
    ]
  };

  const defaultControls: GeneratedControl[] = [
    {
      tocRef: `C-${fsHeadKey.slice(0, 3).toUpperCase()}-001`,
      controlDescription: "Management review of account reconciliation",
      controlOwner: "Finance Manager",
      controlFrequency: "Monthly",
      controlType: "Detective",
      testSteps: "1. Select 3 months\n2. Obtain reconciliations\n3. Verify review evidence\n4. Check reconciling items resolved",
      sampleSize: 3,
      assertions: ["Accuracy", "Completeness"]
    },
    {
      tocRef: `C-${fsHeadKey.slice(0, 3).toUpperCase()}-002`,
      controlDescription: "Transaction approval for entries above threshold",
      controlOwner: "Department Head",
      controlFrequency: "Per Transaction",
      controlType: "Preventive",
      testSteps: "1. Select sample of 25 transactions\n2. Verify approval obtained\n3. Confirm approver is authorized\n4. Document any exceptions",
      sampleSize: 25,
      assertions: ["Authorization"]
    },
    {
      tocRef: `C-${fsHeadKey.slice(0, 3).toUpperCase()}-003`,
      controlDescription: "Segregation of duties between recording and authorization",
      controlOwner: "Finance Director",
      controlFrequency: "Ongoing",
      controlType: "Preventive",
      testSteps: "1. Review access rights matrix\n2. Test 15 transactions for proper segregation\n3. Verify no single person can initiate and approve\n4. Document any segregation failures",
      sampleSize: 15,
      assertions: ["Authorization", "Accuracy"]
    },
    {
      tocRef: `C-${fsHeadKey.slice(0, 3).toUpperCase()}-004`,
      controlDescription: "System access controls and password policies",
      controlOwner: "IT Manager",
      controlFrequency: "Quarterly",
      controlType: "Preventive",
      testSteps: "1. Obtain user access listing\n2. Review quarterly access reviews\n3. Test password policy enforcement\n4. Verify terminated user removal",
      sampleSize: 4,
      assertions: ["Authorization", "Completeness"]
    },
    {
      tocRef: `C-${fsHeadKey.slice(0, 3).toUpperCase()}-005`,
      controlDescription: "Exception reporting and investigation process",
      controlOwner: "Finance Manager",
      controlFrequency: "Weekly",
      controlType: "Detective",
      testSteps: "1. Select 4 weeks of exception reports\n2. Verify timely review\n3. Check investigation documentation\n4. Confirm resolution of exceptions",
      sampleSize: 4,
      assertions: ["Completeness", "Accuracy"]
    }
  ];

  const matchingControls = controlTemplates[fsHeadName] ||
    Object.entries(controlTemplates).find(([key]) =>
      fsHeadName.toLowerCase().includes(key.toLowerCase())
    )?.[1] ||
    defaultControls;

  return matchingControls;
}

export async function generateTODItems(
  engagementId: string,
  fsHeadKey: string,
  fsHeadName: string,
  currentYearBalance?: number,
  priorYearBalance?: number
): Promise<GeneratedTOD[]> {
  const populationValue = currentYearBalance || 1000000;
  const estimatedPopCount = Math.floor(populationValue / 10000);
  const sampleSize = Math.min(Math.max(10, Math.ceil(estimatedPopCount * 0.1)), 60);

  const todTemplates: Record<string, GeneratedTOD[]> = {
    "Cash and Cash Equivalents": [
      {
        todRef: `ST-${fsHeadKey.slice(0, 3).toUpperCase()}-001`,
        procedureDescription: "Bank confirmation testing - obtain and agree confirmations to GL",
        assertions: ["Existence", "Completeness", "Rights"],
        populationDescription: "All bank accounts listed in GL",
        samplingMethod: "100% coverage",
        sampleSize: 0,
        testSteps: "1. Obtain list of all bank accounts\n2. Send confirmation requests\n3. Reconcile responses to GL balances\n4. Follow up on non-responses"
      }
    ],
    "Trade Receivables": [
      {
        todRef: `ST-${fsHeadKey.slice(0, 3).toUpperCase()}-001`,
        procedureDescription: "Customer confirmation testing using positive confirmation method",
        assertions: ["Existence", "Rights", "Valuation"],
        populationDescription: `Customer balances > $10,000 (estimated ${estimatedPopCount} items)`,
        samplingMethod: "MUS",
        sampleSize: sampleSize,
        testSteps: "1. Select sample using MUS\n2. Send positive confirmations\n3. Perform alternative procedures for non-responses\n4. Investigate exceptions"
      },
      {
        todRef: `ST-${fsHeadKey.slice(0, 3).toUpperCase()}-002`,
        procedureDescription: "Test subsequent cash receipts for selected customers",
        assertions: ["Existence", "Valuation"],
        populationDescription: "Customers selected for confirmation with no response",
        samplingMethod: "Judgmental",
        sampleSize: 15,
        testSteps: "1. Identify non-responding customers\n2. Trace to subsequent cash receipts\n3. Verify amounts match outstanding balances\n4. Document results"
      }
    ],
    "Inventory": [
      {
        todRef: `ST-${fsHeadKey.slice(0, 3).toUpperCase()}-001`,
        procedureDescription: "Test count accuracy during physical inventory observation",
        assertions: ["Existence", "Completeness"],
        populationDescription: `Inventory items at count locations`,
        samplingMethod: "Stratified",
        sampleSize: 40,
        testSteps: "1. Select high-value items for test counts\n2. Perform counts and compare to client tags\n3. Investigate variances\n4. Document count procedures"
      },
      {
        todRef: `ST-${fsHeadKey.slice(0, 3).toUpperCase()}-002`,
        procedureDescription: "Test inventory costing for sample of items",
        assertions: ["Valuation", "Accuracy"],
        populationDescription: `All inventory items in final listing`,
        samplingMethod: "MUS",
        sampleSize: sampleSize,
        testSteps: "1. Select sample of items\n2. Recalculate cost using FIFO/WAC\n3. Compare to recorded cost\n4. Test NRV for selected items"
      }
    ]
  };

  const defaultTOD: GeneratedTOD[] = [
    {
      todRef: `ST-${fsHeadKey.slice(0, 3).toUpperCase()}-001`,
      procedureDescription: "Vouch sample of transactions to supporting documentation",
      assertions: ["Occurrence", "Accuracy"],
      populationDescription: `Transactions recorded during the year (estimated ${estimatedPopCount} items)`,
      samplingMethod: "Random",
      sampleSize: sampleSize,
      testSteps: "1. Select random sample\n2. Obtain supporting documentation\n3. Verify amount, date, and description\n4. Document any exceptions"
    },
    {
      todRef: `ST-${fsHeadKey.slice(0, 3).toUpperCase()}-002`,
      procedureDescription: "Test cutoff for transactions around period end",
      assertions: ["Cutoff"],
      populationDescription: "Transactions 5 days before and after period end",
      samplingMethod: "100% coverage",
      sampleSize: 0,
      testSteps: "1. Select all transactions in cutoff period\n2. Verify recording in correct period\n3. Check supporting documentation dates\n4. Document exceptions"
    },
    {
      todRef: `ST-${fsHeadKey.slice(0, 3).toUpperCase()}-003`,
      procedureDescription: "Recalculate account balance and trace to trial balance",
      assertions: ["Accuracy", "Completeness"],
      populationDescription: "Account ledger detail",
      samplingMethod: "100% coverage",
      sampleSize: 0,
      testSteps: "1. Obtain account ledger\n2. Foot and cross-foot detail\n3. Agree to trial balance\n4. Investigate variances"
    },
    {
      todRef: `ST-${fsHeadKey.slice(0, 3).toUpperCase()}-004`,
      procedureDescription: "Test journal entries posted to the account",
      assertions: ["Occurrence", "Authorization"],
      populationDescription: `Manual journal entries posted (estimated ${Math.floor(estimatedPopCount * 0.15)} items)`,
      samplingMethod: "Judgmental",
      sampleSize: Math.min(20, Math.ceil(estimatedPopCount * 0.15)),
      testSteps: "1. Identify manual journal entries\n2. Select high-risk entries\n3. Verify authorization and support\n4. Test for unusual entries"
    },
    {
      todRef: `ST-${fsHeadKey.slice(0, 3).toUpperCase()}-005`,
      procedureDescription: "Trace balance to prior year working papers and agree opening balance",
      assertions: ["Completeness", "Accuracy"],
      populationDescription: "Opening balance per prior year audit",
      samplingMethod: "100% coverage",
      sampleSize: 0,
      testSteps: "1. Obtain prior year working papers\n2. Agree closing to opening balance\n3. Investigate adjustments\n4. Document any differences"
    }
  ];

  return todTemplates[fsHeadName] ||
    Object.entries(todTemplates).find(([key]) =>
      fsHeadName.toLowerCase().includes(key.toLowerCase())
    )?.[1] ||
    defaultTOD;
}

export async function generateAnalyticalProcedures(
  engagementId: string,
  fsHeadKey: string,
  fsHeadName: string,
  currentYearBalance?: number,
  priorYearBalance?: number
): Promise<GeneratedAnalytical[]> {
  const cyBalance = currentYearBalance || 0;
  const pyBalance = priorYearBalance || 0;
  const variance = cyBalance - pyBalance;
  const variancePercent = pyBalance !== 0 ? (variance / pyBalance) * 100 : 0;

  const analyticals: GeneratedAnalytical[] = [
    {
      procedureRef: `AN-${fsHeadKey.slice(0, 3).toUpperCase()}-001`,
      analyticalType: "YoY Comparison",
      description: `Compare ${fsHeadName} balance year-over-year and investigate variances > 10%`,
      thresholdPercentage: 10,
      expectation: `Based on prior year balance of ${formatCurrency(pyBalance)}, expected CY balance within 10% variance. Actual variance: ${variancePercent.toFixed(1)}%`
    },
    {
      procedureRef: `AN-${fsHeadKey.slice(0, 3).toUpperCase()}-002`,
      analyticalType: "Trend Analysis",
      description: `Analyze monthly trend of ${fsHeadName} and identify unusual patterns`,
      thresholdPercentage: 15,
      expectation: "Monthly balances should follow consistent trend without significant unexplained spikes"
    },
    {
      procedureRef: `AN-${fsHeadKey.slice(0, 3).toUpperCase()}-003`,
      analyticalType: "Ratio Analysis",
      description: `Calculate relevant ratios for ${fsHeadName} and compare to industry benchmarks`,
      thresholdPercentage: 20,
      expectation: "Ratios should be consistent with industry averages and prior periods"
    },
    {
      procedureRef: `AN-${fsHeadKey.slice(0, 3).toUpperCase()}-004`,
      analyticalType: "Budget Comparison",
      description: `Compare ${fsHeadName} actual balance to budget and investigate significant variances`,
      thresholdPercentage: 15,
      expectation: "Actual should be within 15% of budgeted amount unless explained by operational changes"
    },
    {
      procedureRef: `AN-${fsHeadKey.slice(0, 3).toUpperCase()}-005`,
      analyticalType: "Reasonableness Test",
      description: `Develop independent expectation of ${fsHeadName} balance based on related operational data`,
      thresholdPercentage: 10,
      expectation: "Balance should correlate with operational drivers (e.g., sales volume, headcount, production)"
    }
  ];

  return analyticals;
}

export async function determineAuditApproach(
  engagementId: string,
  fsHeadKey: string,
  riskLevel?: string
): Promise<AuditApproach> {
  const risk = riskLevel || "MEDIUM";
  
  if (risk === "HIGH") {
    return {
      approach: "SUBSTANTIVE_ONLY",
      rationale: "Due to high inherent risk, a substantive-only approach is recommended. Extensive testing of details will be performed without reliance on controls.",
      controlReliance: false,
      riskLevel: risk
    };
  }

  return {
    approach: "COMBINED",
    rationale: "A combined approach is appropriate. Controls will be tested for operating effectiveness, with reduced substantive testing where controls are effective.",
    controlReliance: true,
    riskLevel: risk
  };
}

export async function generateWorkspaceContent(
  engagementId: string,
  fsHeadKey: string,
  fsHeadName: string
): Promise<{
  procedures: GeneratedProcedure[];
  toc: GeneratedControl[];
  tod: GeneratedTOD[];
  analytics: GeneratedAnalytical[];
  approach: AuditApproach;
}> {
  const workingPaper = await db.fSHeadWorkingPaper.findFirst({
    where: { engagementId, fsHeadKey }
  });

  const procedures = await generateAuditProcedures(engagementId, fsHeadKey, fsHeadName);
  const toc = await generateTOCItems(engagementId, fsHeadKey, fsHeadName);
  const tod = await generateTODItems(
    engagementId,
    fsHeadKey,
    fsHeadName,
    workingPaper?.currentYearBalance,
    workingPaper?.priorYearBalance
  );
  const analytics = await generateAnalyticalProcedures(
    engagementId,
    fsHeadKey,
    fsHeadName,
    workingPaper?.currentYearBalance,
    workingPaper?.priorYearBalance
  );
  const approach = await determineAuditApproach(engagementId, fsHeadKey, workingPaper?.riskLevel);

  return { procedures, toc, tod, analytics, approach };
}

export async function generateConclusionDraft(
  engagementId: string,
  fsHeadKey: string,
  fsHeadName: string
): Promise<string> {
  const workingPaper = await db.fSHeadWorkingPaper.findFirst({
    where: { engagementId, fsHeadKey },
    include: {
      procedures: true,
      testOfControls: true,
      testOfDetails: true,
      analyticalProcedures: true,
      adjustments: true,
      attachments: true
    }
  });

  if (!workingPaper) {
    return `CONCLUSION FOR ${fsHeadName}\n\nNo working paper data available.`;
  }

  const procedures = workingPaper.procedures || [];
  const tocs = (workingPaper as any).testOfControls || [];
  const tods = (workingPaper as any).testOfDetails || [];
  const analytics = workingPaper.analyticalProcedures || [];
  const adjustments = workingPaper.adjustments || [];
  const attachments = workingPaper.attachments || [];

  const tocEffective = tocs.filter((t: any) => t.result === "EFFECTIVE" || t.result === "SATISFACTORY").length;
  const todSatisfactory = tods.filter((t: any) => t.result === "SATISFACTORY" || t.result === "NO_EXCEPTIONS").length;
  const exceptionsFound = tods.filter((t: any) => (t.exceptionsFound || 0) > 0).length;
  const totalAdjustments = adjustments.reduce((sum: number, a: any) => sum + Math.abs(a.netImpact || 0), 0);

  const conclusion = `OVERALL CONCLUSION FOR ${fsHeadName.toUpperCase()}

Based on the audit procedures performed and audit evidence obtained, I conclude that ${fsHeadName} is fairly stated in all material respects as at the reporting date.

SUMMARY OF WORK PERFORMED:
- Test of Controls: ${tocs.length} controls tested, ${tocEffective} found to be operating effectively
- Test of Details: ${tods.length} substantive tests performed, ${todSatisfactory} with satisfactory results
- Analytical Procedures: ${analytics.length} analytical procedures completed
- Evidence Items: ${attachments.length} supporting documents obtained

EXCEPTIONS AND ADJUSTMENTS:
${exceptionsFound > 0 ? `- ${exceptionsFound} exception(s) identified during testing` : '- No material exceptions identified'}
${totalAdjustments > 0 ? `- Total proposed adjustments: ${formatCurrency(totalAdjustments)}` : '- No adjustments required'}

FINAL ASSESSMENT:
The balance of ${formatCurrency(workingPaper.currentYearBalance)} as at year-end is considered fairly stated. The movement of ${formatCurrency(workingPaper.movement)} from prior year has been satisfactorily explained through analytical review.

[This conclusion is AI-drafted based on working paper data. Review and modify as appropriate based on professional judgment.]`;

  return conclusion;
}

export async function generateRiskAreas(
  engagementId: string,
  fsHeadKey: string,
  fsHeadName: string
): Promise<GeneratedRiskArea[]> {
  const riskTemplates: Record<string, GeneratedRiskArea[]> = {
    "Revenue": [
      {
        riskRef: `R-${fsHeadKey.slice(0, 3).toUpperCase()}-001`,
        riskDescription: "Revenue recognition may not be in accordance with applicable financial reporting framework",
        riskCategory: "Fraud Risk",
        inherentRisk: "HIGH",
        controlRisk: "MEDIUM",
        assertions: ["Occurrence", "Accuracy", "Cutoff"],
        isaReference: "ISA 240, ISA 315",
        responseStrategy: "Extended substantive testing of revenue transactions around period end; test of details for manual journal entries"
      },
      {
        riskRef: `R-${fsHeadKey.slice(0, 3).toUpperCase()}-002`,
        riskDescription: "Side agreements or bill-and-hold arrangements may affect timing of revenue recognition",
        riskCategory: "Significant Risk",
        inherentRisk: "HIGH",
        controlRisk: "MEDIUM",
        assertions: ["Occurrence", "Cutoff"],
        isaReference: "ISA 315, ISA 540",
        responseStrategy: "Review contract terms; test sample of arrangements for substance over form"
      }
    ],
    "Cash and Cash Equivalents": [
      {
        riskRef: `R-${fsHeadKey.slice(0, 3).toUpperCase()}-001`,
        riskDescription: "Cash may be misappropriated through unauthorized transactions or fictitious payments",
        riskCategory: "Fraud Risk",
        inherentRisk: "HIGH",
        controlRisk: "MEDIUM",
        assertions: ["Existence", "Rights"],
        isaReference: "ISA 240",
        responseStrategy: "Bank confirmations; review of bank reconciliations; test of payment authorization controls"
      }
    ],
    "Trade Receivables": [
      {
        riskRef: `R-${fsHeadKey.slice(0, 3).toUpperCase()}-001`,
        riskDescription: "Receivables may be overstated due to fictitious sales or inadequate allowance for doubtful accounts",
        riskCategory: "Significant Risk",
        inherentRisk: "HIGH",
        controlRisk: "MEDIUM",
        assertions: ["Existence", "Valuation"],
        isaReference: "ISA 315, ISA 540",
        responseStrategy: "Customer confirmations; aging analysis; test of allowance methodology"
      }
    ]
  };

  const defaultRisks: GeneratedRiskArea[] = [
    {
      riskRef: `R-${fsHeadKey.slice(0, 3).toUpperCase()}-001`,
      riskDescription: `${fsHeadName} balance may be materially misstated due to errors or fraud`,
      riskCategory: "Standard Risk",
      inherentRisk: "MEDIUM",
      controlRisk: "MEDIUM",
      assertions: ["Existence", "Completeness", "Accuracy"],
      isaReference: "ISA 315",
      responseStrategy: "Combined audit approach with tests of controls and substantive procedures"
    },
    {
      riskRef: `R-${fsHeadKey.slice(0, 3).toUpperCase()}-002`,
      riskDescription: `Valuation of ${fsHeadName} may involve significant management judgment or estimation uncertainty`,
      riskCategory: "Estimation Risk",
      inherentRisk: "MEDIUM",
      controlRisk: "MEDIUM",
      assertions: ["Valuation"],
      isaReference: "ISA 540",
      responseStrategy: "Review of management assumptions; sensitivity analysis; independent recalculation"
    },
    {
      riskRef: `R-${fsHeadKey.slice(0, 3).toUpperCase()}-003`,
      riskDescription: `Cutoff procedures may result in transactions recorded in incorrect period`,
      riskCategory: "Standard Risk",
      inherentRisk: "MEDIUM",
      controlRisk: "LOW",
      assertions: ["Cutoff"],
      isaReference: "ISA 500",
      responseStrategy: "Cutoff testing around period end; review of post-period transactions"
    },
    {
      riskRef: `R-${fsHeadKey.slice(0, 3).toUpperCase()}-004`,
      riskDescription: `${fsHeadName} may not be properly classified or disclosed in financial statements`,
      riskCategory: "Presentation Risk",
      inherentRisk: "LOW",
      controlRisk: "LOW",
      assertions: ["Classification", "Presentation"],
      isaReference: "ISA 450",
      responseStrategy: "Review of classification against accounting standards; disclosure checklist"
    },
    {
      riskRef: `R-${fsHeadKey.slice(0, 3).toUpperCase()}-005`,
      riskDescription: `Related party transactions affecting ${fsHeadName} may not be identified or disclosed`,
      riskCategory: "Significant Risk",
      inherentRisk: "MEDIUM",
      controlRisk: "MEDIUM",
      assertions: ["Completeness", "Presentation"],
      isaReference: "ISA 550",
      responseStrategy: "Related party identification procedures; review of transactions with known related parties"
    }
  ];

  const matchingRisks = riskTemplates[fsHeadName] ||
    Object.entries(riskTemplates).find(([key]) =>
      fsHeadName.toLowerCase().includes(key.toLowerCase())
    )?.[1];

  if (matchingRisks) {
    const additionalRisks = defaultRisks.filter(r => 
      !matchingRisks.some(m => m.riskCategory === r.riskCategory)
    ).slice(0, 5 - matchingRisks.length);
    return [...matchingRisks, ...additionalRisks].slice(0, 5);
  }

  return defaultRisks;
}

function formatCurrency(amount?: number): string {
  if (amount === undefined || amount === null) return "—";
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}
