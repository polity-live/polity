import { describe, expect, it } from 'vitest';

import { buildEventWikiIncumbentSections } from '../buildEventWikiIncumbentSections';

describe('buildEventWikiIncumbentSections', () => {
  it('creates a dedicated carousel at the three-incumbent threshold and prefers holder data', () => {
    const sections = buildEventWikiIncumbentSections(
      [
        {
          id: 'moderator',
          title: 'Moderator',
          description: 'Keeps the debate on track',
          visibility: 'public',
          holders: [
            {
              user: {
                id: 'u1',
                first_name: 'Nora',
                last_name: 'Holder',
                handle: 'nora-holder',
                avatar: 'holder-avatar',
              },
            },
            {
              user: {
                id: 'u3',
                first_name: 'Kai',
                last_name: 'Holder',
                handle: 'kai-holder',
                avatar: 'kai-avatar',
              },
            },
          ],
        },
        {
          id: 'timekeeper',
          title: 'Timekeeper',
          description: 'Keeps track of speaking time',
          visibility: 'public',
        },
        {
          id: 'steering',
          title: 'Steering committee',
          visibility: 'private',
        },
      ],
      [
        {
          role: { id: 'moderator' },
          user: {
            id: 'u1',
            first_name: 'Pat',
            last_name: 'Participant',
            handle: 'pat-participant',
            avatar: 'participant-avatar',
          },
        },
        {
          role: { id: 'moderator' },
          user: {
            id: 'u2',
            first_name: 'Uma',
            last_name: 'Participant',
            handle: 'uma-participant',
            avatar: 'uma-avatar',
          },
        },
        {
          role: { id: 'steering' },
          user: {
            id: 'u9',
            first_name: 'Hidden',
            last_name: 'Participant',
          },
        },
      ]
    );

    expect(sections).toHaveLength(2);
    expect(sections[0]).toMatchObject({
      id: 'moderator',
      title: 'Moderator',
      description: '3 active incumbents',
    });
    expect(sections[0].cards).toMatchObject([
      {
        kind: 'person',
        id: 'moderator:u1',
        userId: 'u1',
        name: 'Nora Holder',
        handle: 'nora-holder',
        avatar: 'holder-avatar',
      },
      {
        kind: 'person',
        id: 'moderator:u2',
        userId: 'u2',
        name: 'Uma Participant',
        handle: 'uma-participant',
        avatar: 'uma-avatar',
      },
      {
        kind: 'person',
        id: 'moderator:u3',
        userId: 'u3',
        name: 'Kai Holder',
        handle: 'kai-holder',
        avatar: 'kai-avatar',
      },
    ]);
    expect(sections[1].cards).toMatchObject([
      {
        kind: 'vacancy',
        id: 'timekeeper:vacancy',
        roleTitle: 'Timekeeper',
      },
    ]);
  });
});
