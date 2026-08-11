/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  group: undefined as any,
  relationships: [] as any[],
  acceptedSiblingGroups: [] as any[],
  mixedGraph: { parents: [], children: [], siblingAttachments: [] } as any,
  directTree: { parents: [], children: [] } as any,
  indirectTree: { parents: [], children: [] } as any,
  workflows: [] as any[],
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
  buildMixed: vi.fn(),
  buildDirect: vi.fn(),
  buildIndirect: vi.fn(),
  getAccepted: vi.fn(),
  getKind: vi.fn((relationship: any) => relationship.kind ?? null),
  isActive: vi.fn((status: unknown) => status === 'active'),
  isAccepted: vi.fn((relationship: any) => relationship.accepted !== false),
  buildHierarchyDirections: vi.fn(() => ({ informationRight: 'forward' })),
  buildSingleDirections: vi.fn(() => ({ informationRight: 'forward' })),
  buildEdge: vi.fn((args: any) => ({
    id: args.edgeId,
    source: args.sourceId,
    target: args.targetId,
    data: { sourceGroupId: args.sourceGroupId, targetGroupId: args.targetGroupId },
  })),
  buildDialog: vi.fn(() => ({ id: 'dialog' })),
  filterRights: vi.fn((edges: any[]) => edges),
  filterStatus: vi.fn((edges: any[]) => edges),
  filterDirections: vi.fn((edges: any[]) => edges),
  filterNodes: vi.fn((nodes: any[]) => nodes),
  overlaps: vi.fn((nodes: any[]) => nodes),
  defaultWorkflow: vi.fn((workflows: any[], current: string) => current || workflows[0]?.id || ''),
  sortWorkflows: vi.fn((workflows: any[]) =>
    [...workflows].sort((a, b) => a.name.localeCompare(b.name))
  ),
  workflowVisualization: vi.fn((workflow: any) => ({ id: workflow.id, visualized: true })),
}));

vi.mock('@xyflow/react', () => ({
  useNodesState: () => [state.initialNodes, mocks.setNodes],
  useEdgesState: () => [state.initialEdges, mocks.setEdges, mocks.onEdgesChange],
}));
vi.mock('../../ui/networkVisualHelpers', () => ({
  getGroupNodeDisplayLabel: (name: string | null, role: string) => `${role}:${name ?? ''}`,
  getGroupNodeStyle: (role: string, style: any) => ({ role, borderColor: role, ...style }),
  getGroupNodeVisualTokens: (role: string) => ({ borderColor: role }),
  getGroupNodeVisualVariant: ({ siblingMembershipMode }: any) =>
    siblingMembershipMode ? `sibling-${siblingMembershipMode}` : 'sibling-open',
  getNetworkSelectionStyle: () => ({ boxShadow: 'selected-shadow' }),
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
vi.mock('../useGroupNetwork', () => ({
  useGroupNetwork: () => ({ group: state.group, allRelationships: state.relationships }),
}));
vi.mock('../../logic/networkEdgeHelpers', () => ({
  addUniqueValue: (values: unknown[], value: unknown) => {
    if (!values.includes(value)) values.push(value);
  },
  buildHierarchyRightEdgeDirections: mocks.buildHierarchyDirections,
  buildSingleDirectionRightEdgeDirections: mocks.buildSingleDirections,
  buildNetworkRelationshipDialogData: mocks.buildDialog,
  buildNetworkRelationshipEdge: mocks.buildEdge,
  mergeNetworkEdgeRelationshipDirection: (existing: string | undefined, next: string) =>
    existing && existing !== next ? 'both' : next,
  mergeNetworkRightRelationshipKind: (existing: string | undefined, next: string | null) =>
    existing === 'active' || next === 'active' ? 'active' : (existing ?? next),
}));
vi.mock('../../logic/networkRelationshipHelpers', () => ({
  buildDirectRelationships: mocks.buildDirect,
  buildIndirectRelationships: mocks.buildIndirect,
  buildMixedRelationshipGraph: mocks.buildMixed,
  getAcceptedSiblingGroups: mocks.getAccepted,
  getGroupRelationshipKind: mocks.getKind,
  isActiveGroupRelationshipStatus: mocks.isActive,
  isAcceptedSiblingRelationship: mocks.isAccepted,
}));
vi.mock('../../logic/networkFilterHelpers', () => ({
  filterEdgesByRights: mocks.filterRights,
  filterEdgesByRelationshipStatus: mocks.filterStatus,
  filterEdgesByConnectionDirections: mocks.filterDirections,
  filterNodesByEdges: mocks.filterNodes,
}));
vi.mock('../../logic/workflowVisualizationHelpers', () => ({
  getDefaultWorkflowId: mocks.defaultWorkflow,
  sortWorkflowsByName: mocks.sortWorkflows,
  toWorkflowVisualizationWorkflow: mocks.workflowVisualization,
}));
vi.mock('@/zero/network/useWorkflowState', () => ({
  useWorkflowState: () => ({ groupWorkflows: state.workflows }),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => `t:${key}` }),
}));

import { useGroupNetworkFlowController } from '../useGroupNetworkFlowController';

const group = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  name: id,
  description: `${id} description`,
  created_at: 1,
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
  membershipDirection: null,
  level: 1,
  ...overrides,
});

