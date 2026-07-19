import { tool } from 'ai';
import { z } from 'zod';
import { richTextToPlainText } from '@/features/shared/logic/richText';
import type { TimelineCardItem } from '@/features/search/logic/buildTimelineCardProps';
import { currencyCodeSchema, type CurrencyCode } from '@/features/shared/logic/currency';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { syncEntityHashtagsForUpdate } from '@/zero/common/server-hashtags';
import { serverMutators } from '@/zero/server-mutators';
import { zql } from '@/zero/schema';
import {
  createZeroContext,
  executeZeroTransaction,
  runZeroMutator,
  type ZeroTransaction,
} from './zero-mutate';
import {
  buildAttachment,
  buildUpdatedResult,
  formatCurrency,
  formatDate,
  normalizeStringList,
  parseOptionalTimestamp,
  toRichText,
  truncate,
} from './ai-create-tools';

const visibilitySchema = z.enum(['public', 'authenticated', 'private']);
const eventTypeSchema = z.enum(['delegate_assembly', 'general_assembly', 'open', 'on_invite']);
const locationTypeSchema = z.enum(['physical', 'online']);
const todoPrioritySchema = z.enum(['low', 'medium', 'high']);
const todoStatusSchema = z.enum(['pending', 'in_progress', 'completed', 'cancelled']);
const paymentTypeSchema = z.enum([
  'membership_fee',
  'donation',
  'subsidies',
  'campaign',
  'material',
  'events',
  'others',
]);

const nullableTextSchema = z.string().trim().nullable();
const nullableUrlSchema = z.union([z.string().trim().url(), z.null()]);
const hashtagListSchema = z.array(z.string().trim().min(1));

function hasUpdateField(value: Record<string, unknown>, identifierFields: readonly string[]) {
  const identifiers = new Set(identifierFields);
  return Object.entries(value).some(([key, fieldValue]) => {
    return !identifiers.has(key) && fieldValue !== undefined;
  });
}

function requireUpdateFields<T extends z.ZodTypeAny>(
  schema: T,
  identifierFields: readonly string[]
) {
  return schema.refine(
    value => hasUpdateField(value as Record<string, unknown>, identifierFields),
    {
      message: 'At least one update field is required.',
    }
  );
}

function parseOptionalIsoDate(
  value: string | null | undefined,
  timeZone: string
): string | null | undefined {
  if (value === undefined || value === null) return value;
  const timestamp = parseOptionalTimestamp(value, { timeZone });
  return timestamp === null ? null : new Date(timestamp).toISOString();
}

function paymentDirection(payment: {
  payer_group_id?: string | null;
  receiver_group_id?: string | null;
}): 'income' | 'expense' {
  return payment.receiver_group_id ? 'income' : 'expense';
}

async function hashtagTags(
  tx: ZeroTransaction,
  entityType: 'group' | 'event' | 'amendment' | 'blog' | 'statement',
  entityId: string
): Promise<string[]> {
  const readTags = (rows: readonly any[]) =>
    rows.map(row => row.hashtag?.tag).filter((tag): tag is string => typeof tag === 'string');

  switch (entityType) {
    case 'group':
      return readTags(
        await tx.run(zql.group_hashtag.where('group_id', entityId).related('hashtag'))
      );
    case 'event':
      return readTags(
        await tx.run(zql.event_hashtag.where('event_id', entityId).related('hashtag'))
      );
    case 'amendment':
      return readTags(
        await tx.run(zql.amendment_hashtag.where('amendment_id', entityId).related('hashtag'))
      );
    case 'blog':
      return readTags(await tx.run(zql.blog_hashtag.where('blog_id', entityId).related('hashtag')));
    case 'statement':
      return readTags(
        await tx.run(zql.statement_hashtag.where('statement_id', entityId).related('hashtag'))
      );
  }
}

function timelineItem(value: Record<string, unknown>): TimelineCardItem {
  return value as unknown as TimelineCardItem;
}

