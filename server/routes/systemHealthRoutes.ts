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
  const username = process.env.VPS_SSH_USER || process.env.VPS_USER || "root";
  const password = process.env.VPS_SSH_PASSWORD;
  const port = parseInt(process.env.VPS_SSH_PORT || "22");

  let privateKey = process.env.VPS_SSH_PRIVATE_KEY || process.env.VPS_SSH_KEY || "";

  if (!privateKey || !privateKey.includes("BEGIN")) {
    const keyPaths = [
      path.join(os.homedir(), ".ssh", "vps_key"),
      "/tmp/replit_deploy_key",
    ];
    for (const kp of keyPaths) {
      try {
        const content = fs.readFileSync(kp, "utf-8");
        if (content.includes("BEGIN")) {
          privateKey = content;
          break;
        }
      } catch {}
    }
  }

  return { host, username, password, privateKey: privateKey || undefined, port };
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
    const entries = Object.entries(commands);
    const separator = "___CMD_SEP___";
    const combined = entries.map(([key, cmd]) => `echo '${separator}${key}'; (${cmd}) 2>&1; echo '${separator}RC_${key}='$?`).join("; ");
    const batchResult = await executeSSH(combined, 30000);
    if (batchResult.code === -1 || batchResult.code === -2) {
      for (const [key] of entries) {
        results[key] = { stdout: "", stderr: batchResult.stderr, code: batchResult.code };
      }
    } else {
      const sections = batchResult.stdout.split(separator);
      const rcMap: Record<string, number> = {};
      for (const section of sections) {
        const rcMatch = section.match(/^RC_(\w+)=(\d+)/);
        if (rcMatch) {
          rcMap[rcMatch[1]] = parseInt(rcMatch[2]);
          continue;
        }
        if (!section.trim()) continue;
        const lines = section.split("\n");
        const key = lines[0]?.trim();
        if (key && entries.some(([k]) => k === key)) {
          const output = lines.slice(1).join("\n").trim().replace(/\n___CMD_SEP___RC_\w+=\d+$/, "");
          results[key] = { stdout: output, stderr: "", code: 0 };
        }
      }
      for (const [key] of entries) {
        if (results[key] && rcMap[key] !== undefined) {
          results[key].code = rcMap[key];
        }
        if (!results[key]) {
          results[key] = { stdout: "", stderr: "Command output not captured", code: -1 };
        }
      }
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

function normalizeServiceStatus(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.startsWith("up ") || lower.includes("accepting") || lower === "active") return "active";
  if (lower.includes("exited") || lower.includes("dead") || lower === "inactive") return "inactive";
  if (lower === "" || lower === "inactive") return "inactive";
  if (lower.includes("200") || lower.includes("301") || lower.includes("302")) return "active";
  return raw;
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
      nginxStatus: "docker ps --filter 'name=nginx' --format '{{.Status}}' 2>/dev/null | head -1 || (curl -sf -o /dev/null -w '%{http_code}' http://127.0.0.1:80/ 2>/dev/null && echo 'active' || echo 'inactive')",
      postgresStatus: "docker exec auditwise-db pg_isready -U auditwise -h localhost 2>/dev/null && echo 'active' || (docker ps --filter 'name=db' --format '{{.Status}}' 2>/dev/null | head -1) || echo 'inactive'",
      dockerContainers: "docker ps -a --format '{{.Names}}|{{.Status}}|{{.Ports}}' 2>/dev/null || echo ''",
      publicIp: "curl -sf -4 --max-time 3 https://api.ipify.org 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || echo ''",
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

    const publicIp = results.publicIp?.stdout?.trim();
    const serverIp = publicIp || host || (os.networkInterfaces()?.eth0?.[0]?.address || os.hostname());

    res.json({
      connected: true,
      mode: localMode ? "local" : "ssh",
      timestamp: new Date().toISOString(),
      server: { hostname: results.hostname.stdout, ip: serverIp, os: results.osRelease.stdout, kernel: results.kernelVersion.stdout, uptime: uptimeData.uptime, loadAverage: uptimeData.loadAvg, users: uptimeData.users },
      resources: { cpu: { usagePercent: cpuUsage, cores: parseInt(results.cpuCores.stdout) || 1 }, memory: memoryData, disk: diskData },
      git: gitInfo,
      application: { pm2Processes: pm2Data.length > 0 ? pm2Data : pm2TableProcesses, nodeVersion: results.nodeVersion.stdout, npmVersion: results.npmVersion.stdout, dockerContainers },
      services: {
        nginx: normalizeServiceStatus(results.nginxStatus.stdout.trim()),
        postgresql: normalizeServiceStatus(results.postgresStatus.stdout.trim()),
      },
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

    const selfUrl = `http://localhost:${process.env.PORT || 5000}`;
    const appUrl = process.env.VPS_APP_URL || (localMode ? selfUrl : `https://${host}`);
    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(`${selfUrl}/api/health`, { signal: controller.signal, headers: { "User-Agent": "AuditWise-HealthCheck/1.0" } });
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
  const isDocker = process.env.DOCKER_DEPLOY === "true" || fs.existsSync("/.dockerenv");
  if (isDocker) {
    return [
      { id: "pull", label: "Git Pull", cmd: `cd ${appDir} && git fetch --all --prune -q && git reset --hard origin/main -q && git log --oneline -1 2>&1` },
      { id: "deps", label: "Install Dependencies", cmd: `cd ${appDir} && echo 'Dependencies installed during Docker build' 2>&1` },
      { id: "build", label: "Build & Rebuild Containers", cmd: `cd ${appDir} && docker compose build --no-cache backend 2>&1` },
      { id: "migrate", label: "Database Migration", cmd: `cd ${appDir} && docker compose exec backend npx prisma db push --accept-data-loss 2>&1 || echo 'Migration handled by entrypoint' 2>&1` },
      { id: "restart", label: "Restart Containers", cmd: `cd ${appDir} && docker compose up -d --force-recreate --remove-orphans backend 2>&1` },
    ];
  }
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

router.post("/system-health/deploy/step/:stepId", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { host } = getSSHConfig();
    const localMode = isLocalMode();
    if (!host && !localMode) return res.status(400).json({ error: "Not connected to server" });

    if (activeDeployment.status === "running") {
      return res.status(409).json({ error: "A deployment is already in progress" });
    }

    const { stepId } = req.params;
    const allSteps = getDeploySteps();
    const step = allSteps.find(s => s.id === stepId);
    if (!step) return res.status(400).json({ error: `Unknown step: ${stepId}` });

    const stepIndex = allSteps.indexOf(step);
    const userEmail = req.user?.email || "unknown";

    activeDeployment = {
      status: "running",
      step: stepIndex + 1,
      totalSteps: allSteps.length,
      currentStep: step.label,
      log: [],
      startedAt: new Date().toISOString(),
      completedAt: null,
      triggeredBy: userEmail,
    };

    appendDeployLog(`SINGLE STEP [${step.id}] STARTED by ${userEmail}`);
    broadcastSSE("deploy-progress", { step: stepIndex + 1, total: allSteps.length, label: step.label, status: "running" });

    res.json({ message: `Running step: ${step.label}`, step: step.id });

    (async () => {
      const result = await executeCommand(step.cmd, 180000);
      const output = result.stdout.split("\n").slice(-10).join("\n");

      if (result.code !== 0 && result.code !== -1) {
        activeDeployment.status = "failed";
        activeDeployment.completedAt = new Date().toISOString();
        activeDeployment.log.push(`FAILED: ${result.stderr || result.stdout}`);
        broadcastSSE("deploy-progress", { step: stepIndex + 1, total: allSteps.length, label: step.label, status: "failed", output: result.stderr || output });
        appendDeployLog(`  Step [${step.id}] FAILED: ${result.stderr}`);
        broadcastSSE("deploy-complete", { status: "failed", step: stepIndex + 1 });
      } else {
        activeDeployment.status = "success";
        activeDeployment.completedAt = new Date().toISOString();
        activeDeployment.log.push(`OK: ${output}`);
        broadcastSSE("deploy-progress", { step: stepIndex + 1, total: allSteps.length, label: step.label, status: "success", output });
        appendDeployLog(`  Step [${step.id}] SUCCESS`);
        broadcastSSE("deploy-complete", { status: "success", completedAt: activeDeployment.completedAt });
      }
    })().catch(err => {
      activeDeployment.status = "failed";
      activeDeployment.completedAt = new Date().toISOString();
      broadcastSSE("deploy-complete", { status: "failed", error: err.message });
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/system-health/service/:action", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { host } = getSSHConfig();
    const localMode = isLocalMode();
    if (!host && !localMode) return res.status(400).json({ error: "Not connected to server" });

    const { action } = req.params;
    const { service } = req.body;
    if (!service) return res.status(400).json({ error: "Service name required" });

    const appDir = process.env.APP_DIR || "/opt/auditwise";
    let cmd = "";

    const containerNames = ["auditwise-backend", "auditwise-frontend", "auditwise-nginx", "auditwise-db", "auditwise-redis"];
    const isDockerService = containerNames.some(c => service.toLowerCase().includes(c.replace("auditwise-", "")));

    if (isDockerService) {
      const containerName = containerNames.find(c => service.toLowerCase().includes(c.replace("auditwise-", ""))) || service;
      if (action === "restart") {
        cmd = `cd ${appDir} && docker compose up -d --force-recreate ${containerName.replace("auditwise-", "")} 2>&1`;
      } else if (action === "start") {
        cmd = `cd ${appDir} && docker compose up -d ${containerName.replace("auditwise-", "")} 2>&1`;
      } else if (action === "stop") {
        cmd = `cd ${appDir} && docker compose stop ${containerName.replace("auditwise-", "")} 2>&1`;
      } else if (action === "logs") {
        cmd = `cd ${appDir} && docker compose logs --tail 50 ${containerName.replace("auditwise-", "")} 2>&1`;
      } else {
        return res.status(400).json({ error: `Unknown action: ${action}` });
      }
    } else {
      if (action === "restart") {
        cmd = `systemctl restart ${service} 2>&1`;
      } else if (action === "start") {
        cmd = `systemctl start ${service} 2>&1`;
      } else if (action === "stop") {
        cmd = `systemctl stop ${service} 2>&1`;
      } else {
        return res.status(400).json({ error: `Unknown action: ${action}` });
      }
    }

    const userEmail = req.user?.email || "unknown";
    appendDeployLog(`SERVICE ACTION: ${action} ${service} by ${userEmail}`);

    const result = await executeCommand(cmd, 60000);
    res.json({
      success: result.code === 0,
      output: result.stdout || result.stderr,
      action,
      service,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/system-health/probe/:probe", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { host } = getSSHConfig();
    const localMode = isLocalMode();
    if (!host && !localMode) return res.status(400).json({ error: "Not connected to server" });

    const { probe } = req.params;
    let result: { ok: boolean; detail: string } = { ok: false, detail: "Unknown probe" };

    const domain = process.env.DOMAIN_NAME || "auditwise.tech";

    if (probe === "http") {
      const startTime = Date.now();
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const response = await fetch(`https://${domain}/`, { signal: controller.signal });
        clearTimeout(timeout);
        result = { ok: response.status === 200, detail: `Status ${response.status}, ${Date.now() - startTime}ms` };
      } catch (e: any) {
        result = { ok: false, detail: e.message };
      }
    } else if (probe === "api") {
      const startTime = Date.now();
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const response = await fetch(`https://${domain}/api/health`, { signal: controller.signal });
        clearTimeout(timeout);
        const body = await response.json().catch(() => ({}));
        result = { ok: response.status === 200, detail: `Status ${response.status}, ${Date.now() - startTime}ms${body.status ? ` (${body.status})` : ""}` };
      } catch (e: any) {
        result = { ok: false, detail: e.message };
      }
    } else if (probe === "database") {
      const cmdResult = await executeCommand("docker exec auditwise-db pg_isready -U auditwise -d auditwise -h localhost 2>/dev/null && echo 'accepting connections'");
      if (cmdResult.stdout.includes("accepting")) {
        result = { ok: true, detail: "PostgreSQL accepting connections" };
      } else {
        result = { ok: false, detail: cmdResult.stderr || cmdResult.stdout || "Database not responding" };
      }
    } else if (probe === "nginx") {
      const cmdResult = await executeCommand("docker ps --filter 'name=nginx' --format '{{.Status}}' 2>/dev/null | head -1");
      const status = cmdResult.stdout.trim().toLowerCase();
      if (status.startsWith("up ") && status.includes("healthy")) {
        result = { ok: true, detail: `Nginx container: ${cmdResult.stdout.trim()}` };
      } else if (status.startsWith("up ")) {
        result = { ok: true, detail: `Nginx container running: ${cmdResult.stdout.trim()}` };
      } else {
        const curlResult = await executeCommand("curl -sf -o /dev/null -w '%{http_code}' http://127.0.0.1:80/ 2>/dev/null");
        const code = curlResult.stdout.trim();
        if (code === "200" || code === "301" || code === "302") {
          result = { ok: true, detail: `Nginx responding (HTTP ${code})` };
        } else {
          result = { ok: false, detail: status ? `Container: ${status}` : "Nginx not responding" };
        }
      }
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ ok: false, detail: error.message });
  }
});

export default router;
