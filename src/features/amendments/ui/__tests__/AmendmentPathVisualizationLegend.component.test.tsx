/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

afterEach(cleanup);

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

  it('renders loading, missing-target, and calculating states', () => {
    const base = {
      t: (key: string) => key,
      nodes: [],
      edges: [],
      pathSegments: [],
    } as any;
    const { rerender } = render(
      <AmendmentPathVisualizationView {...base} amendment={null} hasTarget={false} />
    );
    expect(screen.getByText('common.network.loadingNetwork')).toBeTruthy();

    rerender(
      <AmendmentPathVisualizationView
        {...base}
        amendment={{ group: null, event: null }}
        hasTarget={false}
      />
    );
    expect(screen.getByText('features.amendments.pathVisualization.noTargetSet')).toBeTruthy();

    rerender(
      <AmendmentPathVisualizationView
        {...base}
        amendment={{ group: { name: 'Group' }, event: { title: 'Event' } }}
        hasTarget
        pathSegments={null}
      />
    );
    expect(screen.getByText('features.amendments.pathVisualization.pathCalculating')).toBeTruthy();
  });

  it('renders missing segment ids and an absent target-event date', () => {
    render(
      <AmendmentPathVisualizationView
        {...({
          t: (key: string) => key,
          nodes: [],
          edges: [],
          amendment: { group: { name: 'Group' }, event: { title: 'Event', start_date: null } },
          hasTarget: true,
          pathSegments: [{ group_id: null, event_id: null }],
        } as any)}
      />
    );
    expect(screen.getByText('common.unspecified')).toBeTruthy();
  });

  it('renders dated target events and links multiple scheduled path segments', () => {
    render(
      <AmendmentPathVisualizationView
        {...({
          t: (key: string) => key,
          nodes: [],
          edges: [],
          amendment: {
            group: { name: 'Group' },
            event: { title: 'Event', start_date: '2026-08-09T12:00:00.000Z' },
          },
          hasTarget: true,
          pathSegments: [
            { group_id: 'source', event_id: 'source-event' },
            { group_id: 'target', event_id: 'target-event' },
          ],
        } as any)}
      />
    );

    expect(screen.getByText('source-event')).toBeTruthy();
    expect(screen.getByText('target-event')).toBeTruthy();
  });
});
