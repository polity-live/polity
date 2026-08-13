/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  gridProps: undefined as Record<string, (...args: any[]) => any> | undefined,
  membershipPage: vi.fn((input: unknown) => ({ kind: 'page', input })),
  membershipById: vi.fn((input: unknown) => ({ kind: 'single', input })),
  cards: [] as Record<string, unknown>[],
}));

vi.mock('@/features/shared/virtualization', () => ({
  PolityZeroGridView: (props: Record<string, (...args: any[]) => any>) => {
    mocks.gridProps = props;
    return <div data-testid="grid" />;
  },
}));

vi.mock('@/zero/queries', () => ({
  queries: {
    groups: {
      membershipPageByUser: mocks.membershipPage,
      membershipById: mocks.membershipById,
    },
  },
}));

vi.mock('@/features/timeline/ui/cards/GroupTimelineCard', () => ({
  GroupTimelineCard: ({ group }: { group: Record<string, unknown> }) => {
    mocks.cards.push(group);
    return <div data-testid="group-card">{String(group.name)}</div>;
  },
}));

vi.mock('@/features/shared/logic/richText', () => ({
  richTextToPlainText: (value: unknown) => (typeof value === 'string' ? value : ''),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/features/shared/ui/form', () => ({
  FormControlInput: (props: Record<string, unknown>) => <input {...props} />,
}));

vi.mock('@/features/shared/ui/ui/skeleton', () => ({
  Skeleton: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

import { GroupsListTab } from '../GroupListTab';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.cards = [];
  mocks.gridProps = undefined;
});

afterEach(cleanup);

describe('GroupsListTab branch campaign A07', () => {
  it('wires search, paging TTLs, lane boundaries, row fallbacks, and empty renderers', () => {
    const onSearchChange = vi.fn();
    render(
      <GroupsListTab userId="user-7" searchValue="  civic  " onSearchChange={onSearchChange} />
    );
    fireEvent.change(screen.getByPlaceholderText('pages.user.groups.searchPlaceholder'), {
      target: { value: 'new query' },
    });
    expect(onSearchChange).toHaveBeenCalledWith('new query');

    const props = mocks.gridProps!;
    expect(props.context).toEqual({ userId: 'user-7', query: 'civic' });
    expect(props.getPageQuery({ limit: 10, start: null, dir: 'forward', settled: true })).toEqual(
      expect.objectContaining({ options: { ttl: '5m' } })
    );
    expect(props.getPageQuery({ limit: 10, start: null, dir: 'forward', settled: false })).toEqual(
      expect.objectContaining({ options: { ttl: 'none' } })
    );
    expect(props.getSingleQuery({ id: 'membership-1', settled: true })).toEqual(
      expect.objectContaining({ options: { ttl: '5m' } })
    );
    expect(props.getSingleQuery({ id: 'membership-1', settled: false })).toEqual(
      expect.objectContaining({ options: { ttl: 'none' } })
    );
    expect(props.getLanes(1024)).toBe(3);
    expect(props.getLanes(768)).toBe(2);
    expect(props.getLanes(767)).toBe(1);

    const membership = { id: 'membership-1', created_at: 42 };
    expect(props.getRowKey(membership)).toBe('membership-1');
    expect(props.toStartRow(membership)).toEqual({ created_at: 42, id: 'membership-1' });
    expect(props.renderRow({ ...membership, group: null }, 0)).toBeNull();

    const complete = props.renderRow(
      {
        ...membership,
        group: {
          id: 7,
          name: 'Civic Group',
          description: 'Description',
          member_count: 8,
          event_count: 4,
          amendment_count: 2,
        },
      },
      12
    );
    render(complete);
    expect(mocks.cards.at(-1)).toEqual({
      id: '7',
      name: 'Civic Group',
      description: 'Description',
      memberCount: 8,
      eventCount: 4,
      amendmentCount: 2,
    });

    const fallback = props.renderRow(
      {
        ...membership,
        group: {
          id: 'group-2',
          name: null,
          description: null,
          member_count: null,
          event_count: null,
          events: [{ id: 'event-1' }],
          amendment_count: null,
          amendments: [{ id: 'amendment-1' }],
        },
      },
      1
    );
    render(fallback);
    expect(mocks.cards.at(-1)).toEqual({
      id: 'group-2',
      name: '',
      description: undefined,
      memberCount: 0,
      eventCount: 1,
      amendmentCount: 1,
    });

    expect(props.renderSkeleton()).toBeTruthy();
    render(props.renderEmpty());
    expect(screen.getByText('pages.user.groups.noResults')).toBeTruthy();
  });
});
