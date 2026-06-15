'use client';

import { getEntityGradientClasses, getMotionPreset } from '@/features/shared/theme';
import { BadgeControl } from '@/features/shared/ui/status';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import { Users, Copy } from 'lucide-react';
import { HashtagDisplay } from '@/features/shared/ui/hashtags';
import { extractHashtags } from '@/zero/common/hashtagHelpers';
import { StatsBar } from '@/features/shared/ui/layout';
import { ActionBar } from '@/features/shared/ui/layout';
import { SubscribeButton, MembershipButton } from '@/features/shared/ui/action-buttons';
import { InfoTabs, WikiIncumbentPanel } from '@/features/shared/ui/wiki';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { EditingModeBadge } from '@/features/shared/ui/status';
import { ShareButton } from '@/features/shared/ui/action-buttons/ShareButton.tsx';
import { VoteButtons } from '@/features/shared/ui/voting';
import { GroupTimelineCard } from '@/features/timeline/ui/cards/GroupTimelineCard';
import { SupporterStatusBadge } from '@/features/amendments/ui/SupporterStatusBadge';
import { TargetSelectionDialog } from '@/features/amendments/ui/TargetSelectionDialog';
import { Link } from '@tanstack/react-router';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { AccessDenied } from '@/features/auth/ui/AccessDenied';
const AMENDMENT_CARD_SURFACE = `${getEntityGradientClasses('amendment')} ${getMotionPreset('hoverLift')}`;
export interface AmendmentWikiViewProps {
  amendmentId: any;
  t: any;
  user: any;
  canAccess: any;
  isSubscribed: any;
  subscriberCount: any;
  toggleSubscribe: any;
  subscribeLoading: any;
  collaboration: any;
  amendment: any;
  roles: any;
  collaborators: any;
  supporterDirectoryItems: any;
  supportingGroupCount: any;
  clones: any;
  clonedFrom: any;
  totalSupportingMembers: any;
  targetCollaborator: any;
  targetGroup: any;
  evaluationModeLabel: any;
  evaluationConfigurationSummary: any;
  implementationStatus: any;
  implementationDisplayStatus: any;
  evaluationEvent: any;
  evaluationAgendaItem: any;
  evaluationVoteOutcomeLabel: any;
  evaluationDueDateLabel: any;
  hasImplementationEvaluation: any;
  supporterMapItems: any;
  upvotes: any;
  downvotes: any;
  currentVoteValue: any;
  handleVote: any;
  cloneDialogOpen: any;
  setCloneDialogOpen: any;
  isCloning: any;
  handleClone: any;
  handleConfirmClone: any;
  usersData: any;
  normalizedVoteValue: any;
  collaboratorSections: any;
  supporterDirectorySection: any;
}

