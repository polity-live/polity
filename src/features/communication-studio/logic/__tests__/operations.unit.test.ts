import { describe, it, expect } from 'vitest';
import { createDocument } from '../templates';
import { element, documentSchema } from '../document';
import {
  diffStudio,
  mergeStudio,
  inverseChanges,
  studioOperationSchema,
  stableJson,
} from '../operations';
import { applyStudioCommand, studioCommandSchemas } from '../commands';
import { formatNativeText } from '../canvas-text';
import { legacyDocumentToV3 } from '../v3-adapter';
import { mergeStudioV3 } from '../operations';
describe('Studio Zero operations', () => {
  it('merges independent properties without losing either author', () => {
    const base = createDocument('single', 'Test'),
      a = structuredClone(base),
      b = structuredClone(base);
    a.pages[0].elements[0].x = 10;
    b.pages[0].elements[0].fill = '#AABBCC';
    const next = mergeStudio(a, diffStudio(base, b));
    expect(next.conflicts).toEqual([]);
    expect(next.value.pages[0].elements[0]).toMatchObject({ x: 10, fill: '#AABBCC' });
  });
  it('reports the original, local and remote values for an overlapping edit', () => {
    const base = createDocument('single', 'Base'),
      a = { ...base, title: 'Alice' },
      b = { ...base, title: 'Bob' };
    expect(mergeStudio(a, diffStudio(base, b))).toMatchObject({
      value: a,
      conflicts: [{ path: ['title'], base: 'Base', local: 'Bob', remote: 'Alice' }],
    });
  });
  it('does not resurrect deleted elements and refuses deleting a modified element', () => {
    const base = createDocument('single', 'Test'),
      a = structuredClone(base),
      b = structuredClone(base);
    a.pages[0].elements.splice(0, 1);
    b.pages[0].elements[0].x = 30;
    expect(mergeStudio(a, diffStudio(base, b)).conflicts.length).toBeGreaterThan(0);
    expect(mergeStudio(b, diffStudio(base, a)).conflicts.length).toBeGreaterThan(0);
  });
  it('keeps remote fields when undoing an independent local edit', () => {
    const base = createDocument('single', 'Test'),
      local = structuredClone(base);
    local.title = 'Local';
    const remote = structuredClone(local);
    remote.pages[0].background = '#AABBCC';
    const undone = mergeStudio(remote, inverseChanges(diffStudio(base, local)));
    expect(undone.conflicts).toEqual([]);
    expect(undone.value.title).toBe('Test');
    expect(undone.value.pages[0].background).toBe('#AABBCC');
  });
  it('rejects prototype paths', () => {
    expect(
      studioOperationSchema.safeParse({
        projectId: crypto.randomUUID(),
        operationId: crypto.randomUUID(),
        changes: [
          { path: ['__proto__'], before: { exists: false }, after: { exists: true, value: {} } },
        ],
      }).success
    ).toBe(false);
  });
  it.each(['bold', 'italic', 'underline'] as const)(
    'saves native %s formatting as a JSON operation and restores it with undo',
    style => {
      const source = createDocument('whiteboard', 'Text formatting');
      source.pages[0].canvas = {
        version: 1,
        elements: [
          {
            id: 'native-text',
            type: 'text',
            x: 50,
            y: 50,
            width: 200,
            height: 40,
            angle: 0,
            isDeleted: false,
            text: 'Hello',
            strokeColor: '#12362D',
            fontSize: 24,
          },
        ],
        files: {},
      };
      const before = legacyDocumentToV3(source);
      const formatted = formatNativeText(source.pages[0], 'native-text', style);
      const after = legacyDocumentToV3({ ...source, pages: [formatted.page] }, before);
      const changes = diffStudio(before, after);
      expect(
        studioOperationSchema.safeParse({
          projectId: crypto.randomUUID(),
          operationId: crypto.randomUUID(),
          changes,
        }).success
      ).toBe(true);
      const applied = mergeStudioV3(before, changes);
      expect(applied.conflicts).toEqual([]);
      const text = applied.value.nodes.find(node => node.type === 'richText');
      expect(text?.type === 'richText' && text.content[0].children[0]).toMatchObject({
        [style]: true,
      });
      const undone = mergeStudioV3(applied.value, inverseChanges(changes));
      expect(undone.conflicts).toEqual([]);
      const ordered = (document: typeof before) =>
        stableJson({
          ...document,
          nodes: [...document.nodes].sort((a, b) => a.id.localeCompare(b.id)),
        });
      expect(ordered(undone.value)).toBe(ordered(before));
    }
  );
  it('drops undefined object properties but rejects undefined array values', () => {
    expect(diffStudio(undefined, { nested: { kept: true, missing: undefined } })).toEqual([
      {
        path: [],
        before: { exists: false },
        after: { exists: true, value: { nested: { kept: true } } },
      },
    ]);
    expect(() => diffStudio(undefined, [undefined])).toThrow('undefined array item');
    expect(() => diffStudio(undefined, { items: [undefined] })).toThrow('undefined array item');
  });
  it('validates nested canvas style, roundness and group updates at the common boundary', () => {
    const changes = diffStudio(
      undefined,
      {
        backgroundColor: '#e03131',
        roundness: { type: 3, value: 32, unused: undefined },
        groupIds: ['group-1'],
        customData: { polityOrder: 2, optional: undefined },
      },
      ['nodes', '#shape', 'excalidraw']
    );
    expect(
      studioOperationSchema.safeParse({
        projectId: crypto.randomUUID(),
        operationId: crypto.randomUUID(),
        changes,
      }).success
    ).toBe(true);
    expect(changes[0].after.value).toEqual({
      backgroundColor: '#e03131',
      roundness: { type: 3, value: 32 },
      groupIds: ['group-1'],
      customData: { polityOrder: 2 },
    });
  });
  it('merges separate rich-text paragraphs and table cells', () => {
    const base = createDocument('single', 'Test');
    base.pages[0].elements = [element('table')];
    const a = structuredClone(base),
      b = structuredClone(base);
    a.pages[0].elements[0].table!.rows[0].cells[0].text = 'A';
    b.pages[0].elements[0].table!.rows[0].cells[1].text = 'B';
    const result = mergeStudio(a, diffStudio(base, b));
    expect(result.conflicts).toEqual([]);
    expect(result.value.pages[0].elements[0].table!.rows[0].cells.map(c => c.text)).toEqual([
      'A',
      'B',
    ]);
  });
  it('applies all six alignments against the page', () => {
    for (const direction of ['left', 'center', 'right', 'top', 'middle', 'bottom']) {
      const d = createDocument('single', 'Test');
      d.pages[0].elements = [element('rect', { x: 123, y: 321, width: 100, height: 100 })];
      const result = applyStudioCommand(d, 'studio_align_elements', {
        pageId: d.pages[0].id,
        elementIds: [d.pages[0].elements[0].id],
        direction,
      });
      const e = result.pages[0].elements[0];
      const expected: Record<string, number> = {
        left: 0,
        center: 490,
        right: 980,
        top: 0,
        middle: 625,
        bottom: 1250,
      };
      expect(['left', 'center', 'right'].includes(direction) ? e.x : e.y).toBe(expected[direction]);
    }
  });
  it('distributes bounding boxes evenly and rejects fewer than three elements', () => {
    const d = createDocument('single', 'Test');
    d.pages[0].elements = [0, 150, 500].map(x => element('rect', { x, width: 100 }));
    const args = {
      pageId: d.pages[0].id,
      elementIds: d.pages[0].elements.map(e => e.id),
      axis: 'horizontal',
    };
    expect(
      applyStudioCommand(d, 'studio_distribute_elements', args).pages[0].elements.map(e => e.x)
    ).toEqual([0, 250, 500]);
    expect(() =>
      applyStudioCommand(d, 'studio_distribute_elements', {
        ...args,
        elementIds: args.elementIds.slice(0, 2),
      })
    ).toThrow();
  });
  it('formats text and protects locked resources', () => {
    const d = createDocument('single', 'Test'),
      p = d.pages[0],
      e = p.elements.find(e => e.type === 'text')!;
    const args = { pageId: p.id, elementIds: [e.id], patch: { bold: true, align: 'center' } };
    const next = applyStudioCommand(d, 'studio_format_text', args);
    expect(next.pages[0].elements.find(x => x.id === e.id)).toMatchObject({
      bold: true,
      align: 'center',
    });
    e.locked = true;
    expect(() => applyStudioCommand(d, 'studio_format_text', args)).toThrow('locked');
  });
  it('validates table and chart dimensions', () => {
    const d = createDocument('single', 'Test');
    d.pages[0].elements = [element('table'), element('chart')];
    expect(documentSchema.safeParse(d).success).toBe(true);
    d.pages[0].elements[1].chart!.series[0].values = [];
    expect(documentSchema.safeParse(d).success).toBe(false);
    expect(Object.keys(studioCommandSchemas)).toHaveLength(6);
  });
});
