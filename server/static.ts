import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");

  if (!fs.existsSync(distPath)) {
    console.warn(`[STATIC] Build directory not found: ${distPath}`);
    app.get("/", (_req, res) => {
      res.status(503).send(`<!DOCTYPE html><html><head><title>AuditWise</title></head><body>
        <h1>AuditWise</h1><p>Application is starting. Static files not found at ${distPath}.</p>
        <p>If this persists, rebuild the Docker image.</p></body></html>`);
    });
    return;
  }

  const indexPath = path.resolve(distPath, "index.html");
  if (!fs.existsSync(indexPath)) {
    console.warn(`[STATIC] index.html not found at: ${indexPath}`);
    app.get("/", (_req, res) => {
      res.status(503).send(`<!DOCTYPE html><html><head><title>AuditWise</title></head><body>
        <h1>AuditWise</h1><p>Frontend build incomplete. index.html missing.</p>
        <p>Rebuild with: docker compose up -d --build</p></body></html>`);
    });
    return;
  }

  console.log(`[STATIC] Serving frontend from ${distPath}`);

  app.get("/status", (_req, res) => {
    const healthPath = path.resolve(distPath, "health.html");
    if (fs.existsSync(healthPath)) {
      res.sendFile(healthPath);
    } else {
      res.redirect("/health");
    }
  });

  app.use(express.static(distPath, {
    maxAge: '1y',
    immutable: true,
    etag: true,
    index: false,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  }));

  app.use("*", (req, res, next) => {
    if (req.originalUrl.startsWith("/api/") || req.originalUrl.startsWith("/__healthz")) {
      return next();
    }
    res.sendFile(indexPath);
  });
}
