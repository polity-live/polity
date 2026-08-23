'use client';

import { BadgeControl, VisibilityBadge } from '@/features/shared/ui/status';
import { normalizeRouteVisibility } from '@/features/auth/logic/routeVisibilityAccess';
import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
import { Link } from '@tanstack/react-router';
import { Button } from '@/features/shared/ui/ui/button';
import { Trophy, Repeat } from 'lucide-react';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/features/shared/ui/ui/dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { getEntityGradientClasses, getMotionPreset } from '@/features/shared/theme';
import { HashtagDisplay } from '@/features/shared/ui/hashtags';
import { extractHashtags } from '@/zero/common/hashtagHelpers';
import {
  ActionBar,
  ResponsiveActionLabel,
  StatsBar,
  compactActionButtonClassName,
} from '@/features/shared/ui/layout';
import { SubscribeButton, MembershipButton } from '@/features/shared/ui/action-buttons';
import type { MembershipStatus } from '@/features/shared/ui/action-buttons/MembershipButton';
import { InfoTabs } from '@/features/shared/ui/wiki/InfoTabs.tsx';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { ShareButton } from '@/features/shared/ui/action-buttons/ShareButton.tsx';
import { getDelegateMembersPerSeatInfo } from '@/features/delegates/logic/delegateRatio';
import { EventDeadlinesCard } from './ui/EventDeadlinesCard';
import { CandidacyPasswordDialog } from '@/features/elections/ui/CandidacyPasswordDialog';
import { getEventTypeTranslationKey } from './logic/getEventTypeTranslationKey';
import {
  getWikiParticipationName,
  EntityWikiMedia,
  isVisibleWikiParticipationStatus,
  normalizeWikiParticipationRole,
  WikiParticipationDirectory,
  WikiRosterSummaryCard,
  type WikiParticipationItem,
  type WikiParticipationRole,
} from '@/features/shared/ui/wiki';
import { queries } from '@/zero/queries';
import { ActivityLog } from '@/features/shared/ui/wiki/ActivityLog';
import { canViewEntityActivity } from '@/features/shared/hooks/useEntityActivity';

const ELECTION_CARD_SURFACE = `${getEntityGradientClasses('election')} ${getMotionPreset('hoverLift')}`;

function dedupeWikiParticipationRoles(roles: readonly WikiParticipationRole[]) {
  const roleById = new Map<string, WikiParticipationRole>();

  roles.forEach(role => {
    if (!roleById.has(role.id)) {
      roleById.set(role.id, role);
    }
  });

  return [...roleById.values()].sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
  );
}

function getParticipantWikiRoles(
  participant: any,
  participantRoleById: Map<string, WikiParticipationRole>
) {
  const rawRoles = [
    ...(participant.roles?.length ? participant.roles : []),
    participant.role,
    ...(participant.participant_roles ?? []).map((roleLink: any) => roleLink.role),
    participant.role_id && participantRoleById.has(participant.role_id)
      ? participantRoleById.get(participant.role_id)
      : null,
  ];

  const roles = rawRoles
    .map((role: any) => normalizeWikiParticipationRole(role))
    .filter((role: WikiParticipationRole | null): role is WikiParticipationRole => Boolean(role));

  return dedupeWikiParticipationRoles(roles);
}

export interface EventWikiContentViewProps {
  virtualizeParticipationDirectory?: boolean;
  agendaStats: any;
  amendmentsCount: any;
  candidacyPasswordError?: string | null;
  confirmDialogOpen: any;
  elections: any;
  electionsCount: any;
  electionsDialogOpen: any;
  event: any;
  eventDescription: any;
  eventId: any;
  formattedLocation: any;
  getUserCandidacy: any;
  handleConfirmCandidacy: any;
  handleElectionClick: any;
  isAssemblyEventType: any;
  isSubmitting: any;
  isSubscribed: any;
  openChangeRequestsCount: any;
  participation: any;
  participationDisabledReason: any;
  selectedElection: any;
  setConfirmDialogOpen: any;
  setElectionsDialogOpen: any;
  shouldDisableParticipationRequest: any;
  subscribeLoading: any;
  subscriberCount: any;
  t: any;
  toggleSubscribe: any;
  user: any;
}

