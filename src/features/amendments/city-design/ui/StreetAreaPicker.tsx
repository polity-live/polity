import type {
  CityDesignBoundingBox,
  CityDesignGeoPoint,
  CityDesignMapSelection,
  CityDesignSelectionAddress,
} from '../types';
interface StreetAreaPickerProps {
  center: CityDesignGeoPoint;
  bbox: CityDesignBoundingBox;
  mapSelection: CityDesignMapSelection;
  isLoadingOsm: boolean;
  osmError: string | null;
  readOnly: boolean;
  selectionAddress?: CityDesignSelectionAddress;
  addressLabel: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  variant?: 'card' | 'panel';
  tutorialActive?: boolean;
  onMapSelectionChange: (selection: CityDesignMapSelection) => void;
  onSelectionAddressChange: (address?: CityDesignSelectionAddress) => void;
  onLoadOsm: () => void;
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
  selectionAddress,
  addressLabel,
  open,
  onOpenChange,
  variant,
  tutorialActive,
  onMapSelectionChange,
  onSelectionAddressChange,
  onLoadOsm,
}: StreetAreaPickerProps) {
  const viewProps = useStreetAreaPickerController({
    center,
    bbox,
    mapSelection,
    isLoadingOsm,
    osmError,
    readOnly,
    selectionAddress,
    onMapSelectionChange,
    onSelectionAddressChange,
    onLoadOsm,
  });

  return (
    <StreetAreaPickerView
      {...viewProps}
      addressLabel={addressLabel}
      open={open}
      onOpenChange={onOpenChange}
      variant={variant}
      tutorialActive={tutorialActive}
    />
  );
}
