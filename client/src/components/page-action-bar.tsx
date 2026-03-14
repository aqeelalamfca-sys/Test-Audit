import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Save, X, Loader2, AlertCircle, ExternalLink } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import type { ActionGate } from "@/lib/action-registry";

export interface ActionDisabledReason {
  reason: string;
  fixHref?: string;
  fixLabel?: string;
}

export interface PageActionBarProps {
  backHref?: string;
  nextHref?: string;
  dashboardHref?: string;
  saveFn: () => Promise<{ ok: boolean; errors?: any }>;
  hasUnsavedChanges?: boolean;
  isSaving?: boolean;
  canNavigateNext?: boolean;
  showBack?: boolean;
  showSaveProgress?: boolean;
  showSaveNext?: boolean;
  showSaveClose?: boolean;
  position?: "top" | "bottom";
  onSaveSuccess?: () => void;
  onSaveError?: (errors: any) => void;
  disabledReasons?: {
    back?: ActionDisabledReason;
    saveProgress?: ActionDisabledReason;
    saveNext?: ActionDisabledReason;
    saveClose?: ActionDisabledReason;
  };
  tabs?: Array<{ id: string; label: string }>;
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
}

function GatedButton({
  children,
  gate,
  disabled,
  ...buttonProps
}: {
  children: React.ReactNode;
  gate?: ActionDisabledReason;
  disabled?: boolean;
} & React.ComponentProps<typeof Button>) {
  const [, setLocation] = useLocation();
  const isGated = !!gate && !gate.fixHref;
  const isDisabled = disabled || !!gate;

  if (gate) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Button {...buttonProps} disabled={true}>
              {children}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
              <span className="text-sm">{gate.reason}</span>
            </div>
            {gate.fixHref && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLocation(gate.fixHref!);
                }}
                className="flex items-center gap-1 text-xs text-primary hover:underline mt-0.5 cursor-pointer"
                data-testid="link-go-fix"
              >
                <ExternalLink className="h-3 w-3" />
                {gate.fixLabel || "Go fix"}
              </button>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Button {...buttonProps} disabled={isDisabled}>
      {children}
    </Button>
  );
}

