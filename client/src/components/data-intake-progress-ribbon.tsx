import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  ArrowRight,
  RefreshCw,
  FileText,
  BookOpen,
  Layers,
  CreditCard,
  Receipt,
  Building,
  Mail,
  Map,
  FileSpreadsheet,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { apiRequest } from "@/lib/queryClient";

interface ModuleStatusDetail {
  status: string;
  label: string;
  recordCount: number;
  lastUpdated: string | null;
  exceptions: number;
  completionPct: number;
  nextAction: string | null;
}

interface DataIntakeStatusResponse {
  engagementId: string;
  overallStatus: string;
  overallCompletionPct: number;
  dataQualityScore: number;
  totalExceptions: number;
  blockingExceptions: number;
  lastScanAt: string | null;
  modules: Record<string, ModuleStatusDetail>;
  reconciliation: Record<string, string>;
  canComplete: boolean;
  completionBlockers: string[];
}

const moduleIcons: Record<string, React.ReactNode> = {
  import: <FileText className="h-3.5 w-3.5" />,
  trialBalance: <BookOpen className="h-3.5 w-3.5" />,
  generalLedger: <Layers className="h-3.5 w-3.5" />,
  accountsReceivable: <CreditCard className="h-3.5 w-3.5" />,
  accountsPayable: <Receipt className="h-3.5 w-3.5" />,
  bank: <Building className="h-3.5 w-3.5" />,
  confirmations: <Mail className="h-3.5 w-3.5" />,
  fsMapping: <Map className="h-3.5 w-3.5" />,
  draftFS: <FileSpreadsheet className="h-3.5 w-3.5" />,
};

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "COMPLETED":
    case "RECONCILED":
    case "READY":
      return <CheckCircle className="h-3.5 w-3.5 text-green-500" />;
    case "EXCEPTION_PENDING":
      return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />;
    case "NOT_STARTED":
      return <Clock className="h-3.5 w-3.5 text-gray-400" />;
    case "UPLOADED":
    case "VALIDATED":
    case "MAPPED":
      return <ArrowRight className="h-3.5 w-3.5 text-blue-500" />;
    default:
      return <XCircle className="h-3.5 w-3.5 text-red-500" />;
  }
}

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "COMPLETED":
    case "RECONCILED":
    case "READY":
      return "default";
    case "EXCEPTION_PENDING":
      return "destructive";
    case "NOT_STARTED":
      return "outline";
    default:
      return "secondary";
  }
}

function gateIcon(val: string) {
  if (val === "PASS") return <CheckCircle className="h-3 w-3 text-green-500" />;
  if (val === "FAIL") return <XCircle className="h-3 w-3 text-red-500" />;
  if (val === "WARNING") return <AlertTriangle className="h-3 w-3 text-amber-500" />;
  return <Clock className="h-3 w-3 text-gray-400" />;
}

function qualityColor(score: number): string {
  if (score >= 90) return "text-green-600";
  if (score >= 70) return "text-blue-600";
  if (score >= 50) return "text-amber-600";
  return "text-red-600";
}

