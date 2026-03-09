import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Lock, CheckCircle2, Circle, AlertCircle, ArrowRight } from "lucide-react";

export type AuditStepStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "PREPARED"
  | "IN_REVIEW"
  | "RETURNED"
  | "APPROVED"
  | "LOCKED";

export interface AuditPhaseStep {
  id: string;
  label: string;
  shortLabel?: string;
  isaRef?: string;
  status: AuditStepStatus;
  completionPercent: number;
  isActive?: boolean;
  isLocked?: boolean;
  lockReason?: string;
  onClick?: () => void;
}

const TRAFFIC_LIGHT: Record<string, { color: string; bg: string; ring: string; label: string }> = {
  NOT_STARTED: { color: "bg-gray-400", bg: "bg-gray-50 dark:bg-gray-900", ring: "ring-gray-300 dark:ring-gray-700", label: "Not Started" },
  IN_PROGRESS: { color: "bg-amber-400", bg: "bg-amber-50 dark:bg-amber-950", ring: "ring-amber-300 dark:ring-amber-700", label: "In Progress" },
  COMPLETED: { color: "bg-blue-400", bg: "bg-blue-50 dark:bg-blue-950", ring: "ring-blue-300 dark:ring-blue-700", label: "Completed" },
  PREPARED: { color: "bg-blue-500", bg: "bg-blue-50 dark:bg-blue-950", ring: "ring-blue-400 dark:ring-blue-600", label: "Prepared" },
  IN_REVIEW: { color: "bg-amber-500", bg: "bg-amber-50 dark:bg-amber-950", ring: "ring-amber-400 dark:ring-amber-600", label: "In Review" },
  RETURNED: { color: "bg-red-500", bg: "bg-red-50 dark:bg-red-950", ring: "ring-red-400 dark:ring-red-600", label: "Returned" },
  APPROVED: { color: "bg-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950", ring: "ring-emerald-400 dark:ring-emerald-600", label: "Approved" },
  LOCKED: { color: "bg-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950", ring: "ring-emerald-500 dark:ring-emerald-500", label: "Locked" },
};

function getTrafficColor(status: AuditStepStatus): "red" | "amber" | "green" {
  if (status === "NOT_STARTED" || status === "RETURNED") return "red";
  if (status === "APPROVED" || status === "LOCKED") return "green";
  return "amber";
}

const TRAFFIC_DOT_COLORS = {
  red: "bg-red-500",
  amber: "bg-amber-500",
  green: "bg-emerald-500",
};

function StepIcon({ status, isLocked }: { status: AuditStepStatus; isLocked?: boolean }) {
  if (isLocked) return <Lock className="h-3 w-3 text-muted-foreground" />;
  if (status === "APPROVED" || status === "LOCKED") return <CheckCircle2 className="h-3 w-3 text-emerald-600" />;
  if (status === "RETURNED") return <AlertCircle className="h-3 w-3 text-red-500" />;
  if (status === "NOT_STARTED") return <Circle className="h-3 w-3 text-muted-foreground" />;
  return <Circle className="h-3 w-3 text-blue-500 fill-blue-500" />;
}

interface AuditPhaseStepperProps {
  steps: AuditPhaseStep[];
  className?: string;
  compact?: boolean;
}

export function AuditPhaseStepper({ steps, className, compact = false }: AuditPhaseStepperProps) {
  const completedCount = steps.filter(s => s.status === "APPROVED" || s.status === "LOCKED").length;
  const overallPercent = steps.length > 0
    ? Math.round(steps.reduce((a, s) => a + s.completionPercent, 0) / steps.length)
    : 0;

  return (
    <div className={cn("w-full", className)} data-testid="audit-phase-stepper">
      {!compact && (
        <div className="flex items-center justify-between mb-1.5 px-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Audit Lifecycle</span>
            <Badge variant="outline" className="text-[10px] h-4 px-1.5">
              {completedCount}/{steps.length}
            </Badge>
          </div>
          <span className="text-[10px] text-muted-foreground">{overallPercent}% overall</span>
        </div>
      )}

      <div className="flex items-center gap-0" data-testid="stepper-steps">
        {steps.map((step, index) => {
          const traffic = getTrafficColor(step.status);
          const config = TRAFFIC_LIGHT[step.status];
          const isLast = index === steps.length - 1;

          const stepContent = (
            <button
              key={step.id}
              onClick={step.isLocked ? undefined : step.onClick}
              disabled={step.isLocked}
              className={cn(
                "relative flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-all",
                "focus:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                step.isActive
                  ? cn("ring-1", config.ring, config.bg, "font-semibold")
                  : step.isLocked
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-muted/60 cursor-pointer"
              )}
              data-testid={`stepper-step-${step.id}`}
            >
              <div className={cn("w-2 h-2 rounded-full flex-shrink-0", TRAFFIC_DOT_COLORS[traffic])} />
              <StepIcon status={step.status} isLocked={step.isLocked} />
              <span className={cn(
                "hidden lg:inline truncate max-w-[80px]",
                step.isActive ? "text-foreground" : "text-muted-foreground"
              )}>
                {step.shortLabel || step.label}
              </span>
              {step.completionPercent > 0 && step.completionPercent < 100 && (
                <span className="text-[9px] text-muted-foreground">{step.completionPercent}%</span>
              )}
            </button>
          );

          return (
            <div key={step.id} className="flex items-center">
              <Tooltip>
                <TooltipTrigger asChild>{stepContent}</TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                  <div className="space-y-1">
                    <div className="font-medium">{step.label}</div>
                    {step.isaRef && <div className="text-muted-foreground">{step.isaRef}</div>}
                    <div className="flex items-center gap-1.5">
                      <div className={cn("w-2 h-2 rounded-full", TRAFFIC_DOT_COLORS[traffic])} />
                      <span>{config.label}</span>
                      <span className="text-muted-foreground">({step.completionPercent}%)</span>
                    </div>
                    {step.isLocked && step.lockReason && (
                      <div className="text-amber-600 dark:text-amber-400 text-[10px]">{step.lockReason}</div>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
              {!isLast && (
                <ArrowRight className="h-3 w-3 text-muted-foreground/40 mx-0.5 flex-shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TrafficLightDot({ status, size = "sm" }: { status: AuditStepStatus; size?: "sm" | "md" }) {
  const traffic = getTrafficColor(status);
  const sizeClass = size === "md" ? "w-2.5 h-2.5" : "w-2 h-2";
  return <div className={cn("rounded-full", sizeClass, TRAFFIC_DOT_COLORS[traffic])} />;
}

export function StatusPill({ status, className }: { status: AuditStepStatus; className?: string }) {
  const config = TRAFFIC_LIGHT[status];
  const traffic = getTrafficColor(status);
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] h-5 px-1.5 gap-1 font-medium",
        traffic === "green" && "border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400",
        traffic === "amber" && "border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400",
        traffic === "red" && "border-red-300 text-red-700 dark:border-red-700 dark:text-red-400",
        className
      )}
      data-testid={`status-pill-${status.toLowerCase()}`}
    >
      <div className={cn("w-1.5 h-1.5 rounded-full", TRAFFIC_DOT_COLORS[traffic])} />
      {config.label}
    </Badge>
  );
}
