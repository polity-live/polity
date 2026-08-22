/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  GroupWikiContentView,
  groupWikiContentViewInternals as helpers,
  type GroupWikiContentViewProps,
} from '../GroupWikiContentView';

const wikiParticipationDirectoryMock = vi.hoisted(() =>
  vi.fn(({ leadingCard }: { leadingCard?: ReactNode }) => (
    <div data-testid="wiki-participation-directory">{leadingCard}</div>
  ))
);

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to?: string }) => <a href={to}>{children}</a>,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, paramsOrFallback?: string | Record<string, unknown>) =>
    typeof paramsOrFallback === 'string' ? paramsOrFallback : key,
  useTranslation: () => ({
    t: (key: string, paramsOrFallback?: string | Record<string, unknown>) =>
      typeof paramsOrFallback === 'string' ? paramsOrFallback : key,
  }),
}));

vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  VisibilityBadge: ({
    children,
    value,
    ...props
  }: {
    children: ReactNode;
    value?: string;
    [key: string]: unknown;
  }) => (
    <span data-visibility-value={value} {...props}>
      {children}
    </span>
  ),
}));

vi.mock('@/features/network/ui/LinkGroupDialog', () => ({
  LinkGroupDialog: ({ trigger }: { trigger: ReactNode }) => <>{trigger}</>,
}));

vi.mock('@/features/shared/ui/layout', () => ({
  ActionBar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ResponsiveActionLabel: ({ full }: { full: ReactNode }) => <>{full}</>,
  StatsBar: () => <div data-testid="stats-bar" />,
  compactActionButtonClassName: 'compact-action',
}));

vi.mock('@/features/shared/ui/action-buttons', () => ({
  MembershipButton: ({
    'data-action-id': actionId,
    onRequest,
  }: {
    'data-action-id'?: string;
    onRequest?: () => void;
  }) => (
    <button data-action-id={actionId} type="button" onClick={onRequest}>
      membership
    </button>
  ),
  SubscribeButton: ({
    'data-action-id': actionId,
    onToggleSubscribe,
  }: {
    'data-action-id'?: string;
    onToggleSubscribe?: () => void;
  }) => (
    <button data-action-id={actionId} type="button" onClick={onToggleSubscribe}>
      subscribe
    </button>
  ),
}));

vi.mock('@/features/shared/ui/action-buttons/ShareButton.tsx', () => ({
  ShareButton: ({ 'data-action-id': actionId }: { 'data-action-id'?: string }) => (
    <button data-action-id={actionId} type="button">
      share
    </button>
  ),
}));

vi.mock('@/features/users/ui/SocialBar', () => ({
  SocialBar: () => <div data-testid="social-bar" />,
}));

vi.mock('@/features/shared/ui/hashtags', () => ({
  HashtagDisplay: ({ badgeClassName }: { badgeClassName?: string }) => (
    <div data-testid="hashtags" data-badge-class-name={badgeClassName} />
  ),
}));

vi.mock('@/features/shared/ui/wiki', () => ({
  EntityWikiMedia: () => <div data-testid="entity-wiki-media" />,
  InfoTabs: () => <div data-testid="info-tabs" />,
  WikiParticipationDirectory: wikiParticipationDirectoryMock,
  WikiRosterSummaryCard: () => <div data-testid="roster-summary" />,
  getWikiParticipationName: (user: {
    first_name?: string | null;
    last_name?: string | null;
    handle?: string | null;
    email?: string | null;
  }) =>
    [user?.first_name, user?.last_name].filter(Boolean).join(' ') ||
    user?.handle ||
    user?.email ||
    'Participant',
  isVisibleWikiParticipationStatus: (status: string | null | undefined) =>
    ['active', 'member'].includes(status ?? ''),
  normalizeWikiParticipationRole: (
    role: {
      id?: string | null;
      name?: string | null;
      title?: string | null;
      description?: string | null;
    } | null
  ) =>
    role?.id
      ? {
          id: role.id,
          name: role.name || role.title || 'Role',
          description: role.description,
        }
      : null,
}));

vi.mock('@/features/timeline/ui/cards/BlogTimelineCard', () => ({
  BlogTimelineCard: () => <div data-testid="blog-card" />,
}));

