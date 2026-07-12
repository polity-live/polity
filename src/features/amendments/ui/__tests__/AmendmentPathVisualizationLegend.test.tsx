/* @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/network/ui/CivicNetworkFlow', () => ({
  CivicNetworkFlow: ({ panelConfig }: { panelConfig: any }) => (
    <div>
      <button
        type="button"
        data-testid="panel-toggle"
        data-collapsed={String(panelConfig.panelCollapsed)}
        onClick={() => panelConfig.onPanelCollapsedChange(!panelConfig.panelCollapsed)}
      >
        toggle panel
      </button>
      <button
        type="button"
        data-testid="legend-toggle"
        data-collapsed={String(panelConfig.legendCollapsed)}
        onClick={() => panelConfig.onLegendCollapsedChange(!panelConfig.legendCollapsed)}
      >
        toggle legend
      </button>
    </div>
  ),
}));

import { AmendmentPathVisualizationView } from '../AmendmentPathVisualizationView';

describe('AmendmentPathVisualizationView legend', () => {
  it('starts its main panel and nested legend collapsed and keeps both toggleable', () => {
    render(
      <AmendmentPathVisualizationView
        {...({
          t: (key: string) => key,
          nodes: [],
          edges: [],
          amendment: { group: { name: 'Group' }, event: { title: 'Event' } },
          hasTarget: true,
          pathSegments: [{}],
        } as any)}
      />
    );

    const panelToggle = screen.getByTestId('panel-toggle');
    const legendToggle = screen.getByTestId('legend-toggle');
    expect(panelToggle.getAttribute('data-collapsed')).toBe('true');
    expect(legendToggle.getAttribute('data-collapsed')).toBe('true');

    fireEvent.click(panelToggle);
    fireEvent.click(legendToggle);
    expect(panelToggle.getAttribute('data-collapsed')).toBe('false');
    expect(legendToggle.getAttribute('data-collapsed')).toBe('false');

    fireEvent.click(panelToggle);
    fireEvent.click(legendToggle);
    expect(panelToggle.getAttribute('data-collapsed')).toBe('true');
    expect(legendToggle.getAttribute('data-collapsed')).toBe('true');
  });
});
