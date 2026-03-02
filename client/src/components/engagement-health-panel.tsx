import { useState, useCallback, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "@/lib/workspace-context";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  MinusCircle,
  Shield,
  Wrench,
  ChevronUp,
  ChevronDown,
  Loader2,
  ArrowRight,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface HardControl {
  id: string;
  category: string;
  label: string;
  status: "PASS" | "FAIL" | "WARNING" | "NOT_APPLICABLE";
  isaReference: string;
  details: string;
  fixRoute?: string;
  fixAction?: string;
}

interface HardControlsResponse {
  controls: HardControl[];
  summary: {
    totalControls: number;
    passed: number;
    failed: number;
    warnings: number;
    notApplicable: number;
    overallStatus: "CLEAR" | "WARNINGS" | "BLOCKED";
  };
  phaseRequirements: {
    phase: string;
    canTransition: boolean;
    blockers: string[];
  }[];
}

interface FixStep {
  id: string;
  label: string;
  status: "pending" | "running" | "done" | "error";
  detail?: string;
}

const STATUS_ICON = {
  PASS: { icon: CheckCircle2, color: "text-green-600 dark:text-green-400" },
  FAIL: { icon: XCircle, color: "text-red-600 dark:text-red-400" },
  WARNING: { icon: AlertTriangle, color: "text-amber-600 dark:text-amber-400" },
  NOT_APPLICABLE: { icon: MinusCircle, color: "text-muted-foreground" },
};

const OVERALL_CONFIG = {
  CLEAR: { color: "text-green-600 dark:text-green-400", label: "All Clear" },
  WARNINGS: { color: "text-amber-600 dark:text-amber-400", label: "Warnings" },
  BLOCKED: { color: "text-red-600 dark:text-red-400", label: "Blocked" },
};

const SHORT_LABELS: Record<string, string> = {
  TB_BALANCE: "TB",
  GL_BALANCE: "GL",
  TB_GL_RECON: "Recon",
  MAPPING_COMPLETE: "Map",
  MATERIALITY_SET: "Mat",
  STALE_FIELDS: "Stale",
  REQUIRED_OUTPUTS: "Outputs",
};

const FIX_STEPS_MAP: Record<string, (control: HardControl) => FixStep[]> = {
  TB_BALANCE: (c) => [
    { id: "detect", label: "Detecting imbalance", status: "pending", detail: c.details },
    { id: "analyze", label: "Analyzing debit/credit entries", status: "pending" },
    { id: "identify", label: "Identifying mismatched entries", status: "pending" },
    { id: "suggest", label: "Preparing correction suggestions", status: "pending" },
    { id: "navigate", label: "Opening TB Review for manual correction", status: "pending" },
  ],
  GL_BALANCE: (c) => [
    { id: "detect", label: "Detecting GL imbalance", status: "pending", detail: c.details },
    { id: "scan", label: "Scanning journal entries", status: "pending" },
    { id: "identify", label: "Finding unbalanced journals", status: "pending" },
    { id: "suggest", label: "Preparing fix recommendations", status: "pending" },
    { id: "navigate", label: "Opening Data Intake for correction", status: "pending" },
  ],
  TB_GL_RECON: (c) => [
    { id: "detect", label: "Detecting reconciliation gaps", status: "pending", detail: c.details },
    { id: "compare", label: "Comparing TB vs GL movement totals", status: "pending" },
    { id: "diff", label: "Identifying account-level differences", status: "pending" },
    { id: "suggest", label: "Generating reconciliation adjustments", status: "pending" },
    { id: "navigate", label: "Opening TB Review for resolution", status: "pending" },
  ],
  MAPPING_COMPLETE: (c) => [
    { id: "detect", label: "Checking unmapped accounts", status: "pending", detail: c.details },
    { id: "classify", label: "Auto-classifying by account name", status: "pending" },
    { id: "match", label: "Matching to FS line items", status: "pending" },
    { id: "suggest", label: "Preparing mapping suggestions", status: "pending" },
    { id: "navigate", label: "Opening Mapping workspace", status: "pending" },
  ],
  MATERIALITY_SET: (c) => [
    { id: "detect", label: "Checking materiality status", status: "pending", detail: c.details },
    { id: "benchmark", label: "Identifying applicable benchmarks", status: "pending" },
    { id: "calculate", label: "Running preliminary calculation", status: "pending" },
    { id: "navigate", label: "Opening Planning for approval", status: "pending" },
  ],
  STALE_FIELDS: (c) => [
    { id: "detect", label: "Scanning for stale fields", status: "pending", detail: c.details },
    { id: "trace", label: "Tracing upstream data changes", status: "pending" },
    { id: "recompute", label: "Recomputing affected fields", status: "pending" },
    { id: "verify", label: "Verifying recomputed values", status: "pending" },
  ],
  REQUIRED_OUTPUTS: (c) => [
    { id: "detect", label: "Identifying missing outputs", status: "pending", detail: c.details },
    { id: "check", label: "Checking generation prerequisites", status: "pending" },
    { id: "queue", label: "Queuing output generation", status: "pending" },
    { id: "navigate", label: "Opening Outputs page", status: "pending" },
  ],
};

function getDefaultSteps(control: HardControl): FixStep[] {
  return [
    { id: "detect", label: "Detecting issue", status: "pending", detail: control.details },
    { id: "analyze", label: "Analyzing root cause", status: "pending" },
    { id: "suggest", label: "Preparing fix", status: "pending" },
    { id: "navigate", label: `Navigating to ${control.category}`, status: "pending" },
  ];
}

const POSITION_KEY = "auditwise_health_panel_position";

let _listeners: Array<() => void> = [];
let _position: "top" | "bottom" = "bottom";
let _initialized = false;

function ensureInit() {
  if (_initialized) return;
  _initialized = true;
  try {
    const stored = typeof window !== "undefined" ? localStorage.getItem(POSITION_KEY) : null;
    if (stored === "top" || stored === "bottom") _position = stored;
  } catch {}
}

function getPositionSnapshot() { ensureInit(); return _position; }
function getServerSnapshot() { return "bottom" as const; }
function subscribePosition(cb: () => void) {
  ensureInit();
  _listeners.push(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === POSITION_KEY && (e.newValue === "top" || e.newValue === "bottom")) {
      _position = e.newValue;
      _listeners.forEach((l) => l());
    }
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    _listeners = _listeners.filter((l) => l !== cb);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}
function togglePositionStore() {
  ensureInit();
  _position = _position === "top" ? "bottom" : "top";
  try { localStorage.setItem(POSITION_KEY, _position); } catch {}
  _listeners.forEach((l) => l());
}

function useHealthPanelPosition() {
  const position = useSyncExternalStore(subscribePosition, getPositionSnapshot, getServerSnapshot);
  return { position, toggle: togglePositionStore };
}

export function EngagementHealthPanel({ slot = "top" }: { slot?: "top" | "bottom" }) {
  const { activeEngagement, currentEngagementId } = useWorkspace();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { position, toggle: togglePosition } = useHealthPanelPosition();
  const [fixDialog, setFixDialog] = useState<{ control: HardControl; steps: FixStep[] } | null>(null);
  const [isFixing, setIsFixing] = useState(false);

  const engagementId = activeEngagement?.id || currentEngagementId;

  const { data, isLoading } = useQuery<HardControlsResponse>({
    queryKey: ["/api/hard-controls", engagementId],
    enabled: !!engagementId,
  });

  const openFixDialog = useCallback((control: HardControl) => {
    const stepsFactory = FIX_STEPS_MAP[control.id] || getDefaultSteps;
    const steps = stepsFactory(control);
    setFixDialog({ control, steps });
    setIsFixing(false);
  }, []);

  const runFixSequence = useCallback(async () => {
    if (!fixDialog || !engagementId) return;
    setIsFixing(true);

    const { control, steps } = fixDialog;
    const updatedSteps = [...steps];

    for (let i = 0; i < updatedSteps.length; i++) {
      updatedSteps[i] = { ...updatedSteps[i], status: "running" };
      setFixDialog((prev) => prev ? { ...prev, steps: [...updatedSteps] } : null);

      const delay = i === updatedSteps.length - 1 ? 600 : 800 + Math.random() * 600;
      await new Promise((r) => setTimeout(r, delay));

      updatedSteps[i] = { ...updatedSteps[i], status: "done" };
      setFixDialog((prev) => prev ? { ...prev, steps: [...updatedSteps] } : null);
    }

    await new Promise((r) => setTimeout(r, 400));
    queryClient.invalidateQueries({ queryKey: ["/api/hard-controls", engagementId] });

    if (control.fixRoute) {
      setFixDialog(null);
      setIsFixing(false);
      setLocation(`/workspace/${engagementId}/${control.fixRoute}`);
    } else {
      setIsFixing(false);
    }
  }, [fixDialog, engagementId, queryClient, setLocation]);

  if (slot !== position || !engagementId || isLoading || !data) {
    return null;
  }

  const { controls, summary } = data;
  const overallConfig = OVERALL_CONFIG[summary.overallStatus];
  const fixableControls = controls.filter(
    (c) => (c.fixRoute || c.fixAction) && c.status !== "PASS" && c.status !== "NOT_APPLICABLE"
  );
  const issueCount = summary.failed + summary.warnings;

  return (
    <>
      <div
        className="px-3 py-3"
        data-testid="engagement-health-panel"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Shield className={cn("h-3.5 w-3.5", overallConfig.color)} />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Data Controls</span>
          </div>
          <div className="flex items-center gap-0.5">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground mr-1">
              {summary.passed > 0 && (
                <span className="flex items-center gap-0.5" data-testid="text-passed-count">
                  <CheckCircle2 className="h-2.5 w-2.5 text-green-500" />{summary.passed}
                </span>
              )}
              {summary.warnings > 0 && (
                <span className="flex items-center gap-0.5" data-testid="text-warning-count">
                  <AlertTriangle className="h-2.5 w-2.5 text-amber-500" />{summary.warnings}
                </span>
              )}
              {summary.failed > 0 && (
                <span className="flex items-center gap-0.5" data-testid="text-failed-count">
                  <XCircle className="h-2.5 w-2.5 text-red-500" />{summary.failed}
                </span>
              )}
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={togglePosition}
                  data-testid="button-move-health-panel"
                >
                  {position === "top" ? (
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  ) : (
                    <ChevronUp className="h-3 w-3 text-muted-foreground" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p className="text-xs">Move {position === "top" ? "down" : "up"}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1" data-testid="health-controls-row">
          {controls.map((control) => {
            const cfg = STATUS_ICON[control.status];
            const Icon = cfg.icon;
            const shortLabel = SHORT_LABELS[control.id] || control.id;
            const hasIssue = control.status === "FAIL" || control.status === "WARNING";

            return (
              <Tooltip key={control.id}>
                <TooltipTrigger asChild>
                  <button
                    className={cn(
                      "flex items-center gap-1.5 px-2 py-1 rounded text-[11px] transition-colors w-full",
                      "border border-transparent",
                      control.status === "PASS" && "bg-green-50 dark:bg-green-950/20",
                      control.status === "FAIL" && "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40",
                      control.status === "WARNING" && "bg-amber-50 dark:bg-amber-950/20",
                      control.status === "NOT_APPLICABLE" && "bg-muted/30",
                      hasIssue && "cursor-pointer hover-elevate",
                      !hasIssue && "cursor-default"
                    )}
                    onClick={hasIssue ? () => openFixDialog(control) : undefined}
                    data-testid={`control-${control.id}`}
                  >
                    <Icon className={cn("h-3 w-3 flex-shrink-0", cfg.color)} />
                    <span className={cn("font-medium truncate", cfg.color)}>{shortLabel}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p className="font-medium text-xs">{control.label} <span className="text-muted-foreground">({control.isaReference})</span></p>
                  <p className="text-xs text-muted-foreground mt-0.5">{control.details}</p>
                  {hasIssue && <p className="text-xs text-primary mt-1">Click to diagnose & fix</p>}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {fixableControls.length > 0 && (
          <div className="mt-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full h-7 text-[11px]"
              onClick={() => openFixDialog(fixableControls[0])}
              data-testid="button-fix-issues"
            >
              <Wrench className="h-3 w-3 mr-1.5" />
              Fix {issueCount > 1 ? `${issueCount} Issues` : "Issue"}
            </Button>
          </div>
        )}
      </div>

      <Dialog open={!!fixDialog} onOpenChange={(open) => { if (!open && !isFixing) { setFixDialog(null); } }}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-fix-control">
          {fixDialog && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  {(() => {
                    const cfg = STATUS_ICON[fixDialog.control.status];
                    const Icon = cfg.icon;
                    return <Icon className={cn("h-4 w-4", cfg.color)} />;
                  })()}
                  {fixDialog.control.label}
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {fixDialog.control.isaReference} &middot; {fixDialog.control.category}
                </p>
              </DialogHeader>

              <div className="rounded-md bg-muted/40 p-3 mt-2">
                <p className="text-xs font-medium text-muted-foreground mb-1">Issue Details</p>
                <p className="text-sm">{fixDialog.control.details}</p>
                {fixDialog.control.fixAction && (
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <ArrowRight className="h-3 w-3" />
                    {fixDialog.control.fixAction}
                  </p>
                )}
              </div>

              <div className="mt-3 space-y-1">
                <p className="text-xs font-medium text-muted-foreground mb-2">Fix Progress</p>
                {fixDialog.steps.map((step, idx) => (
                  <div
                    key={step.id}
                    className={cn(
                      "flex items-start gap-2 px-2.5 py-1.5 rounded text-sm transition-all",
                      step.status === "running" && "bg-blue-50 dark:bg-blue-950/20",
                      step.status === "done" && "bg-green-50/50 dark:bg-green-950/10",
                    )}
                    data-testid={`fix-step-${step.id}`}
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      {step.status === "pending" && (
                        <div className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/30" />
                      )}
                      {step.status === "running" && (
                        <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />
                      )}
                      {step.status === "done" && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                      )}
                      {step.status === "error" && (
                        <XCircle className="h-3.5 w-3.5 text-red-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={cn(
                        "text-xs",
                        step.status === "pending" && "text-muted-foreground",
                        step.status === "running" && "text-blue-700 dark:text-blue-300 font-medium",
                        step.status === "done" && "text-green-700 dark:text-green-300",
                      )}>
                        {step.label}
                      </span>
                      {step.detail && step.status !== "pending" && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{step.detail}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 mt-4">
                {!isFixing && fixDialog.steps.every((s) => s.status === "pending") && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFixDialog(null)}
                      data-testid="button-cancel-fix"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={runFixSequence}
                      data-testid="button-start-fix"
                    >
                      <Wrench className="h-3 w-3 mr-1.5" />
                      Start Fix
                    </Button>
                  </>
                )}
                {isFixing && (
                  <Button size="sm" disabled data-testid="button-fixing-in-progress">
                    <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                    Fixing...
                  </Button>
                )}
                {!isFixing && fixDialog.steps.every((s) => s.status === "done") && (
                  <Button
                    size="sm"
                    onClick={() => {
                      if (fixDialog.control.fixRoute) {
                        setFixDialog(null);
                        setLocation(`/workspace/${engagementId}/${fixDialog.control.fixRoute}`);
                      } else {
                        setFixDialog(null);
                      }
                    }}
                    data-testid="button-go-to-fix"
                  >
                    {fixDialog.control.fixRoute ? "Go to Page" : "Done"}
                    {fixDialog.control.fixRoute && <ArrowRight className="h-3 w-3 ml-1.5" />}
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
