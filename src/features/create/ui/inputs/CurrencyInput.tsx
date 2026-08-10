import { FormControlLabel } from '@/features/shared/ui/form';
import { CurrencySelect } from '@/features/shared/ui/form/CurrencySelect';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { CurrencyCode } from '@/features/shared/logic/currency';

export function CurrencyInput({
  value,
  onChange,
}: {
  value: CurrencyCode;
  onChange: (currency: CurrencyCode) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      <FormControlLabel>{t('pages.create.payment.currency')}</FormControlLabel>
      <CurrencySelect
        data-action-id="create.currency.select"
        value={value}
        onChange={onChange}
        ariaLabel={t('pages.create.payment.currency')}
      />
    </div>
  );
}
