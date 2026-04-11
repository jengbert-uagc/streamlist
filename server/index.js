import { Buffer } from 'node:buffer';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = process.env.AUTH_DATA_DIR
  ? path.resolve(process.env.AUTH_DATA_DIR)
  : path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const USERS_FILE_TMP = path.join(DATA_DIR, 'users.tmp.json');
const PORT = Number(process.env.PORT || 3001);
const NODE_ENV = process.env.NODE_ENV || 'development';
const BCRYPT_ROUNDS_RAW = Number(process.env.BCRYPT_ROUNDS || 12);
const BCRYPT_ROUNDS = Number.isInteger(BCRYPT_ROUNDS_RAW) && BCRYPT_ROUNDS_RAW >= 10 && BCRYPT_ROUNDS_RAW <= 14
  ? BCRYPT_ROUNDS_RAW
  : 12;
const DEFAULT_ADMIN_USERNAME = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD;
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const BODY_SIZE_LIMIT_BYTES = Number(process.env.BODY_SIZE_LIMIT_BYTES || 10_000);
const LOGIN_RATE_LIMIT_WINDOW_MS = Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = Number(process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS || 10);
const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,32}$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72;
const loginAttemptStore = new Map();
const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'streamlist_session';
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 7 * 24 * 60 * 60 * 1000);
const SESSION_SECURE_COOKIES = process.env.SESSION_SECURE_COOKIES
  ? process.env.SESSION_SECURE_COOKIES === 'true'
  : NODE_ENV === 'production';
const CSRF_COOKIE_NAME = process.env.CSRF_COOKIE_NAME || 'streamlist_csrf';
const CSRF_HEADER_NAME = 'x-csrf-token';
const sessionStore = new Map();

const DEFAULT_USERS = [
  {
    username: DEFAULT_ADMIN_USERNAME,
    passwordHash: bcrypt.hashSync('password', BCRYPT_ROUNDS)
  }
];

const normalizeUsername = (value) => {
  return typeof value === 'string' ? value.trim() : '';
};

const isValidUsername = (username) => {
  return USERNAME_PATTERN.test(username);
};

const isValidPasswordLength = (password) => {
  return typeof password === 'string' && password.length >= MIN_PASSWORD_LENGTH && password.length <= MAX_PASSWORD_LENGTH;
};

const parseCookies = (cookieHeader) => {
  if (!cookieHeader) {
    return {};
  }
  return cookieHeader.split(';').reduce((cookies, part) => {
    const [rawName, ...rawValueParts] = part.trim().split('=');
    if (!rawName) {
      return cookies;
    }
    const rawValue = rawValueParts.join('=');
    try {
      cookies[rawName] = decodeURIComponent(rawValue || '');
    } catch {
      cookies[rawName] = rawValue || '';
    }
    return cookies;
  }, {});
};

const createSessionId = () => randomBytes(32).toString('hex');
const createCsrfToken = () => randomBytes(24).toString('hex');

const createSession = (username) => {
  const sessionId = createSessionId();
  const now = Date.now();
  const csrfToken = createCsrfToken();
  sessionStore.set(sessionId, {
    username,
    csrfToken,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS
  });
  return { sessionId, csrfToken };
};

const getSessionFromRequest = (req) => {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies[SESSION_COOKIE_NAME];
  if (!sessionId) {
    return null;
  }
  const session = sessionStore.get(sessionId);
  if (!session) {
    return null;
  }
  if (Date.now() > session.expiresAt) {
    sessionStore.delete(sessionId);
    return null;
  }
  sessionStore.set(sessionId, { ...session, expiresAt: Date.now() + SESSION_TTL_MS });
  return { sessionId, username: session.username, csrfToken: session.csrfToken };
};

const destroySession = (sessionId) => {
  if (!sessionId) {
    return;
  }
  sessionStore.delete(sessionId);
};

const pruneExpiredSessions = () => {
  const now = Date.now();
  for (const [sessionId, session] of sessionStore.entries()) {
    if (session.expiresAt <= now) {
      sessionStore.delete(sessionId);
    }
  }
};

const serializeCookie = (name, value, options = {}) => {
  const segments = [`${name}=${encodeURIComponent(value)}`];
  if (options.maxAge !== undefined) {
    segments.push(`Max-Age=${options.maxAge}`);
  }
  segments.push(`Path=${options.path || '/'}`);
  segments.push(`SameSite=${options.sameSite || 'Lax'}`);
  if (options.httpOnly !== false) {
    segments.push('HttpOnly');
  }
  if (options.secure) {
    segments.push('Secure');
  }
  return segments.join('; ');
};

const buildSessionCookie = (sessionId) => {
  return serializeCookie(SESSION_COOKIE_NAME, sessionId, {
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
    path: '/',
    sameSite: 'Lax',
    httpOnly: true,
    secure: SESSION_SECURE_COOKIES
  });
};

