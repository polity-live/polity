import { describe, expect, it } from 'vitest';
import { applySuggestionToContent } from '@/features/change-requests/logic/applySuggestionToContent';
import { amendmentActionSchema, type AmendmentAction } from '../contracts';
import {
  applyTextActions,
  suggestTextChanges,
  textReferences,
  type TextAnchor,
  type TextNode,
} from '../text-actions';

const paragraph = (text: string, id = text): TextNode => ({
  id,
  type: 'p',
  children: [{ text }],
});
const append = (blocks: unknown[]): AmendmentAction =>
  amendmentActionSchema.parse({ type: 'blocks.append', blocks });

describe('amendment text action snapshots', () => {
  it('indexes nested inline leaves and empty blocks without mutating the document', () => {
    const content: TextNode[] = [
      {
        id: 'heading',
        type: 'h1',
        children: [{ text: 'One ' }, { type: 'a', children: [{ text: 'link' }] }],
      },
      { id: 'empty', type: 'p' },
      paragraph('Last'),
    ];
    const original = structuredClone(content);
    expect(textReferences(content)).toEqual({
      references: {
        blocks: { block_0: 0, block_1: 1, block_2: 2 },
        anchors: {
          text_0_0: { path: [0, 0], start: 0, end: 4 },
          text_0_1_0: { path: [0, 1, 0], start: 0, end: 4 },
          text_2_0: { path: [2, 0], start: 0, end: 4 },
        },
      },
      blocks: [
        {
          ref: 'block_0',
          text: 'One link',
          anchors: [
            { ref: 'text_0_0', text: 'One ' },
            { ref: 'text_0_1_0', text: 'link' },
          ],
        },
        { ref: 'block_1', text: '', anchors: [] },
        { ref: 'block_2', text: 'Last', anchors: [{ ref: 'text_2_0', text: 'Last' }] },
      ],
      selectionAnchors: [],
    });
    expect(content).toEqual(original);
  });

  it.each([false, true])(
    'normalizes a reversed=%s selection across nested leaves and blocks',
    reversed => {
      const content = [
        paragraph('Before'),
        { type: 'p', children: [{ text: 'Alpha' }, { type: 'a', children: [{ text: 'Beta' }] }] },
        paragraph('Gamma'),
        paragraph('After'),
      ];
      const start = { path: [1, 0], offset: 2 };
      const end = { path: [2, 0], offset: 3 };
      const result = textReferences(content, {
        anchor: reversed ? end : start,
        focus: reversed ? start : end,
      });
      expect(result.selectionAnchors).toEqual([
        { ref: 'selection_0', text: 'pha' },
        { ref: 'selection_1', text: 'Beta' },
        { ref: 'selection_2', text: 'Gam' },
      ]);
      expect(result.references.anchors.selection_1).toEqual({ path: [1, 1, 0], start: 0, end: 4 });
    }
  );

  it('retains a collapsed insertion anchor, compares parent paths and omits boundary-only selections', () => {
    const content = [paragraph('abc'), paragraph('def')];
    const caret = { path: [0, 0], offset: 2 };
    expect(textReferences(content, { anchor: caret, focus: caret }).selectionAnchors).toEqual([
      { ref: 'selection_0', text: '' },
    ]);
    expect(
      textReferences(content, {
        anchor: { path: [0, 0], offset: 3 },
        focus: { path: [1, 0], offset: 0 },
      }).selectionAnchors
    ).toEqual([]);
    expect(
      textReferences(content, {
        anchor: { path: [0], offset: 0 },
        focus: { path: [0, 0], offset: 2 },
      }).selectionAnchors
    ).toEqual([{ ref: 'selection_0', text: 'ab' }]);
    expect(
      textReferences(content, {
        anchor: { path: [0, 0], offset: 1 },
        focus: { path: [1], offset: 0 },
      }).selectionAnchors
    ).toEqual([{ ref: 'selection_0', text: 'bc' }]);
  });

  it.each([
    [-1, 2],
    [1, 4],
  ])('rejects a selected leaf range %i..%i outside its text', (start, end) => {
    expect(() =>
      textReferences([paragraph('abc')], {
        anchor: { path: [0, 0], offset: start },
        focus: { path: [0, 0], offset: end },
      })
    ).toThrow('invalid_selection');
  });

  it('encodes every rich block, inline marks and safe links with fresh identities', () => {
    let sequence = 0;
    const blocks = [
      {
        kind: 'paragraph',
        content: [
          { text: 'Plain', marks: { bold: true } },
          { text: 'Linked', href: '/amendment/example', marks: { italic: true } },
        ],
      },
      ...([1, 2, 3] as const).map(level => ({
        kind: 'heading',
        level,
        content: [{ text: `Heading ${level}` }],
      })),
      { kind: 'quote', content: [{ text: 'Quote' }] },
      { kind: 'list', ordered: false, items: [[{ text: 'Bullet' }]] },
      { kind: 'list', ordered: true, items: [[{ text: 'First' }], [{ text: 'Second' }]] },
      {
        kind: 'table',
        rows: [[[{ text: 'Cell', href: 'https://example.com' }], [{ text: 'Other' }]]],
      },
    ];
    const result = applyTextActions(
      [],
      [append(blocks)],
      { blocks: {}, anchors: {} },
      () => `new-${++sequence}`
    );
    expect(result.value.map(node => node.type)).toEqual([
      'p',
      'h1',
      'h2',
      'h3',
      'blockquote',
      'p',
      'p',
      'p',
      'table',
    ]);
    expect(result.value.map(node => node.id)).toEqual(
      Array.from({ length: 9 }, (_, index) => `new-${index + 1}`)
    );
    expect(result.value[0].children).toEqual([
      { text: 'Plain', bold: true },
      { type: 'a', url: '/amendment/example', children: [{ text: 'Linked', italic: true }] },
    ]);
    expect(result.value[5]).toMatchObject({ indent: 1, listStyleType: 'disc' });
    expect(result.value[5]).not.toHaveProperty('listStart');
    expect(result.value[6]).toMatchObject({ indent: 1, listStyleType: 'decimal', listStart: 1 });
    expect(result.value[7]).toMatchObject({ listStart: 2 });
    expect(result.value[8].children).toEqual([
      {
        type: 'tr',
        children: [
          {
            type: 'td',
            children: [
              {
                type: 'p',
                children: [{ type: 'a', url: 'https://example.com', children: [{ text: 'Cell' }] }],
              },
            ],
          },
          { type: 'td', children: [{ type: 'p', children: [{ text: 'Other' }] }] },
        ],
      },
    ]);
    expect(result.metadata).toEqual({});
  });

  it.each(['before', 'after'] as const)(
    'inserts %s a snapshot block while retaining later references',
    position => {
      const content = [paragraph('A'), paragraph('B')];
      const result = applyTextActions(
        content,
        [
          {
            type: 'blocks.insert',
            anchorBlockRef: 'block_0',
            position,
            blocks: [{ kind: 'paragraph', content: [{ text: 'Inserted' }] }],
          },
          { type: 'text.replace', anchorRef: 'text_1_0', text: 'Updated' },
          { type: 'metadata.patch', patch: { title: 'Title', reason: null } },
          { type: 'metadata.patch', patch: { title: 'Later', hashtags: ['policy'] } },
        ],
        textReferences(content).references,
        () => 'inserted'
      );
      expect(result.value.map(node => node.children?.[0].text)).toEqual(
        position === 'before' ? ['Inserted', 'A', 'Updated'] : ['A', 'Inserted', 'Updated']
      );
      expect(result.metadata).toEqual({ title: 'Later', reason: null, hashtags: ['policy'] });
      expect(content).toEqual([paragraph('A'), paragraph('B')]);
    }
  );

  it.each(['blocks.remove', 'blocks.replace'] as const)(
    'applies %s to contiguous snapshot blocks after earlier insertion',
    type => {
      const content = ['A', 'B', 'C', 'D'].map(text => paragraph(text));
      const replacement: AmendmentAction =
        type === 'blocks.remove'
          ? { type, blockRefs: ['block_1', 'block_2'] }
          : {
              type,
              blockRefs: ['block_1', 'block_2'],
              blocks: [{ kind: 'quote', content: [{ text: 'Replacement' }] }],
            };
      const result = applyTextActions(
        content,
        [
          {
            type: 'blocks.insert',
            anchorBlockRef: 'block_0',
            position: 'before',
            blocks: [{ kind: 'paragraph', content: [{ text: 'New' }] }],
          },
          replacement,
        ],
        textReferences(content).references
      );
      expect(result.value.map(node => node.children?.[0].text)).toEqual(
        type === 'blocks.remove' ? ['New', 'A', 'D'] : ['New', 'A', 'Replacement', 'D']
      );
      expect(content.map(node => node.id)).toEqual(['A', 'B', 'C', 'D']);
    }
  );

  it.each([
    ['block_0', 'block_0'],
    ['block_0', 'block_2'],
    ['block_1', 'block_0'],
  ])('rejects duplicate, separated or reversed block ranges %s', (...blockRefs) => {
    const content = ['A', 'B', 'C'].map(text => paragraph(text));
    expect(() =>
      applyTextActions(
        content,
        [{ type: 'blocks.remove', blockRefs }],
        textReferences(content).references
      )
    ).toThrow('noncontiguous_blocks');
    expect(content).toHaveLength(3);
  });

  it('recreates an empty paragraph after removing the whole document and generates a default UUID', () => {
    const content = [paragraph('A')];
    const result = applyTextActions(
      content,
      [{ type: 'blocks.remove', blockRefs: ['block_0'] }],
      textReferences(content).references
    );
    expect(result.value).toEqual([
      { id: expect.stringMatching(/^[0-9a-f-]{36}$/), type: 'p', children: [{ text: '' }] },
    ]);
    expect(
      applyTextActions([], [], { blocks: {}, anchors: {} }, () => 'fallback').value[0].id
    ).toBe('fallback');
  });

  it.each(['text.replace', 'text.format'] as const)(
    'splits a selected link leaf for %s while preserving outside marks',
    type => {
      const content = [
        {
          type: 'p',
          children: [{ type: 'a', url: '/target', children: [{ text: 'abcdef', italic: true }] }],
        },
      ];
      const reference = textReferences(content, {
        anchor: { path: [0, 0, 0], offset: 2 },
        focus: { path: [0, 0, 0], offset: 4 },
      }).references;
      const action: AmendmentAction =
        type === 'text.replace'
          ? { type, anchorRef: 'selection_0', text: 'NEW' }
          : { type, anchorRef: 'selection_0', marks: { bold: true, italic: false } };
      const result = applyTextActions(content, [action], reference);
      expect(result.value[0].children?.[0]).toEqual({
        type: 'a',
        url: '/target',
        children: [
          { text: 'ab', italic: true },
          type === 'text.replace'
            ? { text: 'NEW', italic: true }
            : { text: 'cd', italic: false, bold: true },
          { text: 'ef', italic: true },
        ],
      });
      expect(content[0].children[0].children[0].text).toBe('abcdef');
    }
  );

  it('formats a whole leaf without adding empty outside fragments', () => {
    const content = [paragraph('Text')];
    const result = applyTextActions(
      content,
      [{ type: 'text.format', anchorRef: 'text_0_0', marks: { underline: true } }],
      textReferences(content).references
    );
    expect(result.value[0].children).toEqual([{ text: 'Text', underline: true }]);
  });

  it.each(['comment_thread', 'suggestion_insert'])(
    'protects nested %s annotations and reports recovery',
    annotation => {
      const content = [
        {
          type: 'p',
          children: [{ type: 'a', children: [{ text: 'Protected', [annotation]: 'discussion' }] }],
        },
      ];
      expect(() =>
        applyTextActions(
          content,
          [{ type: 'text.replace', anchorRef: 'text_0_0_0', text: 'Changed' }],
          textReferences(content).references
        )
      ).toThrowError(
        expect.objectContaining({ code: 'protected_annotation', recovery: 'ask_user' })
      );
      expect(() => suggestTextChanges(content, [paragraph('Changed')], 'discussion')).toThrow(
        'existing comment or suggestion'
      );
      expect(content[0].children[0].children[0].text).toBe('Protected');
    }
  );

  it.each([
    'missing block',
    'removed block',
    'missing anchor',
    'removed anchor root',
    'twice touched anchor',
  ])('rejects %s without changing the input snapshot', scenario => {
    const content = [paragraph('Text')];
    const references = textReferences(content).references;
    const change: AmendmentAction = {
      type: 'text.replace',
      anchorRef: 'text_0_0',
      text: 'Changed',
    };
    const remove: AmendmentAction = { type: 'blocks.remove', blockRefs: ['block_0'] };
    const cases: Record<string, AmendmentAction[]> = {
      'missing block': [{ type: 'blocks.remove', blockRefs: ['unknown'] }],
      'removed block': [remove, remove],
      'missing anchor': [{ ...change, anchorRef: 'unknown' }],
      'removed anchor root': [remove, change],
      'twice touched anchor': [change, change],
    };
    expect(() => applyTextActions(content, cases[scenario], references)).toThrow(
      'invalid_reference'
    );
    expect(content).toEqual([paragraph('Text')]);
  });

  it.each([
    { path: [9, 0], start: 0, end: 1 },
    { path: [0, 9, 0], start: 0, end: 1 },
    { path: [0, 0, 9, 0], start: 0, end: 1 },
    { path: [0, 9], start: 0, end: 1 },
    { path: [0, 0], start: -1, end: 1 },
    { path: [0, 0], start: 2, end: 1 },
    { path: [0, 0], start: 0, end: 10 },
  ] satisfies TextAnchor[])('rejects stale or invalid anchor data %j', anchor => {
    const content = [paragraph('Text')];
    expect(() =>
      applyTextActions(content, [{ type: 'text.replace', anchorRef: 'stale', text: 'New' }], {
        blocks: {},
        anchors: { stale: anchor },
      })
    ).toThrow('invalid_reference');
  });

  it('rejects an anchor pointing at a nontext node', () => {
    const content = [{ type: 'p', children: [{ type: 'a', children: [{ text: 'Nested' }] }] }];
    expect(() =>
      applyTextActions(
        content,
        [{ type: 'text.format', anchorRef: 'wrong', marks: { bold: true } }],
        { blocks: {}, anchors: { wrong: { path: [0, 0], start: 0, end: 1 } } }
      )
    ).toThrow('invalid_reference');
  });

  it.each([
    'replace middle',
    'append',
    'remove',
    'identical',
    'empty',
    'replace first',
    'replace last',
  ])('creates resolvable suggestions for %s while retaining unchanged block identity', scenario => {
    const before = ['A', 'B', 'C'].map(text => paragraph(text));
    const cases: Record<string, TextNode[]> = {
      'replace middle': [before[0], paragraph('NEW'), before[2]],
      append: [...before, paragraph('D')],
      remove: [before[0], before[2]],
      identical: before,
      empty: [],
      'replace first': [paragraph('NEW'), before[1], before[2]],
      'replace last': [before[0], before[1], paragraph('NEW')],
    };
    const after = cases[scenario];
    const suggested = suggestTextChanges(before, after, 'proposal');
    expect(applySuggestionToContent(suggested as never, 'proposal', 'accept')).toEqual(after);
    expect(applySuggestionToContent(suggested as never, 'proposal', 'reject')).toEqual(before);
    if (scenario === 'replace middle') {
      expect(suggested[0]).toBe(before[0]);
      expect(suggested.at(-1)).toBe(before[2]);
      expect(suggested[1]).toMatchObject({ suggestion: { id: 'proposal', type: 'remove' } });
      expect(suggested[2]).toMatchObject({ suggestion: { id: 'proposal', type: 'insert' } });
    }
    expect(before.every(node => !node.suggestion)).toBe(true);
  });

  it('builds a native insertion suggestion for an initially empty document', () => {
    const after = [paragraph('New')];
    expect(suggestTextChanges([], after, 'discussion')).toEqual([
      { ...after[0], suggestion: { id: 'discussion', type: 'insert' } },
    ]);
  });
});
