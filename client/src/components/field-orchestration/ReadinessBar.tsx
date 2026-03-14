import { cn } from "@/lib/utils";
import { CheckCircle, AlertCircle, Clock, Lock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface MissingField {
  fieldKey: string;
  label: string;
  reason: string;
}

interface ReadinessData {
  module: string;
  tab?: string;
  totalFields: number;
  completedFields: number;
  readinessPercentage: number;
  missingFields: MissingField[];
  isBlocked: boolean;
  signOffLevel: string;
}

interface ReadinessBarProps {
  data: ReadinessData;
  variant?: "compact" | "detailed";
  showMissingFields?: boolean;
  className?: string;
}

const signOffBadgeVariants: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  NONE: { label: "Not Started", variant: "outline" },
  PREPARED: { label: "Prepared", variant: "secondary" },
  REVIEWED: { label: "Reviewed", variant: "default" },
  APPROVED: { label: "Approved", variant: "default" },
};

export function ReadinessBar({
  data,
  variant = "compact",
  showMissingFields = false,
  className,
}: ReadinessBarProps) {
  const { readinessPercentage, completedFields, totalFields, missingFields, signOffLevel, isBlocked } = data;

  const getProgressColor = () => {
    if (readinessPercentage === 100) return "bg-green-500";
    if (readinessPercentage >= 75) return "bg-blue-500";
    if (readinessPercentage >= 50) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getStatusIcon = () => {
    if (signOffLevel === "APPROVED") {
      return <Lock className="h-4 w-4 text-green-500" data-testid="icon-approved" />;
    }
    if (readinessPercentage === 100) {
      return <CheckCircle className="h-4 w-4 text-green-500" data-testid="icon-complete" />;
    }
    if (isBlocked) {
      return <AlertCircle className="h-4 w-4 text-red-500" data-testid="icon-blocked" />;
    }
    return <Clock className="h-4 w-4 text-muted-foreground" data-testid="icon-pending" />;
  };

  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-2", className)} data-testid="readiness-bar-compact">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2 cursor-help">
              {getStatusIcon()}
              <Progress
                value={readinessPercentage}
                className="w-24 h-2"
                data-testid="progress-bar"
              />
              <span className="text-sm text-muted-foreground" data-testid="text-percentage">
                {readinessPercentage}%
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{completedFields} of {totalFields} fields completed</p>
            {missingFields.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Missing: {missingFields.map(f => f.label).slice(0, 3).join(", ")}
                {missingFields.length > 3 && ` (+${missingFields.length - 3} more)`}
              </p>
            )}
          </TooltipContent>
        </Tooltip>
        <Badge
          variant={signOffBadgeVariants[signOffLevel]?.variant || "outline"}
          data-testid="badge-signoff"
        >
          {signOffBadgeVariants[signOffLevel]?.label || signOffLevel}
        </Badge>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)} data-testid="readiness-bar-detailed">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="font-medium" data-testid="text-module">{data.module}</span>
          {data.tab && (
            <span className="text-muted-foreground">/ {data.tab}</span>
          )}
        </div>
        <Badge
          variant={signOffBadgeVariants[signOffLevel]?.variant || "outline"}
          data-testid="badge-signoff-detailed"
        >
          {signOffBadgeVariants[signOffLevel]?.label || signOffLevel}
        </Badge>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Completion</span>
          <span data-testid="text-completion">
            {completedFields} / {totalFields} fields ({readinessPercentage}%)
          </span>
        </div>
        <Progress
          value={readinessPercentage}
          className="h-2"
          data-testid="progress-bar-detailed"
        />
      </div>

      {showMissingFields && missingFields.length > 0 && (
        <div className="space-y-2" data-testid="missing-fields-list">
          <p className="text-sm text-muted-foreground">Missing Fields:</p>
          <ul className="text-sm space-y-1">
            {missingFields.map((field) => (
              <li
                key={field.fieldKey}
                className="flex items-center gap-2 text-red-600 dark:text-red-400"
                data-testid={`missing-field-${field.fieldKey}`}
              >
                <AlertCircle className="h-3 w-3" />
                <span>{field.label}</span>
                <span className="text-xs text-muted-foreground">({field.reason})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isBlocked && (
        <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400" data-testid="blocked-message">
          <AlertCircle className="h-4 w-4" />
          <span>This section is blocked. Complete missing fields to proceed.</span>
        </div>
      )}
    </div>
  );
}

interface ModuleReadinessCardProps {
  modules: ReadinessData[];
  overallReadiness: number;
  className?: string;
}

export function ModuleReadinessCard({
  modules,
  overallReadiness,
  className,
}: ModuleReadinessCardProps) {
  return (
    <div className={cn("rounded-lg border bg-card p-2.5 space-y-2.5", className)} data-testid="module-readiness-card">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold" data-testid="text-title">Field Readiness Status</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Overall:</span>
          <Badge
            variant={overallReadiness === 100 ? "default" : "secondary"}
            data-testid="badge-overall"
          >
            {overallReadiness}%
          </Badge>
        </div>
      </div>

      <div className="space-y-3">
        {modules.map((mod) => (
          <div key={`${mod.module}-${mod.tab || ""}`} className="flex items-center justify-between py-2 border-b last:border-0">
            <span className="text-sm font-medium" data-testid={`text-module-${mod.module}`}>
              {mod.module.replace(/_/g, " ")}
            </span>
            <ReadinessBar data={mod} variant="compact" />
          </div>
        ))}
      </div>
    </div>
  );
}
