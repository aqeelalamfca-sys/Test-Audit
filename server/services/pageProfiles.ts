export interface PageProfile {
  pageId: string;
  module: string;
  group: "onboarding" | "data" | "planning" | "fieldwork" | "completion" | "quality" | "reporting";
  objective: string;
  expectedOutputs: string[];
  inputSources: string[];
  relatedStandards: string[];
  commonMistakes: string[];
  requiredEvidence: string[];
  reviewRules: ReviewRule[];
  suggestionTemplates: SuggestionTemplate[];
  nextStepGuidance: string[];
  fieldHints: Record<string, FieldHint>;
}

export interface ReviewRule {
  id: string;
  condition: string;
  severity: "info" | "warning" | "critical";
  message: string;
  standardRef?: string;
}

export interface SuggestionTemplate {
  id: string;
  label: string;
  type: "fill_field" | "draft_narrative" | "review_section" | "generate_conclusion" | "suggest_evidence";
  targetField?: string;
  prompt: string;
}

export interface FieldHint {
  label: string;
  guidance: string;
  standardRef?: string;
  exampleValues?: string[];
}

export const PAGE_PROFILES: Record<string, PageProfile> = {
  "acceptance": {
    pageId: "acceptance",
    module: "Pre-Planning",
    group: "onboarding",
    objective: "Evaluate whether the firm should accept or continue the client relationship and the specific audit engagement based on professional, ethical, and practical considerations.",
    expectedOutputs: ["Acceptance decision with rationale", "Risk classification", "Independence confirmation", "Engagement letter or terms agreement"],
    inputSources: ["Client profile", "Industry data", "Prior engagement history", "Independence declarations", "AML/KYC checks"],
    relatedStandards: ["ISA_210", "ISA_220", "ISQM_1", "ICAP_ETHICS"],
    commonMistakes: [
      "Accepting engagement without documented risk assessment",
      "Missing independence evaluation for new team members",
      "No consideration of firm capacity and competence",
      "Failure to document reasons for continuance on recurring engagements",
      "Not updating terms of engagement for regulatory changes",
    ],
    requiredEvidence: ["Signed engagement letter", "Independence declarations", "AML/KYC documentation", "Continuance assessment for existing clients"],
    reviewRules: [
      { id: "acc-01", condition: "No acceptance decision recorded", severity: "critical", message: "Acceptance decision must be documented before proceeding with the engagement.", standardRef: "ISQM 1.30" },
      { id: "acc-02", condition: "Independence not confirmed", severity: "critical", message: "Independence assessment must be completed for all team members.", standardRef: "ICAP Code Part 4A" },
      { id: "acc-03", condition: "No engagement letter", severity: "warning", message: "Engagement terms should be agreed in writing before commencing audit work.", standardRef: "ISA 210.9" },
      { id: "acc-04", condition: "Risk classification missing", severity: "warning", message: "Client risk classification helps determine the level of partner involvement and EQCR requirements.", standardRef: "ISA 220.12" },
    ],
    suggestionTemplates: [
      { id: "acc-draft-rationale", label: "Draft Acceptance Rationale", type: "draft_narrative", targetField: "acceptanceRationale", prompt: "Draft a professional acceptance/continuance rationale for this client engagement based on the risk factors, independence assessment, and firm capacity." },
      { id: "acc-risk-summary", label: "Summarize Risk Factors", type: "draft_narrative", targetField: "riskSummary", prompt: "Summarize the key risk factors identified during the acceptance assessment, including client-specific, industry, and engagement-specific risks." },
    ],
    nextStepGuidance: [
      "After acceptance is approved, proceed to Independence & Ethics module to complete team declarations.",
      "Ensure engagement letter is signed before data import begins.",
      "Assign engagement team members before moving to planning.",
    ],
    fieldHints: {
      "decision": { label: "Acceptance Decision", guidance: "Select ACCEPT only after all pre-conditions are satisfied. Document rationale regardless of decision.", standardRef: "ISQM 1.30" },
      "riskClassification": { label: "Risk Classification", guidance: "HIGH risk engagements require partner involvement at planning, greater EQCR scrutiny, and lower materiality thresholds.", standardRef: "ISA 220.12" },
    },
  },

  "independence": {
    pageId: "independence",
    module: "Pre-Planning",
    group: "onboarding",
    objective: "Confirm that all team members are independent of the audit client and document the evaluation of threats to independence using the conceptual framework approach.",
    expectedOutputs: ["Independence declarations from all team members", "Threat evaluation and safeguards documentation", "Overall independence conclusion"],
    inputSources: ["Team member list", "Client relationships", "Financial interests", "Prior services provided"],
    relatedStandards: ["ICAP_ETHICS", "ISA_220", "ISQM_1"],
    commonMistakes: [
      "Not obtaining declarations from all team members including specialists",
      "Failing to identify self-review threats from prior non-audit services",
      "Not documenting safeguards applied to mitigate identified threats",
      "Using generic boilerplate instead of client-specific threat analysis",
    ],
    requiredEvidence: ["Signed independence declarations", "Threat register", "Safeguards documentation"],
    reviewRules: [
      { id: "ind-01", condition: "Missing declarations", severity: "critical", message: "All engagement team members must submit independence declarations.", standardRef: "ICAP Code R540.4" },
      { id: "ind-02", condition: "Unresolved threats", severity: "critical", message: "All identified threats must have documented safeguards or be eliminated.", standardRef: "ICAP Code Part 4A.1" },
    ],
    suggestionTemplates: [
      { id: "ind-threat-analysis", label: "Draft Threat Analysis", type: "draft_narrative", prompt: "Analyze potential threats to independence for this engagement based on the client profile, services provided, and team relationships." },
    ],
    nextStepGuidance: [
      "After independence is confirmed, proceed to data import (TB/GL Upload).",
      "Any threat identified after acceptance must be evaluated immediately.",
    ],
    fieldHints: {},
  },

  "tb-gl-upload": {
    pageId: "tb-gl-upload",
    module: "Data Import",
    group: "data",
    objective: "Import the client's trial balance and general ledger data to establish the foundation for all subsequent audit procedures.",
    expectedOutputs: ["Validated trial balance", "Imported general ledger entries", "Opening balance verification"],
    inputSources: ["Client accounting system exports", "Prior year workpapers", "Bank statements"],
    relatedStandards: ["ISA_500", "ISA_230"],
    commonMistakes: [
      "Importing TB that does not balance (DR ≠ CR)",
      "Missing opening balances or prior year comparatives",
      "Incorrect period selection leading to incomplete data",
      "Not verifying data against client's signed TB",
    ],
    requiredEvidence: ["Client-signed trial balance", "GL export reconciliation"],
    reviewRules: [
      { id: "tb-01", condition: "Trial balance does not balance", severity: "critical", message: "Total debits must equal total credits. Verify the import file and re-import if needed.", standardRef: "ISA 500.6" },
      { id: "tb-02", condition: "No GL entries imported", severity: "warning", message: "GL data enables journal entry testing and analytical procedures. Import is strongly recommended.", standardRef: "ISA 240.32" },
    ],
    suggestionTemplates: [],
    nextStepGuidance: [
      "After successful import, proceed to Validation & Parsing to verify data integrity.",
      "Then map accounts to Chart of Accounts / FS Heads in CoA Mapping.",
    ],
    fieldHints: {},
  },

  "validation": {
    pageId: "validation",
    module: "Data Import",
    group: "data",
    objective: "Validate imported data for completeness, accuracy, and consistency before proceeding with audit procedures.",
    expectedOutputs: ["Validation report", "Exception list", "Data quality assessment"],
    inputSources: ["Imported TB/GL data", "Client records"],
    relatedStandards: ["ISA_500", "ISA_520", "ISA_230"],
    commonMistakes: [
      "Proceeding with audit procedures on unvalidated data",
      "Ignoring validation warnings",
      "Not reconciling imported totals to source documents",
    ],
    requiredEvidence: ["Validation completion record", "Exception resolution documentation"],
    reviewRules: [
      { id: "val-01", condition: "Validation not run", severity: "critical", message: "Data validation must be completed before planning procedures begin." },
    ],
    suggestionTemplates: [],
    nextStepGuidance: ["After validation passes, proceed to CoA Mapping to map accounts to financial statement line items."],
    fieldHints: {},
  },

  "coa-mapping": {
    pageId: "coa-mapping",
    module: "Data Import",
    group: "data",
    objective: "Map client account codes to standardized financial statement line items (FS Heads) to enable automated financial statement preparation and analytical procedures.",
    expectedOutputs: ["Complete CoA to FS Head mapping", "Mapped trial balance", "Financial statement structure"],
    inputSources: ["Client chart of accounts", "Trial balance", "Prior year mapping", "Industry templates"],
    relatedStandards: ["ISA_500", "ISA_315", "ISA_230"],
    commonMistakes: [
      "Unmapped accounts causing incomplete financial statements",
      "Incorrect classification affecting ratio analysis and risk assessment",
      "Not reviewing AI-suggested mappings for appropriateness",
    ],
    requiredEvidence: ["Complete mapping documentation", "Review of unusual or new accounts"],
    reviewRules: [
      { id: "coa-01", condition: "Unmapped accounts exist", severity: "warning", message: "All accounts with balances should be mapped to an FS Head for complete financial statement coverage." },
    ],
    suggestionTemplates: [],
    nextStepGuidance: ["After mapping is complete, proceed to Materiality determination.", "Review mapping for any misclassifications before planning."],
    fieldHints: {},
  },

  "materiality": {
    pageId: "materiality",
    module: "Planning",
    group: "planning",
    objective: "Determine overall materiality, performance materiality, and the clearly trivial threshold to guide the scope and nature of audit procedures.",
    expectedOutputs: ["Overall materiality amount with benchmark and rationale", "Performance materiality amount", "Clearly trivial threshold", "Specific materiality for sensitive items if applicable"],
    inputSources: ["Trial balance", "Prior year financial statements", "Industry benchmarks", "Client risk profile"],
    relatedStandards: ["ISA_320", "ISA_450", "ISA_230"],
    commonMistakes: [
      "Using inappropriate benchmark for the entity type",
      "Not providing rationale for the percentage applied",
      "Setting performance materiality too high relative to overall materiality",
      "Not considering qualitative factors in materiality determination",
      "Failing to revise materiality when significant changes occur during the audit",
    ],
    requiredEvidence: ["Documented benchmark selection rationale", "Materiality calculation workpaper", "Partner approval of materiality levels"],
    reviewRules: [
      { id: "mat-01", condition: "No benchmark selected", severity: "critical", message: "A materiality benchmark must be selected and documented per ISA 320.10.", standardRef: "ISA 320.10" },
      { id: "mat-02", condition: "No rationale documented", severity: "warning", message: "The rationale for the benchmark and percentage must be documented.", standardRef: "ISA 320.10" },
      { id: "mat-03", condition: "PM > 75% of overall materiality", severity: "warning", message: "Performance materiality is typically set at 50-75% of overall materiality. Values above 75% may not provide adequate coverage.", standardRef: "ISA 320.11" },
      { id: "mat-04", condition: "Trivial threshold > 5% of materiality", severity: "info", message: "Clearly trivial threshold is commonly set at 3-5% of overall materiality.", standardRef: "ISA 450.5" },
    ],
    suggestionTemplates: [
      { id: "mat-rationale", label: "Draft Materiality Rationale", type: "draft_narrative", targetField: "benchmarkRationale", prompt: "Draft a professional rationale for the materiality benchmark selection, considering the entity type, user base, industry norms, and qualitative factors." },
      { id: "mat-conclusion", label: "Draft Materiality Conclusion", type: "generate_conclusion", prompt: "Draft a conclusion paragraph for the materiality determination, summarizing the benchmark, percentage, amounts, and key considerations." },
    ],
    nextStepGuidance: [
      "After materiality is set, proceed to Risk Assessment to identify and assess risks of material misstatement.",
      "Materiality should be revisited if significant findings emerge during fieldwork.",
      "Ensure materiality is approved by the engagement partner before fieldwork begins.",
    ],
    fieldHints: {
      "benchmark": { label: "Benchmark Selection", guidance: "Common benchmarks: Revenue (revenue-driven entities), Total Assets (asset-intensive), Profit Before Tax (stable profitable entities), Total Expenses (NFP/government).", standardRef: "ISA 320.10", exampleValues: ["Revenue", "Total Assets", "Profit Before Tax", "Total Expenses"] },
      "percentage": { label: "Percentage Applied", guidance: "Typical ranges: Revenue 0.5-1%, Total Assets 1-2%, PBT 5-10%. Lower end for higher risk, public interest entities.", standardRef: "ISA 320.10" },
    },
  },

  "risk-assessment": {
    pageId: "risk-assessment",
    module: "Planning",
    group: "planning",
    objective: "Identify and assess the risks of material misstatement at the financial statement and assertion levels to form the basis for designing audit responses.",
    expectedOutputs: ["Risk register with inherent and control risk assessments", "Significant risk identification", "Risk response linkages"],
    inputSources: ["Industry analysis", "Client understanding", "Prior year findings", "Materiality levels", "Analytical procedures results"],
    relatedStandards: ["ISA_315", "ISA_240", "ISA_330", "ISA_570"],
    commonMistakes: [
      "Generic risk descriptions not specific to the client",
      "Not identifying fraud risks for revenue recognition",
      "Missing management override of controls as a presumed risk",
      "Risks identified but no linked audit responses",
      "Not considering IT-related risks for automated processes",
    ],
    requiredEvidence: ["Documented risk assessment for each material FS area", "Significant risk designation rationale", "Risk-to-procedure linkage"],
    reviewRules: [
      { id: "risk-01", condition: "Revenue recognition fraud risk not addressed", severity: "critical", message: "ISA 240.32 presumes fraud risk in revenue recognition. This must be explicitly addressed or rebutted with documented rationale.", standardRef: "ISA 240.32" },
      { id: "risk-02", condition: "Management override not included", severity: "critical", message: "Management override of controls is a presumed risk that cannot be rebutted (ISA 240.31).", standardRef: "ISA 240.31" },
      { id: "risk-03", condition: "Risks without responses", severity: "warning", message: "Every assessed risk must have a linked audit response (ISA 330).", standardRef: "ISA 330.6" },
      { id: "risk-04", condition: "No significant risks identified", severity: "info", message: "Consider whether any risks warrant designation as significant. Significant risks require special audit consideration.", standardRef: "ISA 315.28" },
    ],
    suggestionTemplates: [
      { id: "risk-narrative", label: "Draft Risk Description", type: "draft_narrative", targetField: "riskDescription", prompt: "Draft a detailed risk description specific to this client and financial statement area, including the relevant assertions and the basis for the risk assessment." },
      { id: "risk-response", label: "Suggest Audit Response", type: "fill_field", targetField: "auditResponse", prompt: "Suggest an appropriate audit response for this assessed risk, including the nature, timing, and extent of procedures." },
    ],
    nextStepGuidance: [
      "After risk assessment, develop the Planning Strategy to define the overall audit approach.",
      "Ensure each risk has at least one linked audit procedure before moving to fieldwork.",
      "Significant risks require procedures specifically responsive to those risks (ISA 330.21).",
    ],
    fieldHints: {
      "inherentRisk": { label: "Inherent Risk", guidance: "Assess the susceptibility of the assertion to material misstatement before considering controls.", standardRef: "ISA 315.12" },
      "controlRisk": { label: "Control Risk", guidance: "Assess the risk that controls will not prevent or detect material misstatement. If controls are not tested, default to HIGH.", standardRef: "ISA 315.25" },
    },
  },

  "planning-strategy": {
    pageId: "planning-strategy",
    module: "Planning",
    group: "planning",
    objective: "Establish the overall audit strategy setting the scope, timing, and direction of the audit, and develop the detailed audit plan.",
    expectedOutputs: ["Overall audit strategy document", "Detailed audit plan", "Resource allocation", "Timeline"],
    inputSources: ["Risk assessment", "Materiality", "Client understanding", "Prior year experience"],
    relatedStandards: ["ISA_300", "ISA_315", "ISA_330", "ISA_260"],
    commonMistakes: [
      "Generic strategy not tailored to assessed risks",
      "No communication plan for TCWG",
      "Timing of procedures not aligned with client reporting deadlines",
      "Not considering the need for specialists or experts",
    ],
    requiredEvidence: ["Documented audit strategy", "Audit plan with procedure details"],
    reviewRules: [
      { id: "plan-01", condition: "No overall strategy documented", severity: "critical", message: "The overall audit strategy must be documented per ISA 300.7.", standardRef: "ISA 300.7" },
      { id: "plan-02", condition: "No audit plan", severity: "warning", message: "A detailed audit plan describing the nature, timing, and extent of procedures is required.", standardRef: "ISA 300.9" },
    ],
    suggestionTemplates: [
      { id: "plan-strategy", label: "Draft Audit Strategy", type: "draft_narrative", prompt: "Draft an overall audit strategy for this engagement, considering the risk assessment, materiality levels, client circumstances, and resource requirements." },
    ],
    nextStepGuidance: [
      "After planning is complete, proceed to fieldwork phases (Procedures & Sampling, Execution & Testing).",
      "Communicate planned scope and timing to TCWG (ISA 260.14).",
    ],
    fieldHints: {},
  },

  "procedures-sampling": {
    pageId: "procedures-sampling",
    module: "Fieldwork",
    group: "fieldwork",
    objective: "Design further audit procedures (tests of controls and substantive procedures) and determine appropriate sampling methods and sample sizes.",
    expectedOutputs: ["Audit program with designed procedures", "Sampling plans", "Sample selections"],
    inputSources: ["Risk assessment", "Planning strategy", "Materiality", "Internal control evaluation"],
    relatedStandards: ["ISA_330", "ISA_530", "ISA_500", "ISA_520"],
    commonMistakes: [
      "Sample sizes not justified based on assessed risk and confidence levels",
      "Using sampling when 100% testing would be more appropriate for small populations",
      "Not designing procedures responsive to specific assessed risks",
      "Ignoring the need for dual-purpose testing where controls are relied upon",
    ],
    requiredEvidence: ["Documented sampling rationale", "Population definition", "Selection method justification"],
    reviewRules: [
      { id: "samp-01", condition: "No sampling rationale", severity: "warning", message: "Sample size determination should be documented with the basis for the approach used.", standardRef: "ISA 530.6" },
    ],
    suggestionTemplates: [
      { id: "samp-narrative", label: "Draft Sampling Approach", type: "draft_narrative", prompt: "Draft a sampling approach narrative explaining the sampling method, population, sample size rationale, and selection technique for this audit area." },
    ],
    nextStepGuidance: ["After procedures are designed and samples selected, proceed to Execution & Testing to perform the procedures."],
    fieldHints: {},
  },

  "execution-testing": {
    pageId: "execution-testing",
    module: "Fieldwork",
    group: "fieldwork",
    objective: "Execute the designed audit procedures, document the work performed, record findings, and evaluate the sufficiency and appropriateness of audit evidence obtained.",
    expectedOutputs: ["Completed working papers", "Test results documentation", "Exception/finding reports", "Evidence sufficiency evaluation"],
    inputSources: ["Audit program", "Selected samples", "Client documents", "External confirmations"],
    relatedStandards: ["ISA_330", "ISA_500", "ISA_505", "ISA_530", "ISA_540"],
    commonMistakes: [
      "Performing procedures not responsive to assessed risks",
      "Insufficient documentation of work performed",
      "Not following up on exceptions or deviations",
      "Failing to evaluate the sufficiency of evidence before concluding",
      "Not projecting sample errors to the population",
    ],
    requiredEvidence: ["Working papers with cross-references", "Test results summary", "Exception follow-up documentation"],
    reviewRules: [
      { id: "exec-01", condition: "Procedures without documented results", severity: "critical", message: "All performed procedures must have documented results and conclusions.", standardRef: "ISA 230.8" },
      { id: "exec-02", condition: "Exceptions not investigated", severity: "warning", message: "All exceptions found during testing must be investigated and resolved.", standardRef: "ISA 500.6" },
    ],
    suggestionTemplates: [
      { id: "exec-conclusion", label: "Draft Procedure Conclusion", type: "generate_conclusion", prompt: "Draft a conclusion for this audit procedure based on the test results, exceptions found, and evidence obtained." },
      { id: "exec-finding", label: "Draft Finding Description", type: "draft_narrative", prompt: "Draft a professional finding description including the condition, criteria, cause, effect, and recommendation." },
    ],
    nextStepGuidance: [
      "After execution is complete, link evidence to risks and assertions in Evidence Linking.",
      "Document and report significant findings in the Observations module.",
    ],
    fieldHints: {},
  },

  "evidence-linking": {
    pageId: "evidence-linking",
    module: "Fieldwork",
    group: "fieldwork",
    objective: "Link audit evidence to identified risks and assertions to demonstrate that sufficient appropriate audit evidence has been obtained for each material area.",
    expectedOutputs: ["Evidence-to-risk linkage matrix", "Sufficiency assessment per FS area", "Gap analysis"],
    inputSources: ["Working papers", "Risk assessment", "Audit procedures", "Evidence gathered"],
    relatedStandards: ["ISA_500", "ISA_330", "ISA_230"],
    commonMistakes: [
      "Evidence not linked to specific assertions",
      "Relying on a single source of evidence for material assertions",
      "Not considering the quality/reliability of evidence sources",
    ],
    requiredEvidence: ["Complete linkage documentation", "Sufficiency evaluation per FS Head"],
    reviewRules: [
      { id: "evid-01", condition: "Risks without linked evidence", severity: "critical", message: "All assessed risks must have linked audit evidence demonstrating that responses were performed.", standardRef: "ISA 330.6" },
    ],
    suggestionTemplates: [],
    nextStepGuidance: ["After evidence linking, review the sufficiency assessment and address any gaps before moving to completion."],
    fieldHints: {},
  },

  "observations": {
    pageId: "observations",
    module: "Fieldwork",
    group: "fieldwork",
    objective: "Document, classify, and track audit observations including control deficiencies, findings, and exceptions identified during the audit.",
    expectedOutputs: ["Observation register", "Classification by severity", "Management responses", "Management letter points"],
    inputSources: ["Test results", "Exception reports", "Control evaluations"],
    relatedStandards: ["ISA_265", "ISA_450", "ISA_260"],
    commonMistakes: [
      "Not classifying deficiencies by significance level",
      "Failing to communicate significant deficiencies to TCWG",
      "Vague recommendations without actionable steps",
    ],
    requiredEvidence: ["Documented observations with evidence", "Management responses", "TCWG communication records"],
    reviewRules: [
      { id: "obs-01", condition: "Significant deficiencies not communicated", severity: "critical", message: "Significant deficiencies in internal control must be communicated in writing to TCWG.", standardRef: "ISA 265.9" },
    ],
    suggestionTemplates: [
      { id: "obs-draft", label: "Draft Observation", type: "draft_narrative", prompt: "Draft a professional audit observation using the condition-criteria-cause-effect-recommendation framework." },
    ],
    nextStepGuidance: ["Ensure all critical observations are resolved before completion phase.", "Feed significant observations into the management letter."],
    fieldHints: {},
  },

  "adjustments": {
    pageId: "adjustments",
    module: "Completion",
    group: "completion",
    objective: "Accumulate, evaluate, and track audit adjustments (corrected and uncorrected misstatements) and assess their aggregate effect on the financial statements.",
    expectedOutputs: ["Schedule of corrected misstatements", "Schedule of uncorrected misstatements", "Aggregate effect evaluation", "TCWG communication"],
    inputSources: ["Testing results", "Materiality levels", "Prior year uncorrected misstatements"],
    relatedStandards: ["ISA_450", "ISA_580", "ISA_260"],
    commonMistakes: [
      "Not accumulating all identified misstatements",
      "Failing to evaluate aggregate effect against materiality",
      "Not requesting management to correct identified misstatements",
      "Not including uncorrected misstatements in the representation letter",
    ],
    requiredEvidence: ["Complete misstatement schedule", "Management response to adjustments", "Representation letter reference"],
    reviewRules: [
      { id: "adj-01", condition: "Uncorrected misstatements exceed materiality", severity: "critical", message: "If aggregate uncorrected misstatements exceed materiality, consider the impact on the audit opinion.", standardRef: "ISA 450.11" },
      { id: "adj-02", condition: "Misstatements not communicated to TCWG", severity: "warning", message: "Uncorrected misstatements must be communicated to TCWG and included in the representation letter.", standardRef: "ISA 450.11" },
    ],
    suggestionTemplates: [
      { id: "adj-summary", label: "Draft Misstatement Summary", type: "draft_narrative", prompt: "Draft a summary of misstatements identified, including corrected and uncorrected amounts, their nature, and the aggregate effect assessment." },
    ],
    nextStepGuidance: ["After adjustments are finalized, proceed to Finalization phase."],
    fieldHints: {},
  },

  "finalization": {
    pageId: "finalization",
    module: "Completion",
    group: "completion",
    objective: "Complete all remaining audit procedures, obtain final evidence, prepare the completion memo, and ensure the file is ready for partner review and opinion formation.",
    expectedOutputs: ["Completion memo with overall conclusion", "Subsequent events review", "Going concern conclusion", "Representation letter", "Final analytical review"],
    inputSources: ["All prior phases", "Management representations", "Subsequent events inquiry", "Going concern assessment"],
    relatedStandards: ["ISA_560", "ISA_570", "ISA_580", "ISA_230", "ISA_520"],
    commonMistakes: [
      "Not performing subsequent events review up to the report date",
      "Going concern assessment not documented or not linked to financial indicators",
      "Representation letter not dated on or near the report date",
      "Completion memo missing overall conclusion or key judgments",
      "File not assembled within the required timeframe",
    ],
    requiredEvidence: ["Completed completion memo", "Signed representation letter", "Subsequent events documentation", "Going concern workpaper", "Final analytical review"],
    reviewRules: [
      { id: "fin-01", condition: "No completion memo", severity: "critical", message: "A completion memo summarizing the audit must be prepared.", standardRef: "ISA 230.8" },
      { id: "fin-02", condition: "No subsequent events review", severity: "critical", message: "Subsequent events must be reviewed up to the auditor's report date.", standardRef: "ISA 560.6" },
      { id: "fin-03", condition: "No going concern conclusion", severity: "critical", message: "Going concern assessment must be documented with a conclusion.", standardRef: "ISA 570.10" },
      { id: "fin-04", condition: "Representation letter not obtained", severity: "critical", message: "Written representations must be obtained before signing the report.", standardRef: "ISA 580.9" },
    ],
    suggestionTemplates: [
      { id: "fin-memo", label: "Draft Completion Memo", type: "draft_narrative", prompt: "Draft a completion memo summarizing the audit, significant judgments, key audit matters, unresolved issues, and the overall conclusion." },
      { id: "fin-gc-conclusion", label: "Draft Going Concern Conclusion", type: "generate_conclusion", prompt: "Draft a going concern conclusion based on the financial indicators, management's assessment, and audit evidence obtained." },
    ],
    nextStepGuidance: [
      "After finalization is complete and partner-approved, proceed to Opinion & Reports.",
      "Ensure EQCR is completed before the report date if required.",
    ],
    fieldHints: {},
  },

  "opinion-reports": {
    pageId: "opinion-reports",
    module: "Reporting",
    group: "reporting",
    objective: "Form the audit opinion based on all evidence gathered, generate the audit report, and prepare the management letter and other deliverables.",
    expectedOutputs: ["Audit opinion determination", "Audit report", "Management letter", "TCWG communication letter"],
    inputSources: ["All audit phases", "Completion memo", "Misstatement evaluation", "Going concern assessment"],
    relatedStandards: ["ISA_700", "ISA_705", "ISA_706", "ISA_720", "ISA_260"],
    commonMistakes: [
      "Opinion not supported by documented evidence trail",
      "Modified opinion without adequate basis for modification",
      "KAM section missing for listed entities",
      "Other information not reviewed for consistency",
      "Report dated before all procedures are complete",
    ],
    requiredEvidence: ["Documented opinion rationale", "Complete audit file", "Partner sign-off", "EQCR clearance if applicable"],
    reviewRules: [
      { id: "rep-01", condition: "Opinion basis not documented", severity: "critical", message: "The basis for the audit opinion must be clearly documented.", standardRef: "ISA 700.10" },
      { id: "rep-02", condition: "Modified opinion without basis paragraph", severity: "critical", message: "Modified opinions require a Basis for Modification paragraph.", standardRef: "ISA 705.7" },
    ],
    suggestionTemplates: [
      { id: "rep-opinion", label: "Draft Opinion Rationale", type: "draft_narrative", prompt: "Draft the rationale for the proposed audit opinion, linking it to the key findings, misstatement evaluation, and going concern assessment." },
    ],
    nextStepGuidance: [
      "After the report is issued, complete file assembly within the required timeframe (typically 60 days).",
      "Ensure all TCWG communications are documented.",
    ],
    fieldHints: {},
  },

  "eqcr": {
    pageId: "eqcr",
    module: "Quality",
    group: "quality",
    objective: "Perform the Engagement Quality Control Review to provide an objective evaluation of significant judgments made by the engagement team and the conclusions reached.",
    expectedOutputs: ["EQCR completion notification", "Significant judgment evaluation", "Conclusion on quality"],
    inputSources: ["Key workpapers", "Significant judgments", "Completion memo", "Draft report"],
    relatedStandards: ["ISQM_2", "ISA_220"],
    commonMistakes: [
      "EQCR not completed before report date",
      "Reviewer not sufficiently independent from the engagement team",
      "Insufficient depth of review on significant judgments",
    ],
    requiredEvidence: ["EQCR documentation", "Reviewer sign-off"],
    reviewRules: [
      { id: "eqcr-01", condition: "EQCR not completed", severity: "critical", message: "EQCR must be completed before the auditor's report date.", standardRef: "ISQM 2.25" },
    ],
    suggestionTemplates: [],
    nextStepGuidance: ["After EQCR clearance, the report can be signed and issued."],
    fieldHints: {},
  },

  "inspection": {
    pageId: "inspection",
    module: "Quality",
    group: "quality",
    objective: "Conduct internal quality inspections to monitor compliance with firm policies, professional standards, and regulatory requirements.",
    expectedOutputs: ["Inspection findings", "Corrective action plans", "Quality metrics"],
    inputSources: ["Engagement files", "ISQM monitoring", "Prior inspection results"],
    relatedStandards: ["ISQM_1", "SECP_REQUIREMENTS"],
    commonMistakes: [
      "Inspection conducted by team members involved in the engagement",
      "Findings not tracked to resolution",
      "Root cause analysis not performed for recurring issues",
    ],
    requiredEvidence: ["Inspection report", "Corrective action documentation"],
    reviewRules: [],
    suggestionTemplates: [],
    nextStepGuidance: [],
    fieldHints: {},
  },
};

export function getPageProfile(pageId: string): PageProfile | undefined {
  return PAGE_PROFILES[pageId];
}

export function getProfileByRoute(routePath: string): PageProfile | undefined {
  const slug = routePath.split("/").pop() || "";
  return PAGE_PROFILES[slug];
}

export function getAllPageIds(): string[] {
  return Object.keys(PAGE_PROFILES);
}
