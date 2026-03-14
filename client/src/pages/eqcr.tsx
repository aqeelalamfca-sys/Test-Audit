import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "wouter";
import { AIAssistantPanel } from "@/components/ai-assistant-panel";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Shield, CheckCircle2, AlertTriangle, FileText, Plus, Sparkles, Upload,
  Trash2, Lock, Unlock, RefreshCw, Eye, MessageSquare, Printer,
  AlertCircle, Info, Building, Scale, UserCheck, ClipboardCheck,
  Package, Brain, BarChart3, Send, XCircle
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { PageShell } from "@/components/page-shell";
import { usePhaseRoleGuard } from "@/hooks/use-phase-role-guard";
import { useEQCRSaveBridge } from "@/hooks/use-eqcr-save-bridge";
import { useAuth } from "@/lib/auth";
import { getDocumentHeaderHtml } from "@/lib/pdf-logo";

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

interface EQCRCommentItem {
  id: string;
  commentReference: string | null;
  area: string | null;
  comment: string;
  severity: string;
  status: string;
  response: string | null;
  createdBy?: { id: string; fullName: string; role: string } | null;
  respondedBy?: { id: string; fullName: string; role: string } | null;
  clearedBy?: { id: string; fullName: string; role: string } | null;
  respondedDate: string | null;
  clearedDate: string | null;
  createdAt: string;
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
  comments: EQCRCommentItem[];
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
  const roleGuard = usePhaseRoleGuard("eqcr", "EQCR");
  const { toast } = useToast();
  const { firm } = useAuth();

  const [assignment, setAssignment] = useState<EQCRAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [showSummaryDialog, setShowSummaryDialog] = useState(false);
  const [showUnresolvedDialog, setShowUnresolvedDialog] = useState(false);
  const [unresolvedSummary, setUnresolvedSummary] = useState("");
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [generatingUnresolved, setGeneratingUnresolved] = useState(false);
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
  const [activeTab, setActiveTab] = useState("dashboard");
  const [newCommentRef, setNewCommentRef] = useState("");
  const [newCommentArea, setNewCommentArea] = useState("");
  const [newCommentText, setNewCommentText] = useState("");
  const [newCommentSeverity, setNewCommentSeverity] = useState("INFO");
  const [respondText, setRespondText] = useState("");
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const signedReportInputRef = useRef<HTMLInputElement>(null);

