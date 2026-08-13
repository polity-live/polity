/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const applyNodeChangesMock = vi.hoisted(() => vi.fn());
vi.mock('@xyflow/react', () => ({
  applyNodeChanges: (...args: unknown[]) => applyNodeChangesMock(...args),
}));

import { useEditableNetworkLayout } from '../useEditableNetworkLayout';

describe('useEditableNetworkLayout', () => {
  beforeEach(() => applyNodeChangesMock.mockReset());

  it('tracks node positions, edge bends, saved state, and interaction decoration', () => {
    let currentNodes = [
      { id: 'node-a', position: { x: 1, y: 2 }, data: {} },
      { id: 'node-b', position: { x: 3, y: 4 }, data: {} },
    ] as any[];
    let currentEdges = [
      { id: 'edge-a', source: 'node-a', target: 'node-b', data: { bendPoints: [{ x: 5, y: 6 }] } },
      { id: 'edge-b', source: 'node-b', target: 'node-a', data: { bendPoints: [] } },
      { id: 'edge-c', source: 'node-a', target: 'node-b', data: { bendPoints: 'invalid' } },
      { id: 'edge-d', source: 'node-a', target: 'node-b' },
    ] as any[];
    const setNodes = vi.fn((action: any) => {
      currentNodes = typeof action === 'function' ? action(currentNodes) : action;
    });
    const setEdges = vi.fn((action: any) => {
      currentEdges = typeof action === 'function' ? action(currentEdges) : action;
    });
    applyNodeChangesMock.mockImplementation((_changes, nodes = currentNodes) =>
      nodes.map((node: any) =>
        node.id === 'node-a' ? { ...node, position: { x: 10, y: 20 } } : node
      )
    );

    const { result, rerender } = renderHook(props => useEditableNetworkLayout(props as never), {
      initialProps: {
        nodes: currentNodes,
        edges: currentEdges,
        setNodes,
        setEdges,
        savedLayout: null as any,
        isInteractive: true,
      },
    });

    expect(result.current.currentLayout.node_positions).toEqual({
      'node-a': { x: 1, y: 2 },
      'node-b': { x: 3, y: 4 },
    });
    expect(result.current.currentLayout.edge_bend_points).toEqual({
      'edge-a': [{ x: 5, y: 6 }],
    });
    expect(result.current.hasLayoutChanges).toBe(true);

    act(() =>
      result.current.handleNodesChange([
        { id: 'node-a', type: 'position', position: { x: 10, y: 20 } },
        { id: 'node-b', type: 'select', selected: true },
      ] as never)
    );
    expect(result.current.fixedNodeIdsRef.current.has('node-a')).toBe(true);
    expect(result.current.nodePositionsRef.current['node-a']).toEqual({ x: 10, y: 20 });

    result.current.edgeBendPointsRef.current = {
      'edge-a': [{ x: 1, y: 1 }],
      'edge-b': [{ x: 2, y: 2 }],
    };
    act(() => result.current.handleEdgeBendPointsChange('edge-a', []));
    expect(result.current.edgeBendPointsRef.current).toEqual({
      'edge-b': [{ x: 2, y: 2 }],
    });
    act(() => result.current.handleEdgeBendPointsChange('edge-b', [{ x: 9, y: 9 }]));
    expect(result.current.edgeBendPointsRef.current['edge-b']).toEqual([{ x: 9, y: 9 }]);

    const decoratedExisting = result.current.decorateEdgeData('edge-b', { rights: [] } as never);
    expect(decoratedExisting).toMatchObject({
      bendPoints: [{ x: 9, y: 9 }],
      edgeEditingEnabled: true,
    });
    expect(result.current.decorateEdgeData('missing', { rights: [] } as never).bendPoints).toEqual(
      []
    );

    act(() =>
      result.current.syncGeneratedLayoutState(
        [{ id: 'generated', position: { x: 7, y: 8 }, data: {} }] as never,
        [
          { id: 'generated-edge', data: { bendPoints: [{ x: 4, y: 4 }] } },
          { id: 'empty-edge', data: { bendPoints: [] } },
          { id: 'invalid-edge', data: { bendPoints: null } },
        ] as never
      )
    );
    expect(result.current.nodePositionsRef.current).toEqual({ generated: { x: 7, y: 8 } });
    expect(result.current.edgeBendPointsRef.current).toEqual({
      'generated-edge': [{ x: 4, y: 4 }],
    });

    rerender({
      nodes: currentNodes,
      edges: currentEdges,
      setNodes,
      setEdges,
      savedLayout: {
        node_positions: { saved: { x: 11, y: 12 } },
        edge_bend_points: { savedEdge: [{ x: 13, y: 14 }] },
      },
      isInteractive: false,
    });
    expect(result.current.nodePositionsRef.current).toEqual({ saved: { x: 11, y: 12 } });
    expect(result.current.edgeBendPointsRef.current).toEqual({
      savedEdge: [{ x: 13, y: 14 }],
    });
    expect(result.current.fixedNodeIdsRef.current).toEqual(new Set(['saved']));
    expect(result.current.isInteractiveRef.current).toBe(false);

    act(() => result.current.clearPersistedLayoutState());
    expect(result.current.nodePositionsRef.current).toEqual({});
    expect(result.current.edgeBendPointsRef.current).toEqual({});
    expect(result.current.fixedNodeIdsRef.current.size).toBe(0);
  });
});
