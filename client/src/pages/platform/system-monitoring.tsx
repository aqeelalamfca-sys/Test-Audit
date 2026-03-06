import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import {
  Server, Cpu, GitBranch,
  Activity, Shield, Globe, RefreshCw, CheckCircle2,
  XCircle, Terminal,
  Lock, Zap, MonitorCheck, Container, Layers,
  Radio, Rocket,
  ChevronDown, ChevronUp,
  Package, Database, RotateCcw, Eye, EyeOff,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  { id: "pull", label: "GIT PULL", icon: GitBranch, desc: "git pull origin main" },
  { id: "deps", label: "INSTALL", icon: Package, desc: "npm ci" },
  { id: "build", label: "BUILD", icon: Rocket, desc: "npm run build" },
  { id: "migrate", label: "MIGRATE", icon: Database, desc: "prisma db push" },
  { id: "restart", label: "RESTART", icon: RotateCcw, desc: "pm2 restart" },
];

function Dot({ on, color = "emerald" }: { on: boolean; color?: string }) {
  const c = on
    ? color === "emerald" ? "bg-emerald-400 shadow-emerald-400/60" : color === "amber" ? "bg-amber-400 shadow-amber-400/60" : "bg-red-400 shadow-red-400/60"
    : "bg-gray-600";
  return <span className={`inline-block w-2 h-2 rounded-full shadow-sm ${c} ${on ? "animate-pulse" : ""}`} aria-hidden="true" />;
}

function ArcGauge({ value, label, sub, color }: { value: number; label: string; sub?: string; color: string }) {
  const r = 34, circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(value, 100) / 100) * circ;
  const stroke = value > 90 ? "#ef4444" : value > 70 ? "#f59e0b" : color;
  return (
    <div className="flex flex-col items-center" data-testid={`gauge-${label.toLowerCase()}`}>
      <div className="relative w-[76px] h-[76px]">
        <svg className="w-[76px] h-[76px] -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={r} fill="none" stroke="#1e293b" strokeWidth="5" />
          <circle cx="40" cy="40" r={r} fill="none" stroke={stroke} strokeWidth="5" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
            style={{ filter: `drop-shadow(0 0 4px ${stroke}80)` }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-base font-mono font-bold text-white tabular-nums" style={{ textShadow: `0 0 8px ${stroke}60` }}>{value}%</span>
        </div>
      </div>
      <span className="text-[10px] font-mono font-semibold text-gray-400 uppercase tracking-widest mt-1">{label}</span>
      {sub && <span className="text-[9px] font-mono text-gray-500 truncate max-w-[90px]">{sub}</span>}
    </div>
  );
}

function SvcRow({ name, active }: { name: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between py-1 group" data-testid={`svc-${name.toLowerCase().replace(/\s+/g, "-")}`}>
      <span className="text-[11px] font-mono text-gray-300 group-hover:text-white transition-colors">{name}</span>
      <div className="flex items-center gap-1.5">
        <Dot on={active} color={active ? "emerald" : "red"} />
        <span className={`text-[10px] font-mono font-semibold uppercase tracking-wider ${active ? "text-emerald-400" : "text-red-400"}`}>
          {active ? "ONLINE" : "DOWN"}
        </span>
      </div>
    </div>
  );
}

