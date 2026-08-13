/* @vitest-environment jsdom */

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useProgressiveSearchCards } from '../useProgressiveSearchCards';

function Probe({
  contextKey = 'context',
  documentIds,
  stateReady = true,
}: {
  contextKey?: string;
  documentIds: string[];
  stateReady?: boolean;
}) {
  const ids = useProgressiveSearchCards({ contextKey, documentIds, stateReady });
  return <output data-testid="ids">{Array.from(ids).join(',')}</output>;
}

describe('useProgressiveSearchCards branch matrix', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('uses the timer fallback when idle callbacks are unavailable', () => {
    vi.stubGlobal('requestIdleCallback', undefined);
    vi.stubGlobal('cancelIdleCallback', undefined);
    render(<Probe documentIds={['one', 'two']} />);

    expect(screen.getByTestId('ids').textContent).toBe('');
    act(() => vi.advanceTimersByTime(16));
    expect(screen.getByTestId('ids').textContent).toBe('one');
    act(() => vi.advanceTimersByTime(16));
    expect(screen.getByTestId('ids').textContent).toBe('one,two');
  });

  it('does not schedule batches for an empty document list', () => {
    const idle = vi.fn();
    vi.stubGlobal('requestIdleCallback', idle);
    render(<Probe documentIds={[]} />);
    expect(idle).not.toHaveBeenCalled();
  });

  it('ignores a captured idle callback after cleanup and an exhausted callback', () => {
    let captured: IdleRequestCallback | undefined;
    vi.stubGlobal('requestIdleCallback', (callback: IdleRequestCallback) => {
      captured = callback;
      return 7;
    });
    vi.stubGlobal('cancelIdleCallback', vi.fn());

    const view = render(<Probe documentIds={['one']} />);
    expect(captured).toBeDefined();
    view.unmount();
    act(() => captured?.({ didTimeout: false, timeRemaining: () => 10 }));

    render(<Probe documentIds={['one']} />);
    act(() => {
      captured?.({ didTimeout: false, timeRemaining: () => 10 });
      captured?.({ didTimeout: false, timeRemaining: () => 10 });
    });
    expect(screen.getByTestId('ids').textContent).toBe('one');
  });
});
