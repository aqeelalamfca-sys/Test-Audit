import type { AuditPhase } from "@prisma/client";

export interface ChecklistTemplate {
  phase: AuditPhase;
  section: string;
  title: string;
  description: string;
  isaReference: string;
  orderIndex: number;
}

export const ONBOARDING_CHECKLIST: ChecklistTemplate[] = [
  {
    phase: "ONBOARDING",
    section: "Legal Existence",
    title: "Verify SECP Registration",
    description: "Confirm company registration with Securities and Exchange Commission of Pakistan",
    isaReference: "ISA 210.6",
    orderIndex: 1,
  },
  {
    phase: "ONBOARDING",
    section: "Legal Existence",
    title: "Obtain Certificate of Incorporation",
    description: "Obtain and verify the certificate of incorporation from SECP",
    isaReference: "ISA 210.6",
    orderIndex: 2,
  },
  {
    phase: "ONBOARDING",
    section: "Legal Existence",
    title: "Verify NTN Registration",
    description: "Confirm National Tax Number registration with FBR",
    isaReference: "ISA 210.6",
    orderIndex: 3,
  },
  {
    phase: "ONBOARDING",
    section: "Legal Existence",
    title: "Verify STRN Registration",
    description: "Confirm Sales Tax Registration Number if applicable",
    isaReference: "ISA 210.6",
    orderIndex: 4,
  },
  {
    phase: "ONBOARDING",
    section: "Legal Existence",
    title: "Obtain Memorandum and Articles of Association",
    description: "Obtain current MOA/AOA and verify authorized activities",
    isaReference: "ISA 210.6",
    orderIndex: 5,
  },
  {
    phase: "ONBOARDING",
    section: "Independence Pre-check",
    title: "Financial Interest Assessment",
    description: "Confirm no financial interests in the client by engagement team members",
    isaReference: "ISA 200.14, IESBA 510",
    orderIndex: 6,
  },
  {
    phase: "ONBOARDING",
    section: "Independence Pre-check",
    title: "Business Relationship Assessment",
    description: "Evaluate any business relationships with client or its management",
    isaReference: "ISA 200.14, IESBA 520",
    orderIndex: 7,
  },
  {
    phase: "ONBOARDING",
    section: "Independence Pre-check",
    title: "Family and Personal Relationships",
    description: "Identify any family or personal relationships with client personnel",
    isaReference: "ISA 200.14, IESBA 521-524",
    orderIndex: 8,
  },
  {
    phase: "ONBOARDING",
    section: "Independence Pre-check",
    title: "Prior Services Assessment",
    description: "Review any non-audit services previously provided to the client",
    isaReference: "ISA 200.14, IESBA 600",
    orderIndex: 9,
  },
  {
    phase: "ONBOARDING",
    section: "Independence Pre-check",
    title: "Fee Dependency Assessment",
    description: "Evaluate fee dependency and ensure compliance with 15% threshold (listed) / 25% threshold (non-listed)",
    isaReference: "ISA 200.14, IESBA 410",
    orderIndex: 10,
  },
  {
    phase: "ONBOARDING",
    section: "Ethics Compliance",
    title: "Integrity of Management Assessment",
    description: "Evaluate integrity of principal owners, key management, and those charged with governance",
    isaReference: "ISA 220.12-15",
    orderIndex: 11,
  },
  {
    phase: "ONBOARDING",
    section: "Ethics Compliance",
    title: "AML/CFT Screening",
    description: "Complete Anti-Money Laundering and Counter Financing of Terrorism screening",
    isaReference: "ISQM 1.30, Companies Act 2017",
    orderIndex: 12,
  },
  {
    phase: "ONBOARDING",
    section: "Ethics Compliance",
    title: "Sanctions Screening",
    description: "Screen against UNSC, OFAC, and Pakistan MoFA sanctions lists",
    isaReference: "ISQM 1.30",
    orderIndex: 13,
  },
  {
    phase: "ONBOARDING",
    section: "Ethics Compliance",
    title: "PEP Screening",
    description: "Screen for Politically Exposed Persons among ownership and management",
    isaReference: "ISQM 1.30, AML Act 2010",
    orderIndex: 14,
  },
  {
    phase: "ONBOARDING",
    section: "Ethics Compliance",
    title: "Competence Assessment",
    description: "Confirm firm has competence, capabilities, and resources to perform the engagement",
    isaReference: "ISA 220.18-23",
    orderIndex: 15,
  },
  {
    phase: "ONBOARDING",
    section: "Prior Auditor Communication",
    title: "Prior Auditor Inquiry Letter",
    description: "Send inquiry letter to predecessor auditor regarding reasons for change",
    isaReference: "ISA 210.13, IESBA 320",
    orderIndex: 16,
  },
  {
    phase: "ONBOARDING",
    section: "Prior Auditor Communication",
    title: "Review Prior Auditor Response",
    description: "Evaluate predecessor auditor's response and any matters requiring consideration",
    isaReference: "ISA 210.13",
    orderIndex: 17,
  },
  {
    phase: "ONBOARDING",
    section: "Acceptance Decision",
    title: "Client Risk Categorization",
    description: "Complete risk assessment and assign client risk category (Low/Normal/High)",
    isaReference: "ISQM 1.30(b)",
    orderIndex: 18,
  },
  {
    phase: "ONBOARDING",
    section: "Acceptance Decision",
    title: "Prepare Client Acceptance Memo",
    description: "Document acceptance decision with supporting rationale",
    isaReference: "ISA 220.21-22",
    orderIndex: 19,
  },
  {
    phase: "ONBOARDING",
    section: "Acceptance Decision",
    title: "Partner Approval",
    description: "Obtain engagement partner approval for client acceptance",
    isaReference: "ISA 220.21",
    orderIndex: 20,
  },
  {
    phase: "ONBOARDING",
    section: "Engagement Setup",
    title: "Prepare Engagement Letter",
    description: "Draft engagement letter per ISA 210 requirements",
    isaReference: "ISA 210.10-11",
    orderIndex: 21,
  },
  {
    phase: "ONBOARDING",
    section: "Engagement Setup",
    title: "Obtain Signed Engagement Letter",
    description: "Obtain management signature on engagement letter",
    isaReference: "ISA 210.10",
    orderIndex: 22,
  },
  {
    phase: "ONBOARDING",
    section: "Engagement Setup",
    title: "Initial PBC List",
    description: "Prepare and send initial Prepared by Client (PBC) document request list",
    isaReference: "ISA 500.6",
    orderIndex: 23,
  },
  {
    phase: "ONBOARDING",
    section: "Engagement Setup",
    title: "Assign Engagement Team",
    description: "Assign qualified engagement team members with appropriate competence",
    isaReference: "ISA 220.25-27",
    orderIndex: 24,
  },
];

export function getChecklistForPhase(phase: AuditPhase): ChecklistTemplate[] {
  switch (phase) {
    case "ONBOARDING":
      return ONBOARDING_CHECKLIST;
    default:
      return [];
  }
}
