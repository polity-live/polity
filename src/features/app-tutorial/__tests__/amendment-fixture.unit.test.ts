import { describe, expect, it } from 'vitest';

import { createChangeRequestDiffSnapshot } from '@/features/change-requests/utils/suggestion-extraction';
import {
  APP_TUTORIAL_ELECTION_COPY,
  createAppTutorialAmendmentTextFixture,
  getAppTutorialElectionCopy,
} from '../amendment-fixture';

describe('createAppTutorialAmendmentTextFixture', () => {
  it('provides complete German and English election display copy', () => {
    expect(getAppTutorialElectionCopy('de')).toBe(APP_TUTORIAL_ELECTION_COPY.de);
    expect(getAppTutorialElectionCopy('en')).toEqual({
      agendaTitle: 'Election of the District Chair',
      agendaDescription: 'The initiative elects a person as district chair.',
      electionTitle: 'District Chair',
      electionDescription:
        'Election of the district chair within the Climate-Friendly Euckenstraße initiative.',
    });
  });

  it('links every prepared change request to a real document suggestion', () => {
    const changes = [
      {
        changeRequestId: 'change-1',
        suggestionId: 'suggestion-1',
        userId: 'user-1',
        title: 'First change',
        description: 'First description',
        newText: 'First addition',
      },
      {
        changeRequestId: 'change-2',
        suggestionId: 'suggestion-2',
        userId: 'user-2',
        title: 'Second change',
        description: 'Second description',
        newText: 'Second addition',
      },
    ];

    const fixture = createAppTutorialAmendmentTextFixture({
      baseText: 'Existing amendment text.',
      closingText: 'Existing closing text.',
      changes,
      createdAt: 123,
    });

    expect(fixture.documentContent.at(-1)).toEqual({
      type: 'p',
      children: [{ text: 'Existing closing text.' }],
    });
    expect(fixture.discussions).toHaveLength(2);
    for (const change of changes) {
      expect(fixture.discussions).toContainEqual(
        expect.objectContaining({
          id: change.suggestionId,
          changeRequestEntityId: change.changeRequestId,
          status: 'open',
        })
      );
      expect(
        createChangeRequestDiffSnapshot(change.suggestionId, fixture.documentContent as any)
      ).toMatchObject({
        change_type: 'insert',
        original_text: null,
        new_text: change.newText,
      });
    }
  });

  it('omits the optional closing paragraph', () => {
    const fixture = createAppTutorialAmendmentTextFixture({
      baseText: 'Base',
      changes: [],
    });
    expect(fixture.documentContent).toEqual([{ type: 'p', children: [{ text: 'Base' }] }]);
  });
});