export function PageActionBar({
  backHref,
  nextHref,
  dashboardHref,
  saveFn,
  hasUnsavedChanges = false,
  isSaving = false,
  canNavigateNext = true,
  showBack = true,
  showSaveProgress = true,
  showSaveNext = true,
  showSaveClose = true,
  position = "top",
  onSaveSuccess,
  onSaveError,
  disabledReasons,
  tabs,
  activeTab,
  onTabChange,
}: PageActionBarProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [localSaving, setLocalSaving] = useState(false);

  const isCurrentlySaving = isSaving || localSaving;

  const navigate = useCallback((path: string) => {
    setLocation(path);
  }, [setLocation]);

  const handleBack = useCallback(() => {
    if (hasUnsavedChanges) {
      setPendingNavigation(backHref || "back");
      setShowUnsavedDialog(true);
    } else {
      if (backHref) {
        navigate(backHref);
      } else {
        window.history.back();
      }
    }
  }, [hasUnsavedChanges, backHref, navigate]);

  const handleSaveProgress = useCallback(async () => {
    setLocalSaving(true);
    try {
      const result = await saveFn();
      if (result.ok) {
        toast({ title: "Saved", description: "Your progress has been saved successfully." });
        onSaveSuccess?.();
      } else {
        toast({ title: "Save Failed", description: "Failed to save. Please try again.", variant: "destructive" });
        onSaveError?.(result.errors);
      }
    } catch (error) {
      toast({ title: "Save Failed", description: "An error occurred while saving.", variant: "destructive" });
      onSaveError?.(error);
    } finally {
      setLocalSaving(false);
    }
  }, [saveFn, onSaveSuccess, onSaveError, toast]);

  const getNextTabId = useCallback((): string | null => {
    if (!tabs || !activeTab || !onTabChange) return null;
    const currentIndex = tabs.findIndex(t => t.id === activeTab);
    if (currentIndex < 0 || currentIndex >= tabs.length - 1) return null;
    return tabs[currentIndex + 1].id;
  }, [tabs, activeTab, onTabChange]);

  const hasNextTab = !!getNextTabId();
  const canSaveNext = hasNextTab || !!nextHref;

  const handleSaveAndNext = useCallback(async () => {
    if (!canNavigateNext) return;

    const nextTab = getNextTabId();
    if (!nextTab && !nextHref) return;
    
    setLocalSaving(true);
    try {
      const result = await saveFn();
      if (result.ok) {
        onSaveSuccess?.();
        if (nextTab && onTabChange) {
          toast({ title: "Saved", description: "Moving to next tab..." });
          onTabChange(nextTab);
        } else if (nextHref) {
          toast({ title: "Saved", description: "Navigating to next step..." });
          navigate(nextHref);
        }
      } else {
        toast({ title: "Save Failed", description: "Please fix errors before proceeding.", variant: "destructive" });
        onSaveError?.(result.errors);
      }
    } catch (error) {
      toast({ title: "Save Failed", description: "An error occurred while saving.", variant: "destructive" });
      onSaveError?.(error);
    } finally {
      setLocalSaving(false);
    }
  }, [saveFn, nextHref, canNavigateNext, onSaveSuccess, onSaveError, navigate, toast, getNextTabId, onTabChange]);

  const handleSaveAndClose = useCallback(async () => {
    setLocalSaving(true);
    try {
      const result = await saveFn();
      if (result.ok) {
        toast({ title: "Saved", description: "Returning to dashboard..." });
        onSaveSuccess?.();
        if (dashboardHref) {
          navigate(dashboardHref);
        } else {
          window.history.back();
        }
      } else {
        toast({ title: "Save Failed", description: "Failed to save. Please try again.", variant: "destructive" });
        onSaveError?.(result.errors);
      }
    } catch (error) {
      toast({ title: "Save Failed", description: "An error occurred while saving.", variant: "destructive" });
      onSaveError?.(error);
    } finally {
      setLocalSaving(false);
    }
  }, [saveFn, dashboardHref, onSaveSuccess, onSaveError, navigate, toast]);

  const confirmNavigation = useCallback(() => {
    setShowUnsavedDialog(false);
    if (pendingNavigation === "back") {
      window.history.back();
    } else if (pendingNavigation) {
      navigate(pendingNavigation);
    }
    setPendingNavigation(null);
  }, [pendingNavigation, navigate]);

  const cancelNavigation = useCallback(() => {
    setShowUnsavedDialog(false);
    setPendingNavigation(null);
  }, []);

  const containerClass = position === "bottom" 
    ? "sticky bottom-0 bg-background/95 backdrop-blur-sm border-t border-border/50 py-3 mt-2.5 z-10"
    : "flex items-center gap-2";

  return (
    <>
      <div className={containerClass} data-testid={`action-bar-${position}`}>
        <div className={position === "bottom" ? "flex items-center justify-end gap-2 flex-wrap" : "flex items-center gap-2"}>
          {showBack && (
            <GatedButton
              variant="outline"
              size="sm"
              onClick={handleBack}
              disabled={isCurrentlySaving}
              gate={disabledReasons?.back}
              data-testid="btn-back"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </GatedButton>
          )}
          
          {showSaveProgress && (
            <GatedButton
              variant="outline"
              size="sm"
              onClick={handleSaveProgress}
              disabled={isCurrentlySaving}
              gate={disabledReasons?.saveProgress}
              data-testid="btn-save-progress"
            >
              {isCurrentlySaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-1" />
                  Save Progress
                </>
              )}
            </GatedButton>
          )}
          
          {showSaveNext && canSaveNext && (
            <GatedButton
              size="sm"
              onClick={handleSaveAndNext}
              disabled={isCurrentlySaving || !canNavigateNext}
              gate={disabledReasons?.saveNext}
              data-testid="btn-save-next"
            >
              {isCurrentlySaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  Save & Next
                  <ArrowRight className="h-4 w-4 ml-1" />
                </>
              )}
            </GatedButton>
          )}
          
          {showSaveClose && (
            <GatedButton
              variant="secondary"
              size="sm"
              onClick={handleSaveAndClose}
              disabled={isCurrentlySaving}
              gate={disabledReasons?.saveClose}
              data-testid="btn-save-close"
            >
              {isCurrentlySaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <X className="h-4 w-4 mr-1" />
                  Save & Close
                </>
              )}
            </GatedButton>
          )}
        </div>
      </div>

      <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to leave? Your changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelNavigation}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmNavigation}>Leave Without Saving</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default PageActionBar;
