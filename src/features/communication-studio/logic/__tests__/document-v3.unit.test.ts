import { describe, expect, it } from 'vitest';
import {
  createFrameNode,
  createStudioDocumentV3,
  framePresetRegistry,
  studioDocumentV3Schema,
  type StudioDocumentV3,
} from '../document-v3';
import { applyStudioCommandV3, snapToGrid } from '../commands-v3';
import { createDocument } from '../templates';
import { legacyDocumentToV3, v3DocumentToLegacy } from '../v3-adapter';

function documentWithFrames(): StudioDocumentV3 {
  const document = createStudioDocumentV3('Campaign', 'campaign');
  const first = createFrameNode('portrait', { id: crypto.randomUUID(), name: 'Post 1', zIndex: 0 });
  const second = createFrameNode('story', {
    id: crypto.randomUUID(),
    name: 'Story 1',
    zIndex: 1,
    transform: { x: 1400, y: 0, width: 1080, height: 1920, rotation: 0 },
  });
  document.nodes.push(first, second);
  return studioDocumentV3Schema.parse(document);
}

describe('StudioDocumentV3', () => {
  it('uses the shared frame preset registry and 8px grid defaults', () => {
    const frame = createFrameNode('portrait');
    expect(frame.transform).toMatchObject({
      width: framePresetRegistry.portrait.width,
      height: framePresetRegistry.portrait.height,
    });
    expect(frame.grid).toEqual({ enabled: true, size: 8, snap: true });
    expect(snapToGrid(19, frame.grid.size)).toBe(16);
  });

  it('defaults reflection axes and preserves them across V3 and legacy projections', () => {
    const legacy = createDocument('single', 'Reflected');
    legacy.pages[0].elements[0].flipX = true;
    legacy.pages[0].elements[0].flipY = false;
    const v3 = legacyDocumentToV3(legacy);
    const node = v3.nodes.find(candidate => candidate.id === legacy.pages[0].elements[0].id)!;
    expect(node.transform).toMatchObject({ flipX: true, flipY: false });
    expect(v3DocumentToLegacy(v3).pages[0].elements[0]).toMatchObject({
      flipX: true,
      flipY: false,
    });
    const oldFrame = createFrameNode('portrait');
    const { flipX: _flipX, flipY: _flipY, ...oldTransform } = oldFrame.transform;
    expect(
      studioDocumentV3Schema.parse({
        ...createStudioDocumentV3('Old'),
        nodes: [{ ...oldFrame, transform: oldTransform }],
      }).nodes[0].transform
    ).toMatchObject({ flipX: false, flipY: false });
  });

  it('defaults frame backgrounds to the project value and supports explicit overrides', () => {
    const document = documentWithFrames();
    document.frameDefaults.background = '#112233';
    document.nodes[0].style.fill = null;
    document.nodes[1].style.fill = '#445566';
    const legacy = v3DocumentToLegacy(document);
    expect(legacy.pages[0].background).toBe('#112233');
    expect(legacy.pages[1].background).toBe('#445566');
  });

  it('keeps the project master out of pages and deliverables across legacy transactions', () => {
    const document = documentWithFrames();
    const master = createFrameNode('portrait', {
      id: crypto.randomUUID(),
      name: 'Master layout',
      zIndex: -1,
    });
    const masterChild = createFrameNode('custom', {
      id: crypto.randomUUID(),
      name: 'Master mark',
      parentFrameId: master.id,
      zIndex: 0,
      transform: { x: 20, y: 20, width: 100, height: 40, rotation: 0 },
    });
    document.nodes.push(master, masterChild);
    document.masterLayout = {
      frameId: master.id,
      placements: { [masterChild.id]: 'foreground' },
    };
    const parsed = studioDocumentV3Schema.parse(document);
    const legacy = v3DocumentToLegacy(parsed);
    expect(legacy.pages.some(page => page.id === master.id)).toBe(false);
    const restored = legacyDocumentToV3(legacy, parsed);
    expect(restored.masterLayout).toEqual(parsed.masterLayout);
    expect(restored.nodes.some(node => node.id === master.id)).toBe(true);
    expect(restored.nodes.some(node => node.id === masterChild.id)).toBe(true);
  });

  it('projects master elements into every export frame without changing the editor pages', () => {
    const document = documentWithFrames();
    const master = createFrameNode('square', {
      id: crypto.randomUUID(),
      name: 'Master',
      zIndex: -1,
    });
    const text = legacyDocumentToV3(createDocument('single', 'Master text')).nodes.find(
      node => node.type === 'richText'
    );
    if (!text) throw new Error('Missing text fixture');
    text.parentFrameId = master.id;
    text.transform = { ...text.transform, x: 20, y: 30, width: 100, height: 40, rotation: 0 };
    const mark = createFrameNode('custom', {
      id: crypto.randomUUID(),
      name: 'Mark',
      parentFrameId: master.id,
      transform: { x: 50, y: 60, width: 80, height: 40, rotation: 0 },
    });
    document.nodes.push(master, text, mark);
    document.masterLayout = {
      frameId: master.id,
      placements: { [text.id]: 'background', [mark.id]: 'foreground' },
    };
    const editor = v3DocumentToLegacy(document);
    expect(editor.pages.every(page => page.elements.length === 0 && !page.canvas)).toBe(true);
    const exported = v3DocumentToLegacy(document, { includeMaster: true });
    expect(exported.pages).toHaveLength(2);
    for (const page of exported.pages) {
      expect(page.elements).toHaveLength(1);
      expect(page.elements[0]).toMatchObject({ locked: true, order: -100_000 });
      expect(page.canvas?.elements).toHaveLength(1);
      expect(page.canvas?.elements[0]).toMatchObject({
        locked: true,
        customData: { polityOrder: 100_000 },
      });
    }
    expect(exported.pages[0].elements[0].id).not.toBe(exported.pages[1].elements[0].id);
    expect(exported.pages[0].elements[0].x).toBeCloseTo(20);
    expect(exported.pages[1].elements[0].y).toBeCloseTo((30 * 1920) / 1080);
  });

  it('promotes drawings outside a frame to persistent root canvas nodes', () => {
    const legacy = createDocument('single', 'Whiteboard roots');
    legacy.pages[0].canvas = {
      version: 1,
      elements: [
        {
          id: crypto.randomUUID(),
          type: 'rectangle',
          x: 1800,
          y: 200,
          width: 240,
          height: 120,
          angle: 0,
          isDeleted: false,
          customData: { polityRoot: true },
        },
      ],
      files: {},
    };
    const document = legacyDocumentToV3(legacy);
    const root = document.nodes.find(node => node.excalidraw?.customData != null);
    expect(root?.parentFrameId).toBeNull();
    const projected = v3DocumentToLegacy(document);
    expect(projected.pages[0].canvas?.elements ?? []).toEqual([]);
    const restored = legacyDocumentToV3(projected, document);
    expect(restored.nodes.some(node => node.id === root?.id && node.parentFrameId === null)).toBe(
      true
    );
  });

  it('rejects missing parents and circular frame hierarchies', () => {
    const document = documentWithFrames();
    const [first, second] = document.nodes;
    first.parentFrameId = second.id;
    second.parentFrameId = first.id;
    expect(studioDocumentV3Schema.safeParse(document).success).toBe(false);
    second.parentFrameId = crypto.randomUUID();
    expect(studioDocumentV3Schema.safeParse(document).success).toBe(false);
  });

  it('reparents nodes but prevents moving a frame into its descendant', () => {
    const document = documentWithFrames();
    const [first, second] = document.nodes;
    first.transform.x = 200;
    first.transform.y = 100;
    const nested = applyStudioCommandV3(document, {
      type: 'reparentNodes',
      nodeIds: [second.id],
      parentFrameId: first.id,
    });
    expect(nested.nodes.find(node => node.id === second.id)?.parentFrameId).toBe(first.id);
    expect(nested.nodes.find(node => node.id === second.id)?.transform).toMatchObject({
      x: 1200,
      y: -100,
    });
    expect(() =>
      applyStudioCommandV3(nested, {
        type: 'reparentNodes',
        nodeIds: [first.id],
        parentFrameId: second.id,
      })
    ).toThrow('Circular');
  });

  it('moves layers between stacking contexts while preserving their world position', () => {
    const document = documentWithFrames();
    const [firstFrame, secondFrame] = document.nodes;
    const fixture = legacyDocumentToV3(createDocument('single', 'Layer move'));
    const firstLayer = fixture.nodes.find(node => node.type === 'richText')!;
    const secondLayer = structuredClone(firstLayer);
    firstLayer.id = crypto.randomUUID();
    firstLayer.name = 'First layer';
    firstLayer.parentFrameId = firstFrame.id;
    firstLayer.zIndex = 0;
    firstLayer.transform.x = 20;
    firstLayer.transform.y = 30;
    secondLayer.id = crypto.randomUUID();
    secondLayer.name = 'Second layer';
    secondLayer.parentFrameId = firstFrame.id;
    secondLayer.zIndex = 1;
    document.nodes.push(firstLayer, secondLayer);

    const reordered = applyStudioCommandV3(studioDocumentV3Schema.parse(document), {
      type: 'moveNode',
      nodeId: firstLayer.id,
      targetId: secondLayer.id,
      position: 'before',
    });
    expect(reordered.nodes.find(node => node.id === firstLayer.id)?.zIndex).toBeGreaterThan(
      reordered.nodes.find(node => node.id === secondLayer.id)!.zIndex
    );

    const moved = applyStudioCommandV3(reordered, {
      type: 'moveNode',
      nodeId: firstLayer.id,
      targetId: secondFrame.id,
      position: 'inside',
    });
    expect(moved.nodes.find(node => node.id === firstLayer.id)).toMatchObject({
      parentFrameId: secondFrame.id,
      transform: { x: -1380, y: 30 },
    });

    const detached = applyStudioCommandV3(moved, {
      type: 'moveNode',
      nodeId: firstLayer.id,
      targetId: firstFrame.id,
      position: 'after',
    });
    expect(detached.nodes.find(node => node.id === firstLayer.id)).toMatchObject({
      parentFrameId: null,
      transform: { x: 20, y: 30 },
    });

    const framesReordered = applyStudioCommandV3(detached, {
      type: 'moveNode',
      nodeId: secondFrame.id,
      targetId: firstFrame.id,
      position: 'before',
    });
    expect(framesReordered.nodes.find(node => node.id === secondFrame.id)?.zIndex).toBeLessThan(
      framesReordered.nodes.find(node => node.id === firstFrame.id)!.zIndex
    );
  });

  it('rejects locked and structurally invalid layer moves', () => {
    const document = documentWithFrames();
    const [first, second] = document.nodes;
    first.locked = true;
    expect(() =>
      applyStudioCommandV3(document, {
        type: 'moveNode',
        nodeId: first.id,
        targetId: second.id,
        position: 'after',
      })
    ).toThrow('Invalid layer move');
    first.locked = false;
    expect(() =>
      applyStudioCommandV3(document, {
        type: 'moveNode',
        nodeId: first.id,
        targetId: second.id,
        position: 'inside',
      })
    ).toThrow('Invalid layer move');
  });

  it('applies frame constraints and scales content only when requested', () => {
    const document = documentWithFrames();
    const parent = document.nodes[0];
    const child = createFrameNode('custom', {
      id: crypto.randomUUID(),
      parentFrameId: parent.id,
      transform: { x: 800, y: 400, width: 100, height: 100, rotation: 0 },
      constraints: { horizontal: 'right', vertical: 'center' },
    });
    document.nodes.push(child);
    const constrained = applyStudioCommandV3(document, {
      type: 'resizeFrame',
      frameId: parent.id,
      transform: { ...parent.transform, width: 1280, height: 1280 },
      scaleContent: false,
    });
    expect(constrained.nodes.find(node => node.id === child.id)?.transform).toMatchObject({
      x: 1100,
      y: 365,
      width: 100,
      height: 100,
    });
    const scaled = applyStudioCommandV3(constrained, {
      type: 'resizeFrame',
      frameId: parent.id,
      transform: { ...parent.transform, width: 2560, height: 640 },
      scaleContent: true,
    });
    expect(scaled.nodes.find(node => node.id === child.id)?.transform).toMatchObject({
      x: 2200,
      y: 182.5,
      width: 200,
      height: 50,
    });
  });

  it('keeps stacking order local to a parent frame', () => {
    const document = documentWithFrames();
    const frame = document.nodes[0];
    const nodes = [0, 1, 2].map(index => ({
      ...createFrameNode('square', {
        id: crypto.randomUUID(),
        name: `Nested ${index}`,
        parentFrameId: frame.id,
        zIndex: index,
      }),
    }));
    document.nodes.push(...nodes);
    const next = applyStudioCommandV3(document, {
      type: 'reorderNodes',
      nodeIds: [nodes[0].id],
      action: 'front',
    });
    expect(
      next.nodes
        .filter(node => node.parentFrameId === frame.id)
        .sort((a, b) => a.zIndex - b.zIndex)
        .map(node => node.id)
    ).toEqual([nodes[1].id, nodes[2].id, nodes[0].id]);
    expect(next.nodes.filter(node => node.parentFrameId === null)).toHaveLength(2);
  });

  it('deletes frame descendants and removes empty deliverables atomically', () => {
    const document = documentWithFrames();
    const frame = document.nodes[0];
    const child = createFrameNode('square', {
      id: crypto.randomUUID(),
      name: 'Nested',
      parentFrameId: frame.id,
      zIndex: 0,
    });
    document.nodes.push(child);
    document.deliverables.push({
      id: crypto.randomUUID(),
      code: '01',
      title: 'Post',
      kind: 'single',
      frameIds: [frame.id],
      channel: 'instagram',
      order: 0,
      status: 'draft',
      dayOffset: 0,
      scheduledAt: null,
      assignee: '',
      brief: '',
      captions: { instagram: '', linkedin: '', facebook: '' },
    });
    const next = applyStudioCommandV3(document, { type: 'deleteNodes', nodeIds: [frame.id] });
    expect(next.nodes.some(node => node.id === frame.id || node.id === child.id)).toBe(false);
    expect(next.deliverables).toHaveLength(0);
  });

  it('round-trips existing Studio content through the V3 node model', () => {
    const legacy = createDocument('carousel', 'Launch');
    legacy.pages[0].duration = 12;
    legacy.pages[0].transition = 'fade';
    legacy.pages[0].elements[0].animation = 'fade';
    const v3 = legacyDocumentToV3(legacy);
    expect(v3.schemaVersion).toBe(4);
    expect(v3.nodes.filter(node => node.type === 'frame')).toHaveLength(5);
    expect(v3.deliverables[0].frameIds).toEqual(legacy.posts[0].pageIds);
    const restored = v3DocumentToLegacy(v3);
    expect(restored).toMatchObject({
      version: 2,
      title: legacy.title,
      kind: legacy.kind,
      startDate: legacy.startDate,
    });
    expect(restored.pages.map(page => page.id)).toEqual(legacy.pages.map(page => page.id));
    expect(restored.pages[0]).toMatchObject({ duration: 12, transition: 'fade' });
    expect(restored.pages[0].elements[0].animation).toBe('fade');
    expect(restored.posts).toEqual(legacy.posts);
  });
});
