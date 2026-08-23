'use client';

import {
  translate as translateText,
  useTranslation,
} from '@/features/shared/hooks/use-translation';
import { useGroupWikiPage } from '@/features/groups/hooks/useGroupWikiPage';
import { AccessDenied as AccessDeniedView } from '@/features/auth/ui/AccessDenied';
import { useCreateRecoveryDraft } from '@/features/create/logic/createFinalization';
import { CreateRecoveryState } from '@/features/create/ui/CreateRecoveryState';
import { PageSkeleton } from '@/features/shared/ui/feedback';
import { formatLocation } from '@/features/shared/logic/locationHelpers';
import { richTextToPlainText } from '@/features/shared/logic/richText';
import { groupWikiRelatedGroupsByOrientation } from '@/features/groups/logic/groupWikiHelpers';
import { GroupWikiContentView } from './GroupWikiContentView';
import { resolveAppTutorialFixtureValue } from '@/features/app-tutorial/fixture-copy';

interface GroupWikiProps {
  groupId: string;
}

function GroupWikiNotFoundView() {
  return (
    <div>
      <div className="py-12 text-center">
        <h1 className="mb-4 text-2xl font-bold">
          {translateText('generated.inline.0544_group_not_found_3e51f77a')}
        </h1>
        <p className="text-muted-foreground">
          {translateText(
            'generated.inline.0545_the_group_you_re_looking_for_doesn_t_exist_or_4cf69159'
          )}
        </p>
      </div>
    </div>
  );
}

function toPlainDescription(value: unknown) {
  const text = richTextToPlainText(value);
  return text || undefined;
}

export function GroupWiki({ groupId }: GroupWikiProps) {
  const { language } = useTranslation();
  const recoveryDraft = useCreateRecoveryDraft('group', groupId);
  const {
    group,
    isLoading,
    canAccess,
    isAuthenticated,
    viewerId,
    memberCount,
    eventsCount,
    amendmentsCount,
    subscriberCount,
    isSubscribed,
    subscribeLoading,
    toggleSubscribe,
    status,
    isMember,
    hasRequested,
    isInvited,
    isBase,
    isHierarchical,
    isSibling,
    membershipLoading,
    canRequestJoin,
    canAcceptInvitation,
    requestJoinDisabledReason,
    requestJoinConflictResponse,
    acceptInvitationConflictResponse,
    requestJoin,
    leaveGroup,
    acceptInvitation,
  } = useGroupWikiPage(groupId);

  if (!group) {
    if (recoveryDraft) {
      return <CreateRecoveryState draft={recoveryDraft} />;
    }

    if (isLoading) {
      return <PageSkeleton />;
    }

    return <GroupWikiNotFoundView />;
  }

  if (!canAccess) {
    return <AccessDeniedView />;
  }

  const displayGroup = resolveAppTutorialFixtureValue(group, {
    tutorialRunId: group.tutorial_run_id,
    language,
  });
  const groupLocation = formatLocation(displayGroup);
  const groupDescription = toPlainDescription(displayGroup.description);
  const { parentGroups, childGroups } = groupWikiRelatedGroupsByOrientation(
    [
      ...(displayGroup.relationships_as_source ?? []),
      ...(displayGroup.relationships_as_target ?? []),
    ],
    groupId
  );
  const siblingGroups = displayGroup.sibling_groups ?? [];
  const connectedGroup = displayGroup.connected_group;
  const primarySiblingMembershipMode = displayGroup.primary_sibling_membership_mode ?? null;
  const tutorialMembershipRequestLocked = hasRequested && Boolean(group.tutorial_run_id);
  const requestJoinActionDisabled =
    tutorialMembershipRequestLocked ||
    (!isMember && !hasRequested && !isInvited && !canRequestJoin);
  const acceptInvitationDisabled = isInvited && !canAcceptInvitation;
  const parliamentSourceGroups = (displayGroup.sibling_sources ?? [])
    .map(sourceLink => sourceLink.source_group)
    .filter(
      (
        sourceGroup
      ): sourceGroup is NonNullable<
        NonNullable<typeof displayGroup.sibling_sources>[number]['source_group']
      > => Boolean(sourceGroup)
    );
  return (
    <GroupWikiContentView
      virtualizeParticipationDirectory
      acceptInvitation={acceptInvitation}
      acceptInvitationConflictResponse={acceptInvitationConflictResponse}
      acceptInvitationDisabled={acceptInvitationDisabled}
      amendmentsCount={amendmentsCount}
      childGroups={childGroups}
      connectedGroup={connectedGroup}
      eventsCount={eventsCount}
      group={displayGroup}
      groupDescription={groupDescription}
      groupId={groupId}
      groupLocation={groupLocation}
      hasRequested={hasRequested}
      isBase={isBase}
      isHierarchical={isHierarchical}
      isAuthenticated={isAuthenticated}
      viewerId={viewerId}
      isInvited={isInvited}
      isMember={isMember}
      isSibling={isSibling}
      isSubscribed={isSubscribed}
      leaveGroup={leaveGroup}
      memberCount={memberCount}
      membershipLoading={membershipLoading}
      parliamentSourceGroups={parliamentSourceGroups}
      parentGroups={parentGroups}
      primarySiblingMembershipMode={primarySiblingMembershipMode}
      requestJoin={requestJoin}
      requestJoinActionDisabled={requestJoinActionDisabled}
      requestJoinConflictResponse={requestJoinConflictResponse}
      requestJoinDisabledReason={requestJoinDisabledReason}
      siblingGroups={siblingGroups}
      status={status}
      subscribeLoading={subscribeLoading}
      subscriberCount={subscriberCount}
      toggleSubscribe={toggleSubscribe}
    />
  );
}
