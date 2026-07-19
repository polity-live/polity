'use client';

import { MapPin, Users } from 'lucide-react';
import type { SupporterDirectoryItem } from '@/features/amendments/logic/supporterDirectory';
import { SupporterStatusBadge } from '@/features/amendments/ui/SupporterStatusBadge';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface SupporterDirectoryDetailsProps {
  item: SupporterDirectoryItem;
}

export function SupporterDirectoryDetails({ item }: SupporterDirectoryDetailsProps) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{item.name}</span>
        <SupporterStatusBadge status={item.supportStatus} size="sm" />
      </div>
      <div className="text-muted-foreground space-y-1 text-sm">
        <div className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5" />
          <span>{item.locationLabel}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />
          <span>
            {item.memberCount}{' '}
            {translateText('components.labels.members', { count: item.memberCount })}
          </span>
        </div>
      </div>
    </div>
  );
}
