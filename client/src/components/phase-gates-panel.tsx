import { useEnforcementOptional, type EnforcementPhase, type PhaseGateStatus } from "@/lib/enforcement-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  CheckCircle2, 
  Circle, 
  Lock, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp,
  Shield,
  FileCheck2,
  Clock
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const PHASE_LABELS: Record<EnforcementPhase, string> = {
  ADMINISTRATION: "Administration",
  REQUISITION: "Data Intake",
  PRE_PLANNING: "Pre-Planning",
  PLANNING: "Planning",
  EXECUTION: "Execution",
  EVIDENCE: "Evidence Collection",
  FINALIZATION: "Finalization",
  DELIVERABLES: "Deliverables",
  QR_EQCR: "Quality Review / EQCR",
  INSPECTION: "Inspection"
};

const PHASE_ICONS: Record<EnforcementPhase, React.ComponentType<{ className?: string }>> = {
  ADMINISTRATION: Shield,
  REQUISITION: FileCheck2,
  PRE_PLANNING: FileCheck2,
  PLANNING: FileCheck2,
  EXECUTION: FileCheck2,
  EVIDENCE: FileCheck2,
  FINALIZATION: FileCheck2,
  DELIVERABLES: FileCheck2,
  QR_EQCR: Shield,
  INSPECTION: Shield
};

interface PhaseGatesPanelProps {
  phase: EnforcementPhase;
  className?: string;
  compact?: boolean;
  showActions?: boolean;
  onRequestApproval?: () => void;
}

