'use client';

import { Hash } from 'lucide-react';
import { Badge } from '@/features/shared/ui/ui/badge.tsx';
import { SmartLink } from '@/features/shared/ui/navigation/SmartLink.tsx';
import { cn } from '@/features/shared/utils/utils.ts';
import { getHashtagGradient } from '@/features/shared/logic/hashtagHelpers';

interface HashtagDisplayProps {
  hashtags: { id: string; tag: string }[];
  title?: string;
  clickable?: boolean;
  centered?: boolean;
  className?: string;
  badgeClassName?: string;
}

export function HashtagDisplay({
  hashtags,
  title = '',
  clickable = true,
  centered = false,
  className,
  badgeClassName,
}: HashtagDisplayProps) {
  if (!hashtags || hashtags.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-2', centered ? 'flex flex-col items-center' : '', className)}>
      {title && <h3 className="text-muted-foreground text-sm font-semibold">{title}</h3>}
      <div className={cn('flex flex-wrap gap-2', centered ? 'justify-center' : 'justify-start')}>
        {hashtags.map(({ id, tag }) =>
          clickable ? (
            <Badge
              key={id}
              variant="secondary"
              className={cn('hover:opacity-85', getHashtagGradient(tag), badgeClassName)}
              asChild
            >
              <SmartLink href={`/search?hashtag=${encodeURIComponent(tag)}`}>
                <Hash className="mr-1 h-3 w-3" />
                {tag}
              </SmartLink>
            </Badge>
          ) : (
            <Badge
              key={id}
              variant="secondary"
              className={cn(getHashtagGradient(tag), badgeClassName)}
            >
              <Hash className="mr-1 h-3 w-3" />
              {tag}
            </Badge>
          )
        )}
      </div>
    </div>
  );
}
