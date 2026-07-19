import { useTranslation } from '@/features/shared/hooks/use-translation';
import { DateTimeRangeInput } from './DateTimeRangeInput';

interface TodoDeadlineInputProps {
  dueDate: string;
  dueTime: string;
  onChange: (values: { dueDate: string; dueTime: string }) => void;
}

export function TodoDeadlineInput({ dueDate, dueTime, onChange }: TodoDeadlineInputProps) {
  const { t } = useTranslation();

  return (
    <DateTimeRangeInput
      startDate={dueDate}
      startTime={dueTime}
      showEnd={false}
      heading={t('pages.create.todo.dueDateOptional')}
      hint={t('pages.create.todo.tips.dueDate')}
      startDateLabel={t('pages.create.todo.dueDateLabel')}
      startTimeLabel={t('pages.create.todo.dueTimeOptional')}
      startTimeDisabled={!dueDate}
      timeStep={60}
      onChange={(field, value) => {
        if (field === 'startDate') {
          onChange({ dueDate: value, dueTime: value ? dueTime : '' });
          return;
        }
        if (field === 'startTime') {
          onChange({ dueDate, dueTime: value });
        }
      }}
    />
  );
}
