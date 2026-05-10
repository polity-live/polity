import { defineQuery, type QueryRowType } from '@rocicorp/zero';
import { z } from 'zod';
import { zql } from '../schema';

const pqlFilterScopeSchema = z.object({
  storage_key: z.string(),
  group_id: z.string().nullable().optional(),
});

export const pqlQueries = {
  byScope: defineQuery(
    pqlFilterScopeSchema,
    ({ ctx: { userID }, args: { storage_key, group_id } }) => {
      const baseQuery = zql.pql_filter.where('user_id', userID).where('storage_key', storage_key);

      return (
        group_id ? baseQuery.where('group_id', group_id) : baseQuery.where('group_id', 'IS', null)
      ).orderBy('updated_at', 'desc');
    }
  ),
};

export type StoredPqlFilterRow = QueryRowType<typeof pqlQueries.byScope>;
