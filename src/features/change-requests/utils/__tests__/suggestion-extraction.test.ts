import { describe, expect, it } from 'vitest';
import {
  countChangedCharacters,
  countChangedCharactersForSuggestion,
  createChangeRequestDiffSnapshot,
  extractSuggestionContent,
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
