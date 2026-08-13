import { describe, expect, it } from 'vitest';
import { checkPermission } from '../check';
import type { Amendment } from '../types';

describe('checkPermission amendment scope', () => {
  const amendment: Amendment = {
    id: 'amendment-1',
    owner: { id: 'author-user' },
    amendmentRoleCollaborators: [
      {
        id: 'collaboration-1',
        user: { id: 'editor-user' },
        status: 'member',
        role: {
          id: 'role-1',
          name: 'Editor',
          scope: 'amendment',
          actionRights: [
            {
              id: 'right-1',
              resource: 'amendments',
              action: 'manage',
              amendment: { id: 'amendment-1' },
            },
          ],
        },
      },
    ],
  };

  it('allows the amendment author as owner', () => {
    expect(
      checkPermission({ userId: 'author-user', amendment }, { amendment }, 'delete', 'amendments')
    ).toBe(true);
  });

  it('allows amendment collaborators through amendment-scoped action rights', () => {
    expect(
      checkPermission({ userId: 'editor-user', amendment }, { amendment }, 'update', 'amendments')
    ).toBe(true);
  });

  it('allows amendment collaborators from raw Zero role action_rights', () => {
    const rawAmendment = {
      id: 'amendment-1',
      collaborators: [
        {
          id: 'collaboration-1',
          user: { id: 'manager-user' },
          status: 'member',
          role: {
            id: 'role-1',
            action_rights: [
              {
                id: 'right-1',
                resource: 'amendments',
                action: 'manage',
                amendment_id: 'amendment-1',
              },
            ],
          },
        },
      ],
    } as unknown as Amendment;

    expect(
      checkPermission(
        { userId: 'manager-user', amendment: rawAmendment },
        { amendment: rawAmendment },
        'update',
        'amendments'
      )
    ).toBe(true);
  });

  it('denies pending collaborators even if their role has amendment manage rights', () => {
    const rawAmendment = {
      id: 'amendment-1',
      collaborators: [
        {
          id: 'collaboration-1',
          user: { id: 'invited-manager' },
          status: 'invited',
          role: {
            id: 'role-1',
            action_rights: [
              {
                id: 'right-1',
                resource: 'amendments',
                action: 'manage',
                amendment_id: 'amendment-1',
              },
            ],
          },
        },
        {
          id: 'collaboration-2',
          user: { id: 'requested-manager' },
          status: 'requested',
          role: {
            id: 'role-1',
            action_rights: [
              {
                id: 'right-1',
                resource: 'amendments',
                action: 'manage',
                amendment_id: 'amendment-1',
              },
            ],
          },
        },
      ],
    } as unknown as Amendment;

    for (const userId of ['invited-manager', 'requested-manager']) {
      expect(
        checkPermission(
          { userId, amendment: rawAmendment },
          { amendment: rawAmendment },
          'manage',
          'amendments'
        )
      ).toBe(false);
    }
  });

  it('denies unrelated users', () => {
    expect(
      checkPermission({ userId: 'viewer-user', amendment }, { amendment }, 'update', 'amendments')
    ).toBe(false);
  });
});
