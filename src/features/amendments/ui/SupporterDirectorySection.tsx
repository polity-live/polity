'use client';

import type {
  SupporterDirectoryItem,
  SupporterMapItem,
} from '@/features/amendments/logic/supporterDirectory';
import { useSupporterDirectorySectionModel } from '@/features/amendments/hooks/useSupporterDirectorySectionModel';

interface SupporterDirectorySectionProps {
  items: readonly SupporterDirectoryItem[];
  mapItems: readonly SupporterMapItem[];
}
import { SupporterDirectorySectionView } from './SupporterDirectorySectionView';
export function SupporterDirectorySection({ items, mapItems }: SupporterDirectorySectionProps) {
  const {
    activeGroupId,
    onActiveGroupChange,
    onClearActiveGroup,
    onSelect,
    sortedItems,
    sortedMapItems,
  } = useSupporterDirectorySectionModel({ items, mapItems });
  return (
    <SupporterDirectorySectionView
      items={items}
      mapItems={mapItems}
      activeGroupId={activeGroupId}
      onActiveGroupChange={onActiveGroupChange}
      onClearActiveGroup={onClearActiveGroup}
      onSelect={onSelect}
      sortedItems={sortedItems}
      sortedMapItems={sortedMapItems}
    />
  );
}
