import { startTransition, useEffect, useMemo, useState } from 'react';

const IDLE_TIMEOUT_MS = 250;
const FORCE_ACTIVATION_MS = 2_000;
const FALLBACK_BATCH_DELAY_MS = 16;

interface ProgressiveSearchCardState {
  contextKey: string;
  interactiveIds: ReadonlySet<string>;
}

interface UseProgressiveSearchCardsOptions {
  contextKey: string;
  documentIds: readonly string[];
  stateReady: boolean;
  batchSize?: number;
}

type IdleWindow = Window &
  typeof globalThis & {
    requestIdleCallback?: (
      callback: (deadline: IdleDeadline) => void,
      options?: IdleRequestOptions
    ) => number;
    cancelIdleCallback?: (handle: number) => void;
  };

export function useProgressiveSearchCards({
  contextKey,
  documentIds,
  stateReady,
  batchSize = 1,
}: UseProgressiveSearchCardsOptions): ReadonlySet<string> {
  const [state, setState] = useState<ProgressiveSearchCardState>(() => ({
    contextKey,
    interactiveIds: new Set(),
  }));
  const [paintedContext, setPaintedContext] = useState<string | null>(null);
  const [forcedContext, setForcedContext] = useState<string | null>(null);
  const documentIdsKey = useMemo(() => documentIds.join('\u0000'), [documentIds]);

  useEffect(() => {
    const idleWindow = window as IdleWindow;

    setState({ contextKey, interactiveIds: new Set() });
    setPaintedContext(null);
    setForcedContext(null);

    const animationFrame = idleWindow.requestAnimationFrame(() => {
      setPaintedContext(contextKey);
    });
    const forceHandle = setTimeout(() => {
      setForcedContext(contextKey);
    }, FORCE_ACTIVATION_MS);

    return () => {
      idleWindow.cancelAnimationFrame(animationFrame);
      clearTimeout(forceHandle);
    };
  }, [contextKey]);

  const activationEnabled =
    paintedContext === contextKey && (stateReady || forcedContext === contextKey);

  useEffect(() => {
    if (!activationEnabled || documentIds.length === 0) {
      return;
    }

    const idleWindow = window as IdleWindow;
    const currentInteractiveIds =
      state.contextKey === contextKey ? state.interactiveIds : new Set<string>();
    const pendingIds = documentIds.filter(id => !currentInteractiveIds.has(id));
    let cancelled = false;
    let idleHandle: number | null = null;
    let fallbackHandle: ReturnType<typeof setTimeout> | null = null;

    const runBatch = () => {
      if (cancelled) return;
      const batch = pendingIds.splice(0, batchSize);
      if (batch.length === 0) return;

      startTransition(() => {
        setState(previous => {
          if (previous.contextKey !== contextKey) {
            return previous;
          }

          const interactiveIds = new Set(previous.interactiveIds);
          for (const id of batch) {
            interactiveIds.add(id);
          }
          return { contextKey, interactiveIds };
        });
      });
    };

    const scheduleBatch = () => {
      if (cancelled || pendingIds.length === 0) return;
      if (typeof idleWindow.requestIdleCallback === 'function') {
        idleHandle = idleWindow.requestIdleCallback(runBatch, {
          timeout: IDLE_TIMEOUT_MS,
        });
      } else {
        fallbackHandle = setTimeout(runBatch, FALLBACK_BATCH_DELAY_MS);
      }
    };

    scheduleBatch();

    return () => {
      cancelled = true;
      if (idleHandle !== null) {
        idleWindow.cancelIdleCallback?.(idleHandle);
      }
      if (fallbackHandle !== null) {
        clearTimeout(fallbackHandle);
      }
    };
    // documentIdsKey intentionally captures the ordered visible-card context.
  }, [
    activationEnabled,
    batchSize,
    contextKey,
    documentIdsKey,
    state.contextKey,
    state.interactiveIds,
  ]);

  return state.contextKey === contextKey ? state.interactiveIds : new Set();
}
