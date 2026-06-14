import { useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';

import type {
  SupporterDirectoryItem,
  SupporterMapItem,
} from '@/features/amendments/logic/supporterDirectory';

interface UseSupporterDirectorySectionModelOptions {
  items: readonly SupporterDirectoryItem[];
  mapItems: readonly SupporterMapItem[];
}

function compareByName(left: SupporterDirectoryItem, right: SupporterDirectoryItem) {
  return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
}

export function useSupporterDirectorySectionModel({
  items,
  mapItems,
}: UseSupporterDirectorySectionModelOptions) {
  const navigate = useNavigate();
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  const sortedItems = useMemo(() => [...items].sort(compareByName), [items]);
  const mapItemsByGroupId = useMemo(
    () => new Map(mapItems.map(item => [item.groupId, item])),
    [mapItems]
  );
  const sortedMapItems = useMemo(
    () =>
      sortedItems.flatMap(item => {
        const mapItem = mapItemsByGroupId.get(item.groupId);
        return mapItem ? [mapItem] : [];
      }),
    [mapItemsByGroupId, sortedItems]
  );

  const handleSelect = (groupId: string) => {
    void navigate({
      to: '/group/$id',
      params: { id: groupId },
    });
  };

  const clearActiveGroup = (groupId: string) => {
    setActiveGroupId(currentGroupId => (currentGroupId === groupId ? null : currentGroupId));
  };

  return {
    activeGroupId,
    onActiveGroupChange: setActiveGroupId,
    onClearActiveGroup: clearActiveGroup,
    onSelect: handleSelect,
    sortedItems,
    sortedMapItems,
  };
}
