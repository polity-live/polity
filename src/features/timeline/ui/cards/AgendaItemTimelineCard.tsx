'use client';

import { Calendar, Clock3, Hash, Tag } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { Badge } from '@/features/shared/ui/ui/badge';
import { cn } from '@/features/shared/utils/utils';
import { normalizeTimelineText } from '@/features/timeline/logic/normalizeTimelineText';
import {
  TimelineCardBase,
  TimelineCardHeader,
  TimelineCardContent,
  TimelineCardBadge,
} from './TimelineCardBase';

export interface AgendaItemTimelineCardProps {
  agendaItem: {
    id: string;
    title: string;
    description?: string | null;
    type?: string | null;
    status?: string | null;
    orderIndex?: number | null;
    scheduledTime?: string | Date | null;
    durationMinutes?: number | null;
    eventId?: string | null;
    eventName?: string | null;
    createdAt?: string | Date | null;
  };
  className?: string;
}

function formatLabel(value?: string | null): string | null {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  return normalized.replace(/[_-]/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function formatDateTime(value?: string | Date | null): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return typeof value === 'string' && value.trim() ? value : null;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}

function getStatusBadgeClass(status?: string | null): string {
  switch (status) {
    case 'active':
    case 'in-progress':
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
    case 'completed':
      return 'bg-blue-500/15 text-blue-700 dark:text-blue-300';
    case 'pending':
    case 'planned':
      return 'bg-amber-500/15 text-amber-700 dark:text-amber-300';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export function AgendaItemTimelineCard({ agendaItem, className }: AgendaItemTimelineCardProps) {
  const { t } = useTranslation();
  const eventHref = agendaItem.eventId ? `/event/${agendaItem.eventId}/agenda` : undefined;
  const typeLabel = formatLabel(agendaItem.type);
  const statusLabel = formatLabel(agendaItem.status);
  const scheduledTimeLabel = formatDateTime(agendaItem.scheduledTime);
  const createdAtLabel = formatDateTime(agendaItem.createdAt);
  const description = normalizeTimelineText(agendaItem.description);

  return (
    <TimelineCardBase contentType="agenda_item" className={className} href={eventHref}>
      <TimelineCardHeader
        contentType="agenda_item"
        title={agendaItem.title}
        href={eventHref}
        subtitle={agendaItem.eventName ?? undefined}
        subtitleHref={eventHref}
        badge={<TimelineCardBadge label={t('features.timeline.contentTypes.agendaItem')} />}
      />

      <TimelineCardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {typeLabel && (
            <Badge variant="outline">
              <Tag className="mr-1 h-3 w-3" />
              {typeLabel}
            </Badge>
          )}

          {statusLabel && (
            <Badge
              variant="secondary"
              className={cn('border-0', getStatusBadgeClass(agendaItem.status))}
            >
              {statusLabel}
            </Badge>
          )}
        </div>

        {description && <p className="text-muted-foreground line-clamp-3 text-sm">{description}</p>}

        <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
          {typeof agendaItem.orderIndex === 'number' && (
            <div className="flex items-center gap-1.5">
              <Hash className="h-3.5 w-3.5" />
              <span>{agendaItem.orderIndex}</span>
            </div>
          )}

          {(scheduledTimeLabel || createdAtLabel) && (
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              <span>{scheduledTimeLabel ?? createdAtLabel}</span>
            </div>
          )}

          {typeof agendaItem.durationMinutes === 'number' && agendaItem.durationMinutes > 0 && (
            <div className="flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5" />
              <span>
                {agendaItem.durationMinutes} {t('common.minutes', 'minutes')}
              </span>
            </div>
          )}
        </div>
      </TimelineCardContent>
    </TimelineCardBase>
  );
}
