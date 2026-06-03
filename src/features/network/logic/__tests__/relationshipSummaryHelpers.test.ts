import { describe, expect, it } from 'vitest';

import { buildActiveRelationshipSummaries } from '../relationshipSummaryHelpers';

describe('buildActiveRelationshipSummaries', () => {
  it('maps parent entries to a current-group child relationship', () => {
    const summaries = buildActiveRelationshipSummaries({
      parents: [
        {
          group: { id: 'h2', name: 'H2' },
          rights: ['informationRight'],
        },
      ],
      children: [],
      siblings: [],
    });

    expect(summaries).toEqual([
      {
        group: { id: 'h2', name: 'H2' },
        rights: ['informationRight'],
        type: 'child',
        membershipMode: null,
      },
    ]);
  });

  it('maps child entries to a current-group parent relationship', () => {
    const summaries = buildActiveRelationshipSummaries({
      parents: [],
      children: [
        {
          group: { id: 'b2', name: 'B2' },
          rights: ['informationRight'],
        },
      ],
      siblings: [],
    });

    expect(summaries).toEqual([
      {
        group: { id: 'b2', name: 'B2' },
        rights: ['informationRight'],
        type: 'parent',
        membershipMode: null,
      },
    ]);
  });
});
