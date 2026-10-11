/** Optional observation installed by the isolated performance harness. */
export interface PreloadLifecycleEvent {
  activationID: string;
  clientID: string;
  key: string;
  phase: 'preload-start' | 'preload-complete' | 'preload-error' | 'preload-release';
  at: number;
  ttl: string | number;
}

export function observePreload(
  clientID: string | undefined,
  key: string,
  phase: PreloadLifecycleEvent['phase'],
  ttl: string | number,
  activationID: string
) {
  const observe = (
    globalThis as typeof globalThis & {
      __zeroPerformancePreload?: (event: PreloadLifecycleEvent) => void;
    }
  ).__zeroPerformancePreload;
  observe?.({ activationID, clientID: clientID ?? '', key, phase, at: performance.now(), ttl });
}
