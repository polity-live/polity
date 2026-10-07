import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { userUpdateSchema } from '../schema';

describe('user contact email schema contract', () => {
  it('accepts a nullable public contact email without exposing login email updates', () => {
    expect(userUpdateSchema.parse({ contact_email: 'public@example.test' })).toEqual({
      contact_email: 'public@example.test',
    });
    expect(userUpdateSchema.parse({ contact_email: null })).toEqual({ contact_email: null });
    expect(userUpdateSchema.parse({ email: 'login@example.test' })).toEqual({});
  });

  it('adds an empty nullable column without backfilling login addresses', () => {
    const migration = readFileSync(
      new URL('../../../../supabase/schemas/01_user.sql', import.meta.url),
      'utf8'
    );

    expect(migration).toMatch(/contact_email\s+TEXT\s*,/);
    expect(migration).not.toMatch(/contact_email\s+TEXT\s+(?:NOT NULL|DEFAULT)/i);
    expect(migration).not.toMatch(/SET\s+contact_email\s*=\s*email/i);
  });
});
