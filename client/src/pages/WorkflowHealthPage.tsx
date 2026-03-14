import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  SkipForward,
  RefreshCw,
  FileText,
  ArrowLeft,
  Activity,
  Link2
} from "lucide-react";

interface HealthCheckResult {
  step: string;
  status: "PASS" | "FAIL" | "WARN" | "SKIP";
  message: string;
  details?: Record<string, unknown>;
  hint?: string;
}

interface WorkflowHealthReport {
  timestamp: string;
  engagementId: string;
  overallStatus: "HEALTHY" | "DEGRADED" | "CRITICAL";
  checks: HealthCheckResult[];
  summary: {
    passed: number;
    failed: number;
    warnings: number;
    skipped: number;
  };
}

interface IssueReport {
  engagementId: string;
  totalIssues: number;
  missingFields: Array<{ module: string; tab: string; fieldKey: string }>;
  duplicateFields: Array<{ module: string; tab: string; fieldKey: string; count: number }>;
  brokenLinkages: Array<{ source: string; target: string; issue: string }>;
  orphanedData: Array<{ table: string; count: number }>;
}

interface DataLinkFlow {
  id: string;
  source: string;
  target: string;
  endpoint: string;
  description: string;
  prerequisites: string[];
}

interface DataLinkMap {
  version: string;
  description: string;
  flows: DataLinkFlow[];
  statusFlow: string[];
}

function StatusIcon({ status }: { status: HealthCheckResult["status"] }) {
  switch (status) {
    case "PASS":
      return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    case "FAIL":
      return <XCircle className="h-5 w-5 text-red-600" />;
    case "WARN":
      return <AlertTriangle className="h-5 w-5 text-amber-600" />;
    case "SKIP":
      return <SkipForward className="h-5 w-5 text-slate-400" />;
  }
}

function OverallStatusBadge({ status }: { status: WorkflowHealthReport["overallStatus"] }) {
  const variants = {
    HEALTHY: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    DEGRADED: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    CRITICAL: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };
  
  return (
    <Badge className={variants[status]}>
      {status}
    </Badge>
  );
}

