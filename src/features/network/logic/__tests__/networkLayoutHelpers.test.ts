import { describe, expect, it } from 'vitest';

import {
  areGroupNetworkLayoutsEqual,
  normalizeGroupNetworkLayout,
  resolveInitialNetworkNodeOverlaps,
} from '../networkLayoutHelpers';

function testNode(
  id: string,
  position: { x: number; y: number },
  style: { width?: number; height?: number } = { width: 180, height: 72 }
) {
  return {
    id,
    position,
    style,
    data: {},
  };
}

function getRect(node: ReturnType<typeof testNode>) {
  return {
    x: node.position.x,
    y: node.position.y,
    width: node.style.width ?? 180,
    height: node.style.height ?? 72,
  };
}

function doRectsOverlap(left: ReturnType<typeof getRect>, right: ReturnType<typeof getRect>) {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

function expectNoNodeOverlaps(nodes: ReturnType<typeof testNode>[]) {
  nodes.forEach((left, leftIndex) => {
    nodes.slice(leftIndex + 1).forEach(right => {
      expect(doRectsOverlap(getRect(left), getRect(right))).toBe(false);
    });
  });
}

function getPositions(nodes: ReturnType<typeof testNode>[]) {
  return Object.fromEntries(nodes.map(node => [node.id, node.position]));
}

describe('networkLayoutHelpers', () => {
  it('treats layouts with the same content as equal even when their key order differs', () => {
    expect(
      areGroupNetworkLayoutsEqual(
        {
          node_positions: {
            'node-b': { x: 20, y: 40 },
            'node-a': { x: 10, y: 30 },
          },
          edge_bend_points: {
            'edge-b': [{ x: 5, y: 6 }],
            'edge-a': [{ x: 1, y: 2 }],
          },
        },
        {
          node_positions: {
            'node-a': { x: 10, y: 30 },
            'node-b': { x: 20, y: 40 },
          },
          edge_bend_points: {
            'edge-a': [{ x: 1, y: 2 }],
            'edge-b': [{ x: 5, y: 6 }],
          },
        }
      )
    ).toBe(true);
  });

  it('drops empty bend-point entries when normalizing a layout', () => {
    expect(
      normalizeGroupNetworkLayout({
        node_positions: {
          'node-b': { x: 20, y: 40 },
          'node-a': { x: 10, y: 30 },
        },
        edge_bend_points: {
          'edge-b': [],
          'edge-a': [{ x: 1, y: 2 }],
        },
      })
    ).toEqual({
      node_positions: {
        'node-a': { x: 10, y: 30 },
        'node-b': { x: 20, y: 40 },
      },
      edge_bend_points: {
        'edge-a': [{ x: 1, y: 2 }],
      },
    });
  });

  it('separates two overlapping generated nodes', () => {
    const resolvedNodes = resolveInitialNetworkNodeOverlaps([
      testNode('node-a', { x: 100, y: 100 }),
      testNode('node-b', { x: 100, y: 100 }),
    ]);

    expect(resolvedNodes[0].position).toEqual({ x: 100, y: 100 });
    expect(resolvedNodes[1].position).not.toEqual({ x: 100, y: 100 });
    expectNoNodeOverlaps(resolvedNodes);
  });

  it('preserves generated nodes that already have enough room', () => {
    const nodes = [
      testNode('node-a', { x: 100, y: 100 }),
      testNode('node-b', { x: 340, y: 100 }),
      testNode('node-c', { x: 100, y: 220 }),
    ];

    expect(getPositions(resolveInitialNetworkNodeOverlaps(nodes))).toEqual(getPositions(nodes));
  });

  it('keeps fixed persisted or manually moved nodes in place', () => {
    const resolvedNodes = resolveInitialNetworkNodeOverlaps(
      [testNode('fixed-node', { x: 100, y: 100 }), testNode('generated-node', { x: 100, y: 100 })],
      { fixedNodeIds: ['fixed-node'] }
    );

    expect(resolvedNodes.find(node => node.id === 'fixed-node')?.position).toEqual({
      x: 100,
      y: 100,
    });
    expect(resolvedNodes.find(node => node.id === 'generated-node')?.position).not.toEqual({
      x: 100,
      y: 100,
    });
    expectNoNodeOverlaps(resolvedNodes);
  });

  it('produces stable positions for identical generated input', () => {
    const nodes = [
      testNode('user', { x: 400, y: 300 }, { width: 180, height: 180 }),
      testNode('group-a', { x: 400, y: 420 }),
      testNode('group-b', { x: 430, y: 430 }),
      testNode('group-c', { x: 450, y: 450 }),
    ];

    expect(getPositions(resolveInitialNetworkNodeOverlaps(nodes))).toEqual(
      getPositions(resolveInitialNetworkNodeOverlaps(nodes.map(node => ({ ...node }))))
    );
  });

  it('handles mixed node sizes such as 180x180 center nodes', () => {
    const resolvedNodes = resolveInitialNetworkNodeOverlaps([
      testNode('center-user', { x: 400, y: 300 }, { width: 180, height: 180 }),
      testNode('current-group', { x: 430, y: 390 }, { width: 180 }),
      testNode('event-node', { x: 450, y: 410 }, { width: 200 }),
    ]);

    expect(resolvedNodes.find(node => node.id === 'center-user')?.position).toEqual({
      x: 400,
      y: 300,
    });
    expectNoNodeOverlaps(resolvedNodes);
  });
});
