import { MeetupTimelineCard } from '@/features/timeline/ui/cards/MeetupTimelineCard';
import type { MeetingInstance } from '../hooks/useMeetPage';

interface MeetingInstanceCardProps {
  instance: MeetingInstance;
  isOwner: boolean;
  onBook: (instance: MeetingInstance) => void;
  onCancel: (instance: MeetingInstance) => void;
  onDelete: (eventId: string) => void;
  onSelect?: (instance: MeetingInstance) => void;
}

export function MeetingInstanceCard({
  instance,
  isOwner,
  onBook,
  onCancel,
  onDelete,
  onSelect,
}: MeetingInstanceCardProps) {
  const participants = instance.participants
    .filter(p => p.user_id !== instance.creator?.id)
    .filter(p => {
      if (instance.instanceDate === null) {
        return !p.instance_date || p.instance_date === 0;
      }

      return p.instance_date === instance.instanceDate;
    })
    .map(p => ({
      id: p.id,
      name: [p.user?.first_name, p.user?.last_name].filter(Boolean).join(' ') || undefined,
      avatar: p.user?.avatar ?? undefined,
    }));
  const organizerName =
    [instance.creator?.first_name, instance.creator?.last_name].filter(Boolean).join(' ') ||
    undefined;

  return (
    <MeetupTimelineCard
      meetup={{
        id: instance.parentEventId,
        title: instance.title,
        description: instance.description,
        startDate: instance.startDate,
        endDate: instance.endDate,
        meetingType: instance.meetingType,
        organizerName,
        location: instance.locationName,
        onlineUrl: instance.locationUrl ?? instance.streamUrl,
        bookingCount: instance.bookingCount,
        maxBookings: instance.maxBookings,
        isBookedByMe: instance.isBookedByMe,
        isOwner,
        isBookable: instance.isBookable,
        isRecurringInstance: instance.isRecurringInstance,
        participants,
      }}
      onBook={() => onBook(instance)}
      onCancel={() => onCancel(instance)}
      onDelete={isOwner ? () => onDelete(instance.parentEventId) : undefined}
      onSelect={onSelect ? () => onSelect(instance) : undefined}
    />
  );
}
