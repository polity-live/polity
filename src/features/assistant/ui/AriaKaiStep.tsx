import { featureThemeClassName } from '@/features/shared/theme';
import { MessageCircle, Sparkles } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar.tsx';
import { Button } from '@/features/shared/ui/ui/button.tsx';
import { BadgeControl } from '@/features/shared/ui/status';
import { ARIA_KAI_AVATAR_URL } from '@/features/assistant/constants';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { OnboardingStepShell } from '@/features/auth/onboarding/OnboardingStepShell';

interface AriaKaiStepProps {
  onNext: () => void;
}

export function AriaKaiStep({ onNext }: AriaKaiStepProps) {
  const { t } = useTranslation();

  return (
    <OnboardingStepShell
      actions={
        <div className="flex flex-col sm:flex-row sm:justify-end">
          <Button onClick={onNext} size="lg">
            {t('onboarding.ariaKaiStep.continue')}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <div>
          <div className="mb-4 flex justify-center">
            <Avatar className="h-20 w-20">
              <AvatarImage src={ARIA_KAI_AVATAR_URL} alt="" />
              <AvatarFallback
                className={featureThemeClassName('assistantAriaKaiStepInfoAccentGradientSurface')}
              >
                AK
              </AvatarFallback>
            </Avatar>
          </div>
          <h2 className="text-3xl leading-tight font-bold tracking-tight">
            {t('onboarding.ariaKaiStep.title')}
          </h2>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="space-y-5">
            <div className="bg-card rounded-lg border p-5 shadow-sm">
              <div className="space-y-4">
                <div className="flex gap-3">
                  <Sparkles className={featureThemeClassName('assistantAriaKaiStepAccentIcon')} />
                  <div>
                    <p className="text-muted-foreground text-sm leading-6">
                      {t('onboarding.ariaKaiStep.introLead')}
                      <span className="text-foreground font-semibold">
                        {t('onboarding.ariaKaiStep.introEmphasis')}
                      </span>
                      {t('onboarding.ariaKaiStep.introText')}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <MessageCircle
                    className={featureThemeClassName('assistantAriaKaiStepInfoIcon')}
                  />
                  <div>
                    <p className="text-muted-foreground text-sm leading-6">
                      {t('onboarding.ariaKaiStep.appHelp')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-4">
              <p className="mb-2 text-sm font-medium">{t('onboarding.ariaKaiStep.quickTip')}</p>
              <p className="text-muted-foreground text-sm leading-6">
                {t('onboarding.ariaKaiStep.tipText')}
              </p>
            </div>
          </div>

          <aside className="bg-card rounded-lg border p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">{t('onboarding.ariaKaiStep.assistantName')}</p>
              <BadgeControl variant="secondary">
                {t('onboarding.ariaKaiStep.assistantBadge')}
              </BadgeControl>
            </div>
            <div className="mt-5 space-y-3">
              <div className="bg-muted rounded-lg p-3 text-sm">
                {t('onboarding.ariaKaiStep.previewGreeting')}
              </div>
              <div className="bg-primary text-primary-foreground ml-8 rounded-lg p-3 text-sm">
                {t('onboarding.ariaKaiStep.previewPrompt')}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </OnboardingStepShell>
  );
}
