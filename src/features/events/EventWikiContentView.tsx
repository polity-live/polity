'use client';

import { BadgeControl } from '@/features/shared/ui/status';
import { ScrollableAlertDialogContent, ScrollableDialogContent } from '@/features/shared/ui/dialog';
import { Link } from '@tanstack/react-router';
import { Button } from '@/features/shared/ui/ui/button';
import { Trophy, Users, Repeat } from 'lucide-react';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/features/shared/ui/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/features/shared/ui/ui/alert-dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/features/shared/ui/ui/tabs';
import { getEntityGradientClasses, getMotionPreset } from '@/features/shared/theme';
import { HashtagDisplay } from '@/features/shared/ui/hashtags';
import { extractHashtags } from '@/zero/common/hashtagHelpers';
import { StatsBar } from '@/features/shared/ui/layout';
import { ActionBar } from '@/features/shared/ui/layout';
import { SubscribeButton, MembershipButton } from '@/features/shared/ui/action-buttons';
import type { MembershipStatus } from '@/features/shared/ui/action-buttons/MembershipButton';
import { InfoTabs } from '@/features/shared/ui/wiki/InfoTabs.tsx';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { ShareButton } from '@/features/shared/ui/action-buttons/ShareButton.tsx';
import { DelegatesOverview } from '@/features/delegates/ui/DelegatesOverview';
import { MembershipCompositionPanel } from '@/features/groups/ui/MembershipCompositionPanel';
import { EventDeadlinesCard } from './ui/EventDeadlinesCard';
import { getEventTypeTranslationKey } from './logic/getEventTypeTranslationKey';

const EVENT_CARD_SURFACE = `${getEntityGradientClasses('event')} ${getMotionPreset('hoverLift')}`;
const ELECTION_CARD_SURFACE = `${getEntityGradientClasses('election')} ${getMotionPreset('hoverLift')}`;
import { WikiIncumbentPanel } from '@/features/shared/ui/wiki/WikiIncumbentPanel';
import { SmartLink } from '@/features/shared/ui/navigation/SmartLink.tsx';
export interface EventWikiContentViewProps {
  activeDelegateAssemblyParticipants: any;
  agendaStats: any;
  amendmentsCount: any;
  canAccess: any;
  compositionBuckets: any;
  compositionIsLoading: any;
  confirmDialogOpen: any;
  delegateParticipantsForDialog: any;
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
  incumbentSections: any;
  isAssemblyEventType: any;
  isSubmitting: any;
  isSubscribed: any;
  openChangeRequestsCount: any;
  participantsDialogOpen: any;
  participantsWithProvenance: any;
  participation: any;
  participationDisabledReason: any;
  selectedElection: any;
  setConfirmDialogOpen: any;
  setElectionsDialogOpen: any;
  setParticipantsDialogOpen: any;
  shouldDisableParticipationRequest: any;
  showComposition: any;
  subscribeLoading: any;
  subscriberCount: any;
  t: any;
  toggleSubscribe: any;
  user: any;
}

