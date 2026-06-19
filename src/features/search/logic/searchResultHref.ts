import type { SearchDocument, SearchDocumentCardPayload } from '../types/search-document.types';
import type { SearchContentItem } from '../types/search.types';

export type SearchMediaSourceType = 'amendment' | 'blog' | 'event' | 'group' | 'statement' | 'user';

const MEDIA_SOURCE_TYPES = new Set<string>([
  'amendment',
  'blog',
  'event',
  'group',
  'statement',
  'user',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function firstString(...values: readonly unknown[]): string | undefined {
  for (const value of values) {
    const text = asString(value);
    if (text) return text;
  }

  return undefined;
}

function metadataFrom(payload?: SearchDocumentCardPayload | null): Record<string, unknown> {
  return isRecord(payload?.metadata) ? payload.metadata : {};
}

export function normalizeSearchMediaSourceType(value: unknown): SearchMediaSourceType | undefined {
  const type = asString(value);
  return type && MEDIA_SOURCE_TYPES.has(type) ? (type as SearchMediaSourceType) : undefined;
}

export function getSearchResultPermalink(document: Pick<SearchDocument, 'id'>): string {
  return `/search?result=${encodeURIComponent(document.id)}`;
}

export function getAgendaItemHref(
  eventId?: string | null,
  agendaItemId?: string | null
): string | undefined {
  if (!eventId) return undefined;
  return agendaItemId ? `/event/${eventId}/agenda/${agendaItemId}` : `/event/${eventId}/agenda`;
}

export function getEntityHref(
  type?: string | null,
  id?: string | null,
  options: { authorId?: string | null; groupId?: string | null } = {}
): string | undefined {
  if (!type || !id) return undefined;

  switch (type) {
    case 'amendment':
      return `/amendment/${id}`;
    case 'blog':
      if (options.groupId) return `/group/${options.groupId}/blog/${id}`;
      if (options.authorId) return `/user/${options.authorId}/blog/${id}`;
      return `/blog/${id}`;
    case 'event':
      return `/event/${id}`;
    case 'group':
      return `/group/${id}`;
    case 'statement':
      return `/statement/${id}`;
    case 'todo':
      return `/todos/${id}`;
    case 'user':
      return `/user/${id}`;
    default:
      return undefined;
  }
}

export function getSearchContentItemHref(
  item: Pick<
    SearchContentItem,
    | 'agendaEventId'
    | 'agendaItemId'
    | 'authorId'
    | 'groupId'
    | 'href'
    | 'id'
    | 'sourceId'
    | 'sourceType'
    | 'type'
  >,
  fallbackHref?: string
): string | undefined {
  if (item.href) return item.href;

  switch (item.type) {
    case 'election':
      return (
        getAgendaItemHref(item.agendaEventId, item.agendaItemId) ??
        (item.groupId ? getEntityHref('group', item.groupId) : undefined) ??
        fallbackHref
      );
    case 'vote':
      return getAgendaItemHref(item.agendaEventId, item.agendaItemId) ?? fallbackHref;
    case 'image':
    case 'video':
      return getEntityHref(item.sourceType, item.sourceId) ?? fallbackHref;
    default:
      return getEntityHref(item.type, item.id, {
        authorId: item.authorId,
        groupId: item.groupId,
      });
  }
}

export function getSearchDocumentEntityHref(
  document: SearchDocument,
  payload: SearchDocumentCardPayload = {}
): string | undefined {
  const metadata = metadataFrom(payload);
  const type = firstString(payload.type, document.entity_type);
  const entityId = firstString(payload.entity_id, document.entity_id);

  if (type === 'election' || type === 'vote') {
    const agendaHref = getAgendaItemHref(
      firstString(
        payload.agendaEventId,
        payload.agenda_event_id,
        payload.event_id,
        metadata.agendaEventId,
        metadata.agenda_event_id,
        metadata.event_id
      ),
      firstString(
        payload.agendaItemId,
        payload.agenda_item_id,
        metadata.agendaItemId,
        metadata.agenda_item_id
      )
    );

    return (
      agendaHref ?? (type === 'election' ? getEntityHref('group', document.group_id) : undefined)
    );
  }

  if (type === 'image' || type === 'video') {
    const sourceType = normalizeSearchMediaSourceType(
      firstString(
        payload.sourceType,
        payload.source_type,
        payload.entity_type,
        metadata.sourceType,
        metadata.source_type,
        metadata.entity_type
      )
    );
    const sourceId = firstString(
      payload.sourceId,
      payload.source_id,
      payload.entity_id,
      metadata.sourceId,
      metadata.source_id,
      metadata.entity_id
    );

    return getEntityHref(sourceType, sourceId);
  }

  return getEntityHref(type, entityId, {
    authorId: document.owner_user_id,
    groupId: document.group_id,
  });
}

export function getSearchDocumentHref(document: SearchDocument): string {
  const payload = isRecord(document.card_payload)
    ? (document.card_payload as SearchDocumentCardPayload)
    : {};

  return getSearchDocumentEntityHref(document, payload) ?? getSearchResultPermalink(document);
}
