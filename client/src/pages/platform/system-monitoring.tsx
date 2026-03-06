import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  Server, Cpu, HardDrive, MemoryStick, GitBranch, GitCommit,
  Activity, Shield, Globe, RefreshCw, Clock, CheckCircle2,
  XCircle, AlertTriangle, Wifi, WifiOff, Terminal, Database,
  Lock, ArrowUpRight, Zap, MonitorCheck, Container, Layers,
  Timer, BarChart3, CircleDot, Radio, ArrowDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { apiRequest } from "@/lib/queryClient";

interface SystemHealthData {
  connected: boolean;
  error?: string;
  timestamp: string;
  server?: {
    hostname: string;
    ip: string;
    os: string;
    kernel: string;
    uptime: string;
    loadAverage: string;
    users: string;
  };
  resources?: {
    cpu: { usagePercent: number; cores: number };
    memory: { total: string; used: string; free: string; usagePercent: number };
    disk: { total: string; used: string; avail: string; usagePercent: number; mountPoint: string };
  };
  git?: {
    remote: string;
    commit: string;
    commitFull: string;
    message: string;
    author: string;
    date: string;
    branch: string;
    status: string;
    isDirty: boolean;
  };
  application?: {
    pm2Processes: Array<{
      name: string;
      id: number;
      status: string;
      cpu: string;
      memory: string;
      uptime: string;
      restarts: number;
      pid: number;
      mode: string;
    }>;
    nodeVersion: string;
    npmVersion: string;
  };
  services?: {
    nginx: string;
    postgresql: string;
  };
  security?: {
    firewall: string[];
    openPorts: Array<{ protocol: string; address: string; state: string }>;
    ssl: string;
  };
  deployment?: {
    cronJobs: string;
    lastFetch: string;
    pullLog: string;
  };
}

interface PingData {
  reachable: boolean;
  httpStatus?: number;
  responseTime?: number;
  url?: string;
  error?: string;
}