export default function SystemMonitoring() {
  const { toast } = useToast();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshCountdown, setRefreshCountdown] = useState(20);
  const [deployLogExpanded, setDeployLogExpanded] = useState(false);
  const [liveDeployStatus, setLiveDeployStatus] = useState<DeploymentStatus | null>(null);
  const [sseStepUpdates, setSseStepUpdates] = useState<Record<number, { status: string; output?: string }>>({});
  const [isPollingDeploy, setIsPollingDeploy] = useState(false);
  const [showIntel, setShowIntel] = useState(true);
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
    mutationFn: async () => { const res = await apiRequest("POST", "/api/platform/system-health/deploy"); return res.json(); },
    onSuccess: () => {
      toast({ title: "DEPLOY INITIATED", description: "Pipeline running..." });
      setIsPollingDeploy(true);
      queryClient.invalidateQueries({ queryKey: ["/api/platform/system-health"] });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/system-health/deploy/status"] });
    },
    onError: (err: any) => { toast({ title: "DEPLOY FAILED", description: err.message, variant: "destructive" }); },
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
      toast({ title: d.status === "success" ? "DEPLOY SUCCESS" : "DEPLOY FAILED", description: d.status === "success" ? "All steps completed." : "Check logs.", variant: d.status === "success" ? "default" : "destructive" });
    });
    return () => { es.close(); };
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    setRefreshCountdown(20);
    const iv = setInterval(() => setRefreshCountdown(p => (p <= 1 ? 20 : p - 1)), 1000);
    return () => clearInterval(iv);
  }, [autoRefresh, data?.timestamp]);

  const polledDeploy = deployStatusData?.deployment;
  const deployStatus = (isPollingDeploy && polledDeploy) ? polledDeploy : liveDeployStatus || polledDeploy || data?.deployment?.status || { status: "idle" as const, step: 0, totalSteps: 5, currentStep: "", log: [], startedAt: null, completedAt: null, triggeredBy: null };
  const isDeploying = deployStatus.status === "running";

  useEffect(() => {
    if (isPollingDeploy && polledDeploy && polledDeploy.status !== "running") {
      setIsPollingDeploy(false);
      if (polledDeploy.status === "success") { queryClient.invalidateQueries({ queryKey: ["/api/platform/system-health"] }); refetchLogs(); }
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
      <div className="flex items-center justify-center h-full bg-gray-950" data-testid="loading-system-monitor">
        <div className="text-center space-y-3">
          <div className="relative mx-auto w-16 h-16">
            <div className="absolute inset-0 rounded-full border-2 border-cyan-500/30" />
            <div className="absolute inset-0 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
            <MonitorCheck className="absolute inset-0 m-auto h-6 w-6 text-cyan-400" />
          </div>
          <p className="font-mono text-xs text-cyan-400 uppercase tracking-[0.2em] animate-pulse">Establishing Secure Link...</p>
        </div>
      </div>
    );
  }

  const overallStatus: "live" | "issues" | "offline" = !isConnected ? "offline" : hasAlerts ? "issues" : "live";
  const issuesList: string[] = [];
  if (isConnected) {
    if ((data?.resources?.cpu?.usagePercent ?? 0) > 90) issuesList.push("CPU CRITICAL");
    if ((data?.resources?.memory?.usagePercent ?? 0) > 90) issuesList.push("MEM CRITICAL");
    if ((data?.resources?.disk?.usagePercent ?? 0) > 90) issuesList.push("DISK CRITICAL");
    if (data?.services && data.services.nginx !== "active") issuesList.push("NGINX DOWN");
    if (data?.services && data.services.postgresql !== "active") issuesList.push("POSTGRES DOWN");
    if (pingData !== undefined && !pingData.reachable) issuesList.push("HEALTH CHECK FAIL");
  }

  const statusGlow = overallStatus === "live" ? "text-emerald-400" : overallStatus === "issues" ? "text-amber-400" : "text-red-400";
  const statusBorder = overallStatus === "live" ? "border-emerald-500/30" : overallStatus === "issues" ? "border-amber-500/30" : "border-red-500/30";
  const statusBg = overallStatus === "live" ? "from-emerald-500/5" : overallStatus === "issues" ? "from-amber-500/5" : "from-red-500/5";

  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-US", { hour12: false });

  return (
    <div className="h-full flex flex-col bg-gray-950 text-gray-200 font-mono overflow-hidden" data-testid="system-monitoring-page">

      <div className={`flex-shrink-0 border-b ${statusBorder} bg-gradient-to-r ${statusBg} to-transparent px-4 py-2`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`h-8 w-8 rounded-lg border ${statusBorder} bg-gray-900 flex items-center justify-center`}>
                <MonitorCheck className={`h-4 w-4 ${statusGlow}`} style={{ filter: overallStatus === "live" ? "drop-shadow(0 0 4px #34d399)" : overallStatus === "issues" ? "drop-shadow(0 0 4px #fbbf24)" : "drop-shadow(0 0 4px #f87171)" }} />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-wider text-white uppercase" data-testid="page-title">AuditWise OPS</h1>
                <p className="text-[9px] text-gray-500 tracking-widest uppercase">Deployment Control Center</p>
              </div>
            </div>

            <div className={`flex items-center gap-2 px-3 py-1 rounded border ${statusBorder} bg-gray-900/50`}>
              <Dot on={isConnected} color={overallStatus === "live" ? "emerald" : overallStatus === "issues" ? "amber" : "red"} />
              <span className={`text-xs font-bold uppercase tracking-wider ${statusGlow}`} data-testid="text-overall-status">
                {overallStatus === "live" ? "ALL SYSTEMS NOMINAL" : overallStatus === "issues" ? `${issuesList.length} ALERT${issuesList.length !== 1 ? "S" : ""}` : "OFFLINE"}
              </span>
            </div>

            {overallStatus === "issues" && issuesList.length > 0 && (
              <div className="flex items-center gap-1.5" data-testid="hero-issues-list">
                {issuesList.map((issue, i) => (
                  <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold tracking-wide" data-testid={`badge-issue-${i}`}>
                    {issue}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500 tabular-nums mr-2">{timeStr}</span>

            {data?.server?.ip && (
              <Badge className="bg-gray-800 text-gray-400 border-gray-700 text-[9px] font-mono hover:bg-gray-700" data-testid="badge-ip">
                <Globe className="h-2.5 w-2.5 mr-1" aria-hidden="true" />{data.server.ip}
              </Badge>
            )}
            {data?.git?.branch && data.git.branch !== "unknown" && (
              <Badge className="bg-gray-800 text-gray-400 border-gray-700 text-[9px] font-mono hover:bg-gray-700" data-testid="badge-branch">
                <GitBranch className="h-2.5 w-2.5 mr-1" aria-hidden="true" />{data.git.branch}
                {data.git.commit && data.git.commit !== "N/A" && <span className="opacity-50 ml-1">({data.git.commit})</span>}
              </Badge>
            )}
            {data?.mode && data.mode !== "none" && (
              <Badge className="bg-gray-800 text-cyan-400/70 border-gray-700 text-[9px] font-mono hover:bg-gray-700" data-testid="badge-mode">
                {data.mode === "local" ? "LOCAL" : "SSH"}
              </Badge>
            )}

            <div className="h-4 w-px bg-gray-700 mx-1" />

            <Button size="sm" variant="ghost" onClick={() => refetch()} disabled={isRefetching}
              className="h-7 px-2 text-[10px] text-gray-400 hover:text-cyan-400 hover:bg-gray-800 font-mono uppercase tracking-wider" data-testid="btn-refresh">
              <RefreshCw className={`h-3 w-3 mr-1 ${isRefetching ? "animate-spin" : ""}`} aria-hidden="true" />
              {isRefetching ? "..." : "SCAN"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAutoRefresh(!autoRefresh)}
              aria-pressed={autoRefresh}
              className={`h-7 px-2 text-[10px] font-mono uppercase tracking-wider ${autoRefresh ? "text-emerald-400 hover:text-emerald-300 bg-emerald-500/5 hover:bg-emerald-500/10" : "text-gray-500 hover:text-gray-300 hover:bg-gray-800"}`}
              data-testid="btn-auto-refresh">
              <Radio className={`h-3 w-3 mr-1 ${autoRefresh ? "animate-pulse" : ""}`} aria-hidden="true" />
              {autoRefresh ? `LIVE ${refreshCountdown}s` : "PAUSED"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowIntel(!showIntel)}
              aria-pressed={showIntel}
              className="h-7 px-2 text-[10px] text-gray-400 hover:text-cyan-400 hover:bg-gray-800 font-mono uppercase tracking-wider"
              data-testid="btn-toggle-details">
              {showIntel ? <EyeOff className="h-3 w-3 mr-1" aria-hidden="true" /> : <Eye className="h-3 w-3 mr-1" aria-hidden="true" />}
              INTEL
            </Button>

            <div className="h-4 w-px bg-gray-700 mx-1" />

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" disabled={isDeploying || !isConnected}
                  className={`h-7 px-3 text-[10px] font-mono font-bold uppercase tracking-wider gap-1 ${isDeploying ? "bg-blue-600 hover:bg-blue-700 text-white animate-pulse" : "bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"}`}
                  data-testid="btn-deploy">
                  {isDeploying ? <RefreshCw className="h-3 w-3 animate-spin" aria-hidden="true" /> : <Rocket className="h-3 w-3" aria-hidden="true" />}
                  {isDeploying ? "DEPLOYING" : "DEPLOY"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-gray-900 border-gray-700">
                <AlertDialogHeader>
                  <AlertDialogTitle className="font-mono text-white">CONFIRM PRODUCTION DEPLOY</AlertDialogTitle>
                  <AlertDialogDescription className="font-mono text-gray-400 text-xs">
                    This will pull latest code, install dependencies, build, migrate database, and restart PM2 on the production VPS. Brief downtime may occur.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="font-mono text-xs bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700" data-testid="btn-deploy-cancel">ABORT</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deployMutation.mutate()} className="font-mono text-xs bg-cyan-600 hover:bg-cyan-700 text-white" data-testid="btn-deploy-confirm">
                    <Rocket className="h-3 w-3 mr-1" aria-hidden="true" /> EXECUTE
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-3">

        <div className="grid grid-cols-12 gap-3">

          <div className="col-span-3" data-testid="resource-gauges">
            <Panel title="SYSTEM RESOURCES" icon={Cpu} accent="cyan">
              {data?.resources ? (
                <div className="flex items-center justify-around py-2">
                  <ArcGauge value={data.resources.cpu.usagePercent} label="CPU" color="#06b6d4" sub={`${data.resources.cpu.cores} cores`} />
                  <ArcGauge value={data.resources.memory.usagePercent} label="RAM" color="#8b5cf6" sub={`${data.resources.memory.used}/${data.resources.memory.total}`} />
                  <ArcGauge value={data.resources.disk.usagePercent} label="DISK" color="#f59e0b" sub={`${data.resources.disk.used}/${data.resources.disk.total}`} />
                </div>
              ) : <EmptyLine text="No metrics" />}
              {data?.server && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 px-2 pt-2 border-t border-gray-800" data-testid="hero-metrics">
                  <KV k="UPTIME" v={data.server.uptime} testId="metric-uptime" />
                  <KV k="LOAD" v={data.server.loadAverage} />
                  <KV k="HOST" v={data.server.hostname} />
                  <KV k="KERNEL" v={data.server.kernel} />
                </div>
              )}
            </Panel>
          </div>

          <div className="col-span-5" data-testid="card-deployment-pipeline">
            <Panel title="DEPLOYMENT PIPELINE" icon={Rocket} accent="blue">
              {isDeploying && (
                <div className="px-2 mb-2">
                  <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full animate-pulse transition-all duration-700"
                      style={{ width: `${(deployStatus.step / deployStatus.totalSteps) * 100}%` }} />
                  </div>
                  <p className="text-[9px] text-blue-400 text-center mt-1 tracking-wide">
                    STEP {deployStatus.step}/{deployStatus.totalSteps} — {deployStatus.currentStep}
                  </p>
                </div>
              )}
              <div className="flex gap-1.5 px-1">
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
                  const bc = st === "success" ? "border-emerald-500/40 bg-emerald-500/5" : st === "running" ? "border-blue-500/40 bg-blue-500/5" : st === "failed" ? "border-red-500/40 bg-red-500/5" : "border-gray-800 bg-gray-900/50";
                  const ic = st === "success" ? "text-emerald-400" : st === "running" ? "text-blue-400" : st === "failed" ? "text-red-400" : "text-gray-600";

                  return (
                    <div key={step.id} className={`flex-1 rounded-lg border ${bc} p-2 text-center transition-all duration-500`} data-testid={`pipeline-step-${step.id}`}>
                      <div className="flex justify-center mb-1">
                        {st === "running" ? (
                          <div className="relative h-7 w-7">
                            <div className="absolute inset-0 rounded-full border border-blue-500 border-t-transparent animate-spin" />
                            <StepIcon className="absolute inset-0 m-auto h-3 w-3 text-blue-400" />
                          </div>
                        ) : (
                          <div className={`h-7 w-7 rounded-full flex items-center justify-center ${st === "success" ? "bg-emerald-500/10" : st === "failed" ? "bg-red-500/10" : "bg-gray-800"}`}>
                            {st === "success" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : st === "failed" ? <XCircle className="h-3.5 w-3.5 text-red-400" /> : <StepIcon className={`h-3 w-3 ${ic}`} />}
                          </div>
                        )}
                      </div>
                      <p className={`text-[9px] font-bold tracking-wider ${ic}`}>{step.label}</p>
                      <p className="text-[8px] text-gray-600 font-mono">{step.desc}</p>
                    </div>
                  );
                })}
              </div>
              {(deployStatus.log.length > 0 || (deployLogData?.logs && deployLogData.logs.length > 0)) && (
                <div className="px-2 mt-2">
                  <button type="button" onClick={() => { setDeployLogExpanded(!deployLogExpanded); if (!deployLogExpanded) refetchLogs(); }}
                    className="flex items-center gap-1.5 text-[9px] font-mono text-gray-500 hover:text-cyan-400 transition-colors uppercase tracking-wider"
                    aria-expanded={deployLogExpanded} aria-controls="deploy-log-panel" data-testid="btn-toggle-deploy-logs">
                    <Terminal className="h-3 w-3" aria-hidden="true" /> OUTPUT
                    {deployLogExpanded ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
                  </button>
                  {deployLogExpanded && (
                    <div id="deploy-log-panel" className="mt-1.5 bg-black rounded-lg p-2 max-h-32 overflow-y-auto border border-gray-800">
                      <pre className="text-[9px] font-mono text-emerald-400/80 whitespace-pre-wrap leading-relaxed">
                        {deployStatus.log.length > 0 ? deployStatus.log.join("\n") : ""}
                        {deployLogData?.logs ? "\n" + deployLogData.logs : ""}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </Panel>
          </div>

          <div className="col-span-4" data-testid="health-checks-grid">
            <Panel title="HEALTH PROBES" icon={Activity} accent="emerald">
              <div className="grid grid-cols-2 gap-2 px-1">
                <ProbeCard label="HTTP" ok={!!pingData?.reachable} detail={pingData?.reachable ? `${pingData.httpStatus}` : (pingData?.error?.substring(0, 20) || "N/A")} icon={Globe} />
                <ProbeCard label="API PING" ok={!!pingData?.reachable} detail={pingData?.reachable ? `${pingData.responseTime}ms` : "TIMEOUT"} icon={Activity} />
                <ProbeCard label="DATABASE" ok={data?.services?.postgresql === "active"} detail={data?.services?.postgresql === "active" ? "ACTIVE" : (data?.services?.postgresql?.toUpperCase() || "UNKNOWN")} icon={Database} />
                <ProbeCard label="NGINX" ok={data?.services?.nginx === "active"} detail={data?.services?.nginx === "active" ? "ACTIVE" : (data?.services?.nginx?.toUpperCase() || "UNKNOWN")} icon={Server} />
              </div>
            </Panel>
          </div>
        </div>

        {showIntel && (
          <div className="grid grid-cols-12 gap-3">

            <div className="col-span-3" data-testid="card-services">
              <Panel title="SERVICES" icon={Layers} accent="violet">
                <div className="space-y-0.5 px-1">
                  <SvcRow name="Nginx" active={data?.services?.nginx === "active"} />
                  <SvcRow name="PostgreSQL" active={data?.services?.postgresql === "active"} />
                  {data?.application?.pm2Processes?.map((proc, i) => (
                    <SvcRow key={i} name={`PM2: ${proc.name}`} active={proc.status === "online"} />
                  ))}
                  {data?.application?.dockerContainers?.map((c, i) => (
                    <SvcRow key={`d-${i}`} name={`Docker: ${c.name}`} active={c.status.toLowerCase().includes("up")} />
                  ))}
                </div>
              </Panel>
            </div>

            <div className="col-span-3" data-testid="card-repository">
              <Panel title="SOURCE INTEL" icon={GitBranch} accent="purple">
                {data?.git ? (
                  <div className="space-y-0.5 px-1">
                    <KV k="REMOTE" v={data.git.remote} mono />
                    <KV k="BRANCH" v={data.git.branch} />
                    <KV k="COMMIT" v={data.git.commit} mono />
                    <KV k="MSG" v={data.git.message} />
                    <KV k="AUTHOR" v={data.git.author} />
                    <KV k="DATE" v={data.git.date ? new Date(data.git.date).toLocaleDateString() : "N/A"} />
                    <div className="flex items-center gap-1.5 pt-1 border-t border-gray-800 mt-1">
                      <Dot on={!data.git.isDirty} color={data.git.isDirty ? "amber" : "emerald"} />
                      <span className={`text-[9px] font-mono ${data.git.isDirty ? "text-amber-400" : "text-emerald-400"}`}>
                        {data.git.isDirty ? "DIRTY" : "CLEAN"}
                      </span>
                    </div>
                  </div>
                ) : <EmptyLine text="No source data" />}
              </Panel>
            </div>

            <div className="col-span-3" data-testid="card-application">
              <Panel title="RUNTIME" icon={Container} accent="teal">
                {data?.application?.pm2Processes && data.application.pm2Processes.length > 0 ? (
                  <div className="space-y-1.5 px-1">
                    {data.application.pm2Processes.map((proc, i) => (
                      <div key={i} className="rounded-lg border border-gray-800 bg-gray-900/50 p-1.5" data-testid={`pm2-process-${proc.name}`}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            <Dot on={proc.status === "online"} color={proc.status === "online" ? "emerald" : "red"} />
                            <span className="text-[10px] font-mono font-bold text-white">{proc.name}</span>
                          </div>
                          <span className="text-[8px] font-mono text-gray-500">PID:{proc.pid}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-0.5 text-[8px] font-mono">
                          <span className="text-gray-500">CPU <span className="text-gray-300">{proc.cpu}</span></span>
                          <span className="text-gray-500">MEM <span className="text-gray-300">{proc.memory}</span></span>
                          <span className="text-gray-500">RST <span className={proc.restarts > 5 ? "text-amber-400" : "text-gray-300"}>{proc.restarts}</span></span>
                        </div>
                      </div>
                    ))}
                    <div className="flex gap-3 pt-1 border-t border-gray-800">
                      <KV k="NODE" v={data.application.nodeVersion} />
                      <KV k="NPM" v={data.application.npmVersion} />
                    </div>
                  </div>
                ) : data?.application?.dockerContainers && data.application.dockerContainers.length > 0 ? (
                  <div className="space-y-1 px-1">
                    {data.application.dockerContainers.map((c, i) => {
                      const up = c.status.toLowerCase().includes("up");
                      return (
                        <div key={i} className="rounded-lg border border-gray-800 bg-gray-900/50 p-1.5" data-testid={`docker-container-${c.name}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <Dot on={up} color={up ? "emerald" : "red"} />
                              <span className="text-[10px] font-mono font-bold text-white">{c.name}</span>
                            </div>
                            <span className={`text-[8px] font-mono font-bold ${up ? "text-emerald-400" : "text-red-400"}`}>{up ? "UP" : "DOWN"}</span>
                          </div>
                          {c.ports && <p className="text-[8px] font-mono text-gray-600 truncate mt-0.5" title={c.ports}>{c.ports}</p>}
                        </div>
                      );
                    })}
                  </div>
                ) : <EmptyLine text="No processes" />}
              </Panel>
            </div>

            <div className="col-span-3" data-testid="card-security">
              <Panel title="SECURITY" icon={Shield} accent="red">
                <div className="space-y-1.5 px-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono text-gray-500">CONNECTION</span>
                    <span className={`text-[9px] font-mono font-bold ${isConnected ? "text-emerald-400" : "text-red-400"}`}>
                      {isConnected ? (data?.mode === "local" ? "LOCAL" : "SSH") : "NONE"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono text-gray-500">SSL</span>
                    <span className={`text-[9px] font-mono font-bold ${data?.security?.ssl?.includes("Active") ? "text-emerald-400" : "text-amber-400"}`}>
                      <Lock className="h-2.5 w-2.5 inline mr-0.5" aria-hidden="true" />{data?.security?.ssl || "UNKNOWN"}
                    </span>
                  </div>
                  {data?.security?.openPorts && data.security.openPorts.length > 0 && (
                    <div>
                      <span className="text-[8px] font-mono text-gray-600 uppercase tracking-wider">OPEN PORTS</span>
                      <div className="flex flex-wrap gap-0.5 mt-0.5">
                        {data.security.openPorts.slice(0, 10).map((port, i) => (
                          <span key={i} className="text-[7px] px-1 py-0.5 rounded bg-gray-800 text-gray-400 font-mono border border-gray-700">{port.address}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {data?.security?.firewall && data.security.firewall.length > 0 && (
                    <div>
                      <span className="text-[8px] font-mono text-gray-600 uppercase tracking-wider">FIREWALL</span>
                      <div className="bg-black rounded p-1.5 max-h-16 overflow-y-auto mt-0.5 border border-gray-800">
                        <pre className="text-[7px] font-mono text-gray-500 whitespace-pre-wrap">{data.security.firewall.join("\n")}</pre>
                      </div>
                    </div>
                  )}
                </div>
              </Panel>
            </div>
          </div>
        )}

        {showIntel && data?.deployment && (
          <div className="grid grid-cols-12 gap-3" data-testid="card-deployment">
            <div className="col-span-12">
              <Panel title="DEPLOYMENT INTEL" icon={Zap} accent="amber">
                <div className="grid grid-cols-3 gap-4 px-1">
                  <div>
                    <span className="text-[8px] font-mono text-gray-600 uppercase tracking-wider">LAST FETCH</span>
                    <p className="text-[10px] font-mono text-gray-300">{data.deployment.lastFetch || "N/A"}</p>
                  </div>
                  <div>
                    <span className="text-[8px] font-mono text-gray-600 uppercase tracking-wider">CRON</span>
                    <p className="text-[10px] font-mono text-gray-400 truncate">{data.deployment.cronJobs || "None"}</p>
                  </div>
                  <div>
                    <span className="text-[8px] font-mono text-gray-600 uppercase tracking-wider">PULL LOG</span>
                    <p className="text-[10px] font-mono text-gray-400 truncate">{data.deployment.pullLog || "N/A"}</p>
                  </div>
                </div>
              </Panel>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Panel({ title, icon: Icon, accent, children }: { title: string; icon: any; accent: string; children: React.ReactNode }) {
  const accentColors: Record<string, string> = {
    cyan: "text-cyan-400 border-cyan-500/20", blue: "text-blue-400 border-blue-500/20",
    emerald: "text-emerald-400 border-emerald-500/20", violet: "text-violet-400 border-violet-500/20",
    purple: "text-purple-400 border-purple-500/20", teal: "text-teal-400 border-teal-500/20",
    red: "text-red-400 border-red-500/20", amber: "text-amber-400 border-amber-500/20",
  };
  const ac = accentColors[accent] || accentColors.cyan;
  const [tc, bc] = ac.split(" ");
  return (
    <div className={`rounded-lg border ${bc} bg-gray-900/70 h-full flex flex-col`}>
      <div className={`flex items-center gap-1.5 px-3 py-1.5 border-b ${bc}`}>
        <Icon className={`h-3 w-3 ${tc}`} aria-hidden="true" />
        <span className={`text-[9px] font-mono font-bold uppercase tracking-[0.15em] ${tc}`}>{title}</span>
      </div>
      <div className="flex-1 p-2">{children}</div>
    </div>
  );
}

function ProbeCard({ label, ok, detail, icon: Icon }: { label: string; ok: boolean; detail: string; icon: any }) {
  return (
    <div className={`rounded-lg border p-2.5 flex items-center gap-2 transition-all ${ok ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5"}`}
      data-testid={`health-check-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className={`h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 ${ok ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
        <Icon className={`h-3.5 w-3.5 ${ok ? "text-emerald-400" : "text-red-400"}`} />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-mono font-bold text-gray-300 uppercase tracking-wider">{label}</span>
          {ok ? <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" /> : <XCircle className="h-2.5 w-2.5 text-red-400" />}
        </div>
        <p className={`text-[9px] font-mono truncate ${ok ? "text-emerald-400/70" : "text-red-400/70"}`}>{detail}</p>
      </div>
    </div>
  );
}

function KV({ k, v, mono, testId }: { k: string; v: string; mono?: boolean; testId?: string }) {
  return (
    <div className="flex items-center justify-between gap-2" data-testid={testId}>
      <span className="text-[9px] font-mono text-gray-600 uppercase tracking-wider flex-shrink-0">{k}</span>
      <span className={`text-[10px] font-mono text-gray-300 truncate text-right max-w-[140px] ${mono ? "text-[9px]" : ""}`} title={v}>{v}</span>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center py-4">
      <span className="text-[9px] font-mono text-gray-600 uppercase tracking-wider">{text}</span>
    </div>
  );
}
