import { describe, expect, it } from 'vitest';

import { ARIA_KAI_AVATAR_URL, ARIA_KAI_USER_ID } from '../../constants';
import { resolveAssistantAvatar } from '../assistantHelpers';

describe('resolveAssistantAvatar', () => {
  it('returns the canonical avatar for Aria & Kai regardless of the stored value', () => {
    expect(resolveAssistantAvatar(ARIA_KAI_USER_ID, null)).toBe(ARIA_KAI_AVATAR_URL);
    expect(resolveAssistantAvatar(ARIA_KAI_USER_ID, 'https://example.test/old-avatar.png')).toBe(
      ARIA_KAI_AVATAR_URL
    );
  });

  it('preserves avatar values for regular users', () => {
    expect(resolveAssistantAvatar('regular-user', 'https://example.test/avatar.png')).toBe(
      'https://example.test/avatar.png'
    );
    expect(resolveAssistantAvatar('regular-user', null)).toBeNull();
    expect(resolveAssistantAvatar(undefined, undefined)).toBeUndefined();
  });
});
