# Vercel handoff

This is the user-only checklist to take the step-1 marketing page from "scaffolded locally" to "live on a Vercel preview URL." Claude Code did everything up to but not including this. Each step is yours.

## Prerequisites

- A Vercel account (Hobby is fine for step 1).
- The repo pushed to GitHub. Step 0 below covers that if you have not done it yet.

## Step 0 — Push the repo to GitHub

```sh
cd "/Users/home/Documents/1. Projects/kodekloud/repo"
gh repo create claude-kloud --private --source . --remote origin
git add .
git commit -m "chore(repo): step 1 scaffold"
git push -u origin main
```

If you do not use `gh`, create the repo via the GitHub web UI, then add the remote and push.

## Step 1 — Create the Vercel project

In the Vercel dashboard, click **Add New → Project** and pick the `claude-kloud` GitHub repo. Vercel will prompt you to install the GitHub App if you have not already; allow it for this repo only.

## Step 2 — Set the root directory to `apps/web`

On the project's import screen, under **Root Directory**, click **Edit** and set it to:

```
apps/web
```

Vercel will detect Next.js automatically. Leave the framework preset on **Next.js**. Leave the build command, output directory, and install command on their defaults — they read from `package.json` and the workspace correctly.

## Step 3 — Confirm the Node version

Under **Build & Development Settings → Node.js Version**, set it to the version pinned in `.nvmrc` (currently `24.x`). This avoids a runtime mismatch between local dev and the Vercel build.

## Step 4 — Environment variables

Step 1 needs no environment variables. Leave the env panel empty. When step 2 (auth + Stripe) lands, the build will tell you what to add.

## Step 5 — Deploy and verify the first preview

Click **Deploy**. The first build should complete in roughly 90 seconds. When it finishes:

- Visit the preview URL.
- Confirm the page renders dark-themed with a single accent color on the CTA.
- Submit the email form and confirm you get a green status line ("Recorded. We will email when the first track is live.").
- Hit `/api/signup` directly with a bad payload (`curl -X POST https://<preview-url>/api/signup -H 'content-type: application/json' -d '{}'`) and confirm the response is `{ "ok": false, "error": { "code": "invalid_email", ... } }`.

## Step 6 — Enable preview deployments per PR

Vercel enables PR previews by default for the production branch's repo. Confirm under **Settings → Git** that:

- **Production Branch** is `main`.
- **Preview Deployments** is **On for all branches**.

Now every PR opened against `main` posts a Vercel preview URL back as a check on the PR, and `main` pushes deploy to the production alias.

## Notes

- Postgres is not yet wired in. The signup endpoint stores emails in an in-memory `Set` that resets on every cold start. That is fine for step 1 — the page is a launch-notice form, not a system of record. Step 2 swaps the in-memory store for a Postgres-backed implementation behind the same interface.
- There is no custom domain yet. Use the auto-generated `*.vercel.app` URL. A custom domain lands at the public launch (step 9 of the build order).
- The `pr-validation` GitHub Actions workflow runs in parallel with the Vercel preview build. Both must be green before merging to `main`.
