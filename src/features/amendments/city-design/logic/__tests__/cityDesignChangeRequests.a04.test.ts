import { describe, expect, it } from 'vitest';
import type { CityDesignChangeRequest } from '../cityDesignChangeRequests';
import type { CityDesignObject } from '../../types';
import { createEmptyCityDesignState } from '../../state/cityDesignReducer';
import {
  cityDesignChangeRequestInternals,
  formatCityDesignChangeRequestIdentifier,
  formatCityDesignChangeRequestTitle,
  getCityDesignChangeRequestCityDesignId,
  getCityDesignChangeRequestDiffRows,
  getCityDesignChangeRequestDiscussionId,
  getCityDesignChangeRequestMarker,
  getCityDesignChangeRequestObjectId,
  getCityDesignChangeRequestOverlayObjects,
  getCityDesignChangeRequests,
  getCityDesignChangeRequestTone,
  isCityDesignChangeRequest,
} from '../cityDesignChangeRequests';

const object = (id: string, x = 2): CityDesignObject => ({
  id,
  type: 'street_lamp',
  geometry: { kind: 'point', point: { x, z: -3 }, rotation: 0 },
  properties: { enabled: true },
  cost: { rule: 'per_item', currency: 'EUR', suggestedUnitCostMinor: 100 },
});

const request = (overrides: Partial<CityDesignChangeRequest> = {}): CityDesignChangeRequest => ({
  id: 'request-123456789',
  source_type: 'city_design_object',
  status: 'open',
  voting_status: 'open',
  ...overrides,
});

