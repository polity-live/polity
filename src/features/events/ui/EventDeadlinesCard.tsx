import { BadgeControl } from '@/features/shared/ui/status';
import { Card, CardContent, CardHeader, CardTitle } from '@/features/shared/ui/ui/card';
import { Clock, CalendarClock } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';

interface DeadlineItem {
  label: string;
  timestamp: number | null | undefined;
}

type ActiveDeadlineItem = DeadlineItem & { timestamp: number };

interface EventDeadlinesCardProps {
  registrationDeadline?: number | null;
  amendmentDeadline?: number | null;
  candidacyDeadline?: number | null;
}

function formatDeadlineDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getTimeRemaining(timestamp: number): { text: string; isPast: boolean } {
  const now = Date.now();
  const diff = timestamp - now;
  const isPast = diff < 0;
  const absDiff = Math.abs(diff);

  const days = Math.floor(absDiff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((absDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) {
    return { text: `${days}d ${hours}h`, isPast };
  }
  const minutes = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));
  return { text: `${hours}h ${minutes}m`, isPast };
}

function hasDeadlineTimestamp(deadline: DeadlineItem): deadline is ActiveDeadlineItem {
  return deadline.timestamp != null;
}

export function EventDeadlinesCard({
  registrationDeadline,
  amendmentDeadline,
  candidacyDeadline,
}: EventDeadlinesCardProps) {
  const { t } = useTranslation();

  const deadlines: ActiveDeadlineItem[] = [
    {
      label: t('features.events.deadlines.registration'),
      timestamp: registrationDeadline,
    },
    {
      label: t('features.events.deadlines.amendment'),
      timestamp: amendmentDeadline,
    },
    {
      label: t('features.events.deadlines.candidacy'),
      timestamp: candidacyDeadline,
    },
  ].filter(hasDeadlineTimestamp);

  if (deadlines.length === 0) return null;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5" />
          {t('features.events.deadlines.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {deadlines.map(deadline => {
          const remaining = getTimeRemaining(deadline.timestamp);
          return (
            <div
              key={deadline.label}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div className="space-y-1">
                <p className="text-sm font-medium">{deadline.label}</p>
                <p className="text-muted-foreground text-xs">
                  {formatDeadlineDate(deadline.timestamp)}
                </p>
              </div>
              <BadgeControl
                variant={remaining.isPast ? 'destructive' : 'secondary'}
                className="flex items-center gap-1"
              >
                <Clock className="h-3 w-3" />
                {remaining.isPast ? t('features.events.deadlines.expired') : remaining.text}
              </BadgeControl>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
