"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "./badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Lock,
  Unlock,
  Bot,
  Pencil,
  Paperclip,
  AlertTriangle,
  XCircle,
  FileCheck,
  Loader2,
  CircleDot,
  CheckCheck,
  Brain,
  ShieldCheck,
  FileWarning,
} from "lucide-react";

export type EntityStatus = "DRAFT" | "PREPARED" | "REVIEWED" | "APPROVED";
export type AIStatus = "AI_SUGGESTED" | "USER_OVERRIDE" | "MANUAL" | "REVERTED";
export type ConfidenceLevel = "LOW" | "MEDIUM" | "HIGH";
export type SectionStatus = "COMPLETE" | "IN_PROGRESS" | "BLOCKED" | "NOT_STARTED";
export type AttachmentStatus = "PRESENT" | "MISSING" | "PENDING_REVIEW" | "LOCKED";

const STATUS_CONFIG: Record<EntityStatus, { color: string; bgColor: string; icon: React.ReactNode; label: string }> = {
  DRAFT: {
    color: "text-yellow-600",
    bgColor: "bg-yellow-50 border-yellow-200",
    icon: <CircleDot className="h-3.5 w-3.5" />,
    label: "Draft",
  },
  PREPARED: {
    color: "text-blue-600",
    bgColor: "bg-blue-50 border-blue-200",
    icon: <FileCheck className="h-3.5 w-3.5" />,
    label: "Prepared",
  },
  REVIEWED: {
    color: "text-purple-600",
    bgColor: "bg-purple-50 border-purple-200",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    label: "Reviewed",
  },
  APPROVED: {
    color: "text-green-600",
    bgColor: "bg-green-50 border-green-200",
    icon: <ShieldCheck className="h-3.5 w-3.5" />,
    label: "Approved",
  },
};

export interface StatusBadgeProps {
  status: EntityStatus;
  markedBy?: string;
  markedAt?: Date | string;
  showTooltip?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function StatusBadge({
  status,
  markedBy,
  markedAt,
  showTooltip = true,
  size = "md",
  className,
}: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5",
    md: "text-xs px-2 py-0.5",
    lg: "text-sm px-2.5 py-1",
  };

  const badge = (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        config.bgColor,
        config.color,
        sizeClasses[size],
        className
      )}
    >
      {config.icon}
      {config.label}
    </span>
  );

  if (!showTooltip || (!markedBy && !markedAt)) {
    return badge;
  }

  const formattedDate = markedAt
    ? new Date(markedAt).toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          <div className="text-xs">
            {markedBy && <p>Marked by: {markedBy}</p>}
            {formattedDate && <p>Date: {formattedDate}</p>}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export interface GlobalStatusBarProps {
  status: EntityStatus;
  entityName: string;
  markedBy?: string;
  markedAt?: Date | string;
  className?: string;
}

export function GlobalStatusBar({
  status,
  entityName,
  markedBy,
  markedAt,
  className,
}: GlobalStatusBarProps) {
  const config = STATUS_CONFIG[status];
  const formattedDate = markedAt
    ? new Date(markedAt).toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  return (
    <div
      className={cn(
        "flex items-center justify-between px-4 py-2 rounded-lg border",
        config.bgColor,
        className
      )}
    >
      <div className="flex items-center gap-3">
        <span className={cn("flex items-center gap-1.5 font-medium", config.color)}>
          {config.icon}
          {config.label}
        </span>
        <span className="text-sm text-muted-foreground">{entityName}</span>
      </div>
      {(markedBy || formattedDate) && (
        <div className="text-xs text-muted-foreground">
          {markedBy && <span>{markedBy}</span>}
          {markedBy && formattedDate && <span className="mx-1">•</span>}
          {formattedDate && <span>{formattedDate}</span>}
        </div>
      )}
    </div>
  );
}

export interface AIBadgeProps {
  status: AIStatus;
  confidence?: number;
  showConfidence?: boolean;
  className?: string;
}

