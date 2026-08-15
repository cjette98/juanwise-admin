import { API_BASE_URL, API_ORIGIN, REQUEST_TIMEOUT_MS, TOKEN_REFRESH_SKEW_MS } from './config';
import { clearSession, getSession, setTokens, type StoredSession } from './session';
import type { ApiTokenPair } from './types';

/**
 * Ported from juanwise-app-v2 `shared/api/client.ts`. The error envelope, the
 * single-flight token refresh and the replay-once-on-401 behaviour are the same
 * — they are properties of the API, not of the app that talks to it.
 *
 * Every error the API returns shares one envelope (juanwise-be
 * `middleware/errorHandler.ts`), so a failure can always be shown as a sentence
 * instead of "Request failed with 422".
 */
interface ErrorEnvelope {
  error?: { code?: string; message?: string; details?: unknown };
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** True when retrying later could plausibly succeed (offline, timeout, 5xx). */
  get isTransient(): boolean {
    return this.status === 0 || this.status === 429 || this.status >= 500;
  }

  /** True when the session is gone and the admin has to sign in again. */
  get isAuthFailure(): boolean {
    return this.status === 401;
  }

  /** True when signed in, but not as an admin. */
  get isForbidden(): boolean {
    return this.status === 403;
  }
}

export const NETWORK_ERROR_CODE = 'NETWORK_ERROR';

/**
 * A 422 carries `details` as a flat `{ field, message }[]` — see juanwise-be
 * `middleware/validate.ts`, which flattens zod's issues before throwing.
 */
export function fieldErrors(error: unknown): string[] {
  if (!(error instanceof ApiError) || !Array.isArray(error.details)) return [];
  return (error.details as { field?: string; message?: string }[])
    .map((detail) => detail?.message)
    .filter((message): message is string => typeof message === 'string');
}

/** The message to show for any thrown value. */
export function errorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (error instanceof ApiError) {
    const extra = fieldErrors(error);
    return extra.length ? `${error.message} — ${extra.join('; ')}` : error.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

type QueryValue = string | number | boolean | undefined | null;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, QueryValue>;
  /** Set false for the handful of endpoints that take no token. */
  auth?: boolean;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return url;

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    search.append(key, String(value));
  }
  const qs = search.toString();
  return qs ? `${url}?${qs}` : url;
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function toApiError(status: number, payload: unknown): ApiError {
  const envelope = payload as ErrorEnvelope | null;
  const error = envelope?.error;
  return new ApiError(
    status,
    error?.code ?? 'UNKNOWN',
    error?.message ?? `Request failed (${status}).`,
    error?.details,
  );
}

/** `fetch` with a timeout, so a stalled request cannot leave a spinner up forever. */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  signal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onExternalAbort = () => controller.abort();
  signal?.addEventListener('abort', onExternalAbort);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (signal?.aborted) throw err;
    if ((err as Error)?.name === 'AbortError') {
      throw new ApiError(
        0,
        NETWORK_ERROR_CODE,
        'The server took too long to respond. Check your connection and try again.',
      );
    }
    throw new ApiError(
      0,
      NETWORK_ERROR_CODE,
      'Could not reach the JuanWise server. Check your internet connection.',
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onExternalAbort);
  }
}

/* ------------------------------------------------------------ token refresh */

/**
 * One in-flight refresh at a time. Without this, a screen that fires five
 * requests on mount with an expired token would burn five refresh tokens and
 * four of them would lose the race.
 */
let refreshInFlight: Promise<StoredSession | null> | null = null;

async function performRefresh(refreshToken: string): Promise<StoredSession | null> {
  const response = await fetchWithTimeout(buildUrl('/auth/refresh'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  const payload = await parseBody(response);
  if (!response.ok) {
    // The refresh token itself is dead — nothing to do but sign out.
    clearSession();
    throw toApiError(response.status, payload);
  }
  return setTokens(payload as ApiTokenPair);
}

function refreshSession(session: StoredSession): Promise<StoredSession | null> {
  if (!refreshInFlight) {
    refreshInFlight = performRefresh(session.refreshToken).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

/** Refreshes ahead of expiry so a request never spends a round trip on a 401. */
async function validSession(): Promise<StoredSession | null> {
  const session = getSession();
  if (!session) return null;
  if (session.expiresAt - TOKEN_REFRESH_SKEW_MS > Date.now()) return session;

  try {
    return await refreshSession(session);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ request */

async function send<T>(path: string, options: RequestOptions, retryOn401: boolean): Promise<T> {
  const { method = 'GET', body, query, auth = true, signal } = options;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  if (auth) {
    const session = await validSession();
    if (!session) {
      throw new ApiError(401, 'UNAUTHENTICATED', 'You are signed out. Please sign in again.');
    }
    headers.Authorization = `Bearer ${session.idToken}`;
  }

  const response = await fetchWithTimeout(
    buildUrl(path, query),
    { method, headers, body: body === undefined ? undefined : JSON.stringify(body) },
    signal,
  );

  const payload = await parseBody(response);

  if (response.ok) return payload as T;

  // The token was revoked or expired between the pre-flight check and the
  // request landing — refresh once and replay before surfacing the failure.
  if (response.status === 401 && auth && retryOn401) {
    const session = getSession();
    if (session) {
      try {
        const refreshed = await refreshSession(session);
        if (refreshed) return send<T>(path, options, false);
      } catch {
        // fall through to the original 401
      }
    }
    clearSession();
  }

  throw toApiError(response.status, payload);
}

export function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return send<T>(path, options, true);
}

/* ------------------------------------------------------------ file uploads */

/**
 * PUTs the picked file straight to the signed Cloud Storage URL from
 * `POST /media/upload-url`. The API never proxies image bytes — on Vercel the
 * request body limit is small and functions are short-lived.
 *
 * The app passes a `file://` URI it has to re-fetch; a browser hands us the
 * `File` itself, which is already a Blob.
 */
export async function uploadToSignedUrl(
  uploadUrl: string,
  file: Blob,
  contentType: string,
  requiredHeaders: Record<string, string> = {},
): Promise<void> {
  let response: Response;

  try {
    response = await fetchWithTimeout(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType, ...requiredHeaders },
      body: file,
    });
  } catch (err) {
    // This leg does not talk to the API at all, so the generic "could not reach
    // the JuanWise server" is actively misleading here. A browser reports a
    // blocked cross-origin PUT as an indistinguishable network failure, and the
    // overwhelmingly likely cause is the storage bucket having no CORS rule for
    // this origin — see `npm run storage-cors` in juanwise-be.
    if (err instanceof ApiError && err.code === NETWORK_ERROR_CODE) {
      throw new ApiError(
        0,
        'UPLOAD_BLOCKED',
        'The browser could not upload to Cloud Storage. This is usually the storage bucket ' +
          'missing a CORS rule for this site — run `npm run storage-cors` in juanwise-be.',
      );
    }
    throw err;
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      'UPLOAD_FAILED',
      'The image could not be uploaded. Please try again.',
    );
  }
}

/** Liveness probe against `GET /health` (outside the `/api/v1` prefix). */
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(`${API_ORIGIN}/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    return response.ok;
  } catch {
    return false;
  }
}
