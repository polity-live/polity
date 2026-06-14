'use client';

import { featureThemeClassName } from '@/features/shared/theme';
import { Link } from '@tanstack/react-router';
import { Card, CardContent } from '@/features/shared/ui/ui/card';
import { Clock, Calendar, Vote, Play, CheckCircle2, Timer } from 'lucide-react';
import { cn } from '@/features/shared/utils/utils';
import { format } from 'date-fns';
import type { Locale } from 'date-fns';
import {
  AgendaCountdownPill,
  AgendaEndedPill,
  AgendaStatusBadge,
  AgendaTypeBadge,
  AgendaElectionModeBadge,
} from './AgendaBadges';
import { AmendmentProcessDetailsPanel } from '@/features/amendments/ui/AmendmentProcessDetailsPanel';
import { ElectionDetailsSectionView } from './ElectionDetailsSectionView';
function formatAgendaDateTime(date: Date, locale: Locale) {
  return format(date, 'dd.MM.yyyy p', { locale });
}
export interface AgendaItemContextCardViewProps {
  agendaItem: any;
  amendment: any;
  amendmentForwardingPreview: any;
  amendmentPathVisualizationData: any;
  amendmentGroupTypeById: any;
  onAmendmentGroupClick: any;
  onAmendmentEventClick: any;
  election: any;
  votingStartTime: any;
  votingEndTime: any;
  showHeaderStatusBadge: any;
  agendaDetailLink: any;
  className: any;
  t: any;
  i18n: any;
  navigate: any;
  locale: any;
  TypeIcon: any;
  gradientClass: any;
  durationMinutes: any;
  estimatedDurationMinutes: any;
  scheduledAt: any;
  actualStartedAt: any;
  actualCompletedAt: any;
  estimatedStartedAt: any;
  estimatedCompletedAt: any;
  estimatedOngoingCompletedAt: any;
  isCompleted: any;
  isOngoing: any;
  now: any;
  hasAgendaDetailLink: any;
  formatRelativeTime: any;
  navigateToAgendaDetail: any;
  electionDetailsController: any;
}

export function AgendaItemContextCardView({
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
  showHeaderStatusBadge,
  agendaDetailLink,
  className,
  t,
  locale,
  TypeIcon,
  gradientClass,
  durationMinutes,
  actualStartedAt,
  actualCompletedAt,
  estimatedStartedAt,
  estimatedCompletedAt,
  estimatedOngoingCompletedAt,
  isCompleted,
  isOngoing,
  now,
  hasAgendaDetailLink,
  formatRelativeTime,
  navigateToAgendaDetail,
  electionDetailsController,
}: AgendaItemContextCardViewProps) {
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
        {election?.role && (
          <ElectionDetailsSectionView election={election} {...electionDetailsController} />
        )}
      </CardContent>
    </Card>
  );
}
