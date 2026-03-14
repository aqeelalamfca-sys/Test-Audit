export interface StandardReference {
  code: string;
  title: string;
  summary: string;
  keyParagraphs: { ref: string; text: string }[];
  auditImplication: string;
  category: "ISA" | "ISQM" | "ETHICS" | "LAW" | "IFRS" | "REGULATORY";
}

export const STANDARDS_LIBRARY: Record<string, StandardReference> = {
  "ISA_200": {
    code: "ISA 200",
    title: "Overall Objectives of the Independent Auditor",
    summary: "Establishes the independent auditor's overall responsibilities when conducting an audit of financial statements in accordance with ISAs.",
    keyParagraphs: [
      { ref: "ISA 200.5", text: "The auditor shall comply with relevant ethical requirements, including those pertaining to independence." },
      { ref: "ISA 200.11", text: "In conducting an audit, the overall objectives of the auditor are to obtain reasonable assurance and report on the financial statements." },
      { ref: "ISA 200.15", text: "The auditor shall exercise professional judgment in planning and performing an audit." },
    ],
    auditImplication: "Ensures the audit is conducted with professional skepticism, judgment, and compliance with ethical standards.",
    category: "ISA",
  },
  "ISA_210": {
    code: "ISA 210",
    title: "Agreeing the Terms of Audit Engagements",
    summary: "Deals with the auditor's responsibilities in agreeing the terms of the audit engagement with management.",
    keyParagraphs: [
      { ref: "ISA 210.6", text: "The auditor shall agree on the terms of the audit engagement with management or those charged with governance." },
      { ref: "ISA 210.9", text: "The agreed terms shall be recorded in an audit engagement letter or other suitable form of written agreement." },
    ],
    auditImplication: "Engagement letter must clearly define scope, responsibilities, and reporting framework before audit work commences.",
    category: "ISA",
  },
  "ISA_220": {
    code: "ISA 220",
    title: "Quality Management for an Audit of Financial Statements",
    summary: "Deals with the specific responsibilities of the auditor regarding quality management at the engagement level.",
    keyParagraphs: [
      { ref: "ISA 220.12", text: "The engagement partner shall take responsibility for the overall quality of each audit engagement." },
      { ref: "ISA 220.18", text: "The engagement partner shall determine that relevant ethical requirements, including independence, have been fulfilled." },
      { ref: "ISA 220.29", text: "The engagement partner shall review the audit documentation on a timely basis at appropriate stages during the audit." },
    ],
    auditImplication: "Partner must actively manage quality, ensure team competence, and review critical documentation before opinion is formed.",
    category: "ISA",
  },
  "ISA_230": {
    code: "ISA 230",
    title: "Audit Documentation",
    summary: "Deals with the auditor's responsibility to prepare audit documentation for an audit of financial statements.",
    keyParagraphs: [
      { ref: "ISA 230.7", text: "The auditor shall prepare audit documentation on a timely basis." },
      { ref: "ISA 230.8", text: "Documentation must be sufficient to enable an experienced auditor to understand the nature, timing, and extent of audit procedures performed." },
      { ref: "ISA 230.14", text: "The auditor shall assemble the audit documentation in an audit file and complete the administrative process of assembling the final audit file on a timely basis after the date of the auditor's report." },
    ],
    auditImplication: "Every conclusion must be supported by documented evidence. Weak or missing documentation is a primary QCR/inspection finding.",
    category: "ISA",
  },
  "ISA_240": {
    code: "ISA 240",
    title: "The Auditor's Responsibilities Relating to Fraud",
    summary: "Deals with the auditor's responsibilities relating to fraud in an audit of financial statements.",
    keyParagraphs: [
      { ref: "ISA 240.12", text: "The auditor shall maintain professional skepticism throughout the audit, recognizing the possibility of a material misstatement due to fraud." },
      { ref: "ISA 240.17", text: "The auditor shall make inquiries of management regarding their assessment of the risk of material misstatement due to fraud." },
      { ref: "ISA 240.26", text: "The auditor shall identify and assess the risks of material misstatement due to fraud at the financial statement and assertion levels." },
      { ref: "ISA 240.32", text: "Regardless of the auditor's assessment, the auditor shall presume that there are risks of fraud in revenue recognition." },
    ],
    auditImplication: "Fraud risk must be explicitly addressed. Revenue recognition is presumed risky unless rebutted with documented rationale.",
    category: "ISA",
  },
  "ISA_250": {
    code: "ISA 250",
    title: "Consideration of Laws and Regulations",
    summary: "Deals with the auditor's responsibility to consider laws and regulations in an audit of financial statements.",
    keyParagraphs: [
      { ref: "ISA 250.12", text: "The auditor shall obtain a general understanding of the legal and regulatory framework applicable to the entity and its industry." },
      { ref: "ISA 250.14", text: "The auditor shall obtain sufficient appropriate audit evidence regarding compliance with laws and regulations that have a direct effect on financial statements." },
    ],
    auditImplication: "Non-compliance with laws can have material effects on financial statements and may require reporting to TCWG.",
    category: "ISA",
  },
  "ISA_260": {
    code: "ISA 260",
    title: "Communication with Those Charged with Governance",
    summary: "Deals with the auditor's responsibility to communicate with those charged with governance (TCWG).",
    keyParagraphs: [
      { ref: "ISA 260.14", text: "The auditor shall communicate the planned scope and timing of the audit with TCWG." },
      { ref: "ISA 260.16", text: "The auditor shall communicate significant findings from the audit to TCWG on a timely basis." },
    ],
    auditImplication: "Communication with TCWG is required at planning and completion stages. Document what was communicated and when.",
    category: "ISA",
  },
  "ISA_265": {
    code: "ISA 265",
    title: "Communicating Deficiencies in Internal Control",
    summary: "Deals with the auditor's responsibility to communicate deficiencies in internal control to TCWG and management.",
    keyParagraphs: [
      { ref: "ISA 265.9", text: "The auditor shall communicate significant deficiencies in internal control identified during the audit to TCWG in writing on a timely basis." },
      { ref: "ISA 265.10", text: "The auditor shall also communicate to management deficiencies in internal control that are of sufficient importance to merit management's attention." },
    ],
    auditImplication: "Significant control deficiencies must be reported in writing. This feeds into the management letter.",
    category: "ISA",
  },
  "ISA_300": {
    code: "ISA 300",
    title: "Planning an Audit of Financial Statements",
    summary: "Deals with the auditor's responsibility to plan an audit of financial statements.",
    keyParagraphs: [
      { ref: "ISA 300.7", text: "The auditor shall establish an overall audit strategy that sets the scope, timing, and direction of the audit." },
      { ref: "ISA 300.9", text: "The auditor shall develop an audit plan that includes a description of the nature, timing, and extent of planned risk assessment procedures, and planned further audit procedures." },
      { ref: "ISA 300.10", text: "The auditor shall update and change the overall audit strategy and the audit plan as necessary during the course of the audit." },
    ],
    auditImplication: "Planning must be documented before fieldwork begins. Changes during execution should be documented with rationale.",
    category: "ISA",
  },
  "ISA_315": {
    code: "ISA 315",
    title: "Identifying and Assessing the Risks of Material Misstatement",
    summary: "Deals with the auditor's responsibility to identify and assess the risks of material misstatement in the financial statements.",
    keyParagraphs: [
      { ref: "ISA 315.12", text: "The auditor shall perform risk assessment procedures to identify and assess the risks of material misstatement at the financial statement and assertion levels." },
      { ref: "ISA 315.25", text: "The auditor shall identify risks and obtain an understanding of the entity's internal control relevant to the audit." },
      { ref: "ISA 315.28", text: "The auditor shall assess the identified risks and determine whether they are significant risks." },
    ],
    auditImplication: "Risk assessment is the foundation of the audit approach. Each significant risk must have a linked audit response.",
    category: "ISA",
  },
  "ISA_320": {
    code: "ISA 320",
    title: "Materiality in Planning and Performing an Audit",
    summary: "Deals with the auditor's responsibility to apply the concept of materiality in planning and performing an audit.",
    keyParagraphs: [
      { ref: "ISA 320.10", text: "The auditor shall determine materiality for the financial statements as a whole when establishing the overall audit strategy." },
      { ref: "ISA 320.11", text: "The auditor shall determine performance materiality to reduce the risk that aggregate uncorrected/undetected misstatements exceed materiality." },
      { ref: "ISA 320.12", text: "The auditor shall revise materiality when becoming aware of information during the audit that would have caused a different amount to be determined." },
    ],
    auditImplication: "Materiality must be determined at planning and revisited throughout. It drives sample sizes, testing thresholds, and evaluation of misstatements.",
    category: "ISA",
  },
  "ISA_330": {
    code: "ISA 330",
    title: "The Auditor's Responses to Assessed Risks",
    summary: "Deals with the auditor's responsibility to design and implement responses to the risks of material misstatement.",
    keyParagraphs: [
      { ref: "ISA 330.5", text: "The auditor shall design and implement overall responses to address the assessed risks of material misstatement at the financial statement level." },
      { ref: "ISA 330.6", text: "The auditor shall design and perform further audit procedures whose nature, timing, and extent are responsive to the assessed risks." },
      { ref: "ISA 330.18", text: "The auditor shall perform substantive procedures for each material class of transactions, account balance, and disclosure." },
    ],
    auditImplication: "Every assessed risk must have a designed audit response. The nature/timing/extent must be proportional to the risk level.",
    category: "ISA",
  },
  "ISA_402": {
    code: "ISA 402",
    title: "Audit Considerations Relating to an Entity Using a Service Organization",
    summary: "Deals with the user auditor's responsibility to obtain sufficient audit evidence when a user entity uses service organizations.",
    keyParagraphs: [
      { ref: "ISA 402.9", text: "The user auditor shall obtain an understanding of the services provided by the service organization and their effect on the user entity's internal control relevant to the audit." },
    ],
    auditImplication: "Where entities outsource significant processes, consider the need for a SOC report or alternative procedures.",
    category: "ISA",
  },
  "ISA_450": {
    code: "ISA 450",
    title: "Evaluation of Misstatements Identified During the Audit",
    summary: "Deals with the auditor's responsibility to evaluate the effect of identified misstatements on the audit and uncorrected misstatements on the financial statements.",
    keyParagraphs: [
      { ref: "ISA 450.5", text: "The auditor shall accumulate misstatements identified during the audit, other than those that are clearly trivial." },
      { ref: "ISA 450.11", text: "The auditor shall communicate uncorrected misstatements to TCWG and request that they be corrected." },
    ],
    auditImplication: "All misstatements must be accumulated and evaluated against materiality. Uncorrected items require TCWG communication and written representations.",
    category: "ISA",
  },
  "ISA_500": {
    code: "ISA 500",
    title: "Audit Evidence",
    summary: "Explains what constitutes audit evidence and deals with the auditor's responsibility to design procedures to obtain sufficient appropriate audit evidence.",
    keyParagraphs: [
      { ref: "ISA 500.6", text: "The auditor shall design and perform audit procedures that are appropriate to obtain sufficient appropriate audit evidence." },
      { ref: "ISA 500.7", text: "In designing audit procedures, the auditor shall consider the relevance and reliability of the information to be used as audit evidence." },
    ],
    auditImplication: "Evidence must be both sufficient (quantity) and appropriate (relevance + reliability). External > internal; original > copy; written > oral.",
    category: "ISA",
  },
  "ISA_505": {
    code: "ISA 505",
    title: "External Confirmations",
    summary: "Deals with the auditor's use of external confirmation procedures to obtain audit evidence.",
    keyParagraphs: [
      { ref: "ISA 505.7", text: "When using external confirmation procedures, the auditor shall maintain control over the process." },
    ],
    auditImplication: "Confirmations provide strong external evidence. The auditor must control dispatch and receipt.",
    category: "ISA",
  },
  "ISA_520": {
    code: "ISA 520",
    title: "Analytical Procedures",
    summary: "Deals with the auditor's use of analytical procedures as substantive procedures and near the end of the audit.",
    keyParagraphs: [
      { ref: "ISA 520.5", text: "The auditor shall design and perform analytical procedures near the end of the audit to form an overall conclusion as to whether the financial statements are consistent with the auditor's understanding of the entity." },
      { ref: "ISA 520.6", text: "When analytical procedures identify fluctuations or relationships that are inconsistent with other relevant information or that differ from expected values, the auditor shall investigate." },
    ],
    auditImplication: "Final analytical review is mandatory. Significant unexplained fluctuations must be investigated and resolved before signing.",
    category: "ISA",
  },
  "ISA_530": {
    code: "ISA 530",
    title: "Audit Sampling",
    summary: "Applies when the auditor has decided to use audit sampling in performing audit procedures.",
    keyParagraphs: [
      { ref: "ISA 530.6", text: "The auditor shall determine a sample size sufficient to reduce sampling risk to an acceptably low level." },
      { ref: "ISA 530.12", text: "The auditor shall project misstatements found in the sample to the population." },
    ],
    auditImplication: "Sample design must be appropriate to the audit objective. Results must be projected to the population and evaluated against materiality.",
    category: "ISA",
  },
  "ISA_540": {
    code: "ISA 540",
    title: "Auditing Accounting Estimates and Related Disclosures",
    summary: "Deals with the auditor's responsibilities relating to accounting estimates, including fair value accounting estimates, and related disclosures.",
    keyParagraphs: [
      { ref: "ISA 540.13", text: "The auditor shall identify and assess the risks of material misstatement related to accounting estimates." },
      { ref: "ISA 540.18", text: "The auditor shall evaluate, based on the audit evidence, whether the accounting estimates and related disclosures are reasonable." },
    ],
    auditImplication: "Estimates involve significant judgment. The auditor must understand management's process, test assumptions, and evaluate reasonableness.",
    category: "ISA",
  },
  "ISA_550": {
    code: "ISA 550",
    title: "Related Parties",
    summary: "Deals with the auditor's responsibilities regarding related party relationships and transactions.",
    keyParagraphs: [
      { ref: "ISA 550.11", text: "The auditor shall inquire of management regarding the identity of related parties and the nature of relationships and transactions." },
      { ref: "ISA 550.19", text: "The auditor shall obtain sufficient appropriate audit evidence about whether identified related party relationships and transactions have been properly accounted for and disclosed." },
    ],
    auditImplication: "Related party transactions carry inherent fraud risk. Must be identified, disclosed, and tested for substance over form.",
    category: "ISA",
  },
  "ISA_560": {
    code: "ISA 560",
    title: "Subsequent Events",
    summary: "Deals with the auditor's responsibilities relating to subsequent events in an audit of financial statements.",
    keyParagraphs: [
      { ref: "ISA 560.6", text: "The auditor shall perform audit procedures to obtain sufficient appropriate audit evidence that all events occurring between the date of the financial statements and the date of the auditor's report that require adjustment or disclosure have been identified and properly reflected." },
      { ref: "ISA 560.10", text: "The auditor shall perform procedures to cover the period between the date of the financial statements and the date of the auditor's report, or as near as practicable thereto." },
    ],
    auditImplication: "Events after the reporting date must be evaluated for adjusting vs non-adjusting treatment. Critical for audit completion.",
    category: "ISA",
  },
  "ISA_570": {
    code: "ISA 570",
    title: "Going Concern",
    summary: "Deals with the auditor's responsibilities relating to going concern in an audit of financial statements.",
    keyParagraphs: [
      { ref: "ISA 570.10", text: "The auditor shall evaluate management's assessment of the entity's ability to continue as a going concern." },
      { ref: "ISA 570.16", text: "The auditor shall evaluate whether sufficient appropriate audit evidence has been obtained regarding the appropriateness of management's use of the going concern basis of accounting." },
      { ref: "ISA 570.18", text: "If events or conditions have been identified that may cast significant doubt on the entity's ability to continue as a going concern, the auditor shall obtain sufficient appropriate audit evidence to determine whether or not a material uncertainty exists." },
    ],
    auditImplication: "Going concern assessment is mandatory. Material uncertainty must be disclosed and may affect the audit opinion.",
    category: "ISA",
  },
  "ISA_580": {
    code: "ISA 580",
    title: "Written Representations",
    summary: "Deals with the auditor's responsibility to obtain written representations from management and TCWG.",
    keyParagraphs: [
      { ref: "ISA 580.9", text: "The auditor shall request written representations from management with appropriate responsibilities for the financial statements." },
      { ref: "ISA 580.10", text: "Written representations shall be for all periods referred to in the auditor's opinion." },
      { ref: "ISA 580.13", text: "The date of the written representations shall be as near as practicable to, but not after, the date of the auditor's report." },
    ],
    auditImplication: "Representation letter must be obtained before signing the audit report. It is a necessary but not sufficient form of audit evidence.",
    category: "ISA",
  },
  "ISA_600": {
    code: "ISA 600",
    title: "Special Considerations — Audits of Group Financial Statements",
    summary: "Deals with special considerations that apply to group audits, in particular those that involve component auditors.",
    keyParagraphs: [
      { ref: "ISA 600.11", text: "The group engagement partner shall determine whether sufficient appropriate audit evidence can be obtained regarding the consolidation process and the financial information of the components." },
    ],
    auditImplication: "Group audits require coordination with component auditors, assessment of their work, and evaluation of consolidation adjustments.",
    category: "ISA",
  },
  "ISA_700": {
    code: "ISA 700",
    title: "Forming an Opinion and Reporting on Financial Statements",
    summary: "Deals with the auditor's responsibility to form an opinion on the financial statements and the form and content of the auditor's report.",
    keyParagraphs: [
      { ref: "ISA 700.10", text: "The auditor shall form an opinion on whether the financial statements are prepared, in all material respects, in accordance with the applicable financial reporting framework." },
      { ref: "ISA 700.21", text: "The auditor's report shall include a clear expression of the opinion." },
    ],
    auditImplication: "The opinion must be supported by all work performed. All gate conditions must be cleared before the report can be issued.",
    category: "ISA",
  },
  "ISA_705": {
    code: "ISA 705",
    title: "Modifications to the Opinion in the Independent Auditor's Report",
    summary: "Deals with the auditor's responsibility to issue a modified report when the auditor concludes that a modification is necessary.",
    keyParagraphs: [
      { ref: "ISA 705.7", text: "The auditor shall modify the opinion when the auditor concludes that the financial statements as a whole are not free from material misstatement, or is unable to obtain sufficient appropriate audit evidence." },
      { ref: "ISA 705.8", text: "Qualified opinion when misstatements are material but not pervasive. Adverse opinion when material and pervasive. Disclaimer when unable to obtain sufficient evidence." },
    ],
    auditImplication: "Modified opinions require a documented basis for modification paragraph explaining the specific issues and their effect.",
    category: "ISA",
  },
  "ISA_706": {
    code: "ISA 706",
    title: "Emphasis of Matter and Other Matter Paragraphs",
    summary: "Deals with additional communication in the auditor's report through Emphasis of Matter and Other Matter paragraphs.",
    keyParagraphs: [
      { ref: "ISA 706.6", text: "The auditor shall include an Emphasis of Matter paragraph when the auditor considers it necessary to draw users' attention to a matter presented or disclosed that is fundamental to users' understanding of the financial statements." },
    ],
    auditImplication: "EOM paragraphs do not modify the opinion but highlight critical matters like going concern uncertainties or significant related party transactions.",
    category: "ISA",
  },
  "ISA_720": {
    code: "ISA 720",
    title: "The Auditor's Responsibilities Relating to Other Information",
    summary: "Deals with the auditor's responsibilities relating to other information included in documents containing audited financial statements.",
    keyParagraphs: [
      { ref: "ISA 720.14", text: "The auditor shall read the other information and consider whether there is a material inconsistency between the other information and the financial statements." },
    ],
    auditImplication: "The auditor must review directors' reports and other information for consistency with audited figures.",
    category: "ISA",
  },
  "ISQM_1": {
    code: "ISQM 1",
    title: "Quality Management for Firms that Perform Audits or Reviews",
    summary: "Deals with the firm's responsibilities to design, implement, and operate a system of quality management.",
    keyParagraphs: [
      { ref: "ISQM 1.16", text: "The firm shall establish quality objectives, identify and assess quality risks, and design and implement responses to address the quality risks." },
      { ref: "ISQM 1.30", text: "The firm shall establish policies and procedures for acceptance and continuance of client relationships and specific engagements." },
    ],
    auditImplication: "Firm-level quality management must be evidenced. Acceptance procedures, monitoring, and documentation are key inspection areas.",
    category: "ISQM",
  },
  "ISQM_2": {
    code: "ISQM 2",
    title: "Engagement Quality Reviews",
    summary: "Deals with engagement quality reviews and the appointment of the engagement quality reviewer.",
    keyParagraphs: [
      { ref: "ISQM 2.16", text: "The engagement quality reviewer shall perform procedures to provide a basis for an objective evaluation of the significant judgments made by the engagement team." },
      { ref: "ISQM 2.25", text: "The engagement quality review shall be completed before the date of the auditor's report." },
    ],
    auditImplication: "EQCR is mandatory for listed entities and high-risk engagements. It must be completed before the report date.",
    category: "ISQM",
  },
  "ICAP_ETHICS": {
    code: "ICAP Code of Ethics",
    title: "Code of Ethics for Chartered Accountants (ICAP)",
    summary: "Based on IESBA Code, establishes fundamental principles of integrity, objectivity, professional competence, confidentiality, and professional behavior.",
    keyParagraphs: [
      { ref: "Part 4A.1", text: "A firm shall be independent of the audit client during the period of the audit engagement." },
      { ref: "R540.4", text: "A professional accountant shall apply the conceptual framework to identify, evaluate, and address threats to independence." },
    ],
    auditImplication: "Independence must be established and documented before engagement acceptance and maintained throughout. Threats must be evaluated using the conceptual framework.",
    category: "ETHICS",
  },
  "COMPANIES_ACT_2017": {
    code: "Companies Act 2017",
    title: "Companies Act 2017 (Pakistan)",
    summary: "Governs the formation, regulation, and winding up of companies in Pakistan. Contains specific requirements for auditors.",
    keyParagraphs: [
      { ref: "Section 246", text: "Every company shall appoint an auditor at its annual general meeting." },
      { ref: "Section 249", text: "The auditor's report shall state whether the financial statements give a true and fair view." },
      { ref: "Section 252", text: "The auditor shall have a right of access at all times to the books and records of the company." },
    ],
    auditImplication: "Statutory audit reports must comply with Companies Act requirements in addition to ISA. Specific disclosures and reporting requirements apply.",
    category: "LAW",
  },
  "SECP_REQUIREMENTS": {
    code: "SECP/AOB/QCR",
    title: "Securities and Exchange Commission of Pakistan / Audit Oversight Board Requirements",
    summary: "Regulatory requirements for audit quality, including QCR expectations and AOB inspection standards.",
    keyParagraphs: [
      { ref: "QCR Framework", text: "Engagement files must demonstrate compliance with ISA, adequate documentation, and timely completion of audit procedures." },
      { ref: "AOB Inspection", text: "AOB inspections focus on engagement quality, independence, risk assessment, and sufficiency of audit evidence." },
    ],
    auditImplication: "Audit files must be inspection-ready. Common QCR/AOB findings include inadequate documentation, weak risk assessment, and insufficient substantive procedures.",
    category: "REGULATORY",
  },
};

