#!/bin/bash
set -euo pipefail

echo "========================================"
echo "  AuditWise Diagnostics"
echo "  $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "========================================"
echo ""

echo "[1/5] Container Status"
docker compose ps 2>/dev/null || echo "docker compose not available"
echo ""

echo "[2/5] App Container Logs (last 200 lines)"
echo "----------------------------------------"
docker logs auditwise-backend --tail 200 2>&1 || echo "Backend container not running"
echo ""

echo "[3/5] Frontend + Nginx Logs (last 100 lines each)"
echo "----------------------------------------"
docker logs auditwise-frontend --tail 100 2>&1 || echo "Frontend container not running"
echo ""
docker logs auditwise-nginx --tail 100 2>&1 || echo "Nginx container not running"
echo ""

echo "[4/5] DB Container Logs (last 50 lines)"
echo "----------------------------------------"
docker logs auditwise-db --tail 50 2>&1 || echo "Container not running"
echo ""

echo "[5/5] Docker Build Cache"
echo "----------------------------------------"
docker system df 2>/dev/null || echo "Docker not available"
echo ""

echo "========================================"
echo "  Diagnostics complete"
echo "========================================"