export function AIBadge({
  status,
  confidence,
  showConfidence = true,
  className,
}: AIBadgeProps) {
  const configs: Record<AIStatus, { icon: React.ReactNode; label: string; colors: string }> = {
    AI_SUGGESTED: {
      icon: <Bot className="h-3 w-3" />,
      label: "AI Suggested",
      colors: "bg-blue-50 text-blue-700 border-blue-200",
    },
    USER_OVERRIDE: {
      icon: <Pencil className="h-3 w-3" />,
      label: "User Override",
      colors: "bg-green-50 text-green-700 border-green-200",
    },
    MANUAL: {
      icon: <Pencil className="h-3 w-3" />,
      label: "Manual",
      colors: "bg-gray-50 text-gray-600 border-gray-200",
    },
    REVERTED: {
      icon: <Bot className="h-3 w-3 opacity-50" />,
      label: "Reverted to AI",
      colors: "bg-purple-50 text-purple-700 border-purple-200",
    },
  };

  const config = configs[status];

  const confidenceLevel: ConfidenceLevel =
    confidence !== undefined
      ? confidence >= 80
        ? "HIGH"
        : confidence >= 60
        ? "MEDIUM"
        : "LOW"
      : "MEDIUM";

  const confidenceColors: Record<ConfidenceLevel, string> = {
    HIGH: "text-green-600",
    MEDIUM: "text-yellow-600",
    LOW: "text-red-600",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border font-medium",
        config.colors,
        className
      )}
    >
      {config.icon}
      <span>{config.label}</span>
      {showConfidence && confidence !== undefined && status === "AI_SUGGESTED" && (
        <span className={cn("ml-0.5", confidenceColors[confidenceLevel])}>
          ({confidence}%)
        </span>
      )}
    </span>
  );
}

