import { Button } from '@/features/shared/ui/ui/button'
import { Badge } from '@/features/shared/ui/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar'
import { Clock, ExternalLink, MapPin, Trash2, Users, Video } from 'lucide-react'
import { cn } from '@/features/shared/utils/utils'
import { useTranslation } from '@/features/shared/hooks/use-translation'
import { formatTime } from '@/features/meet/logic/date-helpers.ts'
import type { MeetingInstance } from '../hooks/useMeetPage'

interface MeetingInstanceCardProps {
  instance: MeetingInstance
  isOwner: boolean
  onBook: (instance: MeetingInstance) => void
  onCancel: (instance: MeetingInstance) => void
  onDelete: (eventId: string) => void
  onSelect?: (instance: MeetingInstance) => void
}

export function MeetingInstanceCard({
  instance,
  isOwner,
  onBook,
  onCancel,
  onDelete,
  onSelect,
}: MeetingInstanceCardProps) {
  const { t } = useTranslation()
  const isPast = instance.endDate < Date.now()
  const isFull = instance.bookingCount >= instance.maxBookings
  const isAvailable = instance.isBookable && !isPast && !isFull
  const canBook = !isOwner && isAvailable && !instance.isBookedByMe
  const canCancel = !isOwner && instance.isBookedByMe && !isPast
  const onlineUrl = instance.locationUrl ?? instance.streamUrl

  return (
    <div
      className={cn(
        'rounded-lg border p-4 transition-colors',
        isPast && 'opacity-50',
        instance.isBookedByMe && 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950',
        canBook && 'border-dashed border-blue-300 bg-blue-50/50 hover:border-primary hover:bg-accent dark:border-blue-800 dark:bg-blue-950/50',
        onSelect && 'cursor-pointer hover:border-primary hover:bg-accent/40',
      )}
      onClick={() => onSelect?.(instance)}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold">{instance.title}</h4>
            {instance.meetingType === 'public-meeting' && (
              <Badge variant="secondary">
                <Users className="mr-1 h-3 w-3" />
                Public offer
              </Badge>
            )}
            {instance.isBookedByMe && (
              <Badge className="bg-green-500/15 text-green-700 dark:text-green-400">
                {t('features.calendar.meeting.booked')}
              </Badge>
            )}
            {isFull && !instance.isBookedByMe && (
              <Badge variant="outline">{t('features.calendar.meeting.fullyBooked')}</Badge>
            )}
            {!instance.isBookedByMe && !isFull && !isPast && instance.isBookable && (
              <Badge variant="outline" className="border-dashed">
                {t('features.calendar.meeting.available')}
              </Badge>
            )}
            {isPast && <Badge variant="secondary">Past</Badge>}
          </div>

          {instance.description && (
            <p className="text-sm text-muted-foreground">{instance.description}</p>
          )}

          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4" />
            {formatTime(instance.startDate)} - {formatTime(instance.endDate)}
          </div>

          {instance.locationName && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {instance.locationName}
            </div>
          )}

          {onlineUrl && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Video className="h-4 w-4" />
              <a
                href={onlineUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 underline-offset-4 hover:text-foreground hover:underline"
                onClick={event => event.stopPropagation()}
              >
                Open online meeting link
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          )}

          {/* Show booking participants */}
          {instance.bookingCount > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex -space-x-2">
                {instance.participants
                  .filter(p => p.user_id !== instance.creator?.id)
                  .filter(p => {
                    if (instance.instanceDate === null) {
                      return !p.instance_date || p.instance_date === 0
                    }
                    return p.instance_date === instance.instanceDate
                  })
                  .slice(0, 5)
                  .map(p => (
                    <Avatar key={p.id} className="h-6 w-6 border-2 border-background">
                      <AvatarImage src={p.user?.avatar ?? undefined} />
                      <AvatarFallback className="text-xs">
                        {p.user?.first_name?.[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  ))}
              </div>
              <span className="text-sm text-muted-foreground">
                {instance.bookingCount} attending
              </span>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {canBook && (
            <Button size="sm" onClick={event => {
              event.stopPropagation()
              onBook(instance)
            }}>
              Book meeting
            </Button>
          )}
          {canCancel && (
            <Button size="sm" variant="outline" onClick={event => {
              event.stopPropagation()
              onCancel(instance)
            }}>
              Cancel booking
            </Button>
          )}
          {isOwner && !isPast && !instance.isRecurringInstance && (
            <Button
              size="sm"
              variant="ghost"
              onClick={event => {
                event.stopPropagation()
                onDelete(instance.parentEventId)
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
