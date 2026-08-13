/* @vitest-environment jsdom */

import { cleanup, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DelegatesOverview } from '../DelegatesOverview';
import { DelegatesOverviewView } from '../DelegatesOverviewView';
import { useDelegatesOverviewController } from '../useDelegatesOverviewController';

const mocks = vi.hoisted(() => ({ event: null as any }));

vi.mock('@/zero/events/useEventState', () => ({
  useEventDelegates: () => ({ event: mocks.event }),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

afterEach(() => cleanup());
beforeEach(() => {
  mocks.event = null;
});

function delegate(id: string, groupId: string, status: string, firstName: string) {
  return {
    id,
    group_id: groupId,
    status,
    group: { id: groupId, name: groupId === 'group-a' ? 'Alpha' : 'Beta', member_count: 12 },
    user: {
      id: `user-${id}`,
      first_name: firstName,
      last_name: 'Member',
      handle: firstName.toLowerCase(),
    },
  };
}

describe('DelegatesOverview', () => {
  it('derives sorted subgroup allocations and status buckets from event facade data', () => {
    mocks.event = {
      id: 'event-1',
      delegate_finalized_at: null,
      delegate_allocations: [
        {
          group_id: 'group-b',
          allocated_seats: 1,
          group: { id: 'group-b', name: 'Beta', member_count: 8 },
        },
        {
          group_id: 'group-a',
          allocated_seats: 2,
          group: { id: 'group-a', name: 'Alpha', member_count: 12 },
        },
        { group_id: 'ignored', allocated_seats: 3, group: null },
      ],
      delegates: [
        delegate('confirmed', 'group-a', 'confirmed', 'Ada'),
        delegate('nominated', 'group-a', 'nominated', 'Grace'),
        delegate('standby', 'group-b', 'standby', 'Linus'),
      ],
    };
    const { result } = renderHook(() =>
      useDelegatesOverviewController({ eventId: 'event-1', groupId: 'parent-1' })
    );
    expect(result.current.subgroups.map(group => group.name)).toEqual(['Alpha', 'Beta']);
    expect(result.current.delegatesByGroup[0]).toMatchObject({
      allocation: 2,
      confirmedDelegates: [{ id: 'confirmed' }],
      nominatedDelegates: [{ id: 'nominated' }],
      standbyDelegates: [],
    });
    expect(result.current.delegatesByGroup[1].standbyDelegates[0].id).toBe('standby');
  });

  it('uses empty and unnamed subgroup fallbacks from partial facade data', () => {
    const { result, rerender } = renderHook(() =>
      useDelegatesOverviewController({ eventId: 'event-1' })
    );
    expect(result.current.delegates).toEqual([]);
    expect(result.current.allocations).toEqual([]);
    expect(result.current.isDelegatesFinalized).toBeUndefined();

    mocks.event = {
      delegate_allocations: [
        {
          group_id: 'group-a',
          allocated_seats: null,
          group: { id: 'group-a', name: '', member_count: null },
        },
      ],
      delegates: [
        { id: 'ignored', group_id: 'ignored', status: 'confirmed', group: null },
        {
          id: 'group-a-delegate',
          group_id: 'group-a',
          status: 'other',
          group: { id: 'group-a', name: '', member_count: null },
        },
      ],
    };
    rerender();
    expect(result.current.subgroups).toEqual([
      { id: 'group-a', name: 'Untergruppe', memberCount: 0 },
    ]);
    expect(result.current.delegatesByGroup[0]).toMatchObject({ allocation: 0 });
  });

  it('renders pending and finalized delegate categories as well as empty states', () => {
    const group = { id: 'group-a', name: 'Alpha', memberCount: 12 };
    const confirmed = delegate('confirmed', 'group-a', 'confirmed', 'Ada');
    const nominated = delegate('nominated', 'group-a', 'nominated', 'Grace');
    const standby = delegate('standby', 'group-a', 'standby', 'Linus');
    const props: any = {
      eventId: 'event-1',
      groupId: 'parent-1',
      event: {},
      delegates: [confirmed, nominated, standby],
      allocations: [],
      groupsById: new Map(),
      subgroups: [group],
      delegatesByGroup: [
        {
          subgroup: group,
          allocation: 2,
          delegates: [confirmed, nominated, standby],
          confirmedDelegates: [confirmed],
          nominatedDelegates: [nominated],
          standbyDelegates: [standby],
        },
      ],
      isDelegatesFinalized: null,
    };
    const { rerender } = render(<DelegatesOverviewView {...props} />);
    expect(screen.getByText('Ada Member')).toBeTruthy();
    expect(screen.getByText('Grace Member')).toBeTruthy();
    expect(screen.getByText('Linus Member')).toBeTruthy();
    expect(screen.getByText('generated.inline.0370_pending_96f608c1')).toBeTruthy();

    rerender(<DelegatesOverviewView {...props} isDelegatesFinalized={123} />);
    expect(screen.getByText('generated.inline.0369_finalized_876126b1')).toBeTruthy();
    expect(screen.queryByText('Grace Member')).toBeNull();
    rerender(<DelegatesOverviewView {...props} subgroups={[]} delegatesByGroup={[]} />);
    expect(
      screen.getByText('generated.inline.0366_no_subgroups_found_for_this_group_2ac808e6')
    ).toBeTruthy();
  });

  it('renders safe user and singular-allocation fallbacks in every delegate bucket', () => {
    const group = { id: 'group-a', name: 'Alpha', memberCount: 1 };
    const unknown = (id: string, status: string) => ({
      id,
      group_id: 'group-a',
      status,
      user: null,
    });
    render(
      <DelegatesOverviewView
        {...({
          subgroups: [group],
          delegatesByGroup: [
            {
              subgroup: group,
              allocation: 1,
              delegates: [unknown('confirmed', 'confirmed')],
              confirmedDelegates: [unknown('confirmed', 'confirmed')],
              nominatedDelegates: [unknown('nominated', 'nominated')],
              standbyDelegates: [unknown('standby', 'standby')],
            },
          ],
          isDelegatesFinalized: null,
        } as any)}
      />
    );
    expect(screen.getAllByText('generated.inline.0031_unknown_bc7819b3')).toHaveLength(3);
    expect(screen.getAllByText('?')).toHaveLength(3);
  });

  it('composes the controller contract into the view without an intermediate API', () => {
    mocks.event = {
      id: 'event-1',
      delegates: [],
      delegate_allocations: [
        {
          group_id: 'group-a',
          allocated_seats: 1,
          group: { id: 'group-a', name: 'Alpha', member_count: 4 },
        },
      ],
      delegate_finalized_at: null,
    };
    render(<DelegatesOverview eventId="event-1" groupId="parent-1" />);
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(
      screen.getByText('generated.inline.0376_no_delegates_nominated_yet_3f1b5625')
    ).toBeTruthy();
  });
});
