import { type GeoAddressTextMap } from '@/features/shared/ui/form/GeoAddressFields';
import type {
  GeoAddressField,
  GeoAddressValues,
} from '@/features/shared/ui/form/GeoAddressInputField';
import { type GeoCoordinates } from '@/features/shared/logic/geoCoordinates';
import type { GeoLocationShape } from '@/features/shared/logic/geoLocationShape';

interface GeoAddressPickerProps {
  idPrefix: string;
  values: GeoAddressValues;
  onFieldChange: (field: GeoAddressField, value: string) => void;
  labels: GeoAddressTextMap;
  placeholders: GeoAddressTextMap;
  coordinates: GeoCoordinates | null;
  onCoordinatesChange: (coordinates: GeoCoordinates | null) => void;
  shape?: GeoLocationShape | null;
  onShapeChange?: (shape: GeoLocationShape | null) => void;
}
import { useGeoAddressPickerController } from './useGeoAddressPickerController';
import { GeoAddressPickerView } from './GeoAddressPickerView';

export function GeoAddressPicker({
  idPrefix,
  values,
  onFieldChange,
  labels,
  placeholders,
  coordinates,
  onCoordinatesChange,
  shape,
  onShapeChange,
}: GeoAddressPickerProps) {
  const viewProps = useGeoAddressPickerController({
    idPrefix,
    values,
    onFieldChange,
    labels,
    placeholders,
    coordinates,
    onCoordinatesChange,
    shape,
    onShapeChange,
  });

  return <GeoAddressPickerView {...viewProps} />;
}
