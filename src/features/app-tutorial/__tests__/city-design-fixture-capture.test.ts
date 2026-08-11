import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type {
  CityDesignOsmFeature,
  CityDesignOsmSnapshot,
} from '@/features/amendments/city-design/types';
import {
  APP_TUTORIAL_CITY_DESIGN_BBOX,
  APP_TUTORIAL_CITY_DESIGN_CENTER,
  APP_TUTORIAL_CITY_DESIGN_OSM_NODE_ID,
  type AppTutorialCityDesignFixtureDocument,
} from '../city-design-fixture-document';
import {
  captureEuckenstrasseTutorialFixture,
  runCaptureEuckenstrasseFixtureCli,
  serializeEuckenstrasseTutorialFixture,
} from '../../../../tools/osm/capture-euckenstrasse-tutorial-fixture';

const toolMocks = vi.hoisted(() => ({
  fetchSnapshot: vi.fn(),
}));
const temporaryRoots: string[] = [];

vi.mock('@/server/overpass-street-scene', () => ({
  fetchOverpassSnapshot: toolMocks.fetchSnapshot,
}));

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

beforeEach(() => {
  toolMocks.fetchSnapshot.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

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

  it('uses the default global address transport and Overpass capture boundary', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(createNominatimResponse());
    vi.stubGlobal('fetch', fetchImpl);
    toolMocks.fetchSnapshot.mockResolvedValue(createSnapshot([euckenstrasseFeature]));

    await expect(captureEuckenstrasseTutorialFixture()).resolves.toMatchObject({
      snapshot: { features: [expect.objectContaining({ id: euckenstrasseFeature.id })] },
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(toolMocks.fetchSnapshot).toHaveBeenCalledWith(APP_TUTORIAL_CITY_DESIGN_BBOX);
  });

  it('rejects unsuccessful and structurally invalid Nominatim responses', async () => {
    await expect(
      captureEuckenstrasseTutorialFixture({
        fetchImpl: vi.fn().mockResolvedValue(new Response('rate limited', { status: 429 })),
      })
    ).rejects.toThrow('Nominatim request failed with HTTP 429');

    await expect(
      captureEuckenstrasseTutorialFixture({
        fetchImpl: vi.fn().mockResolvedValue(new Response(JSON.stringify({ result: [] }))),
      })
    ).rejects.toThrow('Nominatim returned an invalid response');
  });

  it.each([
    ['osm type', { osm_type: 'way' }],
    ['latitude', { lat: '0' }],
    ['longitude', { lon: '0' }],
    ['house number', { address: { house_number: '39', road: 'Euckenstraße', city: 'München' } }],
    ['missing road', { address: { house_number: '38', city: 'München' } }],
    ['wrong road', { address: { house_number: '38', road: 'Other', city: 'München' } }],
    ['missing city', { address: { house_number: '38', road: 'Euckenstraße' } }],
    ['wrong city', { address: { house_number: '38', road: 'Euckenstraße', city: 'Berlin' } }],
  ])('rejects a Nominatim candidate with a mismatched %s', async (_label, overrides) => {
    await expect(
      captureEuckenstrasseTutorialFixture({
        fetchImpl: vi.fn().mockResolvedValue(createNominatimResponse(overrides)),
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

    const reversed = {
      ...document,
      snapshot: {
        ...document.snapshot,
        features: [
          { ...euckenstrasseFeature, id: 'road-10' },
          { ...euckenstrasseFeature, id: 'road-2' },
        ],
      },
    };
    expect(serializeEuckenstrasseTutorialFixture(reversed).indexOf('road-2')).toBeLessThan(
      serializeEuckenstrasseTutorialFixture(reversed).indexOf('road-10')
    );

    const withoutFeatures = {
      ...document,
      snapshot: { ...document.snapshot, features: undefined },
    } as unknown as AppTutorialCityDesignFixtureDocument;
    expect(
      JSON.parse(serializeEuckenstrasseTutorialFixture(withoutFeatures)).snapshot.features
    ).toEqual([]);
  });

  it('runs the capture CLI through injectable filesystem and logger boundaries', async () => {
    const document = {
      ...(await captureEuckenstrasseTutorialFixture({
        fetchImpl: vi.fn().mockResolvedValue(createNominatimResponse()),
        fetchSnapshot: vi.fn().mockResolvedValue(createSnapshot([euckenstrasseFeature])),
      })),
    };
    const write = vi.fn().mockResolvedValue(undefined);
    const logger = { info: vi.fn() };

    await expect(
      runCaptureEuckenstrasseFixtureCli({
        capture: vi.fn().mockResolvedValue(document),
        write,
        outputPath: 'fixture.json',
        logger,
      })
    ).resolves.toBe(document);
    expect(write).toHaveBeenCalledWith(
      'fixture.json',
      serializeEuckenstrasseTutorialFixture(document),
      'utf8'
    );
    expect(logger.info).toHaveBeenCalledWith('Captured 1 OSM features in fixture.json');

    await runCaptureEuckenstrasseFixtureCli({
      capture: vi.fn().mockResolvedValue({
        ...document,
        snapshot: { ...document.snapshot, features: undefined },
      }),
      write,
      outputPath: 'empty.json',
      logger,
    });
    expect(logger.info).toHaveBeenLastCalledWith('Captured 0 OSM features in empty.json');

    const defaultCaptureFetch = vi.fn().mockResolvedValue(createNominatimResponse());
    vi.stubGlobal('fetch', defaultCaptureFetch);
    toolMocks.fetchSnapshot.mockResolvedValue(createSnapshot([euckenstrasseFeature]));
    await runCaptureEuckenstrasseFixtureCli({
      write,
      outputPath: 'default-capture.json',
      logger,
    });
    expect(defaultCaptureFetch).toHaveBeenCalledOnce();

    const root = mkdtempSync(join(tmpdir(), 'polity-osm-cli-'));
    temporaryRoots.push(root);
    const target = join(root, 'fixture.json');
    await runCaptureEuckenstrasseFixtureCli({
      capture: vi.fn().mockResolvedValue(document),
      outputPath: target,
      logger,
    });
    expect(readFileSync(target, 'utf8')).toBe(serializeEuckenstrasseTutorialFixture(document));

    await runCaptureEuckenstrasseFixtureCli({
      capture: vi.fn().mockResolvedValue(document),
      write,
      logger,
    });
    expect(write.mock.calls.at(-1)?.[0]).toMatch(/euckenstrasse-38-osm\.json$/);

    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    await runCaptureEuckenstrasseFixtureCli({
      capture: vi.fn().mockResolvedValue(document),
      write,
      outputPath: 'default-logger.json',
    });
    expect(info).toHaveBeenCalledWith('Captured 1 OSM features in default-logger.json');
  });
});
