'use client';

import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowRight, Clock3, Timer } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { de, enUS } from 'date-fns/locale';

import { useTranslation } from '@/features/shared/hooks/use-translation';
import { BadgeControl } from '@/features/shared/ui/status';
import { cn } from '@/features/shared/utils/utils';
import { AgendaStatusBadge, AgendaTypeBadge } from './AgendaBadges';
import type { AgendaItemStatus } from './AgendaCard';
import { getAgendaDisplayType } from '../logic/agendaUiHelpers';

type AgendaHeaderDate = Date | number | string | null | undefined;

export interface AgendaActiveItemTiming {
  startAt?: AgendaHeaderDate;
  endAt?: AgendaHeaderDate;
  votingStartAt?: AgendaHeaderDate;
  votingEndAt?: AgendaHeaderDate;
  durationMinutes?: number | null;
  startIsEstimated?: boolean;
  endIsEstimated?: boolean;
}

export interface AgendaActiveItemHeaderProps {
  topLabel?: string | null;
  isLive?: boolean;
  status: AgendaItemStatus | 'active';
  type: string;
  title: string;
  description?: string | null;
  amendmentId?: string | null;
  group?: { id: string; name?: string | null } | null;
  timing?: AgendaActiveItemTiming;
  action?: ReactNode;
  className?: string;
}

interface TimingEntry {
  id: 'start' | 'end' | 'voting-start' | 'voting-end';
  date: Date;
  labelKey: string;
  fallback: string;
}

function toValidDate(value: AgendaHeaderDate) {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isDistinctTime(first: Date, second: Date | null) {
  if (!second) return true;
  return Math.abs(first.getTime() - second.getTime()) > 60_000;
}

export function getAgendaActiveItemTimingEntries(timing?: AgendaActiveItemTiming): TimingEntry[] {
  if (!timing) return [];

  const startAt = toValidDate(timing.startAt);
  const endAt = toValidDate(timing.endAt);
  const votingStartAt = toValidDate(timing.votingStartAt);
  const votingEndAt = toValidDate(timing.votingEndAt);
  const entries: TimingEntry[] = [];

  if (startAt) {
    entries.push({
      id: 'start',
      date: startAt,
      labelKey: timing.startIsEstimated
        ? 'features.events.agenda.estimatedStartAt'
        : 'features.events.agenda.startedAt',
      fallback: timing.startIsEstimated ? 'Estimated start' : 'Started',
    });
  }
  if (endAt) {
    entries.push({
      id: 'end',
      date: endAt,
      labelKey: timing.endIsEstimated
        ? 'features.events.agenda.estimatedCompleteAt'
        : 'features.events.agenda.completedAt',
      fallback: timing.endIsEstimated ? 'Estimated end' : 'Completed',
    });
  }
  if (votingStartAt && isDistinctTime(votingStartAt, startAt)) {
    entries.push({
      id: 'voting-start',
      date: votingStartAt,
      labelKey: 'features.events.agenda.votingStart',
      fallback: 'Voting start',
    });
  }
  if (votingEndAt && isDistinctTime(votingEndAt, endAt)) {
    entries.push({
      id: 'voting-end',
      date: votingEndAt,
      labelKey: 'features.events.agenda.votingEnd',
      fallback: 'Voting end',
    });
  }

  return entries;
}

export function AgendaActiveItemHeader({
  action,
  amendmentId,
  className,
  description,
  group,
  isLive = false,
  status,
  timing,
  title,
  topLabel,
  type,
}: AgendaActiveItemHeaderProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'de' ? de : enUS;
  const timingEntries = getAgendaActiveItemTimingEntries(timing);
  const primaryEntries = timingEntries.filter(entry => entry.id === 'start' || entry.id === 'end');
  const votingEntries = timingEntries.filter(
    entry => entry.id === 'voting-start' || entry.id === 'voting-end'
  );

  const renderTimingEntry = (entry: TimingEntry) => (
    <div key={entry.id} className="min-w-0 space-y-0.5">
      <div className="text-muted-foreground text-[11px] font-medium uppercase">
        {t(entry.labelKey, entry.fallback)}
      </div>
      <div className="text-sm font-medium tabular-nums">
        {format(entry.date, 'dd.MM.yyyy p', { locale })}
      </div>
      <div className="text-muted-foreground text-xs">
        {formatDistanceToNow(entry.date, { addSuffix: true, locale })}
      </div>
    </div>
  );

  return (
    <header
      className={cn(
        'border-border/70 bg-card/45 space-y-4 rounded-xl border px-4 py-4 shadow-none sm:px-5 sm:py-5',
        className
      )}
      data-agenda-active-item-header
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {topLabel ? <BadgeControl variant="outline">{topLabel}</BadgeControl> : null}
            {isLive ? (
              <BadgeControl variant="default" pulse>
                {t('features.events.stream.live', 'LIVE')}
              </BadgeControl>
            ) : null}
            <AgendaStatusBadge status={status} />
            <AgendaTypeBadge type={getAgendaDisplayType(type)} />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-xl leading-tight font-semibold tracking-tight sm:text-2xl">
              {amendmentId ? (
                <Link
                  to="/amendment/$id"
                  params={{ id: amendmentId }}
                  className="hover:text-primary focus-visible:ring-ring rounded-sm hover:underline focus-visible:ring-2 focus-visible:outline-none"
                >
                  {title}
                </Link>
              ) : (
                title
              )}
            </h1>
            {description ? (
              <p className="text-muted-foreground max-w-4xl text-sm whitespace-pre-wrap">
                {description}
              </p>
            ) : null}
          </div>

          {group?.id && group.name ? (
            <Link
              to="/group/$id"
              params={{ id: group.id }}
              className="text-muted-foreground hover:text-foreground inline-flex text-sm font-medium hover:underline"
            >
              {group.name}
            </Link>
          ) : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>

      {primaryEntries.length > 0 || votingEntries.length > 0 || timing?.durationMinutes ? (
        <div className="border-border/60 flex flex-wrap items-center gap-x-5 gap-y-3 border-t pt-3">
          <Clock3 className="text-muted-foreground h-4 w-4 shrink-0" />
          {primaryEntries.map((entry, index) => (
            <div key={entry.id} className="contents">
              {index > 0 ? <ArrowRight className="text-muted-foreground h-4 w-4" /> : null}
              {renderTimingEntry(entry)}
            </div>
          ))}
          {votingEntries.map(renderTimingEntry)}
          {timing?.durationMinutes ? (
            <BadgeControl variant="secondary" className="ml-auto">
              <Timer className="mr-1 h-3.5 w-3.5" />
              {timing.durationMinutes} {t('common.minutes', 'min')}
            </BadgeControl>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
