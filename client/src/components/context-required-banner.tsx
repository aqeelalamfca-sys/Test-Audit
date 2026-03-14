import { AlertCircle } from "lucide-react";
import { useWorkspace } from "@/lib/workspace-context";
import { useLocation } from "wouter";

export default function ContextRequiredBanner() {
  const { isContextSet, selectedClientId, selectedPeriodId, clients } = useWorkspace();
  const [location] = useLocation();

  // Show only on workspace-related pages (avoid noise on generic dashboards)
  const isWorkspaceRoute = location.startsWith("/engagement") || location.startsWith("/engagements") || location.startsWith("/phase");

  if (isContextSet) return null;
  if (!isWorkspaceRoute) return null;

  const openClientSelector = () => {
    const el = document.getElementById("client-selector-button");
    if (el) { el.focus(); (el as HTMLButtonElement).click(); }
  };

  const openPeriodSelector = () => {
    const el = document.getElementById("period-selector-button");
    if (el) { el.focus(); (el as HTMLButtonElement).click(); }
  };

  return (
    <div className="bg-yellow-50 border-b border-yellow-100 text-yellow-800 px-3 py-2">
      <div className="max-w-7xl mx-auto flex items-center gap-3">
        <AlertCircle className="h-4 w-4" />
        {!selectedClientId ? (
          <div className="text-sm flex items-center gap-3">
            <span>Select a Client to start.</span>
            <button onClick={openClientSelector} className="text-primary underline text-sm">Select Client</button>
          </div>
        ) : (
          <div className="text-sm flex items-center gap-3">
            <span>Select an Engagement Period to continue.</span>
            <button onClick={openPeriodSelector} className="text-primary underline text-sm">Select Period</button>
          </div>
        )}
      </div>
    </div>
  );
}
