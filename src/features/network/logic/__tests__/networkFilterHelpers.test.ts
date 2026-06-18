import { MarkerType, type Edge } from '@xyflow/react';
import { describe, expect, it } from 'vitest';

import { filterEdgesByConnectionDirections, filterEdgesByRights } from '../networkFilterHelpers';
import { MEMBERSHIP_FLOW_RIGHT } from '@/features/shared/ui/status';
import { buildNetworkRelationshipEdge, getCivicNetworkEdgeColor } from '../networkEdgeHelpers';
import type { EditableRightsLabelEdgeData } from '../../types/networkEdge.types';

function createRelationshipEdge(): Edge<EditableRightsLabelEdgeData> {
  return {
    id: 'edge-group-a-group-b',
    source: 'group-a',
    target: 'group-b',
    type: 'rightsLabel',
    style: {
      stroke: getCivicNetworkEdgeColor('neutral'),
      strokeWidth: 2,
    },
    markerStart: {
      type: MarkerType.ArrowClosed,
      color: getCivicNetworkEdgeColor('neutral'),
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: getCivicNetworkEdgeColor('neutral'),
    },
    data: {
      rights: ['amendmentRight', 'rightToSpeak'],
      rightEdgeDirections: {
        amendmentRight: 'forward',
        rightToSpeak: 'backward',
      },
      rightConnectionDirections: {
        amendmentRight: 'incoming',
        rightToSpeak: 'outgoing',
      },
      userConnectionDirections: ['incoming', 'outgoing'],
    },
  } as Edge<EditableRightsLabelEdgeData>;
}

describe('networkFilterHelpers', () => {
  it('shows a mixed-direction edge as purple when both visible rights remain', () => {
    const [edge] = filterEdgesByRights(
      [createRelationshipEdge()],
      new Set(['amendmentRight', 'rightToSpeak'])
    );

    expect(edge?.style?.stroke).toBe(getCivicNetworkEdgeColor('accent'));
    expect(edge?.animated).toBe(false);
    expect((edge?.data as EditableRightsLabelEdgeData | undefined)?.visibleFlowDirection).toBe(
      'bidirectional'
    );
    expect((edge?.data as EditableRightsLabelEdgeData | undefined)?.visibleRights).toEqual([
      'amendmentRight',
      'rightToSpeak',
    ]);
  });

  it('keeps only incoming rights and recolors the edge blue', () => {
    const [edge] = filterEdgesByConnectionDirections(
      [createRelationshipEdge()],
      new Set(['incoming'])
    );

    expect((edge?.data as EditableRightsLabelEdgeData | undefined)?.visibleRights).toEqual([
      'amendmentRight',
    ]);
    expect(edge?.style?.stroke).toBe(getCivicNetworkEdgeColor('info'));
    expect(edge?.animated).toBe(true);
    expect(edge?.style?.animationDirection).toBeUndefined();
  });

  it('keeps forward rights on the edge end after right filtering', () => {
    const [edge] = filterEdgesByRights([createRelationshipEdge()], new Set(['amendmentRight']));

    expect(edge?.markerStart).toBeUndefined();
    expect(edge?.markerEnd).toBeDefined();
  });

  it('keeps backward rights on the edge start after right filtering', () => {
    const [edge] = filterEdgesByRights([createRelationshipEdge()], new Set(['rightToSpeak']));

    expect(edge?.markerStart).toBeDefined();
    expect(edge?.markerEnd).toBeUndefined();
  });

  it('keeps only outgoing rights and recolors the edge orange', () => {
    const [edge] = filterEdgesByConnectionDirections(
      [createRelationshipEdge()],
      new Set(['outgoing'])
    );

    expect((edge?.data as EditableRightsLabelEdgeData | undefined)?.visibleRights).toEqual([
      'rightToSpeak',
    ]);
    expect(edge?.style?.stroke).toBe(getCivicNetworkEdgeColor('warning'));
    expect(edge?.animated).toBe(true);
    expect(edge?.style?.animationDirection).toBe('reverse');
  });

  it('does not fall back to the edge-level direction when per-right directions exist', () => {
    const edge = createRelationshipEdge();
    edge.data = {
      ...edge.data,
      rights: ['amendmentRight', 'rightToSpeak', 'informationRight'],
      userConnectionDirections: ['incoming'],
      rightEdgeDirections: {
        amendmentRight: 'forward',
        rightToSpeak: 'backward',
        informationRight: 'forward',
      },
      rightConnectionDirections: {
        amendmentRight: 'incoming',
        rightToSpeak: 'outgoing',
      },
    };

    const [filteredEdge] = filterEdgesByConnectionDirections([edge], new Set(['incoming']));

    expect((filteredEdge?.data as EditableRightsLabelEdgeData | undefined)?.visibleRights).toEqual([
      'amendmentRight',
    ]);
  });

  it('filters membership flow independently from real right flow', () => {
    const edge = buildNetworkRelationshipEdge({
      edgeId: 'edge-h1-b1',
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
      fallbackStrokeColor: getCivicNetworkEdgeColor('success'),
      sourceName: 'H1',
      targetName: 'B1',
      graphRootGroupId: 'group-h1',
      currentGroupId: 'group-h1',
    });

    const [membershipEdge] = filterEdgesByRights([edge], new Set([MEMBERSHIP_FLOW_RIGHT]));
    const [rightEdge] = filterEdgesByRights([edge], new Set(['informationRight']));

    expect(
      (membershipEdge?.data as EditableRightsLabelEdgeData | undefined)?.visibleRights
    ).toEqual([MEMBERSHIP_FLOW_RIGHT]);
    expect(membershipEdge?.markerStart).toBeDefined();
    expect(membershipEdge?.markerEnd).toBeUndefined();
    expect(membershipEdge?.style?.animationDirection).toBe('reverse');

    expect((rightEdge?.data as EditableRightsLabelEdgeData | undefined)?.visibleRights).toEqual([
      'informationRight',
    ]);
    expect(rightEdge?.markerStart).toBeUndefined();
    expect(rightEdge?.markerEnd).toBeDefined();
    expect(rightEdge?.style?.animationDirection).toBeUndefined();
  });
});
