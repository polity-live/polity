import { z } from 'zod';
import {
  componentInstanceSchema,
  studioNodeSchema,
  type StudioDocumentV3,
  type StudioNode,
} from './document-v3';

const uuid = z.string().uuid();

export const elementLibraryAssetSchema = z.object({
  sourceAssetId: uuid,
  name: z.string().min(1).max(200),
  mime: z.enum(['image/png', 'image/jpeg', 'image/webp', 'video/mp4']),
});

export const elementSetSnapshotSchema = z.object({
  nodes: z.array(studioNodeSchema).min(1).max(5_000),
  width: z.number().finite().positive().max(100_000),
  height: z.number().finite().positive().max(100_000),
  assets: z.array(elementLibraryAssetSchema).max(100),
});
export type ElementSetSnapshot = z.infer<typeof elementSetSnapshotSchema>;

export const elementSetListItemSchema = z.object({
  id: uuid,
  name: z.string().min(1).max(120),
  scope: z.enum(['personal', 'group']),
  revisionId: uuid,
  version: z.number().int().positive(),
  width: z.number().positive(),
  height: z.number().positive(),
  updatedAt: z.number(),
});
export type ElementSetListItem = z.infer<typeof elementSetListItemSchema>;

function descendants(document: StudioDocumentV3, roots: Set<string>) {
  const ids = new Set(roots);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of document.nodes)
      if (node.parentFrameId && ids.has(node.parentFrameId) && !ids.has(node.id)) {
        ids.add(node.id);
        changed = true;
      }
  }
  return ids;
}

export function createElementSetSnapshot(
  document: StudioDocumentV3,
  selectedIds: readonly string[],
  assets: readonly { id: string; name: string; mime: string }[] = []
): ElementSetSnapshot {
  const deliverableFrames = new Set(document.deliverables.flatMap(item => item.frameIds));
  const forbidden = new Set(
    document.nodes
      .filter(
        node =>
          node.type === 'frame' &&
          (node.parentFrameId === null ||
            node.id === document.masterLayout.frameId ||
            deliverableFrames.has(node.id))
      )
      .map(node => node.id)
  );
  const roots = new Set(selectedIds.filter(id => !forbidden.has(id)));
  const ids = descendants(document, roots);
  const chosen = document.nodes.filter(node => ids.has(node.id));
  if (!chosen.length) throw new Error('Select one or more elements, not a root frame');
  const minX = Math.min(...chosen.map(node => node.transform.x));
  const minY = Math.min(...chosen.map(node => node.transform.y));
  const maxX = Math.max(...chosen.map(node => node.transform.x + node.transform.width));
  const maxY = Math.max(...chosen.map(node => node.transform.y + node.transform.height));
  const usedAssets = new Set(
    chosen.flatMap(node =>
      node.type === 'media'
        ? [node.assetId]
        : node.type === 'chart' && node.sourceAssetId
          ? [node.sourceAssetId]
          : []
    )
  );
  return elementSetSnapshotSchema.parse({
    nodes: chosen.map(node => ({
      ...structuredClone(node),
      parentFrameId: node.parentFrameId && ids.has(node.parentFrameId) ? node.parentFrameId : null,
      transform: {
        ...node.transform,
        x: node.transform.x - minX,
        y: node.transform.y - minY,
      },
    })),
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
    assets: assets
      .filter(asset => usedAssets.has(asset.id))
      .map(asset => ({ sourceAssetId: asset.id, name: asset.name, mime: asset.mime })),
  });
}

