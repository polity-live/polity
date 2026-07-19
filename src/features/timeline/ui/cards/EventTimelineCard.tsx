'use client';

import { useState } from 'react';
import { Users, Trophy, ScrollText } from 'lucide-react';
import { format, isToday, isTomorrow, isPast, differenceInHours } from 'date-fns';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useEventParticipation } from '@/features/events/hooks/useEventParticipation';
import { useSubscribeEvent } from '@/features/events/hooks/useSubscribeEvent';
import { normalizeTimelineText } from '@/features/timeline/logic/normalizeTimelineText';
import { CONTENT_TYPE_CONFIG } from '../../constants/content-type-config';

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

/**
 * Format the event date for display
 */
function formatEventDate(date: Date): {
  day: string;
  month: string;
  time: string;
  status: 'live' | 'upcoming' | 'past';
} {
  const now = new Date();
  let status: 'live' | 'upcoming' | 'past' = 'upcoming';

  if (isPast(date)) {
    status = 'past';
  } else if (differenceInHours(date, now) <= 0) {
    status = 'live';
  }

  return {
    day: format(date, 'd'),
    month: format(date, 'MMM').toUpperCase(),
    time: format(date, 'h:mm a'),
    status,
  };
}

/**
 * Get date label (Today, Tomorrow, or formatted date)
 */
function getDateLabel(date: Date): string | null {
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  return null;
}

/**
 * Build location display string
 */
function buildLocationDisplay(location?: string, city?: string, postcode?: string): string | null {
  // If location already includes city/postcode info, return as-is
  if (location) {
    const locationLower = location.toLowerCase();
    const hasCity = city && locationLower.includes(city.toLowerCase());
    const hasPostcode = postcode && location.includes(postcode);

    if (hasCity || hasPostcode) {
      return location;
    }

    // Append city and postcode if not already included
    const parts = [location];
    if (city && postcode) {
      parts.push(`${postcode} ${city}`);
    } else if (city) {
      parts.push(city);
    } else if (postcode) {
      parts.push(postcode);
    }
    return parts.join(', ');
  }

  // No location but have city/postcode
  if (city && postcode) {
    return `${postcode} ${city}`;
  }
  if (city) {
    return city;
  }
  if (postcode) {
    return postcode;
  }

  return null;
}
import { EventTimelineCardView } from './EventTimelineCardView';
export function EventTimelineCard({
  event,
  href,
  onSelect,
  onRequestParticipation,
  onLeave,
  onAcceptInvitation,
  onWithdrawRequest,
  onToggleSubscription,
  isParticipationLoading,
  isSubscriptionLoading,
  className,
}: EventTimelineCardProps) {
  const { t } = useTranslation();
  const [rsvpOpen, setRsvpOpen] = useState(false);
  const participation = useEventParticipation(event.id);
  const subscription = useSubscribeEvent(event.id);

  const startDate = new Date(event.startDate);
  const { day, month, time, status: eventTimeStatus } = formatEventDate(startDate);
  const dateLabel = getDateLabel(startDate);

  const locationDisplay = buildLocationDisplay(event.location, event.city, event.postcode);
  const eventStyle = CONTENT_TYPE_CONFIG.event;
  const eventHref = href ?? (onSelect ? undefined : `/event/${event.id}`);
  const eventDescription = normalizeTimelineText(event.description);
  const eventSubtitle = event.groupName ?? event.organizerName ?? event.organizerId;
  const eventSubtitleHref =
    event.groupId && event.groupName
      ? `/group/${event.groupId}`
      : event.organizerId
        ? `/user/${event.organizerId}`
        : undefined;

  const resolvedParticipationStatus = event.participationStatus ?? participation.status;
  const isParticipant =
    resolvedParticipationStatus === 'member' ||
    resolvedParticipationStatus === 'admin' ||
    resolvedParticipationStatus === 'confirmed' ||
    participation.isParticipant;
  const isInvited = resolvedParticipationStatus === 'invited' || participation.isInvited;
  const hasRequested = resolvedParticipationStatus === 'requested' || participation.hasRequested;
  const hasParticipationRelationship = isParticipant || isInvited || hasRequested;

  // Get RSVP button label based on status
  const getRsvpLabel = () => {
    if (isParticipant) return t('features.timeline.cards.event.attending');
    if (isInvited) return t('features.timeline.cards.event.invited');
    if (hasRequested) return t('features.timeline.cards.event.pending');
    return t('features.timeline.cards.rsvp');
  };

  // Get RSVP button variant based on status
  const getRsvpVariant = (): 'default' | 'secondary' | 'outline' => {
    if (isParticipant) return 'secondary';
    if (isInvited) return 'default';
    if (hasRequested) return 'outline';
    return 'default';
  };

  // Build stats array
  const stats = [
    {
      icon: Users,
      value: event.attendeeCount ?? participation.participantCount ?? 0,
      label: t('features.timeline.cards.event.participants', {
        count: event.attendeeCount ?? participation.participantCount ?? 0,
      }),
    },
    ...(event.electionsCount !== undefined && event.electionsCount > 0
      ? [
          {
            icon: Trophy,
            value: event.electionsCount,
            label: t('features.timeline.cards.event.elections', {
              count: event.electionsCount,
            }),
          },
        ]
      : []),
    ...(event.amendmentsCount !== undefined && event.amendmentsCount > 0
      ? [
          {
            icon: ScrollText,
            value: event.amendmentsCount,
            label: t('features.timeline.cards.event.amendments', {
              count: event.amendmentsCount,
            }),
          },
        ]
      : []),
  ];
  return (
    <EventTimelineCardView
      event={event}
      href={href}
      onSelect={onSelect}
      onRequestParticipation={onRequestParticipation}
      onLeave={onLeave}
      onAcceptInvitation={onAcceptInvitation}
      onWithdrawRequest={onWithdrawRequest}
      onToggleSubscription={onToggleSubscription}
      isParticipationLoading={isParticipationLoading}
      isSubscriptionLoading={isSubscriptionLoading}
      className={className}
      t={t}
      rsvpOpen={rsvpOpen}
      setRsvpOpen={setRsvpOpen}
      participation={participation}
      subscription={subscription}
      startDate={startDate}
      day={day}
      month={month}
      time={time}
      eventTimeStatus={eventTimeStatus}
      dateLabel={dateLabel}
      locationDisplay={locationDisplay}
      eventStyle={eventStyle}
      eventHref={eventHref}
      eventDescription={eventDescription}
      eventSubtitle={eventSubtitle}
      eventSubtitleHref={eventSubtitleHref}
      resolvedParticipationStatus={resolvedParticipationStatus}
      isParticipant={isParticipant}
      isInvited={isInvited}
      hasRequested={hasRequested}
      hasParticipationRelationship={hasParticipationRelationship}
      getRsvpLabel={getRsvpLabel}
      getRsvpVariant={getRsvpVariant}
      stats={stats}
    />
  );
}
