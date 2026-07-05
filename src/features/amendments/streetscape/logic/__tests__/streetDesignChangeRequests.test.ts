import { describe, expect, it } from 'vitest';
import { createPointStreetDesignObject } from '../streetDesignPlacement';
import { createEmptyStreetDesignState } from '../../state/streetDesignReducer';
import {
  getStreetDesignChangeRequestDiffRows,
  getStreetDesignChangeRequestMarker,
  getStreetDesignChangeRequests,
  getStreetDesignChangeRequestTone,
  type StreetDesignChangeRequest,
} from '../streetDesignChangeRequests';

describe('streetDesignChangeRequests', () => {
  it('filters streetscape records and sorts open requests first', () => {
    const records: StreetDesignChangeRequest[] = [
      {
        id: 'text-cr',
        source_type: null,
        status: 'open',
        voting_status: 'open',
        updated_at: 4,
      },
      {
        id: 'closed-street',
        source_type: 'street_design_object',
        status: 'completed',
        voting_status: 'completed',
        updated_at: 5,
      },
      {
        id: 'open-street',
        source_type: 'street_design_object',
        status: 'open',
        voting_status: 'open',
        updated_at: 1,
      },
    ];

    expect(getStreetDesignChangeRequests(records).map(record => record.id)).toEqual([
      'open-street',
      'closed-street',
    ]);
  });

  it('maps add, remove, and update tones', () => {
    expect(getStreetDesignChangeRequestTone({ change_type: 'insert' })).toBe('add');
    expect(getStreetDesignChangeRequestTone({ change_type: 'remove' })).toBe('remove');
    expect(getStreetDesignChangeRequestTone({ change_type: 'replace' })).toBe('update');
  });

  it('builds canvas marker coordinates and property diffs from snapshots', () => {
    const tree = createPointStreetDesignObject({
      id: 'tree-1',
      type: 'tree',
      point: { x: 10, z: -5 },
    });
    const changeRequest: StreetDesignChangeRequest = {
      id: 'cr-tree',
      source_type: 'street_design_object',
      source_id: 'tree-1',
      title: 'Move tree',
      change_type: 'update',
      original_properties: { properties: { height: 4, species: 'deciduous' } },
      new_properties: { properties: { height: 6, species: 'deciduous' } },
    };

    const marker = getStreetDesignChangeRequestMarker(changeRequest, {
      ...createEmptyStreetDesignState(),
      objects: [tree],
    });

    expect(marker).toMatchObject({
      id: 'cr-tree',
      label: 'Move tree',
      tone: 'update',
      leftPercent: 62,
      topPercent: 56,
    });
    expect(getStreetDesignChangeRequestDiffRows(changeRequest)).toEqual([
      { key: 'height', before: '4', after: '6' },
    ]);
  });
});
