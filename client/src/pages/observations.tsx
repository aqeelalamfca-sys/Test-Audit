import { useState, useMemo } from "react";
import { useParams } from "wouter";
import { useEngagement } from "@/lib/workspace-context";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, Eye, Pencil, MessageSquare, CheckCircle2, XCircle, 
  AlertTriangle, FileWarning, AlertCircle, ChevronDown, ChevronUp,
  Filter, FileText, DollarSign, Users, Clock, Search,
  Trash2, RefreshCw, BarChart3, Loader2, Shield, ArrowLeft
} from "lucide-react";
import { Link } from "wouter";

const OBSERVATION_TYPES = [
  { value: "MISSTATEMENT", label: "Misstatement" },
  { value: "CONTROL_DEFICIENCY", label: "Control Deficiency" },
  { value: "MATERIAL_WEAKNESS", label: "Material Weakness" },
  { value: "SIGNIFICANT_DEFICIENCY", label: "Significant Deficiency" },
  { value: "AUDIT_FINDING", label: "Audit Finding" },
  { value: "PJE_RECLASS", label: "PJE/Reclass" },
  { value: "MANAGEMENT_POINT", label: "Management Point" },
  { value: "COMPLIANCE_ISSUE", label: "Compliance Issue" },
  { value: "OTHER", label: "Other" },
] as const;

