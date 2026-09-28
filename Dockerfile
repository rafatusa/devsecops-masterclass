# syntax=docker/dockerfile:1
#
# DevSecOps Masterclass — Stage 8: Docker Build
#
# Stage 1 assembles and verifies the static bundle; stage 2 is a minimal,
# non-root nginx runtime. Keeping the toolchain out of the runtime image is
# what keeps the Trivy scan (Stage 9) quiet.

# ---------- build stage ----------
FROM alpine:3.21 AS build

WORKDIR /bundle

COPY src/ ./site/

# Fail the build early if the bundle is missing its entrypoint or its title.
RUN set -eux; \
    test -f ./site/index.html; \
    test -f ./site/css/styles.css; \
    test -f ./site/js/app.js; \
    grep -q "Learn DevOps the Easy Way" ./site/index.html

# ---------- runtime stage ----------
FROM nginx:1.27-alpine

LABEL org.opencontainers.image.title="devsecops-masterclass" \
      org.opencontainers.image.description="Static DevOps landing page served by nginx" \
      org.opencontainers.image.licenses="MIT"

# Drop the packaged default vhost, install ours.
RUN rm -f /etc/nginx/conf.d/default.conf

COPY nginx/nginx.conf      /etc/nginx/nginx.conf
COPY nginx/default.conf    /etc/nginx/conf.d/site.conf
COPY --from=build /bundle/site/ /usr/share/nginx/html/

# Everything nginx must write to is owned by the unprivileged nginx user.
RUN set -eux; \
    mkdir -p /tmp/client_temp /tmp/proxy_temp /tmp/fastcgi_temp /tmp/uwsgi_temp /tmp/scgi_temp; \
    chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx /var/log/nginx /tmp/client_temp \
        /tmp/proxy_temp /tmp/fastcgi_temp /tmp/uwsgi_temp /tmp/scgi_temp; \
    nginx -t -c /etc/nginx/nginx.conf

USER nginx

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://127.0.0.1:8080/healthz || exit 1

ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]
