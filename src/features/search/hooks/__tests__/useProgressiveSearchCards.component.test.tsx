/* @vitest-environment jsdom */

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useProgressiveSearchCards } from '../useProgressiveSearchCards';

interface ProbeProps {
  contextKey: string;
  documentIds: string[];
  stateReady: boolean;
  batchSize?: number;
}

function Probe(props: ProbeProps) {
  const interactiveIds = useProgressiveSearchCards(props);
  return <output data-testid="interactive-ids">{Array.from(interactiveIds).join(',')}</output>;
}

let nextIdleHandle = 1;
let idleCallbacks = new Map<number, IdleRequestCallback>();

function flushOneIdleTask() {
  const next = idleCallbacks.entries().next().value as [number, IdleRequestCallback] | undefined;
  if (!next) return;
  idleCallbacks.delete(next[0]);
  act(() =>
    next[1]({
      didTimeout: false,
      timeRemaining: () => 10,
    })
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  nextIdleHandle = 1;
  idleCallbacks = new Map();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal(
    'requestIdleCallback',
    vi.fn((callback: IdleRequestCallback, options?: IdleRequestOptions) => {
      expect(options?.timeout).toBe(250);
      const handle = nextIdleHandle++;
      idleCallbacks.set(handle, callback);
      return handle;
    })
  );
  vi.stubGlobal(
    'cancelIdleCallback',
    vi.fn((handle: number) => {
      idleCallbacks.delete(handle);
    })
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useProgressiveSearchCards', () => {
  it('activates no more than the two-card ceiling per idle task', () => {
    render(
      <Probe
        contextKey="search-a"
        documentIds={['one', 'two', 'three', 'four', 'five']}
        stateReady
        batchSize={2}
      />
    );

    expect(screen.getByTestId('interactive-ids').textContent).toBe('');
    flushOneIdleTask();
    expect(screen.getByTestId('interactive-ids').textContent).toBe('one,two');
    flushOneIdleTask();
    expect(screen.getByTestId('interactive-ids').textContent).toBe('one,two,three,four');
    flushOneIdleTask();
    expect(screen.getByTestId('interactive-ids').textContent).toBe('one,two,three,four,five');
  });

  it('forces activation after two seconds and cancels pending work on context change', () => {
    const view = render(
      <Probe contextKey="search-a" documentIds={['one', 'two', 'three']} stateReady={false} />
    );

    act(() => vi.advanceTimersByTime(1_999));
    expect(idleCallbacks.size).toBe(0);
    act(() => vi.advanceTimersByTime(1));
    expect(idleCallbacks.size).toBe(1);

    view.rerender(<Probe contextKey="search-b" documentIds={['other']} stateReady={false} />);

    expect(screen.getByTestId('interactive-ids').textContent).toBe('');
    expect(idleCallbacks.size).toBe(0);
    act(() => vi.advanceTimersByTime(2_000));
    flushOneIdleTask();
    expect(screen.getByTestId('interactive-ids').textContent).toBe('other');

    view.unmount();
    expect(idleCallbacks.size).toBe(0);
  });
});
