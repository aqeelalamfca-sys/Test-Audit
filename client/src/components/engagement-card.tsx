import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RiskBadge, PhaseStatusBadge } from "@/components/status-badge";
import { Progress } from "@/components/ui/progress";
import { PHASE_LABELS, AuditPhaseType, PhaseStatusType, RiskLevelType } from "@shared/schema";
import { ArrowRight, Building2, Calendar, Play, RotateCcw } from "lucide-react";
import { Link } from "wouter";

interface EngagementCardProps {
  id: string;
  clientName: string;
  currentPhase: AuditPhaseType;
  phaseStatus: PhaseStatusType;
  riskRating: RiskLevelType;
  completionPercentage: number;
  fiscalYearEnd?: string;
  industry?: string;
  status?: string;
}

export function EngagementCard({
  id,
  clientName,
  currentPhase,
  phaseStatus,
  riskRating,
  completionPercentage,
  fiscalYearEnd,
  industry,
  status,
}: EngagementCardProps) {
  const isNotStarted = status === "DRAFT" || completionPercentage === 0;
  const actionLabel = isNotStarted ? "Start Audit" : "Resume Audit";
  const ActionIcon = isNotStarted ? Play : RotateCcw;
  return (
    <Card className="hover-elevate transition-all" data-testid={`card-engagement-${id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-foreground truncate" data-testid="engagement-client-name">
              {clientName}
            </h3>
            <div className="flex items-center gap-3 mt-1">
              {industry && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Building2 className="h-3 w-3" />
                  <span>{industry}</span>
                </div>
              )}
              {fiscalYearEnd && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>FYE: {fiscalYearEnd}</span>
                </div>
              )}
            </div>
          </div>
          <RiskBadge level={riskRating} />
        </div>
      </CardHeader>
      <CardContent className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Current Phase</p>
            <p className="text-sm font-medium">{PHASE_LABELS[currentPhase]}</p>
          </div>
          <PhaseStatusBadge status={phaseStatus} />
        </div>

        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span>Overall Progress</span>
            <span className="font-mono">{completionPercentage}%</span>
          </div>
          <Progress value={completionPercentage} className="h-1.5" />
        </div>

        <div className="pt-3 border-t border-border/60">
          <Link href={`/engagement/${id}`}>
            <Button 
              variant={isNotStarted ? "default" : "secondary"} 
              size="sm" 
              className="w-full justify-between" 
              data-testid={`button-start-resume-${id}`}
            >
              <span className="flex items-center gap-2">
                <ActionIcon className="h-4 w-4" />
                {actionLabel}
              </span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
