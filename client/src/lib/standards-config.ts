export interface PhaseMapping {
  phase: string;
  trigger: string;
  mandatoryControls: string[];
  autoFetchSources: string[];
  dependencyRules: string[];
}

export interface StandardConfig {
  standardId: string;
  standardName: string;
  title: string;
  phase: string;
  subTab: string;
  subTabLabel: string;
  objective: string;
  requiredEvidence: string[];
  outputs: string[];
  roleApprovals: {
    preparer: string;
    reviewer: string;
    approver: string;
  };
  isStageGate: boolean;
  noReportBlocker: boolean;
  category: string;
  phaseMapping: PhaseMapping[];
}

export interface StageGateRequirement {
  stepId: string;
  label: string;
  required: boolean;
}

export const STANDARDS_MAP: StandardConfig[] = [
  {
    standardId: "ISA_200",
    standardName: "ISA 200",
    title: "Overall Objectives of the Independent Auditor and the Conduct of an Audit in Accordance with International Standards on Auditing",
    phase: "pre-planning",
    subTab: "setup",
    subTabLabel: "Engagement Setup",
    objective: "Establish overall objectives of the auditor and confirm that the audit is conducted in accordance with ISAs, including compliance with relevant ethical requirements and professional scepticism.",
    requiredEvidence: [
      "Signed engagement confirmation",
      "Independence declaration",
      "Ethical compliance checklist",
      "Professional scepticism acknowledgement"
    ],
    outputs: [
      "WP-200: Overall Audit Objectives Memorandum"
    ],
    roleApprovals: { preparer: "AUDIT_ASSOCIATE", reviewer: "AUDIT_MANAGER", approver: "ENGAGEMENT_PARTNER" },
    isStageGate: false,
    noReportBlocker: false,
    category: "Pre-Engagement",
    phaseMapping: [
      {
        phase: "pre-planning",
        trigger: "Engagement creation",
        mandatoryControls: ["Independence declaration", "Ethical compliance checklist"],
        autoFetchSources: ["Engagement setup form", "Team assignment records"],
        dependencyRules: ["Must be completed before ISA 210"]
      }
    ]
  },
  {
    standardId: "ISA_210",
    standardName: "ISA 210",
    title: "Agreeing the Terms of Audit Engagements",
    phase: "pre-planning",
    subTab: "acceptance",
    subTabLabel: "Client Acceptance & Continuance",
    objective: "Establish whether the preconditions for an audit are present and confirm mutual understanding of the terms of the audit engagement between the auditor and management.",
    requiredEvidence: [
      "Signed engagement letter",
      "Client acceptance/continuance checklist",
      "Management acknowledgement of responsibilities",
      "Preconditions assessment form"
    ],
    outputs: [
      "WP-210: Engagement Letter",
      "WP-210A: Client Acceptance & Continuance Assessment"
    ],
    roleApprovals: { preparer: "AUDIT_MANAGER", reviewer: "ENGAGEMENT_PARTNER", approver: "ENGAGEMENT_PARTNER" },
    isStageGate: true,
    noReportBlocker: true,
    category: "Pre-Engagement",
    phaseMapping: [
      {
        phase: "pre-planning",
        trigger: "Client acceptance decision",
        mandatoryControls: ["Signed engagement letter", "Client acceptance checklist", "Management acknowledgement"],
        autoFetchSources: ["Prior year engagement files", "Client database"],
        dependencyRules: ["Blocks all subsequent phases if incomplete", "Requires ISA 200 setup"]
      }
    ]
  },
  {
    standardId: "ISA_220",
    standardName: "ISA 220",
    title: "Quality Management for an Audit of Financial Statements",
    phase: "pre-planning",
    subTab: "team",
    subTabLabel: "Audit Team & Quality",
    objective: "Manage quality at the engagement level to obtain reasonable assurance that quality risks are addressed, including leadership responsibilities, ethical requirements, and engagement performance.",
    requiredEvidence: [
      "Engagement team assignment schedule",
      "Independence confirmations for all team members",
      "Competency and resource assessment",
      "Direction, supervision, and review plan",
      "Engagement quality review determination"
    ],
    outputs: [
      "WP-220: Quality Management Memorandum",
      "WP-220A: Team Assignment & Independence Schedule"
    ],
    roleApprovals: { preparer: "AUDIT_MANAGER", reviewer: "ENGAGEMENT_PARTNER", approver: "ENGAGEMENT_PARTNER" },
    isStageGate: true,
    noReportBlocker: true,
    category: "Quality Management",
    phaseMapping: [
      {
        phase: "pre-planning",
        trigger: "Team assignment initiated",
        mandatoryControls: ["Independence confirmations", "Competency assessment", "EQR determination"],
        autoFetchSources: ["HR records", "Independence system", "Prior engagement files"],
        dependencyRules: ["Must be completed before planning phase", "Links to ISQM 1 firm-level quality"]
      }
    ]
  },
  {
    standardId: "ISA_230",
    standardName: "ISA 230",
    title: "Audit Documentation",
    phase: "execution",
    subTab: "audit-evidence",
    subTabLabel: "Audit Evidence & Documentation",
    objective: "Prepare documentation sufficient to enable an experienced auditor to understand the nature, timing, and extent of audit procedures performed, results obtained, and significant matters arising.",
    requiredEvidence: [
      "Working paper index and cross-references",
      "Completion checklist for documentation standards",
      "Assembly timeline compliance record",
      "Superseded documentation log"
    ],
    outputs: [
      "WP-230: Documentation Standards Compliance Checklist",
      "WP-230A: Working Paper Assembly & Archive Record"
    ],
    roleApprovals: { preparer: "AUDIT_ASSOCIATE", reviewer: "AUDIT_MANAGER", approver: "ENGAGEMENT_PARTNER" },
    isStageGate: false,
    noReportBlocker: true,
    category: "Responses & Fieldwork",
    phaseMapping: [
      {
        phase: "execution",
        trigger: "Fieldwork commencement",
        mandatoryControls: ["Working paper index", "Documentation standards checklist"],
        autoFetchSources: ["All working papers", "Evidence attachments"],
        dependencyRules: ["Continuous requirement throughout audit", "Must be complete before archive (60-day rule)"]
      }
    ]
  },
  {
    standardId: "ISA_240",
    standardName: "ISA 240",
    title: "The Auditor's Responsibilities Relating to Fraud in an Audit of Financial Statements",
    phase: "planning",
    subTab: "fraud-assessment",
    subTabLabel: "Fraud Risk Assessment",
    objective: "Identify and assess the risks of material misstatement due to fraud, obtain sufficient appropriate evidence regarding the assessed risks, and respond appropriately to identified or suspected fraud.",
    requiredEvidence: [
      "Fraud risk factor questionnaire",
      "Team discussion minutes on fraud risks",
      "Management inquiry responses regarding fraud",
      "Journal entry testing plan",
      "Revenue recognition risk assessment"
    ],
    outputs: [
      "WP-240: Fraud Risk Assessment Memorandum",
      "WP-240A: Fraud Risk Factor Analysis",
      "WP-240B: Journal Entry Testing Plan"
    ],
    roleApprovals: { preparer: "AUDIT_SENIOR", reviewer: "AUDIT_MANAGER", approver: "ENGAGEMENT_PARTNER" },
    isStageGate: true,
    noReportBlocker: false,
    category: "Risk Assessment",
    phaseMapping: [
      {
        phase: "planning",
        trigger: "Risk assessment phase start",
        mandatoryControls: ["Fraud risk questionnaire", "Team discussion minutes", "Revenue recognition risk assessment"],
        autoFetchSources: ["Prior year fraud assessment", "Industry fraud data", "Management inquiries"],
        dependencyRules: ["Requires ISA 315 risk assessment context", "Feeds into ISA 330 responses"]
      }
    ]
  },
  {
    standardId: "ISA_250",
    standardName: "ISA 250",
    title: "Consideration of Laws and Regulations in an Audit of Financial Statements",
    phase: "planning",
    subTab: "laws-regulations",
    subTabLabel: "Laws & Regulations",
    objective: "Obtain sufficient appropriate audit evidence regarding compliance with laws and regulations that have a direct effect on the determination of material amounts and disclosures in the financial statements.",
    requiredEvidence: [
      "Regulatory environment assessment",
      "Management inquiry responses on legal compliance",
      "Correspondence with legal counsel",
      "Regulatory compliance checklist"
    ],
    outputs: [
      "WP-250: Laws & Regulations Compliance Assessment",
      "WP-250A: Regulatory Environment Summary"
    ],
    roleApprovals: { preparer: "AUDIT_SENIOR", reviewer: "AUDIT_MANAGER", approver: "ENGAGEMENT_PARTNER" },
    isStageGate: false,
    noReportBlocker: false,
    category: "Risk Assessment",
    phaseMapping: [
      {
        phase: "planning",
        trigger: "Entity understanding phase",
        mandatoryControls: ["Regulatory environment assessment", "Legal compliance inquiry"],
        autoFetchSources: ["Legal counsel correspondence", "Regulatory filings"],
        dependencyRules: ["Informs ISA 315 risk assessment", "Links to ISA 250A for non-compliance"]
      }
    ]
  },
  {
    standardId: "ISA_260",
    standardName: "ISA 260",
    title: "Communication with Those Charged with Governance",
    phase: "pre-planning",
    subTab: "tcwg-planning",
    subTabLabel: "TCWG Communication Planning",
    objective: "Communicate clearly with those charged with governance regarding the planned scope and timing of the audit, significant findings, and auditor independence, fostering effective two-way communication.",
    requiredEvidence: [
      "TCWG identification and communication protocol",
      "Planning communication letter to TCWG",
      "Record of significant matters communicated",
      "TCWG meeting minutes or acknowledgements"
    ],
    outputs: [
      "WP-260: TCWG Communication Plan",
      "WP-260A: Planning Communication to Governance"
    ],
    roleApprovals: { preparer: "AUDIT_MANAGER", reviewer: "ENGAGEMENT_PARTNER", approver: "ENGAGEMENT_PARTNER" },
    isStageGate: false,
    noReportBlocker: false,
    category: "Pre-Engagement",
    phaseMapping: [
      {
        phase: "pre-planning",
        trigger: "TCWG identification",
        mandatoryControls: ["TCWG identification", "Planning communication letter"],
        autoFetchSources: ["Governance structure records", "Prior year TCWG communications"],
        dependencyRules: ["Required before planning phase", "Links to ISA 260 finalization communication"]
      },
      {
        phase: "finalization",
        trigger: "Audit completion",
        mandatoryControls: ["Final TCWG communication letter", "Significant findings summary", "Independence confirmation"],
        autoFetchSources: ["ISA 450 misstatements", "ISA 265 control deficiencies", "ISA 570 going concern conclusions"],
        dependencyRules: ["Requires ISA 450 evaluation complete", "Requires ISA 265 deficiencies identified", "Must be issued before audit report"]
      }
    ]
  },
  {
    standardId: "ISA_260_FINAL",
    standardName: "ISA 260 (Final)",
    title: "Communication with Those Charged with Governance — Final Communication",
    phase: "finalization",
    subTab: "tcwg-final",
    subTabLabel: "TCWG Final Communication",
    objective: "Communicate significant audit findings, uncorrected misstatements, control deficiencies, and other required matters to those charged with governance upon audit completion.",
    requiredEvidence: [
      "Final TCWG communication letter",
      "Summary of significant audit findings",
      "Uncorrected misstatements communication",
      "Independence confirmation to TCWG",
      "Control deficiencies communication"
    ],
    outputs: [
      "WP-260F: Final TCWG Communication Letter",
      "WP-260F-A: Significant Findings Summary for TCWG"
    ],
    roleApprovals: { preparer: "AUDIT_MANAGER", reviewer: "ENGAGEMENT_PARTNER", approver: "ENGAGEMENT_PARTNER" },
    isStageGate: false,
    noReportBlocker: false,
    category: "Reporting",
    phaseMapping: [
      {
        phase: "finalization",
        trigger: "Audit completion and opinion formation",
        mandatoryControls: ["Final communication letter", "Significant findings summary"],
        autoFetchSources: ["ISA 450 misstatements", "ISA 265 control deficiencies", "ISA 570 going concern"],
        dependencyRules: ["Requires ISA 450 evaluation", "Must precede audit report issuance"]
      }
    ]
  },
  {
    standardId: "ISA_265",
    standardName: "ISA 265",
    title: "Communicating Deficiencies in Internal Control to Those Charged with Governance and Management",
    phase: "execution",
    subTab: "deficiencies",
    subTabLabel: "Control Deficiencies",
    objective: "Communicate appropriately to those charged with governance and management deficiencies in internal control that the auditor has identified during the audit and that are of sufficient importance to merit attention.",
    requiredEvidence: [
      "Internal control deficiency evaluation workpaper",
      "Significance assessment of each deficiency",
      "Management letter draft",
      "TCWG deficiency communication letter"
    ],
    outputs: [
      "WP-265: Internal Control Deficiencies Schedule",
      "WP-265A: Management Letter (Draft)"
    ],
    roleApprovals: { preparer: "AUDIT_SENIOR", reviewer: "AUDIT_MANAGER", approver: "ENGAGEMENT_PARTNER" },
    isStageGate: false,
    noReportBlocker: false,
    category: "Responses & Fieldwork",
    phaseMapping: [
      {
        phase: "execution",
        trigger: "Control testing completion",
        mandatoryControls: ["Deficiency evaluation workpaper", "Significance assessment"],
        autoFetchSources: ["Control test results", "ISA 315 control evaluations"],
        dependencyRules: ["Feeds into ISA 260 final TCWG communication", "Management letter draft required before finalization"]
      }
    ]
  },
  {
    standardId: "ISA_300",
    standardName: "ISA 300",
    title: "Planning an Audit of Financial Statements",
    phase: "planning",
    subTab: "strategy-approach",
    subTabLabel: "Audit Strategy & Approach",
    objective: "Establish the overall audit strategy and develop an audit plan that sets the scope, timing, and direction of the audit to ensure it is performed in an effective manner.",
    requiredEvidence: [
      "Overall audit strategy document",
      "Detailed audit plan",
      "Resource allocation schedule",
      "Timetable and key dates",
      "Direction and supervision memorandum"
    ],
    outputs: [
      "WP-300: Overall Audit Strategy",
      "WP-300A: Detailed Audit Plan",
      "WP-300B: Audit Timetable & Resource Plan"
    ],
    roleApprovals: { preparer: "AUDIT_MANAGER", reviewer: "ENGAGEMENT_PARTNER", approver: "ENGAGEMENT_PARTNER" },
    isStageGate: true,
    noReportBlocker: false,
    category: "Planning",
    phaseMapping: [
      {
        phase: "planning",
        trigger: "Pre-planning phase completion",
        mandatoryControls: ["Audit strategy document", "Detailed audit plan", "Resource allocation"],
        autoFetchSources: ["ISA 210 engagement terms", "Prior year strategy", "Client risk profile"],
        dependencyRules: ["Requires ISA 210 completion", "Must be approved before ISA 315 risk assessment"]
      }
    ]
  },
  {
    standardId: "ISA_315",
    standardName: "ISA 315",
    title: "Identifying and Assessing the Risks of Material Misstatement",
    phase: "planning",
    subTab: "risk-assessment",
    subTabLabel: "Risk Assessment",
    objective: "Identify and assess the risks of material misstatement, whether due to fraud or error, at the financial statement and assertion levels through understanding the entity and its environment, including internal control.",
    requiredEvidence: [
      "Entity and environment understanding memorandum",
      "Industry and regulatory analysis",
      "Internal control evaluation (entity-level and process-level)",
      "IT general controls assessment",
      "Risk assessment matrix (inherent and control risk)",
      "Significant risk identification schedule"
    ],
    outputs: [
      "WP-315: Risk Assessment Memorandum",
      "WP-315A: Understanding the Entity & Environment",
      "WP-315B: Internal Control Evaluation",
      "WP-315C: Risk Assessment Matrix",
      "WP-315D: Significant Risks Schedule"
    ],
    roleApprovals: { preparer: "AUDIT_SENIOR", reviewer: "AUDIT_MANAGER", approver: "ENGAGEMENT_PARTNER" },
    isStageGate: true,
    noReportBlocker: true,
    category: "Risk Assessment",
    phaseMapping: [
      {
        phase: "planning",
        trigger: "Audit strategy approval",
        mandatoryControls: ["Entity understanding memo", "Risk assessment matrix", "Significant risks schedule", "Internal control evaluation"],
        autoFetchSources: ["Trial balance data", "Prior year risk assessment", "Industry benchmarks", "IT environment data"],
        dependencyRules: ["Requires ISA 300 strategy", "Feeds into ISA 330 responses", "Links to ISA 240 fraud risks"]
      }
    ]
  },
  {
    standardId: "ISA_320",
    standardName: "ISA 320",
    title: "Materiality in Planning and Performing an Audit",
    phase: "planning",
    subTab: "materiality",
    subTabLabel: "Materiality Determination",
    objective: "Determine materiality for the financial statements as a whole and performance materiality, applying these in planning and performing the audit, and revising as necessary.",
    requiredEvidence: [
      "Materiality calculation workpaper",
      "Benchmark selection rationale",
      "Performance materiality determination",
      "Trivial threshold calculation",
      "Component materiality (if applicable)"
    ],
    outputs: [
      "WP-320: Materiality Determination Memorandum",
      "WP-320A: Materiality Calculation Workpaper"
    ],
    roleApprovals: { preparer: "AUDIT_SENIOR", reviewer: "AUDIT_MANAGER", approver: "ENGAGEMENT_PARTNER" },
    isStageGate: true,
    noReportBlocker: false,
    category: "Planning",
    phaseMapping: [
      {
        phase: "planning",
        trigger: "Financial data availability",
        mandatoryControls: ["Materiality calculation", "Benchmark rationale", "Performance materiality"],
        autoFetchSources: ["Trial balance totals", "Prior year materiality", "Financial statements"],
        dependencyRules: ["Required for ISA 330 scope determination", "Feeds into ISA 450 misstatement evaluation", "Links to ISA 530 sampling"]
      }
    ]
  },
  {
    standardId: "ISA_330",
    standardName: "ISA 330",
    title: "The Auditor's Responses to Assessed Risks",
    phase: "planning",
    subTab: "audit-program",
    subTabLabel: "Audit Program",
    objective: "Design and implement overall responses to the assessed risks of material misstatement at the financial statement level, and further audit procedures at the assertion level to respond to assessed risks.",
    requiredEvidence: [
      "Overall response to assessed risks memorandum",
      "Detailed audit program per significant area",
      "Nature, timing, and extent of planned procedures",
      "Tests of controls design (where applicable)",
      "Substantive procedures design"
    ],
    outputs: [
      "WP-330: Responses to Assessed Risks Memorandum",
      "WP-330A: Detailed Audit Program",
      "WP-330B: Tests of Controls Program",
      "WP-330C: Substantive Procedures Program"
    ],
    roleApprovals: { preparer: "AUDIT_SENIOR", reviewer: "AUDIT_MANAGER", approver: "ENGAGEMENT_PARTNER" },
    isStageGate: true,
    noReportBlocker: true,
    category: "Responses & Fieldwork",
    phaseMapping: [
      {
        phase: "planning",
        trigger: "ISA 315 risk assessment completion",
        mandatoryControls: ["Overall response memo", "Detailed audit program", "Substantive procedures design"],
        autoFetchSources: ["ISA 315 risk matrix", "ISA 320 materiality", "Prior year audit program"],
        dependencyRules: ["Requires ISA 315 and ISA 320", "Drives execution phase procedures", "Links to ISA 500 evidence requirements"]
      }
    ]
  },
  {
    standardId: "ISA_402",
    standardName: "ISA 402",
    title: "Audit Considerations Relating to an Entity Using a Service Organization",
    phase: "planning",
    subTab: "control-pack",
    subTabLabel: "Controls & Service Organisations",
    objective: "Obtain sufficient appropriate audit evidence when the entity uses services of a service organization, including understanding the nature and significance of services provided and their effect on internal control.",
    requiredEvidence: [
      "Service organization identification schedule",
      "Type 1 or Type 2 report evaluation",
      "Complementary user entity controls assessment",
      "Impact on audit strategy documentation"
    ],
    outputs: [
      "WP-402: Service Organization Assessment",
      "WP-402A: SOC Report Evaluation Workpaper"
    ],
    roleApprovals: { preparer: "AUDIT_SENIOR", reviewer: "AUDIT_MANAGER", approver: "ENGAGEMENT_PARTNER" },
    isStageGate: false,
    noReportBlocker: false,
    category: "Risk Assessment",
    phaseMapping: [
      {
        phase: "planning",
        trigger: "Service organization identified during ISA 315",
        mandatoryControls: ["Service org identification", "SOC report evaluation"],
        autoFetchSources: ["ISA 315 entity understanding", "SOC reports from service organizations"],
        dependencyRules: ["Conditional — only required if service organizations are used", "Feeds into ISA 330 control reliance decisions"]
      }
    ]
  },
  {
    standardId: "ISA_450",
    standardName: "ISA 450",
    title: "Evaluation of Misstatements Identified During the Audit",
    phase: "execution",
    subTab: "misstatements",
    subTabLabel: "Misstatements Evaluation",
    objective: "Evaluate the effect of identified misstatements on the audit and the effect of uncorrected misstatements on the financial statements, communicating appropriately with management and TCWG.",
    requiredEvidence: [
      "Schedule of unadjusted differences (SUD)",
      "Schedule of adjusted differences",
      "Aggregate misstatement analysis against materiality",
      "Management representation on uncorrected misstatements",
      "TCWG communication on uncorrected misstatements"
    ],
    outputs: [
      "WP-450: Misstatements Summary & Evaluation",
      "WP-450A: Schedule of Unadjusted Differences",
      "WP-450B: Schedule of Adjusted Differences"
    ],
    roleApprovals: { preparer: "AUDIT_SENIOR", reviewer: "AUDIT_MANAGER", approver: "ENGAGEMENT_PARTNER" },
    isStageGate: true,
    noReportBlocker: true,
    category: "Completion",
    phaseMapping: [
      {
        phase: "execution",
        trigger: "Misstatements identified during testing",
        mandatoryControls: ["SUD schedule", "Aggregate analysis against materiality"],
        autoFetchSources: ["Testing workpapers", "ISA 320 materiality thresholds"],
        dependencyRules: ["Accumulates throughout execution", "Feeds into ISA 700 opinion formation"]
      },
      {
        phase: "finalization",
        trigger: "Execution phase completion",
        mandatoryControls: ["Final SUD evaluation", "Management representation on uncorrected misstatements", "TCWG communication"],
        autoFetchSources: ["All testing results", "ISA 320 materiality", "ISA 580 management representations"],
        dependencyRules: ["Must be finalized before ISA 700 opinion", "Links to ISA 580 representations", "Links to ISA 260 TCWG communication"]
      }
    ]
  },
  {
    standardId: "ISA_450_FINAL",
    standardName: "ISA 450 (Final)",
    title: "Evaluation of Misstatements — Final Assessment",
    phase: "finalization",
    subTab: "misstatements-final",
    subTabLabel: "Misstatements Final Evaluation",
    objective: "Perform final evaluation of aggregate uncorrected misstatements against materiality and determine their effect on the auditor's opinion.",
    requiredEvidence: [
      "Final SUD evaluation against materiality",
      "Qualitative misstatement assessment",
      "Management response to uncorrected misstatements",
      "Impact on opinion assessment"
    ],
    outputs: [
      "WP-450F: Final Misstatements Evaluation",
      "WP-450F-A: Impact on Opinion Assessment"
    ],
    roleApprovals: { preparer: "AUDIT_SENIOR", reviewer: "AUDIT_MANAGER", approver: "ENGAGEMENT_PARTNER" },
    isStageGate: true,
    noReportBlocker: true,
    category: "Completion",
    phaseMapping: [
      {
        phase: "finalization",
        trigger: "All testing procedures completed",
        mandatoryControls: ["Final SUD evaluation", "Impact on opinion assessment"],
        autoFetchSources: ["ISA 450 execution misstatements", "ISA 320 materiality"],
        dependencyRules: ["Must be completed before ISA 700 opinion", "Links to ISA 580 management representations"]
      }
    ]
  },
  {
    standardId: "ISA_500",
    standardName: "ISA 500",
    title: "Audit Evidence",
    phase: "execution",
    subTab: "audit-evidence",
    subTabLabel: "Audit Evidence & Documentation",
    objective: "Design and perform audit procedures to obtain sufficient appropriate audit evidence to draw reasonable conclusions on which to base the auditor's opinion.",
    requiredEvidence: [
      "Evidence sufficiency and appropriateness evaluation",
      "Source document verification records",
      "Information produced by the entity reliability assessment",
      "Evidence matrix linking assertions to procedures"
    ],
    outputs: [
      "WP-500: Audit Evidence Evaluation Summary",
      "WP-500A: Evidence Sufficiency Matrix"
    ],
    roleApprovals: { preparer: "AUDIT_ASSOCIATE", reviewer: "AUDIT_SENIOR", approver: "AUDIT_MANAGER" },
    isStageGate: false,
    noReportBlocker: false,
    category: "Responses & Fieldwork",
    phaseMapping: [
      {
        phase: "execution",
        trigger: "Fieldwork commencement",
        mandatoryControls: ["Evidence sufficiency evaluation", "Evidence matrix"],
        autoFetchSources: ["ISA 330 audit program", "Source documents"],
        dependencyRules: ["Driven by ISA 330 procedures", "Feeds into ISA 700 opinion basis"]
      }
    ]
  },
  {
    standardId: "ISA_501",
    standardName: "ISA 501",
    title: "Audit Evidence — Specific Considerations for Selected Items",
    phase: "execution",
    subTab: "audit-evidence",
    subTabLabel: "Audit Evidence & Documentation",
    objective: "Obtain sufficient appropriate audit evidence regarding specific financial statement items including inventory, litigation and claims, and segment information.",
    requiredEvidence: [
      "Inventory observation plan and report",
      "Litigation and claims inquiry responses",
      "Legal confirmation letters",
      "Segment information analysis"
    ],
    outputs: [
      "WP-501: Specific Items Evidence Workpaper",
      "WP-501A: Inventory Observation Report",
      "WP-501B: Litigation & Claims Summary"
    ],
    roleApprovals: { preparer: "AUDIT_ASSOCIATE", reviewer: "AUDIT_SENIOR", approver: "AUDIT_MANAGER" },
    isStageGate: false,
    noReportBlocker: false,
    category: "Responses & Fieldwork",
    phaseMapping: [
      {
        phase: "execution",
        trigger: "Specific items identified in audit program",
        mandatoryControls: ["Inventory observation (if applicable)", "Litigation inquiry"],
        autoFetchSources: ["ISA 330 audit program", "Legal counsel responses"],
        dependencyRules: ["Conditional based on entity characteristics", "Links to ISA 505 confirmations"]
      }
    ]
  },
  {
    standardId: "ISA_505",
    standardName: "ISA 505",
    title: "External Confirmations",
    phase: "execution",
    subTab: "audit-evidence",
    subTabLabel: "Audit Evidence & Documentation",
    objective: "Design and perform external confirmation procedures to obtain relevant and reliable audit evidence, maintaining control over the confirmation process.",
    requiredEvidence: [
      "Confirmation control schedule",
      "Bank confirmation letters and responses",
      "Receivables/payables confirmation letters and responses",
      "Legal counsel confirmation responses",
      "Alternative procedures for non-responses"
    ],
    outputs: [
      "WP-505: External Confirmations Control Log",
      "WP-505A: Bank Confirmations Workpaper",
      "WP-505B: Third-Party Confirmations Workpaper"
    ],
    roleApprovals: { preparer: "AUDIT_ASSOCIATE", reviewer: "AUDIT_SENIOR", approver: "AUDIT_MANAGER" },
    isStageGate: false,
    noReportBlocker: false,
    category: "Responses & Fieldwork",
    phaseMapping: [
      {
        phase: "execution",
        trigger: "Confirmation dispatch date per audit plan",
        mandatoryControls: ["Confirmation control schedule", "Bank confirmations"],
        autoFetchSources: ["ISA 330 audit program", "Client bank and third-party lists"],
        dependencyRules: ["Timing critical — dispatch near year-end", "Alternative procedures for non-responses required"]
      }
    ]
  },
  {
    standardId: "ISA_510",
    standardName: "ISA 510",
    title: "Initial Audit Engagements — Opening Balances",
    phase: "pre-planning",
    subTab: "opening-balances",
    subTabLabel: "Opening Balances",
    objective: "Obtain sufficient appropriate audit evidence about whether opening balances contain misstatements that materially affect the current period's financial statements, and verify consistency of accounting policies.",
    requiredEvidence: [
      "Prior period auditor's report review",
      "Opening balance verification workpaper",
      "Accounting policy consistency assessment",
      "Predecessor auditor communication (if applicable)"
    ],
    outputs: [
      "WP-510: Opening Balances Assessment",
      "WP-510A: Prior Period Comparison Workpaper"
    ],
    roleApprovals: { preparer: "AUDIT_SENIOR", reviewer: "AUDIT_MANAGER", approver: "ENGAGEMENT_PARTNER" },
    isStageGate: false,
    noReportBlocker: false,
    category: "Pre-Engagement",
    phaseMapping: [
      {
        phase: "pre-planning",
        trigger: "Initial engagement or change of auditor",
        mandatoryControls: ["Opening balance verification", "Prior auditor communication"],
        autoFetchSources: ["Prior year financial statements", "Predecessor auditor files"],
        dependencyRules: ["Conditional — only for initial engagements", "Affects ISA 710 comparative information"]
      }
    ]
  },
  {
    standardId: "ISA_520",
    standardName: "ISA 520",
    title: "Analytical Procedures",
    phase: "planning",
    subTab: "analytical-procedures",
    subTabLabel: "Analytical Procedures",
    objective: "Obtain relevant and reliable audit evidence through analytical procedures applied as risk assessment procedures, substantive procedures, and as overall review procedures near the end of the audit.",
    requiredEvidence: [
      "Preliminary analytical review workpaper",
      "Trend analysis and ratio calculations",
      "Expectation models and significant variance investigation",
      "Final analytical review procedures"
    ],
    outputs: [
      "WP-520: Analytical Procedures Workpaper",
      "WP-520A: Preliminary Analytical Review",
      "WP-520B: Final Analytical Review"
    ],
    roleApprovals: { preparer: "AUDIT_SENIOR", reviewer: "AUDIT_MANAGER", approver: "ENGAGEMENT_PARTNER" },
    isStageGate: false,
    noReportBlocker: false,
    category: "Responses & Fieldwork",
    phaseMapping: [
      {
        phase: "planning",
        trigger: "Financial data received",
        mandatoryControls: ["Preliminary analytical review", "Trend analysis"],
        autoFetchSources: ["Trial balance data", "Prior year financial statements", "Industry benchmarks"],
        dependencyRules: ["Informs ISA 315 risk assessment", "Preliminary review supports planning decisions"]
      },
      {
        phase: "execution",
        trigger: "Substantive testing phase",
        mandatoryControls: ["Substantive analytical procedures", "Final analytical review"],
        autoFetchSources: ["Updated trial balance", "Testing results", "Expectation models"],
        dependencyRules: ["Final review required near audit end", "Supports overall audit conclusions"]
      }
    ]
  },
  {
    standardId: "ISA_520_EXEC",
    standardName: "ISA 520 (Execution)",
    title: "Analytical Procedures — Substantive & Final Review",
    phase: "execution",
    subTab: "analytical-final",
    subTabLabel: "Final Analytical Review",
    objective: "Apply substantive analytical procedures during fieldwork and perform overall analytical review near the end of the audit to assess consistency of conclusions.",
    requiredEvidence: [
      "Substantive analytical procedures workpaper",
      "Final overall analytical review",
      "Variance investigation and resolution",
      "Conclusions from analytical review"
    ],
    outputs: [
      "WP-520E: Substantive Analytical Procedures",
      "WP-520E-A: Final Overall Analytical Review"
    ],
    roleApprovals: { preparer: "AUDIT_SENIOR", reviewer: "AUDIT_MANAGER", approver: "ENGAGEMENT_PARTNER" },
    isStageGate: false,
    noReportBlocker: false,
    category: "Responses & Fieldwork",
    phaseMapping: [
      {
        phase: "execution",
        trigger: "Substantive testing phase",
        mandatoryControls: ["Substantive analytical procedures", "Final analytical review"],
        autoFetchSources: ["Updated trial balance", "ISA 520 planning analytics", "Testing results"],
        dependencyRules: ["Final review required near audit completion", "Supports ISA 700 overall conclusions"]
      }
    ]
  },
  {
    standardId: "ISA_530",
    standardName: "ISA 530",
    title: "Audit Sampling",
    phase: "planning",
    subTab: "sampling",
    subTabLabel: "Audit Sampling",
    objective: "Provide a reasonable basis for the auditor to draw conclusions about the population from which the sample is selected, using statistical or non-statistical sampling methods.",
    requiredEvidence: [
      "Sampling methodology determination",
      "Sample size calculation workpaper",
      "Sample selection documentation",
      "Results evaluation and projection of misstatements"
    ],
    outputs: [
      "WP-530: Audit Sampling Plan",
      "WP-530A: Sample Size Calculation",
      "WP-530B: Sampling Results Evaluation"
    ],
    roleApprovals: { preparer: "AUDIT_SENIOR", reviewer: "AUDIT_MANAGER", approver: "ENGAGEMENT_PARTNER" },
    isStageGate: false,
    noReportBlocker: false,
    category: "Responses & Fieldwork",
    phaseMapping: [
      {
        phase: "planning",
        trigger: "ISA 330 audit program design",
        mandatoryControls: ["Sampling methodology", "Sample size calculation"],
        autoFetchSources: ["ISA 320 materiality", "ISA 330 audit program", "Population data"],
        dependencyRules: ["Requires ISA 320 materiality", "Sample design drives execution testing"]
      }
    ]
  },
  {
    standardId: "ISA_540",
    standardName: "ISA 540",
    title: "Auditing Accounting Estimates and Related Disclosures",
    phase: "planning",
    subTab: "accounting-estimates",
    subTabLabel: "Accounting Estimates",
    objective: "Obtain sufficient appropriate audit evidence about whether accounting estimates and related disclosures are reasonable in the context of the applicable financial reporting framework, including assessment of estimation uncertainty.",
    requiredEvidence: [
      "Accounting estimates identification schedule",
      "Estimation uncertainty spectrum analysis",
      "Management's methods, assumptions, and data evaluation",
      "Retrospective review of prior period estimates",
      "Specialist involvement assessment (if applicable)"
    ],
    outputs: [
      "WP-540: Accounting Estimates Assessment",
      "WP-540A: Estimates Risk & Uncertainty Analysis",
      "WP-540B: Retrospective Review of Prior Estimates"
    ],
    roleApprovals: { preparer: "AUDIT_SENIOR", reviewer: "AUDIT_MANAGER", approver: "ENGAGEMENT_PARTNER" },
    isStageGate: false,
    noReportBlocker: false,
    category: "Risk Assessment",
    phaseMapping: [
      {
        phase: "planning",
        trigger: "Entity understanding and risk assessment",
        mandatoryControls: ["Estimates identification", "Uncertainty spectrum analysis"],
        autoFetchSources: ["Financial statements", "Prior year estimates", "Specialist reports"],
        dependencyRules: ["Links to ISA 315 risk assessment", "May require ISA 620 expert involvement"]
      }
    ]
  },
  {
    standardId: "ISA_550",
    standardName: "ISA 550",
    title: "Related Parties",
    phase: "planning",
    subTab: "related-parties",
    subTabLabel: "Related Parties",
    objective: "Obtain sufficient appropriate audit evidence regarding the identification, accounting, and disclosure of related party relationships and transactions in accordance with the applicable financial reporting framework.",
    requiredEvidence: [
      "Related party identification questionnaire",
      "Management inquiry responses on related parties",
      "Related party transactions schedule",
      "Arm's length assessment for significant transactions",
      "Disclosure adequacy review"
    ],
    outputs: [
      "WP-550: Related Parties Memorandum",
      "WP-550A: Related Party Transactions Schedule",
      "WP-550B: Arm's Length Assessment"
    ],
    roleApprovals: { preparer: "AUDIT_SENIOR", reviewer: "AUDIT_MANAGER", approver: "ENGAGEMENT_PARTNER" },
    isStageGate: false,
    noReportBlocker: false,
    category: "Risk Assessment",
    phaseMapping: [
      {
        phase: "planning",
        trigger: "Entity understanding phase",
        mandatoryControls: ["Related party identification", "Transactions schedule"],
        autoFetchSources: ["Management inquiries", "Corporate records", "Prior year related party data"],
        dependencyRules: ["Links to ISA 315 entity understanding", "Affects ISA 240 fraud risk considerations"]
      }
    ]
  },
  {
    standardId: "ISA_560",
    standardName: "ISA 560",
    title: "Subsequent Events",
    phase: "finalization",
    subTab: "events",
    subTabLabel: "Subsequent Events",
    objective: "Obtain sufficient appropriate audit evidence about whether events occurring between the date of the financial statements and the date of the auditor's report are appropriately reflected in the financial statements.",
    requiredEvidence: [
      "Subsequent events review procedures checklist",
      "Management inquiry responses on subsequent events",
      "Board minutes review (post year-end)",
      "Post year-end financial data analysis",
      "Legal and regulatory developments review"
    ],
    outputs: [
      "WP-560: Subsequent Events Review Memorandum",
      "WP-560A: Subsequent Events Procedures Checklist"
    ],
    roleApprovals: { preparer: "AUDIT_SENIOR", reviewer: "AUDIT_MANAGER", approver: "ENGAGEMENT_PARTNER" },
    isStageGate: true,
    noReportBlocker: false,
    category: "Completion",
    phaseMapping: [
      {
        phase: "finalization",
        trigger: "Year-end date passed",
        mandatoryControls: ["Subsequent events checklist", "Board minutes review"],
        autoFetchSources: ["Post year-end financial data", "Board minutes", "Legal correspondence"],
        dependencyRules: ["Must be updated to date of auditor's report", "May affect ISA 700 opinion"]
      }
    ]
  },
  {
    standardId: "ISA_570",
    standardName: "ISA 570",
    title: "Going Concern",
    phase: "finalization",
    subTab: "going-concern",
    subTabLabel: "Going Concern",
    objective: "Obtain sufficient appropriate audit evidence and conclude on the appropriateness of management's use of the going concern basis of accounting and whether a material uncertainty exists related to events or conditions that may cast significant doubt.",
    requiredEvidence: [
      "Going concern assessment memorandum",
      "Management's going concern evaluation review",
      "Cash flow forecast analysis",
      "Financial covenant compliance assessment",
      "Events and conditions evaluation (ISA 570 indicators)"
    ],
    outputs: [
      "WP-570: Going Concern Assessment",
      "WP-570A: Going Concern Indicators Checklist",
      "WP-570B: Management's Going Concern Evaluation Review"
    ],
    roleApprovals: { preparer: "AUDIT_SENIOR", reviewer: "AUDIT_MANAGER", approver: "ENGAGEMENT_PARTNER" },
    isStageGate: true,
    noReportBlocker: true,
    category: "Completion",
    phaseMapping: [
      {
        phase: "planning",
        trigger: "Entity understanding and risk assessment",
        mandatoryControls: ["Preliminary going concern indicators review", "Initial assessment of GC risk"],
        autoFetchSources: ["Financial statements", "ISA 315 risk assessment", "Industry conditions"],
        dependencyRules: ["Initial assessment during planning", "Significant risks may be identified"]
      },
      {
        phase: "finalization",
        trigger: "Audit evidence evaluation completion",
        mandatoryControls: ["Going concern assessment memo", "Management evaluation review", "Cash flow forecast analysis"],
        autoFetchSources: ["Updated financial data", "Management forecasts", "Covenant compliance data"],
        dependencyRules: ["Must be completed before ISA 700 opinion", "May trigger ISA 705 modification", "Links to ISA 580 representations"]
      }
    ]
  },
  {
    standardId: "ISA_570_PLAN",
    standardName: "ISA 570 (Planning)",
    title: "Going Concern — Preliminary Assessment",
    phase: "planning",
    subTab: "going-concern-plan",
    subTabLabel: "Going Concern Planning",
    objective: "Perform preliminary assessment of going concern indicators during the planning phase to identify potential material uncertainties early and plan appropriate audit responses.",
    requiredEvidence: [
      "Preliminary going concern indicators checklist",
      "Initial financial health assessment",
      "Industry and economic conditions review",
      "Management's initial going concern representations"
    ],
    outputs: [
      "WP-570P: Preliminary Going Concern Assessment",
      "WP-570P-A: Going Concern Indicators (Planning Phase)"
    ],
    roleApprovals: { preparer: "AUDIT_SENIOR", reviewer: "AUDIT_MANAGER", approver: "ENGAGEMENT_PARTNER" },
    isStageGate: false,
    noReportBlocker: false,
    category: "Risk Assessment",
    phaseMapping: [
      {
        phase: "planning",
        trigger: "Risk assessment during planning",
        mandatoryControls: ["Preliminary GC indicators checklist", "Initial financial health assessment"],
        autoFetchSources: ["Financial statements", "ISA 315 risk assessment", "Industry data"],
        dependencyRules: ["Informs ISA 315 risk assessment", "Drives ISA 570 finalization procedures"]
      }
    ]
  },
  {
    standardId: "ISA_580",
    standardName: "ISA 580",
    title: "Written Representations",
    phase: "finalization",
    subTab: "written-representations",
    subTabLabel: "Written Representations",
    objective: "Obtain written representations from management and, where appropriate, those charged with governance confirming matters material to the financial statements and audit completion.",
    requiredEvidence: [
      "Management representation letter (signed)",
      "TCWG representation letter (if required)",
      "Specific representations for significant matters",
      "Representations adequacy assessment"
    ],
    outputs: [
      "WP-580: Written Representations Memorandum",
      "WP-580A: Management Representation Letter"
    ],
    roleApprovals: { preparer: "AUDIT_MANAGER", reviewer: "ENGAGEMENT_PARTNER", approver: "ENGAGEMENT_PARTNER" },
    isStageGate: true,
    noReportBlocker: true,
    category: "Completion",
    phaseMapping: [
      {
        phase: "finalization",
        trigger: "Near audit completion",
        mandatoryControls: ["Signed management representation letter", "Representations adequacy assessment"],
        autoFetchSources: ["All significant matters from audit", "ISA 450 uncorrected misstatements", "ISA 570 going concern"],
        dependencyRules: ["Must be dated on or near audit report date", "Blocks ISA 700 opinion if not obtained", "Required for ISA 450 uncorrected misstatements acknowledgement"]
      }
    ]
  },
  {
    standardId: "ISA_600",
    standardName: "ISA 600",
    title: "Special Considerations — Audits of Group Financial Statements (Including the Work of Component Auditors)",
    phase: "planning",
    subTab: "group-audits",
    subTabLabel: "Group Audit Considerations",
    objective: "Determine whether to act as auditor of the group financial statements, plan and perform the group audit including directing, supervising, and reviewing the work of component auditors.",
    requiredEvidence: [
      "Group structure and component identification",
      "Component materiality allocation",
      "Component auditor evaluation and instructions",
      "Consolidation procedures documentation",
      "Inter-company transaction elimination schedule"
    ],
    outputs: [
      "WP-600: Group Audit Planning Memorandum",
      "WP-600A: Component Auditor Instructions",
      "WP-600B: Group Consolidation Workpaper"
    ],
    roleApprovals: { preparer: "AUDIT_MANAGER", reviewer: "ENGAGEMENT_PARTNER", approver: "ENGAGEMENT_PARTNER" },
    isStageGate: false,
    noReportBlocker: false,
    category: "Planning",
    phaseMapping: [
      {
        phase: "planning",
        trigger: "Group audit determination",
        mandatoryControls: ["Group structure identification", "Component materiality", "Component auditor instructions"],
        autoFetchSources: ["Group structure data", "Component financial data", "Prior year group audit files"],
        dependencyRules: ["Conditional — only for group audits", "Requires ISA 320 group materiality", "Component auditor work feeds into ISA 700"]
      }
    ]
  },
  {
    standardId: "ISA_610",
    standardName: "ISA 610",
    title: "Using the Work of Internal Auditors",
    phase: "planning",
    subTab: "experts",
    subTabLabel: "Internal Auditors & Experts",
    objective: "Determine whether and to what extent the work of the internal audit function can be used, and whether internal auditors can provide direct assistance under the direction and supervision of the external auditor.",
    requiredEvidence: [
      "Internal audit function evaluation",
      "Objectivity and competence assessment",
      "Work of internal auditors utilisation plan",
      "Direct assistance agreement (if applicable)"
    ],
    outputs: [
      "WP-610: Internal Audit Function Assessment",
      "WP-610A: Internal Audit Work Utilisation Plan"
    ],
    roleApprovals: { preparer: "AUDIT_SENIOR", reviewer: "AUDIT_MANAGER", approver: "ENGAGEMENT_PARTNER" },
    isStageGate: false,
    noReportBlocker: false,
    category: "Planning",
    phaseMapping: [
      {
        phase: "planning",
        trigger: "Internal audit function identified",
        mandatoryControls: ["IA function evaluation", "Objectivity assessment"],
        autoFetchSources: ["Internal audit reports", "IA function charter"],
        dependencyRules: ["Conditional — only if internal audit exists", "Affects ISA 330 reliance decisions"]
      }
    ]
  },
  {
    standardId: "ISA_620",
    standardName: "ISA 620",
    title: "Using the Work of an Auditor's Expert",
    phase: "planning",
    subTab: "experts",
    subTabLabel: "Internal Auditors & Experts",
    objective: "Determine whether to use the work of an auditor's expert and, if so, evaluate the competence, capability, and objectivity of the expert and the adequacy of the expert's work for audit purposes.",
    requiredEvidence: [
      "Expert necessity determination memorandum",
      "Expert competence and objectivity evaluation",
      "Agreed terms of engagement with expert",
      "Expert's work evaluation and conclusions"
    ],
    outputs: [
      "WP-620: Auditor's Expert Assessment",
      "WP-620A: Expert Engagement Terms & Evaluation"
    ],
    roleApprovals: { preparer: "AUDIT_SENIOR", reviewer: "AUDIT_MANAGER", approver: "ENGAGEMENT_PARTNER" },
    isStageGate: false,
    noReportBlocker: false,
    category: "Planning",
    phaseMapping: [
      {
        phase: "planning",
        trigger: "Expert need identified during risk assessment",
        mandatoryControls: ["Expert necessity determination", "Competence evaluation"],
        autoFetchSources: ["ISA 540 estimates assessment", "Specialist engagement terms"],
        dependencyRules: ["Conditional — only if expert required", "Links to ISA 540 for accounting estimates"]
      }
    ]
  },
  {
    standardId: "ISA_700",
    standardName: "ISA 700",
    title: "Forming an Opinion and Reporting on Financial Statements",
    phase: "finalization",
    subTab: "reporting-opinion",
    subTabLabel: "Audit Report & Opinion",
    objective: "Form an opinion on the financial statements based on evaluation of conclusions drawn from audit evidence obtained, and express that opinion clearly through a written report.",
    requiredEvidence: [
      "Audit completion checklist",
      "Financial statements review and tie-out",
      "Disclosure checklist compliance",
      "Opinion formation memorandum",
      "Draft auditor's report"
    ],
    outputs: [
      "WP-700: Opinion Formation Memorandum",
      "WP-700A: Audit Report (Draft)",
      "WP-700B: Financial Statements Tie-Out"
    ],
    roleApprovals: { preparer: "AUDIT_MANAGER", reviewer: "ENGAGEMENT_PARTNER", approver: "ENGAGEMENT_PARTNER" },
    isStageGate: true,
    noReportBlocker: true,
    category: "Reporting",
    phaseMapping: [
      {
        phase: "finalization",
        trigger: "All audit procedures completed",
        mandatoryControls: ["Completion checklist", "FS review and tie-out", "Opinion formation memo", "Draft report"],
        autoFetchSources: ["All working papers", "ISA 450 misstatements", "ISA 570 going concern", "ISA 580 representations"],
        dependencyRules: ["Requires ISA 315+330 risk responses complete", "Requires ISA 450 misstatements evaluated", "Requires ISA 570 going concern assessed", "Requires ISA 580 representations obtained", "Links to ISA 705 for modifications"]
      }
    ]
  },
  {
    standardId: "ISA_701",
    standardName: "ISA 701",
    title: "Communicating Key Audit Matters in the Independent Auditor's Report",
    phase: "finalization",
    subTab: "reporting-opinion",
    subTabLabel: "Audit Report & Opinion",
    objective: "Determine key audit matters from matters communicated with TCWG and describe them in the auditor's report to provide additional information to users about matters of most significance.",
    requiredEvidence: [
      "Key audit matters determination workpaper",
      "TCWG communication linkage to KAMs",
      "KAM descriptions (draft for report)",
      "Sensitive disclosures assessment"
    ],
    outputs: [
      "WP-701: Key Audit Matters Memorandum",
      "WP-701A: KAM Determination & Description Workpaper"
    ],
    roleApprovals: { preparer: "AUDIT_MANAGER", reviewer: "ENGAGEMENT_PARTNER", approver: "ENGAGEMENT_PARTNER" },
    isStageGate: false,
    noReportBlocker: false,
    category: "Reporting",
    phaseMapping: [
      {
        phase: "finalization",
        trigger: "TCWG communications finalized",
        mandatoryControls: ["KAM determination workpaper", "KAM descriptions"],
        autoFetchSources: ["ISA 260 TCWG communications", "ISA 315 significant risks", "Audit findings"],
        dependencyRules: ["Required for listed entity audits", "Links to ISA 260 TCWG matters", "Included in ISA 700 audit report"]
      }
    ]
  },
  {
    standardId: "ISA_705",
    standardName: "ISA 705",
    title: "Modifications to the Opinion in the Independent Auditor's Report",
    phase: "finalization",
    subTab: "reporting-opinion",
    subTabLabel: "Audit Report & Opinion",
    objective: "Determine the appropriate form of modification to the auditor's opinion when the auditor concludes that the financial statements are materially misstated or is unable to obtain sufficient appropriate evidence.",
    requiredEvidence: [
      "Modification assessment memorandum",
      "Nature and pervasiveness evaluation",
      "Basis for modification documentation",
      "Communication with TCWG on modification"
    ],
    outputs: [
      "WP-705: Opinion Modification Assessment",
      "WP-705A: Modified Auditor's Report (Draft)"
    ],
    roleApprovals: { preparer: "AUDIT_MANAGER", reviewer: "ENGAGEMENT_PARTNER", approver: "ENGAGEMENT_PARTNER" },
    isStageGate: true,
    noReportBlocker: false,
    category: "Reporting",
    phaseMapping: [
      {
        phase: "finalization",
        trigger: "ISA 700 opinion formation identifies modification need",
        mandatoryControls: ["Modification assessment memo", "Nature and pervasiveness evaluation"],
        autoFetchSources: ["ISA 700 opinion formation", "ISA 450 misstatements", "ISA 570 going concern"],
        dependencyRules: ["Conditional — only if modification required", "Links to ISA 700 reporting"]
      }
    ]
  },
  {
    standardId: "ISA_706",
    standardName: "ISA 706",
    title: "Emphasis of Matter Paragraphs and Other Matter Paragraphs in the Independent Auditor's Report",
    phase: "finalization",
    subTab: "reporting-opinion",
    subTabLabel: "Audit Report & Opinion",
    objective: "Draw users' attention to matters presented or disclosed in the financial statements that are of such importance as to be fundamental to their understanding, or to communicate other matters relevant to the audit.",
    requiredEvidence: [
      "Emphasis of matter / other matter evaluation",
      "Appropriateness of disclosure assessment",
      "Draft paragraphs for auditor's report"
    ],
    outputs: [
      "WP-706: Emphasis of Matter / Other Matter Assessment"
    ],
    roleApprovals: { preparer: "AUDIT_MANAGER", reviewer: "ENGAGEMENT_PARTNER", approver: "ENGAGEMENT_PARTNER" },
    isStageGate: false,
    noReportBlocker: false,
    category: "Reporting",
    phaseMapping: [
      {
        phase: "finalization",
        trigger: "ISA 700 opinion formation",
        mandatoryControls: ["EOM/OM evaluation"],
        autoFetchSources: ["ISA 700 opinion formation", "Financial statement disclosures"],
        dependencyRules: ["Conditional — only if EOM/OM needed", "Included in ISA 700 audit report"]
      }
    ]
  },
  {
    standardId: "ISA_708",
    standardName: "ISA 708",
    title: "The Auditor's Report on Special Purpose Financial Statements",
    phase: "finalization",
    subTab: "reporting-opinion",
    subTabLabel: "Audit Report & Opinion",
    objective: "Apply ISA requirements adapted to special purpose financial statements, including consideration of the acceptability of the applicable financial reporting framework and the form of the auditor's report.",
    requiredEvidence: [
      "Special purpose framework assessment",
      "Basis of accounting acceptability evaluation",
      "Restriction on distribution/use assessment",
      "Adapted audit report draft"
    ],
    outputs: [
      "WP-708: Special Purpose FS Report Assessment",
      "WP-708A: Adapted Auditor's Report (Draft)"
    ],
    roleApprovals: { preparer: "AUDIT_MANAGER", reviewer: "ENGAGEMENT_PARTNER", approver: "ENGAGEMENT_PARTNER" },
    isStageGate: false,
    noReportBlocker: false,
    category: "Reporting",
    phaseMapping: [
      {
        phase: "finalization",
        trigger: "Special purpose engagement identified",
        mandatoryControls: ["Framework assessment", "Distribution restriction assessment"],
        autoFetchSources: ["Engagement terms", "ISA 210 engagement letter"],
        dependencyRules: ["Conditional — only for special purpose audits", "Links to ISA 700 reporting requirements"]
      }
    ]
  },
  {
    standardId: "ISA_710",
    standardName: "ISA 710",
    title: "Comparative Information — Corresponding Figures and Comparative Financial Statements",
    phase: "finalization",
    subTab: "comparative-info",
    subTabLabel: "Comparative Information",
    objective: "Obtain sufficient appropriate audit evidence about whether the comparative information included in the financial statements is presented in accordance with the applicable financial reporting framework.",
    requiredEvidence: [
      "Comparative information consistency review",
      "Prior period adjustments assessment",
      "Predecessor auditor's report review (if applicable)",
      "Reclassification analysis"
    ],
    outputs: [
      "WP-710: Comparative Information Review Workpaper"
    ],
    roleApprovals: { preparer: "AUDIT_SENIOR", reviewer: "AUDIT_MANAGER", approver: "ENGAGEMENT_PARTNER" },
    isStageGate: false,
    noReportBlocker: false,
    category: "Completion",
    phaseMapping: [
      {
        phase: "finalization",
        trigger: "Financial statements review",
        mandatoryControls: ["Comparative consistency review", "Reclassification analysis"],
        autoFetchSources: ["Prior year financial statements", "Prior year auditor's report"],
        dependencyRules: ["Links to ISA 510 for initial engagements", "Affects ISA 700 report wording"]
      }
    ]
  },
  {
    standardId: "ISA_720",
    standardName: "ISA 720",
    title: "The Auditor's Responsibilities Relating to Other Information",
    phase: "finalization",
    subTab: "other-information",
    subTabLabel: "Other Information",
    objective: "Read and consider other information included in the annual report to identify material inconsistencies with the financial statements or the auditor's knowledge obtained during the audit.",
    requiredEvidence: [
      "Other information identification schedule",
      "Consistency review with audited financial statements",
      "Material misstatement of fact assessment",
      "Annual report review workpaper"
    ],
    outputs: [
      "WP-720: Other Information Review Memorandum",
      "WP-720A: Consistency Review Workpaper"
    ],
    roleApprovals: { preparer: "AUDIT_SENIOR", reviewer: "AUDIT_MANAGER", approver: "ENGAGEMENT_PARTNER" },
    isStageGate: false,
    noReportBlocker: false,
    category: "Reporting",
    phaseMapping: [
      {
        phase: "finalization",
        trigger: "Annual report availability",
        mandatoryControls: ["Other information identification", "Consistency review"],
        autoFetchSources: ["Annual report", "Audited financial statements"],
        dependencyRules: ["Must be completed before audit report date", "May affect ISA 700 report"]
      }
    ]
  },
  {
    standardId: "ISQM_1",
    standardName: "ISQM 1",
    title: "Quality Management for Firms that Perform Audits or Reviews of Financial Statements, or Other Assurance or Related Services Engagements",
    phase: "eqcr",
    subTab: "qc-checklist",
    subTabLabel: "Quality Management Checklist",
    objective: "Establish and maintain a system of quality management that provides the firm with reasonable assurance that the engagements performed are in accordance with professional standards and applicable requirements.",
    requiredEvidence: [
      "Firm quality management system documentation",
      "Risk assessment process (quality risks)",
      "Monitoring and remediation activities log",
      "Engagement quality review completion",
      "ISQM 1 compliance self-assessment"
    ],
    outputs: [
      "WP-ISQM1: Quality Management System Compliance Review",
      "WP-ISQM1A: Engagement Quality Review Checklist"
    ],
    roleApprovals: { preparer: "AUDIT_MANAGER", reviewer: "ENGAGEMENT_PARTNER", approver: "MANAGING_PARTNER" },
    isStageGate: true,
    noReportBlocker: false,
    category: "Quality Management",
    phaseMapping: [
      {
        phase: "eqcr",
        trigger: "Engagement quality review required",
        mandatoryControls: ["QMS documentation", "EQR completion", "ISQM 1 self-assessment"],
        autoFetchSources: ["Firm QMS records", "Monitoring activities", "Prior EQR findings"],
        dependencyRules: ["Links to ISA 220 engagement-level quality", "Required for listed entity audits", "Must be complete before report release"]
      }
    ]
  },
  {
    standardId: "IESBA_CODE",
    standardName: "IESBA Code",
    title: "International Code of Ethics for Professional Accountants (Including International Independence Standards)",
    phase: "pre-planning",
    subTab: "ethics",
    subTabLabel: "Ethics & Independence",
    objective: "Ensure compliance with fundamental principles of integrity, objectivity, professional competence and due care, confidentiality, and professional behavior, including independence requirements for assurance engagements.",
    requiredEvidence: [
      "Independence assessment and declaration",
      "Threats and safeguards evaluation",
      "Non-assurance services evaluation",
      "Fee dependency assessment",
      "Partner rotation compliance",
      "Conflicts of interest assessment"
    ],
    outputs: [
      "WP-IESBA: Ethics & Independence Compliance Memorandum",
      "WP-IESBA-A: Independence Declaration Schedule",
      "WP-IESBA-B: Threats & Safeguards Analysis"
    ],
    roleApprovals: { preparer: "AUDIT_MANAGER", reviewer: "ENGAGEMENT_PARTNER", approver: "MANAGING_PARTNER" },
    isStageGate: true,
    noReportBlocker: false,
    category: "Quality Management",
    phaseMapping: [
      {
        phase: "pre-planning",
        trigger: "Engagement acceptance/continuance",
        mandatoryControls: ["Independence assessment", "Threats evaluation", "Conflicts assessment"],
        autoFetchSources: ["Independence system", "Client records", "Fee records", "Partner rotation tracker"],
        dependencyRules: ["Must be completed before engagement acceptance", "Links to ISA 220 quality management", "Continuous monitoring required throughout engagement"]
      }
    ]
  }
];

