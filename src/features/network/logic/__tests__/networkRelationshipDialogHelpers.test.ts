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
  it('rejects unsupported relationship types', () => {
    expect(
      getRelationshipPreviewData(buildRelationship({ relationshipType: 'unsupported' as 'parent' }))
    ).toBeNull();
  });

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
    ).toBe('current_grants_right_to_partner');
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
    ).toBe('current_grants_right_to_partner');
  });

  it('swaps child relationships to their parent perspective', () => {
    expect(
      getRelationshipPreviewData(
        buildRelationship({
          source: 'child-child',
          target: 'parent-parent',
          sourceName: undefined,
          targetName: undefined,
          relationshipType: 'child',
        })
      )
    ).toEqual({
      relationshipType: 'parent',
      currentGroupName: 'parent-parent',
      currentGroupId: 'parent',
      selectedGroupName: 'child-child',
      selectedGroupId: 'child',
      isIncomingPerspective: true,
    });
  });

  it('prefers explicit preview metadata when the edge was display-oriented', () => {
    const preview = getRelationshipPreviewData(
      buildRelationship({
        relationshipType: 'child',
        source: 'hierarchieSeiteGewählt',
        target: 'parent-hierarchieOben',
        currentGroupId: 'hierarchieSeiteGewählt',
        currentGroupName: 'hierarchieSeiteGewählt',
        selectedGroupId: 'hierarchieOben',
        selectedGroupName: 'HierarchieOben',
      })
    );

    expect(preview).toEqual({
      relationshipType: 'child',
      currentGroupName: 'hierarchieSeiteGewählt',
      currentGroupId: 'hierarchieSeiteGewählt',
      selectedGroupName: 'HierarchieOben',
      selectedGroupId: 'hierarchieOben',
      isIncomingPerspective: false,
    });
  });

  it('handles explicit target perspective and absent endpoint ids', () => {
    expect(
      getRelationshipPreviewData(
        buildRelationship({
          source: undefined,
          target: undefined,
          sourceName: undefined,
          targetName: undefined,
          relationshipType: 'parent',
          userConnectionDirections: undefined,
        })
      )
    ).toEqual({
      relationshipType: 'parent',
      currentGroupName: '',
      currentGroupId: undefined,
      selectedGroupName: '',
      selectedGroupId: undefined,
      isIncomingPerspective: false,
    });

    expect(
      getRelationshipPreviewData(
        buildRelationship({
          currentGroupId: 'hierarchieSeiteGewählt',
          currentGroupName: 'Aktuell',
          selectedGroupId: 'hierarchieOben',
          selectedGroupName: 'Gewählt',
        })
      )?.isIncomingPerspective
    ).toBe(true);
  });

  it('does not swap outgoing or bidirectional hierarchy perspectives', () => {
    expect(
      getRelationshipPreviewData(
        buildRelationship({ relationshipType: 'parent', userConnectionDirections: ['outgoing'] })
      )?.isIncomingPerspective
    ).toBe(false);
    expect(
      getRelationshipPreviewData(
        buildRelationship({
          relationshipType: 'parent',
          userConnectionDirections: ['incoming', 'outgoing'],
        })
      )?.isIncomingPerspective
    ).toBe(false);
  });

  it('maps every edge direction in both preview perspectives', () => {
    expect(
      getRelationshipDirectionForPreview({
        edgeDirection: 'bidirectional',
        isIncomingPerspective: false,
      })
    ).toBe('mutual');
    expect(
      getRelationshipDirectionForPreview({
        edgeDirection: 'backward',
        isIncomingPerspective: true,
      })
    ).toBe('partner_grants_right_to_current');
    expect(
      getRelationshipDirectionForPreview({
        edgeDirection: 'forward',
        isIncomingPerspective: false,
      })
    ).toBe('partner_grants_right_to_current');
  });
});
