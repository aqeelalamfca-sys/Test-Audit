import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest } from "@/lib/queryClient";
import { 
  CheckCircle2, AlertTriangle, Clock, Lock, Target, 
  ChevronDown, ChevronUp, AlertCircle, FileCheck, 
  Loader2, FileText, Shield, BarChart3
} from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

interface MissingItem {
  phase: string;
  category: string;
  description: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  actionRequired: string;
}

interface PhaseMetric {
  phase: string;
  phaseOrder: number;
  status: string;
  completionPercentage: number;
  startedAt: string | null;
  completedAt: string | null;
  lockedAt: string | null;
  isLocked: boolean;
}

interface ProgressResponse {
  engagement: {
    id: string;
    engagementCode: string;
    engagementType: string;
    currentPhase: string;
    status: string;
  };
  overall: {
    completionPercentage: number;
    completedPhases: number;
    totalPhases: number;
    currentPhase: string;
  };
  phases: PhaseMetric[];
  metrics: {
    risks: { total: number; linkedToTests: number; unlinked: number };
    tests: { total: number; completed: number; pending: number };
    evidence: { total: number };
    misstatements: { total: number; corrected: number; uncorrected: number; totalAmount: number };
    checklists: { total: number; completed: number };
    materialityApproved: boolean;
    engagementLetterSigned: boolean;
    independenceConfirmed: boolean;
  };
  missingItems: MissingItem[];
}

interface GlobalProgressPanelProps {
  engagementId: string;
}

/**
 * Phase labels and routes for progress panel.
 * Backend API returns these keys; routes point to canonical slugs.
 * See shared/phases.ts for full canonical 19-phase workflow.
 */
const phaseLabels: Record<string, string> = {
  ONBOARDING: 'Client Creation',
  PRE_PLANNING: 'Acceptance & Independence',
  INFO_REQUISITION: 'TB / GL Upload',
  PLANNING: 'Planning & Materiality',
  EXECUTION: 'Execution & Testing',
  EVIDENCE: 'Evidence Linking',
  FINALIZATION: 'Finalization',
  DELIVERABLES: 'Opinion / Reports',
  REPORTING: 'Opinion / Reports',
  QR: 'EQCR Review',
  QR_EQCR: 'EQCR Review',
  EQCR: 'EQCR Review',
  INSPECTION: 'Inspection Archive',
};

const phaseRoutes: Record<string, string> = {
  ONBOARDING: 'acceptance',
  PRE_PLANNING: 'acceptance',
  INFO_REQUISITION: 'tb-gl-upload',
  PLANNING: 'materiality',
  EXECUTION: 'execution-testing',
  EVIDENCE: 'evidence-linking',
  FINALIZATION: 'finalization',
  DELIVERABLES: 'opinion-reports',
  REPORTING: 'opinion-reports',
  QR: 'eqcr',
  QR_EQCR: 'eqcr',
  EQCR: 'eqcr',
  INSPECTION: 'inspection',
};

