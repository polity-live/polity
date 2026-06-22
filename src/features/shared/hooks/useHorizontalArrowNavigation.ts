import { useCallback, useEffect, type KeyboardEvent as ReactKeyboardEvent } from 'react';

export type HorizontalArrowNavigationMode = 'global' | 'scoped' | 'off';

export const INTERACTIVE_HORIZONTAL_ARROW_NAVIGATION_LOCK_SELECTOR = [
  'input',
  'textarea',
  'select',
  '[contenteditable]',
  '[contenteditable="true"]',
  '[role="textbox"]',
  '[role="combobox"]',
  '[role="searchbox"]',
  '[role="spinbutton"]',
  '[role="slider"]',
  '[role="listbox"]',
  '[role="menu"]',
  '[role="menubar"]',
  '[role="grid"]',
  '[role="tree"]',
  '[role="tablist"]',
].join(',');

export const DEFAULT_HORIZONTAL_ARROW_NAVIGATION_LOCK_SELECTOR = [
  INTERACTIVE_HORIZONTAL_ARROW_NAVIGATION_LOCK_SELECTOR,
  '[data-swipe-lock]',
  '[data-arrow-keys="local"]',
  '[data-keyboard-nav-lock]',
].join(',');

interface HorizontalArrowKeyEvent {
  altKey: boolean;
  ctrlKey: boolean;
  defaultPrevented: boolean;
  key: string;
  metaKey: boolean;
  shiftKey: boolean;
  target: EventTarget | null;
  preventDefault: () => void;
}

export interface UseHorizontalArrowNavigationOptions {
  mode?: HorizontalArrowNavigationMode;
  enabled?: boolean;
  disabled?: boolean;
  canGoPrev?: boolean;
  canGoNext?: boolean;
  onGoPrev?: () => void | Promise<void>;
  onGoNext?: () => void | Promise<void>;
  lockSelector?: string;
}

export interface HorizontalArrowNavigationHandlers {
  onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void;
}

export function shouldIgnoreHorizontalArrowNavigationTarget(
  target: EventTarget | null,
  lockSelector = DEFAULT_HORIZONTAL_ARROW_NAVIGATION_LOCK_SELECTOR
) {
  return target instanceof Element && Boolean(target.closest(lockSelector));
}

function hasModifierKey(event: HorizontalArrowKeyEvent) {
  return event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
}

function handleHorizontalArrowNavigationEvent(
  event: HorizontalArrowKeyEvent,
  {
    enabled = true,
    disabled = false,
    canGoPrev = true,
    canGoNext = true,
    onGoPrev,
    onGoNext,
    lockSelector = DEFAULT_HORIZONTAL_ARROW_NAVIGATION_LOCK_SELECTOR,
  }: UseHorizontalArrowNavigationOptions
) {
  if (!enabled || disabled || event.defaultPrevented || hasModifierKey(event)) {
    return false;
  }

  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
    return false;
  }

  if (shouldIgnoreHorizontalArrowNavigationTarget(event.target, lockSelector)) {
    return false;
  }

  if (event.key === 'ArrowLeft' && canGoPrev && onGoPrev) {
    event.preventDefault();
    void onGoPrev();
    return true;
  }

  if (event.key === 'ArrowRight' && canGoNext && onGoNext) {
    event.preventDefault();
    void onGoNext();
    return true;
  }

  return false;
}

export function useHorizontalArrowNavigation({
  mode = 'scoped',
  enabled = true,
  disabled = false,
  canGoPrev = true,
  canGoNext = true,
  onGoPrev,
  onGoNext,
  lockSelector = DEFAULT_HORIZONTAL_ARROW_NAVIGATION_LOCK_SELECTOR,
}: UseHorizontalArrowNavigationOptions): HorizontalArrowNavigationHandlers {
  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      handleHorizontalArrowNavigationEvent(event, {
        enabled,
        disabled,
        canGoPrev,
        canGoNext,
        onGoPrev,
        onGoNext,
        lockSelector,
      });
    },
    [enabled, disabled, canGoPrev, canGoNext, onGoPrev, onGoNext, lockSelector]
  );

  useEffect(() => {
    if (mode !== 'global' || !enabled || disabled || typeof document === 'undefined') {
      return;
    }

    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      handleHorizontalArrowNavigationEvent(event, {
        enabled,
        disabled,
        canGoPrev,
        canGoNext,
        onGoPrev,
        onGoNext,
        lockSelector,
      });
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [mode, enabled, disabled, canGoPrev, canGoNext, onGoPrev, onGoNext, lockSelector]);

  return {
    onKeyDown: mode === 'off' ? () => undefined : handleKeyDown,
  };
}
