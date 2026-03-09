import { useState, useCallback, createContext, useContext } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useEngagement } from "@/lib/workspace-context";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  Circle,
  Clock,
  Lock,
  Unlock,
  AlertTriangle,
  User,
  Eye,
  Shield,
  Loader2,
} from "lucide-react";

export type SignOffStatus = "DRAFT" | "PREPARED" | "REVIEWED" | "APPROVED" | "LOCKED";

export interface SignOffData {
  id?: string;
  status: SignOffStatus;
  preparedById?: string | null;
  preparedByName?: string | null;
  preparedAt?: string | null;
  preparedDate?: string | null;
  reviewedById?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
  reviewedDate?: string | null;
  approvedById?: string | null;
  approvedByName?: string | null;
  approvedAt?: string | null;
  approvedDate?: string | null;
  isLocked?: boolean;
}

interface SignOffBarProps {
  phase: string;
  section: string;
  className?: string;
  compact?: boolean;
  onStatusChange?: (status: SignOffStatus, isLocked: boolean) => void;
}

const STATUS_CONFIG: Record<SignOffStatus, {
  label: string;
  barColor: string;
  badgeBg: string;
  badgeText: string;
  icon: typeof Clock;
}> = {
  DRAFT: {
    label: "Draft",
    barColor: "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700",
    badgeBg: "bg-slate-100 dark:bg-slate-800",
    badgeText: "text-slate-600 dark:text-slate-300",
    icon: Clock,
  },
  PREPARED: {
    label: "Prepared",
    barColor: "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800",
    badgeBg: "bg-blue-100 dark:bg-blue-900/50",
    badgeText: "text-blue-700 dark:text-blue-300",
    icon: User,
  },
  REVIEWED: {
    label: "Reviewed",
    barColor: "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800",
    badgeBg: "bg-amber-100 dark:bg-amber-900/50",
    badgeText: "text-amber-700 dark:text-amber-300",
    icon: Eye,
  },
  APPROVED: {
    label: "Approved",
    barColor: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800",
    badgeBg: "bg-emerald-100 dark:bg-emerald-900/50",
    badgeText: "text-emerald-700 dark:text-emerald-300",
    icon: CheckCircle2,
  },
  LOCKED: {
    label: "Approved – Read Only",
    barColor: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800",
    badgeBg: "bg-emerald-100 dark:bg-emerald-900/50",
    badgeText: "text-emerald-700 dark:text-emerald-300",
    icon: Lock,
  },
};

const ROLE_CAN_PREPARE = ["STAFF", "SENIOR", "FIRM_ADMIN"];
const ROLE_CAN_REVIEW = ["MANAGER", "FIRM_ADMIN"];
const ROLE_CAN_APPROVE = ["PARTNER", "FIRM_ADMIN"];
const ROLE_CAN_UNLOCK = ["FIRM_ADMIN"];

