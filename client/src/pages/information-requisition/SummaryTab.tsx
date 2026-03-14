import { useState, useCallback, useRef } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, CheckCircle, XCircle, AlertTriangle, CircleDashed, Upload, RefreshCw, Download, FileSpreadsheet, Database, Users, Building2, Scale, FileText, ChevronRight, X, ArrowRight, Shield, ClipboardCheck, Tag } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { getAuthToken } from "@/lib/auth";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import type { WorkflowTabKey, DataSource, TabGate } from './workflow-spec';
import { WORKFLOW_TABS } from './workflow-spec';
import { DatasetUploadPanel } from "@/components/dataset-uploader";


interface ValidationException {
  id: string;
  dataset: 'TB' | 'GL' | 'AP' | 'AR' | 'BANK' | 'PARTY' | 'RECONCILIATION' | 'TB/GL';
  severity: 'CRITICAL' | 'ERROR' | 'WARNING' | 'INFO';
  ruleCode: string;
  ruleName: string;
  message: string;
  rowReference?: string;
  glCode?: string;
  expectedValue?: string;
  actualValue?: string;
  difference?: number;
}

interface SummaryRunData {
  hasSummary: boolean;
  id?: string;
  uploadVersionId?: string;
  tbRowCount?: number;
  glEntryCount?: number;
  apRowCount?: number;
  arRowCount?: number;
  bankRowCount?: number;
  partyCount?: number;
  tbOpeningDebitTotal?: string;
  tbOpeningCreditTotal?: string;
  tbClosingDebitTotal?: string;
  tbClosingCreditTotal?: string;
  tbMovementDebitTotal?: string;
  tbMovementCreditTotal?: string;
  glDebitTotal?: string;
  glCreditTotal?: string;
  tbArithmeticStatus?: 'PASS' | 'FAIL' | 'WARNING' | 'NOT_RUN' | 'SKIPPED';
  tbArithmeticMessage?: string;
  glDrCrStatus?: 'PASS' | 'FAIL' | 'WARNING' | 'NOT_RUN' | 'SKIPPED';
  glDrCrMessage?: string;
  tbGlTieOutStatus?: 'PASS' | 'FAIL' | 'WARNING' | 'NOT_RUN' | 'SKIPPED';
  tbGlTieOutMessage?: string;
  tbGlTotalsStatus?: 'PASS' | 'FAIL' | 'WARNING' | 'NOT_RUN' | 'SKIPPED';
  tbGlTotalsMessage?: string;
  tbTotalDebit?: string;
  tbTotalCredit?: string;
  deltaDR?: string;
  deltaCR?: string;
  roundingTolerance?: string;
  overallStatus?: 'PASS' | 'FAIL' | 'WARNING' | 'NOT_RUN' | 'SKIPPED';
  exceptionCount?: number;
  criticalExceptionCount?: number;
  exceptions?: ValidationException[];
  uploadVersion?: {
    version: number;
    fileName: string;
    status: string;
    createdAt: string;
  };
  createdAt?: string;
  message?: string;
}

interface SummaryTabProps {
  toast: (props: { title: string; description?: string; variant?: "default" | "destructive" }) => void;
  onNavigate?: (tab: string) => void;
  dataSources?: Partial<Record<WorkflowTabKey, DataSource | null>>;
  tabGates?: Partial<Record<WorkflowTabKey, TabGate[]>>;
}

type ValidationStatus = 'PASS' | 'FAIL' | 'WARNING' | 'NOT_RUN' | 'SKIPPED';

const severityColors: Record<string, string> = {
  CRITICAL: "bg-red-500 text-white",
  ERROR: "bg-orange-500 text-white",
  WARNING: "bg-yellow-500 text-black",
  INFO: "bg-blue-500 text-white",
};

const statusIcons: Record<string, { icon: typeof CheckCircle; color: string }> = {
  PASS: { icon: CheckCircle, color: "text-green-500" },
  FAIL: { icon: XCircle, color: "text-red-500" },
  WARNING: { icon: AlertTriangle, color: "text-yellow-500" },
  NOT_RUN: { icon: CircleDashed, color: "text-gray-400" },
  SKIPPED: { icon: CircleDashed, color: "text-gray-400" },
};

const overallStatusColors: Record<string, string> = {
  PASS: "bg-green-100 dark:bg-green-900/30 border-green-500",
  FAIL: "bg-red-100 dark:bg-red-900/30 border-red-500",
  WARNING: "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-500",
  NOT_RUN: "bg-gray-100 dark:bg-gray-900/30 border-gray-400",
  SKIPPED: "bg-gray-100 dark:bg-gray-900/30 border-gray-400",
};

function StatusBadge({ status }: { status: ValidationStatus }) {
  const config = statusIcons[status] || statusIcons.NOT_RUN;
  const Icon = config.icon;
  return (
    <div className="flex items-center gap-1.5">
      <Icon className={`h-4 w-4 ${config.color}`} />
      <span className={`text-sm font-medium ${config.color}`}>{status}</span>
    </div>
  );
}

