import { Position } from '@xyflow/react';
import { describe, expect, it } from 'vitest';

import {
  buildCurrentPerspectiveRightDisplayDirections,
  buildNetworkRelationshipDialogData,
  getAnchorUsageConnectionDirection,
  getRelationshipStrokeColor,
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
      informationRight: 'incoming',
      amendmentRight: 'outgoing',
    });
  });

  it('reorients incoming-only edges from the right holder to the context group', () => {
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
      sourceId: 'group-b',
      targetId: 'group-a',
      rightEdgeDirections: {
        informationRight: 'forward',
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
        informationRight: 'outgoing',
        amendmentRight: 'incoming',
      },
    });
  });

  it('preserves the membership mode when building relationship dialog data', () => {
    const dialogData = buildNetworkRelationshipDialogData(
      {
        id: 'edge-1',
        source: 'group-a',
        target: 'group-b',
        data: {
          rights: ['informationRight'],
          relationshipType: 'sibling',
          membershipMode: 'role_members',
        },
      } as never,
      key => key
    );

    expect(dialogData.membershipMode).toBe('role_members');
  });
});