function remapNode(
  source: StudioNode,
  nodeIds: Map<string, string>,
  groupIds: Map<string, string>,
  assetIds: Map<string, string>,
  targetFrameId: string | null,
  x: number,
  y: number,
  zIndex: number
): StudioNode {
  const next = structuredClone(source);
  const nodeId = nodeIds.get(source.id);
  if (!nodeId) throw new Error(`Missing node mapping for ${source.id}`);
  next.id = nodeId;
  next.parentFrameId = source.parentFrameId
    ? (nodeIds.get(source.parentFrameId) ?? targetFrameId)
    : targetFrameId;
  next.transform.x += x;
  next.transform.y += y;
  next.zIndex += zIndex;
  next.groupIds = source.groupIds.map(id => {
    const mapped = groupIds.get(id) ?? crypto.randomUUID();
    groupIds.set(id, mapped);
    return mapped;
  });
  next.componentRef = source.id;
  if (next.type === 'shape') {
    next.startBindingId = next.startBindingId ? (nodeIds.get(next.startBindingId) ?? null) : null;
    next.endBindingId = next.endBindingId ? (nodeIds.get(next.endBindingId) ?? null) : null;
  }
  if (next.type === 'media') next.assetId = assetIds.get(next.assetId) ?? next.assetId;
  if (next.type === 'chart' && next.sourceAssetId)
    next.sourceAssetId = assetIds.get(next.sourceAssetId) ?? next.sourceAssetId;
  return studioNodeSchema.parse(next);
}

export function instantiateElementSet(
  snapshot: ElementSetSnapshot,
  values: {
    setId: string;
    revisionId: string;
    targetFrameId?: string | null;
    x: number;
    y: number;
    zIndex?: number;
    assetIds?: Record<string, string>;
  }
) {
  const parsed = elementSetSnapshotSchema.parse(snapshot);
  const nodeIds = new Map(parsed.nodes.map(node => [node.id, crypto.randomUUID()]));
  const groupIds = new Map<string, string>();
  const assetIds = new Map(Object.entries(values.assetIds ?? {}));
  const nodes = parsed.nodes.map(node =>
    remapNode(
      node,
      nodeIds,
      groupIds,
      assetIds,
      values.targetFrameId ?? null,
      values.x,
      values.y,
      values.zIndex ?? 0
    )
  );
  const instance = componentInstanceSchema.parse({
    id: crypto.randomUUID(),
    setId: values.setId,
    revisionId: values.revisionId,
    sourceToInstance: Object.fromEntries(nodeIds),
    localOverrides: {},
    localDeletions: [],
    detachedNodes: [],
  });
  return { nodes, instance };
}

