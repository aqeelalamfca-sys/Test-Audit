import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  ChevronDown, 
  ChevronRight,
  AlertTriangle, 
  AlertCircle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Wrench,
  FileCheck,
  Link2,
  Link2Off,
  Shield,
  Clock,
  ArrowRight,
  Download,
  Eye
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface LinkageMonitorPanelProps {
  engagementId: string;
  onDataChange?: (data: any) => void;
}

interface BrokenLink {
  id: string;
  linkType: string;
  sourceId: string;
  sourceType: string;
  targetId: string | null;
  targetType: string | null;
  breakReason: string;
  severity: 'HIGH' | 'MEDIUM';
  canAutoRepair: boolean;
  repairAction: string | null;
  authorityLevel: number;
  detectedAt: string;
}

interface GateResult {
  gate: string;
  passed: boolean;
  isaReference: string;
  message: string;
  count: number;
}

interface RepairLogEntry {
  id: string;
  timestamp: string;
  moduleImpacted: string;
  authorityLevel: number;
  action: string;
  beforeState: Record<string, any>;
  afterState: Record<string, any>;
  reason: string;
  confidenceScore: number;
  user: string;
  approvalRequired: boolean;
  reviewerSignOff: string | null;
  reviewerSignOffStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
}

export function LinkageMonitorPanel({ engagementId, onDataChange }: LinkageMonitorPanelProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("health");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    fsLevel: true,
    assertion: true,
    breaks: true
  });

  const { data: scanData, isLoading: scanLoading, refetch: refetchScan } = useQuery({
    queryKey: ['/api/linkage-monitor', engagementId, 'report'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/linkage-monitor/${engagementId}/report`);
      return res.json();
    },
    enabled: !!engagementId
  });

  const { data: repairLogData } = useQuery({
    queryKey: ['/api/linkage-monitor', engagementId, 'repair-log'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/linkage-monitor/${engagementId}/repair-log`);
      return res.json();
    },
    enabled: !!engagementId
  });

  const fullScanMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/linkage-monitor/${engagementId}/full-scan`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/linkage-monitor', engagementId] });
      onDataChange?.(data.data);
    }
  });

  const autoRepairMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/linkage-monitor/${engagementId}/auto-repair`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/linkage-monitor', engagementId] });
      refetchScan();
    }
  });

  const approveRepairMutation = useMutation({
    mutationFn: async ({ repairId, approved }: { repairId: string; approved: boolean }) => {
      const res = await apiRequest('POST', `/api/linkage-monitor/${engagementId}/approve-repair/${repairId}`, { approved });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/linkage-monitor', engagementId] });
    }
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const report = scanData?.data;
  const repairLog = repairLogData?.data;

  const chainHealth = report?.chainHealthSummary;
  const breakRegister = report?.breakRegister;
  const gateResults = report?.gateResults;
  const autoRepairLog = report?.autoRepairLog;
  const regeneratedArtifacts = report?.regeneratedArtifacts;

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getSeverityBadge = (severity: string) => {
    return severity === 'HIGH' 
      ? <Badge variant="destructive" data-testid="badge-severity-high">HIGH</Badge>
      : <Badge variant="secondary" data-testid="badge-severity-medium">MEDIUM</Badge>;
  };

  const getStatusIcon = (passed: boolean) => {
    return passed 
      ? <CheckCircle2 className="h-4 w-4 text-green-600" />
      : <XCircle className="h-4 w-4 text-red-600" />;
  };

  const exportReport = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `linkage-report-${engagementId}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="w-full" data-testid="card-linkage-monitor">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2" data-testid="text-panel-title">
              <Link2 className="h-5 w-5" />
              Audit Chain Integrity & ISA Compliance Agent
            </CardTitle>
            <CardDescription>
              Full canonical chain monitoring with auto-repair capabilities
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => fullScanMutation.mutate()}
              disabled={fullScanMutation.isPending}
              data-testid="button-full-scan"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${fullScanMutation.isPending ? 'animate-spin' : ''}`} />
              Full Scan
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => autoRepairMutation.mutate()}
              disabled={autoRepairMutation.isPending || !report}
              data-testid="button-auto-repair"
            >
              <Wrench className={`h-4 w-4 mr-2 ${autoRepairMutation.isPending ? 'animate-spin' : ''}`} />
              Auto-Repair
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={exportReport}
              disabled={!report}
              data-testid="button-export"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {scanLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !report ? (
          <div className="text-center py-8 text-muted-foreground">
            <Link2Off className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No scan data available. Run a Full Scan to analyze chain integrity.</p>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5" data-testid="tabs-monitor">
              <TabsTrigger value="health" data-testid="tab-health">Health Summary</TabsTrigger>
              <TabsTrigger value="breaks" data-testid="tab-breaks">
                Break Register
                {breakRegister?.totalBreaks > 0 && (
                  <Badge variant="destructive" className="ml-2">{breakRegister.totalBreaks}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="repairs" data-testid="tab-repairs">Repair Log</TabsTrigger>
              <TabsTrigger value="artifacts" data-testid="tab-artifacts">Regenerated</TabsTrigger>
              <TabsTrigger value="gates" data-testid="tab-gates">
                Gates
                {gateResults && (
                  <Badge variant={gateResults.overall === 'PASS' ? 'default' : 'destructive'} className="ml-2">
                    {gateResults.overall}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="health" className="mt-4">
              {chainHealth && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-4">
                        <div className="text-center">
                          <div className={`text-4xl font-bold ${getScoreColor(chainHealth.overallScore)}`} data-testid="text-overall-score">
                            {chainHealth.overallScore}%
                          </div>
                          <div className="text-sm text-muted-foreground">Overall Score</div>
                          <Progress value={chainHealth.overallScore} className="mt-2" />
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold" data-testid="text-total-nodes">
                            {chainHealth.chainIntegrity.totalNodes}
                          </div>
                          <div className="text-sm text-muted-foreground">Total Nodes</div>
                          <div className="text-xs mt-1">
                            <span className="text-green-600">{chainHealth.chainIntegrity.linkedNodes} linked</span>
                            {' • '}
                            <span className="text-red-600">{chainHealth.chainIntegrity.brokenLinks} broken</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold" data-testid="text-locked-nodes">
                            {chainHealth.chainIntegrity.lockedNodes}
                          </div>
                          <div className="text-sm text-muted-foreground">Locked Nodes</div>
                          <div className="text-xs mt-1">
                            <span className="text-gray-500">{chainHealth.chainIntegrity.inactiveNodes} inactive</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Collapsible open={expandedSections.fsLevel} onOpenChange={() => toggleSection('fsLevel')}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full justify-between" data-testid="button-toggle-fslevel">
                        <span className="font-semibold">FS-Level Track (ISA 315/330)</span>
                        {expandedSections.fsLevel ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2">
                          {chainHealth.fsLevelTrack.entityUnderstanding === 'OK' 
                            ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                            : <AlertCircle className="h-4 w-4 text-red-600" />}
                          <span>Entity Understanding</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono">{chainHealth.fsLevelTrack.fsLevelRisks.linked}/{chainHealth.fsLevelTrack.fsLevelRisks.count}</span>
                          <ArrowRight className="h-3 w-3" />
                          <span className="text-sm">FS-Level Risks Linked</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono">{chainHealth.fsLevelTrack.overallResponses.count}</span>
                          <span className="text-sm">Overall Responses</span>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  <Collapsible open={expandedSections.assertion} onOpenChange={() => toggleSection('assertion')}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full justify-between" data-testid="button-toggle-assertion">
                        <span className="font-semibold">Assertion Track (Full Chain)</span>
                        {expandedSections.assertion ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                        <div className="grid grid-cols-4 gap-4 text-sm">
                          <div className="flex flex-col items-center p-2 bg-background rounded">
                            <span className="font-mono text-lg">{chainHealth.assertionTrack.fsHeads.withAssertions}/{chainHealth.assertionTrack.fsHeads.total}</span>
                            <span className="text-xs text-muted-foreground">FS Heads</span>
                          </div>
                          <div className="flex flex-col items-center p-2 bg-background rounded">
                            <span className="font-mono text-lg">{chainHealth.assertionTrack.rmm.withResponse}/{chainHealth.assertionTrack.rmm.total}</span>
                            <span className="text-xs text-muted-foreground">RMM→Response</span>
                          </div>
                          <div className="flex flex-col items-center p-2 bg-background rounded">
                            <span className="font-mono text-lg">{chainHealth.assertionTrack.populations.frozen}/{chainHealth.assertionTrack.populations.total}</span>
                            <span className="text-xs text-muted-foreground">Populations Frozen</span>
                          </div>
                          <div className="flex flex-col items-center p-2 bg-background rounded">
                            <span className="font-mono text-lg">{chainHealth.assertionTrack.samples.linked}/{chainHealth.assertionTrack.samples.total}</span>
                            <span className="text-xs text-muted-foreground">Samples Linked</span>
                          </div>
                        </div>
                        <Separator />
                        <div className="grid grid-cols-4 gap-4 text-sm">
                          <div className="flex flex-col items-center p-2 bg-background rounded">
                            <span className="font-mono text-lg">{chainHealth.assertionTrack.procedures.executed}/{chainHealth.assertionTrack.procedures.total}</span>
                            <span className="text-xs text-muted-foreground">Procedures Executed</span>
                          </div>
                          <div className="flex flex-col items-center p-2 bg-background rounded">
                            <span className="font-mono text-lg">{chainHealth.assertionTrack.procedures.withEvidence}</span>
                            <span className="text-xs text-muted-foreground">With Evidence</span>
                          </div>
                          <div className="flex flex-col items-center p-2 bg-background rounded">
                            <span className="font-mono text-lg">{chainHealth.assertionTrack.misstatementSummary.isa450Compliant}/{chainHealth.assertionTrack.misstatementSummary.total}</span>
                            <span className="text-xs text-muted-foreground">ISA 450 Compliant</span>
                          </div>
                          <div className="flex flex-col items-center p-2 bg-background rounded">
                            <span className="font-mono text-lg">{chainHealth.assertionTrack.conclusions.supported}/{chainHealth.assertionTrack.conclusions.total}</span>
                            <span className="text-xs text-muted-foreground">Conclusions</span>
                          </div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  <div className="text-xs text-muted-foreground text-right">
                    Last scan: {new Date(chainHealth.scanTimestamp).toLocaleString()}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="breaks" className="mt-4">
              {breakRegister && (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4">
                    {breakRegister.highSeverity.length > 0 && (
                      <div>
                        <h4 className="font-semibold flex items-center gap-2 mb-2">
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                          High Severity ({breakRegister.highSeverity.length})
                        </h4>
                        <div className="space-y-2">
                          {breakRegister.highSeverity.map((brk: BrokenLink) => (
                            <div key={brk.id} className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg">
                              <div className="flex items-start justify-between">
                                <div>
                                  <div className="flex items-center gap-2">
                                    {getSeverityBadge(brk.severity)}
                                    <Badge variant="outline">{brk.linkType}</Badge>
                                    <span className="text-xs text-muted-foreground">Authority: {brk.authorityLevel}</span>
                                  </div>
                                  <p className="text-sm mt-1">{brk.breakReason}</p>
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {brk.sourceType}: {brk.sourceId.substring(0, 20)}...
                                    {brk.targetType && <span> → {brk.targetType}</span>}
                                  </div>
                                </div>
                                {brk.canAutoRepair && (
                                  <Badge variant="secondary" className="text-xs">
                                    <Wrench className="h-3 w-3 mr-1" />
                                    Auto-repairable
                                  </Badge>
                                )}
                              </div>
                              {brk.repairAction && (
                                <div className="mt-2 text-xs bg-background p-2 rounded">
                                  <strong>Repair:</strong> {brk.repairAction}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {breakRegister.mediumSeverity.length > 0 && (
                      <div>
                        <h4 className="font-semibold flex items-center gap-2 mb-2">
                          <AlertCircle className="h-4 w-4 text-yellow-600" />
                          Medium Severity ({breakRegister.mediumSeverity.length})
                        </h4>
                        <div className="space-y-2">
                          {breakRegister.mediumSeverity.map((brk: BrokenLink) => (
                            <div key={brk.id} className="p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-lg">
                              <div className="flex items-start justify-between">
                                <div>
                                  <div className="flex items-center gap-2">
                                    {getSeverityBadge(brk.severity)}
                                    <Badge variant="outline">{brk.linkType}</Badge>
                                  </div>
                                  <p className="text-sm mt-1">{brk.breakReason}</p>
                                </div>
                                {brk.canAutoRepair && (
                                  <Badge variant="secondary" className="text-xs">
                                    <Wrench className="h-3 w-3 mr-1" />
                                    Auto-repairable
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {breakRegister.totalBreaks === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-600" />
                        <p>No broken links detected. Chain integrity verified.</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>

            <TabsContent value="repairs" className="mt-4">
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {repairLog?.repairLog?.length > 0 ? (
                    repairLog.repairLog.map((entry: RepairLogEntry) => (
                      <div key={entry.id} className="p-3 border rounded-lg">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{entry.action}</Badge>
                              <Badge variant="secondary">{entry.moduleImpacted}</Badge>
                              <span className="text-xs text-muted-foreground">
                                Confidence: {entry.confidenceScore}%
                              </span>
                            </div>
                            <p className="text-sm mt-1">{entry.reason}</p>
                            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                              <Clock className="h-3 w-3" />
                              {new Date(entry.timestamp).toLocaleString()}
                              <span>by {entry.user}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {entry.reviewerSignOffStatus === 'PENDING' ? (
                              <>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => approveRepairMutation.mutate({ repairId: entry.id, approved: true })}
                                  data-testid={`button-approve-${entry.id}`}
                                >
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Approve
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => approveRepairMutation.mutate({ repairId: entry.id, approved: false })}
                                  data-testid={`button-reject-${entry.id}`}
                                >
                                  <XCircle className="h-3 w-3 mr-1" />
                                  Reject
                                </Button>
                              </>
                            ) : entry.reviewerSignOffStatus ? (
                              <Badge variant={entry.reviewerSignOffStatus === 'APPROVED' ? 'default' : 'destructive'}>
                                {entry.reviewerSignOffStatus}
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Auto-approved</Badge>
                            )}
                          </div>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-muted p-2 rounded">
                            <strong>Before:</strong> {JSON.stringify(entry.beforeState)}
                          </div>
                          <div className="bg-muted p-2 rounded">
                            <strong>After:</strong> {JSON.stringify(entry.afterState)}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No repair actions logged yet.</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
              {repairLog && (
                <div className="mt-4 flex gap-4 text-sm">
                  <span>Total: {repairLog.totalRepairs}</span>
                  <span className="text-yellow-600">Pending: {repairLog.pendingApprovals}</span>
                  <span className="text-green-600">Approved: {repairLog.approvedRepairs}</span>
                  <span className="text-red-600">Rejected: {repairLog.rejectedRepairs}</span>
                </div>
              )}
            </TabsContent>

            <TabsContent value="artifacts" className="mt-4">
              {regeneratedArtifacts ? (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4">
                    {Object.entries(regeneratedArtifacts).map(([category, artifacts]: [string, any]) => (
                      artifacts.length > 0 && (
                        <div key={category}>
                          <h4 className="font-semibold capitalize mb-2">{category.replace(/([A-Z])/g, ' $1').trim()}</h4>
                          <div className="space-y-2">
                            {artifacts.map((artifact: any) => (
                              <div key={artifact.id} className="p-3 bg-muted/50 rounded-lg">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline">{artifact.type}</Badge>
                                    <span className="text-sm">{artifact.id.substring(0, 25)}...</span>
                                  </div>
                                  <span className="text-xs text-muted-foreground">
                                    v{artifact.fromVersion} → v{artifact.toVersion}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">{artifact.reason}</p>
                                {artifact.dependentArtifacts.length > 0 && (
                                  <div className="text-xs mt-1">
                                    Dependencies: {artifact.dependentArtifacts.length}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    ))}
                    {Object.values(regeneratedArtifacts).every((arr: any) => arr.length === 0) && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No artifacts regenerated in this scan.</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Run a full scan to see regenerated artifacts.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="gates" className="mt-4">
              {gateResults && (
                <div className="space-y-4">
                  <div className="flex items-center justify-center p-4 rounded-lg bg-muted/50">
                    {gateResults.overall === 'PASS' ? (
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle2 className="h-8 w-8" />
                        <span className="text-2xl font-bold">ALL GATES PASS</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-red-600">
                        <XCircle className="h-8 w-8" />
                        <span className="text-2xl font-bold">GATES FAILED</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    {gateResults.gates.map((gate: GateResult, idx: number) => (
                      <div 
                        key={idx} 
                        className={`p-3 rounded-lg border ${gate.passed ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900' : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900'}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(gate.passed)}
                            <span className="font-medium">{gate.gate}</span>
                          </div>
                          <Badge variant="outline">{gate.isaReference}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{gate.message}</p>
                        {gate.count > 0 && !gate.passed && (
                          <div className="text-xs mt-1">Issues: {gate.count}</div>
                        )}
                      </div>
                    ))}
                  </div>

                  {gateResults.needsReviewList.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-semibold flex items-center gap-2 mb-2">
                        <Eye className="h-4 w-4" />
                        Needs Review ({gateResults.needsReviewList.length})
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {gateResults.needsReviewList.slice(0, 10).map((id: string) => (
                          <Badge key={id} variant="outline" className="text-xs">
                            {id.substring(0, 20)}...
                          </Badge>
                        ))}
                        {gateResults.needsReviewList.length > 10 && (
                          <Badge variant="secondary">+{gateResults.needsReviewList.length - 10} more</Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
