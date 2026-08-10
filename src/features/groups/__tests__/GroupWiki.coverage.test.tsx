/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  page: {} as any,
  recovery: null as any,
  viewProps: null as any,
}));
vi.mock('@/features/groups/hooks/useGroupWikiPage', () => ({ useGroupWikiPage: () => mocks.page }));
vi.mock('@/features/create/logic/createFinalization', () => ({
  useCreateRecoveryDraft: () => mocks.recovery,
}));
vi.mock('@/features/create/ui/CreateRecoveryState', () => ({
  CreateRecoveryState: () => <div>recovery</div>,
}));
vi.mock('@/features/auth/ui/AccessDenied', () => ({ AccessDenied: () => <div>denied</div> }));
vi.mock('@/features/shared/ui/feedback', () => ({ PageSkeleton: () => <div>loading</div> }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ language: 'en' }),
}));
vi.mock('@/features/shared/logic/locationHelpers', () => ({
  formatLocation: (group: any) => group.location ?? '',
}));
vi.mock('@/features/shared/logic/richText', () => ({
  richTextToPlainText: (value: any) => value ?? '',
}));
vi.mock('@/features/app-tutorial/fixture-copy', () => ({
  resolveAppTutorialFixtureValue: (group: any) => group,
}));
vi.mock('../GroupWikiContentView', () => ({
  GroupWikiContentView: (props: any) => {
    mocks.viewProps = props;
    return <div>content</div>;
  },
}));

import { GroupWiki } from '../GroupWiki';

const basePage = () => ({
  group: null,
  isLoading: false,
  canAccess: true,
  isAuthenticated: true,
  memberCount: 1,
  eventsCount: 2,
  amendmentsCount: 3,
  subscriberCount: 4,
  isSubscribed: false,
  subscribeLoading: false,
  toggleSubscribe: vi.fn(),
  status: null,
  isMember: false,
  hasRequested: false,
  isInvited: false,
  isBase: true,
  isHierarchical: false,
  isSibling: false,
  membershipLoading: false,
  canRequestJoin: true,
  canAcceptInvitation: true,
  requestJoinDisabledReason: null,
  requestJoinConflictResponse: null,
  acceptInvitationConflictResponse: null,
  requestJoin: vi.fn(),
  leaveGroup: vi.fn(),
  acceptInvitation: vi.fn(),
});

beforeEach(() => {
  mocks.page = basePage();
  mocks.recovery = null;
  mocks.viewProps = null;
});
afterEach(cleanup);

describe('GroupWiki page branches', () => {
  it('prioritizes recovery, then loading, then not-found when the group is absent', () => {
    mocks.recovery = { id: 'draft' };
    const { rerender } = render(<GroupWiki groupId="g" />);
    expect(screen.getByText('recovery')).toBeTruthy();
    mocks.recovery = null;
    mocks.page.isLoading = true;
    rerender(<GroupWiki groupId="g" />);
    expect(screen.getByText('loading')).toBeTruthy();
    mocks.page.isLoading = false;
    rerender(<GroupWiki groupId="g" />);
    expect(document.body.textContent).toContain('group_not_found');
  });

  it('renders access denied for an inaccessible group', () => {
    mocks.page = { ...basePage(), group: { id: 'g' }, canAccess: false };
    render(<GroupWiki groupId="g" />);
    expect(screen.getByText('denied')).toBeTruthy();
  });

  it('normalizes missing optional group data and disables unavailable requests', () => {
    mocks.page = {
      ...basePage(),
      canRequestJoin: false,
      canAcceptInvitation: false,
      isInvited: true,
      group: { id: 'g', description: '', tutorial_run_id: null },
    };
    render(<GroupWiki groupId="g" />);
    expect(screen.getByText('content')).toBeTruthy();
    expect(mocks.viewProps).toMatchObject({
      groupDescription: undefined,
      parentGroups: [],
      childGroups: [],
      siblingGroups: [],
      primarySiblingMembershipMode: null,
      parliamentSourceGroups: [],
      requestJoinActionDisabled: false,
      acceptInvitationDisabled: true,
    });
  });

  it('forwards populated relationships and filters absent sibling sources', () => {
    const relation = {
      request_item_kind: 'structure',
      connection_type: 'hierarchy',
      status: 'active',
      parent_group_id: 'g',
      child_group_id: 'child',
      group: { id: 'g' },
      related_group: { id: 'child' },
    };
    mocks.page = {
      ...basePage(),
      isMember: true,
      hasRequested: true,
      group: {
        id: 'g',
        description: 'Description',
        tutorial_run_id: 'tutorial',
        location: 'Berlin',
        relationships_as_source: [relation],
        relationships_as_target: [],
        sibling_groups: [{ id: 'sibling' }],
        connected_group: { id: 'connected' },
        primary_sibling_membership_mode: 'all',
        sibling_sources: [{ source_group: null }, { source_group: { id: 'source' } }],
      },
    };
    render(<GroupWiki groupId="g" />);
    expect(mocks.viewProps.groupDescription).toBe('Description');
    expect(mocks.viewProps.childGroups).toHaveLength(1);
    expect(mocks.viewProps.parliamentSourceGroups).toEqual([{ id: 'source' }]);
    expect(mocks.viewProps.requestJoinActionDisabled).toBe(true);
    expect(mocks.viewProps.acceptInvitationDisabled).toBe(false);
  });

  it('keeps the join action enabled for invited, requested, and requestable variants', () => {
    for (const state of [{ isInvited: true }, { hasRequested: true }, { canRequestJoin: true }]) {
      cleanup();
      mocks.page = {
        ...basePage(),
        canRequestJoin: false,
        ...state,
        group: { id: 'g', tutorial_run_id: null },
      };
      render(<GroupWiki groupId="g" />);
      expect(mocks.viewProps.requestJoinActionDisabled).toBe(false);
    }
    cleanup();
    mocks.page = {
      ...basePage(),
      canRequestJoin: false,
      group: { id: 'g', tutorial_run_id: null },
    };
    render(<GroupWiki groupId="g" />);
    expect(mocks.viewProps.requestJoinActionDisabled).toBe(true);
  });
});
