import { describe, expect, it } from 'vitest';
import { applyStudioCommandV3 } from '../commands-v3';
import { createFrameNode, createStudioDocumentV3, type StudioDocumentV3 } from '../document-v3';
import {
  arrangementReferenceBounds,
  arrangementUnits,
  selectionUnits,
  worldBounds,
  worldMatrix,
  worldToLocalPoint,
  moveByWorldDelta,
  invertTransformMatrix,
  isDescendantOf,
  unionBounds,
} from '../selection-geometry';
import { createDocument } from '../templates';
import { legacyDocumentToV3, v3DocumentToLegacy } from '../v3-adapter';

function scene(): StudioDocumentV3 {
  const document = createStudioDocumentV3('Selection');
  const frame = createFrameNode('custom', {
    transform: { x: 100, y: 50, width: 400, height: 300, rotation: 0 },
  });
  const root = createFrameNode('custom', {
    transform: { x: 600, y: 50, width: 100, height: 100, rotation: 0 },
  });
  const children = [0, 1, 2].map(index =>
    createFrameNode('custom', {
      parentFrameId: frame.id,
      transform: { x: index * 80, y: 20, width: 40, height: 40, rotation: 0 },
    })
  );
  document.nodes.push(frame, root, ...children);
  return document;
}

describe('Studio selection geometry and commands', () => {
  it('round-trips world positions through rotated and reflected native parents', () => {
    const document = scene();
    const parent = document.nodes[0];
    parent.transform.rotation = 90;
    parent.transform.flipX = true;
    parent.transform.flipY = true;
    const matrix = worldMatrix(document, parent);
    const local = { x: 12, y: 34 };
    const world = {
      x: matrix[0] * local.x + matrix[2] * local.y + matrix[4],
      y: matrix[1] * local.x + matrix[3] * local.y + matrix[5],
    };
    const restored = worldToLocalPoint(document, parent.id, world);
    expect(restored.x).toBeCloseTo(local.x);
    expect(restored.y).toBeCloseTo(local.y);
  });

  it('rejects missing selections and empty unions and returns no reference for an empty selection', () => {
    const document = scene();
    expect(() => unionBounds([])).toThrow('Selection is empty');
    expect(() => selectionUnits(document, [crypto.randomUUID()])).toThrow('Node not found');
    expect(arrangementReferenceBounds(document, [], 'selection')).toBeNull();
    expect(
      arrangementReferenceBounds(
        document,
        selectionUnits(document, [document.nodes[0].id]),
        'frame'
      )
    ).toBeNull();
  });

  it.each([
    null,
    { left: NaN, top: 0, right: 100, bottom: 100 },
    { left: 100, top: 0, right: 100, bottom: 100 },
    { left: 0, top: 100, right: 100, bottom: 100 },
  ])(
    'rejects unavailable, nonfinite and degenerate visible-canvas reference bounds (%j)',
    bounds => {
      const document = scene();
      const units = selectionUnits(document, [document.nodes[0].id]);
      expect(arrangementReferenceBounds(document, units, 'view', bounds)).toBeNull();
    }
  );
  it('inverts scaled, translated and reflected affine transforms and rejects singular transforms', () => {
    expect(invertTransformMatrix([2, 0, 0, -4, 10, 20])).toEqual([0.5, 0, 0, -0.25, -5, 5]);
    expect(() => invertTransformMatrix([0, 0, 0, 1, 0, 0])).toThrow('Invalid Studio transform');
    expect(() => invertTransformMatrix([1, 2, 2, 4, 5, 6])).toThrow('Invalid Studio transform');
  });

  it('preserves unparented world coordinates and moves nodes with a missing parent by the native delta', () => {
    const document = scene();
    const node = document.nodes[1];
    const position = { x: 12, y: 34 };
    expect(worldToLocalPoint(document, null, position)).toBe(position);
    expect(worldToLocalPoint(document, crypto.randomUUID(), position)).toBe(position);
    node.parentFrameId = crypto.randomUUID();
    const before = structuredClone(node.transform);
    moveByWorldDelta(document, node, { x: 3, y: -4 });
    expect(node.transform).toMatchObject({ x: before.x + 3, y: before.y - 4 });
    expect(isDescendantOf(document, node, document.nodes[0].id)).toBe(false);
  });

  it('detects circular world transforms without modifying the native hierarchy', () => {
    const document = scene();
    const [root, , child] = document.nodes;
    root.parentFrameId = child.id;
    expect(() => worldMatrix(document, child)).toThrow('Circular frame hierarchy');
    expect(root.parentFrameId).toBe(child.id);
  });

  it('keeps incomplete groups atomic when only some direct members are selected', () => {
    const document = scene();
    const groupId = crypto.randomUUID();
    const members = document.nodes.slice(2);
    for (const member of members) member.groupIds = [groupId];
    expect(
      arrangementUnits(
        document,
        members.slice(0, 2).map(node => node.id)
      )
    ).toHaveLength(1);
    const units = selectionUnits(document, [members[0].id]);
    expect(
      arrangementReferenceBounds(
        document,
        [{ ...units[0], parentFrameId: document.nodes[1].id }],
        'frame'
      )
    ).toEqual(worldBounds(document, document.nodes[1]));
    expect(
      arrangementReferenceBounds(
        document,
        [{ ...units[0], parentFrameId: crypto.randomUUID() }],
        'frame'
      )
    ).toBeNull();
  });
  it('groups root frames and root elements, nests groups, and ungroups one level', () => {
    const document = scene();
    const [frame, root] = document.nodes;
    const innerId = crypto.randomUUID();
    const outerId = crypto.randomUUID();
    const inner = applyStudioCommandV3(document, {
      type: 'groupNodes',
      nodeIds: [frame.id, root.id],
      groupId: innerId,
    });
    const outer = applyStudioCommandV3(inner, {
      type: 'groupNodes',
      nodeIds: [frame.id, root.id],
      groupId: outerId,
    });
    expect(outer.nodes[0].groupIds).toEqual([outerId, innerId]);
    expect(outer.nodes[1].groupIds).toEqual([outerId, innerId]);
    const ungrouped = applyStudioCommandV3(outer, {
      type: 'ungroupNodes',
      nodeIds: [frame.id],
    });
    expect(ungrouped.nodes[0].groupIds).toEqual([innerId]);
    expect(ungrouped.nodes[1].groupIds).toEqual([innerId]);
  });

  it('rejects groups across parents and partial regrouping', () => {
    const document = scene();
    const [frame, root, child] = document.nodes;
    expect(() =>
      applyStudioCommandV3(document, {
        type: 'groupNodes',
        nodeIds: [root.id, child.id],
        groupId: crypto.randomUUID(),
      })
    ).toThrow('share a parent');
    const grouped = applyStudioCommandV3(document, {
      type: 'groupNodes',
      nodeIds: [frame.id, root.id],
      groupId: crypto.randomUUID(),
    });
    expect(() =>
      applyStudioCommandV3(grouped, {
        type: 'groupNodes',
        nodeIds: [frame.id, child.id],
        groupId: crypto.randomUUID(),
      })
    ).toThrow();
  });

  it('filters selected frame descendants and aligns across frames in world coordinates', () => {
    const document = scene();
    const [frame, root, first] = document.nodes;
    expect(selectionUnits(document, [frame.id, first.id])).toHaveLength(1);
    const aligned = applyStudioCommandV3(document, {
      type: 'alignNodes',
      nodeIds: [first.id, root.id],
      direction: 'left',
      reference: 'selection',
    });
    expect(worldBounds(aligned, aligned.nodes[2]).left).toBeCloseTo(100);
    expect(worldBounds(aligned, aligned.nodes[1]).left).toBeCloseTo(100);
    expect(aligned.nodes[1].parentFrameId).toBeNull();
  });

  it('aligns a rotated child using its visual bounds and converts world deltas to parent coordinates', () => {
    const document = scene();
    const [frame, , first] = document.nodes;
    frame.transform.rotation = 90;
    first.transform.rotation = 45;
    const before = worldBounds(document, first);
    const aligned = applyStudioCommandV3(document, {
      type: 'alignNodes',
      nodeIds: [first.id],
      direction: 'center',
      reference: 'parent',
    });
    const after = worldBounds(aligned, aligned.nodes[2]);
    const parent = worldBounds(aligned, aligned.nodes[0]);
    expect((after.left + after.right) / 2).toBeCloseTo((parent.left + parent.right) / 2);
    expect(after.bottom - after.top).toBeCloseTo(before.bottom - before.top);
  });

  it('distributes grouped units with equal gaps while preserving the outer edges', () => {
    const document = scene();
    const [frame, , first, second, third] = document.nodes;
    first.transform.x = 0;
    second.transform.x = 50;
    third.transform.x = 280;
    const fourth = createFrameNode('custom', {
      parentFrameId: frame.id,
      transform: { x: 350, y: 20, width: 30, height: 40, rotation: 0 },
    });
    document.nodes.push(fourth);
    const grouped = applyStudioCommandV3(document, {
      type: 'groupNodes',
      nodeIds: [first.id, second.id],
      groupId: crypto.randomUUID(),
    });
    const arranged = applyStudioCommandV3(grouped, {
      type: 'distributeNodes',
      nodeIds: [first.id, second.id, third.id, fourth.id],
      axis: 'horizontal',
    });
    const units = selectionUnits(arranged, [first.id, second.id, third.id, fourth.id]).sort(
      (a, b) => a.bounds.left - b.bounds.left
    );
    expect(units).toHaveLength(3);
    expect(units[0].bounds.left).toBeCloseTo(100);
    expect(units[2].bounds.right).toBeCloseTo(480);
    expect(units[1].bounds.left - units[0].bounds.right).toBeCloseTo(
      units[2].bounds.left - units[1].bounds.right
    );
  });

  it('aligns the members of a lone complete group to the selection edges and centers', () => {
    const document = scene();
    const members = document.nodes.slice(2);
    members[0].transform.y = 10;
    members[1].transform.y = 80;
    members[2].transform.y = 140;
    const grouped = applyStudioCommandV3(document, {
      type: 'groupNodes',
      nodeIds: members.map(node => node.id),
      groupId: crypto.randomUUID(),
    });
    expect(
      arrangementUnits(
        grouped,
        members.map(node => node.id)
      )
    ).toHaveLength(3);
    const original = members.map(node => worldBounds(grouped, node));
    const selection = {
      left: Math.min(...original.map(bounds => bounds.left)),
      right: Math.max(...original.map(bounds => bounds.right)),
      top: Math.min(...original.map(bounds => bounds.top)),
      bottom: Math.max(...original.map(bounds => bounds.bottom)),
    };
    for (const [direction, edge, expected] of [
      ['left', 'left', selection.left],
      ['center', 'centerX', (selection.left + selection.right) / 2],
      ['right', 'right', selection.right],
      ['top', 'top', selection.top],
      ['middle', 'centerY', (selection.top + selection.bottom) / 2],
      ['bottom', 'bottom', selection.bottom],
    ] as const) {
      const aligned = applyStudioCommandV3(grouped, {
        type: 'alignNodes',
        nodeIds: members.map(node => node.id),
        direction,
        reference: 'selection',
      });
      for (const member of members) {
        const bounds = worldBounds(
          aligned,
          aligned.nodes.find(node => node.id === member.id)!
        );
        const actual =
          edge === 'centerX'
            ? (bounds.left + bounds.right) / 2
            : edge === 'centerY'
              ? (bounds.top + bounds.bottom) / 2
              : bounds[edge];
        expect(actual).toBeCloseTo(expected);
      }
    }
  });

  it('keeps a group together when other objects are selected', () => {
    const document = scene();
    const [, , first, second, third] = document.nodes;
    const grouped = applyStudioCommandV3(document, {
      type: 'groupNodes',
      nodeIds: [first.id, second.id],
      groupId: crypto.randomUUID(),
    });
    const ids = [first.id, second.id, third.id];
    expect(arrangementUnits(grouped, ids)).toHaveLength(2);
    const before = [first, second].map(node => worldBounds(grouped, node).left);
    const aligned = applyStudioCommandV3(grouped, {
      type: 'alignNodes',
      nodeIds: ids,
      direction: 'right',
      reference: 'selection',
    });
    const after = [first, second].map(
      node =>
        worldBounds(
          aligned,
          aligned.nodes.find(candidate => candidate.id === node.id)!
        ).left
    );
    expect(after[0] - before[0]).toBeCloseTo(after[1] - before[1]);
    expect(after[1] - after[0]).toBeCloseTo(before[1] - before[0]);
  });

  it('distributes the members of a lone group on both axes', () => {
    const document = scene();
    const members = document.nodes.slice(2);
    members[0].transform.x = 0;
    members[1].transform.x = 55;
    members[2].transform.x = 260;
    members[0].transform.y = 0;
    members[1].transform.y = 45;
    members[2].transform.y = 220;
    const grouped = applyStudioCommandV3(document, {
      type: 'groupNodes',
      nodeIds: members.map(node => node.id),
      groupId: crypto.randomUUID(),
    });
    for (const [axis, near, far] of [
      ['horizontal', 'left', 'right'],
      ['vertical', 'top', 'bottom'],
    ] as const) {
      const arranged = applyStudioCommandV3(grouped, {
        type: 'distributeNodes',
        nodeIds: members.map(node => node.id),
        axis,
        reference: 'selection',
      });
      const bounds = members
        .map(node =>
          worldBounds(
            arranged,
            arranged.nodes.find(candidate => candidate.id === node.id)!
          )
        )
        .sort((a, b) => a[near] - b[near]);
      expect(bounds[1][near] - bounds[0][far]).toBeCloseTo(bounds[2][near] - bounds[1][far]);
    }
  });

  it('distinguishes a nested parent frame from the visible canvas and spans two objects', () => {
    const document = scene();
    const viewBounds = { left: -75, top: 35, right: 450, bottom: 700 };
    const nested = document.nodes[2];
    nested.transform.x = 60;
    nested.transform.width = 240;
    nested.transform.height = 180;
    const children = [10, 90].map(x =>
      createFrameNode('custom', {
        parentFrameId: nested.id,
        transform: { x, y: 10, width: 40, height: 40, rotation: 0 },
      })
    );
    document.nodes.push(...children);
    const ids = children.map(node => node.id);
    const frameAligned = applyStudioCommandV3(document, {
      type: 'alignNodes',
      nodeIds: ids,
      direction: 'left',
      reference: 'frame',
    });
    const viewAligned = applyStudioCommandV3(document, {
      type: 'alignNodes',
      nodeIds: ids,
      direction: 'left',
      reference: 'view',
      viewBounds,
    });
    expect(
      worldBounds(
        frameAligned,
        frameAligned.nodes.find(node => node.id === ids[0])!
      ).left
    ).toBeCloseTo(160);
    expect(
      worldBounds(
        viewAligned,
        viewAligned.nodes.find(node => node.id === ids[0])!
      ).left
    ).toBeCloseTo(-75);
    const frameResult = applyStudioCommandV3(document, {
      type: 'distributeNodes',
      nodeIds: ids,
      axis: 'horizontal',
      reference: 'frame',
    });
    const viewResult = applyStudioCommandV3(document, {
      type: 'distributeNodes',
      nodeIds: ids,
      axis: 'horizontal',
      reference: 'view',
      viewBounds,
    });
    const frameBounds = children.map(node =>
      worldBounds(
        frameResult,
        frameResult.nodes.find(item => item.id === node.id)!
      )
    );
    const visibleBounds = children.map(node =>
      worldBounds(
        viewResult,
        viewResult.nodes.find(item => item.id === node.id)!
      )
    );
    expect(frameBounds[0].left).toBeCloseTo(worldBounds(document, nested).left);
    expect(frameBounds[1].right).toBeCloseTo(worldBounds(document, nested).right);
    expect(visibleBounds[0].left).toBeCloseTo(viewBounds.left);
    expect(visibleBounds[1].right).toBeCloseTo(viewBounds.right);
  });

  it('uses the visible canvas for objects with different parent frames', () => {
    const document = scene();
    const ids = [document.nodes[1].id, document.nodes[2].id];
    const units = arrangementUnits(document, ids);
    const viewBounds = { left: -50, top: -30, right: 750, bottom: 500 };
    expect(arrangementReferenceBounds(document, units, 'frame')).toBeNull();
    const aligned = applyStudioCommandV3(document, {
      type: 'alignNodes',
      nodeIds: ids,
      direction: 'top',
      reference: 'view',
      viewBounds,
    });
    expect(
      ids.map(
        id =>
          worldBounds(
            aligned,
            aligned.nodes.find(node => node.id === id)!
          ).top
      )
    ).toEqual([-30, -30]);
    const distributed = applyStudioCommandV3(document, {
      type: 'distributeNodes',
      nodeIds: ids,
      axis: 'vertical',
      reference: 'view',
      viewBounds,
    });
    const bounds = ids.map(id =>
      worldBounds(
        distributed,
        distributed.nodes.find(node => node.id === id)!
      )
    );
    expect(Math.min(...bounds.map(item => item.top))).toBeCloseTo(viewBounds.top);
    expect(Math.max(...bounds.map(item => item.bottom))).toBeCloseTo(viewBounds.bottom);
  });

  it('preserves nested semantic group IDs through legacy edits', () => {
    const document = legacyDocumentToV3(createDocument('single', 'Groups'));
    const text = document.nodes.find(node => node.type === 'richText');
    if (!text) throw new Error('Missing text node');
    const groups = [crypto.randomUUID(), crypto.randomUUID()];
    text.groupIds = groups;
    const legacy = v3DocumentToLegacy(document);
    const element = legacy.pages[0].elements.find(item => item.id === text.id);
    if (!element) throw new Error('Missing projected element');
    element.x += 10;
    const restored = legacyDocumentToV3(legacy, document);
    expect(restored.nodes.find(node => node.id === text.id)?.groupIds).toEqual(groups);
  });

  it('duplicates a frame with its descendants as one independent hierarchy', () => {
    const document = scene();
    const [frame, , child] = document.nodes;
    const groupId = crypto.randomUUID();
    frame.groupIds = [groupId];
    child.groupIds = [groupId];
    const duplicated = applyStudioCommandV3(document, {
      type: 'duplicateNodes',
      nodeIds: [frame.id],
    });
    const copy = duplicated.nodes.find(
      node =>
        node.id !== frame.id &&
        node.type === 'frame' &&
        node.parentFrameId === null &&
        node.transform.x === frame.transform.x + 24
    );
    expect(copy).toBeDefined();
    expect(copy?.groupIds[0]).not.toBe(groupId);
    const childCopy = duplicated.nodes.find(node => node.parentFrameId === copy?.id);
    expect(childCopy?.transform.x).toBe(child.transform.x);
    expect(childCopy?.id).not.toBe(child.id);
  });
});
