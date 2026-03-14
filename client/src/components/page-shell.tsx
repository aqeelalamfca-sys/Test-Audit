import { PageActionBar, PageActionBarProps, ActionDisabledReason } from "@/components/page-action-bar";
import { ReactNode } from "react";
import { StatusBadge, StatusBadgeProps } from "@/components/ui/status-badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { usePageShellRegistry } from "@/lib/action-registry";
import { SignOffBar } from "@/components/sign-off-bar";
import { useWorkspace } from "@/lib/workspace-context";

export interface PageMetadata {
  label: string;
  value: string | ReactNode;
  status?: StatusBadgeProps["status"];
}

export interface PageShellProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  metadata?: PageMetadata[];
  statusBadge?: { label: string; status: StatusBadgeProps["status"] };
  backHref?: string;
  nextHref?: string;
  dashboardHref?: string;
  saveFn?: () => Promise<{ ok: boolean; errors?: any }>;
  hasUnsavedChanges?: boolean;
  isSaving?: boolean;
  canNavigateNext?: boolean;
  showTopBar?: boolean;
  showBottomBar?: boolean;
  showBack?: boolean;
  showSaveProgress?: boolean;
  showSaveNext?: boolean;
  showSaveClose?: boolean;
  onSaveSuccess?: () => void;
  onSaveError?: (errors: any) => void;
  headerContent?: ReactNode;
  headerActions?: ReactNode;
  className?: string;
  contentClassName?: string;
  noPadding?: boolean;
  readOnly?: boolean;
  useRegistry?: boolean;
  disabledReasons?: {
    back?: ActionDisabledReason;
    saveProgress?: ActionDisabledReason;
    saveNext?: ActionDisabledReason;
    saveClose?: ActionDisabledReason;
  };
  tabs?: Array<{ id: string; label: string }>;
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  signoffPhase?: string;
  signoffSection?: string;
  hideSignoff?: boolean;
}

// Default no-op save function for read-only pages
const defaultSaveFn = async () => ({ ok: true });

