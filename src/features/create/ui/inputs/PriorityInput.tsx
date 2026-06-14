import { SegmentedChoiceField } from '@/features/shared/ui/form';
import { useTranslation } from '@/features/shared/hooks/use-translation';

type Priority = 'low' | 'medium' | 'high';

interface PriorityInputProps {
  value: Priority;
  onChange: (priority: Priority) => void;
}

export function PriorityInput({ value, onChange }: PriorityInputProps) {
  const { t } = useTranslation();

  const options = [
    { value: 'low' as const, label: t('pages.create.todo.priority.low'), tone: 'success' as const },
    {
      value: 'medium' as const,
      label: t('pages.create.todo.priority.medium'),
      tone: 'warning' as const,
    },
    {
      value: 'high' as const,
      label: t('pages.create.todo.priority.high'),
      tone: 'destructive' as const,
    },
  ];

  return (
    <SegmentedChoiceField
      label={t('pages.create.todo.priorityLabel')}
      value={value}
      onValueChange={onChange}
      options={options}
    />
  );
}
