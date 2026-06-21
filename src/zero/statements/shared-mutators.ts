import { defineMutator } from '@rocicorp/zero';
import { zql } from '../schema';
import { can } from '../rbac/can';
import { canReadVisibility, requireAuthenticated, requireOwner } from '../rbac/authorize';
import { PermissionError, isPermissionError } from '../rbac/errors';
import {
  createStatementSchema,
  updateStatementSchema,
  deleteStatementSchema,
  createStatementSurveySchema,
  deleteStatementSurveySchema,
  createStatementSurveyOptionSchema,
  deleteStatementSurveyOptionSchema,
  createStatementSurveyVoteSchema,
  deleteStatementSurveyVoteSchema,
} from './schema';
import {
  createStatementSupportVoteSchema,
  updateStatementSupportVoteSchema,
  deleteStatementSupportVoteSchema,
} from '../votes/schema';
import {
  STATEMENT_STORY_DURATION_MS,
  canViewExpiredStatement,
  cleanStatementString,
  deriveStatementMediaType,
  hasStatementContent,
} from './content';

/** Shared mutators — run on both client and server. Server mutators may override these. */
async function loadStatementForSurvey(tx: Parameters<typeof can>[0], surveyId: string) {
  const survey = await tx.run(zql.statement_survey.where('id', surveyId).one());
  if (!survey) return null;
  return tx.run(zql.statement.where('id', survey.statement_id).one());
}

async function loadStatementForSurveyOption(tx: Parameters<typeof can>[0], optionId: string) {
  const option = await tx.run(zql.statement_survey_option.where('id', optionId).one());
  if (!option) return null;
  return loadStatementForSurvey(tx, option.survey_id);
}

async function assertCanViewStatement(
  tx: Parameters<typeof can>[0],
  ctx: Parameters<typeof can>[1],
  statementId: string
) {
  if (tx.location === 'client') return;

  const statement = await tx.run(zql.statement.where('id', statementId).one());
  if (!statement) {
    throw new Error('Statement not found');
  }

  if (statement.user_id === ctx.userID) return;

  if (!canViewExpiredStatement(statement, ctx.userID)) {
    throw new PermissionError('view', 'statements', `statement:${statementId}`);
  }

  if (statement.group_id) {
    try {
      await can(tx, ctx, { action: 'view', resource: 'groups', groupId: statement.group_id });
      if (canReadVisibility(statement.visibility, ctx, true)) return;
    } catch (error) {
      if (!isPermissionError(error)) throw error;
    }
  }

  if (canReadVisibility(statement.visibility, ctx, false)) return;

  throw new PermissionError('view', 'statements', `statement:${statementId}`);
}

async function assertStatementOwner(
  tx: Parameters<typeof can>[0],
  ctx: Parameters<typeof can>[1],
  statementId: string,
  action: 'update' | 'delete'
) {
  if (tx.location === 'client') return null;

  const statement = await tx.run(zql.statement.where('id', statementId).one());
  requireOwner(tx, ctx, statement?.user_id, { action, resource: 'statements' });
  return statement;
}

function normalizeStatementForCreate<
  T extends {
    expires_at?: number | null;
    image_url?: string | null;
    is_story?: boolean | null;
    media_type?: string;
    text?: string | null;
    title?: string | null;
    video_url?: string | null;
  },
>(args: T, now: number) {
  const title = cleanStatementString(args.title);
  const text = cleanStatementString(args.text);
  const imageUrl = cleanStatementString(args.image_url);
  const videoUrl = cleanStatementString(args.video_url);

  if (imageUrl && videoUrl) {
    throw new Error('Statements can include either an image or a video, not both.');
  }

  if (!hasStatementContent({ title, text, image_url: imageUrl, video_url: videoUrl })) {
    throw new Error('Statements require text, title, image, or video content.');
  }

  const isStory = Boolean(args.is_story);

  return {
    ...args,
    title,
    text,
    image_url: imageUrl,
    video_url: videoUrl,
    media_type: deriveStatementMediaType(imageUrl, videoUrl),
    is_story: isStory,
    expires_at: isStory ? (args.expires_at ?? now + STATEMENT_STORY_DURATION_MS) : null,
  };
}

