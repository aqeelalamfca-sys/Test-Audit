import { useState, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Calendar, Building2, ChevronRight, ArrowRightLeft } from "lucide-react";
import { useWorkspace } from "@/lib/workspace-context";
import { format } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "dd MMM yyyy");
  } catch {
    return "—";
  }
}

function formatFiscalYear(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const date = new Date(dateStr);
    return `FY ${date.getFullYear()}`;
  } catch {
    return "—";
  }
}

export function WorkspaceSwitcher() {
  const {
    activeEngagement,
    activeClient,
    clients,
    userEngagements,
    isLoading,
    isWorkspacePage,
    switchToEngagement,
    switchToClient,
  } = useWorkspace();

  const [showSwitcher, setShowSwitcher] = useState(false);

  const clientEngagements = useMemo(() => {
    if (!activeClient || !userEngagements) return [];
    return userEngagements.filter(e => e.clientId === activeClient.id);
  }, [userEngagements, activeClient]);

  const fiscalYearOptions = useMemo(() => {
    if (!clientEngagements || clientEngagements.length === 0) return [];
    
    const years = new Map<string, { engagementId: string; label: string; date: Date }>();
    
    clientEngagements.forEach(e => {
      if (e.fiscalYearEnd) {
        const date = new Date(e.fiscalYearEnd);
        const yearLabel = formatFiscalYear(e.fiscalYearEnd);
        const existing = years.get(yearLabel);
        if (!existing || date > existing.date) {
          years.set(yearLabel, {
            engagementId: e.id,
            label: yearLabel,
            date,
          });
        }
      }
    });
    
    return Array.from(years.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [clientEngagements]);

  const currentFiscalYear = activeEngagement?.fiscalYearEnd 
    ? formatFiscalYear(activeEngagement.fiscalYearEnd)
    : "—";

  if (!isWorkspacePage || !activeEngagement) {
    return null;
  }

  const engagementDescription = activeEngagement.engagementType?.replace(/_/g, " ") || "Statutory Audit";
  const periodStart = formatDate(activeEngagement.periodStart);
  const periodEnd = formatDate(activeEngagement.periodEnd || activeEngagement.fiscalYearEnd);

  const handleClientChange = (clientId: string) => {
    if (clientId !== activeClient?.id) {
      switchToClient(clientId);
    }
  };

  const handleEngagementChange = (engagementId: string) => {
    if (engagementId !== activeEngagement?.id) {
      switchToEngagement(engagementId);
    }
  };

  const handleFiscalYearChange = (yearLabel: string) => {
    const yearOption = fiscalYearOptions.find(y => y.label === yearLabel);
    if (yearOption && yearOption.engagementId !== activeEngagement?.id) {
      switchToEngagement(yearOption.engagementId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="animate-pulse">Loading...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
      <Separator orientation="vertical" className="h-6" />
      
      <div className="flex items-center gap-2 text-sm">
        <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className="font-medium truncate max-w-[140px]" title={activeClient?.name}>
          {activeClient?.name || "—"}
        </span>
        <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
        <span className="text-muted-foreground truncate max-w-[120px]" title={engagementDescription}>
          {engagementDescription}
        </span>
        <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
        <Badge variant="outline" className="text-xs flex-shrink-0">
          {currentFiscalYear}
        </Badge>
      </div>

      <Separator orientation="vertical" className="h-6" />

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setShowSwitcher(!showSwitcher)}
            className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Switch</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>Switch Client / Engagement / Year</TooltipContent>
      </Tooltip>

      {showSwitcher && (
        <>
          <div className="flex items-center gap-2">
            <Select 
              value={activeClient?.id || ""} 
              onValueChange={handleClientChange}
            >
              <SelectTrigger className="h-7 w-[140px] text-xs">
                <SelectValue placeholder="Client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map(client => (
                  <SelectItem key={client.id} value={client.id} className="text-xs">
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select 
              value={activeEngagement?.id || ""} 
              onValueChange={handleEngagementChange}
            >
              <SelectTrigger className="h-7 w-[120px] text-xs">
                <SelectValue placeholder="Engagement" />
              </SelectTrigger>
              <SelectContent>
                {clientEngagements.map(eng => (
                  <SelectItem key={eng.id} value={eng.id} className="text-xs">
                    {eng.engagementCode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select 
              value={currentFiscalYear} 
              onValueChange={handleFiscalYearChange}
            >
              <SelectTrigger className="h-7 w-[90px] text-xs">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {fiscalYearOptions.map(fy => (
                  <SelectItem key={fy.label} value={fy.label} className="text-xs">
                    {fy.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="hidden xl:flex items-center gap-2 text-xs text-muted-foreground border-l pl-3 ml-1">
            <Calendar className="h-3.5 w-3.5" />
            <span>{periodStart}</span>
            <span>→</span>
            <span>{periodEnd}</span>
          </div>
        </>
      )}
    </div>
  );
}
