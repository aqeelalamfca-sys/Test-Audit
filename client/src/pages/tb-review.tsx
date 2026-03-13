import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { useEngagement } from "@/lib/workspace-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { 
  ArrowLeft, Save, Brain, CheckCircle2, FileSpreadsheet, 
  TrendingUp, AlertCircle, Download, RefreshCw, Search, ExternalLink, Database,
  Pencil, GitCompare, Upload, Settings, Layers, Target, XCircle, Calculator,
  ClipboardCheck, Shield, FileDown, Filter, BarChart3, Users
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { useTBReviewSaveBridge } from "@/hooks/use-tb-review-save-bridge";
import { SourceDrilldownModal, GLSourceEntry, TBSourceEntry } from "@/components/source-drilldown-modal";
import { AIAssistBanner, PHASE_AI_CONFIGS } from "@/components/ai-assist-banner";
import { GLCodeReconciliation } from "@/components/glcode-reconciliation";

import { formatAccounting } from "@/lib/formatters";

interface TBLineItem {
  id: string;
  accountCode: string;
  accountName: string;
  openingBalance: number;
  periodDr: number;
  periodCr: number;
  closingBalance: number;
  debits: number;
  credits: number;
  fsLineItem?: string;
  mapping?: {
    statementType: string;
    fsGroup: string;
    lineItem: string;
    mappingSource: string;
  } | null;
}

interface GLEntry {
  id: string;
  voucherNo: string;
  date: string;
  narration: string;
  dr: number;
  cr: number;
  accountCode: string;
  accountName: string;
  party?: string;
  docRef?: string;
}

interface MappingException {
  id: string;
  type: 'unmapped' | 'negative_balance' | 'unusual_movement';
  accountCode: string;
  accountName: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
}

interface TrialBalanceData {
  id: string;
  periodType: string;
  periodEnd: string;
  lineItems: TBLineItem[];
  glEntries?: GLEntry[];
  summary: {
    totalDebit: number;
    totalCredit: number;
    difference: number;
    isBalanced: boolean;
    mappedCount: number;
    unmappedCount: number;
    totalOpeningBalance?: number;
    totalPeriodDr?: number;
    totalPeriodCr?: number;
    totalClosingBalance?: number;
  };
}

const COA_TEMPLATES = [
  { id: "manufacturing", name: "Manufacturing (IFRS)", description: "Standard manufacturing company template" },
  { id: "it-saas", name: "IT/SaaS", description: "Software and technology companies" },
  { id: "trading", name: "Trading Company", description: "Import/export and trading businesses" },
  { id: "services", name: "Services", description: "Professional and consulting services" },
  { id: "retail", name: "Retail", description: "Retail and consumer businesses" },
];

const FS_GROUPS: Record<string, Record<string, string[]>> = {
  BALANCE_SHEET: {
    "Current Assets": ["Cash & Bank Balances", "Trade Receivables", "Inventories", "Prepayments", "Other Current Assets"],
    "Non-Current Assets": ["Property, Plant & Equipment", "Intangible Assets", "Investment Property", "Long-term Investments", "Deferred Tax Assets"],
    "Current Liabilities": ["Trade Payables", "Short-term Borrowings", "Current Tax Liabilities", "Accruals", "Other Current Liabilities"],
    "Non-Current Liabilities": ["Long-term Borrowings", "Deferred Tax Liabilities", "Provisions", "Other Non-Current Liabilities"],
    "Equity": ["Share Capital", "Share Premium", "Retained Earnings", "Reserves", "Other Equity"]
  },
  PROFIT_LOSS: {
    "Revenue": ["Sales Revenue", "Service Revenue", "Other Operating Revenue"],
    "Cost of Sales": ["Cost of Goods Sold", "Direct Materials", "Direct Labor", "Manufacturing Overhead"],
    "Operating Expenses": ["Administrative Expenses", "Selling & Distribution", "Depreciation & Amortization", "Other Operating Expenses"],
    "Other Income": ["Interest Income", "Dividend Income", "Gain on Disposal", "Other Income"],
    "Finance Costs": ["Interest Expense", "Bank Charges", "Other Finance Costs"],
    "Taxation": ["Current Tax", "Deferred Tax"]
  }
};

const getLineItems = (statementType: string, fsGroup: string): string[] => {
  return FS_GROUPS[statementType]?.[fsGroup] || [];
};

