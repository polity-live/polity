import type { GeoCoordinates } from '@/features/shared/logic/geoCoordinates';
import type { GeoLocationShape } from '@/features/shared/logic/geoLocationShape';
interface GeoAddressMapProps {
  coordinates: GeoCoordinates | null;
  onCoordinatesChange: (coordinates: GeoCoordinates) => void;
  shape?: GeoLocationShape | null;
  isBusy?: boolean;
  loadingLabel: string;
  unavailableLabel: string;
  busyLabel: string;
  emptyMessage: string;
  moveHint: string;
  interactive?: boolean;
}
import { useGeoAddressMapController } from './useGeoAddressMapController';
import { GeoAddressMapView } from './GeoAddressMapView';

export function GeoAddressMap({
  coordinates,
  onCoordinatesChange,
  shape = null,
  isBusy = false,
  loadingLabel,
  unavailableLabel,
  busyLabel,
  emptyMessage,
  moveHint,
  interactive = true,
}: GeoAddressMapProps) {
  const viewProps = useGeoAddressMapController({
    coordinates,
    onCoordinatesChange,
    shape,
    isBusy,
    loadingLabel,
    unavailableLabel,
    busyLabel,
    emptyMessage,
    moveHint,
    interactive,
  });

  return <GeoAddressMapView {...viewProps} />;
}
