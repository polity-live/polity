import type { StreetDesignBoundingBox, StreetDesignGeoPoint } from '../types';
interface StreetAreaPickerProps {
  center: StreetDesignGeoPoint;
  bbox: StreetDesignBoundingBox;
  isLoadingOsm: boolean;
  osmError: string | null;
  readOnly: boolean;
  onCenterChange: (center: StreetDesignGeoPoint) => void;
  onLoadOsm: () => void;
  onLoadSample: () => void;
}
import { useStreetAreaPickerController } from './useStreetAreaPickerController';
import { StreetAreaPickerView } from './StreetAreaPickerView';

export function StreetAreaPicker({
  center,
  bbox,
  isLoadingOsm,
  osmError,
  readOnly,
  onCenterChange,
  onLoadOsm,
  onLoadSample,
}: StreetAreaPickerProps) {
  const viewProps = useStreetAreaPickerController({
    center,
    bbox,
    isLoadingOsm,
    osmError,
    readOnly,
    onCenterChange,
    onLoadOsm,
    onLoadSample,
  });

  return <StreetAreaPickerView {...viewProps} />;
}
