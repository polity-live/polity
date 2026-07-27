import { table, string, number, json } from '@rocicorp/zero';
import type { MutableJSONValue } from '../shared/helpers';

export const searchDocument = table('search_document')
  .columns({
    id: string(),
    entity_type: string(),
    entity_id: string(),
    title: string(),
    subtitle: string().optional(),
    summary: string().optional(),
    search_text: string(),
    visibility: string(),
    owner_user_id: string().optional(),
    group_id: string().optional(),
    image_url: string().optional(),
    location_latitude: number().optional(),
    location_longitude: number().optional(),
    location_label: string().optional(),
    location_source: string().optional(),
    location_kind: string().optional(),
    location_place_id: string().optional(),
    location_boundary_source: string().optional(),
    location_geometry: json<MutableJSONValue>().optional(),
    location_bounds: json<MutableJSONValue>().optional(),
    card_payload: json<MutableJSONValue>(),
    created_at: number(),
    updated_at: number(),
    engagement_score: number(),
    trending_score: number(),
    tutorial_run_id: string().optional(),
  })
  .primaryKey('id');

export const searchDocumentTopic = table('search_document_topic')
  .columns({
    id: string(),
    document_id: string(),
    topic: string(),
    created_at: number(),
  })
  .primaryKey('id');

export const searchDocumentAcl = table('search_document_acl')
  .columns({
    id: string(),
    document_id: string(),
    user_id: string(),
    created_at: number(),
  })
  .primaryKey('id');
