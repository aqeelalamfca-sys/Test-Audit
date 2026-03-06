import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2, Users, BarChart3, Shield, Bot, Bell, FileText,
  AlertTriangle, Clock, ChevronRight, Moon,
  Server, Cpu, GitBranch, Activity, Globe, RefreshCw, CheckCircle2,
  XCircle, Terminal, Lock, Zap, MonitorCheck, Container, Layers,
  Radio, Rocket, ChevronDown, ChevronUp, Package, Database, RotateCcw,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface DockerContainer { name: string; status: string; ports: string }

interface SystemHealthData {
  connected: boolean;
  mode?: "local" | "ssh" | "none";
  error?: string;
  timestamp: string;
  server?: { hostname: string; ip: string; os: string; kernel: string; uptime: string; loadAverage: string; users: string };
  resources?: {
    cpu: { usagePercent: number; cores: number };
    memory: { total: string; used: string; free: string; usagePercent: number };
    disk: { total: string; used: string; avail: string; usagePercent: number; mountPoint: string };
  };
  git?: { remote: string; commit: string; commitFull: string; message: string; author: string; date: string; branch: string; status: string; isDirty: boolean };
  application?: {
    pm2Processes: Array<{ name: string; id: number; status: string; cpu: string; memory: string; uptime: string; restarts: number; pid: number; mode: string }>;
    nodeVersion: string; npmVersion: string;
    dockerContainers?: DockerContainer[];
  };
  services?: { nginx: string; postgresql: string };
  security?: { firewall: string[]; openPorts: Array<{ protocol: string; address: string; state: string }>; ssl: string };
  deployment?: { cronJobs: string; lastFetch: string; pullLog: string; status: DeploymentStatus };
}

interface DeploymentStatus {
  status: "idle" | "running" | "success" | "failed";
  step: number; totalSteps: number; currentStep: string;
  log: string[]; startedAt: string | null; completedAt: string | null; triggeredBy: string | null;
}

interface PingData { reachable: boolean; httpStatus?: number; responseTime?: number; url?: string; error?: string }

const PIPELINE_STEPS = [
  { id: "pull", label: "Git Pull", icon: GitBranch },
  { id: "deps", label: "Install", icon: Package },
  { id: "build", label: "Build", icon: Rocket },
  { id: "migrate", label: "Migrate", icon: Database },
  { id: "restart", label: "Restart", icon: RotateCcw },
];

