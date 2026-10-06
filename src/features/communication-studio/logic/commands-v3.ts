import { z } from 'zod';
import {
  assertCanReparent,
  descendantsOf,
  studioDocumentV3Schema,
  studioNodeSchema,
  transformSchema,
  type StudioDeliverable,
  type StudioDocumentV3,
  type StudioNode,
} from './document-v3';
import {
  arrangementReferenceBounds,
  arrangementUnits,
  moveByWorldDelta,
} from './selection-geometry';

const nodeIds = z.array(z.string().uuid()).min(1).max(1_000);
const viewBoundsSchema = z.object({
  left: z.number().finite(),
  top: z.number().finite(),
  right: z.number().finite(),
  bottom: z.number().finite(),
});

function regenerateNestedIds(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(regenerateNestedIds);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      key === 'id' && typeof nested === 'string'
        ? crypto.randomUUID()
        : regenerateNestedIds(nested),
    ])
  );
}

export const studioCommandV3Schema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('createNodes'), nodes: z.array(studioNodeSchema).min(1).max(1_000) }),
  z.object({
    type: z.literal('updateNode'),
    nodeId: z.string().uuid(),
    patch: z.record(z.string(), z.json()),
  }),
  z.object({
    type: z.literal('transformNodes'),
    transforms: z
      .array(z.object({ nodeId: z.string().uuid(), transform: transformSchema }))
      .min(1)
      .max(1_000),
  }),
  z.object({
    type: z.literal('reparentNodes'),
    nodeIds,
    parentFrameId: z.string().uuid().nullable(),
  }),
  z.object({
    type: z.literal('moveNode'),
    nodeId: z.string().uuid(),
    targetId: z.string().uuid(),
    position: z.enum(['before', 'inside', 'after']),
  }),
  z.object({
    type: z.literal('resizeFrame'),
    frameId: z.string().uuid(),
    transform: transformSchema,
    scaleContent: z.boolean().default(false),
  }),
  z.object({
    type: z.literal('reorderNodes'),
    nodeIds,
    action: z.enum(['front', 'back', 'forward', 'backward']),
  }),
  z.object({ type: z.literal('deleteNodes'), nodeIds }),
  z.object({ type: z.literal('duplicateNodes'), nodeIds }),
  z.object({
    type: z.literal('groupNodes'),
    nodeIds: z.array(z.string().uuid()).min(2).max(1_000),
    groupId: z.string().uuid(),
    depth: z.number().int().min(0).max(31).default(0),
  }),
  z.object({
    type: z.literal('ungroupNodes'),
    nodeIds,
    depth: z.number().int().min(0).max(31).default(0),
  }),
  z.object({
    type: z.literal('setNodeState'),
    nodeIds,
    visible: z.boolean().optional(),
    locked: z.boolean().optional(),
    groupId: z.string().uuid().nullable().optional(),
  }),
  z.object({
    type: z.literal('alignNodes'),
    nodeIds,
    direction: z.enum(['left', 'center', 'right', 'top', 'middle', 'bottom']),
    reference: z.enum(['selection', 'frame', 'view', 'parent']).default('selection'),
    viewBounds: viewBoundsSchema.optional(),
    groupDepth: z.number().int().min(0).max(31).default(0),
  }),
  z.object({
    type: z.literal('distributeNodes'),
    nodeIds: z.array(z.string().uuid()).min(2).max(1_000),
    axis: z.enum(['horizontal', 'vertical']),
    reference: z.enum(['selection', 'frame', 'view']).default('selection'),
    viewBounds: viewBoundsSchema.optional(),
    groupDepth: z.number().int().min(0).max(31).default(0),
  }),
  z.object({
    type: z.literal('upsertDeliverable'),
    deliverable: z.object({
      id: z.string().uuid(),
      code: z.string().max(100),
      title: z.string().max(200),
      kind: z.enum(['single', 'carousel', 'story', 'video', 'presentation']),
      frameIds: z.array(z.string().uuid()).min(1).max(100),
      channel: z.enum(['instagram', 'linkedin', 'facebook', 'custom']),
      order: z.number().int().nonnegative(),
      status: z.enum(['draft', 'ready', 'published']),
      dayOffset: z.number().int().min(0).max(3_650),
      scheduledAt: z.iso.datetime().nullable(),
      assignee: z.string().max(150),
      brief: z.string().max(2_000),
      captions: z.object({ instagram: z.string(), linkedin: z.string(), facebook: z.string() }),
    }),
  }),
  z.object({ type: z.literal('deleteDeliverable'), deliverableId: z.string().uuid() }),
]);

