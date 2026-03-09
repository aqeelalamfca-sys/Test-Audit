import React, { useState, useEffect, useCallback, useMemo } from "react";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useLocation, useSearch } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Loader2, Plus, Download, Trash2, AlertTriangle, AlertCircle, ChevronDown, ChevronRight, Database, FileSpreadsheet, Target, Calculator, Users, Building2, Check, X, Info, FileDown, Scale, FileText, Camera, CheckCircle2, XCircle, Shield, ClipboardCheck, ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { EditableDataGrid, TB_COLUMNS, GL_COLUMNS, PARTY_COLUMNS, BANK_COLUMNS } from "@/components/editable-data-grid";
import {
  ACCOUNT_CLASSES,
  ACCOUNT_SUBCLASSES,
  TB_GROUPS,
  FS_LINE_ITEMS,
  COA_INDUSTRY_TEMPLATES,
} from "./data";
import { SummaryTab } from "./SummaryTab";
import { FsMappingSection } from "./FsMappingSection";
import { SubTabShell } from "./SubTabShell";
import { DataTabSection } from "./DataTabSection";
import { useLinkIntegrity } from "./use-link-integrity";
import { FSDraftGenerator } from "@/components/fs-draft-generator";
import type { DataSource, TabGate, LinkBreak, WorkflowTabKey } from "./workflow-spec";

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

// Accounting format helper - formats numbers with thousand separators
const formatAccounting = (value: number | undefined | null): string => {
  if (value === undefined || value === null || isNaN(value)) return '-';
  if (value === 0) return '-';
  
  // Use absolute value for formatting, add parentheses for negatives
  const absValue = Math.abs(value);
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(absValue);
  
  return value < 0 ? `(${formatted})` : formatted;
};

