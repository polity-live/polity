import React from 'react';
import { useGroupsPage } from '@/features/groups/hooks/useGroupsPage';
import { GroupsPageView } from './GroupsPageView';
export function GroupsPage() {
  const gp = useGroupsPage();
  return <GroupsPageView gp={gp} />;
}
