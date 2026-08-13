/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  event: undefined as any,
  canManage: false,
  allConnections: [] as any[],
  relationships: [] as any[],
  relationshipTree: { parents: [], children: [] } as any,
  controls: {} as any,
  persisted: {} as any,
  editable: {} as any,
  initialNodes: [] as any[],
  initialEdges: [] as any[],
}));

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  setNodes: vi.fn(),
  setEdges: vi.fn(),
  onEdgesChange: vi.fn(),
  buildDirect: vi.fn(),
  buildIndirect: vi.fn(),
  buildDirections: vi.fn(() => ({ informationRight: 'outgoing' })),
  buildEdge: vi.fn((args: any) => ({
    id: args.edgeId,
    source: args.sourceId,
    target: args.targetId,
    data: { rights: args.rights },
  })),
  buildDialog: vi.fn(() => ({ id: 'dialog-data' })),
  filterRights: vi.fn((edges: any[]) => edges),
  filterStatus: vi.fn((edges: any[]) => edges),
  filterDirections: vi.fn((edges: any[]) => edges),
  filterNodes: vi.fn((nodes: any[]) => nodes),
  overlaps: vi.fn((nodes: any[]) => nodes),
  translate: vi.fn((key: string) => `translated:${key}`),
}));

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('@xyflow/react', () => ({
  MarkerType: { ArrowClosed: 'arrow-closed' },
  useNodesState: () => [state.initialNodes, mocks.setNodes],
  useEdgesState: () => [state.initialEdges, mocks.setEdges, mocks.onEdgesChange],
}));
vi.mock('@/zero/events/useEventState', () => ({
  useEventWithGroup: () => ({ event: state.event }),
}));
vi.mock('@/zero/network', () => ({
  useGroupConnectionState: () => ({ allConnections: state.allConnections }),
}));
vi.mock('@/zero/rbac', () => ({
  usePermissions: () => ({ can: () => state.canManage }),
}));
vi.mock('../useNetworkFlowControls', () => ({
  useNetworkFlowControls: () => state.controls,
}));
vi.mock('../usePersistedNetworkLayout', () => ({
  usePersistedNetworkLayout: () => state.persisted,
}));
vi.mock('../useEditableNetworkLayout', () => ({
  useEditableNetworkLayout: () => state.editable,
}));
vi.mock('../../logic/networkLayoutHelpers', () => ({
  resolveInitialNetworkNodeOverlaps: mocks.overlaps,
}));
vi.mock('../../logic/networkRelationshipHelpers', () => ({
  buildDirectRelationships: mocks.buildDirect,
  buildIndirectRelationships: mocks.buildIndirect,
}));
vi.mock('../../logic/networkEdgeHelpers', () => ({
  buildHierarchyRightEdgeDirections: mocks.buildDirections,
  getCivicNetworkEdgeColor: () => '#event',
  getCivicNetworkEdgeStyle: () => ({ stroke: '#event' }),
  buildNetworkRelationshipDialogData: mocks.buildDialog,
  buildNetworkRelationshipEdge: mocks.buildEdge,
}));
vi.mock('../../logic/networkFilterHelpers', () => ({
  filterEdgesByRights: mocks.filterRights,
  filterEdgesByRelationshipStatus: mocks.filterStatus,
  filterEdgesByConnectionDirections: mocks.filterDirections,
  filterNodesByEdges: mocks.filterNodes,
}));
vi.mock('../../ui/networkVisualHelpers', () => ({
  getEntityNetworkNodeStyle: () => ({ color: 'event' }),
  getGroupNodeDisplayLabel: (name: string | null, kind: string) => `${kind}:${name ?? ''}`,
  getGroupNodeStyle: (kind: string) => ({ color: kind }),
  getGroupNodeVisualTokens: (kind: string) => ({ borderColor: kind }),
}));
vi.mock('../../logic/groupConnectionDerived', () => ({
  deriveNormalizedGroupRelationships: () => state.relationships,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => `t:${key}` }),
  translate: mocks.translate,
}));

import { useEventNetworkFlowController } from '../useEventNetworkFlowController';

