import { useQuery, useMutation } from "@tanstack/react-query";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  Database, 
  FileSpreadsheet, 
  Calculator, 
  GitCompare,
  ArrowRight,
  Loader2,
  Shield,
  Activity
} from "lucide-react";

interface DataQualityResponse {
  summary: {
    tbBalanced: boolean;
    glBalanced: boolean;
    tbGlReconciled: boolean;
    mappingComplete: boolean;
    mappingPercentage: number;
    materialitySet: boolean;
    staleFieldCount: number;
    missingRequiredOutputs: string[];
  };
  tbStatus: {
    totalDebits: number;
    totalCredits: number;
    difference: number;
    entryCount: number;
    hasData: boolean;
    status: string;
  };
  glStatus: {
    totalDebits: number;
    totalCredits: number;
    difference: number;
    entryCount: number;
    hasData: boolean;
    status: string;
  };
  mappingStatus: {
    totalAccounts: number;
    mappedAccounts: number;
    unmappedAccounts: number;
    percentage: number;
  };
  staleFields: {
    fieldCode: string;
    label: string;
    computedAt: string;
    isStale: boolean;
  }[];
  phaseRequirements: {
    phase: string;
    canTransition: boolean;
    blockers: string[];
  }[];
  overallHealth: {
    score: number;
    rating: "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
    issues: string[];
  };
}

interface DataQualityDashboardProps {
  engagementId: string;
  compact?: boolean;
}

