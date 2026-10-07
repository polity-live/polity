import { expect, it, vi } from 'vitest';
import { defaultBrand } from '../document';
import { createStudioTemplateDocumentV5 } from '../templates-v5';
import { studioDocumentV3Schema } from '../document-v3';
import {
  updateStudioNode,
  updateStudioNodeConstraint,
  updateStudioShapeArrowhead,
} from '../studio-node-updates';

function fixture() {
  const document = createStudioTemplateDocumentV5('single', 'Node property updates', defaultBrand);
  const frame = document.nodes.find(node => node.type === 'frame')!;
  const shape = document.nodes.find(node => node.type === 'shape')!;
  return { document, frame, shape };
}

it('updates the current canonical node and leaves every other node unchanged', () => {
  const { document, shape } = fixture();
  const before = structuredClone(document.nodes);
  updateStudioNode(document, shape.id, node => {
    node.name = 'Updated current node';
  });
  expect(document.nodes).toEqual(
    before.map(node => (node.id === shape.id ? { ...node, name: 'Updated current node' } : node))
  );
  studioDocumentV3Schema.parse(document);
});

it('does not call a pending property change after its canonical target has been deleted', () => {
  const { document, shape } = fixture();
  document.nodes = document.nodes.filter(node => node.id !== shape.id);
  const before = structuredClone(document),
    change = vi.fn();
  updateStudioNode(document, shape.id, change);
  expect(change).not.toHaveBeenCalled();
  expect(document).toEqual(before);
  studioDocumentV3Schema.parse(document);
});

it.each(['startArrowhead', 'endArrowhead'] as const)(
  'changes only the %s on the current arrow shape',
  key => {
    const { document, shape } = fixture();
    shape.shape = 'arrow';
    const before = structuredClone(shape);
    updateStudioShapeArrowhead(document, shape.id, key, 'triangle');
    expect(shape).toEqual({ ...before, [key]: 'triangle' });
    studioDocumentV3Schema.parse(document);
  }
);

it.each(['deleted', 'replaced by a frame'] as const)(
  'ignores an old arrowhead event when its target has been %s',
  kind => {
    const { document, frame, shape } = fixture();
    if (kind === 'deleted') document.nodes = document.nodes.filter(node => node.id !== shape.id);
    else
      document.nodes = document.nodes.map(node =>
        node.id === shape.id
          ? {
              ...structuredClone(frame),
              id: shape.id,
              parentFrameId: frame.id,
              zIndex: shape.zIndex,
            }
          : node
      );
    const before = structuredClone(document);
    updateStudioShapeArrowhead(document, shape.id, 'endArrowhead', 'arrow');
    expect(document).toEqual(before);
    studioDocumentV3Schema.parse(document);
  }
);

it.each(['horizontal', 'vertical'] as const)(
  'updates the %s constraint while preserving the other axis and geometry',
  axis => {
    const { document, shape } = fixture();
    const before = structuredClone(shape);
    updateStudioNodeConstraint(document, shape.id, axis, 'scale');
    expect(shape).toEqual({ ...before, constraints: { ...before.constraints, [axis]: 'scale' } });
    studioDocumentV3Schema.parse(document);
  }
);

it('ignores a constraint event after a node deletion', () => {
  const { document, shape } = fixture();
  document.nodes = document.nodes.filter(node => node.id !== shape.id);
  const before = structuredClone(document);
  updateStudioNodeConstraint(document, shape.id, 'horizontal', 'right');
  expect(document).toEqual(before);
  studioDocumentV3Schema.parse(document);
});