const updateGroupSchema = requireUpdateFields(
  z.object({
    groupId: z.string().trim().min(1),
    name: z.string().trim().min(1).optional(),
    description: nullableTextSchema.optional(),
    visibility: visibilitySchema.optional(),
    email: z.union([z.string().trim().email(), z.null()]).optional(),
    country: nullableTextSchema.optional(),
    region: nullableTextSchema.optional(),
    postCode: nullableTextSchema.optional(),
    city: nullableTextSchema.optional(),
    street: nullableTextSchema.optional(),
    houseNumber: nullableTextSchema.optional(),
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
    imageUrl: nullableUrlSchema.optional(),
    hashtags: hashtagListSchema.optional(),
  }),
  ['groupId']
);

const updateEventSchema = requireUpdateFields(
  z.object({
    eventId: z.string().trim().min(1),
    title: z.string().trim().min(1).optional(),
    description: nullableTextSchema.optional(),
    eventType: eventTypeSchema.optional(),
    visibility: visibilitySchema.optional(),
    locationType: locationTypeSchema.optional(),
    locationName: nullableTextSchema.optional(),
    locationUrl: nullableUrlSchema.optional(),
    country: nullableTextSchema.optional(),
    region: nullableTextSchema.optional(),
    postCode: nullableTextSchema.optional(),
    city: nullableTextSchema.optional(),
    street: nullableTextSchema.optional(),
    houseNumber: nullableTextSchema.optional(),
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
    startsAt: nullableTextSchema.optional(),
    endsAt: nullableTextSchema.optional(),
    capacity: z.number().int().positive().nullable().optional(),
    imageUrl: nullableUrlSchema.optional(),
    delegatesNominationDeadline: nullableTextSchema.optional(),
    amendmentDeadline: nullableTextSchema.optional(),
    totalDelegateSeats: z.number().int().positive().nullable().optional(),
    hashtags: hashtagListSchema.optional(),
  }),
  ['eventId']
);

const updateAmendmentSchema = requireUpdateFields(
  z.object({
    amendmentId: z.string().trim().min(1),
    title: z.string().trim().min(1).optional(),
    code: nullableTextSchema.optional(),
    reason: nullableTextSchema.optional(),
    visibility: visibilitySchema.optional(),
    imageUrl: nullableUrlSchema.optional(),
    hashtags: hashtagListSchema.optional(),
  }),
  ['amendmentId']
);

const updateBlogSchema = requireUpdateFields(
  z.object({
    blogId: z.string().trim().min(1),
    title: z.string().trim().min(1).optional(),
    date: nullableTextSchema.optional(),
    visibility: visibilitySchema.optional(),
    imageUrl: nullableUrlSchema.optional(),
    hashtags: hashtagListSchema.optional(),
  }),
  ['blogId']
);

const updateTodoSchema = requireUpdateFields(
  z.object({
    todoId: z.string().trim().min(1),
    title: z.string().trim().min(1).optional(),
    description: nullableTextSchema.optional(),
    priority: todoPrioritySchema.optional(),
    status: todoStatusSchema.optional(),
    dueDate: nullableTextSchema.optional(),
    visibility: visibilitySchema.optional(),
    tags: hashtagListSchema.optional(),
  }),
  ['todoId']
);

const updateStatementSchema = requireUpdateFields(
  z.object({
    statementId: z.string().trim().min(1),
    text: z.string().trim().max(280).nullable().optional(),
    imageUrl: nullableUrlSchema.optional(),
    videoUrl: nullableUrlSchema.optional(),
    visibility: visibilitySchema.optional(),
    hashtags: hashtagListSchema.optional(),
  }),
  ['statementId']
);

const updatePaymentSchema = requireUpdateFields(
  z.object({
    paymentId: z.string().trim().min(1),
    label: nullableTextSchema.optional(),
    type: paymentTypeSchema.nullable().optional(),
    amount: z.number().positive().nullable().optional(),
    currency: currencyCodeSchema.optional(),
  }),
  ['paymentId']
);

const updateAgendaItemSchema = requireUpdateFields(
  z.object({
    agendaItemId: z.string().trim().min(1),
    title: z.string().trim().min(1).optional(),
    description: nullableTextSchema.optional(),
    orderIndex: z.number().int().min(1).optional(),
    durationMinutes: z.number().int().min(0).optional(),
  }),
  ['agendaItemId']
);

