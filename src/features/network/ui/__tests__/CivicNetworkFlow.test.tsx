/* @vitest-environment jsdom */

import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CivicNetworkFlow } from '../CivicNetworkFlow';
import { RightFilters } from '../RightFilters';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) =>
    key === 'common.network.membershipLabel' ? 'Membership' : (fallback ?? key),
  useTranslation: () => ({
    t: (key: string, fallback?: string) =>
      key === 'common.network.membershipLabel' ? 'Membership' : (fallback ?? key),
  }),
}));

vi.mock('@/features/network/ui/NetworkFlowBase', () => ({
  NetworkFlowBase: ({ panel, children }: { panel: ReactNode; children?: ReactNode }) => (
    <div data-testid="network-flow-base">
      {panel}
      <div data-testid="network-flow-children">{children}</div>
    </div>
  ),
  Panel: ({ children }: { children: ReactNode }) => (
    <aside data-testid="network-panel">{children}</aside>
  ),
}));

describe('CivicNetworkFlow', () => {
  it('renders every React Flow legend collapsed initially and keeps it toggleable', () => {
    const onPanelCollapsedChange = vi.fn();
    const onLegendCollapsedChange = vi.fn();

    render(
      <CivicNetworkFlow
        nodes={[]}
        edges={[]}
        panelConfig={{
          title: 'Group Network',
          description: 'Network description',
          panelCollapsed: false,
          onPanelCollapsedChange,
          legendCollapsed: false,
          onLegendCollapsedChange,
          legendTitle: 'Legend',
          showDisplayControls: false,
          showInteractiveToggle: false,
          isInteractive: false,
          onInteractiveChange: vi.fn(),
        }}
        legendSections={[
          {
            id: 'entities',
            title: 'Entities',
            items: [{ id: 'group', label: 'Group' }],
          },
          {
            id: 'status',
            title: 'Status',
            items: [{ id: 'active', label: 'Active' }],
          },
        ]}
      >
        <div>Dialog child</div>
      </CivicNetworkFlow>
    );

    expect(screen.getByTestId('network-flow-base')).toBeTruthy();
    expect(screen.getByTestId('network-panel')).toBeTruthy();
    expect(screen.getByText('Group Network')).toBeTruthy();
    expect(screen.queryByText('Network description')).toBeNull();
    expect(screen.queryByText('Entities')).toBeNull();
    expect(screen.queryByText('Group')).toBeNull();
    expect(screen.queryByText('Status')).toBeNull();
    expect(screen.queryByText('Active')).toBeNull();
    expect(screen.getByText('Dialog child')).toBeTruthy();

    const panelToggle = screen.getByRole('button', { name: 'Group Network' });
    expect(panelToggle.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(panelToggle);

    expect(panelToggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Network description')).toBeTruthy();
    expect(onPanelCollapsedChange).toHaveBeenLastCalledWith(false);

    const legendToggle = screen.getByRole('button', { name: 'Legend' });
    expect(legendToggle.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(legendToggle);

    expect(legendToggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Entities')).toBeTruthy();
    expect(screen.getByText('Group')).toBeTruthy();
    expect(screen.getByText('Status')).toBeTruthy();
    expect(screen.getByText('Active')).toBeTruthy();
    expect(onLegendCollapsedChange).toHaveBeenLastCalledWith(false);

    fireEvent.click(legendToggle);

    expect(legendToggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Entities')).toBeNull();
    expect(onLegendCollapsedChange).toHaveBeenLastCalledWith(true);

    fireEvent.click(panelToggle);

    expect(panelToggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Network description')).toBeNull();
    expect(onPanelCollapsedChange).toHaveBeenLastCalledWith(true);
  });

  it('shows membership as an additional flow filter option', () => {
    render(<RightFilters selectedRights={new Set(['membership'])} onToggleRight={vi.fn()} />);

    expect(screen.getByText('Membership')).toBeTruthy();
  });
});