function formatTimestampPKT(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const pkt = new Date(d.getTime() + 5 * 60 * 60 * 1000);
  const day = pkt.getUTCDate().toString().padStart(2, "0");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const month = months[pkt.getUTCMonth()];
  const year = pkt.getUTCFullYear();
  let hours = pkt.getUTCHours();
  const mins = pkt.getUTCMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${day} ${month} ${year}, ${hours}:${mins} ${ampm} PKT`;
}

export function SignOffBar({
  phase,
  section,
  className,
  compact = false,
  onStatusChange,
}: SignOffBarProps) {
  const { user } = useAuth();
  const { engagementId } = useEngagement();
  const { toast } = useToast();
  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);
  const [unlockReason, setUnlockReason] = useState("");

  const userRole = (user?.role || "STAFF").toUpperCase();

  const { data: signoff, isLoading } = useQuery<SignOffData>({
    queryKey: ["/api/section-signoffs", engagementId, phase, section],
    queryFn: async () => {
      const res = await fetchWithAuth(
        `/api/section-signoffs/${engagementId}/${phase}/${encodeURIComponent(section)}`
      );
      if (!res.ok) {
        if (res.status === 404) return { status: "DRAFT" as SignOffStatus };
        throw new Error("Failed to fetch sign-off");
      }
      return res.json();
    },
    enabled: !!engagementId && !!phase && !!section,
    staleTime: 30000,
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetchWithAuth(
        `/api/section-signoffs/${engagementId}/${phase}/${encodeURIComponent(section)}/complete`,
        { method: "POST", headers: { "Content-Type": "application/json" } }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Action failed" }));
        throw new Error(err.error || "Action failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["/api/section-signoffs", engagementId, phase, section],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/section-signoffs", engagementId, phase],
      });
      const labels: Record<string, string> = {
        PREPARED: "Marked as Prepared",
        REVIEWED: "Marked as Reviewed",
        APPROVED: "Approved & Locked",
      };
      toast({ title: labels[data.status] || "Completed" });
      if (onStatusChange) onStatusChange(data.status, data.isLocked || false);
    },
    onError: (error: Error) => {
      toast({ title: "Action Failed", description: error.message, variant: "destructive" });
    },
  });

  const unlockMutation = useMutation({
    mutationFn: async (reason: string) => {
      const res = await fetchWithAuth(
        `/api/section-signoffs/${engagementId}/${phase}/${encodeURIComponent(section)}/unlock`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Action failed" }));
        throw new Error(err.error || "Action failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/section-signoffs", engagementId, phase, section],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/section-signoffs", engagementId, phase],
      });
      toast({ title: "Section Unlocked", description: "Section returned to Draft status" });
      setUnlockDialogOpen(false);
      setUnlockReason("");
      if (onStatusChange) onStatusChange("DRAFT", false);
    },
    onError: (error: Error) => {
      toast({ title: "Unlock Failed", description: error.message, variant: "destructive" });
    },
  });

  const status: SignOffStatus = (signoff?.status as SignOffStatus) || "DRAFT";
  const isLocked = status === "APPROVED" || status === "LOCKED";
  const config = STATUS_CONFIG[isLocked ? "LOCKED" : status] || STATUS_CONFIG.DRAFT;
  const StatusIcon = config.icon;

  const preparedAt = signoff?.preparedAt || signoff?.preparedDate;
  const reviewedAt = signoff?.reviewedAt || signoff?.reviewedDate;
  const approvedAt = signoff?.approvedAt || signoff?.approvedDate;

  const canComplete =
    (status === "DRAFT" && ROLE_CAN_PREPARE.includes(userRole)) ||
    (status === "PREPARED" && ROLE_CAN_REVIEW.includes(userRole) && signoff?.preparedById !== user?.id) ||
    (status === "REVIEWED" && ROLE_CAN_APPROVE.includes(userRole) && signoff?.preparedById !== user?.id);

  const canUnlock = isLocked && ROLE_CAN_UNLOCK.includes(userRole);

  const getCompleteTooltip = (): string => {
    if (status === "DRAFT" && ROLE_CAN_PREPARE.includes(userRole)) return "Mark as Prepared (sets your name and timestamp)";
    if (status === "PREPARED" && ROLE_CAN_REVIEW.includes(userRole)) return "Mark as Reviewed (Manager sign-off)";
    if (status === "REVIEWED" && ROLE_CAN_APPROVE.includes(userRole)) return "Approve & Lock (Partner final sign-off)";
    if (isLocked) return "This section is approved and read-only";
    if (status === "PREPARED" && !ROLE_CAN_REVIEW.includes(userRole)) return "Waiting for Manager review";
    if (status === "REVIEWED" && !ROLE_CAN_APPROVE.includes(userRole)) return "Waiting for Partner approval";
    if (signoff?.preparedById === user?.id) return "Cannot review/approve your own work (Segregation of Duties)";
    return "Not available at your current role";
  };

  if (isLoading) {
    return (
      <div className={cn("animate-pulse rounded border px-3 py-1.5", className)} data-testid="signoff-bar-loading">
        <div className="h-6 bg-muted rounded w-full" />
      </div>
    );
  }

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-3 rounded-md border px-3 py-1.5 text-xs transition-colors",
          config.barColor,
          className,
        )}
        data-testid={`signoff-bar-${section}`}
      >
        <div className="flex items-center gap-1.5 shrink-0">
          <StatusIcon className={cn("h-3.5 w-3.5", config.badgeText)} />
          <span className={cn("font-semibold", config.badgeText)} data-testid={`signoff-status-badge-${section}`}>
            {config.label}
          </span>
        </div>

        <div className="h-4 w-px bg-border shrink-0" />

        <div className="flex items-center gap-3 flex-1 min-w-0">
          <SignOffStep
            label="Prepared"
            roleName="Associate"
            userName={signoff?.preparedByName}
            timestamp={preparedAt}
            isComplete={!!signoff?.preparedById}
            isCurrent={status === "DRAFT"}
            icon={User}
            colorClass="text-blue-600 dark:text-blue-400"
            testId={`signoff-step-prepared-${section}`}
          />
          <div className="h-3 w-px bg-border/60 shrink-0" />
          <SignOffStep
            label="Reviewed"
            roleName="Manager"
            userName={signoff?.reviewedByName}
            timestamp={reviewedAt}
            isComplete={!!signoff?.reviewedById}
            isCurrent={status === "PREPARED"}
            icon={Eye}
            colorClass="text-amber-600 dark:text-amber-400"
            testId={`signoff-step-reviewed-${section}`}
          />
          <div className="h-3 w-px bg-border/60 shrink-0" />
          <SignOffStep
            label="Approved"
            roleName="Partner"
            userName={signoff?.approvedByName}
            timestamp={approvedAt}
            isComplete={!!signoff?.approvedById}
            isCurrent={status === "REVIEWED"}
            icon={Shield}
            colorClass="text-emerald-600 dark:text-emerald-400"
            testId={`signoff-step-approved-${section}`}
          />
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {canUnlock && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[11px] text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                  onClick={() => setUnlockDialogOpen(true)}
                  data-testid={`signoff-unlock-${section}`}
                >
                  <Unlock className="h-3 w-3 mr-1" />
                  Unlock
                </Button>
              </TooltipTrigger>
              <TooltipContent>Admin override – return to Draft with audit trail</TooltipContent>
            </Tooltip>
          )}

          {canComplete && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  className="h-6 px-2.5 text-[11px] bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                  onClick={() => completeMutation.mutate()}
                  disabled={completeMutation.isPending}
                  data-testid={`signoff-complete-${section}`}
                >
                  {completeMutation.isPending ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                  )}
                  Complete
                </Button>
              </TooltipTrigger>
              <TooltipContent>{getCompleteTooltip()}</TooltipContent>
            </Tooltip>
          )}

          {!canComplete && !isLocked && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled
                    className="h-6 px-2.5 text-[11px] opacity-50"
                    data-testid={`signoff-complete-disabled-${section}`}
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Complete
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>{getCompleteTooltip()}</TooltipContent>
            </Tooltip>
          )}

          {isLocked && (
            <Badge variant="outline" className="h-6 text-[11px] font-bold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border-emerald-400 dark:border-emerald-600 px-2 shadow-sm animate-in fade-in" data-testid="signoff-readonly-badge">
              <Lock className="h-3 w-3 mr-1" />
              Approved – Read Only
            </Badge>
          )}
        </div>
      </div>

      <Dialog open={unlockDialogOpen} onOpenChange={setUnlockDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Admin Override Unlock
            </DialogTitle>
            <DialogDescription>
              This will return the section to Draft status. A mandatory reason is required and will be recorded in the audit trail.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={unlockReason}
            onChange={(e) => setUnlockReason(e.target.value)}
            placeholder="Enter reason for override unlock (required)..."
            className="min-h-[80px]"
            data-testid="signoff-unlock-reason"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnlockDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-amber-500 hover:bg-amber-600"
              onClick={() => unlockMutation.mutate(unlockReason)}
              disabled={!unlockReason.trim() || unlockMutation.isPending}
              data-testid="signoff-unlock-confirm"
            >
              {unlockMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Confirm Unlock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SignOffStep({
  label,
  roleName,
  userName,
  timestamp,
  isComplete,
  isCurrent,
  icon: Icon,
  colorClass,
  testId,
}: {
  label: string;
  roleName: string;
  userName?: string | null;
  timestamp?: string | null;
  isComplete: boolean;
  isCurrent: boolean;
  icon: typeof User;
  colorClass: string;
  testId: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className="flex items-center gap-1 min-w-0 cursor-default"
          data-testid={testId}
        >
          {isComplete ? (
            <CheckCircle2 className={cn("h-3 w-3 shrink-0", colorClass)} />
          ) : (
            <Circle className={cn("h-3 w-3 shrink-0", isCurrent ? "text-muted-foreground/60" : "text-muted-foreground/30")} />
          )}
          <span className={cn(
            "truncate",
            isComplete ? cn("font-medium", colorClass) : "text-muted-foreground/50"
          )}>
            {isComplete && userName ? userName : label}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        <p className="font-medium">{label} ({roleName})</p>
        {isComplete && userName && (
          <>
            <p data-testid={`${testId}-name`}>{userName}</p>
            {timestamp && <p className="text-muted-foreground" data-testid={`${testId}-time`}>{formatTimestampPKT(timestamp)}</p>}
          </>
        )}
        {!isComplete && <p className="text-muted-foreground italic">{isCurrent ? "Awaiting action" : "Pending"}</p>}
      </TooltipContent>
    </Tooltip>
  );
}

export function useSignOffStatus(phase: string, section: string) {
  const { engagementId } = useEngagement();

  const { data } = useQuery<SignOffData>({
    queryKey: ["/api/section-signoffs", engagementId, phase, section],
    queryFn: async () => {
      const res = await fetchWithAuth(
        `/api/section-signoffs/${engagementId}/${phase}/${encodeURIComponent(section)}`
      );
      if (!res.ok) return { status: "DRAFT" as SignOffStatus };
      return res.json();
    },
    enabled: !!engagementId && !!phase && !!section,
    staleTime: 30000,
  });

  const status = (data?.status as SignOffStatus) || "DRAFT";
  const isLocked = status === "APPROVED" || status === "LOCKED";

  return { status, isLocked, data };
}

export function useModuleReadOnly(phase: string, section?: string) {
  const effectiveSection = section || phase;
  const { status, isLocked } = useSignOffStatus(phase, effectiveSection);
  return { isReadOnly: isLocked, status, isLocked };
}
