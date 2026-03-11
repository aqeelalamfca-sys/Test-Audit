import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import {
  AlertTriangle, CheckCircle2, Clock, Database,
  Shield, RefreshCw, Activity
} from "lucide-react";

interface PlanningProgressRibbonProps {
  engagementId: string;
}

export function PlanningProgressRibbon({ engagementId }: PlanningProgressRibbonProps) {
  const { data, dataUpdatedAt } = useQuery({
    queryKey: ["/api/planning-dashboard", engagementId, "readiness"],
    queryFn: () => fetchWithAuth(`/api/planning-dashboard/${engagementId}/readiness`).then(r => { if (!r.ok) throw new Error("Failed to fetch"); return r.json(); }),
    enabled: !!engagementId,
    refetchInterval: 30000,
    staleTime: 10000,
  });

  if (!data) return null;

  const { engagement, client, completionPercentage, riskSummary, intakeReadiness, canCompletePlanning, planningCompletion } = data;

  const approvalState = planningCompletion?.planningMemoApproved ? "approved" : planningCompletion?.planningMemoDone ? "pending-approval" : "draft";

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-lg border bg-muted/30 text-xs mb-2">
      <div className="flex items-center gap-1.5 mr-2">
        <Activity className="h-3.5 w-3.5 text-primary" />
        <span className="font-medium truncate max-w-[200px]">{client?.name}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">{engagement?.engagementCode}</span>
      </div>

      <div className="flex items-center gap-1.5 mr-2">
        <div className="w-20">
          <Progress value={completionPercentage || 0} className="h-1.5" />
        </div>
        <span className="font-medium tabular-nums">{completionPercentage || 0}%</span>
      </div>

      <div className="flex items-center gap-1.5">
        {riskSummary?.totalRisks > 0 ? (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 h-5">
            <AlertTriangle className="h-3 w-3" />
            {riskSummary.totalRisks} risks
            {riskSummary.significantRisks > 0 && ` (${riskSummary.significantRisks} sig.)`}
          </Badge>
        ) : null}

        {intakeReadiness?.openIssueCount > 0 && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 h-5 border-amber-300 text-amber-600">
            {intakeReadiness.openIssueCount} issues
          </Badge>
        )}

        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 gap-1 h-5 ${intakeReadiness?.tbUploaded ? "border-green-300 text-green-600" : "border-red-300 text-red-500"}`}>
          <Database className="h-3 w-3" />
          {intakeReadiness?.tbUploaded ? "Synced" : "No Data"}
        </Badge>

        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 gap-1 h-5 ${approvalState === "approved" ? "border-green-300 text-green-600" : approvalState === "pending-approval" ? "border-blue-300 text-blue-600" : "border-muted"}`}>
          {approvalState === "approved" ? <CheckCircle2 className="h-3 w-3" /> : approvalState === "pending-approval" ? <Shield className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
          {approvalState === "approved" ? "Approved" : approvalState === "pending-approval" ? "Pending" : "Draft"}
        </Badge>
      </div>

      <div className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
        <RefreshCw className="h-3 w-3" />
        {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : ""}
      </div>
    </div>
  );
}
