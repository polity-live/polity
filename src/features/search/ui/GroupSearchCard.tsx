import React from 'react';
import { richTextToPlainText } from '@/features/shared/logic/richText';
import { getPrimaryMembershipRole } from '@/features/shared/logic/membershipRoleHelpers';
import { GroupTimelineCard } from '@/features/timeline/ui/cards/GroupTimelineCard';
import { extractHashtags } from '@/zero/common/hashtagHelpers';
import { useAuth } from '@/providers/auth-provider';

import { type SearchGroup } from '../types/search.types';

interface BasicGroupData {
  id: string;
  name?: string | null;
  description?: unknown;
  member_count?: number | null;
  event_count?: number | null;
  amendment_count?: number | null;
}

interface GroupSearchCardProps {
  group: SearchGroup | BasicGroupData;
}

export function GroupSearchCard({ group }: GroupSearchCardProps) {
  const { user } = useAuth();

  // Type guard: check if this is a full SearchGroup from Zero queries
  const isSearchGroup = (g: SearchGroup | BasicGroupData): g is SearchGroup =>
    'memberships' in g && Array.isArray(g.memberships);

  if (isSearchGroup(group)) {
    // Find current user's membership to get their actual role
    const userMembership = group.memberships?.find(m => m.user?.id === user?.id);
    const role =
      getPrimaryMembershipRole(userMembership)?.name || (userMembership ? 'Member' : 'Visitor');
    const memberCount = group.member_count ?? group.memberships?.length ?? 0;
    const description = richTextToPlainText(group.description);

    return (
      <GroupTimelineCard
        group={{
          id: String(group.id),
          name: group.name ?? '',
          description: description || undefined,
          memberCount,
          eventCount: group.events?.length || 0,
          amendmentCount: group.amendments?.length || 0,
          hashtags: extractHashtags(group.group_hashtags),
          membershipStatus:
            (userMembership?.status as
              | 'active'
              | 'admin'
              | 'invited'
              | 'requested'
              | 'member'
              | null
              | undefined) || (role === 'Visitor' ? null : 'member'),
        }}
      />
    );
  }

  // Fallback for NetworkGroupEntity or other basic group data
  const description = richTextToPlainText(group.description);

  return (
    <GroupTimelineCard
      group={{
        id: String(group.id ?? ''),
        name: group.name ?? '',
        description: description || undefined,
        memberCount: group.member_count ?? 0,
        eventCount: group.event_count ?? 0,
        amendmentCount: group.amendment_count ?? 0,
      }}
    />
  );
}
