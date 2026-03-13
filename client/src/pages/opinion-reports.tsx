import { useParams } from "wouter";
import { useState, useRef, useEffect } from "react";
import { AIAssistantPanel } from "@/components/ai-assistant-panel";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import {
  FileText, FileCheck, AlertCircle, CheckCircle2, Scale, Sparkles,
  ClipboardCheck, Package, Mail, Lock, Brain,
  Plus, Upload, Download, Eye, Printer, Info,
  TrendingUp, Send, AlertTriangle
} from "lucide-react";
import { format } from "date-fns";
import html2pdf from "html2pdf.js";
import { PageShell } from "@/components/page-shell";
import { usePhaseRoleGuard } from "@/hooks/use-phase-role-guard";
import { useDeliverablesSaveBridge } from "@/hooks/use-deliverables-save-bridge";
import { useEngagement } from "@/lib/workspace-context";
import { useAuth } from "@/lib/auth";
import { getDocumentHeaderHtml } from "@/lib/pdf-logo";
import { AIOpinionEngine } from "@/components/finalization/ai-opinion-engine";

interface DeliverableFile {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  version: number;
  isCurrentVersion: boolean;
  uploadedAt: string;
  uploadedBy: { id: string; fullName: string };
}

interface Deliverable {
  id: string;
  engagementId: string;
  deliverableType: string;
  customTypeName?: string;
  opinionType?: string;
  remarks?: string;
  deliveredDate?: string;
  status: string;
  preparedById?: string;
  preparedAt?: string;
  reviewedById?: string;
  reviewedAt?: string;
  approvedById?: string;
  approvedAt?: string;
  issuedById?: string;
  issuedAt?: string;
  createdAt: string;
  updatedAt: string;
  preparedBy?: { id: string; fullName: string; role: string };
  reviewedBy?: { id: string; fullName: string; role: string };
  approvedBy?: { id: string; fullName: string; role: string };
  issuedBy?: { id: string; fullName: string; role: string };
  files: DeliverableFile[];
}

const DELIVERABLE_TYPES = [
  { value: "AUDIT_REPORT", label: "Audit Report", description: "Independent Auditor's Report (ISA 700)" },
  { value: "MANAGEMENT_LETTER", label: "Management Letter", description: "Internal Control Deficiencies (ISA 265)" },
  { value: "ENGAGEMENT_SUMMARY", label: "Engagement Summary", description: "Overview of engagement activities" },
  { value: "TIME_SUMMARY", label: "Time Summary", description: "Time spent by phase and team member" },
  { value: "OTHER", label: "Other (Specify)", description: "Custom deliverable type" }
];

const OPINION_TYPES = [
  { value: "UNMODIFIED", label: "Unmodified (Clean)" },
  { value: "QUALIFIED", label: "Qualified" },
  { value: "ADVERSE", label: "Adverse" },
  { value: "DISCLAIMER", label: "Disclaimer" },
  { value: "NOT_APPLICABLE", label: "Not Applicable" }
];

const STATUS_BADGES: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  DRAFT: { label: "Draft", variant: "secondary" },
  FINAL: { label: "Final", variant: "default" },
  ISSUED: { label: "Issued", variant: "outline" }
};

function formatDeliverableType(type: string, customName?: string): string {
  if (type === "OTHER" && customName) return customName;
  const found = DELIVERABLE_TYPES.find(t => t.value === type);
  return found ? found.label : type;
}

