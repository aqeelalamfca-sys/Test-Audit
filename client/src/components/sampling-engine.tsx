import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { Loader2, Download, Play, History, Target, Shuffle, BarChart3, RefreshCw, Trash2, FileSpreadsheet } from "lucide-react";
import { formatAccounting } from "@/lib/formatters";

interface SamplingConfig {
  engagementId: string;
  method: string;
  sampleSize: number;
  confidenceLevel?: number;
  materialityThreshold?: number;
  tolerableError?: number;
  expectedError?: number;
  randomSeed?: number;
  stratificationRanges?: { min: number; max: number; name: string }[];
  targetedCriteria?: {
    highValue?: boolean;
    highValueThreshold?: number;
    unusualJournals?: boolean;
    weekendPostings?: boolean;
    roundAmounts?: boolean;
    relatedPartyKeywords?: string[];
  };
}

interface SampledItem {
  id: string;
  itemNumber: number;
  voucherNo: string | null;
  postingDate: string;
  glCode: string;
  glName: string;
  debit: string;
  credit: string;
  amount: string;
  description: string | null;
  selectionReason: string;
  stratum?: string;
}

interface SamplingRun {
  id: string;
  runNumber: number;
  runName: string;
  samplingMethod: string;
  populationCount: number;
  populationValue: string;
  sampleSize: number;
  sampleValue: string;
  coveragePercentage: string;
  samplingInterval: string | null;
  createdAt: string;
  createdBy: { id: string; fullName: string };
  _count: { items: number };
}

interface SamplingEngineProps {
  engagementId: string;
}

const SAMPLING_METHODS = [
  { value: "MONETARY_UNIT_SAMPLING", label: "Monetary Unit Sampling (MUS)", icon: BarChart3, description: "Probability proportional to size selection" },
  { value: "STATISTICAL_RANDOM", label: "Random Sampling", icon: Shuffle, description: "Simple random selection" },
  { value: "STATISTICAL_SYSTEMATIC", label: "Systematic Sampling", icon: RefreshCw, description: "Fixed interval selection" },
  { value: "STATISTICAL_STRATIFIED", label: "Stratified Sampling", icon: BarChart3, description: "Selection by amount ranges" },
  { value: "NON_STATISTICAL_JUDGMENTAL", label: "Targeted Sampling", icon: Target, description: "Selection based on specific criteria" },
];

