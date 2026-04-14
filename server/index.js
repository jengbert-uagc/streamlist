import { Buffer } from 'node:buffer';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = process.env.AUTH_DATA_DIR
  ? path.resolve(process.env.AUTH_DATA_DIR)
  : path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const USERS_FILE_TMP = path.join(DATA_DIR, 'users.tmp.json');
const PORT = Number(process.env.PORT || 3001);
const NODE_ENV = process.env.NODE_ENV || 'development';
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'streamlist_session';
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 7 * 24 * 60 * 60 * 1000);
const SESSION_SECURE_COOKIES = process.env.SESSION_SECURE_COOKIES
  ? process.env.SESSION_SECURE_COOKIES === 'true'
  : NODE_ENV === 'production';
const CSRF_COOKIE_NAME = process.env.CSRF_COOKIE_NAME || 'streamlist_csrf';
const CSRF_HEADER_NAME = 'x-csrf-token';
const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,32}$/;

const GOOGLE_OAUTH_CLIENT_ID = (process.env.GOOGLE_OAUTH_CLIENT_ID || '').trim();
const GOOGLE_OAUTH_CLIENT_SECRET = (process.env.GOOGLE_OAUTH_CLIENT_SECRET || '').trim();
const GOOGLE_OAUTH_REDIRECT_URI = (process.env.GOOGLE_OAUTH_REDIRECT_URI || '').trim();
const GOOGLE_OAUTH_SCOPES = (process.env.GOOGLE_OAUTH_SCOPES || 'openid email profile').trim();
const OAUTH_STATE_TTL_MS = Number(process.env.OAUTH_STATE_TTL_MS || 10 * 60 * 1000);
const GOOGLE_OAUTH_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_OAUTH_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

const sessionStore = new Map();
const oauthStateStore = new Map();

const createSessionId = () => randomBytes(32).toString('hex');
const createCsrfToken = () => randomBytes(24).toString('hex');
const createOauthStateToken = () => randomBytes(24).toString('hex');

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
  if (sessionId) {
    sessionStore.delete(sessionId);
  }
};

const pruneExpiredSessions = () => {
  const now = Date.now();
  for (const [sessionId, session] of sessionStore.entries()) {
    if (session.expiresAt <= now) {
      sessionStore.delete(sessionId);
    }
  }
};

const pruneExpiredOauthStates = () => {
  const now = Date.now();
  for (const [state, value] of oauthStateStore.entries()) {
    if (value.expiresAt <= now) {
      oauthStateStore.delete(state);
    }
  }
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

const getSecurityHeaders = () => ({
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Resource-Policy': 'same-site',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
});

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
    'Access-Control-Allow-Headers': 'Content-Type, X-CSRF-Token',
    'Access-Control-Allow-Credentials': 'true',
    Vary: 'Origin',
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

const getRequestProtocol = (req) => {
  const forwardedProto = req.headers['x-forwarded-proto'];
  if (typeof forwardedProto === 'string' && forwardedProto.length > 0) {
    return forwardedProto.split(',')[0].trim();
  }
  return NODE_ENV === 'production' ? 'https' : 'http';
};

const getPublicBaseUrl = (req) => {
  const configuredBaseUrl = (process.env.PUBLIC_BASE_URL || '').trim();
  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/+$/, '');
  }
  const host = req.headers.host || 'localhost';
  return `${getRequestProtocol(req)}://${host}`;
};

const buildGoogleRedirectUri = (req) => {
  if (GOOGLE_OAUTH_REDIRECT_URI) {
    return GOOGLE_OAUTH_REDIRECT_URI;
  }
  return `${getPublicBaseUrl(req)}/api/auth/google/callback`;
};

const isGoogleOAuthConfigured = () => {
  return GOOGLE_OAUTH_CLIENT_ID.length > 0 && GOOGLE_OAUTH_CLIENT_SECRET.length > 0;
};

const sanitizePostLoginRedirect = (value) => {
  if (typeof value !== 'string') {
    return '/';
  }
  const trimmed = value.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return '/';
  }
  return trimmed || '/';
};

