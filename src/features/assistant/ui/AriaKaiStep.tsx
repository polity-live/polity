import { featureThemeClassName } from '@/features/shared/theme';
import { FormControlCheckbox, FormControlLabel } from '@/features/shared/ui/form';
import { MessageCircle, Sparkles } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/features/shared/ui/ui/avatar.tsx';
import { Button } from '@/features/shared/ui/ui/button.tsx';
import { BadgeControl } from '@/features/shared/ui/status';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';

interface AriaKaiStepProps {
  onNext: () => void;
  dontShowAgain: boolean;
  onDontShowAgainChange: (checked: boolean) => void;
}

export function AriaKaiStep({ onNext, dontShowAgain, onDontShowAgainChange }: AriaKaiStepProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-4 flex">
          <Avatar className="h-20 w-20">
            <AvatarFallback
              className={featureThemeClassName('assistantAriaKaiStepInfoAccentGradientSurface')}
            >
              {translateText('generated.inline.0022_ak_059387a3')}
            </AvatarFallback>
          </Avatar>
        </div>
        <h2 className="text-3xl leading-tight font-bold tracking-tight">
          {t('onboarding.ariaKaiStep.title')}
        </h2>
        <p className="text-muted-foreground mt-3 max-w-2xl leading-7">
          {t('onboarding.ariaKaiStep.subtitle')}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-5">
          <div className="bg-card rounded-lg border p-5 shadow-sm">
            <div className="space-y-4">
              <div className="flex gap-3">
                <Sparkles className={featureThemeClassName('assistantAriaKaiStepAccentIcon')} />
                <div>
                  <p className="text-muted-foreground text-sm leading-6">
                    {translateText('generated.inline.0213_hey_we_re_4a4765ae')}
                    <span className="text-foreground font-semibold">
                      {translateText('generated.inline.0214_aria_kai_03dc3528')}
                    </span>
                    {translateText(
                      'generated.inline.0215_and_we_re_here_to_help_you_navigate_polity_an_e4c4d58f'
                    )}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <MessageCircle className={featureThemeClassName('assistantAriaKaiStepInfoIcon')} />
                <div>
                  <p className="text-muted-foreground text-sm leading-6">
                    {translateText(
                      'generated.inline.0216_whenever_you_need_assistance_tips_or_want_to__3d68725b'
                    )}{' '}
                    <span className="text-foreground font-semibold">
                      {translateText(
                        'generated.inline.0217_find_us_in_your_message_conversations_a1ecb063'
                      )}
                    </span>
                    {translateText('generated.inline.0218_we_re_always_ready_to_help_788f161a')}
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
            <p className="text-sm font-semibold">
              {translateText('generated.inline.0214_aria_kai_03dc3528')}
            </p>
            <BadgeControl variant="secondary">
              {t('onboarding.ariaKaiStep.assistantBadge')}
            </BadgeControl>
          </div>
          <div className="mt-5 space-y-3">
            <div className="bg-muted rounded-lg p-3 text-sm">
              {translateText('generated.inline.0213_hey_we_re_4a4765ae')}
              <span className="font-semibold">
                {translateText('generated.inline.0214_aria_kai_03dc3528')}
              </span>
            </div>
            <div className="bg-primary text-primary-foreground ml-8 rounded-lg p-3 text-sm">
              {t('onboarding.ariaKaiStep.previewPrompt')}
            </div>
          </div>
        </aside>
      </div>

      <div className="flex flex-col gap-4 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center space-x-2">
          <FormControlCheckbox
            id="dont-show-again"
            checked={dontShowAgain}
            onCheckedChange={onDontShowAgainChange}
          />
          <FormControlLabel htmlFor="dont-show-again">
            {t('onboarding.ariaKaiStep.dontShowAgain')}
          </FormControlLabel>
        </div>

        <Button onClick={onNext} size="lg">
          {t('onboarding.ariaKaiStep.continue')}
        </Button>
      </div>
    </div>
  );
}
