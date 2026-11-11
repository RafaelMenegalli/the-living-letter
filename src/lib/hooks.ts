import { useMemo, useSyncExternalStore } from 'react';
import { parseRoute, type Route } from '../letter/link';

function subscribeToHash(notify: () => void): () => void {
  window.addEventListener('hashchange', notify);
  return () => window.removeEventListener('hashchange', notify);
}

/** The current route, derived from the URL fragment. */
export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribeToHash, () => window.location.hash);
  return useMemo(() => parseRoute(hash), [hash]);
}

export function navigate(path: string): void {
  window.location.hash = path;
}

/** Subscribes to a media query; false where `matchMedia` is unavailable. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      if (typeof window.matchMedia !== 'function') return () => undefined;
      const list = window.matchMedia(query);
      list.addEventListener('change', notify);
      return () => list.removeEventListener('change', notify);
    },
    () => typeof window.matchMedia === 'function' && window.matchMedia(query).matches,
  );
}
