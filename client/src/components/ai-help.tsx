import React, { useState } from "react";
import { HelpCircle, Lightbulb, Copy, Check } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface AIHelpGuidance {
  title: string;
  description: string;
  standardReference: string;
  suggestions: string[];
  examples: {
    label: string;
    value: string;
  }[];
  tips: string[];
  commonMistakes: string[];
}

interface AIHelpProps {
  fieldName: string;
  category: "planning" | "execution" | "evidence" | "compliance" | "qc" | "reviewNotes" | "completion";
  onSuggestionApply?: (value: string) => void;
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "icon" | "button";
}

// Comprehensive guidance database for audit fields
const AUDIT_GUIDANCE_DATABASE: Record<
  string,
  Record<string, AIHelpGuidance>
> = {
  planning: {
    materiality: {
      title: "Materiality Assessment",
      description:
        "Determine quantitative and qualitative thresholds for audit planning, ensuring the audit addresses significant items and potential misstatements.",
      standardReference: "ISA 320 - Materiality in Planning and Performing an Audit",
      suggestions: [
        "Calculate materiality as 5-10% of profit before tax for commercial entities",
        "Consider 1-2% of revenue as alternative benchmark for entities with lower profitability",
        "For non-profit entities, base on total assets or expenditures",
        "Include performance materiality (typically 75% of materiality)",
        "Set clearly identifiable misstatements threshold (lower of 5% of materiality)",
      ],
      examples: [
        { label: "Profit-Based (Manufacturing)", value: "7% of profit before tax" },
        { label: "Revenue-Based (Trading)", value: "2% of total revenue" },
        { label: "Asset-Based (Financial Institution)", value: "0.5-1% of total assets" },
        { label: "Expenditure-Based (NGO)", value: "1% of total expenditures" },
      ],
      tips: [
        "Document benchmark selection and rationale in audit planning memorandum",
        "Reconsider materiality if significant changes occur during audit execution",
        "Use consistent benchmarks across audit phases for comparability",
        "Ensure audit procedures target items exceeding performance materiality",
        "Document any qualitative factors considered in materiality assessment",
      ],
      commonMistakes: [
        "Using benchmark without adjusting for entity-specific factors",
        "Setting performance materiality without clear percentage rationale",
        "Failing to identify clearly identifiable misstatements threshold",
        "Ignoring qualitative materiality factors (regulatory violations, fraud indicators)",
        "Not documenting materiality levels and their rationale",
      ],
    },
    riskAssessment: {
      title: "Risk Assessment and Response",
      description:
        "Identify, assess, and respond to risks of material misstatement through planned audit procedures that address identified risks.",
      standardReference: "ISA 315 - Identifying and Assessing the Risks of Material Misstatement",
      suggestions: [
        "Assess inherent risk for each significant account based on complexity and history",
        "Evaluate control environment, management integrity, and governance",
        "Identify fraud risks including management override of controls",
        "Assess client business risks that could lead to accounting misstatements",
        "Design audit procedures proportionate to assessed risk levels",
      ],
      examples: [
        {
          label: "High Risk - Revenue (Growth Company)",
          value: "Inherent Risk: High | Testing: 50% of transactions or $500K threshold",
        },
        {
          label: "Low Risk - Debt (Stable Bonds)",
          value: "Inherent Risk: Low | Testing: 25% of transactions or analytical review",
        },
        {
          label: "High Risk - Inventory (Manufacturing)",
          value: "Inherent Risk: High | Testing: Physical observation + valuation testing",
        },
        {
          label: "Medium Risk - Receivables",
          value: "Inherent Risk: Medium | Testing: Aging analysis + confirmations",
        },
      ],
      tips: [
        "Document understanding of entity's business and industry environment",
        "Use professional skepticism when identifying fraud risks",
        "Consider prior year findings and management estimates",
        "Link identified risks directly to audit procedures and evidence gathering",
        "Assess both probability and potential impact of identified risks",
      ],
      commonMistakes: [
        "Generic risk assessments without entity-specific considerations",
        "Failing to identify fraud risks and management override risks",
        "Not updating risk assessment when significant changes occur",
        "Disproportionate audit effort (insufficient testing of high risks)",
        "Insufficient documentation of risk identification process",
      ],
    },
    auditStrategy: {
      title: "Audit Strategy and Planning Approach",
      description:
        "Develop comprehensive audit strategy establishing overall scope, timing, and resource allocation for the engagement.",
      standardReference: "ISA 300 - Planning an Audit of Financial Statements",
      suggestions: [
        "Determine significant accounts and transaction classes based on risk and materiality",
        "Establish audit timelines for interim and final audit phases",
        "Allocate resources based on risk levels and complexity",
        "Identify key areas requiring specialized expertise",
        "Consider preliminary analytical procedures to identify unusual items",
      ],
      examples: [
        {
          label: "Interim Audit Period",
          value: "6-8 weeks before year-end; focus on controls testing and risk assessment",
        },
        {
          label: "Final Audit Period",
          value: "4-6 weeks after year-end; focus on transactions and final balances",
        },
        {
          label: "Significant Account",
          value: "Accounts > 10% of materiality or high complexity/risk",
        },
      ],
      tips: [
        "Maintain regular communication with management about planned procedures",
        "Identify accounting areas requiring technical expertise early",
        "Plan interim procedures to reduce final audit period workload",
        "Coordinate with component auditors for group audits",
        "Document audit strategy in engagement planning memorandum",
      ],
      commonMistakes: [
        "Inadequate planning leading to audit timeline pressures",
        "Insufficient resource allocation for high-risk areas",
        "Failure to identify significant accounts early",
        "Not communicating planned approach to management",
        "Ignoring prior year findings in strategy development",
      ],
    },
  },
  execution: {
    sampling: {
      title: "Audit Sampling Methodology",
      description:
        "Apply statistical or non-statistical sampling to populations when testing transactions, balances, and controls.",
      standardReference: "ISA 530 - Audit Sampling",
      suggestions: [
        "Define audit objective clearly before determining sample size",
        "Use statistical sampling for large homogeneous populations for reliability",
        "Use non-statistical sampling for smaller populations or focused testing",
        "Determine acceptable error rate (5-10% depending on audit significance)",
        "Document sampling methodology, rationale, and results",
      ],
      examples: [
        {
          label: "Statistical Sampling",
          value: "Monthly transactions: Population 5,000 | Confidence 95% | Precision 2% | Sample size ~280",
        },
        {
          label: "Non-Statistical - Revenue",
          value: "Population $10M | Materiality $500K | Sample: 30-40 largest + random 20-30 others",
        },
        {
          label: "Systematic Sampling",
          value: "Every Nth item from sequential list based on calculated interval",
        },
      ],
      tips: [
        "Use judgmental sampling for high-value or unusual items (always test)",
        "Apply stratification to test items across different value ranges",
        "Calculate sample size considering population size, acceptable risk, and tolerable error",
        "Document population definition and exclusions clearly",
        "Perform evaluation and projection of sample results to population",
      ],
      commonMistakes: [
        "Inadequate sample size leading to inconclusive audit evidence",
        "Not stratifying high-value items (always test material items separately)",
        "Using population definition that doesn't match audit objective",
        "Projection method not appropriate for sampling design used",
        "Not documenting statistical or non-statistical methodology",
      ],
    },
    substantiveTestingApproach: {
      title: "Substantive Testing Procedures",
      description:
        "Execute tests of details and analytical procedures to gather direct evidence about account balances and transaction amounts.",
      standardReference: "ISA 330 - The Auditor's Responses to Assessed Risks",
      suggestions: [
        "Design procedures addressing specific identified risks for each account",
        "Include tests addressing fraud risk areas and journal entry controls",
        "Perform analytical procedures to identify unusual trends or relationships",
        "Test significant items and balances above performance materiality",
        "Verify supporting documentation for sample transactions",
      ],
      examples: [
        {
          label: "Receivables Testing",
          value: "Confirmation of large customers | Aging analysis | Cutoff testing | Allowance evaluation",
        },
        {
          label: "Inventory Testing",
          value: "Observation of physical count | Price testing | Cutoff analysis | Obsolescence review",
        },
        {
          label: "Revenue Testing",
          value: "Invoice verification | Shipment confirmation | Credit approval | Return analysis",
        },
      ],
      tips: [
        "Combine tests of details with analytical procedures for completeness",
        "Link substantive procedures directly to identified risks",
        "Perform cutoff testing near year-end to ensure period accuracy",
        "Verify completeness of populations before sampling",
        "Gather sufficient and appropriate evidence for audit opinion",
      ],
      commonMistakes: [
        "Insufficient substantive testing in high-risk accounts",
        "Generic procedures not addressing specific identified risks",
        "Inadequate audit trail documentation for tested items",
        "Not coordinating with management estimates and assumptions",
        "Insufficient evaluation of audit evidence gathered",
      ],
    },
  },
  evidence: {
    evidenceGathering: {
      title: "Audit Evidence Collection",
      description:
        "Obtain sufficient, appropriate audit evidence to draw conclusions and support audit opinion on financial statements.",
      standardReference: "ISA 500 - Audit Evidence",
      suggestions: [
        "Evidence should be relevant to account assertions and audit objectives",
        "Obtain evidence from multiple sources to achieve sufficiency and appropriateness",
        "Evaluate evidence reliability (independent sources more reliable than client-prepared)",
        "Document evidence source, date, and conclusion in working papers",
        "Consider evidence interdependencies (one weakness may affect related accounts)",
      ],
      examples: [
        {
          label: "Confirmations",
          value: "Bank confirmations, customer confirmations, vendor confirmations",
        },
        {
          label: "Inspection",
          value: "Physical inspection of assets, inspection of documents and records",
        },
        {
          label: "Observation",
          value: "Observation of inventory count, observation of cash counts",
        },
        {
          label: "Analytical Procedures",
          value: "Trend analysis, ratio analysis, reasonableness testing",
        },
      ],
      tips: [
        "Use professional skepticism when evaluating management representations",
        "Obtain management representations in writing at audit completion",
        "Evaluate management's estimates using auditor judgment and external data",
        "Consider consistency of evidence across different account areas",
        "Document conclusions and how evidence supports assertions",
      ],
      commonMistakes: [
        "Relying solely on client-provided evidence without corroboration",
        "Insufficient evidence for significant accounts or risks",
        "Not evaluating reliability and relevance of evidence sources",
        "Generic conclusions not linked to specific evidence gathered",
        "Inadequate documentation of evidence source and evaluation",
      ],
    },
    workingPaperDocumentation: {
      title: "Working Paper Documentation",
      description:
        "Create comprehensive working paper documentation providing audit trail for all procedures performed and evidence obtained.",
      standardReference: "ISA 230 - Audit Documentation",
      suggestions: [
        "Document audit procedures performed, including who performed and when",
        "Record evidence obtained with source, date, and any limitations",
        "Include conclusions and how evidence supports audit objectives",
        "Use consistent indexing and cross-referencing across working papers",
        "Maintain working paper organization with clear account structure",
      ],
      examples: [
        {
          label: "Testing Documentation",
          value: "Procedure tested | Sample selection method | Results | Conclusion | Sign-off",
        },
        {
          label: "Control Testing",
          value: "Control description | Test method | Sample | Deviations | Reliance determination",
        },
        {
          label: "Reconciliation",
          value: "From-To explanation | Supporting detail | Variance analysis | Approval date",
        },
      ],
      tips: [
        "Use audit software or templates for consistent documentation",
        "Include sufficient detail for file review and quality control",
        "Document any matters arising during audit execution",
        "Maintain clear audit trail linking procedures to conclusions",
        "Ensure working papers support audit opinion",
      ],
      commonMistakes: [
        "Insufficient documentation for procedures performed",
        "Missing explanations for variances or exceptions noted",
        "Inadequate cross-referencing between working papers",
        "Concluding without explaining how evidence supports conclusion",
        "Working papers not organized in logical account structure",
      ],
    },
  },
  compliance: {
    independenceEthics: {
      title: "Independence and Ethics Compliance",
      description:
        "Maintain auditor independence and comply with ethical requirements throughout the audit engagement.",
      standardReference: "IESBA Code of Ethics for Professional Accountants",
      suggestions: [
        "Confirm independence from client at engagement acceptance and throughout year",
        "Document any relationships, financial interests, or family connections with client",
        "Disclose and manage conflicts of interest properly with appropriate parties",
        "Avoid providing services that would impair audit independence",
        "Evaluate threats to independence from non-audit services",
      ],
      examples: [
        {
          label: "Independence Threat",
          value: "Auditor owns company stock | Threat: Financial interest | Mitigation: Divest before engagement",
        },
        {
          label: "Familiarity Threat",
          value: "Auditor worked in client's finance department | Threat: Long relationship | Mitigation: Rotate after 5-7 years",
        },
        {
          label: "Advocacy Threat",
          value: "Providing tax services for aggressive position | Threat: Audit opinion affected | Mitigation: Review by independent partner",
        },
      ],
      tips: [
        "Document independence assessment in engagement file",
        "Complete independence questionnaires for all engagement team members",
        "Monitor for new independence matters during the year",
        "Communicate restrictions to client upfront",
        "Maintain independence in appearance and fact",
      ],
      commonMistakes: [
        "Not documenting independence evaluation",
        "Providing services that create independence threats",
        "Failing to identify and manage conflicts of interest",
        "Insufficient rotation of key audit personnel",
        "Not re-evaluating independence during engagement",
      ],
    },
    fraudCompliance: {
      title: "Fraud Risk Assessment and Procedures",
      description:
        "Identify fraud risks and perform procedures to address management override of controls and fraudulent financial reporting.",
      standardReference: "ISA 240 - The Auditor's Responsibilities Relating to Fraud",
      suggestions: [
        "Perform brainstorming session with audit team to discuss fraud risks",
        "Assess fraud risk across all accounts, not just high-value ones",
        "Identify high-risk fraud areas: revenue, management estimates, journal entries",
        "Design procedures to address management override of controls",
        "Perform analytical procedures to identify unusual journal entries or transactions",
      ],
      examples: [
        {
          label: "Revenue Fraud Risk",
          value: "Procedure: Cutoff testing | Unusual credit memos | Channel stuffing analysis",
        },
        {
          label: "Journal Entry Fraud",
          value: "Procedure: Large/unusual entries tested | Non-standard entries examined | Approvals verified",
        },
        {
          label: "Estimates Fraud",
          value: "Procedure: Assumptions reviewed | Historical comparisons | Management bias assessment",
        },
      ],
      tips: [
        "Use professional skepticism throughout audit",
        "Maintain awareness of fraud indicators and red flags",
        "Test journal entries with unusual characteristics or risk factors",
        "Evaluate management estimates for bias or unreasonableness",
        "Document any fraud risks identified and procedures addressing them",
      ],
      commonMistakes: [
        "Assuming management is honest without evidence",
        "Not identifying revenue or estimate-related fraud risks",
        "Insufficient testing of management journal entries",
        "Not evaluating management estimates critically",
        "Not documenting fraud risk assessment procedures",
      ],
    },
  },
  qc: {
    qualityControl: {
      title: "Quality Control and Review Procedures",
      description:
        "Implement quality control procedures ensuring audit work meets firm standards and professional requirements.",
      standardReference: "ISQM 1 - Quality Management for Firms",
      suggestions: [
        "Document quality control policies addressing competence and independence",
        "Implement review procedures for significant judgments and conclusions",
        "Ensure engagement quality review by senior partner before opinion issuance",
        "Evaluate sufficiency and appropriateness of evidence gathered",
        "Document review procedures and conclusions in working papers",
      ],
      examples: [
        {
          label: "Engagement Quality Review",
          value: "Senior review of key matters | Risk assessment | Materiality | Critical judgments | Opinion support",
        },
        {
          label: "Technical Review",
          value: "Review of accounting treatments | Complex transactions | Disclosures | Changes in standards",
        },
        {
          label: "Compliance Review",
          value: "Independence verification | ISA compliance | Client requirements | Ethics compliance",
        },
      ],
      tips: [
        "Complete quality control reviews before audit report issuance",
        "Ensure reviewers are senior members with appropriate competence",
        "Document specific matters reviewed and conclusions",
        "Address any deficiencies identified in review process",
        "Maintain quality control file for regulatory inspection",
      ],
      commonMistakes: [
        "Insufficient quality control reviews before report issuance",
        "Quality review by person without adequate seniority",
        "Not documenting specific matters reviewed",
        "Failing to address quality control findings",
        "Inadequate independence verification",
      ],
    },
    auditDocumentationReview: {
      title: "Audit File Documentation Review",
      description:
        "Ensure audit file contains all necessary documentation supporting the audit conclusion and opinion.",
      standardReference: "ISA 230 - Audit Documentation",
      suggestions: [
        "Maintain organized file structure indexed to financial statement account",
        "Ensure all working papers cross-referenced with final conclusion",
        "Document significant matters, key judgments, and audit conclusions",
        "Retain evidence supporting conclusions drawn",
        "Ensure file demonstrates audit meets ISA requirements",
      ],
      examples: [
        {
          label: "File Organization",
          value: "Planning | Accounts Receivable | Inventory | PPE | Liabilities | Equity | Final matters",
        },
        {
          label: "Review Checklist",
          value: "Risk assessment complete | Materiality documented | All accounts audited | Evidence sufficient",
        },
      ],
      tips: [
        "Use standardized file structure across all engagements",
        "Clearly label sections and use consistent indexing",
        "Include engagement letter, planning memorandum, and final conclusions",
        "Ensure management representation letter is included",
        "Maintain file in accessible format for quality review and inspection",
      ],
      commonMistakes: [
        "Disorganized working paper file",
        "Missing key documentation components",
        "Inadequate cross-referencing and indexing",
        "File not ready for quality review or inspection",
        "Key conclusions not clearly documented",
      ],
    },
  },
  reviewNotes: {
    reviewNoteCreation: {
      title: "Creating Effective Review Notes",
      description:
        "Draft clear, actionable review notes that facilitate efficient communication between team members and ensure audit issues are properly tracked and resolved.",
      standardReference: "ISA 220 - Quality Management for an Audit | ISA 230 - Audit Documentation",
      suggestions: [
        "State the issue clearly with specific reference to the account, balance, or procedure affected",
        "Include the working paper or section reference (e.g., BS.01, PL.03) for traceability",
        "Specify the expected resolution and deadline for the assignee",
        "Classify severity accurately: INFO for observations, LOW/MEDIUM for routine matters, WARNING/HIGH for significant issues, CRITICAL for items affecting the audit opinion",
        "Attach supporting evidence or screenshots where applicable",
      ],
      examples: [
        { label: "Issue - Missing confirmation", value: "Bank confirmation for Account #4521 at MCB not received. Follow up required before finalization." },
        { label: "Question - Accounting treatment", value: "Management capitalized PKR 2.5M repair costs to PPE. Verify whether this meets IAS 16 recognition criteria." },
        { label: "To-Do - Procedure pending", value: "Complete subsequent events review for period 01-Jul to date of report. Check board minutes and post-period transactions." },
      ],
      tips: [
        "Use specific subject lines that identify the account and nature of the issue",
        "Assign notes to the team member responsible for the working paper area",
        "Set realistic due dates aligned with the audit timeline",
        "Reference the relevant ISA or accounting standard when applicable",
        "Include quantitative impact where possible (PKR amount, % of materiality)",
      ],
      commonMistakes: [
        "Vague subject lines like 'Please check' without identifying the issue",
        "Not assigning the note to a specific team member",
        "Missing the working paper reference, making it hard to locate the related work",
        "Setting all notes as CRITICAL when most are routine matters",
        "Not including enough context for the assignee to act without further clarification",
      ],
    },
    reviewNoteResolution: {
      title: "Resolving and Clearing Review Notes",
      description:
        "Document adequate resolution of review points, ensuring proper evidence trail and sign-off by the appropriate reviewer level.",
      standardReference: "ISA 220 - Quality Management for an Audit",
      suggestions: [
        "Provide specific resolution details: what was done, what evidence was obtained, and the conclusion reached",
        "Reference additional working papers or evidence gathered to address the point",
        "Ensure the resolution addresses the root cause, not just the symptom",
        "Only mark as ADDRESSED when the work is complete; a manager must CLEAR the note",
        "Document any changes to audit procedures resulting from the review note",
      ],
      examples: [
        { label: "Confirmation resolved", value: "Bank confirmation received 15-Jan. Balance confirmed at PKR 12.5M, no variance. Filed in BS.01." },
        { label: "Accounting treatment resolved", value: "Discussed with management. PKR 1.8M relates to capacity enhancement (capitalize per IAS 16). PKR 0.7M is routine maintenance (expense). Adjustment proposed." },
      ],
      tips: [
        "Always include the date and reference to evidence when resolving",
        "If the original issue led to an audit adjustment, reference the adjustment entry",
        "Escalate unresolved critical notes to the engagement partner before report issuance",
        "Ensure all notes are cleared before the audit file assembly deadline",
        "Use the reply thread to document interim progress on complex issues",
      ],
      commonMistakes: [
        "Marking notes as addressed without documenting what was done",
        "Clearing notes without manager-level review",
        "Leaving critical notes open past the report issuance date",
        "Not linking the resolution back to the working paper where the fix was applied",
        "Insufficient resolution detail for regulatory inspection purposes",
      ],
    },
  },
  completion: {
    goingConcern: {
      title: "Going Concern Assessment",
      description:
        "Evaluate whether the entity can continue as a going concern for at least 12 months from the reporting date, considering financial, operational, and other indicators.",
      standardReference: "ISA 570 - Going Concern",
      suggestions: [
        "Review financial indicators: recurring losses, negative working capital, inability to pay creditors on time",
        "Assess operating indicators: loss of key management, labor difficulties, loss of major market",
        "Evaluate management's plans to address going concern doubts",
        "Obtain management representations regarding going concern",
        "Consider adequacy of related disclosures in financial statements",
      ],
      examples: [
        { label: "No GC doubt", value: "Entity profitable, positive working capital, no adverse indicators identified. Going concern basis appropriate." },
        { label: "Material uncertainty", value: "Entity has net current liabilities of PKR 50M and recurring losses. Management plans include asset disposal and refinancing. Material uncertainty disclosure required." },
      ],
      tips: [
        "Look at post-period events that may affect going concern assessment",
        "Challenge management's assumptions in cash flow forecasts",
        "Consider the impact on audit opinion if going concern is in doubt",
        "Document the assessment even when no concerns are identified",
        "Review loan covenants and debt maturity schedules",
      ],
      commonMistakes: [
        "Not performing going concern assessment for seemingly healthy entities",
        "Relying solely on management representations without corroboration",
        "Failing to consider post-period events",
        "Inadequate documentation of the assessment process",
        "Not modifying the audit opinion when material uncertainty exists",
      ],
    },
    subsequentEvents: {
      title: "Subsequent Events Review",
      description:
        "Identify and evaluate events occurring between the period end and the date of the auditor's report that may require adjustment or disclosure.",
      standardReference: "ISA 560 - Subsequent Events",
      suggestions: [
        "Review post-period board minutes and management committee meetings",
        "Examine significant transactions after the reporting period",
        "Inquire about litigation, claims, and contingencies arising after period end",
        "Review latest interim financial information and management accounts",
        "Assess impact of post-period events on financial statement assertions",
      ],
      examples: [
        { label: "Adjusting event", value: "Major customer declared insolvent in January (PKR 8M receivable). Provision required as condition existed at period end." },
        { label: "Non-adjusting event", value: "Acquisition of subsidiary announced in February for PKR 100M. Disclosure required, no adjustment needed." },
      ],
      tips: [
        "Extend subsequent events procedures as close as possible to the report date",
        "Distinguish between adjusting and non-adjusting events per IAS 10",
        "Document all inquiries made and responses received",
        "Obtain written representations covering the period to the report date",
        "Consider the impact on the auditor's report if events are not properly reflected",
      ],
      commonMistakes: [
        "Stopping subsequent events review too early before the report date",
        "Treating all post-period events as non-adjusting",
        "Not updating the going concern assessment for post-period events",
        "Failing to document nil responses to inquiries",
        "Not communicating significant subsequent events to those charged with governance",
      ],
    },
  },
};

