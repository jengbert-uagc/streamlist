# StreamList

StreamList is a React + Vite movie tracker with TMDB search, an inline watchlist workflow, and a class-scope auth server (Node HTTP + bcrypt + cookie sessions + CSRF protection).

## What This Project Includes

- Session-based authentication with server-managed cookies.
- CSRF protection for authenticated POST actions.
- StreamList CRUD (add, edit, complete, delete) with duplicate prevention.
- TMDB movie search with autocomplete and poster-backed results.
- Click-to-expand TMDB details directly inside StreamList entries.
- Simple catalog/cart experience for subscriptions and accessories.
- Backend integration tests for auth/session/CSRF behavior.

## Tech Stack

- Frontend: React 19, React Router 7, Vite 8.
- Backend: Node.js HTTP server, `bcryptjs`, JSON file storage.
- Tooling: ESLint, Node test runner (`node --test`).

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Create your env file:

```bash
cp .env.example .env
```

3. Set at minimum:

- `VITE_TMDB_API_KEY` (required for TMDB search/results/details).

4. Start frontend + backend together:

```bash
npm run dev:full
```

Frontend: `http://localhost:5173`  
Auth API: `http://localhost:3001`

## Scripts

- `npm run dev`: Start Vite frontend.
- `npm run server`: Start Node auth server.
- `npm run dev:full`: Run both frontend and backend.
- `npm run lint`: Run ESLint.
- `npm run test`: Run backend integration tests.
- `npm run build`: Create production frontend build.
- `npm run preview`: Preview built frontend.

## Environment Variables

Copy from `.env.example`:

```bash
VITE_TMDB_API_KEY=your_tmdb_api_key
VITE_TMDB_API_URL=https://api.themoviedb.org/3
VITE_TMDB_IMAGE_BASE_URL=https://image.tmdb.org/t/p
VITE_AUTH_API_URL=
PORT=3001
NODE_ENV=development
BCRYPT_ROUNDS=12
CORS_ORIGINS=http://localhost:5173
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=change-me-in-production
BODY_SIZE_LIMIT_BYTES=10000
LOGIN_RATE_LIMIT_WINDOW_MS=900000
LOGIN_RATE_LIMIT_MAX_ATTEMPTS=10
SESSION_COOKIE_NAME=streamlist_session
SESSION_TTL_MS=604800000
SESSION_SECURE_COOKIES=false
CSRF_COOKIE_NAME=streamlist_csrf
```

### Notes

- Leave `VITE_AUTH_API_URL` empty for same-origin `/api` calls (recommended with reverse proxy).
- Set `SESSION_SECURE_COOKIES=true` in production (HTTPS only).
- In production with fresh user storage, `DEFAULT_ADMIN_PASSWORD` must be set.

## Authentication And Security Model

### Session Flow

1. `POST /api/auth/login` validates credentials and sets:
   - HTTP-only session cookie.
   - CSRF cookie.
2. Frontend calls `GET /api/auth/me` on load to hydrate auth state.
3. Protected routes render only after auth check resolves.
4. `POST /api/auth/logout` clears cookies and server session.

### CSRF Protection

- Authenticated POST endpoints require `X-CSRF-Token`.
- The token is tied to the active session.
- Frontend stores the CSRF token in memory from login/`/me` responses and includes it in protected POST requests.

### Other Backend Safeguards

- Configurable CORS allowlist.
- Login rate limiting by client IP (in-memory).
- Request JSON-only parsing with body size limits.
- Username/password format and length validation.
- Atomic writes to `users.json` via temp file + rename.
- Basic secure headers (`X-Frame-Options`, `Referrer-Policy`, etc.).

## API Reference (Auth Server)

Base URL: `http://localhost:3001` (or proxied `/api`).

- `GET /health`
  - Response `200`: `{ status: "ok", uptimeSeconds: number }`
- `POST /api/auth/login`
  - Body: `{ username, password }`
  - Success `200`: `{ username, csrfToken }` + sets cookies
