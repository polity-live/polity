'use client';

import { BadgeControl, VisibilityBadge } from '@/features/shared/ui/status';
import { normalizeRouteVisibility } from '@/features/auth/logic/routeVisibilityAccess';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { LinkGroupDialog } from '@/features/network/ui/LinkGroupDialog';
import { BookOpen, Link as LinkIcon, Network } from 'lucide-react';
import { HashtagDisplay } from '@/features/shared/ui/hashtags';
import { extractHashtags } from '@/zero/common/hashtagHelpers';
import { BlogTimelineCard } from '@/features/timeline/ui/cards/BlogTimelineCard';
import {
  ActionBar,
  ResponsiveActionLabel,
  StatsBar,
  compactActionButtonClassName,
} from '@/features/shared/ui/layout';
import { SubscribeButton, MembershipButton } from '@/features/shared/ui/action-buttons';
import { SocialBar } from '@/features/users/ui/SocialBar';
import {
  getWikiParticipationName,
  EntityWikiMedia,
  InfoTabs,
  isVisibleWikiParticipationStatus,
  normalizeWikiParticipationRole,
  WikiParticipationDirectory,
  WikiRosterSummaryCard,
  type WikiParticipationItem,
  type WikiParticipationRole,
} from '@/features/shared/ui/wiki';
import { GroupTimelineCard } from '@/features/timeline/ui/cards/GroupTimelineCard';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { ShareButton } from '@/features/shared/ui/action-buttons/ShareButton.tsx';
import { Button } from '@/features/shared/ui/ui/button';
import { SiblingMembershipModeDescription } from '@/features/network/ui/GroupRelationshipFields';
import { getCanonicalMembershipModeLabel } from '@/features/network/logic/groupConnectionDerived';
import { richTextToPlainText } from '@/features/shared/logic/richText';
import { RelatedGroupsTabs } from '@/features/groups/ui/RelatedGroupsTabs';
import { queries } from '@/zero/queries';
import { ActivityLog } from '@/features/shared/ui/wiki/ActivityLog';
import { canViewEntityActivity } from '@/features/shared/hooks/useEntityActivity';

export interface GroupWikiContentViewProps {
  virtualizeParticipationDirectory?: boolean;
  groupId: string;
  group: any;
  groupLocation: string;
  groupDescription?: string;
  memberCount: number;
  subscriberCount: number;
  eventsCount: number;
  amendmentsCount: number;
  isAuthenticated: boolean;
  viewerId?: string;
  isSubscribed: boolean;
  subscribeLoading: boolean;
  toggleSubscribe: () => void;
  status: any;
  isMember: boolean;
  hasRequested: boolean;
  isInvited: boolean;
  isBase: boolean;
  isHierarchical: boolean;
  isSibling: boolean;
  membershipLoading: boolean;
  requestJoinActionDisabled: boolean;
  acceptInvitationDisabled: boolean;
  requestJoinDisabledReason?: string;
  requestJoinConflictResponse: any;
  acceptInvitationConflictResponse: any;
  requestJoin: () => void;
  leaveGroup: () => void;
  acceptInvitation: () => void;
  parentGroups: any[];
  childGroups: any[];
  siblingGroups: any[];
  connectedGroup: any;
  primarySiblingMembershipMode: string | null;
  parliamentSourceGroups: any[];
}

interface GroupRoleHolderHistoryLike {
  user_id?: string | null;
  end_date?: number | null;
}

function dedupeWikiParticipationRoles(roles: readonly WikiParticipationRole[]) {
  const roleById = new Map<string, WikiParticipationRole>();

  for (const role of roles) {
    if (!roleById.has(role.id)) {
      roleById.set(role.id, role);
    }
  }

  return [...roleById.values()].sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
  );
}

