import { table, string, number } from '@rocicorp/zero';

export const aiSkill = table('ai_skill')
  .columns({
    id: string(),
    user_id: string(),
    slug: string(),
    name: string(),
    aliases: string().optional(),
    system_prompt: string(),
    created_at: number(),
    updated_at: number(),
  })
  .primaryKey('id');
