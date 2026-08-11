import { featureThemeClassName } from '@/features/shared/theme';
import { MEMBERSHIP_FLOW_RIGHT } from '@/features/shared/ui/status';
import { Position } from '@xyflow/react';
import { describe, expect, it } from 'vitest';

import {
  addUniqueValue,
  buildCurrentPerspectiveRightConnectionDirections,
  buildHierarchyRightEdgeDirections,
  buildRelationshipEdgeMarkers,
  buildCurrentPerspectiveRightDisplayDirections,
  buildNetworkRelationshipEdge,
  buildNetworkRelationshipDialogData,
  buildSingleDirectionRightEdgeDirections,
  getAnimatedFlowDirection,
  getCivicNetworkEdgeColor,
  getCivicNetworkEdgeStyle,
  getCivicNetworkLabelStyle,
  getAnchorUsageConnectionDirection,
  getNetworkConnectionDirectionColor,
  getNetworkPreviewMembershipDirection,
  getNetworkUserConnectionDirections,
  getRelationshipStrokeColor,
  getVisibleFlowDirection,
  getVisibleRelationshipStrokeColor,
  hasBidirectionalRelationshipDirections,
  mergeNetworkConnectionDirection,
  mergeNetworkEdgeRelationshipDirection,
  mergeNetworkRightRelationshipKind,
  orientRelationshipEdgeForCurrentPerspective,
  resolveInnerAutoEdgeAnchors,
  resolveNetworkRelationshipPreviewContext,
} from '../networkEdgeHelpers';
import type { EditableRightsLabelEdgeData } from '../../types/networkEdge.types';

const FALLBACK_STROKE = 'var(--badge-success-border)';