const buildClearedSessionCookie = () => {
  return serializeCookie(SESSION_COOKIE_NAME, '', {
    maxAge: 0,
    path: '/',
    sameSite: 'Lax',
    httpOnly: true,
    secure: SESSION_SECURE_COOKIES
  });
};

const buildCsrfCookie = (csrfToken) => {
  return serializeCookie(CSRF_COOKIE_NAME, csrfToken, {
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
    path: '/',
    sameSite: 'Lax',
    httpOnly: false,
    secure: SESSION_SECURE_COOKIES
  });
};

const buildClearedCsrfCookie = () => {
  return serializeCookie(CSRF_COOKIE_NAME, '', {
    maxAge: 0,
    path: '/',
    sameSite: 'Lax',
    httpOnly: false,
    secure: SESSION_SECURE_COOKIES
  });
};

const safeTokenMatch = (a, b) => {
  if (!a || !b || a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
};

const validateCsrf = (req, session) => {
  const tokenHeader = req.headers[CSRF_HEADER_NAME];
  if (typeof tokenHeader !== 'string') {
    return false;
  }
  return safeTokenMatch(tokenHeader, session.csrfToken);
};

const getRequestOrigin = (req) => req.headers.origin;

const isOriginAllowed = (origin) => {
  if (!origin) {
    return true;
  }
  if (ALLOWED_ORIGINS.length === 0) {
    return NODE_ENV !== 'production';
  }
  return ALLOWED_ORIGINS.includes(origin);
};

const getCorsOriginHeader = (origin) => {
  if (!origin) {
    return '*';
  }
  return isOriginAllowed(origin) ? origin : null;
};

const getClientIp = (req) => {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
    return forwardedFor.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
};

const registerLoginAttempt = (ip) => {
  const now = Date.now();
  const previousAttempts = loginAttemptStore.get(ip) || [];
  const recentAttempts = previousAttempts.filter((attemptTime) => now - attemptTime < LOGIN_RATE_LIMIT_WINDOW_MS);
  recentAttempts.push(now);
  loginAttemptStore.set(ip, recentAttempts);
  return recentAttempts.length;
};

const clearLoginAttempts = (ip) => {
  loginAttemptStore.delete(ip);
};

const isRateLimited = (ip) => {
  const now = Date.now();
  const attempts = loginAttemptStore.get(ip) || [];
  const recentAttempts = attempts.filter((attemptTime) => now - attemptTime < LOGIN_RATE_LIMIT_WINDOW_MS);
  loginAttemptStore.set(ip, recentAttempts);
  return recentAttempts.length >= LOGIN_RATE_LIMIT_MAX_ATTEMPTS;
};

const getSecurityHeaders = () => ({
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Resource-Policy': 'same-site',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
});

const verifyPassword = async (user, password) => {
  return typeof user.passwordHash === 'string' && bcrypt.compare(password, user.passwordHash);
};

const toBcryptUser = async (user, password) => {
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  return {
    username: user.username,
    passwordHash
  };
};

const ensureUsersFile = async () => {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    await readFile(USERS_FILE, 'utf8');
  } catch {
    if (NODE_ENV === 'production' && !DEFAULT_ADMIN_PASSWORD) {
      throw new Error('DEFAULT_ADMIN_PASSWORD is required when initializing users in production');
    }

    const initialUsers = DEFAULT_ADMIN_PASSWORD
      ? [{
        username: DEFAULT_ADMIN_USERNAME,
        passwordHash: bcrypt.hashSync(DEFAULT_ADMIN_PASSWORD, BCRYPT_ROUNDS)
      }]
      : DEFAULT_USERS;

    await writeFile(USERS_FILE, JSON.stringify(initialUsers, null, 2), { encoding: 'utf8', mode: 0o600 });
  }
};

const getUsers = async () => {
  const usersJson = await readFile(USERS_FILE, 'utf8');
  return JSON.parse(usersJson);
};

const saveUsers = async (users) => {
  const payload = JSON.stringify(users, null, 2);
  await writeFile(USERS_FILE_TMP, payload, { encoding: 'utf8', mode: 0o600 });
  await rename(USERS_FILE_TMP, USERS_FILE);
};

const sendJson = (req, res, statusCode, payload, options = {}) => {
  const requestOrigin = getRequestOrigin(req);
  const corsOrigin = getCorsOriginHeader(requestOrigin);
  if (requestOrigin && corsOrigin === null) {
    res.writeHead(403, {
      'Content-Type': 'application/json',
      ...getSecurityHeaders()
    });
    res.end(JSON.stringify({ error: 'Origin is not allowed' }));
    return;
  }

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': corsOrigin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
    ...getSecurityHeaders(),
    ...(options.headers || {})
  };

  res.writeHead(statusCode, headers);
  if (statusCode === 204) {
    res.end();
    return;
  }
  res.end(JSON.stringify(payload));
};

