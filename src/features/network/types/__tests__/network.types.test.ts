import { describe, expect, it } from 'vitest';

import { normalizeGroupRelationship, type NormalizedGroupRelationship } from '../network.types';

describe('normalizeGroupRelationship', () => {
  it('preserves the canonical relationship identity', () => {
    const relationship = { id: 'relationship-1' } as NormalizedGroupRelationship;
    expect(normalizeGroupRelationship(relationship)).toBe(relationship);
  });
});
