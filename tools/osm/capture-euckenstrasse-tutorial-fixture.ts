import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { CityDesignOsmSnapshot } from '../../src/features/amendments/city-design/types';
import {
  APP_TUTORIAL_CITY_DESIGN_BBOX,
  APP_TUTORIAL_CITY_DESIGN_CENTER,
  APP_TUTORIAL_CITY_DESIGN_MAP_SELECTION,
  APP_TUTORIAL_CITY_DESIGN_OSM_NODE_ID,
  type AppTutorialCityDesignFixtureDocument,
  validateAppTutorialCityDesignFixtureDocument,
} from '../../src/features/app-tutorial/city-design-fixture-document';
import { fetchOverpassSnapshot } from '../../src/server/overpass-street-scene';

const ADDRESS_LABEL = 'Euckenstraße 38, München';
const NOMINATIM_SEARCH_URL = new URL('https://nominatim.openstreetmap.org/search');
NOMINATIM_SEARCH_URL.search = new URLSearchParams({
  format: 'jsonv2',
  addressdetails: '1',
  limit: '5',
  q: ADDRESS_LABEL,
}).toString();

const DEFAULT_OUTPUT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../src/features/app-tutorial/fixtures/euckenstrasse-38-osm.json'
);

interface NominatimResult {
  osm_type?: string;
  osm_id?: number;
  lat?: string;
  lon?: string;
  address?: {
    house_number?: string;
    road?: string;
    city?: string;
  };
}

export interface CaptureEuckenstrasseFixtureDependencies {
  fetchImpl?: typeof fetch;
  fetchSnapshot?: (bbox: typeof APP_TUTORIAL_CITY_DESIGN_BBOX) => Promise<CityDesignOsmSnapshot>;
}

function normalizeGermanText(value: string | undefined) {
  return (value ?? '')
    .trim()
    .toLocaleLowerCase('de')
    .replaceAll('ß', 'ss')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function verifyNominatimResult(value: unknown) {
  if (!Array.isArray(value)) {
    throw new Error('Nominatim returned an invalid response.');
  }

  const match = (value as NominatimResult[]).find(
    result =>
      result.osm_type === 'node' &&
      result.osm_id === APP_TUTORIAL_CITY_DESIGN_OSM_NODE_ID &&
      Number(result.lat) === APP_TUTORIAL_CITY_DESIGN_CENTER.lat &&
      Number(result.lon) === APP_TUTORIAL_CITY_DESIGN_CENTER.lon &&
      result.address?.house_number === '38' &&
      normalizeGermanText(result.address.road) === 'euckenstrasse' &&
      normalizeGermanText(result.address.city) === 'munchen'
  );

  if (!match) {
    throw new Error('Nominatim did not verify Euckenstraße 38, München.');
  }
}

export async function captureEuckenstrasseTutorialFixture(
  dependencies: CaptureEuckenstrasseFixtureDependencies = {}
): Promise<AppTutorialCityDesignFixtureDocument> {
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const addressResponse = await fetchImpl(NOMINATIM_SEARCH_URL, {
    headers: { 'User-Agent': 'polity-tutorial-fixture-capture/1.0' },
  });
  if (!addressResponse.ok) {
    throw new Error(`Nominatim request failed with HTTP ${addressResponse.status}.`);
  }
  verifyNominatimResult(await addressResponse.json());

  const fetchSnapshot = dependencies.fetchSnapshot ?? fetchOverpassSnapshot;
  const snapshot = await fetchSnapshot(APP_TUTORIAL_CITY_DESIGN_BBOX);
  const capturedAt = new Date(snapshot.fetchedAt).toISOString();

  return validateAppTutorialCityDesignFixtureDocument({
    schemaVersion: 1,
    attribution: '© OpenStreetMap contributors, ODbL 1.0',
    copyrightUrl: 'https://www.openstreetmap.org/copyright',
    capturedAt,
    address: {
      label: ADDRESS_LABEL,
      osmType: 'node',
      osmId: APP_TUTORIAL_CITY_DESIGN_OSM_NODE_ID,
      position: APP_TUTORIAL_CITY_DESIGN_CENTER,
    },
    mapSelection: APP_TUTORIAL_CITY_DESIGN_MAP_SELECTION,
    snapshot,
  });
}

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObjectKeys);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nestedValue]) => [key, sortObjectKeys(nestedValue)])
  );
}

export function serializeEuckenstrasseTutorialFixture(
  document: AppTutorialCityDesignFixtureDocument
) {
  const sortedFeatures = [...(document.snapshot.features ?? [])].sort((left, right) =>
    left.id.localeCompare(right.id, 'en', { numeric: true })
  );
  return `${JSON.stringify(
    sortObjectKeys({
      ...document,
      snapshot: {
        ...document.snapshot,
        features: sortedFeatures,
      },
    }),
    null,
    2
  )}\n`;
}

async function main() {
  const document = await captureEuckenstrasseTutorialFixture();
  await writeFile(DEFAULT_OUTPUT_PATH, serializeEuckenstrasseTutorialFixture(document), 'utf8');
  console.info(
    `Captured ${document.snapshot.features?.length ?? 0} OSM features in ${DEFAULT_OUTPUT_PATH}`
  );
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  await main();
}
