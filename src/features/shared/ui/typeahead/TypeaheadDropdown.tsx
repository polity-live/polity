'use client';

import { useMemo } from 'react';
import { getEntityIcon } from '@/features/shared/logic/entityCardHelpers';
import {
  groupResultsByType,
  TYPEAHEAD_ENTITY_GROUP_LABELS,
  TYPEAHEAD_ENTITY_ORDER,
  type TypeaheadItem,
} from '@/features/shared/logic/typeaheadHelpers';
import { cn } from '@/features/shared/utils/utils';
import { TypeaheadResultCard } from './TypeaheadResultCard';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface TypeaheadDropdownProps {
  results: readonly TypeaheadItem[];
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

  if (isLoading) {
    return (
      <div
        className={cn(
          'bg-popover text-muted-foreground rounded-md border p-4 text-center text-sm shadow-lg',
          className
        )}
      >
        {translateText('generated.inline.0219_loading_b04ba49f')}
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
        {translateText('generated.inline.1125_no_results_found_658e79f9')}
      </div>
    );
  }

  let flatIndex = 0;

  return (
    <div
      className={cn('bg-popover max-h-80 overflow-y-auto rounded-md border shadow-lg', className)}
    >
      {TYPEAHEAD_ENTITY_ORDER.map(entityType => {
        const items = grouped[entityType];
        if (!items || items.length === 0) {
          return null;
        }

        const Icon = getEntityIcon(entityType);

        return (
          <div key={entityType}>
            <div className="bg-popover/95 sticky top-0 z-10 flex items-center gap-2 border-b px-3 py-1.5 backdrop-blur">
              <Icon className="text-muted-foreground h-3.5 w-3.5" />
              <span className="text-muted-foreground text-xs font-semibold uppercase">
                {TYPEAHEAD_ENTITY_GROUP_LABELS[entityType]}
              </span>
            </div>
            <div className="p-1">
              {items.map(item => {
                const currentIndex = flatIndex++;
                return (
                  <TypeaheadResultCard
                    key={`${item.entityType}:${item.id}`}
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
