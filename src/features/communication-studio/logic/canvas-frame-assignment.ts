import { reparentStudioNodes } from './commands-v3';
import type { FrameNode, StudioDocumentV3, StudioNode } from './document-v3';
import { studioScenePaintOrder } from './studio-scene';
import { isDescendantOf, worldCorners, worldToLocalPoint, type Point } from './selection-geometry';

const epsilon = 1e-7;

function convexHull(points: Point[]): Point[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (a: Point, b: Point, c: Point) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const half = (values: Point[]) => {
    const result: Point[] = [];
    for (const value of values) {
      while (result.length > 1) {
        const a = result.at(-2),
          b = result.at(-1);
        if (!a || !b || cross(a, b, value) > 0) break;
        result.pop();
      }
      result.push(value);
    }
    return result.slice(0, -1);
  };
  return [...half(sorted), ...half(sorted.reverse())];
}

/** Separating axes keep rotated groups and frames accurate; touching is still inside. */
function disjoint(a: Point[], b: Point[]): boolean {
  return [a, b].some(polygon =>
    polygon.some((start, index) => {
      const end = polygon[(index + 1) % polygon.length];
      const length = Math.hypot(end.x - start.x, end.y - start.y);
      if (!length) return false;
      const axis = { x: (start.y - end.y) / length, y: (end.x - start.x) / length };
      const project = (values: Point[]) => values.map(p => p.x * axis.x + p.y * axis.y);
      const first = project(a),
        second = project(b);
      return (
        Math.max(...first) < Math.min(...second) - epsilon ||
        Math.max(...second) < Math.min(...first) - epsilon
      );
    })
  );
}

/** Called after drag positions are committed, within the same document transaction. */
export function assignDraggedStudioNodesToFrames(document: StudioDocumentV3, movedIds: string[]) {
  const moved = new Set(movedIds);
  const frames = studioScenePaintOrder(document)
    .filter(
      (node): node is FrameNode =>
        node.type === 'frame' &&
        !node.locked &&
        node.id !== document.masterLayout.frameId &&
        !movedIds.some(id => node.id === id || isDescendantOf(document, node, id))
    )
    .reverse();
  const visited = new Set<string>();
  const assignments: { ids: string[]; parentFrameId: string | null }[] = [];
  for (const node of document.nodes) {
    if (!moved.has(node.id) || node.type === 'frame' || node.locked) continue;
    const group = node.groupIds[0];
    const key = group ?? node.id;
    if (visited.has(key)) continue;
    visited.add(key);
    const members = group ? document.nodes.filter(n => n.groupIds[0] === group) : [node];
    if (members.some(n => !moved.has(n.id) || n.locked || n.type === 'frame')) continue;
    if (new Set(members.map(n => n.parentFrameId)).size !== 1) continue;
    const hull = convexHull(members.flatMap(n => worldCorners(document, n)));
    const current = document.nodes.find(n => n.id === node.parentFrameId);
    if (current && !disjoint(hull, worldCorners(document, current))) continue;
    const contains = (frame: FrameNode) =>
      hull.every(p => {
        const local = worldToLocalPoint(document, frame.id, p);
        return (
          local.x >= -epsilon &&
          local.y >= -epsilon &&
          local.x <= frame.transform.width + epsilon &&
          local.y <= frame.transform.height + epsilon
        );
      });
    const containsThroughAncestors = (frame: FrameNode) => {
      if (!contains(frame)) return false;
      let parentId = frame.parentFrameId;
      while (parentId) {
        const parent = document.nodes.find(
          (candidate): candidate is FrameNode =>
            candidate.id === parentId && candidate.type === 'frame'
        );
        if (!parent || parent.locked || (parent.clipContent && !contains(parent))) return false;
        parentId = parent.parentFrameId;
      }
      return true;
    };
    // Leaving a nested frame first falls back to a containing ancestor.
    let ancestor = current?.parentFrameId;
    let target: FrameNode | undefined;
    while (ancestor) {
      const frame = document.nodes.find(
        (n): n is FrameNode => n.id === ancestor && n.type === 'frame'
      );
      if (!frame) break;
      if (frames.includes(frame) && containsThroughAncestors(frame)) {
        target = frame;
        break;
      }
      ancestor = frame.parentFrameId;
    }
    target ??= frames.find(containsThroughAncestors);
    const parentFrameId = target?.id ?? null;
    if (parentFrameId !== node.parentFrameId)
      assignments.push({ ids: members.map(n => n.id), parentFrameId });
  }
  for (const { ids, parentFrameId } of assignments) {
    reparentStudioNodes(document, ids, parentFrameId);
    // Newly assigned content paints above existing siblings, including root frames.
    let order = Math.max(
      -1,
      ...document.nodes
        .filter(n => n.parentFrameId === parentFrameId && !ids.includes(n.id))
        .map(n => n.zIndex)
    );
    const members = ids
      .map(id => document.nodes.find(n => n.id === id) as StudioNode)
      .sort((a, b) => a.zIndex - b.zIndex || a.id.localeCompare(b.id));
    for (const member of members) member.zIndex = ++order;
  }
}
