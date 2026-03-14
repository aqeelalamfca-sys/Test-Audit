import { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import { useParams } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ClipboardCheck,
  Shield,
  Users,
  FileText,
  CheckCircle2,
  AlertCircle,
  Save,
  X,
  Loader2,
  ExternalLink,
  Wand2,
  HelpCircle,
  Check,
  Paperclip,
} from "lucide-react";
import { SectionAttachments } from "./section-attachments";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import type { EthicsQuestionnaireItem, EthicsRow } from "./shared-types";

export const ETHICS_ASSESSMENT_QUESTIONS: EthicsQuestionnaireItem[] = [
  {
    id: "publicInterestEntity",
    question: "Is the client a Public Interest Entity (PIE)?",
    helpText: "A Public Interest Entity typically includes listed companies, banks, insurance companies, and entities with significant public interest due to their size, nature of business, or number of employees. PIE status triggers additional independence requirements.",
    suggestedResponse: "Client PIE status has been assessed based on listing status, regulatory requirements, and entity characteristics.",
    isaReference: "IESBA Code 400.8",
    category: "Assessment",
    inputType: "select",
    selectOptions: [
      { value: "yes", label: "Yes - Public Interest Entity" },
      { value: "no", label: "No - Not a Public Interest Entity" },
      { value: "uncertain", label: "Uncertain - Requires Further Assessment" }
    ]
  },
  {
    id: "nonAuditServices",
    question: "What non-audit services are/were provided to the client?",
    helpText: "Document all non-audit services provided during the audit period and preceding year. For PIEs, certain services are prohibited including bookkeeping, payroll services, internal audit, and management functions. Evaluate each service for potential threats to independence.",
    suggestedResponse: "No non-audit services were provided during the audit period or preceding year.",
    isaReference: "IESBA Code R600",
    category: "Assessment",
    inputType: "textarea"
  },
  {
    id: "ethicsCompliance",
    question: "Has the engagement team confirmed compliance with ICAP Code of Ethics?",
    helpText: "All engagement team members must confirm their understanding and compliance with ICAP Code of Ethics requirements including integrity, objectivity, professional competence, confidentiality, and professional behavior.",
    suggestedResponse: "All team members have confirmed compliance with ICAP Code of Ethics and firm policies.",
    isaReference: "ICAP Code of Ethics",
    category: "Assessment",
    inputType: "yes-no"
  },
  {
    id: "rotationRequirements",
    question: "Are partner rotation requirements applicable and complied with?",
    helpText: "For PIE audits, the engagement partner must rotate after a maximum period of 5-7 years (depending on jurisdiction). A cooling-off period of at least 2 years applies before the partner can return to the engagement. Document current tenure and rotation planning.",
    suggestedResponse: "Partner rotation requirements reviewed and complied with. Current partner tenure: [X] years.",
    isaReference: "IESBA Code R540",
    category: "Assessment",
    inputType: "yes-no"
  }
];

