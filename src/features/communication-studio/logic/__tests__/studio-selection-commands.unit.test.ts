import { expect, it, vi } from 'vitest';
import { defaultBrand } from '../document';
import { createStudioTemplateDocumentV5 } from '../templates-v5';
import { studioDocumentV3Schema, type StudioDocumentV3 } from '../document-v3';
import {
  alignStudioSelection,
  distributeStudioSelection,
  toggleStudioSelectionLock,
  cutStudioSelection,
} from '../studio-selection-commands';

function fixture() {
  const document = createStudioTemplateDocumentV5('single', 'Selection operations', defaultBrand);
  const frame = document.nodes.find(node => node.type === 'frame')!;
  const original = document.nodes.find(node => node.type === 'shape')!;
  const shapes = [10, 90, 230].map((x, index) => ({
    ...structuredClone(original),
    id: crypto.randomUUID(),
    transform: { ...original.transform, x, y: x, width: 20, height: 20 },
    zIndex: index + 1,
  }));
  document.nodes = [frame, ...shapes];
  const value = studioDocumentV3Schema.parse(document);
  const transact = vi.fn((change: (document: StudioDocumentV3) => void) => change(value));
  const selection = {
    nodeIds: shapes.map<string>(node => node.id),
    locked: false,
    referenceAvailable: true,
    reference: 'selection' as const,
    groupDepth: 0,
    transact,
  };
  return { value, transact, selection, shapes, frame };
}

it('locks and unlocks the selected nodes while keeping unselected nodes unchanged', () => {
  const { value, shapes, frame, transact } = fixture();
  toggleStudioSelectionLock({
    selectedNodes: value.nodes.filter(node =>
      shapes.slice(0, 2).some(shape => shape.id === node.id)
    ),
    fullyLocked: false,
    transact,
  });
  expect(value.nodes.filter(node => node.locked).map(node => node.id)).toEqual(
    shapes.slice(0, 2).map(node => node.id)
  );
  toggleStudioSelectionLock({
    selectedNodes: value.nodes.filter(node => node.locked),
    fullyLocked: true,
    transact,
  });
  expect(value.nodes.every(node => !node.locked)).toBe(true);
  expect(value.nodes.find(node => node.id === frame.id)).toEqual(frame);
});

it('does not transact for an empty lock or cut selection', () => {
  const { transact } = fixture();
  toggleStudioSelectionLock({ selectedNodes: [], fullyLocked: false, transact });
  cutStudioSelection([], transact);
  expect(transact).not.toHaveBeenCalled();
});

it('changes only unlocked members of a mixed lock selection', () => {
  const { value, selection, transact } = fixture();
  value.nodes[1].locked = true;
  toggleStudioSelectionLock({
    selectedNodes: value.nodes.filter(node => selection.nodeIds.includes(node.id)),
    fullyLocked: false,
    transact,
  });
  expect(value.nodes.slice(1).every(node => node.locked)).toBe(true);
  expect(transact).toHaveBeenCalledOnce();
});

it.each(['empty', 'locked', 'unavailable'] as const)(
  'leaves geometry unchanged when alignment is %s',
  reason => {
    const { value, selection, transact } = fixture();
    const before = structuredClone(value);
    alignStudioSelection({
      ...selection,
      direction: 'left',
      nodeIds: reason === 'empty' ? [] : selection.nodeIds,
      locked: reason === 'locked',
      referenceAvailable: reason !== 'unavailable',
    });
    expect(value).toEqual(before);
    expect(transact).not.toHaveBeenCalled();
  }
);

it.each(['selection', 'view'] as const)(
  'aligns the actual selected shapes against the %s bounds',
  reference => {
    const { value, selection } = fixture();
    alignStudioSelection({
      ...selection,
      reference,
      viewBounds: { left: 300, top: 300, right: 600, bottom: 600 },
      direction: 'left',
    });
    expect(value.nodes.slice(1).map(node => node.transform.x)).toEqual([
      reference === 'view' ? 300 : 10,
      reference === 'view' ? 300 : 10,
      reference === 'view' ? 300 : 10,
    ]);
  }
);

it.each(['too few selection units', 'too few view units', 'locked', 'unavailable'] as const)(
  'does not distribute with %s',
  reason => {
    const { value, selection, transact } = fixture();
    const before = structuredClone(value);
    distributeStudioSelection({
      ...selection,
      axis: 'horizontal',
      unitCount: reason.startsWith('too few') ? 1 : 3,
      reference: reason === 'too few view units' ? 'view' : 'selection',
      locked: reason === 'locked',
      referenceAvailable: reason !== 'unavailable',
    });
    expect(value).toEqual(before);
    expect(transact).not.toHaveBeenCalled();
  }
);

it.each(['selection', 'view'] as const)(
  'distributes actual shapes evenly against the %s bounds',
  reference => {
    const { value, selection } = fixture();
    distributeStudioSelection({
      ...selection,
      reference,
      unitCount: 3,
      axis: 'horizontal',
      viewBounds: { left: 300, top: 300, right: 600, bottom: 600 },
    });
    expect(value.nodes.slice(1).map(node => node.transform.x)).toEqual(
      reference === 'view' ? [300, 440, 580] : [10, 120, 230]
    );
  }
);

it('cuts only the selected nodes and preserves the frame and remaining content', () => {
  const { value, shapes, transact } = fixture();
  cutStudioSelection([shapes[0].id], transact);
  expect(value.nodes.map(node => node.id)).not.toContain(shapes[0].id);
  expect(value.nodes.map(node => node.id)).toContain(shapes[1].id);
  studioDocumentV3Schema.parse(value);
});
