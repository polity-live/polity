import type { StudioDocumentV3, StudioNode } from './document-v3';

export interface Point {
  x: number;
  y: number;
}
export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
type Matrix = [number, number, number, number, number, number];
const identity: Matrix = [1, 0, 0, 1, 0, 0];

function multiply(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

function translate(x: number, y: number): Matrix {
  return [1, 0, 0, 1, x, y];
}

function rotate(radians: number): Matrix {
  const c = Math.cos(radians),
    s = Math.sin(radians);
  return [c, s, -s, c, 0, 0];
}

function scale(x: number, y: number): Matrix {
  return [x, 0, 0, y, 0, 0];
}

function point(matrix: Matrix, value: Point): Point {
  return {
    x: matrix[0] * value.x + matrix[2] * value.y + matrix[4],
    y: matrix[1] * value.x + matrix[3] * value.y + matrix[5],
  };
}

function nodeMatrix(node: StudioNode): Matrix {
  const { x, y, width, height, rotation, flipX, flipY } = node.transform;
  return multiply(
    translate(x, y),
    multiply(
      translate(width / 2, height / 2),
      multiply(
        rotate((rotation * Math.PI) / 180),
        multiply(scale(flipX ? -1 : 1, flipY ? -1 : 1), translate(-width / 2, -height / 2))
      )
    )
  );
}

export function worldMatrix(document: StudioDocumentV3, node: StudioNode): Matrix {
  const visited = new Set<string>();
  const chain: StudioNode[] = [];
  let current: StudioNode | undefined = node;
  while (current) {
    if (visited.has(current.id)) throw new Error('Circular frame hierarchy');
    visited.add(current.id);
    chain.unshift(current);
    current = current.parentFrameId
      ? document.nodes.find(candidate => candidate.id === current?.parentFrameId)
      : undefined;
  }
  return chain.reduce((matrix, item) => multiply(matrix, nodeMatrix(item)), identity);
}

export function worldBounds(document: StudioDocumentV3, node: StudioNode): Bounds {
  const matrix = worldMatrix(document, node);
  const { width, height } = node.transform;
  const corners = [
    point(matrix, { x: 0, y: 0 }),
    point(matrix, { x: width, y: 0 }),
    point(matrix, { x: 0, y: height }),
    point(matrix, { x: width, y: height }),
  ];
  return {
    left: Math.min(...corners.map(corner => corner.x)),
    top: Math.min(...corners.map(corner => corner.y)),
    right: Math.max(...corners.map(corner => corner.x)),
    bottom: Math.max(...corners.map(corner => corner.y)),
  };
}

export function unionBounds(bounds: Bounds[]): Bounds {
  if (!bounds.length) throw new Error('Selection is empty');
  return {
    left: Math.min(...bounds.map(item => item.left)),
    top: Math.min(...bounds.map(item => item.top)),
    right: Math.max(...bounds.map(item => item.right)),
    bottom: Math.max(...bounds.map(item => item.bottom)),
  };
}

export function moveByWorldDelta(document: StudioDocumentV3, node: StudioNode, delta: Point): void {
  const parent = node.parentFrameId
    ? document.nodes.find(candidate => candidate.id === node.parentFrameId)
    : undefined;
  if (!parent) {
    node.transform.x += delta.x;
    node.transform.y += delta.y;
    return;
  }
  const matrix = worldMatrix(document, parent);
  const determinant = matrix[0] * matrix[3] - matrix[1] * matrix[2];
  if (Math.abs(determinant) < 1e-8) throw new Error('Invalid parent transform');
  node.transform.x += (matrix[3] * delta.x - matrix[2] * delta.y) / determinant;
  node.transform.y += (-matrix[1] * delta.x + matrix[0] * delta.y) / determinant;
}

export function isDescendantOf(
  document: StudioDocumentV3,
  node: StudioNode,
  ancestorId: string
): boolean {
  let parentId = node.parentFrameId;
  while (parentId) {
    if (parentId === ancestorId) return true;
    parentId = document.nodes.find(candidate => candidate.id === parentId)?.parentFrameId ?? null;
  }
  return false;
}

export interface SelectionUnit {
  ids: string[];
  bounds: Bounds;
  parentFrameId: string | null;
}

/** Group IDs are ordered outermost first. Each group moves as a single unit. */
export function selectionUnits(
  document: StudioDocumentV3,
  ids: string[],
  groupDepth = 0
): SelectionUnit[] {
  const chosen = new Set(ids);
  const nodes = document.nodes.filter(node => chosen.has(node.id));
  if (nodes.length !== chosen.size) throw new Error('Node not found');
  const effective = nodes.filter(
    node =>
      !nodes.some(
        ancestor => ancestor.type === 'frame' && isDescendantOf(document, node, ancestor.id)
      )
  );
  const units = new Map<string, StudioNode[]>();
  for (const node of effective) {
    const key = node.groupIds[groupDepth]
      ? `group:${node.groupIds[groupDepth]}`
      : `node:${node.id}`;
    const members = units.get(key) ?? [];
    members.push(node);
    units.set(key, members);
  }
  return [...units.values()].map(members => ({
    ids: members.map(node => node.id),
    bounds: unionBounds(members.map(node => worldBounds(document, node))),
    parentFrameId: members[0].parentFrameId,
  }));
}
