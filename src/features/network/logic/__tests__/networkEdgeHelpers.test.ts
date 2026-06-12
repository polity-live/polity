import { Position } from '@xyflow/react';
import { describe, expect, it } from 'vitest';

import {
  buildHierarchyRightEdgeDirections,
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
      getRelationshipStrokeColor('#66bb6a', {
        amendmentRight: 'forward',
      })
    ).toBe('#66bb6a');
  });

  it('uses the shared bidirectional color when a right is explicitly bidirectional', () => {
    expect(
      getRelationshipStrokeColor('#66bb6a', {
        amendmentRight: 'bidirectional',
      })
    ).toBe('#7c3aed');
  });

  it('uses the shared bidirectional color when different rights point in opposite directions', () => {
    expect(
      getRelationshipStrokeColor('#66bb6a', {
        amendmentRight: 'forward',
        informationRight: 'backward',
      })
    ).toBe('#7c3aed');
  });

  it('uses the connection-direction color when the visible rights are unidirectional', () => {
    expect(
      getVisibleRelationshipStrokeColor({
        fallbackColor: '#66bb6a',
        connectionDirection: 'incoming',
        rightEdgeDirections: {
          amendmentRight: 'forward',
        },
      })
    ).toBe('#2563eb');
  });

  it('prefers purple over incoming/outgoing colors when visible rights are mixed-opposite', () => {
    expect(
      getVisibleRelationshipStrokeColor({
        fallbackColor: '#66bb6a',
        connectionDirection: 'incoming',
        rightEdgeDirections: {
          amendmentRight: 'forward',
          informationRight: 'backward',
        },
      })
    ).toBe('#7c3aed');
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
      informationRight: 'outgoing',
      amendmentRight: 'incoming',
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
        informationRight: 'outgoing',
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
        informationRight: 'incoming',
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
        informationRight: 'incoming',
        amendmentRight: 'outgoing',
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
            network_link_id: 'link-1',
            network_link_right_id: 'link-right-1',
            group_id: 'group-parent',
            related_group_id: 'group-child',
            relationship_type: 'child',
            structural_relation: 'parent_child',
            with_right: 'amendmentRight',
            status: 'active',
            initiator_group_id: 'group-parent',
            created_at: 0,
            membership_mode: 'all_members',
            membership_direction: 'forward',
            relationship_direction: 'forward',
            group: null,
            related_group: null,
            right_direction: 'forward',
          },
        ],
        'group-parent',
        'group-child'
      )
    ).toEqual({
      amendmentRight: 'backward',
    });

    expect(
      buildHierarchyRightEdgeDirections(
        [
          {
            id: 'rel-2',
            network_link_id: 'link-2',
            network_link_right_id: 'link-right-2',
            group_id: 'group-child',
            related_group_id: 'group-parent',
            relationship_type: 'parent',
            structural_relation: 'parent_child',
            with_right: 'informationRight',
            status: 'active',
            initiator_group_id: 'group-child',
            created_at: 0,
            membership_mode: 'all_members',
            membership_direction: 'forward',
            relationship_direction: 'backward',
            group: null,
            related_group: null,
            right_direction: 'backward',
          },
        ],
        'group-parent',
        'group-child'
      )
    ).toEqual({
      informationRight: 'forward',
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
          membershipDirection: 'incoming',
        },
      } as never,
      key => key
    );

    expect(dialogData.membershipMode).toBe('role_members');
    expect(dialogData.membershipDirection).toBe('incoming');
  });

  it('builds shared relationship edges with the same preview metadata used by the group network', () => {
    const edge = buildNetworkRelationshipEdge({
      edgeId: 'edge-parent-h1-to-b1',
      sourceId: 'group-h1',
      targetId: 'group-b1',
      sourceGroupId: 'group-h1',
      targetGroupId: 'group-b1',
      structuralType: 'parent',
      rights: ['amendmentRight'],
      relationshipKinds: ['active'],
      rightRelationshipKinds: { amendmentRight: 'active' },
      membershipMode: 'all_members',
      membershipCanonicalDirection: 'forward',
      rightEdgeDirections: { amendmentRight: 'backward' },
      fallbackStrokeColor: '#66bb6a',
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
    expect(dialogData.membershipDirection).toBe('incoming');
    expect(dialogData.rightDisplayDirections).toEqual({
      amendmentRight: 'incoming',
    });
  });
});
