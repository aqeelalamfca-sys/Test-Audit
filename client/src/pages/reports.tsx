import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart3,
  PieChart,
  TrendingUp,
  Clock,
  Users,
  FileText,
  Download,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Building,
  Briefcase,
  Activity,
  Target,
  Loader2,
  RefreshCw,
} from "lucide-react";
import {
  PieChart as RechartsPie,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { MetricCard } from "@/components/reports/MetricCard";
import { ReportViewer } from "@/components/reports/ReportViewer";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { formatAccounting } from '@/lib/formatters';

const COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

type ReportType = "engagement-health" | "risk-exposure" | "resource-intelligence" | "portfolio-intelligence";

interface DashboardMetrics {
  summary: {
    totalEngagements: number;
    onTrack: number;
    atRisk: number;
    overdue: number;
    completed: number;
    totalClients: number;
    activeUsers: number;
  };
  hours: {
    totalBudget: number;
    totalActual: number;
    utilizationRate: number;
  };
  industryBreakdown: { name: string; count: number }[];
  typeBreakdown: { name: string; count: number }[];
  teamUtilization: {
    id: string;
    name: string;
    role: string;
    allocatedHours: number;
    engagementCount: number;
    utilization: number;
  }[];
  generatedAt: string;
}

async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  const response = await fetchWithAuth("/api/intelligence/dashboard-metrics");
  if (!response.ok) throw new Error("Failed to fetch dashboard metrics");
  return response.json();
}

async function fetchReport(type: string) {
  const response = await fetchWithAuth(`/api/intelligence/${type}`);
  if (!response.ok) throw new Error(`Failed to fetch ${type} report`);
  return response.json();
}

