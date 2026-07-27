/* @vitest-environment jsdom */

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { dismissMock, warningMock } = vi.hoisted(() => ({
  dismissMock: vi.fn(),
  warningMock: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    dismiss: dismissMock,
    warning: warningMock,
  },
}));

const ALPHA_WARNING_SESSION_KEY = 'polity.alphaWarning.0.10.1.acknowledged';
const ALPHA_WARNING_TOAST_ID = 'alpha-warning';
const APP_TUTORIAL_SESSION_CHANGE_EVENT = 'polity:app-tutorial-session-change';
const APP_TUTORIAL_SESSION_STORAGE_KEY = 'polity:app-tutorial-session-active';

interface AlphaWarningToastOptions {
  id?: string;
  description?: ReactNode;
  duration?: number;
  dismissible?: boolean;
  closeButton?: boolean;
  action?: {
    label?: ReactNode;
    onClick: () => void;
  };
}

async function renderAlphaWarningController() {
  const { useAlphaWarningDialogController } = await import('../useAlphaWarningDialogController');

  return renderHook(() => useAlphaWarningDialogController());
}

function latestToastOptions() {
  return warningMock.mock.calls.at(-1)?.[1] as AlphaWarningToastOptions | undefined;
}

function setTutorialSessionActive(active: boolean) {
  if (active) {
    window.sessionStorage.setItem(APP_TUTORIAL_SESSION_STORAGE_KEY, '1');
  } else {
    window.sessionStorage.removeItem(APP_TUTORIAL_SESSION_STORAGE_KEY);
  }
  window.dispatchEvent(new Event(APP_TUTORIAL_SESSION_CHANGE_EVENT));
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

describe('useAlphaWarningDialogController', () => {
  it('shows a persistent alpha warning and stores acknowledgement from the action', async () => {
    const { unmount } = await renderAlphaWarningController();

    await waitFor(() => expect(warningMock).toHaveBeenCalledTimes(1));
    const options = latestToastOptions();

    expect(options).toMatchObject({
      closeButton: false,
      dismissible: false,
      duration: Infinity,
      id: ALPHA_WARNING_TOAST_ID,
    });
    expect(options?.action?.onClick).toEqual(expect.any(Function));

    act(() => {
      options?.action?.onClick();
    });

    expect(window.sessionStorage.getItem(ALPHA_WARNING_SESSION_KEY)).toBe('true');
    expect(dismissMock).toHaveBeenCalledWith(ALPHA_WARNING_TOAST_ID);

    unmount();
    warningMock.mockClear();

    await renderAlphaWarningController();

    expect(warningMock).not.toHaveBeenCalled();
  });

  it('skips the alpha warning when the session has already acknowledged it', async () => {
    window.sessionStorage.setItem(ALPHA_WARNING_SESSION_KEY, 'true');

    await renderAlphaWarningController();

    expect(warningMock).not.toHaveBeenCalled();
  });

  it('suppresses the alpha warning during a tutorial without acknowledging it', async () => {
    setTutorialSessionActive(true);

    await renderAlphaWarningController();

    expect(warningMock).not.toHaveBeenCalled();
    expect(dismissMock).toHaveBeenCalledWith(ALPHA_WARNING_TOAST_ID);
    expect(window.sessionStorage.getItem(ALPHA_WARNING_SESSION_KEY)).toBeNull();
  });

  it('dismisses an existing warning when the tutorial starts and restores it afterwards', async () => {
    await renderAlphaWarningController();
    await waitFor(() => expect(warningMock).toHaveBeenCalledTimes(1));

    act(() => setTutorialSessionActive(true));

    expect(dismissMock).toHaveBeenCalledWith(ALPHA_WARNING_TOAST_ID);
    expect(window.sessionStorage.getItem(ALPHA_WARNING_SESSION_KEY)).toBeNull();

    act(() => setTutorialSessionActive(false));

    await waitFor(() => expect(warningMock).toHaveBeenCalledTimes(2));
  });
});
