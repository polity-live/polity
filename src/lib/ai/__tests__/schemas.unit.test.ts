import { describe, expect, it } from 'vitest';

import { aiToolNameSchema } from '../schemas';

describe('ai schemas', () => {
  it('accepts the built-in docs reader tool', () => {
    expect(aiToolNameSchema.parse('read_polity_docs')).toBe('read_polity_docs');
  });
});
