import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useWorkspace } from "@/lib/workspace-context";
import {
  Upload,
  Shield,
  GitCompare,
  Map,
  BarChart3,
  Target,
  FileCheck,
  CheckCircle2,
  AlertOctagon,
  AlertTriangle,
  Info,
  ChevronRight,
  RefreshCw,
  Sparkles,
  Lock,
  Clock,
  CircleDot,
  XCircle,
  ArrowRight,
} from "lucide-react";
import { useState } from "react";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

interface PhaseStatus {
  phase: string;
  phaseIndex: number;
  label: string;
  owner: string;
  gateStatus: string;
  score: number | null;
  scoreLabel: string | null;
  blockerCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  totalExceptions: number;
  aiSummary: string | null;
  highlights: any;
  approvedById: string | null;
  approvedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

interface WorkflowDashboard {
  engagementId: string;
  engagementCode: string;
  overallProgress: number;
  phasesCompleted: number;
  totalPhases: number;
  currentBlockers: number;
  phases: PhaseStatus[];
  recentExceptions: WorkflowException[];
}

interface WorkflowException {
  id: string;
  engagementId: string;
  phase: string;
  taxonomy: string;
  ruleId: string | null;
  description: string | null;
  sheet: string | null;
  rowId: string | null;
  accountCode: string | null;
  amountImpact: number | null;
  rootCause: string | null;
  suggestedFix: string | null;
  status: string;
  resolvedById: string | null;
  resolvedAt: string | null;
  resolvedNote: string | null;
  createdAt: string;
}

const PHASE_ICONS: Record<string, any> = {
  UPLOAD_PROFILE: Upload,
  DATA_QUALITY: Shield,
  TB_GL_RECON: GitCompare,
  FS_MAPPING: Map,
  PLANNING_ANALYTICS: BarChart3,
  SAMPLING: Target,
  EXECUTION_WP: FileCheck,
  COMPLETION: CheckCircle2,
};

const PHASE_ROUTES: Record<string, string> = {
  UPLOAD_PROFILE: "import",
  DATA_QUALITY: "import",
  TB_GL_RECON: "tb-review",
  FS_MAPPING: "fs-heads",
  PLANNING_ANALYTICS: "planning",
  SAMPLING: "planning",
  EXECUTION_WP: "execution",
  COMPLETION: "finalization",
};

function getGateColor(status: string) {
  switch (status) {
    case "PASSED": case "APPROVED": return "text-green-600 dark:text-green-400";
    case "IN_PROGRESS": return "text-blue-600 dark:text-blue-400";
    case "BLOCKED": return "text-red-600 dark:text-red-400";
    case "WARNING": return "text-amber-600 dark:text-amber-400";
    default: return "text-muted-foreground";
  }
}

function getGateBg(status: string) {
  switch (status) {
    case "PASSED": case "APPROVED": return "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800";
    case "IN_PROGRESS": return "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800";
    case "BLOCKED": return "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800";
    case "WARNING": return "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800";
    default: return "bg-muted/30 border-border";
  }
}

function GateStatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    PASSED: "Passed",
    APPROVED: "Approved",
    IN_PROGRESS: "In Progress",
    BLOCKED: "Blocked",
    WARNING: "Warning",
    NOT_STARTED: "Not Started",
  };
  const variants: Record<string, string> = {
    PASSED: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    APPROVED: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    IN_PROGRESS: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    BLOCKED: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    WARNING: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    NOT_STARTED: "bg-muted text-muted-foreground",
  };
  return (
    <Badge className={`${variants[status] || variants.NOT_STARTED} no-default-hover-elevate no-default-active-elevate`} data-testid={`badge-gate-${status.toLowerCase()}`}>
      {labels[status] || status}
    </Badge>
  );
}

