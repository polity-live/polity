'use client';

import { cn } from '@/features/shared/utils/utils';
import {
  getEntityGradientClasses,
  getEntityToneClasses,
  getHashtagToneClasses,
} from '@/features/shared/theme';
import { User, Users, MapPin, Mail, Bell, Star } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/features/shared/ui/ui/tooltip';
import { ShareButton } from '@/features/shared/ui/action-buttons/ShareButton.tsx';
import { HashtagDisplay } from '@/features/shared/ui/hashtags';
import { Button } from '@/features/shared/ui/ui/button';
import {
  TimelineCardBase,
  TimelineCardHeader,
  TimelineCardContent,
  TimelineCardActions,
  TimelineCardBadge,
} from './TimelineCardBase';

export interface UserTimelineCardProps {
  user: {
    id: string;
    name: string;
    handle?: string;
    bio?: string;
    subtitle?: string;
    avatarUrl?: string;
    location?: string;
    country?: string;
    region?: string;
    post_code?: string;
    city?: string;
    street?: string;
    house_number?: string;
    groupCount?: number;
    amendmentCount?: number;
    hashtags?: { id: string; tag: string }[];
  };
  onFollow?: () => void;
  onMessage?: () => void;
  actions?: React.ReactNode;
  href?: string;
  className?: string;
}
export interface UserTimelineCardViewProps {
  user: any;
  onFollow: any;
  onMessage: any;
  actions: any;
  href: any;
  className: any;
  t: any;
  subscription: any;
  amendmentStyle: any;
  location: any;
  initials: any;
}

export function UserTimelineCardView({
  user,
  onFollow,
  onMessage,
  actions,
  href,
  className,
  t,
  subscription,
  location,
  initials,
}: UserTimelineCardViewProps) {
  const userTone = getEntityToneClasses('user');
  const hashtagTone = getHashtagToneClasses();
  const userHref = href ?? `/user/${user.id}`;

  return (
    <TimelineCardBase contentType="user" className={className} href={userHref}>
      <TimelineCardHeader
        contentType="user"
        title={user.name}
        href={userHref}
        badge={<TimelineCardBadge label={t('features.timeline.contentTypes.user')} icon={User} />}
      />

      <TimelineCardContent>
        {/* Centered avatar and handle */}
        <div className="mb-3 flex flex-col items-center gap-2 text-center">
          <Avatar className="border-background h-16 w-16 border-2 shadow-md">
            <AvatarImage src={user.avatarUrl} alt={user.name} />
            <AvatarFallback className={cn(getEntityGradientClasses('user'), userTone.text)}>
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            {user.handle && (
              <p className="text-muted-foreground truncate text-xs">@{user.handle}</p>
            )}
            {user.subtitle && (
              <p className="text-muted-foreground truncate text-xs">{user.subtitle}</p>
            )}
          </div>
        </div>

        <div className="mt-auto space-y-3">
          {/* Bio */}
          {user.bio && <p className="text-muted-foreground line-clamp-3 text-sm">{user.bio}</p>}

          {/* Hashtags */}
          {user.hashtags && user.hashtags.length > 0 && (
            <div onClick={e => e.preventDefault()}>
              <HashtagDisplay
                hashtags={user.hashtags.slice(0, 3)}
                centered={false}
                badgeClassName={hashtagTone.badge}
              />
            </div>
          )}

          {/* Meta info */}
          <div className="text-muted-foreground flex flex-wrap gap-3 text-xs">
            {location && (
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                <span>{location}</span>
              </div>
            )}
            {user.groupCount !== undefined && user.groupCount > 0 && (
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                <span>
                  {user.groupCount} {t('features.timeline.cards.groups')}
                </span>
              </div>
            )}
          </div>

          {/* Stats Bar with Tooltips */}
          <div className="text-muted-foreground flex items-center gap-4 text-xs">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex cursor-help items-center gap-1">
                  <Bell className="h-3.5 w-3.5" />
                  <span className="font-medium">{subscription.subscriberCount ?? 0}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {subscription.subscriberCount ?? 0} {t('features.timeline.cards.subscribers')}
                </p>
              </TooltipContent>
            </Tooltip>
            {user.groupCount !== undefined && user.groupCount > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex cursor-help items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    <span className="font-medium">{user.groupCount}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {user.groupCount} {t('features.timeline.cards.groups')}
                  </p>
                </TooltipContent>
              </Tooltip>
            )}
            {user.amendmentCount !== undefined && user.amendmentCount > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex cursor-help items-center gap-1">
                    <Star className="h-3.5 w-3.5" />
                    <span className="font-medium">{user.amendmentCount}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {user.amendmentCount} {t('features.timeline.contentTypes.amendment')}
                  </p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </TimelineCardContent>

      <TimelineCardActions>
        {actions ? (
          actions
        ) : (
          <>
            <Button
              variant={subscription.isSubscribed ? 'outline' : 'ghost'}
              size="sm"
              onClick={e => {
                e.preventDefault();
                subscription.toggleSubscribe();
                onFollow?.();
              }}
              disabled={subscription.isLoading}
              className="flex items-center gap-1.5"
            >
              <Bell className={cn('h-3.5 w-3.5', subscription.isSubscribed && userTone.text)} />
            </Button>
            <Button variant="outline" size="sm" asChild className="flex items-center gap-1.5">
              <Link
                to="/messages"
                search={{ userId: user.id, name: user.name }}
                onClick={e => {
                  e.stopPropagation();
                  onMessage?.();
                }}
              >
                <Mail className="h-3.5 w-3.5" />
              </Link>
            </Button>
            <div onClick={e => e.preventDefault()}>
              <ShareButton
                url={userHref}
                title={user.name}
                description={user.bio || ''}
                variant="outline"
                size="sm"
                shareContextItem={{
                  id: user.id,
                  type: 'user',
                  title: user.name,
                  description: user.bio,
                  createdAt: new Date(),
                  authorId: user.id,
                  authorName: user.name,
                  authorAvatar: user.avatarUrl,
                  handle: user.handle,
                  location,
                  groupCount: user.groupCount,
                  amendmentCount: user.amendmentCount,
                  tags: user.hashtags?.map((hashtag: any) => hashtag.tag) ?? [],
                }}
              />
            </div>
          </>
        )}
      </TimelineCardActions>
    </TimelineCardBase>
  );
}
