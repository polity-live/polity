/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Group, OnboardingData, OnboardingStep } from '../../hooks/useOnboarding.ts';

const wizardMocks = vi.hoisted(() => ({
  completeOnboarding: vi.fn(),
  goToStep: vi.fn(),
  navigate: vi.fn(),
  nextStep: vi.fn(),
  onComplete: vi.fn(),
  previousStep: vi.fn(),
  saveInterests: vi.fn(),
  sendMembershipRequests: vi.fn(),
  skipMembership: vi.fn(),
  useOnboarding: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => wizardMocks.navigate,
}));

vi.mock('@/features/shared/hooks/use-translation.ts', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../hooks/useOnboarding.ts', () => ({
  useOnboarding: () => wizardMocks.useOnboarding(),
}));

import { useOnboardingWizardController } from '../useOnboardingWizardController';

const selectedGroup: Group = {
  id: 'group-1',
  name: 'Alpha Group',
  member_count: 12,
  visibility: 'public',
};

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
  window.dispatchEvent(new Event('resize'));
}

function buildOnboardingState({
  step,
  data = {},
  isLoading = false,
}: {
  step: OnboardingStep;
  data?: Partial<OnboardingData>;
  isLoading?: boolean;
}) {
  return {
    step,
    error: null,
    data: {
      ...baseOnboardingData(),
      ...data,
    },
    isLoading,
    setFirstName: vi.fn(),
    setLastName: vi.fn(),
    setSelectedInterestTags: vi.fn(),
    toggleInterestTag: vi.fn(),
    clearInterestTags: vi.fn(),
    toggleSelectedGroup: vi.fn(),
    setActiveGroupId: vi.fn(),
    clearSelectedGroups: vi.fn(),
    nextStep: wizardMocks.nextStep,
    previousStep: wizardMocks.previousStep,
    goToStep: wizardMocks.goToStep,
    saveInterests: wizardMocks.saveInterests,
    sendMembershipRequests: wizardMocks.sendMembershipRequests,
    skipMembership: wizardMocks.skipMembership,
    completeOnboarding: wizardMocks.completeOnboarding,
    allInterestSuggestions: [],
  };
}

function baseOnboardingData(): OnboardingData {
  return {
    firstName: 'Ada',
    lastName: 'Lovelace',
    selectedInterestTags: [],
    selectedGroups: [],
    activeGroupId: null,
    membershipRequestSentGroupIds: [],
  };
}

function ControllerHarness() {
  const controller = useOnboardingWizardController({
    userId: 'user-1',
    userEmail: 'ada@example.com',
    onComplete: wizardMocks.onComplete,
  });

  return <div data-testid="swipe-target" {...controller.swipeNavigationHandlers} />;
}

function swipeLeft(element: HTMLElement) {
  fireEvent.touchStart(element, {
    touches: [{ clientX: 280, clientY: 100 }],
  });
  fireEvent.touchMove(element, {
    touches: [{ clientX: 120, clientY: 104 }],
  });
  fireEvent.touchEnd(element, {
    changedTouches: [{ clientX: 120, clientY: 104 }],
  });
}

function swipeRight(element: HTMLElement) {
  fireEvent.touchStart(element, {
    touches: [{ clientX: 120, clientY: 100 }],
  });
  fireEvent.touchMove(element, {
    touches: [{ clientX: 280, clientY: 104 }],
  });
  fireEvent.touchEnd(element, {
    changedTouches: [{ clientX: 280, clientY: 104 }],
  });
}

beforeEach(() => {
  setViewportWidth(390);
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  wizardMocks.completeOnboarding.mockResolvedValue(undefined);
  wizardMocks.saveInterests.mockResolvedValue(true);
  wizardMocks.sendMembershipRequests.mockResolvedValue(true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('OnboardingWizard mobile swipe navigation', () => {
  it('uses the existing name save-and-next path for valid name swipes', async () => {
    wizardMocks.useOnboarding.mockReturnValue(
      buildOnboardingState({
        step: 'name',
        data: { firstName: 'Ada', lastName: 'Lovelace' },
      })
    );

    render(<ControllerHarness />);
    swipeLeft(screen.getByTestId('swipe-target'));

    await waitFor(() => {
      expect(wizardMocks.completeOnboarding).toHaveBeenCalledWith('user-1');
      expect(wizardMocks.nextStep).toHaveBeenCalledTimes(1);
    });
  });

  it('maps simple step left and right swipes to existing next and previous handlers', async () => {
    wizardMocks.useOnboarding.mockReturnValue(buildOnboardingState({ step: 'interests' }));

    render(<ControllerHarness />);
    const target = screen.getByTestId('swipe-target');

    swipeLeft(target);
    await waitFor(() => {
      expect(wizardMocks.saveInterests).toHaveBeenCalledTimes(1);
      expect(wizardMocks.nextStep).toHaveBeenCalledTimes(1);
    });

    swipeRight(target);
    expect(wizardMocks.previousStep).toHaveBeenCalledTimes(1);
  });

  it('does not send or decline membership requests from the confirm step by swiping left', () => {
    wizardMocks.useOnboarding.mockReturnValue(
      buildOnboardingState({
        step: 'confirm',
        data: { selectedGroups: [selectedGroup] },
      })
    );

    render(<ControllerHarness />);
    swipeLeft(screen.getByTestId('swipe-target'));

    expect(wizardMocks.sendMembershipRequests).not.toHaveBeenCalled();
    expect(wizardMocks.skipMembership).not.toHaveBeenCalled();
    expect(wizardMocks.goToStep).not.toHaveBeenCalled();
  });

  it('does not run summary destination actions from a left swipe', () => {
    wizardMocks.useOnboarding.mockReturnValue(buildOnboardingState({ step: 'summary' }));

    render(<ControllerHarness />);
    const target = screen.getByTestId('swipe-target');

    swipeLeft(target);
    expect(wizardMocks.navigate).not.toHaveBeenCalled();
    expect(wizardMocks.onComplete).not.toHaveBeenCalled();

    swipeRight(target);
    expect(wizardMocks.previousStep).toHaveBeenCalledTimes(1);
  });
});
