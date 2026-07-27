import type {
  CityDesignGeoPoint,
  CityDesignOsmSnapshot,
  CityDesignSelectionAddress,
  CityDesignStateV1,
} from '@/features/amendments/city-design/types';
import { normalizeCityDesignOsmSnapshot } from '@/features/amendments/city-design/logic/cityDesignOsm';
import fixtureJson from './fixtures/euckenstrasse-38-osm.json';
import {
  APP_TUTORIAL_CITY_DESIGN_BBOX,
  APP_TUTORIAL_CITY_DESIGN_CENTER,
  APP_TUTORIAL_CITY_DESIGN_MAP_SELECTION,
  APP_TUTORIAL_CITY_DESIGN_OSM_NODE_ID,
  validateAppTutorialCityDesignFixtureDocument,
} from './city-design-fixture-document';

export {
  APP_TUTORIAL_CITY_DESIGN_BBOX,
  APP_TUTORIAL_CITY_DESIGN_CENTER,
  APP_TUTORIAL_CITY_DESIGN_MAP_SELECTION,
  APP_TUTORIAL_CITY_DESIGN_OSM_NODE_ID,
};

export const APP_TUTORIAL_CITY_DESIGN_ADDRESS = {
  country: 'Deutschland',
  region: 'Bayern',
  city: 'München',
  postCode: '81369',
  street: 'Euckenstraße',
  houseNumber: '38',
  formatted: 'Euckenstraße 38, München',
} as const satisfies CityDesignSelectionAddress;

const APP_TUTORIAL_CITY_DESIGN_FIXTURE = validateAppTutorialCityDesignFixtureDocument(fixtureJson);

export const APP_TUTORIAL_CITY_DESIGN_FIXTURE_METADATA = {
  schemaVersion: APP_TUTORIAL_CITY_DESIGN_FIXTURE.schemaVersion,
  attribution: APP_TUTORIAL_CITY_DESIGN_FIXTURE.attribution,
  copyrightUrl: APP_TUTORIAL_CITY_DESIGN_FIXTURE.copyrightUrl,
  capturedAt: APP_TUTORIAL_CITY_DESIGN_FIXTURE.capturedAt,
  address: APP_TUTORIAL_CITY_DESIGN_FIXTURE.address,
} as const;

export function createAppTutorialOsmSnapshot(): CityDesignOsmSnapshot {
  const snapshot = normalizeCityDesignOsmSnapshot(
    structuredClone(APP_TUTORIAL_CITY_DESIGN_FIXTURE.snapshot)
  );

  if (!snapshot) throw new Error('The app tutorial OSM fixture is invalid.');
  return snapshot;
}

function normalizeAddressPart(value: string | undefined) {
  return (value ?? '')
    .trim()
    .toLocaleLowerCase('de')
    .replaceAll('ß', 'ss')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ');
}

export function isAppTutorialCityDesignAddress(
  address: CityDesignSelectionAddress | null | undefined
) {
  return (
    normalizeAddressPart(address?.street) === 'euckenstrasse' &&
    normalizeAddressPart(address?.houseNumber) === '38'
  );
}

export function createAppTutorialInitialCityDesignState(
  center: CityDesignGeoPoint = APP_TUTORIAL_CITY_DESIGN_CENTER
): CityDesignStateV1 {
  return {
    schemaVersion: 1,
    origin: { ...center, label: APP_TUTORIAL_CITY_DESIGN_ADDRESS.formatted },
    mapSelection: {
      center: { ...center },
      widthMeters: APP_TUTORIAL_CITY_DESIGN_MAP_SELECTION.widthMeters,
      heightMeters: APP_TUTORIAL_CITY_DESIGN_MAP_SELECTION.heightMeters,
      rotationDeg: APP_TUTORIAL_CITY_DESIGN_MAP_SELECTION.rotationDeg,
    },
    selectionAddress: {
      country: APP_TUTORIAL_CITY_DESIGN_ADDRESS.country,
      region: APP_TUTORIAL_CITY_DESIGN_ADDRESS.region,
      city: APP_TUTORIAL_CITY_DESIGN_ADDRESS.city,
    },
    osmSnapshot: null,
    hiddenOsmWayIds: [],
    hiddenOsmFeatureIds: [],
    showStreetMarkings: true,
    comparisonMode: 'overlay',
    currency: 'EUR',
    costCatalogVersion: 'tutorial-v1',
    objects: [],
  };
}
