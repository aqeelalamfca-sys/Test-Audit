import { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import { useParams } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calculator,
  CheckCircle2,
  AlertCircle,
  Save,
  Plus,
  Loader2,
  HelpCircle,
  Info,
  Wand2,
  Check,
  X,
  Trash2,
  Paperclip,
} from "lucide-react";
import { SectionAttachments } from "./section-attachments";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

interface ChecklistQuestion {
  id: string;
  question: string;
  helpText: string;
  category: string;
  isaReference: string;
  suggestedResponse: string;
  isCustom?: boolean;
}

const BUDGET_CHECKLIST_QUESTIONS: ChecklistQuestion[] = [
  {
    id: "bud-1",
    question: "Has the budget been prepared using the firm's standard template?",
    helpText: "The firm should have standardized budget templates that ensure consistency across engagements and include all required elements per firm quality policies.",
    category: "Template",
    isaReference: "ISQM 1.32",
    suggestedResponse: "Budget prepared using firm-standard template with all required sections completed.",
  },
  {
    id: "bud-2",
    question: "Have hours been allocated by audit phase (Planning, Interim, Final, Reporting)?",
    helpText: "Hours should be budgeted for each phase of the audit to ensure adequate coverage and proper resource allocation throughout the engagement.",
    category: "Hours Allocation",
    isaReference: "ISA 300.A8",
    suggestedResponse: "Hours allocated across all phases: Planning, Interim fieldwork, Final fieldwork, and Reporting.",
  },
  {
    id: "bud-3",
    question: "Have hours been allocated by staff grade (Partner, Manager, Senior, Staff)?",
    helpText: "Appropriate mix of staff at different levels ensures proper supervision, review, and efficient use of resources per engagement quality requirements.",
    category: "Hours Allocation",
    isaReference: "ISA 220.14",
    suggestedResponse: "Hours budgeted by grade ensuring appropriate supervision ratios and engagement partner involvement.",
  },
  {
    id: "bud-4",
    question: "Have specialist hours been budgeted where required (Tax, Valuation, IT, Forensic)?",
    helpText: "Where specialized skills are needed, the auditor should consider whether to involve specialists and budget for their time accordingly.",
    category: "Specialists",
    isaReference: "ISA 620.7",
    suggestedResponse: "Specialist requirements assessed and hours budgeted for Tax, Valuation, IT audit specialists as needed.",
  },
  {
    id: "bud-5",
    question: "Have key dates been agreed with the client (Planning, Fieldwork, Reporting)?",
    helpText: "The audit timeline should be agreed with management and those charged with governance to ensure availability of personnel and information.",
    category: "Timeline",
    isaReference: "ISA 300.A11",
    suggestedResponse: "Key milestone dates agreed with client management and documented in engagement plan.",
  },
  {
    id: "bud-6",
    question: "Has the fee structure been agreed (Fixed/Hourly/Hybrid)?",
    helpText: "Fee arrangements should be clearly documented and agreed before commencing the engagement, including the basis for computing fees.",
    category: "Fees",
    isaReference: "ISA 210.11",
    suggestedResponse: "Fee structure documented and agreed with client as part of engagement letter terms.",
  },
  {
    id: "bud-7",
    question: "Have billing milestones been defined and agreed?",
    helpText: "Clear billing milestones help manage cash flow and ensure timely payment for services rendered at each stage of the audit.",
    category: "Fees",
    isaReference: "ISA 210.11",
    suggestedResponse: "Billing milestones defined: engagement acceptance, interim completion, fieldwork completion, report issuance.",
  },
  {
    id: "bud-8",
    question: "Have travel and accommodation costs been estimated?",
    helpText: "Out-of-pocket expenses including travel, accommodation, and subsistence should be estimated and agreed with the client.",
    category: "Costs",
    isaReference: "Firm Policy",
    suggestedResponse: "Travel and accommodation costs estimated based on planned site visits and fieldwork locations.",
  },
  {
    id: "bud-9",
    question: "Has a contingency allowance been included in the budget?",
    helpText: "A contingency allowance accounts for unforeseen circumstances, additional procedures required, or scope changes during the engagement.",
    category: "Contingency",
    isaReference: "ISQM 1.32",
    suggestedResponse: "Contingency allowance of 10-15% included to cover unforeseen circumstances and additional procedures.",
  },
  {
    id: "bud-10",
    question: "Has the budget been approved by the Engagement Partner?",
    helpText: "The engagement partner must review and approve the budget to ensure it reflects the planned audit approach and provides sufficient resources.",
    category: "Approval",
    isaReference: "ISA 220.14",
    suggestedResponse: "Budget reviewed and approved by engagement partner confirming adequacy of planned resources.",
  },
  {
    id: "bud-11",
    question: "Has resource allocation been confirmed with the engagement team?",
    helpText: "Team members should be informed of their allocated hours and responsibilities to ensure availability and commitment to the engagement.",
    category: "Resources",
    isaReference: "ISA 220.15",
    suggestedResponse: "Resource allocation communicated to team members with confirmed availability for scheduled dates.",
  },
  {
    id: "bud-12",
    question: "Has client acknowledgment of fee agreement been obtained?",
    helpText: "Written confirmation from the client accepting the fee arrangement provides evidence of agreement on commercial terms.",
    category: "Approval",
    isaReference: "ISA 210.9",
    suggestedResponse: "Client acknowledgment of fee agreement obtained through signed engagement letter or fee confirmation.",
  },
];

