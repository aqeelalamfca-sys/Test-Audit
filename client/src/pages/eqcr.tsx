import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link } from "wouter";
import { useEngagement } from "@/lib/workspace-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Shield, CheckCircle2, AlertTriangle, FileText, Plus, Sparkles, Upload, Trash2, Download, Lock, Unlock, RefreshCw, Eye, MessageSquare, Printer, AlertCircle, Info, Building, Scale, UserCheck } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { formatAccounting } from '@/lib/formatters';
import { PageShell } from "@/components/page-shell";
import { useEQCRSaveBridge } from "@/hooks/use-eqcr-save-bridge";
import { AIAssistBanner, PHASE_AI_CONFIGS } from "@/components/ai-assist-banner";

interface ChecklistItem {
  id: string;
  srNo: number;
  checklistArea: string;
  descriptionOfReview: string | null;
  isAIAssisted: boolean;
  aiDraftContent: string | null;
  response: "YES" | "NO" | "NOT_SIGNIFICANT" | null;
  remarks: string | null;
  reviewedBy?: { id: string; fullName: string } | null;
  reviewedAt: string | null;
  attachments: Array<{
    id: string;
    fileName: string;
    originalName: string;
    fileSize: number;
    uploadedBy?: { id: string; fullName: string };
    uploadedAt: string;
  }>;
}

interface PartnerComment {
  id: string;
  overallConclusion: string | null;
  mattersForAttention: string | null;
  clearanceConditions: string | null;
  hasClearance: boolean;
  clearanceStatus: "CLEARED" | "CLEARED_WITH_CONDITIONS" | "NOT_CLEARED" | null;
  createdBy?: { id: string; fullName: string; role: string } | null;
  createdAt: string;
}

interface SignedReport {
  id: string;
  fileName: string;
  originalName: string;
  fileSize: number;
  version: number;
  isCurrentVersion: boolean;
  uploadedBy?: { id: string; fullName: string } | null;
  uploadedAt: string;
}

interface EQCRAssignment {
  id: string;
  isRequired: boolean;
  requirementReason: string | null;
  status: string;
  assignedReviewer?: { id: string; fullName: string; role: string } | null;
  assignedBy?: { id: string; fullName: string; role: string } | null;
  assignedDate: string | null;
  reviewStartDate: string | null;
  reviewCompletedDate: string | null;
  clearanceDate: string | null;
  isFinalized: boolean;
  finalizedAt: string | null;
  aiGeneratedSummary: string | null;
  aiSummaryGeneratedAt: string | null;
  checklistItems: ChecklistItem[];
  partnerComment: PartnerComment | null;
  signedReports: SignedReport[];
}

