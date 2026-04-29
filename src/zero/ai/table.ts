import { table, string, number, boolean } from '@rocicorp/zero';

export const aiSkill = table('ai_skill')
  .columns({
    id: string(),
    user_id: string(),
    slug: string(),
    name: string(),
    aliases: string().optional(),
    system_prompt: string(),
    enabled: boolean(),
    created_at: number(),
    updated_at: number(),
  })
  .primaryKey('id');

export const aiTool = table('ai_tool')
  .columns({
    id: string(),
    user_id: string(),
    tool_name: string(),
    enabled: boolean(),
    created_at: number(),
    updated_at: number(),
  })
  .primaryKey('id');