const getJsonBody = async (req) => {
  const contentType = req.headers['content-type'] || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error('Content-Type must be application/json');
  }

  const chunks = [];
  let bodyBytes = 0;
  for await (const chunk of req) {
    bodyBytes += chunk.length;
    if (bodyBytes > BODY_SIZE_LIMIT_BYTES) {
      throw new Error('Request payload too large');
    }
    chunks.push(chunk);
  }
  const rawBody = Buffer.concat(chunks).toString('utf8');
  if (!rawBody) {
    return {};
  }
  return JSON.parse(rawBody);
};

await ensureUsersFile();

const server = createServer(async (req, res) => {
  const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = requestUrl.pathname;
  pruneExpiredSessions();

  if (req.method === 'OPTIONS') {
    sendJson(req, res, 204, {});
    return;
  }

  if (req.method === 'GET' && pathname === '/health') {
    sendJson(req, res, 200, { status: 'ok', uptimeSeconds: Math.floor(process.uptime()) });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/auth/me') {
    const session = getSessionFromRequest(req);
    if (!session) {
      sendJson(req, res, 401, { error: 'Not authenticated' });
      return;
    }
    sendJson(req, res, 200, { username: session.username, csrfToken: session.csrfToken });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/auth/logout') {
    const session = getSessionFromRequest(req);
    if (session && !validateCsrf(req, session)) {
      sendJson(req, res, 403, { error: 'Invalid CSRF token' });
      return;
    }
    if (session) {
      destroySession(session.sessionId);
    }
    sendJson(req, res, 200, { success: true }, {
      headers: { 'Set-Cookie': [buildClearedSessionCookie(), buildClearedCsrfCookie()] }
    });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/auth/login') {
    try {
      const clientIp = getClientIp(req);
      if (isRateLimited(clientIp)) {
        sendJson(req, res, 429, { error: 'Too many login attempts. Try again later.' });
        return;
      }

      const { username, password } = await getJsonBody(req);
      const normalizedUsername = normalizeUsername(username);
      if (!normalizedUsername || !password) {
        registerLoginAttempt(clientIp);
        sendJson(req, res, 400, { error: 'Username and password are required' });
        return;
      }
      if (!isValidUsername(normalizedUsername)) {
        registerLoginAttempt(clientIp);
        sendJson(req, res, 400, { error: 'Username format is invalid' });
        return;
      }
      if (!isValidPasswordLength(password)) {
        registerLoginAttempt(clientIp);
        sendJson(req, res, 400, { error: `Password must be ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} characters` });
        return;
      }

      const users = await getUsers();
      const user = users.find((storedUser) => storedUser.username === normalizedUsername);
      if (!user) {
        registerLoginAttempt(clientIp);
        sendJson(req, res, 401, { error: 'Invalid username or password' });
        return;
      }

      const isValidPassword = await verifyPassword(user, password);
      if (!isValidPassword) {
        registerLoginAttempt(clientIp);
        sendJson(req, res, 401, { error: 'Invalid username or password' });
        return;
      }

      clearLoginAttempts(clientIp);
      const { sessionId, csrfToken } = createSession(user.username);
      sendJson(
        req,
        res,
        200,
        { username: user.username, csrfToken },
        { headers: { 'Set-Cookie': [buildSessionCookie(sessionId), buildCsrfCookie(csrfToken)] } }
      );
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid request payload';
      sendJson(req, res, 400, { error: message });
      return;
    }
  }

  if (req.method === 'POST' && pathname === '/api/auth/update-password') {
    try {
      const session = getSessionFromRequest(req);
      if (!session) {
        sendJson(req, res, 401, { error: 'Not authenticated' });
        return;
      }
      if (!validateCsrf(req, session)) {
        sendJson(req, res, 403, { error: 'Invalid CSRF token' });
        return;
      }

      const { currentPassword, newPassword } = await getJsonBody(req);
      if (!currentPassword || !newPassword) {
        sendJson(req, res, 400, { error: 'Current password and new password are required' });
        return;
      }
      if (!isValidPasswordLength(newPassword)) {
        sendJson(req, res, 400, { error: `New password must be ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} characters` });
        return;
      }
      if (currentPassword === newPassword) {
        sendJson(req, res, 400, { error: 'New password must be different from current password' });
        return;
      }

      const users = await getUsers();
      const userIndex = users.findIndex((storedUser) => storedUser.username === session.username);
      if (userIndex === -1) {
        sendJson(req, res, 404, { error: 'User not found' });
        return;
      }

      const isValidCurrentPassword = await verifyPassword(users[userIndex], currentPassword);
      if (!isValidCurrentPassword) {
        sendJson(req, res, 401, { error: 'Current password is incorrect' });
        return;
      }

      users[userIndex] = await toBcryptUser(users[userIndex], newPassword);
      await saveUsers(users);
      sendJson(req, res, 200, { success: true });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid request payload';
      sendJson(req, res, 400, { error: message });
      return;
    }
  }

  sendJson(req, res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`Auth server running on http://localhost:${PORT}`);
});
