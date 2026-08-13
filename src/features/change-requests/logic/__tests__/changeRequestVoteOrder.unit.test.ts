import { describe, expect, it } from 'vitest';
import {
  buildSuggestionDocumentOrder,
  CHANGE_REQUEST_VOTE_ORDER_VALUES,
  normalizeChangeRequestVoteOrder,
  sortChangeRequestsByVoteOrder,
} from '../changeRequestVoteOrder';

function createChangeRequest(id: string, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id,
    title: id,
    branch_display_number: 2,
    branch_sequence_number: Number.parseInt(id.replace(/\D/g, ''), 10),
    changed_character_count: 10,
    created_at: 1000,
    ...overrides,
  };
}

describe('changeRequestVoteOrder', () => {
  it('sorts by text position before CR label fallback', () => {
    const cr13 = createChangeRequest('CR-13');
    const cr15 = createChangeRequest('CR-15');
    const suggestionDocumentOrder = buildSuggestionDocumentOrder([
      {
        type: 'p',
        children: [{ text: 'early', suggestion_15: { id: 'suggestion-15' } }],
      },
      {
        type: 'p',
        children: [{ text: 'later', suggestion_13: { id: 'suggestion-13' } }],
      },
    ]);

    const ordered = sortChangeRequestsByVoteOrder([cr13, cr15], 'text_position', {
      getSuggestionId: item => (item.id === 'CR-15' ? 'suggestion-15' : 'suggestion-13'),
      suggestionDocumentOrder,
    });

    expect(ordered.map(item => item.id)).toEqual(['CR-15', 'CR-13']);
  });

  it('places city-design CRs after positioned document CRs and orders them by CR number', () => {
    const documentCr = createChangeRequest('CR-8');
    const streetCr10 = createChangeRequest('CR-10', {
      source_type: 'city_design_object',
    });
    const streetCr2 = createChangeRequest('CR-2', {
      source_type: 'city_design_object',
    });

    const ordered = sortChangeRequestsByVoteOrder(
      [streetCr10, documentCr, streetCr2],
      'text_position',
      {
        getTextPosition: item => (item.id === 'CR-8' ? 4 : null),
      }
    );

    expect(ordered.map(item => item.id)).toEqual(['CR-8', 'CR-2', 'CR-10']);
  });

  it('sorts by changed character count with larger changes first', () => {
    const ordered = sortChangeRequestsByVoteOrder(
      [
        createChangeRequest('CR-11', { changed_character_count: 20 }),
        createChangeRequest('CR-9', { changed_character_count: 3 }),
        createChangeRequest('CR-13', { changed_character_count: 10 }),
      ],
      'changed_character_count'
    );

    expect(ordered.map(item => item.id)).toEqual(['CR-11', 'CR-13', 'CR-9']);
  });

  it('falls back to removed and added text when a persisted character count is zero', () => {
    const ordered = sortChangeRequestsByVoteOrder(
      [
        createChangeRequest('CR-6', {
          changed_character_count: 0,
          original_text: 'BR-1: Soll CR-2 nicht entfernt werden',
          new_text: '',
        }),
        createChangeRequest('CR-4', {
          changed_character_count: 0,
          original_text: '',
          new_text: ' hinzugefügt',
        }),
        createChangeRequest('CR-2', {
          changed_character_count: 0,
          original_text: '',
          new_text: ' nicht hinzugefügt',
        }),
        createChangeRequest('CR-8', {
          changed_character_count: 0,
          original_text: 'Soll CR-1 entfernt werden',
          new_text: '',
        }),
      ],
      'changed_character_count'
    );

    expect(ordered.map(item => item.id)).toEqual(['CR-6', 'CR-8', 'CR-2', 'CR-4']);
  });

  it('uses semantic city-design changes instead of persisted full-snapshot sizes', () => {
    const streetObject = (
      customUnitCostMinor: number,
      overrides: Record<string, unknown> = {}
    ) => ({
      id: 'object-1',
      type: 'tree',
      geometry: { kind: 'point', point: { x: 1, z: 1 }, rotation: 0 },
      properties: { species: 'oak' },
      cost: {
        rule: 'per_item',
        currency: 'EUR',
        suggestedUnitCostMinor: 10_000,
        customUnitCostMinor,
      },
      ...overrides,
    });
    const priceCr = createChangeRequest('CR-1', {
      source_type: 'city_design_object',
      changed_character_count: 999_999,
      original_properties: { object: streetObject(10_000) },
      new_properties: { object: streetObject(10_100) },
    });
    const geometryCr = createChangeRequest('CR-2', {
      source_type: 'city_design_object',
      changed_character_count: 1,
      original_properties: { object: streetObject(10_000) },
      new_properties: {
        object: streetObject(10_000, {
          geometry: { kind: 'point', point: { x: 123_456, z: 654_321 }, rotation: 270 },
          properties: {
            species: 'a-very-long-replacement-species-name',
            note: 'a substantial semantic change',
          },
        }),
      },
    });

    const ordered = sortChangeRequestsByVoteOrder([priceCr, geometryCr], 'changed_character_count');

    expect(ordered.map(item => item.id)).toEqual(['CR-2', 'CR-1']);
  });

  it('sorts by CR number and falls back to created_at', () => {
    const ordered = sortChangeRequestsByVoteOrder(
      [
        createChangeRequest('row-late', {
          title: 'Untitled late',
          branch_sequence_number: null,
          created_at: 3000,
        }),
        createChangeRequest('CR-9', { branch_sequence_number: 9, created_at: 2000 }),
        createChangeRequest('row-early', {
          title: 'Untitled early',
          branch_sequence_number: null,
          created_at: 1000,
        }),
      ],
      'cr_number'
    );

    expect(ordered.map(item => item.id)).toEqual(['CR-9', 'row-early', 'row-late']);
  });

  it('normalizes supported, unknown, and non-string vote orders', () => {
    for (const value of CHANGE_REQUEST_VOTE_ORDER_VALUES) {
      expect(normalizeChangeRequestVoteOrder(value)).toBe(value);
    }
    expect(normalizeChangeRequestVoteOrder('unknown')).toBe('text_position');
    expect(normalizeChangeRequestVoteOrder(null)).toBe('text_position');
  });

  it('walks nested suggestion nodes once and ignores malformed decorations', () => {
    expect(buildSuggestionDocumentOrder(null)).toEqual(new Map());
    expect(buildSuggestionDocumentOrder({})).toEqual(new Map());

    const order = buildSuggestionDocumentOrder([
      null,
      'text',
      [],
      {
        type: 'p',
        ordinary: { id: 'ignored-key' },
        suggestion_invalid: 'not-an-object',
        suggestion_blank: { id: '   ' },
        suggestion_first: { id: 'suggestion-1' },
        children: [
          { text: 'leaf', suggestion_duplicate: { id: 'suggestion-1' } },
          { text: 'leaf', suggestion_second: { id: 'suggestion-2' } },
        ],
      },
      { type: 'p', children: 'not-an-array' },
    ]);

    expect([...order.entries()]).toEqual([
      ['suggestion-1', 3],
      ['suggestion-2', 5],
    ]);
  });

  it('reads explicit, nested, direct, and malformed change-request records', () => {
    const wrappers = [
      { id: 'wrapper-b', payload: { title: 'B' } },
      { id: 'wrapper-a', payload: { title: 'A' } },
    ];
    expect(
      sortChangeRequestsByVoteOrder(wrappers, 'text_position', {
        getChangeRequest: item => item.payload,
        getTextPosition: () => 0,
      }).map(item => item.id)
    ).toEqual(['wrapper-a', 'wrapper-b']);

    expect(
      sortChangeRequestsByVoteOrder(
        [
          { id: 'nested-b', change_request: { title: 'B' } },
          { id: 'nested-a', change_request: { title: 'A' } },
        ],
        'text_position',
        { getChangeRequest: () => null, getTextPosition: () => 0 }
      ).map(item => item.id)
    ).toEqual(['nested-a', 'nested-b']);

    expect(
      sortChangeRequestsByVoteOrder([null, 'primitive', []], 'text_position', {
        getTextPosition: () => Number.NaN,
      })
    ).toEqual([null, 'primitive', []]);
  });

  it('uses every supported label fallback and preserves stable empty labels', () => {
    const fields = [
      'display_cr_id',
      'displayCrId',
      'cr_id',
      'crId',
      'title',
      'change_request_id',
      'id',
    ] as const;

    for (const field of fields) {
      const left = { [field]: 'B' };
      const right = { [field]: 'A' };
      expect(
        sortChangeRequestsByVoteOrder([left, right], 'text_position', {
          getTextPosition: () => 0,
        })
      ).toEqual([right, left]);
    }

    const emptyA = { title: '   ' };
    const emptyB = { title: null };
    expect(
      sortChangeRequestsByVoteOrder([emptyA, emptyB], 'text_position', {
        getTextPosition: () => 0,
      })
    ).toEqual([emptyA, emptyB]);
  });

  it('uses every numeric and branch-number fallback', () => {
    const numericFields = [
      'branch_scoped_cr_number',
      'branchScopedCrNumber',
      'branch_sequence_number',
      'branchSequenceNumber',
    ] as const;
    for (const field of numericFields) {
      expect(
        sortChangeRequestsByVoteOrder(
          [
            { id: 'two', [field]: 2.9 },
            { id: 'one', [field]: 1.9 },
          ],
          'cr_number'
        ).map(item => item.id)
      ).toEqual(['one', 'two']);
    }

    const branchFields = ['branch_display_number', 'branchDisplayNumber'] as const;
    for (const field of branchFields) {
      expect(
        sortChangeRequestsByVoteOrder(
          [
            { id: 'two', [field]: 2 },
            { id: 'one', [field]: 1 },
          ],
          'cr_number'
        ).map(item => item.id)
      ).toEqual(['one', 'two']);
    }

    expect(
      sortChangeRequestsByVoteOrder(
        [
          { id: 'late', title: `Branch 2 CR-${'9'.repeat(400)} CR-20` },
          { id: 'early', title: 'Branch 1 CR-3' },
        ],
        'cr_number'
      ).map(item => item.id)
    ).toEqual(['early', 'late']);

    expect(
      sortChangeRequestsByVoteOrder(
        [
          { id: 'negative', branch_sequence_number: -1 },
          { id: 'zero', branch_sequence_number: 0 },
          { id: 'positive', branch_sequence_number: 1 },
        ],
        'cr_number'
      ).map(item => item.id)
    ).toEqual(['positive', 'negative', 'zero']);

    expect(
      sortChangeRequestsByVoteOrder(
        [
          { id: 'huge', title: `CR-${'9'.repeat(400)}` },
          { id: 'finite', title: 'CR-2' },
        ],
        'cr_number'
      ).map(item => item.id)
    ).toEqual(['finite', 'huge']);
  });

  it('sorts nullable numbers and timestamps through every comparison state', () => {
    const ordered = sortChangeRequestsByVoteOrder(
      [
        { id: 'missing', title: 'Same', branch_sequence_number: null, created_at: null },
        {
          id: 'invalid-string',
          title: 'Same',
          branch_sequence_number: 2,
          created_at: 'invalid',
        },
        {
          id: 'date-string',
          title: 'Same',
          branch_sequence_number: 2,
          created_at: '2026-01-02T00:00:00.000Z',
        },
        { id: 'number', title: 'Same', branch_sequence_number: 2, created_at: 10 },
      ],
      'cr_number'
    );

    expect(ordered.map(item => item.id)).toEqual([
      'number',
      'date-string',
      'invalid-string',
      'missing',
    ]);
  });

  it('computes snapshot character counts for all property and text representations', () => {
    const items = [
      {
        id: 'persisted',
        changedCharacterCount: 20,
        createdAt: 4,
      },
      {
        id: 'computed',
        changed_character_count: 0,
        originalText: 'abc',
        newText: 'def',
        original_properties: { absent: null, count: 12 },
        originalProperties: { enabled: true },
        new_properties: 'invalid',
        newProperties: { label: 'value' },
        createdAt: 3,
      },
      {
        id: 'zero-persisted',
        changed_character_count: 0,
        createdAt: 2,
      },
      {
        id: 'zero-computed',
        changed_character_count: null,
        createdAt: 1,
      },
    ];

    expect(
      sortChangeRequestsByVoteOrder(items, 'changed_character_count').map(item => item.id)
    ).toEqual(['computed', 'persisted', 'zero-computed', 'zero-persisted']);

    expect(sortChangeRequestsByVoteOrder([null, 'primitive'], 'changed_character_count')).toEqual([
      null,
      'primitive',
    ]);
  });

  it('supports camel-case city snapshots and both city/document comparison orientations', () => {
    const city = {
      id: 'city',
      title: 'City',
      sourceType: 'city_design_object',
      originalProperties: {},
      newProperties: {},
      branch_sequence_number: 1,
    };
    const document = { id: 'document', title: 'Document' };

    expect(
      sortChangeRequestsByVoteOrder([city, document], 'text_position').map(item => item.id)
    ).toEqual(['document', 'city']);
    expect(
      sortChangeRequestsByVoteOrder([document, city], 'text_position').map(item => item.id)
    ).toEqual(['document', 'city']);
    expect(
      sortChangeRequestsByVoteOrder([city, { ...city, id: 'city-2' }], 'text_position')
    ).toHaveLength(2);
    expect(
      sortChangeRequestsByVoteOrder([city, { ...city, id: 'city-2' }], 'changed_character_count')
    ).toHaveLength(2);
  });

  it('resolves explicit, suggestion-map, missing-map, and missing-position text locations', () => {
    const items = [{ id: 'explicit' }, { id: 'mapped' }, { id: 'unknown' }, { id: 'missing-id' }];
    const map = new Map([['suggestion-mapped', 2]]);
    const ordered = sortChangeRequestsByVoteOrder(items, 'text_position', {
      getTextPosition: item =>
        item.id === 'explicit' ? 1 : item.id === 'mapped' ? Number.POSITIVE_INFINITY : undefined,
      getSuggestionId: item =>
        item.id === 'mapped'
          ? 'suggestion-mapped'
          : item.id === 'unknown'
            ? 'suggestion-unknown'
            : null,
      suggestionDocumentOrder: map,
    });

    expect(ordered.map(item => item.id)).toEqual(['explicit', 'mapped', 'missing-id', 'unknown']);

    expect(
      sortChangeRequestsByVoteOrder([{ id: 'b' }, { id: 'a' }], 'text_position', {
        getSuggestionId: item => item.id,
      }).map(item => item.id)
    ).toEqual(['a', 'b']);
  });

  it('falls through equal changed counts and CR numbers to created time and labels', () => {
    expect(
      sortChangeRequestsByVoteOrder(
        [
          { id: 'later', title: 'Same', changed_character_count: 5, created_at: 2 },
          { id: 'earlier', title: 'Same', changed_character_count: 5, created_at: 1 },
        ],
        'changed_character_count'
      ).map(item => item.id)
    ).toEqual(['earlier', 'later']);

    expect(
      sortChangeRequestsByVoteOrder(
        [
          { id: 'b', title: 'B', changed_character_count: 5, created_at: 1 },
          { id: 'a', title: 'A', changed_character_count: 5, created_at: 1 },
        ],
        'changed_character_count'
      ).map(item => item.id)
    ).toEqual(['a', 'b']);

    expect(
      sortChangeRequestsByVoteOrder(
        [
          { id: 'b', title: 'B', branch_sequence_number: 1, created_at: 1 },
          { id: 'a', title: 'A', branch_sequence_number: 1, created_at: 1 },
        ],
        'cr_number'
      ).map(item => item.id)
    ).toEqual(['a', 'b']);

    expect(sortChangeRequestsByVoteOrder([null, 'primitive'], 'cr_number')).toEqual([
      null,
      'primitive',
    ]);
  });
});
