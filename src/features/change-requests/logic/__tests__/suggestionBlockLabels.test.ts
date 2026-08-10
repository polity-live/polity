import { KEYS } from 'platejs';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

import { DATA_VIEW_NODE_TYPE } from '@/features/charts/types';
import {
  appendSuggestionBlockLabel,
  appendSuggestionLineBreak,
  BLOCK_SUGGESTION_MARKER,
  getSuggestionBlockLabel,
  splitSuggestionPreviewText,
} from '../suggestionBlockLabels';

const prefix = 'features.changeRequests.blockLabels.';

describe('getSuggestionBlockLabel', () => {
  it.each([
    ['chart', 'chart'],
    ['table', 'table'],
    ['stat', 'metric'],
    ['map', 'data'],
    [undefined, 'data'],
  ])('maps data view %j to %s', (view, label) => {
    expect(getSuggestionBlockLabel({ type: DATA_VIEW_NODE_TYPE, view })).toBe(`${prefix}${label}`);
  });

  it.each([
    [KEYS.listTodo, 'todoList'],
    [KEYS.ol, 'numberedList'],
    [KEYS.ul, 'bulletedList'],
    [undefined, 'text'],
  ])('maps paragraph list type %j to %s', (listType, label) => {
    expect(getSuggestionBlockLabel({ type: KEYS.p, [KEYS.listType]: listType })).toBe(
      `${prefix}${label}`
    );
  });

  it.each([
    [KEYS.audio, 'audio'],
    [KEYS.blockquote, 'quote'],
    [KEYS.callout, 'callout'],
    [KEYS.codeBlock, 'code'],
    [KEYS.column, 'column'],
    [KEYS.columnGroup, 'columns'],
    [KEYS.date, 'date'],
    [KEYS.equation, 'equation'],
    [KEYS.file, 'file'],
    [KEYS.h1, 'heading1'],
    [KEYS.h2, 'heading2'],
    [KEYS.h3, 'heading3'],
    [KEYS.h4, 'heading4'],
    [KEYS.h5, 'heading5'],
    [KEYS.h6, 'heading6'],
    [KEYS.hr, 'divider'],
    [KEYS.img, 'image'],
    [KEYS.inlineEquation, 'inlineEquation'],
    [KEYS.link, 'link'],
    [KEYS.mediaEmbed, 'embed'],
    [KEYS.table, 'table'],
    [KEYS.toc, 'tableOfContents'],
    [KEYS.toggle, 'toggle'],
    [KEYS.video, 'video'],
    ['unknown', 'block'],
    [undefined, 'block'],
  ])('maps block type %j to %s', (type, label) => {
    expect(getSuggestionBlockLabel({ type })).toBe(`${prefix}${label}`);
  });
});

describe('suggestion preview markers', () => {
  it('appends labels and line breaks with the canonical marker', () => {
    expect(appendSuggestionBlockLabel('Before', 'Image')).toBe(
      `Before${BLOCK_SUGGESTION_MARKER}Image`
    );
    expect(appendSuggestionLineBreak('Before')).toBe(`Before${BLOCK_SUGGESTION_MARKER}`);
  });

  it('preserves text without markers', () => {
    expect(splitSuggestionPreviewText('Plain text')).toEqual(['Plain text']);
    expect(splitSuggestionPreviewText('')).toEqual(['']);
  });

  it('maps a marker-only value to an optional line-break label', () => {
    expect(splitSuggestionPreviewText(BLOCK_SUGGESTION_MARKER, 'Line break')).toEqual([
      'Line break',
    ]);
    expect(splitSuggestionPreviewText(BLOCK_SUGGESTION_MARKER)).toEqual([]);
  });

  it('splits labels and maps empty segments when a line-break label exists', () => {
    expect(splitSuggestionPreviewText(`A${BLOCK_SUGGESTION_MARKER}B`)).toEqual(['A', 'B']);
    expect(
      splitSuggestionPreviewText(
        `${BLOCK_SUGGESTION_MARKER}A${BLOCK_SUGGESTION_MARKER}`,
        'Line break'
      )
    ).toEqual(['Line break', 'A', 'Line break']);
    expect(
      splitSuggestionPreviewText(`${BLOCK_SUGGESTION_MARKER}${BLOCK_SUGGESTION_MARKER}`)
    ).toEqual([]);
  });
});
