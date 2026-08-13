/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Users } from 'lucide-react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  bloggerById: vi.fn((input: unknown) => ({ input, query: 'blog-single' })),
  bloggerPage: vi.fn((input: unknown) => ({ input, query: 'blog-page' })),
  collaborationById: vi.fn((input: unknown) => ({ input, query: 'amendment-single' })),
  collaborationPage: vi.fn((input: unknown) => ({ input, query: 'amendment-page' })),
  membershipById: vi.fn((input: unknown) => ({ input, query: 'group-single' })),
  membershipPage: vi.fn((input: unknown) => ({ input, query: 'group-page' })),
  participantById: vi.fn((input: unknown) => ({ input, query: 'event-single' })),
  participantPage: vi.fn((input: unknown) => ({ input, query: 'event-page' })),
  viewProps: undefined as Record<string, unknown> | undefined,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

vi.mock('@/features/shared/logic/membershipRoleHelpers', () => ({
  getMembershipRoleNames: (item: { roleNames?: string[] }) => item.roleNames ?? [],
}));

vi.mock('@/features/shared/logic/richText', () => ({
  richTextToPlainText: (value: unknown) => (typeof value === 'string' ? value : ''),
}));

vi.mock('@/features/shared/ui/navigation/SmartLink.tsx', () => ({
  SmartLink: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/features/shared/ui/data-table', () => ({
  EntityCell: ({
    description,
    leading,
    title,
  }: {
    description?: string;
    leading: ReactNode;
    title: string;
  }) => (
    <div>
      {leading}
      <span>{title}</span>
      {description ? <small>{description}</small> : null}
    </div>
  ),
}));

vi.mock('@/features/shared/ui/status', () => ({
  EntityBadge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock('@/features/shared/ui/ui/avatar', () => ({
  Avatar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AvatarFallback: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  AvatarImage: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
}));

vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/features/shared/ui/dialog', () => ({
  DangerConfirmDialog: ({
    confirmLabel,
    onConfirm,
    onOpenChange,
    open,
    title,
  }: {
    confirmLabel: string;
    onConfirm: () => void;
    onOpenChange: (open: boolean) => void;
    open: boolean;
    title: string;
  }) => (
    <div data-testid="danger-dialog" data-open={String(open)} data-title={title}>
      <button type="button" aria-label="keep dialog open" onClick={() => onOpenChange(true)} />
      <button type="button" aria-label="close dialog" onClick={() => onOpenChange(false)} />
      <button type="button" aria-label="confirm dialog" onClick={onConfirm}>
        {confirmLabel}
      </button>
    </div>
  ),
}));

vi.mock('../InvitationActions', () => ({
  InvitationActions: () => <button type="button">invitation actions</button>,
}));

vi.mock('../MembershipStatusTableView', () => ({
  MembershipStatusTableView: (props: Record<string, unknown>) => {
    mocks.viewProps = props;
    return <div data-testid="membership-table-view" />;
  },
}));

vi.mock('@/zero/queries', () => ({
  queries: {
    groups: {
      membershipById: mocks.membershipById,
      membershipPageByUser: mocks.membershipPage,
    },
    events: {
      participantById: mocks.participantById,
      participantPageByUser: mocks.participantPage,
    },
    amendments: {
      collaboratorById: mocks.collaborationById,
      collaborationPageByUser: mocks.collaborationPage,
    },
    blogs: {
      bloggerPageById: mocks.bloggerById,
      bloggerMembershipPageByUser: mocks.bloggerPage,
    },
  },
}));

import { MembershipStatusTable } from '../MembershipStatusTable';

type EntityKey = 'group' | 'event' | 'amendment' | 'blog';
interface Column {
  id: string;
  cell: (input: { row: { original: Record<string, unknown> } }) => ReactNode;
}
interface VirtualSource {
  context: Record<string, unknown>;
  getPageQuery: (input: Record<string, unknown>) => { options: { ttl: string } };
  getSingleQuery: (input: Record<string, unknown>) => { options: { ttl: string } };
  getRowKey: (row: Record<string, unknown>) => unknown;
  mapRow: (row: Record<string, unknown>) => Record<string, unknown>;
  toStartRow: (row: Record<string, unknown>) => Record<string, unknown>;
}

