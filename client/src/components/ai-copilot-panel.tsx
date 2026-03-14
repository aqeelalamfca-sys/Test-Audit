import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertTriangle,
  Info,
  AlertCircle,
  Lightbulb,
  ChevronDown,
  ChevronRight,
  X,
  Sparkles,
  Link2,
  ShieldCheck,
  TrendingUp,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { cn } from "@/lib/utils";

interface CopilotObservation {
  id: string;
  type: "warning" | "info" | "critical" | "suggestion";
  category: string;
  observation: string;
  whyItMatters: string;
  isaReference?: string;
  suggestedAction: string;
  priority: "high" | "medium" | "low";
  fsHead?: string;
  timestamp: Date;
  dismissed: boolean;
}

interface LinkageStatus {
  risksWithoutProcedures: number;
  proceduresWithoutEvidence: number;
  fsHeadsWithoutConclusion: number;
  adjustmentsNotPosted: number;
  totalGaps: number;
}

interface ISAScoreDetail {
  score: number;
  weight: number;
  description: string;
}

interface CopilotAnalysis {
  observations: CopilotObservation[];
  linkageStatus: LinkageStatus;
  qualityScore: number;
  isaComplianceScore: number;
  isaScores?: Record<string, ISAScoreDetail>;
  disclaimer: string;
}

