/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GroupWikiContentView, type GroupWikiContentViewProps } from '../GroupWikiContentView';

const wikiParticipationDirectoryMock = vi.hoisted(() =>
  vi.fn(({ leadingCard }: { leadingCard?: ReactNode }) => (
    <div data-testid="wiki-participation-directory">{leadingCard}</div>
  ))
);

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to?: string }) => <a href={to}>{children}</a>,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) => fallback ?? key,
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock('@/features/network/ui/LinkGroupDialog', () => ({
  LinkGroupDialog: () => <button type="button">link group</button>,
}));

vi.mock('@/features/shared/ui/layout', () => ({
  ActionBar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  EntityPageFrame: ({ children }: { children: ReactNode }) => (
    <div className="mx-auto max-w-7xl px-4 py-6">{children}</div>
  ),
  StatsBar: () => <div data-testid="stats-bar" />,
}));

vi.mock('@/features/shared/ui/action-buttons', () => ({
  MembershipButton: () => <button type="button">membership</button>,
  SubscribeButton: () => <button type="button">subscribe</button>,
}));

vi.mock('@/features/shared/ui/action-buttons/ShareButton.tsx', () => ({
  ShareButton: () => <button type="button">share</button>,
}));

vi.mock('@/features/users/ui/SocialBar', () => ({
  SocialBar: () => <div data-testid="social-bar" />,
}));

vi.mock('@/features/shared/ui/hashtags', () => ({
  HashtagDisplay: () => <div data-testid="hashtags" />,
}));

vi.mock('@/features/shared/ui/wiki', () => ({
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
  it('owns the entity page frame so public routes keep a gutter without shell wrapping', () => {
    const { container } = renderGroupWikiContent();

    expect(container.firstElementChild?.className).toContain('max-w-7xl');
    expect(container.firstElementChild?.className).toContain('px-4');
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
});
