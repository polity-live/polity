import { describe, expect, it } from 'vitest';
import { applyStudioCommandV3 } from '../commands-v3';
import { createFrameNode, createStudioDocumentV3, shapeNodeSchema } from '../document-v3';
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
