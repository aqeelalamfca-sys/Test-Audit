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
  Database,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  FileText,
  Edit,
  MoreHorizontal,
  Play,
  Eye,
  Filter,
  Shuffle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type SamplingFrameStatus = "CREATED" | "POPULATION_LOADED" | "STRATIFIED" | "SAMPLED" | "TESTING_IN_PROGRESS" | "COMPLETED" | "REVIEWED";
type SamplingMethod = "RANDOM" | "SYSTEMATIC" | "MONETARY_UNIT" | "HAPHAZARD" | "BLOCK" | "JUDGMENTAL";

interface SamplingFrame {
  id: string;
  engagementId: string;
  procedureId: string | null;
  samplingRunId: string | null;
  frameName: string;
  populationSource: string;
  populationGLCodes: string[];
  populationFilters: Record<string, unknown> | null;
  populationCount: number;
  populationValue: string | number;
  stratificationRules: Record<string, unknown> | null;
  stratificationResults: Record<string, unknown> | null;
  samplingMethod: string | null;
  sampleSize: number;
  samplingInterval: string | number | null;
  randomSeed: number | null;
  confidenceLevel: string | number | null;
  tolerableError: string | number | null;
  expectedError: string | number | null;
  selectedItems: Record<string, unknown> | null;
  status: SamplingFrameStatus;
  isaReference: string;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  procedure?: { id: string; procedureName: string } | null;
  createdBy?: { id: string; fullName: string } | null;
}

interface ProcedureMatrixItem {
  id: string;
  procedureName: string;
  fsHeadKey: string | null;
  status: string;
}

interface SamplingFramePanelProps {
  engagementId: string;
  className?: string;
}

const SAMPLING_METHOD_OPTIONS: { value: SamplingMethod; label: string }[] = [
  { value: "RANDOM", label: "Random Sampling" },
  { value: "SYSTEMATIC", label: "Systematic Sampling" },
  { value: "MONETARY_UNIT", label: "Monetary Unit Sampling (MUS)" },
  { value: "HAPHAZARD", label: "Haphazard Sampling" },
  { value: "BLOCK", label: "Block Sampling" },
  { value: "JUDGMENTAL", label: "Judgmental Sampling" },
];

