import type { Node } from '@xyflow/react';
import type { CSSProperties } from 'react';
import type { GroupNetworkLayout } from '@/zero/preferences';

const EMPTY_LAYOUT: GroupNetworkLayout = {
  node_positions: {},
  edge_bend_points: {},
};

const DEFAULT_NETWORK_NODE_WIDTH = 180;
const DEFAULT_NETWORK_NODE_HEIGHT = 72;
const DEFAULT_NETWORK_NODE_PADDING = 24;
const DEFAULT_NETWORK_NODE_GRID_STEP = 32;
const DEFAULT_NETWORK_NODE_SEARCH_RINGS = 80;

type NetworkLayoutNode = Pick<Node, 'id' | 'position' | 'style'> & {
  measured?: {
    width?: number;
    height?: number;
  };
  width?: number;
  height?: number;
};

interface NetworkLayoutRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ResolveInitialNetworkNodeOverlapsOptions {
  fixedNodeIds?: Iterable<string>;
  defaultWidth?: number;
  defaultHeight?: number;
  padding?: number;
  gridStep?: number;
  maxSearchRings?: number;
}

export function normalizeGroupNetworkLayout(
  layout: GroupNetworkLayout | null | undefined
): GroupNetworkLayout {
  if (!layout) {
    return EMPTY_LAYOUT;
  }

  return {
    node_positions: Object.fromEntries(
      Object.entries(layout.node_positions ?? {})
        .map(([nodeId, position]) => [nodeId, { x: position.x, y: position.y }] as const)
        .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
    ),
    edge_bend_points: Object.fromEntries(
      Object.entries(layout.edge_bend_points ?? {})
        .filter(([, bendPoints]) => Array.isArray(bendPoints) && bendPoints.length > 0)
        .map(
          ([edgeId, bendPoints]) =>
            [edgeId, bendPoints.map(bendPoint => ({ x: bendPoint.x, y: bendPoint.y }))] as const
        )
        .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
    ),
  };
}

export function areGroupNetworkLayoutsEqual(
  left: GroupNetworkLayout | null | undefined,
  right: GroupNetworkLayout | null | undefined
) {
  return (
    JSON.stringify(normalizeGroupNetworkLayout(left)) ===
    JSON.stringify(normalizeGroupNetworkLayout(right))
  );
}

function parseNetworkNodeDimension(value: CSSProperties['width'], fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return fallback;
}

function getNetworkNodeSize(node: NetworkLayoutNode, defaultWidth: number, defaultHeight: number) {
  return {
    width: parseNetworkNodeDimension(
      node.style?.width ?? node.measured?.width ?? node.width,
      defaultWidth
    ),
    height: parseNetworkNodeDimension(
      node.style?.height ?? node.measured?.height ?? node.height,
      defaultHeight
    ),
  };
}

function getNetworkNodeRect(
  node: NetworkLayoutNode,
  position: { x: number; y: number },
  options: {
    defaultWidth: number;
    defaultHeight: number;
    padding: number;
  }
): NetworkLayoutRect {
  const { width, height } = getNetworkNodeSize(node, options.defaultWidth, options.defaultHeight);
  const halfPadding = options.padding / 2;

  return {
    x: position.x - halfPadding,
    y: position.y - halfPadding,
    width: width + options.padding,
    height: height + options.padding,
  };
}

