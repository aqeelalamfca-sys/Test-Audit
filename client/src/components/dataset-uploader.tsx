import { useState, useCallback, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Upload, Loader2, CheckCircle2, AlertCircle, X, XCircle, FileSpreadsheet, Database, Building2, Users, Scale, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getAuthToken } from "@/lib/auth";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { apiRequest } from "@/lib/queryClient";

type DatasetType = 'tb' | 'gl' | 'ap' | 'ar' | 'bank';

const DATASET_CONFIG: Record<DatasetType, { label: string; icon: typeof FileSpreadsheet; sheetHint: string; color: string }> = {
  tb: { label: 'Trial Balance', icon: FileSpreadsheet, sheetHint: 'Trial Balance', color: 'text-blue-600 dark:text-blue-400' },
  gl: { label: 'General Ledger', icon: Database, sheetHint: 'GL', color: 'text-purple-600 dark:text-purple-400' },
  ap: { label: 'Accounts Payable', icon: Building2, sheetHint: 'Accounts Payable', color: 'text-orange-600 dark:text-orange-400' },
  ar: { label: 'Accounts Receivable', icon: Users, sheetHint: 'Accounts Receivable', color: 'text-green-600 dark:text-green-400' },
  bank: { label: 'Bank', icon: Scale, sheetHint: 'Bank', color: 'text-teal-600 dark:text-teal-400' },
};

interface DatasetUploaderProps {
  engagementId: string;
  datasetType: DatasetType;
  compact?: boolean;
  onUploadComplete?: () => void;
  onNavigateToTab?: (tab: string) => void;
}

