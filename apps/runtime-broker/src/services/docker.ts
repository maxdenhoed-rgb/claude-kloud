import Dockerode from 'dockerode';
import type WebSocket from 'ws';

import { getEnv } from '../lib/env.js';
import { getLogger } from '../lib/logger.js';

import { bumpActivity } from './sessions.js';

/**
 * Build a Dockerode client.
 * Reads DOCKER_HOST from env for remote daemons; falls back to the Unix socket.
 *
 * DOCKER_HOST format supported by dockerode:
 *   unix:///var/run/docker.sock   -> socketPath
 *   tcp://host:port               -> host + port
 *   ssh://user@host               -> protocol ssh
 *
 * We only handle the unix-socket and tcp cases here; ssh is out of scope for local dev.
 */
function buildDockerClient(): Dockerode {
  const dockerHost = process.env['DOCKER_HOST'];

  if (dockerHost) {
    if (dockerHost.startsWith('unix://')) {
      return new Dockerode({ socketPath: dockerHost.slice('unix://'.length) });
    }
    if (dockerHost.startsWith('tcp://')) {
      const url = new URL(dockerHost);
      return new Dockerode({
        host: url.hostname,
        port: parseInt(url.port, 10),
        protocol: 'http',
      });
    }
  }

  return new Dockerode({ socketPath: '/var/run/docker.sock' });
}

let _docker: Dockerode | undefined;

function getDocker(): Dockerode {
  if (!_docker) _docker = buildDockerClient();
  return _docker;
}

export interface BootContainerOptions {
  jwt: string;
  sessionId: string;
  labId: string;
}

/**
 * Boot a detached lab container and return its ID.
 *
 * - Image: LAB_IMAGE env var (default lab-base:local)
 * - Env: ANTHROPIC_API_KEY=<jwt>, ANTHROPIC_BASE_URL=<broker-env-var>
 * - No published ports — broker reaches it via docker exec
 * - ExtraHosts: host.docker.internal -> host-gateway (Linux no-op on Docker Desktop)
 * - Labels: claudekloud.session_id, claudekloud.lab_id
 */
export async function bootContainer(opts: BootContainerOptions): Promise<string> {
  const env = getEnv();
  const docker = getDocker();
  const logger = getLogger();

  const containerEnv = [
    `ANTHROPIC_API_KEY=${opts.jwt}`,
    `ANTHROPIC_BASE_URL=${env.ANTHROPIC_PROXY_BASE_URL}`,
    `LAB_ID=${opts.labId}`,
    `LAB_SESSION_ID=${opts.sessionId}`,
  ];

  const container = await docker.createContainer({
    Image: env.LAB_IMAGE,
    Env: containerEnv,
    Labels: {
      'claudekloud.session_id': opts.sessionId,
      'claudekloud.lab_id': opts.labId,
    },
    HostConfig: {
      // Always pass host.docker.internal mapping — no-op on Docker Desktop, needed on Linux
      ExtraHosts: ['host.docker.internal:host-gateway'],
    },
  });

  await container.start();

  logger.info(
    { container_id: container.id, session_id: opts.sessionId, lab_id: opts.labId },
    'lab container started',
  );

  return container.id;
}

/**
 * Attach an exec session to a running container and pump bytes between the
 * container's PTY and the given WebSocket.
 *
 * - Tty: true — raw stream, no multiplexing header needed
 * - User: "lab" — the non-root user defined in the lab Dockerfile
 * - Sends binary frames; bumps session activity on every message
 * - Cleans up exec on WS close or stream end; does NOT kill the container
 */
export async function attachExec(
  containerId: string,
  sessionId: string,
  ws: WebSocket,
): Promise<void> {
  const docker = getDocker();
  const logger = getLogger();

  const container = docker.getContainer(containerId);

  const exec = await container.exec({
    Cmd: ['bash', '-l'],
    AttachStdin: true,
    AttachStdout: true,
    AttachStderr: true,
    Tty: true,
    User: 'lab',
  });

  // hijack: true returns a raw Duplex (net.Socket) carrying the TTY stream.
  const stream = await exec.start({ hijack: true, stdin: true });

  // Container PTY -> WebSocket
  stream.on('data', (chunk: Buffer) => {
    bumpActivity(sessionId);
    if (ws.readyState === ws.OPEN) {
      ws.send(chunk, { binary: true });
    }
  });

  // WebSocket -> container PTY stdin
  ws.on('message', (data: Buffer | ArrayBuffer | Buffer[]) => {
    bumpActivity(sessionId);
    if (!stream.destroyed) {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
      stream.write(buf);
    }
  });

  const cleanup = (reason: string) => {
    logger.info({ container_id: containerId, session_id: sessionId, reason }, 'exec stream ended');
    // Destroy only the stream; leave the container running for reconnect
    if (!stream.destroyed) stream.destroy();
  };

  stream.on('end', () => cleanup('exec-stream-end'));
  stream.on('error', (e: Error) => {
    logger.warn({ container_id: containerId, error: e.message }, 'exec stream error');
    cleanup('exec-stream-error');
  });

  ws.on('close', () => cleanup('ws-close'));
  ws.on('error', (e: Error) => {
    logger.warn({ container_id: containerId, error: e.message }, 'ws error');
    cleanup('ws-error');
  });
}

/**
 * Kill and remove a container by ID.
 * Idempotent — ignores 404 (already gone) and "not running" errors.
 */
export async function killContainer(containerId: string): Promise<void> {
  const docker = getDocker();
  const logger = getLogger();

  const container = docker.getContainer(containerId);

  try {
    await container.kill({ signal: 'SIGKILL' });
  } catch (e) {
    // 304 = container already stopped; 404 = container gone — both are fine
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes('304') && !msg.includes('404') && !msg.includes('not running')) {
      logger.warn({ container_id: containerId, error: msg }, 'kill failed (non-fatal)');
    }
  }

  try {
    await container.remove({ force: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes('404')) {
      logger.warn({ container_id: containerId, error: msg }, 'remove failed (non-fatal)');
    }
  }

  logger.info({ container_id: containerId }, 'container killed and removed');
}
