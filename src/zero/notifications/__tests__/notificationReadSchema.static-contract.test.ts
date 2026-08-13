import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('notification_read schema', () => {
  it('tracks entity read state per user', () => {
    const schema = readFileSync(
      resolve(process.cwd(), 'supabase/schemas/10_notification.sql'),
      'utf8'
    );

    expect(schema).toContain('CONSTRAINT notification_read_per_user_key UNIQUE');
    expect(schema).toContain('read_by_user_id');
    expect(schema).toMatch(/notification_id,\s*entity_type,\s*entity_id,\s*read_by_user_id/);
  });
});
