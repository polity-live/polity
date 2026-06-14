import { CalendarFilterBar, type CalendarFilterBarProps } from '@/features/shared/ui/calendar';

type CalendarSearchFilterProps = CalendarFilterBarProps;

export function CalendarSearchFilter(props: CalendarSearchFilterProps) {
  return <CalendarFilterBar {...props} />;
}