function doNetworkNodeRectsOverlap(left: NetworkLayoutRect, right: NetworkLayoutRect) {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

function isNetworkNodePositionFree(rect: NetworkLayoutRect, placedRects: NetworkLayoutRect[]) {
  return !placedRects.some(placedRect => doNetworkNodeRectsOverlap(rect, placedRect));
}

function getRingOffsets(ring: number, gridStep: number) {
  const offsets: { x: number; y: number }[] = [];

  for (let x = -ring; x <= ring; x += 1) {
    offsets.push({ x: x * gridStep, y: -ring * gridStep });
    offsets.push({ x: x * gridStep, y: ring * gridStep });
  }

  for (let y = -ring + 1; y <= ring - 1; y += 1) {
    offsets.push({ x: -ring * gridStep, y: y * gridStep });
    offsets.push({ x: ring * gridStep, y: y * gridStep });
  }

  return offsets.sort((left, right) => {
    const leftDistance = left.x * left.x + left.y * left.y;
    const rightDistance = right.x * right.x + right.y * right.y;

    if (leftDistance !== rightDistance) {
      return leftDistance - rightDistance;
    }

    if (left.y !== right.y) {
      return left.y - right.y;
    }

    return left.x - right.x;
  });
}

function findNearestFreeNetworkNodePosition(
  node: NetworkLayoutNode,
  placedRects: NetworkLayoutRect[],
  options: {
    defaultWidth: number;
    defaultHeight: number;
    padding: number;
    gridStep: number;
    maxSearchRings: number;
  }
) {
  const preferredPosition = node.position;
  const preferredRect = getNetworkNodeRect(node, preferredPosition, options);

  if (isNetworkNodePositionFree(preferredRect, placedRects)) {
    return preferredPosition;
  }

  for (let ring = 1; ring <= options.maxSearchRings; ring += 1) {
    for (const offset of getRingOffsets(ring, options.gridStep)) {
      const candidatePosition = {
        x: preferredPosition.x + offset.x,
        y: preferredPosition.y + offset.y,
      };
      const candidateRect = getNetworkNodeRect(node, candidatePosition, options);

      if (isNetworkNodePositionFree(candidateRect, placedRects)) {
        return candidatePosition;
      }
    }
  }

  for (let step = options.maxSearchRings + 1; step < options.maxSearchRings + 1000; step += 1) {
    const candidatePosition = {
      x: preferredPosition.x,
      y: preferredPosition.y + step * options.gridStep,
    };
    const candidateRect = getNetworkNodeRect(node, candidatePosition, options);

    if (isNetworkNodePositionFree(candidateRect, placedRects)) {
      return candidatePosition;
    }
  }

  return preferredPosition;
}

export function resolveInitialNetworkNodeOverlaps<TNode extends NetworkLayoutNode>(
  nodes: readonly TNode[],
  options: ResolveInitialNetworkNodeOverlapsOptions = {}
): TNode[] {
  const fixedNodeIds = new Set(options.fixedNodeIds ?? []);
  const resolvedPositions = new Map<string, { x: number; y: number }>();
  const placedRects: NetworkLayoutRect[] = [];
  const layoutOptions = {
    defaultWidth: options.defaultWidth ?? DEFAULT_NETWORK_NODE_WIDTH,
    defaultHeight: options.defaultHeight ?? DEFAULT_NETWORK_NODE_HEIGHT,
    padding: options.padding ?? DEFAULT_NETWORK_NODE_PADDING,
    gridStep: options.gridStep ?? DEFAULT_NETWORK_NODE_GRID_STEP,
    maxSearchRings: options.maxSearchRings ?? DEFAULT_NETWORK_NODE_SEARCH_RINGS,
  };
  const addPlacedNode = (node: TNode, position: { x: number; y: number }) => {
    resolvedPositions.set(node.id, position);
    placedRects.push(getNetworkNodeRect(node, position, layoutOptions));
  };

  nodes.forEach(node => {
    if (fixedNodeIds.has(node.id)) {
      addPlacedNode(node, node.position);
    }
  });

  nodes.forEach(node => {
    if (fixedNodeIds.has(node.id)) {
      return;
    }

    addPlacedNode(node, findNearestFreeNetworkNodePosition(node, placedRects, layoutOptions));
  });

  return nodes.map(node => {
    const resolvedPosition = resolvedPositions.get(node.id);

    if (!resolvedPosition || resolvedPosition === node.position) {
      return node;
    }

    return {
      ...node,
      position: resolvedPosition,
    };
  });
}
