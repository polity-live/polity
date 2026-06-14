'use client';

import { featureThemeClassName } from '@/features/shared/theme';
import { BadgeControl } from '@/features/shared/ui/status';
import { Calendar, MapPin, Bell } from 'lucide-react';
import { cn } from '@/features/shared/utils/utils';
import { Button } from '@/features/shared/ui/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/features/shared/ui/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/features/shared/ui/ui/tooltip';
import { ShareButton } from '@/features/shared/ui/action-buttons/ShareButton.tsx';
import { HashtagDisplay } from '@/features/shared/ui/hashtags';
import {
  TimelineCardBase,
  TimelineCardHeader,
  TimelineCardContent,
  TimelineCardActions,
  TimelineCardBadge,
} from './TimelineCardBase';

export interface EventTimelineCardProps {
  event: {
    id: string;
    title: string;
    description?: string;
    startDate: string | Date;
    endDate?: string | Date;
    location?: string;
    /** City name for display in header */
    city?: string;
    /** Postal/zip code */
    postcode?: string;
    attendeeCount?: number;
    /** User's participation status */
    participationStatus?: 'member' | 'admin' | 'confirmed' | 'invited' | 'requested' | null;
    organizerName?: string;
    /** Organizer user ID for profile linking when no group is attached */
    organizerId?: string;
    /** Group name for clickable subtitle */
    groupName?: string;
    /** Group ID for linking to group page */
    groupId?: string;
    /** Stats for elections count */
    electionsCount?: number;
    /** Stats for amendments count */
    amendmentsCount?: number;
    /** Hashtags for the event */
    hashtags?: { id: string; tag: string }[];
    /** Whether user is subscribed to this event */
    isSubscribed?: boolean;
  };
  /** Optional card destination override */
  href?: string;
  /** Optional card selection handler, used when the card should not navigate directly */
  onSelect?: () => void;
  /** Called when user requests participation */
  onRequestParticipation?: () => void;
  /** Called when user leaves event */
  onLeave?: () => void;
  /** Called when user accepts invitation */
  onAcceptInvitation?: () => void;
  /** Called when user withdraws request */
  onWithdrawRequest?: () => void;
  /** Called when user toggles subscription */
  onToggleSubscription?: () => void;
  /** Loading state for participation actions */
  isParticipationLoading?: boolean;
  /** Loading state for subscription action */
  isSubscriptionLoading?: boolean;
  className?: string;
}
export interface EventTimelineCardViewProps {
  event: any;
  href: any;
  onSelect: any;
  onRequestParticipation: any;
  onLeave: any;
  onAcceptInvitation: any;
  onWithdrawRequest: any;
  onToggleSubscription: any;
  isParticipationLoading: any;
  isSubscriptionLoading: any;
  className: any;
  t: any;
  rsvpOpen: any;
  setRsvpOpen: any;
  participation: any;
  subscription: any;
  startDate: any;
  day: any;
  month: any;
  time: any;
  eventTimeStatus: any;
  dateLabel: any;
  locationDisplay: any;
  eventStyle: any;
  eventHref: any;
  eventDescription: any;
  eventSubtitle: any;
  eventSubtitleHref: any;
  resolvedParticipationStatus: any;
  isParticipant: any;
  isInvited: any;
  hasRequested: any;
  hasParticipationRelationship: any;
  getRsvpLabel: any;
  getRsvpVariant: any;
  stats: any;
}