export function SamplingEngine({ engagementId }: SamplingEngineProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("generate");
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const [config, setConfig] = useState<SamplingConfig>({
    engagementId,
    method: "STATISTICAL_RANDOM",
    sampleSize: 25,
    confidenceLevel: 95,
    materialityThreshold: 100000,
  });

  const [targetedCriteria, setTargetedCriteria] = useState({
    highValue: false,
    highValueThreshold: 100000,
    unusualJournals: false,
    weekendPostings: false,
    roundAmounts: false,
    relatedPartyKeywords: "",
  });

  const runsQuery = useQuery({
    queryKey: ["/api/sampling", engagementId, "runs"],
    queryFn: async () => {
      const response = await fetchWithAuth(`/api/sampling/${engagementId}/runs`);
      if (!response.ok) throw new Error("Failed to fetch sampling runs");
      return response.json();
    },
  });

  const samplesQuery = useQuery({
    queryKey: ["/api/sampling/run", selectedRunId, "samples"],
    queryFn: async () => {
      if (!selectedRunId) return null;
      const response = await fetchWithAuth(`/api/sampling/run/${selectedRunId}/samples`);
      if (!response.ok) throw new Error("Failed to fetch samples");
      return response.json();
    },
    enabled: !!selectedRunId,
  });

  const generateMutation = useMutation({
    mutationFn: async (requestConfig: SamplingConfig) => {
      const response = await apiRequest("POST", "/api/sampling/generate", requestConfig);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Sample Generated",
        description: `Selected ${data.sampleSize} items from ${data.populationCount} total (${Number(data.coveragePercentage).toFixed(1)}% coverage)`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/sampling", engagementId, "runs"] });
      setSelectedRunId(data.runId);
      setActiveTab("results");
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate sample",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (runId: string) => {
      const response = await apiRequest("DELETE", `/api/sampling/run/${runId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sampling Run Deleted",
        description: "The sampling run has been removed",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/sampling", engagementId, "runs"] });
      if (selectedRunId === samplesQuery.data?.run?.id) {
        setSelectedRunId(null);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete sampling run",
        variant: "destructive",
      });
    },
  });

  const handleGenerate = () => {
    const requestConfig: SamplingConfig = {
      ...config,
      engagementId,
    };

    if (config.method === "NON_STATISTICAL_JUDGMENTAL") {
      requestConfig.targetedCriteria = {
        highValue: targetedCriteria.highValue,
        highValueThreshold: targetedCriteria.highValueThreshold,
        unusualJournals: targetedCriteria.unusualJournals,
        weekendPostings: targetedCriteria.weekendPostings,
        roundAmounts: targetedCriteria.roundAmounts,
        relatedPartyKeywords: targetedCriteria.relatedPartyKeywords
          ? targetedCriteria.relatedPartyKeywords.split(",").map((k) => k.trim()).filter(Boolean)
          : undefined,
      };
    }

    generateMutation.mutate(requestConfig);
  };

  const handleExport = (runId: string) => {
    window.open(`/api/sampling/run/${runId}/export`, "_blank");
  };


  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getMethodLabel = (method: string) => {
    return SAMPLING_METHODS.find((m) => m.value === method)?.label || method;
  };

  const runs: SamplingRun[] = runsQuery.data?.runs || [];
  const samples: SampledItem[] = samplesQuery.data?.items || [];
  const currentRun = samplesQuery.data?.run;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Sampling Engine
            </CardTitle>
            <CardDescription>ISA 530 compliant audit sampling from GL transactions</CardDescription>
          </div>
          <Badge variant="outline">ISA 530</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="generate" data-testid="tab-generate">
              <Play className="h-4 w-4 mr-1" />
              Generate Sample
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">
              <History className="h-4 w-4 mr-1" />
              History ({runs.length})
            </TabsTrigger>
            <TabsTrigger value="results" data-testid="tab-results" disabled={!selectedRunId}>
              <BarChart3 className="h-4 w-4 mr-1" />
              Results
            </TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="space-y-2.5 mt-2.5">
            <div className="grid gap-2.5 md:grid-cols-2">
              <div className="space-y-2.5">
                <div className="space-y-2">
                  <Label htmlFor="method">Sampling Method</Label>
                  <Select
                    value={config.method}
                    onValueChange={(value) => setConfig({ ...config, method: value })}
                  >
                    <SelectTrigger id="method" data-testid="select-method">
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      {SAMPLING_METHODS.map((method) => (
                        <SelectItem key={method.value} value={method.value}>
                          <div className="flex items-center gap-2">
                            <method.icon className="h-4 w-4" />
                            <span>{method.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {SAMPLING_METHODS.find((m) => m.value === config.method)?.description}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sampleSize">Sample Size</Label>
                  <Input
                    id="sampleSize"
                    type="number"
                    min={1}
                    max={10000}
                    value={config.sampleSize}
                    onChange={(e) => setConfig({ ...config, sampleSize: parseInt(e.target.value) || 25 })}
                    data-testid="input-sample-size"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confidenceLevel">Confidence Level (%)</Label>
                  <Input
                    id="confidenceLevel"
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={config.confidenceLevel || ""}
                    onChange={(e) => setConfig({ ...config, confidenceLevel: parseFloat(e.target.value) || undefined })}
                    data-testid="input-confidence"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="materialityThreshold">Materiality Threshold</Label>
                  <Input
                    id="materialityThreshold"
                    type="number"
                    min={0}
                    value={config.materialityThreshold || ""}
                    onChange={(e) => setConfig({ ...config, materialityThreshold: parseFloat(e.target.value) || undefined })}
                    data-testid="input-materiality"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="randomSeed">Random Seed (optional)</Label>
                  <Input
                    id="randomSeed"
                    type="number"
                    value={config.randomSeed || ""}
                    onChange={(e) => setConfig({ ...config, randomSeed: parseInt(e.target.value) || undefined })}
                    placeholder="For reproducible results"
                    data-testid="input-seed"
                  />
                </div>
              </div>

              {config.method === "NON_STATISTICAL_JUDGMENTAL" && (
                <div className="space-y-2.5 border rounded-md p-2.5 bg-muted/30">
                  <h4 className="font-medium flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Targeted Selection Criteria
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="highValue"
                        checked={targetedCriteria.highValue}
                        onCheckedChange={(checked) =>
                          setTargetedCriteria({ ...targetedCriteria, highValue: !!checked })
                        }
                        data-testid="check-high-value"
                      />
                      <Label htmlFor="highValue" className="text-sm">High Value Items</Label>
                    </div>
                    {targetedCriteria.highValue && (
                      <div className="ml-6">
                        <Label htmlFor="highValueThreshold" className="text-xs">Threshold Amount</Label>
                        <Input
                          id="highValueThreshold"
                          type="number"
                          className="h-8 mt-1"
                          value={targetedCriteria.highValueThreshold}
                          onChange={(e) =>
                            setTargetedCriteria({
                              ...targetedCriteria,
                              highValueThreshold: parseInt(e.target.value) || 100000,
                            })
                          }
                          data-testid="input-high-value-threshold"
                        />
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="unusualJournals"
                        checked={targetedCriteria.unusualJournals}
                        onCheckedChange={(checked) =>
                          setTargetedCriteria({ ...targetedCriteria, unusualJournals: !!checked })
                        }
                        data-testid="check-unusual"
                      />
                      <Label htmlFor="unusualJournals" className="text-sm">Unusual Journals</Label>
                    </div>
                    <p className="text-xs text-muted-foreground ml-6">
                      Adjustments, manual entries, corrections, reversals
                    </p>

                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="weekendPostings"
                        checked={targetedCriteria.weekendPostings}
                        onCheckedChange={(checked) =>
                          setTargetedCriteria({ ...targetedCriteria, weekendPostings: !!checked })
                        }
                        data-testid="check-weekend"
                      />
                      <Label htmlFor="weekendPostings" className="text-sm">Weekend Postings</Label>
                    </div>

                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="roundAmounts"
                        checked={targetedCriteria.roundAmounts}
                        onCheckedChange={(checked) =>
                          setTargetedCriteria({ ...targetedCriteria, roundAmounts: !!checked })
                        }
                        data-testid="check-round"
                      />
                      <Label htmlFor="roundAmounts" className="text-sm">Round Amounts</Label>
                    </div>
                    <p className="text-xs text-muted-foreground ml-6">
                      Amounts divisible by 1,000
                    </p>

                    <div className="space-y-1">
                      <Label htmlFor="relatedParty" className="text-sm">Related Party Keywords</Label>
                      <Input
                        id="relatedParty"
                        placeholder="director, shareholder, owner"
                        value={targetedCriteria.relatedPartyKeywords}
                        onChange={(e) =>
                          setTargetedCriteria({ ...targetedCriteria, relatedPartyKeywords: e.target.value })
                        }
                        data-testid="input-related-party"
                      />
                      <p className="text-xs text-muted-foreground">Comma-separated keywords</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            <div className="flex justify-end">
              <Button
                onClick={handleGenerate}
                disabled={generateMutation.isPending}
                data-testid="button-generate"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Generate Sample
                  </>
                )}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-2.5">
            {runsQuery.isLoading ? (
              <div className="flex items-center justify-center py-2">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : runs.length === 0 ? (
              <div className="text-center py-2 text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-2.5 opacity-50" />
                <p>No sampling runs yet</p>
                <p className="text-sm">Generate your first sample to get started</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Run #</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Population</TableHead>
                      <TableHead className="text-right">Sample Size</TableHead>
                      <TableHead className="text-right">Coverage</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runs.map((run) => (
                      <TableRow
                        key={run.id}
                        className="cursor-pointer"
                        onClick={() => {
                          setSelectedRunId(run.id);
                          setActiveTab("results");
                        }}
                        data-testid={`row-run-${run.runNumber}`}
                      >
                        <TableCell className="font-medium">{run.runNumber}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{getMethodLabel(run.samplingMethod)}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{run.populationCount.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{run.sampleSize}</TableCell>
                        <TableCell className="text-right">
                          {Number(run.coveragePercentage).toFixed(1)}%
                        </TableCell>
                        <TableCell>{formatDate(run.createdAt)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleExport(run.id);
                              }}
                              data-testid={`button-export-${run.runNumber}`}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteMutation.mutate(run.id);
                              }}
                              data-testid={`button-delete-${run.runNumber}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="results" className="mt-2.5">
            {samplesQuery.isLoading ? (
              <div className="flex items-center justify-center py-2">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : !currentRun ? (
              <div className="text-center py-2 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-2.5 opacity-50" />
                <p>Select a sampling run to view results</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="grid gap-2.5 md:grid-cols-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-lg font-bold">{currentRun.populationCount.toLocaleString()}</div>
                      <p className="text-xs text-muted-foreground">Population Items</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-lg font-bold">{currentRun.sampleSize}</div>
                      <p className="text-xs text-muted-foreground">Selected Items</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-lg font-bold">
                        {Number(currentRun.coveragePercentage).toFixed(1)}%
                      </div>
                      <p className="text-xs text-muted-foreground">Value Coverage</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-lg font-bold">
                        {(currentRun.populationCount - currentRun.sampleSize).toLocaleString()}
                      </div>
                      <p className="text-xs text-muted-foreground">Items Not Selected</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{getMethodLabel(currentRun.samplingMethod)}</Badge>
                    {currentRun.samplingInterval && (
                      <Badge variant="secondary">
                        Interval: {formatAccounting(Number(currentRun.samplingInterval))}
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => handleExport(currentRun.id)}
                    data-testid="button-export-results"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export to CSV
                  </Button>
                </div>

                <ScrollArea className="h-[350px] border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Voucher</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Account</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Selection Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {samples.map((item) => (
                        <TableRow key={item.id} data-testid={`row-sample-${item.itemNumber}`}>
                          <TableCell className="font-medium">{item.itemNumber}</TableCell>
                          <TableCell>{item.voucherNo || "-"}</TableCell>
                          <TableCell>{item.postingDate ? formatDate(item.postingDate) : "-"}</TableCell>
                          <TableCell>
                            <div>
                              <div className="font-mono text-sm">{item.glCode}</div>
                              <div className="text-xs text-muted-foreground">{item.glName}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatAccounting(Number(item.amount))}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate" title={item.description || ""}>
                            {item.description || "-"}
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground">{item.selectionReason}</span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
