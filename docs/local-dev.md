# Local Development

Boot order for the full lab-runtime stack.

## Prerequisites

- Docker Desktop 25+ (Mac/Windows) or Docker Engine 25+ with Compose v2 (Linux)
- Node.js 24+ and pnpm 10+

## Boot sequence

### 1. Start Postgres

```sh
docker compose up -d postgres
```

Wait until `docker compose ps` shows `(healthy)` for `claudekloud-postgres`.

### 2. Install dependencies

```sh
pnpm install
```

### 3. Apply the schema

```sh
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/claudekloud \
  pnpm --filter @claudekloud/db db:push
```

`drizzle-kit` reads `DATABASE_URL` from the shell environment, not from any
`.env` file — set it inline (or `export` it in your shell). The command is
interactive and prints the schema diff before applying; type `y` and Enter to
confirm. Run this again after any schema change.

To run noninteractively (e.g. from a script), pass `--force`:

```sh
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/claudekloud \
  pnpm --filter @claudekloud/db exec drizzle-kit push --force
```

### 4. Build the lab image

```sh
docker build -t lab-base:local infra/lab-image
```

Required once after checkout and again whenever `infra/lab-image/` changes
(Dockerfile, requirements.txt, package-lock.json).

### 5. Configure the proxy and broker

```sh
cp apps/proxy/.env.example apps/proxy/.env.local
cp apps/runtime-broker/.env.example apps/runtime-broker/.env.local
```

Both files are auto-loaded by their dev scripts via Node's
`--env-file-if-exists` flag (Node 22.13+). No manual `source` needed.

Open `apps/proxy/.env.local` and fill in:

| Variable                  | Value                                                       |
| ------------------------- | ----------------------------------------------------------- |
| `ANTHROPIC_API_KEY`       | A real Anthropic API key from console.anthropic.com         |
| `DATABASE_URL`            | `postgresql://postgres:postgres@localhost:5432/claudekloud` |
| `SESSION_SIGNING_SECRET`  | Random string, 32+ chars. Must match the broker's copy.     |
| `INTERNAL_WEBHOOK_SECRET` | Random string, 32+ chars. Must match the broker's copy.     |

Open `apps/runtime-broker/.env.local` and fill in:

| Variable                  | Value                                         |
| ------------------------- | --------------------------------------------- |
| `SESSION_SIGNING_SECRET`  | **Same value** as in `apps/proxy/.env.local`. |
| `INTERNAL_WEBHOOK_SECRET` | **Same value** as in `apps/proxy/.env.local`. |

Generate the shared secrets once with `openssl rand -hex 32` and paste the
same value into both files. Never commit either `.env.local`.

Quick one-shot setup:

```sh
SECRET_SESSION=$(openssl rand -hex 32)
SECRET_WEBHOOK=$(openssl rand -hex 32)
echo "SESSION_SIGNING_SECRET=$SECRET_SESSION" >> apps/proxy/.env.local
echo "INTERNAL_WEBHOOK_SECRET=$SECRET_WEBHOOK" >> apps/proxy/.env.local
echo "SESSION_SIGNING_SECRET=$SECRET_SESSION" >> apps/runtime-broker/.env.local
echo "INTERNAL_WEBHOOK_SECRET=$SECRET_WEBHOOK" >> apps/runtime-broker/.env.local
```

Then open `apps/proxy/.env.local` and add `ANTHROPIC_API_KEY=...` +
`DATABASE_URL=...` manually.

### 6. Start all services

```sh
pnpm dev
```

Turbo runs `dev` scripts in all packages concurrently: `apps/web` (Next.js on
`:3000`), `apps/proxy` (Hono on `:8080` / `:8081`), and `apps/runtime-broker`
once it lands.

### 7. Open the demo lab

Navigate to `http://localhost:3000/labs/demo` and click **Start lab**.

---

## Troubleshooting

**`host.docker.internal` not resolving on Linux**

Docker Desktop (Mac/Windows) maps `host.docker.internal` automatically. On
Linux without Docker Desktop the broker adds `--add-host=host.docker.internal:host-gateway`
when launching lab containers, so it should resolve. If you see DNS failures,
confirm you are on Docker Engine 20.10+ and that the `host-gateway` special
value is supported.

**Lab image build fails**

Check that `infra/lab-image/package-lock.json` is committed. The `npm ci` step
in the node-builder stage requires it. Regenerate with:

```sh
cd infra/lab-image && npm install --package-lock-only --ignore-scripts
```

**Proxy fails to start with `DATABASE_URL` error**

Confirm Postgres is healthy (`docker compose ps`) before starting `pnpm dev`.
If you started `pnpm dev` before Postgres was ready, restart: `pnpm dev` again
or `pnpm --filter @claudekloud/proxy dev`.

---

## Resetting the database

```sh
pnpm db:down && docker volume rm claudekloud_pgdata && pnpm db:up && pnpm --filter @claudekloud/db db:push
```

This tears down the container, removes the named volume (all data), recreates
the container, and re-applies the schema from scratch.

---

## Known limitations (local-only — not for non-local deploy)

This stack is scoped for a developer's laptop. It MUST be hardened before any
non-localhost deploy. Documented for traceability:

- **No auth on `POST /sessions`.** Anyone who can reach `localhost:3001` can
  spin up a lab container. Acceptable on solo localhost; CSRF-class risk if
  the broker is ever reachable beyond loopback. Before lifting to Fly: gate
  behind Clerk, add per-user concurrency cap.
- **No rate limit on container creation.** A loop will exhaust Docker. Before
  non-local: add `MAX_ACTIVE_SESSIONS` and per-IP rate limiting.
- **`INTERNAL_WEBHOOK_SECRET` minimum length differs (proxy 16 vs broker 32).**
  Use 32+ chars to satisfy both. The proxy minimum will be raised to 32 in a
  follow-up PR.
- **Hardcoded identity.** Every session uses `user_id="demo-user"` and
  `budget_tier="standard"`. Replace when Clerk integrates.
- **JWT visible inside the lab container.** A learner can `printenv
ANTHROPIC_API_KEY` and see the session JWT (not the master key). By design
  — the SDK in the container needs it. JWT is short-lived (95 min) and
  session-scoped.
- **Broker binds to `127.0.0.1`.** Reachable only from the same machine.
  Other devices on your LAN cannot hit `:3001`.
