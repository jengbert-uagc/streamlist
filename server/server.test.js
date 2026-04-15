import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { after, before, test } from 'node:test';

let childProcess;
let authDataDir;
let baseUrl;

const request = async (pathname, options = {}) => {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method || 'GET'
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  return { status: response.status, payload };
};

const findAvailablePort = async () => {
  const net = await import('node:net');
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1');
    server.on('listening', () => {
      const address = server.address();
      server.close(() => {
        if (!address || typeof address === 'string') {
          reject(new Error('Could not determine test port'));
          return;
        }
        resolve(address.port);
      });
    });
    server.on('error', reject);
  });
};

const waitForServer = async () => {
  const attempts = 60;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // ignore during startup
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Auth server did not become healthy in time');
};

before(async () => {
  authDataDir = await mkdtemp(path.join(tmpdir(), 'streamlist-auth-test-'));
  const port = await findAvailablePort();
  baseUrl = `http://127.0.0.1:${port}`;

  childProcess = spawn(process.execPath, ['server/index.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'development',
      AUTH_DATA_DIR: authDataDir,
      SESSION_SECURE_COOKIES: 'false'
    },
    stdio: 'ignore'
  });

  await waitForServer();
});

after(async () => {
  if (childProcess) {
    childProcess.kill('SIGTERM');
    await new Promise((resolve) => childProcess.once('exit', resolve));
  }
  if (authDataDir) {
    await rm(authDataDir, { recursive: true, force: true });
  }
});

test('unauthenticated /api/auth/me returns 401', async () => {
  const { status } = await request('/api/auth/me');
  assert.equal(status, 401);
});

test('password login endpoint is not available', async () => {
  const { status } = await request('/api/auth/login', { method: 'POST' });
  assert.equal(status, 404);
});

test('google start returns 503 when oauth is not configured', async () => {
  const { status, payload } = await request('/api/auth/google/start');
  assert.equal(status, 503);
  assert.equal(payload.error, 'Google OAuth is not configured');
});

test('logout without session succeeds', async () => {
  const { status, payload } = await request('/api/auth/logout', { method: 'POST' });
  assert.equal(status, 200);
  assert.equal(payload.success, true);
});
