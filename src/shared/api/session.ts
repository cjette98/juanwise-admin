import type { ApiRole, ApiSession, ApiTokenPair } from './types';

/**
 * The signed-in admin session: the Firebase ID token every request carries, and
 * the refresh token used to mint a new one when it expires (~1 hour).
 *
 * The port of juanwise-app-v2 `shared/api/session.ts`. AsyncStorage is async
 * and needed hydrating; `localStorage` is synchronous, so the whole
 * hydrate/await dance collapses into a single read at module load and the
 * request path can always see the token without an await.
 */
export interface StoredSession {
  idToken: string;
  refreshToken: string;
  /** Epoch ms. */
  expiresAt: number;
  uid: string;
  role: ApiRole;
}

const SESSION_KEY = 'juanwise_admin_session_v1';

function load(): StoredSession | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    // Private-mode Safari throws on localStorage; the console still works, the
    // session just does not survive a reload.
    return null;
  }
}

let current: StoredSession | null = load();

type Listener = (session: StoredSession | null) => void;
const listeners = new Set<Listener>();

/** Fires whenever the session is set, refreshed or cleared. */
export function onSessionChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSession(): StoredSession | null {
  return current;
}

export function isSignedIn(): boolean {
  return current !== null;
}

function persist(next: StoredSession | null) {
  current = next;
  try {
    if (next) window.localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    else window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // Same as above — keep the in-memory session even if it cannot be stored.
  }
  for (const listener of listeners) listener(current);
}

function expiryFrom(expiresIn: string): number {
  const seconds = Number(expiresIn);
  // Firebase returns 3600; fall back to that rather than expiring immediately.
  return Date.now() + (Number.isFinite(seconds) && seconds > 0 ? seconds : 3600) * 1000;
}

/** Called after login with the full session payload. */
export function setSession(session: ApiSession): StoredSession {
  const stored: StoredSession = {
    idToken: session.idToken,
    refreshToken: session.refreshToken,
    expiresAt: expiryFrom(session.expiresIn),
    uid: session.user.uid,
    role: session.user.role,
  };
  persist(stored);
  return stored;
}

/** Called after `POST /auth/refresh`, which returns tokens but no profile. */
export function setTokens(tokens: ApiTokenPair): StoredSession | null {
  if (!current) return null;
  const stored: StoredSession = {
    ...current,
    idToken: tokens.idToken,
    refreshToken: tokens.refreshToken,
    expiresAt: expiryFrom(tokens.expiresIn),
  };
  persist(stored);
  return stored;
}

/** Keeps the stored role in step when `/auth/me` reports a claim change. */
export function setSessionRole(role: ApiRole): void {
  if (!current || current.role === role) return;
  persist({ ...current, role });
}

export function clearSession(): void {
  persist(null);
}
