import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useEngagement } from "@/lib/workspace-context";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Download, Upload, FileSpreadsheet, CheckCircle2, Clock, AlertTriangle,
  ArrowLeft, ArrowRight, Shield, Lock, Send, Check, X, RefreshCw,
  FileCheck, AlertCircle, Eye, Database, Users, Loader2
} from "lucide-react";
import { formatAccounting } from '@/lib/formatters';


type ImportBatchStatus = 
  | "UPLOADED" 
  | "VALIDATING" 
  | "READY" 
  | "SUBMITTED" 
  | "APPROVED" 
  | "REJECTED"
  | "POSTED" 
  | "LOCKED";

interface ImportBatchStats {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errorCount: number;
  warningCount: number;
  recordTypeCounts: Record<string, number>;
}

interface ImportBatch {
  id: string;
  engagementId: string;
  status: ImportBatchStatus;
  fileName: string;
  fileSize: number;
  createdAt: string;
  updatedAt: string;
  uploadedById: string;
  validatedById?: string;
  submittedById?: string;
  approvedById?: string;
  rejectedById?: string;
  postedById?: string;
  lockedById?: string;
  validatedAt?: string;
  submittedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  postedAt?: string;
  lockedAt?: string;
  rejectionReason?: string;
  stagingRows?: ImportStagingRow[];
  issues?: ImportIssue[];
  stats?: ImportBatchStats;
}

interface ImportStagingRow {
  id: string;
  batchId: string;
  sheetName: string;
  rowNumber: number;
  recordType: string;
  parsedData: Record<string, any>;
  isValid: boolean;
}

interface ImportIssue {
  id: string;
  batchId: string;
  stagingRowId?: string;
  rowNumber?: number;
  field?: string;
  issueType: string;
  severity: string;
  message: string;
  resolvedAt?: string;
}

const STATUS_STEPS: { status: ImportBatchStatus; label: string; icon: any }[] = [
  { status: "UPLOADED", label: "Upload", icon: Upload },
  { status: "VALIDATING", label: "Validating", icon: RefreshCw },
  { status: "READY", label: "Ready", icon: FileCheck },
  { status: "SUBMITTED", label: "Submitted", icon: Send },
  { status: "APPROVED", label: "Approved", icon: Check },
  { status: "POSTED", label: "Posted", icon: Database },
  { status: "LOCKED", label: "Locked", icon: Lock },
];

const STATUS_ORDER: ImportBatchStatus[] = ["UPLOADED", "VALIDATING", "READY", "SUBMITTED", "APPROVED", "POSTED", "LOCKED"];

function getStatusBadgeVariant(status: ImportBatchStatus): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "LOCKED":
    case "POSTED":
    case "APPROVED":
      return "default";
    case "READY":
    case "SUBMITTED":
      return "secondary";
    case "REJECTED":
      return "destructive";
    default:
      return "outline";
  }
}

function getStepProgress(status: ImportBatchStatus): number {
  if (status === "REJECTED") return STATUS_ORDER.indexOf("SUBMITTED") + 1;
  const idx = STATUS_ORDER.indexOf(status);
  return idx >= 0 ? idx + 1 : 0;
}

