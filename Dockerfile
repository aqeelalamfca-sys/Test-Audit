# =============================================================
# AuditWise — Combined Dockerfile (Legacy / Single-Container)
# For the 4-service architecture, use:
#   docker/backend.Dockerfile  — Express API (port 5000)
#   docker/frontend.Dockerfile — React app (port 3000)
# =============================================================

FROM node:20-slim AS base
RUN apt-get update && apt-get install -y openssl ca-certificates curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then \
      npm ci --maxsockets 5; \
    else \
      npm install --maxsockets 5; \
    fi
COPY prisma ./prisma/
RUN NODE_OPTIONS="--max-old-space-size=2048" npx prisma generate

FROM deps AS build
COPY . .
ENV NODE_ENV=production
RUN NODE_OPTIONS="--max-old-space-size=2048" npm run build
RUN cp -rn public/* dist/public/ 2>/dev/null || true
RUN ls -la dist/index.cjs dist/public/index.html

FROM base AS proddeps
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then \
      npm ci --omit=dev --maxsockets 5; \
    else \
      npm install --omit=dev --maxsockets 5; \
    fi
COPY prisma ./prisma/
RUN NODE_OPTIONS="--max-old-space-size=2048" npx prisma generate

FROM base AS production
ENV NODE_ENV=production
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser

COPY --from=proddeps /app/node_modules ./node_modules
COPY --from=proddeps /app/prisma ./prisma
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
COPY docker/docker-entrypoint.sh ./docker-entrypoint.sh

RUN mkdir -p uploads/logos uploads/notifications logs && \
    chmod +x docker-entrypoint.sh && \
    chown -R appuser:appgroup /app

USER appuser

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
