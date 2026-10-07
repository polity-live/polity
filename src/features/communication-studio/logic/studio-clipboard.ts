import { z } from 'zod';
import {
  deliverableSchema,
  descendantsOf,
  studioDocumentV3Schema,
  studioNodeSchema,
  type StudioDocumentV3,
  type StudioNode,
} from './document-v3';

export const STUDIO_CLIPBOARD_TYPE = 'polity/studio-clipboard' as const;

const studioClipboardV2Schema = z.object({
  type: z.literal(STUDIO_CLIPBOARD_TYPE),
  version: z.literal(2),
  projectId: z.string().min(1),
  rootNodeIds: z.array(z.string().uuid()).min(1).max(1_000),
  nodes: z.array(studioNodeSchema).min(1).max(50_000),
  deliverables: z
    .array(
      z.object({
        deliverable: deliverableSchema,
        framePositions: z
          .array(
            z.object({
              frameId: z.string().uuid(),
              index: z.number().int().nonnegative(),
            })
          )
          .min(1)
          .max(100),
      })
    )
    .max(1_000),
});

export type StudioClipboardV2Payload = z.infer<typeof studioClipboardV2Schema>;
export type StudioClipboardPayload = StudioClipboardV2Payload;

const projectClipboards = new Map<string, StudioClipboardPayload>();

const jsonClone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export function createStudioV3ClipboardPayload(input: {
  projectId: string;
  selectedNodeIds: readonly string[];
  document: StudioDocumentV3;
}): StudioClipboardV2Payload | null {
  const selected = new Set(input.selectedNodeIds);
  const chosen = new Set(selected);
  for (const nodeId of selected) {
    const node = input.document.nodes.find(candidate => candidate.id === nodeId);
    if (!node) continue;
    if (node.type === 'frame')
      for (const descendant of descendantsOf(input.document, node.id)) chosen.add(descendant.id);
  }
  const nodes = input.document.nodes.filter(node => chosen.has(node.id));
  if (!nodes.length) return null;
  const chosenById = new Map(nodes.map(node => [node.id, node]));
  const rootNodeIds = [...selected].filter(nodeId => {
    let parentId = chosenById.get(nodeId)?.parentFrameId ?? null;
    while (parentId) {
      if (selected.has(parentId)) return false;
      parentId = chosenById.get(parentId)?.parentFrameId ?? null;
    }
    return chosenById.has(nodeId);
  });
  if (!rootNodeIds.length) return null;
  const deliverables = input.document.deliverables.flatMap(deliverable => {
    const framePositions = deliverable.frameIds.flatMap((frameId, index) =>
      chosen.has(frameId) ? [{ frameId, index }] : []
    );
    return framePositions.length ? [{ deliverable: jsonClone(deliverable), framePositions }] : [];
  });
  return studioClipboardV2Schema.parse({
    type: STUDIO_CLIPBOARD_TYPE,
    version: 2,
    projectId: input.projectId,
    rootNodeIds,
    nodes: jsonClone(nodes),
    deliverables,
  });
}

function remapNestedContentIds(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(remapNestedContentIds);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
      key,
      key === 'id' && typeof nested === 'string'
        ? crypto.randomUUID()
        : remapNestedContentIds(nested),
    ])
  );
}

