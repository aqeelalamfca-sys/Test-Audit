import { Router, type Response } from "express";
import { requireAuth, type AuthenticatedRequest } from "../auth";
import { requireSuperAdmin } from "../middleware/rbacGuard";
import { Client } from "ssh2";

const router = Router();

router.use(requireAuth);
router.use(requireSuperAdmin);

interface SSHCommandResult {
  stdout: string;
  stderr: string;
  code: number;
}

function executeSSH(command: string): Promise<SSHCommandResult> {
  return new Promise((resolve, reject) => {
    const host = process.env.VPS_SSH_HOST || process.env.VPS_HOST;
    const username = process.env.VPS_SSH_USER || "root";
    const password = process.env.VPS_SSH_PASSWORD;
    const privateKey = process.env.VPS_SSH_PRIVATE_KEY;
    const port = parseInt(process.env.VPS_SSH_PORT || "22");

    if (!host) {
      return resolve({ stdout: "", stderr: "SSH host not configured", code: -1 });
    }

    const conn = new Client();
    let stdout = "";
    let stderr = "";

    const timeout = setTimeout(() => {
      conn.end();
      resolve({ stdout, stderr: "Connection timeout", code: -2 });
    }, 15000);

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

async function runMultipleCommands(commands: Record<string, string>): Promise<Record<string, SSHCommandResult>> {
  const results: Record<string, SSHCommandResult> = {};
  const entries = Object.entries(commands);

  for (const [key, cmd] of entries) {
    results[key] = await executeSSH(cmd);
  }
  return results;
}

function parseUptime(raw: string): { uptime: string; loadAvg: string; users: string } {
  const match = raw.match(/up\s+(.+?),\s+(\d+)\s+user.*load average:\s*(.+)/);
  if (match) {
    return { uptime: match[1].trim(), users: match[2], loadAvg: match[3].trim() };
  }
  return { uptime: raw, loadAvg: "N/A", users: "0" };
}

function parseMemory(raw: string): { total: string; used: string; free: string; usagePercent: number } {
  const lines = raw.split("\n");
  const memLine = lines.find(l => l.startsWith("Mem:"));
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

function parseDisk(raw: string): { total: string; used: string; avail: string; usagePercent: number; mountPoint: string } {
  const lines = raw.split("\n");
  const rootLine = lines.find(l => l.endsWith("/") || l.includes("/dev/"));
  if (rootLine) {
    const parts = rootLine.split(/\s+/);
    return {
      total: parts[1] || "N/A",
      used: parts[2] || "N/A",
      avail: parts[3] || "N/A",
      usagePercent: parseInt(parts[4] || "0"),
      mountPoint: parts[5] || "/",
    };
  }
  return { total: "N/A", used: "N/A", avail: "N/A", usagePercent: 0, mountPoint: "/" };
}

function parsePM2(raw: string): Array<{ name: string; id: string; mode: string; pid: string; status: string; restarts: string; uptime: string; cpu: string; mem: string }> {
  const lines = raw.split("\n").filter(l => l.includes("│") && !l.includes("─") && !l.includes("id") && !l.includes("name"));
  return lines.map(line => {
    const cells = line.split("│").map(c => c.trim()).filter(Boolean);
    if (cells.length >= 9) {
      return {
        id: cells[0], name: cells[1], mode: cells[3] || "N/A",
        pid: cells[4] || "N/A", status: cells[5] || "N/A",
        restarts: cells[6] || "0", uptime: cells[7] || "N/A",
        cpu: cells[8] || "0%", mem: cells[9] || "0mb",
      };
    }
    return null;
  }).filter(Boolean) as any[];
}

function parseCPU(raw: string): { usagePercent: number; cores: number } {
  try {
    const lines = raw.split("\n").filter(Boolean);
    const idleLine = lines.find(l => l.includes("all"));
    if (idleLine) {
      const parts = idleLine.split(/\s+/);
      const idle = parseFloat(parts[parts.length - 1] || "0");
      return { usagePercent: Math.round(100 - idle), cores: lines.length - 1 };
    }
    return { usagePercent: 0, cores: 1 };
  } catch {
    return { usagePercent: 0, cores: 1 };
  }
}

router.get("/system-health", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const host = process.env.VPS_SSH_HOST || process.env.VPS_HOST;
    if (!host) {
      return res.json({
        connected: false,
        error: "VPS SSH credentials not configured. Set VPS_SSH_HOST, VPS_SSH_USER, and VPS_SSH_PASSWORD or VPS_SSH_PRIVATE_KEY in environment variables.",
        timestamp: new Date().toISOString(),
      });
    }

    const commands: Record<string, string> = {
      uptime: "uptime",
      memory: "free -h",
      disk: "df -h /",
      cpu: "mpstat 1 1 2>/dev/null || (top -bn1 | grep '%Cpu' | awk '{idle=$8} END {printf \"%.0f\", 100-idle}') || echo '0'",
      cpuCores: "nproc",
      pm2List: "pm2 jlist 2>/dev/null || echo '[]'",
      pm2Status: "pm2 list 2>/dev/null || echo 'PM2 not running'",
      gitRemote: "cd /opt/auditwise && git remote -v 2>/dev/null | head -2 || echo 'Not a git repo'",
      gitLog: "cd /opt/auditwise && git log -1 --format='%H|%s|%an|%ai' 2>/dev/null || echo 'No git history'",
      gitStatus: "cd /opt/auditwise && git status --short 2>/dev/null | head -20 || echo ''",
      gitBranch: "cd /opt/auditwise && git branch --show-current 2>/dev/null || echo 'unknown'",
      nodeVersion: "node --version 2>/dev/null || echo 'N/A'",
      npmVersion: "npm --version 2>/dev/null || echo 'N/A'",
      ufwStatus: "sudo ufw status 2>/dev/null || echo 'UFW not installed'",
      openPorts: "ss -tuln 2>/dev/null | grep LISTEN | head -20 || echo 'N/A'",
      sslCheck: "test -f /etc/letsencrypt/live/*/fullchain.pem && echo 'SSL Active' || echo 'No SSL'",
      cronJobs: "crontab -l 2>/dev/null || echo 'No crontab'",
      fetchHead: "stat -c '%y' /opt/auditwise/.git/FETCH_HEAD 2>/dev/null || echo 'Never fetched'",
      gitPullLog: "tail -20 /opt/auditwise/gitpull.log 2>/dev/null || echo 'No pull log'",
      hostname: "hostname 2>/dev/null || echo 'unknown'",
      osRelease: "cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d= -f2 | tr -d '\"' || echo 'Unknown OS'",
      kernelVersion: "uname -r 2>/dev/null || echo 'N/A'",
      nginxStatus: "systemctl is-active nginx 2>/dev/null || echo 'inactive'",
      postgresStatus: "systemctl is-active postgresql 2>/dev/null || echo 'inactive'",
    };

    const results = await runMultipleCommands(commands);

    const uptimeData = parseUptime(results.uptime.stdout);
    const memoryData = parseMemory(results.memory.stdout);
    const diskData = parseDisk(results.disk.stdout);
    const pm2Processes = parsePM2(results.pm2Status.stdout);

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
    try {
      pm2JSON = JSON.parse(results.pm2List.stdout);
    } catch {}

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

    const ufwLines = results.ufwStatus.stdout.split("\n").filter(l => l.trim().length > 0);

    const openPortLines = results.openPorts.stdout.split("\n").filter(l => l.trim().length > 0);
    const openPorts = openPortLines.map(l => {
      const parts = l.split(/\s+/);
      return { protocol: parts[0], address: parts[4] || parts[3], state: parts[parts.length - 1] };
    });

    const response = {
      connected: true,
      timestamp: new Date().toISOString(),
      server: {
        hostname: results.hostname.stdout,
        ip: host,
        os: results.osRelease.stdout,
        kernel: results.kernelVersion.stdout,
        uptime: uptimeData.uptime,
        loadAverage: uptimeData.loadAvg,
        users: uptimeData.users,
      },
      resources: {
        cpu: { usagePercent: cpuUsage, cores: parseInt(results.cpuCores.stdout) || 1 },
        memory: memoryData,
        disk: diskData,
      },
      git: gitInfo,
      application: {
        pm2Processes: pm2Data.length > 0 ? pm2Data : pm2Processes,
        nodeVersion: results.nodeVersion.stdout,
        npmVersion: results.npmVersion.stdout,
      },
      services: {
        nginx: results.nginxStatus.stdout.trim(),
        postgresql: results.postgresStatus.stdout.trim(),
      },
      security: {
        firewall: ufwLines,
        openPorts,
        ssl: results.sslCheck.stdout.trim(),
      },
      deployment: {
        cronJobs: results.cronJobs.stdout,
        lastFetch: results.fetchHead.stdout,
        pullLog: results.gitPullLog.stdout,
      },
    };

    res.json(response);
  } catch (error: any) {
    res.status(500).json({
      connected: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

router.get("/system-health/ping", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const host = process.env.VPS_SSH_HOST || process.env.VPS_HOST;
    if (!host) {
      return res.json({ reachable: false, error: "VPS host not configured" });
    }

    const appUrl = process.env.VPS_APP_URL || `https://${host}`;
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(`${appUrl}/api/auth/me`, {
        signal: controller.signal,
        headers: { "User-Agent": "AuditWise-HealthCheck/1.0" },
      });
      clearTimeout(timeout);

      return res.json({
        reachable: true,
        httpStatus: response.status,
        responseTime: Date.now() - startTime,
        url: appUrl,
      });
    } catch (fetchErr: any) {
      return res.json({
        reachable: false,
        error: fetchErr.message,
        responseTime: Date.now() - startTime,
        url: appUrl,
      });
    }
  } catch (error: any) {
    res.status(500).json({ reachable: false, error: error.message });
  }
});

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default router;