function resetState() {
  const setRelationshipDepthFilter = vi.fn();
  const setRelationshipStatusFilter = vi.fn();
  const setConnectionDirectionFilter = vi.fn();
  state.event = undefined;
  state.canManage = false;
  state.allConnections = [];
  state.relationships = [];
  state.relationshipTree = { parents: [], children: [] };
  state.initialNodes = [];
  state.initialEdges = [];
  state.controls = {
    relationshipDepthFilter: 'all',
    setRelationshipDepthFilter,
    selectedNodes: new Set(),
    isInteractive: true,
    relationshipStatusFilter: 'active',
    setRelationshipStatusFilter,
    connectionDirectionFilter: 'all',
    setConnectionDirectionFilter,
    selectedRights: new Set(),
    selectedConnectionDirections: new Set(),
    panelCollapsed: false,
    setPanelCollapsed: vi.fn(),
    legendCollapsed: false,
    setLegendCollapsed: vi.fn(),
    dialogOpen: false,
    setDialogOpen: vi.fn(),
    selectedEntity: null,
    setSelectedEntity: vi.fn(),
    toggleRight: vi.fn(),
    handleInteractiveChange: vi.fn(),
  };
  state.persisted = {
    savedLayout: null,
    hasSavedLayout: false,
    isLoading: false,
    persistLayout: vi.fn(),
    resetLayout: vi.fn(),
  };
  state.editable = {
    currentLayout: { nodes: {}, edges: {} },
    hasLayoutChanges: false,
    nodePositionsRef: { current: {} },
    edgeBendPointsRef: { current: {} },
    fixedNodeIdsRef: { current: new Set() },
    isInteractiveRef: { current: true },
    handleNodesChange: vi.fn(),
    handleEdgeBendPointsChange: vi.fn(),
    syncGeneratedLayoutState: vi.fn(),
    clearPersistedLayoutState: vi.fn(),
  };
  mocks.buildDirect.mockReset().mockImplementation(() => state.relationshipTree);
  mocks.buildIndirect.mockReset().mockImplementation(() => state.relationshipTree);
  for (const mock of [
    mocks.setNodes,
    mocks.setEdges,
    mocks.buildDirections,
    mocks.buildEdge,
    mocks.buildDialog,
    mocks.filterRights,
    mocks.filterStatus,
    mocks.filterDirections,
    mocks.filterNodes,
    mocks.overlaps,
  ]) {
    mock.mockClear();
  }
}

