'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Badge } from '@/features/shared/ui/ui/badge';
import { getEntityGradient, getEntityIcon } from '@/features/shared/logic/entityCardHelpers';
import {
  TYPEAHEAD_ENTITY_LABELS,
  type TypeaheadItem,
} from '@/features/shared/logic/typeaheadHelpers';
import { ENTITY_COLORS } from '@/features/shared/utils/entity-colors';
import { getEntityToneClasses, type EntityTone } from '@/features/shared/theme';
import { cn } from '@/features/shared/utils/utils';
import { Hash, X } from 'lucide-react';
import { getHashtagGradient } from '@/features/shared/logic/hashtagHelpers';
import { LinkSurface } from '@/features/shared/ui/navigation/LinkSurface.tsx';
import { isPlainLeftClick } from '@/features/shared/ui/navigation/SmartLink.tsx';

interface TypeaheadSelectedCardProps {
  item: TypeaheadItem;
  variant: 'compact' | 'stacked';
  onRemove: () => void;
  className?: string;
  onClick?: (event: React.MouseEvent) => void;
}

export function TypeaheadSelectedCard({
  item,
  variant,
  onRemove,
  className,
  onClick,
}: TypeaheadSelectedCardProps) {
  const Icon = getEntityIcon(item.entityType);
  const colors = ENTITY_COLORS[item.entityType as keyof typeof ENTITY_COLORS];
  const toneClasses = getEntityToneClasses(item.entityType as EntityTone);
  const isCompact = variant === 'compact';
  const detailMetadata = item.metadata?.filter(Boolean).slice(0, isCompact ? 1 : 3) ?? [];
  const detailHashtags = item.hashtags?.slice(0, isCompact ? 1 : 3) ?? [];

  const handleContainerClick = (event: React.MouseEvent) => {
    if (onClick && isPlainLeftClick(event)) {
      event.preventDefault();
      onClick(event);
    }
  };

  const content = (
    <div className="flex items-start gap-3">
      <Avatar className={cn('shrink-0 ring-1 ring-white/60', isCompact ? 'h-8 w-8' : 'h-10 w-10')}>
        <AvatarImage src={item.avatar ?? undefined} />
        <AvatarFallback className={cn('text-xs', colors?.badgeBg)}>
          <Icon className={cn(isCompact ? 'h-4 w-4' : 'h-5 w-5')} />
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn('truncate font-medium', isCompact ? 'text-sm' : 'text-base')}>
                {item.label}
              </span>
              <Badge variant="outline" className={cn('text-[10px]', toneClasses.badge)}>
                {TYPEAHEAD_ENTITY_LABELS[item.entityType]}
              </Badge>
            </div>
            {item.secondaryLabel ? (
              <p className="text-muted-foreground mt-0.5 truncate text-xs">{item.secondaryLabel}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              onRemove();
            }}
            className="hover:bg-destructive/10 hover:text-destructive relative z-10 rounded-full p-1.5 transition-colors"
            aria-label={`Remove ${item.label}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!isCompact && item.description ? (
          <p className="text-muted-foreground mt-2 line-clamp-2 text-sm">{item.description}</p>
        ) : null}

        {!isCompact && (detailMetadata.length > 0 || detailHashtags.length > 0) ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {detailMetadata.map(metadata => (
              <Badge key={metadata} variant="secondary" className="bg-white/70 text-[11px]">
                {metadata}
              </Badge>
            ))}
            {detailHashtags.map(tag => (
              <Badge
                key={tag}
                variant="secondary"
                className={cn('text-[11px]', getHashtagGradient(tag))}
              >
                <Hash className="mr-1 h-2.5 w-2.5" />
                {tag}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );

  const surfaceClassName = cn(
    'relative block overflow-hidden rounded-xl border shadow-sm transition-[color,background-color,border-color,box-shadow,transform] duration-[var(--motion-duration-base)]',
    item.url && 'civic-motion-hover-lift civic-motion-press hover:border-foreground/20',
    getEntityGradient(item.entityType as keyof typeof ENTITY_COLORS),
    isCompact ? 'px-3 py-2' : 'px-4 py-3',
    className
  );

  if (item.url) {
    return (
      <LinkSurface
        href={item.url}
        mode="overlay"
        resetScroll={false}
        data-slot="typeahead-selected"
        label={item.label}
        containerClassName={surfaceClassName}
        onClick={handleContainerClick}
      >
        {content}
      </LinkSurface>
    );
  }

  return (
    <div data-slot="typeahead-selected" onClick={handleContainerClick} className={surfaceClassName}>
      {content}
    </div>
  );
}
