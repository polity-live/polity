import { describe, expect, it } from 'vitest';
import {
  applyStudioCommandV3,
  canMoveStudioLayer,
  snapToGrid,
  type StudioCommandV3,
} from '../commands-v3';
import {
  createFrameNode,
  createStudioDocumentV3,
  shapeNodeSchema,
  deliverableSchema,
  type StudioNode,
} from '../document-v3';
import { createStudioNodeFromElement } from '../create-studio-node';
import { element } from '../document';

function fixture() {
  const document = createStudioDocumentV3('Command safety');
  const first = createFrameNode('custom', {
    name: 'First',
    transform: { x: 100, y: 200, width: 100, height: 100 },
    zIndex: 0,
  });
  const second = createFrameNode('custom', {
    name: 'Second',
    transform: { x: 500, y: 600, width: 100, height: 100 },
    zIndex: 1,
  });
  const shapes = [10, 40, 80].map((x, index) =>
    shapeNodeSchema.parse({
      id: crypto.randomUUID(),
      type: 'shape',
      shape: 'rectangle',
      name: `Shape ${index}`,
      parentFrameId: first.id,
      transform: { x, y: 20 + index * 30, width: 10, height: 10 },
      zIndex: index,
      style: {},
    })
  );
  document.nodes.push(first, second, ...shapes);
  return { document, first, second, shapes };
}
function find(result: ReturnType<typeof fixture>['document'], id: string) {
  return result.nodes.find(node => node.id === id)!;
}