const sanitizeAppOrigin = (value) => {
  if (typeof value !== 'string') {
    return '';
  }
  try {
    const parsed = new URL(value.trim());
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return '';
    }
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return '';
  }
};

const getAppOriginFromRequest = (req, requestUrl) => {
  const queryOrigin = sanitizeAppOrigin(requestUrl.searchParams.get('appOrigin'));
  if (queryOrigin) {
    return queryOrigin;
  }

  const originHeader = sanitizeAppOrigin(req.headers.origin);
  if (originHeader) {
    return originHeader;
  }

  const refererHeader = req.headers.referer;
  if (typeof refererHeader === 'string' && refererHeader.length > 0) {
    try {
      const refererUrl = new URL(refererHeader);
      return sanitizeAppOrigin(`${refererUrl.protocol}//${refererUrl.host}`);
    } catch {
      // ignore invalid referrer
    }
  }

  return getPublicBaseUrl(req);
};

const createOauthState = (redirectPath, appOrigin) => {
  const state = createOauthStateToken();
  oauthStateStore.set(state, {
    redirectPath,
    appOrigin,
    expiresAt: Date.now() + OAUTH_STATE_TTL_MS
  });
  return state;
};

const consumeOauthState = (state) => {
  if (!state) {
    return null;
  }
  const entry = oauthStateStore.get(state);
  oauthStateStore.delete(state);
  if (!entry || entry.expiresAt <= Date.now()) {
    return null;
  }
  return entry;
};

const getGoogleUserInfo = async (req, code) => {
  const tokenResponse = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_OAUTH_CLIENT_ID,
      client_secret: GOOGLE_OAUTH_CLIENT_SECRET,
      redirect_uri: buildGoogleRedirectUri(req),
      grant_type: 'authorization_code'
    })
  });

  if (!tokenResponse.ok) {
    throw new Error('Google token exchange failed');
  }

  const tokenPayload = await tokenResponse.json();
  const accessToken = tokenPayload.access_token;
  if (typeof accessToken !== 'string' || accessToken.length === 0) {
    throw new Error('Google access token missing');
  }

  const userResponse = await fetch(GOOGLE_OAUTH_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  if (!userResponse.ok) {
    throw new Error('Google user info lookup failed');
  }

  const userPayload = await userResponse.json();
  if (typeof userPayload.sub !== 'string' || userPayload.sub.length === 0) {
    throw new Error('Google subject missing');
  }
  if (typeof userPayload.email !== 'string' || userPayload.email.length === 0) {
    throw new Error('Google email missing');
  }
  if (!userPayload.email_verified) {
    throw new Error('Google email is not verified');
  }

  return {
    googleSubject: userPayload.sub,
    email: userPayload.email.toLowerCase(),
    displayName: typeof userPayload.name === 'string' ? userPayload.name.trim() : ''
  };
};

const isValidUsername = (username) => {
  return USERNAME_PATTERN.test(username);
};

const toUsernameBase = (value) => {
  const source = typeof value === 'string' ? value.toLowerCase() : '';
  const normalized = source
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/[-_.]{2,}/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '');
  if (!normalized) {
    return 'user';
  }
  if (normalized.length < 3) {
    return `${normalized}usr`;
  }
  return normalized.slice(0, 32);
};

const getUniqueUsername = (users, suggestedBase) => {
  const existing = new Set(users.map((user) => user.username));
  let base = toUsernameBase(suggestedBase);
  if (base.length > 32) {
    base = base.slice(0, 32);
  }
  if (!existing.has(base) && isValidUsername(base)) {
    return base;
  }

  let suffix = 1;
  while (suffix < 10000) {
    const suffixText = String(suffix);
    const prefix = base.slice(0, Math.max(3, 32 - suffixText.length - 1));
    const candidate = `${prefix}-${suffixText}`;
    if (!existing.has(candidate) && isValidUsername(candidate)) {
      return candidate;
    }
    suffix += 1;
  }
  return `user-${Date.now()}`.slice(0, 32);
};

