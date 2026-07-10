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
  onResolvedAddress?: (result: GeoResolvedAddress | null, field: GeoAddressField | null) => void;
  resetContextKey?: number | string;
  disabled?: boolean;
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
  disabled,
}: GeoAddressFieldsProps) {
  const viewProps = useGeoAddressFieldsController({
    idPrefix,
    values,
    onFieldChange,
    labels,
    placeholders,
    onResolvedAddress,
    resetContextKey,
    disabled,
  });

  return <GeoAddressFieldsView {...viewProps} />;
}
