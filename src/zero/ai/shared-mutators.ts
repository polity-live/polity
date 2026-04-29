import { defineMutator } from '@rocicorp/zero';
import {
  createAiSkillSchema,
  updateAiSkillSchema,
  deleteAiSkillSchema,
  createAiToolSchema,
  updateAiToolSchema,
} from './schema';

export const aiSharedMutators = {
  createSkill: defineMutator(createAiSkillSchema, async ({ tx, ctx: { userID }, args }) => {
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

  updateSkill: defineMutator(updateAiSkillSchema, async ({ tx, args }) => {
    const { id, ...fields } = args;
    await tx.mutate.ai_skill.update({
      id,
      ...fields,
      updated_at: Date.now(),
    });
  }),

  deleteSkill: defineMutator(deleteAiSkillSchema, async ({ tx, args }) => {
    await tx.mutate.ai_skill.delete({ id: args.id });
  }),

  createTool: defineMutator(createAiToolSchema, async ({ tx, ctx: { userID }, args }) => {
    const now = Date.now();
    await tx.mutate.ai_tool.insert({
      ...args,
      enabled: args.enabled ?? true,
      user_id: userID,
      created_at: now,
      updated_at: now,
    });
  }),

  updateTool: defineMutator(updateAiToolSchema, async ({ tx, args }) => {
    const { id, ...fields } = args;
    await tx.mutate.ai_tool.update({
      id,
      ...fields,
      updated_at: Date.now(),
    });
  }),
};