  const buildEQCRPayload = () => ({
    assignment,
    partnerConclusion,
    mattersForAttention,
    clearanceConditions,
    hasClearance,
    clearanceStatus,
    activeItemId
  });

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
      const response = await fetchWithAuth(`/api/eqcr/${engagementId}/start-review`, { method: "POST" });
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
      const response = await fetchWithAuth(`/api/eqcr/${engagementId}/ai-assist/${itemId}`, { method: "POST" });
      if (response.ok) {
        const data = await response.json();
        await updateChecklistItem(itemId, {
          descriptionOfReview: data.suggestion,
          isAIAssisted: true,
          aiDraftContent: data.suggestion,
        });
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
      const response = await fetchWithAuth(`/api/eqcr/${engagementId}/checklist-files/${fileId}`, { method: "DELETE" });
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
      const response = await fetchWithAuth(`/api/eqcr/${engagementId}/generate-summary`, { method: "POST" });
      if (response.ok) {
        await fetchAssignment();
        setShowSummaryDialog(true);
        toast({ title: "Success", description: "Readiness summary generated" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to generate summary", variant: "destructive" });
    } finally {
      setGeneratingSummary(false);
    }
  };

  const generateUnresolvedSummary = async () => {
    if (!engagementId) return;
    setGeneratingUnresolved(true);
    try {
      const response = await fetchWithAuth(`/api/eqcr/${engagementId}/generate-unresolved-summary`, { method: "POST" });
      if (response.ok) {
        const data = await response.json();
        setUnresolvedSummary(data.summary);
        setShowUnresolvedDialog(true);
        toast({ title: "Success", description: "Unresolved issues summary generated" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to generate summary", variant: "destructive" });
    } finally {
      setGeneratingUnresolved(false);
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

  const addComment = async () => {
    if (!engagementId || !newCommentText.trim()) return;
    setSaving(true);
    try {
      const response = await fetchWithAuth(`/api/eqcr/${engagementId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commentReference: newCommentRef.trim() || undefined,
          area: newCommentArea.trim() || undefined,
          comment: newCommentText.trim(),
          severity: newCommentSeverity,
        }),
      });
      if (response.ok) {
        await fetchAssignment();
        setNewCommentRef("");
        setNewCommentArea("");
        setNewCommentText("");
        setNewCommentSeverity("INFO");
        toast({ title: "Success", description: "Comment added" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to add comment", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const respondToComment = async (commentId: string) => {
    if (!engagementId || !respondText.trim()) return;
    setSaving(true);
    try {
      const response = await fetchWithAuth(`/api/eqcr/${engagementId}/comments/${commentId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: respondText.trim() }),
      });
      if (response.ok) {
        await fetchAssignment();
        setRespondText("");
        setRespondingId(null);
        toast({ title: "Success", description: "Response saved" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to respond", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const clearComment = async (commentId: string) => {
    if (!engagementId) return;
    setSaving(true);
    try {
      const response = await fetchWithAuth(`/api/eqcr/${engagementId}/comments/${commentId}/clear`, { method: "POST" });
      if (response.ok) {
        await fetchAssignment();
        toast({ title: "Success", description: "Comment cleared" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to clear comment", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const printEQCRReport = async () => {
    if (!engagementId || !assignment) return;
    setPrintingReport(true);
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      const headerHtml = await getDocumentHeaderHtml(firm?.logoUrl, firm?.name);

      const reportContent = document.createElement("div");
      reportContent.innerHTML = `
        <div style="font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto;">
          <div style="margin-bottom: 30px; border-bottom: 2px solid #1a365d; padding-bottom: 20px;">
            ${headerHtml}
            <h1 style="color: #1a365d; margin-bottom: 10px; text-align: center;">ENGAGEMENT QUALITY CONTROL REVIEW</h1>
            <h2 style="color: #4a5568; font-weight: normal; text-align: center;">ISQM 2 Compliant Report</h2>
            <p style="color: #718096; text-align: center;">Generated: ${new Date().toLocaleString()}</p>
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
            <h3 style="color: #276749; border-bottom: 2px solid #c6f6d5; padding-bottom: 10px;">EQCR Conclusion</h3>
            <p><strong>Overall Conclusion:</strong></p>
            <p style="background: white; padding: 10px; border-radius: 4px; min-height: 60px;">${partnerConclusion || "Not provided"}</p>
            <p><strong>Matters for Attention:</strong></p>
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
      const response = await fetchWithAuth(`/api/eqcr/${engagementId}/finalize`, { method: "POST" });
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
  const openChecklistIssues = assignment?.checklistItems.filter(i => i.response === "NO" && !i.remarks) || [];
  const openComments = assignment?.comments?.filter(c => c.status !== "CLEARED") || [];
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
      <div className="p-2.5 flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <PageShell
      showTopBar={false}
      title="EQCR - Engagement Quality Control Review"
      subtitle={`ISQM 1, ISQM 2${client?.name ? ` | ${client.name}` : ""}${engagement?.engagementCode ? ` (${engagement.engagementCode})` : ""}`}
      icon={<Shield className="h-5 w-5 text-primary" />}
      useRegistry={true}
      backHref={`/workspace/${engagementId}/opinion-reports`}
      nextHref={`/workspace/${engagementId}/inspection`}
      dashboardHref="/engagements"
      signoffPhase="EQCR"
      signoffSection="eqcr"
      readOnly={roleGuard.isReadOnly}
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
    <div className="w-full px-3 py-3 space-y-3">
      <AIAssistantPanel engagementId={engagementId || ""} phaseKey="eqcr" className="mb-2" />
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-shrink-0">
          {getStatusBadge()}
          {isFinalized && <Lock className="h-4 w-4 text-muted-foreground" />}
        </div>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="py-1.5 px-3">
          <div className="flex items-center flex-wrap divide-x">
            <div className="flex items-center gap-2 pr-4">
              <Shield className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
              <span className="text-xs text-muted-foreground">EQCR Reviewer:</span>
              <span className="font-medium text-sm">{assignment?.assignedReviewer?.fullName || "Not Assigned"}</span>
            </div>
            <div className="flex items-center gap-2 px-3">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
              <span className="text-xs text-muted-foreground">Progress:</span>
              <span className="font-bold text-sm">{completedItems.length} / {assignment?.checklistItems.length || 0}</span>
            </div>
            <div className="flex items-center gap-2 px-3">
              <AlertTriangle className="h-3.5 w-3.5 text-orange-500 flex-shrink-0" />
              <span className="text-xs text-muted-foreground">Open Matters:</span>
              <span className="font-bold text-sm">{openComments.length + openChecklistIssues.length}</span>
            </div>
            <div className="flex items-center gap-2 px-3">
              <FileText className="h-3.5 w-3.5 text-purple-500 flex-shrink-0" />
              <span className="text-xs text-muted-foreground">Signed Report:</span>
              <span className="font-medium text-sm">{assignment?.signedReports.length ? `v${assignment.signedReports[0].version}` : "Not Uploaded"}</span>
            </div>
            <div className="flex items-center gap-2 pl-4">
              <Scale className="h-3.5 w-3.5 text-indigo-500 flex-shrink-0" />
              <span className="text-xs text-muted-foreground">Clearance:</span>
              <span className={`font-bold text-sm ${clearanceStatus === "CLEARED" ? "text-green-600" : clearanceStatus === "NOT_CLEARED" ? "text-red-600" : clearanceStatus ? "text-amber-600" : "text-muted-foreground"}`}>
                {clearanceStatus === "CLEARED" ? "Cleared" : clearanceStatus === "CLEARED_WITH_CONDITIONS" ? "Conditional" : clearanceStatus === "NOT_CLEARED" ? "Not Cleared" : "Pending"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {!assignment?.status || assignment.status === "NOT_REQUIRED" || assignment.status === "PENDING_ASSIGNMENT" ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-2.5" />
            <h3 className="text-lg font-semibold mb-2">EQCR Review Not Started</h3>
            <p className="text-muted-foreground mb-2.5">Click below to begin the Engagement Quality Control Review.</p>
            <Button onClick={startReview} disabled={saving} data-testid="btn-start-eqcr-review"
              title={saving ? "Save in progress" : "Start Engagement Quality Control Review"}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Start EQCR Review
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="dashboard">
              <BarChart3 className="h-3.5 w-3.5" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="open-matters">
              <AlertTriangle className="h-3.5 w-3.5" />
              Open Matters
              {(openComments.length + openChecklistIssues.length) > 0 && (
                <Badge variant="destructive" className="ml-1 text-[10px] px-1 py-0 h-4">{openComments.length + openChecklistIssues.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="report-pack">
              <Package className="h-3.5 w-3.5" />
              Report Pack
            </TabsTrigger>
            <TabsTrigger value="key-judgments">
              <Scale className="h-3.5 w-3.5" />
              Key Judgments
            </TabsTrigger>
            <TabsTrigger value="independence">
              <Shield className="h-3.5 w-3.5" />
              Independence
            </TabsTrigger>
            <TabsTrigger value="checklist">
              <ClipboardCheck className="h-3.5 w-3.5" />
              EQCR Checklist
            </TabsTrigger>
            <TabsTrigger value="clearance">
              <Lock className="h-3.5 w-3.5" />
              Clearance
            </TabsTrigger>
          </TabsList>

          {/* ─── TAB 1: Dashboard ─── */}
          <TabsContent value="dashboard" className="space-y-3 mt-3">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <Card className="border-blue-200 bg-blue-50/30 dark:bg-blue-950/20">
                <CardContent className="py-3 px-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Building className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium">Engagement Summary</span>
                    <Badge variant="outline" className="ml-auto text-[10px] py-0 px-1">Read-Only</Badge>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">Client:</span><span className="font-medium">{client?.name || "N/A"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Engagement:</span><span className="font-medium">{engagement?.engagementCode || "N/A"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Reviewer:</span><span className="font-medium">{assignment?.assignedReviewer?.fullName || "Not Assigned"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Status:</span>{getStatusBadge()}</div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-orange-200 bg-orange-50/30 dark:bg-orange-950/20">
                <CardContent className="py-3 px-3">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    <span className="text-sm font-medium">Open Matters</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-bold text-orange-600">{openComments.length + openChecklistIssues.length}</span>
                    <span className="text-xs text-muted-foreground">items requiring attention</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1 space-y-0.5">
                    <p>{openComments.length} open comment(s)</p>
                    <p>{openChecklistIssues.length} "No" item(s) without remarks</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-green-200 bg-green-50/30 dark:bg-green-950/20">
                <CardContent className="py-3 px-3">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium">Completion Progress</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-bold text-green-600">
                      {assignment?.checklistItems.length ? Math.round((completedItems.length / assignment.checklistItems.length) * 100) : 0}%
                    </span>
                    <span className="text-xs text-muted-foreground">({completedItems.length}/{assignment?.checklistItems.length || 0} items)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div
                      className="bg-green-500 h-2 rounded-full transition-all"
                      style={{ width: `${assignment?.checklistItems.length ? (completedItems.length / assignment.checklistItems.length) * 100 : 0}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex items-center gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={generateSummary} disabled={generatingSummary || isFinalized}>
                <Brain className="h-4 w-4 mr-2" />
                {generatingSummary ? "Generating..." : "AI Readiness Summary"}
              </Button>
              <Button variant="outline" size="sm" onClick={generateUnresolvedSummary} disabled={generatingUnresolved || isFinalized}>
                <AlertCircle className="h-4 w-4 mr-2" />
                {generatingUnresolved ? "Generating..." : "AI Unresolved Issues"}
              </Button>
            </div>

            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Finalization Requirements</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className={`text-sm ${completedItems.length === assignment?.checklistItems.length ? "text-green-600" : "text-red-500"}`}>
                  {completedItems.length === assignment?.checklistItems.length ? "✓" : "✗"} All checklist items responded ({completedItems.length}/{assignment?.checklistItems.length || 0})
                </p>
                <p className={`text-sm ${openChecklistIssues.length === 0 ? "text-green-600" : "text-red-500"}`}>
                  {openChecklistIssues.length === 0 ? "✓" : "✗"} Remarks for all "No" responses ({openChecklistIssues.length} missing)
                </p>
                <p className={`text-sm ${openComments.length === 0 ? "text-green-600" : "text-red-500"}`}>
                  {openComments.length === 0 ? "✓" : "✗"} All comments cleared ({openComments.length} open)
                </p>
                <p className={`text-sm ${partnerConclusion ? "text-green-600" : "text-red-500"}`}>
                  {partnerConclusion ? "✓" : "✗"} Overall conclusion documented
                </p>
                <p className={`text-sm ${clearanceStatus ? "text-green-600" : "text-red-500"}`}>
                  {clearanceStatus ? "✓" : "✗"} Clearance status selected
                </p>
                <p className={`text-sm ${(assignment?.signedReports.length || 0) > 0 ? "text-green-600" : "text-red-500"}`}>
                  {(assignment?.signedReports.length || 0) > 0 ? "✓" : "✗"} Signed report uploaded
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── TAB 2: Open Matters ─── */}
          <TabsContent value="open-matters" className="space-y-3 mt-3">
            <Card>
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      EQCR Comments & Critical Matters
                    </CardTitle>
                    <CardDescription className="text-xs">Raise and track matters requiring engagement team attention</CardDescription>
                  </div>
                  <Badge variant={openComments.length > 0 ? "destructive" : "secondary"}>
                    {openComments.length} Open
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {!isFinalized && (
                  <div className="border rounded-lg p-3 bg-muted/30 space-y-2">
                    <p className="text-xs font-medium">Add New Comment</p>
                    <div className="grid grid-cols-3 gap-2">
                      <Input placeholder="Reference (e.g. WP-101)" value={newCommentRef} onChange={e => setNewCommentRef(e.target.value)} className="text-xs" />
                      <Input placeholder="Area (e.g. Revenue)" value={newCommentArea} onChange={e => setNewCommentArea(e.target.value)} className="text-xs" />
                      <Select value={newCommentSeverity} onValueChange={setNewCommentSeverity}>
                        <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="INFO">Info</SelectItem>
                          <SelectItem value="WARNING">Warning</SelectItem>
                          <SelectItem value="CRITICAL">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Textarea placeholder="Describe the matter..." value={newCommentText} onChange={e => setNewCommentText(e.target.value)} className="min-h-[60px] text-xs" />
                    <Button size="sm" onClick={addComment} disabled={!newCommentText.trim() || saving}>
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add Comment
                    </Button>
                  </div>
                )}

                {(assignment?.comments || []).length === 0 ? (
                  <div className="text-center py-2 text-muted-foreground">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No comments raised yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(assignment?.comments || []).map(comment => (
                      <div key={comment.id} className={`border rounded-lg p-3 ${comment.status === "CLEARED" ? "bg-green-50/50 border-green-200" : comment.severity === "CRITICAL" ? "bg-red-50/50 border-red-200" : "bg-white"}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant={comment.severity === "CRITICAL" ? "destructive" : comment.severity === "WARNING" ? "outline" : "secondary"} className="text-[10px] px-1 py-0">
                                {comment.severity}
                              </Badge>
                              {comment.commentReference && <span className="text-xs font-mono text-muted-foreground">{comment.commentReference}</span>}
                              {comment.area && <span className="text-xs text-muted-foreground">| {comment.area}</span>}
                              <Badge variant={comment.status === "CLEARED" ? "default" : comment.status === "ADDRESSED" ? "outline" : "secondary"} className="text-[10px] px-1 py-0 ml-auto">
                                {comment.status}
                              </Badge>
                            </div>
                            <p className="text-sm">{comment.comment}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">By {comment.createdBy?.fullName} on {new Date(comment.createdAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                        {comment.response && (
                          <div className="mt-2 pl-3 border-l-2 border-blue-300">
                            <p className="text-xs text-blue-700"><strong>Response:</strong> {comment.response}</p>
                            <p className="text-[10px] text-muted-foreground">By {comment.respondedBy?.fullName} on {comment.respondedDate ? new Date(comment.respondedDate).toLocaleDateString() : "N/A"}</p>
                          </div>
                        )}
                        {comment.status === "CLEARED" && comment.clearedBy && (
                          <div className="mt-1 pl-3 border-l-2 border-green-300">
                            <p className="text-[10px] text-green-700">Cleared by {comment.clearedBy.fullName} on {comment.clearedDate ? new Date(comment.clearedDate).toLocaleDateString() : "N/A"}</p>
                          </div>
                        )}
                        {!isFinalized && comment.status !== "CLEARED" && (
                          <div className="mt-2 flex gap-2">
                            {comment.status === "OPEN" && (
                              respondingId === comment.id ? (
                                <div className="flex-1 flex gap-2">
                                  <Input placeholder="Type response..." value={respondText} onChange={e => setRespondText(e.target.value)} className="text-xs flex-1" />
                                  <Button size="sm" variant="outline" onClick={() => respondToComment(comment.id)} disabled={!respondText.trim() || saving}>
                                    <Send className="h-3 w-3 mr-1" /> Send
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => { setRespondingId(null); setRespondText(""); }}>Cancel</Button>
                                </div>
                              ) : (
                                <Button size="sm" variant="outline" onClick={() => setRespondingId(comment.id)}>
                                  <MessageSquare className="h-3 w-3 mr-1" /> Respond
                                </Button>
                              )
                            )}
                            {comment.status === "ADDRESSED" && (
                              <Button size="sm" variant="outline" className="text-green-600" onClick={() => clearComment(comment.id)} disabled={saving}>
                                <CheckCircle2 className="h-3 w-3 mr-1" /> Clear
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── TAB 3: Report Pack Review ─── */}
          <TabsContent value="report-pack" className="space-y-3 mt-3">
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Report Pack Review
                  <Badge variant="outline" className="ml-auto text-[10px] py-0 px-1">Read-Only</Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  Review the report package assembled in Phase 16 (Opinion & Reports). The EQCR reviewer must verify completeness and accuracy.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="border rounded-lg p-3 bg-muted/20">
                    <p className="text-xs font-medium mb-1">Report Pack Status</p>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-500" />
                      <span className="text-sm">Assembled in Phase 16</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">Navigate to Opinion & Reports to view the full report package</p>
                  </div>
                  <div className="border rounded-lg p-3 bg-muted/20">
                    <p className="text-xs font-medium mb-1">Signed Reports</p>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-green-500" />
                      <span className="text-sm">{assignment?.signedReports.length || 0} version(s) uploaded</span>
                    </div>
                  </div>
                </div>
                <div className="border rounded-lg p-2.5">
                  <p className="text-xs font-medium mb-2">EQCR Report — Print, Sign & Upload</p>
                  <div className="flex gap-2 mb-3">
                    <Button variant="outline" size="sm" onClick={printEQCRReport} disabled={printingReport}>
                      <Printer className="h-4 w-4 mr-2" />
                      {printingReport ? "Generating PDF..." : "Print EQCR Report"}
                    </Button>
                    {!isFinalized && (
                      <Button variant="outline" size="sm" onClick={() => signedReportInputRef.current?.click()}>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Signed Report
                      </Button>
                    )}
                  </div>
                  {(assignment?.signedReports || []).length > 0 && (
                    <div className="space-y-2">
                      {assignment!.signedReports.map(report => (
                        <div key={report.id} className="flex items-center justify-between p-2 border rounded-lg bg-green-50">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-green-600" />
                            <div>
                              <p className="text-sm font-medium">{report.originalName}</p>
                              <p className="text-[10px] text-muted-foreground">v{report.version} | {report.uploadedBy?.fullName} | {new Date(report.uploadedAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 text-[10px]">Current</Badge>
                            <a href={`/api/eqcr/files/${report.fileName}`} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="sm"><Eye className="h-3.5 w-3.5" /></Button>
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── TAB 4: Key Judgments ─── */}
          <TabsContent value="key-judgments" className="space-y-3 mt-3">
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Scale className="h-4 w-4" />
                  Key Judgments Review
                  <Badge variant="outline" className="ml-auto text-[10px] py-0 px-1">Read-Only Summary</Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  ISQM 2 requires the EQCR reviewer to evaluate significant judgments made by the engagement team
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="border rounded-lg p-2.5 bg-purple-50/30">
                  <p className="text-xs font-medium mb-2">Areas Requiring Judgment Review</p>
                  <div className="space-y-2 text-sm">
                    {[
                      { area: "Significant Risks", desc: "Review identification and response to significant risks per ISA 315" },
                      { area: "Accounting Estimates", desc: "Evaluate reasonableness of significant estimates and assumptions" },
                      { area: "Materiality", desc: "Review materiality determination and its application throughout the audit" },
                      { area: "Going Concern", desc: "Assess management's going concern evaluation and audit conclusion" },
                      { area: "Audit Opinion", desc: "Evaluate appropriateness of the proposed audit opinion" },
                      { area: "Key Audit Matters", desc: "Review KAM selection and communication for listed entities" },
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-2 p-2 border rounded bg-white">
                        <Scale className="h-3.5 w-3.5 text-purple-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-xs">{item.area}</p>
                          <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Info className="h-3.5 w-3.5 text-blue-600" />
                    <span className="text-xs text-blue-700">Detailed review of each area is performed via the EQCR Checklist tab</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── TAB 5: Independence Summary ─── */}
          <TabsContent value="independence" className="space-y-3 mt-3">
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Independence & Ethics Review Summary
                  <Badge variant="outline" className="ml-auto text-[10px] py-0 px-1">Read-Only Summary</Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  EQCR reviewer must confirm independence and ethical requirements have been met per IESBA Code
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="border rounded-lg p-2.5 bg-indigo-50/30">
                  <p className="text-xs font-medium mb-2">Independence Verification Areas</p>
                  <div className="space-y-2 text-sm">
                    {[
                      { area: "Financial Interests", desc: "No prohibited financial interests held by team members or firm" },
                      { area: "Non-Audit Services", desc: "All non-audit services reviewed for independence threats" },
                      { area: "Team Relationships", desc: "No prohibited personal/business relationships with client" },
                      { area: "Fee Arrangements", desc: "Fee structure and overdue fees reviewed for self-interest threats" },
                      { area: "Partner Rotation", desc: "Engagement partner rotation requirements verified" },
                      { area: "Threat & Safeguards", desc: "All identified threats have appropriate safeguards documented" },
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-2 p-2 border rounded bg-white">
                        <Shield className="h-3.5 w-3.5 text-indigo-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-xs">{item.area}</p>
                          <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Info className="h-3.5 w-3.5 text-blue-600" />
                    <span className="text-xs text-blue-700">Independence assessment was performed in Phase 2. The EQCR reviewer confirms adequacy through the checklist.</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── TAB 6: EQCR Checklist ─── */}
          <TabsContent value="checklist" className="space-y-3 mt-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <div>
                  <CardTitle className="text-sm">EQCR Checklist</CardTitle>
                  <CardDescription className="text-xs">Quality review procedures per ISQM 2</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={generateSummary} disabled={generatingSummary || isFinalized}>
                    <Sparkles className="h-3.5 w-3.5 mr-1" />
                    {generatingSummary ? "Generating..." : "Generate Summary"}
                  </Button>
                  {!isFinalized && (
                    <Button variant="outline" size="sm" onClick={() => setShowAddItemDialog(true)}>
                      <Plus className="h-3.5 w-3.5 mr-1" />
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
                                  <Button variant="ghost" size="sm" onClick={() => getAISuggestion(item.id)} disabled={saving || isFinalized} className="hover:bg-blue-50">
                                    <Sparkles className="h-4 w-4 text-blue-500" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs">
                                  <p className="font-medium">AI Assist</p>
                                  <p className="text-xs text-muted-foreground">Generate a suggested description. AI output must be reviewed.</p>
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
                              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
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
                                <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => { setActiveItemId(item.id); fileInputRef.current?.click(); }}>
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
          </TabsContent>

          {/* ─── TAB 7: Clearance & Conclusion ─── */}
          <TabsContent value="clearance" className="space-y-3 mt-3">
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  EQCR Conclusion
                </CardTitle>
                <CardDescription className="text-xs">Document the overall conclusion, clearance conditions, and final determination</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5">
                <div>
                  <Label className="text-xs">Overall Conclusion</Label>
                  <Textarea
                    value={partnerConclusion}
                    onChange={(e) => setPartnerConclusion(e.target.value)}
                    placeholder="Enter the overall conclusion from the EQCR review..."
                    className="min-h-[100px]"
                    disabled={isFinalized}
                  />
                </div>
                <div>
                  <Label className="text-xs">Matters for Attention</Label>
                  <Textarea
                    value={mattersForAttention}
                    onChange={(e) => setMattersForAttention(e.target.value)}
                    placeholder="Document any significant matters requiring attention..."
                    className="min-h-[80px]"
                    disabled={isFinalized}
                  />
                </div>
                <div>
                  <Label className="text-xs">Clearance Conditions (if any)</Label>
                  <Textarea
                    value={clearanceConditions}
                    onChange={(e) => setClearanceConditions(e.target.value)}
                    placeholder="Specify any conditions that must be met before clearance..."
                    className="min-h-[80px]"
                    disabled={isFinalized}
                  />
                </div>
                <div>
                  <Label className="text-xs">EQCR Clearance Status</Label>
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
                      <SelectItem value="NOT_CLEARED">Not Cleared — Return for Correction</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {!isFinalized && (
                  <Button onClick={savePartnerComments} disabled={saving}>
                    Save Conclusion
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Finalization</CardTitle>
                <CardDescription className="text-xs">Lock the EQCR review after all requirements are met</CardDescription>
              </CardHeader>
              <CardContent>
                {isFinalized ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-green-600">
                      <Lock className="h-5 w-5" />
                      <span>EQCR finalized and locked on {assignment?.finalizedAt ? new Date(assignment.finalizedAt).toLocaleDateString() : "N/A"}</span>
                    </div>
                    <Button variant="outline" onClick={() => setShowReopenDialog(true)}>
                      <Unlock className="h-4 w-4 mr-2" />
                      Reopen (Partner Only)
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <div className="text-sm space-y-1">
                      <p className={completedItems.length === assignment?.checklistItems.length ? "text-green-600" : "text-red-500"}>
                        {completedItems.length === assignment?.checklistItems.length ? "✓" : "✗"} All checklist items must have a response
                      </p>
                      <p className={openChecklistIssues.length === 0 ? "text-green-600" : "text-red-500"}>
                        {openChecklistIssues.length === 0 ? "✓" : "✗"} Remarks required for "No" responses ({openChecklistIssues.length} missing)
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
                        <Button disabled={saving || completedItems.length !== assignment?.checklistItems.length || openChecklistIssues.length > 0 || !partnerConclusion || !clearanceStatus || (assignment?.signedReports.length || 0) === 0}>
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
          </TabsContent>
        </Tabs>
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
          <div className="py-2">
            <Label>Checklist Area</Label>
            <Input value={newItemArea} onChange={(e) => setNewItemArea(e.target.value)} placeholder="Enter the review area..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddItemDialog(false)}>Cancel</Button>
            <Button onClick={addChecklistItem} disabled={!newItemArea.trim() || saving}>Add Item</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSummaryDialog} onOpenChange={setShowSummaryDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-blue-500" />
              AI-Generated EQCR Readiness Summary
            </DialogTitle>
            <DialogDescription>
              <div className="flex items-center gap-2 mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <span className="text-blue-700 font-medium">System-Generated (AI) — Does Not Replace EQCR Judgment</span>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="border border-muted rounded-lg overflow-hidden">
            <div className="bg-muted/50 px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
              <Info className="h-3 w-3" />
              This report is read-only. Professional judgment of EQCR reviewer shall always prevail.
            </div>
            <pre className="whitespace-pre-wrap text-sm p-2.5 overflow-auto max-h-[50vh] bg-white">
              {assignment?.aiGeneratedSummary || "No summary generated yet."}
            </pre>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSummaryDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showUnresolvedDialog} onOpenChange={setShowUnresolvedDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              AI-Generated Unresolved Issues Summary
            </DialogTitle>
            <DialogDescription>
              <div className="flex items-center gap-2 mt-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <span className="text-orange-700 font-medium">System-Generated (AI) — All items must be resolved before EQCR clearance</span>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="border border-muted rounded-lg overflow-hidden">
            <div className="bg-muted/50 px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
              <Info className="h-3 w-3" />
              Review all unresolved matters below and address them through the Open Matters and Checklist tabs.
            </div>
            <pre className="whitespace-pre-wrap text-sm p-2.5 overflow-auto max-h-[50vh] bg-white">
              {unresolvedSummary || "No unresolved issues summary generated yet."}
            </pre>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUnresolvedDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showReopenDialog} onOpenChange={setShowReopenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reopen EQCR</DialogTitle>
            <DialogDescription>Provide a reason for reopening the finalized EQCR review.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label>Reason for Reopening</Label>
            <Textarea value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} placeholder="Enter the reason..." className="min-h-[100px]" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReopenDialog(false)}>Cancel</Button>
            <Button onClick={reopenEQCR} disabled={!reopenReason.trim() || saving}>Reopen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </PageShell>
  );
}
