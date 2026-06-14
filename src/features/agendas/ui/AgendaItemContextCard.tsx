'use client';

import { featureThemeClassName } from '@/features/shared/theme';
import { useElectionDetailsSectionController } from '@/features/agendas/hooks/useElectionDetailsSectionController';
import { Link, useNavigate } from '@tanstack/react-router';
import { Card, CardContent } from '@/features/shared/ui/ui/card';
import {
  Clock,
  Calendar,
  Vote,
  UserCheck,
  FileText,
  Users,
  ShieldCheck,
  Play,
  CheckCircle2,
  Timer,
} from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils';
import { addMinutes, format, formatDistanceToNow } from 'date-fns';
import type { Locale } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import {
  AgendaCountdownPill,
  AgendaEndedPill,
  AgendaStatusBadge,
  AgendaTypeBadge,
  AgendaElectionModeBadge,
} from './AgendaBadges';
import type { ElectionMode } from '@/features/elections/logic/electionMode';
import type { AmendmentPathVisualizationSegment } from '@/features/network/ui/AmendmentPathVisualization';
import { AmendmentProcessDetailsPanel } from '@/features/amendments/ui/AmendmentProcessDetailsPanel';
import { ElectionDetailsSectionView } from './ElectionDetailsSectionView';

interface AgendaItemContextCardProps {
  agendaItem: {
    id: string;
    title: string;
    description?: string;
    type: string;
    status: string;
    duration?: number;
    scheduledTime?: string;
    startTime?: Date;
    endTime?: Date;
    activatedAt?: Date;
    completedAt?: Date;
  };
  /** Amendment data for amendment-type agenda items */
  amendment?: {
    id: string;
    title?: string | null;
    reason?: string | null;
    preamble?: string | null;
    editing_mode?: string | null;
    change_request_count?: number;
    collaborator_count?: number;
    group?: { id: string; name?: string | null } | null;
  } | null;
  amendmentForwardingPreview?: {
    nextGroupId?: string | null;
    nextGroupName?: string | null;
    nextEventId?: string | null;
    nextEventTitle: string;
    nextEventStartDate?: number | null;
  } | null;
  amendmentPathVisualizationData?: AmendmentPathVisualizationSegment[];
  amendmentGroupTypeById?: Map<string, string | null>;
  onAmendmentGroupClick?: (groupId: string) => void;
  onAmendmentEventClick?: (eventId: string) => void;
  /** Election data for election-type agenda items */
  election?: {
    id: string;
    title?: string | null;
    election_mode?: ElectionMode | null;
    seat_count?: number | null;
    role?: {
      id: string;
      title?: string | null;
      description?: string | null;
      term?: string | null;
      group_id?: string | null;
      group?: { id: string; name?: string | null } | null;
    } | null;
  } | null;
  /** Voting/election opening time (when voting starts) */
  votingStartTime?: Date;
  /** Voting/election closing time (when voting ends) */
  votingEndTime?: Date;
  showHeaderStatusBadge?: boolean;
  agendaDetailLink?: {
    eventId: string;
    agendaItemId: string;
  } | null;
  className?: string;
}

function formatAgendaDateTime(date: Date, locale: Locale) {
  return format(date, 'dd.MM.yyyy p', { locale });
}

function getEstimatedEndTime(startAt?: Date, durationMinutes?: number | null) {
  if (!startAt || !durationMinutes) {
    return undefined;
  }

  return addMinutes(startAt, durationMinutes);
}

/**
 * Get type icon
 */
function getTypeIcon(type: string) {
  switch (type) {
    case 'election':
      return UserCheck;
    case 'vote':
      return Vote;
    case 'accreditation':
      return ShieldCheck;
    case 'speech':
      return Users;
    case 'discussion':
    default:
      return FileText;
  }
}

/**
 * Get gradient class based on type
 */
function getGradientClass(type: string) {
  switch (type) {
    case 'election':
      return featureThemeClassName('agendaAgendaItemContextCardDangerAccentGradientSurface');
    case 'vote':
      return featureThemeClassName('agendaAgendaItemContextCardDangerWarningGradientSurface');
    case 'accreditation':
      return featureThemeClassName('agendaAgendaItemContextCardSuccessTealGradientSurface');
    case 'speech':
      return featureThemeClassName('agendaAgendaItemContextCardInfoGradientSurface');
    default:
      return featureThemeClassName('agendaAgendaItemContextCardAccentGradientSurface');
  }
}