function resetState() {
  state.group = undefined;
  state.relationships = [];
  state.acceptedSiblingGroups = [];
  state.mixedGraph = { parents: [], children: [], siblingAttachments: [] };
  state.directTree = { parents: [], children: [] };
  state.indirectTree = { parents: [], children: [] };
  state.workflows = [];
  state.initialNodes = [];
  state.initialEdges = [];
  state.controls = {
    relationshipDepthFilter: 'all',
    setRelationshipDepthFilter: vi.fn(),
    selectedNodes: [] as string[],
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
  mocks.buildMixed.mockReset().mockImplementation(() => state.mixedGraph);
  mocks.buildDirect.mockReset().mockImplementation(() => state.directTree);
  mocks.buildIndirect.mockReset().mockImplementation(() => state.indirectTree);
  mocks.getAccepted.mockReset().mockImplementation(() => state.acceptedSiblingGroups);
  for (const mock of Object.values(mocks)) {
    if (
      typeof (mock as any).mockClear === 'function' &&
      ![mocks.buildMixed, mocks.buildDirect, mocks.buildIndirect, mocks.getAccepted].includes(
        mock as never
      )
    ) {
      (mock as any).mockClear();
    }
  }
}

function siblingRelationship(
  id: string,
  source: any,
  target: any,
  overrides: Record<string, unknown> = {}
) {
  return {
    id,
    kind: 'active',
    accepted: true,
    group_id: source?.id ?? 'missing-source',
    related_group_id: target?.id ?? 'missing-target',
    group: source,
    related_group: target,
    relationship_type: 'sibling',
    connection_type: 'peer',
    status: 'active',
    initiator_group_id: source?.id,
    with_right: 'informationRight',
    membership_mode: 'none',
    member_source_group_id: source?.id ?? null,
    member_target_group_id: target?.id ?? null,
    required_source_role_id: null,
    required_source_role: null,
    grant_id: `grant:${id}`,
    ...overrides,
  };
}

function configureMixedGraph() {
  const firstParent = entry('P', {
    level: 2,
    childId: null,
    sourceRelationshipType: undefined,
    membershipMode: null,
    group: group('P', { group_type: 'hierarchical' }),
  });
  const betterParent = entry('P', {
    level: 1,
    childId: 'ROOT',
    rights: ['amendmentRight'],
    relationshipKinds: ['incoming'],
    rightRelationshipKinds: { amendmentRight: 'incoming' },
    sourceRelationshipType: 'child',
    membershipMode: 'all_members',
    memberSourceGroupId: 'P',
    memberTargetGroupId: 'ROOT',
    requiredSourceRoleId: 'role',
    requiredSourceRoleName: 'Role',
    membershipDirection: 'current_members_to_partner',
    group: group('P', { group_type: 'hierarchical' }),
  });
  const fillParent = entry('P', {
    level: 3,
    parentId: 'PARENT-LINK',
    childId: 'CHILD-LINK',
    membershipMode: undefined,
    membershipDirection: null,
    group: group('P', { group_type: 'hierarchical' }),
  });
  const emptyMerge = entry('Q', {
    level: undefined,
    childId: null,
    parentId: 'EXISTING-PARENT',
    sourceRelationshipType: undefined,
    membershipMode: 'none',
    group: group('Q', { name: null }),
  });
  const fillEmptyMerge = entry('Q', {
    level: undefined,
    childId: 'FILL-CHILD',
    parentId: null,
    sourceRelationshipType: undefined,
    membershipMode: 'all_members',
    memberSourceGroupId: undefined,
    memberTargetGroupId: undefined,
    requiredSourceRoleId: undefined,
    requiredSourceRoleName: undefined,
    membershipDirection: null,
    group: group('Q', { name: null }),
  });
  state.mixedGraph = {
    parents: [
      firstParent,
      betterParent,
      fillParent,
      emptyMerge,
      fillEmptyMerge,
      entry('P2', {
        level: undefined,
        childId: 'MISSING',
        sourceRelationshipType: undefined,
        group: group('P2'),
      }),
      entry('P-DEEP', { level: 2, group: group('P-DEEP') }),
    ],
    children: [
      entry('C', { level: 1, parentId: 'ROOT', group: group('C', { group_type: 'hierarchical' }) }),
      entry('C2', { level: 2, parentId: 'MISSING', group: group('C2') }),
      entry('C3', {
        level: undefined,
        sourceRelationshipType: undefined,
        group: group('C3', { name: null, description: 42 }),
      }),
    ],
    siblingAttachments: [
      {
        ...entry('AS1', { group: group('AS1', { group_type: 'hierarchical' }) }),
        anchorId: 'P',
        branch: 'parent',
        level: 1,
      },
      {
        ...entry('AS1', { group: group('AS1', { group_type: 'hierarchical' }) }),
        anchorId: 'C',
        branch: 'child',
        level: 1,
      },
      {
        ...entry('AS2', { group: group('AS2', { name: null, group_type: 'sibling' }) }),
        anchorId: 'P',
        branch: 'parent',
        level: null,
      },
      { ...entry('AS3'), anchorId: 'P', branch: 'parent', level: 1 },
      { ...entry('AS4'), anchorId: 'P', branch: 'parent', level: 1 },
      { ...entry('AS5'), anchorId: 'P', branch: 'parent', level: 1 },
      { ...entry('P'), anchorId: 'P', branch: 'parent', level: 1 },
      { ...entry('INVALID-ANCHOR'), anchorId: 'missing-anchor', branch: 'child', level: 1 },
    ],
  };
}

function configureFullState() {
  state.group = group('ROOT', { group_type: 'hierarchical', description: 42 });
  state.workflows = [
    { id: 'workflow-b', name: 'Beta' },
    { id: 'workflow-a', name: 'Alpha' },
  ];
  state.acceptedSiblingGroups = [
    group('S1', { created_at: 1, group_type: 'hierarchical' }),
    group('INPUT', { created_at: null, name: null, group_type: 'base' }),
    group('S2', { created_at: 1, group_type: 'sibling' }),
    group('S3', { created_at: 2, sibling_membership_mode: 'parliament' }),
    group('S4', { created_at: 3, description: 42 }),
    group('NULL-NAME-1', { created_at: 4, name: null }),
    group('NULL-NAME-2', { created_at: 4, name: null }),
    group('ROOT'),
  ];
  configureMixedGraph();
  const root = state.group;
  const s1 = state.acceptedSiblingGroups.find(sibling => sibling.id === 'S1');
  const as1 = group('AS1', { group_type: 'sibling' });
  state.relationships = [
    siblingRelationship('root-s1', root, s1),
    siblingRelationship('root-s1-duplicate', root, s1),
    siblingRelationship('s1-root-back', s1, root, { with_right: 'amendmentRight' }),
    siblingRelationship('p-as1', group('P'), as1),
    siblingRelationship('root-as1', root, as1),
    siblingRelationship('as1-root', as1, root),
    siblingRelationship('as1-p-back', as1, group('P'), {
      status: 'requested',
      kind: 'incoming',
      with_right: 'amendmentRight',
      membership_mode: 'all_members',
      required_source_role: { name: 'Role' },
    }),
    siblingRelationship('as2-as3', group('AS2'), group('AS3'), { with_right: null }),
    siblingRelationship('as2-as3-membership', group('AS2'), group('AS3'), {
      with_right: 'amendmentRight',
      membership_mode: 'all_members',
      member_source_group_id: null,
      member_target_group_id: null,
      required_source_role_id: null,
      required_source_role: null,
    }),
    siblingRelationship('as4-as3-reverse', group('AS4'), group('AS3')),
    siblingRelationship('unrendered', group('X'), group('Y')),
    siblingRelationship('missing', root, null),
    siblingRelationship('request-source', root, group('REQ1'), {
      status: 'requested',
      kind: 'incoming',
      accepted: false,
    }),
    siblingRelationship('request-source-duplicate', root, group('REQ1'), {
      status: 'requested',
      kind: 'incoming',
      accepted: false,
    }),
    siblingRelationship('request-target', group('REQ2'), root, {
      status: 'requested',
      kind: 'incoming',
      accepted: false,
    }),
    siblingRelationship('request-self', root, root, {
      status: 'requested',
      kind: 'incoming',
      accepted: false,
    }),
    siblingRelationship('request-unrelated', group('REQ3'), group('REQ4'), {
      status: 'requested',
      kind: 'incoming',
      accepted: false,
    }),
    {
      ...siblingRelationship('hierarchy', root, group('P')),
      relationship_type: 'parent',
      connection_type: 'hierarchy',
    },
    { ...siblingRelationship('ignored-kind', root, group('Z')), kind: null },
  ];
  state.initialEdges = [
    {
      id: 'highlight-data',
      source: 'ROOT',
      target: 'child-C',
      data: { sourceGroupId: 'ROOT', targetGroupId: 'C' },
      style: { stroke: 'old' },
    },
    { id: 'highlight-fallback', source: 'parent-P', target: 'child-C2' },
    { id: 'plain', source: 'ROOT', target: 'S1', data: {} },
  ];
  state.initialNodes = [
    { id: 'ROOT', data: {}, style: { borderColor: 'old', boxShadow: 'old-shadow' } },
    { id: 'parent-P', data: {}, style: {} },
    { id: 'child-C', data: {} },
    { id: 'plain', data: {}, style: undefined },
  ];
  state.controls.selectedNodes = ['ROOT'];
  state.editable.nodePositionsRef.current = {
    ROOT: { x: 1, y: 2 },
    S1: { x: 3, y: 4 },
    'parent-P': { x: 5, y: 6 },
  };
}

describe('useGroupNetworkFlowController', () => {
  beforeEach(resetState);

  it('clears missing groups and pauses generation during layout loading', () => {
    const { result, unmount } = renderHook(() =>
      useGroupNetworkFlowController({ groupId: 'ROOT' })
    );
    expect(mocks.setNodes).toHaveBeenCalledWith([]);
    expect(mocks.setEdges).toHaveBeenCalledWith([]);
    expect(result.current.group).toBeUndefined();
    unmount();

    resetState();
    state.persisted.isLoading = true;
    renderHook(() => useGroupNetworkFlowController({ groupId: 'ROOT' }));
    expect(mocks.setNodes).not.toHaveBeenCalled();
  });

  it('selects and visualizes the default workflow while allowing view changes', () => {
    configureFullState();
    const { result } = renderHook(() =>
      useGroupNetworkFlowController({ groupId: 'INPUT', showWorkflowView: true })
    );
    expect(result.current.sortedGroupWorkflows.map(workflow => workflow.id)).toEqual([
      'workflow-a',
      'workflow-b',
    ]);
    expect(result.current.selectedWorkflowId).toBe('workflow-a');
    expect(result.current.selectedWorkflowVisualization).toEqual({
      id: 'workflow-a',
      visualized: true,
    });
    act(() => result.current.setViewMode('workflow'));
    expect(result.current.viewMode).toBe('workflow');
    act(() => result.current.setSelectedWorkflowId('workflow-b'));
    expect(result.current.selectedWorkflowId).toBe('workflow-b');
  });

  it('renders the active all-depth mixed graph, siblings, highlights, and callbacks', () => {
    configureFullState();
    const onGroupClick = vi.fn();
    const { result } = renderHook(() =>
      useGroupNetworkFlowController({
        groupId: 'INPUT',
        onGroupClick,
        title: 'Title',
        description: 'Description',
        highlightGroupIds: ['ROOT', 'P'],
        highlightEdgePairs: [
          { sourceGroupId: 'ROOT', targetGroupId: 'C' },
          { sourceGroupId: 'P', targetGroupId: 'C2' },
        ],
      })
    );
    expect(mocks.buildMixed).toHaveBeenCalled();
    expect(state.editable.syncGeneratedLayoutState).toHaveBeenCalled();
    expect(result.current.renderedEdges[0]).toMatchObject({ animated: true });
    expect(result.current.renderedEdges[1]).toMatchObject({ animated: true });
    expect(result.current.renderedEdges[2]).toBe(state.initialEdges[2]);
    expect(result.current.renderedNodes[0]?.style).toMatchObject({
      borderColor: 'parent',
      boxShadow: 'selected-shadow',
    });
    expect(result.current.renderedNodes[1]?.style.boxShadow).toContain('color-mix');

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

    act(() =>
      result.current.onNodeClick(
        {} as never,
        {
          id: 'parent-P',
          data: { groupEntity: group('P', { name: null, description: 42 }) },
        } as never
      )
    );
    expect(onGroupClick).toHaveBeenCalledWith('P', expect.objectContaining({ name: null }));
    expect(state.controls.setSelectedEntity).toHaveBeenCalled();
    act(() => result.current.onNodeClick({} as never, { id: 'ROOT', data: {} } as never));
    act(() => result.current.onNodeClick({} as never, { id: 'INPUT', data: {} } as never));
    act(() => result.current.onNodeClick({} as never, { id: 'unknown', data: {} } as never));
    act(() => result.current.onEdgeClick({} as never, state.initialEdges[0] as never));
    expect(mocks.buildDialog).toHaveBeenCalled();
  });

  it.each([
    ['direct', 'active', false],
    ['indirect', 'active', false],
    ['all', 'incoming', false],
    ['all', 'outgoing', false],
    ['all', 'active', true],
  ] as const)('renders depth=%s status=%s right=%s', (depth, status, withRight) => {
    configureFullState();
    state.controls.relationshipDepthFilter = depth;
    state.controls.relationshipStatusFilter = status;
    state.directTree = state.mixedGraph;
    state.indirectTree = state.mixedGraph;
    state.acceptedSiblingGroups = withRight ? [] : state.acceptedSiblingGroups;
    const { result } = renderHook(() =>
      useGroupNetworkFlowController({
        groupId: 'INPUT',
        filterRight: withRight ? 'informationRight' : undefined,
        showGroupDialogOnClick: false,
        showWorkflowView: false,
      })
    );
    if (depth === 'direct') expect(mocks.buildDirect).toHaveBeenCalled();
    if (depth !== 'direct' && !(status === 'active' && depth === 'all')) {
      expect(mocks.buildIndirect).toHaveBeenCalled();
    }
    if (withRight) expect(mocks.buildSingleDirections).toHaveBeenCalled();
    expect(result.current.showWorkflowView).toBe(false);
    expect(mocks.filterNodes).toHaveBeenCalled();
  });

  it('supports empty siblings, callback-free nodes, hidden dialogs, and noninteractive clicks', () => {
    state.group = group('ROOT', { group_type: 'base', name: null });
    state.directTree = { parents: [], children: [] };
    state.controls.relationshipDepthFilter = 'direct';
    const { result, unmount } = renderHook(() =>
      useGroupNetworkFlowController({ groupId: 'ROOT', showGroupDialogOnClick: false })
    );
    act(() =>
      result.current.onNodeClick(
        {} as never,
        {
          id: 'ROOT',
          data: { groupEntity: state.group },
        } as never
      )
    );
    expect(state.controls.setSelectedEntity).not.toHaveBeenCalled();
    unmount();

    resetState();
    state.group = group('ROOT', { group_type: 'sibling' });
    state.controls.isInteractive = false;
    const { result: disabled } = renderHook(() =>
      useGroupNetworkFlowController({ groupId: 'ROOT' })
    );
    act(() => disabled.current.onNodeClick({} as never, { id: 'ROOT', data: {} } as never));
    act(() => disabled.current.onEdgeClick({} as never, { id: 'edge' } as never));
    expect(state.controls.setSelectedEntity).not.toHaveBeenCalled();
  });

  it('omits hierarchy edges if a registered parent or child node cannot be resolved', () => {
    state.group = group('ROOT', { group_type: 'hierarchical' });
    state.mixedGraph = {
      parents: [entry('unresolvable-parent')],
      children: [entry('unresolvable-child')],
      siblingAttachments: [],
    };

    const nativeGet = Map.prototype.get;
    const getSpy = vi.spyOn(Map.prototype, 'get').mockImplementation(function (
      this: Map<unknown, unknown>,
      key: unknown
    ) {
      const value = Reflect.apply(nativeGet, this, [key]) as unknown;
      const targetsMissingNode = key === 'unresolvable-parent' || key === 'unresolvable-child';
      return targetsMissingNode && typeof value === 'string' ? undefined : value;
    } as typeof Map.prototype.get);

    try {
      renderHook(() => useGroupNetworkFlowController({ groupId: 'ROOT' }));

      const generatedNodes = mocks.setNodes.mock.calls.at(-1)?.[0] as { id: string }[];
      expect(generatedNodes.map(node => node.id)).toEqual([
        'ROOT',
        'parent-unresolvable-parent',
        'child-unresolvable-child',
      ]);
      expect(mocks.buildEdge).not.toHaveBeenCalled();
    } finally {
      getSpy.mockRestore();
    }
  });
});
