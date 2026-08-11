/* @vitest-environment jsdom */

import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));
vi.mock('@/features/shared/ui/navigation/SmartLink.tsx', () => ({
  SmartLink: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('@/features/shared/ui/ui/card', () => ({
  Card: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  CardHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  CardTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));
vi.mock('@/features/shared/ui/ui/avatar', () => ({
  Avatar: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  AvatarFallback: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  AvatarImage: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
}));
vi.mock('@/features/shared/ui/status', () => ({
  EntityBadge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  getEntityBadgeSurfaceClassName: (type: string) => `badge-${type}`,
}));
vi.mock('@/features/shared/ui/data-table', () => ({
  DataTable: ({ columns, data, emptyTitle, getRowId }: any) => (
    <div>
      {data.length === 0 ? <span>{emptyTitle}</span> : null}
      {data.map((item: any) => (
        <span key={`id-${item.subscription.id}`} data-row-id={getRowId(item)} />
      ))}
      {columns.map((column: any, index: number) => (
        <div key={column.id ?? column.accessorKey}>
          {typeof column.header === 'function' ? column.header() : column.header}
          {data.map((item: any) => (
            <div key={`${item.subscription.id}-${index}`}>
              {column.cell({ row: { original: item } })}
            </div>
          ))}
        </div>
      ))}
    </div>
  ),
}));

import { SubscriptionsTable, type SubscriptionRow } from '../SubscriptionsTable';

afterEach(cleanup);

describe('SubscriptionsTable', () => {
  it('renders every entity, fallback, link, avatar, date, and action branch', () => {
    const rows: SubscriptionRow[] = [
      {
        id: 'user-full',
        created_at: '2026-01-02',
        user: { first_name: 'Ada', last_name: 'Lovelace', avatar: '/ada.png' },
      },
      { id: 'user-fallback', user: {} },
      { id: 'group-full', group: { name: 'Civic', image_url: '/group.png' } },
      { id: 'group-fallback', group: {} },
      { id: 'amendment-full', amendment: { title: 'Budget', image_url: '/a.png' } },
      { id: 'amendment-fallback', amendment: {} },
      { id: 'event-full', event: { title: 'Assembly', image_url: '/e.png' } },
      { id: 'event-fallback', event: {} },
      { id: 'blog-full', blog: { title: 'News', image_url: '/b.png' } },
      { id: 'blog-fallback', blog: {} },
      { id: 'unknown' },
    ];
    const onUnsubscribe = vi.fn();
    const { container } = render(
      <SubscriptionsTable
        subscriptions={rows}
        onUnsubscribe={onUnsubscribe}
        getSubscriptionHref={row => (row.id.endsWith('full') ? `/entity/${row.id}` : null)}
      />
    );

    expect(screen.getByText('Ada Lovelace')).toBeTruthy();
    expect(screen.getByText('features.payments.subscriptions.unknown.user')).toBeTruthy();
    expect(screen.getByText('features.payments.subscriptions.unknown.entity')).toBeTruthy();
    expect(
      container.querySelectorAll('[data-action-id="payments.subscriptions.entity.open"]')
    ).toHaveLength(5);
    const actions = container.querySelectorAll('[data-action-id="payments.subscriptions.remove"]');
    expect(actions).toHaveLength(rows.length);
    fireEvent.click(actions[10]);
    expect(onUnsubscribe).toHaveBeenCalledWith('unknown');
    expect(screen.getAllByText('features.payments.subscriptions.notAvailable')).toHaveLength(10);
  });

  it('renders custom and default empty messages', () => {
    const props = { subscriptions: [], onUnsubscribe: vi.fn(), getSubscriptionHref: vi.fn() };
    const custom = render(<SubscriptionsTable {...props} emptyMessage="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeTruthy();
    custom.unmount();
    render(<SubscriptionsTable {...props} />);
    expect(
      screen.getByText(
        'generated.inline.0129_no_subscriptions_found_start_following_users__12823014'
      )
    ).toBeTruthy();
  });
});
