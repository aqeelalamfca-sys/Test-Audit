import { ReactNode, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type {
  WorkflowTabKey,
  TabGate,
} from "./workflow-spec";

interface SubTabShellProps {
  tabKey: WorkflowTabKey;
  children: ReactNode;
  gates?: TabGate[];
  contextualActions?: {
    id: string;
    label: string;
    icon: ReactNode;
    onClick: () => void;
    disabled?: boolean;
    disabledReason?: string;
    loading?: boolean;
  }[];
  headerContent?: ReactNode;
}

function CompactStatus({ gates }: { gates: TabGate[] }) {
  const { toast } = useToast();
  const shownRef = useRef(false);
  const failCount = gates.filter(g => g.check === 'FAIL').length;
  const warnCount = gates.filter(g => g.check === 'WARNING').length;
  const allPass = gates.length > 0 && failCount === 0 && warnCount === 0 && gates.some(g => g.check === 'PASS');

  useEffect(() => {
    if (shownRef.current) return;
    const issues = gates.filter(g => g.check === 'FAIL' || g.check === 'WARNING');
    if (issues.length > 0) {
      shownRef.current = true;
      const descriptions = issues.map(g => `${g.label}: ${g.description}`).join('\n');
      toast({
        title: `${issues.length} ${issues.length === 1 ? 'issue' : 'issues'} detected`,
        description: descriptions,
        variant: issues.some(g => g.check === 'FAIL') ? 'destructive' : 'default',
      });
    }
  }, [gates, toast]);

  if (gates.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {allPass && (
        <Badge variant="outline" className="gap-1 no-default-hover-elevate text-xs bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800" data-testid="badge-gates-all-pass">
          <CheckCircle2 className="h-3 w-3" />
          All checks pass
        </Badge>
      )}
      {failCount > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Badge variant="outline" className="gap-1 no-default-hover-elevate text-xs bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800" data-testid="badge-gates-fail">
                <X className="h-3 w-3" />
                {failCount} issue{failCount > 1 ? 's' : ''}
              </Badge>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="space-y-1">
              {gates.filter(g => g.check === 'FAIL').map(g => (
                <p key={g.gateId} className="text-xs">{g.label}: {g.description}</p>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      )}
      {warnCount > 0 && (
        <Badge variant="outline" className="gap-1 no-default-hover-elevate text-xs bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800" data-testid="badge-gates-warn">
          <AlertTriangle className="h-3 w-3" />
          {warnCount} warning{warnCount > 1 ? 's' : ''}
        </Badge>
      )}
    </div>
  );
}

export function SubTabShell({
  tabKey,
  children,
  gates = [],
  contextualActions = [],
  headerContent,
}: SubTabShellProps) {

  return (
    <div className="flex flex-col h-full" data-testid={`subtab-shell-${tabKey}`}>
      {(headerContent || contextualActions.length > 0 || gates.length > 0) && (
        <div className="flex items-center justify-between gap-2 border-b py-1.5 px-1 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {headerContent}
            <CompactStatus gates={gates} />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {contextualActions.map((action) => {
              const btn = (
                <Button
                  key={action.id}
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={action.onClick}
                  disabled={action.disabled || action.loading}
                  data-testid={`button-action-${action.id}`}
                >
                  {action.loading ? <Loader2 className="h-3 w-3 animate-spin" /> : action.icon}
                  {action.label}
                </Button>
              );
              if (action.disabled && action.disabledReason) {
                return (
                  <Tooltip key={action.id}>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">{btn}</span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p className="text-xs">{action.disabledReason}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              }
              return btn;
            })}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto py-1">
        {children}
      </div>
    </div>
  );
}
