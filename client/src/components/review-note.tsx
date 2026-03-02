import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RoleBadge } from "@/components/status-badge";
import { Check, Reply, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

type NoteSeverity = "info" | "warning" | "critical";
type NoteStatus = "open" | "addressed" | "cleared";

interface ReviewNoteProps {
  id: string;
  authorName: string;
  authorInitials: string;
  authorRole: string;
  content: string;
  severity?: NoteSeverity;
  status: NoteStatus;
  createdAt: Date;
  resolvedBy?: string;
  resolvedAt?: Date;
  onReply?: () => void;
  onMarkAddressed?: () => void;
  onClear?: () => void;
  replies?: React.ReactNode;
}

const severityConfig: Record<NoteSeverity, { icon: React.ElementType; className: string }> = {
  info: { icon: Info, className: "text-blue-600 dark:text-blue-400" },
  warning: { icon: AlertTriangle, className: "text-amber-600 dark:text-amber-400" },
  critical: { icon: AlertCircle, className: "text-red-600 dark:text-red-400" },
};

const statusConfig: Record<NoteStatus, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  addressed: { label: "Addressed", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  cleared: { label: "Cleared", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
};

export function ReviewNote({
  id,
  authorName,
  authorInitials,
  authorRole,
  content,
  severity = "info",
  status,
  createdAt,
  resolvedBy,
  resolvedAt,
  onReply,
  onMarkAddressed,
  onClear,
  replies,
}: ReviewNoteProps) {
  const SeverityIcon = severityConfig[severity].icon;
  const statusStyles = statusConfig[status];

  return (
    <div className="space-y-3" data-testid={`review-note-${id}`}>
      <div className={cn(
        "border border-border rounded-lg p-4",
        status === "cleared" && "opacity-60"
      )}>
        <div className="flex items-start gap-3">
          <Avatar className="h-8 w-8 flex-shrink-0">
            <AvatarFallback className="text-xs font-medium bg-muted">
              {authorInitials}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{authorName}</span>
                <RoleBadge role={authorRole} />
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(createdAt, { addSuffix: true })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <SeverityIcon className={cn("h-4 w-4", severityConfig[severity].className)} />
                <Badge variant="secondary" className={cn("text-xs", statusStyles.className)}>
                  {statusStyles.label}
                </Badge>
              </div>
            </div>

            <p className="text-sm text-foreground mt-2 whitespace-pre-wrap">{content}</p>

            {status === "cleared" && resolvedBy && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                  Cleared by <span className="font-medium">{resolvedBy}</span>
                  {resolvedAt && <span> on {resolvedAt.toLocaleDateString()}</span>}
                </p>
              </div>
            )}

            <div className="flex items-center gap-2 mt-3">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={onReply}
                data-testid={`button-reply-${id}`}
              >
                <Reply className="h-3.5 w-3.5" />
                Reply
              </Button>
              {status === "open" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={onMarkAddressed}
                  data-testid={`button-address-${id}`}
                >
                  Mark Addressed
                </Button>
              )}
              {status === "addressed" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1 text-green-600 dark:text-green-400"
                  onClick={onClear}
                  data-testid={`button-clear-${id}`}
                >
                  <Check className="h-3.5 w-3.5" />
                  Clear Note
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {replies && (
        <div className="ml-12 space-y-3">
          {replies}
        </div>
      )}
    </div>
  );
}

interface ReviewNoteReplyProps {
  authorName: string;
  authorInitials: string;
  authorRole: string;
  content: string;
  createdAt: Date;
}

export function ReviewNoteReply({
  authorName,
  authorInitials,
  authorRole,
  content,
  createdAt,
}: ReviewNoteReplyProps) {
  return (
    <div className="border border-border rounded-lg p-3 bg-muted/30">
      <div className="flex items-start gap-2">
        <Avatar className="h-6 w-6 flex-shrink-0">
          <AvatarFallback className="text-xs font-medium bg-muted">
            {authorInitials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium">{authorName}</span>
            <RoleBadge role={authorRole} />
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(createdAt, { addSuffix: true })}
            </span>
          </div>
          <p className="text-sm text-foreground mt-1">{content}</p>
        </div>
      </div>
    </div>
  );
}
