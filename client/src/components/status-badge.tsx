import { Badge } from "@/components/ui/badge";
import { Check, Clock, Lock, AlertCircle, Loader2 } from "lucide-react";
import { PhaseStatusType, ChecklistItemStatusType } from "@shared/schema";
import { cn } from "@/lib/utils";

interface PhaseStatusBadgeProps {
  status: PhaseStatusType;
  className?: string;
}

const phaseStatusConfig: Record<PhaseStatusType, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType; className?: string }> = {
  not_started: { label: "Not Started", variant: "outline", icon: Clock, className: "text-muted-foreground border-muted" },
  in_progress: { label: "In Progress", variant: "default", icon: Loader2, className: "bg-blue-600 text-white dark:bg-blue-500" },
  under_review: { label: "Under Review", variant: "secondary", icon: AlertCircle, className: "bg-amber-500 text-white dark:bg-amber-600" },
  completed: { label: "Completed", variant: "default", icon: Check, className: "bg-green-600 text-white dark:bg-green-500" },
  locked: { label: "Locked", variant: "secondary", icon: Lock, className: "bg-muted text-muted-foreground" },
};

export function PhaseStatusBadge({ status, className }: PhaseStatusBadgeProps) {
  const config = phaseStatusConfig[status];
  const Icon = config.icon;

  return (
    <Badge
      variant={config.variant}
      className={cn("gap-1.5 px-2.5 py-0.5 text-xs font-medium", config.className, className)}
      data-testid={`badge-phase-status-${status}`}
    >
      <Icon className={cn("h-3 w-3", status === "in_progress" && "animate-spin")} />
      {config.label}
    </Badge>
  );
}

interface ChecklistStatusBadgeProps {
  status: ChecklistItemStatusType;
  className?: string;
}

const checklistStatusConfig: Record<ChecklistItemStatusType, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
  pending: { label: "Pending", variant: "outline", className: "text-muted-foreground border-muted" },
  in_progress: { label: "In Progress", variant: "default", className: "bg-blue-600 text-white dark:bg-blue-500" },
  completed: { label: "Completed", variant: "default", className: "bg-green-600 text-white dark:bg-green-500" },
  not_applicable: { label: "N/A", variant: "secondary", className: "bg-muted text-muted-foreground" },
};

export function ChecklistStatusBadge({ status, className }: ChecklistStatusBadgeProps) {
  const config = checklistStatusConfig[status];

  return (
    <Badge
      variant={config.variant}
      className={cn("px-2 py-0.5 text-xs font-medium", config.className, className)}
      data-testid={`badge-checklist-status-${status}`}
    >
      {config.label}
    </Badge>
  );
}

interface RiskBadgeProps {
  level: "low" | "medium" | "high";
  className?: string;
}

const riskConfig: Record<string, { label: string; className: string }> = {
  low: { label: "Low Risk", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  medium: { label: "Medium Risk", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
  high: { label: "High Risk", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
};

export function RiskBadge({ level, className }: RiskBadgeProps) {
  const normalizedLevel = level?.toLowerCase() || "low";
  const config = riskConfig[normalizedLevel] || riskConfig.low;

  return (
    <Badge
      variant="secondary"
      className={cn("px-2 py-0.5 text-xs font-medium", config.className, className)}
      data-testid={`badge-risk-${normalizedLevel}`}
    >
      {config.label}
    </Badge>
  );
}

interface IsaReferenceBadgeProps {
  reference: string;
  className?: string;
}

export function IsaReferenceBadge({ reference, className }: IsaReferenceBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn("px-2 py-0.5 text-xs font-mono bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800", className)}
      data-testid={`badge-isa-${reference}`}
    >
      {reference}
    </Badge>
  );
}

interface RoleBadgeProps {
  role: string;
  className?: string;
}

const roleConfig: Record<string, { label: string; className: string }> = {
  staff: { label: "Staff", className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  senior: { label: "Senior", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  manager: { label: "Manager", className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  partner: { label: "Partner", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  eqcr: { label: "EQCR", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  admin: { label: "Admin", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

export function RoleBadge({ role, className }: RoleBadgeProps) {
  const config = roleConfig[role] || { label: role, className: "bg-muted text-muted-foreground" };

  return (
    <Badge
      variant="secondary"
      className={cn("px-2 py-0.5 text-xs font-medium uppercase tracking-wide", config.className, className)}
      data-testid={`badge-role-${role}`}
    >
      {config.label}
    </Badge>
  );
}
