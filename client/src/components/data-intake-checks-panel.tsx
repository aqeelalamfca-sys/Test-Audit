import { useQuery, useMutation } from "@tanstack/react-query";
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronRight,
  FileText,
  Filter,
  Download,
} from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface GateStatus {
  tbBalanced: string;
  glBalanced: string;
  tbGlTieOut: string;
  apReconciled: string;
  arReconciled: string;
  bankReconciled: string;
  allCodesMapped: string;
  mappingLocked: string;
  bsFooting: string;
  canApproveLock: boolean;
  canPushForward: boolean;
  lastScanAt: string | null;
}

interface ReconIssue {
  id: string;
  tab: string;
  severity: string;
  ruleCode: string;
  message: string;
  blocking: boolean;
  status: string;
  accountCode?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
}

const gateLabels: Record<string, string> = {
  tbBalanced: "Trial Balance Balanced",
  glBalanced: "General Ledger Balanced",
  tbGlTieOut: "TB/GL Tie-Out",
  apReconciled: "AP Control Reconciled",
  arReconciled: "AR Control Reconciled",
  bankReconciled: "Bank Control Reconciled",
  allCodesMapped: "All Codes Mapped",
  mappingLocked: "Mapping Approved/Locked",
  bsFooting: "Balance Sheet Footing",
};

function GateIcon({ value }: { value: string }) {
  switch (value) {
    case "PASS":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "FAIL":
      return <XCircle className="h-4 w-4 text-red-500" />;
    case "WARNING":
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    default:
      return <Clock className="h-4 w-4 text-gray-400" />;
  }
}

function gateColor(value: string): string {
  switch (value) {
    case "PASS": return "text-green-600 bg-green-50 dark:bg-green-950";
    case "FAIL": return "text-red-600 bg-red-50 dark:bg-red-950";
    case "WARNING": return "text-amber-600 bg-amber-50 dark:bg-amber-950";
    default: return "text-gray-500 bg-gray-50 dark:bg-gray-950";
  }
}

interface FsValidationCheck {
  id: string;
  label: string;
  status: "PASS" | "FAIL" | "WARNING" | "NOT_RUN";
  detail: string;
  blocking: boolean;
}

interface FsValidation {
  checks: FsValidationCheck[];
  summary: { total: number; passed: number; failed: number; warnings: number; notRun: number; blockingCount: number; canGenerate: boolean; readinessPct: number };
}

