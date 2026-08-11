'use client';

import {
  CheckCircle2,
  Circle,
  Hash,
  MessageCircle,
  Smartphone,
  Sparkles,
  User,
  UserPlus,
  Users,
} from 'lucide-react';

import { SectionProgressTopBar } from '@/features/shared/ui/navigation';
import { Progress } from '@/features/shared/ui/ui/progress.tsx';
import { BadgeControl } from '@/features/shared/ui/status';
import { cn } from '@/features/shared/utils/utils.ts';
import type { WizardSwipeNavigationHandlers } from '@/features/shared/hooks/useWizardSwipeNavigation';
import { type OnboardingStep } from '../hooks/useOnboarding.ts';
import { NameStep } from './NameStep.tsx';
import { GroupSearchStep } from './GroupSearchStep.tsx';
import { MembershipConfirmStep } from './MembershipConfirmStep.tsx';
import { SummaryStep } from './SummaryStep.tsx';
import { AriaKaiStep } from '@/features/assistant/ui/AriaKaiStep.tsx';
import { InterestStep } from './InterestStep.tsx';
import { AppInstallStep } from './AppInstallStep.tsx';

const STEP_PROGRESS: Record<OnboardingStep, number> = {
  name: 14,
  interests: 28,
  groupSearch: 42,
  confirm: 56,
  ariaKai: 70,
  appInstall: 84,
  summary: 100,
};

const STEP_ORDER: OnboardingStep[] = [
  'name',
  'interests',
  'groupSearch',
  'confirm',
  'ariaKai',
  'appInstall',
  'summary',
];

const STEP_ICONS = {
  name: User,
  interests: Hash,
  groupSearch: Users,
  confirm: UserPlus,
  ariaKai: MessageCircle,
  appInstall: Smartphone,
  summary: Sparkles,
} satisfies Record<OnboardingStep, typeof User>;

export interface OnboardingWizardViewProps {
  userId: any;
  userEmail: any;
  onComplete: any;
  t: any;
  step: OnboardingStep;
  error: any;
  data: any;
  isLoading: any;
  setFirstName: any;
  setLastName: any;
  setSelectedInterestTags: any;
  toggleInterestTag: any;
  clearInterestTags: any;
  toggleSelectedGroup: any;
  setActiveGroupId: any;
  clearSelectedGroups: any;
  nextStep: any;
  previousStep: any;
  goToStep: any;
  saveInterests: any;
  sendMembershipRequests: any;
  skipMembership: any;
  completeOnboarding: any;
  allInterestSuggestions: any;
  handleNameNext: any;
  handleInterestsNext: any;
  handleGroupNext: any;
  handleMembershipConfirm: any;
  handleMembershipDecline: any;
  handleAriaKaiNext: any;
  handleAppInstallNext: any;
  swipeNavigationHandlers: WizardSwipeNavigationHandlers;
}

