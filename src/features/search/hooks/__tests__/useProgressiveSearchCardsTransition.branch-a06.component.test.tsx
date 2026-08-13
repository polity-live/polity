/* @vitest-environment jsdom */

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const transitionCallbacks = vi.hoisted(() => [] as (() => void)[]);

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    startTransition: (callback: () => void) => transitionCallbacks.push(callback),
  };
});

import { useProgressiveSearchCards } from '../useProgressiveSearchCards';

function Probe({ contextKey }: { contextKey: string }) {
  const ids = useProgressiveSearchCards({
    contextKey,
    documentIds: ['one'],
    stateReady: true,
  });
  return <output data-testid="ids">{Array.from(ids).join(',')}</output>;
}

describe('useProgressiveSearchCards concurrent transition guard', () => {
  let idleCallback: IdleRequestCallback | undefined;

  beforeEach(() => {
    transitionCallbacks.length = 0;
    idleCallback = undefined;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('requestIdleCallback', (callback: IdleRequestCallback) => {
      idleCallback = callback;
      return 2;
    });
    vi.stubGlobal('cancelIdleCallback', vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('ignores a deferred batch after the card context has changed', () => {
    const view = render(<Probe contextKey="old-context" />);
    act(() => idleCallback?.({ didTimeout: false, timeRemaining: () => 10 }));
    expect(transitionCallbacks).toHaveLength(1);

    view.rerender(<Probe contextKey="new-context" />);
    act(() => transitionCallbacks[0]?.());

    expect(screen.getByTestId('ids').textContent).toBe('');
  });
});
