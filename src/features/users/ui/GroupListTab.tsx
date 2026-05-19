import React, { useMemo } from 'react';
import { getMembershipRoleNames } from '@/features/shared/logic/membershipRoleHelpers';
import { richTextToPlainText } from '@/features/shared/logic/richText';
import { Input } from '@/features/shared/ui/ui/input';
import { Search } from 'lucide-react';
import { GroupTimelineCard } from '@/features/timeline/ui/cards/GroupTimelineCard';
import { useTranslation } from '@/features/shared/hooks/use-translation';

import type { ProfileGroupMembership } from '../types/user.types';
import { matchesSearchQuery } from '../logic/userWikiSearch';

interface GroupsListTabProps {
  memberships: readonly ProfileGroupMembership[];
  searchValue: string;
  onSearchChange: (value: string) => void;
}

export const GroupsListTab: React.FC<GroupsListTabProps> = ({
  memberships,
  searchValue,
  onSearchChange,
}) => {
  const { t } = useTranslation();

  const withGroup = useMemo(
    () =>
      memberships.filter(
        (
          membership
        ): membership is ProfileGroupMembership & {
          group: NonNullable<ProfileGroupMembership['group']>;
        } => Boolean(membership.group)
      ),
    [memberships]
  );

  const filteredGroups = useMemo(() => {
    return withGroup.filter(membership =>
      matchesSearchQuery(
        searchValue,
        membership.group?.name,
        getMembershipRoleNames(membership).join(' '),
        membership.group?.description
      )
    );
  }, [withGroup, searchValue]);

  // Deduplicate by membership id
  const unique = useMemo(() => {
    const seen = new Set<string>();
    return filteredGroups.filter(m => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  }, [filteredGroups]);

  return (
    <>
      <div className="relative mb-4">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          placeholder={t('pages.user.groups.searchPlaceholder')}
          className="pl-10"
          value={searchValue}
          onChange={e => onSearchChange(e.target.value)}
        />
      </div>
      {unique.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">{t('pages.user.groups.noResults')}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {unique.map(membership => {
            const group = membership.group;
            return (
              <GroupTimelineCard
                key={membership.id}
                group={{
                  id: String(group.id),
                  name: group.name ?? '',
                  description: richTextToPlainText(group.description) || undefined,
                  memberCount: group.member_count ?? 0,
                  eventCount: group.event_count ?? group.events?.length,
                  amendmentCount: group.amendment_count ?? group.amendments?.length,
                }}
              />
            );
          })}
        </div>
      )}
    </>
  );
};
