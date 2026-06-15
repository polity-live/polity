import { table, string, number, json, type ReadonlyJSONValue } from '@rocicorp/zero';

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
    card_payload: json<ReadonlyJSONValue>(),
    created_at: number(),
    updated_at: number(),
    engagement_score: number(),
    trending_score: number(),
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
