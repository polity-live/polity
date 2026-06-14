import { SegmentedChoiceField } from '@/features/shared/ui/form';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';

type PaymentDirection = 'income' | 'expense';

interface DirectionInputProps {
  value: PaymentDirection;
  onChange: (direction: PaymentDirection) => void;
}

export function DirectionInput({ value, onChange }: DirectionInputProps) {
  const { t } = useTranslation();

  return (
    <SegmentedChoiceField
      label={t('pages.create.payment.direction')}
      value={value}
      onValueChange={onChange}
      options={[
        {
          value: 'income',
          label: t('pages.create.payment.income'),
          icon: ArrowDownLeft,
          tone: 'success',
        },
        {
          value: 'expense',
          label: t('pages.create.payment.expense'),
          icon: ArrowUpRight,
          tone: 'destructive',
        },
      ]}
    />
  );
}