describe('canonical Studio command safety and atomic edits', () => {
  it.each([
    ['default', 19, undefined, 16],
    ['custom', 19, 5, 20],
    ['zero', 19, 0, 19],
    ['negative', 19, -2, 19],
    ['infinite grid', 19, Number.POSITIVE_INFINITY, 19],
    ['infinite value', Number.POSITIVE_INFINITY, 8, Number.POSITIVE_INFINITY],
    ['NaN', Number.NaN, 8, Number.NaN],
  ])('snaps %s grid values without corrupting invalid numbers', (_label, value, size, expected) => {
    expect(snapToGrid(value as number, size as number | undefined)).toBe(expected);
  });

  it('creates fresh nodes and transforms multiple selected nodes without changing its input', () => {
    const { document, first, shapes } = fixture();
    const original = structuredClone(document);
    const fresh = shapeNodeSchema.parse({ ...shapes[0], id: crypto.randomUUID(), name: 'New' });
    const created = applyStudioCommandV3(document, { type: 'createNodes', nodes: [fresh] });
    expect(created.nodes).toHaveLength(document.nodes.length + 1);
    const transforms = shapes.slice(0, 2).map((node, index) => ({
      nodeId: node.id,
      transform: { ...node.transform, x: 30 + index * 20, flipX: true },
    }));
    const changed = applyStudioCommandV3(document, { type: 'transformNodes', transforms });
    for (const item of transforms)
      expect(find(changed, item.nodeId).transform).toEqual(item.transform);
    expect(find(changed, first.id)).toEqual(first);
    expect(find(changed, shapes[2].id)).toEqual(shapes[2]);
    expect(document).toEqual(original);
  });

  it.each(['id', 'type', 'parentFrameId'])(
    'rejects updateNode identity field %s in favor of dedicated commands',
    field => {
      const { document, shapes } = fixture();
      expect(() =>
        applyStudioCommandV3(document, {
          type: 'updateNode',
          nodeId: shapes[0].id,
          patch: { [field]: field === 'type' ? 'frame' : crypto.randomUUID() },
        })
      ).toThrow('dedicated command');
    }
  );

  it('updates editable node properties and retains all unrelated nodes', () => {
    const { document, shapes } = fixture();
    const result = applyStudioCommandV3(document, {
      type: 'updateNode',
      nodeId: shapes[0].id,
      patch: { name: 'Renamed', visible: false },
    });
    expect(find(result, shapes[0].id)).toMatchObject({ name: 'Renamed', visible: false });
    expect(find(result, shapes[1].id)).toEqual(shapes[1]);
    expect(shapes[0].name).toBe('Shape 0');
  });

  it('rejects duplicate creation, duplicate selection, unknown nodes and locked mutations', () => {
    const { document, shapes } = fixture();
    expect(() =>
      applyStudioCommandV3(document, { type: 'createNodes', nodes: [shapes[0]] })
    ).toThrow('already exists');
    expect(() =>
      applyStudioCommandV3(document, { type: 'deleteNodes', nodeIds: [shapes[0].id, shapes[0].id] })
    ).toThrow('Duplicate node IDs');
    expect(() =>
      applyStudioCommandV3(document, { type: 'deleteNodes', nodeIds: [crypto.randomUUID()] })
    ).toThrow('Node not found');
    shapes[0].locked = true;
    expect(() =>
      applyStudioCommandV3(document, {
        type: 'updateNode',
        nodeId: shapes[0].id,
        patch: { name: 'Changed' },
      })
    ).toThrow('locked');
    expect(document.nodes).toHaveLength(5);
  });

  it('checks every structural layer move boundary including project masters', () => {
    const { document, first, second, shapes } = fixture();
    expect(canMoveStudioLayer(document, shapes[0].id, shapes[0].id, 'before')).toBe(false);
    expect(canMoveStudioLayer(document, 'missing', first.id, 'inside')).toBe(false);
    expect(canMoveStudioLayer(document, shapes[0].id, 'missing', 'inside')).toBe(false);
    shapes[0].locked = true;
    expect(canMoveStudioLayer(document, shapes[0].id, first.id, 'inside')).toBe(false);
    shapes[0].locked = false;
    expect(canMoveStudioLayer(document, shapes[0].id, first.id, 'inside')).toBe(true);
    expect(canMoveStudioLayer(document, first.id, second.id, 'inside')).toBe(false);
    expect(canMoveStudioLayer(document, shapes[0].id, shapes[1].id, 'inside')).toBe(false);
    expect(canMoveStudioLayer(document, first.id, shapes[0].id, 'before')).toBe(false);
    expect(canMoveStudioLayer(document, first.id, second.id, 'before')).toBe(true);
    second.parentFrameId = first.id;
    expect(canMoveStudioLayer(document, shapes[0].id, second.id, 'before')).toBe(false);
    expect(canMoveStudioLayer(document, first.id, second.id, 'before')).toBe(false);
    expect(canMoveStudioLayer(document, second.id, first.id, 'after')).toBe(false);
    second.parentFrameId = null;
    document.masterLayout.frameId = first.id;
    expect(canMoveStudioLayer(document, first.id, second.id, 'before')).toBe(false);
    expect(canMoveStudioLayer(document, shapes[0].id, first.id, 'inside')).toBe(false);
  });

  it.each(['before', 'after'] as const)(
    'detaches an element %s a root frame and preserves its world origin',
    position => {
      const { document, second, shapes } = fixture();
      const root = shapeNodeSchema.parse({
        ...shapes[1],
        id: crypto.randomUUID(),
        name: 'Existing root',
        parentFrameId: null,
      });
      document.nodes.push(root);
      const result = applyStudioCommandV3(document, {
        type: 'moveNode',
        nodeId: shapes[0].id,
        targetId: second.id,
        position,
      });
      expect(find(result, shapes[0].id)).toMatchObject({
        parentFrameId: null,
        transform: { x: 110, y: 220 },
        zIndex: position === 'before' ? 1 : 0,
      });
      expect(find(result, root.id).zIndex).toBe(position === 'before' ? 0 : 1);
      expect(shapes[0].parentFrameId).not.toBeNull();
    }
  );

  it('sorts tied root frames and tied element siblings deterministically', () => {
    const { document, first, second, shapes } = fixture();
    const third = createFrameNode('square', { name: 'Third', zIndex: 0 });
    second.zIndex = 0;
    document.nodes.push(third);
    const result = applyStudioCommandV3(document, {
      type: 'moveNode',
      nodeId: first.id,
      targetId: second.id,
      position: 'before',
    });
    expect(find(result, first.id).zIndex + 1).toBe(find(result, second.id).zIndex);
    shapes[1].zIndex = shapes[2].zIndex;
    const elementMove = applyStudioCommandV3(document, {
      type: 'moveNode',
      nodeId: shapes[0].id,
      targetId: shapes[1].id,
      position: 'after',
    });
    expect(find(elementMove, shapes[0].id).zIndex + 1).toBe(find(elementMove, shapes[1].id).zIndex);
  });

  it('reparents to a root canvas and repairs a stale source parent while preserving known coordinates', () => {
    const { document, first, second, shapes } = fixture();
    const root = applyStudioCommandV3(document, {
      type: 'reparentNodes',
      nodeIds: [shapes[0].id],
      parentFrameId: null,
    });
    expect(find(root, shapes[0].id)).toMatchObject({
      parentFrameId: null,
      transform: { x: 110, y: 220 },
    });
    shapes[0].parentFrameId = crypto.randomUUID();
    const repaired = applyStudioCommandV3(document, {
      type: 'reparentNodes',
      nodeIds: [shapes[0].id],
      parentFrameId: second.id,
    });
    expect(find(repaired, shapes[0].id)).toMatchObject({
      parentFrameId: second.id,
      transform: { x: -490, y: -580 },
    });
    expect(find(repaired, first.id)).toEqual(first);
  });

  it('rejects a corrupt incoming cyclic parent chain before moving a selected leaf', () => {
    const { document, first, second, shapes } = fixture();
    first.parentFrameId = second.id;
    second.parentFrameId = first.id;
    expect(() =>
      applyStudioCommandV3(document, {
        type: 'reparentNodes',
        nodeIds: [shapes[0].id],
        parentFrameId: null,
      })
    ).toThrow('Circular frame hierarchy');
  });

  it.each([
    ['left', 'top', 10, 20, 10, 10],
    ['right', 'bottom', 110, 220, 10, 10],
    ['center', 'center', 60, 120, 10, 10],
    ['left-right', 'top-bottom', 10, 20, 110, 210],
    ['scale', 'scale', 20, 60, 20, 30],
  ] as const)(
    'resizes with horizontal=%s and vertical=%s constraints',
    (horizontal, vertical, x, y, width, height) => {
      const { document, first, shapes } = fixture();
      shapes[0].constraints = { horizontal, vertical };
      const result = applyStudioCommandV3(document, {
        type: 'resizeFrame',
        frameId: first.id,
        transform: { ...first.transform, width: 200, height: 300 },
      });
      expect(find(result, shapes[0].id).transform).toMatchObject({ x, y, width, height });
    }
  );

  it('scales content explicitly, clamps stretched dimensions and recovers a zero-size old frame', () => {
    const { document, first, shapes } = fixture();
    const scaled = applyStudioCommandV3(document, {
      type: 'resizeFrame',
      frameId: first.id,
      scaleContent: true,
      transform: { ...first.transform, width: 200, height: 200 },
    });
    expect(find(scaled, shapes[0].id).transform).toMatchObject({
      x: 20,
      y: 40,
      width: 20,
      height: 20,
    });
    shapes[0].constraints = { horizontal: 'left-right', vertical: 'top-bottom' };
    const clamped = applyStudioCommandV3(document, {
      type: 'resizeFrame',
      frameId: first.id,
      transform: { ...first.transform, width: 1, height: 1 },
    });
    expect(find(clamped, shapes[0].id).transform).toMatchObject({ width: 1, height: 1 });
    first.transform.width = 0;
    first.transform.height = 0;
    const recovered = applyStudioCommandV3(document, {
      type: 'resizeFrame',
      frameId: first.id,
      scaleContent: true,
      transform: { ...first.transform, width: 100, height: 100 },
    });
    expect(find(recovered, shapes[0].id).transform).toEqual(shapes[0].transform);
    expect(() =>
      applyStudioCommandV3(document, {
        type: 'resizeFrame',
        frameId: shapes[0].id,
        transform: shapes[0].transform,
      })
    ).toThrow('not a frame');
  });

  it.each([
    ['front', [1, 2, 0]],
    ['back', [0, 1, 2]],
    ['forward', [1, 0, 2]],
    ['backward', [0, 1, 2]],
  ] as const)('reorders selection %s without losing siblings', (action, expected) => {
    const { document, shapes } = fixture();
    const result = applyStudioCommandV3(document, {
      type: 'reorderNodes',
      nodeIds: [shapes[0].id],
      action,
    });
    expect(
      result.nodes
        .filter(node => node.parentFrameId === shapes[0].parentFrameId)
        .sort((a, b) => a.zIndex - b.zIndex)
        .map(node => shapes.findIndex(shape => shape.id === node.id))
    ).toEqual(expected);
  });

  it('rejects mixed-parent stacking and resolves equal sibling z-index values', () => {
    const { document, second, shapes } = fixture();
    shapes[1].parentFrameId = second.id;
    expect(() =>
      applyStudioCommandV3(document, {
        type: 'reorderNodes',
        nodeIds: [shapes[0].id, shapes[1].id],
        action: 'front',
      })
    ).toThrow('stacking context');
    shapes[1].parentFrameId = shapes[0].parentFrameId;
    shapes[1].zIndex = shapes[2].zIndex;
    const result = applyStudioCommandV3(document, {
      type: 'reorderNodes',
      nodeIds: [shapes[0].id],
      action: 'backward',
    });
    expect(new Set(shapes.map(node => find(result, node.id).zIndex)).size).toBe(3);
  });

  it('groups complete existing groups, rejects partial groups and mismatched enclosing groups', () => {
    const { document, second, shapes } = fixture();
    const oldGroup = crypto.randomUUID();
    shapes[0].groupIds = [oldGroup];
    shapes[1].groupIds = [oldGroup];
    expect(() =>
      applyStudioCommandV3(document, {
        type: 'groupNodes',
        nodeIds: [shapes[0].id, shapes[2].id],
        groupId: crypto.randomUUID(),
      })
    ).toThrow('every member');
    const newGroup = crypto.randomUUID();
    const result = applyStudioCommandV3(document, {
      type: 'groupNodes',
      nodeIds: [shapes[0].id, shapes[1].id],
      groupId: newGroup,
    });
    expect(find(result, shapes[0].id).groupIds).toEqual([newGroup, oldGroup]);
    expect(() =>
      applyStudioCommandV3(document, {
        type: 'groupNodes',
        nodeIds: [shapes[0].id, shapes[1].id],
        groupId: oldGroup,
      })
    ).toThrow('already exists');
    shapes[1].parentFrameId = second.id;
    expect(() =>
      applyStudioCommandV3(document, {
        type: 'groupNodes',
        nodeIds: [shapes[0].id, shapes[1].id],
        groupId: newGroup,
      })
    ).toThrow('parent frame');
    shapes[1].parentFrameId = shapes[0].parentFrameId;
    shapes[1].groupIds = [crypto.randomUUID()];
    expect(() =>
      applyStudioCommandV3(document, {
        type: 'groupNodes',
        nodeIds: [shapes[0].id, shapes[1].id],
        groupId: newGroup,
        depth: 1,
      })
    ).toThrow('enclosing group');
  });

  it('updates visible, locked and nullable group state and ungroups all selected group members', () => {
    const { document, shapes } = fixture();
    const group = crypto.randomUUID();
    const grouped = applyStudioCommandV3(document, {
      type: 'setNodeState',
      nodeIds: [shapes[0].id, shapes[1].id],
      groupId: group,
      visible: false,
      locked: true,
    });
    const unlocked = applyStudioCommandV3(grouped, {
      type: 'setNodeState',
      nodeIds: [shapes[0].id, shapes[1].id],
      locked: false,
    });
    const ungrouped = applyStudioCommandV3(unlocked, {
      type: 'ungroupNodes',
      nodeIds: [shapes[0].id],
    });
    expect(find(ungrouped, shapes[1].id)).toMatchObject({
      groupIds: [],
      locked: false,
      visible: false,
    });
    expect(find(ungrouped, shapes[2].id)).toEqual(shapes[2]);
    expect(
      find(
        applyStudioCommandV3(unlocked, {
          type: 'setNodeState',
          nodeIds: [shapes[0].id],
          groupId: null,
        }),
        shapes[0].id
      ).groupIds
    ).toEqual([]);
    expect(
      find(
        applyStudioCommandV3(unlocked, {
          type: 'setNodeState',
          nodeIds: [shapes[0].id],
          groupId: group,
        }),
        shapes[0].id
      ).groupIds
    ).toEqual([group]);
  });

  it('duplicates table, chart and rich-text identities and remaps both selected and external shape bindings', () => {
    const { document, first, shapes } = fixture();
    const nested: StudioNode[] = ['table', 'chart', 'text'].map(kind =>
      createStudioNodeFromElement(element(kind as 'table' | 'chart' | 'text'), first.id, 0)
    );
    shapes[0].startBindingId = shapes[1].id;
    shapes[0].endBindingId = shapes[2].id;
    shapes[1].startBindingId = crypto.randomUUID();
    shapes[1].endBindingId = crypto.randomUUID();
    const plain = shapeNodeSchema.parse({ ...shapes[2], id: crypto.randomUUID(), name: 'Plain' });
    document.nodes.push(...nested, plain);
    const group = crypto.randomUUID();
    shapes[0].groupIds = [group];
    shapes[1].groupIds = [group];
    const result = applyStudioCommandV3(document, {
      type: 'duplicateNodes',
      nodeIds: [shapes[0].id, shapes[1].id, ...nested.map(node => node.id), plain.id],
    });
    const clones = result.nodes.filter(
      node => !document.nodes.some(original => original.id === node.id)
    );
    expect(clones).toHaveLength(6);
    const shapeClones = clones.filter(node => node.type === 'shape');
    expect(shapeClones[0]).toMatchObject({ startBindingId: shapeClones[1].id, endBindingId: null });
    expect(shapeClones[1]).toMatchObject({ startBindingId: null, endBindingId: null });
    expect(shapeClones[2]).toMatchObject({ startBindingId: null, endBindingId: null });
    expect(shapeClones[0].groupIds).toEqual(shapeClones[1].groupIds);
    expect(shapeClones[0].groupIds[0]).not.toBe(group);
    for (const node of clones) {
      expect(node.parentFrameId).toBe(first.id);
      expect(node.transform.x).toBe(
        find(document, document.nodes.find(original => original.name === node.name)!.id).transform
          .x + 24
      );
      if (node.type === 'richText') {
        const original = nested.find(candidate => candidate.type === 'richText')!;
        expect(JSON.stringify(node.content)).not.toBe(
          JSON.stringify(original.type === 'richText' ? original.content : null)
        );
        expect(node.content[0].children[0]).toMatchObject({ text: expect.any(String) });
      }
      if (node.type === 'table')
        expect(node.data.rows[0].id).not.toBe(
          nested.find(candidate => candidate.type === 'table')!.type === 'table'
            ? (
                nested.find(candidate => candidate.type === 'table') as Extract<
                  StudioNode,
                  { type: 'table' }
                >
              ).data.rows[0].id
            : null
        );
      if (node.type === 'chart')
        expect(node.data.series[0].id).not.toBe(
          (
            nested.find(candidate => candidate.type === 'chart') as Extract<
              StudioNode,
              { type: 'chart' }
            >
          ).data.series[0].id
        );
    }
  });

  it.each(['frame', 'view', 'parent'] as const)(
    'aligns using %s reference and rejects unavailable references',
    reference => {
      const { document, shapes } = fixture();
      const viewBounds = { left: 0, top: 0, right: 300, bottom: 300 };
      const result = applyStudioCommandV3(document, {
        type: 'alignNodes',
        nodeIds: shapes.map(node => node.id),
        direction: 'left',
        reference,
        viewBounds,
      });
      expect(find(result, shapes[0].id).transform.x).toBe(reference === 'view' ? -100 : 0);
      for (const node of shapes) node.parentFrameId = null;
      expect(() =>
        applyStudioCommandV3(document, {
          type: 'alignNodes',
          nodeIds: shapes.map(node => node.id),
          direction: 'left',
          reference: reference === 'view' ? 'view' : reference,
        })
      ).toThrow('reference is unavailable');
    }
  );

  it.each(['horizontal', 'vertical'] as const)(
    'distributes %s against a view and rejects insufficient or unavailable selections',
    axis => {
      const { document, shapes } = fixture();
      const result = applyStudioCommandV3(document, {
        type: 'distributeNodes',
        nodeIds: shapes.map(node => node.id),
        axis,
        reference: 'view',
        viewBounds: { left: 100, top: 200, right: 300, bottom: 400 },
      });
      const coordinate = axis === 'horizontal' ? 'x' : 'y';
      expect(shapes.map(node => find(result, node.id).transform[coordinate])).toEqual([0, 95, 190]);
      expect(() =>
        applyStudioCommandV3(document, {
          type: 'distributeNodes',
          nodeIds: shapes.slice(0, 2).map(node => node.id),
          axis,
        })
      ).toThrow('more independent objects');
      expect(() =>
        applyStudioCommandV3(document, {
          type: 'distributeNodes',
          nodeIds: shapes.map(node => node.id),
          axis,
          reference: 'view',
        })
      ).toThrow('reference is unavailable');
    }
  );

  it('updates and deletes a deliverable while retaining other delivery plans', () => {
    const { document, first, second } = fixture();
    const delivery = deliverableSchema.parse({
      id: crypto.randomUUID(),
      title: 'Post',
      code: 'POST',
      kind: 'single',
      order: 0,
      frameIds: [first.id],
      captions: { instagram: '', linkedin: '', facebook: '' },
    });
    const other = deliverableSchema.parse({
      ...delivery,
      id: crypto.randomUUID(),
      frameIds: [second.id],
    });
    expect(
      applyStudioCommandV3(document, { type: 'upsertDeliverable', deliverable: delivery })
        .deliverables
    ).toEqual([delivery]);
    document.deliverables.push(delivery, other);
    const updated = applyStudioCommandV3(document, {
      type: 'upsertDeliverable',
      deliverable: { ...delivery, title: 'Updated' },
    });
    expect(updated.deliverables).toEqual([{ ...delivery, title: 'Updated' }, other]);
    const removed = applyStudioCommandV3(updated, {
      type: 'deleteDeliverable',
      deliverableId: delivery.id,
    });
    expect(removed.deliverables).toEqual([other]);
    expect(document.deliverables[0].title).toBe('Post');
  });

  it('rejects malformed command payloads before touching the input document', () => {
    const { document } = fixture();
    const original = structuredClone(document);
    expect(() =>
      applyStudioCommandV3(document, { type: 'transformNodes', transforms: [] } as StudioCommandV3)
    ).toThrow();
    expect(document).toEqual(original);
  });
});
