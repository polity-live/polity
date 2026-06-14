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

export const statementSharedMutators = {
  // Create a statement
  create: defineMutator(createStatementSchema, async ({ tx, ctx, args }) => {
    const { userID } = ctx;
    requireAuthenticated(tx, ctx, { action: 'create', resource: 'statements' });
    if (args.group_id) {
      await can(tx, ctx, { action: 'view', resource: 'groups', groupId: args.group_id });
    }

    const now = Date.now();
    await tx.mutate.statement.insert({
      ...args,
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
    await assertStatementOwner(tx, ctx, args.id, 'update');
    if (args.group_id) {
      await can(tx, ctx, { action: 'view', resource: 'groups', groupId: args.group_id });
    }

    await tx.mutate.statement.update({
      ...args,
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