describe('networkEdgeHelpers', () => {
  it('covers edge style defaults, overrides, and reverse anchor placement', () => {
    expect(getCivicNetworkEdgeColor()).toBeTruthy();
    expect(getCivicNetworkEdgeColor('missing' as never)).toBe(getCivicNetworkEdgeColor());
    expect(getCivicNetworkEdgeStyle()).toMatchObject({ strokeWidth: 2 });
    expect(getCivicNetworkEdgeStyle({ color: 'red', dashed: true })).toMatchObject({
      stroke: 'red',
      strokeDasharray: '5 5',
    });
    expect(
      getCivicNetworkEdgeStyle({ dashed: false, strokeDasharray: '2 3', strokeWidth: 4 })
    ).toMatchObject({ strokeDasharray: '2 3', strokeWidth: 4 });
    expect(getCivicNetworkLabelStyle().labelBgStyle.stroke).toBeTruthy();
    expect(getCivicNetworkLabelStyle({ color: 'red' }).labelBgStyle.stroke).toBe('red');

    expect(
      resolveInnerAutoEdgeAnchors({
        sourceRect: { x: 300, y: 0, width: 100, height: 80 },
        targetRect: { x: 0, y: 20, width: 100, height: 80 },
      })
    ).toMatchObject({ sourceX: 300, targetX: 100, sourcePosition: Position.Left });
    expect(
      resolveInnerAutoEdgeAnchors({
        sourceRect: { x: 0, y: 300, width: 100, height: 80 },
        targetRect: { x: 10, y: 0, width: 100, height: 80 },
      })
    ).toMatchObject({ sourceY: 300, targetY: 80, sourcePosition: Position.Top });
  });

  it('merges unique values, relationship kinds, and edge directions deterministically', () => {
    const values = ['a'];
    addUniqueValue(values, 'a');
    addUniqueValue(values, 'b');
    expect(values).toEqual(['a', 'b']);

    expect(mergeNetworkRightRelationshipKind('incoming', null)).toBe('incoming');
    expect(mergeNetworkRightRelationshipKind(undefined, 'outgoing')).toBe('outgoing');
    expect(mergeNetworkRightRelationshipKind('incoming', 'active')).toBe('active');
    expect(mergeNetworkRightRelationshipKind('active', 'outgoing')).toBe('active');
    expect(mergeNetworkRightRelationshipKind('incoming', 'outgoing')).toBe('incoming');

    expect(mergeNetworkEdgeRelationshipDirection(undefined, 'forward')).toBe('forward');
    expect(mergeNetworkEdgeRelationshipDirection('forward', 'forward')).toBe('forward');
    expect(mergeNetworkEdgeRelationshipDirection('forward', 'backward')).toBe('bidirectional');
    expect(mergeNetworkConnectionDirection(undefined, 'incoming')).toBe('incoming');
    expect(mergeNetworkConnectionDirection('incoming', 'incoming')).toBe('incoming');
    expect(mergeNetworkConnectionDirection('incoming', 'outgoing')).toBe('bidirectional');
  });

  it('derives colors, bidirectionality, anchor usage, and animation for every direction', () => {
    expect(getNetworkConnectionDirectionColor(undefined, 'fallback')).toBe('fallback');
    expect(getNetworkConnectionDirectionColor('incoming', 'fallback')).not.toBe('fallback');
    expect(hasBidirectionalRelationshipDirections()).toBe(false);
    expect(hasBidirectionalRelationshipDirections({})).toBe(false);
    expect(hasBidirectionalRelationshipDirections({ a: 'bidirectional' })).toBe(true);
    expect(hasBidirectionalRelationshipDirections({ a: 'forward', b: 'backward' })).toBe(true);
    expect(hasBidirectionalRelationshipDirections({ a: 'forward' })).toBe(false);
    expect(
      getAnchorUsageConnectionDirection({ edgeDirection: 'bidirectional', anchorSide: 'source' })
    ).toBe('bidirectional');
    expect(
      getAnchorUsageConnectionDirection({ edgeDirection: 'forward', anchorSide: 'source' })
    ).toBe('incoming');
    expect(
      getAnchorUsageConnectionDirection({ edgeDirection: 'backward', anchorSide: 'source' })
    ).toBe('outgoing');
    expect(
      getAnchorUsageConnectionDirection({ edgeDirection: 'forward', anchorSide: 'target' })
    ).toBe('outgoing');
    expect(
      getAnchorUsageConnectionDirection({ edgeDirection: 'backward', anchorSide: 'target' })
    ).toBe('incoming');

    expect(getVisibleFlowDirection()).toBeNull();
    expect(getVisibleFlowDirection({ a: 'bidirectional' })).toBe('bidirectional');
    expect(getVisibleFlowDirection({ a: 'forward', b: 'backward' })).toBe('bidirectional');
    expect(getVisibleFlowDirection({ a: 'forward' })).toBe('forward');
    expect(getVisibleFlowDirection({ a: 'backward' })).toBe('backward');
    expect(getAnimatedFlowDirection('forward')).toBe('forward');
    expect(getAnimatedFlowDirection('backward')).toBe('backward');
    expect(getAnimatedFlowDirection('bidirectional')).toBeNull();
    expect(getAnimatedFlowDirection(null)).toBeNull();
  });

  it('builds current-perspective display and connection direction matrices', () => {
    expect(buildSingleDirectionRightEdgeDirections(['a'])).toEqual({ a: 'forward' });
    expect(buildSingleDirectionRightEdgeDirections(['a'], 'backward')).toEqual({ a: 'backward' });

    const rightEdgeDirections = { a: 'forward', b: 'backward', c: 'bidirectional' } as const;
    expect(
      buildCurrentPerspectiveRightDisplayDirections({
        currentNodeId: 'outside',
        sourceId: 'source',
        targetId: 'target',
        rightEdgeDirections,
      })
    ).toBeUndefined();
    expect(
      buildCurrentPerspectiveRightDisplayDirections({
        currentNodeId: 'source',
        sourceId: 'source',
        targetId: 'target',
      })
    ).toBeUndefined();
    expect(
      buildCurrentPerspectiveRightDisplayDirections({
        currentNodeId: 'source',
        sourceId: 'source',
        targetId: 'target',
        rightEdgeDirections,
      })
    ).toEqual({
      a: 'partner_grants_right_to_current',
      b: 'current_grants_right_to_partner',
      c: 'mutual',
    });
    expect(
      buildCurrentPerspectiveRightDisplayDirections({
        currentNodeId: 'target',
        sourceId: 'source',
        targetId: 'target',
        rightEdgeDirections,
      })
    ).toEqual({
      a: 'current_grants_right_to_partner',
      b: 'partner_grants_right_to_current',
      c: 'mutual',
    });

    expect(
      buildCurrentPerspectiveRightConnectionDirections({
        currentNodeId: 'outside',
        sourceId: 'source',
        targetId: 'target',
        rightEdgeDirections,
      })
    ).toBeUndefined();
    expect(
      buildCurrentPerspectiveRightConnectionDirections({
        currentNodeId: 'source',
        sourceId: 'source',
        targetId: 'target',
      })
    ).toBeUndefined();
    expect(
      buildCurrentPerspectiveRightConnectionDirections({
        currentNodeId: 'source',
        sourceId: 'source',
        targetId: 'target',
        rightEdgeDirections,
      })
    ).toEqual({ a: 'outgoing', b: 'incoming', c: 'bidirectional' });
    expect(
      buildCurrentPerspectiveRightConnectionDirections({
        currentNodeId: 'target',
        sourceId: 'source',
        targetId: 'target',
        rightEdgeDirections,
      })
    ).toEqual({ a: 'incoming', b: 'outgoing', c: 'bidirectional' });

    expect(getNetworkUserConnectionDirections()).toEqual([]);
    expect(getNetworkUserConnectionDirections({ a: 'incoming' })).toEqual(['incoming']);
    expect(getNetworkUserConnectionDirections({ a: 'outgoing' })).toEqual(['outgoing']);
    expect(getNetworkUserConnectionDirections({ a: 'bidirectional' })).toEqual([
      'incoming',
      'outgoing',
    ]);
  });

  it('resolves preview context from explicit, root, flow, membership, and default perspectives', () => {
    const base = {
      structuralType: 'parent' as const,
      sourceGroupId: 'source',
      targetGroupId: 'target',
      sourceGroupName: 'Source',
      targetGroupName: 'Target',
    };
    expect(
      resolveNetworkRelationshipPreviewContext({ ...base, currentGroupId: 'target' })
    ).toMatchObject({ relationshipType: 'child', currentGroupId: 'target' });
    expect(
      resolveNetworkRelationshipPreviewContext({ ...base, graphRootGroupId: 'source' })
    ).toMatchObject({ relationshipType: 'parent', currentGroupId: 'source' });
    expect(
      resolveNetworkRelationshipPreviewContext({ ...base, graphRootGroupId: 'outside' })
    ).toMatchObject({ currentGroupId: 'source' });
    expect(
      resolveNetworkRelationshipPreviewContext({
        ...base,
        rightEdgeDirections: { a: 'backward' },
      })
    ).toMatchObject({ relationshipType: 'child', currentGroupId: 'target' });
    expect(
      resolveNetworkRelationshipPreviewContext({
        ...base,
        rightEdgeDirections: { a: 'forward' },
      })
    ).toMatchObject({ currentGroupId: 'source' });
    expect(
      resolveNetworkRelationshipPreviewContext({
        ...base,
        rightEdgeDirections: { a: 'bidirectional' },
        memberSourceGroupId: 'target',
      })
    ).toMatchObject({ currentGroupId: 'target' });
    expect(
      resolveNetworkRelationshipPreviewContext({ ...base, structuralType: 'sibling' })
    ).toMatchObject({ relationshipType: 'sibling' });

    expect(getNetworkPreviewMembershipDirection({ currentGroupId: 'source' })).toBeNull();
    expect(
      getNetworkPreviewMembershipDirection({
        currentGroupId: 'source',
        memberSourceGroupId: 'source',
      })
    ).toBeNull();
    expect(
      getNetworkPreviewMembershipDirection({
        currentGroupId: 'source',
        memberSourceGroupId: 'source',
        memberTargetGroupId: 'target',
      })
    ).toBe('current_members_to_partner');
    expect(
      getNetworkPreviewMembershipDirection({
        currentGroupId: 'target',
        memberSourceGroupId: 'source',
        memberTargetGroupId: 'target',
      })
    ).toBe('partner_members_to_current');
  });

  it('covers membership channel and edge construction fallbacks', () => {
    const forwardMembership = buildNetworkRelationshipEdge({
      edgeId: 'forward-membership',
      sourceId: 'source-node',
      targetId: 'target-node',
      sourceGroupId: 'source',
      targetGroupId: 'target',
      structuralType: 'child',
      rights: [MEMBERSHIP_FLOW_RIGHT],
      relationshipKinds: [],
      rightRelationshipKinds: {},
      membershipMode: 'all_members',
      memberSourceGroupId: 'source',
      memberTargetGroupId: 'target',
      fallbackStrokeColor: FALLBACK_STROKE,
      sourceName: 'Source',
      targetName: 'Target',
      previewCurrentGroupId: 'target',
      currentGroupId: 'outside',
    });
    expect(forwardMembership.data).toMatchObject({
      rights: [MEMBERSHIP_FLOW_RIGHT],
      rightRelationshipKinds: { [MEMBERSHIP_FLOW_RIGHT]: 'active' },
      rightEdgeDirections: { [MEMBERSHIP_FLOW_RIGHT]: 'forward' },
      relationshipType: 'parent',
      membershipSourceGroupName: 'Source',
      membershipTargetGroupName: 'Target',
      rightConnectionDirections: {},
    });

    const incompleteMembership = buildNetworkRelationshipEdge({
      edgeId: 'incomplete-membership',
      sourceId: 'source-node',
      targetId: 'target-node',
      sourceGroupId: 'source',
      targetGroupId: 'target',
      structuralType: 'sibling',
      rights: [],
      relationshipKinds: [],
      rightRelationshipKinds: {},
      membershipMode: 'all_members',
      memberSourceGroupId: 'source',
      memberTargetGroupId: null,
      fallbackStrokeColor: FALLBACK_STROKE,
    });
    expect(incompleteMembership.data).toMatchObject({ rights: [], rightEdgeDirections: undefined });

    const unrelatedMembership = buildNetworkRelationshipEdge({
      edgeId: 'unrelated-membership',
      sourceId: 'source-node',
      targetId: 'target-node',
      sourceGroupId: 'source',
      targetGroupId: 'target',
      structuralType: 'parent',
      rights: [],
      relationshipKinds: ['incoming'],
      rightRelationshipKinds: {},
      membershipMode: 'all_members',
      memberSourceGroupId: 'external-source',
      memberTargetGroupId: 'external-target',
      fallbackStrokeColor: FALLBACK_STROKE,
    });
    expect(unrelatedMembership.data).toMatchObject({
      membershipSourceGroupName: null,
      membershipTargetGroupName: null,
    });
    expect(getVisibleFlowDirection({ unknown: 'unknown' as never })).toBeNull();
  });

  it('returns canonical orientation without display directions and filters hierarchy inputs', () => {
    expect(
      orientRelationshipEdgeForCurrentPerspective({
        currentNodeId: 'source',
        sourceId: 'source',
        targetId: 'target',
      })
    ).toEqual({
      sourceId: 'source',
      targetId: 'target',
      rightEdgeDirections: undefined,
      rightDisplayDirections: undefined,
    });
    expect(
      orientRelationshipEdgeForCurrentPerspective({
        currentNodeId: 'outside',
        sourceId: 'source',
        targetId: 'target',
        rightEdgeDirections: { a: 'forward' },
      }).rightDisplayDirections
    ).toBeUndefined();

    const rows = [
      {
        relationship_type: 'sibling',
        connection_type: 'peer',
        group_id: 'parent',
        related_group_id: 'child',
        parent_group_id: null,
        child_group_id: null,
        with_right: 'ignored-peer',
      },
      {
        relationship_type: 'child',
        connection_type: 'hierarchy',
        group_id: 'other-parent',
        related_group_id: 'other-child',
        parent_group_id: 'other-parent',
        child_group_id: 'other-child',
        with_right: 'ignored-other-pair',
      },
      {
        relationship_type: 'child',
        connection_type: 'hierarchy',
        group_id: 'parent',
        related_group_id: 'child',
        parent_group_id: 'parent',
        child_group_id: 'child',
        with_right: null,
      },
      {
        relationship_type: 'child',
        connection_type: 'hierarchy',
        group_id: 'outside-a',
        related_group_id: 'outside-b',
        parent_group_id: 'parent',
        child_group_id: 'child',
        with_right: 'ignored-direction',
      },
    ] as never;
    expect(buildHierarchyRightEdgeDirections(rows, 'parent', 'child')).toEqual({});
    expect(buildRelationshipEdgeMarkers(FALLBACK_STROKE)).toEqual({
      markerStart: undefined,
      markerEnd: undefined,
    });
  });

  it('normalizes sparse and filtered dialog data, labels requests, and validates enums', () => {
    const sparse = buildNetworkRelationshipDialogData(
      { id: 'sparse', source: 'source', target: 'target', label: 'Fallback label' } as never,
      key => key
    );
    expect(sparse).toMatchObject({
      rights: [],
      relationshipKinds: [],
      relationshipType: undefined,
      membershipMode: undefined,
      membershipDirection: undefined,
      label: 'Fallback label',
    });
    expect(
      buildNetworkRelationshipDialogData(
        {
          id: 'relationship-kind-fallback',
          source: 'source',
          target: 'target',
          data: { rights: [], relationshipKinds: ['active'] },
        } as never,
        key => key
      ).relationshipKinds
    ).toEqual(['active']);

    const filtered = buildNetworkRelationshipDialogData(
      {
        id: 'filtered',
        source: 'source',
        target: 'target',
        data: {
          rights: ['fallback-right'],
          visibleRights: ['incoming-right', 'outgoing-right', MEMBERSHIP_FLOW_RIGHT],
          relationshipKinds: ['active'],
          rightRelationshipKinds: { ignored: 'active' },
          visibleRightRelationshipKinds: {
            'incoming-right': 'incoming',
            'outgoing-right': 'outgoing',
            [MEMBERSHIP_FLOW_RIGHT]: 'active',
          },
          rightEdgeDirections: {
            'incoming-right': 'forward',
            'outgoing-right': 'backward',
            ignored: 'forward',
          },
          rightConnectionDirections: {
            'incoming-right': 'incoming',
            'outgoing-right': 'outgoing',
            ignored: 'incoming',
          },
          rightDisplayDirections: {
            'incoming-right': 'current_grants_right_to_partner',
            'outgoing-right': 'partner_grants_right_to_current',
            ignored: 'mutual',
          },
          userConnectionDirections: ['incoming', 'outgoing'],
          sourceName: 'Source',
          targetName: 'Target',
          currentGroupId: 'source',
          currentGroupName: 'Source',
          selectedGroupId: 'target',
          selectedGroupName: 'Target',
          membershipSourceGroupId: 'source',
          membershipTargetGroupId: 'target',
          membershipSourceGroupName: 'Source',
          membershipTargetGroupName: 'Target',
          membershipRequiredSourceRoleId: 'role',
          membershipRequiredSourceRoleName: 'Role',
        },
      } as never,
      key => key
    );
    expect(filtered).toMatchObject({
      rights: ['incoming-right', 'outgoing-right'],
      relationshipKinds: ['incoming', 'outgoing', 'active'],
      connectionDirection: 'bidirectional',
      label: 'common.network.incomingRequest, common.network.outgoingRequest',
    });

    for (const relationshipType of ['parent', 'child', 'sibling', 'membership', 'invalid']) {
      const data = buildNetworkRelationshipDialogData(
        {
          id: relationshipType,
          source: 'source',
          target: 'target',
          data: { rights: [], relationshipType },
        } as never,
        key => key
      );
      expect(data.relationshipType).toBe(
        relationshipType === 'invalid' ? undefined : relationshipType
      );
    }
    for (const membershipMode of [
      'none',
      'all_members',
      'role_members',
      'selected_source_groups',
      'invalid',
    ]) {
      const data = buildNetworkRelationshipDialogData(
        {
          id: membershipMode,
          source: 'source',
          target: 'target',
          data: { rights: [], membershipMode },
        } as never,
        key => key
      );
      expect(data.membershipMode).toBe(membershipMode === 'invalid' ? undefined : membershipMode);
    }
    for (const membershipDirection of [
      'current_members_to_partner',
      'partner_members_to_current',
      'invalid',
    ]) {
      const data = buildNetworkRelationshipDialogData(
        {
          id: membershipDirection,
          source: 'source',
          target: 'target',
          data: { rights: [], membershipDirection },
        } as never,
        key => key
      );
      expect(data.membershipDirection).toBe(
        membershipDirection === 'invalid' ? undefined : membershipDirection
      );
    }
    expect(
      buildNetworkRelationshipDialogData(
        {
          id: 'outgoing',
          source: 'source',
          target: 'target',
          data: { rights: [], userConnectionDirections: ['outgoing'] },
        } as never,
        key => key
      ).connectionDirection
    ).toBe('outgoing');
    expect(
      buildNetworkRelationshipDialogData(
        {
          id: 'incoming',
          source: 'source',
          target: 'target',
          data: { rights: [], userConnectionDirections: ['incoming'] },
        } as never,
        key => key
      ).connectionDirection
    ).toBe('incoming');
  });

  it('anchors horizontally separated nodes on their inner left and right sides', () => {
    expect(
      resolveInnerAutoEdgeAnchors({
        sourceRect: { x: 0, y: 0, width: 120, height: 80 },
        targetRect: { x: 260, y: 20, width: 120, height: 80 },
      })
    ).toEqual({
      sourceX: 120,
      sourceY: 40,
      targetX: 260,
      targetY: 60,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    });
  });

  it('anchors vertically separated nodes on their inner top and bottom sides', () => {
    expect(
      resolveInnerAutoEdgeAnchors({
        sourceRect: { x: 40, y: 0, width: 120, height: 80 },
        targetRect: { x: 0, y: 220, width: 120, height: 80 },
      })
    ).toEqual({
      sourceX: 100,
      sourceY: 80,
      targetX: 60,
      targetY: 220,
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    });
  });

  it('keeps the fallback stroke color for single-direction edges', () => {
    expect(
      getRelationshipStrokeColor(FALLBACK_STROKE, {
        amendmentRight: 'forward',
      })
    ).toBe(FALLBACK_STROKE);
  });

  it('uses the shared bidirectional color when a right is explicitly bidirectional', () => {
    expect(
      getRelationshipStrokeColor(FALLBACK_STROKE, {
        amendmentRight: 'bidirectional',
      })
    ).toBe(getCivicNetworkEdgeColor('accent'));
  });

  it('uses the shared bidirectional color when different rights point in opposite directions', () => {
    expect(
      getRelationshipStrokeColor(FALLBACK_STROKE, {
        amendmentRight: 'forward',
        informationRight: 'backward',
      })
    ).toBe(getCivicNetworkEdgeColor('accent'));
  });

  it('uses the connection-direction color when the visible rights are unidirectional', () => {
    expect(
      getVisibleRelationshipStrokeColor({
        fallbackColor: FALLBACK_STROKE,
        connectionDirection: 'incoming',
        rightEdgeDirections: {
          amendmentRight: 'forward',
        },
      })
    ).toBe(getCivicNetworkEdgeColor('info'));
  });

  it('prefers purple over incoming/outgoing colors when visible rights are mixed-opposite', () => {
    expect(
      getVisibleRelationshipStrokeColor({
        fallbackColor: FALLBACK_STROKE,
        connectionDirection: 'incoming',
        rightEdgeDirections: {
          amendmentRight: 'forward',
          informationRight: 'backward',
        },
      })
    ).toBe(getCivicNetworkEdgeColor('accent'));
  });

  it('exposes shared civic edge and label styles', () => {
    expect(getCivicNetworkEdgeStyle({ tone: 'event' })).toMatchObject({
      stroke: 'var(--entity-event-border)',
      strokeWidth: 2,
    });
    expect(getCivicNetworkEdgeStyle({ tone: 'warning', dashed: true }).strokeDasharray).toBe('5 5');

    const labelStyle = getCivicNetworkLabelStyle({ tone: 'user' });

    expect(labelStyle.labelBgStyle).toMatchObject({
      fill: 'var(--card)',
      stroke: 'var(--entity-user-border)',
    });
    expect(labelStyle.labelBgBorderRadius).toBe(8);
  });

  it('maps forward and backward edge directions to anchor-usage directions', () => {
    expect(
      getAnchorUsageConnectionDirection({
        edgeDirection: 'forward',
        anchorSide: 'source',
      })
    ).toBe('incoming');

    expect(
      getAnchorUsageConnectionDirection({
        edgeDirection: 'backward',
        anchorSide: 'source',
      })
    ).toBe('outgoing');

    expect(
      getAnchorUsageConnectionDirection({
        edgeDirection: 'forward',
        anchorSide: 'target',
      })
    ).toBe('outgoing');

    expect(
      getAnchorUsageConnectionDirection({
        edgeDirection: 'backward',
        anchorSide: 'target',
      })
    ).toBe('incoming');
  });

  it('maps right edge directions into current-group display directions', () => {
    expect(
      buildCurrentPerspectiveRightDisplayDirections({
        currentNodeId: 'group-b',
        sourceId: 'group-a',
        targetId: 'group-b',
        rightEdgeDirections: {
          informationRight: 'forward',
          amendmentRight: 'backward',
        },
      })
    ).toEqual({
      informationRight: 'current_grants_right_to_partner',
      amendmentRight: 'partner_grants_right_to_current',
    });
  });

  it('keeps incoming-only edges on their canonical topology and exposes the current-group view', () => {
    expect(
      orientRelationshipEdgeForCurrentPerspective({
        currentNodeId: 'group-b',
        sourceId: 'group-a',
        targetId: 'group-b',
        rightEdgeDirections: {
          informationRight: 'forward',
        },
      })
    ).toEqual({
      sourceId: 'group-a',
      targetId: 'group-b',
      rightEdgeDirections: {
        informationRight: 'forward',
      },
      rightDisplayDirections: {
        informationRight: 'current_grants_right_to_partner',
      },
    });
  });

  it('keeps outgoing-only edges on their canonical topology and exposes the current-group view', () => {
    expect(
      orientRelationshipEdgeForCurrentPerspective({
        currentNodeId: 'group-b',
        sourceId: 'group-a',
        targetId: 'group-b',
        rightEdgeDirections: {
          informationRight: 'backward',
        },
      })
    ).toEqual({
      sourceId: 'group-a',
      targetId: 'group-b',
      rightEdgeDirections: {
        informationRight: 'backward',
      },
      rightDisplayDirections: {
        informationRight: 'partner_grants_right_to_current',
      },
    });
  });

  it('keeps mixed-direction edges on their canonical orientation', () => {
    expect(
      orientRelationshipEdgeForCurrentPerspective({
        currentNodeId: 'group-a',
        sourceId: 'group-a',
        targetId: 'group-b',
        rightEdgeDirections: {
          informationRight: 'forward',
          amendmentRight: 'backward',
        },
      })
    ).toEqual({
      sourceId: 'group-a',
      targetId: 'group-b',
      rightEdgeDirections: {
        informationRight: 'forward',
        amendmentRight: 'backward',
      },
      rightDisplayDirections: {
        informationRight: 'partner_grants_right_to_current',
        amendmentRight: 'current_grants_right_to_partner',
      },
    });
  });

  it('derives a stable visible flow direction from the visible rights', () => {
    expect(
      getVisibleFlowDirection({
        informationRight: 'forward',
      })
    ).toBe('forward');

    expect(
      getVisibleFlowDirection({
        informationRight: 'backward',
      })
    ).toBe('backward');

    expect(
      getVisibleFlowDirection({
        informationRight: 'forward',
        amendmentRight: 'backward',
      })
    ).toBe('bidirectional');
  });

  it('maps hierarchy rights to the rights-holder flow instead of the grantor flow', () => {
    expect(
      buildHierarchyRightEdgeDirections(
        [
          {
            id: 'rel-1',
            connection_id: 'connection-1',
            grant_id: 'grant-1',
            membership_request_id: null,
            request_item_kind: 'right',
            group_id: 'group-parent',
            related_group_id: 'group-child',
            relationship_type: 'child',
            connection_type: 'hierarchy',
            parent_group_id: 'group-parent',
            child_group_id: 'group-child',
            with_right: 'amendmentRight',
            status: 'active',
            initiator_group_id: 'group-parent',
            created_at: 0,
            member_source_group_id: 'group-child',
            member_target_group_id: 'group-parent',
            membership_mode: 'all_members',
            required_source_role_id: null,
            eligible_origin_group_ids: [],
            group: null,
            related_group: null,
          },
        ],
        'group-parent',
        'group-child'
      )
    ).toEqual({
      amendmentRight: 'forward',
    });

    expect(
      buildHierarchyRightEdgeDirections(
        [
          {
            id: 'rel-2',
            connection_id: 'connection-2',
            grant_id: 'grant-2',
            membership_request_id: null,
            request_item_kind: 'right',
            group_id: 'group-child',
            related_group_id: 'group-parent',
            relationship_type: 'parent',
            connection_type: 'hierarchy',
            parent_group_id: 'group-parent',
            child_group_id: 'group-child',
            with_right: 'informationRight',
            status: 'active',
            initiator_group_id: 'group-child',
            created_at: 0,
            member_source_group_id: 'group-child',
            member_target_group_id: 'group-parent',
            membership_mode: 'all_members',
            required_source_role_id: null,
            eligible_origin_group_ids: [],
            group: null,
            related_group: null,
          },
        ],
        'group-parent',
        'group-child'
      )
    ).toEqual({
      informationRight: 'backward',
    });
  });

  it('places forward markers at the edge end and backward markers at the edge start', () => {
    expect(
      buildRelationshipEdgeMarkers(FALLBACK_STROKE, {
        amendmentRight: 'forward',
      })
    ).toMatchObject({
      markerStart: undefined,
      markerEnd: {
        color: FALLBACK_STROKE,
      },
    });

    expect(
      buildRelationshipEdgeMarkers(FALLBACK_STROKE, {
        amendmentRight: 'backward',
      })
    ).toMatchObject({
      markerStart: {
        color: FALLBACK_STROKE,
      },
      markerEnd: undefined,
    });
  });

  it('preserves the membership metadata when building relationship dialog data', () => {
    const dialogData = buildNetworkRelationshipDialogData(
      {
        id: 'edge-1',
        source: 'group-a',
        target: 'group-b',
        data: {
          rights: ['informationRight'],
          relationshipType: 'sibling',
          membershipMode: 'role_members',
          membershipDirection: 'partner_members_to_current',
          membershipRequiredSourceRoleId: 'role-admin',
          membershipRequiredSourceRoleName: 'Admin',
        },
      } as never,
      key => key
    );

    expect(dialogData.membershipMode).toBe('role_members');
    expect(dialogData.membershipDirection).toBe('partner_members_to_current');
    expect(dialogData.membershipRequiredSourceRoleId).toBe('role-admin');
    expect(dialogData.membershipRequiredSourceRoleName).toBe('Admin');
  });

  it('builds shared relationship edges with the same preview metadata used by the group network', () => {
    const edge = buildNetworkRelationshipEdge({
      edgeId: featureThemeClassName('networkNetworkEdgeHelpersThemedGradientSurface'),
      sourceId: 'group-h1',
      targetId: 'group-b1',
      sourceGroupId: 'group-h1',
      targetGroupId: 'group-b1',
      structuralType: 'parent',
      rights: ['amendmentRight'],
      relationshipKinds: ['active'],
      rightRelationshipKinds: { amendmentRight: 'active' },
      membershipMode: 'all_members',
      memberSourceGroupId: 'group-b1',
      memberTargetGroupId: 'group-h1',
      rightEdgeDirections: { amendmentRight: 'backward' },
      fallbackStrokeColor: FALLBACK_STROKE,
      sourceName: 'H1',
      targetName: 'B1',
      previewCurrentGroupId: 'group-b1',
      currentGroupId: 'group-b1',
    });

    const dialogData = buildNetworkRelationshipDialogData(edge, key => key);

    expect(dialogData.relationshipType).toBe('child');
    expect(dialogData.currentGroupId).toBe('group-b1');
    expect(dialogData.currentGroupName).toBe('B1');
    expect(dialogData.selectedGroupId).toBe('group-h1');
    expect(dialogData.selectedGroupName).toBe('H1');
    expect(dialogData.membershipMode).toBe('all_members');
    expect(dialogData.membershipDirection).toBe('current_members_to_partner');
    expect(dialogData.membershipSourceGroupId).toBe('group-b1');
    expect(dialogData.membershipTargetGroupId).toBe('group-h1');
    expect(dialogData.membershipSourceGroupName).toBe('B1');
    expect(dialogData.membershipTargetGroupName).toBe('H1');
    expect(dialogData.rightDisplayDirections).toEqual({
      amendmentRight: 'partner_grants_right_to_current',
    });
    expect(edge.animated).toBe(true);
    expect(edge.markerStart).toBeDefined();
    expect(edge.markerEnd).toBeUndefined();
    expect(edge.style?.animationDirection).toBe('reverse');
  });

  it('keeps membership-only hierarchy flow canonical when viewed from the parent root', () => {
    const edge = buildNetworkRelationshipEdge({
      edgeId: 'edge-membership-flow',
      sourceId: 'group-h1',
      targetId: 'group-b2',
      sourceGroupId: 'group-h1',
      targetGroupId: 'group-b2',
      structuralType: 'parent',
      rights: [],
      relationshipKinds: ['active'],
      rightRelationshipKinds: {},
      membershipMode: 'all_members',
      memberSourceGroupId: 'group-b2',
      memberTargetGroupId: 'group-h1',
      rightEdgeDirections: {},
      fallbackStrokeColor: FALLBACK_STROKE,
      sourceName: 'H1',
      targetName: 'B2',
      graphRootGroupId: 'group-h1',
      currentGroupId: 'group-h1',
    });

    const dialogData = buildNetworkRelationshipDialogData(edge, key => key);

    expect(dialogData.currentGroupId).toBe('group-h1');
    expect(dialogData.currentGroupName).toBe('H1');
    expect(dialogData.selectedGroupId).toBe('group-b2');
    expect(dialogData.selectedGroupName).toBe('B2');
    expect(dialogData.membershipDirection).toBe('partner_members_to_current');
    expect(dialogData.membershipSourceGroupId).toBe('group-b2');
    expect(dialogData.membershipTargetGroupId).toBe('group-h1');
    expect(dialogData.membershipSourceGroupName).toBe('B2');
    expect(dialogData.membershipTargetGroupName).toBe('H1');
  });

  it('adds membership as a synthetic flow channel without exposing it as a dialog right', () => {
    const edge = buildNetworkRelationshipEdge({
      edgeId: 'edge-membership-and-rights',
      sourceId: 'group-h1',
      targetId: 'group-b1',
      sourceGroupId: 'group-h1',
      targetGroupId: 'group-b1',
      structuralType: 'parent',
      rights: ['informationRight'],
      relationshipKinds: ['active'],
      rightRelationshipKinds: { informationRight: 'active' },
      membershipMode: 'all_members',
      memberSourceGroupId: 'group-b1',
      memberTargetGroupId: 'group-h1',
      rightEdgeDirections: { informationRight: 'forward' },
      fallbackStrokeColor: FALLBACK_STROKE,
      sourceName: 'H1',
      targetName: 'B1',
      graphRootGroupId: 'group-h1',
      currentGroupId: 'group-h1',
    });

    const edgeData = edge.data as EditableRightsLabelEdgeData;

    expect(edgeData.rights).toEqual(['informationRight', MEMBERSHIP_FLOW_RIGHT]);
    expect(edgeData.rightEdgeDirections).toEqual({
      informationRight: 'forward',
      [MEMBERSHIP_FLOW_RIGHT]: 'backward',
    });
    expect(edgeData.visibleFlowDirection).toBe('bidirectional');
    expect(edge.markerStart).toBeDefined();
    expect(edge.markerEnd).toBeDefined();
    expect(edge.style?.animationDirection).toBeUndefined();

    const dialogData = buildNetworkRelationshipDialogData(edge, key => key);

    expect(dialogData.rights).toEqual(['informationRight']);
    expect(dialogData.rightEdgeDirections).toEqual({ informationRight: 'forward' });
    expect(dialogData.rightRelationshipKinds).toEqual({ informationRight: 'active' });
    expect(dialogData.membershipSourceGroupId).toBe('group-b1');
    expect(dialogData.membershipTargetGroupId).toBe('group-h1');
  });

  it('animates forward rights toward the edge end marker', () => {
    const edge = buildNetworkRelationshipEdge({
      edgeId: featureThemeClassName('networkNetworkEdgeHelpersThemedGradientSurfaceAlpha'),
      sourceId: 'group-b1',
      targetId: 'group-h1',
      sourceGroupId: 'group-b1',
      targetGroupId: 'group-h1',
      structuralType: 'child',
      rights: ['amendmentRight'],
      relationshipKinds: ['active'],
      rightRelationshipKinds: { amendmentRight: 'active' },
      membershipMode: 'none',
      rightEdgeDirections: { amendmentRight: 'forward' },
      fallbackStrokeColor: FALLBACK_STROKE,
      sourceName: 'B1',
      targetName: 'H1',
    });

    expect(edge.animated).toBe(true);
    expect(edge.markerStart).toBeUndefined();
    expect(edge.markerEnd).toBeDefined();
    expect(edge.style?.animationDirection).toBeUndefined();
  });

  it('keeps the graph root as the current group for sibling preview metadata', () => {
    const edge = buildNetworkRelationshipEdge({
      edgeId: featureThemeClassName('networkNetworkEdgeHelpersThemedGradientSurfaceBeta'),
      sourceId: 'group-h1',
      targetId: 'group-f1',
      sourceGroupId: 'group-h1',
      targetGroupId: 'group-f1',
      structuralType: 'sibling',
      rights: ['amendmentRight'],
      relationshipKinds: ['active'],
      rightRelationshipKinds: { amendmentRight: 'active' },
      membershipMode: 'role_members',
      memberSourceGroupId: 'group-f1',
      memberTargetGroupId: 'group-h1',
      membershipRequiredSourceRoleId: 'role-admin',
      membershipRequiredSourceRoleName: 'Admin',
      rightEdgeDirections: { amendmentRight: 'backward' },
      fallbackStrokeColor: FALLBACK_STROKE,
      sourceName: 'H1',
      targetName: 'Fraktion H1',
      graphRootGroupId: 'group-h1',
    });

    const dialogData = buildNetworkRelationshipDialogData(edge, key => key);

    expect(dialogData.currentGroupId).toBe('group-h1');
    expect(dialogData.currentGroupName).toBe('H1');
    expect(dialogData.selectedGroupId).toBe('group-f1');
    expect(dialogData.selectedGroupName).toBe('Fraktion H1');
    expect(dialogData.membershipDirection).toBe('partner_members_to_current');
    expect(dialogData.membershipRequiredSourceRoleId).toBe('role-admin');
    expect(dialogData.membershipRequiredSourceRoleName).toBe('Admin');
    expect(dialogData.rightConnectionDirections).toEqual({
      amendmentRight: 'incoming',
    });
    expect(dialogData.rightDisplayDirections).toEqual({
      amendmentRight: 'current_grants_right_to_partner',
    });
  });
});