export function OnboardingWizardView({
  userId,
  onComplete,
  t,
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
  previousStep,
  goToStep,
  allInterestSuggestions,
  handleNameNext,
  handleInterestsNext,
  handleGroupNext,
  handleMembershipConfirm,
  handleMembershipDecline,
  handleAriaKaiNext,
  handleAppInstallNext,
  swipeNavigationHandlers,
}: OnboardingWizardViewProps) {
  const activeStepIndex = STEP_ORDER.indexOf(step);
  const getStepNavigationState = (item: OnboardingStep, index: number) => {
    const wasSkipped = item === 'confirm' && data.selectedGroups.length === 0;
    const completed = index < activeStepIndex && !wasSkipped;

    return {
      completed,
      disabled: !completed || isLoading,
    };
  };
  const handleStepSelect = (id: string) => {
    const selectedStepIndex = STEP_ORDER.findIndex(item => item === id);
    if (selectedStepIndex < 0) return;

    const selectedStep = STEP_ORDER[selectedStepIndex];
    const { disabled } = getStepNavigationState(selectedStep, selectedStepIndex);
    if (!disabled) {
      goToStep(selectedStep);
    }
  };
  const mobileStepItems = STEP_ORDER.map((item, index) => ({
    id: item,
    label: t(`onboarding.shell.steps.${item}.label`),
    description: t(`onboarding.shell.steps.${item}.description`),
    icon: STEP_ICONS[item],
    ...getStepNavigationState(item, index),
  }));

  return (
    <div className="bg-background flex h-dvh min-h-0 flex-col overflow-hidden">
      <SectionProgressTopBar
        sticky
        activeId={step}
        className="flex-none lg:hidden"
        countLabel={`${activeStepIndex + 1}/${STEP_ORDER.length}`}
        items={mobileStepItems}
        label={t('onboarding.shell.progressLabel')}
        onItemSelect={handleStepSelect}
        progressValue={STEP_PROGRESS[step]}
      />

      <main className="mx-auto grid min-h-0 w-full max-w-7xl flex-1 gap-5 px-4 pt-4 sm:px-6 lg:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)] lg:gap-8 lg:px-8 lg:pt-6">
        <aside
          data-slot="onboarding-desktop-sidebar"
          className="hidden min-h-0 flex-col justify-between gap-4 overflow-hidden lg:flex lg:border-r lg:pr-6 lg:pb-6"
        >
          <div className="space-y-5 [@media(max-height:900px)]:space-y-3">
            <div className="space-y-3 [@media(max-height:900px)]:space-y-2">
              <BadgeControl variant="outline">{t('onboarding.shell.progressLabel')}</BadgeControl>
              <div className="space-y-2">
                <h1 className="text-3xl leading-tight font-bold tracking-tight [@media(max-height:900px)]:text-2xl">
                  {t('onboarding.shell.title')}
                </h1>
                <p
                  data-slot="onboarding-sidebar-subtitle"
                  className="text-muted-foreground max-w-lg text-sm leading-6 [@media(max-height:900px)]:hidden"
                >
                  {t('onboarding.shell.subtitle')}
                </p>
                <p
                  data-slot="onboarding-sidebar-compact-reason"
                  className="text-muted-foreground hidden max-w-lg text-xs leading-4 [@media(max-height:900px)]:block"
                >
                  {t('onboarding.shell.compactReason')}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground text-sm font-medium">
                  {activeStepIndex + 1}/{STEP_ORDER.length}
                </span>
                <span className="text-muted-foreground text-sm">{STEP_PROGRESS[step]}%</span>
              </div>
              <Progress value={STEP_PROGRESS[step]} className="h-2" />
            </div>

            <ol className="space-y-1.5 [@media(max-height:900px)]:space-y-1">
              {STEP_ORDER.map((item, index) => {
                const Icon = STEP_ICONS[item];
                const isActive = item === step;
                const { completed: isComplete, disabled } = getStepNavigationState(item, index);

                return (
                  <li
                    key={item}
                    className={cn(
                      'rounded-lg border p-2 transition-colors',
                      isActive
                        ? 'border-primary bg-primary/5 text-foreground'
                        : isComplete
                          ? 'border-success/30 bg-success/5'
                          : 'bg-card text-muted-foreground'
                    )}
                  >
                    <button
                      type="button"
                      data-action-id="auth.onboarding.wizard.step.select"
                      disabled={disabled}
                      aria-current={isActive ? 'step' : undefined}
                      aria-label={t(`onboarding.shell.steps.${item}.label`)}
                      onClick={() => handleStepSelect(item)}
                      data-slot="onboarding-sidebar-step-row"
                      className={cn(
                        'flex w-full gap-2 rounded-md text-left outline-none [@media(max-height:900px)]:items-center',
                        !disabled &&
                          'focus-visible:ring-primary cursor-pointer hover:opacity-80 focus-visible:ring-2 focus-visible:ring-offset-2'
                      )}
                    >
                      <div
                        className={cn(
                          'flex h-7 w-7 flex-none items-center justify-center rounded-md border',
                          isActive
                            ? 'border-primary bg-primary text-primary-foreground'
                            : isComplete
                              ? 'border-success/40 bg-success/10 text-success'
                              : 'bg-background'
                        )}
                      >
                        {isComplete ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : isActive ? (
                          <Icon className="h-4 w-4" />
                        ) : (
                          <Circle className="h-3 w-3" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">
                          {t(`onboarding.shell.steps.${item}.label`)}
                        </p>
                        <p
                          data-slot="onboarding-sidebar-step-description"
                          className="text-muted-foreground mt-0.5 text-xs leading-4 [@media(max-height:900px)]:hidden"
                        >
                          {t(`onboarding.shell.steps.${item}.description`)}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>

          <div
            data-slot="onboarding-sidebar-context"
            className="bg-card hidden rounded-lg border p-3 shadow-sm [@media(min-height:1301px)]:lg:block"
          >
            <p className="text-sm font-semibold">{t('onboarding.shell.contextTitle')}</p>
            <p className="text-muted-foreground mt-1 text-xs leading-5">
              {t('onboarding.shell.contextDescription')}
            </p>
          </div>
        </aside>

        <section className="flex min-h-0 justify-center overflow-hidden">
          <div className="flex h-full min-h-0 w-full max-w-5xl flex-col">
            {error && (
              <div className="border-destructive/40 bg-destructive/10 text-destructive mb-5 rounded-lg border px-4 py-3 text-sm">
                {error}
              </div>
            )}

            <div
              className="min-h-0 flex-1"
              style={{ touchAction: 'pan-y' }}
              {...swipeNavigationHandlers}
            >
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

              {step === 'interests' && (
                <InterestStep
                  selectedInterestTags={data.selectedInterestTags}
                  suggestions={allInterestSuggestions}
                  onSelectedInterestTagsChange={setSelectedInterestTags}
                  onToggleInterestTag={toggleInterestTag}
                  onClearInterestTags={clearInterestTags}
                  onNext={handleInterestsNext}
                  onBack={previousStep}
                  isLoading={isLoading}
                />
              )}

              {step === 'groupSearch' && (
                <GroupSearchStep
                  selectedGroups={data.selectedGroups}
                  interestTags={data.selectedInterestTags}
                  activeGroupId={data.activeGroupId}
                  onToggleGroup={toggleSelectedGroup}
                  onActiveGroupChange={setActiveGroupId}
                  onClearSelectedGroups={clearSelectedGroups}
                  onNext={handleGroupNext}
                  onBack={previousStep}
                  isLoading={isLoading}
                />
              )}

              {step === 'confirm' && data.selectedGroups.length > 0 && (
                <MembershipConfirmStep
                  groups={data.selectedGroups}
                  requestedGroupIds={data.membershipRequestSentGroupIds}
                  onConfirm={handleMembershipConfirm}
                  onDecline={handleMembershipDecline}
                  onBack={previousStep}
                  isLoading={isLoading}
                />
              )}

              {step === 'ariaKai' && <AriaKaiStep onNext={handleAriaKaiNext} />}

              {step === 'appInstall' && (
                <AppInstallStep
                  onNext={handleAppInstallNext}
                  onBack={previousStep}
                  isLoading={isLoading}
                />
              )}

              {step === 'summary' && (
                <SummaryStep
                  firstName={data.firstName}
                  lastName={data.lastName}
                  selectedGroups={data.selectedGroups}
                  selectedInterestTags={data.selectedInterestTags}
                  activeGroupId={data.activeGroupId}
                  membershipRequestSentGroupIds={data.membershipRequestSentGroupIds}
                  userId={userId}
                  onComplete={onComplete}
                  isLoading={isLoading}
                />
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
