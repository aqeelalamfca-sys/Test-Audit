import { cn } from "@/lib/utils";

export interface NumberedTab {
  id: string;
  label: string;
  step: number;
  icon?: React.ReactNode;
}

interface NumberedTabNavigationProps {
  activeTab: string;
  setActiveTab?: (tab: string) => void;
  onTabChange?: (tab: string) => void;
  tabs: NumberedTab[];
  ariaLabel?: string;
  className?: string;
}

export function NumberedTabNavigation({ 
  activeTab, 
  setActiveTab,
  onTabChange,
  tabs, 
  ariaLabel = "Navigation tabs",
  className 
}: NumberedTabNavigationProps) {
  const handleTabChange = typeof setActiveTab === 'function' ? setActiveTab : typeof onTabChange === 'function' ? onTabChange : undefined;
  return (
    <div className={cn("relative", className)}>
      <div 
        role="tablist" 
        aria-label={ariaLabel}
        className="flex items-center gap-0.5 p-1 bg-muted/50 rounded-lg border border-border/40 overflow-x-auto scrollbar-none"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => handleTabChange?.(tab.id)}
              onKeyDown={(e) => {
                const currentIndex = tabs.findIndex(t => t.id === tab.id);
                if (e.key === 'ArrowRight') {
                  const nextIndex = Math.min(currentIndex + 1, tabs.length - 1);
                  handleTabChange?.(tabs[nextIndex].id);
                } else if (e.key === 'ArrowLeft') {
                  const prevIndex = Math.max(currentIndex - 1, 0);
                  handleTabChange?.(tabs[prevIndex].id);
                }
              }}
              data-testid={`tab-${tab.id}`}
              className={cn(
                "group relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0",
                "transition-all duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                isActive 
                  ? "bg-background text-foreground shadow-sm border border-border/50" 
                  : "text-muted-foreground hover:text-foreground hover:bg-background/60"
              )}
            >
              <span className={cn(
                "flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-semibold shrink-0",
                isActive 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted text-muted-foreground group-hover:text-foreground"
              )}>
                {tab.step}
              </span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface SimpleTabNavigationProps {
  activeTab: string;
  setActiveTab?: (tab: string) => void;
  onTabChange?: (tab: string) => void;
  tabs: Array<{ id: string; label: string; icon?: React.ReactNode }>;
  ariaLabel?: string;
  className?: string;
  tabStatuses?: Record<string, { status: "complete" | "warning" | "incomplete" | "not_started"; label: string }>;
}

export function SimpleTabNavigation({ 
  activeTab, 
  setActiveTab,
  onTabChange,
  tabs, 
  ariaLabel = "Navigation tabs",
  className,
  tabStatuses,
}: SimpleTabNavigationProps) {
  const handleTabChange = typeof setActiveTab === 'function' ? setActiveTab : typeof onTabChange === 'function' ? onTabChange : undefined;
  const getStatusDotColor = (status: string) => {
    switch (status) {
      case "complete":
        return "bg-green-500";
      case "warning":
        return "bg-amber-500";
      case "incomplete":
        return "bg-red-500";
      case "not_started":
        return null;
      default:
        return null;
    }
  };

  return (
    <div className={cn("relative", className)}>
      <div 
        role="tablist" 
        aria-label={ariaLabel}
        className="flex items-center gap-0.5 p-1 bg-muted/50 rounded-lg border border-border/40 overflow-x-auto scrollbar-none"
      >
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeTab;
          const tabStatus = tabStatuses?.[tab.id];
          const dotColor = tabStatus ? getStatusDotColor(tabStatus.status) : null;
          
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => handleTabChange?.(tab.id)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight') {
                  const nextIndex = Math.min(index + 1, tabs.length - 1);
                  handleTabChange?.(tabs[nextIndex].id);
                } else if (e.key === 'ArrowLeft') {
                  const prevIndex = Math.max(index - 1, 0);
                  handleTabChange?.(tabs[prevIndex].id);
                }
              }}
              data-testid={`tab-${tab.id}`}
              className={cn(
                "group relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0",
                "transition-all duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                isActive 
                  ? "bg-background text-foreground shadow-sm border border-border/50" 
                  : "text-muted-foreground hover:text-foreground hover:bg-background/60"
              )}
            >
              {tab.icon && (
                <span className="shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5">{tab.icon}</span>
              )}
              {!tab.icon && (
                <span className={cn(
                  "flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-semibold shrink-0",
                  isActive 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-muted text-muted-foreground group-hover:text-foreground"
                )}>
                  {index + 1}
                </span>
              )}
              <span>{tab.label}</span>
              {dotColor && (
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`}
                  title={tabStatus?.label}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
