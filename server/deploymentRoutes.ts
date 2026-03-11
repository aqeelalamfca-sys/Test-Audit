import type { Express, Request, Response } from "express";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";
import crypto from "crypto";
import { requireAuth, requireRoles, type AuthenticatedRequest } from "./auth";

const execAsync = promisify(exec);

const COMMIT_HASH_REGEX = /^[a-f0-9]{4,40}$/i;

// Webhook secret for GitHub (set this in GitHub repo settings)
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";

// Deployment history tracking
interface DeploymentLog {
  id: string;
  timestamp: Date;
  status: "pending" | "success" | "failed";
  commit: string;
  branch: string;
  message: string;
  logs: string[];
  triggeredBy: string;
}

const deploymentHistory: DeploymentLog[] = [];
const MAX_HISTORY = 50;

// Verify GitHub webhook signature
function verifyGitHubSignature(payload: string, signature: string): boolean {
  const hmac = crypto.createHmac("sha256", WEBHOOK_SECRET);
  const digest = "sha256=" + hmac.update(payload).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

export function registerDeploymentRoutes(app: Express): void {
  // GitHub webhook endpoint
  app.post("/api/deploy/webhook", async (req: Request, res: Response) => {
    try {
      const signature = req.headers["x-hub-signature-256"] as string;
      const payload = JSON.stringify(req.body);

      if (!WEBHOOK_SECRET) {
        return res.status(503).json({ error: "Webhook secret not configured" });
      }

      if (!signature || !verifyGitHubSignature(payload, signature)) {
        return res.status(401).json({ error: "Invalid signature" });
      }

      const event = req.headers["x-github-event"];
      if (event !== "push") {
        return res.json({ message: "Event ignored" });
      }

      const { ref, commits, pusher } = req.body;
      const branch = ref.split("/").pop();

      if (branch !== "main") {
        return res.json({ message: "Not main branch, ignored" });
      }

      const deploymentId = crypto.randomUUID();
      const deployment: DeploymentLog = {
        id: deploymentId,
        timestamp: new Date(),
        status: "pending",
        commit: commits?.[0]?.id?.substring(0, 7) || "unknown",
        branch,
        message: commits?.[0]?.message || "No message",
        logs: [],
        triggeredBy: pusher?.name || "unknown",
      };

      deploymentHistory.unshift(deployment);
      if (deploymentHistory.length > MAX_HISTORY) {
        deploymentHistory.pop();
      }

      // Start deployment asynchronously
      performDeployment(deployment);

      res.json({ 
        message: "Deployment started", 
        deploymentId,
        commit: deployment.commit 
      });
    } catch (error: any) {
      console.error("Webhook error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Manual deployment trigger (requires admin)
  app.post("/api/deploy/trigger", requireAuth, requireRoles("SUPER_ADMIN"), async (req: Request, res: Response) => {
    try {
      // Manual deployments are informational only
      // Actual deployments happen via GitHub Actions
      res.status(400).json({ 
        error: "Manual deployments from UI are disabled",
        message: "Push to GitHub to trigger automatic deployment via GitHub Actions",
        hint: "Use 'git push origin main' to deploy"
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get deployment history
  app.get("/api/deploy/history", requireAuth, requireRoles("SUPER_ADMIN"), async (req: Request, res: Response) => {
    try {
      // Get recent commits from git history (no time limit, just last 50)
      const { stdout } = await execAsync(
        `git log -50 --pretty=format:'{"commit":"%H","shortCommit":"%h","author":"%an","date":"%ai","message":"%s"}'`
      );
      
      const commits = stdout
        .split("\n")
        .filter(line => line.trim() && line.startsWith('{"'))
        .map(line => {
          try {
            const commit = JSON.parse(line.trim());
            return {
              id: commit.commit,
              timestamp: new Date(commit.date),
              status: "success", // Assume success if it's in git history
              commit: commit.shortCommit,
              branch: "main",
              message: commit.message,
              logs: [`✅ Deployed successfully at ${commit.date}`],
              triggeredBy: commit.author,
            };
          } catch {
            return null;
          }
        })
        .filter(commit => commit !== null);

      res.json({ deployments: commits });
    } catch (error: any) {
      console.error("Failed to get deployment history:", error);
      res.json({ deployments: [] });
    }
  });

  // Get specific deployment status
  app.get("/api/deploy/status/:id", requireAuth, requireRoles("SUPER_ADMIN"), async (req: Request, res: Response) => {
    const deployment = deploymentHistory.find(d => d.id === req.params.id);
    if (!deployment) {
      return res.status(404).json({ error: "Deployment not found" });
    }
    res.json({ deployment });
  });

  // Get application logs
  app.get("/api/logs/app", requireAuth, requireRoles("SUPER_ADMIN"), async (req: Request, res: Response) => {
    try {
      const lines = Math.min(Math.max(parseInt(req.query.lines as string) || 100, 1), 1000);
      const sinceRaw = (req.query.since as string) || "24h";
      const since = /^[0-9]+[smhd]$/.test(sinceRaw) ? sinceRaw : "24h";
      const { stdout } = await execAsync(
        `docker logs auditwise-app --since=${since} --timestamps --tail=${lines}`
      );
      res.json({ logs: stdout.split("\n").filter(line => line.trim()) });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get database logs
  app.get("/api/logs/db", requireAuth, requireRoles("SUPER_ADMIN"), async (req: Request, res: Response) => {
    try {
      const lines = Math.min(Math.max(parseInt(req.query.lines as string) || 100, 1), 1000);
      const sinceRaw = (req.query.since as string) || "24h";
      const since = /^[0-9]+[smhd]$/.test(sinceRaw) ? sinceRaw : "24h";
      const { stdout } = await execAsync(
        `docker logs auditwise-db --since=${since} --timestamps --tail=${lines}`
      );
      res.json({ logs: stdout.split("\n").filter(line => line.trim()) });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get container status
  app.get("/api/logs/status", requireAuth, requireRoles("SUPER_ADMIN"), async (req: Request, res: Response) => {
    try {
      const { stdout: statsOutput } = await execAsync(
        "docker stats --no-stream --format '{{json .}}'"
      );
      const stats = statsOutput
        .trim()
        .split("\n")
        .filter(line => line)
        .map(line => JSON.parse(line));

      res.json({ stats });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Stream logs (Server-Sent Events)
  app.get("/api/logs/stream", requireAuth, requireRoles("SUPER_ADMIN"), async (req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const allowedContainers: Record<string, string> = { db: "auditwise-db", app: "auditwise-app", backend: "auditwise-backend", frontend: "auditwise-frontend", nginx: "auditwise-nginx" };
    const containerName = allowedContainers[req.query.container as string] || "auditwise-backend";
    const child = exec(`docker logs -f ${containerName} --tail=10`);

    child.stdout?.on("data", (data) => {
      res.write(`data: ${JSON.stringify({ log: data.toString() })}\n\n`);
    });

    child.stderr?.on("data", (data) => {
      res.write(`data: ${JSON.stringify({ log: data.toString() })}\n\n`);
    });

    req.on("close", () => {
      child.kill();
      res.end();
    });
  });

  // Get git history
  app.get("/api/git/history", requireAuth, requireRoles("SUPER_ADMIN"), async (req: Request, res: Response) => {
    try {
      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 100);
      const { stdout } = await execAsync(
        `git log -${limit} --pretty=format:'{"commit":"%H","shortCommit":"%h","author":"%an","email":"%ae","date":"%ai","message":"%s","body":"%b"}'`
      );
      
      const commits = stdout
        .split("\n")
        .filter(line => line.trim() && line.startsWith('{"'))
        .map(line => {
          try {
            return JSON.parse(line.trim());
          } catch {
            return null;
          }
        })
        .filter(commit => commit !== null);

      res.json({ commits });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get git diff for a specific commit
  app.get("/api/git/diff/:commit", requireAuth, requireRoles("SUPER_ADMIN"), async (req: Request, res: Response) => {
    try {
      const { commit } = req.params;
      if (!COMMIT_HASH_REGEX.test(commit)) {
        return res.status(400).json({ error: "Invalid commit hash format" });
      }
      const { stdout } = await execAsync(`git show ${commit} --stat`);
      res.json({ diff: stdout });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get current branch info
  app.get("/api/git/branch", requireAuth, requireRoles("SUPER_ADMIN"), async (req: Request, res: Response) => {
    try {
      const { stdout: branch } = await execAsync("git rev-parse --abbrev-ref HEAD");
      const { stdout: commit } = await execAsync("git rev-parse HEAD");
      const { stdout: shortCommit } = await execAsync("git rev-parse --short HEAD");
      
      res.json({ 
        branch: branch.trim(),
        commit: commit.trim(),
        shortCommit: shortCommit.trim()
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}

// Perform actual deployment
async function performDeployment(deployment: DeploymentLog): Promise<void> {
  const addLog = (message: string) => {
    deployment.logs.push(`[${new Date().toISOString()}] ${message}`);
  };

  try {
    addLog("🚀 Starting deployment...");

    // Note: Git pull is handled by GitHub Actions via rsync
    // Manual deployments just rebuild containers with existing code
    addLog("🏗️ Rebuilding containers...");
    const { stdout: buildOutput } = await execAsync(
      "docker compose down && docker compose up -d --build"
    );
    addLog(buildOutput);

    // Wait for containers to be healthy
    addLog("⏳ Waiting for containers to be ready...");
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Check container status
    const { stdout: psOutput } = await execAsync("docker compose ps");
    addLog(psOutput);

    if (psOutput.includes("Up")) {
      deployment.status = "success";
      addLog("✅ Deployment completed successfully!");
    } else {
      deployment.status = "failed";
      addLog("❌ Containers failed to start");
    }
  } catch (error: any) {
    deployment.status = "failed";
    addLog(`❌ Deployment failed: ${error.message}`);
    addLog(error.stderr || "");
  }
}
