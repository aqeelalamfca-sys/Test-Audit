import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useWorkspace } from "@/lib/workspace-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Shield, Play, AlertTriangle, CheckCircle2, XCircle, Info, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SimulationFinding {
  category: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  title: string;
  description: string;
  isaReference?: string;
  resolution: string;
}

interface SimulationSection {
  name: string;
  status: "PASS" | "FAIL" | "WARNING" | "SKIPPED";
  findings: SimulationFinding[];
  score: number;
  maxScore: number;
}

interface SimulationResult {
  engagementId: string;
  runAt: string;
  overallScore: number;
  overallMaxScore: number;
  overallStatus: "PASS" | "FAIL" | "WARNING";
  sections: SimulationSection[];
}

function getSeverityVariant(severity: string): "default" | "destructive" | "secondary" | "outline" {
  switch (severity) {
    case "CRITICAL":
    case "HIGH":
      return "destructive";
    case "MEDIUM":
      return "secondary";
    default:
      return "outline";
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case "PASS":
      return <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />;
    case "FAIL":
      return <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />;
    case "WARNING":
      return <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />;
    case "SKIPPED":
      return <Info className="h-5 w-5 text-muted-foreground" />;
    default:
      return null;
  }
}

function getOverallStatusColor(status: string) {
  switch (status) {
    case "PASS":
      return "text-green-600 dark:text-green-400";
    case "FAIL":
      return "text-red-600 dark:text-red-400";
    case "WARNING":
      return "text-yellow-600 dark:text-yellow-400";
    default:
      return "text-muted-foreground";
  }
}

export default function ComplianceSimulation() {
  const { activeEngagement } = useWorkspace();
  const engagementId = activeEngagement?.id;
  const { toast } = useToast();

  const { data: cachedResult, isLoading: isLoadingCached } = useQuery<SimulationResult | null>({
    queryKey: ["/api/simulation/results", engagementId],
    enabled: !!engagementId,
  });

  const runMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/simulation/run/${engagementId}`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/simulation/results", engagementId], data);
      toast({
        title: "Simulation Complete",
        description: `Overall score: ${data.overallScore}/${data.overallMaxScore}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Simulation Failed",
        description: error.message || "An error occurred during simulation",
        variant: "destructive",
      });
    },
  });

  const result = cachedResult;
  const pct = result ? Math.round((result.overallScore / result.overallMaxScore) * 100) : 0;

  if (!engagementId) {
    return (
      <div className="flex items-center justify-center h-full p-8" data-testid="no-engagement">
        <div className="text-center space-y-3">
          <Shield className="h-12 w-12 mx-auto text-muted-foreground" />
          <h2 className="text-xl font-semibold">No Engagement Selected</h2>
          <p className="text-muted-foreground">Select an engagement to run the compliance simulation.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 max-w-5xl mx-auto" data-testid="compliance-simulation-page">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6" />
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Compliance Simulation</h1>
        </div>
        <Button
          onClick={() => runMutation.mutate()}
          disabled={runMutation.isPending}
          data-testid="button-run-simulation"
        >
          {runMutation.isPending ? (
            <>
              <Clock className="h-4 w-4 mr-2 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Run Simulation
            </>
          )}
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Runs read-only compliance checks against live engagement data covering ISA coverage, file review, ISQM, security, and AI governance.
      </p>

      {isLoadingCached && !result && (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Loading cached results...
          </CardContent>
        </Card>
      )}

      {!result && !isLoadingCached && (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground" data-testid="text-no-results">
            No simulation results available. Click &quot;Run Simulation&quot; to start.
          </CardContent>
        </Card>
      )}

      {result && (
        <>
          <Card data-testid="card-overall-score">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-lg">Overall Score</CardTitle>
              <Badge
                variant={result.overallStatus === "PASS" ? "default" : result.overallStatus === "FAIL" ? "destructive" : "secondary"}
                data-testid="badge-overall-status"
              >
                {result.overallStatus}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <span className={`text-3xl font-bold ${getOverallStatusColor(result.overallStatus)}`} data-testid="text-overall-score">
                  {result.overallScore}/{result.overallMaxScore}
                </span>
                <span className="text-sm text-muted-foreground">({pct}%)</span>
              </div>
              <Progress value={pct} className="h-2" data-testid="progress-overall" />
              <p className="text-xs text-muted-foreground">
                Last run: {new Date(result.runAt).toLocaleString()}
              </p>
            </CardContent>
          </Card>

          <Accordion type="multiple" defaultValue={result.sections.map((_, i) => `section-${i}`)}>
            {result.sections.map((section, i) => (
              <AccordionItem value={`section-${i}`} key={i} data-testid={`section-${section.name.replace(/\s+/g, "-").toLowerCase()}-${i}`}>
                <AccordionTrigger className="hover:no-underline px-2">
                  <div className="flex items-center gap-3 flex-1 flex-wrap">
                    {getStatusIcon(section.status)}
                    <span className="font-medium" data-testid={`text-section-name-${i}`}>{section.name}</span>
                    <span className="text-sm text-muted-foreground ml-auto mr-2">
                      {section.score}/{section.maxScore}
                    </span>
                    <Badge
                      variant={section.status === "PASS" ? "default" : section.status === "FAIL" ? "destructive" : "secondary"}
                      data-testid={`badge-section-status-${i}`}
                    >
                      {section.status}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-2">
                  {section.findings.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2" data-testid={`text-no-findings-${i}`}>
                      All checks passed. No findings.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {section.findings.map((finding, fi) => (
                        <Card key={fi} data-testid={`card-finding-${i}-${fi}`}>
                          <CardContent className="p-3 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant={getSeverityVariant(finding.severity)} data-testid={`badge-severity-${i}-${fi}`}>
                                {finding.severity}
                              </Badge>
                              <span className="font-medium text-sm" data-testid={`text-finding-title-${i}-${fi}`}>
                                {finding.title}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">{finding.description}</p>
                            {finding.isaReference && (
                              <p className="text-xs text-muted-foreground">Ref: {finding.isaReference}</p>
                            )}
                            <p className="text-sm">
                              <span className="font-medium">Resolution:</span> {finding.resolution}
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </>
      )}
    </div>
  );
}
