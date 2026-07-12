'use client';

import { featureThemeClassName } from '@/features/shared/theme';
import { useElectionDetailsSectionController } from '@/features/agendas/hooks/useElectionDetailsSectionController';
import { useNavigate } from '@tanstack/react-router';
import { Vote, UserCheck, FileText, Users, ShieldCheck } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { addMinutes, formatDistanceToNow } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import type { ElectionMode } from '@/features/elections/logic/electionMode';
import type { AmendmentPathVisualizationSegment } from '@/features/network/ui/AmendmentPathVisualization';

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
  presentation?: 'standalone' | 'embedded';
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
import { AgendaItemContextCardView } from './AgendaItemContextCardView';
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
  presentation = 'standalone',
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
  const electionDetailsController = useElectionDetailsSectionController();

  return (
    <AgendaItemContextCardView
      agendaItem={agendaItem}
      amendment={amendment}
      amendmentForwardingPreview={amendmentForwardingPreview}
      amendmentPathVisualizationData={amendmentPathVisualizationData}
      amendmentGroupTypeById={amendmentGroupTypeById}
      onAmendmentGroupClick={onAmendmentGroupClick}
      onAmendmentEventClick={onAmendmentEventClick}
      election={election}
      votingStartTime={votingStartTime}
      votingEndTime={votingEndTime}
      showHeaderStatusBadge={showHeaderStatusBadge}
      agendaDetailLink={agendaDetailLink}
      className={className}
      presentation={presentation}
      t={t}
      i18n={i18n}
      navigate={navigate}
      locale={locale}
      TypeIcon={TypeIcon}
      gradientClass={gradientClass}
      durationMinutes={durationMinutes}
      estimatedDurationMinutes={estimatedDurationMinutes}
      scheduledAt={scheduledAt}
      actualStartedAt={actualStartedAt}
      actualCompletedAt={actualCompletedAt}
      estimatedStartedAt={estimatedStartedAt}
      estimatedCompletedAt={estimatedCompletedAt}
      estimatedOngoingCompletedAt={estimatedOngoingCompletedAt}
      isCompleted={isCompleted}
      isOngoing={isOngoing}
      now={now}
      hasAgendaDetailLink={hasAgendaDetailLink}
      formatRelativeTime={formatRelativeTime}
      navigateToAgendaDetail={navigateToAgendaDetail}
      electionDetailsController={electionDetailsController}
    />
  );
}
