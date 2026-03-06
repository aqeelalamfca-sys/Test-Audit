FROM node:20-alpine AS build
RUN apk add --no-cache python3 make g++
WORKDIR /app

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then \
      npm ci --maxsockets 5; \
    else \
      npm install --maxsockets 5; \
    fi

COPY prisma ./prisma/
RUN NODE_OPTIONS="--max-old-space-size=2048" npx prisma generate

COPY . .
ENV NODE_ENV=production
RUN NODE_OPTIONS="--max-old-space-size=2048" npx vite build --outDir /app/dist/public
RUN cp -rn public/* /app/dist/public/ 2>/dev/null || true
RUN ls -la /app/dist/public/index.html

FROM nginx:1.27-alpine AS production

RUN rm -rf /etc/nginx/conf.d/*

COPY docker/frontend-nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/public /usr/share/nginx/html

RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
