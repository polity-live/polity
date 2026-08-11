/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { Bell } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Notification } from '../../types/notification.types';
import { NotificationsList, type NotificationVirtualQuery } from '../NotificationsList';

const mocks = vi.hoisted(() => ({
  itemProps: [] as Record<string, unknown>[],
  page: vi.fn((input: unknown) => ({ kind: 'page', input })),
  byId: vi.fn((input: unknown) => ({ kind: 'single', input })),
}));

vi.mock('@/zero/queries', () => ({
  queries: { notifications: { page: mocks.page, byId: mocks.byId } },
}));

vi.mock('@/zero/notifications/notificationReadState', () => ({
  isNotificationActive: (row: TestRow) => row.active,
  isNotificationDismissed: (row: TestRow) => row.dismissed,
  isNotificationPurged: (row: TestRow) => row.purged,
  isNotificationRead: (row: TestRow) => row.read,
}));

vi.mock('../NotificationItem', () => ({
  NotificationItem: (props: Record<string, unknown>) => {
    mocks.itemProps.push(props);
    return <div data-testid="notification-item">{String((props.notification as TestRow).id)}</div>;
  },
}));

type TestRow = Notification & {
  active: boolean;
  dismissed: boolean;
  purged: boolean;
  read: boolean;
};

const virtualRows: TestRow[] = [
  row('active-unread', { active: true }),
  row('active-read', { active: true, read: true }),
  row('inactive', {}),
  row('trash', { dismissed: true }),
  row('purged', { dismissed: true, purged: true }),
];

vi.mock('@/features/shared/virtualization', () => ({
  PolityZeroListView: (props: {
    context: unknown;
    historyKey: string;
    getRowKey: (row: TestRow) => string;
    toStartRow: (row: TestRow) => unknown;
    getPageQuery: (input: Record<string, unknown>) => unknown;
    getSingleQuery: (input: Record<string, unknown>) => unknown;
    renderRow: (row: TestRow, index: number) => ReactNode;
    renderSkeleton: (index: number) => ReactNode;
    renderEmpty: () => ReactNode;
  }) => (
    <section data-testid="virtual-list" data-context={JSON.stringify(props.context)}>
      <span>{props.historyKey}</span>
      <span>{props.getRowKey(virtualRows[0]!)}</span>
      <span>{JSON.stringify(props.toStartRow(virtualRows[0]!))}</span>
      <span>
        {JSON.stringify(
          props.getPageQuery({ limit: 5, start: null, dir: 'forward', settled: false })
        )}
      </span>
      <span>
        {JSON.stringify(
          props.getPageQuery({ limit: 5, start: null, dir: 'forward', settled: true })
        )}
      </span>
      <span>{JSON.stringify(props.getSingleQuery({ id: 'one', settled: false }))}</span>
      <span>{JSON.stringify(props.getSingleQuery({ id: 'one', settled: true }))}</span>
      {virtualRows.map((item, index) => (
        <div key={item.id}>{props.renderRow(item, index)}</div>
      ))}
      {props.renderSkeleton(0)}
      {props.renderEmpty()}
    </section>
  ),
}));

function row(id: string, overrides: Partial<TestRow> = {}): TestRow {
  return {
    id,
    type: 'membership_request',
    title: id,
    message: id,
    created_at: 123,
    is_read: false,
    active: false,
    dismissed: false,
    purged: false,
    read: false,
    ...overrides,
  } as TestRow;
}

function props(overrides: Partial<ComponentProps<typeof NotificationsList>> = {}) {
  return {
    emptyIcon: Bell,
    emptyTitle: 'Nothing here',
    emptyDescription: 'No matching notifications',
    onNotificationClick: vi.fn(),
    ...overrides,
  };
}

function virtualQuery(
  tab: NotificationVirtualQuery['tab'],
  overrides = {}
): NotificationVirtualQuery {
  return { key: tab, tab, searchQuery: '  needle  ', ...overrides };
}

afterEach(() => {
  cleanup();
  mocks.itemProps.length = 0;
  vi.clearAllMocks();
});

describe('NotificationsList coverage', () => {
  it.each([
    ['all', ['active-unread', 'active-read']],
    ['unread', ['active-unread']],
    ['read', ['active-read']],
    ['trash', ['trash']],
  ] as const)('filters virtual %s rows and evaluates both query cache policies', (tab, ids) => {
    render(
      <NotificationsList
        {...props({
          virtualQuery: virtualQuery(tab, {
            entityId: tab === 'all' ? 'entity-1' : undefined,
            entityType: tab === 'all' ? 'group' : undefined,
            permalinkID: 'notification-1',
          }),
          canDeleteForEveryone:
            tab === 'trash' ? undefined : notification => notification.id === 'active-unread',
        })}
      />
    );

    expect(screen.getByTestId('virtual-list')).toBeTruthy();
    expect(screen.getAllByTestId('notification-item').map(item => item.textContent)).toEqual(ids);
    expect(document.body.textContent).toContain('"ttl":"none"');
    expect(document.body.textContent).toContain('"ttl":"5m"');
    expect(mocks.page).toHaveBeenCalled();
    expect(mocks.byId).toHaveBeenCalled();
  });

  it('renders static empty and populated lists with default and explicit capabilities', () => {
    const { rerender } = render(<NotificationsList {...props()} />);
    expect(screen.getByText('Nothing here')).toBeTruthy();

    rerender(
      <NotificationsList
        {...props({
          notifications: [row('first'), row('second')],
          mode: 'entity',
          showRecipientBadge: false,
          canDeleteForEveryone: notification =>
            notification.id === 'first' ? true : (undefined as unknown as boolean),
        })}
      />
    );
    expect(screen.getAllByTestId('notification-item')).toHaveLength(2);
    expect(mocks.itemProps.at(-2)?.canDeleteForEveryone).toBe(true);
    expect(mocks.itemProps.at(-1)?.canDeleteForEveryone).toBe(false);

    rerender(<NotificationsList {...props({ notifications: [row('without-capability')] })} />);
    expect(mocks.itemProps.at(-1)?.canDeleteForEveryone).toBe(false);
  });
});
