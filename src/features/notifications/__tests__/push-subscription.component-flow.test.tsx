/* @vitest-environment jsdom */

import { useState } from 'react';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { renderComponentFlow } from '@/test/render-component-flow';
import { PushNotificationToggleView } from '../ui/PushNotificationToggleView';

const t = (key: string) => key;

function PushFlow({ permission = 'granted' }: { permission?: NotificationPermission }) {
  const [subscribed, setSubscribed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <PushNotificationToggleView
      variant="settings"
      showDescription
      showDiagnostics
      t={t}
      isSupported
      isSubscribed={subscribed}
      isLoading={false}
      permission={permission}
      error={error}
      serviceWorkerReady
      serverSynchronized={subscribed}
      requiresIosInstall={false}
      testState={null}
      testLoading={false}
      handleToggle={async () => {
        if (permission !== 'granted') {
          setError('Permission denied');
          return;
        }
        setSubscribed(current => !current);
      }}
      handleTest={async () => undefined}
    />
  );
}

afterEach(cleanup);

describe('push subscription component flow', () => {
  it('registers and reflects a synchronized push subscription', () => {
    renderComponentFlow(<PushFlow />);
    fireEvent.click(screen.getByRole('button', { name: /activate/i }));
    expect(screen.getByRole('button', { name: /active/i })).toBeTruthy();
    expect(screen.getByText(/synchronized/i)).toBeTruthy();
  });

  it('keeps the subscription disabled and exposes permission failure', () => {
    renderComponentFlow(<PushFlow permission="default" />);
    fireEvent.click(screen.getByRole('button', { name: /activate/i }));
    expect(screen.getByText('Permission denied')).toBeTruthy();
    expect(screen.getByRole('button', { name: /activate/i })).toBeTruthy();
  });
});
