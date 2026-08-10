import { describe, expect, it } from 'vitest';
import {
  geoLocationFieldsFromShape,
  geoLocationShapeFromFields,
  hasGeoLocationBounds,
  hasGeoLocationGeometry,
  isAreaLocationKind,
  isGeoJsonGeometry,
  isGeoLocationBounds,
} from '../geoLocationShape';

describe('geo location shape contracts', () => {
  it.each(['postcode', 'city', 'region', 'country'] as const)('recognizes area kind %s', kind => {
    expect(isAreaLocationKind(kind)).toBe(true);
  });

  it('rejects point, unknown, and absent area kinds', () => {
    expect(isAreaLocationKind('point')).toBe(false);
    expect(isAreaLocationKind('unknown')).toBe(false);
    expect(isAreaLocationKind(null)).toBe(false);
  });

  it('validates geometry object shape', () => {
    expect(isGeoJsonGeometry(null)).toBe(false);
    expect(isGeoJsonGeometry('Point')).toBe(false);
    expect(isGeoJsonGeometry({ type: 1 })).toBe(false);
    expect(isGeoJsonGeometry({ type: 'Point', coordinates: [1, 2] })).toBe(true);
    expect(hasGeoLocationGeometry(null)).toBe(false);
    expect(hasGeoLocationGeometry({ kind: 'point', geometry: { type: 'Point' } })).toBe(true);
  });

  it('requires all four numeric bounds', () => {
    expect(isGeoLocationBounds(null)).toBe(false);
    expect(isGeoLocationBounds('bounds')).toBe(false);
    expect(isGeoLocationBounds({ south: '0', west: 0, north: 1, east: 1 })).toBe(false);
    expect(isGeoLocationBounds({ south: 0, west: '0', north: 1, east: 1 })).toBe(false);
    expect(isGeoLocationBounds({ south: 0, west: 0, north: '1', east: 1 })).toBe(false);
    expect(isGeoLocationBounds({ south: 0, west: 0, north: 1, east: '1' })).toBe(false);
    expect(isGeoLocationBounds({ south: 0, west: 0, north: 1, east: 1 })).toBe(true);
    expect(hasGeoLocationBounds(undefined)).toBe(false);
    expect(
      hasGeoLocationBounds({ kind: 'city', bounds: { south: 0, west: 0, north: 1, east: 1 } })
    ).toBe(true);
  });

  it('rejects absent and unknown stored kinds', () => {
    expect(geoLocationShapeFromFields(null)).toBeNull();
    expect(geoLocationShapeFromFields({ location_kind: null })).toBeNull();
    expect(geoLocationShapeFromFields({ location_kind: 'neighborhood' })).toBeNull();
  });

  it.each(['point', 'postcode', 'city', 'region', 'country'] as const)(
    'hydrates stored %s fields',
    kind => {
      expect(
        geoLocationShapeFromFields({
          location_kind: kind,
          location_place_id: 'place',
          location_boundary_source: 'geoapify',
          location_geometry: { type: 'Point', coordinates: [1, 2] },
          location_bounds: { south: 0, west: 0, north: 1, east: 1 },
        })
      ).toEqual({
        kind,
        placeId: 'place',
        boundarySource: 'geoapify',
        geometry: { type: 'Point', coordinates: [1, 2] },
        bounds: { south: 0, west: 0, north: 1, east: 1 },
      });
    }
  );

  it('normalizes invalid optional stored fields to null', () => {
    expect(
      geoLocationShapeFromFields({
        location_kind: 'city',
        location_geometry: 'invalid',
        location_bounds: {},
      })
    ).toEqual({
      kind: 'city',
      placeId: null,
      boundarySource: null,
      geometry: null,
      bounds: null,
    });
  });

  it('serializes absent, minimal, and complete shapes', () => {
    expect(geoLocationFieldsFromShape(null)).toEqual({
      location_kind: null,
      location_place_id: null,
      location_boundary_source: null,
      location_geometry: null,
      location_bounds: null,
    });
    expect(geoLocationFieldsFromShape({ kind: 'point' })).toEqual({
      location_kind: 'point',
      location_place_id: null,
      location_boundary_source: null,
      location_geometry: null,
      location_bounds: null,
    });
    expect(
      geoLocationFieldsFromShape({
        kind: 'city',
        placeId: 'place',
        boundarySource: 'source',
        geometry: { type: 'Point', coordinates: [1, 2] },
        bounds: { south: 0, west: 0, north: 1, east: 1 },
      })
    ).toMatchObject({
      location_kind: 'city',
      location_place_id: 'place',
      location_boundary_source: 'source',
      location_geometry: { type: 'Point', coordinates: [1, 2] },
      location_bounds: { south: 0, west: 0, north: 1, east: 1 },
    });
  });
});
