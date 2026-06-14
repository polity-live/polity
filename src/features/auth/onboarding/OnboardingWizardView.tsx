'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/features/shared/ui/ui/card.tsx';
import { Progress } from '@/features/shared/ui/ui/progress.tsx';
import { type OnboardingStep } from '../hooks/useOnboarding.ts';
import { NameStep } from './NameStep.tsx';
import { GroupSearchStep } from './GroupSearchStep.tsx';
import { MembershipConfirmStep } from './MembershipConfirmStep.tsx';
import { SummaryStep } from './SummaryStep.tsx';
import { AriaKaiStep } from '@/features/assistant/ui/AriaKaiStep.tsx';
const STEP_PROGRESS: Record<OnboardingStep, number> = {
  name: 20,
  groupSearch: 40,
  confirm: 60,
  ariaKai: 80,
  summary: 100,
};
export interface OnboardingWizardViewProps {
  userId: any;
  userEmail: any;
  onComplete: any;
  t: any;
  navigate: any;
  user: any;
  updateProfileConfirmed: any;
  step: OnboardingStep;
  data: any;
  isLoading: any;
  setFirstName: any;
  setLastName: any;
  setSelectedGroup: any;
  setDontShowAriaKaiAgain: any;
  nextStep: any;
  previousStep: any;
  goToStep: any;
  sendMembershipRequest: any;
  skipMembership: any;
  completeOnboarding: any;
  handleNameNext: any;
  handleGroupNext: any;
  handleMembershipConfirm: any;
  handleMembershipDecline: any;
  handleAriaKaiNext: any;
  handleGoToProfile: any;
  handleGoToGroup: any;
  handleGoToAssistant: any;
}

export function OnboardingWizardView({
  t,
  step,
  data,
  isLoading,
  setFirstName,
  setLastName,
  setSelectedGroup,
  setDontShowAriaKaiAgain,
  previousStep,
  handleNameNext,
  handleGroupNext,
  handleMembershipConfirm,
  handleMembershipDecline,
  handleAriaKaiNext,
  handleGoToProfile,
  handleGoToGroup,
  handleGoToAssistant,
}: OnboardingWizardViewProps) {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="pb-2">
          <div className="mb-2 flex items-center justify-between">
            <CardTitle tone="muted" size="lg">
              {t('onboarding.welcome')}
            </CardTitle>
            <span className="text-muted-foreground text-sm">
              {step === 'name' && '1/5'}
              {step === 'groupSearch' && '2/5'}
              {step === 'confirm' && '3/5'}
              {step === 'ariaKai' && '4/5'}
              {step === 'summary' && '5/5'}
            </span>
          </div>
          <Progress value={STEP_PROGRESS[step]} className="h-2" />
        </CardHeader>
        <CardContent className="pt-4">
          {step === 'name' && (
            <NameStep
              firstName={data.firstName}
              lastName={data.lastName}
              onFirstNameChange={setFirstName}
              onLastNameChange={setLastName}
              onNext={handleNameNext}
              isLoading={isLoading}
            />
          )}

          {step === 'groupSearch' && (
            <GroupSearchStep
              selectedGroup={data.selectedGroup}
              onSelectGroup={setSelectedGroup}
              onNext={handleGroupNext}
              onBack={previousStep}
              isLoading={isLoading}
            />
          )}

          {step === 'confirm' && data.selectedGroup && (
            <MembershipConfirmStep
              group={data.selectedGroup}
              onConfirm={handleMembershipConfirm}
              onDecline={handleMembershipDecline}
              onBack={previousStep}
              isLoading={isLoading}
              requestSent={data.membershipRequestSent}
            />
          )}

          {step === 'ariaKai' && (
            <AriaKaiStep
              onNext={handleAriaKaiNext}
              dontShowAgain={data.dontShowAriaKaiAgain}
              onDontShowAgainChange={setDontShowAriaKaiAgain}
            />
          )}

          {step === 'summary' && (
            <SummaryStep
              firstName={data.firstName}
              lastName={data.lastName}
              selectedGroup={data.selectedGroup}
              membershipRequestSent={data.membershipRequestSent}
              onGoToProfile={handleGoToProfile}
              onGoToGroup={handleGoToGroup}
              onGoToAssistant={handleGoToAssistant}
              isLoading={isLoading}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
