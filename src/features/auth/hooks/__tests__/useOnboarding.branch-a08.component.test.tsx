/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: { id: 'user-1' } as { id: string } | null,
  updateProfile: vi.fn(),
  joinGroup: vi.fn(),
  syncEntityHashtags: vi.fn(),
  commonState: {
    allHashtags: [] as unknown[] | undefined,
    userHashtags: [] as unknown[] | undefined,
    onboardingHashtagUsage: [] as unknown[] | undefined,
  },
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/zero/users/useUserActions', () => ({
  useUserActions: () => ({ updateProfileServerConfirmed: mocks.updateProfile }),
}));
vi.mock('@/zero/groups/useGroupActions', () => ({
  useGroupActions: () => ({ joinGroup: mocks.joinGroup }),
}));
vi.mock('@/zero/common', () => ({
  useCommonActions: () => ({ syncEntityHashtags: mocks.syncEntityHashtags }),
  useCommonState: () => mocks.commonState,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { count?: number }) =>
      values?.count === undefined ? key : `${key}:${values.count}`,
  }),
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));

import {
  getOnboardingStorage,
  initialOnboardingData,
  initialOnboardingStep,
  persistOnboardingProgress,
  useOnboarding,
  type Group,
} from '../useOnboarding';

const alpha: Group = {
  id: 'alpha',
  name: 'Alpha',
  member_count: 5,
  visibility: 'public',
};
const beta: Group = {
  id: 'beta',
  name: 'Beta',
  member_count: 8,
  visibility: 'public',
};

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  mocks.user = { id: 'user-1' };
  mocks.commonState.allHashtags = [];
  mocks.commonState.userHashtags = [];
  mocks.commonState.onboardingHashtagUsage = [];
  mocks.updateProfile.mockResolvedValue(undefined);
  mocks.joinGroup.mockResolvedValue(undefined);
  mocks.syncEntityHashtags.mockResolvedValue(undefined);
});

describe('useOnboarding local state and navigation', () => {
  it('normalizes, deduplicates and limits interests while preserving display spelling', () => {
    const { result } = renderHook(() => useOnboarding());

    act(() =>
      result.current.setSelectedInterestTags([
        '',
        ' #Climate ',
        'climate',
        'Housing',
        'Mobility',
        'Culture',
        'Health',
        'Education',
        'Energy',
        'Nature',
        'Overflow',
      ])
    );

    expect(result.current.data.selectedInterestTags).toEqual([
      'Climate',
      'Housing',
      'Mobility',
      'Culture',
      'Health',
      'Education',
      'Energy',
      'Nature',
    ]);
    act(() => result.current.toggleInterestTag('  #  '));
    expect(result.current.data.selectedInterestTags).toHaveLength(8);
    act(() => result.current.toggleInterestTag('#climate'));
    expect(result.current.data.selectedInterestTags).not.toContain('Climate');
    act(() => result.current.toggleInterestTag('Participation'));
    expect(result.current.data.selectedInterestTags).toContain('Participation');
    act(() => result.current.clearInterestTags());
    expect(result.current.data.selectedInterestTags).toEqual([]);
  });

  it('selects, activates and removes groups without retaining stale request state', async () => {
    const { result } = renderHook(() => useOnboarding());
    act(() => {
      result.current.toggleSelectedGroup(alpha);
      result.current.toggleSelectedGroup(beta);
    });
    await act(async () => {
      await result.current.sendMembershipRequests();
    });
    expect(result.current.data).toMatchObject({
      activeGroupId: 'beta',
      membershipRequestSentGroupIds: ['alpha', 'beta'],
    });

    act(() => result.current.toggleSelectedGroup(beta));
    expect(result.current.data).toMatchObject({
      selectedGroups: [alpha],
      activeGroupId: 'alpha',
      membershipRequestSentGroupIds: ['alpha'],
    });
    act(() => result.current.toggleSelectedGroup(alpha));
    expect(result.current.data).toMatchObject({
      selectedGroups: [],
      activeGroupId: null,
      membershipRequestSentGroupIds: [],
    });
  });

  it('supports explicit activation and clearing the complete selection', () => {
    const { result } = renderHook(() => useOnboarding());
    act(() => result.current.toggleSelectedGroup(alpha));
    act(() => result.current.setActiveGroupId(null));
    expect(result.current.data.activeGroupId).toBeNull();
    act(() => result.current.clearSelectedGroups());
    expect(result.current.data).toMatchObject({
      selectedGroups: [],
      activeGroupId: null,
      membershipRequestSentGroupIds: [],
    });
  });

  it('follows forward and backward step rules with and without selected groups', () => {
    const { result } = renderHook(() => useOnboarding());
    act(() => result.current.previousStep());
    expect(result.current.step).toBe('name');

    act(() => result.current.goToStep('groupSearch'));
    act(() => result.current.nextStep());
    expect(result.current.step).toBe('ariaKai');
    act(() => result.current.previousStep());
    expect(result.current.step).toBe('groupSearch');

    act(() => result.current.toggleSelectedGroup(alpha));
    act(() => result.current.nextStep());
    expect(result.current.step).toBe('confirm');
    act(() => result.current.previousStep());
    expect(result.current.step).toBe('groupSearch');

    act(() => result.current.goToStep('summary'));
    act(() => result.current.nextStep());
    expect(result.current.step).toBe('summary');
    act(() => result.current.previousStep());
    expect(result.current.step).toBe('appInstall');
    act(() => result.current.skipMembership());
    expect(result.current.step).toBe('ariaKai');
  });
});

