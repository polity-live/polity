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
      {
        id: 'collab-2',
        status: 'member',
        user: { id: 'user-2', first_name: 'No', last_name: 'Vote' },
        role: {
          id: 'role-2',
          name: 'Viewer',
          action_rights: [
            {
              id: 'right-2',
              resource: 'amendments',
              action: 'view',
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

  it('keeps internal change request vote management behind manage amendment rights', () => {
    const entity = adaptAmendmentToEntity(amendmentWithRole('update'), document, 'user-1');

    expect(entity?.canChangeMode).toBe(true);
    expect(entity?.canManageChangeRequestVotes).toBe(false);
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
    expect(discussion?.eligibleVoterCount).toBe(1);
    expect(discussion?.votedCollaboratorCount).toBe(4);
    expect(discussion?.votes).toEqual([{ id: 'vote-1', vote: 'accept', voterId: 'user-1' }]);
  });

  it('includes change request authors as editor users even when they are not collaborators', () => {
    const amendment = amendmentWithRole('view') as any;
    amendment.change_requests[0] = {
      ...amendment.change_requests[0],
      user_id: 'participant-1',
      user: {
        id: 'participant-1',
        first_name: 'Event',
        last_name: 'Participant',
        avatar: 'avatar.png',
      },
    };

    const entity = adaptAmendmentToEntity(amendment, document, 'user-1');

    expect(entity?.extraUsers).toEqual([
      expect.objectContaining({
        id: 'participant-1',
        name: 'Event Participant',
        avatarUrl: 'avatar.png',
      }),
    ]);
  });

  it('uses branch document, discussions, and change requests when a process branch is selected', () => {
    const amendment = amendmentWithRole('vote') as any;
    amendment.discussions = [
      {
        id: 'suggestion-main',
        crId: 'CR-MAIN',
        comments: [],
        createdAt: 1,
        isResolved: false,
        userId: 'user-1',
      },
    ];
    amendment.change_requests = [
      {
        id: 'change-request-main',
        title: 'CR-MAIN',
        status: 'open',
        process_branch_id: null,
        votes_for: 1,
        votes_against: 0,
        votes_abstain: 0,
        votes: [],
      },
      {
        id: 'change-request-branch',
        title: 'CR-B1',
        status: 'open',
        process_branch_id: 'branch-1',
        votes_for: 3,
        votes_against: 2,
        votes_abstain: 0,
        votes: [],
      },
    ];

    const branch = {
      id: 'branch-1',
      created_at: 2,
      status: 'scheduled',
      resolution: null,
      discussions: [
        {
          id: 'suggestion-branch',
          crId: 'CR-B1',
          comments: [],
          createdAt: 2,
          isResolved: false,
          userId: 'user-1',
        },
      ],
    };
    const earlierBranch = {
      id: 'branch-earlier',
      created_at: 1,
    };
    const branchDocument = {
      ...document,
      id: 'document-branch',
      content: [{ type: 'p', children: [{ text: 'Branch text' }] }],
    };

    const entity = adaptAmendmentToEntity(amendment, branchDocument, 'user-1', {
      processBranch: branch,
      processBranches: [earlierBranch, branch],
    });

    expect(entity?.id).toBe('document-branch');
    expect(entity?.metadata?.processBranchId).toBe('branch-1');
    expect(entity?.discussions).toHaveLength(1);
    expect(entity?.discussions[0]).toEqual(
      expect.objectContaining({
        id: 'suggestion-branch',
        displayCrId: 'Branch 2 CR-1',
        votesFor: 3,
        votesAgainst: 2,
      })
    );
  });

  it('uses suggest_event from the selected process branch as the editor mode', () => {
    const branch = {
      id: 'branch-suggest-event',
      editing_mode: 'suggest_event',
      status: 'scheduled',
      resolution: null,
    };

    const entity = adaptAmendmentToEntity(amendmentWithRole('vote'), document, 'user-1', {
      processBranch: branch,
      processBranches: [branch],
    });

    expect(entity?.editingMode).toBe('suggest_event');
  });

  it('uses vote_internal from the selected process branch as the editor mode', () => {
    const branch = {
      id: 'branch-vote-internal',
      editing_mode: 'vote_internal',
      status: 'scheduled',
      resolution: null,
    };

    const entity = adaptAmendmentToEntity(amendmentWithRole('vote'), document, 'user-1', {
      processBranch: branch,
      processBranches: [branch],
    });

    expect(entity?.editingMode).toBe('vote_internal');
  });

  it('uses document editing mode when no process branch is selected', () => {
    const entity = adaptAmendmentToEntity(
      amendmentWithRole('vote'),
      { ...document, editing_mode: 'vote_internal' },
      'user-1'
    );

    expect(entity?.editingMode).toBe('vote_internal');
    expect(entity?.metadata.amendmentEditingMode).toBe('vote_internal');
  });

  it('keeps readonly process branches in view mode', () => {
    const branch = {
      id: 'branch-completed',
      editing_mode: 'suggest_event',
      status: 'completed',
      resolution: null,
    };

    const entity = adaptAmendmentToEntity(amendmentWithRole('vote'), document, 'user-1', {
      processBranch: branch,
      processBranches: [branch],
    });

    expect(entity?.editingMode).toBe('view');
    expect(entity?.canChangeMode).toBe(false);
  });
});
