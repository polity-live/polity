/* @vitest-environment jsdom */

import { useMemo, useState, type ReactNode } from 'react';
import { Bell } from 'lucide-react';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/ui/navigation/SmartLink', () => ({
  SmartLink: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  isPlainLeftClick: () => true,
}));

import { renderComponentFlow } from '@/test/render-component-flow';
import { NotificationsList } from '../ui/NotificationsList';
import { getNotificationNavigationHref } from '../logic/notificationHelpers';

const notification = {
  id: 'notification-1',
  recipient_id: 'user-1',
  sender_id: null,
  sender: null,
  related_user: null,
  title: 'Dataset ready',
  message: 'Your projection is ready',
  type: 'system_notification',
  action_url: '/dataset/dataset-1',
  created_at: '2026-08-11T10:00:00.000Z',
  updated_at: '2026-08-11T10:00:00.000Z',
  is_read: false,
  deleted_at: null,
  notification_user_state: [],
} as any;

function NotificationFlow({ enabled = true }: { enabled?: boolean }) {
  const [rows, setRows] = useState(enabled ? [notification] : []);
  const [destination, setDestination] = useState('');
  const visible = useMemo(() => (enabled ? rows : []), [enabled, rows]);
  return (
    <>
      <NotificationsList
        notifications={visible}
        emptyIcon={Bell}
        emptyTitle="No notifications"
        emptyDescription="This notification type is disabled"
        onNotificationClick={row => {
          setDestination(getNotificationNavigationHref(row) ?? '');
          setRows(current =>
            current.map(item =>
              item.id === row.id
                ? { ...item, is_read: true, notification_user_state: [{ read_at: 'now' }] }
                : item
            )
          );
        }}
        onToggleRead={row =>
          setRows(current =>
            current.map(item =>
              item.id === row.id
                ? { ...item, is_read: !item.is_read, notification_user_state: [{ read_at: 'now' }] }
                : item
            )
          )
        }
        formatTime={() => 'now'}
      />
      <output aria-label="notification destination">{destination}</output>
    </>
  );
}

afterEach(cleanup);

describe('notifications component flow', () => {
  it('marks a notification as read from the list action', () => {
    renderComponentFlow(<NotificationFlow />);
    fireEvent.click(screen.getByRole('button', { name: /mark as read/i }));
    expect(screen.queryByText(/new/i)).toBeNull();
  });

  it('opens the persisted deep link and records the read state', () => {
    renderComponentFlow(<NotificationFlow />);
    fireEvent.click(screen.getByRole('link', { name: 'Dataset ready' }));
    expect(screen.getByLabelText('notification destination').textContent).toBe(
      '/dataset/dataset-1'
    );
    expect(screen.queryByText(/new/i)).toBeNull();
  });

  it('hides a disabled notification type before list rendering', () => {
    renderComponentFlow(<NotificationFlow enabled={false} />);
    expect(screen.getByText('No notifications')).toBeTruthy();
    expect(screen.queryByText('Dataset ready')).toBeNull();
  });
});