export const PHASE_STAGE_GATES: Record<string, StageGateRequirement[]> = {
  "pre-planning": [
    { stepId: "ISA_210", label: "Engagement Terms Agreed (ISA 210)", required: true },
    { stepId: "ISA_220", label: "Quality Management Established (ISA 220)", required: true },
    { stepId: "PRE_PLAN_SIGNOFF", label: "Pre-Planning Phase Sign-Off", required: true }
  ],
  "planning": [
    { stepId: "ISA_300", label: "Audit Strategy & Plan Approved (ISA 300)", required: true },
    { stepId: "ISA_315", label: "Risk Assessment Completed (ISA 315)", required: true },
    { stepId: "ISA_320", label: "Materiality Determined (ISA 320)", required: true },
    { stepId: "ISA_330", label: "Responses to Risks Designed (ISA 330)", required: true },
    { stepId: "ISA_240", label: "Fraud Risk Assessment Completed (ISA 240)", required: true },
    { stepId: "PLANNING_SIGNOFF", label: "Planning Phase Sign-Off", required: true }
  ],
  "execution": [
    { stepId: "ISA_450", label: "Misstatements Evaluated (ISA 450)", required: true },
    { stepId: "EVIDENCE_SUFFICIENT", label: "Sufficient Appropriate Evidence Obtained", required: true },
    { stepId: "EXECUTION_SIGNOFF", label: "Execution Phase Sign-Off", required: true }
  ],
  "finalization": [
    { stepId: "ISA_560", label: "Subsequent Events Reviewed (ISA 560)", required: true },
    { stepId: "ISA_570", label: "Going Concern Assessed (ISA 570)", required: true },
    { stepId: "ISA_580", label: "Written Representations Obtained (ISA 580)", required: true },
    { stepId: "ISA_700", label: "Opinion Formed (ISA 700)", required: true },
    { stepId: "ISA_705", label: "Modification Assessment Completed (ISA 705)", required: true },
    { stepId: "FINALIZATION_SIGNOFF", label: "Finalization Phase Sign-Off", required: true }
  ],
  "deliverables": [
    { stepId: "REPORT_ISSUED", label: "Auditor's Report Issued", required: true },
    { stepId: "MANAGEMENT_LETTER", label: "Management Letter Issued", required: false },
    { stepId: "DELIVERABLES_SIGNOFF", label: "Deliverables Phase Sign-Off", required: true }
  ],
  "eqcr": [
    { stepId: "ISQM_1", label: "ISQM 1 Quality Review Completed", required: true },
    { stepId: "EQR_COMPLETED", label: "Engagement Quality Review Completed", required: true },
    { stepId: "EQCR_SIGNOFF", label: "EQCR Phase Sign-Off", required: true }
  ]
};

