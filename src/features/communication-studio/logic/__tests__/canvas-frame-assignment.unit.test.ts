import { expect, it } from 'vitest';
import { assignDraggedStudioNodesToFrames } from '../canvas-frame-assignment';
import { applyStudioCommandV3 } from '../commands-v3';
import { createFrameNode, createStudioDocumentV5, type StudioNode } from '../document-v3';
import { createStudioNodeFromElement } from '../create-studio-node';
import { element } from '../document';
import { worldMatrix } from '../selection-geometry';

function fixture(type: 'chart' | 'text' | 'rect' | 'table' = 'rect') {
  const document = createStudioDocumentV5('Drag assignment');
  const frame = createFrameNode('custom', {
    transform: { x: 100, y: 100, width: 300, height: 300 },
    zIndex: 0,
  });
  const node = createStudioNodeFromElement(
    element(type, { x: 20, y: 20, width: 50, height: 50 }),
    frame.id,
    0
  );
  document.nodes.push(frame, node);
  return { document, frame, node };
}

it('does not reparent a persisted group whose members belong to different frames', () => {
  const { document, frame, node } = fixture();
  const other = structuredClone(node);
  other.id = crypto.randomUUID();
  other.parentFrameId = null;
  const group = crypto.randomUUID();
  node.groupIds = other.groupIds = [group];
  node.transform.x = other.transform.x = 500;
  document.nodes.push(other);
  assignDraggedStudioNodesToFrames(document, [node.id, other.id]);
  expect(node.parentFrameId).toBe(frame.id);
  expect(other.parentFrameId).toBeNull();
});

it('detaches from a nested frame when its persisted ancestor is missing', () => {
  const { document, frame, node } = fixture();
  frame.parentFrameId = crypto.randomUUID();
  node.transform.x = 500;
  assignDraggedStudioNodesToFrames(document, [node.id]);
  expect(node.parentFrameId).toBeNull();
});

it('walks beyond a non-containing parent and assigns a complete group in stable ID order', () => {
  const { document, frame, node } = fixture();
  const outer = createFrameNode('custom', { transform: { x: 0, y: 0, width: 1500, height: 1500 } });
  const middle = createFrameNode('custom', {
    parentFrameId: outer.id,
    transform: { x: 0, y: 0, width: 450, height: 450 },
  });
  frame.parentFrameId = middle.id;
  node.transform.x = 500;
  const other = structuredClone(node);
  other.id = crypto.randomUUID();
  const group = crypto.randomUUID();
  node.groupIds = other.groupIds = [group];
  document.nodes.push(outer, middle, other);
  assignDraggedStudioNodesToFrames(document, [node.id, other.id]);
  expect(node.parentFrameId).toBe(outer.id);
  expect(other.parentFrameId).toBe(outer.id);
  const ordered = [node, other].sort((a, b) => a.id.localeCompare(b.id));
  expect(ordered[1].zIndex).toBe(ordered[0].zIndex + 1);
});

it('handles collapsed persisted frame and content edges without producing an invalid separating axis', () => {
  const { document, frame, node } = fixture();
  frame.transform.width = 0;
  node.transform.x = 0;
  node.transform.width = node.transform.height = 0;
  assignDraggedStudioNodesToFrames(document, [node.id]);
  expect(node.parentFrameId).toBe(frame.id);
});

it.each(['chart', 'text', 'rect', 'table'] as const)(
  'detaches and reattaches %s without changing its world pose',
  type => {
    const { document, frame, node } = fixture(type);
    node.transform.x = 301;
    const outside = worldMatrix(document, node);
    assignDraggedStudioNodesToFrames(document, [node.id]);
    const detached = document.nodes.find(n => n.id === node.id)!;
    expect(detached.parentFrameId).toBeNull();
    expect(worldMatrix(document, detached)).toEqual(outside);
    detached.transform.x = 120;
    const inside = worldMatrix(document, detached);
    assignDraggedStudioNodesToFrames(document, [node.id]);
    const attached = document.nodes.find(n => n.id === node.id)!;
    expect(attached.parentFrameId).toBe(frame.id);
    expect(worldMatrix(document, attached)).toEqual(inside);
  }
);