const ensureUsersFile = async () => {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    await readFile(USERS_FILE, 'utf8');
  } catch {
    await writeFile(USERS_FILE, JSON.stringify([], null, 2), { encoding: 'utf8', mode: 0o600 });
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

const findOrCreateGoogleUser = async (googleIdentity) => {
  const users = await getUsers();
  const existingIndex = users.findIndex((user) => user.googleSubject === googleIdentity.googleSubject);
  if (existingIndex !== -1) {
    const existingUser = users[existingIndex];
    if (existingUser.email !== googleIdentity.email || existingUser.displayName !== googleIdentity.displayName) {
      users[existingIndex] = {
        ...existingUser,
        email: googleIdentity.email,
        displayName: googleIdentity.displayName
      };
      await saveUsers(users);
    }
    return existingUser.username;
  }

  const emailLocalPart = googleIdentity.email.split('@')[0];
  const suggestedBase = emailLocalPart || googleIdentity.displayName || 'google-user';
  const username = getUniqueUsername(users, suggestedBase);
  users.push({
    username,
    authProvider: 'google',
    googleSubject: googleIdentity.googleSubject,
    email: googleIdentity.email,
    displayName: googleIdentity.displayName
  });
  await saveUsers(users);
  return username;
};

const redirectToLoginWithError = (res, errorCode, appOrigin = '') => {
  const base = sanitizeAppOrigin(appOrigin) || '';
  const location = `${base}/login?oauthError=${encodeURIComponent(errorCode)}`;
  res.writeHead(302, {
    Location: location,
    ...getSecurityHeaders()
  });
  res.end();
};

await ensureUsersFile();

const server = createServer(async (req, res) => {
  const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = requestUrl.pathname;
  pruneExpiredSessions();
  pruneExpiredOauthStates();

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

  if (req.method === 'GET' && pathname === '/api/auth/google/start') {
    if (!isGoogleOAuthConfigured()) {
      sendJson(req, res, 503, { error: 'Google OAuth is not configured' });
      return;
    }

    const redirectPath = sanitizePostLoginRedirect(requestUrl.searchParams.get('redirect'));
    const appOrigin = getAppOriginFromRequest(req, requestUrl);
    const state = createOauthState(redirectPath, appOrigin);
    const params = new URLSearchParams({
      client_id: GOOGLE_OAUTH_CLIENT_ID,
      redirect_uri: buildGoogleRedirectUri(req),
      response_type: 'code',
      scope: GOOGLE_OAUTH_SCOPES,
      state,
      include_granted_scopes: 'true',
      access_type: 'online',
      prompt: 'select_account'
    });

    res.writeHead(302, {
      Location: `${GOOGLE_OAUTH_AUTHORIZE_URL}?${params.toString()}`,
      ...getSecurityHeaders()
    });
    res.end();
    return;
  }

  if (req.method === 'GET' && pathname === '/api/auth/google/callback') {
    if (!isGoogleOAuthConfigured()) {
      redirectToLoginWithError(res, 'not_configured', getPublicBaseUrl(req));
      return;
    }

    const code = requestUrl.searchParams.get('code');
    const state = requestUrl.searchParams.get('state');
    if (!code || !state) {
      redirectToLoginWithError(res, 'missing_code_or_state');
      return;
    }

    const stateEntry = consumeOauthState(state);
    if (!stateEntry) {
      redirectToLoginWithError(res, 'invalid_state');
      return;
    }

    try {
      const googleIdentity = await getGoogleUserInfo(req, code);
      const username = await findOrCreateGoogleUser(googleIdentity);
      const { sessionId, csrfToken } = createSession(username);
      const redirectBase = sanitizeAppOrigin(stateEntry.appOrigin) || getPublicBaseUrl(req);

      res.writeHead(302, {
        Location: `${redirectBase}${stateEntry.redirectPath}`,
        'Set-Cookie': [buildSessionCookie(sessionId), buildCsrfCookie(csrfToken)],
        ...getSecurityHeaders()
      });
      res.end();
      return;
    } catch (error) {
      console.error('Google OAuth callback failed:', error);
      redirectToLoginWithError(res, 'google_auth_failed', stateEntry.appOrigin);
      return;
    }
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

  sendJson(req, res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`Auth server running on http://localhost:${PORT}`);
});
