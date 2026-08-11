import { describe, expect, it } from 'vitest';
import {
  countChangedCharacters,
  countChangedCharactersForSuggestion,
  createChangeRequestDiffSnapshot,
  createChangeRequestDiffSnapshotFromContent,
  extractSuggestionContent,
  hasRenderableSuggestionContent,
  isRenderableSuggestionType,
  suggestionContentFromChangeRequestSnapshot,
} from '../suggestion-extraction';
import { splitSuggestionPreviewText } from '../../logic/suggestionBlockLabels';

const chartBlockSuggestion = (type: 'insert' | 'remove', id = 'discussion-1') => ({
  chartType: 'bar',
  children: [{ text: '' }],
  presentation: {},
  query: { aggregation: 'sum', filters: {} },
  source: {
    datasetId: 'dataset-id',
    kind: 'dataset',
    provider: 'UPLOAD',
    snapshotId: 'snapshot-id',
    title: 'Dataset',
  },
  suggestion: { id, type },
  type: 'data_view',
  view: 'chart',
});

const tableBlockSuggestion = (type: 'insert' | 'remove', id = 'discussion-1') => ({
  children: [{ text: '' }],
  suggestion: { id, type },
  type: 'table',
});

const lineBreakSuggestion = (type: 'insert' | 'remove', id = 'discussion-1') => ({
  children: [{ text: '' }],
  suggestion: { id, isLineBreak: true, type },
  type: 'p',
});

