import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, LucideIcon } from "lucide-react";
import { Link } from "wouter";

interface TabNavButtonsProps {
  tabs: Array<{ id: string; label: string }>;
  currentTab: string;
  onTabChange: (tabId: string) => void;
  firstTabHref?: string;
  firstTabLabel?: string;
  lastTabHref?: string;
  lastTabLabel?: string;
  lastTabIcon?: LucideIcon;
}

export function TabNavButtons({
  tabs,
  currentTab,
  onTabChange,
  firstTabHref,
  firstTabLabel = "Back",
  lastTabHref,
  lastTabLabel = "Proceed to Execution",
  lastTabIcon: LastTabIcon,
}: TabNavButtonsProps) {
  const currentIndex = tabs.findIndex((tab) => tab.id === currentTab);
  const isFirstTab = currentIndex === 0;
  const isLastTab = currentIndex === tabs.length - 1;

  const handlePrevious = () => {
    if (currentIndex > 0) {
      onTabChange(tabs[currentIndex - 1].id);
    }
  };

  const handleNext = () => {
    if (currentIndex < tabs.length - 1) {
      onTabChange(tabs[currentIndex + 1].id);
    }
  };

  return (
    <div className="flex items-center justify-between pt-6 mt-6 border-t">
      {isFirstTab && firstTabHref ? (
        <Button variant="outline" asChild data-testid="btn-back-previous-phase">
          <Link href={firstTabHref}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {firstTabLabel}
          </Link>
        </Button>
      ) : (
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={isFirstTab}
          data-testid="btn-previous-tab"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>
      )}

      {isLastTab && lastTabHref ? (
        <Button asChild data-testid="btn-proceed-next-phase">
          <Link href={lastTabHref}>
            {LastTabIcon ? <LastTabIcon className="h-4 w-4 mr-2" /> : null}
            {lastTabLabel}
            {!LastTabIcon && <ArrowRight className="h-4 w-4 ml-2" />}
          </Link>
        </Button>
      ) : isLastTab ? (
        <Button data-testid="btn-complete-engagement" disabled>
          {LastTabIcon ? <LastTabIcon className="h-4 w-4 mr-2" /> : null}
          {lastTabLabel}
        </Button>
      ) : (
        <Button onClick={handleNext} data-testid="btn-next-tab">
          Next
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      )}
    </div>
  );
}

export function getTabNavigation(tabs: Array<{ id: string; label: string }>, currentTab: string) {
  const currentIndex = tabs.findIndex((tab) => tab.id === currentTab);
  return {
    currentIndex,
    isFirstTab: currentIndex === 0,
    isLastTab: currentIndex === tabs.length - 1,
    previousTab: currentIndex > 0 ? tabs[currentIndex - 1] : null,
    nextTab: currentIndex < tabs.length - 1 ? tabs[currentIndex + 1] : null,
  };
}
