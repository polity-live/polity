import type { StudioDocumentV3, StudioNode } from './document-v3';

export function updateStudioNode(
  document: StudioDocumentV3,
  nodeId: string,
  change: (node: StudioNode) => void
) {
  const node = document.nodes.find(candidate => candidate.id === nodeId);
  if (node) change(node);
}

export function updateStudioShapeArrowhead(
  document: StudioDocumentV3,
  nodeId: string,
  key: 'startArrowhead' | 'endArrowhead',
  value: Extract<StudioNode, { type: 'shape' }>['startArrowhead']
) {
  updateStudioNode(document, nodeId, node => {
    if (node.type === 'shape') node[key] = value;
  });
}

export function updateStudioNodeConstraint<Key extends 'horizontal' | 'vertical'>(
  document: StudioDocumentV3,
  nodeId: string,
  axis: Key,
  value: StudioNode['constraints'][Key]
) {
  updateStudioNode(document, nodeId, node => {
    node.constraints[axis] = value;
  });
}