function RingGauge({ value, label, detail, color, size = 72 }: { value: number; label: string; detail?: string; color: string; size?: number }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(value, 100) / 100) * circ;
  const stroke = value > 90 ? "hsl(0, 72%, 51%)" : value > 70 ? "hsl(38, 92%, 50%)" : color;
  const textColor = value > 90 ? "text-red-600 dark:text-red-400" : value > 70 ? "text-amber-600 dark:text-amber-400" : "text-foreground";
  return (
    <div className="flex flex-col items-center gap-1" data-testid={`gauge-${label.toLowerCase()}`}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="-rotate-90" style={{ width: size, height: size }} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="5" />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={stroke} strokeWidth="5" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset} className="transition-all duration-700 ease-out" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-base font-bold tabular-nums ${textColor}`}>{value}%</span>
        </div>
      </div>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {detail && <span className="text-[10px] text-muted-foreground/70">{detail}</span>}
    </div>
  );
}

function StatusDot({ active, size = "sm" }: { active: boolean; size?: "sm" | "md" }) {
  const s = size === "md" ? "h-2.5 w-2.5" : "h-2 w-2";
  return (
    <span className={`inline-block rounded-full ${s} ${active ? "bg-emerald-500" : "bg-red-400"}`} aria-hidden="true" />
  );
}

function ProbeItem({ label, ok, detail, icon: Icon }: { label: string; ok: boolean; detail: string; icon: any }) {
  return (
    <div className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 transition-colors ${ok ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40" : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40"}`}
      data-testid={`health-check-${label.toLowerCase()}`}>
      <div className={`h-7 w-7 rounded-md flex items-center justify-center ${ok ? "bg-emerald-100 dark:bg-emerald-900/50" : "bg-red-100 dark:bg-red-900/50"}`}>
        <Icon className={`h-3.5 w-3.5 ${ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold">{label}</span>
          {ok ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <XCircle className="h-3 w-3 text-red-500" />}
        </div>
        <p className={`text-[10px] truncate ${ok ? "text-emerald-600/70 dark:text-emerald-400/60" : "text-red-600/70 dark:text-red-400/60"}`}>{detail}</p>
      </div>
    </div>
  );
}

export default function PlatformDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshCountdown, setRefreshCountdown] = useState(20);
  const [deployLogExpanded, setDeployLogExpanded] = useState(false);
  const [liveDeployStatus, setLiveDeployStatus] = useState<DeploymentStatus | null>(null);
  const [sseStepUpdates, setSseStepUpdates] = useState<Record<number, { status: string; output?: string }>>({});
  const [isPollingDeploy, setIsPollingDeploy] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

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
  const { data: deployLogData, refetch: refetchLogs } = useQuery<{ logs: string }>({
    queryKey: ["/api/platform/system-health/deploy/logs"],
    staleTime: 30000,
  });
  const { data: deployStatusData } = useQuery<{ deployment: DeploymentStatus }>({
    queryKey: ["/api/platform/system-health/deploy/status"],
    refetchInterval: isPollingDeploy ? 3000 : false,
    staleTime: 2000,
  });

  const deployMutation = useMutation({
    mutationFn: async () => { const res = await apiRequest("POST", "/api/platform/system-health/deploy"); return res.json(); },
    onSuccess: () => {
      toast({ title: "Deploy Initiated", description: "Pipeline is running..." });
      setIsPollingDeploy(true);
      queryClient.invalidateQueries({ queryKey: ["/api/platform/system-health"] });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/system-health/deploy/status"] });
    },
    onError: (err: any) => { toast({ title: "Deploy Failed", description: err.message, variant: "destructive" }); },
  });

  useEffect(() => {
    const es = new EventSource(`/api/platform/system-health/events`);
    eventSourceRef.current = es;
    es.addEventListener("deploy-start", (e) => { const d = JSON.parse(e.data); setLiveDeployStatus(d); setSseStepUpdates({}); setIsPollingDeploy(true); });
    es.addEventListener("deploy-progress", (e) => {
      const d = JSON.parse(e.data);
      setSseStepUpdates(prev => ({ ...prev, [d.step]: { status: d.status, output: d.output } }));
      setLiveDeployStatus(prev => prev ? { ...prev, step: d.step, currentStep: d.label } : prev);
    });
    es.addEventListener("deploy-complete", (e) => {
      const d = JSON.parse(e.data);
      setLiveDeployStatus(prev => prev ? { ...prev, status: d.status, completedAt: d.completedAt } : prev);
      setIsPollingDeploy(false);
      queryClient.invalidateQueries({ queryKey: ["/api/platform/system-health"] });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/system-health/deploy/status"] });
      refetchLogs();
      toast({ title: d.status === "success" ? "Deploy Complete" : "Deploy Failed", description: d.status === "success" ? "All steps completed successfully." : "Check logs for details.", variant: d.status === "success" ? "default" : "destructive" });
    });
    return () => { es.close(); };
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    setRefreshCountdown(20);
    const iv = setInterval(() => setRefreshCountdown(p => (p <= 1 ? 20 : p - 1)), 1000);
    return () => clearInterval(iv);
  }, [autoRefresh, healthData?.timestamp]);

  const polledDeploy = deployStatusData?.deployment;
  const deployStatus = (isPollingDeploy && polledDeploy) ? polledDeploy : liveDeployStatus || polledDeploy || healthData?.deployment?.status || { status: "idle" as const, step: 0, totalSteps: 5, currentStep: "", log: [], startedAt: null, completedAt: null, triggeredBy: null };
  const isDeploying = deployStatus.status === "running";

  useEffect(() => {
    if (isPollingDeploy && polledDeploy && polledDeploy.status !== "running") {
      setIsPollingDeploy(false);
      if (polledDeploy.status === "success") { queryClient.invalidateQueries({ queryKey: ["/api/platform/system-health"] }); refetchLogs(); }
    }
  }, [polledDeploy?.status, isPollingDeploy]);

  const isConnected = healthData?.connected ?? false;
  const hasAlerts = !isConnected ||
    (healthData?.resources?.cpu?.usagePercent ?? 0) > 90 ||
    (healthData?.resources?.memory?.usagePercent ?? 0) > 90 ||
    (healthData?.resources?.disk?.usagePercent ?? 0) > 90 ||
    (healthData?.services && healthData.services.nginx !== "active") ||
    (healthData?.services && healthData.services.postgresql !== "active") ||
    (pingData !== undefined && !pingData?.reachable);

  const overallStatus: "live" | "issues" | "offline" = !isConnected ? "offline" : hasAlerts ? "issues" : "live";

  const stats = [
    { label: "Total Firms", value: analytics?.totalFirms || 0, icon: Building2, color: "text-primary", bg: "bg-primary/10", href: "/platform/firms" },
    { label: "Active Firms", value: analytics?.activeFirms || 0, icon: Shield, color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950", href: "/platform/firms?status=ACTIVE" },
    { label: "Trial Firms", value: analytics?.trialFirms || 0, icon: Clock, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950", href: "/platform/firms?status=TRIAL" },
    { label: "Dormant", value: analytics?.dormantFirms || 0, icon: Moon, color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-950", href: "/platform/firms?status=DORMANT" },
    { label: "Suspended", value: analytics?.suspendedFirms || 0, icon: AlertTriangle, color: "text-red-500", bg: "bg-red-50 dark:bg-red-950", href: "/platform/firms?status=SUSPENDED" },
    { label: "Total Users", value: analytics?.totalUsers || 0, icon: Users, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-950", href: "/platform/firms" },
    { label: "Engagements", value: analytics?.totalEngagements || 0, icon: FileText, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-950", href: "/platform/firms" },
    { label: "AI Usage", value: analytics?.aiUsageThisMonth || 0, icon: Bot, color: "text-cyan-600 dark:text-cyan-400", bg: "bg-cyan-50 dark:bg-cyan-950", href: "/platform/ai-config" },
  ];

  const navItems = [
    { label: "Firm Management", href: "/platform/firms", icon: Building2, description: "Manage tenant firms", accent: "text-primary" },
    { label: "Plan Management", href: "/platform/plans", icon: BarChart3, description: "Plans & pricing", accent: "text-blue-600 dark:text-blue-400" },
    { label: "Notifications", href: "/platform/notifications", icon: Bell, description: "Alerts & messages", accent: "text-amber-600 dark:text-amber-400" },
    { label: "Audit Logs", href: "/platform/audit-logs", icon: FileText, description: "Activity logs", accent: "text-green-600 dark:text-green-400" },
    { label: "AI Configuration", href: "/platform/ai-config", icon: Bot, description: "API keys & settings", accent: "text-purple-600 dark:text-purple-400" },
  ];

  const allServices: { name: string; active: boolean }[] = [];
  if (healthData?.services) {
    allServices.push({ name: "Nginx", active: healthData.services.nginx === "active" });
    allServices.push({ name: "PostgreSQL", active: healthData.services.postgresql === "active" });
  }
  healthData?.application?.pm2Processes?.forEach(p => allServices.push({ name: p.name, active: p.status === "online" }));
  healthData?.application?.dockerContainers?.forEach(c => allServices.push({ name: c.name, active: c.status.toLowerCase().includes("up") }));

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1400px] mx-auto" data-testid="platform-dashboard">

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold" data-testid="text-page-title">Platform Dashboard</h1>
            <p className="text-sm text-muted-foreground">Overview of firms, system health, and deployments</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={overallStatus === "live" ? "default" : overallStatus === "issues" ? "secondary" : "destructive"}
            className={`text-xs gap-1.5 ${overallStatus === "live" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 hover:bg-emerald-100" : overallStatus === "issues" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 hover:bg-amber-100" : ""}`}
            data-testid="text-overall-status">
            <StatusDot active={overallStatus === "live"} />
            {overallStatus === "live" ? "System Online" : overallStatus === "issues" ? "Issues Detected" : "System Offline"}
          </Badge>
          {healthData?.mode && healthData.mode !== "none" && (
            <Badge variant="outline" className="text-[10px]" data-testid="badge-mode">
              {healthData.mode === "local" ? "Local" : "SSH"}
            </Badge>
          )}
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isRefetching} className="h-8 gap-1.5" data-testid="btn-refresh">
            <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? "animate-spin" : ""}`} aria-hidden="true" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button size="sm" variant={autoRefresh ? "default" : "outline"} onClick={() => setAutoRefresh(!autoRefresh)}
            aria-pressed={autoRefresh} className="h-8 gap-1 tabular-nums" data-testid="btn-auto-refresh">
            <Radio className={`h-3.5 w-3.5 ${autoRefresh ? "animate-pulse" : ""}`} aria-hidden="true" />
            {autoRefresh ? `${refreshCountdown}s` : "Auto"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
        {stats.map((stat) => (
          <Card key={stat.label} className="cursor-pointer hover:shadow-md transition-all hover:scale-[1.02] group"
            onClick={() => setLocation(stat.href)} data-testid={`card-stat-${stat.label.toLowerCase().replace(/\s/g, '-')}`}>
            <CardContent className="p-2.5 text-center">
              <div className={`inline-flex items-center justify-center h-7 w-7 rounded-lg ${stat.bg} mb-1`}>
                <stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
              </div>
              <div className="text-lg font-bold leading-tight" data-testid={`text-stat-value-${stat.label.toLowerCase().replace(/\s/g, '-')}`}>
                {analyticsLoading ? "..." : stat.value}
              </div>
              <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-2">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="cursor-pointer hover:border-primary/40 hover:shadow-md transition-all group h-full" data-testid={`link-${item.label.toLowerCase().replace(/\s/g, '-')}`}>
              <CardContent className="p-3 flex items-center gap-2.5">
                <item.icon className={`h-4 w-4 flex-shrink-0 ${item.accent}`} />
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{item.label}</div>
                  <p className="text-[10px] text-muted-foreground truncate">{item.description}</p>
                </div>
                <ChevronRight className="h-3.5 w-3.5 ml-auto text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-3">

        <Card className="col-span-4" data-testid="resource-gauges">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Cpu className="h-4 w-4 text-blue-500" /> Server Resources
              {healthData?.server?.uptime && (
                <span className="text-[10px] font-normal text-muted-foreground ml-auto">Up {healthData.server.uptime}</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            {healthData?.resources ? (
              <div className="flex items-center justify-around">
                <RingGauge value={healthData.resources.cpu.usagePercent} label="CPU" color="hsl(var(--primary))" detail={`${healthData.resources.cpu.cores} cores`} />
                <RingGauge value={healthData.resources.memory.usagePercent} label="Memory" color="hsl(262, 83%, 58%)" detail={healthData.resources.memory.used} />
                <RingGauge value={healthData.resources.disk.usagePercent} label="Disk" color="hsl(38, 92%, 50%)" detail={healthData.resources.disk.used} />
              </div>
            ) : (
              <div className="text-center py-6 text-sm text-muted-foreground">No metrics available</div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-4" data-testid="health-checks-grid">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-500" /> Health Probes
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <div className="grid grid-cols-2 gap-2">
              <ProbeItem label="HTTP" ok={!!pingData?.reachable} detail={pingData?.reachable ? `Status ${pingData.httpStatus}` : (pingData?.error?.substring(0, 20) || "N/A")} icon={Globe} />
              <ProbeItem label="API" ok={!!pingData?.reachable} detail={pingData?.reachable ? `${pingData.responseTime}ms` : "Timeout"} icon={Activity} />
              <ProbeItem label="Database" ok={healthData?.services?.postgresql === "active"} detail={healthData?.services?.postgresql === "active" ? "Active" : (healthData?.services?.postgresql || "Unknown")} icon={Database} />
              <ProbeItem label="Nginx" ok={healthData?.services?.nginx === "active"} detail={healthData?.services?.nginx === "active" ? "Active" : (healthData?.services?.nginx || "Unknown")} icon={Server} />
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-4" data-testid="card-services">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Layers className="h-4 w-4 text-violet-500" /> Services
              {healthData?.server?.ip && (
                <Badge variant="outline" className="text-[10px] ml-auto font-mono" data-testid="badge-ip">{healthData.server.ip}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            {allServices.length > 0 ? (
              <div className="space-y-1.5">
                {allServices.map((svc, i) => (
                  <div key={i} className="flex items-center justify-between py-1 px-2 rounded-md bg-muted/40" data-testid={`svc-${svc.name.toLowerCase().replace(/\s+/g, "-")}`}>
                    <span className="text-xs font-medium truncate">{svc.name}</span>
                    <Badge variant={svc.active ? "default" : "destructive"} className={`text-[10px] h-5 ${svc.active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 hover:bg-emerald-100" : ""}`}>
                      {svc.active ? "Running" : "Stopped"}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-sm text-muted-foreground">No services detected</div>
            )}
            {healthData?.security && (
              <div className="flex items-center gap-3 mt-2 pt-2 border-t text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Lock className="h-3 w-3" /> SSL: {healthData.security.ssl || "Unknown"}
                </span>
                <span className="flex items-center gap-1">
                  <Shield className="h-3 w-3" /> {isConnected ? (healthData?.mode === "local" ? "Local" : "SSH") : "Disconnected"}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-8" data-testid="card-deployment-pipeline">
          <CardHeader className="pb-2 pt-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Rocket className="h-4 w-4 text-blue-500" /> Deploy Pipeline
                {isDeploying && <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 text-[10px] animate-pulse hover:bg-blue-100">Running</Badge>}
                {deployStatus.status === "success" && <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 text-[10px] hover:bg-emerald-100">Success</Badge>}
                {deployStatus.status === "failed" && <Badge variant="destructive" className="text-[10px]">Failed</Badge>}
              </CardTitle>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" disabled={isDeploying || !isConnected} className="h-7 gap-1.5 text-xs" data-testid="btn-deploy">
                    {isDeploying ? <RefreshCw className="h-3 w-3 animate-spin" aria-hidden="true" /> : <Rocket className="h-3 w-3" aria-hidden="true" />}
                    {isDeploying ? "Deploying..." : "Deploy"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Production Deploy</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will pull latest code, install dependencies, build, migrate the database, and restart the server. Brief downtime may occur.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel data-testid="btn-deploy-cancel">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deployMutation.mutate()} data-testid="btn-deploy-confirm">
                      <Rocket className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" /> Deploy Now
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            {isDeploying && (
              <div className="mb-3">
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${(deployStatus.step / deployStatus.totalSteps) * 100}%` }} />
                </div>
                <p className="text-[11px] text-muted-foreground text-center mt-1">
                  Step {deployStatus.step} of {deployStatus.totalSteps} — {deployStatus.currentStep}
                </p>
              </div>
            )}
            <div className="flex gap-2">
              {PIPELINE_STEPS.map((step, i) => {
                const stepNum = i + 1;
                const sseUpdate = sseStepUpdates[stepNum];
                let st: "pending" | "running" | "success" | "failed" = "pending";
                if (isDeploying) {
                  if (stepNum < deployStatus.step) st = "success";
                  else if (stepNum === deployStatus.step) st = sseUpdate?.status === "success" ? "success" : sseUpdate?.status === "failed" ? "failed" : "running";
                } else if (deployStatus.status === "success") st = "success";
                else if (deployStatus.status === "failed") st = stepNum <= deployStatus.step ? (stepNum === deployStatus.step ? "failed" : "success") : "pending";
                if (sseUpdate?.status === "success") st = "success";
                if (sseUpdate?.status === "failed") st = "failed";

                const StepIcon = step.icon;
                const bgClass = st === "success" ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800" : st === "running" ? "bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800" : st === "failed" ? "bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-800" : "bg-muted/30 border-border";
                const iconClass = st === "success" ? "text-emerald-600 dark:text-emerald-400" : st === "running" ? "text-blue-600 dark:text-blue-400" : st === "failed" ? "text-red-600 dark:text-red-400" : "text-muted-foreground";

                return (
                  <div key={step.id} className={`flex-1 rounded-lg border ${bgClass} py-2.5 px-2 text-center transition-all`} data-testid={`pipeline-step-${step.id}`}>
                    <div className="flex justify-center mb-1">
                      {st === "running" ? (
                        <div className="relative h-7 w-7">
                          <div className="absolute inset-0 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                          <StepIcon className="absolute inset-0 m-auto h-3 w-3 text-blue-500" />
                        </div>
                      ) : (
                        <div className={`h-7 w-7 rounded-full flex items-center justify-center ${st === "success" ? "bg-emerald-100 dark:bg-emerald-900/50" : st === "failed" ? "bg-red-100 dark:bg-red-900/50" : "bg-muted"}`}>
                          {st === "success" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : st === "failed" ? <XCircle className="h-3.5 w-3.5 text-red-500" /> : <StepIcon className={`h-3 w-3 ${iconClass}`} />}
                        </div>
                      )}
                    </div>
                    <p className={`text-[11px] font-medium ${iconClass}`}>{step.label}</p>
                  </div>
                );
              })}
            </div>
            {(deployStatus.log.length > 0 || (deployLogData?.logs && deployLogData.logs.length > 0)) && (
              <div className="mt-2">
                <button type="button" onClick={() => { setDeployLogExpanded(!deployLogExpanded); if (!deployLogExpanded) refetchLogs(); }}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  aria-expanded={deployLogExpanded} aria-controls="deploy-log-panel" data-testid="btn-toggle-deploy-logs">
                  <Terminal className="h-3 w-3" aria-hidden="true" /> View Logs
                  {deployLogExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
                {deployLogExpanded && (
                  <div id="deploy-log-panel" className="mt-1.5 bg-slate-950 rounded-lg p-3 max-h-32 overflow-y-auto border">
                    <pre className="text-[11px] font-mono text-emerald-400 whitespace-pre-wrap leading-relaxed">
                      {deployStatus.log.length > 0 ? deployStatus.log.join("\n") : ""}
                      {deployLogData?.logs ? "\n" + deployLogData.logs : ""}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-4" data-testid="card-repository">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-purple-500" /> Source Repository
              {healthData?.git?.branch && healthData.git.branch !== "unknown" && (
                <Badge variant="outline" className="text-[10px] ml-auto font-mono" data-testid="badge-branch">{healthData.git.branch}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            {healthData?.git ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Commit</span>
                  <code className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded">{healthData.git.commit}</code>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Message</span>
                  <span className="text-right truncate max-w-[180px]" title={healthData.git.message}>{healthData.git.message}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Author</span>
                  <span className="truncate max-w-[150px]">{healthData.git.author}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Date</span>
                  <span>{healthData.git.date ? new Date(healthData.git.date).toLocaleDateString() : "N/A"}</span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1 border-t">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={healthData.git.isDirty ? "secondary" : "default"}
                    className={`text-[10px] h-5 ${!healthData.git.isDirty ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 hover:bg-emerald-100" : ""}`}>
                    {healthData.git.isDirty ? "Modified" : "Clean"}
                  </Badge>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-sm text-muted-foreground">No source data available</div>
            )}
          </CardContent>
        </Card>

        {showDetails && (
          <>
            {healthData?.application?.pm2Processes && healthData.application.pm2Processes.length > 0 && (
              <Card className="col-span-6" data-testid="card-application">
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Container className="h-4 w-4 text-teal-500" /> Application Runtime
                    <span className="text-[10px] font-normal text-muted-foreground ml-auto">
                      Node {healthData.application.nodeVersion}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-3 px-4">
                  <div className="space-y-2">
                    {healthData.application.pm2Processes.map((proc, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 px-3 rounded-md bg-muted/40 border" data-testid={`pm2-process-${proc.name}`}>
                        <div className="flex items-center gap-2">
                          <StatusDot active={proc.status === "online"} size="md" />
                          <span className="text-xs font-semibold">{proc.name}</span>
                          <span className="text-[10px] text-muted-foreground">PID {proc.pid}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
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
            {healthData?.security && (
              <Card className={`${healthData?.application?.pm2Processes?.length ? "col-span-6" : "col-span-12"}`} data-testid="card-security">
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Shield className="h-4 w-4 text-red-500" /> Security
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-3 px-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-xs text-muted-foreground">SSL Certificate</span>
                      <p className="text-sm font-medium flex items-center gap-1 mt-0.5">
                        <Lock className="h-3 w-3" /> {healthData.security.ssl || "Unknown"}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Connection Mode</span>
                      <p className="text-sm font-medium mt-0.5">{isConnected ? (healthData?.mode === "local" ? "Local" : "SSH") : "Disconnected"}</p>
                    </div>
                    {healthData.security.openPorts && healthData.security.openPorts.length > 0 && (
                      <div className="col-span-2">
                        <span className="text-xs text-muted-foreground">Open Ports</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {healthData.security.openPorts.slice(0, 10).map((port, i) => (
                            <Badge key={i} variant="outline" className="text-[10px] font-mono">{port.address}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      <div className="flex justify-center">
        <Button variant="ghost" size="sm" onClick={() => setShowDetails(!showDetails)} className="text-xs text-muted-foreground gap-1.5" data-testid="btn-toggle-details">
          {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {showDetails ? "Show Less" : "Show More Details"}
        </Button>
      </div>
    </div>
  );
}
