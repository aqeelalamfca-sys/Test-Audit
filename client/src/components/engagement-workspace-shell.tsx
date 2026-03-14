import { ReactNode, useMemo, useState } from "react";
import { Redirect } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useWorkspace } from "@/lib/workspace-context";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2, Sparkles, X } from "lucide-react";
import { getPhaseByKey } from "../../../shared/phases";
import { AICopilotEnhanced } from "@/components/ai-copilot-enhanced";

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
  const [aiPanelOpen, setAiPanelOpen] = useState(false);

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

  const clientName = activeEngagement?.client?.name || "Client";
  const engagementCode = activeEngagement?.engagementCode || "";
  const periodStart = activeEngagement?.periodStart;
  const periodEnd = activeEngagement?.periodEnd;
  const periodLabel = periodStart && periodEnd
    ? `${new Date(periodStart).toLocaleDateString("en-GB", { month: "short", year: "numeric" })} - ${new Date(periodEnd).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`
    : "";

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-20 bg-background border-b border-border/60">
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight truncate">{currentCanonical?.label || "Workspace"}</h1>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
              <span className="font-medium text-foreground/80">{clientName}</span>
              {engagementCode && <span>{engagementCode}</span>}
              {periodLabel && <span>{periodLabel}</span>}
            </div>
          </div>

          {currentCanonical && (
            <Button
              variant={aiPanelOpen ? "default" : "ghost"}
              size="sm"
              className={`h-7 px-2.5 shrink-0 gap-1.5 text-xs ${aiPanelOpen ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700" : ""}`}
              onClick={() => setAiPanelOpen(!aiPanelOpen)}
              title="Toggle Audit Copilot"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {!aiPanelOpen && "Copilot"}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 overflow-auto">
          <div className="p-4">
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
          <AICopilotEnhanced
            engagementId={engagementId}
            collapsed={false}
            onToggleCollapse={() => setAiPanelOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

export default EngagementWorkspaceShell;
