import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '@/shared/api';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** Re-runs the loader; the screens hang their "Refresh" buttons off this. */
  reload: () => void;
}

/**
 * Runs a loader on mount and whenever `deps` change, and drops the result of a
 * stale run so a fast second load cannot be overwritten by a slow first one.
 *
 * Every screen here is read-then-render over a handful of endpoints, which is
 * not enough to justify a data-fetching library — but it is more than enough to
 * write the same three useStates six times.
 */
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const runId = useRef(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    const id = ++runId.current;
    let alive = true;

    setLoading(true);
    setError(null);

    loaderRef
      .current()
      .then((result) => {
        if (!alive || id !== runId.current) return;
        setData(result);
      })
      .catch((err) => {
        if (!alive || id !== runId.current) return;
        setError(errorMessage(err));
      })
      .finally(() => {
        if (!alive || id !== runId.current) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { data, loading, error, reload };
}
