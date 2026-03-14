import { useState, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useEngagement } from "@/lib/workspace-context";
import { AIAssistantPanel } from "@/components/ai-assistant-panel";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ClipboardList, Shield, Target, BarChart3, AlertTriangle,
  CheckCircle2, AlertCircle, XCircle, ChevronRight, Info,
  Layers, Brain, ListChecks, Database, FileText, Users,
  ArrowRight, Sparkles, Filter, TrendingUp
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { PageShell } from "@/components/page-shell";
import { usePhaseRoleGuard } from "@/hooks/use-phase-role-guard";
import { AICopilotToggle } from "@/components/ai-copilot-panel";
import { cn } from "@/lib/utils";
import { AuditProgramSection, type AccountHeadProgram } from "@/components/AuditProgramSection";

interface ProceduresStats {
  totalProcedures: number;
  linkedToRisks: number;
  withAssertions: number;
  withSampling: number;
  withPopulation: number;
  reviewed: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  totalRisks: number;
  highRiskCount: number;
  highRiskCovered: number;
  samplingFrameCount: number;
  overallMateriality: number | null;
  performanceMateriality: number | null;
  byCategory: Record<string, number>;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  assertionCoverage: Record<string, number>;
  fsAreaCoverage: Record<string, { procedures: number; risks: number; highRisks: number; covered: boolean }>;
}

interface RiskItem {
  id: string;
  fsArea: string;
  riskOfMaterialMisstatement: string;
  isSignificantRisk: boolean;
  isFraudRisk: boolean;
  assertion: string;
  assertionImpacts: string[];
  riskDescription?: string;
  description?: string;
}

interface ProcedureItem {
  id: string;
  title: string;
  category: string;
  procedureType: string;
  status: string;
  assertions: string[];
  linkedRiskIds: string[];
  linkedAccountIds: string[];
  sampleSize: number | null;
  samplingMethod: string | null;
  populationSize: number | null;
  reviewedById: string | null;
  performedById: string | null;
  workpaperRef: string | null;
}

const ASSERTIONS = [
  { key: "EXISTENCE", label: "Existence", description: "Assets, liabilities and equity exist at the reporting date", isa: "ISA 315" },
  { key: "COMPLETENESS", label: "Completeness", description: "All transactions and events that should have been recorded have been recorded", isa: "ISA 315" },
  { key: "ACCURACY", label: "Accuracy", description: "Amounts and other data are recorded appropriately", isa: "ISA 315" },
  { key: "VALUATION", label: "Valuation", description: "Assets, liabilities and equity are included at appropriate amounts", isa: "ISA 315" },
  { key: "RIGHTS_OBLIGATIONS", label: "Rights & Obligations", description: "The entity holds or controls the rights to assets", isa: "ISA 315" },
  { key: "PRESENTATION", label: "Presentation & Disclosure", description: "Financial information is appropriately presented and disclosed", isa: "ISA 315" },
  { key: "OCCURRENCE", label: "Occurrence", description: "Transactions and events that have been recorded have occurred", isa: "ISA 315" },
  { key: "CUTOFF", label: "Cut-off", description: "Transactions are recorded in the correct accounting period", isa: "ISA 315" },
  { key: "CLASSIFICATION", label: "Classification", description: "Transactions and events are recorded in the proper accounts", isa: "ISA 315" },
];

function getRiskBadgeColor(level: string) {
  const l = level?.toUpperCase() || "";
  if (l === "HIGH" || l === "SIGNIFICANT") return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
  if (l === "MODERATE" || l === "MEDIUM") return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
  return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
}

