# ClaudeKloud Lab Container Image

## Contents

| Component         | Version       | Purpose                   |
| ----------------- | ------------- | ------------------------- |
| Node.js           | 22.14.0 (LTS) | TypeScript lab runtime    |
| @anthropic-ai/sdk | 0.93.0        | Anthropic TypeScript SDK  |
| Python            | 3.11 (system) | Python lab runtime        |
| anthropic (PyPI)  | 0.98.1        | Anthropic Python SDK      |
| tini              | 0.19.0        | PID 1 / signal forwarding |

The image runs as non-root user `lab` (UID 1001). The root filesystem is
read-only at runtime except for `/workspace` (learner files) and `/tmp`
(tmpfs, ephemeral).

All Claude API traffic is forced through `https://proxy.claudekloud.dev`.
The egress network policy blocks `*.anthropic.com` directly.

## Image tag scheme

Images are tagged `lab-base:<gitSha>` where `<gitSha>` is the 40-character
Git commit SHA of the commit that triggered the build. The tag `:latest` is
never pushed. The broker reads the current canonical digest from the
`lab_image_releases` table (maintained by the proxy) and verifies the image
digest at boot time before launching any session machine.

## Rebuild locally

Requirements: Docker 25+, Node 22+.

```sh
# From the repo root:
cd infra/lab-image

# Generate a fresh lockfile if you bumped a dependency:
npm install --package-lock-only --ignore-scripts

# Build (replace <sha> with any identifier meaningful to you locally):
docker build \
  --tag lab-base:local \
  --file Dockerfile \
  .

# Smoke test — should print the SDK version and exit 0:
docker run --rm \
  --read-only \
  --tmpfs /tmp \
  --mount type=tmpfs,destination=/workspace \
  -e ANTHROPIC_API_KEY=sk-dummy \
  lab-base:local \
  node -e "const a = require('@anthropic-ai/sdk'); console.log('sdk ok', a.VERSION ?? 'loaded')"

docker run --rm \
  --read-only \
  --tmpfs /tmp \
  --mount type=tmpfs,destination=/workspace \
  -e ANTHROPIC_API_KEY=sk-dummy \
  lab-base:local \
  python -c "import anthropic; print('sdk ok', anthropic.__version__)"
```

The build uses `--read-only` and `--tmpfs` flags to verify the image behaves
correctly under a read-only root FS before pushing.

## Provenance and signing

Images are built exclusively in GitHub Actions CI. No one pushes images from a
local machine. The workflow (`.github/workflows/lab-image.yml`) does the
following after a successful build:

1. Pushes the image to GHCR (`ghcr.io/org/claudekloud/lab-base:<gitSha>`).
2. Runs `cosign sign` in keyless mode using the GitHub Actions OIDC token.
   The identity bound to the signature is:
   `https://github.com/org/claudekloud/.github/workflows/lab-image.yml@refs/heads/main`
   The OIDC issuer is `https://token.actions.githubusercontent.com`.
3. Records the image digest in the `lab_image_releases` table via a webhook
   call to `POST /internal/lab-image-release` on the proxy.

No long-lived cosign private key exists. The signing key is ephemeral per
workflow run.

## Verifying a pulled image

```sh
IMAGE="ghcr.io/org/claudekloud/lab-base@sha256:<digest>"

cosign verify \
  --certificate-identity-regexp="https://github.com/org/claudekloud/.github/workflows/lab-image.yml@refs/heads/.*" \
  --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \
  "${IMAGE}"
```

A non-zero exit code means the image was not produced by this repo's CI
pipeline and must not be used.

## Dependency updates

The SDK watcher workflow (`.github/workflows/anthropic-sdk-watcher.yml`)
polls npm and PyPI on a schedule. When a new release is detected it opens a
PR that bumps the version pin in `package.json` and `requirements.txt`, then
triggers a new image build. All version pins in this directory are the
authoritative source of truth for what ships in the image.
