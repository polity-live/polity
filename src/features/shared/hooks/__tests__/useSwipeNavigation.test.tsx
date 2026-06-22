/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

import { useSwipeNavigation, type UseSwipeNavigationOptions } from '../useSwipeNavigation';

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
}

function SwipeTarget({
  children,
  ...options
}: UseSwipeNavigationOptions & { children?: ReactNode }) {
  const { handlers } = useSwipeNavigation(options);

  return (
    <div data-testid="swipe-target" {...handlers}>
      {children ?? 'Swipe content'}
    </div>
  );
}

function touchSwipe(
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

function penSwipe(element: HTMLElement, startX: number, endX: number) {
  dispatchPointerEvent(element, 'pointerdown', {
    pointerId: 7,
    pointerType: 'pen',
    clientX: startX,
    clientY: 100,
  });
  dispatchPointerEvent(element, 'pointermove', {
    pointerId: 7,
    pointerType: 'pen',
    clientX: endX,
    clientY: 104,
  });
  dispatchPointerEvent(element, 'pointerup', {
    pointerId: 7,
    pointerType: 'pen',
    clientX: endX,
    clientY: 104,
  });
}

function dispatchPointerEvent(
  element: HTMLElement,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  init: { pointerId: number; pointerType: string; clientX: number; clientY: number }
) {
  const event = new Event(type, { bubbles: true, cancelable: true });

  Object.defineProperties(event, {
    pointerId: { value: init.pointerId },
    pointerType: { value: init.pointerType },
    clientX: { value: init.clientX },
    clientY: { value: init.clientY },
  });

  fireEvent(element, event);
}

beforeEach(() => {
  setViewportWidth(1280);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('useSwipeNavigation', () => {
  it('maps touch left swipes to next and right swipes to previous at desktop widths', () => {
    const onSwipeNext = vi.fn();
    const onSwipePrev = vi.fn();

    render(<SwipeTarget onSwipeNext={onSwipeNext} onSwipePrev={onSwipePrev} />);
    const target = screen.getByTestId('swipe-target');

    touchSwipe(target, { startX: 300, endX: 160 });
    expect(onSwipeNext).toHaveBeenCalledTimes(1);
    expect(onSwipePrev).not.toHaveBeenCalled();

    touchSwipe(target, { startX: 160, endX: 300 });
    expect(onSwipePrev).toHaveBeenCalledTimes(1);
  });

  it('ignores vertical movement, short movement, disabled state, multi-touch, and locked targets', () => {
    const onSwipeNext = vi.fn();

    const { rerender } = render(
      <SwipeTarget onSwipeNext={onSwipeNext}>
        <div data-swipe-lock>Locked area</div>
      </SwipeTarget>
    );
    const target = screen.getByTestId('swipe-target');

    touchSwipe(target, { startX: 260, endX: 220 });
    touchSwipe(target, { startX: 260, endX: 120, startY: 70, endY: 230 });

    fireEvent.touchStart(target, {
      touches: [
        { clientX: 260, clientY: 100 },
        { clientX: 250, clientY: 110 },
      ],
    });
    fireEvent.touchEnd(target, {
      changedTouches: [{ clientX: 120, clientY: 104 }],
    });

    touchSwipe(screen.getByText('Locked area'), { startX: 260, endX: 120 });

    rerender(<SwipeTarget disabled onSwipeNext={onSwipeNext} />);
    touchSwipe(target, { startX: 260, endX: 120 });

    expect(onSwipeNext).not.toHaveBeenCalled();
  });

  it('supports edge activation and pen swipes without accepting mouse drags', () => {
    const onSwipeNext = vi.fn();

    render(<SwipeTarget activationMode="edge" edgeWidthPx={48} onSwipeNext={onSwipeNext} />);
    const target = screen.getByTestId('swipe-target');

    touchSwipe(target, { startX: 640, endX: 500 });
    expect(onSwipeNext).not.toHaveBeenCalled();

    touchSwipe(target, { startX: 32, endX: 180 });
    expect(onSwipeNext).not.toHaveBeenCalled();

    touchSwipe(target, { startX: 1240, endX: 1080 });
    expect(onSwipeNext).toHaveBeenCalledTimes(1);

    dispatchPointerEvent(target, 'pointerdown', {
      pointerId: 3,
      pointerType: 'mouse',
      clientX: 1240,
      clientY: 100,
    });
    dispatchPointerEvent(target, 'pointerup', {
      pointerId: 3,
      pointerType: 'mouse',
      clientX: 1080,
      clientY: 104,
    });
    expect(onSwipeNext).toHaveBeenCalledTimes(1);

    penSwipe(target, 1240, 1080);
    expect(onSwipeNext).toHaveBeenCalledTimes(2);
  });

  it('can map global arrow keys to the same previous and next callbacks', () => {
    const onSwipeNext = vi.fn();
    const onSwipePrev = vi.fn();

    render(
      <SwipeTarget keyboardMode="global" onSwipeNext={onSwipeNext} onSwipePrev={onSwipePrev} />
    );

    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(onSwipeNext).toHaveBeenCalledTimes(1);
    expect(onSwipePrev).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    expect(onSwipePrev).toHaveBeenCalledTimes(1);
  });

  it('supports scoped arrow keys while preserving focused controls', () => {
    const onSwipeNext = vi.fn();

    render(
      <SwipeTarget keyboardMode="scoped" onSwipeNext={onSwipeNext}>
        <input aria-label="Local input" />
      </SwipeTarget>
    );
    const target = screen.getByTestId('swipe-target');

    fireEvent.keyDown(target, { key: 'ArrowRight' });
    expect(onSwipeNext).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(screen.getByLabelText('Local input'), { key: 'ArrowRight' });
    expect(onSwipeNext).toHaveBeenCalledTimes(1);
  });
});