export function AIHelpIcon({
  fieldName,
  category,
  onSuggestionApply,
  className,
  size = "md",
  variant = "icon",
}: AIHelpProps) {
  const [open, setOpen] = useState(false);
  const [copiedExample, setCopiedExample] = useState<number | null>(null);

  const guidance =
    AUDIT_GUIDANCE_DATABASE[category]?.[
      fieldName.charAt(0).toLowerCase() + fieldName.slice(1)
    ];

  if (!guidance) {
    return null;
  }

  const handleCopyExample = (value: string, index: number) => {
    navigator.clipboard.writeText(value);
    setCopiedExample(index);
    setTimeout(() => setCopiedExample(null), 2000);
  };

  const handleApplySuggestion = (suggestion: string) => {
    if (onSuggestionApply) {
      onSuggestionApply(suggestion);
      setOpen(false);
    }
  };

  const iconButtonClasses = cn(
    "inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors",
    {
      "h-4 w-4": size === "sm",
      "h-5 w-5": size === "md",
      "h-6 w-6": size === "lg",
    }
  );

  const trigger =
    variant === "icon" ? (
      <button type="button" className={cn(iconButtonClasses, className)}>
        <HelpCircle className="h-full w-full" data-testid="button-ai-help" />
      </button>
    ) : (
      <Button variant="ghost" size="sm" className={className} data-testid="button-ai-help-text">
        <Lightbulb className="h-4 w-4 mr-1" />
        AI Help
      </Button>
    );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-96 max-h-96 overflow-y-auto" align="start">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                {guidance.title}
              </h3>
              <Badge variant="outline" className="mt-1 text-xs">
                {guidance.standardReference}
              </Badge>
            </div>
          </div>

          {/* Description */}
          <p className="text-xs text-muted-foreground leading-relaxed">
            {guidance.description}
          </p>

          {/* Suggestions */}
          {guidance.suggestions.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium">Suggestions:</h4>
              <ul className="space-y-1">
                {guidance.suggestions.slice(0, 3).map((suggestion, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex gap-2">
                    <span className="flex-shrink-0 mt-1">•</span>
                    <span className="flex-1">{suggestion}</span>
                    {onSuggestionApply && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-4 w-4 flex-shrink-0"
                        onClick={() => handleApplySuggestion(suggestion)}
                        data-testid={`button-apply-suggestion-${i}`}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Examples */}
          {guidance.examples.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium">Examples:</h4>
              <div className="space-y-2">
                {guidance.examples.map((example, i) => (
                  <div
                    key={i}
                    className="bg-muted/50 p-2 rounded-md flex items-start justify-between gap-2"
                  >
                    <div className="flex-1">
                      <p className="text-xs font-medium text-foreground">
                        {example.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {example.value}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 flex-shrink-0"
                      onClick={() => handleCopyExample(example.value, i)}
                      data-testid={`button-copy-example-${i}`}
                    >
                      {copiedExample === i ? (
                        <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tips */}
          {guidance.tips.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium">Tips:</h4>
              <ul className="space-y-1">
                {guidance.tips.slice(0, 2).map((tip, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex gap-2">
                    <span className="flex-shrink-0 mt-1">✓</span>
                    <span className="flex-1">{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Common Mistakes */}
          {guidance.commonMistakes.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium">Common Mistakes to Avoid:</h4>
              <ul className="space-y-1">
                {guidance.commonMistakes.slice(0, 2).map((mistake, i) => (
                  <li key={i} className="text-xs text-amber-600 dark:text-amber-400 flex gap-2">
                    <span className="flex-shrink-0 mt-1">⚠</span>
                    <span className="flex-1">{mistake}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Close hint */}
          <p className="text-xs text-muted-foreground pt-2 border-t">
            Click outside or press Escape to close
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default AIHelpIcon;
