import { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import { useParams } from "wouter";
import { useEngagement } from "@/lib/workspace-context";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun, BorderStyle, Table, TableRow, TableCell, WidthType } from "docx";
import { getClientDocxLogoParagraph } from "@/lib/docx-logo";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileSignature,
  CheckCircle2,
  AlertCircle,
  Save,
  Plus,
  Loader2,
  FileText,
  FileDown,
  Wand2,
  RotateCcw,
  Eye,
  Edit3,
  HelpCircle,
  Info,
  Check,
  X,
  Paperclip,
} from "lucide-react";
import { SectionAttachments } from "./section-attachments";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import type { EngagementLetterChecklistRow } from "./shared-types";

const FIRM_DETAILS = {
  name: "AuditWise & Co.",
  tradingName: "AuditWise Chartered Accountants",
  registrationNo: "AW-2024-001",
  address: "Suite 501, Business Tower, Clifton, Karachi 75600, Pakistan",
  phone: "+92 21 3456 7890",
  email: "info@auditwise.pk",
  website: "www.auditwise.pk",
  icapMemberNo: "ICAP/2024/12345",
};

interface ChecklistQuestion {
  id: string;
  question: string;
  helpText: string;
  category: string;
  isaReference: string;
  suggestedResponse: string;
  isCustom?: boolean;
}

const ENGAGEMENT_CHECKLIST_QUESTIONS: ChecklistQuestion[] = [
  {
    id: "eng-1",
    question: "Have the preconditions for the audit been established?",
    helpText: "Preconditions include determining that the financial reporting framework is acceptable, and obtaining management's agreement on the premise of the audit including their responsibilities for internal controls and providing access to all relevant information.",
    category: "Preconditions",
    isaReference: "ISA 210.6",
    suggestedResponse: "Preconditions verified through client acceptance procedures and preliminary discussions with management.",
  },
  {
    id: "eng-2",
    question: "Has client acceptance and continuance been formally approved?",
    helpText: "The firm must assess whether to accept or continue a client relationship and specific engagement, considering integrity of the principal owners, key management and those charged with governance, and whether the engagement team is competent.",
    category: "Acceptance",
    isaReference: "ISQM 1.30",
    suggestedResponse: "Client acceptance approved per firm's quality management policies. Documented in acceptance checklist.",
  },
  {
    id: "eng-3",
    question: "Is the scope of the audit clearly defined in the engagement letter?",
    helpText: "The engagement letter must describe the scope of the audit including identification of the financial statements to be audited, the period covered, and the applicable financial reporting framework.",
    category: "Scope",
    isaReference: "ISA 210.10",
    suggestedResponse: "Scope clearly defined covering complete financial statements for the fiscal year under applicable framework.",
  },
  {
    id: "eng-4",
    question: "Has management acknowledged their responsibilities in writing?",
    helpText: "Management must acknowledge and understand their responsibility for preparing financial statements in accordance with the applicable framework, for internal controls necessary for preparation of financial statements free from material misstatement, and for providing the auditor with access to all relevant information.",
    category: "Responsibilities",
    isaReference: "ISA 210.6(b)",
    suggestedResponse: "Management responsibilities acknowledged through signed engagement letter including representations on internal controls and information access.",
  },
  {
    id: "eng-5",
    question: "Are the auditor's responsibilities clearly stated in the engagement letter?",
    helpText: "The engagement letter should describe the auditor's responsibilities including the objective of obtaining reasonable assurance, responsibility for auditor's opinion, and reference to applicable auditing standards.",
    category: "Responsibilities",
    isaReference: "ISA 210.10(b)",
    suggestedResponse: "Auditor responsibilities documented per ISA requirements including reasonable assurance objective and compliance with ISAs.",
  },
  {
    id: "eng-6",
    question: "Is the applicable financial reporting framework clearly specified?",
    helpText: "The engagement letter must identify the applicable financial reporting framework for the preparation of the financial statements (e.g., IFRS, Local GAAP, AAOIFI).",
    category: "Framework",
    isaReference: "ISA 210.10(a)",
    suggestedResponse: "Financial reporting framework (IFRS/Local GAAP) explicitly stated in engagement letter with reference to specific standards.",
  },
  {
    id: "eng-7",
    question: "Have fee structure and payment terms been agreed with the client?",
    helpText: "The engagement letter should include the basis on which fees are computed and billing arrangements, including any conditions for fee adjustments.",
    category: "Commercial",
    isaReference: "ISA 210.11",
    suggestedResponse: "Fee structure and payment terms agreed and documented. Billing milestones and payment schedule confirmed.",
  },
  {
    id: "eng-8",
    question: "Are limitation of liability clauses included per professional guidelines?",
    helpText: "Where permitted by law and professional regulations, the engagement letter may include provisions limiting the auditor's liability. ICAP guidelines should be followed for such clauses.",
    category: "Legal",
    isaReference: "ICAP Guidelines",
    suggestedResponse: "Liability limitation clauses included per ICAP professional guidelines with appropriate capping provisions.",
  },
  {
    id: "eng-9",
    question: "Has consent been obtained from the predecessor auditor (if applicable)?",
    helpText: "Before accepting an engagement, the proposed auditor should request management to authorize the predecessor auditor to respond to inquiries. Communication with predecessor auditor helps assess client integrity and obtain relevant information.",
    category: "Predecessor",
    isaReference: "ISA 300.13",
    suggestedResponse: "Consent letter obtained from predecessor auditor. No matters identified that would preclude acceptance.",
  },
  {
    id: "eng-10",
    question: "Has the draft engagement letter been reviewed and finalized?",
    helpText: "The engagement letter should be reviewed for completeness, accuracy, and compliance with firm standards before being sent to the client for signature.",
    category: "Review",
    isaReference: "ISA 210.9",
    suggestedResponse: "Draft engagement letter reviewed by engagement partner and finalized for client signature.",
  },
  {
    id: "eng-11",
    question: "Has a signed engagement letter been obtained from the client?",
    helpText: "The auditor shall agree the terms of the audit engagement with management or those charged with governance, as appropriate. The agreed terms shall be recorded in an audit engagement letter or other suitable form of written agreement.",
    category: "Documentation",
    isaReference: "ISA 210.9-10",
    suggestedResponse: "Signed engagement letter received and filed in permanent audit file.",
  },
  {
    id: "eng-12",
    question: "Has partner approval of the engagement terms been obtained?",
    helpText: "The engagement partner is responsible for ensuring that the terms of engagement are properly agreed and documented, and that the firm's quality management policies have been followed.",
    category: "Approval",
    isaReference: "ISA 220.14",
    suggestedResponse: "Engagement partner has reviewed and approved all engagement terms and documentation.",
  },
];

