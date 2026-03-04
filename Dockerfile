FROM node:20-slim AS base
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then \
      npm ci --maxsockets 5; \
    else \
      echo "WARN: No lockfile found, using npm install"; \
      npm install --maxsockets 5; \
    fi
COPY prisma ./prisma/
RUN NODE_OPTIONS="--max-old-space-size=2048" npx prisma generate

FROM deps AS build
COPY . .
RUN NODE_OPTIONS="--max-old-space-size=2048" npm run build
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
COPY public ./public/
COPY docker-entrypoint.sh ./
RUN mkdir -p uploads/logos uploads/notifications && \
    chmod +x docker-entrypoint.sh && \
    chown -R appuser:appgroup /app
USER appuser
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
  CMD node -e "fetch('http://localhost:5000/health').then(r=>{if(!r.ok)throw 1}).catch(()=>process.exit(1))"
ENTRYPOINT ["./docker-entrypoint.sh"]