export function EventTimelineCardView({
  event,
  onSelect,
  onRequestParticipation,
  onLeave,
  onAcceptInvitation,
  onWithdrawRequest,
  onToggleSubscription,
  isParticipationLoading,
  isSubscriptionLoading,
  className,
  t,
  rsvpOpen,
  setRsvpOpen,
  participation,
  subscription,
  day,
  month,
  time,
  eventTimeStatus,
  dateLabel,
  locationDisplay,
  eventStyle,
  eventHref,
  eventDescription,
  eventSubtitle,
  eventSubtitleHref,
  isParticipant,
  isInvited,
  hasRequested,
  hasParticipationRelationship,
  getRsvpLabel,
  getRsvpVariant,
  stats,
}: EventTimelineCardViewProps) {
  return (
    <TimelineCardBase contentType="event" className={className} onClick={onSelect} href={eventHref}>
      <TimelineCardHeader
        contentType="event"
        title={event.title}
        href={eventHref}
        subtitle={eventSubtitle}
        subtitleHref={eventSubtitleHref}
        badge={
          eventTimeStatus === 'live' ? (
            <BadgeControl variant="destructive" pulse>
              <span
                className={featureThemeClassName('timelineEventTimelineCardContrastPulseDot')}
              />
              {t('features.timeline.cards.happeningNow')}
            </BadgeControl>
          ) : (
            <TimelineCardBadge label={t('features.timeline.contentTypes.event')} icon={Calendar} />
          )
        }
      >
        {/* Prominent Date Badge */}
        <div className="mt-3 flex justify-center">
          <div
            className={cn(
              featureThemeClassName('timelineEventTimelineCardNeutralContrastPanel'),
              eventTimeStatus === 'past' && 'opacity-60'
            )}
          >
            <span className="text-muted-foreground text-xs font-medium uppercase">{month}</span>
            <span className="text-2xl leading-none font-bold">{day}</span>
            <span className="text-muted-foreground mt-0.5 text-xs">{time}</span>
            {dateLabel && (
              <BadgeControl variant="secondary" size="xs" className="mt-1">
                {dateLabel}
              </BadgeControl>
            )}
          </div>
        </div>
        {locationDisplay && (
          <div className="text-muted-foreground mt-3 flex items-center justify-center gap-1.5 text-xs">
            <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">{locationDisplay}</span>
          </div>
        )}
      </TimelineCardHeader>

      <TimelineCardContent>
        <div className="mt-auto space-y-3">
          {eventDescription && (
            <p className="text-muted-foreground line-clamp-2 text-sm">{eventDescription}</p>
          )}

          {/* Hashtags */}
          {event.hashtags && event.hashtags.length > 0 && (
            <div onClick={e => e.preventDefault()}>
              <HashtagDisplay
                hashtags={event.hashtags.slice(0, 3)}
                centered={false}
                badgeClassName={cn(
                  featureThemeClassName('timelineEventTimelineCardNeutralContrastSurface'),
                  eventStyle.borderColor,
                  eventStyle.accentColor
                )}
              />
            </div>
          )}

          {/* Location handled in header */}

          {/* Stats Bar with Tooltips */}
          <div className="text-muted-foreground flex items-center gap-4 text-xs">
            {stats.map((stat: any, index: number) => (
              <Tooltip key={index}>
                <TooltipTrigger asChild>
                  <div className="flex cursor-help items-center gap-1">
                    <stat.icon className="h-3.5 w-3.5" />
                    <span className="font-medium">{stat.value}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {stat.value} {stat.label}
                  </p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      </TimelineCardContent>

      <TimelineCardActions>
        {/* RSVP Button with Popover */}
        <Popover open={rsvpOpen} onOpenChange={setRsvpOpen}>
          <PopoverTrigger asChild onClick={e => e.stopPropagation()}>
            <Button
              variant={getRsvpVariant()}
              size="sm"
              disabled={
                isParticipationLoading ||
                participation.isLoading ||
                (eventTimeStatus === 'past' && !hasParticipationRelationship)
              }
              className="flex items-center gap-1.5"
            >
              <span className="text-xs">{getRsvpLabel()}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="start" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col gap-1">
              {isParticipant && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={e => {
                    e.preventDefault();
                    (onLeave || participation.leaveEvent)?.();
                    setRsvpOpen(false);
                  }}
                  disabled={isParticipationLoading || participation.isLoading}
                  className="justify-start"
                >
                  {t('features.timeline.cards.event.leaveEvent')}
                </Button>
              )}
              {isInvited && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={e => {
                      e.preventDefault();
                      (onAcceptInvitation || participation.acceptInvitation)?.();
                      setRsvpOpen(false);
                    }}
                    disabled={isParticipationLoading || participation.isLoading}
                    className="justify-start"
                  >
                    {t('features.timeline.cards.event.acceptInvitation')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={e => {
                      e.preventDefault();
                      (onLeave || participation.leaveEvent)?.();
                      setRsvpOpen(false);
                    }}
                    disabled={isParticipationLoading || participation.isLoading}
                    className="text-destructive justify-start"
                  >
                    {t('features.timeline.cards.event.declineInvitation')}
                  </Button>
                </>
              )}
              {hasRequested && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={e => {
                    e.preventDefault();
                    (onWithdrawRequest || participation.leaveEvent)?.();
                    setRsvpOpen(false);
                  }}
                  disabled={isParticipationLoading || participation.isLoading}
                  className="text-destructive justify-start"
                >
                  {t('features.timeline.cards.event.withdrawRequest')}
                </Button>
              )}
              {!isParticipant && !isInvited && !hasRequested && eventTimeStatus !== 'past' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={e => {
                    e.preventDefault();
                    (onRequestParticipation || participation.requestParticipation)?.();
                    setRsvpOpen(false);
                  }}
                  disabled={isParticipationLoading || participation.isLoading}
                  className="justify-start"
                >
                  {t('features.timeline.cards.event.requestParticipation')}
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Subscribe Button */}
        <Button
          variant={(event.isSubscribed ?? subscription.isSubscribed) ? 'outline' : 'ghost'}
          size="sm"
          onClick={e => {
            e.preventDefault();
            (onToggleSubscription || subscription.toggleSubscribe)?.();
          }}
          disabled={isSubscriptionLoading || subscription.isLoading}
          className="flex items-center gap-1.5"
        >
          <Bell
            className={`h-3.5 w-3.5 ${(event.isSubscribed ?? subscription.isSubscribed) ? featureThemeClassName('timelineActionBarThemedStyle') : ''}`}
          />
        </Button>

        {/* Share Button */}
        <div onClick={e => e.preventDefault()}>
          <ShareButton
            url={`/event/${event.id}`}
            title={event.title}
            description={eventDescription || ''}
            variant="outline"
            size="sm"
            shareContextItem={{
              id: event.id,
              type: 'event',
              title: event.title,
              description: eventDescription,
              createdAt: new Date(event.startDate),
              startDate: new Date(event.startDate),
              endDate: event.endDate ? new Date(event.endDate) : undefined,
              location: event.location,
              city: event.city,
              postcode: event.postcode,
              attendeeCount: event.attendeeCount,
              electionsCount: event.electionsCount,
              amendmentsCount: event.amendmentsCount,
              tags: event.hashtags?.map((hashtag: any) => hashtag.tag) ?? [],
              groupId: event.groupId,
              groupName: event.groupName ?? event.organizerName,
              stats: {
                members: event.attendeeCount,
              },
            }}
          />
        </div>
      </TimelineCardActions>
    </TimelineCardBase>
  );
}
