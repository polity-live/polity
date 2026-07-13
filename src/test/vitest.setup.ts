process.env.ZERO_UPSTREAM_DB ??= 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

if (!('navigation' in globalThis)) {
  let state: unknown = null;
  const listeners = new Set<EventListenerOrEventListenerObject>();
  Object.defineProperty(globalThis, 'navigation', {
    configurable: true,
    value: {
      currentEntry: { getState: () => state },
      updateCurrentEntry: ({ state: nextState }: { state: unknown }) => {
        state = nextState;
      },
      addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
        listeners.add(listener);
      },
      removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
        listeners.delete(listener);
      },
    },
  });
}

await import('@/i18n/i18n');
export {};
