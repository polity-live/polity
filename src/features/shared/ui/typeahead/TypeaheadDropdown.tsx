'use client';

import { useMemo } from 'react';
import { getEntityIcon } from '@/features/shared/logic/entityCardHelpers';
import {
  getTypeaheadEntityGroupLabel,
  groupResultsByType,
  TYPEAHEAD_ENTITY_ORDER,
  type TypeaheadItem,
} from '@/features/shared/logic/typeaheadHelpers';
import { cn } from '@/features/shared/utils/utils';
import { TypeaheadResultCard } from './TypeaheadResultCard';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { SectionSkeleton } from '@/features/shared/ui/feedback';

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
          'bg-popover civic-motion-popover rounded-md border p-2 shadow-[var(--shadow-floating)]',
          className
        )}
      >
        <SectionSkeleton
          rows={3}
          density="compact"
          label={translateText('common.loading.sectionSkeleton.label')}
        />
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div
        className={cn(
          'bg-popover text-muted-foreground civic-motion-popover rounded-md border p-4 text-center text-sm shadow-[var(--shadow-floating)]',
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
      className={cn(
        'bg-popover civic-motion-popover max-h-80 overflow-y-auto rounded-md border shadow-[var(--shadow-floating)]',
        className
      )}
    >
      {TYPEAHEAD_ENTITY_ORDER.map(entityType => {
        const items = grouped[entityType];
        if (!items || items.length === 0) {
          return null;
        }

        const Icon = getEntityIcon(entityType);

        return (
          <div key={entityType}>
            <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-[var(--surface-overlay)] px-3 py-1.5 backdrop-blur">
              <Icon className="text-muted-foreground h-3.5 w-3.5" />
              <span className="text-muted-foreground text-xs font-semibold uppercase">
                {getTypeaheadEntityGroupLabel(entityType)}
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
