import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Lock,
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  FileCheck,
  Clock,
  ChevronDown,
  Archive,
  Scale,
  ClipboardCheck,
  Calculator,
  FileText,
  Loader2,
  AlertCircle,
  History,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

type LockGateStatus = 
  | "PENDING"
  | "GATES_CHECKING"
  | "GATES_PASSED"
  | "GATES_FAILED"
  | "OVERRIDE_REQUESTED"
  | "OVERRIDE_APPROVED"
  | "LOCKED"
  | "ARCHIVED";

interface GateCheckResult {
  passed: boolean;
  message: string;
}

interface GateChecklist {
  materialityApproved?: GateCheckResult;
  auditPlanApproved?: GateCheckResult;
  allProceduresCompleted?: GateCheckResult;
  allExecutionResultsApproved?: GateCheckResult;
  noOpenExceptions?: GateCheckResult;
  glCodeIntegrity?: GateCheckResult;
  reconciliationStatus?: GateCheckResult;
}

interface OverrideLogEntry {
  requestedAt: string;
  requestedBy: string;
  reason: string;
  failedGates: string[];
  status: string;
  approvedAt?: string;
  approvedBy?: string;
  approvalReason?: string;
}

interface ArchiveSnapshot {
  createdAt: string;
  materialitySets?: Array<{ id: string; versionId: number; overallMateriality: string }>;
  auditPlans?: Array<{ id: string; versionNumber: number; status: string }>;
  proceduresCount?: number;
  executionResultsCount?: number;
}

interface LockGateEvidence {
  id: string;
  engagementId: string;
  snapshotVersion: number;
  status: LockGateStatus;
  materialitySetId: string | null;
  auditPlanId: string | null;
  glCodeIntegrityStatus: string | null;
  glCodeIntegrityDetails: Record<string, unknown> | null;
  tbGlReconciliationStatus: string | null;
  tbGlReconciliationDetails: Record<string, unknown> | null;
  openExceptionsCount: number;
  exceptionsRegisterClosed: boolean;
  gateChecklist: GateChecklist | null;
  overridesLog: OverrideLogEntry[] | null;
  overrideApprovedById: string | null;
  overrideApprovedAt: string | null;
  overrideReason: string | null;
  lockedById: string | null;
  lockedAt: string | null;
  lockReason: string | null;
  archiveSnapshot: ArchiveSnapshot | null;
  createdAt: string;
  updatedAt: string;
  materialitySet?: { id: string; versionId: number; overallMateriality: number } | null;
  auditPlan?: { id: string; versionNumber: number } | null;
  lockedBy?: { id: string; fullName: string } | null;
  overrideApprovedBy?: { id: string; fullName: string } | null;
}

interface CheckGatesResponse {
  lockGate: LockGateEvidence;
  gateChecklist: GateChecklist;
  allGatesPassed: boolean;
}

interface LockGatePanelProps {
  engagementId: string;
  className?: string;
}

const ROLE_HIERARCHY: Record<string, number> = {
  STAFF: 1,
  SENIOR: 2,
  MANAGER: 3,
  EQCR: 4,
  PARTNER: 5,
  FIRM_ADMIN: 6,
};

function hasMinRole(userRole: string, minRole: string): boolean {
  return (ROLE_HIERARCHY[userRole?.toUpperCase()] || 0) >= (ROLE_HIERARCHY[minRole] || 0);
}

