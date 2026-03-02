import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useLocation, useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace, useEngagement } from "@/lib/workspace-context";
import { useAuth } from "@/lib/auth";
import { ClipboardList, Plus, Check, FileText, Download, Loader2, Upload, AlertTriangle, Info, Database, FileSpreadsheet, Save, ClipboardCheck, Building2, Users, BookOpen } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { PageShell } from "@/components/page-shell";
import { useRequisitionSaveBridge } from "@/hooks/use-requisition-save-bridge";
import { AIAssistBanner, PHASE_AI_CONFIGS } from "@/components/ai-assist-banner";
import {
  ACCOUNT_CLASSES,
  ACCOUNT_SUBCLASSES,
  TB_GROUPS,
  FS_LINE_ITEMS,
  CoATemplateAccount,
  IndustryTemplate,
  BASE_ACCOUNTS,
  MANUFACTURING_ACCOUNTS,
  IT_SAAS_ACCOUNTS,
  NGO_ACCOUNTS,
  CONSTRUCTION_ACCOUNTS,
  RETAIL_ACCOUNTS,
  HEALTHCARE_ACCOUNTS,
  SERVICES_ACCOUNTS,
  FINANCIAL_SERVICES_ACCOUNTS,
  HOSPITALITY_ACCOUNTS,
  EDUCATION_ACCOUNTS,
  COA_INDUSTRY_TEMPLATES,
  DEFAULT_COA_TEMPLATE,
  HEAD_OF_ACCOUNTS,
  TEMPLATE_OPTIONS,
  COMMON_REQUISITION_ITEMS,
  INDUSTRY_TEMPLATES,
} from "./information-requisition/data";
import { ReviewCoaSection } from "./information-requisition/ReviewCoaSection";
import { formatAccounting } from '@/lib/formatters';
import { fetchWithAuth } from "@/lib/fetchWithAuth";

interface InformationRequest {
  id: string;
  srNumber: number;
  requestCode: string;
  requestTitle: string;
  headOfAccounts: string;
  description: string;
  priority: string;
  status: string;
  clientResponse?: string;
  clientResponseDate?: string;
  provided?: 'YES' | 'NO' | null;
  providedDate?: string;
  createdAt: string;
  attachments?: Attachment[];
}

interface Attachment {
  id: string;
  fileName: string;
  fileSize: number;
  fileUrl: string;
  uploadedAt: string;
}

interface CoAAccount {
  id: string;
  glCode: string;
  glName: string;
  accountClass: string;
  accountSubclass: string;
  nature: 'DR' | 'CR';
  tbGroup: string;
  fsLineItem: string;
  notesDisclosureRef: string;
  aiSuggestedTBGroup: string | null;
  aiSuggestedFSLine: string | null;
  aiConfidence: number | null;
  aiRationale: string | null;
  isOverridden: boolean;
  overrideLockedAt: string | null;
  openingBalance?: number;
  periodDr?: number;
  periodCr?: number;
  closingBalance?: number;
  tbMovementDr?: number;
  tbMovementCr?: number;
  hasGl?: boolean;
}

interface PeriodDrilldownRow {
  id: string;
  voucherNo: string;
  date: string;
  docType: string;
  ref: string;
  narrative: string;
  debit: number;
  credit: number;
}

interface PeriodDrilldownData {
  totals: {
    count: number;
    totalDr: number;
    totalCr: number;
    totalAmountRequested: number;
  };
  dateRange: {
    from: string;
    to: string;
  };
  documentTypes: { type: string; count: number }[];
  rows: PeriodDrilldownRow[];
  meta: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export default function InformationRequisition() {
  const params = useParams<{ engagementId: string }>();
  const { 
    engagementId: contextEngagementId, 
    engagement, 
    client,
    refreshEngagement 
  } = useEngagement();
  const engagementId = params.engagementId || contextEngagementId || undefined;
  const { activeEngagement } = useWorkspace();
  const { toast } = useToast();
  const { token } = useAuth();
  
  const [dataIntakeSubTab, setDataIntakeSubTab] = useState('upload');

  const DATA_INTAKE_TABS = [
    { id: 'upload', label: 'Upload' },
    { id: 'tb', label: 'Trial Balance' },
    { id: 'gl', label: 'GL' },
    { id: 'ap', label: 'AP' },
    { id: 'ar', label: 'AR' },
    { id: 'bank', label: 'Bank' },
    { id: 'confirmations', label: 'Confirmations' },
    { id: 'mapping', label: 'FS Mapping' },
    { id: 'draft-fs', label: 'Draft FS' },
  ];

  const [requests, setRequests] = useState<InformationRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [coaAccounts, setCoaAccounts] = useState<CoAAccount[]>([]);
  const [isLoadingCoa, setIsLoadingCoa] = useState(true);
  const [isAddingCoaAccount, setIsAddingCoaAccount] = useState(false);
  const [selectedCoaIds, setSelectedCoaIds] = useState<Set<string>>(new Set());
  const [isDeletingMultiple, setIsDeletingMultiple] = useState(false);
  const [newCoaAccount, setNewCoaAccount] = useState({
    glCode: "",
    glName: "",
    accountClass: "",
    accountSubclass: "",
    nature: "DR" as 'DR' | 'CR',
    tbGroup: "",
    fsLineItem: "",
    notesDisclosureRef: "",
  });
  const [editingCoaId, setEditingCoaId] = useState<string | null>(null);
  const [editingCoaData, setEditingCoaData] = useState<Partial<CoAAccount>>({});
  const [isRunningAiSuggest, setIsRunningAiSuggest] = useState(false);
  const [aiSuggestProgress, setAiSuggestProgress] = useState(0);
  const [expandedRationale, setExpandedRationale] = useState<Set<string>>(new Set());
  const [isLoadingCoaTemplate, setIsLoadingCoaTemplate] = useState(false);
  const [clientInfo, setClientInfo] = useState<{ industry?: string; entityType?: string; specialEntityType?: string } | null>(null);
  
  // Period Drilldown State
  const [expandedDrilldown, setExpandedDrilldown] = useState<{ glCode: string; side: 'DR' | 'CR' } | null>(null);
  const [drilldownData, setDrilldownData] = useState<PeriodDrilldownData | null>(null);
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [drilldownDialogOpen, setDrilldownDialogOpen] = useState(false);
  const [drilldownFilters, setDrilldownFilters] = useState({
    from: '',
    to: '',
    search: '',
    docType: 'ALL',
    page: 1,
    pageSize: 20,
  });
  const [coaBalancesLoaded, setCoaBalancesLoaded] = useState(false);

  // Push Operations State
  const [isPushingToCoa, setIsPushingToCoa] = useState(false);
  const [isPushingToFsHeads, setIsPushingToFsHeads] = useState(false);
  const [pushProgress, setPushProgress] = useState({ current: 0, total: 0, message: "" });
  const [isAcceptingAllAi, setIsAcceptingAllAi] = useState(false);
  
  // Module-specific push state
  const [activePushModule, setActivePushModule] = useState<string | null>(null);
  const [modulePushProgress, setModulePushProgress] = useState({ current: 0, total: 0, message: "" });

  // Field Registry Recompute state
  const [isRecomputingFields, setIsRecomputingFields] = useState(false);
  
  const handleRecomputeFields = async () => {
    if (!effectiveEngagementId) {
      toast({ title: "Error", description: "No engagement selected.", variant: "destructive" });
      return;
    }
    
    setIsRecomputingFields(true);
    try {
      const response = await fetchWithAuth(`/api/field-registry/engagements/${effectiveEngagementId}/computed-fields/recompute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Failed to recompute fields");
      }
      
      const result = await response.json();
      toast({
        title: "Fields Recomputed",
        description: result.message || "All computed fields have been updated.",
      });
    } catch (error) {
      console.error("Recompute fields failed:", error);
      toast({
        title: "Recompute Failed",
        description: error instanceof Error ? error.message : "Failed to recompute fields.",
        variant: "destructive",
      });
    } finally {
      setIsRecomputingFields(false);
    }
  };
  
  // Push data to backend modules via /api/push/{module}
  const handlePushToModule = async (moduleName: string, moduleLabel: string, color: string) => {
    const count = mappingSummary?.totalAccounts || mappingData.length || 100;
    if (count === 0) return;
    
    if (!effectiveEngagementId) {
      toast({ title: "Error", description: "No engagement selected.", variant: "destructive" });
      return;
    }

    if (!readinessStatus.hasAllContextFields) {
      const missingFields = Object.entries(readinessStatus.contextFields || {})
        .filter(([_, field]) => !field.valid)
        .map(([_, field]) => field.label)
        .join(", ");
      toast({ 
        title: "Context Fields Incomplete", 
        description: `Missing: ${missingFields || "Required context fields"}. Please complete all context fields before pushing.`, 
        variant: "destructive" 
      });
      return;
    }

    if (!readinessStatus.tbValidated) {
      toast({ title: "TB Not Validated", description: "Trial Balance must be uploaded and validated before pushing.", variant: "destructive" });
      return;
    }

    if (mappingApprovalStatus !== "APPROVED") {
      toast({ title: "Approval Required", description: "Mapping must be APPROVED before pushing.", variant: "destructive" });
      return;
    }
    
    setActivePushModule(moduleName);
    setModulePushProgress({ current: 0, total: count, message: `Preparing ${moduleLabel}...` });

    try {
      const mappingPayload = mappingData.map(m => ({
        accountCode: m.glCode,
        accountName: m.glName,
        fsLineItem: (m.fsLineItem || m.suggestedFsLineItem) || undefined,
        closingDebit: m.closingDebit || 0,
        closingCredit: m.closingCredit || 0,
        openingDebit: m.openingDebit || 0,
        openingCredit: m.openingCredit || 0,
        glTotalDebit: m.glTotalDebit || 0,
        glTotalCredit: m.glTotalCredit || 0,
      }));

      const tbTotals = {
        closingDebit: mappingData.reduce((sum, m) => sum + (m.closingDebit || 0), 0),
        closingCredit: mappingData.reduce((sum, m) => sum + (m.closingCredit || 0), 0),
      };

      setModulePushProgress({ current: Math.floor(count * 0.3), total: count, message: `Sending to ${moduleLabel}...` });

      const endpointMap: Record<string, string> = {
        'materiality': 'materiality',
        'sampling': 'sampling',
        'fs-adj': 'fs',
        'risk': 'risk',
        'analytical': 'analytical',
        'audit-program': 'fs-heads',
      };

      const endpoint = endpointMap[moduleName] || moduleName;

      const response = await fetchWithAuth(`/api/push/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          engagementId: effectiveEngagementId,
          mappingData: mappingPayload,
          approvalStatus: mappingApprovalStatus,
          partnerOverride,
          partnerOverrideNotes: partnerOverride ? partnerOverrideNotes : undefined,
          periodEndDate: trialBalance.reportingPeriodEnd,
          currencyCode: trialBalance.currency,
          tbTotals,
        }),
      });

