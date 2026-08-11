'use client';

import { BadgeControl, StatusBadge, type BadgeTone } from '@/features/shared/ui/status';
import { Calendar, Clock3, Hash, Tag } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
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
  href?: string;
  className?: string;
}

export function formatAgendaItemLabel(value?: string | null): string | null {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  return normalized.replace(/[_-]/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

export function formatAgendaItemDateTime(value?: string | Date | null): string | null {
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

export function getAgendaItemStatusBadgeTone(status?: string | null): BadgeTone {
  switch (status) {
    case 'active':
    case 'in-progress':
      return 'success';
    case 'completed':
      return 'info';
    case 'pending':
    case 'planned':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function AgendaItemTimelineCard({
  agendaItem,
  href,
  className,
}: AgendaItemTimelineCardProps) {
  const { t } = useTranslation();
  const eventHref =
    href ?? (agendaItem.eventId ? `/event/${agendaItem.eventId}/agenda` : undefined);
  const typeLabel = formatAgendaItemLabel(agendaItem.type);
  const statusLabel = formatAgendaItemLabel(agendaItem.status);
  const scheduledTimeLabel = formatAgendaItemDateTime(agendaItem.scheduledTime);
  const createdAtLabel = formatAgendaItemDateTime(agendaItem.createdAt);
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
            <BadgeControl variant="outline">
              <Tag className="mr-1 h-3 w-3" />
              {typeLabel}
            </BadgeControl>
          )}

          {statusLabel && (
            <StatusBadge
              status={agendaItem.status}
              tone={getAgendaItemStatusBadgeTone(agendaItem.status)}
            >
              {statusLabel}
            </StatusBadge>
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