function captured() {
  return mocks.viewProps as unknown as {
    columns: Column[];
    getEntityData: (item: Record<string, unknown>) => Record<string, unknown> | null;
    getEntityImage: (entity: Record<string, unknown> | null) => string | undefined;
    getEntityName: (entity: Record<string, unknown> | null) => string;
    buildDefaultEntityHref: (entity: Record<string, unknown> | null) => string | null;
    virtualSource?: VirtualSource;
  };
}

function itemFor(
  entityKey: EntityKey,
  entity: Record<string, unknown> | null,
  id = `${entityKey}-row`
) {
  return {
    id,
    created_at: Date.parse('2026-08-01T00:00:00Z'),
    [entityKey]: entity,
  };
}

function renderTable({
  entityKey,
  item = itemFor(entityKey, { id: `${entityKey}-1`, name: `${entityKey} name` }),
  statusType = 'active',
  userId = 'user-1',
  ...callbacks
}: {
  entityKey: EntityKey;
  item?: Record<string, unknown>;
  statusType?: 'active' | 'invited' | 'requested';
  userId?: string;
  onLeave?: (id: string) => void;
  onWithdraw?: (id: string) => void;
  getEntityHref?: (entity: unknown, item: unknown) => string | null;
}) {
  return render(
    <MembershipStatusTable
      title="Memberships"
      description="Membership rows"
      icon={Users}
      items={[item] as never}
      statusType={statusType}
      entityKey={entityKey}
      fallbackIcon={Users}
      userId={userId || undefined}
      searchQuery="climate"
      {...callbacks}
    />
  );
}

function renderCell(id: string, row: Record<string, unknown>) {
  const column = captured().columns.find(entry => entry.id === id)!;
  const view = column.cell({ row: { original: row } });
  return render(<>{view}</>);
}

