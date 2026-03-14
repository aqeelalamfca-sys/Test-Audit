import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { formatAccounting } from "@/lib/formatters";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useAuth } from "@/lib/auth";
import {
  FileSpreadsheet,
  FileText,
  Download,
  Save,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  CheckCircle2,
  Info,
  Scale,
  TrendingUp,
  TrendingDown,
  Landmark,
  Loader2,
  Calendar,
  History,
  DollarSign,
  Users,
  Wallet,
  ArrowRightLeft,
  Filter,
  X,
  Link2,
  Building2,
  PieChart,
  BarChart3,
  Banknote,
  Receipt,
  CircleDollarSign,
  Layers
} from "lucide-react";

interface FSAccount {
  accountCode: string;
  accountName: string;
  nature: string;
  originalAmount: number;
  adjustedAmount: number;
  adjustments: number;
  isUnmapped: boolean;
}

interface FSLineItem {
  fsLineItem: string;
  displayName: string;
  accounts: FSAccount[];
  originalTotal: number;
  adjustedTotal: number;
  adjustmentsTotal: number;
  accountCount: number;
}

interface FSSection {
  sectionName: string;
  displayOrder: number;
  isSubtotal: boolean;
  lineItems: FSLineItem[];
  sectionOriginalTotal: number;
  sectionAdjustedTotal: number;
}

interface FSData {
  balanceSheet: {
    sections: FSSection[];
    totalAssets: number;
    totalEquityLiabilities: number;
    isBalanced: boolean;
    variance: number;
  };
  profitLoss: {
    sections: FSSection[];
    revenue: number;
    expenses: number;
    netProfit: number;
  };
  unmappedAccounts: Array<{
    accountCode: string;
    accountName: string;
    closingBalance: number;
    nature: string;
  }>;
  summary: {
    totalMappedAccounts: number;
    totalUnmappedAccounts: number;
    mappingCompleteness: number;
    generatedAt: string;
  };
}

interface DrilldownData {
  fsLineItem: string;
  displayName: string;
  accounts: Array<{
    glCode: string;
    glName: string;
    opening: number;
    periodDr: number;
    periodCr: number;
    closing: number;
    net: number;
  }>;
  population: Array<{
    postingDate: string;
    voucherNo: string;
    glCode: string;
    partyId: string | null;
    narrative: string | null;
    debit: number;
    credit: number;
    net: number;
    sourceModule: string | null;
  }>;
  mapping: {
    fsHead: string;
    class: string | null;
    subClass: string | null;
    mappedGlCount: number;
  };
  totals: {
    accountsTotal: number;
    populationCount: number;
    populationDr: number;
    populationCr: number;
    populationNet: number;
  };
  pagination?: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
}

interface FSSnapshot {
  id: string;
  snapshotName: string;
  snapshotType: string;
  version: number;
  createdAt: string;
  createdBy?: { fullName: string };
}

interface FSDraftGeneratorProps {
  engagementId: string;
}

const formatCurrency = (num: number) => {
  if (num === 0) return '—';
  const abs = Math.abs(num);
  const formatted = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(abs);
  return num < 0 ? `(${formatted})` : formatted;
};

