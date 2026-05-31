import { describe, expect, it } from 'vitest';

import {
  getAnchorUsageConnectionDirection,
  getRelationshipStrokeColor,
  getVisibleRelationshipStrokeColor,
} from '../networkEdgeHelpers';

describe('networkEdgeHelpers', () => {
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
});
