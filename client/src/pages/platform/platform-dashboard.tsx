import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Building2, Users, BarChart3, Shield, Bot, Bell, FileText,
  AlertTriangle, Clock, ChevronRight, Moon,
  Server, Cpu, Activity, Globe, RefreshCw, CheckCircle2,
  XCircle, Database, Lock, Radio, ChevronDown, ChevronUp,
  Container, Wifi, HardDrive, Zap, Eye, UserPlus, Briefcase,
  MonitorCheck, ShieldAlert, Key, UserCheck, LogIn, TrendingUp,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, Legend,
} from "recharts";

interface SystemHealthData {
  connected: boolean;
  mode?: "local" | "ssh" | "none";
  timestamp: string;
  server?: { hostname: string; ip: string; os: string; kernel: string; uptime: string; loadAverage: string; users: string };
  resources?: {
    cpu: { usagePercent: number; cores: number };
    memory: { total: string; used: string; free: string; usagePercent: number };
    disk: { total: string; used: string; avail: string; usagePercent: number; mountPoint: string };
  };
  application?: {
    pm2Processes: Array<{ name: string; id: number; status: string; cpu: string; memory: string; uptime: string; restarts: number; pid: number; mode: string }>;
    nodeVersion: string; npmVersion: string;
    dockerContainers?: Array<{ name: string; status: string; ports: string }>;
  };
  services?: { nginx: string; postgresql: string };
  security?: { firewall: string[]; openPorts: Array<{ protocol: string; address: string; state: string }>; ssl: string };
}

interface PingData { reachable: boolean; httpStatus?: number; responseTime?: number; url?: string; error?: string }

interface DashboardMetrics {
  activeSessions: number;
  totalClients: number;
  todayLogins: number;
  failedLogins7d: number;
  recentAuditLogs: number;
  engagementsThisMonth: number;
  usersCreatedThisMonth: number;
  firmsCreatedThisMonth: number;
  engagementsByStatus: Record<string, number>;
  recentActivity: Array<{ id: string; action: string; entity: string; createdAt: string; userId: string; ip: string | null }>;
  dailyStats: Array<{ day: string; actions: number; registrations: number; engagements: number }>;
}

const PIE_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];

function RingGauge({ value, label, detail, color, size = 72 }: { value: number; label: string; detail?: string; color: string; size?: number }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(value, 100) / 100) * circ;
  const stroke = value > 90 ? "#ef4444" : value > 70 ? "#f59e0b" : color;
  const textColor = value > 90 ? "text-red-600" : value > 70 ? "text-amber-600" : "text-foreground";
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="-rotate-90" style={{ width: size, height: size }} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={stroke} strokeWidth="4" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset} className="transition-all duration-700 ease-out" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-sm font-bold tabular-nums ${textColor}`}>{value}%</span>
        </div>
      </div>
      <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
      {detail && <span className="text-[9px] text-muted-foreground/60">{detail}</span>}
    </div>
  );
}

function HealthIndicator({ label, status, icon: Icon }: { label: string; status: "healthy" | "warning" | "critical" | "unknown"; icon: any }) {
  const config = {
    healthy: { bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-800", dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400" },
    warning: { bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-800", dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-400" },
    critical: { bg: "bg-red-50 dark:bg-red-950/30", border: "border-red-200 dark:border-red-800", dot: "bg-red-500", text: "text-red-700 dark:text-red-400" },
    unknown: { bg: "bg-gray-50 dark:bg-gray-950/30", border: "border-gray-200 dark:border-gray-800", dot: "bg-gray-400", text: "text-gray-600 dark:text-gray-400" },
  }[status];
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${config.bg} ${config.border}`}>
      <Icon className={`h-3.5 w-3.5 ${config.text}`} />
      <span className="text-xs font-medium flex-1">{label}</span>
      <span className={`h-2 w-2 rounded-full ${config.dot} ${status === "healthy" ? "animate-pulse" : ""}`} />
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, color, subtext }: { label: string; value: string | number; icon: any; color: string; subtext?: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border bg-card">
      <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-lg font-bold leading-tight tabular-nums">{value}</div>
        <div className="text-[10px] text-muted-foreground leading-tight">{label}</div>
        {subtext && <div className="text-[9px] text-muted-foreground/60">{subtext}</div>}
      </div>
    </div>
  );
}

