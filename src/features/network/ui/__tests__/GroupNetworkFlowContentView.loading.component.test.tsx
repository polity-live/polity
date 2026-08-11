/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GroupNetworkFlowContentView } from '../GroupNetworkFlowContentView';
import { UserNetworkFlowContentView } from '../UserNetworkFlowContentView';

afterEach(() => {
  cleanup();
});

describe('GroupNetworkFlowContentView loading state', () => {
  it('renders a graph-shaped skeleton while the group network loads', () => {
    render(
      <GroupNetworkFlowContentView
        connectionDirectionFilters={[]}
        depthFilters={[]}
        description={null}
        dialogOpen={false}
        edges={[]}
        filterRight={null}
        group={null}
        groupWorkflows={[]}
        handleInteractiveChange={vi.fn()}
        handleNodesChange={vi.fn()}
        handleResetLayout={vi.fn()}
        handleSaveLayout={vi.fn()}
        hasLayoutChanges={false}
        hasSavedLayout={false}
        isInteractive={false}
        isLayoutLoading={false}
        legendCollapsed={false}
        nodes={[]}
        onEdgeClick={vi.fn()}
        onEdgesChange={vi.fn()}
        onNodeClick={vi.fn()}
        panelCollapsed={false}
        relationshipStatusFilters={[]}
        renderedEdges={[]}
        renderedNodes={[]}
        selectedEntity={null}
        selectedRights={[]}
        selectedWorkflowId=""
        selectedWorkflowVisualization={null}
        setDialogOpen={vi.fn()}
        setLegendCollapsed={vi.fn()}
        setPanelCollapsed={vi.fn()}
        setSelectedWorkflowId={vi.fn()}
        setViewMode={vi.fn()}
        showWorkflowView={false}
        sortedGroupWorkflows={[]}
        t={(key: string) =>
          key === 'common.network.loadingGroupNetwork' ? 'Loading network' : key
        }
        title={null}
        toggleRight={vi.fn()}
        viewMode="hierarchy"
      />
    );

    expect(screen.getByText('Loading network')).toBeTruthy();
    expect(document.querySelector('[data-slot="network-flow-skeleton"]')).toBeTruthy();
  });
});

describe('UserNetworkFlowContentView loading state', () => {
  it('renders a graph-shaped skeleton while the user network loads', () => {
    render(
      <UserNetworkFlowContentView
        connectionDirectionFilters={[]}
        depthFilters={[]}
        description={null}
        dialogOpen={false}
        edges={[]}
        filteredEdges={[]}
        filteredNodes={[]}
        filterRight={null}
        handleInteractiveChange={vi.fn()}
        handleNodesChange={vi.fn()}
        handleResetLayout={vi.fn()}
        handleSaveLayout={vi.fn()}
        hasLayoutChanges={false}
        hasSavedLayout={false}
        isInteractive={false}
        isLayoutLoading={false}
        legendCollapsed={false}
        nodes={[]}
        onEdgeClick={vi.fn()}
        onEdgesChange={vi.fn()}
        onNodeClick={vi.fn()}
        panelCollapsed={false}
        relationshipStatusFilters={[]}
        selectedEntity={null}
        selectedNodes={[]}
        selectedRights={[]}
        setDialogOpen={vi.fn()}
        setLegendCollapsed={vi.fn()}
        setPanelCollapsed={vi.fn()}
        t={(key: string) => (key === 'common.network.loadingNetwork' ? 'Loading network' : key)}
        title={null}
        toggleRight={vi.fn()}
        userProfile={null}
      />
    );

    expect(screen.getByText('Loading network')).toBeTruthy();
    expect(document.querySelector('[data-slot="network-flow-skeleton"]')).toBeTruthy();
  });
});
