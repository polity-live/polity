import { getCurrencyFractionDigits, type CurrencyCode } from '@/features/shared/logic/currency';

export function parseCreatePaymentAmount(value: string, currency?: CurrencyCode): number | null {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const parsedValue = Number(trimmedValue);

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    return null;
  }

  const fraction = trimmedValue.match(/\.(\d+)$/)?.[1]?.length ?? 0;
  if (fraction > (currency ? getCurrencyFractionDigits(currency) : 4)) return null;

  return parsedValue;
}
