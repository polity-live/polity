import { describe, expect, it } from 'vitest';

import {
  getStreetDesignChangeRequestStreetDesignId,
  isStreetDesignChangeRequest,
} from '../../logic/streetDesignChangeRequests';
import { createEmptyStreetDesignState } from '../../state/streetDesignReducer';
import { resolveStreetDesignPreviewState } from '../StreetDesignChangeRequestPreview';

describe('StreetDesignChangeRequestPreview helpers', () => {
  it('recognizes street design source types and snapshot street design ids', () => {
    const changeRequest = {
      id: 'cr-1',
      source_type: 'street_design_scene',
      source_id: 'street-design-source',
      new_properties: { streetDesignId: 'street-design-snapshot' },
    };

    expect(isStreetDesignChangeRequest(changeRequest)).toBe(true);
    expect(getStreetDesignChangeRequestStreetDesignId(changeRequest)).toBe(
      'street-design-snapshot'
    );
  });

  it('uses the matching street design state before falling back to the first design', () => {
    const firstDesign = createEmptyStreetDesignState({
      lat: 1,
      lon: 1,
      label: 'First design',
    });
    const matchingDesign = createEmptyStreetDesignState({
      lat: 2,
      lon: 2,
      label: 'Matching design',
    });

    const resolved = resolveStreetDesignPreviewState(
      {
        id: 'cr-1',
        source_type: 'street_design_object',
        source_id: 'building-1',
        change_type: 'insert',
        new_properties: { streetDesignId: 'street-design-2' },
      },
      [
        { id: 'street-design-1', design_state: firstDesign },
        { id: 'street-design-2', design_state: matchingDesign },
      ]
    );

    expect(resolved.origin.label).toBe('Matching design');
  });
});
