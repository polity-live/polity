/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NotificationHeader } from '../NotificationHeader';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      key === 'features.notifications.titleVersion'
        ? 'Notifications'
        : key === 'features.notifications.markAllAsRead'
          ? 'Mark all as read'
          : key,
  }),
}));

vi.mock('@/features/notifications/ui/push-notification-toggle.tsx', () => ({
  PushNotificationToggle: () => <button type="button">Activate notifications</button>,
}));

afterEach(cleanup);

describe('NotificationHeader', () => {
  it('renders an sr-only route title and only visible notification actions', () => {
    render(<NotificationHeader unreadCount={2} onMarkAllAsRead={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Notifications' }).className).toContain('sr-only');
    expect(screen.getByRole('button', { name: 'Activate notifications' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mark all as read' })).toBeTruthy();
  });
});
