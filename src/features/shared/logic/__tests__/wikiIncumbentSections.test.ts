import { describe, expect, it } from 'vitest';

import {
  buildWikiIncumbentCarouselSections,
  type WikiIncumbentRoleCards,
} from '../wikiIncumbentSections';

describe('buildWikiIncumbentCarouselSections', () => {
  it('gives roles with three incumbents their own carousel and combines smaller roles', () => {
    const roles: WikiIncumbentRoleCards[] = [
      {
        id: 'chair',
        title: 'Chair',
        description: 'Leads the group',
        assigneeCount: 3,
        cards: [
          {
            kind: 'person',
            id: 'chair:u1',
            userId: 'u1',
            name: 'Ari Chair',
            handle: 'ari',
            avatar: null,
            roleId: 'chair',
            roleTitle: 'Chair',
            roleDescription: 'Leads the group',
          },
          {
            kind: 'person',
            id: 'chair:u2',
            userId: 'u2',
            name: 'Bea Chair',
            handle: 'bea',
            avatar: null,
            roleId: 'chair',
            roleTitle: 'Chair',
            roleDescription: 'Leads the group',
          },
          {
            kind: 'person',
            id: 'chair:u3',
            userId: 'u3',
            name: 'Cam Chair',
            handle: 'cam',
            avatar: null,
            roleId: 'chair',
            roleTitle: 'Chair',
            roleDescription: 'Leads the group',
          },
        ],
      },
      {
        id: 'scribe',
        title: 'Scribe',
        description: 'Writes the notes',
        assigneeCount: 2,
        cards: [
          {
            kind: 'person',
            id: 'scribe:u4',
            userId: 'u4',
            name: 'Dee Scribe',
            handle: 'dee',
            avatar: null,
            roleId: 'scribe',
            roleTitle: 'Scribe',
            roleDescription: 'Writes the notes',
          },
          {
            kind: 'person',
            id: 'scribe:u5',
            userId: 'u5',
            name: 'Eli Scribe',
            handle: 'eli',
            avatar: null,
            roleId: 'scribe',
            roleTitle: 'Scribe',
            roleDescription: 'Writes the notes',
          },
        ],
      },
      {
        id: 'treasurer',
        title: 'Treasurer',
        description: 'Tracks the budget',
        assigneeCount: 0,
        cards: [
          {
            kind: 'vacancy',
            id: 'treasurer:vacancy',
            roleId: 'treasurer',
            roleTitle: 'Treasurer',
            roleDescription: 'Tracks the budget',
          },
        ],
      },
    ];

    const sections = buildWikiIncumbentCarouselSections(roles);

    expect(sections).toHaveLength(2);
    expect(sections[0]).toMatchObject({
      id: 'chair',
      title: 'Chair',
      description: '3 active incumbents',
    });
    expect(sections[0].cards).toHaveLength(3);
    expect(sections[1]).toMatchObject({
      id: 'low-count-roles',
      title: 'More roles & incumbents',
      description: 'Roles with fewer than 3 active incumbents, including vacant seats.',
    });
    expect(sections[1].cards.map(card => card.id)).toEqual([
      'scribe:u4',
      'scribe:u5',
      'treasurer:vacancy',
    ]);
  });
});
