import { defineQuery, type QueryRowType } from '@rocicorp/zero';
import { z } from 'zod';
import { zql } from '../schema';

export const aiQueries = {
  skillsByUser: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    zql.ai_skill.where('user_id', userID).orderBy('updated_at', 'desc')
  ),

  toolsByUser: defineQuery(z.object({}), ({ ctx: { userID } }) =>
    zql.ai_tool.where('user_id', userID).orderBy('updated_at', 'desc')
  ),
};

export type AiSkillRow = QueryRowType<typeof aiQueries.skillsByUser>;
export type AiToolRow = QueryRowType<typeof aiQueries.toolsByUser>;