function formatNumber(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return "0";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0";
  return num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = ['.xlsx', '.xls'];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

const DS_STATUS_COLORS: Record<string, string> = {
  CURRENT: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-300 dark:border-green-700",
  STALE: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700",
  MISSING: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-300 dark:border-red-700",
};

function DataSourceBadgeInline({ source }: { source: DataSource }) {
  const colorClass = DS_STATUS_COLORS[source.status] || DS_STATUS_COLORS.MISSING;
  return (
    <Badge variant="outline" className={`text-xs gap-1 no-default-hover-elevate ${colorClass}`} data-testid={`badge-ds-${source.datasetType}`}>
      {source.status === 'MISSING' ? 'No data' : `v${source.version}`}
      {source.status !== 'MISSING' && source.lastSynced && (
        <span className="font-normal opacity-70">{new Date(source.lastSynced).toLocaleDateString()}</span>
      )}
    </Badge>
  );
}

const GATE_ICON_CONFIG: Record<string, { color: string }> = {
  PASS: { color: "text-green-500" },
  FAIL: { color: "text-red-500" },
  WARNING: { color: "text-yellow-500" },
  NOT_RUN: { color: "text-gray-400" },
};

function GateCountBadge({ check, count }: { check: string; count: number }) {
  if (count === 0) return null;
  const colorMap: Record<string, string> = {
    PASS: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-300 dark:border-green-700",
    FAIL: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-300 dark:border-red-700",
    WARNING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700",
    NOT_RUN: "bg-muted text-muted-foreground border-border",
  };
  return (
    <Badge variant="outline" className={`text-xs no-default-hover-elevate ${colorMap[check] || colorMap.NOT_RUN}`}>
      {count}
    </Badge>
  );
}

interface ImportValidationError {
  id: string;
  severity: 'CRITICAL' | 'ERROR' | 'WARNING' | 'INFO';
  category: string;
  sheet: string;
  row?: number;
  column?: string;
  field?: string;
  message: string;
  expected?: string;
  actual?: string;
  ruleCode: string;
  fixHint?: string;
}

interface ValidationBlockedResult {
  blocked: boolean;
  validation: {
    valid: boolean;
    criticalCount: number;
    errorCount: number;
    warningCount: number;
    sheetsFound: string[];
    sheetsMissing: string[];
    rowCounts: Record<string, number>;
  };
  errors: ImportValidationError[];
  error: string;
}

export function SummaryTab({ toast, onNavigate, dataSources = {}, tabGates = {} }: SummaryTabProps) {
  const params = useParams<{ engagementId: string }>();
  const engagementId = params.engagementId;
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [exceptionFilter, setExceptionFilter] = useState<string>('ALL');
  const [validationErrors, setValidationErrors] = useState<ImportValidationError[] | null>(null);
  const [validationBlocked, setValidationBlocked] = useState<ValidationBlockedResult | null>(null);
  const [isDownloadingReport, setIsDownloadingReport] = useState(false);
  const [isGeneratingWorkbook, setIsGeneratingWorkbook] = useState(false);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const { data: summaryData, isLoading, error, refetch } = useQuery<SummaryRunData>({
    queryKey: [`/api/import/${engagementId}/summary-run`],
    enabled: !!engagementId,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!engagementId) {
        throw new Error("Engagement ID is required");
      }
      
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(percentComplete);
          }
        });
        
        xhr.addEventListener('load', () => {
          xhrRef.current = null;
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              resolve(response);
            } catch {
              resolve({ success: true });
            }
          } else {
            try {
              const errorData = JSON.parse(xhr.responseText);
              if (errorData.blocked && errorData.errors) {
                setValidationBlocked(errorData as ValidationBlockedResult);
                setValidationErrors(errorData.errors);
              }
              reject(new Error(errorData.error || "Upload failed"));
            } catch {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          }
        });
        
        xhr.addEventListener('error', () => {
          xhrRef.current = null;
          reject(new Error("Network error during upload"));
        });
        
        xhr.addEventListener('abort', () => {
          xhrRef.current = null;
          reject(new Error("Upload cancelled"));
        });
        
        const formData = new FormData();
        formData.append("file", file);
        
        xhr.open('POST', `/api/import/${engagementId}/input-workbook`);
        xhr.timeout = 300000; // 5 minutes
        xhr.withCredentials = true; // Include cookies for session auth
        
        // Add authorization header if token exists
        const token = getAuthToken();
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }
        
        // Add active client/period headers if available
        try {
          const activeClientId = localStorage.getItem("activeClientId");
          const activePeriodId = localStorage.getItem("activePeriodId");
          if (activeClientId) xhr.setRequestHeader("X-Active-Client-Id", activeClientId);
          if (activePeriodId) xhr.setRequestHeader("X-Active-Period-Id", activePeriodId);
        } catch (e) {
          // ignore storage access errors
        }
        
        xhr.send(formData);
      });
    },
    onMutate: () => {
      setUploadProgress(0);
    },
    onSuccess: () => {
      toast({ title: "Upload Complete", description: "Input workbook uploaded and validated successfully." });
      setSelectedFile(null);
      setUploadProgress(0);
      setValidationErrors(null);
      setValidationBlocked(null);
      if (engagementId) {
        queryClient.invalidateQueries({ queryKey: [`/api/import/${engagementId}/summary-run`] });
        queryClient.invalidateQueries({ queryKey: ['/api/fs-draft'] });
        queryClient.invalidateQueries({ queryKey: ['/api/engagements', engagementId, 'coa'] });
        queryClient.invalidateQueries({ queryKey: ['/api/engagements', engagementId, 'fs-heads'] });
        queryClient.invalidateQueries({ queryKey: ['/api/review-mapping'] });
        queryClient.invalidateQueries({ queryKey: ['/api/mapping'] });
        queryClient.invalidateQueries({ queryKey: ['/api/trial-balance'] });
      }
    },
    onError: (error: Error) => {
      setUploadProgress(0);
      toast({ title: "Upload Failed", description: error.message, variant: "destructive" });
    },
  });

  const rerunMutation = useMutation({
    mutationFn: async () => {
      if (!engagementId) {
        throw new Error("Engagement ID is required");
      }
      const response = await apiRequest("POST", `/api/import/${engagementId}/rerun-validations`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Validations Complete", description: "Validations have been re-run successfully." });
      if (engagementId) {
        queryClient.invalidateQueries({ queryKey: [`/api/import/${engagementId}/summary-run`] });
        queryClient.invalidateQueries({ queryKey: ['/api/fs-draft'] });
        queryClient.invalidateQueries({ queryKey: ['/api/engagements', engagementId, 'coa'] });
        queryClient.invalidateQueries({ queryKey: ['/api/engagements', engagementId, 'fs-heads'] });
        queryClient.invalidateQueries({ queryKey: ['/api/review-mapping'] });
        queryClient.invalidateQueries({ queryKey: ['/api/mapping'] });
        queryClient.invalidateQueries({ queryKey: ['/api/trial-balance'] });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Rerun Failed", description: error.message, variant: "destructive" });
    },
  });



  const validateFile = useCallback((file: File): string | null => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_TYPES.includes(ext)) {
      return `Invalid file type. Please upload an Excel file (${ALLOWED_TYPES.join(', ')})`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File too large (${formatFileSize(file.size)}). Maximum size is ${formatFileSize(MAX_FILE_SIZE)}`;
    }
    return null;
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFileError(null);
    if (file) {
      const error = validateFile(file);
      if (error) {
        setFileError(error);
        setSelectedFile(null);
      } else {
        setSelectedFile(file);
      }
    }
  }, [validateFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    setFileError(null);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const error = validateFile(file);
      if (error) {
        setFileError(error);
        setSelectedFile(null);
      } else {
        setSelectedFile(file);
      }
    }
  }, [validateFile]);

  const clearSelectedFile = useCallback(() => {
    setSelectedFile(null);
    setFileError(null);
  }, []);

  const handleUpload = useCallback(() => {
    if (selectedFile) {
      uploadMutation.mutate(selectedFile);
    }
  }, [selectedFile, uploadMutation]);

  const handleExport = useCallback(async () => {
    if (!engagementId) {
      toast({ title: "Export Failed", description: "Engagement ID is required.", variant: "destructive" });
      return;
    }
    try {
      const response = await fetchWithAuth(`/api/import/${engagementId}/summary/export`, {
        timeout: 60000,
      });
      
      if (!response.ok) {
        let errorMessage = "Export failed";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          errorMessage = `Export failed with status ${response.status}`;
        }
        throw new Error(errorMessage);
      }
      
      const blob = await response.blob();
      if (!blob || blob.size === 0) {
        throw new Error("No data received from export");
      }
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Output_Summary_${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Export Complete", description: "Output.xlsx downloaded successfully." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to export output file.";
      toast({ title: "Export Failed", description: message, variant: "destructive" });
    }
  }, [engagementId, toast]);

  const handleGenerateValidationWorkbook = useCallback(async () => {
    if (!engagementId) {
      toast({ title: "Generation Failed", description: "Engagement ID is required.", variant: "destructive" });
      return;
    }
    setIsGeneratingWorkbook(true);
    try {
      const response = await fetchWithAuth(`/api/import/${engagementId}/validation-workbook`, {
        timeout: 120000,
      });

      if (!response.ok) {
        let errorMessage = "Generation failed";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          errorMessage = `Generation failed with status ${response.status}`;
        }
        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      if (!blob || blob.size === 0) {
        throw new Error("No data received");
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `AuditWise_Data_Validation_Workbook.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Workbook Generated", description: "Validation workbook downloaded successfully." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate validation workbook.";
      toast({ title: "Generation Failed", description: message, variant: "destructive" });
    } finally {
      setIsGeneratingWorkbook(false);
    }
  }, [engagementId, toast]);

  const handleDownloadErrorReport = useCallback(async () => {
    if (!engagementId || !selectedFile) return;
    setIsDownloadingReport(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const response = await fetchWithAuth(`/api/import/${engagementId}/error-report`, {
        method: 'POST',
        body: formData,
        timeout: 60000,
      });
      if (!response.ok) {
        throw new Error("Failed to generate error report");
      }
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        toast({ title: "No Errors", description: data.message || "The workbook is valid." });
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Import_Error_Report_${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Report Downloaded", description: "Import error report downloaded." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to download error report.";
      toast({ title: "Download Failed", description: message, variant: "destructive" });
    } finally {
      setIsDownloadingReport(false);
    }
  }, [engagementId, selectedFile, toast]);

  const handleDismissValidationErrors = useCallback(() => {
    setValidationErrors(null);
    setValidationBlocked(null);
  }, []);

  const handleDownloadTemplate = useCallback(async () => {
    try {
      const response = await fetchWithAuth(`/api/import/template`, {
        timeout: 60000,
      });
      
      if (!response.ok) {
        let errorMessage = "Template download failed";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          errorMessage = `Template download failed with status ${response.status}`;
        }
        throw new Error(errorMessage);
      }
      
      const blob = await response.blob();
      if (!blob || blob.size === 0) {
        throw new Error("No template data received");
      }
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "AuditWise_Input_Template.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Download Complete", description: "Template downloaded successfully." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to download template.";
      toast({ title: "Download Failed", description: message, variant: "destructive" });
    }
  }, [toast]);


  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12" data-testid="summary-loading">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card data-testid="summary-error">
        <CardContent className="py-4 text-center">
          <XCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
          <p className="text-muted-foreground">Failed to load summary data</p>
          <Button variant="outline" className="mt-4" onClick={() => refetch()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const hasSummary = summaryData?.hasSummary;

  return (
    <div className="space-y-4" data-testid="summary-tab">
      <Card data-testid="card-file-upload">
        <CardHeader className="py-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Data Upload
          </CardTitle>
          <CardDescription>Upload individual datasets or a combined workbook with all sheets</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <DatasetUploadPanel
            engagementId={engagementId || ''}
            onUploadComplete={() => {
              queryClient.invalidateQueries({ queryKey: ['/api/import'] });
              queryClient.invalidateQueries({ queryKey: ['/api/engagements'] });
              queryClient.invalidateQueries({ queryKey: [`/api/import/${engagementId}/summary-run`] });
            }}
            onDownloadTemplate={handleDownloadTemplate}
            onNavigateToTab={onNavigate}
          />

          <div className="border rounded-lg p-4 bg-muted/30 mt-4">
            <h4 className="text-sm font-medium flex items-center gap-2 mb-3">
              <Tag className="h-4 w-4" />
              Upload Metadata (Source & Period Tags)
            </h4>
            <p className="text-xs text-muted-foreground mb-3">
              Tags are attached to each upload batch for traceability. Set these before uploading.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="fileType" className="text-xs">File Type</Label>
                <Select defaultValue="">
                  <SelectTrigger id="fileType" className="h-8 text-sm">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="excel-workbook">Excel Workbook (.xlsx)</SelectItem>
                    <SelectItem value="csv-tb">CSV — Trial Balance</SelectItem>
                    <SelectItem value="csv-gl">CSV — General Ledger</SelectItem>
                    <SelectItem value="erp-export">ERP Export</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sourceTag" className="text-xs">Source Tag</Label>
                <Input id="sourceTag" placeholder="e.g., Client ERP, Manual, Tally" className="h-8 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="periodTag" className="text-xs">Period Tag</Label>
                <Input id="periodTag" placeholder="e.g., FY2025, Q4-2025" className="h-8 text-sm" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>


      {validationBlocked && validationErrors && validationErrors.length > 0 && (
        <Card className="border-red-500 dark:border-red-700" data-testid="card-validation-errors">
          <CardHeader className="py-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="text-base flex items-center gap-2 text-red-600 dark:text-red-400">
                  <Shield className="h-4 w-4" />
                  Import Blocked - Validation Errors Found
                </CardTitle>
                <CardDescription className="text-red-600/80 dark:text-red-400/80">
                  Fix all CRITICAL and ERROR issues in your Excel file before importing.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {validationBlocked.validation.criticalCount > 0 && (
                  <Badge variant="outline" className="no-default-hover-elevate bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-300 dark:border-red-700" data-testid="badge-critical-count">
                    {validationBlocked.validation.criticalCount} Critical
                  </Badge>
                )}
                {validationBlocked.validation.errorCount > 0 && (
                  <Badge variant="outline" className="no-default-hover-elevate bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-300 dark:border-orange-700" data-testid="badge-error-count">
                    {validationBlocked.validation.errorCount} Errors
                  </Badge>
                )}
                {validationBlocked.validation.warningCount > 0 && (
                  <Badge variant="outline" className="no-default-hover-elevate bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700" data-testid="badge-warning-count">
                    {validationBlocked.validation.warningCount} Warnings
                  </Badge>
                )}
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleDownloadErrorReport} 
                  disabled={isDownloadingReport}
                  data-testid="button-download-error-report"
                >
                  {isDownloadingReport ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-1.5" />
                  )}
                  Download Error Report
                </Button>
                <Button variant="ghost" size="icon" onClick={handleDismissValidationErrors} data-testid="button-dismiss-errors">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {validationBlocked.validation.sheetsMissing.length > 0 && (
              <div className="mb-3 p-2 rounded bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-1">Missing Required Sheets:</p>
                <div className="flex gap-1 flex-wrap">
                  {validationBlocked.validation.sheetsMissing.map(s => (
                    <Badge key={s} variant="outline" className="no-default-hover-elevate text-xs bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border-red-300 dark:border-red-700">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <div className="max-h-64 overflow-y-auto border rounded">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Severity</TableHead>
                    <TableHead className="w-32">Sheet</TableHead>
                    <TableHead className="w-16">Row</TableHead>
                    <TableHead className="w-28">Column</TableHead>
                    <TableHead>Issue</TableHead>
                    <TableHead>How to Fix</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validationErrors
                    .filter(e => e.severity === 'CRITICAL' || e.severity === 'ERROR')
                    .slice(0, 50)
                    .map((err) => (
                    <TableRow key={err.id} data-testid={`row-validation-error-${err.id}`}>
                      <TableCell>
                        <Badge variant="outline" className={`no-default-hover-elevate text-xs ${severityColors[err.severity] || ''}`}>
                          {err.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{err.sheet}</TableCell>
                      <TableCell className="text-sm">{err.row || '-'}</TableCell>
                      <TableCell className="text-sm">{err.column || '-'}</TableCell>
                      <TableCell className="text-sm">{err.message}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{err.fixHint || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {validationErrors.filter(e => e.severity === 'CRITICAL' || e.severity === 'ERROR').length > 50 && (
                <p className="text-xs text-muted-foreground p-2 text-center">
                  Showing first 50 of {validationErrors.filter(e => e.severity === 'CRITICAL' || e.severity === 'ERROR').length} blocking issues. Download the full error report for all details.
                </p>
              )}
            </div>
            {validationErrors.filter(e => e.severity === 'WARNING').length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                {validationErrors.filter(e => e.severity === 'WARNING').length} warnings (non-blocking) will be shown after import.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {hasSummary && (
        <>
          <Card className={`border-2 ${overallStatusColors[summaryData?.overallStatus || 'NOT_RUN']}`} data-testid="card-overall-status">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Overall Status</p>
                  <div className="flex items-center gap-2 mt-1">
                    <StatusBadge status={summaryData?.overallStatus || 'NOT_RUN'} />
                    {summaryData?.exceptionCount ? (
                      <Badge variant="secondary" className="ml-2">
                        {summaryData.exceptionCount} exception{summaryData.exceptionCount !== 1 ? 's' : ''}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => rerunMutation.mutate()}
                    disabled={rerunMutation.isPending}
                    data-testid="button-rerun-validations"
                  >
                    {rerunMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Re-run Validations
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExport}
                    data-testid="button-export-output"
                  >
                    <Download className="h-4 w-4" />
                    Export Output.xlsx
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateValidationWorkbook}
                    disabled={isGeneratingWorkbook}
                    data-testid="button-validation-workbook"
                  >
                    {isGeneratingWorkbook ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ClipboardCheck className="h-4 w-4" />
                    )}
                    {isGeneratingWorkbook ? "Generating..." : "Validation Workbook"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card data-testid="card-validation-tb-arithmetic">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">TB Arithmetic</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{summaryData?.tbArithmeticMessage || 'OB + Movement = CB check'}</p>
                  </div>
                  <StatusBadge status={summaryData?.tbArithmeticStatus || 'NOT_RUN'} />
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-validation-gl-drcr">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">GL DR = CR</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{summaryData?.glDrCrMessage || 'Journal debits equal credits'}</p>
                  </div>
                  <StatusBadge status={summaryData?.glDrCrStatus || 'NOT_RUN'} />
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-validation-tb-gl-tieout">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">TB-GL Tie-out</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{summaryData?.tbGlTieOutMessage || 'TB movement matches GL totals'}</p>
                  </div>
                  <StatusBadge status={summaryData?.tbGlTieOutStatus || 'NOT_RUN'} />
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-validation-tb-gl-totals" className={summaryData?.tbGlTotalsStatus === 'FAIL' ? 'border-red-500' : ''}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">TB↔GL Totals (DR/CR)</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {summaryData?.tbGlTotalsMessage || 'TB Total DR=GL DR and TB Total CR=GL CR'}
                    </p>
                    {summaryData?.tbGlTotalsStatus === 'FAIL' && (
                      <Badge variant="destructive" className="mt-1 text-xs">CRITICAL</Badge>
                    )}
                  </div>
                  <StatusBadge status={summaryData?.tbGlTotalsStatus || 'NOT_RUN'} />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <Card data-testid="card-count-tb">
              <CardContent className="py-4 text-center">
                <Database className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                <p className="text-2xl font-bold">{summaryData?.tbRowCount || 0}</p>
                <p className="text-xs text-muted-foreground">TB Rows</p>
                {dataSources.tb && <div className="mt-1.5 flex justify-center"><DataSourceBadgeInline source={dataSources.tb} /></div>}
              </CardContent>
            </Card>
            <Card data-testid="card-count-gl">
              <CardContent className="py-4 text-center">
                <FileText className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                <p className="text-2xl font-bold">{summaryData?.glEntryCount || 0}</p>
                <p className="text-xs text-muted-foreground">GL Entries</p>
                {dataSources.gl && <div className="mt-1.5 flex justify-center"><DataSourceBadgeInline source={dataSources.gl} /></div>}
              </CardContent>
            </Card>
            <Card data-testid="card-count-ap">
              <CardContent className="py-4 text-center">
                <Building2 className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                <p className="text-2xl font-bold">{summaryData?.apRowCount || 0}</p>
                <p className="text-xs text-muted-foreground">AP Rows</p>
                {dataSources.ap && <div className="mt-1.5 flex justify-center"><DataSourceBadgeInline source={dataSources.ap} /></div>}
              </CardContent>
            </Card>
            <Card data-testid="card-count-ar">
              <CardContent className="py-4 text-center">
                <Users className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                <p className="text-2xl font-bold">{summaryData?.arRowCount || 0}</p>
                <p className="text-xs text-muted-foreground">AR Rows</p>
                {dataSources.ar && <div className="mt-1.5 flex justify-center"><DataSourceBadgeInline source={dataSources.ar} /></div>}
              </CardContent>
            </Card>
            <Card data-testid="card-count-bank">
              <CardContent className="py-4 text-center">
                <Scale className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                <p className="text-2xl font-bold">{summaryData?.bankRowCount || 0}</p>
                <p className="text-xs text-muted-foreground">Bank Accounts</p>
                {dataSources.bank && <div className="mt-1.5 flex justify-center"><DataSourceBadgeInline source={dataSources.bank} /></div>}
              </CardContent>
            </Card>
            <Card data-testid="card-count-parties">
              <CardContent className="py-4 text-center">
                <Users className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                <p className="text-2xl font-bold">{summaryData?.partyCount || 0}</p>
                <p className="text-xs text-muted-foreground">Parties</p>
              </CardContent>
            </Card>
          </div>

          <Card data-testid="card-control-totals">
            <CardHeader className="py-3">
              <CardTitle className="text-base">Control Totals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">TB Opening Debits</p>
                  <p className="font-mono text-sm font-medium">{formatNumber(summaryData?.tbOpeningDebitTotal)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">TB Opening Credits</p>
                  <p className="font-mono text-sm font-medium">{formatNumber(summaryData?.tbOpeningCreditTotal)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">TB Closing Debits</p>
                  <p className="font-mono text-sm font-medium">{formatNumber(summaryData?.tbClosingDebitTotal)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">TB Closing Credits</p>
                  <p className="font-mono text-sm font-medium">{formatNumber(summaryData?.tbClosingCreditTotal)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">GL Total Debits</p>
                  <p className="font-mono text-sm font-medium">{formatNumber(summaryData?.glDebitTotal)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">GL Total Credits</p>
                  <p className="font-mono text-sm font-medium">{formatNumber(summaryData?.glCreditTotal)}</p>
                </div>
              </div>
              
              {/* TB vs GL Totals Comparison */}
              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-3">TB vs GL Totals Comparison</p>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">Type</TableHead>
                        <TableHead className="text-right">TB Total</TableHead>
                        <TableHead className="text-right">GL Total</TableHead>
                        <TableHead className="text-right">Difference (Δ)</TableHead>
                        <TableHead className="w-[80px] text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow data-testid="row-tb-gl-dr-comparison">
                        <TableCell className="font-medium">Debits</TableCell>
                        <TableCell className="text-right font-mono">{formatNumber(summaryData?.tbTotalDebit)}</TableCell>
                        <TableCell className="text-right font-mono">{formatNumber(summaryData?.glDebitTotal)}</TableCell>
                        <TableCell className={`text-right font-mono ${parseFloat(summaryData?.deltaDR || '0') !== 0 ? 'text-red-500 font-bold' : 'text-green-500'}`}>
                          {formatNumber(summaryData?.deltaDR)}
                        </TableCell>
                        <TableCell className="text-center">
                          {Math.abs(parseFloat(summaryData?.deltaDR || '0')) <= parseFloat(summaryData?.roundingTolerance || '1') ? (
                            <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                          )}
                        </TableCell>
                      </TableRow>
                      <TableRow data-testid="row-tb-gl-cr-comparison">
                        <TableCell className="font-medium">Credits</TableCell>
                        <TableCell className="text-right font-mono">{formatNumber(summaryData?.tbTotalCredit)}</TableCell>
                        <TableCell className="text-right font-mono">{formatNumber(summaryData?.glCreditTotal)}</TableCell>
                        <TableCell className={`text-right font-mono ${parseFloat(summaryData?.deltaCR || '0') !== 0 ? 'text-red-500 font-bold' : 'text-green-500'}`}>
                          {formatNumber(summaryData?.deltaCR)}
                        </TableCell>
                        <TableCell className="text-center">
                          {Math.abs(parseFloat(summaryData?.deltaCR || '0')) <= parseFloat(summaryData?.roundingTolerance || '1') ? (
                            <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                          )}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Tolerance: {formatNumber(summaryData?.roundingTolerance || '1')} | 
                  TB Total = Opening + Movement | 
                  PASS if |ΔDR| ≤ tolerance AND |ΔCR| ≤ tolerance
                </p>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-exceptions">
            <CardHeader className="py-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="text-base flex items-center gap-2">
                  Exceptions
                  {summaryData?.exceptions && summaryData.exceptions.length > 0 && (
                    <Badge variant="secondary">{summaryData.exceptions.length}</Badge>
                  )}
                </CardTitle>
                {summaryData?.exceptions && summaryData.exceptions.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {['ALL', 'CRITICAL', 'ERROR', 'WARNING', 'INFO'].map(sev => {
                      const count = sev === 'ALL' ? summaryData.exceptions!.length : summaryData.exceptions!.filter(e => e.severity === sev).length;
                      if (count === 0 && sev !== 'ALL') return null;
                      return (
                        <Badge
                          key={sev}
                          variant={exceptionFilter === sev ? "default" : "outline"}
                          className={`cursor-pointer text-xs ${sev !== 'ALL' ? severityColors[sev] || '' : ''}`}
                          onClick={() => setExceptionFilter(sev)}
                          data-testid={`filter-severity-${sev.toLowerCase()}`}
                        >
                          {sev === 'ALL' ? `All (${count})` : `${sev} (${count})`}
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {summaryData?.exceptions && summaryData.exceptions.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[80px]">Dataset</TableHead>
                        <TableHead className="w-[90px]">Severity</TableHead>
                        <TableHead className="w-[100px]">Account</TableHead>
                        <TableHead className="w-[150px]">Rule</TableHead>
                        <TableHead>Message</TableHead>
                        <TableHead className="w-[100px]">Row Ref</TableHead>
                        <TableHead className="w-[120px]">Expected</TableHead>
                        <TableHead className="w-[120px]">Actual</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summaryData.exceptions
                        .filter(e => exceptionFilter === 'ALL' || e.severity === exceptionFilter)
                        .map((exception, idx) => (
                        <TableRow key={exception.id || idx} data-testid={`row-exception-${idx}`}>
                          <TableCell>
                            <Badge variant="outline" className="text-xs font-mono">{exception.dataset}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={severityColors[exception.severity] || severityColors.INFO}>
                              {exception.severity}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{exception.glCode || '-'}</TableCell>
                          <TableCell className="font-mono text-xs">{exception.ruleCode}</TableCell>
                          <TableCell className="text-sm">{exception.message}</TableCell>
                          <TableCell className="font-mono text-xs">{exception.rowReference || '-'}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{exception.expectedValue || '-'}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{exception.actualValue || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  <CheckCircle className="h-8 w-8 mx-auto text-green-500 mb-2" />
                  <p>No exceptions found</p>
                </div>
              )}
            </CardContent>
          </Card>

          {Object.keys(tabGates).length > 0 && (
            <Card data-testid="card-workflow-readiness">
              <CardHeader className="py-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Workflow Readiness Gates
                </CardTitle>
                <CardDescription>Gate status across all workflow tabs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-3">
                  {WORKFLOW_TABS.map((tab) => {
                    const gates = tabGates[tab.key] || [];
                    const passCount = gates.filter(g => g.check === 'PASS').length;
                    const failCount = gates.filter(g => g.check === 'FAIL').length;
                    const warnCount = gates.filter(g => g.check === 'WARNING').length;
                    const notRunCount = gates.filter(g => g.check === 'NOT_RUN').length;
                    const allPass = gates.length > 0 && failCount === 0 && warnCount === 0 && notRunCount === 0;

                    return (
                      <div
                        key={tab.key}
                        className={`flex flex-col items-center p-2 rounded-md border text-center ${
                          allPass
                            ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/20'
                            : failCount > 0
                              ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/10'
                              : 'border-border'
                        } ${onNavigate ? 'cursor-pointer hover-elevate' : ''}`}
                        onClick={() => onNavigate?.(tab.key)}
                        data-testid={`gate-summary-${tab.key}`}
                      >
                        <p className="text-xs font-medium truncate w-full">{tab.label}</p>
                        {gates.length === 0 ? (
                          <span className="text-xs text-muted-foreground mt-1">-</span>
                        ) : (
                          <div className="flex items-center gap-1 mt-1 flex-wrap justify-center">
                            <GateCountBadge check="PASS" count={passCount} />
                            <GateCountBadge check="FAIL" count={failCount} />
                            <GateCountBadge check="WARNING" count={warnCount} />
                            <GateCountBadge check="NOT_RUN" count={notRunCount} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {hasSummary && (
            <Card data-testid="card-data-flow">
              <CardHeader className="py-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ArrowRight className="h-4 w-4" />
                  Data Flow
                </CardTitle>
                <CardDescription>How data flows through the workflow tabs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { key: 'upload', label: 'Upload', variant: 'secondary' as const },
                    { key: 'tb', label: 'TB', variant: 'outline' as const },
                    { key: 'gl', label: 'GL', variant: 'outline' as const },
                    { key: 'ap', label: 'AP', variant: 'outline' as const },
                    { key: 'ar', label: 'AR', variant: 'outline' as const },
                    { key: 'bank', label: 'BANK', variant: 'outline' as const },
                    { key: 'confirmations', label: 'Confirmations', variant: 'outline' as const },
                    { key: 'mapping', label: 'Mapping', variant: 'outline' as const },
                    { key: 'draft-fs', label: 'Draft FS', variant: 'outline' as const },
                    { key: null, label: 'Planning', variant: 'secondary' as const },
                  ].map((step, idx, arr) => (
                    <div key={step.label} className="flex items-center gap-1.5">
                      <Badge
                        variant={step.variant}
                        className={`no-default-hover-elevate ${step.key && onNavigate ? 'cursor-pointer' : ''}`}
                        onClick={() => step.key && onNavigate?.(step.key as WorkflowTabKey)}
                        data-testid={`flow-step-${step.label.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        {step.label}
                      </Badge>
                      {idx < arr.length - 1 && (
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {onNavigate && (
            <Card className="border-dashed" data-testid="card-quick-navigation">
              <CardHeader className="py-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <CardTitle className="text-base">Data Tabs Navigation</CardTitle>
                    <CardDescription>Click to review and edit imported data</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refetch()}
                      disabled={isLoading}
                      data-testid="button-refresh-summary"
                    >
                      <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  <Button
                    variant="outline"
                    onClick={() => onNavigate('tb')}
                    className="flex flex-col items-center justify-center h-auto py-3 px-2 hover-elevate"
                    data-testid="nav-to-tb"
                  >
                    <Database className="h-5 w-5 mb-1 text-blue-500" />
                    <span className="text-sm font-medium">Trial Balance</span>
                    <Badge variant="secondary" className="mt-1 text-xs">
                      {summaryData?.tbRowCount || 0} rows
                    </Badge>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => onNavigate('gl')}
                    className="flex flex-col items-center justify-center h-auto py-3 px-2 hover-elevate"
                    data-testid="nav-to-gl"
                  >
                    <FileText className="h-5 w-5 mb-1 text-purple-500" />
                    <span className="text-sm font-medium">General Ledger</span>
                    <Badge variant="secondary" className="mt-1 text-xs">
                      {summaryData?.glEntryCount || 0} entries
                    </Badge>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => onNavigate('ap')}
                    className="flex flex-col items-center justify-center h-auto py-3 px-2 hover-elevate"
                    data-testid="nav-to-ap"
                  >
                    <Building2 className="h-5 w-5 mb-1 text-orange-500" />
                    <span className="text-sm font-medium">AP (Creditors)</span>
                    <Badge variant="secondary" className="mt-1 text-xs">
                      {summaryData?.apRowCount || 0} items
                    </Badge>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => onNavigate('ar')}
                    className="flex flex-col items-center justify-center h-auto py-3 px-2 hover-elevate"
                    data-testid="nav-to-ar"
                  >
                    <Users className="h-5 w-5 mb-1 text-green-500" />
                    <span className="text-sm font-medium">AR (Debtors)</span>
                    <Badge variant="secondary" className="mt-1 text-xs">
                      {summaryData?.arRowCount || 0} items
                    </Badge>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => onNavigate('bank')}
                    className="flex flex-col items-center justify-center h-auto py-3 px-2 hover-elevate"
                    data-testid="nav-to-bank"
                  >
                    <Scale className="h-5 w-5 mb-1 text-cyan-500" />
                    <span className="text-sm font-medium">Bank Accounts</span>
                    <Badge variant="secondary" className="mt-1 text-xs">
                      {summaryData?.bankRowCount || 0} accounts
                    </Badge>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => onNavigate('confirmations')}
                    className="flex flex-col items-center justify-center h-auto py-3 px-2 hover-elevate"
                    data-testid="nav-to-confirmations"
                  >
                    <CheckCircle className="h-5 w-5 mb-1 text-indigo-500" />
                    <span className="text-sm font-medium">Confirmations</span>
                    <Badge variant="secondary" className="mt-1 text-xs">
                      {summaryData?.partyCount || 0} parties
                    </Badge>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {onNavigate && (
            <div className="flex items-center justify-between pt-2 border-t" data-testid="nav-footer">
              <div className="text-sm text-muted-foreground">
                Summary is the starting point of the data import workflow
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => onNavigate('draft-fs')}
                  data-testid="button-skip-to-fs"
                >
                  Skip to Draft FS
                  <ChevronRight className="h-4 w-4" />
                  <ChevronRight className="h-4 w-4 -ml-2" />
                </Button>
                <Button
                  onClick={() => onNavigate('tb')}
                  data-testid="button-next-tb"
                >
                  Next: Trial Balance
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