/**
 * AgendaItemContextCard - Section 1: Header card showing context
 *
 * Shows agenda item context and timing information.
 */
export function AgendaItemContextCard({
  agendaItem,
  amendment,
  amendmentForwardingPreview,
  amendmentPathVisualizationData,
  amendmentGroupTypeById,
  onAmendmentGroupClick,
  onAmendmentEventClick,
  election,
  votingStartTime,
  votingEndTime,
  showHeaderStatusBadge = true,
  agendaDetailLink,
  className,
}: AgendaItemContextCardProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const locale = i18n.language === 'de' ? de : enUS;
  const TypeIcon = getTypeIcon(agendaItem.type);
  const gradientClass = getGradientClass(agendaItem.type);

  const durationMinutes =
    typeof agendaItem.duration === 'number' && agendaItem.duration > 0 ? agendaItem.duration : null;
  const estimatedDurationMinutes = durationMinutes ?? 30;
  const scheduledAt = agendaItem.scheduledTime ? new Date(agendaItem.scheduledTime) : undefined;
  const actualStartedAt = agendaItem.activatedAt ?? agendaItem.startTime;
  const actualCompletedAt = agendaItem.completedAt ?? agendaItem.endTime;
  const estimatedStartedAt = scheduledAt ?? agendaItem.startTime;
  const estimatedCompletedAt = getEstimatedEndTime(estimatedStartedAt, estimatedDurationMinutes);
  const estimatedOngoingCompletedAt = getEstimatedEndTime(
    actualStartedAt,
    estimatedDurationMinutes
  );
  const isCompleted = agendaItem.status === 'completed' || !!actualCompletedAt;
  const isOngoing =
    !isCompleted && (agendaItem.status === 'in-progress' || agendaItem.status === 'active');
  const now = Date.now();
  const hasAgendaDetailLink = Boolean(agendaDetailLink?.eventId && agendaDetailLink?.agendaItemId);

  const formatRelativeTime = (value: Date) => {
    return formatDistanceToNow(value, { addSuffix: true, locale });
  };

  const navigateToAgendaDetail = () => {
    if (!agendaDetailLink) return;
    navigate({
      to: '/event/$id/agenda/$agendaItemId',
      params: { id: agendaDetailLink.eventId, agendaItemId: agendaDetailLink.agendaItemId },
    });
  };

  return (
    <Card className={cn('overflow-hidden', className)}>
      {/* Gradient Header */}
      <div
        className={cn('p-4', gradientClass, hasAgendaDetailLink ? 'cursor-pointer' : undefined)}
        onClick={hasAgendaDetailLink ? navigateToAgendaDetail : undefined}
        onKeyDown={
          hasAgendaDetailLink
            ? event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  navigateToAgendaDetail();
                }
              }
            : undefined
        }
        role={hasAgendaDetailLink ? 'button' : undefined}
        tabIndex={hasAgendaDetailLink ? 0 : undefined}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={featureThemeClassName(
                'agendaAgendaItemContextCardNeutralContrastBackground'
              )}
            >
              <TypeIcon className="h-6 w-6" />
            </div>
            <div>
              <h2
                className={featureThemeClassName('agendaAgendaItemContextCardNeutralContrastText')}
              >
                {hasAgendaDetailLink && agendaDetailLink ? (
                  <Link
                    to="/event/$id/agenda/$agendaItemId"
                    params={{
                      id: agendaDetailLink.eventId,
                      agendaItemId: agendaDetailLink.agendaItemId,
                    }}
                    className="hover:underline"
                  >
                    {agendaItem.title}
                  </Link>
                ) : amendment?.id ? (
                  <Link
                    to="/amendment/$id"
                    params={{ id: amendment.id }}
                    className="hover:underline"
                  >
                    {agendaItem.title}
                  </Link>
                ) : (
                  agendaItem.title
                )}
              </h2>
              <div className={featureThemeClassName('agendaAgendaItemContextCardNeutralText')}>
                <AgendaTypeBadge
                  type={
                    agendaItem.type as
                      | 'election'
                      | 'vote'
                      | 'speech'
                      | 'discussion'
                      | 'accreditation'
                  }
                />
                {showHeaderStatusBadge ? (
                  <AgendaStatusBadge
                    status={
                      agendaItem.status as
                        | 'completed'
                        | 'in-progress'
                        | 'pending'
                        | 'planned'
                        | 'active'
                    }
                  />
                ) : null}
                {durationMinutes && (
                  <div
                    className={featureThemeClassName(
                      'agendaAgendaItemContextCardNeutralContrastBadge'
                    )}
                  >
                    <Timer className="h-3 w-3" />
                    {durationMinutes} {t('common.minutes')}
                  </div>
                )}
                {election?.election_mode ? (
                  <AgendaElectionModeBadge
                    electionMode={election.election_mode}
                    seatCount={election.seat_count}
                    className={featureThemeClassName(
                      'agendaAgendaItemContextCardNeutralContrastBadgeAlpha'
                    )}
                  />
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      <CardContent className="space-y-4 p-4">
        {/* Timing Information */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {!isCompleted && !isOngoing && estimatedStartedAt && (
            <div className={featureThemeClassName('agendaAgendaItemContextCardWarningSurface')}>
              <div className="text-muted-foreground mb-1 flex items-center gap-1 text-xs">
                <Calendar className="h-3 w-3" />
                {t('features.events.agenda.estimatedStartAt')}
              </div>
              <div className="text-sm font-medium">
                {formatAgendaDateTime(estimatedStartedAt, locale)}
              </div>
              <div className="text-muted-foreground text-xs">
                {formatRelativeTime(estimatedStartedAt)}
              </div>
              {estimatedStartedAt.getTime() > now ? (
                <AgendaCountdownPill
                  className="mt-3"
                  label={t('features.events.stream.startsIn')}
                  endsAt={estimatedStartedAt}
                  tone="start"
                />
              ) : null}
            </div>
          )}

          {actualStartedAt && (isCompleted || isOngoing) && (
            <div className={featureThemeClassName('agendaAgendaItemContextCardSuccessSurface')}>
              <div className="text-muted-foreground mb-1 flex items-center gap-1 text-xs">
                <Play className="h-3 w-3" />
                {t('features.events.agenda.startedAt')}
              </div>
              <div className="text-sm font-medium">
                {formatAgendaDateTime(actualStartedAt, locale)}
              </div>
              <div className="text-muted-foreground text-xs">
                {formatRelativeTime(actualStartedAt)}
              </div>
            </div>
          )}

          {actualCompletedAt && isCompleted && (
            <div className={featureThemeClassName('agendaAgendaItemContextCardInfoSurface')}>
              <div className="text-muted-foreground mb-1 flex items-center gap-1 text-xs">
                <CheckCircle2 className="h-3 w-3" />
                {t('features.events.agenda.completedAt')}
              </div>
              <div className="text-sm font-medium">
                {formatAgendaDateTime(actualCompletedAt, locale)}
              </div>
              <div className="text-muted-foreground text-xs">
                {formatRelativeTime(actualCompletedAt)}
              </div>
              <AgendaEndedPill className="mt-3" endedAt={actualCompletedAt} />
            </div>
          )}

          {!isCompleted && estimatedCompletedAt && !isOngoing && (
            <div className={featureThemeClassName('agendaAgendaItemContextCardInfoSurface')}>
              <div className="text-muted-foreground mb-1 flex items-center gap-1 text-xs">
                <Clock className="h-3 w-3" />
                {t('features.events.agenda.estimatedCompleteAt')}
              </div>
              <div className="text-sm font-medium">
                {formatAgendaDateTime(estimatedCompletedAt, locale)}
              </div>
              <div className="text-muted-foreground text-xs">
                {formatRelativeTime(estimatedCompletedAt)}
              </div>
              {estimatedCompletedAt.getTime() > now ? (
                <AgendaCountdownPill
                  className="mt-3"
                  label={t('features.events.agenda.endsIn')}
                  endsAt={estimatedCompletedAt}
                  tone="end"
                />
              ) : null}
            </div>
          )}

          {!isCompleted && isOngoing && estimatedOngoingCompletedAt && (
            <div className={featureThemeClassName('agendaAgendaItemContextCardSuccessSurface')}>
              <div className="text-muted-foreground mb-1 flex items-center gap-1 text-xs">
                <Clock className="h-3 w-3" />
                {t('features.events.agenda.estimatedCompleteAt')}
              </div>
              <div className="text-sm font-medium">
                {formatAgendaDateTime(estimatedOngoingCompletedAt, locale)}
              </div>
              <div className="text-muted-foreground text-xs">
                {formatRelativeTime(estimatedOngoingCompletedAt)}
              </div>
              {estimatedOngoingCompletedAt.getTime() > now ? (
                <AgendaCountdownPill
                  className="mt-3"
                  label={t('features.events.agenda.endsIn')}
                  endsAt={estimatedOngoingCompletedAt}
                  tone="active"
                />
              ) : null}
            </div>
          )}

          {durationMinutes && (
            <div className={featureThemeClassName('agendaAgendaItemContextCardNeutralSurface')}>
              <div className="text-muted-foreground mb-1 flex items-center gap-1 text-xs">
                <Timer className="h-3 w-3" />
                {t('features.events.agenda.duration')}
              </div>
              <div className="text-sm font-medium">
                {durationMinutes} {t('common.minutes')}
              </div>
            </div>
          )}

          {votingStartTime && (
            <div className={featureThemeClassName('agendaAgendaItemContextCardWarningSurface')}>
              <div className="text-muted-foreground mb-1 flex items-center gap-1 text-xs">
                <Vote className="h-3 w-3" />
                {t('features.events.agenda.votingStart')}
              </div>
              <div className="text-sm font-medium">
                {format(votingStartTime, 'PPp', { locale })}
              </div>
              <div className="text-muted-foreground text-xs">
                {formatRelativeTime(votingStartTime)}
              </div>
              {votingStartTime.getTime() > now ? (
                <AgendaCountdownPill
                  className="mt-3"
                  label={t('features.events.stream.startsIn')}
                  endsAt={votingStartTime}
                  tone="start"
                />
              ) : null}
            </div>
          )}

          {votingEndTime && (
            <div className={featureThemeClassName('agendaAgendaItemContextCardDangerSurface')}>
              <div className="text-muted-foreground mb-1 flex items-center gap-1 text-xs">
                <Clock className="h-3 w-3" />
                {t('features.events.agenda.votingEnd')}
              </div>
              <div className="text-sm font-medium">{format(votingEndTime, 'PPp', { locale })}</div>
              <div className="text-muted-foreground text-xs">
                {formatRelativeTime(votingEndTime)}
              </div>
              {votingEndTime.getTime() > now ? (
                <AgendaCountdownPill
                  className="mt-3"
                  label={t('features.events.agenda.endsIn')}
                  endsAt={votingEndTime}
                  tone="end"
                />
              ) : (
                <AgendaEndedPill className="mt-3" endedAt={votingEndTime} />
              )}
            </div>
          )}
        </div>

        {/* Description */}
        {agendaItem.description && (
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-muted-foreground text-sm whitespace-pre-wrap">
              {agendaItem.description}
            </p>
          </div>
        )}

        {/* Amendment details (collapsible) */}
        {amendment && (
          <AmendmentProcessDetailsPanel
            amendment={amendment}
            forwardingPreview={amendmentForwardingPreview}
            pathVisualizationData={amendmentPathVisualizationData}
            groupTypeById={amendmentGroupTypeById}
            onGroupClick={onAmendmentGroupClick}
            onEventClick={onAmendmentEventClick}
          />
        )}

        {/* Election / Role details (collapsible) */}
        {election?.role && <ElectionDetailsSection election={election} />}
      </CardContent>
    </Card>
  );
}

// ── Election / Role collapsible details ─────────────────────────────

function ElectionDetailsSection({
  election,
}: {
  election: NonNullable<AgendaItemContextCardProps['election']>;
}) {
  const controller = useElectionDetailsSectionController();

  return <ElectionDetailsSectionView election={election} {...controller} />;
}