describe('cityDesignChangeRequests A04 alternatives', () => {
  it('normalizes source types, tones, identifiers, titles, and discussions', () => {
    expect(isCityDesignChangeRequest({ source_type: undefined })).toBe(false);
    expect(isCityDesignChangeRequest({ source_type: ' CITY_DESIGN_CUSTOM ' })).toBe(true);
    expect(isCityDesignChangeRequest({ source_type: 'other' })).toBe(false);
    expect(
      ['add', 'insert'].map(change_type => getCityDesignChangeRequestTone({ change_type }))
    ).toEqual(['add', 'add']);
    expect(
      ['delete', 'remove'].map(change_type => getCityDesignChangeRequestTone({ change_type }))
    ).toEqual(['remove', 'remove']);
    expect(
      ['replace', 'update'].map(change_type => getCityDesignChangeRequestTone({ change_type }))
    ).toEqual(['update', 'update']);
    expect(getCityDesignChangeRequestTone({ change_type: 'noop' })).toBe('neutral');

    expect(formatCityDesignChangeRequestIdentifier(request({ display_cr_id: 'CR-A' }))).toBe(
      'CR-A'
    );
    expect(formatCityDesignChangeRequestIdentifier(request({ displayCrId: 'CR-B' }))).toBe('CR-B');
    expect(formatCityDesignChangeRequestIdentifier(request())).toBe('CR-request-');
    expect(formatCityDesignChangeRequestTitle(request({ title: 'Title' }))).toBe('Title');
    expect(formatCityDesignChangeRequestTitle(request({ source_title: 'Source' }))).toBe('Source');
    expect(formatCityDesignChangeRequestTitle(request({ change_type: null }))).toContain('Change');
    expect(formatCityDesignChangeRequestTitle(request({ change_type: 'update' }))).toContain(
      'Update'
    );
    expect(getCityDesignChangeRequestDiscussionId(request({ discussion_id: 'd1' }))).toBe('d1');
    expect(getCityDesignChangeRequestDiscussionId(request({ discussionId: 'd2' }))).toBe('d2');
    expect(getCityDesignChangeRequestDiscussionId(request())).toContain('city-design-cr:');
  });

  it('sorts nullable request collections by open state and every timestamp form', () => {
    expect(getCityDesignChangeRequests(null)).toEqual([]);
    const sorted = getCityDesignChangeRequests([
      request({ id: 'closed', status: 'closed', updated_at: 500 }),
      request({ id: 'closed-newer', status: 'closed', updated_at: 600 }),
      request({ id: 'invalid', updated_at: 'not-a-date' }),
      request({ id: 'dated', updated_at: '2025-01-01T00:00:00Z' }),
      request({ id: 'empty', updated_at: null }),
      request({ id: 'irrelevant', source_type: 'other' }),
    ]);
    expect(sorted.map(item => item.id)).toEqual([
      'dated',
      'invalid',
      'empty',
      'closed-newer',
      'closed',
    ]);
    expect(cityDesignChangeRequestInternals.getTimestamp(12)).toBe(12);
  });

  it('resolves object and design identifiers through all snapshot fallbacks', () => {
    const before = object('before');
    const after = object('after');
    expect(getCityDesignChangeRequestObjectId(request({ source_id: 'direct' }))).toBe('direct');
    expect(getCityDesignChangeRequestObjectId(request({ new_properties: { object: after } }))).toBe(
      'after'
    );
    expect(
      getCityDesignChangeRequestObjectId(request({ original_properties: { object: before } }))
    ).toBe('before');
    expect(getCityDesignChangeRequestObjectId(request())).toBeNull();
    expect(
      getCityDesignChangeRequestCityDesignId(request({ new_properties: { cityDesignId: 'new' } }))
    ).toBe('new');
    expect(
      getCityDesignChangeRequestCityDesignId(
        request({ original_properties: { cityDesignId: 'old' } })
      )
    ).toBe('old');
    expect(
      getCityDesignChangeRequestCityDesignId(
        request({ source_type: 'city_design_scene', source_id: 'scene' })
      )
    ).toBe('scene');
    expect(getCityDesignChangeRequestCityDesignId(request())).toBeNull();
  });

  it('builds add, remove, partial update, complete update, and empty overlays', () => {
    const before = object('before');
    const after = object('after');
    const overlays = getCityDesignChangeRequestOverlayObjects([
      request({ id: 'add', change_type: 'add', new_properties: { object: after } }),
      request({ id: 'remove', change_type: 'remove', original_properties: { object: before } }),
      request({
        id: 'both',
        change_type: 'update',
        original_properties: { object: before },
        new_properties: { object: after },
      }),
      request({ id: 'before', change_type: 'update', original_properties: { object: before } }),
      request({ id: 'after', change_type: 'update', new_properties: { object: after } }),
      request({ id: 'none', change_type: 'update' }),
    ]);
    expect(overlays).toHaveLength(6);
    expect(getCityDesignChangeRequestOverlayObjects(undefined)).toEqual([]);
  });

  it('derives marker positions from design objects, snapshots, and the origin fallback', () => {
    const placed = object('placed', 10);
    const design = { ...createEmptyCityDesignState(), objects: [placed] };
    expect(
      getCityDesignChangeRequestMarker(request({ source_id: 'placed', change_type: 'add' }), design)
        .position
    ).toEqual({ x: 10, z: -3 });
    expect(
      getCityDesignChangeRequestMarker(
        request({ new_properties: { object: object('snapshot', 100) } }),
        design
      ).leftPercent
    ).toBe(92);
    expect(
      getCityDesignChangeRequestMarker(
        request({ original_properties: { object: object('old-snapshot', -100) } }),
        design
      ).leftPercent
    ).toBe(8);
    expect(getCityDesignChangeRequestMarker(request(), design).position).toEqual({ x: 0, z: 0 });
  });

  it('compares object, scene, property, and direct snapshot values', () => {
    const { getComparableProperties, getSnapshotCityDesignId, stringifyDiffValue } =
      cityDesignChangeRequestInternals;
    expect(getComparableProperties(null)).toEqual({});
    expect(getComparableProperties({ object: { properties: { a: 1 } } })).toEqual({ a: 1 });
    expect(
      getComparableProperties({
        scene: { origin: {}, osmSnapshot: {}, mapSelection: {}, currency: 'EUR', flag: true },
      })
    ).toEqual({ currency: 'EUR', flag: true });
    expect(getComparableProperties({ properties: { b: 2 } })).toEqual({ b: 2 });
    expect(
      getComparableProperties({ id: 'ignored', type: 'tree', cost: {}, useful: 3, empty: null })
    ).toEqual({ useful: 3, empty: null });
    expect(getSnapshotCityDesignId({ cityDesignId: '  ' })).toBeNull();
    expect(getSnapshotCityDesignId([])).toBeNull();
    expect([undefined, null, 'x', 2, false, { a: 1 }].map(stringifyDiffValue)).toEqual([
      '-',
      'null',
      'x',
      '2',
      'false',
      '{"a":1}',
    ]);
    expect(
      getCityDesignChangeRequestDiffRows({
        original_properties: { properties: { a: 1, gone: 'x' } },
        new_properties: { properties: { a: 2, added: null } },
      })
    ).toEqual([
      { key: 'a', before: '1', after: '2' },
      { key: 'added', before: '-', after: 'null' },
      { key: 'gone', before: 'x', after: '-' },
    ]);
  });
});
