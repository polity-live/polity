// @vitest-environment jsdom

import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CollaboratorsView } from '../CollaboratorsView';
import type { Collaborator } from '../../hooks/useCollaborators';

const useUserSearchMock = vi.fn();

vi.mock('@/features/amendments/collaborators/hooks/useUserSearch', () => ({
  useUserSearch: (...args: unknown[]) => useUserSearchMock(...args),
}));

vi.mock('@/features/groups/ui/MembershipTabs', () => ({
  MembershipTabs: ({ tabBarAction }: { tabBarAction?: ReactNode }) => (
    <div data-testid="membership-tabs">{tabBarAction}</div>
  ),
}));

vi.mock('@/features/shared/ui/typeahead', () => ({
  EntitySearchBar: () => null,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

function collaborator(id: string, userId: string, status: string): Collaborator {
  return {
    id,
    user_id: userId,
    amendment_id: 'amendment-1',
    role_id: null,
    status,
    visibility: null,
    created_at: Date.now(),
    user: { id: userId, first_name: userId, last_name: null, handle: null },
  } as Collaborator;
}

function renderCollaboratorsView(collaborators: Collaborator[]) {
  return render(
    <CollaboratorsView
      activeCollaborators={collaborators.filter(c => c.status === 'member')}
      activeTab="membershipsByUser"
      amendmentId="amendment-1"
      amendmentTitle="Safer Streets"
      collaborators={collaborators}
      changeRoleMembership={null}
      changeRoleOpen={false}
      memberRightsMembership={null}
      memberRightsOpen={false}
      membershipSort={{ field: 'user', direction: 'asc' }}
      onActiveTabChange={vi.fn()}
      onApproveRequest={vi.fn()}
      onChangeRoleOpenChange={vi.fn()}
      onConfirmRoleChange={vi.fn()}
      onCreateRole={vi.fn()}
      onDeleteRole={vi.fn()}
      onInviteUsers={vi.fn()}
      onMemberRightsOpenChange={vi.fn()}
      onMembershipSortChange={vi.fn()}
      onNavigateToUser={vi.fn()}
      onOpenChangeRoleDialog={vi.fn()}
      onOpenMemberRightsDialog={vi.fn()}
      onRejectRequest={vi.fn()}
      onRemoveCollaborator={vi.fn()}
      onRemoveRoleFromByRoleView={vi.fn()}
      onSearchQueryChange={vi.fn()}
      onToggleActionRight={vi.fn()}
      onWithdrawInvitation={vi.fn()}
      pendingInvitations={collaborators.filter(c => c.status === 'invited')}
      pendingRequests={collaborators.filter(c => c.status === 'requested')}
      roles={[]}
      searchQuery=""
    />
  );
}

describe('CollaboratorsView', () => {
  it('excludes active, requested, and invited collaborators from invite search', () => {
    useUserSearchMock.mockReturnValue({ users: [], isLoading: false });

    renderCollaboratorsView([
      collaborator('collab-active', 'active-user', 'member'),
      collaborator('collab-requested', 'requested-user', 'requested'),
      collaborator('collab-invited', 'invited-user', 'invited'),
    ]);

    expect(useUserSearchMock).toHaveBeenCalledWith([
      'active-user',
      'requested-user',
      'invited-user',
    ]);
  });
});
