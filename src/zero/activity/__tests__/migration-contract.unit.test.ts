import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const schemas = {
  amendment: '05_2_amendment.sql',
  group: '02_group.sql',
  event: '03_event.sql',
};

describe('entity activity migration contract', () => {
  it.each(['amendment', 'group', 'event'] as const)(
    'creates the %s activity log in the reset schema',
    entity => {
      const migration = readFileSync(
        resolve(process.cwd(), 'supabase/schemas', schemas[entity]),
        'utf8'
      );
      expect(migration).toContain(`CREATE TABLE public.${entity}_activity`);
      expect(migration).toContain(`CREATE INDEX idx_${entity}_activity_created`);
      expect(migration).toContain(`CREATE INDEX idx_${entity}_activity_severity_created`);
      expect(migration).toContain('severity');
    }
  );

  it('retains actor, severity and original timestamp fields for immutable activity entries', () => {
    for (const schema of Object.values(schemas)) {
      const source = readFileSync(resolve(process.cwd(), 'supabase/schemas', schema), 'utf8');
      const activity = source.match(/CREATE TABLE public\.\w+_activity\s*\(([\s\S]*?)\n\);/)?.[1];
      expect(activity).toBeDefined();
      expect(activity).toContain('actor_type');
      expect(activity).toContain('severity');
      expect(activity).toContain('created_at');
    }
  });
});
