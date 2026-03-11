import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { formatAccounting } from "@/lib/formatters";
import {
  CheckCircle2, AlertTriangle, AlertCircle, ArrowRight,
  Database, Shield, Calculator, Target, FileText,
  TrendingUp, Users, Clock, RefreshCw, Loader2,
  BarChart3, Building2, Scale, Activity
} from "lucide-react";

interface PlanningDashboardProps {
  engagementId: string;
  onNavigateToTab: (tabId: string) => void;
}

export function PlanningDashboard({ engagementId, onNavigateToTab }: PlanningDashboardProps) {
  const { data, isLoading, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["/api/planning-dashboard", engagementId, "readiness"],
    queryFn: () => fetchWithAuth(`/api/planning-dashboard/${engagementId}/readiness`).then(r => { if (!r.ok) throw new Error("Failed to fetch"); return r.json(); }),
    enabled: !!engagementId,
    refetchInterval: 30000,
  });

  const { data: completionData } = useQuery({
    queryKey: ["/api/planning-dashboard", engagementId, "planning-completion"],
    queryFn: () => fetchWithAuth(`/api/planning-dashboard/${engagementId}/planning-completion`).then(r => { if (!r.ok) throw new Error("Failed to fetch"); return r.json(); }),
    enabled: !!engagementId,
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Loading planning dashboard...</span>
      </div>
    );
  }

  if (!data) return null;

  const { engagement, client, intakeReadiness, draftFsSummary, planningCompletion, completionPercentage, riskSignals, nextActions, riskSummary, canCompletePlanning } = data;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Planning Dashboard
          </h2>
          <p className="text-sm text-muted-foreground">
            {client?.name} — {engagement?.engagementCode} — {engagement?.yearEnd ? new Date(engagement.yearEnd).toLocaleDateString() : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 text-xs">
            <Clock className="h-3 w-3" />
            {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : ""}
          </Badge>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card className={`border-l-4 ${completionPercentage >= 100 ? "border-l-green-500" : completionPercentage >= 50 ? "border-l-blue-500" : "border-l-amber-500"}`}>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Planning Progress</span>
              <span className="text-2xl font-bold tabular-nums">{completionPercentage}%</span>
            </div>
            <Progress value={completionPercentage} className="h-2" />
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-violet-500">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Risks</span>
              <AlertTriangle className="h-4 w-4 text-violet-500" />
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-bold tabular-nums">{riskSummary?.totalRisks || 0}</span>
              <div className="flex gap-2 text-xs">
                {riskSummary?.significantRisks > 0 && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{riskSummary.significantRisks} significant</Badge>}
                {riskSummary?.fraudRisks > 0 && <Badge className="text-[10px] px-1.5 py-0 bg-orange-500">{riskSummary.fraudRisks} fraud</Badge>}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Data Intake</span>
              <Database className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tabular-nums">{data.intakeGatesPassed}/{data.intakeGatesTotal}</span>
              <span className="text-xs text-muted-foreground">gates passed</span>
            </div>
            {intakeReadiness.openIssueCount > 0 && (
              <Badge variant="outline" className="mt-1 text-[10px] border-amber-300 text-amber-600">
                {intakeReadiness.openIssueCount} open issues
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card className={`border-l-4 ${canCompletePlanning ? "border-l-green-500" : "border-l-red-400"}`}>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Readiness</span>
              {canCompletePlanning ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <AlertCircle className="h-4 w-4 text-red-400" />}
            </div>
            <span className="text-sm font-medium">
              {canCompletePlanning ? "Ready to Finalize" : "Pending Requirements"}
            </span>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Database className="h-4 w-4" />
              Data Intake Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { label: "Trial Balance", ready: intakeReadiness.tbUploaded, count: intakeReadiness.tbRecordCount, icon: FileText },
                { label: "General Ledger", ready: intakeReadiness.glUploaded, count: intakeReadiness.glRecordCount, icon: BarChart3 },
                { label: "Accounts Payable", ready: intakeReadiness.apUploaded, count: intakeReadiness.apRecordCount, icon: Scale },
                { label: "Accounts Receivable", ready: intakeReadiness.arUploaded, count: intakeReadiness.arRecordCount, icon: TrendingUp },
                { label: "Bank Statements", ready: intakeReadiness.bankUploaded, count: intakeReadiness.bankRecordCount, icon: Building2 },
                { label: "FS Mapping", ready: intakeReadiness.fsMapped, count: intakeReadiness.fsMappingCount, icon: Target },
              ].map((item) => (
                <div key={item.label} className={`flex items-center gap-2 p-2 rounded-md border ${item.ready ? "border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-800" : "border-muted bg-muted/30"}`}>
                  {item.ready ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{item.label}</p>
                    <p className="text-[10px] text-muted-foreground tabular-nums">
                      {item.ready ? `${item.count} records` : "Not uploaded"}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {draftFsSummary && (
              <>
                <Separator className="my-3" />
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Draft FS Totals</h4>
                  <div className="grid grid-cols-5 gap-2 text-xs">
                    {[
                      { label: "Total Assets", value: draftFsSummary.totalAssets, color: "text-green-700 dark:text-green-400" },
                      { label: "Liabilities", value: draftFsSummary.totalLiabilities, color: "text-red-600 dark:text-red-400" },
                      { label: "Equity", value: draftFsSummary.totalEquity, color: "text-blue-600 dark:text-blue-400" },
                      { label: "Income", value: draftFsSummary.totalIncome, color: "text-emerald-700 dark:text-emerald-400" },
                      { label: "Expenses", value: draftFsSummary.totalExpenses, color: "text-orange-600 dark:text-orange-400" },
                    ].map((item) => (
                      <div key={item.label}>
                        <p className="text-muted-foreground">{item.label}</p>
                        <p className={`font-semibold tabular-nums ${item.color}`}>{formatAccounting(Number(item.value) || 0)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <ArrowRight className="h-4 w-4" />
              Next Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {nextActions.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  All planning tasks complete
                </div>
              ) : (
                nextActions.slice(0, 6).map((action: any, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => onNavigateToTab(action.tab)}
                    className="w-full flex items-center gap-2 p-2 rounded-md border border-muted hover:bg-muted/50 transition-colors text-left"
                  >
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${action.priority === "high" ? "bg-red-500" : action.priority === "medium" ? "bg-amber-500" : "bg-blue-500"}`} />
                    <span className="text-xs flex-1">{action.label}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  </button>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {riskSignals.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              Risk Signals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
              {riskSignals.map((signal: string, idx: number) => (
                <div key={idx} className="flex items-start gap-2 text-xs">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <span>{signal}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {completionData && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Planning Section Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {completionData.sections?.map((section: any) => (
                <div
                  key={section.id}
                  onClick={() => onNavigateToTab(section.id)}
                  className="flex items-center gap-2 p-2 rounded-md border cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  {section.status === "approved" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                  ) : section.status === "draft" ? (
                    <Clock className="h-4 w-4 text-blue-500 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{section.label}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">{section.status.replace("-", " ")}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