const BudgetTab = forwardRef<{ save: () => Promise<void> }>((props, ref) => {
  const { toast } = useToast();
  const { engagementId } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    totalBudgetHours: "",
    planningHours: "",
    interimHours: "",
    finalHours: "",
    reportingHours: "",
    partnerHours: "",
    managerHours: "",
    seniorHours: "",
    staffHours: "",
    assistantHours: "",
    specialistHours: "",
    auditFee: "",
    feeStructure: "",
    billingMilestones: "",
    planningDate: "",
    interimDate: "",
    finalDate: "",
    reportingDate: "",
    specialistRequirements: "",
    travelCosts: "",
    accommodationCosts: "",
    otherCosts: "",
    contingency: "",
    budgetAssumptions: "",
  });

  const [checklistResponses, setChecklistResponses] = useState<Record<string, { response: string; remarks: string }>>(() => {
    const initial: Record<string, { response: string; remarks: string }> = {};
    BUDGET_CHECKLIST_QUESTIONS.forEach(q => {
      initial[q.id] = { response: "", remarks: "" };
    });
    return initial;
  });

  const [customQuestions, setCustomQuestions] = useState<ChecklistQuestion[]>([]);

  const allQuestions = [...BUDGET_CHECKLIST_QUESTIONS, ...customQuestions];

  const addCustomQuestion = () => {
    const newId = `bud-custom-${Date.now()}`;
    const newQuestion: ChecklistQuestion = {
      id: newId,
      question: "",
      helpText: "Custom requirement added by user",
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
          if (result.data?.budget) {
            const { formData: savedFormData, checklistResponses: savedResponses, customQuestions: savedCustom, budgetRows: savedRows } = result.data.budget;
            if (savedFormData) setFormData(savedFormData);
            
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
            // Legacy format migration from old budgetRows
            if (savedRows && !savedResponses) {
              const migrated: Record<string, { response: string; remarks: string }> = {};
              savedRows.forEach((row: { id: string; response?: string; remarks?: string }) => {
                migrated[row.id] = { response: row.response || "", remarks: row.remarks || "" };
              });
              setChecklistResponses(prev => ({ ...prev, ...migrated }));
            }
          }
        }
      } catch (error) {
        console.error("Failed to load budget data:", error);
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
      
      const dataToSave = {
        ...existingData,
        budget: {
          formData,
          checklistResponses,
          customQuestions,
        }
      };
      
      const response = await fetchWithAuth(`/api/workspace/${engagementId}/pre-planning`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSave)
      });
      
      if (response.ok) {
        toast({ title: "Saved", description: "Budget & resource planning saved successfully" });
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to save budget data", variant: "destructive" });
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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-2.5">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span>Loading budget data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Audit Budget & Resource Planning
          </CardTitle>
          <CardDescription>
            Plan resources, timeline, and budget for the audit engagement
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-2">
              <Label>Total Budget Hours <span className="text-destructive">*</span></Label>
              <Input type="number" value={formData.totalBudgetHours} onChange={(e) => setFormData({ ...formData, totalBudgetHours: e.target.value })} data-testid="input-total-budget-hours" />
            </div>
            <div className="space-y-2">
              <Label>Audit Fee (PKR) <span className="text-destructive">*</span></Label>
              <Input type="number" value={formData.auditFee} onChange={(e) => setFormData({ ...formData, auditFee: e.target.value })} data-testid="input-audit-fee" />
            </div>
          </div>

          <Separator />
          <h4 className="font-semibold">Planned Hours by Phase</h4>
          <div className="grid grid-cols-4 gap-2.5">
            <div className="space-y-2">
              <Label>Planning Phase</Label>
              <Input type="number" value={formData.planningHours} onChange={(e) => setFormData({ ...formData, planningHours: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Interim Phase</Label>
              <Input type="number" value={formData.interimHours} onChange={(e) => setFormData({ ...formData, interimHours: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Final Phase</Label>
              <Input type="number" value={formData.finalHours} onChange={(e) => setFormData({ ...formData, finalHours: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Reporting Phase</Label>
              <Input type="number" value={formData.reportingHours} onChange={(e) => setFormData({ ...formData, reportingHours: e.target.value })} />
            </div>
          </div>

          <Separator />
          <h4 className="font-semibold">Hours by Team Grade</h4>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2.5">
            <div className="space-y-2">
              <Label>Partner</Label>
              <Input type="number" value={formData.partnerHours} onChange={(e) => setFormData({ ...formData, partnerHours: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Manager</Label>
              <Input type="number" value={formData.managerHours} onChange={(e) => setFormData({ ...formData, managerHours: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Senior</Label>
              <Input type="number" value={formData.seniorHours} onChange={(e) => setFormData({ ...formData, seniorHours: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Staff</Label>
              <Input type="number" value={formData.staffHours} onChange={(e) => setFormData({ ...formData, staffHours: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Assistant</Label>
              <Input type="number" value={formData.assistantHours} onChange={(e) => setFormData({ ...formData, assistantHours: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Specialist</Label>
              <Input type="number" value={formData.specialistHours} onChange={(e) => setFormData({ ...formData, specialistHours: e.target.value })} />
            </div>
          </div>

          <Separator />
          <h4 className="font-semibold">Fees & Billing</h4>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-2">
              <Label>Fee Structure (Fixed/Variable)</Label>
              <Select value={formData.feeStructure} onValueChange={(v) => setFormData({ ...formData, feeStructure: v })}>
                <SelectTrigger><SelectValue placeholder="Select fee structure" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed Fee</SelectItem>
                  <SelectItem value="hourly">Hourly Rate</SelectItem>
                  <SelectItem value="hybrid">Hybrid (Fixed + Variable)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Billing Milestones</Label>
              <Textarea value={formData.billingMilestones} onChange={(e) => setFormData({ ...formData, billingMilestones: e.target.value })} rows={2} />
            </div>
          </div>

          <Separator />
          <h4 className="font-semibold">Key Dates</h4>
          <div className="grid grid-cols-4 gap-2.5">
            <div className="space-y-2">
              <Label>Planning Start</Label>
              <Input type="date" value={formData.planningDate} onChange={(e) => setFormData({ ...formData, planningDate: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Interim Fieldwork</Label>
              <Input type="date" value={formData.interimDate} onChange={(e) => setFormData({ ...formData, interimDate: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Final Fieldwork</Label>
              <Input type="date" value={formData.finalDate} onChange={(e) => setFormData({ ...formData, finalDate: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Report Date</Label>
              <Input type="date" value={formData.reportingDate} onChange={(e) => setFormData({ ...formData, reportingDate: e.target.value })} />
            </div>
          </div>

          <Separator />
          <h4 className="font-semibold">Specialist & Additional Costs</h4>
          <div className="space-y-2">
            <Label>Specialist Requirements (Tax, Valuation, IT, Forensic)</Label>
            <Textarea value={formData.specialistRequirements} onChange={(e) => setFormData({ ...formData, specialistRequirements: e.target.value })} rows={2} />
          </div>
          <div className="grid grid-cols-4 gap-2.5">
            <div className="space-y-2">
              <Label>Travel Costs</Label>
              <Input type="number" value={formData.travelCosts} onChange={(e) => setFormData({ ...formData, travelCosts: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Accommodation</Label>
              <Input type="number" value={formData.accommodationCosts} onChange={(e) => setFormData({ ...formData, accommodationCosts: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Other Direct Costs</Label>
              <Input type="number" value={formData.otherCosts} onChange={(e) => setFormData({ ...formData, otherCosts: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Contingency %</Label>
              <Input type="number" value={formData.contingency} onChange={(e) => setFormData({ ...formData, contingency: e.target.value })} />
            </div>
          </div>

          <Separator />
          <div className="space-y-2">
            <Label>Budget Assumptions & Constraints</Label>
            <Textarea 
              value={formData.budgetAssumptions}
              onChange={(e) => setFormData({ ...formData, budgetAssumptions: e.target.value })}
              placeholder="Document budget assumptions, constraints, and special considerations..."
              rows={4}
              data-testid="textarea-budget-assumptions"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Budget & Resource Planning Checklist
              </CardTitle>
              <CardDescription className="mt-1">Verify budget preparation and resource allocation requirements</CardDescription>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="outline" className="text-xs">ISA 300</Badge>
                <Badge variant="outline" className="text-xs">ISA 220</Badge>
                <Badge variant="outline" className="text-xs">ISA 620</Badge>
                <Badge variant="outline" className="text-xs">ISQM 1</Badge>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={markAllYes}
                data-testid="button-mark-all-yes"
              >
                <Check className="h-4 w-4 mr-1" />
                Mark All Yes
              </Button>
              <Badge variant={completedCount === totalQuestions ? "default" : "secondary"} className="text-sm px-3 py-1">
                {completedCount}/{totalQuestions} Complete
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {allQuestions.map((question, idx) => {
            const resp = checklistResponses[question.id] || { response: "", remarks: "" };
            const isComplete = isQuestionComplete(question.id);
            const needsRemarks = resp.response === "No" && !resp.remarks.trim();

            return (
              <Card 
                key={question.id} 
                className={`transition-all ${isComplete ? "border-green-200 bg-green-50/30" : resp.response ? "border-amber-200" : ""} ${question.isCustom ? "border-dashed border-blue-300" : ""}`}
              >
                <CardContent className="pt-4">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${isComplete ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                        {isComplete ? <Check className="h-4 w-4" /> : idx + 1}
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="flex-1">
                            {question.isCustom ? (
                              <div className="flex items-center gap-2">
                                <Input
                                  value={question.question}
                                  onChange={e => updateCustomQuestion(question.id, e.target.value)}
                                  placeholder="Enter custom requirement..."
                                  className="text-sm font-medium"
                                  data-testid={`input-custom-question-${question.id}`}
                                />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeCustomQuestion(question.id)}
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                  data-testid={`button-remove-custom-${question.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <p className="text-sm font-medium leading-relaxed">{question.question}</p>
                            )}
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <Badge variant="secondary" className="text-xs">{question.category}</Badge>
                              <Badge variant="outline" className="text-xs text-blue-600">{question.isaReference}</Badge>
                              {question.helpText && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Info className="h-3 w-3" />
                                  {question.helpText.slice(0, 80)}...
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="mt-3">
                          <Label className="text-sm text-muted-foreground mb-1.5 block">
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
                      </div>
                    </div>

                    <div className="pl-11">
                      <div className="space-y-2">
                        <Label className="text-sm text-muted-foreground">Remarks</Label>
                        <Textarea
                          value={resp.remarks}
                          onChange={e => updateChecklistResponse(question.id, "remarks", e.target.value)}
                          placeholder="Click 'Use Suggested' or enter your own..."
                          className={`text-sm min-h-[60px] ${needsRemarks ? "border-red-500 focus:border-red-500" : ""}`}
                          rows={2}
                          data-testid={`textarea-remarks-${question.id}`}
                        />
                        {!resp.remarks.trim() && (
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

      <Card className="mt-3">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Paperclip className="h-4 w-4" />
            Budget & Resource Documents
          </CardTitle>
          <CardDescription>Upload staffing plans, fee schedules, resource allocation documents, and budget approvals</CardDescription>
        </CardHeader>
        <CardContent>
          <SectionAttachments
            sectionId="tab8-budget-docs"
            engagementId={engagementId || ""}
            maxFiles={20}
            suggestedDocuments={[
              { name: "Staffing plan" },
              { name: "Fee schedule" },
              { name: "Resource allocation document" },
              { name: "Budget approval memo" },
              { name: "Timeline and milestones chart" },
            ]}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || loading} data-testid="button-save-budget">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          {saving ? "Saving..." : "Save Progress"}
        </Button>
      </div>
    </div>
  );
});

BudgetTab.displayName = "BudgetTab";

export default BudgetTab;
