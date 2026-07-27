import { describe, expect, it, vi } from 'vitest';
import type {
  CityDesignOsmFeature,
  CityDesignOsmSnapshot,
} from '@/features/amendments/city-design/types';
import {
  APP_TUTORIAL_CITY_DESIGN_BBOX,
  APP_TUTORIAL_CITY_DESIGN_CENTER,
  APP_TUTORIAL_CITY_DESIGN_OSM_NODE_ID,
} from '../city-design-fixture-document';
import {
  captureEuckenstrasseTutorialFixture,
  serializeEuckenstrasseTutorialFixture,
} from '../../../../tools/osm/capture-euckenstrasse-tutorial-fixture';

const euckenstrasseFeature: CityDesignOsmFeature = {
  id: '4393138',
  kind: 'road',
  geometryKind: 'line',
  label: 'Euckenstraße',
  points: [
    { lat: APP_TUTORIAL_CITY_DESIGN_CENTER.lat - 0.0001, lon: 11.5324 },
    { lat: APP_TUTORIAL_CITY_DESIGN_CENTER.lat + 0.0001, lon: 11.5326 },
  ],
  source: 'osm',
  tags: {
    highway: 'residential',
    name: 'Euckenstraße',
  },
};

function createSnapshot(features: CityDesignOsmFeature[]): CityDesignOsmSnapshot {
  return {
    fetchedAt: Date.UTC(2026, 6, 26),
    bbox: APP_TUTORIAL_CITY_DESIGN_BBOX,
    features,
  };
}

function createNominatimResponse(overrides: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify([
      {
        osm_type: 'node',
        osm_id: APP_TUTORIAL_CITY_DESIGN_OSM_NODE_ID,
        lat: String(APP_TUTORIAL_CITY_DESIGN_CENTER.lat),
        lon: String(APP_TUTORIAL_CITY_DESIGN_CENTER.lon),
        address: {
          house_number: '38',
          road: 'Euckenstraße',
          city: 'München',
        },
        ...overrides,
      },
    ]),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

describe('Euckenstrasse tutorial fixture capture', () => {
  it('captures a verified live OSM snapshot', async () => {
    const document = await captureEuckenstrasseTutorialFixture({
      fetchImpl: vi.fn().mockResolvedValue(createNominatimResponse()),
      fetchSnapshot: vi.fn().mockResolvedValue(createSnapshot([euckenstrasseFeature])),
    });

    expect(document.address).toMatchObject({
      osmType: 'node',
      osmId: APP_TUTORIAL_CITY_DESIGN_OSM_NODE_ID,
      position: APP_TUTORIAL_CITY_DESIGN_CENTER,
    });
    expect(document.snapshot.features).toHaveLength(1);
    expect(document.snapshot.ways).toBeUndefined();
  });

  it('rejects Nominatim network errors and unexpected addresses', async () => {
    await expect(
      captureEuckenstrasseTutorialFixture({
        fetchImpl: vi.fn().mockRejectedValue(new TypeError('network unavailable')),
      })
    ).rejects.toThrow('network unavailable');

    await expect(
      captureEuckenstrasseTutorialFixture({
        fetchImpl: vi.fn().mockResolvedValue(createNominatimResponse({ osm_id: 123 })),
      })
    ).rejects.toThrow('did not verify Euckenstraße 38');
  });

  it('rejects Overpass network errors', async () => {
    await expect(
      captureEuckenstrasseTutorialFixture({
        fetchImpl: vi.fn().mockResolvedValue(createNominatimResponse()),
        fetchSnapshot: vi.fn().mockRejectedValue(new TypeError('Overpass failed')),
      })
    ).rejects.toThrow('Overpass failed');
  });

  it('rejects synthetic fallbacks and snapshots without Euckenstrasse', async () => {
    await expect(
      captureEuckenstrasseTutorialFixture({
        fetchImpl: vi.fn().mockResolvedValue(createNominatimResponse()),
        fetchSnapshot: vi.fn().mockResolvedValue(
          createSnapshot([
            {
              ...euckenstrasseFeature,
              id: 'fallback-road',
              source: 'fallback',
            },
          ])
        ),
      })
    ).rejects.toThrow('synthetic features');

    await expect(
      captureEuckenstrasseTutorialFixture({
        fetchImpl: vi.fn().mockResolvedValue(createNominatimResponse()),
        fetchSnapshot: vi.fn().mockResolvedValue(
          createSnapshot([
            {
              ...euckenstrasseFeature,
              id: 'other-road',
              label: 'Andere Straße',
              tags: { highway: 'residential', name: 'Andere Straße' },
            },
          ])
        ),
      })
    ).rejects.toThrow('does not contain Euckenstraße');
  });

  it('serializes the same capture deterministically', async () => {
    const document = await captureEuckenstrasseTutorialFixture({
      fetchImpl: vi.fn().mockResolvedValue(createNominatimResponse()),
      fetchSnapshot: vi.fn().mockResolvedValue(createSnapshot([euckenstrasseFeature])),
    });

    expect(serializeEuckenstrasseTutorialFixture(document)).toBe(
      serializeEuckenstrasseTutorialFixture(structuredClone(document))
    );
  });
});
