/* @vitest-environment jsdom */

import { act, cleanup, fireEvent, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NetworkFlowBase, NetworkFlowBaseView, useEdgeClickContext } from '../NetworkFlowBase';
import { RightsLabelEdgeView } from '../RightsLabelEdgeView';
import { WorkflowFlowVisualizationView } from '../WorkflowFlowVisualizationView';

const state = vi.hoisted(() => ({
  baseEdgeProps: [] as any[],
  civicProps: [] as any[],
  rightBadgeProps: [] as any[],
  fitView: vi.fn(),
  miniMapProps: [] as any[],
  reactFlowProps: [] as any[],
}));

vi.mock('@xyflow/react', () => ({
  Background: () => null,
  BaseEdge: (props: any) => {
    state.baseEdgeProps.push(props);
    return null;
  },
  ControlButton: ({ children, ...props }: { children: ReactNode }) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  Controls: ({ children, ...props }: any) => (
    <div data-controls={String(Boolean(props.onInteractiveChange))}>{children}</div>
  ),
  EdgeLabelRenderer: ({ children }: { children: ReactNode }) => <>{children}</>,
  MiniMap: (props: any) => {
    state.miniMapProps.push(props);
    return null;
  },
  Panel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ReactFlow: (props: any) => {
    state.reactFlowProps.push(props);
    return <div>{props.children}</div>;
  },
  useReactFlow: () => ({ fitView: state.fitView }),
}));

vi.mock('@/features/shared/ui/status', () => ({
  RightBadge: (props: any) => {
    state.rightBadgeProps.push(props);
    return <span>{props.right}</span>;
  },
}));

