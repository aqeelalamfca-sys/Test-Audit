import { useState, useEffect } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Shield, FileText, Clock, CheckCircle, Upload, Send, ArrowLeft, LogOut, Paperclip, AlertCircle, Building2, Phone, Mail, Globe, User, Calendar, RefreshCw, Download, Eye, FileCheck } from "lucide-react";

interface Attachment {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  versionNumber: number;
  createdAt: string;
  filePath?: string;
}

interface DeliverableFile {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  version: number;
  uploadedAt: string;
}

interface Deliverable {
  id: string;
  deliverableType: string;
  customTypeName?: string;
  opinionType?: string;
  remarks?: string;
  deliveredDate?: string;
  issuedAt?: string;
  issuedBy?: { fullName: string };
  files: DeliverableFile[];
}

interface Request {
  id: string;
  srNumber: number;
  requestCode: string;
  requestTitle: string;
  headOfAccounts: string;
  description: string;
  specificRequirements?: string;
  priority: string;
  status: string;
  clientResponse?: string;
  clientResponseDate?: string;
  aiGeneratedGuidance?: string;
  attachments: Attachment[];
}

interface ClientInfo {
  id: string;
  name: string;
  tradingName?: string;
  ntn?: string;
  secpNo?: string;
  email?: string;
  phone?: string;
  website?: string;
  industry?: string;
  entityType?: string;
  dateOfIncorporation?: string;
  ceoName?: string;
  cfoName?: string;
  address?: string;
  city?: string;
  country?: string;
}

interface Engagement {
  id: string;
  engagementCode: string;
  fiscalYearEnd: string;
  status: string;
  engagementType: string;
  client: ClientInfo;
}