function normalizeStatementForUpdate<
  T extends {
    expires_at?: number | null;
    image_url?: string | null;
    is_story?: boolean | null;
    media_type?: string;
    text?: string | null;
    title?: string | null;
    video_url?: string | null;
  },
>(
  args: T,
  now: number,
  previous?: {
    expires_at?: number | null;
    image_url?: string | null;
    is_story?: boolean | null;
    text?: string | null;
    title?: string | null;
    video_url?: string | null;
  } | null
) {
  const nextTitle =
    args.title !== undefined
      ? cleanStatementString(args.title)
      : cleanStatementString(previous?.title);
  const nextText =
    args.text !== undefined
      ? cleanStatementString(args.text)
      : cleanStatementString(previous?.text);
  const imageUrl =
    args.image_url !== undefined
      ? cleanStatementString(args.image_url)
      : cleanStatementString(previous?.image_url);
  const videoUrl =
    args.video_url !== undefined
      ? cleanStatementString(args.video_url)
      : cleanStatementString(previous?.video_url);
  const isStory =
    args.is_story !== undefined ? Boolean(args.is_story) : Boolean(previous?.is_story);

  if (imageUrl && videoUrl) {
    throw new Error('Statements can include either an image or a video, not both.');
  }

  if (
    previous &&
    !hasStatementContent({
      title: nextTitle,
      text: nextText,
      image_url: imageUrl,
      video_url: videoUrl,
    })
  ) {
    throw new Error('Statements require text, title, image, or video content.');
  }

  return {
    ...args,
    ...(args.title !== undefined && { title: cleanStatementString(args.title) }),
    ...(args.text !== undefined && { text: cleanStatementString(args.text) }),
    ...(args.image_url !== undefined && { image_url: imageUrl }),
    ...(args.video_url !== undefined && { video_url: videoUrl }),
    ...((args.image_url !== undefined || args.video_url !== undefined) && {
      media_type: deriveStatementMediaType(imageUrl, videoUrl),
    }),
    ...(args.is_story !== undefined && {
      is_story: isStory,
      expires_at: isStory
        ? (args.expires_at ?? previous?.expires_at ?? now + STATEMENT_STORY_DURATION_MS)
        : null,
    }),
  };
}

