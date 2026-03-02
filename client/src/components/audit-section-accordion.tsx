import { useCallback, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Card } from "@/components/ui/card";
import {
  ChevronDown, Lock, FileText, MessageSquare, Clock,
  Save, ArrowLeft, ArrowRight, Send
} from "lucide-react";
import { StatusPill, type AuditStepStatus } from "@/components/audit-phase-stepper";

export interface AuditSection {
  id: string;
  code: string;
  title: string;
  isaRef?: string;
  status: AuditStepStatus;
  completionPercent: number;
  evidenceCount?: number;
  openNotesCount?: number;
  openNotesHighCount?: number;
  lastUpdatedAt?: string;
  lastUpdatedBy?: string;
  isLocked?: boolean;
  lockReasons?: string[];
  mandatoryFieldsTotal?: number;
  mandatoryFieldsFilled?: number;
}

interface AuditSectionAccordionProps {
  sections: AuditSection[];
  activeSectionId: string | null;
  onSectionChange: (sectionId: string) => void;
  children: (section: AuditSection) => ReactNode;
  className?: string;
  gatingEnabled?: boolean;
}

function getTrafficColor(status: AuditStepStatus): "red" | "amber" | "green" {
  if (status === "NOT_STARTED" || status === "RETURNED") return "red";
  if (status === "APPROVED" || status === "LOCKED") return "green";
  return "amber";
}

const TRAFFIC_BG = {
  red: "border-l-red-500",
  amber: "border-l-amber-500",
  green: "border-l-emerald-500",
};

