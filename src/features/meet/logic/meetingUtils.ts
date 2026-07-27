import { featureThemeClassName } from '@/features/shared/theme';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
export function calculateDuration(startTime: string | number, endTime: string | number): string {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const durationMs = end.getTime() - start.getTime();
  const durationMinutes = Math.floor(durationMs / 60000);

  if (durationMinutes < 60) {
    return translateText('features.meet.duration.minutes', { count: durationMinutes });
  }

  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;

  if (minutes === 0) {
    return translateText('features.meet.duration.hours', { count: hours });
  }

  const key =
    hours === 1
      ? minutes === 1
        ? 'oneHourOneMinute'
        : 'oneHourManyMinutes'
      : minutes === 1
        ? 'manyHoursOneMinute'
        : 'manyHoursManyMinutes';
  return translateText(`features.meet.duration.${key}`, { hours, minutes });
}

export function getMeetingStatus(
  isAvailable: boolean,
  isPast: boolean
): { label: string; variant: 'default' | 'outline' | 'destructive'; className?: string } {
  if (isPast) {
    return {
      label: translateText('generated.inline.0174_past_meeting_bcf6e6c4'),
      variant: 'outline',
    };
  }

  if (isAvailable) {
    return {
      label: translateText('generated.inline.0175_available_7c62a142'),
      variant: 'default',
      className: featureThemeClassName('agendaAgendaVoteSectionSuccessBackground'),
    };
  }

  return {
    label: translateText('generated.inline.0176_fully_booked_e5b07b41'),
    variant: 'destructive',
  };
}