it.each([275, 300])('retains frame membership at partial overflow or touching (x=%s)', x => {
  const { document, frame, node } = fixture();
  node.transform.x = x;
  assignDraggedStudioNodesToFrames(document, [node.id]);
  expect(node.parentFrameId).toBe(frame.id);
});

it('moves complete outer groups together and skips partial or locked groups', () => {
  const { document, frame, node } = fixture('chart');
  const title = createStudioNodeFromElement(
    element('text', { x: 301, y: 0, width: 50, height: 10 }),
    frame.id,
    1
  );
  node.transform.x = 301;
  const group = crypto.randomUUID();
  node.groupIds = title.groupIds = [group];
  document.nodes.push(title);
  assignDraggedStudioNodesToFrames(document, [node.id]);
  expect(node.parentFrameId).toBe(frame.id);
  title.locked = true;
  assignDraggedStudioNodesToFrames(document, [node.id, title.id]);
  expect(node.parentFrameId).toBe(frame.id);
  title.locked = false;
  assignDraggedStudioNodesToFrames(document, [node.id, title.id]);
  expect(document.nodes.filter(n => n.groupIds[0] === group).map(n => n.parentFrameId)).toEqual([
    null,
    null,
  ]);
  expect(document.nodes.filter(n => n.groupIds[0] === group).map(n => n.groupIds)).toEqual([
    [group],
    [group],
  ]);
});

it('retains a group while any member intersects the source frame', () => {
  const { document, frame, node } = fixture();
  const other = structuredClone(node);
  other.id = crypto.randomUUID();
  node.transform.x = 301;
  node.groupIds = other.groupIds = [crypto.randomUUID()];
  document.nodes.push(other);
  assignDraggedStudioNodesToFrames(document, [node.id, other.id]);
  expect(document.nodes.every(n => n.type === 'frame' || n.parentFrameId === frame.id)).toBe(true);
});

it('assigns independent selected nodes separately and excludes frames and locked nodes', () => {
  const { document, frame, node } = fixture();
  node.transform.x = 301;
  const other = structuredClone(node);
  other.id = crypto.randomUUID();
  other.locked = true;
  document.nodes.push(other);
  assignDraggedStudioNodesToFrames(document, [node.id, other.id, frame.id]);
  expect(document.nodes.find(n => n.id === node.id)?.parentFrameId).toBeNull();
  expect(document.nodes.find(n => n.id === other.id)?.parentFrameId).toBe(frame.id);
  expect(document.nodes.find(n => n.id === frame.id)?.parentFrameId).toBeNull();
});

it('chooses the topmost containing frame and its innermost containing child', () => {
  const { document, frame, node } = fixture();
  node.parentFrameId = null;
  node.transform.x = node.transform.y = 160;
  const upper = createFrameNode('custom', { transform: { ...frame.transform }, zIndex: 1 });
  const nested = createFrameNode('custom', {
    parentFrameId: upper.id,
    transform: { x: 40, y: 40, width: 100, height: 100 },
  });
  document.nodes.push(upper, nested);
  assignDraggedStudioNodesToFrames(document, [node.id]);
  expect(document.nodes.find(n => n.id === node.id)?.parentFrameId).toBe(nested.id);
});

it('falls back to a containing ancestor when leaving a nested frame', () => {
  const { document, frame, node } = fixture();
  const nested = createFrameNode('custom', {
    parentFrameId: frame.id,
    transform: { x: 10, y: 10, width: 100, height: 100 },
  });
  node.parentFrameId = nested.id;
  node.transform.x = 101;
  document.nodes.push(nested);
  assignDraggedStudioNodesToFrames(document, [node.id]);
  expect(document.nodes.find(n => n.id === node.id)?.parentFrameId).toBe(frame.id);
});

