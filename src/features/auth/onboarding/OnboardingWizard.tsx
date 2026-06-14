'use client';
interface OnboardingWizardProps {
  userId: string;
  userEmail: string;
  onComplete: () => void;
}
import { useOnboardingWizardController } from './useOnboardingWizardController';
import { OnboardingWizardView } from './OnboardingWizardView';

export function OnboardingWizard({ userId, userEmail, onComplete }: OnboardingWizardProps) {
  const viewProps = useOnboardingWizardController({ userId, userEmail, onComplete });

  return <OnboardingWizardView {...viewProps} />;
}