export const ALL_PHASES = [
  "pre-planning",
  "planning",
  "execution",
  "finalization",
  "deliverables",
  "eqcr"
] as const;

export type AuditPhase = typeof ALL_PHASES[number];

export const STANDARDS_BY_PHASE: Record<string, StandardConfig[]> = STANDARDS_MAP.reduce(
  (acc, standard) => {
    if (!acc[standard.phase]) {
      acc[standard.phase] = [];
    }
    acc[standard.phase].push(standard);
    return acc;
  },
  {} as Record<string, StandardConfig[]>
);

export function getStandardsForPhase(phase: string): StandardConfig[] {
  return STANDARDS_BY_PHASE[phase] || [];
}

export function getStandardById(standardId: string): StandardConfig | undefined {
  return STANDARDS_MAP.find(s => s.standardId === standardId);
}

export function getStandardsByCategory(category: string): StandardConfig[] {
  return STANDARDS_MAP.filter(s => s.category === category);
}

export function getStageGatesForPhase(phase: string): StageGateRequirement[] {
  return PHASE_STAGE_GATES[phase] || [];
}

export function getStandardsBySubTab(subTab: string): StandardConfig[] {
  return STANDARDS_MAP.filter(s => s.subTab === subTab);
}

export function getNoReportBlockerStandards(): StandardConfig[] {
  return STANDARDS_MAP.filter(s => s.noReportBlocker);
}

export function getStandardsIntegrationMatrix(phase: string): {
  standard: StandardConfig;
  phaseDetail: PhaseMapping;
}[] {
  const results: { standard: StandardConfig; phaseDetail: PhaseMapping }[] = [];
  for (const standard of STANDARDS_MAP) {
    for (const pm of standard.phaseMapping) {
      if (pm.phase === phase) {
        results.push({ standard, phaseDetail: pm });
      }
    }
  }
  return results;
}

export function getAllPhases(): string[] {
  return [...ALL_PHASES];
}

export function getMultiPhaseStandards(): StandardConfig[] {
  return STANDARDS_MAP.filter(s => s.phaseMapping.length > 1);
}

export function getStandardsWithPhaseMappings(phase: string): StandardConfig[] {
  return STANDARDS_MAP.filter(s =>
    s.phaseMapping.some(pm => pm.phase === phase)
  );
}
