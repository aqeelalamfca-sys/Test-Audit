import { ReactNode, useMemo, useState } from "react";
import { Redirect, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useWorkspace, WORKSPACE_PHASES, isPhaseVisible } from "@/lib/workspace-context";
import { useAuth } from "@/lib/auth";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Loader2, Bot, X, ChevronRight } from "lucide-react";
import { getPhaseByKey } from "../../../shared/phases";

interface EngagementWorkspaceShellProps {
  children: ReactNode;
  phaseSlug?: string;
  engagementId: string;
}

interface PhaseStateEntry {
  phaseKey: string;
  status: string;
  gateEvaluation?: {
    blockers: string[];
    warnings: string[];
  } | null;
}

interface EngagementPhaseState {
  engagementId: string;
  phases: PhaseStateEntry[];
}

export function EngagementWorkspaceShell({ children, phaseSlug, engagementId }: EngagementWorkspaceShellProps) {
  const { activeEngagement } = useWorkspace();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [aiPanelOpen, setAiPanelOpen] = useState(false);

  const userRole = user?.role?.toUpperCase() || "STAFF";
  const visiblePhases = WORKSPACE_PHASES.filter((phase) => isPhaseVisible(phase.key, userRole));

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

  const currentCanonical = phaseSlug ? getPhaseByKey(phaseSlug) : null;

  const resumePhaseSlug = useMemo(() => {
    if (!phaseState?.phases || phaseState.phases.length === 0) return "acceptance";
    const inProgress = phaseState.phases.find((p) => p.status === "IN_PROGRESS" || p.status === "NEEDS_REVIEW");
    if (inProgress) return inProgress.phaseKey;
    const firstIncomplete = phaseState.phases.find((p) => p.status === "NOT_STARTED" || p.status === "BLOCKED");
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
    ? `${new Date(periodStart).toLocaleDateString("en-GB", { month: "short", year: "numeric" })} - ${new Date(periodEnd).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`
    : "";

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-20 bg-background border-b border-border/60">
        <div className="px-4 py-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground/80">{clientName}</span>
                {engagementCode && <><ChevronRight className="h-3 w-3 opacity-40 shrink-0" /><span>{engagementCode}</span></>}
                {periodLabel && <><ChevronRight className="h-3 w-3 opacity-40 shrink-0" /><span>{periodLabel}</span></>}
              </div>
            </div>
            {currentCanonical && phaseSlug && visiblePhases.length > 0 && (
              <div className="flex items-center gap-1.5">
                <label htmlFor="phase-nav-select" className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">
                  Phase:
                </label>
                <Select
                  value={phaseSlug}
                  onValueChange={(val) => navigate(`/workspace/${engagementId}/${val}`)}
                >
                  <SelectTrigger id="phase-nav-select" className="h-7 w-52 text-xs font-medium border-primary/30 bg-primary/5" aria-label="Navigate to phase">
                    <SelectValue placeholder="Select phase" />
                  </SelectTrigger>
                  <SelectContent>
                    {visiblePhases.map((phase) => (
                      <SelectItem key={phase.key} value={phase.key} className="text-xs">
                        {phase.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {currentCanonical && (
            <Button
              variant={aiPanelOpen ? "default" : "ghost"}
              size="sm"
              className="h-7 w-7 p-0 shrink-0"
              onClick={() => setAiPanelOpen(!aiPanelOpen)}
              title="Toggle AI panel"
            >
              <Bot className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 overflow-auto">
          <div className="p-3 pt-2">
            {currentCanonical && (
              <div className="mb-4 flex items-center gap-2 text-sm">
                {(() => {
                  const stateEntry = phaseState?.phases?.find((p) => p.phaseKey === phaseSlug);
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
                  {currentCanonical.aiCapabilities.map((cap) => (
                    <Button key={cap} variant="outline" size="sm" className="w-full justify-start text-xs h-8">
                      <Bot className="h-3 w-3 mr-1.5 text-primary" />
                      {cap.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
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
    </div>
  );
}

export default EngagementWorkspaceShell;
