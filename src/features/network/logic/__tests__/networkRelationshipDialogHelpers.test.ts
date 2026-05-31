import { describe, expect, it } from 'vitest';

import {
  getRelationshipDirectionForPreview,
  getRelationshipPreviewData,
} from '../networkRelationshipDialogHelpers';
import type { NetworkRelationshipDialogData } from '../../types/networkEdge.types';

function buildRelationship(
  overrides: Partial<NetworkRelationshipDialogData>
): NetworkRelationshipDialogData {
  return {
    source: 'hierarchieOben',
    target: 'hierarchieSeiteGewählt',
    sourceName: 'HierarchieOben',
    targetName: 'hierarchieSeiteGewählt',
    rights: ['informationRight'],
    relationshipKinds: ['incoming'],
    rightRelationshipKinds: { informationRight: 'incoming' },
    relationshipType: 'sibling',
    rightEdgeDirections: { informationRight: 'backward' },
    userConnectionDirections: ['incoming'],
    label: null,
    ...overrides,
  };
}

describe('networkRelationshipDialogHelpers', () => {
  it('keeps sibling preview anchored to the source group for incoming-only edges', () => {
    const preview = getRelationshipPreviewData(buildRelationship({ relationshipType: 'sibling' }));

    expect(preview).toEqual({
      relationshipType: 'sibling',
      currentGroupName: 'HierarchieOben',
      currentGroupId: 'hierarchieOben',
      selectedGroupName: 'hierarchieSeiteGewählt',
      selectedGroupId: 'hierarchieSeiteGewählt',
      isIncomingPerspective: false,
    });
    expect(
      getRelationshipDirectionForPreview({
        edgeDirection: 'backward',
        isIncomingPerspective: preview?.isIncomingPerspective ?? false,
      })
    ).toBe('incoming');
  });

  it('still swaps incoming hierarchy edges into the current-group perspective', () => {
    const preview = getRelationshipPreviewData(
      buildRelationship({
        source: 'parent-hierarchieOben',
        relationshipType: 'parent',
        rightEdgeDirections: { informationRight: 'forward' },
      })
    );

    expect(preview).toEqual({
      relationshipType: 'child',
      currentGroupName: 'hierarchieSeiteGewählt',
      currentGroupId: 'hierarchieSeiteGewählt',
      selectedGroupName: 'HierarchieOben',
      selectedGroupId: 'hierarchieOben',
      isIncomingPerspective: true,
    });
    expect(
      getRelationshipDirectionForPreview({
        edgeDirection: 'forward',
        isIncomingPerspective: preview?.isIncomingPerspective ?? false,
      })
    ).toBe('incoming');
  });
});
