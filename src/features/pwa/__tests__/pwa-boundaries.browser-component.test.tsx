import { beforeEach, describe, expect, it } from 'vitest';

import {
  FOREGROUND_PUSH_MESSAGE_TYPE,
  parseForegroundPushMessage,
  sameOriginPushPath,
} from '../ui/ForegroundPushToastListener';
import { getPushDeviceId, isStandalonePwa } from '../push-device';

describe('PWA browser boundaries', () => {
  beforeEach(() => window.localStorage.clear());

  it('persists one browser-scoped push device id', () => {
    const first = getPushDeviceId();
    const second = getPushDeviceId();

    expect(first).toMatch(/^[0-9a-f-]{36}$/i);
    expect(second).toBe(first);
    expect(typeof isStandalonePwa()).toBe('boolean');
  });

  it('accepts same-origin push routes and rejects external origins', () => {
    expect(sameOriginPushPath('/notifications?tab=unread#latest')).toBe(
      '/notifications?tab=unread#latest'
    );
    expect(sameOriginPushPath('https://example.com/notifications')).toBeNull();
  });

  it('parses the foreground service-worker message contract', () => {
    expect(
      parseForegroundPushMessage({
        type: FOREGROUND_PUSH_MESSAGE_TYPE,
        notification: {
          title: 'New notification',
          body: 'Open Polity',
          url: '/notifications',
        },
      })
    ).toEqual({
      title: 'New notification',
      body: 'Open Polity',
      url: '/notifications',
      notificationId: undefined,
      notificationType: undefined,
      tag: undefined,
    });
    expect(parseForegroundPushMessage({ type: FOREGROUND_PUSH_MESSAGE_TYPE })).toBeNull();
  });
});
