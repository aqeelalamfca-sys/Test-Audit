import { useState, useEffect, useRef, Fragment } from "react";
import { useParams, Link } from "wouter";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useEngagement } from "@/lib/workspace-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SimpleTabNavigation } from "@/components/numbered-tab-navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth";
import { PageShell } from "@/components/page-shell";
import { useModuleReadOnly } from "@/components/sign-off-bar";
import { useFinalizationSaveBridge } from "@/hooks/use-finalization-save-bridge";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowRight, FileCheck, FileText, MessageSquare, Lock, CheckCircle2, 
  Plus, Upload, Eye, Trash2, Brain, RefreshCw, AlertTriangle, AlertCircle, Database,
  FileCheck2, Calendar, User, Shield, ClipboardCheck, TrendingDown,
  Building, ExternalLink, Users, FileSignature, Sparkles,
  Info, Edit, Save, Download, Scale, TrendingUp, FileSpreadsheet,
  ArrowUpDown, Layers
} from "lucide-react";
import { AIAssistBanner, PHASE_AI_CONFIGS } from "@/components/ai-assist-banner";
import { AIHelpIcon } from "@/components/ai-help";
import { PhaseLockIndicator } from "@/components/phase-approval-control";
import { LockGatePanel } from "@/components/control-pack";
import { useQuery } from "@tanstack/react-query";
import { FSSoCF } from "@/components/planning/fs-socf";
import { FSSoCE } from "@/components/planning/fs-soce";
import { FSNotes } from "@/components/planning/fs-notes";
import { NotesDisclosurePanel } from "@/components/finalization/notes-disclosure-panel";
import { FinalizationControlBoard } from "@/components/finalization/finalization-control-board";
import { AIOpinionEngine } from "@/components/finalization/ai-opinion-engine";
import type { DraftFSData, CoAAccountData, FSPriorYear, TrialBalanceData } from "@/components/planning/fs-types";

interface Attachment {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedBy: string;
  uploadedAt: string;
  url: string;
}

interface ChecklistItem {
  id: string;
  srNo: number;
  item: string;
  description: string;
  aiGenerated: boolean;
  response: "yes" | "no" | "na" | "";
  remarks: string;
  isaReference: string;
}

interface SubsequentEvent {
  id: string;
  eventRef: string;
  eventDescription: string;
  eventDate: string;
  identifiedDate: string;
  eventType: "adjusting" | "non-adjusting";
  impactAssessment: string;
  financialStatementImpact: string;
  auditorResponse: string;
  attachments: Attachment[];
  remarks: string;
}

interface GoingConcernIndicator {
  id: string;
  srNo: number;
  category: "financial" | "operating" | "external" | "management";
  indicator: string;
  description: string;
  aiGenerated: boolean;
  response: "yes" | "no" | "na" | "";
  remarks: string;
}

interface FinalizationNote {
  id: string;
  noteRef: string;
  noteDescription: string;
  enteredBy: string;
  date: string;
  attachments: Attachment[];
}

interface AuditApproval {
  role: string;
  name: string;
  date: string;
  status: "pending" | "approved";
}

const defaultChecklistItems: ChecklistItem[] = [
  { id: "c1", srNo: 1, item: "All audit procedures completed", description: "Verify that all planned audit procedures per ISA 500 have been executed, documented, and conclusions drawn. Ensure working papers are complete and cross-referenced.", aiGenerated: true, response: "", remarks: "", isaReference: "ISA 500" },
  { id: "c2", srNo: 2, item: "Subsequent events review performed", description: "Review events occurring between the date of the financial statements and the date of the auditor's report. Perform procedures to identify events requiring adjustment or disclosure per ISA 560.", aiGenerated: true, response: "", remarks: "", isaReference: "ISA 560" },
  { id: "c3", srNo: 3, item: "Going concern assessment completed", description: "Evaluate management's assessment of the entity's ability to continue as a going concern. Consider whether material uncertainties exist and proper disclosures are made per ISA 570.", aiGenerated: true, response: "", remarks: "", isaReference: "ISA 570" },
  { id: "c4", srNo: 4, item: "Management representations obtained", description: "Obtain written representations from management acknowledging their responsibility for the financial statements and confirming completeness of information provided per ISA 580.", aiGenerated: true, response: "", remarks: "", isaReference: "ISA 580" },
  { id: "c5", srNo: 5, item: "All review notes cleared", description: "Ensure all review notes raised during the engagement have been addressed and cleared. Document resolutions and obtain sign-off from reviewers per ISA 220.", aiGenerated: true, response: "", remarks: "", isaReference: "ISA 220" },
  { id: "c6", srNo: 6, item: "File documentation complete", description: "Assemble the audit file in a timely manner. Ensure all working papers are properly organized, dated, and signed. Complete audit documentation per ISA 230 requirements.", aiGenerated: true, response: "", remarks: "", isaReference: "ISA 230" },
  { id: "c7", srNo: 7, item: "Partner review completed", description: "Engagement partner has reviewed the audit file, significant judgments, and conclusions. Document the partner's review and approval per ISA 220 and ISQM-1.", aiGenerated: true, response: "", remarks: "", isaReference: "ISA 220, ISQM-1" },
];

const defaultGoingConcernIndicators: GoingConcernIndicator[] = [
  { id: "gc1", srNo: 1, category: "financial", indicator: "Net liability or net current liability position", description: "Entity has negative net assets or working capital deficiency indicating potential inability to meet short-term obligations.", aiGenerated: true, response: "", remarks: "" },
  { id: "gc2", srNo: 2, category: "financial", indicator: "Fixed-term borrowings approaching maturity without realistic prospects of renewal", description: "Significant debt obligations maturing with no refinancing arrangements in place.", aiGenerated: true, response: "", remarks: "" },
  { id: "gc3", srNo: 3, category: "financial", indicator: "Excessive reliance on short-term borrowings", description: "Over-reliance on short-term financing to fund long-term assets or operations.", aiGenerated: true, response: "", remarks: "" },
  { id: "gc4", srNo: 4, category: "financial", indicator: "Adverse key financial ratios", description: "Deteriorating liquidity, solvency, or profitability ratios compared to industry benchmarks.", aiGenerated: true, response: "", remarks: "" },
  { id: "gc5", srNo: 5, category: "financial", indicator: "Substantial operating losses or significant deterioration in assets", description: "Recurring losses from operations or material impairment of key assets.", aiGenerated: true, response: "", remarks: "" },
  { id: "gc6", srNo: 6, category: "operating", indicator: "Management intentions to liquidate or cease operations", description: "Board resolutions or management statements indicating intent to wind down operations.", aiGenerated: true, response: "", remarks: "" },
  { id: "gc7", srNo: 7, category: "operating", indicator: "Loss of key management without replacement", description: "Departure of key executives or directors without adequate succession planning.", aiGenerated: true, response: "", remarks: "" },
  { id: "gc8", srNo: 8, category: "operating", indicator: "Loss of major market, key customer, or principal supplier", description: "Loss of significant revenue source or critical supplier relationship.", aiGenerated: true, response: "", remarks: "" },
  { id: "gc9", srNo: 9, category: "operating", indicator: "Labor difficulties or shortages of important supplies", description: "Workforce disputes, strikes, or inability to obtain critical raw materials.", aiGenerated: true, response: "", remarks: "" },
  { id: "gc10", srNo: 10, category: "external", indicator: "Pending legal proceedings that may result in claims", description: "Litigation or regulatory actions that could result in material financial penalties.", aiGenerated: true, response: "", remarks: "" },
  { id: "gc11", srNo: 11, category: "external", indicator: "Changes in legislation or government policy expected to adversely affect the entity", description: "Regulatory changes, tax law amendments, or policy shifts impacting the business model.", aiGenerated: true, response: "", remarks: "" },
  { id: "gc12", srNo: 12, category: "external", indicator: "Non-compliance with capital or other statutory requirements", description: "Breach of regulatory capital requirements, license conditions, or statutory obligations.", aiGenerated: true, response: "", remarks: "" },
  { id: "gc13", srNo: 13, category: "management", indicator: "Adequacy of management's plans to address going concern issues", description: "Evaluate whether management has developed realistic and achievable plans to mitigate identified uncertainties.", aiGenerated: true, response: "", remarks: "" },
  { id: "gc14", srNo: 14, category: "management", indicator: "Feasibility of management's plans", description: "Assess whether the assumptions underlying management's plans are reasonable and achievable.", aiGenerated: true, response: "", remarks: "" },
];

const teamMembers = ["Partner", "Manager", "Senior Auditor", "Staff Auditor"];

