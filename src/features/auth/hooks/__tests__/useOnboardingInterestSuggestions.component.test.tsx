/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useCommonState: vi.fn(),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('@/zero/users/useUserActions', () => ({
  useUserActions: () => ({ updateProfileClientApplied: vi.fn() }),
}));

vi.mock('@/zero/groups/useGroupActions', () => ({
  useGroupActions: () => ({ joinGroup: vi.fn() }),
}));

vi.mock('@/zero/common', () => ({
  useCommonActions: () => ({ syncEntityHashtags: vi.fn() }),
  useCommonState: mocks.useCommonState,
}));

vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { useOnboarding } from '../useOnboarding';

describe('useOnboarding interest suggestions', () => {
  beforeEach(() => {
    mocks.useCommonState.mockReset();
    mocks.useCommonState.mockReturnValue({
      allHashtags: [{ id: 'tag-1', tag: 'existing' }],
      userHashtags: [],
      onboardingHashtagUsage: [
        { tag: 'climate', event_hashtags: [{ id: 'event-tag-1' }] },
        { tag: 'housing', user_hashtags: [{ id: 'user-tag-1' }, { id: 'user-tag-2' }] },
      ],
    });
  });

  it('enables the dedicated Zero usage query without changing canonical hashtag loading', () => {
    const { result } = renderHook(() => useOnboarding());

    expect(mocks.useCommonState).toHaveBeenCalledWith({
      user_id: 'user-1',
      loadAllHashtags: true,
      loadOnboardingHashtagUsage: true,
    });
    expect(result.current.allInterestSuggestions).toEqual(['housing', 'climate']);
  });
});
