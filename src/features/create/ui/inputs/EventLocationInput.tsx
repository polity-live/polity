import { FormControlLabel, CreateInputField } from '@/features/shared/ui/form';
import { GeoAddressPicker } from '@/features/shared/ui/form/GeoAddressPicker';
import { Button } from '@/features/shared/ui/ui/button';

type AttendanceMode = 'online' | 'hybrid' | 'offline';

interface EventLocationValues {
  locationName: string;
  onlineLink: string;
  country: string;
  region: string;
  postCode: string;
  city: string;
  street: string;
  houseNumber: string;
  latitude: number | null;
  longitude: number | null;
  capacity: string;
}

interface EventLocationInputProps {
  attendanceMode: AttendanceMode;
  values: EventLocationValues;
  showCapacity: boolean;
  labels: {
    attendanceMode: string;
    online: string;
    hybrid: string;
    offline: string;
    venueName: string;
    venueNameHint: string;
    venueNamePlaceholder: string;
    meetingLink: string;
    meetingLinkHint: string;
    meetingLinkPlaceholder: string;
    capacity: string;
    capacityHint: string;
    capacityPlaceholder: string;
    country: string;
    region: string;
    city: string;
    postCode: string;
    street: string;
    houseNumber: string;
  };
  onAttendanceModeChange: (mode: AttendanceMode) => void;
  onValueChange: (field: keyof EventLocationValues, value: string | number | null) => void;
}

export function EventLocationInput({
  attendanceMode,
  values,
  showCapacity,
  labels,
  onAttendanceModeChange,
  onValueChange,
}: EventLocationInputProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <FormControlLabel>{labels.attendanceMode}</FormControlLabel>
        <div className="flex flex-wrap gap-2">
          {(['online', 'hybrid', 'offline'] as const).map(mode => (
            <Button
              key={mode}
              type="button"
              variant={attendanceMode === mode ? 'default' : 'outline'}
              onClick={() => onAttendanceModeChange(mode)}
              data-create-option={mode}
            >
              {mode === 'online'
                ? labels.online
                : mode === 'hybrid'
                  ? labels.hybrid
                  : labels.offline}
            </Button>
          ))}
        </div>
      </div>
      {attendanceMode !== 'online' ? (
        <div className="space-y-4 rounded-xl border p-4">
          <CreateInputField
            label={labels.venueName}
            hint={labels.venueNameHint}
            value={values.locationName}
            onValueChange={value => onValueChange('locationName', value)}
            placeholder={labels.venueNamePlaceholder}
          />
          <GeoAddressPicker
            idPrefix="create-event-location"
            values={{
              country: values.country,
              region: values.region,
              city: values.city,
              post_code: values.postCode,
              street: values.street,
              house_number: values.houseNumber,
            }}
            coordinates={
              values.latitude !== null && values.longitude !== null
                ? { latitude: values.latitude, longitude: values.longitude }
                : null
            }
            onCoordinatesChange={coordinates => {
              onValueChange('latitude', coordinates?.latitude ?? null);
              onValueChange('longitude', coordinates?.longitude ?? null);
            }}
            onFieldChange={(field, value) => {
              const fieldMap = {
                country: 'country',
                region: 'region',
                city: 'city',
                post_code: 'postCode',
                street: 'street',
                house_number: 'houseNumber',
              } as const;
              onValueChange(fieldMap[field], value);
            }}
            labels={{
              country: labels.country,
              region: labels.region,
              city: labels.city,
              post_code: labels.postCode,
              street: labels.street,
              house_number: labels.houseNumber,
            }}
            placeholders={{
              country: labels.country,
              region: labels.region,
              city: labels.city,
              post_code: labels.postCode,
              street: labels.street,
              house_number: labels.houseNumber,
            }}
          />
        </div>
      ) : null}
      {attendanceMode !== 'offline' ? (
        <div className="space-y-4 rounded-xl border p-4">
          <CreateInputField
            label={labels.meetingLink}
            hint={labels.meetingLinkHint}
            value={values.onlineLink}
            onValueChange={value => onValueChange('onlineLink', value)}
            placeholder={labels.meetingLinkPlaceholder}
          />
        </div>
      ) : null}
      {showCapacity ? (
        <CreateInputField
          label={labels.capacity}
          hint={labels.capacityHint}
          type="number"
          value={values.capacity}
          onValueChange={value => onValueChange('capacity', value)}
          placeholder={labels.capacityPlaceholder}
          min={1}
        />
      ) : null}
    </div>
  );
}