export default function Finalization() {
  const params = useParams<{ engagementId: string }>();
  const { 
    engagementId: contextEngagementId, 
    engagement, 
    client,
    getPhaseStatus,
    canAccessPhase,
    refreshEngagement 
  } = useEngagement();
  const engagementId = params.engagementId || contextEngagementId || undefined;
  const { isReadOnly: finalizationReadOnly } = useModuleReadOnly("FINALIZATION", "FINALIZATION");
  const { user } = useAuth();
  const currentUserRole = user?.role || "staff";
  const isPartner = currentUserRole.toLowerCase() === "partner" || currentUserRole.toLowerCase() === "admin";
  const isManagerOrAbove = isPartner || currentUserRole.toLowerCase() === "manager";

  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>(defaultChecklistItems);
  const [subsequentEvents, setSubsequentEvents] = useState<SubsequentEvent[]>([]);
  const [goingConcernIndicators, setGoingConcernIndicators] = useState<GoingConcernIndicator[]>(defaultGoingConcernIndicators);
  const [finalizationNotes, setFinalizationNotes] = useState<FinalizationNote[]>([]);
  
  const [proceduresPerformed, setProceduresPerformed] = useState("");
  const [managementInquirySummary, setManagementInquirySummary] = useState("");
  const [writtenRepresentationsObtained, setWrittenRepresentationsObtained] = useState<"yes" | "no" | "">("");
  const [subsequentEventsConclusion, setSubsequentEventsConclusion] = useState<"satisfactory" | "unsatisfactory" | "">("");
  
  const [goingConcernConclusion, setGoingConcernConclusion] = useState<"no-material-uncertainty" | "material-uncertainty-exists" | "">("");
  const [basisForGoingConcernConclusion, setBasisForGoingConcernConclusion] = useState("");
  const [goingConcernReviewedBy, setGoingConcernReviewedBy] = useState("");
  const [goingConcernReviewDate, setGoingConcernReviewDate] = useState("");
  const [goingConcernAttachments, setGoingConcernAttachments] = useState<Attachment[]>([]);
  
  const [auditSummary, setAuditSummary] = useState("");
  const [auditOpinion, setAuditOpinion] = useState<"unmodified" | "qualified" | "adverse" | "disclaimer" | "">("");
  const [basisForModification, setBasisForModification] = useState("");
  const [emphasisOfMatter, setEmphasisOfMatter] = useState("");
  const [otherMatterParagraph, setOtherMatterParagraph] = useState("");
  const [approvals, setApprovals] = useState<AuditApproval[]>([
    { role: "Prepared By", name: "", date: "", status: "pending" },
    { role: "Reviewed By", name: "", date: "", status: "pending" },
    { role: "Partner Approval", name: "", date: "", status: "pending" },
  ]);
  
  const [fileStatus, setFileStatus] = useState<"open" | "locked">("open");
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isGeneratingOutputs, setIsGeneratingOutputs] = useState(false);

  const [writtenRepChecklist, setWrittenRepChecklist] = useState<boolean[]>(Array(8).fill(false));
  const [writtenRepEvidence, setWrittenRepEvidence] = useState<boolean[]>(Array(3).fill(false));
  const [writtenRepOutputs, setWrittenRepOutputs] = useState<boolean[]>(Array(1).fill(false));
  const [reportingOpinionChecklist, setReportingOpinionChecklist] = useState<boolean[]>(Array(7).fill(false));
  const [reportingOpinionType, setReportingOpinionType] = useState("");
  const [reportingEvidence, setReportingEvidence] = useState<boolean[]>(Array(3).fill(false));
  const [reportingOutputs, setReportingOutputs] = useState<boolean[]>(Array(2).fill(false));
  const [otherInfoChecklist, setOtherInfoChecklist] = useState<boolean[]>(Array(7).fill(false));
  const [otherInfoEvidence, setOtherInfoEvidence] = useState<boolean[]>(Array(4).fill(false));
  const [otherInfoOutputs, setOtherInfoOutputs] = useState<boolean[]>(Array(1).fill(false));

  const { data: draftFsData } = useQuery<DraftFSData>({
    queryKey: ['/api/fs-draft', engagementId],
    queryFn: async () => {
      if (!engagementId) throw new Error("No engagement ID");
      const response = await fetchWithAuth(`/api/fs-draft/${engagementId}?viewType=ADJUSTED`);
      if (!response.ok) throw new Error("Failed to fetch Draft FS data");
      return response.json();
    },
    enabled: !!engagementId,
    staleTime: 10000,
  });

  const { data: coaAccountsRaw } = useQuery<CoAAccountData[]>({
    queryKey: ['/api/engagements', engagementId, 'coa'],
    queryFn: async () => {
      if (!engagementId) throw new Error("No engagement ID");
      const response = await fetchWithAuth(`/api/engagements/${engagementId}/coa`);
      if (!response.ok) throw new Error("Failed to fetch CoA data");
      return response.json();
    },
    enabled: !!engagementId,
    staleTime: 10000,
  });
  const coaAccounts = coaAccountsRaw || [];

  const { data: preReportCheck } = useQuery<{ readyForDraft: boolean; readyForRelease: boolean; draftIssues: Array<{ type: string; count?: number; message: string }>; issues: Array<{ type: string; count?: number; message: string }> }>({
    queryKey: [`/api/finalization/${engagementId}/pre-report-check`],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/finalization/${engagementId}/pre-report-check`);
      if (!res.ok) throw new Error("Failed to fetch pre-report check");
      return res.json();
    },
    enabled: !!engagementId,
    staleTime: 30000,
  });

  const [fsSubTab, setFsSubTab] = useState("adjusted-bs");

  const fsPriorYear: FSPriorYear = {
    propertyPlantEquipment: "", intangibleAssets: "", inventories: "",
    tradeReceivables: "", cashBankBalances: "", shareCapital: "",
    retainedEarnings: "", revenue: "", costOfSales: "", adminExpenses: "",
    distributionCosts: "", otherOperatingIncome: "", financeIncome: "",
    financeCosts: "", incomeTax: "",
  };

  const trialBalance: TrialBalanceData = {
    fileUploaded: false, fileName: "", reportingPeriodEnd: "",
    currency: "PKR", validationStatus: "", profitBeforeTax: "",
    revenue: "", totalAssets: "", totalEquity: "",
    aiObservations: "", professionalNotes: "",
  };

  // Initialize activeTab from localStorage to preserve state during page refresh
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const saved = localStorage.getItem(`finalization-activeTab-${engagementId}`);
      // Migrate old tab values to new unified tab
      if (saved === "adjusted-bs" || saved === "adjusted-pl") {
        return "adjusted-fs";
      }
      return saved || "adjusted-fs";
    } catch {
      return "adjusted-fs";
    }
  });
  
  const [showAddEventDialog, setShowAddEventDialog] = useState(false);
  const [showViewEventDialog, setShowViewEventDialog] = useState(false);
  const [showEditEventDialog, setShowEditEventDialog] = useState(false);
  const [selectedEventIndex, setSelectedEventIndex] = useState<number | null>(null);
  const [showAddNoteDialog, setShowAddNoteDialog] = useState(false);
  const [newEventForm, setNewEventForm] = useState({
    eventDescription: "",
    eventDate: "",
    identifiedDate: "",
    eventType: "adjusting" as "adjusting" | "non-adjusting",
    impactAssessment: "",
    financialStatementImpact: "",
    auditorResponse: "",
    remarks: ""
  });
  const [editEventForm, setEditEventForm] = useState({
    eventDescription: "",
    eventDate: "",
    identifiedDate: "",
    eventType: "adjusting" as "adjusting" | "non-adjusting",
    impactAssessment: "",
    financialStatementImpact: "",
    auditorResponse: "",
    remarks: ""
  });
  const [newNoteForm, setNewNoteForm] = useState({
    noteDescription: ""
  });

  const checklistProgress = checklistItems.filter(item => item.response === "yes" || item.response === "na").length;
  const allChecklistItemsAnswered = checklistItems.every(item => item.response !== "");
  const noMissingRemarks = !checklistItems.some(item => item.response === "no" && !item.remarks.trim());
  const openReviewNotes = checklistItems.filter(item => item.response === "no" && !item.remarks).length;
  const reportsDraft = auditOpinion ? 1 : 0;
  const canEdit = fileStatus === "open";

  // Build payload for saving
  const buildFinalizationPayload = () => ({
    checklistItems,
    subsequentEvents,
    goingConcernIndicators,
    finalizationNotes,
    proceduresPerformed,
    managementInquirySummary,
    writtenRepresentationsObtained,
    subsequentEventsConclusion,
    goingConcernConclusion,
    basisForGoingConcernConclusion,
    writtenRepChecklist,
    writtenRepEvidence,
    writtenRepOutputs,
    reportingOpinionChecklist,
    reportingOpinionType,
    reportingEvidence,
    reportingOutputs,
    otherInfoChecklist,
    otherInfoEvidence,
    otherInfoOutputs,
    goingConcernReviewedBy,
    goingConcernReviewDate,
    goingConcernAttachments,
    auditSummary,
    auditOpinion,
    basisForModification,
    emphasisOfMatter,
    otherMatterParagraph,
    approvals,
    fileStatus,
    activeTab
  });

  // Initialize save engine
  const saveEngine = useFinalizationSaveBridge(engagementId, buildFinalizationPayload);
  const { toast } = useToast();

  // Load saved data on mount
  useEffect(() => {
    const loadFinalizationData = async () => {
      if (!engagementId) return;
      
      try {
        const response = await fetchWithAuth(`/api/workspace/${engagementId}/finalization`);
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            // Handle nested data structure from server
            const data = result.data.data || result.data;
            
            // Restore all state from saved data
            if (data.checklistItems) setChecklistItems(data.checklistItems);
            if (data.subsequentEvents) setSubsequentEvents(data.subsequentEvents);
            if (data.goingConcernIndicators) setGoingConcernIndicators(data.goingConcernIndicators);
            if (data.finalizationNotes) setFinalizationNotes(data.finalizationNotes);
            if (data.proceduresPerformed) setProceduresPerformed(data.proceduresPerformed);
            if (data.managementInquirySummary) setManagementInquirySummary(data.managementInquirySummary);
            if (data.writtenRepresentationsObtained) setWrittenRepresentationsObtained(data.writtenRepresentationsObtained);
            if (data.subsequentEventsConclusion) setSubsequentEventsConclusion(data.subsequentEventsConclusion);
            if (data.goingConcernConclusion) setGoingConcernConclusion(data.goingConcernConclusion);
            if (data.basisForGoingConcernConclusion) setBasisForGoingConcernConclusion(data.basisForGoingConcernConclusion);
            if (data.goingConcernReviewedBy) setGoingConcernReviewedBy(data.goingConcernReviewedBy);
            if (data.goingConcernReviewDate) setGoingConcernReviewDate(data.goingConcernReviewDate);
            if (data.goingConcernAttachments) setGoingConcernAttachments(data.goingConcernAttachments);
            if (data.auditSummary) setAuditSummary(data.auditSummary);
            if (data.auditOpinion) setAuditOpinion(data.auditOpinion);
            if (data.basisForModification) setBasisForModification(data.basisForModification);
            if (data.emphasisOfMatter) setEmphasisOfMatter(data.emphasisOfMatter);
            if (data.otherMatterParagraph) setOtherMatterParagraph(data.otherMatterParagraph);
            if (data.approvals) setApprovals(data.approvals);
            if (data.fileStatus) setFileStatus(data.fileStatus);
            if (data.writtenRepChecklist) setWrittenRepChecklist(data.writtenRepChecklist);
            if (data.writtenRepEvidence) setWrittenRepEvidence(data.writtenRepEvidence);
            if (data.writtenRepOutputs) setWrittenRepOutputs(data.writtenRepOutputs);
            if (data.reportingOpinionChecklist) setReportingOpinionChecklist(data.reportingOpinionChecklist);
            if (data.reportingOpinionType !== undefined) setReportingOpinionType(data.reportingOpinionType);
            if (data.reportingEvidence) setReportingEvidence(data.reportingEvidence);
            if (data.reportingOutputs) setReportingOutputs(data.reportingOutputs);
            if (data.otherInfoChecklist) setOtherInfoChecklist(data.otherInfoChecklist);
            if (data.otherInfoEvidence) setOtherInfoEvidence(data.otherInfoEvidence);
            if (data.otherInfoOutputs) setOtherInfoOutputs(data.otherInfoOutputs);
            
            // Restore activeTab from server, or keep current if not saved
            if (data.activeTab) {
              setActiveTab(data.activeTab);
              // Also update localStorage
              try {
                localStorage.setItem(`finalization-activeTab-${engagementId}`, data.activeTab);
              } catch {}
            }
            
            // Initialize baseline after loading - with timeout to ensure all state is set
            setTimeout(() => {
              saveEngine.initializeBaseline();
            }, 100);
          }
        }
      } catch (error) {
        console.error("Failed to load finalization data:", error);
      }
    };
    
    loadFinalizationData();
  }, [engagementId]);

  // Persist activeTab to localStorage whenever it changes
  useEffect(() => {
    if (engagementId && activeTab) {
      try {
        localStorage.setItem(`finalization-activeTab-${engagementId}`, activeTab);
      } catch (error) {
        console.warn("Failed to save activeTab to localStorage:", error);
      }
    }
  }, [activeTab, engagementId]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleFileUpload = (files: FileList | null, targetId: string, targetType: 'event' | 'going-concern' | 'note') => {
    if (!files || files.length === 0) return;
    
    const newAttachments: Attachment[] = Array.from(files).map(file => ({
      id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      fileName: file.name,
      fileType: file.type || 'application/octet-stream',
      fileSize: file.size,
      uploadedBy: user?.fullName || user?.username || 'Unknown',
      uploadedAt: new Date().toISOString(),
      url: URL.createObjectURL(file)
    }));

    if (targetType === 'event') {
      setSubsequentEvents(prev => prev.map(e => 
        e.id === targetId ? { ...e, attachments: [...e.attachments, ...newAttachments] } : e
      ));
    } else if (targetType === 'going-concern') {
      setGoingConcernAttachments(prev => [...prev, ...newAttachments]);
    } else if (targetType === 'note') {
      setFinalizationNotes(prev => prev.map(n => 
        n.id === targetId ? { ...n, attachments: [...n.attachments, ...newAttachments] } : n
      ));
    }
  };

  const handleAddSubsequentEvent = () => {
    if (!newEventForm.eventDescription || !newEventForm.eventDate) return;
    
    const newEvent: SubsequentEvent = {
      id: `se-${Date.now()}`,
      eventRef: `SE-${subsequentEvents.length + 1}`,
      eventDescription: newEventForm.eventDescription,
      eventDate: newEventForm.eventDate,
      identifiedDate: newEventForm.identifiedDate,
      eventType: newEventForm.eventType,
      impactAssessment: newEventForm.impactAssessment,
      financialStatementImpact: newEventForm.financialStatementImpact,
      auditorResponse: newEventForm.auditorResponse,
      attachments: [],
      remarks: newEventForm.remarks
    };
    
    setSubsequentEvents([...subsequentEvents, newEvent]);
    setNewEventForm({
      eventDescription: "",
      eventDate: "",
      identifiedDate: "",
      eventType: "adjusting",
      impactAssessment: "",
      financialStatementImpact: "",
      auditorResponse: "",
      remarks: ""
    });
    setShowAddEventDialog(false);
  };

  const handleAddNote = () => {
    if (!newNoteForm.noteDescription) return;
    
    const newNote: FinalizationNote = {
      id: `fn-${Date.now()}`,
      noteRef: `FN-${finalizationNotes.length + 1}`,
      noteDescription: newNoteForm.noteDescription,
      enteredBy: user?.fullName || user?.username || 'Unknown',
      date: new Date().toISOString().split('T')[0],
      attachments: []
    };
    
    setFinalizationNotes([...finalizationNotes, newNote]);
    setNewNoteForm({ noteDescription: "" });
    setShowAddNoteDialog(false);
  };

  const handleViewEvent = (idx: number) => {
    setSelectedEventIndex(idx);
    setShowViewEventDialog(true);
  };

  const handleEditEvent = (idx: number) => {
    const event = subsequentEvents[idx];
    setEditEventForm({
      eventDescription: event.eventDescription,
      eventDate: event.eventDate,
      identifiedDate: event.identifiedDate || "",
      eventType: event.eventType,
      impactAssessment: event.impactAssessment || "",
      financialStatementImpact: event.financialStatementImpact || "",
      auditorResponse: event.auditorResponse || "",
      remarks: event.remarks || ""
    });
    setSelectedEventIndex(idx);
    setShowEditEventDialog(true);
  };

  const handleSaveEditEvent = () => {
    if (selectedEventIndex === null) return;
    const updated = [...subsequentEvents];
    updated[selectedEventIndex] = {
      ...updated[selectedEventIndex],
      ...editEventForm
    };
    setSubsequentEvents(updated);
    setShowEditEventDialog(false);
    setSelectedEventIndex(null);
  };

  const generateAISummary = async () => {
    setIsGeneratingAI(true);
    try {
      const response = await fetchWithAuth("/api/audit-program/generate-execution-guidance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          context: `Generate a comprehensive audit summary for finalization covering: 1) Planning highlights - key risks identified, materiality levels set, 2) Execution procedures performed - substantive testing, controls testing results, 3) Key risks and responses - how identified risks were addressed, 4) Exceptions and conclusions - any misstatements found and overall conclusions. Format as professional audit summary.`
        })
      });
      const result = await response.json();
      if (result.success && result.guidance) {
        setAuditSummary(result.guidance);
      }
    } catch (error) {
      console.error("Error generating AI summary:", error);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const generateFinalizationOutputs = async () => {
    if (!engagementId) return;
    setIsGeneratingOutputs(true);
    try {
      const response = await fetchWithAuth(`/api/engagements/${engagementId}/outputs/generate-phase5`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const result = await response.json();
      if (!response.ok) {
        const blockerList = result.blockers?.length > 0 ? `: ${result.blockers.join(", ")}` : "";
        toast({
          title: "Cannot Generate Outputs",
          description: (result.error || "Failed to generate outputs") + blockerList,
          variant: "destructive",
        });
      } else if (result.success) {
        toast({
          title: "Finalization Outputs Generated",
          description: `Created ${result.outputsCreated} outputs, ${result.outputsSkipped} already existed.`,
        });
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to generate outputs",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error generating finalization outputs:", error);
      toast({
        title: "Error",
        description: "Failed to generate finalization outputs",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingOutputs(false);
    }
  };

  const generateAIProcedures = async () => {
    setIsGeneratingAI(true);
    try {
      const response = await fetchWithAuth("/api/audit-program/generate-execution-guidance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          context: `Generate standard subsequent events procedures per ISA 560 including: 1) Review of minutes of meetings held after period end, 2) Review of latest interim financial statements, 3) Inquiry of management about subsequent events, 4) Reading entity's latest available budgets and cash flow forecasts, 5) Inquiry of legal counsel regarding litigation and claims.`
        })
      });
      const result = await response.json();
      if (result.success && result.guidance) {
        setProceduresPerformed(result.guidance);
      }
    } catch (error) {
      console.error("Error generating AI procedures:", error);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handlePartnerApproval = () => {
    if (!isPartner) return;
    
    const updatedApprovals = [...approvals];
    const partnerApproval = updatedApprovals.find(a => a.role === "Partner Approval");
    if (partnerApproval) {
      partnerApproval.name = user?.fullName || user?.username || "Partner";
      partnerApproval.date = new Date().toISOString().split('T')[0];
      partnerApproval.status = "approved";
    }
    setApprovals(updatedApprovals);
    setFileStatus("locked");
  };

  const canLockFile = isPartner && 
    allChecklistItemsAnswered &&
    noMissingRemarks &&
    auditOpinion && 
    goingConcernConclusion !== "" &&
    basisForGoingConcernConclusion.trim() !== "" &&
    approvals[0].status === "approved" && 
    approvals[1].status === "approved";

  const finalizationTabs = [
    { id: "control-board", label: "Control Board" },
    { id: "adjusted-fs", label: "Adj. F.S" },
    { id: "checklist", label: "Completion Checklist" },
    { id: "events", label: "Subsequent Events" },
    { id: "going-concern", label: "Going Concern" },
    { id: "ai-opinion-engine", label: "AI Opinion Engine" },
    { id: "reports", label: "Reports" },
    { id: "notes", label: "Notes & Disclosures" },
    { id: "written-representations", label: "Written Representations (ISA 580)" },
    { id: "reporting-opinion", label: "Reporting & Opinion (ISA 700/705)" },
    { id: "other-information", label: "Other Information (ISA 720)" },
    { id: "lock-gate", label: "Lock Gate" }
  ];

  return (
    <PageShell
      title="Finalization"
      subtitle={`${client?.name || ""} ${engagement?.engagementCode ? `(${engagement.engagementCode})` : ""}`}
      icon={<FileCheck className="h-5 w-5 text-primary" />}
      backHref={`/workspace/${engagementId}/execution`}
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
      signoffPhase="FINALIZATION"
      signoffSection="FINALIZATION"
      readOnly={finalizationReadOnly}
      tabs={finalizationTabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      headerActions={
        <Badge variant={fileStatus === "locked" ? "default" : "secondary"} className="h-6 text-xs flex-shrink-0">
          {fileStatus === "locked" ? (
            <><Lock className="h-3 w-3 mr-1" /> File Locked</>
          ) : "Open"}
        </Badge>
      }
    >
      <div className="w-full px-4 py-2 space-y-2">

      {engagementId && (
        <AIAssistBanner
          engagementId={engagementId}
          config={{
            ...PHASE_AI_CONFIGS.finalization,
            contextBuilder: () => JSON.stringify({
              phase: "finalization",
              engagementName: engagement?.engagementCode || "Unknown Engagement",
              clientName: client?.name || "Unknown Client",
              fileStatus: fileStatus || "OPEN",
              opinionType: "UNQUALIFIED",
              goingConcernConclusion,
              approvals,
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

      <PhaseLockIndicator phase="FINALIZATION" />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <SimpleTabNavigation
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          tabs={finalizationTabs}
          ariaLabel="Finalization Steps"
        />

        {/* Finalization Control Board */}
        <TabsContent value="control-board" className="space-y-4 mt-3">
          <FinalizationControlBoard />
        </TabsContent>

        {/* Adjusted Financial Statements - Combined Balance Sheet and P&L */}
        <TabsContent value="adjusted-fs" className="space-y-4 mt-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Adjusted Financial Statements
              </CardTitle>
              <CardDescription>Financial Statements with audit adjustments applied - ISA 450, ISA 700</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Data Source Chain
                    <Badge variant="default" className="ml-2 gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Linked
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                    <Badge variant="outline">GL/TB Upload</Badge>
                    <ArrowRight className="h-4 w-4" />
                    <Badge variant="outline">Planning F.S</Badge>
                    <ArrowRight className="h-4 w-4" />
                    <Badge variant="outline">FS Heads (Execution)</Badge>
                    <ArrowRight className="h-4 w-4" />
                    <Badge variant="default">Adjusted F.S</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Unadjusted balances flow from Planning phase Financial Statements. Adjusting entries from Execution phase are applied to produce final adjusted balances.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <Brain className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-blue-800 dark:text-blue-200">Adjustment Application</p>
                      <p className="text-blue-700 dark:text-blue-300">
                        This statement reflects the Financial Statements from Planning phase with all corrected and agreed adjustments applied. 
                        Uncorrected misstatements are disclosed separately per ISA 450.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Tabs value={fsSubTab} onValueChange={setFsSubTab} className="w-full">
                <TabsList className="w-full justify-start flex-wrap gap-1 h-auto p-1">
                  <TabsTrigger value="adjusted-bs" className="gap-1.5 text-xs" data-testid="tab-adjusted-bs">
                    <Scale className="h-3.5 w-3.5" />
                    Adjusted Balance Sheet
                  </TabsTrigger>
                  <TabsTrigger value="adjusted-pl" className="gap-1.5 text-xs" data-testid="tab-adjusted-pl">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Adjusted P&L
                  </TabsTrigger>
                  <TabsTrigger value="socf" className="gap-1.5 text-xs" data-testid="tab-adjusted-socf">
                    <ArrowUpDown className="h-3.5 w-3.5" />
                    Adjusted SoCF
                  </TabsTrigger>
                  <TabsTrigger value="soce" className="gap-1.5 text-xs" data-testid="tab-adjusted-soce">
                    <Layers className="h-3.5 w-3.5" />
                    Adjusted SoCE
                  </TabsTrigger>
                  <TabsTrigger value="notes" className="gap-1.5 text-xs" data-testid="tab-adjusted-notes">
                    <FileText className="h-3.5 w-3.5" />
                    Notes
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="adjusted-bs" className="mt-4">
                  {draftFsData?.balanceSheet?.sections ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[300px]">Line Item</TableHead>
                          <TableHead className="text-right">Unadjusted (PKR)</TableHead>
                          <TableHead className="text-right">Adjustments (PKR)</TableHead>
                          <TableHead className="text-right">Adjusted (PKR)</TableHead>
                          <TableHead>Adjustment Ref</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {draftFsData.balanceSheet.sections.map((section, sIdx) => (
                          <Fragment key={`bs-section-group-${sIdx}`}>
                            <TableRow className="font-semibold bg-muted/30">
                              <TableCell colSpan={6}>{section.sectionName}</TableCell>
                            </TableRow>
                            {section.lineItems.map((item, iIdx) => (
                              <TableRow key={`bs-item-${sIdx}-${iIdx}`}>
                                <TableCell>{item.displayName}</TableCell>
                                <TableCell className="text-right">{item.originalTotal?.toLocaleString() || "-"}</TableCell>
                                <TableCell className="text-right">{(item.adjustedTotal - item.originalTotal) !== 0 ? (item.adjustedTotal - item.originalTotal).toLocaleString() : "-"}</TableCell>
                                <TableCell className="text-right font-medium">{item.adjustedTotal?.toLocaleString() || "-"}</TableCell>
                                <TableCell><Badge variant="outline" className="text-xs">{item.notesRef || "-"}</Badge></TableCell>
                                <TableCell><Badge className="text-xs" variant={item.adjustedTotal !== item.originalTotal ? "default" : "secondary"}>{item.adjustedTotal !== item.originalTotal ? "Adjusted" : "Unadjusted"}</Badge></TableCell>
                              </TableRow>
                            ))}
                            {section.isSubtotal && (
                              <TableRow className="font-bold border-t-2">
                                <TableCell>Total {section.sectionName}</TableCell>
                                <TableCell className="text-right">{section.sectionOriginalTotal?.toLocaleString() || "-"}</TableCell>
                                <TableCell className="text-right">{(section.sectionAdjustedTotal - section.sectionOriginalTotal) !== 0 ? (section.sectionAdjustedTotal - section.sectionOriginalTotal).toLocaleString() : "-"}</TableCell>
                                <TableCell className="text-right font-bold">{section.sectionAdjustedTotal?.toLocaleString() || "-"}</TableCell>
                                <TableCell></TableCell>
                                <TableCell></TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        ))}
                        <TableRow className="font-bold border-t-2 bg-muted/30">
                          <TableCell>Total Assets</TableCell>
                          <TableCell className="text-right">{draftFsData.balanceSheet.totalAssets?.toLocaleString() || "-"}</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right font-bold">{draftFsData.balanceSheet.totalAssets?.toLocaleString() || "-"}</TableCell>
                          <TableCell></TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                        <TableRow className="font-bold border-t bg-muted/30">
                          <TableCell>Total Equity & Liabilities</TableCell>
                          <TableCell className="text-right">{draftFsData.balanceSheet.totalEquityLiabilities?.toLocaleString() || "-"}</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right font-bold">{draftFsData.balanceSheet.totalEquityLiabilities?.toLocaleString() || "-"}</TableCell>
                          <TableCell></TableCell>
                          <TableCell>{draftFsData.balanceSheet.isBalanced ? <Badge className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Balanced</Badge> : <Badge className="text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Variance: {draftFsData.balanceSheet.variance?.toLocaleString()}</Badge>}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Line Item</TableHead>
                          <TableHead className="text-right">Unadjusted (PKR)</TableHead>
                          <TableHead className="text-right">Adjustments (PKR)</TableHead>
                          <TableHead className="text-right">Adjusted (PKR)</TableHead>
                          <TableHead>Adjustment Ref</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow className="font-semibold bg-muted/30">
                          <TableCell colSpan={6}>Non-Current Assets</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Property, Plant & Equipment</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right font-medium">-</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">-</Badge></TableCell>
                          <TableCell><Badge className="text-xs" variant="secondary">Pending</Badge></TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Intangible Assets</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right font-medium">-</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">-</Badge></TableCell>
                          <TableCell><Badge className="text-xs" variant="secondary">Pending</Badge></TableCell>
                        </TableRow>
                        <TableRow className="font-semibold bg-muted/30">
                          <TableCell colSpan={6}>Current Assets</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Inventories</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right font-medium">-</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">-</Badge></TableCell>
                          <TableCell><Badge className="text-xs" variant="secondary">Pending</Badge></TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Trade Receivables</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right font-medium">-</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">-</Badge></TableCell>
                          <TableCell><Badge className="text-xs" variant="secondary">Pending</Badge></TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Cash & Bank Balances</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right font-medium">-</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">-</Badge></TableCell>
                          <TableCell><Badge className="text-xs" variant="secondary">Pending</Badge></TableCell>
                        </TableRow>
                        <TableRow className="font-bold border-t-2">
                          <TableCell>Total Assets</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right font-bold">-</TableCell>
                          <TableCell></TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                        <TableRow className="font-semibold bg-muted/30">
                          <TableCell colSpan={6}>Equity & Liabilities</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Share Capital</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right font-medium">-</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">-</Badge></TableCell>
                          <TableCell><Badge className="text-xs" variant="secondary">Pending</Badge></TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Retained Earnings</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right font-medium">-</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">-</Badge></TableCell>
                          <TableCell><Badge className="text-xs" variant="secondary">Pending</Badge></TableCell>
                        </TableRow>
                        <TableRow className="font-bold border-t-2">
                          <TableCell>Total Equity & Liabilities</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right font-bold">-</TableCell>
                          <TableCell></TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>

                <TabsContent value="adjusted-pl" className="mt-4">
                  {draftFsData?.profitLoss?.sections ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[300px]">Line Item</TableHead>
                          <TableHead className="text-right">Unadjusted (PKR)</TableHead>
                          <TableHead className="text-right">Adjustments (PKR)</TableHead>
                          <TableHead className="text-right">Adjusted (PKR)</TableHead>
                          <TableHead>Adjustment Ref</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {draftFsData.profitLoss.sections.map((section, sIdx) => (
                          <Fragment key={`pl-section-group-${sIdx}`}>
                            <TableRow className="font-semibold bg-muted/30">
                              <TableCell colSpan={6}>{section.sectionName}</TableCell>
                            </TableRow>
                            {section.lineItems.map((item, iIdx) => (
                              <TableRow key={`pl-item-${sIdx}-${iIdx}`}>
                                <TableCell>{item.displayName}</TableCell>
                                <TableCell className="text-right">{item.originalTotal?.toLocaleString() || "-"}</TableCell>
                                <TableCell className="text-right">{(item.adjustedTotal - item.originalTotal) !== 0 ? (item.adjustedTotal - item.originalTotal).toLocaleString() : "-"}</TableCell>
                                <TableCell className="text-right font-medium">{item.adjustedTotal?.toLocaleString() || "-"}</TableCell>
                                <TableCell><Badge variant="outline" className="text-xs">{item.notesRef || "-"}</Badge></TableCell>
                                <TableCell><Badge className="text-xs" variant={item.adjustedTotal !== item.originalTotal ? "default" : "secondary"}>{item.adjustedTotal !== item.originalTotal ? "Adjusted" : "Unadjusted"}</Badge></TableCell>
                              </TableRow>
                            ))}
                            {section.isSubtotal && (
                              <TableRow className="font-semibold border-t">
                                <TableCell>{section.sectionName}</TableCell>
                                <TableCell className="text-right">{section.sectionOriginalTotal?.toLocaleString() || "-"}</TableCell>
                                <TableCell className="text-right">{(section.sectionAdjustedTotal - section.sectionOriginalTotal) !== 0 ? (section.sectionAdjustedTotal - section.sectionOriginalTotal).toLocaleString() : "-"}</TableCell>
                                <TableCell className="text-right font-semibold">{section.sectionAdjustedTotal?.toLocaleString() || "-"}</TableCell>
                                <TableCell></TableCell>
                                <TableCell></TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        ))}
                        <TableRow className="font-bold border-t-2 bg-muted/30">
                          <TableCell>Net Profit / (Loss)</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right font-bold">{draftFsData.profitLoss.netProfit?.toLocaleString() || "-"}</TableCell>
                          <TableCell></TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Line Item</TableHead>
                          <TableHead className="text-right">Unadjusted (PKR)</TableHead>
                          <TableHead className="text-right">Adjustments (PKR)</TableHead>
                          <TableHead className="text-right">Adjusted (PKR)</TableHead>
                          <TableHead>Adjustment Ref</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-semibold">Revenue</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right font-medium">-</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">-</Badge></TableCell>
                          <TableCell><Badge className="text-xs" variant="secondary">Pending</Badge></TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Cost of Sales</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right font-medium">-</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">-</Badge></TableCell>
                          <TableCell><Badge className="text-xs" variant="secondary">Pending</Badge></TableCell>
                        </TableRow>
                        <TableRow className="font-semibold border-t">
                          <TableCell>Gross Profit</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right font-semibold">-</TableCell>
                          <TableCell></TableCell>
                          <TableCell><Badge className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">Auto</Badge></TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Administrative Expenses</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right font-medium">-</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">-</Badge></TableCell>
                          <TableCell><Badge className="text-xs" variant="secondary">Pending</Badge></TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Distribution Costs</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right font-medium">-</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">-</Badge></TableCell>
                          <TableCell><Badge className="text-xs" variant="secondary">Pending</Badge></TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Other Operating Income</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right font-medium">-</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">-</Badge></TableCell>
                          <TableCell><Badge className="text-xs" variant="secondary">Pending</Badge></TableCell>
                        </TableRow>
                        <TableRow className="font-semibold border-t">
                          <TableCell>Operating Profit</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right font-semibold">-</TableCell>
                          <TableCell></TableCell>
                          <TableCell><Badge className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">Auto</Badge></TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Finance Costs</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right font-medium">-</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">-</Badge></TableCell>
                          <TableCell><Badge className="text-xs" variant="secondary">Pending</Badge></TableCell>
                        </TableRow>
                        <TableRow className="font-bold border-t-2">
                          <TableCell>Profit Before Tax</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right font-bold">-</TableCell>
                          <TableCell></TableCell>
                          <TableCell><Badge className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">Auto</Badge></TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Taxation</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right font-medium">-</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">-</Badge></TableCell>
                          <TableCell><Badge className="text-xs" variant="secondary">Pending</Badge></TableCell>
                        </TableRow>
                        <TableRow className="font-bold border-t-2 bg-muted/30">
                          <TableCell>Profit After Tax</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right font-bold">-</TableCell>
                          <TableCell></TableCell>
                          <TableCell><Badge className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">Auto</Badge></TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>

                <TabsContent value="socf" className="mt-4" data-testid="tab-content-adjusted-socf">
                  <FSSoCF
                    draftFsData={draftFsData}
                    fsPriorYear={fsPriorYear}
                    trialBalance={trialBalance}
                    coaAccounts={coaAccounts}
                    engagementId={engagementId || ""}
                    clientName={client?.name || "Company Name"}
                    periodEnd={engagement?.periodEnd ? new Date(engagement.periodEnd).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : "Period End"}
                    onSwitchTab={setFsSubTab}
                  />
                </TabsContent>

                <TabsContent value="soce" className="mt-4" data-testid="tab-content-adjusted-soce">
                  <FSSoCE
                    draftFsData={draftFsData}
                    fsPriorYear={fsPriorYear}
                    trialBalance={trialBalance}
                    coaAccounts={coaAccounts}
                    engagementId={engagementId || ""}
                    clientName={client?.name || "Company Name"}
                    periodEnd={engagement?.periodEnd ? new Date(engagement.periodEnd).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : "Period End"}
                    onSwitchTab={setFsSubTab}
                  />
                </TabsContent>

                <TabsContent value="notes" className="mt-4" data-testid="tab-content-adjusted-notes">
                  <FSNotes
                    draftFsData={draftFsData}
                    coaAccounts={coaAccounts}
                    engagementId={engagementId || ""}
                    clientName={client?.name || "Company Name"}
                    periodEnd={engagement?.periodEnd ? new Date(engagement.periodEnd).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : "Period End"}
                    onSwitchTab={setFsSubTab}
                  />
                </TabsContent>
              </Tabs>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Info className="h-4 w-4" />
                <span>Complete Planning phase Financial Statements and record adjustments to populate this statement.</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="checklist" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5" />
                    Completion Checklist
                  </CardTitle>
                  <CardDescription>Complete all items before file lock. AI-generated descriptions are editable.</CardDescription>
                </div>
                <Badge variant="outline" className="gap-1">
                  <Sparkles className="h-3 w-3" />
                  AI-Assisted
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-[60px]">Sr#</TableHead>
                      <TableHead className="w-[200px]">Checklist Item</TableHead>
                      <TableHead>Description (AI + Editable)</TableHead>
                      <TableHead className="w-[120px]">Response</TableHead>
                      <TableHead className="w-[200px]">Remarks</TableHead>
                      <TableHead className="w-[100px]">ISA Ref</TableHead>
                      {fileStatus !== "locked" && <TableHead className="w-[40px]"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {checklistItems.map((item, idx) => (
                      <TableRow key={item.id} className={item.response === "no" && !item.remarks ? "bg-red-50 dark:bg-red-900/20" : ""}>
                        <TableCell className="font-mono">{item.srNo}</TableCell>
                        <TableCell className="font-medium">
                          {item.id.startsWith("custom-") ? (
                            <Input
                              value={item.item}
                              onChange={(e) => {
                                const updated = [...checklistItems];
                                updated[idx].item = e.target.value;
                                setChecklistItems(updated);
                              }}
                              placeholder="Enter item name"
                              className="text-sm font-medium"
                              disabled={fileStatus === "locked"}
                            />
                          ) : (
                            item.item
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-start gap-2">
                            {item.aiGenerated && <Sparkles className="h-3 w-3 text-purple-500 mt-1 shrink-0" />}
                            <Textarea
                              value={item.description}
                              onChange={(e) => {
                                const updated = [...checklistItems];
                                updated[idx].description = e.target.value;
                                updated[idx].aiGenerated = false;
                                setChecklistItems(updated);
                              }}
                              className="min-h-[60px] text-sm"
                              disabled={fileStatus === "locked"}
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={item.response}
                            onValueChange={(v) => {
                              const updated = [...checklistItems];
                              updated[idx].response = v as any;
                              setChecklistItems(updated);
                            }}
                            disabled={fileStatus === "locked"}
                          >
                            <SelectTrigger className={item.response === "" ? "border-orange-300" : ""}>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="yes">Yes</SelectItem>
                              <SelectItem value="no">No</SelectItem>
                              <SelectItem value="na">N/A</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Textarea
                            value={item.remarks}
                            onChange={(e) => {
                              const updated = [...checklistItems];
                              updated[idx].remarks = e.target.value;
                              setChecklistItems(updated);
                            }}
                            placeholder={item.response === "no" ? "Required..." : "Optional"}
                            className={`min-h-[60px] text-sm ${item.response === "no" && !item.remarks ? "border-red-300" : ""}`}
                            disabled={fileStatus === "locked"}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {item.id.startsWith("custom-") ? (
                              <Input
                                value={item.isaReference}
                                onChange={(e) => {
                                  const updated = [...checklistItems];
                                  updated[idx].isaReference = e.target.value;
                                  setChecklistItems(updated);
                                }}
                                placeholder="ISA Ref"
                                className="text-xs w-24"
                                disabled={fileStatus === "locked"}
                              />
                            ) : (
                              <Badge variant="outline" className="text-xs">{item.isaReference}</Badge>
                            )}
                          </div>
                        </TableCell>
                        {fileStatus !== "locked" && (
                          <TableCell className="w-[40px]">
                            {item.id.startsWith("custom-") && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                onClick={() => {
                                  const updated = checklistItems.filter((_, i) => i !== idx).map((ci, i) => ({ ...ci, srNo: i + 1 }));
                                  setChecklistItems(updated);
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {fileStatus !== "locked" && (
                <div className="mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newItem: ChecklistItem = {
                        id: `custom-${Date.now()}`,
                        srNo: checklistItems.length + 1,
                        item: "",
                        description: "",
                        aiGenerated: false,
                        response: "",
                        remarks: "",
                        isaReference: "",
                      };
                      setChecklistItems([...checklistItems, newItem]);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add More Line
                  </Button>
                </div>
              )}
              
              {checklistItems.some(item => item.response === "no" && !item.remarks) && (
                <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-300">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm">Remarks are mandatory for items with "No" response.</span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Subsequent Events
                    <AIHelpIcon fieldName="subsequentEvents" category="completion" size="sm" />
                  </CardTitle>
                  <CardDescription>ISA 560 - Document and evaluate events occurring after the reporting period</CardDescription>
                </div>
                <Dialog open={showAddEventDialog} onOpenChange={setShowAddEventDialog}>
                  <DialogTrigger asChild>
                    <Button disabled={fileStatus === "locked"}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Event
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                      <DialogTitle>Add Subsequent Event</DialogTitle>
                      <DialogDescription>Document an event occurring after the reporting period per ISA 560</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4 overflow-y-auto max-h-[calc(90vh-180px)]">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Event Date <span className="text-destructive">*</span></Label>
                          <Input
                            type="date"
                            value={newEventForm.eventDate}
                            onChange={(e) => setNewEventForm({...newEventForm, eventDate: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Identified Date</Label>
                          <Input
                            type="date"
                            value={newEventForm.identifiedDate}
                            onChange={(e) => setNewEventForm({...newEventForm, identifiedDate: e.target.value})}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Event Description <span className="text-destructive">*</span></Label>
                        <Textarea
                          value={newEventForm.eventDescription}
                          onChange={(e) => setNewEventForm({...newEventForm, eventDescription: e.target.value})}
                          placeholder="Describe the event..."
                          rows={3}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Event Type</Label>
                        <Select
                          value={newEventForm.eventType}
                          onValueChange={(v) => setNewEventForm({...newEventForm, eventType: v as any})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="adjusting">Adjusting Event</SelectItem>
                            <SelectItem value="non-adjusting">Non-Adjusting Event</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Impact Assessment</Label>
                        <Textarea
                          value={newEventForm.impactAssessment}
                          onChange={(e) => setNewEventForm({...newEventForm, impactAssessment: e.target.value})}
                          placeholder="Assess the impact of this event..."
                          rows={2}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Financial Statement Impact</Label>
                        <Textarea
                          value={newEventForm.financialStatementImpact}
                          onChange={(e) => setNewEventForm({...newEventForm, financialStatementImpact: e.target.value})}
                          placeholder="Describe impact on financial statements..."
                          rows={2}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Auditor Response</Label>
                        <Textarea
                          value={newEventForm.auditorResponse}
                          onChange={(e) => setNewEventForm({...newEventForm, auditorResponse: e.target.value})}
                          placeholder="Document auditor's response to this event..."
                          rows={2}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Remarks</Label>
                        <Textarea
                          value={newEventForm.remarks}
                          onChange={(e) => setNewEventForm({...newEventForm, remarks: e.target.value})}
                          placeholder="Additional remarks..."
                          rows={2}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowAddEventDialog(false)} data-testid="button-cancel-add-event">Cancel</Button>
                      <Button onClick={handleAddSubsequentEvent} disabled={!newEventForm.eventDescription || !newEventForm.eventDate}>
                        Add Event
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* View Event Dialog */}
                <Dialog open={showViewEventDialog} onOpenChange={setShowViewEventDialog}>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                      <DialogTitle>View Event - {selectedEventIndex !== null && subsequentEvents[selectedEventIndex]?.eventRef}</DialogTitle>
                      <DialogDescription>Event details (read-only)</DialogDescription>
                    </DialogHeader>
                    {selectedEventIndex !== null && (
                      <div className="grid gap-4 py-4 overflow-y-auto max-h-[calc(90vh-180px)]">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Event Date</Label>
                            <Input type="text" value={subsequentEvents[selectedEventIndex].eventDate} readOnly className="bg-muted" />
                          </div>
                          <div className="space-y-2">
                            <Label>Identified Date</Label>
                            <Input type="text" value={subsequentEvents[selectedEventIndex].identifiedDate || "-"} readOnly className="bg-muted" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Event Description</Label>
                          <Textarea value={subsequentEvents[selectedEventIndex].eventDescription} readOnly className="bg-muted min-h-[80px]" />
                        </div>
                        <div className="space-y-2">
                          <Label>Event Type</Label>
                          <Input type="text" value={subsequentEvents[selectedEventIndex].eventType === "adjusting" ? "Adjusting Event" : "Non-Adjusting Event"} readOnly className="bg-muted" />
                        </div>
                        <div className="space-y-2">
                          <Label>Impact Assessment</Label>
                          <Textarea value={subsequentEvents[selectedEventIndex].impactAssessment || "-"} readOnly className="bg-muted min-h-[60px]" />
                        </div>
                        <div className="space-y-2">
                          <Label>Financial Statement Impact</Label>
                          <Textarea value={subsequentEvents[selectedEventIndex].financialStatementImpact || "-"} readOnly className="bg-muted min-h-[60px]" />
                        </div>
                        <div className="space-y-2">
                          <Label>Auditor Response</Label>
                          <Textarea value={subsequentEvents[selectedEventIndex].auditorResponse || "-"} readOnly className="bg-muted min-h-[60px]" />
                        </div>
                        <div className="space-y-2">
                          <Label>Remarks</Label>
                          <Textarea value={subsequentEvents[selectedEventIndex].remarks || "-"} readOnly className="bg-muted min-h-[60px]" />
                        </div>
                      </div>
                    )}
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowViewEventDialog(false)} data-testid="button-close-view-event">Close</Button>
                      <Button onClick={() => {
                        setShowViewEventDialog(false);
                        if (selectedEventIndex !== null) handleEditEvent(selectedEventIndex);
                      }} disabled={fileStatus === "locked"}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Event
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* Edit Event Dialog */}
                <Dialog open={showEditEventDialog} onOpenChange={setShowEditEventDialog}>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                      <DialogTitle>Edit Event - {selectedEventIndex !== null && subsequentEvents[selectedEventIndex]?.eventRef}</DialogTitle>
                      <DialogDescription>Modify event details</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4 overflow-y-auto max-h-[calc(90vh-180px)]">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Event Date <span className="text-destructive">*</span></Label>
                          <Input
                            type="date"
                            value={editEventForm.eventDate}
                            onChange={(e) => setEditEventForm({...editEventForm, eventDate: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Identified Date</Label>
                          <Input
                            type="date"
                            value={editEventForm.identifiedDate}
                            onChange={(e) => setEditEventForm({...editEventForm, identifiedDate: e.target.value})}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Event Description <span className="text-destructive">*</span></Label>
                        <Textarea
                          value={editEventForm.eventDescription}
                          onChange={(e) => setEditEventForm({...editEventForm, eventDescription: e.target.value})}
                          placeholder="Describe the event..."
                          rows={3}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Event Type</Label>
                        <Select
                          value={editEventForm.eventType}
                          onValueChange={(v) => setEditEventForm({...editEventForm, eventType: v as any})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="adjusting">Adjusting Event</SelectItem>
                            <SelectItem value="non-adjusting">Non-Adjusting Event</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Impact Assessment</Label>
                        <Textarea
                          value={editEventForm.impactAssessment}
                          onChange={(e) => setEditEventForm({...editEventForm, impactAssessment: e.target.value})}
                          placeholder="Assess the impact of this event..."
                          rows={2}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Financial Statement Impact</Label>
                        <Textarea
                          value={editEventForm.financialStatementImpact}
                          onChange={(e) => setEditEventForm({...editEventForm, financialStatementImpact: e.target.value})}
                          placeholder="Describe impact on financial statements..."
                          rows={2}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Auditor Response</Label>
                        <Textarea
                          value={editEventForm.auditorResponse}
                          onChange={(e) => setEditEventForm({...editEventForm, auditorResponse: e.target.value})}
                          placeholder="Document auditor's response to this event..."
                          rows={2}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Remarks</Label>
                        <Textarea
                          value={editEventForm.remarks}
                          onChange={(e) => setEditEventForm({...editEventForm, remarks: e.target.value})}
                          placeholder="Additional remarks..."
                          rows={2}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowEditEventDialog(false)} data-testid="button-cancel-edit-event">Cancel</Button>
                      <Button onClick={handleSaveEditEvent} disabled={!editEventForm.eventDescription || !editEventForm.eventDate}>
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {subsequentEvents.length > 0 && (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-[80px]">Event Ref</TableHead>
                        <TableHead>Event Description</TableHead>
                        <TableHead className="w-[100px]">Event Date</TableHead>
                        <TableHead className="w-[100px]">Identified</TableHead>
                        <TableHead className="w-[120px]">Type</TableHead>
                        <TableHead className="w-[150px]">Impact</TableHead>
                        <TableHead className="w-[80px]">Attach</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subsequentEvents.map((event, idx) => {
                        // Create a unique ID for this row's file input
                        const fileInputId = `file-upload-event-${event.id}`;
                        
                        return (
                        <TableRow key={event.id}>
                          <TableCell className="font-mono text-sm">{event.eventRef}</TableCell>
                          <TableCell>
                            <Textarea
                              value={event.eventDescription}
                              onChange={(e) => {
                                const updated = [...subsequentEvents];
                                updated[idx].eventDescription = e.target.value;
                                setSubsequentEvents(updated);
                              }}
                              className="min-h-[60px] text-sm"
                              disabled={fileStatus === "locked"}
                            />
                          </TableCell>
                          <TableCell className="text-sm">{event.eventDate}</TableCell>
                          <TableCell className="text-sm">{event.identifiedDate || "-"}</TableCell>
                          <TableCell>
                            <Badge variant={event.eventType === "adjusting" ? "default" : "secondary"}>
                              {event.eventType === "adjusting" ? "Adjusting" : "Non-Adjusting"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{event.impactAssessment || "-"}</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1 items-center">
                              <input
                                id={fileInputId}
                                className="hidden"
                                type="file"
                                multiple
                                accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.docx,.doc"
                                onChange={(e) => {
                                  const files = Array.from(e.target.files || []);
                                  if (files.length > 0) {
                                    files.forEach(file => {
                                      if (file.size > 10 * 1024 * 1024) {
                                        alert(`File ${file.name} exceeds 10MB limit`);
                                        return;
                                      }
                                      const reader = new FileReader();
                                      reader.onload = () => {
                                        const base64 = reader.result as string;
                                        const updated = [...subsequentEvents];
                                        if (!updated[idx].attachments) updated[idx].attachments = [];
                                        updated[idx].attachments!.push({
                                          id: `file-${Date.now()}-${Math.random()}`,
                                          fileName: file.name,
                                          fileType: file.type,
                                          fileSize: file.size,
                                          uploadedAt: new Date().toISOString(),
                                          uploadedBy: 'Current User',
                                          url: base64
                                        });
                                        setSubsequentEvents(updated);
                                      };
                                      reader.readAsDataURL(file);
                                    });
                                  }
                                  e.target.value = '';
                                }}
                              />
                              {event.attachments && event.attachments.length > 0 ? (
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-8 gap-1">
                                      <FileText className="h-3 w-3" />
                                      {event.attachments.length}
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-2xl">
                                    <DialogHeader>
                                      <DialogTitle>Attachments - {event.eventRef}</DialogTitle>
                                      <DialogDescription>View and download attachments for this subsequent event</DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                      {event.attachments.map((attachment, attIdx) => (
                                        <div key={attachment.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                                          <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                                            <div className="flex-1 min-w-0">
                                              <p className="font-medium text-sm truncate">{attachment.fileName}</p>
                                              <p className="text-xs text-muted-foreground">
                                                {(attachment.fileSize / 1024).toFixed(1)} KB · {new Date(attachment.uploadedAt).toLocaleDateString()}
                                              </p>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => {
                                                const link = document.createElement('a');
                                                link.href = attachment.url;
                                                link.download = attachment.fileName;
                                                link.click();
                                              }}
                                            >
                                              <Download className="h-4 w-4" />
                                            </Button>
                                            {fileStatus !== "locked" && (
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                  const updated = [...subsequentEvents];
                                                  updated[idx].attachments = updated[idx].attachments?.filter((_, i) => i !== attIdx);
                                                  setSubsequentEvents(updated);
                                                }}
                                              >
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                              </Button>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                    <DialogFooter>
                                      {fileStatus !== "locked" && (
                                        <Button onClick={() => document.getElementById(fileInputId)?.click()}>
                                          <Upload className="h-4 w-4 mr-2" />
                                          Add More
                                        </Button>
                                      )}
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>
                              ) : (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-8 w-8 p-0"
                                  onClick={() => document.getElementById(fileInputId)?.click()}
                                  disabled={fileStatus === "locked"}
                                >
                                  <Upload className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2"
                                onClick={() => handleViewEvent(idx)}
                              >
                                <Eye className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2"
                                onClick={() => handleEditEvent(idx)}
                                disabled={fileStatus === "locked"}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {subsequentEvents.length === 0 && (
                <div className="text-center py-4 text-muted-foreground border rounded-lg">
                  <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No subsequent events documented yet.</p>
                  <p className="text-sm">Click "Add Event" to document events per ISA 560.</p>
                </div>
              )}

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">Procedures Performed (ISA 560)</Label>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={generateAIProcedures}
                    disabled={isGeneratingAI || fileStatus === "locked"}
                  >
                    {isGeneratingAI ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : <Brain className="h-3 w-3 mr-1" />}
                    AI Suggest
                  </Button>
                </div>
                <Textarea
                  value={proceduresPerformed}
                  onChange={(e) => setProceduresPerformed(e.target.value)}
                  placeholder="Document procedures performed to identify subsequent events..."
                  rows={4}
                  disabled={fileStatus === "locked"}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-base font-medium">Management Inquiry Summary</Label>
                <Textarea
                  value={managementInquirySummary}
                  onChange={(e) => setManagementInquirySummary(e.target.value)}
                  placeholder="Summarize inquiries made to management regarding subsequent events..."
                  rows={3}
                  disabled={fileStatus === "locked"}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Written Representations Obtained</Label>
                  <Select
                    value={writtenRepresentationsObtained}
                    onValueChange={(v) => setWrittenRepresentationsObtained(v as any)}
                    disabled={fileStatus === "locked"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Conclusion on Subsequent Events</Label>
                  <Select
                    value={subsequentEventsConclusion}
                    onValueChange={(v) => setSubsequentEventsConclusion(v as any)}
                    disabled={fileStatus === "locked"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="satisfactory">Satisfactory</SelectItem>
                      <SelectItem value="unsatisfactory">Unsatisfactory</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="going-concern" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingDown className="h-5 w-5" />
                    Going Concern Assessment
                    <AIHelpIcon fieldName="goingConcern" category="completion" size="sm" />
                  </CardTitle>
                  <CardDescription>ISA 570 - Evaluate management's assessment of going concern</CardDescription>
                </div>
                <Badge variant="outline" className="gap-1">
                  <Sparkles className="h-3 w-3" />
                  AI-Assisted Indicators
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-blue-800 dark:text-blue-300">Going Concern Indicators (ISA 570.A3)</p>
                  <p className="text-blue-700 dark:text-blue-400 mt-1">
                    Evaluate each indicator to determine if events or conditions may cast significant doubt on going concern.
                  </p>
                </div>
              </div>

              {["financial", "operating", "external", "management"].map((category) => (
                <div key={category} className="space-y-3">
                  <h3 className="font-medium tracking-tight flex items-center gap-2 capitalize">
                    {category === "financial" && <TrendingDown className="h-4 w-4" />}
                    {category === "operating" && <Building className="h-4 w-4" />}
                    {category === "external" && <ExternalLink className="h-4 w-4" />}
                    {category === "management" && <Users className="h-4 w-4" />}
                    {category} Indicators
                  </h3>
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-[50px]">Sr#</TableHead>
                          <TableHead className="w-[200px]">Indicator</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="w-[100px]">Response</TableHead>
                          <TableHead className="w-[180px]">Remarks</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {goingConcernIndicators
                          .filter(ind => ind.category === category)
                          .map((indicator, idx) => {
                            const globalIdx = goingConcernIndicators.findIndex(i => i.id === indicator.id);
                            return (
                              <TableRow key={indicator.id} className={indicator.response === "yes" ? "bg-red-50 dark:bg-red-900/20" : ""}>
                                <TableCell className="font-mono">{indicator.srNo}</TableCell>
                                <TableCell className="font-medium text-sm">{indicator.indicator}</TableCell>
                                <TableCell>
                                  <div className="flex items-start gap-2">
                                    {indicator.aiGenerated && <Sparkles className="h-3 w-3 text-purple-500 mt-1 shrink-0" />}
                                    <Textarea
                                      value={indicator.description}
                                      onChange={(e) => {
                                        const updated = [...goingConcernIndicators];
                                        updated[globalIdx].description = e.target.value;
                                        updated[globalIdx].aiGenerated = false;
                                        setGoingConcernIndicators(updated);
                                      }}
                                      className="min-h-[50px] text-sm"
                                      disabled={fileStatus === "locked"}
                                    />
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Select
                                    value={indicator.response}
                                    onValueChange={(v) => {
                                      const updated = [...goingConcernIndicators];
                                      updated[globalIdx].response = v as any;
                                      setGoingConcernIndicators(updated);
                                    }}
                                    disabled={fileStatus === "locked"}
                                  >
                                    <SelectTrigger className="w-[90px]">
                                      <SelectValue placeholder="Select" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="yes">Yes</SelectItem>
                                      <SelectItem value="no">No</SelectItem>
                                      <SelectItem value="na">N/A</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell>
                                  <Textarea
                                    value={indicator.remarks}
                                    onChange={(e) => {
                                      const updated = [...goingConcernIndicators];
                                      updated[globalIdx].remarks = e.target.value;
                                      setGoingConcernIndicators(updated);
                                    }}
                                    className="min-h-[50px] text-sm"
                                    placeholder="Remarks..."
                                    disabled={fileStatus === "locked"}
                                  />
                                </TableCell>
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}

              <Separator />

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-base font-medium">Overall Going Concern Conclusion <span className="text-destructive">*</span></Label>
                    <Select
                      value={goingConcernConclusion}
                      onValueChange={(v) => setGoingConcernConclusion(v as any)}
                      disabled={fileStatus === "locked"}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select conclusion..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no-material-uncertainty">No Material Uncertainty</SelectItem>
                        <SelectItem value="material-uncertainty-exists">Material Uncertainty Exists</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Basis for Conclusion <span className="text-destructive">*</span></Label>
                    <Textarea
                      value={basisForGoingConcernConclusion}
                      onChange={(e) => setBasisForGoingConcernConclusion(e.target.value)}
                      placeholder="Document the basis for your going concern conclusion..."
                      rows={4}
                      disabled={fileStatus === "locked"}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Reviewed By</Label>
                    <Select
                      value={goingConcernReviewedBy}
                      onValueChange={setGoingConcernReviewedBy}
                      disabled={fileStatus === "locked"}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select reviewer..." />
                      </SelectTrigger>
                      <SelectContent>
                        {teamMembers.map(m => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Review Date</Label>
                    <Input
                      type="date"
                      value={goingConcernReviewDate}
                      onChange={(e) => setGoingConcernReviewDate(e.target.value)}
                      disabled={fileStatus === "locked"}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Attachments</Label>
                    <div className="flex items-center gap-2">
                      <input
                        id="going-concern-file-upload"
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          if (files.length > 0) {
                            files.forEach(file => {
                              if (file.size > 10 * 1024 * 1024) {
                                alert(`File ${file.name} exceeds 10MB limit`);
                                return;
                              }
                              const reader = new FileReader();
                              reader.onload = () => {
                                const base64 = reader.result as string;
                                const newAttachment: Attachment = {
                                  id: `file-${Date.now()}-${Math.random()}`,
                                  fileName: file.name,
                                  fileType: file.type,
                                  fileSize: file.size,
                                  uploadedAt: new Date().toISOString(),
                                  uploadedBy: 'Current User',
                                  url: base64
                                };
                                setGoingConcernAttachments([...goingConcernAttachments, newAttachment]);
                              };
                              reader.readAsDataURL(file);
                            });
                          }
                          e.target.value = '';
                        }}
                        accept=".pdf,.xlsx,.xls,.doc,.docx,.png,.jpg,.jpeg"
                        disabled={fileStatus === "locked"}
                      />
                      <Button 
                        variant="outline" 
                        className="w-full gap-2"
                        onClick={() => document.getElementById('going-concern-file-upload')?.click()}
                        disabled={fileStatus === "locked"}
                      >
                        <Upload className="h-4 w-4" />
                        Upload Supporting Documents
                      </Button>
                    </div>
                    {goingConcernAttachments.length > 0 && (
                      <div className="space-y-2 mt-2">
                        {goingConcernAttachments.map((att, attIdx) => (
                          <div key={att.id} className="flex items-center justify-between p-2 bg-muted rounded text-sm gap-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{att.fileName}</p>
                                <p className="text-xs text-muted-foreground">
                                  {(att.fileSize / 1024).toFixed(1)} KB
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => {
                                  const link = document.createElement('a');
                                  link.href = att.url;
                                  link.download = att.fileName;
                                  link.click();
                                }}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              {fileStatus !== "locked" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const updated = goingConcernAttachments.filter((_, i) => i !== attIdx);
                                    setGoingConcernAttachments(updated);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {goingConcernConclusion === "material-uncertainty-exists" && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-red-800 dark:text-red-300">Material Uncertainty Identified</p>
                    <p className="text-red-700 dark:text-red-400 mt-1">
                      Per ISA 570.22, ensure adequate disclosure in the financial statements and consider implications for the audit report (ISA 570.23-24).
                    </p>
                  </div>
                </div>
              )}

              <Separator />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai-opinion-engine" className="space-y-4">
          <AIOpinionEngine engagementId={engagementId!} />
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileCheck className="h-5 w-5" />
                    Generate Finalization Documents
                  </CardTitle>
                  <CardDescription>
                    Generate deliverable documents for the finalization phase.{" "}
                    See also:{" "}
                    <Link href={`/workspace/${engagementId}/outputs`} className="text-primary hover:underline">Outputs Registry</Link>
                    {" | "}
                    <Link href={`/workspace/${engagementId}/deliverables`} className="text-primary hover:underline">Deliverables Register</Link>
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {preReportCheck && !preReportCheck.readyForDraft && (
                <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/5 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    <h4 className="font-semibold text-destructive">Pre-Report Blockers</h4>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    The following completion-phase items must be resolved before finalization outputs can be generated:
                  </p>
                  <ul className="space-y-1">
                    {(preReportCheck.draftIssues || preReportCheck.issues).map((issue: { message: string }, idx: number) => (
                      <li key={idx} className="text-sm flex items-center gap-2">
                        <AlertCircle className="h-3 w-3 text-destructive flex-shrink-0" />
                        <span>{issue.message}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  Generates all finalization outputs in one batch: Audit Report Draft (ISA 700), Governance Letter (ISA 260),
                  Representation Letter (ISA 580), Final Audited Financial Statements, and Partner Sign-Off Sheet (ISA 220).
                </div>
                <Button
                  className="w-full h-auto py-4 px-6"
                  onClick={() => {
                    toast({
                      title: "Generating Finalization Outputs",
                      description: "Creating all Phase 5 finalization documents...",
                    });
                    generateFinalizationOutputs();
                  }}
                  disabled={isGeneratingOutputs || fileStatus === "locked" || (preReportCheck && !preReportCheck.readyForDraft)}
                  data-testid="button-generate-all-outputs"
                >
                  <div className="flex items-center gap-3">
                    <FileSignature className="h-5 w-5" />
                    <div className="text-left">
                      <div className="font-medium">Generate All Finalization Outputs</div>
                      <div className="text-xs opacity-80">5 documents: Report, Letters, F.S., Sign-Off</div>
                    </div>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileSignature className="h-5 w-5" />
                    Final Audit Report
                  </CardTitle>
                  <CardDescription>ISA 700, ISA 705, ISA 706 - Partner-driven final opinion and report</CardDescription>
                </div>
                {!isPartner && (
                  <Badge variant="secondary" className="gap-1">
                    <Shield className="h-3 w-3" />
                    Partner Only
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">Audit Summary (Auto + Manual)</Label>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={generateAISummary}
                    disabled={isGeneratingAI || fileStatus === "locked"}
                  >
                    {isGeneratingAI ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : <Brain className="h-3 w-3 mr-1" />}
                    AI Generate Summary
                  </Button>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground mb-2">
                  AI auto-summarizes: Planning highlights, Execution procedures, Key risks & responses, Exceptions & conclusions
                </div>
                <Textarea
                  value={auditSummary}
                  onChange={(e) => setAuditSummary(e.target.value)}
                  placeholder="Enter or generate audit summary..."
                  rows={8}
                  disabled={fileStatus === "locked" || (!isPartner && auditSummary !== "")}
                />
              </div>

              <Separator />

              <div className="space-y-4">
                <Label className="text-base font-medium">Audit Opinion Selection (Partner Only) <span className="text-destructive">*</span></Label>
                <Select
                  value={auditOpinion}
                  onValueChange={(v) => setAuditOpinion(v as any)}
                  disabled={fileStatus === "locked" || !isPartner}
                >
                  <SelectTrigger className={!isPartner ? "opacity-50" : ""}>
                    <SelectValue placeholder="Select audit opinion..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unmodified">Unmodified Opinion (ISA 700)</SelectItem>
                    <SelectItem value="qualified">Qualified Opinion (ISA 705)</SelectItem>
                    <SelectItem value="adverse">Adverse Opinion (ISA 705)</SelectItem>
                    <SelectItem value="disclaimer">Disclaimer of Opinion (ISA 705)</SelectItem>
                  </SelectContent>
                </Select>
                {!isPartner && (
                  <p className="text-sm text-muted-foreground">Only Partner can select the audit opinion.</p>
                )}
              </div>

              {auditOpinion && auditOpinion !== "unmodified" && (
                <div className="space-y-4 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                  <Label className="text-base font-medium">Basis for Modification (ISA 705) <span className="text-destructive">*</span></Label>
                  <Textarea
                    value={basisForModification}
                    onChange={(e) => setBasisForModification(e.target.value)}
                    placeholder="Document the basis for the modified opinion..."
                    rows={4}
                    disabled={fileStatus === "locked" || !isPartner}
                  />
                </div>
              )}

              <div className="space-y-4">
                <Label className="text-base font-medium">Emphasis of Matter Paragraph (ISA 706) - Optional</Label>
                <Textarea
                  value={emphasisOfMatter}
                  onChange={(e) => setEmphasisOfMatter(e.target.value)}
                  placeholder="Enter emphasis of matter paragraph if applicable..."
                  rows={3}
                  disabled={fileStatus === "locked" || !isPartner}
                />
              </div>

              <div className="space-y-4">
                <Label className="text-base font-medium">Other Matter Paragraph - Optional</Label>
                <Textarea
                  value={otherMatterParagraph}
                  onChange={(e) => setOtherMatterParagraph(e.target.value)}
                  placeholder="Enter other matter paragraph if applicable..."
                  rows={3}
                  disabled={fileStatus === "locked" || !isPartner}
                />
              </div>

              <Separator />

              <div className="space-y-4">
                <Label className="text-base font-medium">Final Approvals</Label>
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Role</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="w-[120px]">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {approvals.map((approval, idx) => (
                        <TableRow key={approval.role}>
                          <TableCell className="font-medium">{approval.role}</TableCell>
                          <TableCell>
                            {approval.role === "Partner Approval" ? (
                              <span>{approval.name || "-"}</span>
                            ) : (
                              <Select
                                value={approval.name}
                                onValueChange={(v) => {
                                  const updated = [...approvals];
                                  updated[idx].name = v;
                                  updated[idx].status = "approved";
                                  updated[idx].date = new Date().toISOString().split('T')[0];
                                  setApprovals(updated);
                                }}
                                disabled={fileStatus === "locked"}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {teamMembers.map(m => (
                                    <SelectItem key={m} value={m}>{m}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                          <TableCell>
                            {approval.date || "-"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={approval.status === "approved" ? "default" : "secondary"}>
                              {approval.status === "approved" ? (
                                <><CheckCircle2 className="h-3 w-3 mr-1" /> Approved</>
                              ) : "Pending"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {isPartner && fileStatus === "open" && (
                <div className="flex justify-end pt-4">
                  <Button 
                    onClick={handlePartnerApproval}
                    disabled={!canLockFile}
                    className="gap-2"
                  >
                    <Lock className="h-4 w-4" />
                    Partner Approval & Lock File
                  </Button>
                </div>
              )}

              {!canLockFile && isPartner && fileStatus === "open" && (
                <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
                  <p className="font-medium mb-1">Requirements for Partner Approval:</p>
                  <ul className="list-disc ml-4 space-y-1">
                    <li className={allChecklistItemsAnswered ? "text-green-600" : ""}>
                      Answer all checklist items ({checklistProgress}/{checklistItems.length} completed)
                    </li>
                    <li className={noMissingRemarks ? "text-green-600" : "text-red-600"}>
                      Provide remarks for all "No" responses {!noMissingRemarks && `(${openReviewNotes} missing)`}
                    </li>
                    <li className={goingConcernConclusion !== "" ? "text-green-600" : ""}>
                      Complete Going Concern assessment with conclusion
                    </li>
                    <li className={basisForGoingConcernConclusion.trim() !== "" ? "text-green-600" : ""}>
                      Document basis for Going Concern conclusion
                    </li>
                    <li className={auditOpinion ? "text-green-600" : ""}>
                      Select audit opinion
                    </li>
                    <li className={approvals[0].status === "approved" ? "text-green-600" : ""}>
                      Prepared By approval
                    </li>
                    <li className={approvals[1].status === "approved" ? "text-green-600" : ""}>
                      Reviewed By approval
                    </li>
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Notes to the Financial Statements
                  </CardTitle>
                  <CardDescription>IFRS / Local GAAP Notes & Disclosures Generator — auto-generated from mapped FS Heads, trial balance, and entity profile</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <NotesDisclosurePanel
                draftFsData={draftFsData}
                coaAccounts={coaAccounts}
                fsPriorYear={fsPriorYear}
                trialBalance={trialBalance}
                engagementId={engagementId || ""}
                clientName={client?.name || "Company Name"}
                periodEnd={engagement?.periodEnd ? new Date(engagement.periodEnd).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : "Period End"}
                entityType={(client as any)?.entityType}
                industry={(client as any)?.industry}
                secpNo={(client as any)?.secpNo}
                fileStatus={fileStatus}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Written Representations Tab - ISA 580 */}
        <TabsContent value="written-representations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2" data-testid="text-written-representations-title">
                <FileSignature className="h-5 w-5" />
                Written Representations — ISA 580
              </CardTitle>
              <CardDescription>
                Obtain written representations from management and, where appropriate, those charged with governance.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4" />
                  Representation Checklist
                </h3>
                <div className="space-y-2">
                  {[
                    "Obtain management representation that they have fulfilled their responsibility for preparation of financial statements",
                    "Obtain representation that all transactions have been recorded and reflected",
                    "Obtain representation regarding completeness of information provided",
                    "Obtain representation regarding related party relationships and transactions",
                    "Obtain representation regarding subsequent events",
                    "Obtain representation regarding fraud and non-compliance with laws",
                    "Ensure representations are dated as of the date of the auditor's report",
                    "Representations signed by management with appropriate responsibility"
                  ].map((item, idx) => (
                    <label key={idx} className="flex items-start gap-2 text-sm cursor-pointer" data-testid={`label-wr-checklist-${idx}`}>
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-border"
                        checked={writtenRepChecklist[idx] || false}
                        onChange={(e) => {
                          const updated = [...writtenRepChecklist];
                          updated[idx] = e.target.checked;
                          setWrittenRepChecklist(updated);
                          saveEngine.signalChange();
                        }}
                        disabled={!canEdit}
                        data-testid={`checkbox-wr-checklist-${idx}`}
                      />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Representation Letter Template
                </h3>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground" data-testid="text-wr-template-note">
                      Standard management representation letter template available for customization
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Required Evidence
                </h3>
                <div className="space-y-2">
                  {[
                    "Signed management representation letter",
                    "Board authorization for financial statements",
                    "TCWG representation (if separate from management)"
                  ].map((item, idx) => (
                    <label key={idx} className="flex items-start gap-2 text-sm cursor-pointer" data-testid={`label-wr-evidence-${idx}`}>
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-border"
                        checked={writtenRepEvidence[idx] || false}
                        onChange={(e) => {
                          const updated = [...writtenRepEvidence];
                          updated[idx] = e.target.checked;
                          setWrittenRepEvidence(updated);
                          saveEngine.signalChange();
                        }}
                        disabled={!canEdit}
                        data-testid={`checkbox-wr-evidence-${idx}`}
                      />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <FileCheck2 className="h-4 w-4" />
                  Outputs
                </h3>
                <div className="space-y-2">
                  <label className="flex items-start gap-2 text-sm cursor-pointer" data-testid="label-wr-output-0">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-border"
                      checked={writtenRepOutputs[0] || false}
                      onChange={(e) => {
                        const updated = [...writtenRepOutputs];
                        updated[0] = e.target.checked;
                        setWrittenRepOutputs(updated);
                        saveEngine.signalChange();
                      }}
                      disabled={!canEdit}
                      data-testid="checkbox-wr-output-0"
                    />
                    <span>ISA 580 Written Representation Letter (signed)</span>
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reporting & Opinion Tab - ISA 700/705/706 */}
        <TabsContent value="reporting-opinion" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2" data-testid="text-reporting-opinion-title">
                <Scale className="h-5 w-5" />
                Forming an Opinion & Reporting — ISA 700/705/706
              </CardTitle>
              <CardDescription>
                Form an opinion on the financial statements and issue the auditor's report.{" "}
                To manage formal deliverables and issue reports, go to the{" "}
                <Link href={`/workspace/${engagementId}/deliverables`} className="text-primary hover:underline">
                  Deliverables Register
                </Link>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4" />
                  Opinion Decision Checklist
                </h3>
                <div className="space-y-2">
                  {[
                    "Evaluate whether financial statements are prepared in accordance with applicable framework",
                    "Evaluate whether financial statements achieve fair presentation",
                    "Consider whether sufficient appropriate audit evidence has been obtained",
                    "Evaluate uncorrected misstatements (ISA 450)",
                    "Consider going concern conclusions (ISA 570)",
                    "Consider subsequent events impact (ISA 560)",
                    "Determine type of opinion: Unmodified / Qualified / Adverse / Disclaimer"
                  ].map((item, idx) => (
                    <label key={idx} className="flex items-start gap-2 text-sm cursor-pointer" data-testid={`label-ro-checklist-${idx}`}>
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-border"
                        checked={reportingOpinionChecklist[idx] || false}
                        onChange={(e) => {
                          const updated = [...reportingOpinionChecklist];
                          updated[idx] = e.target.checked;
                          setReportingOpinionChecklist(updated);
                          saveEngine.signalChange();
                        }}
                        disabled={!canEdit}
                        data-testid={`checkbox-ro-checklist-${idx}`}
                      />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <FileCheck className="h-4 w-4" />
                  Opinion Type
                </h3>
                <div className="space-y-2">
                  {[
                    { value: "unmodified", label: "Unmodified Opinion (ISA 700)" },
                    { value: "qualified", label: "Qualified Opinion (ISA 705)" },
                    { value: "adverse", label: "Adverse Opinion (ISA 705)" },
                    { value: "disclaimer", label: "Disclaimer of Opinion (ISA 705)" }
                  ].map((option) => (
                    <label key={option.value} className="flex items-center gap-2 text-sm cursor-pointer" data-testid={`label-ro-opinion-${option.value}`}>
                      <input
                        type="radio"
                        name="reporting-opinion-type"
                        value={option.value}
                        checked={reportingOpinionType === option.value}
                        onChange={(e) => {
                          setReportingOpinionType(e.target.value);
                          saveEngine.signalChange();
                        }}
                        disabled={!canEdit}
                        className="h-4 w-4"
                        data-testid={`radio-ro-opinion-${option.value}`}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Key Audit Matters (ISA 701)
                </h3>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground" data-testid="text-ro-kam-note">
                      Determine and document Key Audit Matters to be communicated in the auditor's report
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Emphasis of Matter / Other Matter (ISA 706)
                </h3>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground" data-testid="text-ro-eom-note">
                      Document any Emphasis of Matter or Other Matter paragraphs required
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Required Evidence
                </h3>
                <div className="space-y-2">
                  {[
                    "Draft auditor's report",
                    "All supporting working papers",
                    "Partner review sign-off"
                  ].map((item, idx) => (
                    <label key={idx} className="flex items-start gap-2 text-sm cursor-pointer" data-testid={`label-ro-evidence-${idx}`}>
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-border"
                        checked={reportingEvidence[idx] || false}
                        onChange={(e) => {
                          const updated = [...reportingEvidence];
                          updated[idx] = e.target.checked;
                          setReportingEvidence(updated);
                          saveEngine.signalChange();
                        }}
                        disabled={!canEdit}
                        data-testid={`checkbox-ro-evidence-${idx}`}
                      />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <FileCheck2 className="h-4 w-4" />
                  Outputs
                </h3>
                <div className="space-y-2">
                  {[
                    "Draft Auditor's Report",
                    "KAM Documentation"
                  ].map((item, idx) => (
                    <label key={idx} className="flex items-start gap-2 text-sm cursor-pointer" data-testid={`label-ro-output-${idx}`}>
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-border"
                        checked={reportingOutputs[idx] || false}
                        onChange={(e) => {
                          const updated = [...reportingOutputs];
                          updated[idx] = e.target.checked;
                          setReportingOutputs(updated);
                          saveEngine.signalChange();
                        }}
                        disabled={!canEdit}
                        data-testid={`checkbox-ro-output-${idx}`}
                      />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Other Information Tab - ISA 720 */}
        <TabsContent value="other-information" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2" data-testid="text-other-information-title">
                <FileSpreadsheet className="h-5 w-5" />
                Other Information in Documents Containing Audited Financial Statements — ISA 720
              </CardTitle>
              <CardDescription>
                Read and consider other information included in annual reports and assess consistency with audited financial statements.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4" />
                  Review Checklist
                </h3>
                <div className="space-y-2">
                  {[
                    "Identify all other information in documents containing audited financial statements",
                    "Read the other information to identify material inconsistencies with financial statements",
                    "Read the other information to identify material misstatements of fact",
                    "Evaluate any material inconsistencies identified",
                    "Report to TCWG any uncorrected material inconsistencies",
                    "Consider implications for the auditor's report",
                    "Include an Other Information section in the auditor's report"
                  ].map((item, idx) => (
                    <label key={idx} className="flex items-start gap-2 text-sm cursor-pointer" data-testid={`label-oi-checklist-${idx}`}>
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-border"
                        checked={otherInfoChecklist[idx] || false}
                        onChange={(e) => {
                          const updated = [...otherInfoChecklist];
                          updated[idx] = e.target.checked;
                          setOtherInfoChecklist(updated);
                          saveEngine.signalChange();
                        }}
                        disabled={!canEdit}
                        data-testid={`checkbox-oi-checklist-${idx}`}
                      />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Required Evidence
                </h3>
                <div className="space-y-2">
                  {[
                    "Annual report draft",
                    "Directors' report",
                    "Chairman's statement",
                    "Any other documents accompanying financial statements"
                  ].map((item, idx) => (
                    <label key={idx} className="flex items-start gap-2 text-sm cursor-pointer" data-testid={`label-oi-evidence-${idx}`}>
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-border"
                        checked={otherInfoEvidence[idx] || false}
                        onChange={(e) => {
                          const updated = [...otherInfoEvidence];
                          updated[idx] = e.target.checked;
                          setOtherInfoEvidence(updated);
                          saveEngine.signalChange();
                        }}
                        disabled={!canEdit}
                        data-testid={`checkbox-oi-evidence-${idx}`}
                      />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <FileCheck2 className="h-4 w-4" />
                  Outputs
                </h3>
                <div className="space-y-2">
                  <label className="flex items-start gap-2 text-sm cursor-pointer" data-testid="label-oi-output-0">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-border"
                      checked={otherInfoOutputs[0] || false}
                      onChange={(e) => {
                        const updated = [...otherInfoOutputs];
                        updated[0] = e.target.checked;
                        setOtherInfoOutputs(updated);
                        saveEngine.signalChange();
                      }}
                      disabled={!canEdit}
                      data-testid="checkbox-oi-output-0"
                    />
                    <span>ISA 720 Other Information Review working paper</span>
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Lock Gate Tab - Final engagement lock before archiving */}
        <TabsContent value="lock-gate" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Lock Gate
              </CardTitle>
              <CardDescription>
                Final engagement lock and archival - Complete this as the last step before archiving the engagement
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LockGatePanel engagementId={engagementId || ''} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </PageShell>
  );
}
