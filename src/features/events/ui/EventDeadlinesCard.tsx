import { BadgeControl } from '@/features/shared/ui/status';
import {
  CivicMotionTimeline,
  type CivicMotionTimelineItem,
} from '@/features/shared/ui/timeline/CivicMotionTimeline';
import { CalendarClock, Clock, FileEdit, Flag, Play, UserCheck } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';

interface DeadlineItem {
  icon?: CivicMotionTimelineItem['icon'];
  id: string;
  label: string;
  timestamp: number | null | undefined;
}

type ActiveDeadlineItem = DeadlineItem & { timestamp: number };
type EventTimelineCandidate = CivicMotionTimelineItem & { timestamp: number };

interface EventDeadlinesCardProps {
  amendmentDeadline?: number | null;
  candidacyDeadline?: number | null;
  endDate?: number | string | null;
  registrationDeadline?: number | null;
  startDate?: number | string | null;
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

function normalizeEventTimestamp(timestamp: number | string | null | undefined): number | null {
  if (typeof timestamp === 'number' && Number.isFinite(timestamp) && timestamp > 0) {
    return timestamp;
  }

  if (typeof timestamp === 'string') {
    const parsedTimestamp = Date.parse(timestamp);
    return Number.isNaN(parsedTimestamp) ? null : parsedTimestamp;
  }

  return null;
}

function getEventTimelineActiveIndex(items: EventTimelineCandidate[]) {
  const now = Date.now();
  let activeIndex = 0;

  items.forEach((item, index) => {
    if (item.timestamp <= now) {
      activeIndex = index;
    }
  });

  return activeIndex;
}

export function EventDeadlinesCard({
  registrationDeadline,
  amendmentDeadline,
  candidacyDeadline,
  startDate,
  endDate,
}: EventDeadlinesCardProps) {
  const { t } = useTranslation();

  const deadlineCandidates: DeadlineItem[] = [
    {
      id: 'registration-deadline',
      icon: CalendarClock,
      label: t('features.events.deadlines.registration'),
      timestamp: registrationDeadline,
    },
    {
      id: 'amendment-deadline',
      icon: FileEdit,
      label: t('features.events.deadlines.amendment'),
      timestamp: amendmentDeadline,
    },
    {
      id: 'candidacy-deadline',
      icon: UserCheck,
      label: t('features.events.deadlines.candidacy'),
      timestamp: candidacyDeadline,
    },
  ];
  const deadlines = deadlineCandidates.filter(hasDeadlineTimestamp);

  const eventStartTimestamp = normalizeEventTimestamp(startDate);
  const eventEndTimestamp = normalizeEventTimestamp(endDate);
  const timelineCandidates: EventTimelineCandidate[] = deadlines.map(deadline => {
    const remaining = getTimeRemaining(deadline.timestamp);

    return {
      description: (
        <BadgeControl
          variant={remaining.isPast ? 'destructive' : 'secondary'}
          className="inline-flex items-center gap-1"
        >
          <Clock className="h-3 w-3" />
          {remaining.isPast ? t('features.events.deadlines.expired') : remaining.text}
        </BadgeControl>
      ),
      id: deadline.id,
      label: deadline.label,
      timestamp: deadline.timestamp,
      tone: remaining.isPast ? 'danger' : 'warning',
      value: formatDeadlineDate(deadline.timestamp),
    };
  });

  if (eventStartTimestamp) {
    timelineCandidates.push({
      id: 'event-start',
      icon: Play,
      label: t('features.events.timeline.eventStart', 'Event start'),
      timestamp: eventStartTimestamp,
      tone: 'success',
      value: formatDeadlineDate(eventStartTimestamp),
    });
  }

  if (eventEndTimestamp) {
    timelineCandidates.push({
      id: 'event-end',
      icon: Flag,
      label: t('features.events.timeline.eventEnd', 'Event end'),
      timestamp: eventEndTimestamp,
      tone: 'info',
      value: formatDeadlineDate(eventEndTimestamp),
    });
  }

  const timelineItems = timelineCandidates.sort(
    (first, second) => first.timestamp - second.timestamp
  );
  const timelineActiveIndex = getEventTimelineActiveIndex(timelineItems);
  const motionTimelineItems = timelineItems.map((item, index) => ({
    ...item,
    isActive: index === timelineActiveIndex,
    isComplete: item.timestamp <= Date.now(),
  }));

  if (deadlines.length === 0 && motionTimelineItems.length < 2) return null;

  return (
    <section className="mb-8 space-y-4">
      <div className="px-3 sm:px-4">
        <h2 className="text-xl font-semibold">
          {motionTimelineItems.length > deadlines.length
            ? t('features.events.timeline.title', 'Schedule')
            : t('features.events.deadlines.title')}
        </h2>
      </div>

      {motionTimelineItems.length > 1 ? (
        <div className="px-3 py-2 sm:px-4">
          <CivicMotionTimeline
            activeIndex={timelineActiveIndex}
            ariaLabel={t('features.events.timeline.ariaLabel', 'Event timeline')}
            items={motionTimelineItems}
          />
        </div>
      ) : null}

      {deadlines.length > 0 ? (
        <div className="space-y-3 px-3 sm:px-4">
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
        </div>
      ) : null}
    </section>
  );
}