function formatOpinionType(type?: string): string {
  if (!type) return "-";
  const found = OPINION_TYPES.find(t => t.value === type);
  return found ? found.label : type;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const opinionReportsTabs = [
  { id: "dashboard", label: "Dashboard", icon: <TrendingUp className="h-3.5 w-3.5" /> },
  { id: "opinion-basis", label: "Report Type & Opinion", icon: <Scale className="h-3.5 w-3.5" /> },
  { id: "emphasis-other", label: "Emphasis / Other Matter", icon: <Info className="h-3.5 w-3.5" /> },
  { id: "kam", label: "Key Audit Matters", icon: <Sparkles className="h-3.5 w-3.5" /> },
  { id: "fs-pack", label: "FS Pack Readiness", icon: <FileCheck className="h-3.5 w-3.5" /> },
  { id: "management-letter", label: "Management Letter", icon: <Mail className="h-3.5 w-3.5" /> },
  { id: "deliverables", label: "Deliverables Checklist", icon: <ClipboardCheck className="h-3.5 w-3.5" /> },
  { id: "report-package", label: "Report Package", icon: <Package className="h-3.5 w-3.5" /> },
  { id: "release-controls", label: "Release Controls", icon: <Lock className="h-3.5 w-3.5" /> },
];

export default function OpinionReportsPage() {
  const params = useParams<{ engagementId: string }>();
  const engagementId = params.engagementId;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { client, engagement } = useEngagement();
  const { firm } = useAuth();
  const roleGuard = usePhaseRoleGuard("opinion-reports", "REPORTING");

  const [activeTab, setActiveTab] = useState("dashboard");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  const [opinionType, setOpinionType] = useState("");
  const [basisForOpinion, setBasisForOpinion] = useState("");
  const [basisForModification, setBasisForModification] = useState("");
  const [emphasisOfMatter, setEmphasisOfMatter] = useState("");
  const [otherMatterParagraph, setOtherMatterParagraph] = useState("");
  const [kamNotes, setKamNotes] = useState("");
  const [managementLetterDraft, setManagementLetterDraft] = useState("");

  const saveEngine = useDeliverablesSaveBridge(engagementId, () => ({
    opinionType,
    basisForOpinion,
    basisForModification,
    emphasisOfMatter,
    otherMatterParagraph,
    kamNotes,
    managementLetterDraft,
    activeTab,
  }));
  const [newDeliverable, setNewDeliverable] = useState({
    deliverableType: "",
    customTypeName: "",
    opinionType: "",
    remarks: "",
    deliveredDate: ""
  });

  const { data: currentUser } = useQuery<{ id: string; role: string; fullName: string }>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/auth/me");
      if (!res.ok) throw new Error("Failed to fetch user");
      return res.json();
    }
  });

  const { data: savedPageData } = useQuery<any>({
    queryKey: [`/api/workspace/${engagementId}/deliverables`],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/workspace/${engagementId}/deliverables`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!engagementId,
    staleTime: 60000,
  });

  const dataLoadedRef = useRef(false);
  useEffect(() => {
    if (savedPageData?.data && !dataLoadedRef.current) {
      dataLoadedRef.current = true;
      const d = savedPageData.data;
      if (d.opinionType) setOpinionType(d.opinionType);
      if (d.basisForOpinion) setBasisForOpinion(d.basisForOpinion);
      if (d.basisForModification) setBasisForModification(d.basisForModification);
      if (d.emphasisOfMatter) setEmphasisOfMatter(d.emphasisOfMatter);
      if (d.otherMatterParagraph) setOtherMatterParagraph(d.otherMatterParagraph);
      if (d.kamNotes) setKamNotes(d.kamNotes);
      if (d.managementLetterDraft) setManagementLetterDraft(d.managementLetterDraft);
      if (d.activeTab) setActiveTab(d.activeTab);
      saveEngine.initializeBaseline();
    }
  }, [savedPageData]);

  const { data: deliverables = [], isLoading } = useQuery<Deliverable[]>({
    queryKey: [`/api/deliverables/${engagementId}`],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/deliverables/${engagementId}`);
      if (!res.ok) throw new Error("Failed to fetch deliverables");
      return res.json();
    },
    enabled: !!engagementId
  });

  const { data: stats } = useQuery<any>({
    queryKey: [`/api/opinion-engine/${engagementId}/opinion-reports-stats`],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/opinion-engine/${engagementId}/opinion-reports-stats`);
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    enabled: !!engagementId,
    staleTime: 30000,
  });

  const { data: preReportCheck } = useQuery<{ readyForDraft: boolean; readyForRelease: boolean; draftIssues: Array<{ type: string; count?: number; message: string }>; issues: Array<{ type: string; count?: number; message: string }> }>({
    queryKey: [`/api/finalization/${engagementId}/pre-report-check`],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/finalization/${engagementId}/pre-report-check`);
      if (!res.ok) throw new Error("Failed to fetch pre-report check");
      return res.json();
    },
    enabled: !!engagementId
  });

  const isPartner = currentUser && ["PARTNER", "FIRM_ADMIN"].includes(currentUser.role);
  const isManager = currentUser && ["MANAGER", "PARTNER", "FIRM_ADMIN"].includes(currentUser.role);
  const canCreate = currentUser && ["SENIOR", "MANAGER", "PARTNER", "FIRM_ADMIN"].includes(currentUser.role);
  const canReview = isManager;
  const canApprove = isPartner;
  const canIssue = isPartner;

  const createMutation = useMutation({
    mutationFn: async (data: typeof newDeliverable) => {
      const res = await fetchWithAuth(`/api/deliverables/${engagementId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliverableType: data.deliverableType,
          customTypeName: data.deliverableType === "OTHER" ? data.customTypeName : undefined,
          opinionType: data.opinionType || undefined,
          remarks: data.remarks || undefined,
          deliveredDate: data.deliveredDate || undefined
        })
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to create deliverable");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/deliverables/${engagementId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/opinion-engine/${engagementId}/opinion-reports-stats`] });
      toast({ title: "Success", description: "Deliverable created" });
      setIsCreateOpen(false);
      setNewDeliverable({ deliverableType: "", customTypeName: "", opinionType: "", remarks: "", deliveredDate: "" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const workflowMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "review" | "approve" | "issue" }) => {
      const res = await fetchWithAuth(`/api/deliverables/${id}/${action}`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error || `Failed to ${action}`);
      return res.json();
    },
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: [`/api/deliverables/${engagementId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/opinion-engine/${engagementId}/opinion-reports-stats`] });
      const msgs: Record<string, string> = { review: "Marked as reviewed", approve: "Approved", issue: "Issued" };
      toast({ title: "Success", description: msgs[action] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetchWithAuth(`/api/deliverables/${id}/upload`, { method: "POST", body: formData });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to upload");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/deliverables/${engagementId}`] });
      toast({ title: "Success", description: "File uploaded" });
      setUploadingFor(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const res = await fetchWithAuth(`/api/deliverables/file/${fileId}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/deliverables/${engagementId}`] });
      toast({ title: "Success", description: "File deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const handleFileUpload = (deliverableId: string) => {
    setUploadingFor(deliverableId);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && uploadingFor) {
      uploadMutation.mutate({ id: uploadingFor, file });
    }
    e.target.value = "";
  };

  const handleExportPDF = async (deliverable: Deliverable) => {
    const clientName = client?.name || "Client";
    const fiscalYearEnd = (engagement as any)?.fiscalYearEnd;
    const headerHtml = await getDocumentHeaderHtml(firm?.logoUrl, firm?.name || "AuditWise");
    const content = `
      <div style="font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto;">
        <div style="margin-bottom: 30px; border-bottom: 2px solid #1a365d; padding-bottom: 20px;">${headerHtml}</div>
        <h2 style="color: #1a365d; margin-bottom: 20px; text-align: center;">${formatDeliverableType(deliverable.deliverableType, deliverable.customTypeName)}</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr><td style="padding: 10px; border: 1px solid #dee2e6; font-weight: bold; width: 200px;">Client</td><td style="padding: 10px; border: 1px solid #dee2e6;">${clientName}</td></tr>
          <tr><td style="padding: 10px; border: 1px solid #dee2e6; font-weight: bold;">Status</td><td style="padding: 10px; border: 1px solid #dee2e6;">${deliverable.status}</td></tr>
          <tr><td style="padding: 10px; border: 1px solid #dee2e6; font-weight: bold;">Opinion</td><td style="padding: 10px; border: 1px solid #dee2e6;">${formatOpinionType(deliverable.opinionType)}</td></tr>
          <tr><td style="padding: 10px; border: 1px solid #dee2e6; font-weight: bold;">Remarks</td><td style="padding: 10px; border: 1px solid #dee2e6;">${deliverable.remarks || "-"}</td></tr>
        </table>
        <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #dee2e6; color: #666; font-size: 12px;">
          <p>Generated by AuditWise on ${format(new Date(), "MMMM d, yyyy 'at' h:mm a")}</p>
        </div>
      </div>`;
    try {
      await html2pdf().set({
        margin: 10,
        filename: `${(firm?.name || "Firm").replace(/[^a-zA-Z0-9]/g, "_").substring(0, 20)}_${clientName.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30)}_${deliverable.deliverableType}_${format(new Date(), "yyyyMMdd")}.pdf`,
        image: { type: "jpeg" as const, quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: "mm" as const, format: "a4" as const, orientation: "portrait" as const }
      }).from(content).save();
      toast({ title: "Success", description: "PDF exported" });
    } catch {
      toast({ title: "Error", description: "Failed to export PDF", variant: "destructive" });
    }
  };

  const showOpinionField = newDeliverable.deliverableType === "AUDIT_REPORT";
  const auditReport = deliverables.find(d => d.deliverableType === "AUDIT_REPORT");
  const managementLetter = deliverables.find(d => d.deliverableType === "MANAGEMENT_LETTER");

  return (
    <PageShell
      showTopBar={false}
      title="Opinion / Reports"
      subtitle={`Form opinion, generate reports & manage deliverables${client?.name ? ` | ${client.name}` : ""}`}
      icon={<Scale className="h-6 w-6 text-primary" />}
      backHref={`/workspace/${engagementId}/finalization`}
      nextHref={`/workspace/${engagementId}/eqcr`}
      dashboardHref="/engagements"
      signoffPhase="REPORTING"
      signoffSection="opinion-reports"
      readOnly={roleGuard.isReadOnly}
      saveFn={async () => {
        try {
          await saveEngine.saveFinal();
          return { ok: true };
        } catch (error) {
          return { ok: false, errors: error };
        }
      }}
      hasUnsavedChanges={saveEngine.isDirty}
      isSaving={saveEngine.isSaving}
      showBack={true}
      showSaveProgress={true}
      showSaveNext={true}
      showSaveClose={true}
    >
      <div className="px-5 py-3 space-y-3 max-w-[1400px] mx-auto w-full">
        <AIAssistantPanel engagementId={engagementId || ""} phaseKey="opinion-reports" className="mb-2" />
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx"
          onChange={handleFileChange}
        />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start flex-wrap gap-1 h-auto p-1">
            {opinionReportsTabs.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} className="gap-1.5 text-xs">
                {tab.icon}
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Dashboard */}
          <TabsContent value="dashboard" className="space-y-4 mt-3">
            {stats ? (
              <>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      Reporting Readiness
                    </CardTitle>
                    <CardDescription>
                      {stats.readiness?.releaseReady
                        ? "All criteria met — report package ready for release"
                        : "Complete the items below before report issuance"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {[
                        { label: "Finalization Approved", done: stats.readiness?.finalizationApproved, icon: <CheckCircle2 className="h-4 w-4" /> },
                        { label: "Opinion Determined", done: stats.readiness?.opinionDetermined, icon: <Scale className="h-4 w-4" />, detail: stats.opinion?.category },
                        { label: "Audit Report Generated", done: stats.readiness?.reportGenerated, icon: <FileText className="h-4 w-4" /> },
                        { label: "Management Letter Prepared", done: stats.readiness?.managementLetterPrepared, icon: <Mail className="h-4 w-4" /> },
                        { label: "Deliverables Complete", done: stats.readiness?.deliverablesComplete, icon: <ClipboardCheck className="h-4 w-4" /> },
                        { label: "Report Issued", done: stats.readiness?.reportIssued, icon: <Send className="h-4 w-4" /> },
                      ].map((item, i) => (
                        <div key={i} className={`flex items-center gap-3 p-3 rounded-md border ${item.done ? "bg-green-50 dark:bg-green-950/20 border-green-200" : "bg-muted/30 border-border"}`}>
                          {item.done ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <AlertTriangle className="h-5 w-5 text-muted-foreground" />}
                          <div className="flex items-center gap-2">
                            {item.icon}
                            <span className="text-sm font-medium">{item.label}</span>
                            {item.detail && <Badge variant="outline" className="text-xs ml-2">{item.detail}</Badge>}
                          </div>
                          <Badge variant={item.done ? "default" : "secondary"} className="ml-auto text-xs">
                            {item.done ? "Done" : "Pending"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <p className="text-2xl font-bold">{stats.deliverables?.total || 0}</p>
                      <p className="text-xs text-muted-foreground">Total Deliverables</p>
                      <div className="flex justify-center gap-2 mt-2">
                        <Badge variant="secondary">{stats.deliverables?.draft || 0} Draft</Badge>
                        <Badge variant="default">{stats.deliverables?.final || 0} Final</Badge>
                        <Badge variant="outline">{stats.deliverables?.issued || 0} Issued</Badge>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <p className="text-2xl font-bold">{stats.keyAuditMatters?.count || 0}</p>
                      <p className="text-xs text-muted-foreground">Key Audit Matters</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <p className="text-2xl font-bold">{stats.controlDeficiencies?.total || 0}</p>
                      <p className="text-xs text-muted-foreground">Control Deficiencies</p>
                      {stats.controlDeficiencies?.open > 0 && (
                        <Badge variant="destructive" className="mt-1">{stats.controlDeficiencies.open} Open</Badge>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-muted-foreground">Loading reporting status...</div>
            )}

            {preReportCheck && !preReportCheck.readyForDraft && (
              <Card className="border-destructive/50">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    Pre-Report Blockers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1">
                    {(preReportCheck.draftIssues || preReportCheck.issues || []).map((issue, idx) => (
                      <li key={idx} className="text-sm flex items-center gap-2">
                        <AlertCircle className="h-3 w-3 text-destructive flex-shrink-0" />
                        <span>{issue.message}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Report Type & Opinion */}
          <TabsContent value="opinion-basis" className="space-y-4 mt-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scale className="h-5 w-5" />
                  Audit Opinion Formation — ISA 700/705
                </CardTitle>
                <CardDescription>Select opinion type and document the basis for opinion</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4" />
                    Opinion Decision Checklist
                  </h3>
                  <div className="space-y-2">
                    {[
                      "Financial statements prepared in accordance with applicable framework",
                      "Financial statements achieve fair presentation",
                      "Sufficient appropriate audit evidence has been obtained",
                      "Uncorrected misstatements evaluated (ISA 450)",
                      "Going concern conclusions considered (ISA 570)",
                      "Subsequent events impact considered (ISA 560)",
                      "Opinion type determined"
                    ].map((item, idx) => (
                      <label key={idx} className="flex items-start gap-2 text-sm cursor-pointer">
                        <input type="checkbox" className="mt-1 h-4 w-4 rounded border-border" />
                        <span>{item}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="text-base font-medium">Opinion Type <span className="text-destructive">*</span></Label>
                  <Select value={opinionType} onValueChange={(v) => { setOpinionType(v); saveEngine.signalChange(); }} disabled={!isPartner}>
                    <SelectTrigger className={!isPartner ? "opacity-50" : ""}>
                      <SelectValue placeholder="Select audit opinion..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UNMODIFIED">Unmodified Opinion (ISA 700)</SelectItem>
                      <SelectItem value="QUALIFIED">Qualified Opinion (ISA 705)</SelectItem>
                      <SelectItem value="ADVERSE">Adverse Opinion (ISA 705)</SelectItem>
                      <SelectItem value="DISCLAIMER">Disclaimer of Opinion (ISA 705)</SelectItem>
                    </SelectContent>
                  </Select>
                  {!isPartner && (
                    <p className="text-sm text-muted-foreground">Only Partner can select the audit opinion.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-base font-medium">Basis for Opinion</Label>
                  <Textarea
                    value={basisForOpinion}
                    onChange={(e) => { setBasisForOpinion(e.target.value); saveEngine.signalChange(); }}
                    placeholder="Document the basis for the audit opinion..."
                    rows={4}
                    disabled={!isManager}
                  />
                </div>

                {opinionType && opinionType !== "UNMODIFIED" && (
                  <div className="space-y-2 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                    <Label className="text-base font-medium">Basis for Modification (ISA 705) <span className="text-destructive">*</span></Label>
                    <Textarea
                      value={basisForModification}
                      onChange={(e) => { setBasisForModification(e.target.value); saveEngine.signalChange(); }}
                      placeholder="Document the basis for the modified opinion..."
                      rows={4}
                      disabled={!isPartner}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Brain className="h-5 w-5" />
                  AI Opinion Engine
                </CardTitle>
                <CardDescription>AI-assisted opinion analysis (ISA 700/705)</CardDescription>
              </CardHeader>
              <CardContent>
                <AIOpinionEngine engagementId={engagementId!} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Emphasis & Other Matter */}
          <TabsContent value="emphasis-other" className="space-y-4 mt-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  Emphasis of Matter / Other Matter — ISA 706
                </CardTitle>
                <CardDescription>Document paragraphs to be included in the auditor's report where applicable</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-base font-medium">Emphasis of Matter Paragraph</Label>
                  <p className="text-xs text-muted-foreground">Include when a matter is appropriately presented or disclosed in the financial statements but is of such importance that it is fundamental to users' understanding</p>
                  <Textarea
                    value={emphasisOfMatter}
                    onChange={(e) => { setEmphasisOfMatter(e.target.value); saveEngine.signalChange(); }}
                    placeholder="Enter emphasis of matter paragraph if applicable..."
                    rows={4}
                    disabled={!isPartner}
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="text-base font-medium">Other Matter Paragraph</Label>
                  <p className="text-xs text-muted-foreground">Include when a matter not presented or disclosed but is relevant to users' understanding of the audit, auditor's responsibilities, or the auditor's report</p>
                  <Textarea
                    value={otherMatterParagraph}
                    onChange={(e) => { setOtherMatterParagraph(e.target.value); saveEngine.signalChange(); }}
                    placeholder="Enter other matter paragraph if applicable..."
                    rows={4}
                    disabled={!isPartner}
                  />
                </div>

                <div className="flex items-center gap-2 p-3 rounded-md border bg-blue-50/50 dark:bg-blue-950/20">
                  <Info className="h-4 w-4 text-blue-500" />
                  <span className="text-xs text-muted-foreground">ISA 706 — these paragraphs do not modify the opinion but draw attention to important matters</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-5 w-5" />
                  Other Information Review — ISA 720
                </CardTitle>
                <CardDescription>Review other information in documents containing audited financial statements</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  "Identified all other information in documents containing audited financial statements",
                  "Read the other information to identify material inconsistencies",
                  "Evaluated any material misstatements of fact",
                  "Considered implications for the auditor's report",
                  "Other Information section included in auditor's report"
                ].map((item, idx) => (
                  <label key={idx} className="flex items-start gap-2 text-sm cursor-pointer">
                    <input type="checkbox" className="mt-1 h-4 w-4 rounded border-border" />
                    <span>{item}</span>
                  </label>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Key Audit Matters */}
          <TabsContent value="kam" className="space-y-4 mt-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Key Audit Matters — ISA 701
                </CardTitle>
                <CardDescription>Matters communicated with TCWG that required significant auditor attention</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {stats?.keyAuditMatters?.count > 0 ? (
                  <div className="space-y-2">
                    {stats.keyAuditMatters.items.map((kam: any) => (
                      <div key={kam.id} className="flex items-center gap-3 p-3 rounded-md border">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">{kam.title || kam.id}</span>
                        <Badge variant="outline" className="ml-auto text-xs">{kam.category}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No key audit matters documented yet</p>
                    <p className="text-xs mt-1">Use the AI Opinion Engine to identify potential KAMs</p>
                  </div>
                )}

                <Separator />

                <div className="space-y-2">
                  <Label className="font-medium">KAM Notes</Label>
                  <Textarea
                    value={kamNotes}
                    onChange={(e) => { setKamNotes(e.target.value); saveEngine.signalChange(); }}
                    placeholder="Document key audit matters and how they were addressed..."
                    rows={5}
                    disabled={!isManager}
                  />
                </div>

                <div className="flex items-center gap-2 p-3 rounded-md border bg-blue-50/50 dark:bg-blue-950/20">
                  <Info className="h-4 w-4 text-blue-500" />
                  <span className="text-xs text-muted-foreground">ISA 701 applies to audits of listed entities and may be applied voluntarily for other engagements</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* FS Pack Readiness */}
          <TabsContent value="fs-pack" className="space-y-4 mt-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileCheck className="h-5 w-5" />
                  Financial Statement Pack Readiness
                </CardTitle>
                <CardDescription>Verify completeness of the financial statement package before report issuance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "Balance Sheet / Statement of Financial Position", required: true },
                  { label: "Income Statement / Statement of Profit or Loss", required: true },
                  { label: "Statement of Cash Flows", required: true },
                  { label: "Statement of Changes in Equity", required: true },
                  { label: "Notes to the Financial Statements", required: true },
                  { label: "Accounting Policies Disclosure", required: true },
                  { label: "Related Party Disclosures", required: true },
                  { label: "Contingencies and Commitments", required: false },
                  { label: "Segment Reporting (if applicable)", required: false },
                  { label: "Directors' Report", required: false },
                ].map((item, idx) => (
                  <label key={idx} className="flex items-start gap-2 text-sm cursor-pointer">
                    <input type="checkbox" className="mt-1 h-4 w-4 rounded border-border" />
                    <span>
                      {item.label}
                      {item.required && <span className="text-destructive ml-1">*</span>}
                    </span>
                  </label>
                ))}

                <Separator />

                <div className="flex items-center gap-2 p-3 rounded-md border bg-blue-50/50 dark:bg-blue-950/20">
                  <Info className="h-4 w-4 text-blue-500" />
                  <span className="text-xs text-muted-foreground">Ensure the financial statement pack is complete and consistent with the adjusted trial balance and audit adjustments before generating the report package</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Management Letter */}
          <TabsContent value="management-letter" className="space-y-4 mt-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Management Letter / Internal Control Letter — ISA 265
                </CardTitle>
                <CardDescription>Communicate significant deficiencies in internal control to those charged with governance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {stats?.controlDeficiencies && stats.controlDeficiencies.total > 0 && (
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="p-3 border rounded-md text-center">
                      <p className="text-xl font-bold">{stats.controlDeficiencies.total}</p>
                      <p className="text-xs text-muted-foreground">Total Deficiencies</p>
                    </div>
                    <div className="p-3 border rounded-md text-center">
                      <p className="text-xl font-bold text-amber-600">{stats.controlDeficiencies.significant}</p>
                      <p className="text-xs text-muted-foreground">Significant</p>
                    </div>
                    <div className="p-3 border rounded-md text-center">
                      <p className="text-xl font-bold text-red-600">{stats.controlDeficiencies.open}</p>
                      <p className="text-xs text-muted-foreground">Open</p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="font-medium">Management Letter Draft</Label>
                  <Textarea
                    value={managementLetterDraft}
                    onChange={(e) => { setManagementLetterDraft(e.target.value); saveEngine.signalChange(); }}
                    placeholder="Draft the management letter covering internal control deficiencies, recommendations, and management responses..."
                    rows={10}
                    disabled={!isManager}
                  />
                </div>

                {managementLetter && (
                  <div className="flex items-center gap-3 p-3 rounded-md border bg-green-50 dark:bg-green-950/20">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Management letter deliverable exists — Status: <Badge variant="outline">{managementLetter.status}</Badge></span>
                  </div>
                )}

                <div className="flex items-center gap-2 p-3 rounded-md border bg-blue-50/50 dark:bg-blue-950/20">
                  <Info className="h-4 w-4 text-blue-500" />
                  <span className="text-xs text-muted-foreground">ISA 265 requires communication of significant deficiencies in internal control identified during the audit to those charged with governance and management</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Deliverables Checklist */}
          <TabsContent value="deliverables" className="space-y-4 mt-3">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <ClipboardCheck className="h-5 w-5" />
                      Deliverables Register
                    </CardTitle>
                    <CardDescription>Track all client-facing deliverables and their approval status</CardDescription>
                  </div>
                  {canCreate && (
                    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <Plus className="h-4 w-4 mr-1" />
                          Add Deliverable
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Create New Deliverable</DialogTitle>
                          <DialogDescription>Add a new deliverable to the engagement register</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>Type *</Label>
                            <Select value={newDeliverable.deliverableType} onValueChange={(v) => setNewDeliverable({ ...newDeliverable, deliverableType: v })}>
                              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                              <SelectContent>
                                {DELIVERABLE_TYPES.map((t) => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}
                              </SelectContent>
                            </Select>
                          </div>
                          {newDeliverable.deliverableType === "OTHER" && (
                            <div className="space-y-2">
                              <Label>Custom Type Name *</Label>
                              <Input value={newDeliverable.customTypeName} onChange={(e) => setNewDeliverable({ ...newDeliverable, customTypeName: e.target.value })} placeholder="Enter custom type" />
                            </div>
                          )}
                          {showOpinionField && (
                            <div className="space-y-2">
                              <Label>Opinion Type *</Label>
                              <Select value={newDeliverable.opinionType} onValueChange={(v) => setNewDeliverable({ ...newDeliverable, opinionType: v })}>
                                <SelectTrigger><SelectValue placeholder="Select opinion" /></SelectTrigger>
                                <SelectContent>
                                  {OPINION_TYPES.map((t) => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          <div className="space-y-2">
                            <Label>Delivered Date</Label>
                            <Input type="date" value={newDeliverable.deliveredDate} onChange={(e) => setNewDeliverable({ ...newDeliverable, deliveredDate: e.target.value })} />
                          </div>
                          <div className="space-y-2">
                            <Label>Remarks</Label>
                            <Textarea value={newDeliverable.remarks} onChange={(e) => setNewDeliverable({ ...newDeliverable, remarks: e.target.value })} placeholder="Optional notes" rows={2} />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                          <Button
                            onClick={() => createMutation.mutate(newDeliverable)}
                            disabled={!newDeliverable.deliverableType || (newDeliverable.deliverableType === "OTHER" && !newDeliverable.customTypeName) || (newDeliverable.deliverableType === "AUDIT_REPORT" && !newDeliverable.opinionType) || createMutation.isPending}
                          >
                            Create
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading deliverables...</div>
                ) : deliverables.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No deliverables yet</p>
                    <p className="text-xs mt-1">Add deliverables to track client-facing documents</p>
                  </div>
                ) : (
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Type</TableHead>
                          <TableHead>Opinion</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Files</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {deliverables.map((d) => {
                          const statusInfo = STATUS_BADGES[d.status] || { label: d.status, variant: "secondary" as const };
                          return (
                            <TableRow key={d.id}>
                              <TableCell className="font-medium text-sm">{formatDeliverableType(d.deliverableType, d.customTypeName)}</TableCell>
                              <TableCell className="text-sm">{formatOpinionType(d.opinionType)}</TableCell>
                              <TableCell>
                                <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{d.files?.length || 0} file(s)</Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex gap-1 justify-end">
                                  <Button size="sm" variant="ghost" onClick={() => handleFileUpload(d.id)} title="Upload file">
                                    <Upload className="h-3 w-3" />
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => handleExportPDF(d)} title="Export PDF">
                                    <Download className="h-3 w-3" />
                                  </Button>
                                  {canReview && d.status === "DRAFT" && (
                                    <Button size="sm" variant="ghost" onClick={() => workflowMutation.mutate({ id: d.id, action: "review" })} title="Mark reviewed">
                                      <Eye className="h-3 w-3" />
                                    </Button>
                                  )}
                                  {canApprove && d.status === "DRAFT" && (
                                    <Button size="sm" variant="ghost" onClick={() => workflowMutation.mutate({ id: d.id, action: "approve" })} title="Approve">
                                      <CheckCircle2 className="h-3 w-3" />
                                    </Button>
                                  )}
                                  {canIssue && d.status === "FINAL" && (
                                    <Button size="sm" variant="outline" onClick={() => workflowMutation.mutate({ id: d.id, action: "issue" })} title="Issue">
                                      <Send className="h-3 w-3 mr-1" />
                                      Issue
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Report Package */}
          <TabsContent value="report-package" className="space-y-4 mt-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Report Package
                </CardTitle>
                <CardDescription>Generated documents for the final report package</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { type: "AUDIT_REPORT", label: "Audit Report", icon: <FileCheck className="h-5 w-5" />, color: "bg-purple-500/10 text-purple-500", isa: "ISA 700" },
                    { type: "MANAGEMENT_LETTER", label: "Management Letter", icon: <Mail className="h-5 w-5" />, color: "bg-orange-500/10 text-orange-500", isa: "ISA 265" },
                    { type: "ENGAGEMENT_SUMMARY", label: "Engagement Summary", icon: <FileText className="h-5 w-5" />, color: "bg-blue-500/10 text-blue-500", isa: "" },
                  ].map(pkg => {
                    const deliv = deliverables.find(d => d.deliverableType === pkg.type);
                    return (
                      <Card key={pkg.type} className="bg-muted/30">
                        <CardContent className="pt-4">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${pkg.color}`}>{pkg.icon}</div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-sm">{pkg.label}</h4>
                              {pkg.isa && <Badge variant="secondary" className="text-[10px] mt-1">{pkg.isa}</Badge>}
                              <div className="flex items-center gap-2 mt-2">
                                {deliv ? (
                                  <Badge variant={STATUS_BADGES[deliv.status]?.variant || "secondary"}>
                                    {STATUS_BADGES[deliv.status]?.label || deliv.status}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline">Not Created</Badge>
                                )}
                                {deliv && (
                                  <Button size="sm" variant="ghost" className="h-7 ml-auto" onClick={() => handleExportPDF(deliv)}>
                                    <Download className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                <Separator />

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => window.print()}>
                    <Printer className="h-4 w-4 mr-1" />
                    Print All
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Release Controls */}
          <TabsContent value="release-controls" className="space-y-4 mt-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Release Controls
                </CardTitle>
                <CardDescription>Final approval and issuance controls for the audit report</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {stats?.readiness && (
                  <div className="space-y-3">
                    {[
                      { label: "Finalization phase approved", met: stats.readiness.finalizationApproved, required: true },
                      { label: "Audit opinion determined and documented", met: stats.readiness.opinionDetermined, required: true },
                      { label: "All deliverables in final or issued status", met: stats.readiness.deliverablesComplete, required: true },
                      { label: "Audit report generated", met: stats.readiness.reportGenerated, required: true },
                      { label: "Management letter prepared", met: stats.readiness.managementLetterPrepared, required: false },
                    ].map((item, i) => (
                      <div key={i} className={`flex items-center gap-3 p-3 rounded-md border ${item.met ? "bg-green-50 dark:bg-green-950/20 border-green-200" : item.required ? "bg-red-50 dark:bg-red-950/20 border-red-200" : "bg-muted/30"}`}>
                        {item.met ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : item.required ? <AlertCircle className="h-5 w-5 text-red-600" /> : <AlertTriangle className="h-5 w-5 text-muted-foreground" />}
                        <span className="text-sm">{item.label}</span>
                        {item.required && !item.met && <Badge variant="destructive" className="ml-auto text-xs">Required</Badge>}
                        {item.met && <Badge variant="default" className="ml-auto text-xs">Met</Badge>}
                      </div>
                    ))}
                  </div>
                )}

                <Separator />

                {auditReport && auditReport.status === "FINAL" && canIssue && (
                  <div className="flex items-center gap-3 p-4 rounded-md border-2 border-primary/50 bg-primary/5">
                    <Send className="h-6 w-6 text-primary" />
                    <div className="flex-1">
                      <p className="font-medium">Ready to Issue Audit Report</p>
                      <p className="text-xs text-muted-foreground">This will mark the report as officially issued and lock it from further changes</p>
                    </div>
                    <Button
                      onClick={() => workflowMutation.mutate({ id: auditReport.id, action: "issue" })}
                      disabled={workflowMutation.isPending || !(stats?.readiness?.finalizationApproved && stats?.readiness?.opinionDetermined)}
                    >
                      <Send className="h-4 w-4 mr-1" />
                      Issue Report
                    </Button>
                  </div>
                )}

                {auditReport?.status === "ISSUED" && (
                  <div className="flex items-center gap-3 p-4 rounded-md border bg-green-50 dark:bg-green-950/20 border-green-200">
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                    <div>
                      <p className="font-medium text-green-700 dark:text-green-400">Audit Report Issued</p>
                      <p className="text-xs text-muted-foreground">
                        Issued by {auditReport.issuedBy?.fullName || "—"} on {auditReport.issuedAt ? format(new Date(auditReport.issuedAt), "MMM d, yyyy") : "—"}
                      </p>
                    </div>
                  </div>
                )}

                {!auditReport && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Lock className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No audit report deliverable created yet</p>
                    <p className="text-xs mt-1">Create an Audit Report deliverable in the Deliverables tab first</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PageShell>
  );
}
