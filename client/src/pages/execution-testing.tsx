import { useState, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useEngagement } from "@/lib/workspace-context";
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
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ClipboardList, Shield, Target, BarChart3, AlertTriangle,
  CheckCircle2, AlertCircle, XCircle, ChevronRight, Info,
  Layers, Brain, FileText, Users, ArrowRight, Sparkles,
  Filter, Search, PlayCircle, PauseCircle, Clock, Eye,
  FileCheck, MessageSquare, Database, Briefcase, TrendingUp
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { PageShell } from "@/components/page-shell";
import { useModuleReadOnly } from "@/components/sign-off-bar";
import { AICopilotToggle } from "@/components/ai-copilot-panel";
import { cn } from "@/lib/utils";

interface ProcedureDetail {
  id: string;
  title: string;
  category: string;
  procedureType: string;
  status: string;
  assertions: string[];
  linkedRiskIds: string[];
  workpaperRef: string | null;
  conclusion: string | null;
  conclusionType: string | null;
  exceptionsFound: number;
  sampleSize: number | null;
  performedById: string | null;
  performedAt: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
}

interface ExecutionStats {
  totalProcedures: number;
  notStarted: number;
  inProgress: number;
  completed: number;
  withWorkpaper: number;
  withConclusion: number;
  withExceptions: number;
  reviewed: number;
  performed: number;
  executionPercent: number;
  controlTests: number;
  substantiveTests: number;
  sampleItems: number;
  totalMisstatements: number;
  unresolvedMisstatements: number;
  totalMisstatementAmount: number;
  totalReviewNotes: number;
  openReviewNotes: number;
  resolvedReviewNotes: number;
  evidenceFiles: number;
  workpaperCount: number;
  byCategory: Record<string, { total: number; completed: number; inProgress: number; notStarted: number }>;
  byType: Record<string, { total: number; completed: number }>;
  fsAreaExecution: Record<string, { procedures: number; completed: number; risks: number; exceptions: number; hasConclusion: boolean }>;
  procedures: ProcedureDetail[];
}