describe('useOnboarding persistence boundaries', () => {
  it('ignores saved progress without the onboarding marker', () => {
    sessionStorage.setItem('polity_onboarding_step', 'summary');
    sessionStorage.setItem('polity_onboarding_data', JSON.stringify({ firstName: 'Ignored' }));

    const { result } = renderHook(() => useOnboarding());

    expect(result.current.step).toBe('name');
    expect(result.current.data.firstName).toBe('');
  });

  it('hydrates valid saved progress and persists subsequent changes', () => {
    sessionStorage.setItem('polity_onboarding', 'true');
    sessionStorage.setItem('polity_onboarding_step', 'confirm');
    sessionStorage.setItem(
      'polity_onboarding_data',
      JSON.stringify({
        firstName: 'Ada',
        lastName: 'Lovelace',
        selectedInterestTags: ['climate'],
        selectedGroups: [alpha],
        activeGroupId: alpha.id,
        membershipRequestSentGroupIds: [alpha.id],
      })
    );

    const { result } = renderHook(() => useOnboarding());
    expect(result.current).toMatchObject({
      step: 'confirm',
      data: {
        firstName: 'Ada',
        selectedInterestTags: ['climate'],
        selectedGroups: [alpha],
      },
    });

    act(() => result.current.setFirstName('Grace'));
    expect(JSON.parse(sessionStorage.getItem('polity_onboarding_data') ?? '{}')).toMatchObject({
      firstName: 'Grace',
      activeGroupId: alpha.id,
    });
  });

  it('falls back safely for invalid steps, malformed JSON and sparse collection fields', () => {
    sessionStorage.setItem('polity_onboarding', 'true');
    sessionStorage.setItem('polity_onboarding_step', 'not-a-step');
    sessionStorage.setItem('polity_onboarding_data', '{');
    expect(initialOnboardingStep(sessionStorage)).toBe('name');
    expect(initialOnboardingData(sessionStorage).firstName).toBe('');

    sessionStorage.removeItem('polity_onboarding_data');
    expect(initialOnboardingData(sessionStorage).firstName).toBe('');
    sessionStorage.setItem('polity_onboarding_data', JSON.stringify('invalid'));
    expect(initialOnboardingData(sessionStorage).firstName).toBe('');

    sessionStorage.setItem(
      'polity_onboarding_data',
      JSON.stringify({
        firstName: 'Ada',
        selectedInterestTags: 'climate',
        selectedGroups: null,
        membershipRequestSentGroupIds: {},
      })
    );
    expect(initialOnboardingData(sessionStorage)).toMatchObject({
      firstName: 'Ada',
      selectedInterestTags: [],
      selectedGroups: [],
      membershipRequestSentGroupIds: [],
    });
  });

  it('supports server rendering and marker-free persistence without storage writes', () => {
    const empty = initialOnboardingData(null);
    expect(initialOnboardingStep(null)).toBe('name');
    expect(empty.firstName).toBe('');

    persistOnboardingProgress(null, 'summary', empty);
    persistOnboardingProgress(sessionStorage, 'summary', empty);
    expect(sessionStorage.getItem('polity_onboarding_step')).toBeNull();

    vi.stubGlobal('window', undefined);
    expect(getOnboardingStorage()).toBeNull();
    vi.unstubAllGlobals();
  });

  it('validates both required names and minimum lengths before continuing', async () => {
    const { result } = renderHook(() => useOnboarding());

    await act(async () => expect(result.current.submitName()).resolves.toBe(false));
    expect(result.current.error).toBe('features.auth.errors.fillBothFields');
    act(() => result.current.setFirstName('A'));
    act(() => result.current.setLastName('Lovelace'));
    await act(async () => expect(result.current.submitName()).resolves.toBe(false));
    expect(result.current.error).toBe('features.auth.errors.nameTooShort');
    act(() => result.current.setFirstName('Ada'));
    await act(async () => expect(result.current.submitName()).resolves.toBe(true));
    expect(result.current.error).toBeNull();
  });

  it('treats an empty interest selection as an intentional skip', async () => {
    const { result } = renderHook(() => useOnboarding());

    await act(async () => expect(result.current.saveInterests()).resolves.toBe(true));
    expect(mocks.syncEntityHashtags).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it('requires an authenticated user before saving interests', async () => {
    mocks.user = null;
    const { result } = renderHook(() => useOnboarding());
    act(() => result.current.toggleInterestTag('climate'));

    await act(async () => expect(result.current.saveInterests()).resolves.toBe(false));
    expect(result.current.error).toBe('features.auth.errors.interestsSaveFailed');
  });

  it('synchronizes interests with empty and populated Zero collections', async () => {
    mocks.commonState.allHashtags = undefined;
    mocks.commonState.userHashtags = undefined;
    mocks.commonState.onboardingHashtagUsage = undefined;
    const { result } = renderHook(() => useOnboarding());
    act(() => result.current.toggleInterestTag('climate'));
    await act(async () => expect(result.current.saveInterests()).resolves.toBe(true));
    expect(mocks.syncEntityHashtags).toHaveBeenLastCalledWith(
      'user',
      'user-1',
      ['climate'],
      [],
      []
    );

    mocks.commonState.allHashtags = [{ id: 'h-1', tag: 'climate' }];
    mocks.commonState.userHashtags = [{ id: 'uh-1', hashtag_id: 'h-1' }];
    const populated = renderHook(() => useOnboarding());
    act(() => populated.result.current.toggleInterestTag('climate'));
    await act(async () => expect(populated.result.current.saveInterests()).resolves.toBe(true));
    expect(mocks.syncEntityHashtags).toHaveBeenLastCalledWith(
      'user',
      'user-1',
      ['climate'],
      mocks.commonState.userHashtags,
      mocks.commonState.allHashtags
    );
  });

  it('reports interest synchronization failures and always leaves loading state', async () => {
    mocks.syncEntityHashtags.mockRejectedValue(new Error('write conflict'));
    const { result } = renderHook(() => useOnboarding());
    act(() => result.current.toggleInterestTag('climate'));

    await act(async () => expect(result.current.saveInterests()).resolves.toBe(false));
    expect(result.current).toMatchObject({
      isLoading: false,
      error: 'features.auth.errors.interestsSaveFailed',
    });
    expect(mocks.toastError).toHaveBeenCalledWith('features.auth.errors.interestsSaveFailed');
  });

  it('does not send membership requests without a selection', async () => {
    const { result } = renderHook(() => useOnboarding());
    await act(async () => expect(result.current.sendMembershipRequests()).resolves.toBe(false));
    expect(mocks.joinGroup).not.toHaveBeenCalled();
  });

  it('requires authentication for membership requests', async () => {
    mocks.user = null;
    const { result } = renderHook(() => useOnboarding());
    act(() => result.current.toggleSelectedGroup(alpha));

    await act(async () => expect(result.current.sendMembershipRequests()).resolves.toBe(false));
    expect(result.current.error).toBe('features.auth.errors.membershipRequestFailed');
    expect(mocks.toastError).toHaveBeenCalledWith('features.auth.errors.membershipRequestFailed');
  });

  it('retains successful requests and retries only prior failures', async () => {
    mocks.joinGroup
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Beta temporarily unavailable'))
      .mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useOnboarding());
    act(() => {
      result.current.toggleSelectedGroup(alpha);
      result.current.toggleSelectedGroup(beta);
    });

    await act(async () => expect(result.current.sendMembershipRequests()).resolves.toBe(false));
    expect(result.current.data.membershipRequestSentGroupIds).toEqual(['alpha']);
    expect(result.current.error).toBe('features.auth.errors.membershipRequestsPartialFailed');

    await act(async () => expect(result.current.sendMembershipRequests()).resolves.toBe(true));
    expect(mocks.joinGroup).toHaveBeenCalledTimes(3);
    expect(mocks.joinGroup).toHaveBeenLastCalledWith(
      expect.objectContaining({ group_id: 'beta', status: 'requested' })
    );
    expect(result.current.data.membershipRequestSentGroupIds).toEqual(['alpha', 'beta']);
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      'features.auth.success.membershipRequestsSent:2'
    );
  });

  it('requires an explicit user id to complete onboarding', async () => {
    const { result } = renderHook(() => useOnboarding());
    await expect(result.current.completeOnboarding('')).rejects.toThrow(
      'Missing user ID for onboarding completion'
    );
    expect(mocks.updateProfile).not.toHaveBeenCalled();
  });

  it('persists trimmed profile names on completion', async () => {
    const { result } = renderHook(() => useOnboarding());
    act(() => result.current.setFirstName(' Ada '));
    act(() => result.current.setLastName(' Lovelace '));

    await act(async () => result.current.completeOnboarding('user-1'));

    expect(mocks.updateProfile).toHaveBeenCalledWith({ first_name: 'Ada', last_name: 'Lovelace' });
    expect(result.current).toMatchObject({ isLoading: false, error: null });
  });

  it('preserves profile update failures for the caller while showing recoverable state', async () => {
    const failure = new Error('profile write failed');
    mocks.updateProfile.mockRejectedValue(failure);
    const { result } = renderHook(() => useOnboarding());

    await act(async () => {
      await expect(result.current.completeOnboarding('user-1')).rejects.toBe(failure);
    });
    expect(result.current).toMatchObject({
      isLoading: false,
      error: 'features.auth.errors.profileUpdateFailed',
    });
  });
});
