/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EventNetworkFlowView } from '../EventNetworkFlowView';
import { GroupNetworkFlowContentView } from '../GroupNetworkFlowContentView';
import { UserNetworkFlowContentView } from '../UserNetworkFlowContentView';

const state = vi.hoisted(() => ({
  civicProps: [] as any[],
  dialogProps: [] as any[],
  workflowProps: [] as any[],
}));

vi.mock('@/features/shared/ui/form', async () => {
  const React = await import('react');
  const SelectContext = React.createContext<(value: string) => void>(() => undefined);
  return {
    FormControlSelect: ({
      children,
      onValueChange,
      ...props
    }: {
      children: ReactNode;
      onValueChange: (value: string) => void;
    }) => (
      <SelectContext.Provider value={onValueChange}>
        <div {...props}>{children}</div>
      </SelectContext.Provider>
    ),
    FormControlSelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    FormControlSelectItem: ({
      children,
      value,
      ...props
    }: {
      children: ReactNode;
      value: string;
    }) => {
      const onValueChange = React.useContext(SelectContext);
      return (
        <button type="button" onClick={() => onValueChange(value)} {...props}>
          {children}
        </button>
      );
    },
    FormControlSelectTrigger: ({ children, ...props }: { children: ReactNode }) => (
      <button type="button" {...props}>
        {children}
      </button>
    ),
    FormControlSelectValue: () => null,
  };
});

vi.mock('@/features/network/ui/CivicNetworkFlow', () => ({
  CivicNetworkFlow: (props: any) => {
    state.civicProps.push(props);
    return (
      <div data-testid="civic-network-flow">
        {props.controlsExtraContent}
        {props.legendExtraContent}
        {props.children}
      </div>
    );
  },
}));

vi.mock('@/features/network/ui/NetworkEntityDialog', () => ({
  NetworkEntityDialog: (props: any) => {
    state.dialogProps.push(props);
    return null;
  },
}));

vi.mock('@/features/network/ui/WorkflowFlowVisualization', () => ({
  WorkflowFlowVisualization: (props: any) => {
    state.workflowProps.push(props);
    return <div data-testid="workflow-visualization" />;
  },
}));