function SummaryCard({ icon: Icon, label, value, accent, subtitle }: {
  icon: any;
  label: string;
  value: number;
  accent: string;
  subtitle?: string;
}) {
  const accentStyles: Record<string, string> = {
    blue: "from-blue-500/10 to-blue-600/5 border-blue-200 dark:border-blue-800/50",
    emerald: "from-emerald-500/10 to-emerald-600/5 border-emerald-200 dark:border-emerald-800/50",
    amber: "from-amber-500/10 to-amber-600/5 border-amber-200 dark:border-amber-800/50",
    green: "from-green-500/10 to-green-600/5 border-green-200 dark:border-green-800/50",
    red: "from-red-500/10 to-red-600/5 border-red-200 dark:border-red-800/50",
    violet: "from-violet-500/10 to-violet-600/5 border-violet-200 dark:border-violet-800/50",
  };
  const iconColors: Record<string, string> = {
    blue: "text-blue-600 dark:text-blue-400",
    emerald: "text-emerald-600 dark:text-emerald-400",
    amber: "text-amber-600 dark:text-amber-400",
    green: "text-green-600 dark:text-green-400",
    red: "text-red-600 dark:text-red-400",
    violet: "text-violet-600 dark:text-violet-400",
  };
  const valueColors: Record<string, string> = {
    blue: "text-blue-700 dark:text-blue-300",
    emerald: "text-emerald-700 dark:text-emerald-300",
    amber: "text-amber-700 dark:text-amber-300",
    green: "text-green-700 dark:text-green-300",
    red: "text-red-700 dark:text-red-300",
    violet: "text-violet-700 dark:text-violet-300",
  };

  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-gradient-to-br p-2.5 transition-all hover:shadow-md ${accentStyles[accent] || accentStyles.blue}`}
      data-testid={`summary-card-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className={`text-lg font-bold font-mono tabular-nums ${valueColors[accent] || ''}`}>
            {formatCurrency(value)}
          </p>
          {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
        </div>
        <div className={`rounded-lg bg-background/80 p-2 shadow-sm ${iconColors[accent] || ''}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function StatementSection({
  section,
  statementType,
  viewType,
  isExpanded,
  onToggle,
  onAmountClick,
  depth = 0,
}: {
  section: FSSection;
  statementType: "bs" | "pl";
  viewType: "ADJUSTED" | "ORIGINAL";
  isExpanded: boolean;
  onToggle: () => void;
  onAmountClick: (fsLineItem: string) => void;
  depth?: number;
}) {
  const displayTotal = viewType === "ADJUSTED" ? section.sectionAdjustedTotal : section.sectionOriginalTotal;

  if (section.isSubtotal) {
    return (
      <div
        className="flex items-center justify-between px-3 py-2.5 bg-muted/40 border-t-2 border-b border-foreground/10"
        data-testid={`subtotal-${statementType}-${section.sectionName.toLowerCase().replace(/\s+/g, "-")}`}
      >
        <span className="font-bold text-sm tracking-tight">{section.sectionName}</span>
        <span className="font-mono font-bold text-sm border-b-2 border-double border-foreground/60 pb-0.5 px-1">
          {formatCurrency(displayTotal)}
        </span>
      </div>
    );
  }

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <CollapsibleTrigger
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/30 transition-colors group"
        data-testid={`section-trigger-${statementType}-${section.sectionName.toLowerCase().replace(/\s+/g, "-")}`}
      >
        <div className="flex items-center gap-2">
          <div className="w-4 flex justify-center">
            {isExpanded
              ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform" />
              : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition-transform" />
            }
          </div>
          <span className="font-semibold text-sm">{section.sectionName}</span>
          <Badge variant="outline" className="text-[10px] h-4 px-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
            {section.lineItems.reduce((sum, li) => sum + li.accountCount, 0)} accts
          </Badge>
        </div>
        <span className="font-mono font-semibold text-sm border-b border-foreground/20 pb-0.5 px-1">
          {formatCurrency(displayTotal)}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-l-2 border-primary/10 ml-6">
          {section.lineItems.length === 0 ? (
            <div className="px-3 py-3 text-muted-foreground text-xs italic">No accounts mapped to this section</div>
          ) : (
            section.lineItems.map((lineItem) => {
              const displayLineTotal = viewType === "ADJUSTED" ? lineItem.adjustedTotal : lineItem.originalTotal;
              return (
                <div
                  key={lineItem.fsLineItem}
                  className="flex items-center justify-between pl-4 pr-4 py-2 hover:bg-accent/30 transition-colors group/line"
                  data-testid={`line-item-${statementType}-${lineItem.fsLineItem.toLowerCase()}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm text-foreground/80">{lineItem.displayName}</span>
                    <span className="text-[10px] text-muted-foreground font-mono opacity-0 group-hover/line:opacity-100 transition-opacity">
                      ({lineItem.accountCount})
                    </span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); onAmountClick(lineItem.fsLineItem); }}
                    className="font-mono text-sm text-primary/80 hover:text-primary hover:underline decoration-dashed cursor-pointer transition-colors tabular-nums"
                    data-testid={`amount-click-${lineItem.fsLineItem.toLowerCase()}`}
                  >
                    {formatCurrency(displayLineTotal)}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function FSDraftGenerator({ engagementId }: FSDraftGeneratorProps) {
  const { toast } = useToast();
  const { firm } = useAuth();
  const [viewType, setViewType] = useState<"ADJUSTED" | "ORIGINAL">("ADJUSTED");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [snapshotName, setSnapshotName] = useState("");
  const [snapshotType, setSnapshotType] = useState<"UNADJUSTED" | "ADJUSTED" | "FINAL">("ADJUSTED");
  const [activeStatement, setActiveStatement] = useState<"bs" | "pl">("bs");

  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [selectedLineItem, setSelectedLineItem] = useState<string | null>(null);
  const [drilldownTab, setDrilldownTab] = useState<"accounts" | "population" | "mapping">("accounts");
  const [populationPage, setPopulationPage] = useState(1);
  const [populationFilters, setPopulationFilters] = useState<{
    dateFrom: string;
    dateTo: string;
    minAmount: string;
    maxAmount: string;
    party: string;
  }>({ dateFrom: "", dateTo: "", minAmount: "", maxAmount: "", party: "" });
  const [showFilters, setShowFilters] = useState(false);

  const { data: fsData, isLoading, refetch } = useQuery<FSData>({
    queryKey: ["/api/fs-draft", engagementId, viewType],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/fs-draft/${engagementId}?viewType=${viewType}`);
      if (!res.ok) throw new Error("Failed to fetch FS data");
      return res.json();
    },
    enabled: !!engagementId
  });

  const { data: snapshots } = useQuery<FSSnapshot[]>({
    queryKey: ["/api/fs-draft", engagementId, "snapshots"],
    enabled: !!engagementId
  });

  const { data: drilldownData, isLoading: drilldownLoading } = useQuery<DrilldownData>({
    queryKey: ["/api/fs-draft", engagementId, "drilldown", selectedLineItem, populationPage, populationFilters],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: populationPage.toString(),
        limit: "50"
      });
      if (populationFilters.dateFrom) params.append("dateFrom", populationFilters.dateFrom);
      if (populationFilters.dateTo) params.append("dateTo", populationFilters.dateTo);
      if (populationFilters.minAmount) params.append("minAmount", populationFilters.minAmount);
      if (populationFilters.maxAmount) params.append("maxAmount", populationFilters.maxAmount);
      if (populationFilters.party) params.append("party", populationFilters.party);

      const res = await fetchWithAuth(`/api/fs-draft/${engagementId}/drilldown/${selectedLineItem}?${params}`);
      if (!res.ok) throw new Error("Failed to fetch drilldown data");
      return res.json();
    },
    enabled: !!engagementId && !!selectedLineItem && drilldownOpen
  });

  const saveSnapshotMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/fs-draft/${engagementId}/snapshot`, {
        snapshotName,
        snapshotType
      });
    },
    onSuccess: () => {
      toast({ title: "Snapshot saved successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/fs-draft", engagementId, "snapshots"] });
      setShowSaveDialog(false);
      setSnapshotName("");
    },
    onError: (error: any) => {
      toast({ title: "Failed to save snapshot", description: error.message, variant: "destructive" });
    }
  });

  const toggleSection = (sectionName: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionName)) newExpanded.delete(sectionName);
    else newExpanded.add(sectionName);
    setExpandedSections(newExpanded);
  };

  const handleAmountClick = (fsLineItem: string) => {
    setSelectedLineItem(fsLineItem);
    setDrilldownOpen(true);
    setDrilldownTab("accounts");
    setPopulationPage(1);
    setPopulationFilters({ dateFrom: "", dateTo: "", minAmount: "", maxAmount: "", party: "" });
  };

  const handleExportCSV = () => {
    if (!drilldownData?.population) return;
    const firmName = firm?.displayName || firm?.name || "AuditWise";
    const headers = ["Date", "Voucher No", "GL Code", "Party", "Narrative", "Debit", "Credit", "Net", "Source"];
    const rows = drilldownData.population.map(p => [
      p.postingDate, p.voucherNo, p.glCode, p.partyId || "", p.narrative || "",
      p.debit.toString(), p.credit.toString(), p.net.toString(), p.sourceModule || ""
    ]);
    const firmHeader = [
      `"${firmName}"`,
      `"FS Population Drilldown - ${selectedLineItem}"`,
      `"Generated: ${new Date().toLocaleDateString()}"`,
      ""
    ];
    const csv = [...firmHeader, headers.join(","), ...rows.map(r => r.map(c => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${firmName.replace(/\s+/g, '_')}_${selectedLineItem}_population.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV exported successfully" });
  };

  const handleExportPlaceholder = (format: "pdf" | "excel") => {
    toast({
      title: `Export to ${format.toUpperCase()}`,
      description: "Export functionality will be implemented in a future update."
    });
  };

  const clearFilters = () => {
    setPopulationFilters({ dateFrom: "", dateTo: "", minAmount: "", maxAmount: "", party: "" });
    setPopulationPage(1);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary/60" />
        <p className="text-sm text-muted-foreground">Loading financial statements...</p>
      </div>
    );
  }

  if (!fsData) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <FileSpreadsheet className="h-14 w-14 mx-auto text-muted-foreground/40 mb-2.5" />
          <p className="text-lg font-medium text-muted-foreground mb-1">No Financial Data Available</p>
          <p className="text-sm text-muted-foreground/70">Please ensure Trial Balance mappings are complete before generating draft statements.</p>
        </CardContent>
      </Card>
    );
  }

  const equitySection = fsData.balanceSheet.sections.find(s => s.sectionName === "Share Capital & Reserves");
  const totalEquity = viewType === "ADJUSTED" ? (equitySection?.sectionAdjustedTotal || 0) : (equitySection?.sectionOriginalTotal || 0);

  const ncLiabSection = fsData.balanceSheet.sections.find(s => s.sectionName === "Non-Current Liabilities");
  const cLiabSection = fsData.balanceSheet.sections.find(s => s.sectionName === "Current Liabilities");
  const totalLiabilities = (viewType === "ADJUSTED" ? (ncLiabSection?.sectionAdjustedTotal || 0) : (ncLiabSection?.sectionOriginalTotal || 0)) +
                          (viewType === "ADJUSTED" ? (cLiabSection?.sectionAdjustedTotal || 0) : (cLiabSection?.sectionOriginalTotal || 0));

  const incomeSection = fsData.profitLoss.sections.find(s => s.sectionName === "Total Income");
  const totalIncome = viewType === "ADJUSTED" ? (incomeSection?.sectionAdjustedTotal || 0) : (incomeSection?.sectionOriginalTotal || 0);
  const totalExpenses = totalIncome - fsData.profitLoss.netProfit;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2.5 flex-wrap">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2.5" data-testid="heading-draft-fs">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
            </div>
            Draft Financial Statements
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Generated from TB mappings — {fsData.summary.mappingCompleteness}% complete — {fsData.summary.totalMappedAccounts} accounts mapped
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-0.5">
            <button
              onClick={() => setViewType("ADJUSTED")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewType === "ADJUSTED" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid="toggle-view-adjusted"
            >
              Adjusted
            </button>
            <button
              onClick={() => setViewType("ORIGINAL")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewType === "ORIGINAL" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid="toggle-view-original"
            >
              Original
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowSaveDialog(true)} data-testid="button-save-snapshot">
            <Save className="h-3.5 w-3.5 mr-1" />
            Save
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExportPlaceholder("excel")} data-testid="button-export-excel">
            <Download className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {!fsData.balanceSheet.isBalanced && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl border border-yellow-400/50 bg-yellow-50 dark:bg-yellow-950/20" data-testid="alert-unbalanced">
          <div className="p-2 rounded-full bg-yellow-100 dark:bg-yellow-900/40">
            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          </div>
          <div>
            <p className="font-semibold text-sm text-yellow-800 dark:text-yellow-300">Balance Sheet Out of Balance</p>
            <p className="text-xs text-yellow-700/80 dark:text-yellow-400/70">
              Variance: {formatCurrency(fsData.balanceSheet.variance)} — Total Assets does not equal Total Equity & Liabilities
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="summary-cards">
        <SummaryCard icon={Landmark} label="Total Assets" value={fsData.balanceSheet.totalAssets} accent="blue" />
        <SummaryCard icon={Wallet} label="Total Equity" value={totalEquity} accent="emerald" />
        <SummaryCard icon={Scale} label="Total Liabilities" value={totalLiabilities} accent="amber" />
        <SummaryCard icon={TrendingUp} label="Total Income" value={totalIncome} accent="green" />
        <SummaryCard icon={Receipt} label="Total Expenses" value={totalExpenses} accent="red" />
        <SummaryCard
          icon={CircleDollarSign}
          label="Net Profit"
          value={fsData.profitLoss.netProfit}
          accent={fsData.profitLoss.netProfit >= 0 ? "green" : "red"}
          subtitle={fsData.profitLoss.netProfit >= 0 ? "Profitable" : "Loss"}
        />
      </div>

      <div className="flex items-center gap-2.5 px-1" data-testid="status-bar">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-muted-foreground font-medium">Mapping Completeness</span>
            <span className="text-xs font-semibold">{fsData.summary.mappingCompleteness}%</span>
          </div>
          <Progress value={fsData.summary.mappingCompleteness} className="h-2" />
        </div>
        <Separator orientation="vertical" className="h-8" />
        <div className="flex items-center gap-3 text-xs shrink-0">
          <span className="flex items-center gap-1.5">
            {fsData.balanceSheet.isBalanced
              ? <><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /><span className="text-green-700 dark:text-green-400 font-medium">Balanced</span></>
              : <><AlertTriangle className="h-3.5 w-3.5 text-yellow-600" /><span className="text-yellow-700 dark:text-yellow-400 font-medium">Unbalanced</span></>
            }
          </span>
          <Separator orientation="vertical" className="h-4" />
          <span className="flex items-center gap-1.5">
            <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">{fsData.summary.totalMappedAccounts} mapped</span>
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-1 w-fit" data-testid="statement-tabs">
        <button
          onClick={() => setActiveStatement("bs")}
          className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all ${
            activeStatement === "bs"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          data-testid="tab-balance-sheet"
        >
          <Landmark className="h-4 w-4" />
          Balance Sheet
        </button>
        <button
          onClick={() => setActiveStatement("pl")}
          className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all ${
            activeStatement === "pl"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          data-testid="tab-profit-loss"
        >
          <BarChart3 className="h-4 w-4" />
          Profit & Loss
        </button>
      </div>

      {activeStatement === "bs" && (
        <Card className="overflow-hidden border shadow-sm" data-testid="card-balance-sheet">
          <div className="bg-gradient-to-r from-blue-500/5 via-transparent to-emerald-500/5 px-3 py-2 border-b">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <Landmark className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" />
                  Statement of Financial Position
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">Balance Sheet — {viewType === "ADJUSTED" ? "Adjusted" : "Original"} Balances</p>
              </div>
              <div className="flex items-center gap-2.5 text-xs">
                <div className="text-right">
                  <div className="text-muted-foreground">Total Assets</div>
                  <div className="font-mono font-bold text-blue-700 dark:text-blue-300">{formatCurrency(fsData.balanceSheet.totalAssets)}</div>
                </div>
                <div className="text-center text-muted-foreground font-medium">=</div>
                <div className="text-right">
                  <div className="text-muted-foreground">Equity + Liabilities</div>
                  <div className="font-mono font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(fsData.balanceSheet.totalEquityLiabilities)}</div>
                </div>
              </div>
            </div>
          </div>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[600px]">
              <div className="divide-y divide-border/60">
                {fsData.balanceSheet.sections.map(section => (
                  <StatementSection
                    key={`bs-${section.sectionName}`}
                    section={section}
                    statementType="bs"
                    viewType={viewType}
                    isExpanded={expandedSections.has(`bs-${section.sectionName}`)}
                    onToggle={() => toggleSection(`bs-${section.sectionName}`)}
                    onAmountClick={handleAmountClick}
                  />
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {activeStatement === "pl" && (
        <Card className="overflow-hidden border shadow-sm" data-testid="card-profit-loss">
          <div className="bg-gradient-to-r from-green-500/5 via-transparent to-red-500/5 px-3 py-2 border-b">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <BarChart3 className="h-4.5 w-4.5 text-green-600 dark:text-green-400" />
                  Statement of Profit or Loss
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">Income Statement — {viewType === "ADJUSTED" ? "Adjusted" : "Original"} Balances</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <div className="text-right">
                  <div className="text-muted-foreground">Revenue</div>
                  <div className="font-mono font-bold text-green-700 dark:text-green-300">{formatCurrency(fsData.profitLoss.revenue)}</div>
                </div>
                <div className="text-right">
                  <div className="text-muted-foreground">Net Profit</div>
                  <div className={`font-mono font-bold ${fsData.profitLoss.netProfit >= 0 ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}`}>
                    {formatCurrency(fsData.profitLoss.netProfit)}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[600px]">
              <div className="divide-y divide-border/60">
                {fsData.profitLoss.sections.map(section => (
                  <StatementSection
                    key={`pl-${section.sectionName}`}
                    section={section}
                    statementType="pl"
                    viewType={viewType}
                    isExpanded={expandedSections.has(`pl-${section.sectionName}`)}
                    onToggle={() => toggleSection(`pl-${section.sectionName}`)}
                    onAmountClick={handleAmountClick}
                  />
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {fsData.unmappedAccounts.length > 0 && (
        <Card className="border-yellow-300/50 dark:border-yellow-800/40" data-testid="card-unmapped-accounts">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-yellow-100 dark:bg-yellow-900/30">
                <AlertTriangle className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />
              </div>
              Unmapped Accounts
              <Badge variant="secondary" className="text-[10px] ml-1">{fsData.unmappedAccounts.length}</Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              These accounts need FS Line Item mapping before the draft is complete
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[200px]">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-28 text-xs">Code</TableHead>
                    <TableHead className="text-xs">Account Name</TableHead>
                    <TableHead className="w-16 text-center text-xs">Nature</TableHead>
                    <TableHead className="w-32 text-right text-xs">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fsData.unmappedAccounts.slice(0, 10).map((acc) => (
                    <TableRow key={acc.accountCode} data-testid={`unmapped-${acc.accountCode}`}>
                      <TableCell className="font-mono text-xs">{acc.accountCode}</TableCell>
                      <TableCell className="text-xs">{acc.accountName}</TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={acc.nature === "DR" ? "default" : "secondary"}
                          className="text-[10px] h-4 px-1.5"
                        >
                          {acc.nature}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">{formatAccounting(acc.closingBalance)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {fsData.unmappedAccounts.length > 10 && (
                <div className="p-2 text-center text-xs text-muted-foreground border-t">
                  +{fsData.unmappedAccounts.length - 10} more accounts
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {snapshots && snapshots.length > 0 && (
        <Card data-testid="card-snapshots">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              Saved Snapshots
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs">Name</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs">Version</TableHead>
                  <TableHead className="text-xs">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshots.slice(0, 5).map((snap) => (
                  <TableRow key={snap.id} data-testid={`snapshot-${snap.id}`}>
                    <TableCell className="font-medium text-xs">{snap.snapshotName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">{snap.snapshotType}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">v{snap.version}</TableCell>
                    <TableCell className="text-xs">{new Date(snap.createdAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Sheet open={drilldownOpen} onOpenChange={setDrilldownOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl overflow-hidden flex flex-col">
          <SheetHeader className="flex-shrink-0">
            <SheetTitle className="flex items-center gap-2 text-lg">
              <div className="p-1.5 rounded-md bg-primary/10">
                <Layers className="h-4 w-4 text-primary" />
              </div>
              {drilldownData?.displayName || selectedLineItem}
            </SheetTitle>
            <SheetDescription className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="font-mono">{formatAccounting(drilldownData?.totals.accountsTotal || 0)}</Badge>
              {drilldownData?.mapping.class && (
                <Badge variant="secondary" className="text-xs">{drilldownData.mapping.class}</Badge>
              )}
              {drilldownData?.mapping.subClass && (
                <Badge variant="secondary" className="text-xs">{drilldownData.mapping.subClass}</Badge>
              )}
              <span className="text-xs">{drilldownData?.mapping.mappedGlCount || 0} GL accounts mapped</span>
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-hidden mt-2.5">
            <Tabs value={drilldownTab} onValueChange={(v) => setDrilldownTab(v as any)} className="h-full flex flex-col">
              <TabsList className="w-auto flex-shrink-0" data-testid="drilldown-tabs">
                <TabsTrigger value="accounts" data-testid="tab-accounts">Accounts & Balances</TabsTrigger>
                <TabsTrigger value="population" data-testid="tab-population">Population</TabsTrigger>
                <TabsTrigger value="mapping" data-testid="tab-mapping">Mapping</TabsTrigger>
              </TabsList>

              <TabsContent value="accounts" className="flex-1 overflow-hidden mt-2.5">
                {drilldownLoading ? (
                  <div className="flex items-center justify-center h-40">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-24 text-xs">GL Code</TableHead>
                          <TableHead className="text-xs">GL Name</TableHead>
                          <TableHead className="text-right w-24 text-xs">Opening</TableHead>
                          <TableHead className="text-right w-24 text-xs">Period Dr</TableHead>
                          <TableHead className="text-right w-24 text-xs">Period Cr</TableHead>
                          <TableHead className="text-right w-24 text-xs">Closing</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {drilldownData?.accounts.map((acc) => (
                          <TableRow key={acc.glCode} data-testid={`drilldown-account-${acc.glCode}`}>
                            <TableCell className="font-mono text-xs">{acc.glCode}</TableCell>
                            <TableCell className="text-xs">{acc.glName}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{formatAccounting(acc.opening)}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{formatAccounting(acc.periodDr)}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{formatAccounting(acc.periodCr)}</TableCell>
                            <TableCell className="text-right font-mono text-xs font-medium">{formatAccounting(acc.closing)}</TableCell>
                          </TableRow>
                        ))}
                        {(!drilldownData?.accounts || drilldownData.accounts.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-2">No accounts found</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </TabsContent>

              <TabsContent value="population" className="flex-1 overflow-hidden mt-2.5 flex flex-col">
                <div className="flex items-center gap-2 mb-3 flex-shrink-0 flex-wrap">
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1">
                      <span className="text-muted-foreground">Count:</span>
                      <span className="font-medium">{drilldownData?.totals.populationCount || 0}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="text-muted-foreground">Dr:</span>
                      <span className="font-mono">{formatAccounting(drilldownData?.totals.populationDr || 0)}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="text-muted-foreground">Cr:</span>
                      <span className="font-mono">{formatAccounting(drilldownData?.totals.populationCr || 0)}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="text-muted-foreground">Net:</span>
                      <span className="font-mono font-medium">{formatAccounting(drilldownData?.totals.populationNet || 0)}</span>
                    </span>
                  </div>
                  <div className="flex-1" />
                  <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} data-testid="button-toggle-filters">
                    <Filter className="h-3 w-3 mr-1" />
                    Filters
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExportCSV} data-testid="button-export-csv">
                    <Download className="h-3 w-3 mr-1" />
                    CSV
                  </Button>
                </div>

                {showFilters && (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2 p-3 border rounded-md mb-3 flex-shrink-0">
                    <div>
                      <Label className="text-xs">Date From</Label>
                      <Input
                        type="date"
                        value={populationFilters.dateFrom}
                        onChange={(e) => setPopulationFilters(f => ({ ...f, dateFrom: e.target.value }))}
                        className="h-8 text-xs"
                        data-testid="input-date-from"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Date To</Label>
                      <Input
                        type="date"
                        value={populationFilters.dateTo}
                        onChange={(e) => setPopulationFilters(f => ({ ...f, dateTo: e.target.value }))}
                        className="h-8 text-xs"
                        data-testid="input-date-to"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Min Amount</Label>
                      <Input
                        type="number"
                        value={populationFilters.minAmount}
                        onChange={(e) => setPopulationFilters(f => ({ ...f, minAmount: e.target.value }))}
                        className="h-8 text-xs"
                        placeholder="0"
                        data-testid="input-min-amount"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Max Amount</Label>
                      <Input
                        type="number"
                        value={populationFilters.maxAmount}
                        onChange={(e) => setPopulationFilters(f => ({ ...f, maxAmount: e.target.value }))}
                        className="h-8 text-xs"
                        placeholder="999999"
                        data-testid="input-max-amount"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Party</Label>
                      <div className="flex gap-1">
                        <Input
                          value={populationFilters.party}
                          onChange={(e) => setPopulationFilters(f => ({ ...f, party: e.target.value }))}
                          className="h-8 text-xs"
                          placeholder="Search party..."
                          data-testid="input-party"
                        />
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={clearFilters}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {drilldownLoading ? (
                  <div className="flex items-center justify-center h-40">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <ScrollArea className="flex-1">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-24 text-xs">Date</TableHead>
                          <TableHead className="w-28 text-xs">Voucher</TableHead>
                          <TableHead className="w-20 text-xs">GL</TableHead>
                          <TableHead className="text-xs">Narrative</TableHead>
                          <TableHead className="text-right w-24 text-xs">Debit</TableHead>
                          <TableHead className="text-right w-24 text-xs">Credit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {drilldownData?.population.map((tx, idx) => (
                          <TableRow key={`${tx.voucherNo}-${idx}`} data-testid={`population-row-${idx}`}>
                            <TableCell className="text-xs">{tx.postingDate}</TableCell>
                            <TableCell className="font-mono text-xs">{tx.voucherNo}</TableCell>
                            <TableCell className="font-mono text-xs">{tx.glCode}</TableCell>
                            <TableCell className="text-xs truncate max-w-[200px]" title={tx.narrative || ""}>
                              {tx.narrative || "—"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">{tx.debit > 0 ? formatAccounting(tx.debit) : "—"}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{tx.credit > 0 ? formatAccounting(tx.credit) : "—"}</TableCell>
                          </TableRow>
                        ))}
                        {(!drilldownData?.population || drilldownData.population.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-2">No transactions found</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}

                {drilldownData?.pagination && drilldownData.pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between pt-3 flex-shrink-0 border-t mt-3">
                    <span className="text-xs text-muted-foreground">
                      Page {drilldownData.pagination.page} of {drilldownData.pagination.totalPages}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPopulationPage(p => Math.max(1, p - 1))}
                        disabled={populationPage <= 1}
                        data-testid="button-prev-page"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPopulationPage(p => Math.min(drilldownData.pagination!.totalPages, p + 1))}
                        disabled={populationPage >= drilldownData.pagination.totalPages}
                        data-testid="button-next-page"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="mapping" className="flex-1 mt-2.5">
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-2.5 border rounded-xl bg-muted/20">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">FS Head</Label>
                      <p className="font-semibold text-sm mt-1">{drilldownData?.mapping.fsHead || selectedLineItem}</p>
                    </div>
                    <div className="p-2.5 border rounded-xl bg-muted/20">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Mapped GL Accounts</Label>
                      <p className="font-semibold text-sm mt-1">{drilldownData?.mapping.mappedGlCount || 0}</p>
                    </div>
                    <div className="p-2.5 border rounded-xl bg-muted/20">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Class</Label>
                      <p className="font-semibold text-sm mt-1">{drilldownData?.mapping.class || "Not specified"}</p>
                    </div>
                    <div className="p-2.5 border rounded-xl bg-muted/20">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Sub-Class</Label>
                      <p className="font-semibold text-sm mt-1">{drilldownData?.mapping.subClass || "Not specified"}</p>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">Mapped Account Codes</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {drilldownData?.accounts.map(acc => (
                        <Badge key={acc.glCode} variant="outline" className="text-xs font-mono">
                          {acc.glCode}
                        </Badge>
                      ))}
                      {(!drilldownData?.accounts || drilldownData.accounts.length === 0) && (
                        <span className="text-muted-foreground text-xs">No accounts mapped</span>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent data-testid="dialog-save-snapshot">
          <DialogHeader>
            <DialogTitle>Save FS Snapshot</DialogTitle>
            <DialogDescription>
              Create a point-in-time snapshot of the current financial statement draft
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5 py-2">
            <div className="space-y-2">
              <Label htmlFor="snapshot-name">Snapshot Name</Label>
              <Input
                id="snapshot-name"
                placeholder="e.g., Draft FS v1, Manager Review"
                value={snapshotName}
                onChange={(e) => setSnapshotName(e.target.value)}
                data-testid="input-snapshot-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="snapshot-type">Snapshot Type</Label>
              <Select value={snapshotType} onValueChange={(v) => setSnapshotType(v as any)}>
                <SelectTrigger data-testid="select-snapshot-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UNADJUSTED">Unadjusted (Draft)</SelectItem>
                  <SelectItem value="ADJUSTED">Adjusted</SelectItem>
                  <SelectItem value="FINAL">Final</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)} data-testid="button-cancel-snapshot">
              Cancel
            </Button>
            <Button
              onClick={() => saveSnapshotMutation.mutate()}
              disabled={!snapshotName || saveSnapshotMutation.isPending}
              data-testid="button-confirm-save-snapshot"
            >
              {saveSnapshotMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Snapshot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default FSDraftGenerator;
