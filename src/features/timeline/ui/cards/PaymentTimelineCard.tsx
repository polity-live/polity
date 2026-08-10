'use client';

import { featureThemeClassName } from '@/features/shared/theme';
import { BadgeControl } from '@/features/shared/ui/status';
import { ArrowDownLeft, ArrowUpRight, Calendar, Tag } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils';
import { normalizeTimelineText } from '@/features/timeline/logic/normalizeTimelineText';
import { useCurrencyConversion } from '@/features/shared/hooks/useCurrencyConversion';
import { formatCurrencyMajor, type CurrencyCode } from '@/features/shared/logic/currency';
import {
  TimelineCardBase,
  TimelineCardHeader,
  TimelineCardContent,
  TimelineCardBadge,
} from './TimelineCardBase';
import { TooltipHint } from '@/features/shared/ui/ui/tooltip';

export interface PaymentTimelineCardProps {
  payment: {
    id: string;
    label: string;
    description?: string | null;
    amount?: number | null;
    currency?: CurrencyCode | null;
    type?: string | null;
    direction?: 'income' | 'expense' | null;
    createdAt?: string | Date | null;
    groupId?: string | null;
    groupName?: string | null;
    counterpartyLabel?: string | null;
  };
  href?: string;
  className?: string;
}

export function formatTimelinePaymentDate(value?: string | Date | null): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
  }).format(parsed);
}

export function getTimelinePaymentRateDate(value?: string | Date | null): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString().slice(0, 10);
}

export function formatTimelinePaymentType(value?: string | null): string | null {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  return normalized.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

export function PaymentTimelineCard({ payment, href, className }: PaymentTimelineCardProps) {
  const { t, language } = useTranslation();
  const originalCurrency = payment.currency ?? 'EUR';
  const requestedDate = getTimelinePaymentRateDate(payment.createdAt);
  const { conversion, isLoading, targetCurrency } = useCurrencyConversion({
    amount: payment.amount,
    currency: originalCurrency,
    date: requestedDate,
  });
  const amountLabel = conversion
    ? formatCurrencyMajor(conversion.convertedAmount, targetCurrency, language, {
        approximate: targetCurrency !== originalCurrency,
      })
    : Number.isFinite(payment.amount)
      ? formatCurrencyMajor(payment.amount as number, originalCurrency, language)
      : null;
  const originalAmountLabel =
    conversion && targetCurrency !== originalCurrency
      ? formatCurrencyMajor(payment.amount ?? 0, originalCurrency, language)
      : null;
  const createdAtLabel = formatTimelinePaymentDate(payment.createdAt);
  const paymentTypeLabel = formatTimelinePaymentType(payment.type);
  const description = normalizeTimelineText(payment.description);
  const paymentHref = href ?? (payment.groupId ? `/group/${payment.groupId}` : undefined);
  const isIncome = payment.direction === 'income';
  const isExpense = payment.direction === 'expense';

  return (
    <TimelineCardBase contentType="payment" className={className} href={paymentHref}>
      <TimelineCardHeader
        contentType="payment"
        title={payment.label}
        href={paymentHref}
        subtitle={payment.groupName ?? undefined}
        subtitleHref={paymentHref}
        badge={<TimelineCardBadge label={t('features.timeline.contentTypes.payment')} />}
      />

      <TimelineCardContent className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            {amountLabel && (
              <>
                <p
                  className={cn(
                    'text-2xl font-semibold tracking-tight',
                    isIncome && featureThemeClassName('timelineContentTypeConfigSuccessText'),
                    isExpense && featureThemeClassName('timelinePaymentTimelineCardDangerText')
                  )}
                >
                  {amountLabel}
                </p>
                {originalAmountLabel ? (
                  <TooltipHint
                    content={`1 ${originalCurrency} = ${conversion?.rate} ${targetCurrency}; ${conversion?.rateDate}; Frankfurter`}
                  >
                    <p className="text-muted-foreground text-xs">
                      {originalAmountLabel} · {conversion?.rateDate} ·{' '}
                      <a
                        data-action-id="timeline.payment.exchange-source.open"
                        data-action-kind="navigation"
                        href="https://frankfurter.dev/"
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                      >
                        Frankfurter
                      </a>
                      {conversion?.cacheStatus === 'stale'
                        ? ` · ${language === 'de' ? 'veraltet' : 'stale'}`
                        : ''}
                    </p>
                  </TooltipHint>
                ) : !isLoading && targetCurrency !== originalCurrency ? (
                  <p className="text-muted-foreground text-xs">
                    {t('pages.create.payment.conversionUnavailable', 'Conversion unavailable')}
                  </p>
                ) : null}
              </>
            )}

            {payment.counterpartyLabel && (
              <p className="text-muted-foreground text-sm">{payment.counterpartyLabel}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {payment.direction && (
              <BadgeControl
                variant="secondary"
                className={cn(
                  'border-0',
                  isIncome && featureThemeClassName('timelinePaymentTimelineCardSuccessBackground'),
                  isExpense && featureThemeClassName('timelinePaymentTimelineCardDangerBackground')
                )}
              >
                {isIncome ? (
                  <ArrowDownLeft className="mr-1 h-3 w-3" />
                ) : (
                  <ArrowUpRight className="mr-1 h-3 w-3" />
                )}
                {isIncome ? t('pages.create.payment.income') : t('pages.create.payment.expense')}
              </BadgeControl>
            )}

            {paymentTypeLabel && (
              <BadgeControl variant="outline">
                <Tag className="mr-1 h-3 w-3" />
                {paymentTypeLabel}
              </BadgeControl>
            )}
          </div>
        </div>

        {description && <p className="text-muted-foreground line-clamp-3 text-sm">{description}</p>}

        {createdAtLabel && (
          <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <Calendar className="h-3.5 w-3.5" />
            <span>{createdAtLabel}</span>
          </div>
        )}
      </TimelineCardContent>
    </TimelineCardBase>
  );
}
