import { expect, it } from 'vitest';
import { createFrameNode, createStudioDocumentV3 } from '../document-v3';
import {
  canvasMarqueeSelectionIds,
  canvasSelectionIds,
  drillIntoGroup,
  emptyStudioSelection,
  groupMembers,
  toggleSelection,
} from '../studio-selection';

it('toggles outer groups, drills into nested groups, and skips locked nodes', () => {
  const document = createStudioDocumentV3('Selection');
  const outer = crypto.randomUUID(),
    inner = crypto.randomUUID();
  const first = createFrameNode('custom', { groupIds: [outer, inner] });
  const second = createFrameNode('custom', { groupIds: [outer, inner] });
  const locked = createFrameNode('custom', { groupIds: [outer], locked: true });
  document.nodes.push(first, second, locked);
  expect(groupMembers(document, first.id)).toEqual([first.id, second.id]);
  const selected = toggleSelection(document, emptyStudioSelection(), first.id, false);
  expect(selected.nodeIds).toEqual([first.id, second.id]);
  expect(toggleSelection(document, selected, first.id, true).nodeIds).toEqual([]);
  const deeper = drillIntoGroup(document, selected);
  expect(deeper.groupDepth).toBe(1);
  expect(deeper.nodeIds).toEqual([first.id, second.id]);
  expect(toggleSelection(document, deeper, locked.id, true)).toBe(deeper);
});

it('selects fully enclosed visible unlocked nodes in either drag direction and adds to a previous selection', () => {
  const document = createStudioDocumentV3('Marquee');
  const inside = createFrameNode('custom');
  const crossing = createFrameNode('custom');
  const hidden = createFrameNode('custom', { visible: false });
  const locked = createFrameNode('custom', { locked: true });
  for (const [node, x] of [
    [inside, 10],
    [crossing, 45],
    [hidden, 12],
    [locked, 14],
  ] as const)
    node.transform = { ...node.transform, x, y: 10, width: 20, height: 20 };
  document.nodes.push(inside, crossing, hidden, locked);
  const ids = document.nodes.map(node => node.id);
  expect(
    canvasMarqueeSelectionIds(document, ids, { left: 0, top: 0, right: 50, bottom: 50 })
  ).toEqual([inside.id]);
  expect(
    canvasMarqueeSelectionIds(document, ids, { left: 50, top: 50, right: 0, bottom: 0 }, [
      crossing.id,
    ])
  ).toEqual([crossing.id, inside.id]);
});

it('requires a complete editable group and includes enclosed frame descendants', () => {
  const document = createStudioDocumentV3('Marquee groups');
  const groupId = crypto.randomUUID();
  const first = createFrameNode('custom', { groupIds: [groupId] });
  const second = createFrameNode('custom', { groupIds: [groupId] });
  first.transform = { ...first.transform, x: 10, y: 10, width: 20, height: 20 };
  second.transform = { ...second.transform, x: 40, y: 10, width: 20, height: 20 };
  document.nodes.push(first, second);
  const ids = document.nodes.map(node => node.id);
  expect(
    canvasMarqueeSelectionIds(document, ids, { left: 0, top: 0, right: 35, bottom: 40 })
  ).toEqual([]);
  expect(
    canvasMarqueeSelectionIds(document, ids, { left: 0, top: 0, right: 65, bottom: 40 })
  ).toEqual([first.id, second.id]);
  second.locked = true;
  expect(
    canvasMarqueeSelectionIds(document, ids, { left: 0, top: 0, right: 65, bottom: 40 })
  ).toEqual([]);

  const parent = createFrameNode('custom');
  parent.transform = { ...parent.transform, x: 100, y: 100, width: 100, height: 100 };
  const child = createFrameNode('custom', { parentFrameId: parent.id });
  child.transform = { ...child.transform, x: 20, y: 20, width: 20, height: 20 };
  document.nodes.push(parent, child);
  expect(
    canvasMarqueeSelectionIds(document, [...ids, parent.id, child.id], {
      left: 90,
      top: 90,
      right: 210,
      bottom: 210,
    })
  ).toEqual([parent.id, child.id]);
});

it('selects and shift-toggles complete canvas groups while retaining locked members', () => {
  const document = createStudioDocumentV3('Canvas groups');
  const groupId = crypto.randomUUID();
  const first = createFrameNode('custom', { groupIds: [groupId] });
  const locked = createFrameNode('custom', { groupIds: [groupId], locked: true });
  const other = createFrameNode('custom');
  document.nodes.push(first, locked, other);
  expect(canvasSelectionIds(document, [], first.id, false)).toEqual([first.id, locked.id]);
  expect(canvasSelectionIds(document, [other.id], first.id, true)).toEqual([
    other.id,
    first.id,
    locked.id,
  ]);
  expect(canvasSelectionIds(document, [other.id, first.id, locked.id], locked.id, true)).toEqual([
    other.id,
  ]);
});
