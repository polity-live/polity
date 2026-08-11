import { describe, expect, it } from 'vitest';

import { getEventTypeTranslationKey } from '../getEventTypeTranslationKey';

describe('getEventTypeTranslationKey', () => {
  it.each([
    ['delegate_assembly', 'delegateAssembly'],
    ['general_assembly', 'generalAssembly'],
    ['meeting', 'meeting'],
    ['on_invite', 'onInvite'],
    ['open', 'open'],
    [undefined, 'open'],
  ] as const)('maps %s to %s', (eventType, expected) => {
    expect(getEventTypeTranslationKey(eventType)).toBe(expected);
  });
});
