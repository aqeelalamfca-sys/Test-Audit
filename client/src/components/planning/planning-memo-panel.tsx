import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { formatAccounting } from "@/lib/formatters";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  FileText, Shield, CheckCircle2, Clock, Lock,
  AlertTriangle, Loader2, FileOutput, Users
} from "lucide-react";

interface PlanningMemoPanelProps {
  engagementId: string;
  readOnly?: boolean;
  onFieldChange?: (field: string, value: any) => void;
  planningData?: any;
}

export function PlanningMemoPanel({ engagementId, readOnly, onFieldChange, planningData }: PlanningMemoPanelProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: dashboardData } = useQuery({
    queryKey: ["/api/planning-dashboard", engagementId, "readiness"],
    queryFn: () => fetchWithAuth(`/api/planning-dashboard/${engagementId}/readiness`).then(r => { if (!r.ok) throw new Error("Failed to fetch"); return r.json(); }),
    enabled: !!engagementId,
  });

  const { data: completionData } = useQuery({
    queryKey: ["/api/planning-dashboard", engagementId, "planning-completion"],
    queryFn: () => fetchWithAuth(`/api/planning-dashboard/${engagementId}/planning-completion`).then(r => { if (!r.ok) throw new Error("Failed to fetch"); return r.json(); }),
    enabled: !!engagementId,
  });

  const { data: analyticsData } = useQuery({
    queryKey: ["/api/planning-dashboard", engagementId, "analytical-review"],
    queryFn: () => fetchWithAuth(`/api/planning-dashboard/${engagementId}/analytical-review`).then(r => { if (!r.ok) throw new Error("Failed to fetch"); return r.json(); }),
    enabled: !!engagementId,
  });

  const { data: memoData } = useQuery({
    queryKey: ["/api/planning", engagementId, "planning-memo"],
    queryFn: () => fetchWithAuth(`/api/planning/${engagementId}/planning-memo`).then(r => { if (!r.ok) throw new Error("Failed to fetch"); return r.json(); }),
    enabled: !!engagementId,
  });

  const memo = memoData || {};
  const completion = completionData || {};
  const dashboard = dashboardData || {};
  const analytics = analyticsData || {};

  const isApproved = !!memo.partnerApprovedById;
  const isReviewed = !!memo.managerReviewedById;
  const isLocked = memo.isLocked;

  const generateMemoSummary = async () => {
    setIsGenerating(true);
    try {
      const engagement = dashboard.engagement || {};
      const client = dashboard.client || {};
      const riskSummary = dashboard.riskSummary || {};
      const fsSummary = analytics.fsSummary || {};
      const planningCompletion = dashboard.planningCompletion || {};

      const generatedOverview = [
        `Engagement: ${engagement.engagementCode || "N/A"} — ${client.name || "N/A"}`,
        `Period: ${engagement.periodStart ? new Date(engagement.periodStart).toLocaleDateString() : "N/A"} to ${engagement.periodEnd ? new Date(engagement.periodEnd).toLocaleDateString() : "N/A"}`,
        `Reporting Framework: ${engagement.reportingFramework || "IFRS"}`,
        `Engagement Type: ${engagement.engagementType || "Statutory Audit"}`,
        engagement.isFirstYear ? "First-year audit engagement" : "Recurring engagement",
      ].join("\n");

      const generatedHighlights = [
        `Total Assets: ${formatAccounting(Number(fsSummary.totalAssets) || 0)}`,
        `Total Liabilities: ${formatAccounting(Number(fsSummary.totalLiabilities) || 0)}`,
        `Total Equity: ${formatAccounting(Number(fsSummary.totalEquity) || 0)}`,
        `Total Income: ${formatAccounting(Number(fsSummary.totalIncome) || 0)}`,
        `Net Profit: ${formatAccounting(Number(fsSummary.netProfit) || 0)}`,
      ].join("\n");

      const generatedRisks = [
        `Total Risks: ${riskSummary.totalRisks || 0}`,
        `Significant Risks: ${riskSummary.significantRisks || 0}`,
        `Fraud Risks: ${riskSummary.fraudRisks || 0}`,
        `High/Significant Inherent Risks: ${riskSummary.highRisks || 0}`,
      ].join("\n");

      onFieldChange?.("memoOverview", generatedOverview);
      onFieldChange?.("memoFinancialHighlights", generatedHighlights);
      onFieldChange?.("memoRiskSummary", generatedRisks);

      toast({ title: "Memo Sections Generated", description: "Key sections auto-populated from planning data." });
    } catch (error) {
      toast({ title: "Generation Failed", description: "Could not generate memo sections.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Planning Memo / Final Approval
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Compiled from all planning tabs. Requires manager review and partner approval.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isLocked && <Badge variant="outline" className="text-[10px] gap-1"><Lock className="h-3 w-3" />Locked</Badge>}
              {isApproved ? (
                <Badge className="bg-green-600 text-[10px] gap-1"><CheckCircle2 className="h-3 w-3" />Approved</Badge>
              ) : isReviewed ? (
                <Badge className="bg-blue-600 text-[10px] gap-1"><Shield className="h-3 w-3" />Reviewed</Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px] gap-1"><Clock className="h-3 w-3" />Draft</Badge>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {completion?.completionPercentage < 100 && (
        <Card className="border-amber-200 bg-amber-50/30 dark:bg-amber-950/10">
          <CardContent className="pt-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Planning Not Complete</p>
                <p className="text-xs text-muted-foreground">
                  {completion.notStarted || 0} sections not started, {completion.inProgress || 0} in progress.
                  Complete all planning sections before finalizing the memo.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={generateMemoSummary}
          disabled={readOnly || isLocked || isGenerating}
          className="text-xs gap-1.5"
        >
          {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileOutput className="h-3.5 w-3.5" />}
          Auto-Generate from Planning Data
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Engagement Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={planningData?.memoOverview || ""}
            onChange={(e) => onFieldChange?.("memoOverview", e.target.value)}
            placeholder="Engagement overview auto-populated from engagement setup..."
            className="text-xs min-h-[80px]"
            disabled={readOnly || isLocked}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Financial Highlights</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={planningData?.memoFinancialHighlights || ""}
            onChange={(e) => onFieldChange?.("memoFinancialHighlights", e.target.value)}
            placeholder="Key financial highlights from Draft FS and analytical review..."
            className="text-xs min-h-[80px]"
            disabled={readOnly || isLocked}
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Materiality Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={planningData?.memoMateriality || ""}
              onChange={(e) => onFieldChange?.("memoMateriality", e.target.value)}
              placeholder="Materiality benchmark, overall and performance materiality, posting threshold..."
              className="text-xs min-h-[60px]"
              disabled={readOnly || isLocked}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Significant Areas</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={planningData?.memoSignificantAreas || ""}
              onChange={(e) => onFieldChange?.("memoSignificantAreas", e.target.value)}
              placeholder="Key significant accounts and classes of transactions..."
              className="text-xs min-h-[60px]"
              disabled={readOnly || isLocked}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Key Risks Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={planningData?.memoRiskSummary || ""}
              onChange={(e) => onFieldChange?.("memoRiskSummary", e.target.value)}
              placeholder="Summary of significant and fraud risks..."
              className="text-xs min-h-[60px]"
              disabled={readOnly || isLocked}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Fraud Considerations</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={planningData?.memoFraudConsiderations || ""}
              onChange={(e) => onFieldChange?.("memoFraudConsiderations", e.target.value)}
              placeholder="Fraud risk summary and planned responses..."
              className="text-xs min-h-[60px]"
              disabled={readOnly || isLocked}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Overall Audit Strategy</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={planningData?.memoAuditStrategy || ""}
            onChange={(e) => onFieldChange?.("memoAuditStrategy", e.target.value)}
            placeholder="Overall audit strategy including approach (substantive/combined), timing, team deployment..."
            className="text-xs min-h-[80px]"
            disabled={readOnly || isLocked}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4" />
            Team & Timing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={planningData?.memoTeamTiming || ""}
            onChange={(e) => onFieldChange?.("memoTeamTiming", e.target.value)}
            placeholder="Team composition, budgeted hours, key milestones and deadlines..."
            className="text-xs min-h-[60px]"
            disabled={readOnly || isLocked}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Additional Matters</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={planningData?.memoAdditionalMatters || ""}
            onChange={(e) => onFieldChange?.("memoAdditionalMatters", e.target.value)}
            placeholder="Any other matters to document in the planning memo..."
            className="text-xs min-h-[60px]"
            disabled={readOnly || isLocked}
          />
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Approvals & Sign-Off
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 rounded-md border text-center">
              <p className="text-[10px] text-muted-foreground uppercase mb-1">Prepared By</p>
              <p className="text-xs font-medium">{memo.preparedBy?.name || "—"}</p>
              <p className="text-[10px] text-muted-foreground">{memo.preparedDate ? new Date(memo.preparedDate).toLocaleDateString() : "—"}</p>
            </div>
            <div className={`p-3 rounded-md border text-center ${isReviewed ? "border-blue-200 bg-blue-50/30 dark:bg-blue-950/10" : ""}`}>
              <p className="text-[10px] text-muted-foreground uppercase mb-1">Manager Review</p>
              <p className="text-xs font-medium">{memo.managerReviewedBy?.name || "Pending"}</p>
              <p className="text-[10px] text-muted-foreground">{memo.managerReviewedDate ? new Date(memo.managerReviewedDate).toLocaleDateString() : "—"}</p>
            </div>
            <div className={`p-3 rounded-md border text-center ${isApproved ? "border-green-200 bg-green-50/30 dark:bg-green-950/10" : ""}`}>
              <p className="text-[10px] text-muted-foreground uppercase mb-1">Partner Approval</p>
              <p className="text-xs font-medium">{memo.partnerApprovedBy?.name || "Pending"}</p>
              <p className="text-[10px] text-muted-foreground">{memo.partnerApprovalDate ? new Date(memo.partnerApprovalDate).toLocaleDateString() : "—"}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
