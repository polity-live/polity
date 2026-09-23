import type { StudioDocumentV3, StudioNode } from './document-v3';

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
