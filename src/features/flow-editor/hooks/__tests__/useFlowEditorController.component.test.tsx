/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useFlowEditorController } from '../useFlowEditorController';
import type { FlowEditorNode } from '../../types';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, values?: Record<string, unknown>) =>
    values?.newId ? `New proposal ${values.newId}` : key,
}));

describe('useFlowEditorController', () => {
  it('starts from the default workflow and can add a proposal node', () => {
    const { result } = renderHook(() => useFlowEditorController());

    expect(result.current.nodes).toHaveLength(11);
    expect(result.current.edges).toHaveLength(11);

    act(() => {
      result.current.addProposalNode();
    });

    expect(result.current.nodes).toHaveLength(12);
    expect(result.current.nodes.at(-1)?.data.label).toBe('New proposal 12');
  });

  it('clears selected graph items when the editor is locked', () => {
    const { result } = renderHook(() => useFlowEditorController());

    act(() => {
      result.current.onNodeClick(null, result.current.nodes[0] as FlowEditorNode);
    });

    expect(result.current.selectedNodes).toHaveLength(1);

    act(() => {
      result.current.handleInteractiveChange(false);
    });

    expect(result.current.isInteractive).toBe(false);
    expect(result.current.selectedNodes).toHaveLength(0);
    expect(result.current.selectedEdge).toBeNull();
  });

  it('selects, labels, resets, and deletes edges while respecting the interaction lock', () => {
    const { result } = renderHook(() => useFlowEditorController());
    act(() => {
      result.current.updateEdgeLabel();
      result.current.deleteSelectedEdge();
      result.current.resetEdgeState();
    });

    const edge = result.current.edges[0]!;
    act(() => result.current.onEdgeClick(null, edge));
    expect(result.current.selectedEdge?.id).toBe(edge.id);
    expect(result.current.edges[0]?.style).toMatchObject({ strokeWidth: 3 });
    act(() => result.current.setEdgeLabel('Updated edge'));
    act(() => result.current.updateEdgeLabel());
    expect(result.current.edges.find(item => item.id === edge.id)?.label).toBe('Updated edge');
    act(() => result.current.resetEdgeState());
    expect(result.current.edges.find(item => item.id === edge.id)?.data?.positionHandlers).toEqual(
      []
    );

    act(() => result.current.clearSelectedEdge());
    const labeledEdge = result.current.edges.find(item => typeof item.label === 'string')!;
    act(() => result.current.onEdgeClick(null, labeledEdge));
    expect(result.current.edgeLabel).toBe(labeledEdge.label);
    act(() => result.current.clearSelectedEdge());
    act(() =>
      result.current.onEdgeClick(null, {
        ...edge,
        id: 'non-string',
        label: <span>Label</span>,
      } as any)
    );
    expect(result.current.edgeLabel).toBe('');
    act(() => result.current.deleteSelectedEdge());
    expect(result.current.edges.some(item => item.id === 'non-string')).toBe(false);

    act(() => result.current.handleInteractiveChange(false));
    act(() => {
      result.current.onEdgeClick(null, result.current.edges[0]!);
      result.current.onNodeClick(null, result.current.nodes[0]!);
    });
    expect(result.current.selectedEdge).toBeNull();
    expect(result.current.selectedNodes).toEqual([]);
    act(() => result.current.handleInteractiveChange(true));
    expect(result.current.isInteractive).toBe(true);
  });

  it('edits node labels and toggles multi-selection membership', () => {
    const { result } = renderHook(() => useFlowEditorController());
    act(() => {
      result.current.startEditingNode();
      result.current.cancelEditNode();
      result.current.updateNodeProperties();
      result.current.deleteSelectedNodes();
    });

    const first = result.current.nodes[0]!;
    act(() => result.current.onNodeClick(null, result.current.nodes[0]!));
    expect(result.current.selectedNodes).toHaveLength(1);
    expect(result.current.nodes[0]?.style?.boxShadow).toBeTruthy();
    act(() => result.current.updateNodeProperties());
    act(() => result.current.startEditingNode());
    expect(result.current.isEditingNode).toBe(true);
    act(() => result.current.setNodeLabel('Renamed node'));
    act(() => result.current.updateNodeProperties());
    expect(result.current.nodes.find(node => node.id === first.id)?.data.label).toBe(
      'Renamed node'
    );

    act(() => result.current.onNodeClick(null, result.current.nodes[0]!));
    act(() => result.current.startEditingNode());
    act(() => result.current.setNodeLabel('Temporary'));
    act(() => result.current.cancelEditNode());
    expect(result.current.isEditingNode).toBe(false);
    expect(result.current.nodeLabel).toBe('Renamed node');

    const labelLessNode = {
      ...result.current.nodes[0]!,
      id: 'label-less',
      data: { label: '' },
    } as FlowEditorNode;
    act(() => result.current.onNodeClick(null, labelLessNode));
    expect(result.current.nodeLabel).toBe('');
    act(() => result.current.startEditingNode());
    act(() => result.current.cancelEditNode());
    expect(result.current.nodeLabel).toBe('');

    act(() => result.current.toggleMultiSelectMode());
    expect(result.current.multiSelectMode).toBe(true);
    act(() => {
      result.current.onNodeClick(null, result.current.nodes[0]!);
      result.current.onNodeClick(null, result.current.nodes[1]!);
    });
    expect(result.current.selectedNodes).toHaveLength(2);
    act(() => result.current.onNodeClick(null, result.current.nodes[0]!));
    expect(result.current.selectedNodes).toHaveLength(1);
    act(() => result.current.toggleMultiSelectMode());
    expect(result.current.multiSelectMode).toBe(false);
  });

  it('connects nodes and creates, ungroups, and recursively deletes groups', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1234);
    const { result } = renderHook(() => useFlowEditorController());
    act(() =>
      result.current.onConnect({ source: '1', target: '3', sourceHandle: null, targetHandle: null })
    );
    expect(result.current.edges).toHaveLength(12);
    expect(result.current.edges.at(-1)).toMatchObject({
      source: '1',
      target: '3',
      type: 'positionableedge',
      animated: true,
    });

    act(() => result.current.createGroup());
    act(() => result.current.ungroupNodes());
    act(() => result.current.onNodeClick(null, result.current.nodes[0]!));
    act(() => result.current.ungroupNodes());

    act(() => result.current.toggleMultiSelectMode());
    act(() => {
      result.current.onNodeClick(null, result.current.nodes[0]!);
      result.current.onNodeClick(null, result.current.nodes[1]!);
    });
    act(() => result.current.createGroup());
    expect(result.current.nodes[0]).toMatchObject({ id: 'group-1234', type: 'group' });
    expect(result.current.nodes.filter(node => node.parentId === 'group-1234')).toHaveLength(2);

    act(() => result.current.onNodeClick(null, result.current.nodes[0]!));
    act(() => result.current.ungroupNodes());
    expect(result.current.nodes.some(node => node.type === 'group')).toBe(false);
    expect(result.current.nodes.every(node => node.parentId == null)).toBe(true);

    act(() => result.current.toggleMultiSelectMode());
    act(() => {
      result.current.onNodeClick(null, result.current.nodes[0]!);
      result.current.onNodeClick(null, result.current.nodes[1]!);
    });
    act(() => result.current.createGroup());
    act(() => result.current.onNodeClick(null, result.current.nodes[0]!));
    act(() => result.current.deleteSelectedNodes());
    expect(result.current.nodes.some(node => node.id === 'group-1234')).toBe(false);
    expect(result.current.nodes).toHaveLength(9);
  });

  it('resets the workflow after regular node deletion', () => {
    const { result } = renderHook(() => useFlowEditorController());
    act(() => result.current.onNodeClick(null, result.current.nodes[0]!));
    act(() => result.current.deleteSelectedNodes());
    expect(result.current.nodes).toHaveLength(10);
    expect(result.current.edges.length).toBeLessThan(11);
    act(() => result.current.resetWorkflow());
    expect(result.current.nodes).toHaveLength(11);
    expect(result.current.edges).toHaveLength(11);
  });

  it('uses the default group width for selected nodes without an explicit width', () => {
    const { result } = renderHook(() => useFlowEditorController());
    const first = {
      ...result.current.nodes[0]!,
      id: 'widthless-1',
      style: {},
      position: { x: 0, y: 0 },
    } as FlowEditorNode;
    const second = {
      ...result.current.nodes[1]!,
      id: 'widthless-2',
      style: { width: 0 },
      position: { x: 200, y: 100 },
    } as FlowEditorNode;
    act(() => result.current.toggleMultiSelectMode());
    act(() => {
      result.current.onNodeClick(null, first);
      result.current.onNodeClick(null, second);
    });
    act(() => result.current.createGroup());
    expect(result.current.nodes[0]?.style?.width).toBeGreaterThan(0);
  });
});
