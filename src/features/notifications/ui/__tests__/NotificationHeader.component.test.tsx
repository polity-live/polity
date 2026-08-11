/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NotificationHeader } from '../NotificationHeader';

vi.mock('@/features/shared/ui/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick, ...props }: ComponentProps<'button'>) => (
    <button type="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

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

  it('dispatches bulk read-state actions through stable header intents', () => {
    const onMarkAllAsRead = vi.fn();
    const onMarkAllAsUnread = vi.fn();
    const { container } = render(
      <NotificationHeader
        unreadCount={2}
        onMarkAllAsRead={onMarkAllAsRead}
        onMarkAllAsUnread={onMarkAllAsUnread}
      />
    );

    const markRead = container.querySelector(
      '[data-action-id="notifications.header.mark-all.read"]'
    );
    const menu = container.querySelector('[data-action-id="notifications.header.menu.open"]');
    fireEvent.click(markRead!);
    fireEvent.click(menu!);
    fireEvent.click(screen.getByText('features.notifications.markAllAsUnread'));

    expect(onMarkAllAsRead).toHaveBeenCalledOnce();
    expect(onMarkAllAsUnread).toHaveBeenCalledOnce();
  });
});