export const THREATS_QUESTIONS: EthicsQuestionnaireItem[] = [
  {
    id: "threatsSelfReview",
    question: "Are there any self-review threats?",
    helpText: "Self-review threats occur when the firm prepares data/schedules that will be audited, or provides advice affecting the financial statements. Examples include preparing accounting records, valuations used in financial statements, or designing/implementing internal controls.",
    suggestedResponse: "No self-review threats identified. The firm has not prepared any data or schedules that form part of the financial statements being audited.",
    isaReference: "IESBA Code 600.4 A1",
    category: "Threats",
    inputType: "yes-no"
  },
  {
    id: "threatsSelfInterest",
    question: "Are there any self-interest threats?",
    helpText: "Self-interest threats arise from financial or other interests, including overdue fees from the client, contingent fees, undue dependence on total fees from the client, significant gifts or hospitality, or potential employment with the client.",
    suggestedResponse: "No self-interest threats identified. No overdue fees, contingent fees, or financial interests exist.",
    isaReference: "IESBA Code 600.6 A1",
    category: "Threats",
    inputType: "yes-no"
  },
  {
    id: "threatsAdvocacy",
    question: "Are there any advocacy threats?",
    helpText: "Advocacy threats occur when the firm promotes or advocates for the client's position to the point that objectivity may be compromised. Examples include acting as an advocate in litigation or disputes, or promoting client's securities.",
    suggestedResponse: "No advocacy threats identified. The firm has not promoted or advocated for the client's position.",
    isaReference: "IESBA Code 600.5 A1",
    category: "Threats",
    inputType: "yes-no"
  },
  {
    id: "threatsFamiliarity",
    question: "Are there any familiarity threats?",
    helpText: "Familiarity threats arise from long association with the client or close personal relationships between engagement team members and client personnel. Consider length of relationship, family relationships, and recent employment relationships.",
    suggestedResponse: "No familiarity threats identified. No close personal relationships exist between team members and client personnel.",
    isaReference: "IESBA Code 600.7 A1",
    category: "Threats",
    inputType: "yes-no"
  },
  {
    id: "threatsIntimidation",
    question: "Are there any intimidation threats?",
    helpText: "Intimidation threats occur when the firm may be deterred from acting objectively due to actual or threatened actions by the client. Examples include threats of dismissal, litigation, or pressure to reduce audit procedures inappropriately.",
    suggestedResponse: "No intimidation threats identified. No actual or threatened litigation exists, and no undue pressure has been exerted by the client.",
    isaReference: "IESBA Code 600.8 A1",
    category: "Threats",
    inputType: "yes-no"
  }
];

export const SAFEGUARDS_QUESTIONS: EthicsQuestionnaireItem[] = [
  {
    id: "safeguardsApplied",
    question: "What safeguards have been applied to mitigate identified threats?",
    helpText: "Safeguards include quality reviews by additional partners, consultation with ethics officers, removing team members with conflicts, declining prohibited services, and obtaining pre-approval from those charged with governance.",
    suggestedResponse: "No threats were identified requiring safeguards. Standard quality control procedures are in place including engagement quality review for PIE audits.",
    isaReference: "IESBA Code R300.8",
    category: "Safeguards",
    inputType: "textarea"
  },
  {
    id: "qualityReviewNeeded",
    question: "Is an Engagement Quality Review (EQR) required?",
    helpText: "EQR is mandatory for PIE audits and may be required based on firm policies for other engagements with heightened risk. The EQR must be completed before the audit report is issued.",
    suggestedResponse: "EQR requirements have been assessed and [applicable/not applicable] for this engagement.",
    isaReference: "ISQM 2, ISA 220",
    category: "Safeguards",
    inputType: "yes-no"
  },
  {
    id: "firmPolicies",
    question: "Has compliance with firm independence policies been confirmed?",
    helpText: "Firm policies typically include annual independence declarations, pre-approval of non-audit services, restrictions on financial interests, and cooling-off periods. All team members must confirm compliance.",
    suggestedResponse: "All engagement team members have completed annual independence confirmations. No violations of firm policies identified.",
    isaReference: "ISQM 1",
    category: "Safeguards",
    inputType: "yes-no"
  }
];

export const RELATIONSHIPS_QUESTIONS: EthicsQuestionnaireItem[] = [
  {
    id: "financialInterests",
    question: "Do any team members have direct/indirect financial interests in the client?",
    helpText: "Direct financial interests (shares owned directly) and material indirect interests (through mutual funds, trusts, or relatives) in the audit client are prohibited for engagement team members and their immediate family.",
    suggestedResponse: "All team members have confirmed they hold no direct or indirect financial interests in the client or its related entities.",
    isaReference: "IESBA Code R510",
    category: "Relationships",
    inputType: "yes-no"
  },
  {
    id: "loansRelationships",
    question: "Are there any loans or business relationships with the client?",
    helpText: "Loans to/from the audit client are generally prohibited, except for loans from banks under normal terms. Business relationships such as joint ventures, distribution arrangements, or marketing agreements may create threats to independence.",
    suggestedResponse: "No loans or business relationships exist between the firm, its personnel, and the client.",
    isaReference: "IESBA Code R511, R520",
    category: "Relationships",
    inputType: "yes-no"
  },
  {
    id: "employmentRelationships",
    question: "Are there any employment relationships between firm and client?",
    helpText: "Consider if any former partners or staff have joined the client in key positions, or if client personnel have recently joined the firm. Cooling-off periods may apply depending on the role and timing.",
    suggestedResponse: "No recent employment transitions between firm and client. Cooling-off periods have been observed where applicable.",
    isaReference: "IESBA Code R524",
    category: "Relationships",
    inputType: "yes-no"
  }
];

