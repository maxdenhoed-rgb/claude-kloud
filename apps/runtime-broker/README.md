# @claudekloud/runtime-broker

Local-only runtime broker for the ClaudeKloud lab demo.
Boots lab Docker containers, mints session JWTs via the proxy, and exposes a WebSocket PTY endpoint.

Not deployed to Fly — runs on the developer's machine.

---

## Environment variables

| Variable                   | Default                            | Description                                         |
| -------------------------- | ---------------------------------- | --------------------------------------------------- |
| `BROKER_PORT`              | `3001`                             | HTTP + WS listen port                               |
| `PROXY_INTERNAL_URL`       | `http://localhost:8081`            | Proxy internal listener URL                         |
| `INTERNAL_WEBHOOK_SECRET`  | —                                  | Must match the proxy's value exactly (min 32 chars) |
| `SESSION_SIGNING_SECRET`   | —                                  | Must match the proxy's value exactly (min 32 chars) |
| `ANTHROPIC_PROXY_BASE_URL` | `http://host.docker.internal:8080` | Injected into containers as `ANTHROPIC_BASE_URL`    |
| `LAB_IMAGE`                | `lab-base:local`                   | Docker image to boot                                |
| `IDLE_TIMEOUT_MS`          | `1200000`                          | Container idle timeout (ms); default 20 min         |
| `DOCKER_HOST`              | `/var/run/docker.sock`             | Docker daemon socket or TCP URL                     |
| `LOG_LEVEL`                | `info`                             | Pino log level                                      |

Copy `.env.example` to `.env.local` and fill in secrets. The `INTERNAL_WEBHOOK_SECRET` and `SESSION_SIGNING_SECRET` values must be byte-for-byte identical to those set in `apps/proxy/.env.local`.

---

## Dev

```sh
# From repo root
cp apps/runtime-broker/.env.example apps/runtime-broker/.env.local
# edit .env.local to add secrets

pnpm install
pnpm --filter @claudekloud/runtime-broker dev
```

The broker starts on `http://localhost:3001`.

---

## Endpoints

| Method   | Path                   | Description                                           |
| -------- | ---------------------- | ----------------------------------------------------- |
| `POST`   | `/sessions`            | Boot a lab container; returns `session_id` + `ws_url` |
| `DELETE` | `/sessions/:id`        | Kill container + drop session (idempotent)            |
| `GET`    | `/healthz`             | Liveness check                                        |
| `WS`     | `/sessions/:id/attach` | WebSocket PTY attach                                  |

---

## How it talks to the proxy

`POST /sessions` flow:

1. Broker generates a UUID `session_id`.
2. Broker calls `POST http://localhost:8081/internal/sessions` with `X-Webhook-Secret` header.
3. Proxy mints a session JWT and returns `{ ok:true, data:{ token, expires_at } }`.
4. Broker boots a Docker container with `ANTHROPIC_API_KEY=<token>` and `ANTHROPIC_BASE_URL=http://host.docker.internal:8080`.
5. Browser connects to `ws://localhost:3001/sessions/<id>/attach`; broker proxies a `bash -l` PTY via `docker exec`.