export function PageShell({
  children,
  title,
  subtitle,
  icon,
  metadata,
  statusBadge,
  backHref: backHrefProp,
  nextHref: nextHrefProp,
  dashboardHref: dashboardHrefProp,
  saveFn,
  hasUnsavedChanges = false,
  isSaving = false,
  canNavigateNext = true,
  showTopBar = true,
  showBottomBar = true,
  showBack: showBackProp,
  showSaveProgress: showSaveProgressProp,
  showSaveNext: showSaveNextProp,
  showSaveClose: showSaveCloseProp,
  onSaveSuccess,
  onSaveError,
  headerContent,
  headerActions,
  className = "",
  contentClassName = "",
  noPadding = false,
  readOnly = false,
  useRegistry = false,
  disabledReasons,
  tabs,
  activeTab,
  onTabChange,
  signoffPhase,
  signoffSection,
  hideSignoff = false,
}: PageShellProps) {
  const registryConfig = usePageShellRegistry();
  const workspace = useWorkspace();

  const backHref = useRegistry && registryConfig ? registryConfig.backHref : backHrefProp;
  const nextHref = useRegistry && registryConfig ? registryConfig.nextHref : nextHrefProp;
  const dashboardHref = useRegistry && registryConfig ? registryConfig.dashboardHref : dashboardHrefProp;
  const showBack = useRegistry && registryConfig ? registryConfig.showBack : (showBackProp ?? true);
  const showSaveProgress = useRegistry && registryConfig ? registryConfig.showSaveProgress : (showSaveProgressProp ?? true);
  const showSaveNext = useRegistry && registryConfig ? registryConfig.showSaveNext : (showSaveNextProp ?? true);
  const showSaveClose = useRegistry && registryConfig ? registryConfig.showSaveClose : (showSaveCloseProp ?? true);

  // If no saveFn provided, hide save buttons but show back/navigation
  const hasSaveFn = !!saveFn;
  const effectiveSaveFn = saveFn || defaultSaveFn;
  
  // In read-only mode, hide all action bars
  const effectiveShowTopBar = readOnly ? false : showTopBar;
  const effectiveShowBottomBar = readOnly ? false : showBottomBar;
  
  // If no saveFn, hide save buttons but keep back navigation
  const effectiveShowSaveProgress = hasSaveFn && showSaveProgress;
  const effectiveShowSaveNext = hasSaveFn && showSaveNext;
  const effectiveShowSaveClose = hasSaveFn && showSaveClose;

  const actionBarProps: Omit<PageActionBarProps, "position"> = {
    backHref,
    nextHref,
    dashboardHref,
    saveFn: effectiveSaveFn,
    hasUnsavedChanges,
    isSaving,
    canNavigateNext,
    showBack,
    showSaveProgress: effectiveShowSaveProgress,
    showSaveNext: effectiveShowSaveNext,
    showSaveClose: effectiveShowSaveClose,
    onSaveSuccess,
    onSaveError,
    disabledReasons,
    tabs,
    activeTab,
    onTabChange,
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Sticky Header Section */}
      {effectiveShowTopBar !== false && (effectiveShowTopBar || title || metadata) && (
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/40 pb-3 pt-1 mb-2.5">
          {/* Title Row */}
          <div className="flex items-center justify-between gap-2.5 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              {icon && (
                <div className="p-2 rounded-xl bg-primary/10 flex-shrink-0">
                  {icon}
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {title && (
                    <h1 className="text-xl font-semibold tracking-tight truncate" data-testid="page-title">
                      {title}
                    </h1>
                  )}
                  {statusBadge && (
                    <StatusBadge status={statusBadge.status} showIcon={false}>
                      {statusBadge.label}
                    </StatusBadge>
                  )}
                </div>
                {subtitle && (
                  <p className="text-sm text-muted-foreground truncate mt-0.5" data-testid="page-subtitle">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              {!hideSignoff && workspace.isInWorkspaceMode && workspace.currentEngagementId && (
                <SignOffBar
                  phase={signoffPhase || workspace.currentPhaseRoute || "PLANNING"}
                  section={signoffSection || activeTab || signoffPhase || workspace.currentPhaseRoute || "page"}
                  compact
                />
              )}
              {headerActions}
              {headerContent}
            </div>
          </div>

          {/* Metadata Row */}
          {metadata && metadata.length > 0 && (
            <div className="flex items-center gap-2.5 flex-wrap text-sm mt-2" data-testid="page-metadata">
              {metadata.map((item, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">{item.label}:</span>
                  {item.status ? (
                    <StatusBadge status={item.status} size="sm" showIcon={false}>
                      {item.value}
                    </StatusBadge>
                  ) : (
                    <span className="font-medium">{item.value}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Content Section */}
      <div className={cn(
        "flex-1",
        !noPadding && "space-y-3",
        contentClassName
      )}>
        {children}
      </div>

      {/* Bottom Action Bar */}
      {effectiveShowBottomBar && (
        <div className="sticky bottom-0 z-10 bg-background/95 backdrop-blur-sm border-t border-border/40 mt-2.5">
          <PageActionBar {...actionBarProps} position="bottom" />
        </div>
      )}
    </div>
  );
}

/**
 * Section component for grouping content within a page
 */
export interface PageSectionProps {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function PageSection({
  title,
  subtitle,
  actions,
  children,
  className = "",
  noPadding = false,
}: PageSectionProps) {
  return (
    <Card className={cn("overflow-hidden shadow-sm", className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-2.5 px-3 py-3 border-b border-border/50 flex-wrap">
          <div>
            {title && <h3 className="text-sm font-semibold tracking-tight uppercase text-muted-foreground">{title}</h3>}
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn(!noPadding && "p-3")}>
        {children}
      </div>
    </Card>
  );
}

/**
 * Empty state component for pages/sections with no data
 */
export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-12 px-3 text-center",
      className
    )} data-testid="empty-state">
      {icon && (
        <div className="p-2.5 rounded-2xl bg-muted/50 mb-2.5">
          {icon}
        </div>
      )}
      <h3 className="font-medium text-lg mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-md mb-2.5">{description}</p>
      )}
      {action}
    </div>
  );
}

export default PageShell;
