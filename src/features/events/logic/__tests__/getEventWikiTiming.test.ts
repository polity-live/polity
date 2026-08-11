import { describe, expect, it } from 'vitest';

import { getEventTypeTranslationKey } from '../getEventWikiTiming';

describe('getEventTypeTranslationKey', () => {
  it.each([
    ['delegate_assembly', 'delegateAssembly'],
    ['general_assembly', 'generalAssembly'],
    ['meeting', 'meeting'],
    ['on_invite', 'onInvite'],
    ['open', 'open'],
    ['unknown', 'open'],
    [null, 'open'],
    [undefined, 'open'],
  ])('maps %s to %s', (eventType, expected) => {
    expect(getEventTypeTranslationKey(eventType)).toBe(expected);
  });
});