export function PhaseGatesPanel({ 
  phase, 
  className, 
  compact = false,
  showActions = true,
  onRequestApproval 
}: PhaseGatesPanelProps) {
  const enforcement = useEnforcementOptional();
  const [isExpanded, setIsExpanded] = useState(!compact);

  if (!enforcement || !enforcement.status) {
    return null;
  }

  const { status } = enforcement;
  const phaseStatus = status.phaseStatus[phase];
  
  if (!phaseStatus) {
    return null;
  }

  const PhaseIcon = PHASE_ICONS[phase];
  const progress = enforcement.getPhaseProgress(phase);
  const blockers = enforcement.getBlockedReasons(phase);
  const pendingWorkflows = status.makerCheckerPending.filter(mc => 
    mc.entityType.includes(phase.toLowerCase().replace(/_/g, ""))
  );

  const getStatusBadge = () => {
    if (phaseStatus.isLocked) {
      return <Badge variant="secondary" className="bg-amber-100 text-amber-800"><Lock className="h-3 w-3 mr-1" />Locked</Badge>;
    }
    if (phaseStatus.isComplete) {
      return <Badge variant="secondary" className="bg-green-100 text-green-800"><CheckCircle2 className="h-3 w-3 mr-1" />Complete</Badge>;
    }
    if (!phaseStatus.isAccessible) {
      return <Badge variant="secondary" className="bg-gray-100 text-gray-600"><Lock className="h-3 w-3 mr-1" />Not Accessible</Badge>;
    }
    if (phase === status.currentPhase) {
      return <Badge variant="default"><Circle className="h-3 w-3 mr-1 fill-current" />In Progress</Badge>;
    }
    return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
  };

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <PhaseIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className="text-sm font-medium whitespace-nowrap">{PHASE_LABELS[phase]}</span>
        <span className="text-[11px] text-muted-foreground whitespace-nowrap">
          {phaseStatus.gatesPassed} of {phaseStatus.totalGates} gates passed
        </span>
        {getStatusBadge()}
        {blockers.length > 0 && (
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="destructive" className="text-xs" data-testid="badge-blockers-count">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {blockers.length} Blocker{blockers.length !== 1 ? 's' : ''}
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="font-semibold mb-1">Blockers:</p>
              <ul className="text-xs space-y-1">
                {blockers.slice(0, 3).map((b, i) => (
                  <li key={i}>{b.reason}</li>
                ))}
                {blockers.length > 3 && <li>+{blockers.length - 3} more...</li>}
              </ul>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    );
  }

  return (
    <Card className={cn("border-2", 
      phaseStatus.isComplete && "border-green-200",
      phaseStatus.isLocked && "border-amber-200",
      !phaseStatus.isAccessible && "border-gray-200 opacity-75",
      className
    )}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-lg",
                phaseStatus.isComplete && "bg-green-100",
                phaseStatus.isLocked && "bg-amber-100",
                phase === status.currentPhase && "bg-primary/10",
                !phaseStatus.isAccessible && "bg-gray-100"
              )}>
                <PhaseIcon className={cn("h-5 w-5",
                  phaseStatus.isComplete && "text-green-600",
                  phaseStatus.isLocked && "text-amber-600",
                  phase === status.currentPhase && "text-primary",
                  !phaseStatus.isAccessible && "text-gray-400"
                )} />
              </div>
              <div>
                <CardTitle className="text-lg">{PHASE_LABELS[phase]} Phase</CardTitle>
                <CardDescription>
                  {phaseStatus.gatesPassed} of {phaseStatus.totalGates} gates passed
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge()}
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
          <Progress value={progress.percent} className="mt-3 h-2" />
        </CardHeader>
        
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-2.5">
            {blockers.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200 flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  Outstanding Requirements ({blockers.length})
                </p>
                <ul className="space-y-2">
                  {blockers.map((blocker, idx) => (
                    <li key={idx} className="text-sm text-amber-700 dark:text-amber-300 pl-4 border-l-2 border-amber-300">
                      <p>{blocker.reason}</p>
                      {blocker.resolution && (
                        <p className="text-xs text-muted-foreground mt-0.5">Resolution: {blocker.resolution}</p>
                      )}
                      {blocker.isaReference && (
                        <Badge variant="outline" className="mt-1 text-xs">{blocker.isaReference}</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {pendingWorkflows.length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200 flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4" />
                  Pending Approvals ({pendingWorkflows.length})
                </p>
                <ul className="space-y-1">
                  {pendingWorkflows.map((wf) => (
                    <li key={wf.id} className="text-sm text-blue-700 dark:text-blue-300">
                      {wf.entityType}: Stage "{wf.currentStage}"
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {phaseStatus.isComplete && blockers.length === 0 && (
              <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3">
                <p className="text-sm font-medium text-green-800 dark:text-green-200 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  All gates passed - Phase complete
                </p>
              </div>
            )}

            {showActions && !phaseStatus.isComplete && phaseStatus.isAccessible && blockers.length === 0 && (
              <div className="flex justify-end pt-2">
                <Button onClick={onRequestApproval} size="sm">
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Mark Phase Complete
                </Button>
              </div>
            )}

            {showActions && !phaseStatus.isAccessible && (
              <p className="text-sm text-muted-foreground text-center py-2">
                Complete previous phases to unlock this phase
              </p>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

interface PhaseGatesSummaryProps {
  className?: string;
}

export function PhaseGatesSummary({ className }: PhaseGatesSummaryProps) {
  const enforcement = useEnforcementOptional();

  if (!enforcement || !enforcement.status) {
    return null;
  }

  const { status } = enforcement;
  /** Enforcement phases for summary — see shared/phases.ts for canonical 19-phase workflow */
  const phases: EnforcementPhase[] = [
    "PRE_PLANNING", "REQUISITION", "PLANNING", "EXECUTION",
    "EVIDENCE", "FINALIZATION", "DELIVERABLES", "QR_EQCR", "INSPECTION"
  ];

  const completedPhases = phases.filter(p => status.phaseStatus[p]?.isComplete).length;
  const totalPhases = phases.length;

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Engagement Progress</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mb-2">
          <span className="text-lg font-bold">{completedPhases}/{totalPhases}</span>
          <span className="text-sm text-muted-foreground">phases complete</span>
        </div>
        <Progress value={(completedPhases / totalPhases) * 100} className="h-2" />
        <div className="mt-3 flex flex-wrap gap-1">
          {phases.map(phase => {
            const ps = status.phaseStatus[phase];
            return (
              <Tooltip key={phase}>
                <TooltipTrigger>
                  <div className={cn("w-8 h-2 rounded-full",
                    ps?.isComplete && "bg-green-500",
                    ps?.isLocked && !ps.isComplete && "bg-amber-500",
                    phase === status.currentPhase && !ps?.isComplete && "bg-primary",
                    !ps?.isComplete && !ps?.isLocked && phase !== status.currentPhase && "bg-gray-200"
                  )} />
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">{PHASE_LABELS[phase]}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