describe('useEventNetworkFlowController', () => {
  beforeEach(resetState);

  it('clears the chart when event data is absent and pauses while layout is loading', () => {
    const { result, unmount } = renderHook(() =>
      useEventNetworkFlowController({ eventId: 'event' })
    );
    expect(mocks.setNodes).toHaveBeenCalledWith([]);
    expect(mocks.setEdges).toHaveBeenCalledWith([]);
    expect(result.current.group).toBeUndefined();
    expect(result.current.canManageEvent).toBe(false);
    unmount();

    resetState();
    state.persisted.isLoading = true;
    renderHook(() => useEventNetworkFlowController({ eventId: 'event' }));
    expect(mocks.setNodes).not.toHaveBeenCalled();
  });

  it.each(['direct', 'all', 'indirect'] as const)(
    'generates and filters a complete %s relationship chart',
    depth => {
      state.canManage = true;
      state.controls.relationshipDepthFilter = depth;
      state.controls.relationshipStatusFilter = 'incoming';
      state.controls.connectionDirectionFilter = 'outgoing';
      state.event = {
        id: 'event',
        title: depth === 'all' ? null : 'Event',
        description: depth === 'direct' ? 42 : 'Description',
        group: {
          id: 'group',
          name: depth === 'all' ? null : 'Group',
          description: depth === 'indirect' ? 42 : 'Group description',
        },
      };
      state.relationships = [{ id: 'rel', group: null, related_group: null }];
      state.relationshipTree = {
        parents: [
          {
            group: { id: 'parent-1', name: 'Parent', description: 'Parent description' },
            level: 1,
            childId: 'parent-child',
            rights: ['informationRight'],
            relationshipKinds: ['active'],
            rightRelationshipKinds: {},
            membershipMode: 'all_members',
            memberSourceGroupId: 'parent-1',
            memberTargetGroupId: 'group',
            requiredSourceRoleId: 'role',
            requiredSourceRoleName: 'Role',
          },
          {
            group: { id: 'parent-2', name: null, description: 42 },
            level: 2,
            childId: null,
            rights: [],
            relationshipKinds: [],
            rightRelationshipKinds: {},
          },
          {
            group: { id: 'parent-zero', name: 'Zero' },
            level: undefined,
            rights: [],
            relationshipKinds: [],
            rightRelationshipKinds: {},
          },
        ],
        children: [
          {
            group: { id: 'child-1', name: 'Child', description: 'Child description' },
            level: 1,
            parentId: 'child-parent',
            rights: ['amendmentRight'],
            relationshipKinds: ['active'],
            rightRelationshipKinds: {},
            membershipMode: null,
            memberSourceGroupId: null,
            memberTargetGroupId: null,
            requiredSourceRoleId: null,
            requiredSourceRoleName: null,
          },
          {
            group: { id: 'child-2', name: null, description: 42 },
            level: 2,
            parentId: null,
            rights: [],
            relationshipKinds: [],
            rightRelationshipKinds: {},
          },
          {
            group: { id: 'child-default', name: 'Default' },
            level: undefined,
            rights: [],
            relationshipKinds: [],
            rightRelationshipKinds: {},
          },
        ],
      };
      state.editable.nodePositionsRef.current = {
        event: { x: 1, y: 2 },
        'parent-1': { x: 3, y: 4 },
      };
      state.editable.edgeBendPointsRef.current = {
        'event-group': [{ x: 5, y: 6 }],
      };
      state.initialEdges = [
        { id: 'event-group', source: 'event', target: 'group' },
        { id: 'other-edge', source: 'group', target: 'child-1' },
      ];

      const { result } = renderHook(() => useEventNetworkFlowController({ eventId: 'event' }));

      expect(depth === 'direct' ? mocks.buildDirect : mocks.buildIndirect).toHaveBeenCalled();
      expect(state.editable.syncGeneratedLayoutState).toHaveBeenCalled();
      expect(mocks.filterRights).toHaveBeenCalledWith(
        state.initialEdges,
        state.controls.selectedRights,
        new Set(['event-group'])
      );
      expect(mocks.filterNodes).toHaveBeenCalledWith(state.initialNodes, state.initialEdges, [
        'event',
        'group',
      ]);
      expect(result.current.canManageEvent).toBe(true);

      for (const filter of [
        ...result.current.depthFilters,
        ...result.current.relationshipStatusFilters,
        ...result.current.connectionDirectionFilters,
      ]) {
        act(() => filter.onToggle());
      }
      expect(state.controls.setRelationshipDepthFilter).toHaveBeenCalledTimes(2);
      expect(state.controls.setRelationshipStatusFilter).toHaveBeenCalledTimes(3);
      expect(state.controls.setConnectionDirectionFilter).toHaveBeenCalledTimes(3);

      act(() => result.current.handleSaveLayout());
      expect(state.persisted.persistLayout).toHaveBeenCalledWith(state.editable.currentLayout);
      act(() => result.current.handleResetLayout());
      expect(state.editable.clearPersistedLayoutState).toHaveBeenCalled();
      expect(state.persisted.resetLayout).toHaveBeenCalled();

      act(() =>
        result.current.onNodeClick(
          {} as never,
          {
            data: { type: 'event' },
          } as never
        )
      );
      expect(state.controls.setSelectedEntity).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'event' })
      );
      act(() =>
        result.current.onNodeClick(
          {} as never,
          {
            data: {
              type: 'group',
              groupData: { id: 'group', name: 'Group', description: 42 },
            },
          } as never
        )
      );
      act(() =>
        result.current.onNodeClick(
          {} as never,
          {
            data: { type: 'group' },
          } as never
        )
      );
      act(() => result.current.onEdgeClick({} as never, state.initialEdges[1] as never));
      expect(mocks.buildDialog).toHaveBeenCalled();
    }
  );

  it('ignores node and edge clicks outside interactive mode', () => {
    state.controls.isInteractive = false;
    state.event = { id: 'event', title: 'Event', group: { id: 'group', name: 'Group' } };
    const { result } = renderHook(() => useEventNetworkFlowController({ eventId: 'event' }));
    act(() => result.current.onNodeClick({} as never, { data: { type: 'event' } } as never));
    act(() => result.current.onEdgeClick({} as never, { id: 'edge' } as never));
    expect(state.controls.setSelectedEntity).not.toHaveBeenCalled();
  });
});
