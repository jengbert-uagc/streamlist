const AUTH_API_BASE = (import.meta.env.VITE_AUTH_API_URL || '').trim().replace(/\/+$/, '');
let csrfToken = null;

const buildUrl = (path) => {
  if (AUTH_API_BASE) {
    return `${AUTH_API_BASE}${path}`;
  }
  return path;
};

const sanitizeRedirectPath = (path) => {
  if (typeof path !== 'string') {
    return '/';
  }
  const trimmed = path.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return '/';
  }
  return trimmed || '/';
};

const parseJsonSafely = async (response) => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

const request = async (path, body, options = {}) => {
  if (options.requireCsrf && !csrfToken) {
    throw new Error('Session is not ready. Refresh and try again.');
  }

  const headers = {};
  if (body) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.requireCsrf && csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  const response = await fetch(buildUrl(path), {
    method: body ? 'POST' : 'GET',
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include'
  });

  const payload = await parseJsonSafely(response);
  if (!response.ok) {
    throw new Error(payload.error || 'Request failed');
  }
  if (payload && typeof payload.csrfToken === 'string') {
    csrfToken = payload.csrfToken;
  }
  return payload;
};

export const currentUserRequest = () => request('/api/auth/me');

export const logoutRequest = async () => {
  const payload = await request('/api/auth/logout', {}, { requireCsrf: true });
  csrfToken = null;
  return payload;
};

export const getGoogleLoginUrl = (redirectPath = '/', appOrigin = '') => {
  const safeRedirect = sanitizeRedirectPath(redirectPath);
  const originValue = typeof appOrigin === 'string' ? appOrigin.trim() : '';
  const originParam = originValue ? `&appOrigin=${encodeURIComponent(originValue)}` : '';
  return buildUrl(`/api/auth/google/start?redirect=${encodeURIComponent(safeRedirect)}${originParam}`);
};
