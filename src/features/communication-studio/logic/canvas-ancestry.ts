import type { StudioNode } from './document-v3';

/** Return the available outer-to-inner ancestry, including partial scene snapshots. */
export function studioCanvasAncestors(nodes: readonly StudioNode[], parentId: string | null) {
  const ancestors: StudioNode[] = [];
  while (parentId) {
    const parent = nodes.find(candidate => candidate.id === parentId);
    if (!parent) break;
    ancestors.unshift(parent);
    parentId = parent.parentFrameId;
  }
  return ancestors;
}