export default function WorkflowHealthPage() {
  const { engagementId } = useParams<{ engagementId: string }>();

  const { data: healthReport, isLoading: healthLoading, refetch: refetchHealth } = useQuery<WorkflowHealthReport>({
    queryKey: [`/api/health/workflow/${engagementId}`],
    enabled: !!engagementId,
  });

  const { data: issueReport, isLoading: issuesLoading, refetch: refetchIssues } = useQuery<IssueReport>({
    queryKey: [`/api/health/issues/${engagementId}`],
    enabled: !!engagementId,
  });

  const { data: dataLinkMap, isLoading: linksLoading } = useQuery<DataLinkMap>({
    queryKey: ["/api/health/data-links"],
  });

  const handleRefresh = () => {
    refetchHealth();
    refetchIssues();
  };

  if (!engagementId) {
    return (
      <div className="p-2.5" data-testid="container-no-engagement">
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground" data-testid="text-no-engagement">No engagement selected</p>
            <Link href="/">
              <Button variant="outline" className="mt-2.5" data-testid="button-go-dashboard">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-container" data-testid="container-workflow-health">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2" data-testid="text-page-title">
            <Activity className="h-6 w-6" />
            Workflow Health Check
          </h1>
          <p className="text-muted-foreground mt-1" data-testid="text-page-description">
            System diagnostics and data flow verification
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} data-testid="button-refresh-health">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Link href="/engagements">
            <Button variant="outline" data-testid="link-back-engagement">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Engagements
            </Button>
          </Link>
        </div>
      </div>

      {healthLoading ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-2.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : healthReport ? (
        <>
          <Card data-testid="card-health-summary">
            <CardHeader className="flex flex-row items-center justify-between gap-2.5">
              <div>
                <CardTitle data-testid="text-health-summary-title">Health Summary</CardTitle>
                <CardDescription data-testid="text-last-checked">
                  Last checked: {new Date(healthReport.timestamp).toLocaleString()}
                </CardDescription>
              </div>
              <OverallStatusBadge status={healthReport.overallStatus} />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-2.5">
                <div className="p-2.5 rounded-lg bg-green-50 dark:bg-green-900/20 text-center">
                  <div className="text-lg font-bold text-green-700 dark:text-green-400" data-testid="text-passed-count">
                    {healthReport.summary.passed}
                  </div>
                  <div className="text-sm text-green-600 dark:text-green-500">Passed</div>
                </div>
                <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-center">
                  <div className="text-lg font-bold text-red-700 dark:text-red-400" data-testid="text-failed-count">
                    {healthReport.summary.failed}
                  </div>
                  <div className="text-sm text-red-600 dark:text-red-500">Failed</div>
                </div>
                <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-center">
                  <div className="text-lg font-bold text-amber-700 dark:text-amber-400" data-testid="text-warnings-count">
                    {healthReport.summary.warnings}
                  </div>
                  <div className="text-sm text-amber-600 dark:text-amber-500">Warnings</div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/20 text-center">
                  <div className="text-lg font-bold text-slate-700 dark:text-slate-400" data-testid="text-skipped-count">
                    {healthReport.summary.skipped}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-500">Skipped</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Workflow Steps
              </CardTitle>
              <CardDescription>
                Status of each step in the audit workflow
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {healthReport.checks.map((check, index) => (
                  <div 
                    key={index}
                    className="flex items-start gap-2.5 p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                    data-testid={`row-health-check-${index}`}
                  >
                    <StatusIcon status={check.status} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{check.step}</div>
                      <div className="text-sm text-muted-foreground">{check.message}</div>
                      {check.hint && (
                        <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                          Hint: {check.hint}
                        </div>
                      )}
                    </div>
                    <StatusBadge 
                      status={
                        check.status === "PASS" ? "pass" :
                        check.status === "FAIL" ? "fail" :
                        check.status === "WARN" ? "warn" :
                        "neutral"
                      }
                    >
                      {check.status}
                    </StatusBadge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}

      {issuesLoading ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      ) : issueReport && issueReport.totalIssues > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
              Issues Found ({issueReport.totalIssues})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {issueReport.missingFields.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Missing Required Fields</h4>
                <div className="space-y-1">
                  {issueReport.missingFields.slice(0, 5).map((field, i) => (
                    <div key={i} className="text-sm text-muted-foreground pl-4 border-l-2 border-amber-300">
                      {field.module} &rarr; {field.tab} &rarr; {field.fieldKey}
                    </div>
                  ))}
                  {issueReport.missingFields.length > 5 && (
                    <div className="text-sm text-muted-foreground pl-4">
                      ...and {issueReport.missingFields.length - 5} more
                    </div>
                  )}
                </div>
              </div>
            )}

            {issueReport.brokenLinkages.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Broken Linkages</h4>
                <div className="space-y-1">
                  {issueReport.brokenLinkages.map((link, i) => (
                    <div key={i} className="text-sm text-muted-foreground pl-4 border-l-2 border-red-300">
                      {link.source} &rarr; {link.target}: {link.issue}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {issueReport.duplicateFields.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Duplicate Fields</h4>
                <div className="space-y-1">
                  {issueReport.duplicateFields.map((dup, i) => (
                    <div key={i} className="text-sm text-muted-foreground pl-4 border-l-2 border-orange-300">
                      {dup.module}/{dup.tab}/{dup.fieldKey} ({dup.count} duplicates)
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : issueReport ? (
        <Card>
          <CardContent className="py-3 text-center text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2" />
            No issues detected
          </CardContent>
        </Card>
      ) : null}

      {linksLoading ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      ) : dataLinkMap ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Data Flow Map
            </CardTitle>
            <CardDescription>
              {dataLinkMap.description}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {dataLinkMap.flows.slice(0, 8).map((flow) => (
                <div 
                  key={flow.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                  data-testid={`row-data-flow-${flow.id}`}
                >
                  <div className="flex-1 grid grid-cols-3 gap-2.5 items-center">
                    <div className="font-medium text-sm">{flow.source}</div>
                    <div className="text-center text-muted-foreground">&rarr;</div>
                    <div className="font-medium text-sm">{flow.target}</div>
                  </div>
                  <Badge variant="outline" className="text-xs font-mono">
                    {flow.endpoint.split("/").pop()}
                  </Badge>
                </div>
              ))}
              {dataLinkMap.flows.length > 8 && (
                <div className="text-center text-sm text-muted-foreground">
                  ...and {dataLinkMap.flows.length - 8} more data flows
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