function getCurrentElectedWikiRolesByUserId(rawRoles: readonly any[]) {
  const rolesByUserId = new Map<string, WikiParticipationRole[]>();

  for (const rawRole of rawRoles) {
    if (rawRole?.assignment_mode !== 'elected' || rawRole?.scope !== 'group') {
      continue;
    }

    const role = normalizeWikiParticipationRole(rawRole);
    if (!role) {
      continue;
    }

    const holderHistory: readonly GroupRoleHolderHistoryLike[] =
      rawRole.holder_history ?? rawRole.holders ?? [];
    for (const holder of holderHistory) {
      if (!holder.user_id || holder.end_date != null) {
        continue;
      }

      const userRoles = rolesByUserId.get(holder.user_id) ?? [];
      userRoles.push(role);
      rolesByUserId.set(holder.user_id, userRoles);
    }
  }

  return new Map(
    [...rolesByUserId.entries()].map(([userId, roles]) => [
      userId,
      dedupeWikiParticipationRoles(roles),
    ])
  );
}

function getMembershipWikiRoles(
  membership: any,
  electedRolesByUserId: ReadonlyMap<string, readonly WikiParticipationRole[]>
) {
  const directRoleSources = [
    ...(membership.roles?.length ? membership.roles : []),
    ...(membership.role ? [membership.role] : []),
    ...((membership.membership_roles ?? [])
      .map((membershipRole: any) => membershipRole?.role)
      .filter(Boolean) as any[]),
  ];
  const directRoles = directRoleSources
    .map((role: any) => normalizeWikiParticipationRole(role))
    .filter((role: WikiParticipationRole | null): role is WikiParticipationRole => Boolean(role));
  const userId = membership.user?.id ?? membership.user_id;
  const electedRoles = userId ? (electedRolesByUserId.get(userId) ?? []) : [];

  return dedupeWikiParticipationRoles([...directRoles, ...electedRoles]);
}

export const groupWikiContentViewInternals = {
  dedupeWikiParticipationRoles,
  getCurrentElectedWikiRolesByUserId,
  getMembershipWikiRoles,
};

