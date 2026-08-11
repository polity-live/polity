/* @vitest-environment jsdom */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  onboarding: vi.fn(),
  swipeOptions: undefined as any,
  completeOnboarding: vi.fn(),
  nextStep: vi.fn(),
  previousStep: vi.fn(),
  goToStep: vi.fn(),
  saveInterests: vi.fn(),
  sendMembershipRequests: vi.fn(),
  skipMembership: vi.fn(),
}));

vi.mock('@/features/shared/hooks/use-translation.ts', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/hooks/useWizardSwipeNavigation', () => ({
  useWizardSwipeNavigation: (options: unknown) => {
    mocks.swipeOptions = options;
    return { handlers: { 'data-swipe': 'ready' } };
  },
}));
vi.mock('../../hooks/useOnboarding.ts', () => ({ useOnboarding: () => mocks.onboarding() }));

import { useOnboardingWizardController } from '../useOnboardingWizardController';

function state(step: string, overrides: Record<string, unknown> = {}) {
  return {
    step,
    error: null,
    data: {
      firstName: 'Ada',
      lastName: 'Lovelace',
      selectedInterestTags: [],
      selectedGroups: [],
      activeGroupId: null,
      membershipRequestSentGroupIds: [],
    },
    isLoading: false,
    setFirstName: vi.fn(),
    setLastName: vi.fn(),
    setSelectedInterestTags: vi.fn(),
    toggleInterestTag: vi.fn(),
    clearInterestTags: vi.fn(),
    toggleSelectedGroup: vi.fn(),
    setActiveGroupId: vi.fn(),
    clearSelectedGroups: vi.fn(),
    nextStep: mocks.nextStep,
    previousStep: mocks.previousStep,
    goToStep: mocks.goToStep,
    saveInterests: mocks.saveInterests,
    sendMembershipRequests: mocks.sendMembershipRequests,
    skipMembership: mocks.skipMembership,
    completeOnboarding: mocks.completeOnboarding,
    allInterestSuggestions: [],
    ...overrides,
  };
}

function controller(step: string, overrides: Record<string, unknown> = {}) {
  mocks.onboarding.mockReturnValue(state(step, overrides));
  return renderHook(() =>
    useOnboardingWizardController({
      userId: 'user-1',
      userEmail: 'ada@example.com',
      onComplete: vi.fn(),
    })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.completeOnboarding.mockResolvedValue(undefined);
  mocks.saveInterests.mockResolvedValue(true);
  mocks.sendMembershipRequests.mockResolvedValue(true);
});

afterEach(cleanup);

describe('useOnboardingWizardController', () => {
  it('runs direct success and failure handlers', async () => {
    const hook = controller('interests');
    await act(() => hook.result.current.handleNameNext());
    expect(mocks.completeOnboarding).toHaveBeenCalledWith('user-1');
    expect(mocks.nextStep).toHaveBeenCalled();

    vi.clearAllMocks();
    mocks.saveInterests.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    await act(() => hook.result.current.handleInterestsNext());
    expect(mocks.nextStep).not.toHaveBeenCalled();
    await act(() => hook.result.current.handleInterestsNext());
    expect(mocks.nextStep).toHaveBeenCalled();

    vi.clearAllMocks();
    mocks.sendMembershipRequests.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    await act(() => hook.result.current.handleMembershipConfirm());
    expect(mocks.goToStep).not.toHaveBeenCalled();
    await act(() => hook.result.current.handleMembershipConfirm());
    expect(mocks.goToStep).toHaveBeenCalledWith('ariaKai');

    await act(() => hook.result.current.handleGroupNext());
    await act(() => hook.result.current.handleMembershipDecline());
    act(() => hook.result.current.handleAriaKaiNext());
    act(() => hook.result.current.handleAppInstallNext());
    expect(mocks.skipMembership).toHaveBeenCalled();
    expect(mocks.goToStep).toHaveBeenCalledWith('appInstall');
    expect(mocks.goToStep).toHaveBeenCalledWith('summary');
  });

  it.each(['interests', 'groupSearch', 'ariaKai', 'appInstall'])(
    'swipes forward from %s',
    async step => {
      controller(step);
      await act(async () => mocks.swipeOptions.onSwipeNext());
      if (step === 'interests') expect(mocks.saveInterests).toHaveBeenCalled();
      if (step === 'groupSearch') expect(mocks.nextStep).toHaveBeenCalled();
      if (step === 'ariaKai') expect(mocks.goToStep).toHaveBeenCalledWith('appInstall');
      if (step === 'appInstall') expect(mocks.goToStep).toHaveBeenCalledWith('summary');
    }
  );

  it('guards loading, invalid name, unsupported next steps, and previous navigation', async () => {
    controller('name', {
      data: { firstName: 'A', lastName: 'B' },
    });
    expect(mocks.swipeOptions.canSwipeNext).toBe(false);
    act(() => mocks.swipeOptions.onSwipeNext());
    expect(mocks.completeOnboarding).not.toHaveBeenCalled();

    controller('name');
    await act(async () => mocks.swipeOptions.onSwipeNext());
    expect(mocks.completeOnboarding).toHaveBeenCalled();

    vi.clearAllMocks();
    controller('summary');
    act(() => mocks.swipeOptions.onSwipeNext());
    act(() => mocks.swipeOptions.onSwipePrev());
    expect(mocks.previousStep).toHaveBeenCalled();

    vi.clearAllMocks();
    controller('interests', { isLoading: true });
    expect(mocks.swipeOptions.disabled).toBe(true);
    act(() => mocks.swipeOptions.onSwipeNext());
    act(() => mocks.swipeOptions.onSwipePrev());
    expect(mocks.saveInterests).not.toHaveBeenCalled();
    expect(mocks.previousStep).not.toHaveBeenCalled();
  });
});
