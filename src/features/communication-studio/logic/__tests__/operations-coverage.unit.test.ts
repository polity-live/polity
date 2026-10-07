import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createDocument } from '../templates';
import { element } from '../document';
import { canvasElementSchema } from '../canvas-schema';
import { defaultBrand } from '../document';
import { createStudioTemplateDocumentV5 } from '../templates-v5';
import {
  diffStudio,
  inverseChanges,
  isStudioValidationError,
  mergeStudio,
  mergeStudioV3,
  stableJson,
} from '../operations';

describe('Studio operation serialization and structural merges', () => {
  it.each(['invalid_union', 'invalid_type', 'invalid_value'])(
    'recognizes serialized %s validation errors',
    code => {
      expect(isStudioValidationError(new Error(JSON.stringify({ code })))).toBe(true);
      expect(isStudioValidationError(JSON.stringify({ code }))).toBe(true);
    }
  );

  it('recognizes Zod errors and rejects unrelated failures', () => {
    const result = z.string().safeParse(3);
    expect(isStudioValidationError(result.error)).toBe(true);
    expect(isStudioValidationError(new Error('network unavailable'))).toBe(false);
    expect(isStudioValidationError(null)).toBe(false);
  });

  it('serializes null and absent values and sorts object keys deterministically', () => {
    expect(stableJson(undefined)).toBe('null');
    expect(stableJson(null)).toBe('null');
    expect(stableJson({ z: [3, false, null], b: undefined, a: 'text' })).toBe(
      '{"a":"text","z":[3,false,null]}'
    );
    expect(diffStudio([1, null], [1, 3])).toEqual([
      {
        path: [],
        before: { exists: true, value: [1, null] },
        after: { exists: true, value: [1, 3] },
      },
    ]);
  });

  it.each([new Date('2026-01-01'), new Map([['name', 'value']]), new Set(['value'])])(
    'rejects non-JSON object %s instead of persisting it as an empty object',
    value => expect(() => diffStudio(undefined, value, ['metadata'])).toThrow('non-JSON object')
  );

  it('accepts null-prototype JSON objects and repeated values without confusing them with cycles', () => {
    const shared = { value: 'kept' };
    const input = Object.assign(Object.create(null), { left: shared, right: shared });
    expect(diffStudio(undefined, input, ['metadata'])[0].after.value).toEqual({
      left: shared,
      right: shared,
    });
  });

  it('rejects a circular current value at the merge boundary', () => {
    const current = createDocument('single', 'Valid');
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    Object.assign(current, { title: circular });
    expect(() => mergeStudio(current, diffStudio('Valid', 'Updated', ['title']))).toThrow(
      'circular value'
    );
  });

  it('records structural order independently from paragraph content', () => {
    const before = [
      { id: 'a', text: 'First' },
      { id: 'b', text: 'Second' },
    ];
    const after = [{ id: 'b', text: 'Changed' }, before[0]];
    expect(diffStudio(before, after, ['paragraphs'])).toEqual([
      {
        path: ['paragraphs', '#b', 'text'],
        before: { exists: true, value: 'Second' },
        after: { exists: true, value: 'Changed' },
      },
      {
        path: ['paragraphs', '@order'],
        before: { exists: true, value: ['a', 'b'] },
        after: { exists: true, value: ['b', 'a'] },
      },
    ]);
    expect(diffStudio(before, after).map(change => change.path)).toContainEqual(['@order']);
  });

  it('applies and undoes table row order while retaining cell contents', () => {
    const base = createDocument('single', 'Table order');
    base.pages[0].elements = [element('table')];
    const changed = structuredClone(base);
    changed.pages[0].elements[0].table!.rows.reverse();
    const changes = diffStudio(base, changed);
    expect(changes.some(change => change.path.at(-1) === '@order')).toBe(true);
    const result = mergeStudio(base, changes);
    expect(result.conflicts).toEqual([]);
    expect(result.value.pages[0].elements[0].table).toEqual(changed.pages[0].elements[0].table);
    expect(mergeStudio(result.value, inverseChanges(changes)).value).toEqual(base);
  });

  it('merges geometry atomically and restores all geometry fields on undo', () => {
    const base = createDocument('single', 'Geometry');
    base.pages[0].elements = [element('rect', { x: 20, y: 30 })];
    const changed = structuredClone(base);
    changed.pages[0].elements[0].x = 80;
    changed.pages[0].elements[0].width = 170;
    const changes = diffStudio(base, changed);
    expect(changes).toHaveLength(1);
    expect(changes[0].path.at(-1)).toBe('@geometry');
    const result = mergeStudio(base, changes);
    expect(result.conflicts).toEqual([]);
    expect(result.value).toEqual(changed);
    expect(mergeStudio(result.value, inverseChanges(changes)).value).toEqual(base);
  });

  it('merges canonical transforms atomically and retains independent theme edits', () => {
    const base = createStudioTemplateDocumentV5('single', 'Transform', defaultBrand);
    const changed = structuredClone(base);
    changed.nodes[0].transform.x += 20;
    changed.nodes[0].transform.flipX = true;
    const remote = structuredClone(base);
    remote.nodes[0].name = 'Remote name';
    const result = mergeStudioV3(remote, diffStudio(base, changed));
    expect(result.conflicts).toEqual([]);
    expect(result.value.nodes.find(node => node.id === base.nodes[0].id)).toMatchObject({
      name: 'Remote name',
      transform: changed.nodes[0].transform,
    });
  });

  it('adds, replaces, removes and repeats deletion of an identified element without duplicates', () => {
    const base = createDocument('single', 'Elements');
    base.pages[0].elements = [];
    const added = structuredClone(base);
    added.pages[0].elements.push(element('rect'));
    const addition = diffStudio(base, added);
    expect(mergeStudio(base, addition).value).toEqual(added);
    expect(mergeStudio(added, addition).value).toEqual(added);
    const removal = inverseChanges(addition);
    expect(mergeStudio(added, removal).value).toEqual(base);
    expect(mergeStudio(base, removal).value).toEqual(base);
  });

  it('removes an optional property and treats a repeated removal as idempotent', () => {
    const base = createDocument('single', 'Property');
    base.pages[0].elements = [element('rect', { table: element('table').table })];
    const changed = structuredClone(base);
    const { table: removed, ...plain } = changed.pages[0].elements[0];
    expect(removed).toBeDefined();
    changed.pages[0].elements[0] = plain;
    const changes = diffStudio(base, changed);
    expect(changes).toHaveLength(1);
    expect(mergeStudio(base, changes).value).toEqual(changed);
    expect(mergeStudio(changed, changes).value).toEqual(changed);
  });

  it('initializes a legacy scene for the first drawing without changing another page', () => {
    const base = createDocument('carousel', 'First drawing');
    const changed = structuredClone(base);
    const shape = canvasElementSchema.parse({
      id: 'scene-shape',
      type: 'rectangle',
      x: 10,
      y: 20,
      width: 30,
      height: 40,
      angle: 0,
      isDeleted: false,
    });
    changed.pages[0].canvas = { version: 1, elements: [shape], files: {} };
    const changes = diffStudio(base, changed);
    expect(changes).toHaveLength(1);
    expect(changes[0].path).toEqual([
      'pages',
      `#${base.pages[0].id}`,
      'canvas',
      'elements',
      '#scene-shape',
    ]);
    const result = mergeStudio(base, changes);
    expect(result.conflicts).toEqual([]);
    expect(result.value.pages[0].canvas).toEqual(changed.pages[0].canvas);
    expect(result.value.pages[1]).toEqual(base.pages[1]);
    expect(base.pages[0].canvas).toBeUndefined();
  });

  it('sorts legacy pages and elements by order with stable identifier tie breaks', () => {
    const base = createDocument('carousel', 'Legacy ordering');
    base.pages = base.pages.slice(0, 2);
    const first = '00000000-0000-4000-8000-000000000001';
    const second = '00000000-0000-4000-8000-000000000002';
    base.pages[0].id = second;
    base.pages[1].id = first;
    base.posts.forEach(post => {
      post.pageIds = base.pages.map(page => page.id);
    });
    base.pages[0].order = base.pages[1].order = 0;
    base.pages[0].elements = [
      element('rect', { id: second, order: 0 }),
      element('rect', { id: first, order: 0 }),
    ];
    const result = mergeStudio(base, diffStudio(base.title, 'Sorted', ['title']));
    expect(result.value.pages.map(page => page.id)).toEqual([first, second]);
    expect(result.value.pages[1].elements.map(node => node.id)).toEqual([first, second]);
  });

  it('sorts canonical nodes and deliverables using identifier tie breaks', () => {
    const base = createStudioTemplateDocumentV5('carousel', 'Canonical ordering', defaultBrand);
    base.deliverables.push({
      ...structuredClone(base.deliverables[0]),
      id: crypto.randomUUID(),
      order: 1,
    });
    base.nodes.forEach(node => {
      node.zIndex = 0;
    });
    base.deliverables.forEach(deliverable => {
      deliverable.order = 0;
    });
    const result = mergeStudioV3(base, diffStudio(base.title, 'Sorted', ['title']));
    expect(result.conflicts).toEqual([]);
    expect(result.value.deliverables.map(item => item.id)).toEqual(
      base.deliverables.map(item => item.id).sort()
    );
    const siblings = result.value.nodes.filter(
      node =>
        node.parentFrameId === base.nodes.find(node => node.type === 'richText')?.parentFrameId
    );
    expect(siblings.map(node => node.id)).toEqual(siblings.map(node => node.id).sort());
  });

  it('sorts canonical deliverables by their explicit campaign order before their identifiers', () => {
    const base = createStudioTemplateDocumentV5('single', 'Campaign order', defaultBrand);
    base.deliverables.push({
      ...structuredClone(base.deliverables[0]),
      id: crypto.randomUUID(),
      order: 1,
    });
    base.deliverables.reverse();
    const result = mergeStudioV3(base, diffStudio(base.title, 'Sorted', ['title']));
    expect(result.value.deliverables.map(item => item.order)).toEqual([0, 1]);
  });

  it('rejects scalar properties inside an array instead of producing non-JSON array metadata', () => {
    const base = createDocument('single', 'Invalid path');
    expect(() =>
      mergeStudio(base, [
        { path: ['pages', 'custom'], before: { exists: false }, after: { exists: true, value: 3 } },
      ])
    ).toThrow('Invalid Studio property path');
  });
});