/** Three-way update for linked instances. Local field overrides always win. */
export function mergeElementSetRevision(
  document: StudioDocumentV3,
  instanceId: string,
  previous: ElementSetSnapshot,
  next: ElementSetSnapshot,
  revisionId: string
) {
  const instance = document.componentInstances.find(item => item.id === instanceId);
  if (!instance) return;
  const oldById = new Map(previous.nodes.map(node => [node.id, node]));
  const newById = new Map(next.nodes.map(node => [node.id, node]));
  for (const [sourceId, instanceNodeId] of Object.entries(instance.sourceToInstance)) {
    const local = document.nodes.find(node => node.id === instanceNodeId);
    const upstream = newById.get(sourceId);
    if (!local) {
      if (!instance.localDeletions.includes(sourceId)) instance.localDeletions.push(sourceId);
      continue;
    }
    if (!upstream) {
      const changed = (instance.localOverrides[sourceId] ?? []).length > 0;
      if (changed) {
        instance.detachedNodes.push(local.id);
        Reflect.deleteProperty(instance.sourceToInstance, sourceId);
        local.componentRef = null;
      } else document.nodes = document.nodes.filter(node => node.id !== local.id);
      continue;
    }
    const overrides = new Set(instance.localOverrides[sourceId] ?? []);
    const old = oldById.get(sourceId);
    const updated = structuredClone(upstream) as Record<string, unknown>;
    const current = local as unknown as Record<string, unknown>;
    for (const field of [
      'name',
      'transform',
      'style',
      'visible',
      'locked',
      'constraints',
      'animation',
    ])
      if (
        overrides.has(field) ||
        (old &&
          JSON.stringify(current[field]) !==
            JSON.stringify((old as unknown as Record<string, unknown>)[field]))
      )
        updated[field] = current[field];
    Object.assign(local, updated, { id: local.id, componentRef: sourceId });
  }
  const anchorEntry = Object.entries(instance.sourceToInstance).find(([, nodeId]) =>
    document.nodes.some(node => node.id === nodeId)
  );
  const anchorNode = anchorEntry
    ? document.nodes.find(node => node.id === anchorEntry[1])
    : undefined;
  const anchorSource = anchorEntry ? oldById.get(anchorEntry[0]) : undefined;
  const offset = anchorNode
    ? {
        x: anchorNode.transform.x - (anchorSource?.transform.x ?? 0),
        y: anchorNode.transform.y - (anchorSource?.transform.y ?? 0),
        parentFrameId: anchorNode.parentFrameId,
      }
    : { x: 0, y: 0, parentFrameId: null };
  const additions = next.nodes.filter(
    node => !instance.sourceToInstance[node.id] && !instance.localDeletions.includes(node.id)
  );
  if (additions.length) {
    const created = instantiateElementSet(
      { ...next, nodes: additions },
      {
        setId: instance.setId,
        revisionId,
        targetFrameId: offset.parentFrameId,
        x: offset.x,
        y: offset.y,
      }
    ).nodes;
    const createdBySource = new Map(
      created.flatMap(node => (node.componentRef ? ([[node.componentRef, node]] as const) : []))
    );
    for (const source of additions) {
      const node = createdBySource.get(source.id);
      if (!node) continue;
      if (source.parentFrameId)
        node.parentFrameId =
          createdBySource.get(source.parentFrameId)?.id ??
          instance.sourceToInstance[source.parentFrameId] ??
          offset.parentFrameId;
      if (node.type === 'shape' && source.type === 'shape') {
        node.startBindingId = source.startBindingId
          ? (createdBySource.get(source.startBindingId)?.id ??
            instance.sourceToInstance[source.startBindingId] ??
            null)
          : null;
        node.endBindingId = source.endBindingId
          ? (createdBySource.get(source.endBindingId)?.id ??
            instance.sourceToInstance[source.endBindingId] ??
            null)
          : null;
      }
      instance.sourceToInstance[source.id] = node.id;
      document.nodes.push(node);
    }
  }
  instance.revisionId = revisionId;
}

export function trackElementInstanceOverrides(before: StudioDocumentV3, after: StudioDocumentV3) {
  const beforeNodes = new Map(before.nodes.map(node => [node.id, node]));
  const afterNodes = new Map(after.nodes.map(node => [node.id, node]));
  for (const instance of after.componentInstances) {
    const previousInstance = before.componentInstances.find(item => item.id === instance.id);
    if (!previousInstance) continue;
    for (const [sourceId, nodeId] of Object.entries(instance.sourceToInstance)) {
      const oldNode = beforeNodes.get(nodeId);
      const nextNode = afterNodes.get(nodeId);
      if (oldNode && !nextNode) {
        if (!instance.localDeletions.includes(sourceId)) instance.localDeletions.push(sourceId);
        continue;
      }
      if (!oldNode || !nextNode) continue;
      const fields = [
        'name',
        'parentFrameId',
        'transform',
        'zIndex',
        'visible',
        'locked',
        'groupIds',
        'constraints',
        'style',
        'animation',
        'content',
        'typography',
        'assetId',
        'fit',
        'focus',
        'crop',
        'trim',
        'muted',
        'data',
        'excalidraw',
      ];
      const changed = fields.filter(
        field =>
          JSON.stringify((oldNode as unknown as Record<string, unknown>)[field]) !==
          JSON.stringify((nextNode as unknown as Record<string, unknown>)[field])
      );
      if (changed.length)
        instance.localOverrides[sourceId] = [
          ...new Set([...(instance.localOverrides[sourceId] ?? []), ...changed]),
        ];
    }
  }
}
