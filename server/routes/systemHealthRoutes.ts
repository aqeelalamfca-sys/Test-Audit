import { Router, type Response, type Request } from "express";
import { requireAuth, type AuthenticatedRequest } from "../auth";
import { requireSuperAdmin } from "../middleware/rbacGuard";
import { Client } from "ssh2";
import { exec } from "child_process";
import os from "os";
import fs from "fs";
import path from "path";

const router = Router();

router.use(requireAuth);
router.use(requireSuperAdmin);

interface CommandResult {
  stdout: string;
  stderr: string;
  code: number;
}

const DEPLOY_LOG_PATH = path.join(process.cwd(), "logs", "deployments.log");

function ensureLogDir() {
  const dir = path.dirname(DEPLOY_LOG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function appendDeployLog(message: string) {
  ensureLogDir();
  const ts = new Date().toISOString();
  fs.appendFileSync(DEPLOY_LOG_PATH, `[${ts}] ${message}\n`);
}

function readDeployLogs(lines = 100): string {
  ensureLogDir();
  if (!fs.existsSync(DEPLOY_LOG_PATH)) return "";
  const content = fs.readFileSync(DEPLOY_LOG_PATH, "utf-8");
  return content.split("\n").slice(-lines).join("\n");
}

let activeDeployment: {
  status: "idle" | "running" | "success" | "failed";
  step: number;
  totalSteps: number;
  currentStep: string;
  log: string[];
  startedAt: string | null;
  completedAt: string | null;
  triggeredBy: string | null;
} = {
  status: "idle",
  step: 0,
  totalSteps: 5,
  currentStep: "",
  log: [],
  startedAt: null,
  completedAt: null,
  triggeredBy: null,
};

const sseClients: Set<Response> = new Set();

function broadcastSSE(event: string, data: any) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try { client.write(msg); } catch { sseClients.delete(client); }
  }
}

function getSSHConfig() {
  const host = process.env.VPS_SSH_HOST || process.env.VPS_HOST;
  const username = process.env.VPS_SSH_USER || "root";
  const password = process.env.VPS_SSH_PASSWORD;
  const privateKey = process.env.VPS_SSH_PRIVATE_KEY;
  const port = parseInt(process.env.VPS_SSH_PORT || "22");
  return { host, username, password, privateKey, port };
}

function isLocalMode(): boolean {
  const { host } = getSSHConfig();
  if (host) return false;
  const env = process.env.NODE_ENV || "";
  return env === "production" || process.env.VPS_LOCAL_MODE === "true";
}

function executeLocal(command: string, timeoutMs = 15000): Promise<CommandResult> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({ stdout: "", stderr: "Command timeout", code: -2 });
    }, timeoutMs);

    exec(command, { timeout: timeoutMs, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      clearTimeout(timeout);
      resolve({
        stdout: (stdout || "").trim(),
        stderr: (stderr || "").trim(),
        code: error ? (error.code || 1) : 0,
      });
    });
  });
}

function executeSSH(command: string, timeoutMs = 15000): Promise<CommandResult> {
  return new Promise((resolve) => {
    const { host, username, password, privateKey, port } = getSSHConfig();

    if (!host) {
      return resolve({ stdout: "", stderr: "SSH host not configured", code: -1 });
    }

    const conn = new Client();
    let stdout = "";
    let stderr = "";

    const timeout = setTimeout(() => {
      conn.end();
      resolve({ stdout, stderr: "Connection timeout", code: -2 });
    }, timeoutMs);

    conn.on("ready", () => {
      conn.exec(command, (err, stream) => {
        if (err) {
          clearTimeout(timeout);
          conn.end();
          return resolve({ stdout: "", stderr: err.message, code: -1 });
        }
        stream.on("close", (code: number) => {
          clearTimeout(timeout);
          conn.end();
          resolve({ stdout: stdout.trim(), stderr: stderr.trim(), code: code || 0 });
        });
        stream.on("data", (data: Buffer) => { stdout += data.toString(); });
        stream.stderr.on("data", (data: Buffer) => { stderr += data.toString(); });
      });
    });

    conn.on("error", (err) => {
      clearTimeout(timeout);
      resolve({ stdout: "", stderr: err.message, code: -1 });
    });

    const connectConfig: any = { host, port, username, readyTimeout: 10000 };
    if (privateKey) {
      connectConfig.privateKey = privateKey.replace(/\\n/g, "\n");
    } else if (password) {
      connectConfig.password = password;
    }
    conn.connect(connectConfig);
  });
}

