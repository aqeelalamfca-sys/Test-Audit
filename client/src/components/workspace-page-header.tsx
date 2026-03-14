import { useEnforcementOptional, type EnforcementPhase } from "@/lib/enforcement-context";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { SignOffBar } from "@/components/sign-off-bar";
import {
  AlertTriangle,
  CheckCircle2,
  Lock,
  Clock,
  Eye,
} from "lucide-react";

interface WorkspacePageHeaderProps {
  title: string;
  phase: string;
  section?: string;
  isaReferences?: string[];
  description?: string;
  completionPercentage?: number;
  showSignoff?: boolean;
  children?: React.ReactNode;
}

const PHASE_STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; icon: typeof CheckCircle2 }> = {
  NOT_STARTED: { label: "Not Started", variant: "outline", icon: Clock },
  IN_PROGRESS: { label: "In Progress", variant: "default", icon: Clock },
  UNDER_REVIEW: { label: "Under Review", variant: "secondary", icon: Eye },
  COMPLETED: { label: "Completed", variant: "secondary", icon: CheckCircle2 },
  LOCKED: { label: "Locked", variant: "outline", icon: Lock },
};

export function WorkspacePageHeader({ 
  title, 
  phase, 
  section,
  isaReferences = [], 
  description,
  completionPercentage,
  showSignoff = true,
  children 
}: WorkspacePageHeaderProps) {
  const enforcement = useEnforcementOptional();

  const blockers = enforcement?.getBlockedReasons(phase as EnforcementPhase) || [];
  const phaseStatus = enforcement?.status?.phaseStatus?.[phase as EnforcementPhase];
  const statusConfig = PHASE_STATUS_CONFIG[phaseStatus?.isComplete ? "COMPLETED" : phaseStatus?.isLocked ? "LOCKED" : phaseStatus?.isAccessible ? "IN_PROGRESS" : "NOT_STARTED"];
  const StatusIcon = statusConfig?.icon || Clock;
  const progress = completionPercentage ?? (phaseStatus?.totalGates ? Math.round((phaseStatus.gatesPassed / phaseStatus.totalGates) * 100) : 0);

  const signoffSection = section || phase;

  return (
    <div className="border-b bg-gradient-to-r from-background to-muted/30 px-3 py-2.5" data-testid="workspace-page-header">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <h1 className="text-lg font-semibold whitespace-nowrap" data-testid="text-page-title">{title}</h1>
          {statusConfig && (
            <Badge variant={statusConfig.variant} data-testid="badge-phase-status">
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusConfig.label}
            </Badge>
          )}
          {isaReferences.map((ref) => (
            <Badge key={ref} variant="outline" className="text-xs" data-testid={`badge-isa-${ref}`}>
              {ref}
            </Badge>
          ))}
          {progress > 0 && (
            <div className="flex items-center gap-1.5 min-w-[120px] max-w-[160px]" data-testid="progress-section">
              <Progress value={progress} className="h-1.5 flex-1" />
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {progress}%
              </span>
            </div>
          )}
          {blockers.length > 0 && (
            <Badge variant="outline" className="text-xs text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700" data-testid="blockers-section">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {blockers.length} blocker{blockers.length > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {children}
        </div>
      </div>
      {showSignoff && (
        <div className="mt-2" data-testid="workspace-signoff-section">
          <SignOffBar
            phase={phase}
            section={signoffSection}
            compact
          />
        </div>
      )}
    </div>
  );
}
