import { useCallback, useEffect, useRef, useState } from 'react';
import { loadStockRange, invalidateStockCache } from './stockData';

// Rows of stock_balance for [start, end], backed by the shared per-day cache
export default function useStockRange(start, end) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    if (!start || !end) {
      setRows([]);
      return;
    }
    const requestId = ++requestRef.current;
    const isCancelled = () => requestId !== requestRef.current;
    setLoading(true);
    setError(null);
    try {
      const data = await loadStockRange(start, end, {
        isCancelled,
        onProgress: (p) => !isCancelled() && setProgress(p)
      });
      if (data && !isCancelled()) setRows(data);
    } catch (err) {
      if (isCancelled()) return;
      console.error('Stock range load error:', err);
      setError(err);
      setRows([]);
    } finally {
      if (!isCancelled()) setLoading(false);
    }
  }, [start, end]);

  useEffect(() => {
    load();
    return () => { requestRef.current++; };
  }, [load]);

  // Drop the cached days, then reload
  const refresh = useCallback(async () => {
    await invalidateStockCache();
    return load();
  }, [load]);

  return { rows, loading, error, progress, refresh };
}
