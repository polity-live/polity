'use client';

import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from '@/features/shared/hooks/use-translation.ts';
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
  console.log('🎯 OnboardingWizard RENDERING:', { userId, userEmail, onComplete: !!onComplete });

  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { updateProfileConfirmed } = useUserActions();

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

  console.log('🎯 OnboardingWizard state:', { step, isLoading, data });

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
        await updateProfileConfirmed({
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

  const handleGoToProfile = () => {
    console.log('🏠 handleGoToProfile called — navigating to /user/' + userId);
    navigate({ to: `/user/${userId}` });
    onComplete();
  };

  const handleGoToGroup = () => {
    const targetGroup =
      data.selectedGroups.find(group => group.id === data.activeGroupId) ??
      data.selectedGroups[0] ??
      null;

    if (!targetGroup) {
      console.warn('⚠️ No selected group');
      return;
    }
    console.log('👥 handleGoToGroup called — navigating to group:', targetGroup.id);
    navigate({ to: `/group/${targetGroup.id}` });
    onComplete();
  };

  const handleGoToTimeline = () => {
    console.log('handleGoToTimeline called — navigating to /home');
    navigate({ to: '/home' });
    onComplete();
  };

  const handleGoToAssistant = () => {
    console.log('💬 handleGoToAssistant called — navigating to /messages?openAriaKai=true');
    navigate({ to: '/messages', search: { openAriaKai: 'true' } });
    onComplete();
  };
  return {
    userId,
    userEmail,
    onComplete,
    t,
    navigate,
    user,
    updateProfileConfirmed,
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
    handleGoToProfile,
    handleGoToGroup,
    handleGoToTimeline,
    handleGoToAssistant,
  };
}
