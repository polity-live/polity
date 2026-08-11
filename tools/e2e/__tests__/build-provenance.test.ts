import { describe, expect, it } from 'vitest';

import { assertLocalStack, buildProvenance, provenanceRegressions } from '../build-provenance.mjs';

const identity = {
  appOrigin: 'http://localhost:3000',
  supabaseOrigin: 'http://127.0.0.1:54321',
  zeroOrigin: 'http://127.0.0.1:4848',
  commit: 'abc123',
  schemaHash: 'schema123',
};

describe('E2E build provenance', () => {
  it('accepts an exact production-build identity without recording secrets', () => {
    const provenance = buildProvenance(identity);

    expect(provenanceRegressions(provenance, identity)).toEqual([]);
    expect(JSON.stringify(provenance)).not.toMatch(/password|service.role|secret/iu);
  });

  it('reports stack, commit and schema mismatches', () => {
    const provenance = buildProvenance(identity);
    const expected = {
      ...identity,
      supabaseOrigin: 'http://localhost:64321',
      commit: 'def456',
      schemaHash: 'schema456',
    };

    expect(provenanceRegressions(provenance, expected)).toEqual([
      expect.stringContaining('supabaseOrigin mismatch'),
      expect.stringContaining('commit mismatch'),
      expect.stringContaining('schemaHash mismatch'),
    ]);
  });

  it('rejects production and preview origins', () => {
    expect(() =>
      assertLocalStack({ ...identity, appOrigin: 'https://preview.example.test' })
    ).toThrow(/Refusing isolated E2E app origin/u);
    expect(() =>
      assertLocalStack({ ...identity, supabaseOrigin: 'https://project.supabase.co' })
    ).toThrow(/Refusing isolated E2E Supabase origin/u);
  });
});
