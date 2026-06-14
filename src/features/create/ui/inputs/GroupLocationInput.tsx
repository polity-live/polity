import { GeoAddressPicker } from '@/features/shared/ui/form/GeoAddressPicker';

interface GroupLocationValues {
  country: string;
  region: string;
  city: string;
  post_code: string;
  street: string;
  house_number: string;
  latitude: number | null;
  longitude: number | null;
}

interface GroupLocationInputProps {
  hint: string;
  values: GroupLocationValues;
  labels: Record<'country' | 'region' | 'city' | 'post_code' | 'street' | 'house_number', string>;
  placeholders: Record<
    'country' | 'region' | 'city' | 'post_code' | 'street' | 'house_number',
    string
  >;
  onFieldChange: (
    field: keyof Omit<GroupLocationValues, 'latitude' | 'longitude'>,
    value: string
  ) => void;
  onCoordinatesChange: (coordinates: { latitude: number; longitude: number } | null) => void;
}

export function GroupLocationInput({
  hint,
  values,
  labels,
  placeholders,
  onFieldChange,
  onCoordinatesChange,
}: GroupLocationInputProps) {
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-xs">{hint}</p>
      <GeoAddressPicker
        idPrefix="create-group-location"
        values={{
          country: values.country,
          region: values.region,
          city: values.city,
          post_code: values.post_code,
          street: values.street,
          house_number: values.house_number,
        }}
        coordinates={
          values.latitude !== null && values.longitude !== null
            ? { latitude: values.latitude, longitude: values.longitude }
            : null
        }
        onCoordinatesChange={onCoordinatesChange}
        onFieldChange={(field, value) => onFieldChange(field, value)}
        labels={labels}
        placeholders={placeholders}
      />
    </div>
  );
}
