import type { Edge } from '@xyflow/react';
import { describe, expect, it } from 'vitest';

import { filterEdgesByConnectionDirections, filterEdgesByRights } from '../networkFilterHelpers';
import type { EditableRightsLabelEdgeData } from '../../types/networkEdge.types';

function createRelationshipEdge(): Edge<EditableRightsLabelEdgeData> {
  return {
    id: 'edge-group-a-group-b',
    source: 'group-a',
    target: 'group-b',
    type: 'rightsLabel',
    style: {
      stroke: '#64748b',
      strokeWidth: 2,
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

    expect(edge?.style?.stroke).toBe('#7c3aed');
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
    expect(edge?.style?.stroke).toBe('#2563eb');
    expect(edge?.animated).toBe(true);
    expect(edge?.style?.animationDirection).toBeUndefined();
  });

  it('keeps only outgoing rights and recolors the edge orange', () => {
    const [edge] = filterEdgesByConnectionDirections(
      [createRelationshipEdge()],
      new Set(['outgoing'])
    );

    expect((edge?.data as EditableRightsLabelEdgeData | undefined)?.visibleRights).toEqual([
      'rightToSpeak',
    ]);
    expect(edge?.style?.stroke).toBe('#d97706');
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
});
