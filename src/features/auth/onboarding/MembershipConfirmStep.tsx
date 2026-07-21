'use client';

import {
  ArrowLeft,
  Check,
  Clock3,
  Loader2,
  MapPin,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';

import { featureThemeClassName } from '@/features/shared/theme';
import { useTranslation } from '@/features/shared/hooks/use-translation.ts';
import { BadgeControl } from '@/features/shared/ui/status';
import { Button } from '@/features/shared/ui/ui/button.tsx';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card.tsx';
import type { Group } from '../hooks/useOnboarding.ts';
import { OnboardingStepShell } from './OnboardingStepShell';

interface MembershipConfirmStepProps {
  groups: Group[];
  requestedGroupIds: string[];
  onConfirm: () => Promise<void>;
  onDecline: () => void;
  onBack: () => void;
  isLoading?: boolean;
}

export function MembershipConfirmStep({
  groups,
  requestedGroupIds,
  onConfirm,
  onDecline,
  onBack,
  isLoading,
}: MembershipConfirmStepProps) {
  const { t } = useTranslation();
  const requestedGroupIdSet = new Set(requestedGroupIds);
  const requestedCount = groups.filter(group => requestedGroupIdSet.has(group.id)).length;
  const pendingCount = groups.length - requestedCount;
  const isBatch = groups.length > 1;

  const handleConfirm = async () => {
    await onConfirm();
  };

  return (
    <OnboardingStepShell
      actions={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button variant="outline" onClick={onBack} disabled={isLoading}>
            <ArrowLeft className="h-4 w-4" />
            {t('common.goBack')}
          </Button>

          <div className="flex flex-col gap-2 sm:flex-row">
            {pendingCount > 0 ? (
              <>
                <Button onClick={handleConfirm} disabled={isLoading} size="lg">
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t('onboarding.confirmStep.requestSending')}
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      {isBatch
                        ? t('onboarding.confirmStep.yesMultiple', { count: pendingCount })
                        : t('onboarding.confirmStep.yes')}
                    </>
                  )}
                </Button>

                <Button variant="outline" onClick={onDecline} disabled={isLoading} size="lg">
                  <X className="h-4 w-4" />
                  {t('onboarding.confirmStep.no')}
                </Button>
              </>
            ) : (
              <Button onClick={onDecline} disabled={isLoading} size="lg">
                <Check className="h-4 w-4" />
                {t('onboarding.groupStep.continue')}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        <div>
          <div className="mb-4 flex">
            <div
              className={featureThemeClassName('authMembershipConfirmStepAccentGradientSurface')}
            >
              <UserPlus className={featureThemeClassName('authGroupSearchStepContrastIcon')} />
            </div>
          </div>
          <h2 className="text-3xl leading-tight font-bold tracking-tight">
            {isBatch
              ? t('onboarding.confirmStep.titleMultiple')
              : t('onboarding.confirmStep.title')}
          </h2>
          <p className="text-muted-foreground mt-3 max-w-2xl leading-7">
            {isBatch
              ? t('onboarding.confirmStep.descriptionMultiple', { count: groups.length })
              : t('onboarding.confirmStep.description')}
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="space-y-5">
            <div className="space-y-3">
              {groups.map(group => {
                const requestSent = requestedGroupIdSet.has(group.id);

                return (
                  <Card key={group.id} surface={requestSent ? 'successSoft' : 'emeraldSelected'}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-lg">{group.name}</CardTitle>
                        <div className="flex flex-none flex-wrap justify-end gap-2">
                          {requestSent && (
                            <BadgeControl tone="successSoft">
                              <Check className="mr-1 h-3 w-3" />
                              {t('onboarding.confirmStep.requestSent')}
                            </BadgeControl>
                          )}
                          <BadgeControl variant="outline">
                            <Users className="mr-1 h-3 w-3" />
                            {group.member_count}
                          </BadgeControl>
                        </div>
                      </div>
                      {group.description && (
                        <CardDescription className="text-sm">{group.description}</CardDescription>
                      )}
                    </CardHeader>
                    {group.location && (
                      <CardContent className="pt-0">
                        <div className="text-muted-foreground flex items-center gap-1 text-sm">
                          <MapPin className="h-4 w-4" />
                          <span>{group.location}</span>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>

            {requestedCount > 0 && (
              <div className={featureThemeClassName('authMembershipConfirmStepSuccessBadge')}>
                <div className="mb-2 flex justify-center">
                  <div className={featureThemeClassName('authMembershipConfirmStepSuccessPanel')}>
                    <Check
                      className={featureThemeClassName('authMembershipConfirmStepContrastIcon')}
                    />
                  </div>
                </div>
                <p className={featureThemeClassName('authMembershipConfirmStepSuccessText')}>
                  {isBatch
                    ? t('onboarding.confirmStep.requestSentMultiple', { count: requestedCount })
                    : t('onboarding.confirmStep.requestSent')}
                </p>
              </div>
            )}
          </div>

          <aside className="bg-card rounded-lg border p-5 shadow-sm">
            <p className="text-sm font-semibold">{t('onboarding.confirmStep.nextTitle')}</p>
            <div className="mt-5 space-y-4">
              <div className="flex gap-3">
                <ShieldCheck className="text-primary mt-0.5 h-4 w-4 flex-none" />
                <p className="text-muted-foreground text-sm leading-6">
                  {t('onboarding.confirmStep.nextPrivacy')}
                </p>
              </div>
              <div className="flex gap-3">
                <Clock3 className="text-primary mt-0.5 h-4 w-4 flex-none" />
                <p className="text-muted-foreground text-sm leading-6">
                  {t('onboarding.confirmStep.nextReview')}
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </OnboardingStepShell>
  );
}
