import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { after, before, test } from 'node:test';

const DEFAULT_ADMIN_PASSWORD = 'ClassProjectPassword123!';

let childProcess;
let authDataDir;
let baseUrl;
const cookieJar = {};
let csrfToken = '';

const getSetCookieValues = (response) => {
  if (typeof response.headers.getSetCookie === 'function') {
    return response.headers.getSetCookie();
  }
  const headerValue = response.headers.get('set-cookie');
  if (!headerValue) {
    return [];
  }
  return headerValue.split(/,(?=[^;=]+=)/g);
};

const updateCookieJar = (response) => {
  const setCookieHeaders = getSetCookieValues(response);
  for (const setCookie of setCookieHeaders) {
    const [pair] = setCookie.split(';');
    const eqIndex = pair.indexOf('=');
    if (eqIndex === -1) {
      continue;
    }
    const name = pair.slice(0, eqIndex).trim();
    const value = pair.slice(eqIndex + 1).trim();
    cookieJar[name] = value;
  }
};

const getCookieHeader = () => {
  const entries = Object.entries(cookieJar);
  if (entries.length === 0) {
    return '';
  }
  return entries.map(([key, value]) => `${key}=${value}`).join('; ');
};

const request = async (pathname, options = {}) => {
  const headers = {};
  const cookieHeader = getCookieHeader();
  if (cookieHeader) {
    headers.Cookie = cookieHeader;
  }
  if (options.csrfToken) {
    headers['X-CSRF-Token'] = options.csrfToken;
  }
  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  updateCookieJar(response);

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
      DEFAULT_ADMIN_USERNAME: 'admin',
      DEFAULT_ADMIN_PASSWORD,
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

test('login returns session and csrf token', async () => {
  const { status, payload } = await request('/api/auth/login', {
    method: 'POST',
    body: { username: 'admin', password: DEFAULT_ADMIN_PASSWORD }
  });

  assert.equal(status, 200);
  assert.equal(payload.username, 'admin');
  assert.equal(typeof payload.csrfToken, 'string');
  assert.ok(payload.csrfToken.length > 0);
  csrfToken = payload.csrfToken;

  assert.ok(cookieJar.streamlist_session);
  assert.ok(cookieJar.streamlist_csrf);
});

test('/api/auth/me returns authenticated user and csrf token', async () => {
  const { status, payload } = await request('/api/auth/me');
  assert.equal(status, 200);
  assert.equal(payload.username, 'admin');
  assert.equal(payload.csrfToken, csrfToken);
});

test('update-password rejects missing csrf token', async () => {
  const { status } = await request('/api/auth/update-password', {
    method: 'POST',
    body: {
      currentPassword: DEFAULT_ADMIN_PASSWORD,
      newPassword: 'NewPassword123!'
    }
  });
  assert.equal(status, 403);
});

test('update-password rejects invalid csrf token', async () => {
  const { status } = await request('/api/auth/update-password', {
    method: 'POST',
    csrfToken: 'invalid-token',
    body: {
      currentPassword: DEFAULT_ADMIN_PASSWORD,
      newPassword: 'NewPassword123!'
    }
  });
  assert.equal(status, 403);
});

test('update-password accepts valid csrf token', async () => {
  const { status } = await request('/api/auth/update-password', {
    method: 'POST',
    csrfToken,
    body: {
      currentPassword: DEFAULT_ADMIN_PASSWORD,
      newPassword: 'NewPassword123!'
    }
  });
  assert.equal(status, 200);
});

test('logout requires csrf token and clears session with valid token', async () => {
  const withoutToken = await request('/api/auth/logout', { method: 'POST' });
  assert.equal(withoutToken.status, 403);

  const withToken = await request('/api/auth/logout', {
    method: 'POST',
    csrfToken
  });
  assert.equal(withToken.status, 200);

  const meAfterLogout = await request('/api/auth/me');
  assert.equal(meAfterLogout.status, 401);
});
