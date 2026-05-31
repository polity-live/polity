'use client';

import { UserNetworkFlow } from '@/features/network/ui/UserNetworkFlow';
import type { NetworkGroupEntity } from '../types/network.types';

interface FilteredNetworkFlowProps {
  userId: string;
  filterRight?: string; // Filter by specific right type (e.g., 'amendmentRight')
  onGroupClick?: (groupId: string, groupData: NetworkGroupEntity) => void;
  title?: string;
  description?: string;
}

export function FilteredNetworkFlow({
  userId,
  filterRight,
  onGroupClick,
  title = 'Network',
  description,
}: FilteredNetworkFlowProps) {
  return (
    <UserNetworkFlow
      userId={userId}
      filterRight={filterRight}
      onGroupClick={onGroupClick}
      title={title}
      description={description ?? ''}
    />
  );
}
