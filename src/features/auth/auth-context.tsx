import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ApiError,
  authApi,
  clearSession,
  errorMessage,
  getSession,
  onSessionChange,
  type ApiCurrentUser,
} from '@/shared/api';

/**
 * Who is signed in to the console.
 *
 * The API is shared with the game, so a teacher's or a student's credentials
 * are perfectly valid at `POST /auth/login` — they just have no business here.
 * The role is therefore checked twice: once on the session the login returns,
 * and again on every cold start against `/auth/me`, because the admin claim can
 * be revoked out of band (juanwise-be `scripts/grant-admin.ts`) while a stored
 * session is still inside its hour.
 */
interface AuthContextValue {
  user: ApiCurrentUser | null;
  /** True until the stored session has been checked against the API. */
  restoring: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const NOT_ADMIN =
  'That account is not a JuanWise administrator. Sign in with the main admin account.';

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiCurrentUser | null>(null);
  const [restoring, setRestoring] = useState(getSession() !== null);

  // A 401 anywhere in the app clears the session; this drops the profile with
  // it so the router falls back to the login screen instead of rendering a
  // console whose every request fails.
  useEffect(
    () =>
      onSessionChange((session) => {
        if (!session) setUser(null);
      }),
    [],
  );

  useEffect(() => {
    if (!getSession()) return;

    let alive = true;
    authApi
      .me()
      .then((me) => {
        if (!alive) return;
        if (me.role === 'admin') setUser(me);
        else clearSession();
      })
      .catch(() => {
        // Expired refresh token or a revoked account — back to the login screen.
        if (alive) clearSession();
      })
      .finally(() => {
        if (alive) setRestoring(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    const session = await authApi.login({ username: username.trim(), password });

    if (session.user.role !== 'admin') {
      // The tokens are real, so drop them server-side too rather than just
      // forgetting them here.
      await authApi.logout();
      throw new ApiError(403, 'NOT_ADMIN', NOT_ADMIN);
    }

    try {
      setUser(await authApi.me());
    } catch (err) {
      await authApi.logout();
      throw new ApiError(0, 'PROFILE_FAILED', errorMessage(err));
    }
  }, []);

  const signOut = useCallback(async () => {
    await authApi.logout();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, restoring, signIn, signOut }),
    [user, restoring, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
