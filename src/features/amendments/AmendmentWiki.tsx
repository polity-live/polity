'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { Badge } from '@/features/shared/ui/ui/badge';
import { Button } from '@/features/shared/ui/ui/button';
import { Users, Copy } from 'lucide-react';
import { HashtagDisplay } from '@/features/shared/ui/ui/hashtag-display';
import { extractHashtags } from '@/zero/common/hashtagHelpers';
import { StatsBar } from '@/features/shared/ui/ui/StatsBar';
import { ActionBar } from '@/features/shared/ui/ui/ActionBar';
import { SubscribeButton, MembershipButton } from '@/features/shared/ui/action-buttons';
import { InfoTabs } from '@/features/shared/ui/wiki/InfoTabs.tsx';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { EditingModeBadge } from '@/features/shared/ui/ui/editing-mode.tsx';
import { ShareButton } from '@/features/shared/ui/action-buttons/ShareButton.tsx';
import { VoteButtons, type VoteValue } from '@/features/shared/ui/voting';
import { GroupTimelineCard } from '@/features/timeline/ui/cards/GroupTimelineCard';
import { SupporterStatusBadge } from '@/features/amendments/ui/SupporterStatusBadge';
import { TargetSelectionDialog } from '@/features/amendments/ui/TargetSelectionDialog';
import { Link } from '@tanstack/react-router';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useAmendmentWikiPage } from './hooks/useAmendmentWikiPage';
import { AccessDenied } from '@/features/auth/ui/AccessDenied';
import { WikiIncumbentPanel } from '@/features/shared/ui/wiki/WikiIncumbentPanel';
import { buildAmendmentWikiCollaboratorSections } from '@/features/amendments/logic/buildAmendmentWikiCollaboratorSections';
import { SupporterLocalityMap } from './ui/SupporterLocalityMap';

interface AmendmentWikiProps {
  amendmentId: string;
}

const GRADIENTS = [
  'bg-gradient-to-br from-slate-50 via-white to-slate-100',
  'bg-gradient-to-br from-emerald-50 via-white to-teal-100',
  'bg-gradient-to-br from-amber-50 via-white to-orange-100',
  'bg-gradient-to-br from-sky-50 via-white to-cyan-100',
] as const;

export function AmendmentWiki({ amendmentId }: AmendmentWikiProps) {
  const { t } = useTranslation();
  const {
    user,
    canAccess,
    isSubscribed,
    subscriberCount,
    toggleSubscribe,
    isLoading: subscribeLoading,
    collaboration,
    amendment,
    roles,
    collaborators,
    supportingGroups,
    clones,
    clonedFrom,
    totalSupportingMembers,
    targetCollaborator,
    targetGroup,
    implementationStatus,
    evaluationDueDate,
    supporterMapItems,
    upvotes,
    downvotes,
    currentVoteValue,
    handleVote,
    cloneDialogOpen,
    setCloneDialogOpen,
    isCloning,
    handleClone,
    handleConfirmClone,
    usersData,
    getSupportStatus,
  } = useAmendmentWikiPage(amendmentId);
  const normalizedVoteValue: VoteValue =
    currentVoteValue === -1 ? -1 : currentVoteValue === 1 ? 1 : 0;
  const collaboratorSections = buildAmendmentWikiCollaboratorSections(roles, collaborators);

  if (!amendment) {
    return (
      <div>
        <div className="py-12 text-center">
          <h1 className="mb-4 text-2xl font-bold">Amendment Not Found</h1>
          <p className="text-muted-foreground">
            The amendment you're looking for doesn't exist or has been removed.
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
                <p className="text-muted-foreground text-xs">Target Collaborator</p>
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
                <p className="text-muted-foreground text-xs">Targets</p>
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
                <p className="text-muted-foreground text-xs">Cloned from</p>
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
          { value: supportingGroups.length, labelKey: 'components.labels.supportingGroups' },
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
          Clone
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
            supportingGroupsCount: supportingGroups.length,
            tags:
              amendment.amendment_hashtags
                ?.map(relation => relation.hashtag?.tag)
                .filter((tag): tag is string => Boolean(tag)) ?? [],
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
          description="Active collaborators grouped by role"
          sections={collaboratorSections}
          icon={Users}
        />
      )}

      {/* Supported By Section */}
      {supportingGroups.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Supported By
            </CardTitle>
            <CardDescription>
              Groups supporting this amendment ({totalSupportingMembers} total members)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {supportingGroups
                .filter(group => {
                  const groupId = group.group?.id ?? group.group_id ?? group.id;
                  return getSupportStatus(groupId) !== 'declined';
                })
                .map(group => {
                  const groupId = group.group?.id ?? group.group_id ?? group.id;
                  const supportStatus = getSupportStatus(groupId);
                  return (
                    <div key={group.id} className="relative">
                      <GroupTimelineCard
                        group={{
                          id: String(groupId),
                          name: group.group?.name ?? t('common.unspecified'),
                          memberCount: group.group?.member_count ?? 0,
                          hashtags: [],
                        }}
                      />
                      <div className="absolute top-2 right-2">
                        <SupporterStatusBadge status={supportStatus} size="sm" />
                      </div>
                    </div>
                  );
                })}
            </div>
            {supporterMapItems.length > 0 && (
              <div className="mt-6 space-y-3">
                <div>
                  <h3 className="text-base font-semibold">Unterstützerkarte</h3>
                  <p className="text-muted-foreground text-sm">
                    Positive Unterstützungsentscheidungen mit vorhandenen Ortsdaten.
                  </p>
                </div>
                <SupporterLocalityMap items={supporterMapItems} />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {(implementationStatus || evaluationDueDate) && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Implementation Evaluation</CardTitle>
            <CardDescription>Aktueller Stand der Umsetzungsprüfung dieses Antrags.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            {implementationStatus ? (
              <Badge variant="secondary">{implementationStatus}</Badge>
            ) : null}
            {evaluationDueDate ? (
              <span className="text-muted-foreground text-sm">
                Fällig bis {new Date(evaluationDueDate).toLocaleDateString('de-DE')}
              </span>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Clones Section */}
      {clones.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5" />
              Clones ({clones.length})
            </CardTitle>
            <CardDescription>Amendments cloned from this one</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {clones.map((clone, index: number) => (
                <Link
                  key={clone.id}
                  to="/amendment/$id"
                  params={{ id: clone.id }}
                  className="block transition-opacity hover:opacity-90"
                >
                  <Card
                    className={`overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-xl ${GRADIENTS[index % GRADIENTS.length]}`}
                  >
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
                          <Badge variant="outline" className="text-xs">
                            {clone.code}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    {clone.created_at && (
                      <CardContent className="pt-0">
                        <p className="text-muted-foreground text-xs">
                          Created: {new Date(clone.created_at).toLocaleDateString()}
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
        allUsers={(usersData?.$users || []).map(u => ({
          id: u.id,
          name: u.handle || u.email || 'Unknown User',
          email: u.email,
          avatar: u.avatar ?? undefined,
        }))}
        onConfirm={handleConfirmClone}
        isSaving={isCloning}
        showCollaboratorSelection={false}
        title="Clone Amendment - Select Target"
        description="Optionally link the clone to a group and event from your network."
        confirmButtonText="Clone Amendment"
      />
    </div>
  );
}
