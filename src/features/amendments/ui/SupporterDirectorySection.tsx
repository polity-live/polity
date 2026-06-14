'use client';

import { useMemo, useState } from 'react';
import { ArrowUpRight, MapPinned } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import type {
  SupporterDirectoryItem,
  SupporterMapItem,
} from '@/features/amendments/logic/supporterDirectory';
import { cn } from '@/features/shared/utils/utils';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { SupporterDirectoryDetails } from '@/features/amendments/ui/SupporterDirectoryDetails';
import { SupporterLocalityMap } from '@/features/amendments/ui/SupporterLocalityMap';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface SupporterDirectorySectionProps {
  items: readonly SupporterDirectoryItem[];
  mapItems: readonly SupporterMapItem[];
}

function compareByName(left: SupporterDirectoryItem, right: SupporterDirectoryItem) {
  return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
}

export function SupporterDirectorySection({ items, mapItems }: SupporterDirectorySectionProps) {
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

  if (sortedItems.length === 0) {
    return null;
  }

  return (
    <Card className="mb-6" data-testid="supporter-directory-section">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPinned className="h-5 w-5" />
          {translateText('generated.inline.0172_supporter_map_ff6c30be')}
        </CardTitle>
        <CardDescription>
          {translateText(
            'generated.inline.0173_alphabetical_supporter_directory_with_a_share_2f823644'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <div className="space-y-2">
          {sortedItems.map(item => (
            <button
              key={item.groupId}
              type="button"
              data-testid={`supporter-directory-item-${item.groupId}`}
              className={cn(
                'hover:border-primary/40 hover:bg-muted/40 w-full rounded-xl border p-3 text-left transition-colors',
                activeGroupId === item.groupId && 'border-primary bg-primary/5 shadow-sm'
              )}
              onClick={() => handleSelect(item.groupId)}
              onMouseEnter={() => setActiveGroupId(item.groupId)}
              onMouseLeave={() =>
                setActiveGroupId(currentGroupId =>
                  currentGroupId === item.groupId ? null : currentGroupId
                )
              }
              onFocus={() => setActiveGroupId(item.groupId)}
              onBlur={() =>
                setActiveGroupId(currentGroupId =>
                  currentGroupId === item.groupId ? null : currentGroupId
                )
              }
            >
              <div className="flex items-start justify-between gap-3">
                <SupporterDirectoryDetails item={item} />
                <ArrowUpRight className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
              </div>
            </button>
          ))}
        </div>

        {sortedMapItems.length > 0 ? (
          <SupporterLocalityMap
            items={sortedMapItems}
            activeGroupId={activeGroupId}
            onHoverChange={setActiveGroupId}
            onSelect={handleSelect}
          />
        ) : (
          <div className="bg-muted/20 text-muted-foreground flex min-h-80 items-center justify-center rounded-xl border border-dashed px-4 text-center text-sm">
            {translateText(
              'generated.inline.0174_no_supporter_groups_have_map_coordinates_yet_cf4e5eda'
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
