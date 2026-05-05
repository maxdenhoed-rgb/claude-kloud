# syntax=docker/dockerfile:1.7
# -----------------------------------------------------------------------------
# Stage 1a — python-builder
# Uses the official python:3.12-slim-bookworm image to install Python deps.
# This gives us Python 3.12 (Bookworm's default python3 is 3.11) without
# resorting to a third-party PPA.  The venv is copied into the runtime stage.
# -----------------------------------------------------------------------------
FROM python:3.12.10-slim-bookworm AS python-builder

WORKDIR /build

# Install build tools required by any C-extension pip packages.
RUN apt-get update -qq \
    && apt-get install -y --no-install-recommends \
        gcc=4:12.2.0-3 \
        g++=4:12.2.0-3 \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/pyenv

COPY requirements.txt ./

# anthropic pinned to 0.98.1 — bumped by the sdk-watcher CI workflow.
RUN /opt/pyenv/bin/pip install --no-cache-dir -r requirements.txt

# -----------------------------------------------------------------------------
# Stage 1b — node-builder
# Installs npm packages with a locked dependency file.
# The builder stage carries npm itself; it never reaches runtime.
# -----------------------------------------------------------------------------
FROM node:22.14.0-bookworm-slim AS node-builder

WORKDIR /build

# Copy only the lockfiles first so Docker layer cache is invalidated only when
# dependencies actually change, not when source files change.
COPY package.json package-lock.json ./

# ci installs exactly what is in the lockfile; fails if lockfile is out of date.
# @anthropic-ai/sdk pinned to 0.93.0 — bumped by the sdk-watcher CI workflow.
RUN npm ci --ignore-scripts --omit=dev

# -----------------------------------------------------------------------------
# Stage 2 — runtime
# Minimal image: no compilers, no build tools, non-root user, read-only root FS
# friendly (only /workspace and /tmp are writable at runtime).
# Base: node:22.14.0-bookworm-slim (Debian Bookworm, Node 22 LTS).
# Python 3.12 venv is copied from python-builder; no Python apt package needed.
# -----------------------------------------------------------------------------
FROM node:22.14.0-bookworm-slim AS runtime

# Install only the runtime deps needed in this stage.
RUN apt-get update -qq \
    && apt-get install -y --no-install-recommends \
        ca-certificates=20230311+deb12u1 \
        tini=0.19.0-1+b3 \
        curl=7.88.1-10+deb12u14 \
    && rm -rf /var/lib/apt/lists/* \
    && update-ca-certificates

# Create non-root user and group.  UID/GID 1001 is intentionally chosen to
# avoid collision with the node user (1000) that ships in the base image.
RUN groupadd --gid 1001 lab \
    && useradd --uid 1001 --gid lab --shell /bin/bash --create-home lab

# Copy node_modules from node-builder.
# Located at /app/node_modules so Node resolution works without PATH trickery.
WORKDIR /app
COPY --from=node-builder --chown=root:root /build/node_modules ./node_modules
COPY --from=node-builder --chown=root:root /build/package.json ./package.json

# Copy the Python interpreter and its shared library from python-builder.
# The venv's python symlinks point to /usr/local/bin/python3.12 which is the
# real interpreter binary built into the python:3.12 base image.  We must copy
# it (and its shared library) into the runtime stage so the venv works.
COPY --from=python-builder --chown=root:root /usr/local/bin/python3.12 /usr/local/bin/python3.12
COPY --from=python-builder --chown=root:root /usr/local/lib/libpython3.12.so.1.0 /usr/local/lib/libpython3.12.so.1.0
COPY --from=python-builder --chown=root:root /usr/local/lib/python3.12 /usr/local/lib/python3.12

# Copy Python venv from python-builder.
# The venv's python/python3 symlinks resolve via /usr/local/bin/python3.12 above.
# pip, pip3 scripts use #!/opt/pyenv/bin/python3.12 which also resolves correctly.
COPY --from=python-builder --chown=root:root /opt/pyenv /opt/pyenv

# Refresh the dynamic linker cache so libpython3.12.so.1.0 is found.
RUN ldconfig

# Create the writable workspace directory and a tmp directory that the lab user
# owns.  The root FS is mounted read-only at container start; only these two
# directories (plus /tmp as tmpfs) are writable.
RUN mkdir -p /workspace /tmp \
    && chown lab:lab /workspace \
    && chmod 750 /workspace

# Add symlinks so the venv's internal `python -> /usr/local/bin/python` chain
# resolves correctly.  The python:3.12 builder image has these symlinks but the
# node:22 runtime base does not.
# Also expose node22 alias for labs that want to be explicit about the version.
RUN ln -s /usr/local/bin/python3.12 /usr/local/bin/python3 \
    && ln -s /usr/local/bin/python3.12 /usr/local/bin/python \
    && ln -s /usr/local/bin/node /usr/local/bin/node22

# Set environment variables as Docker ENV so they are visible to all processes
# including those started via `docker exec` (which do not re-run the entrypoint).
# NODE_PATH: allows `require('@anthropic-ai/sdk')` to resolve from /app/node_modules
#            regardless of working directory (labs run from /workspace, not /app).
# PATH: ensures /opt/pyenv/bin is on PATH so `python` and `pip` resolve in exec shells.
ENV NODE_PATH=/app/node_modules \
    PATH="/opt/pyenv/bin:/usr/local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

# Copy the entrypoint script.
COPY --chown=root:root --chmod=0555 entrypoint.sh /usr/local/bin/entrypoint.sh

# Drop to lab user for all subsequent instructions and at runtime.
USER lab

WORKDIR /workspace

# Healthcheck: the entrypoint does not expose a port, but we expose a simple
# sentinel file that the broker checks via `fly machine exec`.
# The proxy reachability probe is done at SDK call time, not here.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD test -f /tmp/.lab-ready || exit 1

# tini is PID 1 — it reaps zombies and forwards signals correctly.
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/entrypoint.sh"]
