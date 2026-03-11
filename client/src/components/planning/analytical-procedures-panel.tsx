import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatAccounting } from "@/lib/formatters";
import {
  Activity, AlertTriangle, AlertCircle, TrendingUp,
  FileSpreadsheet, BarChart3, Target, RefreshCw,
  Brain, Briefcase, Loader2, Link2,
} from "lucide-react";

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
  ratioAnalysis?: Array<{
    ratioName: string;
    category: string;
    priorYear: number;
    currentYear: number;
    industryAverage?: number;
    variance: number;
    status: string;
    interpretation: string;
  }>;
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
  analysisDate: string;
  totalFluctuationsIdentified: number;
  riskIndicativeCount: number;
  riskMatrixUpdatesCount: number;
}

interface AnalyticalProceduresPanelProps {
  engagementId: string;
  readOnly?: boolean;
}

const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case 'Risk-Indicative': return 'destructive';
    case 'Requires Explanation': return 'secondary';
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

export function AnalyticalProceduresPanel({ engagementId, readOnly }: AnalyticalProceduresPanelProps) {
  const { toast } = useToast();
  const [analyticsResult, setAnalyticsResult] = useState<PlanningAnalyticsResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUpdatingMatrix, setIsUpdatingMatrix] = useState(false);

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
      toast({
        title: "Analytical Procedures Complete",
        description: `Identified ${result.totalFluctuationsIdentified} significant fluctuations, ${result.riskIndicativeCount} risk-indicative items.`,
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
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Failed to update risk matrix");
      }
      const result = await response.json();
      toast({ title: "Risk Matrix Updated", description: result.message || `Updated ${result.updatedCount} risk matrix entries.` });
      queryClient.invalidateQueries({ queryKey: ['/api/ai-risk-assessment', engagementId] });
    } catch (err) {
      toast({ title: "Update Failed", description: err instanceof Error ? err.message : "Failed to update risk matrix.", variant: "destructive" });
    } finally {
      setIsUpdatingMatrix(false);
    }
  }, [engagementId, analyticsResult, toast]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Planning Analytical Procedures (ISA 520)
            </CardTitle>
            <CardDescription>ISA 520 Compliant - Analytical procedures for risk identification and planning</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={runAnalytics}
              disabled={isRunning || readOnly}
            >
              {isRunning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Brain className="h-4 w-4 mr-2" />}
              Run Analytical Procedures
            </Button>
            <Button
              size="sm"
              onClick={updateRiskMatrix}
              disabled={isUpdatingMatrix || !analyticsResult?.riskMatrixUpdates?.length || readOnly}
            >
              {isUpdatingMatrix ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Update Risk Matrix
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg mb-4">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {!analyticsResult ? (
          <div className="text-center py-12 text-muted-foreground">
            <Activity className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium mb-2">No Analytical Procedures Run</p>
            <p className="text-sm">Click "Run Analytical Procedures" to analyze financial data and identify significant fluctuations per ISA 520.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="border-blue-200 dark:border-blue-800">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">FS Heads Analyzed</p>
                      <p className="text-2xl font-bold">{analyticsResult.fsHeadExpectations?.length || 0}</p>
                    </div>
                    <FileSpreadsheet className="h-8 w-8 text-blue-500 opacity-50" />
                  </div>
                </CardContent>
              </Card>
              <Card className="border-amber-200 dark:border-amber-800">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Fluctuations Found</p>
                      <p className="text-2xl font-bold">{analyticsResult.totalFluctuationsIdentified}</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-amber-500 opacity-50" />
                  </div>
                </CardContent>
              </Card>
              <Card className="border-red-200 dark:border-red-800">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Risk-Indicative</p>
                      <p className="text-2xl font-bold text-red-600">{analyticsResult.riskIndicativeCount}</p>
                    </div>
                    <AlertTriangle className="h-8 w-8 text-red-500 opacity-50" />
                  </div>
                </CardContent>
              </Card>
              <Card className="border-green-200 dark:border-green-800">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Matrix Updates</p>
                      <p className="text-2xl font-bold text-green-600">{analyticsResult.riskMatrixUpdatesCount}</p>
                    </div>
                    <RefreshCw className="h-8 w-8 text-green-500 opacity-50" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="text-xs text-muted-foreground">
              Analysis Date: {new Date(analyticsResult.analysisDate).toLocaleString()}
            </div>

            <Accordion type="multiple" defaultValue={["section-a", "section-b"]} className="space-y-4">
              <AccordionItem value="section-a" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    <span className="font-medium">Section A: FS Head Expectations</span>
                    <Badge variant="secondary" className="ml-2">{analyticsResult.fsHeadExpectations?.length || 0} Items</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-4">
                  <ScrollArea className="w-full">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>FS Head</TableHead>
                          <TableHead className="text-right">Prior Year</TableHead>
                          <TableHead className="text-right">Expected</TableHead>
                          <TableHead className="text-right">Current Year</TableHead>
                          <TableHead>Basis</TableHead>
                          <TableHead>Rationale</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analyticsResult.fsHeadExpectations?.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{item.fsHeadLabel}</TableCell>
                            <TableCell className="text-right font-mono">{formatAccounting(item.priorYearBalance)}</TableCell>
                            <TableCell className="text-right font-mono text-muted-foreground">{formatAccounting(item.expectedBalance)}</TableCell>
                            <TableCell className="text-right font-mono font-semibold">{formatAccounting(item.currentYearBalance)}</TableCell>
                            <TableCell><Badge variant="outline">{item.expectationBasis}</Badge></TableCell>
                            <TableCell className="max-w-xs truncate" title={item.expectationRationale}>{item.expectationRationale}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="section-b" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    <span className="font-medium">Section B: Trend & Movement Analysis</span>
                    <Badge variant="secondary" className="ml-2">{analyticsResult.trendAnalysis?.length || 0} Items</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-4">
                  <ScrollArea className="w-full">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>FS Head</TableHead>
                          <TableHead className="text-right">Prior Year</TableHead>
                          <TableHead className="text-right">Current Year</TableHead>
                          <TableHead className="text-right">Movement</TableHead>
                          <TableHead className="text-right">% Change</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Material</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analyticsResult.trendAnalysis?.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono text-xs">{item.id}</TableCell>
                            <TableCell className="font-medium">{item.fsHeadLabel}</TableCell>
                            <TableCell className="text-right font-mono">{formatAccounting(item.priorYear)}</TableCell>
                            <TableCell className="text-right font-mono">{formatAccounting(item.currentYear)}</TableCell>
                            <TableCell className={`text-right font-mono ${item.movement >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {item.movement >= 0 ? '+' : ''}{formatAccounting(item.movement)}
                            </TableCell>
                            <TableCell className={`text-right font-semibold ${Math.abs(item.movementPercentage) > 20 ? 'text-red-600' : Math.abs(item.movementPercentage) > 10 ? 'text-amber-600' : 'text-green-600'}`}>
                              {item.movementPercentage >= 0 ? '+' : ''}{item.movementPercentage.toFixed(1)}%
                            </TableCell>
                            <TableCell><Badge variant={getStatusBadgeVariant(item.status)}>{item.status}</Badge></TableCell>
                            <TableCell>
                              {item.materialityFlag ? <Badge variant="destructive">Material</Badge> : <Badge variant="outline">Below PM</Badge>}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="section-c" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    <span className="font-medium">Section C: Ratio Analysis Matrix</span>
                    <Badge variant="secondary" className="ml-2">{analyticsResult.ratioAnalysis?.length || 0} Ratios</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-4">
                  {(['Liquidity', 'Profitability', 'Leverage', 'Efficiency', 'Coverage'] as const).map(category => {
                    const categoryRatios = analyticsResult.ratioAnalysis?.filter(r => r.category === category) || [];
                    if (categoryRatios.length === 0) return null;
                    return (
                      <div key={category} className="mb-3">
                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                          <Badge variant="secondary">{category}</Badge>
                        </h4>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Ratio</TableHead>
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
                              <TableRow key={idx}>
                                <TableCell className="font-medium">{ratio.ratioName}</TableCell>
                                <TableCell className="text-right font-mono">{ratio.priorYear.toFixed(2)}</TableCell>
                                <TableCell className="text-right font-mono font-semibold">{ratio.currentYear.toFixed(2)}</TableCell>
                                <TableCell className="text-right font-mono text-muted-foreground">{ratio.industryAverage?.toFixed(2) || '-'}</TableCell>
                                <TableCell className={`text-right font-mono ${ratio.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {ratio.variance >= 0 ? '+' : ''}{ratio.variance.toFixed(2)}
                                </TableCell>
                                <TableCell><Badge variant={getStatusBadgeVariant(ratio.status)}>{ratio.status}</Badge></TableCell>
                                <TableCell className="max-w-xs truncate" title={ratio.interpretation}>{ratio.interpretation}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    );
                  })}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="section-d" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <span className="font-medium">Section D: Significant Fluctuations</span>
                    <Badge variant="destructive" className="ml-2">{analyticsResult.significantFluctuations?.length || 0} Identified</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-4">
                  {analyticsResult.significantFluctuations?.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No significant fluctuations identified.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {analyticsResult.significantFluctuations?.map((fluct, idx) => (
                        <Card key={idx} className={`border-l-4 ${fluct.significantRiskFlag ? 'border-l-red-500' : 'border-l-amber-500'}`}>
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm">{fluct.fsHeadLabel}</CardTitle>
                              <div className="flex gap-1">
                                {fluct.fraudConsideration && <Badge variant="destructive" className="text-xs">Fraud Risk</Badge>}
                                {fluct.significantRiskFlag && <Badge variant="destructive" className="text-xs">Significant</Badge>}
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-2 text-sm">
                            <div><span className="text-muted-foreground">Nature: </span><span className="font-medium">{fluct.natureOfFluctuation}</span></div>
                            <div><span className="text-muted-foreground">Risk Level: </span><Badge variant="outline">{fluct.riskLevel}</Badge></div>
                            <div><span className="text-muted-foreground">Risk Impact: </span><span className={getRiskImpactColor(fluct.riskImpact)}>{fluct.riskImpact}</span></div>
                            <div>
                              <span className="text-muted-foreground">Affected Assertions: </span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {fluct.affectedAssertions.map((a, i) => <Badge key={i} variant="secondary" className="text-xs">{a}</Badge>)}
                              </div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Possible Causes: </span>
                              <ul className="list-disc list-inside text-xs mt-1">
                                {fluct.possibleCauses.map((c, i) => <li key={i}>{c}</li>)}
                              </ul>
                            </div>
                            <div className="pt-2 border-t text-xs text-muted-foreground italic">{fluct.documentedJustification}</div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="section-e" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4" />
                    <span className="font-medium">Section E: Risk Linkage & Matrix Updates</span>
                    <Badge variant="secondary" className="ml-2">{analyticsResult.riskMatrixUpdates?.length || 0} Updates</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-4">
                  {analyticsResult.riskMatrixUpdates?.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No risk matrix updates required.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>FS Head</TableHead>
                          <TableHead>Assertion</TableHead>
                          <TableHead>Previous Rating</TableHead>
                          <TableHead>Updated Rating</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead>Analytics Ref</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analyticsResult.riskMatrixUpdates?.map((update, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{update.fsHeadKey}</TableCell>
                            <TableCell>{update.assertion}</TableCell>
                            <TableCell>
                              <Badge variant={update.previousRiskRating === 'High' ? 'destructive' : update.previousRiskRating === 'Medium' ? 'secondary' : 'outline'}>
                                {update.previousRiskRating}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={update.updatedRiskRating === 'High' ? 'destructive' : update.updatedRiskRating === 'Medium' ? 'secondary' : 'outline'}>
                                {update.updatedRiskRating}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-xs truncate" title={update.changeReason}>{update.changeReason}</TableCell>
                            <TableCell className="font-mono text-xs">{update.analyticsReference}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="section-f" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    <span className="font-medium">Section F: Audit Strategy Impact</span>
                    <Badge variant="secondary" className="ml-2">{analyticsResult.auditStrategyImpact?.length || 0} Areas</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-4">
                  {analyticsResult.auditStrategyImpact?.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No audit strategy impacts identified.</p>
                  ) : (
                    <ScrollArea className="w-full">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>FS Head</TableHead>
                            <TableHead>Impact on Nature</TableHead>
                            <TableHead>Timing</TableHead>
                            <TableHead>Impact on Extent</TableHead>
                            <TableHead>Controls Impact</TableHead>
                            <TableHead>Planning Conclusion</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {analyticsResult.auditStrategyImpact?.map((impact, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">{impact.fsHeadLabel}</TableCell>
                              <TableCell>{impact.impactOnNature}</TableCell>
                              <TableCell><Badge variant="outline">{impact.impactOnTiming}</Badge></TableCell>
                              <TableCell>{impact.impactOnExtent}</TableCell>
                              <TableCell className="max-w-xs truncate" title={impact.controlsRelianceImpact}>{impact.controlsRelianceImpact}</TableCell>
                              <TableCell className="max-w-xs truncate" title={impact.planningConclusion}>{impact.planningConclusion}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
