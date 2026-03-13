import { ReactNode, useMemo, useState } from "react";
import { Link, Redirect } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useWorkspace, isPhaseVisible } from "@/lib/workspace-context";
import { useAuth } from "@/lib/auth";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Loader2,
  Lock,
  Bot,
  X,
} from "lucide-react";
import {
  getWorkspacePhases,
  getPhaseByKey,
  getNextPhase,
  getPreviousPhase,
  PHASE_GROUP_LABELS,
} from "../../../shared/phases";

interface EngagementWorkspaceShellProps {
  children: ReactNode;
  phaseSlug?: string;
  engagementId: string;
}

interface PhaseStateEntry {
  phaseKey: string;
  phaseLabel: string;
  description: string;
  order: number;
  group: string;
  backendPhase: string;
  status: string;
  completionPercentage: number;
  gateEvaluation?: {
    canEnter: boolean;
    canComplete: boolean;
    blockers: string[];
    warnings: string[];
  } | null;
}

interface EngagementPhaseState {
  engagementId: string;
  currentPhaseKey: string | null;
  overallCompletion: number;
  phases: PhaseStateEntry[];
}

function statusIcon(status: string) {
  switch (status) {
    case "COMPLETED":
    case "APPROVED":
      return <CheckCircle2 className="h-3 w-3 text-emerald-500" />;
    case "IN_PROGRESS":
    case "NEEDS_REVIEW":
      return <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />;
    case "BLOCKED":
      return <Lock className="h-3 w-3 text-red-500" />;
    case "LOCKED":
      return <Lock className="h-3 w-3 text-muted-foreground" />;
    default:
      return <Circle className="h-3 w-3 text-muted-foreground/50" />;
  }
}

