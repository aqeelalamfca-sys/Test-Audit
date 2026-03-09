import { useEnforcementOptional, type EnforcementPhase } from "@/lib/enforcement-context";
import { cn } from "@/lib/utils";
import { CheckCircle2, Lock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const PHASE_LABELS: Record<EnforcementPhase, string> = {
  ADMINISTRATION: "Admin",
  PRE_PLANNING: "Pre-Planning",
  REQUISITION: "Data Intake",
  PLANNING: "Planning",
  EXECUTION: "Execution",
  EVIDENCE: "Evidence",
  FINALIZATION: "Finalization",
  DELIVERABLES: "Deliverables",
  QR_EQCR: "QR",
  INSPECTION: "Inspection"
};

const PHASE_ORDER: EnforcementPhase[] = [
  "REQUISITION",
  "PRE_PLANNING",
  "PLANNING",
  "EXECUTION",
  "EVIDENCE",
  "FINALIZATION",
  "DELIVERABLES",
  "QR_EQCR",
  "INSPECTION"
];

function getProgressColor(percent: number) {
  if (percent >= 100) return { text: "text-green-600 dark:text-green-400", bg: "bg-green-500", border: "border-green-500", fill: "bg-green-100 dark:bg-green-950", barTrack: "bg-green-100 dark:bg-green-900", stroke: "#22c55e" };
  if (percent >= 70) return { text: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500", border: "border-amber-400", fill: "bg-amber-50 dark:bg-amber-950/40", barTrack: "bg-amber-100 dark:bg-amber-900", stroke: "#f59e0b" };
  return { text: "text-red-600 dark:text-red-400", bg: "bg-red-500", border: "border-red-400", fill: "bg-red-50 dark:bg-red-950/40", barTrack: "bg-red-100 dark:bg-red-900", stroke: "#ef4444" };
}

export function GlobalStatusBar() {
  const enforcement = useEnforcementOptional();

  if (!enforcement || !enforcement.status) {
    return null;
  }

  const { status } = enforcement;

  const phaseProgressData = PHASE_ORDER.map(phase => {
    const progress = enforcement.getPhaseProgress(phase);
    const phaseStatus = status.phaseStatus[phase];
    const isComplete = phaseStatus?.isComplete ?? false;
    const percent = isComplete ? 100 : progress.percent;
    return { phase, percent, isComplete, passed: progress.passed, total: progress.total };
  });

  const totalPhases = phaseProgressData.length;
  const overallPercent = totalPhases > 0
    ? Math.round(phaseProgressData.reduce((sum, p) => sum + p.percent, 0) / totalPhases)
    : 0;
  const overallColor = getProgressColor(overallPercent);

  return (
    <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center justify-between px-3 py-2 gap-2">
        <div className="flex items-center gap-0.5 overflow-x-auto flex-1 min-w-0" data-testid="phase-navigation-bar">
          {phaseProgressData.map(({ phase, percent, isComplete, passed, total }, idx) => {
            const color = getProgressColor(percent);
            const isCurrent = phase === status.currentPhase;
            
            return (
              <div key={phase} className="flex items-center" data-testid={`phase-tab-${phase}`}>
                {idx > 0 && (
                  <div className={cn(
                    "w-3 h-0.5 mx-0.5 flex-shrink-0 transition-colors",
                    percent >= 100 ? "bg-green-500" : "bg-muted-foreground/20"
                  )} />
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={cn(
                      "flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs border transition-all cursor-default flex-shrink-0",
                      isCurrent && "ring-2 ring-primary/30",
                      color.fill,
                      isComplete ? "border-green-500" : isCurrent ? "border-primary" : color.border + "/40"
                    )}>
                      {isComplete ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                      ) : (
                        <div className="relative h-3.5 w-3.5 flex-shrink-0">
                          <svg viewBox="0 0 36 36" className="h-3.5 w-3.5 -rotate-90">
                            <path
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="4"
                              className="text-muted-foreground/20"
                            />
                            <path
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                              fill="none"
                              strokeWidth="4"
                              strokeDasharray={`${percent}, 100`}
                              stroke={color.stroke}
                              strokeLinecap="round"
                            />
                          </svg>
                        </div>
                      )}
                      <span className="hidden sm:inline whitespace-nowrap font-medium">
                        {PHASE_LABELS[phase]}
                      </span>
                      <span className={cn(
                        "text-[10px] font-bold tabular-nums",
                        color.text
                      )} data-testid={`progress-percent-${phase}`}>
                        {percent}%
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <div className="space-y-2 py-1">
                      <p className="font-semibold">{PHASE_LABELS[phase]}</p>
                      <div className="flex items-center gap-2">
                        <div className={cn("w-full h-2 rounded-full overflow-hidden", color.barTrack)}>
                          <div 
                            className={cn("h-full rounded-full transition-all", color.bg)}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <span className={cn("text-xs font-bold tabular-nums", color.text)}>{percent}%</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {passed}/{total} gates completed
                      </p>
                      {isComplete && (
                        <p className="text-xs text-green-500 font-medium">Phase Complete</p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-3 ml-2 flex-shrink-0">
          {status.isInspectionMode && (
            <div className="flex items-center gap-1 text-xs text-blue-500 bg-blue-50 dark:bg-blue-950 px-2 py-1 rounded">
              <Lock className="h-3 w-3" />
              <span>Read-Only</span>
            </div>
          )}

          <div className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-lg" data-testid="overall-progress">
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Overall</span>
            <div className={cn("w-20 h-2 rounded-full overflow-hidden", overallColor.barTrack)}>
              <div 
                className={cn("h-full rounded-full transition-all duration-500", overallColor.bg)}
                style={{ width: `${overallPercent}%` }}
              />
            </div>
            <span className={cn("text-xs font-bold tabular-nums min-w-[2rem] text-right", overallColor.text)} data-testid="overall-progress-percent">
              {overallPercent}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
