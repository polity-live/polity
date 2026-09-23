import { expect, it } from 'vitest';
import { defaultBrand } from '../document';
import { createStudioTemplateDocumentV5 } from '../templates-v5';
import { diffStudio } from '../operations';
import { worldBounds } from '../selection-geometry';
import { buildProposalAnnotations } from '../change-request-annotations';
import type { CanvasProposal } from '../governance';

function proposal(id: string): CanvasProposal {
  return {
    id,
    title: id,
    reason: '',
    owner_id: 'author',
    shared_ids: [],
    revision: 1,
    base_revision: 0,
    state: 'submitted',
    decision: null,
    application: 'pending',
    resolves_id: null,
    deadline: null,
    electorate: null,
    votes: [],
    changes: [],
  };
}

it('classifies complete node additions, removals and edits without duplicating a node marker', () => {
  const original = createStudioTemplateDocumentV5('single', 'Annotations', defaultBrand);
  const frame = original.nodes.find(node => node.type === 'frame')!;
  const shape = original.nodes.find(node => node.type === 'shape')!;
  const proposed = structuredClone(original);
  const added = structuredClone(shape);
  added.id = crypto.randomUUID();
  added.parentFrameId = frame.id;
  added.transform.x += 100;
  proposed.nodes.push(added);
  proposed.nodes = proposed.nodes.filter(node => node.id !== shape.id);
  const edited = proposed.nodes.find(node => node.type === 'richText')!;
  edited.name = 'New label';
  edited.transform.y += 20;
  const changes = diffStudio(original, proposed);
  const annotations = buildProposalAnnotations({
    proposal: proposal('first'),
    changes,
    canonicalDocument: original,
    displayedDocument: original,
    selected: false,
  });
  expect(annotations).toHaveLength(3);
  expect(Object.fromEntries(annotations.map(item => [item.nodeId, item.tone]))).toEqual({
    [added.id]: 'add',
    [shape.id]: 'remove',
    [edited.id]: 'update',
  });
  expect(annotations.find(item => item.nodeId === added.id)?.sourceDocument.nodes).toContainEqual(
    added
  );
  expect(annotations.find(item => item.nodeId === shape.id)?.sourceDocument.nodes).toContainEqual(
    shape
  );
});

it('keeps nested added nodes anchored to their proposed frame and selects one proposal', () => {
  const original = createStudioTemplateDocumentV5('single', 'Nested annotations', defaultBrand);
  const frame = original.nodes.find(node => node.type === 'frame')!;
  const shape = original.nodes.find(node => node.type === 'shape')!;
  const proposed = structuredClone(original);
  const nestedFrame = structuredClone(frame);
  nestedFrame.id = crypto.randomUUID();
  nestedFrame.parentFrameId = frame.id;
  nestedFrame.transform = { ...nestedFrame.transform, x: 85, y: 45, width: 250, height: 180 };
  const nestedShape = structuredClone(shape);
  nestedShape.id = crypto.randomUUID();
  nestedShape.parentFrameId = nestedFrame.id;
  nestedShape.transform = { ...nestedShape.transform, x: 25, y: 30, width: 40, height: 35 };
  proposed.nodes.push(nestedFrame, nestedShape);
  const changes = diffStudio(original, proposed);
  const annotations = buildProposalAnnotations({
    proposal: proposal('selected'),
    changes,
    canonicalDocument: original,
    displayedDocument: proposed,
    selected: true,
  });
  const child = annotations.find(item => item.nodeId === nestedShape.id)!;
  expect(child.selected).toBe(true);
  expect(child.sourceDocument).toBe(proposed);
  expect(worldBounds(child.sourceDocument, nestedShape).left).toBeGreaterThan(
    nestedFrame.transform.x
  );
});
