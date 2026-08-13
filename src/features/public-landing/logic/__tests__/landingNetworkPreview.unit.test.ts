import { describe, expect, it } from 'vitest';

import {
  landingNetworkEdges,
  landingNetworkNodes,
} from '@/features/public-landing/logic/landingNetworkPreview';
import type { EditableRightsLabelEdgeData } from '@/features/network/types/networkEdge.types';

describe('landingNetworkPreview', () => {
  it('builds rights-label edges with rights data', () => {
    expect(landingNetworkEdges.length).toBeGreaterThan(0);

    for (const edge of landingNetworkEdges) {
      const edgeData = edge.data as EditableRightsLabelEdgeData | undefined;

      expect(edge.type).toBe('rightsLabel');
      expect(edgeData?.rights?.length).toBeGreaterThan(0);
      expect(edgeData?.rightEdgeDirections).toBeDefined();
      expect(edgeData?.rightConnectionDirections).toBeDefined();
    }

    expect(landingNetworkEdges.some(edge => edge.data?.rights?.includes('amendmentRight'))).toBe(
      true
    );
    expect(landingNetworkEdges.some(edge => edge.data?.rights?.includes('rightToSpeak'))).toBe(
      true
    );
  });

  it('contains static political event nodes for the public dialog preview', () => {
    const eventNodes = landingNetworkNodes.filter(node => node.data.kind === 'event');

    expect(eventNodes).toHaveLength(2);
    expect(eventNodes.map(node => node.data.event?.title)).toEqual(
      expect.arrayContaining(['Public Committee Hearing', 'Parliamentary Group Meeting'])
    );
  });
});
