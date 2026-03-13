import { useState, useMemo } from "react";
import { useParams } from "wouter";
import { useEngagement } from "@/lib/workspace-context";
import { AIAssistantPanel } from "@/components/ai-assistant-panel";
import { SignOffBar } from "@/components/sign-off-bar";
import { usePhaseRoleGuard } from "@/hooks/use-phase-role-guard";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Eye, Pencil, CheckCircle2, XCircle, AlertTriangle,
  DollarSign, FileText, Loader2, Shield, ArrowLeft, BarChart3,
  Scale, Trash2, Users, Clock, ThumbsUp, ThumbsDown, AlertCircle
} from "lucide-react";
import { Link } from "wouter";

const ADJUSTMENT_TYPES = [
  { value: "CORRECTED", label: "Corrected (AJE)", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  { value: "UNCORRECTED", label: "Uncorrected", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  { value: "RECLASSIFICATION", label: "Reclassification", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  { value: "DISCLOSURE", label: "Disclosure", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
] as const;

const ADJUSTMENT_STATUSES = [
  { value: "IDENTIFIED", label: "Identified", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  { value: "PROPOSED", label: "Proposed", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  { value: "AGREED_POSTED", label: "Agreed & Posted", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  { value: "AGREED_NOT_POSTED", label: "Agreed (Not Posted)", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  { value: "DISPUTED", label: "Disputed", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  { value: "WAIVED", label: "Waived", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200" },
] as const;

const MISSTATEMENT_CLASSIFICATIONS = [
  { value: "FACTUAL", label: "Factual", description: "Misstatements about which there is no doubt" },
  { value: "JUDGMENTAL", label: "Judgmental", description: "Differences arising from management judgments" },
  { value: "PROJECTED", label: "Projected", description: "Auditor's best estimate of misstatements in populations" },
] as const;

interface Adjustment {
  id: string;
  adjustmentRef: string;
  adjustmentType: string;
  status: string;
  misstatementClassification?: string;
  fsArea?: string;
  accountCode?: string;
  accountName?: string;
  description: string;
  auditImpact?: string;
  debitAmount?: number | string;
  creditAmount?: number | string;
  netImpact?: number | string;
  isMaterial: boolean;
  isClearlyTrivial: boolean;
  trivialThresholdAmount?: number | string;
  managementAccepted?: boolean | null;
  managementResponse?: string;
  sadNarrative?: string;
  cumulativeEffect?: number | string;
  observationId?: string;
  linkedProcedureId?: string;
  linkedWorkpaperId?: string;
  linkedEvidenceIds?: string[];
  identifiedAt?: string;
  reviewedAt?: string;
  createdAt: string;
}

interface AdjustmentStats {
  total: number;
  correctedCount: number;
  uncorrectedCount: number;
  reclassificationCount: number;
  disclosureCount: number;
  totalCorrected: number;
  totalUncorrected: number;
  totalReclassification: number;
  totalDisclosure: number;
  trivialCount: number;
  materialCount: number;
  factualCount: number;
  judgmentalCount: number;
  projectedCount: number;
  acceptedCount: number;
  disputedCount: number;
  pendingCount: number;
  reviewedCount: number;
  unreviewedCount: number;
  cumulativeNetImpact: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  materiality?: { overall: number; performance: number; trivial: number } | null;
  hasSadSummary: boolean;
  adjustments: Adjustment[];
}

const defaultForm = {
  adjustmentType: "CORRECTED" as string,
  misstatementClassification: "" as string,
  description: "",
  reason: "",
  fsArea: "",
  debitAccountCode: "",
  debitAccountName: "",
  debitAmount: "",
  creditAccountCode: "",
  creditAccountName: "",
  creditAmount: "",
  isClearlyTrivial: false,
  trivialThresholdAmount: "",
  observationId: "",
  linkedProcedureId: "",
  linkedWorkpaperId: "",
};

export default function Adjustments() {
  const params = useParams<{ engagementId: string }>();
  const { engagementId: contextEngagementId, engagement, client } = useEngagement();
  const engagementId = params.engagementId || contextEngagementId || undefined;
  const { toast } = useToast();
  const roleGuard = usePhaseRoleGuard("adjustments", "EXECUTION");

  const [activeTab, setActiveTab] = useState("dashboard");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | "view">("create");
  const [selectedAdj, setSelectedAdj] = useState<Adjustment | null>(null);
  const [formData, setFormData] = useState(defaultForm);
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [acceptResponse, setAcceptResponse] = useState("");

  const { data: statsData, isLoading } = useQuery<AdjustmentStats>({
    queryKey: [`/api/audit-adjustments/${engagementId}/stats/summary`],
    enabled: !!engagementId,
  });

  const s = statsData || {
    total: 0, correctedCount: 0, uncorrectedCount: 0, reclassificationCount: 0, disclosureCount: 0,
    totalCorrected: 0, totalUncorrected: 0, totalReclassification: 0, totalDisclosure: 0,
    trivialCount: 0, materialCount: 0, factualCount: 0, judgmentalCount: 0, projectedCount: 0,
    acceptedCount: 0, disputedCount: 0, pendingCount: 0, reviewedCount: 0, unreviewedCount: 0,
    cumulativeNetImpact: 0, byStatus: {}, byType: {}, materiality: null, hasSadSummary: false, adjustments: [],
  } as AdjustmentStats;

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", "/api/audit-adjustments", {
        ...data,
        engagementId,
        debitAmount: data.debitAmount ? parseFloat(data.debitAmount) : undefined,
        creditAmount: data.creditAmount ? parseFloat(data.creditAmount) : undefined,
        trivialThresholdAmount: data.trivialThresholdAmount ? parseFloat(data.trivialThresholdAmount) : undefined,
        misstatementClassification: data.misstatementClassification || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/audit-adjustments/${engagementId}/stats/summary`] });
      setDialogOpen(false);
      resetForm();
      toast({ title: "Adjustment created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create adjustment", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PATCH", `/api/audit-adjustments/${engagementId}/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/audit-adjustments/${engagementId}/stats/summary`] });
      setDialogOpen(false);
      resetForm();
      toast({ title: "Adjustment updated" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/audit-adjustments/${engagementId}/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/audit-adjustments/${engagementId}/stats/summary`] });
      toast({ title: "Adjustment deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete", description: error.message, variant: "destructive" });
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async ({ id, accepted, response }: { id: string; accepted: boolean; response?: string }) => {
      return apiRequest("POST", `/api/audit-adjustments/${engagementId}/${id}/management-accept`, { accepted, response });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/audit-adjustments/${engagementId}/stats/summary`] });
      setAcceptDialogOpen(false);
      setAcceptResponse("");
      setSelectedAdj(null);
      toast({ title: "Management response recorded" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to record response", description: error.message, variant: "destructive" });
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/audit-adjustments/${engagementId}/${id}/review`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/audit-adjustments/${engagementId}/stats/summary`] });
      toast({ title: "Adjustment reviewed" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to review", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData(defaultForm);
    setSelectedAdj(null);
  };

  const formatCurrency = (value: string | number | undefined | null) => {
    if (value === undefined || value === null || value === "") return "-";
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(num)) return "-";
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(num);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };

  const getTypeBadge = (type: string) => {
    const config = ADJUSTMENT_TYPES.find(t => t.value === type);
    return <Badge variant="secondary" className={config?.color || ""}>{config?.label || type}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const config = ADJUSTMENT_STATUSES.find(s => s.value === status);
    return <Badge variant="secondary" className={config?.color || ""}>{config?.label || status}</Badge>;
  };

  const openCreateDialog = () => {
    resetForm();
    if (s.materiality?.trivial) {
      setFormData(prev => ({ ...prev, trivialThresholdAmount: String(s.materiality!.trivial) }));
    }
    setDialogMode("create");
    setDialogOpen(true);
  };

  const openEditDialog = (adj: Adjustment) => {
    setSelectedAdj(adj);
    let parsedFsArea: any = {};
    try { parsedFsArea = JSON.parse(adj.fsArea || "{}"); } catch {}
    setFormData({
      adjustmentType: adj.adjustmentType,
      misstatementClassification: adj.misstatementClassification || "",
      description: adj.description,
      reason: adj.auditImpact || "",
      fsArea: adj.fsArea || "",
      debitAccountCode: parsedFsArea.debitAccountCode || adj.accountCode || "",
      debitAccountName: parsedFsArea.debitAccountName || adj.accountName || "",
      debitAmount: adj.debitAmount?.toString() || "",
      creditAccountCode: parsedFsArea.creditAccountCode || "",
      creditAccountName: parsedFsArea.creditAccountName || "",
      creditAmount: adj.creditAmount?.toString() || "",
      isClearlyTrivial: adj.isClearlyTrivial,
      trivialThresholdAmount: adj.trivialThresholdAmount?.toString() || "",
      observationId: adj.observationId || "",
      linkedProcedureId: adj.linkedProcedureId || "",
      linkedWorkpaperId: adj.linkedWorkpaperId || "",
    });
    setDialogMode("edit");
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.description.trim()) {
      toast({ title: "Description is required", variant: "destructive" });
      return;
    }
    if (dialogMode === "create") {
      createMutation.mutate(formData);
    } else if (dialogMode === "edit" && selectedAdj) {
      updateMutation.mutate({
        id: selectedAdj.id,
        data: {
          adjustmentType: formData.adjustmentType,
          misstatementClassification: formData.misstatementClassification || null,
          description: formData.description,
          auditImpact: formData.reason || null,
          accountCode: formData.debitAccountCode || null,
          accountName: formData.debitAccountName || null,
          fsArea: formData.fsArea || null,
          debitAmount: formData.debitAmount ? parseFloat(formData.debitAmount) : null,
          creditAmount: formData.creditAmount ? parseFloat(formData.creditAmount) : null,
          isClearlyTrivial: formData.isClearlyTrivial,
          trivialThresholdAmount: formData.trivialThresholdAmount ? parseFloat(formData.trivialThresholdAmount) : null,
          observationId: formData.observationId || null,
          linkedProcedureId: formData.linkedProcedureId || null,
          linkedWorkpaperId: formData.linkedWorkpaperId || null,
        },
      });
    }
  };

  const gateWarnings = useMemo(() => [
    {
      label: "Adjustment summary prepared",
      passed: s.total > 0,
      isa: "ISA 450",
      detail: s.total > 0 ? `${s.total} adjustment(s) recorded` : "No adjustments — create at least one",
    },
    {
      label: "SAD classified",
      passed: (() => {
        const uncorrectedNonTrivial = s.adjustments.filter(a => a.adjustmentType === "UNCORRECTED" && !a.isClearlyTrivial);
        return uncorrectedNonTrivial.every(a => !!a.misstatementClassification);
      })(),
      isa: "ISA 450",
      detail: (() => {
        const unc = s.adjustments.filter(a => a.adjustmentType === "UNCORRECTED" && !a.isClearlyTrivial);
        const unclass = unc.filter(a => !a.misstatementClassification).length;
        return unclass === 0 ? "All classified" : `${unclass} uncorrected misstatement(s) need classification`;
      })(),
    },
    {
      label: "Management acceptance recorded",
      passed: s.pendingCount === 0 || s.total === 0,
      isa: "ISA 450",
      detail: s.pendingCount > 0 ? `${s.pendingCount} pending acceptance` : "All recorded",
    },
    {
      label: "Cumulative effect assessed",
      passed: s.totalUncorrected === 0,
      isa: "ISA 450",
      detail: s.totalUncorrected > 0
        ? `Uncorrected total: ${formatCurrency(s.totalUncorrected)}${s.materiality ? ` vs materiality: ${formatCurrency(s.materiality.overall)}` : ""}`
        : "No uncorrected misstatements",
    },
  ], [s]);

  if (!engagementId) {
    return <div className="flex items-center justify-center h-full"><p className="text-muted-foreground">No engagement selected</p></div>;
  }

  return (
    <div className="flex flex-col h-full">
      <SignOffBar phase="EXECUTION" section="adjustments" className="mx-6 mt-2" />
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href={`/workspace/${engagementId}`}>
              <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold">Adjustments & Misstatements</h1>
              <p className="text-sm text-muted-foreground">{client?.name || engagement?.client?.name || ""}</p>
            </div>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            New Adjustment
          </Button>
        </div>
      </div>

      <div className="px-4 pt-3">
        <AIAssistantPanel engagementId={engagementId || ""} phaseKey="adjustments" />
      </div>
      <div className="flex-1 overflow-auto p-4 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline" className="text-xs">
            <Shield className="h-3 w-3 mr-1" />
            ISA 450 — Evaluation of Misstatements
          </Badge>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="dashboard"><BarChart3 className="h-3.5 w-3.5 mr-1" />Dashboard</TabsTrigger>
            <TabsTrigger value="journal"><FileText className="h-3.5 w-3.5 mr-1" />Journal Entries</TabsTrigger>
            <TabsTrigger value="sad"><Scale className="h-3.5 w-3.5 mr-1" />SAD Summary</TabsTrigger>
            <TabsTrigger value="review"><Users className="h-3.5 w-3.5 mr-1" />Review</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-2xl font-bold">{s.total}</p>
                      <p className="text-xs text-muted-foreground">Total</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="text-2xl font-bold">{s.correctedCount}</p>
                      <p className="text-xs text-muted-foreground">Corrected</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-red-500" />
                    <div>
                      <p className="text-2xl font-bold">{s.uncorrectedCount}</p>
                      <p className="text-xs text-muted-foreground">Uncorrected</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="text-lg font-bold">{formatCurrency(s.cumulativeNetImpact)}</p>
                      <p className="text-xs text-muted-foreground">Net Impact</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <ThumbsUp className="h-5 w-5 text-emerald-500" />
                    <div>
                      <p className="text-2xl font-bold">{s.acceptedCount}</p>
                      <p className="text-xs text-muted-foreground">Accepted</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <ThumbsDown className="h-5 w-5 text-orange-500" />
                    <div>
                      <p className="text-2xl font-bold">{s.disputedCount}</p>
                      <p className="text-xs text-muted-foreground">Disputed</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {s.materiality && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Scale className="h-4 w-4 text-blue-500" />
                    Materiality Thresholds (ISA 320)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-3 border rounded-md text-center">
                      <p className="text-lg font-bold">{formatCurrency(s.materiality.overall)}</p>
                      <p className="text-xs text-muted-foreground">Overall Materiality</p>
                    </div>
                    <div className="p-3 border rounded-md text-center">
                      <p className="text-lg font-bold">{formatCurrency(s.materiality.performance)}</p>
                      <p className="text-xs text-muted-foreground">Performance Materiality</p>
                    </div>
                    <div className="p-3 border rounded-md text-center">
                      <p className="text-lg font-bold">{formatCurrency(s.materiality.trivial)}</p>
                      <p className="text-xs text-muted-foreground">Clearly Trivial Threshold</p>
                    </div>
                  </div>
                  {s.totalUncorrected > 0 && (
                    <div className="mt-3 p-3 rounded-md border">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium">Uncorrected vs Overall Materiality</span>
                        <span className="text-xs">
                          {formatCurrency(s.totalUncorrected)} / {formatCurrency(s.materiality.overall)}
                          {" "}({Math.round((s.totalUncorrected / s.materiality.overall) * 100)}%)
                        </span>
                      </div>
                      <Progress
                        value={Math.min(100, (s.totalUncorrected / s.materiality.overall) * 100)}
                        className="h-2"
                      />
                      {s.totalUncorrected >= s.materiality.overall && (
                        <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Uncorrected misstatements exceed overall materiality — opinion impact
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Phase Gate Compliance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {gateWarnings.map((g, i) => (
                    <div key={i} className={`flex items-start gap-2 p-2 rounded-md border ${g.passed ? "bg-green-50 dark:bg-green-950/20" : "bg-red-50 dark:bg-red-950/20"}`}>
                      {g.passed ? <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" /> : <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />}
                      <div>
                        <p className="text-xs font-medium">{g.label}</p>
                        <p className="text-xs text-muted-foreground">{g.detail}</p>
                        <Badge variant="outline" className="text-[9px] mt-0.5">{g.isa}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {s.total > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Classification Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 border rounded-md">
                      <p className="text-2xl font-bold text-blue-600">{s.factualCount}</p>
                      <p className="text-xs text-muted-foreground">Factual</p>
                    </div>
                    <div className="text-center p-3 border rounded-md">
                      <p className="text-2xl font-bold text-amber-600">{s.judgmentalCount}</p>
                      <p className="text-xs text-muted-foreground">Judgmental</p>
                    </div>
                    <div className="text-center p-3 border rounded-md">
                      <p className="text-2xl font-bold text-purple-600">{s.projectedCount}</p>
                      <p className="text-xs text-muted-foreground">Projected</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="journal" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">Journal Entries ({s.total})</CardTitle>
                  <Button size="sm" onClick={openCreateDialog}>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Entry
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : s.adjustments.length === 0 ? (
                  <div className="text-center py-12">
                    <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-1">No adjustments yet</h3>
                    <p className="text-sm text-muted-foreground mb-4">Record proposed or actual journal entries</p>
                    <Button onClick={openCreateDialog}><Plus className="h-4 w-4 mr-2" />Create First Entry</Button>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ref</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Classification</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Debit</TableHead>
                          <TableHead className="text-right">Credit</TableHead>
                          <TableHead className="text-right">Net Impact</TableHead>
                          <TableHead>Trivial</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {s.adjustments.map(adj => (
                          <TableRow key={adj.id} className={adj.isClearlyTrivial ? "opacity-60" : ""}>
                            <TableCell className="font-medium text-xs">{adj.adjustmentRef}</TableCell>
                            <TableCell>{getTypeBadge(adj.adjustmentType)}</TableCell>
                            <TableCell>
                              {adj.misstatementClassification ? (
                                <Badge variant="outline" className="text-[10px]">{adj.misstatementClassification}</Badge>
                              ) : (
                                adj.adjustmentType === "UNCORRECTED" && !adj.isClearlyTrivial ? (
                                  <Badge variant="destructive" className="text-[10px]">
                                    <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />Unclassified
                                  </Badge>
                                ) : <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="max-w-[200px]">
                              <p className="text-xs truncate">{adj.description}</p>
                            </TableCell>
                            <TableCell className="text-right text-xs">{formatCurrency(adj.debitAmount)}</TableCell>
                            <TableCell className="text-right text-xs">{formatCurrency(adj.creditAmount)}</TableCell>
                            <TableCell className="text-right text-xs font-medium">{formatCurrency(adj.netImpact)}</TableCell>
                            <TableCell>
                              {adj.isClearlyTrivial ? (
                                <Badge variant="secondary" className="text-[10px]">Trivial</Badge>
                              ) : adj.isMaterial ? (
                                <Badge variant="destructive" className="text-[10px]">Material</Badge>
                              ) : <span className="text-xs text-muted-foreground">-</span>}
                            </TableCell>
                            <TableCell>{getStatusBadge(adj.status)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(adj)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => { setSelectedAdj(adj); setAcceptDialogOpen(true); }}
                                >
                                  <ThumbsUp className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => deleteMutation.mutate(adj.id)}
                                  disabled={adj.status === "AGREED_POSTED"}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sad" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Corrected Misstatements (AJEs)
                  </CardTitle>
                  <CardDescription className="text-xs">Adjustments agreed and posted by management</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-4 border rounded-md mb-3">
                    <p className="text-3xl font-bold text-green-600">{formatCurrency(s.totalCorrected)}</p>
                    <p className="text-xs text-muted-foreground">{s.correctedCount} adjustment(s)</p>
                  </div>
                  <ScrollArea className="max-h-[200px]">
                    {s.adjustments.filter(a => a.adjustmentType === "CORRECTED").map(adj => (
                      <div key={adj.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                        <div>
                          <p className="text-xs font-medium">{adj.adjustmentRef}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">{adj.description}</p>
                        </div>
                        <span className="text-xs font-medium">{formatCurrency(adj.netImpact)}</span>
                      </div>
                    ))}
                    {s.correctedCount === 0 && <p className="text-xs text-muted-foreground text-center py-4">No corrected entries</p>}
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-500" />
                    Uncorrected Misstatements
                  </CardTitle>
                  <CardDescription className="text-xs">Misstatements not adjusted — evaluate cumulative effect</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-4 border rounded-md mb-3">
                    <p className="text-3xl font-bold text-red-600">{formatCurrency(s.totalUncorrected)}</p>
                    <p className="text-xs text-muted-foreground">{s.uncorrectedCount} uncorrected</p>
                  </div>
                  <ScrollArea className="max-h-[200px]">
                    {s.adjustments.filter(a => a.adjustmentType === "UNCORRECTED").map(adj => (
                      <div key={adj.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="text-xs font-medium">{adj.adjustmentRef}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[150px]">{adj.description}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-medium">{formatCurrency(adj.netImpact)}</span>
                          {adj.misstatementClassification && (
                            <Badge variant="outline" className="text-[9px] ml-1">{adj.misstatementClassification}</Badge>
                          )}
                          {adj.isClearlyTrivial && <Badge variant="secondary" className="text-[9px] ml-1">Trivial</Badge>}
                        </div>
                      </div>
                    ))}
                    {s.uncorrectedCount === 0 && <p className="text-xs text-muted-foreground text-center py-4">No uncorrected entries</p>}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Scale className="h-4 w-4 text-amber-500" />
                  SAD Summary — Cumulative Effect Assessment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Corrected (AJEs posted)</TableCell>
                      <TableCell className="text-right">{s.correctedCount}</TableCell>
                      <TableCell className="text-right text-green-600 font-medium">{formatCurrency(s.totalCorrected)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Uncorrected</TableCell>
                      <TableCell className="text-right">{s.uncorrectedCount}</TableCell>
                      <TableCell className="text-right text-red-600 font-medium">{formatCurrency(s.totalUncorrected)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Reclassifications</TableCell>
                      <TableCell className="text-right">{s.reclassificationCount}</TableCell>
                      <TableCell className="text-right">{formatCurrency(s.totalReclassification)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Disclosure</TableCell>
                      <TableCell className="text-right">{s.disclosureCount}</TableCell>
                      <TableCell className="text-right">{formatCurrency(s.totalDisclosure)}</TableCell>
                    </TableRow>
                    <TableRow className="font-bold border-t-2">
                      <TableCell>Net Cumulative Impact</TableCell>
                      <TableCell className="text-right">{s.total}</TableCell>
                      <TableCell className="text-right">{formatCurrency(s.cumulativeNetImpact)}</TableCell>
                    </TableRow>
                    {s.materiality && (
                      <>
                        <TableRow className="bg-muted/50">
                          <TableCell colSpan={2}>Overall Materiality</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(s.materiality.overall)}</TableCell>
                        </TableRow>
                        <TableRow className="bg-muted/50">
                          <TableCell colSpan={2}>Clearly Trivial Threshold</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(s.materiality.trivial)}</TableCell>
                        </TableRow>
                      </>
                    )}
                  </TableBody>
                </Table>

                {s.materiality && s.totalUncorrected > 0 && (
                  <div className={`mt-3 p-3 rounded-md border ${s.totalUncorrected >= s.materiality.overall ? "bg-red-50 dark:bg-red-950/20 border-red-200" : s.totalUncorrected >= s.materiality.performance ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200" : "bg-green-50 dark:bg-green-950/20 border-green-200"}`}>
                    <p className="text-sm font-medium flex items-center gap-2">
                      {s.totalUncorrected >= s.materiality.overall ? (
                        <><AlertCircle className="h-4 w-4 text-red-600" /> Uncorrected misstatements EXCEED overall materiality</>
                      ) : s.totalUncorrected >= s.materiality.performance ? (
                        <><AlertTriangle className="h-4 w-4 text-amber-600" /> Uncorrected misstatements exceed performance materiality</>
                      ) : (
                        <><CheckCircle2 className="h-4 w-4 text-green-600" /> Uncorrected misstatements below performance materiality</>
                      )}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="review" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-500" />
                    Review Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Reviewed</span>
                      <Badge variant="default">{s.reviewedCount}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Pending Review</span>
                      <Badge variant="secondary">{s.unreviewedCount}</Badge>
                    </div>
                    {s.total > 0 && (
                      <Progress value={(s.reviewedCount / s.total) * 100} className="h-2" />
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <ThumbsUp className="h-4 w-4 text-green-500" />
                    Management Acceptance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Accepted</span>
                      <Badge className="bg-green-100 text-green-800">{s.acceptedCount}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Disputed</span>
                      <Badge className="bg-red-100 text-red-800">{s.disputedCount}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Pending</span>
                      <Badge className="bg-yellow-100 text-yellow-800">{s.pendingCount}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Adjustments Requiring Action</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[400px]">
                  {s.adjustments.filter(a => a.managementAccepted === null || !a.reviewedAt).length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle2 className="h-10 w-10 mx-auto text-green-500 mb-3" />
                      <p className="text-sm text-muted-foreground">All adjustments reviewed and accepted</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {s.adjustments.filter(a => a.managementAccepted === null || !a.reviewedAt).map(adj => (
                        <div key={adj.id} className="flex items-center justify-between p-3 border rounded-md">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{adj.adjustmentRef}</span>
                              {getTypeBadge(adj.adjustmentType)}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[300px]">{adj.description}</p>
                            <p className="text-xs mt-0.5">
                              Net: <strong>{formatCurrency(adj.netImpact)}</strong>
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {!adj.reviewedAt && (
                              <Button size="sm" variant="outline" onClick={() => reviewMutation.mutate(adj.id)}>
                                <Eye className="h-3.5 w-3.5 mr-1" />Review
                              </Button>
                            )}
                            {adj.managementAccepted === null && (
                              <Button size="sm" variant="outline" onClick={() => { setSelectedAdj(adj); setAcceptDialogOpen(true); }}>
                                <ThumbsUp className="h-3.5 w-3.5 mr-1" />Accept/Dispute
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "create" ? "Create New Adjustment" : `Edit ${selectedAdj?.adjustmentRef}`}
            </DialogTitle>
            <DialogDescription>
              Record a proposed or actual journal entry per ISA 450
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1">
            <div className="space-y-4 pr-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Adjustment Type</Label>
                  <Select value={formData.adjustmentType} onValueChange={v => setFormData({ ...formData, adjustmentType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ADJUSTMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Misstatement Classification</Label>
                  <Select
                    value={formData.misstatementClassification || "__none__"}
                    onValueChange={v => setFormData({ ...formData, misstatementClassification: v === "__none__" ? "" : v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Select classification" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Not Classified</SelectItem>
                      {MISSTATEMENT_CLASSIFICATIONS.map(c => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label} — {c.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description <span className="text-destructive">*</span></Label>
                <Textarea
                  placeholder="Describe the adjustment/misstatement..."
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Audit Impact / Reason</Label>
                <Textarea
                  placeholder="Why is this adjustment needed?"
                  value={formData.reason}
                  onChange={e => setFormData({ ...formData, reason: e.target.value })}
                  rows={2}
                />
              </div>

              <Separator />

              <h4 className="text-sm font-medium">Journal Entry</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3 p-3 border rounded-md bg-green-50/50 dark:bg-green-950/20">
                  <h5 className="text-sm font-medium text-green-700 dark:text-green-400">Debit</h5>
                  <div className="space-y-2">
                    <Label className="text-xs">Account Code</Label>
                    <Input
                      placeholder="Account code"
                      value={formData.debitAccountCode}
                      onChange={e => setFormData({ ...formData, debitAccountCode: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Account Name</Label>
                    <Input
                      placeholder="Account name"
                      value={formData.debitAccountName}
                      onChange={e => setFormData({ ...formData, debitAccountName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Amount</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={formData.debitAmount}
                      onChange={e => setFormData({ ...formData, debitAmount: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-3 p-3 border rounded-md bg-red-50/50 dark:bg-red-950/20">
                  <h5 className="text-sm font-medium text-red-700 dark:text-red-400">Credit</h5>
                  <div className="space-y-2">
                    <Label className="text-xs">Account Code</Label>
                    <Input
                      placeholder="Account code"
                      value={formData.creditAccountCode}
                      onChange={e => setFormData({ ...formData, creditAccountCode: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Account Name</Label>
                    <Input
                      placeholder="Account name"
                      value={formData.creditAccountName}
                      onChange={e => setFormData({ ...formData, creditAccountName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Amount</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={formData.creditAmount}
                      onChange={e => setFormData({ ...formData, creditAmount: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Clearly Trivial</Label>
                  <p className="text-xs text-muted-foreground">
                    Mark if below the clearly trivial threshold ({s.materiality ? formatCurrency(s.materiality.trivial) : "not set"})
                  </p>
                </div>
                <Switch
                  checked={formData.isClearlyTrivial}
                  onCheckedChange={v => setFormData({ ...formData, isClearlyTrivial: v })}
                />
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {dialogMode === "create" ? "Create" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={acceptDialogOpen} onOpenChange={setAcceptDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Management Acceptance — {selectedAdj?.adjustmentRef}</DialogTitle>
            <DialogDescription>
              Record whether management accepts or disputes this adjustment
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 border rounded-md">
              <p className="text-sm">{selectedAdj?.description}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Net Impact: <strong>{formatCurrency(selectedAdj?.netImpact)}</strong>
              </p>
            </div>
            <div className="space-y-2">
              <Label>Management Response (optional)</Label>
              <Textarea
                placeholder="Management comments..."
                value={acceptResponse}
                onChange={e => setAcceptResponse(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAcceptDialogOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => selectedAdj && acceptMutation.mutate({ id: selectedAdj.id, accepted: false, response: acceptResponse })}
              disabled={acceptMutation.isPending}
            >
              <ThumbsDown className="h-4 w-4 mr-1" />
              Dispute
            </Button>
            <Button
              onClick={() => selectedAdj && acceptMutation.mutate({ id: selectedAdj.id, accepted: true, response: acceptResponse })}
              disabled={acceptMutation.isPending}
            >
              {acceptMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <ThumbsUp className="h-4 w-4 mr-1" />
              Accept
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
