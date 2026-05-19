'use client';

import type { TypeaheadItem, EntityType } from '@/features/shared/logic/typeaheadHelpers';
import { groupResultsByType } from '@/features/shared/logic/typeaheadHelpers';
import { TypeaheadResultCard } from './TypeaheadResultCard';
import { getEntityIcon } from '@/features/shared/logic/entityCardHelpers';
import { cn } from '@/features/shared/utils/utils';
import { useMemo } from 'react';

const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  user: 'Users',
  group: 'Groups',
  amendment: 'Amendments',
  event: 'Events',
  election: 'Elections',
  role: 'Roles',
};

interface TypeaheadDropdownProps {
  results: TypeaheadItem[];
  query: string;
  selectedIndex: number;
  onSelect: (item: TypeaheadItem) => void;
  onHoverIndex: (index: number) => void;
  isLoading?: boolean;
  className?: string;
}

export function TypeaheadDropdown({
  results,
  query,
  selectedIndex,
  onSelect,
  onHoverIndex,
  isLoading,
  className,
}: TypeaheadDropdownProps) {
  const grouped = useMemo(() => groupResultsByType(results), [results]);
  const typeOrder: EntityType[] = ['user', 'group', 'amendment', 'event', 'election', 'role'];

  if (isLoading) {
    return (
      <div
        className={cn(
          'bg-popover text-muted-foreground rounded-md border p-4 text-center text-sm shadow-lg',
          className
        )}
      >
        Loading...
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div
        className={cn(
          'bg-popover text-muted-foreground rounded-md border p-4 text-center text-sm shadow-lg',
          className
        )}
      >
        No results found
      </div>
    );
  }

  let flatIndex = 0;

  return (
    <div
      className={cn('bg-popover max-h-80 overflow-y-auto rounded-md border shadow-lg', className)}
    >
      {typeOrder.map(type => {
        const items = grouped[type];
        if (!items || items.length === 0) return null;
        const Icon = getEntityIcon(type);

        return (
          <div key={type}>
            <div className="bg-popover/95 sticky top-0 z-10 flex items-center gap-2 border-b px-3 py-1.5 backdrop-blur">
              <Icon className="text-muted-foreground h-3.5 w-3.5" />
              <span className="text-muted-foreground text-xs font-semibold uppercase">
                {ENTITY_TYPE_LABELS[type]}
              </span>
            </div>
            <div className="p-1">
              {items.map(item => {
                const currentIndex = flatIndex++;
                return (
                  <TypeaheadResultCard
                    key={item.id}
                    item={item}
                    query={query}
                    isSelected={currentIndex === selectedIndex}
                    onClick={() => onSelect(item)}
                    onMouseEnter={() => onHoverIndex(currentIndex)}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