export function EventWikiContentView({
  amendmentsCount,
  compositionBuckets,
  compositionIsLoading,
  confirmDialogOpen,
  delegateParticipantsForDialog,
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
  incumbentSections,
  isSubmitting,
  isSubscribed,
  openChangeRequestsCount,
  participantsDialogOpen,
  participation,
  participationDisabledReason,
  selectedElection,
  setConfirmDialogOpen,
  setElectionsDialogOpen,
  setParticipantsDialogOpen,
  shouldDisableParticipationRequest,
  showComposition,
  subscribeLoading,
  subscriberCount,
  t,
  toggleSubscribe,
  user,
}: EventWikiContentViewProps) {
  return (
    <div>
      {/* Header with centered title and subtitle */}
      <div className="mb-8 text-center">
        <div className="mb-2 flex items-center justify-center gap-3">
          <h1 className="text-4xl font-bold">{event.title}</h1>
          {event.visibility === 'public' ? (
            <BadgeControl variant="default">{t('components.badges.public')}</BadgeControl>
          ) : (
            <BadgeControl variant="secondary">{t('components.badges.private')}</BadgeControl>
          )}
          {event.event_type && (
            <BadgeControl variant="outline">
              {t(`pages.create.event.eventTypes.${getEventTypeTranslationKey(event.event_type)}`)}
            </BadgeControl>
          )}
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

        {/* Organizer Info */}
        <div className="mt-4 flex items-center justify-center gap-3">
          {event.creator?.id ? (
            <Link to="/user/$id" params={{ id: event.creator.id }} className="rounded-full">
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

      {/* Event Image */}
      {event.image_url && (
        <div className="mb-8">
          <img
            src={event.image_url}
            alt={event.title ?? ''}
            className="mx-auto h-64 w-full max-w-4xl rounded-lg object-cover shadow-lg"
          />
        </div>
      )}

      {/* Stats Bar */}
      <StatsBar
        stats={[
          {
            value: event.participant_count ?? participation.participantCount,
            labelKey: 'components.labels.participants',
          },
          { value: subscriberCount, labelKey: 'components.labels.subscribers' },
          {
            value: event.election_count ?? electionsCount,
            labelKey: 'components.labels.elections',
          },
          {
            value: event.amendment_count ?? amendmentsCount,
            labelKey: 'components.labels.amendments',
          },
          {
            value: event.open_change_request_count ?? openChangeRequestsCount,
            labelKey: 'components.labels.openChangeRequests',
          },
        ]}
      />

      {/* Action Bar */}
      <ActionBar>
        <SubscribeButton
          entityType="event"
          entityId={eventId}
          isSubscribed={isSubscribed}
          onToggleSubscribe={toggleSubscribe}
          isLoading={subscribeLoading}
        />
        <MembershipButton
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
        />
        {elections.length > 0 && user && (
          <Button variant="outline" onClick={() => setElectionsDialogOpen(true)}>
            <Trophy className="mr-2 h-4 w-4" />
            {translateText('generated.inline.0428_kandidieren_b1de92a5')}
          </Button>
        )}
        <ShareButton
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
        />
      </ActionBar>

      {/* Hashtags */}
      {event.event_hashtags && event.event_hashtags.length > 0 && (
        <div className="mb-6">
          <HashtagDisplay hashtags={extractHashtags(event.event_hashtags)} centered />
        </div>
      )}

      {/* About Tab with Event Details */}
      <InfoTabs
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
        }}
        className="mb-12"
      />

      {/* Deadlines Card */}
      <EventDeadlinesCard
        registrationDeadline={event.registration_deadline}
        amendmentDeadline={event.amendment_deadline}
        candidacyDeadline={event.candidacy_deadline}
      />

      {/* Public Participants Card */}
      {event.visibility === 'public' && (
        <Card
          className={`mb-6 cursor-pointer overflow-hidden ${EVENT_CARD_SURFACE}`}
          onClick={() => setParticipantsDialogOpen(true)}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {translateText('generated.inline.0429_participants_cd56e083')}
            </CardTitle>
            <CardDescription>
              {event.participants?.length || 0}
              {translateText('generated.inline.0430_participant_s_click_to_view_list_29dca775')}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {incumbentSections.length > 0 && (
        <WikiIncumbentPanel
          title={translateText('generated.inline.0431_roles_incumbents_07f9ca00')}
          description={translateText(
            'generated.inline.0432_visible_event_roles_and_their_current_incumbe_9f923058'
          )}
          sections={incumbentSections}
          entityType="event"
        />
      )}

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
                <Card
                  key={election.id}
                  className={`cursor-pointer overflow-hidden ${ELECTION_CARD_SURFACE} ${existingCandidacy ? 'opacity-60' : ''}`}
                  onClick={() => !existingCandidacy && handleElectionClick(election)}
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
                        {translateText('generated.inline.0436_kandidaten_dce3b6fa')}
                        {election.candidates?.length || 0}
                      </span>
                      {election.majority_type && (
                        <BadgeControl variant="outline" size="xs">
                          {election.majority_type}
                        </BadgeControl>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollableDialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <ScrollableAlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {translateText('generated.inline.0437_kandidatur_best_tigen_838a848e')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {translateText(
                'generated.inline.0438_m_chten_sie_wirklich_f_r_diese_wahl_kandidier_3343987c'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {selectedElection && (
            <Card className={`overflow-hidden ${ELECTION_CARD_SURFACE}`}>
              <CardHeader>
                <CardTitle>{selectedElection.title}</CardTitle>
                {selectedElection.description && (
                  <CardDescription>{selectedElection.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {selectedElection.role && (
                  <div className="bg-background/50 rounded-md border p-3">
                    <div className="text-sm font-semibold">
                      {translateText('generated.inline.0045_role_61e4c27b')}
                      {selectedElection.role.title}
                    </div>
                    {selectedElection.role.description && (
                      <div className="text-muted-foreground mt-1 text-xs">
                        {selectedElection.role.description}
                      </div>
                    )}
                  </div>
                )}
                <div className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {translateText('generated.inline.0439_aktuelle_kandidaten_9b881419')}
                    </span>
                    <span className="font-medium">{selectedElection.candidates?.length || 0}</span>
                  </div>
                  {selectedElection.majority_type && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {translateText('generated.inline.0440_wahlverfahren_e5f84d31')}
                      </span>
                      <BadgeControl variant="outline" size="xs">
                        {selectedElection.majority_type}
                      </BadgeControl>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>
              {translateText('generated.inline.0331_abbrechen_07af7cb3')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCandidacy} disabled={isSubmitting}>
              {isSubmitting
                ? translateText('generated.inline.0074_wird_hinzugef_gt_6064853e')
                : translateText('generated.inline.0075_kandidatur_best_tigen_838a848e')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </ScrollableAlertDialogContent>
      </AlertDialog>

      {/* Participants Dialog */}
      <Dialog open={participantsDialogOpen} onOpenChange={setParticipantsDialogOpen}>
        <ScrollableDialogContent className="max-h-[80vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {translateText('generated.inline.0441_event_participants_df407348')}
            </DialogTitle>
            <DialogDescription>
              {event.participants?.length || 0}
              {translateText(
                'generated.inline.0442_participant_s_registered_for_this_event_4d97759f'
              )}
            </DialogDescription>
          </DialogHeader>

          {event.event_type === 'delegate_assembly' ? (
            <Tabs defaultValue="participants" className="w-full">
              <TabsList
                className={`grid w-full ${showComposition ? 'grid-cols-3' : 'grid-cols-2'}`}
              >
                <TabsTrigger value="participants">
                  {translateText('generated.inline.0429_participants_cd56e083')}
                </TabsTrigger>
                <TabsTrigger value="delegates">
                  {translateText('generated.inline.0443_delegates_by_subgroup_5f5d3271')}
                </TabsTrigger>
                {showComposition ? (
                  <TabsTrigger value="composition">
                    {translateText('generated.inline.0444_composition_ca5e0012')}
                  </TabsTrigger>
                ) : null}
              </TabsList>

              <TabsContent value="participants" className="space-y-4">
                <div className="grid gap-4 py-4 sm:grid-cols-2">
                  {delegateParticipantsForDialog.length > 0 ? (
                    (delegateParticipantsForDialog as any[]).map(participant => {
                      const participantHref = participant.user?.id
                        ? `/user/${participant.user.id}`
                        : null;
                      const participantContent = (
                        <CardContent className="flex items-center gap-4 p-4">
                          <Avatar className="h-12 w-12">
                            <AvatarImage
                              src={participant.user?.avatar ?? undefined}
                              alt={
                                `${participant.user?.first_name ?? ''} ${participant.user?.last_name ?? ''}`.trim() ||
                                'User'
                              }
                            />
                            <AvatarFallback>
                              {participant.user?.first_name?.[0]?.toUpperCase() || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 space-y-1">
                            <p className="leading-none font-semibold">
                              {`${participant.user?.first_name ?? ''} ${participant.user?.last_name ?? ''}`.trim() ||
                                translateText('generated.inline.0031_unknown_bc7819b3')}
                            </p>
                            {participant.user?.handle && (
                              <p className="text-muted-foreground text-sm">
                                @{participant.user.handle}
                              </p>
                            )}
                            {participant.status && (
                              <BadgeControl variant="secondary" size="xs">
                                {participant.status}
                              </BadgeControl>
                            )}
                            {showComposition && participant.partGroup?.name ? (
                              <BadgeControl variant="outline" size="xs">
                                {translateText('generated.inline.0445_subgroup_a9453c74')}
                                {participant.partGroup.name}
                              </BadgeControl>
                            ) : null}
                            {showComposition && participant.baseGroup?.name ? (
                              <BadgeControl variant="outline" size="xs">
                                {translateText('generated.inline.0446_base_group_1e6d0a99')}
                                {participant.baseGroup.name}
                              </BadgeControl>
                            ) : null}
                          </div>
                        </CardContent>
                      );

                      return participantHref ? (
                        <Card
                          key={participant.id}
                          asChild
                          className="transition-all duration-300 hover:shadow-lg"
                        >
                          <SmartLink href={participantHref} className="block cursor-pointer">
                            {participantContent}
                          </SmartLink>
                        </Card>
                      ) : (
                        <Card
                          key={participant.id}
                          className="transition-all duration-300 hover:shadow-lg"
                        >
                          {participantContent}
                        </Card>
                      );
                    })
                  ) : (
                    <div className="text-muted-foreground col-span-2 py-8 text-center">
                      {translateText('generated.inline.0447_no_participants_yet_aa90337a')}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="delegates" className="space-y-4">
                <DelegatesOverview eventId={event.id} groupId={event.group?.id} />
              </TabsContent>

              {showComposition ? (
                <TabsContent value="composition" className="space-y-4 py-4">
                  <MembershipCompositionPanel
                    buckets={compositionBuckets}
                    isLoading={compositionIsLoading}
                  />
                </TabsContent>
              ) : null}
            </Tabs>
          ) : (
            <div className="grid gap-4 py-4 sm:grid-cols-2">
              {event.participants && event.participants.length > 0 ? (
                event.participants.map((participant: any) => {
                  const participantHref = participant.user?.id
                    ? `/user/${participant.user.id}`
                    : null;
                  const participantContent = (
                    <CardContent className="flex items-center gap-4 p-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage
                          src={participant.user?.avatar ?? undefined}
                          alt={
                            `${participant.user?.first_name ?? ''} ${participant.user?.last_name ?? ''}`.trim() ||
                            'User'
                          }
                        />
                        <AvatarFallback>
                          {participant.user?.first_name?.[0]?.toUpperCase() || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-1">
                        <p className="leading-none font-semibold">
                          {`${participant.user?.first_name ?? ''} ${participant.user?.last_name ?? ''}`.trim() ||
                            translateText('generated.inline.0031_unknown_bc7819b3')}
                        </p>
                        {participant.user?.handle && (
                          <p className="text-muted-foreground text-sm">
                            @{participant.user.handle}
                          </p>
                        )}
                        {participant.status && (
                          <BadgeControl variant="secondary" size="xs">
                            {participant.status}
                          </BadgeControl>
                        )}
                      </div>
                    </CardContent>
                  );

                  return participantHref ? (
                    <Card
                      key={participant.id}
                      asChild
                      className="transition-all duration-300 hover:shadow-lg"
                    >
                      <SmartLink href={participantHref} className="block cursor-pointer">
                        {participantContent}
                      </SmartLink>
                    </Card>
                  ) : (
                    <Card
                      key={participant.id}
                      className="transition-all duration-300 hover:shadow-lg"
                    >
                      {participantContent}
                    </Card>
                  );
                })
              ) : (
                <div className="text-muted-foreground col-span-2 py-8 text-center">
                  {translateText('generated.inline.0447_no_participants_yet_aa90337a')}
                </div>
              )}
            </div>
          )}
        </ScrollableDialogContent>
      </Dialog>
    </div>
  );
}
