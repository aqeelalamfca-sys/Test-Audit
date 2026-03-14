import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Check, AlertTriangle, X, Info, Clock, Minus, Lock, AlertCircle, Loader2 } from "lucide-react";
import { statusColorClasses, type StatusType } from "@/lib/design-tokens";
import { Badge } from "@/components/ui/badge";
import type { PhaseStatusType, ChecklistItemStatusType } from "@shared/schema";

/**
 * Standardized Status Badge for audit-grade status indicators
 * Use this for all PASS/WARN/FAIL/INFO status displays
 * 
 * Status colors are sourced from design-tokens.ts for consistency
 */
const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      status: {
        pass: statusColorClasses.pass.combined,
        warn: statusColorClasses.warn.combined,
        fail: statusColorClasses.fail.combined,
        info: statusColorClasses.info.combined,
        neutral: statusColorClasses.neutral.combined,
        pending: statusColorClasses.pending.combined,
      },
      size: {
        sm: "text-[10px] px-1.5 py-0.5",
        md: "text-xs px-2 py-0.5",
        lg: "text-sm px-2.5 py-1",
      },
    },
    defaultVariants: {
      status: "neutral",
      size: "md",
    },
  }
);

const statusIcons = {
  pass: Check,
  warn: AlertTriangle,
  fail: X,
  info: Info,
  neutral: Minus,
  pending: Clock,
};

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  showIcon?: boolean;
  count?: number;
  amount?: string | number;
}

export function StatusBadge({
  className,
  status = "neutral",
  size = "md",
  showIcon = true,
  count,
  amount,
  children,
  ...props
}: StatusBadgeProps) {
  const Icon = status ? statusIcons[status] : statusIcons.neutral;
  const iconSize = size === "sm" ? "h-3 w-3" : size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5";

  return (
    <span
      className={cn(statusBadgeVariants({ status, size }), className)}
      data-testid={`status-badge-${status}`}
      {...props}
    >
      {showIcon && <Icon className={iconSize} />}
      {children}
      {count !== undefined && (
        <span className="font-semibold">({count})</span>
      )}
      {amount !== undefined && (
        <span className="font-mono ml-1">{amount}</span>
      )}
    </span>
  );
}

// Pre-defined audit status badges for common use cases
export const AuditStatusBadges = {
  Balanced: () => <StatusBadge status="pass">Balanced</StatusBadge>,
  Unbalanced: () => <StatusBadge status="fail">Unbalanced</StatusBadge>,
  Matched: () => <StatusBadge status="pass">Matched</StatusBadge>,
  Mismatched: () => <StatusBadge status="fail">Mismatched</StatusBadge>,
  Approved: () => <StatusBadge status="pass">Approved</StatusBadge>,
  Pending: () => <StatusBadge status="pending">Pending</StatusBadge>,
  Rejected: () => <StatusBadge status="fail">Rejected</StatusBadge>,
  Complete: () => <StatusBadge status="pass">Complete</StatusBadge>,
  Incomplete: () => <StatusBadge status="warn">Incomplete</StatusBadge>,
  NotStarted: () => <StatusBadge status="neutral">Not Started</StatusBadge>,
  InProgress: () => <StatusBadge status="info">In Progress</StatusBadge>,
  NeedsReview: () => <StatusBadge status="warn">Needs Review</StatusBadge>,
  LowRisk: () => <StatusBadge status="pass">Low Risk</StatusBadge>,
  MediumRisk: () => <StatusBadge status="warn">Medium Risk</StatusBadge>,
  HighRisk: () => <StatusBadge status="fail">High Risk</StatusBadge>,
};

/**
 * Utility function to get status from common audit values
 * Uses the auditStatusMap from design-tokens for consistent mapping
 */
export function getAuditStatus(value: string | boolean | number): StatusBadgeProps["status"] {
  if (typeof value === "boolean") {
    return value ? "pass" : "fail";
  }
  
  const lowerValue = String(value).toLowerCase();
  
  // Pass conditions
  if (["pass", "passed", "ok", "balanced", "matched", "approved", "complete", "completed", "low", "yes", "true"].includes(lowerValue)) {
    return "pass";
  }
  
  // Warn conditions  
  if (["warn", "warning", "partial", "medium", "incomplete", "needs_review", "in_progress"].includes(lowerValue)) {
    return "warn";
  }
  
  // Fail conditions
  if (["fail", "failed", "error", "unbalanced", "mismatched", "rejected", "high", "no", "false", "missing"].includes(lowerValue)) {
    return "fail";
  }
  
  // Info conditions
  if (["info", "note", "notice", "active"].includes(lowerValue)) {
    return "info";
  }
  
  // Pending conditions
  if (["pending", "awaiting", "waiting"].includes(lowerValue)) {
    return "pending";
  }
  
  return "neutral";
}

export { statusBadgeVariants };
export type { StatusType };

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
  super_admin: { label: "Super Admin", className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400" },
  firm_admin: { label: "Firm Admin", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  partner: { label: "Engagement Partner", className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  eqcr: { label: "Engagement Quality Reviewer", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  manager: { label: "Manager", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  senior: { label: "Senior", className: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400" },
  staff: { label: "Audit Team", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  read_only: { label: "Read Only", className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
  client: { label: "Client", className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
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
