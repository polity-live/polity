'use client';

import {
  Check,
  Compass,
  GraduationCap,
  Hash,
  Mail,
  MessageCircle,
  Sparkles,
  User,
  Users,
} from 'lucide-react';
import type { MouseEvent } from 'react';

import { featureThemeClassName } from '@/features/shared/theme';
import { useTranslation } from '@/features/shared/hooks/use-translation.ts';
import { BadgeControl } from '@/features/shared/ui/status';
import { Button } from '@/features/shared/ui/ui/button.tsx';
import { Card, CardContent } from '@/features/shared/ui/ui/card.tsx';
import { cn } from '@/features/shared/utils/utils.ts';
import type { Group } from '../hooks/useOnboarding.ts';
import { OnboardingStepShell } from './OnboardingStepShell';

interface SummaryStepProps {
  firstName: string;
  lastName: string;
  selectedGroups: Group[];
  selectedInterestTags: string[];
  activeGroupId: string | null;
  membershipRequestSentGroupIds: string[];
  userId: string;
  onComplete: () => void;
  isLoading?: boolean;
}

export function SummaryStep({
  firstName,
  lastName,
  selectedGroups,
  selectedInterestTags,
  activeGroupId,
  membershipRequestSentGroupIds,
  onComplete,
  isLoading,
}: SummaryStepProps) {
  const { t } = useTranslation();
  const fullName = `${firstName} ${lastName}`;
  const selectedCount = selectedGroups.length;
  const requestedGroupIdSet = new Set(membershipRequestSentGroupIds);
  const requestedGroups = selectedGroups.filter(group => requestedGroupIdSet.has(group.id));
  const requestedCount = requestedGroups.length;
  const primarySelectedGroup =
    selectedGroups.find(group => group.id === activeGroupId) ?? selectedGroups[0] ?? null;
  const destinationLinkClassName = isLoading ? 'pointer-events-none opacity-50' : undefined;
  const destinationButtonClassName = cn(
    'h-full min-h-16 w-full min-w-0 justify-start whitespace-normal px-3 py-3 text-left',
    destinationLinkClassName
  );
  const destinationLabelClassName =
    'min-w-0 flex-1 whitespace-normal break-words text-left leading-5';

  const handleDestinationClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (isLoading) {
      event.preventDefault();
      return;
    }

    if (
      event.button === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey
    ) {
      onComplete();
    }
  };

  return (
    <OnboardingStepShell
      actions={
        <div className="grid grid-cols-1 gap-2 md:grid-cols-[repeat(3,minmax(0,1fr))]">
          <Button asChild className={destinationButtonClassName}>
            <a
              href="/onboarding"
              onClick={handleDestinationClick}
              aria-disabled={isLoading || undefined}
              tabIndex={isLoading ? -1 : undefined}
            >
              <GraduationCap className="h-4 w-4 shrink-0" />
              <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                <BadgeControl
                  className="shrink-0"
                  tone="mutedContrast"
                  size="tiny"
                  textTransform="uppercase"
                >
                  {t('onboarding.summaryStep.recommended')}
                </BadgeControl>
                <span className={destinationLabelClassName}>
                  {t('onboarding.summaryStep.explainApp')}
                </span>
              </span>
            </a>
          </Button>

          <Button asChild className={destinationButtonClassName} variant="outline">
            <a
              href="/messages?openAriaKai=true"
              onClick={handleDestinationClick}
              aria-disabled={isLoading || undefined}
              tabIndex={isLoading ? -1 : undefined}
            >
              <MessageCircle className="h-4 w-4 shrink-0" />
              <span className={destinationLabelClassName}>
                {t('onboarding.summaryStep.exploreWithAssistant')}
              </span>
            </a>
          </Button>

          <Button asChild className={destinationButtonClassName} variant="outline">
            <a
              href="/search"
              onClick={handleDestinationClick}
              aria-disabled={isLoading || undefined}
              tabIndex={isLoading ? -1 : undefined}
            >
              <Compass className="h-4 w-4 shrink-0" />
              <span className={destinationLabelClassName}>
                {t('onboarding.summaryStep.exploreAlone')}
              </span>
            </a>
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <div>
          <div className="mb-4 flex">
            <div className={featureThemeClassName('authSummaryStepWarningGradientSurface')}>
              <Sparkles className={featureThemeClassName('authGroupSearchStepContrastIcon')} />
            </div>
          </div>
          <h2 className="text-3xl leading-tight font-bold tracking-tight">
            {t('onboarding.summaryStep.title')}
          </h2>
          <p className="text-muted-foreground mt-3 max-w-2xl leading-7">
            {t('onboarding.summaryStep.description')}
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="space-y-3">
            <Card surface="successSoft">
              <CardContent className="flex items-center gap-3 p-4">
                <div className={featureThemeClassName('authMembershipConfirmStepSuccessPanel')}>
                  <User className={featureThemeClassName('authSummaryStepContrastIcon')} />
                </div>
                <div className="flex-1">
                  <p className={featureThemeClassName('authSummaryStepSuccessText')}>
                    {t('onboarding.summaryStep.nameUpdated')}
                  </p>
                  <p className={featureThemeClassName('authSummaryStepSuccessTextAlpha')}>
                    {fullName}
                  </p>
                </div>
                <Check className={featureThemeClassName('agendaAccreditationSectionSuccessIcon')} />
              </CardContent>
            </Card>

            {selectedCount > 0 ? (
              <Card surface="blueSoft">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className={featureThemeClassName('authSummaryStepInfoPanel')}>
                    <Users className={featureThemeClassName('authSummaryStepContrastIcon')} />
                  </div>
                  <div className="flex-1">
                    <p className={featureThemeClassName('authSummaryStepInfoText')}>
                      {selectedCount === 1
                        ? t('onboarding.summaryStep.groupSelected')
                        : t('onboarding.summaryStep.groupsSelected')}
                    </p>
                    <p className={featureThemeClassName('authSummaryStepInfoTextAlpha')}>
                      {selectedCount === 1
                        ? t('onboarding.summaryStep.groupCountOne')
                        : t('onboarding.summaryStep.groupCount', { count: selectedCount })}
                    </p>
                    {primarySelectedGroup && (
                      <p className="text-muted-foreground mt-1 text-xs">
                        {primarySelectedGroup.name}
                      </p>
                    )}
                  </div>
                  <Check className={featureThemeClassName('authSummaryStepInfoIcon')} />
                </CardContent>
              </Card>
            ) : (
              <Card surface="graySoft">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className={featureThemeClassName('authSummaryStepNeutralPanel')}>
                    <Users className={featureThemeClassName('authSummaryStepContrastIcon')} />
                  </div>
                  <div className="flex-1">
                    <p className={featureThemeClassName('authSummaryStepNeutralText')}>
                      {t('onboarding.summaryStep.noGroup')}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {requestedCount > 0 && (
              <Card surface="purpleSoft">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className={featureThemeClassName('authSummaryStepAccentPanel')}>
                    <Mail className={featureThemeClassName('authSummaryStepContrastIcon')} />
                  </div>
                  <div className="flex-1">
                    <p className={featureThemeClassName('authSummaryStepAccentText')}>
                      {requestedCount === 1
                        ? t('onboarding.summaryStep.membershipRequested')
                        : t('onboarding.summaryStep.membershipRequestsSent')}
                    </p>
                    <p className={featureThemeClassName('authSummaryStepAccentTextAlpha')}>
                      {requestedCount === 1
                        ? t('onboarding.summaryStep.requestCountOne')
                        : t('onboarding.summaryStep.requestCount', { count: requestedCount })}
                    </p>
                    {requestedCount === 1 && requestedGroups[0] && (
                      <p className="text-muted-foreground mt-1 text-xs">
                        {requestedGroups[0].name}
                      </p>
                    )}
                  </div>
                  <Check className={featureThemeClassName('authSummaryStepAccentIcon')} />
                </CardContent>
              </Card>
            )}

            {selectedInterestTags.length > 0 && (
              <Card surface="graySoft">
                <CardContent className="flex items-start gap-3 p-4">
                  <div className={featureThemeClassName('authSummaryStepNeutralPanel')}>
                    <Hash className={featureThemeClassName('authSummaryStepContrastIcon')} />
                  </div>
                  <div className="flex-1">
                    <p className={featureThemeClassName('authSummaryStepNeutralText')}>
                      {t('onboarding.summaryStep.interestsSelected')}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedInterestTags.slice(0, 6).map(tag => (
                        <BadgeControl key={tag} variant="outline">
                          #{tag}
                        </BadgeControl>
                      ))}
                    </div>
                  </div>
                  <Check
                    className={featureThemeClassName('agendaAccreditationSectionSuccessIcon')}
                  />
                </CardContent>
              </Card>
            )}
          </div>

          <aside className="bg-card rounded-lg border p-5 shadow-sm">
            <p className="text-sm font-semibold">{t('onboarding.summaryStep.pathTitle')}</p>
            <p className="text-muted-foreground mt-3 text-sm leading-6">
              {t('onboarding.summaryStep.pathDescription')}
            </p>
            <div className="border-primary/20 bg-primary/5 mt-5 rounded-lg border p-4">
              <p className="text-muted-foreground text-xs font-medium uppercase">
                {t('onboarding.summaryStep.recommended')}
              </p>
              <p className="mt-2 text-sm font-semibold">{t('onboarding.summaryStep.explainApp')}</p>
            </div>
          </aside>
        </div>
      </div>
    </OnboardingStepShell>
  );
}
