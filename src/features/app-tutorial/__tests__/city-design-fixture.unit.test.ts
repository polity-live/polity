import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  APP_TUTORIAL_CITY_DESIGN_BBOX,
  APP_TUTORIAL_CITY_DESIGN_CENTER,
  APP_TUTORIAL_CITY_DESIGN_FIXTURE_METADATA,
  APP_TUTORIAL_CITY_DESIGN_MAP_SELECTION,
  APP_TUTORIAL_CITY_DESIGN_OSM_NODE_ID,
  createAppTutorialOsmSnapshot,
  createAppTutorialInitialCityDesignState,
  isAppTutorialCityDesignAddress,
} from '../city-design-fixture';
import { getCityDesignOsmFeaturePoints } from '@/features/amendments/city-design/logic/cityDesignOsm';
import { projectGeoPointToLocal } from '@/features/amendments/city-design/logic/cityDesignProjection';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('app tutorial City Design fixture', () => {
  const center = { lat: 48.1351, lon: 11.582 };

  it('starts without a loaded snapshot but with Munich search context', () => {
    const design = createAppTutorialInitialCityDesignState(center);

    expect(design.schemaVersion).toBe(1);
    expect(design.osmSnapshot).toBeNull();
    expect(design.selectionAddress).toMatchObject({
      city: 'München',
    });
    expect(design.selectionAddress?.street).toBeUndefined();
    expect(design.selectionAddress?.houseNumber).toBeUndefined();
    expect(design.objects).toEqual([]);
  });

  it('uses the canonical Euckenstrasse map selection by default', () => {
    const design = createAppTutorialInitialCityDesignState();

    expect(design.origin).toMatchObject(APP_TUTORIAL_CITY_DESIGN_CENTER);
    expect(design.mapSelection).toEqual(APP_TUTORIAL_CITY_DESIGN_MAP_SELECTION);
  });

  it('loads the captured Euckenstrasse snapshot without a network request', () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const snapshot = createAppTutorialOsmSnapshot();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(snapshot.bbox).toEqual(APP_TUTORIAL_CITY_DESIGN_BBOX);
    expect(snapshot.features?.length).toBeGreaterThan(100);
    expect(snapshot.ways).toBeUndefined();
    expect(
      snapshot.features?.some(
        feature =>
          feature.id === '4393138' &&
          feature.kind === 'road' &&
          feature.tags?.name === 'Euckenstraße'
      )
    ).toBe(true);
  });

  it('contains only real or deterministically derived OSM features', () => {
    const snapshot = createAppTutorialOsmSnapshot();

    expect(
      snapshot.features?.every(feature => feature.source === 'osm' || feature.source === 'derived')
    ).toBe(true);
    expect(
      snapshot.features?.some(
        feature => feature.source === 'sample' || feature.source === 'fallback'
      )
    ).toBe(false);
  });

  it('records the canonical OSM address and attribution', () => {
    expect(APP_TUTORIAL_CITY_DESIGN_FIXTURE_METADATA).toMatchObject({
      schemaVersion: 1,
      attribution: expect.stringContaining('OpenStreetMap'),
      copyrightUrl: 'https://www.openstreetmap.org/copyright',
      address: {
        osmType: 'node',
        osmId: APP_TUTORIAL_CITY_DESIGN_OSM_NODE_ID,
        position: APP_TUTORIAL_CITY_DESIGN_CENTER,
      },
    });
  });

  it('projects the captured geometry around the canonical tutorial origin', () => {
    const snapshot = createAppTutorialOsmSnapshot();
    const euckenstrasse = snapshot.features?.find(
      feature => feature.id === '4393138' && feature.kind === 'road'
    );
    expect(euckenstrasse).toBeDefined();
    if (!euckenstrasse) throw new Error('Expected the captured Euckenstraße feature.');

    const projectedPoints = getCityDesignOsmFeaturePoints(euckenstrasse).map(point =>
      projectGeoPointToLocal(point, APP_TUTORIAL_CITY_DESIGN_CENTER)
    );

    expect(projectedPoints.length).toBeGreaterThan(1);
    projectedPoints.forEach(point => {
      expect(Number.isFinite(point.x)).toBe(true);
      expect(Number.isFinite(point.z)).toBe(true);
    });
    expect(projectedPoints.some(point => Math.abs(point.x) < 180)).toBe(true);
    expect(projectedPoints.some(point => Math.abs(point.z) < 140)).toBe(true);
  });

  it('returns an independent snapshot on each load', () => {
    const first = createAppTutorialOsmSnapshot();
    const second = createAppTutorialOsmSnapshot();
    const firstFeature = first.features?.[0];
    const secondFeature = second.features?.[0];
    if (!firstFeature || !secondFeature) throw new Error('Expected captured OSM features.');

    firstFeature.label = 'mutated';
    expect(secondFeature.label).not.toBe('mutated');
  });

  it('recognizes the required address with tolerant German spelling', () => {
    expect(
      isAppTutorialCityDesignAddress({
        street: ' Euckenstrasse ',
        houseNumber: '38',
      })
    ).toBe(true);
    expect(
      isAppTutorialCityDesignAddress({
        street: 'Euckenstraße',
        houseNumber: '39',
      })
    ).toBe(false);
    expect(isAppTutorialCityDesignAddress(undefined)).toBe(false);
  });
});
