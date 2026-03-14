import { useState, useEffect, useImperativeHandle, forwardRef, useRef } from "react";
import { useParams } from "wouter";
import { useEngagement } from "@/lib/workspace-context";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import { getClientDocxLogoParagraph } from "@/lib/docx-logo";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileSignature,
  CheckCircle2,
  AlertCircle,
  Save,
  Plus,
  Loader2,
  FileText,
  Wand2,
  Eye,
  Info,
  Check,
  X,
  Paperclip,
  Upload,
  Calendar,
  Download,
  FileCheck,
  File,
  Trash2,
} from "lucide-react";
import { SectionAttachments } from "./section-attachments";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import type { EngagementLetterChecklistRow } from "./shared-types";

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

interface FeeDetails {
  auditFee: string;
  outOfPocketExpenses: string;
  taxTreatment: "exclusive" | "inclusive";
}

interface DocumentRecord {
  date: string;
  generatedAt: string | null;
  attachedFile: { name: string; url: string; uploadedAt: string } | null;
  notes: string;
  feeDetails?: FeeDetails;
}

const emptyFeeDetails = (): FeeDetails => ({
  auditFee: "",
  outOfPocketExpenses: "",
  taxTreatment: "exclusive",
});

const emptyDocRecord = (): DocumentRecord => ({
  date: new Date().toISOString().split("T")[0],
  generatedAt: null,
  attachedFile: null,
  notes: "",
  feeDetails: emptyFeeDetails(),
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
  const [viewDialogOpen, setViewDialogOpen] = useState<"engagement" | "consent" | null>(null);

  const engFileRef = useRef<HTMLInputElement>(null);
  const consentFileRef = useRef<HTMLInputElement>(null);

  const [engRecord, setEngRecord] = useState<DocumentRecord>(emptyDocRecord());
  const [consentRecord, setConsentRecord] = useState<DocumentRecord>(emptyDocRecord());

  const [checklistResponses, setChecklistResponses] = useState<Record<string, { response: string; remarks: string }>>(() => {
    const initial: Record<string, { response: string; remarks: string }> = {};
    ENGAGEMENT_CHECKLIST_QUESTIONS.forEach(q => {
      initial[q.id] = { response: "", remarks: "" };
    });
    return initial;
  });

  const [customQuestions, setCustomQuestions] = useState<ChecklistQuestion[]>([]);
  const allQuestions = [...ENGAGEMENT_CHECKLIST_QUESTIONS, ...customQuestions];

  const clientName = client?.name || "";
  const fiscalYearEnd = engagement?.fiscalYearEnd ? new Date(engagement.fiscalYearEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : "";
  const engagementCode = engagement?.engagementCode || "";

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
    const question = allQuestions.find(q => q.id === questionId);
    if (question?.isCustom && !question.question.trim()) return false;
    return true;
  };

  const completedCount = allQuestions.filter(q => isQuestionComplete(q.id)).length;
  const totalQuestions = allQuestions.length;
  const incompleteCount = totalQuestions - completedCount;

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const response = await fetchWithAuth(`/api/workspace/${engagementId}/pre-planning`);
        if (response.ok) {
          const result = await response.json();
          if (result.data?.engagementLetter) {
            const saved = result.data.engagementLetter;

            if (saved.engRecord) setEngRecord({ ...emptyDocRecord(), ...saved.engRecord });
            if (saved.consentRecord) setConsentRecord({ ...emptyDocRecord(), ...saved.consentRecord });

            if (saved.checklistResponses) {
              setChecklistResponses(prev => {
                const normalized = { ...prev };
                Object.entries(saved.checklistResponses).forEach(([id, s]) => {
                  const savedData = s as { response?: string; remarks?: string };
                  normalized[id] = {
                    response: savedData.response || "",
                    remarks: savedData.remarks || ""
                  };
                });
                return normalized;
              });
            }
            if (saved.customQuestions) {
              setCustomQuestions(saved.customQuestions);
              setChecklistResponses(prev => {
                const updated = { ...prev };
                (saved.customQuestions as ChecklistQuestion[]).forEach(q => {
                  if (!updated[q.id]) {
                    updated[q.id] = { response: "", remarks: "" };
                  }
                });
                return updated;
              });
            }
            if (saved.engagementRows && !saved.checklistResponses) {
              const migrated: Record<string, { response: string; remarks: string }> = {};
              saved.engagementRows.forEach((row: EngagementLetterChecklistRow) => {
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

  const handleSave = async () => {
    try {
      setSaving(true);
      const loadResponse = await fetchWithAuth(`/api/workspace/${engagementId}/pre-planning`);
      const existingData = loadResponse.ok ? (await loadResponse.json()).data || {} : {};

      const serializableResponses: Record<string, { response: string; remarks: string }> = {};
      Object.entries(checklistResponses).forEach(([key, value]) => {
        serializableResponses[key] = { response: value.response, remarks: value.remarks };
      });

      const dataToSave = {
        ...existingData,
        engagementLetter: {
          engRecord,
          consentRecord,
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
        toast({ title: "Saved", description: "Engagement letter data saved successfully" });
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

  useImperativeHandle(ref, () => ({
    save: async () => {
      await handleSave();
    }
  }));

  const handleFileAttach = (type: "engagement" | "consent", file: File) => {
    const fileRecord = {
      name: file.name,
      url: "",
      uploadedAt: new Date().toISOString(),
    };

    if (type === "engagement") {
      setEngRecord(prev => ({ ...prev, attachedFile: fileRecord }));
    } else {
      setConsentRecord(prev => ({ ...prev, attachedFile: fileRecord }));
    }

    toast({
      title: "Attached",
      description: `Signed ${type === "engagement" ? "engagement" : "consent"} letter recorded. Click "Save All Changes" to persist.`,
    });
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
      const letterDate = engRecord.date
        ? new Date(engRecord.date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
        : new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
      const yearEndShort = engagement?.periodEnd
        ? `June 30, ${new Date(engagement.periodEnd).getFullYear()}`
        : engagement?.fiscalYearEnd
          ? new Date(engagement.fiscalYearEnd).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
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
            p(`Date:\t${letterDate}`),
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
            p((() => {
              const fee = engRecord.feeDetails;
              const amt = fee?.auditFee?.trim();
              const taxLabel = fee?.taxTreatment === "inclusive" ? "inclusive" : "exclusive";
              return amt
                ? `Our fee for this engagement will be Rs. ${amt} ${taxLabel} of federal / provincial sales taxes.`
                : "Our fee for this engagement will be mutually agreed / Rs. ________________ exclusive of federal / provincial sales taxes.";
            })()),
            ...(() => {
              const oopExp = engRecord.feeDetails?.outOfPocketExpenses?.trim();
              return oopExp
                ? [p(`Out-of-pocket expenses: ${oopExp}`)]
                : [];
            })(),
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
            p(`Date:   ${letterDate}`),
            p(""),
            p(""),

            new Paragraph({ children: [new TextRun({ text: "\u2500".repeat(80) })], alignment: AlignmentType.CENTER, spacing: { before: 400, after: 200 } }),
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
      link.download = `Engagement_Letter_${engagementCode || "ENG"}_${new Date().toISOString().split("T")[0]}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setEngRecord(prev => ({ ...prev, generatedAt: new Date().toISOString() }));
      toast({ title: "Downloaded", description: "Engagement letter downloaded as Word document" });
    } catch (error) {
      console.error("Error generating engagement letter:", error);
      toast({ title: "Error", description: "Failed to generate engagement letter", variant: "destructive" });
    } finally {
      setGeneratingEngLetter(false);
    }
  };

  const generateConsentLetter = async () => {
    try {
      setGeneratingConsent(true);

      const letterDate = consentRecord.date
        ? new Date(consentRecord.date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
        : new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

      const firmDisplayName = firm?.displayName || firm?.name || "Firm Name";
      let firmAddress = "";
      let firmPhone = "";
      let firmEmail = "";
      let firmIcap = "";
      try {
        const firmRes = await fetchWithAuth("/api/auth/me");
        if (firmRes.ok) {
          const meData = await firmRes.json();
          if (meData.firm) {
            firmAddress = meData.firm.address || "";
            firmPhone = meData.firm.phone || "";
            firmEmail = meData.firm.email || "";
            firmIcap = meData.firm.icapMemberNo || "";
          }
        }
      } catch {}

      const logoParagraph = await getClientDocxLogoParagraph(firm?.logoUrl);

      const doc = new Document({
        sections: [{
          properties: {
            page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } },
          },
          children: [
            ...(logoParagraph ? [logoParagraph] : []),
            new Paragraph({
              children: [new TextRun({ text: firmDisplayName, bold: true, size: 32, color: "1e40af" })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 },
            }),
            ...(firmAddress ? [new Paragraph({
              children: [new TextRun({ text: firmAddress, size: 18, color: "6b7280" })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 50 },
            })] : []),
            ...((firmPhone || firmEmail) ? [new Paragraph({
              children: [new TextRun({ text: `Tel: ${firmPhone}${firmEmail ? ` | Email: ${firmEmail}` : ""}`, size: 18, color: "6b7280" })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 50 },
            })] : []),
            ...(firmIcap ? [new Paragraph({
              children: [new TextRun({ text: `ICAP Member No: ${firmIcap}`, size: 18, color: "6b7280" })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            })] : []),
            new Paragraph({
              children: [new TextRun({ text: "\u2500".repeat(80) })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),
            new Paragraph({
              children: [new TextRun({ text: "CONSENT LETTER TO PREDECESSOR AUDITOR", bold: true, size: 28 })],
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 },
            }),
            new Paragraph({
              children: [new TextRun({ text: "(In accordance with ISA 300 and ICAP Guidelines)", italics: true, size: 20, color: "6b7280" })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),
            new Paragraph({
              children: [new TextRun({ text: `Date: ${letterDate}` })],
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [new TextRun({ text: `Ref: ${engagementCode}/CONSENT/${new Date().getFullYear()}` })],
              spacing: { after: 400 },
            }),
            new Paragraph({ children: [new TextRun({ text: "To," })], spacing: { after: 100 } }),
            new Paragraph({ children: [new TextRun({ text: "M/s [Predecessor Auditor Name]", bold: true })], spacing: { after: 50 } }),
            new Paragraph({ children: [new TextRun({ text: "Chartered Accountants" })], spacing: { after: 50 } }),
            new Paragraph({ children: [new TextRun({ text: "[Address Line 1]" })], spacing: { after: 50 } }),
            new Paragraph({ children: [new TextRun({ text: "[City, Country]" })], spacing: { after: 400 } }),
            new Paragraph({ children: [new TextRun({ text: "Dear Sirs," })], spacing: { after: 300 } }),
            new Paragraph({
              children: [new TextRun({ text: `Re: Request for Professional Clearance - ${clientName || "[Client Name]"}`, bold: true })],
              spacing: { after: 300 },
            }),
            new Paragraph({
              children: [new TextRun({ text: `We have been approached by ${clientName || "[Client Name]"} to accept appointment as their statutory auditors for the financial year ending ${fiscalYearEnd || "[Year End Date]"}.` })],
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [new TextRun({ text: "In accordance with the requirements of the Code of Ethics issued by the Institute of Chartered Accountants of Pakistan (ICAP) and International Standard on Auditing 300 (Planning an Audit of Financial Statements), we request you to kindly provide us with professional clearance and confirm whether there are any professional or other reasons why we should not accept this appointment." })],
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [new TextRun({ text: "We would also appreciate if you could provide us with the following information:" })],
              spacing: { after: 200 },
            }),
            new Paragraph({ children: [new TextRun({ text: "1. Any matters relating to the client that would affect our decision to accept the engagement;" })], spacing: { after: 100 }, indent: { left: 360 } }),
            new Paragraph({ children: [new TextRun({ text: "2. Any unpaid fees for professional services rendered by you;" })], spacing: { after: 100 }, indent: { left: 360 } }),
            new Paragraph({ children: [new TextRun({ text: "3. Any disagreements with management on significant accounting or auditing matters;" })], spacing: { after: 100 }, indent: { left: 360 } }),
            new Paragraph({ children: [new TextRun({ text: "4. Your assessment of management's integrity; and" })], spacing: { after: 100 }, indent: { left: 360 } }),
            new Paragraph({ children: [new TextRun({ text: "5. Any other information that you consider relevant for our consideration." })], spacing: { after: 300 }, indent: { left: 360 } }),
            new Paragraph({
              children: [new TextRun({ text: `${clientName || "[Client Name]"} has authorized us to approach you and has given consent for you to provide the information requested above.` })],
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [new TextRun({ text: "We would appreciate your response within 14 days from the date of this letter. Your cooperation in this matter is highly appreciated." })],
              spacing: { after: 400 },
            }),
            new Paragraph({ children: [new TextRun({ text: "Yours faithfully," })], spacing: { after: 200 } }),
            new Paragraph({ children: [new TextRun({ text: "" })], spacing: { after: 100 } }),
            new Paragraph({ children: [new TextRun({ text: "____________________________" })], spacing: { after: 100 } }),
            new Paragraph({ children: [new TextRun({ text: "Authorized Signatory", bold: true })], spacing: { after: 50 } }),
            new Paragraph({ children: [new TextRun({ text: firmDisplayName })], spacing: { after: 400 } }),
            new Paragraph({ children: [new TextRun({ text: "\u2500".repeat(80) })], alignment: AlignmentType.CENTER, spacing: { before: 400, after: 200 } }),
            new Paragraph({
              children: [new TextRun({ text: "CLIENT AUTHORIZATION", bold: true, size: 24 })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [new TextRun({ text: `We, ${clientName || "[Client Name]"}, hereby authorize ${firmDisplayName} to contact our predecessor auditors to obtain professional clearance and any relevant information for the purpose of accepting the audit engagement.` })],
              spacing: { after: 300 },
            }),
            new Paragraph({ children: [new TextRun({ text: "Authorized by: ____________________________" })], spacing: { after: 100 } }),
            new Paragraph({ children: [new TextRun({ text: "Name: ____________________________" })], spacing: { after: 100 } }),
            new Paragraph({ children: [new TextRun({ text: "Designation: ____________________________" })], spacing: { after: 100 } }),
            new Paragraph({ children: [new TextRun({ text: "Date: ____________________________" })], spacing: { after: 100 } }),
          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Consent_Letter_${engagementCode || "ENG"}_${new Date().toISOString().split("T")[0]}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setConsentRecord(prev => ({ ...prev, generatedAt: new Date().toISOString() }));
      toast({ title: "Downloaded", description: "Consent letter downloaded as Word document" });
    } catch (error) {
      console.error("Error generating consent letter:", error);
      toast({ title: "Error", description: "Failed to generate consent letter", variant: "destructive" });
    } finally {
      setGeneratingConsent(false);
    }
  };

  const getDocStatus = (record: DocumentRecord): { label: string; color: string } => {
    if (record.attachedFile) return { label: "Signed Copy Attached", color: "bg-green-100 text-green-800 border-green-300" };
    if (record.generatedAt) return { label: "Generated - Pending Signature", color: "bg-amber-100 text-amber-800 border-amber-300" };
    return { label: "Not Generated", color: "bg-gray-100 text-gray-600 border-gray-300" };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const engStatus = getDocStatus(engRecord);
  const consentStatus = getDocStatus(consentRecord);

  const DocumentCard = ({
    title,
    icon,
    iconColor,
    borderColor,
    bgColor,
    record,
    setRecord,
    status,
    generating,
    uploading,
    onGenerate,
    onAttachClick,
    fileRef,
    type,
  }: {
    title: string;
    icon: React.ReactNode;
    iconColor: string;
    borderColor: string;
    bgColor: string;
    record: DocumentRecord;
    setRecord: React.Dispatch<React.SetStateAction<DocumentRecord>>;
    status: { label: string; color: string };
    generating: boolean;
    onGenerate: () => void;
    onAttachClick: () => void;
    fileRef: React.RefObject<HTMLInputElement>;
    type: "engagement" | "consent";
  }) => (
    <Card className={`${borderColor} ${bgColor}`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            {icon}
            {title}
          </CardTitle>
          <Badge variant="outline" className={`${status.color} text-xs font-medium px-3 py-1`}>
            {status.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm font-medium whitespace-nowrap">Document Date</Label>
          </div>
          <Input
            type="date"
            value={record.date}
            onChange={e => setRecord(prev => ({ ...prev, date: e.target.value }))}
            className="w-48 bg-white"
          />
        </div>

        {type === "engagement" && (
          <div className="space-y-3 p-3 bg-white rounded-lg border">
            <Label className="text-sm font-semibold text-gray-700">Fee Details</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Audit Fee (PKR)</Label>
                <Input
                  type="text"
                  placeholder="e.g. 500,000"
                  value={record.feeDetails?.auditFee || ""}
                  onChange={e => setRecord(prev => ({
                    ...prev,
                    feeDetails: { ...(prev.feeDetails || emptyFeeDetails()), auditFee: e.target.value }
                  }))}
                  className="bg-white"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Tax Treatment</Label>
                <div className="flex gap-1">
                  {(["exclusive", "inclusive"] as const).map(opt => (
                    <Button
                      key={opt}
                      type="button"
                      variant={(record.feeDetails?.taxTreatment || "exclusive") === opt ? "default" : "outline"}
                      size="sm"
                      className="flex-1 capitalize"
                      onClick={() => setRecord(prev => ({
                        ...prev,
                        feeDetails: { ...(prev.feeDetails || emptyFeeDetails()), taxTreatment: opt }
                      }))}
                    >
                      {opt} of Tax
                    </Button>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Out-of-Pocket Expenses</Label>
              <Input
                type="text"
                placeholder="e.g. Conveyance, travel, communication at actual cost"
                value={record.feeDetails?.outOfPocketExpenses || ""}
                onChange={e => setRecord(prev => ({
                  ...prev,
                  feeDetails: { ...(prev.feeDetails || emptyFeeDetails()), outOfPocketExpenses: e.target.value }
                }))}
                className="bg-white"
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={onGenerate}
            disabled={generating}
            size="sm"
            className="bg-purple-600 hover:bg-purple-700"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Download
          </Button>

          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) handleFileAttach(type, file);
              e.target.value = "";
            }}
          />
          <Button
            onClick={onAttachClick}
            variant="outline"
            size="sm"
          >
            <Upload className="h-4 w-4 mr-2" />
            Attach Signed Copy
          </Button>

          {record.attachedFile && (
            <Button
              onClick={() => setViewDialogOpen(type)}
              variant="outline"
              size="sm"
            >
              <Eye className="h-4 w-4 mr-2" />
              View
            </Button>
          )}
        </div>

        {record.attachedFile && (
          <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-green-200">
            <FileCheck className="h-5 w-5 text-green-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{record.attachedFile.name}</p>
              <p className="text-xs text-muted-foreground">
                Uploaded {new Date(record.attachedFile.uploadedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
              onClick={() => setRecord(prev => ({ ...prev, attachedFile: null }))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}

        {record.generatedAt && !record.attachedFile && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Info className="h-3 w-3" />
            Last downloaded on {new Date(record.generatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            {" \u2014 "}Get it signed and attach the signed copy above.
          </p>
        )}

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Notes</Label>
          <Textarea
            value={record.notes}
            onChange={e => setRecord(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="Add any notes about this document..."
            rows={2}
            className="text-sm bg-white"
          />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
        <DocumentCard
          title="Engagement Letter"
          icon={<FileSignature className="h-5 w-5 text-purple-600" />}
          iconColor="text-purple-600"
          borderColor="border-purple-200"
          bgColor="bg-purple-50/30"
          record={engRecord}
          setRecord={setEngRecord}
          status={engStatus}
          generating={generatingEngLetter}
          onGenerate={generateEngagementLetter}
          onAttachClick={() => engFileRef.current?.click()}
          fileRef={engFileRef as React.RefObject<HTMLInputElement>}
          type="engagement"
        />

        <DocumentCard
          title="Consent Letter"
          icon={<FileText className="h-5 w-5 text-blue-600" />}
          iconColor="text-blue-600"
          borderColor="border-blue-200"
          bgColor="bg-blue-50/30"
          record={consentRecord}
          setRecord={setConsentRecord}
          status={consentStatus}
          generating={generatingConsent}
          onGenerate={generateConsentLetter}
          onAttachClick={() => consentFileRef.current?.click()}
          fileRef={consentFileRef as React.RefObject<HTMLInputElement>}
          type="consent"
        />
      </div>

      <Dialog open={viewDialogOpen !== null} onOpenChange={() => setViewDialogOpen(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-green-600" />
              {viewDialogOpen === "engagement" ? "Signed Engagement Letter" : "Signed Consent Letter"}
            </DialogTitle>
          </DialogHeader>
          {(() => {
            const record = viewDialogOpen === "engagement" ? engRecord : consentRecord;
            if (!record.attachedFile) return <p className="text-sm text-muted-foreground">No file attached.</p>;
            const fileUrl = record.attachedFile.url;
            const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(record.attachedFile.name);
            const isPdf = /\.pdf$/i.test(record.attachedFile.name);
            return (
              <div className="space-y-2.5">
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <File className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{record.attachedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Uploaded {new Date(record.attachedFile.uploadedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                </div>
                {isImage && fileUrl && (
                  <img src={fileUrl} alt="Signed document" className="w-full rounded border" />
                )}
                {isPdf && fileUrl && (
                  <iframe src={fileUrl} className="w-full h-96 rounded border" title="Signed document" />
                )}
                {fileUrl && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => window.open(fileUrl, "_blank")}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Open / Download File
                  </Button>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                ISA 210 Compliance Checklist
              </CardTitle>
              <CardDescription className="mt-1">Verify all engagement letter requirements</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">
                {completedCount}/{totalQuestions}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={markAllYes}
              >
                <Check className="h-4 w-4 mr-2" />
                Mark All Yes
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {allQuestions.map((question, idx) => {
            const resp = checklistResponses[question.id] || { response: "", remarks: "" };
            const isComplete = isQuestionComplete(question.id);
            const needsRemarks = resp.response === "No" && !resp.remarks.trim();

            return (
              <Card
                key={question.id}
                className={`border ${isComplete ? "border-green-200 bg-green-50/30" : resp.response ? "border-blue-200" : "border-muted"}`}
              >
                <CardContent className="p-2.5">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
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
                            />
                            <Button variant="ghost" size="icon" onClick={() => removeCustomQuestion(question.id)} className="text-destructive">
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <h4 className="font-medium text-sm text-foreground">{question.question}</h4>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">{question.category}</Badge>
                          <Badge variant="outline" className="text-xs">{question.isaReference}</Badge>
                        </div>
                      </div>
                      {isComplete && <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-10">
                      <div className="space-y-1">
                        <div className="flex gap-1">
                          {["Yes", "No", "N/A"].map(option => (
                            <Button
                              key={option}
                              type="button"
                              variant={resp.response === option ? "default" : "outline"}
                              size="sm"
                              className="flex-1"
                              onClick={() => updateChecklistResponse(question.id, "response", option)}
                            >
                              {option}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Textarea
                          value={resp.remarks}
                          onChange={e => updateChecklistResponse(question.id, "remarks", e.target.value)}
                          placeholder="Remarks..."
                          className={`min-h-[50px] text-sm ${needsRemarks ? "border-red-500" : ""}`}
                          rows={2}
                        />
                        {!resp.remarks && question.suggestedResponse && (
                          <button
                            type="button"
                            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80"
                            onClick={() => useSuggestedResponse(question.id)}
                          >
                            <Wand2 className="h-3 w-3" />
                            Use Suggested
                          </button>
                        )}
                        {needsRemarks && (
                          <p className="text-xs text-red-600 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Required when 'No'
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
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Custom Requirement
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Paperclip className="h-4 w-4" />
            Supporting Documents
          </CardTitle>
          <CardDescription>Upload additional engagement-related correspondence and documents</CardDescription>
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
        <Button onClick={handleSave} disabled={saving || loading} size="lg">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          {saving ? "Saving..." : "Save All Changes"}
        </Button>
      </div>
    </div>
  );
});

EngagementLetterTab.displayName = "EngagementLetterTab";

export default EngagementLetterTab;
