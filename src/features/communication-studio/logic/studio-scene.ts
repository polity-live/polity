import type { StudioDocumentV3, StudioNode } from './document-v3';

/** The Layers panel displays the reverse of this order: the last sibling paints on top. */
export function studioSceneChildren(document: StudioDocumentV3, parentFrameId: string | null) {
  return document.nodes
    .filter(
      node =>
        node.parentFrameId === parentFrameId &&
        node.visible &&
        (parentFrameId !== null || node.id !== document.masterLayout.frameId)
    )
    .sort((a, b) => a.zIndex - b.zIndex || a.id.localeCompare(b.id));
}

/** Paint order is shared by the editor, preview, exports and the active text overlay. */
export function studioScenePaintOrder(
  document: StudioDocumentV3,
  rootFrameId?: string
): StudioNode[] {
  const result: StudioNode[] = [];
  const visit = (parentFrameId: string | null) => {
    for (const node of studioSceneChildren(document, parentFrameId)) {
      result.push(node);
      if (node.type === 'frame') visit(node.id);
    }
  };
  if (rootFrameId) {
    const root = document.nodes.find(node => node.id === rootFrameId && node.type === 'frame');
    if (root?.visible) {
      result.push(root);
      visit(root.id);
    }
  } else visit(null);
  return result;
}
