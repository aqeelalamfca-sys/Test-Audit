import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams } from "wouter";
import { AIAssistantPanel } from "@/components/ai-assistant-panel";
import { SignOffBar } from "@/components/sign-off-bar";
import { usePhaseRoleGuard } from "@/hooks/use-phase-role-guard";
import { useEngagement } from "@/lib/workspace-context";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Shield,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Save,
  Loader2,
  Bot,
  X,
  FileText,
  Users,
  Scale,
  ClipboardCheck,
  Building2,
  Briefcase,
  Gauge,
  Lock,
  ArrowRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

interface AcceptanceFormData {
  isNewClient: boolean;
  isReengagement: boolean;
  clientIntegrityRating: string;
  clientIntegrityNotes: string;
  managementIntegrityRating: string;
  managementIntegrityNotes: string;
  engagementRiskLevel: string;
  engagementRiskFactors: Record<string, string>;
  priorAuditorContacted: boolean;
  priorAuditorContactDate: string;
  priorAuditorResponse: string;
  priorAuditorConcerns: string;
  competenceConfirmed: boolean;
  competenceNotes: string;
  resourcesAvailable: boolean;
  resourcesNotes: string;
  independenceCleared: boolean;
  independenceClearanceDate: string;
  independenceIssues: string;
  ethicalRequirementsMet: boolean;
  ethicalIssues: string;
  decision: string;
  decisionRationale: string;
  preconditionsAcceptable: boolean;
  preconditionsNotes: string;
  engagementLetterReady: boolean;
  engagementLetterNotes: string;
  continuanceFactors: string;
  continuanceConclusion: string;
  scopeLimitations: string;
  conclusionNarrative: string;
}

const DEFAULT_FORM: AcceptanceFormData = {
  isNewClient: true,
  isReengagement: false,
  clientIntegrityRating: "",
  clientIntegrityNotes: "",
  managementIntegrityRating: "",
  managementIntegrityNotes: "",
  engagementRiskLevel: "",
  engagementRiskFactors: { clientType: "", geographicRisk: "", industryRisk: "", transactionRisk: "" },
  priorAuditorContacted: false,
  priorAuditorContactDate: "",
  priorAuditorResponse: "",
  priorAuditorConcerns: "",
  competenceConfirmed: false,
  competenceNotes: "",
  resourcesAvailable: false,
  resourcesNotes: "",
  independenceCleared: false,
  independenceClearanceDate: "",
  independenceIssues: "",
  ethicalRequirementsMet: false,
  ethicalIssues: "",
  decision: "",
  decisionRationale: "",
  preconditionsAcceptable: false,
  preconditionsNotes: "",
  engagementLetterReady: false,
  engagementLetterNotes: "",
  continuanceFactors: "",
  continuanceConclusion: "",
  scopeLimitations: "",
  conclusionNarrative: "",
};

const TABS = [
  { id: "client-type", label: "Prospective / Recurring", icon: Building2 },
  { id: "acceptance-factors", label: "Acceptance Factors", icon: ClipboardCheck },
  { id: "management-integrity", label: "Management Integrity", icon: Shield },
  { id: "competence-resources", label: "Competence & Resources", icon: Users },
  { id: "preconditions", label: "Preconditions for Audit", icon: FileText },
  { id: "engagement-letter", label: "Engagement Letter Readiness", icon: FileText },
  { id: "continuance", label: "Continuance Assessment", icon: Gauge },
  { id: "conclusion", label: "Acceptance Conclusion", icon: CheckCircle2 },
];

const RISK_LEVELS = [
  { value: "LOW", label: "Low", color: "text-green-600" },
  { value: "NORMAL", label: "Normal", color: "text-blue-600" },
  { value: "HIGH", label: "High", color: "text-red-600" },
];

const INTEGRITY_RATINGS = [
  { value: "SATISFACTORY", label: "Satisfactory" },
  { value: "CONCERNS_NOTED", label: "Concerns Noted" },
  { value: "UNSATISFACTORY", label: "Unsatisfactory" },
];

