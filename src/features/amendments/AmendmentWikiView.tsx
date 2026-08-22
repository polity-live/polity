'use client';

import { getEntityGradientClasses, getMotionPreset } from '@/features/shared/theme';
import { BadgeControl, VisibilityBadge, getEditingModeOption } from '@/features/shared/ui/status';
import { normalizeRouteVisibility } from '@/features/auth/logic/routeVisibilityAccess';
import {
  CivicMotionTimeline,
  type CivicMotionTimelineItem,
} from '@/features/shared/ui/timeline/CivicMotionTimeline';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import { CheckCircle2, Copy, FileText, Users, Vote, XCircle } from 'lucide-react';
import { HashtagDisplay } from '@/features/shared/ui/hashtags';
import { extractHashtags } from '@/zero/common/hashtagHelpers';
import {
  ActionBar,
  ResponsiveActionLabel,
  StatsBar,
  compactActionButtonClassName,
} from '@/features/shared/ui/layout';
import { SubscribeButton, MembershipButton } from '@/features/shared/ui/action-buttons';
import {
  getWikiParticipationName,
  EntityWikiMedia,
  InfoTabs,
  isVisibleWikiParticipationStatus,
  normalizeWikiParticipationRole,
  WikiParticipationDirectory,
  type WikiParticipationItem,
  type WikiParticipationRole,
} from '@/features/shared/ui/wiki';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { EditingModeBadge } from '@/features/shared/ui/status';
import { ShareButton } from '@/features/shared/ui/action-buttons/ShareButton.tsx';
import { VoteButtons } from '@/features/shared/ui/voting';
import { GroupTimelineCard } from '@/features/timeline/ui/cards/GroupTimelineCard';
import { SupporterStatusBadge } from '@/features/amendments/ui/SupporterStatusBadge';
import { TargetSelectionDialog } from '@/features/amendments/ui/TargetSelectionDialog';
import { Link } from '@tanstack/react-router';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import {
  getBranchEditingMode,
  getOrderedBranches,
} from '@/features/amendments/logic/amendmentBranchDisplay';
import type { EditingMode } from '@/zero/amendments/editing-mode-policy';
import { queries } from '@/zero/queries';
import { ActivityLog } from '@/features/shared/ui/wiki/ActivityLog';
import { canViewEntityActivity } from '@/features/shared/hooks/useEntityActivity';
const AMENDMENT_CARD_SURFACE = `${getEntityGradientClasses('amendment')} ${getMotionPreset('hoverLift')}`;

const AMENDMENT_CREATION_MODES = new Set<EditingMode>([
  'edit',
  'view',
  'suggest_internal',
  'vote_internal',
]);
const AMENDMENT_DECISION_MODES = new Set<EditingMode>([
  'suggest_event',
  'event_final_closing_vote',
]);

function AmendmentWorkflowPhaseRail({ mode, t }: { mode: EditingMode; t: any }) {
  const currentMode = getEditingModeOption(mode, t).value;
  const isCreationPhase = AMENDMENT_CREATION_MODES.has(currentMode);
  const isDecisionPhase = AMENDMENT_DECISION_MODES.has(currentMode);
  const isAccepted = currentMode === 'passed';
  const isRejected = currentMode === 'rejected';
  const isResultPhase = isAccepted || isRejected;
  const activeIndex = isCreationPhase ? 0 : 1;

  const items: CivicMotionTimelineItem[] = [
    {
      id: 'creation',
      icon: FileText,
      label: t('features.amendments.workflowPhases.creation', 'Erarbeitung'),
      value: t(
        'features.amendments.workflowPhases.creationDescription',
        'Bearbeiten, prüfen, intern abstimmen'
      ),
      tone: 'accent',
      isActive: isCreationPhase,
      isComplete: isDecisionPhase || isResultPhase,
    },
    {
      id: 'decision',
      icon: Vote,
      label: t('features.amendments.workflowPhases.decision', 'Beschlussfindung'),
      value: t(
        'features.amendments.workflowPhases.decisionDescription',
        'Event-Vorschläge und Abstimmung'
      ),
      tone: 'info',
      isActive: isDecisionPhase,
      isComplete: isResultPhase,
    },
  ];

  const branches: CivicMotionTimelineItem[] = [
    {
      id: 'passed',
      icon: CheckCircle2,
      label: t('features.amendments.workflowPhases.accepted', 'Angenommen'),
      tone: 'success',
      isActive: isAccepted,
    },
    {
      id: 'rejected',
      icon: XCircle,
      label: t('features.amendments.workflowPhases.rejected', 'Abgelehnt'),
      tone: 'danger',
      isActive: isRejected,
    },
  ];

  return (
    <div className="mx-auto mb-8 w-full max-w-2xl px-3 sm:px-4">
      <CivicMotionTimeline
        activeIndex={activeIndex}
        ariaLabel={t('features.amendments.workflowPhases.ariaLabel', 'Amendment workflow')}
        branchLabel={t('features.amendments.workflowPhases.result', 'Ergebnis')}
        branches={branches}
        compact
        items={items}
      />
    </div>
  );
}