const updateElectionCandidateSchema = requireUpdateFields(
  z
    .object({
      candidateId: z.string().trim().min(1).optional(),
      electionId: z.string().trim().min(1).optional(),
      candidateUserId: z.string().trim().min(1).optional(),
      name: nullableTextSchema.optional(),
      statement: nullableTextSchema.optional(),
      imageUrl: nullableUrlSchema.optional(),
    })
    .refine(value => Boolean(value.candidateId) !== Boolean(value.electionId), {
      message: 'Specify exactly one of candidateId or electionId.',
    }),
  ['candidateId', 'electionId', 'candidateUserId']
);

export function buildAiUpdateTools(userId: string, timeZone = 'UTC') {
  const zeroContext = createZeroContext(userId);

  return {
    update_group: tool({
      description: translateText(
        'generated.inline.ai_update_group_description',
        'Aktualisiert eine bestehende Gruppe, wenn der Nutzer die Gruppe verwalten darf.'
      ),
      inputSchema: updateGroupSchema,
      execute: async args => {
        const result = await executeZeroTransaction(zeroContext, async (tx, ctx) => {
          const existing = await tx.run(zql.group.where('id', args.groupId).one());
          if (!existing) throw new Error('Group not found');

          await runZeroMutator(
            tx,
            serverMutators.groups.update({
              id: args.groupId,
              ...(args.name !== undefined ? { name: args.name } : {}),
              ...(args.description !== undefined
                ? { description: args.description === null ? null : toRichText(args.description) }
                : {}),
              ...(args.visibility !== undefined ? { visibility: args.visibility } : {}),
              ...(args.email !== undefined ? { email: args.email } : {}),
              ...(args.country !== undefined ? { country: args.country } : {}),
              ...(args.region !== undefined ? { region: args.region } : {}),
              ...(args.postCode !== undefined ? { post_code: args.postCode } : {}),
              ...(args.city !== undefined ? { city: args.city } : {}),
              ...(args.street !== undefined ? { street: args.street } : {}),
              ...(args.houseNumber !== undefined ? { house_number: args.houseNumber } : {}),
              ...(args.latitude !== undefined ? { latitude: args.latitude } : {}),
              ...(args.longitude !== undefined ? { longitude: args.longitude } : {}),
              ...(args.imageUrl !== undefined ? { image_url: args.imageUrl } : {}),
            }),
            ctx
          );
          if (args.hashtags !== undefined) {
            await syncEntityHashtagsForUpdate(tx, ctx, 'group', args.groupId, args.hashtags);
          }

          const group = await tx.run(zql.group.where('id', args.groupId).one());
          if (!group) throw new Error('Group not found after update');
          const tags = await hashtagTags(tx, 'group', group.id);
          return { group, tags };
        });

        const attachment = buildAttachment(
          'group',
          result.group.id,
          result.group.name ?? 'Group',
          result.group.visibility,
          truncate(richTextToPlainText(result.group.description)),
          timelineItem({
            id: result.group.id,
            type: 'group',
            title: result.group.name ?? 'Group',
            description: richTextToPlainText(result.group.description),
            createdAt: new Date(result.group.created_at),
            memberCount: result.group.member_count,
            eventCount: result.group.event_count,
            amendmentCount: result.group.amendment_count,
            tags: result.tags,
          })
        );
        return buildUpdatedResult('Gruppe aktualisiert.', attachment, `/group/${result.group.id}`);
      },
    }),

    update_event: tool({
      description: translateText(
        'generated.inline.ai_update_event_description',
        'Aktualisiert die direkten Felder eines bestehenden Events.'
      ),
      inputSchema: updateEventSchema,
      execute: async args => {
        const result = await executeZeroTransaction(zeroContext, async (tx, ctx) => {
          const existing = await tx.run(zql.event.where('id', args.eventId).one());
          if (!existing) throw new Error('Event not found');
          const nextEventType = args.eventType ?? existing.event_type;
          const delegateAssembly = nextEventType === 'delegate_assembly';

          await runZeroMutator(
            tx,
            serverMutators.events.update({
              id: args.eventId,
              ...(args.title !== undefined ? { title: args.title } : {}),
              ...(args.description !== undefined
                ? { description: args.description === null ? null : toRichText(args.description) }
                : {}),
              ...(args.eventType !== undefined
                ? { event_type: args.eventType, has_delegates: delegateAssembly }
                : {}),
              ...(args.visibility !== undefined ? { visibility: args.visibility } : {}),
              ...(args.locationType !== undefined ? { location_type: args.locationType } : {}),
              ...(args.locationName !== undefined ? { location_name: args.locationName } : {}),
              ...(args.locationUrl !== undefined ? { location_url: args.locationUrl } : {}),
              ...(args.country !== undefined ? { country: args.country } : {}),
              ...(args.region !== undefined ? { region: args.region } : {}),
              ...(args.postCode !== undefined ? { post_code: args.postCode } : {}),
              ...(args.city !== undefined ? { city: args.city } : {}),
              ...(args.street !== undefined ? { street: args.street } : {}),
              ...(args.houseNumber !== undefined ? { house_number: args.houseNumber } : {}),
              ...(args.latitude !== undefined ? { latitude: args.latitude } : {}),
              ...(args.longitude !== undefined ? { longitude: args.longitude } : {}),
              ...(args.startsAt !== undefined
                ? { start_date: parseOptionalTimestamp(args.startsAt, { timeZone }) }
                : {}),
              ...(args.endsAt !== undefined
                ? { end_date: parseOptionalTimestamp(args.endsAt, { timeZone }) }
                : {}),
              ...(args.capacity !== undefined ? { capacity: args.capacity } : {}),
              ...(args.imageUrl !== undefined ? { image_url: args.imageUrl } : {}),
              ...(args.delegatesNominationDeadline !== undefined
                ? {
                    delegates_nomination_deadline: parseOptionalTimestamp(
                      args.delegatesNominationDeadline,
                      { timeZone }
                    ),
                  }
                : {}),
              ...(args.amendmentDeadline !== undefined
                ? {
                    amendment_deadline: parseOptionalTimestamp(args.amendmentDeadline, {
                      timeZone,
                    }),
                  }
                : {}),
              ...(args.totalDelegateSeats !== undefined
                ? { total_delegate_seats: args.totalDelegateSeats }
                : {}),
              ...(args.eventType !== undefined && !delegateAssembly
                ? {
                    total_delegate_seats: null,
                    delegates_nomination_deadline: null,
                  }
                : {}),
            }),
            ctx
          );
          if (args.hashtags !== undefined) {
            await syncEntityHashtagsForUpdate(tx, ctx, 'event', args.eventId, args.hashtags);
          }

          const event = await tx.run(zql.event.where('id', args.eventId).one());
          if (!event) throw new Error('Event not found after update');
          const [tags, group] = await Promise.all([
            hashtagTags(tx, 'event', event.id),
            event.group_id ? tx.run(zql.group.where('id', event.group_id).one()) : null,
          ]);
          return { event, tags, group };
        });

        const description = richTextToPlainText(result.event.description);
        const attachment = buildAttachment(
          'event',
          result.event.id,
          result.event.title ?? 'Event',
          [formatDate(result.event.start_date), result.event.location_name, result.event.event_type]
            .filter(Boolean)
            .join(' · ') || null,
          truncate(description),
          timelineItem({
            id: result.event.id,
            type: 'event',
            title: result.event.title ?? 'Event',
            description,
            createdAt: new Date(result.event.created_at),
            startDate: result.event.start_date ? new Date(result.event.start_date) : undefined,
            endDate: result.event.end_date ? new Date(result.event.end_date) : undefined,
            location: result.event.location_name,
            city: result.event.city,
            postcode: result.event.post_code,
            groupId: result.event.group_id,
            groupName: result.group?.name,
            attendeeCount: result.event.participant_count,
            electionsCount: result.event.election_count,
            amendmentsCount: result.event.amendment_count,
            tags: result.tags,
          })
        );
        return buildUpdatedResult('Event aktualisiert.', attachment, `/event/${result.event.id}`);
      },
    }),

    update_amendment: tool({
      description: translateText(
        'generated.inline.ai_update_amendment_description',
        'Aktualisiert einen bestehenden Änderungsantrag.'
      ),
      inputSchema: updateAmendmentSchema,
      execute: async args => {
        const result = await executeZeroTransaction(zeroContext, async (tx, ctx) => {
          const existing = await tx.run(zql.amendment.where('id', args.amendmentId).one());
          if (!existing) throw new Error('Amendment not found');
          const normalizedTags =
            args.hashtags === undefined ? undefined : normalizeStringList(args.hashtags);

          await runZeroMutator(
            tx,
            serverMutators.amendments.update({
              id: args.amendmentId,
              ...(args.title !== undefined ? { title: args.title } : {}),
              ...(args.code !== undefined ? { code: args.code } : {}),
              ...(args.reason !== undefined ? { reason: args.reason } : {}),
              ...(args.visibility !== undefined ? { visibility: args.visibility } : {}),
              ...(args.imageUrl !== undefined ? { image_url: args.imageUrl } : {}),
              ...(normalizedTags !== undefined ? { tags: normalizedTags } : {}),
            }),
            ctx
          );
          if (args.hashtags !== undefined) {
            await syncEntityHashtagsForUpdate(
              tx,
              ctx,
              'amendment',
              args.amendmentId,
              args.hashtags
            );
          }
          const amendment = await tx.run(zql.amendment.where('id', args.amendmentId).one());
          if (!amendment) throw new Error('Amendment not found after update');
          const [tags, group] = await Promise.all([
            hashtagTags(tx, 'amendment', amendment.id),
            amendment.group_id ? tx.run(zql.group.where('id', amendment.group_id).one()) : null,
          ]);
          return { amendment, tags, group };
        });

        const attachment = buildAttachment(
          'amendment',
          result.amendment.id,
          result.amendment.title ?? 'Amendment',
          result.amendment.visibility,
          truncate(result.amendment.reason),
          timelineItem({
            id: result.amendment.id,
            type: 'amendment',
            title: result.amendment.title ?? 'Amendment',
            description: result.amendment.reason,
            createdAt: new Date(result.amendment.created_at),
            groupName: result.group?.name,
            collaboratorCount: result.amendment.collaborator_count,
            changeRequestCount: result.amendment.change_request_count,
            tags: result.tags,
          })
        );
        return buildUpdatedResult(
          'Änderungsantrag aktualisiert.',
          attachment,
          `/amendment/${result.amendment.id}`
        );
      },
    }),

    update_blog_entry: tool({
      description: translateText(
        'generated.inline.ai_update_blog_description',
        'Aktualisiert einen bestehenden Blogeintrag.'
      ),
      inputSchema: updateBlogSchema,
      execute: async args => {
        const result = await executeZeroTransaction(zeroContext, async (tx, ctx) => {
          const existing = await tx.run(zql.blog.where('id', args.blogId).one());
          if (!existing) throw new Error('Blog entry not found');
          await runZeroMutator(
            tx,
            serverMutators.blogs.update({
              id: args.blogId,
              ...(args.title !== undefined ? { title: args.title } : {}),
              ...(args.date !== undefined
                ? { date: parseOptionalIsoDate(args.date, timeZone) }
                : {}),
              ...(args.visibility !== undefined ? { visibility: args.visibility } : {}),
              ...(args.imageUrl !== undefined ? { image_url: args.imageUrl } : {}),
            }),
            ctx
          );
          if (args.hashtags !== undefined) {
            await syncEntityHashtagsForUpdate(tx, ctx, 'blog', args.blogId, args.hashtags);
          }
          const blog = await tx.run(zql.blog.where('id', args.blogId).one());
          if (!blog) throw new Error('Blog entry not found after update');
          const tags = await hashtagTags(tx, 'blog', blog.id);
          return { blog, tags };
        });

        const route = result.blog.group_id
          ? `/group/${result.blog.group_id}/blog/${result.blog.id}`
          : `/user/${userId}/blog/${result.blog.id}`;
        const attachment = buildAttachment(
          'blog',
          result.blog.id,
          result.blog.title ?? 'Blog entry',
          result.blog.visibility,
          truncate(result.blog.description),
          timelineItem({
            id: result.blog.id,
            type: 'blog',
            title: result.blog.title ?? 'Blog entry',
            description: result.blog.description,
            imageUrl: result.blog.image_url,
            createdAt: result.blog.date
              ? new Date(result.blog.date)
              : new Date(result.blog.created_at),
            authorId: userId,
            groupId: result.blog.group_id,
            commentCount: result.blog.comment_count,
            tags: result.tags,
          })
        );
        return buildUpdatedResult('Blogeintrag aktualisiert.', attachment, route);
      },
    }),

    update_todo: tool({
      description: translateText(
        'generated.inline.ai_update_todo_description',
        'Aktualisiert ein eigenes oder verwaltbares Todo.'
      ),
      inputSchema: updateTodoSchema,
      execute: async args => {
        const result = await executeZeroTransaction(zeroContext, async (tx, ctx) => {
          const existing = await tx.run(zql.todo.where('id', args.todoId).one());
          if (!existing) throw new Error('Todo not found');
          const now = Date.now();
          await runZeroMutator(
            tx,
            serverMutators.todos.update({
              id: args.todoId,
              ...(args.title !== undefined ? { title: args.title } : {}),
              ...(args.description !== undefined ? { description: args.description } : {}),
              ...(args.priority !== undefined ? { priority: args.priority } : {}),
              ...(args.status !== undefined
                ? {
                    status: args.status,
                    completed_at: args.status === 'completed' ? now : null,
                  }
                : {}),
              ...(args.dueDate !== undefined
                ? {
                    due_date: parseOptionalTimestamp(args.dueDate, {
                      timeZone,
                      dateOnlyBoundary: 'end',
                    }),
                  }
                : {}),
              ...(args.visibility !== undefined ? { visibility: args.visibility } : {}),
              ...(args.tags !== undefined ? { tags: normalizeStringList(args.tags) } : {}),
            }),
            ctx
          );
          const todo = await tx.run(zql.todo.where('id', args.todoId).one());
          if (!todo) throw new Error('Todo not found after update');
          const group = todo.group_id
            ? await tx.run(zql.group.where('id', todo.group_id).one())
            : null;
          return { todo, group };
        });

        const attachment = buildAttachment(
          'todo',
          result.todo.id,
          result.todo.title ?? 'Todo',
          [result.todo.status, result.todo.priority, formatDate(result.todo.due_date)]
            .filter(Boolean)
            .join(' · ') || null,
          truncate(result.todo.description),
          timelineItem({
            id: result.todo.id,
            type: 'todo',
            title: result.todo.title ?? 'Todo',
            description: result.todo.description,
            createdAt: new Date(result.todo.created_at),
            updatedAt: new Date(result.todo.updated_at),
            dueDate: result.todo.due_date ? new Date(result.todo.due_date) : undefined,
            status: result.todo.status,
            isCompleted: result.todo.status === 'completed',
            groupId: result.todo.group_id,
            groupName: result.group?.name,
            tags: result.todo.tags ?? [],
          })
        );
        return buildUpdatedResult('Todo aktualisiert.', attachment, '/todos');
      },
    }),

    update_statement: tool({
      description: translateText(
        'generated.inline.ai_update_statement_description',
        'Aktualisiert ein eigenes Statement.'
      ),
      inputSchema: updateStatementSchema,
      execute: async args => {
        const result = await executeZeroTransaction(zeroContext, async (tx, ctx) => {
          const existing = await tx.run(zql.statement.where('id', args.statementId).one());
          if (!existing) throw new Error('Statement not found');
          await runZeroMutator(
            tx,
            serverMutators.statements.update({
              id: args.statementId,
              ...(args.text !== undefined ? { text: args.text } : {}),
              ...(args.imageUrl !== undefined ? { image_url: args.imageUrl } : {}),
              ...(args.videoUrl !== undefined ? { video_url: args.videoUrl } : {}),
              ...(args.visibility !== undefined ? { visibility: args.visibility } : {}),
            }),
            ctx
          );
          if (args.hashtags !== undefined) {
            await syncEntityHashtagsForUpdate(
              tx,
              ctx,
              'statement',
              args.statementId,
              args.hashtags
            );
          }
          const statement = await tx.run(zql.statement.where('id', args.statementId).one());
          if (!statement) throw new Error('Statement not found after update');
          const [tags, group] = await Promise.all([
            hashtagTags(tx, 'statement', statement.id),
            statement.group_id ? tx.run(zql.group.where('id', statement.group_id).one()) : null,
          ]);
          return { statement, tags, group };
        });

        const title = truncate(result.statement.text, 90) || result.statement.title || 'Statement';
        const attachment = buildAttachment(
          'statement',
          result.statement.id,
          title,
          result.statement.visibility,
          truncate(result.statement.text),
          timelineItem({
            id: result.statement.id,
            type: 'statement',
            title,
            description: result.statement.text,
            imageUrl: result.statement.image_url,
            videoUrl: result.statement.video_url,
            createdAt: new Date(result.statement.created_at),
            authorId: result.statement.user_id,
            groupId: result.statement.group_id,
            groupName: result.group?.name,
            commentCount: result.statement.comment_count,
            upvotes: result.statement.upvotes,
            downvotes: result.statement.downvotes,
            tags: result.tags,
          })
        );
        return buildUpdatedResult(
          'Statement aktualisiert.',
          attachment,
          `/statement/${result.statement.id}`
        );
      },
    }),

    update_payment: tool({
      description: translateText(
        'generated.inline.ai_update_payment_description',
        'Aktualisiert die direkten Felder einer verwaltbaren Zahlung.'
      ),
      inputSchema: updatePaymentSchema,
      execute: async args => {
        const payment = await executeZeroTransaction(zeroContext, async (tx, ctx) => {
          const existing = await tx.run(zql.payment.where('id', args.paymentId).one());
          if (!existing) throw new Error('Payment not found');
          await runZeroMutator(
            tx,
            serverMutators.payments.updatePayment({
              id: args.paymentId,
              ...(args.label !== undefined ? { label: args.label } : {}),
              ...(args.type !== undefined ? { type: args.type } : {}),
              ...(args.amount !== undefined ? { amount: args.amount } : {}),
              ...(args.currency !== undefined ? { currency: args.currency } : {}),
            }),
            ctx
          );
          const updated = await tx.run(zql.payment.where('id', args.paymentId).one());
          if (!updated) throw new Error('Payment not found after update');
          return updated;
        });

        const direction = paymentDirection(payment);
        const groupId = payment.receiver_group_id ?? payment.payer_group_id ?? null;
        const currency = (payment.currency ?? 'EUR') as CurrencyCode;
        const attachment = buildAttachment(
          'payment',
          payment.id,
          payment.label ?? 'Payment',
          [
            direction,
            payment.type,
            payment.amount == null ? null : formatCurrency(payment.amount, currency),
          ]
            .filter(Boolean)
            .join(' · ') || null,
          null,
          timelineItem({
            id: payment.id,
            type: 'payment',
            title: payment.label ?? 'Payment',
            createdAt: new Date(payment.created_at),
            amount: payment.amount,
            currency,
            paymentType: payment.type,
            paymentDirection: direction,
            groupId,
          })
        );
        return buildUpdatedResult(
          'Zahlung aktualisiert.',
          attachment,
          groupId ? `/group/${groupId}` : '/'
        );
      },
    }),

    update_agenda_item: tool({
      description: translateText(
        'generated.inline.ai_update_agenda_item_description',
        'Aktualisiert Inhalt, Reihenfolge oder Dauer eines Agenda-Punkts.'
      ),
      inputSchema: updateAgendaItemSchema,
      execute: async args => {
        const result = await executeZeroTransaction(zeroContext, async (tx, ctx) => {
          const existing = await tx.run(zql.agenda_item.where('id', args.agendaItemId).one());
          if (!existing) throw new Error('Agenda item not found');
          await runZeroMutator(
            tx,
            serverMutators.agendas.updateAgendaItem({
              id: args.agendaItemId,
              ...(args.title !== undefined ? { title: args.title } : {}),
              ...(args.description !== undefined ? { description: args.description } : {}),
              ...(args.orderIndex !== undefined ? { order_index: args.orderIndex } : {}),
              ...(args.durationMinutes !== undefined ? { duration: args.durationMinutes } : {}),
            }),
            ctx
          );
          const agendaItem = await tx.run(zql.agenda_item.where('id', args.agendaItemId).one());
          if (!agendaItem) throw new Error('Agenda item not found after update');
          const event = agendaItem.event_id
            ? await tx.run(zql.event.where('id', agendaItem.event_id).one())
            : null;
          return { agendaItem, event };
        });

        const attachment = buildAttachment(
          'agenda_item',
          result.agendaItem.id,
          result.agendaItem.title ?? 'Agenda item',
          [result.agendaItem.type, `#${result.agendaItem.order_index ?? 1}`].join(' · '),
          truncate(result.agendaItem.description),
          timelineItem({
            id: result.agendaItem.id,
            type: 'agenda_item',
            title: result.agendaItem.title ?? 'Agenda item',
            description: result.agendaItem.description,
            createdAt: new Date(result.agendaItem.created_at),
            updatedAt: new Date(result.agendaItem.updated_at),
            status: result.agendaItem.status,
            agendaItemType: result.agendaItem.type,
            orderIndex: result.agendaItem.order_index,
            durationMinutes: result.agendaItem.duration,
            eventId: result.agendaItem.event_id,
            eventName: result.event?.title,
          })
        );
        const route = result.agendaItem.event_id
          ? `/event/${result.agendaItem.event_id}/agenda`
          : `/amendment/${result.agendaItem.amendment_id}`;
        return buildUpdatedResult('Agenda-Punkt aktualisiert.', attachment, route);
      },
    }),

    update_election_candidate: tool({
      description: translateText(
        'generated.inline.ai_update_election_candidate_description',
        'Aktualisiert Name, Statement oder Bild einer eigenen oder verwaltbaren Kandidatur.'
      ),
      inputSchema: updateElectionCandidateSchema,
      execute: async args => {
        const result = await executeZeroTransaction(zeroContext, async (tx, ctx) => {
          const candidate = args.candidateId
            ? await tx.run(zql.election_candidate.where('id', args.candidateId).one())
            : await tx.run(
                zql.election_candidate
                  .where('election_id', args.electionId as string)
                  .where('user_id', args.candidateUserId ?? userId)
                  .one()
              );
          if (!candidate) throw new Error('Election candidate not found');
          await runZeroMutator(
            tx,
            serverMutators.elections.updateCandidate({
              id: candidate.id,
              ...(args.name !== undefined ? { name: args.name } : {}),
              ...(args.statement !== undefined ? { description: args.statement } : {}),
              ...(args.imageUrl !== undefined ? { image_url: args.imageUrl } : {}),
            }),
            ctx
          );
          const updated = await tx.run(zql.election_candidate.where('id', candidate.id).one());
          if (!updated) throw new Error('Election candidate not found after update');
          const election = await tx.run(zql.election.where('id', updated.election_id).one());
          const agendaItem = election?.agenda_item_id
            ? await tx.run(zql.agenda_item.where('id', election.agenda_item_id).one())
            : null;
          return { candidate: updated, election, agendaItem };
        });

        const attachment = buildAttachment(
          'election_candidate',
          result.candidate.id,
          result.candidate.name ||
            (result.election?.title
              ? `Candidate for ${result.election.title}`
              : 'Election candidate'),
          result.candidate.status,
          truncate(result.candidate.description)
        );
        const route = result.agendaItem?.event_id
          ? `/event/${result.agendaItem.event_id}/agenda`
          : `/election/${result.candidate.election_id}`;
        return buildUpdatedResult('Kandidatur aktualisiert.', attachment, route);
      },
    }),
  };
}
