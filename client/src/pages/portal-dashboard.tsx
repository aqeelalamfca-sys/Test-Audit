import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { AgentsLoadingInline } from "@/components/agents-loading";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Shield, FileText, Clock, CheckCircle, LogOut, Building2, ChevronRight, RefreshCw, Bell, Upload, MessageSquare, AlertCircle, Filter } from "lucide-react";

interface PortalUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  client: { id: string; name: string };
  firm: { id: string; name: string };
}

interface Engagement {
  id: string;
  engagementCode: string;
  fiscalYearEnd: string;
  status: string;
  engagementType: string;
  createdAt: string;
  pendingRequests?: number;
  inProgressRequests?: number;
  completedRequests?: number;
}

interface DashboardData {
  engagements: Engagement[];
  stats: {
    totalEngagements: number;
    pendingRequests: number;
    inProgressRequests: number;
    completedRequests: number;
    totalAttachments: number;
  };
}

export default function PortalDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [user, setUser] = useState<PortalUser | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/client-portal/auth/me", { credentials: "include" });
      if (!response.ok) {
        setLocation("/portal/login");
        return;
      }
      const userData = await response.json();
      setUser(userData);
      fetchDashboard();
    } catch {
      setLocation("/portal/login");
    }
  };

  const fetchDashboard = async () => {
    try {
      const response = await fetch("/api/client-portal/portal/dashboard", { credentials: "include" });
      if (response.ok) {
        const data = await response.json();
        setDashboard(data);
      }
    } catch (error) {
      console.error("Failed to load dashboard:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchDashboard();
    toast({ title: "Refreshed", description: "Dashboard data has been updated." });
  };

  const handleLogout = async () => {
    await fetch("/api/client-portal/auth/logout", { method: "POST", credentials: "include" });
    setLocation("/portal/login");
  };

  const filteredEngagements = dashboard?.engagements.filter((e) => {
    if (filter === "all") return true;
    if (filter === "active") return e.status === "ACTIVE";
    if (filter === "pending") return (e.pendingRequests || 0) > 0 || (e.inProgressRequests || 0) > 0;
    if (filter === "completed") return e.status === "COMPLETED";
    return true;
  }) || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>;
      case "COMPLETED":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Completed</Badge>;
      case "PENDING":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pending</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (isLoading) {
    return <AgentsLoadingInline showDelay={1000} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="bg-white dark:bg-slate-800 border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <Shield className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-semibold">Client Portal</h1>
              <p className="text-xs text-muted-foreground">{user?.firm.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-4 w-4" />
              {(dashboard?.stats.pendingRequests || 0) > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center">
                  {dashboard?.stats.pendingRequests}
                </span>
              )}
            </Button>
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium">{user?.firstName} {user?.lastName}</p>
              <p className="text-xs text-muted-foreground">{user?.client.name}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-4">
        <div className="mb-4">
          <h2 className="text-2xl font-bold tracking-tight">Welcome, {user?.firstName}</h2>
          <p className="text-muted-foreground">
            View your audit engagements and respond to information requests
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-4">
          <Card className="transition-all hover:shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Active Engagements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{dashboard?.stats.totalEngagements || 0}</div>
            </CardContent>
          </Card>
          <Card className="transition-all hover:shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-600" />
                Pending Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600">{dashboard?.stats.pendingRequests || 0}</div>
            </CardContent>
          </Card>
          <Card className="transition-all hover:shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                In Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{dashboard?.stats.inProgressRequests || 0}</div>
            </CardContent>
          </Card>
          <Card className="transition-all hover:shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                Completed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{dashboard?.stats.completedRequests || 0}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Your Engagements
                </CardTitle>
                <CardDescription>
                  Select an engagement to view details and respond to requests
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Select value={filter} onValueChange={setFilter}>
                  <SelectTrigger className="w-[160px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Engagements</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending">Pending Response</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isRefreshing}>
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredEngagements.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="font-semibold mb-1">No engagements found</h3>
                <p className="text-sm">
                  {filter !== "all" ? "Try adjusting your filter" : "No active audit engagements at this time"}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredEngagements.map((engagement) => (
                  <Link key={engagement.id} href={`/portal/engagement/${engagement.id}`}>
                    <div className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border hover:bg-muted/50 hover:border-primary/30 transition-all cursor-pointer">
                      <div className="flex items-center gap-4 mb-3 sm:mb-0">
                        <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                          <FileText className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold">{engagement.engagementCode}</p>
                            {getStatusBadge(engagement.status)}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {engagement.engagementType.replace(/_/g, " ")} - FY {engagement.fiscalYearEnd ? new Date(engagement.fiscalYearEnd).getFullYear() : 'N/A'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 sm:gap-3">
                        <div className="flex gap-4 text-sm">
                          {(engagement.pendingRequests || 0) > 0 && (
                            <div className="flex items-center gap-1 text-yellow-600">
                              <Clock className="h-4 w-4" />
                              <span>{engagement.pendingRequests} pending</span>
                            </div>
                          )}
                          {(engagement.inProgressRequests || 0) > 0 && (
                            <div className="flex items-center gap-1 text-blue-600">
                              <AlertCircle className="h-4 w-4" />
                              <span>{engagement.inProgressRequests} in progress</span>
                            </div>
                          )}
                          {(engagement.completedRequests || 0) > 0 && (
                            <div className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="h-4 w-4" />
                              <span>{engagement.completedRequests} completed</span>
                            </div>
                          )}
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950 dark:to-blue-900/50 border-blue-200 dark:border-blue-800">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-blue-700 dark:text-blue-300">
                <MessageSquare className="h-5 w-5" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-blue-600 dark:text-blue-400">
                Click on any engagement above to:
              </p>
              <ul className="text-sm text-blue-600 dark:text-blue-400 space-y-1 ml-4">
                <li>• View company information</li>
                <li>• Respond to audit requests</li>
                <li>• Upload supporting documents</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950 dark:to-green-900/50 border-green-200 dark:border-green-800">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-green-700 dark:text-green-300">
                <Upload className="h-5 w-5" />
                Document Upload
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-green-600 dark:text-green-400">
                Upload documents directly to information requests. Supported formats: PDF, Excel, Word, Images (Max 50MB each).
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950 dark:to-purple-900/50 border-purple-200 dark:border-purple-800 sm:col-span-2 lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-purple-700 dark:text-purple-300">
                <Shield className="h-5 w-5" />
                Need Help?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-purple-600 dark:text-purple-400">
                Contact your audit team through the request response feature for any questions or clarifications.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