export function DataQualityDashboard({ engagementId, compact = false }: DataQualityDashboardProps) {
  const { toast } = useToast();

  const { data, isLoading, refetch } = useQuery<DataQualityResponse>({
    queryKey: ["/api/engagements", engagementId, "data-quality"],
    queryFn: async () => {
      const response = await fetchWithAuth(`/api/engagements/${engagementId}/data-quality`);
      if (!response.ok) throw new Error("Failed to fetch data quality");
      return response.json();
    },
    enabled: !!engagementId,
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/engagements/${engagementId}/refresh-computed-fields`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", engagementId, "data-quality"] });
      toast({ title: "Computed fields refreshed successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to refresh fields", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-2.5">
        <Skeleton className="h-24" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!data) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Unable to load data quality</AlertTitle>
        <AlertDescription>Please try refreshing the page.</AlertDescription>
      </Alert>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const getHealthColor = (rating: string) => {
    switch (rating) {
      case "EXCELLENT": return "text-green-600 dark:text-green-400";
      case "GOOD": return "text-blue-600 dark:text-blue-400";
      case "FAIR": return "text-yellow-600 dark:text-yellow-400";
      case "POOR": return "text-red-600 dark:text-red-400";
      default: return "text-muted-foreground";
    }
  };

  const getHealthBgColor = (rating: string) => {
    switch (rating) {
      case "EXCELLENT": return "bg-green-100 dark:bg-green-900/30";
      case "GOOD": return "bg-blue-100 dark:bg-blue-900/30";
      case "FAIR": return "bg-yellow-100 dark:bg-yellow-900/30";
      case "POOR": return "bg-red-100 dark:bg-red-900/30";
      default: return "bg-muted";
    }
  };

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={data.summary.tbBalanced ? "default" : "destructive"}
          className="flex items-center gap-1"
          data-testid="badge-tb-status"
        >
          {data.summary.tbBalanced ? (
            <CheckCircle2 className="h-3 w-3" />
          ) : (
            <XCircle className="h-3 w-3" />
          )}
          TB {data.summary.tbBalanced ? "Balanced" : "Unbalanced"}
        </Badge>
        
        {data.glStatus.hasData && (
          <Badge
            variant={data.summary.glBalanced ? "default" : "destructive"}
            className="flex items-center gap-1"
            data-testid="badge-gl-status"
          >
            {data.summary.glBalanced ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : (
              <XCircle className="h-3 w-3" />
            )}
            GL {data.summary.glBalanced ? "Balanced" : "Unbalanced"}
          </Badge>
        )}
        
        <Badge
          variant={data.summary.mappingComplete ? "default" : "secondary"}
          className="flex items-center gap-1"
          data-testid="badge-mapping-status"
        >
          <Database className="h-3 w-3" />
          {data.mappingStatus.percentage}% Mapped
        </Badge>
        
        {data.summary.staleFieldCount > 0 && (
          <Badge variant="outline" className="flex items-center gap-1 text-yellow-600" data-testid="badge-stale-fields">
            <AlertTriangle className="h-3 w-3" />
            {data.summary.staleFieldCount} Stale
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Data Quality Dashboard</h2>
          <p className="text-sm text-muted-foreground">Monitor data integrity and reconciliation status</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          data-testid="button-refresh-quality"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Card className={getHealthBgColor(data.overallHealth.rating)}>
        <CardContent className="p-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Activity className={`h-8 w-8 ${getHealthColor(data.overallHealth.rating)}`} />
              <div>
                <p className="text-sm text-muted-foreground">Overall Health Score</p>
                <p className={`text-lg font-bold ${getHealthColor(data.overallHealth.rating)}`}>
                  {data.overallHealth.score}%
                </p>
              </div>
            </div>
            <Badge className={getHealthColor(data.overallHealth.rating)} variant="outline">
              {data.overallHealth.rating}
            </Badge>
          </div>
          {data.overallHealth.issues.length > 0 && (
            <div className="mt-3 pt-3 border-t border-muted">
              <p className="text-sm font-medium mb-2">Issues:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                {data.overallHealth.issues.slice(0, 5).map((issue, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <AlertTriangle className="h-3 w-3 text-yellow-600" />
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Trial Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.tbStatus.hasData ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge variant={data.summary.tbBalanced ? "default" : "destructive"} data-testid="status-tb-balanced">
                    {data.summary.tbBalanced ? "Balanced" : "Unbalanced"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Debits</span>
                  <span className="text-sm font-medium">{formatCurrency(data.tbStatus.totalDebits)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Credits</span>
                  <span className="text-sm font-medium">{formatCurrency(data.tbStatus.totalCredits)}</span>
                </div>
                {!data.summary.tbBalanced && (
                  <div className="flex items-center justify-between text-destructive">
                    <span className="text-sm">Difference</span>
                    <span className="text-sm font-medium">{formatCurrency(data.tbStatus.difference)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Entries</span>
                  <span className="text-sm">{data.tbStatus.entryCount}</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-20 text-muted-foreground">
                <span className="text-sm">No Trial Balance uploaded</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Database className="h-4 w-4" />
              General Ledger
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.glStatus.hasData ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge variant={data.summary.glBalanced ? "default" : "destructive"} data-testid="status-gl-balanced">
                    {data.summary.glBalanced ? "Balanced" : "Unbalanced"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Debits</span>
                  <span className="text-sm font-medium">{formatCurrency(data.glStatus.totalDebits)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Credits</span>
                  <span className="text-sm font-medium">{formatCurrency(data.glStatus.totalCredits)}</span>
                </div>
                {!data.summary.glBalanced && (
                  <div className="flex items-center justify-between text-destructive">
                    <span className="text-sm">Difference</span>
                    <span className="text-sm font-medium">{formatCurrency(data.glStatus.difference)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Entries</span>
                  <span className="text-sm">{data.glStatus.entryCount}</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-20 text-muted-foreground">
                <span className="text-sm">No General Ledger uploaded</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <GitCompare className="h-4 w-4" />
              Account Mapping
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Progress</span>
                <span className="text-sm font-medium">{data.mappingStatus.percentage}%</span>
              </div>
              <Progress value={data.mappingStatus.percentage} className="h-2" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {data.mappingStatus.mappedAccounts} / {data.mappingStatus.totalAccounts} accounts
                </span>
                {data.summary.mappingComplete ? (
                  <Badge variant="default" data-testid="status-mapping-complete">Complete</Badge>
                ) : (
                  <Badge variant="secondary" data-testid="status-mapping-incomplete">
                    {data.mappingStatus.unmappedAccounts} remaining
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Computed Fields
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Stale Fields</span>
                <Badge 
                  variant={data.summary.staleFieldCount === 0 ? "outline" : "secondary"}
                  className={data.summary.staleFieldCount > 0 ? "text-yellow-600" : ""}
                  data-testid="count-stale-fields"
                >
                  {data.summary.staleFieldCount}
                </Badge>
              </div>
              {data.summary.staleFieldCount > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => refreshMutation.mutate()}
                  disabled={refreshMutation.isPending}
                  data-testid="button-refresh-fields"
                >
                  {refreshMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Refresh All Fields
                </Button>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Materiality</span>
                <Badge variant={data.summary.materialitySet ? "default" : "secondary"} data-testid="status-materiality">
                  {data.summary.materialitySet ? "Set" : "Not Set"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {data.summary.staleFieldCount > 0 && data.staleFields.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              Stale Computed Fields
            </CardTitle>
            <CardDescription>
              These fields have outdated values because source data has changed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.staleFields.map((field) => (
                <div key={field.fieldCode} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium text-sm">{field.label}</p>
                    <p className="text-xs text-muted-foreground">{field.fieldCode}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="text-yellow-600">Stale</Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      Last computed: {new Date(field.computedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {data.summary.missingRequiredOutputs.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Missing Required Outputs</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside mt-2">
              {data.summary.missingRequiredOutputs.map((output) => (
                <li key={output}>{output.replace(/_/g, " ")}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Phase Transition Requirements
          </CardTitle>
          <CardDescription>
            Requirements that must be met before transitioning to each phase
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.phaseRequirements.map((phase) => (
              <div key={phase.phase} className="flex items-start justify-between py-2 border-b last:border-0">
                <div className="flex items-center gap-2">
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{phase.phase.replace(/_/g, " ")}</span>
                </div>
                <div className="text-right">
                  {phase.canTransition ? (
                    <Badge variant="default" data-testid={`status-phase-${phase.phase.toLowerCase()}`}>
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Ready
                    </Badge>
                  ) : (
                    <div className="space-y-1">
                      <Badge variant="destructive" data-testid={`status-phase-${phase.phase.toLowerCase()}`}>
                        <XCircle className="h-3 w-3 mr-1" />
                        Blocked
                      </Badge>
                      <div className="text-xs text-muted-foreground max-w-[200px]">
                        {phase.blockers.slice(0, 2).map((blocker, idx) => (
                          <p key={idx}>{blocker}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function ReconciliationStatusIndicator({ engagementId }: { engagementId: string }) {
  const { data, isLoading } = useQuery<DataQualityResponse>({
    queryKey: ["/api/engagements", engagementId, "data-quality"],
    queryFn: async () => {
      const response = await fetchWithAuth(`/api/engagements/${engagementId}/data-quality`);
      if (!response.ok) throw new Error("Failed to fetch data quality");
      return response.json();
    },
    enabled: !!engagementId,
    staleTime: 30000,
  });

  if (isLoading) {
    return <Skeleton className="h-6 w-32" />;
  }

  if (!data) return null;

  return <DataQualityDashboard engagementId={engagementId} compact />;
}
