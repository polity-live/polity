import { featureThemeClassName, featureThemeValue } from '@/features/shared/theme';
import { Position } from '@xyflow/react';
import { describe, expect, it } from 'vitest';

import {
  buildHierarchyRightEdgeDirections,
  buildRelationshipEdgeMarkers,
  buildCurrentPerspectiveRightDisplayDirections,
  buildNetworkRelationshipEdge,
  buildNetworkRelationshipDialogData,
  getAnchorUsageConnectionDirection,
  getRelationshipStrokeColor,
  getVisibleFlowDirection,
  getVisibleRelationshipStrokeColor,
  orientRelationshipEdgeForCurrentPerspective,
  resolveInnerAutoEdgeAnchors,
} from '../networkEdgeHelpers';

describe('networkEdgeHelpers', () => {
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
      getRelationshipStrokeColor(
        featureThemeValue('amendmentAmendmentPathVisualizationSuccessColorAlpha'),
        {
          amendmentRight: 'forward',
        }
      )
    ).toBe(featureThemeValue('amendmentAmendmentPathVisualizationSuccessColorAlpha'));
  });

  it('uses the shared bidirectional color when a right is explicitly bidirectional', () => {
    expect(
      getRelationshipStrokeColor(
        featureThemeValue('amendmentAmendmentPathVisualizationSuccessColorAlpha'),
        {
          amendmentRight: 'bidirectional',
        }
      )
    ).toBe(featureThemeValue('chartChartRendererAccentColor'));
  });

  it('uses the shared bidirectional color when different rights point in opposite directions', () => {
    expect(
      getRelationshipStrokeColor(
        featureThemeValue('amendmentAmendmentPathVisualizationSuccessColorAlpha'),
        {
          amendmentRight: 'forward',
          informationRight: 'backward',
        }
      )
    ).toBe(featureThemeValue('chartChartRendererAccentColor'));
  });

  it('uses the connection-direction color when the visible rights are unidirectional', () => {
    expect(
      getVisibleRelationshipStrokeColor({
        fallbackColor: featureThemeValue('amendmentAmendmentPathVisualizationSuccessColorAlpha'),
        connectionDirection: 'incoming',
        rightEdgeDirections: {
          amendmentRight: 'forward',
        },
      })
    ).toBe(featureThemeValue('chartChartRendererInfoColor'));
  });

  it('prefers purple over incoming/outgoing colors when visible rights are mixed-opposite', () => {
    expect(
      getVisibleRelationshipStrokeColor({
        fallbackColor: featureThemeValue('amendmentAmendmentPathVisualizationSuccessColorAlpha'),
        connectionDirection: 'incoming',
        rightEdgeDirections: {
          amendmentRight: 'forward',
          informationRight: 'backward',
        },
      })
    ).toBe(featureThemeValue('chartChartRendererAccentColor'));
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
      informationRight: 'partner_has_right_in_current',
      amendmentRight: 'current_has_right_in_partner',
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
        informationRight: 'partner_has_right_in_current',
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
        informationRight: 'current_has_right_in_partner',
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
        informationRight: 'current_has_right_in_partner',
        amendmentRight: 'partner_has_right_in_current',
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
      buildRelationshipEdgeMarkers(
        featureThemeValue('amendmentAmendmentPathVisualizationSuccessColorAlpha'),
        {
          amendmentRight: 'forward',
        }
      )
    ).toMatchObject({
      markerStart: undefined,
      markerEnd: {
        color: featureThemeValue('amendmentAmendmentPathVisualizationSuccessColorAlpha'),
      },
    });

    expect(
      buildRelationshipEdgeMarkers(
        featureThemeValue('amendmentAmendmentPathVisualizationSuccessColorAlpha'),
        {
          amendmentRight: 'backward',
        }
      )
    ).toMatchObject({
      markerStart: {
        color: featureThemeValue('amendmentAmendmentPathVisualizationSuccessColorAlpha'),
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
        },
      } as never,
      key => key
    );

    expect(dialogData.membershipMode).toBe('role_members');
    expect(dialogData.membershipDirection).toBe('partner_members_to_current');
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
      fallbackStrokeColor: featureThemeValue(
        'amendmentAmendmentPathVisualizationSuccessColorAlpha'
      ),
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
    expect(dialogData.rightDisplayDirections).toEqual({
      amendmentRight: 'current_has_right_in_partner',
    });
    expect(edge.animated).toBe(true);
    expect(edge.markerStart).toBeDefined();
    expect(edge.markerEnd).toBeUndefined();
    expect(edge.style?.animationDirection).toBe('reverse');
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
      fallbackStrokeColor: featureThemeValue(
        'amendmentAmendmentPathVisualizationSuccessColorAlpha'
      ),
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
      rightEdgeDirections: { amendmentRight: 'backward' },
      fallbackStrokeColor: featureThemeValue(
        'amendmentAmendmentPathVisualizationSuccessColorAlpha'
      ),
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
    expect(dialogData.rightConnectionDirections).toEqual({
      amendmentRight: 'incoming',
    });
    expect(dialogData.rightDisplayDirections).toEqual({
      amendmentRight: 'partner_has_right_in_current',
    });
  });
});