it('does not attach free content to a nested frame where an ancestor would clip its hit area', () => {
  const { document, frame, node } = fixture();
  const nested = createFrameNode('custom', {
    parentFrameId: frame.id,
    transform: { x: 280, y: 10, width: 100, height: 100 },
  });
  document.nodes.push(nested);
  node.parentFrameId = null;
  node.transform.x = 405;
  node.transform.y = 120;
  assignDraggedStudioNodesToFrames(document, [node.id]);
  expect(document.nodes.find(n => n.id === node.id)?.parentFrameId).toBeNull();
});

it('assigns separate moved nodes to different frames and paints them above existing content', () => {
  const { document, frame, node } = fixture();
  const second = createFrameNode('custom', {
    transform: { x: 500, y: 100, width: 300, height: 300 },
    zIndex: 2,
  });
  const other = structuredClone(node);
  other.id = crypto.randomUUID();
  other.parentFrameId = null;
  other.transform.x = 120;
  other.transform.y = 120;
  node.transform.x = 420;
  document.nodes.push(second, other);
  assignDraggedStudioNodesToFrames(document, [node.id, other.id]);
  expect(document.nodes.find(n => n.id === node.id)?.parentFrameId).toBe(second.id);
  expect(document.nodes.find(n => n.id === other.id)?.parentFrameId).toBe(frame.id);
  expect(document.nodes.find(n => n.id === node.id)?.transform.x).toBeCloseTo(20);
});

it('requires full containment and ignores hidden, locked and master targets', () => {
  const { document, frame, node } = fixture();
  node.parentFrameId = null;
  node.transform.x = 380;
  node.transform.y = 120;
  assignDraggedStudioNodesToFrames(document, [node.id]);
  expect(node.parentFrameId).toBeNull();
  node.transform.x = 120;
  for (const mode of ['hidden', 'locked', 'master']) {
    frame.visible = mode !== 'hidden';
    frame.locked = mode === 'locked';
    document.masterLayout.frameId = mode === 'master' ? frame.id : null;
    assignDraggedStudioNodesToFrames(document, [node.id]);
    expect(document.nodes.find(n => n.id === node.id)?.parentFrameId).toBeNull();
  }
});

it.each([
  [false, false],
  [true, false],
  [false, true],
  [true, true],
])(
  'preserves every world matrix coefficient through rotated and mirrored frames (%s, %s)',
  (flipX, flipY) => {
    const { document, frame, node } = fixture();
    frame.transform.rotation = 37;
    frame.transform.flipX = flipX;
    frame.transform.flipY = flipY;
    node.transform.rotation = -23;
    node.transform.flipX = true;
    node.transform.flipY = true;
    const target = createFrameNode('custom', {
      transform: {
        x: 500,
        y: 700,
        width: 400,
        height: 300,
        rotation: -52,
        flipX: true,
        flipY: false,
      },
    });
    document.nodes.push(target);
    const original = worldMatrix(document, node);
    let result = document;
    for (const parentFrameId of [target.id, null, frame.id]) {
      result = applyStudioCommandV3(result, {
        type: 'reparentNodes',
        nodeIds: [node.id],
        parentFrameId,
      });
      const changed = result.nodes.find(n => n.id === node.id) as StudioNode;
      worldMatrix(result, changed).forEach((value, i) => expect(value).toBeCloseTo(original[i], 8));
      expect(changed.transform.width).toBe(node.transform.width);
      expect(changed.transform.height).toBe(node.transform.height);
    }
  }
);

it('detects separation along a rotated frame edge', () => {
  const { document, frame, node } = fixture();
  frame.transform.rotation = 45;
  frame.transform.flipX = true;
  node.transform.x = 301;
  const before = worldMatrix(document, node);
  assignDraggedStudioNodesToFrames(document, [node.id]);
  const changed = document.nodes.find(n => n.id === node.id)!;
  expect(changed.parentFrameId).toBeNull();
  worldMatrix(document, changed).forEach((value, i) => expect(value).toBeCloseTo(before[i], 8));
});