function executeCommand(command: string, timeoutMs = 15000): Promise<CommandResult> {
  if (isLocalMode()) {
    return executeLocal(command, timeoutMs);
  }
  return executeSSH(command, timeoutMs);
}

async function runMultipleCommands(commands: Record<string, string>): Promise<Record<string, CommandResult>> {
  const results: Record<string, CommandResult> = {};
  const useLocal = isLocalMode();
  if (useLocal) {
    const entries = Object.entries(commands);
    const promises = entries.map(async ([key, cmd]) => {
      results[key] = await executeLocal(cmd);
    });
    await Promise.all(promises);
  } else {
    for (const [key, cmd] of Object.entries(commands)) {
      results[key] = await executeSSH(cmd);
    }
  }
  return results;
}

function parseUptime(raw: string) {
  const match = raw.match(/up\s+(.+?),\s+(\d+)\s+user.*load average:\s*(.+)/);
  if (match) return { uptime: match[1].trim(), users: match[2], loadAvg: match[3].trim() };
  return { uptime: raw, loadAvg: "N/A", users: "0" };
}

function parseMemory(raw: string) {
  const memLine = raw.split("\n").find(l => l.startsWith("Mem:"));
  if (memLine) {
    const parts = memLine.split(/\s+/);
    const total = parts[1] || "0";
    const used = parts[2] || "0";
    const free = parts[3] || "0";
    const totalNum = parseFloat(total.replace(/[^0-9.]/g, ""));
    const usedNum = parseFloat(used.replace(/[^0-9.]/g, ""));
    const usagePercent = totalNum > 0 ? Math.round((usedNum / totalNum) * 100) : 0;
    return { total, used, free, usagePercent };
  }
  return { total: "N/A", used: "N/A", free: "N/A", usagePercent: 0 };
}

function parseDisk(raw: string) {
  const rootLine = raw.split("\n").find(l => l.endsWith("/") || l.includes("/dev/"));
  if (rootLine) {
    const parts = rootLine.split(/\s+/);
    return { total: parts[1] || "N/A", used: parts[2] || "N/A", avail: parts[3] || "N/A", usagePercent: parseInt(parts[4] || "0"), mountPoint: parts[5] || "/" };
  }
  return { total: "N/A", used: "N/A", avail: "N/A", usagePercent: 0, mountPoint: "/" };
}

function parsePM2Table(raw: string) {
  const lines = raw.split("\n").filter(l => l.includes("│") && !l.includes("─") && !l.includes("id") && !l.includes("name"));
  return lines.map(line => {
    const cells = line.split("│").map(c => c.trim()).filter(Boolean);
    if (cells.length >= 9) {
      return { id: cells[0], name: cells[1], mode: cells[3] || "N/A", pid: cells[4] || "N/A", status: cells[5] || "N/A", restarts: cells[6] || "0", uptime: cells[7] || "N/A", cpu: cells[8] || "0%", mem: cells[9] || "0mb" };
    }
    return null;
  }).filter(Boolean);
}

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