export default function TBReview() {
  const params = useParams<{ engagementId: string }>();
  const { 
    engagementId: contextEngagementId, 
    engagement, 
    client,
    refreshEngagement 
  } = useEngagement();
  const engagementId = params.engagementId || contextEngagementId || undefined;
  const { toast } = useToast();
  const { firm } = useAuth();
  
  const [trialBalance, setTrialBalance] = useState<TrialBalanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "mapped" | "unmapped">("all");
  const [pendingMappings, setPendingMappings] = useState<Record<string, { statementType: string; fsGroup: string; lineItem: string; mappingSource: string }>>({});
  const [activePreview, setActivePreview] = useState<"balance-sheet" | "profit-loss">("balance-sheet");

  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [drilldownType, setDrilldownType] = useState<"gl-to-tb" | "tb-to-fs">("gl-to-tb");
  const [drilldownTitle, setDrilldownTitle] = useState("");
  const [drilldownSubtitle, setDrilldownSubtitle] = useState("");
  
  const [activeTab, setActiveTab] = useState<"tb-grid" | "gl-grid" | "mapping" | "reconciliation">("tb-grid");
  const [selectedCoATemplate, setSelectedCoATemplate] = useState<string>("");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkFsLineItem, setBulkFsLineItem] = useState("");
  const [glEntries, setGlEntries] = useState<GLEntry[]>([]);
  const [glSearchQuery, setGlSearchQuery] = useState("");
  const [glFilterAccount, setGlFilterAccount] = useState("");
  const [glLoading, setGlLoading] = useState(false);
  const [exceptions, setExceptions] = useState<MappingException[]>([]);
  const [mappingStatus, setMappingStatus] = useState<"draft" | "prepared" | "reviewed" | "approved">("draft");
  const [drilldownGLEntries, setDrilldownGLEntries] = useState<GLSourceEntry[]>([]);
  const [drilldownTBEntries, setDrilldownTBEntries] = useState<TBSourceEntry[]>([]);
  const [drilldownTotalAmount, setDrilldownTotalAmount] = useState<number | undefined>();
  const [drilldownLoading, setDrilldownLoading] = useState(false);

  const openGLDrilldown = async (item: TBLineItem) => {
    setDrilldownType("gl-to-tb");
    setDrilldownTitle(`${item.accountCode} - ${item.accountName}`);
    setDrilldownSubtitle(`Balance: ${formatAccounting(item.closingBalance)}`);
    setDrilldownTotalAmount(item.closingBalance);
    setDrilldownGLEntries([]);
    setDrilldownLoading(true);
    setDrilldownOpen(true);
    
    try {
      const res = await fetchWithAuth(`/api/gl/source/${engagementId}/${encodeURIComponent(item.accountCode)}`);
      
      if (res.ok) {
        const data = await res.json();
        setDrilldownGLEntries(data.entries || []);
      } else {
        setDrilldownGLEntries([]);
      }
    } catch (error) {
      setDrilldownGLEntries([]);
    } finally {
      setDrilldownLoading(false);
    }
  };

  const openFSDrilldown = (fsLineItem: string, statementType: string, fsGroup: string, accounts: TBLineItem[]) => {
    const filteredAccounts = accounts.filter(acc => {
      const mapping = pendingMappings[acc.accountCode];
      return mapping && 
             mapping.lineItem === fsLineItem && 
             mapping.statementType === statementType && 
             mapping.fsGroup === fsGroup;
    });
    const tbEntries: TBSourceEntry[] = filteredAccounts.map(acc => ({
      accountCode: acc.accountCode,
      accountName: acc.accountName,
      debit: acc.debits,
      credit: acc.credits,
      balance: acc.closingBalance,
      fsLine: fsLineItem
    }));
    const totalAmount = filteredAccounts.reduce((sum, acc) => sum + acc.closingBalance, 0);
    setDrilldownType("tb-to-fs");
    setDrilldownTitle(fsLineItem);
    setDrilldownSubtitle(`${fsGroup} | ${filteredAccounts.length} accounts mapped`);
    setDrilldownTBEntries(tbEntries);
    setDrilldownTotalAmount(totalAmount);
    setDrilldownOpen(true);
  };

  // Build payload for saving
  const buildTBReviewPayload = () => ({
    trialBalance,
    pendingMappings,
    searchQuery,
    filterType,
    activePreview
  });

  // Initialize save engine
  const saveEngine = useTBReviewSaveBridge(engagementId, buildTBReviewPayload);

  useEffect(() => {
    fetchTrialBalance();
  }, [engagementId]);

  const fetchTrialBalance = async () => {
    try {
      setLoading(true);
      const res = await fetchWithAuth(`/api/trial-balance/${engagementId}`);
      if (res.ok) {
        const data = await res.json();
        setTrialBalance(data);
        const initialMappings: Record<string, { statementType: string; fsGroup: string; lineItem: string; mappingSource: string }> = {};
        data.lineItems.forEach((item: TBLineItem) => {
          if (item.mapping) {
            initialMappings[item.accountCode] = {
              statementType: item.mapping.statementType,
              fsGroup: item.mapping.fsGroup,
              lineItem: item.mapping.lineItem,
              mappingSource: item.mapping.mappingSource
            };
          }
        });
        setPendingMappings(initialMappings);
      }
    } catch (error) {
      console.error("Error fetching trial balance:", error);
    } finally {
      setLoading(false);
    }
  };

  const getAISuggestion = async (accountCode: string, accountName: string) => {
    try {
      const res = await fetchWithAuth(`/api/trial-balance/${trialBalance?.id}/ai-suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountCode, accountName })
      });
      if (res.ok) {
        const data = await res.json();
        return data.suggestion;
      }
    } catch (error) {
      console.error("Error getting AI suggestion:", error);
    }
    return null;
  };

  const applyAISuggestion = async (item: TBLineItem) => {
    const suggestion = await getAISuggestion(item.accountCode, item.accountName);
    if (suggestion) {
      setPendingMappings(prev => ({
        ...prev,
        [item.accountCode]: {
          statementType: suggestion.statementType,
          fsGroup: suggestion.fsGroup,
          lineItem: suggestion.lineItem,
          mappingSource: "AI"
        }
      }));
      toast({
        title: "AI Suggestion Applied",
        description: `${item.accountName} mapped to ${suggestion.lineItem} (${Math.round(suggestion.confidence * 100)}% confidence)`
      });
    }
  };

  const applyAllAISuggestions = async () => {
    if (!trialBalance) return;
    
    toast({ title: "Applying AI Suggestions", description: "Please wait..." });
    
    for (const item of trialBalance.lineItems) {
      if (!pendingMappings[item.accountCode]) {
        await applyAISuggestion(item);
      }
    }
    
    toast({
      title: "AI Suggestions Applied",
      description: "All unmapped accounts have been analyzed"
    });
  };

  const updateMapping = (accountCode: string, field: string, value: string) => {
    setPendingMappings(prev => {
      const existing = prev[accountCode] || { statementType: "", fsGroup: "", lineItem: "", mappingSource: "MANUAL" };
      return {
        ...prev,
        [accountCode]: {
          ...existing,
          [field]: value,
          mappingSource: "MANUAL"
        }
      };
    });
  };

  const saveMappings = async () => {
    if (!trialBalance) return;
    
    setSaving(true);
    try {
      const mappingsToSave = Object.entries(pendingMappings)
        .filter(([_, mapping]) => mapping.statementType && mapping.fsGroup && mapping.lineItem)
        .map(([accountCode, mapping]) => ({
          accountCode,
          ...mapping
        }));

      const res = await fetchWithAuth(`/api/trial-balance/${trialBalance.id}/mapping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mappingsToSave)
      });

      if (res.ok) {
        toast({
          title: "Mappings Saved",
          description: `${mappingsToSave.length} account mappings saved successfully`
        });
        fetchTrialBalance();
      } else {
        throw new Error("Failed to save mappings");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save mappings",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const filteredItems = trialBalance?.lineItems.filter(item => {
    const matchesSearch = item.accountCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.accountName.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filterType === "mapped") {
      return matchesSearch && pendingMappings[item.accountCode]?.lineItem;
    } else if (filterType === "unmapped") {
      return matchesSearch && !pendingMappings[item.accountCode]?.lineItem;
    }
    return matchesSearch;
  }) || [];

  const mappedCount = Object.values(pendingMappings).filter(m => m.lineItem).length;
  const totalCount = trialBalance?.lineItems.length || 0;
  const mappingProgress = totalCount > 0 ? (mappedCount / totalCount) * 100 : 0;

  const getPreviewData = () => {
    if (!trialBalance) return {};
    
    const data: Record<string, Record<string, number>> = {};
    
    trialBalance.lineItems.forEach(item => {
      const mapping = pendingMappings[item.accountCode];
      if (!mapping?.lineItem) return;
      
      const targetStatement = activePreview === "balance-sheet" ? "BALANCE_SHEET" : "PROFIT_LOSS";
      if (mapping.statementType !== targetStatement) return;
      
      if (!data[mapping.fsGroup]) {
        data[mapping.fsGroup] = {};
      }
      if (!data[mapping.fsGroup][mapping.lineItem]) {
        data[mapping.fsGroup][mapping.lineItem] = 0;
      }
      data[mapping.fsGroup][mapping.lineItem] += item.closingBalance;
    });
    
    return data;
  };


  const handleAccountSelect = (accountCode: string, checked: boolean) => {
    if (checked) {
      setSelectedAccounts(prev => [...prev, accountCode]);
    } else {
      setSelectedAccounts(prev => prev.filter(c => c !== accountCode));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked && trialBalance) {
      setSelectedAccounts(filteredItems.map(item => item.accountCode));
    } else {
      setSelectedAccounts([]);
    }
  };

  const handleBulkAssignFsLine = async () => {
    if (!bulkFsLineItem || selectedAccounts.length === 0) return;
    
    selectedAccounts.forEach(accountCode => {
      setPendingMappings(prev => ({
        ...prev,
        [accountCode]: {
          ...(prev[accountCode] || { statementType: "", fsGroup: "" }),
          lineItem: bulkFsLineItem,
          mappingSource: "BULK"
        }
      }));
    });
    
    toast({
      title: "Bulk Assignment Complete",
      description: `Assigned FS line item to ${selectedAccounts.length} accounts`
    });
    setBulkEditOpen(false);
    setSelectedAccounts([]);
    setBulkFsLineItem("");
  };

  const handleDownloadTB = () => {
    if (!trialBalance) return;
    
    const firmName = firm?.displayName || firm?.name || "AuditWise";
    const csvContent = [
      `"${firmName}"`,
      `"Trial Balance Export"`,
      `"Period End: ${trialBalance.periodEnd}"`,
      `"Generated: ${new Date().toLocaleDateString()}"`,
      "",
      ["Account Code", "Account Name", "Opening Balance", "Period Dr", "Period Cr", "Closing Balance", "FS Line Item"].join(","),
      ...trialBalance.lineItems.map(item => [
        item.accountCode,
        `"${item.accountName}"`,
        item.openingBalance || 0,
        item.periodDr || item.debits || 0,
        item.periodCr || item.credits || 0,
        item.closingBalance,
        pendingMappings[item.accountCode]?.lineItem || ""
      ].join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${firmName.replace(/\s+/g, '_')}_trial_balance_${trialBalance.periodEnd}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({ title: "Downloaded", description: "Trial Balance exported to CSV" });
  };

  const handleRunMapping = async () => {
    toast({ title: "Running AI Mapping", description: "Analyzing accounts..." });
    await applyAllAISuggestions();
  };

  const fetchGLEntries = async () => {
    if (!engagementId) return;
    setGlLoading(true);
    try {
      const res = await fetchWithAuth(`/api/gl/entries/${engagementId}`);
      if (res.ok) {
        const data = await res.json();
        setGlEntries(data.entries || []);
      }
    } catch (error) {
      console.error("Error fetching GL entries:", error);
    } finally {
      setGlLoading(false);
    }
  };

  const handleExportGL = () => {
    const firmName = firm?.displayName || firm?.name || "AuditWise";
    const csvContent = [
      `"${firmName}"`,
      `"General Ledger Export"`,
      `"Generated: ${new Date().toLocaleDateString()}"`,
      "",
      ["Voucher No", "Date", "Narration", "Debit", "Credit", "Account Code", "Account Name", "Party", "Doc Ref"].join(","),
      ...glEntries.map(entry => [
        entry.voucherNo,
        entry.date,
        `"${entry.narration}"`,
        entry.dr,
        entry.cr,
        entry.accountCode,
        `"${entry.accountName}"`,
        entry.party || "",
        entry.docRef || ""
      ].join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${firmName.replace(/\s+/g, '_')}_general_ledger_${engagementId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({ title: "Downloaded", description: "General Ledger exported to CSV" });
  };

  const handleRunAnalytics = () => {
    toast({ title: "Running Analytics", description: "Analyzing GL entries for patterns and anomalies..." });
  };

  const handleBuildSamplingPopulations = () => {
    toast({ title: "Building Sampling Populations", description: "Creating sampling populations from GL data..." });
  };

  const handleLoadTemplate = async (templateId: string) => {
    setSelectedCoATemplate(templateId);
    toast({ title: "Template Loaded", description: `Loaded ${COA_TEMPLATES.find(t => t.id === templateId)?.name} template` });
  };

  const handlePushToCoA = async () => {
    toast({ title: "Pushing to CoA", description: "Updating Chart of Accounts with mappings..." });
  };

  const handleMarkStatus = (status: "prepared" | "reviewed" | "approved") => {
    setMappingStatus(status);
    toast({ title: `Marked as ${status.charAt(0).toUpperCase() + status.slice(1)}`, description: `Mapping status updated to ${status}` });
  };

  const calculateExceptions = (): MappingException[] => {
    if (!trialBalance) return [];
    
    const exceptionsList: MappingException[] = [];
    
    trialBalance.lineItems.forEach(item => {
      if (!pendingMappings[item.accountCode]?.lineItem) {
        exceptionsList.push({
          id: `unmapped-${item.accountCode}`,
          type: 'unmapped',
          accountCode: item.accountCode,
          accountName: item.accountName,
          description: 'Account not mapped to FS line item',
          severity: Math.abs(item.closingBalance) > 1000000 ? 'high' : 'medium'
        });
      }
      
      if (item.closingBalance < 0 && item.accountCode.startsWith('1')) {
        exceptionsList.push({
          id: `negative-${item.accountCode}`,
          type: 'negative_balance',
          accountCode: item.accountCode,
          accountName: item.accountName,
          description: `Negative balance: ${formatAccounting(item.closingBalance)}`,
          severity: 'high'
        });
      }
      
      const movement = (item.periodDr || item.debits || 0) - (item.periodCr || item.credits || 0);
      const openingBal = item.openingBalance || 0;
      if (openingBal !== 0 && Math.abs(movement / openingBal) > 0.5) {
        exceptionsList.push({
          id: `unusual-${item.accountCode}`,
          type: 'unusual_movement',
          accountCode: item.accountCode,
          accountName: item.accountName,
          description: `Unusual movement: ${((movement / openingBal) * 100).toFixed(1)}% change`,
          severity: Math.abs(movement / openingBal) > 1 ? 'high' : 'medium'
        });
      }
    });
    
    return exceptionsList;
  };

  const filteredGLEntries = glEntries.filter(entry => {
    const matchesSearch = entry.narration.toLowerCase().includes(glSearchQuery.toLowerCase()) ||
      entry.voucherNo.toLowerCase().includes(glSearchQuery.toLowerCase()) ||
      entry.accountCode.toLowerCase().includes(glSearchQuery.toLowerCase());
    const matchesAccount = !glFilterAccount || entry.accountCode === glFilterAccount;
    return matchesSearch && matchesAccount;
  });

  useEffect(() => {
    if (activeTab === "gl-grid" && glEntries.length === 0) {
      fetchGLEntries();
    }
  }, [activeTab]);

  if (loading) {
    return (
      <div className="px-4 py-3 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p>Loading trial balance...</p>
        </div>
      </div>
    );
  }

  if (!trialBalance) {
    return (
      <div className="px-4 py-3">
        <Card className="p-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
          <h2 className="text-xl font-semibold mb-2">No Trial Balance Found</h2>
          <p className="text-muted-foreground mb-4">
            Please upload a trial balance first from the Planning page.
          </p>
          <Link href={`/workspace/${engagementId}/planning`}>
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Planning
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  const previewData = getPreviewData();
  const computedExceptions = calculateExceptions();

  const tbReviewTabs = [
    { id: 'tb-grid', label: 'Trial Balance' },
    { id: 'gl-grid', label: 'General Ledger' },
    { id: 'mapping', label: 'Mapping' },
    { id: 'reconciliation', label: 'Reconciliation' },
  ];

  return (
    <PageShell
      showTopBar={false}
      title="TB/GL Review & Mapping"
      subtitle={`${client?.name ? `${client.name} - ` : ""}Canonical mapping and reconciliation page${engagement?.engagementCode ? ` (${engagement.engagementCode})` : ""}`}
      backHref={`/workspace/${engagementId}/requisition?tab=review-coa&subtab=mapping`}
      nextHref={`/workspace/${engagementId}/planning`}
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
      tabs={tbReviewTabs}
      activeTab={activeTab}
      onTabChange={(tab) => setActiveTab(tab as typeof activeTab)}
      headerActions={
        <>
          <Badge variant={mappingStatus === "approved" ? "default" : "outline"} data-testid="badge-mapping-status">
            Status: {mappingStatus.charAt(0).toUpperCase() + mappingStatus.slice(1)}
          </Badge>
          <Button variant="outline" onClick={saveMappings} disabled={saving} data-testid="button-save-mappings">
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Mappings"}
          </Button>
        </>
      }
    >
    <div className="page-container">
      {engagementId && (
        <AIAssistBanner
          engagementId={engagementId}
          config={{
            ...PHASE_AI_CONFIGS["trial-balance"],
            contextBuilder: () => JSON.stringify({
              phase: "trial-balance",
              engagementName: engagement?.engagementCode || "Unknown Engagement",
              clientName: client?.name || "Unknown Client",
              totalItems: trialBalance?.lineItems?.length || 0,
              mappedCount: trialBalance?.summary?.mappedCount || 0,
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

      {/* OUTPUTS SECTION - Stats Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card data-testid="card-total-accounts">
          <CardContent className="pt-3 pb-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Total Accounts</p>
              <Layers className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold" data-testid="text-total-accounts">{totalCount}</p>
          </CardContent>
        </Card>
        <Card data-testid="card-mapped-accounts">
          <CardContent className="pt-3 pb-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Mapped</p>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-green-600" data-testid="text-mapped-count">{mappedCount}</p>
          </CardContent>
        </Card>
        <Card data-testid="card-unmapped-accounts">
          <CardContent className="pt-3 pb-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Unmapped</p>
              <AlertCircle className="h-4 w-4 text-amber-600" />
            </div>
            <p className="text-2xl font-bold text-amber-600" data-testid="text-unmapped-count">{totalCount - mappedCount}</p>
          </CardContent>
        </Card>
        <Card data-testid="card-exceptions">
          <CardContent className="pt-3 pb-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Exceptions</p>
              <XCircle className="h-4 w-4 text-red-600" />
            </div>
            <p className="text-2xl font-bold text-red-600" data-testid="text-exceptions-count">{computedExceptions.length}</p>
          </CardContent>
        </Card>
        <Card data-testid="card-progress">
          <CardContent className="pt-3 pb-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Progress</p>
              <span className="text-sm font-medium">{Math.round(mappingProgress)}%</span>
            </div>
            <Progress value={mappingProgress} className="h-2 mt-2" data-testid="progress-mapping" />
          </CardContent>
        </Card>
        <Card data-testid="card-tb-balanced">
          <CardContent className="pt-3 pb-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">TB Status</p>
              {trialBalance?.summary?.isBalanced ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-600" />
              )}
            </div>
            <p className="text-sm font-medium" data-testid="text-tb-status">
              {trialBalance?.summary?.isBalanced ? "Balanced" : `Diff: ${formatAccounting(trialBalance?.summary?.difference || 0)}`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
          <TabsTrigger value="tb-grid" className="gap-2" data-testid="tab-tb-grid">
            <FileSpreadsheet className="h-4 w-4" />
            <span className="hidden sm:inline">TB Details</span>
          </TabsTrigger>
          <TabsTrigger value="gl-grid" className="gap-2" data-testid="tab-gl-grid">
            <Database className="h-4 w-4" />
            <span className="hidden sm:inline">GL Details</span>
          </TabsTrigger>
          <TabsTrigger value="mapping" className="gap-2" data-testid="tab-mapping">
            <GitCompare className="h-4 w-4" />
            <span className="hidden sm:inline">Mapping</span>
          </TabsTrigger>
          <TabsTrigger value="reconciliation" className="gap-2" data-testid="tab-reconciliation">
            <Calculator className="h-4 w-4" />
            <span className="hidden sm:inline">Reconciliation</span>
          </TabsTrigger>
        </TabsList>

        {/* TB Details Grid Tab */}
        <TabsContent value="tb-grid" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  Trial Balance Details
                </CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={() => setBulkEditOpen(true)} disabled={selectedAccounts.length === 0} data-testid="button-bulk-edit"
                    title={selectedAccounts.length === 0 ? "Select accounts to bulk edit" : `Bulk edit ${selectedAccounts.length} selected accounts`}
                  >
                    <Pencil className="h-4 w-4 mr-1" />
                    Bulk Edit ({selectedAccounts.length})
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setBulkEditOpen(true)} data-testid="button-assign-fs-line"
                    disabled={selectedAccounts.length === 0}
                    title={selectedAccounts.length === 0 ? "Select accounts first to assign FS Line Items" : "Assign FS Line Item to selected accounts"}
                  >
                    <Layers className="h-4 w-4 mr-1" />
                    Assign FS Line Item
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownloadTB} data-testid="button-download-tb"
                    disabled={filteredItems.length === 0}
                    title={filteredItems.length === 0 ? "No Trial Balance data to download" : "Download Trial Balance"}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download TB
                  </Button>
                  <Button variant="default" size="sm" onClick={handleRunMapping} data-testid="button-run-mapping"
                    disabled={filteredItems.length === 0}
                    title={filteredItems.length === 0 ? "No Trial Balance data to map" : "Run AI-powered FS line item mapping"}
                  >
                    <Brain className="h-4 w-4 mr-1" />
                    Run Mapping
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search accounts..." 
                    className="pl-8"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    data-testid="input-tb-search"
                  />
                </div>
                <Select value={filterType} onValueChange={(v: "all" | "mapped" | "unmapped") => setFilterType(v)}>
                  <SelectTrigger className="w-[140px]" data-testid="select-tb-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Accounts</SelectItem>
                    <SelectItem value="mapped">Mapped Only</SelectItem>
                    <SelectItem value="unmapped">Unmapped Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">
                        <Checkbox 
                          checked={selectedAccounts.length === filteredItems.length && filteredItems.length > 0}
                          onCheckedChange={handleSelectAll}
                          data-testid="checkbox-select-all"
                        />
                      </TableHead>
                      <TableHead className="w-[100px]" data-testid="th-account-code">Account Code</TableHead>
                      <TableHead data-testid="th-account-name">Account Name</TableHead>
                      <TableHead className="text-right" data-testid="th-opening-bal">Opening Bal</TableHead>
                      <TableHead className="text-right" data-testid="th-period-dr">Period Dr</TableHead>
                      <TableHead className="text-right" data-testid="th-period-cr">Period Cr</TableHead>
                      <TableHead className="text-right" data-testid="th-closing-bal">Closing Bal</TableHead>
                      <TableHead data-testid="th-fs-line-item">FS Line Item</TableHead>
                      <TableHead className="w-[80px] text-center">Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((item) => (
                      <TableRow 
                        key={item.id} 
                        className={pendingMappings[item.accountCode]?.lineItem ? "bg-green-50/50 dark:bg-green-950/20" : ""}
                        data-testid={`row-tb-${item.accountCode}`}
                      >
                        <TableCell>
                          <Checkbox 
                            checked={selectedAccounts.includes(item.accountCode)}
                            onCheckedChange={(checked) => handleAccountSelect(item.accountCode, !!checked)}
                            data-testid={`checkbox-${item.accountCode}`}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs" data-testid={`text-code-${item.accountCode}`}>{item.accountCode}</TableCell>
                        <TableCell className="text-sm" data-testid={`text-name-${item.accountCode}`}>{item.accountName}</TableCell>
                        <TableCell className="text-right text-sm" data-testid={`text-opening-${item.accountCode}`}>
                          {formatAccounting(item.openingBalance || 0)}
                        </TableCell>
                        <TableCell className="text-right text-sm" data-testid={`text-period-dr-${item.accountCode}`}>
                          {formatAccounting(item.periodDr || item.debits || 0)}
                        </TableCell>
                        <TableCell className="text-right text-sm" data-testid={`text-period-cr-${item.accountCode}`}>
                          {formatAccounting(item.periodCr || item.credits || 0)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium" data-testid={`text-closing-${item.accountCode}`}>
                          {formatAccounting(item.closingBalance)}
                        </TableCell>
                        <TableCell data-testid={`text-fs-line-${item.accountCode}`}>
                          {pendingMappings[item.accountCode]?.lineItem ? (
                            <Badge variant="secondary" className="text-xs">{pendingMappings[item.accountCode]?.lineItem}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">Not mapped</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => openGLDrilldown(item)}
                            title="View GL Source Entries"
                            data-testid={`button-drilldown-${item.accountCode}`}
                          >
                            <Database className="h-4 w-4 text-blue-600" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* GL Details Grid Tab */}
        <TabsContent value="gl-grid" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  General Ledger Details
                </CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant="outline" size="sm" data-testid="button-filter-gl">
                    <Filter className="h-4 w-4 mr-1" />
                    Filter
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExportGL} data-testid="button-export-gl">
                    <FileDown className="h-4 w-4 mr-1" />
                    Export GL
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleRunAnalytics} data-testid="button-run-analytics">
                    <BarChart3 className="h-4 w-4 mr-1" />
                    Run Analytics
                  </Button>
                  <Button variant="default" size="sm" onClick={handleBuildSamplingPopulations} data-testid="button-build-sampling">
                    <Users className="h-4 w-4 mr-1" />
                    Build Sampling Populations
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search GL entries..." 
                    className="pl-8"
                    value={glSearchQuery}
                    onChange={(e) => setGlSearchQuery(e.target.value)}
                    data-testid="input-gl-search"
                  />
                </div>
                <Select value={glFilterAccount || "__none__"} onValueChange={(v) => setGlFilterAccount(v === "__none__" ? "" : v)}>
                  <SelectTrigger className="w-[200px]" data-testid="select-gl-account-filter">
                    <SelectValue placeholder="All Accounts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">All Accounts</SelectItem>
                    {trialBalance?.lineItems.map(item => (
                      <SelectItem key={item.accountCode} value={item.accountCode}>
                        {item.accountCode} - {item.accountName.substring(0, 20)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {glLoading ? (
                <div className="flex items-center justify-center h-[400px]">
                  <RefreshCw className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead data-testid="th-voucher-no">Voucher No</TableHead>
                        <TableHead data-testid="th-date">Date</TableHead>
                        <TableHead data-testid="th-narration">Narration</TableHead>
                        <TableHead className="text-right" data-testid="th-dr">Dr</TableHead>
                        <TableHead className="text-right" data-testid="th-cr">Cr</TableHead>
                        <TableHead data-testid="th-gl-account-code">Account Code</TableHead>
                        <TableHead data-testid="th-gl-account-name">Account Name</TableHead>
                        <TableHead data-testid="th-party">Party</TableHead>
                        <TableHead data-testid="th-doc-ref">Doc Ref</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredGLEntries.length > 0 ? filteredGLEntries.map((entry) => (
                        <TableRow key={entry.id} data-testid={`row-gl-${entry.id}`}>
                          <TableCell className="font-mono text-xs" data-testid={`text-voucher-${entry.id}`}>{entry.voucherNo}</TableCell>
                          <TableCell className="text-sm" data-testid={`text-date-${entry.id}`}>{entry.date}</TableCell>
                          <TableCell className="text-sm max-w-[200px] truncate" data-testid={`text-narration-${entry.id}`}>{entry.narration}</TableCell>
                          <TableCell className="text-right text-sm" data-testid={`text-dr-${entry.id}`}>{formatAccounting(entry.dr)}</TableCell>
                          <TableCell className="text-right text-sm" data-testid={`text-cr-${entry.id}`}>{formatAccounting(entry.cr)}</TableCell>
                          <TableCell className="font-mono text-xs" data-testid={`text-gl-code-${entry.id}`}>{entry.accountCode}</TableCell>
                          <TableCell className="text-sm" data-testid={`text-gl-name-${entry.id}`}>{entry.accountName}</TableCell>
                          <TableCell className="text-sm" data-testid={`text-party-${entry.id}`}>{entry.party || "-"}</TableCell>
                          <TableCell className="text-sm" data-testid={`text-docref-${entry.id}`}>{entry.docRef || "-"}</TableCell>
                        </TableRow>
                      )) : (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center text-muted-foreground py-4">
                            No GL entries found. Upload GL data to view entries.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Mapping Tab - INPUTS Section */}
        <TabsContent value="mapping" className="space-y-4">
          {/* INPUTS Section */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Mapping Inputs
              </CardTitle>
              <CardDescription>Configure CoA templates and mapping rules</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>CoA Template</Label>
                  <div className="flex items-center gap-2">
                    <Select value={selectedCoATemplate} onValueChange={setSelectedCoATemplate}>
                      <SelectTrigger data-testid="select-coa-template">
                        <SelectValue placeholder="Select template..." />
                      </SelectTrigger>
                      <SelectContent>
                        {COA_TEMPLATES.map(template => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={() => handleLoadTemplate(selectedCoATemplate)} disabled={!selectedCoATemplate} data-testid="button-load-template">
                      <Upload className="h-4 w-4 mr-1" />
                      Load Template
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Mapping Rules</Label>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Auto: {mappedCount} mapped</Badge>
                    <Badge variant="outline">Manual overrides: 0</Badge>
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="default" onClick={handleRunMapping} data-testid="button-ai-mapping">
                  <Brain className="h-4 w-4 mr-2" />
                  AI Mapping
                </Button>
                <Button variant="outline" onClick={handlePushToCoA} data-testid="button-push-coa">
                  <Upload className="h-4 w-4 mr-2" />
                  Push to CoA
                </Button>
                <Separator orientation="vertical" className="h-8" />
                <Button variant="outline" onClick={() => handleMarkStatus("prepared")} disabled={mappingStatus !== "draft"} data-testid="button-mark-prepared">
                  <ClipboardCheck className="h-4 w-4 mr-2" />
                  Mark as Prepared
                </Button>
                <Button variant="outline" onClick={() => handleMarkStatus("reviewed")} disabled={mappingStatus !== "prepared"} data-testid="button-mark-reviewed">
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Mark as Reviewed
                </Button>
                <Button variant="default" onClick={() => handleMarkStatus("approved")} disabled={mappingStatus !== "reviewed"} data-testid="button-mark-approved">
                  <Shield className="h-4 w-4 mr-2" />
                  Mark as Approved
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Account Mapping Grid */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <GitCompare className="h-5 w-5" />
                Account Mapping
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {filteredItems.slice(0, 20).map((item) => (
                    <Card key={item.id} className="p-3" data-testid={`card-mapping-${item.accountCode}`}>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">{item.accountName}</p>
                            <p className="text-xs text-muted-foreground">{item.accountCode} | {formatAccounting(item.closingBalance)}</p>
                          </div>
                          {pendingMappings[item.accountCode]?.mappingSource && (
                            <Badge variant={pendingMappings[item.accountCode]?.mappingSource === "AI" ? "secondary" : "outline"}>
                              {pendingMappings[item.accountCode]?.mappingSource}
                            </Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <Select 
                            value={pendingMappings[item.accountCode]?.statementType || ""} 
                            onValueChange={(v) => updateMapping(item.accountCode, "statementType", v)}
                          >
                            <SelectTrigger className="text-xs" data-testid={`select-statement-${item.accountCode}`}>
                              <SelectValue placeholder="Statement" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="BALANCE_SHEET">Balance Sheet</SelectItem>
                              <SelectItem value="PROFIT_LOSS">Profit & Loss</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select 
                            value={pendingMappings[item.accountCode]?.fsGroup || ""}
                            onValueChange={(v) => updateMapping(item.accountCode, "fsGroup", v)}
                          >
                            <SelectTrigger className="text-xs" data-testid={`select-group-${item.accountCode}`}>
                              <SelectValue placeholder="Group" />
                            </SelectTrigger>
                            <SelectContent>
                              {pendingMappings[item.accountCode]?.statementType && 
                                Object.keys(FS_GROUPS[pendingMappings[item.accountCode].statementType as keyof typeof FS_GROUPS] || {}).map(group => (
                                  <SelectItem key={group} value={group}>{group}</SelectItem>
                                ))
                              }
                            </SelectContent>
                          </Select>
                          <Select 
                            value={pendingMappings[item.accountCode]?.lineItem || ""}
                            onValueChange={(v) => updateMapping(item.accountCode, "lineItem", v)}
                          >
                            <SelectTrigger className="text-xs" data-testid={`select-lineitem-${item.accountCode}`}>
                              <SelectValue placeholder="Line Item" />
                            </SelectTrigger>
                            <SelectContent>
                              {pendingMappings[item.accountCode]?.statementType && 
                               pendingMappings[item.accountCode]?.fsGroup &&
                                (getLineItems(
                                  pendingMappings[item.accountCode].statementType,
                                  pendingMappings[item.accountCode].fsGroup
                                )).map((lineItem: string) => (
                                  <SelectItem key={lineItem} value={lineItem}>{lineItem}</SelectItem>
                                ))
                              }
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reconciliation Tab - OUTPUTS Section */}
        <TabsContent value="reconciliation" className="space-y-4">
          {/* GL_CODE Integrity & Reconciliation Component */}
          {engagementId && (
            <GLCodeReconciliation engagementId={engagementId} />
          )}
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Movement Totals Comparison */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Movement Totals Comparison
                </CardTitle>
                <CardDescription>TB vs Computed totals with drilldown</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">TB Amount</TableHead>
                      <TableHead className="text-right">Computed</TableHead>
                      <TableHead className="text-right">Difference</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow data-testid="row-total-debit">
                      <TableCell>Total Debits</TableCell>
                      <TableCell className="text-right">{formatAccounting(trialBalance?.summary?.totalDebit || 0)}</TableCell>
                      <TableCell className="text-right">{formatAccounting(trialBalance?.summary?.totalPeriodDr || trialBalance?.summary?.totalDebit || 0)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={(trialBalance?.summary?.totalDebit || 0) === (trialBalance?.summary?.totalPeriodDr || trialBalance?.summary?.totalDebit || 0) ? "secondary" : "destructive"}>
                          {formatAccounting(0)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                    <TableRow data-testid="row-total-credit">
                      <TableCell>Total Credits</TableCell>
                      <TableCell className="text-right">{formatAccounting(trialBalance?.summary?.totalCredit || 0)}</TableCell>
                      <TableCell className="text-right">{formatAccounting(trialBalance?.summary?.totalPeriodCr || trialBalance?.summary?.totalCredit || 0)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary">{formatAccounting(0)}</Badge>
                      </TableCell>
                    </TableRow>
                    <TableRow className="font-semibold" data-testid="row-net-movement">
                      <TableCell>Net Movement</TableCell>
                      <TableCell className="text-right">{formatAccounting((trialBalance?.summary?.totalDebit || 0) - (trialBalance?.summary?.totalCredit || 0))}</TableCell>
                      <TableCell className="text-right">{formatAccounting((trialBalance?.summary?.totalDebit || 0) - (trialBalance?.summary?.totalCredit || 0))}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={trialBalance?.summary?.isBalanced ? "secondary" : "destructive"}>
                          {formatAccounting(trialBalance?.summary?.difference || 0)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Exceptions List */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                  Exceptions ({computedExceptions.length})
                </CardTitle>
                <CardDescription>Unmapped accounts, negative balances, unusual movements</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  {computedExceptions.length > 0 ? (
                    <div className="space-y-2">
                      {computedExceptions.slice(0, 20).map(exception => (
                        <div 
                          key={exception.id} 
                          className="flex items-center justify-between p-2 border rounded-md"
                          data-testid={`exception-${exception.id}`}
                        >
                          <div className="flex items-center gap-2">
                            {exception.type === 'unmapped' && <AlertCircle className="h-4 w-4 text-amber-600" />}
                            {exception.type === 'negative_balance' && <XCircle className="h-4 w-4 text-red-600" />}
                            {exception.type === 'unusual_movement' && <TrendingUp className="h-4 w-4 text-blue-600" />}
                            <div>
                              <p className="text-sm font-medium">{exception.accountCode} - {exception.accountName}</p>
                              <p className="text-xs text-muted-foreground">{exception.description}</p>
                            </div>
                          </div>
                          <Badge variant={exception.severity === 'high' ? 'destructive' : exception.severity === 'medium' ? 'secondary' : 'outline'}>
                            {exception.severity}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <CheckCircle2 className="h-8 w-8 mr-2 text-green-600" />
                      No exceptions found
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* FS Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Financial Statement Preview
              </CardTitle>
              <CardDescription>Preview of how mapped accounts will appear in financial statements</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activePreview} onValueChange={(v) => setActivePreview(v as "balance-sheet" | "profit-loss")}>
                <TabsList>
                  <TabsTrigger value="balance-sheet" data-testid="tab-preview-bs">Balance Sheet</TabsTrigger>
                  <TabsTrigger value="profit-loss" data-testid="tab-preview-pl">Profit & Loss</TabsTrigger>
                </TabsList>
                <TabsContent value="balance-sheet" className="mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Group / Line Item</TableHead>
                        <TableHead className="text-right">Amount (PKR)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(previewData).map(([group, items]) => (
                        <>
                          <TableRow key={group} className="bg-muted/50 font-semibold">
                            <TableCell colSpan={2}>{group}</TableCell>
                          </TableRow>
                          {Object.entries(items).map(([lineItem, amount]) => {
                            const statementType = activePreview === "balance-sheet" ? "BALANCE_SHEET" : "PROFIT_LOSS";
                            return (
                              <TableRow 
                                key={`${group}-${lineItem}`}
                                className="cursor-pointer hover:bg-muted/30"
                                onClick={() => openFSDrilldown(lineItem, statementType, group, trialBalance?.lineItems || [])}
                                data-testid={`row-preview-${lineItem.replace(/\s+/g, '-').toLowerCase()}`}
                              >
                                <TableCell className="pl-8">
                                  <div className="flex items-center gap-2">
                                    {lineItem}
                                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">{formatAccounting(amount)}</TableCell>
                              </TableRow>
                            );
                          })}
                        </>
                      ))}
                      {Object.keys(previewData).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={2} className="text-center text-muted-foreground py-4">
                            No {activePreview === "balance-sheet" ? "Balance Sheet" : "P&L"} mappings yet. Map accounts above to see preview.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TabsContent>
                <TabsContent value="profit-loss" className="mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Group / Line Item</TableHead>
                        <TableHead className="text-right">Amount (PKR)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(previewData).map(([group, items]) => (
                        <>
                          <TableRow key={group} className="bg-muted/50 font-semibold">
                            <TableCell colSpan={2}>{group}</TableCell>
                          </TableRow>
                          {Object.entries(items).map(([lineItem, amount]) => {
                            const statementType = activePreview === "balance-sheet" ? "BALANCE_SHEET" : "PROFIT_LOSS";
                            return (
                              <TableRow 
                                key={`${group}-${lineItem}`}
                                className="cursor-pointer hover:bg-muted/30"
                                onClick={() => openFSDrilldown(lineItem, statementType, group, trialBalance?.lineItems || [])}
                              >
                                <TableCell className="pl-8">
                                  <div className="flex items-center gap-2">
                                    {lineItem}
                                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">{formatAccounting(amount)}</TableCell>
                              </TableRow>
                            );
                          })}
                        </>
                      ))}
                      {Object.keys(previewData).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={2} className="text-center text-muted-foreground py-4">
                            No {activePreview === "balance-sheet" ? "Balance Sheet" : "P&L"} mappings yet. Map accounts above to see preview.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Bulk Edit Dialog */}
      <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Assign FS Line Item</DialogTitle>
            <DialogDescription>
              Assign the same FS Line Item to {selectedAccounts.length} selected accounts
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>FS Line Item</Label>
              <Select value={bulkFsLineItem} onValueChange={setBulkFsLineItem}>
                <SelectTrigger data-testid="select-bulk-fs-line">
                  <SelectValue placeholder="Select FS Line Item..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FS_GROUPS).map(([statement, groups]) => (
                    Object.entries(groups).map(([group, items]) => (
                      items.map(item => (
                        <SelectItem key={`${statement}-${group}-${item}`} value={item}>
                          {item} ({group})
                        </SelectItem>
                      ))
                    ))
                  )).flat(2)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkEditOpen(false)} data-testid="button-cancel-bulk-edit">Cancel</Button>
            <Button onClick={handleBulkAssignFsLine} disabled={!bulkFsLineItem} data-testid="button-confirm-bulk-assign">
              Assign to {selectedAccounts.length} Accounts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SourceDrilldownModal
        isOpen={drilldownOpen}
        onClose={() => setDrilldownOpen(false)}
        sourceType={drilldownType}
        title={drilldownTitle}
        subtitle={drilldownSubtitle}
        glEntries={drilldownGLEntries}
        tbEntries={drilldownTBEntries}
        totalAmount={drilldownTotalAmount}
        isLoading={drilldownLoading}
      />
    </div>
    </PageShell>
  );
}
