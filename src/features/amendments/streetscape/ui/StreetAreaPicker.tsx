import type {
  StreetDesignBoundingBox,
  StreetDesignGeoPoint,
  StreetDesignMapSelection,
  StreetDesignSelectionAddress,
} from '../types';
interface StreetAreaPickerProps {
  center: StreetDesignGeoPoint;
  bbox: StreetDesignBoundingBox;
  mapSelection: StreetDesignMapSelection;
  isLoadingOsm: boolean;
  osmError: string | null;
  readOnly: boolean;
  selectionAddress?: StreetDesignSelectionAddress;
  addressLabel: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  variant?: 'card' | 'panel';
  onMapSelectionChange: (selection: StreetDesignMapSelection) => void;
  onSelectionAddressChange: (address?: StreetDesignSelectionAddress) => void;
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
    />
  );
}
