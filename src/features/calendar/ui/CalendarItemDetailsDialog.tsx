import { Link } from '@tanstack/react-router';
import { Calendar, Clock, MapPin, Users, Video } from 'lucide-react';
import { getBaseEventId } from '@/features/calendar/logic/eventIdUtils';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { Badge } from '@/features/shared/ui/ui/badge';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/features/shared/ui/ui/dialog';
import { ScrollArea } from '@/features/shared/ui/ui/scroll-area';
import type { CalendarEvent } from '../types/calendar.types';

interface CalendarItemDetailsDialogProps {
  item: CalendarEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function toLocale(language: string) {
  return language === 'de' ? 'de-DE' : 'en-US';
}

function formatDate(value: number, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function formatTime(value: number, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatTimeRange(item: CalendarEvent, locale: string) {
  const start = formatTime(item.start_date, locale);

  if (!item.end_date || item.end_date <= item.start_date) {
    return start;
  }

  return `${start} - ${formatTime(item.end_date, locale)}`;
}

export function CalendarItemDetailsDialog({
  item,
  open,
  onOpenChange,
}: CalendarItemDetailsDialogProps) {
  const { t, language } = useTranslation();

  if (!item) {
    return null;
  }

  const locale = toLocale(language);
  const eventHref = item.isMeeting ? undefined : `/event/${getBaseEventId(item.id)}`;
  const participantCount =
    item.bookingCount ?? item.attendeeCount ?? (item.max_bookings ? 0 : undefined);
  const participantLabel =
    participantCount === undefined
      ? null
      : participantCount === 1
        ? t('features.calendar.eventCard.participant', { count: participantCount })
        : t('features.calendar.eventCard.participantPlural', { count: participantCount });
  const participantValue =
    participantCount === undefined
      ? null
      : item.max_bookings && item.max_bookings > 0
        ? `${participantCount} / ${item.max_bookings}`
        : participantLabel;
  const onlineUrl = item.location_url ?? item.stream_url ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-hidden sm:max-w-xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2 pr-8">
            <Badge variant="outline">
              {item.isMeeting
                ? t('features.timeline.contentTypes.meetup')
                : t('features.timeline.contentTypes.event')}
            </Badge>
            {item.isMeeting && item.isBookedByMe && (
              <Badge className="bg-green-500/15 text-green-700 dark:text-green-400">
                {t('features.calendar.meeting.booked')}
              </Badge>
            )}
            {item.isMeeting && !item.isBookedByMe && item.is_bookable && (
              <Badge variant="secondary">{t('features.calendar.meeting.available')}</Badge>
            )}
          </div>
          <DialogTitle className="pr-8">{item.title}</DialogTitle>
          <DialogDescription>{formatDate(item.start_date, locale)}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="min-h-0 flex-1 pr-4">
          <div className="space-y-4 pb-1">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border p-3">
                <div className="text-muted-foreground mb-1 flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
                  <Calendar className="h-3.5 w-3.5" />
                  {t('features.events.detail.date')}
                </div>
                <p className="text-sm font-medium">{formatDate(item.start_date, locale)}</p>
              </div>

              <div className="rounded-lg border p-3">
                <div className="text-muted-foreground mb-1 flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
                  <Clock className="h-3.5 w-3.5" />
                  {t('features.events.detail.time')}
                </div>
                <p className="text-sm font-medium">{formatTimeRange(item, locale)}</p>
              </div>
            </div>

            {item.organizerName && (
              <div className="rounded-lg border p-3">
                <div className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
                  {t('features.events.detail.organizer')}
                </div>
                <p className="text-sm font-medium">{item.organizerName}</p>
              </div>
            )}

            {item.location && (
              <div className="rounded-lg border p-3">
                <div className="text-muted-foreground mb-1 flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
                  <MapPin className="h-3.5 w-3.5" />
                  {t('features.events.detail.location')}
                </div>
                <p className="text-sm font-medium">{item.location}</p>
              </div>
            )}

            {onlineUrl && (
              <div className="rounded-lg border p-3">
                <div className="text-muted-foreground mb-1 flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
                  <Video className="h-3.5 w-3.5" />
                  {translateText('generated.inline.0028_url_0e2d9b07')}
                </div>
                <a
                  href={onlineUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary text-sm font-medium break-all underline-offset-4 hover:underline"
                >
                  {onlineUrl}
                </a>
              </div>
            )}

            {participantValue && (
              <div className="rounded-lg border p-3">
                <div className="text-muted-foreground mb-1 flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
                  <Users className="h-3.5 w-3.5" />
                  {t('features.events.detail.participants')}
                </div>
                <p className="text-sm font-medium">{participantValue}</p>
              </div>
            )}

            {item.description && (
              <div className="rounded-lg border p-3">
                <div className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
                  {t('features.events.detail.description')}
                </div>
                <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                  {item.description}
                </p>
              </div>
            )}

            {item.hashtags && item.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {item.hashtags.map(hashtag => (
                  <Badge key={hashtag.id} variant="secondary">
                    #{hashtag.tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.close')}
          </Button>
          {eventHref && (
            <Button asChild>
              <Link to={eventHref}>{t('features.calendar.details.openEventWiki')}</Link>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
