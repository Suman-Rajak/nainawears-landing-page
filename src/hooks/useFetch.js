import { useState, useEffect } from 'react';

/**
 * Generic data-fetching hook with loading / error states.
 * @param {() => Promise<any>} fetcher  - async function that returns data
 * @param {any[]} deps                  - re-fetch when these change
 */
export function useFetch(fetcher, deps = []) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetcher()
      .then(result => { if (!cancelled) { setData(result); setLoading(false); } })
      .catch(err   => { if (!cancelled) { setError(err.message ?? 'Unknown error'); setLoading(false); } });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error };
}
