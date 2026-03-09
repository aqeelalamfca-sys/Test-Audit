import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  CheckCircle2, Circle, AlertCircle, Lock, ChevronRight, 
  ChevronLeft, Save, X, ArrowRight
} from "lucide-react";

export interface WizardStep {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: React.ReactNode;
  status: "pending" | "in_progress" | "completed" | "blocked" | "error";
  requiredFields?: number;
  completedFields?: number;
  isBlocking?: boolean;
}

interface WizardStepperProps {
  steps: WizardStep[];
  currentStepId: string;
  onStepChange: (stepId: string) => void;
  orientation?: "horizontal" | "vertical";
  showProgress?: boolean;
  showMissingItems?: boolean;
  missingItems?: string[];
}

const STATUS_CONFIG = {
  pending: { icon: Circle, color: "text-muted-foreground", bg: "bg-muted" },
  in_progress: { icon: AlertCircle, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950" },
  completed: { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-50 dark:bg-green-950" },
  blocked: { icon: Lock, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950" },
  error: { icon: AlertCircle, color: "text-destructive", bg: "bg-destructive/10" },
};

export function WizardStepper({
  steps,
  currentStepId,
  onStepChange,
  orientation = "vertical",
  showProgress = true,
  showMissingItems = true,
  missingItems = [],
}: WizardStepperProps) {
  const currentIndex = steps.findIndex((s) => s.id === currentStepId);
  const completedSteps = steps.filter((s) => s.status === "completed").length;
  const progress = steps.length > 0 ? Math.round((completedSteps / steps.length) * 100) : 0;

  const totalRequired = steps.reduce((acc, s) => acc + (s.requiredFields || 0), 0);
  const totalCompleted = steps.reduce((acc, s) => acc + (s.completedFields || 0), 0);

  if (orientation === "horizontal") {
    return (
      <div className="space-y-4">
        {showProgress && (
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium">Overall Progress</span>
                <span className="text-xs text-muted-foreground">{progress}% Complete</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
            {totalRequired > 0 && (
              <Badge variant="outline" className="text-xs">
                {totalCompleted}/{totalRequired} fields
              </Badge>
            )}
          </div>
        )}

        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {steps.map((step, index) => {
            const isActive = step.id === currentStepId;
            const config = STATUS_CONFIG[step.status];
            const StatusIcon = config.icon;

            return (
              <button
                key={step.id}
                onClick={() => onStepChange(step.id)}
                className={`
                  group relative flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium
                  whitespace-nowrap transition-all min-w-fit
                  ${isActive 
                    ? "bg-primary text-primary-foreground shadow-sm" 
                    : `${config.bg} ${config.color} hover:opacity-80`
                  }
                `}
              >
                <span className={`
                  flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold
                  ${isActive ? "bg-primary-foreground text-primary" : "bg-background"}
                `}>
                  {step.status === "completed" ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    index + 1
                  )}
                </span>
                <span>{step.shortLabel}</span>
                {step.status === "blocked" && <Lock className="h-3 w-3" />}
              </button>
            );
          })}
        </div>

        {showMissingItems && missingItems.length > 0 && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                  {missingItems.length} item(s) required to proceed
                </p>
                <ul className="mt-1 text-xs text-amber-600 dark:text-amber-400 list-disc list-inside">
                  {missingItems.slice(0, 5).map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                  {missingItems.length > 5 && (
                    <li>...and {missingItems.length - 5} more</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <Card className="p-4 space-y-4 sticky top-4">
      {showProgress && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Progress</span>
            <span className="text-xs text-muted-foreground">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          {totalRequired > 0 && (
            <p className="text-xs text-muted-foreground">
              {totalCompleted} of {totalRequired} required fields completed
            </p>
          )}
        </div>
      )}

      <ScrollArea className="h-[400px] pr-2">
        <div className="space-y-1">
          {steps.map((step, index) => {
            const isActive = step.id === currentStepId;
            const config = STATUS_CONFIG[step.status];
            const StatusIcon = config.icon;

            return (
              <button
                key={step.id}
                onClick={() => onStepChange(step.id)}
                className={`
                  w-full flex items-start gap-3 p-3 rounded-lg text-left transition-all
                  ${isActive 
                    ? "bg-primary text-primary-foreground" 
                    : "hover:bg-muted/50"
                  }
                `}
              >
                <div className={`
                  flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold flex-shrink-0
                  ${isActive 
                    ? "bg-primary-foreground text-primary" 
                    : config.bg + " " + config.color
                  }
                `}>
                  {step.status === "completed" ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : step.status === "blocked" ? (
                    <Lock className="h-3.5 w-3.5" />
                  ) : (
                    index + 1
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${isActive ? "" : "text-foreground"}`}>
                    {step.label}
                  </p>
                  <p className={`text-xs truncate ${isActive ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {step.description}
                  </p>
                  {step.requiredFields && step.requiredFields > 0 && (
                    <div className="flex items-center gap-1 mt-1">
                      <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${isActive ? "bg-primary-foreground" : "bg-primary"}`}
                          style={{ width: `${((step.completedFields || 0) / step.requiredFields) * 100}%` }}
                        />
                      </div>
                      <span className={`text-[10px] ${isActive ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        {step.completedFields || 0}/{step.requiredFields}
                      </span>
                    </div>
                  )}
                </div>
                <ChevronRight className={`h-4 w-4 flex-shrink-0 ${isActive ? "" : "text-muted-foreground"}`} />
              </button>
            );
          })}
        </div>
      </ScrollArea>

      {showMissingItems && missingItems.length > 0 && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                Missing Items
              </p>
              <ul className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                {missingItems.slice(0, 3).map((item, i) => (
                  <li key={i} className="truncate">• {item}</li>
                ))}
                {missingItems.length > 3 && (
                  <li className="text-amber-500">+{missingItems.length - 3} more...</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

interface WizardActionBarProps {
  onBack?: () => void;
  onSave?: () => void;
  onSaveNext?: () => void;
  onSaveClose?: () => void;
  canGoBack?: boolean;
  canGoNext?: boolean;
  isSaving?: boolean;
  hasUnsavedChanges?: boolean;
  nextLabel?: string;
}

export function WizardActionBar({
  onBack,
  onSave,
  onSaveNext,
  onSaveClose,
  canGoBack = true,
  canGoNext = true,
  isSaving = false,
  hasUnsavedChanges = false,
  nextLabel = "Save & Next",
}: WizardActionBarProps) {
  return (
    <div className="flex items-center justify-between p-4 bg-background border-t sticky bottom-0">
      <div className="flex items-center gap-2">
        {onBack && (
          <Button variant="outline" onClick={onBack} disabled={!canGoBack || isSaving}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2">
        {hasUnsavedChanges && (
          <Badge variant="outline" className="text-amber-600 border-amber-200">
            Unsaved changes
          </Badge>
        )}
        {onSave && (
          <Button variant="outline" onClick={onSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-1" />
            Save Progress
          </Button>
        )}
        {onSaveClose && (
          <Button variant="secondary" onClick={onSaveClose} disabled={isSaving}>
            <X className="h-4 w-4 mr-1" />
            Save & Close
          </Button>
        )}
        {onSaveNext && (
          <Button onClick={onSaveNext} disabled={!canGoNext || isSaving}>
            {nextLabel}
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function useWizardState(initialSteps: WizardStep[], initialStepId?: string) {
  const [steps, setSteps] = useState(initialSteps);
  const [currentStepId, setCurrentStepId] = useState(initialStepId || initialSteps[0]?.id || "");

  const currentIndex = steps.findIndex((s) => s.id === currentStepId);

  const goNext = () => {
    if (currentIndex < steps.length - 1) {
      setCurrentStepId(steps[currentIndex + 1].id);
    }
  };

  const goBack = () => {
    if (currentIndex > 0) {
      setCurrentStepId(steps[currentIndex - 1].id);
    }
  };

  const updateStepStatus = (stepId: string, status: WizardStep["status"]) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, status } : s))
    );
  };

  const updateStepProgress = (stepId: string, completedFields: number) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, completedFields } : s))
    );
  };

  const getMissingItems = (): string[] => {
    const missing: string[] = [];
    steps.forEach((step) => {
      if (step.status !== "completed" && step.isBlocking) {
        missing.push(`${step.label} not completed`);
      }
    });
    return missing;
  };

  const canProceed = () => {
    return steps.filter((s) => s.isBlocking).every((s) => s.status === "completed");
  };

  return {
    steps,
    setSteps,
    currentStepId,
    setCurrentStepId,
    currentIndex,
    goNext,
    goBack,
    updateStepStatus,
    updateStepProgress,
    getMissingItems,
    canProceed,
  };
}
