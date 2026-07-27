/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: { id: 'user-a' } as { id: string } | null,
  navigate: vi.fn(),
  toastInfo: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string) => (key === 'components.pushNotifications.foreground.open' ? 'Öffnen' : key),
  }),
}));

vi.mock('@/features/notifications/utils/gated-toast', () => ({
  gatedToast: {
    info: (...args: unknown[]) => mocks.toastInfo(...args),
  },
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: mocks.user }),
}));

import {
  FOREGROUND_PUSH_MESSAGE_TYPE,
  ForegroundPushToastListener,
  parseForegroundPushMessage,
  sameOriginPushPath,
} from '../ui/ForegroundPushToastListener';

function installServiceWorkerMessages() {
  let listener: ((event: MessageEvent) => void) | undefined;
  const serviceWorker = {
    addEventListener: vi.fn((type: string, callback: (event: MessageEvent) => void) => {
      if (type === 'message') listener = callback;
    }),
    removeEventListener: vi.fn(),
  };
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: serviceWorker,
  });

  return {
    serviceWorker,
    getListener: () => listener,
  };
}

function foregroundMessage(
  notification: Record<string, unknown> = {
    title: 'Neue Abstimmung',
    body: 'Die Abstimmung ist jetzt geöffnet.',
    url: '/events/event-1?tab=voting#current',
    notificationId: 'notification-1',
    tag: 'voting-open',
  }
) {
  return {
    type: FOREGROUND_PUSH_MESSAGE_TYPE,
    notification,
  };
}

function acknowledgementPort() {
  return {
    postMessage: vi.fn(),
    close: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: 'user-a' };
  mocks.toastInfo.mockReturnValue('toast-1');
});

afterEach(cleanup);

describe('ForegroundPushToastListener', () => {
  it('shows, deduplicates and acknowledges a valid foreground push', () => {
    const browser = installServiceWorkerMessages();
    render(<ForegroundPushToastListener />);
    const port = acknowledgementPort();

    browser.getListener()?.({
      data: foregroundMessage(),
      ports: [port as unknown as MessagePort],
    } as unknown as MessageEvent);

    expect(mocks.toastInfo).toHaveBeenCalledWith('Neue Abstimmung', {
      description: 'Die Abstimmung ist jetzt geöffnet.',
      id: 'foreground-push:notification-1',
      action: {
        label: 'Öffnen',
        onClick: expect.any(Function),
      },
      testId: 'foreground-push-toast',
    });
    expect(port.postMessage).toHaveBeenCalledWith({ handled: true });
    expect(port.close).toHaveBeenCalledOnce();

    const options = mocks.toastInfo.mock.calls[0]?.[1] as {
      action: { onClick: () => void };
    };
    options.action.onClick();
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: '/events/event-1?tab=voting#current',
    });
  });

  it('uses the tag as the stable toast id when no notification id exists', () => {
    const browser = installServiceWorkerMessages();
    render(<ForegroundPushToastListener />);

    for (let index = 0; index < 2; index += 1) {
      browser.getListener()?.({
        data: foregroundMessage({
          title: 'Erinnerung',
          tag: 'same-reminder',
        }),
        ports: [acknowledgementPort() as unknown as MessagePort],
      } as unknown as MessageEvent);
    }

    expect(mocks.toastInfo).toHaveBeenCalledTimes(2);
    expect(mocks.toastInfo.mock.calls[0]?.[1]).toMatchObject({
      id: 'foreground-push:same-reminder',
    });
    expect(mocks.toastInfo.mock.calls[1]?.[1]).toMatchObject({
      id: 'foreground-push:same-reminder',
    });
  });

  it('does not acknowledge when the gated toast was not created', () => {
    mocks.toastInfo.mockReturnValue(undefined);
    const browser = installServiceWorkerMessages();
    render(<ForegroundPushToastListener />);
    const port = acknowledgementPort();

    browser.getListener()?.({
      data: foregroundMessage(),
      ports: [port as unknown as MessagePort],
    } as unknown as MessageEvent);

    expect(port.postMessage).not.toHaveBeenCalled();
    expect(port.close).toHaveBeenCalledOnce();
  });

  it('ignores malformed or unversioned events', () => {
    const browser = installServiceWorkerMessages();
    render(<ForegroundPushToastListener />);

    browser.getListener()?.({
      data: foregroundMessage({ title: '' }),
      ports: [acknowledgementPort() as unknown as MessagePort],
    } as unknown as MessageEvent);
    browser.getListener()?.({
      data: { type: 'polity:foreground-push:v0', notification: { title: 'Old' } },
      ports: [acknowledgementPort() as unknown as MessagePort],
    } as unknown as MessageEvent);

    expect(mocks.toastInfo).not.toHaveBeenCalled();
  });

  it('only registers while a user is authenticated and cleans up its listener', () => {
    const browser = installServiceWorkerMessages();
    mocks.user = null;
    const anonymous = render(<ForegroundPushToastListener />);
    expect(browser.serviceWorker.addEventListener).not.toHaveBeenCalled();
    anonymous.unmount();

    mocks.user = { id: 'user-a' };
    const authenticated = render(<ForegroundPushToastListener />);
    const listener = browser.getListener();
    expect(listener).toBeDefined();

    authenticated.unmount();
    expect(browser.serviceWorker.removeEventListener).toHaveBeenCalledWith('message', listener);
  });
});

describe('foreground push message validation', () => {
  it('parses the versioned event and rejects invalid values', () => {
    expect(parseForegroundPushMessage(foregroundMessage())).toMatchObject({
      title: 'Neue Abstimmung',
      notificationId: 'notification-1',
    });
    expect(parseForegroundPushMessage(null)).toBeNull();
    expect(parseForegroundPushMessage({ type: FOREGROUND_PUSH_MESSAGE_TYPE })).toBeNull();
    expect(parseForegroundPushMessage(foregroundMessage({ title: 123 }))).toBeNull();
  });

  it('allows only same-origin navigation targets', () => {
    expect(sameOriginPushPath('/notifications?filter=new#top')).toBe(
      '/notifications?filter=new#top'
    );
    expect(sameOriginPushPath(`${window.location.origin}/events/event-1`)).toBe('/events/event-1');
    expect(sameOriginPushPath('https://attacker.example/notifications')).toBeNull();
    expect(sameOriginPushPath('javascript:alert(1)')).toBeNull();
  });
});
