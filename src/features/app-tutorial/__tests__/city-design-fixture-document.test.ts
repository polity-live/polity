import { describe, expect, it } from 'vitest';

import fixtureJson from '../fixtures/euckenstrasse-38-osm.json';
import { validateAppTutorialCityDesignFixtureDocument } from '../city-design-fixture-document';

function fixture() {
  return structuredClone(fixtureJson) as any;
}

describe('app tutorial City Design fixture document validation', () => {
  it.each([null, [], {}, { schemaVersion: 2 }])('rejects unsupported root value %#', value => {
    expect(() => validateAppTutorialCityDesignFixtureDocument(value)).toThrow(
      'unsupported schema version'
    );
  });

  it.each([
    ['non-string attribution', (value: any) => (value.attribution = 4)],
    ['missing OpenStreetMap', (value: any) => (value.attribution = 'ODbL')],
    ['missing ODbL', (value: any) => (value.attribution = 'OpenStreetMap')],
    ['non-string copyright URL', (value: any) => (value.copyrightUrl = null)],
  ])('rejects %s', (_label, mutate) => {
    const value = fixture();
    mutate(value);
    expect(() => validateAppTutorialCityDesignFixtureDocument(value)).toThrow('attribution');
  });

  it.each([
    ['non-string timestamp', (value: any) => (value.capturedAt = 4)],
    ['invalid timestamp', (value: any) => (value.capturedAt = 'not-a-date')],
  ])('rejects an %s', (_label, mutate) => {
    const value = fixture();
    mutate(value);
    expect(() => validateAppTutorialCityDesignFixtureDocument(value)).toThrow('capture timestamp');
  });

  it.each([
    ['missing address', (value: any) => (value.address = null)],
    ['label', (value: any) => (value.address.label = 'Other')],
    ['OSM type', (value: any) => (value.address.osmType = 'way')],
    ['OSM id', (value: any) => (value.address.osmId = 1)],
    ['position record', (value: any) => (value.address.position = null)],
    ['latitude type', (value: any) => (value.address.position.lat = '48')],
    ['longitude type', (value: any) => (value.address.position.lon = '11')],
    ['latitude', (value: any) => (value.address.position.lat += 1)],
    ['longitude', (value: any) => (value.address.position.lon += 1)],
  ])('rejects an address with a mismatched %s', (_label, mutate) => {
    const value = fixture();
    mutate(value);
    expect(() => validateAppTutorialCityDesignFixtureDocument(value)).toThrow(
      'does not describe Euckenstraße 38'
    );
  });

  it.each([
    ['missing selection', (value: any) => (value.mapSelection = null)],
    ['center', (value: any) => (value.mapSelection.center.lat += 1)],
    ['width', (value: any) => (value.mapSelection.widthMeters += 1)],
    ['height', (value: any) => (value.mapSelection.heightMeters += 1)],
    ['rotation', (value: any) => (value.mapSelection.rotationDeg = 1)],
  ])('rejects an unexpected map %s', (_label, mutate) => {
    const value = fixture();
    mutate(value);
    expect(() => validateAppTutorialCityDesignFixtureDocument(value)).toThrow('map selection');
  });

  it.each([
    ['missing snapshot', (value: any) => (value.snapshot = null)],
    ['fetch time', (value: any) => (value.snapshot.fetchedAt = 'now')],
    ['bounding-box record', (value: any) => (value.snapshot.bbox = null)],
    ['feature array', (value: any) => (value.snapshot.features = null)],
    ['empty features', (value: any) => (value.snapshot.features = [])],
    ['legacy ways', (value: any) => (value.snapshot.ways = [])],
  ])('rejects an invalid snapshot %s', (_label, mutate) => {
    const value = fixture();
    mutate(value);
    expect(() => validateAppTutorialCityDesignFixtureDocument(value)).toThrow('feature snapshot');
  });

  it('rejects bounding-box, feature, provenance, road, and geometry corruption', () => {
    const wrongBbox = fixture();
    wrongBbox.snapshot.bbox.south += 0.01;
    expect(() => validateAppTutorialCityDesignFixtureDocument(wrongBbox)).toThrow('bounding box');

    const invalidFeature = fixture();
    invalidFeature.snapshot.features.push({ invalid: true });
    expect(() => validateAppTutorialCityDesignFixtureDocument(invalidFeature)).toThrow(
      'invalid features'
    );

    const synthetic = fixture();
    synthetic.snapshot.features[0].source = 'fallback';
    expect(() => validateAppTutorialCityDesignFixtureDocument(synthetic)).toThrow(
      'synthetic features'
    );

    const missingRoad = fixture();
    for (const feature of missingRoad.snapshot.features) {
      feature.tags = { ...feature.tags, name: 'Other' };
      feature.label = 'Other';
    }
    const namelessRoad = missingRoad.snapshot.features.find(
      (feature: any) => feature.kind === 'road'
    );
    delete namelessRoad.tags.name;
    delete namelessRoad.label;
    expect(() => validateAppTutorialCityDesignFixtureDocument(missingRoad)).toThrow(
      'does not contain Euckenstraße'
    );

    const outside = fixture();
    outside.snapshot.features[0].points = [
      { lat: 0, lon: 0 },
      { lat: 0, lon: 1 },
    ];
    expect(() => validateAppTutorialCityDesignFixtureDocument(outside)).toThrow(
      'geometry outside its capture area'
    );
  });

  it('returns a normalized independent fixture document', () => {
    const value = fixture();
    const result = validateAppTutorialCityDesignFixtureDocument(value);
    expect(result).not.toBe(value);
    expect(result.snapshot.features).toHaveLength(value.snapshot.features.length);
  });

  it('accepts the road label when the OSM name tag is absent', () => {
    const value = fixture();
    const road = value.snapshot.features.find(
      (feature: any) => feature.kind === 'road' && feature.tags?.name === 'Euckenstraße'
    );
    delete road.tags.name;
    road.label = 'Euckenstraße';

    expect(validateAppTutorialCityDesignFixtureDocument(value).snapshot.features).toHaveLength(
      value.snapshot.features.length
    );
  });

  it('accepts a polygon that encloses the complete capture area', () => {
    const value = fixture();
    const { east, north, south, west } = value.snapshot.bbox;
    const polygon = value.snapshot.features.find(
      (feature: any) => feature.geometryKind === 'polygon'
    );
    polygon.points = [
      { lat: south - 0.001, lon: west - 0.001 },
      { lat: south - 0.001, lon: east + 0.001 },
      { lat: north + 0.001, lon: east + 0.001 },
      { lat: north + 0.001, lon: west - 0.001 },
      { lat: south - 0.001, lon: west - 0.001 },
    ];

    expect(validateAppTutorialCityDesignFixtureDocument(value).snapshot.features).toHaveLength(
      value.snapshot.features.length
    );
  });
});
