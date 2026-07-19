import React from 'react';
import { GroupTimelineCard } from '@/features/timeline/ui/cards/GroupTimelineCard';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { SectionSkeleton } from '@/features/shared/ui/feedback';

interface GroupDisplay {
  id: string;
  name: string;
  description?: string;
  memberCount?: number;
  eventCount?: number;
  amendmentCount?: number;
  topics?: string[];
}

interface GroupsListProps {
  groups: GroupDisplay[];
  isLoading: boolean;
}

export const GroupsList: React.FC<GroupsListProps> = ({ groups, isLoading }) => {
  const { t } = useTranslation();

  if (isLoading) {
    return <SectionSkeleton rows={6} label={t('features.groups.list.loading')} />;
  }

  if (groups.length === 0) {
    return (
      <div className="py-12 text-center">
        <div className="mb-4">
          <div className="bg-muted mx-auto flex h-16 w-16 items-center justify-center rounded-xl">
            <span className="text-2xl">🔍</span>
          </div>
        </div>
        <h3 className="text-foreground mb-2 text-lg font-medium">
          {t('features.groups.list.noGroups')}
        </h3>
        <p className="text-muted-foreground">{t('features.groups.list.noGroupsDescription')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-foreground text-lg font-semibold">
          {t('features.groups.list.groupsFound', { count: groups.length })}
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {groups.map(group => (
          <GroupTimelineCard
            key={group.id}
            group={{
              id: group.id,
              name: group.name,
              description: group.description,
              memberCount: group.memberCount,
              eventCount: group.eventCount,
              amendmentCount: group.amendmentCount,
              topics: group.topics,
            }}
          />
        ))}
      </div>
    </div>
  );
};