export interface AmendmentWikiViewProps {
  virtualizeParticipationDirectory?: boolean;
  amendmentId: any;
  t: any;
  user: any;
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
  normalizedVoteValue: any;
  supporterDirectorySection: any;
}

export function AmendmentWikiView({
  virtualizeParticipationDirectory = false,
  amendmentId,
  t,
  user,
  isSubscribed,
  subscriberCount,
  toggleSubscribe,
  subscribeLoading,
  collaboration,
  amendment,
  roles,
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
  normalizedVoteValue,
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

  const collaboratorRoles: WikiParticipationRole[] = (roles ?? [])
    .map((role: any) => normalizeWikiParticipationRole(role))
    .filter((role: WikiParticipationRole | null): role is WikiParticipationRole => Boolean(role));
  const collaboratorRoleById = new Map(collaboratorRoles.map(role => [role.id, role]));
  const collaboratorDirectoryItems: WikiParticipationItem[] = (collaborators ?? [])
    .filter((collaborator: any) => isVisibleWikiParticipationStatus(collaborator.status))
    .filter((collaborator: any) => collaborator.user?.id)
    .map((collaborator: any) => {
      const role =
        normalizeWikiParticipationRole(collaborator.role) ??
        (collaborator.role_id ? collaboratorRoleById.get(collaborator.role_id) : null);

      return {
        id: collaborator.id ?? `collaborator-${collaborator.user.id}`,
        userId: collaborator.user.id,
        name: getWikiParticipationName(collaborator.user),
        handle: collaborator.user.handle ?? null,
        email: collaborator.user.contact_email ?? null,
        avatar: collaborator.user.avatar ?? null,
        status: collaborator.status ?? null,
        roles: role ? [role] : [],
      };
    });
  const orderedBranches = getOrderedBranches(amendment.current_process_run?.branches ?? []);
  const primaryBranchMode = getBranchEditingMode(orderedBranches[0] ?? null);
  const branchCount = orderedBranches.length;
  const changeRequestCount =
    amendment.change_requests?.length ?? amendment.change_request_count ?? 0;
  const cloneLabel = translateText('generated.inline.0071_clone_d8cdb573');
  const amendmentVisibility = normalizeRouteVisibility(amendment.visibility);

  return (
    <>
      {/* Header with centered title and subtitle */}
      <div className="mb-4 text-center md:mb-8">
        <div className="mb-2 flex min-w-0 flex-col items-center justify-center gap-1 md:flex-row md:gap-3">
          <h1 className="max-w-full min-w-0 text-4xl font-bold break-words">{amendment.title}</h1>
          <VisibilityBadge value={amendmentVisibility} data-entity-visibility={amendmentVisibility}>
            {t(`common.visibility.${amendmentVisibility}`)}
          </VisibilityBadge>
          <EditingModeBadge mode={primaryBranchMode} showIcon />
        </div>
        {amendment.amendment_hashtags && amendment.amendment_hashtags.length > 0 ? (
          <div className="mt-3 md:hidden">
            <HashtagDisplay
              hashtags={extractHashtags(amendment.amendment_hashtags)}
              centered
              badgeClassName="max-w-full whitespace-normal break-all text-center"
            />
          </div>
        ) : null}
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

      <EntityWikiMedia
        imageUrl={amendment.image_url}
        videoUrl={amendment.video_url}
        alt={amendment.title ?? ''}
      />

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
        items={[
          {
            value: amendment.collaborator_count ?? collaboration.collaboratorCount,
            label: t('components.labels.collaborators', {
              count: amendment.collaborator_count ?? collaboration.collaboratorCount,
            }),
          },
          {
            value: subscriberCount,
            label: t('components.labels.subscribers', { count: subscriberCount }),
          },
          {
            value: amendment.clone_count ?? clones.length,
            label: t('components.labels.clones', {
              count: amendment.clone_count ?? clones.length,
            }),
          },
          {
            value: branchCount,
            label: t('components.labels.branches', { count: branchCount }),
          },
          {
            value: supportingGroupCount,
            label: t('components.labels.supportingGroups', { count: supportingGroupCount }),
          },
          {
            value: changeRequestCount,
            label: t('components.labels.changeRequests', { count: changeRequestCount }),
          },
        ]}
      />

      {/* Action Bar */}
      <ActionBar>
        {user ? (
          <>
            <SubscribeButton
              data-action-id="amendments.wiki.toggle.subscription"
              entityType="amendment"
              entityId={amendmentId}
              isSubscribed={isSubscribed}
              onToggleSubscribe={toggleSubscribe}
              isLoading={subscribeLoading}
              compactOnMobile
            />
            <MembershipButton
              data-action-id="amendments.wiki.manage.collaboration"
              actionType="collaborate"
              status={collaboration.status}
              isMember={collaboration.isCollaborator}
              hasRequested={collaboration.hasRequested}
              isInvited={collaboration.isInvited}
              onRequest={collaboration.requestCollaboration}
              onLeave={collaboration.leaveCollaboration}
              onAcceptInvitation={collaboration.acceptInvitation}
              isLoading={collaboration.isLoading}
              compactOnMobile
            />
            <VoteButtons
              upvotes={upvotes}
              downvotes={downvotes}
              userVote={normalizedVoteValue}
              onVote={handleVote}
              orientation="horizontal"
              presentation="surface"
            />
            <Button
              data-action-id="amendments.wiki.clone.current"
              variant="outline"
              size="default"
              onClick={handleClone}
              className={compactActionButtonClassName}
              aria-label={cloneLabel}
            >
              <Copy className="mr-0 h-4 w-4 sm:mr-2" />
              <ResponsiveActionLabel full={cloneLabel} compact={cloneLabel} />
            </Button>
          </>
        ) : null}
        <ShareButton
          data-action-id="amendments.wiki.open.share"
          url={`/amendment/${amendmentId}`}
          title={amendment.title ?? ''}
          description={amendment.preamble || amendment.code || ''}
          shareContextItem={{
            id: amendmentId,
            type: 'amendment',
            title: amendment.title ?? '',
            description: amendment.preamble || amendment.code || undefined,
            createdAt: new Date(),
            status: primaryBranchMode,
            groupName: targetGroup?.name,
            collaboratorCount: (collaborators ?? []).length,
            supportingGroupsCount: supportingGroupCount,
            tags:
              amendment.amendment_hashtags
                ?.map((relation: any) => relation.hashtag?.tag)
                .filter((tag: any): tag is string => Boolean(tag)) ?? [],
          }}
          compactOnMobile
        />
      </ActionBar>

      {/* Hashtags */}
      {amendment.amendment_hashtags && amendment.amendment_hashtags.length > 0 && (
        <div className="mb-6 hidden md:block">
          <HashtagDisplay hashtags={extractHashtags(amendment.amendment_hashtags)} centered />
        </div>
      )}

      {/* About and Contact Tabs */}
      <InfoTabs
        activity={
          canViewEntityActivity('amendment', { ...amendment, collaborators }, user?.id) ? (
            <ActivityLog type="amendment" entityId={amendmentId} />
          ) : undefined
        }
        about={amendment.code || 'No description available.'}
        contact={{
          country: amendment.country ?? undefined,
          region: amendment.region ?? undefined,
          post_code: amendment.post_code ?? undefined,
          city: amendment.city ?? undefined,
          street: amendment.street ?? undefined,
          house_number: amendment.house_number ?? undefined,
          latitude: amendment.latitude ?? null,
          longitude: amendment.longitude ?? null,
          location_kind: amendment.location_kind ?? null,
          location_place_id: amendment.location_place_id ?? null,
          location_boundary_source: amendment.location_boundary_source ?? null,
          location_geometry: amendment.location_geometry ?? null,
          location_bounds: amendment.location_bounds ?? null,
        }}
        className="mb-8"
      />

      <AmendmentWorkflowPhaseRail mode={primaryBranchMode} t={t} />

      <WikiParticipationDirectory
        title={translateText('generated.inline.0020_collaborators_6eb695e5', 'Collaborators')}
        description={translateText(
          'generated.inline.0072_active_collaborators_grouped_by_role_7813f854'
        )}
        items={collaboratorDirectoryItems}
        roles={collaboratorRoles}
        entityType="amendment"
        searchPlaceholder={translateText(
          'generated.inline.0099_search_collaborators_by_name_role_or_status_c0a4b06d',
          'Search collaborators'
        )}
        emptyLabel={translateText('features.amendments.wiki.noCollaborators')}
        noResultsLabel={translateText('features.amendments.wiki.noCollaboratorsMatch')}
        virtualSource={
          virtualizeParticipationDirectory
            ? {
                historyKey: `amendment-${amendmentId}-participation-directory`,
                context: {
                  amendmentId,
                  statuses: ['active', 'admin', 'collaborator', 'confirmed', 'member', 'owner'],
                },
                getPageQuery: ({ limit, start, dir, settled, query, roleIds }) => ({
                  query: queries.amendments.collaboratorPage({
                    amendmentId,
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
                  query: queries.amendments.collaboratorById({ id }) as never,
                  options: { ttl: settled ? ('5m' as const) : ('none' as const) },
                }),
                getRowKey: row => row.id,
                mapRow: collaborator => {
                  const collaboratorUser = collaborator.user;
                  const role =
                    normalizeWikiParticipationRole(collaborator.role) ??
                    (collaborator.role_id ? collaboratorRoleById.get(collaborator.role_id) : null);
                  return {
                    id: collaborator.id,
                    userId: collaboratorUser?.id ?? collaborator.user_id,
                    name: getWikiParticipationName(collaboratorUser),
                    handle: collaboratorUser?.handle ?? null,
                    email: collaboratorUser?.contact_email ?? null,
                    avatar: collaboratorUser?.avatar ?? null,
                    status: collaborator.status ?? null,
                    roles: role ? [role] : [],
                  };
                },
              }
            : undefined
        }
      />

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
                        supporter.locationLabel !==
                        translateText('features.amendments.wiki.locationNotSet')
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
              {clones.map((clone: any) => {
                const cloneBranch =
                  getOrderedBranches(clone.current_process_run?.branches ?? [])[0] ?? null;
                return (
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
                          <EditingModeBadge mode={getBranchEditingMode(cloneBranch)} showIcon />
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
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Clone Dialog */}
      <TargetSelectionDialog
        open={cloneDialogOpen}
        onOpenChange={setCloneDialogOpen}
        currentUserId={user?.id || ''}
        allUsers={[]}
        onConfirm={handleConfirmClone}
        isSaving={isCloning}
        showCollaboratorSelection={false}
        title={translateText('generated.inline.0085_clone_amendment_select_target_8fa1e50c')}
        description={translateText(
          'generated.inline.0086_optionally_link_the_clone_to_a_group_and_even_9a83e8d9'
        )}
        confirmButtonText={translateText('generated.inline.0009_clone_amendment_71d1877f')}
      />
    </>
  );
}
