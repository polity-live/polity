import { describe, expect, it } from 'vitest';
import { applyStudioCommandV3 } from '../commands-v3';
import { createFrameNode, createStudioDocumentV3, type StudioDocumentV3 } from '../document-v3';
import { selectionUnits, worldBounds } from '../selection-geometry';
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
