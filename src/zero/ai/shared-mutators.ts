import { defineMutator } from '@rocicorp/zero';
import { createAiSkillSchema, updateAiSkillSchema, deleteAiSkillSchema } from './schema';

export const aiSharedMutators = {
  createSkill: defineMutator(createAiSkillSchema, async ({ tx, ctx: { userID }, args }) => {
    const now = Date.now();
    await tx.mutate.ai_skill.insert({
      ...args,
      aliases: args.aliases ?? '',
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
};
