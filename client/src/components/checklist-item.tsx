import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { IsaReferenceBadge, ChecklistStatusBadge } from "@/components/status-badge";
import { ChecklistItemStatusType } from "@shared/schema";
import { ChevronDown, ChevronRight, MessageSquare, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface ChecklistItemProps {
  id: string;
  title: string;
  description?: string;
  isaReference?: string;
  status: ChecklistItemStatusType;
  assignedTo?: string;
  completedBy?: string;
  completedAt?: string;
  hasNotes?: boolean;
  hasEvidence?: boolean;
  children?: React.ReactNode;
  onStatusChange?: (status: ChecklistItemStatusType) => void;
  onOpenNotes?: () => void;
  onOpenEvidence?: () => void;
}

export function ChecklistItem({
  id,
  title,
  description,
  isaReference,
  status,
  assignedTo,
  completedBy,
  completedAt,
  hasNotes,
  hasEvidence,
  children,
  onStatusChange,
  onOpenNotes,
  onOpenEvidence,
}: ChecklistItemProps) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = !!children;

  const handleCheckboxChange = (checked: boolean) => {
    if (onStatusChange) {
      onStatusChange(checked ? "completed" : "pending");
    }
  };

  return (
    <div
      className={cn(
        "border border-border rounded-lg bg-card transition-all",
        status === "completed" && "bg-green-50/50 dark:bg-green-950/10 border-green-200 dark:border-green-900/50"
      )}
      data-testid={`checklist-item-${id}`}
    >
      <div className="flex items-start gap-3 p-4">
        <div className="flex items-center gap-2 pt-0.5">
          {hasChildren && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={() => setExpanded(!expanded)}
              data-testid={`button-expand-${id}`}
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          )}
          <Checkbox
            id={`checkbox-${id}`}
            checked={status === "completed"}
            onCheckedChange={handleCheckboxChange}
            className="h-5 w-5"
            data-testid={`checkbox-${id}`}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <label
              htmlFor={`checkbox-${id}`}
              className={cn(
                "text-sm font-medium cursor-pointer",
                status === "completed" && "line-through text-muted-foreground"
              )}
            >
              {title}
            </label>
            <div className="flex items-center gap-2 flex-shrink-0">
              {isaReference && <IsaReferenceBadge reference={isaReference} />}
              <ChecklistStatusBadge status={status} />
            </div>
          </div>

          {description && (
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          )}

          <div className="flex items-center gap-4 mt-3">
            {assignedTo && (
              <span className="text-xs text-muted-foreground">
                Assigned to: <span className="font-medium text-foreground">{assignedTo}</span>
              </span>
            )}
            
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className={cn("h-7 px-2 text-xs gap-1", hasNotes && "text-blue-600 dark:text-blue-400")}
                onClick={onOpenNotes}
                data-testid={`button-notes-${id}`}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Notes
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn("h-7 px-2 text-xs gap-1", hasEvidence && "text-green-600 dark:text-green-400")}
                onClick={onOpenEvidence}
                data-testid={`button-evidence-${id}`}
              >
                <Paperclip className="h-3.5 w-3.5" />
                Evidence
              </Button>
            </div>
          </div>

          {status === "completed" && completedBy && (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Signed off by <span className="font-medium text-foreground">{completedBy}</span>
                {completedAt && <span> on {completedAt}</span>}
              </p>
            </div>
          )}
        </div>
      </div>

      {hasChildren && expanded && (
        <div className="ml-12 border-t border-border p-4 pt-0 space-y-2">
          {children}
        </div>
      )}
    </div>
  );
}

interface ChecklistSectionProps {
  title: string;
  description?: string;
  isaReference?: string;
  children: React.ReactNode;
  completedCount: number;
  totalCount: number;
}

export function ChecklistSection({
  title,
  description,
  isaReference,
  children,
  completedCount,
  totalCount,
}: ChecklistSectionProps) {
  const [expanded, setExpanded] = useState(true);
  const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="border border-border rounded-lg overflow-hidden" data-testid={`checklist-section-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 bg-muted/50 hover-elevate transition-all text-left"
        data-testid="button-toggle-section"
      >
        <div className="flex items-center gap-3">
          {expanded ? (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          )}
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">{title}</h3>
              {isaReference && <IsaReferenceBadge reference={isaReference} />}
            </div>
            {description && (
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-muted-foreground">
            {completedCount}/{totalCount}
          </span>
          <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                percentage === 100 ? "bg-green-500" : "bg-primary"
              )}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </button>

      {expanded && (
        <div className="p-4 space-y-3 bg-background">
          {children}
        </div>
      )}
    </div>
  );
}