export function GroupWikiContentView({
  virtualizeParticipationDirectory = false,
  groupId,
  group,
  groupLocation,
  groupDescription,
  memberCount,
  subscriberCount,
  eventsCount,
  amendmentsCount,
  isAuthenticated,
  viewerId,
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
  requestJoinActionDisabled,
  acceptInvitationDisabled,
  requestJoinDisabledReason,
  requestJoinConflictResponse,
  acceptInvitationConflictResponse,
  requestJoin,
  leaveGroup,
  acceptInvitation,
  parentGroups,
  childGroups,
  siblingGroups,
  connectedGroup,
  primarySiblingMembershipMode,
  parliamentSourceGroups,
}: GroupWikiContentViewProps) {
  const { t } = useTranslation();

  const toPlainDescription = (value: unknown) => {
    const text = richTextToPlainText(value);
    return text || undefined;
  };

  const rawGroupRoles = group.roles ?? [];
  const memberRoles: WikiParticipationRole[] = rawGroupRoles
    .map((role: any) => normalizeWikiParticipationRole(role))
    .filter((role: WikiParticipationRole | null): role is WikiParticipationRole => Boolean(role));
  const electedRolesByUserId = getCurrentElectedWikiRolesByUserId(rawGroupRoles);
  const memberDirectoryItems: WikiParticipationItem[] = (group.memberships ?? [])
    .filter((membership: any) => isVisibleWikiParticipationStatus(membership.status))
    .filter((membership: any) => membership.user?.id)
    .map((membership: any) => {
      const roles = getMembershipWikiRoles(membership, electedRolesByUserId);

      return {
        id: membership.id ?? `member-${membership.user.id}`,
        userId: membership.user.id,
        name: getWikiParticipationName(membership.user),
        handle: membership.user.handle ?? null,
        email: membership.user.contact_email ?? null,
        avatar: membership.user.avatar ?? null,
        status: membership.status,
        roles,
      };
    });
  const directoryRoles = dedupeWikiParticipationRoles([
    ...memberRoles,
    ...memberDirectoryItems.flatMap(item => item.roles as readonly WikiParticipationRole[]),
  ]);
  const groupVisibility = normalizeRouteVisibility(group.visibility);

  return (
    <>
      {/* Header with centered title and subtitle */}
      <div className="mb-8 text-center">
        <div className="mb-2 flex min-w-0 flex-col items-center justify-center gap-2 md:flex-row md:gap-3">
          <h1 className="max-w-full min-w-0 text-4xl font-bold break-words">{group.name}</h1>
          <div className="flex max-w-full flex-wrap items-center justify-center gap-2 md:contents">
            <VisibilityBadge value={groupVisibility} data-entity-visibility={groupVisibility}>
              {t(`common.visibility.${groupVisibility}`)}
            </VisibilityBadge>
            {isHierarchical ? (
              <BadgeControl variant="outline" size="sm">
                {t('components.badges.hierarchicalGroup')}
              </BadgeControl>
            ) : null}
            {isSibling ? (
              <BadgeControl variant="outline" size="sm">
                {translateText('generated.inline.0080_geschwistergruppe_1053d99c')}
              </BadgeControl>
            ) : null}
            {isBase ? (
              <BadgeControl variant="outline" size="sm">
                {t('components.badges.baseGroup')}
              </BadgeControl>
            ) : null}
          </div>
        </div>
        {group.group_hashtags && group.group_hashtags.length > 0 ? (
          <div className="mt-3 md:hidden">
            <HashtagDisplay
              hashtags={extractHashtags(group.group_hashtags)}
              centered
              badgeClassName="max-w-full whitespace-normal break-all text-center"
            />
          </div>
        ) : null}
        {groupLocation && <p className="text-muted-foreground">{groupLocation}</p>}
      </div>

      <EntityWikiMedia
        imageUrl={group.image_url}
        videoUrl={group.video_url}
        alt={group.name ?? t('common.entities.group')}
      />

      {/* Stats Bar with Events and Amendments */}
      <StatsBar
        items={[
          { value: memberCount, label: t('components.labels.members', { count: memberCount }) },
          {
            value: subscriberCount,
            label: t('components.labels.subscribers', { count: subscriberCount }),
          },
          { value: eventsCount, label: t('components.labels.events', { count: eventsCount }) },
          {
            value: amendmentsCount,
            label: t('components.labels.amendments', { count: amendmentsCount }),
          },
        ]}
      />

      {/* Action Bar */}
      <ActionBar>
        {isAuthenticated ? (
          <>
            <LinkGroupDialog
              currentGroupId={groupId}
              currentGroupName={group.name ?? ''}
              trigger={
                <Button
                  data-action-id="groups.wiki.open.link-dialog"
                  className={compactActionButtonClassName}
                  aria-label={t('components.actionBar.linkGroup')}
                >
                  <LinkIcon className="mr-0 h-4 w-4 sm:mr-2" />
                  <ResponsiveActionLabel
                    full={t('components.actionBar.linkGroup')}
                    compact={t('components.actionBar.compact.linkGroup')}
                  />
                </Button>
              }
            />
            <SubscribeButton
              data-action-id="groups.wiki.toggle.subscription"
              entityType="group"
              entityId={groupId}
              isSubscribed={isSubscribed}
              onToggleSubscribe={toggleSubscribe}
              isLoading={subscribeLoading}
              compactOnMobile
            />
            <MembershipButton
              data-action-id="groups.wiki.manage.membership"
              actionType="join"
              status={status}
              isMember={isMember}
              hasRequested={hasRequested}
              isInvited={isInvited}
              onRequest={requestJoin}
              onLeave={leaveGroup}
              onAcceptInvitation={acceptInvitation}
              isLoading={membershipLoading}
              loadingLabel={t('common.checks.membership')}
              disabled={requestJoinActionDisabled || acceptInvitationDisabled}
              disabledReason={
                acceptInvitationDisabled
                  ? (acceptInvitationConflictResponse?.summary ??
                    acceptInvitationConflictResponse?.conflicts[0]?.summary)
                  : requestJoinActionDisabled
                    ? requestJoinDisabledReason
                    : undefined
              }
              conflictResponse={
                acceptInvitationDisabled
                  ? acceptInvitationConflictResponse
                  : requestJoinActionDisabled
                    ? requestJoinConflictResponse
                    : null
              }
              compactOnMobile
            />
          </>
        ) : null}
        <ShareButton
          data-action-id="groups.wiki.open.share"
          url={`/group/${groupId}`}
          title={group.name ?? ''}
          description={groupDescription ?? ''}
          shareContextItem={{
            id: groupId,
            type: 'group',
            title: group.name ?? '',
            description: groupDescription,
            createdAt: new Date(),
            memberCount,
            eventCount: eventsCount,
            amendmentCount: amendmentsCount,
            stats: {
              members: memberCount,
            },
          }}
          compactOnMobile
        />
      </ActionBar>

      {/* Hashtags */}
      {group.group_hashtags && group.group_hashtags.length > 0 && (
        <div className="mb-6 hidden md:block">
          <HashtagDisplay hashtags={extractHashtags(group.group_hashtags)} centered />
        </div>
      )}

      {/* Social Media */}
      <SocialBar
        socialMedia={{
          website: group.website ?? undefined,
          youtube: group.youtube ?? undefined,
          linkedin: group.linkedin ?? undefined,
          whatsapp: group.whatsapp ?? undefined,
          instagram: group.instagram ?? undefined,
          twitter: group.twitter ?? group.x ?? undefined,
          facebook: group.facebook ?? undefined,
          snapchat: group.snapchat ?? undefined,
          tiktok: group.tiktok ?? undefined,
        }}
      />

      {/* About and Contact Tabs */}
      <InfoTabs
        activity={
          canViewEntityActivity('group', group, viewerId) ? (
            <ActivityLog type="group" entityId={groupId} />
          ) : undefined
        }
        about={groupDescription}
        contact={{
          email: group.email ?? undefined,
          website: group.website ?? undefined,
          youtube: group.youtube ?? undefined,
          linkedin: group.linkedin ?? undefined,
          whatsapp: group.whatsapp ?? undefined,
          instagram: group.instagram ?? undefined,
          twitter: group.twitter ?? group.x ?? undefined,
          facebook: group.facebook ?? undefined,
          snapchat: group.snapchat ?? undefined,
          tiktok: group.tiktok ?? undefined,
          country: group.country ?? undefined,
          region: group.region ?? undefined,
          post_code: group.post_code ?? undefined,
          city: group.city ?? undefined,
          street: group.street ?? undefined,
          house_number: group.house_number ?? undefined,
          latitude: group.latitude ?? null,
          longitude: group.longitude ?? null,
          location_kind: group.location_kind ?? null,
          location_place_id: group.location_place_id ?? null,
          location_boundary_source: group.location_boundary_source ?? null,
          location_geometry: group.location_geometry ?? null,
          location_bounds: group.location_bounds ?? null,
          location: groupLocation || undefined,
        }}
        className="mb-12"
      />

      <div className="mb-8">
        <WikiParticipationDirectory
          className="mb-0"
          title={translateText('features.groups.wiki.membersTitle')}
          description={translateText('features.groups.wiki.membersDescription')}
          items={memberDirectoryItems}
          roles={directoryRoles}
          entityType="group"
          searchPlaceholder={translateText('features.groups.wiki.membersSearch')}
          emptyLabel={translateText('features.groups.wiki.noMembers')}
          noResultsLabel={translateText('features.groups.wiki.noMembersMatch')}
          leadingCard={
            <WikiRosterSummaryCard
              totalCount={memberCount}
              signedUpCount={group.signed_up_member_count}
              items={memberDirectoryItems}
            />
          }
          virtualSource={
            virtualizeParticipationDirectory
              ? {
                  historyKey: `group-${groupId}-participation-directory`,
                  context: {
                    groupId,
                    statuses: ['active', 'admin', 'collaborator', 'confirmed', 'member', 'owner'],
                  },
                  getPageQuery: ({ limit, start, dir, settled, query, roleIds }) => ({
                    query: queries.groups.membershipPage({
                      groupId,
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
                    query: queries.groups.membershipById({ id }) as never,
                    options: { ttl: settled ? ('5m' as const) : ('none' as const) },
                  }),
                  getRowKey: row => row.id,
                  mapRow: membership => {
                    const user = membership.user;
                    return {
                      id: membership.id,
                      userId: user?.id ?? membership.user_id,
                      name: getWikiParticipationName(user),
                      handle: user?.handle ?? null,
                      email: user?.contact_email ?? null,
                      avatar: user?.avatar ?? null,
                      status: membership.status ?? null,
                      roles: getMembershipWikiRoles(membership, electedRolesByUserId),
                    };
                  },
                }
              : undefined
          }
        />
      </div>

      {connectedGroup ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>
              {translateText('generated.inline.0547_verbundene_gruppe_2d1da077')}
            </CardTitle>
            <CardDescription>
              {group.sibling_membership_mode === 'elected'
                ? translateText('generated.inline.0081_gewaehlte_geschwistergruppe_fb3714e2')
                : group.sibling_membership_mode === 'parliament'
                  ? translateText('generated.inline.0082_parlamentsgruppe_76cbe42e')
                  : primarySiblingMembershipMode === 'none'
                    ? translateText('generated.inline.0083_offene_geschwistergruppe_33bc5bda')
                    : translateText('generated.inline.0080_geschwistergruppe_1053d99c')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {primarySiblingMembershipMode ? (
              <BadgeControl variant="outline" size="xs" className="w-fit">
                {getCanonicalMembershipModeLabel(primarySiblingMembershipMode as any)}
              </BadgeControl>
            ) : null}
            {group.sibling_membership_mode ? (
              <div className="border-border/70 bg-background/80 rounded-lg border px-3 py-3 shadow-sm">
                <SiblingMembershipModeDescription
                  siblingMembershipMode={group.sibling_membership_mode}
                  currentGroupName={group.name ?? ''}
                  selectedGroupName={connectedGroup.name ?? ''}
                  currentGroupId={groupId}
                  selectedGroupId={String(connectedGroup.id)}
                />
              </div>
            ) : null}
            <GroupTimelineCard
              group={{
                id: String(connectedGroup.id),
                name: connectedGroup.name || t('common.unspecified'),
                description: toPlainDescription(connectedGroup.description),
                memberCount: connectedGroup.member_count || 0,
                amendmentCount: connectedGroup.amendment_count || 0,
                eventCount: connectedGroup.event_count || 0,
              }}
            />
          </CardContent>
        </Card>
      ) : null}

      {parliamentSourceGroups.length > 0 ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>
              {translateText('generated.inline.0548_parlamentsquellen_eefe6cad')}
            </CardTitle>
            <CardDescription>
              {translateText(
                'generated.inline.0549_diese_gruppen_speisen_die_mitglieder_dieser_p_6bf90be9'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {parliamentSourceGroups.map(sourceGroup => (
                <GroupTimelineCard
                  key={`source-${sourceGroup.id}`}
                  group={{
                    id: String(sourceGroup.id),
                    name: sourceGroup.name || t('common.unspecified'),
                    description: toPlainDescription(sourceGroup.description),
                    memberCount: sourceGroup.member_count || 0,
                    amendmentCount: sourceGroup.amendment_count || 0,
                    eventCount: sourceGroup.event_count || 0,
                  }}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {siblingGroups.length > 0 ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Network className="h-5 w-5" />
              {translateText('generated.inline.0550_geschwistergruppen_69f740ec')}
            </CardTitle>
            <CardDescription>
              {translateText(
                'generated.inline.0551_direkt_verbundene_geschwistergruppen_dieser_g_405521f2'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {siblingGroups.map(siblingGroup => (
                <GroupTimelineCard
                  key={`sibling-${siblingGroup.id}`}
                  group={{
                    id: String(siblingGroup.id),
                    name: siblingGroup.name || t('common.unspecified'),
                    description: toPlainDescription(siblingGroup.description),
                    memberCount: siblingGroup.member_count || 0,
                    amendmentCount: siblingGroup.amendment_count || 0,
                    eventCount: siblingGroup.event_count || 0,
                  }}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <RelatedGroupsTabs parentGroups={parentGroups} childGroups={childGroups} />

      {/* Blogs Section */}
      {group.blogs && group.blogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              {translateText('generated.inline.0552_blog_posts_9a088442')}
            </CardTitle>
            <CardDescription>
              {translateText('generated.inline.0553_recent_posts_from_this_group_fb8d3df3')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {group.blogs.map((blog: any) => (
                <BlogTimelineCard
                  key={blog.id}
                  blog={{
                    id: String(blog.id),
                    title: blog.title ?? '',
                    excerpt: blog.description ?? undefined,
                    coverImageUrl: blog.image_url ?? undefined,
                    commentCount: blog.comment_count,
                    hashtags: extractHashtags(blog.blog_hashtags),
                    authorName: group.name ?? undefined,
                    groupId: group.id,
                    publishedAt: blog.date ?? undefined,
                  }}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
