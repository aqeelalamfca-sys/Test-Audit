import { useLocation, Link } from "wouter";
import { useWorkspace, WORKSPACE_PHASES, isPhaseVisible } from "@/lib/workspace-context";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  ClipboardList,
  Target,
  Play,
  CheckCircle2,
  FileOutput,
  FolderOpen,
  Search,
  Layers,
  Shield,
  ArrowRight,
  Lock
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const PHASE_ICONS: Record<string, React.ElementType> = {
  "requisition": FileText,
  "pre-planning": ClipboardList,
  "planning": Target,
  "execution": Play,
  "fs-heads": Layers,
  "evidence": FolderOpen,
  "finalization": CheckCircle2,
  "deliverables": FileOutput,
  "eqcr": CheckCircle2,
  "inspection": Search,
};

const PHASE_ROUTE_TO_AUDIT: Record<string, string> = {
  "pre-planning": "PRE_PLANNING",
  "requisition": "REQUISITION",
  "planning": "PLANNING",
  "execution": "EXECUTION",
  "fs-heads": "EXECUTION",
  "evidence": "EXECUTION",
  "finalization": "FINALIZATION",
  "deliverables": "REPORTING",
  "eqcr": "EQCR",
  "inspection": "INSPECTION",
};

const PHASE_ISA_REF: Record<string, string> = {
  "pre-planning": "ISA 220, 210",
  "requisition": "ISA 230",
  "planning": "ISA 300, 315, 320",
  "execution": "ISA 330, 500, 530",
  "fs-heads": "ISA 500, 501",
  "evidence": "ISA 500, 501",
  "finalization": "ISA 560, 570, 700",
  "deliverables": "ISA 700, 705, 706",
  "eqcr": "ISQM-1",
  "inspection": "ISQM-1",
};

const PHASE_ORDER = [
  "pre-planning", "requisition", "planning", "execution",
  "fs-heads", "evidence", "finalization", "deliverables", "eqcr", "inspection"
];

type TrafficColor = "red" | "amber" | "green" | "gray";

function getTrafficFromSummary(summary: { prepared: number; reviewed: number; approved: number; total: number } | undefined): TrafficColor {
  if (!summary || summary.total === 0) return "gray";
  if (summary.approved === summary.total) return "green";
  if (summary.prepared > 0 || summary.reviewed > 0) return "amber";
  return "red";
}

const TRAFFIC_COLORS: Record<TrafficColor, string> = {
  red: "bg-red-500",
  amber: "bg-amber-500",
  green: "bg-emerald-500",
  gray: "bg-muted-foreground/30",
};

const TRAFFIC_RING: Record<TrafficColor, string> = {
  red: "ring-red-300 dark:ring-red-800",
  amber: "ring-amber-300 dark:ring-amber-800",
  green: "ring-emerald-300 dark:ring-emerald-800",
  gray: "ring-muted-foreground/20",
};