- `GET /api/auth/me`
  - Success `200`: `{ username, csrfToken }`
  - Failure `401`: `{ error: "Not authenticated" }`
- `POST /api/auth/update-password`
  - Requires valid session + `X-CSRF-Token`
  - Body: `{ currentPassword, newPassword }`
  - Success `200`: `{ success: true }`
- `POST /api/auth/logout`
  - Requires valid session + `X-CSRF-Token`
  - Success `200`: `{ success: true }` + clears cookies

## Frontend Feature Guide

### Login/Profile

- Login authenticates against backend and establishes session.
- Profile supports password updates and logout.

### StreamList

- Add entries manually or from Find results.
- Prevents duplicate entries (case-insensitive).
- Item row supports complete/edit/delete.
- Clicking a movie title toggles TMDB detail panel (overview, release date, rating, poster) when a `tmdbId` exists.

### Find

- TMDB search with autocomplete.
- Poster-backed result cards.
- Add-to-StreamList with duplicate detection.

### Cart

- Add subscriptions and accessories from catalog.
- Subscription rule: one subscription at a time.
- Quantity controls and total calculation.

## Project Structure

- `src/`: React application.
- `src/components/`: Page and feature components.
- `src/lib/authApi.js`: Centralized auth API client + CSRF handling.
- `server/index.js`: Auth server implementation.
- `server/data/users.json`: Local user storage.
- `server/server.test.js`: Auth/session/CSRF integration tests.
- `scripts/dev-full.js`: Runs frontend and backend together.

## Testing

Run all backend integration tests:

```bash
npm run test
```

Current integration tests verify:

- Unauthenticated access rejection (`/api/auth/me`).
- Login session bootstrap and CSRF token issuance.
- CSRF enforcement for update-password and logout.
- Successful password update/logout with valid CSRF.

## Deployment Notes

- Deploy frontend behind HTTPS.
- Deploy backend behind HTTPS and set:
  - `NODE_ENV=production`
  - `SESSION_SECURE_COOKIES=true`
  - `CORS_ORIGINS` to your exact frontend origin(s)
  - `DEFAULT_ADMIN_PASSWORD` for initial bootstrap when user file is empty
- Prefer proxying frontend and backend behind one domain and route `/api` to backend.

## Known Scope Limits (Intentional For Class Project)

- Sessions and rate limits are in-memory (reset on server restart).
- User storage is file-based (`users.json`) instead of a database.
- No roles/permissions model.

## Review And Change Log

### 2026-04-07 (README Documentation Overhaul)

1. Rewrote README into full project documentation with:
   setup, architecture, security model, API reference, frontend feature guide, testing, deployment, and known limits.
2. Added explicit environment variable reference including TMDB image base and CSRF cookie configuration.
3. Added endpoint-by-endpoint auth API documentation and auth flow explanation.

### 2026-04-07 (Frontend Visual Refresh)

1. Replaced template-era global styles with a clean baseline in `src/index.css`.
2. Rebuilt `src/App.css` to use a mainstream UI style:
   neutral palette, sticky top navigation, card surfaces, modern button/input states, and tighter spacing rhythm.
3. Improved mobile behavior for nav, forms, lists, and cart actions with responsive breakpoints.

Validation run after fixes:

- `npm run lint` passed
- `npm run build` passed

### 2026-04-07 (CSRF + Integration Tests)

1. Added CSRF protection to authenticated POST endpoints:
   `/api/auth/update-password` and `/api/auth/logout` now require a valid `X-CSRF-Token`.
2. Added session-bound CSRF token issuance:
   login and `GET /api/auth/me` return `csrfToken`, and CSRF cookie lifecycle is managed server-side.
3. Added backend integration tests with Node test runner:
   `server/server.test.js` covers auth/session/CSRF behavior end-to-end.
4. Added `npm run test` script for local validation.

Validation run after fixes:

- `npm run test` passed
- `npm run lint` passed
- `npm run build` passed
