FROM node:20-alpine AS base
RUN apk add --no-cache openssl curl bash ca-certificates
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

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=proddeps --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=proddeps --chown=appuser:appgroup /app/prisma ./prisma
COPY --from=build --chown=appuser:appgroup /app/dist ./dist
COPY --from=build --chown=appuser:appgroup /app/package.json ./
COPY --from=build --chown=appuser:appgroup /app/server/template-vault ./server/template-vault
COPY --chown=appuser:appgroup docker/docker-entrypoint.sh ./docker-entrypoint.sh

RUN curl -sS -o /app/rds-combined-ca-bundle.pem \
      "https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem" 2>/dev/null || true

RUN mkdir -p uploads/logos uploads/notifications logs && \
    chmod +x docker-entrypoint.sh && \
    chown -R appuser:appgroup uploads logs rds-combined-ca-bundle.pem 2>/dev/null || true

STOPSIGNAL SIGTERM

USER appuser

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=5 \
  CMD curl -sf http://localhost:5000/api/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