const getDefaultFormData = (clientName: string, fiscalYearEnd: string, engagementCode: string) => ({
  scopeOfAudit: `We will conduct a statutory audit of the financial statements of ${clientName || "[Client Name]"} for the year ending ${fiscalYearEnd || "[Year End Date]"} in accordance with International Standards on Auditing (ISAs) as adopted by the Institute of Chartered Accountants of Pakistan (ICAP).

The audit will cover:
• Statement of Financial Position as at ${fiscalYearEnd || "[Year End Date]"}
• Statement of Profit or Loss and Other Comprehensive Income
• Statement of Changes in Equity
• Statement of Cash Flows
• Notes to the Financial Statements, including material accounting policies

Our audit will be conducted to obtain reasonable assurance about whether the financial statements as a whole are free from material misstatement, whether due to fraud or error.`,

  managementResponsibilities: `Management is responsible for:

1. Preparation and Fair Presentation of Financial Statements
   • Preparing financial statements in accordance with the applicable financial reporting framework (IFRS/Local GAAP)
   • Ensuring fair presentation of financial position, performance, and cash flows

2. Internal Control
   • Designing, implementing, and maintaining internal controls relevant to the preparation of financial statements that are free from material misstatement
   • Safeguarding assets and preventing/detecting fraud and errors

3. Access and Information
   • Providing unrestricted access to all records, documents, and personnel necessary for the audit
   • Providing written representations on matters material to the financial statements
   • Providing a management representation letter upon completion of audit fieldwork

4. Regulatory Compliance
   • Ensuring compliance with applicable laws, regulations, and statutory requirements
   • Maintaining proper books of account as required under the Companies Act, 2017`,

  auditorResponsibilities: `As auditors, our responsibilities include:

1. Audit Opinion
   • Expressing an independent opinion on whether the financial statements present a true and fair view in accordance with the applicable financial reporting framework

2. Professional Standards
   • Conducting the audit in accordance with International Standards on Auditing (ISAs) as adopted by ICAP
   • Complying with the ICAP Code of Ethics including independence requirements

3. Audit Procedures
   • Performing risk assessment procedures to identify and assess risks of material misstatement
   • Designing and performing further audit procedures responsive to assessed risks
   • Obtaining sufficient appropriate audit evidence to support our opinion

4. Communication
   • Communicating significant findings to those charged with governance
   • Reporting any significant deficiencies in internal control identified during the audit
   • Issuing a management letter with recommendations for improvement

5. Limitations
   • An audit does not guarantee that all misstatements will be detected
   • We are not responsible for preventing fraud or errors`,

  reportingFramework: "ifrs",
  auditingStandards: "International Standards on Auditing (ISAs) as adopted by ICAP",
  reportForm: `Our audit report will include:
• Independent Auditor's Report on the Financial Statements
• Key Audit Matters (if applicable for listed entities)
• Report on compliance with the Companies Act, 2017
• Report on the adequacy of internal controls`,

  deliverables: `Upon completion of the audit, we will provide:
• Signed Audit Report on Financial Statements
• Management Letter with recommendations
• Internal Control Assessment Report
• Tax Compliance Review (if agreed)
• Draft financial statements review notes`,

  timeline: `Proposed audit timeline for ${engagementCode || "[Engagement Code]"}:
• Planning and risk assessment: Week 1-2
• Interim audit procedures: Week 3-4
• Year-end audit fieldwork: Week 5-8
• Draft report review: Week 9
• Final report issuance: Week 10`,

  feeStructure: `Professional fees for the statutory audit engagement:
• Base audit fee: PKR [Amount]
• Out-of-pocket expenses: Actual cost basis
• Additional services (if any): As agreed separately

Fee is based on anticipated cooperation from management and availability of requested documents within agreed timelines.`,

  paymentTerms: `Payment terms:
• 30% upon signing of engagement letter
• 40% upon completion of fieldwork
• 30% upon issuance of final audit report

Invoices are payable within 15 days of issuance. Late payments may attract interest at KIBOR + 2% per annum.`,

  additionalCosts: `Additional costs that may be billed separately:
• Travel and accommodation for out-of-station visits
• Specialist consultations (IT audit, actuarial, legal)
• Extended procedures due to significant issues identified
• Regulatory filing fees (if applicable)

All additional costs will be communicated and agreed in advance.`,

  liabilityLimitation: `In accordance with ICAP guidelines and professional standards:
• Our liability is limited to the amount of professional fees for this engagement
• We shall not be liable for any indirect, consequential, or special damages
• Any claims must be made within one year of delivery of the final audit report
• This limitation does not apply to fraud or willful misconduct on our part`,

  clientAcceptance: `By signing this engagement letter, ${clientName || "[Client Name]"} confirms:
• Agreement to the terms and conditions set forth herein
• Acknowledgment of management's responsibilities as outlined above
• Authorization for us to proceed with the audit engagement
• Commitment to provide full cooperation and timely access to information

This engagement letter remains effective until superseded by a new engagement letter or terminated in writing by either party.`,
});

