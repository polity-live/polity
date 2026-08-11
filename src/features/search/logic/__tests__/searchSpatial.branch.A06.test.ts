import { describe, expect, it } from 'vitest';

import type { SearchDocument } from '../../types/search-document.types';
import {
  getSearchSpatialType,
  mapSearchDocumentToSpatialItem,
  resolveSearchDocumentSpatialLocation,
  resolveSpatialLocation,
} from '../searchSpatial';

function document(overrides: Partial<SearchDocument> = {}): SearchDocument {
  return {
    id: 'result-1',
    entity_id: 'entity-1',
    entity_type: 'event',
    title: 'Result',
    location_latitude: null,
    location_longitude: null,
    location_label: null,
    location_source: null,
    card_payload: null,
    ...overrides,
  } as SearchDocument;
}

describe('search spatial branch matrix', () => {
  it('normalizes blank labels and sources and rejects non-finite coordinates', () => {
    expect(
      resolveSpatialLocation({
        own: { latitude: '52.5', longitude: '13.4', label: ' ', source: '' },
      })
    ).toEqual({
      coordinates: { latitude: 52.5, longitude: 13.4 },
      label: null,
      source: 'own',
    });

    expect(
      resolveSpatialLocation({ own: { latitude: 'not-a-number', longitude: '13.4' } })
    ).toBeNull();
    expect(
      resolveSpatialLocation({ own: { latitude: Number.POSITIVE_INFINITY, longitude: 1 } })
    ).toBeNull();
    expect(resolveSpatialLocation({ own: { latitude: '', longitude: 1 } })).toBeNull();
  });

  it('supplies document location fallbacks and keeps explicit document values', () => {
    expect(
      resolveSearchDocumentSpatialLocation(
        document({ location_latitude: 1, location_longitude: 2 })
      )
    ).toEqual({
      coordinates: { latitude: 1, longitude: 2 },
      label: null,
      source: 'document',
    });
    expect(
      resolveSearchDocumentSpatialLocation(
        document({
          location_latitude: 1,
          location_longitude: 2,
          location_label: 'Label',
          location_source: 'event',
        })
      )
    ).toMatchObject({ label: 'Label', source: 'event' });
  });

  it.each([
    [{ type: ' group ' }, 'group'],
    [{ entity_type: 'statement' }, 'statement'],
    [null, 'event'],
    [[], 'event'],
    [null, 'result'],
  ])('derives spatial type from the available payload', (cardPayload, expected) => {
    const entityType = expected === 'result' ? '' : 'event';
    expect(
      getSearchSpatialType(document({ card_payload: cardPayload, entity_type: entityType }))
    ).toBe(expected);
  });

  it('returns null without coordinates and supplies a fallback title', () => {
    expect(mapSearchDocumentToSpatialItem(document())).toBeNull();

    const item = mapSearchDocumentToSpatialItem(
      document({ title: '', location_latitude: 1, location_longitude: 2 })
    );
    expect(item).toMatchObject({ type: 'event', coordinates: { latitude: 1, longitude: 2 } });
    expect(item?.title).toBeTruthy();
  });
});
