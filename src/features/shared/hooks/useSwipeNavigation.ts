import { useCallback, useRef, type KeyboardEvent, type PointerEvent, type TouchEvent } from 'react';
import {
  useHorizontalArrowNavigation,
  type HorizontalArrowNavigationMode,
} from './useHorizontalArrowNavigation';

const DEFAULT_SWIPE_LOCK_SELECTOR = [
  'input',
  'textarea',
  'select',
  'button',
  'a',
  '[role="button"]',
  '[contenteditable]',
  '[data-swipe-lock]',
].join(',');

export type SwipeActivationMode = 'content' | 'edge';

export interface UseSwipeNavigationOptions {
  enabled?: boolean;
  disabled?: boolean;
  canSwipeNext?: boolean;
  canSwipePrev?: boolean;
  onSwipeNext?: () => void | Promise<void>;
  onSwipePrev?: () => void | Promise<void>;
  thresholdPx?: number;
  restraintRatio?: number;
  activationMode?: SwipeActivationMode;
  edgeWidthPx?: number;
  lockSelector?: string;
  keyboardMode?: HorizontalArrowNavigationMode;
  keyboardLockSelector?: string;
}

export interface SwipeNavigationHandlers {
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  onTouchStart: (event: TouchEvent<HTMLElement>) => void;
  onTouchMove: (event: TouchEvent<HTMLElement>) => void;
  onTouchEnd: (event: TouchEvent<HTMLElement>) => void;
  onTouchCancel: () => void;
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLElement>) => void;
  onPointerCancel: () => void;
}

interface SwipeStartPosition {
  x: number;
  y: number;
  pointerId?: number;
}

function shouldIgnoreSwipeTarget(target: EventTarget | null, lockSelector: string) {
  return target instanceof Element && Boolean(target.closest(lockSelector));
}

function startsInActivationZone(
  x: number,
  activationMode: SwipeActivationMode,
  edgeWidthPx: number
) {
  if (activationMode === 'content') {
    return true;
  }

  if (typeof window === 'undefined') {
    return false;
  }

  return x <= edgeWidthPx || x >= window.innerWidth - edgeWidthPx;
}

function isClearHorizontalSwipe({
  deltaX,
  deltaY,
  thresholdPx,
  restraintRatio,
}: {
  deltaX: number;
  deltaY: number;
  thresholdPx: number;
  restraintRatio: number;
}) {
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);

  return absX >= thresholdPx && absX > absY * restraintRatio;
}

export function useSwipeNavigation({
  enabled = true,
  disabled = false,
  canSwipeNext = true,
  canSwipePrev = true,
  onSwipeNext,
  onSwipePrev,
  thresholdPx = 60,
  restraintRatio = 1.35,
  activationMode = 'content',
  edgeWidthPx = 32,
  lockSelector = DEFAULT_SWIPE_LOCK_SELECTOR,
  keyboardMode = 'off',
  keyboardLockSelector,
}: UseSwipeNavigationOptions) {
  const startPositionRef = useRef<SwipeStartPosition | null>(null);
  const isActive = enabled && !disabled;
  const { onKeyDown } = useHorizontalArrowNavigation({
    mode: keyboardMode,
    enabled,
    disabled,
    canGoPrev: canSwipePrev,
    canGoNext: canSwipeNext,
    onGoPrev: onSwipePrev,
    onGoNext: onSwipeNext,
    lockSelector: keyboardLockSelector,
  });

  const reset = useCallback(() => {
    startPositionRef.current = null;
  }, []);

  const canStartSwipe = useCallback(
    (x: number, target: EventTarget | null) => {
      return (
        isActive &&
        !shouldIgnoreSwipeTarget(target, lockSelector) &&
        startsInActivationZone(x, activationMode, edgeWidthPx)
      );
    },
    [activationMode, edgeWidthPx, isActive, lockSelector]
  );

  const maybePreventHorizontalScroll = useCallback(
    (
      event: { cancelable: boolean; preventDefault: () => void },
      position: { x: number; y: number }
    ) => {
      const startPosition = startPositionRef.current;
      if (!isActive || !startPosition) {
        return;
      }

      const deltaX = position.x - startPosition.x;
      const deltaY = position.y - startPosition.y;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      if (absX > 12 && absX > absY * restraintRatio && event.cancelable) {
        event.preventDefault();
      }
    },
    [isActive, restraintRatio]
  );

  const finishSwipe = useCallback(
    (position: { x: number; y: number }) => {
      const startPosition = startPositionRef.current;
      if (!isActive || !startPosition) {
        reset();
        return;
      }

      const deltaX = position.x - startPosition.x;
      const deltaY = position.y - startPosition.y;
      const isHorizontalSwipe = isClearHorizontalSwipe({
        deltaX,
        deltaY,
        thresholdPx,
        restraintRatio,
      });

      reset();

      if (!isHorizontalSwipe) {
        return;
      }

      if (deltaX < 0 && canSwipeNext) {
        void onSwipeNext?.();
      } else if (deltaX > 0 && canSwipePrev) {
        void onSwipePrev?.();
      }
    },
    [
      canSwipeNext,
      canSwipePrev,
      isActive,
      onSwipeNext,
      onSwipePrev,
      reset,
      restraintRatio,
      thresholdPx,
    ]
  );

  const onTouchStart = useCallback(
    (event: TouchEvent<HTMLElement>) => {
      if (event.touches.length !== 1) {
        reset();
        return;
      }

      const touch = event.touches[0];
      if (!canStartSwipe(touch.clientX, event.target)) {
        reset();
        return;
      }

      startPositionRef.current = { x: touch.clientX, y: touch.clientY };
    },
    [canStartSwipe, reset]
  );

  const onTouchMove = useCallback(
    (event: TouchEvent<HTMLElement>) => {
      if (!isActive || !startPositionRef.current) {
        return;
      }

      if (event.touches.length !== 1) {
        reset();
        return;
      }

      const touch = event.touches[0];
      maybePreventHorizontalScroll(event, { x: touch.clientX, y: touch.clientY });
    },
    [isActive, maybePreventHorizontalScroll, reset]
  );

  const onTouchEnd = useCallback(
    (event: TouchEvent<HTMLElement>) => {
      const touch = event.changedTouches[0];
      if (!touch) {
        reset();
        return;
      }

      finishSwipe({ x: touch.clientX, y: touch.clientY });
    },
    [finishSwipe, reset]
  );

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (event.pointerType !== 'pen' || !canStartSwipe(event.clientX, event.target)) {
        reset();
        return;
      }

      event.currentTarget.setPointerCapture?.(event.pointerId);
      startPositionRef.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    },
    [canStartSwipe, reset]
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const startPosition = startPositionRef.current;
      if (
        !isActive ||
        !startPosition ||
        startPosition.pointerId === undefined ||
        startPosition.pointerId !== event.pointerId
      ) {
        return;
      }

      maybePreventHorizontalScroll(event, { x: event.clientX, y: event.clientY });
    },
    [isActive, maybePreventHorizontalScroll]
  );

  const onPointerUp = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const startPosition = startPositionRef.current;
      if (
        !startPosition ||
        startPosition.pointerId === undefined ||
        startPosition.pointerId !== event.pointerId
      ) {
        reset();
        return;
      }

      finishSwipe({ x: event.clientX, y: event.clientY });
    },
    [finishSwipe, reset]
  );

  const handlers: SwipeNavigationHandlers = {
    onKeyDown,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel: reset,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: reset,
  };

  return { handlers };
}
