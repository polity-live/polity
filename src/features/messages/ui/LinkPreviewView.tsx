import type { ReactNode } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar.tsx';
import { Card, CardContent } from '@/features/shared/ui/ui/card.tsx';
import { BadgeControl } from '@/features/shared/ui/status';
import { SmartLink } from '@/features/shared/ui/navigation/SmartLink.tsx';
import { cn } from '@/features/shared/utils/utils';

interface LinkPreviewAvatar {
  src?: string;
  fallback: string;
}

interface LinkPreviewCardViewProps {
  href: string;
  target?: string;
  rel?: string;
  className?: string;
  accentClassName?: string;
  icon: ReactNode;
  iconContainerClassName?: string;
  avatar?: LinkPreviewAvatar;
  title: ReactNode;
  titleClassName?: string;
  subtitle?: ReactNode;
  subtitleClassName?: string;
  description?: ReactNode;
  descriptionClassName?: string;
  meta?: ReactNode;
  badgeLabel?: ReactNode;
}

export function LinkPreviewCardView({
  href,
  target,
  rel,
  className,
  accentClassName,
  icon,
  iconContainerClassName,
  avatar,
  title,
  titleClassName,
  subtitle,
  subtitleClassName,
  description,
  descriptionClassName,
  meta,
  badgeLabel,
}: LinkPreviewCardViewProps) {
  return (
    <Card asChild className={cn('hover:bg-accent', accentClassName, className)}>
      <SmartLink href={href} target={target} rel={rel}>
        <CardContent className="flex items-center gap-3 p-3">
          <div className={cn('flex-shrink-0', iconContainerClassName)}>{icon}</div>
          {avatar ? (
            <Avatar className="h-10 w-10 flex-shrink-0">
              <AvatarImage src={avatar.src} />
              <AvatarFallback>{avatar.fallback}</AvatarFallback>
            </Avatar>
          ) : null}
          <div className="min-w-0 flex-1">
            <p className={cn('truncate font-semibold', titleClassName)}>{title}</p>
            {subtitle ? (
              <p className={cn('text-muted-foreground truncate text-sm', subtitleClassName)}>
                {subtitle}
              </p>
            ) : null}
            {description ? (
              <p className={cn('text-muted-foreground line-clamp-1 text-xs', descriptionClassName)}>
                {description}
              </p>
            ) : null}
            {meta}
          </div>
          {badgeLabel ? (
            <BadgeControl variant="outline" className="flex-shrink-0 text-xs">
              {badgeLabel}
            </BadgeControl>
          ) : null}
        </CardContent>
      </SmartLink>
    </Card>
  );
}

export function LinkPreviewSkeleton() {
  return (
    <Card className="animate-pulse">
      <CardContent className="flex items-center gap-3 p-3">
        <div className="bg-muted h-10 w-10 flex-shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="bg-muted h-4 w-3/4 rounded" />
          <div className="bg-muted h-3 w-1/2 rounded" />
        </div>
      </CardContent>
    </Card>
  );
}
