'use client';

import { ArrowRight, Check, Hash, Mail, MessageCircle, Sparkles, User, Users } from 'lucide-react';

import { featureThemeClassName } from '@/features/shared/theme';
import { useTranslation } from '@/features/shared/hooks/use-translation.ts';
import { BadgeControl } from '@/features/shared/ui/status';
import { Button } from '@/features/shared/ui/ui/button.tsx';
import { Card, CardContent } from '@/features/shared/ui/ui/card.tsx';
import type { Group } from '../hooks/useOnboarding.ts';

interface SummaryStepProps {
  firstName: string;
  lastName: string;
  selectedGroups: Group[];
  selectedInterestTags: string[];
  activeGroupId: string | null;
  membershipRequestSentGroupIds: string[];
  onGoToProfile: () => void;
  onGoToGroup: () => void;
  onGoToTimeline: () => void;
  onGoToAssistant: () => void;
  isLoading?: boolean;
}

export function SummaryStep({
  firstName,
  lastName,
  selectedGroups,
  selectedInterestTags,
  activeGroupId,
  membershipRequestSentGroupIds,
  onGoToProfile,
  onGoToGroup,
  onGoToTimeline,
  onGoToAssistant,
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
  const recommendedAction =
    requestedCount > 0
      ? 'profile'
      : selectedCount > 0
        ? 'group'
        : selectedInterestTags.length > 0
          ? 'timeline'
          : 'assistant';

  return (
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
                    <p className="text-muted-foreground mt-1 text-xs">{requestedGroups[0].name}</p>
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
                <Check className={featureThemeClassName('agendaAccreditationSectionSuccessIcon')} />
              </CardContent>
            </Card>
          )}
        </div>

        <aside className="bg-card rounded-lg border p-5 shadow-sm">
          <p className="text-sm font-semibold">{t('onboarding.summaryStep.recommendationTitle')}</p>
          <p className="text-muted-foreground mt-3 text-sm leading-6">
            {t(`onboarding.summaryStep.recommendations.${recommendedAction}`)}
          </p>
          <div className="bg-muted/60 mt-5 rounded-lg p-4">
            <p className="text-muted-foreground text-xs font-medium uppercase">
              {t('onboarding.summaryStep.nextStepLabel')}
            </p>
            <p className="mt-2 text-sm font-semibold">
              {recommendedAction === 'profile' && t('onboarding.summaryStep.goToProfile')}
              {recommendedAction === 'group' && t('onboarding.summaryStep.goToGroup')}
              {recommendedAction === 'timeline' && t('onboarding.summaryStep.goToTimeline')}
              {recommendedAction === 'assistant' && t('onboarding.summaryStep.showAssistant')}
            </p>
          </div>
        </aside>
      </div>

      <div className="grid gap-2 border-t pt-5 sm:grid-cols-2 lg:grid-cols-4">
        <Button
          onClick={onGoToAssistant}
          disabled={isLoading}
          variant={recommendedAction === 'assistant' ? 'default' : 'outline'}
          size="lg"
        >
          <MessageCircle className="h-4 w-4" />
          {t('onboarding.summaryStep.showAssistant')}
        </Button>

        <Button
          onClick={onGoToTimeline}
          disabled={isLoading}
          variant={recommendedAction === 'timeline' ? 'default' : 'outline'}
          size="lg"
        >
          <Hash className="h-4 w-4" />
          {t('onboarding.summaryStep.goToTimeline')}
          <ArrowRight className="h-4 w-4" />
        </Button>

        <Button
          onClick={onGoToProfile}
          disabled={isLoading}
          variant={recommendedAction === 'profile' ? 'default' : 'outline'}
          size="lg"
        >
          <User className="h-4 w-4" />
          {t('onboarding.summaryStep.goToProfile')}
          <ArrowRight className="h-4 w-4" />
        </Button>

        {primarySelectedGroup && (
          <Button
            variant={recommendedAction === 'group' ? 'default' : 'outline'}
            onClick={onGoToGroup}
            disabled={isLoading}
            size="lg"
          >
            <Users className="h-4 w-4" />
            {t('onboarding.summaryStep.goToGroup')}
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
