import { Router, Request, Response } from "express";
import { exec } from "child_process";
import { promisify } from "util";
import { requireAuth, requireRoles, type AuthenticatedRequest } from "./auth";

const router = Router();
const execAsync = promisify(exec);

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

router.get("/deployment", requireAuth, requireRoles("SUPER_ADMIN"), async (req: Request, res: Response) => {
  try {
    const lines = Math.min(Math.max(parseInt(req.query.lines as string) || 100, 1), 1000);
    
    const { stdout: appLogs } = await execAsync(`docker logs auditwise-backend --tail ${lines} 2>&1`);
    const { stdout: dbLogs } = await execAsync(`docker logs auditwise-db --tail 50 2>&1`);
    const { stdout: containerStatus } = await execAsync(`docker compose ps`);
    const { stdout: diskSpace } = await execAsync(`df -h /`);
    const { stdout: memory } = await execAsync(`free -h`);
    
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AuditWise Deployment Logs</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Consolas', 'Monaco', monospace; 
      background: #1e1e1e; 
      color: #d4d4d4; 
      padding: 20px;
      line-height: 1.6;
    }
    .container { max-width: 1400px; margin: 0 auto; }
    h1 { 
      color: #4ec9b0; 
      margin-bottom: 20px; 
      font-size: 28px;
      border-bottom: 2px solid #4ec9b0;
      padding-bottom: 10px;
    }
    h2 { 
      color: #569cd6; 
      margin-top: 30px; 
      margin-bottom: 15px; 
      font-size: 20px;
    }
    .log-box { 
      background: #252526; 
      border: 1px solid #3e3e42; 
      border-radius: 5px; 
      padding: 15px; 
      margin-bottom: 20px;
      overflow-x: auto;
      max-height: 600px;
      overflow-y: auto;
    }
    .log-box pre { 
      margin: 0; 
      white-space: pre-wrap;
      word-wrap: break-word;
      font-size: 13px;
    }
    .error { color: #f48771; }
    .success { color: #4ec9b0; }
    .warning { color: #ce9178; }
    .timestamp { color: #858585; }
    .refresh-btn {
      background: #0e639c;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 5px;
      cursor: pointer;
      font-size: 14px;
      margin-bottom: 20px;
    }
    .refresh-btn:hover { background: #1177bb; }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .info-card {
      background: #252526;
      border: 1px solid #3e3e42;
      border-radius: 5px;
      padding: 15px;
    }
    .info-card h3 {
      color: #4ec9b0;
      margin-bottom: 10px;
      font-size: 16px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>AuditWise Deployment Logs</h1>
    
    <button class="refresh-btn" onclick="location.reload()">Refresh Logs</button>
    
    <div class="info-grid">
      <div class="info-card">
        <h3>Container Status</h3>
        <pre>${escapeHtml(containerStatus)}</pre>
      </div>
      <div class="info-card">
        <h3>Disk Space</h3>
        <pre>${escapeHtml(diskSpace)}</pre>
      </div>
      <div class="info-card">
        <h3>Memory</h3>
        <pre>${escapeHtml(memory)}</pre>
      </div>
    </div>

    <h2>Application Logs (Last ${lines} lines)</h2>
    <div class="log-box">
      <pre>${escapeHtml(appLogs || 'No logs available')}</pre>
    </div>

    <h2>Database Logs (Last 50 lines)</h2>
    <div class="log-box">
      <pre>${escapeHtml(dbLogs || 'No logs available')}</pre>
    </div>
  </div>
</body>
</html>
    `;
    
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error: any) {
    res.status(500).send(`
      <html>
        <body style="font-family: monospace; background: #1e1e1e; color: #f48771; padding: 20px;">
          <h1>Error Fetching Logs</h1>
          <pre>${escapeHtml(error.message)}</pre>
        </body>
      </html>
    `);
  }
});

router.get("/raw", requireAuth, requireRoles("SUPER_ADMIN"), async (req: Request, res: Response) => {
  try {
    const lines = Math.min(Math.max(parseInt(req.query.lines as string) || 100, 1), 1000);
    const { stdout: appLogs } = await execAsync(`docker logs auditwise-backend --tail ${lines} 2>&1`);
    const { stdout: containerStatus } = await execAsync(`docker compose ps`);
    
    res.json({
      timestamp: new Date().toISOString(),
      logs: appLogs,
      containerStatus: containerStatus,
      lines: lines
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/stream", requireAuth, requireRoles("SUPER_ADMIN"), (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendLogs = async () => {
    try {
      const { stdout } = await execAsync(`docker logs auditwise-backend --tail 50 2>&1`);
      res.write(`data: ${JSON.stringify({ logs: stdout, timestamp: new Date().toISOString() })}\n\n`);
    } catch (error: any) {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    }
  };

  const interval = setInterval(sendLogs, 5000);
  sendLogs();

  req.on('close', () => {
    clearInterval(interval);
  });
});

export default router;
