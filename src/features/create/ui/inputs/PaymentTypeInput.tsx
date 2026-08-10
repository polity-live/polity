import {
  FormControlLabel,
  FormControlSelect,
  FormControlSelectContent,
  FormControlSelectItem,
  FormControlSelectTrigger,
  FormControlSelectValue,
} from '@/features/shared/ui/form';
import { useTranslation } from '@/features/shared/hooks/use-translation';

const PAYMENT_TYPES = [
  'membership_fee',
  'donation',
  'subsidies',
  'campaign',
  'material',
  'events',
  'others',
] as const;

type PaymentType = (typeof PAYMENT_TYPES)[number];

interface PaymentTypeInputProps {
  value: PaymentType;
  onChange: (type: PaymentType) => void;
}

export function PaymentTypeInput({ value, onChange }: PaymentTypeInputProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <FormControlLabel>{t('pages.create.payment.typeField')}</FormControlLabel>
      <FormControlSelect
        data-action-id="create.payment-type.select"
        value={value}
        onValueChange={v => onChange(v as PaymentType)}
      >
        <FormControlSelectTrigger data-action-id="create.payment-type.select">
          <FormControlSelectValue />
        </FormControlSelectTrigger>
        <FormControlSelectContent>
          {PAYMENT_TYPES.map(type => (
            <FormControlSelectItem
              data-action-id="create.payment-type.option"
              key={type}
              value={type}
              data-create-option={type}
            >
              {t(`pages.create.payment.types.${type}`)}
            </FormControlSelectItem>
          ))}
        </FormControlSelectContent>
      </FormControlSelect>
    </div>
  );
}
