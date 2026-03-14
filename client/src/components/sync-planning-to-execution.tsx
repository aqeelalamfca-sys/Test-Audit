import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  ArrowRight, CheckCircle2,
  Loader2, ArrowRightFromLine, AlertTriangle, ShieldAlert
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SyncPreviewItem {
  riskId: string;
  accountOrClass: string;
  fsArea: string | null;
  assertion: string;
  riskLevel: string;
  isSignificant: boolean;
  isFraud: boolean;
  plannedResponse: string | null;
  alreadySynced: boolean;
}

interface SyncStats {
  totalRisks: number;
  alreadySynced: number;
  toSync: number;
  highRisks: number;
  significantRisks: number;
  fraudRisks: number;
}

interface SyncPreviewResponse {
  preview: SyncPreviewItem[];
  stats: SyncStats;
  materiality: { overall: number; performance: number } | null;
}

interface SyncPlanningToExecutionProps {
  engagementId: string;
}

export function SyncPlanningToExecution({ engagementId }: SyncPlanningToExecutionProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRiskIds, setSelectedRiskIds] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: preview, isLoading: loadingPreview } = useQuery<SyncPreviewResponse>({
    queryKey: ['/api/sync', engagementId, 'preview'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/sync/${engagementId}/planning-to-execution/preview`);
      return res.json();
    },
    enabled: dialogOpen,
  });

  const { data: status, isLoading: loadingStatus } = useQuery({
    queryKey: ['/api/sync', engagementId, 'status'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/sync/${engagementId}/sync-status`);
      return res.json();
    },
  });

  const syncMutation = useMutation({
    mutationFn: async (riskIds: string[]) => {
      const res = await apiRequest('POST', `/api/sync/${engagementId}/planning-to-execution`, {
        riskIds: riskIds.length > 0 ? riskIds : undefined,
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Risks synced successfully",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/sync', engagementId] });
      queryClient.invalidateQueries({ queryKey: ['/api/substantive-testing', engagementId] });
      setDialogOpen(false);
      setSelectedRiskIds(new Set());
    },
    onError: (error: any) => {
      toast({
        title: "Sync failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleOpenDialog = () => {
    setDialogOpen(true);
    setSelectedRiskIds(new Set());
  };

  const pendingItems = useMemo(() =>
    preview?.preview.filter(p => !p.alreadySynced) || [],
    [preview]
  );

  const syncedItems = useMemo(() =>
    preview?.preview.filter(p => p.alreadySynced) || [],
    [preview]
  );

  const handleSelectAll = () => {
    setSelectedRiskIds(new Set(pendingItems.map(p => p.riskId)));
  };

  const handleDeselectAll = () => {
    setSelectedRiskIds(new Set());
  };

  const handleToggleRisk = (riskId: string) => {
    const newSet = new Set(selectedRiskIds);
    if (newSet.has(riskId)) {
      newSet.delete(riskId);
    } else {
      newSet.add(riskId);
    }
    setSelectedRiskIds(newSet);
  };

  const handleSync = () => {
    syncMutation.mutate(Array.from(selectedRiskIds));
  };

  const allSynced = status?.unlinkedRisks === 0 && status?.risksCount > 0;

  return (
    <>
      <Card data-testid="card-sync-planning">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowRightFromLine className="h-5 w-5" />
            Sync to Execution Phase
          </CardTitle>
          <CardDescription>
            Link identified risks to substantive tests in execution
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {loadingStatus ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : status ? (
            <>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                <div className="flex items-center gap-3">
                  <div data-testid="text-risks-count">
                    <p className="text-xl font-bold">{status.risksCount}</p>
                    <p className="text-[11px] text-muted-foreground">Risks</p>
                  </div>
                  <div data-testid="text-linked-count">
                    <p className="text-xl font-bold text-emerald-600">{status.linkedTestsCount}</p>
                    <p className="text-[11px] text-muted-foreground">Linked</p>
                  </div>
                  {status.unlinkedRisks > 0 && (
                    <div data-testid="text-pending-count">
                      <p className="text-xl font-bold text-amber-600">{status.unlinkedRisks}</p>
                      <p className="text-[11px] text-muted-foreground">Pending</p>
                    </div>
                  )}
                </div>
                {allSynced && (
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 gap-1" data-testid="badge-all-synced">
                    <CheckCircle2 className="h-3 w-3" />
                    All synced
                  </Badge>
                )}
              </div>

              <Button
                onClick={handleOpenDialog}
                className="w-full gap-2"
                variant={allSynced ? "outline" : "default"}
                disabled={status?.risksCount === 0}
                data-testid="btn-open-sync-dialog"
              >
                <ArrowRight className="h-4 w-4" />
                {allSynced ? "Review Synced Risks" : `Sync ${status.unlinkedRisks} Pending Risk${status.unlinkedRisks !== 1 ? 's' : ''}`}
              </Button>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0">
          <DialogHeader className="px-3 pt-6 pb-4">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <ArrowRightFromLine className="h-5 w-5 text-primary" />
              Sync Risks to Execution
            </DialogTitle>
            <DialogDescription>
              Select the risks you want to create substantive tests for
            </DialogDescription>
          </DialogHeader>

          {loadingPreview ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : preview ? (
            <>
              <div className="px-3 pb-3 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {pendingItems.length > 0
                    ? `${pendingItems.length} risk${pendingItems.length !== 1 ? 's' : ''} ready to sync`
                    : "All risks are already synced"}
                  {syncedItems.length > 0 && ` · ${syncedItems.length} already synced`}
                </p>
                {pendingItems.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7"
                    onClick={selectedRiskIds.size === pendingItems.length ? handleDeselectAll : handleSelectAll}
                    data-testid="btn-toggle-select-all"
                  >
                    {selectedRiskIds.size === pendingItems.length ? "Deselect all" : "Select all"}
                  </Button>
                )}
              </div>

              <ScrollArea className="flex-1 max-h-[50vh] border-t [&>[data-radix-scroll-area-viewport]]:scroll-smooth [&_[data-radix-scroll-area-scrollbar]]:w-2.5 [&_[data-radix-scroll-area-scrollbar]]:bg-muted/60 [&_[data-radix-scroll-area-thumb]]:bg-muted-foreground/40">
                <div className="divide-y">
                  {pendingItems.map((item) => (
                    <RiskRow
                      key={item.riskId}
                      item={item}
                      selected={selectedRiskIds.has(item.riskId)}
                      onToggle={() => handleToggleRisk(item.riskId)}
                    />
                  ))}
                  {syncedItems.map((item) => (
                    <RiskRow
                      key={item.riskId}
                      item={item}
                      selected={false}
                      onToggle={() => {}}
                      disabled
                    />
                  ))}
                </div>
              </ScrollArea>
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground px-3">
              <ShieldAlert className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No risks found</p>
              <p className="text-sm mt-1">Add risks in the Risk Assessment section first.</p>
            </div>
          )}

          <DialogFooter className="px-3 py-2 border-t bg-muted/30">
            <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="btn-cancel-sync">
              Cancel
            </Button>
            <Button
              onClick={handleSync}
              disabled={selectedRiskIds.size === 0 || syncMutation.isPending}
              className="gap-2 min-w-[160px]"
              data-testid="btn-confirm-sync"
            >
              {syncMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <ArrowRight className="h-4 w-4" />
                  Sync {selectedRiskIds.size || ""} Risk{selectedRiskIds.size !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RiskRow({ item, selected, onToggle, disabled }: {
  item: SyncPreviewItem;
  selected: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex items-center gap-2.5 px-3 py-3 transition-colors",
        disabled
          ? "opacity-50 cursor-default"
          : "cursor-pointer hover:bg-muted/50",
        selected && !disabled && "bg-primary/5"
      )}
      data-testid={`risk-row-${item.riskId}`}
    >
      <Checkbox
        checked={disabled ? true : selected}
        onCheckedChange={onToggle}
        disabled={disabled}
        aria-label={`${disabled ? "Already synced" : "Select"}: ${item.accountOrClass} — ${item.assertion}`}
        data-testid={`checkbox-risk-${item.riskId}`}
      />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" data-testid={`text-risk-account-${item.riskId}`}>
          {item.accountOrClass}
        </p>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
          <span>{item.fsArea?.replace(/_/g, ' ') || '—'}</span>
          <span>·</span>
          <span>{item.assertion}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <RiskLevelPill level={item.riskLevel} />
        {item.isSignificant && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">Significant</Badge>
        )}
        {item.isFraud && (
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5">Fraud</Badge>
        )}
        {disabled && (
          <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
        )}
      </div>
    </label>
  );
}

function RiskLevelPill({ level }: { level: string }) {
  const upper = level.toUpperCase();
  return (
    <span className={cn(
      "inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full",
      upper === "HIGH" && "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
      upper === "MEDIUM" && "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
      upper === "LOW" && "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
      upper !== "HIGH" && upper !== "MEDIUM" && upper !== "LOW" && "bg-muted text-muted-foreground",
    )}>
      {upper === "HIGH" && <AlertTriangle className="h-2.5 w-2.5" />}
      {level}
    </span>
  );
}
