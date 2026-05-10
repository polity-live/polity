import { boolean, number, string, table } from '@rocicorp/zero';

export const pqlFilter = table('pql_filter')
  .columns({
    id: string(),
    user_id: string(),
    group_id: string().optional(),
    storage_key: string(),
    label: string(),
    query: string(),
    is_active: boolean(),
    created_at: number(),
    updated_at: number(),
  })
  .primaryKey('id');
