'use client';

import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { useEventWikiPage } from './hooks/useEventWikiPage';
import { AccessDenied as AccessDeniedView } from '@/features/auth/ui/AccessDenied';
import { formatNamedLocation } from '@/features/shared/logic/locationHelpers';
import { MeetingPage as MeetingPageView } from '@/features/meet/MeetingPage';
import { EventWikiContentView } from './EventWikiContentView';

interface EventWikiProps {
  eventId: string;
}

function EventWikiNotFoundView() {
  return (
    <div>
      <div className="py-12 text-center">
        <h1 className="mb-4 text-2xl font-bold">
          {translateText('generated.inline.0426_event_not_found_4ef6dec4')}
        </h1>
        <p className="text-muted-foreground">
          {translateText(
            'generated.inline.0427_the_event_you_re_looking_for_doesn_t_exist_or_dc22b4b7'
          )}
        </p>
      </div>
    </div>
  );
}

export function EventWiki({ eventId }: EventWikiProps) {
  const { t } = useTranslation();
  const {
    user,
    canAccess,
    isSubscribed,
    subscriberCount,
    toggleSubscribe,
    isLoading: subscribeLoading,
    participation,
    event,
    agendaStats,
    elections,
    electionsDialogOpen,
    setElectionsDialogOpen,
    confirmDialogOpen,
    setConfirmDialogOpen,
    selectedElection,
    isSubmitting,
    getUserCandidacy,
    handleElectionClick,
    handleConfirmCandidacy,
  } = useEventWikiPage(eventId);

  if (!event) {
    return <EventWikiNotFoundView />;
  }

  if (!canAccess) {
    return <AccessDeniedView />;
  }

  if (event.event_type === 'meeting' || event.meeting_type) {
    return <MeetingPageView meetingId={eventId} />;
  }

  const { electionsCount, amendmentsCount, openChangeRequestsCount } = agendaStats;
  const formattedLocation = formatNamedLocation(event.location_name, event);
  const isAssemblyEventType =
    event.event_type === 'delegate_assembly' || event.event_type === 'general_assembly';
  const isInviteOnlyEvent = event.event_type === 'on_invite';
  const canStartParticipationRequest =
    !participation.isParticipant && !participation.hasRequested && !participation.isInvited;
  const shouldDisableParticipationRequest =
    canStartParticipationRequest && (isAssemblyEventType || isInviteOnlyEvent);
  const participationDisabledReason =
    canStartParticipationRequest && isInviteOnlyEvent
      ? translateText('generated.inline.0468_this_event_is_by_invitation_only_904d226e')
      : canStartParticipationRequest && isAssemblyEventType
        ? 'Only members of the associated group can participate in this general assembly'
        : undefined;
  const eventDescription = typeof event.description === 'string' ? event.description : undefined;
  return (
    <EventWikiContentView
      agendaStats={agendaStats}
      amendmentsCount={amendmentsCount}
      canAccess={canAccess}
      confirmDialogOpen={confirmDialogOpen}
      elections={elections}
      electionsCount={electionsCount}
      electionsDialogOpen={electionsDialogOpen}
      event={event}
      eventDescription={eventDescription}
      eventId={eventId}
      formattedLocation={formattedLocation}
      getUserCandidacy={getUserCandidacy}
      handleConfirmCandidacy={handleConfirmCandidacy}
      handleElectionClick={handleElectionClick}
      isAssemblyEventType={isAssemblyEventType}
      isSubmitting={isSubmitting}
      isSubscribed={isSubscribed}
      openChangeRequestsCount={openChangeRequestsCount}
      participation={participation}
      participationDisabledReason={participationDisabledReason}
      selectedElection={selectedElection}
      setConfirmDialogOpen={setConfirmDialogOpen}
      setElectionsDialogOpen={setElectionsDialogOpen}
      shouldDisableParticipationRequest={shouldDisableParticipationRequest}
      subscribeLoading={subscribeLoading}
      subscriberCount={subscriberCount}
      t={t}
      toggleSubscribe={toggleSubscribe}
      user={user}
    />
  );
}