export function DataIntakeChecksPanel({ engagementId }: { engagementId: string }) {
  const { toast } = useToast();
  const [issueFilter, setIssueFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["gates", "fsValidation", "issues"]));

  const { data: gates, isLoading: gatesLoading, refetch: refetchGates } = useQuery<GateStatus>({
    queryKey: ["/api/engagements", engagementId, "recon-gates"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/engagements/${engagementId}/recon/gates`);
      return res.json();
    },
    enabled: !!engagementId,
  });

  const { data: fsValidation, isLoading: fsValidationLoading, refetch: refetchFsValidation } = useQuery<FsValidation>({
    queryKey: ["/api/fs-draft", engagementId, "validate"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/fs-draft/${engagementId}/validate`);
      return res.json();
    },
    enabled: !!engagementId,
  });

  const { data: issues, isLoading: issuesLoading, refetch: refetchIssues } = useQuery<ReconIssue[]>({
    queryKey: ["/api/engagements", engagementId, "recon-issues", issueFilter, severityFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (issueFilter !== "all") params.set("tab", issueFilter);
      if (severityFilter !== "all") params.set("severity", severityFilter);
      params.set("status", "OPEN");
      const res = await apiRequest("GET", `/api/engagements/${engagementId}/recon/issues?${params}`);
      return res.json();
    },
    enabled: !!engagementId,
  });

  const scanMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/engagements/${engagementId}/recon/scan`);
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Scan Complete",
        description: `Found ${data.issuesCreated} issue(s), ${data.blockingCount} blocking`,
      });
      refetchGates();
      refetchIssues();
      refetchFsValidation();
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", engagementId, "data-intake-status"] });
    },
    onError: () => {
      toast({ title: "Scan Failed", variant: "destructive" });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ issueId, notes }: { issueId: string; notes?: string }) => {
      const res = await apiRequest("PATCH", `/api/engagements/${engagementId}/recon/issues/${issueId}/resolve`, { notes });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Issue resolved" });
      refetchIssues();
      refetchGates();
    },
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const gateEntries = gates
    ? Object.entries(gates).filter(([k]) => k in gateLabels)
    : [];

  const passCount = gateEntries.filter(([, v]) => v === "PASS").length;
  const totalGates = gateEntries.length;
  const gateCompletionPct = totalGates > 0 ? Math.round((passCount / totalGates) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Data Intake Checks & Readiness</h3>
          <p className="text-sm text-muted-foreground">
            Validation gates, reconciliation status, and exception management
          </p>
        </div>
        <Button
          onClick={() => scanMutation.mutate()}
          disabled={scanMutation.isPending}
          size="sm"
        >
          {scanMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-1" />
          )}
          Run Full Scan
        </Button>
      </div>

      <Collapsible
        open={expandedSections.has("gates")}
        onOpenChange={() => toggleSection("gates")}
      >
        <Card>
          <CardHeader className="py-3">
            <CollapsibleTrigger className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm">Reconciliation Gates</CardTitle>
                <Badge variant="outline" className="text-xs">
                  {passCount}/{totalGates} passed
                </Badge>
                <Progress value={gateCompletionPct} className="w-16 h-1.5" />
              </div>
              {expandedSections.has("gates") ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="pt-0">
              {gatesLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading gates...
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {gateEntries.map(([key, value]) => (
                    <div
                      key={key}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm ${gateColor(value as string)}`}
                    >
                      <GateIcon value={value as string} />
                      <span className="font-medium">{gateLabels[key]}</span>
                      <span className="ml-auto text-xs opacity-70">{value as string}</span>
                    </div>
                  ))}
                </div>
              )}
              {gates && (
                <div className="flex items-center gap-4 mt-3 pt-3 border-t">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Can Approve Lock:</span>
                    {gates.canApproveLock ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Can Push Forward:</span>
                    {gates.canPushForward ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                  {gates.lastScanAt && (
                    <span className="text-xs text-muted-foreground ml-auto">
                      Last scan: {new Date(gates.lastScanAt).toLocaleString()}
                    </span>
                  )}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible
        open={expandedSections.has("fsValidation")}
        onOpenChange={() => toggleSection("fsValidation")}
      >
        <Card>
          <CardHeader className="py-3">
            <CollapsibleTrigger className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm">Draft FS Integrity Checks</CardTitle>
                {fsValidation && (
                  <>
                    <Badge variant="outline" className="text-xs">
                      {fsValidation.summary.passed}/{fsValidation.summary.total} passed
                    </Badge>
                    <Progress value={fsValidation.summary.readinessPct} className="w-16 h-1.5" />
                  </>
                )}
              </div>
              {expandedSections.has("fsValidation") ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="pt-0">
              {fsValidationLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Validating...
                </div>
              ) : fsValidation ? (
                <div className="space-y-2">
                  {fsValidation.checks.map((check) => (
                    <div
                      key={check.id}
                      className={`flex items-start gap-2 px-3 py-2 rounded-md text-sm ${gateColor(check.status)}`}
                    >
                      <GateIcon value={check.status} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{check.label}</span>
                          {check.blocking && check.status !== "PASS" && (
                            <Badge variant="destructive" className="text-[9px] px-1 py-0">BLOCKING</Badge>
                          )}
                        </div>
                        <p className="text-xs opacity-80 mt-0.5">{check.detail}</p>
                      </div>
                    </div>
                  ))}
                  {fsValidation.summary.canGenerate && (
                    <div className="mt-2 p-2 bg-green-50 dark:bg-green-950 rounded text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Ready to generate Draft Financial Statements
                    </div>
                  )}
                </div>
              ) : null}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible
        open={expandedSections.has("issues")}
        onOpenChange={() => toggleSection("issues")}
      >
        <Card>
          <CardHeader className="py-3">
            <CollapsibleTrigger className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm">Open Exceptions</CardTitle>
                {issues && (
                  <Badge variant={issues.length > 0 ? "destructive" : "default"} className="text-xs">
                    {issues.length}
                  </Badge>
                )}
              </div>
              {expandedSections.has("issues") ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-3">
              <div className="flex items-center gap-2">
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                <Select value={issueFilter} onValueChange={setIssueFilter}>
                  <SelectTrigger className="h-7 w-[140px] text-xs">
                    <SelectValue placeholder="All tabs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tabs</SelectItem>
                    <SelectItem value="TB">Trial Balance</SelectItem>
                    <SelectItem value="GL">General Ledger</SelectItem>
                    <SelectItem value="AR">AR</SelectItem>
                    <SelectItem value="AP">AP</SelectItem>
                    <SelectItem value="BANK">Bank</SelectItem>
                    <SelectItem value="MAPPING">Mapping</SelectItem>
                    <SelectItem value="DRAFT_FS">Draft FS</SelectItem>
                    <SelectItem value="CONFIRMATIONS">Confirmations</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={severityFilter} onValueChange={setSeverityFilter}>
                  <SelectTrigger className="h-7 w-[120px] text-xs">
                    <SelectValue placeholder="Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severity</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="LOW">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {issuesLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading exceptions...
                </div>
              ) : issues && issues.length > 0 ? (
                <div className="max-h-[400px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[60px]">Severity</TableHead>
                        <TableHead className="w-[80px]">Tab</TableHead>
                        <TableHead>Issue</TableHead>
                        <TableHead className="w-[80px]">Blocking</TableHead>
                        <TableHead className="w-[80px]">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {issues.map((issue) => (
                        <TableRow key={issue.id}>
                          <TableCell>
                            <Badge
                              variant={issue.severity === "HIGH" ? "destructive" : issue.severity === "MEDIUM" ? "secondary" : "outline"}
                              className="text-[10px]"
                            >
                              {issue.severity}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">{issue.tab}</TableCell>
                          <TableCell className="text-xs">{issue.message}</TableCell>
                          <TableCell>
                            {issue.blocking ? (
                              <XCircle className="h-3.5 w-3.5 text-red-500" />
                            ) : (
                              <span className="text-xs text-muted-foreground">No</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs"
                              onClick={() => resolveMutation.mutate({ issueId: issue.id })}
                              disabled={resolveMutation.isPending}
                            >
                              Resolve
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500 opacity-50" />
                  No open exceptions
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
