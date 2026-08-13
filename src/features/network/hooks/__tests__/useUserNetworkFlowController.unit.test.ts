/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  users: undefined as any,
  allConnections: [] as any[],
  relationships: [] as any[],
  trees: {} as Record<string, any>,
  controls: {} as any,
  persisted: {} as any,
  editable: {} as any,
  initialNodes: [] as any[],
  initialEdges: [] as any[],
}));

const mocks = vi.hoisted(() => ({
  setNodes: vi.fn(),
  setEdges: vi.fn(),
  onEdgesChange: vi.fn(),
  buildDirect: vi.fn(),
  buildIndirect: vi.fn(),
  acceptedSibling: vi.fn((relationship: any) => relationship.accepted !== false),
  buildHierarchyDirections: vi.fn(() => ({ informationRight: 'forward' })),
  buildSingleDirections: vi.fn(() => ({ informationRight: 'forward' })),
  buildEdge: vi.fn((args: any) => ({
    id: args.edgeId,
    source: args.sourceId,
    target: args.targetId,
    data: { rights: args.rights },
  })),
  createEdgeData: vi.fn((args: any) => args),
  buildDialog: vi.fn(() => ({ id: 'dialog' })),
  filterRights: vi.fn((edges: any[]) => edges),
  filterStatus: vi.fn((edges: any[]) => edges),
  filterDirections: vi.fn((edges: any[]) => edges),
  filterNodes: vi.fn((nodes: any[]) => nodes),
  overlaps: vi.fn((nodes: any[]) => nodes),
  translate: vi.fn((key: string) => `translated:${key}`),
}));

vi.mock('@xyflow/react', () => ({
  MarkerType: { ArrowClosed: 'arrow-closed' },
  useNodesState: () => [state.initialNodes, mocks.setNodes],
  useEdgesState: () => [state.initialEdges, mocks.setEdges, mocks.onEdgesChange],
}));
vi.mock('../useNetworkFlowControls', () => ({ useNetworkFlowControls: () => state.controls }));
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
  isAcceptedSiblingRelationship: mocks.acceptedSibling,
}));
vi.mock('../../logic/networkFilterHelpers', () => ({
  filterEdgesByRights: mocks.filterRights,
  filterEdgesByRelationshipStatus: mocks.filterStatus,
  filterEdgesByConnectionDirections: mocks.filterDirections,
  filterNodesByEdges: mocks.filterNodes,
}));
vi.mock('../../ui/networkVisualHelpers', () => ({
  getGroupNodeDisplayLabel: (name: string | null, kind: string) => `${kind}:${name ?? ''}`,
  getGroupNodeStyle: (kind: string, style: any) => ({ kind, ...style }),
  getGroupNodeVisualTokens: (kind: string) => ({ borderColor: kind }),
  getEntityNetworkNodeStyle: () => ({ color: 'user' }),
  getGroupNodeVisualVariant: ({ siblingMembershipMode }: any) =>
    siblingMembershipMode ? `sibling-${siblingMembershipMode}` : 'sibling-open',
}));
vi.mock('@/zero/users/useUserState', () => ({
  useUserState: () => ({ userWithGroupMemberships: state.users }),
}));
vi.mock('@/zero/network', () => ({
  useGroupConnectionState: () => ({ allConnections: state.allConnections }),
}));
vi.mock('../../logic/groupConnectionDerived', () => ({
  deriveNormalizedGroupRelationships: () => state.relationships,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => `t:${key}` }),
  translate: mocks.translate,
}));
vi.mock('../../logic/networkEdgeHelpers', () => ({
  addUniqueValue: (values: unknown[], value: unknown) => {
    if (!values.includes(value)) values.push(value);
  },
  buildHierarchyRightEdgeDirections: mocks.buildHierarchyDirections,
  buildSingleDirectionRightEdgeDirections: mocks.buildSingleDirections,
  buildNetworkRelationshipDialogData: mocks.buildDialog,
  buildNetworkRelationshipEdge: mocks.buildEdge,
  createNetworkRelationshipEdgeData: mocks.createEdgeData,
  getCivicNetworkEdgeColor: () => '#user',
  getCivicNetworkEdgeStyle: () => ({ stroke: '#user' }),
  getCivicNetworkLabelStyle: () => ({ labelStyle: {} }),
  mergeNetworkEdgeRelationshipDirection: (existing: string | undefined, next: string) =>
    existing && existing !== next ? 'both' : next,
  mergeNetworkRightRelationshipKind: (existing: string | undefined, next: string | null) =>
    existing === 'active' || next === 'active' ? 'active' : (existing ?? next),
}));

