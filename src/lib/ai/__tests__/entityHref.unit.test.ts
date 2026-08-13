import { describe, expect, it } from 'vitest';

import { buildAiEntityHref } from '../entityHref';

describe('buildAiEntityHref', () => {
  it.each(['group', 'user', 'statement', 'event', 'blog', 'amendment'] as const)(
    'builds an encoded %s href',
    entityType => {
      expect(buildAiEntityHref(entityType, 'id with/slash')).toBe(
        `/${entityType}/id%20with%2Fslash`
      );
    }
  );

  it('uses the shared todo destination', () => {
    expect(buildAiEntityHref('todo', 'ignored')).toBe('/todos');
  });

  it('returns null for an unsupported runtime value', () => {
    expect(buildAiEntityHref('unknown' as never, 'id')).toBeNull();
  });
});