vi.mock('@/features/network/ui/CivicNetworkFlow', () => ({
  CivicNetworkFlow: (props: any) => {
    state.civicProps.push(props);
    return <div data-testid="workflow-flow" />;
  },
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  state.baseEdgeProps = [];
  state.civicProps = [];
  state.rightBadgeProps = [];
  state.fitView.mockReset();
  state.miniMapProps = [];
  state.reactFlowProps = [];
});

describe('network graph stable actions', () => {
  function EdgeContextAction() {
    const onEdgeLabelClick = useEdgeClickContext();
    return (
      <button type="button" onClick={() => onEdgeLabelClick?.('edge-1')}>
        edge context
      </button>
    );
  }

  it('toggles fullscreen and edits relationship edges through semantic graph actions', () => {
    const onFullscreenChange = vi.fn();
    render(
      <NetworkFlowBaseView
        nodes={[]}
        edges={[]}
        panel={null}
        isFullscreen={false}
        onFullscreenChange={onFullscreenChange}
      />
    );
    fireEvent.click(document.querySelector('[data-action-id="network.flow.fullscreen.toggle"]')!);
    expect(onFullscreenChange).toHaveBeenCalledWith(true);

    cleanup();
    const openRelationship = vi.fn();
    const removeBendPoint = vi.fn();
    const handleBendPointKeyDown = vi.fn();
    render(
      <svg>
        <RightsLabelEdgeView
          {...({
            id: 'edge-1',
            style: {},
            markerStart: null,
            markerEnd: null,
            data: { contextLabel: 'Membership' },
            dragState: null,
            setDragState: vi.fn(),
            bendPoints: [{ x: 20, y: 30 }],
            edgeEditingEnabled: true,
            edgeSegments: [{ edgePath: 'M 0 0 L 20 30' }],
            middleSegment: { labelX: 10, labelY: 15 },
            openRelationshipDetailsLabel: 'Open relationship',
            moveBendPointLabel: 'Move bend point',
            removeBendPointLabel: 'Remove bend point',
            displayRights: [],
            rightRelationshipKinds: {},
            removeBendPoint,
            handleBendPointKeyDown,
            handleLabelClick: openRelationship,
            isDragging: false,
            middleSegmentIndex: 0,
            startSegmentDrag: vi.fn(),
          } as unknown as Parameters<typeof RightsLabelEdgeView>[0])}
        />
      </svg>
    );

    fireEvent.click(document.querySelector('[data-action-id="network.edge.relationship.open"]')!);
    const move = document.querySelector('[data-action-id="network.edge.bend-point.move"]')!;
    fireEvent.keyDown(move, { key: 'ArrowRight' });
    fireEvent.click(document.querySelector('[data-action-id="network.edge.bend-point.remove"]')!);

    expect(openRelationship).toHaveBeenCalledOnce();
    expect(handleBendPointKeyDown).toHaveBeenCalledWith(expect.anything(), 0);
    expect(removeBendPoint).toHaveBeenCalledWith(0);
  });

  it('covers flow defaults, minimap overrides, context, refit, and fullscreen states', () => {
    vi.useFakeTimers();
    const onEdgeClick = vi.fn();
    const onInteractiveChange = vi.fn();
    const { rerender, unmount } = render(
      <NetworkFlowBase
        nodes={[{ id: 'node-b' }, { id: 'node-a' }] as never}
        edges={[{ id: 'edge-1' }] as never}
        panel={<div>Panel</div>}
        onEdgeClick={onEdgeClick}
        onInteractiveChange={onInteractiveChange}
      >
        <EdgeContextAction />
      </NetworkFlowBase>
    );
    let flow = state.reactFlowProps.at(-1);
    expect(flow.nodesDraggable).toBe(true);
    expect(flow.nodesFocusable).toBe(true);
    expect(flow.nodesConnectable).toBe(true);
    expect(flow.edgesFocusable).toBe(true);
    expect(state.miniMapProps.at(-1).nodeColor).toBeTypeOf('function');
    expect(state.miniMapProps.at(-1).maskColor).toContain('color-mix');
    fireEvent.click(
      Array.from(document.querySelectorAll('button')).find(
        button => button.textContent === 'edge context'
      )!
    );
    expect(onEdgeClick).toHaveBeenCalled();

    rerender(
      <NetworkFlowBase
        nodes={[{ id: 'node-c' }] as never}
        edges={[]}
        panel={null}
        nodesDraggable={false}
        nodesFocusable={false}
        nodesConnectable={false}
        edgesFocusable={false}
        containerClassName="custom-container"
        miniMapProps={{ nodeColor: 'red', maskColor: 'blue', className: 'custom-map' } as never}
      />
    );
    flow = state.reactFlowProps.at(-1);
    expect(flow.nodesDraggable).toBe(false);
    expect(state.miniMapProps.at(-1)).toMatchObject({
      nodeColor: 'red',
      maskColor: 'blue',
    });
    act(() => vi.runAllTimers());
    expect(state.fitView).toHaveBeenCalled();

    rerender(
      <NetworkFlowBase
        nodes={[{ id: 'node-d' }] as never}
        edges={[]}
        panel={null}
        showMiniMap={false}
      />
    );
    unmount();
    vi.runAllTimers();
    vi.useRealTimers();

    const onFullscreenChange = vi.fn();
    const fullscreen = render(
      <NetworkFlowBaseView
        nodes={[]}
        edges={[]}
        panel={null}
        isFullscreen
        showMiniMap={false}
        onFullscreenChange={onFullscreenChange}
      />
    );
    fireEvent.click(document.querySelector('[data-action-id="network.flow.fullscreen.toggle"]')!);
    expect(onFullscreenChange).toHaveBeenCalledWith(false);
    fullscreen.unmount();
  });

  it('renders every edge segment, label, relationship-kind, and editing branch', () => {
    const startSegmentDrag = vi.fn();
    const setDragState = vi.fn();
    const handleLabelClick = vi.fn();
    const handleBendPointKeyDown = vi.fn();
    const removeBendPoint = vi.fn();
    const base = {
      id: 'edge-2',
      style: {},
      markerStart: 'start',
      markerEnd: 'end',
      data: { contextLabel: 42 },
      dragState: null,
      setDragState,
      bendPoints: [],
      edgeEditingEnabled: false,
      edgeSegments: [{ edgePath: 'M 0 0 L 10 10' }, { edgePath: 'M 10 10 L 20 20' }],
      middleSegment: null,
      openRelationshipDetailsLabel: 'Open relationship',
      moveBendPointLabel: 'Move bend point',
      removeBendPointLabel: 'Remove bend point',
      displayRights: [],
      rightRelationshipKinds: {},
      removeBendPoint,
      handleBendPointKeyDown,
      handleLabelClick,
      isDragging: false,
      middleSegmentIndex: 0,
      startSegmentDrag,
    } as unknown as Parameters<typeof RightsLabelEdgeView>[0];
    const { rerender } = render(<RightsLabelEdgeView {...base} />);
    expect(state.baseEdgeProps).toHaveLength(2);
    expect(state.baseEdgeProps[0].markerStart).toBe('start');
    expect(state.baseEdgeProps[0].markerEnd).toBeUndefined();
    expect(state.baseEdgeProps[1].markerStart).toBeUndefined();
    expect(state.baseEdgeProps[1].markerEnd).toBe('end');
    fireEvent.mouseDown(document.querySelector('path')!);
    expect(startSegmentDrag).toHaveBeenCalledWith(expect.anything(), 0, true);

    rerender(
      <svg>
        <RightsLabelEdgeView
          {...base}
          data={{ contextLabel: 'Context' }}
          middleSegment={{ labelX: 10, labelY: 10 }}
        />
      </svg>
    );
    fireEvent.mouseDown(
      document.querySelector('[data-action-id="network.edge.relationship.open"]')!
    );
    fireEvent.click(document.querySelector('[data-action-id="network.edge.relationship.open"]')!);
    expect(startSegmentDrag).toHaveBeenCalledWith(expect.anything(), 0);
    expect(handleLabelClick).toHaveBeenCalledOnce();

    rerender(
      <svg>
        <RightsLabelEdgeView
          {...base}
          data={{ contextLabel: null }}
          edgeEditingEnabled
          isDragging
          middleSegment={{ labelX: 10, labelY: 10 }}
          displayRights={['incomingRight', 'outgoingRight', 'plainRight']}
          rightRelationshipKinds={{
            incomingRight: 'incoming',
            outgoingRight: 'outgoing',
            plainRight: 'other',
          }}
          bendPoints={[
            { x: 1, y: 2 },
            { x: 3, y: 4 },
          ]}
          dragState={{ kind: 'bend-point', bendPointIndex: 0, isActive: true }}
        />
      </svg>
    );
    expect(state.rightBadgeProps.slice(-3).map(item => item.requestKind)).toEqual([
      'incoming',
      'outgoing',
      null,
    ]);
    const moves = document.querySelectorAll('[data-action-id="network.edge.bend-point.move"]');
    fireEvent.mouseDown(moves[0], { clientX: 12, clientY: 14 });
    fireEvent.click(moves[0]);
    fireEvent.keyDown(moves[1], { key: 'ArrowLeft' });
    expect(setDragState).toHaveBeenCalledWith(
      expect.objectContaining({ bendPointIndex: 0, startClientX: 12, startClientY: 14 })
    );
    expect(handleBendPointKeyDown).toHaveBeenCalledWith(expect.anything(), 1);
    const removes = document.querySelectorAll('[data-action-id="network.edge.bend-point.remove"]');
    fireEvent.mouseDown(removes[0]);
    fireEvent.click(removes[1]);
    expect(removeBendPoint).toHaveBeenCalledWith(1);

    rerender(
      <svg>
        <RightsLabelEdgeView
          {...base}
          edgeEditingEnabled
          bendPoints={[{ x: 1, y: 2 }]}
          dragState={{ kind: 'segment', bendPointIndex: 0, isActive: true }}
        />
      </svg>
    );
  });

  it('renders empty, accepted, pending, interactive, and readonly workflow views', () => {
    const base = {
      workflow: { name: null, description: null },
      t: (key: string) => key,
      panelCollapsed: true,
      setPanelCollapsed: vi.fn(),
      legendCollapsed: true,
      setLegendCollapsed: vi.fn(),
      isInteractive: true,
      setIsInteractive: vi.fn(),
      sortedSteps: [],
      isAcceptedByAllGroups: false,
      nodes: [],
      onNodesChange: vi.fn(),
      edges: [],
      onEdgesChange: vi.fn(),
      handleInteractiveChange: vi.fn(),
    } as unknown as Parameters<typeof WorkflowFlowVisualizationView>[0];
    const { rerender } = render(<WorkflowFlowVisualizationView {...base} />);
    expect(document.querySelector('[data-testid="workflow-flow"]')).toBeNull();

    rerender(
      <WorkflowFlowVisualizationView
        {...base}
        sortedSteps={[{ id: 'step-1' }]}
        isAcceptedByAllGroups
      />
    );
    let props = state.civicProps.at(-1);
    expect(props.panelConfig.title).toBe('features.network.workflows.title');
    expect(props.panelConfig.description).toBeUndefined();
    expect(props.onNodesChange).toBeTypeOf('function');
    expect(props.onEdgesChange).toBeTypeOf('function');

    rerender(
      <WorkflowFlowVisualizationView
        {...base}
        workflow={{ name: 'Workflow', description: 'Description' }}
        sortedSteps={[{ id: 'step-1' }]}
        isInteractive={false}
        isAcceptedByAllGroups={false}
      />
    );
    props = state.civicProps.at(-1);
    expect(props.panelConfig.title).toBe('Workflow');
    expect(props.panelConfig.description).toBe('Description');
    expect(props.onNodesChange).toBeUndefined();
    expect(props.onEdgesChange).toBeUndefined();
  });
});