export function EngagementWorkspaceShell({ children, phaseSlug, engagementId }: EngagementWorkspaceShellProps) {
  const { user } = useAuth();
  const { activeEngagement } = useWorkspace();
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const userRole = user?.role?.toUpperCase() || "STAFF";

  const { data: phaseState, isLoading: phaseStateLoading, isFetched: phaseStateFetched } = useQuery<EngagementPhaseState>({
    queryKey: ["phase-state", engagementId],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/phase-state/${engagementId}/state?gates=true`);
      if (!res.ok) throw new Error("Failed to load phase state");
      return res.json();
    },
    enabled: !!engagementId,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const workspacePhases = useMemo(() => {
    return getWorkspacePhases().filter(p => isPhaseVisible(p.key, userRole));
  }, [userRole]);

  const currentCanonical = phaseSlug ? getPhaseByKey(phaseSlug) : null;

  const prevPhase = useMemo(() => {
    if (!currentCanonical) return null;
    let prev = getPreviousPhase(currentCanonical.key);
    while (prev && (prev.order < 2 || !isPhaseVisible(prev.key, userRole))) {
      prev = getPreviousPhase(prev.key);
    }
    return prev;
  }, [currentCanonical, userRole]);

  const nextPhase = useMemo(() => {
    if (!currentCanonical) return null;
    let next = getNextPhase(currentCanonical.key);
    while (next && !isPhaseVisible(next.key, userRole)) {
      next = getNextPhase(next.key);
    }
    return next;
  }, [currentCanonical, userRole]);

  const blockerCount = useMemo(() => {
    if (!phaseState?.phases) return 0;
    return phaseState.phases.reduce((count, p) => {
      return count + (p.gateEvaluation?.blockers?.length || 0);
    }, 0);
  }, [phaseState]);

  const completedCount = useMemo(() => {
    if (!phaseState?.phases) return 0;
    return phaseState.phases.filter(p => p.status === "COMPLETED" || p.status === "APPROVED" || p.status === "LOCKED").length;
  }, [phaseState]);

  const resumePhaseSlug = useMemo(() => {
    if (!phaseState?.phases || phaseState.phases.length === 0) return "acceptance";
    const inProgress = phaseState.phases.find(p => p.status === "IN_PROGRESS" || p.status === "NEEDS_REVIEW");
    if (inProgress) return inProgress.phaseKey;
    const firstIncomplete = phaseState.phases.find(p =>
      p.status === "NOT_STARTED" || p.status === "BLOCKED"
    );
    if (firstIncomplete) return firstIncomplete.phaseKey;
    return phaseState.phases[phaseState.phases.length - 1]?.phaseKey || "acceptance";
  }, [phaseState]);

  if (!phaseSlug && engagementId) {
    if (phaseStateLoading || !phaseStateFetched) {
      return (
        <div className="flex items-center justify-center h-full gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading workspace...</span>
        </div>
      );
    }
    return <Redirect to={`/workspace/${engagementId}/${resumePhaseSlug}`} />;
  }

  const clientName = activeEngagement?.clientName || "Client";
  const engagementCode = activeEngagement?.engagementCode || "";
  const periodStart = activeEngagement?.periodStart;
  const periodEnd = activeEngagement?.periodEnd;
  const periodLabel = periodStart && periodEnd
    ? `${new Date(periodStart).toLocaleDateString("en-GB", { month: "short", year: "numeric" })} – ${new Date(periodEnd).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`
    : "";

  const breadcrumbItems = [
    { label: "Engagements", href: "/engagements" },
    { label: clientName, href: `/workspace/${engagementId}/${resumePhaseSlug}` },
    ...(currentCanonical ? [
      { label: PHASE_GROUP_LABELS[currentCanonical.group] || currentCanonical.group },
      { label: currentCanonical.label },
    ] : []),
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-20 bg-background border-b border-border/60 shadow-sm">
        <div className="px-4 py-2">
          <Breadcrumbs items={breadcrumbItems} />

          <div className="flex items-center justify-between gap-3 mt-1.5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-semibold tracking-tight truncate">
                    {currentCanonical?.label || "Workspace"}
                  </h1>
                  {currentCanonical && (
                    <Badge variant="outline" className="text-[10px] font-normal shrink-0">
                      Phase {(currentCanonical.order + 1)}/19
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  <span className="font-medium text-foreground/80">{clientName}</span>
                  {engagementCode && (
                    <>
                      <span className="text-muted-foreground/40">·</span>
                      <span>{engagementCode}</span>
                    </>
                  )}
                  {periodLabel && (
                    <>
                      <span className="text-muted-foreground/40">·</span>
                      <span>{periodLabel}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {blockerCount > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="destructive" className="gap-1 text-xs">
                      <AlertTriangle className="h-3 w-3" />
                      {blockerCount} blocker{blockerCount !== 1 ? "s" : ""}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{blockerCount} gate blocker{blockerCount !== 1 ? "s" : ""} across all phases</p>
                  </TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    {completedCount}/{workspacePhases.length}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{completedCount} of {workspacePhases.length} phases completed</p>
                </TooltipContent>
              </Tooltip>
              <div className="flex items-center gap-1.5 min-w-[120px]">
                <Progress value={phaseState?.overallCompletion || 0} className="h-1.5 flex-1" />
                <span className="text-[10px] text-muted-foreground font-medium w-7 text-right">
                  {phaseState?.overallCompletion || 0}%
                </span>
              </div>
              <Button
                variant={aiPanelOpen ? "default" : "ghost"}
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setAiPanelOpen(!aiPanelOpen)}
              >
                <Bot className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        <div className="px-2 pb-1 overflow-x-auto scrollbar-thin">
          <div className="flex items-center gap-0.5 min-w-max">
            {workspacePhases.map((phase) => {
              const stateEntry = phaseState?.phases?.find(p => p.phaseKey === phase.key);
              const status = stateEntry?.status || "NOT_STARTED";
              const isActive = phaseSlug === phase.key;
              const href = `/workspace/${engagementId}/${phase.routeSlug}`;

              return (
                <Tooltip key={phase.key}>
                  <TooltipTrigger asChild>
                    <Link
                      href={href}
                      className={cn(
                        "flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap",
                        isActive
                          ? "bg-primary/10 text-primary border border-primary/20"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      {statusIcon(status)}
                      <span className="hidden lg:inline">{phase.label}</span>
                      <span className="lg:hidden">{phase.order - 1}</span>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p className="font-medium">{phase.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{phase.description}</p>
                    <p className="text-xs mt-1">
                      Status: <span className="font-medium">{status.replace(/_/g, " ")}</span>
                      {stateEntry?.completionPercentage !== undefined && ` · ${stateEntry.completionPercentage}%`}
                    </p>
                    {stateEntry?.gateEvaluation?.blockers && stateEntry.gateEvaluation.blockers.length > 0 && (
                      <div className="text-xs text-red-400 mt-1">
                        {stateEntry.gateEvaluation.blockers.length} blocker{stateEntry.gateEvaluation.blockers.length !== 1 ? "s" : ""}
                      </div>
                    )}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 overflow-auto">
          <div className="p-4">
            {currentCanonical && (
              <div className="mb-4 flex items-center gap-2 text-sm">
                {(() => {
                  const stateEntry = phaseState?.phases?.find(p => p.phaseKey === phaseSlug);
                  const blockers = stateEntry?.gateEvaluation?.blockers || [];
                  const warnings = stateEntry?.gateEvaluation?.warnings || [];
                  if (blockers.length === 0 && warnings.length === 0) return null;
                  return (
                    <div className="w-full space-y-1.5">
                      {blockers.map((b, i) => (
                        <div key={`b-${i}`} className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-md px-3 py-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                          <span>{b}</span>
                        </div>
                      ))}
                      {warnings.map((w, i) => (
                        <div key={`w-${i}`} className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                          <span>{w}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}

            {children}
          </div>
        </div>

        {aiPanelOpen && currentCanonical && (
          <div className="w-72 border-l bg-muted/30 flex flex-col shrink-0">
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <Bot className="h-4 w-4 text-primary" />
                AI Assistant
              </div>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setAiPanelOpen(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex-1 p-3 overflow-auto">
              <p className="text-xs text-muted-foreground mb-3">
                AI capabilities for <span className="font-medium">{currentCanonical.label}</span>:
              </p>
              {currentCanonical.aiCapabilities.length > 0 ? (
                <div className="space-y-2">
                  {currentCanonical.aiCapabilities.map(cap => (
                    <Button key={cap} variant="outline" size="sm" className="w-full justify-start text-xs h-8">
                      <Bot className="h-3 w-3 mr-1.5 text-primary" />
                      {cap.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                    </Button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/70 italic">No AI capabilities for this phase.</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 z-20 bg-background/95 backdrop-blur-sm border-t border-border/60 px-4 py-2">
        <div className="flex items-center justify-between">
          <div>
            {prevPhase ? (
              <Link href={`/workspace/${engagementId}/${prevPhase.routeSlug}`}>
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                  <ChevronLeft className="h-3.5 w-3.5" />
                  {prevPhase.label}
                </Button>
              </Link>
            ) : (
              <div />
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {currentCanonical && (
              <span>
                {PHASE_GROUP_LABELS[currentCanonical.group] || currentCanonical.group}
                {" · "}
                Phase {currentCanonical.order + 1} of 19
              </span>
            )}
          </div>

          <div>
            {nextPhase ? (
              <Link href={`/workspace/${engagementId}/${nextPhase.routeSlug}`}>
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                  {nextPhase.label}
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            ) : (
              <div />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default EngagementWorkspaceShell;
