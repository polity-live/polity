'use client';

import { featureThemeClassName } from '@/features/shared/theme';
import { BadgeControl } from '@/features/shared/ui/status';
import { format, isToday, isTomorrow } from 'date-fns';
import { Clock, ExternalLink, MapPin, Trash2, Users, Video } from 'lucide-react';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Button } from '@/features/shared/ui/ui/button';
import { cn } from '@/features/shared/utils/utils';
import {
  TimelineCardBase,
  TimelineCardHeader,
  TimelineCardContent,
  TimelineCardActions,
  TimelineCardBadge,
} from './TimelineCardBase';

type MeetupDate = string | number | Date;

export interface MeetupTimelineCardProps {
  meetup: {
    id: string;
    title: string;
    description?: string | null;
    startDate: MeetupDate;
    endDate?: MeetupDate;
    meetingType?: string | null;
    organizerName?: string;
    location?: string | null;
    onlineUrl?: string | null;
    bookingCount?: number;
    maxBookings?: number | null;
    isBookedByMe?: boolean;
    isOwner?: boolean;
    isBookable?: boolean;
    isRecurringInstance?: boolean;
    participants?: {
      id: string;
      name?: string | null;
      avatar?: string | null;
    }[];
  };
  href?: string;
  onSelect?: () => void;
  onBook?: () => void;
  onCancel?: () => void;
  onDelete?: () => void;
  className?: string;
}

function getDateLabel(date: Date): string | null {
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  return null;
}

function getMeetupState(startDate: Date, endDate: Date): 'live' | 'upcoming' | 'past' {
  const now = Date.now();

  if (endDate.getTime() < now) {
    return 'past';
  }

  if (startDate.getTime() <= now && endDate.getTime() >= now) {
    return 'live';
  }

  return 'upcoming';
}

function getStateClassName(options: {
  isPast: boolean;
  isBookedByMe: boolean;
  isBookable: boolean;
  isFull: boolean;
}) {
  if (options.isBookedByMe) {
    return featureThemeClassName('meetMeetingCalendarViewsSuccessBorder');
  }

  if (options.isBookable && !options.isFull && !options.isPast) {
    return featureThemeClassName('meetMeetingCalendarViewsInfoBorder');
  }

  if (options.isPast) {
    return 'opacity-70';
  }

  return undefined;
}