router.get("/system-health/events", (req: Request, res: Response) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(`event: connected\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);
  sseClients.add(res);

  const heartbeat = setInterval(() => {
    try { res.write(`:heartbeat\n\n`); } catch { clearInterval(heartbeat); sseClients.delete(res); }
  }, 15000);

  req.on("close", () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

router.get("/system-health", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { host } = getSSHConfig();
    const localMode = isLocalMode();

    if (!host && !localMode) {
      return res.json({
        connected: false,
        mode: "none",
        error: "VPS SSH credentials not configured. Set VPS_SSH_HOST, VPS_SSH_USER, and VPS_SSH_PASSWORD or VPS_SSH_PRIVATE_KEY in environment variables. Or set NODE_ENV=production to use local mode on the VPS.",
        timestamp: new Date().toISOString(),
        deployment: { status: activeDeployment },
      });
    }

    const appDir = process.env.APP_DIR || "/opt/auditwise";

    const commands: Record<string, string> = {
      uptime: "uptime",
      memory: "free -h",
      disk: "df -h /",
      cpu: "mpstat 1 1 2>/dev/null || (top -bn1 | grep '%Cpu' | awk '{idle=$8} END {printf \"%.0f\", 100-idle}') || echo '0'",
      cpuCores: "nproc",
      pm2List: "pm2 jlist 2>/dev/null || echo '[]'",
      pm2Status: "pm2 list 2>/dev/null || echo 'PM2 not running'",
      gitRemote: `cd ${appDir} && git remote -v 2>/dev/null | head -2 || echo 'Not a git repo'`,
      gitLog: `cd ${appDir} && git log -1 --format='%H|%s|%an|%ai' 2>/dev/null || echo 'No git history'`,
      gitStatus: `cd ${appDir} && git status --short 2>/dev/null | head -20 || echo ''`,
      gitBranch: `cd ${appDir} && git branch --show-current 2>/dev/null || echo 'unknown'`,
      nodeVersion: "node --version 2>/dev/null || echo 'N/A'",
      npmVersion: "npm --version 2>/dev/null || echo 'N/A'",
      ufwStatus: "sudo ufw status 2>/dev/null || echo 'UFW not installed'",
      openPorts: "ss -tuln 2>/dev/null | grep LISTEN | head -20 || echo 'N/A'",
      sslCheck: "test -f /etc/letsencrypt/live/*/fullchain.pem && echo 'SSL Active' || echo 'No SSL'",
      cronJobs: "crontab -l 2>/dev/null || echo 'No crontab'",
      fetchHead: `stat -c '%y' ${appDir}/.git/FETCH_HEAD 2>/dev/null || echo 'Never fetched'`,
      gitPullLog: `tail -20 ${appDir}/gitpull.log 2>/dev/null || echo 'No pull log'`,
      hostname: "hostname 2>/dev/null || echo 'unknown'",
      osRelease: "cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d= -f2 | tr -d '\"' || echo 'Unknown OS'",
      kernelVersion: "uname -r 2>/dev/null || echo 'N/A'",
      nginxStatus: "systemctl is-active nginx 2>/dev/null || echo 'inactive'",
      postgresStatus: "systemctl is-active postgresql 2>/dev/null || echo 'inactive'",
      dockerContainers: "docker ps --format '{{.Names}}|{{.Status}}|{{.Ports}}' 2>/dev/null || echo ''",
    };

    const results = await runMultipleCommands(commands);

    const uptimeData = parseUptime(results.uptime.stdout);
    const memoryData = parseMemory(results.memory.stdout);
    const diskData = parseDisk(results.disk.stdout);
    const pm2TableProcesses = parsePM2Table(results.pm2Status.stdout);

    let cpuUsage = 0;
    const cpuRaw = results.cpu.stdout;
    if (cpuRaw.includes("all")) {
      const parts = cpuRaw.split(/\s+/);
      const idle = parseFloat(parts[parts.length - 1] || "100");
      cpuUsage = Math.round(100 - idle);
    } else {
      cpuUsage = parseInt(cpuRaw) || 0;
    }

    const gitLogParts = results.gitLog.stdout.split("|");
    const gitInfo = {
      remote: results.gitRemote.stdout.split("\n")[0]?.replace(/\s+\(fetch\)/, "") || "N/A",
      commit: gitLogParts[0]?.substring(0, 8) || "N/A",
      commitFull: gitLogParts[0] || "N/A",
      message: gitLogParts[1] || "N/A",
      author: gitLogParts[2] || "N/A",
      date: gitLogParts[3] || "N/A",
      branch: results.gitBranch.stdout || "unknown",
      status: results.gitStatus.stdout || "Clean",
      isDirty: results.gitStatus.stdout.length > 0,
    };

    let pm2JSON: any[] = [];
    try { pm2JSON = JSON.parse(results.pm2List.stdout); } catch {}

    const pm2Data = pm2JSON.map((p: any) => ({
      name: p.name,
      id: p.pm_id,
      status: p.pm2_env?.status || "unknown",
      cpu: `${p.monit?.cpu || 0}%`,
      memory: `${Math.round((p.monit?.memory || 0) / 1024 / 1024)}MB`,
      uptime: p.pm2_env?.pm_uptime ? formatUptime(Date.now() - p.pm2_env.pm_uptime) : "N/A",
      restarts: p.pm2_env?.restart_time || 0,
      pid: p.pid || 0,
      mode: p.pm2_env?.exec_mode || "N/A",
    }));

    const dockerContainers = results.dockerContainers?.stdout
      ? results.dockerContainers.stdout.split("\n").filter(Boolean).map(line => {
          const [name, status, ports] = line.split("|");
          return { name: name || "", status: status || "", ports: ports || "" };
        })
      : [];

    const ufwLines = results.ufwStatus.stdout.split("\n").filter(l => l.trim().length > 0);
    const openPortLines = results.openPorts.stdout.split("\n").filter(l => l.trim().length > 0);
    const openPorts = openPortLines.map(l => {
      const parts = l.split(/\s+/);
      return { protocol: parts[0], address: parts[4] || parts[3], state: parts[parts.length - 1] };
    });

    const serverIp = localMode ? (os.networkInterfaces()?.eth0?.[0]?.address || os.hostname()) : host;

    res.json({
      connected: true,
      mode: localMode ? "local" : "ssh",
      timestamp: new Date().toISOString(),
      server: { hostname: results.hostname.stdout, ip: serverIp, os: results.osRelease.stdout, kernel: results.kernelVersion.stdout, uptime: uptimeData.uptime, loadAverage: uptimeData.loadAvg, users: uptimeData.users },
      resources: { cpu: { usagePercent: cpuUsage, cores: parseInt(results.cpuCores.stdout) || 1 }, memory: memoryData, disk: diskData },
      git: gitInfo,
      application: { pm2Processes: pm2Data.length > 0 ? pm2Data : pm2TableProcesses, nodeVersion: results.nodeVersion.stdout, npmVersion: results.npmVersion.stdout, dockerContainers },
      services: { nginx: results.nginxStatus.stdout.trim(), postgresql: results.postgresStatus.stdout.trim() },
      security: { firewall: ufwLines, openPorts, ssl: results.sslCheck.stdout.trim() },
      deployment: { cronJobs: results.cronJobs.stdout, lastFetch: results.fetchHead.stdout, pullLog: results.gitPullLog.stdout, status: activeDeployment },
    });
  } catch (error: any) {
    res.status(500).json({ connected: false, error: error.message, timestamp: new Date().toISOString() });
  }
});

router.get("/system-health/ping", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { host } = getSSHConfig();
    const localMode = isLocalMode();

    if (!host && !localMode) return res.json({ reachable: false, error: "VPS host not configured" });

    const appUrl = localMode
      ? (process.env.VPS_APP_URL || `http://localhost:${process.env.PORT || 5000}`)
      : (process.env.VPS_APP_URL || `https://${host}`);
    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(`${appUrl}/api/health`, { signal: controller.signal, headers: { "User-Agent": "AuditWise-HealthCheck/1.0" } });
      clearTimeout(timeout);
      return res.json({ reachable: true, httpStatus: response.status, responseTime: Date.now() - startTime, url: appUrl, mode: localMode ? "local" : "ssh" });
    } catch (fetchErr: any) {
      return res.json({ reachable: false, error: fetchErr.message, responseTime: Date.now() - startTime, url: appUrl });
    }
  } catch (error: any) {
    res.status(500).json({ reachable: false, error: error.message });
  }
});

