import { describe, expect, it } from 'vitest';

import { getStreetDesignAccess } from '../streetDesignPermissions';

const editableBranch = {
  id: 'branch-1',
  editing_mode: 'edit',
  status: 'active',
  resolution: null,
};

function amendmentWithCollaborator(action: string, status = 'active') {
  return {
    id: 'amendment-1',
    created_by_id: 'author-1',
    collaborators: [
      {
        id: 'collab-1',
        status,
        user: { id: 'user-1' },
        role: {
          id: 'role-1',
          name: 'Role',
          action_rights: [
            {
              id: 'right-1',
              resource: 'amendments',
              action,
              amendment_id: 'amendment-1',
            },
          ],
        },
      },
    ],
  };
}

describe('getStreetDesignAccess', () => {
  it('uses amendment update rights for streetscape mode changes', () => {
    const access = getStreetDesignAccess({
      amendment: amendmentWithCollaborator('update', 'active'),
      selectedProcessBranch: editableBranch,
      userId: 'user-1',
    });

    expect(access.canEdit).toBe(true);
    expect(access.readOnly).toBe(false);
    expect(access.canChangeMode).toBe(true);
  });

  it('keeps readonly branches from changing mode even with update rights', () => {
    const access = getStreetDesignAccess({
      amendment: amendmentWithCollaborator('update', 'active'),
      hasProcessBranch: true,
      selectedProcessBranch: {
        ...editableBranch,
        status: 'rejected',
      },
      userId: 'user-1',
    });

    expect(access.canEdit).toBe(true);
    expect(access.readOnly).toBe(false);
    expect(access.canChangeMode).toBe(false);
  });

  it('allows document mode changes when the amendment has no process branch', () => {
    const access = getStreetDesignAccess({
      amendment: amendmentWithCollaborator('update', 'active'),
      hasDocumentModeTarget: true,
      hasProcessBranch: false,
      selectedProcessBranch: null,
      userId: 'user-1',
    });

    expect(access.canEdit).toBe(true);
    expect(access.readOnly).toBe(false);
    expect(access.canChangeMode).toBe(true);
  });

  it('keeps users without update rights in read-only streetscape mode', () => {
    const access = getStreetDesignAccess({
      amendment: amendmentWithCollaborator('view', 'active'),
      selectedProcessBranch: editableBranch,
      userId: 'user-1',
    });

    expect(access.canEdit).toBe(false);
    expect(access.readOnly).toBe(true);
    expect(access.canChangeMode).toBe(false);
  });

  it('allows event suggestions with active voting rights but no amendment update right', () => {
    const access = getStreetDesignAccess({
      amendment: amendmentWithCollaborator('view', 'active'),
      selectedProcessBranch: { ...editableBranch, editing_mode: 'suggest_event' },
      userId: 'user-1',
      hasActiveEventVotingRight: true,
    });

    expect(access.canEditDirectly).toBe(false);
    expect(access.canSuggestInternally).toBe(false);
    expect(access.canSuggestInEvent).toBe(true);
    expect(access.readOnly).toBe(false);
  });
});
