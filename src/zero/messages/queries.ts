import { defineQuery, type QueryRowType } from '@rocicorp/zero';
import { z } from 'zod';
import { zql } from '../schema';

const conversationStartSchema = z
  .object({
    pinned: z.boolean().optional().nullable(),
    last_message_at: z.number().optional().nullable(),
    id: z.string(),
  })
  .nullable();

const messageStartSchema = z
  .object({
    created_at: z.number(),
    id: z.string(),
  })
  .nullable();

function conversationAccessFilter<T>(q: T, userID: string | undefined): T {
  const query = q as any;

  if (!userID || userID === 'anon') {
    return query.where('id', '__unauthorized__') as T;
  }

  return query.where(({ or, cmp, exists }: any) =>
    or(
      cmp('assistant_for_user_id', userID),
      cmp('requested_by_id', userID),
      exists('participants', (participant: any) =>
        participant.where('user_id', userID).where('left_at', 'IS', null)
      )
    )
  ) as T;
}

export const messageQueries = {
  // Conversations for the current user (via participant join)
  conversations: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    zql.conversation_participant.where('user_id', userID).orderBy('joined_at', 'desc')
  ),

  // Single conversation by ID
  conversationById: defineQuery(z.object({ id: z.string() }), ({ args: { id }, ctx: { userID } }) =>
    conversationAccessFilter(zql.conversation.where('id', id), userID).one()
  ),

  // Messages in a conversation
  messages: defineQuery(
    z.object({ conversation_id: z.string() }),
    ({ args: { conversation_id }, ctx: { userID } }) =>
      zql.message
        .where('conversation_id', conversation_id)
        .whereExists('conversation', q => conversationAccessFilter(q, userID))
        .related('sender')
        .orderBy('created_at', 'asc')
  ),

  messagePage: defineQuery(
    z.object({
      conversationId: z.string(),
      limit: z.number().min(1).max(200).default(80),
      start: messageStartSchema.default(null),
      dir: z.enum(['forward', 'backward']).default('forward'),
    }),
    ({ args: { conversationId, limit, start, dir }, ctx: { userID } }) => {
      const direction = dir === 'forward' ? 'asc' : 'desc';
      let q: any = zql.message
        .where('conversation_id', conversationId)
        .where('deleted_at', 'IS', null)
        .whereExists('conversation', (conversationQuery: any) =>
          conversationAccessFilter(conversationQuery, userID)
        )
        .related('sender')
        .orderBy('created_at', direction)
        .orderBy('id', direction);

      if (start) {
        q = q.start(start, { inclusive: false });
      }

      return q.limit(limit);
    }
  ),

  messageById: defineQuery(z.object({ id: z.string() }), ({ args: { id }, ctx: { userID } }) =>
    zql.message
      .where('id', id)
      .whereExists('conversation', q => conversationAccessFilter(q, userID))
      .related('sender')
      .one()
  ),

  messagesWindow: defineQuery(
    z.object({ conversation_id: z.string(), limit: z.number().min(1).max(500).default(80) }),
    ({ args: { conversation_id, limit }, ctx: { userID } }) =>
      zql.message
        .where('conversation_id', conversation_id)
        .where('deleted_at', 'IS', null)
        .whereExists('conversation', q => conversationAccessFilter(q, userID))
        .related('sender')
        .orderBy('created_at', 'desc')
        .orderBy('id', 'desc')
        .limit(limit)
  ),

  // Unread message count for the current user
  unreadCount: defineQuery(
    z.object({ conversation_id: z.string() }),
    ({ args: { conversation_id }, ctx: { userID } }) =>
      zql.message
        .where('conversation_id', conversation_id)
        .where('is_read', false)
        .whereExists('conversation', q => conversationAccessFilter(q, userID))
  ),

  // Conversations with full relations (group, requested_by, participants→user, messages→sender)
  conversationsWithRelations: defineQuery(
    z.object({ limit: z.number().optional() }),
    ({ args: { limit }, ctx: { userID } }) => {
      let q = conversationAccessFilter(zql.conversation, userID)
        .related('group')
        .related('event')
        .related('requested_by')
        .related('participants', q => q.related('user'))
        .related('messages', q =>
          q.orderBy('created_at', 'desc').orderBy('id', 'desc').limit(1).related('sender')
        )
        .orderBy('last_message_at', 'desc');
      if (limit) q = q.limit(limit);
      return q;
    }
  ),

  conversationPage: defineQuery(
    z.object({
      filter: z.enum(['all', 'direct', 'group', 'event', 'ai']).default('all'),
      query: z.string().default(''),
      limit: z.number().min(1).max(100).default(40),
      start: conversationStartSchema.default(null),
      dir: z.enum(['forward', 'backward']).default('forward'),
    }),
    ({ args: { filter, query, limit, start, dir }, ctx: { userID } }) => {
      const direction = dir === 'forward' ? 'desc' : 'asc';
      const normalizedQuery = query.trim();
      let q: any = conversationAccessFilter(zql.conversation, userID)
        .related('group')
        .related('event')
        .related('requested_by')
        .related('participants', (participant: any) => participant.related('user'))
        .related('messages', (message: any) =>
          message.orderBy('created_at', 'desc').orderBy('id', 'desc').limit(1).related('sender')
        );

      if (filter === 'direct') {
        q = q.where('type', 'direct').where('assistant_for_user_id', 'IS', null);
      } else if (filter === 'group') {
        q = q.where('type', 'group');
      } else if (filter === 'event') {
        q = q.where('type', 'event');
      } else if (filter === 'ai') {
        q = q.where('assistant_for_user_id', userID);
      }

      if (normalizedQuery) {
        q = q.where(({ or, cmp, exists }: any) =>
          or(
            cmp('name', 'ILIKE', `%${normalizedQuery}%`),
            cmp('last_message_preview', 'ILIKE', `%${normalizedQuery}%`),
            exists('participants', (participant: any) =>
              participant.whereExists('user', (user: any) =>
                user.where(({ or, cmp }: any) =>
                  or(
                    cmp('handle', 'ILIKE', `%${normalizedQuery}%`),
                    cmp('first_name', 'ILIKE', `%${normalizedQuery}%`),
                    cmp('last_name', 'ILIKE', `%${normalizedQuery}%`)
                  )
                )
              )
            ),
            exists('messages', (message: any) =>
              message.where('content', 'ILIKE', `%${normalizedQuery}%`)
            )
          )
        );
      }

      q = q
        .orderBy('pinned', direction)
        .orderBy('last_message_at', direction)
        .orderBy('id', direction);

      if (start) {
        q = q.start(start, { inclusive: false });
      }

      return q.limit(limit);
    }
  ),

  // Lighter conversation query for unread counting (participants + messages→sender)
  conversationsForUnread: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    zql.conversation_participant.where('user_id', userID).related('conversation', q =>
      q
        .related('participants', pq => pq.related('user'))
        .related('messages', mq =>
          mq.orderBy('created_at', 'desc').orderBy('id', 'desc').limit(1).related('sender')
        )
        .orderBy('last_message_at', 'desc')
    )
  ),

  conversationsByUserWithRelations: defineQuery(
    z.object({ user_id: z.string() }),
    ({ args: { user_id }, ctx: { userID } }) =>
      zql.conversation_participant
        .where('user_id', user_id)
        .where('user_id', userID)
        .related('conversation', q =>
          conversationAccessFilter(q, userID)
            .related('group')
            .related('event')
            .related('participants', pq => pq.related('user'))
            .related('messages')
        )
  ),

  // Find group conversation by group_id
  conversationByGroupId: defineQuery(
    z.object({ group_id: z.string() }),
    ({ args: { group_id }, ctx: { userID } }) =>
      conversationAccessFilter(zql.conversation.where('group_id', group_id), userID)
        .where('type', 'group')
        .one()
  ),

  conversationByEventId: defineQuery(
    z.object({ event_id: z.string() }),
    ({ args: { event_id }, ctx: { userID } }) =>
      conversationAccessFilter(zql.conversation.where('event_id', event_id), userID)
        .where('type', 'event')
        .one()
  ),
};

// ── Query Row Types ─────────────────────────────────────────────────
export type ConversationWithRelationsRow = QueryRowType<
  typeof messageQueries.conversationsWithRelations
>;
