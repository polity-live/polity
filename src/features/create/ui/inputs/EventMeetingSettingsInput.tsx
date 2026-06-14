import { FormControlLabel, CreateInputField } from '@/features/shared/ui/form';
import { Button } from '@/features/shared/ui/ui/button';

type MeetingType = 'one-on-one' | 'public-meeting';

interface EventMeetingSettingsInputProps {
  meetingType: MeetingType;
  meetingMaxBookings: string;
  labels: {
    format: string;
    oneOnOne: string;
    publicMeeting: string;
    oneOnOneDescription: string;
    publicMeetingDescription: string;
    oneOnOneLimit: string;
    bookingLimit: string;
    bookingLimitHint: string;
    bookingLimitPlaceholder: string;
  };
  onMeetingTypeChange: (value: MeetingType) => void;
  onMeetingMaxBookingsChange: (value: string) => void;
}

export function EventMeetingSettingsInput({
  meetingType,
  meetingMaxBookings,
  labels,
  onMeetingTypeChange,
  onMeetingMaxBookingsChange,
}: EventMeetingSettingsInputProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <FormControlLabel>{labels.format}</FormControlLabel>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={meetingType === 'one-on-one' ? 'default' : 'outline'}
            onClick={() => onMeetingTypeChange('one-on-one')}
          >
            {labels.oneOnOne}
          </Button>
          <Button
            type="button"
            variant={meetingType === 'public-meeting' ? 'default' : 'outline'}
            onClick={() => onMeetingTypeChange('public-meeting')}
          >
            {labels.publicMeeting}
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          {meetingType === 'public-meeting'
            ? labels.publicMeetingDescription
            : labels.oneOnOneDescription}
        </p>
      </div>
      {meetingType === 'public-meeting' ? (
        <CreateInputField
          label={labels.bookingLimit}
          hint={labels.bookingLimitHint}
          type="number"
          value={meetingMaxBookings}
          onValueChange={onMeetingMaxBookingsChange}
          placeholder={labels.bookingLimitPlaceholder}
          min={1}
        />
      ) : (
        <p className="text-muted-foreground text-xs">{labels.oneOnOneLimit}</p>
      )}
    </div>
  );
}
