import { expect, it } from 'vitest';
import { createFrameNode, createStudioDocumentV3 } from '../document-v3';
import {
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
