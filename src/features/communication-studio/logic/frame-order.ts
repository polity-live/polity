import type { FrameNode, StudioDocumentV3 } from './document-v3';

export function compareStudioFrames(left: FrameNode, right: FrameNode) {
  return left.zIndex - right.zIndex || left.id.localeCompare(right.id);
}

export function getStudioRootFramesInLayerOrder(document: StudioDocumentV3): FrameNode[] {
  return document.nodes
    .filter(
      (node): node is FrameNode =>
        node.type === 'frame' &&
        node.parentFrameId === null &&
        node.id !== document.masterLayout.frameId
    )
    .sort(compareStudioFrames);
}