function TaxonomyBadge({ taxonomy, count }: { taxonomy: string; count: number }) {
  if (count === 0) return null;
  const config: Record<string, { label: string; cls: string }> = {
    S1: { label: "S1", cls: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
    S2: { label: "S2", cls: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
    S3: { label: "S3", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
    S4: { label: "S4", cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
  };
  const c = config[taxonomy] || config.S4;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge className={`${c.cls} text-xs no-default-hover-elevate no-default-active-elevate`} data-testid={`badge-taxonomy-${taxonomy.toLowerCase()}`}>
          {c.label}: {count}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p>{taxonomy === "S1" ? "Blockers" : taxonomy === "S2" ? "High severity" : taxonomy === "S3" ? "Medium severity" : "Low severity"} - {count} open</p>
      </TooltipContent>
    </Tooltip>
  );
}

function ScoreRing({ score, label }: { score: number | null; label: string | null }) {
  if (score === null) return <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-xs text-muted-foreground">--</div>;
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="relative w-12 h-12 flex items-center justify-center" data-testid="score-ring">
          <svg className="absolute inset-0 -rotate-90" width="48" height="48" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r={radius} fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/30" />
            <circle cx="24" cy="24" r={radius} fill="none" stroke={color} strokeWidth="3" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
          </svg>
          <span className="text-xs font-semibold" style={{ color }}>{score}%</span>
        </div>
      </TooltipTrigger>
      <TooltipContent>{label || `Score: ${score}%`}</TooltipContent>
    </Tooltip>
  );
}

function PhaseCard({ phase, engagementId }: { phase: PhaseStatus; engagementId: string }) {
  const Icon = PHASE_ICONS[phase.phase] || CircleDot;
  const route = PHASE_ROUTES[phase.phase] || "";
  const isActive = phase.gateStatus !== "NOT_STARTED";
  const isComplete = phase.gateStatus === "PASSED" || phase.gateStatus === "APPROVED";

  return (
    <Card className={`border ${getGateBg(phase.gateStatus)} transition-colors`} data-testid={`card-phase-${phase.phase.toLowerCase()}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-md ${isComplete ? "bg-green-100 dark:bg-green-900/40" : isActive ? "bg-blue-100 dark:bg-blue-900/40" : "bg-muted"}`}>
            <Icon className={`h-5 w-5 ${getGateColor(phase.gateStatus)}`} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium text-sm">{phase.label}</h3>
              <GateStatusBadge status={phase.gateStatus} />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{phase.owner}</p>

            {phase.aiSummary && (
              <div className="mt-2 flex items-start gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-purple-500 mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">{phase.aiSummary}</p>
              </div>
            )}

            {phase.totalExceptions > 0 && (
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <TaxonomyBadge taxonomy="S1" count={phase.blockerCount} />
                <TaxonomyBadge taxonomy="S2" count={phase.highCount} />
                <TaxonomyBadge taxonomy="S3" count={phase.mediumCount} />
                <TaxonomyBadge taxonomy="S4" count={phase.lowCount} />
              </div>
            )}

            {phase.highlights && typeof phase.highlights === "object" && (
              <HighlightsRow highlights={phase.highlights} phase={phase.phase} />
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <ScoreRing score={phase.score} label={phase.scoreLabel} />
            {route && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" asChild data-testid={`button-navigate-${phase.phase.toLowerCase()}`}>
                    <a href={`/workspace/${engagementId}/${route}`}>
                      <ChevronRight className="h-4 w-4" />
                    </a>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Open {phase.label}</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function HighlightsRow({ highlights, phase }: { highlights: any; phase: string }) {
  if (!highlights || typeof highlights !== "object") return null;
  const items: { label: string; value: string | number }[] = [];

  if (phase === "UPLOAD_PROFILE") {
    if (highlights.sheets?.length > 0) items.push({ label: "Sheets", value: highlights.sheets.length });
    if (highlights.missingSheets?.length > 0) items.push({ label: "Missing", value: highlights.missingSheets.join(", ") });
    if (highlights.period?.start) items.push({ label: "Period", value: `${highlights.period.start} - ${highlights.period.end}` });
  }
  if (phase === "DATA_QUALITY") {
    if (highlights.counts) {
      if (highlights.counts.critical) items.push({ label: "Critical", value: highlights.counts.critical });
      if (highlights.counts.exceptions) items.push({ label: "Exceptions", value: highlights.counts.exceptions });
      if (highlights.counts.tbRows) items.push({ label: "TB Rows", value: highlights.counts.tbRows });
      if (highlights.counts.glEntries) items.push({ label: "GL Entries", value: highlights.counts.glEntries });
    }
    if (highlights.checks) {
      const passed = highlights.checks.filter((c: any) => c.status === "PASS").length;
      items.push({ label: "Checks", value: `${passed}/${highlights.checks.length} passed` });
    }
  }
  if (phase === "TB_GL_RECON") {
    if (highlights.reconDiff !== undefined) items.push({ label: "Variance", value: Number(highlights.reconDiff).toLocaleString() });
    if (highlights.reconItemCount !== undefined) items.push({ label: "Items", value: highlights.reconItemCount });
    if (highlights.reconStatus) items.push({ label: "Status", value: highlights.reconStatus });
  }
  if (phase === "FS_MAPPING") {
    if (highlights.totalAccounts) items.push({ label: "Accounts", value: highlights.totalAccounts });
    if (highlights.mappedAccounts !== undefined) items.push({ label: "Mapped", value: highlights.mappedAccounts });
    if (highlights.unmappedAccounts) items.push({ label: "Unmapped", value: highlights.unmappedAccounts });
    if (highlights.leadScheduleCount) items.push({ label: "Lead Schedules", value: highlights.leadScheduleCount });
  }
  if (phase === "PLANNING_ANALYTICS") {
    if (highlights.materialitySets?.length > 0) {
      const approved = highlights.materialitySets.find((m: any) => m.status === "APPROVED") || highlights.materialitySets[0];
      if (approved?.om) items.push({ label: "OM", value: Number(approved.om).toLocaleString() });
      if (approved?.pm) items.push({ label: "PM", value: Number(approved.pm).toLocaleString() });
    }
    if (highlights.riskCount) items.push({ label: "Risks", value: highlights.riskCount });
    if (highlights.analyticsCount) items.push({ label: "Analytics", value: highlights.analyticsCount });
  }
  if (phase === "SAMPLING") {
    if (highlights.totalItems) items.push({ label: "Population", value: Number(highlights.totalItems).toLocaleString() });
    if (highlights.selectedItems) items.push({ label: "Selected", value: highlights.selectedItems });
    if (highlights.coveragePct !== undefined) items.push({ label: "Coverage", value: `${highlights.coveragePct}%` });
    if (highlights.sampleCount) items.push({ label: "Samples", value: highlights.sampleCount });
  }
  if (phase === "EXECUTION_WP") {
    if (highlights.completed !== undefined && highlights.totalWorkpapers) items.push({ label: "Workpapers", value: `${highlights.completed}/${highlights.totalWorkpapers}` });
    if (highlights.inProgress) items.push({ label: "In Progress", value: highlights.inProgress });
    if (highlights.misstatements?.unresolved) items.push({ label: "Misstatements", value: highlights.misstatements.unresolved });
  }
  if (phase === "COMPLETION") {
    if (highlights.components) {
      const c = highlights.components;
      const done = [c.auditReport && "Report", c.managementLetter && "Letter", c.completionMemo && "Memo"].filter(Boolean);
      if (done.length > 0) items.push({ label: "Done", value: done.join(", ") });
    }
  }

  if (items.length === 0) return null;

  return (
    <div className="flex items-center gap-3 mt-2 flex-wrap">
      {items.map((item, i) => (
        <span key={i} className="text-xs">
          <span className="text-muted-foreground">{item.label}:</span>{" "}
          <span className="font-medium">{item.value}</span>
        </span>
      ))}
    </div>
  );
}

function ExceptionsList({ exceptions, engagementId }: { exceptions: WorkflowException[]; engagementId: string }) {
  const { toast } = useToast();

  const resolveMutation = useMutation({
    mutationFn: async ({ exceptionId }: { exceptionId: string }) => {
      const res = await apiRequest("PATCH", `/api/workflow/${engagementId}/exceptions/${exceptionId}/resolve`, { resolution: "Resolved via dashboard" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflow", engagementId, "dashboard"] });
      toast({ title: "Exception resolved" });
    },
    onError: () => {
      toast({ title: "Failed to resolve exception", variant: "destructive" });
    },
  });

  if (exceptions.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground" data-testid="text-no-exceptions">
        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
        <p className="text-sm">No open exceptions</p>
      </div>
    );
  }

  const taxonomyIcon = (t: string) => {
    if (t === "S1_BLOCKER") return <AlertOctagon className="h-4 w-4 text-red-500" />;
    if (t === "S2_HIGH") return <XCircle className="h-4 w-4 text-orange-500" />;
    if (t === "S3_MEDIUM") return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    return <Info className="h-4 w-4 text-blue-500" />;
  };

  const phaseLabel = (p: string) => {
    const labels: Record<string, string> = {
      UPLOAD_PROFILE: "Upload", DATA_QUALITY: "DQ", TB_GL_RECON: "Recon",
      FS_MAPPING: "Mapping", PLANNING_ANALYTICS: "Planning", SAMPLING: "Sampling",
      EXECUTION_WP: "Execution", COMPLETION: "Completion",
    };
    return labels[p] || p;
  };

  return (
    <div className="space-y-2" data-testid="list-exceptions">
      {exceptions.map((ex) => (
        <div key={ex.id} className="flex items-start gap-2 p-2 rounded-md hover-elevate" data-testid={`row-exception-${ex.id}`}>
          {taxonomyIcon(ex.taxonomy)}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge variant="outline" className="text-xs no-default-hover-elevate no-default-active-elevate">{phaseLabel(ex.phase)}</Badge>
              {ex.accountCode && <span className="text-xs text-muted-foreground font-mono">{ex.accountCode}</span>}
            </div>
            <p className="text-xs mt-0.5 truncate">{ex.description}</p>
            {ex.suggestedFix && (
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <ArrowRight className="h-3 w-3" /> {ex.suggestedFix}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => resolveMutation.mutate({ exceptionId: ex.id })}
            disabled={resolveMutation.isPending}
            data-testid={`button-resolve-${ex.id}`}
          >
            Resolve
          </Button>
        </div>
      ))}
    </div>
  );
}

function OverallProgressHeader({ dashboard }: { dashboard: WorkflowDashboard }) {
  const blockerLabel = dashboard.currentBlockers > 0
    ? `${dashboard.currentBlockers} blocker${dashboard.currentBlockers > 1 ? "s" : ""}`
    : "No blockers";

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between" data-testid="section-progress-header">
      <div>
        <h1 className="text-xl font-semibold" data-testid="text-page-title">Post-Upload Audit Workflow</h1>
        <p className="text-sm text-muted-foreground mt-0.5" data-testid="text-engagement-code">
          {dashboard.engagementCode} &middot; {dashboard.phasesCompleted}/{dashboard.totalPhases} phases complete
        </p>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold" data-testid="text-overall-progress">{dashboard.overallProgress}%</span>
            {dashboard.currentBlockers > 0 ? (
              <Badge className="bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 no-default-hover-elevate no-default-active-elevate" data-testid="badge-blockers">
                <Lock className="h-3 w-3 mr-1" />{blockerLabel}
              </Badge>
            ) : (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 no-default-hover-elevate no-default-active-elevate" data-testid="badge-no-blockers">
                <CheckCircle2 className="h-3 w-3 mr-1" />{blockerLabel}
              </Badge>
            )}
          </div>
          <Progress value={dashboard.overallProgress} className="w-48 h-2" data-testid="progress-overall" />
        </div>
      </div>
    </div>
  );
}

function PipelineFlow({ phases }: { phases: PhaseStatus[] }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto py-2" data-testid="section-pipeline-flow">
      {phases.map((p, i) => {
        const Icon = PHASE_ICONS[p.phase] || CircleDot;
        const isComplete = p.gateStatus === "PASSED" || p.gateStatus === "APPROVED";
        const isBlocked = p.gateStatus === "BLOCKED";
        const isActive = p.gateStatus === "IN_PROGRESS" || p.gateStatus === "WARNING";
        return (
          <div key={p.phase} className="flex items-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-default ${
                    isComplete ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                    : isBlocked ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                    : isActive ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                    : "bg-muted text-muted-foreground"
                  }`}
                  data-testid={`pip-phase-${p.phase.toLowerCase()}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline whitespace-nowrap">{p.label.split(" ")[0]}</span>
                  {p.score !== null && <span className="font-mono text-[10px]">{p.score}%</span>}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-medium">{p.label}</p>
                <p className="text-xs text-muted-foreground">{p.gateStatus} {p.score !== null ? `- ${p.score}%` : ""}</p>
              </TooltipContent>
            </Tooltip>
            {i < phases.length - 1 && (
              <ChevronRight className={`h-3.5 w-3.5 mx-0.5 shrink-0 ${isComplete ? "text-green-400" : "text-muted-foreground/40"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function SummaryCards({ dashboard }: { dashboard: WorkflowDashboard }) {
  const totalExceptions = dashboard.phases.reduce((s, p) => s + p.totalExceptions, 0);
  const avgScore = dashboard.phases.filter(p => p.score !== null).reduce((s, p) => s + (p.score || 0), 0) / Math.max(1, dashboard.phases.filter(p => p.score !== null).length);
  const activePhases = dashboard.phases.filter(p => p.gateStatus !== "NOT_STARTED").length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="section-summary-cards">
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-blue-100 dark:bg-blue-900/40">
              <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Active Phases</p>
              <p className="text-lg font-semibold" data-testid="text-active-phases">{activePhases}/{dashboard.totalPhases}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-green-100 dark:bg-green-900/40">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Avg Score</p>
              <p className="text-lg font-semibold" data-testid="text-avg-score">{Math.round(avgScore)}%</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-amber-100 dark:bg-amber-900/40">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Open Exceptions</p>
              <p className="text-lg font-semibold" data-testid="text-total-exceptions">{totalExceptions}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-red-100 dark:bg-red-900/40">
              <AlertOctagon className="h-4 w-4 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Blockers</p>
              <p className="text-lg font-semibold" data-testid="text-blocker-count">{dashboard.currentBlockers}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PostUploadWorkflow() {
  const params = useParams<{ engagementId: string }>();
  const { activeEngagement } = useWorkspace();
  const engagementId = params.engagementId || activeEngagement?.id || "";
  const { toast } = useToast();
  const [expandedExceptions, setExpandedExceptions] = useState(false);

  const { data: dashboard, isLoading, isError, refetch, isFetching } = useQuery<WorkflowDashboard>({
    queryKey: ["/api/workflow", engagementId, "dashboard"],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/workflow/${engagementId}/dashboard`);
      if (!res.ok) throw new Error("Failed to fetch workflow dashboard");
      return res.json();
    },
    enabled: !!engagementId,
    refetchInterval: 30000,
  });

  if (!engagementId) {
    return (
      <div className="p-6 text-center text-muted-foreground" data-testid="text-no-engagement">
        <p>Select an engagement to view the workflow dashboard.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="page-container">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-8 w-full" />
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  if (isError || !dashboard) {
    return (
      <div className="p-6 text-center" data-testid="text-error">
        <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-500" />
        <p className="text-sm text-muted-foreground mb-3">Failed to load workflow dashboard.</p>
        <Button variant="outline" onClick={() => refetch()} data-testid="button-retry">
          <RefreshCw className="h-4 w-4 mr-2" /> Retry
        </Button>
      </div>
    );
  }

  const displayExceptions = expandedExceptions ? dashboard.recentExceptions : dashboard.recentExceptions.slice(0, 5);

  return (
    <div className="page-container">
      <div className="flex items-center justify-between gap-2">
        <OverallProgressHeader dashboard={dashboard} />
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          data-testid="button-refresh-dashboard"
        >
          <RefreshCw className={`h-4 w-4 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <PipelineFlow phases={dashboard.phases} />

      <SummaryCards dashboard={dashboard} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Phase Details</h2>
          {dashboard.phases.map((phase) => (
            <PhaseCard key={phase.phase} phase={phase} engagementId={engagementId} />
          ))}
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Open Exceptions</h2>
          <Card>
            <CardContent className="p-3">
              <ExceptionsList exceptions={displayExceptions} engagementId={engagementId} />
              {dashboard.recentExceptions.length > 5 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => setExpandedExceptions(!expandedExceptions)}
                  data-testid="button-toggle-exceptions"
                >
                  {expandedExceptions ? "Show Less" : `Show All (${dashboard.recentExceptions.length})`}
                </Button>
              )}
            </CardContent>
          </Card>

          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mt-4">AI Insights</h2>
          <Card>
            <CardContent className="p-3 space-y-3">
              {dashboard.phases.filter(p => p.aiSummary && p.gateStatus !== "NOT_STARTED").map(p => (
                <div key={p.phase} className="flex items-start gap-2" data-testid={`insight-${p.phase.toLowerCase()}`}>
                  <Sparkles className="h-3.5 w-3.5 text-purple-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium">{p.label}</p>
                    <p className="text-xs text-muted-foreground">{p.aiSummary}</p>
                  </div>
                </div>
              ))}
              {dashboard.phases.filter(p => p.aiSummary && p.gateStatus !== "NOT_STARTED").length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4" data-testid="text-no-insights">
                  Start processing data to generate AI insights.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
