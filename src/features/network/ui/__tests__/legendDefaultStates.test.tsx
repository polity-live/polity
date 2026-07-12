/* @vitest-environment jsdom */

import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@xyflow/react', async importOriginal => {
  const actual = await importOriginal<typeof import('@xyflow/react')>();

  return {
    ...actual,
    useNodesState: (initial: unknown[]) => [initial, vi.fn(), vi.fn()],
    useEdgesState: (initial: unknown[]) => [initial, vi.fn(), vi.fn()],
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
