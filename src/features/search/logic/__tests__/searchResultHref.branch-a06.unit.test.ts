import { describe, expect, it } from 'vitest';

import type { SearchDocument } from '../../types/search-document.types';
import type { SearchContentItem } from '../../types/search.types';
import {
  getAgendaItemHref,
  getEntityHref,
  getSearchContentItemHref,
  getSearchDocumentEntityHref,
  getSearchDocumentHref,
  getSearchResultPermalink,
  normalizeSearchMediaSourceType,
} from '../searchResultHref';

function document(overrides: Partial<SearchDocument> = {}): SearchDocument {
  return {
    id: 'result/a b',
    entity_id: 'entity-1',
    entity_type: 'group',
    title: 'Result',
    subtitle: null,
    summary: null,
    search_text: 'Result',
    visibility: 'public',
    tutorial_run_id: null,
    owner_user_id: 'owner-1',
    group_id: 'group-1',
    image_url: null,
    location_latitude: null,
    location_longitude: null,
    location_label: null,
    location_source: null,
    location_kind: null,
    location_place_id: null,
    location_boundary_source: null,
    location_geometry: null,
    location_bounds: null,
    card_payload: null,
    created_at: 1,
    updated_at: 1,
    engagement_score: 0,
    trending_score: 0,
    ...overrides,
  } as SearchDocument;
}

function contentItem(
  overrides: Partial<SearchContentItem> & Pick<SearchContentItem, 'id' | 'type'>
): SearchContentItem {
  return {
    title: 'Result',
    createdAt: new Date(0),
    ...overrides,
  } as SearchContentItem;
}

describe('search result href branch matrix', () => {
  it.each([
    ['amendment', 'amendment'],
    [' blog ', 'blog'],
    ['event', 'event'],
    ['group', 'group'],
    ['statement', 'statement'],
    ['user', 'user'],
    ['', undefined],
    ['dataset', undefined],
    [42, undefined],
  ])('normalizes media source %p to %p', (input, expected) => {
    expect(normalizeSearchMediaSourceType(input)).toBe(expected);
  });

  it('builds encoded search permalinks and both agenda destinations', () => {
    expect(getSearchResultPermalink(document())).toBe('/search?result=result%2Fa%20b');
    expect(getAgendaItemHref()).toBeUndefined();
    expect(getAgendaItemHref('event-1')).toBe('/event/event-1/agenda');
    expect(getAgendaItemHref('event-1', 'item-1')).toBe('/event/event-1/agenda/item-1');
  });

  it.each([
    ['amendment', 'id-1', {}, '/amendment/id-1'],
    ['blog', 'id-1', { groupId: 'group-1' }, '/group/group-1/blog/id-1'],
    ['blog', 'id-1', { authorId: 'user-1' }, '/user/user-1/blog/id-1'],
    ['blog', 'id-1', {}, '/blog/id-1'],
    ['dataset', 'id-1', { groupId: 'group-1' }, '/group/group-1/operation#datasets'],
    ['dataset', 'id-1', {}, undefined],
    ['event', 'id-1', {}, '/event/id-1'],
    ['group', 'id-1', {}, '/group/id-1'],
    ['statement', 'id-1', {}, '/statement/id-1'],
    ['todo', 'id-1', {}, '/todos/id-1'],
    ['user', 'id-1', {}, '/user/id-1'],
    ['unknown', 'id-1', {}, undefined],
    [undefined, 'id-1', {}, undefined],
    ['group', undefined, {}, undefined],
  ])('maps entity %p to its destination', (type, id, options, expected) => {
    expect(getEntityHref(type, id, options)).toBe(expected);
  });

  it('honors an explicit content href before all inferred destinations', () => {
    expect(
      getSearchContentItemHref(contentItem({ id: 'vote-1', type: 'vote', href: '/explicit' }))
    ).toBe('/explicit');
  });

  it.each([
    [
      contentItem({
        id: 'election-1',
        type: 'election',
        agendaEventId: 'event-1',
        agendaItemId: 'item-1',
      }),
      '/event/event-1/agenda/item-1',
    ],
    [contentItem({ id: 'election-1', type: 'election', groupId: 'group-1' }), '/group/group-1'],
    [contentItem({ id: 'election-1', type: 'election' }), '/fallback'],
    [
      contentItem({ id: 'vote-1', type: 'vote', agendaEventId: 'event-1' }),
      '/event/event-1/agenda',
    ],
    [contentItem({ id: 'vote-1', type: 'vote' }), '/fallback'],
    [
      contentItem({ id: 'image-1', type: 'image', sourceType: 'user', sourceId: 'user-1' }),
      '/user/user-1',
    ],
    [contentItem({ id: 'video-1', type: 'video' }), '/fallback'],
    [
      contentItem({ id: 'blog-1', type: 'blog', groupId: 'group-1', authorId: 'user-1' }),
      '/group/group-1/blog/blog-1',
    ],
  ])('infers a content item destination', (item, expected) => {
    expect(getSearchContentItemHref(item, '/fallback')).toBe(expected);
  });

  it('uses direct and snake-case agenda payload fields before metadata', () => {
    expect(
      getSearchDocumentEntityHref(document({ entity_type: 'vote' }), {
        type: 'vote',
        agenda_event_id: 'event-1',
        agenda_item_id: 'item-1',
        metadata: { event_id: 'ignored', agenda_item_id: 'ignored' },
      })
    ).toBe('/event/event-1/agenda/item-1');

    expect(
      getSearchDocumentEntityHref(document({ entity_type: 'vote' }), {
        type: 'vote',
        event_id: 'event-2',
        metadata: { agendaItemId: 'item-2' },
      })
    ).toBe('/event/event-2/agenda/item-2');
  });

  it('falls an election without agenda data back to its group but leaves a vote unresolved', () => {
    expect(getSearchDocumentEntityHref(document(), { type: 'election' })).toBe('/group/group-1');
    expect(getSearchDocumentEntityHref(document(), { type: 'vote' })).toBeUndefined();
  });

  it.each([
    [
      { type: 'image', source_type: 'statement', source_id: 'statement-1' },
      '/statement/statement-1',
    ],
    [
      {
        type: 'video',
        metadata: { sourceType: 'event', sourceId: 'event-1' },
      },
      '/event/event-1',
    ],
    [
      {
        type: 'image',
        entity_type: 'group',
        entity_id: 'group-2',
      },
      '/group/group-2',
    ],
    [{ type: 'image', source_type: 'dataset', source_id: 'dataset-1' }, undefined],
  ])('resolves media payload destinations', (payload, expected) => {
    expect(getSearchDocumentEntityHref(document(), payload)).toBe(expected);
  });

  it('resolves normal document entities and uses owner information for blogs', () => {
    expect(
      getSearchDocumentEntityHref(
        document({ entity_type: 'blog', entity_id: 'blog-1', group_id: null }),
        {}
      )
    ).toBe('/user/owner-1/blog/blog-1');
  });

  it('uses a valid card payload and otherwise falls back to an encoded result permalink', () => {
    expect(
      getSearchDocumentHref(document({ card_payload: { type: 'event', entity_id: 'event-1' } }))
    ).toBe('/event/event-1');
    expect(getSearchDocumentHref(document({ entity_type: 'unknown', card_payload: [] }))).toBe(
      '/search?result=result%2Fa%20b'
    );
  });
});
