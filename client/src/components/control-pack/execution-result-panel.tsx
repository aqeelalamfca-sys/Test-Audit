import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FileCheck,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  FileText,
  Edit,
  MoreHorizontal,
  Eye,
  UserCheck,
  AlertTriangle,
  ClipboardCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ExecutionResultStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "EXCEPTION_FOUND" | "REVIEWED" | "APPROVED";
type ExecutionResultType = "TEST_OF_DETAILS" | "TEST_OF_CONTROLS" | "JOURNAL_ENTRY_TESTING" | "ANALYTICAL_FOLLOWUP" | "CONFIRMATION" | "SUBSTANTIVE_PROCEDURE" | "INQUIRY" | "OBSERVATION";

interface ExecutionResult {
  id: string;
  engagementId: string;
  procedureId: string | null;
  samplingFrameId: string | null;
  samplingItemId: string | null;
  fsHeadKey: string | null;
  glCode: string | null;
  resultType: ExecutionResultType;
  resultReference: string | null;
  stepChecklist: Record<string, unknown> | null;
  bookValue: string | number | null;
  auditedValue: string | number | null;
  difference: string | number | null;
  exceptionAmount: string | number | null;
  exceptionDescription: string | null;
  testConclusion: string | null;
  reviewerNotes: string | null;
  attachments: Record<string, unknown> | null;
  status: ExecutionResultStatus;
  isaReference: string;
  performedById: string | null;
  performedAt: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  approvedById: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  procedure?: { id: string; procedureName: string } | null;
  samplingFrame?: { id: string; frameName: string } | null;
  performedBy?: { id: string; fullName: string } | null;
  reviewedBy?: { id: string; fullName: string } | null;
  approvedBy?: { id: string; fullName: string } | null;
}

interface ProcedureMatrixItem {
  id: string;
  procedureName: string;
  fsHeadKey: string | null;
  status: string;
}

interface SamplingFrame {
  id: string;
  frameName: string;
  procedureId: string | null;
}

interface ExecutionResultPanelProps {
  engagementId: string;
  className?: string;
}

const RESULT_TYPE_OPTIONS: { value: ExecutionResultType; label: string }[] = [
  { value: "TEST_OF_DETAILS", label: "Test of Details" },
  { value: "TEST_OF_CONTROLS", label: "Test of Controls" },
  { value: "JOURNAL_ENTRY_TESTING", label: "Journal Entry Testing" },
  { value: "ANALYTICAL_FOLLOWUP", label: "Analytical Follow-up" },
  { value: "CONFIRMATION", label: "Confirmation" },
  { value: "SUBSTANTIVE_PROCEDURE", label: "Substantive Procedure" },
  { value: "INQUIRY", label: "Inquiry" },
  { value: "OBSERVATION", label: "Observation" },
];

