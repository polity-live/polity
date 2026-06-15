/* @vitest-environment jsdom */

import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CivicNetworkFlow } from '../CivicNetworkFlow';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) => fallback ?? key,
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
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
  it('renders the shared left panel, legend sections, and children through one shell', () => {
    render(
      <CivicNetworkFlow
        nodes={[]}
        edges={[]}
        panelConfig={{
          title: 'Group Network',
          description: 'Network description',
          panelCollapsed: false,
          onPanelCollapsedChange: vi.fn(),
          legendCollapsed: false,
          onLegendCollapsedChange: vi.fn(),
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
    expect(screen.getByText('Network description')).toBeTruthy();
    expect(screen.getByText('Entities')).toBeTruthy();
    expect(screen.getByText('Group')).toBeTruthy();
    expect(screen.getByText('Status')).toBeTruthy();
    expect(screen.getByText('Active')).toBeTruthy();
    expect(screen.getByText('Dialog child')).toBeTruthy();
  });
});