export function AmendmentWikiView({
  amendmentId,
  t,
  user,
  canAccess,
  isSubscribed,
  subscriberCount,
  toggleSubscribe,
  subscribeLoading,
  collaboration,
  amendment,
  collaborators,
  supporterDirectoryItems,
  supportingGroupCount,
  clones,
  clonedFrom,
  totalSupportingMembers,
  targetCollaborator,
  targetGroup,
  evaluationModeLabel,
  evaluationConfigurationSummary,
  implementationStatus,
  implementationDisplayStatus,
  evaluationEvent,
  evaluationAgendaItem,
  evaluationVoteOutcomeLabel,
  evaluationDueDateLabel,
  hasImplementationEvaluation,
  upvotes,
  downvotes,
  handleVote,
  cloneDialogOpen,
  setCloneDialogOpen,
  isCloning,
  handleClone,
  handleConfirmClone,
  usersData,
  normalizedVoteValue,
  collaboratorSections,
  supporterDirectorySection,
}: AmendmentWikiViewProps) {
  if (!amendment) {
    return (
      <div>
        <div className="py-12 text-center">
          <h1 className="mb-4 text-2xl font-bold">
            {translateText('generated.inline.0066_amendment_not_found_3cea3d4d')}
          </h1>
          <p className="text-muted-foreground">
            {translateText(
              'generated.inline.0067_the_amendment_you_re_looking_for_doesn_t_exis_f871134d'
            )}
          </p>
        </div>
      </div>
    );
  }

  if (!canAccess) {
    return <AccessDenied />;
  }

  return (
    <div>
      {/* Header with centered title and subtitle */}
      <div className="mb-8 text-center">
        <div className="mb-2 flex items-center justify-center gap-3">
          <h1 className="text-4xl font-bold">{amendment.title}</h1>
          <EditingModeBadge mode={amendment.editing_mode} showIcon />
        </div>
        {amendment.preamble && (
          <p className="text-muted-foreground text-xl">{amendment.preamble}</p>
        )}

        {/* Target Collaborator, Target Group and Cloned From Section */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-6">
          {targetCollaborator && (
            <div className="flex items-center gap-3">
              <Avatar className="border-background h-10 w-10 border-2">
                <AvatarImage src={targetCollaborator.imageURL} />
                <AvatarFallback>
                  {targetCollaborator.name?.[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="text-left">
                <p className="text-sm font-medium">{targetCollaborator.name}</p>
                <p className="text-muted-foreground text-xs">
                  {translateText('generated.inline.0068_target_collaborator_fcd5de52')}
                </p>
              </div>
            </div>
          )}
          {targetGroup && (
            <div className="flex items-center gap-3">
              <Avatar className="border-background h-10 w-10 border-2">
                <AvatarImage src={targetGroup.image_url ?? undefined} />
                <AvatarFallback>{targetGroup.name?.[0]?.toUpperCase() || 'G'}</AvatarFallback>
              </Avatar>
              <div className="text-left">
                <p className="text-sm font-medium">{targetGroup.name}</p>
                <p className="text-muted-foreground text-xs">
                  {translateText('generated.inline.0069_targets_d35260a0')}
                </p>
              </div>
            </div>
          )}
          {clonedFrom && (
            <Link
              to="/amendment/$id"
              params={{ id: clonedFrom.id }}
              className="flex items-center gap-3 transition-opacity hover:opacity-80"
            >
              <Avatar className="border-primary h-10 w-10 border-2">
                <AvatarImage src={clonedFrom.image_url ?? undefined} />
                <AvatarFallback>
                  <Copy className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
              <div className="text-left">
                <p className="text-sm font-medium">{clonedFrom.title}</p>
                <p className="text-muted-foreground text-xs">
                  {translateText('generated.inline.0070_cloned_from_086726de')}
                </p>
              </div>
            </Link>
          )}
        </div>
      </div>

      {/* Amendment Image */}
      {amendment.image_url && (
        <div className="mb-8">
          <img
            src={amendment.image_url}
            alt={amendment.title ?? ''}
            className="mx-auto h-64 w-full max-w-4xl rounded-lg object-cover shadow-lg"
          />
        </div>
      )}

      {/* Amendment Video */}
      {amendment.youtube && (
        <div className="mb-8">
          <iframe
            src={amendment.youtube}
            title={amendment.title ?? ''}
            className="mx-auto aspect-video w-full max-w-4xl rounded-lg shadow-lg"
            allowFullScreen
          />
        </div>
      )}

      {/* Stats Bar */}
      <StatsBar
        stats={[
          {
            value: amendment.collaborator_count ?? collaboration.collaboratorCount,
            labelKey: 'components.labels.collaborators',
          },
          { value: subscriberCount, labelKey: 'components.labels.subscribers' },
          { value: amendment.clone_count ?? clones.length, labelKey: 'components.labels.clones' },
          { value: supportingGroupCount, labelKey: 'components.labels.supportingGroups' },
          { value: totalSupportingMembers, labelKey: 'components.labels.supportingMembers' },
          {
            value: amendment.change_request_count ?? (amendment.change_requests?.length || 0),
            labelKey: 'components.labels.changeRequests',
          },
        ]}
      />

      {/* Action Bar */}
      <ActionBar>
        <SubscribeButton
          entityType="amendment"
          entityId={amendmentId}
          isSubscribed={isSubscribed}
          onToggleSubscribe={toggleSubscribe}
          isLoading={subscribeLoading}
        />
        <MembershipButton
          actionType="collaborate"
          status={collaboration.status}
          isMember={collaboration.isCollaborator}
          hasRequested={collaboration.hasRequested}
          isInvited={collaboration.isInvited}
          onRequest={collaboration.requestCollaboration}
          onLeave={collaboration.leaveCollaboration}
          onAcceptInvitation={collaboration.acceptInvitation}
          isLoading={collaboration.isLoading}
        />
        <VoteButtons
          upvotes={upvotes}
          downvotes={downvotes}
          userVote={normalizedVoteValue}
          onVote={handleVote}
          orientation="horizontal"
        />
        <Button variant="outline" size="default" onClick={handleClone}>
          <Copy className="mr-2 h-4 w-4" />
          {translateText('generated.inline.0071_clone_d8cdb573')}
        </Button>
        <ShareButton
          url={`/amendment/${amendmentId}`}
          title={amendment.title ?? ''}
          description={amendment.preamble || amendment.code || ''}
          shareContextItem={{
            id: amendmentId,
            type: 'amendment',
            title: amendment.title ?? '',
            description: amendment.preamble || amendment.code || undefined,
            createdAt: new Date(),
            status: amendment.editing_mode,
            groupName: targetGroup?.name,
            collaboratorCount: collaborators.length,
            supportingGroupsCount: supportingGroupCount,
            tags:
              amendment.amendment_hashtags
                ?.map((relation: any) => relation.hashtag?.tag)
                .filter((tag: any): tag is string => Boolean(tag)) ?? [],
          }}
        />
      </ActionBar>

      {/* Hashtags */}
      {amendment.amendment_hashtags && amendment.amendment_hashtags.length > 0 && (
        <div className="mb-6">
          <HashtagDisplay hashtags={extractHashtags(amendment.amendment_hashtags)} centered />
        </div>
      )}

      {/* About and Contact Tabs */}
      <InfoTabs
        about={amendment.code || 'No description available.'}
        contact={{}}
        className="mb-12"
      />

      {/* Collaborators Carousel */}
      {collaboratorSections.length > 0 && (
        <WikiIncumbentPanel
          title={`Collaborators (${collaborators.length})`}
          description={translateText(
            'generated.inline.0072_active_collaborators_grouped_by_role_7813f854'
          )}
          sections={collaboratorSections}
          icon={Users}
          entityType="amendment"
        />
      )}

      {/* Supported By Section */}
      {supporterDirectoryItems.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {translateText('generated.inline.0073_supported_by_2f1057c9')}
            </CardTitle>
            <CardDescription>
              {translateText('generated.inline.0074_groups_supporting_this_amendment_542d22d8')}
              {totalSupportingMembers}
              {translateText('generated.inline.0075_total_members_f8dd8e9d')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {supporterDirectoryItems.map((supporter: any) => (
                <div key={supporter.groupId} className="relative">
                  <GroupTimelineCard
                    group={{
                      id: supporter.groupId,
                      name: supporter.name || t('common.unspecified'),
                      description:
                        supporter.locationLabel !== 'Location not set'
                          ? supporter.locationLabel
                          : undefined,
                      memberCount: supporter.memberCount,
                      hashtags: [],
                    }}
                  />
                  <div className="absolute top-2 right-2">
                    <SupporterStatusBadge status={supporter.supportStatus} size="sm" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {hasImplementationEvaluation && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>
              {translateText('generated.inline.0076_implementation_evaluation_ac69ba0d')}
            </CardTitle>
            <CardDescription>
              {translateText(
                'generated.inline.0077_evaluierungskonfiguration_termin_und_ergebnis_b34fe309'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              {implementationDisplayStatus ? (
                <BadgeControl variant="secondary">{implementationDisplayStatus}</BadgeControl>
              ) : null}
              {implementationStatus ? (
                <BadgeControl variant="outline">{implementationStatus}</BadgeControl>
              ) : null}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="font-medium">
                  {translateText('generated.inline.0078_modus_a7f116c3')}
                </p>
                <p className="text-muted-foreground">{evaluationModeLabel}</p>
              </div>
              <div>
                <p className="font-medium">
                  {translateText('generated.inline.0079_konfiguration_faa93ceb')}
                </p>
                <p className="text-muted-foreground">{evaluationConfigurationSummary}</p>
              </div>
              <div>
                <p className="font-medium">
                  {translateText('generated.inline.0080_konkretes_f_lligkeitsdatum_d4cbe17b')}
                </p>
                <p className="text-muted-foreground">
                  {evaluationDueDateLabel ??
                    translateText(
                      'generated.inline.0021_wird_nach_der_finalen_abstimmung_berechnet_700b6e86'
                    )}
                </p>
              </div>
              <div>
                <p className="font-medium">
                  {translateText('generated.inline.0081_abstimmungsergebnis_ea44fc12')}
                </p>
                <p className="text-muted-foreground">
                  {evaluationVoteOutcomeLabel ??
                    translateText(
                      'generated.inline.0022_noch_keine_ja_nein_abstimmung_abgeschlossen_c59a7e5f'
                    )}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {evaluationEvent?.id ? (
                <Link to="/event/$id" params={{ id: evaluationEvent.id }}>
                  <BadgeControl variant="outline">
                    {evaluationEvent.title ?? translateText('generated.inline.0023_event_ad8919ac')}
                  </BadgeControl>
                </Link>
              ) : null}
              {evaluationEvent?.id && evaluationAgendaItem?.id ? (
                <Link
                  to="/event/$id/agenda/$agendaItemId"
                  params={{ id: evaluationEvent.id, agendaItemId: evaluationAgendaItem.id }}
                >
                  <BadgeControl variant="outline">
                    {evaluationAgendaItem.title ??
                      translateText('generated.inline.0024_agenda_item_39cc1416')}
                  </BadgeControl>
                </Link>
              ) : null}
            </div>
          </CardContent>
        </Card>
      )}

      {supporterDirectorySection}

      {/* Clones Section */}
      {clones.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5" />
              {translateText('generated.inline.0082_clones_8653e7c7')}
              {clones.length})
            </CardTitle>
            <CardDescription>
              {translateText('generated.inline.0083_amendments_cloned_from_this_one_f4168e61')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {clones.map((clone: any) => (
                <Link
                  key={clone.id}
                  to="/amendment/$id"
                  params={{ id: clone.id }}
                  className="block transition-opacity hover:opacity-90"
                >
                  <Card className={`overflow-hidden ${AMENDMENT_CARD_SURFACE}`}>
                    <CardHeader className="space-y-2 pb-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <CardTitle className="line-clamp-2 text-lg">{clone.title}</CardTitle>
                          {clone.preamble && (
                            <CardDescription className="mt-1 line-clamp-2 text-sm">
                              {clone.preamble}
                            </CardDescription>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <EditingModeBadge mode={clone.editing_mode} showIcon />
                        {clone.code && (
                          <BadgeControl variant="outline" size="xs">
                            {clone.code}
                          </BadgeControl>
                        )}
                      </div>
                    </CardHeader>
                    {clone.created_at && (
                      <CardContent className="pt-0">
                        <p className="text-muted-foreground text-xs">
                          {translateText('generated.inline.0084_created_0c78dab1')}
                          {new Date(clone.created_at).toLocaleDateString()}
                        </p>
                      </CardContent>
                    )}
                  </Card>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Clone Dialog */}
      <TargetSelectionDialog
        open={cloneDialogOpen}
        onOpenChange={setCloneDialogOpen}
        currentUserId={user?.id || ''}
        allUsers={(usersData?.$users || []).map((u: any) => ({
          id: u.id,
          name: u.handle || u.email || 'Unknown User',
          email: u.email,
          avatar: u.avatar ?? undefined,
        }))}
        onConfirm={handleConfirmClone}
        isSaving={isCloning}
        showCollaboratorSelection={false}
        title={translateText('generated.inline.0085_clone_amendment_select_target_8fa1e50c')}
        description={translateText(
          'generated.inline.0086_optionally_link_the_clone_to_a_group_and_even_9a83e8d9'
        )}
        confirmButtonText={translateText('generated.inline.0009_clone_amendment_71d1877f')}
      />
    </div>
  );
}