export function pasteStudioV3Clipboard(input: {
  document: StudioDocumentV3;
  payload: StudioClipboardV2Payload;
  projectId: string;
  targetFrameId?: string | null;
}): { document: StudioDocumentV3; selectedNodeIds: string[] } {
  if (input.payload.projectId !== input.projectId)
    throw new Error('Studio clipboard belongs to another project');
  const document = structuredClone(input.document);
  const sourceById = new Map(input.payload.nodes.map(node => [node.id, node]));
  const roots = input.payload.rootNodeIds.flatMap(id => {
    const node = sourceById.get(id);
    return node ? [node] : [];
  });
  if (!roots.length) throw new Error('Studio clipboard has no root nodes');
  const nodeIds = new Map<string, string>();
  const copies = input.payload.nodes.map(source => {
    const id = nodeIds.get(source.id) ?? crypto.randomUUID();
    nodeIds.set(source.id, id);
    return { source, id };
  });
  const groupIds = new Map<string, string>();

  const targetFrame = input.targetFrameId
    ? document.nodes.find(node => node.id === input.targetFrameId && node.type === 'frame')
    : undefined;
  const sharedSourceParent = new Set(roots.map(node => node.parentFrameId)).size === 1;
  const rootIds = new Set(input.payload.rootNodeIds);
  const clones = copies.map(({ source, id }) => {
    const copy = jsonClone(source) as StudioNode;
    copy.id = id;
    copy.parentFrameId = source.parentFrameId
      ? (nodeIds.get(source.parentFrameId) ?? source.parentFrameId)
      : null;
    copy.groupIds = source.groupIds.map(groupId => {
      let mapped = groupIds.get(groupId);
      if (!mapped) {
        mapped = crypto.randomUUID();
        groupIds.set(groupId, mapped);
      }
      return mapped;
    });
    copy.locked = false;
    if (rootIds.has(source.id)) {
      const rootFrame = source.type === 'frame' && source.parentFrameId === null;
      copy.parentFrameId = rootFrame
        ? null
        : sharedSourceParent && targetFrame
          ? targetFrame.id
          : copy.parentFrameId;
      copy.transform.x += 24;
      copy.transform.y += 24;
      const siblings = document.nodes.filter(
        node =>
          node.parentFrameId === copy.parentFrameId &&
          (copy.parentFrameId !== null || (node.type === 'frame') === (copy.type === 'frame'))
      );
      copy.zIndex = Math.max(-1, ...siblings.map(node => node.zIndex)) + 1;
    }
    if (copy.type === 'shape') {
      copy.startBindingId = copy.startBindingId ? (nodeIds.get(copy.startBindingId) ?? null) : null;
      copy.endBindingId = copy.endBindingId ? (nodeIds.get(copy.endBindingId) ?? null) : null;
    } else if (copy.type === 'richText') {
      copy.content = remapNestedContentIds(copy.content) as typeof copy.content;
    } else if (copy.type === 'table') {
      copy.data = remapNestedContentIds(copy.data) as typeof copy.data;
    } else if (copy.type === 'chart') {
      copy.data = {
        ...copy.data,
        series: copy.data.series.map(series => ({ ...series, id: crypto.randomUUID() })),
      };
    }
    return copy;
  });
  document.nodes.push(...clones);

  for (const membership of input.payload.deliverables) {
    const copiedFrames = membership.framePositions.flatMap(position => {
      const frameId = nodeIds.get(position.frameId);
      return frameId ? [{ ...position, frameId, sourceFrameId: position.frameId }] : [];
    });
    if (!copiedFrames.length) continue;
    const existing = document.deliverables.find(
      deliverable => deliverable.id === membership.deliverable.id
    );
    if (existing) {
      for (const copied of copiedFrames.sort((a, b) => a.index - b.index)) {
        const originalIndex = existing.frameIds.indexOf(copied.sourceFrameId);
        const index =
          originalIndex >= 0 ? originalIndex + 1 : Math.min(existing.frameIds.length, copied.index);
        existing.frameIds.splice(index, 0, copied.frameId);
      }
    } else {
      document.deliverables.push({
        ...jsonClone(membership.deliverable),
        frameIds: copiedFrames.sort((a, b) => a.index - b.index).map(item => item.frameId),
      });
    }
  }
  return {
    document: studioDocumentV3Schema.parse(document),
    selectedNodeIds: input.payload.rootNodeIds.flatMap(id => {
      const nodeId = nodeIds.get(id);
      return nodeId ? [nodeId] : [];
    }),
  };
}

export function stringifyStudioClipboard(payload: StudioClipboardPayload) {
  return JSON.stringify(payload);
}

export function parseStudioClipboard(value: string): StudioClipboardPayload | null {
  try {
    const parsed = JSON.parse(value);
    if (parsed?.type !== STUDIO_CLIPBOARD_TYPE) return null;
    return studioClipboardV2Schema.parse(parsed);
  } catch {
    return null;
  }
}

export function setProjectStudioClipboard(payload: StudioClipboardPayload) {
  projectClipboards.set(payload.projectId, payload);
}

export function getProjectStudioClipboard(projectId: string) {
  const payload = projectClipboards.get(projectId);
  return payload ? jsonClone(payload) : null;
}
