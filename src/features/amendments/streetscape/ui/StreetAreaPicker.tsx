import type {
  StreetDesignBoundingBox,
  StreetDesignGeoPoint,
  StreetDesignMapSelection,
} from '../types';
interface StreetAreaPickerProps {
  center: StreetDesignGeoPoint;
  bbox: StreetDesignBoundingBox;
  mapSelection: StreetDesignMapSelection;
  isLoadingOsm: boolean;
  osmError: string | null;
  readOnly: boolean;
  onMapSelectionChange: (selection: StreetDesignMapSelection) => void;
  onLoadOsm: () => void;
  onLoadSample: () => void;
}
import { useStreetAreaPickerController } from './useStreetAreaPickerController';
import { StreetAreaPickerView } from './StreetAreaPickerView';

export function StreetAreaPicker({
  center,
  bbox,
  mapSelection,
  isLoadingOsm,
  osmError,
  readOnly,
  onMapSelectionChange,
  onLoadOsm,
  onLoadSample,
}: StreetAreaPickerProps) {
  const viewProps = useStreetAreaPickerController({
    center,
    bbox,
    mapSelection,
    isLoadingOsm,
    osmError,
    readOnly,
    onMapSelectionChange,
    onLoadOsm,
    onLoadSample,
  });

  return <StreetAreaPickerView {...viewProps} />;
}
