/* @vitest-environment jsdom */

import { act, cleanup, render, screen } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LoadingProgressBar } from '../LoadingProgressBar';

const motionState = vi.hoisted(() => ({
  reducedMotion: false,
}));
let frameCallbacks: FrameRequestCallback[] = [];
let frameId = 0;
let originalRequestAnimationFrame: typeof window.requestAnimationFrame;
let originalCancelAnimationFrame: typeof window.cancelAnimationFrame;

vi.mock('motion/react', () => {
  const cleanMotionProps = ({
    initial,
    animate,
    transition,
    ...props
  }: Record<string, unknown>) => {
    const nextProps = { ...props };

    if (initial) {
      nextProps['data-initial'] = JSON.stringify(initial);
    }

    if (animate) {
      nextProps['data-animate'] = JSON.stringify(animate);
    }

    if (transition) {
      nextProps['data-transition'] = JSON.stringify(transition);
    }

    return nextProps;
  };

  return {
    motion: {
      div: ({ children, ...props }: ComponentProps<'div'> & { children?: ReactNode }) => (
        <div {...cleanMotionProps(props)}>{children}</div>
      ),
      span: ({ children, ...props }: ComponentProps<'span'> & { children?: ReactNode }) => (
        <span {...cleanMotionProps(props)}>{children}</span>
      ),
    },
    useReducedMotion: () => motionState.reducedMotion,
  };
});

beforeEach(() => {
  motionState.reducedMotion = false;
  frameCallbacks = [];
  frameId = 0;
  originalRequestAnimationFrame = window.requestAnimationFrame;
  originalCancelAnimationFrame = window.cancelAnimationFrame;
  window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
    frameCallbacks.push(callback);
    frameId += 1;
    return frameId;
  });
  window.cancelAnimationFrame = vi.fn();
});

afterEach(() => {
  cleanup();
  window.requestAnimationFrame = originalRequestAnimationFrame;
  window.cancelAnimationFrame = originalCancelAnimationFrame;
  vi.restoreAllMocks();
});

function runNextFrame(timestamp: number) {
  const callback = frameCallbacks.shift();
  if (!callback) {
    throw new Error('Expected a queued animation frame callback');
  }

  act(() => {
    callback(timestamp);
  });
}

function getOptimisticIndicator() {
  const indicator = document.querySelector<HTMLElement>(
    '[data-slot="loading-progress-optimistic-indicator"]'
  );

  if (!indicator) {
    throw new Error('Expected optimistic indicator to render');
  }

  return indicator;
}

