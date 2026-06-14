import type { GeoCoordinates } from '@/features/shared/logic/geoCoordinates';
interface GeoAddressMapProps {
  coordinates: GeoCoordinates | null;
  onCoordinatesChange: (coordinates: GeoCoordinates) => void;
  isBusy?: boolean;
  loadingLabel: string;
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
  isBusy = false,
  loadingLabel,
  busyLabel,
  emptyMessage,
  moveHint,
  interactive = true,
}: GeoAddressMapProps) {
  const viewProps = useGeoAddressMapController({
    coordinates,
    onCoordinatesChange,
    isBusy,
    loadingLabel,
    busyLabel,
    emptyMessage,
    moveHint,
    interactive,
  });

  return <GeoAddressMapView {...viewProps} />;
}
