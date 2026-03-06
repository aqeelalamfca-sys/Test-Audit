import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import {
  Server, Cpu, HardDrive, MemoryStick, GitBranch,
  Activity, Shield, Globe, RefreshCw, Clock, CheckCircle2,
  XCircle, AlertTriangle, WifiOff, Terminal,
  Lock, Zap, MonitorCheck, Container, Layers,
  Timer, CircleDot, Radio, Rocket, Play,
  ChevronDown, ChevronUp,
  Package, Database, RotateCcw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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

function MetricGauge({ label, value, unit, icon: Icon, detail }: { label: string; value: number; unit: string; icon: any; detail?: string }) {
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
          <span className="text-lg font-bold tabular-nums">{value}{unit}</span>
        </div>
      </div>
      <ProgressBar value={value} />
      {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

function ServiceBadge({ name, status }: { name: string; status: string }) {
  const isActive = status === "active" || status === "online";
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
      <span className="text-sm font-medium">{name}</span>
      <Badge variant={isActive ? "default" : "destructive"} className={isActive ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/10" : ""} data-testid={`status-badge-${name.toLowerCase().replace(/\s+/g, "-")}`}>
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
    const protocol = window.location.protocol === "https:" ? "https:" : "http:";
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
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
    data?.services?.nginx !== "active" ||
    data?.services?.postgresql !== "active";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="loading-system-monitor">
        <div className="text-center space-y-4">
          <div className="relative mx-auto w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
            <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            <MonitorCheck className="absolute inset-0 m-auto h-6 w-6 text-primary" />
          </div>
          <p className="text-muted-foreground">Connecting to VPS infrastructure...</p>
        </div>
      </div>
    );
  }

  const overallStatus: "live" | "issues" | "offline" = !isConnected
    ? "offline"
    : hasAlerts
      ? "issues"
      : "live";

  const statusConfig = {
    live: {
      label: "All Systems Operational",
      sublabel: "Live",
      icon: CheckCircle2,
      gradient: "from-emerald-500 to-emerald-600",
      glow: "shadow-emerald-500/30",
      border: "border-emerald-500/40",
      bg: "bg-gradient-to-r from-emerald-500/8 via-emerald-500/3 to-transparent",
      dotColor: "bg-emerald-400",
      textColor: "text-emerald-600 dark:text-emerald-400",
    },
    issues: {
      label: "Attention Required",
      sublabel: "Issues Detected",
      icon: AlertTriangle,
      gradient: "from-amber-500 to-orange-500",
      glow: "shadow-amber-500/30",
      border: "border-amber-500/40",
      bg: "bg-gradient-to-r from-amber-500/8 via-amber-500/3 to-transparent",
      dotColor: "bg-amber-400",
      textColor: "text-amber-600 dark:text-amber-400",
    },
    offline: {
      label: "System Offline",
      sublabel: "Disconnected",
      icon: WifiOff,
      gradient: "from-red-500 to-red-600",
      glow: "shadow-red-500/30",
      border: "border-red-500/40",
      bg: "bg-gradient-to-r from-red-500/8 via-red-500/3 to-transparent",
      dotColor: "bg-red-400",
      textColor: "text-red-600 dark:text-red-400",
    },
  };

  const sc = statusConfig[overallStatus];
  const StatusIcon = sc.icon;

  const issuesList: string[] = [];
  if (isConnected) {
    if ((data?.resources?.cpu?.usagePercent ?? 0) > 90) issuesList.push("CPU usage critical");
    if ((data?.resources?.memory?.usagePercent ?? 0) > 90) issuesList.push("Memory usage critical");
    if ((data?.resources?.disk?.usagePercent ?? 0) > 90) issuesList.push("Disk usage critical");
    if (data?.services?.nginx !== "active") issuesList.push("Nginx not active");
    if (data?.services?.postgresql !== "active") issuesList.push("PostgreSQL not active");
    if (pingData && !pingData.reachable) issuesList.push("App health check failed");
  }

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto" data-testid="system-monitoring-page">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary via-primary/80 to-primary/50 flex items-center justify-center shadow-lg shadow-primary/20">
              <MonitorCheck className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight" data-testid="page-title">Enterprise-Grade Checklist</h1>
              <p className="text-sm text-muted-foreground">AuditWise Deployment Monitor — Operational Control Center</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-1.5 py-1 bg-gradient-to-r from-emerald-500/5 to-transparent border-emerald-500/30" data-testid="badge-environment">
            <CircleDot className="h-3 w-3 text-emerald-500" /> Production
          </Badge>
          <Badge variant="outline" className="gap-1.5 py-1" data-testid="badge-provider">
            <Server className="h-3 w-3" /> Hostinger VPS
          </Badge>
          {data?.mode && data.mode !== "none" && (
            <Badge variant="outline" className={`gap-1.5 py-1 ${data.mode === "local" ? "bg-blue-500/5 border-blue-500/30 text-blue-600" : "bg-purple-500/5 border-purple-500/30 text-purple-600"}`} data-testid="badge-mode">
              {data.mode === "local" ? <MonitorCheck className="h-3 w-3" /> : <Terminal className="h-3 w-3" />}
              {data.mode === "local" ? "Local" : "SSH"}
            </Badge>
          )}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching} data-testid="btn-refresh">
              <RefreshCw className={`h-4 w-4 mr-1.5 ${isRefetching ? "animate-spin" : ""}`} />
              {isRefetching ? "Refreshing..." : "Refresh"}
            </Button>
            <Button variant={autoRefresh ? "default" : "outline"} size="sm" onClick={() => setAutoRefresh(!autoRefresh)} data-testid="btn-auto-refresh">
              <Radio className={`h-4 w-4 mr-1.5 ${autoRefresh ? "animate-pulse" : ""}`} />
              {autoRefresh ? `Auto (${refreshCountdown}s)` : "Auto Off"}
            </Button>
          </div>
        </div>
      </div>

      <div className={`rounded-2xl border-2 ${sc.border} ${sc.bg} p-6 transition-all duration-500`} data-testid="system-status-hero">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className={`relative flex-shrink-0 h-24 w-24 rounded-2xl bg-gradient-to-br ${sc.gradient} flex items-center justify-center shadow-xl ${sc.glow}`}>
            <StatusIcon className="h-12 w-12 text-white" />
            <span className={`absolute -top-1 -right-1 h-5 w-5 rounded-full ${sc.dotColor} border-2 border-background animate-pulse`} />
          </div>

          <div className="flex-1 text-center md:text-left">
            <div className="flex flex-col md:flex-row md:items-center gap-2 mb-1">
              <h2 className={`text-2xl font-bold ${sc.textColor}`} data-testid="text-overall-status">{sc.sublabel}</h2>
              <span className="text-lg text-muted-foreground font-medium">— {sc.label}</span>
            </div>

            {overallStatus === "offline" && (
              <p className="text-sm text-muted-foreground mt-1">
                {data?.error || "Not connected. In production (NODE_ENV=production), metrics are read locally. Otherwise, set VPS_SSH_HOST to connect via SSH."}
              </p>
            )}

            {overallStatus === "issues" && issuesList.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {issuesList.map((issue, i) => (
                  <Badge key={i} variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-xs">
                    <AlertTriangle className="h-3 w-3 mr-1" /> {issue}
                  </Badge>
                ))}
              </div>
            )}

            {overallStatus === "live" && (
              <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                {data?.server?.uptime && <span className="flex items-center gap-1"><Timer className="h-3.5 w-3.5" /> Uptime: {data.server.uptime}</span>}
                {data?.resources?.cpu && <span className="flex items-center gap-1"><Cpu className="h-3.5 w-3.5" /> CPU: {data.resources.cpu.usagePercent}%</span>}
                {data?.resources?.memory && <span className="flex items-center gap-1"><MemoryStick className="h-3.5 w-3.5" /> RAM: {data.resources.memory.usagePercent}%</span>}
                {data?.resources?.disk && <span className="flex items-center gap-1"><HardDrive className="h-3.5 w-3.5" /> Disk: {data.resources.disk.usagePercent}%</span>}
                {pingData?.reachable && <span className="flex items-center gap-1"><Activity className="h-3.5 w-3.5" /> Ping: {pingData.responseTime}ms</span>}
              </div>
            )}

            {isConnected && overallStatus === "issues" && (
              <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                {data?.server?.uptime && <span className="flex items-center gap-1"><Timer className="h-3.5 w-3.5" /> Uptime: {data.server.uptime}</span>}
                {data?.resources?.cpu && <span className="flex items-center gap-1"><Cpu className="h-3.5 w-3.5" /> CPU: {data.resources.cpu.usagePercent}%</span>}
                {data?.resources?.memory && <span className="flex items-center gap-1"><MemoryStick className="h-3.5 w-3.5" /> RAM: {data.resources.memory.usagePercent}%</span>}
                {data?.resources?.disk && <span className="flex items-center gap-1"><HardDrive className="h-3.5 w-3.5" /> Disk: {data.resources.disk.usagePercent}%</span>}
              </div>
            )}
          </div>

          <div className="flex flex-col items-center gap-2 flex-shrink-0">
            {data?.server?.ip && (
              <Badge variant="outline" className="font-mono text-xs gap-1.5" data-testid="badge-ip">
                <Globe className="h-3 w-3" /> {data.server.ip}
              </Badge>
            )}
            {data?.git?.branch && data.git.branch !== "unknown" && (
              <Badge variant="outline" className="gap-1.5 text-xs" data-testid="badge-branch">
                <GitBranch className="h-3 w-3" /> {data.git.branch}
                {data.git.commit && data.git.commit !== "N/A" && <span className="font-mono ml-1 opacity-60">({data.git.commit})</span>}
              </Badge>
            )}
            {data?.server?.hostname && (
              <Badge variant="outline" className="text-xs gap-1.5" data-testid="badge-hostname">
                <Server className="h-3 w-3" /> {data.server.hostname}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-transparent to-transparent" data-testid="card-deployment-pipeline">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                <Rocket className="h-4 w-4 text-white" />
              </div>
              Deployment Pipeline
              {isDeploying && <RefreshCw className="h-3.5 w-3.5 ml-2 animate-spin text-primary" />}
            </CardTitle>
            <div className="flex items-center gap-2">
              {deployStatus.triggeredBy && deployStatus.startedAt && (
                <span className="text-xs text-muted-foreground">
                  {deployStatus.triggeredBy} — {new Date(deployStatus.startedAt).toLocaleString()}
                </span>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" disabled={isDeploying || !isConnected} className="gap-1.5 bg-gradient-to-r from-primary to-primary/80" data-testid="btn-deploy">
                    {isDeploying ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                    {isDeploying ? "Deploying..." : "Deploy Now"}
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
                      <Rocket className="h-4 w-4 mr-2" /> Deploy
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {isDeploying && (
              <div className="mb-4">
                <ProgressBar value={(deployStatus.step / deployStatus.totalSteps) * 100} color="blue" animated />
                <p className="text-xs text-muted-foreground mt-1 text-center">
                  Step {deployStatus.step} of {deployStatus.totalSteps} — {deployStatus.currentStep}
                </p>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
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
                const borderColor = stepState === "success" ? "border-emerald-500/50" : stepState === "running" ? "border-blue-500/50" : stepState === "failed" ? "border-red-500/50" : "border-border";
                const bgColor = stepState === "success" ? "bg-emerald-500/5" : stepState === "running" ? "bg-blue-500/5" : stepState === "failed" ? "bg-red-500/5" : "bg-card";

                return (
                  <div key={step.id} className={`rounded-lg border ${borderColor} ${bgColor} p-3 text-center space-y-2 transition-all duration-500`} data-testid={`pipeline-step-${step.id}`}>
                    <div className="flex items-center justify-center">
                      {stepState === "running" ? (
                        <div className="relative h-8 w-8">
                          <div className="absolute inset-0 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                          <StepIcon className="absolute inset-0 m-auto h-4 w-4 text-blue-500" />
                        </div>
                      ) : stepState === "success" ? (
                        <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        </div>
                      ) : stepState === "failed" ? (
                        <div className="h-8 w-8 rounded-full bg-red-500/20 flex items-center justify-center">
                          <XCircle className="h-4 w-4 text-red-500" />
                        </div>
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                          <StepIcon className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-medium leading-tight">{step.label}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{step.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            {(deployStatus.log.length > 0 || (deployLogData?.logs && deployLogData.logs.length > 0)) && (
              <div className="mt-4">
                <button
                  onClick={() => { setDeployLogExpanded(!deployLogExpanded); if (!deployLogExpanded) refetchLogs(); }}
                  className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="btn-toggle-deploy-logs"
                >
                  <Terminal className="h-3.5 w-3.5" />
                  Deployment Logs
                  {deployLogExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
                {deployLogExpanded && (
                  <div className="mt-2 bg-gray-950 rounded-lg p-3 max-h-60 overflow-y-auto border border-gray-800">
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

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 bg-gradient-to-br from-purple-500/5 via-transparent to-transparent" data-testid="card-repository">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-sm">
                <GitBranch className="h-4 w-4 text-white" />
              </div>
              Source Repository
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data?.git ? (
              <>
                <InfoRow label="Remote" value={data.git.remote} mono />
                <InfoRow label="Branch" value={data.git.branch} badge />
                <InfoRow label="Commit" value={data.git.commit} mono />
                <InfoRow label="Message" value={data.git.message} />
                <InfoRow label="Author" value={data.git.author} />
                <InfoRow label="Date" value={data.git.date ? new Date(data.git.date).toLocaleString() : "N/A"} />
                <div className="flex items-center gap-2 pt-1">
                  <StatusDot status={data.git.isDirty ? "orange" : "green"} />
                  <span className="text-xs">{data.git.isDirty ? "Uncommitted changes" : "Working tree clean"}</span>
                </div>
              </>
            ) : <EmptyState text="Repository data unavailable" />}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1 bg-gradient-to-br from-blue-500/5 via-transparent to-transparent" data-testid="card-server-health">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
                <Server className="h-4 w-4 text-white" />
              </div>
              Server Infrastructure
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data?.resources ? (
              <>
                <MetricGauge label="CPU" value={data.resources.cpu.usagePercent} unit="%" icon={Cpu} detail={`${data.resources.cpu.cores} core(s) — Load: ${data.server?.loadAverage || "N/A"}`} />
                <MetricGauge label="Memory" value={data.resources.memory.usagePercent} unit="%" icon={MemoryStick} detail={`${data.resources.memory.used} / ${data.resources.memory.total}`} />
                <MetricGauge label="Disk" value={data.resources.disk.usagePercent} unit="%" icon={HardDrive} detail={`${data.resources.disk.used} / ${data.resources.disk.total} (${data.resources.disk.mountPoint})`} />
                <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                  <InfoRow label="OS" value={data.server?.os || "N/A"} compact />
                  <InfoRow label="Kernel" value={data.server?.kernel || "N/A"} compact />
                  <InfoRow label="Hostname" value={data.server?.hostname || "N/A"} compact />
                  <InfoRow label="Users" value={data.server?.users || "0"} compact />
                </div>
              </>
            ) : <EmptyState text="Server metrics unavailable" />}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent" data-testid="card-application">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-sm">
                <Container className="h-4 w-4 text-white" />
              </div>
              Application Runtime
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data?.application?.pm2Processes && data.application.pm2Processes.length > 0 ? (
              <>
                {data.application.pm2Processes.map((proc, i) => (
                  <div key={i} className="rounded-lg border p-3 space-y-2" data-testid={`pm2-process-${proc.name}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <StatusDot status={proc.status === "online" ? "green" : proc.status === "stopped" ? "red" : "orange"} />
                        <span className="font-medium text-sm">{proc.name}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">PID: {proc.pid}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className={proc.status === "online" ? "text-emerald-600" : "text-red-600"}>{proc.status}</span></div>
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
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Docker Containers</p>
                {data.application.dockerContainers.map((c, i) => {
                  const isUp = c.status.toLowerCase().includes("up");
                  return (
                    <div key={i} className="rounded-lg border p-3 space-y-1" data-testid={`docker-container-${c.name}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <StatusDot status={isUp ? "green" : "red"} />
                          <span className="font-medium text-sm">{c.name}</span>
                        </div>
                        <Badge variant={isUp ? "default" : "destructive"} className={isUp ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/10" : ""}>
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

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-cyan-500/5 via-transparent to-transparent" data-testid="card-services">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center shadow-sm">
                <Layers className="h-4 w-4 text-white" />
              </div>
              Core Services
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
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

        <Card className="bg-gradient-to-br from-red-500/5 via-transparent to-transparent" data-testid="card-security">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-sm">
                <Shield className="h-4 w-4 text-white" />
              </div>
              Security & Connectivity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
              <span className="text-sm font-medium">Connection</span>
              <Badge variant="outline" className={isConnected ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-red-500/10 text-red-600 border-red-500/20"}>
                <StatusDot status={isConnected ? "green" : "red"} /><span className="ml-1.5">{isConnected ? (data?.mode === "local" ? "Local" : "SSH") : "Disconnected"}</span>
              </Badge>
            </div>
            <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
              <span className="text-sm font-medium">SSL Certificate</span>
              <Badge variant="outline" className={data?.security?.ssl?.includes("Active") ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-amber-500/10 text-amber-600 border-amber-500/20"}>
                <Lock className="h-3 w-3 mr-1" />{data?.security?.ssl || "Unknown"}
              </Badge>
            </div>
            {data?.security?.firewall && data.security.firewall.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Firewall Rules</p>
                <div className="bg-muted/30 rounded-lg p-2 max-h-32 overflow-y-auto">
                  <pre className="text-[10px] font-mono text-muted-foreground whitespace-pre-wrap">{data.security.firewall.join("\n")}</pre>
                </div>
              </div>
            )}
            {data?.security?.openPorts && data.security.openPorts.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Open Ports</p>
                <div className="flex flex-wrap gap-1">
                  {data.security.openPorts.slice(0, 12).map((port, i) => (
                    <Badge key={i} variant="outline" className="text-[10px] font-mono">{port.address}</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/5 via-transparent to-transparent" data-testid="card-deployment">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-sm">
                <Zap className="h-4 w-4 text-white" />
              </div>
              Continuous Deployment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data?.deployment ? (
              <>
                <InfoRow label="Last Git Fetch" value={data.deployment.lastFetch} />
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cron Schedule</p>
                  <div className="bg-muted/30 rounded-lg p-2">
                    <pre className="text-[10px] font-mono text-muted-foreground whitespace-pre-wrap">{data.deployment.cronJobs || "No cron jobs"}</pre>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Recent Pull Log</p>
                  <div className="bg-muted/30 rounded-lg p-2 max-h-40 overflow-y-auto">
                    <pre className="text-[10px] font-mono text-muted-foreground whitespace-pre-wrap">{data.deployment.pullLog || "No pull log"}</pre>
                  </div>
                </div>
              </>
            ) : <EmptyState text="Deployment data unavailable" />}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-gradient-to-r from-primary/5 via-transparent to-transparent" data-testid="card-live-health">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-sm">
              <Activity className="h-4 w-4 text-white" />
            </div>
            Live Application Health
            {isRefetching && <RefreshCw className="h-3.5 w-3.5 ml-2 animate-spin text-muted-foreground" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <HealthCheckItem label="HTTP Response" status={pingData?.reachable ? "pass" : "fail"} detail={pingData?.reachable ? `Status ${pingData.httpStatus}` : (pingData?.error || "Unreachable")} />
            <HealthCheckItem label="API Ping" status={pingData?.reachable ? "pass" : "fail"} detail={pingData?.reachable ? `${pingData.responseTime}ms response` : "Timeout"} />
            <HealthCheckItem label="Database" status={data?.services?.postgresql === "active" ? "pass" : "fail"} detail={data?.services?.postgresql === "active" ? "PostgreSQL active" : "PostgreSQL " + (data?.services?.postgresql || "unknown")} />
            <HealthCheckItem label="Web Server" status={data?.services?.nginx === "active" ? "pass" : "fail"} detail={data?.services?.nginx === "active" ? "Nginx running" : "Nginx " + (data?.services?.nginx || "unknown")} />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-4">
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5" />
          Last updated: {lastRefreshTime ? lastRefreshTime.toLocaleString() : "N/A"}
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1"><StatusDot status="green" /> Healthy</span>
          <span className="flex items-center gap-1"><StatusDot status="orange" /> Warning</span>
          <span className="flex items-center gap-1"><StatusDot status="red" /> Error</span>
          <span className="flex items-center gap-1"><StatusDot status="blue" /> Info</span>
          <span className="flex items-center gap-1"><StatusDot status="grey" /> Unavailable</span>
        </div>
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

function HealthCheckItem({ label, status, detail }: { label: string; status: "pass" | "fail" | "warn"; detail: string }) {
  const configs = {
    pass: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/20" },
    fail: { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10 border-red-500/20" },
    warn: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/20" },
  };
  const config = configs[status];
  const Icon = config.icon;
  return (
    <div className={`rounded-lg border ${config.bg} p-4 flex items-center gap-3 transition-all hover:shadow-md`} data-testid={`health-check-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <Icon className={`h-6 w-6 flex-shrink-0 ${config.color}`} />
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
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
