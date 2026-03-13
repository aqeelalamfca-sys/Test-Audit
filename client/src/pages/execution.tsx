import { useMemo, useCallback, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useEngagement } from "@/lib/workspace-context";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CheckCircle2, Shield, Layers, ArrowRight,
  ClipboardList, AlertCircle, XCircle, AlertTriangle, FolderOpen,
  FileText, Info, Search, Filter
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { PageShell } from "@/components/page-shell";
import { usePhaseRoleGuard } from "@/hooks/use-phase-role-guard";
import { useExecutionSaveBridge } from "@/hooks/use-execution-save-bridge";
import { useToast } from "@/hooks/use-toast";
import { AICopilotToggle } from "@/components/ai-copilot-panel";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface PlanningPrerequisite {
  id: string;
  label: string;
  description: string;
  status: boolean;
  isaReference: string;
}

interface FSHeadSummary {
  fsHeadKey: string;
  name: string;
  balance: number;
  currentYearBalance?: number;
  priorYearBalance?: number;
  riskLevel: string;
  proceduresCount: number;
  completionPercent: number;
  status: string;
}

function getHeadTrafficLight(status: string): 'green' | 'amber' | 'red' {
  const s = status?.toUpperCase() || "";
  if (s === "APPROVED" || s === "LOCKED") return "green";
  if (s === "NOT_STARTED" || s === "RETURNED" || !s) return "red";
  return "amber";
}

