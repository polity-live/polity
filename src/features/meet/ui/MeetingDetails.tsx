import { BadgeControl } from '@/features/shared/ui/status';
import { Card, CardContent, CardHeader, CardTitle } from '@/features/shared/ui/ui/card';
import { Calendar, Clock } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import {
  formatMeetingDate,
  formatMeetingTime,
  formatMeetingType,
} from '../logic/meetingFormatters';
import { calculateDuration, getMeetingStatus } from '../logic/meetingUtils';

interface MeetingDetailsProps {
  startTime: string | number;
  endTime: string | number;
  meetingType: string;
  isAvailable: boolean;
  isPast: boolean;
}

export function MeetingDetails({
  startTime,
  endTime,
  meetingType,
  isAvailable,
  isPast,
}: MeetingDetailsProps) {
  const { t } = useTranslation();
  const duration = calculateDuration(startTime, endTime);
  const status = getMeetingStatus(isAvailable, isPast);

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>{t('features.meet.page.meetingDetails')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex items-start gap-3">
            <Calendar className="text-muted-foreground mt-1 h-5 w-5" />
            <div>
              <p className="font-medium">{formatMeetingDate(startTime)}</p>
              <p className="text-muted-foreground text-sm">
                {formatMeetingTime(startTime)} - {formatMeetingTime(endTime)}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Clock className="text-muted-foreground mt-1 h-5 w-5" />
            <div>
              <p className="font-medium">{t('features.meet.page.duration')}</p>
              <p className="text-muted-foreground text-sm">{duration}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <BadgeControl variant={status.variant} className={status.className}>
            {status.label}
          </BadgeControl>
          <BadgeControl variant="outline" className="capitalize">
            {formatMeetingType(meetingType)}
          </BadgeControl>
        </div>
      </CardContent>
    </Card>
  );
}