export function EventWikiContentView({
  virtualizeParticipationDirectory = false,
  amendmentsCount,
  candidacyPasswordError,
  confirmDialogOpen,
  elections,
  electionsCount,
  electionsDialogOpen,
  event,
  eventDescription,
  eventId,
  formattedLocation,
  getUserCandidacy,
  handleConfirmCandidacy,
  handleElectionClick,
  isSubmitting,
  isSubscribed,
  openChangeRequestsCount,
  participation,
  participationDisabledReason,
  selectedElection,
  setConfirmDialogOpen,
  setElectionsDialogOpen,
  shouldDisableParticipationRequest,
  subscribeLoading,
  subscriberCount,
  t,
  toggleSubscribe,
  user,
}: EventWikiContentViewProps) {
  const noVotingPasswordSettingsHref = user?.id
    ? `/user/${user.id}/settings?tab=passwords`
    : undefined;
  const eventRoles: WikiParticipationRole[] = (event.roles ?? [])
    .map((role: any) => normalizeWikiParticipationRole(role))
    .filter((role: WikiParticipationRole | null): role is WikiParticipationRole => Boolean(role));
  const participantRoleById = new Map(eventRoles.map(role => [role.id, role]));
  const participantTotalCount = event.participant_count ?? participation.participantCount ?? 0;
  const participantDirectoryItems: WikiParticipationItem[] = (event.participants ?? [])
    .filter((participant: any) => isVisibleWikiParticipationStatus(participant.status))
    .filter((participant: any) => participant.user?.id)
    .map((participant: any) => {
      const roles = getParticipantWikiRoles(participant, participantRoleById);

      return {
        id: participant.id ?? `participant-${participant.user.id}`,
        userId: participant.user.id,
        name: getWikiParticipationName(participant.user),
        handle: participant.user.handle ?? null,
        email: participant.user.contact_email ?? null,
        avatar: participant.user.avatar ?? null,
        status: participant.status ?? null,
        roles,
      };
    });
  const participantRoles = dedupeWikiParticipationRoles([
    ...eventRoles,
    ...participantDirectoryItems
      .flatMap(item => item.roles)
      .filter((role): role is WikiParticipationRole => Boolean(role)),
  ]);
  const delegateRatioInfo = getDelegateMembersPerSeatInfo(event);
  const eventVisibility = normalizeRouteVisibility(event.visibility);

  return (
    <>
      {/* Header with centered title and subtitle */}
      <div className="mb-8 text-center">
        <div className="mb-2 flex min-w-0 flex-col items-center justify-center gap-2 md:flex-row md:gap-3">
          <h1 className="max-w-full min-w-0 text-4xl font-bold break-words">{event.title}</h1>
          <div className="flex max-w-full flex-wrap items-center justify-center gap-2 md:contents">
            <VisibilityBadge value={eventVisibility} data-entity-visibility={eventVisibility}>
              {t(`common.visibility.${eventVisibility}`)}
            </VisibilityBadge>
            {event.event_type && (
              <BadgeControl variant="outline">
                {t(`pages.create.event.eventTypes.${getEventTypeTranslationKey(event.event_type)}`)}
              </BadgeControl>
            )}
            {delegateRatioInfo ? (
              <BadgeControl variant="outline">
                {t(delegateRatioInfo.translationKey, { count: delegateRatioInfo.count })}
              </BadgeControl>
            ) : null}
            {event.recurrence_pattern && (
              <BadgeControl variant="outline">
                <Repeat className="mr-1 h-3 w-3" />
                {event.recurrence_pattern === 'daily'
                  ? translateText('generated.inline.0069_t_glich_3e286c33')
                  : event.recurrence_pattern === 'weekly'
                    ? translateText('generated.inline.0070_w_chentlich_611d088a')
                    : event.recurrence_pattern === 'monthly'
                      ? translateText('generated.inline.0071_monatlich_33e0d042')
                      : event.recurrence_pattern === 'yearly'
                        ? translateText('generated.inline.0072_j_hrlich_6e7ef191')
                        : event.recurrence_pattern === 'four-yearly'
                          ? translateText('generated.inline.0073_4_j_hrig_44aa9820')
                          : event.recurrence_pattern}
              </BadgeControl>
            )}
          </div>
        </div>
        {event.event_hashtags && event.event_hashtags.length > 0 ? (
          <div className="mt-3 md:hidden">
            <HashtagDisplay
              hashtags={extractHashtags(event.event_hashtags)}
              centered
              badgeClassName="max-w-full whitespace-normal break-all text-center"
            />
          </div>
        ) : null}

        {/* Organizer Info */}
        <div className="mt-4 flex items-center justify-center gap-3">
          {event.creator?.id ? (
            <Link to="/user/$id" params={{ id: event.creator.id }} className="rounded-md">
              <Avatar className="h-10 w-10 transition-opacity hover:opacity-90">
                <AvatarImage src={event.creator?.avatar ?? undefined} />
                <AvatarFallback>
                  {event.creator?.first_name?.[0]?.toUpperCase() || 'O'}
                </AvatarFallback>
              </Avatar>
            </Link>
          ) : (
            <Avatar className="h-10 w-10">
              <AvatarImage src={event.creator?.avatar ?? undefined} />
              <AvatarFallback>
                {event.creator?.first_name?.[0]?.toUpperCase() || 'O'}
              </AvatarFallback>
            </Avatar>
          )}
          <div className="text-left">
            <p className="text-sm font-medium">
              {t('components.labels.organizedBy')}{' '}
              {event.creator?.id ? (
                <Link to="/user/$id" params={{ id: event.creator.id }} className="hover:underline">
                  {event.creator?.first_name ||
                    translateText('generated.inline.0031_unknown_bc7819b3')}
                </Link>
              ) : (
                event.creator?.first_name || translateText('generated.inline.0031_unknown_bc7819b3')
              )}
            </p>
            {event.group && (
              <p className="text-muted-foreground text-xs">
                {t('components.labels.partOf')}{' '}
                <Link
                  to="/group/$id"
                  params={{ id: event.group.id }}
                  className="hover:text-foreground hover:underline"
                >
                  {event.group.name}
                </Link>
              </p>
            )}
          </div>
        </div>
      </div>

      <EntityWikiMedia
        imageUrl={event.image_url}
        videoUrl={event.video_url}
        alt={event.title ?? ''}
      />

      {/* Stats Bar */}
      <StatsBar
        items={[
          {
            value: participantTotalCount,
            label: t('components.labels.participants', { count: participantTotalCount }),
          },
          {
            value: subscriberCount,
            label: t('components.labels.subscribers', { count: subscriberCount }),
          },
          {
            value: electionsCount ?? event.election_count ?? 0,
            label: t('components.labels.elections', {
              count: electionsCount ?? event.election_count ?? 0,
            }),
          },
          {
            value: amendmentsCount ?? event.amendment_count ?? 0,
            label: t('components.labels.amendments', {
              count: amendmentsCount ?? event.amendment_count ?? 0,
            }),
          },
          {
            value: openChangeRequestsCount ?? event.open_change_request_count ?? 0,
            label: t('components.labels.openChangeRequests', {
              count: openChangeRequestsCount ?? event.open_change_request_count ?? 0,
            }),
          },
        ]}
      />

      {/* Action Bar */}
      <ActionBar>
        {user ? (
          <>
            <SubscribeButton
              data-action-id="events.wiki.subscribe"
              entityType="event"
              entityId={eventId}
              isSubscribed={isSubscribed}
              onToggleSubscribe={toggleSubscribe}
              isLoading={subscribeLoading}
              compactOnMobile
            />
            <MembershipButton
              data-action-id="events.wiki.participation"
              actionType="participate"
              status={participation.status as MembershipStatus | null}
              isMember={participation.isParticipant}
              hasRequested={participation.hasRequested}
              isInvited={participation.isInvited}
              onRequest={participation.requestParticipation}
              onLeave={participation.leaveEvent}
              onAcceptInvitation={participation.acceptInvitation}
              isLoading={participation.isLoading}
              disabled={shouldDisableParticipationRequest}
              disabledReason={participationDisabledReason}
              compactOnMobile
            />
            {elections.length > 0 ? (
              <Button
                data-action-id="events.wiki.candidacy.open"
                variant="outline"
                onClick={() => setElectionsDialogOpen(true)}
                className={compactActionButtonClassName}
                aria-label={translateText('generated.inline.0428_kandidieren_b1de92a5')}
              >
                <Trophy className="mr-0 h-4 w-4 sm:mr-2" />
                <ResponsiveActionLabel
                  full={translateText('generated.inline.0428_kandidieren_b1de92a5')}
                  compact={translateText('generated.inline.0428_kandidieren_b1de92a5')}
                />
              </Button>
            ) : null}
          </>
        ) : null}
        <ShareButton
          data-action-id="events.wiki.share"
          url={`/event/${eventId}`}
          title={event.title ?? ''}
          description={eventDescription ?? ''}
          shareContextItem={{
            id: eventId,
            type: 'event',
            title: event.title ?? '',
            description: eventDescription,
            createdAt: event.start_date ? new Date(event.start_date) : new Date(),
            startDate: event.start_date ? new Date(event.start_date) : undefined,
            endDate: event.end_date ? new Date(event.end_date) : undefined,
            location: event.location_name,
            city: event.city ?? undefined,
            postcode: event.post_code ?? undefined,
            electionsCount,
            amendmentsCount,
            groupId: event.group?.id,
            groupName: event.group?.name,
          }}
          compactOnMobile
        />
      </ActionBar>

      {/* Hashtags */}
      {event.event_hashtags && event.event_hashtags.length > 0 && (
        <div className="mb-6 hidden md:block">
          <HashtagDisplay hashtags={extractHashtags(event.event_hashtags)} centered />
        </div>
      )}

      {/* About Tab with Event Details */}
      <InfoTabs
        activity={
          canViewEntityActivity('event', event, user?.id) ? (
            <ActivityLog type="event" entityId={eventId} />
          ) : undefined
        }
        about={event.description}
        eventDetails={{
          startDate: event.start_date ?? undefined,
          endDate: event.end_date ?? undefined,
          location: formattedLocation || undefined,
        }}
        contact={{
          location: formattedLocation || undefined,
          country: event.country ?? undefined,
          region: event.region ?? undefined,
          post_code: event.post_code ?? undefined,
          city: event.city ?? undefined,
          street: event.street ?? undefined,
          house_number: event.house_number ?? undefined,
          latitude: event.latitude ?? null,
          longitude: event.longitude ?? null,
          location_kind: event.location_kind ?? null,
          location_place_id: event.location_place_id ?? null,
          location_boundary_source: event.location_boundary_source ?? null,
          location_geometry: event.location_geometry ?? null,
          location_bounds: event.location_bounds ?? null,
        }}
        className="mb-12"
      />

      {/* Deadlines Card */}
      <EventDeadlinesCard
        registrationDeadline={event.registration_deadline}
        amendmentDeadline={event.amendment_deadline}
        candidacyDeadline={event.candidacy_deadline}
        startDate={event.start_date}
        endDate={event.end_date}
      />

      <div className="mb-8">
        <WikiParticipationDirectory
          className="mb-0"
          title={translateText('components.labels.participants', {
            count: participantTotalCount,
          })}
          description={translateText('features.events.wiki.participantsRegistered', {
            count: participantTotalCount,
          })}
          items={participantDirectoryItems}
          roles={participantRoles}
          entityType="event"
          searchPlaceholder={translateText(
            'generated.inline.0494_search_participants_1b38c2ef',
            'Search participants'
          )}
          emptyLabel={translateText('generated.inline.0447_no_participants_yet_aa90337a')}
          noResultsLabel={translateText('features.events.wiki.noParticipantsMatch')}
          leadingCard={
            <WikiRosterSummaryCard
              totalCount={participantTotalCount}
              items={participantDirectoryItems}
            />
          }
          virtualSource={
            virtualizeParticipationDirectory
              ? {
                  historyKey: `event-${eventId}-participation-directory`,
                  context: {
                    eventId,
                    statuses: ['active', 'admin', 'collaborator', 'confirmed', 'member', 'owner'],
                  },
                  getPageQuery: ({ limit, start, dir, settled, query, roleIds }) => ({
                    query: queries.events.participantPage({
                      eventId,
                      statuses: ['active', 'admin', 'collaborator', 'confirmed', 'member', 'owner'],
                      roleIds,
                      query,
                      limit,
                      start,
                      dir,
                    }) as never,
                    options: { ttl: settled ? ('5m' as const) : ('none' as const) },
                  }),
                  getSingleQuery: ({ id, settled }) => ({
                    query: queries.events.participantById({ id }) as never,
                    options: { ttl: settled ? ('5m' as const) : ('none' as const) },
                  }),
                  getRowKey: row => row.id,
                  mapRow: participant => {
                    const participantUser = participant.user;
                    return {
                      id: participant.id,
                      userId: participantUser?.id ?? participant.user_id,
                      name: getWikiParticipationName(participantUser),
                      handle: participantUser?.handle ?? null,
                      email: participantUser?.contact_email ?? null,
                      avatar: participantUser?.avatar ?? null,
                      status: participant.status ?? null,
                      roles: getParticipantWikiRoles(participant, participantRoleById),
                    };
                  },
                }
              : undefined
          }
        />
      </div>

      {/* Elections Selection Dialog */}
      <Dialog open={electionsDialogOpen} onOpenChange={setElectionsDialogOpen}>
        <ScrollableDialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {translateText('generated.inline.0433_w_hlen_sie_eine_wahl_aus_a4f16bb3')}
            </DialogTitle>
            <DialogDescription>
              {translateText(
                'generated.inline.0434_w_hlen_sie_eine_wahl_aus_f_r_die_sie_kandidie_cbbfe07c'
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 sm:grid-cols-2">
            {elections.map((election: any) => {
              const existingCandidacy = getUserCandidacy(election);

              return (
                <button
                  data-action-id="events.wiki.candidacy.select-election"
                  type="button"
                  key={election.id}
                  className="w-full rounded-lg text-left"
                  disabled={Boolean(existingCandidacy)}
                  onClick={() => handleElectionClick(election)}
                >
                  <Card
                    className={`overflow-hidden ${ELECTION_CARD_SURFACE} ${existingCandidacy ? 'opacity-60' : ''}`}
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>{election.title}</span>
                        {existingCandidacy && (
                          <BadgeControl variant="secondary" size="xs">
                            {translateText('generated.inline.0435_bereits_kandidat_ef4a51da')}
                          </BadgeControl>
                        )}
                      </CardTitle>
                      {election.description && (
                        <CardDescription>{election.description}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      {election.role && (
                        <div className="bg-background/50 rounded-md border p-3">
                          <div className="text-sm font-medium">{election.role.title}</div>
                          {election.role.description && (
                            <div className="text-muted-foreground mt-1 text-xs">
                              {election.role.description}
                            </div>
                          )}
                        </div>
                      )}
                      <div className="text-muted-foreground mt-3 flex items-center justify-between text-sm">
                        <span>
                          {translateText('features.events.wiki.candidatesCount', {
                            count: election.candidates?.length ?? 0,
                          })}
                        </span>
                        {election.majority_type && (
                          <BadgeControl variant="outline" size="xs">
                            {election.majority_type}
                          </BadgeControl>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </button>
              );
            })}
          </div>
        </ScrollableDialogContent>
      </Dialog>

      <CandidacyPasswordDialog
        data-action-id="events.wiki.candidacy.confirm"
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        mode="become"
        electionTitle={selectedElection?.title ?? null}
        electionDescription={selectedElection?.description ?? null}
        roleTitle={selectedElection?.role?.title ?? null}
        candidatesCount={selectedElection?.candidates?.length ?? null}
        majorityType={selectedElection?.majority_type ?? null}
        error={candidacyPasswordError}
        noVotingPasswordSettingsHref={noVotingPasswordSettingsHref}
        isSubmitting={isSubmitting}
        onSubmit={handleConfirmCandidacy}
      />
    </>
  );
}
