'use client';

import { useCallback } from 'react';
import { useTranslation } from '@/features/shared/hooks/use-translation.ts';
import { useWizardSwipeNavigation } from '@/features/shared/hooks/useWizardSwipeNavigation';
import { useOnboarding } from '../hooks/useOnboarding.ts';
import { useUserActions } from '@/zero/users/useUserActions.ts';
import { useAuth } from '@/providers/auth-provider.tsx';

interface OnboardingWizardProps {
  userId: string;
  userEmail: string;
  onComplete: () => void;
}
export function useOnboardingWizardController({
  userId,
  userEmail,
  onComplete,
}: OnboardingWizardProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { updateProfileClientApplied } = useUserActions();

  const {
    step,
    error,
    data,
    isLoading,
    setFirstName,
    setLastName,
    setSelectedInterestTags,
    toggleInterestTag,
    clearInterestTags,
    toggleSelectedGroup,
    setActiveGroupId,
    clearSelectedGroups,
    setDontShowAriaKaiAgain,
    nextStep,
    previousStep,
    goToStep,
    saveInterests,
    sendMembershipRequests,
    skipMembership,
    completeOnboarding,
    allInterestSuggestions,
  } = useOnboarding();

  const handleNameNext = async () => {
    // Save name to database immediately after name step
    await completeOnboarding(userId);
    nextStep();
  };

  const handleInterestsNext = async () => {
    const success = await saveInterests();
    if (success) {
      nextStep();
    }
  };

  const handleGroupNext = async () => {
    // Name is already saved in handleNameNext
    nextStep();
  };

  const handleMembershipConfirm = async () => {
    const success = await sendMembershipRequests();
    if (success) {
      // Move to ariaKai step
      goToStep('ariaKai');
    }
  };

  const handleMembershipDecline = async () => {
    // Name is already saved in handleNameNext
    skipMembership();
  };

  const handleAriaKaiNext = async () => {
    // Save the "don't show again" preference if user checked it
    if (data.dontShowAriaKaiAgain && user?.id) {
      try {
        await updateProfileClientApplied({
          assistant_introduction: false,
        });
      } catch (error) {
        console.error('Failed to save preference:', error);
      }
    }

    goToStep('appInstall');
  };

  const handleAppInstallNext = () => {
    goToStep('summary');
  };

  const canSwipeForwardFromName =
    data.firstName.trim().length >= 2 &&
    data.firstName.trim().length <= 50 &&
    data.lastName.trim().length >= 2 &&
    data.lastName.trim().length <= 50;
  const canSwipeNext =
    !isLoading &&
    (step === 'name'
      ? canSwipeForwardFromName
      : step === 'interests' ||
        step === 'groupSearch' ||
        step === 'ariaKai' ||
        step === 'appInstall');

  const handleSwipeNext = useCallback(() => {
    if (isLoading) {
      return;
    }

    if (step === 'name') {
      if (canSwipeForwardFromName) {
        void handleNameNext();
      }
      return;
    }

    if (step === 'interests') {
      void handleInterestsNext();
      return;
    }

    if (step === 'groupSearch') {
      void handleGroupNext();
      return;
    }

    if (step === 'ariaKai') {
      void handleAriaKaiNext();
      return;
    }

    if (step === 'appInstall') {
      handleAppInstallNext();
    }
  }, [
    canSwipeForwardFromName,
    handleAppInstallNext,
    handleAriaKaiNext,
    handleGroupNext,
    handleInterestsNext,
    handleNameNext,
    isLoading,
    step,
  ]);

  const handleSwipePrev = useCallback(() => {
    if (!isLoading) {
      previousStep();
    }
  }, [isLoading, previousStep]);

  const { handlers: swipeNavigationHandlers } = useWizardSwipeNavigation({
    disabled: isLoading,
    canSwipeNext,
    canSwipePrev: step !== 'name',
    onSwipeNext: handleSwipeNext,
    onSwipePrev: handleSwipePrev,
    keyboardMode: 'global',
  });

  return {
    userId,
    userEmail,
    onComplete,
    t,
    user,
    updateProfileClientApplied,
    step,
    error,
    data,
    isLoading,
    setFirstName,
    setLastName,
    setSelectedInterestTags,
    toggleInterestTag,
    clearInterestTags,
    toggleSelectedGroup,
    setActiveGroupId,
    clearSelectedGroups,
    setDontShowAriaKaiAgain,
    nextStep,
    previousStep,
    goToStep,
    saveInterests,
    sendMembershipRequests,
    skipMembership,
    completeOnboarding,
    allInterestSuggestions,
    handleNameNext,
    handleInterestsNext,
    handleGroupNext,
    handleMembershipConfirm,
    handleMembershipDecline,
    handleAriaKaiNext,
    handleAppInstallNext,
    swipeNavigationHandlers,
  };
}
