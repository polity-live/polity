/* @vitest-environment jsdom */

import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  setNodes: vi.fn(),
  setEdges: vi.fn(),
  onNodesChange: vi.fn(),
  onEdgesChange: vi.fn(),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@xyflow/react', async importOriginal => {
  const actual = await importOriginal<typeof import('@xyflow/react')>();

  return {
    ...actual,
    useNodesState: (initial: unknown[]) => [initial, state.setNodes, state.onNodesChange],
    useEdgesState: (initial: unknown[]) => [initial, state.setEdges, state.onEdgesChange],
  };
});

vi.mock('../AmendmentPathVisualizationView', () => ({
  AmendmentPathVisualizationView: ({
    legendOpen,
    onLegendOpenChange,
  }: {
    legendOpen: boolean;
    onLegendOpenChange: (open: boolean) => void;
  }) => (
    <button type="button" onClick={() => onLegendOpenChange(!legendOpen)}>
      {legendOpen ? 'legend-open' : 'legend-collapsed'}
    </button>
  ),
}));

import { useNetworkFlowControls } from '../../hooks/useNetworkFlowControls';
import { AmendmentPathVisualization } from '../AmendmentPathVisualization';
import { useWorkflowFlowVisualizationController } from '../useWorkflowFlowVisualizationController';

describe('network and process panel defaults', () => {
  it('starts shared network controls collapsed and still allows expanding them', () => {
    const { result } = renderHook(() => useNetworkFlowControls());

    expect(result.current.panelCollapsed).toBe(true);
    expect(result.current.legendCollapsed).toBe(true);

    act(() => {
      result.current.setPanelCollapsed(false);
      result.current.setLegendCollapsed(false);
    });

    expect(result.current.panelCollapsed).toBe(false);
    expect(result.current.legendCollapsed).toBe(false);
  });

  it('starts workflow visualizations collapsed and still allows expanding them', () => {
    const { result } = renderHook(() =>
      useWorkflowFlowVisualizationController({
        workflow: { name: 'Test workflow', steps: [] },
      })
    );

    expect(result.current.panelCollapsed).toBe(true);
    expect(result.current.legendCollapsed).toBe(true);

    act(() => {
      result.current.setPanelCollapsed(false);
      result.current.setLegendCollapsed(false);
    });

    expect(result.current.panelCollapsed).toBe(false);
    expect(result.current.legendCollapsed).toBe(false);
  });

  it('builds empty and complete workflow graphs with every node and edge role', () => {
    const workflow = {
      name: 'Test workflow',
      approvalState: 'accepted' as const,
      startGroup: { id: 'start-group', name: null },
      steps: [
        {
          id: 'step-3',
          order_index: 2,
          label: null,
          group_id: 'group-3',
          group: null,
        },
        {
          id: 'step-1',
          order_index: 0,
          label: 'Explicit label',
          group_id: 'group-1',
          group: { id: 'group-1', name: 'Named group' },
        },
        {
          id: 'step-2',
          order_index: 1,
          label: 'Fallback label',
          group_id: 'group-2',
          group: { id: 'group-2', name: null },
        },
      ],
    };
    const { result, rerender } = renderHook(
      ({ value }) => useWorkflowFlowVisualizationController({ workflow: value }),
      {
        initialProps: { value: workflow } as {
          value: Parameters<typeof useWorkflowFlowVisualizationController>[0]['workflow'];
        },
      }
    );

    const graph = result.current.buildGraph();
    expect(result.current.isAcceptedByAllGroups).toBe(true);
    expect(graph.nodes.map(node => node.data.role)).toEqual([
      'start',
      'intermediate',
      'intermediate',
      'end',
    ]);
    expect(graph.nodes.map(node => node.data.label)).toEqual([
      'start-group',
      'Named group',
      'Fallback label',
      'features.network.workflows.stepLabel',
    ]);
    expect(graph.edges).toHaveLength(3);
    expect(graph.edges.every(edge => edge.markerEnd)).toBe(true);

    act(() => result.current.handleInteractiveChange(false));
    expect(result.current.isInteractive).toBe(false);

    rerender({
      value: {
        name: 'Pending workflow',
        approvalState: 'pending' as const,
        startGroup: { id: 'start-group', name: 'Start' },
        steps: [],
      },
    });
    expect(result.current.isAcceptedByAllGroups).toBe(false);
    expect(result.current.buildGraph().nodes[0].data.label).toBe('Start');
  });

  it('starts amendment process paths collapsed and preserves the legend toggle', () => {
    render(
      <AmendmentPathVisualization
        enrichedPathData={[
          {
            id: 'segment-1',
          } as any,
        ]}
      />
    );

    const toggle = screen.getByRole('button', { name: 'legend-collapsed' });
    fireEvent.click(toggle);

    expect(screen.getByRole('button', { name: 'legend-open' })).toBeTruthy();
  });
});