import { useUserNetworkFlowController } from '../useUserNetworkFlowController';

const group = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  name: id,
  description: `${id} description`,
  ...overrides,
});

const entry = (id: string, overrides: Record<string, unknown> = {}) => ({
  group: group(id),
  rights: ['informationRight'],
  relationshipKinds: ['active'],
  rightRelationshipKinds: { informationRight: 'active' },
  sourceRelationshipType: 'parent',
  membershipMode: 'none',
  memberSourceGroupId: null,
  memberTargetGroupId: null,
  requiredSourceRoleId: null,
  requiredSourceRoleName: null,
  level: 1,
  ...overrides,
});

function resetState() {
  state.users = undefined;
  state.allConnections = [];
  state.relationships = [];
  state.trees = {};
  state.initialNodes = [];
  state.initialEdges = [];
  state.controls = {
    relationshipDepthFilter: 'all',
    setRelationshipDepthFilter: vi.fn(),
    selectedNodes: new Set(),
    isInteractive: true,
    relationshipStatusFilter: 'active',
    setRelationshipStatusFilter: vi.fn(),
    connectionDirectionFilter: 'all',
    setConnectionDirectionFilter: vi.fn(),
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
  mocks.buildDirect
    .mockReset()
    .mockImplementation((_relationships, groupId) => state.trees[groupId]);
  mocks.buildIndirect
    .mockReset()
    .mockImplementation((_relationships, groupId) => state.trees[groupId]);
  for (const mock of Object.values(mocks)) {
    if (
      typeof (mock as any).mockClear === 'function' &&
      mock !== mocks.buildDirect &&
      mock !== mocks.buildIndirect
    ) {
      (mock as any).mockClear();
    }
  }
}

function configureFullState(depth: 'direct' | 'all' | 'indirect', withRight = false) {
  state.controls.relationshipDepthFilter = depth;
  const groupA = group('A');
  const groupB = group('B', { name: null, description: 42 });
  state.users = [
    {
      id: 'user',
      first_name: depth === 'direct' ? 'Ada' : null,
      last_name: depth === 'direct' ? 'User' : null,
      bio: depth === 'all' ? null : 'Bio',
      group_memberships: [
        { id: 'm-a', status: 'active', group: groupA },
        { id: 'm-b', status: 'member', group: groupB },
        { id: 'm-b-duplicate', status: 'admin', group: groupB },
        { id: 'm-inactive', status: 'pending', group: group('inactive') },
        { id: 'm-missing', status: 'active', group: null },
      ],
    },
  ];
  state.trees = {
    A: {
      parents: [
        entry('P', { childId: 'MID', level: 1 }),
        entry('P2', {
          childId: null,
          level: 2,
          sourceRelationshipType: undefined,
          membershipMode: undefined,
          group: group('P2', { name: null, description: 42 }),
        }),
        entry('A'),
      ],
      children: [
        entry('C', { parentId: 'MID-C', level: 1 }),
        entry('C2', {
          parentId: null,
          level: 2,
          sourceRelationshipType: undefined,
          membershipMode: undefined,
          group: group('C2', { name: null, description: 42 }),
        }),
      ],
    },
    B: {
      parents: [entry('P', { level: 1 }), entry('P3', { level: undefined })],
      children: [entry('C', { level: 1 }), entry('C3', { level: undefined })],
    },
  };
  const sibling = (
    id: string,
    source: any,
    target: any,
    overrides: Record<string, unknown> = {}
  ) => ({
    id,
    accepted: true,
    group_id: source?.id ?? 'missing-source',
    related_group_id: target?.id ?? 'missing-target',
    group: source,
    related_group: target,
    relationship_type: 'sibling',
    status: 'active',
    initiator_group_id: source?.id,
    with_right: 'informationRight',
    membership_mode: 'none',
    member_source_group_id: source?.id ?? null,
    member_target_group_id: target?.id ?? null,
    required_source_role_id: null,
    required_source_role: null,
    ...overrides,
  });
  state.relationships = [
    sibling('rejected', groupA, group('ignored'), { accepted: false }),
    sibling('missing', groupA, null),
    sibling('unrendered', group('X'), group('Y')),
    sibling('a-s1-none', groupA, group('S1', { sibling_membership_mode: 'open' })),
    sibling('s1-a-active', group('S1'), groupA),
    sibling('a-s1-membership', groupA, group('S1'), {
      status: 'requested',
      initiator_group_id: 'A',
      with_right: 'amendmentRight',
      membership_mode: 'all_members',
      required_source_role: { name: 'Required' },
    }),
    sibling('s1-a-incoming', group('S1'), groupA, {
      status: 'requested',
      initiator_group_id: 'S1',
      with_right: 'amendmentRight',
    }),
    sibling('b-s2', groupB, group('S2', { sibling_membership_mode: 'parliament' }), {
      with_right: null,
    }),
    sibling(
      'p-s3',
      group('P', { name: null, group_type: 'sibling' }),
      group('S3', { name: null, group_type: 'sibling' }),
      {
        membership_mode: undefined,
        member_source_group_id: undefined,
        member_target_group_id: undefined,
        required_source_role_id: undefined,
      }
    ),
    sibling('s4-p', group('S4', { group_type: 'sibling' }), group('P')),
    sibling('p-s5', group('P'), group('S5')),
    sibling('p-s6', group('P'), group('S6')),
    sibling('a-shared', groupA, group('SHARED')),
    sibling('b-shared', groupB, group('SHARED')),
    sibling('b-s9-none', groupB, group('S9', { description: 42 })),
    sibling('b-s9-membership', groupB, group('S9'), {
      with_right: 'amendmentRight',
      membership_mode: 'all_members',
      member_source_group_id: null,
      member_target_group_id: null,
      required_source_role_id: null,
      required_source_role: null,
    }),
    sibling('both-rendered', groupA, groupB),
    sibling('reverse-user', group('S7'), groupB),
    sibling('malformed-direction', groupA, group('S8'), {
      group_id: 'other-a',
      related_group_id: 'other-b',
      status: 'requested',
    }),
  ];
  state.initialEdges = [{ id: 'visible', source: 'user', target: 'A' }];
  state.editable.nodePositionsRef.current = { user: { x: 1, y: 2 }, A: { x: 3, y: 4 } };
  state.editable.edgeBendPointsRef.current = {
    'edge-user-user-to-group-A': [{ x: 1, y: 1 }],
  };
  return { filterRight: withRight ? 'informationRight' : undefined };
}

describe('useUserNetworkFlowController', () => {
  beforeEach(resetState);

  it('clears absent users and pauses generation while layout data loads', () => {
    const { result, unmount } = renderHook(() => useUserNetworkFlowController({ userId: 'user' }));
    expect(mocks.setNodes).toHaveBeenCalledWith([]);
    expect(mocks.setEdges).toHaveBeenCalledWith([]);
    expect(result.current.userProfile).toBeNull();
    act(() =>
      result.current.onNodeClick(
        {} as never,
        {
          id: 'group',
          data: { type: 'group', groupData: group('group') },
        } as never
      )
    );
    act(() =>
      result.current.onNodeClick({} as never, { id: 'user', data: { type: 'user' } } as never)
    );
    unmount();

    resetState();
    state.persisted.isLoading = true;
    renderHook(() => useUserNetworkFlowController({ userId: 'user' }));
    expect(mocks.setNodes).not.toHaveBeenCalled();
  });

  it('renders a user with no memberships using profile fallbacks and a custom scope', () => {
    state.users = [
      { id: 'user', first_name: null, last_name: null, bio: null, group_memberships: [] },
    ];
    const { result } = renderHook(() =>
      useUserNetworkFlowController({ userId: 'user', layoutScopeKey: 'custom-scope' })
    );
    expect(result.current.userProfile).toEqual({ id: 'user', name: 'User', bio: '' });
    expect(state.editable.syncGeneratedLayoutState).toHaveBeenCalled();
  });

  it.each([
    ['direct', false],
    ['all', false],
    ['indirect', false],
    ['all', true],
  ] as const)('renders %s depth with right traversal=%s', (depth, withRight) => {
    const { filterRight } = configureFullState(depth, withRight);
    const onGroupClick = vi.fn();
    const { result } = renderHook(() =>
      useUserNetworkFlowController({
        userId: 'user',
        filterRight,
        onGroupClick,
        title: 'Title',
        description: 'Description',
      })
    );

    expect(depth === 'direct' ? mocks.buildDirect : mocks.buildIndirect).toHaveBeenCalled();
    if (withRight) {
      expect(mocks.buildSingleDirections).toHaveBeenCalled();
    } else {
      expect(mocks.buildHierarchyDirections).toHaveBeenCalled();
    }
    expect(mocks.filterNodes).toHaveBeenCalledWith(state.initialNodes, state.initialEdges, [
      'user',
    ]);
    expect(result.current.title).toBe('Title');
    expect(result.current.description).toBe('Description');

    for (const filter of [
      ...result.current.depthFilters,
      ...result.current.relationshipStatusFilters,
      ...result.current.connectionDirectionFilters,
    ]) {
      act(() => filter.onToggle());
    }
    act(() => result.current.handleSaveLayout());
    act(() => result.current.handleResetLayout());
    expect(state.persisted.persistLayout).toHaveBeenCalled();
    expect(state.persisted.resetLayout).toHaveBeenCalled();

    act(() =>
      result.current.onNodeClick(
        {} as never,
        {
          id: 'A',
          data: { type: 'group', groupData: group('A', { description: 42 }) },
        } as never
      )
    );
    expect(onGroupClick).toHaveBeenCalled();
    expect(state.controls.setSelectedEntity).toHaveBeenCalled();
    act(() =>
      result.current.onNodeClick({} as never, { id: 'user', data: { type: 'user' } } as never)
    );
    act(() => result.current.onNodeClick({} as never, { id: 'none', data: {} } as never));
    act(() => result.current.onEdgeClick({} as never, state.initialEdges[0] as never));
    expect(mocks.buildDialog).toHaveBeenCalled();
  });

  it('supports callback-only group clicks, disabled dialogs, and noninteractive mode', () => {
    configureFullState('direct');
    const onGroupClick = vi.fn();
    const { result, unmount } = renderHook(() =>
      useUserNetworkFlowController({
        userId: 'user',
        onGroupClick,
        showGroupDialogOnClick: false,
      })
    );
    act(() =>
      result.current.onNodeClick(
        {} as never,
        {
          id: 'A',
          data: { type: 'group', groupData: group('A') },
        } as never
      )
    );
    expect(onGroupClick).toHaveBeenCalled();
    expect(state.controls.setSelectedEntity).not.toHaveBeenCalled();
    unmount();

    resetState();
    configureFullState('direct');
    state.controls.isInteractive = false;
    const { result: disabled } = renderHook(() => useUserNetworkFlowController({ userId: 'user' }));
    act(() =>
      disabled.current.onNodeClick({} as never, { id: 'user', data: { type: 'user' } } as never)
    );
    act(() => disabled.current.onEdgeClick({} as never, { id: 'edge' } as never));
    expect(state.controls.setSelectedEntity).not.toHaveBeenCalled();
  });
});
