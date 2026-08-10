/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PushNotificationToggleView } from '../PushNotificationToggleView';

function createProps(
  overrides: Partial<ComponentProps<typeof PushNotificationToggleView>> = {}
): ComponentProps<typeof PushNotificationToggleView> {
  return {
    variant: 'default',
    showDescription: true,
    showDiagnostics: false,
    t: key => key,
    isSupported: true,
    isSubscribed: false,
    isLoading: false,
    permission: 'granted',
    error: null,
    serviceWorkerReady: true,
    serverSynchronized: true,
    requiresIosInstall: false,
    testState: null,
    testLoading: false,
    handleToggle: vi.fn().mockResolvedValue(undefined),
    handleTest: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

afterEach(cleanup);

describe('PushNotificationToggleView', () => {
  it('dispatches each visible push variant through a stable toggle intent', () => {
    const variants = [
      ['card', 'notifications.push.toggle.card'],
      ['settings', 'notifications.push.toggle.settings'],
      ['default', 'notifications.push.toggle.inline'],
      ['minimal', 'notifications.push.toggle.inline'],
    ] as const;

    for (const [variant, actionId] of variants) {
      const handleToggle = vi.fn().mockResolvedValue(undefined);
      const { container, unmount } = render(
        <PushNotificationToggleView {...createProps({ variant, handleToggle })} />
      );
      const toggle = container.querySelector(`[data-action-id="${actionId}"]`);
      expect(toggle).toBeTruthy();
      fireEvent.click(toggle!);
      expect(handleToggle).toHaveBeenCalledOnce();
      unmount();
    }
  });

  it('dispatches diagnostics and exposes deterministic unavailable states', () => {
    const handleTest = vi.fn().mockResolvedValue(undefined);
    const { container, rerender } = render(
      <PushNotificationToggleView
        {...createProps({
          variant: 'settings',
          showDiagnostics: true,
          isSubscribed: true,
          handleTest,
        })}
      />
    );
    fireEvent.click(
      container.querySelector('[data-action-id="notifications.push-test.send.current-device"]')!
    );
    expect(handleTest).toHaveBeenCalledOnce();

    rerender(
      <PushNotificationToggleView {...createProps({ variant: 'minimal', isSupported: false })} />
    );
    expect(
      container.querySelector('[data-action-id="notifications.push-unavailable.show.browser"]')
    ).toHaveProperty('disabled', true);

    rerender(
      <PushNotificationToggleView {...createProps({ variant: 'minimal', permission: 'denied' })} />
    );
    expect(
      container.querySelector('[data-action-id="notifications.push-unavailable.show.permission"]')
    ).toHaveProperty('disabled', true);
  });

  it('renders install, full unsupported, and full denied notices', () => {
    const { container, rerender } = render(
      <PushNotificationToggleView {...createProps({ requiresIosInstall: true })} />
    );
    expect(container.textContent).toContain('components.pushNotifications.iosInstallRequired');

    rerender(
      <PushNotificationToggleView
        {...createProps({ variant: 'card', isSupported: false, showDiagnostics: true })}
      />
    );
    expect(container.textContent).toContain('components.pushNotifications.notSupported');

    rerender(
      <PushNotificationToggleView
        {...createProps({ variant: 'settings', permission: 'denied', showDiagnostics: true })}
      />
    );
    expect(container.textContent).toContain('components.pushNotifications.blockedLong');
  });

  it('covers card content, loading toggle, descriptions, diagnostics, and errors', () => {
    const { container, rerender } = render(
      <PushNotificationToggleView
        {...createProps({
          variant: 'card',
          isSubscribed: true,
          isLoading: true,
          showDiagnostics: true,
          error: 'push failed',
          serviceWorkerReady: false,
          serverSynchronized: false,
          testLoading: true,
          testState: { status: 'pending', error: 'failure' },
        })}
      />
    );
    expect(container.querySelector('.lucide-loader-circle')).toBeTruthy();
    expect(container.textContent).toContain('push failed');
    expect(container.textContent).toContain(
      'components.pushNotifications.test.backgroundInstruction'
    );

    rerender(
      <PushNotificationToggleView
        {...createProps({
          variant: 'card',
          showDescription: false,
          showDiagnostics: true,
          permission: 'default',
          testState: { status: 'skipped', skipReason: 'no_endpoint' },
        })}
      />
    );
    expect(container.textContent).toContain(
      'components.pushNotifications.test.skipReasons.no_endpoint'
    );
    expect(container.textContent).not.toContain('components.pushNotifications.description');
  });

  it('covers settings and inline optional content in both subscription states', () => {
    const { container, rerender } = render(
      <PushNotificationToggleView
        {...createProps({
          variant: 'settings',
          isSubscribed: false,
          showDiagnostics: false,
          error: 'settings error',
        })}
      />
    );
    expect(container.textContent).toContain('settings error');

    rerender(
      <PushNotificationToggleView
        {...createProps({
          variant: 'default',
          isSubscribed: true,
          showDescription: true,
          showDiagnostics: true,
          testState: { status: 'sent' },
        })}
      />
    );
    expect(container.textContent).toContain('components.pushNotifications.enabledDescriptionShort');

    rerender(
      <PushNotificationToggleView
        {...createProps({ variant: 'default', showDescription: false, error: 'inline error' })}
      />
    );
    expect(container.textContent).toContain('inline error');
  });
});
