# syntax=docker/dockerfile:1.7
# -----------------------------------------------------------------------------
# Stage 1 — builder
# Builds the TypeScript monorepo packages required by the proxy.
# Uses the Node 22 LTS slim image to match the runtime base.
# -----------------------------------------------------------------------------
FROM node:22.14.0-bookworm-slim AS builder

# Install pnpm via corepack (pinned version from package.json)
RUN corepack enable && corepack prepare pnpm@10.33.3 --activate

WORKDIR /build

# Copy workspace manifests first for layer-cache efficiency.
# Layer is invalidated only when dependencies actually change.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json ./

COPY apps/proxy/package.json ./apps/proxy/
COPY packages/session-token/package.json ./packages/session-token/
COPY packages/db/package.json ./packages/db/

# Install all workspace dependencies (frozen lockfile, no scripts)
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy source for the packages the proxy depends on
COPY packages/session-token/ ./packages/session-token/
COPY packages/db/ ./packages/db/
COPY apps/proxy/ ./apps/proxy/

# Build dependency packages, then the proxy
RUN pnpm --filter @claudekloud/session-token build
RUN pnpm --filter @claudekloud/db build
RUN pnpm --filter @claudekloud/proxy build

# Prune to production dependencies only for the runtime stage
RUN pnpm --filter @claudekloud/proxy deploy --prod /prod/proxy

# -----------------------------------------------------------------------------
# Stage 2 — runtime
# Minimal image: no build tools, non-root user, healthcheck on /healthz.
# -----------------------------------------------------------------------------
FROM node:22.14.0-bookworm-slim AS runtime

RUN apt-get update -qq \
    && apt-get install -y --no-install-recommends \
        ca-certificates=20230311 \
        tini=0.19.0-1 \
        curl=7.88.1-10+deb12u12 \
    && rm -rf /var/lib/apt/lists/* \
    && update-ca-certificates

# Non-root user — UID/GID 1001 avoids collision with node (1000)
RUN groupadd --gid 1001 proxy \
    && useradd --uid 1001 --gid proxy --shell /bin/bash --no-create-home proxy

WORKDIR /app

# Copy the deployed production artifacts from the builder stage
COPY --from=builder --chown=proxy:proxy /prod/proxy/node_modules ./node_modules
COPY --from=builder --chown=proxy:proxy /prod/proxy/dist ./dist
COPY --from=builder --chown=proxy:proxy /prod/proxy/package.json ./package.json

# Drop privileges
USER proxy

# Build-time args injected by CI (fly deploy --build-arg)
ARG GIT_SHA=unknown
ARG APP_VERSION=0.0.0
ENV GIT_SHA=${GIT_SHA}
ENV APP_VERSION=${APP_VERSION}

EXPOSE 8080 8081

# Healthcheck calls /healthz — runs as the non-root proxy user.
HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -fsS http://localhost:8080/healthz | grep '"ok":true' || exit 1

# tini as PID 1 for correct signal forwarding and zombie reaping
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/server.js"]
