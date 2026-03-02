import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useEngagement } from "@/lib/workspace-context";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle, CheckCircle2, Clock, Shield, RefreshCw,
  FileText, Loader2, TrendingUp, Scale, ClipboardCheck,
  AlertCircle, Target, User, Calendar, Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FinalizationBoardData {
  id: string;
  engagementId: string;
  userId: string;
  userRole: string;
  pendingExecutionItems: number;
  openReviewNotes: number;
  unresolvedIssues: number;
  unadjustedMisstatements: number;
  unadjustedTotalAmount: number;
  kamItems: number;
  kamDraftIncomplete: number;
  missingEvidence: number;
  highSeverityIssues: number;
  mediumSeverityIssues: number;
  staleItemsDays: number;
  riskScore: number;
  riskLevel: string;
  riskDrivers: { drivers?: string[]; actions?: string[] } | string[] | null;
  aiRecommendations: { narrative?: string; recommendations?: string[] } | null;
  aiNarrative?: string | null;
  generatedAt: string;
  status: string;
  generatedByName?: string;
  generatedByRole?: string;
}

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

const RISK_CONFIG: Record<string, { color: string; bg: string; border: string; icon: typeof AlertTriangle }> = {
  LOW: { color: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-50 dark:bg-emerald-950/40", border: "border-emerald-200 dark:border-emerald-800", icon: CheckCircle2 },
  MEDIUM: { color: "text-amber-700 dark:text-amber-300", bg: "bg-amber-50 dark:bg-amber-950/40", border: "border-amber-200 dark:border-amber-800", icon: AlertTriangle },
  HIGH: { color: "text-red-700 dark:text-red-300", bg: "bg-red-50 dark:bg-red-950/40", border: "border-red-200 dark:border-red-800", icon: AlertCircle },
};

export function FinalizationControlBoard() {
  const { user } = useAuth();
  const { engagementId, engagement } = useEngagement();
  const { toast } = useToast();

  const { data: boardResponse, isLoading } = useQuery<{
    board: FinalizationBoardData | null;
    engagementCode?: string;
    message?: string;
  }>({
    queryKey: ["/api/finalization-board", engagementId, "board"],
    enabled: !!engagementId,
    staleTime: 60000,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/finalization-board/${engagementId}/generate-board`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/finalization-board", engagementId, "board"] });
      toast({ title: "Board Generated", description: "Finalization Control Board has been generated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Generation Failed", description: error.message, variant: "destructive" });
    },
  });

  const board = boardResponse?.board;
  const userRole = user?.role || "STAFF";
  const isAssociate = ["STAFF", "SENIOR", "TEAM_LEAD"].includes(userRole);
  const isManager = userRole === "MANAGER";
  const isPartner = ["PARTNER", "MANAGING_PARTNER", "ADMIN"].includes(userRole);

  const scopeLabel = isAssociate ? "Your Items" : isManager ? "Team View" : "Engagement Summary";

  const riskConfig = board ? (RISK_CONFIG[board.riskLevel] || RISK_CONFIG.LOW) : RISK_CONFIG.LOW;
  const RiskIcon = riskConfig.icon;

  const drivers = board?.riskDrivers
    ? Array.isArray(board.riskDrivers) ? board.riskDrivers : (board.riskDrivers as any)?.drivers || []
    : [];
  const actions = board?.riskDrivers && !Array.isArray(board.riskDrivers) ? (board.riskDrivers as any)?.actions || [] : [];
  const aiNarrative = board?.aiNarrative || (board?.aiRecommendations as any)?.narrative || null;
  const aiRecs = (board?.aiRecommendations as any)?.recommendations || [];

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse" data-testid="finalization-board-loading">
        <div className="h-20 bg-muted rounded-lg" />
        <div className="grid grid-cols-3 gap-4">
          <div className="h-32 bg-muted rounded-lg" />
          <div className="h-32 bg-muted rounded-lg" />
          <div className="h-32 bg-muted rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="finalization-control-board">
      <Card className="border-2 border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="flex items-center gap-2" data-testid="board-title">
                <Shield className="h-5 w-5 text-primary" />
                Finalization Control Board
              </CardTitle>
              <CardDescription className="mt-1">
                {engagement?.engagementCode || boardResponse?.engagementCode || "Engagement"} — {scopeLabel}
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right text-sm">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <User className="h-3.5 w-3.5" />
                  <span data-testid="board-user">{user?.fullName || user?.username}</span>
                  <Badge variant="outline" className="text-xs ml-1">{userRole}</Badge>
                </div>
                {board && (
                  <div className="flex items-center gap-1.5 text-muted-foreground mt-0.5">
                    <Calendar className="h-3.5 w-3.5" />
                    <span className="text-xs" data-testid="board-generated-at">{formatTimestampPKT(board.generatedAt)}</span>
                  </div>
                )}
              </div>
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                size="sm"
                data-testid="button-generate-board"
              >
                {generateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-1.5" />
                )}
                {board ? "Regenerate" : "Generate Board"}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {!board && (
        <Card className="py-12">
          <CardContent className="text-center">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <h3 className="font-semibold text-lg mb-1">No Board Generated</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Generate the Finalization Control Board to see a comprehensive summary of pending items, risk assessment, and readiness for sign-off.
            </p>
          </CardContent>
        </Card>
      )}

      {board && (
        <>
          <Card className={cn("border", riskConfig.border, riskConfig.bg)} data-testid="risk-score-card">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className={cn("p-3 rounded-xl", riskConfig.bg)}>
                    <RiskIcon className={cn("h-8 w-8", riskConfig.color)} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Overall Risk Score</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className={cn("text-3xl font-bold", riskConfig.color)} data-testid="text-risk-score">{board.riskScore}</span>
                      <span className="text-lg text-muted-foreground">/100</span>
                      <Badge className={cn("text-sm font-semibold", riskConfig.bg, riskConfig.color)} variant="outline" data-testid="badge-risk-level">
                        {board.riskLevel}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex-1 max-w-xs">
                  <Progress value={board.riskScore} className="h-3" />
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>Low (0-29)</span>
                    <span>Medium (30-59)</span>
                    <span>High (60-100)</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatTile
              title="Pending Execution Items"
              value={board.pendingExecutionItems}
              icon={ClipboardCheck}
              description="Open procedures requiring completion"
              severity={board.pendingExecutionItems > 0 ? "warning" : "success"}
              testId="tile-pending-execution"
            />
            <StatTile
              title="Unadjusted Differences (ISA 450)"
              value={board.unadjustedMisstatements}
              icon={Scale}
              description={`Total amount: ${board.unadjustedTotalAmount?.toLocaleString() || "0"}`}
              severity={board.unadjustedMisstatements > 0 ? "warning" : "success"}
              testId="tile-unadjusted"
            />
            <StatTile
              title="Key Audit Matters (ISA 701)"
              value={board.kamItems}
              icon={FileText}
              description={board.kamDraftIncomplete > 0 ? `${board.kamDraftIncomplete} draft(s) incomplete` : "All KAMs documented"}
              severity={board.kamDraftIncomplete > 0 ? "warning" : "success"}
              testId="tile-kam"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatTile
              title="Open Review Notes"
              value={board.openReviewNotes}
              icon={AlertTriangle}
              severity={board.openReviewNotes > 0 ? "warning" : "success"}
              testId="tile-review-notes"
              compact
            />
            <StatTile
              title="High Severity"
              value={board.highSeverityIssues}
              icon={AlertCircle}
              severity={board.highSeverityIssues > 0 ? "danger" : "success"}
              testId="tile-high-severity"
              compact
            />
            <StatTile
              title="Medium Severity"
              value={board.mediumSeverityIssues}
              icon={AlertTriangle}
              severity={board.mediumSeverityIssues > 0 ? "warning" : "success"}
              testId="tile-medium-severity"
              compact
            />
            <StatTile
              title="Missing Evidence"
              value={board.missingEvidence}
              icon={Target}
              severity={board.missingEvidence > 0 ? "warning" : "success"}
              testId="tile-missing-evidence"
              compact
            />
          </div>

          {drivers.length > 0 && (
            <Card data-testid="risk-drivers-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Top Risk Drivers
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {drivers.map((driver: string, idx: number) => (
                  <div key={idx} className="flex items-start gap-2 text-sm" data-testid={`risk-driver-${idx}`}>
                    <span className="font-bold text-primary mt-0.5">{idx + 1}.</span>
                    <span>{driver}</span>
                  </div>
                ))}
                {actions.length > 0 && (
                  <>
                    <Separator className="my-3" />
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recommended Actions</p>
                    {actions.map((action: string, idx: number) => (
                      <div key={idx} className="flex items-start gap-2 text-sm" data-testid={`risk-action-${idx}`}>
                        <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                        <span>{action}</span>
                      </div>
                    ))}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {(aiNarrative || aiRecs.length > 0) && (
            <Card className="border-primary/20" data-testid="ai-narrative-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  AI Risk Analysis
                </CardTitle>
                <CardDescription>AI-assisted narrative based on current engagement data</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {aiNarrative && (
                  <p className="text-sm leading-relaxed text-foreground" data-testid="ai-narrative-text">{aiNarrative}</p>
                )}
                {aiRecs.length > 0 && (
                  <>
                    <Separator />
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">AI Recommendations</p>
                    {aiRecs.map((rec: string, idx: number) => (
                      <div key={idx} className="flex items-start gap-2 text-sm" data-testid={`ai-rec-${idx}`}>
                        <Sparkles className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
                        <span>{rec}</span>
                      </div>
                    ))}
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function StatTile({
  title, value, icon: Icon, description, severity, testId, compact,
}: {
  title: string;
  value: number;
  icon: typeof AlertTriangle;
  description?: string;
  severity: "success" | "warning" | "danger";
  testId: string;
  compact?: boolean;
}) {
  const severityConfig = {
    success: { bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-300", icon: "text-emerald-500" },
    warning: { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-300", icon: "text-amber-500" },
    danger: { bg: "bg-red-50 dark:bg-red-950/30", text: "text-red-700 dark:text-red-300", icon: "text-red-500" },
  };
  const cfg = severityConfig[severity];

  return (
    <Card className={cn("border", cfg.bg)} data-testid={testId}>
      <CardContent className={cn(compact ? "pt-3 pb-3" : "pt-4 pb-4")}>
        <div className="flex items-center gap-3">
          <Icon className={cn(compact ? "h-5 w-5" : "h-6 w-6", cfg.icon)} />
          <div className="min-w-0 flex-1">
            <p className={cn("font-medium truncate", compact ? "text-xs" : "text-sm")}>{title}</p>
            <p className={cn("font-bold", compact ? "text-xl" : "text-2xl", cfg.text)} data-testid={`${testId}-value`}>{value}</p>
            {description && !compact && (
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