vi.mock('@/features/network/ui/NetworkFlowSkeleton', () => ({
  NetworkFlowSkeleton: ({ label }: { label: string }) => <div>{label}</div>,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  state.civicProps = [];
  state.dialogProps = [];
  state.workflowProps = [];
});

const t = (key: string) => key;

function eventProps(overrides: Record<string, unknown> = {}) {
  return {
    canManageEvent: true,
    connectionDirectionFilters: [],
    depthFilters: [],
    dialogOpen: false,
    event: { id: 'event-1', title: 'Assembly' },
    eventId: 'event-1',
    filteredEdges: [],
    filteredNodes: [],
    group: { id: 'group-1', name: 'Council' },
    handleInteractiveChange: vi.fn(),
    handleNodesChange: vi.fn(),
    handleResetLayout: vi.fn(),
    handleSaveLayout: vi.fn(),
    hasLayoutChanges: true,
    hasSavedLayout: true,
    isInteractive: false,
    isLayoutLoading: false,
    legendCollapsed: true,
    navigate: vi.fn(),
    onEdgeClick: vi.fn(),
    onEdgesChange: vi.fn(),
    onNodeClick: vi.fn(),
    panelCollapsed: true,
    relationshipStatusFilters: [],
    selectedEntity: null,
    selectedNodes: [],
    selectedRights: new Set<string>(),
    setDialogOpen: vi.fn(),
    setLegendCollapsed: vi.fn(),
    setPanelCollapsed: vi.fn(),
    t,
    toggleRight: vi.fn(),
    ...overrides,
  } as Parameters<typeof EventNetworkFlowView>[0];
}

function groupProps(overrides: Record<string, unknown> = {}) {
  return {
    connectionDirectionFilters: [],
    depthFilters: [],
    description: null,
    dialogOpen: false,
    filterRight: null,
    group: { id: 'group-1', name: 'Council' },
    groupWorkflows: [{ id: 'workflow-1', name: 'Motion path' }],
    handleInteractiveChange: vi.fn(),
    handleNodesChange: vi.fn(),
    handleResetLayout: vi.fn(),
    handleSaveLayout: vi.fn(),
    hasLayoutChanges: true,
    hasSavedLayout: true,
    isInteractive: false,
    isLayoutLoading: false,
    legendCollapsed: true,
    onEdgeClick: vi.fn(),
    onEdgesChange: vi.fn(),
    onNodeClick: vi.fn(),
    panelCollapsed: true,
    relationshipStatusFilters: [],
    renderedEdges: [],
    renderedNodes: [],
    selectedEntity: null,
    selectedRights: new Set<string>(),
    selectedWorkflowId: 'workflow-1',
    selectedWorkflowVisualization: { id: 'workflow-1' },
    setDialogOpen: vi.fn(),
    setLegendCollapsed: vi.fn(),
    setPanelCollapsed: vi.fn(),
    setSelectedWorkflowId: vi.fn(),
    setViewMode: vi.fn(),
    showWorkflowView: true,
    sortedGroupWorkflows: [{ id: 'workflow-1', name: 'Motion path' }],
    t,
    title: null,
    toggleRight: vi.fn(),
    viewMode: 'hierarchy',
    ...overrides,
  } as Parameters<typeof GroupNetworkFlowContentView>[0];
}

describe('network flow stable actions', () => {
  it('renders event loading and all interactive graph option branches', () => {
    const { rerender } = render(<EventNetworkFlowView {...eventProps({ event: null })} />);
    expect(document.querySelector('[data-testid="civic-network-flow"]')).toBeNull();

    rerender(
      <EventNetworkFlowView
        {...eventProps({
          event: { id: 'event-1', title: null },
          group: { id: 'group-1', name: null },
          filteredNodes: [
            { id: 'selected', style: { color: 'red' } },
            { id: 'plain', style: null },
          ],
          selectedNodes: ['selected'],
          isInteractive: true,
          isLayoutLoading: true,
          hasLayoutChanges: false,
          hasSavedLayout: false,
        })}
      />
    );
    let props = state.civicProps.at(-1);
    expect(props.nodes).toHaveLength(2);
    expect(props.onNodesChange).toBeTypeOf('function');
    expect(props.onEdgesChange).toBeTypeOf('function');
    expect(props.panelConfig.description).toContain('common.network.eventNetworkDescription');
    expect(props.controlsExtraContent.props.children[0].props.disabled).toBe(true);
    expect(props.controlsExtraContent.props.children[1].props.disabled).toBe(true);

    rerender(
      <EventNetworkFlowView
        {...eventProps({
          isInteractive: false,
          isLayoutLoading: false,
          hasLayoutChanges: false,
          hasSavedLayout: true,
        })}
      />
    );
    props = state.civicProps.at(-1);
    expect(props.onNodesChange).toBeUndefined();
    expect(props.onEdgesChange).toBeUndefined();
    expect(props.controlsExtraContent.props.children[0].props.disabled).toBe(true);
    expect(props.controlsExtraContent.props.children[1].props.disabled).toBe(false);
    state.dialogProps.at(-1).onOpenChange(false);

    rerender(
      <EventNetworkFlowView
        {...eventProps({ hasLayoutChanges: true, hasSavedLayout: false, isLayoutLoading: false })}
      />
    );
    expect(state.civicProps.at(-1).controlsExtraContent.props.children[1].props.disabled).toBe(
      false
    );
  });

  it('navigates from ungrouped events through stable network actions', () => {
    const navigate = vi.fn();
    const { rerender } = render(
      <EventNetworkFlowView {...eventProps({ group: null, navigate })} />
    );

    fireEvent.click(document.querySelector('[data-action-id="network.event.settings.open"]')!);
    expect(navigate).toHaveBeenCalledWith({ to: '/event/event-1/settings' });

    rerender(
      <EventNetworkFlowView {...eventProps({ canManageEvent: false, group: null, navigate })} />
    );
    fireEvent.click(document.querySelector('[data-action-id="network.event.open"]')!);
    expect(navigate).toHaveBeenCalledWith({ to: '/event/event-1' });
  });

  it('saves and resets event and user layouts through isolated controls', () => {
    const saveEvent = vi.fn();
    const resetEvent = vi.fn();
    render(
      <EventNetworkFlowView
        {...eventProps({ handleSaveLayout: saveEvent, handleResetLayout: resetEvent })}
      />
    );
    fireEvent.click(document.querySelector('[data-action-id="network.event-layout.save"]')!);
    fireEvent.click(document.querySelector('[data-action-id="network.event-layout.reset"]')!);
    expect(saveEvent).toHaveBeenCalledOnce();
    expect(resetEvent).toHaveBeenCalledOnce();

    cleanup();
    const saveUser = vi.fn();
    const resetUser = vi.fn();
    render(
      <UserNetworkFlowContentView
        {...({
          ...eventProps(),
          description: null,
          filterRight: null,
          handleSaveLayout: saveUser,
          handleResetLayout: resetUser,
          title: null,
          userProfile: { id: 'user-1', name: 'Ada' },
        } as Parameters<typeof UserNetworkFlowContentView>[0])}
      />
    );
    fireEvent.click(document.querySelector('[data-action-id="network.user-layout.save"]')!);
    fireEvent.click(document.querySelector('[data-action-id="network.user-layout.reset"]')!);
    expect(saveUser).toHaveBeenCalledOnce();
    expect(resetUser).toHaveBeenCalledOnce();
  });

  it('renders user loading, selection, labels, filters, and layout guards', () => {
    const base = {
      ...eventProps(),
      description: undefined,
      filterRight: undefined,
      title: undefined,
      userProfile: null,
    } as Parameters<typeof UserNetworkFlowContentView>[0];
    const { rerender } = render(<UserNetworkFlowContentView {...base} />);
    expect(document.querySelector('[data-testid="civic-network-flow"]')).toBeNull();

    rerender(
      <UserNetworkFlowContentView
        {...base}
        userProfile={{ id: 'user-1', name: 'Ada' }}
        filteredNodes={[
          { id: 'selected', style: { color: 'red' } },
          { id: 'plain', style: null },
        ]}
        selectedNodes={['selected']}
        isInteractive
        isLayoutLoading
        hasLayoutChanges={false}
        hasSavedLayout={false}
      />
    );
    let props = state.civicProps.at(-1);
    expect(props.nodes).toHaveLength(2);
    expect(props.onNodesChange).toBeTypeOf('function');
    expect(props.panelConfig.showRightsFilter).toBe(true);
    expect(props.controlsExtraContent.props.children[0].props.disabled).toBe(true);
    expect(props.controlsExtraContent.props.children[1].props.disabled).toBe(true);

    rerender(
      <UserNetworkFlowContentView
        {...base}
        userProfile={{ id: 'user-1', name: 'Ada' }}
        filterRight="amendmentRight"
        title="Custom"
        description="Custom description"
        isInteractive={false}
        isLayoutLoading={false}
        hasLayoutChanges={false}
        hasSavedLayout
      />
    );
    props = state.civicProps.at(-1);
    expect(props.panelConfig.title).toBe('Custom');
    expect(props.panelConfig.description).toBe('Custom description');
    expect(props.panelConfig.showRightsFilter).toBe(false);
    expect(props.onNodesChange).toBeUndefined();
    expect(props.onEdgesChange).toBeUndefined();
    expect(props.controlsExtraContent.props.children[0].props.disabled).toBe(true);
    expect(props.controlsExtraContent.props.children[1].props.disabled).toBe(false);

    rerender(
      <UserNetworkFlowContentView
        {...base}
        userProfile={{ id: 'user-1', name: 'Ada' }}
        hasLayoutChanges
        hasSavedLayout={false}
        isLayoutLoading={false}
      />
    );
    expect(state.civicProps.at(-1).controlsExtraContent.props.children[1].props.disabled).toBe(
      false
    );
  });

  it('switches group network modes and persists hierarchy layouts', () => {
    const setViewMode = vi.fn();
    const save = vi.fn();
    const reset = vi.fn();
    render(
      <GroupNetworkFlowContentView
        {...groupProps({ setViewMode, handleSaveLayout: save, handleResetLayout: reset })}
      />
    );

    fireEvent.click(
      document.querySelector('[data-action-id="network.group-flow.view.hierarchy"]')!
    );
    fireEvent.click(document.querySelector('[data-action-id="network.group-flow.view.workflow"]')!);
    fireEvent.click(document.querySelector('[data-action-id="network.group-layout.save"]')!);
    fireEvent.click(document.querySelector('[data-action-id="network.group-layout.reset"]')!);

    expect(setViewMode.mock.calls).toEqual([['hierarchy'], ['workflow']]);
    expect(save).toHaveBeenCalledOnce();
    expect(reset).toHaveBeenCalledOnce();
  });

  it('keeps workflow mode actions and selections semantically identifiable', () => {
    const setViewMode = vi.fn();
    const setSelectedWorkflowId = vi.fn();
    render(
      <GroupNetworkFlowContentView
        {...groupProps({ viewMode: 'workflow', setViewMode, setSelectedWorkflowId })}
      />
    );

    fireEvent.click(
      document.querySelector('[data-action-id="network.group-flow.empty-view.hierarchy"]')!
    );
    fireEvent.click(
      document.querySelector('[data-action-id="network.group-flow.empty-view.workflow"]')!
    );
    expect(setViewMode.mock.calls).toEqual([['hierarchy'], ['workflow']]);
    expect(
      document.querySelector('[data-action-id="network.group-flow.workflow.select"]')
    ).toBeTruthy();
    expect(
      document.querySelector('[data-action-id="network.group-flow.workflow.option"]')
    ).toBeTruthy();
    fireEvent.click(
      document.querySelector('[data-action-id="network.group-flow.workflow.option"]')!
    );
    expect(setSelectedWorkflowId).toHaveBeenCalledWith('workflow-1');
  });

  it('covers group loading, empty workflow, selection prompt, and hierarchy options', () => {
    const { rerender } = render(<GroupNetworkFlowContentView {...groupProps({ group: null })} />);
    expect(document.querySelector('[data-testid="civic-network-flow"]')).toBeNull();

    rerender(
      <GroupNetworkFlowContentView
        {...groupProps({
          viewMode: 'workflow',
          sortedGroupWorkflows: [],
          groupWorkflows: [],
          selectedWorkflowVisualization: null,
        })}
      />
    );
    expect(document.querySelector('[data-testid="workflow-visualization"]')).toBeNull();

    rerender(
      <GroupNetworkFlowContentView
        {...groupProps({
          viewMode: 'workflow',
          sortedGroupWorkflows: [{ id: 'workflow-2', name: null }],
          selectedWorkflowVisualization: null,
        })}
      />
    );
    expect(document.querySelector('[data-testid="workflow-visualization"]')).toBeNull();

    rerender(
      <GroupNetworkFlowContentView
        {...groupProps({
          showWorkflowView: false,
          groupWorkflows: [],
          title: 'Custom',
          description: 'Custom description',
          isInteractive: true,
          isLayoutLoading: true,
          hasLayoutChanges: false,
          hasSavedLayout: false,
        })}
      />
    );
    let props = state.civicProps.at(-1);
    expect(props.panelConfig.title).toBe('Custom');
    expect(props.panelConfig.description).toBe('Custom description');
    expect(props.onNodesChange).toBeTypeOf('function');
    expect(props.onEdgesChange).toBeTypeOf('function');
    expect(props.controlsExtraContent.props.children[0].props.disabled).toBe(true);
    expect(props.controlsExtraContent.props.children[1].props.disabled).toBe(true);

    rerender(
      <GroupNetworkFlowContentView
        {...groupProps({
          viewMode: 'other',
          isInteractive: false,
          isLayoutLoading: false,
          hasLayoutChanges: false,
          hasSavedLayout: true,
        })}
      />
    );
    props = state.civicProps.at(-1);
    expect(props.onNodesChange).toBeUndefined();
    expect(props.onEdgesChange).toBeUndefined();
    expect(props.controlsExtraContent.props.children[0].props.disabled).toBe(true);
    expect(props.controlsExtraContent.props.children[1].props.disabled).toBe(false);

    rerender(
      <GroupNetworkFlowContentView
        {...groupProps({ hasLayoutChanges: true, hasSavedLayout: false, isLayoutLoading: false })}
      />
    );
    expect(state.civicProps.at(-1).controlsExtraContent.props.children[1].props.disabled).toBe(
      false
    );
  });
});
