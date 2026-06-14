'use client';

import { useMemo } from 'react';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { useEventWikiPage } from './hooks/useEventWikiPage';
import { AccessDenied as AccessDeniedView } from '@/features/auth/ui/AccessDenied';
import { formatNamedLocation } from '@/features/shared/logic/locationHelpers';
import { MeetingPage as MeetingPageView } from '@/features/meet/MeetingPage';
import { buildEventWikiIncumbentSections } from './logic/buildEventWikiIncumbentSections';
import { useDelegateAssemblyParticipantsComposition } from './hooks/useDelegateAssemblyParticipantsComposition';
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
    participantsDialogOpen,
    setParticipantsDialogOpen,
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
  const incumbentSections = buildEventWikiIncumbentSections(
    event.roles ?? [],
    event.participants ?? []
  );
  const isAssemblyEventType =
    event.event_type === 'delegate_assembly' || event.event_type === 'general_assembly';
  const shouldDisableParticipationRequest =
    isAssemblyEventType &&
    !participation.isParticipant &&
    !participation.hasRequested &&
    !participation.isInvited;
  const participationDisabledReason = shouldDisableParticipationRequest
    ? 'Only members of the associated group can participate in this general assembly'
    : undefined;
  const activeDelegateAssemblyParticipants = useMemo(
    () =>
      (event.participants ?? []).filter(participant =>
        ['active', 'member', 'admin', 'confirmed'].includes(participant.status ?? '')
      ),
    [event.participants]
  );
  const eventDescription = typeof event.description === 'string' ? event.description : undefined;
  const {
    showComposition,
    participantsWithProvenance,
    compositionBuckets,
    isLoading: compositionIsLoading,
  } = useDelegateAssemblyParticipantsComposition(event, activeDelegateAssemblyParticipants);
  const delegateParticipantsForDialog = showComposition
    ? participantsWithProvenance
    : activeDelegateAssemblyParticipants;
  return (
    <EventWikiContentView
      activeDelegateAssemblyParticipants={activeDelegateAssemblyParticipants}
      agendaStats={agendaStats}
      amendmentsCount={amendmentsCount}
      canAccess={canAccess}
      compositionBuckets={compositionBuckets}
      compositionIsLoading={compositionIsLoading}
      confirmDialogOpen={confirmDialogOpen}
      delegateParticipantsForDialog={delegateParticipantsForDialog}
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
      incumbentSections={incumbentSections}
      isAssemblyEventType={isAssemblyEventType}
      isSubmitting={isSubmitting}
      isSubscribed={isSubscribed}
      openChangeRequestsCount={openChangeRequestsCount}
      participantsDialogOpen={participantsDialogOpen}
      participantsWithProvenance={participantsWithProvenance}
      participation={participation}
      participationDisabledReason={participationDisabledReason}
      selectedElection={selectedElection}
      setConfirmDialogOpen={setConfirmDialogOpen}
      setElectionsDialogOpen={setElectionsDialogOpen}
      setParticipantsDialogOpen={setParticipantsDialogOpen}
      shouldDisableParticipationRequest={shouldDisableParticipationRequest}
      showComposition={showComposition}
      subscribeLoading={subscribeLoading}
      subscriberCount={subscriberCount}
      t={t}
      toggleSubscribe={toggleSubscribe}
      user={user}
    />
  );
}