export const statementSharedMutators = {
  // Create a statement
  create: defineMutator(createStatementSchema, async ({ tx, ctx, args }) => {
    const { userID } = ctx;
    requireAuthenticated(tx, ctx, { action: 'create', resource: 'statements' });
    if (args.group_id) {
      await can(tx, ctx, { action: 'view', resource: 'groups', groupId: args.group_id });
    }

    const now = Date.now();
    const normalizedArgs = normalizeStatementForCreate(args, now);
    await tx.mutate.statement.insert({
      ...normalizedArgs,
      user_id: userID,
      upvotes: 0,
      downvotes: 0,
      comment_count: 0,
      updated_at: now,
      created_at: now,
    });
  }),

  // Update a statement
  update: defineMutator(updateStatementSchema, async ({ tx, ctx, args }) => {
    const previousStatement = await assertStatementOwner(tx, ctx, args.id, 'update');
    if (args.group_id) {
      await can(tx, ctx, { action: 'view', resource: 'groups', groupId: args.group_id });
    }

    const normalizedArgs = normalizeStatementForUpdate(args, Date.now(), previousStatement);
    await tx.mutate.statement.update({
      ...normalizedArgs,
      updated_at: Date.now(),
    });
  }),

  // Delete a statement
  delete: defineMutator(deleteStatementSchema, async ({ tx, ctx, args }) => {
    await assertStatementOwner(tx, ctx, args.id, 'delete');
    await tx.mutate.statement.delete({ id: args.id });
  }),

  // Survey mutators
  createSurvey: defineMutator(createStatementSurveySchema, async ({ tx, ctx, args }) => {
    await assertStatementOwner(tx, ctx, args.statement_id, 'update');
    const now = Date.now();
    await tx.mutate.statement_survey.insert({
      ...args,
      created_at: now,
    });
  }),

  deleteSurvey: defineMutator(deleteStatementSurveySchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const statement = await loadStatementForSurvey(tx, args.id);
      requireOwner(tx, ctx, statement?.user_id, { action: 'delete', resource: 'statementSurveys' });
    }

    await tx.mutate.statement_survey.delete({ id: args.id });
  }),

  // Survey option mutators
  createSurveyOption: defineMutator(
    createStatementSurveyOptionSchema,
    async ({ tx, ctx, args }) => {
      if (tx.location !== 'client') {
        const statement = await loadStatementForSurvey(tx, args.survey_id);
        requireOwner(tx, ctx, statement?.user_id, {
          action: 'update',
          resource: 'statementSurveys',
        });
      }

      const now = Date.now();
      await tx.mutate.statement_survey_option.insert({
        ...args,
        vote_count: 0,
        created_at: now,
      });
    }
  ),

  deleteSurveyOption: defineMutator(
    deleteStatementSurveyOptionSchema,
    async ({ tx, ctx, args }) => {
      if (tx.location !== 'client') {
        const statement = await loadStatementForSurveyOption(tx, args.id);
        requireOwner(tx, ctx, statement?.user_id, {
          action: 'delete',
          resource: 'statementSurveys',
        });
      }

      await tx.mutate.statement_survey_option.delete({ id: args.id });
    }
  ),

  // Survey vote mutators
  createSurveyVote: defineMutator(createStatementSurveyVoteSchema, async ({ tx, ctx, args }) => {
    const { userID } = ctx;
    requireAuthenticated(tx, ctx, { action: 'vote', resource: 'statementSurveyVotes' });
    if (tx.location !== 'client') {
      const statement = await loadStatementForSurveyOption(tx, args.option_id);
      if (!statement) throw new Error('Statement survey option not found');
      await assertCanViewStatement(tx, ctx, statement.id);
    }

    const now = Date.now();
    await tx.mutate.statement_survey_vote.insert({
      ...args,
      user_id: userID,
      created_at: now,
    });
  }),

  deleteSurveyVote: defineMutator(deleteStatementSurveyVoteSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const vote = await tx.run(zql.statement_survey_vote.where('id', args.id).one());
      requireOwner(tx, ctx, vote?.user_id, {
        action: 'delete',
        resource: 'statementSurveyVotes',
      });
    }

    await tx.mutate.statement_survey_vote.delete({ id: args.id });
  }),

  // Support vote mutators
  createSupportVote: defineMutator(createStatementSupportVoteSchema, async ({ tx, ctx, args }) => {
    const { userID } = ctx;
    requireAuthenticated(tx, ctx, { action: 'vote', resource: 'statements' });
    await assertCanViewStatement(tx, ctx, args.statement_id);
    const now = Date.now();
    await tx.mutate.statement_support_vote.insert({
      ...args,
      user_id: userID,
      created_at: now,
    });
  }),

  updateSupportVote: defineMutator(updateStatementSupportVoteSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const vote = await tx.run(zql.statement_support_vote.where('id', args.id).one());
      requireOwner(tx, ctx, vote?.user_id, { action: 'update', resource: 'statements' });
    }

    await tx.mutate.statement_support_vote.update(args);
  }),

  deleteSupportVote: defineMutator(deleteStatementSupportVoteSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const vote = await tx.run(zql.statement_support_vote.where('id', args.id).one());
      requireOwner(tx, ctx, vote?.user_id, { action: 'delete', resource: 'statements' });
    }

    await tx.mutate.statement_support_vote.delete({ id: args.id });
  }),
};