interface AICopilotPanelProps {
  engagementId: string;
  currentFsHead?: string;
  auditPhase: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const typeIcons = {
  critical: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  suggestion: Lightbulb,
};

const typeColors = {
  critical: "text-red-600 dark:text-red-400",
  warning: "text-amber-600 dark:text-amber-400",
  info: "text-blue-600 dark:text-blue-400",
  suggestion: "text-green-600 dark:text-green-400",
};

const priorityBadgeVariants: Record<string, "destructive" | "outline" | "secondary"> = {
  high: "destructive",
  medium: "outline",
  low: "secondary",
};

export function AICopilotPanel({
  engagementId,
  currentFsHead,
  auditPhase,
  collapsed = false,
  onToggleCollapse,
}: AICopilotPanelProps) {
  const queryClient = useQueryClient();
  const [expandedObservations, setExpandedObservations] = useState<Set<string>>(new Set());
  const [showDismissed, setShowDismissed] = useState(false);

  const { data: dismissedData } = useQuery<{ dismissedIds: string[] }>({
    queryKey: ["/api/ai/copilot/dismissed", engagementId],
    queryFn: async () => {
      const response = await fetchWithAuth(`/api/ai/copilot/dismissed/${engagementId}`);
      if (!response.ok) throw new Error("Failed to fetch dismissed");
      return response.json();
    },
    staleTime: 30000,
    enabled: !!engagementId,
  });

  const dismissedObservations = new Set(dismissedData?.dismissedIds || []);

  const { data: analysis, isLoading, refetch } = useQuery<CopilotAnalysis>({
    queryKey: ["/api/ai/copilot/analysis", engagementId, currentFsHead, auditPhase],
    queryFn: async () => {
      const response = await fetchWithAuth("/api/ai/copilot/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          engagementId,
          currentFsHead,
          auditPhase,
        }),
      });
      if (!response.ok) throw new Error("Failed to fetch analysis");
      return response.json();
    },
    staleTime: 30000,
    enabled: !!engagementId,
  });

  const dismissMutation = useMutation({
    mutationFn: async ({ observationId, reason }: { observationId: string; reason?: string }) => {
      const response = await fetchWithAuth("/api/ai/copilot/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          engagementId,
          observationId,
          reason,
        }),
      });
      if (!response.ok) throw new Error("Failed to dismiss observation");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/copilot/dismissed", engagementId] });
    },
  });

  const toggleObservation = (id: string) => {
    setExpandedObservations(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleDismiss = (observationId: string) => {
    dismissMutation.mutate({ observationId });
  };

  const visibleObservations = analysis?.observations.filter(
    obs => showDismissed || !dismissedObservations.has(obs.id)
  ) || [];

  const criticalCount = visibleObservations.filter(o => o.type === "critical").length;
  const warningCount = visibleObservations.filter(o => o.type === "warning").length;

  if (collapsed) {
    return (
      <div
        data-testid="copilot-collapsed"
        className="fixed right-4 bottom-4 z-50"
      >
        <Button
          size="icon"
          variant="default"
          className="h-12 w-12 rounded-full shadow-lg"
          onClick={onToggleCollapse}
          data-testid="button-expand-copilot"
        >
          <Sparkles className="h-5 w-5" />
          {(criticalCount > 0 || warningCount > 0) && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-xs text-white flex items-center justify-center">
              {criticalCount + warningCount}
            </span>
          )}
        </Button>
      </div>
    );
  }

  return (
    <Card
      data-testid="copilot-panel"
      className="w-80 flex flex-col max-h-[calc(100vh-8rem)] shadow-lg"
    >
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <CardTitle className="text-sm font-medium">AI Audit Co-Pilot</CardTitle>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => refetch()}
            data-testid="button-refresh-copilot"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          {onToggleCollapse && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={onToggleCollapse}
              data-testid="button-collapse-copilot"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden flex flex-col gap-3 pb-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <div>
              <div className="text-xs text-muted-foreground">ISA Compliance</div>
              <div className="font-semibold text-sm">{analysis?.isaComplianceScore ?? 0}%</div>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
            <TrendingUp className="h-4 w-4 text-primary" />
            <div>
              <div className="text-xs text-muted-foreground">Quality Score</div>
              <div className="font-semibold text-sm">{analysis?.qualityScore ?? 0}%</div>
            </div>
          </div>
        </div>

        {analysis?.isaScores && (
          <div className="p-2 rounded-md bg-muted/30 text-xs space-y-1">
            <div className="font-medium text-muted-foreground mb-1">ISA Breakdown</div>
            {Object.entries(analysis.isaScores).map(([key, { score, description }]) => (
              <div key={key} className="flex justify-between items-center">
                <span className="text-muted-foreground truncate mr-2">{description}</span>
                <span className={`font-medium ${score >= 80 ? "text-green-600" : score >= 60 ? "text-amber-600" : "text-red-600"}`}>
                  {Math.round(score)}%
                </span>
              </div>
            ))}
          </div>
        )}

        {analysis?.linkageStatus && analysis.linkageStatus.totalGaps > 0 && (
          <div className="p-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2 mb-1">
              <Link2 className="h-4 w-4 text-amber-600" />
              <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                Linkage Gaps: {analysis.linkageStatus.totalGaps}
              </span>
            </div>
            <div className="text-xs text-amber-600 dark:text-amber-500 space-y-0.5">
              {analysis.linkageStatus.risksWithoutProcedures > 0 && (
                <div>{analysis.linkageStatus.risksWithoutProcedures} risk(s) without procedures</div>
              )}
              {analysis.linkageStatus.proceduresWithoutEvidence > 0 && (
                <div>{analysis.linkageStatus.proceduresWithoutEvidence} procedure(s) without evidence</div>
              )}
              {analysis.linkageStatus.fsHeadsWithoutConclusion > 0 && (
                <div>{analysis.linkageStatus.fsHeadsWithoutConclusion} FS Head(s) without conclusion</div>
              )}
              {analysis.linkageStatus.adjustmentsNotPosted > 0 && (
                <div>{analysis.linkageStatus.adjustmentsNotPosted} adjustment(s) not posted</div>
              )}
            </div>
          </div>
        )}

        <Separator />

        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            Observations ({visibleObservations.length})
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-xs"
            onClick={() => setShowDismissed(!showDismissed)}
            data-testid="button-toggle-dismissed"
          >
            {showDismissed ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
            {showDismissed ? "Hide dismissed" : "Show all"}
          </Button>
        </div>

        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-2">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : visibleObservations.length === 0 ? (
            <div className="text-center py-2 text-muted-foreground text-sm">
              <ShieldCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
              No observations at this time
            </div>
          ) : (
            <div className="space-y-2">
              {visibleObservations.map((obs) => {
                const Icon = typeIcons[obs.type];
                const isExpanded = expandedObservations.has(obs.id);
                const isDismissed = dismissedObservations.has(obs.id);

                return (
                  <Collapsible
                    key={obs.id}
                    open={isExpanded}
                    onOpenChange={() => toggleObservation(obs.id)}
                  >
                    <div
                      className={cn(
                        "p-2 rounded-md border",
                        isDismissed && "opacity-50",
                        obs.type === "critical" && "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30",
                        obs.type === "warning" && "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30",
                        obs.type === "info" && "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30",
                        obs.type === "suggestion" && "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30"
                      )}
                      data-testid={`observation-${obs.id}`}
                    >
                      <CollapsibleTrigger asChild>
                        <div className="flex items-start gap-2 cursor-pointer">
                          <Icon className={cn("h-4 w-4 mt-0.5 flex-shrink-0", typeColors[obs.type])} />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium leading-tight">{obs.observation}</div>
                            <div className="flex items-center gap-1 mt-1">
                              <Badge variant={priorityBadgeVariants[obs.priority]} className="h-4 text-[10px]">
                                {obs.priority}
                              </Badge>
                              {obs.isaReference && (
                                <Badge variant="outline" className="h-4 text-[10px]">
                                  {obs.isaReference}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {!isDismissed && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-5 w-5"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDismiss(obs.id);
                                }}
                                data-testid={`button-dismiss-${obs.id}`}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            )}
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className="mt-2 pt-2 border-t border-current/10 space-y-2">
                          <div>
                            <div className="text-[10px] font-medium text-muted-foreground uppercase">Why It Matters</div>
                            <div className="text-xs">{obs.whyItMatters}</div>
                          </div>
                          <div>
                            <div className="text-[10px] font-medium text-muted-foreground uppercase">Suggested Action</div>
                            <div className="text-xs">{obs.suggestedAction}</div>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <div className="text-[10px] text-muted-foreground text-center italic">
          {analysis?.disclaimer || "AI-assisted — subject to professional judgment"}
        </div>
      </CardContent>
    </Card>
  );
}

export function AICopilotToggle({
  engagementId,
  currentFsHead,
  auditPhase,
}: Omit<AICopilotPanelProps, "collapsed" | "onToggleCollapse">) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed right-4 bottom-4 z-50">
      {isOpen ? (
        <AICopilotPanel
          engagementId={engagementId}
          currentFsHead={currentFsHead}
          auditPhase={auditPhase}
          collapsed={false}
          onToggleCollapse={() => setIsOpen(false)}
        />
      ) : (
        <AICopilotPanel
          engagementId={engagementId}
          currentFsHead={currentFsHead}
          auditPhase={auditPhase}
          collapsed={true}
          onToggleCollapse={() => setIsOpen(true)}
        />
      )}
    </div>
  );
}
