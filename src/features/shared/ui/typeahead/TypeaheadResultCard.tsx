'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Badge } from '@/features/shared/ui/ui/badge';
import { getEntityIcon } from '@/features/shared/logic/entityCardHelpers';
import {
  getTypeaheadEntityLabel,
  highlightMatch,
  type TypeaheadItem,
} from '@/features/shared/logic/typeaheadHelpers';
import {
  getEntityToneClasses,
  isPrimaryEntityTone,
  type EntityTone,
} from '@/features/shared/theme';
import { cn } from '@/features/shared/utils/utils';
import { getHashtagGradient } from '@/features/shared/logic/hashtagHelpers';
import { Hash } from 'lucide-react';

interface TypeaheadResultCardProps {
  item: TypeaheadItem;
  query: string;
  isSelected?: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  const ranges = highlightMatch(text, query);
  if (ranges.length === 0) return <>{text}</>;

  const parts: React.ReactNode[] = [];
  let lastEnd = 0;
  for (const range of ranges) {
    if (range.start > lastEnd) {
      parts.push(text.slice(lastEnd, range.start));
    }
    parts.push(
      <span key={range.start} className="text-foreground font-semibold">
        {text.slice(range.start, range.end)}
      </span>
    );
    lastEnd = range.end;
  }
  if (lastEnd < text.length) {
    parts.push(text.slice(lastEnd));
  }
  return <>{parts}</>;
}

export function TypeaheadResultCard({
  item,
  query,
  isSelected = false,
  onClick,
  onMouseEnter,
}: TypeaheadResultCardProps) {
  const Icon = getEntityIcon(item.entityType);
  const entityType = item.entityType as EntityTone;
  const toneClasses = getEntityToneClasses(entityType);
  const primaryToneClasses = isPrimaryEntityTone(entityType)
    ? getEntityToneClasses(entityType)
    : null;
  const selectedSurfaceClassName = primaryToneClasses?.softSurface ?? toneClasses.surface;
  const entityIconClassName = primaryToneClasses?.base ?? toneClasses.text;

  const handleMouseDown = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-start gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left transition-[color,background-color,border-color,box-shadow,transform] duration-[var(--motion-duration-fast)]',
        isSelected
          ? cn('translate-x-0.5 shadow-sm', selectedSurfaceClassName)
          : toneClasses.typeaheadRow
      )}
      onMouseDown={handleMouseDown}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      data-typeahead-result={item.label}
      data-typeahead-entity-type={item.entityType}
      data-typeahead-entity-id={item.id}
    >
      <Avatar className="mt-0.5 h-8 w-8 shrink-0">
        <AvatarImage src={item.avatar ?? undefined} />
        <AvatarFallback className={cn('text-xs', toneClasses.badge)}>
          <Icon data-slot="typeahead-entity-icon" className={cn('h-4 w-4', entityIconClassName)} />
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium">
            <HighlightedText text={item.label} query={query} />
          </span>
          <Badge
            variant="outline"
            data-slot="typeahead-entity-badge"
            className={cn('shrink-0 text-[10px]', toneClasses.badge)}
          >
            {getTypeaheadEntityLabel(item.entityType)}
          </Badge>
        </div>

        {item.secondaryLabel ? (
          <p className="text-muted-foreground mt-0.5 truncate text-xs">
            <HighlightedText text={item.secondaryLabel} query={query} />
          </p>
        ) : null}

        {item.description ? (
          <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-relaxed">
            <HighlightedText text={item.description} query={query} />
          </p>
        ) : null}

        {item.metadata?.length || item.hashtags?.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {item.metadata?.slice(0, 2).map(metadata => (
              <Badge
                key={metadata}
                variant="secondary"
                data-slot="typeahead-metadata-badge"
                className={cn('h-5 px-1.5 text-[10px]', toneClasses.tableTag)}
              >
                {metadata}
              </Badge>
            ))}
            {item.hashtags?.slice(0, 2).map(tag => (
              <Badge
                key={tag}
                variant="secondary"
                className={cn('h-5 px-1.5 text-[10px]', getHashtagGradient(tag))}
              >
                <Hash className="mr-0.5 h-2.5 w-2.5" />
                {tag}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
    </button>
  );
}