function getDeploySteps(): Array<{ id: string; label: string; cmd: string }> {
  const appDir = process.env.APP_DIR || "/opt/auditwise";
  return [
    { id: "pull", label: "Repository Pull", cmd: `cd ${appDir} && git pull origin main 2>&1` },
    { id: "deps", label: "Install Dependencies", cmd: `cd ${appDir} && npm ci --production=false 2>&1` },
    { id: "build", label: "Build Application", cmd: `cd ${appDir} && npm run build 2>&1` },
    { id: "migrate", label: "Database Migration", cmd: `cd ${appDir} && npx prisma db push --accept-data-loss 2>&1` },
    { id: "restart", label: "Restart PM2 Services", cmd: `cd ${appDir} && pm2 restart ecosystem.config.cjs 2>&1 && pm2 save 2>&1` },
  ];
}

router.post("/system-health/deploy", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { host } = getSSHConfig();
    const localMode = isLocalMode();
    if (!host && !localMode) return res.status(400).json({ error: "VPS SSH credentials not configured and not in local/production mode" });

    if (activeDeployment.status === "running") {
      return res.status(409).json({ error: "A deployment is already in progress" });
    }

    const userEmail = req.user?.email || "unknown";
    const deploySteps = getDeploySteps();
    activeDeployment = {
      status: "running",
      step: 0,
      totalSteps: deploySteps.length,
      currentStep: deploySteps[0].label,
      log: [],
      startedAt: new Date().toISOString(),
      completedAt: null,
      triggeredBy: userEmail,
    };

    appendDeployLog(`DEPLOYMENT STARTED by ${userEmail} (mode: ${localMode ? "local" : "ssh"})`);
    broadcastSSE("deploy-start", { ...activeDeployment });

    res.json({ message: "Deployment started", deployment: activeDeployment });

    (async () => {
      for (let i = 0; i < deploySteps.length; i++) {
        const step = deploySteps[i];
        activeDeployment.step = i + 1;
        activeDeployment.currentStep = step.label;
        activeDeployment.log.push(`[Step ${i + 1}/${deploySteps.length}] ${step.label}...`);
        broadcastSSE("deploy-progress", { step: i + 1, total: deploySteps.length, label: step.label, status: "running" });
        appendDeployLog(`  Step ${i + 1}: ${step.label} - STARTED`);

        const result = await executeCommand(step.cmd, 120000);

        if (result.code !== 0 && result.code !== -1) {
          activeDeployment.status = "failed";
          activeDeployment.completedAt = new Date().toISOString();
          activeDeployment.log.push(`  FAILED: ${result.stderr || result.stdout}`);
          broadcastSSE("deploy-progress", { step: i + 1, total: deploySteps.length, label: step.label, status: "failed", output: result.stderr || result.stdout });
          appendDeployLog(`  Step ${i + 1}: ${step.label} - FAILED: ${result.stderr}`);
          appendDeployLog(`DEPLOYMENT FAILED at step ${i + 1}`);
          broadcastSSE("deploy-complete", { status: "failed", step: i + 1 });
          return;
        }

        const output = result.stdout.split("\n").slice(-5).join("\n");
        activeDeployment.log.push(`  OK: ${output}`);
        broadcastSSE("deploy-progress", { step: i + 1, total: deploySteps.length, label: step.label, status: "success", output });
        appendDeployLog(`  Step ${i + 1}: ${step.label} - SUCCESS`);
      }

      activeDeployment.status = "success";
      activeDeployment.completedAt = new Date().toISOString();
      appendDeployLog(`DEPLOYMENT COMPLETED SUCCESSFULLY`);
      broadcastSSE("deploy-complete", { status: "success", completedAt: activeDeployment.completedAt });
    })().catch(err => {
      activeDeployment.status = "failed";
      activeDeployment.completedAt = new Date().toISOString();
      activeDeployment.log.push(`ERROR: ${err.message}`);
      appendDeployLog(`DEPLOYMENT ERROR: ${err.message}`);
      broadcastSSE("deploy-complete", { status: "failed", error: err.message });
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/system-health/deploy/status", async (req: AuthenticatedRequest, res: Response) => {
  res.json({ deployment: activeDeployment });
});

router.get("/system-health/deploy/logs", async (req: AuthenticatedRequest, res: Response) => {
  const lines = parseInt(req.query.lines as string) || 100;
  res.json({ logs: readDeployLogs(lines) });
});

export default router;