interface EngagementStats {
  pendingRequests: number;
  inProgressRequests: number;
  completedRequests: number;
  totalAttachments: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  PENDING: { label: "Pending", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", icon: Clock },
  IN_PROGRESS: { label: "In Progress", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", icon: AlertCircle },
  COMPLETED: { label: "Completed", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: CheckCircle },
};

const PRIORITY_CONFIG: Record<string, string> = {
  HIGH: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  MEDIUM: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  LOW: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

export default function PortalRequests() {
  const [match, params] = useRoute("/portal/engagement/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [stats, setStats] = useState<EngagementStats | null>(null);
  const [requests, setRequests] = useState<Request[]>([]);
  const [allAttachments, setAllAttachments] = useState<Attachment[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("requests");

  const engagementId = params?.id;

  useEffect(() => {
    if (engagementId) {
      checkAuthAndFetch();
    }
  }, [engagementId]);

  const checkAuthAndFetch = async () => {
    try {
      const authResponse = await fetch("/api/client-portal/auth/me", { credentials: "include" });
      if (!authResponse.ok) {
        setLocation("/portal/login");
        return;
      }
      await Promise.all([fetchEngagement(), fetchRequests(), fetchAllAttachments(), fetchDeliverables()]);
    } catch {
      setLocation("/portal/login");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEngagement = async () => {
    const response = await fetch(`/api/client-portal/portal/engagements/${engagementId}`, {
      credentials: "include",
    });
    if (response.ok) {
      const data = await response.json();
      setEngagement(data.engagement);
      setStats(data.stats);
    }
  };

  const fetchRequests = async () => {
    const response = await fetch(`/api/client-portal/portal/engagements/${engagementId}/requests`, {
      credentials: "include",
    });
    if (response.ok) {
      setRequests(await response.json());
    }
  };

  const fetchAllAttachments = async () => {
    const response = await fetch(`/api/client-portal/portal/engagements/${engagementId}/attachments`, {
      credentials: "include",
    });
    if (response.ok) {
      setAllAttachments(await response.json());
    }
  };

  const fetchDeliverables = async () => {
    const response = await fetch(`/api/client-portal/portal/engagements/${engagementId}/deliverables`, {
      credentials: "include",
    });
    if (response.ok) {
      setDeliverables(await response.json());
    }
  };

  const handleDownloadDeliverable = async (deliverableId: string, fileId: string, fileName: string) => {
    try {
      const response = await fetch(`/api/client-portal/portal/deliverables/${deliverableId}/download/${fileId}`, {
        credentials: "include",
      });
      if (response.ok) {
        // Get blob directly from response
        const blob = await response.blob();
        
        // If blob type is empty or generic, use the content-type from headers
        const finalBlob = blob.type && blob.type !== 'application/octet-stream' 
          ? blob 
          : new Blob([blob], { type: response.headers.get('content-type') || 'application/octet-stream' });
        
        const url = window.URL.createObjectURL(finalBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast({ title: "Downloaded", description: `${fileName} has been downloaded.` });
      } else {
        throw new Error("Download failed");
      }
    } catch {
      toast({ title: "Error", description: "Failed to download file", variant: "destructive" });
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchEngagement(), fetchRequests(), fetchAllAttachments(), fetchDeliverables()]);
    setIsRefreshing(false);
    toast({ title: "Refreshed", description: "Data has been updated." });
  };

  const handleSubmitResponse = async () => {
    if (!selectedRequest || !response.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/client-portal/portal/requests/${selectedRequest.id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientResponse: response }),
        credentials: "include",
      });

      if (res.ok) {
        toast({ title: "Response Submitted", description: "Your response has been saved." });
        setSelectedRequest(null);
        setResponse("");
        fetchRequests();
      } else {
        throw new Error("Failed to submit response");
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to submit response", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = async (requestId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`/api/client-portal/portal/requests/${requestId}/upload`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (res.ok) {
        toast({ title: "File Uploaded", description: `${file.name} uploaded successfully.` });
        fetchRequests();
        fetchAllAttachments();
      } else {
        throw new Error("Upload failed");
      }
    } catch (error) {
      toast({ title: "Upload Failed", description: "Failed to upload file", variant: "destructive" });
    }
  };

  const handleLogout = async () => {
    await fetch("/api/client-portal/auth/logout", { method: "POST", credentials: "include" });
    setLocation("/portal/login");
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading engagement details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="bg-white dark:bg-slate-800 border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/portal/dashboard">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
                <Shield className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-semibold">{engagement?.engagementCode}</h1>
                <p className="text-xs text-muted-foreground">{engagement?.client.name}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-3">
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 mb-3">
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-600" />
              <span className="text-sm text-muted-foreground">Pending</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats?.pendingRequests || 0}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-muted-foreground">In Progress</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats?.inProgressRequests || 0}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm text-muted-foreground">Completed</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats?.completedRequests || 0}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Paperclip className="h-4 w-4 text-purple-600" />
              <span className="text-sm text-muted-foreground">Attachments</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats?.totalAttachments || 0}</p>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="company" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Company</span>
            </TabsTrigger>
            <TabsTrigger value="requests" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Requests</span>
              {(stats?.pendingRequests || 0) > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 justify-center">
                  {stats?.pendingRequests}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="deliverables" className="flex items-center gap-2">
              <FileCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Deliverables</span>
              {deliverables.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 justify-center">
                  {deliverables.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="attachments" className="flex items-center gap-2">
              <Paperclip className="h-4 w-4" />
              <span className="hidden sm:inline">Files</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="company" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Company Information
                </CardTitle>
                <CardDescription>
                  Review your company details on file with the audit firm
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="text-muted-foreground">Company Name</Label>
                    <p className="font-medium">{engagement?.client.name || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Trading Name</Label>
                    <p className="font-medium">{engagement?.client.tradingName || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">NTN</Label>
                    <p className="font-medium">{engagement?.client.ntn || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">SECP Registration</Label>
                    <p className="font-medium">{engagement?.client.secpNo || "-"}</p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Contact Information
                  </h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{engagement?.client.email || "-"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{engagement?.client.phone || "-"}</span>
                    </div>
                    <div className="flex items-center gap-2 sm:col-span-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <span>{engagement?.client.website || "-"}</span>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Key Personnel
                  </h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label className="text-muted-foreground">CEO</Label>
                      <p className="font-medium">{engagement?.client.ceoName || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">CFO</Label>
                      <p className="font-medium">{engagement?.client.cfoName || "-"}</p>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Engagement Details
                  </h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label className="text-muted-foreground">Engagement Type</Label>
                      <p className="font-medium">{engagement?.engagementType.replace(/_/g, " ") || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Fiscal Year End</Label>
                      <p className="font-medium">
                        {engagement?.fiscalYearEnd ? new Date(engagement.fiscalYearEnd).toLocaleDateString() : "-"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Industry</Label>
                      <p className="font-medium">{engagement?.client.industry || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Entity Type</Label>
                      <p className="font-medium">{engagement?.client.entityType || "-"}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="requests" className="space-y-4">
            {requests.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">No Requests Yet</h3>
                  <p className="text-muted-foreground">
                    The audit team hasn't raised any information requests yet.
                  </p>
                </CardContent>
              </Card>
            ) : (
              requests.map((request) => {
                const statusConfig = STATUS_CONFIG[request.status] || STATUS_CONFIG.PENDING;
                const StatusIcon = statusConfig.icon;
                const priorityClass = PRIORITY_CONFIG[request.priority] || PRIORITY_CONFIG.MEDIUM;

                return (
                  <Card key={request.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <CardTitle className="text-lg flex flex-wrap items-center gap-2">
                            <span className="text-sm font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                              #{request.srNumber}
                            </span>
                            <span>{request.requestTitle}</span>
                          </CardTitle>
                          <CardDescription className="mt-2 flex flex-wrap gap-2">
                            <Badge variant="outline">{request.headOfAccounts.replace(/_/g, " ")}</Badge>
                            <Badge className={priorityClass}>{request.priority}</Badge>
                          </CardDescription>
                        </div>
                        <Badge className={statusConfig.color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusConfig.label}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label className="text-muted-foreground">Description</Label>
                        <p className="text-sm mt-1">{request.description}</p>
                      </div>

                      {request.specificRequirements && (
                        <div>
                          <Label className="text-muted-foreground">Specific Requirements</Label>
                          <p className="text-sm mt-1">{request.specificRequirements}</p>
                        </div>
                      )}

                      {request.aiGeneratedGuidance && (
                        <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                          <Label className="text-blue-700 dark:text-blue-300">Guidance</Label>
                          <p className="text-sm mt-1 text-blue-700 dark:text-blue-300">{request.aiGeneratedGuidance}</p>
                        </div>
                      )}

                      {request.clientResponse && (
                        <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg border border-green-200 dark:border-green-800">
                          <Label className="text-green-700 dark:text-green-300">Your Response</Label>
                          <p className="text-sm mt-1 text-green-700 dark:text-green-300">{request.clientResponse}</p>
                          <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                            Submitted: {new Date(request.clientResponseDate!).toLocaleString()}
                          </p>
                        </div>
                      )}

                      {request.attachments.length > 0 && (
                        <div>
                          <Label className="text-muted-foreground">Attachments ({request.attachments.length})</Label>
                          <div className="mt-2 space-y-2">
                            {request.attachments.map((att) => (
                              <div key={att.id} className="flex items-center justify-between gap-2 text-sm p-2 bg-muted rounded">
                                <div className="flex items-center gap-2 min-w-0">
                                  <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                                  <span className="truncate">{att.fileName}</span>
                                  <Badge variant="outline" className="text-xs shrink-0">v{att.versionNumber}</Badge>
                                </div>
                                <span className="text-xs text-muted-foreground shrink-0">{formatFileSize(att.fileSize)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 pt-2 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedRequest(request);
                            setResponse(request.clientResponse || "");
                          }}
                        >
                          <Send className="h-4 w-4 mr-2" />
                          {request.clientResponse ? "Update Response" : "Respond"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const input = document.createElement("input");
                            input.type = "file";
                            input.onchange = (e) => {
                              const file = (e.target as HTMLInputElement).files?.[0];
                              if (file) handleFileUpload(request.id, file);
                            };
                            input.click();
                          }}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Upload File
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="deliverables" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileCheck className="h-5 w-5" />
                  Audit Deliverables
                </CardTitle>
                <CardDescription>
                  Issued audit reports and documents from your engagement
                </CardDescription>
              </CardHeader>
              <CardContent>
                {deliverables.length === 0 ? (
                  <div className="py-12 text-center">
                    <FileCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-semibold mb-2">No Deliverables Yet</h3>
                    <p className="text-muted-foreground">
                      Audit reports and other deliverables will appear here once issued.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {deliverables.map((deliverable) => (
                      <div key={deliverable.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h4 className="font-semibold flex items-center gap-2">
                              {deliverable.deliverableType.replace(/_/g, " ")}
                              {deliverable.customTypeName && (
                                <span className="text-muted-foreground">
                                  ({deliverable.customTypeName})
                                </span>
                              )}
                            </h4>
                            {deliverable.opinionType && (
                              <Badge variant="outline" className="mt-1">
                                {deliverable.opinionType.replace(/_/g, " ")}
                              </Badge>
                            )}
                          </div>
                          <div className="text-right text-sm text-muted-foreground">
                            <p>Issued: {deliverable.issuedAt ? new Date(deliverable.issuedAt).toLocaleDateString() : "-"}</p>
                            {deliverable.issuedBy && (
                              <p className="text-xs">By: {deliverable.issuedBy.fullName}</p>
                            )}
                          </div>
                        </div>
                        
                        {deliverable.remarks && (
                          <p className="text-sm text-muted-foreground">{deliverable.remarks}</p>
                        )}
                        
                        {deliverable.files.length > 0 && (
                          <div className="space-y-2">
                            <Label className="text-muted-foreground">Documents</Label>
                            {deliverable.files.map((file) => (
                              <div key={file.id} className="flex items-center justify-between gap-4 p-2 bg-muted rounded-lg">
                                <div className="flex items-center gap-2 min-w-0">
                                  <FileText className="h-4 w-4 text-primary shrink-0" />
                                  <span className="truncate text-sm">{file.originalName}</span>
                                  <Badge variant="outline" className="text-xs shrink-0">v{file.version}</Badge>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDownloadDeliverable(deliverable.id, file.id, file.originalName)}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="attachments" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Paperclip className="h-5 w-5" />
                  All Attachments
                </CardTitle>
                <CardDescription>
                  Documents uploaded to information requests for this engagement
                </CardDescription>
              </CardHeader>
              <CardContent>
                {allAttachments.length === 0 ? (
                  <div className="py-12 text-center">
                    <Paperclip className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-semibold mb-2">No Attachments Yet</h3>
                    <p className="text-muted-foreground">
                      Upload documents through the Requests tab.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {allAttachments.map((att) => (
                      <div key={att.id} className="flex items-center justify-between gap-4 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center shrink-0">
                            <FileText className="h-5 w-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{att.fileName}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(att.fileSize)} • Version {att.versionNumber} • {new Date(att.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline">{att.fileType}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Respond to Request</DialogTitle>
            <DialogDescription>
              #{selectedRequest?.srNumber} - {selectedRequest?.requestTitle}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Enter your response..."
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              rows={6}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedRequest(null)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitResponse} disabled={isSubmitting || !response.trim()}>
              {isSubmitting ? "Submitting..." : "Submit Response"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