function StatusDot({ status }: { status: "green" | "orange" | "red" | "blue" | "grey" }) {
  const colors = {
    green: "bg-emerald-500 shadow-emerald-500/50",
    orange: "bg-amber-500 shadow-amber-500/50",
    red: "bg-red-500 shadow-red-500/50",
    blue: "bg-blue-500 shadow-blue-500/50",
    grey: "bg-gray-400 shadow-gray-400/50",
  };
  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full shadow-lg ${colors[status]} animate-pulse`} />
  );
}

function ProgressBar({ value, max = 100, color = "emerald" }: { value: number; max?: number; color?: string }) {
  const percent = Math.min((value / max) * 100, 100);
  const colorMap: Record<string, string> = {
    emerald: "from-emerald-500 to-emerald-400",
    amber: "from-amber-500 to-amber-400",
    red: "from-red-500 to-red-400",
    blue: "from-blue-500 to-blue-400",
    purple: "from-purple-500 to-purple-400",
  };
  const barColor = percent > 90 ? "from-red-500 to-red-400" : percent > 70 ? "from-amber-500 to-amber-400" : (colorMap[color] || colorMap.emerald);
  return (
    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
      <div
        className={`h-full bg-gradient-to-r ${barColor} rounded-full transition-all duration-1000 ease-out`}
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

function MetricGauge({ label, value, unit, icon: Icon, detail }: {
  label: string;
  value: number;
  unit: string;
  icon: any;
  detail?: string;
}) {
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
      <Badge
        variant={isActive ? "default" : "destructive"}
        className={isActive ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/10" : ""}
        data-testid={`status-badge-${name.toLowerCase()}`}
      >
        <StatusDot status={isActive ? "green" : "red"} />
        <span className="ml-1.5">{status}</span>
      </Badge>
    </div>
  );
}

export default function SystemMonitoring() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [refreshCountdown, setRefreshCountdown] = useState(20);

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

  useEffect(() => {
    if (data?.timestamp) setLastRefreshTime(new Date(data.timestamp));
  }, [data?.timestamp]);

  useEffect(() => {
    if (!autoRefresh) return;
    setRefreshCountdown(20);
    const interval = setInterval(() => {
      setRefreshCountdown(prev => (prev <= 1 ? 20 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, data?.timestamp]);

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
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Connecting to VPS infrastructure...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto" data-testid="system-monitoring-page">
      {hasAlerts && isConnected && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 flex items-center gap-3 animate-pulse" data-testid="alert-banner">
          <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <span className="text-sm font-medium text-red-600 dark:text-red-400">
            System alert detected — one or more health checks require attention
          </span>
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <MonitorCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight" data-testid="page-title">AuditWise Deployment Monitor</h1>
              <p className="text-sm text-muted-foreground">Enterprise-Grade System Health Dashboard</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline" className="gap-1.5 py-1" data-testid="badge-environment">
            <CircleDot className="h-3 w-3 text-emerald-500" />
            Production
          </Badge>
          <Badge variant="outline" className="gap-1.5 py-1" data-testid="badge-provider">
            <Server className="h-3 w-3" />
            Hostinger VPS
          </Badge>
          {data?.server?.ip && (
            <Badge variant="outline" className="gap-1.5 py-1 font-mono text-xs" data-testid="badge-ip">
              <Globe className="h-3 w-3" />
              {data.server.ip}
            </Badge>
          )}
          {data?.git?.branch && (
            <Badge variant="outline" className="gap-1.5 py-1" data-testid="badge-branch">
              <GitBranch className="h-3 w-3" />
              {data.git.branch}
            </Badge>
          )}
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                  disabled={isRefetching}
                  data-testid="btn-refresh"
                >
                  <RefreshCw className={`h-4 w-4 mr-1.5 ${isRefetching ? "animate-spin" : ""}`} />
                  {isRefetching ? "Refreshing..." : "Refresh"}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh all health checks</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={autoRefresh ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  data-testid="btn-auto-refresh"
                >
                  <Radio className={`h-4 w-4 mr-1.5 ${autoRefresh ? "animate-pulse" : ""}`} />
                  {autoRefresh ? `Auto (${refreshCountdown}s)` : "Auto Off"}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{autoRefresh ? "Auto-refresh every 20s (click to disable)" : "Click to enable auto-refresh"}</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      {!isConnected && (
        <Card className="border-amber-500/30 bg-amber-500/5" data-testid="card-not-connected">
          <CardContent className="flex items-center gap-4 py-6">
            <WifiOff className="h-8 w-8 text-amber-500" />
            <div>
              <p className="font-semibold text-amber-600 dark:text-amber-400">VPS Connection Unavailable</p>
              <p className="text-sm text-muted-foreground mt-1">
                {data?.error || "SSH credentials not configured. Set VPS_SSH_HOST, VPS_SSH_USER, and VPS_SSH_PASSWORD in environment variables."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatCard
          label="Server Status"
          value={isConnected ? "Online" : "Offline"}
          icon={Wifi}
          status={isConnected ? "green" : "red"}
        />
        <StatCard
          label="Server Uptime"
          value={data?.server?.uptime || "N/A"}
          icon={Timer}
          status={isConnected ? "green" : "grey"}
        />
        <StatCard
          label="CPU Usage"
          value={`${data?.resources?.cpu?.usagePercent || 0}%`}
          icon={Cpu}
          status={getHealthStatus(data?.resources?.cpu?.usagePercent || 0)}
        />
        <StatCard
          label="RAM Usage"
          value={`${data?.resources?.memory?.usagePercent || 0}%`}
          icon={MemoryStick}
          status={getHealthStatus(data?.resources?.memory?.usagePercent || 0)}
        />
        <StatCard
          label="Disk Usage"
          value={`${data?.resources?.disk?.usagePercent || 0}%`}
          icon={HardDrive}
          status={getHealthStatus(data?.resources?.disk?.usagePercent || 0)}
        />
        <StatCard
          label="App Health"
          value={pingData?.reachable ? `${pingData.responseTime}ms` : "Down"}
          icon={Activity}
          status={pingData?.reachable ? "green" : "red"}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1" data-testid="card-repository">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <GitBranch className="h-4 w-4 text-purple-500" />
              </div>
              Source Repository
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data?.git ? (
              <>
                <InfoRow label="Remote" value={data.git.remote} mono />
                <InfoRow label="Branch" value={data.git.branch} badge />
                <InfoRow label="Latest Commit" value={data.git.commit} mono />
                <InfoRow label="Message" value={data.git.message} />
                <InfoRow label="Author" value={data.git.author} />
                <InfoRow label="Date" value={data.git.date ? new Date(data.git.date).toLocaleString() : "N/A"} />
                <div className="flex items-center gap-2 pt-1">
                  <StatusDot status={data.git.isDirty ? "orange" : "green"} />
                  <span className="text-xs">{data.git.isDirty ? "Uncommitted changes detected" : "Working tree clean"}</span>
                </div>
              </>
            ) : (
              <EmptyState text="Repository data unavailable" />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1" data-testid="card-server-health">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Server className="h-4 w-4 text-blue-500" />
              </div>
              Server Infrastructure
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data?.resources ? (
              <>
                <MetricGauge
                  label="CPU"
                  value={data.resources.cpu.usagePercent}
                  unit="%"
                  icon={Cpu}
                  detail={`${data.resources.cpu.cores} core(s) — Load: ${data.server?.loadAverage || "N/A"}`}
                />
                <MetricGauge
                  label="Memory"
                  value={data.resources.memory.usagePercent}
                  unit="%"
                  icon={MemoryStick}
                  detail={`${data.resources.memory.used} used / ${data.resources.memory.total} total`}
                />
                <MetricGauge
                  label="Disk"
                  value={data.resources.disk.usagePercent}
                  unit="%"
                  icon={HardDrive}
                  detail={`${data.resources.disk.used} used / ${data.resources.disk.total} total (${data.resources.disk.mountPoint})`}
                />
                <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                  <InfoRow label="OS" value={data.server?.os || "N/A"} compact />
                  <InfoRow label="Kernel" value={data.server?.kernel || "N/A"} compact />
                  <InfoRow label="Hostname" value={data.server?.hostname || "N/A"} compact />
                  <InfoRow label="Users" value={data.server?.users || "0"} compact />
                </div>
              </>
            ) : (
              <EmptyState text="Server metrics unavailable" />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1" data-testid="card-application">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Container className="h-4 w-4 text-emerald-500" />
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
                      <Badge variant="outline" className="text-xs">
                        PID: {proc.pid}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status</span>
                        <span className={proc.status === "online" ? "text-emerald-600" : "text-red-600"}>{proc.status}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">CPU</span>
                        <span>{proc.cpu}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Memory</span>
                        <span>{proc.memory}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Uptime</span>
                        <span>{proc.uptime}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Restarts</span>
                        <span className={proc.restarts > 5 ? "text-amber-600 font-medium" : ""}>{proc.restarts}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Mode</span>
                        <span>{proc.mode}</span>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="border-t pt-2 grid grid-cols-2 gap-2">
                  <InfoRow label="Node.js" value={data.application.nodeVersion} compact />
                  <InfoRow label="NPM" value={data.application.npmVersion} compact />
                </div>
              </>
            ) : (
              <EmptyState text="No PM2 processes detected" />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card data-testid="card-services">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="h-8 w-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                <Layers className="h-4 w-4 text-cyan-500" />
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
          </CardContent>
        </Card>

        <Card data-testid="card-security">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                <Shield className="h-4 w-4 text-red-500" />
              </div>
              Security & Connectivity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
              <span className="text-sm font-medium">SSH Connection</span>
              <Badge variant="outline" className={isConnected ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-red-500/10 text-red-600 border-red-500/20"}>
                <StatusDot status={isConnected ? "green" : "red"} />
                <span className="ml-1.5">{isConnected ? "Connected" : "Disconnected"}</span>
              </Badge>
            </div>
            <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
              <span className="text-sm font-medium">SSL Certificate</span>
              <Badge variant="outline" className={data?.security?.ssl?.includes("Active") ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-amber-500/10 text-amber-600 border-amber-500/20"}>
                <Lock className="h-3 w-3 mr-1" />
                {data?.security?.ssl || "Unknown"}
              </Badge>
            </div>
            {data?.security?.firewall && data.security.firewall.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Firewall Rules</p>
                <div className="bg-muted/30 rounded-lg p-2 max-h-32 overflow-y-auto">
                  <pre className="text-[10px] font-mono text-muted-foreground whitespace-pre-wrap">
                    {data.security.firewall.join("\n")}
                  </pre>
                </div>
              </div>
            )}
            {data?.security?.openPorts && data.security.openPorts.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Open Ports</p>
                <div className="flex flex-wrap gap-1">
                  {data.security.openPorts.slice(0, 12).map((port, i) => (
                    <Badge key={i} variant="outline" className="text-[10px] font-mono">
                      {port.address}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-deployment">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Zap className="h-4 w-4 text-amber-500" />
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
                    <pre className="text-[10px] font-mono text-muted-foreground whitespace-pre-wrap">
                      {data.deployment.cronJobs || "No cron jobs configured"}
                    </pre>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Recent Pull Log</p>
                  <div className="bg-muted/30 rounded-lg p-2 max-h-40 overflow-y-auto">
                    <pre className="text-[10px] font-mono text-muted-foreground whitespace-pre-wrap">
                      {data.deployment.pullLog || "No pull log available"}
                    </pre>
                  </div>
                </div>
              </>
            ) : (
              <EmptyState text="Deployment data unavailable" />
            )}
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-live-health">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <Activity className="h-4 w-4 text-white" />
            </div>
            Live Application Health
            {isRefetching && (
              <RefreshCw className="h-3.5 w-3.5 ml-2 animate-spin text-muted-foreground" />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <HealthCheckItem
              label="HTTP Response"
              status={pingData?.reachable ? "pass" : "fail"}
              detail={pingData?.reachable ? `Status ${pingData.httpStatus}` : (pingData?.error || "Unreachable")}
            />
            <HealthCheckItem
              label="API Ping"
              status={pingData?.reachable ? "pass" : "fail"}
              detail={pingData?.reachable ? `${pingData.responseTime}ms response` : "Timeout"}
            />
            <HealthCheckItem
              label="Database"
              status={data?.services?.postgresql === "active" ? "pass" : "fail"}
              detail={data?.services?.postgresql === "active" ? "PostgreSQL active" : "PostgreSQL " + (data?.services?.postgresql || "unknown")}
            />
            <HealthCheckItem
              label="Web Server"
              status={data?.services?.nginx === "active" ? "pass" : "fail"}
              detail={data?.services?.nginx === "active" ? "Nginx running" : "Nginx " + (data?.services?.nginx || "unknown")}
            />
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

function StatCard({ label, value, icon: Icon, status }: { label: string; value: string; icon: any; status: "green" | "orange" | "red" | "grey" }) {
  const borderColors = {
    green: "border-emerald-500/30",
    orange: "border-amber-500/30",
    red: "border-red-500/30",
    grey: "border-gray-300/30 dark:border-gray-700/30",
  };
  return (
    <div className={`rounded-xl border ${borderColors[status]} bg-card p-3 flex flex-col items-center justify-center text-center space-y-1.5 transition-all hover:shadow-md`} data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="flex items-center gap-1.5">
        <StatusDot status={status} />
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="text-lg font-bold tabular-nums leading-none">{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
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
    <div className={`rounded-lg border ${config.bg} p-4 flex items-center gap-3`} data-testid={`health-check-${label.toLowerCase().replace(/\s+/g, "-")}`}>
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
