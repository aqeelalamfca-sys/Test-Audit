import { useState } from "react";
import { useEnforcementOptional, type EnforcementPhase } from "@/lib/enforcement-context";
import { useEngagement } from "@/lib/workspace-context";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger 
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  Lock,
  Unlock,
  Send,
  AlertTriangle,
  UserCheck,
  Clock,
  XCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

const PHASE_LABELS: Record<EnforcementPhase, string> = {
  ADMINISTRATION: "Administration",
  REQUISITION: "Data Intake",
  PRE_PLANNING: "Pre-Planning",
  PLANNING: "Planning",
  EXECUTION: "Execution",
  EVIDENCE: "Evidence Collection",
  FINALIZATION: "Finalization",
  DELIVERABLES: "Deliverables",
  QR_EQCR: "Quality Review / EQCR",
  INSPECTION: "Inspection"
};

interface PhaseApprovalControlProps {
  phase: EnforcementPhase;
  className?: string;
  inline?: boolean;
}

export function PhaseApprovalControl({ phase, className, inline }: PhaseApprovalControlProps) {
  const { engagementId } = useEngagement();
  const enforcement = useEnforcementOptional();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showLockDialog, setShowLockDialog] = useState(false);
  const [comments, setComments] = useState("");

  const submitForReview = useMutation({
    mutationFn: async () => {
      const response = await fetchWithAuth(`/api/enforcement/submit-phase/${engagementId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase, comments })
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to submit phase for review");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: `${PHASE_LABELS[phase]} submitted for review` });
      setShowSubmitDialog(false);
      setComments("");
      queryClient.invalidateQueries({ queryKey: ["/api/enforcement/status", engagementId] });
      enforcement?.refreshStatus();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const approvePhase = useMutation({
    mutationFn: async (approved: boolean) => {
      const response = await fetchWithAuth(`/api/enforcement/approve-phase/${engagementId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase, approved, comments })
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to process approval");
      }
      return response.json();
    },
    onSuccess: (_, approved) => {
      toast({ 
        title: "Success", 
        description: approved 
          ? `${PHASE_LABELS[phase]} approved and locked` 
          : `${PHASE_LABELS[phase]} approval rejected` 
      });
      setShowApproveDialog(false);
      setComments("");
      queryClient.invalidateQueries({ queryKey: ["/api/enforcement/status", engagementId] });
      enforcement?.refreshStatus();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const lockUnlockPhase = useMutation({
    mutationFn: async (lock: boolean) => {
      const response = await fetchWithAuth(`/api/enforcement/lock-phase/${engagementId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase, lock, comments })
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update phase lock status");
      }
      return response.json();
    },
    onSuccess: (_, lock) => {
      toast({ 
        title: "Success", 
        description: lock 
          ? `${PHASE_LABELS[phase]} has been locked` 
          : `${PHASE_LABELS[phase]} has been unlocked` 
      });
      setShowLockDialog(false);
      setComments("");
      queryClient.invalidateQueries({ queryKey: ["/api/enforcement/status", engagementId] });
      enforcement?.refreshStatus();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  if (!enforcement || !enforcement.status || !engagementId) {
    return null;
  }

  const { status } = enforcement;
  const phaseStatus = status.phaseStatus[phase];
  
  if (!phaseStatus) {
    return null;
  }

  const blockers = enforcement.getBlockedReasons(phase);
  const canSubmit = phaseStatus.isAccessible && !phaseStatus.isLocked && blockers.length === 0;
  const isUnderReview = status.pendingSignOffs.some(ps => ps.entityType.includes(phase));
  const canApprove = isUnderReview;
  const canLock = phaseStatus.isComplete || phaseStatus.isAccessible;

  const dialogElements = (
    <>
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit {PHASE_LABELS[phase]} for Review</DialogTitle>
            <DialogDescription>This will submit the phase for manager/partner review. You won't be able to make changes until the review is complete.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5 py-2">
            <div className="space-y-2">
              <Label htmlFor="submit-comments">Comments (Optional)</Label>
              <Textarea id="submit-comments" placeholder="Add any notes for the reviewer..." value={comments} onChange={(e) => setComments(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitDialog(false)}>Cancel</Button>
            <Button onClick={() => submitForReview.mutate()} disabled={submitForReview.isPending}>{submitForReview.isPending ? "Submitting..." : "Submit for Review"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showLockDialog} onOpenChange={setShowLockDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{phaseStatus.isLocked ? "Unlock" : "Lock"} {PHASE_LABELS[phase]}</DialogTitle>
            <DialogDescription>{phaseStatus.isLocked ? "Unlocking this phase will allow further modifications. This action is logged for audit purposes." : "Locking this phase will prevent any further modifications. Partner approval may be required to unlock."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5 py-2">
            <div className="space-y-2">
              <Label htmlFor="lock-comments">Reason for {phaseStatus.isLocked ? "Unlocking" : "Locking"}</Label>
              <Textarea id="lock-comments" placeholder="Provide a reason..." value={comments} onChange={(e) => setComments(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLockDialog(false)}>Cancel</Button>
            <Button variant={phaseStatus.isLocked ? "default" : "secondary"} onClick={() => lockUnlockPhase.mutate(!phaseStatus.isLocked)} disabled={lockUnlockPhase.isPending}>{lockUnlockPhase.isPending ? "Processing..." : phaseStatus.isLocked ? "Unlock Phase" : "Lock Phase"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review {PHASE_LABELS[phase]}</DialogTitle>
            <DialogDescription>Approve or reject this phase submission.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5 py-2">
            <div className="space-y-2">
              <Label htmlFor="approve-comments">Review Comments</Label>
              <Textarea id="approve-comments" placeholder="Add review comments..." value={comments} onChange={(e) => setComments(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => approvePhase.mutate(false)} disabled={approvePhase.isPending}><XCircle className="h-4 w-4 mr-2" />Reject</Button>
            <Button onClick={() => approvePhase.mutate(true)} disabled={approvePhase.isPending}><CheckCircle2 className="h-4 w-4 mr-2" />Approve</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  return (
    <div className={cn("flex items-center gap-2 flex-wrap", !inline && "py-1.5 px-3 rounded-md border bg-muted/30", className)} data-testid={inline ? "phase-approval-inline" : "phase-approval-control"}>
      {phaseStatus.isLocked && (
        <Badge variant="secondary" className="bg-amber-100 text-amber-800" data-testid="badge-phase-locked">
          <Lock className="h-3 w-3 mr-1" />Locked
        </Badge>
      )}
      {phaseStatus.isComplete && !phaseStatus.isLocked && (
        <Badge variant="secondary" className="bg-green-100 text-green-800">
          <CheckCircle2 className="h-3 w-3 mr-1" />Complete
        </Badge>
      )}
      {isUnderReview && (
        <Badge variant="secondary" className="bg-blue-100 text-blue-800">
          <Clock className="h-3 w-3 mr-1" />Under Review
        </Badge>
      )}
      {blockers.length > 0 && (
        <Badge variant="destructive" className="text-xs">
          <AlertTriangle className="h-3 w-3 mr-1" />
          {blockers.length} Blocker{blockers.length > 1 ? "s" : ""}
        </Badge>
      )}
      <Button variant="default" size="sm" disabled={!canSubmit || isUnderReview} onClick={() => setShowSubmitDialog(true)} data-testid="button-submit-review">
        <Send className="h-4 w-4 mr-2" />Submit for Review
      </Button>
      <Button variant="outline" size="sm" disabled={!canLock} onClick={() => setShowLockDialog(true)} data-testid="button-lock-phase">
        {phaseStatus.isLocked ? <><Unlock className="h-4 w-4 mr-1" />Unlock</> : <><Lock className="h-4 w-4 mr-1" />Lock Phase</>}
      </Button>
      {canApprove && (
        <Button variant="outline" size="sm" onClick={() => setShowApproveDialog(true)} data-testid="button-review-approve">
          <UserCheck className="h-4 w-4 mr-2" />Review
        </Button>
      )}
      {dialogElements}
    </div>
  );
}

export function PhaseLockIndicator({ phase }: { phase: EnforcementPhase }) {
  const enforcement = useEnforcementOptional();

  if (!enforcement || !enforcement.status) {
    return null;
  }

  const phaseStatus = enforcement.status.phaseStatus[phase];
  
  if (!phaseStatus?.isLocked) {
    return null;
  }

  return (
    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-1.5 flex items-center gap-2">
      <Lock className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
      <span className="text-xs text-amber-800 dark:text-amber-200">
        This phase is locked. Contact a partner or manager to unlock for modifications.
      </span>
    </div>
  );
}
