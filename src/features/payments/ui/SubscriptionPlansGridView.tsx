import { featureThemeClassName } from '@/features/shared/theme';
import { FormControlInput } from '@/features/shared/ui/form';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import { Loader2 } from 'lucide-react';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface SubscriptionPlansGridViewProps {
  activeAmount: number;
  isLoading: boolean;
  onSubscribe: (priceId: string) => void;
  onCancel: () => void;
  isPlanActive: (amount: number) => boolean;
  hasCustomPlan: boolean;
  customAmount: string;
  customAmountValue: string;
  priceIds: {
    running: string;
    development: string;
  };
  onAmountChange: (value: string) => void;
  onCustomSubmit: () => void;
}

export function SubscriptionPlansGridView({
  activeAmount,
  isLoading,
  onSubscribe,
  onCancel,
  isPlanActive,
  hasCustomPlan,
  customAmount,
  customAmountValue,
  priceIds,
  onAmountChange,
  onCustomSubmit,
}: SubscriptionPlansGridViewProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {translateText('generated.inline.0984_subscribe_to_support_polity_a1be637e')}
        </CardTitle>
        <CardDescription>
          {translateText(
            'generated.inline.0985_help_us_keep_the_platform_running_and_growing_ee0bbacc'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div
            className={`rounded-lg border p-4 transition-shadow ${
              activeAmount === 0
                ? featureThemeClassName('paymentSubscriptionPlansGridSuccessSurface')
                : 'hover:shadow-md'
            }`}
          >
            <div className="mb-2">
              <div className="mb-1 flex items-center justify-between">
                <h3 className="font-semibold">
                  {translateText('generated.inline.0752_free_75f52718')}
                </h3>
                {activeAmount === 0 && (
                  <span
                    className={featureThemeClassName('paymentSubscriptionPlansGridSuccessPanel')}
                  >
                    {translateText('generated.inline.0986_current_4fc0e2bc')}
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold">€0</p>
              <p className="text-muted-foreground text-xs">/month</p>
            </div>
            <p className="text-muted-foreground mb-4 text-sm">
              {translateText('generated.inline.0987_full_access_to_all_features_8315d07d')}
            </p>
            <Button
              type="button"
              variant={activeAmount === 0 ? 'default' : 'outline'}
              size="sm"
              className="w-full"
              onClick={() => activeAmount !== 0 && onCancel()}
              disabled={isLoading || activeAmount === 0}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {translateText('generated.inline.0988_processing_272bc02e')}
                </>
              ) : activeAmount === 0 ? (
                translateText('generated.inline.0126_active_a733b809')
              ) : (
                translateText('generated.inline.0127_switch_to_free_5a577638')
              )}
            </Button>
          </div>

          <div
            className={`rounded-lg border p-4 transition-shadow ${
              isPlanActive(200)
                ? featureThemeClassName('paymentSubscriptionPlansGridSuccessSurface')
                : 'hover:shadow-md'
            }`}
          >
            <div className="mb-2">
              <div className="mb-1 flex items-center justify-between">
                <h3 className="font-semibold">
                  {translateText('generated.inline.0989_running_costs_53720f67')}
                </h3>
                {isPlanActive(200) && (
                  <span
                    className={featureThemeClassName('paymentSubscriptionPlansGridSuccessPanel')}
                  >
                    {translateText('generated.inline.0986_current_4fc0e2bc')}
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold">€2</p>
              <p className="text-muted-foreground text-xs">/month</p>
            </div>
            <p className="text-muted-foreground mb-4 text-sm">
              {translateText(
                'generated.inline.0990_cover_server_costs_and_infrastructure_862c080e'
              )}
            </p>
            <Button
              type="button"
              variant={isPlanActive(200) ? 'default' : 'outline'}
              size="sm"
              className="w-full"
              onClick={() => !isPlanActive(200) && onSubscribe(priceIds.running)}
              disabled={isLoading || !priceIds.running || isPlanActive(200)}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {translateText('generated.inline.0988_processing_272bc02e')}
                </>
              ) : isPlanActive(200) ? (
                translateText('generated.inline.0126_active_a733b809')
              ) : (
                translateText('generated.inline.0128_subscribe_d6981f74')
              )}
            </Button>
          </div>

          <div
            className={`rounded-lg border p-4 transition-shadow ${
              isPlanActive(1000)
                ? featureThemeClassName('paymentSubscriptionPlansGridSuccessSurface')
                : 'border-primary shadow-md hover:shadow-lg'
            }`}
          >
            <div className="mb-2">
              <div className="mb-1 flex items-center justify-between">
                <h3 className="font-semibold">
                  {translateText('generated.inline.0991_development_4c17aadf')}
                </h3>
                {isPlanActive(1000) ? (
                  <span
                    className={featureThemeClassName('paymentSubscriptionPlansGridSuccessPanel')}
                  >
                    {translateText('generated.inline.0986_current_4fc0e2bc')}
                  </span>
                ) : (
                  <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs">
                    {translateText('generated.inline.0992_popular_9bc2c5b3')}
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold">€10</p>
              <p className="text-muted-foreground text-xs">/month</p>
            </div>
            <p className="text-muted-foreground mb-4 text-sm">
              {translateText('generated.inline.0993_fund_new_features_and_improvements_d23cf557')}
            </p>
            <Button
              type="button"
              size="sm"
              className="w-full"
              variant={isPlanActive(1000) ? 'default' : undefined}
              onClick={() => !isPlanActive(1000) && onSubscribe(priceIds.development)}
              disabled={isLoading || !priceIds.development || isPlanActive(1000)}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {translateText('generated.inline.0988_processing_272bc02e')}
                </>
              ) : isPlanActive(1000) ? (
                translateText('generated.inline.0126_active_a733b809')
              ) : (
                translateText('generated.inline.0128_subscribe_d6981f74')
              )}
            </Button>
          </div>

          <div
            className={`rounded-lg border p-4 transition-shadow ${
              hasCustomPlan
                ? featureThemeClassName('paymentSubscriptionPlansGridSuccessSurface')
                : 'hover:shadow-md'
            }`}
          >
            <div className="mb-2">
              <div className="mb-1 flex items-center justify-between">
                <h3 className="font-semibold">
                  {translateText('generated.inline.0994_your_choice_668515a1')}
                </h3>
                {hasCustomPlan && (
                  <span
                    className={featureThemeClassName('paymentSubscriptionPlansGridSuccessPanel')}
                  >
                    {translateText('generated.inline.0986_current_4fc0e2bc')}
                  </span>
                )}
              </div>
              <div className="mb-1 flex items-baseline gap-1">
                <span className="mr-1 text-2xl font-bold">€</span>
                {hasCustomPlan ? (
                  <span className="text-2xl font-bold">{(activeAmount / 100).toFixed(0)}</span>
                ) : (
                  <FormControlInput
                    type="text"
                    inputMode="numeric"
                    maxLength={3}
                    value={customAmount}
                    onChange={e => onAmountChange(e.target.value.slice(-1))}
                    onKeyDown={e => {
                      if (e.key === 'Backspace') {
                        e.preventDefault();
                        onAmountChange('');
                      }
                    }}
                    placeholder="0"
                    className="h-10 w-20"
                  />
                )}
              </div>
              <p className="text-muted-foreground text-xs">/month</p>
            </div>
            <p className="text-muted-foreground mb-4 text-sm">
              {translateText(
                'generated.inline.0995_voluntary_amount_to_support_the_platform_b35bab29'
              )}
            </p>
            <Button
              type="button"
              variant={hasCustomPlan ? 'default' : 'outline'}
              size="sm"
              className="w-full"
              onClick={onCustomSubmit}
              disabled={isLoading || customAmountValue === '0' || hasCustomPlan}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {translateText('generated.inline.0988_processing_272bc02e')}
                </>
              ) : hasCustomPlan ? (
                translateText('generated.inline.0126_active_a733b809')
              ) : (
                translateText('generated.inline.0128_subscribe_d6981f74')
              )}
            </Button>
          </div>
        </div>

        <div className="bg-muted rounded-lg p-3">
          <p className="text-muted-foreground text-xs">
            {translateText(
              'generated.inline.0996_all_features_remain_free_your_contribution_he_4b402e38'
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
