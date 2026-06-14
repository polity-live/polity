'use client';

import { useSupporterLocalityMapController } from '@/features/amendments/hooks/useSupporterLocalityMapController';
import type { SupporterMapItem } from '@/features/amendments/logic/supporterDirectory';
import { SupporterLocalityMapView } from './SupporterLocalityMapView';

interface SupporterLocalityMapProps {
  items: readonly SupporterMapItem[];
  activeGroupId?: string | null;
  onHoverChange?: (groupId: string | null) => void;
  onSelect?: (groupId: string) => void;
}

export function SupporterLocalityMap(props: SupporterLocalityMapProps) {
  return (
    <SupporterLocalityMapView {...props} {...useSupporterLocalityMapController(props.items)} />
  );
}
