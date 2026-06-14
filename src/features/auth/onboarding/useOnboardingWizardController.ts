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
    data,
    isLoading,
    setFirstName,
    setLastName,
    setSelectedGroup,
    setDontShowAriaKaiAgain,
    nextStep,
    previousStep,
    goToStep,
    sendMembershipRequest,
    skipMembership,
    completeOnboarding,
  } = useOnboarding();

  console.log('🎯 OnboardingWizard state:', { step, isLoading, data });

  const handleNameNext = async () => {
    // Save name to database immediately after name step
    await completeOnboarding(userId);
    nextStep();
  };

  const handleGroupNext = async () => {
    // Name is already saved in handleNameNext
    nextStep();
  };

  const handleMembershipConfirm = async () => {
    const success = await sendMembershipRequest();
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

    goToStep('summary');
  };

  const handleGoToProfile = () => {
    console.log('🏠 handleGoToProfile called — navigating to /user/' + userId);
    navigate({ to: `/user/${userId}` });
    onComplete();
  };

  const handleGoToGroup = () => {
    if (!data.selectedGroup) {
      console.warn('⚠️ No selected group');
      return;
    }
    console.log('👥 handleGoToGroup called — navigating to group:', data.selectedGroup.id);
    navigate({ to: `/group/${data.selectedGroup.id}` });
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
    data,
    isLoading,
    setFirstName,
    setLastName,
    setSelectedGroup,
    setDontShowAriaKaiAgain,
    nextStep,
    previousStep,
    goToStep,
    sendMembershipRequest,
    skipMembership,
    completeOnboarding,
    handleNameNext,
    handleGroupNext,
    handleMembershipConfirm,
    handleMembershipDecline,
    handleAriaKaiNext,
    handleGoToProfile,
    handleGoToGroup,
    handleGoToAssistant,
  };
}