const EthicsTab = forwardRef<{ save: () => Promise<void> }>((props, ref) => {
  const { toast } = useToast();
  const { engagementId } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const initializeRows = (questions: EthicsQuestionnaireItem[]): EthicsRow[] => {
    return questions.map(q => ({
      id: q.id,
      response: "",
      remarks: "",
      isCustom: false
    }));
  };

  const [assessmentRows, setAssessmentRows] = useState<EthicsRow[]>(() => initializeRows(ETHICS_ASSESSMENT_QUESTIONS));
  const [threatsRows, setThreatsRows] = useState<EthicsRow[]>(() => initializeRows(THREATS_QUESTIONS));
  const [safeguardsRows, setSafeguardsRows] = useState<EthicsRow[]>(() => initializeRows(SAFEGUARDS_QUESTIONS));
  const [relationshipsRows, setRelationshipsRows] = useState<EthicsRow[]>(() => initializeRows(RELATIONSHIPS_QUESTIONS));

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const response = await fetchWithAuth(`/api/workspace/${engagementId}/pre-planning`);
        if (response.ok) {
          const result = await response.json();
          if (result.data?.ethics) {
            const ethicsData = result.data.ethics;
            if (ethicsData.assessmentRows) setAssessmentRows(ethicsData.assessmentRows);
            if (ethicsData.threatsRows) setThreatsRows(ethicsData.threatsRows);
            if (ethicsData.safeguardsRows) setSafeguardsRows(ethicsData.safeguardsRows);
            if (ethicsData.relationshipsRows) setRelationshipsRows(ethicsData.relationshipsRows);
            
            if (ethicsData.formData && !ethicsData.assessmentRows) {
              const fd = ethicsData.formData;
              setAssessmentRows(prev => prev.map(row => {
                if (row.id === "publicInterestEntity" && fd.publicInterestEntity) {
                  return { ...row, response: fd.publicInterestEntity };
                }
                if (row.id === "nonAuditServices" && fd.nonAuditServices) {
                  return { ...row, response: fd.nonAuditServices };
                }
                return row;
              }));
              setThreatsRows(prev => prev.map(row => {
                if (row.id === "threatsSelfReview" && fd.threatsSelfReview) {
                  return { ...row, remarks: fd.threatsSelfReview };
                }
                if (row.id === "threatsSelfInterest" && fd.threatsSelfInterest) {
                  return { ...row, remarks: fd.threatsSelfInterest };
                }
                if (row.id === "threatsAdvocacy" && fd.threatsAdvocacy) {
                  return { ...row, remarks: fd.threatsAdvocacy };
                }
                if (row.id === "threatsFamiliarity" && fd.threatsFamiliarity) {
                  return { ...row, remarks: fd.threatsFamiliarity };
                }
                if (row.id === "threatsIntimidation" && fd.threatsIntimidation) {
                  return { ...row, remarks: fd.threatsIntimidation };
                }
                return row;
              }));
              setSafeguardsRows(prev => prev.map(row => {
                if (row.id === "safeguardsApplied" && fd.safeguardsApplied) {
                  return { ...row, response: fd.safeguardsApplied };
                }
                if (row.id === "firmPolicies" && fd.firmPolicies) {
                  return { ...row, remarks: fd.firmPolicies };
                }
                return row;
              }));
              setRelationshipsRows(prev => prev.map(row => {
                if (row.id === "financialInterests" && fd.financialInterests) {
                  return { ...row, remarks: fd.financialInterests };
                }
                if (row.id === "loansRelationships" && fd.loansRelationships) {
                  return { ...row, remarks: fd.loansRelationships };
                }
                return row;
              }));
            }
          }
        }
      } catch (error) {
        console.error("Failed to load ethics data:", error);
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
      
      const legacyFormData = {
        publicInterestEntity: assessmentRows.find(r => r.id === "publicInterestEntity")?.response || "",
        nonAuditServices: assessmentRows.find(r => r.id === "nonAuditServices")?.response || "",
        threatsSelfReview: threatsRows.find(r => r.id === "threatsSelfReview")?.remarks || "",
        threatsSelfInterest: threatsRows.find(r => r.id === "threatsSelfInterest")?.remarks || "",
        threatsAdvocacy: threatsRows.find(r => r.id === "threatsAdvocacy")?.remarks || "",
        threatsFamiliarity: threatsRows.find(r => r.id === "threatsFamiliarity")?.remarks || "",
        threatsIntimidation: threatsRows.find(r => r.id === "threatsIntimidation")?.remarks || "",
        safeguardsApplied: safeguardsRows.find(r => r.id === "safeguardsApplied")?.remarks || "",
        financialInterests: relationshipsRows.find(r => r.id === "financialInterests")?.remarks || "",
        loansRelationships: relationshipsRows.find(r => r.id === "loansRelationships")?.remarks || "",
        firmPolicies: safeguardsRows.find(r => r.id === "firmPolicies")?.remarks || ""
      };

      const dataToSave = {
        ...existingData,
        ethics: {
          formData: legacyFormData,
          assessmentRows,
          threatsRows,
          safeguardsRows,
          relationshipsRows
        }
      };
      
      const response = await fetchWithAuth(`/api/workspace/${engagementId}/pre-planning`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSave)
      });
      
      if (response.ok) {
        toast({ title: "Saved", description: "Ethics assessment saved successfully" });
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to save ethics data", variant: "destructive" });
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

  const handleNavigateToChecklist = () => {
    const checklistTab = document.querySelector('[data-testid="tab-checklist"]') as HTMLButtonElement;
    if (checklistTab) checklistTab.click();
  };

  const updateRow = (
    setRows: React.Dispatch<React.SetStateAction<EthicsRow[]>>,
    id: string,
    field: keyof EthicsRow,
    value: any
  ) => {
    setRows(rows => rows.map(row => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const getQuestionMeta = (rowId: string): EthicsQuestionnaireItem | undefined => {
    const allQuestions = [
      ...ETHICS_ASSESSMENT_QUESTIONS,
      ...THREATS_QUESTIONS,
      ...SAFEGUARDS_QUESTIONS,
      ...RELATIONSHIPS_QUESTIONS
    ];
    return allQuestions.find(q => q.id === rowId);
  };

  const isEthicsRowComplete = (row: EthicsRow, meta?: EthicsQuestionnaireItem): boolean => {
    if (row.isCustom && row.response.trim() === "") return false;
    if (row.response === "") return false;
    if (meta?.inputType === "yes-no" && row.response === "No" && row.remarks.trim() === "") return false;
    return true;
  };

  const applySuggestedToRow = (
    setRows: React.Dispatch<React.SetStateAction<EthicsRow[]>>,
    rowId: string,
    suggestedResponse: string
  ) => {
    setRows(rows => rows.map(row => 
      row.id === rowId ? { ...row, remarks: suggestedResponse } : row
    ));
  };

  const renderEthicsQuestionnaireSection = (
    title: string,
    description: string,
    icon: React.ReactNode,
    questions: EthicsQuestionnaireItem[],
    rows: EthicsRow[],
    setRows: React.Dispatch<React.SetStateAction<EthicsRow[]>>,
    prefix: string
  ) => {
    const completedCount = rows.filter(r => {
      const meta = getQuestionMeta(r.id);
      return isEthicsRowComplete(r, meta);
    }).length;
    const progressPercent = rows.length > 0 ? Math.round((completedCount / rows.length) * 100) : 0;

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {icon}
              <CardTitle className="text-lg" data-testid={`section-title-${prefix}`}>{title}</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground" data-testid={`progress-counter-${prefix}`}>
                {completedCount}/{rows.length}
              </span>
              {progressPercent === 100 && <CheckCircle2 className="h-4 w-4 text-green-600" data-testid={`status-complete-${prefix}`} />}
            </div>
          </div>
          <CardDescription className="text-xs">{description}</CardDescription>
          <div className="w-full bg-muted rounded-full h-1.5 mt-2" data-testid={`progress-bar-${prefix}`}>
            <div 
              className={`h-1.5 rounded-full transition-all ${progressPercent === 100 ? 'bg-green-500' : 'bg-primary'}`}
              style={{ width: `${progressPercent}%` }}
              data-testid={`progress-fill-${prefix}`}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {rows.map((row, idx) => {
            const meta = getQuestionMeta(row.id);
            const isComplete = isEthicsRowComplete(row, meta);
            const question = questions.find(q => q.id === row.id);
            
            if (!question) return null;

            return (
              <div 
                key={row.id} 
                className={`border rounded-lg p-2.5 transition-all ${
                  isComplete ? 'border-green-200 bg-green-50/30 dark:border-green-900 dark:bg-green-950/30' : 
                  (meta?.inputType === "yes-no" && row.response === "No" && !row.remarks.trim()) ? 'border-red-200 bg-red-50/30 dark:border-red-900 dark:bg-red-950/30' :
                  !row.response ? 'border-amber-200 bg-amber-50/20 dark:border-amber-900 dark:bg-amber-950/20' :
                  'border-border bg-background'
                }`}
                data-testid={`question-card-${row.id}`}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                    isComplete ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-muted text-muted-foreground'
                  }`}>
                    {isComplete ? <Check className="h-4 w-4" /> : idx + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm" data-testid={`text-question-${row.id}`}>{question.question}</p>
                    
                    {question.helpText && (
                      <div className="mt-1 flex items-start gap-1.5">
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-muted-foreground">{question.helpText}</p>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <Badge variant="secondary" className="text-[10px] h-5">
                        {question.category}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] h-5">
                        <FileText className="h-3 w-3 mr-1" />
                        {question.isaReference}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mt-3">
                  <div className={question.inputType === "textarea" ? "md:col-span-12" : "md:col-span-4"}>
                    <Label className="text-xs text-muted-foreground mb-1 block">
                      Response {!row.response && <span className="text-amber-500">*</span>}
                    </Label>
                    
                    {question.inputType === "yes-no" && (
                      <div className={`flex gap-1 ${!row.response ? "rounded border border-amber-300 p-0.5" : ""}`} data-testid={`response-group-${row.id}`}>
                        {["Yes", "No", "N/A"].map(opt => (
                          <Button
                            key={opt}
                            type="button"
                            size="sm"
                            variant={row.response === opt ? "default" : "outline"}
                            className="flex-1"
                            onClick={() => updateRow(setRows, row.id, "response", opt)}
                            data-testid={`button-response-${row.id}-${opt.toLowerCase()}`}
                          >
                            {opt === "Yes" && row.response === opt && <Check className="h-3 w-3 mr-1" />}
                            {opt === "No" && row.response === opt && <X className="h-3 w-3 mr-1" />}
                            {opt}
                          </Button>
                        ))}
                      </div>
                    )}
                    
                    {question.inputType === "select" && question.selectOptions && (
                      <Select 
                        value={row.response} 
                        onValueChange={(v) => updateRow(setRows, row.id, "response", v)}
                      >
                        <SelectTrigger 
                          className={!row.response ? "border-amber-300" : ""} 
                          data-testid={`select-${row.id}`}
                        >
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {question.selectOptions.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    
                    {question.inputType === "textarea" && (
                      <Textarea
                        value={row.response}
                        onChange={e => updateRow(setRows, row.id, "response", e.target.value)}
                        placeholder="Enter your response..."
                        className={`text-xs min-h-[60px] ${!row.response ? "border-amber-300" : ""}`}
                        rows={2}
                        data-testid={`textarea-response-${row.id}`}
                      />
                    )}
                    
                    {!row.response && (
                      <p className="text-xs text-amber-600 mt-1">Please provide a response</p>
                    )}
                  </div>

                  {question.inputType !== "textarea" && (
                    <div className="md:col-span-8">
                      <Label className="text-xs text-muted-foreground mb-1 block">
                        Remarks {question.inputType === "yes-no" && row.response === "No" && <span className="text-red-500">*</span>}
                      </Label>
                      <Textarea
                        value={row.remarks}
                        onChange={e => updateRow(setRows, row.id, "remarks", e.target.value)}
                        placeholder="Click 'Use Suggested' or enter your own..."
                        className={`text-xs min-h-[60px] ${
                          question.inputType === "yes-no" && row.response === "No" && !row.remarks.trim()
                            ? "border-red-400"
                            : ""
                        }`}
                        rows={2}
                        data-testid={`textarea-remarks-${row.id}`}
                      />
                      {!row.remarks.trim() && (
                        <button
                          type="button"
                          className="flex items-center gap-1.5 mt-2 text-sm text-primary hover:text-primary/80 transition-colors"
                          onClick={() => question.suggestedResponse ? applySuggestedToRow(setRows, row.id, question.suggestedResponse) : null}
                          data-testid={`button-use-suggested-${row.id}`}
                        >
                          <Wand2 className="h-3.5 w-3.5" />
                          Use Suggested
                        </button>
                      )}
                      {question.inputType === "yes-no" && row.response === "No" && !row.remarks.trim() && (
                        <p className="text-[10px] text-red-500 mt-1">Remarks required for "No" response</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-3">
      {renderEthicsQuestionnaireSection(
        "Ethics Assessment",
        "Evaluate PIE status, non-audit services, and overall ethics compliance",
        <Shield className="h-5 w-5 text-primary" />,
        ETHICS_ASSESSMENT_QUESTIONS,
        assessmentRows,
        setAssessmentRows,
        "ethics-assessment"
      )}

      {renderEthicsQuestionnaireSection(
        "Threats to Independence",
        "Identify and document threats per IESBA Code categories",
        <AlertCircle className="h-5 w-5 text-amber-500" />,
        THREATS_QUESTIONS,
        threatsRows,
        setThreatsRows,
        "threats"
      )}

      {renderEthicsQuestionnaireSection(
        "Safeguards Applied",
        "Document safeguards to mitigate identified threats and EQR requirements",
        <CheckCircle2 className="h-5 w-5 text-green-500" />,
        SAFEGUARDS_QUESTIONS,
        safeguardsRows,
        setSafeguardsRows,
        "safeguards"
      )}

      {renderEthicsQuestionnaireSection(
        "Financial & Employment Relationships",
        "Evaluate financial interests, loans, and employment relationships",
        <Users className="h-5 w-5 text-blue-500" />,
        RELATIONSHIPS_QUESTIONS,
        relationshipsRows,
        setRelationshipsRows,
        "relationships"
      )}

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-2">
          <div className="flex items-center justify-between gap-2.5 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <ClipboardCheck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Ethics & Independence Checklist</p>
                <p className="text-sm text-muted-foreground">Complete the detailed ICAP/IESBA checklist in the Checklist tab</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleNavigateToChecklist} data-testid="button-view-ethics-checklist">
              <ExternalLink className="h-4 w-4 mr-2" />
              View Full Checklist
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-3">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Paperclip className="h-4 w-4" />
            Ethics Documentation
          </CardTitle>
          <CardDescription>Upload IESBA Code compliance documents, threat assessments, and ethics-related documentation</CardDescription>
        </CardHeader>
        <CardContent>
          <SectionAttachments
            sectionId="tab4-ethics-docs"
            engagementId={engagementId || ""}
            maxFiles={20}
            suggestedDocuments={[
              { name: "IESBA Code compliance declaration" },
              { name: "Threat assessment documentation" },
              { name: "Safeguards implementation record" },
              { name: "Ethics training certificates" },
              { name: "Professional conduct acknowledgement" },
            ]}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button size="sm" onClick={handleSave} disabled={saving || loading} data-testid="button-save-ethics">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          {saving ? "Saving..." : "Save Progress"}
        </Button>
      </div>
    </div>
  );
});

EthicsTab.displayName = "EthicsTab";

export default EthicsTab;
