'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cacheSnapshot, readSnapshot } from './offline';
import type { Snapshot } from './types';
export function useSnapshot() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [offline, setOffline] = useState(false),
    [cached, setCached] = useState(false);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const [storageError, setStorageError] = useState(false);
  const running = useRef(false);
  const sync = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setOffline(!navigator.onLine);
    try {
      const response = await fetch('/api/snapshot', {
        cache: 'no-store',
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error('The latest data could not be reached.');
      const fresh: Snapshot = await response.json();
      setSnapshot(fresh);
      setCached(false);
      setError('');
      try {
        await cacheSnapshot(fresh);
        setStorageError(false);
      } catch {
        setStorageError(true);
      }
    } catch {
      setCached(true);
      setError('Live updates unavailable. Showing saved data when available.');
      try {
        const saved = await readSnapshot();
        if (saved) setSnapshot(saved);
      } catch {
        setStorageError(true);
      }
    } finally {
      setLoading(false);
      running.current = false;
    }
  }, []);
  useEffect(() => {
    void sync();
    const goneOffline = () => {
      setOffline(true);
      setCached(true);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void sync();
    };
    window.addEventListener('online', sync);
    window.addEventListener('offline', goneOffline);
    document.addEventListener('visibilitychange', onVisible);
    const timer = setInterval(sync, 60000);
    let assetObserver: PerformanceObserver | undefined;
    let stopped = false;
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then(() => navigator.serviceWorker.ready)
        .then((registration) => {
          if (stopped) return;
          // Include assets fetched before the service worker gained control (first visit).
          assetObserver = new PerformanceObserver((list) => {
            const urls = list
              .getEntries()
              .map((entry) => entry.name)
              .filter((value) => {
                const url = new URL(value);
                return url.origin === location.origin && url.pathname.startsWith('/_next/static/');
              });
            if (urls.length) registration.active?.postMessage({ type: 'CACHE_STATIC', urls });
          });
          assetObserver.observe({ type: 'resource', buffered: true });
        })
        .catch(() => setStorageError(true));
    }
    return () => {
      stopped = true;
      assetObserver?.disconnect();
      clearInterval(timer);
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', goneOffline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [sync]);
  return { snapshot, offline, cached, loading, error, storageError, sync };
}