export default function Execution() {
  const params = useParams<{ engagementId: string }>();
  const {
    engagementId: contextEngagementId,
    engagement,
    client,
  } = useEngagement();
  const engagementId = params.engagementId || contextEngagementId || undefined;
  const { isReadOnly: executionReadOnly } = usePhaseRoleGuard("fieldwork", "EXECUTION");
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: planningStatusData } = useQuery<{
    tbUploaded: boolean;
    glUploaded: boolean;
    mappingApproved: boolean;
    materialityApproved: boolean;
    riskAssessmentApproved: boolean;
    auditProgramApproved: boolean;
  }>({
    queryKey: ['/api/engagements', engagementId, 'planning-status'],
    enabled: !!engagementId
  });

  const { data: fsHeadsResponse, isLoading: fsHeadsLoading } = useQuery<{ success: boolean; fsHeads: FSHeadSummary[] }>({
    queryKey: ['/api/engagements', engagementId, 'fs-heads-summary'],
    enabled: !!engagementId
  });

  const { data: complianceSummaryData } = useQuery<{
    success: boolean;
    summary: {
      totalHeads: number;
      approvedHeads: number;
      overallCompletion: number;
      canProceedToFinalization: boolean;
      finalizationBlockers: string[];
      totalProcedures: number;
      completedProcedures: number;
      openProcedures: number;
      totalReviewPoints: number;
      openReviewPoints: number;
      totalEvidence: number;
      highRiskPending: number;
      isaCompliance: {
        allHeadsHaveEvidence: boolean;
        allRisksLinked: boolean;
        allConclusionsWritten: boolean;
        allReviewPointsCleared: boolean;
      };
    };
    perHead: {
      fsHeadKey: string;
      fsHeadName: string;
      status: string;
      completionPercent: number;
      trafficLight: 'green' | 'amber' | 'red';
      procedureCount: number;
      completedProcedures: number;
      openProcedures: number;
      hasEvidence: boolean;
      evidenceCount: number;
      hasConclusion: boolean;
      openReviewPoints: number;
      totalReviewPoints: number;
      riskLevel: string;
      hasFraudRisk: boolean;
      hasSignificantRisk: boolean;
      linkedRiskCount: number;
    }[];
  }>({
    queryKey: ['/api/engagements', engagementId, 'execution-compliance-summary'],
    enabled: !!engagementId
  });

  const complianceSummary = complianceSummaryData?.summary;
  const isaCompliance = complianceSummary?.isaCompliance;
  const perHead = complianceSummaryData?.perHead || [];

  const fsHeadsSummary = fsHeadsResponse?.fsHeads || [];

  const planningPrerequisites: PlanningPrerequisite[] = useMemo(() => [
    { id: "tb-uploaded", label: "TB Uploaded", description: "Trial Balance data has been uploaded", status: planningStatusData?.tbUploaded ?? false, isaReference: "ISA 500" },
    { id: "gl-uploaded", label: "GL Uploaded", description: "General Ledger data has been uploaded", status: planningStatusData?.glUploaded ?? false, isaReference: "ISA 500" },
    { id: "mapping-approved", label: "Mapping Approved", description: "TB/GL to CoA mapping has been approved", status: planningStatusData?.mappingApproved ?? false, isaReference: "ISA 315" },
    { id: "materiality-approved", label: "Materiality Approved", description: "Materiality thresholds have been approved", status: planningStatusData?.materialityApproved ?? false, isaReference: "ISA 320" },
    { id: "risk-assessment-approved", label: "Risk Assessment Approved", description: "Risk assessment has been approved", status: planningStatusData?.riskAssessmentApproved ?? false, isaReference: "ISA 315 (Revised)" },
    { id: "audit-program-approved", label: "Audit Program Approved", description: "Audit program has been approved", status: planningStatusData?.auditProgramApproved ?? false, isaReference: "ISA 300, ISA 330" },
  ], [planningStatusData]);

  const allPlanningPrerequisitesMet = planningPrerequisites.every(p => p.status);
  const prerequisitesPassedCount = planningPrerequisites.filter(p => p.status).length;

  const completedHeads = fsHeadsSummary.filter(h => h.status?.toUpperCase() === "APPROVED").length;
  const totalHeads = fsHeadsSummary.length;
  const allHeadsApproved = totalHeads > 0 && completedHeads === totalHeads;
  const overallCompletion = totalHeads > 0
    ? Math.round(fsHeadsSummary.reduce((acc, h) => acc + (h.completionPercent || 0), 0) / totalHeads)
    : 0;

  const inProgressHeads = fsHeadsSummary.filter(h => {
    const s = h.status?.toUpperCase() || "";
    return s !== "APPROVED" && (h.completionPercent > 0 || s === "PREPARED" || s === "REVIEWED" || s === "IN_REVIEW");
  }).length;
  const notStartedHeads = totalHeads - completedHeads - inProgressHeads;

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");

  const filteredHeads = useMemo(() => {
    let heads = fsHeadsSummary;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      heads = heads.filter(h => h.name.toLowerCase().includes(q) || h.fsHeadKey.toLowerCase().includes(q));
    }
    if (statusFilter !== "all") {
      if (statusFilter === "approved") heads = heads.filter(h => h.status?.toUpperCase() === "APPROVED");
      else if (statusFilter === "in-progress") heads = heads.filter(h => { const s = h.status?.toUpperCase() || ""; return s !== "APPROVED" && (h.completionPercent > 0 || s === "PREPARED" || s === "REVIEWED" || s === "IN_REVIEW" || s === "IN_PROGRESS" || s === "DRAFT"); });
      else if (statusFilter === "not-started") heads = heads.filter(h => { const s = h.status?.toUpperCase() || ""; return (!s || s === "NOT_STARTED") && (h.completionPercent || 0) === 0; });
    }
    if (riskFilter !== "all") {
      heads = heads.filter(h => h.riskLevel?.toLowerCase() === riskFilter);
    }
    return heads;
  }, [fsHeadsSummary, searchQuery, statusFilter, riskFilter]);

  const buildExecutionPayload = useCallback(() => ({
    phaseStatus: allHeadsApproved ? "completed" : "in-progress",
    isLocked: allHeadsApproved,
  }), [allHeadsApproved]);

  const saveEngine = useExecutionSaveBridge(engagementId, buildExecutionPayload);

  const canProceedToFinalization = complianceSummary?.canProceedToFinalization ?? (allHeadsApproved && allPlanningPrerequisitesMet);


  return (
    <PageShell
      showTopBar={false}
      title="Execution Phase"
      subtitle={`${client?.name || ""} ${engagement?.engagementCode ? `(${engagement.engagementCode})` : ""}`}
      icon={<ClipboardList className="h-5 w-5 text-primary" />}
      backHref={`/workspace/${engagementId}/planning`}
      nextHref={`/workspace/${engagementId}/finalization`}
      dashboardHref="/engagements"
      canNavigateNext={canProceedToFinalization}
      saveFn={async () => {
        try {
          await saveEngine.saveFinal();
          return { ok: true };
        } catch (error) {
          return { ok: false, errors: error };
        }
      }}
      hasUnsavedChanges={saveEngine.isDirty}
      isSaving={saveEngine.isSaving}
      showBack={true}
      showSaveProgress={true}
      showSaveNext={true}
      showSaveClose={true}
      signoffPhase="EXECUTION"
      signoffSection="EXECUTION"
      readOnly={executionReadOnly}
      disabledReasons={!canProceedToFinalization ? {
        saveNext: { reason: "All FS Heads must be approved before proceeding to Finalization" }
      } : undefined}
    >
      <div className="w-full px-4 py-2 space-y-4">

        <Card data-testid="card-execution-progress-summary">
          <CardContent className="py-4">
            <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
              <div className="flex items-center gap-3">
                <Layers className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="font-semibold text-base" data-testid="text-execution-title">Execution Progress</h3>
                  <p className="text-xs text-muted-foreground">ISA 330, ISA 500, ISA 520 — Audit execution by FS Head</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-2xl font-bold" data-testid="text-overall-completion">{overallCompletion}%</p>
                  <p className="text-xs text-muted-foreground">Overall Completion</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold" data-testid="text-heads-completed">{completedHeads}/{totalHeads}</p>
                  <p className="text-xs text-muted-foreground">FS Heads Approved</p>
                </div>
              </div>
            </div>
            <Progress value={overallCompletion} className="h-2" data-testid="progress-overall" />
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
                {completedHeads} Approved
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />
                {inProgressHeads} In Progress
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
                {notStartedHeads} Not Started
              </span>
            </div>
          </CardContent>
        </Card>

        <div data-testid="card-fs-heads-grid">
          <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              <div>
                <h3 className="font-semibold text-base">FS Head Working Papers</h3>
                <p className="text-xs text-muted-foreground">
                  Click a card to open the per-head execution wizard
                </p>
              </div>
            </div>
            <Button
              onClick={() => setLocation(`/workspace/${engagementId}/fs-heads`)}
              className="gap-2"
              data-testid="btn-open-all-fs-heads"
            >
              <FolderOpen className="h-4 w-4" />
              Open All FS Heads
            </Button>
          </div>

          {totalHeads > 0 && (
            <div className="flex items-center gap-3 mb-3 flex-wrap" data-testid="fs-heads-filters">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search FS heads..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-sm"
                  data-testid="input-search-fs-heads"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="select-status-filter">
                  <Filter className="h-3 w-3 mr-1" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="not-started">Not Started</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                </SelectContent>
              </Select>
              <Select value={riskFilter} onValueChange={setRiskFilter}>
                <SelectTrigger className="w-[130px] h-8 text-xs" data-testid="select-risk-filter">
                  <SelectValue placeholder="Risk" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Risks</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
              {(searchQuery || statusFilter !== "all" || riskFilter !== "all") && (
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setSearchQuery(""); setStatusFilter("all"); setRiskFilter("all"); }} data-testid="btn-clear-filters">
                  Clear
                </Button>
              )}
            </div>
          )}

          {fsHeadsLoading ? (
            <div className="flex items-center justify-center py-12" data-testid="loading-fs-heads">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : fsHeadsSummary.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <div className="text-center text-muted-foreground" data-testid="empty-fs-heads">
                  <Layers className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p className="font-medium">No FS Heads available yet.</p>
                  <p className="text-sm mt-1">Generate FS Heads from the FS Heads page after completing planning prerequisites.</p>
                  <Button
                    variant="outline"
                    className="mt-4 gap-2"
                    onClick={() => setLocation(`/workspace/${engagementId}/fs-heads`)}
                    data-testid="btn-go-generate-fs-heads"
                  >
                    <ArrowRight className="h-4 w-4" />
                    Go to FS Heads Page
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="fs-heads-card-grid">
              {filteredHeads.length === 0 && (searchQuery || statusFilter !== "all" || riskFilter !== "all") ? (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No FS heads match your filters</p>
                  <Button size="sm" variant="ghost" className="mt-2" onClick={() => { setSearchQuery(""); setStatusFilter("all"); setRiskFilter("all"); }}>Clear Filters</Button>
                </div>
              ) : null}
              {filteredHeads.map((head) => {
                const headComp = perHead.find(p => p.fsHeadKey === head.fsHeadKey);
                const trafficLight = headComp?.trafficLight || getHeadTrafficLight(head.status);
                const TRAFFIC_COLORS = {
                  green: "bg-emerald-500",
                  amber: "bg-amber-500",
                  red: "bg-red-500",
                };

                return (
                  <Card
                    key={head.fsHeadKey}
                    className="cursor-pointer hover-elevate transition-all"
                    onClick={() => setLocation(`/workspace/${engagementId}/fs-heads?head=${head.fsHeadKey}`)}
                    data-testid={`card-fs-head-${head.fsHeadKey}`}
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", TRAFFIC_COLORS[trafficLight])} data-testid={`dot-traffic-${head.fsHeadKey}`} />
                            </TooltipTrigger>
                            <TooltipContent className="text-xs">
                              {trafficLight === "green" ? "Complete" : trafficLight === "amber" ? "In Progress" : "Not Started"}
                            </TooltipContent>
                          </Tooltip>
                          <h4 className="text-sm font-semibold truncate" data-testid={`text-name-${head.fsHeadKey}`}>{head.name}</h4>
                        </div>
                        <Badge
                          variant={head.riskLevel === "high" ? "destructive" : head.riskLevel === "medium" ? "secondary" : "outline"}
                          className="text-[10px] flex-shrink-0"
                          data-testid={`badge-risk-${head.fsHeadKey}`}
                        >
                          {head.riskLevel || "N/A"}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Current</p>
                          <p className="text-xs font-bold" data-testid={`text-balance-${head.fsHeadKey}`}>
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact' }).format(head.currentYearBalance ?? head.balance ?? 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Prior</p>
                          <p className="text-xs font-bold" data-testid={`text-prior-balance-${head.fsHeadKey}`}>
                            {head.priorYearBalance !== undefined && head.priorYearBalance !== null
                              ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact' }).format(head.priorYearBalance)
                              : "—"}
                          </p>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-muted-foreground">{head.completionPercent || 0}% complete</span>
                          <span className="text-[10px] text-muted-foreground" data-testid={`text-procedures-${head.fsHeadKey}`}>
                            {headComp?.procedureCount ?? head.proceduresCount ?? 0} procedures
                          </span>
                        </div>
                        <Progress
                          value={head.completionPercent || 0}
                          className={cn("h-1.5",
                            trafficLight === "green" ? "[&>div]:bg-emerald-500" :
                            trafficLight === "red" ? "[&>div]:bg-red-400" :
                            "[&>div]:bg-amber-400"
                          )}
                          data-testid={`progress-${head.fsHeadKey}`}
                        />
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1 border-t">
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
                          {headComp && (
                            <>
                              {headComp.hasFraudRisk && (
                                <Badge variant="destructive" className="text-[8px] h-4 px-1">Fraud</Badge>
                              )}
                              {headComp.hasSignificantRisk && !headComp.hasFraudRisk && (
                                <Badge variant="secondary" className="text-[8px] h-4 px-1 bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200">Sig</Badge>
                              )}
                              <span className={cn("flex items-center gap-0.5", headComp.hasEvidence ? "text-emerald-600" : "")} data-testid={`status-evidence-${head.fsHeadKey}`}>
                                <FileText className="h-3 w-3" />
                                {headComp.evidenceCount > 0 ? `${headComp.evidenceCount} files` : "No evidence"}
                              </span>
                              <span className={cn("flex items-center gap-0.5", headComp.hasConclusion ? "text-emerald-600" : "")} data-testid={`status-conclusion-${head.fsHeadKey}`}>
                                <CheckCircle2 className="h-3 w-3" />
                                {headComp.hasConclusion ? "Concluded" : "No conclusion"}
                              </span>
                              {headComp.openReviewPoints > 0 && (
                                <span className="flex items-center gap-0.5 text-red-600">
                                  <AlertCircle className="h-3 w-3" />
                                  {headComp.openReviewPoints} open
                                </span>
                              )}
                            </>
                          )}
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
        <Card data-testid="card-isa-reference">
          <CardContent className="py-3">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="text-xs text-muted-foreground space-y-1">
                <p><span className="font-medium">ISA 330</span> — Auditor's responses to assessed risks</p>
                <p><span className="font-medium">ISA 500</span> — Audit evidence: sufficiency and appropriateness</p>
                <p><span className="font-medium">ISA 520</span> — Analytical procedures</p>
                <p><span className="font-medium">ISA 530</span> — Audit sampling</p>
                <p><span className="font-medium">ISA 230</span> — Audit documentation</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {engagementId && (
          <AICopilotToggle
            engagementId={engagementId}
            auditPhase="execution"
          />
        )}
      </div>
    </PageShell>
  );
}

function MetricCard({ label, value, sub, color }: {
  label: string;
  value: string | number;
  sub: string;
  color: "blue" | "green" | "amber" | "red";
}) {
  const colorMap = {
    blue: "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800",
    green: "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800",
    amber: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800",
    red: "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800",
  };
  const textColorMap = {
    blue: "text-blue-700 dark:text-blue-300",
    green: "text-green-700 dark:text-green-300",
    amber: "text-amber-700 dark:text-amber-300",
    red: "text-red-700 dark:text-red-300",
  };
  return (
    <div className={`p-3 rounded-lg border ${colorMap[color]}`}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
      <p className={`text-lg font-bold ${textColorMap[color]}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function ComplianceItem({ passed, label, sublabel, testId }: {
  passed: boolean;
  label: string;
  sublabel: string;
  testId: string;
}) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-md border ${
      passed
        ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
        : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
    }`} data-testid={testId}>
      {passed ? (
        <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
      ) : (
        <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
      )}
      <div className="min-w-0">
        <p className="text-xs font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{sublabel}</p>
      </div>
    </div>
  );
}