export default function Reports() {
  const [reportViewerOpen, setReportViewerOpen] = useState(false);
  const [activeReportType, setActiveReportType] = useState<ReportType | null>(null);
  const [reportData, setReportData] = useState<any>(null);
  const [reportTitle, setReportTitle] = useState("");
  const [loadingReport, setLoadingReport] = useState<string | null>(null);

  const { data: metrics, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["dashboard-metrics"],
    queryFn: fetchDashboardMetrics,
    refetchInterval: 60000,
  });

  const openReport = async (type: ReportType, title: string) => {
    setLoadingReport(type);
    try {
      const data = await fetchReport(type);
      setReportData(data);
      setActiveReportType(type);
      setReportTitle(title);
      setReportViewerOpen(true);
    } catch (error) {
      console.error("Failed to fetch report:", error);
    } finally {
      setLoadingReport(null);
    }
  };

  const industryChartData = metrics?.industryBreakdown?.map((item, idx) => ({
    name: item.name,
    value: item.count,
    fill: COLORS[idx % COLORS.length],
  })) || [];

  const typeChartData = metrics?.typeBreakdown?.map((item, idx) => ({
    name: item.name.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
    value: item.count,
    fill: COLORS[idx % COLORS.length],
  })) || [];

  const utilizationChartData = metrics?.teamUtilization?.slice(0, 8).map(member => ({
    name: member.name.split(" ")[0],
    utilization: member.utilization,
    engagements: member.engagementCount,
  })) || [];

  if (isLoading) {
    return (
      <div className="px-4 py-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="px-4 py-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <BarChart3 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Intelligence Dashboard</h1>
            <p className="text-muted-foreground">Real-time analytics and reporting</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isRefetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button>
            <Download className="h-4 w-4 mr-2" />
            Export All
          </Button>
        </div>
      </div>

      <Tabs defaultValue="status" className="space-y-4">
        <TabsList>
          <TabsTrigger value="status">Engagement Status</TabsTrigger>
          <TabsTrigger value="utilization">Utilization</TabsTrigger>
          <TabsTrigger value="timeline">Completion Timelines</TabsTrigger>
          <TabsTrigger value="portfolio">Portfolio Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="status" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => openReport("engagement-health", "Engagement Health Intelligence Report")}
            >
              <Card className="relative overflow-hidden group">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Total Engagements</p>
                      <p className="text-2xl font-semibold">{metrics?.summary.totalEngagements || 0}</p>
                    </div>
                  </div>
                </CardContent>
                {loadingReport === "engagement-health" && (
                  <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500/0 via-blue-500 to-blue-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Card>
            </div>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">On Track</p>
                    <p className="text-2xl font-semibold">{metrics?.summary.onTrack || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => openReport("risk-exposure", "Risk Exposure Analysis Report")}
            >
              <Card className="relative overflow-hidden group">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-orange-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">At Risk</p>
                      <p className="text-2xl font-semibold">{metrics?.summary.atRisk || 0}</p>
                    </div>
                  </div>
                </CardContent>
                {loadingReport === "risk-exposure" && (
                  <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500/0 via-orange-500 to-orange-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Card>
            </div>

            <div 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => openReport("risk-exposure", "Risk Exposure Analysis Report")}
            >
              <Card className="relative overflow-hidden group">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-red-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Overdue</p>
                      <p className="text-2xl font-semibold">{metrics?.summary.overdue || 0}</p>
                    </div>
                  </div>
                </CardContent>
                {loadingReport === "risk-exposure" && (
                  <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500/0 via-red-500 to-red-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Card>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Engagement Status Distribution</CardTitle>
                <CardDescription>Current status of all engagements</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPie>
                      <Pie
                        data={[
                          { name: "On Track", value: metrics?.summary.onTrack || 0, fill: "#22c55e" },
                          { name: "At Risk", value: metrics?.summary.atRisk || 0, fill: "#f59e0b" },
                          { name: "Overdue", value: metrics?.summary.overdue || 0, fill: "#ef4444" },
                          { name: "Completed", value: metrics?.summary.completed || 0, fill: "#3b82f6" },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {[0, 1, 2, 3].map((_, index) => (
                          <Cell key={`cell-${index}`} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </RechartsPie>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Resource Utilization</CardTitle>
                <CardDescription>Budget vs. actual hours</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-5xl font-semibold text-primary">{metrics?.hours.utilizationRate || 0}%</p>
                    <p className="text-sm text-muted-foreground mt-1">Overall Utilization Rate</p>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span>Total Budget Hours</span>
                      <span className="font-medium">{formatAccounting(metrics?.hours.totalBudget)}</span>
                    </div>
                    <Progress value={100} className="h-2 bg-muted" />
                    <div className="flex justify-between text-sm">
                      <span>Actual Hours Used</span>
                      <span className="font-medium">{formatAccounting(metrics?.hours.totalActual)}</span>
                    </div>
                    <Progress value={metrics?.hours.utilizationRate || 0} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="utilization" className="space-y-4">
          <div 
            className="cursor-pointer"
            onClick={() => openReport("resource-intelligence", "Resource Intelligence Report")}
          >
            <Card className="relative overflow-hidden group hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Team Utilization
                  {loadingReport === "resource-intelligence" && (
                    <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  )}
                </CardTitle>
                <CardDescription>
                  Hours allocated vs. capacity by team member
                  <span className="text-primary ml-2">(Click for detailed report)</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  {utilizationChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={utilizationChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="utilization" name="Utilization %" fill="#3b82f6" />
                        <Bar dataKey="engagements" name="Engagements" fill="#22c55e" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      No team utilization data available
                    </div>
                  )}
                </div>
              </CardContent>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/0 via-primary to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <Users className="h-8 w-8 mx-auto text-primary mb-2" />
                  <p className="text-3xl font-semibold">{metrics?.summary.activeUsers || 0}</p>
                  <p className="text-sm text-muted-foreground">Active Team Members</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <Activity className="h-8 w-8 mx-auto text-green-500 mb-2" />
                  <p className="text-3xl font-semibold">{metrics?.hours.utilizationRate || 0}%</p>
                  <p className="text-sm text-muted-foreground">Average Utilization</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <Briefcase className="h-8 w-8 mx-auto text-blue-500 mb-2" />
                  <p className="text-3xl font-semibold">{metrics?.summary.totalEngagements || 0}</p>
                  <p className="text-sm text-muted-foreground">Active Engagements</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Team Member Details</CardTitle>
              <CardDescription>Individual utilization breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <div className="space-y-3">
                  {metrics?.teamUtilization?.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium">{member.name}</p>
                        <p className="text-sm text-muted-foreground">{member.role}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{member.utilization}%</p>
                        <p className="text-xs text-muted-foreground">{member.engagementCount} engagements</p>
                      </div>
                    </div>
                  ))}
                  {(!metrics?.teamUtilization || metrics.teamUtilization.length === 0) && (
                    <p className="text-center text-muted-foreground py-4">No team data available</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Completion Timelines
              </CardTitle>
              <CardDescription>Track engagement completion against deadlines</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                <Card className="bg-green-50 dark:bg-green-950/20 border-green-200">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-8 w-8 text-green-500" />
                      <div>
                        <p className="text-2xl font-semibold text-green-700 dark:text-green-400">
                          {metrics?.summary.completed || 0}
                        </p>
                        <p className="text-sm text-green-600 dark:text-green-500">Completed On Time</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-orange-50 dark:bg-orange-950/20 border-orange-200">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="h-8 w-8 text-orange-500" />
                      <div>
                        <p className="text-2xl font-semibold text-orange-700 dark:text-orange-400">
                          {metrics?.summary.atRisk || 0}
                        </p>
                        <p className="text-sm text-orange-600 dark:text-orange-500">At Risk of Delay</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-red-50 dark:bg-red-950/20 border-red-200">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-8 w-8 text-red-500" />
                      <div>
                        <p className="text-2xl font-semibold text-red-700 dark:text-red-400">
                          {metrics?.summary.overdue || 0}
                        </p>
                        <p className="text-sm text-red-600 dark:text-red-500">Past Deadline</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              <div className="h-48 flex items-center justify-center">
                <div className="text-center">
                  <Target className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-muted-foreground">
                    Timeline visualization based on engagement deadlines
                  </p>
                  <Button variant="ghost" className="mt-2 text-primary" onClick={() => openReport("engagement-health", "Engagement Health Report")}>
                    View detailed timeline report
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="portfolio" className="space-y-4">
          <div 
            className="cursor-pointer"
            onClick={() => openReport("portfolio-intelligence", "Portfolio Intelligence Report")}
          >
            <Card className="relative overflow-hidden group hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle>Portfolio Analysis</CardTitle>
                <CardDescription>
                  Overview of client portfolio and engagement distribution
                  <span className="text-primary ml-2">(Click for detailed report)</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-4">By Industry</h4>
                    {industryChartData.length > 0 ? (
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <RechartsPie>
                            <Pie
                              data={industryChartData}
                              cx="50%"
                              cy="50%"
                              outerRadius={60}
                              dataKey="value"
                              label={({ name, value }) => `${name}: ${value}`}
                            >
                              {industryChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </RechartsPie>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">No data available</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 className="font-medium mb-4">By Engagement Type</h4>
                    {typeChartData.length > 0 ? (
                      <div className="space-y-2">
                        {typeChartData.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between">
                            <span className="text-sm">{item.name}</span>
                            <Badge variant="secondary">{item.value}</Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">No data available</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
              {loadingReport === "portfolio-intelligence" && (
                <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/0 via-primary to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <Building className="h-8 w-8 mx-auto text-primary mb-2" />
                  <p className="text-3xl font-semibold">{metrics?.summary.totalClients || 0}</p>
                  <p className="text-sm text-muted-foreground">Total Clients</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <Briefcase className="h-8 w-8 mx-auto text-blue-500 mb-2" />
                  <p className="text-3xl font-semibold">{metrics?.summary.totalEngagements || 0}</p>
                  <p className="text-sm text-muted-foreground">Total Engagements</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <PieChart className="h-8 w-8 mx-auto text-green-500 mb-2" />
                  <p className="text-3xl font-semibold">{industryChartData.length}</p>
                  <p className="text-sm text-muted-foreground">Industry Sectors</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <ReportViewer
        isOpen={reportViewerOpen}
        onClose={() => setReportViewerOpen(false)}
        reportType={activeReportType || "engagement-health"}
        data={reportData}
        title={reportTitle}
      />
    </div>
  );
}
