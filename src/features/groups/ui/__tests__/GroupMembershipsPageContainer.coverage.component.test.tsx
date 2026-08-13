/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loading: false,
  member: true,
  permissions: {} as Record<string, boolean>,
  contentProps: undefined as any,
}));
vi.mock('@/zero/rbac/usePermissions', () => ({
  usePermissions: () => ({
    isLoading: mocks.loading,
    isMember: () => mocks.member,
    can: (_action: string, resource: string) => mocks.permissions[resource] ?? false,
  }),
}));
vi.mock('@/features/auth/ui/AccessDenied', () => ({ AccessDenied: () => <div>denied</div> }));
vi.mock('@/features/shared/ui/feedback', () => ({ PageSkeleton: () => <div>loading</div> }));
vi.mock('@/features/groups/ui/GroupMembershipsContentContainer', () => ({
  GroupMembershipsContentContainer: (props: any) => {
    mocks.contentProps = props;
    return <div>content</div>;
  },
}));

import { GroupMembershipsPageContainer } from '../GroupMembershipsPageContainer';

beforeEach(() => {
  mocks.loading = false;
  mocks.member = true;
  mocks.permissions = {};
  mocks.contentProps = undefined;
});
afterEach(cleanup);

describe('GroupMembershipsPageContainer access decisions', () => {
  it('covers loading, non-member, denied, member-manager and all assignment permission fallbacks', () => {
    const props = {
      groupId: 'g',
      defaultTab: 'membershipsByUser' as const,
      focusAssignmentId: 'a',
      onTabChange: vi.fn(),
    };
    mocks.loading = true;
    const view = render(<GroupMembershipsPageContainer {...props} />);
    mocks.loading = false;
    mocks.member = false;
    view.rerender(<GroupMembershipsPageContainer {...props} />);
    expect(view.container.textContent).toContain('denied');
    mocks.member = true;
    view.rerender(<GroupMembershipsPageContainer {...props} />);
    mocks.permissions = { groupMemberships: true };
    view.rerender(<GroupMembershipsPageContainer {...props} />);
    expect(mocks.contentProps.canManageMembers).toBe(true);
    for (const resource of ['events', 'elections', 'agendaItems']) {
      mocks.permissions = { [resource]: true };
      view.rerender(<GroupMembershipsPageContainer {...props} />);
      expect(mocks.contentProps.canManageAssignments).toBe(true);
    }
    expect(mocks.contentProps.onTabChange).toBe(props.onTabChange);
  });
});