function getStatusBadge(status: string) {
  const s = status?.toUpperCase() || "";
  if (s === "COMPLETED") return { color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: CheckCircle2 };
  if (s === "IN_PROGRESS") return { color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", icon: ArrowRight };
  return { color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300", icon: AlertCircle };
}

function StatCard({ label, value, total, icon: Icon, color = "text-primary" }: { label: string; value: number; total?: number; icon: any; color?: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
      <div className={cn("p-2 rounded-md bg-muted", color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-lg font-bold leading-none">
          {value}{total !== undefined && <span className="text-sm text-muted-foreground font-normal">/{total}</span>}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

export default function ProceduresSampling() {
  const params = useParams<{ engagementId: string }>();
  const { engagementId: contextEngagementId, engagement, client } = useEngagement();
  const engagementId = params.engagementId || contextEngagementId || undefined;
  const { isReadOnly } = usePhaseRoleGuard("procedures-sampling", "EXECUTION");
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("overview");

  const { data: stats, isLoading: statsLoading } = useQuery<ProceduresStats>({
    queryKey: ["/api/planning", engagementId, "procedures-stats"],
    enabled: !!engagementId,
  });

  const { data: risksData } = useQuery<{ risks: Record<string, RiskItem[]>; totalRisks: number; fsAreas: string[] }>({
    queryKey: ["/api/planning", engagementId, "risks", "fs-level"],
    enabled: !!engagementId,
  });

  const { data: auditProgramData } = useQuery<{ programs?: AccountHeadProgram[] }>({
    queryKey: ["/api/audit-program", engagementId],
    enabled: !!engagementId,
  });

  const { data: planningStatusData } = useQuery<{
    tbUploaded: boolean;
    glUploaded: boolean;
    mappingApproved: boolean;
    materialityApproved: boolean;
    riskAssessmentApproved: boolean;
    auditProgramApproved: boolean;
  }>({
    queryKey: ["/api/engagements", engagementId, "planning-status"],
    enabled: !!engagementId,
  });

  const prerequisites = useMemo(() => {
    if (!planningStatusData) return [];
    return [
      { label: "Risk Assessment Approved", met: planningStatusData.riskAssessmentApproved, isa: "ISA 315" },
      { label: "Materiality Approved", met: planningStatusData.materialityApproved, isa: "ISA 320" },
      { label: "Mapping Approved", met: planningStatusData.mappingApproved, isa: "ISA 315" },
    ];
  }, [planningStatusData]);

  const allPrereqsMet = prerequisites.every(p => p.met);

  const coveragePercent = useMemo(() => {
    if (!stats || stats.totalProcedures === 0) return 0;
    const riskLinkScore = stats.linkedToRisks / stats.totalProcedures;
    const assertionScore = stats.withAssertions / stats.totalProcedures;
    const highRiskScore = stats.highRiskCount > 0 ? stats.highRiskCovered / stats.highRiskCount : 1;
    return Math.round(((riskLinkScore + assertionScore + highRiskScore) / 3) * 100);
  }, [stats]);

  const gateWarnings = useMemo(() => {
    if (!stats) return [];
    const warnings: { severity: "error" | "warning"; message: string; isa: string }[] = [];
    if (stats.totalProcedures === 0) {
      warnings.push({ severity: "error", message: "No procedures defined — design audit procedures before proceeding", isa: "ISA 330" });
    }
    if (stats.highRiskCount > 0 && stats.highRiskCovered < stats.highRiskCount) {
      warnings.push({ severity: "error", message: `${stats.highRiskCount - stats.highRiskCovered} high-risk area(s) without linked procedures`, isa: "ISA 330" });
    }
    if (stats.totalProcedures > 0 && stats.linkedToRisks === 0) {
      warnings.push({ severity: "error", message: "No procedures are linked to assessed risks", isa: "ISA 330" });
    }
    if (stats.withSampling > 0 && stats.withPopulation < stats.withSampling) {
      warnings.push({ severity: "error", message: `${stats.withSampling - stats.withPopulation} sampling procedure(s) lack defined populations`, isa: "ISA 530" });
    }
    if (stats.totalProcedures > 0 && stats.withAssertions < stats.totalProcedures * 0.8) {
      warnings.push({ severity: "warning", message: `Only ${stats.withAssertions}/${stats.totalProcedures} procedures have assertion coverage (80% target)`, isa: "ISA 315" });
    }
    if (stats.samplingFrameCount === 0 && stats.withSampling === 0) {
      warnings.push({ severity: "warning", message: "No sampling parameters defined yet", isa: "ISA 530" });
    }
    if (stats.totalProcedures > 0 && stats.reviewed < stats.totalProcedures * 0.5) {
      warnings.push({ severity: "warning", message: `Only ${stats.reviewed}/${stats.totalProcedures} procedures have reviewer assignment`, isa: "ISA 220" });
    }
    return warnings;
  }, [stats]);

  const fsAreasList = useMemo(() => {
    if (!stats?.fsAreaCoverage) return [];
    return Object.entries(stats.fsAreaCoverage)
      .map(([area, data]) => ({ area, ...data }))
      .sort((a, b) => b.highRisks - a.highRisks || b.risks - a.risks);
  }, [stats]);

  if (!engagementId) {
    return (
      <PageShell title="Procedures & Sampling" subtitle="ISA 330 / ISA 530">
        <Alert><AlertDescription>No engagement selected.</AlertDescription></Alert>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Procedures & Sampling"
      subtitle={`${client?.name || ""} — ${engagement?.name || ""}`}
      signoffPhase="EXECUTION"
      signoffSection="procedures-sampling"
      readOnly={isReadOnly}
    >
      <AIAssistantPanel engagementId={engagementId || ""} phaseKey="procedures-sampling" className="mb-2.5" />
      <div className="space-y-3">
        {!allPrereqsMet && prerequisites.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <p className="font-medium mb-2">Prerequisites not met — complete these before designing procedures:</p>
              <div className="flex flex-wrap gap-2">
                {prerequisites.filter(p => !p.met).map((p, i) => (
                  <Badge key={i} variant="outline" className="text-destructive border-destructive">
                    <XCircle className="h-3 w-3 mr-1" /> {p.label} ({p.isa})
                  </Badge>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ClipboardList className="h-5 w-5" />
                  Procedures & Sampling — Phase Overview
                </CardTitle>
                <CardDescription>
                  Design audit procedures responsive to assessed risks (ISA 330) and determine sampling parameters (ISA 530)
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <AICopilotToggle engagementId={engagementId} phaseKey="procedures-sampling" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 px-2 py-1 rounded bg-muted text-xs">
                      <Shield className="h-3 w-3" />
                      Coverage: {coveragePercent}%
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Composite of risk linkage, assertion coverage, and high-risk area coverage</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="flex items-center justify-center py-2 text-muted-foreground">Loading statistics...</div>
            ) : stats ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-2.5">
                  <StatCard label="Total Procedures" value={stats.totalProcedures} icon={ClipboardList} color="text-blue-600" />
                  <StatCard label="Linked to Risks" value={stats.linkedToRisks} total={stats.totalProcedures} icon={Target} color="text-orange-600" />
                  <StatCard label="With Assertions" value={stats.withAssertions} total={stats.totalProcedures} icon={Shield} color="text-purple-600" />
                  <StatCard label="High-Risk Covered" value={stats.highRiskCovered} total={stats.highRiskCount} icon={AlertTriangle} color="text-red-600" />
                  <StatCard label="Sampling Defined" value={stats.withSampling} icon={Database} color="text-teal-600" />
                  <StatCard label="Reviewed" value={stats.reviewed} total={stats.totalProcedures} icon={Users} color="text-green-600" />
                </div>

                <Progress value={coveragePercent} className="h-2 mb-3" />

                {gateWarnings.length > 0 && (
                  <div className="space-y-2 mt-3">
                    {gateWarnings.map((w, i) => (
                      <Alert key={i} variant={w.severity === "error" ? "destructive" : "default"} className="py-2">
                        {w.severity === "error" ? <XCircle className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                        <AlertDescription className="text-sm">
                          {w.message}
                          <Badge variant="outline" className="ml-2 text-xs">{w.isa}</Badge>
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                )}
              </>
            ) : null}

            <div className="flex flex-wrap gap-2 mt-2.5 pt-3 border-t">
              <p className="text-xs font-medium text-muted-foreground w-full mb-1">AI CAPABILITIES</p>
              <Badge variant="outline" className="text-xs"><Brain className="h-3 w-3 mr-1" /> Procedure Suggestions</Badge>
              <Badge variant="outline" className="text-xs"><Sparkles className="h-3 w-3 mr-1" /> Sampling Rationale</Badge>
              <Badge variant="outline" className="text-xs"><AlertTriangle className="h-3 w-3 mr-1" /> Coverage Gap Alerts</Badge>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="text-xs sm:text-sm">
              <Layers className="h-3.5 w-3.5 mr-1" /> Risk-Procedure Matrix
            </TabsTrigger>
            <TabsTrigger value="audit-program" className="text-xs sm:text-sm">
              <ClipboardList className="h-3.5 w-3.5 mr-1" /> Audit Program
            </TabsTrigger>
            <TabsTrigger value="sampling" className="text-xs sm:text-sm">
              <Database className="h-3.5 w-3.5 mr-1" /> Sampling
            </TabsTrigger>
            <TabsTrigger value="assertions" className="text-xs sm:text-sm">
              <ListChecks className="h-3.5 w-3.5 mr-1" /> Assertions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-2.5 mt-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Target className="h-4 w-4" /> FS Area Coverage — Risk to Procedure Linkage
                </CardTitle>
                <CardDescription>Shows how audit procedures map to identified risks across financial statement areas</CardDescription>
              </CardHeader>
              <CardContent>
                {fsAreasList.length === 0 ? (
                  <div className="text-center py-3 text-muted-foreground">
                    <Info className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p>No risks assessed yet. Complete the Risk Assessment phase first.</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => setLocation(`/workspace/${engagementId}/risk-assessment`)}
                    >
                      <ArrowRight className="h-3.5 w-3.5 mr-1" /> Go to Risk Assessment
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {fsAreasList.map((item) => {
                      const pct = item.risks > 0 && item.procedures > 0 ? Math.min(100, Math.round((item.procedures / item.risks) * 50)) : 0;
                      return (
                        <div key={item.area} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm truncate">{item.area.replace(/_/g, " ")}</span>
                              {item.highRisks > 0 && (
                                <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-[10px]">
                                  {item.highRisks} HIGH
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              <span>{item.risks} risk(s)</span>
                              <span>{item.procedures} procedure(s) linked</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 w-32">
                            <Progress value={pct} className="h-1.5 flex-1" />
                            <span className="text-xs font-mono w-8 text-right">{pct}%</span>
                          </div>
                          {item.covered ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" /> Procedures by Type
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {Object.keys(stats.byType).length === 0 ? (
                      <p className="text-sm text-muted-foreground py-3">No procedures defined yet</p>
                    ) : (
                      <div className="space-y-2">
                        {Object.entries(stats.byType).map(([type, count]) => (
                          <div key={type} className="flex items-center justify-between text-sm">
                            <span className="capitalize">{type.replace(/_/g, " ").toLowerCase()}</span>
                            <Badge variant="secondary">{count}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" /> Procedures by Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {Object.keys(stats.byStatus).length === 0 ? (
                      <p className="text-sm text-muted-foreground py-3">No procedures defined yet</p>
                    ) : (
                      <div className="space-y-2">
                        {Object.entries(stats.byStatus).map(([status, count]) => {
                          const { color, icon: StatusIcon } = getStatusBadge(status);
                          return (
                            <div key={status} className="flex items-center justify-between text-sm">
                              <span className="flex items-center gap-1.5">
                                <StatusIcon className="h-3.5 w-3.5" />
                                {status.replace(/_/g, " ")}
                              </span>
                              <Badge className={color}>{count}</Badge>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {stats?.overallMateriality && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Info className="h-4 w-4" /> Materiality Context
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Overall Materiality</p>
                      <p className="font-semibold">{stats.overallMateriality.toLocaleString()}</p>
                    </div>
                    {stats.performanceMateriality && (
                      <div>
                        <p className="text-muted-foreground text-xs">Performance Materiality</p>
                        <p className="font-semibold">{stats.performanceMateriality.toLocaleString()}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-muted-foreground text-xs">Sampling Frames</p>
                      <p className="font-semibold">{stats.samplingFrameCount}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="audit-program" className="space-y-2.5 mt-3">
            <AuditProgramTab engagementId={engagementId} readOnly={isReadOnly} />
          </TabsContent>

          <TabsContent value="sampling" className="space-y-2.5 mt-3">
            <SamplingTab engagementId={engagementId} stats={stats} />
          </TabsContent>

          <TabsContent value="assertions" className="space-y-2.5 mt-3">
            <AssertionCoverageTab stats={stats} engagementId={engagementId} />
          </TabsContent>
        </Tabs>

        <Card className="border-dashed">
          <CardContent className="py-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">DOWNSTREAM LINKAGE</p>
                <div className="flex flex-wrap gap-2">
                  <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" variant="secondary">
                    <ChevronRight className="h-3 w-3 mr-1" /> Execution Testing — Procedure execution & evidence
                  </Badge>
                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" variant="secondary">
                    <ChevronRight className="h-3 w-3 mr-1" /> Evidence Vault — Supporting documentation
                  </Badge>
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" variant="secondary">
                    <ChevronRight className="h-3 w-3 mr-1" /> Conclusions — Per-head audit conclusions
                  </Badge>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation(`/workspace/${engagementId}/execution-testing`)}
              >
                Proceed to Execution <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}

function AuditProgramTab({ engagementId, readOnly }: { engagementId: string; readOnly: boolean }) {
  const [programs, setPrograms] = useState<AccountHeadProgram[]>([]);

  const { data: savedData } = useQuery<{ programs?: AccountHeadProgram[] }>({
    queryKey: ["/api/audit-program", engagementId],
    enabled: !!engagementId,
  });

  const displayPrograms = savedData?.programs || programs;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardList className="h-4 w-4" /> Audit Program Designer
              </CardTitle>
              <CardDescription>
                Design procedures per FS head with procedure library, risk linkage, and ISA 330 compliance
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <AuditProgramSection
            programs={displayPrograms.length > 0 ? displayPrograms : programs}
            onProgramsChange={setPrograms}
            engagementId={engagementId}
          />
        </CardContent>
      </Card>
    </>
  );
}

function SamplingTab({ engagementId, stats }: { engagementId: string; stats?: ProceduresStats | null }) {
  const { data: samplingRuns } = useQuery<any[]>({
    queryKey: ["/api/sampling", engagementId, "runs"],
    enabled: !!engagementId,
  });

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4" /> Sampling Parameters — ISA 530
          </CardTitle>
          <CardDescription>Define populations, sampling methods, sample sizes, and selection logic</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2.5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg border">
                <p className="text-xs text-muted-foreground">Procedures with Sampling</p>
                <p className="text-xl font-bold">{stats?.withSampling ?? 0}</p>
              </div>
              <div className="p-3 rounded-lg border">
                <p className="text-xs text-muted-foreground">With Population Defined</p>
                <p className="text-xl font-bold">{stats?.withPopulation ?? 0}</p>
              </div>
              <div className="p-3 rounded-lg border">
                <p className="text-xs text-muted-foreground">Sampling Frames</p>
                <p className="text-xl font-bold">{stats?.samplingFrameCount ?? 0}</p>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="text-sm font-medium mb-3">Sampling Methodology Reference</h4>
              <Accordion type="multiple" className="w-full">
                <AccordionItem value="statistical">
                  <AccordionTrigger className="text-sm">Statistical Sampling (ISA 530.5)</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p><strong>Random Selection:</strong> Each item in the population has a known probability of selection. Suitable for homogeneous populations.</p>
                      <p><strong>Systematic Selection:</strong> Select every nth item after a random starting point. Effective for sequential populations.</p>
                      <p><strong>Monetary Unit Sampling (MUS):</strong> Each monetary unit has equal selection probability. Biases towards higher-value items — ideal for overstatement testing.</p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="non-statistical">
                  <AccordionTrigger className="text-sm">Non-Statistical Sampling (ISA 530.A11)</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p><strong>Haphazard Selection:</strong> Auditor selects without structured technique, avoiding bias. Not random.</p>
                      <p><strong>Block Selection:</strong> Select contiguous items. Results may not be representative of full population.</p>
                      <p><strong>Judgmental Selection:</strong> Auditor uses professional judgment to select items with higher risk.</p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="sample-size">
                  <AccordionTrigger className="text-sm">Sample Size Determination (ISA 530.A10)</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p>Factors affecting sample size:</p>
                      <ul className="list-disc pl-4 space-y-1">
                        <li>Acceptable level of sampling risk (confidence level)</li>
                        <li>Tolerable rate of deviation (for controls testing)</li>
                        <li>Expected error rate in the population</li>
                        <li>Population size and stratification</li>
                        <li>Performance materiality and tolerable misstatement</li>
                      </ul>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            {samplingRuns && samplingRuns.length > 0 && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-medium mb-3">Sampling Runs</h4>
                  <div className="space-y-2">
                    {samplingRuns.map((run: any, idx: number) => (
                      <div key={run.id || idx} className="p-3 rounded-lg border flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{run.name || `Run ${idx + 1}`}</p>
                          <p className="text-xs text-muted-foreground">
                            Method: {run.method || "Not set"} · Population: {run.populationSize?.toLocaleString() || "N/A"} · 
                            Sample Size: {run.sampleSize || 0}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {run.status || "Pending"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function AssertionCoverageTab({ stats, engagementId }: { stats?: ProceduresStats | null; engagementId: string }) {
  const coverageMap = stats?.assertionCoverage || {};

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ListChecks className="h-4 w-4" /> Assertion Coverage Matrix
        </CardTitle>
        <CardDescription>
          ISA 315 requires procedures to address relevant assertions for each significant account. Review coverage below.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {ASSERTIONS.map((assertion) => {
            const count = coverageMap[assertion.key] || coverageMap[assertion.label] || 0;
            const hasCoverage = count > 0;
            return (
              <div key={assertion.key} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                {hasCoverage ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{assertion.label}</span>
                    <Badge variant="outline" className="text-[10px]">{assertion.isa}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{assertion.description}</p>
                </div>
                <Badge variant={hasCoverage ? "secondary" : "outline"} className={cn("text-xs", !hasCoverage && "text-red-500")}>
                  {count} procedure{count !== 1 ? "s" : ""}
                </Badge>
              </div>
            );
          })}
        </div>

        {Object.keys(coverageMap).length === 0 && (
          <Alert className="mt-2.5">
            <Info className="h-4 w-4" />
            <AlertDescription>
              No assertion coverage data yet. Design audit procedures in the Audit Program tab and link them to assertions.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
