import { useState, useEffect, useCallback } from "react";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import {
  Brain, RefreshCw, AlertTriangle, CheckCircle2, Shield, Lock,
  FileCheck, Scale, TrendingDown, Database, Eye, Sparkles,
  Info, ChevronRight, BarChart3, Activity, FileSignature,
  AlertCircle, CircleDot, ArrowRight, Clock, User
} from "lucide-react";

interface OpinionEngineProps {
  engagementId: string;
}

interface Finding {
  id: string;
  sectionKey: string;
  auditArea: string | null;
  narrative: string;
  riskLevel: string;
  isaReference: string | null;
  materialityImpact: string | null;
  amountInvolved: number | null;
  suggestedResponse: string | null;
  assertionAffected: string | null;
  reviewerNote: string | null;
  reviewerDecision: string;
  finalStatus: string;
  createdAt: string;
}

interface AiRun {
  id: string;
  sectionKey: string | null;
  runType: string;
  findingsCount: number;
  completedAt: string | null;
  createdAt: string;
}

interface DataSources {
  materiality: { available: boolean; overallMateriality: number | null; performanceMateriality: number | null };
  misstatements: { available: boolean; count: number; uncorrectedCount: number };
  goingConcern: { available: boolean; conclusion: string | null };
  significantRisks: { available: boolean; count: number };
  controlDeficiencies: { available: boolean; count: number; significantCount: number };
  subsequentEvents: { available: boolean; count: number; pendingCount: number };
}

interface EngineData {
  id: string;
  status: string;
  version: number;
  overallScore: number | null;
  aiCategory: string;
  partnerCategory: string | null;
  partnerConclusion: string | null;
  partnerSignedAt: string | null;
  partnerSignedBy: string | null;
  reviewerNotes: string | null;
  dataReliability: string;
  reliabilityNotes: string | null;
  scoresData: any;
  memoData: any;
  lastAiRunAt: string | null;
  lockedAt: string | null;
  findings: Finding[];
  aiRuns: AiRun[];
  createdAt: string;
  updatedAt: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  UNMODIFIED: "Unmodified (Clean)",
  QUALIFIED: "Qualified",
  ADVERSE: "Adverse",
  DISCLAIMER: "Disclaimer of Opinion",
  UNDETERMINED: "Not Yet Determined",
};

const CATEGORY_COLORS: Record<string, string> = {
  UNMODIFIED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  QUALIFIED: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  ADVERSE: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  DISCLAIMER: "bg-red-200 text-red-900 dark:bg-red-900/40 dark:text-red-300",
  UNDETERMINED: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const RISK_COLORS: Record<string, string> = {
  LOW: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  MEDIUM: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  HIGH: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  CRITICAL: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  IN_PROGRESS: "In Progress",
  REVIEW_PENDING: "Review Pending",
  REVIEWED: "Reviewed",
  PARTNER_REVIEW: "Partner Review",
  FINALIZED: "Finalized",
  LOCKED: "Locked",
};

function ScoreGauge({ score, label }: { score: number | null; label: string }) {
  const s = score ?? 0;
  let color = "text-green-600 dark:text-green-400";
  if (s < 60) color = "text-red-600 dark:text-red-400";
  else if (s < 80) color = "text-yellow-600 dark:text-yellow-400";

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`text-2xl font-bold ${color}`}>{score !== null ? s : "—"}</div>
      <div className="text-xs text-muted-foreground text-center">{label}</div>
    </div>
  );
}

