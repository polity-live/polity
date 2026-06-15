import { describe, expect, it } from 'vitest';

import { mapSearchDocumentToSpatialItem, resolveSpatialLocation } from '../searchSpatial';
import type { SearchDocument } from '../../types/search-document.types';

describe('searchSpatial', () => {
  it('prefers an entity location over group and owner fallbacks', () => {
    expect(
      resolveSpatialLocation({
        own: { latitude: 52.52, longitude: 13.405, label: 'Berlin', source: 'event' },
        group: { latitude: 48.137, longitude: 11.575, label: 'Munich' },
        owner: { latitude: 50.11, longitude: 8.68, label: 'Frankfurt' },
      })
    ).toMatchObject({
      coordinates: { latitude: 52.52, longitude: 13.405 },
      label: 'Berlin',
      source: 'event',
    });
  });

  it('uses the group fallback when the entity has no coordinates', () => {
    expect(
      resolveSpatialLocation({
        own: { latitude: null, longitude: null, label: 'No coordinates' },
        group: { latitude: 48.137, longitude: 11.575, label: 'Munich' },
        owner: { latitude: 50.11, longitude: 8.68, label: 'Frankfurt' },
      })
    ).toMatchObject({
      coordinates: { latitude: 48.137, longitude: 11.575 },
      label: 'Munich',
      source: 'group',
    });
  });

  it('uses the owner fallback when entity and group locations are missing', () => {
    expect(
      resolveSpatialLocation({
        group: { latitude: null, longitude: null, label: 'No coordinates' },
        owner: { latitude: '50.11', longitude: '8.68', label: 'Frankfurt' },
      })
    ).toMatchObject({
      coordinates: { latitude: 50.11, longitude: 8.68 },
      label: 'Frankfurt',
      source: 'owner',
    });
  });

  it('returns null when no candidate has complete coordinates', () => {
    expect(
      resolveSpatialLocation({
        own: { latitude: 52.52, longitude: null },
        group: { latitude: null, longitude: 11.575 },
        owner: null,
      })
    ).toBeNull();
  });

  it('maps projected search document coordinates into spatial items', () => {
    const document = {
      id: 'event:event-1',
      entity_id: 'event-1',
      entity_type: 'event',
      title: 'Assembly',
      subtitle: null,
      summary: null,
      search_text: 'Assembly',
      visibility: 'public',
      owner_user_id: 'user-1',
      group_id: 'group-1',
      image_url: null,
      location_latitude: 52.52,
      location_longitude: 13.405,
      location_label: 'Berlin',
      location_source: 'event',
      card_payload: { type: 'event' },
      created_at: Date.now(),
      updated_at: Date.now(),
      engagement_score: 0,
      trending_score: 0,
      topics: [],
      group: null,
    } as SearchDocument;

    expect(mapSearchDocumentToSpatialItem(document)).toMatchObject({
      id: 'event:event-1',
      type: 'event',
      title: 'Assembly',
      locationLabel: 'Berlin',
      locationSource: 'event',
      coordinates: { latitude: 52.52, longitude: 13.405 },
    });
  });
});
