import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import {
  Server, Cpu, HardDrive, MemoryStick, GitBranch,
  Activity, Shield, Globe, RefreshCw, Clock, CheckCircle2,
  XCircle, AlertTriangle, WifiOff, Terminal,
  Lock, Zap, MonitorCheck, Container, Layers,
  Timer, CircleDot, Radio, Rocket, Play,
  ChevronDown, ChevronUp, Eye,
  Package, Database, RotateCcw, Power,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface DockerContainer {
  name: string;
  status: string;
  ports: string;
}

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
  deployment?: {
    cronJobs: string; lastFetch: string; pullLog: string;
    status: DeploymentStatus;
  };
}

interface DeploymentStatus {
  status: "idle" | "running" | "success" | "failed";
  step: number;
  totalSteps: number;
  currentStep: string;
  log: string[];
  startedAt: string | null;
  completedAt: string | null;
  triggeredBy: string | null;
}

interface PingData { reachable: boolean; httpStatus?: number; responseTime?: number; url?: string; error?: string }

const PIPELINE_STEPS = [
  { id: "pull", label: "Repository Pull", icon: GitBranch, desc: "git pull origin main" },
  { id: "deps", label: "Install Dependencies", icon: Package, desc: "npm ci" },
  { id: "build", label: "Build Application", icon: Rocket, desc: "npm run build" },
  { id: "migrate", label: "Database Migration", icon: Database, desc: "prisma db push" },
  { id: "restart", label: "Restart PM2", icon: RotateCcw, desc: "pm2 restart" },
];

function StatusDot({ status, size = "sm" }: { status: "green" | "orange" | "red" | "blue" | "grey"; size?: "sm" | "md" }) {
  const colors = {
    green: "bg-emerald-500 shadow-emerald-500/50",
    orange: "bg-amber-500 shadow-amber-500/50",
    red: "bg-red-500 shadow-red-500/50",
    blue: "bg-blue-500 shadow-blue-500/50",
    grey: "bg-gray-400 shadow-gray-400/50",
  };
  const sizeClass = size === "md" ? "w-3 h-3" : "w-2.5 h-2.5";
  return <span className={`inline-block ${sizeClass} rounded-full shadow-lg ${colors[status]} animate-pulse`} />;
}

