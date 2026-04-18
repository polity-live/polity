import { Card, CardContent } from '@/features/shared/ui/ui/card'
import { ScrollArea } from '@/features/shared/ui/ui/scroll-area'
import { useTranslation } from '@/features/shared/hooks/use-translation'
import { cn } from '@/features/shared/utils/utils'
import { Calendar as CalendarIcon, MapPin, Video } from 'lucide-react'
import { formatTime } from '@/features/meet/logic/date-helpers.ts'
import type { MeetingInstance } from '../hooks/useMeetPage'
import { MeetingInstanceCard } from './MeetingInstanceCard'

interface MeetingListViewProps {
  instances: MeetingInstance[]
  selectedDate: Date
  isOwner: boolean
  onBook: (instance: MeetingInstance) => void
  onCancel: (instance: MeetingInstance) => void
  onDelete: (eventId: string) => void
  onSelectInstance?: (instance: MeetingInstance) => void
}

interface MeetingWeekViewProps {
  selectedDate: Date
  onDateSelect: (date: Date) => void
  getInstancesForDate: (date: Date) => MeetingInstance[]
  onSelectInstance?: (instance: MeetingInstance) => void
}

interface MeetingMonthViewProps {
  selectedDate: Date
  onDateSelect: (date: Date) => void
  getInstancesForDate: (date: Date) => MeetingInstance[]
  onSelectInstance?: (instance: MeetingInstance) => void
}

function isSameDay(d1: Date | string | number, d2: Date): boolean {
  const date1 = new Date(d1)
  return (
    date1.getFullYear() === d2.getFullYear() &&
    date1.getMonth() === d2.getMonth() &&
    date1.getDate() === d2.getDate()
  )
}