export function getStandardsByPage(pageId: string): StandardReference[] {
  const mapping = PAGE_STANDARDS_MAP[pageId];
  if (!mapping) return [];
  return mapping.map(code => STANDARDS_LIBRARY[code]).filter(Boolean);
}

export function getStandardByCode(code: string): StandardReference | undefined {
  return STANDARDS_LIBRARY[code];
}

export function searchStandards(query: string): StandardReference[] {
  const q = query.toLowerCase();
  return Object.values(STANDARDS_LIBRARY).filter(s =>
    s.code.toLowerCase().includes(q) ||
    s.title.toLowerCase().includes(q) ||
    s.summary.toLowerCase().includes(q) ||
    s.auditImplication.toLowerCase().includes(q)
  );
}

export const PAGE_STANDARDS_MAP: Record<string, string[]> = {
  "acceptance": ["ISA_210", "ISA_220", "ISQM_1", "ICAP_ETHICS", "ISA_240"],
  "independence": ["ICAP_ETHICS", "ISA_220", "ISQM_1"],
  "tb-gl-upload": ["ISA_500", "ISA_230"],
  "validation": ["ISA_500", "ISA_520", "ISA_230"],
  "coa-mapping": ["ISA_500", "ISA_315", "ISA_230"],
  "materiality": ["ISA_320", "ISA_450", "ISA_230"],
  "risk-assessment": ["ISA_315", "ISA_240", "ISA_330", "ISA_570"],
  "planning-strategy": ["ISA_300", "ISA_315", "ISA_330", "ISA_260"],
  "analytical-procedures": ["ISA_520", "ISA_315", "ISA_500"],
  "procedures-sampling": ["ISA_330", "ISA_530", "ISA_500", "ISA_520"],
  "execution-testing": ["ISA_330", "ISA_500", "ISA_505", "ISA_530", "ISA_540"],
  "evidence-linking": ["ISA_500", "ISA_330", "ISA_230"],
  "observations": ["ISA_265", "ISA_450", "ISA_260"],
  "adjustments": ["ISA_450", "ISA_580", "ISA_260"],
  "finalization": ["ISA_560", "ISA_570", "ISA_580", "ISA_230", "ISA_520"],
  "opinion-reports": ["ISA_700", "ISA_705", "ISA_706", "ISA_720", "ISA_260"],
  "eqcr": ["ISQM_2", "ISA_220"],
  "inspection": ["ISQM_1", "SECP_REQUIREMENTS"],
  "fraud-assessment": ["ISA_240", "ISA_315"],
  "going-concern": ["ISA_570", "ISA_580"],
  "laws-regulations": ["ISA_250", "COMPANIES_ACT_2017", "SECP_REQUIREMENTS"],
  "related-parties": ["ISA_550", "ISA_240"],
  "journal-entry-testing": ["ISA_240", "ISA_330", "ISA_500"],
  "internal-controls": ["ISA_315", "ISA_265", "ISA_330"],
  "substantive-testing": ["ISA_330", "ISA_500", "ISA_530", "ISA_540"],
  "subsequent-events": ["ISA_560", "ISA_700"],
  "representation-letter": ["ISA_580"],
  "completion-checklist": ["ISA_220", "ISA_230", "ISQM_1"],
  "document-management": ["ISA_230", "ISQM_1"],
  "management-letter": ["ISA_265", "ISA_260"],
  "audit-report": ["ISA_700", "ISA_705", "ISA_706", "ISA_720"],
};
