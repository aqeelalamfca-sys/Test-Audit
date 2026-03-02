import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Check, AlertTriangle, X, Info, Clock, Minus } from "lucide-react";
import { statusColorClasses, type StatusType } from "@/lib/design-tokens";

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
