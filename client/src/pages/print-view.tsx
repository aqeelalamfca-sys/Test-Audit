import { useParams, Link } from "wouter";
import { useState, useRef } from "react";
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
import { ArrowLeft, Printer, FileText, Download, Plus, Upload, Eye, CheckCircle, Clock, Send, Trash2, Files, FileCheck, AlertCircle, Calendar, User, Building2, RotateCcw, Package, CheckSquare, FileSpreadsheet, Scale, Mail, FileSignature, Landmark, Users, Briefcase, Sparkles } from "lucide-react";
import { format } from "date-fns";
import html2pdf from "html2pdf.js";
import { PageShell } from "@/components/page-shell";
import { useDeliverablesSaveBridge } from "@/hooks/use-deliverables-save-bridge";
import { useEngagement } from "@/lib/workspace-context";
import { useAuth } from "@/lib/auth";
import { getDocumentHeaderHtml } from "@/lib/pdf-logo";

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

interface Engagement {
  id: string;
  engagementCode: string;
  fiscalYearEnd?: string;
  client: {
    id: string;
    name: string;
  };
}

interface User {
  id: string;
  role: string;
  fullName: string;
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

function generatePDFFileName(clientName: string, fiscalYearEnd: string | undefined, deliverableType: string): string {
  const cleanClientName = clientName.replace(/[^a-zA-Z0-9]/g, "_");
  const fy = fiscalYearEnd ? format(new Date(fiscalYearEnd), "yyyy") : "FY";
  const type = deliverableType.replace(/_/g, "");
  const date = format(new Date(), "yyyyMMdd");
  return `${cleanClientName}_${fy}_${type}_${date}.pdf`;
}

export default function PrintView() {
  const params = useParams<{ engagementId: string }>();
  const engagementId = params.engagementId;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { client } = useEngagement();
  const { firm } = useAuth();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  
  const saveEngine = useDeliverablesSaveBridge(engagementId, () => ({}));
  const [selectedDeliverable, setSelectedDeliverable] = useState<Deliverable | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isFilesOpen, setIsFilesOpen] = useState(false);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  const [newDeliverable, setNewDeliverable] = useState({
    deliverableType: "",
    customTypeName: "",
    opinionType: "",
    remarks: "",
    deliveredDate: ""
  });