function groupByDate(instances: MeetingInstance[]): Map<string, MeetingInstance[]> {
  const map = new Map<string, MeetingInstance[]>()
  const sorted = [...instances].sort((a, b) => a.startDate - b.startDate)

  for (const instance of sorted) {
    const date = new Date(instance.startDate)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate(),
    ).padStart(2, '0')}`

    if (!map.has(key)) {
      map.set(key, [])
    }

    map.get(key)!.push(instance)
  }

  return map
}

function getWeekDays(selectedDate: Date): Date[] {
  const start = new Date(selectedDate)
  const day = start.getDay()
  start.setDate(start.getDate() - day)
  start.setHours(0, 0, 0, 0)

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return date
  })
}

function getMonthGrid(selectedDate: Date): (Date | null)[][] {
  const year = selectedDate.getFullYear()
  const month = selectedDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDayOfWeek = firstDay.getDay()
  const totalDays = lastDay.getDate()
  const weeks: (Date | null)[][] = []
  let currentWeek: (Date | null)[] = []

  for (let index = 0; index < startDayOfWeek; index += 1) {
    currentWeek.push(null)
  }

  for (let day = 1; day <= totalDays; day += 1) {
    currentWeek.push(new Date(year, month, day))
    if (currentWeek.length === 7) {
      weeks.push(currentWeek)
      currentWeek = []
    }
  }

  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null)
    }
    weeks.push(currentWeek)
  }

  return weeks
}

function getCompactCardClassName(instance: MeetingInstance): string {
  const isFull = instance.bookingCount >= instance.maxBookings

  if (instance.isBookedByMe) {
    return 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950'
  }

  if (instance.isBookable && !isFull) {
    return 'border-dashed border-blue-300 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/50'
  }

  return 'bg-card'
}

function CompactMeetingCard({
  instance,
  onClick,
}: {
  instance: MeetingInstance
  onClick?: (instance: MeetingInstance) => void
}) {
  const isPast = instance.endDate < Date.now()
  const locationLabel = instance.locationName || (instance.locationUrl ?? instance.streamUrl ? 'Online' : null)

  return (
    <div
      className={cn(
        'cursor-pointer rounded-md border p-1.5 text-xs shadow-sm transition-colors hover:bg-accent',
        getCompactCardClassName(instance),
        isPast && 'opacity-50',
        !onClick && 'cursor-default hover:bg-transparent',
      )}
      onClick={event => {
        event.stopPropagation()
        onClick?.(instance)
      }}
    >
      <p className="truncate font-medium">{instance.title}</p>
      <p className="text-muted-foreground">{formatTime(instance.startDate)}</p>
      {locationLabel && (
        <p className="flex items-center gap-0.5 truncate text-muted-foreground">
          {instance.locationName ? (
            <MapPin className="h-2.5 w-2.5 shrink-0" />
          ) : (
            <Video className="h-2.5 w-2.5 shrink-0" />
          )}
          {locationLabel}
        </p>
      )}
    </div>
  )
}

export function MeetingListView({
  instances,
  selectedDate,
  isOwner,
  onBook,
  onCancel,
  onDelete,
  onSelectInstance,
}: MeetingListViewProps) {
  const { language } = useTranslation()
  const grouped = groupByDate(instances)
  const locale = language === 'de' ? 'de-DE' : 'en-US'

  if (instances.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <CalendarIcon className="mx-auto mb-4 h-12 w-12 opacity-50" />
          <p>No meeting offers scheduled for this period</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <ScrollArea className="h-[700px]">
      <div className="space-y-6">
        {Array.from(grouped.entries()).map(([dateKey, dayInstances]) => {
          const date = new Date(`${dateKey}T00:00:00`)
          const isCurrentMonth = date.getMonth() === selectedDate.getMonth()
          const isToday = isSameDay(date, new Date())

          return (
            <div key={dateKey}>
              <h3
                className={cn(
                  'mb-3 text-sm font-semibold text-muted-foreground',
                  !isCurrentMonth && 'opacity-70',
                )}
              >
                {date.toLocaleDateString(locale, {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
                {isToday && <span className="ml-2 text-primary">(Today)</span>}
              </h3>
              <div className="space-y-3">
                {dayInstances.map(instance => (
                  <MeetingInstanceCard
                    key={instance.id}
                    instance={instance}
                    isOwner={isOwner}
                    onBook={onBook}
                    onCancel={onCancel}
                    onDelete={onDelete}
                    onSelect={onSelectInstance}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}

export function MeetingWeekView({
  selectedDate,
  onDateSelect,
  getInstancesForDate,
  onSelectInstance,
}: MeetingWeekViewProps) {
  const { language } = useTranslation()
  const weekDays = getWeekDays(selectedDate)
  const locale = language === 'de' ? 'de-DE' : 'en-US'

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map(day => {
            const dayInstances = getInstancesForDate(day)
            const isToday = isSameDay(day, new Date())
            const isSelected = isSameDay(day, selectedDate)

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  'min-h-[200px] rounded-lg border p-2 transition-colors',
                  isSelected && 'border-primary bg-accent',
                  isToday && !isSelected && 'border-primary',
                )}
                onClick={() => onDateSelect(day)}
              >
                <div className="mb-2 text-center">
                  <p className="text-xs font-medium text-muted-foreground">
                    {day.toLocaleDateString(locale, { weekday: 'short' })}
                  </p>
                  <p
                    className={cn(
                      'text-lg font-semibold',
                      (isToday || isSelected) && 'text-primary',
                    )}
                  >
                    {day.getDate()}
                  </p>
                </div>

                <ScrollArea className="h-[140px]">
                  <div className="space-y-1">
                    {dayInstances.map(instance => (
                      <CompactMeetingCard
                        key={instance.id}
                        instance={instance}
                        onClick={selectedInstance => onSelectInstance?.(selectedInstance)}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

const WEEKDAY_LABELS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEKDAY_LABELS_DE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

export function MeetingMonthView({
  selectedDate,
  onDateSelect,
  getInstancesForDate,
  onSelectInstance,
}: MeetingMonthViewProps) {
  const { language } = useTranslation()
  const weeks = getMonthGrid(selectedDate)
  const today = new Date()
  const weekdayLabels = language === 'de' ? WEEKDAY_LABELS_DE : WEEKDAY_LABELS_EN

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="grid grid-cols-7 gap-px border-b pb-2">
          {weekdayLabels.map(label => (
            <div key={label} className="text-center text-xs font-medium text-muted-foreground">
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px">
          {weeks.map((week, weekIndex) =>
            week.map((day, dayIndex) => {
              if (!day) {
                return <div key={`${weekIndex}-${dayIndex}`} className="min-h-[120px] bg-muted/30" />
              }

              const dayInstances = getInstancesForDate(day)
              const isCurrentDay = isSameDay(day, today)
              const isSelected = isSameDay(day, selectedDate)

              return (
                <div
                  key={`${weekIndex}-${dayIndex}`}
                  className={cn(
                    'min-h-[120px] cursor-pointer border-b border-r p-1 transition-colors hover:bg-accent/30',
                    isSelected && 'bg-accent/50',
                  )}
                  onClick={() => onDateSelect(day)}
                >
                  <div className="mb-1 flex justify-end">
                    <span
                      className={cn(
                        'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                        isCurrentDay && 'bg-primary text-primary-foreground',
                        isSelected && !isCurrentDay && 'bg-accent-foreground/10 font-bold',
                      )}
                    >
                      {day.getDate()}
                    </span>
                  </div>

                  <ScrollArea className="h-[90px]">
                    <div className="space-y-0.5">
                      {dayInstances.map(instance => (
                        <CompactMeetingCard
                          key={instance.id}
                          instance={instance}
                          onClick={selectedInstance => onSelectInstance?.(selectedInstance)}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )
            }),
          )}
        </div>
      </CardContent>
    </Card>
  )
}