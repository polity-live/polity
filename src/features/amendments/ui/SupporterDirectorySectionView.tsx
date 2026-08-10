'use client';

import { ArrowUpRight, MapPinned } from 'lucide-react';
import { cn } from '@/features/shared/utils/utils';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import { SupporterDirectoryDetails } from '@/features/amendments/ui/SupporterDirectoryDetails';
import { SupporterLocalityMap } from '@/features/amendments/ui/SupporterLocalityMap';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
export interface SupporterDirectorySectionViewProps {
  items: any;
  mapItems: any;
  activeGroupId: any;
  onActiveGroupChange: any;
  onClearActiveGroup: any;
  onSelect: any;
  sortedItems: any;
  sortedMapItems: any;
}

export function SupporterDirectorySectionView({
  activeGroupId,
  onActiveGroupChange,
  onClearActiveGroup,
  onSelect,
  sortedItems,
  sortedMapItems,
}: SupporterDirectorySectionViewProps) {
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
          {sortedItems.map((item: any) => (
            <Button
              data-action-id="amendments.supporters.navigate.group"
              key={item.groupId}
              type="button"
              variant="ghost"
              data-testid={`supporter-directory-item-${item.groupId}`}
              className={cn(
                'hover:border-primary/40 hover:bg-muted/40 h-auto w-full justify-start rounded-xl border p-3 text-left whitespace-normal transition-colors',
                activeGroupId === item.groupId && 'border-primary bg-primary/5 shadow-sm'
              )}
              onClick={() => onSelect(item.groupId)}
              onMouseEnter={() => onActiveGroupChange(item.groupId)}
              onMouseLeave={() => onClearActiveGroup(item.groupId)}
              onFocus={() => onActiveGroupChange(item.groupId)}
              onBlur={() => onClearActiveGroup(item.groupId)}
            >
              <div className="flex items-start justify-between gap-3">
                <SupporterDirectoryDetails item={item} />
                <ArrowUpRight className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
              </div>
            </Button>
          ))}
        </div>

        {sortedMapItems.length > 0 ? (
          <SupporterLocalityMap
            items={sortedMapItems}
            activeGroupId={activeGroupId}
            onHoverChange={onActiveGroupChange}
            onSelect={onSelect}
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
