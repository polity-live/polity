import type { SearchDocument as SearchDocumentRow } from '@/zero/schema';
import type { SearchListContext, SearchStart } from '@/zero/shared/search-query-helpers';

export interface SearchDocumentCardPayload {
  type?: string;
  handle?: string | null;
  code?: string | null;
  location?: string | null;
  status?: string | null;
  priority?: string | null;
  agendaEventId?: string | null;
  agendaItemId?: string | null;
  agenda_event_id?: string | null;
  agenda_item_id?: string | null;
  event_id?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  source_type?: string | null;
  source_id?: string | null;
  starts_at?: number | null;
  ends_at?: number | null;
  due_at?: number | null;
  archived_at?: number | null;
  tags?: readonly string[];
  stats?: Record<string, number | string | null | undefined>;
  metadata?: Record<string, unknown>;
  entity_type?: string | null;
  entity_id?: string | null;
  group_type?: string | null;
  connected_group_id?: string | null;
  primary_sibling_membership_mode?: string | null;
  event_type?: string | null;
}

export type SearchDocument = SearchDocumentRow & {
  readonly topics?: readonly { readonly topic: string }[];
  readonly group?: { readonly id: string; readonly name?: string | null } | null;
};

export type { SearchListContext, SearchStart };
