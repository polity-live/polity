import { beforeEach } from 'vitest';
import { useLanguageStore } from '@/features/shared/global-state/language.store';

process.env.ZERO_UPSTREAM_DB ??= 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

beforeEach(() => {
  useLanguageStore.setState({ language: 'en' });
});

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

if (!('ResizeObserver' in globalThis)) {
  class ResizeObserverMock implements ResizeObserver {
    observe() {
      return undefined;
    }
    unobserve() {
      return undefined;
    }
    disconnect() {
      return undefined;
    }
  }

  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    value: ResizeObserverMock,
  });
}

await import('@/i18n/i18n');
export {};
