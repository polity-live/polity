import { defineMutator } from '@rocicorp/zero';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { mutators } from '../mutators';
import { zql } from '../schema';
import { createStatementSchema, updateStatementSchema } from './schema';
import { STATEMENT_STORY_DURATION_MS, cleanStatementString, getStatementHeadline } from './content';

type StatementMutatorInput = Parameters<typeof mutators.statements.create.fn>[0];
type StatementTx = StatementMutatorInput['tx'];
type StatementCtx = StatementMutatorInput['ctx'];

interface StatementTimelineEventInput {
  eventType: 'statement_posted' | 'updated';
  groupId?: string | null;
  expiresAt?: number | null;
  imageUrl?: string | null;
  statementId: string;
  text?: string | null;
  title: string;
  videoUrl?: string | null;
}

function timelineDescription(text: string | null | undefined): string {
  if (!text) return '';
  return text.substring(0, 100) + (text.length > 100 ? '...' : '');
}

async function createStatementTimelineEvent(
  tx: StatementTx,
  ctx: StatementCtx,
  input: StatementTimelineEventInput
) {
  await tx.mutate.timeline_event.insert({
    id: crypto.randomUUID(),
    event_type: input.eventType,
    entity_type: 'statement',
    entity_id: input.statementId,
    actor_id: ctx.userID,
    title: input.title,
    description: timelineDescription(input.text),
    content_type: 'statement',
    metadata: {},
    image_url: input.imageUrl ?? '',
    video_url: input.videoUrl ?? '',
    video_thumbnail_url: '',
    tags: [],
    stats: {},
    vote_status: '',
    election_status: '',
    ends_at: input.expiresAt ?? 0,
    user_id: ctx.userID,
    group_id: input.groupId ?? null,
    amendment_id: null,
    event_id: null,
    todo_id: null,
    blog_id: null,
    statement_id: input.statementId,
    election_id: null,
    amendment_vote_id: null,
    created_at: Date.now(),
  });
}

/** Server-only mutators for statement side effects. */
export const statementServerMutators = {
  create: defineMutator(createStatementSchema, async ({ tx, ctx, args }) => {
    await mutators.statements.create.fn({ tx, ctx, args });

    if (args.visibility !== 'public') return;
    const now = Date.now();
    const isStory = Boolean(args.is_story);
    const expiresAt = isStory ? (args.expires_at ?? now + STATEMENT_STORY_DURATION_MS) : null;

    await createStatementTimelineEvent(tx, ctx, {
      eventType: 'statement_posted',
      statementId: args.id,
      text: args.text,
      groupId: args.group_id,
      expiresAt,
      imageUrl: args.image_url,
      videoUrl: args.video_url,
      title:
        cleanStatementString(args.title) ??
        getStatementHeadline(
          args,
          translateText('generated.inline.0529_new_statement_posted_06a106be')
        ),
    });
  }),

  update: defineMutator(updateStatementSchema, async ({ tx, ctx, args }) => {
    const previousStatement = await tx.run(zql.statement.where('id', args.id).one());

    await mutators.statements.update.fn({ tx, ctx, args });

    if (!previousStatement) return;

    const nextVisibility = args.visibility ?? previousStatement.visibility;
    if (nextVisibility !== 'public') return;
    const nextIsStory = args.is_story ?? previousStatement.is_story;
    const nextExpiresAt = nextIsStory
      ? (args.expires_at ??
        previousStatement.expires_at ??
        Date.now() + STATEMENT_STORY_DURATION_MS)
      : null;
    const nextStatement = {
      title: args.title !== undefined ? args.title : previousStatement.title,
      text: args.text !== undefined ? args.text : previousStatement.text,
      image_url: args.image_url !== undefined ? args.image_url : previousStatement.image_url,
      video_url: args.video_url !== undefined ? args.video_url : previousStatement.video_url,
    };

    await createStatementTimelineEvent(tx, ctx, {
      eventType: 'updated',
      statementId: args.id,
      text: nextStatement.text,
      groupId: args.group_id !== undefined ? args.group_id : previousStatement.group_id,
      expiresAt: nextExpiresAt,
      imageUrl: nextStatement.image_url,
      videoUrl: nextStatement.video_url,
      title:
        cleanStatementString(nextStatement.title) ??
        getStatementHeadline(
          nextStatement,
          translateText('generated.inline.0530_statement_updated_939da7bf')
        ),
    });
  }),
};
