import { Router, Request, Response } from "express";
import { exec } from "child_process";
import { promisify } from "util";

const router = Router();
const execAsync = promisify(exec);

// Public endpoint for viewing logs (no auth required for debugging)
router.get("/deployment", async (req: Request, res: Response) => {
  try {
    const lines = parseInt(req.query.lines as string) || 100;
    
    // Get Docker logs
    const { stdout: appLogs } = await execAsync(`docker logs auditwise-app --tail ${lines} 2>&1`);
    const { stdout: dbLogs } = await execAsync(`docker logs auditwise-db --tail 50 2>&1`);
    
    // Get container status
    const { stdout: containerStatus } = await execAsync(`docker compose ps`);
    
    // Get system info
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
    .status-badge {
      display: inline-block;
      padding: 5px 15px;
      border-radius: 3px;
      font-weight: bold;
      margin-bottom: 10px;
    }
    .status-running { background: #4ec9b0; color: #000; }
    .status-stopped { background: #f48771; color: #000; }
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
    .auto-refresh {
      display: inline-block;
      margin-left: 20px;
      color: #858585;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🚀 AuditWise Deployment Logs</h1>
    
    <button class="refresh-btn" onclick="location.reload()">🔄 Refresh Logs</button>
    <span class="auto-refresh">Auto-refresh every 30s</span>
    
    <div class="info-grid">
      <div class="info-card">
        <h3>📊 Container Status</h3>
        <pre>${containerStatus}</pre>
      </div>
      <div class="info-card">
        <h3>💾 Disk Space</h3>
        <pre>${diskSpace}</pre>
      </div>
      <div class="info-card">
        <h3>🧠 Memory</h3>
        <pre>${memory}</pre>
      </div>
    </div>

    <h2>📝 Application Logs (Last ${lines} lines)</h2>
    <div class="log-box">
      <pre>${appLogs || 'No logs available'}</pre>
    </div>

    <h2>🗄️ Database Logs (Last 50 lines)</h2>
    <div class="log-box">
      <pre>${dbLogs || 'No logs available'}</pre>
    </div>

    <h2>📋 Quick Commands</h2>
    <div class="log-box">
      <pre>View more logs: GET /api/logs/deployment?lines=500

Restart containers: docker compose restart
View container status: docker compose ps
View build logs: docker compose logs --tail=100 -f
Stop all: docker compose down
Start all: docker compose up -d

SSH to server: ssh auditwise@${process.env.SSH_HOST || 'your-server'}
      </pre>
    </div>
  </div>

  <script>
    // Auto-refresh every 30 seconds
    setTimeout(() => location.reload(), 30000);
    
    // Highlight errors and warnings
    document.querySelectorAll('.log-box pre').forEach(pre => {
      let html = pre.innerHTML;
      html = html.replace(/error|failed|fatal/gi, '<span class="error">$&</span>');
      html = html.replace(/warn|warning/gi, '<span class="warning">$&</span>');
      html = html.replace(/success|completed|started/gi, '<span class="success">$&</span>');
      html = html.replace(/\\d{1,2}:\\d{2}:\\d{2}/g, '<span class="timestamp">$&</span>');
      pre.innerHTML = html;
    });
  </script>
</body>
</html>
    `;
    
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error: any) {
    res.status(500).send(`
      <html>
        <body style="font-family: monospace; background: #1e1e1e; color: #f48771; padding: 20px;">
          <h1>❌ Error Fetching Logs</h1>
          <pre>${error.message}</pre>
          <p style="color: #858585;">Make sure Docker is running and containers are accessible.</p>
        </body>
      </html>
    `);
  }
});

// API endpoint for raw logs (JSON)
router.get("/raw", async (req: Request, res: Response) => {
  try {
    const lines = parseInt(req.query.lines as string) || 100;
    const { stdout: appLogs } = await execAsync(`docker logs auditwise-app --tail ${lines} 2>&1`);
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

// Stream logs (SSE)
router.get("/stream", (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendLogs = async () => {
    try {
      const { stdout } = await execAsync(`docker logs auditwise-app --tail 50 2>&1`);
      res.write(`data: ${JSON.stringify({ logs: stdout, timestamp: new Date().toISOString() })}\n\n`);
    } catch (error: any) {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    }
  };

  // Send logs every 5 seconds
  const interval = setInterval(sendLogs, 5000);
  sendLogs(); // Send immediately

  req.on('close', () => {
    clearInterval(interval);
  });
});

export default router;
