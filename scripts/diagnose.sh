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
docker logs auditwise-app --tail 200 2>&1 || echo "Container not running"
echo ""

echo "[3/5] DB Container Logs (last 50 lines)"
echo "----------------------------------------"
docker logs auditwise-db --tail 50 2>&1 || echo "Container not running"
echo ""

echo "[4/5] Docker Build Cache"
echo "----------------------------------------"
docker system df 2>/dev/null || echo "Docker not available"
echo ""

echo "[5/5] Resource Usage"
echo "----------------------------------------"
echo "Memory:"
free -h 2>/dev/null || echo "N/A"
echo ""
echo "Disk:"
df -h / 2>/dev/null || echo "N/A"
echo ""
echo "Docker containers:"
docker stats --no-stream 2>/dev/null || echo "No containers running"
echo ""

echo "========================================"
echo "  Diagnostics complete"
echo "========================================"
