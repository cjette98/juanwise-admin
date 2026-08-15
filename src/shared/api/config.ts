/**
 * Where the JuanWise API lives. The deployed Vercel instance is the default so
 * a fresh clone talks to a working backend with no setup; point it elsewhere
 * with `VITE_API_URL` in `.env` when running against `npm run dev` in
 * juanwise-be.
 *
 * Note for local backends: the console is a browser client, so the API's CORS
 * allow-list has to include this origin (`http://localhost:5180` by default) —
 * see `corsOrigins` in juanwise-be `src/config/env.ts`.
 */
const FALLBACK_ORIGIN = 'https://juanwise-be.vercel.app';

function configuredOrigin(): string {
  const fromEnv = import.meta.env.VITE_API_URL;
  return fromEnv && fromEnv.trim() ? fromEnv.trim() : FALLBACK_ORIGIN;
}

/** Origin only — used by `/health` and the docs link in the sidebar. */
export const API_ORIGIN = configuredOrigin().replace(/\/+$/, '');

/** Every module route hangs off this prefix; see juanwise-be `src/app.ts`. */
export const API_BASE_URL = `${API_ORIGIN}/api/v1`;

/**
 * Vercel functions cap at 30s (`vercel.json` maxDuration) and a cold start pays
 * Firebase Admin init, so the client waits a little longer than that before
 * giving up on a request the server is still serving.
 */
export const REQUEST_TIMEOUT_MS = 35_000;

/** Refresh the ID token this long before it actually expires. */
export const TOKEN_REFRESH_SKEW_MS = 60_000;