const STATUS_CONFIG: Record<LockGateStatus, { label: string; color: string; icon: typeof Clock }> = {
  PENDING: { label: "Pending", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200", icon: Clock },
  GATES_CHECKING: { label: "Checking...", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", icon: RefreshCw },
  GATES_PASSED: { label: "Gates Passed", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: CheckCircle2 },
  GATES_FAILED: { label: "Gates Failed", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", icon: XCircle },
  OVERRIDE_REQUESTED: { label: "Override Requested", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200", icon: AlertTriangle },
  OVERRIDE_APPROVED: { label: "Override Approved", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200", icon: Shield },
  LOCKED: { label: "Locked", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200", icon: Lock },
  ARCHIVED: { label: "Archived", color: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200", icon: Archive },
};

const GATE_DEFINITIONS = [
  { key: "materialityApproved", name: "Materiality Approved", description: "At least one MaterialitySet in APPROVED status", icon: Calculator },
  { key: "auditPlanApproved", name: "Audit Plan Approved", description: "AuditPlan in APPROVED/LOCKED status", icon: ClipboardCheck },
  { key: "allProceduresCompleted", name: "Procedures Completed", description: "All procedures in APPROVED status", icon: FileCheck },
  { key: "allExecutionResultsApproved", name: "Execution Results Approved", description: "All execution results reviewed and approved", icon: FileText },
  { key: "noOpenExceptions", name: "Exceptions Resolved", description: "All audit exceptions addressed", icon: AlertCircle },
];

function formatDate(dateString: string | null): string {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: LockGateStatus }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  return (
    <Badge className={cn("gap-1", config.color)} data-testid={`badge-status-${status.toLowerCase()}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

function GateStatusIcon({ passed }: { passed: boolean | undefined }) {
  if (passed === undefined) {
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
  return passed ? (
    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
  ) : (
    <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
  );
}

function GateStatusBadge({ passed }: { passed: boolean | undefined }) {
  if (passed === undefined) {
    return <Badge variant="outline" className="text-xs">Not Checked</Badge>;
  }
  return passed ? (
    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs">PASSED</Badge>
  ) : (
    <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-xs">FAILED</Badge>
  );
}

export function LockGatePanel({ engagementId, className }: LockGatePanelProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [showApproveOverrideDialog, setShowApproveOverrideDialog] = useState(false);
  const [showLockDialog, setShowLockDialog] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  
  const [overrideReason, setOverrideReason] = useState("");
  const [approveOverrideReason, setApproveOverrideReason] = useState("");
  const [lockReason, setLockReason] = useState("");
  
  const isPartner = hasMinRole(user?.role || "", "PARTNER");
  
  const { data: lockGate, isLoading, error } = useQuery<LockGateEvidence>({
    queryKey: ["/api/engagements", engagementId, "lock-gate"],
    enabled: !!engagementId,
  });
  
  const checkGatesMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/engagements/${engagementId}/lock-gate/check-gates`, {});
      return response.json() as Promise<CheckGatesResponse>;
    },
    onSuccess: (data) => {
      toast({
        title: data.allGatesPassed ? "All Gates Passed" : "Gate Check Complete",
        description: data.allGatesPassed 
          ? "All engagement gates have passed. Ready to lock." 
          : "Some gates have failed. Review the results below.",
        variant: data.allGatesPassed ? "default" : "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", engagementId, "lock-gate"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
  
  const requestOverrideMutation = useMutation({
    mutationFn: async (data: { reason: string; failedGates: string[] }) => {
      const response = await apiRequest("POST", `/api/engagements/${engagementId}/lock-gate/request-override`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Override Requested", description: "Override request submitted for partner approval" });
      setShowOverrideDialog(false);
      setOverrideReason("");
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", engagementId, "lock-gate"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
  
  const approveOverrideMutation = useMutation({
    mutationFn: async (data: { overrideReason: string }) => {
      const response = await apiRequest("POST", `/api/engagements/${engagementId}/lock-gate/approve-override`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Override Approved", description: "Override approved. Engagement can now be locked." });
      setShowApproveOverrideDialog(false);
      setApproveOverrideReason("");
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", engagementId, "lock-gate"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
  
  const lockEngagementMutation = useMutation({
    mutationFn: async (data: { lockReason?: string }) => {
      const response = await apiRequest("POST", `/api/engagements/${engagementId}/lock-gate/lock`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Engagement Locked", description: "Engagement has been locked and archived successfully" });
      setShowLockDialog(false);
      setLockReason("");
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", engagementId, "lock-gate"] });
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", engagementId] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
  
  const getFailedGates = (): string[] => {
    if (!lockGate?.gateChecklist) return [];
    return Object.entries(lockGate.gateChecklist)
      .filter(([_, result]) => result && !result.passed)
      .map(([key]) => key);
  };
  
  const canRequestOverride = lockGate?.status === "GATES_FAILED";
  const canApproveOverride = lockGate?.status === "OVERRIDE_REQUESTED" && isPartner;
  const canLock = (lockGate?.status === "GATES_PASSED" || lockGate?.status === "OVERRIDE_APPROVED") && isPartner;
  const isLocked = lockGate?.status === "LOCKED" || lockGate?.status === "ARCHIVED";
  
  if (isLoading) {
    return (
      <Card className={className} data-testid="lock-gate-panel-loading">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }
  
  if (error) {
    return (
      <Card className={className} data-testid="lock-gate-panel-error">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-5 w-5" />
            Lock Gate (ISA 230)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Failed to load lock gate data</span>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className={className} data-testid="lock-gate-panel">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="h-5 w-5" />
              Lock Gate (ISA 230)
              {lockGate && (
                <Badge variant="outline" className="ml-2">
                  v{lockGate.snapshotVersion}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Final engagement lock and archive controls
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {lockGate && <StatusBadge status={lockGate.status} />}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {isLocked && lockGate?.archiveSnapshot && (
          <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800">
            <div className="flex items-center gap-2 mb-3">
              <Archive className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <span className="font-medium text-emerald-800 dark:text-emerald-200">Engagement Locked & Archived</span>
              <Badge variant="outline" className="ml-auto">ISA 230</Badge>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Locked At:</span>
                <div className="font-medium" data-testid="text-locked-at">{formatDate(lockGate.lockedAt)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Locked By:</span>
                <div className="font-medium flex items-center gap-1" data-testid="text-locked-by">
                  <User className="h-3 w-3" />
                  {lockGate.lockedBy?.fullName || "-"}
                </div>
              </div>
              {lockGate.lockReason && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Lock Reason:</span>
                  <div className="font-medium" data-testid="text-lock-reason">{lockGate.lockReason}</div>
                </div>
              )}
            </div>
            
            <Collapsible className="mt-3">
              <CollapsibleTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <ChevronDown className="h-4 w-4" />
                View Archive Snapshot
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="text-xs p-3 bg-muted/50 rounded-lg space-y-1" data-testid="archive-snapshot">
                  <div>Archive Created: {lockGate.archiveSnapshot.createdAt}</div>
                  {lockGate.archiveSnapshot.materialitySets && (
                    <div>Materiality Sets: {lockGate.archiveSnapshot.materialitySets.length}</div>
                  )}
                  {lockGate.archiveSnapshot.auditPlans && (
                    <div>Audit Plans: {lockGate.archiveSnapshot.auditPlans.length}</div>
                  )}
                  {lockGate.archiveSnapshot.proceduresCount !== undefined && (
                    <div>Procedures: {lockGate.archiveSnapshot.proceduresCount}</div>
                  )}
                  {lockGate.archiveSnapshot.executionResultsCount !== undefined && (
                    <div>Execution Results: {lockGate.archiveSnapshot.executionResultsCount}</div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}
        
        {!isLocked && (
          <>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-sm font-medium">Gate Check Status</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => checkGatesMutation.mutate()}
                disabled={checkGatesMutation.isPending}
                data-testid="button-run-gate-checks"
              >
                {checkGatesMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-1" />
                )}
                Run Gate Checks
              </Button>
            </div>
            
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Gate</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {GATE_DEFINITIONS.map((gate) => {
                    const result = lockGate?.gateChecklist?.[gate.key as keyof GateChecklist];
                    const Icon = gate.icon;
                    return (
                      <TableRow key={gate.key} data-testid={`gate-row-${gate.key}`}>
                        <TableCell>
                          <GateStatusIcon passed={result?.passed} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium text-sm">{gate.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {gate.description}
                        </TableCell>
                        <TableCell className="text-center">
                          <GateStatusBadge passed={result?.passed} />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {result?.message || "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
        
        {lockGate?.overridesLog && lockGate.overridesLog.length > 0 && (
          <Collapsible open={showHistoryPanel} onOpenChange={setShowHistoryPanel}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between" data-testid="button-toggle-override-history">
                <span className="flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Override History ({lockGate.overridesLog.length})
                </span>
                <ChevronDown className={cn("h-4 w-4 transition-transform", showHistoryPanel && "rotate-180")} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <ScrollArea className="h-40">
                <div className="space-y-2">
                  {lockGate.overridesLog.map((entry, index) => (
                    <div key={index} className="p-3 rounded-lg bg-muted/50 text-sm">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {entry.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(entry.requestedAt)}
                        </span>
                      </div>
                      <div className="text-muted-foreground">{entry.reason}</div>
                      {entry.failedGates && entry.failedGates.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {entry.failedGates.map((gate) => (
                            <Badge key={gate} variant="outline" className="text-xs">
                              {gate}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {entry.approvedAt && (
                        <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
                          Approved: {formatDate(entry.approvedAt)} - {entry.approvalReason}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CollapsibleContent>
          </Collapsible>
        )}
        
        <Separator />
        
        <div className="flex items-center justify-end gap-2 flex-wrap">
          {canRequestOverride && (
            <Dialog open={showOverrideDialog} onOpenChange={setShowOverrideDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-request-override">
                  <Shield className="h-4 w-4 mr-1" />
                  Request Override
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Request Gate Override</DialogTitle>
                  <DialogDescription>
                    Submit a request to override failed gates. This requires partner approval.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Failed Gates</Label>
                    <div className="flex flex-wrap gap-1">
                      {getFailedGates().map((gate) => (
                        <Badge key={gate} variant="destructive" className="text-xs">
                          {gate}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="override-reason">Override Reason (Required)</Label>
                    <Textarea
                      id="override-reason"
                      placeholder="Explain why an override is needed..."
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      rows={4}
                      data-testid="input-override-reason"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowOverrideDialog(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => requestOverrideMutation.mutate({
                      reason: overrideReason,
                      failedGates: getFailedGates(),
                    })}
                    disabled={requestOverrideMutation.isPending || !overrideReason.trim()}
                    data-testid="button-submit-override-request"
                  >
                    {requestOverrideMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Submit Request
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          
          {canApproveOverride && (
            <Dialog open={showApproveOverrideDialog} onOpenChange={setShowApproveOverrideDialog}>
              <DialogTrigger asChild>
                <Button variant="default" data-testid="button-approve-override">
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Approve Override
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Approve Gate Override</DialogTitle>
                  <DialogDescription>
                    As a partner, you can approve this override request to allow engagement locking.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {lockGate?.overrideReason && (
                    <div className="space-y-2">
                      <Label>Original Request Reason</Label>
                      <div className="p-3 rounded-lg bg-muted/50 text-sm">
                        {lockGate.overrideReason}
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="approve-override-reason">Approval Reason (Required)</Label>
                    <Textarea
                      id="approve-override-reason"
                      placeholder="Explain why you are approving this override..."
                      value={approveOverrideReason}
                      onChange={(e) => setApproveOverrideReason(e.target.value)}
                      rows={4}
                      data-testid="input-approve-override-reason"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowApproveOverrideDialog(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => approveOverrideMutation.mutate({ overrideReason: approveOverrideReason })}
                    disabled={approveOverrideMutation.isPending || !approveOverrideReason.trim()}
                    data-testid="button-submit-override-approval"
                  >
                    {approveOverrideMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Approve Override
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          
          {canLock && (
            <AlertDialog open={showLockDialog} onOpenChange={setShowLockDialog}>
              <AlertDialogTrigger asChild>
                <Button variant="default" className="bg-emerald-600 hover:bg-emerald-700" data-testid="button-lock-engagement">
                  <Lock className="h-4 w-4 mr-1" />
                  Lock Engagement
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    Lock Engagement
                  </AlertDialogTitle>
                  <AlertDialogDescription className="space-y-3">
                    <p>
                      You are about to lock this engagement. This action will:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      <li>Create an immutable archive snapshot of all engagement data</li>
                      <li>Set the engagement status to COMPLETED</li>
                      <li>Prevent any further modifications to the engagement</li>
                      <li>Record the lock timestamp and your user ID for audit trail</li>
                    </ul>
                    <p className="font-medium text-foreground">
                      This action cannot be undone. Are you sure you want to proceed?
                    </p>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="py-4">
                  <Label htmlFor="lock-reason">Lock Reason (Optional)</Label>
                  <Textarea
                    id="lock-reason"
                    placeholder="Enter any additional notes for the lock..."
                    value={lockReason}
                    onChange={(e) => setLockReason(e.target.value)}
                    rows={2}
                    className="mt-2"
                    data-testid="input-lock-reason"
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => lockEngagementMutation.mutate({ lockReason: lockReason || undefined })}
                    disabled={lockEngagementMutation.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700"
                    data-testid="button-confirm-lock"
                  >
                    {lockEngagementMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Lock Engagement
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          
          {!canRequestOverride && !canApproveOverride && !canLock && !isLocked && (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Run gate checks to determine available actions
            </div>
          )}
        </div>
        
        {lockGate?.status === "OVERRIDE_REQUESTED" && !isPartner && (
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 text-sm">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <Clock className="h-4 w-4" />
              Override request pending partner approval
            </div>
          </div>
        )}
        
        <div className="flex items-center justify-end">
          <Badge variant="outline" className="text-xs">
            <Scale className="h-3 w-3 mr-1" />
            ISA 230 - Audit Documentation
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