export function MeetupTimelineCard({
  meetup,
  href,
  onSelect,
  onBook,
  onCancel,
  onDelete,
  className,
}: MeetupTimelineCardProps) {
  const { t } = useTranslation();

  const startDate = new Date(meetup.startDate);
  const endDate = meetup.endDate ? new Date(meetup.endDate) : startDate;
  const bookingCount = meetup.bookingCount ?? meetup.participants?.length ?? 0;
  const maxBookings = Math.max(1, meetup.maxBookings ?? 1);
  const state = getMeetupState(startDate, endDate);
  const isPast = state === 'past';
  const isFull = bookingCount >= maxBookings;
  const isBookedByMe = Boolean(meetup.isBookedByMe);
  const isOwner = Boolean(meetup.isOwner);
  const isBookable = Boolean(meetup.isBookable);
  const canBook = Boolean(onBook) && !isOwner && isBookable && !isBookedByMe && !isFull && !isPast;
  const canCancel = Boolean(onCancel) && !isOwner && isBookedByMe && !isPast;
  const canDelete = Boolean(onDelete) && isOwner && !isPast && !meetup.isRecurringInstance;
  const dateLabel = getDateLabel(startDate);
  const participantLabel =
    bookingCount === 1
      ? t('features.calendar.eventCard.participant', { count: bookingCount })
      : t('features.calendar.eventCard.participantPlural', { count: bookingCount });
  const meetingTypeLabel =
    meetup.meetingType === 'public-meeting'
      ? t('features.calendar.eventCard.publicMeeting')
      : t('features.calendar.eventCard.privateMeeting');
  const participants = meetup.participants ?? [];

  return (
    <TimelineCardBase
      contentType="meetup"
      className={cn(
        getStateClassName({
          isPast,
          isBookedByMe,
          isBookable,
          isFull,
        }),
        className
      )}
      onClick={onSelect}
      href={href}
    >
      <TimelineCardHeader
        contentType="meetup"
        title={meetup.title || t('features.calendar.eventCard.meeting')}
        href={href}
        subtitle={meetup.organizerName}
        badge={
          state === 'live' ? (
            <BadgeControl variant="destructive" pulse>
              <span
                className={featureThemeClassName('timelineEventTimelineCardContrastPulseDot')}
              />
              {t('features.timeline.cards.happeningNow')}
            </BadgeControl>
          ) : (
            <TimelineCardBadge
              label={meetingTypeLabel}
              icon={meetup.meetingType === 'public-meeting' ? Users : Video}
            />
          )
        }
      >
        <div className="mt-3 flex justify-center">
          <div
            className={cn(
              featureThemeClassName('timelineEventTimelineCardNeutralContrastPanel'),
              isPast && 'opacity-60'
            )}
          >
            <span className="text-muted-foreground text-xs font-medium uppercase">
              {format(startDate, 'MMM').toUpperCase()}
            </span>
            <span className="text-2xl leading-none font-bold">{format(startDate, 'd')}</span>
            <span className="text-muted-foreground mt-0.5 text-xs">{format(startDate, 'p')}</span>
            {dateLabel && (
              <BadgeControl variant="secondary" size="xs" className="mt-1">
                {dateLabel}
              </BadgeControl>
            )}
          </div>
        </div>

        <div className="text-muted-foreground mt-3 space-y-1.5 text-xs">
          <div className="flex items-center justify-center gap-1.5">
            <Clock className="h-3.5 w-3.5 flex-shrink-0" />
            <span>
              {format(startDate, 'p')} - {format(endDate, 'p')}
            </span>
          </div>

          {meetup.location && (
            <div className="flex items-center justify-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{meetup.location}</span>
            </div>
          )}

          {meetup.onlineUrl && (
            <div className="flex items-center justify-center gap-1.5">
              <Video className="h-3.5 w-3.5 flex-shrink-0" />
              <span>
                {translateText('generated.inline.1160_online_meeting_available_b96908b1')}
              </span>
            </div>
          )}
        </div>
      </TimelineCardHeader>

      <TimelineCardContent>
        {meetup.description && (
          <p className="text-muted-foreground mb-3 line-clamp-2 text-sm">{meetup.description}</p>
        )}

        <div className="mb-3 flex flex-wrap gap-2">
          {isOwner && (
            <BadgeControl variant="secondary">
              {t('features.calendar.eventCard.yourMeeting')}
            </BadgeControl>
          )}
          {!isOwner && isBookedByMe && (
            <BadgeControl tone="successTint">{t('features.calendar.meeting.booked')}</BadgeControl>
          )}
          {!isBookedByMe && isFull && (
            <BadgeControl variant="outline">
              {t('features.calendar.meeting.fullyBooked')}
            </BadgeControl>
          )}
          {!isBookedByMe && !isFull && !isPast && isBookable && (
            <BadgeControl variant="outline" borderStyle="dashed">
              {t('features.calendar.meeting.available')}
            </BadgeControl>
          )}
          {isPast && (
            <BadgeControl variant="secondary">
              {translateText('generated.inline.1161_past_405c12fb')}
            </BadgeControl>
          )}
        </div>

        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Users className="h-4 w-4" />
          <span>
            {participantLabel}
            {maxBookings > 1 ? ` / ${maxBookings}` : ''}
          </span>
        </div>

        {participants.length > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <div className="flex -space-x-2">
              {participants.slice(0, 5).map(participant => (
                <Avatar key={participant.id} className="border-background h-7 w-7 border-2">
                  <AvatarImage src={participant.avatar ?? undefined} />
                  <AvatarFallback className="text-xs">
                    {participant.name?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
          </div>
        )}

        {meetup.onlineUrl && (
          <div className="mt-3">
            <a
              href={meetup.onlineUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary inline-flex items-center gap-1.5 text-sm underline-offset-4 hover:underline"
              onClick={event => event.stopPropagation()}
            >
              <Video className="h-4 w-4" />
              {translateText('generated.inline.1162_open_online_meeting_link_ec74dc3b')}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        )}
      </TimelineCardContent>

      {(canBook || canCancel || canDelete) && (
        <TimelineCardActions>
          {canBook && (
            <Button size="sm" onClick={onBook}>
              {translateText('generated.inline.1163_book_meeting_1b8711e4')}
            </Button>
          )}
          {canCancel && (
            <Button size="sm" variant="outline" onClick={onCancel}>
              {translateText('generated.inline.1164_cancel_booking_c6085eb5')}
            </Button>
          )}
          {canDelete && (
            <Button size="sm" variant="ghost" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </TimelineCardActions>
      )}
    </TimelineCardBase>
  );
}
