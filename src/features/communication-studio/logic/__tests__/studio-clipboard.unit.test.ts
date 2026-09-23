import { describe, expect, it } from 'vitest';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { element } from '../document';
import { applyStudioCommandV3 } from '../commands-v3';
import { createFrameNode, createStudioDocumentV3, shapeNodeSchema } from '../document-v3';
import {
  createStudioClipboardPayload,
  createStudioV3ClipboardPayload,
  duplicateStudioClipboard,
  getProjectStudioClipboard,
  parseStudioClipboard,
  pasteStudioV3Clipboard,
  setProjectStudioClipboard,
  stringifyStudioClipboard,
} from '../studio-clipboard';

const projectId = crypto.randomUUID();
const frame = {
  id: crypto.randomUUID(),
  type: 'frame',
  x: 100,
  y: 200,
  width: 1080,
  height: 1080,
  angle: 0,
  isDeleted: false,
  locked: false,
  groupIds: [],
} as unknown as ExcalidrawElement;

function projection(id: string) {
  return {
    id,
    type: 'image',
    x: 140,
    y: 260,
    width: 300,
    height: 120,
    angle: 0,
    isDeleted: false,
    locked: false,
    groupIds: ['group'],
    frameId: frame.id,
    fileId: `polity-${id}`,
    scale: [1, 1],
    customData: { polityElement: id },
  } as unknown as ExcalidrawElement;
}

describe('Studio project clipboard', () => {
  it('serializes complete semantic selections relative to their frame and restores them with new IDs', () => {
    const source = element('text', {
      x: 40,
      y: 60,
      width: 300,
      height: 120,
      text: 'Structured source',
      group: 'group',
      flipX: true,
    });
    const shown = projection(source.id);
    const payload = createStudioClipboardPayload({
      projectId,
      selectedIds: [source.id],
      elements: [frame, shown],
      semanticElements: [source],
      files: {
        [`polity-${source.id}`]: {
          id: `polity-${source.id}`,
          mimeType: 'image/png',
          dataURL: 'data:image/png;base64,AAAA',
          created: 0,
        },
      } as never,
      frameIds: new Set([frame.id]),
      activeFrame: frame,
    });
    expect(payload).not.toBeNull();
    expect(payload!.elements[0]).toMatchObject({ x: 40, y: 60, frameId: null });
    expect(payload!.semanticElements[0]).toMatchObject({ text: source.text, flipX: true });

    const pasted = duplicateStudioClipboard(payload!, projectId, frame);
    expect(pasted.semanticElements[0]).toMatchObject({
      x: 64,
      y: 84,
      text: source.text,
      flipX: true,
    });
    expect(pasted.semanticElements[0].id).not.toBe(source.id);
    expect(pasted.elements[0]).toMatchObject({
      x: 164,
      y: 284,
      frameId: frame.id,
      isDeleted: false,
      customData: { polityElement: pasted.semanticElements[0].id },
    });
    expect(pasted.elements[0].id).toBe(pasted.semanticElements[0].id);
  });

  it('keeps cut content in the project fallback and rejects another project', () => {
    const source = element('rect');
    const payload = createStudioClipboardPayload({
      projectId,
      selectedIds: [source.id],
      elements: [projection(source.id)],
      semanticElements: [source],
      files: {},
    });
    if (!payload) throw new Error('Missing clipboard fixture');
    setProjectStudioClipboard(payload);
    const restored = getProjectStudioClipboard(projectId);
    expect(restored).toEqual(payload);
    expect(restored).not.toBe(payload);
    expect(parseStudioClipboard(stringifyStudioClipboard(payload))).toEqual(payload);
    expect(parseStudioClipboard('plain text')).toBeNull();
    expect(() => duplicateStudioClipboard(payload, crypto.randomUUID())).toThrow('another project');
  });

  it('remaps selected bindings and drops references to objects outside the copied selection', () => {
    const first = {
      ...projection(crypto.randomUUID()),
      id: 'first',
      type: 'rectangle',
      boundElements: [
        { id: 'bound', type: 'text' },
        { id: 'outside', type: 'arrow' },
      ],
      customData: {},
    } as unknown as ExcalidrawElement;
    const bound = {
      ...projection(crypto.randomUUID()),
      id: 'bound',
      type: 'text',
      containerId: 'first',
      customData: {},
    } as unknown as ExcalidrawElement;
    const payload = createStudioClipboardPayload({
      projectId,
      selectedIds: ['first'],
      elements: [first, bound],
      semanticElements: [],
      files: {},
    });
    if (!payload) throw new Error('Missing clipboard fixture');
    const pasted = duplicateStudioClipboard(payload, projectId);
    const rectangle = pasted.elements.find(item => item.type === 'rectangle')!;
    const text = pasted.elements.find(item => item.type === 'text')! as ExcalidrawElement & {
      containerId: string;
    };
    expect(rectangle.boundElements).toEqual([{ id: text.id, type: 'text' }]);
    expect(text.containerId).toBe(rectangle.id);
  });

  it('copies derived locked content as an editable independent element', () => {
    const master = {
      ...projection('master-source'),
      id: 'derived-master',
      locked: true,
      customData: {
        polityMaster: 'master-source',
        polityMasterFrame: 'master-frame',
        polityTargetFrame: frame.id,
      },
    } as unknown as ExcalidrawElement;
    const background = {
      ...projection('background-source'),
      id: 'derived-background',
      type: 'rectangle',
      locked: true,
      customData: { polityFrameBackground: frame.id },
    } as unknown as ExcalidrawElement;
    const payload = createStudioClipboardPayload({
      projectId,
      selectedIds: [master.id, background.id],
      elements: [master, background],
      semanticElements: [],
      files: {},
    });
    if (!payload) throw new Error('Missing derived clipboard fixture');

    const pasted = duplicateStudioClipboard(payload, projectId, frame);
    expect(pasted.elements).toHaveLength(2);
    for (const copied of pasted.elements) {
      expect(copied.locked).toBe(false);
      expect(copied.customData).not.toHaveProperty('polityMaster');
      expect(copied.customData).not.toHaveProperty('polityFrameBackground');
      expect(copied.frameId).toBe(frame.id);
    }
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
      excalidraw: {
        id: 'native-box',
        groupIds: [sharedGroupId],
        boundElements: [{ id: 'native-arrow', type: 'arrow' }],
        customData: { polityNode: boxId, polityElement: boxId },
      },
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
      excalidraw: {
        id: 'native-arrow',
        groupIds: [sharedGroupId],
        startBinding: { elementId: 'native-box', focus: 0, gap: 0 },
        customData: { polityNode: arrowId },
      },
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
    expect(boxCopy?.excalidraw).toMatchObject({
      id: expect.not.stringMatching(/^native-box$/),
      boundElements: [{ id: arrowCopy?.excalidraw?.id, type: 'arrow' }],
      customData: { polityNode: boxCopy?.id, polityElement: boxCopy?.id },
    });
    expect(arrowCopy?.excalidraw).toMatchObject({
      startBinding: { elementId: boxCopy?.excalidraw?.id },
      customData: { polityNode: arrowCopy?.id },
    });
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
