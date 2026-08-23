import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260822140000_entity_activity_logs.sql'),
  'utf8'
);

describe('entity activity migration contract', () => {
  it.each(['amendment', 'group', 'event'])('creates and backfills the %s activity log', entity => {
    expect(migration).toContain(`CREATE TABLE public.${entity}_activity`);
    expect(migration).toContain(`CREATE INDEX idx_${entity}_activity_created`);
    expect(migration).toContain(`CREATE INDEX idx_${entity}_activity_severity_created`);
    expect(migration).toContain(`INSERT INTO public.${entity}_activity`);
  });

  it('backfills immutable high-severity creation entries at the original timestamp', () => {
    expect(migration.match(/'created', 'high', created_at FROM/g)).toHaveLength(3);
    expect(migration).toContain("CASE WHEN owner_id IS NULL THEN 'system' ELSE 'user' END");
  });
});
