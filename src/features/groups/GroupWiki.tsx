'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { Badge } from '@/features/shared/ui/ui/badge';
import { LinkGroupDialog } from '@/features/network/ui/LinkGroupDialog';
import { BookOpen, Network } from 'lucide-react';
import { HashtagDisplay } from '@/features/shared/ui/ui/hashtag-display';
import { extractHashtags } from '@/zero/common/hashtagHelpers';
import { BlogTimelineCard } from '@/features/timeline/ui/cards/BlogTimelineCard';
import { GRADIENTS } from '@/features/users/state/gradientColors';
import { StatsBar } from '@/features/shared/ui/ui/StatsBar';
import { ActionBar } from '@/features/shared/ui/ui/ActionBar';
import { SubscribeButton, MembershipButton } from '@/features/shared/ui/action-buttons';
import { SocialBar } from '@/features/users/ui/SocialBar';
import { InfoTabs } from '@/features/shared/ui/wiki/InfoTabs.tsx';
import { GroupTimelineCard } from '@/features/timeline/ui/cards/GroupTimelineCard';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { ShareButton } from '@/features/shared/ui/action-buttons/ShareButton.tsx';
import { useGroupWikiPage } from '@/features/groups/hooks/useGroupWikiPage';
import { buildGroupWikiIncumbentSections } from '@/features/groups/logic/buildGroupWikiIncumbentSections';
import { groupRelationshipsByGroup } from '@/features/groups/logic/groupWikiHelpers';
import { AccessDenied } from '@/features/auth/ui/AccessDenied';
import { formatLocation } from '@/features/shared/logic/locationHelpers';
import { WikiIncumbentPanel } from '@/features/shared/ui/wiki/WikiIncumbentPanel';

interface GroupWikiProps {
  groupId: string;
}

export function GroupWiki({ groupId }: GroupWikiProps) {
  const { t } = useTranslation();

  const {
    group,
    canAccess,
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
    isHierarchical,
    membershipLoading,
    requestJoin,
    leaveGroup,
    acceptInvitation,
  } = useGroupWikiPage(groupId);

  if (!group) {
    return (
      <div>
        <div className="py-12 text-center">
          <h1 className="mb-4 text-2xl font-bold">Group Not Found</h1>
          <p className="text-muted-foreground">
            The group you're looking for doesn't exist or has been removed.
          </p>
        </div>
      </div>
    );
  }

  if (!canAccess) {
    return <AccessDenied />;
  }

  const groupLocation = formatLocation(group);
  const parentGroups = groupRelationshipsByGroup(group.relationships_as_target ?? [], 'parent');
  const childGroups = groupRelationshipsByGroup(group.relationships_as_source ?? [], 'child');
  const incumbentSections = buildGroupWikiIncumbentSections(
    group.roles ?? [],
    group.memberships ?? []
  );

  return (
    <div>
      {/* Header with centered title and subtitle */}
      <div className="mb-8 text-center">
        <div className="mb-2 flex items-center justify-center gap-3">
          <h1 className="text-4xl font-bold">{group.name}</h1>
          {group.visibility === 'public' && (
            <Badge variant="secondary" className="text-sm">
              {t('components.badges.public')}
            </Badge>
          )}
          <Badge variant="outline" className="text-sm">
            {isHierarchical
              ? t('components.badges.hierarchicalGroup')
              : t('components.badges.baseGroup')}
          </Badge>
        </div>
        {groupLocation && <p className="text-muted-foreground">{groupLocation}</p>}
      </div>

      {group.image_url && (
        <div className="mb-8">
          <img
            src={group.image_url}
            alt={group.name ?? 'Group'}
            className="mx-auto h-64 w-full max-w-4xl rounded-lg object-cover shadow-lg"
          />
        </div>
      )}

      {/* Stats Bar with Events and Amendments */}
      <StatsBar
        stats={[
          { value: memberCount, labelKey: 'components.labels.members' },
          { value: subscriberCount, labelKey: 'components.labels.subscribers' },
          { value: eventsCount, labelKey: 'components.labels.events' },
          { value: amendmentsCount, labelKey: 'components.labels.amendments' },
        ]}
      />

      {/* Action Bar */}
      <ActionBar>
        <LinkGroupDialog currentGroupId={groupId} currentGroupName={group.name ?? ''} />
        <SubscribeButton
          entityType="group"
          entityId={groupId}
          isSubscribed={isSubscribed}
          onToggleSubscribe={toggleSubscribe}
          isLoading={subscribeLoading}
        />
        <MembershipButton
          actionType="join"
          status={status}
          isMember={isMember}
          hasRequested={hasRequested}
          isInvited={isInvited}
          onRequest={requestJoin}
          onLeave={leaveGroup}
          onAcceptInvitation={acceptInvitation}
          isLoading={membershipLoading}
          disabled={isHierarchical && !isMember}
          disabledReason={
            isHierarchical ? t('features.groups.hierarchicalMembershipDisabled') : undefined
          }
        />
        <ShareButton
          url={`/group/${groupId}`}
          title={group.name ?? ''}
          description={group.description || ''}
          shareContextItem={{
            id: groupId,
            type: 'group',
            title: group.name ?? '',
            description: group.description,
            createdAt: new Date(),
            memberCount,
            eventCount: eventsCount,
            amendmentCount: amendmentsCount,
            stats: {
              members: memberCount,
            },
          }}
        />
      </ActionBar>

      {/* Hashtags */}
      {group.group_hashtags && group.group_hashtags.length > 0 && (
        <div className="mb-6">
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
        about={group.description ?? undefined}
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
          location: groupLocation || undefined,
        }}
        className="mb-12"
      />

      {incumbentSections.length > 0 && (
        <WikiIncumbentPanel
          title="Roles & Incumbents"
          description="Assigned and elected roles with their active incumbents in this group"
          sections={incumbentSections}
        />
      )}

      {/* Parent & Child Groups */}
      {parentGroups.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Network className="h-5 w-5" />
              {t('pages.group.parentGroups.title')}
            </CardTitle>
            <CardDescription>{t('pages.group.parentGroups.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {parentGroups.map(({ group: relatedGroup }) => (
                <GroupTimelineCard
                  key={`parent-${relatedGroup.id}`}
                  group={{
                    id: String(relatedGroup.id),
                    name: relatedGroup.name || t('common.unspecified'),
                    description: relatedGroup.description ?? undefined,
                    memberCount: relatedGroup.memberships?.length || relatedGroup.member_count || 0,
                    amendmentCount: relatedGroup.amendments?.length || 0,
                    eventCount: relatedGroup.events?.length || 0,
                  }}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {childGroups.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Network className="h-5 w-5" />
              {t('pages.group.childGroups.title')}
            </CardTitle>
            <CardDescription>{t('pages.group.childGroups.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {childGroups.map(({ group: relatedGroup }) => (
                <GroupTimelineCard
                  key={`child-${relatedGroup.id}`}
                  group={{
                    id: String(relatedGroup.id),
                    name: relatedGroup.name || t('common.unspecified'),
                    description: relatedGroup.description ?? undefined,
                    memberCount: relatedGroup.memberships?.length || relatedGroup.member_count || 0,
                    amendmentCount: relatedGroup.amendments?.length || 0,
                    eventCount: relatedGroup.events?.length || 0,
                  }}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Blogs Section */}
      {group.blogs && group.blogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Blog Posts
            </CardTitle>
            <CardDescription>Recent posts from this group</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {group.blogs.map((blog, index: number) => (
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
                  className={GRADIENTS[index % GRADIENTS.length]}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
