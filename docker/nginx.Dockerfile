FROM nginx:alpine

RUN apk add --no-cache curl bash openssl

RUN rm -rf /etc/nginx/conf.d/*

COPY deploy/nginx/proxy.conf /etc/nginx/conf.d/default.conf
COPY deploy/nginx/proxy-ssl.conf /etc/nginx/nginx-ssl.conf
COPY docker/nginx-entrypoint.sh /docker-entrypoint-custom.sh

RUN chmod +x /docker-entrypoint-custom.sh && \
    mkdir -p /etc/nginx/ssl /var/www/certbot

EXPOSE 80 443

HEALTHCHECK --interval=15s --timeout=5s --retries=10 --start-period=30s \
  CMD curl -sf http://localhost/health || exit 1

ENTRYPOINT ["/docker-entrypoint-custom.sh"]