export default function ImportWizard() {
  const params = useParams<{ engagementId: string }>();
  const { engagementId: contextEngagementId, engagement, client } = useEngagement();
  const engagementId = params.engagementId || contextEngagementId || undefined;
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<"batches" | "upload">("batches");

  const { data: batches = [], isLoading: batchesLoading, refetch: refetchBatches } = useQuery<ImportBatch[]>({
    queryKey: [`/api/import/${engagementId}/batches`],
    enabled: !!engagementId,
  });

  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  const { data: batchDetail, isLoading: batchDetailLoading } = useQuery<ImportBatch>({
    queryKey: [`/api/import/${engagementId}/batches/${selectedBatchId}`],
    enabled: !!engagementId && !!selectedBatchId,
  });

  interface ConfirmationCandidate {
    id: string;
    type: string;
    partyCode?: string;
    partyName?: string;
    partyType?: string;
    email?: string;
    phone?: string;
    controlAccount?: string;
    closingDebit?: number;
    closingCredit?: number;
    balance?: number;
    hasContactInfo?: boolean;
    bankAccountId?: string;
    bankName?: string;
    branch?: string;
    accountNumber?: string;
    accountType?: string;
    glAccount?: string;
    currency?: string;
  }

  interface ConfirmationCandidatesResponse {
    partyConfirmations: ConfirmationCandidate[];
    bankConfirmations: ConfirmationCandidate[];
    summary: {
      arConfirmations: number;
      apConfirmations: number;
      bankConfirmations: number;
      totalConfirmations: number;
      withContactInfo: number;
      missingContactInfo: number;
    };
  }

  const { data: confirmationCandidates } = useQuery<ConfirmationCandidatesResponse>({
    queryKey: [`/api/import/${engagementId}/batches/${selectedBatchId}/confirmation-candidates`],
    enabled: !!engagementId && !!selectedBatchId && batchDetail?.status === 'POSTED',
  });

  const validateMutation = useMutation({
    mutationFn: async (batchId: string) => {
      return apiRequest("POST", `/api/import/${engagementId}/batches/${batchId}/validate`);
    },
    onSuccess: () => {
      toast({ title: "Validation complete", description: "Batch has been validated." });
      refetchBatches();
      queryClient.invalidateQueries({ queryKey: [`/api/import/${engagementId}/batches/${selectedBatchId}`] });
    },
    onError: (err: any) => {
      toast({ title: "Validation failed", description: err.message, variant: "destructive" });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (batchId: string) => {
      return apiRequest("POST", `/api/import/${engagementId}/batches/${batchId}/submit`);
    },
    onSuccess: () => {
      toast({ title: "Submitted for approval", description: "Batch is awaiting approval." });
      refetchBatches();
      queryClient.invalidateQueries({ queryKey: [`/api/import/${engagementId}/batches/${selectedBatchId}`] });
    },
    onError: (err: any) => {
      toast({ title: "Submit failed", description: err.message, variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (batchId: string) => {
      return apiRequest("POST", `/api/import/${engagementId}/batches/${batchId}/approve`);
    },
    onSuccess: () => {
      toast({ title: "Approved", description: "Batch has been approved." });
      refetchBatches();
      queryClient.invalidateQueries({ queryKey: [`/api/import/${engagementId}/batches/${selectedBatchId}`] });
    },
    onError: (err: any) => {
      toast({ title: "Approval failed", description: err.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ batchId, reason }: { batchId: string; reason: string }) => {
      return apiRequest("POST", `/api/import/${engagementId}/batches/${batchId}/reject`, { reason });
    },
    onSuccess: () => {
      toast({ title: "Rejected", description: "Batch has been rejected." });
      refetchBatches();
      queryClient.invalidateQueries({ queryKey: [`/api/import/${engagementId}/batches/${selectedBatchId}`] });
    },
    onError: (err: any) => {
      toast({ title: "Rejection failed", description: err.message, variant: "destructive" });
    },
  });

  const postMutation = useMutation({
    mutationFn: async (batchId: string) => {
      return apiRequest("POST", `/api/import/${engagementId}/batches/${batchId}/post`);
    },
    onSuccess: () => {
      toast({ title: "Posted", description: "Data has been posted to final tables." });
      refetchBatches();
      queryClient.invalidateQueries({ queryKey: [`/api/import/${engagementId}/batches/${selectedBatchId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", engagementId, "data-intake-status"] });
    },
    onError: (err: any) => {
      toast({ title: "Post failed", description: err.message, variant: "destructive" });
    },
  });

  const lockMutation = useMutation({
    mutationFn: async (batchId: string) => {
      return apiRequest("POST", `/api/import/${engagementId}/batches/${batchId}/lock`);
    },
    onSuccess: () => {
      toast({ title: "Locked", description: "Batch has been locked." });
      refetchBatches();
      queryClient.invalidateQueries({ queryKey: [`/api/import/${engagementId}/batches/${selectedBatchId}`] });
    },
    onError: (err: any) => {
      toast({ title: "Lock failed", description: err.message, variant: "destructive" });
    },
  });

  const handleDownloadTemplate = async () => {
    try {
      const res = await fetchWithAuth("/api/templates/download/single-file-import-template");
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "single-file-import-template.xlsx";
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Template downloaded", description: "Fill in the sheets and upload." });
    } catch (err: any) {
      toast({ title: "Download failed", description: err.message, variant: "destructive" });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !engagementId) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetchWithAuth(`/api/import/${engagementId}/upload`, {
        method: "POST",
        body: formData,
        timeout: 120000,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Upload failed");
      }

      const data = await res.json();
      toast({ title: "File uploaded", description: `Batch created with ${data.totalRows || 0} rows.` });
      refetchBatches();
      setSelectedBatchId(data.batchId);
      setActiveTab("batches");
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const currentBatch = batchDetail || batches.find((b) => b.id === selectedBatchId);
  const stepProgress = currentBatch ? getStepProgress(currentBatch.status) : 0;
  const totalSteps = STATUS_ORDER.length;

  const renderBatchActions = (batch: ImportBatch) => {
    const isPending = validateMutation.isPending || submitMutation.isPending || approveMutation.isPending || rejectMutation.isPending || postMutation.isPending || lockMutation.isPending;

    return (
      <div className="flex flex-wrap gap-2 items-center">
        {batch.status === "UPLOADED" && (
          <Button 
            size="sm" 
            onClick={() => validateMutation.mutate(batch.id)} 
            disabled={isPending}
            data-testid="button-validate"
          >
            {validateMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
            Validate
          </Button>
        )}
        {batch.status === "READY" && (batch.stats?.invalidRows || 0) === 0 && (
          <Button 
            size="sm" 
            onClick={() => submitMutation.mutate(batch.id)} 
            disabled={isPending}
            data-testid="button-submit"
          >
            {submitMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
            Submit for Approval
          </Button>
        )}
        {batch.status === "SUBMITTED" && (
          <>
            <Button 
              size="sm" 
              variant="default" 
              onClick={() => approveMutation.mutate(batch.id)} 
              disabled={isPending}
              data-testid="button-approve"
            >
              {approveMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
              Approve
            </Button>
            <Button 
              size="sm" 
              variant="destructive" 
              onClick={() => {
                const reason = prompt("Enter rejection reason:");
                if (reason) rejectMutation.mutate({ batchId: batch.id, reason });
              }} 
              disabled={isPending}
              data-testid="button-reject"
            >
              {rejectMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <X className="w-4 h-4 mr-1" />}
              Reject
            </Button>
          </>
        )}
        {batch.status === "APPROVED" && (
          <Button 
            size="sm" 
            onClick={() => postMutation.mutate(batch.id)} 
            disabled={isPending}
            data-testid="button-post"
          >
            {postMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Database className="w-4 h-4 mr-1" />}
            Post to Tables
          </Button>
        )}
        {batch.status === "POSTED" && (
          <Button 
            size="sm" 
            onClick={() => lockMutation.mutate(batch.id)} 
            disabled={isPending}
            data-testid="button-lock"
          >
            {lockMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Lock className="w-4 h-4 mr-1" />}
            Lock Batch
          </Button>
        )}
        {batch.status === "LOCKED" && (
          <Badge variant="default" className="bg-green-600">
            <Lock className="w-3 h-3 mr-1" /> Locked
          </Badge>
        )}
        {batch.status === "REJECTED" && (
          <Badge variant="destructive">
            <X className="w-3 h-3 mr-1" /> Rejected
          </Badge>
        )}
      </div>
    );
  };

  const issuesBySeverity = (issues: ImportIssue[] = []) => ({
    error: issues.filter((i) => i.severity === "ERROR"),
    warning: issues.filter((i) => i.severity === "WARNING"),
    info: issues.filter((i) => i.severity === "INFO"),
  });

  return (
    <div className="space-y-0">
    <div className="p-2.5 md:p-2.5 space-y-2.5">
      <div className="flex items-center gap-2.5">
        <Link href={`/workspace/${engagementId}/planning`} data-testid="link-back">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">Single-File Import Wizard</h1>
          <p className="text-sm text-muted-foreground">
            Upload GL journals, account/party balances, bank accounts in one Excel file
          </p>
        </div>
        {engagement && (
          <Badge variant="outline">{engagement.engagementCode}</Badge>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList>
          <TabsTrigger value="batches" data-testid="tab-batches">Import Batches</TabsTrigger>
          <TabsTrigger value="upload" data-testid="tab-upload">Upload New File</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-2.5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5" />
                Download Template & Upload
              </CardTitle>
              <CardDescription>
                Download the Excel template with 7 sheets, fill in your data, then upload
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <div className="grid md:grid-cols-2 gap-2.5">
                <Card className="p-2.5 border-dashed">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <Download className="w-10 h-10 text-primary" />
                    <div>
                      <p className="font-medium">Step 1: Download Template</p>
                      <p className="text-sm text-muted-foreground">
                        Get the Excel file with all required sheets
                      </p>
                    </div>
                    <Button onClick={handleDownloadTemplate} data-testid="button-download-template">
                      <Download className="w-4 h-4 mr-1" /> Download Template
                    </Button>
                  </div>
                </Card>

                <Card className="p-2.5 border-dashed">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <Upload className="w-10 h-10 text-primary" />
                    <div>
                      <p className="font-medium">Step 2: Upload Filled File</p>
                      <p className="text-sm text-muted-foreground">
                        Upload your completed Excel file
                      </p>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={handleFileUpload}
                      data-testid="input-file-upload"
                    />
                    <Button 
                      onClick={() => fileInputRef.current?.click()} 
                      disabled={isUploading}
                      data-testid="button-upload-file"
                    >
                      {isUploading ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4 mr-1" />
                      )}
                      {isUploading ? "Uploading..." : "Upload File"}
                    </Button>
                  </div>
                </Card>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="font-medium">Template Sheets</h4>
                <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 text-sm">
                  <Badge variant="outline">1. GL_Journal_Lines</Badge>
                  <Badge variant="outline">2. Account_Opening_Balances</Badge>
                  <Badge variant="outline">3. Account_Closing_Balances</Badge>
                  <Badge variant="outline">4. Party_Opening_Balances</Badge>
                  <Badge variant="outline">5. Party_Closing_Balances</Badge>
                  <Badge variant="outline">6. Bank_Accounts</Badge>
                  <Badge variant="outline">7. Bank_Closing_Balances</Badge>
                </div>
              </div>

              <Alert>
                <Shield className="w-4 h-4" />
                <AlertTitle>Maker-Checker Workflow</AlertTitle>
                <AlertDescription>
                  After upload, the batch goes through validation, submission, approval, and posting stages.
                  Different users must perform each step to ensure segregation of duties.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="batches" className="space-y-2.5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="w-5 h-5" />
                Import Batches
              </CardTitle>
              <CardDescription>
                View and manage your import batches
              </CardDescription>
            </CardHeader>
            <CardContent>
              {batchesLoading ? (
                <div className="flex items-center justify-center py-2">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : batches.length === 0 ? (
                <div className="text-center py-2 text-muted-foreground">
                  <FileSpreadsheet className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No import batches yet. Upload a file to get started.</p>
                  <Button 
                    variant="ghost" 
                    onClick={() => setActiveTab("upload")}
                    data-testid="button-go-to-upload"
                  >
                    Go to Upload
                  </Button>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>File Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Rows</TableHead>
                        <TableHead className="text-right">Valid</TableHead>
                        <TableHead className="text-right">Invalid</TableHead>
                        <TableHead>Uploaded</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {batches.map((batch) => (
                        <TableRow 
                          key={batch.id} 
                          className={selectedBatchId === batch.id ? "bg-muted/50" : ""}
                          onClick={() => setSelectedBatchId(batch.id)}
                          data-testid={`row-batch-${batch.id}`}
                        >
                          <TableCell className="font-medium">{batch.fileName}</TableCell>
                          <TableCell>
                            <Badge variant={getStatusBadgeVariant(batch.status)}>
                              {batch.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{batch.stats?.totalRows || 0}</TableCell>
                          <TableCell className="text-right text-green-600">{batch.stats?.validRows || 0}</TableCell>
                          <TableCell className="text-right text-red-600">{batch.stats?.invalidRows || 0}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(batch.createdAt).toLocaleString()}
                          </TableCell>
                          <TableCell>{renderBatchActions(batch)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {currentBatch && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Batch Details: {currentBatch.fileName}</CardTitle>
                    <CardDescription>
                      Status: {currentBatch.status} | {currentBatch.stats?.totalRows || 0} total rows
                    </CardDescription>
                  </div>
                  <Badge variant={getStatusBadgeVariant(currentBatch.status)} className="text-sm">
                    {currentBatch.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2.5">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span>{stepProgress} of {totalSteps} steps</span>
                  </div>
                  <Progress value={(stepProgress / totalSteps) * 100} />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    {STATUS_STEPS.map((step, idx) => {
                      const Icon = step.icon;
                      const isActive = currentBatch.status === step.status;
                      const isPast = STATUS_ORDER.indexOf(currentBatch.status) > STATUS_ORDER.indexOf(step.status);
                      return (
                        <div 
                          key={step.status} 
                          className={`flex flex-col items-center ${
                            isActive ? "text-primary font-medium" : isPast ? "text-green-600" : ""
                          }`}
                        >
                          <Icon className={`w-4 h-4 ${isPast ? "text-green-600" : ""}`} />
                          <span>{step.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Separator />

                {currentBatch.rejectionReason && (
                  <Alert variant="destructive">
                    <AlertCircle className="w-4 h-4" />
                    <AlertTitle>Rejection Reason</AlertTitle>
                    <AlertDescription>{currentBatch.rejectionReason}</AlertDescription>
                  </Alert>
                )}

                {batchDetail?.issues && batchDetail.issues.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" /> Validation Issues ({batchDetail.issues.length})
                    </h4>
                    <div className="flex gap-2">
                      {issuesBySeverity(batchDetail.issues).error.length > 0 && (
                        <Badge variant="destructive">
                          {issuesBySeverity(batchDetail.issues).error.length} Errors
                        </Badge>
                      )}
                      {issuesBySeverity(batchDetail.issues).warning.length > 0 && (
                        <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                          {issuesBySeverity(batchDetail.issues).warning.length} Warnings
                        </Badge>
                      )}
                      {issuesBySeverity(batchDetail.issues).info.length > 0 && (
                        <Badge variant="outline">
                          {issuesBySeverity(batchDetail.issues).info.length} Info
                        </Badge>
                      )}
                    </div>
                    <ScrollArea className="h-[200px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Severity</TableHead>
                            <TableHead>Row</TableHead>
                            <TableHead>Field</TableHead>
                            <TableHead>Message</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {batchDetail.issues.map((issue) => (
                            <TableRow key={issue.id}>
                              <TableCell>
                                <Badge 
                                  variant={issue.severity === "ERROR" ? "destructive" : issue.severity === "WARNING" ? "secondary" : "outline"}
                                >
                                  {issue.severity}
                                </Badge>
                              </TableCell>
                              <TableCell>{issue.rowNumber || "-"}</TableCell>
                              <TableCell className="font-mono text-sm">{issue.field || "-"}</TableCell>
                              <TableCell>{issue.message}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </div>
                )}

                {batchDetail?.stagingRows && batchDetail.stagingRows.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium flex items-center gap-2">
                      <Eye className="w-4 h-4" /> Preview Data ({batchDetail.stagingRows.length} rows)
                    </h4>
                    <Tabs defaultValue={batchDetail.stagingRows[0]?.recordType || "GL_LINE"}>
                      <TabsList className="flex-wrap h-auto">
                        {Array.from(new Set(batchDetail.stagingRows.map((r) => r.recordType))).map((rt) => (
                          <TabsTrigger key={rt} value={rt}>{rt}</TabsTrigger>
                        ))}
                      </TabsList>
                      {Array.from(new Set(batchDetail.stagingRows.map((r) => r.recordType))).map((rt) => {
                        const rows = batchDetail.stagingRows?.filter((r) => r.recordType === rt) || [];
                        const cols = rows.length > 0 ? Object.keys(rows[0].parsedData) : [];
                        return (
                          <TabsContent key={rt} value={rt}>
                            <ScrollArea className="h-[300px]">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Row</TableHead>
                                    <TableHead>Valid</TableHead>
                                    {cols.slice(0, 8).map((col) => (
                                      <TableHead key={col}>{col}</TableHead>
                                    ))}
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {rows.slice(0, 50).map((row) => (
                                    <TableRow key={row.id} className={row.isValid ? "" : "bg-red-50"}>
                                      <TableCell>{row.rowNumber}</TableCell>
                                      <TableCell>
                                        {row.isValid ? (
                                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                                        ) : (
                                          <AlertCircle className="w-4 h-4 text-red-600" />
                                        )}
                                      </TableCell>
                                      {cols.slice(0, 8).map((col) => (
                                        <TableCell key={col} className="text-sm">
                                          {String(row.parsedData[col] ?? "")}
                                        </TableCell>
                                      ))}
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </ScrollArea>
                          </TabsContent>
                        );
                      })}
                    </Tabs>
                  </div>
                )}

                {currentBatch.status === 'POSTED' && confirmationCandidates && (
                  <div className="space-y-3">
                    <h4 className="font-medium flex items-center gap-2">
                      <Users className="w-4 h-4" /> Confirmation Candidates Preview
                    </h4>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                      <div className="rounded-lg border p-3 text-center" data-testid="stat-ar-confirmations">
                        <div className="text-lg font-bold text-blue-600">
                          {confirmationCandidates.summary.arConfirmations}
                        </div>
                        <div className="text-xs text-muted-foreground">AR Confirmations</div>
                      </div>
                      <div className="rounded-lg border p-3 text-center" data-testid="stat-ap-confirmations">
                        <div className="text-lg font-bold text-orange-600">
                          {confirmationCandidates.summary.apConfirmations}
                        </div>
                        <div className="text-xs text-muted-foreground">AP Confirmations</div>
                      </div>
                      <div className="rounded-lg border p-3 text-center" data-testid="stat-bank-confirmations">
                        <div className="text-lg font-bold text-green-600">
                          {confirmationCandidates.summary.bankConfirmations}
                        </div>
                        <div className="text-xs text-muted-foreground">Bank Confirmations</div>
                      </div>
                      <div className="rounded-lg border p-3 text-center" data-testid="stat-total-confirmations">
                        <div className="text-lg font-bold">
                          {confirmationCandidates.summary.totalConfirmations}
                        </div>
                        <div className="text-xs text-muted-foreground">Total</div>
                      </div>
                    </div>

                    {confirmationCandidates.summary.missingContactInfo > 0 && (
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Missing Contact Info</AlertTitle>
                        <AlertDescription>
                          {confirmationCandidates.summary.missingContactInfo} parties are missing email or phone information for confirmations.
                        </AlertDescription>
                      </Alert>
                    )}

                    {(confirmationCandidates.partyConfirmations.length > 0 || confirmationCandidates.bankConfirmations.length > 0) && (
                      <Tabs defaultValue="party">
                        <TabsList>
                          <TabsTrigger value="party" data-testid="tab-party-confirmations">Party Confirmations ({confirmationCandidates.partyConfirmations.length})</TabsTrigger>
                          <TabsTrigger value="bank" data-testid="tab-bank-confirmations">Bank Confirmations ({confirmationCandidates.bankConfirmations.length})</TabsTrigger>
                        </TabsList>
                        <TabsContent value="party">
                          <ScrollArea className="h-[200px]">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Type</TableHead>
                                  <TableHead>Party Code</TableHead>
                                  <TableHead>Party Name</TableHead>
                                  <TableHead>Email</TableHead>
                                  <TableHead className="text-right">Balance</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {confirmationCandidates.partyConfirmations.slice(0, 20).map((party) => (
                                  <TableRow key={party.id} data-testid={`row-confirmation-${party.id}`}>
                                    <TableCell>
                                      <Badge variant={party.type === 'ACCOUNTS_RECEIVABLE' ? 'default' : 'secondary'}>
                                        {party.type === 'ACCOUNTS_RECEIVABLE' ? 'AR' : party.type === 'ACCOUNTS_PAYABLE' ? 'AP' : 'Other'}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="font-mono text-sm">{party.partyCode}</TableCell>
                                    <TableCell>{party.partyName}</TableCell>
                                    <TableCell className="text-sm">
                                      {party.email || <span className="text-muted-foreground">-</span>}
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                      {formatAccounting(party.balance)}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </ScrollArea>
                        </TabsContent>
                        <TabsContent value="bank">
                          <ScrollArea className="h-[200px]">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Bank Code</TableHead>
                                  <TableHead>Bank Name</TableHead>
                                  <TableHead>Branch</TableHead>
                                  <TableHead>Account Number</TableHead>
                                  <TableHead>GL Account</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {confirmationCandidates.bankConfirmations.slice(0, 20).map((bank) => (
                                  <TableRow key={bank.id} data-testid={`row-bank-confirmation-${bank.id}`}>
                                    <TableCell className="font-mono text-sm">{bank.bankAccountId}</TableCell>
                                    <TableCell>{bank.bankName}</TableCell>
                                    <TableCell className="text-sm">{bank.branch}</TableCell>
                                    <TableCell className="font-mono text-sm">{bank.accountNumber}</TableCell>
                                    <TableCell className="font-mono text-sm">{bank.glAccount}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </ScrollArea>
                        </TabsContent>
                      </Tabs>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  {renderBatchActions(currentBatch)}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
    </div>
  );
}
