import {
  type GeoAddressField,
  type GeoAddressValues,
  type GeoResolvedAddress,
} from '@/features/shared/ui/form/GeoAddressInputField';

export type GeoAddressTextMap = Record<GeoAddressField, string>;

interface GeoAddressFieldsProps {
  idPrefix: string;
  values: GeoAddressValues;
  onFieldChange: (field: GeoAddressField, value: string) => void;
  labels: GeoAddressTextMap;
  placeholders: GeoAddressTextMap;
  onResolvedAddress?: (result: GeoResolvedAddress | null) => void;
  resetContextKey?: number | string;
}
import { useGeoAddressFieldsController } from './useGeoAddressFieldsController';
import { GeoAddressFieldsView } from './GeoAddressFieldsView';

export function GeoAddressFields({
  idPrefix,
  values,
  onFieldChange,
  labels,
  placeholders,
  onResolvedAddress,
  resetContextKey,
}: GeoAddressFieldsProps) {
  const viewProps = useGeoAddressFieldsController({
    idPrefix,
    values,
    onFieldChange,
    labels,
    placeholders,
    onResolvedAddress,
    resetContextKey,
  });

  return <GeoAddressFieldsView {...viewProps} />;
}
