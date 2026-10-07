import { describe, expect, it } from 'vitest';
import { createDocument } from '@/features/communication-studio/logic/templates';
import { createEmptyCityDesignState } from '@/features/amendments/city-design/state/cityDesignReducer';
import { applySuggestionToContent } from '@/features/change-requests/logic/applySuggestionToContent';
import { applyStudioSchema, applyCitySchema, applyAmendmentSchema } from '../contracts';
import { applyStudioActions } from '../studio-actions';
import { applyCityActions } from '../city-actions';
import {
  applyTextActions,
  textReferences,
  suggestTextChanges,
  type TextNode,
} from '../text-actions';
import { conditionalUndo } from '../conditional-undo';

const snapshotId = '00000000-0000-4000-a000-000000000001';
describe('atomic project action batches', () => {
  it('rejects arbitrary executable properties and empty action batches', () => {
    expect(() => applyStudioSchema.parse({ snapshotId, summary: 'Test', actions: [] })).toThrow();
    expect(() =>
      applyCitySchema.parse({
        snapshotId,
        summary: 'Test',
        actions: [
          {
            type: 'object.add',
            ref: 'x',
            objectType: 'tree',
            geometry: { kind: 'point', point: { x: 0, z: 0 } },
            script: 'evil',
          },
        ],
      })
    ).toThrow();
    expect(() =>
      applyAmendmentSchema.parse({
        snapshotId,
        summary: 'Test',
        actions: [
          {
            type: 'blocks.append',
            blocks: [
              { kind: 'paragraph', content: [{ text: 'click', href: 'javascript:alert(1)' }] },
            ],
          },
        ],
      })
    ).toThrow();
  });
  it('resolves only earlier local references, and rolls back the whole invalid batch', () => {
    const before = createDocument('single', 'Before');
    const copy = structuredClone(before);
    expect(() =>
      applyStudioActions(before, [
        { type: 'project.patch', patch: { title: 'After' } },
        { type: 'page.remove', page: { localRef: 'missing' } },
      ])
    ).toThrow();
    expect(before).toEqual(copy);
    const result = applyStudioActions(before, [
      { type: 'page.add', ref: 'page', name: 'New', format: 'feed', template: 'blank' },
      {
        type: 'element.add',
        ref: 'headline',
        page: { localRef: 'page' },
        elementType: 'text',
        properties: { text: 'Hello' },
      },
      {
        type: 'element.patch',
        page: { localRef: 'page' },
        element: { localRef: 'headline' },
        patch: { text: 'World' },
      },
    ]);
    expect(result.value.pages.find(p => p.id === result.createdRefs.page)?.elements[0].text).toBe(
      'World'
    );
    expect(before).toEqual(copy);
  });
  it('respects locked elements when applying text actions', () => {
    const before = createDocument('single', 'Before');
    const page = before.pages[0],
      element = page.elements.find(e => e.type === 'text')!;
    element.locked = true;
    expect(() =>
      applyStudioActions(before, [
        {
          type: 'element.patch',
          page: { id: page.id },
          element: { id: element.id },
          patch: { text: 'Changed' },
        },
      ])
    ).toThrow();
    element.locked = false;
    const after = applyStudioActions(before, [
      {
        type: 'element.patch',
        page: { id: page.id },
        element: { id: element.id },
        patch: { text: 'Changed' },
      },
    ]).value;
    expect(after.pages[0].elements.find(e => e.id === element.id)?.text).toBe('Changed');
  });
  it('recalculates costs, translates geometry and leaves input untouched', () => {
    const before = createEmptyCityDesignState();
    const parsed = applyCitySchema.parse({
      snapshotId,
      summary: 'Plant tree',
      actions: [
        {
          type: 'object.add',
          ref: 'tree',
          objectType: 'tree',
          geometry: { kind: 'point', point: { x: 2, z: 3 } },
        },
        { type: 'object.translate', object: { localRef: 'tree' }, dxMeters: 5, dzMeters: -1 },
        { type: 'object.set_unit_cost', object: { localRef: 'tree' }, unitCostMinor: 12345 },
      ],
    });
    const result = applyCityActions(before, parsed.actions);
    expect(result.value.objects[0].geometry).toMatchObject({
      kind: 'point',
      point: { x: 7, z: 2 },
    });
    expect(result.costs.totalCostMinor).toBe(12345);
    expect(before.objects).toHaveLength(0);
  });
  it('does not corrupt block references after inserting earlier blocks', () => {
    const before: TextNode[] = [
      { id: 'a', type: 'p', children: [{ text: 'First' }] },
      { id: 'b', type: 'p', children: [{ text: 'Second', bold: true }] },
    ];
    const { references } = textReferences(before);
    const after = applyTextActions(
      before,
      [
        {
          type: 'blocks.insert',
          anchorBlockRef: 'block_0',
          position: 'before',
          blocks: [{ kind: 'paragraph', content: [{ text: 'New' }] }],
        },
        { type: 'text.replace', anchorRef: 'text_1_0', text: 'Changed' },
      ],
      references
    ).value;
    expect(after[2].children?.[0]).toEqual({ text: 'Changed', bold: true });
    expect(before[1].children?.[0].text).toBe('Second');
  });
  it('protects existing annotations and produces native resolvable suggestions', () => {
    const before: TextNode[] = [{ type: 'p', children: [{ text: 'Old' }] }],
      after: TextNode[] = [{ type: 'p', children: [{ text: 'New' }] }];
    const suggestion = suggestTextChanges(before, after, 'proposal');
    expect(applySuggestionToContent(suggestion as never, 'proposal', 'accept')).toEqual(after);
    expect(applySuggestionToContent(suggestion as never, 'proposal', 'reject')).toEqual(before);
    const annotated = [{ type: 'p', children: [{ text: 'Discussed', comment_thread: true }] }];
    expect(() =>
      applyTextActions(
        annotated,
        [{ type: 'blocks.remove', blockRefs: ['block_0'] }],
        textReferences(annotated).references
      )
    ).toThrow();
  });
  it('undo tolerates JSONB key ordering, but refuses concurrent content changes', () => {
    expect(conditionalUndo({ b: 2, a: 1 }, { a: 0, b: 2 }, { a: 1, b: 2 })).toEqual({ a: 0, b: 2 });
    expect(() => conditionalUndo({ a: 3 }, { a: 0 }, { a: 1 })).toThrow('resource has changed');
  });
});