const OBSERVATION_STATUSES = [
  { value: "OPEN", label: "Open", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  { value: "UNDER_REVIEW", label: "Under Review", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  { value: "MGMT_RESPONDED", label: "Mgmt Responded", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  { value: "PENDING_CLEARANCE", label: "Pending Clearance", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200" },
  { value: "CLEARED", label: "Cleared", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  { value: "ADJUSTED", label: "Adjusted", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200" },
  { value: "CARRIED_FORWARD", label: "Carried Forward", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  { value: "WAIVED", label: "Waived", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200" },
  { value: "CLOSED", label: "Closed", color: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200" },
] as const;

const OBSERVATION_SEVERITIES = [
  { value: "LOW", label: "Low", color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  { value: "MEDIUM", label: "Medium", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" },
  { value: "HIGH", label: "High", color: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" },
  { value: "CRITICAL", label: "Critical", color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
] as const;

const ASSERTIONS = [
  "Existence/Occurrence",
  "Completeness", 
  "Valuation/Accuracy",
  "Rights & Obligations",
  "Presentation & Disclosure",
  "Cut-off",
  "Classification",
];

interface Observation {
  id: string;
  observationRef: string;
  title?: string;
  type: string;
  status: string;
  severity: string;
  fsHeadWorkingPaperId?: string;
  fsHeadKey?: string;
  fsHeadName?: string;
  assertions: string[];
  isaReference?: string;
  condition: string;
  criteria?: string;
  cause?: string;
  effect?: string;
  effectAmount?: string | number;
  effectQualitative?: string;
  riskImplication?: string;
  recommendation?: string;
  proposedAction?: string;
  proposedAdjustmentType?: string;
  proposedDebitAccount?: string;
  proposedDebitAmount?: string | number;
  proposedCreditAccount?: string;
  proposedCreditAmount?: string | number;
  managementResponse?: string;
  managementAccepted?: boolean;
  auditorConclusion?: string;
  waiverReason?: string;
  includeInMgmtLetter: boolean;
  includeInMisstatementSummary: boolean;
  identifiedAt: string;
  identifiedBy?: { id: string; fullName: string; role: string };
  reviewedBy?: { id: string; fullName: string; role: string };
  clearedBy?: { id: string; fullName: string; role: string };
  waivedBy?: { id: string; fullName: string; role: string };
  partnerApprovedBy?: { id: string; fullName: string; role: string };
  linkedProcedureId?: string;
  linkedProcedureRef?: string;
  linkedEvidenceIds?: string[];
}

interface ObservationSummary {
  total: number;
  openCount: number;
  clearedCount: number;
  waivedCount: number;
  totalEffectAmount: number;
  mgmtLetterCount: number;
  misstatementSummaryCount: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  bySeverity: Record<string, number>;
  byFsHead: Record<string, number>;
}

interface FSHead {
  fsHeadKey: string;
  name: string;
}

const defaultFormData = {
  title: "",
  type: "MISSTATEMENT" as string,
  severity: "MEDIUM" as string,
  fsHeadWorkingPaperId: "",
  fsHeadKey: "",
  fsHeadName: "",
  assertions: [] as string[],
  isaReference: "",
  condition: "",
  criteria: "",
  cause: "",
  effect: "",
  effectAmount: "",
  effectQualitative: "",
  riskImplication: "",
  recommendation: "",
  proposedAction: "",
  proposedAdjustmentType: "",
  proposedDebitAccount: "",
  proposedDebitAmount: "",
  proposedCreditAccount: "",
  proposedCreditAmount: "",
  includeInMgmtLetter: false,
  includeInMisstatementSummary: true,
};

export default function Observations() {
  const params = useParams<{ engagementId: string }>();
  const { engagementId: contextEngagementId, engagement, client } = useEngagement();
  const engagementId = params.engagementId || contextEngagementId || undefined;
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [filterFsHead, setFilterFsHead] = useState<string>("all");
  const [filterMgmtLetter, setFilterMgmtLetter] = useState(false);
  const [filterMisstatement, setFilterMisstatement] = useState(false);
  const [sortField, setSortField] = useState<string>("identifiedAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | "view">("create");
  const [selectedObservation, setSelectedObservation] = useState<Observation | null>(null);
  const [formData, setFormData] = useState(defaultFormData);
  const [activeTab, setActiveTab] = useState("basic");

  const [responseDialogOpen, setResponseDialogOpen] = useState(false);
  const [responseText, setResponseText] = useState("");
  const [conclusionDialogOpen, setConclusionDialogOpen] = useState(false);
  const [conclusionText, setConclusionText] = useState("");
  const [waiverDialogOpen, setWaiverDialogOpen] = useState(false);
  const [waiverText, setWaiverText] = useState("");

  const { data: observationsData, isLoading: loadingObservations } = useQuery<Observation[]>({
    queryKey: ["/api/observations", engagementId],
    enabled: !!engagementId,
  });

  const { data: summaryData, isLoading: loadingSummary } = useQuery<ObservationSummary>({
    queryKey: ["/api/observations", engagementId, "summary"],
    enabled: !!engagementId,
  });

  const { data: fsHeadsData } = useQuery<{ success: boolean; fsHeads: FSHead[] }>({
    queryKey: ["/api/engagements", engagementId, "fs-heads"],
    enabled: !!engagementId,
  });

  const fsHeads = fsHeadsData?.fsHeads || [];

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", `/api/observations/${engagementId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/observations", engagementId] });
      queryClient.invalidateQueries({ queryKey: ["/api/observations", engagementId, "summary"] });
      setDialogOpen(false);
      resetForm();
      toast({ title: "Observation created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create observation", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      return apiRequest("PATCH", `/api/observations/${engagementId}/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/observations", engagementId] });
      queryClient.invalidateQueries({ queryKey: ["/api/observations", engagementId, "summary"] });
      setDialogOpen(false);
      resetForm();
      toast({ title: "Observation updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update observation", description: error.message, variant: "destructive" });
    },
  });

  const addResponseMutation = useMutation({
    mutationFn: async ({ id, managementResponse }: { id: string; managementResponse: string }) => {
      return apiRequest("POST", `/api/observations/${engagementId}/${id}/management-response`, { managementResponse });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/observations", engagementId] });
      queryClient.invalidateQueries({ queryKey: ["/api/observations", engagementId, "summary"] });
      setResponseDialogOpen(false);
      setResponseText("");
      setSelectedObservation(null);
      toast({ title: "Management response added" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to add response", description: error.message, variant: "destructive" });
    },
  });

  const addConclusionMutation = useMutation({
    mutationFn: async ({ id, auditorConclusion }: { id: string; auditorConclusion: string }) => {
      return apiRequest("POST", `/api/observations/${engagementId}/${id}/auditor-conclusion`, { auditorConclusion });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/observations", engagementId] });
      queryClient.invalidateQueries({ queryKey: ["/api/observations", engagementId, "summary"] });
      setConclusionDialogOpen(false);
      setConclusionText("");
      setSelectedObservation(null);
      toast({ title: "Auditor conclusion added" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to add conclusion", description: error.message, variant: "destructive" });
    },
  });

  const clearMutation = useMutation({
    mutationFn: async ({ id, adjustmentMade }: { id: string; adjustmentMade: boolean }) => {
      return apiRequest("POST", `/api/observations/${engagementId}/${id}/clear`, { adjustmentMade });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/observations", engagementId] });
      queryClient.invalidateQueries({ queryKey: ["/api/observations", engagementId, "summary"] });
      toast({ title: "Observation cleared" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to clear observation", description: error.message, variant: "destructive" });
    },
  });

  const waiveMutation = useMutation({
    mutationFn: async ({ id, waiverReason }: { id: string; waiverReason: string }) => {
      return apiRequest("POST", `/api/observations/${engagementId}/${id}/waive`, { waiverReason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/observations", engagementId] });
      queryClient.invalidateQueries({ queryKey: ["/api/observations", engagementId, "summary"] });
      setWaiverDialogOpen(false);
      setWaiverText("");
      setSelectedObservation(null);
      toast({ title: "Observation waived" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to waive observation", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/observations/${engagementId}/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/observations", engagementId] });
      queryClient.invalidateQueries({ queryKey: ["/api/observations", engagementId, "summary"] });
      toast({ title: "Observation deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete observation", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData(defaultFormData);
    setSelectedObservation(null);
    setActiveTab("basic");
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogMode("create");
    setDialogOpen(true);
  };

  const openEditDialog = (obs: Observation) => {
    setSelectedObservation(obs);
    setFormData({
      title: obs.title || "",
      type: obs.type,
      severity: obs.severity,
      fsHeadWorkingPaperId: obs.fsHeadWorkingPaperId || "",
      fsHeadKey: obs.fsHeadKey || "",
      fsHeadName: obs.fsHeadName || "",
      assertions: obs.assertions || [],
      isaReference: obs.isaReference || "",
      condition: obs.condition,
      criteria: obs.criteria || "",
      cause: obs.cause || "",
      effect: obs.effect || "",
      effectAmount: obs.effectAmount?.toString() || "",
      effectQualitative: obs.effectQualitative || "",
      riskImplication: obs.riskImplication || "",
      recommendation: obs.recommendation || "",
      proposedAction: obs.proposedAction || "",
      proposedAdjustmentType: obs.proposedAdjustmentType || "",
      proposedDebitAccount: obs.proposedDebitAccount || "",
      proposedDebitAmount: obs.proposedDebitAmount?.toString() || "",
      proposedCreditAccount: obs.proposedCreditAccount || "",
      proposedCreditAmount: obs.proposedCreditAmount?.toString() || "",
      includeInMgmtLetter: obs.includeInMgmtLetter,
      includeInMisstatementSummary: obs.includeInMisstatementSummary,
    });
    setDialogMode("edit");
    setDialogOpen(true);
  };

  const openViewDialog = (obs: Observation) => {
    setSelectedObservation(obs);
    setDialogMode("view");
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.condition.trim()) {
      toast({ title: "Condition is required", variant: "destructive" });
      return;
    }

    if (dialogMode === "create") {
      createMutation.mutate(formData);
    } else if (dialogMode === "edit" && selectedObservation) {
      updateMutation.mutate({ id: selectedObservation.id, data: formData });
    }
  };

  const filteredObservations = useMemo(() => {
    let result = observationsData || [];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (obs) =>
          obs.observationRef?.toLowerCase().includes(query) ||
          obs.condition.toLowerCase().includes(query) ||
          obs.fsHeadName?.toLowerCase().includes(query)
      );
    }

    if (filterType !== "all") {
      result = result.filter((obs) => obs.type === filterType);
    }

    if (filterStatus !== "all") {
      result = result.filter((obs) => obs.status === filterStatus);
    }

    if (filterSeverity !== "all") {
      result = result.filter((obs) => obs.severity === filterSeverity);
    }

    if (filterFsHead !== "all") {
      result = result.filter((obs) => obs.fsHeadKey === filterFsHead);
    }

    if (filterMgmtLetter) {
      result = result.filter((obs) => obs.includeInMgmtLetter);
    }

    if (filterMisstatement) {
      result = result.filter((obs) => obs.includeInMisstatementSummary);
    }

    result = [...result].sort((a, b) => {
      let aVal: any = a[sortField as keyof Observation];
      let bVal: any = b[sortField as keyof Observation];

      if (sortField === "identifiedAt") {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }

      if (sortDirection === "asc") {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });

    return result;
  }, [observationsData, searchQuery, filterType, filterStatus, filterSeverity, filterFsHead, filterMgmtLetter, filterMisstatement, sortField, sortDirection]);

  const paginatedObservations = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredObservations.slice(start, start + itemsPerPage);
  }, [filteredObservations, currentPage]);

  const totalPages = Math.ceil(filteredObservations.length / itemsPerPage);

  const getStatusBadge = (status: string) => {
    const statusConfig = OBSERVATION_STATUSES.find((s) => s.value === status);
    return (
      <Badge variant="secondary" className={statusConfig?.color || ""} data-testid={`badge-status-${status}`}>
        {statusConfig?.label || status}
      </Badge>
    );
  };

  const getSeverityBadge = (severity: string) => {
    const severityConfig = OBSERVATION_SEVERITIES.find((s) => s.value === severity);
    return (
      <Badge variant="secondary" className={severityConfig?.color || ""} data-testid={`badge-severity-${severity}`}>
        {severityConfig?.label || severity}
      </Badge>
    );
  };

  const getTypeBadge = (type: string) => {
    const typeConfig = OBSERVATION_TYPES.find((t) => t.value === type);
    return (
      <Badge variant="outline" data-testid={`badge-type-${type}`}>
        {typeConfig?.label || type}
      </Badge>
    );
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  };

  const formatCurrency = (value: string | number | undefined | null) => {
    if (value === undefined || value === null || value === "") return "-";
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(num)) return "-";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(num);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };

  const truncateText = (text: string, maxLength: number = 50) => {
    if (!text) return "-";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  if (!engagementId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">No engagement selected</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href={`/workspace/${engagementId}`}>
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold" data-testid="text-title">Observation Board</h1>
              <p className="text-sm text-muted-foreground" data-testid="text-client">
                {client?.name || engagement?.client?.name || ""}
              </p>
            </div>
          </div>
          <Button onClick={openCreateDialog} data-testid="button-create-observation">
            <Plus className="h-4 w-4 mr-2" />
            New Observation
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline" className="text-xs" data-testid="badge-isa-reference">
            <Shield className="h-3 w-3 mr-1" />
            ISA 265/450 - Observations &amp; Findings
          </Badge>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card data-testid="card-stat-total">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{summaryData?.total || 0}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-stat-open">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold">{summaryData?.openCount || 0}</p>
                  <p className="text-xs text-muted-foreground">Open</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-stat-cleared">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{summaryData?.clearedCount || 0}</p>
                  <p className="text-xs text-muted-foreground">Cleared</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-stat-waived">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-gray-500" />
                <div>
                  <p className="text-2xl font-bold">{summaryData?.waivedCount || 0}</p>
                  <p className="text-xs text-muted-foreground">Waived</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-stat-effect">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-lg font-bold">{formatCurrency(summaryData?.totalEffectAmount || 0)}</p>
                  <p className="text-xs text-muted-foreground">Total Effect</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-stat-mgmt-letter">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <FileWarning className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold">{summaryData?.mgmtLetterCount || 0}</p>
                  <p className="text-xs text-muted-foreground">Mgmt Letter</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <div className="col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search observations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-search"
                  />
                </div>
              </div>

              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger data-testid="select-filter-type">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {OBSERVATION_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger data-testid="select-filter-status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {OBSERVATION_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                <SelectTrigger data-testid="select-filter-severity">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  {OBSERVATION_SEVERITIES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterFsHead} onValueChange={setFilterFsHead}>
                <SelectTrigger data-testid="select-filter-fshead">
                  <SelectValue placeholder="FS Head" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All FS Heads</SelectItem>
                  {fsHeads.map((fs) => (
                    <SelectItem key={fs.fsHeadKey} value={fs.fsHeadKey}>
                      {fs.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  id="filter-mgmt-letter"
                  checked={filterMgmtLetter}
                  onCheckedChange={setFilterMgmtLetter}
                  data-testid="switch-filter-mgmt-letter"
                />
                <Label htmlFor="filter-mgmt-letter" className="text-sm">
                  Mgmt Letter Only
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="filter-misstatement"
                  checked={filterMisstatement}
                  onCheckedChange={setFilterMisstatement}
                  data-testid="switch-filter-misstatement"
                />
                <Label htmlFor="filter-misstatement" className="text-sm">
                  Misstatement Summary Only
                </Label>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setFilterType("all");
                  setFilterStatus("all");
                  setFilterSeverity("all");
                  setFilterFsHead("all");
                  setFilterMgmtLetter(false);
                  setFilterMisstatement(false);
                }}
                data-testid="button-clear-filters"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Observations ({filteredObservations.length})
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {loadingObservations ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredObservations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-1">No observations found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {observationsData?.length === 0
                    ? "Create your first observation to track audit findings."
                    : "No observations match the current filters."}
                </p>
                {observationsData?.length === 0 && (
                  <Button onClick={openCreateDialog} data-testid="button-create-first-observation">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Observation
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort("observationRef")}
                          data-testid="th-ref"
                        >
                          <div className="flex items-center gap-1">
                            Ref <SortIcon field="observationRef" />
                          </div>
                        </TableHead>
                        <TableHead data-testid="th-type">Type</TableHead>
                        <TableHead data-testid="th-fshead">FS Head</TableHead>
                        <TableHead data-testid="th-condition">Condition</TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-muted/50 text-right"
                          onClick={() => handleSort("effectAmount")}
                          data-testid="th-effect"
                        >
                          <div className="flex items-center justify-end gap-1">
                            Effect Amount <SortIcon field="effectAmount" />
                          </div>
                        </TableHead>
                        <TableHead data-testid="th-severity">Severity</TableHead>
                        <TableHead data-testid="th-status">Status</TableHead>
                        <TableHead data-testid="th-identified-by">Identified By</TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort("identifiedAt")}
                          data-testid="th-date"
                        >
                          <div className="flex items-center gap-1">
                            Date <SortIcon field="identifiedAt" />
                          </div>
                        </TableHead>
                        <TableHead className="text-right" data-testid="th-actions">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedObservations.map((obs) => (
                        <TableRow
                          key={obs.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => openViewDialog(obs)}
                          data-testid={`row-observation-${obs.id}`}
                        >
                          <TableCell className="font-medium" data-testid={`cell-ref-${obs.id}`}>
                            {obs.observationRef || "-"}
                          </TableCell>
                          <TableCell data-testid={`cell-type-${obs.id}`}>{getTypeBadge(obs.type)}</TableCell>
                          <TableCell data-testid={`cell-fshead-${obs.id}`}>{obs.fsHeadName || "-"}</TableCell>
                          <TableCell className="max-w-[200px]" data-testid={`cell-condition-${obs.id}`}>
                            {obs.title ? (
                              <div>
                                <p className="text-sm font-medium">{truncateText(obs.title, 40)}</p>
                                <p className="text-xs text-muted-foreground">{truncateText(obs.condition, 40)}</p>
                              </div>
                            ) : truncateText(obs.condition)}
                          </TableCell>
                          <TableCell className="text-right" data-testid={`cell-effect-${obs.id}`}>
                            {formatCurrency(obs.effectAmount)}
                          </TableCell>
                          <TableCell data-testid={`cell-severity-${obs.id}`}>{getSeverityBadge(obs.severity)}</TableCell>
                          <TableCell data-testid={`cell-status-${obs.id}`}>{getStatusBadge(obs.status)}</TableCell>
                          <TableCell data-testid={`cell-identified-${obs.id}`}>
                            {obs.identifiedBy?.fullName || "-"}
                          </TableCell>
                          <TableCell data-testid={`cell-date-${obs.id}`}>{formatDate(obs.identifiedAt)}</TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openViewDialog(obs)}
                                data-testid={`button-view-${obs.id}`}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(obs)}
                                disabled={obs.status === "CLEARED" || obs.status === "ADJUSTED" || obs.status === "WAIVED"}
                                data-testid={`button-edit-${obs.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedObservation(obs);
                                  setResponseDialogOpen(true);
                                }}
                                disabled={obs.status !== "OPEN" && obs.status !== "UNDER_REVIEW"}
                                data-testid={`button-response-${obs.id}`}
                              >
                                <MessageSquare className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => clearMutation.mutate({ id: obs.id, adjustmentMade: false })}
                                disabled={obs.status === "CLEARED" || obs.status === "ADJUSTED" || obs.status === "WAIVED"}
                                data-testid={`button-clear-${obs.id}`}
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                      {Math.min(currentPage * itemsPerPage, filteredObservations.length)} of{" "}
                      {filteredObservations.length} results
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        data-testid="button-prev-page"
                      >
                        Previous
                      </Button>
                      <span className="text-sm">
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        data-testid="button-next-page"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "create" && "Create New Observation"}
              {dialogMode === "edit" && `Edit Observation: ${selectedObservation?.observationRef}`}
              {dialogMode === "view" && `Observation: ${selectedObservation?.observationRef}`}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === "create" && "Document a new audit observation, finding, or misstatement."}
              {dialogMode === "edit" && "Update observation details."}
              {dialogMode === "view" && "View observation details and workflow."}
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic" data-testid="tab-basic">Basic Info</TabsTrigger>
              <TabsTrigger value="linkage" data-testid="tab-linkage">FS Linkage</TabsTrigger>
              <TabsTrigger value="action" data-testid="tab-action">Proposed Action</TabsTrigger>
              <TabsTrigger value="workflow" data-testid="tab-workflow">Workflow</TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 mt-4">
              <TabsContent value="basic" className="mt-0 space-y-4">
                <div className="space-y-2">
                  <Label>Observation Title</Label>
                  <Input
                    placeholder="Brief descriptive title for this observation"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    disabled={dialogMode === "view"}
                    data-testid="input-title"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(v) => setFormData({ ...formData, type: v })}
                      disabled={dialogMode === "view"}
                    >
                      <SelectTrigger data-testid="select-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OBSERVATION_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Severity</Label>
                    <Select
                      value={formData.severity}
                      onValueChange={(v) => setFormData({ ...formData, severity: v })}
                      disabled={dialogMode === "view"}
                    >
                      <SelectTrigger data-testid="select-severity">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OBSERVATION_SEVERITIES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>
                    Condition <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    placeholder="What was found? Describe the condition/observation..."
                    value={formData.condition}
                    onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                    rows={3}
                    disabled={dialogMode === "view"}
                    data-testid="textarea-condition"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Criteria</Label>
                  <Textarea
                    placeholder="What should be? (per IFRS, ISA, company policy, etc.)"
                    value={formData.criteria}
                    onChange={(e) => setFormData({ ...formData, criteria: e.target.value })}
                    rows={2}
                    disabled={dialogMode === "view"}
                    data-testid="textarea-criteria"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Cause</Label>
                  <Textarea
                    placeholder="Why did this occur?"
                    value={formData.cause}
                    onChange={(e) => setFormData({ ...formData, cause: e.target.value })}
                    rows={2}
                    disabled={dialogMode === "view"}
                    data-testid="textarea-cause"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Effect</Label>
                  <Textarea
                    placeholder="What is the impact/consequence?"
                    value={formData.effect}
                    onChange={(e) => setFormData({ ...formData, effect: e.target.value })}
                    rows={2}
                    disabled={dialogMode === "view"}
                    data-testid="textarea-effect"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Effect Amount</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={formData.effectAmount}
                      onChange={(e) => setFormData({ ...formData, effectAmount: e.target.value })}
                      disabled={dialogMode === "view"}
                      data-testid="input-effect-amount"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>ISA Reference</Label>
                    <Input
                      placeholder="e.g., ISA 450"
                      value={formData.isaReference}
                      onChange={(e) => setFormData({ ...formData, isaReference: e.target.value })}
                      disabled={dialogMode === "view"}
                      data-testid="input-isa-reference"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Risk Implication</Label>
                  <Textarea
                    placeholder="What is the risk if this issue is not addressed?"
                    value={formData.riskImplication}
                    onChange={(e) => setFormData({ ...formData, riskImplication: e.target.value })}
                    rows={2}
                    disabled={dialogMode === "view"}
                    data-testid="textarea-risk-implication"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Recommendation</Label>
                  <Textarea
                    placeholder="What corrective action do you recommend?"
                    value={formData.recommendation}
                    onChange={(e) => setFormData({ ...formData, recommendation: e.target.value })}
                    rows={2}
                    disabled={dialogMode === "view"}
                    data-testid="textarea-recommendation"
                  />
                </div>
              </TabsContent>

              <TabsContent value="linkage" className="mt-0 space-y-4">
                <div className="space-y-2">
                  <Label>FS Head</Label>
                  <Select
                    value={formData.fsHeadKey || "__none__"}
                    onValueChange={(v) => {
                      const actualValue = v === "__none__" ? "" : v;
                      const fsHead = fsHeads.find((f) => f.fsHeadKey === actualValue);
                      setFormData({
                        ...formData,
                        fsHeadKey: actualValue,
                        fsHeadName: fsHead?.name || "",
                      });
                    }}
                    disabled={dialogMode === "view"}
                  >
                    <SelectTrigger data-testid="select-fshead">
                      <SelectValue placeholder="Select FS Head" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {fsHeads.map((fs) => (
                        <SelectItem key={fs.fsHeadKey} value={fs.fsHeadKey}>
                          {fs.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Assertions Affected</Label>
                  <div className="grid grid-cols-2 gap-2 p-3 border rounded-md">
                    {ASSERTIONS.map((assertion) => (
                      <div key={assertion} className="flex items-center gap-2">
                        <Checkbox
                          id={`assertion-${assertion}`}
                          checked={formData.assertions.includes(assertion)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setFormData({ ...formData, assertions: [...formData.assertions, assertion] });
                            } else {
                              setFormData({
                                ...formData,
                                assertions: formData.assertions.filter((a) => a !== assertion),
                              });
                            }
                          }}
                          disabled={dialogMode === "view"}
                          data-testid={`checkbox-assertion-${assertion}`}
                        />
                        <Label htmlFor={`assertion-${assertion}`} className="text-sm font-normal">
                          {assertion}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Include in Management Letter</Label>
                    <p className="text-xs text-muted-foreground">
                      Include this observation in the management letter report
                    </p>
                  </div>
                  <Switch
                    checked={formData.includeInMgmtLetter}
                    onCheckedChange={(v) => setFormData({ ...formData, includeInMgmtLetter: v })}
                    disabled={dialogMode === "view"}
                    data-testid="switch-mgmt-letter"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Include in Misstatement Summary</Label>
                    <p className="text-xs text-muted-foreground">
                      Include in the schedule of uncorrected/corrected misstatements
                    </p>
                  </div>
                  <Switch
                    checked={formData.includeInMisstatementSummary}
                    onCheckedChange={(v) => setFormData({ ...formData, includeInMisstatementSummary: v })}
                    disabled={dialogMode === "view"}
                    data-testid="switch-misstatement-summary"
                  />
                </div>
              </TabsContent>

              <TabsContent value="action" className="mt-0 space-y-4">
                <div className="space-y-2">
                  <Label>Proposed Action/Recommendation</Label>
                  <Textarea
                    placeholder="What action should be taken?"
                    value={formData.proposedAction}
                    onChange={(e) => setFormData({ ...formData, proposedAction: e.target.value })}
                    rows={3}
                    disabled={dialogMode === "view"}
                    data-testid="textarea-proposed-action"
                  />
                </div>

                <Separator />

                <h4 className="text-sm font-medium">Proposed Journal Entry</h4>

                <div className="space-y-2">
                  <Label>Adjustment Type</Label>
                  <Select
                    value={formData.proposedAdjustmentType || "__none__"}
                    onValueChange={(v) => setFormData({ ...formData, proposedAdjustmentType: v === "__none__" ? "" : v })}
                    disabled={dialogMode === "view"}
                  >
                    <SelectTrigger data-testid="select-adjustment-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      <SelectItem value="AUDIT_ADJUSTMENT">Audit Adjustment (AJE)</SelectItem>
                      <SelectItem value="PROPOSED_ADJUSTMENT">Proposed Adjustment (PJE)</SelectItem>
                      <SelectItem value="RECLASSIFICATION">Reclassification</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-4 p-3 border rounded-md bg-green-50/50 dark:bg-green-950/20">
                    <h5 className="text-sm font-medium text-green-700 dark:text-green-400">Debit</h5>
                    <div className="space-y-2">
                      <Label className="text-xs">Account</Label>
                      <Input
                        placeholder="Account code/name"
                        value={formData.proposedDebitAccount}
                        onChange={(e) => setFormData({ ...formData, proposedDebitAccount: e.target.value })}
                        disabled={dialogMode === "view"}
                        data-testid="input-debit-account"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Amount</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={formData.proposedDebitAmount}
                        onChange={(e) => setFormData({ ...formData, proposedDebitAmount: e.target.value })}
                        disabled={dialogMode === "view"}
                        data-testid="input-debit-amount"
                      />
                    </div>
                  </div>

                  <div className="space-y-4 p-3 border rounded-md bg-red-50/50 dark:bg-red-950/20">
                    <h5 className="text-sm font-medium text-red-700 dark:text-red-400">Credit</h5>
                    <div className="space-y-2">
                      <Label className="text-xs">Account</Label>
                      <Input
                        placeholder="Account code/name"
                        value={formData.proposedCreditAccount}
                        onChange={(e) => setFormData({ ...formData, proposedCreditAccount: e.target.value })}
                        disabled={dialogMode === "view"}
                        data-testid="input-credit-account"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Amount</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={formData.proposedCreditAmount}
                        onChange={(e) => setFormData({ ...formData, proposedCreditAmount: e.target.value })}
                        disabled={dialogMode === "view"}
                        data-testid="input-credit-amount"
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="workflow" className="mt-0 space-y-4">
                {dialogMode === "view" && selectedObservation && (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Current Status:</span>
                      {getStatusBadge(selectedObservation.status)}
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <div className="p-3 border rounded-md space-y-2">
                        <h4 className="text-sm font-medium flex items-center gap-2">
                          <Users className="h-4 w-4" /> Identified By
                        </h4>
                        <p className="text-sm">
                          {selectedObservation.identifiedBy?.fullName || "Unknown"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(selectedObservation.identifiedAt)}
                        </p>
                      </div>

                      {selectedObservation.managementResponse && (
                        <div className="p-3 border rounded-md space-y-2 bg-purple-50/50 dark:bg-purple-950/20">
                          <h4 className="text-sm font-medium flex items-center gap-2">
                            <MessageSquare className="h-4 w-4" /> Management Response
                          </h4>
                          <p className="text-sm">{selectedObservation.managementResponse}</p>
                          {selectedObservation.managementAccepted !== undefined && (
                            <Badge variant={selectedObservation.managementAccepted ? "default" : "destructive"}>
                              {selectedObservation.managementAccepted ? "Accepted" : "Not Accepted"}
                            </Badge>
                          )}
                        </div>
                      )}

                      {selectedObservation.auditorConclusion && (
                        <div className="p-3 border rounded-md space-y-2 bg-blue-50/50 dark:bg-blue-950/20">
                          <h4 className="text-sm font-medium flex items-center gap-2">
                            <Shield className="h-4 w-4" /> Auditor Conclusion
                          </h4>
                          <p className="text-sm">{selectedObservation.auditorConclusion}</p>
                        </div>
                      )}

                      {selectedObservation.status === "WAIVED" && selectedObservation.waiverReason && (
                        <div className="p-3 border rounded-md space-y-2 bg-gray-50 dark:bg-gray-950/20">
                          <h4 className="text-sm font-medium flex items-center gap-2">
                            <XCircle className="h-4 w-4" /> Waiver Reason
                          </h4>
                          <p className="text-sm">{selectedObservation.waiverReason}</p>
                          {selectedObservation.waivedBy && (
                            <p className="text-xs text-muted-foreground">
                              Waived by: {selectedObservation.waivedBy.fullName}
                            </p>
                          )}
                        </div>
                      )}

                      {(selectedObservation.status === "CLEARED" || selectedObservation.status === "ADJUSTED") &&
                        selectedObservation.clearedBy && (
                          <div className="p-3 border rounded-md space-y-2 bg-green-50/50 dark:bg-green-950/20">
                            <h4 className="text-sm font-medium flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4" />{" "}
                              {selectedObservation.status === "ADJUSTED" ? "Adjusted" : "Cleared"} By
                            </h4>
                            <p className="text-sm">{selectedObservation.clearedBy.fullName}</p>
                          </div>
                        )}
                    </div>

                    {selectedObservation.status !== "CLEARED" &&
                      selectedObservation.status !== "ADJUSTED" &&
                      selectedObservation.status !== "WAIVED" && (
                        <>
                          <Separator />
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setResponseDialogOpen(true);
                              }}
                              data-testid="button-add-response"
                            >
                              <MessageSquare className="h-4 w-4 mr-1" />
                              Add Response
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setConclusionDialogOpen(true);
                              }}
                              data-testid="button-add-conclusion"
                            >
                              <Shield className="h-4 w-4 mr-1" />
                              Add Conclusion
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => clearMutation.mutate({ id: selectedObservation.id, adjustmentMade: false })}
                              data-testid="button-clear-observation"
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Clear
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => clearMutation.mutate({ id: selectedObservation.id, adjustmentMade: true })}
                              data-testid="button-mark-adjusted"
                            >
                              <BarChart3 className="h-4 w-4 mr-1" />
                              Mark Adjusted
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setWaiverDialogOpen(true)}
                              data-testid="button-waive-observation"
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Waive
                            </Button>
                          </div>
                        </>
                      )}
                  </>
                )}

                {dialogMode !== "view" && (
                  <div className="text-center py-4 text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Workflow actions will be available after saving</p>
                  </div>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>

          <DialogFooter className="mt-4">
            {dialogMode === "view" ? (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-close">
                  Close
                </Button>
                {selectedObservation &&
                  selectedObservation.status !== "CLEARED" &&
                  selectedObservation.status !== "ADJUSTED" &&
                  selectedObservation.status !== "WAIVED" && (
                    <Button onClick={() => openEditDialog(selectedObservation)} data-testid="button-edit-from-view">
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  )}
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false);
                    resetForm();
                  }}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-save"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {dialogMode === "create" ? "Create" : "Save Changes"}
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={responseDialogOpen} onOpenChange={setResponseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Management Response</DialogTitle>
            <DialogDescription>
              Record management's response to observation {selectedObservation?.observationRef}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Enter management's response..."
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              rows={4}
              data-testid="textarea-management-response"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResponseDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedObservation && responseText.trim()) {
                  addResponseMutation.mutate({ id: selectedObservation.id, managementResponse: responseText });
                }
              }}
              disabled={!responseText.trim() || addResponseMutation.isPending}
              data-testid="button-submit-response"
            >
              {addResponseMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit Response
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={conclusionDialogOpen} onOpenChange={setConclusionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Auditor Conclusion</DialogTitle>
            <DialogDescription>
              Document your conclusion for observation {selectedObservation?.observationRef}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Enter your audit conclusion..."
              value={conclusionText}
              onChange={(e) => setConclusionText(e.target.value)}
              rows={4}
              data-testid="textarea-auditor-conclusion"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConclusionDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedObservation && conclusionText.trim()) {
                  addConclusionMutation.mutate({ id: selectedObservation.id, auditorConclusion: conclusionText });
                }
              }}
              disabled={!conclusionText.trim() || addConclusionMutation.isPending}
              data-testid="button-submit-conclusion"
            >
              {addConclusionMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit Conclusion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={waiverDialogOpen} onOpenChange={setWaiverDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Waive Observation</DialogTitle>
            <DialogDescription>
              Document the reason for waiving observation {selectedObservation?.observationRef}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Enter waiver reason (requires partner approval)..."
              value={waiverText}
              onChange={(e) => setWaiverText(e.target.value)}
              rows={4}
              data-testid="textarea-waiver-reason"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWaiverDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedObservation && waiverText.trim()) {
                  waiveMutation.mutate({ id: selectedObservation.id, waiverReason: waiverText });
                }
              }}
              disabled={!waiverText.trim() || waiveMutation.isPending}
              data-testid="button-submit-waiver"
            >
              {waiveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Waive Observation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