function ProbeButton({ label, ok, detail, icon: Icon, onClick, isChecking }: { label: string; ok: boolean; detail: string; icon: any; onClick?: () => void; isChecking?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={isChecking}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition-all w-full text-left ${ok ? "border-emerald-200 bg-emerald-50/80 dark:border-emerald-900 dark:bg-emerald-950/40" : "border-red-200 bg-red-50/80 dark:border-red-900 dark:bg-red-950/40"} ${onClick ? "cursor-pointer hover:shadow-sm active:scale-[0.99]" : ""}`}>
      <div className={`h-7 w-7 rounded-md flex items-center justify-center ${ok ? "bg-emerald-100 dark:bg-emerald-900/50" : "bg-red-100 dark:bg-red-900/50"}`}>
        {isChecking ? <RefreshCw className="h-3.5 w-3.5 animate-spin text-blue-500" /> : <Icon className={`h-3.5 w-3.5 ${ok ? "text-emerald-600" : "text-red-600"}`} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="text-xs font-semibold">{label}</span>
          {!isChecking && (ok ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <XCircle className="h-3 w-3 text-red-500" />)}
        </div>
        <p className={`text-[10px] truncate ${ok ? "text-emerald-600/70" : "text-red-600/70"}`}>{isChecking ? "Checking..." : detail}</p>
      </div>
    </button>
  );
}

export default function PlatformDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshCountdown, setRefreshCountdown] = useState(20);
  const [probeChecking, setProbeChecking] = useState<Record<string, boolean>>({});
  const [probeResults, setProbeResults] = useState<Record<string, { ok: boolean; detail: string }>>({});
  const [activeTab, setActiveTab] = useState("overview");

  const { data: analytics, isLoading: analyticsLoading } = useQuery<any>({
    queryKey: ["/api/platform/analytics"],
    refetchInterval: 30000,
  });
  const { data: healthData, isRefetching, refetch } = useQuery<SystemHealthData>({
    queryKey: ["/api/platform/system-health"],
    refetchInterval: autoRefresh ? 20000 : false,
    staleTime: 10000,
  });
  const { data: pingData } = useQuery<PingData>({
    queryKey: ["/api/platform/system-health/ping"],
    refetchInterval: autoRefresh ? 20000 : false,
    staleTime: 10000,
  });
  const { data: metrics } = useQuery<DashboardMetrics>({
    queryKey: ["/api/platform/dashboard-metrics"],
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const handleProbeCheck = async (probe: string) => {
    setProbeChecking(prev => ({ ...prev, [probe]: true }));
    try {
      const res = await apiRequest("POST", `/api/platform/system-health/probe/${probe}`);
      const data = await res.json();
      setProbeResults(prev => ({ ...prev, [probe]: data }));
      toast({ title: `${probe.toUpperCase()} Probe`, description: data.ok ? `Healthy: ${data.detail}` : `Issue: ${data.detail}`, variant: data.ok ? "default" : "destructive" });
    } catch (err: any) {
      toast({ title: "Probe Failed", description: err.message, variant: "destructive" });
    } finally {
      setProbeChecking(prev => ({ ...prev, [probe]: false }));
    }
  };

  useEffect(() => {
    if (!autoRefresh) return;
    setRefreshCountdown(20);
    const iv = setInterval(() => setRefreshCountdown(p => (p <= 1 ? 20 : p - 1)), 1000);
    return () => clearInterval(iv);
  }, [autoRefresh, healthData?.timestamp]);

  const isConnected = healthData?.connected ?? false;
  const cpuPct = healthData?.resources?.cpu?.usagePercent ?? 0;
  const memPct = healthData?.resources?.memory?.usagePercent ?? 0;
  const diskPct = healthData?.resources?.disk?.usagePercent ?? 0;

  const hasAlerts = !isConnected || cpuPct > 90 || memPct > 90 || diskPct > 90 ||
    (healthData?.services && healthData.services.nginx !== "active") ||
    (healthData?.services && healthData.services.postgresql !== "active") ||
    (pingData !== undefined && !pingData?.reachable);

  const overallStatus: "healthy" | "warning" | "critical" = !isConnected ? "critical" : hasAlerts ? "warning" : "healthy";
  const statusLabel = { healthy: "All Systems Operational", warning: "Issues Detected", critical: "System Offline" }[overallStatus];
  const statusColor = { healthy: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300", warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300", critical: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300" }[overallStatus];
  const statusDot = { healthy: "bg-emerald-500", warning: "bg-amber-500", critical: "bg-red-500" }[overallStatus];

  const svcNginx = healthData?.services?.nginx === "active";
  const svcPg = healthData?.services?.postgresql === "active";
  const containers = healthData?.application?.dockerContainers || [];
  const runningContainers = containers.filter(c => c.status.toLowerCase().includes("up")).length;

  const navItems = [
    { label: "Firm Management", href: "/platform/firms", icon: Building2, accent: "text-primary" },
    { label: "Plan Management", href: "/platform/plans", icon: BarChart3, accent: "text-blue-600" },
    { label: "Notifications", href: "/platform/notifications", icon: Bell, accent: "text-amber-600" },
    { label: "Audit Logs", href: "/platform/audit-logs", icon: FileText, accent: "text-green-600" },
    { label: "AI Config", href: "/platform/ai-config", icon: Bot, accent: "text-purple-600" },
  ];

  const engStatusData = metrics?.engagementsByStatus
    ? Object.entries(metrics.engagementsByStatus).map(([name, value]) => ({ name: name.replace(/_/g, " "), value }))
    : [];

  return (
    <div className="p-2.5 md:p-3 space-y-2.5 max-w-[1440px] mx-auto">

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Platform Dashboard</h1>
            <p className="text-xs text-muted-foreground">Enterprise admin monitoring & control center</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={`text-xs gap-1.5 ${statusColor} hover:${statusColor}`}>
            <span className={`h-2 w-2 rounded-full ${statusDot} ${overallStatus === "healthy" ? "animate-pulse" : ""}`} />
            {statusLabel}
          </Badge>
          {healthData?.mode && healthData.mode !== "none" && (
            <Badge variant="outline" className="text-[10px]">{healthData.mode === "local" ? "Local" : "SSH"}</Badge>
          )}
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isRefetching} className="h-8 gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button size="sm" variant={autoRefresh ? "default" : "outline"} onClick={() => setAutoRefresh(!autoRefresh)} className="h-8 gap-1 tabular-nums">
            <Radio className={`h-3.5 w-3.5 ${autoRefresh ? "animate-pulse" : ""}`} />
            {autoRefresh ? `${refreshCountdown}s` : "Auto"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">

        <Card className="lg:col-span-8">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <MonitorCheck className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-semibold">System Health Status</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              <HealthIndicator label="Server" status={isConnected ? "healthy" : "critical"} icon={Server} />
              <HealthIndicator label="Application" status={pingData?.reachable ? "healthy" : isConnected ? "warning" : "critical"} icon={Zap} />
              <HealthIndicator label="Frontend" status={pingData?.reachable ? "healthy" : "critical"} icon={Globe} />
              <HealthIndicator label="Database" status={svcPg ? "healthy" : isConnected ? "critical" : "unknown"} icon={Database} />
              <HealthIndicator label="Nginx" status={svcNginx ? "healthy" : isConnected ? "critical" : "unknown"} icon={Server} />
              <HealthIndicator label="Containers" status={containers.length > 0 ? (runningContainers === containers.length ? "healthy" : "warning") : isConnected ? "unknown" : "unknown"} icon={Container} />
              <HealthIndicator label="Cache (Redis)" status={containers.some(c => c.name.includes("redis") && c.status.toLowerCase().includes("up")) ? "healthy" : isConnected ? "warning" : "unknown"} icon={HardDrive} />
              <HealthIndicator label="SSL Certificate" status={healthData?.security?.ssl && !healthData.security.ssl.includes("No SSL") ? "healthy" : isConnected ? "warning" : "unknown"} icon={Lock} />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-4">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Cpu className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-semibold">Resources</span>
              {healthData?.server?.uptime && (
                <span className="text-[9px] text-muted-foreground ml-auto">Up {healthData.server.uptime}</span>
              )}
            </div>
            {healthData?.resources ? (
              <div className="flex items-center justify-around py-1">
                <RingGauge value={cpuPct} label="CPU" color="#3b82f6" detail={`${healthData.resources.cpu.cores} cores`} />
                <RingGauge value={memPct} label="Memory" color="#8b5cf6" detail={healthData.resources.memory.used} />
                <RingGauge value={diskPct} label="Disk" color="#f59e0b" detail={healthData.resources.disk.used} />
              </div>
            ) : (
              <div className="text-center py-3 text-xs text-muted-foreground">Waiting for server data...</div>
            )}
            {healthData?.server?.loadAverage && (
              <div className="text-center mt-1">
                <span className="text-[9px] text-muted-foreground">Load: {healthData.server.loadAverage}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full">
          <TabsTrigger value="overview"><BarChart3 className="h-3.5 w-3.5" /> Overview</TabsTrigger>
          <TabsTrigger value="infrastructure"><Server className="h-3.5 w-3.5" /> Infrastructure</TabsTrigger>
          <TabsTrigger value="security"><ShieldAlert className="h-3.5 w-3.5" /> Security</TabsTrigger>
          <TabsTrigger value="activity"><Activity className="h-3.5 w-3.5" /> Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-2.5 mt-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            <Card className="cursor-pointer hover:shadow-md transition-all hover:scale-[1.02]" onClick={() => setLocation("/platform/firms")}>
              <CardContent className="p-2.5 text-center">
                <div className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-primary/10 mb-1"><Building2 className="h-3.5 w-3.5 text-primary" /></div>
                <div className="text-lg font-bold leading-tight">{analyticsLoading ? "..." : analytics?.totalFirms || 0}</div>
                <div className="text-[10px] text-muted-foreground">Total Firms</div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:shadow-md transition-all hover:scale-[1.02]" onClick={() => setLocation("/platform/firms?status=ACTIVE")}>
              <CardContent className="p-2.5 text-center">
                <div className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-green-50 dark:bg-green-950 mb-1"><Shield className="h-3.5 w-3.5 text-green-600" /></div>
                <div className="text-lg font-bold leading-tight">{analyticsLoading ? "..." : analytics?.activeFirms || 0}</div>
                <div className="text-[10px] text-muted-foreground">Active</div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:shadow-md transition-all hover:scale-[1.02]" onClick={() => setLocation("/platform/firms?status=TRIAL")}>
              <CardContent className="p-2.5 text-center">
                <div className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-amber-50 dark:bg-amber-950 mb-1"><Clock className="h-3.5 w-3.5 text-amber-600" /></div>
                <div className="text-lg font-bold leading-tight">{analyticsLoading ? "..." : analytics?.trialFirms || 0}</div>
                <div className="text-[10px] text-muted-foreground">Trial</div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:shadow-md transition-all hover:scale-[1.02]" onClick={() => setLocation("/platform/firms?status=SUSPENDED")}>
              <CardContent className="p-2.5 text-center">
                <div className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-red-50 dark:bg-red-950 mb-1"><AlertTriangle className="h-3.5 w-3.5 text-red-500" /></div>
                <div className="text-lg font-bold leading-tight">{analyticsLoading ? "..." : analytics?.suspendedFirms || 0}</div>
                <div className="text-[10px] text-muted-foreground">Suspended</div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:shadow-md transition-all hover:scale-[1.02]" onClick={() => setLocation("/platform/firms")}>
              <CardContent className="p-2.5 text-center">
                <div className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-purple-50 dark:bg-purple-950 mb-1"><Users className="h-3.5 w-3.5 text-purple-600" /></div>
                <div className="text-lg font-bold leading-tight">{analyticsLoading ? "..." : analytics?.totalUsers || 0}</div>
                <div className="text-[10px] text-muted-foreground">Users</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-2.5 text-center">
                <div className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-indigo-50 dark:bg-indigo-950 mb-1"><Briefcase className="h-3.5 w-3.5 text-indigo-600" /></div>
                <div className="text-lg font-bold leading-tight">{analyticsLoading ? "..." : metrics?.totalClients || 0}</div>
                <div className="text-[10px] text-muted-foreground">Clients</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-2.5 text-center">
                <div className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-indigo-50 dark:bg-indigo-950 mb-1"><FileText className="h-3.5 w-3.5 text-indigo-600" /></div>
                <div className="text-lg font-bold leading-tight">{analyticsLoading ? "..." : analytics?.totalEngagements || 0}</div>
                <div className="text-[10px] text-muted-foreground">Engagements</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-2.5 text-center">
                <div className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-cyan-50 dark:bg-cyan-950 mb-1"><Bot className="h-3.5 w-3.5 text-cyan-600" /></div>
                <div className="text-lg font-bold leading-tight">{analyticsLoading ? "..." : analytics?.aiUsageThisMonth || 0}</div>
                <div className="text-[10px] text-muted-foreground">AI Usage</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            <Card className="lg:col-span-8">
              <CardHeader className="pb-1 pt-3 px-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-500" /> 7-Day Activity Trend
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3 px-3">
                {metrics?.dailyStats && metrics.dailyStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={metrics.dailyStats}>
                      <defs>
                        <linearGradient id="colorActions" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorRegs" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))" }} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Area type="monotone" dataKey="actions" name="Actions" stroke="#3b82f6" fill="url(#colorActions)" strokeWidth={2} />
                      <Area type="monotone" dataKey="registrations" name="Registrations" stroke="#10b981" fill="url(#colorRegs)" strokeWidth={2} />
                      <Area type="monotone" dataKey="engagements" name="Engagements" stroke="#8b5cf6" fill="none" strokeWidth={2} strokeDasharray="4 4" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[200px] text-xs text-muted-foreground">Loading activity data...</div>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-4">
              <CardHeader className="pb-1 pt-3 px-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-indigo-500" /> Engagements by Status
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3 px-3">
                {engStatusData.length > 0 ? (
                  <div>
                    <ResponsiveContainer width="100%" height={140}>
                      <PieChart>
                        <Pie data={engStatusData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={3} dataKey="value">
                          {engStatusData.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-1">
                      {engStatusData.map((e, i) => (
                        <div key={e.name} className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="text-[9px] text-muted-foreground">{e.name}: {e.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[180px] text-xs text-muted-foreground">No engagement data</div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <MetricCard label="Active Sessions" value={metrics?.activeSessions ?? "..."} icon={Eye} color="bg-blue-500" />
            <MetricCard label="Today's Logins" value={metrics?.todayLogins ?? "..."} icon={LogIn} color="bg-emerald-500" />
            <MetricCard label="New Users (Month)" value={metrics?.usersCreatedThisMonth ?? "..."} icon={UserPlus} color="bg-purple-500" />
            <MetricCard label="New Engagements (Month)" value={metrics?.engagementsThisMonth ?? "..."} icon={Briefcase} color="bg-indigo-500" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <Card className="cursor-pointer hover:border-primary/40 hover:shadow-md transition-all group h-full">
                  <CardContent className="p-3 flex items-center gap-2.5">
                    <item.icon className={`h-4 w-4 flex-shrink-0 ${item.accent}`} />
                    <span className="text-sm font-semibold truncate">{item.label}</span>
                    <ChevronRight className="h-3.5 w-3.5 ml-auto text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="infrastructure" className="space-y-2.5 mt-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-500" /> Health Probes
                  {healthData?.server?.ip && (
                    <Badge variant="outline" className="text-[10px] ml-auto font-mono">{healthData.server.ip}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3 px-3">
                <div className="grid grid-cols-2 gap-2">
                  <ProbeButton label="HTTP" ok={probeResults.http?.ok ?? !!pingData?.reachable} detail={probeResults.http?.detail ?? (pingData?.reachable ? `Status ${pingData.httpStatus}` : (pingData?.error?.substring(0, 20) || "N/A"))} icon={Globe} onClick={() => handleProbeCheck("http")} isChecking={probeChecking.http} />
                  <ProbeButton label="API" ok={probeResults.api?.ok ?? !!pingData?.reachable} detail={probeResults.api?.detail ?? (pingData?.reachable ? `${pingData.responseTime}ms` : "Timeout")} icon={Activity} onClick={() => handleProbeCheck("api")} isChecking={probeChecking.api} />
                  <ProbeButton label="Database" ok={probeResults.database?.ok ?? svcPg} detail={probeResults.database?.detail ?? (svcPg ? "Active" : (healthData?.services?.postgresql || "Unknown"))} icon={Database} onClick={() => handleProbeCheck("database")} isChecking={probeChecking.database} />
                  <ProbeButton label="Nginx" ok={probeResults.nginx?.ok ?? svcNginx} detail={probeResults.nginx?.detail ?? (svcNginx ? "Active" : (healthData?.services?.nginx || "Unknown"))} icon={Server} onClick={() => handleProbeCheck("nginx")} isChecking={probeChecking.nginx} />
                </div>
                <p className="text-[9px] text-muted-foreground text-center mt-2">Click to re-check</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Container className="h-4 w-4 text-teal-500" /> Docker Containers
                  <Badge variant="outline" className="text-[10px] ml-auto">{runningContainers}/{containers.length} running</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3 px-3">
                {containers.length > 0 ? (
                  <div className="space-y-1.5">
                    {containers.map((c, i) => {
                      const isUp = c.status.toLowerCase().includes("up");
                      const isHealthy = c.status.toLowerCase().includes("healthy");
                      return (
                        <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/40">
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${isUp ? (isHealthy ? "bg-emerald-500" : "bg-amber-500") : "bg-red-500"}`} />
                            <span className="text-xs font-medium">{c.name.replace("auditwise-", "")}</span>
                          </div>
                          <Badge variant={isUp ? "default" : "destructive"} className={`text-[9px] h-5 ${isUp ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 hover:bg-emerald-100" : ""}`}>
                            {isHealthy ? "Healthy" : isUp ? "Up" : "Down"}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-3 text-xs text-muted-foreground">{isConnected ? "No containers detected" : "Connect to view containers"}</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-blue-500" /> Server Details
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3 px-3">
                {healthData?.server ? (
                  <div className="space-y-1.5 text-xs">
                    {[
                      { k: "Hostname", v: healthData.server.hostname },
                      { k: "IP Address", v: healthData.server.ip },
                      { k: "OS", v: healthData.server.os },
                      { k: "Kernel", v: healthData.server.kernel },
                      { k: "Uptime", v: healthData.server.uptime },
                      { k: "Load Average", v: healthData.server.loadAverage },
                      { k: "Active Users", v: healthData.server.users },
                    ].map(({ k, v }) => (
                      <div key={k} className="flex justify-between py-1 px-2 rounded bg-muted/30">
                        <span className="text-muted-foreground">{k}</span>
                        <span className="font-medium text-right truncate max-w-[200px]">{v || "N/A"}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-3 text-xs text-muted-foreground">No server data</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-amber-500" /> Resource Utilization
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3 px-3">
                {healthData?.resources ? (
                  <div className="space-y-3">
                    {[
                      { label: "CPU", pct: cpuPct, detail: `${healthData.resources.cpu.cores} cores`, color: "bg-blue-500" },
                      { label: "Memory", pct: memPct, detail: `${healthData.resources.memory.used} / ${healthData.resources.memory.total}`, color: "bg-purple-500" },
                      { label: "Disk", pct: diskPct, detail: `${healthData.resources.disk.used} / ${healthData.resources.disk.total}`, color: "bg-amber-500" },
                    ].map(({ label, pct, detail, color }) => (
                      <div key={label}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium">{label}</span>
                          <span className={`tabular-nums ${pct > 90 ? "text-red-500 font-bold" : pct > 70 ? "text-amber-500" : "text-muted-foreground"}`}>{pct}%</span>
                        </div>
                        <Progress value={pct} className="h-2" />
                        <span className="text-[9px] text-muted-foreground">{detail}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-3 text-xs text-muted-foreground">No resource data</div>
                )}
              </CardContent>
            </Card>

            {healthData?.application?.pm2Processes && healthData.application.pm2Processes.length > 0 && (
              <Card className="md:col-span-2">
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="h-4 w-4 text-teal-500" /> Application Processes
                    <span className="text-[10px] font-normal text-muted-foreground ml-auto">Node {healthData.application.nodeVersion}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-3 px-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {healthData.application.pm2Processes.map((proc, i) => (
                      <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/40 border">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${proc.status === "online" ? "bg-emerald-500" : "bg-red-500"}`} />
                          <span className="text-xs font-semibold">{proc.name}</span>
                          <span className="text-[10px] text-muted-foreground">PID {proc.pid}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                          <span>CPU {proc.cpu}</span>
                          <span>Mem {proc.memory}</span>
                          <span className={proc.restarts > 5 ? "text-amber-500 font-medium" : ""}>Restarts {proc.restarts}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="security" className="space-y-2.5 mt-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <MetricCard label="SSL Certificate" value={healthData?.security?.ssl && !healthData.security.ssl.includes("No SSL") ? "Valid" : "Unknown"} icon={Lock} color={healthData?.security?.ssl && !healthData.security.ssl.includes("No SSL") ? "bg-emerald-500" : "bg-gray-400"} subtext={healthData?.security?.ssl || ""} />
            <MetricCard label="Firewall Status" value={healthData?.security?.firewall?.length ? "Active" : "Unknown"} icon={Shield} color={healthData?.security?.firewall?.length ? "bg-emerald-500" : "bg-gray-400"} />
            <MetricCard label="Failed Logins (7d)" value={metrics?.failedLogins7d ?? "..."} icon={ShieldAlert} color={(metrics?.failedLogins7d ?? 0) > 10 ? "bg-red-500" : "bg-emerald-500"} />
            <MetricCard label="Active Sessions" value={metrics?.activeSessions ?? "..."} icon={UserCheck} color="bg-blue-500" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Lock className="h-4 w-4 text-emerald-500" /> SSL & Encryption
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3 px-3">
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between py-1 px-2 rounded bg-muted/30">
                    <span className="text-muted-foreground">SSL Status</span>
                    <Badge variant="outline" className="text-[10px]">{healthData?.security?.ssl || "Unknown"}</Badge>
                  </div>
                  <div className="flex justify-between py-1 px-2 rounded bg-muted/30">
                    <span className="text-muted-foreground">Connection</span>
                    <span className="font-medium">{isConnected ? (healthData?.mode === "local" ? "Local (mTLS)" : "SSH Encrypted") : "Disconnected"}</span>
                  </div>
                  <div className="flex justify-between py-1 px-2 rounded bg-muted/30">
                    <span className="text-muted-foreground">RBAC System</span>
                    <Badge className="text-[10px] bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Active</Badge>
                  </div>
                  <div className="flex justify-between py-1 px-2 rounded bg-muted/30">
                    <span className="text-muted-foreground">Rate Limiting</span>
                    <Badge className="text-[10px] bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Enabled</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {healthData?.security?.openPorts && healthData.security.openPorts.length > 0 && (
              <Card>
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Wifi className="h-4 w-4 text-amber-500" /> Open Ports
                    <Badge variant="outline" className="text-[10px] ml-auto">{healthData.security.openPorts.length} ports</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-3 px-3">
                  <div className="flex flex-wrap gap-1.5">
                    {healthData.security.openPorts.map((port, i) => (
                      <Badge key={i} variant="outline" className="text-[10px] font-mono">{port.address}</Badge>
                    ))}
                  </div>
                  {healthData.security.firewall && healthData.security.firewall.length > 0 && (
                    <div className="mt-3 pt-2 border-t">
                      <span className="text-[10px] text-muted-foreground font-medium">Firewall Rules</span>
                      <div className="mt-1 space-y-0.5">
                        {healthData.security.firewall.slice(0, 6).map((rule, i) => (
                          <div key={i} className="text-[9px] font-mono text-muted-foreground truncate">{rule}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="activity" className="space-y-2.5 mt-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <MetricCard label="Active Sessions" value={metrics?.activeSessions ?? "..."} icon={Eye} color="bg-blue-500" />
            <MetricCard label="Today's Logins" value={metrics?.todayLogins ?? "..."} icon={LogIn} color="bg-emerald-500" />
            <MetricCard label="Audit Actions Today" value={metrics?.recentAuditLogs ?? "..."} icon={FileText} color="bg-amber-500" />
            <MetricCard label="Failed Logins (7d)" value={metrics?.failedLogins7d ?? "..."} icon={ShieldAlert} color={(metrics?.failedLogins7d ?? 0) > 10 ? "bg-red-500" : "bg-indigo-500"} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            <Card className="lg:col-span-7">
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-blue-500" /> Daily Activity Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3 px-3">
                {metrics?.dailyStats && metrics.dailyStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={metrics.dailyStats} barGap={2}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Bar dataKey="actions" name="Actions" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="registrations" name="Users" fill="#10b981" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="engagements" name="Engagements" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[220px] text-xs text-muted-foreground">Loading...</div>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-5">
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-500" /> Recent Activity Feed
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3 px-3">
                {metrics?.recentActivity && metrics.recentActivity.length > 0 ? (
                  <div className="space-y-1 max-h-[260px] overflow-y-auto pr-1">
                    {metrics.recentActivity.map((event) => (
                      <div key={event.id} className="flex items-start gap-2 py-1.5 px-2 rounded-md hover:bg-muted/40 transition-colors">
                        <div className="h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Zap className="h-2.5 w-2.5 text-blue-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-medium truncate">
                            {event.action.replace(/_/g, " ")}
                          </div>
                          <div className="text-[9px] text-muted-foreground flex items-center gap-2">
                            <span>{event.entity}</span>
                            <span>{new Date(event.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                            {event.ip && <span className="font-mono">{event.ip}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[260px] text-xs text-muted-foreground">No recent activity</div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