function SectionHeader({ section, isExpanded, isLocked, onClick }: {
  section: AuditSection;
  isExpanded: boolean;
  isLocked: boolean;
  onClick: () => void;
}) {
  const traffic = getTrafficColor(section.status);
  const timeAgo = section.lastUpdatedAt ? formatTimeAgo(section.lastUpdatedAt) : null;

  return (
    <button
      onClick={isLocked ? undefined : onClick}
      disabled={isLocked}
      className={cn(
        "w-full text-left border-l-4 rounded-lg border transition-all",
        TRAFFIC_BG[traffic],
        isExpanded
          ? "bg-card shadow-sm ring-1 ring-primary/20"
          : "bg-card/60 hover:bg-card hover:shadow-sm",
        isLocked && "opacity-60 cursor-not-allowed"
      )}
      data-testid={`section-header-${section.id}`}
    >
      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <ChevronDown className={cn(
              "h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform",
              isExpanded && "rotate-180"
            )} />

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono font-semibold text-primary">{section.code}</span>
                <span className="text-sm font-medium truncate">{section.title}</span>
                {section.isaRef && (
                  <span className="text-[10px] text-muted-foreground font-mono">{section.isaRef}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {section.evidenceCount !== undefined && section.evidenceCount > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <FileText className="h-3 w-3" />
                    <span className="text-[10px]">{section.evidenceCount}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="text-xs">{section.evidenceCount} evidence file(s)</TooltipContent>
              </Tooltip>
            )}

            {section.openNotesCount !== undefined && section.openNotesCount > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={cn(
                    "flex items-center gap-1",
                    (section.openNotesHighCount || 0) > 0 ? "text-red-600" : "text-amber-600"
                  )}>
                    <MessageSquare className="h-3 w-3" />
                    <span className="text-[10px]">{section.openNotesCount}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="text-xs">
                  {section.openNotesCount} open note(s){(section.openNotesHighCount || 0) > 0 && `, ${section.openNotesHighCount} high priority`}
                </TooltipContent>
              </Tooltip>
            )}

            <div className="w-16">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[9px] text-muted-foreground">{section.completionPercent}%</span>
              </div>
              <Progress
                value={section.completionPercent}
                className={cn("h-1", traffic === "green" ? "[&>div]:bg-emerald-500" : traffic === "red" ? "[&>div]:bg-red-400" : "[&>div]:bg-amber-400")}
              />
            </div>

            <StatusPill status={section.status} />

            {isLocked && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="text-xs max-w-[200px]">
                  <div className="font-medium mb-1">Why locked?</div>
                  <ul className="list-disc pl-3 space-y-0.5">
                    {(section.lockReasons || ["Previous section not completed"]).map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {timeAgo && (
          <div className="flex items-center gap-1 mt-1 ml-7 text-[10px] text-muted-foreground">
            <Clock className="h-2.5 w-2.5" />
            <span>{timeAgo}</span>
            {section.lastUpdatedBy && <span>by {section.lastUpdatedBy}</span>}
          </div>
        )}
      </div>
    </button>
  );
}

export function AuditSectionAccordion({
  sections,
  activeSectionId,
  onSectionChange,
  children,
  className,
  gatingEnabled = true,
}: AuditSectionAccordionProps) {
  const isSectionLocked = useCallback((index: number) => {
    if (!gatingEnabled || index === 0) return false;
    const prev = sections[index - 1];
    if (!prev) return false;
    const completedStatuses: AuditStepStatus[] = ["COMPLETED", "PREPARED", "IN_REVIEW", "APPROVED", "LOCKED"];
    return !completedStatuses.includes(prev.status);
  }, [sections, gatingEnabled]);

  return (
    <div className={cn("space-y-2", className)} data-testid="audit-section-accordion">
      {sections.map((section, index) => {
        const isExpanded = section.id === activeSectionId;
        const isLocked = section.isLocked || isSectionLocked(index);

        return (
          <div key={section.id} data-testid={`section-${section.id}`}>
            <SectionHeader
              section={section}
              isExpanded={isExpanded}
              isLocked={isLocked}
              onClick={() => onSectionChange(isExpanded ? "" : section.id)}
            />
            {isExpanded && !isLocked && (
              <Card className="mt-1 border-l-4 border-l-primary/30 rounded-t-none" data-testid={`section-content-${section.id}`}>
                <div className="p-4">
                  {children(section)}
                </div>
              </Card>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface SectionActionBarProps {
  onBack?: () => void;
  onSave?: () => Promise<void> | void;
  onSaveNext?: () => Promise<void> | void;
  onSubmitForReview?: () => void;
  isSaving?: boolean;
  isDirty?: boolean;
  canSubmitForReview?: boolean;
  showSubmitForReview?: boolean;
  isFirstSection?: boolean;
  isLastSection?: boolean;
}

export function SectionActionBar({
  onBack,
  onSave,
  onSaveNext,
  onSubmitForReview,
  isSaving = false,
  isDirty = false,
  canSubmitForReview = false,
  showSubmitForReview = false,
  isFirstSection = false,
  isLastSection = false,
}: SectionActionBarProps) {
  return (
    <div className="flex items-center justify-between mt-4 pt-3 border-t" data-testid="section-action-bar">
      <div>
        {!isFirstSection && onBack && (
          <Button variant="outline" size="sm" onClick={onBack} disabled={isSaving} data-testid="btn-section-back">
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Back
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2">
        {onSave && (
          <Button variant="outline" size="sm" onClick={onSave} disabled={isSaving || !isDirty} data-testid="btn-section-save">
            <Save className="h-3.5 w-3.5 mr-1" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
        )}

        {onSaveNext && !isLastSection && (
          <Button size="sm" onClick={onSaveNext} disabled={isSaving} data-testid="btn-section-save-next">
            {isSaving ? "Saving..." : "Save & Next"}
            <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        )}

        {showSubmitForReview && isLastSection && (
          <Button
            size="sm"
            variant="default"
            onClick={onSubmitForReview}
            disabled={isSaving || !canSubmitForReview}
            data-testid="btn-submit-review"
          >
            <Send className="h-3.5 w-3.5 mr-1" />
            Submit for Review
          </Button>
        )}
      </div>
    </div>
  );
}

interface SectionTemplateProps {
  objective?: string;
  isaRef?: string;
  children: ReactNode;
  evidencePanel?: ReactNode;
  conclusionPanel?: ReactNode;
  notesThread?: ReactNode;
  checklistPanel?: ReactNode;
}

export function SectionTemplate({
  objective,
  isaRef,
  children,
  evidencePanel,
  conclusionPanel,
  notesThread,
  checklistPanel,
}: SectionTemplateProps) {
  return (
    <div className="space-y-4" data-testid="section-template">
      {objective && (
        <div className="p-3 bg-muted/40 rounded-lg border border-muted" data-testid="section-objective">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Objective</span>
            {isaRef && <Badge variant="outline" className="text-[9px] h-4 px-1">{isaRef}</Badge>}
          </div>
          <p className="text-xs text-foreground/80">{objective}</p>
        </div>
      )}

      <div data-testid="section-work-area">
        {children}
      </div>

      {evidencePanel && (
        <div data-testid="section-evidence">{evidencePanel}</div>
      )}

      {conclusionPanel && (
        <div data-testid="section-conclusion">{conclusionPanel}</div>
      )}

      {checklistPanel && (
        <div data-testid="section-checklist">{checklistPanel}</div>
      )}

      {notesThread && (
        <div data-testid="section-notes">{notesThread}</div>
      )}
    </div>
  );
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