// Currency format helper - formats with PKR currency symbol
const formatPKR = (value: number | undefined | null): string => {
  if (value === undefined || value === null || isNaN(value)) return '-';
  if (value === 0) return '-';
  
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

interface TBImportAccount {
  id: string;
  glCode: string;
  glName: string;
  accountClass: string | null;
  accountSubclass: string | null;
  fsHeadKey: string | null;
  openingDebit: number;
  openingCredit: number;
  debit: number;
  credit: number;
  closingDebit: number;
  closingCredit: number;
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

interface ReconMismatch {
  glCode: string;
  glName: string;
  tbMovement: number;
  glMovement: number;
  difference: number;
  percentVariance: number;
}

interface ConfirmationItem {
  id: string;
  type: 'AR' | 'AP' | 'BANK' | 'LEGAL' | 'TAX';
  partyCode?: string;
  partyName: string;
  contactEmail?: string;
  contactPerson?: string;
  partyAddress?: string;
  partyCity?: string;
  balance: number;
  currency?: string;
  status: 'PENDING' | 'SENT' | 'CONFIRMED' | 'DISCREPANCY';
  sourceId: string;
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

interface ReviewCoaSectionProps {
  engagementId: string | undefined;
  token: string | null;
  toast: (props: { title: string; description?: string; variant?: "default" | "destructive" }) => void;
  clientInfo: { industry?: string; entityType?: string; specialEntityType?: string } | null;
  activeSubTab?: string;
  onSubTabChange?: (subTab: string) => void;
  linkBreaks?: LinkBreak[];
  onFixLinks?: () => void;
  isFixingLinks?: boolean;
}

export function ReviewCoaSection({
  engagementId,
  token,
  toast,
  clientInfo,
  activeSubTab,
  onSubTabChange,
  linkBreaks = [],
  onFixLinks,
  isFixingLinks = false,
}: ReviewCoaSectionProps) {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const queryClient = useQueryClient();
  
  const getInitialSubTab = () => {
    const params = new URLSearchParams(search);
    const subtab = params.get('subtab');
    if (subtab && ['upload', 'tb', 'gl', 'ap', 'ar', 'bank', 'confirmations', 'draft-fs', 'mapping', 'checks'].includes(subtab)) {
      return subtab as 'upload' | 'tb' | 'gl' | 'ap' | 'ar' | 'bank' | 'confirmations' | 'draft-fs' | 'mapping' | 'checks';
    }
    return 'upload';
  };

  const [reviewCoaSubTab, setReviewCoaSubTab] = useState<'upload' | 'tb' | 'gl' | 'ap' | 'ar' | 'bank' | 'confirmations' | 'draft-fs' | 'mapping' | 'checks'>(getInitialSubTab);

  useEffect(() => {
    if (activeSubTab !== undefined && activeSubTab !== reviewCoaSubTab) {
      setReviewCoaSubTab(activeSubTab as typeof reviewCoaSubTab);
    }
  }, [activeSubTab]);

  const [tbImportAccounts, setTbImportAccounts] = useState<TBImportAccount[]>([]);
  const [isLoadingTbImport, setIsLoadingTbImport] = useState(false);
  const [glTransactionCounts, setGlTransactionCounts] = useState<Map<string, number>>(new Map());
  const [reconSummary, setReconSummary] = useState<ReconSummary | null>(null);
  const [loadingReconSummary, setLoadingReconSummary] = useState(false);
  const [reconTolerance, setReconTolerance] = useState(0);

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
  const [isAcceptingAllAi, setIsAcceptingAllAi] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isPushingToFsHeads, setIsPushingToFsHeads] = useState(false);
  const [isPushingForward, setIsPushingForward] = useState(false);
  const [pushProgress, setPushProgress] = useState({ current: 0, total: 0, message: "" });
  const [coaBalancesLoaded, setCoaBalancesLoaded] = useState(false);

  const [fsMappingInitialFilter, setFsMappingInitialFilter] = useState<"all" | "unmapped" | undefined>(undefined);

  const [snapshotId, setSnapshotId] = useState<string | null>(null);
  const [snapshotGeneratedAt, setSnapshotGeneratedAt] = useState<string | null>(null);
  const [isGeneratingSnapshot, setIsGeneratingSnapshot] = useState(false);

  const [expandedDrilldown, setExpandedDrilldown] = useState<{ glCode: string; side: 'DR' | 'CR' } | null>(null);
  const [drilldownData, setDrilldownData] = useState<PeriodDrilldownData | null>(null);
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [drilldownFilters, setDrilldownFilters] = useState({
    from: '',
    to: '',
    search: '',
    voucherType: 'ALL',
    page: 1,
    pageSize: 20,
  });

  // Confirmation management state
  const [confirmationItems, setConfirmationItems] = useState<ConfirmationItem[]>([]);
  const [expandedConfType, setExpandedConfType] = useState<string | null>(null);
  const [arSelectedIds, setArSelectedIds] = useState<string[]>([]);
  const [apSelectedIds, setApSelectedIds] = useState<string[]>([]);
  const [bankSelectedIds, setBankSelectedIds] = useState<string[]>([]);
  const [isAddConfirmationOpen, setIsAddConfirmationOpen] = useState(false);
  const [newConfirmation, setNewConfirmation] = useState<Partial<ConfirmationItem>>({
    type: 'AR',
    partyName: '',
    contactEmail: '',
    balance: 0,
    status: 'PENDING',
  });

  const { data: reconIssueSummary } = useQuery<{ total: number; byTab: Record<string, { high: number; medium: number; low: number; total: number }>; bySeverity: { high: number; medium: number; low: number }; blocking: number; open: number }>({
    queryKey: ['/api/engagements', engagementId, 'recon', 'summary'],
    enabled: !!engagementId,
  });

  const { data: gateStatus } = useQuery<{ tbBalanced: string; glBalanced: string; tbGlTieOut: string; apReconciled: string; arReconciled: string; bankReconciled: string; allCodesMapped: string; mappingLocked: string; bsFooting: string; canApproveLock: boolean; canPushForward: boolean; lastScanAt: string | null }>({
    queryKey: ['/api/engagements', engagementId, 'recon', 'gates'],
    enabled: !!engagementId,
  });

  const { data: tbSummary } = useQuery<{
    accountCount: number;
    totalOpeningDebit: number;
    totalOpeningCredit: number;
    totalMovementDebit: number;
    totalMovementCredit: number;
    totalClosingDebit: number;
    totalClosingCredit: number;
  }>({
    queryKey: ['/api/import', engagementId, 'data/tb/summary'],
    enabled: !!engagementId && reviewCoaSubTab === 'tb',
  });

  const { data: glSummary } = useQuery<{
    entryCount: number;
    totalDebit: number;
    totalCredit: number;
  }>({
    queryKey: ['/api/import', engagementId, 'data/gl/summary'],
    enabled: !!engagementId && reviewCoaSubTab === 'gl',
  });

  const { data: apSummary } = useQuery<{
    partyCount: number;
    totalApBalance: number;
    apBalancePerTb: number;
    apBalancePerGl: number;
    uniqueControlCodes: string[];
  }>({
    queryKey: ['/api/import', engagementId, 'data/party/summary?partyType=VENDOR'],
    enabled: !!engagementId && (reviewCoaSubTab === 'ap' || reviewCoaSubTab === 'confirmations' || reviewCoaSubTab === 'checks'),
  });

  const { data: arSummary } = useQuery<{
    partyCount: number;
    totalApBalance: number;
    apBalancePerTb: number;
    apBalancePerGl: number;
    uniqueControlCodes: string[];
  }>({
    queryKey: ['/api/import', engagementId, 'data/party/summary?partyType=CUSTOMER'],
    enabled: !!engagementId && (reviewCoaSubTab === 'ar' || reviewCoaSubTab === 'confirmations' || reviewCoaSubTab === 'checks'),
  });

  const { data: bankSummary } = useQuery<{
    accountCount: number;
    totalBookBalance: number;
    bankBalancePerTb: number;
    bankBalancePerGl: number;
    uniqueControlCodes: string[];
    currencyBreakdown: { currency: string; total: number }[];
  }>({
    queryKey: ['/api/import', engagementId, 'data/bank/summary'],
    enabled: !!engagementId && (reviewCoaSubTab === 'bank' || reviewCoaSubTab === 'confirmations' || reviewCoaSubTab === 'checks'),
  });

  const reconTabKeyMap: Record<string, string> = {
    'upload': 'SUMMARY',
    'tb': 'TB',
    'gl': 'GL',
    'ap': 'AP',
    'ar': 'AR',
    'bank': 'BANK',
    'confirmations': 'CONFIRMATIONS',
    'mapping': 'MAPPING',
    'draft-fs': 'DRAFT_FS',
    'checks': 'CHECKS',
  };

  // Add items to confirmation list
  const handleAddToConfirmations = useCallback((rows: Record<string, any>[], type: 'AR' | 'AP' | 'BANK') => {
    const newItems: ConfirmationItem[] = rows.map(row => ({
      id: `conf-${type}-${row.id}`,
      type,
      partyCode: row.partyCode || row.bankAccountId || row.bankAccountCode || row.glCode,
      partyName: row.partyName || row.bankName || row.glName || 'Unknown',
      contactEmail: row.email || row.contactEmail || '',
      balance: type === 'BANK' 
        ? (row.closingBalance || row.balance || 0) 
        : (row.closingBalance || row.balance || row.amount || 0),
      currency: row.currency || 'PKR',
      status: 'PENDING',
      sourceId: row.id,
    }));

    setConfirmationItems(prev => {
      const existingIds = new Set(prev.map(item => item.sourceId));
      const uniqueNewItems = newItems.filter(item => !existingIds.has(item.sourceId));
      return [...prev, ...uniqueNewItems];
    });

    // Clear selections
    if (type === 'AR') setArSelectedIds([]);
    if (type === 'AP') setApSelectedIds([]);
    if (type === 'BANK') setBankSelectedIds([]);

    // Switch to confirmations tab
    setReviewCoaSubTab('confirmations');
  }, []);

  // Remove item from confirmation list
  const handleRemoveConfirmation = useCallback((id: string) => {
    setConfirmationItems(prev => prev.filter(item => item.id !== id));
  }, []);

  // Add manual confirmation line
  const handleAddManualConfirmation = useCallback(() => {
    if (!newConfirmation.partyName) return;
    
    const item: ConfirmationItem = {
      id: `conf-manual-${Date.now()}`,
      type: newConfirmation.type || 'AR',
      partyName: newConfirmation.partyName || '',
      contactEmail: newConfirmation.contactEmail || '',
      contactPerson: newConfirmation.contactPerson || '',
      partyAddress: newConfirmation.partyAddress || '',
      partyCity: newConfirmation.partyCity || '',
      balance: newConfirmation.balance || 0,
      currency: 'PKR',
      status: 'PENDING',
      sourceId: `manual-${Date.now()}`,
    };
    
    setConfirmationItems(prev => [...prev, item]);
    setNewConfirmation({
      type: 'AR',
      partyName: '',
      contactEmail: '',
      contactPerson: '',
      partyAddress: '',
      partyCity: '',
      balance: 0,
      status: 'PENDING',
    });
    setIsAddConfirmationOpen(false);
  }, [newConfirmation]);

  // Download single confirmation letter
  const handleDownloadLetter = useCallback(async (item: ConfirmationItem) => {
    if (!engagementId) return;
    
    try {
      const response = await fetchWithAuth(`/api/import/${engagementId}/confirmation-letter`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: item.type,
          partyCode: item.partyCode,
          partyName: item.partyName,
          contactEmail: item.contactEmail,
          contactPerson: item.contactPerson,
          partyAddress: item.partyAddress,
          partyCity: item.partyCity,
          balance: item.balance,
          currency: item.currency || 'PKR',
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate letter');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${item.type}_Confirmation_${item.partyName.replace(/[^a-zA-Z0-9]/g, '_')}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading letter:', error);
    }
  }, [engagementId]);

  // Download all confirmation letters
  const handleDownloadAllLetters = useCallback(async () => {
    if (!engagementId || confirmationItems.length === 0) return;
    
    try {
      const response = await fetchWithAuth(`/api/import/${engagementId}/confirmation-letters-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          confirmations: confirmationItems.map(item => ({
            type: item.type,
            partyCode: item.partyCode,
            partyName: item.partyName,
            contactEmail: item.contactEmail,
            contactPerson: item.contactPerson,
            partyAddress: item.partyAddress,
            partyCity: item.partyCity,
            balance: item.balance,
            currency: item.currency || 'PKR',
          })),
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate letters');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `All_Confirmation_Letters_${new Date().toISOString().split('T')[0]}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading letters:', error);
    }
  }, [engagementId, confirmationItems]);

  const effectiveEngagementId = engagementId;

  const handleSubTabChange = useCallback((subTab: typeof reviewCoaSubTab) => {
    setReviewCoaSubTab(subTab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('subtab', subTab);
      window.history.replaceState({}, '', url.toString());
    }
    onSubTabChange?.(subTab);
  }, [onSubTabChange]);

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

  useEffect(() => {
    if ((reviewCoaSubTab === 'upload' || reviewCoaSubTab === 'checks' || reviewCoaSubTab === 'draft-fs' || reviewCoaSubTab === 'mapping') && effectiveEngagementId) {
      fetchReconSummary();
    }
  }, [reviewCoaSubTab, effectiveEngagementId, fetchReconSummary]);

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

  const fetchCoaAccounts = useCallback(async () => {
    if (!effectiveEngagementId) return;
    setIsLoadingCoa(true);
    try {
      const response = await fetchWithAuth(`/api/engagements/${effectiveEngagementId}/coa`);
      if (response.ok) {
        const data = await response.json();
        setCoaAccounts(data.map((d: any) => ({ ...d, glCode: d.glCode || d.accountCode, glName: d.glName || d.accountName })));
      }
    } catch (error) {
      console.error('Error fetching CoA accounts:', error);
    } finally {
      setIsLoadingCoa(false);
    }
  }, [effectiveEngagementId, token]);

  useEffect(() => {
    if (effectiveEngagementId) {
      fetchCoaAccounts();
    }
  }, [effectiveEngagementId, fetchCoaAccounts]);

  const fetchCoaBalances = useCallback(async () => {
    if (!effectiveEngagementId || coaAccounts.length === 0) return;
    try {
      const response = await fetchWithAuth(`/api/engagements/${effectiveEngagementId}/coa/balances`);
      if (response.ok) {
        const balances = await response.json();
        setCoaAccounts(prev => prev.map(acc => {
          const balance = balances.find((b: any) => (b.accountCode || b.glCode) === acc.glCode);
          return balance ? { ...acc, ...balance } : acc;
        }));
        setCoaBalancesLoaded(true);
      }
    } catch (error) {
      console.error('Error fetching CoA balances:', error);
    }
  }, [effectiveEngagementId, token, coaAccounts.length]);


  const fetchTbImportAccounts = useCallback(async () => {
    if (!effectiveEngagementId) return;
    setIsLoadingTbImport(true);
    try {
      const [tbResponse, glCountsResponse] = await Promise.all([
        fetchWithAuth(`/api/import/${effectiveEngagementId}/data/tb?pageSize=10000`),
        fetchWithAuth(`/api/import/${effectiveEngagementId}/data/gl/counts`),
      ]);
      
      if (tbResponse.ok) {
        const result = await tbResponse.json();
        const transformedData = (result.data || []).map((item: any) => ({
          ...item,
          glCode: item.glCode || item.accountCode,
          glName: item.glName || item.accountName,
          openingDebit: Number(item.openingDebit) || 0,
          openingCredit: Number(item.openingCredit) || 0,
          debit: Number(item.debit || item.movementDebit) || 0,
          credit: Number(item.credit || item.movementCredit) || 0,
          closingDebit: Number(item.closingDebit) || 0,
          closingCredit: Number(item.closingCredit) || 0,
        }));
        setTbImportAccounts(transformedData);
      }
      
      if (glCountsResponse.ok) {
        const countsResult = await glCountsResponse.json();
        const countsMap = new Map<string, number>();
        for (const item of countsResult.data || []) {
          countsMap.set(item.accountCode || item.glCode, item.transactionCount);
        }
        setGlTransactionCounts(countsMap);
      }
    } catch (error) {
      console.error('Error fetching TB import accounts:', error);
    } finally {
      setIsLoadingTbImport(false);
    }
  }, [effectiveEngagementId, token]);

  useEffect(() => {
    if (reviewCoaSubTab === 'draft-fs' && tbImportAccounts.length === 0) {
      fetchTbImportAccounts();
    }
  }, [reviewCoaSubTab, tbImportAccounts.length, fetchTbImportAccounts]);

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
      const apiUpdates: any = { ...updates };
      if (updates.glCode !== undefined) { apiUpdates.accountCode = updates.glCode; }
      if (updates.glName !== undefined) { apiUpdates.accountName = updates.glName; }
      const response = await fetchWithAuth(`/api/coa/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(apiUpdates),
      });

      if (response.ok) {
        const updated = await response.json();
        const mapped = { ...updated, glCode: updated.glCode || updated.accountCode, glName: updated.glName || updated.accountName };
        setCoaAccounts(prev => prev.map(acc => acc.id === id ? mapped : acc));
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
                  accountName: account.accountName,
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
            skippedCount++;
          }
        } else {
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
        
        const updatedResponse = await fetchWithAuth(`/api/engagements/${effectiveEngagementId}/coa`);
        
        if (updatedResponse.ok) {
          const updatedAccounts = await updatedResponse.json();
          setCoaAccounts(updatedAccounts);
          toast({ 
            title: "AI Mapping Complete", 
            description: `Successfully mapped ${result.suggestions?.length || 0} accounts with Category, FS Line Item, Class, and Notes Reference.` 
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

      const getMappingStatus = (account: CoAAccount): 'mapped' | 'unmapped' | 'pending' => {
        if (account.tbGroup && account.fsLineItem) return 'mapped';
        if (account.aiSuggestedTBGroup && !account.isOverridden) return 'pending';
        return 'unmapped';
      };

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
        acc.isOverridden ? 'Manual Override' : acc.aiSuggestedTBGroup ? 'AI Suggested' : 'Manual'
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chart_of_accounts_${effectiveEngagementId || 'export'}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ title: "Export Complete", description: `Exported ${coaAccounts.length} accounts to CSV.` });
    } catch (error) {
      toast({ title: "Export Failed", description: "Failed to export Chart of Accounts.", variant: "destructive" });
    } finally {
      setIsExportingCsv(false);
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

  const isReconciliationBlocked = useMemo(() => {
    if (!reconSummary) return false;
    if (!reconSummary.hasTbData || !reconSummary.hasGlData) return false;
    return !reconSummary.tbGlRecon.isReconciled;
  }, [reconSummary]);

  const reconciliationGateStatus = useMemo(() => ({
    isBlocked: isReconciliationBlocked,
    reason: isReconciliationBlocked 
      ? 'TB and GL data are not reconciled. Resolve all mismatches before proceeding.'
      : null,
    mismatchCount: reconSummary?.tbGlRecon.mismatchCount || 0,
    totalMismatchAmount: reconSummary?.tbGlRecon.totalMismatchAmount || 0,
  }), [isReconciliationBlocked, reconSummary]);

  const getMappingStatus = (account: CoAAccount): 'mapped' | 'unmapped' | 'pending' => {
    if (account.tbGroup && account.fsLineItem) return 'mapped';
    if (account.aiSuggestedTBGroup && !account.isOverridden) return 'pending';
    return 'unmapped';
  };

  const fetchPeriodDrilldown = useCallback(async (glCode: string, side: 'DR' | 'CR', page = 1) => {
    if (!effectiveEngagementId) return;
    
    setDrilldownLoading(true);
    try {
      const queryParams = new URLSearchParams({
        side,
        page: page.toString(),
        pageSize: drilldownFilters.pageSize.toString(),
        ...(drilldownFilters.from && { from: drilldownFilters.from }),
        ...(drilldownFilters.to && { to: drilldownFilters.to }),
        ...(drilldownFilters.search && { search: drilldownFilters.search }),
        ...(drilldownFilters.voucherType !== 'ALL' && { docType: drilldownFilters.voucherType }),
      });

      const response = await fetchWithAuth(
        `/api/trial-balance/coa/${effectiveEngagementId}/account/${encodeURIComponent(glCode)}/period-detail?${queryParams}`,
        {
        }
      );

      if (response.ok) {
        const data = await response.json();
        setDrilldownData({
          totals: data.totals || {
            count: 0,
            totalDr: 0,
            totalCr: 0,
            totalAmountRequested: 0,
          },
          dateRange: data.dateRange || { from: '-', to: '-' },
          documentTypes: data.documentTypes || [],
          rows: (data.entries || []).map((entry: any, idx: number) => ({
            id: entry.id || `drilldown-${idx}`,
            voucherNo: entry.voucherNo || entry.voucherNumber || '-',
            date: entry.postingDate || entry.transactionDate || entry.date || '-',
            docType: entry.voucherType || entry.documentType || entry.docType || '-',
            ref: entry.documentNo || entry.referenceNumber || entry.ref || '-',
            narrative: entry.narrative || entry.description || '-',
            debit: Number(entry.debit || 0),
            credit: Number(entry.credit || 0),
          })),
          meta: data.meta || {
            page,
            pageSize: drilldownFilters.pageSize,
            totalCount: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: page > 1,
          },
        });
      } else {
        console.error('Failed to fetch period drilldown');
        setDrilldownData(null);
      }
    } catch (error) {
      console.error('Error fetching drilldown:', error);
      setDrilldownData(null);
    } finally {
      setDrilldownLoading(false);
    }
  }, [effectiveEngagementId, token, drilldownFilters]);

  const toggleDrilldown = useCallback((glCode: string, side: 'DR' | 'CR', hasAmount: boolean, hasGl: boolean) => {
    if (!hasGl || !hasAmount) return;
    
    if (expandedDrilldown?.glCode === glCode && expandedDrilldown?.side === side) {
      setExpandedDrilldown(null);
      setDrilldownData(null);
    } else {
      setExpandedDrilldown({ glCode, side });
      setDrilldownFilters(prev => ({ ...prev, page: 1 }));
      fetchPeriodDrilldown(glCode, side, 1);
    }
  }, [expandedDrilldown, fetchPeriodDrilldown]);

  const tbDataSource: DataSource | null = useMemo(() => reconSummary?.hasTbData ? {
    datasetId: 'tb-data',
    datasetType: 'TB',
    version: 1,
    fileName: null,
    lastSynced: reconSummary?.lastRunAt || null,
    status: 'CURRENT' as const,
    rowCount: reconSummary?.tbTotals?.count || 0,
  } : null, [reconSummary]);

  const tbGates: TabGate[] = useMemo(() => [
    { gateId: 'tb-uploaded', label: 'TB Data Uploaded', description: 'Trial Balance data must be uploaded', check: reconSummary?.hasTbData ? 'PASS' as const : 'FAIL' as const, blocking: false },
    { gateId: 'tb-balanced', label: 'TB Balanced', description: 'Total debits must equal total credits', check: reconSummary?.tbTotals?.isBalanced ? 'PASS' as const : reconSummary?.hasTbData ? 'FAIL' as const : 'NOT_RUN' as const, blocking: false, isaRef: 'ISA 230' },
  ], [reconSummary]);

  const glDataSource: DataSource | null = useMemo(() => reconSummary?.hasGlData ? {
    datasetId: 'gl-data',
    datasetType: 'GL',
    version: 1,
    fileName: null,
    lastSynced: reconSummary?.lastRunAt || null,
    status: 'CURRENT' as const,
    rowCount: reconSummary?.glTotals?.count || 0,
  } : null, [reconSummary]);

  const glGates: TabGate[] = useMemo(() => [
    { gateId: 'gl-uploaded', label: 'GL Data Uploaded', description: 'Upload General Ledger data to enable TB-GL reconciliation', check: reconSummary?.hasGlData ? 'PASS' as const : 'NOT_RUN' as const, blocking: false },
    ...(reconSummary?.hasGlData ? [{ gateId: 'gl-balanced', label: 'GL Balanced', description: 'GL debits must equal credits', check: reconSummary?.glTotals?.isBalanced ? 'PASS' as const : 'FAIL' as const, blocking: false, isaRef: 'ISA 500' }] : []),
  ], [reconSummary]);

  const apDataSource: DataSource | null = useMemo(() => {
    if (!reconSummary?.hasGlData) return null;
    if (apSummary && apSummary.partyCount === 0) return null;
    if (!apSummary && !reconSummary?.controlAccounts?.apReconciled) return null;
    return {
      datasetId: 'ap-data',
      datasetType: 'AP',
      version: 1,
      fileName: null,
      lastSynced: reconSummary?.lastRunAt || null,
      status: reconSummary?.controlAccounts?.apReconciled ? 'CURRENT' as const : 'STALE' as const,
      rowCount: apSummary?.partyCount || 0,
    };
  }, [reconSummary, apSummary]);

  const apGates: TabGate[] = useMemo(() => (reconSummary?.hasTbData && apSummary && apSummary.partyCount > 0) ? [
    { gateId: 'ap-control-recon', label: 'AP Control Reconciled', description: 'AP sub-ledger must reconcile to GL control account', check: reconSummary?.controlAccounts?.apReconciled ? 'PASS' as const : 'WARNING' as const, blocking: false, isaRef: 'ISA 505' },
  ] : [], [reconSummary, apSummary]);

  const arDataSource: DataSource | null = useMemo(() => {
    if (!reconSummary?.hasGlData) return null;
    if (arSummary && arSummary.partyCount === 0) return null;
    if (!arSummary && !reconSummary?.controlAccounts?.arReconciled) return null;
    return {
      datasetId: 'ar-data',
      datasetType: 'AR',
      version: 1,
      fileName: null,
      lastSynced: reconSummary?.lastRunAt || null,
      status: reconSummary?.controlAccounts?.arReconciled ? 'CURRENT' as const : 'STALE' as const,
      rowCount: arSummary?.partyCount || 0,
    };
  }, [reconSummary, arSummary]);

  const arGates: TabGate[] = useMemo(() => (reconSummary?.hasTbData && arSummary && arSummary.partyCount > 0) ? [
    { gateId: 'ar-control-recon', label: 'AR Control Reconciled', description: 'AR sub-ledger must reconcile to GL control account', check: reconSummary?.controlAccounts?.arReconciled ? 'PASS' as const : 'WARNING' as const, blocking: false, isaRef: 'ISA 505' },
  ] : [], [reconSummary, arSummary]);

  const bankDataSource: DataSource | null = useMemo(() => {
    if (!reconSummary?.hasGlData) return null;
    if (bankSummary && bankSummary.accountCount === 0) return null;
    if (!bankSummary && !reconSummary?.controlAccounts?.bankReconciled) return null;
    return {
      datasetId: 'bank-data',
      datasetType: 'BANK',
      version: 1,
      fileName: null,
      lastSynced: reconSummary?.lastRunAt || null,
      status: reconSummary?.controlAccounts?.bankReconciled ? 'CURRENT' as const : 'STALE' as const,
      rowCount: bankSummary?.accountCount || 0,
    };
  }, [reconSummary, bankSummary]);

  const bankGates: TabGate[] = useMemo(() => (reconSummary?.hasTbData && bankSummary && bankSummary.accountCount > 0) ? [
    { gateId: 'bank-control-recon', label: 'Bank Control Reconciled', description: 'Bank sub-ledger must reconcile to GL control account', check: reconSummary?.controlAccounts?.bankReconciled ? 'PASS' as const : 'WARNING' as const, blocking: false, isaRef: 'ISA 505' },
  ] : [], [reconSummary, bankSummary]);

  const confirmationsDataSource: DataSource | null = useMemo(() => confirmationItems.length > 0 ? {
    datasetId: 'confirmations-data',
    datasetType: 'CONFIRMATION',
    version: 1,
    fileName: null,
    lastSynced: null,
    status: 'CURRENT' as const,
    rowCount: confirmationItems.length,
  } : null, [confirmationItems.length]);

  const confirmationsGates: TabGate[] = useMemo(() => [
    { gateId: 'conf-has-items', label: 'Confirmations Prepared', description: 'At least one balance must be marked for external confirmation', check: confirmationItems.length > 0 ? 'PASS' as const : 'NOT_RUN' as const, blocking: false, isaRef: 'ISA 505' },
  ], [confirmationItems.length]);

  const linkIntegrityInput = useMemo(() => ({
    dataSources: {
      summary: null,
      tb: tbDataSource,
      gl: glDataSource,
      ap: apDataSource,
      ar: arDataSource,
      bank: bankDataSource,
      confirmations: confirmationsDataSource,
      mapping: null,
      'draft-fs': null,
    },
    reconSummary: reconSummary ? {
      hasTbData: reconSummary.hasTbData,
      hasGlData: reconSummary.hasGlData,
      tbGlReconciled: reconSummary.tbGlRecon?.isReconciled ?? false,
      arReconciled: reconSummary.controlAccounts?.arReconciled ?? false,
      apReconciled: reconSummary.controlAccounts?.apReconciled ?? false,
      bankReconciled: reconSummary.controlAccounts?.bankReconciled ?? false,
      mappingCompleteness: reconSummary.fsMapping?.percentMapped ?? 0,
      unmappedCount: (reconSummary.fsMapping?.totalAccounts ?? 0) - (reconSummary.fsMapping?.mappedAccounts ?? 0),
      orphanConfirmations: 0,
      staleSyncTabs: [] as WorkflowTabKey[],
    } : null,
  }), [reconSummary, tbDataSource, glDataSource, apDataSource, arDataSource, bankDataSource, confirmationsDataSource]);

  const linkIntegrity = useLinkIntegrity(linkIntegrityInput);

  const draftFsDataSource: DataSource | null = useMemo(() => {
    const mappedCount = tbImportAccounts.filter(a => a.fsHeadKey).length;
    if (mappedCount === 0 && !snapshotId) return null;
    return {
      datasetId: snapshotId || 'draft-fs-data',
      datasetType: 'FS',
      version: snapshotId ? 1 : 0,
      fileName: null,
      lastSynced: snapshotGeneratedAt || reconSummary?.lastRunAt || null,
      status: snapshotId ? 'CURRENT' as const : 'STALE' as const,
      rowCount: mappedCount,
    };
  }, [tbImportAccounts, snapshotId, snapshotGeneratedAt, reconSummary]);

  const draftFsGates: TabGate[] = useMemo(() => {
    const pctMapped = reconSummary?.fsMapping?.percentMapped ?? 0;
    const hasMappingData = (reconSummary?.fsMapping?.mappedAccounts ?? 0) > 0;
    const qualityScore = reconSummary?.dataQuality?.score ?? 100;
    const totalIssues = reconSummary?.dataQuality?.totalIssues ?? 0;
    const reconLoaded = reconSummary !== null;

    return [
      {
        gateId: 'mapping-approved',
        label: 'Mapping Coverage',
        description: !reconLoaded
          ? 'Loading mapping data...'
          : hasMappingData
          ? `${pctMapped}% of accounts mapped to FS Heads`
          : 'No accounts mapped — go to FS Mapping tab to map accounts',
        check: !reconLoaded ? 'NOT_RUN' as const : pctMapped >= 100 ? 'PASS' as const : hasMappingData ? 'WARNING' as const : 'FAIL' as const,
        blocking: false,
        isaRef: 'ISA 315',
      },
      {
        gateId: 'snapshot-generated',
        label: 'FS Snapshot',
        description: snapshotId
          ? 'Draft FS snapshot generated successfully'
          : 'Click "Generate Snapshot" to create a Draft FS snapshot',
        check: snapshotId ? 'PASS' as const : 'NOT_RUN' as const,
        blocking: false,
      },
      {
        gateId: 'validation-pass',
        label: 'Data Quality',
        description: !reconLoaded
          ? 'Loading quality data...'
          : totalIssues === 0
          ? 'All validation checks passed'
          : `${totalIssues} data quality issue${totalIssues > 1 ? 's' : ''} found (score: ${qualityScore}%)`,
        check: !reconLoaded ? 'NOT_RUN' as const : totalIssues === 0 ? 'PASS' as const : qualityScore >= 80 ? 'WARNING' as const : 'FAIL' as const,
        blocking: false,
      },
    ];
  }, [reconSummary, snapshotId]);

  const allDraftFsGatesPass = useMemo(() =>
    draftFsGates.every(g => g.check === 'PASS'),
  [draftFsGates]);


  const handleGenerateSnapshot = useCallback(async () => {
    if (!engagementId) return;
    setIsGeneratingSnapshot(true);
    try {
      const res = await fetchWithAuth(`/api/engagements/${engagementId}/recon/draft-fs`, {
        method: 'POST',
      });
      if (res.ok) {
        const snapshot = await res.json();
        setSnapshotId(snapshot.id);
        setSnapshotGeneratedAt(snapshot.generatedAt);
        const footingMsg = snapshot.bsFootingPass ? 'BS footing passed.' : `BS footing failed (diff: ${snapshot.bsFootingDiff}).`;
        toast({
          title: "Snapshot Generated",
          description: `Draft FS snapshot created. ${footingMsg}`,
          variant: snapshot.bsFootingPass ? 'default' : 'destructive',
        });
        try {
          await fetchWithAuth(`/api/engagements/${engagementId}/recon/scan`, {
            method: 'POST',
          });
          queryClient.invalidateQueries({ queryKey: ['/api/engagements', engagementId, 'recon', 'gates'] });
          queryClient.invalidateQueries({ queryKey: ['/api/engagements', engagementId, 'recon', 'summary'] });
        } catch { /* silent - gate status will refresh on next scan */ }
      } else {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        toast({ title: "Snapshot Failed", description: err.error || 'Failed to generate snapshot', variant: "destructive" });
      }
    } catch {
      toast({ title: "Snapshot Failed", description: "Failed to generate Draft FS snapshot", variant: "destructive" });
    } finally {
      setIsGeneratingSnapshot(false);
    }
  }, [engagementId, toast, queryClient]);

  const handlePushForward = useCallback(async () => {
    if (!engagementId) return;
    setIsPushingForward(true);
    try {
      const res = await fetchWithAuth('/api/review-mapping/push-forward', {
        method: 'POST',
        body: JSON.stringify({ engagementId }),
      });
      if (res.ok) {
        const data = await res.json();
        const targets = data.targets || [];
        toast({
          title: "Data Pushed Forward",
          description: `Successfully pushed data to: ${targets.join(', ')}. You can now proceed to Planning and subsequent phases.`,
        });
        fetchReconSummary();
        queryClient.invalidateQueries({ queryKey: ['/api/engagements'] });
        queryClient.invalidateQueries({ queryKey: ['/api/engagements', engagementId, 'recon', 'gates'] });
        queryClient.invalidateQueries({ queryKey: ['/api/engagements', engagementId, 'recon', 'summary'] });
      } else {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        toast({ title: "Push Failed", description: err.error || 'Failed to push data forward', variant: "destructive" });
      }
    } catch {
      toast({ title: "Push Failed", description: "Failed to push data to next phases", variant: "destructive" });
    } finally {
      setIsPushingForward(false);
    }
  }, [engagementId, token, toast, fetchReconSummary, queryClient]);

  return (
    <div className="space-y-2 max-w-full overflow-x-hidden">
      <div className="sticky top-0 z-10 bg-background flex items-center gap-1 border-b border-border pb-1.5 mb-2 flex-wrap" data-testid="review-coa-subtabs">
        {[
          { key: 'upload', label: 'Upload' },
          { key: 'tb', label: 'Trial Balance' },
          { key: 'gl', label: 'GL' },
          { key: 'ap', label: 'AP' },
          { key: 'ar', label: 'AR' },
          { key: 'bank', label: 'Bank' },
          { key: 'confirmations', label: 'Confirmations' },
          { key: 'mapping', label: 'FS Mapping' },
          { key: 'draft-fs', label: 'Draft FS' },
          { key: 'checks', label: 'Checks' },
        ].map((tab) => {
          const reconCount = reconIssueSummary?.byTab?.[reconTabKeyMap[tab.key]]?.total ?? 0;
          const reconHigh = reconIssueSummary?.byTab?.[reconTabKeyMap[tab.key]]?.high ?? 0;
          const totalIssues = reconCount;
          const hasHighSeverity = reconHigh > 0;

          return (
            <Button
              key={tab.key}
              variant={reviewCoaSubTab === tab.key ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleSubTabChange(tab.key as typeof reviewCoaSubTab)}
              data-testid={`tab-review-${tab.key}`}
            >
              {tab.label}
              {totalIssues > 0 && (
                <Badge variant={hasHighSeverity ? 'destructive' : 'secondary'} className="ml-1 text-xs" data-testid={`badge-recon-${tab.key}`}>
                  {totalIssues}
                </Badge>
              )}
            </Button>
          );
        })}
        <div className="ml-auto flex items-center gap-2">
          {loadingReconSummary && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading data...</span>
            </div>
          )}
        </div>
      </div>

      {reviewCoaSubTab === 'upload' && (
        <SummaryTab
          toast={toast}
          onNavigate={(tab: string) => handleSubTabChange(tab as any)}
        />
      )}

      {reviewCoaSubTab === 'tb' && (
        <>
        <SubTabShell
          tabKey="tb"
          gates={tbGates}
        >
          <DataTabSection
            engagementId={engagementId || ''}
            datasetType="data/tb"
            uploaderType="tb"
            title="Trial Balance Data"
            description="Review and edit imported Trial Balance rows"
            icon={<FileSpreadsheet className="h-4 w-4" />}
            columns={TB_COLUMNS}
            summaryMetrics={tbSummary && tbSummary.accountCount > 0 ? [
              { label: 'OB Debit', value: tbSummary.totalOpeningDebit, testId: 'text-opening-debit' },
              { label: 'OB Credit', value: tbSummary.totalOpeningCredit, testId: 'text-opening-credit' },
              { label: 'Movement DR', value: tbSummary.totalMovementDebit, testId: 'text-movement-debit' },
              { label: 'Movement CR', value: tbSummary.totalMovementCredit, testId: 'text-movement-credit' },
              { label: 'CB Debit', value: tbSummary.totalClosingDebit, testId: 'text-closing-debit' },
              { label: 'CB Credit', value: tbSummary.totalClosingCredit, testId: 'text-closing-credit' },
            ] : undefined}
            balanceChecks={tbSummary && tbSummary.accountCount > 0 ? [
              { debit: tbSummary.totalOpeningDebit, credit: tbSummary.totalOpeningCredit, label: 'OB Balanced' },
              { debit: tbSummary.totalClosingDebit, credit: tbSummary.totalClosingCredit, label: 'CB Balanced' },
            ] : undefined}
          />
        </SubTabShell>
        </>
      )}

      {reviewCoaSubTab === 'gl' && (
        <SubTabShell
          tabKey="gl"
          gates={glGates}
        >
          <DataTabSection
            engagementId={engagementId || ''}
            datasetType="data/gl"
            uploaderType="gl"
            title="General Ledger Data"
            description="Review and edit imported General Ledger entries"
            icon={<Database className="h-4 w-4" />}
            columns={GL_COLUMNS}
            summaryMetrics={glSummary && glSummary.entryCount > 0 ? [
              { label: 'Entries', value: glSummary.entryCount, testId: 'text-gl-entry-count' },
              { label: 'Total Debit', value: glSummary.totalDebit, testId: 'text-gl-total-debit' },
              { label: 'Total Credit', value: glSummary.totalCredit, testId: 'text-gl-total-credit' },
            ] : undefined}
            balanceChecks={glSummary && glSummary.entryCount > 0 ? [
              { debit: glSummary.totalDebit, credit: glSummary.totalCredit, label: 'Balanced' },
            ] : undefined}
          />
        </SubTabShell>
      )}

      {reviewCoaSubTab === 'ap' && (
        <SubTabShell
          tabKey="ap"
          gates={apGates}
          headerContent={confirmationItems.filter(c => c.type === 'AP').length > 0 ? (
            <Badge variant="outline" className="text-xs">
              {confirmationItems.filter(c => c.type === 'AP').length} marked for confirmation
            </Badge>
          ) : undefined}
        >
          <DataTabSection
            engagementId={engagementId || ''}
            datasetType="data/party"
            uploaderType="ap"
            title="Accounts Payable (Vendors)"
            description="Review vendor/supplier master data"
            icon={<Building2 className="h-4 w-4" />}
            columns={PARTY_COLUMNS}
            additionalFilters={{ partyType: 'VENDOR' }}
            enableSelection={true}
            selectedIds={apSelectedIds}
            onSelectionChange={(ids) => setApSelectedIds(ids)}
            selectionActionLabel="Mark for Confirmation"
            onSelectionAction={(rows) => handleAddToConfirmations(rows, 'AP')}
            summaryMetrics={apSummary && apSummary.partyCount > 0 ? [
              { label: 'AP Balance', value: Math.abs(apSummary.totalApBalance), testId: 'text-ap-total-balance' },
              { label: 'Vendors', value: apSummary.partyCount },
              { label: 'AP per GL', value: Math.abs(apSummary.apBalancePerGl), testId: 'text-ap-gl-balance' },
              { label: 'AP per TB', value: Math.abs(apSummary.apBalancePerTb), testId: 'text-ap-tb-balance' },
              { label: 'Control GL', value: apSummary.uniqueControlCodes.join(', ') || 'None', testId: 'text-ap-gl-codes' },
            ] : undefined}
            balanceChecks={apSummary && apSummary.partyCount > 0 ? [
              { debit: apSummary.totalApBalance, credit: apSummary.apBalancePerTb, label: 'Reconciled' },
            ] : undefined}
          />
        </SubTabShell>
      )}

      {reviewCoaSubTab === 'ar' && (
        <SubTabShell
          tabKey="ar"
          gates={arGates}
          headerContent={confirmationItems.filter(c => c.type === 'AR').length > 0 ? (
            <Badge variant="outline" className="text-xs">
              {confirmationItems.filter(c => c.type === 'AR').length} marked for confirmation
            </Badge>
          ) : undefined}
        >
          <DataTabSection
            engagementId={engagementId || ''}
            datasetType="data/party"
            uploaderType="ar"
            title="Accounts Receivable (Customers)"
            description="Review customer/debtor master data"
            icon={<Users className="h-4 w-4" />}
            columns={PARTY_COLUMNS}
            additionalFilters={{ partyType: 'CUSTOMER' }}
            enableSelection={true}
            selectedIds={arSelectedIds}
            onSelectionChange={(ids) => setArSelectedIds(ids)}
            selectionActionLabel="Mark for Confirmation"
            onSelectionAction={(rows) => handleAddToConfirmations(rows, 'AR')}
            summaryMetrics={arSummary && arSummary.partyCount > 0 ? [
              { label: 'AR Balance', value: Math.abs(arSummary.totalApBalance), testId: 'text-ar-total-balance' },
              { label: 'Customers', value: arSummary.partyCount },
              { label: 'AR per GL', value: Math.abs(arSummary.apBalancePerGl), testId: 'text-ar-gl-balance' },
              { label: 'AR per TB', value: Math.abs(arSummary.apBalancePerTb), testId: 'text-ar-tb-balance' },
              { label: 'Control GL', value: arSummary.uniqueControlCodes.join(', ') || 'None', testId: 'text-ar-gl-codes' },
            ] : undefined}
            balanceChecks={arSummary && arSummary.partyCount > 0 ? [
              { debit: arSummary.totalApBalance, credit: arSummary.apBalancePerTb, label: 'Reconciled' },
            ] : undefined}
          />
        </SubTabShell>
      )}

      {reviewCoaSubTab === 'bank' && (
        <SubTabShell
          tabKey="bank"
          gates={bankGates}
          headerContent={confirmationItems.filter(c => c.type === 'BANK').length > 0 ? (
            <Badge variant="outline" className="text-xs">
              {confirmationItems.filter(c => c.type === 'BANK').length} marked for confirmation
            </Badge>
          ) : undefined}
        >
          <DataTabSection
            engagementId={engagementId || ''}
            datasetType="data/bank"
            uploaderType="bank"
            title="Bank Accounts"
            description="Review bank account master data"
            icon={<Calculator className="h-4 w-4" />}
            columns={BANK_COLUMNS}
            enableSelection={true}
            selectedIds={bankSelectedIds}
            onSelectionChange={(ids) => setBankSelectedIds(ids)}
            selectionActionLabel="Mark for Confirmation"
            onSelectionAction={(rows) => handleAddToConfirmations(rows, 'BANK')}
            summaryMetrics={bankSummary && bankSummary.accountCount > 0 ? [
              { label: 'Bank Balance', value: bankSummary.totalBookBalance, testId: 'text-bank-total-balance' },
              { label: 'Accounts', value: bankSummary.accountCount },
              { label: 'per GL', value: bankSummary.bankBalancePerGl, testId: 'text-bank-gl-balance' },
              { label: 'per TB', value: bankSummary.bankBalancePerTb, testId: 'text-bank-tb-balance' },
              { label: 'Control GL', value: bankSummary.uniqueControlCodes.join(', ') || 'None', testId: 'text-bank-gl-codes' },
              { label: 'Currencies', value: bankSummary.currencyBreakdown.map(c => c.currency).join(', ') || 'PKR', testId: 'text-bank-currencies' },
            ] : undefined}
            balanceChecks={bankSummary && bankSummary.accountCount > 0 ? [
              { debit: bankSummary.totalBookBalance, credit: bankSummary.bankBalancePerTb, label: 'Reconciled' },
            ] : undefined}
          />
        </SubTabShell>
      )}


      {reviewCoaSubTab === 'confirmations' && (
        <SubTabShell
          tabKey="confirmations"
          gates={confirmationsGates}
        >
        <Card data-testid="card-confirmations">
          <CardHeader className="py-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileDown className="h-5 w-5" />
                  External Confirmations
                </CardTitle>
                <CardDescription className="text-xs">
                  Manage confirmation letters for selected balances - send via email or download
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddConfirmationOpen(true)}
                  data-testid="btn-add-confirmation-line"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Line
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={confirmationItems.length === 0}
                  onClick={handleDownloadAllLetters}
                  data-testid="btn-download-all-confirmations"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download All Letters
                </Button>
                <Button
                  size="sm"
                  disabled={confirmationItems.length === 0}
                  data-testid="btn-send-confirmations"
                >
                  <FileSpreadsheet className="h-4 w-4 mr-1" />
                  Send via Email
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="grid grid-cols-5 gap-2">
                {[
                  {
                    type: 'AR' as const,
                    label: 'AR',
                    icon: <Users className="h-4 w-4 text-green-500" />,
                    totalBalance: arSummary ? Math.abs(arSummary.totalApBalance) : 0,
                    totalLabel: 'Balance',
                  },
                  {
                    type: 'AP' as const,
                    label: 'AP',
                    icon: <Building2 className="h-4 w-4 text-orange-500" />,
                    totalBalance: apSummary ? Math.abs(apSummary.totalApBalance) : 0,
                    totalLabel: 'Balance',
                  },
                  {
                    type: 'BANK' as const,
                    label: 'Bank',
                    icon: <Database className="h-4 w-4 text-cyan-500" />,
                    totalBalance: bankSummary ? bankSummary.totalBookBalance : 0,
                    totalLabel: 'Balance',
                  },
                  {
                    type: 'LEGAL' as const,
                    label: 'Legal',
                    icon: <Scale className="h-4 w-4 text-purple-500" />,
                    totalBalance: 0,
                    totalLabel: 'Litigation',
                  },
                  {
                    type: 'TAX' as const,
                    label: 'Tax',
                    icon: <FileText className="h-4 w-4 text-red-500" />,
                    totalBalance: 0,
                    totalLabel: 'Assessment',
                  },
                ].map(card => {
                  const items = confirmationItems.filter(c => c.type === card.type);
                  const confBalance = items.reduce((sum, c) => sum + c.balance, 0);
                  const isExpanded = expandedConfType === card.type;
                  return (
                    <div
                      key={card.type}
                      className={`border rounded-md px-3 py-2 cursor-pointer transition-colors ${isExpanded ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                      onClick={() => setExpandedConfType(isExpanded ? null : card.type)}
                      data-testid={`card-conf-${card.type.toLowerCase()}`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        {card.icon}
                        <span className="text-xs font-medium">{card.label}</span>
                        <span className="text-lg font-bold ml-auto">{items.length}</span>
                      </div>
                      {card.totalBalance > 0 && (
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>{card.totalLabel}:</span>
                          <span className="font-semibold text-foreground">{card.totalBalance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                        </div>
                      )}
                      {card.totalBalance > 0 && (
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>Confirm:</span>
                          <span className="font-semibold text-foreground">{Math.abs(confBalance).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                        </div>
                      )}
                      {card.totalBalance > 0 && (
                        <div className="w-full bg-muted rounded-full h-1 mt-1">
                          <div className="bg-primary rounded-full h-1 transition-all" style={{ width: `${Math.min(100, card.totalBalance > 0 ? (Math.abs(confBalance) / card.totalBalance) * 100 : 0)}%` }} />
                        </div>
                      )}
                      {card.totalBalance === 0 && (
                        <p className="text-[11px] text-muted-foreground">{card.totalLabel}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-0.5">
                        {isExpanded ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
                        {isExpanded ? 'Collapse' : 'Details'}
                      </p>
                    </div>
                  );
                })}
              </div>
              {expandedConfType && (() => {
                const items = confirmationItems.filter(c => c.type === expandedConfType);
                const isFinancial = ['AR', 'AP', 'BANK'].includes(expandedConfType);
                if (items.length === 0) {
                  return (
                    <div className="border rounded-md py-3 text-center text-xs text-muted-foreground" data-testid="empty-conf-detail">
                      No {expandedConfType.toLowerCase()} items marked for confirmation yet
                    </div>
                  );
                }
                return (
                  <Card className="border">
                    <CardContent className="py-2">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {isFinancial && <TableHead className="text-xs">Code</TableHead>}
                            <TableHead className="text-xs">Name</TableHead>
                            {isFinancial ? (
                              <TableHead className="text-xs text-right">Balance</TableHead>
                            ) : (
                              <TableHead className="text-xs">Email</TableHead>
                            )}
                            <TableHead className="text-xs">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map(item => (
                            <TableRow key={item.id}>
                              {isFinancial && <TableCell className="text-xs font-mono">{item.partyCode || '-'}</TableCell>}
                              <TableCell className="text-xs">{item.partyName}</TableCell>
                              {isFinancial ? (
                                <TableCell className="text-xs text-right font-mono">{item.balance.toLocaleString(undefined, { minimumFractionDigits: 0 })}</TableCell>
                              ) : (
                                <TableCell className="text-xs">{item.contactEmail || '-'}</TableCell>
                              )}
                              <TableCell className="text-xs">
                                <Badge variant="outline" className="text-xs">{item.status}</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                );
              })()}
              <Separator />

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium">Balances Marked for Confirmation</h3>
                  <Badge variant="outline">{confirmationItems.length} item{confirmationItems.length !== 1 ? 's' : ''}</Badge>
                </div>
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Type</TableHead>
                        <TableHead className="text-xs">Party Code</TableHead>
                        <TableHead className="text-xs">Party Name</TableHead>
                        <TableHead className="text-xs">Contact Email</TableHead>
                        <TableHead className="text-xs text-right">Balance</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {confirmationItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-4 text-muted-foreground">
                            No balances marked for confirmation yet. Go to AR, AP, or Bank tabs to select balances, or click "Add Line" to add manually.
                          </TableCell>
                        </TableRow>
                      ) : (
                        confirmationItems.map((item) => (
                          <TableRow key={item.id} data-testid={`confirmation-row-${item.id}`}>
                            <TableCell className="text-xs">
                              <Badge 
                                variant="outline" 
                                className={
                                  item.type === 'AR' ? 'bg-green-50 text-green-700 border-green-300' :
                                  item.type === 'AP' ? 'bg-orange-50 text-orange-700 border-orange-300' :
                                  'bg-cyan-50 text-cyan-700 border-cyan-300'
                                }
                              >
                                {item.type}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs font-mono">{item.partyCode || '-'}</TableCell>
                            <TableCell className="text-xs">{item.partyName}</TableCell>
                            <TableCell className="text-xs">{item.contactEmail || '-'}</TableCell>
                            <TableCell className="text-xs text-right font-mono">
                              {item.balance.toLocaleString(undefined, { minimumFractionDigits: 0 })}
                            </TableCell>
                            <TableCell className="text-xs">
                              <Badge 
                                variant="outline" 
                                className={
                                  item.status === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-300' :
                                  item.status === 'SENT' ? 'bg-blue-50 text-blue-700 border-blue-300' :
                                  item.status === 'CONFIRMED' ? 'bg-green-50 text-green-700 border-green-300' :
                                  'bg-red-50 text-red-700 border-red-300'
                                }
                              >
                                {item.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button 
                                      size="icon" 
                                      variant="ghost" 
                                      className="h-7 w-7"
                                      onClick={() => handleDownloadLetter(item)}
                                      data-testid={`btn-download-letter-${item.id}`}
                                    >
                                      <Download className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Download Letter</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button 
                                      size="icon" 
                                      variant="ghost" 
                                      className="h-7 w-7"
                                      onClick={() => handleRemoveConfirmation(item.id)}
                                      data-testid={`btn-remove-confirmation-${item.id}`}
                                    >
                                      <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Remove from list</TooltipContent>
                                </Tooltip>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {confirmationItems.length === 0 && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>How to use External Confirmations</AlertTitle>
                  <AlertDescription className="text-xs">
                    <ol className="list-decimal ml-4 mt-1 space-y-1">
                      <li>Navigate to the AR, AP, or Bank tabs to view balances</li>
                      <li>Select the balances you want to confirm using checkboxes</li>
                      <li>Click "Mark for Confirmation" to include them here</li>
                      <li>Download individual letters or send via email in bulk</li>
                      <li>Or use "Add Line" to manually add a confirmation entry</li>
                    </ol>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
        </SubTabShell>
      )}

      {/* Add Manual Confirmation Dialog */}
      {isAddConfirmationOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setIsAddConfirmationOpen(false)}>
          <Card className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center h-8 w-8 rounded-md bg-primary/10">
                  <Plus className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Add Confirmation Line</CardTitle>
                  <CardDescription className="text-xs">Manually add a balance for external confirmation</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 pt-0">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Type</label>
                  <Select
                    value={newConfirmation.type}
                    onValueChange={(v) => setNewConfirmation({ ...newConfirmation, type: v as 'AR' | 'AP' | 'BANK' })}
                  >
                    <SelectTrigger data-testid="select-confirmation-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AR">AR (Accounts Receivable)</SelectItem>
                      <SelectItem value="AP">AP (Accounts Payable)</SelectItem>
                      <SelectItem value="BANK">Bank</SelectItem>
                      <SelectItem value="LEGAL">Legal Advisor</SelectItem>
                      <SelectItem value="TAX">Tax Advisor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Balance</label>
                  <Input
                    type="number"
                    value={newConfirmation.balance || ''}
                    onChange={(e) => setNewConfirmation({ ...newConfirmation, balance: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                    data-testid="input-confirmation-balance"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Party Name <span className="text-destructive">*</span></label>
                <Input
                  value={newConfirmation.partyName || ''}
                  onChange={(e) => setNewConfirmation({ ...newConfirmation, partyName: e.target.value })}
                  placeholder="Enter party/bank name"
                  data-testid="input-confirmation-party-name"
                />
              </div>

              <div className="border-t pt-4">
                <p className="text-xs font-medium text-muted-foreground mb-3">Contact Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Contact Person</label>
                    <Input
                      value={newConfirmation.contactPerson || ''}
                      onChange={(e) => setNewConfirmation({ ...newConfirmation, contactPerson: e.target.value })}
                      placeholder="Full name"
                      data-testid="input-confirmation-contact-person"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Email</label>
                    <Input
                      type="email"
                      value={newConfirmation.contactEmail || ''}
                      onChange={(e) => setNewConfirmation({ ...newConfirmation, contactEmail: e.target.value })}
                      placeholder="email@example.com"
                      data-testid="input-confirmation-email"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-xs font-medium text-muted-foreground mb-3">Address</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs text-muted-foreground">Street Address</label>
                    <Input
                      value={newConfirmation.partyAddress || ''}
                      onChange={(e) => setNewConfirmation({ ...newConfirmation, partyAddress: e.target.value })}
                      placeholder="Street address"
                      data-testid="input-confirmation-address"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">City</label>
                    <Input
                      value={newConfirmation.partyCity || ''}
                      onChange={(e) => setNewConfirmation({ ...newConfirmation, partyCity: e.target.value })}
                      placeholder="City"
                      data-testid="input-confirmation-city"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
            <div className="flex justify-end gap-2 p-4 pt-0">
              <Button variant="outline" onClick={() => setIsAddConfirmationOpen(false)} data-testid="button-cancel-confirmation">
                Cancel
              </Button>
              <Button
                onClick={handleAddManualConfirmation}
                disabled={!newConfirmation.partyName}
                data-testid="button-submit-confirmation"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add Confirmation
              </Button>
            </div>
          </Card>
        </div>
      )}

      {reviewCoaSubTab === 'mapping' && (
        <>
          <FsMappingSection
            engagementId={engagementId}
            token={token}
            toast={toast}
            onNavigate={(tab: string) => handleSubTabChange(tab as any)}
            canApproveLock={gateStatus?.canApproveLock}
            initialFilter={fsMappingInitialFilter}
            onFilterConsumed={() => setFsMappingInitialFilter(undefined)}
          />
        </>
      )}

      {reviewCoaSubTab === 'draft-fs' && (
        <SubTabShell
          tabKey="draft-fs"
          gates={draftFsGates}
          contextualActions={[
            {
              id: 'generate-snapshot',
              label: snapshotId ? 'Regenerate Snapshot' : 'Generate Snapshot',
              icon: <Camera className="h-3.5 w-3.5" />,
              onClick: handleGenerateSnapshot,
              disabled: isGeneratingSnapshot || tbImportAccounts.filter(a => a.fsHeadKey).length === 0,
              disabledReason: tbImportAccounts.filter(a => a.fsHeadKey).length === 0 ? 'No mapped accounts available' : undefined,
              loading: isGeneratingSnapshot,
            },
          ]}
        >
          {engagementId ? (
            <FSDraftGenerator engagementId={engagementId} />
          ) : (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <p>No engagement selected</p>
            </div>
          )}
        </SubTabShell>
      )}

      {reviewCoaSubTab === 'checks' && (() => {
        const checks = [
          { id: 'tb-uploaded', name: 'TB Data Uploaded', description: 'Trial Balance data has been uploaded', pass: !!reconSummary?.hasTbData, category: 'upload', fixTab: 'upload' as const, critical: true },
          { id: 'gl-uploaded', name: 'GL Data Uploaded', description: 'General Ledger data has been uploaded', pass: !!reconSummary?.hasGlData, category: 'upload', fixTab: 'upload' as const, critical: true },
          { id: 'ap-loaded', name: 'AP Data Loaded', description: 'Accounts Payable sub-ledger data is present', pass: !!(apSummary && apSummary.partyCount > 0), category: 'upload', fixTab: 'ap' as const, critical: false },
          { id: 'ar-loaded', name: 'AR Data Loaded', description: 'Accounts Receivable sub-ledger data is present', pass: !!(arSummary && arSummary.partyCount > 0), category: 'upload', fixTab: 'ar' as const, critical: false },
          { id: 'bank-loaded', name: 'Bank Data Loaded', description: 'Bank account data has been uploaded', pass: !!(bankSummary && bankSummary.accountCount > 0), category: 'upload', fixTab: 'bank' as const, critical: false },
          { id: 'tb-balanced', name: 'TB Balanced (DR = CR)', description: 'Total closing debits equal total closing credits', pass: !!reconSummary?.tbTotals?.isBalanced, category: 'recon', fixTab: 'tb' as const, critical: true },
          { id: 'gl-balanced', name: 'GL Balanced', description: 'Total GL debits equal total GL credits', pass: !!reconSummary?.glTotals?.isBalanced, category: 'recon', fixTab: 'gl' as const, critical: true },
          { id: 'tb-gl-reconciled', name: 'TB-GL Reconciled', description: 'TB period movements match GL totals per account', pass: !!reconSummary?.tbGlRecon?.isReconciled, category: 'recon', fixTab: 'gl' as const, critical: true },
          { id: 'ap-control', name: 'AP Control Reconciled', description: 'AP sub-ledger reconciles to AP control account', pass: !!reconSummary?.controlAccounts?.apReconciled, category: 'recon', fixTab: 'ap' as const, critical: false },
          { id: 'ar-control', name: 'AR Control Reconciled', description: 'AR sub-ledger reconciles to AR control account', pass: !!reconSummary?.controlAccounts?.arReconciled, category: 'recon', fixTab: 'ar' as const, critical: false },
          { id: 'bank-control', name: 'Bank Control Reconciled', description: 'Bank balances reconcile to bank control account', pass: !!reconSummary?.controlAccounts?.bankReconciled, category: 'recon', fixTab: 'bank' as const, critical: false },
          { id: 'fs-mapping-complete', name: 'FS Mapping Complete', description: 'All TB accounts mapped to FS line items (100%)', pass: (reconSummary?.fsMapping?.percentMapped ?? 0) >= 100, category: 'output', fixTab: 'mapping' as const, critical: true },
          { id: 'all-mapped', name: 'All Accounts Mapped', description: 'No unmapped accounts remaining', pass: reconSummary?.fsMapping ? (reconSummary.fsMapping.totalAccounts - reconSummary.fsMapping.mappedAccounts) === 0 : false, category: 'output', fixTab: 'mapping' as const, critical: true },
          { id: 'snapshot-generated', name: 'Draft FS Snapshot Generated', description: 'A Draft Financial Statements snapshot has been created', pass: !!snapshotId, category: 'output', fixTab: 'draft-fs' as const, critical: true },
          { id: 'data-quality', name: 'Data Quality Score Adequate', description: 'Data quality score is 80 or above', pass: (reconSummary?.dataQuality?.score ?? 0) >= 80, category: 'output', fixTab: 'upload' as const, critical: false },
        ];

        const passedCount = checks.filter(c => c.pass).length;
        const totalCount = checks.length;
        const completionPercent = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;
        const criticalPassed = checks.filter(c => c.critical).every(c => c.pass);

        const uploadChecks = checks.filter(c => c.category === 'upload');
        const reconChecks = checks.filter(c => c.category === 'recon');
        const outputChecks = checks.filter(c => c.category === 'output');

        const renderCheckItem = (check: typeof checks[0]) => (
          <div key={check.id} className="flex items-center justify-between gap-2 py-2 border-b last:border-b-0" data-testid={`check-item-${check.id}`}>
            <div className="flex items-center gap-3 min-w-0">
              {check.pass ? (
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" data-testid={`icon-pass-${check.id}`} />
              ) : check.critical ? (
                <XCircle className="h-5 w-5 text-red-500 shrink-0" data-testid={`icon-fail-${check.id}`} />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" data-testid={`icon-warn-${check.id}`} />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" data-testid={`text-check-name-${check.id}`}>{check.name}</p>
                <p className="text-xs text-muted-foreground truncate">{check.description}</p>
              </div>
            </div>
            {!check.pass && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSubTabChange(check.fixTab)}
                data-testid={`button-fix-${check.id}`}
              >
                Fix
              </Button>
            )}
          </div>
        );

        return (
          <SubTabShell tabKey="checks">
            <div className="space-y-4 p-2" data-testid="checks-dashboard">
              <Card data-testid="card-overall-readiness">
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-base">Overall Readiness</CardTitle>
                  </div>
                  <Badge
                    variant={criticalPassed ? 'default' : 'destructive'}
                    data-testid="badge-readiness-status"
                  >
                    {criticalPassed ? 'Ready to Proceed' : 'Action Required'}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between gap-2 text-sm" data-testid="text-checks-summary">
                    <span className="text-muted-foreground">Checks passed</span>
                    <span className="font-semibold">{passedCount} / {totalCount}</span>
                  </div>
                  <Progress value={completionPercent} className="h-2" data-testid="progress-checks" />
                  <p className="text-xs text-muted-foreground text-right" data-testid="text-completion-percent">{completionPercent}% complete</p>
                  <div className="pt-2 flex items-center gap-3">
                    <Button
                      onClick={handlePushForward}
                      disabled={!criticalPassed || isPushingForward}
                      className="flex-1"
                      data-testid="button-proceed-planning"
                    >
                      {isPushingForward ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <ArrowRight className="h-4 w-4 mr-2" />
                      )}
                      {isPushingForward ? 'Pushing Data...' : 'Proceed to Planning'}
                    </Button>
                    {!criticalPassed && (
                      <p className="text-xs text-muted-foreground" data-testid="text-critical-required">Complete all critical checks first</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card data-testid="card-upload-checks">
                  <CardHeader className="flex flex-row items-center gap-2 pb-2 flex-wrap">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-sm">Data Upload Checks</CardTitle>
                    <Badge variant="outline" className="ml-auto text-xs no-default-hover-elevate" data-testid="badge-upload-count">
                      {uploadChecks.filter(c => c.pass).length}/{uploadChecks.length}
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    {uploadChecks.map(renderCheckItem)}
                  </CardContent>
                </Card>

                <Card data-testid="card-recon-checks">
                  <CardHeader className="flex flex-row items-center gap-2 pb-2 flex-wrap">
                    <Scale className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-sm">Balance & Reconciliation</CardTitle>
                    <Badge variant="outline" className="ml-auto text-xs no-default-hover-elevate" data-testid="badge-recon-count">
                      {reconChecks.filter(c => c.pass).length}/{reconChecks.length}
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    {reconChecks.map(renderCheckItem)}
                  </CardContent>
                </Card>

                <Card data-testid="card-output-checks">
                  <CardHeader className="flex flex-row items-center gap-2 pb-2 flex-wrap">
                    <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-sm">FS Mapping & Output</CardTitle>
                    <Badge variant="outline" className="ml-auto text-xs no-default-hover-elevate" data-testid="badge-output-count">
                      {outputChecks.filter(c => c.pass).length}/{outputChecks.length}
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    {outputChecks.map(renderCheckItem)}
                  </CardContent>
                </Card>
              </div>
            </div>
          </SubTabShell>
        );
      })()}
    </div>
  );
}

export default ReviewCoaSection;
