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
        className="flex items-center gap-1 p-1 bg-muted/40 rounded-xl border border-border/30 overflow-x-auto"
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
              className={`
                group relative flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-medium whitespace-nowrap
                transition-all duration-150 ease-out min-w-fit focus:outline-none focus:ring-2 focus:ring-primary/50
                ${isActive 
                  ? 'bg-primary/10 text-primary shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }
              `}
            >
              <span className={`
                flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-semibold
                ${isActive 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-muted-foreground group-hover:text-foreground'
                }
              `}>
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
        className="flex items-center gap-1 p-1 bg-muted/40 rounded-xl border border-border/30 overflow-x-auto"
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
              className={`
                group relative flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-medium whitespace-nowrap
                transition-all duration-150 ease-out min-w-fit focus:outline-none focus:ring-2 focus:ring-primary/50
                ${isActive 
                  ? 'bg-primary/10 text-primary shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }
              `}
            >
              <span className={`
                flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-semibold
                ${isActive 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-muted-foreground group-hover:text-foreground'
                }
              `}>
                {index + 1}
              </span>
              <span>{tab.label}</span>
              {dotColor && (
                <span
                  className={`w-1.5 h-1.5 rounded-full ${dotColor}`}
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
