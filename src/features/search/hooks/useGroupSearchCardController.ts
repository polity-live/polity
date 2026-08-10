import { richTextToPlainText } from '@/features/shared/logic/richText';
import { getPrimaryMembershipRole } from '@/features/shared/logic/membershipRoleHelpers';
import { useAuth } from '@/providers/auth-provider';
import { extractHashtags } from '@/zero/common/hashtagHelpers';
import { type SearchGroup } from '../types/search.types';

interface BasicGroupData {
  id: string;
  name?: string | null;
  description?: unknown;
  member_count?: number | null;
  event_count?: number | null;
  amendment_count?: number | null;
}

interface UseGroupSearchCardControllerOptions {
  group: SearchGroup | BasicGroupData;
}

const isSearchGroup = (group: SearchGroup | BasicGroupData): group is SearchGroup =>
  'memberships' in group && Array.isArray(group.memberships);

export function useGroupSearchCardController({ group }: UseGroupSearchCardControllerOptions) {
  const { user } = useAuth();

  if (isSearchGroup(group)) {
    const userMembership = user?.id
      ? group.memberships.find(m => m.user?.id === user.id)
      : undefined;
    const role =
      getPrimaryMembershipRole(userMembership)?.name || (userMembership ? 'Member' : 'Visitor');
    const memberCount = group.member_count ?? group.memberships.length;
    const description = richTextToPlainText(group.description);

    return {
      group: {
        id: String(group.id),
        name: group.name ?? '',
        description: description || undefined,
        memberCount,
        eventCount: group.events?.length || 0,
        amendmentCount: group.amendments?.length || 0,
        hashtags: extractHashtags(group.group_hashtags),
        membershipStatus:
          (userMembership?.status as
            'active' | 'admin' | 'invited' | 'requested' | 'member' | null | undefined) ||
          (role === 'Visitor' ? null : 'member'),
      },
    };
  }

  const description = richTextToPlainText(group.description);

  return {
    group: {
      id: String(group.id),
      name: group.name ?? '',
      description: description || undefined,
      memberCount: group.member_count ?? 0,
      eventCount: group.event_count ?? 0,
      amendmentCount: group.amendment_count ?? 0,
    },
  };
}
