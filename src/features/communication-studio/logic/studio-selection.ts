import type { StudioDocumentV3, StudioNode } from './document-v3';
import { worldBounds, type Bounds } from './selection-geometry';

export interface StudioSelectionState {
  nodeIds: string[];
  primaryId: string | null;
  groupDepth: number;
  touchMode: boolean;
}

export const emptyStudioSelection = (): StudioSelectionState => ({
  nodeIds: [],
  primaryId: null,
  groupDepth: 0,
  touchMode: false,
});

export function selectableNode(node: StudioNode): boolean {
  return node.visible && !node.locked;
}

export function groupMembers(document: StudioDocumentV3, nodeId: string, depth = 0): string[] {
  const node = document.nodes.find(candidate => candidate.id === nodeId);
  if (!node || !selectableNode(node)) return [];
  const groupId = node.groupIds[depth];
  if (!groupId) return [nodeId];
  return document.nodes
    .filter(candidate => selectableNode(candidate) && candidate.groupIds[depth] === groupId)
    .map(candidate => candidate.id);
}

/** Canvas clicks select a complete outer group, including locked members so they can be unlocked. */
export function canvasSelectionIds(
  document: StudioDocumentV3,
  selected: string[],
  nodeId: string,
  additive: boolean
): string[] {
  const node = document.nodes.find(candidate => candidate.id === nodeId);
  if (!node) return selected;
  const groupId = node.groupIds[0];
  const members = groupId
    ? document.nodes
        .filter(candidate => candidate.groupIds[0] === groupId)
        .map(candidate => candidate.id)
    : [nodeId];
  if (!additive) return members;
  const memberIds = new Set(members);
  if (members.every(id => selected.includes(id))) return selected.filter(id => !memberIds.has(id));
  return [...new Set([...selected, ...members])];
}

/** A marquee selects only complete, editable outer groups and fully enclosed nodes. */
export function canvasMarqueeSelectionIds(
  document: StudioDocumentV3,
  visibleIds: readonly string[],
  area: Bounds,
  previous: readonly string[] = []
): string[] {
  const rect = {
    left: Math.min(area.left, area.right),
    right: Math.max(area.left, area.right),
    top: Math.min(area.top, area.bottom),
    bottom: Math.max(area.top, area.bottom),
  };
  const visible = new Set(visibleIds);
  const inside = (node: StudioNode) => {
    if (!visible.has(node.id) || !selectableNode(node)) return false;
    const bounds = worldBounds(document, node);
    return (
      bounds.left >= rect.left &&
      bounds.right <= rect.right &&
      bounds.top >= rect.top &&
      bounds.bottom <= rect.bottom
    );
  };
  const selected = new Set<string>();
  const visitedGroups = new Set<string>();
  for (const node of document.nodes) {
    if (!visible.has(node.id)) continue;
    const groupId = node.groupIds[0];
    if (!groupId) {
      if (inside(node)) selected.add(node.id);
      continue;
    }
    if (visitedGroups.has(groupId)) continue;
    visitedGroups.add(groupId);
    const members = document.nodes.filter(member => member.groupIds[0] === groupId);
    if (members.every(inside)) members.forEach(member => selected.add(member.id));
  }
  return [...new Set([...previous, ...selected])];
}

export function toggleSelection(
  document: StudioDocumentV3,
  current: StudioSelectionState,
  nodeId: string,
  additive: boolean
): StudioSelectionState {
  const members = groupMembers(document, nodeId, current.groupDepth);
  if (!members.length) return current;
  if (!additive) return { ...current, nodeIds: members, primaryId: nodeId };
  const old = new Set(current.nodeIds);
  const remove = members.every(id => old.has(id));
  for (const id of members) {
    if (remove) old.delete(id);
    else old.add(id);
  }
  const nodeIds = [...old];
  return {
    ...current,
    nodeIds,
    primaryId: nodeIds.includes(current.primaryId ?? '') ? current.primaryId : (nodeIds[0] ?? null),
  };
}

export function drillIntoGroup(
  document: StudioDocumentV3,
  current: StudioSelectionState
): StudioSelectionState {
  const primary = document.nodes.find(node => node.id === current.primaryId);
  if (!primary || !primary.groupIds[current.groupDepth]) return current;
  const nextDepth = current.groupDepth + 1;
  return {
    ...current,
    groupDepth: nextDepth,
    nodeIds: groupMembers(document, primary.id, nextDepth),
  };
}