export function WorkspaceRibbon() {
  const [location] = useLocation();
  const { user } = useAuth();
  const {
    currentEngagementId,
    currentPhaseRoute,
    isContextSet,
    selectedPeriodId,
    activeEngagement,
    isInWorkspaceMode
  } = useWorkspace();

  const userRole = user?.role?.toUpperCase() || "STAFF";

  const workspaceMatch = location.match(/\/workspace\/([^/]+)(?:\/([^/]+))?/);
  const urlEngagementId = workspaceMatch?.[1] || null;
  const urlPhase = workspaceMatch?.[2] || null;

  const engagementId = urlEngagementId || currentEngagementId || activeEngagement?.id || selectedPeriodId;
  const activePhase = currentPhaseRoute || urlPhase;

  const { data: phaseSummaries } = useQuery<Record<string, { prepared: number; reviewed: number; approved: number; total: number }>>({
    queryKey: ["/api/section-signoffs", engagementId, "__all-phases"],
    queryFn: async () => {
      const phases = Object.values(PHASE_ROUTE_TO_AUDIT);
      const unique = [...new Set(phases)];
      const results: Record<string, any> = {};
      await Promise.all(unique.map(async (p) => {
        try {
          const r = await fetchWithAuth(`/api/section-signoffs/${engagementId}/${p}/summary`);
          if (r.ok) results[p] = await r.json();
        } catch {}
      }));
      return results;
    },
    enabled: !!engagementId,
    staleTime: 60000,
  });

  const isWorkspaceActive = !!urlEngagementId || (isContextSet && selectedPeriodId) || isInWorkspaceMode || !!currentEngagementId;

  if (!isWorkspaceActive || !engagementId) {
    return null;
  }

  const getTabHref = (tabKey: string) => `/workspace/${engagementId}/${tabKey}`;

  const isTabActive = (tabKey: string) => {
    if (activePhase === tabKey) return true;
    if (tabKey === "requisition" && activePhase === "information-requisition") return true;
    return false;
  };

  const isStandardsActive = activePhase === "standards-matrix";

  const getPhaseTraffic = (phaseKey: string): TrafficColor => {
    const auditPhase = PHASE_ROUTE_TO_AUDIT[phaseKey];
    return getTrafficFromSummary(auditPhase ? phaseSummaries?.[auditPhase] : undefined);
  };

  const getPhaseCompletion = (phaseKey: string): number => {
    const auditPhase = PHASE_ROUTE_TO_AUDIT[phaseKey];
    const s = auditPhase ? phaseSummaries?.[auditPhase] : undefined;
    if (!s || s.total === 0) return 0;
    return Math.round((s.approved / s.total) * 100);
  };

  const isPhaseGated = (phaseKey: string): boolean => {
    const idx = PHASE_ORDER.indexOf(phaseKey);
    if (idx <= 0) return false;
    if (phaseKey === "requisition") return false;
    const prev = PHASE_ORDER[idx - 1];
    const prevTraffic = getPhaseTraffic(prev);
    return prevTraffic === "red" || prevTraffic === "gray";
  };

  const visiblePhases = WORKSPACE_PHASES.filter((phase) => isPhaseVisible(phase.key, userRole));

  const completedPhases = visiblePhases.filter(p => getPhaseTraffic(p.key) === "green").length;
  const totalPhases = visiblePhases.length;

  return (
    <div className="border-b border-border/50 bg-card/30 backdrop-blur-sm" data-testid="workspace-ribbon">
      <div className="flex items-center px-3 py-1 gap-2">
        <div className="flex items-center gap-1.5 mr-1 flex-shrink-0">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground hidden xl:inline">Audit</span>
          <Badge variant="outline" className="text-[9px] h-4 px-1 font-mono">
            {completedPhases}/{totalPhases}
          </Badge>
        </div>

        <nav className="flex items-center gap-0 flex-1 overflow-x-auto" data-testid="ribbon-tabs">
          {visiblePhases.map((phase, index) => {
            const Icon = PHASE_ICONS[phase.key] || FileText;
            const isActive = isTabActive(phase.key);
            const href = getTabHref(phase.key);
            const traffic = getPhaseTraffic(phase.key);
            const completion = getPhaseCompletion(phase.key);
            const gated = isPhaseGated(phase.key);
            const isLast = index === visiblePhases.length - 1;

            const tabContent = (
              <Link
                key={phase.key}
                href={gated ? "#" : href}
                onClick={gated ? (e: any) => e.preventDefault() : undefined}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md transition-all relative",
                  isActive
                    ? cn("bg-primary/10 text-primary ring-1", TRAFFIC_RING[traffic])
                    : gated
                      ? "text-muted-foreground/40 cursor-not-allowed"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
                data-testid={`tab-${phase.key}`}
              >
                <div className={cn("w-2 h-2 rounded-full flex-shrink-0", TRAFFIC_COLORS[traffic])} />
                {gated ? (
                  <Lock className="h-3 w-3 text-muted-foreground/40" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
                <span className="hidden lg:inline truncate max-w-[80px]">{phase.label}</span>
                {completion > 0 && completion < 100 && !gated && (
                  <span className="text-[9px] text-muted-foreground">{completion}%</span>
                )}
              </Link>
            );

            return (
              <div key={phase.key} className="flex items-center">
                <Tooltip>
                  <TooltipTrigger asChild>{tabContent}</TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs max-w-[220px]">
                    <div className="space-y-1">
                      <div className="font-medium">{phase.label}</div>
                      <div className="text-muted-foreground font-mono text-[10px]">{PHASE_ISA_REF[phase.key]}</div>
                      <div className="flex items-center gap-1.5">
                        <div className={cn("w-2 h-2 rounded-full", TRAFFIC_COLORS[traffic])} />
                        <span>
                          {traffic === "green" ? "Approved" :
                           traffic === "amber" ? "In Progress" :
                           traffic === "red" ? "Needs Attention" : "Not Started"}
                        </span>
                        {completion > 0 && <span className="text-muted-foreground">({completion}%)</span>}
                      </div>
                      {gated && (
                        <div className="text-amber-600 dark:text-amber-400 text-[10px]">
                          Locked — complete the previous phase first
                        </div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
                {!isLast && (
                  <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/30 mx-0 flex-shrink-0" />
                )}
              </div>
            );
          })}
        </nav>

        <div className="flex items-center gap-1 border-l border-border/30 pl-2 flex-shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={getTabHref("standards-matrix")}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md transition-colors",
                  isStandardsActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
                data-testid="tab-standards-matrix"
                aria-label="Standards Coverage Matrix"
              >
                <Shield className="h-3.5 w-3.5" />
                <span className="hidden xl:inline">Standards</span>
              </Link>
            </TooltipTrigger>
            <TooltipContent>
              <p>ISA/ISQM Standards Coverage Matrix</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