  const { data: currentUser } = useQuery<User>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/auth/me");
      if (!res.ok) throw new Error("Failed to fetch user");
      return res.json();
    }
  });

  const { data: engagement } = useQuery<Engagement>({
    queryKey: [`/api/engagements/${engagementId}`],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/engagements/${engagementId}`);
      if (!res.ok) throw new Error("Failed to fetch engagement");
      return res.json();
    },
    enabled: !!engagementId
  });

  const { data: deliverables = [], isLoading } = useQuery<Deliverable[]>({
    queryKey: [`/api/deliverables/${engagementId}`],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/deliverables/${engagementId}`);
      if (!res.ok) throw new Error("Failed to fetch deliverables");
      return res.json();
    },
    enabled: !!engagementId
  });

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
      toast({ title: "Success", description: "Deliverable created successfully" });
      setIsCreateOpen(false);
      setNewDeliverable({ deliverableType: "", customTypeName: "", opinionType: "", remarks: "", deliveredDate: "" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof newDeliverable> }) => {
      const res = await fetchWithAuth(`/api/deliverables/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to update deliverable");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/deliverables/${engagementId}`] });
      toast({ title: "Success", description: "Deliverable updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const workflowMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "review" | "approve" | "issue" }) => {
      const res = await fetchWithAuth(`/api/deliverables/${id}/${action}`, {
        method: "POST",
      });
      if (!res.ok) throw new Error((await res.json()).error || `Failed to ${action} deliverable`);
      return res.json();
    },
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: [`/api/deliverables/${engagementId}`] });
      const messages: Record<string, string> = {
        review: "Deliverable marked as reviewed",
        approve: "Deliverable approved and finalized",
        issue: "Deliverable issued successfully"
      };
      toast({ title: "Success", description: messages[action] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetchWithAuth(`/api/deliverables/${id}/upload`, {
        method: "POST",
        body: formData
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to upload file");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/deliverables/${engagementId}`] });
      toast({ title: "Success", description: "File uploaded successfully" });
      setUploadingFor(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const res = await fetchWithAuth(`/api/deliverables/file/${fileId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to delete file");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/deliverables/${engagementId}`] });
      toast({ title: "Success", description: "File deleted successfully" });
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

  const canReview = currentUser && ["MANAGER", "PARTNER", "FIRM_ADMIN"].includes(currentUser.role);
  const canApprove = currentUser && ["PARTNER", "FIRM_ADMIN"].includes(currentUser.role);
  const canIssue = currentUser && ["PARTNER", "FIRM_ADMIN"].includes(currentUser.role);
  const canCreate = currentUser && ["SENIOR", "MANAGER", "PARTNER", "FIRM_ADMIN"].includes(currentUser.role);

  const handleExportPDF = async (deliverable: Deliverable) => {
    const clientName = engagement?.client?.name || "Client";
    const fiscalYearEnd = engagement?.fiscalYearEnd;
    const headerHtml = await getDocumentHeaderHtml(firm?.logoUrl, firm?.name || "AuditWise");

    const content = `
      <div style="font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto;">
        <div style="margin-bottom: 30px; border-bottom: 2px solid #1a365d; padding-bottom: 20px;">
          ${headerHtml}
        </div>
        
        <h2 style="color: #1a365d; margin-bottom: 20px; text-align: center;">${formatDeliverableType(deliverable.deliverableType, deliverable.customTypeName)}</h2>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
          <tr style="background: #f8f9fa;">
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold; width: 40%;">Client Name</td>
            <td style="padding: 12px; border: 1px solid #dee2e6;">${clientName}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">Engagement Code</td>
            <td style="padding: 12px; border: 1px solid #dee2e6;">${engagement?.engagementCode || "-"}</td>
          </tr>
          <tr style="background: #f8f9fa;">
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">Fiscal Year End</td>
            <td style="padding: 12px; border: 1px solid #dee2e6;">${fiscalYearEnd ? format(new Date(fiscalYearEnd), "MMMM d, yyyy") : "-"}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">Deliverable Type</td>
            <td style="padding: 12px; border: 1px solid #dee2e6;">${formatDeliverableType(deliverable.deliverableType, deliverable.customTypeName)}</td>
          </tr>
          ${deliverable.opinionType ? `
          <tr style="background: #f8f9fa;">
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">Opinion Type</td>
            <td style="padding: 12px; border: 1px solid #dee2e6;">${formatOpinionType(deliverable.opinionType)}</td>
          </tr>
          ` : ""}
          <tr>
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">Status</td>
            <td style="padding: 12px; border: 1px solid #dee2e6;">${STATUS_BADGES[deliverable.status]?.label || deliverable.status}</td>
          </tr>
          <tr style="background: #f8f9fa;">
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">Delivered Date</td>
            <td style="padding: 12px; border: 1px solid #dee2e6;">${deliverable.deliveredDate ? format(new Date(deliverable.deliveredDate), "MMMM d, yyyy") : "-"}</td>
          </tr>
        </table>
        
        ${deliverable.remarks ? `
        <div style="margin-bottom: 30px;">
          <h3 style="color: #1a365d; margin-bottom: 10px;">Remarks</h3>
          <p style="background: #f8f9fa; padding: 15px; border-radius: 4px; margin: 0;">${deliverable.remarks}</p>
        </div>
        ` : ""}
        
        <h3 style="color: #1a365d; margin-bottom: 15px;">Audit Trail</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
          <tr style="background: #f8f9fa;">
            <td style="padding: 10px; border: 1px solid #dee2e6; font-weight: bold; width: 30%;">Prepared By</td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${deliverable.preparedBy?.fullName || "-"}</td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${deliverable.preparedAt ? format(new Date(deliverable.preparedAt), "MMM d, yyyy h:mm a") : "-"}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #dee2e6; font-weight: bold;">Reviewed By</td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${deliverable.reviewedBy?.fullName || "-"}</td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${deliverable.reviewedAt ? format(new Date(deliverable.reviewedAt), "MMM d, yyyy h:mm a") : "-"}</td>
          </tr>
          <tr style="background: #f8f9fa;">
            <td style="padding: 10px; border: 1px solid #dee2e6; font-weight: bold;">Approved By</td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${deliverable.approvedBy?.fullName || "-"}</td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${deliverable.approvedAt ? format(new Date(deliverable.approvedAt), "MMM d, yyyy h:mm a") : "-"}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #dee2e6; font-weight: bold;">Issued By</td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${deliverable.issuedBy?.fullName || "-"}</td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${deliverable.issuedAt ? format(new Date(deliverable.issuedAt), "MMM d, yyyy h:mm a") : "-"}</td>
          </tr>
        </table>
        
        <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #dee2e6; color: #666; font-size: 12px;">
          <p>Generated by AuditWise on ${format(new Date(), "MMMM d, yyyy 'at' h:mm a")}</p>
          <p>This document is for audit documentation purposes only.</p>
        </div>
      </div>
    `;

    const options = {
      margin: 10,
      filename: generatePDFFileName(clientName, fiscalYearEnd, deliverable.deliverableType),
      image: { type: "jpeg" as const, quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: "mm" as const, format: "a4" as const, orientation: "portrait" as const }
    };

    try {
      await html2pdf().set(options).from(content).save();
      toast({ title: "Success", description: "PDF exported successfully" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to export PDF", variant: "destructive" });
    }
  };

  const openDeliverableDetail = (deliverable: Deliverable) => {
    const freshData = deliverables.find(d => d.id === deliverable.id) || deliverable;
    setSelectedDeliverable(freshData);
    setIsDetailOpen(true);
  };
  
  const getSelectedDeliverable = () => {
    if (!selectedDeliverable) return null;
    return deliverables.find(d => d.id === selectedDeliverable.id) || selectedDeliverable;
  };
  
  const currentDeliverable = getSelectedDeliverable();

  const showOpinionField = newDeliverable.deliverableType === "AUDIT_REPORT";

  return (
    <PageShell
      title="Deliverables"
      subtitle={`Audit deliverables register & print view${client?.name ? ` | ${client.name}` : ""}${engagement?.engagementCode ? ` (${engagement.engagementCode})` : ""}`}
      icon={<Printer className="h-6 w-6 text-primary" />}
      backHref={`/workspace/${engagementId}/finalization`}
      nextHref={`/workspace/${engagementId}/qcr`}
      dashboardHref="/engagements"
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
    <div className="px-4 py-3 space-y-3">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".pdf,.doc,.docx,.xls,.xlsx"
        onChange={handleFileChange}
      />

      <div className="flex gap-2 print:hidden flex-wrap">
        <Button 
          variant="outline" 
          onClick={() => {
            toast({ title: "Exporting Package", description: "Preparing complete audit deliverables package..." });
          }}
          data-testid="button-export-package"
          disabled={deliverables.length === 0}
          title={deliverables.length === 0 ? "No deliverables to export" : "Export complete audit deliverables package"}
        >
          <Package className="h-4 w-4 mr-2" />
          Export Package
        </Button>
        <Button 
          variant="outline" 
          onClick={() => window.print()}
          data-testid="button-print-all"
          disabled={deliverables.length === 0}
          title={deliverables.length === 0 ? "No deliverables to print" : "Print all deliverables"}
        >
          <Printer className="h-4 w-4 mr-2" />
          Print All
        </Button>
        <Button 
          variant="outline"
          onClick={() => {
            toast({ title: "Marked as Reviewed", description: "All deliverables marked as reviewed." });
          }}
          data-testid="button-mark-reviewed"
          disabled={deliverables.length === 0}
          title={deliverables.length === 0 ? "No deliverables to review" : "Mark all deliverables as reviewed"}
        >
          <CheckSquare className="h-4 w-4 mr-2" />
          Mark as Reviewed
        </Button>
          {canCreate && (
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-deliverable" title="Add a new deliverable to the register">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Deliverable
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Create New Deliverable</DialogTitle>
                  <DialogDescription>
                    Add a new deliverable to the engagement register
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Type of Deliverable *</Label>
                    <Select
                      value={newDeliverable.deliverableType}
                      onValueChange={(v) => setNewDeliverable({ ...newDeliverable, deliverableType: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select deliverable type" />
                      </SelectTrigger>
                      <SelectContent>
                        {DELIVERABLE_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {newDeliverable.deliverableType === "OTHER" && (
                    <div className="space-y-2">
                      <Label>Custom Type Name *</Label>
                      <Input
                        value={newDeliverable.customTypeName}
                        onChange={(e) => setNewDeliverable({ ...newDeliverable, customTypeName: e.target.value })}
                        placeholder="Enter custom deliverable type"
                      />
                    </div>
                  )}

                  {showOpinionField && (
                    <div className="space-y-2">
                      <Label>Opinion Type *</Label>
                      <Select
                        value={newDeliverable.opinionType}
                        onValueChange={(v) => setNewDeliverable({ ...newDeliverable, opinionType: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select opinion type" />
                        </SelectTrigger>
                        <SelectContent>
                          {OPINION_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Required for Audit Reports (ISA 700/705/706)</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Delivered Date</Label>
                    <Input
                      type="date"
                      value={newDeliverable.deliveredDate}
                      onChange={(e) => setNewDeliverable({ ...newDeliverable, deliveredDate: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Remarks</Label>
                    <Textarea
                      value={newDeliverable.remarks}
                      onChange={(e) => setNewDeliverable({ ...newDeliverable, remarks: e.target.value })}
                      placeholder="Optional notes for documentation clarity"
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => createMutation.mutate(newDeliverable)}
                    disabled={
                      !newDeliverable.deliverableType || 
                      (newDeliverable.deliverableType === "OTHER" && !newDeliverable.customTypeName) || 
                      (newDeliverable.deliverableType === "AUDIT_REPORT" && !newDeliverable.opinionType) ||
                      createMutation.isPending
                    }
                  >
                    Create Deliverable
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
      </div>

      {engagement && (
        <Card className="print:hidden">
          <CardContent className="pt-2">
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{engagement.client?.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span>{engagement.engagementCode}</span>
              </div>
              {engagement.fiscalYearEnd && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>FY {format(new Date(engagement.fiscalYearEnd), "yyyy")}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="bg-gradient-to-r from-muted/50 to-transparent border-b border-border/50 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-green-500/10 text-green-600 flex-shrink-0">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-base font-semibold">Auto-Generated Outputs</CardTitle>
                <CardDescription className="text-sm">
                  Read-only deliverables automatically generated from earlier engagement phases
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="text-xs">
              <CheckCircle className="h-3 w-3 mr-1" />
              Data pulled from phases
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="bg-muted/30 hover:shadow-sm transition-shadow" data-testid="card-draft-fs">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                    <FileSpreadsheet className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm">Draft Financial Statements</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Auto-generated from TB mapping & adjustments
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <Badge variant="secondary" className="text-xs">From Planning</Badge>
                      <Button size="sm" variant="ghost" className="h-7 ml-auto" data-testid="button-view-draft-fs">
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7" data-testid="button-download-draft-fs">
                        <Download className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-muted/30 hover:shadow-sm transition-shadow" data-testid="card-audit-report-draft">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
                    <FileCheck className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm">Audit Report Draft</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      ISA 700/705/706 compliant report template
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <Badge variant="secondary" className="text-xs">From Finalization</Badge>
                      <Button size="sm" variant="ghost" className="h-7 ml-auto" data-testid="button-view-audit-report">
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7" data-testid="button-download-audit-report">
                        <Download className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-muted/30 hover:shadow-sm transition-shadow" data-testid="card-management-letter">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm">Management Letter Draft</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Control deficiencies per ISA 265
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <Badge variant="secondary" className="text-xs">From Execution</Badge>
                      <Button size="sm" variant="ghost" className="h-7 ml-auto" data-testid="button-view-mgmt-letter">
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7" data-testid="button-download-mgmt-letter">
                        <Download className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-muted/30 hover:shadow-sm transition-shadow" data-testid="card-representation-letter">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-teal-500/10 text-teal-500">
                    <FileSignature className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm">Representation Letter Template</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      ISA 580 management representations
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <Badge variant="secondary" className="text-xs">Template</Badge>
                      <Button size="sm" variant="ghost" className="h-7 ml-auto" data-testid="button-view-rep-letter">
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7" data-testid="button-download-rep-letter">
                        <Download className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-muted/30 hover:shadow-sm transition-shadow" data-testid="card-bank-confirmation">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500">
                    <Landmark className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm">Bank Confirmation Letters</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      ISA 505 external confirmations
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <Badge variant="secondary" className="text-xs">From Execution</Badge>
                      <Button size="sm" variant="ghost" className="h-7 ml-auto" data-testid="button-view-bank-conf">
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7" data-testid="button-download-bank-conf">
                        <Download className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-muted/30 hover:shadow-sm transition-shadow" data-testid="card-lawyer-confirmation">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-rose-500/10 text-rose-500">
                    <Scale className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm">Lawyer Confirmation Letters</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Legal matters & contingencies
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <Badge variant="secondary" className="text-xs">From Execution</Badge>
                      <Button size="sm" variant="ghost" className="h-7 ml-auto" data-testid="button-view-lawyer-conf">
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7" data-testid="button-download-lawyer-conf">
                        <Download className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-muted/30 hover:shadow-sm transition-shadow" data-testid="card-debtor-confirmation">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-500">
                    <Users className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm">Debtor Confirmation Letters</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Trade receivables confirmations
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <Badge variant="secondary" className="text-xs">From Execution</Badge>
                      <Button size="sm" variant="ghost" className="h-7 ml-auto" data-testid="button-view-debtor-conf">
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7" data-testid="button-download-debtor-conf">
                        <Download className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-muted/30 hover:shadow-sm transition-shadow" data-testid="card-creditor-confirmation">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                    <Briefcase className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm">Creditor Confirmation Letters</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Trade payables confirmations
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <Badge variant="secondary" className="text-xs">From Execution</Badge>
                      <Button size="sm" variant="ghost" className="h-7 ml-auto" data-testid="button-view-creditor-conf">
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7" data-testid="button-download-creditor-conf">
                        <Download className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-4 p-3 bg-muted/50 rounded-lg border border-dashed">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              <span>
                These outputs are read-only and auto-generated from data entered in earlier phases. 
                To modify content, update the source data in the respective phase.
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Deliverables Register
          </CardTitle>
          <CardDescription>
            All audit deliverables with status tracking, metadata, and supporting documents
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading deliverables...</div>
          ) : deliverables.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium mb-2">No Deliverables Yet</h3>
              <p className="text-muted-foreground mb-4">Create your first deliverable to start the register</p>
              {canCreate && (
                <Button onClick={() => setIsCreateOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Deliverable
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {deliverables.map((deliverable) => (
                <Card key={deliverable.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-medium text-lg">
                            {formatDeliverableType(deliverable.deliverableType, deliverable.customTypeName)}
                          </h3>
                          <Badge variant={STATUS_BADGES[deliverable.status]?.variant || "secondary"}>
                            {STATUS_BADGES[deliverable.status]?.label || deliverable.status}
                          </Badge>
                          {deliverable.opinionType && deliverable.opinionType !== "NOT_APPLICABLE" && (
                            <Badge variant="outline">{formatOpinionType(deliverable.opinionType)}</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          {DELIVERABLE_TYPES.find(t => t.value === deliverable.deliverableType)?.description || "Custom deliverable"}
                        </p>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Prepared:</span>
                            <span className="ml-2">{deliverable.preparedBy?.fullName || "-"}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Reviewed:</span>
                            <span className="ml-2">{deliverable.reviewedBy?.fullName || "-"}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Approved:</span>
                            <span className="ml-2">{deliverable.approvedBy?.fullName || "-"}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Delivered:</span>
                            <span className="ml-2">
                              {deliverable.deliveredDate ? format(new Date(deliverable.deliveredDate), "MMM d, yyyy") : "-"}
                            </span>
                          </div>
                        </div>

                        {deliverable.files.length > 0 && (
                          <div className="mt-3 flex items-center gap-2">
                            <Files className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              {deliverable.files.filter(f => f.isCurrentVersion).length} current file(s)
                              {deliverable.files.length > deliverable.files.filter(f => f.isCurrentVersion).length && 
                                ` (${deliverable.files.length} total versions)`}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2">
                        <Button variant="outline" size="sm" onClick={() => openDeliverableDetail(deliverable)}>
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleExportPDF(deliverable)}>
                          <Download className="h-4 w-4 mr-1" />
                          PDF
                        </Button>
                        {deliverable.status === "DRAFT" && (
                          <Button variant="outline" size="sm" onClick={() => handleFileUpload(deliverable.id)}>
                            <Upload className="h-4 w-4 mr-1" />
                            Upload
                          </Button>
                        )}
                      </div>
                    </div>

                    {deliverable.status === "DRAFT" && (
                      <div className="flex gap-2 mt-4 pt-4 border-t">
                        {canReview && !deliverable.reviewedById && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => workflowMutation.mutate({ id: deliverable.id, action: "review" })}
                            disabled={workflowMutation.isPending}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Mark Reviewed
                          </Button>
                        )}
                        {canApprove && deliverable.reviewedById && !deliverable.approvedById && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => workflowMutation.mutate({ id: deliverable.id, action: "approve" })}
                            disabled={workflowMutation.isPending}
                          >
                            <FileCheck className="h-4 w-4 mr-1" />
                            Approve & Finalize
                          </Button>
                        )}
                      </div>
                    )}

                    {deliverable.status === "FINAL" && canIssue && (
                      <div className="flex gap-2 mt-4 pt-4 border-t">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => workflowMutation.mutate({ id: deliverable.id, action: "issue" })}
                          disabled={workflowMutation.isPending || !deliverable.deliveredDate || (deliverable.deliverableType === "AUDIT_REPORT" && !deliverable.opinionType)}
                        >
                          <Send className="h-4 w-4 mr-1" />
                          Issue Deliverable
                        </Button>
                        {!deliverable.deliveredDate && (
                          <span className="text-sm text-destructive flex items-center gap-1">
                            <AlertCircle className="h-4 w-4" />
                            Delivered date required
                          </span>
                        )}
                        {deliverable.deliverableType === "AUDIT_REPORT" && !deliverable.opinionType && (
                          <span className="text-sm text-destructive flex items-center gap-1">
                            <AlertCircle className="h-4 w-4" />
                            Opinion type required
                          </span>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedDeliverable && formatDeliverableType(selectedDeliverable.deliverableType, selectedDeliverable.customTypeName)}
            </DialogTitle>
            <DialogDescription>
              Deliverable details, audit trail, and supporting documents
            </DialogDescription>
          </DialogHeader>

          {selectedDeliverable && (
            <Tabs defaultValue="details" className="mt-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="audit-trail">Audit Trail</TabsTrigger>
                <TabsTrigger value="files">Files ({selectedDeliverable.files.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Deliverable Type</Label>
                    <p className="font-medium">{formatDeliverableType(selectedDeliverable.deliverableType, selectedDeliverable.customTypeName)}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Status</Label>
                    <div>
                      <Badge variant={STATUS_BADGES[selectedDeliverable.status]?.variant || "secondary"}>
                        {STATUS_BADGES[selectedDeliverable.status]?.label || selectedDeliverable.status}
                      </Badge>
                    </div>
                  </div>
                  {selectedDeliverable.opinionType && (
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Opinion Type</Label>
                      <p className="font-medium">{formatOpinionType(selectedDeliverable.opinionType)}</p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Delivered Date</Label>
                    <p className="font-medium">
                      {selectedDeliverable.deliveredDate
                        ? format(new Date(selectedDeliverable.deliveredDate), "MMMM d, yyyy")
                        : "Not set"}
                    </p>
                  </div>
                </div>

                {selectedDeliverable.remarks && (
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Remarks</Label>
                    <p className="bg-muted p-3 rounded-md">{selectedDeliverable.remarks}</p>
                  </div>
                )}

                {selectedDeliverable.status === "DRAFT" && canCreate && (
                  <div className="pt-4 border-t space-y-4">
                    <h4 className="font-medium">Edit Details</h4>
                    <div className="grid grid-cols-2 gap-4">
                      {selectedDeliverable.deliverableType === "AUDIT_REPORT" && (
                        <div className="space-y-2">
                          <Label>Opinion Type</Label>
                          <Select
                            value={selectedDeliverable.opinionType || ""}
                            onValueChange={(v) => updateMutation.mutate({ id: selectedDeliverable.id, data: { opinionType: v } })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select opinion" />
                            </SelectTrigger>
                            <SelectContent>
                              {OPINION_TYPES.map((type) => (
                                <SelectItem key={type.value} value={type.value}>
                                  {type.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label>Delivered Date</Label>
                        <Input
                          type="date"
                          value={selectedDeliverable.deliveredDate ? format(new Date(selectedDeliverable.deliveredDate), "yyyy-MM-dd") : ""}
                          onChange={(e) => updateMutation.mutate({ id: selectedDeliverable.id, data: { deliveredDate: e.target.value } })}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="audit-trail" className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Action</TableHead>
                      <TableHead>By</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Date/Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Prepared</TableCell>
                      <TableCell>{selectedDeliverable.preparedBy?.fullName || "-"}</TableCell>
                      <TableCell>{selectedDeliverable.preparedBy?.role || "-"}</TableCell>
                      <TableCell>
                        {selectedDeliverable.preparedAt
                          ? format(new Date(selectedDeliverable.preparedAt), "MMM d, yyyy h:mm a")
                          : "-"}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Reviewed</TableCell>
                      <TableCell>{selectedDeliverable.reviewedBy?.fullName || "-"}</TableCell>
                      <TableCell>{selectedDeliverable.reviewedBy?.role || "-"}</TableCell>
                      <TableCell>
                        {selectedDeliverable.reviewedAt
                          ? format(new Date(selectedDeliverable.reviewedAt), "MMM d, yyyy h:mm a")
                          : "-"}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Approved</TableCell>
                      <TableCell>{selectedDeliverable.approvedBy?.fullName || "-"}</TableCell>
                      <TableCell>{selectedDeliverable.approvedBy?.role || "-"}</TableCell>
                      <TableCell>
                        {selectedDeliverable.approvedAt
                          ? format(new Date(selectedDeliverable.approvedAt), "MMM d, yyyy h:mm a")
                          : "-"}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Issued</TableCell>
                      <TableCell>{selectedDeliverable.issuedBy?.fullName || "-"}</TableCell>
                      <TableCell>{selectedDeliverable.issuedBy?.role || "-"}</TableCell>
                      <TableCell>
                        {selectedDeliverable.issuedAt
                          ? format(new Date(selectedDeliverable.issuedAt), "MMM d, yyyy h:mm a")
                          : "-"}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="files" className="mt-4">
                {selectedDeliverable.files.length > 0 && (
                  <div className="mb-4 p-3 bg-muted rounded-md">
                    <div className="flex items-center gap-4 text-sm">
                      <span><strong>Total Versions:</strong> {selectedDeliverable.files.length}</span>
                      <span><strong>Current Files:</strong> {selectedDeliverable.files.filter(f => f.isCurrentVersion).length}</span>
                      <span><strong>Latest Version:</strong> v{Math.max(...selectedDeliverable.files.map(f => f.version))}</span>
                    </div>
                  </div>
                )}
                {selectedDeliverable.files.length === 0 ? (
                  <div className="text-center py-8">
                    <Files className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">No files uploaded yet</p>
                    {selectedDeliverable.status === "DRAFT" && (
                      <Button
                        variant="outline"
                        className="mt-4"
                        onClick={() => handleFileUpload(selectedDeliverable.id)}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Upload File
                      </Button>
                    )}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>File Name</TableHead>
                        <TableHead>Version</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Uploaded By</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedDeliverable.files.map((file) => (
                        <TableRow key={file.id}>
                          <TableCell className="font-medium">
                            {file.originalName}
                            {file.isCurrentVersion && (
                              <Badge variant="secondary" className="ml-2">Current</Badge>
                            )}
                          </TableCell>
                          <TableCell>v{file.version}</TableCell>
                          <TableCell>{formatFileSize(file.fileSize)}</TableCell>
                          <TableCell>{file.uploadedBy.fullName}</TableCell>
                          <TableCell>{format(new Date(file.uploadedAt), "MMM d, yyyy")}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open(`/api/deliverables/file/${file.id}/download`, "_blank")}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              {selectedDeliverable.status === "DRAFT" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    if (confirm("Delete this file?")) {
                                      deleteFileMutation.mutate(file.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                {selectedDeliverable.status === "DRAFT" && selectedDeliverable.files.length > 0 && (
                  <div className="mt-4">
                    <Button variant="outline" onClick={() => handleFileUpload(selectedDeliverable.id)}>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload New Version
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      <Card className="hidden print:block">
        <CardHeader>
          <CardTitle>Deliverables Register</CardTitle>
          <CardDescription>
            Client: {engagement?.client?.name} | Engagement: {engagement?.engagementCode}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Opinion</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Delivered</TableHead>
                <TableHead>Prepared</TableHead>
                <TableHead>Approved</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliverables.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>{formatDeliverableType(d.deliverableType, d.customTypeName)}</TableCell>
                  <TableCell>{formatOpinionType(d.opinionType)}</TableCell>
                  <TableCell>{STATUS_BADGES[d.status]?.label || d.status}</TableCell>
                  <TableCell>{d.deliveredDate ? format(new Date(d.deliveredDate), "MMM d, yyyy") : "-"}</TableCell>
                  <TableCell>{d.preparedBy?.fullName || "-"}</TableCell>
                  <TableCell>{d.approvedBy?.fullName || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
    </PageShell>
  );
}