describe('suggestion extraction changed character counts', () => {
  it('classifies renderable types and every kind of non-empty diff content', () => {
    expect(isRenderableSuggestionType(undefined)).toBe(false);
    expect(isRenderableSuggestionType('unknown')).toBe(false);
    for (const type of ['insert', 'remove', 'delete', 'replace', 'update']) {
      expect(isRenderableSuggestionType(type)).toBe(true);
    }

    expect(
      hasRenderableSuggestionContent({
        type: 'insert',
        text: 'old',
        newText: '',
        properties: {},
        newProperties: {},
      })
    ).toBe(true);
    expect(
      hasRenderableSuggestionContent({
        type: 'insert',
        text: '',
        newText: 'new',
        properties: {},
        newProperties: {},
      })
    ).toBe(true);
    expect(
      hasRenderableSuggestionContent({
        type: 'update',
        text: '',
        newText: '',
        properties: { align: 'left' },
        newProperties: {},
      })
    ).toBe(true);
    expect(
      hasRenderableSuggestionContent({
        type: 'update',
        text: '',
        newText: '',
        properties: {},
        newProperties: { align: 'right' },
      })
    ).toBe(true);
    expect(
      hasRenderableSuggestionContent({
        type: 'insert',
        text: '',
        newText: '',
        properties: {},
        newProperties: {},
      })
    ).toBe(false);
    expect(
      hasRenderableSuggestionContent({
        type: 'unknown',
        text: 'ignored',
        newText: '',
        properties: {},
        newProperties: {},
      })
    ).toBe(false);
  });

  it('returns empty content for absent or malformed documents', () => {
    const empty = { type: 'unknown', text: '', newText: '', properties: {}, newProperties: {} };
    expect(extractSuggestionContent('discussion-1', undefined)).toEqual(empty);
    expect(extractSuggestionContent('discussion-1', {} as any)).toEqual(empty);
  });

  it('counts inserted and removed suggestion text for one discussion', () => {
    const content = [
      {
        type: 'p',
        children: [
          {
            text: 'added',
            suggestion: true,
            suggestion_discussion_1: {
              id: 'discussion-1',
              type: 'insert',
            },
          },
          {
            text: 'removed',
            suggestion: true,
            suggestion_discussion_2: {
              id: 'discussion-2',
              type: 'remove',
            },
          },
        ],
      },
    ];

    expect(countChangedCharactersForSuggestion('discussion-1', content)).toBe(5);
    expect(countChangedCharactersForSuggestion('discussion-2', content)).toBe(7);
  });

  it('includes property updates in the changed character count', () => {
    const suggestion = extractSuggestionContent('discussion-1', [
      {
        type: 'p',
        children: [
          {
            text: 'Title',
            suggestion: true,
            suggestion_discussion_1: {
              id: 'discussion-1',
              type: 'update',
              properties: { align: 'left' },
              newProperties: { align: 'center' },
            },
          },
        ],
      },
    ]);

    expect(suggestion.newText).toBe('Title');
    expect(countChangedCharacters(suggestion)).toBe(25);
  });

  it('handles non-text nodes, unmatched marks, and every inline suggestion variant', () => {
    const suggestion = extractSuggestionContent('discussion-1', [
      null,
      'primitive',
      { type: 'void', children: 'not-an-array' },
      {
        type: 'p',
        suggestion: { id: 'discussion-1' },
        children: [
          {
            text: 'replacement',
            suggestion_other: { id: 'other', type: 'insert' },
            suggestion_replace: { id: 'discussion-1', type: 'replace' },
          },
          {
            text: '',
            suggestion_update: { id: 'discussion-1', type: 'update' },
          },
          {
            text: 'ignored',
            suggestion_unknown: { id: 'discussion-1', type: 'unknown' },
            suggestion_no_type: { id: 'discussion-1' },
          },
          { text: 'plain', suggestion_missing: undefined },
        ],
      },
    ] as any);

    expect(suggestion).toEqual({
      type: 'replace',
      text: '',
      newText: 'replacement',
      properties: {},
      newProperties: {},
    });
  });

  it('extracts block replace/delete marks and ignores unrelated block marks', () => {
    const suggestion = extractSuggestionContent('discussion-1', [
      { type: 'p', children: [{ text: '' }], suggestion: { id: 'other', type: 'insert' } },
      { type: 'p', children: [{ text: '' }], suggestion: { id: 'discussion-1', type: 'replace' } },
      { type: 'p', children: [{ text: '' }], suggestion: { id: 'discussion-1', type: 'delete' } },
      { type: 'p', children: [{ text: '' }], suggestion: { id: 'discussion-1', type: 'update' } },
    ] as any);

    expect(suggestion.type).toBe('replace');
    expect(suggestion.newText).toBe('__block__Text');
    expect(suggestion.text).toBe('__block__Text');
  });

  it('merges update properties independently and counts null-valued keys', () => {
    const suggestion = extractSuggestionContent('discussion-1', [
      {
        type: 'p',
        children: [
          {
            text: 'a',
            suggestion_first: {
              id: 'discussion-1',
              type: 'update',
              properties: { nullable: null },
            },
          },
          {
            text: 'b',
            suggestion_second: {
              id: 'discussion-1',
              type: 'update',
              newProperties: { enabled: true },
            },
          },
        ],
      },
    ] as any);

    expect(suggestion.properties).toEqual({ nullable: null });
    expect(suggestion.newProperties).toEqual({ enabled: true });
    expect(countChangedCharacters(suggestion)).toBe(21);
  });

  it('infers replace when one suggestion has removed and inserted text', () => {
    const suggestion = extractSuggestionContent('discussion-1', [
      {
        type: 'p',
        children: [
          {
            text: 'old',
            suggestion: true,
            suggestion_old: {
              id: 'discussion-1',
              type: 'remove',
            },
          },
          {
            text: 'new',
            suggestion: true,
            suggestion_new: {
              id: 'discussion-1',
              type: 'insert',
            },
          },
        ],
      },
    ]);

    expect(suggestion).toMatchObject({
      type: 'replace',
      text: 'old',
      newText: 'new',
    });
  });

  it('creates and restores a persisted change request diff snapshot', () => {
    const snapshot = createChangeRequestDiffSnapshot('discussion-1', [
      {
        type: 'p',
        children: [
          {
            text: 'Wird hinzugefügt',
            suggestion: true,
            suggestion_discussion_1: {
              id: 'discussion-1',
              type: 'insert',
            },
          },
        ],
      },
    ]);

    expect(snapshot).toMatchObject({
      change_type: 'insert',
      original_text: null,
      new_text: 'Wird hinzugefügt',
      changed_character_count: 16,
    });
    expect(suggestionContentFromChangeRequestSnapshot(snapshot)).toMatchObject({
      type: 'insert',
      text: '',
      newText: 'Wird hinzugefügt',
    });
  });

  it('normalizes persisted snapshot properties and empty diff fields', () => {
    expect(
      createChangeRequestDiffSnapshotFromContent({
        type: 'unknown',
        text: '',
        newText: '',
        properties: {},
        newProperties: {},
      })
    ).toEqual({
      change_type: null,
      original_text: null,
      new_text: null,
      original_properties: null,
      new_properties: null,
    });

    expect(
      createChangeRequestDiffSnapshotFromContent({
        type: 'update',
        text: '',
        newText: '',
        properties: { align: 'left' },
        newProperties: { align: 'center' },
      })
    ).toMatchObject({
      original_properties: { align: 'left' },
      new_properties: { align: 'center' },
    });

    expect(
      suggestionContentFromChangeRequestSnapshot({
        change_type: null,
        original_text: null,
        new_text: null,
        original_properties: ['invalid'],
        new_properties: {
          string: 'value',
          number: 1,
          boolean: false,
          nil: null,
          nested: { ignored: true },
        },
      })
    ).toEqual({
      type: 'unknown',
      text: '',
      newText: '',
      properties: {},
      newProperties: {
        string: 'value',
        number: 1,
        boolean: false,
        nil: null,
      },
    });

    expect(
      suggestionContentFromChangeRequestSnapshot({
        original_properties: 'invalid',
        new_properties: null,
      })
    ).toMatchObject({ properties: {}, newProperties: {} });
  });

  it('extracts inserted chart block suggestions as block labels', () => {
    const suggestion = extractSuggestionContent('discussion-1', [
      chartBlockSuggestion('insert'),
    ] as any);

    expect(suggestion).toMatchObject({
      newText: '__block__Chart',
      text: '',
      type: 'insert',
    });

    expect(
      createChangeRequestDiffSnapshot('discussion-1', [chartBlockSuggestion('insert')] as any)
    ).toMatchObject({
      change_type: 'insert',
      new_text: '__block__Chart',
      original_text: null,
    });
  });

  it('extracts removed table block suggestions as block labels', () => {
    const suggestion = extractSuggestionContent('discussion-1', [
      tableBlockSuggestion('remove'),
    ] as any);

    expect(suggestion).toMatchObject({
      newText: '',
      text: '__block__Table',
      type: 'remove',
    });

    expect(
      createChangeRequestDiffSnapshot('discussion-1', [tableBlockSuggestion('remove')] as any)
    ).toMatchObject({
      change_type: 'remove',
      new_text: null,
      original_text: '__block__Table',
    });
  });

  it('infers replace when one suggestion removes and inserts block elements', () => {
    const suggestion = extractSuggestionContent('discussion-1', [
      tableBlockSuggestion('remove'),
      chartBlockSuggestion('insert'),
    ] as any);

    expect(suggestion).toMatchObject({
      newText: '__block__Chart',
      text: '__block__Table',
      type: 'replace',
    });
  });

  it('extracts inserted line-break suggestions as the compatible block marker', () => {
    const suggestion = extractSuggestionContent('discussion-1', [
      lineBreakSuggestion('insert'),
    ] as any);

    expect(suggestion).toMatchObject({
      newText: '__block__',
      text: '',
      type: 'insert',
    });
  });

  it('extracts removed line-break suggestions as the compatible block marker', () => {
    const suggestion = extractSuggestionContent('discussion-1', [
      lineBreakSuggestion('remove'),
    ] as any);

    expect(suggestion).toMatchObject({
      newText: '',
      text: '__block__',
      type: 'remove',
    });
  });

  it('infers replace when one suggestion removes and inserts line breaks', () => {
    const suggestion = extractSuggestionContent('discussion-1', [
      lineBreakSuggestion('remove'),
      lineBreakSuggestion('insert'),
    ] as any);

    expect(suggestion).toMatchObject({
      newText: '__block__',
      text: '__block__',
      type: 'replace',
    });
  });

  it('splits pure line-break markers into a readable preview label', () => {
    expect(splitSuggestionPreviewText('__block__', 'line breaks')).toEqual(['line breaks']);
    expect(splitSuggestionPreviewText('__block__Chart__block__', 'line breaks')).toEqual([
      'line breaks',
      'Chart',
      'line breaks',
    ]);
  });
});