describe('MembershipStatusTable branch campaign A07', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.viewProps = undefined;
  });

  afterEach(cleanup);

  it.each([
    ['group', '/group/group-1'],
    ['event', '/event/event-1'],
    ['amendment', '/amendment/amendment-1'],
    ['blog', null],
  ] as const)(
    'resolves %s entities, links, virtual queries and row adapters',
    (entityKey, href) => {
      const row = itemFor(entityKey, {
        id: `${entityKey}-1`,
        name: `${entityKey} name`,
        description: 'About this membership',
        image_url: `${entityKey}.png`,
      });
      renderTable({ entityKey, item: row });

      expect(captured().getEntityData(row)).toMatchObject({ id: `${entityKey}-1` });
      expect(captured().getEntityData({ id: 'missing-relation' })).toBeNull();
      expect(captured().getEntityImage(captured().getEntityData(row))).toBe(`${entityKey}.png`);
      expect(captured().buildDefaultEntityHref(captured().getEntityData(row))).toBe(href);

      const source = captured().virtualSource!;
      expect(source.context).toMatchObject({ entityKey, query: 'climate', userId: 'user-1' });
      expect(source.getRowKey(row)).toBe(row.id);
      expect(source.toStartRow(row)).toEqual({ created_at: row.created_at, id: row.id });
      expect(source.mapRow({ id: row.id })).toBe(row);
      expect(source.mapRow({ id: 'server-only' })).toEqual({ id: 'server-only' });
      expect(
        source.getPageQuery({ limit: 10, start: null, dir: 'forward', settled: false }).options.ttl
      ).toBe('none');
      expect(
        source.getPageQuery({ limit: 10, start: null, dir: 'forward', settled: true }).options.ttl
      ).toBe('5m');
      expect(source.getSingleQuery({ id: row.id, settled: false }).options.ttl).toBe('none');
      expect(source.getSingleQuery({ id: row.id, settled: true }).options.ttl).toBe('5m');

      renderCell('entity', row);
      expect(screen.getByText(`${entityKey} name`)).toBeTruthy();
      expect(screen.getByText('About this membership')).toBeTruthy();
      expect(screen.getByRole('img', { name: `${entityKey} name` })).toBeTruthy();
      if (href) expect(screen.getByRole('link').getAttribute('href')).toBe(href);
      else expect(screen.queryByRole('link')).toBeNull();
    }
  );

  it('covers entity fallbacks, custom hrefs, roles and creation dates', () => {
    const row = {
      ...itemFor('group', { id: 'group-1', title: 'Title fallback', image_url: null }),
      roleNames: ['Admin', 'Owner'],
      created_at: null,
    };
    const customHref = vi.fn(() => '/custom/group');
    renderTable({ entityKey: 'group', item: row, getEntityHref: customHref });

    expect(captured().getEntityName(null)).toBe('pages.user.memberships.sections.unknownEntity');
    expect(captured().getEntityName({ id: 'x', name: '', title: 'Title fallback' })).toBe(
      'Title fallback'
    );
    expect(captured().getEntityName({ id: 'x', name: '', title: '' })).toBe(
      'pages.user.memberships.sections.unknownEntity'
    );
    expect(captured().getEntityImage(null)).toBeUndefined();
    expect(captured().getEntityImage({ id: 'x', image_url: null })).toBeUndefined();
    expect(captured().buildDefaultEntityHref(null)).toBeNull();

    renderCell('entity', row);
    expect(screen.getByRole('link').getAttribute('href')).toBe('/custom/group');
    cleanup();
    renderCell('role', row);
    expect(screen.getByText('Admin')).toBeTruthy();
    expect(screen.getByText('Owner')).toBeTruthy();
    cleanup();
    renderCell('created', row);
    expect(screen.getByText('components.membershipTables.notAvailable')).toBeTruthy();

    cleanup();
    const noRoleRow = { ...row, roleNames: [] };
    renderCell('role', noRoleRow);
    expect(screen.getByText('Member')).toBeTruthy();
  });

  it('renders invited, requested and active action/date variants', () => {
    const invitedRow = itemFor('event', { id: 'event-1', title: 'Assembly' });
    const invited = renderTable({ entityKey: 'event', item: invitedRow, statusType: 'invited' });
    renderCell('actions', invitedRow);
    expect(screen.getByText('invitation actions')).toBeTruthy();
    renderCell('created', invitedRow);
    expect(screen.getByText(new Date(invitedRow.created_at).toLocaleDateString())).toBeTruthy();
    invited.unmount();

    const requestedRow = itemFor('event', null, 'request-1');
    renderTable({ entityKey: 'event', item: requestedRow, statusType: 'requested' });
    renderCell('entity', requestedRow);
    expect(screen.getByText('pages.user.memberships.sections.unknownEntity')).toBeTruthy();

    cleanup();
    renderTable({ entityKey: 'blog', statusType: 'active', userId: '' });
    expect(captured().virtualSource).toBeUndefined();
  });

  it('confirms leave and withdraw, supports closing, and safely ignores absent callbacks', () => {
    const onLeave = vi.fn();
    const row = itemFor('group', { id: 'group-1', name: 'Group' }, 'membership-1');
    renderTable({ entityKey: 'group', item: row, onLeave });

    fireEvent.click(screen.getByRole('button', { name: 'confirm dialog' }));
    expect(onLeave).not.toHaveBeenCalled();
    renderCell('actions', row);
    fireEvent.click(screen.getByText('generated.inline.1197_leave_7e3520a9'));
    expect(screen.getByTestId('danger-dialog').dataset.open).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'keep dialog open' }));
    fireEvent.click(screen.getByRole('button', { name: 'confirm dialog' }));
    expect(onLeave).toHaveBeenCalledWith('membership-1');

    cleanup();
    const onWithdraw = vi.fn();
    const request = itemFor('amendment', { id: 'amendment-1', title: 'Proposal' }, 'request-1');
    renderTable({ entityKey: 'amendment', item: request, statusType: 'requested', onWithdraw });
    const firstRequestActions = renderCell('actions', request);
    fireEvent.click(screen.getByText('generated.inline.1198_withdraw_request_898cc3e4'));
    fireEvent.click(screen.getByRole('button', { name: 'close dialog' }));
    expect(onWithdraw).not.toHaveBeenCalled();
    firstRequestActions.unmount();
    renderCell('actions', request);
    fireEvent.click(screen.getByText('generated.inline.1198_withdraw_request_898cc3e4'));
    fireEvent.click(screen.getByRole('button', { name: 'confirm dialog' }));
    expect(onWithdraw).toHaveBeenCalledWith('request-1');

    cleanup();
    renderTable({ entityKey: 'group', item: row });
    renderCell('actions', row);
    fireEvent.click(screen.getByText('generated.inline.1197_leave_7e3520a9'));
    fireEvent.click(screen.getByRole('button', { name: 'confirm dialog' }));
  });
});
