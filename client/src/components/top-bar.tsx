import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bell, Search, Settings, LogOut, User, Building2, Calendar, ChevronDown, Plus, FileText, BookOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth";
import { Link, useLocation } from "wouter";
import { useWorkspace } from "@/lib/workspace-context";
import { useState, useRef, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { GlobalSaveIndicator } from "./global-save-indicator";
import { useRoleTheme } from "@/components/role-theme-provider";
import { getRoleDisplayLabel, getRoleBadgeClasses } from "@/lib/role-theme";

interface TopBarProps {
  clientName?: string;
  engagementId?: string;
  currentPhase?: string;
  phaseStatus?: string;
}

function formatFiscalYear(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    return `FY ${date.getFullYear()}`;
  } catch {
    return "";
  }
}

export function TopBar({}: TopBarProps) {
  const { user, firm, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { 
    clients, 
    userEngagements, 
    selectedClientId, 
    selectedPeriodId, 
    activeClient,
    activeEngagement,
    switchToClient, 
    switchToEngagement,
    currentEngagementId,
  } = useWorkspace();
  
  const isWorkspaceRoute = location.startsWith("/workspace/");
  
  const [clientFilter, setClientFilter] = useState("");
  const [clientOpen, setClientOpen] = useState(false);
  const clientSearchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (clientOpen) {
      setTimeout(() => clientSearchRef.current?.focus(), 0);
    }
  }, [clientOpen]);

  const clientEngagements = useMemo(() => {
    if (!selectedClientId || !userEngagements) return [];
    return userEngagements.filter(e => e.clientId === selectedClientId);
  }, [userEngagements, selectedClientId]);

  const filteredClients = useMemo(() => {
    if (!clients) return [];
    if (!clientFilter) return clients;
    return clients.filter(c => c.name.toLowerCase().includes(clientFilter.toLowerCase()));
  }, [clients, clientFilter]);

  const selectedClient = clients?.find(c => c.id === selectedClientId);
  const selectedEngagement = userEngagements?.find(e => e.id === selectedPeriodId);

  const initials = user?.fullName
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase() || "U";

  const handleLogout = async () => {
    await logout();
  };

  const handleClientSelect = (clientId: string) => {
    switchToClient(clientId);
    setClientOpen(false);
    setClientFilter("");
  };

  const handleEngagementSelect = (engagementId: string) => {
    switchToEngagement(engagementId);
  };

  const workspaceEngagement = useMemo(() => {
    if (!currentEngagementId || !userEngagements) return null;
    return userEngagements.find(e => e.id === currentEngagementId) || null;
  }, [currentEngagementId, userEngagements]);

  const workspaceClient = useMemo(() => {
    if (!workspaceEngagement || !clients) return null;
    return clients.find(c => c.id === workspaceEngagement.clientId) || workspaceEngagement.client || null;
  }, [workspaceEngagement, clients]);

  const formatPeriod = (start: string | null, end: string | null): string => {
    if (!start && !end) return "Period not set";
    try {
      const startDate = start ? format(new Date(start), "MMM d, yyyy") : "?";
      const endDate = end ? format(new Date(end), "MMM d, yyyy") : "?";
      return `${startDate} - ${endDate}`;
    } catch {
      return "Period not set";
    }
  };

  const userRole = user?.role?.toLowerCase();
  const isSuperAdmin = userRole === "super_admin";
  const { theme } = useRoleTheme();
  const roleBadgeCls = getRoleBadgeClasses(theme);

  return (
    <header className="h-12 border-b border-border/60 bg-background/95 backdrop-blur-sm flex items-center px-4 gap-3">
      <SidebarTrigger data-testid="button-sidebar-toggle" />

      <Badge data-testid="badge-beta-version" variant="outline" className="bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0 h-5 flex-shrink-0">
        Beta
      </Badge>
      
      <Separator orientation="vertical" className="h-6" />

      {isSuperAdmin ? (
        <div className="flex-1" />
      ) : (
      <div className="flex items-center gap-6 flex-1">
        {isWorkspaceRoute && workspaceEngagement ? (
          <div className="flex items-center gap-3 flex-1">
            <div className="flex items-center gap-1.5 whitespace-nowrap" title={workspaceClient?.name || "Unknown Client"}>
              <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="font-medium text-sm">
                {workspaceClient?.name || "Unknown Client"}
              </span>
            </div>
            
            <Separator orientation="vertical" className="h-4 flex-shrink-0 bg-border/50" />
            
            <div className="flex items-center gap-1.5 whitespace-nowrap" title={workspaceEngagement.engagementCode}>
              <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="font-medium text-sm font-mono">
                {workspaceEngagement.engagementCode}
              </span>
            </div>
            
            <Separator orientation="vertical" className="h-4 flex-shrink-0 bg-border/50" />
            
            <div className="flex items-center gap-1.5 whitespace-nowrap" title={formatPeriod(workspaceEngagement.periodStart, workspaceEngagement.periodEnd)}>
              <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="font-medium text-sm">
                {formatFiscalYear(workspaceEngagement.periodEnd)}
              </span>
            </div>
            
            <Badge variant="outline" className="flex-shrink-0 bg-green-50 dark:bg-green-950/50 border-green-200/60 dark:border-green-800/60 text-green-700 dark:text-green-300 gap-1 h-5 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Active
            </Badge>
            
            <Separator orientation="vertical" className="h-4 flex-shrink-0 bg-border/50" />
            
            <GlobalSaveIndicator showDetails={true} />
          </div>
        ) : (
        <div className="flex items-center gap-4">
            <DropdownMenu open={clientOpen} onOpenChange={setClientOpen}>
              <DropdownMenuTrigger asChild>
                <Button 
                  id="client-selector-button"
                  variant="outline" 
                  size="sm" 
                  className="h-8 min-w-[180px] max-w-[240px] justify-between font-normal"
                >
                  <div className="flex items-center gap-2 truncate">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="truncate">
                      {selectedClient?.name || "Select Client"}
                    </span>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72">
                <div className="p-2">
                  <Input 
                    ref={clientSearchRef}
                    placeholder="Search clients..." 
                    value={clientFilter} 
                    onChange={(e) => setClientFilter(e.target.value)} 
                    className="h-8"
                  />
                </div>
                <DropdownMenuSeparator />
                <div className="max-h-64 overflow-y-auto">
                  {filteredClients.length === 0 ? (
                    <div className="p-4 text-center">
                      <p className="text-sm text-muted-foreground mb-2">
                        {clients?.length === 0 ? "No clients found" : "No matching clients"}
                      </p>
                      {clients?.length === 0 && (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => { setClientOpen(false); setLocation("/clients"); }}
                          className="gap-1"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add Client
                        </Button>
                      )}
                    </div>
                  ) : (
                    filteredClients.map(c => (
                      <DropdownMenuItem 
                        key={c.id} 
                        onClick={() => handleClientSelect(c.id)}
                        className="cursor-pointer"
                      >
                        <div className="flex items-center gap-2 w-full">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="truncate flex-1">{c.name}</span>
                          {c.id === selectedClientId && (
                            <Badge variant="secondary" className="text-[10px] px-1.5">Active</Badge>
                          )}
                        </div>
                      </DropdownMenuItem>
                    ))
                  )}
                </div>
                {selectedClientId && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => { switchToClient(""); setClientOpen(false); }}
                      className="text-muted-foreground"
                    >
                      Clear selection
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <Select 
              value={selectedPeriodId || ""} 
              onValueChange={handleEngagementSelect}
              disabled={!selectedClientId}
            >
              <SelectTrigger 
                id="period-selector-button"
                className="h-8 min-w-[160px] max-w-[200px] font-normal"
              >
                <div className="flex items-center gap-2 truncate">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <SelectValue placeholder="Select Period" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {clientEngagements.length === 0 ? (
                  <div className="p-4 text-center">
                    <p className="text-sm text-muted-foreground mb-2">
                      {selectedClientId ? "No engagements found" : "Select a client first"}
                    </p>
                    {selectedClientId && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => setLocation("/engagements/new")}
                        className="gap-1"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Create Engagement
                      </Button>
                    )}
                  </div>
                ) : (
                  clientEngagements
                    .sort((a, b) => (b.fiscalYearEnd || "").localeCompare(a.fiscalYearEnd || ""))
                    .map(e => (
                      <SelectItem key={e.id} value={e.id}>
                        <div className="flex items-center gap-2">
                          <span>{e.engagementCode}</span>
                          {e.fiscalYearEnd && (
                            <Badge variant="outline" className="text-[10px] px-1">
                              {formatFiscalYear(e.fiscalYearEnd)}
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))
                )}
              </SelectContent>
            </Select>

          {selectedClientId && selectedPeriodId && (
            <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-medium text-green-700 dark:text-green-300">Active</span>
            </div>
          )}

          {selectedClientId && !selectedPeriodId && (
            <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Select Period</span>
            </div>
          )}
        </div>
        )
        }

        <div className="flex-1" />

        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search..."
            className="pl-9 w-48 lg:w-56 h-8"
            data-testid="input-search"
          />
        </div>
      </div>
      )}

      <Separator orientation="vertical" className="h-6" />

      <div className="flex items-center gap-1">
        {!isSuperAdmin && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-8 w-8" data-testid="button-notifications">
                <Bell className="h-4 w-4" />
                <Badge className="absolute -top-0.5 -right-0.5 h-4 w-4 flex items-center justify-center p-0 text-[10px] bg-red-500">
                  3
                </Badge>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <div className="flex flex-col gap-1">
                  <span className="font-medium text-sm">New review pending</span>
                  <span className="text-xs text-muted-foreground">ABC Corp - FY2024 Audit</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <div className="flex flex-col gap-1">
                  <span className="font-medium text-sm">Engagement assigned</span>
                  <span className="text-xs text-muted-foreground">XYZ Industries - FY2024</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <div className="flex flex-col gap-1">
                  <span className="font-medium text-sm">Phase completed</span>
                  <span className="text-xs text-muted-foreground">DEF Ltd. - Planning Phase</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-center text-primary">
                View all notifications
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarFallback className={`text-xs font-medium ${theme.avatarBg} ${theme.avatarText}`}>
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{user?.fullName || "User"}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
                <span className={`inline-flex items-center rounded-full w-fit mt-1 px-2 py-0.5 text-[10px] font-semibold ${roleBadgeCls}`} data-testid="badge-user-role">
                  {getRoleDisplayLabel(userRole).toUpperCase()}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <Link href="/firm-admin/settings">
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
            </Link>
            <Link href="/user-guide">
              <DropdownMenuItem data-testid="nav-user-guide">
                <BookOpen className="mr-2 h-4 w-4" />
                <span>Live User Guide</span>
              </DropdownMenuItem>
            </Link>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-red-600">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