export function AIOpinionEngine({ engagementId }: OpinionEngineProps) {
  const { toast } = useToast();
  const [engine, setEngine] = useState<EngineData | null>(null);
  const [dataSources, setDataSources] = useState<DataSources | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [partnerDialog, setPartnerDialog] = useState(false);
  const [partnerCategory, setPartnerCategory] = useState("");
  const [partnerConclusion, setPartnerConclusion] = useState("");
  const [reviewFindingId, setReviewFindingId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewDecision, setReviewDecision] = useState("");

  const fetchEngine = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`/api/opinion-engine/${engagementId}`);
      if (res.ok) {
        const data = await res.json();
        setEngine(data);
      }
    } catch (e) {
      console.error("Failed to fetch opinion engine:", e);
    }
  }, [engagementId]);

  const fetchDataSources = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`/api/opinion-engine/${engagementId}/data-sources`);
      if (res.ok) {
        setDataSources(await res.json());
      }
    } catch (e) {
      console.error("Failed to fetch data sources:", e);
    }
  }, [engagementId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchEngine(), fetchDataSources()]).finally(() => setLoading(false));
  }, [fetchEngine, fetchDataSources]);

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const res = await fetchWithAuth(`/api/opinion-engine/${engagementId}/run-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        setEngine(data);
        toast({ title: "Analysis Complete", description: `Score: ${data.overallScore}/100 — ${CATEGORY_LABELS[data.aiCategory] || data.aiCategory}` });
      } else {
        const err = await res.json();
        toast({ title: "Analysis Failed", description: err.error, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFindingReview = async () => {
    if (!reviewFindingId) return;
    try {
      const res = await fetchWithAuth(`/api/opinion-engine/${engagementId}/findings/${reviewFindingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewerNote: reviewNote, reviewerDecision: reviewDecision }),
      });
      if (res.ok) {
        await fetchEngine();
        setReviewFindingId(null);
        setReviewNote("");
        setReviewDecision("");
        toast({ title: "Finding Updated" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handlePartnerSign = async () => {
    try {
      const res = await fetchWithAuth(`/api/opinion-engine/${engagementId}/partner-sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerCategory, partnerConclusion }),
      });
      if (res.ok) {
        const data = await res.json();
        setEngine(data);
        setPartnerDialog(false);
        toast({ title: "Partner Opinion Recorded", description: `Opinion: ${CATEGORY_LABELS[partnerCategory]}` });
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleLock = async () => {
    try {
      const res = await fetchWithAuth(`/api/opinion-engine/${engagementId}/lock`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setEngine(data);
        toast({ title: "Opinion Engine Locked" });
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading AI Opinion Engine...</span>
      </div>
    );
  }

  let scores: Record<string, number> = {};
  try {
    scores = engine?.scoresData ? (typeof engine.scoresData === "string" ? JSON.parse(engine.scoresData) : engine.scoresData) : {};
  } catch { scores = {}; }
  const isLocked = engine?.status === "LOCKED";
  const isFinalized = engine?.status === "FINALIZED" || isLocked;

  return (
    <div className="space-y-4">
      <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg flex items-start gap-3 border border-amber-200 dark:border-amber-800">
        <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
        <div className="text-sm">
          <p className="font-semibold text-amber-800 dark:text-amber-300">Advisory Only — Professional Judgment Required</p>
          <p className="text-amber-700 dark:text-amber-400 mt-0.5">
            AI analysis is advisory and does not replace the engagement partner's professional judgment under ISA 700/705/706.
            The final audit opinion must be determined and signed by the engagement partner.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1">
            {STATUS_LABELS[engine?.status || "DRAFT"]}
          </Badge>
          {engine?.lastAiRunAt && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Last analysis: {new Date(engine.lastAiRunAt).toLocaleString()}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {!isLocked && (
            <Button onClick={runAnalysis} disabled={analyzing} className="gap-2">
              {analyzing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
              {analyzing ? "Analyzing..." : engine?.lastAiRunAt ? "Re-Run Analysis" : "Run AI Analysis"}
            </Button>
          )}
          {isLocked && (
            <Badge className="bg-gray-800 text-white gap-1 py-1.5 px-3">
              <Lock className="h-3 w-3" /> Locked
            </Badge>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="dashboard" className="gap-1 text-xs">
            <BarChart3 className="h-3.5 w-3.5" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="data-sources" className="gap-1 text-xs">
            <Database className="h-3.5 w-3.5" /> Data Sources
          </TabsTrigger>
          <TabsTrigger value="findings" className="gap-1 text-xs">
            <AlertCircle className="h-3.5 w-3.5" /> Findings
            {engine?.findings && engine.findings.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1">{engine.findings.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="scores" className="gap-1 text-xs">
            <Activity className="h-3.5 w-3.5" /> Scores
          </TabsTrigger>
          <TabsTrigger value="partner" className="gap-1 text-xs">
            <FileSignature className="h-3.5 w-3.5" /> Partner
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Scale className="h-4 w-4" /> Overall Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center py-2">
                  <div className={`text-5xl font-bold ${
                    (engine?.overallScore ?? 0) >= 80 ? "text-green-600 dark:text-green-400" :
                    (engine?.overallScore ?? 0) >= 60 ? "text-yellow-600 dark:text-yellow-400" :
                    "text-red-600 dark:text-red-400"
                  }`}>
                    {engine?.overallScore !== null && engine?.overallScore !== undefined ? engine.overallScore : "—"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">out of 100</div>
                  <Progress
                    value={engine?.overallScore ?? 0}
                    className="mt-3 h-2"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Brain className="h-4 w-4" /> AI Recommendation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center py-2">
                  <Badge className={`text-sm px-3 py-1 ${CATEGORY_COLORS[engine?.aiCategory || "UNDETERMINED"]}`}>
                    {CATEGORY_LABELS[engine?.aiCategory || "UNDETERMINED"]}
                  </Badge>
                  <div className="text-xs text-muted-foreground mt-2 text-center">
                    Based on ISA 700/705/706 analysis
                  </div>
                  {engine?.aiCategory && engine.aiCategory !== "UNDETERMINED" && (
                    <div className="text-[10px] text-muted-foreground mt-1 italic">
                      {engine.aiCategory === "UNMODIFIED" ? "ISA 700 — Standard report" :
                       engine.aiCategory === "QUALIFIED" ? "ISA 705 — Except-for opinion" :
                       engine.aiCategory === "ADVERSE" ? "ISA 705 — Material & pervasive" :
                       "ISA 705 — Insufficient evidence"}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileSignature className="h-4 w-4" /> Partner Decision
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center py-2">
                  {engine?.partnerCategory ? (
                    <>
                      <Badge className={`text-sm px-3 py-1 ${CATEGORY_COLORS[engine.partnerCategory]}`}>
                        {CATEGORY_LABELS[engine.partnerCategory]}
                      </Badge>
                      <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        Signed {engine.partnerSignedAt ? new Date(engine.partnerSignedAt).toLocaleDateString() : ""}
                      </div>
                    </>
                  ) : (
                    <>
                      <Badge variant="outline" className="text-sm px-3 py-1">Pending</Badge>
                      <div className="text-xs text-muted-foreground mt-2">Awaiting partner sign-off</div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {engine?.findings && engine.findings.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Key Findings Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {engine.findings.slice(0, 3).map((f) => (
                    <div key={f.id} className="flex items-start gap-3 p-2 rounded-lg bg-muted/50">
                      <Badge variant="outline" className={`shrink-0 text-[10px] ${RISK_COLORS[f.riskLevel]}`}>
                        {f.riskLevel}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{f.auditArea}</div>
                        <div className="text-xs text-muted-foreground line-clamp-2">{f.narrative}</div>
                      </div>
                      {f.isaReference && (
                        <span className="text-[10px] text-muted-foreground shrink-0">{f.isaReference}</span>
                      )}
                    </div>
                  ))}
                  {engine.findings.length > 3 && (
                    <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setActiveTab("findings")}>
                      View all {engine.findings.length} findings <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {engine?.aiRuns && engine.aiRuns.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Analysis History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {engine.aiRuns.map((run) => (
                    <div key={run.id} className="flex items-center justify-between text-xs p-2 rounded bg-muted/30">
                      <div className="flex items-center gap-2">
                        <CircleDot className="h-3 w-3 text-blue-500" />
                        <span className="capitalize">{run.runType} analysis</span>
                      </div>
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <span>{run.findingsCount} finding(s)</span>
                        <span>{run.completedAt ? new Date(run.completedAt).toLocaleString() : "—"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="data-sources" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Database className="h-4 w-4" /> Engagement Data Sources
              </CardTitle>
              <CardDescription>
                Data points automatically collected from prior phases for opinion formation
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!dataSources ? (
                <div className="text-sm text-muted-foreground py-4 text-center">Loading data sources...</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <DataSourceCard
                    title="Materiality"
                    icon={<Scale className="h-4 w-4" />}
                    available={dataSources.materiality.available}
                    details={dataSources.materiality.available ? [
                      `Overall: PKR ${Number(dataSources.materiality.overallMateriality || 0).toLocaleString()}`,
                      `Performance: PKR ${Number(dataSources.materiality.performanceMateriality || 0).toLocaleString()}`,
                    ] : ["Not yet assessed"]}
                    isa="ISA 320"
                  />
                  <DataSourceCard
                    title="Misstatements"
                    icon={<AlertTriangle className="h-4 w-4" />}
                    available={dataSources.misstatements.available}
                    details={dataSources.misstatements.available ? [
                      `Total: ${dataSources.misstatements.count}`,
                      `Uncorrected: ${dataSources.misstatements.uncorrectedCount}`,
                    ] : ["No misstatements recorded"]}
                    isa="ISA 450"
                  />
                  <DataSourceCard
                    title="Going Concern"
                    icon={<TrendingDown className="h-4 w-4" />}
                    available={dataSources.goingConcern.available}
                    details={dataSources.goingConcern.available ? [
                      `Conclusion: ${dataSources.goingConcern.conclusion || "Pending"}`,
                    ] : ["Not yet assessed"]}
                    isa="ISA 570"
                  />
                  <DataSourceCard
                    title="Significant Risks"
                    icon={<AlertCircle className="h-4 w-4" />}
                    available={dataSources.significantRisks.available}
                    details={dataSources.significantRisks.available ? [
                      `Count: ${dataSources.significantRisks.count}`,
                    ] : ["No significant risks identified"]}
                    isa="ISA 315"
                  />
                  <DataSourceCard
                    title="Control Deficiencies"
                    icon={<Shield className="h-4 w-4" />}
                    available={dataSources.controlDeficiencies.available}
                    details={dataSources.controlDeficiencies.available ? [
                      `Total: ${dataSources.controlDeficiencies.count}`,
                      `Significant: ${dataSources.controlDeficiencies.significantCount}`,
                    ] : ["No deficiencies reported"]}
                    isa="ISA 265"
                  />
                  <DataSourceCard
                    title="Subsequent Events"
                    icon={<Clock className="h-4 w-4" />}
                    available={dataSources.subsequentEvents.available}
                    details={dataSources.subsequentEvents.available ? [
                      `Total: ${dataSources.subsequentEvents.count}`,
                      `Pending: ${dataSources.subsequentEvents.pendingCount}`,
                    ] : ["No subsequent events"]}
                    isa="ISA 560"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4" /> Data Reliability Assessment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Badge className={
                  engine?.dataReliability === "HIGH" ? "bg-green-100 text-green-700" :
                  engine?.dataReliability === "MODERATE" ? "bg-yellow-100 text-yellow-700" :
                  engine?.dataReliability === "LIMITED" ? "bg-orange-100 text-orange-700" :
                  "bg-red-100 text-red-700"
                }>
                  {engine?.dataReliability || "MODERATE"}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {engine?.dataReliability === "HIGH" ? "All key data sources are complete and reviewed" :
                   engine?.dataReliability === "MODERATE" ? "Most data sources available but some gaps remain" :
                   engine?.dataReliability === "LIMITED" ? "Significant data gaps — analysis may be incomplete" :
                   "Insufficient data for reliable analysis"}
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="findings" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4" /> AI-Generated Findings
              </CardTitle>
              <CardDescription>
                Each finding is generated from engagement data and mapped to ISA standards. Review and accept/revise each finding.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!engine?.findings || engine.findings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No findings yet. Run the AI analysis to generate findings.</p>
                </div>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-[40px]">#</TableHead>
                        <TableHead className="w-[120px]">Area</TableHead>
                        <TableHead>Finding</TableHead>
                        <TableHead className="w-[80px]">Risk</TableHead>
                        <TableHead className="w-[100px]">ISA Ref</TableHead>
                        <TableHead className="w-[90px]">Review</TableHead>
                        <TableHead className="w-[80px]">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {engine.findings.map((f, idx) => (
                        <TableRow key={f.id}>
                          <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell>
                            <span className="text-xs font-medium">{f.auditArea || f.sectionKey}</span>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs max-w-[400px]">
                              <p className="line-clamp-3">{f.narrative}</p>
                              {f.suggestedResponse && (
                                <p className="text-muted-foreground mt-1 italic">
                                  <ArrowRight className="h-3 w-3 inline mr-1" />
                                  {f.suggestedResponse}
                                </p>
                              )}
                              {f.amountInvolved && (
                                <p className="text-muted-foreground mt-0.5">
                                  Amount: PKR {Number(f.amountInvolved).toLocaleString()}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] ${RISK_COLORS[f.riskLevel]}`}>
                              {f.riskLevel}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-[10px] text-muted-foreground">{f.isaReference}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] ${
                              f.reviewerDecision === "ACCEPTED" ? "bg-green-50 text-green-700" :
                              f.reviewerDecision === "REVISED" ? "bg-blue-50 text-blue-700" :
                              f.reviewerDecision === "REJECTED" ? "bg-red-50 text-red-700" :
                              f.reviewerDecision === "OVERRIDDEN" ? "bg-purple-50 text-purple-700" :
                              ""
                            }`}>
                              {f.reviewerDecision}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {!isLocked && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => {
                                  setReviewFindingId(f.id);
                                  setReviewNote(f.reviewerNote || "");
                                  setReviewDecision(f.reviewerDecision || "PENDING");
                                }}
                              >
                                <Eye className="h-3 w-3 mr-1" /> Review
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scores" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Section Scores Breakdown
              </CardTitle>
              <CardDescription>
                Individual scores for each audit area contributing to the overall opinion score
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!scores || Object.keys(scores).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Run the AI analysis to generate section scores.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <ScoreGauge score={scores.misstatementScore ?? null} label="Misstatements" />
                    <ScoreGauge score={scores.goingConcernScore ?? null} label="Going Concern" />
                    <ScoreGauge score={scores.riskCoverageScore ?? null} label="Risk Coverage" />
                    <ScoreGauge score={scores.controlScore ?? null} label="Controls" />
                    <ScoreGauge score={scores.subsequentEventsScore ?? null} label="Subsequent Events" />
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    {[
                      { key: "misstatementScore", label: "Misstatements (ISA 450)", desc: "Uncorrected misstatements vs materiality threshold" },
                      { key: "goingConcernScore", label: "Going Concern (ISA 570)", desc: "Going concern assessment and conclusion" },
                      { key: "riskCoverageScore", label: "Risk Coverage (ISA 315/330)", desc: "Significant risk response completeness" },
                      { key: "controlScore", label: "Internal Controls (ISA 265)", desc: "Significant deficiencies and material weaknesses" },
                      { key: "subsequentEventsScore", label: "Subsequent Events (ISA 560)", desc: "Post-period events evaluation status" },
                    ].map((item) => (
                      <div key={item.key} className="flex items-center gap-4">
                        <div className="flex-1">
                          <div className="text-sm font-medium">{item.label}</div>
                          <div className="text-xs text-muted-foreground">{item.desc}</div>
                        </div>
                        <div className="w-32">
                          <Progress value={scores[item.key] ?? 0} className="h-2" />
                        </div>
                        <div className={`text-sm font-bold w-10 text-right ${
                          (scores[item.key] ?? 0) >= 80 ? "text-green-600" :
                          (scores[item.key] ?? 0) >= 60 ? "text-yellow-600" : "text-red-600"
                        }`}>
                          {scores[item.key] ?? "—"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Score Interpretation Guide</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                <div className="p-2 rounded bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <div className="font-semibold text-green-700 dark:text-green-400">80-100: Unmodified</div>
                  <div className="text-green-600 dark:text-green-500 mt-0.5">Clean opinion likely per ISA 700</div>
                </div>
                <div className="p-2 rounded bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                  <div className="font-semibold text-yellow-700 dark:text-yellow-400">60-79: Qualified</div>
                  <div className="text-yellow-600 dark:text-yellow-500 mt-0.5">Except-for modification per ISA 705</div>
                </div>
                <div className="p-2 rounded bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
                  <div className="font-semibold text-orange-700 dark:text-orange-400">30-59: Adverse</div>
                  <div className="text-orange-600 dark:text-orange-500 mt-0.5">Material and pervasive per ISA 705</div>
                </div>
                <div className="p-2 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <div className="font-semibold text-red-700 dark:text-red-400">0-29: Disclaimer</div>
                  <div className="text-red-600 dark:text-red-500 mt-0.5">Insufficient evidence per ISA 705</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="partner" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <FileSignature className="h-4 w-4" /> Partner Opinion & Sign-Off
              </CardTitle>
              <CardDescription>
                The engagement partner must exercise professional judgment to determine the final audit opinion
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                <div className="text-sm text-blue-700 dark:text-blue-400">
                  Per ISA 700.11, the auditor shall form an opinion on whether the financial statements are prepared,
                  in all material respects, in accordance with the applicable financial reporting framework.
                  The partner may agree with, modify, or override the AI recommendation.
                </div>
              </div>

              {engine?.aiCategory && engine.aiCategory !== "UNDETERMINED" && (
                <div className="flex items-center gap-4 p-3 rounded-lg border">
                  <div className="text-sm">
                    <span className="text-muted-foreground">AI Recommendation: </span>
                    <Badge className={`${CATEGORY_COLORS[engine.aiCategory]}`}>
                      {CATEGORY_LABELS[engine.aiCategory]}
                    </Badge>
                    <span className="text-muted-foreground ml-2">(Score: {engine.overallScore}/100)</span>
                  </div>
                </div>
              )}

              {engine?.partnerCategory ? (
                <div className="space-y-3">
                  <div className="p-4 rounded-lg border-2 border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <span className="font-semibold text-green-800 dark:text-green-400">Partner Opinion Recorded</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Opinion Type</Label>
                        <div className="mt-1">
                          <Badge className={`${CATEGORY_COLORS[engine.partnerCategory]}`}>
                            {CATEGORY_LABELS[engine.partnerCategory]}
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Signed Date</Label>
                        <div className="mt-1 text-sm">
                          {engine.partnerSignedAt ? new Date(engine.partnerSignedAt).toLocaleDateString() : "—"}
                        </div>
                      </div>
                    </div>
                    {engine.partnerConclusion && (
                      <div className="mt-3">
                        <Label className="text-xs text-muted-foreground">Partner Conclusion</Label>
                        <p className="text-sm mt-1 whitespace-pre-wrap">{engine.partnerConclusion}</p>
                      </div>
                    )}
                    {engine.partnerCategory !== engine.aiCategory && (
                      <div className="mt-3 p-2 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                        <div className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Partner opinion differs from AI recommendation — professional judgment override documented.
                        </div>
                      </div>
                    )}
                  </div>

                  {engine.status === "FINALIZED" && !isLocked && (
                    <Button onClick={handleLock} variant="outline" className="gap-2">
                      <Lock className="h-4 w-4" /> Lock Opinion Engine
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {engine?.overallScore !== null && engine?.overallScore !== undefined ? (
                    <Button onClick={() => setPartnerDialog(true)} className="gap-2" disabled={isLocked}>
                      <FileSignature className="h-4 w-4" /> Record Partner Opinion
                    </Button>
                  ) : (
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <Info className="h-4 w-4" />
                      Run the AI analysis first before recording partner opinion.
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!reviewFindingId} onOpenChange={(open) => { if (!open) setReviewFindingId(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Finding</DialogTitle>
            <DialogDescription>
              Review and provide your assessment of this AI-generated finding
            </DialogDescription>
          </DialogHeader>
          {reviewFindingId && engine?.findings && (() => {
            const f = engine.findings.find((x) => x.id === reviewFindingId);
            if (!f) return null;
            return (
              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Finding</Label>
                  <p className="text-sm mt-1">{f.narrative}</p>
                </div>
                {f.suggestedResponse && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Suggested Response</Label>
                    <p className="text-sm mt-1 italic">{f.suggestedResponse}</p>
                  </div>
                )}
                <div>
                  <Label>Decision</Label>
                  <Select value={reviewDecision} onValueChange={setReviewDecision}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select decision" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACCEPTED">Accept</SelectItem>
                      <SelectItem value="REVISED">Revise</SelectItem>
                      <SelectItem value="REJECTED">Reject</SelectItem>
                      <SelectItem value="OVERRIDDEN">Override</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Reviewer Note</Label>
                  <Textarea
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    placeholder="Add your professional assessment..."
                    className="mt-1"
                    rows={3}
                  />
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewFindingId(null)}>Cancel</Button>
            <Button onClick={handleFindingReview} disabled={!reviewDecision}>Save Review</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={partnerDialog} onOpenChange={setPartnerDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Record Partner Opinion</DialogTitle>
            <DialogDescription>
              This constitutes the engagement partner's final determination on the audit opinion type.
              This action will be recorded in the audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <div className="text-sm text-amber-700 dark:text-amber-400 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>This is a formal sign-off. Ensure all findings have been reviewed and all audit evidence has been evaluated before proceeding.</span>
              </div>
            </div>
            <div>
              <Label>Opinion Type</Label>
              <Select value={partnerCategory} onValueChange={setPartnerCategory}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select opinion type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UNMODIFIED">Unmodified (Clean) — ISA 700</SelectItem>
                  <SelectItem value="QUALIFIED">Qualified — ISA 705</SelectItem>
                  <SelectItem value="ADVERSE">Adverse — ISA 705</SelectItem>
                  <SelectItem value="DISCLAIMER">Disclaimer of Opinion — ISA 705</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Partner Conclusion / Rationale</Label>
              <Textarea
                value={partnerConclusion}
                onChange={(e) => setPartnerConclusion(e.target.value)}
                placeholder="Document the basis for your opinion determination..."
                className="mt-1"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPartnerDialog(false)}>Cancel</Button>
            <Button onClick={handlePartnerSign} disabled={!partnerCategory}>
              <FileSignature className="h-4 w-4 mr-2" /> Sign & Record Opinion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DataSourceCard({ title, icon, available, details, isa }: {
  title: string;
  icon: React.ReactNode;
  available: boolean;
  details: string[];
  isa: string;
}) {
  return (
    <div className={`p-3 rounded-lg border ${available ? "bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-800" : "bg-muted/30 border-dashed"}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          {icon}
          {title}
        </div>
        {available ? (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        ) : (
          <CircleDot className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <div className="space-y-0.5">
        {details.map((d, i) => (
          <div key={i} className="text-xs text-muted-foreground">{d}</div>
        ))}
      </div>
      <div className="mt-2 text-[10px] text-muted-foreground">{isa}</div>
    </div>
  );
}