export function GlobalProgressPanel({ engagementId }: GlobalProgressPanelProps) {
  const [showMissing, setShowMissing] = useState(true);
  const [showPhases, setShowPhases] = useState(true);

  const { data, isLoading, error } = useQuery<ProgressResponse>({
    queryKey: ['/api/progress', engagementId, 'comprehensive'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/progress/${engagementId}/comprehensive`);
      return res.json();
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8 text-muted-foreground">
          Unable to load progress data
        </CardContent>
      </Card>
    );
  }

  const getStatusIcon = (status: string, isLocked: boolean) => {
    if (isLocked) return <Lock className="h-4 w-4 text-green-600" />;
    switch (status) {
      case 'COMPLETED': return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'IN_PROGRESS': return <Clock className="h-4 w-4 text-blue-600" />;
      case 'NOT_STARTED': return <AlertCircle className="h-4 w-4 text-gray-400" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string, isLocked: boolean) => {
    if (isLocked) return <Badge variant="outline" className="text-green-600 border-green-600">Locked</Badge>;
    switch (status) {
      case 'COMPLETED': return <Badge variant="outline" className="text-green-600 border-green-600">Complete</Badge>;
      case 'IN_PROGRESS': return <Badge variant="secondary">In Progress</Badge>;
      case 'NOT_STARTED': return <Badge variant="outline">Not Started</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: 'HIGH' | 'MEDIUM' | 'LOW') => {
    switch (priority) {
      case 'HIGH': return <Badge variant="destructive">High</Badge>;
      case 'MEDIUM': return <Badge variant="secondary">Medium</Badge>;
      case 'LOW': return <Badge variant="outline">Low</Badge>;
    }
  };

  const highPriorityCount = data.missingItems.filter(i => i.priority === 'HIGH').length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Engagement Progress
          </CardTitle>
          <CardDescription>
            {data.engagement?.engagementCode} - Overall completion status
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Overall Completion</span>
              <span className="text-muted-foreground">{data.overall.completionPercentage}%</span>
            </div>
            <Progress value={data.overall.completionPercentage} className="h-3" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{data.overall.completedPhases} of {data.overall.totalPhases} phases completed</span>
              <span>Current: {phaseLabels[data.overall.currentPhase] || data.overall.currentPhase}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
            <div className="text-center p-2 bg-muted/50 rounded-lg">
              <p className="text-2xl font-semibold">{data.metrics.risks.total}</p>
              <p className="text-xs text-muted-foreground">Risks</p>
            </div>
            <div className="text-center p-2 bg-muted/50 rounded-lg">
              <p className="text-2xl font-semibold">{data.metrics.tests.completed}/{data.metrics.tests.total}</p>
              <p className="text-xs text-muted-foreground">Tests Done</p>
            </div>
            <div className="text-center p-2 bg-muted/50 rounded-lg">
              <p className="text-2xl font-semibold">{data.metrics.evidence.total}</p>
              <p className="text-xs text-muted-foreground">Evidence</p>
            </div>
            <div className="text-center p-2 bg-muted/50 rounded-lg">
              <p className="text-2xl font-semibold">{data.metrics.checklists.completed}/{data.metrics.checklists.total}</p>
              <p className="text-xs text-muted-foreground">Checklists</p>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            {data.metrics.materialityApproved ? (
              <Badge variant="outline" className="gap-1 text-green-600">
                <CheckCircle2 className="h-3 w-3" />
                Materiality Approved
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-amber-600">
                <AlertTriangle className="h-3 w-3" />
                Materiality Pending
              </Badge>
            )}
            {data.metrics.engagementLetterSigned ? (
              <Badge variant="outline" className="gap-1 text-green-600">
                <FileCheck className="h-3 w-3" />
                Letter Signed
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-amber-600">
                <AlertTriangle className="h-3 w-3" />
                Letter Pending
              </Badge>
            )}
            {data.metrics.independenceConfirmed ? (
              <Badge variant="outline" className="gap-1 text-green-600">
                <Shield className="h-3 w-3" />
                Independence OK
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-amber-600">
                <AlertTriangle className="h-3 w-3" />
                Independence Pending
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <Collapsible open={showPhases} onOpenChange={setShowPhases}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="h-5 w-5" />
                  Phase Progress
                </CardTitle>
                {showPhases ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-2">
                  {data.phases.map((phase) => (
                    <Link 
                      key={phase.phase}
                      href={`/workspace/${engagementId}/${phaseRoutes[phase.phase] || 'planning'}`}
                    >
                      <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                        {getStatusIcon(phase.status, phase.isLocked)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-sm truncate">
                              {phaseLabels[phase.phase] || phase.phase}
                            </span>
                            {getStatusBadge(phase.status, phase.isLocked)}
                          </div>
                          <Progress value={phase.completionPercentage} className="h-1.5" />
                        </div>
                        <span className="text-xs text-muted-foreground w-10 text-right">
                          {phase.completionPercentage}%
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={showMissing} onOpenChange={setShowMissing}>
        <Card className={highPriorityCount > 0 ? "border-amber-500" : ""}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-5 w-5" />
                  What's Missing
                  {data.missingItems.length > 0 && (
                    <Badge variant={highPriorityCount > 0 ? "destructive" : "secondary"}>
                      {data.missingItems.length} items
                    </Badge>
                  )}
                </CardTitle>
                {showMissing ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              {data.missingItems.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-green-600 py-4 justify-center">
                  <CheckCircle2 className="h-5 w-5" />
                  All items complete! No missing requirements.
                </div>
              ) : (
                <ScrollArea className="max-h-[300px]">
                  <div className="space-y-3">
                    {data.missingItems.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {getPriorityBadge(item.priority)}
                            <Badge variant="outline" className="text-xs">
                              {phaseLabels[item.phase] || item.phase}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{item.category}</span>
                          </div>
                          <p className="text-sm font-medium">{item.description}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Action: {item.actionRequired}
                          </p>
                        </div>
                        <Link href={`/workspace/${engagementId}/${phaseRoutes[item.phase] || 'planning'}`}>
                          <Button variant="outline" size="sm">
                            Go to Phase
                          </Button>
                        </Link>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