export type StudioCommandV3 = z.input<typeof studioCommandV3Schema>;
export type StudioLayerMovePosition = 'before' | 'inside' | 'after';

function selectedNodes(document: StudioDocumentV3, ids: string[]): StudioNode[] {
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate node IDs');
  const selected = ids.map(id => document.nodes.find(node => node.id === id));
  if (selected.some(node => !node)) throw new Error('Node not found');
  return selected as StudioNode[];
}

function assertEditable(nodes: StudioNode[]) {
  if (nodes.some(node => node.locked)) throw new Error('Node is locked');
}

export function canMoveStudioLayer(
  document: StudioDocumentV3,
  nodeId: string,
  targetId: string,
  position: StudioLayerMovePosition
): boolean {
  if (nodeId === targetId) return false;
  const source = document.nodes.find(node => node.id === nodeId);
  const target = document.nodes.find(node => node.id === targetId);
  if (!source || !target || source.locked) return false;
  if (source.id === document.masterLayout.frameId || target.id === document.masterLayout.frameId)
    return false;

  if (position === 'inside') return source.type !== 'frame' && target.type === 'frame';
  if (source.type !== 'frame' && target.type === 'frame') return target.parentFrameId === null;
  if (source.type === 'frame' || target.type === 'frame')
    return (
      source.type === 'frame' &&
      target.type === 'frame' &&
      source.parentFrameId === null &&
      target.parentFrameId === null
    );
  return true;
}

function worldOrigin(
  document: StudioDocumentV3,
  node: StudioNode | null
): { x: number; y: number } {
  let x = 0,
    y = 0,
    current = node;
  const visited = new Set<string>();
  while (current) {
    if (visited.has(current.id)) throw new Error('Circular frame hierarchy');
    visited.add(current.id);
    x += current.transform.x;
    y += current.transform.y;
    current = current.parentFrameId
      ? (document.nodes.find(candidate => candidate.id === current?.parentFrameId) ?? null)
      : null;
  }
  return { x, y };
}

function reparentNodes(
  document: StudioDocumentV3,
  nodes: StudioNode[],
  parentFrameId: string | null
) {
  const positions = new Map(nodes.map(node => [node.id, worldOrigin(document, node)]));
  const target = parentFrameId
    ? (document.nodes.find(node => node.id === parentFrameId) ?? null)
    : null;
  const targetOrigin = worldOrigin(document, target);
  for (const node of nodes) {
    const origin = positions.get(node.id);
    if (!origin) throw new Error('Node position unavailable');
    node.parentFrameId = parentFrameId;
    node.transform.x = origin.x - targetOrigin.x;
    node.transform.y = origin.y - targetOrigin.y;
  }
}

function constrainAxis(
  position: number,
  size: number,
  oldParentSize: number,
  newParentSize: number,
  constraint: 'left' | 'center' | 'right' | 'scale' | 'top' | 'bottom' | 'left-right' | 'top-bottom'
): [number, number] {
  if (constraint === 'scale') {
    const ratio = oldParentSize ? newParentSize / oldParentSize : 1;
    return [position * ratio, size * ratio];
  }
  if (constraint === 'right' || constraint === 'bottom')
    return [newParentSize - (oldParentSize - position - size), size];
  if (constraint === 'left-right' || constraint === 'top-bottom')
    return [position, Math.max(1, size + newParentSize - oldParentSize)];
  if (constraint === 'center') return [position + (newParentSize - oldParentSize) / 2, size];
  return [position, size];
}

export function snapToGrid(value: number, size = 8): number {
  if (!Number.isFinite(value) || !Number.isFinite(size) || size <= 0) return value;
  return Math.round(value / size) * size;
}

