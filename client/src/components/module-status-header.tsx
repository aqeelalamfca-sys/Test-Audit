import { Check, X, Lock, FileText, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Prerequisite {
  label: string;
  met: boolean;
}

interface ModuleStatusHeaderProps {
  moduleName: string;
  status: 'draft' | 'in_review' | 'pending_approval' | 'approved' | 'locked';
  prerequisites?: Prerequisite[];
  isLocked?: boolean;
  lockedBy?: string;
  lockedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  onViewAuditTrail?: () => void;
  className?: string;
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  in_review: { label: 'In Review', variant: 'outline' },
  pending_approval: { label: 'Pending Approval', variant: 'outline' },
  approved: { label: 'Approved', variant: 'default' },
  locked: { label: 'Locked', variant: 'destructive' },
};

export function ModuleStatusHeader({
  moduleName,
  status,
  prerequisites,
  isLocked,
  lockedBy,
  lockedAt,
  approvedBy,
  approvedAt,
  onViewAuditTrail,
  className,
}: ModuleStatusHeaderProps) {
  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.draft;

  return (
    <Card
      className={cn("px-4 py-3", className)}
      data-testid="module-status-header"
    >
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <h2
              className="text-sm font-semibold text-foreground"
              data-testid="text-module-name"
            >
              {moduleName}
            </h2>
          </div>
          <Badge
            variant={statusConfig.variant}
            data-testid="badge-module-status"
          >
            {statusConfig.label}
          </Badge>
          {isLocked && (
            <Badge
              variant="secondary"
              className="text-muted-foreground"
              data-testid="badge-read-only"
            >
              <Eye className="h-3 w-3 mr-1" />
              Read-Only
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          {prerequisites && prerequisites.length > 0 && (
            <div
              className="flex items-center gap-2 flex-wrap"
              data-testid="prerequisites-list"
            >
              {prerequisites.map((prereq, index) => (
                <span
                  key={index}
                  className="flex items-center gap-1 text-xs text-muted-foreground"
                  data-testid={`prerequisite-item-${index}`}
                >
                  {prereq.met ? (
                    <Check className="h-3 w-3 text-green-500 shrink-0" />
                  ) : (
                    <X className="h-3 w-3 text-red-500 shrink-0" />
                  )}
                  {prereq.label}
                </span>
              ))}
            </div>
          )}

          {isLocked && lockedBy && (
            <div
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
              data-testid="text-lock-info"
            >
              <Lock className="h-3 w-3 shrink-0" />
              <span>Locked by {lockedBy}{lockedAt ? ` on ${lockedAt}` : ''}</span>
            </div>
          )}

          {!isLocked && status === 'approved' && approvedBy && (
            <div
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
              data-testid="text-approval-info"
            >
              <Check className="h-3 w-3 text-green-500 shrink-0" />
              <span>Approved by {approvedBy}{approvedAt ? ` on ${approvedAt}` : ''}</span>
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={onViewAuditTrail}
            disabled={!onViewAuditTrail}
            data-testid="button-view-audit-trail"
          >
            View Audit Trail
          </Button>
        </div>
      </div>
    </Card>
  );
}