const EngagementLetterTab = forwardRef<{ save: () => Promise<void> }>((props, ref) => {
  const { toast } = useToast();
  const { engagementId } = useParams();
  const { engagement, client } = useEngagement();
  const { firm } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingConsent, setGeneratingConsent] = useState(false);
  const [generatingEngLetter, setGeneratingEngLetter] = useState(false);
  const [activeView, setActiveView] = useState<"edit" | "preview">("edit");
  const [hasLoadedDefaults, setHasLoadedDefaults] = useState(false);

  const clientName = client?.name || "";
  const fiscalYearEnd = engagement?.fiscalYearEnd ? new Date(engagement.fiscalYearEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : "";
  const engagementCode = engagement?.engagementCode || "";

  const [formData, setFormData] = useState({
    scopeOfAudit: "",
    managementResponsibilities: "",
    auditorResponsibilities: "",
    reportingFramework: "",
    auditingStandards: "",
    reportForm: "",
    deliverables: "",
    timeline: "",
    feeStructure: "",
    paymentTerms: "",
    additionalCosts: "",
    liabilityLimitation: "",
    clientAcceptance: "",
  });

  const [checklistResponses, setChecklistResponses] = useState<Record<string, { response: string; remarks: string }>>(() => {
    const initial: Record<string, { response: string; remarks: string }> = {};
    ENGAGEMENT_CHECKLIST_QUESTIONS.forEach(q => {
      initial[q.id] = { response: "", remarks: "" };
    });
    return initial;
  });

  const [customQuestions, setCustomQuestions] = useState<ChecklistQuestion[]>([]);

  const allQuestions = [...ENGAGEMENT_CHECKLIST_QUESTIONS, ...customQuestions];

  const addCustomQuestion = () => {
    const newId = `eng-custom-${Date.now()}`;
    const newQuestion: ChecklistQuestion = {
      id: newId,
      question: "",
      helpText: "Custom question added by user",
      category: "Custom",
      isaReference: "N/A",
      suggestedResponse: "",
      isCustom: true,
    };
    setCustomQuestions(prev => [...prev, newQuestion]);
    setChecklistResponses(prev => ({
      ...prev,
      [newId]: { response: "", remarks: "" }
    }));
  };

  const updateCustomQuestion = (id: string, question: string) => {
    setCustomQuestions(prev => prev.map(q => q.id === id ? { ...q, question } : q));
  };

  const removeCustomQuestion = (id: string) => {
    setCustomQuestions(prev => prev.filter(q => q.id !== id));
    setChecklistResponses(prev => {
      const newResponses = { ...prev };
      delete newResponses[id];
      return newResponses;
    });
  };

  const updateChecklistResponse = (questionId: string, field: "response" | "remarks", value: string) => {
    setChecklistResponses(prev => ({
      ...prev,
      [questionId]: { ...prev[questionId], [field]: value }
    }));
  };

  const useSuggestedResponse = (questionId: string) => {
    const question = allQuestions.find(q => q.id === questionId);
    if (question?.suggestedResponse) {
      updateChecklistResponse(questionId, "remarks", question.suggestedResponse);
    }
  };

  const markAllYes = () => {
    const updated = { ...checklistResponses };
    allQuestions.forEach(q => {
      if (updated[q.id]) {
        updated[q.id] = { ...updated[q.id], response: "Yes" };
        if (!updated[q.id].remarks && q.suggestedResponse) {
          updated[q.id].remarks = q.suggestedResponse;
        }
      }
    });
    setChecklistResponses(updated);
    toast({ title: "All Marked Yes", description: "All questions marked as 'Yes' with suggested responses applied where empty." });
  };

  const isQuestionComplete = (questionId: string): boolean => {
    const resp = checklistResponses[questionId];
    if (!resp || !resp.response) return false;
    if (resp.response === "No" && !resp.remarks.trim()) return false;
    // Check if custom question has text
    const question = allQuestions.find(q => q.id === questionId);
    if (question?.isCustom && !question.question.trim()) return false;
    return true;
  };

  const completedCount = allQuestions.filter(q => isQuestionComplete(q.id)).length;
  const totalQuestions = allQuestions.length;

  // Legacy compatibility - convert old format to new
  const [engagementRows, setEngagementRows] = useState<EngagementLetterChecklistRow[]>([]);

  const applyDefaultText = () => {
    const defaults = getDefaultFormData(clientName, fiscalYearEnd, engagementCode);
    setFormData(defaults);
    toast({ title: "Defaults Applied", description: "Pre-filled text has been applied to all fields. You can now edit as needed." });
  };

  const resetToDefaults = (field: keyof typeof formData) => {
    const defaults = getDefaultFormData(clientName, fiscalYearEnd, engagementCode);
    setFormData(prev => ({ ...prev, [field]: defaults[field] }));
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const response = await fetchWithAuth(`/api/workspace/${engagementId}/pre-planning`);
        if (response.ok) {
          const result = await response.json();
          if (result.data?.engagementLetter) {
            const { formData: savedFormData, checklistResponses: savedResponses, customQuestions: savedCustom, engagementRows: savedRows } = result.data.engagementLetter;
            if (savedFormData && Object.values(savedFormData).some(v => v !== "")) {
              setFormData(savedFormData);
              setHasLoadedDefaults(true);
            }
            // Load new format with proper normalization
            if (savedResponses) {
              setChecklistResponses(prev => {
                const normalized = { ...prev };
                Object.entries(savedResponses).forEach(([id, saved]) => {
                  const savedData = saved as { response?: string; remarks?: string };
                  normalized[id] = {
                    response: savedData.response || "",
                    remarks: savedData.remarks || ""
                  };
                });
                return normalized;
              });
            }
            if (savedCustom) {
              setCustomQuestions(savedCustom);
              // Ensure custom questions have response entries
              setChecklistResponses(prev => {
                const updated = { ...prev };
                (savedCustom as ChecklistQuestion[]).forEach(q => {
                  if (!updated[q.id]) {
                    updated[q.id] = { response: "", remarks: "" };
                  }
                });
                return updated;
              });
            }
            // Legacy format migration
            if (savedRows && !savedResponses) {
              const migrated: Record<string, { response: string; remarks: string }> = {};
              savedRows.forEach((row: EngagementLetterChecklistRow) => {
                migrated[row.id] = { response: row.response || "", remarks: row.remarks || "" };
              });
              setChecklistResponses(prev => ({ ...prev, ...migrated }));
            }
          }
        }
      } catch (error) {
        console.error("Failed to load engagement letter data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [engagementId]);

  useEffect(() => {
    if (!loading && !hasLoadedDefaults && clientName) {
      const defaults = getDefaultFormData(clientName, fiscalYearEnd, engagementCode);
      setFormData(defaults);
      setHasLoadedDefaults(true);
    }
  }, [loading, hasLoadedDefaults, clientName, fiscalYearEnd, engagementCode]);

  const handleSave = async () => {
    try {
      setSaving(true);
      
      const loadResponse = await fetchWithAuth(`/api/workspace/${engagementId}/pre-planning`);
      const existingData = loadResponse.ok ? (await loadResponse.json()).data || {} : {};
      
      // Serialize responses without File objects (they can't be JSON serialized)
      const serializableResponses: Record<string, { response: string; remarks: string }> = {};
      Object.entries(checklistResponses).forEach(([key, value]) => {
        serializableResponses[key] = { response: value.response, remarks: value.remarks };
      });

      const dataToSave = {
        ...existingData,
        engagementLetter: {
          formData,
          checklistResponses: serializableResponses,
          customQuestions,
        }
      };
      
      const response = await fetchWithAuth(`/api/workspace/${engagementId}/pre-planning`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSave)
      });
      
      if (response.ok) {
        toast({ title: "Saved", description: "Engagement letter saved successfully" });
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to save engagement letter data", variant: "destructive" });
      console.error("Save error:", error);
    } finally {
      setSaving(false);
    }
  };

  const generateConsentLetter = async (format: "word" | "pdf") => {
    try {
      setGeneratingConsent(true);
      
      const currentDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

      const logoParagraph = await getClientDocxLogoParagraph(firm?.logoUrl);
      
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            ...(logoParagraph ? [logoParagraph] : []),
            new Paragraph({
              children: [
                new TextRun({
                  text: FIRM_DETAILS.tradingName,
                  bold: true,
                  size: 32,
                  color: "1e40af",
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: FIRM_DETAILS.address,
                  size: 18,
                  color: "6b7280",
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 50 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Tel: ${FIRM_DETAILS.phone} | Email: ${FIRM_DETAILS.email}`,
                  size: 18,
                  color: "6b7280",
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 50 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `ICAP Member No: ${FIRM_DETAILS.icapMemberNo}`,
                  size: 18,
                  color: "6b7280",
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "─".repeat(80) }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "CONSENT LETTER TO PREDECESSOR AUDITOR",
                  bold: true,
                  size: 28,
                }),
              ],
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "(In accordance with ISA 300 and ICAP Guidelines)",
                  italics: true,
                  size: 20,
                  color: "6b7280",
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: `Date: ${currentDate}` }),
              ],
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: `Ref: ${engagementCode}/CONSENT/${new Date().getFullYear()}` }),
              ],
              spacing: { after: 400 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "To," }),
              ],
              spacing: { after: 100 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "M/s [Predecessor Auditor Name]", bold: true }),
              ],
              spacing: { after: 50 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Chartered Accountants" }),
              ],
              spacing: { after: 50 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "[Address Line 1]" }),
              ],
              spacing: { after: 50 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "[City, Country]" }),
              ],
              spacing: { after: 400 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Dear Sirs," }),
              ],
              spacing: { after: 300 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Re: Request for Professional Clearance - ${clientName || "[Client Name]"}`,
                  bold: true,
                }),
              ],
              spacing: { after: 300 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `We have been approached by ${clientName || "[Client Name]"} to accept appointment as their statutory auditors for the financial year ending ${fiscalYearEnd || "[Year End Date]"}.`,
                }),
              ],
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "In accordance with the requirements of the Code of Ethics issued by the Institute of Chartered Accountants of Pakistan (ICAP) and International Standard on Auditing 300 (Planning an Audit of Financial Statements), we request you to kindly provide us with professional clearance and confirm whether there are any professional or other reasons why we should not accept this appointment.",
                }),
              ],
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "We would also appreciate if you could provide us with the following information:",
                }),
              ],
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "1. Any matters relating to the client that would affect our decision to accept the engagement;" }),
              ],
              spacing: { after: 100 },
              indent: { left: 360 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "2. Any unpaid fees for professional services rendered by you;" }),
              ],
              spacing: { after: 100 },
              indent: { left: 360 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "3. Any disagreements with management on significant accounting or auditing matters;" }),
              ],
              spacing: { after: 100 },
              indent: { left: 360 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "4. Your assessment of management's integrity; and" }),
              ],
              spacing: { after: 100 },
              indent: { left: 360 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "5. Any other information that you consider relevant for our consideration." }),
              ],
              spacing: { after: 300 },
              indent: { left: 360 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `${clientName || "[Client Name]"} has authorized us to approach you and has given consent for you to provide the information requested above.`,
                }),
              ],
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "We would appreciate your response within 14 days from the date of this letter. Your cooperation in this matter is highly appreciated.",
                }),
              ],
              spacing: { after: 400 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Yours faithfully," }),
              ],
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "" }),
              ],
              spacing: { after: 100 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "____________________________",
                }),
              ],
              spacing: { after: 100 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "Authorized Signatory",
                  bold: true,
                }),
              ],
              spacing: { after: 50 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: FIRM_DETAILS.tradingName,
                }),
              ],
              spacing: { after: 400 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "─".repeat(80) }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { before: 400, after: 200 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "CLIENT AUTHORIZATION",
                  bold: true,
                  size: 24,
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `We, ${clientName || "[Client Name]"}, hereby authorize ${FIRM_DETAILS.tradingName} to contact our predecessor auditors to obtain professional clearance and any relevant information for the purpose of accepting the audit engagement.`,
                }),
              ],
              spacing: { after: 300 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Authorized by: ____________________________" }),
              ],
              spacing: { after: 100 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Name: ____________________________" }),
              ],
              spacing: { after: 100 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Designation: ____________________________" }),
              ],
              spacing: { after: 100 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Date: ____________________________" }),
              ],
              spacing: { after: 100 },
            }),
          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      
      if (format === "word") {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `Consent_Letter_${engagementCode || "ENG"}_${new Date().toISOString().split('T')[0]}.docx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast({ title: "Success", description: "Consent letter downloaded as Word document" });
      } else {
        toast({ 
          title: "PDF Generation", 
          description: "PDF generation requires server-side processing. Word document downloaded instead.",
          variant: "default"
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `Consent_Letter_${engagementCode || "ENG"}_${new Date().toISOString().split('T')[0]}.docx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Error generating consent letter:", error);
      toast({ title: "Error", description: "Failed to generate consent letter", variant: "destructive" });
    } finally {
      setGeneratingConsent(false);
    }
  };

  const generateEngagementLetter = async () => {
    try {
      setGeneratingEngLetter(true);

      let firmAddress = "";
      let firmPhone = "";
      let firmEmail = "";
      let clientAddress = "";
      let partnerName = "";
      try {
        const firmRes = await fetchWithAuth("/api/auth/me");
        if (firmRes.ok) {
          const meData = await firmRes.json();
          if (meData.firm) {
            firmAddress = meData.firm.address || "";
            firmPhone = meData.firm.phone || "";
            firmEmail = meData.firm.email || "";
          }
          partnerName = meData.fullName || meData.name || "";
        }
      } catch {}
      try {
        const cRes = await fetchWithAuth(`/api/clients`);
        if (cRes.ok) {
          const allClients = await cRes.json();
          const thisClient = allClients.find((c: any) => c.id === engagement?.clientId);
          if (thisClient) {
            clientAddress = thisClient.address || thisClient.city || "";
          }
        }
      } catch {}

      const firmDisplayName = firm?.displayName || firm?.name || "Firm Name";
      const currentDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      const yearEnd = engagement?.fiscalYearEnd 
        ? new Date(engagement.fiscalYearEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) 
        : "June 30, 202X";
      const yearEndShort = engagement?.periodEnd 
        ? `June 30, ${new Date(engagement.periodEnd).getFullYear()}`
        : "June 30, 202X";
      const refCode = engagementCode || "___";

      const logoParagraph = await getClientDocxLogoParagraph(firm?.logoUrl);

      const headerParagraphs: Paragraph[] = [];
      if (logoParagraph) headerParagraphs.push(logoParagraph);

      headerParagraphs.push(
        new Paragraph({
          children: [new TextRun({ text: firmDisplayName, bold: true, size: 28, font: "Calibri" })],
          alignment: AlignmentType.LEFT,
          spacing: { after: 40 },
        })
      );
      if (firmAddress) {
        headerParagraphs.push(new Paragraph({
          children: [new TextRun({ text: firmAddress, size: 20, font: "Calibri", color: "555555" })],
          spacing: { after: 20 },
        }));
      }
      if (firmPhone || firmEmail) {
        headerParagraphs.push(new Paragraph({
          children: [new TextRun({ text: [firmPhone, firmEmail].filter(Boolean).join(" | "), size: 20, font: "Calibri", color: "555555" })],
          spacing: { after: 200 },
        }));
      }

      const p = (text: string, opts?: { bold?: boolean; size?: number; spacing?: number; indent?: number; alignment?: (typeof AlignmentType)[keyof typeof AlignmentType] }) => {
        return new Paragraph({
          children: [new TextRun({ text, bold: opts?.bold, size: opts?.size || 22, font: "Calibri" })],
          spacing: { after: opts?.spacing ?? 120 },
          indent: opts?.indent ? { left: opts.indent } : undefined,
          alignment: opts?.alignment,
        });
      };

      const heading = (text: string) => new Paragraph({
        children: [new TextRun({ text, bold: true, size: 24, font: "Calibri", underline: {} })],
        spacing: { before: 300, after: 150 },
      });

      const bullet = (text: string) => new Paragraph({
        children: [new TextRun({ text, size: 22, font: "Calibri" })],
        spacing: { after: 80 },
        indent: { left: 360 },
        bullet: { level: 0 },
      });

      const doc = new Document({
        sections: [{
          properties: {
            page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } },
          },
          children: [
            ...headerParagraphs,

            p(`Ref:\t${refCode}/AEL/${new Date().getFullYear()}`),
            p(`Date:\t${currentDate}`),
            p(""),

            p("The Board of Directors", { bold: true }),
            p(clientName || "[Client Name]"),
            p(clientAddress || "[Client Address]"),
            p(""),

            p("Dear Board Members,", { bold: true }),
            p(""),

            p(`Engagement Letter for audit and professional services for the year ended ${yearEndShort}`, { bold: true, size: 24 }),
            p(""),

            p(`You have requested that we audit the financial statements of ${clientName || "[Client Name]"} (hereinafter referred to as "the Company"), which comprise the statement of financial position as at ${yearEndShort}, and the statement of profit or loss, statement of comprehensive income, statement of changes in equity and statement of cash flows for the year then ended, and notes to the financial statements, including a summary of significant accounting policies. We are pleased to confirm our acceptance and our understanding of this audit engagement by means of this letter. The audit will be conducted with the objective of our expressing an opinion on the financial statements.`),

            heading("Scope of Engagement"),
            p(`We will conduct our audit in accordance with Auditing Standards as applicable in Pakistan with the objective of expressing an opinion whether the financial statements conform with approved accounting standards as applicable in Pakistan, and give the information required by the Companies Act, 2017; (XIX of 2017) in the manner so required and respectively give a true and fair view of the state of the Company's affairs as at ${yearEndShort} and the related statement of profit or loss, statement of comprehensive income, statement of changes in equity and statement of cash flows for the year then ended.`),

            heading("Responsibilities of the Auditor"),
            p("We will conduct our audit in accordance with Auditing Standards as applicable in Pakistan. Those standards require that we comply with ethical requirements and plan and perform the audit to obtain reasonable assurance about whether the financial statements are free from material misstatements whether due to fraud or error."),
            p("Reasonable assurance is a high level of assurance but is not a guarantee that an audit conducted in accordance with Auditing Standards as applicable in Pakistan will always detect a material misstatement when it exists. Misstatements can arise from fraud or error and are considered material if, individually or in the aggregate, they could reasonably be expected to influence the economic decisions of users taken on the basis of the Financial Statements."),
            p("As part of an audit in accordance with Auditing Standards as applicable in Pakistan, we exercise judgement and maintained professional skepticism throughout the audit. We also:"),

            bullet("Identify and assess the risks of material misstatement of the Financial Statements, whether due to fraud or error, design and perform audit procedures responsive to those risks, and obtain audit evidence that is sufficient and appropriate to provide a basis for our opinion. The risk of not detecting a material misstatement resulting from fraud is higher than for one resulting from error, as fraud may involve collusion, forgery, intentional omissions, misrepresentations, or the override of internal control."),
            bullet("Obtain an understanding of internal control relevant to the audit in order to design audit procedures that are appropriate in the circumstances, but not for the purpose of expressing an opinion on the effectiveness of the entity's internal control. However, we will communicate to you in writing concerning any significant deficiencies in internal control relevant to the audit of the Financial Statements that we have identified during the audit."),
            bullet("Conclude on the appropriateness of management's use of the going concern basis of accounting and, based on the audit evidence obtained, whether a material uncertainty exists related to events or conditions that may cast significant doubt on the Company's ability to continue as a going concern. If we conclude that a material uncertainty exists, we are required to draw attention in our auditor's report to the related disclosures in the Financial Statements or, if such disclosures are inadequate, to modify our opinion. Our conclusions are based on the audit evidence obtained up to the date of our auditor's report."),
            bullet("Evaluate the appropriateness of accounting policies used and the reasonableness of accounting estimates and related disclosures made by management."),
            bullet("Evaluate the overall presentation, structure and content of the financial statements, including the disclosures, and whether the financial statements represent the underlying transactions and events in a manner that achieves fair presentation."),

            p("Our report will be addressed to the members of the Company. We cannot provide assurance that an unqualified opinion will be rendered and circumstances may arise in which it would be necessary for us to modify our report or withdraw from the engagement. In such circumstances, our findings or reasons for withdrawal will be communicated to the Board of Directors."),
            p("Because of the inherent limitations of an audit, together with the inherent limitations of internal control system, there is an unavoidable risk that even some material misstatements may not be detected, even though the audit is properly planned and performed in accordance with Auditing Standards as applicable in Pakistan."),
            p("In making our risk assessments, we consider internal control relevant to the Company's preparation of financial statements in order to design audit procedures that are appropriate in the circumstances but not for the purpose of expressing an opinion on the effectiveness of entity's internal control. However, we will communicate to you in writing concerning any significant deficiencies in internal control relevant to the audit of financial statements that we have identified during the audit."),
            p("As part of our audit, we will read the other information in your annual report and consider whether such information, or the manner of its presentation, is materially consistent with information, or the manner of its presentation, appearing in the financial statements. However, our audit does not include the performance of procedures to corroborate such other information (including forward-looking statements)."),

            p("As part of our statutory audit, we are also required by the Companies Act, 2017 (XIX of 2017), to form our opinion on whether:"),
            bullet("proper books of account have been kept by the Company as required by the Companies Act, 2017 (XIX of 2017);"),
            bullet("the statements of financial position, the statement of profit or loss, the statement of changes in equity and the statement of cash flows together with the notes thereon have been drawn up in conformity with the Companies Act, 2017 (XIX of 2017) and are in agreement with the books of account and returns;"),
            bullet("investments made, expenditure incurred and guarantees extended during the year were for the purpose of the Company's business; and"),
            bullet("either zakat deductible at source under the Zakat and Ushr Ordinance, 1980, (XVIII of 1980), was deducted by the Company and deposited in the Central Zakat Fund established under section 7 of that Ordinance or no zakat was deductible at source under the Zakat and Ushr Ordinance, 1980, (XVIII of 1980)."),

            heading("Responsibilities of the Management"),
            p("Our audit will be conducted on the basis that the management of the Company whose financial statements are to be audited and where appropriate, those charged with governance acknowledge and understand that they have responsibility:"),
            bullet("for the preparation and fair presentation of the financial statements in accordance with the accounting and reporting standards as applicable in Pakistan. The accounting and reporting standards applicable in Pakistan comprise of International Financial Reporting Standards as issued by the International Accounting Standards Board (IASB) and Islamic Financial Accounting Standards (IFAS) issued by the Institute of Chartered Accountants of Pakistan (ICAP) as notified under the Companies Act, 2017 (XIX of 2017);"),
            bullet("for such internal controls as the management determines is necessary to enable the preparation of financial statements that are free from misstatements, whether due to fraud or error;"),
            bullet("for selecting and applying appropriate accounting policies; and"),
            bullet("for making accounting estimates and judgements that are appropriate in the circumstances."),
            p("to provide us with:"),
            bullet("access to all information of which the management is aware that is relevant to the preparation of the financial statements such as records, documentation and other matters;"),
            bullet("additional information that we may request from the management for the purpose of the audit; and"),
            bullet("unrestricted access to persons within the entity from whom we determine it necessary to obtain audit evidence."),
            p("In preparing the financial statements, management is responsible for assessing the Company's ability to continue as a going concern, disclosing, as applicable, matters relating to going concern and using the going concern basis of accounting unless management either intends to liquidate the Company or to cease operations, or has no realistic alternative but to do so."),
            p("Management is also responsible for identifying and ensuring that the Company complies with laws and regulations applicable to its activities, and for informing us of any known material violations of such laws and regulations."),
            p(`The Company agrees that all records, documentation, and information including minutes of all management, board of directors and shareholders' meetings we request in connection with our work under this engagement letter will be made available to us.`),
            p("As part of our audit process, we will request from management and where appropriate those charged with governance, written confirmations concerning representations made to us in connection with our audit."),
            p(""),
            p("In addition, we will obtain specific written representations from management that:"),
            bullet("It acknowledges its responsibility for the design, implementation and maintenance of internal control to prevent and detect fraud and error;"),
            bullet("It has disclosed to the auditor its knowledge of fraud or suspected fraud affecting the Company's financial statements involving: Management; Employees who have significant roles in internal control; or Others where the fraud could have a material effect on the financial statements;"),
            bullet("It has disclosed to us its knowledge of any allegations of fraud, or suspected fraud, affecting the entity's financial statements communicated by employees, former employees, analysts, regulators or others; and"),
            bullet("It has disclosed to us the results of its assessment of the risk that the financial statements may be materially misstated as a result of fraud."),
            p("Our engagement cannot be relied upon to disclose whether fraud or errors, or illegal acts that may exist. To the extent that they come to our attention, we will inform management of any material errors or any instances of fraud or illegal acts, unless they are clearly inconsequential."),

            heading("Deliverables"),
            p("We will provide you an audit opinion based on our audit of the financial statements in the format as prescribed by ISA 700 as applicable in Pakistan."),

            heading("Form and Content of our Audit Report"),
            p("The form and content of the audit reports would be in accordance with the formats as given in the Auditors (Reporting Obligations) Regulations, 2018, however, if there is any need to amend the form and content of our report in the light of our audit findings, we shall inform you in advance."),

            heading("General"),
            p("We acknowledge that the Company may wish to publish its financial statements and our reports thereon on its website. It is the responsibility of the directors to ensure that financial statements and our reports thereon being published on the Company's website are properly presented."),

            heading("Timetable"),
            p("If you require us to complete our work under this engagement contract or, any part of it, by a specific date or time, you will inform us in writing of your requirement. Whilst we will make every effort to complete such work by the date specified, you acknowledge that meeting any such requirement will rely on you providing reasonable notice of your requirement and the timely provision of such information, as we may need to complete the work concerned."),

            heading("Fee Arrangement"),
            p("Our fees, which will be billed as work progresses, are based on the time required by the individuals assigned to the engagement in addition to direct out-of-pocket expenses and all applicable taxes. Out of pocket expenses include conveyance, communication, photocopy charges, outstation visit expenses and other expenses incurred for the purpose of audit."),
            p("Our fee for this engagement will be mutually agreed / Rs. ________________ exclusive of federal / provincial sales taxes."),
            p("We would expect to agree the payment of our fees, including payments on account, before each year's audit and performance of other professional services. Our fee notes are payable within 15 days."),

            heading("Effectiveness"),
            p("This engagement letter will be effective for future periods unless it is terminated, amended or superseded."),
            p("Under a directive issued by the Institute of Chartered Accountants of Pakistan to audit firms on 1 June 2000, our working paper files pertaining to the audit of the company may be subject to Quality Control Review (QCR) without any reference to the company."),
            p(""),

            p("Please confirm your agreement to and acceptance of the terms of this letter and the attachments by signing and returning to us the enclosed copy. If there are any aspects that you wish to discuss, please let us know."),
            p(""),
            p(""),

            p(`Signed by, for and on behalf of ${firmDisplayName}`, { bold: true }),
            p(""),
            p(""),
            p(`Name of Engagement Partner:     _________________________       Signature: ___________________________`),
            p(`${partnerName}`),
            p(`Date:   ${currentDate}`),
            p(""),
            p(""),

            new Paragraph({ children: [new TextRun({ text: "─".repeat(80) })], alignment: AlignmentType.CENTER, spacing: { before: 400, after: 200 } }),
            p(""),

            p(`I have read and understood the terms and conditions of this letter and attachments, and I agree to and accept them for and on behalf of ${clientName || "[Client Name]"} by whom I am duly authorized:`, { bold: false }),
            p(""),
            p(""),
            p(`Name of Director:               _________________________       Signature: ___________________________`),
            p(`Date:   __________________________`),
          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Engagement_Letter_${engagementCode || "ENG"}_${new Date().toISOString().split('T')[0]}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: "Success", description: "Engagement letter downloaded as Word document" });
    } catch (error) {
      console.error("Error generating engagement letter:", error);
      toast({ title: "Error", description: "Failed to generate engagement letter", variant: "destructive" });
    } finally {
      setGeneratingEngLetter(false);
    }
  };

  useImperativeHandle(ref, () => ({
    save: async () => {
      await handleSave();
    }
  }));

  const incompleteCount = totalQuestions - completedCount;

  const FieldWithReset = ({ 
    label, 
    field, 
    rows = 4,
    hint 
  }: { 
    label: string; 
    field: keyof typeof formData; 
    rows?: number;
    hint?: string;
  }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          {label}
          {hint && <span className="text-xs text-muted-foreground">({hint})</span>}
        </Label>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => resetToDefaults(field)}
          className="text-xs text-muted-foreground"
          data-testid={`button-reset-${field}`}
        >
          <RotateCcw className="h-3 w-3 mr-1" />
          Reset
        </Button>
      </div>
      <Textarea 
        value={formData[field]} 
        onChange={(e) => setFormData({ ...formData, [field]: e.target.value })} 
        rows={rows}
        className="font-mono text-sm"
        data-testid={`textarea-${field}`}
      />
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-purple-200 bg-purple-50/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-purple-600" />
            Generate Engagement Letter
          </CardTitle>
          <CardDescription>
            Generate a professional ISA 210 compliant engagement letter in Word format with firm logo, addresses and signature blocks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => generateEngagementLetter()}
              disabled={generatingEngLetter}
              className="bg-purple-600 hover:bg-purple-700"
              data-testid="button-generate-engagement-letter"
            >
              {generatingEngLetter ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4 mr-2" />
              )}
              Generate Letter
            </Button>
            <span className="text-sm text-muted-foreground">
              Downloads as Word document (.docx) with firm letterhead, client details, and dual signature blocks
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-blue-200 bg-blue-50/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileDown className="h-5 w-5 text-blue-600" />
            Generate Consent Letter
          </CardTitle>
          <CardDescription>
            Generate a professional consent letter to the predecessor auditor with firm letterhead
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Button 
              onClick={() => generateConsentLetter("word")}
              disabled={generatingConsent}
              data-testid="button-generate-consent-letter"
            >
              {generatingConsent ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              Generate Consent Letter
            </Button>
            <span className="text-sm text-muted-foreground">
              Downloads as Word document with firm letterhead and client authorization section
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2" data-testid="title-engagement-letter">
                <FileSignature className="h-5 w-5" />
                Engagement Letter
              </CardTitle>
              <CardDescription>
                Formalize terms of engagement as per ISA 210 and legal requirements
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={applyDefaultText}
                data-testid="button-apply-defaults"
              >
                <Wand2 className="h-4 w-4 mr-2" />
                Apply Default Text
              </Button>
              <div className="flex border rounded-md">
                <Button
                  variant={activeView === "edit" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setActiveView("edit")}
                  className="rounded-r-none"
                  data-testid="button-view-edit"
                >
                  <Edit3 className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button
                  variant={activeView === "preview" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setActiveView("preview")}
                  className="rounded-l-none"
                  data-testid="button-view-preview"
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Preview
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {activeView === "edit" ? (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <Wand2 className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-900">Smart Pre-filled Content</h4>
                    <p className="text-sm text-blue-700 mt-1">
                      All fields are pre-filled with professional ISA-compliant text using client details from <strong>{clientName || "your client"}</strong>.
                      Click any field to edit, or use the Reset button to restore default text.
                    </p>
                  </div>
                </div>
              </div>

              <FieldWithReset 
                label="Scope of Audit" 
                field="scopeOfAudit" 
                rows={6}
                hint="ISA 210.10"
              />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <FieldWithReset 
                  label="Management Responsibilities" 
                  field="managementResponsibilities" 
                  rows={8}
                  hint="ISA 210.6(b)"
                />
                <FieldWithReset 
                  label="Auditor Responsibilities" 
                  field="auditorResponsibilities" 
                  rows={8}
                  hint="ISA 210.10"
                />
              </div>

              <Separator />
              <h4 className="font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Standards & Reporting
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Financial Reporting Framework</Label>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => resetToDefaults("reportingFramework")}
                      className="text-xs text-muted-foreground"
                      data-testid="button-reset-reportingFramework"
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Reset
                    </Button>
                  </div>
                  <Select value={formData.reportingFramework} onValueChange={(v) => setFormData({ ...formData, reportingFramework: v })}>
                    <SelectTrigger data-testid="select-reporting-framework"><SelectValue placeholder="Select framework" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ifrs" data-testid="select-item-ifrs">IFRS (International Financial Reporting Standards)</SelectItem>
                      <SelectItem value="aaoifi" data-testid="select-item-aaoifi">AAOIFI (Islamic Financial Accounting)</SelectItem>
                      <SelectItem value="local-gaap" data-testid="select-item-local-gaap">Local GAAP (Pakistan)</SelectItem>
                      <SelectItem value="us-gaap" data-testid="select-item-us-gaap">US GAAP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <FieldWithReset label="Auditing Standards" field="auditingStandards" rows={2} />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <FieldWithReset label="Form of Reports" field="reportForm" rows={3} />
                <FieldWithReset label="Deliverables" field="deliverables" rows={3} />
                <FieldWithReset label="Timeline" field="timeline" rows={3} />
              </div>

              <Separator />
              <h4 className="font-semibold">Fees & Terms</h4>
              <div className="grid grid-cols-3 gap-4">
                <FieldWithReset label="Fee Structure" field="feeStructure" rows={3} />
                <FieldWithReset label="Payment Terms" field="paymentTerms" rows={3} />
                <FieldWithReset label="Additional Costs" field="additionalCosts" rows={3} />
              </div>

              <FieldWithReset 
                label="Limitation of Liability" 
                field="liabilityLimitation" 
                rows={3}
                hint="Per ICAP Guidelines"
              />

              <FieldWithReset 
                label="Client Acceptance of Terms" 
                field="clientAcceptance" 
                rows={4}
              />
            </>
          ) : (
            <div className="bg-white border rounded-lg p-8 max-w-4xl mx-auto space-y-6">
              <div className="text-center border-b pb-6">
                <h1 className="text-2xl font-bold text-blue-800">{FIRM_DETAILS.tradingName}</h1>
                <p className="text-sm text-muted-foreground mt-2">{FIRM_DETAILS.address}</p>
                <p className="text-sm text-muted-foreground">ICAP Member No: {FIRM_DETAILS.icapMemberNo}</p>
              </div>

              <div className="text-center py-4">
                <h2 className="text-xl font-bold">ENGAGEMENT LETTER</h2>
                <p className="text-sm text-muted-foreground">Ref: {engagementCode}</p>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-blue-800 border-b pb-1">1. Scope of Audit</h3>
                  <p className="mt-2 text-sm whitespace-pre-wrap">{formData.scopeOfAudit}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-blue-800 border-b pb-1">2. Management Responsibilities</h3>
                  <p className="mt-2 text-sm whitespace-pre-wrap">{formData.managementResponsibilities}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-blue-800 border-b pb-1">3. Auditor Responsibilities</h3>
                  <p className="mt-2 text-sm whitespace-pre-wrap">{formData.auditorResponsibilities}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-blue-800 border-b pb-1">4. Standards & Reporting</h3>
                  <div className="mt-2 text-sm space-y-2">
                    <p><strong>Framework:</strong> {formData.reportingFramework === "ifrs" ? "IFRS" : formData.reportingFramework === "aaoifi" ? "AAOIFI" : formData.reportingFramework === "local-gaap" ? "Local GAAP" : formData.reportingFramework}</p>
                    <p><strong>Standards:</strong> {formData.auditingStandards}</p>
                    <p className="whitespace-pre-wrap"><strong>Report Form:</strong> {formData.reportForm}</p>
                    <p className="whitespace-pre-wrap"><strong>Deliverables:</strong> {formData.deliverables}</p>
                    <p className="whitespace-pre-wrap"><strong>Timeline:</strong> {formData.timeline}</p>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-blue-800 border-b pb-1">5. Fees & Payment Terms</h3>
                  <div className="mt-2 text-sm space-y-2">
                    <p className="whitespace-pre-wrap">{formData.feeStructure}</p>
                    <p className="whitespace-pre-wrap">{formData.paymentTerms}</p>
                    <p className="whitespace-pre-wrap">{formData.additionalCosts}</p>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-blue-800 border-b pb-1">6. Limitation of Liability</h3>
                  <p className="mt-2 text-sm whitespace-pre-wrap">{formData.liabilityLimitation}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-blue-800 border-b pb-1">7. Client Acceptance</h3>
                  <p className="mt-2 text-sm whitespace-pre-wrap">{formData.clientAcceptance}</p>
                </div>

                <div className="pt-8 grid grid-cols-2 gap-8">
                  <div className="text-center">
                    <div className="border-t border-black pt-2">
                      <p className="font-semibold">{FIRM_DETAILS.tradingName}</p>
                      <p className="text-sm text-muted-foreground">Authorized Signatory</p>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="border-t border-black pt-2">
                      <p className="font-semibold">{clientName || "[Client Name]"}</p>
                      <p className="text-sm text-muted-foreground">Client Authorized Signatory</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Engagement Letter Checklist (ISA 210 Compliance)
              </CardTitle>
              <CardDescription className="mt-1">Verify all engagement letter requirements per ISA 210</CardDescription>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="outline" className="text-xs">ISA 210</Badge>
                <Badge variant="outline" className="text-xs">ISA 220</Badge>
                <Badge variant="outline" className="text-xs">ICAP</Badge>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground" data-testid="text-checklist-progress">
                {completedCount}/{totalQuestions}
              </span>
              <Button 
                variant="outline"
                onClick={markAllYes}
                data-testid="button-mark-all-yes"
              >
                <Check className="h-4 w-4 mr-2" />
                Mark All Yes
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {allQuestions.map((question, idx) => {
            const resp = checklistResponses[question.id] || { response: "", remarks: "" };
            const isComplete = isQuestionComplete(question.id);
            const needsRemarks = resp.response === "No" && !resp.remarks.trim();

            return (
              <Card 
                key={question.id} 
                className={`border ${isComplete ? "border-green-200 bg-green-50/30" : resp.response ? "border-blue-200" : "border-muted"} ${question.isCustom ? "bg-blue-50/20" : ""}`}
                data-testid={`card-question-${question.id}`}
              >
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        {question.isCustom ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={question.question}
                              onChange={e => updateCustomQuestion(question.id, e.target.value)}
                              placeholder="Enter custom requirement..."
                              className="font-medium"
                              data-testid={`input-custom-question-${question.id}`}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeCustomQuestion(question.id)}
                              className="text-destructive"
                              data-testid={`button-remove-question-${question.id}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <h4 className="font-medium text-foreground">{question.question}</h4>
                        )}
                        <div className="flex items-start gap-2 mt-1 text-sm text-muted-foreground">
                          <Info className="h-4 w-4 mt-0.5 flex-shrink-0 text-blue-500" />
                          <p>{question.helpText}</p>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Badge variant="secondary" className="text-xs">{question.category}</Badge>
                          <Badge variant="outline" className="text-xs">{question.isaReference}</Badge>
                        </div>
                      </div>
                      {isComplete && (
                        <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pl-11">
                      <div className="space-y-2">
                        <Label className="text-sm text-muted-foreground">
                          Response {!resp.response && <span className="text-amber-500">*</span>}
                        </Label>
                        <div className={`flex gap-1 ${!resp.response ? "rounded-md border border-amber-300 p-1" : ""}`}>
                          {["Yes", "No", "N/A"].map(option => (
                            <Button
                              key={option}
                              type="button"
                              variant={resp.response === option ? "default" : "outline"}
                              size="sm"
                              className="flex-1"
                              onClick={() => updateChecklistResponse(question.id, "response", option)}
                              data-testid={`button-response-${question.id}-${option.toLowerCase().replace("/", "")}`}
                            >
                              {option}
                            </Button>
                          ))}
                        </div>
                        {!resp.response && (
                          <p className="text-xs text-amber-600 mt-1">Please select a response</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm text-muted-foreground">Remarks</Label>
                        <Textarea
                          value={resp.remarks}
                          onChange={e => updateChecklistResponse(question.id, "remarks", e.target.value)}
                          placeholder="Click 'Use Suggested' or enter your own..."
                          className={`min-h-[60px] ${needsRemarks ? "border-red-500" : ""}`}
                          rows={2}
                          data-testid={`textarea-remarks-${question.id}`}
                        />
                        {!resp.remarks && (
                          <button
                            type="button"
                            className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
                            onClick={() => useSuggestedResponse(question.id)}
                            data-testid={`button-use-suggested-${question.id}`}
                          >
                            <Wand2 className="h-3.5 w-3.5" />
                            Use Suggested
                          </button>
                        )}
                        {needsRemarks && (
                          <p className="text-xs text-red-600 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Remarks required when response is 'No'
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          <Button 
            variant="outline" 
            onClick={addCustomQuestion}
            className="w-full border-dashed"
            data-testid="button-add-custom-question"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Custom Requirement
          </Button>

          {incompleteCount > 0 && (
            <p className="text-sm text-amber-600 flex items-center gap-1" data-testid="text-incomplete-count">
              <AlertCircle className="h-4 w-4" />
              {incompleteCount} item(s) require completion
            </p>
          )}
        </CardContent>
      </Card>

      {incompleteCount > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-amber-800">
              <AlertCircle className="h-5 w-5" />
              Validation Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-amber-700">{incompleteCount} item(s) require completion before this page can be finalized.</p>
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Paperclip className="h-4 w-4" />
            Engagement Letter Documents
          </CardTitle>
          <CardDescription>Upload signed engagement letter, terms of engagement, and related correspondence</CardDescription>
        </CardHeader>
        <CardContent>
          <SectionAttachments
            sectionId="tab7-engagement-letter-docs"
            engagementId={engagementId || ""}
            maxFiles={20}
            suggestedDocuments={[
              { name: "Signed engagement letter" },
              { name: "Terms of engagement" },
              { name: "Scope modification correspondence" },
              { name: "Client acknowledgement form" },
              { name: "Fee agreement documentation" },
            ]}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || loading} data-testid="button-save-engagement-letter">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          {saving ? "Saving..." : "Save Progress"}
        </Button>
      </div>
    </div>
  );
});

EngagementLetterTab.displayName = "EngagementLetterTab";

export default EngagementLetterTab;