export function DatasetUploader({ engagementId, datasetType, compact = false, onUploadComplete, onNavigateToTab }: DatasetUploaderProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragActive, setIsDragActive] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedRowCount, setUploadedRowCount] = useState<number | null>(null);

  const config = DATASET_CONFIG[datasetType];
  const Icon = config.icon;

  const validateFile = useCallback((file: File): string | null => {
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) return 'File too large (max 50MB)';
    const ext = file.name.toLowerCase().split('.').pop();
    if (!['xlsx', 'xls'].includes(ext || '')) return 'Only Excel files (.xlsx, .xls) are supported';
    return null;
  }, []);

  const handleFile = useCallback((file: File) => {
    setFileError(null);
    const error = validateFile(file);
    if (error) {
      setFileError(error);
      setSelectedFile(null);
    } else {
      setSelectedFile(file);
    }
  }, [validateFile]);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;

        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            setUploadProgress(Math.round((event.loaded / event.total) * 100));
          }
        });

        xhr.addEventListener('load', () => {
          xhrRef.current = null;
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch {
              resolve({ success: true });
            }
          } else {
            try {
              const errorData = JSON.parse(xhr.responseText);
              reject(new Error(errorData.error || 'Upload failed'));
            } catch {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          }
        });

        xhr.addEventListener('error', () => { xhrRef.current = null; reject(new Error('Network error')); });
        xhr.addEventListener('abort', () => { xhrRef.current = null; reject(new Error('Upload cancelled')); });

        const formData = new FormData();
        formData.append('file', file);

        xhr.open('POST', `/api/import/${engagementId}/upload-dataset/${datasetType}`);
        xhr.timeout = 300000;
        xhr.withCredentials = true;

        const token = getAuthToken();
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

        try {
          const activeClientId = localStorage.getItem('activeClientId');
          const activePeriodId = localStorage.getItem('activePeriodId');
          if (activeClientId) xhr.setRequestHeader('X-Active-Client-Id', activeClientId);
          if (activePeriodId) xhr.setRequestHeader('X-Active-Period-Id', activePeriodId);
        } catch {}

        xhr.send(formData);
      });
    },
    onMutate: () => setUploadProgress(0),
    onSuccess: (data: any) => {
      const fileName = selectedFile?.name || '';
      const rowCount = data?.totalRows || data?.rowCount || data?.count || null;
      toast({
        title: `${config.label} Uploaded`,
        description: data?.message || `${config.label} data imported successfully.`,
      });
      setSelectedFile(null);
      setUploadProgress(0);
      setUploadedFileName(fileName);
      setUploadedRowCount(rowCount);
      queryClient.invalidateQueries({ queryKey: ['/api/engagements', engagementId] });
      queryClient.invalidateQueries({ queryKey: ['/api/import'] });
      onUploadComplete?.();
    },
    onError: (error: Error) => {
      toast({
        title: 'Upload Failed',
        description: error.message,
        variant: 'destructive',
      });
      setUploadProgress(0);
    },
  });

  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);

  const handleDownloadDatasetTemplate = useCallback(async () => {
    setIsDownloadingTemplate(true);
    try {
      const response = await fetchWithAuth(`/api/import/template/${datasetType}`, { timeout: 60000 });
      if (!response.ok) throw new Error('Failed to download template');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AuditWise_${config.label.replace(/\s+/g, '_')}_Template.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: 'Template Downloaded', description: `${config.label} template downloaded.` });
    } catch {
      toast({ title: 'Download Failed', description: 'Could not download template.', variant: 'destructive' });
    } finally {
      setIsDownloadingTemplate(false);
    }
  }, [datasetType, config.label, toast]);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragActive(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragActive(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  if (compact) {
    return (
      <div className="flex items-center gap-2 flex-wrap" data-testid={`uploader-compact-${datasetType}`}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          data-testid={`input-file-${datasetType}`}
        />
        {selectedFile ? (
          <>
            <Badge variant="outline" className="gap-1 text-xs max-w-[200px] truncate">
              <Icon className="h-3 w-3 shrink-0" />
              {selectedFile.name}
            </Badge>
            <Button
              size="sm"
              onClick={() => uploadMutation.mutate(selectedFile)}
              disabled={uploadMutation.isPending}
              data-testid={`button-upload-${datasetType}`}
            >
              {uploadMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
              Upload
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setSelectedFile(null)} data-testid={`button-clear-${datasetType}`}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : uploadedFileName ? (
          <>
            <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
            <span className="text-xs text-green-600 dark:text-green-400 font-medium">Uploaded: {uploadedFileName}</span>
            <Button size="sm" variant="outline" onClick={() => { setUploadedFileName(null); setUploadedRowCount(null); fileInputRef.current?.click(); }} data-testid={`button-reupload-${datasetType}`}>
              <Upload className="h-3.5 w-3.5 mr-1" />
              Re-upload
            </Button>
          </>
        ) : (
          <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} data-testid={`button-browse-${datasetType}`}>
            <Upload className="h-3.5 w-3.5 mr-1" />
            Upload {config.label}
          </Button>
        )}
        {uploadMutation.isPending && <Progress value={uploadProgress} className="h-1.5 w-24" />}
        {fileError && <span className="text-xs text-destructive">{fileError}</span>}
      </div>
    );
  }

  return (
    <Card
      className={`transition-colors ${isDragActive ? 'border-primary/60 bg-primary/5' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-testid={`uploader-card-${datasetType}`}
    >
      <CardContent className="py-4">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          data-testid={`input-file-${datasetType}`}
        />
        <div className="flex items-center gap-3 flex-wrap">
          <div className={`flex items-center gap-2 min-w-[140px] ${config.color}`}>
            <Icon className="h-5 w-5" />
            <span className="text-sm font-medium">{config.label}</span>
          </div>

          {uploadMutation.isPending ? (
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Progress value={uploadProgress} className="h-2 flex-1" />
              <span className="text-xs text-muted-foreground whitespace-nowrap">{uploadProgress}%</span>
            </div>
          ) : selectedFile ? (
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="gap-1 text-xs max-w-[250px] truncate">
                {selectedFile.name}
                <span className="text-muted-foreground">({(selectedFile.size / 1024).toFixed(0)} KB)</span>
              </Badge>
              <Button size="sm" onClick={() => uploadMutation.mutate(selectedFile)} data-testid={`button-upload-${datasetType}`}>
                <Upload className="h-3.5 w-3.5 mr-1" />
                Upload
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setSelectedFile(null)} data-testid={`button-clear-${datasetType}`}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : uploadedFileName ? (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm font-medium">Uploaded</span>
              </div>
              <Badge variant="secondary" className="gap-1 text-xs no-default-hover-elevate">
                {uploadedFileName}
                {uploadedRowCount ? <span className="text-muted-foreground">({uploadedRowCount} rows)</span> : null}
              </Badge>
              <Button size="sm" variant="outline" onClick={() => { setUploadedFileName(null); setUploadedRowCount(null); fileInputRef.current?.click(); }} data-testid={`button-reupload-${datasetType}`}>
                <Upload className="h-3.5 w-3.5 mr-1" />
                Re-upload
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} data-testid={`button-browse-${datasetType}`}>
                <Upload className="h-3.5 w-3.5 mr-1" />
                Browse or drop file
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDownloadDatasetTemplate} disabled={isDownloadingTemplate} data-testid={`button-template-${datasetType}`}>
                {isDownloadingTemplate ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                Template
              </Button>
              <span className="text-xs text-muted-foreground">Sheets: {config.sheetHint}</span>
            </div>
          )}

          {fileError && (
            <div className="flex items-center gap-1 text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />
              <span className="text-xs">{fileError}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface ValidateResult {
  id: string;
  label: string;
  passed: boolean;
  applicable: boolean;
  details?: string;
  glCodeRecon?: {
    tbCodes: string[];
    glCodes: string[];
    unmatchedInTb: string[];
    unmatchedInGl: string[];
    amountMismatches: { code: string; tbAmount: number; glAmount: number; difference: number }[];
    duplicateGlCodes: string[];
    isReconciled: boolean;
  };
}

interface ValidatePushResponse {
  validated: boolean;
  pushed: boolean;
  noDataYet?: boolean;
  results: ValidateResult[];
  errors?: string[];
}

interface DatasetUploadPanelProps {
  engagementId: string;
  onUploadComplete?: () => void;
  onDownloadTemplate?: () => void;
  onNavigateToTab?: (tab: string) => void;
}

export function DatasetUploadPanel({ engagementId, onUploadComplete, onDownloadTemplate, onNavigateToTab }: DatasetUploadPanelProps) {
  const { toast } = useToast();
  const [showValidationDialog, setShowValidationDialog] = useState(false);
  const [validationData, setValidationData] = useState<ValidatePushResponse | null>(null);

  const validateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/validate-push/${engagementId}`);
      return res.json() as Promise<ValidatePushResponse>;
    },
    onSuccess: (data) => {
      setValidationData(data);
      setShowValidationDialog(true);
      if (data.validated) {
        toast({ title: "Validation Passed", description: "All checks passed successfully." });
      } else if (data.noDataYet) {
        toast({ title: "No Data Uploaded", description: "Upload TB and GL data first, then validate." });
      } else {
        toast({ title: "Validation Failed", description: "Some checks did not pass.", variant: "destructive" });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Validation Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-2" data-testid="panel-dataset-uploads">
      {(['tb', 'gl', 'ap', 'ar', 'bank'] as DatasetType[]).map(dt => (
        <DatasetUploader key={dt} engagementId={engagementId} datasetType={dt} onUploadComplete={onUploadComplete} onNavigateToTab={onNavigateToTab} />
      ))}
      <div className="flex items-center gap-2 pt-2 border-t border-border flex-wrap">
        <Button
          size="sm"
          onClick={() => validateMutation.mutate()}
          disabled={validateMutation.isPending}
          data-testid="button-validate-push"
        >
          {validateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
          Validate & Push
        </Button>
      </div>

      <Dialog open={showValidationDialog} onOpenChange={setShowValidationDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col" data-testid="dialog-validation-results">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              {validationData?.validated ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              ) : validationData?.noDataYet ? (
                <AlertCircle className="h-5 w-5 text-muted-foreground" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              )}
              {validationData?.validated ? "Validation Passed" : validationData?.noDataYet ? "Data Not Yet Uploaded" : "Validation Failed"}
            </DialogTitle>
          </DialogHeader>

          {validationData && (
            <div className="space-y-3 mt-2 overflow-y-auto pr-1">
              {validationData.noDataYet && (
                <div className="rounded-md bg-muted/50 p-3 text-center">
                  <p className="text-sm text-muted-foreground">Upload Trial Balance and General Ledger data above, then click Validate & Push to run checks.</p>
                </div>
              )}
              {validationData.results.map((result) => (
                <div
                  key={result.id}
                  className={`rounded-md p-3 ${
                    !result.applicable
                      ? "bg-muted/30"
                      : result.passed
                      ? "bg-green-50 dark:bg-green-950/20"
                      : "bg-red-50 dark:bg-red-950/20"
                  }`}
                  data-testid={`validation-result-${result.id}`}
                >
                  <div className="flex items-center gap-2">
                    {!result.applicable ? (
                      <AlertCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    ) : result.passed ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                    )}
                    <span className="text-sm font-medium">{result.label}</span>
                  </div>
                  {result.details && (
                    <p className="text-xs text-muted-foreground mt-1 ml-6">{result.details}</p>
                  )}
                  {result.glCodeRecon && !result.passed && result.applicable && (
                    <div className="mt-2 ml-6 space-y-2 text-xs text-muted-foreground">
                      {result.glCodeRecon.unmatchedInTb.length > 0 && (
                        <div data-testid="text-unmatched-tb">
                          <p className="font-medium mb-1">Codes in TB but not GL ({result.glCodeRecon.unmatchedInTb.length}):</p>
                          <div className="flex flex-wrap gap-1">
                            {result.glCodeRecon.unmatchedInTb.map((code) => (
                              <Badge key={code} variant="outline" className="text-xs no-default-hover-elevate">{code}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {result.glCodeRecon.unmatchedInGl.length > 0 && (
                        <div data-testid="text-unmatched-gl">
                          <p className="font-medium mb-1">Codes in GL but not TB ({result.glCodeRecon.unmatchedInGl.length}):</p>
                          <div className="flex flex-wrap gap-1">
                            {result.glCodeRecon.unmatchedInGl.map((code) => (
                              <Badge key={code} variant="outline" className="text-xs no-default-hover-elevate">{code}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {result.glCodeRecon.amountMismatches.length > 0 && (
                        <div data-testid="text-amount-mismatches">
                          <p className="font-medium mb-1">Amount mismatches ({result.glCodeRecon.amountMismatches.length}):</p>
                          <div className="border border-border rounded-md overflow-hidden">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-muted/50">
                                  <th className="text-left px-2 py-1 font-medium">Code</th>
                                  <th className="text-right px-2 py-1 font-medium">TB Amount</th>
                                  <th className="text-right px-2 py-1 font-medium">GL Amount</th>
                                  <th className="text-right px-2 py-1 font-medium">Difference</th>
                                </tr>
                              </thead>
                              <tbody>
                                {result.glCodeRecon.amountMismatches.map((m) => (
                                  <tr key={m.code} className="border-t border-border">
                                    <td className="px-2 py-1 font-mono">{m.code}</td>
                                    <td className="text-right px-2 py-1 font-mono">{m.tbAmount.toLocaleString()}</td>
                                    <td className="text-right px-2 py-1 font-mono">{m.glAmount.toLocaleString()}</td>
                                    <td className={`text-right px-2 py-1 font-mono ${m.difference !== 0 ? "text-red-600 dark:text-red-400 font-medium" : ""}`}>{m.difference.toLocaleString()}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                      {result.glCodeRecon.duplicateGlCodes.length > 0 && (
                        <div data-testid="text-duplicate-codes">
                          <p className="font-medium mb-1">Duplicate codes in TB ({result.glCodeRecon.duplicateGlCodes.length}):</p>
                          <div className="flex flex-wrap gap-1">
                            {result.glCodeRecon.duplicateGlCodes.map((code) => (
                              <Badge key={code} variant="outline" className="text-xs no-default-hover-elevate bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700">{code}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {validationData.validated && validationData.pushed && (
                <div className="rounded-md bg-green-50 dark:bg-green-950/20 p-3 text-center">
                  <p className="text-sm font-medium text-green-700 dark:text-green-300">Data successfully validated and pushed</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