      setModulePushProgress({ current: Math.floor(count * 0.8), total: count, message: `Processing ${moduleLabel} response...` });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || `Failed to push to ${moduleLabel}`);
      }

      const result = await response.json();
      
      setModulePushProgress({ current: count, total: count, message: `${moduleLabel} complete!` });
      await new Promise(resolve => setTimeout(resolve, 300));

      toast({
        title: `Pushed to ${moduleLabel}`,
        description: result.message || `${count} accounts successfully processed.`,
      });

      if (result.data) {
        console.log(`${moduleLabel} push result:`, result.data);
      }
    } catch (error) {
      console.error(`Push to ${moduleLabel} failed:`, error);
      toast({
        title: "Push Failed",
        description: error instanceof Error ? error.message : `Failed to push to ${moduleLabel}.`,
        variant: "destructive",
      });
    } finally {
      setActivePushModule(null);
      setModulePushProgress({ current: 0, total: 0, message: "" });
    }
  };
  const [isExportingCsv, setIsExportingCsv] = useState(false);

  // GL/TB Upload State
  const glTbFileInputRef = useRef<HTMLInputElement>(null);
  const glFileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingGlTb, setIsUploadingGlTb] = useState(false);
  const [isUploadingGl, setIsUploadingGl] = useState(false);
  const [glTbData, setGlTbData] = useState<any>(null);
  const [loadingGlTbData, setLoadingGlTbData] = useState(false);
  const [selectedTbRows, setSelectedTbRows] = useState<Set<number>>(new Set());
  const [tbHasUnsavedChanges, setTbHasUnsavedChanges] = useState(false);
  const [isSavingTb, setIsSavingTb] = useState(false);
  const [runningTbAiAnalysis, setRunningTbAiAnalysis] = useState(false);
  const [glEntriesData, setGlEntriesData] = useState<any[]>([]);
  const [loadingGlEntries, setLoadingGlEntries] = useState(false);
  const [selectedGlRows, setSelectedGlRows] = useState<Set<number>>(new Set());
  const [glHasUnsavedChanges, setGlHasUnsavedChanges] = useState(false);
  const [tbAiAnalysisResults, setTbAiAnalysisResults] = useState<{
    observations: string[];
    recommendations: string[];
  } | null>(null);

  // Workbook Validation State
  const [workbookFile, setWorkbookFile] = useState<File | null>(null);
  const [isValidatingWorkbook, setIsValidatingWorkbook] = useState(false);
  const [isImportingWorkbook, setIsImportingWorkbook] = useState(false);
  const [showAdvancedUpload, setShowAdvancedUpload] = useState(false);

  const [workbookValidation, setWorkbookValidation] = useState<{
    sheets: Array<{ name: string; rowCount: number; detected: boolean }>;
    rowCounts: { tb: number; gl: number; parties: number; bankAccounts: number; openItems: number };
    issues: Array<{ sheet: string; row: number; severity: 'ERROR' | 'WARNING'; message: string }>;
    canImport: boolean;
    validated: boolean;
    errorCount: number;
    warningCount: number;
  } | null>(null);
  const [summaryPopup, setSummaryPopup] = useState<{
    open: boolean;
    type: 'tb' | 'gl' | 'parties' | 'banks' | 'openItems' | null;
  }>({ open: false, type: null });
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set());
  const [aiHelpLoading, setAiHelpLoading] = useState<string | null>(null);
  const [aiHelpResponses, setAiHelpResponses] = useState<Record<string, { text: string; isFallback: boolean }>>({});
  
  // Requisition editing state (for save bridge)
  const [editingRows, setEditingRows] = useState<Map<string, any>>(new Map());
  const editingRowsRef = useRef<Map<string, any>>(new Map());
  const saveTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newRow, setNewRow] = useState<Record<string, any>>({});
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  
  // IRL (Information Request List) state
  const [irlViewDialog, setIrlViewDialog] = useState<{
    open: boolean;
    item: { id: string; type: string; desc: string; status: string } | null;
  }>({ open: false, item: null });
  const [irlAddDialog, setIrlAddDialog] = useState<{
    open: boolean;
    item: { id: string; type: string; desc: string; status: string } | null;
  }>({ open: false, item: null });
  const [irlGenerating, setIrlGenerating] = useState<string | null>(null);
  const [irlItemStatuses, setIrlItemStatuses] = useState<Record<string, 'pending' | 'generated' | 'added'>>({});
  
  const [trialBalance, setTrialBalance] = useState({
    fileUploaded: false,
    fileName: "",
    uploadDate: "",
    reportingPeriodEnd: "",
    currency: "PKR",
    amountScale: "UNITS" as "UNITS" | "THOUSANDS" | "MILLIONS" | "BILLIONS",
    validationStatus: "",
    profitBeforeTax: "",
    revenue: "",
    totalAssets: "",
    totalEquity: "",
    aiObservations: "",
    professionalNotes: ""
  });
  
  // GL/TB Validation State
  const [isValidating, setIsValidating] = useState(false);
  const [validationResults, setValidationResults] = useState<{
    summary: {
      tbAccountCount: number;
      glEntryCount: number;
      glAccountCount: number;
      tbTotalDebit: number;
      tbTotalCredit: number;
      tbDifference: number;
      tbIsBalanced: boolean;
      glTotalDebit: number;
      glTotalCredit: number;
      glDifference: number;
      glIsBalanced: boolean;
      errorCount: number;
      warningCount: number;
      accountsWithErrors: number;
    };
    validation: {
      arithmeticCheck: { passed: boolean; errors: number };
      glTbReconciliation: { passed: boolean; errors: number };
      completenessCheck: { passed: boolean; warnings: number };
    };
    errors: Array<{
      glCode: string;
      glName: string;
      errorType: string;
      severity: "ERROR" | "WARNING";
      message: string;
      details: any;
    }>;
    accountSummaries: Array<{
      glCode: string;
      glName: string;
      tbOpening: number;
      tbDebit: number;
      tbCredit: number;
      tbClosing: number;
      tbCalculatedClosing: number;
      glDebit: number;
      glCredit: number;
      glNet: number;
      tbNet: number;
      hasErrors: boolean;
      errors: any[];
    }>;
  } | null>(null);
  
  // Mapping & Review State
  const [mappingData, setMappingData] = useState<Array<{
    glCode: string;
    glName: string;
    description?: string;
    openingDebit: number;
    openingCredit: number;
    tbMovementDebit: number;
    tbMovementCredit: number;
    closingDebit: number;
    closingCredit: number;
    glTotalDebit: number;
    glTotalCredit: number;
    glEntryCount: number;
    difference: number;
    status: "MATCHED" | "MISMATCH" | "PENDING";
    fsLineItem: string;
    aiSuggestion?: string;
    manualOverride?: string;
    isEditing?: boolean;
    hasChanges?: boolean;
    accountClass?: string;
    accountSubclass?: string;
    nature?: string;
    tbGroup?: string;
    suggestedTbGroup?: string;
    suggestedFsLineItem?: string;
    notesRef?: string;
  }>>([]);
  const [loadingMappingData, setLoadingMappingData] = useState(false);
  const [needsMappingRefresh, setNeedsMappingRefresh] = useState(false);
  const [runningAiMapping, setRunningAiMapping] = useState(false);
  const [showTbViewDialog, setShowTbViewDialog] = useState(false);
  const [mappingSummary, setMappingSummary] = useState<{
    totalAccounts: number;
    matched: number;
    mismatched: number;
    pending: number;
    totalTbDebit: number;
    totalTbCredit: number;
    totalGlDebit: number;
    totalGlCredit: number;
    totalOpeningDebit: number;
    totalOpeningCredit: number;
    totalClosingDebit: number;
    totalClosingCredit: number;
    isBalanced: boolean;
  } | null>(null);
  const [mappingViewMode, setMappingViewMode] = useState<"tb" | "gl" | "glComplete" | "differences" | "tbDetails">("tbDetails");
  const [hasUnsavedMappingChanges, setHasUnsavedMappingChanges] = useState(false);
  
  // GL Complete view - transaction-wise entries
  const [glCompleteEntries, setGlCompleteEntries] = useState<Array<{
    id: string;
    glCode: string;
    glName: string;
    voucherNo?: string;
    date: string;
    debit: number;
    credit: number;
    currency?: string;
    voucherType?: string;
    documentNo?: string;
    narrative?: string;
  }>>([]);
  const [loadingGlComplete, setLoadingGlComplete] = useState(false);

  // Readiness Panel State for Push Prerequisites
  const [mappingApprovalStatus, setMappingApprovalStatus] = useState<"DRAFT" | "PREPARED" | "REVIEWED" | "APPROVED">("DRAFT");
  const [partnerOverride, setPartnerOverride] = useState(false);
  const [partnerOverrideNotes, setPartnerOverrideNotes] = useState("");
  
  // Track if data has been pushed to CoA and if it has changed since
  const [hasPushedToCoa, setHasPushedToCoa] = useState(false);
  const [dataChangedSincePush, setDataChangedSincePush] = useState(false);
  
  // Review & CoA Sub-tabs state with URL query persistence
  const searchString = useSearch();
  const [, setLocation] = useLocation();
  
  // Parse tab from URL query
  const getTabFromUrl = useCallback(() => {
    const params = new URLSearchParams(searchString);
    const tab = params.get('tab');
    if (tab && ['summary', 'tb', 'gl', 'ap', 'ar', 'bank', 'other'].includes(tab)) {
      return tab as "summary" | "tb" | "gl" | "ap" | "ar" | "bank" | "other";
    }
    return "summary";
  }, [searchString]);
  
  const [reviewCoaSubTab, setReviewCoaSubTabState] = useState<"summary" | "tb" | "gl" | "ap" | "ar" | "bank" | "other">(getTabFromUrl);
  
  // Update URL when tab changes
  const setReviewCoaSubTab = useCallback((tab: "summary" | "tb" | "gl" | "ap" | "ar" | "bank" | "other") => {
    setReviewCoaSubTabState(tab);
    const params = new URLSearchParams(searchString);
    params.set('tab', tab);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }, [searchString]);
  
  // Sync tab from URL on initial load and URL changes
  useEffect(() => {
    const urlTab = getTabFromUrl();
    if (urlTab !== reviewCoaSubTab) {
      setReviewCoaSubTabState(urlTab);
    }
  }, [searchString, getTabFromUrl]);
  const [importedTbData, setImportedTbData] = useState<any[]>([]);
  const [importedGlData, setImportedGlData] = useState<any[]>([]);
  const [importedPartiesData, setImportedPartiesData] = useState<any[]>([]);
  const [importedBanksData, setImportedBanksData] = useState<any[]>([]);
  const [importedOpenItems, setImportedOpenItems] = useState<any[]>([]);
  const [loadingImportedData, setLoadingImportedData] = useState(false);
  
  // Reconciliation summary state
  interface ReconMismatch {
    glCode: string;
    glName: string;
    tbMovement: number;
    glMovement: number;
    difference: number;
    percentVariance: number;
  }
  
  interface ReconSummary {
    lastRunAt: string | null;
    runBy: string | null;
    tolerance: number;
    tbTotals: {
      count: number;
      totalPeriodDr: number;
      totalPeriodCr: number;
      difference: number;
      isBalanced: boolean;
    };
    glTotals: {
      count: number;
      totalDr: number;
      totalCr: number;
      difference: number;
      isBalanced: boolean;
    };
    tbGlRecon: {
      totalMismatchAmount: number;
      mismatchCount: number;
      matchedCount: number;
      topMismatches: ReconMismatch[];
      isReconciled: boolean;
    };
    controlAccounts: {
      arOpenItems: number;
      arControl: number;
      arDifference: number;
      arReconciled: boolean;
      apOpenItems: number;
      apControl: number;
      apDifference: number;
      apReconciled: boolean;
      bankOpenItems: number;
      bankControl: number;
      bankDifference: number;
      bankReconciled: boolean;
    };
    dataQuality: {
      missingMandatory: number;
      invalidDates: number;
      invalidAmounts: number;
      duplicateKeys: number;
      totalIssues: number;
      score: number;
    };
    fsMapping: {
      totalAccounts: number;
      mappedAccounts: number;
      unmappedAmount: number;
      percentMapped: number;
    };
    hasTbData: boolean;
    hasGlData: boolean;
  }
  
  const [reconSummary, setReconSummary] = useState<ReconSummary | null>(null);
  const [loadingReconSummary, setLoadingReconSummary] = useState(false);
  const [reconTolerance, setReconTolerance] = useState(0);
  
  // Compute readiness status for push operations with full context field validation
  const readinessStatus = useMemo(() => {
    const totalAccounts = mappingSummary?.totalAccounts || 0;
    const matchedAccounts = mappingSummary?.matched || 0;
    const mappingCoverageByCount = totalAccounts > 0 ? (matchedAccounts / totalAccounts) * 100 : 0;
    
    // Calculate coverage by value (TB amounts that have FS mapping)
    const totalValue = Math.abs(mappingSummary?.totalClosingDebit || 0) + Math.abs(mappingSummary?.totalClosingCredit || 0);
    const mappedValue = mappingData.filter(d => d.fsLineItem && d.fsLineItem !== "").reduce((sum, d) => sum + Math.abs(d.closingDebit || 0) + Math.abs(d.closingCredit || 0), 0);
    const mappingCoverageByValue = totalValue > 0 ? (mappedValue / totalValue) * 100 : 0;
    
    // Validation status checks
    const tbExists = !!glTbData?.lineItems?.length;
    const tbValidated = tbExists && (mappingSummary?.isBalanced ?? false);
    const glExists = mappingData.some(d => d.glTotalDebit > 0 || d.glTotalCredit > 0);
    const glValidated = glExists; // Simplified - GL exists means validated
    
    // Full context field validation
    const hasEngagementId = !!engagementId;
    const hasClientId = !!(client?.id || clientInfo?.industry);
    const hasFiscalYear = !!(engagement?.fiscalYearEnd || trialBalance.reportingPeriodEnd);
    const hasCurrency = !!(trialBalance.currency && trialBalance.currency.trim() !== "");
    const hasPeriodEnd = !!(engagement?.periodEnd || trialBalance.reportingPeriodEnd);
    const hasAmountScale = !!(trialBalance.amountScale);
    
    // Context fields status for display
    const clientDisplayValue = client?.name 
      ? `${client.name} (${client.id?.substring(0, 8)}...)`
      : client?.id || "Not set";
    const engagementDisplayValue = engagement?.engagementCode 
      ? `${engagement.engagementCode} (${engagementId?.substring(0, 8)}...)`
      : engagementId || "Not set";
    
    const contextFields = {
      clientId: { label: "Client", valid: hasClientId, value: clientDisplayValue },
      engagementId: { label: "Engagement", valid: hasEngagementId, value: engagementDisplayValue },
      fiscalYear: { label: "Fiscal Year", valid: hasFiscalYear, value: engagement?.fiscalYearEnd || trialBalance.reportingPeriodEnd || "Not set" },
      currency: { label: "Currency", valid: hasCurrency, value: trialBalance.currency || "PKR" },
      periodEnd: { label: "Period End", valid: hasPeriodEnd, value: engagement?.periodEnd || trialBalance.reportingPeriodEnd || "Not set" },
      amountScale: { label: "Amount Scale", valid: hasAmountScale, value: trialBalance.amountScale || "UNITS" },
    };
    
    // Missing fields list - context fields
    const missingFields: string[] = [];
    if (!hasEngagementId) missingFields.push("Engagement ID");
    if (!hasClientId) missingFields.push("Client ID");
    if (!hasFiscalYear) missingFields.push("Fiscal Year");
    if (!hasCurrency) missingFields.push("Currency");
    if (!hasPeriodEnd) missingFields.push("Period End Date");
    
    // Missing fields list - data validation
    if (!tbExists) missingFields.push("TB Upload");
    if (!tbValidated && tbExists) missingFields.push("TB Validation (must balance)");
    if (mappingCoverageByValue < 95 && tbExists) missingFields.push(`Mapping Coverage (${mappingCoverageByValue.toFixed(1)}% < 95%)`);
    if (mappingApprovalStatus !== "APPROVED" && tbExists) missingFields.push("Mapping Approval Required");
    
    // Push prerequisites - require all context fields
    const hasAllContextFields = hasEngagementId && hasClientId && hasFiscalYear && hasCurrency && hasPeriodEnd;
    
    // Check if all GL codes have matching Dr/Cr balances (no differences)
    const mismatchedGlCodes = mappingData.filter(item => {
      const debitDiff = Math.abs(item.tbMovementDebit - item.glTotalDebit);
      const creditDiff = Math.abs(item.tbMovementCredit - item.glTotalCredit);
      return debitDiff >= 0.01 || creditDiff >= 0.01;
    });
    const allGlCodesReconciled = mappingData.length > 0 && mismatchedGlCodes.length === 0;
    const glMismatchCount = mismatchedGlCodes.length;
    
    // Add GL mismatch to missing fields if applicable
    if (glMismatchCount > 0 && mappingData.length > 0) {
      missingFields.push(`GL Reconciliation (${glMismatchCount} accounts with differences)`);
    }
    
    const canPushToCoa = tbExists && mappingData.length > 0;
    const canPushToMateriality = hasAllContextFields && tbValidated && mappingApprovalStatus === "APPROVED";
    const canPushToFs = hasAllContextFields && mappingApprovalStatus === "APPROVED" && mappingCoverageByValue >= 95;
    const canPushToFsHeads = hasAllContextFields && mappingApprovalStatus === "APPROVED" && mappingCoverageByValue >= 95;
    const canPushToRisk = hasAllContextFields && tbValidated && mappingCoverageByValue >= 80;
    const canPushToAnalytical = hasAllContextFields && tbValidated;
    const canPushToSampling = hasAllContextFields && glValidated && mappingCoverageByValue >= 80;
    const canPushToAuditProgram = hasAllContextFields && (mappingApprovalStatus === "APPROVED" || mappingCoverageByValue >= 95);
    
    // Calculate overall readiness as percentage
    const totalChecks = 9; // All context + data checks
    const passedChecks = [
      hasEngagementId, hasClientId, hasFiscalYear, hasCurrency, hasPeriodEnd,
      tbExists, tbValidated, mappingCoverageByValue >= 95, mappingApprovalStatus === "APPROVED"
    ].filter(Boolean).length;
    const overallReadiness = Math.round((passedChecks / totalChecks) * 100);
    
    return {
      tbExists,
      tbValidated,
      glExists,
      glValidated,
      mappingCoverageByCount,
      mappingCoverageByValue,
      approvalStatus: mappingApprovalStatus,
      missingFields,
      contextFields,
      hasAllContextFields,
      canPushToCoa,
      canPushToMateriality,
      canPushToFs,
      canPushToFsHeads,
      canPushToRisk,
      canPushToAnalytical,
      canPushToSampling,
      canPushToAuditProgram,
      overallReadiness,
      allGlCodesReconciled,
      glMismatchCount,
    };
  }, [mappingSummary, mappingData, glTbData, engagementId, clientInfo, mappingApprovalStatus, client, engagement, trialBalance]);

  // Auto-map FS Line Item based on account name patterns
  const autoMapFsLine = useCallback((accountName: string): string => {
    if (!accountName) return "";
    const name = accountName.toLowerCase();
    
    // Cash & Bank
    if (name.includes("cash") || name.includes("bank") || name.includes("petty cash")) {
      return "Cash and Cash Equivalents";
    }
    // Receivables
    if (name.includes("receivable") || name.includes("debtor")) {
      return "Trade and Other Receivables";
    }
    if (name.includes("allowance") || name.includes("doubtful") || name.includes("provision for bad")) {
      return "Trade and Other Receivables";
    }
    // Inventory
    if (name.includes("inventory") || name.includes("stock") || name.includes("raw material") || 
        name.includes("work in progress") || name.includes("finished goods") || name.includes("wip")) {
      return "Inventories";
    }
    // Advances & Prepayments
    if (name.includes("advance") || name.includes("prepaid") || name.includes("prepayment") || 
        name.includes("wht") || name.includes("withholding")) {
      return "Advances and Prepayments";
    }
    // PPE
    if (name.includes("land") || name.includes("building") || name.includes("plant") || 
        name.includes("machinery") || name.includes("equipment") || name.includes("furniture") ||
        name.includes("vehicle") || name.includes("motor") || name.includes("computer") ||
        name.includes("depreciation")) {
      return "Property, Plant and Equipment";
    }
    // Intangibles
    if (name.includes("intangible") || name.includes("goodwill") || name.includes("patent") || 
        name.includes("trademark") || name.includes("software") || name.includes("license")) {
      return "Intangible Assets";
    }
    // Trade Payables
    if (name.includes("trade payable") || name.includes("creditor") || name.includes("accounts payable") ||
        name.includes("accrued")) {
      return "Trade and Other Payables";
    }
    // Other Payables
    if (name.includes("payable") || name.includes("sales tax") || name.includes("vat")) {
      return "Other Payables";
    }
    // Tax Liabilities
    if (name.includes("income tax") || name.includes("provision for tax") || name.includes("tax payable")) {
      return "Current Tax Liabilities";
    }
    // Borrowings
    if (name.includes("loan") || name.includes("borrowing") || name.includes("bank finance") || 
        name.includes("running finance") || name.includes("overdraft")) {
      if (name.includes("long") || name.includes("term")) {
        return "Long-term Borrowings";
      }
      return "Short-term Borrowings";
    }
    // Equity
    if (name.includes("capital") || name.includes("share") || name.includes("paid-up") || name.includes("subscribed")) {
      return "Share Capital";
    }
    if (name.includes("retained") || name.includes("surplus") || name.includes("reserve")) {
      return "Retained Earnings";
    }
    // Revenue
    if (name.includes("sales") || name.includes("revenue") || 
        (name.includes("income") && !name.includes("other income") && !name.includes("interest income") && !name.includes("dividend income") && !name.includes("tax"))) {
      return "Revenue";
    }
    if (name.includes("other income") || name.includes("interest income") || name.includes("dividend income") ||
        name.includes("gain on") || name.includes("miscellaneous income")) {
      return "Other Income";
    }
    // Cost of Sales
    if (name.includes("cost of sales") || name.includes("cost of goods") || name.includes("cogs") ||
        name.includes("direct cost") || name.includes("purchases")) {
      return "Cost of Sales";
    }
    // Expenses
    if (name.includes("salary") || name.includes("wage") || name.includes("employee") || name.includes("staff")) {
      return "Employee Benefits Expense";
    }
    if (name.includes("rent") || name.includes("utility") || name.includes("telephone") || 
        name.includes("office") || name.includes("admin")) {
      return "Administrative Expenses";
    }
    if (name.includes("marketing") || name.includes("advertising") || name.includes("promotion") ||
        name.includes("commission")) {
      return "Selling Expenses";
    }
    if (name.includes("depreciation expense") || name.includes("amortization expense")) {
      return "Depreciation and Amortization";
    }
    if (name.includes("interest") || name.includes("finance cost") || name.includes("finance charge") ||
        name.includes("bank charge") || name.includes("markup")) {
      return "Finance Costs";
    }
    if (name.includes("tax expense") || name.includes("taxation") || name.includes("current tax")) {
      return "Taxation";
    }
    if (name.includes("expense") || name.includes("cost")) {
      return "Other Expenses";
    }
    
    return "";
  }, []);

  const getRecommendedTemplate = useCallback(() => {
    if (!clientInfo) return COA_INDUSTRY_TEMPLATES[0];
    
    const { industry, entityType, specialEntityType } = clientInfo;
    
    if (specialEntityType === 'Section-42' || entityType === 'NGO/NPO' || entityType === 'Trust') {
      return COA_INDUSTRY_TEMPLATES.find(t => t.id === 'NGO_NPO') || COA_INDUSTRY_TEMPLATES[0];
    }
    
    const industryLower = (industry || '').toLowerCase();
    
    if (industryLower.includes('manufactur') || industryLower.includes('textile') || industryLower.includes('pharma')) {
      return COA_INDUSTRY_TEMPLATES.find(t => t.id === 'MANUFACTURING') || COA_INDUSTRY_TEMPLATES[0];
    }
    if (industryLower.includes('it') || industryLower.includes('software') || industryLower.includes('saas') || industryLower.includes('tech')) {
      return COA_INDUSTRY_TEMPLATES.find(t => t.id === 'IT_SAAS') || COA_INDUSTRY_TEMPLATES[0];
    }
    if (industryLower.includes('construct') || industryLower.includes('real estate') || industryLower.includes('infrastructure')) {
      return COA_INDUSTRY_TEMPLATES.find(t => t.id === 'CONSTRUCTION') || COA_INDUSTRY_TEMPLATES[0];
    }
    if (industryLower.includes('retail') || industryLower.includes('trading') || industryLower.includes('wholesale') || industryLower.includes('fmcg')) {
      return COA_INDUSTRY_TEMPLATES.find(t => t.id === 'RETAIL') || COA_INDUSTRY_TEMPLATES[0];
    }
    if (industryLower.includes('health') || industryLower.includes('hospital') || industryLower.includes('medical')) {
      return COA_INDUSTRY_TEMPLATES.find(t => t.id === 'HEALTHCARE') || COA_INDUSTRY_TEMPLATES[0];
    }
    if (industryLower.includes('service') || industryLower.includes('consult') || industryLower.includes('legal') || industryLower.includes('education')) {
      return COA_INDUSTRY_TEMPLATES.find(t => t.id === 'SERVICES') || COA_INDUSTRY_TEMPLATES[0];
    }
    
    return COA_INDUSTRY_TEMPLATES[0];
  }, [clientInfo]);

  // Build payload for saving
  const buildRequisitionPayload = () => ({
    requests,
    editingRows: Array.from(editingRows.entries()),
    isAddingNew,
    newRow,
    selectedTemplate
  });

  // Initialize save engine
  const saveEngine = useRequisitionSaveBridge(engagementId, buildRequisitionPayload);

  // Keep ref in sync with state
  useEffect(() => {
    editingRowsRef.current = editingRows;
  }, [editingRows]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      saveTimeoutRef.current.forEach(timeout => clearTimeout(timeout));
    };
  }, []);

  const effectiveEngagementId = engagementId || activeEngagement?.id;

  // Fetch reconciliation summary
  const fetchReconSummary = useCallback(async () => {
    if (!effectiveEngagementId) return;
    setLoadingReconSummary(true);
    try {
      const response = await fetchWithAuth(`/api/trial-balance/recon-summary/${effectiveEngagementId}?tolerance=${reconTolerance}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setReconSummary(data.data);
        }
      }
    } catch (error) {
      console.error('Error fetching reconciliation summary:', error);
    } finally {
      setLoadingReconSummary(false);
    }
  }, [effectiveEngagementId, token, reconTolerance]);
  
  // Fetch recon summary when tab is opened
  useEffect(() => {
    if (reviewCoaSubTab === 'summary' && effectiveEngagementId) {
      fetchReconSummary();
    }
  }, [reviewCoaSubTab, effectiveEngagementId, fetchReconSummary]);
  
  // Handle reconciliation export
  const handleReconExport = useCallback(async (type: 'recon' | 'exceptions') => {
    if (!effectiveEngagementId) return;
    try {
      const response = await fetchWithAuth(`/api/trial-balance/recon-summary/${effectiveEngagementId}/export?type=${type}&tolerance=${reconTolerance}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = type === 'exceptions' ? `recon_exceptions_${effectiveEngagementId}.csv` : `recon_report_${effectiveEngagementId}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast({ title: "Export Complete", description: `${type === 'exceptions' ? 'Exceptions' : 'Reconciliation report'} downloaded successfully.` });
      }
    } catch (error) {
      toast({ title: "Export Failed", description: "Failed to download the report.", variant: "destructive" });
    }
  }, [effectiveEngagementId, reconTolerance, token, toast]);

  useEffect(() => {
    if (effectiveEngagementId) {
      fetchRequests();
    }
  }, [effectiveEngagementId]);

  // Auto-populate reporting period end date from engagement data
  useEffect(() => {
    if (engagement?.fiscalYearEnd && !trialBalance.reportingPeriodEnd) {
      const dateStr = typeof engagement.fiscalYearEnd === 'string' 
        ? engagement.fiscalYearEnd.split('T')[0]
        : new Date(engagement.fiscalYearEnd).toISOString().split('T')[0];
      setTrialBalance(prev => ({ ...prev, reportingPeriodEnd: dateStr }));
    }
  }, [engagement?.fiscalYearEnd]);

  // Fetch imported data when trialBalance.fileUploaded becomes true
  useEffect(() => {
    if (!trialBalance.fileUploaded || !effectiveEngagementId) return;
    
    const fetchImportedData = async () => {
      setLoadingImportedData(true);
      
      try {
        const [tbRes, glRes, partiesRes, banksRes, openItemsRes] = await Promise.allSettled([
          fetchWithAuth(`/api/trial-balance/${effectiveEngagementId}/lines`),
          fetchWithAuth(`/api/gl/${effectiveEngagementId}/entries`),
          fetchWithAuth(`/api/audit/parties/${effectiveEngagementId}`),
          fetchWithAuth(`/api/audit/bank-accounts/${effectiveEngagementId}`),
          fetchWithAuth(`/api/audit/open-items/${effectiveEngagementId}`),
        ]);

        if (tbRes.status === 'fulfilled' && tbRes.value.ok) {
          const data = await tbRes.value.json();
          setImportedTbData(Array.isArray(data) ? data : data.lines || data.data || []);
        }
        if (glRes.status === 'fulfilled' && glRes.value.ok) {
          const data = await glRes.value.json();
          setImportedGlData(Array.isArray(data) ? data : data.entries || data.data || []);
        }
        if (partiesRes.status === 'fulfilled' && partiesRes.value.ok) {
          const data = await partiesRes.value.json();
          setImportedPartiesData(Array.isArray(data) ? data : data.parties || data.data || []);
        }
        if (banksRes.status === 'fulfilled' && banksRes.value.ok) {
          const data = await banksRes.value.json();
          setImportedBanksData(Array.isArray(data) ? data : data.banks || data.data || []);
        }
        if (openItemsRes.status === 'fulfilled' && openItemsRes.value.ok) {
          const data = await openItemsRes.value.json();
          setImportedOpenItems(Array.isArray(data) ? data : data.items || data.data || []);
        }
      } catch (error) {
        console.error('Error fetching imported data:', error);
      } finally {
        setLoadingImportedData(false);
      }
    };
    
    fetchImportedData();
  }, [trialBalance.fileUploaded, effectiveEngagementId, token]);

  const fetchRequests = async () => {
    if (!effectiveEngagementId) return;
    
    setIsLoading(true);
    try {
      const response = await fetchWithAuth(`/api/engagements/${effectiveEngagementId}/requisitions`);
      
      if (response.ok) {
        const data = await response.json();
        setRequests(data);
      }
    } catch (error) {
      console.error("Failed to fetch requests:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // GL/TB Upload Handlers - Template Downloads
  const handleDownloadTemplate = useCallback(async (type: 'tb' | 'gl', format: 'csv' | 'xlsx') => {
    try {
      const endpoint = type === 'tb' ? '/api/templates/download/tb-template' : '/api/templates/download/gl-template';
      
      const response = await fetchWithAuth(endpoint);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const filename = type === 'tb' ? `trial_balance_template.xlsx` : `general_ledger_template.xlsx`;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        const templateName = type === 'tb' ? 'Trial Balance' : 'General Ledger';
        const entryCount = type === 'tb' ? '96 accounts' : '730 transactions';
        toast({ title: "Template Downloaded", description: `${templateName} template (XLSX) with ${entryCount} of sample data downloaded.` });
      } else {
        toast({ title: "Error", description: "Failed to download template", variant: "destructive" });
      }
    } catch (error) {
      console.error("Download error:", error);
      toast({ title: "Error", description: "Failed to download template", variant: "destructive" });
    }
  }, [token, toast]);

  // GL/TB Validation Handler - placeholder to find next section

  // GL/TB Validation Handler
  const handleValidateGlTb = useCallback(async () => {
    if (!effectiveEngagementId) return;
    
    setIsValidating(true);
    try {
      const response = await fetchWithAuth(`/api/trial-balance/${effectiveEngagementId}/validate`);
      
      if (response.ok) {
        const data = await response.json();
        setValidationResults(data);
        
        if (data.summary.errorCount === 0 && data.summary.warningCount === 0) {
          toast({
            title: "Validation Passed",
            description: "All GL/TB checks passed successfully. No discrepancies found.",
          });
        } else {
          toast({
            title: "Validation Complete",
            description: `Found ${data.summary.errorCount} error(s) and ${data.summary.warningCount} warning(s). Please review below.`,
            variant: data.summary.errorCount > 0 ? "destructive" : "default",
          });
        }
      } else {
        const errorData = await response.json();
        toast({
          title: "Validation Failed",
          description: errorData.error || "Failed to validate GL/TB data",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Validation error:", error);
      toast({
        title: "Error",
        description: "Failed to run validation",
        variant: "destructive",
      });
    } finally {
      setIsValidating(false);
    }
  }, [effectiveEngagementId, token, toast]);



  // Generate mapping data from TB and GL for reconciliation
  const generateMappingData = useCallback(async () => {
    if (!effectiveEngagementId || !glTbData?.lineItems?.length) return;
    
    setLoadingMappingData(true);
    try {
      // Fetch GL entries for this engagement
      const response = await fetchWithAuth(`/api/trial-balance/gl-summary/${effectiveEngagementId}`);
      
      let glSummary: Record<string, { debit: number; credit: number; descriptions?: string[]; entryCount?: number }> = {};
      if (response.ok) {
        const data = await response.json();
        glSummary = data.summary || {};
      }
      
      // Map TB data with GL totals
      const mapped = glTbData.lineItems.map((item: any) => {
        const glData = glSummary[item.glCode || item.accountCode] || { debit: 0, credit: 0 };
        const tbDebit = Number(item.debits) || 0;
        const tbCredit = Number(item.credits) || 0;
        const openingDebit = Number(item.openingDebit) || 0;
        const openingCredit = Number(item.openingCredit) || 0;
        const closingDebit = Number(item.closingDebit) || 0;
        const closingCredit = Number(item.closingCredit) || 0;
        const glDebit = Number(glData.debit) || 0;
        const glCredit = Number(glData.credit) || 0;
        const tbNet = tbDebit - tbCredit;
        const glNet = glDebit - glCredit;
        const difference = Math.abs(tbNet - glNet);
        
        let status: "MATCHED" | "MISMATCH" | "PENDING" = "PENDING";
        if (glDebit === 0 && glCredit === 0) {
          status = "PENDING";
        } else if (difference < 0.01) {
          status = "MATCHED";
        } else {
          status = "MISMATCH";
        }
        
        // Generate description from GL entries or TB data
        const glDescriptions = glData.descriptions || [];
        const generateDescription = (acc: any): string => {
          // Priority 1: Use GL entry descriptions (actual transaction narratives)
          if (glDescriptions.length > 0) {
            return glDescriptions.slice(0, 3).join("; ");
          }
          // Priority 2: Use TB description/narrative
          if (acc.description) return acc.description;
          if (acc.narrative) return acc.narrative;
          if (acc.notes) return acc.notes;
          
          // Generate based on account type/category
          const code = String(acc.glCode || acc.accountCode);
          const name = (acc.glName || acc.accountName)?.toLowerCase() || "";
          
          if (code.startsWith("1")) {
            if (name.includes("cash") || name.includes("bank")) return "Cash and bank balances per ledger";
            if (name.includes("receivable") || name.includes("debtor")) return "Trade and other receivables";
            if (name.includes("inventory") || name.includes("stock")) return "Inventory and stock items";
            if (name.includes("prepaid") || name.includes("advance")) return "Prepayments and advances";
            if (name.includes("fixed") || name.includes("asset") || name.includes("equipment")) return "Property, plant and equipment";
            return "Asset account - current/non-current";
          }
          if (code.startsWith("2")) {
            if (name.includes("payable") || name.includes("creditor")) return "Trade and other payables";
            if (name.includes("accrued") || name.includes("accrual")) return "Accrued expenses and provisions";
            if (name.includes("loan") || name.includes("borrowing")) return "Loans and borrowings";
            if (name.includes("tax")) return "Tax liabilities";
            return "Liability account - current/non-current";
          }
          if (code.startsWith("3")) {
            if (name.includes("capital") || name.includes("share")) return "Share capital and reserves";
            if (name.includes("retained") || name.includes("earning")) return "Retained earnings";
            return "Equity account";
          }
          if (code.startsWith("4") || code.startsWith("5")) {
            if (name.includes("sales") || name.includes("revenue")) return "Revenue from operations";
            if (name.includes("service")) return "Service revenue";
            if (name.includes("interest")) return "Interest and finance income";
            return "Income/revenue account";
          }
          if (code.startsWith("6") || code.startsWith("7") || code.startsWith("8")) {
            if (name.includes("salary") || name.includes("wage")) return "Employee compensation";
            if (name.includes("rent")) return "Rent and occupancy costs";
            if (name.includes("utility") || name.includes("electric")) return "Utilities expense";
            if (name.includes("depreciation")) return "Depreciation expense";
            if (name.includes("cost") && name.includes("goods")) return "Cost of goods sold";
            return "Operating expense";
          }
          return "General ledger account";
        };
        
        return {
          glCode: item.glCode || item.accountCode,
          glName: item.glName || item.accountName,
          description: generateDescription(item),
          openingDebit,
          openingCredit,
          tbMovementDebit: tbDebit,
          tbMovementCredit: tbCredit,
          closingDebit,
          closingCredit,
          glTotalDebit: glDebit,
          glTotalCredit: glCredit,
          glEntryCount: glData.entryCount || 0,
          difference,
          status,
          fsLineItem: item.fsLine || autoMapFsLine(item.glName || item.accountName) || "",
          isEditing: false,
          hasChanges: false,
        };
      });
      
      setMappingData(mapped);
      setHasUnsavedMappingChanges(false);
      
      // Calculate summary
      const totalOpeningDebit = mapped.reduce((sum: number, m: any) => sum + m.openingDebit, 0);
      const totalOpeningCredit = mapped.reduce((sum: number, m: any) => sum + m.openingCredit, 0);
      const totalClosingDebit = mapped.reduce((sum: number, m: any) => sum + m.closingDebit, 0);
      const totalClosingCredit = mapped.reduce((sum: number, m: any) => sum + m.closingCredit, 0);
      const summary = {
        totalAccounts: mapped.length,
        matched: mapped.filter((m: any) => m.status === "MATCHED").length,
        mismatched: mapped.filter((m: any) => m.status === "MISMATCH").length,
        pending: mapped.filter((m: any) => m.status === "PENDING").length,
        totalTbDebit: mapped.reduce((sum: number, m: any) => sum + m.tbMovementDebit, 0),
        totalTbCredit: mapped.reduce((sum: number, m: any) => sum + m.tbMovementCredit, 0),
        totalGlDebit: mapped.reduce((sum: number, m: any) => sum + m.glTotalDebit, 0),
        totalGlCredit: mapped.reduce((sum: number, m: any) => sum + m.glTotalCredit, 0),
        totalOpeningDebit,
        totalOpeningCredit,
        totalClosingDebit,
        totalClosingCredit,
        isBalanced: Math.abs(totalClosingDebit - totalClosingCredit) < 0.01,
      };
      setMappingSummary(summary);
      
    } catch (error) {
      console.error("Error generating mapping data:", error);
      toast({
        title: "Error",
        description: "Failed to generate mapping data",
        variant: "destructive",
      });
    } finally {
      setLoadingMappingData(false);
    }
  }, [effectiveEngagementId, glTbData, token, toast]);
  
  // Fetch complete GL entries for GL (Complete) view
  const fetchGlCompleteEntries = useCallback(async () => {
    if (!effectiveEngagementId) return;
    
    setLoadingGlComplete(true);
    try {
      const response = await fetchWithAuth(`/api/trial-balance/gl-entries/${effectiveEngagementId}`);
      
      if (response.ok) {
        const data = await response.json();
        const entries = (data.entries || []).map((entry: any) => ({
          id: entry.id,
          glCode: entry.glCode || entry.accountCode,
          glName: entry.glName || entry.accountName || '',
          voucherNo: entry.voucherNo || entry.voucherNumber || '',
          date: entry.postingDate || entry.date || entry.transactionDate ? new Date(entry.postingDate || entry.date || entry.transactionDate).toLocaleDateString() : '',
          debit: Number(entry.debit) || 0,
          credit: Number(entry.credit) || 0,
          currency: entry.localCurrency || entry.currency || 'PKR',
          voucherType: entry.voucherType || entry.documentType || '',
          documentNo: entry.documentNo || entry.referenceNumber || entry.reference || '',
          narrative: entry.narrative || entry.description || '',
        }));
        setGlCompleteEntries(entries);
      }
    } catch (error) {
      console.error("Error fetching GL complete entries:", error);
    } finally {
      setLoadingGlComplete(false);
    }
  }, [effectiveEngagementId, token]);
  
  // Fetch GL complete entries when view mode changes to glComplete
  useEffect(() => {
    if (mappingViewMode === "glComplete" && glCompleteEntries.length === 0) {
      fetchGlCompleteEntries();
    }
  }, [mappingViewMode, glCompleteEntries.length, fetchGlCompleteEntries]);

  // Auto-refresh mapping data when GL data is loaded
  useEffect(() => {
    if (needsMappingRefresh && effectiveEngagementId && glTbData?.lineItems?.length) {
      setNeedsMappingRefresh(false);
      generateMappingData();
    }
  }, [needsMappingRefresh, effectiveEngagementId, glTbData, generateMappingData]);

  // Run AI mapping suggestions
  const handleRunAiMapping = useCallback(async () => {
    if (!mappingData.length) return;
    
    setRunningAiMapping(true);
    try {
      // AI Mapping: GL code-wise difference analysis
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      let mismatchCount = 0;
      let matchCount = 0;
      
      const updatedData = mappingData.map(item => {
        // Calculate Dr/Cr differences at GL code level
        const debitDiff = item.tbMovementDebit - item.glTotalDebit;
        const creditDiff = item.tbMovementCredit - item.glTotalCredit;
        const hasDebitMismatch = Math.abs(debitDiff) >= 0.01;
        const hasCreditMismatch = Math.abs(creditDiff) >= 0.01;
        const hasDifference = hasDebitMismatch || hasCreditMismatch;
        
        if (hasDifference) {
          mismatchCount++;
          
          // Generate AI suggestion based on difference type
          let suggestion = "";
          if (hasDebitMismatch && hasCreditMismatch) {
            suggestion = `GL Code ${item.glCode}: Both Dr & Cr differ. TB Dr: ${formatAccounting(item.tbMovementDebit)} vs GL Dr: ${formatAccounting(item.glTotalDebit)} (Diff: ${formatAccounting(debitDiff)}). TB Cr: ${formatAccounting(item.tbMovementCredit)} vs GL Cr: ${formatAccounting(item.glTotalCredit)} (Diff: ${formatAccounting(creditDiff)}). Review for missing or duplicate entries.`;
          } else if (hasDebitMismatch) {
            suggestion = `GL Code ${item.glCode}: Debit variance of ${formatAccounting(Math.abs(debitDiff))}. TB shows ${formatAccounting(item.tbMovementDebit)} but GL totals ${formatAccounting(item.glTotalDebit)}. Check for ${debitDiff > 0 ? 'missing GL debit entries' : 'extra GL debit entries'}.`;
          } else {
            suggestion = `GL Code ${item.glCode}: Credit variance of ${formatAccounting(Math.abs(creditDiff))}. TB shows ${formatAccounting(item.tbMovementCredit)} but GL totals ${formatAccounting(item.glTotalCredit)}. Check for ${creditDiff > 0 ? 'missing GL credit entries' : 'extra GL credit entries'}.`;
          }
          
          return { 
            ...item, 
            aiSuggestion: suggestion,
            status: "MISMATCH" as const,
            difference: Math.abs(debitDiff) + Math.abs(creditDiff)
          };
        } else {
          matchCount++;
          return { 
            ...item, 
            aiSuggestion: `GL Code ${item.glCode}: ✓ Reconciled. TB and GL balances match perfectly.`,
            status: "MATCHED" as const,
            difference: 0
          };
        }
      });
      
      setMappingData(updatedData);
      
      // Update status badges
      toast({
        title: "AI Mapping Analysis Complete",
        description: `Analyzed ${mappingData.length} GL codes: ${matchCount} matched, ${mismatchCount} with differences.`,
        variant: mismatchCount > 0 ? "default" : "default",
      });
      
    } catch (error) {
      console.error("AI mapping error:", error);
      toast({
        title: "Error",
        description: "Failed to run AI mapping analysis",
        variant: "destructive",
      });
    } finally {
      setRunningAiMapping(false);
    }
  }, [mappingData, toast]);

  // Toggle editing mode for a mapping row
  const toggleMappingEdit = useCallback((glCode: string) => {
    setMappingData(prev => prev.map(item => 
      item.glCode === glCode 
        ? { ...item, isEditing: !item.isEditing }
        : item
    ));
  }, []);

  // Update manual override for a mapping row
  const updateManualOverride = useCallback((glCode: string, value: string) => {
    setMappingData(prev => prev.map(item => 
      item.glCode === glCode 
        ? { ...item, manualOverride: value }
        : item
    ));
  }, []);

  // Accept/resolve a discrepancy
  const resolveDiscrepancy = useCallback((glCode: string) => {
    setMappingData(prev => {
      const updated = prev.map(item => 
        item.glCode === glCode 
          ? { ...item, status: "MATCHED" as const, isEditing: false }
          : item
      );
      
      // Recalculate summary
      const totalTbDebit = updated.reduce((sum, m) => sum + m.tbMovementDebit, 0);
      const totalTbCredit = updated.reduce((sum, m) => sum + m.tbMovementCredit, 0);
      const totalOpeningDebit = updated.reduce((sum, m) => sum + m.openingDebit, 0);
      const totalOpeningCredit = updated.reduce((sum, m) => sum + m.openingCredit, 0);
      const totalClosingDebit = updated.reduce((sum, m) => sum + m.closingDebit, 0);
      const totalClosingCredit = updated.reduce((sum, m) => sum + m.closingCredit, 0);
      const summary = {
        totalAccounts: updated.length,
        matched: updated.filter(m => m.status === "MATCHED").length,
        mismatched: updated.filter(m => m.status === "MISMATCH").length,
        pending: updated.filter(m => m.status === "PENDING").length,
        totalTbDebit,
        totalTbCredit,
        totalGlDebit: updated.reduce((sum, m) => sum + m.glTotalDebit, 0),
        totalGlCredit: updated.reduce((sum, m) => sum + m.glTotalCredit, 0),
        totalOpeningDebit,
        totalOpeningCredit,
        totalClosingDebit,
        totalClosingCredit,
        isBalanced: Math.abs(totalTbDebit - totalTbCredit) < 0.01,
      };
      setMappingSummary(summary);
      
      return updated;
    });
    
    toast({
      title: "Discrepancy Resolved",
      description: `Account ${glCode} marked as reconciled.`,
    });
  }, [toast]);

  const handleGlTbFileSelect = useCallback(() => {
    glTbFileInputRef.current?.click();
  }, []);

  // Get guidance text for validation issues
  const getIssueGuidance = useCallback((issue: { sheet: string; row: number; severity: 'ERROR' | 'WARNING'; message: string; code?: string }) => {
    const msg = issue.message.toLowerCase();
    const code = issue.code || '';
    
    if (msg.includes('do not balance') || code.includes('IMBALANCE')) {
      return {
        title: 'GL Totals Imbalance',
        steps: [
          'Export the GL sheet from your source system and verify total debits equal total credits',
          'Check for missing journal entries or partial uploads',
          'Look for rounding differences in currency conversions',
          'Verify all journal entries have matching debit and credit entries',
          'Check if there are suspended or pending entries not included'
        ],
        isaRef: 'ISA 500 - Audit Evidence: Ensure completeness and accuracy of financial data'
      };
    }
    
    if (msg.includes('missing') || msg.includes('required')) {
      return {
        title: 'Missing Required Data',
        steps: [
          'Check the template for required columns and ensure all are populated',
          'Verify column headers match exactly (case-sensitive)',
          'Remove any blank rows in the data range',
          'Ensure date formats are consistent (YYYY-MM-DD recommended)'
        ],
        isaRef: 'ISA 230 - Audit Documentation: Complete and accurate records required'
      };
    }
    
    if (msg.includes('duplicate')) {
      return {
        title: 'Duplicate Records Found',
        steps: [
          'Review the flagged rows for duplicate entries',
          'Check if these are legitimate reversals or corrections',
          'Remove true duplicates from the source file',
          'Re-export from source system with unique transaction IDs'
        ],
        isaRef: 'ISA 500 - Ensure reliability of audit evidence'
      };
    }
    
    if (msg.includes('format') || msg.includes('invalid')) {
      return {
        title: 'Data Format Issue',
        steps: [
          'Check numeric fields contain only numbers (no currency symbols)',
          'Verify date formats match expected pattern',
          'Ensure account codes follow your chart of accounts structure',
          'Remove special characters from text fields'
        ],
        isaRef: 'ISA 500 - Data reliability and consistency'
      };
    }
    
    return {
      title: 'Validation Issue',
      steps: [
        'Review the specific error message for details',
        'Check the referenced row/column in your spreadsheet',
        'Compare with the template format requirements',
        'Contact support if the issue persists'
      ],
      isaRef: 'ISA 230 - Audit Documentation Standards'
    };
  }, []);

  // Generate stable key for an issue
  const getIssueKey = useCallback((issue: { sheet: string; row: number; message: string }) => {
    return `${issue.sheet || 'unknown'}:${issue.row}:${issue.message.slice(0, 50)}`;
  }, []);

  // Handle AI help request for an issue
  const handleAiHelp = useCallback(async (issueKey: string, issue: { sheet: string; row: number; severity: 'ERROR' | 'WARNING'; message: string }) => {
    setAiHelpLoading(issueKey);
    try {
      const response = await fetchWithAuth(`/api/ai/analyze-issue`, {
        method: 'POST',
        timeout: 60000,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          engagementId: effectiveEngagementId,
          issue: {
            sheet: issue.sheet,
            row: issue.row,
            severity: issue.severity,
            message: issue.message
          },
          context: 'workbook_validation'
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setAiHelpResponses(prev => ({
          ...prev,
          [issueKey]: { 
            text: data.suggestion || data.analysis || 'AI analysis complete. Please review the guidance steps provided.',
            isFallback: false
          }
        }));
      } else {
        const guidance = getIssueGuidance(issue);
        setAiHelpResponses(prev => ({
          ...prev,
          [issueKey]: { 
            text: `Based on the issue type "${guidance.title}", here are recommended steps:\n\n${guidance.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nReference: ${guidance.isaRef}`,
            isFallback: true
          }
        }));
      }
    } catch (error) {
      const guidance = getIssueGuidance(issue);
      setAiHelpResponses(prev => ({
        ...prev,
        [issueKey]: { 
          text: `Based on the issue type "${guidance.title}", here are recommended steps:\n\n${guidance.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nReference: ${guidance.isaRef}`,
          isFallback: true
        }
      }));
    } finally {
      setAiHelpLoading(null);
    }
  }, [token, effectiveEngagementId, getIssueGuidance]);

  // Toggle issue expansion
  const toggleIssueExpanded = useCallback((issueKey: string) => {
    setExpandedIssues(prev => {
      const next = new Set(prev);
      if (next.has(issueKey)) {
        next.delete(issueKey);
      } else {
        next.add(issueKey);
      }
      return next;
    });
  }, []);

  // Workbook file selection (two-step: select -> validate -> import)
  const handleWorkbookFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setWorkbookFile(file);
    setWorkbookValidation(null);
    setExpandedIssues(new Set());
    setAiHelpResponses({});
    if (glTbFileInputRef.current) {
      glTbFileInputRef.current.value = '';
    }
  }, []);

  // Validate workbook (VALIDATE_ONLY mode)
  const handleValidateWorkbook = useCallback(async () => {
    if (!workbookFile || !effectiveEngagementId) return;

    setIsValidatingWorkbook(true);
    try {
      const formData = new FormData();
      formData.append('file', workbookFile);
      formData.append('mode', 'VALIDATE_ONLY');
      formData.append('currency', trialBalance.currency || 'PKR');
      formData.append('amount_scale', trialBalance.amountScale || 'UNITS');
      if (trialBalance.reportingPeriodEnd) {
        formData.append('period_end', trialBalance.reportingPeriodEnd);
      }

      const response = await fetchWithAuth(`/api/audit/engagements/${effectiveEngagementId}/imports/workbook`, {
        method: 'POST',
        body: formData,
        timeout: 120000,
      });

      const data = await response.json();
      
      if (response.ok) {
        const errors = (data.issues || []).filter((i: any) => i.severity === 'ERROR');
        const warnings = (data.issues || []).filter((i: any) => i.severity === 'WARNING');
        
        const totals = data.totals || {};
        setWorkbookValidation({
          sheets: data.sheets || [],
          rowCounts: {
            tb: totals.tbRows || 0,
            gl: totals.glRows || 0,
            parties: totals.partyRows || 0,
            bankAccounts: totals.bankAccountRows || 0,
            openItems: totals.openItemRows || 0,
          },
          issues: data.issues || [],
          canImport: errors.length === 0,
          validated: true,
          errorCount: errors.length,
          warningCount: warnings.length,
        });
        
        if (errors.length === 0) {
          toast({ title: "Validation Passed", description: `Ready to import. ${warnings.length} warning(s) found.` });
        } else {
          toast({ title: "Validation Failed", description: `${errors.length} error(s) found. Fix before importing.`, variant: "destructive" });
        }
      } else {
        toast({ title: "Validation Error", description: data.error || "Failed to validate workbook", variant: "destructive" });
      }
    } catch (error) {
      console.error("Validation error:", error);
      toast({ title: "Error", description: "Failed to validate workbook", variant: "destructive" });
    } finally {
      setIsValidatingWorkbook(false);
    }
  }, [workbookFile, effectiveEngagementId, token, toast, trialBalance]);

  // Import workbook (COMMIT mode)
  const handleImportWorkbook = useCallback(async () => {
    if (!workbookFile || !effectiveEngagementId || !workbookValidation?.canImport) return;

    setIsImportingWorkbook(true);
    try {
      const formData = new FormData();
      formData.append('file', workbookFile);
      formData.append('mode', 'COMMIT');
      formData.append('currency', trialBalance.currency || 'PKR');
      formData.append('amount_scale', trialBalance.amountScale || 'UNITS');
      if (trialBalance.reportingPeriodEnd) {
        formData.append('period_end', trialBalance.reportingPeriodEnd);
      }

      const response = await fetchWithAuth(`/api/audit/engagements/${effectiveEngagementId}/imports/workbook`, {
        method: 'POST',
        body: formData,
        timeout: 120000,
      });

      const data = await response.json();
      
      if (response.ok) {
        setTrialBalance(prev => ({
          ...prev,
          fileUploaded: true,
          fileName: workbookFile.name,
          uploadDate: new Date().toISOString(),
          validationStatus: "passed",
        }));
        setWorkbookFile(null);
        setWorkbookValidation(null);
        
        const counts = data.importCounts || {};
        toast({ 
          title: "Import Successful", 
          description: `Imported: ${counts.coaAccounts || 0} COA, ${counts.tbLines || 0} TB, ${counts.glLines || 0} GL entries`
        });
        
        // Fetch and load the imported data for AI Analysis and Review tabs
        try {
          
          const [tbResponse, partiesResponse, banksResponse, openItemsResponse] = await Promise.allSettled([
            fetchWithAuth(`/api/engagements/${effectiveEngagementId}/trial-balance`),
            fetchWithAuth(`/api/audit/parties/${effectiveEngagementId}`),
            fetchWithAuth(`/api/audit/bank-accounts/${effectiveEngagementId}`),
            fetchWithAuth(`/api/audit/open-items/${effectiveEngagementId}`),
          ]);
          
          if (tbResponse.status === 'fulfilled' && tbResponse.value.ok) {
            const tbData = await tbResponse.value.json();
            if (tbData && tbData.lineItems && tbData.lineItems.length > 0) {
              setGlTbData(tbData);
            }
          }
          
          if (partiesResponse.status === 'fulfilled' && partiesResponse.value.ok) {
            const partiesData = await partiesResponse.value.json();
            setImportedPartiesData(Array.isArray(partiesData) ? partiesData : partiesData.parties || []);
          }
          
          if (banksResponse.status === 'fulfilled' && banksResponse.value.ok) {
            const banksData = await banksResponse.value.json();
            setImportedBanksData(Array.isArray(banksData) ? banksData : banksData.banks || []);
          }
          
          if (openItemsResponse.status === 'fulfilled' && openItemsResponse.value.ok) {
            const openItemsData = await openItemsResponse.value.json();
            setImportedOpenItems(Array.isArray(openItemsData) ? openItemsData : openItemsData.items || []);
          }
          
          // Auto-navigate to Summary tab after successful import
          setReviewCoaSubTab('summary');
        } catch (fetchError) {
          console.error("Failed to fetch imported data:", fetchError);
        }
      } else {
        toast({ title: "Import Error", description: data.error || "Failed to import workbook", variant: "destructive" });
      }
    } catch (error) {
      console.error("Import error:", error);
      toast({ title: "Error", description: "Failed to import workbook", variant: "destructive" });
    } finally {
      setIsImportingWorkbook(false);
    }
  }, [workbookFile, effectiveEngagementId, workbookValidation, token, toast, trialBalance]);

  // Old TB-only upload (for Advanced Options)
  const handleGlTbFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !effectiveEngagementId) return;

    setIsUploadingGlTb(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('engagementId', effectiveEngagementId);
      formData.append('amount_scale', trialBalance.amountScale || 'UNITS');

      const response = await fetchWithAuth(`/api/trial-balance/upload/${effectiveEngagementId}`, {
        method: 'POST',
        body: formData,
        timeout: 120000,
      });

      if (response.ok) {
        const data = await response.json();
        setTrialBalance(prev => ({
          ...prev,
          fileUploaded: true,
          fileName: file.name,
          uploadDate: new Date().toISOString(),
          validationStatus: "passed",
          profitBeforeTax: data.profitBeforeTax || "",
          revenue: data.revenue || "",
          totalAssets: data.totalAssets || "",
          totalEquity: data.totalEquity || "",
        }));
        
        // Fetch and load the TB data for AI analysis
        try {
          const tbResponse = await fetchWithAuth(`/api/trial-balance/${effectiveEngagementId}`);
          if (tbResponse.ok) {
            const tbData = await tbResponse.json();
            if (tbData && tbData.lineItems && tbData.lineItems.length > 0) {
              setGlTbData(tbData);
            }
          }
        } catch (fetchError) {
          console.error("Failed to load TB data after upload:", fetchError);
        }
        
        toast({ title: "Uploaded", description: `${file.name} uploaded successfully` });
      } else {
        toast({ title: "Error", description: "Failed to upload file", variant: "destructive" });
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast({ title: "Error", description: "Failed to upload file", variant: "destructive" });
    } finally {
      setIsUploadingGlTb(false);
      if (glTbFileInputRef.current) {
        glTbFileInputRef.current.value = '';
      }
    }
  }, [effectiveEngagementId, token, toast, trialBalance.amountScale]);

  // GL File Upload Handlers
  const handleGlFileSelect = useCallback(() => {
    glFileInputRef.current?.click();
  }, []);

  const handleGlFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !effectiveEngagementId) return;

    setIsUploadingGl(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('engagementId', effectiveEngagementId);

      const response = await fetchWithAuth(`/api/gl/upload/${effectiveEngagementId}`, {
        method: 'POST',
        body: formData,
        timeout: 120000,
      });

      if (response.ok) {
        const data = await response.json();
        // Load the GL entries into state
        if (data.entries && Array.isArray(data.entries)) {
          setGlEntriesData(data.entries);
          setGlHasUnsavedChanges(false);
        }
        toast({ title: "Uploaded", description: `${file.name} uploaded successfully with ${data.entryCount || data.entries?.length || 0} GL entries` });
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast({ title: "Error", description: errorData.error || "Failed to upload GL file", variant: "destructive" });
      }
    } catch (error) {
      console.error("GL Upload error:", error);
      toast({ title: "Error", description: "Failed to upload GL file", variant: "destructive" });
    } finally {
      setIsUploadingGl(false);
      if (glFileInputRef.current) {
        glFileInputRef.current.value = '';
      }
    }
  }, [effectiveEngagementId, token, toast]);

  const handleDeleteGlTb = useCallback(async () => {
    if (!effectiveEngagementId) return;
    try {
      const response = await fetchWithAuth(`/api/audit/engagements/${effectiveEngagementId}/imports/workbook?target=all`, {
        method: 'DELETE',
      });
      if (response.ok) {
        const data = await response.json();
        setTrialBalance({
          fileUploaded: false, fileName: "", uploadDate: "", reportingPeriodEnd: "",
          currency: "PKR", amountScale: "UNITS", validationStatus: "", profitBeforeTax: "", revenue: "",
          totalAssets: "", totalEquity: "", aiObservations: "", professionalNotes: ""
        });
        setGlTbData(null);
        setWorkbookFile(null);
        setWorkbookValidation(null);
        toast({ 
          title: "Deleted", 
          description: `Deleted ${data.deleteCounts?.tbLines || 0} TB lines, ${data.deleteCounts?.glEntries || 0} GL entries` 
        });
      } else {
        const error = await response.json();
        toast({ title: "Error", description: error.error || "Failed to delete workbook data", variant: "destructive" });
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast({ title: "Error", description: "Failed to delete workbook data", variant: "destructive" });
    }
  }, [effectiveEngagementId, token, toast]);

  const handleViewGlTb = useCallback(async () => {
    if (!effectiveEngagementId) return;
    
    // If data already loaded, just show the dialog
    if (glTbData && glTbData.lineItems && glTbData.lineItems.length > 0) {
      setShowTbViewDialog(true);
      return;
    }
    
    setLoadingGlTbData(true);
    try {
      const response = await fetchWithAuth(`/api/engagements/${effectiveEngagementId}/trial-balance`);
      if (response.ok) {
        const data = await response.json();
        if (data && data.lineItems && data.lineItems.length > 0) {
          setGlTbData(data);
          setShowTbViewDialog(true);
        }
      }
    } catch (error) {
      console.error("View error:", error);
      toast({ title: "Error", description: "Failed to load trial balance data", variant: "destructive" });
    } finally {
      setLoadingGlTbData(false);
    }
  }, [effectiveEngagementId, token, toast, glTbData]);

  const fetchCoaAccounts = useCallback(async () => {
    if (!effectiveEngagementId) return;
    setIsLoadingCoa(true);
    try {
      const response = await fetchWithAuth(`/api/engagements/${effectiveEngagementId}/coa`);
      if (response.ok) {
        const data = await response.json();
        setCoaAccounts(data);
      }
    } catch (error) {
      console.error("Failed to fetch CoA accounts:", error);
    } finally {
      setIsLoadingCoa(false);
    }
  }, [effectiveEngagementId, token]);

  // Fetch CoA balances from TB and GL
  const fetchCoaBalances = useCallback(async () => {
    if (!effectiveEngagementId || coaAccounts.length === 0) return;
    try {
      const response = await fetchWithAuth(`/api/trial-balance/coa-with-balances/${effectiveEngagementId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.balances) {
          setCoaAccounts(prev => prev.map(acc => {
            const balance = data.balances[acc.glCode];
            if (balance) {
              return {
                ...acc,
                openingBalance: balance.openingBalance,
                periodDr: balance.periodDr,
                periodCr: balance.periodCr,
                closingBalance: balance.closingBalance,
                tbMovementDr: balance.tbMovementDr,
                tbMovementCr: balance.tbMovementCr,
                hasGl: balance.hasGl,
              };
            }
            return acc;
          }));
          setCoaBalancesLoaded(true);
        }
      }
    } catch (error) {
      console.error("Failed to fetch CoA balances:", error);
    }
  }, [effectiveEngagementId, token, coaAccounts.length]);

  // Fetch period drilldown data
  const fetchPeriodDrilldown = useCallback(async (glCode: string, side: 'DR' | 'CR', page = 1) => {
    if (!effectiveEngagementId) return;
    setDrilldownLoading(true);
    try {
      const params = new URLSearchParams({
        side,
        page: String(page),
        pageSize: String(drilldownFilters.pageSize),
      });
      if (drilldownFilters.from) params.append('from', drilldownFilters.from);
      if (drilldownFilters.to) params.append('to', drilldownFilters.to);
      if (drilldownFilters.search) params.append('search', drilldownFilters.search);
      if (drilldownFilters.docType !== 'ALL') params.append('docType', drilldownFilters.docType);

      const response = await fetchWithAuth(`/api/trial-balance/coa/${effectiveEngagementId}/account/${glCode}/period-detail?${params}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setDrilldownData(data);
        }
      }
    } catch (error) {
      console.error("Failed to fetch period drilldown:", error);
      toast({ title: "Error", description: "Failed to load period detail", variant: "destructive" });
    } finally {
      setDrilldownLoading(false);
    }
  }, [effectiveEngagementId, token, drilldownFilters, toast]);

  // Build drilldown data from glCompleteEntries
  const buildDrilldownFromGl = useCallback((glCode: string, side: 'DR' | 'CR') => {
    const accountEntries = glCompleteEntries.filter(e => e.glCode === glCode);
    
    // Filter by side (DR = debit > 0, CR = credit > 0)
    const filteredEntries = side === 'DR' 
      ? accountEntries.filter(e => e.debit > 0)
      : accountEntries.filter(e => e.credit > 0);

    // Apply additional filters
    let entries = filteredEntries;
    if (drilldownFilters.search) {
      const search = drilldownFilters.search.toLowerCase();
      entries = entries.filter(e => 
        (e.voucherNo || '').toLowerCase().includes(search) ||
        (e.narrative || '').toLowerCase().includes(search) ||
        (e.documentNo || '').toLowerCase().includes(search)
      );
    }
    if (drilldownFilters.from) {
      entries = entries.filter(e => new Date(e.date) >= new Date(drilldownFilters.from));
    }
    if (drilldownFilters.to) {
      entries = entries.filter(e => new Date(e.date) <= new Date(drilldownFilters.to));
    }
    if (drilldownFilters.docType !== 'ALL') {
      entries = entries.filter(e => e.voucherType === drilldownFilters.docType);
    }

    // Get unique document types for filter dropdown
    const docTypeCounts = filteredEntries.reduce((acc, e) => {
      const dt = e.voucherType || 'OTHER';
      acc[dt] = (acc[dt] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Calculate totals
    const totalDr = entries.reduce((sum, e) => sum + e.debit, 0);
    const totalCr = entries.reduce((sum, e) => sum + e.credit, 0);
    const totalAmount = side === 'DR' ? totalDr : totalCr;

    // Get date range
    const dates = entries.map(e => new Date(e.date)).filter(d => !isNaN(d.getTime()));
    const minDate = dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : null;
    const maxDate = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : null;

    // Paginate
    const pageSize = drilldownFilters.pageSize;
    const page = drilldownFilters.page;
    const startIndex = (page - 1) * pageSize;
    const paginatedEntries = entries.slice(startIndex, startIndex + pageSize);

    // Build drilldown data structure
    const drilldown: PeriodDrilldownData = {
      totals: {
        count: entries.length,
        totalDr,
        totalCr,
        totalAmountRequested: totalAmount,
      },
      dateRange: {
        from: minDate ? minDate.toISOString() : '',
        to: maxDate ? maxDate.toISOString() : '',
      },
      documentTypes: Object.entries(docTypeCounts).map(([type, count]) => ({ type, count })),
      rows: paginatedEntries.map(e => ({
        id: e.id,
        voucherNo: e.voucherNo || '',
        date: e.date,
        docType: e.voucherType || '',
        ref: e.documentNo || '',
        narrative: e.narrative || '',
        debit: e.debit,
        credit: e.credit,
      })),
      meta: {
        page,
        pageSize,
        totalCount: entries.length,
        totalPages: Math.ceil(entries.length / pageSize),
        hasNextPage: page < Math.ceil(entries.length / pageSize),
        hasPrevPage: page > 1,
      },
    };

    return drilldown;
  }, [glCompleteEntries, drilldownFilters]);

  // Toggle drilldown expansion - opens dialog popup
  const toggleDrilldown = useCallback((glCode: string, side: 'DR' | 'CR', hasAmount: boolean, hasGl: boolean) => {
    if (!hasAmount) return;
    
    if (glCompleteEntries.length === 0) {
      fetchGlCompleteEntries().then(() => {
        setExpandedDrilldown({ glCode, side });
        setDrilldownFilters(prev => ({ ...prev, page: 1 }));
        setDrilldownDialogOpen(true);
      });
      return;
    }
    
    setExpandedDrilldown({ glCode, side });
    setDrilldownFilters(prev => ({ ...prev, page: 1 }));
    setDrilldownDialogOpen(true);
    
    const drilldown = buildDrilldownFromGl(glCode, side);
    setDrilldownData(drilldown);
  }, [glCompleteEntries, fetchGlCompleteEntries, buildDrilldownFromGl]);
  
  // Close drilldown dialog
  const closeDrilldownDialog = useCallback(() => {
    setDrilldownDialogOpen(false);
    setExpandedDrilldown(null);
    setDrilldownData(null);
  }, []);

  // Rebuild drilldown data when filters change (for local GL-based drilldown)
  useEffect(() => {
    if (expandedDrilldown && drilldownDialogOpen && glCompleteEntries.length > 0) {
      const drilldown = buildDrilldownFromGl(expandedDrilldown.glCode, expandedDrilldown.side);
      setDrilldownData(drilldown);
    }
  }, [drilldownFilters, expandedDrilldown, drilldownDialogOpen, glCompleteEntries, buildDrilldownFromGl]);

  // Export drilldown to CSV
  const exportDrilldownCsv = useCallback(() => {
    if (!drilldownData?.rows?.length || !expandedDrilldown) return;
    const account = coaAccounts.find(a => a.glCode === expandedDrilldown.glCode);
    const headers = ["Voucher No", "Date", "Doc Type", "Reference", "Narrative", "Debit", "Credit"];
    const rows = drilldownData.rows.map(r => [
      r.voucherNo,
      new Date(r.date).toLocaleDateString(),
      r.docType,
      r.ref,
      `"${(r.narrative || '').replace(/"/g, '""')}"`,
      Math.round(r.debit).toString(),
      Math.round(r.credit).toString(),
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${account?.glCode || 'account'}_${expandedDrilldown.side}_drilldown.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: `Drilldown exported to CSV (${drilldownData.rows.length} rows)` });
  }, [drilldownData, expandedDrilldown, coaAccounts, toast]);

  // IRL item details for view dialog
  const getIrlItemDetails = useCallback((itemId: string) => {
    const details: Record<string, { 
      title: string; 
      description: string; 
      requirements: string[]; 
      isaRef: string;
      generatesFrom: string;
    }> = {
      'bank-statements': {
        title: 'Bank Statements Checklist',
        description: 'Comprehensive request for bank statements from all identified bank accounts for the audit period.',
        requirements: [
          'Monthly bank statements for all accounts',
          'Bank reconciliation statements at period end',
          'Confirmation of account signatories',
          'List of dormant accounts if any'
        ],
        isaRef: 'ISA 500 - Audit Evidence; ISA 505 - External Confirmations',
        generatesFrom: 'Bank accounts identified from GL/Party Master'
      },
      'inventory-schedules': {
        title: 'Inventory Valuation Schedules',
        description: 'Request for detailed inventory valuation schedules and supporting documentation.',
        requirements: [
          'Inventory listing as at period end',
          'Valuation methodology documentation',
          'Physical count procedures and results',
          'Slow-moving/obsolete inventory analysis'
        ],
        isaRef: 'ISA 501 - Audit Evidence - Specific Considerations for Selected Items',
        generatesFrom: 'Inventory accounts in Chart of Accounts'
      },
      'far-register': {
        title: 'Fixed Assets Register',
        description: 'Request for complete fixed assets register with additions, disposals, and depreciation schedules.',
        requirements: [
          'Complete FAR with asset details',
          'Additions during the year with supporting documents',
          'Disposals schedule with proceeds',
          'Depreciation calculation sheet'
        ],
        isaRef: 'ISA 500 - Audit Evidence; ISA 540 - Accounting Estimates',
        generatesFrom: 'Property, Plant & Equipment accounts in CoA'
      },
      'revenue-invoices': {
        title: 'Revenue Invoices Sample',
        description: 'Sample selection of revenue invoices for substantive testing of revenue recognition.',
        requirements: [
          'Selected invoice copies with delivery notes',
          'Customer purchase orders',
          'Sales contracts for significant transactions',
          'Credit notes issued during the period'
        ],
        isaRef: 'ISA 530 - Audit Sampling; ISA 500 - Audit Evidence',
        generatesFrom: 'Revenue accounts and materiality thresholds'
      },
      'payroll-records': {
        title: 'Payroll Records & Documentation',
        description: 'Request for payroll registers, tax filings, and employee documentation.',
        requirements: [
          'Monthly payroll registers',
          'Tax returns and challan copies',
          'Employee contracts for new joiners',
          'Provident fund/gratuity schedules'
        ],
        isaRef: 'ISA 500 - Audit Evidence',
        generatesFrom: 'Salary and staff cost accounts'
      },
      'bank-confirmations': {
        title: 'Bank Confirmation Pack',
        description: 'External confirmation requests for all bank accounts identified.',
        requirements: [
          'Standard bank confirmation letters',
          'Balance confirmations',
          'Loan/facility confirmations',
          'Guarantees and contingencies'
        ],
        isaRef: 'ISA 505 - External Confirmations',
        generatesFrom: 'Bank accounts from Party Master'
      },
      'legal-confirmations': {
        title: 'Legal Confirmations',
        description: 'Attorney confirmation letters and legal matters checklist.',
        requirements: [
          'List of legal advisors',
          'Attorney confirmation letters',
          'Status of pending litigation',
          'Contingent liabilities assessment'
        ],
        isaRef: 'ISA 501 - Audit Evidence - Litigation and Claims',
        generatesFrom: 'Legal expense accounts and provisions'
      },
      'arap-circularization': {
        title: 'AR/AP Circularization',
        description: 'Population extract for receivables and payables confirmation.',
        requirements: [
          'Aged receivables listing',
          'Aged payables listing',
          'Confirmation letters (positive/negative)',
          'Alternative procedures for non-responses'
        ],
        isaRef: 'ISA 505 - External Confirmations',
        generatesFrom: 'Trade receivables/payables from TB'
      }
    };
    return details[itemId] || null;
  }, []);

  // Handle viewing IRL item details
  const handleViewIrlItem = useCallback((item: { id: string; type: string; desc: string; status: string }) => {
    setIrlViewDialog({ open: true, item });
  }, []);

  // Handle adding/generating IRL item
  const handleAddIrlItem = useCallback((item: { id: string; type: string; desc: string; status: string }) => {
    setIrlAddDialog({ open: true, item });
  }, []);

  // Generate IRL item and add to requests
  const handleGenerateIrlItem = useCallback(async (item: { id: string; type: string; desc: string; status: string }) => {
    // Check if we have TB/GL data to generate from
    const hasData = glTbData?.lineItems?.length && glTbData.lineItems.length > 0;
    
    if (!hasData) {
      toast({
        title: "No Data Available",
        description: "Please upload or load Trial Balance/GL data first before generating information requests.",
        variant: "destructive"
      });
      return;
    }
    
    setIrlGenerating(item.id);
    
    try {
      // Simulate generating the IRL item
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      // Create information request based on IRL type
      const details = getIrlItemDetails(item.id);
      if (details) {
        // Add to existing requests list
        const newRequest: InformationRequest = {
          id: `irl-${item.id}-${Date.now()}`,
          srNumber: requests.length + 1,
          requestCode: `IRL-${item.id.toUpperCase().slice(0, 4)}-${String(requests.length + 1).padStart(3, '0')}`,
          requestTitle: details.title,
          headOfAccounts: item.type,
          description: `${details.description}\n\nRequired Documents:\n${details.requirements.map((r, i) => `${i + 1}. ${r}`).join('\n')}`,
          priority: 'HIGH',
          status: 'PENDING',
          createdAt: new Date().toISOString(),
          attachments: []
        };
        
        setRequests(prev => [...prev, newRequest]);
        
        // Update status to 'added' after successfully adding
        setIrlItemStatuses(prev => ({
          ...prev,
          [item.id]: 'added'
        }));
        
        toast({
          title: "Request Generated",
          description: `${item.type} request has been added to your information request list.`,
        });
      }
      
      setIrlAddDialog({ open: false, item: null });
      
    } catch (error) {
      toast({
        title: "Generation Failed",
        description: "Could not generate the information request. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIrlGenerating(null);
    }
  }, [glTbData, getIrlItemDetails, requests.length, toast]);

  // AI Analysis function for Trial Balance
  const handleRunTbAiAnalysis = useCallback(async () => {
    setRunningTbAiAnalysis(true);
    try {
      // Simulate AI analysis
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Generate realistic AI observations based on available data
      const observations: string[] = [];
      const recommendations: string[] = [];
      
      // Check if TB data exists
      if (glTbData?.lineItems?.length) {
        const lineItems = glTbData.lineItems;
        const tbTotalDebits = lineItems.reduce((sum: number, item: any) => sum + Number(item.debits || 0), 0);
        const tbTotalCredits = lineItems.reduce((sum: number, item: any) => sum + Number(item.credits || 0), 0);
        const isTbBalanced = Math.abs(tbTotalDebits - tbTotalCredits) < 1;
        
        // Calculate GL totals if GL data exists
        const glTotalDebits = glEntriesData?.reduce((sum: number, entry: any) => sum + Number(entry.debit || 0), 0) || 0;
        const glTotalCredits = glEntriesData?.reduce((sum: number, entry: any) => sum + Number(entry.credit || 0), 0) || 0;
        const isGlBalanced = glEntriesData?.length > 0 ? Math.abs(glTotalDebits - glTotalCredits) < 1 : true;
        
        // TB Balance check
        if (isTbBalanced) {
          observations.push(`Trial Balance is balanced: Total Dr. Rs. ${formatAccounting(tbTotalDebits)} = Total Cr. Rs. ${formatAccounting(tbTotalCredits)}`);
        } else {
          observations.push(`Trial Balance shows variance of Rs. ${formatAccounting(Math.abs(tbTotalDebits - tbTotalCredits))} (Dr: ${formatAccounting(tbTotalDebits)}, Cr: ${formatAccounting(tbTotalCredits)})`);
          recommendations.push("Investigate the TB variance between total debits and credits before proceeding");
        }
        
        // GL Balance check (if GL data exists)
        if (glEntriesData?.length > 0) {
          if (isGlBalanced) {
            observations.push(`General Ledger is balanced: Total Dr. Rs. ${formatAccounting(glTotalDebits)} = Total Cr. Rs. ${formatAccounting(glTotalCredits)}`);
          } else {
            observations.push(`General Ledger shows variance of Rs. ${formatAccounting(Math.abs(glTotalDebits - glTotalCredits))} (Dr: ${formatAccounting(glTotalDebits)}, Cr: ${formatAccounting(glTotalCredits)})`);
            recommendations.push("Investigate the GL variance between total debits and credits");
          }
          
          // TB vs GL comparison
          const tbGlDebitDiff = Math.abs(tbTotalDebits - glTotalDebits);
          const tbGlCreditDiff = Math.abs(tbTotalCredits - glTotalCredits);
          
          if (tbGlDebitDiff < 1 && tbGlCreditDiff < 1) {
            observations.push("TB and GL totals match - data integrity verified");
          } else {
            if (tbGlDebitDiff >= 1) {
              observations.push(`TB vs GL DEBIT MISMATCH: TB Dr. Rs. ${formatAccounting(tbTotalDebits)} vs GL Dr. Rs. ${formatAccounting(glTotalDebits)} (Difference: Rs. ${formatAccounting(tbGlDebitDiff)})`);
              recommendations.push("Reconcile TB and GL debit totals - investigate the difference of Rs. " + formatAccounting(tbGlDebitDiff));
            }
            if (tbGlCreditDiff >= 1) {
              observations.push(`TB vs GL CREDIT MISMATCH: TB Cr. Rs. ${formatAccounting(tbTotalCredits)} vs GL Cr. Rs. ${formatAccounting(glTotalCredits)} (Difference: Rs. ${formatAccounting(tbGlCreditDiff)})`);
              recommendations.push("Reconcile TB and GL credit totals - investigate the difference of Rs. " + formatAccounting(tbGlCreditDiff));
            }
          }
        } else {
          observations.push("No General Ledger data uploaded - TB/GL reconciliation not performed");
          recommendations.push("Upload General Ledger to enable TB/GL reconciliation analysis");
        }
        
        // Analyze revenue accounts
        const revenueAccounts = lineItems.filter((item: any) => 
          (item.glName || item.accountName)?.toLowerCase().includes('revenue') || 
          (item.glName || item.accountName)?.toLowerCase().includes('sales') ||
          (item.glCode || item.accountCode)?.startsWith('4')
        );
        if (revenueAccounts.length > 0) {
          const totalRevenue = revenueAccounts.reduce((sum: number, item: any) => sum + Number(item.credits || 0), 0);
          observations.push(`Total revenue accounts identified: ${revenueAccounts.length} with aggregate credits of Rs. ${formatAccounting(totalRevenue)}`);
        }
        
        // Analyze expense accounts
        const expenseAccounts = lineItems.filter((item: any) => 
          (item.glName || item.accountName)?.toLowerCase().includes('expense') || 
          (item.glCode || item.accountCode)?.startsWith('5') ||
          (item.glCode || item.accountCode)?.startsWith('6')
        );
        if (expenseAccounts.length > 0) {
          const totalExpenses = expenseAccounts.reduce((sum: number, item: any) => sum + Number(item.debits || 0), 0);
          observations.push(`Total expense accounts identified: ${expenseAccounts.length} with aggregate debits of Rs. ${formatAccounting(totalExpenses)}`);
        }
        
        // Check for tax-related accounts
        const taxAccounts = lineItems.filter((item: any) => 
          (item.glName || item.accountName)?.toLowerCase().includes('tax') || 
          (item.glName || item.accountName)?.toLowerCase().includes('wht') ||
          (item.glName || item.accountName)?.toLowerCase().includes('fbr')
        );
        if (taxAccounts.length > 0) {
          observations.push(`Tax-related accounts found: ${taxAccounts.length} accounts requiring ISA 540 consideration`);
          recommendations.push("Verify all withholding tax calculations and reconcile with FBR returns");
        }
        
        // Bank and cash analysis
        const bankAccounts = lineItems.filter((item: any) => 
          (item.glName || item.accountName)?.toLowerCase().includes('bank') || 
          (item.glName || item.accountName)?.toLowerCase().includes('cash')
        );
        if (bankAccounts.length > 0) {
          observations.push(`Cash and bank accounts: ${bankAccounts.length} accounts identified for ISA 505 confirmation`);
          recommendations.push("Request bank confirmations for all active bank accounts");
        }
        
        // Receivables analysis
        const receivableAccounts = lineItems.filter((item: any) => 
          (item.glName || item.accountName)?.toLowerCase().includes('receivable') || 
          (item.glName || item.accountName)?.toLowerCase().includes('debtor')
        );
        if (receivableAccounts.length > 0) {
          observations.push(`Trade receivables accounts: ${receivableAccounts.length} accounts for aging analysis`);
          recommendations.push("Perform aging analysis and assess ECL provision adequacy");
        }
        
        // Payables analysis
        const payableAccounts = lineItems.filter((item: any) => 
          (item.glName || item.accountName)?.toLowerCase().includes('payable') || 
          (item.glName || item.accountName)?.toLowerCase().includes('creditor')
        );
        if (payableAccounts.length > 0) {
          observations.push(`Trade payables accounts: ${payableAccounts.length} accounts for completeness testing`);
          recommendations.push("Verify payables cut-off and search for unrecorded liabilities");
        }
      } else {
        // No TB data - provide general engagement observations
        observations.push("No Trial Balance data uploaded yet - financial data analysis pending");
        observations.push(`Information requests pending: ${requests.filter(r => r.provided !== "YES").length} items awaiting client response`);
        observations.push(`Engagement readiness: ${requests.length > 0 ? "Information requisition initiated" : "Ready to begin information gathering"}`);
        
        if (requests.length > 0) {
          const pendingCount = requests.filter(r => r.provided !== "YES").length;
          const completedCount = requests.filter(r => r.provided === "YES").length;
          observations.push(`Request completion rate: ${completedCount}/${requests.length} (${Math.round((completedCount/requests.length)*100)}%)`);
        }
      }
      
      // Default recommendations (always applicable)
      recommendations.push("Upload Trial Balance and General Ledger for comprehensive financial analysis");
      recommendations.push("Ensure all critical information requests are submitted to client");
      recommendations.push("Map all accounts to standard Chart of Accounts structure");
      recommendations.push("Compare with prior year balances for significant variance analysis");
      recommendations.push("Identify accounts exceeding materiality threshold for substantive testing");
      
      setTbAiAnalysisResults({ observations, recommendations });
      
      toast({
        title: "Analysis Complete",
        description: "AI analytical observations have been generated.",
      });
    } catch (error) {
      console.error("AI analysis failed:", error);
      toast({
        title: "Analysis Failed",
        description: "Unable to complete AI analysis. Please try again.",
        variant: "destructive",
      });
    } finally {
      setRunningTbAiAnalysis(false);
    }
  }, [glTbData, glEntriesData, requests, toast]);

  const fetchClientInfo = useCallback(async () => {
    if (!effectiveEngagementId) return;
    try {
      const response = await fetchWithAuth(`/api/engagements/${effectiveEngagementId}`);
      if (response.ok) {
        const engagement = await response.json();
        if (engagement.clientId) {
          const clientResponse = await fetchWithAuth(`/api/clients/${engagement.clientId}`);
          if (clientResponse.ok) {
            const client = await clientResponse.json();
            setClientInfo({
              industry: client.industry,
              entityType: client.entityType,
              specialEntityType: client.specialEntityType,
            });
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch client info:", error);
    }
  }, [effectiveEngagementId, token]);

  useEffect(() => {
    fetchCoaAccounts();
    fetchClientInfo();
  }, [fetchCoaAccounts, fetchClientInfo]);

  useEffect(() => {
    if (coaAccounts.length > 0 && !coaBalancesLoaded) {
      fetchCoaBalances();
    }
  }, [coaAccounts.length, coaBalancesLoaded, fetchCoaBalances]);

  // Refetch drilldown when filters change
  // Note: Drilldown filter changes are now handled by the buildDrilldownFromGl effect
  // which uses local GL data instead of API calls

  const handleCreateCoaAccount = async () => {
    if (!effectiveEngagementId || !newCoaAccount.glCode || !newCoaAccount.glName) return;

    try {
      const apiPayload = { ...newCoaAccount, accountCode: newCoaAccount.glCode, accountName: newCoaAccount.glName };
      const response = await fetchWithAuth(`/api/engagements/${effectiveEngagementId}/coa`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(apiPayload),
      });

      if (response.ok) {
        const created = await response.json();
        setCoaAccounts(prev => [...prev, { ...created, glCode: created.glCode || created.accountCode, glName: created.glName || created.accountName }]);
        setNewCoaAccount({
          glCode: "",
          glName: "",
          accountClass: "",
          accountSubclass: "",
          nature: "DR",
          tbGroup: "",
          fsLineItem: "",
          notesDisclosureRef: "",
        });
        setIsAddingCoaAccount(false);
        toast({ title: "Created", description: "Account added to Chart of Accounts." });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to create account.", variant: "destructive" });
    }
  };

  const updateCoaAccount = async (id: string, updates: Partial<CoAAccount>) => {
    try {
      const response = await fetchWithAuth(`/api/coa/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const updated = await response.json();
        setCoaAccounts(prev => prev.map(acc => acc.id === id ? updated : acc));
        setEditingCoaId(null);
        setEditingCoaData({});
        toast({ title: "Updated", description: "Account updated successfully." });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to update account.", variant: "destructive" });
    }
  };

  const startEditingCoa = (account: CoAAccount) => {
    setEditingCoaId(account.id);
    setEditingCoaData({
      glCode: account.glCode,
      glName: account.glName,
      accountClass: account.accountClass,
      accountSubclass: account.accountSubclass,
      nature: account.nature,
      tbGroup: account.tbGroup,
      fsLineItem: account.fsLineItem,
      notesDisclosureRef: account.notesDisclosureRef,
    });
  };

  const cancelEditingCoa = () => {
    setEditingCoaId(null);
    setEditingCoaData({});
  };

  const saveEditingCoa = async () => {
    if (!editingCoaId) return;
    await updateCoaAccount(editingCoaId, editingCoaData);
  };

  const deleteCoaAccount = async (id: string) => {
    try {
      const response = await fetchWithAuth(`/api/coa/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setCoaAccounts(prev => prev.filter(acc => acc.id !== id));
        setSelectedCoaIds(prev => { const next = new Set(prev); next.delete(id); return next; });
        toast({ title: "Deleted", description: "Account removed from Chart of Accounts." });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete account.", variant: "destructive" });
    }
  };

  const deleteMultipleCoaAccounts = async () => {
    if (selectedCoaIds.size === 0) return;
    
    const confirmed = window.confirm(`Are you sure you want to delete ${selectedCoaIds.size} selected account(s)? This action cannot be undone.`);
    if (!confirmed) return;

    setIsDeletingMultiple(true);
    const idsToDelete = Array.from(selectedCoaIds);
    let successCount = 0;
    let failCount = 0;

    for (const id of idsToDelete) {
      try {
        const response = await fetchWithAuth(`/api/coa/${id}`, {
          method: "DELETE",
        });
        if (response.ok) {
          successCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }

    setCoaAccounts(prev => prev.filter(acc => !selectedCoaIds.has(acc.id)));
    setSelectedCoaIds(new Set());
    setIsDeletingMultiple(false);

    if (failCount === 0) {
      toast({ title: "Deleted", description: `${successCount} account(s) removed successfully.` });
    } else {
      toast({ title: "Partial Success", description: `${successCount} deleted, ${failCount} failed.`, variant: "destructive" });
    }
  };

  const toggleSelectAll = () => {
    if (selectedCoaIds.size === coaAccounts.length) {
      setSelectedCoaIds(new Set());
    } else {
      setSelectedCoaIds(new Set(coaAccounts.map(acc => acc.id)));
    }
  };

  const toggleSelectCoa = (id: string) => {
    setSelectedCoaIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const loadCoaTemplate = async (templateId: string, mode: 'add' | 'update') => {
    if (!effectiveEngagementId) return;
    
    const template = COA_INDUSTRY_TEMPLATES.find(t => t.id === templateId) || COA_INDUSTRY_TEMPLATES[0];
    const templateAccounts = template.accounts;
    
    const modeDescription = mode === 'update' 
      ? `This will update existing accounts and add new ones from the ${template.name} template.` 
      : `This will add only new accounts from the ${template.name} template that don't already exist.`;
    
    if (coaAccounts.length > 0) {
      const confirmed = window.confirm(`${modeDescription} Continue?`);
      if (!confirmed) return;
    }

    setIsLoadingCoaTemplate(true);
    let addedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    try {
      for (const account of templateAccounts) {
        const existingAccount = coaAccounts.find(a => a.glCode === (account.glCode || account.accountCode));
        
        if (existingAccount) {
          if (mode === 'update') {
            try {
              const response = await fetchWithAuth(`/api/engagements/${effectiveEngagementId}/coa/${existingAccount.id}`, {
                method: "PUT",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  accountName: account.glName || account.accountName,
                  accountClass: account.accountClass,
                  accountSubclass: account.accountSubclass,
                  nature: account.nature,
                  tbGroup: account.tbGroup,
                  fsLineItem: account.fsLineItem,
                  notesDisclosureRef: account.notesDisclosureRef,
                }),
              });

              if (response.ok) {
                const updated = await response.json();
                setCoaAccounts(prev => prev.map(a => a.id === existingAccount.id ? updated : a));
                updatedCount++;
              }
            } catch (error) {
              console.error('Error updating account:', error);
            }
          } else {
            // Skip existing accounts in 'add' mode
            skippedCount++;
          }
        } else {
          // Add new account
          try {
            const response = await fetchWithAuth(`/api/engagements/${effectiveEngagementId}/coa`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(account),
            });

            if (response.ok) {
              const created = await response.json();
              setCoaAccounts(prev => [...prev, created]);
              addedCount++;
            }
          } catch (error) {
            console.error('Error adding account:', error);
          }
        }
      }

      const messages = [];
      if (addedCount > 0) messages.push(`${addedCount} added`);
      if (updatedCount > 0) messages.push(`${updatedCount} updated`);
      if (skippedCount > 0) messages.push(`${skippedCount} skipped (already exist)`);
      
      toast({ 
        title: "Template Loaded", 
        description: messages.length > 0 ? messages.join(', ') : 'No changes made'
      });
    } catch (error) {
      toast({ title: "Error", description: "Failed to load default template.", variant: "destructive" });
    } finally {
      setIsLoadingCoaTemplate(false);
    }
  };

  const runAiSuggestMapping = async () => {
    if (!effectiveEngagementId || coaAccounts.length === 0) return;

    setIsRunningAiSuggest(true);
    setAiSuggestProgress(0);

    try {
      const response = await fetchWithAuth(`/api/engagements/${effectiveEngagementId}/coa/ai-suggest`, {
        method: "POST",
        timeout: 60000,
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const result = await response.json();
        console.log("AI Suggest result:", result);
        
        // Refetch accounts to get the updated data from backend
        const updatedResponse = await fetchWithAuth(`/api/engagements/${effectiveEngagementId}/coa`);
        
        if (updatedResponse.ok) {
          const updatedAccounts = await updatedResponse.json();
          setCoaAccounts(updatedAccounts);
          toast({ 
            title: "AI Mapping Complete", 
            description: `Successfully mapped ${result.suggestions?.length || 0} accounts with Class, Sub-class, TB Group, FS Line Item, and Notes Reference.` 
          });
        }
      } else {
        const errorData = await response.json();
        toast({ title: "Error", description: errorData.error || "AI suggestion failed. Please try again.", variant: "destructive" });
      }
    } catch (error) {
      console.error("AI Suggest error:", error);
      toast({ title: "Error", description: "Failed to run AI suggestion.", variant: "destructive" });
    } finally {
      setIsRunningAiSuggest(false);
      setAiSuggestProgress(100);
    }
  };

  const acceptAiSuggestion = async (id: string) => {
    const account = coaAccounts.find(acc => acc.id === id);
    if (!account || !account.aiSuggestedTBGroup) return;

    await updateCoaAccount(id, {
      tbGroup: account.aiSuggestedTBGroup,
      fsLineItem: account.aiSuggestedFSLine || account.fsLineItem,
      isOverridden: false,
    });
  };

  const overrideAiSuggestion = async (id: string, tbGroup: string, fsLineItem: string) => {
    await updateCoaAccount(id, {
      tbGroup,
      fsLineItem,
      isOverridden: true,
      overrideLockedAt: new Date().toISOString(),
    });
  };

  const toggleRationale = (id: string) => {
    setExpandedRationale(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const getConfidenceColor = (confidence: number | null) => {
    if (!confidence) return "text-muted-foreground";
    if (confidence >= 0.8) return "text-green-600";
    if (confidence >= 0.5) return "text-amber-500";
    return "text-red-500";
  };

  const coaStats = {
    total: coaAccounts.length,
    mapped: coaAccounts.filter(acc => acc.tbGroup).length,
    aiSuggested: coaAccounts.filter(acc => acc.aiSuggestedTBGroup).length,
    overridden: coaAccounts.filter(acc => acc.isOverridden).length,
  };

  const getMappingStatus = (account: CoAAccount): 'mapped' | 'unmapped' | 'pending' => {
    if (account.tbGroup && account.fsLineItem) return 'mapped';
    if (account.aiSuggestedTBGroup && !account.isOverridden) return 'pending';
    return 'unmapped';
  };

  const pushToChartOfAccounts = async () => {
    if (!effectiveEngagementId || !mappingData || mappingData.length === 0) {
      toast({ 
        title: "No Data", 
        description: "No mapping data available to push to Chart of Accounts.", 
        variant: "destructive" 
      });
      return;
    }

    // Push all mapping data (including MATCHED, PENDING, MISMATCH) - the Chart of Accounts will contain all accounts
    const mappingsToPush = mappingData.filter(m => m.glCode && m.glName);
    if (mappingsToPush.length === 0) {
      toast({ 
        title: "No Valid Mappings", 
        description: "No valid account mappings found to push to Chart of Accounts.", 
        variant: "destructive" 
      });
      return;
    }

    setIsPushingToCoa(true);
    setPushProgress({ current: 0, total: mappingsToPush.length, message: "Preparing..." });

    let successCount = 0;
    let updateCount = 0;
    let errorCount = 0;

    try {
      for (let i = 0; i < mappingsToPush.length; i++) {
        const mapping = mappingsToPush[i];
        setPushProgress({ 
          current: i + 1, 
          total: mappingsToPush.length, 
          message: `Processing ${mapping.glName || mapping.glCode}...` 
        });

        const existingAccount = coaAccounts.find(acc => acc.glCode === mapping.glCode);

        // Calculate balance values from mapping data
        const openingDr = Number(mapping.openingDebit) || 0;
        const openingCr = Number(mapping.openingCredit) || 0;
        const periodDr = Number(mapping.tbMovementDebit) || 0;
        const periodCr = Number(mapping.tbMovementCredit) || 0;
        const closingDr = Number(mapping.closingDebit) || 0;
        const closingCr = Number(mapping.closingCredit) || 0;
        
        // Opening Balance = Opening Debit - Opening Credit
        const openingBalance = openingDr - openingCr;
        // Closing Balance = Closing Debit - Closing Credit
        const closingBalance = closingDr - closingCr;

        const accountData = {
          accountCode: mapping.glCode,
          accountName: mapping.glName,
          accountClass: mapping.accountClass || '',
          accountSubclass: mapping.accountSubclass || '',
          nature: mapping.nature || 'DR',
          tbGroup: mapping.tbGroup || mapping.suggestedTbGroup || '',
          fsLineItem: mapping.fsLineItem || mapping.suggestedFsLineItem || '',
          notesDisclosureRef: mapping.notesRef || '',
          // Balance data from TB/GL mapping
          openingBalance,
          periodDr,
          periodCr,
          closingBalance,
          sourceType: 'TB_PUSH' as const,
        };

        try {
          if (existingAccount) {
            const response = await fetchWithAuth(`/api/coa/${existingAccount.id}`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(accountData),
            });
            if (response.ok) updateCount++;
            else errorCount++;
          } else {
            const response = await fetchWithAuth(`/api/engagements/${effectiveEngagementId}/coa`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(accountData),
            });
            if (response.ok) successCount++;
            else errorCount++;
          }
        } catch {
          errorCount++;
        }
      }

      await fetchCoaAccounts();
      
      // Mark as pushed and data as synced
      setHasPushedToCoa(true);
      setDataChangedSincePush(false);
      
      toast({ 
        title: "Push Complete", 
        description: `Added: ${successCount}, Updated: ${updateCount}${errorCount > 0 ? `, Errors: ${errorCount}` : ''}` 
      });
    } catch (error) {
      console.error("Push to CoA failed:", error);
      toast({ title: "Error", description: "Failed to push to Chart of Accounts.", variant: "destructive" });
    } finally {
      setIsPushingToCoa(false);
      setPushProgress({ current: 0, total: 0, message: "" });
    }
  };
  
  // Helper function to handle data changes - resets approval and marks data as changed
  const handleMappingDataChange = () => {
    if (hasPushedToCoa) {
      setDataChangedSincePush(true);
      setMappingApprovalStatus("DRAFT");
      toast({
        title: "Data Modified",
        description: "Approval status reset to Draft. Re-approve to push changes.",
        variant: "default"
      });
    }
  };

  const pushToFsHeads = async () => {
    if (!effectiveEngagementId) {
      toast({ title: "Error", description: "No engagement selected.", variant: "destructive" });
      return;
    }

    const mappedAccounts = coaAccounts.filter(acc => acc.tbGroup && acc.fsLineItem);
    if (mappedAccounts.length === 0) {
      toast({ 
        title: "No Mapped Accounts", 
        description: "Please ensure accounts have TB Group and FS Line Item mappings.", 
        variant: "destructive" 
      });
      return;
    }

    setIsPushingToFsHeads(true);
    setPushProgress({ current: 0, total: mappedAccounts.length, message: "Preparing FS Heads..." });

    try {
      const fsHeadGroups = new Map<string, { accounts: typeof mappedAccounts; totalDebit: number; totalCredit: number }>();

      for (const account of mappedAccounts) {
        const fsLine = account.fsLineItem || 'other';
        if (!fsHeadGroups.has(fsLine)) {
          fsHeadGroups.set(fsLine, { accounts: [], totalDebit: 0, totalCredit: 0 });
        }
        const group = fsHeadGroups.get(fsLine)!;
        group.accounts.push(account);
      }

      let processedCount = 0;
      for (const [fsLineItem, group] of fsHeadGroups) {
        setPushProgress({ 
          current: processedCount + 1, 
          total: fsHeadGroups.size, 
          message: `Creating FS Head: ${FS_LINE_ITEMS.find(f => f.value === fsLineItem)?.label || fsLineItem}...` 
        });

        try {
          await fetchWithAuth(`/api/engagements/${effectiveEngagementId}/fs-heads`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              fsLineItem,
              accountCodes: group.accounts.map(a => a.glCode),
              accountCount: group.accounts.length,
              status: 'ready',
            }),
          });
          processedCount++;
        } catch (error) {
          console.error(`Failed to create FS Head for ${fsLineItem}:`, error);
        }
      }

      toast({ 
        title: "FS Heads Created", 
        description: `Successfully prepared ${fsHeadGroups.size} FS Head categories with ${mappedAccounts.length} linked accounts for the Execution phase.` 
      });
    } catch (error) {
      console.error("Push to FS Heads failed:", error);
      toast({ title: "Error", description: "Failed to push to FS Heads.", variant: "destructive" });
    } finally {
      setIsPushingToFsHeads(false);
      setPushProgress({ current: 0, total: 0, message: "" });
    }
  };

  const acceptAllAiSuggestions = async () => {
    const accountsWithSuggestions = coaAccounts.filter(acc => acc.aiSuggestedTBGroup && !acc.isOverridden);
    if (accountsWithSuggestions.length === 0) {
      toast({ title: "No Suggestions", description: "No AI suggestions available to accept." });
      return;
    }

    const confirmed = window.confirm(`Accept all ${accountsWithSuggestions.length} AI suggestions? This will update TB Group and FS Line Item mappings.`);
    if (!confirmed) return;

    setIsAcceptingAllAi(true);
    let successCount = 0;
    let errorCount = 0;

    for (const account of accountsWithSuggestions) {
      try {
        const response = await fetchWithAuth(`/api/coa/${account.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tbGroup: account.aiSuggestedTBGroup,
            fsLineItem: account.aiSuggestedFSLine || account.fsLineItem,
            isOverridden: false,
          }),
        });
        if (response.ok) successCount++;
        else errorCount++;
      } catch {
        errorCount++;
      }
    }

    await fetchCoaAccounts();
    setIsAcceptingAllAi(false);

    toast({ 
      title: "AI Suggestions Applied", 
      description: `Successfully applied ${successCount} suggestion${successCount !== 1 ? 's' : ''}${errorCount > 0 ? `, ${errorCount} failed` : ''}.` 
    });
  };

  const exportCoaToCsv = () => {
    if (coaAccounts.length === 0) {
      toast({ title: "No Data", description: "No accounts to export." });
      return;
    }

    setIsExportingCsv(true);

    try {
      const headers = [
        'Account Code',
        'Account Name',
        'Account Class',
        'Account Subclass',
        'Nature',
        'TB Group',
        'FS Line Item',
        'Notes/Disclosure Ref',
        'Mapping Status',
        'AI Confidence',
        'Source'
      ];

      const rows = coaAccounts.map(acc => [
        acc.glCode,
        acc.glName,
        ACCOUNT_CLASSES.find(c => c.value === acc.accountClass)?.label || acc.accountClass,
        ACCOUNT_SUBCLASSES[acc.accountClass]?.find(s => s.value === acc.accountSubclass)?.label || acc.accountSubclass,
        acc.nature,
        TB_GROUPS.find(g => g.value === acc.tbGroup)?.label || acc.tbGroup,
        FS_LINE_ITEMS.find(f => f.value === acc.fsLineItem)?.label || acc.fsLineItem,
        acc.notesDisclosureRef || '',
        getMappingStatus(acc),
        acc.aiConfidence ? `${Math.round(acc.aiConfidence * 100)}%` : '',
        (acc as any).sourceType || 'Manual'
      ]);

      const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `chart_of_accounts_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({ title: "Export Complete", description: `Exported ${coaAccounts.length} accounts to CSV.` });
    } catch (error) {
      console.error("CSV export failed:", error);
      toast({ title: "Export Failed", description: "Failed to export to CSV.", variant: "destructive" });
    } finally {
      setIsExportingCsv(false);
    }
  };
  const stats = {
    total: requests.length,
    provided: requests.filter(r => r.provided === 'YES').length,
    pending: requests.filter(r => r.provided !== 'YES').length,
  };

  if (!effectiveEngagementId) {
    return (
      <div className="container mx-auto py-3">
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2" data-testid="text-no-engagement">No Engagement Selected</h3>
            <p className="text-muted-foreground">
              Please select an engagement from the workspace ribbon to view information requests.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <PageShell
      title="Data Intake"
      subtitle=""
      backHref={`/engagements`}
      nextHref={engagementId ? `/workspace/${engagementId}/pre-planning` : undefined}
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
      tabs={DATA_INTAKE_TABS}
      activeTab={dataIntakeSubTab}
      onTabChange={setDataIntakeSubTab}
    >
      <div className="w-full px-4 py-1 space-y-2">


      {engagementId && (
        <AIAssistBanner
          engagementId={engagementId}
          config={{
            ...PHASE_AI_CONFIGS.requisition,
            contextBuilder: () => JSON.stringify({
              phase: "requisition",
              engagementName: engagement?.engagementCode || "Unknown Engagement",
              clientName: client?.name || "Unknown Client",
              stats,
              totalRequests: requests.length,
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

      <div className="space-y-2 mt-1">
        <ReviewCoaSection
          engagementId={effectiveEngagementId}
          token={token}
          toast={toast}
          clientInfo={clientInfo}
          activeSubTab={dataIntakeSubTab}
          onSubTabChange={setDataIntakeSubTab}
        />
      </div>


      {/* Summary Popup Dialog */}
      <Dialog open={summaryPopup.open} onOpenChange={(open) => setSummaryPopup({ open, type: open ? summaryPopup.type : null })}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {summaryPopup.type === 'tb' && (
                <>
                  <FileSpreadsheet className="h-5 w-5" />
                  Trial Balance Summary
                </>
              )}
              {summaryPopup.type === 'gl' && (
                <>
                  <FileSpreadsheet className="h-5 w-5" />
                  General Ledger Summary
                </>
              )}
              {summaryPopup.type === 'parties' && (
                <>
                  <Users className="h-5 w-5" />
                  Master Parties Summary
                </>
              )}
              {summaryPopup.type === 'banks' && (
                <>
                  <Building2 className="h-5 w-5" />
                  Bank Accounts Summary
                </>
              )}
              {summaryPopup.type === 'openItems' && (
                <>
                  <FileText className="h-5 w-5" />
                  Open Items Summary
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {summaryPopup.type === 'tb' && "Trial Balance accounts detected from the uploaded workbook"}
              {summaryPopup.type === 'gl' && "General Ledger journal entries detected from the uploaded workbook"}
              {summaryPopup.type === 'parties' && "Customer and vendor master records detected from the uploaded workbook"}
              {summaryPopup.type === 'banks' && "Bank account records detected from the uploaded workbook"}
              {summaryPopup.type === 'openItems' && "AR/AP open items detected from the uploaded workbook"}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground">Total Records</div>
              <div className="text-2xl font-bold">
                {summaryPopup.type === 'tb' && (workbookValidation?.rowCounts.tb || 0).toLocaleString()}
                {summaryPopup.type === 'gl' && (workbookValidation?.rowCounts.gl || 0).toLocaleString()}
                {summaryPopup.type === 'parties' && (workbookValidation?.rowCounts.parties || 0).toLocaleString()}
                {summaryPopup.type === 'banks' && (workbookValidation?.rowCounts.bankAccounts || 0).toLocaleString()}
                {summaryPopup.type === 'openItems' && (workbookValidation?.rowCounts.openItems || 0).toLocaleString()}
              </div>
            </div>
            
            {workbookValidation?.sheets && workbookValidation.sheets.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Sheet Information</div>
                <div className="space-y-1">
                  {workbookValidation.sheets
                    .filter(sheet => {
                      const sheetName = (sheet.name ?? '').toLowerCase();
                      if (summaryPopup.type === 'tb') return sheetName.includes('tb') || sheetName.includes('trial');
                      if (summaryPopup.type === 'gl') return sheetName.includes('gl') || sheetName.includes('ledger') || sheetName.includes('journal');
                      if (summaryPopup.type === 'parties') return sheetName.includes('part') || sheetName.includes('customer') || sheetName.includes('vendor');
                      if (summaryPopup.type === 'banks') return sheetName.includes('bank');
                      if (summaryPopup.type === 'openItems') return sheetName.includes('open') || sheetName.includes('ar') || sheetName.includes('ap');
                      return true;
                    })
                    .map((sheet, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm p-2 bg-background rounded border">
                        <span className="font-mono">{sheet.name}</span>
                        <Badge variant={sheet.detected ? "default" : "secondary"}>
                          {sheet.rowCount} rows
                        </Badge>
                      </div>
                    ))}
                </div>
              </div>
            )}
            
            {workbookValidation?.issues && workbookValidation.issues.filter(i => {
              const sheetName = (i.sheet ?? '').toLowerCase();
              if (summaryPopup.type === 'tb') return sheetName.includes('tb') || sheetName.includes('trial');
              if (summaryPopup.type === 'gl') return sheetName.includes('gl') || sheetName.includes('ledger');
              if (summaryPopup.type === 'parties') return sheetName.includes('part');
              if (summaryPopup.type === 'banks') return sheetName.includes('bank');
              if (summaryPopup.type === 'openItems') return sheetName.includes('open');
              return false;
            }).length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Issues Found
                </div>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {workbookValidation.issues
                    .filter(i => {
                      const sheetName = (i.sheet ?? '').toLowerCase();
                      if (summaryPopup.type === 'tb') return sheetName.includes('tb') || sheetName.includes('trial');
                      if (summaryPopup.type === 'gl') return sheetName.includes('gl') || sheetName.includes('ledger');
                      if (summaryPopup.type === 'parties') return sheetName.includes('part');
                      if (summaryPopup.type === 'banks') return sheetName.includes('bank');
                      if (summaryPopup.type === 'openItems') return sheetName.includes('open');
                      return false;
                    })
                    .slice(0, 5)
                    .map((issue, idx) => (
                      <div key={idx} className={`text-xs p-2 rounded ${issue.severity === 'ERROR' ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'}`}>
                        Row {issue.row}: {issue.message}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setSummaryPopup({ open: false, type: null })} data-testid="button-close-summary">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* IRL View Dialog */}
      <Dialog open={irlViewDialog.open} onOpenChange={(open) => setIrlViewDialog({ open, item: open ? irlViewDialog.item : null })}>
        <DialogContent className="max-w-lg" data-testid="dialog-irl-view">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-green-600" />
              {irlViewDialog.item?.type || 'Information Request'}
            </DialogTitle>
            <DialogDescription>
              Auto-generated information request details and requirements
            </DialogDescription>
          </DialogHeader>
          
          {irlViewDialog.item && (() => {
            const details = getIrlItemDetails(irlViewDialog.item.id);
            if (!details) return null;
            
            return (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-sm font-medium mb-2">Description</div>
                  <p className="text-sm text-muted-foreground">{details.description}</p>
                </div>
                
                <div data-testid="container-irl-requirements">
                  <div className="text-sm font-medium mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Required Documents
                  </div>
                  <ul className="text-sm space-y-1.5">
                    {details.requirements.map((req, idx) => (
                      <li key={idx} className="flex items-start gap-2" data-testid={`text-irl-requirement-${idx}`}>
                        <Check className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800" data-testid="container-irl-data-source">
                  <Database className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <div className="text-xs">
                    <span className="font-medium">Data Source: </span>
                    <span className="text-muted-foreground">{details.generatesFrom}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 text-xs text-muted-foreground" data-testid="text-irl-isa-ref">
                  <BookOpen className="h-3 w-3" />
                  {details.isaRef}
                </div>
              </div>
            );
          })()}
          
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => setIrlViewDialog({ open: false, item: null })}
              data-testid="button-close-irl-view"
            >
              Close
            </Button>
            {irlViewDialog.item && irlItemStatuses[irlViewDialog.item.id] !== 'added' && (
              <Button 
                onClick={() => {
                  if (irlViewDialog.item) {
                    handleAddIrlItem(irlViewDialog.item);
                    setIrlViewDialog({ open: false, item: null });
                  }
                }}
                data-testid="button-add-from-view"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add to Requests
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* IRL Add Dialog */}
      <Dialog open={irlAddDialog.open} onOpenChange={(open) => setIrlAddDialog({ open, item: open ? irlAddDialog.item : null })}>
        <DialogContent className="max-w-md" data-testid="dialog-irl-add">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Add Information Request
            </DialogTitle>
            <DialogDescription>
              Generate and add this request to your information request list
            </DialogDescription>
          </DialogHeader>
          
          {irlAddDialog.item && (
            <div className="space-y-4">
              <div className="p-4 border rounded-lg">
                <div className="font-medium mb-1">{irlAddDialog.item.type}</div>
                <p className="text-sm text-muted-foreground">{irlAddDialog.item.desc}</p>
              </div>
              
              <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <p className="text-xs text-muted-foreground">
                  This will generate a new information request and add it to your IRL. You can edit it afterwards.
                </p>
              </div>
            </div>
          )}
          
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => setIrlAddDialog({ open: false, item: null })}
              disabled={irlGenerating !== null}
              data-testid="button-cancel-irl-add"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (irlAddDialog.item) {
                  handleGenerateIrlItem(irlAddDialog.item);
                }
              }}
              disabled={irlGenerating !== null}
              data-testid="button-confirm-irl-add"
            >
              {irlGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Generate & Add
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Trial Balance View Dialog */}
      <Dialog open={showTbViewDialog} onOpenChange={setShowTbViewDialog}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Trial Balance - {trialBalance.fileName || "Data View"}
            </DialogTitle>
            <DialogDescription>
              {glTbData?.lineItems?.length || 0} accounts loaded • Reporting Period: {trialBalance.reportingPeriodEnd || "Not set"} • Currency: {trialBalance.currency}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto border rounded-lg">
            {glTbData?.lineItems?.length > 0 ? (
              <Table>
                <TableHeader className="sticky top-0 bg-muted z-10">
                  <TableRow>
                    <TableHead className="w-[100px]">Account Code</TableHead>
                    <TableHead className="min-w-[180px]">Account Name</TableHead>
                    <TableHead className="text-right">Opening Dr</TableHead>
                    <TableHead className="text-right">Opening Cr</TableHead>
                    <TableHead className="text-right">Movement Dr</TableHead>
                    <TableHead className="text-right">Movement Cr</TableHead>
                    <TableHead className="text-right">Closing Dr</TableHead>
                    <TableHead className="text-right">Closing Cr</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {glTbData.lineItems.map((item: any, idx: number) => (
                    <TableRow key={idx} data-testid={`row-tb-view-${item.glCode || item.accountCode}`}>
                      <TableCell className="font-mono text-xs">{item.glCode || item.accountCode}</TableCell>
                      <TableCell className="text-sm">{item.glName || item.accountName}</TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {(item.openingDebit || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {(item.openingCredit || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {(item.debits || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {(item.credits || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {(item.closingDebit || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {(item.closingCredit || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                <FileSpreadsheet className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>No Trial Balance data available</p>
              </div>
            )}
          </div>
          <DialogFooter className="mt-4">
            <div className="flex items-center justify-between w-full gap-4 flex-wrap">
              <div className="text-sm text-muted-foreground">
                {glTbData?.lineItems?.length > 0 && (
                  <>
                    Total Debits: <span className="font-mono font-medium">{glTbData.lineItems.reduce((sum: number, item: any) => sum + (item.closingDebit || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 0 })}</span>
                    {" | "}
                    Total Credits: <span className="font-mono font-medium">{glTbData.lineItems.reduce((sum: number, item: any) => sum + (item.closingCredit || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 0 })}</span>
                  </>
                )}
              </div>
              <Button variant="outline" onClick={() => setShowTbViewDialog(false)} data-testid="button-close-tb-view">
                Close
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Period Dr/Cr Drilldown Dialog */}
      <Dialog open={drilldownDialogOpen} onOpenChange={(open) => !open && closeDrilldownDialog()}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              GL Transaction Details
              {expandedDrilldown && (
                <Badge variant="outline" className={expandedDrilldown.side === 'DR' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'}>
                  Period {expandedDrilldown.side}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {(() => {
                const account = coaAccounts.find(a => a.glCode === expandedDrilldown?.glCode);
                return account ? `${account.glCode} - ${account.glName}` : 'Account Details';
              })()}
            </DialogDescription>
          </DialogHeader>

          {/* Summary Cards */}
          {drilldownData && (
            <div className="flex items-center gap-4 py-2 flex-wrap">
              <div className="bg-muted rounded-lg px-3 py-2 border">
                <div className="text-xs text-muted-foreground">Total Lines</div>
                <div className="font-semibold">{drilldownData.totals.count.toLocaleString()}</div>
              </div>
              <div className="bg-muted rounded-lg px-3 py-2 border">
                <div className="text-xs text-muted-foreground">Total Amount</div>
                <div className="font-semibold font-mono">
                  Rs. {drilldownData.totals.totalAmountRequested.toLocaleString(undefined, { minimumFractionDigits: 0 })}
                </div>
              </div>
              {drilldownData.dateRange?.from && (
                <div className="bg-muted rounded-lg px-3 py-2 border">
                  <div className="text-xs text-muted-foreground">Date Range</div>
                  <div className="font-semibold text-sm">
                    {new Date(drilldownData.dateRange.from).toLocaleDateString()} – {new Date(drilldownData.dateRange.to).toLocaleDateString()}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Filters */}
          <div className="flex items-center gap-2 py-2 flex-wrap border-b">
            <Input
              placeholder="Search voucher/narrative..."
              value={drilldownFilters.search}
              onChange={(e) => setDrilldownFilters(prev => ({ ...prev, search: e.target.value, page: 1 }))}
              className="h-8 w-48 text-xs"
              data-testid="input-drilldown-dialog-search"
            />
            <Input
              type="date"
              value={drilldownFilters.from}
              onChange={(e) => setDrilldownFilters(prev => ({ ...prev, from: e.target.value, page: 1 }))}
              className="h-8 w-36 text-xs"
              data-testid="input-drilldown-dialog-from"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input
              type="date"
              value={drilldownFilters.to}
              onChange={(e) => setDrilldownFilters(prev => ({ ...prev, to: e.target.value, page: 1 }))}
              className="h-8 w-36 text-xs"
              data-testid="input-drilldown-dialog-to"
            />
            <Select 
              value={drilldownFilters.docType} 
              onValueChange={(v) => setDrilldownFilters(prev => ({ ...prev, docType: v, page: 1 }))}
            >
              <SelectTrigger className="h-8 w-28 text-xs">
                <SelectValue placeholder="Doc Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Types</SelectItem>
                {drilldownData?.documentTypes?.map(dt => (
                  <SelectItem key={dt.type} value={dt.type}>{dt.type} ({dt.count})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDrilldownFilters({ from: '', to: '', search: '', docType: 'ALL', page: 1, pageSize: 20 })}
              className="h-8 text-xs"
              data-testid="btn-drilldown-dialog-clear"
            >
              Clear
            </Button>
          </div>

          {/* Transaction Table */}
          <div className="flex-1 overflow-auto border rounded-lg">
            {drilldownLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading transactions...</span>
              </div>
            ) : drilldownData?.rows?.length ? (
              <Table>
                <TableHeader className="sticky top-0 bg-muted z-10">
                  <TableRow className="text-xs">
                    <TableHead className="w-[100px]">Voucher #</TableHead>
                    <TableHead className="w-[90px]">Date</TableHead>
                    <TableHead className="text-right w-[100px]">Debit</TableHead>
                    <TableHead className="text-right w-[100px]">Credit</TableHead>
                    <TableHead className="w-[60px]">Curr</TableHead>
                    <TableHead className="w-[70px]">Doc Type</TableHead>
                    <TableHead className="w-[90px]">Ref #</TableHead>
                    <TableHead className="min-w-[200px]">Narrative</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drilldownData.rows.map((row, idx) => (
                    <TableRow key={idx} className="text-xs" data-testid={`row-drilldown-${idx}`}>
                      <TableCell className="font-mono text-xs font-medium">{row.voucherNo}</TableCell>
                      <TableCell className="text-xs">{new Date(row.date).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {row.debit > 0 ? row.debit.toLocaleString(undefined, { minimumFractionDigits: 0 }) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {row.credit > 0 ? row.credit.toLocaleString(undefined, { minimumFractionDigits: 0 }) : '-'}
                      </TableCell>
                      <TableCell className="text-xs">PKR</TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="text-[10px] px-1 py-0">{row.docType}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{row.ref || '-'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[250px]" title={row.narrative}>
                        {row.narrative || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <tfoot className="bg-muted/50 border-t">
                  <tr>
                    <td colSpan={2} className="px-4 py-2 font-medium text-sm">Totals</td>
                    <td className="px-4 py-2 text-right font-mono text-sm font-bold">
                      {drilldownData.totals.totalDr.toLocaleString(undefined, { minimumFractionDigits: 0 })}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-sm font-bold">
                      {drilldownData.totals.totalCr.toLocaleString(undefined, { minimumFractionDigits: 0 })}
                    </td>
                    <td colSpan={4}></td>
                  </tr>
                </tfoot>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No transactions found</p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {drilldownData && drilldownData.meta.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-muted-foreground">
                Showing {((drilldownData.meta.page - 1) * drilldownData.meta.pageSize) + 1} - {Math.min(drilldownData.meta.page * drilldownData.meta.pageSize, drilldownData.meta.totalCount)} of {drilldownData.meta.totalCount} transactions
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDrilldownFilters(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={drilldownData.meta.page <= 1}
                  className="h-7 px-2"
                >
                  Previous
                </Button>
                <span className="text-xs px-2">
                  Page {drilldownData.meta.page} of {drilldownData.meta.totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDrilldownFilters(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={drilldownData.meta.page >= drilldownData.meta.totalPages}
                  className="h-7 px-2"
                >
                  Next
                </Button>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button 
              variant="outline" 
              onClick={exportDrilldownCsv}
              disabled={!drilldownData?.rows?.length}
              data-testid="btn-drilldown-dialog-export"
              title={!drilldownData?.rows?.length ? "No transactions to export" : "Export transactions to CSV"}
            >
              <Download className="h-4 w-4 mr-1" />
              Export CSV
            </Button>
            <Button onClick={closeDrilldownDialog} data-testid="btn-drilldown-dialog-close">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </PageShell>
  );
}
