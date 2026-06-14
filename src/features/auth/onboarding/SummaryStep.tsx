'use client';

import { featureThemeClassName } from '@/features/shared/theme';
import { Button } from '@/features/shared/ui/ui/button.tsx';
import { Card, CardContent } from '@/features/shared/ui/ui/card.tsx';
import { Check, User, Users, Mail, ArrowRight, Sparkles, MessageCircle } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation.ts';
import type { Group } from '../hooks/useOnboarding.ts';

interface SummaryStepProps {
  firstName: string;
  lastName: string;
  selectedGroup: Group | null;
  membershipRequestSent: boolean;
  onGoToProfile: () => void;
  onGoToGroup: () => void;
  onGoToAssistant: () => void;
  isLoading?: boolean;
}

export function SummaryStep({
  firstName,
  lastName,
  selectedGroup,
  membershipRequestSent,
  onGoToProfile,
  onGoToGroup,
  onGoToAssistant,
  isLoading,
}: SummaryStepProps) {
  const { t } = useTranslation();
  const fullName = `${firstName} ${lastName}`;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mb-4 flex justify-center">
          <div className={featureThemeClassName('authSummaryStepWarningGradientSurface')}>
            <Sparkles className={featureThemeClassName('authGroupSearchStepContrastIcon')} />
          </div>
        </div>
        <h2 className="text-2xl font-bold">{t('onboarding.summaryStep.title')}</h2>
        <p className="text-muted-foreground mt-2">{t('onboarding.summaryStep.description')}</p>
      </div>

      {/* Summary Cards */}
      <div className="space-y-3">
        {/* Name Updated */}
        <Card surface="successSoft">
          <CardContent className="flex items-center gap-3 p-4">
            <div className={featureThemeClassName('authMembershipConfirmStepSuccessPanel')}>
              <User className={featureThemeClassName('authSummaryStepContrastIcon')} />
            </div>
            <div className="flex-1">
              <p className={featureThemeClassName('authSummaryStepSuccessText')}>
                {t('onboarding.summaryStep.nameUpdated')}
              </p>
              <p className={featureThemeClassName('authSummaryStepSuccessTextAlpha')}>{fullName}</p>
            </div>
            <Check className={featureThemeClassName('agendaAccreditationSectionSuccessIcon')} />
          </CardContent>
        </Card>

        {/* Group Selected */}
        {selectedGroup ? (
          <Card surface="blueSoft">
            <CardContent className="flex items-center gap-3 p-4">
              <div className={featureThemeClassName('authSummaryStepInfoPanel')}>
                <Users className={featureThemeClassName('authSummaryStepContrastIcon')} />
              </div>
              <div className="flex-1">
                <p className={featureThemeClassName('authSummaryStepInfoText')}>
                  {t('onboarding.summaryStep.groupSelected')}
                </p>
                <p className={featureThemeClassName('authSummaryStepInfoTextAlpha')}>
                  {selectedGroup.name}
                </p>
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

        {/* Membership Request */}
        {selectedGroup && membershipRequestSent && (
          <Card surface="purpleSoft">
            <CardContent className="flex items-center gap-3 p-4">
              <div className={featureThemeClassName('authSummaryStepAccentPanel')}>
                <Mail className={featureThemeClassName('authSummaryStepContrastIcon')} />
              </div>
              <div className="flex-1">
                <p className={featureThemeClassName('authSummaryStepAccentText')}>
                  {t('onboarding.summaryStep.membershipRequested')}
                </p>
                <p className={featureThemeClassName('authSummaryStepAccentTextAlpha')}>
                  {selectedGroup.name}
                </p>
              </div>
              <Check className={featureThemeClassName('authSummaryStepAccentIcon')} />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Action Buttons */}
      <div className="space-y-3 pt-4">
        <Button onClick={onGoToAssistant} disabled={isLoading} className="w-full" size="lg">
          <MessageCircle className="mr-2 h-4 w-4" />
          {t('onboarding.summaryStep.showAssistant')}
        </Button>

        <Button
          onClick={onGoToProfile}
          disabled={isLoading}
          variant="outline"
          className="w-full"
          size="lg"
        >
          {t('onboarding.summaryStep.goToProfile')}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>

        {selectedGroup && (
          <Button
            variant="outline"
            onClick={onGoToGroup}
            disabled={isLoading}
            className="w-full"
            size="lg"
          >
            {t('onboarding.summaryStep.goToGroup')}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
