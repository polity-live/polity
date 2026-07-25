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

const ALPHA_WARNING_SESSION_KEY = 'polity.alphaWarning.0.9.1.acknowledged';
const ALPHA_WARNING_TOAST_ID = 'alpha-warning';

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
});
