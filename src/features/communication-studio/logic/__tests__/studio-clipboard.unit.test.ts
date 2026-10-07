import { describe, expect, it } from 'vitest';
import { applyStudioCommandV3 } from '../commands-v3';
import { createStudioNodeFromElement } from '../create-studio-node';
import { element } from '../document';
import {
  createFrameNode,
  createStudioDocumentV3,
  shapeNodeSchema,
  deliverableSchema,
} from '../document-v3';
import {
  createStudioV3ClipboardPayload,
  getProjectStudioClipboard,
  parseStudioClipboard,
  pasteStudioV3Clipboard,
  setProjectStudioClipboard,
  stringifyStudioClipboard,
} from '../studio-clipboard';

const projectId = crypto.randomUUID();

describe('Studio project clipboard', () => {
  it('rejects duplicate source node IDs in a parsed external clipboard without changing the document', () => {
    const document = createStudioDocumentV3('Duplicate clipboard');
    const frame = createFrameNode('square');
    document.nodes.push(frame);
    const payload = createStudioV3ClipboardPayload({
      projectId,
      document,
      selectedNodeIds: [frame.id],
    })!;
    const parsed = parseStudioClipboard(
      stringifyStudioClipboard({
        ...payload,
        nodes: [...payload.nodes, structuredClone(frame)],
      })
    )!;
    expect(parsed.nodes).toHaveLength(2);
    const original = structuredClone(document);
    expect(() => pasteStudioV3Clipboard({ document, payload: parsed, projectId })).toThrow();
    expect(document).toEqual(original);
  });
  it('restores multiple copied frames into a missing deliverable in its recorded frame order', () => {
    const document = createStudioDocumentV3('Clipboard');
    const first = createFrameNode('square'),
      second = createFrameNode('square');
    document.nodes.push(first, second);
    document.deliverables.push(
      deliverableSchema.parse({
        id: crypto.randomUUID(),
        code: '01',
        title: 'Sequence',
        kind: 'carousel',
        frameIds: [first.id, second.id],
        order: 0,
        captions: { instagram: 'Caption', linkedin: '', facebook: '' },
      })
    );
    const payload = createStudioV3ClipboardPayload({
      projectId,
      document,
      selectedNodeIds: [first.id, second.id],
    })!;
    const empty = createStudioDocumentV3('After cutting');
    const restored = pasteStudioV3Clipboard({ projectId, document: empty, payload });
    expect(restored.document.deliverables[0]).toMatchObject({
      title: 'Sequence',
      frameIds: restored.selectedNodeIds,
      captions: { instagram: 'Caption' },
    });
    const missing = crypto.randomUUID();
    const stale = {
      ...payload,
      deliverables: payload.deliverables.map(membership => ({
        ...membership,
        framePositions: [{ frameId: missing, index: 0 }],
      })),
    };
    expect(parseStudioClipboard(stringifyStudioClipboard(stale))).toEqual(stale);
    expect(
      pasteStudioV3Clipboard({ projectId, document: empty, payload: stale }).document.deliverables
    ).toHaveLength(0);
  });
  it('returns no clipboard for empty or disappeared selection and ignores missing IDs in an otherwise valid selection', () => {
    const document = createStudioDocumentV3('Clipboard');
    expect(createStudioV3ClipboardPayload({ projectId, document, selectedNodeIds: [] })).toBeNull();
    expect(
      createStudioV3ClipboardPayload({
        projectId,
        document,
        selectedNodeIds: [crypto.randomUUID()],
      })
    ).toBeNull();
    const shape = shapeNodeSchema.parse({
      ...createFrameNode('custom'),
      type: 'shape',
      shape: 'rectangle',
    });
    document.nodes.push(shape);
    expect(
      createStudioV3ClipboardPayload({
        projectId,
        document,
        selectedNodeIds: [crypto.randomUUID(), shape.id],
      })?.rootNodeIds
    ).toEqual([shape.id]);
  });
  it('rejects a cyclic non-frame selection rather than producing a clipboard without root nodes', () => {
    const document = createStudioDocumentV3('Invalid selection');
    const first = shapeNodeSchema.parse({
      ...createFrameNode('custom'),
      type: 'shape',
      shape: 'rectangle',
    });
    const second = createStudioNodeFromElement(element('rect'), first.id, 1);
    first.parentFrameId = second.id;
    document.nodes.push(first, second);
    expect(
      createStudioV3ClipboardPayload({
        projectId,
        document,
        selectedNodeIds: [first.id, second.id],
      })
    ).toBeNull();
  });
  it.each(['text', 'table', 'chart', 'image'] as const)(
    'copies %s data with fresh nested IDs while retaining media identity and never mutating the source',
    kind => {
      const document = createStudioDocumentV3('Clipboard');
      const frame = createFrameNode('square');
      document.nodes.push(frame);
      const node = createStudioNodeFromElement(
        element(kind, kind === 'image' ? { assetId: crypto.randomUUID() } : {}),
        frame.id,
        0
      );
      if (node.type === 'richText')
        node.content[0].children[0] = {
          id: crypto.randomUUID(),
          text: 'Styled',
          bold: true,
          data: { flag: null, count: 7 },
        };
      node.locked = true;
      document.nodes.push(node);
      const original = structuredClone(document);
      const payload = createStudioV3ClipboardPayload({
        projectId,
        document,
        selectedNodeIds: [node.id],
      })!;
      const result = pasteStudioV3Clipboard({ projectId, document, payload });
      const copy = result.document.nodes.find(
        candidate => candidate.id === result.selectedNodeIds[0]
      )!;
      expect(copy.id).not.toBe(node.id);
      expect(copy.locked).toBe(false);
      expect(copy.transform).toMatchObject({ x: node.transform.x + 24, y: node.transform.y + 24 });
      if (copy.type === 'richText' && node.type === 'richText') {
        expect(copy.content[0].id).not.toBe(node.content[0].id);
        expect(copy.content[0].children[0]).toMatchObject({
          text: 'Styled',
          bold: true,
          data: { flag: null, count: 7 },
        });
      }
      if (copy.type === 'table' && node.type === 'table') {
        expect(copy.data.rows[0].id).not.toBe(node.data.rows[0].id);
        expect(copy.data.rows[0].cells[0].id).not.toBe(node.data.rows[0].cells[0].id);
      }
      if (copy.type === 'chart' && node.type === 'chart') {
        expect(copy.data.series[0].id).not.toBe(node.data.series[0].id);
        expect(copy.data.series[0].values).toEqual(node.data.series[0].values);
      }
      if (copy.type === 'media' && node.type === 'media') expect(copy.assetId).toBe(node.assetId);
      expect(document).toEqual(original);
    }
  );
  it('remaps both arrow bindings to copied nodes and clears links to objects outside the clipboard', () => {
    const document = createStudioDocumentV3('Clipboard');
    const box = shapeNodeSchema.parse({
      ...createFrameNode('custom'),
      type: 'shape',
      shape: 'rectangle',
    });
    const internal = shapeNodeSchema.parse({
      ...box,
      id: crypto.randomUUID(),
      shape: 'arrow',
      startBindingId: box.id,
      endBindingId: box.id,
    });
    const external = shapeNodeSchema.parse({
      ...box,
      id: crypto.randomUUID(),
      shape: 'arrow',
      startBindingId: crypto.randomUUID(),
      endBindingId: crypto.randomUUID(),
    });
    document.nodes.push(box, internal, external);
    const payload = createStudioV3ClipboardPayload({
      projectId,
      document,
      selectedNodeIds: [box.id, internal.id, external.id],
    })!;
    const result = pasteStudioV3Clipboard({ projectId, document, payload });
    const copied = result.selectedNodeIds.map(id =>
      result.document.nodes.find(node => node.id === id)
    );
    expect(copied[1]).toMatchObject({ startBindingId: copied[0]?.id, endBindingId: copied[0]?.id });
    expect(copied[2]).toMatchObject({ startBindingId: null, endBindingId: null });
  });
  it('preserves mixed source parents instead of assigning the entire selection to a different target frame', () => {
    const document = createStudioDocumentV3('Clipboard');
    const first = createFrameNode('square'),
      second = createFrameNode('square'),
      target = createFrameNode('square');
    const shape = createStudioNodeFromElement(element('rect'), first.id, 0);
    const other = createStudioNodeFromElement(element('rect'), second.id, 0);
    document.nodes.push(first, second, target, shape, other);
    const payload = createStudioV3ClipboardPayload({
      projectId,
      document,
      selectedNodeIds: [shape.id, other.id],
    })!;
    const result = pasteStudioV3Clipboard({
      projectId,
      document,
      payload,
      targetFrameId: target.id,
    });
    expect(
      result.selectedNodeIds.map(
        id => result.document.nodes.find(node => node.id === id)?.parentFrameId
      )
    ).toEqual([first.id, second.id]);
  });
  it('handles unknown payload root IDs and delivery frame IDs without creating dangling selected IDs', () => {
    const document = createStudioDocumentV3('Clipboard');
    const frame = createFrameNode('square');
    document.nodes.push(frame);
    const payload = createStudioV3ClipboardPayload({
      projectId,
      document,
      selectedNodeIds: [frame.id],
    })!;
    const missing = crypto.randomUUID();
    expect(() =>
      pasteStudioV3Clipboard({
        projectId,
        document,
        payload: { ...payload, rootNodeIds: [missing] },
      })
    ).toThrow('no root nodes');
    const result = pasteStudioV3Clipboard({
      projectId,
      document,
      payload: { ...payload, rootNodeIds: [frame.id, missing] },
    });
    expect(result.selectedNodeIds).toHaveLength(1);
  });
  it.each(['invalid-json', 'wrong-type', 'invalid-schema', 'null'])(
    'rejects clipboard text %s without throwing',
    kind => {
      const value =
        kind === 'invalid-json'
          ? '{broken'
          : kind === 'null'
            ? 'null'
            : JSON.stringify({
                type: kind === 'wrong-type' ? 'other-app' : 'polity/studio-clipboard',
                version: 2,
              });
      expect(parseStudioClipboard(value)).toBeNull();
    }
  );
  it('keeps project clipboard reads isolated from caller mutations and returns null for another project', () => {
    expect(getProjectStudioClipboard(crypto.randomUUID())).toBeNull();
    const document = createStudioDocumentV3('Clipboard');
    const frame = createFrameNode('square');
    document.nodes.push(frame);
    const payload = createStudioV3ClipboardPayload({
      projectId,
      document,
      selectedNodeIds: [frame.id],
    })!;
    setProjectStudioClipboard(payload);
    const read = getProjectStudioClipboard(projectId)!;
    read.nodes[0].name = 'Changed copy';
    expect(getProjectStudioClipboard(projectId)?.nodes[0].name).toBe(frame.name);
  });
  it('copies a complete V3 frame hierarchy and inserts the new frame beside its source', () => {
    const document = createStudioDocumentV3('Clipboard hierarchy');
    const root = createFrameNode('square', {
      name: 'Root frame',
      transform: { x: 100, y: 200, width: 1080, height: 1080, rotation: 0 },
    });
    const child = createFrameNode('custom', {
      name: 'Nested frame',
      parentFrameId: root.id,
      transform: { x: 40, y: 60, width: 320, height: 240, rotation: 0 },
      groupIds: [crypto.randomUUID()],
    });
    const sharedGroupId = crypto.randomUUID();
    const boxId = crypto.randomUUID();
    const arrowId = crypto.randomUUID();
    const box = shapeNodeSchema.parse({
      ...createFrameNode('custom'),
      id: boxId,
      type: 'shape',
      name: 'Bound box',
      parentFrameId: root.id,
      groupIds: [sharedGroupId],
      shape: 'rectangle',
    });
    const arrow = shapeNodeSchema.parse({
      ...createFrameNode('custom'),
      id: arrowId,
      type: 'shape',
      name: 'Bound arrow',
      parentFrameId: root.id,
      groupIds: [sharedGroupId],
      shape: 'arrow',
      startBindingId: boxId,
    });
    document.nodes.push(root, child, box, arrow);
    const deliverableId = crypto.randomUUID();
    document.deliverables.push({
      id: deliverableId,
      code: '01',
      title: 'Post',
      kind: 'single',
      frameIds: [root.id],
      channel: 'instagram',
      order: 0,
      status: 'draft',
      dayOffset: 0,
      scheduledAt: null,
      assignee: '',
      brief: '',
      captions: { instagram: '', linkedin: '', facebook: '' },
    });

    const payload = createStudioV3ClipboardPayload({
      projectId,
      selectedNodeIds: [root.id, child.id],
      document,
    });
    expect(payload).not.toBeNull();
    expect(payload?.version).toBe(2);
    expect(payload?.rootNodeIds).toEqual([root.id]);
    expect(parseStudioClipboard(stringifyStudioClipboard(payload!))).toEqual(payload);
    setProjectStudioClipboard(payload!);
    expect(getProjectStudioClipboard(projectId)).toEqual(payload);

    const pasted = pasteStudioV3Clipboard({ document, payload: payload!, projectId });
    const rootCopy = pasted.document.nodes.find(node => node.id === pasted.selectedNodeIds[0]);
    const childCopy = pasted.document.nodes.find(node => node.parentFrameId === rootCopy?.id);
    expect(rootCopy).toMatchObject({
      type: 'frame',
      parentFrameId: null,
      transform: { x: 124, y: 224 },
      locked: false,
    });
    expect(childCopy).toMatchObject({
      type: 'frame',
      transform: { x: 40, y: 60 },
      locked: false,
    });
    expect(childCopy?.id).not.toBe(child.id);
    expect(childCopy?.groupIds[0]).not.toBe(child.groupIds[0]);
    const boxCopy = pasted.document.nodes.find(
      node => node.name === box.name && node.id !== box.id
    );
    const arrowCopy = pasted.document.nodes.find(
      node => node.name === arrow.name && node.id !== arrow.id
    );
    expect(boxCopy?.groupIds).toEqual(arrowCopy?.groupIds);
    expect(boxCopy?.groupIds[0]).not.toBe(sharedGroupId);
    expect(arrowCopy).toMatchObject({ startBindingId: boxCopy?.id });
    expect(boxCopy).not.toHaveProperty('excalidraw');
    expect(arrowCopy).not.toHaveProperty('excalidraw');
    expect(pasted.document.deliverables.find(item => item.id === deliverableId)?.frameIds).toEqual([
      root.id,
      rootCopy?.id,
    ]);
  });

  it('restores deliverable metadata after cutting its only frame and targets another frame', () => {
    const document = createStudioDocumentV3('Cut and paste');
    const source = createFrameNode('square', { name: 'Source' });
    const nested = createFrameNode('custom', {
      name: 'Nested content',
      parentFrameId: source.id,
      transform: { x: 10, y: 20, width: 100, height: 80, rotation: 0 },
    });
    const target = createFrameNode('square', {
      name: 'Target',
      transform: { x: 1400, y: 0, width: 1080, height: 1080, rotation: 0 },
    });
    document.nodes.push(source, nested, target);
    const deliverable = {
      id: crypto.randomUUID(),
      code: '07',
      title: 'Scheduled post',
      kind: 'single' as const,
      frameIds: [source.id],
      channel: 'instagram' as const,
      order: 0,
      status: 'ready' as const,
      dayOffset: 3,
      scheduledAt: null,
      assignee: 'Ada',
      brief: 'Keep this metadata',
      captions: { instagram: 'Caption', linkedin: '', facebook: '' },
    };
    document.deliverables.push(deliverable);
    const nestedPayload = createStudioV3ClipboardPayload({
      projectId,
      selectedNodeIds: [nested.id],
      document,
    });
    if (!nestedPayload) throw new Error('Missing nested clipboard fixture');
    const targeted = pasteStudioV3Clipboard({
      document,
      payload: nestedPayload,
      projectId,
      targetFrameId: target.id,
    });
    expect(
      targeted.document.nodes.find(node => node.id === targeted.selectedNodeIds[0])
    ).toMatchObject({
      parentFrameId: target.id,
      transform: { x: 34, y: 44 },
    });
    const payload = createStudioV3ClipboardPayload({
      projectId,
      selectedNodeIds: [source.id],
      document,
    });
    if (!payload) throw new Error('Missing V3 clipboard fixture');
    const cut = applyStudioCommandV3(document, { type: 'deleteNodes', nodeIds: [source.id] });
    expect(cut.deliverables).toHaveLength(0);

    const restored = pasteStudioV3Clipboard({
      document: cut,
      payload,
      projectId,
      targetFrameId: target.id,
    });
    expect(restored.document.deliverables).toContainEqual({
      ...deliverable,
      frameIds: restored.selectedNodeIds,
    });
    expect(() =>
      pasteStudioV3Clipboard({
        document,
        payload,
        projectId: crypto.randomUUID(),
      })
    ).toThrow('another project');
  });

  it('restores multiple cut frames at their original deliverable positions', () => {
    const document = createStudioDocumentV3('Multiple cut frames');
    const frames = ['First', 'Second', 'Third'].map((name, index) =>
      createFrameNode('square', {
        name,
        zIndex: index,
        transform: { x: index * 1240, y: 0, width: 1080, height: 1080, rotation: 0 },
      })
    );
    document.nodes.push(...frames);
    const deliverableId = crypto.randomUUID();
    document.deliverables.push({
      id: deliverableId,
      code: '03',
      title: 'Sequence',
      kind: 'carousel',
      frameIds: frames.map(frame => frame.id),
      channel: 'instagram',
      order: 0,
      status: 'draft',
      dayOffset: 0,
      scheduledAt: null,
      assignee: '',
      brief: '',
      captions: { instagram: '', linkedin: '', facebook: '' },
    });
    const payload = createStudioV3ClipboardPayload({
      projectId,
      selectedNodeIds: frames.slice(0, 2).map(frame => frame.id),
      document,
    });
    if (!payload) throw new Error('Missing multi-frame clipboard fixture');
    const cut = applyStudioCommandV3(document, {
      type: 'deleteNodes',
      nodeIds: frames.slice(0, 2).map(frame => frame.id),
    });
    const restored = pasteStudioV3Clipboard({ document: cut, payload, projectId });
    expect(
      restored.document.deliverables.find(item => item.id === deliverableId)?.frameIds
    ).toEqual([...restored.selectedNodeIds, frames[2].id]);
  });
});
