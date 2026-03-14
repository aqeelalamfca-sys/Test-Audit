import { useState, useCallback, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatAccounting } from "@/lib/formatters";
import {
  Activity, AlertTriangle, AlertCircle, TrendingUp, TrendingDown,
  BarChart3, RefreshCw, Download, FileText,
  Brain, Loader2, Link2, ArrowUpDown, PieChart, CheckCircle2,
  Scale, Percent, Calculator, ShieldAlert, Save
} from "lucide-react";

interface PlanningNarration {
  overallConclusion: string;
  significantMovements: string;
  possibleReasons: string;
  planningImplications: string;
  proposedAuditResponse: string;
  riskAssessmentLinkage: string;
  lastUpdated: string;
  updatedBy?: string;
}

interface VerticalAnalysisItem {
  fsHeadKey: string;
  fsHeadLabel: string;
  currentYear: number;
  priorYear: number;
  pctOfRevenue: number | null;
  pctOfTotalAssets: number | null;
  pctOfTotalExpenses: number | null;
  priorPctOfRevenue: number | null;
  priorPctOfTotalAssets: number | null;
  priorPctOfTotalExpenses: number | null;
  compositionShift: number | null;
}

interface ReasonablenessItem {
  id: string;
  testName: string;
  description: string;
  expectedRelationship: string;
  actualResult: string;
  status: 'Consistent' | 'Inconsistent' | 'Insufficient Data';
  auditImplication: string;
}

interface PlanningAnalyticsResult {
  fsHeadExpectations?: Array<{
    fsHeadLabel: string;
    priorYearBalance: number;
    expectedBalance: number;
    currentYearBalance: number;
    expectationBasis: string;
    expectationRationale: string;
  }>;
  trendAnalysis?: Array<{
    id: string;
    fsHeadLabel: string;
    priorYear: number;
    currentYear: number;
    movement: number;
    movementPercentage: number;
    status: string;
    materialityFlag: boolean;
  }>;
  verticalAnalysis?: VerticalAnalysisItem[];
  ratioAnalysis?: Array<{
    ratioName: string;
    category: string;
    priorYear: number;
    currentYear: number;
    industryAverage?: number;
    variance: number;
    status: string;
    interpretation: string;
    formula?: string;
  }>;
  reasonablenessTests?: ReasonablenessItem[];
  significantFluctuations?: Array<{
    fsHeadLabel: string;
    natureOfFluctuation: string;
    riskLevel: string;
    riskImpact: string;
    affectedAssertions: string[];
    possibleCauses: string[];
    documentedJustification: string;
    fraudConsideration: boolean;
    significantRiskFlag: boolean;
  }>;
  riskMatrixUpdates?: Array<{
    fsHeadKey: string;
    assertion: string;
    previousRiskRating: string;
    updatedRiskRating: string;
    changeReason: string;
    analyticsReference: string;
  }>;
  auditStrategyImpact?: Array<{
    fsHeadLabel: string;
    impactOnNature: string;
    impactOnTiming: string;
    impactOnExtent: string;
    controlsRelianceImpact: string;
    planningConclusion: string;
  }>;
  narration?: PlanningNarration;
  analysisDate: string;
  analyzedBy?: string;
  totalAccountsAnalyzed: number;
  totalFluctuationsIdentified: number;
  riskIndicativeCount: number;
  riskMatrixUpdatesCount: number;
  ratiosOutOfRange: number;
  overallMateriality: number;
  performanceMateriality: number;
}

interface AnalyticalProceduresPanelProps {
  engagementId: string;
  readOnly?: boolean;
}

const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case 'Risk-Indicative': return 'destructive';
    case 'Requires Explanation': return 'secondary';
    case 'Inconsistent': return 'destructive';
    default: return 'outline';
  }
};

const getRiskImpactColor = (impact: string): string => {
  switch (impact) {
    case 'Introduces New Risk': return 'text-red-600 dark:text-red-400';
    case 'Elevates Risk Rating': return 'text-amber-600 dark:text-amber-400';
    default: return 'text-green-600 dark:text-green-400';
  }
};

