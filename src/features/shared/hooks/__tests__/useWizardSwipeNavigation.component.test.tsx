/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

import {
  useWizardSwipeNavigation,
  type UseWizardSwipeNavigationOptions,
} from '../useWizardSwipeNavigation';

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
  window.dispatchEvent(new Event('resize'));
}

function SwipeTarget({
  children,
  ...options
}: UseWizardSwipeNavigationOptions & { children?: ReactNode }) {
  const { handlers } = useWizardSwipeNavigation(options);

  return (
    <div data-testid="swipe-target" {...handlers}>
      {children ?? 'Swipe content'}
    </div>
  );
}

function swipe(
  element: HTMLElement,
  {
    startX,
    endX,
    startY = 100,
    endY = 104,
  }: {
    startX: number;
    endX: number;
    startY?: number;
    endY?: number;
  }
) {
  fireEvent.touchStart(element, {
    touches: [{ clientX: startX, clientY: startY }],
  });
  fireEvent.touchMove(element, {
    touches: [{ clientX: endX, clientY: endY }],
  });
  fireEvent.touchEnd(element, {
    changedTouches: [{ clientX: endX, clientY: endY }],
  });
}

beforeEach(() => {
  setViewportWidth(390);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('useWizardSwipeNavigation', () => {
  it('maps left swipes to next and right swipes to previous', () => {
    const onSwipeNext = vi.fn();
    const onSwipePrev = vi.fn();

    render(<SwipeTarget onSwipeNext={onSwipeNext} onSwipePrev={onSwipePrev} />);
    const target = screen.getByTestId('swipe-target');

    swipe(target, { startX: 260, endX: 120 });
    expect(onSwipeNext).toHaveBeenCalledTimes(1);
    expect(onSwipePrev).not.toHaveBeenCalled();

    swipe(target, { startX: 120, endX: 260 });
    expect(onSwipePrev).toHaveBeenCalledTimes(1);
  });

  it('ignores short and vertical swipes', () => {
    const onSwipeNext = vi.fn();
    const onSwipePrev = vi.fn();

    render(<SwipeTarget onSwipeNext={onSwipeNext} onSwipePrev={onSwipePrev} />);
    const target = screen.getByTestId('swipe-target');

    swipe(target, { startX: 160, endX: 118 });
    swipe(target, { startX: 160, endX: 120, startY: 80, endY: 220 });

    expect(onSwipeNext).not.toHaveBeenCalled();
    expect(onSwipePrev).not.toHaveBeenCalled();
  });

  it('respects disabled state but remains active at desktop viewport widths', () => {
    const onSwipeNext = vi.fn();

    const { rerender } = render(<SwipeTarget disabled onSwipeNext={onSwipeNext} />);
    const target = screen.getByTestId('swipe-target');

    swipe(target, { startX: 260, endX: 120 });
    expect(onSwipeNext).not.toHaveBeenCalled();

    setViewportWidth(1280);
    rerender(<SwipeTarget onSwipeNext={onSwipeNext} />);
    swipe(target, { startX: 260, endX: 120 });

    expect(onSwipeNext).toHaveBeenCalledTimes(1);
  });

  it('ignores gestures that begin on interactive controls', () => {
    const onSwipeNext = vi.fn();

    render(
      <SwipeTarget onSwipeNext={onSwipeNext}>
        <button type="button">Ignore me</button>
      </SwipeTarget>
    );

    swipe(screen.getByRole('button', { name: 'Ignore me' }), { startX: 260, endX: 120 });

    expect(onSwipeNext).not.toHaveBeenCalled();
  });
});
