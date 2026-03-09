import { useEffect } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  Circle,
  Clock,
  Save
} from "lucide-react";
import { cn } from "@/lib/utils";

interface GlobalSaveIndicatorProps {
  className?: string;
  showDetails?: boolean;
}

function formatTime(date: Date | null): string {
  if (!date) return "";
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function GlobalSaveIndicator({ className, showDetails = true }: GlobalSaveIndicatorProps) {
  const { globalSaveState, autoSaveState } = useWorkspace();
  const { hasAnyUnsaved, isSavingAny, savingCount, lastGlobalSave, sections } = globalSaveState;

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasAnyUnsaved) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasAnyUnsaved]);

  const getStatusIcon = () => {
    if (isSavingAny) {
      return <Loader2 className="h-4 w-4 animate-spin" />;
    }
    if (hasAnyUnsaved) {
      return <Circle className="h-4 w-4 fill-amber-500 text-amber-500" />;
    }
    if (lastGlobalSave) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    return <Save className="h-4 w-4 text-muted-foreground" />;
  };

  const getStatusText = () => {
    if (isSavingAny) {
      return savingCount > 1 ? `Saving ${savingCount} sections...` : "Saving...";
    }
    if (hasAnyUnsaved) {
      const dirtyCount = Array.from(sections.values()).filter(s => s.isDirty).length;
      return dirtyCount > 1 ? `${dirtyCount} unsaved sections` : "Unsaved changes";
    }
    if (lastGlobalSave) {
      return `Saved changes ${formatTime(lastGlobalSave)}`;
    }
    return "Saved changes";
  };

  const getStatusColor = () => {
    if (isSavingAny) return "bg-blue-500/10 text-blue-600 border-blue-200";
    if (hasAnyUnsaved) return "bg-amber-500/10 text-amber-600 border-amber-200";
    return "bg-green-500/10 text-green-600 border-green-200";
  };

  if (!showDetails) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        {getStatusIcon()}
        <span className="text-sm">{getStatusText()}</span>
      </div>
    );
  }

  const sectionList = Array.from(sections.values());

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-8 px-3 gap-2", className)}
        >
          {getStatusIcon()}
          <span className="text-sm hidden sm:inline">{getStatusText()}</span>
          {hasAnyUnsaved && (
            <Badge variant="secondary" className={cn("h-5 text-xs", getStatusColor())}>
              !
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Save Status</h4>
            <Badge variant="outline" className={getStatusColor()}>
              {isSavingAny ? "Saving" : hasAnyUnsaved ? "Unsaved" : "Saved"}
            </Badge>
          </div>

          {sectionList.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {hasAnyUnsaved ? "Active sections:" : "Last saved sections:"}
              </p>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {sectionList.map((section) => (
                  <div
                    key={section.sectionKey}
                    className="flex items-center justify-between text-sm py-1 px-2 rounded hover:bg-muted/50"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="truncate">{formatSectionName(section.sectionKey)}</span>
                      {!section.isDirty && section.lastSavedAt && (
                        <span className="text-[10px] text-muted-foreground truncate">
                          Saved {formatTime(section.lastSavedAt)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {section.isSaving && (
                        <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                      )}
                      {section.hasError && (
                        <AlertCircle className="h-3 w-3 text-red-500" />
                      )}
                      {section.isDirty && !section.isSaving && (
                        <Circle className="h-3 w-3 fill-amber-400 text-amber-400" />
                      )}
                      {!section.isDirty && !section.isSaving && !section.hasError && section.lastSavedAt && (
                        <CheckCircle className="h-3 w-3 text-green-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No active sections</p>
          )}

          {autoSaveState.lastSavedAt && (
            <div className="pt-2 border-t space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>Progress saved {formatTime(autoSaveState.lastSavedAt)}</span>
              </div>
              {(autoSaveState.lastSavedPhase || autoSaveState.lastSavedRoute) && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground pl-5">
                  <span>
                    {autoSaveState.lastSavedPhase && formatSectionName(autoSaveState.lastSavedPhase)}
                    {autoSaveState.lastSavedRoute && autoSaveState.lastSavedPhase && " / "}
                    {autoSaveState.lastSavedRoute && formatSectionName(autoSaveState.lastSavedRoute)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function formatSectionName(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function CompactSaveIndicator({ className }: { className?: string }) {
  const { globalSaveState } = useWorkspace();
  const { hasAnyUnsaved, isSavingAny } = globalSaveState;

  if (isSavingAny) {
    return (
      <div className={cn("flex items-center gap-1 text-xs text-muted-foreground", className)}>
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Saving...</span>
      </div>
    );
  }

  if (hasAnyUnsaved) {
    return (
      <div className={cn("flex items-center gap-1 text-xs text-amber-600", className)}>
        <Circle className="h-2 w-2 fill-current" />
        <span>Unsaved</span>
      </div>
    );
  }

  return null;
}
