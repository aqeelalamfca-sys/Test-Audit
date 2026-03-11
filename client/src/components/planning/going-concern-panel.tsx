import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { formatAccounting } from "@/lib/formatters";
import {
  Loader2, AlertTriangle, CheckCircle2, AlertCircle,
  TrendingUp, Activity, Shield
} from "lucide-react";

interface GoingConcernPanelProps {
  engagementId: string;
  readOnly?: boolean;
  onFieldChange?: (field: string, value: any) => void;
  planningData?: any;
}

export function GoingConcernPanel({ engagementId, readOnly, onFieldChange, planningData }: GoingConcernPanelProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/planning-dashboard", engagementId, "going-concern-indicators"],
    queryFn: () => fetchWithAuth(`/api/planning-dashboard/${engagementId}/going-concern-indicators`).then(r => { if (!r.ok) throw new Error("Failed to fetch"); return r.json(); }),
    enabled: !!engagementId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Analyzing going concern indicators...</span>
      </div>
    );
  }

  const indicators = data?.indicators || [];
  const detectedCount = data?.detectedCount || 0;
  const autoAssessment = data?.autoAssessment || "LOW";
  const financialSummary = data?.financialSummary || {};

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Going Concern & Subsequent Events Planning
            </CardTitle>
            <Badge variant="outline" className="text-xs">ISA 570</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Auto-identified going concern indicators from Data Intake financials. Document management assessment and planned responses.
          </p>
        </CardHeader>
      </Card>

      <Card className={`border-l-4 ${autoAssessment === "HIGH" ? "border-l-red-500 bg-red-50/30 dark:bg-red-950/10" : autoAssessment === "MEDIUM" ? "border-l-amber-500 bg-amber-50/30 dark:bg-amber-950/10" : "border-l-green-500 bg-green-50/30 dark:bg-green-950/10"}`}>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold flex items-center gap-2">
                {autoAssessment === "HIGH" ? <AlertTriangle className="h-4 w-4 text-red-500" /> :
                 autoAssessment === "MEDIUM" ? <AlertCircle className="h-4 w-4 text-amber-500" /> :
                 <CheckCircle2 className="h-4 w-4 text-green-500" />}
                Auto-Assessment: {autoAssessment} Risk
              </h4>
              <p className="text-xs text-muted-foreground mt-1">
                {detectedCount} of {indicators.length} going concern indicators detected from financial data
              </p>
            </div>
            <Badge variant={autoAssessment === "HIGH" ? "destructive" : autoAssessment === "MEDIUM" ? "default" : "secondary"}>
              {detectedCount} indicators
            </Badge>
          </div>
        </CardContent>
      </Card>

      {financialSummary && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Key Financial Metrics (Auto-Computed)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {[
                { label: "Total Assets", value: formatAccounting(financialSummary.totalAssets || 0), color: "text-green-700 dark:text-green-400" },
                { label: "Total Liabilities", value: formatAccounting(financialSummary.totalLiabilities || 0), color: "text-red-600 dark:text-red-400" },
                { label: "Equity", value: formatAccounting(financialSummary.totalEquity || 0), color: financialSummary.totalEquity < 0 ? "text-red-600" : "text-blue-600 dark:text-blue-400" },
                { label: "Net Result", value: formatAccounting(financialSummary.netResult || 0), color: financialSummary.netResult < 0 ? "text-red-600" : "text-green-600" },
                { label: "Current Ratio", value: (financialSummary.currentRatio || 0).toFixed(2), color: financialSummary.currentRatio < 1 ? "text-red-600" : "" },
                { label: "Debt/Equity", value: (financialSummary.debtRatio || 0).toFixed(2), color: financialSummary.debtRatio > 3 ? "text-red-600" : "" },
              ].map((item) => (
                <div key={item.label} className="text-center p-2 rounded-md bg-muted/30">
                  <p className="text-[10px] text-muted-foreground uppercase">{item.label}</p>
                  <p className={`text-sm font-semibold tabular-nums ${item.color}`}>{item.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Going Concern Indicators
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {indicators.map((indicator: any, idx: number) => (
              <div key={idx} className={`flex items-start gap-3 p-2 rounded-md border ${indicator.detected ? "border-red-200 bg-red-50/30 dark:bg-red-950/10 dark:border-red-800" : "border-muted"}`}>
                {indicator.detected ? (
                  <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">{indicator.description}</span>
                    <Badge variant="outline" className="text-[10px]">{indicator.type}</Badge>
                    {indicator.detected && (
                      <Badge variant={indicator.severity === "HIGH" ? "destructive" : "default"} className="text-[10px]">
                        {indicator.severity}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Management Assessment & Plans</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs font-medium">Management Plans to Mitigate Going Concern Issues</Label>
            <Textarea
              value={planningData?.goingConcernManagementPlans || ""}
              onChange={(e) => onFieldChange?.("goingConcernManagementPlans", e.target.value)}
              placeholder="Document management's plans and their feasibility..."
              className="mt-1 text-xs min-h-[60px]"
              disabled={readOnly}
            />
          </div>
          <div>
            <Label className="text-xs font-medium">Planned Audit Procedures for Going Concern</Label>
            <Textarea
              value={planningData?.goingConcernAuditProcedures || ""}
              onChange={(e) => onFieldChange?.("goingConcernAuditProcedures", e.target.value)}
              placeholder="Document planned procedures to evaluate going concern..."
              className="mt-1 text-xs min-h-[60px]"
              disabled={readOnly}
            />
          </div>
          <div>
            <Label className="text-xs font-medium">Subsequent Events Planning Notes</Label>
            <Textarea
              value={planningData?.subsequentEventsPlan || ""}
              onChange={(e) => onFieldChange?.("subsequentEventsPlan", e.target.value)}
              placeholder="Document planned procedures for subsequent events review..."
              className="mt-1 text-xs min-h-[60px]"
              disabled={readOnly}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
