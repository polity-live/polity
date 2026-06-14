import { defineMutator } from '@rocicorp/zero';
import {
  createAiSkillSchema,
  updateAiSkillSchema,
  deleteAiSkillSchema,
  createAiToolSchema,
  updateAiToolSchema,
} from './schema';
import { zql } from '../schema';
import { requireAuthenticated, requireOwner } from '../rbac/authorize';

export const aiSharedMutators = {
  createSkill: defineMutator(createAiSkillSchema, async ({ tx, ctx, args }) => {
    const { userID } = ctx;
    requireAuthenticated(tx, ctx, { action: 'create', resource: 'aiSkills' });
    const now = Date.now();
    await tx.mutate.ai_skill.insert({
      ...args,
      aliases: args.aliases ?? '',
      enabled: args.enabled ?? true,
      user_id: userID,
      created_at: now,
      updated_at: now,
    });
  }),

  updateSkill: defineMutator(updateAiSkillSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const skill = await tx.run(zql.ai_skill.where('id', args.id).one());
      requireOwner(tx, ctx, skill?.user_id, { action: 'update', resource: 'aiSkills' });
    }

    const { id, ...fields } = args;
    await tx.mutate.ai_skill.update({
      id,
      ...fields,
      updated_at: Date.now(),
    });
  }),

  deleteSkill: defineMutator(deleteAiSkillSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const skill = await tx.run(zql.ai_skill.where('id', args.id).one());
      requireOwner(tx, ctx, skill?.user_id, { action: 'delete', resource: 'aiSkills' });
    }

    await tx.mutate.ai_skill.delete({ id: args.id });
  }),

  createTool: defineMutator(createAiToolSchema, async ({ tx, ctx, args }) => {
    const { userID } = ctx;
    requireAuthenticated(tx, ctx, { action: 'create', resource: 'aiTools' });
    const now = Date.now();
    await tx.mutate.ai_tool.insert({
      ...args,
      enabled: args.enabled ?? true,
      user_id: userID,
      created_at: now,
      updated_at: now,
    });
  }),

  updateTool: defineMutator(updateAiToolSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const tool = await tx.run(zql.ai_tool.where('id', args.id).one());
      requireOwner(tx, ctx, tool?.user_id, { action: 'update', resource: 'aiTools' });
    }

    const { id, ...fields } = args;
    await tx.mutate.ai_tool.update({
      id,
      ...fields,
      updated_at: Date.now(),
    });
  }),
};