export interface ConfidenceIndicatorProps {
  confidence: number;
  showLabel?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function ConfidenceIndicator({
  confidence,
  showLabel = true,
  size = "md",
  className,
}: ConfidenceIndicatorProps) {
  const level: ConfidenceLevel =
    confidence >= 80 ? "HIGH" : confidence >= 60 ? "MEDIUM" : "LOW";

  const colors: Record<ConfidenceLevel, string> = {
    HIGH: "bg-green-500",
    MEDIUM: "bg-yellow-500",
    LOW: "bg-red-500",
  };

  const labels: Record<ConfidenceLevel, string> = {
    HIGH: "High",
    MEDIUM: "Medium",
    LOW: "Low",
  };

  const sizeClasses = {
    sm: "h-1.5 w-12",
    md: "h-2 w-16",
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("flex items-center gap-2", className)}>
            <div className={cn("rounded-full bg-gray-200 overflow-hidden", sizeClasses[size])}>
              <div
                className={cn("h-full rounded-full transition-all", colors[level])}
                style={{ width: `${confidence}%` }}
              />
            </div>
            {showLabel && (
              <span className="text-xs text-muted-foreground">{labels[level]}</span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>AI Confidence: {confidence}%</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export interface LockIconProps {
  locked: boolean;
  lockedBy?: "REVIEWED" | "APPROVED";
  className?: string;
}

export function LockIcon({ locked, lockedBy, className }: LockIconProps) {
  if (!locked) return null;

  const tooltipText =
    lockedBy === "APPROVED"
      ? "Locked after Approval"
      : lockedBy === "REVIEWED"
      ? "Locked after Review"
      : "Locked";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Lock className={cn("h-4 w-4 text-gray-400", className)} />
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export interface RequiredMarkProps {
  required?: boolean;
  className?: string;
}

export function RequiredMark({ required = true, className }: RequiredMarkProps) {
  if (!required) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("text-red-500 font-medium ml-0.5", className)}>*</span>
        </TooltipTrigger>
        <TooltipContent>
          <p>Required field</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export interface ErrorHintProps {
  message: string;
  className?: string;
}

export function ErrorHint({ message, className }: ErrorHintProps) {
  return (
    <div className={cn("flex items-center gap-1.5 text-sm text-red-600 mt-1", className)}>
      <XCircle className="h-3.5 w-3.5 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export interface WarningHintProps {
  message: string;
  className?: string;
}

export function WarningHint({ message, className }: WarningHintProps) {
  return (
    <div className={cn("flex items-center gap-1.5 text-sm text-amber-600 mt-1", className)}>
      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export interface SectionIndicatorProps {
  status: SectionStatus;
  missingCount?: number;
  label?: string;
  className?: string;
}

export function SectionIndicator({
  status,
  missingCount,
  label,
  className,
}: SectionIndicatorProps) {
  const configs: Record<SectionStatus, { icon: React.ReactNode; colors: string; label: string }> = {
    COMPLETE: {
      icon: <CheckCheck className="h-4 w-4" />,
      colors: "text-green-600",
      label: "Complete",
    },
    IN_PROGRESS: {
      icon: <Clock className="h-4 w-4" />,
      colors: "text-blue-600",
      label: "In Progress",
    },
    BLOCKED: {
      icon: <AlertCircle className="h-4 w-4" />,
      colors: "text-red-600",
      label: "Blocked",
    },
    NOT_STARTED: {
      icon: <CircleDot className="h-4 w-4" />,
      colors: "text-gray-400",
      label: "Not Started",
    },
  };

  const config = configs[status];

  return (
    <div className={cn("flex items-center gap-1.5", config.colors, className)}>
      {config.icon}
      {label && <span className="text-sm font-medium">{label || config.label}</span>}
      {missingCount !== undefined && missingCount > 0 && (
        <span className="ml-1 inline-flex items-center justify-center h-5 min-w-5 px-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">
          {missingCount}
        </span>
      )}
    </div>
  );
}

export interface TabIndicatorProps {
  status: SectionStatus;
  missingCount?: number;
  locked?: boolean;
}

export function TabIndicator({ status, missingCount, locked }: TabIndicatorProps) {
  if (locked) {
    return <Lock className="h-3.5 w-3.5 text-gray-400" />;
  }

  if (status === "COMPLETE") {
    return <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />;
  }

  if (status === "IN_PROGRESS") {
    return <Clock className="h-3.5 w-3.5 text-blue-600" />;
  }

  if (status === "BLOCKED" || (missingCount && missingCount > 0)) {
    return (
      <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 text-[10px] font-bold bg-red-500 text-white rounded-full">
        {missingCount || "!"}
      </span>
    );
  }

  return null;
}

export interface AttachmentIndicatorProps {
  status: AttachmentStatus;
  count?: number;
  className?: string;
}

export function AttachmentIndicator({ status, count, className }: AttachmentIndicatorProps) {
  const configs: Record<AttachmentStatus, { icon: React.ReactNode; colors: string; tooltip: string }> = {
    PRESENT: {
      icon: <Paperclip className="h-4 w-4" />,
      colors: "text-green-600",
      tooltip: count ? `${count} attachment(s)` : "Attachment present",
    },
    MISSING: {
      icon: <FileWarning className="h-4 w-4" />,
      colors: "text-red-600",
      tooltip: "Required attachment missing",
    },
    PENDING_REVIEW: {
      icon: <Clock className="h-4 w-4" />,
      colors: "text-amber-600",
      tooltip: "Pending review",
    },
    LOCKED: {
      icon: <Lock className="h-4 w-4" />,
      colors: "text-gray-500",
      tooltip: "Locked after approval",
    },
  };

  const config = configs[status];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("inline-flex items-center gap-1", config.colors, className)}>
            {config.icon}
            {count !== undefined && status === "PRESENT" && (
              <span className="text-xs font-medium">{count}</span>
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{config.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export interface ProgressBarProps {
  value: number;
  label?: string;
  showPercentage?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function ProgressBar({
  value,
  label,
  showPercentage = true,
  size = "md",
  className,
}: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value));

  const sizeClasses = {
    sm: "h-1.5",
    md: "h-2.5",
    lg: "h-4",
  };

  const colorClass =
    clampedValue === 100
      ? "bg-green-500"
      : clampedValue >= 75
      ? "bg-blue-500"
      : clampedValue >= 50
      ? "bg-yellow-500"
      : "bg-red-500";

  return (
    <div className={cn("w-full", className)}>
      {(label || showPercentage) && (
        <div className="flex items-center justify-between mb-1">
          {label && <span className="text-sm font-medium text-gray-700">{label}</span>}
          {showPercentage && (
            <span className="text-sm font-medium text-gray-500">{Math.round(clampedValue)}%</span>
          )}
        </div>
      )}
      <div className={cn("w-full bg-gray-200 rounded-full overflow-hidden", sizeClasses[size])}>
        <div
          className={cn("h-full rounded-full transition-all duration-300", colorClass)}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    </div>
  );
}

export interface PhaseProgressProps {
  phaseName: string;
  completedItems: number;
  totalItems: number;
  signOffStatus?: EntityStatus;
  className?: string;
}

export function PhaseProgress({
  phaseName,
  completedItems,
  totalItems,
  signOffStatus,
  className,
}: PhaseProgressProps) {
  const percentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  return (
    <div className={cn("p-3 border rounded-lg bg-white", className)}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-sm">{phaseName}</span>
        {signOffStatus && <StatusBadge status={signOffStatus} size="sm" showTooltip={false} />}
      </div>
      <ProgressBar value={percentage} showPercentage size="sm" />
      <p className="text-xs text-muted-foreground mt-1">
        {completedItems} of {totalItems} items complete
      </p>
    </div>
  );
}

export interface MissingItem {
  id: string;
  label: string;
  type: "field" | "attachment" | "signoff";
  link?: string;
}

export interface ComprehensiveMissingItem {
  phase: string;
  category: string;
  description: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  actionRequired: string;
}

export interface WhatsMissingPanelProps {
  items: MissingItem[];
  onItemClick?: (item: MissingItem) => void;
  className?: string;
}

export function WhatsMissingPanel({ items, onItemClick, className }: WhatsMissingPanelProps) {
  if (items.length === 0) {
    return (
      <div className={cn("p-4 border rounded-lg bg-green-50 border-green-200", className)}>
        <div className="flex items-center gap-2 text-green-700">
          <CheckCircle2 className="h-5 w-5" />
          <span className="font-medium">All items complete</span>
        </div>
      </div>
    );
  }

  const typeIcons: Record<MissingItem["type"], React.ReactNode> = {
    field: <XCircle className="h-4 w-4 text-red-500" />,
    attachment: <FileWarning className="h-4 w-4 text-amber-500" />,
    signoff: <AlertCircle className="h-4 w-4 text-purple-500" />,
  };

  return (
    <div className={cn("border rounded-lg bg-white", className)}>
      <div className="px-4 py-3 border-b bg-red-50">
        <div className="flex items-center gap-2 text-red-700">
          <AlertCircle className="h-5 w-5" />
          <span className="font-medium">What's Missing ({items.length})</span>
        </div>
      </div>
      <ul className="divide-y max-h-64 overflow-y-auto">
        {items.map((item) => (
          <li
            key={item.id}
            className={cn(
              "flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50",
              onItemClick && "cursor-pointer"
            )}
            onClick={() => onItemClick?.(item)}
          >
            {typeIcons[item.type]}
            <span className="text-sm">{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface AIAssistBannerProps {
  className?: string;
}

export function AIAssistBanner({ className }: AIAssistBannerProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-lg",
        className
      )}
    >
      <Brain className="h-5 w-5 text-blue-600 flex-shrink-0" />
      <div className="flex-1">
        <p className="text-sm text-blue-800 font-medium">
          AI-Assisted — Subject to Professional Judgment
        </p>
        <p className="text-xs text-blue-600">Manual edits supersede AI suggestions</p>
      </div>
    </div>
  );
}

export interface FieldWrapperProps {
  label: string;
  required?: boolean;
  aiStatus?: AIStatus;
  confidence?: number;
  locked?: boolean;
  lockedBy?: "REVIEWED" | "APPROVED";
  error?: string;
  warning?: string;
  children: React.ReactNode;
  className?: string;
}

export function FieldWrapper({
  label,
  required,
  aiStatus,
  confidence,
  locked,
  lockedBy,
  error,
  warning,
  children,
  className,
}: FieldWrapperProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-sm font-medium text-gray-700">
          {label}
          {required && <RequiredMark />}
        </label>
        {locked && <LockIcon locked={locked} lockedBy={lockedBy} />}
        {aiStatus && aiStatus !== "MANUAL" && (
          <AIBadge status={aiStatus} confidence={confidence} showConfidence />
        )}
      </div>
      <div className={cn(error && "ring-2 ring-red-500 rounded-md", locked && "opacity-60")}>
        {children}
      </div>
      {error && <ErrorHint message={error} />}
      {warning && !error && <WarningHint message={warning} />}
    </div>
  );
}