function getStatusConfig(status: string) {
  const s = status?.toUpperCase() || "";
  if (s === "COMPLETED") return { label: "Completed", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: CheckCircle2, dotColor: "bg-green-500" };
  if (s === "IN_PROGRESS") return { label: "In Progress", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", icon: PlayCircle, dotColor: "bg-blue-500" };
  return { label: "Not Started", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300", icon: Clock, dotColor: "bg-gray-400" };
}

function getCategoryLabel(cat: string) {
  const map: Record<string, string> = {
    CONTROL: "Control Testing",
    SUBSTANTIVE: "Substantive Testing",
    ANALYTICAL: "Analytical Procedures",
    GENERAL: "General",
    WALKTHROUGH: "Walkthrough",
    INQUIRY: "Inquiry",
    OBSERVATION: "Observation",
    INSPECTION: "Inspection",
    RECALCULATION: "Recalculation",
    REPERFORMANCE: "Reperformance",
    CONFIRMATION: "Confirmation",
  };
  return map[cat] || cat.replace(/_/g, " ");
}

function StatCard({ label, value, total, icon: Icon, color = "text-primary", alert }: { label: string; value: number; total?: number; icon: any; color?: string; alert?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3 p-3 rounded-lg border bg-card", alert && "border-red-300 dark:border-red-800")}>
      <div className={cn("p-2 rounded-md bg-muted", color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-2xl font-bold leading-none">
          {value}{total !== undefined && <span className="text-sm text-muted-foreground font-normal">/{total}</span>}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

export default function ExecutionTesting() {
  const params = useParams<{ engagementId: string }>();
  const { engagementId: contextEngagementId, engagement, client } = useEngagement();
  const engagementId = params.engagementId || contextEngagementId || undefined;
  const { isReadOnly } = useModuleReadOnly("EXECUTION", "EXECUTION");
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [procSearchQuery, setProcSearchQuery] = useState("");
  const [procStatusFilter, setProcStatusFilter] = useState("all");
  const [procCategoryFilter, setProcCategoryFilter] = useState("all");

  const { data: stats, isLoading: statsLoading } = useQuery<ExecutionStats>({
    queryKey: ["/api/planning", engagementId, "execution-stats"],
    enabled: !!engagementId,
  });

  const { data: risksData } = useQuery<{ risks: Record<string, any[]>; totalRisks: number; fsAreas: string[] }>({
    queryKey: ["/api/planning", engagementId, "risks", "fs-level"],
    enabled: !!engagementId,
  });

  const gateWarnings = useMemo(() => {
    if (!stats) return [];
    const warnings: { severity: "error" | "warning"; message: string; isa: string }[] = [];
    if (stats.totalProcedures === 0) {
      warnings.push({ severity: "error", message: "No procedures assigned — go to Procedures & Sampling to design procedures first", isa: "ISA 330" });
    }
    if (stats.notStarted > 0 && stats.totalProcedures > 0) {
      warnings.push({ severity: "error", message: `${stats.notStarted} procedure(s) still NOT_STARTED — all must be executed`, isa: "ISA 330" });
    }
    if (stats.unresolvedMisstatements > 0) {
      warnings.push({ severity: "error", message: `${stats.unresolvedMisstatements} unresolved misstatement(s) — must be resolved or reported`, isa: "ISA 450" });
    }
    if (stats.totalProcedures > 0 && stats.withWorkpaper < stats.totalProcedures * 0.8) {
      warnings.push({ severity: "error", message: `${stats.withWorkpaper}/${stats.totalProcedures} procedures have workpapers (80% required)`, isa: "ISA 230" });
    }
    if (stats.completed > 0 && stats.withConclusion < stats.completed) {
      warnings.push({ severity: "error", message: `${stats.completed - stats.withConclusion} completed procedure(s) lack conclusions`, isa: "ISA 230" });
    }
    if (stats.openReviewNotes > 0) {
      const pct = stats.totalReviewNotes > 0 ? Math.round((stats.resolvedReviewNotes / stats.totalReviewNotes) * 100) : 0;
      warnings.push({ severity: pct < 75 ? "warning" : "warning", message: `${stats.openReviewNotes} open review note(s) — ${pct}% resolved`, isa: "ISA 220" });
    }
    if (stats.evidenceFiles === 0 && stats.totalProcedures > 0) {
      warnings.push({ severity: "warning", message: "No evidence files attached to execution procedures", isa: "ISA 500" });
    }
    return warnings;
  }, [stats]);

  const filteredProcedures = useMemo(() => {
    if (!stats?.procedures) return [];
    let procs = stats.procedures;
    if (procSearchQuery.trim()) {
      const q = procSearchQuery.toLowerCase();
      procs = procs.filter(p => p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
    }
    if (procStatusFilter !== "all") {
      procs = procs.filter(p => p.status === procStatusFilter);
    }
    if (procCategoryFilter !== "all") {
      procs = procs.filter(p => p.category === procCategoryFilter);
    }
    return procs;
  }, [stats?.procedures, procSearchQuery, procStatusFilter, procCategoryFilter]);

  const fsAreasList = useMemo(() => {
    if (!stats?.fsAreaExecution) return [];
    return Object.entries(stats.fsAreaExecution)
      .map(([area, data]) => ({ area, ...data }))
      .sort((a, b) => b.risks - a.risks || b.procedures - a.procedures);
  }, [stats]);

  const categories = useMemo(() => {
    if (!stats?.byCategory) return [];
    return Object.keys(stats.byCategory);
  }, [stats]);

  if (!engagementId) {
    return (
      <PageShell title="Execution Testing" subtitle="ISA 230 / ISA 330 / ISA 500">
        <Alert><AlertDescription>No engagement selected.</AlertDescription></Alert>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Execution Testing"
      subtitle={`${client?.name || ""} — ${engagement?.name || ""}`}
    >
      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Briefcase className="h-5 w-5" />
                  Execution Testing — Phase Overview
                </CardTitle>
                <CardDescription>
                  Execute audit procedures, document workpapers and test results, record exceptions, and draft conclusions (ISA 230/330/500)
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <AICopilotToggle engagementId={engagementId} phaseKey="execution-testing" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 px-2 py-1 rounded bg-muted text-xs">
                      <TrendingUp className="h-3 w-3" />
                      Execution: {stats?.executionPercent ?? 0}%
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Weighted completion: completed procedures = 100%, in-progress = 50%</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">Loading execution statistics...</div>
            ) : stats ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
                  <StatCard label="Total Procedures" value={stats.totalProcedures} icon={ClipboardList} color="text-blue-600" />
                  <StatCard label="Completed" value={stats.completed} total={stats.totalProcedures} icon={CheckCircle2} color="text-green-600" />
                  <StatCard label="In Progress" value={stats.inProgress} icon={PlayCircle} color="text-amber-600" />
                  <StatCard label="Not Started" value={stats.notStarted} icon={Clock} color="text-red-600" alert={stats.notStarted > 0} />
                  <StatCard label="With Workpapers" value={stats.withWorkpaper} total={stats.totalProcedures} icon={FileText} color="text-purple-600" />
                  <StatCard label="Exceptions Found" value={stats.withExceptions} icon={AlertTriangle} color="text-orange-600" alert={stats.unresolvedMisstatements > 0} />
                </div>

                <Progress value={stats.executionPercent} className="h-2 mb-3" />

                <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap mb-3">
                  <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full bg-green-500" />{stats.completed} Completed</span>
                  <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full bg-blue-500" />{stats.inProgress} In Progress</span>
                  <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full bg-gray-400" />{stats.notStarted} Not Started</span>
                  <Separator orientation="vertical" className="h-3" />
                  <span>{stats.controlTests} control test(s)</span>
                  <span>{stats.substantiveTests} substantive test(s)</span>
                  <span>{stats.sampleItems} sample item(s)</span>
                  <span>{stats.evidenceFiles} evidence file(s)</span>
                </div>

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

            <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t">
              <p className="text-xs font-medium text-muted-foreground w-full mb-1">AI CAPABILITIES</p>
              <Badge variant="outline" className="text-xs"><Brain className="h-3 w-3 mr-1" /> Workpaper Narration</Badge>
              <Badge variant="outline" className="text-xs"><Sparkles className="h-3 w-3 mr-1" /> Test Result Summary</Badge>
              <Badge variant="outline" className="text-xs"><AlertTriangle className="h-3 w-3 mr-1" /> Exception Wording</Badge>
              <Badge variant="outline" className="text-xs"><FileCheck className="h-3 w-3 mr-1" /> Conclusion Draft</Badge>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="dashboard" className="text-xs sm:text-sm">
              <Layers className="h-3.5 w-3.5 mr-1" /> Dashboard
            </TabsTrigger>
            <TabsTrigger value="procedures" className="text-xs sm:text-sm">
              <ClipboardList className="h-3.5 w-3.5 mr-1" /> Procedures
            </TabsTrigger>
            <TabsTrigger value="testing" className="text-xs sm:text-sm">
              <Shield className="h-3.5 w-3.5 mr-1" /> Testing
            </TabsTrigger>
            <TabsTrigger value="workpapers" className="text-xs sm:text-sm">
              <FileText className="h-3.5 w-3.5 mr-1" /> Workpapers
            </TabsTrigger>
            <TabsTrigger value="review" className="text-xs sm:text-sm">
              <MessageSquare className="h-3.5 w-3.5 mr-1" /> Review
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4 mt-3">
            <ExecutionDashboard stats={stats} fsAreasList={fsAreasList} engagementId={engagementId} />
          </TabsContent>

          <TabsContent value="procedures" className="space-y-4 mt-3">
            <ProcedureExecutionTab
              procedures={filteredProcedures}
              allProcedures={stats?.procedures || []}
              searchQuery={procSearchQuery}
              onSearchChange={setProcSearchQuery}
              statusFilter={procStatusFilter}
              onStatusFilterChange={setProcStatusFilter}
              categoryFilter={procCategoryFilter}
              onCategoryFilterChange={setProcCategoryFilter}
              categories={categories}
              risksData={risksData}
              engagementId={engagementId}
            />
          </TabsContent>

          <TabsContent value="testing" className="space-y-4 mt-3">
            <TestingTab stats={stats} engagementId={engagementId} />
          </TabsContent>

          <TabsContent value="workpapers" className="space-y-4 mt-3">
            <WorkpapersTab stats={stats} engagementId={engagementId} />
          </TabsContent>

          <TabsContent value="review" className="space-y-4 mt-3">
            <ReviewerPanel stats={stats} engagementId={engagementId} />
          </TabsContent>
        </Tabs>

        <Card className="border-dashed">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">DOWNSTREAM LINKAGE</p>
                <div className="flex flex-wrap gap-2">
                  <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" variant="secondary">
                    <ChevronRight className="h-3 w-3 mr-1" /> Evidence Linking — Supporting documentation
                  </Badge>
                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" variant="secondary">
                    <ChevronRight className="h-3 w-3 mr-1" /> Observations — Findings & management letter
                  </Badge>
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" variant="secondary">
                    <ChevronRight className="h-3 w-3 mr-1" /> Adjustments — Misstatement aggregation
                  </Badge>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation(`/workspace/${engagementId}/evidence-linking`)}
              >
                Proceed to Evidence <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}

function ExecutionDashboard({ stats, fsAreasList, engagementId }: {
  stats?: ExecutionStats | null;
  fsAreasList: { area: string; procedures: number; completed: number; risks: number; exceptions: number; hasConclusion: boolean }[];
  engagementId: string;
}) {
  const [, setLocation] = useLocation();

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4" /> FS Area Execution Progress
          </CardTitle>
          <CardDescription>Execution status by financial statement area — linked to risks, procedures, and conclusions</CardDescription>
        </CardHeader>
        <CardContent>
          {fsAreasList.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Info className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p>No procedures linked to FS areas yet.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setLocation(`/workspace/${engagementId}/procedures-sampling`)}>
                <ArrowRight className="h-3.5 w-3.5 mr-1" /> Go to Procedures & Sampling
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {fsAreasList.map((item) => {
                const pct = item.procedures > 0 ? Math.round((item.completed / item.procedures) * 100) : 0;
                return (
                  <div key={item.area} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{item.area.replace(/_/g, " ")}</span>
                        {item.exceptions > 0 && (
                          <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-[10px]">
                            {item.exceptions} exception(s)
                          </Badge>
                        )}
                        {item.hasConclusion && (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-[10px]">
                            Concluded
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{item.risks} risk(s)</span>
                        <span>{item.completed}/{item.procedures} procedures completed</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 w-32">
                      <Progress value={pct} className="h-1.5 flex-1" />
                      <span className="text-xs font-mono w-8 text-right">{pct}%</span>
                    </div>
                    {pct === 100 ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    ) : pct > 0 ? (
                      <PlayCircle className="h-4 w-4 text-blue-500 shrink-0" />
                    ) : (
                      <Clock className="h-4 w-4 text-gray-400 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> By Category
              </CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(stats.byCategory).length === 0 ? (
                <p className="text-sm text-muted-foreground py-3">No procedures yet</p>
              ) : (
                <div className="space-y-2">
                  {Object.entries(stats.byCategory).map(([cat, data]) => (
                    <div key={cat} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>{getCategoryLabel(cat)}</span>
                        <span className="text-xs text-muted-foreground">{data.completed}/{data.total}</span>
                      </div>
                      <Progress value={data.total > 0 ? (data.completed / data.total) * 100 : 0} className="h-1" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Exceptions & Misstatements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span>Total Misstatements</span>
                  <Badge variant={stats.totalMisstatements > 0 ? "destructive" : "secondary"}>{stats.totalMisstatements}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Unresolved</span>
                  <Badge variant={stats.unresolvedMisstatements > 0 ? "destructive" : "secondary"}>{stats.unresolvedMisstatements}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Total Amount</span>
                  <span className="font-mono text-xs">{stats.totalMisstatementAmount.toLocaleString()}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between text-sm">
                  <span>Procedures with Exceptions</span>
                  <Badge variant="outline">{stats.withExceptions}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Review Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span>Procedures Reviewed</span>
                  <Badge variant="secondary">{stats.reviewed}/{stats.totalProcedures}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>With Conclusions</span>
                  <Badge variant="secondary">{stats.withConclusion}/{stats.totalProcedures}</Badge>
                </div>
                <Separator />
                <div className="flex items-center justify-between text-sm">
                  <span>Review Notes</span>
                  <Badge variant={stats.openReviewNotes > 0 ? "destructive" : "secondary"}>{stats.openReviewNotes} open / {stats.totalReviewNotes} total</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Resolved</span>
                  <Badge variant="secondary">{stats.resolvedReviewNotes}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

function ProcedureExecutionTab({ procedures, allProcedures, searchQuery, onSearchChange, statusFilter, onStatusFilterChange, categoryFilter, onCategoryFilterChange, categories, risksData, engagementId }: {
  procedures: ProcedureDetail[];
  allProcedures: ProcedureDetail[];
  searchQuery: string;
  onSearchChange: (v: string) => void;
  statusFilter: string;
  onStatusFilterChange: (v: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (v: string) => void;
  categories: string[];
  risksData?: { risks: Record<string, any[]>; totalRisks: number; fsAreas: string[] } | null;
  engagementId: string;
}) {
  const riskMap = useMemo(() => {
    const map: Record<string, any> = {};
    if (risksData?.risks) {
      for (const [area, riskList] of Object.entries(risksData.risks)) {
        for (const risk of riskList) {
          map[risk.id] = { ...risk, fsArea: area };
        }
      }
    }
    return map;
  }, [risksData]);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardList className="h-4 w-4" /> Procedure Execution Detail
              </CardTitle>
              <CardDescription>Execute assigned procedures — each linked to risk, FS head, and sample items</CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search procedures..."
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="pl-8 h-9 w-48 text-sm"
                />
              </div>
              <Select value={statusFilter} onValueChange={onStatusFilterChange}>
                <SelectTrigger className="h-9 w-36 text-sm">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="NOT_STARTED">Not Started</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={onCategoryFilterChange}>
                <SelectTrigger className="h-9 w-40 text-sm">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(c => <SelectItem key={c} value={c}>{getCategoryLabel(c)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {procedures.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Info className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p>{allProcedures.length === 0 ? "No procedures assigned yet. Design procedures in Procedures & Sampling." : "No procedures match the current filters."}</p>
            </div>
          ) : (
            <Accordion type="multiple" className="w-full">
              {procedures.map((proc) => {
                const statusConfig = getStatusConfig(proc.status);
                const linkedRisks = proc.linkedRiskIds.map(id => riskMap[id]).filter(Boolean);
                const fsAreas = [...new Set(linkedRisks.map((r: any) => r.fsArea).filter(Boolean))];
                return (
                  <AccordionItem key={proc.id} value={proc.id}>
                    <AccordionTrigger className="hover:no-underline py-3">
                      <div className="flex items-center gap-3 flex-1 text-left">
                        <statusConfig.icon className={cn("h-4 w-4 shrink-0", proc.status === "COMPLETED" ? "text-green-500" : proc.status === "IN_PROGRESS" ? "text-blue-500" : "text-gray-400")} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{proc.title}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <Badge variant="outline" className="text-[10px]">{getCategoryLabel(proc.category)}</Badge>
                            <Badge variant="outline" className="text-[10px]">{proc.procedureType.replace(/_/g, " ")}</Badge>
                            {fsAreas.map(area => (
                              <Badge key={area} variant="secondary" className="text-[10px] bg-blue-50 dark:bg-blue-950">{area.replace(/_/g, " ")}</Badge>
                            ))}
                            {proc.exceptionsFound > 0 && (
                              <Badge variant="destructive" className="text-[10px]">{proc.exceptionsFound} exception(s)</Badge>
                            )}
                          </div>
                        </div>
                        <Badge className={cn("text-xs shrink-0", statusConfig.color)}>{statusConfig.label}</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pl-7 pt-2">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground">Workpaper Ref</p>
                            <p className="font-medium">{proc.workpaperRef || <span className="text-muted-foreground italic">Not assigned</span>}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Sample Size</p>
                            <p className="font-medium">{proc.sampleSize ?? "N/A"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Performed</p>
                            <p className="font-medium">{proc.performedAt ? new Date(proc.performedAt).toLocaleDateString() : <span className="text-muted-foreground italic">Pending</span>}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Reviewed</p>
                            <p className="font-medium">{proc.reviewedAt ? new Date(proc.reviewedAt).toLocaleDateString() : <span className="text-muted-foreground italic">Pending</span>}</p>
                          </div>
                        </div>

                        {proc.assertions.length > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Assertions</p>
                            <div className="flex flex-wrap gap-1">
                              {proc.assertions.map(a => <Badge key={a} variant="outline" className="text-[10px]">{a}</Badge>)}
                            </div>
                          </div>
                        )}

                        {linkedRisks.length > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Linked Risks</p>
                            <div className="space-y-1">
                              {linkedRisks.map((risk: any) => (
                                <div key={risk.id} className="flex items-center gap-2 text-xs">
                                  <Badge variant="secondary" className={cn("text-[10px]",
                                    risk.riskOfMaterialMisstatement === "HIGH" || risk.riskOfMaterialMisstatement === "SIGNIFICANT" ? "bg-red-100 text-red-800" :
                                    risk.riskOfMaterialMisstatement === "MODERATE" ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"
                                  )}>
                                    {risk.riskOfMaterialMisstatement}
                                  </Badge>
                                  <span className="truncate">{risk.fsArea?.replace(/_/g, " ")} — {risk.description || risk.riskDescription || risk.id}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {proc.conclusion && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Conclusion</p>
                            <div className="p-2 rounded bg-muted text-sm">
                              {proc.conclusionType && <Badge variant="outline" className="text-[10px] mb-1">{proc.conclusionType}</Badge>}
                              <p>{proc.conclusion}</p>
                            </div>
                          </div>
                        )}

                        {proc.reviewNotes && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Review Notes</p>
                            <div className="p-2 rounded bg-amber-50 dark:bg-amber-950 text-sm border border-amber-200 dark:border-amber-800">
                              <p>{proc.reviewNotes}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function TestingTab({ stats, engagementId }: { stats?: ExecutionStats | null; engagementId: string }) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4" /> Control Testing (ISA 330.8)
            </CardTitle>
            <CardDescription>Tests of operating effectiveness for internal controls</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span>Control Tests Performed</span>
                <Badge variant="secondary">{stats?.controlTests ?? 0}</Badge>
              </div>
              <Separator />
              <div className="text-xs text-muted-foreground space-y-1">
                <p><strong>Purpose:</strong> Assess operating effectiveness of controls the auditor intends to rely upon</p>
                <p><strong>Approach:</strong> Inquiry, observation, inspection of documents, reperformance of control activities</p>
                <p><strong>ISA 330.8:</strong> If controls are operating effectively, reduced substantive testing may be appropriate</p>
              </div>

              {stats && stats.byCategory["CONTROL"] && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Control Procedures</span>
                      <span>{stats.byCategory["CONTROL"].completed}/{stats.byCategory["CONTROL"].total} completed</span>
                    </div>
                    <Progress value={stats.byCategory["CONTROL"].total > 0 ? (stats.byCategory["CONTROL"].completed / stats.byCategory["CONTROL"].total) * 100 : 0} className="h-1.5" />
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-4 w-4" /> Substantive Testing (ISA 330.18)
            </CardTitle>
            <CardDescription>Tests of details and analytical procedures for assertions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span>Substantive Tests Performed</span>
                <Badge variant="secondary">{stats?.substantiveTests ?? 0}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Sample Items Selected</span>
                <Badge variant="secondary">{stats?.sampleItems ?? 0}</Badge>
              </div>
              <Separator />
              <div className="text-xs text-muted-foreground space-y-1">
                <p><strong>Purpose:</strong> Detect material misstatements at the assertion level</p>
                <p><strong>Approach:</strong> Tests of details (individual transactions, balances, disclosures) and substantive analytical procedures</p>
                <p><strong>ISA 330.18:</strong> Substantive procedures must be performed for each material class of transactions, balance, and disclosure</p>
              </div>

              {stats && stats.byCategory["SUBSTANTIVE"] && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Substantive Procedures</span>
                      <span>{stats.byCategory["SUBSTANTIVE"].completed}/{stats.byCategory["SUBSTANTIVE"].total} completed</span>
                    </div>
                    <Progress value={stats.byCategory["SUBSTANTIVE"].total > 0 ? (stats.byCategory["SUBSTANTIVE"].completed / stats.byCategory["SUBSTANTIVE"].total) * 100 : 0} className="h-1.5" />
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4" /> Testing by Procedure Type
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats && Object.keys(stats.byType).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(stats.byType).map(([type, data]) => (
                <div key={type} className="flex items-center gap-3">
                  <span className="text-sm w-40 truncate">{type.replace(/_/g, " ")}</span>
                  <Progress value={data.total > 0 ? (data.completed / data.total) * 100 : 0} className="h-2 flex-1" />
                  <span className="text-xs text-muted-foreground w-16 text-right">{data.completed}/{data.total}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-3">No procedure types recorded yet</p>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function WorkpapersTab({ stats, engagementId }: { stats?: ExecutionStats | null; engagementId: string }) {
  const proceduresWithoutWp = stats?.procedures?.filter(p => !p.workpaperRef && p.status !== "NOT_STARTED") || [];
  const proceduresWithWp = stats?.procedures?.filter(p => p.workpaperRef) || [];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" /> Workpaper Status — ISA 230
          </CardTitle>
          <CardDescription>Documentation of procedures performed, evidence obtained, and conclusions reached</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
            <div className="p-3 rounded-lg border">
              <p className="text-xs text-muted-foreground">Procedures with Workpapers</p>
              <p className="text-xl font-bold">{stats?.withWorkpaper ?? 0}<span className="text-sm text-muted-foreground font-normal">/{stats?.totalProcedures ?? 0}</span></p>
            </div>
            <div className="p-3 rounded-lg border">
              <p className="text-xs text-muted-foreground">Workpaper Registry</p>
              <p className="text-xl font-bold">{stats?.workpaperCount ?? 0}</p>
            </div>
            <div className="p-3 rounded-lg border">
              <p className="text-xs text-muted-foreground">Evidence Files</p>
              <p className="text-xl font-bold">{stats?.evidenceFiles ?? 0}</p>
            </div>
            <div className="p-3 rounded-lg border">
              <p className="text-xs text-muted-foreground">With Conclusions</p>
              <p className="text-xl font-bold">{stats?.withConclusion ?? 0}<span className="text-sm text-muted-foreground font-normal">/{stats?.totalProcedures ?? 0}</span></p>
            </div>
          </div>

          {proceduresWithoutWp.length > 0 && (
            <>
              <Separator />
              <div className="mt-4">
                <h4 className="text-sm font-medium text-destructive mb-2 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" /> Procedures Missing Workpapers ({proceduresWithoutWp.length})
                </h4>
                <div className="space-y-1">
                  {proceduresWithoutWp.slice(0, 10).map(p => (
                    <div key={p.id} className="flex items-center gap-2 text-sm p-2 rounded border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950">
                      <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                      <span className="truncate">{p.title}</span>
                      <Badge variant="outline" className="text-[10px] shrink-0">{getCategoryLabel(p.category)}</Badge>
                    </div>
                  ))}
                  {proceduresWithoutWp.length > 10 && (
                    <p className="text-xs text-muted-foreground">...and {proceduresWithoutWp.length - 10} more</p>
                  )}
                </div>
              </div>
            </>
          )}

          {proceduresWithWp.length > 0 && (
            <>
              <Separator className="my-4" />
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Documented Procedures ({proceduresWithWp.length})
                </h4>
                <div className="space-y-1">
                  {proceduresWithWp.slice(0, 10).map(p => (
                    <div key={p.id} className="flex items-center gap-2 text-sm p-2 rounded border">
                      <FileCheck className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      <span className="truncate flex-1">{p.title}</span>
                      <Badge variant="outline" className="text-[10px] shrink-0">{p.workpaperRef}</Badge>
                      {p.conclusion ? (
                        <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                      ) : (
                        <AlertCircle className="h-3 w-3 text-amber-500 shrink-0" />
                      )}
                    </div>
                  ))}
                  {proceduresWithWp.length > 10 && (
                    <p className="text-xs text-muted-foreground">...and {proceduresWithWp.length - 10} more</p>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="h-4 w-4" /> ISA 230 — Documentation Requirements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple">
            <AccordionItem value="content">
              <AccordionTrigger className="text-sm">Workpaper Content Requirements</AccordionTrigger>
              <AccordionContent>
                <ul className="list-disc pl-4 space-y-1 text-sm text-muted-foreground">
                  <li>Nature, timing, and extent of audit procedures performed</li>
                  <li>Results of audit procedures and evidence obtained</li>
                  <li>Significant matters and professional judgments</li>
                  <li>Conclusions reached and basis for those conclusions</li>
                  <li>Who performed the work and the date completed</li>
                  <li>Who reviewed the work, date, and extent of review</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="form">
              <AccordionTrigger className="text-sm">Form and Organization</AccordionTrigger>
              <AccordionContent>
                <ul className="list-disc pl-4 space-y-1 text-sm text-muted-foreground">
                  <li>Sufficient for an experienced auditor to understand the work</li>
                  <li>Organized by FS head / lead schedule for logical structure</li>
                  <li>Cross-referenced to related workpapers and evidence</li>
                  <li>Clearly labeled with engagement, period, and reference number</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </>
  );
}

function ReviewerPanel({ stats, engagementId }: { stats?: ExecutionStats | null; engagementId: string }) {
  const { data: reviewNotes } = useQuery<any[]>({
    queryKey: ["/api/review-notes-v2", engagementId, "execution"],
    enabled: !!engagementId,
  });

  const unreviewedProcs = stats?.procedures?.filter(p => !p.reviewedById && (p.status === "COMPLETED" || p.status === "IN_PROGRESS")) || [];
  const reviewedProcs = stats?.procedures?.filter(p => p.reviewedById) || [];
  const procsWithoutConclusion = stats?.procedures?.filter(p => p.status === "COMPLETED" && !p.conclusion) || [];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" /> Reviewer Panel — ISA 220
          </CardTitle>
          <CardDescription>Review notes, clearance status, and procedure sign-off tracking</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
            <div className="p-3 rounded-lg border">
              <p className="text-xs text-muted-foreground">Reviewed</p>
              <p className="text-xl font-bold">{stats?.reviewed ?? 0}<span className="text-sm text-muted-foreground font-normal">/{stats?.totalProcedures ?? 0}</span></p>
            </div>
            <div className="p-3 rounded-lg border">
              <p className="text-xs text-muted-foreground">Awaiting Review</p>
              <p className="text-xl font-bold text-amber-600">{unreviewedProcs.length}</p>
            </div>
            <div className="p-3 rounded-lg border">
              <p className="text-xs text-muted-foreground">Open Review Notes</p>
              <p className="text-xl font-bold text-red-600">{stats?.openReviewNotes ?? 0}</p>
            </div>
            <div className="p-3 rounded-lg border">
              <p className="text-xs text-muted-foreground">Missing Conclusions</p>
              <p className="text-xl font-bold text-orange-600">{procsWithoutConclusion.length}</p>
            </div>
          </div>

          {unreviewedProcs.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-1">
                <Eye className="h-3.5 w-3.5" /> Procedures Awaiting Review ({unreviewedProcs.length})
              </h4>
              <div className="space-y-1">
                {unreviewedProcs.slice(0, 8).map(p => {
                  const statusConfig = getStatusConfig(p.status);
                  return (
                    <div key={p.id} className="flex items-center gap-2 text-sm p-2 rounded border border-amber-200 dark:border-amber-800">
                      <statusConfig.icon className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                      <span className="truncate flex-1">{p.title}</span>
                      <Badge variant="outline" className="text-[10px]">{getCategoryLabel(p.category)}</Badge>
                      <Badge className={cn("text-[10px]", statusConfig.color)}>{statusConfig.label}</Badge>
                    </div>
                  );
                })}
                {unreviewedProcs.length > 8 && (
                  <p className="text-xs text-muted-foreground">...and {unreviewedProcs.length - 8} more</p>
                )}
              </div>
            </div>
          )}

          {procsWithoutConclusion.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-orange-700 dark:text-orange-400 mb-2 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" /> Completed Without Conclusion ({procsWithoutConclusion.length})
              </h4>
              <div className="space-y-1">
                {procsWithoutConclusion.slice(0, 5).map(p => (
                  <div key={p.id} className="flex items-center gap-2 text-sm p-2 rounded border border-orange-200 dark:border-orange-800">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 text-orange-500" />
                    <span className="truncate">{p.title}</span>
                    <Badge variant="outline" className="text-[10px]">{getCategoryLabel(p.category)}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {reviewedProcs.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-green-700 dark:text-green-400 mb-2 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Reviewed Procedures ({reviewedProcs.length})
              </h4>
              <div className="space-y-1">
                {reviewedProcs.slice(0, 5).map(p => (
                  <div key={p.id} className="flex items-center gap-2 text-sm p-2 rounded border border-green-200 dark:border-green-800">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" />
                    <span className="truncate flex-1">{p.title}</span>
                    {p.reviewedAt && <span className="text-xs text-muted-foreground">{new Date(p.reviewedAt).toLocaleDateString()}</span>}
                    {p.conclusion ? (
                      <Badge className="text-[10px] bg-green-100 text-green-800">Concluded</Badge>
                    ) : (
                      <Badge className="text-[10px] bg-amber-100 text-amber-800">No Conclusion</Badge>
                    )}
                  </div>
                ))}
                {reviewedProcs.length > 5 && (
                  <p className="text-xs text-muted-foreground">...and {reviewedProcs.length - 5} more</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> Review Notes Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span>Total Notes</span>
              <Badge variant="secondary">{stats?.totalReviewNotes ?? 0}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Open</span>
              <Badge variant={stats?.openReviewNotes ? "destructive" : "secondary"}>{stats?.openReviewNotes ?? 0}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Resolved</span>
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">{stats?.resolvedReviewNotes ?? 0}</Badge>
            </div>
            {stats && stats.totalReviewNotes > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Clearance Rate</p>
                  <Progress value={stats.totalReviewNotes > 0 ? (stats.resolvedReviewNotes / stats.totalReviewNotes) * 100 : 0} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {Math.round((stats.resolvedReviewNotes / stats.totalReviewNotes) * 100)}% — {stats.resolvedReviewNotes >= stats.totalReviewNotes * 0.75 ? "Target met (75%)" : "Below target (75%)"}
                  </p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
