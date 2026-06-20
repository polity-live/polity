import { describe, expect, it } from 'vitest';

import { adaptAmendmentToEntity } from '../entity-adapter';

const document = {
  id: 'document-1',
  title: 'A1',
  content: [{ type: 'p', children: [{ text: 'Text' }] }],
  visibility: 'public',
  collaborators: [],
};

function amendmentWithRole(action: string) {
  return {
    id: 'amendment-1',
    title: 'A1',
    created_by_id: 'author-1',
    editing_mode: 'suggest_internal',
    discussions: [
      {
        id: 'suggestion-1',
        crId: 'CR-1',
        comments: [],
        createdAt: 1,
        isResolved: false,
        userId: 'user-1',
      },
    ],
    collaborators: [
      {
        id: 'collab-1',
        status: 'member',
        user: { id: 'user-1', first_name: 'Test', last_name: 'User' },
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
    change_requests: [
      {
        id: 'change-request-1',
        title: 'CR-1',
        status: 'open',
        votes_for: 2,
        votes_against: 1,
        votes_abstain: 1,
        votes: [{ id: 'vote-1', user_id: 'user-1', vote: 'accept' }],
      },
    ],
  };
}

describe('adaptAmendmentToEntity', () => {
  it('allows amendment mode changes for users with manage amendment rights', () => {
    const entity = adaptAmendmentToEntity(amendmentWithRole('manage'), document, 'user-1');

    expect(entity?.canChangeMode).toBe(true);
    expect(entity?.canManageChangeRequestVotes).toBe(true);
  });

  it('does not allow amendment mode changes for collaborators without update/manage rights', () => {
    const entity = adaptAmendmentToEntity(amendmentWithRole('view'), document, 'user-1');

    expect(entity?.canChangeMode).toBe(false);
    expect(entity?.canManageChangeRequestVotes).toBe(false);
  });

  it('maps collaborator first and last names onto editor users', () => {
    const entity = adaptAmendmentToEntity(amendmentWithRole('view'), document, 'user-1');

    expect(entity?.collaborators[0]?.user).toEqual(
      expect.objectContaining({
        firstName: 'Test',
        lastName: 'User',
        name: 'Test User',
      })
    );
  });

  it('enriches full-text discussions with persisted change request vote aggregates', () => {
    const entity = adaptAmendmentToEntity(amendmentWithRole('vote'), document, 'user-1');
    const discussion = entity?.discussions[0];

    expect(entity?.canVoteOnChangeRequests).toBe(true);
    expect(discussion?.votesFor).toBe(2);
    expect(discussion?.votesAgainst).toBe(1);
    expect(discussion?.votesAbstain).toBe(1);
    expect(discussion?.votedCollaboratorCount).toBe(4);
    expect(discussion?.votes).toEqual([{ id: 'vote-1', vote: 'accept', voterId: 'user-1' }]);
  });
});
