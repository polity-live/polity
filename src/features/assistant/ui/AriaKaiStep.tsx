import { MessageCircle, Sparkles } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/features/shared/ui/ui/avatar.tsx';
import { Button } from '@/features/shared/ui/ui/button.tsx';
import { Checkbox } from '@/features/shared/ui/ui/checkbox.tsx';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card.tsx';
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
    <Card className="w-full">
      <CardHeader className="pb-4 text-center">
        <div className="mb-4 flex justify-center">
          <Avatar className="h-20 w-20">
            <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-500 text-2xl text-white">
              {translateText('generated.inline.0022_ak_059387a3')}
            </AvatarFallback>
          </Avatar>
        </div>
        <CardTitle className="text-2xl">{t('onboarding.ariaKaiStep.title')}</CardTitle>
        <CardDescription className="text-base">
          {t('onboarding.ariaKaiStep.subtitle')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 flex-shrink-0 text-purple-500" />
            <div>
              <p className="text-muted-foreground text-sm">
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
            <MessageCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-500" />
            <div>
              <p className="text-muted-foreground text-sm">
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

        <div className="bg-muted/50 rounded-lg p-4">
          <p className="mb-2 text-sm font-medium">{t('onboarding.ariaKaiStep.quickTip')}</p>
          <p className="text-muted-foreground text-sm">{t('onboarding.ariaKaiStep.tipText')}</p>
        </div>

        <div className="flex items-center space-x-2 pt-2">
          <Checkbox
            id="dont-show-again"
            checked={dontShowAgain}
            onCheckedChange={onDontShowAgainChange}
          />
          <label htmlFor="dont-show-again" className="text-muted-foreground cursor-pointer text-sm">
            {t('onboarding.ariaKaiStep.dontShowAgain')}
          </label>
        </div>

        <Button onClick={onNext} className="w-full" size="lg">
          {t('onboarding.ariaKaiStep.continue')}
        </Button>
      </CardContent>
    </Card>
  );
}