function VarianceBar({ value, max }: { value: number; max: number }) {
  const w = Math.min(Math.abs(value) / (max || 1) * 100, 100);
  const color = Math.abs(value) > 50 ? 'bg-red-500' : Math.abs(value) > 20 ? 'bg-amber-500' : 'bg-green-500';
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${w}%` }} />
      </div>
      <span className={`text-xs font-mono tabular-nums ${Math.abs(value) > 20 ? 'text-red-600 font-semibold' : 'text-muted-foreground'}`}>
        {value >= 0 ? '+' : ''}{value.toFixed(1)}%
      </span>
    </div>
  );
}

export function AnalyticalProceduresPanel({ engagementId, readOnly }: AnalyticalProceduresPanelProps) {
  const { toast } = useToast();
  const [analyticsResult, setAnalyticsResult] = useState<PlanningAnalyticsResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdatingMatrix, setIsUpdatingMatrix] = useState(false);
  const [activeTab, setActiveTab] = useState("horizontal");
  const [trendFilter, setTrendFilter] = useState<string>("all");
  const [narration, setNarration] = useState<PlanningNarration | null>(null);
  const [isSavingNarration, setIsSavingNarration] = useState(false);

  useEffect(() => {
    if (!engagementId) return;
    setIsLoading(true);
    fetchWithAuth(`/api/planning-analytics/${engagementId}`)
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (data) {
            setAnalyticsResult(data);
            if (data.narration) setNarration(data.narration);
          }
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [engagementId]);

  const runAnalytics = useCallback(async () => {
    if (!engagementId) return;
    setIsRunning(true);
    setError(null);
    try {
      const response = await fetchWithAuth(`/api/planning-analytics/${engagementId}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Failed to run analytical procedures");
      }
      const result = await response.json();
      setAnalyticsResult(result);
      if (result.narration) setNarration(result.narration);
      toast({
        title: "Analytics Complete",
        description: `Analyzed ${result.totalAccountsAnalyzed} accounts. Found ${result.totalFluctuationsIdentified} fluctuation(s), ${result.ratiosOutOfRange} ratio(s) out of range.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to run analytical procedures";
      setError(msg);
      toast({ title: "Analysis Failed", description: msg, variant: "destructive" });
    } finally {
      setIsRunning(false);
    }
  }, [engagementId, toast]);

  const updateRiskMatrix = useCallback(async () => {
    if (!engagementId || !analyticsResult?.riskMatrixUpdates?.length) return;
    setIsUpdatingMatrix(true);
    try {
      const response = await fetchWithAuth(`/api/planning-analytics/${engagementId}/update-risk-matrix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ riskMatrixUpdates: analyticsResult.riskMatrixUpdates }),
      });
      if (!response.ok) throw new Error("Failed to update risk matrix");
      const result = await response.json();
      toast({ title: "Risk Matrix Updated", description: result.message });
      queryClient.invalidateQueries({ queryKey: ['/api/ai-risk-assessment', engagementId] });
    } catch (err) {
      toast({ title: "Update Failed", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally {
      setIsUpdatingMatrix(false);
    }
  }, [engagementId, analyticsResult, toast]);

  const saveNarration = useCallback(async () => {
    if (!engagementId || !narration) return;
    setIsSavingNarration(true);
    try {
      const response = await fetchWithAuth(`/api/planning-analytics/${engagementId}/save-narration`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ narration }),
      });
      if (!response.ok) throw new Error("Failed to save narration");
      toast({ title: "Narration Saved" });
    } catch (err) {
      toast({ title: "Save Failed", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally {
      setIsSavingNarration(false);
    }
  }, [engagementId, narration, toast]);

  const exportAnalytics = useCallback(() => {
    if (!analyticsResult) return;
    const lines: string[] = [];
    lines.push("PLANNING ANALYTICAL PROCEDURES (ISA 520)");
    lines.push(`Analysis Date: ${new Date(analyticsResult.analysisDate).toLocaleString()}`);
    lines.push(`Analyzed By: ${analyticsResult.analyzedBy || 'N/A'}`);
    lines.push(`Overall Materiality: ${analyticsResult.overallMateriality?.toLocaleString()}`);
    lines.push(`Performance Materiality: ${analyticsResult.performanceMateriality?.toLocaleString()}`);
    lines.push("");

    lines.push("HORIZONTAL ANALYSIS (TREND & MOVEMENT)");
    lines.push("FS Head\tPrior Year\tCurrent Year\tMovement\t% Change\tStatus\tMaterial");
    analyticsResult.trendAnalysis?.forEach(t => {
      lines.push(`${t.fsHeadLabel}\t${t.priorYear}\t${t.currentYear}\t${t.movement}\t${t.movementPercentage}%\t${t.status}\t${t.materialityFlag ? 'Yes' : 'No'}`);
    });
    lines.push("");

    if (analyticsResult.verticalAnalysis?.length) {
      lines.push("VERTICAL ANALYSIS");
      lines.push("FS Head\tCurrent Year\t% of Revenue\t% of Total Assets\tComposition Shift");
      analyticsResult.verticalAnalysis.forEach(v => {
        lines.push(`${v.fsHeadLabel}\t${v.currentYear}\t${v.pctOfRevenue ?? '-'}\t${v.pctOfTotalAssets ?? '-'}\t${v.compositionShift ?? '-'}`);
      });
      lines.push("");
    }

    lines.push("RATIO ANALYSIS");
    lines.push("Ratio\tCategory\tPrior Year\tCurrent Year\tIndustry Avg\tVariance\tStatus");
    analyticsResult.ratioAnalysis?.forEach(r => {
      lines.push(`${r.ratioName}\t${r.category}\t${r.priorYear}\t${r.currentYear}\t${r.industryAverage ?? '-'}\t${r.variance}\t${r.status}`);
    });
    lines.push("");

    if (analyticsResult.significantFluctuations?.length) {
      lines.push("SIGNIFICANT FLUCTUATIONS");
      analyticsResult.significantFluctuations.forEach(f => {
        lines.push(`${f.fsHeadLabel}: ${f.natureOfFluctuation} | Risk: ${f.riskImpact} | Assertions: ${f.affectedAssertions.join(', ')}`);
      });
      lines.push("");
    }

    if (narration) {
      lines.push("PLANNING NARRATION");
      lines.push(`Conclusion: ${narration.overallConclusion}`);
      lines.push(`Movements: ${narration.significantMovements}`);
      lines.push(`Implications: ${narration.planningImplications}`);
      lines.push(`Response: ${narration.proposedAuditResponse}`);
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ISA520_Analytics_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [analyticsResult, narration]);

  const maxVariance = useMemo(() => {
    if (!analyticsResult?.trendAnalysis) return 100;
    return Math.max(...analyticsResult.trendAnalysis.map(t => Math.abs(t.movementPercentage)), 100);
  }, [analyticsResult]);

  const filteredTrend = useMemo(() => {
    if (!analyticsResult?.trendAnalysis) return [];
    if (trendFilter === "all") return analyticsResult.trendAnalysis;
    if (trendFilter === "material") return analyticsResult.trendAnalysis.filter(t => t.materialityFlag);
    if (trendFilter === "flagged") return analyticsResult.trendAnalysis.filter(t => t.status !== 'Expected');
    return analyticsResult.trendAnalysis;
  }, [analyticsResult, trendFilter]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
        <span className="text-sm text-muted-foreground">Loading analytics...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Planning Analytical Procedures (ISA 520)
          </h2>
          {analyticsResult && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Last run: {new Date(analyticsResult.analysisDate).toLocaleString()}
              {analyticsResult.analyzedBy && ` by ${analyticsResult.analyzedBy}`}
              {' · '}Materiality: {analyticsResult.overallMateriality?.toLocaleString()} / PM: {analyticsResult.performanceMateriality?.toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {analyticsResult && (
            <Button variant="outline" size="sm" onClick={exportAnalytics}>
              <Download className="h-3.5 w-3.5 mr-1" />
              Export
            </Button>
          )}
          <Button
            variant="outline" size="sm"
            onClick={runAnalytics}
            disabled={isRunning || readOnly}
          >
            {isRunning ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Brain className="h-3.5 w-3.5 mr-1" />}
            {analyticsResult ? 'Refresh Analytics' : 'Run Analytics'}
          </Button>
          {analyticsResult?.riskMatrixUpdates && analyticsResult.riskMatrixUpdates.length > 0 && (
            <Button size="sm" onClick={updateRiskMatrix} disabled={isUpdatingMatrix || readOnly}>
              {isUpdatingMatrix ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
              Update Risk Matrix
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg text-sm flex items-center gap-2 text-red-700 dark:text-red-300">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {readOnly && analyticsResult && (
        <div className="p-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          Planning is locked. Analytics are shown in read-only mode.
        </div>
      )}

      {!analyticsResult ? (
        <Card>
          <CardContent className="py-2 text-center">
            <Activity className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40" />
            <p className="text-sm font-medium mb-1">No Analytics Available</p>
            <p className="text-xs text-muted-foreground mb-3">
              {readOnly
                ? "No analytical procedures have been run for this engagement yet."
                : "Click \"Run Analytics\" to analyze TB/GL data and identify significant fluctuations per ISA 520."
              }
            </p>
            {!readOnly && (
              <Button size="sm" onClick={runAnalytics} disabled={isRunning}>
                {isRunning ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Brain className="h-3.5 w-3.5 mr-1" />}
                Run Analytics Now
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <SummaryCard icon={<FileText className="h-4 w-4 text-blue-500" />} label="Accounts Analyzed" value={analyticsResult.totalAccountsAnalyzed} />
            <SummaryCard icon={<AlertTriangle className="h-4 w-4 text-amber-500" />} label="Fluctuations" value={analyticsResult.totalFluctuationsIdentified} variant={analyticsResult.totalFluctuationsIdentified > 0 ? "warning" : "default"} />
            <SummaryCard icon={<ShieldAlert className="h-4 w-4 text-red-500" />} label="Risk-Indicative" value={analyticsResult.riskIndicativeCount} variant={analyticsResult.riskIndicativeCount > 0 ? "danger" : "default"} />
            <SummaryCard icon={<PieChart className="h-4 w-4 text-purple-500" />} label="Ratios Out of Range" value={analyticsResult.ratiosOutOfRange} variant={analyticsResult.ratiosOutOfRange > 0 ? "warning" : "default"} />
            <SummaryCard icon={<Link2 className="h-4 w-4 text-green-500" />} label="Matrix Updates" value={analyticsResult.riskMatrixUpdatesCount} />
            <SummaryCard icon={<Scale className="h-4 w-4 text-indigo-500" />} label="Strategy Impacts" value={analyticsResult.auditStrategyImpact?.length || 0} />
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full justify-start overflow-x-auto flex-nowrap h-auto p-1">
              <TabsTrigger value="horizontal" className="text-xs gap-1">
                <ArrowUpDown className="h-3 w-3" />Horizontal
              </TabsTrigger>
              <TabsTrigger value="vertical" className="text-xs gap-1">
                <Percent className="h-3 w-3" />Vertical
              </TabsTrigger>
              <TabsTrigger value="ratios" className="text-xs gap-1">
                <BarChart3 className="h-3 w-3" />Ratios
              </TabsTrigger>
              <TabsTrigger value="reasonableness" className="text-xs gap-1">
                <Calculator className="h-3 w-3" />Reasonableness
              </TabsTrigger>
              <TabsTrigger value="fluctuations" className="text-xs gap-1">
                <AlertTriangle className="h-3 w-3" />Fluctuations
                {analyticsResult.totalFluctuationsIdentified > 0 && (
                  <Badge variant="destructive" className="ml-0.5 text-[10px] px-1 py-0">{analyticsResult.totalFluctuationsIdentified}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="risk-linkage" className="text-xs gap-1">
                <Link2 className="h-3 w-3" />Risk Linkage
              </TabsTrigger>
              <TabsTrigger value="narration" className="text-xs gap-1">
                <FileText className="h-3 w-3" />Narration
              </TabsTrigger>
            </TabsList>

            <TabsContent value="horizontal" className="mt-3">
              <Card>
                <CardHeader className="py-2 px-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Horizontal Analysis — Current vs Prior Year</CardTitle>
                    <Select value={trendFilter} onValueChange={setTrendFilter}>
                      <SelectTrigger className="w-[140px] h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Items</SelectItem>
                        <SelectItem value="material">Material Only</SelectItem>
                        <SelectItem value="flagged">Flagged Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="w-full">
                    <Table>
                      <TableHeader>
                        <TableRow className="text-xs">
                          <TableHead className="w-[200px]">FS Line Item</TableHead>
                          <TableHead className="text-right">Prior Year</TableHead>
                          <TableHead className="text-right">Current Year</TableHead>
                          <TableHead className="text-right">Movement</TableHead>
                          <TableHead className="w-[160px]">% Change</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Materiality</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTrend.map((item, idx) => (
                          <TableRow key={idx} className={item.status === 'Risk-Indicative' ? 'bg-red-50/50 dark:bg-red-950/10' : item.status === 'Requires Explanation' ? 'bg-amber-50/50 dark:bg-amber-950/10' : ''}>
                            <TableCell className="font-medium text-xs">{item.fsHeadLabel}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{formatAccounting(item.priorYear)}</TableCell>
                            <TableCell className="text-right font-mono text-xs font-semibold">{formatAccounting(item.currentYear)}</TableCell>
                            <TableCell className={`text-right font-mono text-xs ${item.movement >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {item.movement >= 0 ? '+' : ''}{formatAccounting(item.movement)}
                            </TableCell>
                            <TableCell><VarianceBar value={item.movementPercentage} max={maxVariance} /></TableCell>
                            <TableCell><Badge variant={getStatusBadgeVariant(item.status)} className="text-[10px]">{item.status}</Badge></TableCell>
                            <TableCell>
                              {item.materialityFlag
                                ? <Badge variant="destructive" className="text-[10px]">Above PM</Badge>
                                : <Badge variant="outline" className="text-[10px]">Below PM</Badge>
                              }
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="vertical" className="mt-3">
              <Card>
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-sm">Vertical Analysis — Composition & Structure</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {analyticsResult.verticalAnalysis && analyticsResult.verticalAnalysis.length > 0 ? (
                    <ScrollArea className="w-full">
                      <Table>
                        <TableHeader>
                          <TableRow className="text-xs">
                            <TableHead className="w-[200px]">FS Line Item</TableHead>
                            <TableHead className="text-right">Current Year</TableHead>
                            <TableHead className="text-right">% of Revenue</TableHead>
                            <TableHead className="text-right">PY % of Revenue</TableHead>
                            <TableHead className="text-right">% of Total Assets</TableHead>
                            <TableHead className="text-right">PY % of Assets</TableHead>
                            <TableHead className="text-right">% of Expenses</TableHead>
                            <TableHead className="text-right">Shift (pp)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {analyticsResult.verticalAnalysis.map((item, idx) => {
                            const hasData = item.pctOfRevenue !== null || item.pctOfTotalAssets !== null || item.pctOfTotalExpenses !== null;
                            if (!hasData) return null;
                            const shiftAbs = Math.abs(item.compositionShift || 0);
                            return (
                              <TableRow key={idx} className={shiftAbs > 5 ? 'bg-amber-50/50 dark:bg-amber-950/10' : ''}>
                                <TableCell className="font-medium text-xs">{item.fsHeadLabel}</TableCell>
                                <TableCell className="text-right font-mono text-xs">{formatAccounting(item.currentYear)}</TableCell>
                                <TableCell className="text-right font-mono text-xs">{item.pctOfRevenue !== null ? `${item.pctOfRevenue.toFixed(1)}%` : '—'}</TableCell>
                                <TableCell className="text-right font-mono text-xs text-muted-foreground">{item.priorPctOfRevenue !== null ? `${item.priorPctOfRevenue.toFixed(1)}%` : '—'}</TableCell>
                                <TableCell className="text-right font-mono text-xs">{item.pctOfTotalAssets !== null ? `${item.pctOfTotalAssets.toFixed(1)}%` : '—'}</TableCell>
                                <TableCell className="text-right font-mono text-xs text-muted-foreground">{item.priorPctOfTotalAssets !== null ? `${item.priorPctOfTotalAssets.toFixed(1)}%` : '—'}</TableCell>
                                <TableCell className="text-right font-mono text-xs">{item.pctOfTotalExpenses !== null ? `${item.pctOfTotalExpenses.toFixed(1)}%` : '—'}</TableCell>
                                <TableCell className={`text-right font-mono text-xs font-semibold ${shiftAbs > 5 ? 'text-red-600' : shiftAbs > 2 ? 'text-amber-600' : 'text-green-600'}`}>
                                  {item.compositionShift !== null ? `${item.compositionShift >= 0 ? '+' : ''}${item.compositionShift.toFixed(1)}pp` : '—'}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                      <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                  ) : (
                    <div className="py-3 text-center text-sm text-muted-foreground">Vertical analysis data not available. Run analytics to generate.</div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="ratios" className="mt-3 space-y-3">
              {(['Liquidity', 'Profitability', 'Leverage', 'Efficiency', 'Coverage'] as const).map(category => {
                const categoryRatios = analyticsResult.ratioAnalysis?.filter(r => r.category === category) || [];
                if (categoryRatios.length === 0) return null;
                return (
                  <Card key={category}>
                    <CardHeader className="py-2 px-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">{category}</Badge>
                        {categoryRatios.some(r => r.status !== 'Expected') && (
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow className="text-xs">
                            <TableHead className="w-[200px]">Ratio</TableHead>
                            <TableHead className="text-right">Prior Year</TableHead>
                            <TableHead className="text-right">Current Year</TableHead>
                            <TableHead className="text-right">Industry Avg</TableHead>
                            <TableHead className="text-right">Variance</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Interpretation</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {categoryRatios.map((ratio, idx) => (
                            <TableRow key={idx} className={ratio.status === 'Risk-Indicative' ? 'bg-red-50/50 dark:bg-red-950/10' : ''}>
                              <TableCell className="text-xs">
                                <div className="font-medium">{ratio.ratioName}</div>
                                {ratio.formula && <div className="text-[10px] text-muted-foreground">{ratio.formula}</div>}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs">{ratio.priorYear.toFixed(2)}</TableCell>
                              <TableCell className="text-right font-mono text-xs font-semibold">{ratio.currentYear.toFixed(2)}</TableCell>
                              <TableCell className="text-right font-mono text-xs text-muted-foreground">{ratio.industryAverage?.toFixed(2) || '—'}</TableCell>
                              <TableCell className={`text-right font-mono text-xs ${ratio.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {ratio.variance >= 0 ? '+' : ''}{ratio.variance.toFixed(2)}
                              </TableCell>
                              <TableCell><Badge variant={getStatusBadgeVariant(ratio.status)} className="text-[10px]">{ratio.status}</Badge></TableCell>
                              <TableCell className="max-w-[200px] text-xs text-muted-foreground truncate" title={ratio.interpretation}>{ratio.interpretation}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>

            <TabsContent value="reasonableness" className="mt-3">
              <Card>
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-sm">Reasonableness Tests</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {analyticsResult.reasonablenessTests && analyticsResult.reasonablenessTests.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow className="text-xs">
                          <TableHead className="w-[180px]">Test</TableHead>
                          <TableHead>Expected Relationship</TableHead>
                          <TableHead>Actual Result</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Audit Implication</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analyticsResult.reasonablenessTests.map((test, idx) => (
                          <TableRow key={idx} className={test.status === 'Inconsistent' ? 'bg-red-50/50 dark:bg-red-950/10' : ''}>
                            <TableCell className="text-xs">
                              <div className="font-medium">{test.testName}</div>
                              <div className="text-[10px] text-muted-foreground">{test.description}</div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[200px]">{test.expectedRelationship}</TableCell>
                            <TableCell className="text-xs font-mono max-w-[200px]">{test.actualResult}</TableCell>
                            <TableCell>
                              <Badge variant={getStatusBadgeVariant(test.status)} className="text-[10px]">
                                {test.status === 'Consistent' && <CheckCircle2 className="h-3 w-3 mr-0.5" />}
                                {test.status === 'Inconsistent' && <AlertTriangle className="h-3 w-3 mr-0.5" />}
                                {test.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[200px]">{test.auditImplication}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="py-3 text-center text-sm text-muted-foreground">No reasonableness tests available. Run analytics to generate.</div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="fluctuations" className="mt-3 space-y-3">
              {analyticsResult.significantFluctuations && analyticsResult.significantFluctuations.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {analyticsResult.significantFluctuations.map((fluct, idx) => (
                      <Card key={idx} className={`border-l-4 ${fluct.significantRiskFlag ? 'border-l-red-500' : 'border-l-amber-500'}`}>
                        <CardHeader className="py-2 px-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm">{fluct.fsHeadLabel}</CardTitle>
                            <div className="flex gap-1">
                              {fluct.fraudConsideration && <Badge variant="destructive" className="text-[10px]">Fraud Risk</Badge>}
                              {fluct.significantRiskFlag && <Badge variant="destructive" className="text-[10px]">Significant</Badge>}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="px-3 pb-3 space-y-1.5 text-xs">
                          <div><span className="text-muted-foreground">Nature: </span><span className="font-medium">{fluct.natureOfFluctuation}</span></div>
                          <div className="flex gap-2">
                            <span className="text-muted-foreground">Risk: </span>
                            <Badge variant="outline" className="text-[10px]">{fluct.riskLevel}</Badge>
                            <span className={getRiskImpactColor(fluct.riskImpact)}>{fluct.riskImpact}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Assertions: </span>
                            <span className="inline-flex flex-wrap gap-0.5">
                              {fluct.affectedAssertions.map((a, i) => <Badge key={i} variant="secondary" className="text-[10px]">{a}</Badge>)}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Possible Causes: </span>
                            <ul className="list-disc list-inside text-[11px] mt-0.5 ml-2">
                              {fluct.possibleCauses.map((c, i) => <li key={i}>{c}</li>)}
                            </ul>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {analyticsResult.auditStrategyImpact && analyticsResult.auditStrategyImpact.length > 0 && (
                    <Card>
                      <CardHeader className="py-2 px-3">
                        <CardTitle className="text-sm">Audit Strategy Impact</CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <ScrollArea className="w-full">
                          <Table>
                            <TableHeader>
                              <TableRow className="text-xs">
                                <TableHead>FS Head</TableHead>
                                <TableHead>Nature Impact</TableHead>
                                <TableHead>Timing</TableHead>
                                <TableHead>Extent Impact</TableHead>
                                <TableHead>Controls</TableHead>
                                <TableHead>Conclusion</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {analyticsResult.auditStrategyImpact.map((impact, idx) => (
                                <TableRow key={idx}>
                                  <TableCell className="font-medium text-xs">{impact.fsHeadLabel}</TableCell>
                                  <TableCell className="text-xs">{impact.impactOnNature}</TableCell>
                                  <TableCell><Badge variant="outline" className="text-[10px]">{impact.impactOnTiming}</Badge></TableCell>
                                  <TableCell className="text-xs">{impact.impactOnExtent}</TableCell>
                                  <TableCell className="text-xs max-w-[150px] truncate" title={impact.controlsRelianceImpact}>{impact.controlsRelianceImpact}</TableCell>
                                  <TableCell className="text-xs max-w-[150px] truncate" title={impact.planningConclusion}>{impact.planningConclusion}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                          <ScrollBar orientation="horizontal" />
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : (
                <Card>
                  <CardContent className="py-3 text-center">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500/50" />
                    <p className="text-sm font-medium">No Significant Fluctuations</p>
                    <p className="text-xs text-muted-foreground">All items are within expected thresholds.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="risk-linkage" className="mt-3">
              <Card>
                <CardHeader className="py-2 px-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Risk Matrix Updates from Analytics</CardTitle>
                    {analyticsResult.riskMatrixUpdates && analyticsResult.riskMatrixUpdates.length > 0 && !readOnly && (
                      <Button size="sm" onClick={updateRiskMatrix} disabled={isUpdatingMatrix} className="h-7 text-xs">
                        {isUpdatingMatrix ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                        Apply to Risk Matrix
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {analyticsResult.riskMatrixUpdates && analyticsResult.riskMatrixUpdates.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow className="text-xs">
                          <TableHead>FS Head</TableHead>
                          <TableHead>Assertion</TableHead>
                          <TableHead>Previous</TableHead>
                          <TableHead>
                            <div className="flex items-center gap-1">
                              <TrendingUp className="h-3 w-3" />Proposed
                            </div>
                          </TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead>Ref</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analyticsResult.riskMatrixUpdates.map((update, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium text-xs">{update.fsHeadKey.replace(/_/g, ' ')}</TableCell>
                            <TableCell className="text-xs">{update.assertion}</TableCell>
                            <TableCell>
                              <Badge variant={update.previousRiskRating === 'High' ? 'destructive' : update.previousRiskRating === 'Medium' ? 'secondary' : 'outline'} className="text-[10px]">
                                {update.previousRiskRating}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={update.updatedRiskRating === 'High' ? 'destructive' : update.updatedRiskRating === 'Medium' ? 'secondary' : 'outline'} className="text-[10px]">
                                {update.updatedRiskRating}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs max-w-[200px] truncate" title={update.changeReason}>{update.changeReason}</TableCell>
                            <TableCell className="font-mono text-[10px] text-muted-foreground">{update.analyticsReference}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="py-3 text-center text-sm text-muted-foreground">No risk matrix updates proposed.</div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="narration" className="mt-3">
              <Card>
                <CardHeader className="py-2 px-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Planning Analytical Review Conclusion</CardTitle>
                    {narration && !readOnly && (
                      <Button size="sm" onClick={saveNarration} disabled={isSavingNarration} className="h-7 text-xs">
                        {isSavingNarration ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
                        Save Narration
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {narration ? (
                    <>
                      <NarrationField label="Overall Conclusion" value={narration.overallConclusion} readOnly={readOnly} onChange={(v) => setNarration(prev => prev ? {...prev, overallConclusion: v} : null)} />
                      <NarrationField label="Significant Movements" value={narration.significantMovements} readOnly={readOnly} onChange={(v) => setNarration(prev => prev ? {...prev, significantMovements: v} : null)} />
                      <NarrationField label="Possible Reasons" value={narration.possibleReasons} readOnly={readOnly} onChange={(v) => setNarration(prev => prev ? {...prev, possibleReasons: v} : null)} />
                      <NarrationField label="Planning Implications" value={narration.planningImplications} readOnly={readOnly} onChange={(v) => setNarration(prev => prev ? {...prev, planningImplications: v} : null)} />
                      <NarrationField label="Proposed Audit Response" value={narration.proposedAuditResponse} readOnly={readOnly} onChange={(v) => setNarration(prev => prev ? {...prev, proposedAuditResponse: v} : null)} />
                      <NarrationField label="Risk Assessment Linkage" value={narration.riskAssessmentLinkage} readOnly={readOnly} onChange={(v) => setNarration(prev => prev ? {...prev, riskAssessmentLinkage: v} : null)} />
                      {narration.lastUpdated && (
                        <p className="text-[10px] text-muted-foreground text-right">
                          Last updated: {new Date(narration.lastUpdated).toLocaleString()}
                          {narration.updatedBy && ` by ${narration.updatedBy}`}
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="py-3 text-center text-sm text-muted-foreground">
                      Run analytics to generate planning narration.
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value, variant = "default" }: { icon: React.ReactNode; label: string; value: number; variant?: "default" | "warning" | "danger" }) {
  return (
    <Card className={variant === "danger" ? "border-red-200 dark:border-red-800" : variant === "warning" ? "border-amber-200 dark:border-amber-800" : ""}>
      <CardContent className="p-3 flex items-center gap-2">
        {icon}
        <div>
          <p className="text-lg font-bold leading-none">{value}</p>
          <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function NarrationField({ label, value, readOnly, onChange }: { label: string; value: string; readOnly?: boolean; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium">{label}</Label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        rows={3}
        className="text-xs resize-y"
      />
    </div>
  );
}