export default function EQCR() {
  const params = useParams<{ engagementId: string }>();
  const { 
    engagementId: contextEngagementId, 
    engagement, 
    client,
    getPhaseStatus,
    refreshEngagement 
  } = useEngagement();
  const engagementId = params.engagementId || contextEngagementId || undefined;
  const { toast } = useToast();

  const [assignment, setAssignment] = useState<EQCRAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [showSummaryDialog, setShowSummaryDialog] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [showAddItemDialog, setShowAddItemDialog] = useState(false);
  const [newItemArea, setNewItemArea] = useState("");
  const [partnerConclusion, setPartnerConclusion] = useState("");
  const [mattersForAttention, setMattersForAttention] = useState("");
  const [clearanceConditions, setClearanceConditions] = useState("");
  const [hasClearance, setHasClearance] = useState(false);
  const [clearanceStatus, setClearanceStatus] = useState<"CLEARED" | "CLEARED_WITH_CONDITIONS" | "NOT_CLEARED" | "">("");
  const [reopenReason, setReopenReason] = useState("");
  const [printingReport, setPrintingReport] = useState(false);
  const [showReopenDialog, setShowReopenDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const signedReportInputRef = useRef<HTMLInputElement>(null);

  // Build payload for saving
  const buildEQCRPayload = () => ({
    assignment,
    partnerConclusion,
    mattersForAttention,
    clearanceConditions,
    hasClearance,
    clearanceStatus,
    activeItemId
  });

  // Initialize save engine
  const saveEngine = useEQCRSaveBridge(engagementId, buildEQCRPayload);

  const fetchAssignment = useCallback(async () => {
    if (!engagementId) return;
    try {
      const response = await fetchWithAuth(`/api/eqcr/${engagementId}/assignment`);
      if (response.ok) {
        const data = await response.json();
        setAssignment(data);
        if (data?.partnerComment) {
          setPartnerConclusion(data.partnerComment.overallConclusion || "");
          setMattersForAttention(data.partnerComment.mattersForAttention || "");
          setClearanceConditions(data.partnerComment.clearanceConditions || "");
          setHasClearance(data.partnerComment.hasClearance || false);
          setClearanceStatus(data.partnerComment.clearanceStatus || "");
        }
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to fetch EQCR data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [engagementId, toast]);

  useEffect(() => {
    fetchAssignment();
  }, [fetchAssignment]);

  const startReview = async () => {
    if (!engagementId) return;
    setSaving(true);
    try {
      const response = await fetchWithAuth(`/api/eqcr/${engagementId}/start-review`, {
        method: "POST",
      });
      if (response.ok) {
        toast({ title: "Success", description: "EQCR review started" });
        await fetchAssignment();
      } else {
        const error = await response.json();
        toast({ title: "Error", description: error.error || "Failed to start review", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to start review", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const updateChecklistItem = async (itemId: string, updates: Partial<ChecklistItem>) => {
    if (!engagementId) return;
    setSaving(true);
    try {
      const response = await fetchWithAuth(`/api/eqcr/${engagementId}/checklist-items/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (response.ok) {
        await fetchAssignment();
        toast({ title: "Saved", description: "Checklist item updated" });
      } else {
        const error = await response.json();
        toast({ title: "Error", description: error.error || "Failed to update", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to update", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const getAISuggestion = async (itemId: string) => {
    if (!engagementId) return;
    setSaving(true);
    try {
      const response = await fetchWithAuth(`/api/eqcr/${engagementId}/ai-assist/${itemId}`, {
        method: "POST",
      });
      if (response.ok) {
        const data = await response.json();
        const item = assignment?.checklistItems.find(i => i.id === itemId);
        if (item) {
          await updateChecklistItem(itemId, {
            descriptionOfReview: data.suggestion,
            isAIAssisted: true,
            aiDraftContent: data.suggestion,
          });
        }
        toast({ title: "AI Suggestion", description: "Description generated" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to get AI suggestion", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const addChecklistItem = async () => {
    if (!engagementId || !newItemArea.trim()) return;
    setSaving(true);
    try {
      const response = await fetchWithAuth(`/api/eqcr/${engagementId}/checklist-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checklistArea: newItemArea.trim() }),
      });
      if (response.ok) {
        await fetchAssignment();
        setNewItemArea("");
        setShowAddItemDialog(false);
        toast({ title: "Success", description: "Checklist item added" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to add item", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const uploadAttachment = async (itemId: string, file: File) => {
    if (!engagementId) return;
    const formData = new FormData();
    formData.append("file", file);
    setSaving(true);
    try {
      const response = await fetchWithAuth(`/api/eqcr/${engagementId}/checklist-items/${itemId}/upload`, {
        method: "POST",
        body: formData,
      });
      if (response.ok) {
        await fetchAssignment();
        toast({ title: "Success", description: "File uploaded" });
      } else {
        const error = await response.json();
        toast({ title: "Error", description: error.error || "Upload failed", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Upload failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const deleteAttachment = async (fileId: string) => {
    if (!engagementId) return;
    setSaving(true);
    try {
      const response = await fetchWithAuth(`/api/eqcr/${engagementId}/checklist-files/${fileId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        await fetchAssignment();
        toast({ title: "Success", description: "File deleted" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Delete failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const generateSummary = async () => {
    if (!engagementId) return;
    setGeneratingSummary(true);
    try {
      const response = await fetchWithAuth(`/api/eqcr/${engagementId}/generate-summary`, {
        method: "POST",
      });
      if (response.ok) {
        await fetchAssignment();
        setShowSummaryDialog(true);
        toast({ title: "Success", description: "Summary generated" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to generate summary", variant: "destructive" });
    } finally {
      setGeneratingSummary(false);
    }
  };

  const savePartnerComments = async () => {
    if (!engagementId) return;
    setSaving(true);
    try {
      const response = await fetchWithAuth(`/api/eqcr/${engagementId}/partner-comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overallConclusion: partnerConclusion,
          mattersForAttention,
          clearanceConditions,
          hasClearance,
          clearanceStatus: clearanceStatus || undefined,
        }),
      });
      if (response.ok) {
        await fetchAssignment();
        toast({ title: "Success", description: "Comments saved" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to save comments", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const printEQCRReport = async () => {
    if (!engagementId || !assignment) return;
    setPrintingReport(true);
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      
      const reportContent = document.createElement("div");
      reportContent.innerHTML = `
        <div style="font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1a365d; margin-bottom: 10px;">ENGAGEMENT QUALITY CONTROL REVIEW</h1>
            <h2 style="color: #4a5568; font-weight: normal;">ISQM 2 Compliant Report</h2>
            <p style="color: #718096;">Generated: ${new Date().toLocaleString()}</p>
          </div>
          
          <div style="background: #f7fafc; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
            <h3 style="color: #2d3748; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">Engagement Details</h3>
            <p><strong>EQCR Reviewer:</strong> ${assignment.assignedReviewer?.fullName || "Not Assigned"}</p>
            <p><strong>Review Start Date:</strong> ${assignment.reviewStartDate ? new Date(assignment.reviewStartDate).toLocaleDateString() : "N/A"}</p>
            <p><strong>Status:</strong> ${assignment.status}</p>
          </div>
          
          <div style="margin-bottom: 30px;">
            <h3 style="color: #2d3748; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">EQCR Checklist</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
              <thead>
                <tr style="background: #edf2f7;">
                  <th style="border: 1px solid #e2e8f0; padding: 8px; text-align: left;">Sr.</th>
                  <th style="border: 1px solid #e2e8f0; padding: 8px; text-align: left;">Review Area</th>
                  <th style="border: 1px solid #e2e8f0; padding: 8px; text-align: left;">Description</th>
                  <th style="border: 1px solid #e2e8f0; padding: 8px; text-align: center;">Response</th>
                  <th style="border: 1px solid #e2e8f0; padding: 8px; text-align: left;">Remarks</th>
                </tr>
              </thead>
              <tbody>
                ${assignment.checklistItems.map(item => `
                  <tr>
                    <td style="border: 1px solid #e2e8f0; padding: 8px;">${item.srNo}</td>
                    <td style="border: 1px solid #e2e8f0; padding: 8px;">${item.checklistArea}</td>
                    <td style="border: 1px solid #e2e8f0; padding: 8px;">${item.descriptionOfReview || "-"}${item.isAIAssisted ? " <em style='color: #3182ce;'>(AI-Assisted)</em>" : ""}</td>
                    <td style="border: 1px solid #e2e8f0; padding: 8px; text-align: center;">${item.response === "YES" ? "Yes" : item.response === "NO" ? "No" : item.response === "NOT_SIGNIFICANT" ? "N/S" : "-"}</td>
                    <td style="border: 1px solid #e2e8f0; padding: 8px;">${item.remarks || "-"}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
          
          ${assignment.aiGeneratedSummary ? `
          <div style="margin-bottom: 30px; background: #ebf8ff; padding: 20px; border-radius: 8px; border-left: 4px solid #3182ce;">
            <h3 style="color: #2c5282; margin-bottom: 10px;">AI-Generated Engagement Summary</h3>
            <p style="font-size: 10px; color: #4a5568; margin-bottom: 15px;"><em>System-Generated (AI) - Does Not Replace EQCR Judgment</em></p>
            <pre style="white-space: pre-wrap; font-size: 11px; font-family: inherit;">${assignment.aiGeneratedSummary}</pre>
          </div>
          ` : ""}
          
          <div style="margin-bottom: 30px; background: #f0fff4; padding: 20px; border-radius: 8px;">
            <h3 style="color: #276749; border-bottom: 2px solid #c6f6d5; padding-bottom: 10px;">EQCR Partner Response</h3>
            <p><strong>Overall Conclusion:</strong></p>
            <p style="background: white; padding: 10px; border-radius: 4px; min-height: 60px;">${partnerConclusion || "Not provided"}</p>
            <p><strong>Matters for Engagement Partner Attention:</strong></p>
            <p style="background: white; padding: 10px; border-radius: 4px; min-height: 40px;">${mattersForAttention || "None"}</p>
            <p><strong>Clearance Conditions:</strong></p>
            <p style="background: white; padding: 10px; border-radius: 4px; min-height: 40px;">${clearanceConditions || "None"}</p>
            <p><strong>Clearance Status:</strong> <span style="font-weight: bold; color: ${clearanceStatus === "CLEARED" ? "#276749" : clearanceStatus === "NOT_CLEARED" ? "#c53030" : "#b7791f"};">${clearanceStatus === "CLEARED" ? "Cleared" : clearanceStatus === "CLEARED_WITH_CONDITIONS" ? "Cleared with Conditions" : clearanceStatus === "NOT_CLEARED" ? "Not Cleared" : "Not Selected"}</span></p>
          </div>
          
          <div style="margin-top: 50px; border-top: 2px solid #e2e8f0; padding-top: 30px;">
            <h3 style="color: #2d3748;">Signatures</h3>
            <div style="display: flex; justify-content: space-between; margin-top: 30px;">
              <div style="text-align: center; width: 45%;">
                <div style="border-bottom: 1px solid #2d3748; margin-bottom: 10px; height: 60px;"></div>
                <p><strong>EQCR Reviewer</strong></p>
                <p>${assignment.assignedReviewer?.fullName || "_________________"}</p>
                <p>Date: _________________</p>
              </div>
              <div style="text-align: center; width: 45%;">
                <div style="border-bottom: 1px solid #2d3748; margin-bottom: 10px; height: 60px;"></div>
                <p><strong>Engagement Partner</strong></p>
                <p>_________________</p>
                <p>Date: _________________</p>
              </div>
            </div>
          </div>
        </div>
      `;

      const options = {
        margin: 10,
        filename: `EQCR_Report_${new Date().toISOString().split("T")[0]}.pdf`,
        image: { type: "jpeg" as const, quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: "mm" as const, format: "a4" as const, orientation: "portrait" as const }
      };

      await html2pdf().set(options).from(reportContent).save();
      toast({ title: "Success", description: "EQCR Report PDF generated" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to generate PDF", variant: "destructive" });
    } finally {
      setPrintingReport(false);
    }
  };

  const uploadSignedReport = async (file: File) => {
    if (!engagementId) return;
    const formData = new FormData();
    formData.append("file", file);
    setSaving(true);
    try {
      const response = await fetchWithAuth(`/api/eqcr/${engagementId}/upload-signed-report`, {
        method: "POST",
        body: formData,
      });
      if (response.ok) {
        await fetchAssignment();
        toast({ title: "Success", description: "Signed report uploaded" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Upload failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const finalizeEQCR = async () => {
    if (!engagementId) return;
    setSaving(true);
    try {
      const response = await fetchWithAuth(`/api/eqcr/${engagementId}/finalize`, {
        method: "POST",
      });
      if (response.ok) {
        await fetchAssignment();
        toast({ title: "Success", description: "EQCR finalized and locked" });
      } else {
        const error = await response.json();
        toast({ title: "Cannot Finalize", description: error.error || "Validation failed", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Finalization failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const reopenEQCR = async () => {
    if (!engagementId || !reopenReason.trim()) return;
    setSaving(true);
    try {
      const response = await fetchWithAuth(`/api/eqcr/${engagementId}/reopen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reopenReason }),
      });
      if (response.ok) {
        await fetchAssignment();
        setShowReopenDialog(false);
        setReopenReason("");
        toast({ title: "Success", description: "EQCR reopened" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to reopen", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const completedItems = assignment?.checklistItems.filter(i => i.response) || [];
  const openComments = assignment?.checklistItems.filter(i => i.response === "NO" && !i.remarks) || [];
  const isFinalized = assignment?.isFinalized || false;

  const getStatusBadge = () => {
    if (isFinalized) return <Badge className="bg-green-600">Finalized</Badge>;
    if (assignment?.status === "IN_PROGRESS") return <Badge variant="secondary">In Progress</Badge>;
    if (assignment?.status === "PENDING_CLEARANCE") return <Badge variant="outline" className="border-orange-500 text-orange-500">Pending Clearance</Badge>;
    if (assignment?.status === "ASSIGNED") return <Badge variant="outline">Assigned</Badge>;
    return <Badge variant="secondary">Not Started</Badge>;
  };

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <PageShell
      title="EQCR - Engagement Quality Control Review"
      subtitle={`ISQM 1, ISQM 2${client?.name ? ` | ${client.name}` : ""}${engagement?.engagementCode ? ` (${engagement.engagementCode})` : ""}`}
      icon={<Shield className="h-5 w-5 text-primary" />}
      useRegistry={true}
      backHref={`/workspace/${engagementId}/finalization`}
      nextHref={`/workspace/${engagementId}/deliverables`}
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
    <div className="w-full px-4 py-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-shrink-0">
          {getStatusBadge()}
          {isFinalized && <Lock className="h-4 w-4 text-muted-foreground" />}
        </div>
      </div>

      {engagementId && (
        <AIAssistBanner
          engagementId={engagementId}
          config={{
            ...PHASE_AI_CONFIGS.eqcr,
            contextBuilder: () => JSON.stringify({
              phase: "eqcr",
              engagementName: engagement?.engagementCode || "Unknown Engagement",
              clientName: client?.name || "Unknown Client",
              isFinalized,
              checklistItems: assignment?.checklistItems?.length || 0,
            }),
            onActionComplete: (actionId, content) => {
              toast({
                title: "AI Content Generated",
                description: `${actionId} content has been generated. Apply it to relevant fields.`,
              });
            },
          }}
        />
      )}

      <Card className="border-0 shadow-sm">
        <CardContent className="py-1.5 px-3">
          <div className="flex items-center flex-wrap divide-x">
            <div className="flex items-center gap-2 pr-4">
              <Shield className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
              <span className="text-xs text-muted-foreground">EQCR Reviewer:</span>
              <span className="font-medium text-sm">{assignment?.assignedReviewer?.fullName || "Not Assigned"}</span>
            </div>
            <div className="flex items-center gap-2 px-4">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
              <span className="text-xs text-muted-foreground">Progress:</span>
              <span className="font-bold text-sm">{completedItems.length} / {assignment?.checklistItems.length || 0}</span>
            </div>
            <div className="flex items-center gap-2 px-4">
              <AlertTriangle className="h-3.5 w-3.5 text-orange-500 flex-shrink-0" />
              <span className="text-xs text-muted-foreground">Issues Needing Remarks:</span>
              <span className="font-bold text-sm">{openComments.length}</span>
            </div>
            <div className="flex items-center gap-2 pl-4">
              <FileText className="h-3.5 w-3.5 text-purple-500 flex-shrink-0" />
              <span className="text-xs text-muted-foreground">Signed Report:</span>
              <span className="font-medium text-sm">{assignment?.signedReports.length ? `v${assignment.signedReports[0].version}` : "Not Uploaded"}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Read-Only Summary Outputs - Auto-pulled from earlier phases */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        <Card className="border-blue-200 bg-blue-50/30 dark:bg-blue-950/20">
          <CardContent className="py-2 px-3">
            <div className="flex items-center gap-2 mb-1">
              <Building className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
              <span className="text-xs font-medium">Engagement Summary</span>
              <Badge variant="outline" className="ml-auto text-[10px] py-0 px-1">Read-Only</Badge>
            </div>
            <div className="space-y-0.5 text-xs">
              <div className="flex justify-between gap-1">
                <span className="text-muted-foreground">Client:</span>
                <span className="font-medium" data-testid="text-engagement-client">{client?.name || "N/A"}</span>
              </div>
              <div className="flex justify-between gap-1">
                <span className="text-muted-foreground">Engagement:</span>
                <span className="font-medium" data-testid="text-engagement-code">{engagement?.engagementCode || "N/A"}</span>
              </div>
              <div className="flex justify-between gap-1">
                <span className="text-muted-foreground">Status:</span>
                <Badge variant="secondary" className="text-[10px] py-0 px-1">{assignment?.status || "Pending"}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-orange-50/30 dark:bg-orange-950/20">
          <CardContent className="py-2 px-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-3.5 w-3.5 text-orange-500 flex-shrink-0" />
              <span className="text-xs font-medium">Key Findings from Execution</span>
              <Badge variant="outline" className="ml-auto text-[10px] py-0 px-1">Read-Only</Badge>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-orange-600" data-testid="text-key-findings-count">{openComments.length}</span>
              <span className="text-[11px] text-muted-foreground">items requiring EQCR attention</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Pulled from Execution phase</p>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-purple-50/30 dark:bg-purple-950/20">
          <CardContent className="py-2 px-3">
            <div className="flex items-center gap-2 mb-1">
              <Scale className="h-3.5 w-3.5 text-purple-500 flex-shrink-0" />
              <span className="text-xs font-medium">Risk Areas Summary</span>
              <Badge variant="outline" className="ml-auto text-[10px] py-0 px-1">Read-Only</Badge>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-purple-600" data-testid="text-risk-areas-count">
                {assignment?.checklistItems.filter(i => i.response === "NO" || i.response === "NOT_SIGNIFICANT").length || 0}
              </span>
              <span className="text-[11px] text-muted-foreground">high-risk areas identified</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">From Risk Assessment (Planning phase)</p>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 justify-end">
        <Button
          variant="outline"
          onClick={generateSummary}
          disabled={generatingSummary || isFinalized}
          data-testid="button-generate-qcr-report"
        >
          <Sparkles className="h-4 w-4 mr-2" />
          {generatingSummary ? "Generating..." : "Generate QCR Report"}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            toast({
              title: "Clarification Request",
              description: "A clarification request has been sent to the engagement team.",
            });
          }}
          disabled={isFinalized}
          data-testid="button-request-clarification"
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          Request Clarification
        </Button>
        <Button
          onClick={() => {
            if (openComments.length > 0) {
              toast({
                title: "Cannot Submit to Partner",
                description: "Resolve all open items before submitting to partner.",
                variant: "destructive",
              });
              return;
            }
            toast({
              title: "Submitted to Partner",
              description: "EQCR has been submitted to the Partner for final approval.",
            });
          }}
          disabled={isFinalized || openComments.length > 0}
          data-testid="button-submit-to-partner"
        >
          <UserCheck className="h-4 w-4 mr-2" />
          Submit to Partner
        </Button>
      </div>

      {!assignment?.status || assignment.status === "NOT_REQUIRED" || assignment.status === "PENDING_ASSIGNMENT" ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">EQCR Review Not Started</h3>
            <p className="text-muted-foreground mb-4">Click below to begin the Engagement Quality Control Review.</p>
            <Button onClick={startReview} disabled={saving} data-testid="btn-start-eqcr-review"
              title={saving ? "Save in progress" : "Start Engagement Quality Control Review"}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Start EQCR Review
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>EQCR Checklist</CardTitle>
                <CardDescription>Quality review procedures per ISQM 2</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={generateSummary} disabled={generatingSummary || isFinalized}
                  data-testid="btn-generate-eqcr-summary"
                  title={isFinalized ? "EQCR is finalized" : generatingSummary ? "Generation in progress" : "Generate AI-powered EQCR summary"}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  {generatingSummary ? "Generating..." : "Generate Summary"}
                </Button>
                {!isFinalized && (
                  <Button variant="outline" size="sm" onClick={() => setShowAddItemDialog(true)}
                    data-testid="btn-add-eqcr-item"
                    title="Add a new checklist item"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="py-3 px-2 text-left w-12">Sr.</th>
                      <th className="py-3 px-2 text-left w-48">Checklist Area</th>
                      <th className="py-3 px-2 text-left">Description of Review</th>
                      <th className="py-3 px-2 text-center w-20">AI</th>
                      <th className="py-3 px-2 text-left w-36">Response</th>
                      <th className="py-3 px-2 text-left w-48">Remarks</th>
                      <th className="py-3 px-2 text-center w-24">Files</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignment?.checklistItems.map((item) => (
                      <tr key={item.id} className="border-b hover:bg-muted/30">
                        <td className="py-3 px-2">{item.srNo}</td>
                        <td className="py-3 px-2 font-medium">{item.checklistArea}</td>
                        <td className="py-3 px-2">
                          <Textarea
                            value={item.descriptionOfReview || ""}
                            onChange={(e) => {
                              const newItems = assignment.checklistItems.map(i => 
                                i.id === item.id ? { ...i, descriptionOfReview: e.target.value } : i
                              );
                              setAssignment({ ...assignment, checklistItems: newItems });
                            }}
                            onBlur={(e) => updateChecklistItem(item.id, { descriptionOfReview: e.target.value })}
                            placeholder="Enter description..."
                            className="min-h-[60px]"
                            disabled={isFinalized}
                          />
                          {item.isAIAssisted && (
                            <div className="mt-1 p-1 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700 flex items-center gap-1">
                              <Sparkles className="h-3 w-3 text-blue-500 flex-shrink-0" />
                              <span>AI-Assisted (Subject to Professional Judgment)</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-2 text-center">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => getAISuggestion(item.id)}
                                  disabled={saving || isFinalized}
                                  className="hover:bg-blue-50"
                                >
                                  <Sparkles className="h-4 w-4 text-blue-500" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="font-medium">AI Assist</p>
                                <p className="text-xs text-muted-foreground">Generate a suggested description. AI output is subject to professional judgment and must be reviewed.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </td>
                        <td className="py-3 px-2">
                          <Select
                            value={item.response || ""}
                            onValueChange={(value) => updateChecklistItem(item.id, { response: value as any })}
                            disabled={isFinalized}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="YES">Yes</SelectItem>
                              <SelectItem value="NO">No</SelectItem>
                              <SelectItem value="NOT_SIGNIFICANT">Not Significant</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-3 px-2">
                          <Textarea
                            value={item.remarks || ""}
                            onChange={(e) => {
                              const newItems = assignment.checklistItems.map(i => 
                                i.id === item.id ? { ...i, remarks: e.target.value } : i
                              );
                              setAssignment({ ...assignment, checklistItems: newItems });
                            }}
                            onBlur={(e) => updateChecklistItem(item.id, { remarks: e.target.value })}
                            placeholder={item.response === "NO" ? "Required..." : "Optional..."}
                            className={`min-h-[60px] ${item.response === "NO" && !item.remarks ? "border-red-300" : ""}`}
                            disabled={isFinalized}
                          />
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex flex-col gap-1">
                            {item.attachments.map((att) => (
                              <div key={att.id} className="flex items-center gap-1 text-xs">
                                <span className="truncate max-w-[80px]" title={att.originalName}>{att.originalName}</span>
                                {!isFinalized && (
                                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => deleteAttachment(att.id)}>
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                  </Button>
                                )}
                              </div>
                            ))}
                            {!isFinalized && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-xs"
                                onClick={() => {
                                  setActiveItemId(item.id);
                                  fileInputRef.current?.click();
                                }}
                                data-testid={`btn-upload-checklist-${item.id}`}
                                title="Upload supporting file"
                              >
                                <Upload className="h-3 w-3 mr-1" />
                                Upload
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                EQCR Partner Comments & Conclusion
              </CardTitle>
              <CardDescription>Document the overall conclusion and any clearance conditions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Overall Conclusion</Label>
                <Textarea
                  value={partnerConclusion}
                  onChange={(e) => setPartnerConclusion(e.target.value)}
                  placeholder="Enter the overall conclusion from the EQCR review..."
                  className="min-h-[100px]"
                  disabled={isFinalized}
                />
              </div>
              <div>
                <Label>Matters for Attention</Label>
                <Textarea
                  value={mattersForAttention}
                  onChange={(e) => setMattersForAttention(e.target.value)}
                  placeholder="Document any significant matters requiring attention..."
                  className="min-h-[80px]"
                  disabled={isFinalized}
                />
              </div>
              <div>
                <Label>Clearance Conditions (if any)</Label>
                <Textarea
                  value={clearanceConditions}
                  onChange={(e) => setClearanceConditions(e.target.value)}
                  placeholder="Specify any conditions that must be met before clearance..."
                  className="min-h-[80px]"
                  disabled={isFinalized}
                />
              </div>
              <div>
                <Label>EQCR Clearance Status</Label>
                <Select
                  value={clearanceStatus}
                  onValueChange={(value) => setClearanceStatus(value as any)}
                  disabled={isFinalized}
                >
                  <SelectTrigger className="w-full mt-1">
                    <SelectValue placeholder="Select clearance status..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CLEARED">Cleared</SelectItem>
                    <SelectItem value="CLEARED_WITH_CONDITIONS">Cleared with Conditions</SelectItem>
                    <SelectItem value="NOT_CLEARED">Not Cleared</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {!isFinalized && (
                <Button onClick={savePartnerComments} disabled={saving}>
                  Save Comments
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                EQCR Report - Print, Sign & Upload
              </CardTitle>
              <CardDescription>Generate PDF, manually sign, and upload the signed document</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button variant="outline" onClick={printEQCRReport} disabled={printingReport}>
                  <Printer className="h-4 w-4 mr-2" />
                  {printingReport ? "Generating PDF..." : "Print EQCR Report"}
                </Button>
              </div>
              
              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-2">Signed Report</p>
                {assignment?.signedReports.length > 0 ? (
                  <div className="space-y-2">
                    {assignment.signedReports.map((report) => (
                      <div key={report.id} className="flex items-center justify-between p-3 border rounded-lg bg-green-50">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-green-600" />
                          <div>
                            <p className="font-medium">{report.originalName}</p>
                            <p className="text-xs text-muted-foreground">
                              Version {report.version} | Uploaded by {report.uploadedBy?.fullName} | {new Date(report.uploadedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">Current</Badge>
                          <a href={`/api/eqcr/files/${report.fileName}`} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No signed report uploaded yet. Print the report, sign manually, then upload.</p>
                )}
                {!isFinalized && (
                  <Button variant="outline" className="mt-3" onClick={() => signedReportInputRef.current?.click()}
                    data-testid="btn-upload-signed-report"
                    title="Upload signed EQCR report"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Signed Report
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Finalization</CardTitle>
              <CardDescription>Lock the EQCR review after all requirements are met</CardDescription>
            </CardHeader>
            <CardContent>
              {isFinalized ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-green-600">
                    <Lock className="h-5 w-5" />
                    <span>EQCR has been finalized and locked on {assignment?.finalizedAt ? new Date(assignment.finalizedAt).toLocaleDateString() : "N/A"}</span>
                  </div>
                  <Button variant="outline" onClick={() => setShowReopenDialog(true)}
                    data-testid="btn-reopen-eqcr"
                    title="Reopen EQCR review (Partner only)"
                  >
                    <Unlock className="h-4 w-4 mr-2" />
                    Reopen (Partner Only)
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-sm space-y-1">
                    <p className={completedItems.length === assignment?.checklistItems.length ? "text-green-600" : "text-red-500"}>
                      {completedItems.length === assignment?.checklistItems.length ? "✓" : "✗"} All checklist items must have a response
                    </p>
                    <p className={openComments.length === 0 ? "text-green-600" : "text-red-500"}>
                      {openComments.length === 0 ? "✓" : "✗"} Remarks required for "No" responses ({openComments.length} missing)
                    </p>
                    <p className={partnerConclusion ? "text-green-600" : "text-red-500"}>
                      {partnerConclusion ? "✓" : "✗"} Overall conclusion required
                    </p>
                    <p className={clearanceStatus ? "text-green-600" : "text-red-500"}>
                      {clearanceStatus ? "✓" : "✗"} Clearance status must be selected
                    </p>
                    <p className={(assignment?.signedReports.length || 0) > 0 ? "text-green-600" : "text-red-500"}>
                      {(assignment?.signedReports.length || 0) > 0 ? "✓" : "✗"} Signed report must be uploaded
                    </p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button disabled={saving || completedItems.length !== assignment?.checklistItems.length || openComments.length > 0 || !partnerConclusion || !clearanceStatus || (assignment?.signedReports.length || 0) === 0}
                        data-testid="btn-finalize-eqcr"
                        title={saving ? "Save in progress" : completedItems.length !== assignment?.checklistItems.length ? "All checklist items must have a response" : openComments.length > 0 ? "Remarks required for all 'No' responses" : !partnerConclusion ? "Overall conclusion is required" : !clearanceStatus ? "Clearance status must be selected" : (assignment?.signedReports.length || 0) === 0 ? "Signed report must be uploaded" : "Finalize and lock the EQCR review"}
                      >
                        <Lock className="h-4 w-4 mr-2" />
                        Finalize EQCR
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Finalize EQCR?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will lock the EQCR review. After finalization, no changes can be made unless reopened by a Partner.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={finalizeEQCR}>Finalize</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && activeItemId) {
            uploadAttachment(activeItemId, file);
          }
          e.target.value = "";
        }}
      />

      <input
        ref={signedReportInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            uploadSignedReport(file);
          }
          e.target.value = "";
        }}
      />

      <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Checklist Item</DialogTitle>
            <DialogDescription>Add a custom checklist item to the EQCR review.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Checklist Area</Label>
            <Input
              value={newItemArea}
              onChange={(e) => setNewItemArea(e.target.value)}
              placeholder="Enter the review area..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddItemDialog(false)} data-testid="button-cancel-add-item">Cancel</Button>
            <Button onClick={addChecklistItem} disabled={!newItemArea.trim() || saving}>Add Item</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSummaryDialog} onOpenChange={setShowSummaryDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-500" />
              AI-Generated EQCR Engagement Review Report
            </DialogTitle>
            <DialogDescription>
              <div className="flex items-center gap-2 mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <span className="text-blue-700 font-medium">System-Generated (AI) — Does Not Replace EQCR Judgment</span>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="border border-muted rounded-lg overflow-hidden">
            <div className="bg-muted/50 px-4 py-2 text-xs text-muted-foreground flex items-center gap-2">
              <Info className="h-3 w-3" />
              This report is read-only and cannot be edited. Professional judgment of EQCR Partner shall always prevail.
            </div>
            <pre className="whitespace-pre-wrap text-sm p-4 overflow-auto max-h-[50vh] bg-white">
              {assignment?.aiGeneratedSummary || "No summary generated yet."}
            </pre>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSummaryDialog(false)} data-testid="button-close-summary">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showReopenDialog} onOpenChange={setShowReopenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reopen EQCR</DialogTitle>
            <DialogDescription>Provide a reason for reopening the finalized EQCR review.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Reason for Reopening</Label>
            <Textarea
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              placeholder="Enter the reason..."
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReopenDialog(false)} data-testid="button-cancel-reopen">Cancel</Button>
            <Button onClick={reopenEQCR} disabled={!reopenReason.trim() || saving}>Reopen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </PageShell>
  );
}
