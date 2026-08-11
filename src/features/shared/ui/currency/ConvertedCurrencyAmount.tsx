'use client';

import { useCurrencyConversion } from '@/features/shared/hooks/useCurrencyConversion';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { formatCurrencyMajor, type CurrencyCode } from '@/features/shared/logic/currency';
import { cn } from '@/features/shared/utils/utils';
import { TooltipHint } from '@/features/shared/ui/ui/tooltip';

export function ConvertedCurrencyAmount({
  amount,
  currency,
  date,
  targetCurrency,
  className,
  secondaryClassName,
  showOriginal = true,
}: {
  amount: number;
  currency: CurrencyCode;
  date?: string;
  targetCurrency?: CurrencyCode;
  className?: string;
  secondaryClassName?: string;
  showOriginal?: boolean;
}) {
  const { language, t } = useTranslation();
  const state = useCurrencyConversion({ amount, currency, date, targetCurrency });
  const differs = state.targetCurrency !== currency;
  const primary = state.conversion
    ? formatCurrencyMajor(state.conversion.convertedAmount, state.targetCurrency, language, {
        approximate: differs,
      })
    : formatCurrencyMajor(amount, currency, language);

  return (
    <span className={cn('inline-flex flex-col', className)}>
      <span>{primary}</span>
      {differs && state.conversion && showOriginal ? (
        <TooltipHint content={`1 ${currency} = ${state.conversion.rate} ${state.targetCurrency}`}>
          <span className={cn('text-muted-foreground text-xs font-normal', secondaryClassName)}>
            {formatCurrencyMajor(amount, currency, language)} · {state.conversion.rateDate} ·{' '}
            <a
              href="https://frankfurter.dev/"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Frankfurter
            </a>
            {state.conversion.cacheStatus === 'stale'
              ? ` · ${language === 'de' ? 'veraltet' : 'stale'}`
              : ''}
          </span>
        </TooltipHint>
      ) : differs && !state.conversion && !state.isLoading ? (
        <span className={cn('text-muted-foreground text-xs font-normal', secondaryClassName)}>
          {t('pages.create.payment.conversionUnavailable', 'Conversion unavailable')}
        </span>
      ) : null}
    </span>
  );
}
