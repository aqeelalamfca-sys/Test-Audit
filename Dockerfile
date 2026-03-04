FROM node:20-slim AS base
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then \
      npm ci --ignore-scripts --maxsockets 5; \
    else \
      echo "WARN: No lockfile found, using npm install"; \
      npm install --ignore-scripts --maxsockets 5; \
    fi
COPY prisma ./prisma/
RUN npx prisma generate

FROM deps AS build
COPY . .
RUN NODE_OPTIONS="--max-old-space-size=2048" npx vite build --outDir dist/public
RUN NODE_OPTIONS="--max-old-space-size=1024" node -e " \
  const esbuild = require('esbuild'); \
  const fs = require('fs'); \
  const path = require('path'); \
  const pkg = JSON.parse(fs.readFileSync('package.json','utf-8')); \
  const allow = ['@google/generative-ai','axios','bcryptjs','compression','connect-pg-simple','cookie-parser','cors','csv-parse','date-fns','docx','drizzle-orm','drizzle-zod','exceljs','express','express-rate-limit','express-session','jsonwebtoken','memorystore','multer','nanoid','nodemailer','openai','p-limit','p-retry','passport','passport-local','stripe','uuid','ws','xlsx','zod','zod-validation-error']; \
  const allDeps = [...Object.keys(pkg.dependencies||{}),...Object.keys(pkg.devDependencies||{})]; \
  const ext = allDeps.filter(d=>!allow.includes(d)); \
  esbuild.buildSync({ entryPoints:['server/index.ts'], platform:'node', bundle:true, format:'cjs', outfile:'dist/index.cjs', define:{'process.env.NODE_ENV':'\"production\"'}, minify:true, external:ext, logLevel:'info', alias:{'@shared':path.resolve('shared')}, tsconfig:'server/tsconfig.json' }); \
"
RUN ls -la dist/index.cjs dist/public/index.html

FROM base AS production
ENV NODE_ENV=production
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh && chown -R appuser:appgroup /app
USER appuser
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
  CMD node -e "fetch('http://localhost:5000/health').then(r=>{if(!r.ok)throw 1}).catch(()=>process.exit(1))"
ENTRYPOINT ["./docker-entrypoint.sh"]