describe('LoadingProgressBar', () => {
  it('renders an accessible indeterminate progress bar', () => {
    render(<LoadingProgressBar ariaLabel="Loading workspace" />);

    const progressbar = screen.getByRole('progressbar', { name: 'Loading workspace' });
    expect(progressbar.getAttribute('data-mode')).toBe('indeterminate');
    expect(progressbar.getAttribute('aria-valuenow')).toBeNull();
    expect(document.querySelector('[data-slot="loading-progress-active-indicator"]')).toBeTruthy();
  });

  it('hides unlabeled progress and renders a stable sweep for reduced motion', () => {
    motionState.reducedMotion = true;
    const { container } = render(<LoadingProgressBar />);
    const progress = container.querySelector('[data-slot="loading-progress-bar"]');
    expect(progress?.getAttribute('aria-hidden')).toBe('true');
    expect(
      container.querySelector('[data-slot="loading-progress-reduced-indicator"]')
    ).toBeTruthy();
  });

  it('renders optimistic indeterminate progress with an immediately visible rising fill', () => {
    render(<LoadingProgressBar ariaLabel="Loading workspace" motionStyle="optimistic" />);

    const progressbar = screen.getByRole('progressbar', { name: 'Loading workspace' });
    const indicator = getOptimisticIndicator();

    expect(progressbar.getAttribute('data-motion-style')).toBe('optimistic');
    expect(indicator.style.width).toBe('12%');

    runNextFrame(0);
    expect(Number.parseFloat(indicator.style.width)).toBe(12);

    runNextFrame(1800);
    expect(Number.parseFloat(indicator.style.width)).toBeGreaterThan(55);
    expect(Number.parseFloat(indicator.style.width)).toBeLessThan(65);
  });

  it('keeps optimistic progress monotonic and below the cap', () => {
    render(<LoadingProgressBar ariaLabel="Loading workspace" motionStyle="optimistic" />);

    const indicator = getOptimisticIndicator();

    runNextFrame(0);
    const firstWidth = Number.parseFloat(indicator.style.width);
    runNextFrame(900);
    const secondWidth = Number.parseFloat(indicator.style.width);
    runNextFrame(1800);
    const thirdWidth = Number.parseFloat(indicator.style.width);
    runNextFrame(90_000);
    const finalWidth = Number.parseFloat(indicator.style.width);

    expect(firstWidth).toBe(12);
    expect(secondWidth).toBeGreaterThan(firstWidth);
    expect(thirdWidth).toBeGreaterThan(secondWidth);
    expect(finalWidth).toBeGreaterThan(thirdWidth);
    expect(finalWidth).toBeLessThan(92);
    expect(indicator.style.width).not.toBe('100%');
  });

  it('renders optimistic reduced-motion progress as a stable partial fill', () => {
    motionState.reducedMotion = true;

    render(<LoadingProgressBar ariaLabel="Loading workspace" motionStyle="optimistic" />);

    const indicator = getOptimisticIndicator();

    expect(indicator.getAttribute('data-reduced-motion')).toBe('true');
    expect(indicator.style.width).toBe('62%');
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
  });

  it('clamps determinate values to the 0-100 range', () => {
    const { rerender } = render(<LoadingProgressBar ariaLabel="Import" value={142} />);

    let progressbar = screen.getByRole('progressbar', { name: 'Import' });
    let indicator = document.querySelector<HTMLElement>('[data-slot="loading-progress-indicator"]');

    expect(progressbar.getAttribute('data-mode')).toBe('determinate');
    expect(progressbar.getAttribute('aria-valuenow')).toBe('100');
    expect(indicator?.style.width).toBe('100%');

    rerender(<LoadingProgressBar ariaLabel="Import" value={-8} />);

    progressbar = screen.getByRole('progressbar', { name: 'Import' });
    indicator = document.querySelector<HTMLElement>('[data-slot="loading-progress-indicator"]');

    expect(progressbar.getAttribute('aria-valuenow')).toBe('0');
    expect(indicator?.style.width).toBe('0%');

    rerender(<LoadingProgressBar ariaLabel="Import" value={50} />);
    expect(
      document.querySelector<HTMLElement>('[data-slot="loading-progress-indicator"]')?.style.width
    ).toBe('50%');

    rerender(<LoadingProgressBar ariaLabel="Import" value={Number.NaN} />);
    expect(
      document.querySelector<HTMLElement>('[data-slot="loading-progress-indicator"]')?.style.width
    ).toBe('0%');
  });

  it('renders complete, active, and pending step segments', () => {
    render(
      <LoadingProgressBar
        ariaLabel="Submission"
        steps={[
          { key: 'prepare', label: 'Prepare', status: 'complete' },
          { key: 'commit', label: 'Commit', status: 'active' },
          { key: 'sync', label: <span>Sync</span> },
        ]}
      />
    );

    const progressbar = screen.getByRole('progressbar', { name: 'Submission' });
    const segments = Array.from(document.querySelectorAll('[data-slot="loading-progress-step"]'));

    expect(progressbar.getAttribute('data-mode')).toBe('steps');
    expect(segments).toHaveLength(3);
    expect(segments.map(segment => segment.getAttribute('data-status'))).toEqual([
      'complete',
      'active',
      'pending',
    ]);
    expect(document.querySelector('[data-slot="loading-progress-step-fill"]')).toBeTruthy();
    expect(document.querySelector('[data-slot="loading-progress-active-indicator"]')).toBeTruthy();
  });

  it('renders error step segments with destructive styling', () => {
    render(
      <LoadingProgressBar
        ariaLabel="Submission"
        steps={[
          { key: 'prepare', label: 'Prepare', status: 'complete' },
          { key: 'commit', label: 'Commit', status: 'error' },
          { key: 'sync', label: 'Sync', status: 'pending' },
        ]}
      />
    );

    const errorSegment = document.querySelector('[data-status="error"]');
    const errorFill = document.querySelector('[data-slot="loading-progress-step-error"]');

    expect(errorSegment?.className).toContain('bg-destructive/15');
    expect(errorFill?.className).toContain('bg-destructive');
  });
});
