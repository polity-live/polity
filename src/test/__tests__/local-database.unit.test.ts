import { describe, expect, it } from 'vitest';
import { isLocalTestDatabase } from '../local-database';

describe('database integration target selection', () => {
  it('keeps the existing ordinary local target and rejects remote databases', () => {
    expect(isLocalTestDatabase('postgresql://postgres:postgres@localhost:54322/postgres', {})).toBe(
      true
    );
    expect(
      isLocalTestDatabase('postgresql://postgres:postgres@production.example:54322/postgres', {})
    ).toBe(false);
    expect(isLocalTestDatabase('postgresql://postgres:postgres@localhost:15625/postgres', {})).toBe(
      false
    );
  });
  it('requires every alias to match the isolated runner and rejects the development port', () => {
    const database = 'postgresql://postgres:benchmark@127.0.0.1:15625/postgres';
    const environment = {
      ZERO_PERFORMANCE_LAYER: 'integrity',
      ZERO_UPSTREAM_DB: database,
      SUPABASE_URL: 'http://127.0.0.1:15624',
      DATABASE_URL: database,
      SUPABASE_DB_URL: database,
      STUDIO_DATABASE_URL: database,
      STUDIO_TEST_DATABASE_URL: database,
    };
    expect(isLocalTestDatabase(database, environment)).toBe(true);
    expect(isLocalTestDatabase(database.replace('15625', '54322'), environment)).toBe(false);
    for (const name of [
      'DATABASE_URL',
      'SUPABASE_DB_URL',
      'STUDIO_DATABASE_URL',
      'STUDIO_TEST_DATABASE_URL',
    ])
      expect(isLocalTestDatabase(database, { ...environment, [name]: 'development' })).toBe(false);
    expect(
      isLocalTestDatabase(database, { ...environment, SUPABASE_URL: 'https://production.example' })
    ).toBe(false);
  });
  it('accepts only the aligned isolated database ports with matching aliases', () => {
    for (const port of [15625, 15815, 15626, 15615, 15825, 55625]) {
      const database = `postgresql://postgres:benchmark@127.0.0.1:${port}/postgres`;
      const environment = {
        ZERO_PERFORMANCE_LAYER: 'integrity',
        ZERO_UPSTREAM_DB: database,
        SUPABASE_URL: `http://127.0.0.1:${port - 1}`,
        DATABASE_URL: database,
        SUPABASE_DB_URL: database,
        STUDIO_DATABASE_URL: database,
        STUDIO_TEST_DATABASE_URL: database,
      };
      expect(isLocalTestDatabase(database, environment)).toBe([15625, 15815].includes(port));
    }
  });
});