function computeCompleteness(form: AcceptanceFormData): number {
  let filled = 0;
  let total = 0;
  const check = (val: unknown) => {
    total++;
    if (typeof val === "boolean") { if (val) filled++; }
    else if (typeof val === "string") { if (val.trim()) filled++; }
    else if (val !== null && val !== undefined) filled++;
  };

  check(form.clientIntegrityRating);
  check(form.clientIntegrityNotes);
  check(form.managementIntegrityRating);
  check(form.managementIntegrityNotes);
  check(form.engagementRiskLevel);
  check(form.competenceConfirmed);
  check(form.competenceNotes);
  check(form.resourcesAvailable);
  check(form.preconditionsAcceptable);
  check(form.decision);
  check(form.decisionRationale);
  check(form.conclusionNarrative);

  return total > 0 ? Math.round((filled / total) * 100) : 0;
}

export default function AcceptanceContinuance() {
  const params = useParams<{ engagementId: string }>();
  const { engagementId: contextEngagementId, engagement, client } = useEngagement();
  const { user } = useAuth();
  const engagementId = params.engagementId || contextEngagementId || "";
  const { toast } = useToast();
  const roleGuard = usePhaseRoleGuard("acceptance", "PRE_PLANNING");

  const [form, setForm] = useState<AcceptanceFormData>(DEFAULT_FORM);
  const [activeTab, setActiveTab] = useState("client-type");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [approvalData, setApprovalData] = useState<{ partnerApprovedAt?: string; partnerComments?: string } | null>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [approvalRationale, setApprovalRationale] = useState("");
  const [approvalComments, setApprovalComments] = useState("");
  const [approvalDecision, setApprovalDecision] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [approving, setApproving] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState("");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const hasLoadedRef = useRef(false);

  const completeness = useMemo(() => computeCompleteness(form), [form]);
  const isPartner = user?.role === "PARTNER" || user?.role === "FIRM_ADMIN";

  useEffect(() => {
    if (!engagementId || hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    loadData();
  }, [engagementId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetchWithAuth(`/api/ethics/engagements/${engagementId}/acceptance-data`);
      if (res.ok) {
        const json = await res.json();
        if (json.exists && json.data) {
          const d = json.data;
          setForm(prev => ({
            ...prev,
            isNewClient: d.isNewClient ?? true,
            isReengagement: d.isReengagement ?? false,
            clientIntegrityRating: d.clientIntegrityRating || "",
            clientIntegrityNotes: d.clientIntegrityNotes || "",
            managementIntegrityRating: d.managementIntegrityRating || "",
            managementIntegrityNotes: d.managementIntegrityNotes || "",
            engagementRiskLevel: d.engagementRiskLevel || "",
            engagementRiskFactors: d.engagementRiskFactors || prev.engagementRiskFactors,
            priorAuditorContacted: d.priorAuditorContacted || false,
            priorAuditorContactDate: d.priorAuditorContactDate ? d.priorAuditorContactDate.split("T")[0] : "",
            priorAuditorResponse: d.priorAuditorResponse || "",
            priorAuditorConcerns: d.priorAuditorConcerns || "",
            competenceConfirmed: d.competenceConfirmed || false,
            competenceNotes: d.competenceNotes || "",
            resourcesAvailable: d.resourcesAvailable || false,
            resourcesNotes: d.resourcesNotes || "",
            independenceCleared: d.independenceCleared || false,
            independenceClearanceDate: d.independenceClearanceDate ? d.independenceClearanceDate.split("T")[0] : "",
            independenceIssues: d.independenceIssues || "",
            ethicalRequirementsMet: d.ethicalRequirementsMet || false,
            ethicalIssues: d.ethicalIssues || "",
            decision: d.decision || "",
            decisionRationale: d.decisionRationale || "",
          }));
          if (d.partnerApprovedAt) {
            setIsApproved(true);
            setApprovalData({ partnerApprovedAt: d.partnerApprovedAt, partnerComments: d.partnerComments });
          }
        }
      }
    } catch {
      toast({ title: "Error", description: "Failed to load acceptance data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const saveData = useCallback(async (data: AcceptanceFormData) => {
    try {
      setSaving(true);
      const res = await fetchWithAuth(`/api/ethics/engagements/${engagementId}/acceptance-data`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formData: data }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast({ title: "Saved", description: "Acceptance data saved" });
    } catch {
      toast({ title: "Error", description: "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [engagementId, toast]);

  const handleChange = useCallback((updates: Partial<AcceptanceFormData>) => {
    setForm(prev => {
      const next = { ...prev, ...updates };
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => saveData(next), 2000);
      return next;
    });
  }, [saveData]);

  const handleApprove = async () => {
    if (approvalRationale.length < 10) {
      toast({ title: "Error", description: "Rationale must be at least 10 characters", variant: "destructive" });
      return;
    }
    try {
      setApproving(true);
      const res = await fetchWithAuth(`/api/ethics/engagements/${engagementId}/acceptance-approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: approvalDecision, rationale: approvalRationale, comments: approvalComments }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Approval failed");
      }
      setIsApproved(approvalDecision === "APPROVED");
      setApprovalData({ partnerApprovedAt: new Date().toISOString(), partnerComments: approvalComments });
      setShowApproveDialog(false);
      toast({ title: "Success", description: `Acceptance ${approvalDecision.toLowerCase()} by partner` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setApproving(false);
    }
  };

  const requestAI = async (capability: string) => {
    setAiLoading(true);
    setAiResult("");
    try {
      const context = {
        clientName: client?.name || "",
        engagementCode: engagement?.engagementCode || "",
        form,
        capability,
      };
      setAiResult(
        capability === "acceptance-summary-draft"
          ? generateAcceptanceSummary(context)
          : capability === "missing-field-alerts"
          ? generateMissingAlerts(form)
          : capability === "conclusion-wording"
          ? generateConclusionWording(context)
          : "AI capability not available."
      );
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="page-container space-y-4">
      <SignOffBar phase="PRE_PLANNING" section="acceptance" className="mb-1" />
      <AIAssistantPanel engagementId={engagementId} phaseKey="acceptance" className="mb-2" />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Acceptance & Continuance</h1>
            <p className="text-sm text-muted-foreground">
              {client?.name ? `${client.name} — ` : ""}ISA 220, ISA 210, ISQM 1
              {engagement?.engagementCode && <span className="ml-2 text-xs opacity-70">({engagement.engagementCode})</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isApproved && (
            <Badge variant="default" className="bg-green-600">
              <Lock className="h-3 w-3 mr-1" /> Approved
            </Badge>
          )}
          {saving && <Badge variant="outline"><Loader2 className="h-3 w-3 animate-spin mr-1" /> Saving...</Badge>}
          <Button variant="outline" size="sm" onClick={() => setShowAI(!showAI)}>
            <Bot className="h-4 w-4 mr-1" /> AI Assistant
          </Button>
          <Button size="sm" onClick={() => saveData(form)} disabled={saving}>
            <Save className="h-4 w-4 mr-1" /> Save
          </Button>
          {isPartner && !isApproved && (
            <Button size="sm" variant="default" onClick={() => setShowApproveDialog(true)} disabled={completeness < 50}>
              <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="pt-4 pb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium">Completeness</span>
            <span className="text-sm text-muted-foreground">{completeness}%</span>
          </div>
          <Progress value={completeness} className="h-2" />
        </CardContent>
      </Card>

      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-4 lg:grid-cols-8 w-full h-auto">
              {TABS.map(tab => (
                <TabsTrigger key={tab.id} value={tab.id} className="text-xs flex flex-col gap-1 py-2">
                  <tab.icon className="h-4 w-4" />
                  <span className="hidden lg:inline">{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="client-type" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Prospective / Recurring Client</CardTitle>
                  <CardDescription>Identify whether this is a new engagement or a continuance assessment</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <RadioGroup
                    value={form.isNewClient ? "new" : "recurring"}
                    onValueChange={v => handleChange({ isNewClient: v === "new", isReengagement: v === "recurring" })}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="new" id="new" />
                      <Label htmlFor="new">Prospective (New) Client — First-time engagement</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="recurring" id="recurring" />
                      <Label htmlFor="recurring">Recurring Client — Continuance of existing relationship</Label>
                    </div>
                  </RadioGroup>
                  {!form.isNewClient && (
                    <div className="space-y-2 pt-2">
                      <Label>Prior Auditor Communication</Label>
                      <Select value={form.priorAuditorContacted ? "yes" : "no"} onValueChange={v => handleChange({ priorAuditorContacted: v === "yes" })}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="yes">Prior auditor contacted</SelectItem>
                          <SelectItem value="no">Not applicable / No prior auditor</SelectItem>
                        </SelectContent>
                      </Select>
                      {form.priorAuditorContacted && (
                        <>
                          <Label>Contact Date</Label>
                          <Input type="date" value={form.priorAuditorContactDate} onChange={e => handleChange({ priorAuditorContactDate: e.target.value })} />
                          <Label>Response Summary</Label>
                          <Textarea value={form.priorAuditorResponse} onChange={e => handleChange({ priorAuditorResponse: e.target.value })} placeholder="Summary of prior auditor's response..." />
                          <Label>Concerns Noted</Label>
                          <Textarea value={form.priorAuditorConcerns} onChange={e => handleChange({ priorAuditorConcerns: e.target.value })} placeholder="Any concerns raised by prior auditor..." />
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="acceptance-factors" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Engagement Acceptance Factors (ISA 220)</CardTitle>
                  <CardDescription>Evaluate key factors for accepting the audit engagement</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Overall Risk Level</Label>
                    <Select value={form.engagementRiskLevel} onValueChange={v => handleChange({ engagementRiskLevel: v })}>
                      <SelectTrigger><SelectValue placeholder="Select risk level" /></SelectTrigger>
                      <SelectContent>
                        {RISK_LEVELS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-2 gap-4">
                    {(["clientType", "geographicRisk", "industryRisk", "transactionRisk"] as const).map(factor => (
                      <div key={factor}>
                        <Label className="capitalize">{factor.replace(/([A-Z])/g, " $1").trim()}</Label>
                        <Select
                          value={form.engagementRiskFactors[factor] || ""}
                          onValueChange={v => handleChange({ engagementRiskFactors: { ...form.engagementRiskFactors, [factor]: v } })}
                        >
                          <SelectTrigger><SelectValue placeholder="Rate" /></SelectTrigger>
                          <SelectContent>
                            {RISK_LEVELS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                  <div>
                    <Label>Scope Limitations</Label>
                    <Textarea value={form.scopeLimitations} onChange={e => handleChange({ scopeLimitations: e.target.value })} placeholder="Any anticipated scope limitations..." />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="management-integrity" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Management Integrity Considerations (ISA 210/ISQM 1)</CardTitle>
                  <CardDescription>Assess integrity of principal owners, key management, and those charged with governance</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Client Integrity Assessment</Label>
                    <Select value={form.clientIntegrityRating} onValueChange={v => handleChange({ clientIntegrityRating: v })}>
                      <SelectTrigger><SelectValue placeholder="Select rating" /></SelectTrigger>
                      <SelectContent>
                        {INTEGRITY_RATINGS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Client Integrity Notes</Label>
                    <Textarea value={form.clientIntegrityNotes} onChange={e => handleChange({ clientIntegrityNotes: e.target.value })} placeholder="Document the basis for your integrity assessment..." rows={3} />
                  </div>
                  <Separator />
                  <div>
                    <Label>Management Integrity Assessment</Label>
                    <Select value={form.managementIntegrityRating} onValueChange={v => handleChange({ managementIntegrityRating: v })}>
                      <SelectTrigger><SelectValue placeholder="Select rating" /></SelectTrigger>
                      <SelectContent>
                        {INTEGRITY_RATINGS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Management Integrity Notes</Label>
                    <Textarea value={form.managementIntegrityNotes} onChange={e => handleChange({ managementIntegrityNotes: e.target.value })} placeholder="Document observations on management's integrity, reputation, and ethical values..." rows={3} />
                  </div>
                  <div>
                    <Label>Ethical Requirements Met</Label>
                    <Select value={form.ethicalRequirementsMet ? "yes" : "no"} onValueChange={v => handleChange({ ethicalRequirementsMet: v === "yes" })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes - Ethical requirements met</SelectItem>
                        <SelectItem value="no">No - Issues identified</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {!form.ethicalRequirementsMet && form.ethicalIssues !== undefined && (
                    <div>
                      <Label>Ethical Issues Details</Label>
                      <Textarea value={form.ethicalIssues} onChange={e => handleChange({ ethicalIssues: e.target.value })} placeholder="Document ethical issues..." />
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="competence-resources" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Competence & Resources (ISQM 1.30-32)</CardTitle>
                  <CardDescription>Assess whether the firm has the competence, capabilities, and resources to perform the engagement</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Competence Confirmed</Label>
                    <Select value={form.competenceConfirmed ? "yes" : "no"} onValueChange={v => handleChange({ competenceConfirmed: v === "yes" })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes - Firm has required competence</SelectItem>
                        <SelectItem value="no">No - Competence gaps identified</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Competence Assessment Details</Label>
                    <Textarea value={form.competenceNotes} onChange={e => handleChange({ competenceNotes: e.target.value })} placeholder="Detail the firm's competence in the relevant industry, regulatory environment, and accounting standards..." rows={3} />
                  </div>
                  <Separator />
                  <div>
                    <Label>Resources Available</Label>
                    <Select value={form.resourcesAvailable ? "yes" : "no"} onValueChange={v => handleChange({ resourcesAvailable: v === "yes" })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes - Adequate resources available</SelectItem>
                        <SelectItem value="no">No - Resource constraints identified</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Resources Assessment Details</Label>
                    <Textarea value={form.resourcesNotes} onChange={e => handleChange({ resourcesNotes: e.target.value })} placeholder="Detail staff availability, specialist needs, timing constraints, and technology requirements..." rows={3} />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="preconditions" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Preconditions for an Audit (ISA 210.6)</CardTitle>
                  <CardDescription>Verify that preconditions for the audit are present</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Preconditions Acceptable</Label>
                    <Select value={form.preconditionsAcceptable ? "yes" : "no"} onValueChange={v => handleChange({ preconditionsAcceptable: v === "yes" })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes - All preconditions are satisfied</SelectItem>
                        <SelectItem value="no">No - Precondition issues identified</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Preconditions Assessment</Label>
                    <Textarea
                      value={form.preconditionsNotes}
                      onChange={e => handleChange({ preconditionsNotes: e.target.value })}
                      placeholder="Document: (1) Acceptable financial reporting framework, (2) Management acknowledgment of responsibilities for internal controls, (3) Agreement to provide access to all relevant information..."
                      rows={4}
                    />
                  </div>
                  <div>
                    <Label>Independence Cleared for this Engagement</Label>
                    <Select value={form.independenceCleared ? "yes" : "no"} onValueChange={v => handleChange({ independenceCleared: v === "yes" })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes - Independence confirmed</SelectItem>
                        <SelectItem value="no">No - Independence issues identified</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {!form.independenceCleared && (
                    <div>
                      <Label>Independence Issues</Label>
                      <Textarea value={form.independenceIssues} onChange={e => handleChange({ independenceIssues: e.target.value })} placeholder="Document independence issues..." />
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="engagement-letter" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Engagement Letter Readiness (ISA 210.10)</CardTitle>
                  <CardDescription>Confirm that the engagement letter is ready for issuance or has been issued</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Engagement Letter Ready for Issuance</Label>
                    <Select value={form.engagementLetterReady ? "yes" : "no"} onValueChange={v => handleChange({ engagementLetterReady: v === "yes" })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes - Letter is ready / issued</SelectItem>
                        <SelectItem value="no">No - Letter not yet prepared</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Engagement Letter Notes</Label>
                    <Textarea
                      value={form.engagementLetterNotes}
                      onChange={e => handleChange({ engagementLetterNotes: e.target.value })}
                      placeholder="Document engagement letter status, any modifications from standard terms, specific terms agreed with the client..."
                      rows={3}
                    />
                  </div>
                  <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
                    <p className="font-medium mb-1">ISA 210 Engagement Letter Requirements:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Objective and scope of the audit</li>
                      <li>Responsibilities of the auditor</li>
                      <li>Responsibilities of management</li>
                      <li>Identification of applicable financial reporting framework</li>
                      <li>Reference to expected form and content of reports</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="continuance" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Continuance Assessment (ISQM 1.30)</CardTitle>
                  <CardDescription>For recurring clients, assess whether to continue the engagement relationship</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {form.isNewClient ? (
                    <div className="p-4 bg-muted rounded-lg text-center text-muted-foreground">
                      <p>This is a prospective (new) client. Continuance assessment is not applicable.</p>
                      <p className="text-xs mt-1">Switch to "Recurring Client" on the first tab if this is a continuance.</p>
                    </div>
                  ) : (
                    <>
                      <div>
                        <Label>Continuance Factors</Label>
                        <Textarea
                          value={form.continuanceFactors}
                          onChange={e => handleChange({ continuanceFactors: e.target.value })}
                          placeholder="Document: (1) Changes in client's management or ownership, (2) Changes in risk profile, (3) Issues from prior year audit, (4) Fee arrangements and collectability, (5) Legal or regulatory changes..."
                          rows={4}
                        />
                      </div>
                      <div>
                        <Label>Continuance Conclusion</Label>
                        <Select value={form.continuanceConclusion} onValueChange={v => handleChange({ continuanceConclusion: v })}>
                          <SelectTrigger><SelectValue placeholder="Select conclusion" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CONTINUE">Continue — No significant concerns</SelectItem>
                            <SelectItem value="CONTINUE_WITH_CONDITIONS">Continue with conditions</SelectItem>
                            <SelectItem value="DISCONTINUE">Discontinue the relationship</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="conclusion" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Acceptance Conclusion (ISA 220.12)</CardTitle>
                  <CardDescription>Final acceptance/continuance decision requiring partner approval</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Decision</Label>
                    <Select value={form.decision} onValueChange={v => handleChange({ decision: v })}>
                      <SelectTrigger><SelectValue placeholder="Select decision" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="APPROVED">Accept — Proceed with engagement</SelectItem>
                        <SelectItem value="APPROVED_WITH_CONDITIONS">Accept with conditions</SelectItem>
                        <SelectItem value="REJECTED">Decline — Do not proceed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Decision Rationale</Label>
                    <Textarea value={form.decisionRationale} onChange={e => handleChange({ decisionRationale: e.target.value })} placeholder="Document the rationale for the acceptance/continuance decision..." rows={3} />
                  </div>
                  <div>
                    <Label>Conclusion Narrative</Label>
                    <Textarea value={form.conclusionNarrative} onChange={e => handleChange({ conclusionNarrative: e.target.value })} placeholder="Overall conclusion summarizing the acceptance and continuance assessment..." rows={4} />
                  </div>

                  {isApproved && approvalData && (
                    <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <span className="font-semibold text-green-700 dark:text-green-400">Partner Approved</span>
                      </div>
                      <p className="text-sm text-green-600 dark:text-green-400">
                        Approved on {new Date(approvalData.partnerApprovedAt!).toLocaleDateString()}
                      </p>
                      {approvalData.partnerComments && (
                        <p className="text-sm mt-1 text-muted-foreground">{approvalData.partnerComments}</p>
                      )}
                    </div>
                  )}

                  {!isApproved && isPartner && (
                    <Button onClick={() => setShowApproveDialog(true)} disabled={completeness < 50} className="w-full">
                      <CheckCircle2 className="h-4 w-4 mr-2" /> Submit Partner Approval
                    </Button>
                  )}

                  {!isApproved && !isPartner && (
                    <div className="p-4 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                        <span className="text-sm text-amber-700 dark:text-amber-400">Partner approval required to complete this phase</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {showAI && (
          <div className="w-80 shrink-0">
            <Card className="sticky top-4">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2"><Bot className="h-4 w-4" /> AI Assistant</CardTitle>
                  <Button variant="ghost" size="icon" onClick={() => setShowAI(false)}><X className="h-4 w-4" /></Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => requestAI("acceptance-summary-draft")} disabled={aiLoading}>
                  <FileText className="h-3 w-3 mr-2" /> Draft Acceptance Summary
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => requestAI("missing-field-alerts")} disabled={aiLoading}>
                  <AlertTriangle className="h-3 w-3 mr-2" /> Check Missing Fields
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => requestAI("conclusion-wording")} disabled={aiLoading}>
                  <Scale className="h-3 w-3 mr-2" /> Suggest Conclusion Wording
                </Button>
                {aiLoading && <div className="flex items-center justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>}
                {aiResult && (
                  <div className="mt-3 p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">
                    {aiResult}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Partner Approval — Acceptance & Continuance</DialogTitle>
            <DialogDescription>Review the acceptance assessment and provide your decision. This action is logged in the audit trail.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Decision</Label>
              <RadioGroup value={approvalDecision} onValueChange={v => setApprovalDecision(v as "APPROVED" | "REJECTED")}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="APPROVED" id="approve" />
                  <Label htmlFor="approve">Approve — Accept engagement</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="REJECTED" id="reject" />
                  <Label htmlFor="reject">Reject — Do not accept</Label>
                </div>
              </RadioGroup>
            </div>
            <div>
              <Label>Rationale (minimum 10 characters)</Label>
              <Textarea value={approvalRationale} onChange={e => setApprovalRationale(e.target.value)} placeholder="Document the basis for your approval decision..." rows={3} />
            </div>
            <div>
              <Label>Additional Comments (optional)</Label>
              <Textarea value={approvalComments} onChange={e => setApprovalComments(e.target.value)} placeholder="Any additional comments..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>Cancel</Button>
            <Button onClick={handleApprove} disabled={approving || approvalRationale.length < 10}>
              {approving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
              Confirm {approvalDecision === "APPROVED" ? "Approval" : "Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function generateAcceptanceSummary(ctx: { clientName: string; engagementCode: string; form: AcceptanceFormData }): string {
  const { clientName, engagementCode, form } = ctx;
  const parts = [
    `ACCEPTANCE & CONTINUANCE SUMMARY`,
    `Client: ${clientName || "[Not specified]"}`,
    `Engagement: ${engagementCode || "[Not specified]"}`,
    `Type: ${form.isNewClient ? "Prospective (New) Client" : "Recurring Client"}`,
    ``,
    `INTEGRITY ASSESSMENT:`,
    `  Client Integrity: ${form.clientIntegrityRating || "Not assessed"}`,
    `  Management Integrity: ${form.managementIntegrityRating || "Not assessed"}`,
    ``,
    `RISK ASSESSMENT:`,
    `  Overall Risk Level: ${form.engagementRiskLevel || "Not assessed"}`,
    ``,
    `COMPETENCE & RESOURCES:`,
    `  Competence Confirmed: ${form.competenceConfirmed ? "Yes" : "No"}`,
    `  Resources Available: ${form.resourcesAvailable ? "Yes" : "No"}`,
    ``,
    `PRECONDITIONS:`,
    `  Acceptable: ${form.preconditionsAcceptable ? "Yes" : "No"}`,
    `  Independence Cleared: ${form.independenceCleared ? "Yes" : "No"}`,
    ``,
    `DECISION: ${form.decision || "Pending"}`,
  ];
  return parts.join("\n");
}

function generateMissingAlerts(form: AcceptanceFormData): string {
  const missing: string[] = [];
  if (!form.clientIntegrityRating) missing.push("Client integrity assessment not completed");
  if (!form.managementIntegrityRating) missing.push("Management integrity assessment not completed");
  if (!form.engagementRiskLevel) missing.push("Engagement risk level not set");
  if (!form.competenceNotes) missing.push("Competence assessment details missing");
  if (!form.resourcesNotes) missing.push("Resources assessment details missing");
  if (!form.preconditionsAcceptable && !form.preconditionsNotes) missing.push("Preconditions assessment missing");
  if (!form.decision) missing.push("Acceptance decision not made");
  if (!form.decisionRationale) missing.push("Decision rationale not documented");
  if (!form.conclusionNarrative) missing.push("Conclusion narrative missing");
  if (!form.isNewClient && !form.continuanceConclusion) missing.push("Continuance conclusion not set");
  if (!form.engagementLetterReady) missing.push("Engagement letter not marked as ready");

  if (missing.length === 0) return "All required fields are complete. The acceptance form is ready for partner review.";
  return `MISSING FIELDS (${missing.length}):\n\n` + missing.map((m, i) => `${i + 1}. ${m}`).join("\n");
}

function generateConclusionWording(ctx: { clientName: string; form: AcceptanceFormData }): string {
  const { clientName, form } = ctx;
  const type = form.isNewClient ? "acceptance" : "continuance";
  const decision = form.decision === "APPROVED" ? "accepted" : form.decision === "REJECTED" ? "declined" : "[pending decision]";

  return `SUGGESTED CONCLUSION WORDING:\n\nBased on our evaluation of the ${type} criteria for ${clientName || "[Client Name]"}, including assessment of management integrity (rated: ${form.clientIntegrityRating || "[pending]"}), competence and resource availability, preconditions for the audit under ISA 210, and overall engagement risk (assessed as: ${form.engagementRiskLevel || "[pending]"}), the engagement has been ${decision}.\n\n${form.isNewClient ? "" : "The continuance assessment confirms that no significant changes in circumstances warrant discontinuation of the relationship. "}All relevant factors under ISA 220 and ISQM 1 have been considered and documented.\n\nThis decision is subject to partner approval and has been recorded in the audit trail.`;
}
