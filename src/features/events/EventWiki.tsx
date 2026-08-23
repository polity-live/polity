'use client';

import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { useEventWikiPage } from './hooks/useEventWikiPage';
import { useCreateRecoveryDraft } from '@/features/create/logic/createFinalization';
import { CreateRecoveryState } from '@/features/create/ui/CreateRecoveryState';
import { PageSkeleton } from '@/features/shared/ui/feedback';
import { formatNamedLocation } from '@/features/shared/logic/locationHelpers';
import { MeetingPage as MeetingPageView } from '@/features/meet/MeetingPage';
import { EventWikiContentView } from './EventWikiContentView';
import { resolveAppTutorialFixtureValue } from '@/features/app-tutorial/fixture-copy';

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
  const { t, language } = useTranslation();
  const recoveryDraft = useCreateRecoveryDraft('event', eventId);
  const {
    user,
    isSubscribed,
    subscriberCount,
    toggleSubscribe,
    isLoading: subscribeLoading,
    participation,
    event,
    isLoading,
    agendaStats,
    elections,
    electionsDialogOpen,
    setElectionsDialogOpen,
    confirmDialogOpen,
    setConfirmDialogOpen,
    selectedElection,
    isSubmitting,
    candidacyPasswordError,
    getUserCandidacy,
    handleElectionClick,
    handleConfirmCandidacy,
  } = useEventWikiPage(eventId);

  if (!event) {
    if (recoveryDraft) {
      return <CreateRecoveryState draft={recoveryDraft} />;
    }

    if (isLoading) {
      return <PageSkeleton />;
    }

    return <EventWikiNotFoundView />;
  }

  if (event.event_type === 'meeting' || event.meeting_type) {
    return <MeetingPageView meetingId={eventId} />;
  }

  const displayEvent = resolveAppTutorialFixtureValue(event, {
    tutorialRunId: event.tutorial_run_id,
    language,
  });
  const { electionsCount, amendmentsCount, openChangeRequestsCount } = agendaStats;
  const formattedLocation = formatNamedLocation(displayEvent.location_name, displayEvent);
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
  const eventDescription =
    typeof displayEvent.description === 'string' ? displayEvent.description : undefined;
  return (
    <EventWikiContentView
      virtualizeParticipationDirectory
      agendaStats={agendaStats}
      amendmentsCount={amendmentsCount}
      confirmDialogOpen={confirmDialogOpen}
      elections={resolveAppTutorialFixtureValue(elections, {
        tutorialRunId: event.tutorial_run_id,
        language,
      })}
      electionsCount={electionsCount}
      electionsDialogOpen={electionsDialogOpen}
      event={displayEvent}
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
      selectedElection={resolveAppTutorialFixtureValue(selectedElection, {
        tutorialRunId: event.tutorial_run_id,
        language,
      })}
      candidacyPasswordError={candidacyPasswordError}
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
