/* @vitest-environment jsdom */

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NetworkViewportPanel } from '../NetworkViewportPanel';

let animationFrameCallback: FrameRequestCallback | undefined;

beforeEach(() => {
  animationFrameCallback = undefined;
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((callback: FrameRequestCallback) => {
      animationFrameCallback = callback;
      return 1;
    })
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('NetworkViewportPanel', () => {
  it('provides a concrete height before the viewport measurement runs', () => {
    render(
      <NetworkViewportPanel>
        <div>Graph</div>
      </NetworkViewportPanel>
    );

    const panel = screen.getByText('Graph').parentElement;

    expect(panel?.style.height).toBe('384px');
    expect(panel?.classList.contains('min-h-[24rem]')).toBe(true);
  });

  it('replaces the initial height with the measured viewport height', () => {
    render(
      <NetworkViewportPanel>
        <div>Graph</div>
      </NetworkViewportPanel>
    );

    const panel = screen.getByText('Graph').parentElement as HTMLDivElement;
    vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue({
      bottom: 484,
      height: 384,
      left: 0,
      right: 100,
      top: 100,
      width: 100,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    });

    act(() => animationFrameCallback?.(0));

    expect(panel.style.height).toBe(`${window.innerHeight - 101}px`);
  });
});