const STATUS_CONFIG: Record<SamplingFrameStatus, { label: string; color: string; icon: typeof Clock }> = {
  CREATED: { label: "Created", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200", icon: FileText },
  POPULATION_LOADED: { label: "Population Loaded", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", icon: Database },
  STRATIFIED: { label: "Stratified", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200", icon: Filter },
  SAMPLED: { label: "Sampled", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200", icon: Shuffle },
  TESTING_IN_PROGRESS: { label: "Testing", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200", icon: Play },
  COMPLETED: { label: "Completed", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: CheckCircle2 },
  REVIEWED: { label: "Reviewed", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200", icon: Eye },
};

function formatNumber(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "-";
  return new Intl.NumberFormat("en-US").format(num);
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function StatusBadge({ status }: { status: SamplingFrameStatus }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  return (
    <Badge className={cn("gap-1", config.color)} data-testid={`badge-status-${status.toLowerCase()}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

export function SamplingFramePanel({ engagementId, className }: SamplingFramePanelProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingFrame, setEditingFrame] = useState<SamplingFrame | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  
  const [frameForm, setFrameForm] = useState({
    procedureId: "",
    frameName: "",
    populationSource: "",
    populationGLCodes: "",
    populationFilters: "",
    samplingMethod: "RANDOM" as SamplingMethod,
    sampleSize: 25,
    confidenceLevel: 95,
    tolerableError: "",
    expectedError: "",
  });

  const { data: samplingFrames, isLoading, error } = useQuery<SamplingFrame[]>({
    queryKey: ["/api/engagements", engagementId, "sampling-frames"],
    enabled: !!engagementId,
  });

  const { data: procedures } = useQuery<ProcedureMatrixItem[]>({
    queryKey: ["/api/engagements", engagementId, "procedures-matrix"],
    enabled: !!engagementId,
  });

  const filteredFrames = useMemo(() => {
    if (!samplingFrames) return [];
    return samplingFrames.filter(f => {
      if (filterStatus !== "all" && f.status !== filterStatus) return false;
      return true;
    });
  }, [samplingFrames, filterStatus]);

  const createMutation = useMutation({
    mutationFn: async (data: typeof frameForm) => {
      const payload = {
        procedureId: data.procedureId || undefined,
        frameName: data.frameName,
        populationSource: data.populationSource,
        populationGLCodes: data.populationGLCodes ? data.populationGLCodes.split(",").map(s => s.trim()) : [],
        populationFilters: data.populationFilters ? JSON.parse(data.populationFilters) : undefined,
        samplingMethod: data.samplingMethod,
        confidenceLevel: data.confidenceLevel,
        tolerableError: data.tolerableError ? parseFloat(data.tolerableError) : undefined,
        expectedError: data.expectedError ? parseFloat(data.expectedError) : undefined,
      };
      const response = await apiRequest("POST", `/api/engagements/${engagementId}/sampling-frames`, payload);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Sampling frame created successfully" });
      setShowAddDialog(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", engagementId, "sampling-frames"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof frameForm> }) => {
      const payload: Record<string, unknown> = {};
      if (data.procedureId !== undefined) payload.procedureId = data.procedureId || undefined;
      if (data.frameName) payload.frameName = data.frameName;
      if (data.populationSource) payload.populationSource = data.populationSource;
      if (data.populationGLCodes !== undefined) payload.populationGLCodes = data.populationGLCodes ? data.populationGLCodes.split(",").map(s => s.trim()) : [];
      if (data.samplingMethod) payload.samplingMethod = data.samplingMethod;
      if (data.confidenceLevel !== undefined) payload.confidenceLevel = data.confidenceLevel;
      if (data.tolerableError !== undefined) payload.tolerableError = data.tolerableError ? parseFloat(data.tolerableError) : undefined;
      if (data.expectedError !== undefined) payload.expectedError = data.expectedError ? parseFloat(data.expectedError) : undefined;
      
      const response = await apiRequest("PATCH", `/api/engagements/${engagementId}/sampling-frames/${id}`, payload);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Sampling frame updated successfully" });
      setShowEditDialog(false);
      setEditingFrame(null);
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", engagementId, "sampling-frames"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const generateSampleMutation = useMutation({
    mutationFn: async ({ id, sampleSize, samplingMethod }: { id: string; sampleSize: number; samplingMethod: string }) => {
      const response = await apiRequest("POST", `/api/engagements/${engagementId}/sampling-frames/${id}/generate-sample`, {
        sampleSize,
        samplingMethod,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Sample generated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", engagementId, "sampling-frames"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFrameForm({
      procedureId: "",
      frameName: "",
      populationSource: "",
      populationGLCodes: "",
      populationFilters: "",
      samplingMethod: "RANDOM",
      sampleSize: 25,
      confidenceLevel: 95,
      tolerableError: "",
      expectedError: "",
    });
  };

  const handleEdit = (frame: SamplingFrame) => {
    setEditingFrame(frame);
    setFrameForm({
      procedureId: frame.procedureId || "",
      frameName: frame.frameName,
      populationSource: frame.populationSource,
      populationGLCodes: frame.populationGLCodes?.join(", ") || "",
      populationFilters: frame.populationFilters ? JSON.stringify(frame.populationFilters) : "",
      samplingMethod: (frame.samplingMethod as SamplingMethod) || "RANDOM",
      sampleSize: frame.sampleSize || 25,
      confidenceLevel: frame.confidenceLevel ? parseFloat(String(frame.confidenceLevel)) : 95,
      tolerableError: frame.tolerableError ? String(frame.tolerableError) : "",
      expectedError: frame.expectedError ? String(frame.expectedError) : "",
    });
    setShowEditDialog(true);
  };

  const handleGenerateSample = (frame: SamplingFrame) => {
    generateSampleMutation.mutate({
      id: frame.id,
      sampleSize: frame.sampleSize || 25,
      samplingMethod: frame.samplingMethod || "RANDOM",
    });
  };

  if (isLoading) {
    return (
      <Card className={className} data-testid="sampling-frame-panel-loading">
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
      <Card className={className} data-testid="sampling-frame-panel-error">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-5 w-5" />
            Sampling Frames (ISA 530)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Failed to load sampling frames</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const FormContent = ({ isEdit = false }: { isEdit?: boolean }) => (
    <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
      <div className="space-y-2">
        <Label>Link to Procedure</Label>
        <Select
          value={frameForm.procedureId || "__none__"}
          onValueChange={(v) => setFrameForm(prev => ({ ...prev, procedureId: v === "__none__" ? "" : v }))}
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
        <Label>Frame Name *</Label>
        <Input
          placeholder="e.g., Trade Receivables - Year End"
          value={frameForm.frameName}
          onChange={(e) => setFrameForm(prev => ({ ...prev, frameName: e.target.value }))}
          data-testid="input-frame-name"
        />
      </div>

      <div className="space-y-2">
        <Label>Population Source *</Label>
        <Input
          placeholder="e.g., GL Transactions, Trial Balance"
          value={frameForm.populationSource}
          onChange={(e) => setFrameForm(prev => ({ ...prev, populationSource: e.target.value }))}
          data-testid="input-population-source"
        />
      </div>

      <div className="space-y-2">
        <Label>GL Codes (comma-separated)</Label>
        <Input
          placeholder="e.g., 1100, 1200, 1300"
          value={frameForm.populationGLCodes}
          onChange={(e) => setFrameForm(prev => ({ ...prev, populationGLCodes: e.target.value }))}
          data-testid="input-gl-codes"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Sampling Method</Label>
          <Select
            value={frameForm.samplingMethod}
            onValueChange={(v: SamplingMethod) => setFrameForm(prev => ({ ...prev, samplingMethod: v }))}
          >
            <SelectTrigger data-testid="select-sampling-method">
              <SelectValue placeholder="Select method" />
            </SelectTrigger>
            <SelectContent>
              {SAMPLING_METHOD_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Sample Size</Label>
          <Input
            type="number"
            min="1"
            value={frameForm.sampleSize}
            onChange={(e) => setFrameForm(prev => ({ ...prev, sampleSize: parseInt(e.target.value) || 25 }))}
            data-testid="input-sample-size"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Confidence Level (%)</Label>
          <Input
            type="number"
            min="1"
            max="100"
            value={frameForm.confidenceLevel}
            onChange={(e) => setFrameForm(prev => ({ ...prev, confidenceLevel: parseFloat(e.target.value) || 95 }))}
            data-testid="input-confidence-level"
          />
        </div>
        <div className="space-y-2">
          <Label>Tolerable Error</Label>
          <Input
            type="number"
            placeholder="Amount"
            value={frameForm.tolerableError}
            onChange={(e) => setFrameForm(prev => ({ ...prev, tolerableError: e.target.value }))}
            data-testid="input-tolerable-error"
          />
        </div>
        <div className="space-y-2">
          <Label>Expected Error</Label>
          <Input
            type="number"
            placeholder="Amount"
            value={frameForm.expectedError}
            onChange={(e) => setFrameForm(prev => ({ ...prev, expectedError: e.target.value }))}
            data-testid="input-expected-error"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Population Filters (JSON)</Label>
        <Textarea
          placeholder='{"dateRange": {"start": "2025-01-01", "end": "2025-12-31"}}'
          value={frameForm.populationFilters}
          onChange={(e) => setFrameForm(prev => ({ ...prev, populationFilters: e.target.value }))}
          rows={3}
          data-testid="input-population-filters"
        />
      </div>
    </div>
  );

  return (
    <Card className={className} data-testid="sampling-frame-panel">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-5 w-5" />
              Sampling Frames (ISA 530)
            </CardTitle>
            <CardDescription>
              Define and manage sampling populations for audit procedures
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px]" data-testid="filter-status">
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
                <Button size="sm" data-testid="button-add-frame">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Frame
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Create Sampling Frame</DialogTitle>
                  <DialogDescription>
                    Define a new population sampling frame per ISA 530.
                  </DialogDescription>
                </DialogHeader>
                <FormContent />
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => createMutation.mutate(frameForm)}
                    disabled={createMutation.isPending || !frameForm.frameName || !frameForm.populationSource}
                    data-testid="button-create-frame"
                  >
                    {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create Frame
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {filteredFrames.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground" data-testid="empty-state">
            <Database className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-sm">No sampling frames defined yet.</p>
            <p className="text-xs mt-1">Create a sampling frame to define audit populations.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Frame Name</TableHead>
                  <TableHead>Procedure</TableHead>
                  <TableHead>Population Source</TableHead>
                  <TableHead className="text-right">Pop. Size</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Sample Size</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFrames.map((frame) => (
                  <TableRow key={frame.id} data-testid={`row-frame-${frame.id}`}>
                    <TableCell className="font-medium">{frame.frameName}</TableCell>
                    <TableCell>
                      {frame.procedure ? (
                        <span className="text-xs text-muted-foreground">{frame.procedure.procedureName}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{frame.populationSource}</TableCell>
                    <TableCell className="text-right">{formatNumber(frame.populationCount)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {SAMPLING_METHOD_OPTIONS.find(m => m.value === frame.samplingMethod)?.label || frame.samplingMethod || "-"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(frame.sampleSize)}</TableCell>
                    <TableCell>
                      <StatusBadge status={frame.status} />
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-actions-${frame.id}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(frame)} data-testid={`button-edit-${frame.id}`}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleGenerateSample(frame)}
                            disabled={generateSampleMutation.isPending || frame.status === "COMPLETED" || frame.status === "REVIEWED"}
                            data-testid={`button-generate-sample-${frame.id}`}
                          >
                            <Shuffle className="h-4 w-4 mr-2" />
                            Generate Sample
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
              <DialogTitle>Edit Sampling Frame</DialogTitle>
              <DialogDescription>
                Update sampling frame details.
              </DialogDescription>
            </DialogHeader>
            <FormContent isEdit />
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowEditDialog(false); setEditingFrame(null); }}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (editingFrame) {
                    updateMutation.mutate({ id: editingFrame.id, data: frameForm });
                  }
                }}
                disabled={updateMutation.isPending || !frameForm.frameName || !frameForm.populationSource}
                data-testid="button-update-frame"
              >
                {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Update Frame
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