export function DataIntakeProgressRibbon({ engagementId }: { engagementId: string }) {
  const { data, isLoading, refetch, isFetching } = useQuery<DataIntakeStatusResponse>({
    queryKey: ["/api/engagements", engagementId, "data-intake-status"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/engagements/${engagementId}/data-intake/status`);
      return res.json();
    },
    enabled: !!engagementId,
    refetchInterval: 30000,
    staleTime: 10000,
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 border-b text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading data intake status...
      </div>
    );
  }

  const modules = data.modules ? Object.entries(data.modules) : [];
  const reconEntries = data.reconciliation ? Object.entries(data.reconciliation) : [];

  const reconLabels: Record<string, string> = {
    tbBalanced: "TB Balanced",
    glBalanced: "GL Balanced",
    tbGlTieOut: "TB/GL Tie-Out",
    arControl: "AR Control",
    apControl: "AP Control",
    bankControl: "Bank Control",
    allCodesMapped: "All Mapped",
    bsFooting: "BS Footing",
  };

  return (
    <TooltipProvider>
      <div className="border-b bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
        <div className="px-4 py-2">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Data Intake</span>
                <Progress value={data.overallCompletionPct} className="w-20 h-1.5" />
                <span className="text-xs font-semibold">{data.overallCompletionPct}%</span>
              </div>

              <span className="text-muted-foreground/30">|</span>

              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Quality:</span>
                <span className={`text-xs font-semibold ${qualityColor(data.dataQualityScore)}`}>
                  {data.dataQualityScore}
                </span>
              </div>

              {data.totalExceptions > 0 && (
                <>
                  <span className="text-muted-foreground/30">|</span>
                  <div className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                    <span className="text-xs">
                      {data.totalExceptions} exception{data.totalExceptions !== 1 ? "s" : ""}
                      {data.blockingExceptions > 0 && (
                        <span className="text-red-500 font-medium"> ({data.blockingExceptions} blocking)</span>
                      )}
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              {data.lastScanAt && (
                <span className="text-[10px] text-muted-foreground">
                  Scanned {new Date(data.lastScanAt).toLocaleTimeString()}
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => refetch()}
                disabled={isFetching}
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${isFetching ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-1 mt-1.5 overflow-x-auto pb-0.5">
            {modules.map(([key, mod]) => (
              <Tooltip key={key}>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/40 hover:bg-muted/70 transition-colors cursor-default shrink-0">
                    {moduleIcons[key] || <FileText className="h-3.5 w-3.5" />}
                    <StatusIcon status={mod.status} />
                    <span className="text-[10px] font-medium truncate max-w-[60px]">{mod.label}</span>
                    {mod.exceptions > 0 && (
                      <span className="text-[9px] bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 px-1 rounded-full">{mod.exceptions}</span>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <div className="space-y-1 text-xs">
                    <div className="font-semibold">{mod.label}</div>
                    <div className="flex items-center gap-1">
                      <Badge variant={statusBadgeVariant(mod.status)} className="text-[10px] h-4">{mod.status.replace(/_/g, " ")}</Badge>
                      <span>{mod.completionPct}% complete</span>
                    </div>
                    <div>Records: {mod.recordCount.toLocaleString()}</div>
                    {mod.exceptions > 0 && <div className="text-red-600">{mod.exceptions} exception(s)</div>}
                    {mod.nextAction && <div className="text-blue-600 font-medium">{mod.nextAction}</div>}
                    {mod.lastUpdated && <div className="text-muted-foreground">Updated: {new Date(mod.lastUpdated).toLocaleString()}</div>}
                  </div>
                </TooltipContent>
              </Tooltip>
            ))}

            <span className="text-muted-foreground/30 mx-1">|</span>

            {reconEntries.map(([key, val]) => (
              <Tooltip key={key}>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-0.5 px-1 py-0.5 cursor-default shrink-0">
                    {gateIcon(val)}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <div className="text-xs">
                    <span className="font-medium">{reconLabels[key] || key}: </span>
                    <span className={val === "PASS" ? "text-green-600" : val === "FAIL" ? "text-red-600" : "text-muted-foreground"}>
                      {val}
                    </span>
                  </div>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>

          {data.completionBlockers.length > 0 && data.overallCompletionPct > 0 && (
            <div className="mt-1 flex items-center gap-1 flex-wrap">
              {data.completionBlockers.slice(0, 3).map((blocker, i) => (
                <span key={i} className="text-[10px] text-red-600 bg-red-50 dark:bg-red-950 px-1.5 py-0.5 rounded">
                  {blocker}
                </span>
              ))}
              {data.completionBlockers.length > 3 && (
                <span className="text-[10px] text-muted-foreground">+{data.completionBlockers.length - 3} more</span>
              )}
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