export function applyStudioCommandV3(
  input: StudioDocumentV3,
  rawCommand: StudioCommandV3
): StudioDocumentV3 {
  const command = studioCommandV3Schema.parse(rawCommand);
  const document = structuredClone(input);

  switch (command.type) {
    case 'createNodes': {
      const existing = new Set(document.nodes.map(node => node.id));
      if (command.nodes.some(node => existing.has(node.id))) throw new Error('Node already exists');
      const candidate = { ...document, nodes: [...document.nodes, ...command.nodes] };
      return studioDocumentV3Schema.parse(candidate);
    }
    case 'updateNode': {
      const node = selectedNodes(document, [command.nodeId])[0];
      assertEditable([node]);
      const protectedFields = new Set(['id', 'type', 'parentFrameId']);
      if (Object.keys(command.patch).some(key => protectedFields.has(key)))
        throw new Error('Use a dedicated command for identity, type or parent changes');
      Object.assign(node, command.patch);
      break;
    }
    case 'transformNodes': {
      const nodes = selectedNodes(
        document,
        command.transforms.map(item => item.nodeId)
      );
      assertEditable(nodes);
      for (const item of command.transforms) {
        const node = nodes.find(candidate => candidate.id === item.nodeId);
        if (!node) throw new Error('Node not found');
        node.transform = item.transform;
      }
      break;
    }
    case 'reparentNodes': {
      assertCanReparent(document, command.nodeIds, command.parentFrameId);
      const nodes = selectedNodes(document, command.nodeIds);
      reparentNodes(document, nodes, command.parentFrameId);
      break;
    }
    case 'moveNode': {
      if (!canMoveStudioLayer(document, command.nodeId, command.targetId, command.position))
        throw new Error('Invalid layer move');
      const source = selectedNodes(document, [command.nodeId])[0];
      const target = selectedNodes(document, [command.targetId])[0];
      assertEditable([source]);
      const detachToRoot =
        command.position !== 'inside' &&
        source.type !== 'frame' &&
        target.type === 'frame' &&
        target.parentFrameId === null;
      const parentFrameId =
        command.position === 'inside' ? target.id : detachToRoot ? null : target.parentFrameId;
      if (source.parentFrameId !== parentFrameId) {
        assertCanReparent(document, [source.id], parentFrameId);
        reparentNodes(document, [source], parentFrameId);
      }

      const rootFrames = parentFrameId === null && source.type === 'frame';
      const siblings = document.nodes
        .filter(
          node =>
            node.parentFrameId === parentFrameId &&
            node.id !== source.id &&
            (parentFrameId !== null || (node.type === 'frame') === rootFrames)
        )
        .sort((left, right) =>
          rootFrames
            ? left.zIndex - right.zIndex || left.id.localeCompare(right.id)
            : right.zIndex - left.zIndex || left.id.localeCompare(right.id)
        );
      const targetIndex = siblings.findIndex(node => node.id === target.id);
      const insertAt =
        command.position === 'inside'
          ? 0
          : detachToRoot
            ? command.position === 'before'
              ? 0
              : siblings.length
            : targetIndex + (command.position === 'after' ? 1 : 0);
      if (command.position !== 'inside' && !detachToRoot && targetIndex < 0)
        throw new Error('Layer target is outside the stacking context');
      siblings.splice(insertAt, 0, source);
      siblings.forEach((node, index) => {
        node.zIndex = rootFrames ? index : siblings.length - index - 1;
      });
      break;
    }
    case 'resizeFrame': {
      const frame = selectedNodes(document, [command.frameId])[0];
      if (frame.type !== 'frame') throw new Error('Node is not a frame');
      assertEditable([frame]);
      const before = frame.transform;
      for (const child of document.nodes.filter(node => node.parentFrameId === frame.id)) {
        const horizontal = command.scaleContent ? 'scale' : child.constraints.horizontal;
        const vertical = command.scaleContent ? 'scale' : child.constraints.vertical;
        [child.transform.x, child.transform.width] = constrainAxis(
          child.transform.x,
          child.transform.width,
          before.width,
          command.transform.width,
          horizontal
        );
        [child.transform.y, child.transform.height] = constrainAxis(
          child.transform.y,
          child.transform.height,
          before.height,
          command.transform.height,
          vertical
        );
      }
      frame.transform = command.transform;
      break;
    }
    case 'reorderNodes': {
      const nodes = selectedNodes(document, command.nodeIds);
      assertEditable(nodes);
      const parents = new Set(nodes.map(node => node.parentFrameId));
      if (parents.size !== 1) throw new Error('Nodes must share a stacking context');
      const siblings = document.nodes
        .filter(node => node.parentFrameId === nodes[0].parentFrameId)
        .sort((a, b) => a.zIndex - b.zIndex || a.id.localeCompare(b.id));
      const chosen = new Set(command.nodeIds);
      let ordered = siblings;
      if (command.action === 'front')
        ordered = [
          ...siblings.filter(node => !chosen.has(node.id)),
          ...siblings.filter(node => chosen.has(node.id)),
        ];
      else if (command.action === 'back')
        ordered = [
          ...siblings.filter(node => chosen.has(node.id)),
          ...siblings.filter(node => !chosen.has(node.id)),
        ];
      else {
        if (command.action === 'forward') ordered = [...ordered].reverse();
        for (let index = 1; index < ordered.length; index++)
          if (chosen.has(ordered[index].id) && !chosen.has(ordered[index - 1].id))
            [ordered[index], ordered[index - 1]] = [ordered[index - 1], ordered[index]];
        if (command.action === 'forward') ordered.reverse();
      }
      ordered.forEach((node, index) => (node.zIndex = index));
      break;
    }
    case 'deleteNodes': {
      const nodes = selectedNodes(document, command.nodeIds);
      assertEditable(nodes);
      const deleted = new Set(command.nodeIds);
      for (const id of command.nodeIds)
        for (const child of descendantsOf(document, id)) deleted.add(child.id);
      document.nodes = document.nodes.filter(node => !deleted.has(node.id));
      document.deliverables = document.deliverables
        .map(deliverable => ({
          ...deliverable,
          frameIds: deliverable.frameIds.filter(id => !deleted.has(id)),
        }))
        .filter(deliverable => deliverable.frameIds.length > 0);
      break;
    }
    case 'duplicateNodes': {
      const nodes = selectedNodes(document, command.nodeIds);
      assertEditable(nodes);
      const chosen = new Set(command.nodeIds);
      for (const node of nodes)
        if (node.type === 'frame')
          for (const child of descendantsOf(document, node.id)) chosen.add(child.id);
      const sources = document.nodes.filter(node => chosen.has(node.id));
      const idMap = new Map(sources.map(node => [node.id, crypto.randomUUID()]));
      const groupMap = new Map<string, string>();
      const clones = sources.map(node => {
        const copy = structuredClone(node);
        const copyId = idMap.get(node.id);
        if (!copyId) throw new Error('Duplicate node ID unavailable');
        copy.id = copyId;
        copy.parentFrameId = node.parentFrameId
          ? (idMap.get(node.parentFrameId) ?? node.parentFrameId)
          : null;
        if (!node.parentFrameId || !chosen.has(node.parentFrameId)) {
          copy.transform.x += 24;
          copy.transform.y += 24;
        }
        copy.zIndex += 1;
        copy.groupIds = node.groupIds.map(id => {
          const mapped = groupMap.get(id) ?? crypto.randomUUID();
          groupMap.set(id, mapped);
          return mapped;
        });
        if (copy.type === 'richText')
          copy.content = regenerateNestedIds(copy.content) as typeof copy.content;
        if (copy.type === 'table') copy.data = regenerateNestedIds(copy.data) as typeof copy.data;
        if (copy.type === 'chart')
          copy.data.series = copy.data.series.map(series => ({
            ...series,
            id: crypto.randomUUID(),
          }));
        if (copy.type === 'shape') {
          copy.startBindingId = copy.startBindingId
            ? (idMap.get(copy.startBindingId) ?? null)
            : null;
          copy.endBindingId = copy.endBindingId ? (idMap.get(copy.endBindingId) ?? null) : null;
        }
        return copy;
      });
      document.nodes.push(...clones);
      break;
    }
    case 'groupNodes': {
      const nodes = selectedNodes(document, command.nodeIds);
      assertEditable(nodes);
      if (new Set(nodes.map(node => node.parentFrameId)).size !== 1)
        throw new Error('Grouped nodes must share a parent frame');
      if (new Set(nodes.map(node => node.groupIds.slice(0, command.depth).join(':'))).size !== 1)
        throw new Error('Grouped nodes must share the enclosing group');
      if (document.nodes.some(node => node.groupIds.includes(command.groupId)))
        throw new Error('Group already exists');
      const chosen = new Set(command.nodeIds);
      for (const node of nodes) {
        const outer = node.groupIds[command.depth];
        if (
          outer &&
          document.nodes.some(
            candidate => candidate.groupIds[command.depth] === outer && !chosen.has(candidate.id)
          )
        )
          throw new Error('Select every member of an existing group');
      }
      for (const node of nodes) node.groupIds.splice(command.depth, 0, command.groupId);
      break;
    }
    case 'ungroupNodes': {
      const nodes = selectedNodes(document, command.nodeIds);
      assertEditable(nodes);
      const groups = new Set(nodes.map(node => node.groupIds[command.depth]).filter(Boolean));
      for (const node of document.nodes)
        if (node.groupIds[command.depth] && groups.has(node.groupIds[command.depth]))
          node.groupIds.splice(command.depth, 1);
      break;
    }
    case 'setNodeState': {
      const nodes = selectedNodes(document, command.nodeIds);
      if (command.locked !== false) assertEditable(nodes);
      const group = command.groupId;
      for (const node of nodes) {
        if (command.visible !== undefined) node.visible = command.visible;
        if (command.locked !== undefined) node.locked = command.locked;
        if (group !== undefined)
          node.groupIds = group === null ? [] : [...new Set([...node.groupIds, group])];
      }
      break;
    }
    case 'alignNodes': {
      const nodes = selectedNodes(document, command.nodeIds);
      assertEditable(nodes);
      const units = arrangementUnits(document, command.nodeIds, command.groupDepth);
      if (!units.length) break;
      const reference = command.reference === 'parent' ? 'frame' : command.reference;
      const bounds = arrangementReferenceBounds(document, units, reference, command.viewBounds);
      if (!bounds) throw new Error('Alignment reference is unavailable for this selection');
      for (const unit of units) {
        const box = unit.bounds;
        const dx =
          command.direction === 'left'
            ? bounds.left - box.left
            : command.direction === 'center'
              ? (bounds.left + bounds.right - box.left - box.right) / 2
              : command.direction === 'right'
                ? bounds.right - box.right
                : 0;
        const dy =
          command.direction === 'top'
            ? bounds.top - box.top
            : command.direction === 'middle'
              ? (bounds.top + bounds.bottom - box.top - box.bottom) / 2
              : command.direction === 'bottom'
                ? bounds.bottom - box.bottom
                : 0;
        for (const id of unit.ids) {
          const node = nodes.find(candidate => candidate.id === id);
          if (node) moveByWorldDelta(document, node, { x: dx, y: dy });
        }
      }
      break;
    }
    case 'distributeNodes': {
      const nodes = selectedNodes(document, command.nodeIds);
      assertEditable(nodes);
      const units = arrangementUnits(document, command.nodeIds, command.groupDepth);
      if (units.length < (command.reference === 'selection' ? 3 : 2))
        throw new Error('Select more independent objects to distribute');
      const bounds = arrangementReferenceBounds(
        document,
        units,
        command.reference,
        command.viewBounds
      );
      if (!bounds) throw new Error('Distribution reference is unavailable for this selection');
      const coordinate = command.axis === 'horizontal' ? 'left' : 'top';
      const far = command.axis === 'horizontal' ? 'right' : 'bottom';
      const ordered = [...units].sort((a, b) => a.bounds[coordinate] - b.bounds[coordinate]);
      const start = bounds[coordinate];
      const end = bounds[far];
      const occupied = ordered.reduce(
        (sum, unit) => sum + unit.bounds[far] - unit.bounds[coordinate],
        0
      );
      const gap = (end - start - occupied) / (ordered.length - 1);
      let cursor = start;
      for (const unit of ordered) {
        const delta = cursor - unit.bounds[coordinate];
        for (const id of unit.ids) {
          const node = nodes.find(candidate => candidate.id === id);
          if (node)
            moveByWorldDelta(
              document,
              node,
              command.axis === 'horizontal' ? { x: delta, y: 0 } : { x: 0, y: delta }
            );
        }
        cursor += unit.bounds[far] - unit.bounds[coordinate] + gap;
      }
      break;
    }
    case 'upsertDeliverable': {
      const index = document.deliverables.findIndex(item => item.id === command.deliverable.id);
      if (index < 0) document.deliverables.push(command.deliverable as StudioDeliverable);
      else document.deliverables[index] = command.deliverable as StudioDeliverable;
      break;
    }
    case 'deleteDeliverable':
      document.deliverables = document.deliverables.filter(
        item => item.id !== command.deliverableId
      );
      break;
  }

  return studioDocumentV3Schema.parse(document);
}
