import React from 'react';
import { GroupsHeader } from '@/features/groups/ui/GroupsHeader';
import { GroupsFilters } from '@/features/groups/ui/GroupsFilters';
import { GroupsList } from '@/features/groups/ui/GroupsList';
export interface GroupsPageViewProps {
  gp: any;
}

export function GroupsPageView({ gp }: GroupsPageViewProps) {
  return (
    <div>
      <GroupsHeader />
      <GroupsFilters
        searchTerm={gp.searchTerm}
        setSearchTerm={gp.setSearchTerm}
        selectedTags={gp.selectedTags}
        setSelectedTags={gp.setSelectedTags}
        toggleTag={gp.toggleTag}
        allTags={gp.allTags}
        hasActiveFilters={gp.hasActiveFilters}
        clearAllFilters={gp.clearAllFilters}
      />
      <GroupsList groups={gp.filteredGroups} isLoading={gp.isLoading} />
    </div>
  );
}
