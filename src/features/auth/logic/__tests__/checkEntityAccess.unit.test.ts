import { describe, expect, it } from 'vitest';

import { checkEntityAccess } from '../checkEntityAccess';

describe('checkEntityAccess', () => {
  it.each([
    ['public', false, false, true],
    [null, false, false, true],
    [undefined, false, false, true],
    ['authenticated', true, false, true],
    ['authenticated', false, true, false],
    ['private', true, true, true],
    ['private', true, false, false],
    ['unknown', false, true, true],
    ['unknown', true, false, false],
  ] as const)('evaluates visibility %s', (visibility, authenticated, related, expected) => {
    expect(checkEntityAccess(visibility, authenticated, related)).toBe(expected);
  });
});
