/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  membership: {} as Record<string, unknown>,
  subscription: {} as Record<string, unknown>,
  viewProps: undefined as Record<string, any> | undefined,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string, values?: unknown) => (values ? `${key}:${JSON.stringify(values)}` : key),
  }),
}));

vi.mock('@/features/groups/hooks/useGroupMembership', () => ({
  useGroupMembership: () => mocks.membership,
}));

vi.mock('@/features/groups/hooks/useSubscribeGroup', () => ({
  useSubscribeGroup: () => mocks.subscription,
}));

vi.mock('../GroupTimelineCardView', () => ({
  GroupTimelineCardView: (props: Record<string, any>) => {
    mocks.viewProps = props;
    return <div data-testid="group-view" />;
  },
}));

import { GroupTimelineCard, type GroupTimelineCardProps } from '../GroupTimelineCard';

const baseGroup: GroupTimelineCardProps['group'] = { id: 'group-1', name: 'Civic Group' };

function renderCard(group: Partial<GroupTimelineCardProps['group']> = {}, props = {}) {
  render(<GroupTimelineCard group={{ ...baseGroup, ...group }} {...props} />);
  return mocks.viewProps!;
}

beforeEach(() => {
  mocks.membership = {
    status: null,
    isMember: false,
    isInvited: false,
    hasRequested: false,
    canRequestJoin: true,
    memberCount: undefined,
  };
  mocks.subscription = { isSubscribed: false };
  mocks.viewProps = undefined;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('GroupTimelineCard controller', () => {
  it('derives empty defaults and the join presentation', () => {
    const props = renderCard();

    expect(props.groupHashtags).toBeUndefined();
    expect(props.groupDescription).toBeUndefined();
    expect(props.isMember).toBe(false);
    expect(props.isInvited).toBe(false);
    expect(props.hasRequested).toBe(false);
    expect(props.requestMembershipDisabled).toBe(false);
    expect(props.getMembershipLabel()).toBe('features.timeline.cards.group.join');
    expect(props.getMembershipVariant()).toBe('default');
    expect(props.MembershipIcon.displayName ?? props.MembershipIcon.name).toMatch(/UserPlus/);
    expect(props.stats).toHaveLength(1);
    expect(props.stats[0].value).toBe(0);
  });

  it.each([
    ['active', 'member', 'secondary', 'UserMinus'],
    ['member', 'member', 'secondary', 'UserMinus'],
    ['admin', 'member', 'secondary', 'UserMinus'],
    ['invited', 'invited', 'default', 'Check'],
    ['requested', 'pending', 'outline', 'Clock'],
  ] as const)('maps %s membership to its action presentation', (status, label, variant, icon) => {
    const props = renderCard({ membershipStatus: status });

    expect(props.getMembershipLabel()).toBe(`features.timeline.cards.group.${label}`);
    expect(props.getMembershipVariant()).toBe(variant);
    expect(props.MembershipIcon.displayName ?? props.MembershipIcon.name).toMatch(
      new RegExp(icon, 'i')
    );
  });

  it('uses hook status and covers hook relationship fallbacks independently', () => {
    mocks.membership = { ...mocks.membership, status: 'hook', isMember: true };
    let props = renderCard();
    expect(props.isMember).toBe(true);

    cleanup();
    mocks.membership = { ...mocks.membership, isMember: false, isInvited: true };
    props = renderCard();
    expect(props.isInvited).toBe(true);

    cleanup();
    mocks.membership = { ...mocks.membership, isInvited: false, hasRequested: true };
    props = renderCard();
    expect(props.hasRequested).toBe(true);
  });

  it('disables a new request only when no relationship can be created', () => {
    mocks.membership = { ...mocks.membership, canRequestJoin: false };
    expect(renderCard().requestMembershipDisabled).toBe(true);

    cleanup();
    expect(renderCard({ membershipStatus: 'member' }).requestMembershipDisabled).toBe(false);
    cleanup();
    expect(renderCard({ membershipStatus: 'invited' }).requestMembershipDisabled).toBe(false);
    cleanup();
    expect(renderCard({ membershipStatus: 'requested' }).requestMembershipDisabled).toBe(false);
  });

  it('prefers explicit hashtags and maps topics as a fallback', () => {
    const hashtags = [{ id: 'tag-1', tag: 'democracy' }];
    expect(renderCard({ hashtags, topics: ['ignored'] }).groupHashtags).toBe(hashtags);

    cleanup();
    expect(renderCard({ topics: ['local', 'budget'] }).groupHashtags).toEqual([
      { id: 'local', tag: 'local' },
      { id: 'budget', tag: 'budget' },
    ]);

    cleanup();
    expect(renderCard({ topics: [] }).groupHashtags).toEqual([]);
  });

  it('normalizes descriptions and builds all positive stats', () => {
    const props = renderCard({
      description: '  A   civic\n group  ',
      memberCount: 12,
      eventCount: 2,
      amendmentCount: 3,
    });

    expect(props.groupDescription).toBe('A   civic\n group');
    expect(props.stats.map((stat: any) => stat.value)).toEqual([12, 2, 3]);
    expect(props.stats.map((stat: any) => stat.label)).toEqual([
      'features.timeline.cards.group.members:{"count":12}',
      'features.timeline.cards.group.events:{"count":2}',
      'features.timeline.cards.group.amendments:{"count":3}',
    ]);
  });

  it('falls back to the hook count and omits non-positive optional stats', () => {
    mocks.membership = { ...mocks.membership, memberCount: 7 };
    let props = renderCard({ eventCount: 0, amendmentCount: 0 });
    expect(props.stats.map((stat: any) => stat.value)).toEqual([7]);

    cleanup();
    mocks.membership = { ...mocks.membership, memberCount: undefined };
    props = renderCard();
    expect(props.stats[0].value).toBe(0);
  });

  it('forwards callbacks, overrides, loading state, and projected state to the view', () => {
    const callback = vi.fn();
    const projectedMembershipState = { status: 'active' } as any;
    const projectedSubscriptionState = { isSubscribed: true } as any;
    const props = renderCard(
      {},
      {
        href: '/groups/custom',
        className: 'custom',
        onRequestMembership: callback,
        onLeave: callback,
        onAcceptInvitation: callback,
        onWithdrawRequest: callback,
        onToggleSubscription: callback,
        isMembershipLoading: true,
        isSubscriptionLoading: true,
        projectedMembershipState,
        projectedSubscriptionState,
      }
    );

    expect(props).toMatchObject({
      href: '/groups/custom',
      className: 'custom',
      onRequestMembership: callback,
      onLeave: callback,
      onAcceptInvitation: callback,
      onWithdrawRequest: callback,
      onToggleSubscription: callback,
      isMembershipLoading: true,
      isSubscriptionLoading: true,
    });
  });
});