const STATUS_CONFIG: Record<ExecutionResultStatus, { label: string; color: string; icon: typeof Clock }> = {
  PENDING: { label: "Pending", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200", icon: Clock },
  IN_PROGRESS: { label: "In Progress", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", icon: FileText },
  COMPLETED: { label: "Completed", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200", icon: ClipboardCheck },
  EXCEPTION_FOUND: { label: "Exception", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", icon: AlertTriangle },
  REVIEWED: { label: "Reviewed", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200", icon: Eye },
  APPROVED: { label: "Approved", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: CheckCircle2 },
};

const ROLE_HIERARCHY: Record<string, number> = {
  STAFF: 1,
  SENIOR: 2,
  TEAM_LEAD: 3,
  MANAGER: 4,
  MANAGING_PARTNER: 5,
  PARTNER: 6,
  EQCR: 7,
  ADMIN: 8,
};

function hasMinRole(userRole: string, minRole: string): boolean {
  return (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[minRole] || 0);
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function StatusBadge({ status }: { status: ExecutionResultStatus }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  return (
    <Badge className={cn("gap-1", config.color)} data-testid={`badge-status-${status.toLowerCase()}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

export function ExecutionResultPanel({ engagementId, className }: ExecutionResultPanelProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingResult, setEditingResult] = useState<ExecutionResult | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterFsHeadKey, setFilterFsHeadKey] = useState<string>("all");
  
  const [resultForm, setResultForm] = useState({
    procedureId: "",
    samplingFrameId: "",
    fsHeadKey: "",
    glCode: "",
    resultType: "SUBSTANTIVE_PROCEDURE" as ExecutionResultType,
    resultReference: "",
    bookValue: "",
    auditedValue: "",
    exceptionAmount: "",
    exceptionDescription: "",
    testConclusion: "",
    attachments: "",
  });

  const { data: executionResults, isLoading, error } = useQuery<ExecutionResult[]>({
    queryKey: ["/api/engagements", engagementId, "execution-results"],
    enabled: !!engagementId,
  });

  const { data: procedures } = useQuery<ProcedureMatrixItem[]>({
    queryKey: ["/api/engagements", engagementId, "procedures-matrix"],
    enabled: !!engagementId,
  });

  const { data: samplingFrames } = useQuery<SamplingFrame[]>({
    queryKey: ["/api/engagements", engagementId, "sampling-frames"],
    enabled: !!engagementId,
  });

  const uniqueFsHeadKeys = useMemo(() => {
    if (!executionResults) return [];
    const keys = [...new Set(executionResults.map(r => r.fsHeadKey).filter(Boolean))];
    return keys.sort() as string[];
  }, [executionResults]);

  const filteredResults = useMemo(() => {
    if (!executionResults) return [];
    return executionResults.filter(r => {
      if (filterStatus !== "all" && r.status !== filterStatus) return false;
      if (filterFsHeadKey !== "all" && r.fsHeadKey !== filterFsHeadKey) return false;
      return true;
    });
  }, [executionResults, filterStatus, filterFsHeadKey]);

  const createMutation = useMutation({
    mutationFn: async (data: typeof resultForm) => {
      const payload = {
        procedureId: data.procedureId || undefined,
        samplingFrameId: data.samplingFrameId || undefined,
        fsHeadKey: data.fsHeadKey || undefined,
        glCode: data.glCode || undefined,
        resultType: data.resultType,
        resultReference: data.resultReference || undefined,
        bookValue: data.bookValue ? parseFloat(data.bookValue) : undefined,
        auditedValue: data.auditedValue ? parseFloat(data.auditedValue) : undefined,
        exceptionAmount: data.exceptionAmount ? parseFloat(data.exceptionAmount) : undefined,
        exceptionDescription: data.exceptionDescription || undefined,
        testConclusion: data.testConclusion || undefined,
        attachments: data.attachments ? JSON.parse(data.attachments) : undefined,
      };
      const response = await apiRequest("POST", `/api/engagements/${engagementId}/execution-results`, payload);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Execution result created successfully" });
      setShowAddDialog(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", engagementId, "execution-results"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof resultForm> }) => {
      const payload: Record<string, unknown> = {};
      if (data.procedureId !== undefined) payload.procedureId = data.procedureId || undefined;
      if (data.samplingFrameId !== undefined) payload.samplingFrameId = data.samplingFrameId || undefined;
      if (data.fsHeadKey !== undefined) payload.fsHeadKey = data.fsHeadKey || undefined;
      if (data.glCode !== undefined) payload.glCode = data.glCode || undefined;
      if (data.resultType) payload.resultType = data.resultType;
      if (data.resultReference !== undefined) payload.resultReference = data.resultReference || undefined;
      if (data.bookValue !== undefined) payload.bookValue = data.bookValue ? parseFloat(data.bookValue) : undefined;
      if (data.auditedValue !== undefined) payload.auditedValue = data.auditedValue ? parseFloat(data.auditedValue) : undefined;
      if (data.exceptionAmount !== undefined) payload.exceptionAmount = data.exceptionAmount ? parseFloat(data.exceptionAmount) : undefined;
      if (data.exceptionDescription !== undefined) payload.exceptionDescription = data.exceptionDescription || undefined;
      if (data.testConclusion !== undefined) payload.testConclusion = data.testConclusion || undefined;
      
      const response = await apiRequest("PATCH", `/api/engagements/${engagementId}/execution-results/${id}`, payload);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Execution result updated successfully" });
      setShowEditDialog(false);
      setEditingResult(null);
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", engagementId, "execution-results"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, reviewerNotes }: { id: string; reviewerNotes?: string }) => {
      const response = await apiRequest("PATCH", `/api/engagements/${engagementId}/execution-results/${id}/review`, {
        reviewerNotes,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Execution result reviewed" });
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", engagementId, "execution-results"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("PATCH", `/api/engagements/${engagementId}/execution-results/${id}/approve`, {});
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Execution result approved" });
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", engagementId, "execution-results"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setResultForm({
      procedureId: "",
      samplingFrameId: "",
      fsHeadKey: "",
      glCode: "",
      resultType: "SUBSTANTIVE_PROCEDURE",
      resultReference: "",
      bookValue: "",
      auditedValue: "",
      exceptionAmount: "",
      exceptionDescription: "",
      testConclusion: "",
      attachments: "",
    });
  };

  const handleEdit = (result: ExecutionResult) => {
    setEditingResult(result);
    setResultForm({
      procedureId: result.procedureId || "",
      samplingFrameId: result.samplingFrameId || "",
      fsHeadKey: result.fsHeadKey || "",
      glCode: result.glCode || "",
      resultType: result.resultType,
      resultReference: result.resultReference || "",
      bookValue: result.bookValue ? String(result.bookValue) : "",
      auditedValue: result.auditedValue ? String(result.auditedValue) : "",
      exceptionAmount: result.exceptionAmount ? String(result.exceptionAmount) : "",
      exceptionDescription: result.exceptionDescription || "",
      testConclusion: result.testConclusion || "",
      attachments: result.attachments ? JSON.stringify(result.attachments) : "",
    });
    setShowEditDialog(true);
  };

  const canReview = (result: ExecutionResult): boolean => {
    return (result.status === "COMPLETED" || result.status === "EXCEPTION_FOUND") && hasMinRole(user?.role || "", "SENIOR");
  };

  const canApprove = (result: ExecutionResult): boolean => {
    return result.status === "REVIEWED" && hasMinRole(user?.role || "", "MANAGER");
  };

  if (isLoading) {
    return (
      <Card className={className} data-testid="execution-result-panel-loading">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className} data-testid="execution-result-panel-error">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileCheck className="h-5 w-5" />
            Execution Results (ISA 500)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Failed to load execution results</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const FormContent = ({ isEdit = false }: { isEdit?: boolean }) => (
    <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Link to Procedure</Label>
          <Select
            value={resultForm.procedureId || "__none__"}
            onValueChange={(v) => setResultForm(prev => ({ ...prev, procedureId: v === "__none__" ? "" : v }))}
          >
            <SelectTrigger data-testid="select-procedure">
              <SelectValue placeholder="Select procedure" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {procedures?.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.procedureName} {p.fsHeadKey ? `(${p.fsHeadKey})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Link to Sampling Frame</Label>
          <Select
            value={resultForm.samplingFrameId || "__none__"}
            onValueChange={(v) => setResultForm(prev => ({ ...prev, samplingFrameId: v === "__none__" ? "" : v }))}
          >
            <SelectTrigger data-testid="select-sampling-frame">
              <SelectValue placeholder="Select frame" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {samplingFrames?.map(f => (
                <SelectItem key={f.id} value={f.id}>
                  {f.frameName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>FS Head Key</Label>
          <Input
            placeholder="e.g., REVENUE, AR"
            value={resultForm.fsHeadKey}
            onChange={(e) => setResultForm(prev => ({ ...prev, fsHeadKey: e.target.value }))}
            data-testid="input-fs-head-key"
          />
        </div>
        <div className="space-y-2">
          <Label>GL Code</Label>
          <Input
            placeholder="e.g., 4100"
            value={resultForm.glCode}
            onChange={(e) => setResultForm(prev => ({ ...prev, glCode: e.target.value }))}
            data-testid="input-gl-code"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Result Type</Label>
          <Select
            value={resultForm.resultType}
            onValueChange={(v: ExecutionResultType) => setResultForm(prev => ({ ...prev, resultType: v }))}
          >
            <SelectTrigger data-testid="select-result-type">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {RESULT_TYPE_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Working Paper Reference</Label>
          <Input
            placeholder="e.g., WP-REV-001"
            value={resultForm.resultReference}
            onChange={(e) => setResultForm(prev => ({ ...prev, resultReference: e.target.value }))}
            data-testid="input-result-reference"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Book Value</Label>
          <Input
            type="number"
            placeholder="Amount"
            value={resultForm.bookValue}
            onChange={(e) => setResultForm(prev => ({ ...prev, bookValue: e.target.value }))}
            data-testid="input-book-value"
          />
        </div>
        <div className="space-y-2">
          <Label>Audited Value</Label>
          <Input
            type="number"
            placeholder="Amount"
            value={resultForm.auditedValue}
            onChange={(e) => setResultForm(prev => ({ ...prev, auditedValue: e.target.value }))}
            data-testid="input-audited-value"
          />
        </div>
        <div className="space-y-2">
          <Label>Exception Amount</Label>
          <Input
            type="number"
            placeholder="Amount"
            value={resultForm.exceptionAmount}
            onChange={(e) => setResultForm(prev => ({ ...prev, exceptionAmount: e.target.value }))}
            data-testid="input-exception-amount"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Exception Description</Label>
        <Textarea
          placeholder="Describe any exceptions found..."
          value={resultForm.exceptionDescription}
          onChange={(e) => setResultForm(prev => ({ ...prev, exceptionDescription: e.target.value }))}
          rows={2}
          data-testid="input-exception-description"
        />
      </div>

      <div className="space-y-2">
        <Label>Test Conclusion</Label>
        <Textarea
          placeholder="Document the test conclusion and findings..."
          value={resultForm.testConclusion}
          onChange={(e) => setResultForm(prev => ({ ...prev, testConclusion: e.target.value }))}
          rows={3}
          data-testid="input-test-conclusion"
        />
      </div>

      <div className="space-y-2">
        <Label>Attachments (JSON)</Label>
        <Textarea
          placeholder='[{"name": "Invoice.pdf", "url": "/files/invoice.pdf"}]'
          value={resultForm.attachments}
          onChange={(e) => setResultForm(prev => ({ ...prev, attachments: e.target.value }))}
          rows={2}
          data-testid="input-attachments"
        />
      </div>
    </div>
  );

  return (
    <Card className={className} data-testid="execution-result-panel">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileCheck className="h-5 w-5" />
              Execution Results (ISA 500)
            </CardTitle>
            <CardDescription>
              Document and review audit test results and workpapers
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {uniqueFsHeadKeys.length > 0 && (
              <Select value={filterFsHeadKey} onValueChange={setFilterFsHeadKey}>
                <SelectTrigger className="w-[120px]" data-testid="filter-fs-head">
                  <SelectValue placeholder="FS Head" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All FS Heads</SelectItem>
                  {uniqueFsHeadKeys.map(key => (
                    <SelectItem key={key} value={key}>{key}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[130px]" data-testid="filter-status">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-add-result">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Result
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Create Execution Result</DialogTitle>
                  <DialogDescription>
                    Document audit test results per ISA 500.
                  </DialogDescription>
                </DialogHeader>
                <FormContent />
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => createMutation.mutate(resultForm)}
                    disabled={createMutation.isPending}
                    data-testid="button-create-result"
                  >
                    {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create Result
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {filteredResults.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground" data-testid="empty-state">
            <FileCheck className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-sm">No execution results recorded yet.</p>
            <p className="text-xs mt-1">Add execution results to document audit test findings.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Procedure</TableHead>
                  <TableHead>FS Head</TableHead>
                  <TableHead>WP Ref</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Performed By</TableHead>
                  <TableHead>Reviewed By</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredResults.map((result) => (
                  <TableRow key={result.id} data-testid={`row-result-${result.id}`}>
                    <TableCell>
                      {result.procedure ? (
                        <span className="text-sm">{result.procedure.procedureName}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {result.fsHeadKey ? (
                        <Badge variant="outline" className="text-xs">{result.fsHeadKey}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{result.resultReference || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {RESULT_TYPE_OPTIONS.find(t => t.value === result.resultType)?.label || result.resultType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={result.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {result.performedBy?.fullName || "-"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {result.reviewedBy?.fullName || "-"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-actions-${result.id}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={() => handleEdit(result)}
                            disabled={result.status === "APPROVED"}
                            data-testid={`button-edit-${result.id}`}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => reviewMutation.mutate({ id: result.id })}
                            disabled={!canReview(result) || reviewMutation.isPending}
                            data-testid={`button-review-${result.id}`}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Mark as Reviewed
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => approveMutation.mutate(result.id)}
                            disabled={!canApprove(result) || approveMutation.isPending}
                            data-testid={`button-approve-${result.id}`}
                          >
                            <UserCheck className="h-4 w-4 mr-2" />
                            Approve
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Execution Result</DialogTitle>
              <DialogDescription>
                Update execution result details.
              </DialogDescription>
            </DialogHeader>
            <FormContent isEdit />
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowEditDialog(false); setEditingResult(null); }}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (editingResult) {
                    updateMutation.mutate({ id: editingResult.id, data: resultForm });
                  }
                }}
                disabled={updateMutation.isPending}
                data-testid="button-update-result"
              >
                {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Update Result
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
