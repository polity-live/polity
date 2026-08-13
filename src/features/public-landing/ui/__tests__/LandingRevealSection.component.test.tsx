/* @vitest-environment jsdom */

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LandingRevealSection } from '../LandingRevealSection';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('LandingRevealSection', () => {
  it('reveals once through IntersectionObserver using transform and opacity classes', () => {
    let intersectionCallback: IntersectionObserverCallback | undefined;
    const disconnect = vi.fn();
    class IntersectionObserverMock {
      constructor(callback: IntersectionObserverCallback) {
        intersectionCallback = callback;
      }
      observe = vi.fn();
      disconnect = disconnect;
      unobserve = vi.fn();
      takeRecords = vi.fn(() => []);
      root = null;
      rootMargin = '120px 0px';
      thresholds = [0.08];
    }
    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock);

    render(
      <LandingRevealSection>
        <div>Story</div>
      </LandingRevealSection>
    );
    const section = screen.getByText('Story').closest('section');
    expect(section?.classList.contains('translate-y-3')).toBe(true);
    expect(section?.classList.contains('opacity-0')).toBe(true);

    act(() => {
      intersectionCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    });

    expect(section?.classList.contains('translate-y-0')).toBe(true);
    expect(section?.classList.contains('opacity-100')).toBe(true);
    expect(section?.className).toContain('transition-[opacity,transform]');
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
