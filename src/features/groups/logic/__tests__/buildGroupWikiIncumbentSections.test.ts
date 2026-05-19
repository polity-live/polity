import { describe, expect, it } from 'vitest';

import { buildGroupWikiIncumbentSections } from '../buildGroupWikiIncumbentSections';

describe('buildGroupWikiIncumbentSections', () => {
  it('merges memberships with holder history, prefers incumbent data, and keeps vacancy placeholders', () => {
    const sections = buildGroupWikiIncumbentSections(
      [
        {
          id: 'chair',
          title: 'Chair',
          description: 'Leads the circle',
          visibility: 'public',
          holder_history: [
            {
              user: {
                id: 'u1',
                first_name: 'Iris',
                last_name: 'Incumbent',
                handle: 'iris-inc',
                avatar: 'incumbent-avatar',
              },
            },
            {
              user: {
                id: 'u4',
                first_name: 'Nia',
                last_name: 'Second',
                handle: 'nia-second',
                avatar: 'second-avatar',
              },
            },
            {
              end_date: 1,
              user: {
                id: 'u5',
                first_name: 'Old',
                last_name: 'Holder',
              },
            },
          ],
        },
        {
          id: 'scribe',
          title: 'Scribe',
          description: 'Keeps the notes',
          visibility: 'public',
        },
        {
          id: 'private-role',
          title: 'Private role',
          visibility: 'private',
        },
      ],
      [
        {
          status: 'active',
          role: { id: 'chair' },
          user: {
            id: 'u1',
            first_name: 'Mia',
            last_name: 'Member',
            handle: 'mia-member',
            avatar: 'member-avatar',
          },
        },
        {
          status: 'inactive',
          role: { id: 'chair' },
          user: {
            id: 'u3',
            first_name: 'Inactive',
            last_name: 'Person',
          },
        },
        {
          status: 'active',
          role: { id: 'private-role' },
          user: {
            id: 'u9',
            first_name: 'Hidden',
            last_name: 'Member',
          },
        },
      ]
    );

    expect(sections).toHaveLength(1);
    expect(sections[0].id).toBe('low-count-roles');
    expect(sections[0].cards).toHaveLength(3);
    expect(sections[0].cards).toMatchObject([
      {
        kind: 'person',
        id: 'chair:u1',
        userId: 'u1',
        name: 'Iris Incumbent',
        handle: 'iris-inc',
        avatar: 'incumbent-avatar',
        roleTitle: 'Chair',
      },
      {
        kind: 'person',
        id: 'chair:u4',
        userId: 'u4',
        name: 'Nia Second',
        handle: 'nia-second',
        avatar: 'second-avatar',
        roleTitle: 'Chair',
      },
      {
        kind: 'vacancy',
        id: 'scribe:vacancy',
        roleTitle: 'Scribe',
        roleDescription: 'Keeps the notes',
      },
    ]);
  });
});
