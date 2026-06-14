import { table, string, number, boolean } from '@rocicorp/zero';

export const conversation = table('conversation')
  .columns({
    id: string(),
    type: string().optional(),
    name: string().optional(),
    status: string().optional(),
    pinned: boolean().optional(),
    last_message_at: number().optional(),
    last_message_id: string().optional(),
    last_message_preview: string().optional(),
    assistant_for_user_id: string().optional(),
    group_id: string().optional(),
    event_id: string().optional(),
    requested_by_id: string().optional(),
    created_at: number(),
  })
  .primaryKey('id');

export const conversationParticipant = table('conversation_participant')
  .columns({
    id: string(),
    conversation_id: string(),
    user_id: string(),
    joined_at: number(),
    last_read_at: number().optional(),
    left_at: number().optional(),
    unread_count: number().optional(),
  })
  .primaryKey('id');

export const message = table('message')
  .columns({
    id: string(),
    conversation_id: string(),
    sender_id: string(),
    content: string().optional(),
    context_json: string().optional(),
    is_read: boolean(),
    deleted_at: number().optional(),
    created_at: number(),
    updated_at: number(),
  })
  .primaryKey('id');