vi.mock('@/features/timeline/ui/cards/GroupTimelineCard', () => ({
  GroupTimelineCard: () => <div data-testid="group-card" />,
}));

vi.mock('@/features/network/ui/GroupRelationshipFields', () => ({
  SiblingMembershipModeDescription: () => <span data-testid="membership-mode" />,
}));

vi.mock('@/features/network/logic/groupConnectionDerived', () => ({
  getCanonicalMembershipModeLabel: () => 'Open',
}));

vi.mock('@/features/shared/logic/richText', () => ({
  richTextToPlainText: (value: unknown) => (typeof value === 'string' ? value : ''),
}));

vi.mock('@/features/groups/ui/RelatedGroupsTabs', () => ({
  RelatedGroupsTabs: () => <div data-testid="related-groups" />,
}));

vi.mock('@/zero/queries', () => ({
  queries: {
    groups: {
      membershipPage: (args: unknown) => ({ kind: 'page', args }),
      membershipById: (args: unknown) => ({ kind: 'single', args }),
    },
  },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderGroupWikiContent(overrides: Partial<GroupWikiContentViewProps> = {}) {
  const defaultProps: GroupWikiContentViewProps = {
    groupId: 'group-1',
    group: {
      id: 'group-1',
      name: 'Open Assembly',
      visibility: 'public',
      roles: [],
      memberships: [],
      group_hashtags: [],
      blogs: [],
    },
    groupLocation: '',
    groupDescription: '',
    memberCount: 0,
    subscriberCount: 0,
    eventsCount: 0,
    amendmentsCount: 0,
    isAuthenticated: true,
    isSubscribed: false,
    subscribeLoading: false,
    toggleSubscribe: vi.fn(),
    status: null,
    isMember: false,
    hasRequested: false,
    isInvited: false,
    isBase: false,
    isHierarchical: false,
    isSibling: false,
    membershipLoading: false,
    requestJoinActionDisabled: false,
    acceptInvitationDisabled: false,
    requestJoinConflictResponse: null,
    acceptInvitationConflictResponse: null,
    requestJoin: vi.fn(),
    leaveGroup: vi.fn(),
    acceptInvitation: vi.fn(),
    parentGroups: [],
    childGroups: [],
    siblingGroups: [],
    connectedGroup: null,
    primarySiblingMembershipMode: null,
    parliamentSourceGroups: [],
  };

  return render(<GroupWikiContentView {...defaultProps} {...overrides} />);
}

describe('GroupWikiContentView', () => {
  it.each([
    ['public', 'common.visibility.public'],
    ['authenticated', 'common.visibility.authenticated'],
    ['private', 'common.visibility.private'],
    ['unsupported', 'common.visibility.private'],
    [null, 'common.visibility.public'],
  ])('renders the normalized %s visibility badge', (visibility, label) => {
    const { container } = renderGroupWikiContent({
      group: {
        id: 'group-1',
        name: 'Visibility Group',
        visibility,
        roles: [],
        memberships: [],
        group_hashtags: [],
        blogs: [],
      },
    });

    const badge = container.querySelector('[data-entity-visibility]');
    expect(badge?.getAttribute('data-entity-visibility')).toBe(
      visibility == null ? 'public' : visibility === 'unsupported' ? 'private' : visibility
    );
    expect(badge?.textContent).toBe(label);
    expect(container.querySelectorAll('[data-entity-visibility]')).toHaveLength(1);
  });

  it('deduplicates, sorts, and merges direct and elected participation roles', () => {
    const roleA = { id: 'a', name: 'Alpha' };
    const roleB = { id: 'b', name: 'beta' };
    expect(helpers.dedupeWikiParticipationRoles([roleB, roleA, roleA])).toEqual([roleA, roleB]);

    const elected = helpers.getCurrentElectedWikiRolesByUserId([
      null,
      { id: 'assigned', assignment_mode: 'assigned', scope: 'group' },
      { id: 'event', assignment_mode: 'elected', scope: 'event' },
      { assignment_mode: 'elected', scope: 'group' },
      {
        id: 'a',
        name: 'Alpha',
        assignment_mode: 'elected',
        scope: 'group',
        holder_history: [
          { user_id: null, end_date: null },
          { user_id: 'ended', end_date: 1 },
          { user_id: 'user', end_date: null },
        ],
      },
      {
        id: 'a',
        name: 'Alpha',
        assignment_mode: 'elected',
        scope: 'group',
        holder_history: null,
        holders: [
          { user_id: 'user', end_date: null },
          { user_id: 'second', end_date: null },
        ],
      },
      { id: 'empty', name: 'Empty', assignment_mode: 'elected', scope: 'group' },
    ]);
    expect(elected.get('user')).toEqual([roleA]);
    expect(elected.get('second')).toEqual([roleA]);

    expect(
      helpers.getMembershipWikiRoles(
        {
          roles: [{ id: 'b', name: 'beta' }],
          role: { id: 'a', name: 'Alpha' },
          membership_roles: [
            { role: null },
            { role: { id: null } },
            { role: { id: 'b', name: 'beta' } },
          ],
          user: { id: 'user' },
        },
        elected
      )
    ).toEqual([roleA, roleB]);
    expect(
      helpers.getMembershipWikiRoles(
        {
          roles: [],
          role: null,
          membership_roles: null,
          user: null,
          user_id: 'missing',
        },
        elected
      )
    ).toEqual([]);
    expect(helpers.getMembershipWikiRoles({ user: null, user_id: null }, elected)).toEqual([]);
  });

  it('shows only share actions to unauthenticated visitors', () => {
    renderGroupWikiContent({ isAuthenticated: false });

    expect(screen.getByRole('button', { name: 'share' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'components.actionBar.linkGroup' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'subscribe' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'membership' })).toBeNull();
  });

  it('keeps group actions visible to authenticated users', () => {
    renderGroupWikiContent({ isAuthenticated: true });

    expect(screen.getByRole('button', { name: 'components.actionBar.linkGroup' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'subscribe' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'membership' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'share' })).toBeTruthy();
  });

  it('dispatches group wiki actions through stable identities', () => {
    const toggleSubscribe = vi.fn();
    const requestJoin = vi.fn();
    const { container } = renderGroupWikiContent({ toggleSubscribe, requestJoin });

    for (const actionId of [
      'groups.wiki.open.link-dialog',
      'groups.wiki.toggle.subscription',
      'groups.wiki.manage.membership',
      'groups.wiki.open.share',
    ]) {
      const action = container.querySelector<HTMLElement>(`[data-action-id="${actionId}"]`)!;
      action.focus();
      expect(document.activeElement).toBe(action);
      fireEvent.click(action);
    }

    expect(toggleSubscribe).toHaveBeenCalledTimes(1);
    expect(requestJoin).toHaveBeenCalledTimes(1);
  });

  it('stacks wrapping badges and mobile hashtags below a constrained title', () => {
    renderGroupWikiContent({
      isHierarchical: true,
      isBase: true,
      group: {
        id: 'group-1',
        name: 'A very long assembly group name',
        visibility: 'public',
        roles: [],
        memberships: [],
        group_hashtags: [
          {
            id: 'group-tag-1',
            hashtag: { id: 'tag-1', tag: 'a-very-long-hashtag' },
          },
        ],
        blogs: [],
      },
    });

    const title = screen.getByRole('heading', {
      level: 1,
      name: 'A very long assembly group name',
    });
    const titleGroup = title.parentElement;
    const badgeGroup = title.nextElementSibling;
    const hashtagDisplays = screen.getAllByTestId('hashtags');

    expect(title.className).toContain('min-w-0');
    expect(title.className).toContain('break-words');
    expect(titleGroup?.className).toContain('flex-col');
    expect(titleGroup?.className).toContain('md:flex-row');
    expect(badgeGroup?.className).toContain('flex-wrap');
    expect(badgeGroup?.className).toContain('md:contents');
    expect(titleGroup?.nextElementSibling).toBe(hashtagDisplays[0]?.parentElement);
    expect(hashtagDisplays[0]?.parentElement?.className).toContain('md:hidden');
    expect(hashtagDisplays[0]?.getAttribute('data-badge-class-name')).toContain('break-all');
    expect(hashtagDisplays[1]?.parentElement?.className).toContain('hidden');
    expect(hashtagDisplays[1]?.parentElement?.className).toContain('md:block');
  });

  it('passes current elected group-role holders as member roles and filter roles', () => {
    renderGroupWikiContent({
      memberCount: 2,
      group: {
        id: 'group-1',
        name: 'Open Assembly',
        visibility: 'public',
        group_hashtags: [],
        blogs: [],
        roles: [
          {
            id: 'role-chair',
            name: 'Chair',
            scope: 'group',
            assignment_mode: 'elected',
            holder_history: [
              { user_id: 'user-1', end_date: null },
              { user_id: 'user-2', end_date: 1_781_866_000_000 },
            ],
          },
          {
            id: 'role-appointed',
            name: 'Appointed',
            scope: 'group',
            assignment_mode: 'assigned',
            holder_history: [{ user_id: 'user-1', end_date: null }],
          },
        ],
        memberships: [
          {
            id: 'membership-1',
            status: 'active',
            user: { id: 'user-1', first_name: 'Ada', last_name: 'Lovelace' },
          },
          {
            id: 'membership-2',
            status: 'active',
            user: { id: 'user-2', first_name: 'Grace', last_name: 'Hopper' },
          },
        ],
      },
    });

    expect(wikiParticipationDirectoryMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        items: [
          expect.objectContaining({
            id: 'membership-1',
            name: 'Ada Lovelace',
            roles: [expect.objectContaining({ id: 'role-chair', name: 'Chair' })],
          }),
          expect.objectContaining({
            id: 'membership-2',
            name: 'Grace Hopper',
            roles: [],
          }),
        ],
        roles: [
          expect.objectContaining({ id: 'role-appointed', name: 'Appointed' }),
          expect.objectContaining({ id: 'role-chair', name: 'Chair' }),
        ],
      })
    );
  });

  it('renders all rich group sections and every connected-group mode', () => {
    const richGroup = {
      id: 'group-1',
      name: null,
      visibility: 'private',
      image_url: null,
      video_url: null,
      roles: [{ id: 'role', name: 'Role' }],
      memberships: [
        {
          id: null,
          status: 'active',
          user_id: 'fallback-user',
          user: {
            id: 'user',
            first_name: 'First',
            last_name: 'Last',
            handle: undefined,
            email: undefined,
            avatar: undefined,
          },
          roles: [],
        },
        { id: 'hidden', status: 'inactive', user: { id: 'hidden' } },
        { id: 'missing-user', status: 'active', user: null },
      ],
      group_hashtags: [{ id: 'tag', hashtag: { id: 'tag', tag: 'tag' } }],
      website: null,
      youtube: null,
      linkedin: null,
      whatsapp: null,
      instagram: null,
      twitter: null,
      x: 'x-handle',
      facebook: null,
      snapchat: null,
      tiktok: null,
      email: null,
      country: null,
      region: null,
      post_code: null,
      city: null,
      street: null,
      house_number: null,
      latitude: undefined,
      longitude: undefined,
      location_kind: undefined,
      location_place_id: undefined,
      location_boundary_source: undefined,
      location_geometry: undefined,
      location_bounds: undefined,
      sibling_membership_mode: 'elected',
      blogs: [
        {
          id: 1,
          title: null,
          description: null,
          image_url: null,
          comment_count: 0,
          blog_hashtags: [],
          date: null,
        },
      ],
    };
    for (const mode of ['elected', 'parliament', null, 'other']) {
      renderGroupWikiContent({
        virtualizeParticipationDirectory: true,
        group: { ...richGroup, sibling_membership_mode: mode },
        groupLocation: 'Location',
        groupDescription: undefined,
        isAuthenticated: true,
        isSibling: true,
        connectedGroup: {
          id: 2,
          name: '',
          description: {},
          member_count: null,
          amendment_count: null,
          event_count: null,
        },
        primarySiblingMembershipMode: mode == null ? 'none' : 'all_members',
        parliamentSourceGroups: [
          {
            id: 3,
            name: '',
            description: {},
            member_count: null,
            amendment_count: null,
            event_count: null,
          },
        ],
        siblingGroups: [
          {
            id: 4,
            name: '',
            description: 'Description',
            member_count: null,
            amendment_count: null,
            event_count: null,
          },
        ],
      });
    }
    expect(screen.getAllByTestId('group-card').length).toBeGreaterThan(3);
    expect(screen.getAllByTestId('blog-card').length).toBeGreaterThan(0);

    renderGroupWikiContent({
      connectedGroup: { id: 'connected', name: null },
      primarySiblingMembershipMode: null,
      group: {
        id: 'group-1',
        name: 'Group',
        visibility: 'private',
        roles: [],
        memberships: [],
        group_hashtags: [],
        blogs: [],
        sibling_membership_mode: 'elected',
      },
    });
    expect(screen.getAllByTestId('group-card').length).toBeGreaterThan(4);
  });

  it('builds virtual participation queries and maps relational and fallback users', () => {
    renderGroupWikiContent({
      virtualizeParticipationDirectory: true,
      group: {
        id: 'group-1',
        name: 'Group',
        visibility: 'private',
        roles: [],
        memberships: [],
        blogs: [],
      },
    });
    const capturedProps = wikiParticipationDirectoryMock.mock.calls.at(-1)?.[0];
    if (!capturedProps) throw new Error('Expected participation directory props');
    const virtualSource = (capturedProps as any).virtualSource;
    expect(
      virtualSource.getPageQuery({
        limit: 10,
        start: null,
        dir: 'forward',
        settled: false,
        query: '',
        roleIds: [],
      }).options.ttl
    ).toBe('none');
    expect(
      virtualSource.getPageQuery({
        limit: 10,
        start: null,
        dir: 'forward',
        settled: true,
        query: 'q',
        roleIds: ['role'],
      }).options.ttl
    ).toBe('5m');
    expect(virtualSource.getSingleQuery({ id: 'membership', settled: false }).options.ttl).toBe(
      'none'
    );
    expect(virtualSource.getSingleQuery({ id: 'membership', settled: true }).options.ttl).toBe(
      '5m'
    );
    expect(virtualSource.getRowKey({ id: 'membership' })).toBe('membership');
    expect(
      virtualSource.mapRow({
        id: 'membership',
        user_id: 'fallback-user',
        user: null,
        status: undefined,
        membership_roles: [],
      })
    ).toMatchObject({
      userId: 'fallback-user',
      handle: null,
      email: null,
      avatar: null,
      status: null,
      roles: [],
    });
    expect(
      virtualSource.mapRow({
        id: 'membership-user',
        user_id: 'fallback',
        status: 'active',
        user: {
          id: 'user',
          first_name: 'First',
          handle: 'handle',
          email: 'login-email',
          contact_email: 'email',
          avatar: 'avatar',
        },
        role: { id: 'role', name: 'Role' },
      })
    ).toMatchObject({
      userId: 'user',
      handle: 'handle',
      email: 'email',
      avatar: 'avatar',
      status: 'active',
    });
  });

  it('selects membership disabled reasons and conflict payloads', () => {
    for (const overrides of [
      {
        acceptInvitationDisabled: true,
        acceptInvitationConflictResponse: { summary: 'summary', conflicts: [] },
      },
      {
        acceptInvitationDisabled: true,
        acceptInvitationConflictResponse: { summary: null, conflicts: [{ summary: 'conflict' }] },
      },
      {
        acceptInvitationDisabled: true,
        acceptInvitationConflictResponse: { summary: null, conflicts: [] },
      },
      {
        requestJoinActionDisabled: true,
        requestJoinDisabledReason: 'blocked',
        requestJoinConflictResponse: { summary: 'request' },
      },
      { requestJoinActionDisabled: false, acceptInvitationDisabled: false },
    ]) {
      renderGroupWikiContent(overrides);
    }
    expect(screen.getAllByRole('button', { name: 'membership' })).toHaveLength(5);
  });

  it('renders private minimal groups without optional hashtags, relations, or blogs', () => {
    const { container } = renderGroupWikiContent({
      isAuthenticated: false,
      groupLocation: '',
      group: {
        id: 'group-1',
        name: undefined,
        visibility: 'private',
        roles: undefined,
        memberships: undefined,
        group_hashtags: null,
        blogs: null,
        twitter: null,
        x: null,
      },
      connectedGroup: null,
      parliamentSourceGroups: [],
      siblingGroups: [],
      isBase: false,
      isHierarchical: false,
      isSibling: false,
    });
    expect(screen.queryByTestId('group-card')).toBeNull();
    expect(screen.queryByTestId('blog-card')).toBeNull();
    expect(container.querySelector('[data-entity-visibility="private"]')).not.toBeNull();
  });
});
