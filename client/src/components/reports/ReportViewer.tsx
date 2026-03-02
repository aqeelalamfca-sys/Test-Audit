import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  X,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Users,
  BarChart3,
} from "lucide-react";
import { format } from "date-fns";
import { formatAccounting } from '@/lib/formatters';

type ReportType = "engagement-health" | "risk-exposure" | "resource-intelligence" | "portfolio-intelligence";

interface ReportViewerProps {
  isOpen: boolean;
  onClose: () => void;
  reportType: ReportType;
  data: any;
  title: string;
}

export function ReportViewer({ isOpen, onClose, reportType, data, title }: ReportViewerProps) {
  const [activeTab, setActiveTab] = useState("summary");

  const handleExportPDF = () => {
    window.print();
  };

  const convertToCSV = (objArray: any[], headers?: string[]): string => {
    if (!objArray || objArray.length === 0) return "";
    const keys = headers || Object.keys(objArray[0]);
    const csvRows = [keys.join(",")];
    for (const obj of objArray) {
      const values = keys.map(key => {
        const val = obj[key];
        if (val === null || val === undefined) return "";
        if (typeof val === "object") return JSON.stringify(val).replace(/,/g, ";");
        return String(val).replace(/,/g, ";").replace(/\n/g, " ");
      });
      csvRows.push(values.join(","));
    }
    return csvRows.join("\n");
  };

  const handleExportCSV = () => {
    let csvContent = "";
    const timestamp = format(new Date(), "yyyy-MM-dd");
    
    if (reportType === "engagement-health" && data?.engagements) {
      csvContent = convertToCSV(data.engagements, [
        "code", "client", "industry", "type", "phase", "status", 
        "riskRating", "healthStatus", "budgetHours", "actualHours", "teamSize"
      ]);
    } else if (reportType === "risk-exposure") {
      const riskData = [
        ...(data?.atRiskEngagements || []).map((e: any) => ({ ...e, category: "At Risk" })),
        ...(data?.overdueEngagements || []).map((e: any) => ({ ...e, category: "Overdue" })),
      ];
      csvContent = convertToCSV(riskData, ["code", "client", "category", "phase", "daysOverdue", "partner"]);
    } else if (reportType === "resource-intelligence" && data?.teamMembers) {
      csvContent = convertToCSV(data.teamMembers, [
        "name", "role", "engagementCount", "allocatedHours", "utilization", "status"
      ]);
    } else if (reportType === "portfolio-intelligence" && data?.industryAnalysis) {
      csvContent = convertToCSV(data.industryAnalysis, [
        "industry", "clientCount", "engagementCount", "riskProfile"
      ]);
    } else {
      csvContent = JSON.stringify(data, null, 2);
    }
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportType}-report-${timestamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderEngagementHealthReport = () => {
    if (!data) return null;
    const { summary, engagements, riskDistribution, phaseDistribution, revenueMetrics } = data;

    return (
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="summary">Executive Summary</TabsTrigger>
          <TabsTrigger value="engagements">Engagements</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-primary">{summary?.totalEngagements || 0}</p>
                  <p className="text-sm text-muted-foreground">Total Engagements</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-500">{summary?.onTrack || 0}</p>
                  <p className="text-sm text-muted-foreground">On Track</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-orange-500">{summary?.atRisk || 0}</p>
                  <p className="text-sm text-muted-foreground">At Risk</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-red-500">{summary?.overdue || 0}</p>
                  <p className="text-sm text-muted-foreground">Overdue</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-blue-500">{summary?.completed || 0}</p>
                  <p className="text-sm text-muted-foreground">Completed</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Resource Utilization</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Budget Hours: {revenueMetrics?.totalBudgetHours || 0}</span>
                  <span>Actual Hours: {revenueMetrics?.totalActualHours || 0}</span>
                </div>
                <Progress value={revenueMetrics?.utilizationRate || 0} className="h-2" />
                <p className="text-center text-sm text-muted-foreground">
                  {revenueMetrics?.utilizationRate || 0}% Utilization Rate
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Risk Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {riskDistribution?.map((item: any) => (
                    <div key={item.category} className="flex items-center justify-between">
                      <span className="text-sm">{item.category}</span>
                      <Badge variant={item.category.includes("High") ? "destructive" : item.category.includes("Medium") ? "secondary" : "outline"}>
                        {item.count}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Phase Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {phaseDistribution?.slice(0, 5).map((item: any) => (
                    <div key={item.phase} className="flex items-center justify-between">
                      <span className="text-sm">{item.phase.replace(/_/g, " ")}</span>
                      <Badge variant="secondary">{item.count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="engagements" className="mt-4">
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {engagements?.map((eng: any) => (
                <Card key={eng.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{eng.code}</p>
                      <p className="text-sm text-muted-foreground">{eng.client}</p>
                    </div>
                    <div className="text-right">
                      <Badge
                        variant={
                          eng.healthStatus === "overdue" ? "destructive" :
                          eng.healthStatus === "at_risk" ? "secondary" :
                          eng.healthStatus === "completed" ? "outline" :
                          "default"
                        }
                      >
                        {eng.healthStatus.replace(/_/g, " ").toUpperCase()}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">{eng.phase}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Risk: {eng.riskRating}</span>
                    <span>Progress: {eng.phaseProgress}%</span>
                    <span>Team: {eng.teamSize}</span>
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="analysis" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <BarChart3 className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">Portfolio Health Score</p>
                    <p className="text-sm text-muted-foreground">
                      Based on current metrics, your engagement portfolio has a health score of{" "}
                      <span className="font-bold text-green-500">
                        {Math.round(((summary?.onTrack || 0) / (summary?.totalEngagements || 1)) * 100)}%
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <TrendingUp className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <p className="font-medium">Capacity Utilization</p>
                    <p className="text-sm text-muted-foreground">
                      Resource utilization is at {revenueMetrics?.utilizationRate || 0}% of budgeted capacity.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5" />
                  <div>
                    <p className="font-medium">Risk Concentration</p>
                    <p className="text-sm text-muted-foreground">
                      {summary?.atRisk || 0} engagements require immediate attention due to elevated risk levels.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-4">
                {summary?.atRisk > 0 && (
                  <div className="flex items-start gap-3 p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5" />
                    <div>
                      <p className="font-medium">Address High-Risk Engagements</p>
                      <p className="text-sm text-muted-foreground">
                        Schedule risk review meetings for {summary.atRisk} at-risk engagements to develop mitigation strategies.
                      </p>
                    </div>
                  </div>
                )}
                {summary?.overdue > 0 && (
                  <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                    <Clock className="h-5 w-5 text-red-500 mt-0.5" />
                    <div>
                      <p className="font-medium">Resolve Overdue Engagements</p>
                      <p className="text-sm text-muted-foreground">
                        {summary.overdue} engagements are past deadline. Consider resource reallocation or deadline extensions.
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div>
                    <p className="font-medium">Maintain Quality Standards</p>
                    <p className="text-sm text-muted-foreground">
                      Continue monitoring engagement progress and conducting regular quality reviews per ISQM-1 requirements.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    );
  };

  const renderRiskExposureReport = () => {
    if (!data) return null;
    const { atRiskEngagements, overdueEngagements, rootCauseAnalysis, impactAssessment, recommendations } = data;

    return (
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="summary">Overview</TabsTrigger>
          <TabsTrigger value="at-risk">At-Risk ({atRiskEngagements?.length || 0})</TabsTrigger>
          <TabsTrigger value="overdue">Overdue ({overdueEngagements?.length || 0})</TabsTrigger>
          <TabsTrigger value="recommendations">Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  Root Cause Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {rootCauseAnalysis?.map((item: any) => (
                    <div key={item.cause} className="flex items-center justify-between">
                      <span className="text-sm">{item.cause}</span>
                      <Badge variant="secondary">{item.count}</Badge>
                    </div>
                  ))}
                  {(!rootCauseAnalysis || rootCauseAnalysis.length === 0) && (
                    <p className="text-sm text-muted-foreground">No significant root causes identified</p>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-red-500" />
                  Impact Assessment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {impactAssessment?.map((item: any) => (
                    <div key={item.level} className="flex items-center justify-between">
                      <span className="text-sm">{item.level}</span>
                      <Badge
                        variant={
                          item.level === "Critical" ? "destructive" :
                          item.level === "High" ? "secondary" :
                          "outline"
                        }
                      >
                        {item.count}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="at-risk" className="mt-4">
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {atRiskEngagements?.map((eng: any) => (
                <Card key={eng.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{eng.code}</p>
                      <p className="text-sm text-muted-foreground">{eng.client}</p>
                    </div>
                    <Badge variant="destructive">HIGH RISK</Badge>
                  </div>
                  <p className="text-sm mt-2">{eng.reason}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {eng.riskFactors?.map((factor: string, idx: number) => (
                      <Badge key={idx} variant="outline" className="text-xs">{factor}</Badge>
                    ))}
                  </div>
                </Card>
              ))}
              {(!atRiskEngagements || atRiskEngagements.length === 0) && (
                <p className="text-center text-muted-foreground py-8">No at-risk engagements</p>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="overdue" className="mt-4">
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {overdueEngagements?.map((eng: any) => (
                <Card key={eng.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{eng.code}</p>
                      <p className="text-sm text-muted-foreground">{eng.client}</p>
                    </div>
                    <Badge variant="destructive">{eng.daysOverdue} days overdue</Badge>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span>Phase: {eng.phase}</span>
                    <span>Partner: {eng.partner || "Unassigned"}</span>
                  </div>
                </Card>
              ))}
              {(!overdueEngagements || overdueEngagements.length === 0) && (
                <p className="text-center text-muted-foreground py-8">No overdue engagements</p>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="recommendations" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-3">
                {recommendations?.map((rec: string, idx: number) => (
                  <div key={idx} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-sm">{rec}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    );
  };

  const renderResourceIntelligenceReport = () => {
    if (!data) return null;
    const { teamMembers, utilizationMetrics, engagementProfitability, capacityForecast } = data;

    return (
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="summary">Overview</TabsTrigger>
          <TabsTrigger value="team">Team ({teamMembers?.length || 0})</TabsTrigger>
          <TabsTrigger value="profitability">Profitability</TabsTrigger>
          <TabsTrigger value="capacity">Capacity</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4 mt-4">
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-primary">{utilizationMetrics?.overall || 0}%</p>
                  <p className="text-sm text-muted-foreground">Overall Utilization</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-500">{capacityForecast?.availableCapacity || 0}</p>
                  <p className="text-sm text-muted-foreground">Available Resources</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-orange-500">{capacityForecast?.upcomingDeadlines || 0}</p>
                  <p className="text-sm text-muted-foreground">Upcoming Deadlines</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Utilization by Role</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {utilizationMetrics?.byRole?.map((item: any) => (
                  <div key={item.role} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>{item.role} ({item.members})</span>
                      <span>{item.utilization}%</span>
                    </div>
                    <Progress value={item.utilization} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="mt-4">
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {teamMembers?.map((member: any) => (
                <Card key={member.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{member.name}</p>
                      <p className="text-sm text-muted-foreground">{member.role}</p>
                    </div>
                    <Badge
                      variant={
                        member.status === "overloaded" ? "destructive" :
                        member.status === "optimal" ? "default" :
                        "secondary"
                      }
                    >
                      {member.utilization}% Utilized
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span>{member.engagementCount} engagements</span>
                    <span>{member.allocatedHours} hours allocated</span>
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="profitability" className="mt-4">
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {engagementProfitability?.map((eng: any) => (
                <Card key={eng.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{eng.code}</p>
                      <p className="text-sm text-muted-foreground">{eng.client}</p>
                    </div>
                    <Badge
                      variant={
                        eng.status === "over_budget" ? "destructive" :
                        eng.status === "on_track" ? "default" :
                        "secondary"
                      }
                    >
                      {eng.budgetUsed}% Budget Used
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span>Budget: {eng.budgetHours}h</span>
                    <span>Actual: {eng.actualHours}h</span>
                    <span>Team: {eng.teamSize}</span>
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="capacity" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Users className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">Current Workload</p>
                    <p className="text-sm text-muted-foreground">
                      Team is operating at {capacityForecast?.currentLoad || 0}% capacity.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <p className="font-medium">Available Capacity</p>
                    <p className="text-sm text-muted-foreground">
                      {capacityForecast?.availableCapacity || 0} team members have capacity for additional work.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-orange-500 mt-0.5" />
                  <div>
                    <p className="font-medium">Upcoming Deadlines</p>
                    <p className="text-sm text-muted-foreground">
                      {capacityForecast?.upcomingDeadlines || 0} engagements have deadlines in the next 30 days.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    );
  };

  const renderPortfolioIntelligenceReport = () => {
    if (!data) return null;
    const { industryAnalysis, serviceLineAnalysis, clientConcentration, growthTrends } = data;

    return (
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="summary">Overview</TabsTrigger>
          <TabsTrigger value="industry">Industry</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="clients">Top Clients</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Growth Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                {growthTrends?.map((trend: any) => (
                  <div key={trend.metric} className="text-center p-4 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold">{trend.current}</p>
                    <p className="text-sm text-muted-foreground">{trend.metric}</p>
                    {trend.change !== 0 && (
                      <p className={`text-xs ${trend.change > 0 ? "text-green-500" : "text-red-500"}`}>
                        {trend.change > 0 ? "+" : ""}{trend.change} from last period
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="industry" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-3">
                {industryAnalysis?.map((item: any) => (
                  <div key={item.industry} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-medium">{item.industry}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.clientCount} clients | {item.engagementCount} engagements
                      </p>
                    </div>
                    <Badge
                      variant={
                        item.riskProfile === "HIGH" ? "destructive" :
                        item.riskProfile === "NORMAL" ? "secondary" :
                        "outline"
                      }
                    >
                      {item.riskProfile} Risk
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-3">
                {serviceLineAnalysis?.map((item: any) => (
                  <div key={item.type} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>{item.type}</span>
                      <span>{item.count} ({item.percentage}%)</span>
                    </div>
                    <Progress value={item.percentage} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clients" className="mt-4">
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {clientConcentration?.map((client: any, idx: number) => (
                <Card key={client.client} className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-muted-foreground">#{idx + 1}</span>
                      <div>
                        <p className="font-medium">{client.client}</p>
                        <p className="text-sm text-muted-foreground">{client.engagements} engagements</p>
                      </div>
                    </div>
                    <p className="text-lg font-bold">PKR {formatAccounting(client.revenue)}</p>
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    );
  };

  const renderReport = () => {
    switch (reportType) {
      case "engagement-health":
        return renderEngagementHealthReport();
      case "risk-exposure":
        return renderRiskExposureReport();
      case "resource-intelligence":
        return renderResourceIntelligenceReport();
      case "portfolio-intelligence":
        return renderPortfolioIntelligenceReport();
      default:
        return <p>Unknown report type</p>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl">{title}</DialogTitle>
              <DialogDescription>
                Generated on {format(new Date(data?.generatedAt || new Date()), "PPpp")}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExportPDF}>
                <Printer className="h-4 w-4 mr-1" />
                Print
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <FileSpreadsheet className="h-4 w-4 mr-1" />
                CSV
              </Button>
            </div>
          </div>
        </DialogHeader>
        <ScrollArea className="flex-1 mt-4">
          {renderReport()}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
