import { describe, expect, it } from 'vitest';

import { areGroupNetworkLayoutsEqual, normalizeGroupNetworkLayout } from '../networkLayoutHelpers';

describe('networkLayoutHelpers', () => {
  it('treats layouts with the same content as equal even when their key order differs', () => {
    expect(
      areGroupNetworkLayoutsEqual(
        {
          node_positions: {
            'node-b': { x: 20, y: 40 },
            'node-a': { x: 10, y: 30 },
          },
          edge_bend_points: {
            'edge-b': [{ x: 5, y: 6 }],
            'edge-a': [{ x: 1, y: 2 }],
          },
        },
        {
          node_positions: {
            'node-a': { x: 10, y: 30 },
            'node-b': { x: 20, y: 40 },
          },
          edge_bend_points: {
            'edge-a': [{ x: 1, y: 2 }],
            'edge-b': [{ x: 5, y: 6 }],
          },
        }
      )
    ).toBe(true);
  });

  it('drops empty bend-point entries when normalizing a layout', () => {
    expect(
      normalizeGroupNetworkLayout({
        node_positions: {
          'node-b': { x: 20, y: 40 },
          'node-a': { x: 10, y: 30 },
        },
        edge_bend_points: {
          'edge-b': [],
          'edge-a': [{ x: 1, y: 2 }],
        },
      })
    ).toEqual({
      node_positions: {
        'node-a': { x: 10, y: 30 },
        'node-b': { x: 20, y: 40 },
      },
      edge_bend_points: {
        'edge-a': [{ x: 1, y: 2 }],
      },
    });
  });
});