function ProgressBar({ value, max = 100, color = "emerald", animated = false }: { value: number; max?: number; color?: string; animated?: boolean }) {
  const percent = Math.min((value / max) * 100, 100);
  const colorMap: Record<string, string> = {
    emerald: "from-emerald-500 to-emerald-400",
    amber: "from-amber-500 to-amber-400",
    red: "from-red-500 to-red-400",
    blue: "from-blue-500 to-blue-400",
    purple: "from-purple-500 to-purple-400",
    cyan: "from-cyan-500 to-cyan-400",
  };
  const barColor = percent > 90 ? "from-red-500 to-red-400" : percent > 70 ? "from-amber-500 to-amber-400" : (colorMap[color] || colorMap.emerald);
  return (
    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
      <div
        className={`h-full bg-gradient-to-r ${barColor} rounded-full transition-all duration-1000 ease-out ${animated ? "animate-pulse" : ""}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

function getHealthStatus(value: number): "green" | "orange" | "red" {
  if (value > 90) return "red";
  if (value > 70) return "orange";
  return "green";
}

function RadialGauge({ value, label, icon: Icon, color, detail }: { value: number; label: string; icon: any; color: string; detail?: string }) {
  const status = getHealthStatus(value);
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (value / 100) * circumference;
  const strokeColor = status === "red" ? "#ef4444" : status === "orange" ? "#f59e0b" : color;
  return (
    <div className="flex flex-col items-center gap-2 p-3" data-testid={`gauge-${label.toLowerCase()}`}>
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r="40" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/30" />
          <circle cx="48" cy="48" r="40" fill="none" stroke={strokeColor} strokeWidth="6" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className="transition-all duration-1000 ease-out" style={{ filter: `drop-shadow(0 0 6px ${strokeColor}40)` }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold tabular-nums">{value}%</span>
        </div>
      </div>
      <div className="text-center">
        <div className="flex items-center gap-1.5 justify-center">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
        </div>
        {detail && <p className="text-[10px] text-muted-foreground mt-0.5 max-w-[120px] truncate">{detail}</p>}
      </div>
    </div>
  );
}

function ServiceBadge({ name, status }: { name: string; status: string }) {
  const isActive = status === "active" || status === "online";
  return (
    <div className="flex items-center justify-between py-2.5 px-4 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors">
      <span className="text-sm font-medium">{name}</span>
      <Badge variant={isActive ? "default" : "destructive"} className={isActive ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/25 hover:bg-emerald-500/15" : ""} data-testid={`status-badge-${name.toLowerCase().replace(/\s+/g, "-")}`}>
        <StatusDot status={isActive ? "green" : "red"} />
        <span className="ml-1.5">{status}</span>
      </Badge>
    </div>
  );
}

export default function SystemMonitoring() {
  const { toast } = useToast();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [refreshCountdown, setRefreshCountdown] = useState(20);
  const [deployLogExpanded, setDeployLogExpanded] = useState(false);
  const [liveDeployStatus, setLiveDeployStatus] = useState<DeploymentStatus | null>(null);
  const [sseStepUpdates, setSseStepUpdates] = useState<Record<number, { status: string; output?: string }>>({});
  const [isPollingDeploy, setIsPollingDeploy] = useState(false);
  const [showDetails, setShowDetails] = useState(true);
  const eventSourceRef = useRef<EventSource | null>(null);

  const { data, isLoading, isRefetching, refetch } = useQuery<SystemHealthData>({
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
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/platform/system-health/deploy");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Deployment Started", description: "Pipeline is now running. Watch the progress below." });
      setIsPollingDeploy(true);
      queryClient.invalidateQueries({ queryKey: ["/api/platform/system-health"] });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/system-health/deploy/status"] });
    },
    onError: (err: any) => {
      toast({ title: "Deployment Failed", description: err.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    const url = `/api/platform/system-health/events`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.addEventListener("deploy-start", (e) => {
      const d = JSON.parse(e.data);
      setLiveDeployStatus(d);
      setSseStepUpdates({});
      setIsPollingDeploy(true);
    });

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
      if (d.status === "success") {
        toast({ title: "Deployment Successful", description: "All pipeline steps completed." });
      } else {
        toast({ title: "Deployment Failed", description: "Check deployment logs for details.", variant: "destructive" });
      }
    });

    return () => { es.close(); };
  }, []);

  useEffect(() => {
    if (data?.timestamp) setLastRefreshTime(new Date(data.timestamp));
  }, [data?.timestamp]);

  useEffect(() => {
    if (!autoRefresh) return;
    setRefreshCountdown(20);
    const interval = setInterval(() => setRefreshCountdown(prev => (prev <= 1 ? 20 : prev - 1)), 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, data?.timestamp]);

  const polledDeploy = deployStatusData?.deployment;
  const deployStatus = (isPollingDeploy && polledDeploy) ? polledDeploy : liveDeployStatus || polledDeploy || data?.deployment?.status || { status: "idle", step: 0, totalSteps: 5, currentStep: "", log: [], startedAt: null, completedAt: null, triggeredBy: null };
  const isDeploying = deployStatus.status === "running";

  useEffect(() => {
    if (isPollingDeploy && polledDeploy && polledDeploy.status !== "running") {
      setIsPollingDeploy(false);
      if (polledDeploy.status === "success") {
        queryClient.invalidateQueries({ queryKey: ["/api/platform/system-health"] });
        refetchLogs();
      }
    }
  }, [polledDeploy?.status, isPollingDeploy]);

  const isConnected = data?.connected ?? false;
  const hasAlerts = !isConnected ||
    (data?.resources?.cpu?.usagePercent ?? 0) > 90 ||
    (data?.resources?.memory?.usagePercent ?? 0) > 90 ||
    (data?.resources?.disk?.usagePercent ?? 0) > 90 ||
    (data?.services && data.services.nginx !== "active") ||
    (data?.services && data.services.postgresql !== "active") ||
    (pingData !== undefined && !pingData?.reachable);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="loading-system-monitor">
        <div className="text-center space-y-4">
          <div className="relative mx-auto w-20 h-20">
            <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
            <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            <MonitorCheck className="absolute inset-0 m-auto h-8 w-8 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-lg">Connecting to Infrastructure</p>
            <p className="text-sm text-muted-foreground">Reading system metrics...</p>
          </div>
        </div>
      </div>
    );
  }

  const overallStatus: "live" | "issues" | "offline" = !isConnected
    ? "offline"
    : hasAlerts
      ? "issues"
      : "live";

  const issuesList: string[] = [];
  if (isConnected) {
    if ((data?.resources?.cpu?.usagePercent ?? 0) > 90) issuesList.push("CPU usage critical");
    if ((data?.resources?.memory?.usagePercent ?? 0) > 90) issuesList.push("Memory usage critical");
    if ((data?.resources?.disk?.usagePercent ?? 0) > 90) issuesList.push("Disk usage critical");
    if (data?.services && data.services.nginx !== "active") issuesList.push("Nginx not active");
    if (data?.services && data.services.postgresql !== "active") issuesList.push("PostgreSQL not active");
    if (pingData !== undefined && !pingData.reachable) issuesList.push("App health check failed");
  }

  const heroGradients = {
    live: "from-emerald-600 via-emerald-500 to-teal-400",
    issues: "from-amber-600 via-orange-500 to-yellow-400",
    offline: "from-red-600 via-red-500 to-rose-400",
  };

  const heroGlow = {
    live: "shadow-[0_0_60px_-10px_rgba(16,185,129,0.4)]",
    issues: "shadow-[0_0_60px_-10px_rgba(245,158,11,0.4)]",
    offline: "shadow-[0_0_60px_-10px_rgba(239,68,68,0.4)]",
  };

  const heroIcons = { live: CheckCircle2, issues: AlertTriangle, offline: WifiOff };
  const HeroIcon = heroIcons[overallStatus];

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1600px] mx-auto" data-testid="system-monitoring-page">

      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${heroGradients[overallStatus]} ${heroGlow[overallStatus]} transition-all duration-700`} data-testid="system-status-hero">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />

        <div className="relative z-10 p-6 md:p-8">
          <div className="flex flex-col lg:flex-row items-center gap-6">
            <div className="flex items-center gap-5 flex-1">
              <div className="relative flex-shrink-0">
                <div className="h-20 w-20 md:h-24 md:w-24 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20">
                  <HeroIcon className="h-10 w-10 md:h-12 md:w-12 text-white drop-shadow-lg" />
                </div>
                <span className={`absolute -top-1 -right-1 h-5 w-5 rounded-full border-2 border-white/30 animate-pulse ${overallStatus === "live" ? "bg-white" : overallStatus === "issues" ? "bg-yellow-300" : "bg-red-300"}`} />
              </div>

              <div className="text-white">
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-2xl md:text-3xl font-bold drop-shadow-sm" data-testid="text-overall-status">
                    {overallStatus === "live" ? "All Systems Live" : overallStatus === "issues" ? "Issues Detected" : "System Offline"}
                  </h2>
                </div>
                <p className="text-white/80 text-sm md:text-base">
                  {overallStatus === "live"
                    ? "Production environment is healthy and responding normally."
                    : overallStatus === "issues"
                      ? `${issuesList.length} issue${issuesList.length !== 1 ? "s" : ""} detected — review details below.`
                      : (data?.error || "Unable to reach VPS. Check connectivity or SSH configuration.")}
                </p>

                {overallStatus === "issues" && issuesList.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2" data-testid="hero-issues-list">
                    {issuesList.map((issue, i) => (
                      <span key={i} className="inline-flex items-center gap-1 bg-white/20 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-full border border-white/20" data-testid={`badge-issue-${i}`}>
                        <AlertTriangle className="h-3 w-3" /> {issue}
                      </span>
                    ))}
                  </div>
                )}

                {isConnected && (
                  <div className="flex flex-wrap items-center gap-3 mt-3 text-white/70 text-xs md:text-sm" data-testid="hero-metrics">
                    {data?.server?.uptime && <span className="flex items-center gap-1" data-testid="metric-uptime"><Timer className="h-3.5 w-3.5" /> {data.server.uptime}</span>}
                    {data?.resources?.cpu && <span className="flex items-center gap-1" data-testid="metric-cpu"><Cpu className="h-3.5 w-3.5" /> CPU {data.resources.cpu.usagePercent}%</span>}
                    {data?.resources?.memory && <span className="flex items-center gap-1" data-testid="metric-ram"><MemoryStick className="h-3.5 w-3.5" /> RAM {data.resources.memory.usagePercent}%</span>}
                    {data?.resources?.disk && <span className="flex items-center gap-1" data-testid="metric-disk"><HardDrive className="h-3.5 w-3.5" /> Disk {data.resources.disk.usagePercent}%</span>}
                    {pingData?.reachable && <span className="flex items-center gap-1" data-testid="metric-ping"><Activity className="h-3.5 w-3.5" /> {pingData.responseTime}ms</span>}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col items-center gap-3 flex-shrink-0">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Badge className="bg-white/15 text-white border-white/20 hover:bg-white/20 backdrop-blur-sm gap-1.5" data-testid="badge-environment">
                  <CircleDot className="h-3 w-3" /> Production
                </Badge>
                <Badge className="bg-white/15 text-white border-white/20 hover:bg-white/20 backdrop-blur-sm gap-1.5" data-testid="badge-provider">
                  <Server className="h-3 w-3" /> Hostinger VPS
                </Badge>
                {data?.mode && data.mode !== "none" && (
                  <Badge className="bg-white/15 text-white border-white/20 hover:bg-white/20 backdrop-blur-sm gap-1.5" data-testid="badge-mode">
                    {data.mode === "local" ? <MonitorCheck className="h-3 w-3" /> : <Terminal className="h-3 w-3" />}
                    {data.mode === "local" ? "Local" : "SSH"}
                  </Badge>
                )}
              </div>

              {data?.server?.ip && (
                <Badge className="bg-white/10 text-white/80 border-white/15 font-mono text-xs backdrop-blur-sm" data-testid="badge-ip">
                  <Globe className="h-3 w-3 mr-1" /> {data.server.ip}
                </Badge>
              )}

              {data?.git?.branch && data.git.branch !== "unknown" && (
                <Badge className="bg-white/10 text-white/80 border-white/15 text-xs backdrop-blur-sm" data-testid="badge-branch">
                  <GitBranch className="h-3 w-3 mr-1" /> {data.git.branch}
                  {data.git.commit && data.git.commit !== "N/A" && <span className="font-mono ml-1 opacity-70">({data.git.commit})</span>}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 mt-5 pt-5 border-t border-white/15">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={() => refetch()}
                disabled={isRefetching}
                className="bg-white/15 hover:bg-white/25 text-white border-white/20 backdrop-blur-sm shadow-lg"
                variant="outline"
                data-testid="btn-refresh"
              >
                <RefreshCw className={`h-4 w-4 mr-1.5 ${isRefetching ? "animate-spin" : ""}`} />
                {isRefetching ? "Refreshing..." : "Refresh Now"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`backdrop-blur-sm shadow-lg border-white/20 ${autoRefresh ? "bg-white/25 text-white hover:bg-white/30" : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"}`}
                data-testid="btn-auto-refresh"
              >
                <Radio className={`h-4 w-4 mr-1.5 ${autoRefresh ? "animate-pulse" : ""}`} />
                {autoRefresh ? `Auto (${refreshCountdown}s)` : "Auto Off"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowDetails(!showDetails)}
                className="bg-white/15 hover:bg-white/25 text-white border-white/20 backdrop-blur-sm shadow-lg"
                data-testid="btn-toggle-details"
              >
                <Eye className="h-4 w-4 mr-1.5" />
                {showDetails ? "Hide Details" : "Show Details"}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    disabled={isDeploying || !isConnected}
                    className={`shadow-lg font-semibold gap-1.5 ${isDeploying ? "bg-blue-500 hover:bg-blue-600 text-white" : "bg-white text-gray-900 hover:bg-white/90"}`}
                    data-testid="btn-deploy"
                  >
                    {isDeploying ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                    {isDeploying ? "Deploying..." : "Deploy to Production"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Trigger Production Deployment?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will pull the latest code from GitHub, install dependencies, build the app, run database migrations, and restart PM2 services on the production VPS. This action may cause brief downtime.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel data-testid="btn-deploy-cancel">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deployMutation.mutate()} data-testid="btn-deploy-confirm">
                      <Rocket className="h-4 w-4 mr-2" /> Deploy Now
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </div>

      {isConnected && data?.resources && (
        <div className="grid grid-cols-3 gap-4 justify-items-center" data-testid="resource-gauges">
          <Card className="w-full flex justify-center bg-gradient-to-br from-violet-500/5 via-transparent to-transparent border-violet-500/15 hover:shadow-lg hover:shadow-violet-500/5 transition-all">
            <RadialGauge value={data.resources.cpu.usagePercent} label="CPU" icon={Cpu} color="#8b5cf6" detail={`${data.resources.cpu.cores} core(s)`} />
          </Card>
          <Card className="w-full flex justify-center bg-gradient-to-br from-cyan-500/5 via-transparent to-transparent border-cyan-500/15 hover:shadow-lg hover:shadow-cyan-500/5 transition-all">
            <RadialGauge value={data.resources.memory.usagePercent} label="Memory" icon={MemoryStick} color="#06b6d4" detail={`${data.resources.memory.used} / ${data.resources.memory.total}`} />
          </Card>
          <Card className="w-full flex justify-center bg-gradient-to-br from-amber-500/5 via-transparent to-transparent border-amber-500/15 hover:shadow-lg hover:shadow-amber-500/5 transition-all">
            <RadialGauge value={data.resources.disk.usagePercent} label="Disk" icon={HardDrive} color="#f59e0b" detail={`${data.resources.disk.used} / ${data.resources.disk.total}`} />
          </Card>
        </div>
      )}

      <Card className="overflow-hidden border-primary/20" data-testid="card-deployment-pipeline">
        <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 via-transparent to-transparent">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2.5 text-base">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-md shadow-primary/20">
                <Rocket className="h-4.5 w-4.5 text-white" />
              </div>
              <div>
                <span>Deployment Pipeline</span>
                {isDeploying && <RefreshCw className="h-3.5 w-3.5 ml-2 inline animate-spin text-primary" />}
              </div>
            </CardTitle>
            {deployStatus.triggeredBy && deployStatus.startedAt && (
              <span className="text-xs text-muted-foreground">
                {deployStatus.triggeredBy} — {new Date(deployStatus.startedAt).toLocaleString()}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="space-y-4">
            {isDeploying && (
              <div className="mb-2">
                <ProgressBar value={(deployStatus.step / deployStatus.totalSteps) * 100} color="blue" animated />
                <p className="text-xs text-muted-foreground mt-1.5 text-center font-medium">
                  Step {deployStatus.step} of {deployStatus.totalSteps} — {deployStatus.currentStep}
                </p>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              {PIPELINE_STEPS.map((step, i) => {
                const stepNum = i + 1;
                const sseUpdate = sseStepUpdates[stepNum];
                let stepState: "pending" | "running" | "success" | "failed" = "pending";

                if (isDeploying) {
                  if (stepNum < deployStatus.step) stepState = "success";
                  else if (stepNum === deployStatus.step) stepState = sseUpdate?.status === "success" ? "success" : sseUpdate?.status === "failed" ? "failed" : "running";
                } else if (deployStatus.status === "success") {
                  stepState = "success";
                } else if (deployStatus.status === "failed") {
                  stepState = stepNum <= deployStatus.step ? (stepNum === deployStatus.step ? "failed" : "success") : "pending";
                }
                if (sseUpdate?.status === "success") stepState = "success";
                if (sseUpdate?.status === "failed") stepState = "failed";

                const StepIcon = step.icon;
                const styles = {
                  pending: { border: "border-border", bg: "bg-card", iconBg: "bg-muted", iconColor: "text-muted-foreground" },
                  running: { border: "border-blue-500/50 shadow-blue-500/10 shadow-md", bg: "bg-blue-500/5", iconBg: "", iconColor: "text-blue-500" },
                  success: { border: "border-emerald-500/50", bg: "bg-emerald-500/5", iconBg: "bg-emerald-500/15", iconColor: "text-emerald-500" },
                  failed: { border: "border-red-500/50", bg: "bg-red-500/5", iconBg: "bg-red-500/15", iconColor: "text-red-500" },
                };
                const s = styles[stepState];

                return (
                  <div key={step.id} className={`rounded-xl border-2 ${s.border} ${s.bg} p-4 text-center space-y-2 transition-all duration-500`} data-testid={`pipeline-step-${step.id}`}>
                    <div className="flex items-center justify-center">
                      {stepState === "running" ? (
                        <div className="relative h-10 w-10">
                          <div className="absolute inset-0 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                          <StepIcon className="absolute inset-0 m-auto h-5 w-5 text-blue-500" />
                        </div>
                      ) : (
                        <div className={`h-10 w-10 rounded-full ${s.iconBg} flex items-center justify-center`}>
                          {stepState === "success" ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> :
                           stepState === "failed" ? <XCircle className="h-5 w-5 text-red-500" /> :
                           <StepIcon className={`h-5 w-5 ${s.iconColor}`} />}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-semibold leading-tight">{step.label}</p>
                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{step.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            {(deployStatus.log.length > 0 || (deployLogData?.logs && deployLogData.logs.length > 0)) && (
              <div className="mt-2">
                <button
                  onClick={() => { setDeployLogExpanded(!deployLogExpanded); if (!deployLogExpanded) refetchLogs(); }}
                  className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-lg hover:bg-muted/50"
                  data-testid="btn-toggle-deploy-logs"
                >
                  <Terminal className="h-3.5 w-3.5" />
                  Deployment Logs
                  {deployLogExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
                {deployLogExpanded && (
                  <div className="mt-2 bg-gray-950 rounded-xl p-4 max-h-60 overflow-y-auto border border-gray-800">
                    <pre className="text-[11px] font-mono text-emerald-400 whitespace-pre-wrap leading-relaxed">
                      {deployStatus.log.length > 0 ? deployStatus.log.join("\n") : ""}
                      {deployLogData?.logs ? "\n" + deployLogData.logs : ""}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {showDetails && (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3" data-testid="health-checks-grid">
            <HealthCheckCard label="HTTP Response" status={pingData?.reachable ? "pass" : "fail"} detail={pingData?.reachable ? `Status ${pingData.httpStatus}` : (pingData?.error || "Unreachable")} icon={Globe} />
            <HealthCheckCard label="API Ping" status={pingData?.reachable ? "pass" : "fail"} detail={pingData?.reachable ? `${pingData.responseTime}ms response` : "Timeout"} icon={Activity} />
            <HealthCheckCard label="Database" status={data?.services?.postgresql === "active" ? "pass" : "fail"} detail={data?.services?.postgresql === "active" ? "PostgreSQL active" : "PostgreSQL " + (data?.services?.postgresql || "unknown")} icon={Database} />
            <HealthCheckCard label="Web Server" status={data?.services?.nginx === "active" ? "pass" : "fail"} detail={data?.services?.nginx === "active" ? "Nginx running" : "Nginx " + (data?.services?.nginx || "unknown")} icon={Server} />
          </div>

          <div className="grid lg:grid-cols-3 gap-5">
            <Card className="overflow-hidden hover:shadow-lg transition-shadow" data-testid="card-repository">
              <CardHeader className="pb-3 bg-gradient-to-r from-purple-500/8 via-transparent to-transparent">
                <CardTitle className="flex items-center gap-2.5 text-base">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-md shadow-purple-500/20">
                    <GitBranch className="h-4 w-4 text-white" />
                  </div>
                  Source Repository
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                {data?.git ? (
                  <>
                    <InfoRow label="Remote" value={data.git.remote} mono />
                    <InfoRow label="Branch" value={data.git.branch} badge />
                    <InfoRow label="Commit" value={data.git.commit} mono />
                    <InfoRow label="Message" value={data.git.message} />
                    <InfoRow label="Author" value={data.git.author} />
                    <InfoRow label="Date" value={data.git.date ? new Date(data.git.date).toLocaleString() : "N/A"} />
                    <div className="flex items-center gap-2 pt-2 border-t">
                      <StatusDot status={data.git.isDirty ? "orange" : "green"} />
                      <span className="text-xs">{data.git.isDirty ? "Uncommitted changes" : "Working tree clean"}</span>
                    </div>
                  </>
                ) : <EmptyState text="Repository data unavailable" />}
              </CardContent>
            </Card>

            <Card className="overflow-hidden hover:shadow-lg transition-shadow" data-testid="card-server-health">
              <CardHeader className="pb-3 bg-gradient-to-r from-blue-500/8 via-transparent to-transparent">
                <CardTitle className="flex items-center gap-2.5 text-base">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20">
                    <Server className="h-4 w-4 text-white" />
                  </div>
                  Server Infrastructure
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                {data?.resources ? (
                  <>
                    <MetricBar label="CPU" value={data.resources.cpu.usagePercent} icon={Cpu} detail={`${data.resources.cpu.cores} core(s) — Load: ${data.server?.loadAverage || "N/A"}`} />
                    <MetricBar label="Memory" value={data.resources.memory.usagePercent} icon={MemoryStick} detail={`${data.resources.memory.used} / ${data.resources.memory.total}`} />
                    <MetricBar label="Disk" value={data.resources.disk.usagePercent} icon={HardDrive} detail={`${data.resources.disk.used} / ${data.resources.disk.total} (${data.resources.disk.mountPoint})`} />
                    <div className="grid grid-cols-2 gap-2 pt-3 border-t">
                      <InfoRow label="OS" value={data.server?.os || "N/A"} compact />
                      <InfoRow label="Kernel" value={data.server?.kernel || "N/A"} compact />
                      <InfoRow label="Hostname" value={data.server?.hostname || "N/A"} compact />
                      <InfoRow label="Users" value={data.server?.users || "0"} compact />
                    </div>
                  </>
                ) : <EmptyState text="Server metrics unavailable" />}
              </CardContent>
            </Card>

            <Card className="overflow-hidden hover:shadow-lg transition-shadow" data-testid="card-application">
              <CardHeader className="pb-3 bg-gradient-to-r from-emerald-500/8 via-transparent to-transparent">
                <CardTitle className="flex items-center gap-2.5 text-base">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-md shadow-emerald-500/20">
                    <Container className="h-4 w-4 text-white" />
                  </div>
                  Application Runtime
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                {data?.application?.pm2Processes && data.application.pm2Processes.length > 0 ? (
                  <>
                    {data.application.pm2Processes.map((proc, i) => (
                      <div key={i} className="rounded-xl border p-3 space-y-2 hover:bg-muted/30 transition-colors" data-testid={`pm2-process-${proc.name}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <StatusDot status={proc.status === "online" ? "green" : proc.status === "stopped" ? "red" : "orange"} />
                            <span className="font-medium text-sm">{proc.name}</span>
                          </div>
                          <Badge variant="outline" className="text-xs">PID: {proc.pid}</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-1 text-xs">
                          <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className={proc.status === "online" ? "text-emerald-600 font-medium" : "text-red-600 font-medium"}>{proc.status}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">CPU</span><span>{proc.cpu}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Memory</span><span>{proc.memory}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Uptime</span><span>{proc.uptime}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Restarts</span><span className={proc.restarts > 5 ? "text-amber-600 font-medium" : ""}>{proc.restarts}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Mode</span><span>{proc.mode}</span></div>
                        </div>
                      </div>
                    ))}
                    <div className="border-t pt-2 grid grid-cols-2 gap-2">
                      <InfoRow label="Node.js" value={data.application.nodeVersion} compact />
                      <InfoRow label="NPM" value={data.application.npmVersion} compact />
                    </div>
                  </>
                ) : data?.application?.dockerContainers && data.application.dockerContainers.length > 0 ? (
                  <>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Docker Containers</p>
                    {data.application.dockerContainers.map((c, i) => {
                      const isUp = c.status.toLowerCase().includes("up");
                      return (
                        <div key={i} className="rounded-xl border p-3 space-y-1 hover:bg-muted/30 transition-colors" data-testid={`docker-container-${c.name}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <StatusDot status={isUp ? "green" : "red"} />
                              <span className="font-medium text-sm">{c.name}</span>
                            </div>
                            <Badge variant={isUp ? "default" : "destructive"} className={isUp ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/25 hover:bg-emerald-500/15" : ""}>
                              {isUp ? "Running" : "Stopped"}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">{c.status}</div>
                          {c.ports && <div className="text-[10px] font-mono text-muted-foreground truncate" title={c.ports}>{c.ports}</div>}
                        </div>
                      );
                    })}
                    <div className="border-t pt-2 grid grid-cols-2 gap-2">
                      <InfoRow label="Node.js" value={data.application.nodeVersion} compact />
                      <InfoRow label="NPM" value={data.application.npmVersion} compact />
                    </div>
                  </>
                ) : <EmptyState text="No PM2 processes or Docker containers detected" />}
              </CardContent>
            </Card>
          </div>

          <div className="grid lg:grid-cols-3 gap-5">
            <Card className="overflow-hidden hover:shadow-lg transition-shadow" data-testid="card-services">
              <CardHeader className="pb-3 bg-gradient-to-r from-cyan-500/8 via-transparent to-transparent">
                <CardTitle className="flex items-center gap-2.5 text-base">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center shadow-md shadow-cyan-500/20">
                    <Layers className="h-4 w-4 text-white" />
                  </div>
                  Core Services
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-4">
                <ServiceBadge name="Nginx" status={data?.services?.nginx || "unknown"} />
                <ServiceBadge name="PostgreSQL" status={data?.services?.postgresql || "unknown"} />
                {data?.application?.pm2Processes?.map((proc, i) => (
                  <ServiceBadge key={i} name={`PM2: ${proc.name}`} status={proc.status} />
                ))}
                {data?.application?.dockerContainers?.map((c, i) => (
                  <ServiceBadge key={`docker-${i}`} name={`Docker: ${c.name}`} status={c.status.toLowerCase().includes("up") ? "active" : "stopped"} />
                ))}
              </CardContent>
            </Card>

            <Card className="overflow-hidden hover:shadow-lg transition-shadow" data-testid="card-security">
              <CardHeader className="pb-3 bg-gradient-to-r from-red-500/8 via-transparent to-transparent">
                <CardTitle className="flex items-center gap-2.5 text-base">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-md shadow-red-500/20">
                    <Shield className="h-4 w-4 text-white" />
                  </div>
                  Security & Connectivity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                <div className="flex items-center justify-between py-2.5 px-4 rounded-xl bg-muted/40">
                  <span className="text-sm font-medium">Connection</span>
                  <Badge variant="outline" className={isConnected ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/25" : "bg-red-500/15 text-red-600 border-red-500/25"}>
                    <StatusDot status={isConnected ? "green" : "red"} /><span className="ml-1.5">{isConnected ? (data?.mode === "local" ? "Local" : "SSH") : "Disconnected"}</span>
                  </Badge>
                </div>
                <div className="flex items-center justify-between py-2.5 px-4 rounded-xl bg-muted/40">
                  <span className="text-sm font-medium">SSL Certificate</span>
                  <Badge variant="outline" className={data?.security?.ssl?.includes("Active") ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/25" : "bg-amber-500/15 text-amber-600 border-amber-500/25"}>
                    <Lock className="h-3 w-3 mr-1" />{data?.security?.ssl || "Unknown"}
                  </Badge>
                </div>
                {data?.security?.firewall && data.security.firewall.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Firewall Rules</p>
                    <div className="bg-muted/30 rounded-xl p-3 max-h-32 overflow-y-auto">
                      <pre className="text-[10px] font-mono text-muted-foreground whitespace-pre-wrap">{data.security.firewall.join("\n")}</pre>
                    </div>
                  </div>
                )}
                {data?.security?.openPorts && data.security.openPorts.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Open Ports</p>
                    <div className="flex flex-wrap gap-1">
                      {data.security.openPorts.slice(0, 12).map((port, i) => (
                        <Badge key={i} variant="outline" className="text-[10px] font-mono">{port.address}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="overflow-hidden hover:shadow-lg transition-shadow" data-testid="card-deployment">
              <CardHeader className="pb-3 bg-gradient-to-r from-amber-500/8 via-transparent to-transparent">
                <CardTitle className="flex items-center gap-2.5 text-base">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-md shadow-amber-500/20">
                    <Zap className="h-4 w-4 text-white" />
                  </div>
                  Continuous Deployment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                {data?.deployment ? (
                  <>
                    <InfoRow label="Last Git Fetch" value={data.deployment.lastFetch} />
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cron Schedule</p>
                      <div className="bg-muted/30 rounded-xl p-3">
                        <pre className="text-[10px] font-mono text-muted-foreground whitespace-pre-wrap">{data.deployment.cronJobs || "No cron jobs"}</pre>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent Pull Log</p>
                      <div className="bg-muted/30 rounded-xl p-3 max-h-40 overflow-y-auto">
                        <pre className="text-[10px] font-mono text-muted-foreground whitespace-pre-wrap">{data.deployment.pullLog || "No pull log"}</pre>
                      </div>
                    </div>
                  </>
                ) : <EmptyState text="Deployment data unavailable" />}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-4">
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5" />
          Last updated: {lastRefreshTime ? lastRefreshTime.toLocaleString() : "N/A"}
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1"><StatusDot status="green" /> Healthy</span>
          <span className="flex items-center gap-1"><StatusDot status="orange" /> Warning</span>
          <span className="flex items-center gap-1"><StatusDot status="red" /> Critical</span>
        </div>
      </div>
    </div>
  );
}

function MetricBar({ label, value, icon: Icon, detail }: { label: string; value: number; icon: any; detail?: string }) {
  const status = getHealthStatus(value);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <StatusDot status={status} />
          <span className="text-lg font-bold tabular-nums">{value}%</span>
        </div>
      </div>
      <ProgressBar value={value} />
      {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

function HealthCheckCard({ label, status, detail, icon: Icon }: { label: string; status: "pass" | "fail" | "warn"; detail: string; icon: any }) {
  const configs = {
    pass: { color: "text-emerald-500", bg: "bg-gradient-to-br from-emerald-500/10 to-transparent border-emerald-500/25", iconBg: "bg-emerald-500/15" },
    fail: { color: "text-red-500", bg: "bg-gradient-to-br from-red-500/10 to-transparent border-red-500/25", iconBg: "bg-red-500/15" },
    warn: { color: "text-amber-500", bg: "bg-gradient-to-br from-amber-500/10 to-transparent border-amber-500/25", iconBg: "bg-amber-500/15" },
  };
  const config = configs[status];
  const StatusIcn = status === "pass" ? CheckCircle2 : status === "fail" ? XCircle : AlertTriangle;
  return (
    <div className={`rounded-xl border-2 ${config.bg} p-4 flex items-center gap-3 transition-all hover:shadow-lg hover:scale-[1.01] duration-200`} data-testid={`health-check-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className={`h-10 w-10 rounded-xl ${config.iconBg} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`h-5 w-5 ${config.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold">{label}</p>
          <StatusIcn className={`h-3.5 w-3.5 ${config.color}`} />
        </div>
        <p className="text-xs text-muted-foreground truncate">{detail}</p>
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono, badge, compact }: { label: string; value: string; mono?: boolean; badge?: boolean; compact?: boolean }) {
  return (
    <div className={`flex items-start justify-between gap-2 ${compact ? "text-xs" : "text-sm"}`}>
      <span className="text-muted-foreground whitespace-nowrap">{label}</span>
      {badge ? (
        <Badge variant="outline" className="text-xs">{value}</Badge>
      ) : (
        <span className={`text-right truncate max-w-[200px] ${mono ? "font-mono text-xs" : ""}`} title={value}>{value}</span>
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <WifiOff className="h-8 w-8 text-muted-foreground/30 mb-2" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
