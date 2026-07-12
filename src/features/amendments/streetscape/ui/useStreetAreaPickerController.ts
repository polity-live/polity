import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { toGeoCoordinates } from '@/features/shared/logic/geoCoordinates';
import { geoapifyReverseFn } from '@/server/geoapify-reverse';
import type {
  GeoAddressField,
  GeoAddressValues,
  GeoResolvedAddress,
} from '@/features/shared/ui/form/GeoAddressInputField';
import type { GeoAddressTextMap } from '@/features/shared/ui/form/GeoAddressFields';
import type { DivIcon } from 'leaflet';
import type {
  StreetDesignBoundingBox,
  StreetDesignGeoPoint,
  StreetDesignMapSelection,
  StreetDesignSelectionAddress,
} from '../types';
import {
  createStreetDesignSelectionAddress,
  EMPTY_STREET_DESIGN_ADDRESS_VALUES,
  mapStreetDesignSelectionAddressToValues,
} from '../logic/streetDesignSelectionAddress';
import {
  getStreetDesignMapSelectionCorners,
  getStreetDesignMapSelectionDimensions,
  getStreetDesignMapSelectionRotateHandle,
  moveStreetDesignMapSelectionToCenter,
  resizeStreetDesignMapSelectionByHandle,
  resizeStreetDesignMapSelectionMeters,
  rotateStreetDesignMapSelectionToPoint,
  createStreetDesignMapSelection,
  type StreetDesignBboxResizeHandle,
} from '../logic/streetDesignBbox';

interface StreetAreaPickerProps {
  center: StreetDesignGeoPoint;
  bbox: StreetDesignBoundingBox;
  mapSelection: StreetDesignMapSelection;
  isLoadingOsm: boolean;
  osmError: string | null;
  readOnly: boolean;
  selectionAddress?: StreetDesignSelectionAddress;
  onMapSelectionChange: (selection: StreetDesignMapSelection) => void;
  onSelectionAddressChange: (address?: StreetDesignSelectionAddress) => void;
  onLoadOsm: () => void;
}

type ReactLeafletModule = typeof import('react-leaflet');
type LeafletModule = typeof import('leaflet');

function isSameGeoPoint(left: StreetDesignGeoPoint, right: StreetDesignGeoPoint) {
  const precision = 1_000_000;
  return (
    Math.round(left.lat * precision) === Math.round(right.lat * precision) &&
    Math.round(left.lon * precision) === Math.round(right.lon * precision)
  );
}

export function useStreetAreaPickerController({
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
}: StreetAreaPickerProps) {
  const { t, language } = useTranslation();
  const [reactLeafletModule, setReactLeafletModule] = useState<ReactLeafletModule | null>(null);

  const [leafletModule, setLeafletModule] = useState<LeafletModule | null>(null);

  const [loadFailed, setLoadFailed] = useState(false);
  const persistedAddressValues = useMemo(
    () => mapStreetDesignSelectionAddressToValues(selectionAddress),
    [
      selectionAddress?.city,
      selectionAddress?.country,
      selectionAddress?.houseNumber,
      selectionAddress?.postCode,
      selectionAddress?.region,
      selectionAddress?.street,
    ]
  );
  const [locationSearchValues, setLocationSearchValues] =
    useState<GeoAddressValues>(persistedAddressValues);
  const [locationSearchResetKey, setLocationSearchResetKey] = useState(0);
  const [mapViewportFocusKey, setMapViewportFocusKey] = useState(0);
  const mapSelectionRef = useRef(mapSelection);
  const reverseRequestIdRef = useRef(0);
  const userDrivenLocationSearchFieldRef = useRef<GeoAddressField | null>(null);

  useEffect(() => {
    mapSelectionRef.current = mapSelection;
  }, [mapSelection]);

  useEffect(() => {
    userDrivenLocationSearchFieldRef.current = null;
    setLocationSearchValues(persistedAddressValues);
    setLocationSearchResetKey(key => key + 1);
  }, [persistedAddressValues]);

  useEffect(() => {
    let isActive = true;

    const loadModules = async () => {
      try {
        const [nextReactLeafletModule, nextLeafletModule] = await Promise.all([
          import('react-leaflet'),
          import('leaflet'),
        ]);

        if (!isActive) return;
        setReactLeafletModule(nextReactLeafletModule);
        setLeafletModule(nextLeafletModule);
      } catch {
        if (isActive) setLoadFailed(true);
      }
    };

    void loadModules();

    return () => {
      isActive = false;
    };
  }, []);

  const markerIcon = useMemo<DivIcon | null>(() => {
    if (!leafletModule) return null;

    return leafletModule.divIcon({
      className: '',
      html: '<span style="display:block;width:24px;height:24px;border-radius:9999px;background:#0f766e;border:3px solid white;box-shadow:0 10px 24px rgba(15,118,110,0.35);cursor:move;"></span>',
      iconAnchor: [12, 12],
      iconSize: [24, 24],
    });
  }, [leafletModule]);

  const resizeMarkerIcon = useMemo<DivIcon | null>(() => {
    if (!leafletModule) return null;

    return leafletModule.divIcon({
      className: '',
      html: '<span style="display:block;width:16px;height:16px;border-radius:4px;background:white;border:2px solid #0f766e;box-shadow:0 6px 14px rgba(15,118,110,0.28);cursor:nwse-resize;"></span>',
      iconAnchor: [8, 8],
      iconSize: [16, 16],
    });
  }, [leafletModule]);

  const rotateMarkerIcon = useMemo<DivIcon | null>(() => {
    if (!leafletModule) return null;

    return leafletModule.divIcon({
      className: '',
      html: '<span style="display:flex;width:20px;height:20px;align-items:center;justify-content:center;border-radius:9999px;background:#facc15;border:2px solid white;box-shadow:0 6px 14px rgba(0,0,0,0.2);cursor:grab;font-size:12px;font-weight:700;color:#334155;">↻</span>',
      iconAnchor: [10, 10],
      iconSize: [20, 20],
    });
  }, [leafletModule]);

  const locationSearchLabels = useMemo<GeoAddressTextMap>(
    () => ({
      country: t('features.amendments.streetscape.areaPicker.locationFields.country'),
      region: t('features.amendments.streetscape.areaPicker.locationFields.region'),
      city: t('features.amendments.streetscape.areaPicker.locationFields.city'),
      post_code: t('features.amendments.streetscape.areaPicker.locationFields.postCode'),
      street: t('features.amendments.streetscape.areaPicker.locationFields.street'),
      house_number: t('features.amendments.streetscape.areaPicker.locationFields.houseNumber'),
    }),
    [t]
  );

  const locationSearchPlaceholders = useMemo<GeoAddressTextMap>(
    () => ({
      country: t('features.amendments.streetscape.areaPicker.locationPlaceholders.country'),
      region: t('features.amendments.streetscape.areaPicker.locationPlaceholders.region'),
      city: t('features.amendments.streetscape.areaPicker.locationPlaceholders.city'),
      post_code: t('features.amendments.streetscape.areaPicker.locationPlaceholders.postCode'),
      street: t('features.amendments.streetscape.areaPicker.locationPlaceholders.street'),
      house_number: t(
        'features.amendments.streetscape.areaPicker.locationPlaceholders.houseNumber'
      ),
    }),
    [t]
  );

  const position = [center.lat, center.lon] as [number, number];
  const dimensions = useMemo(
    () => getStreetDesignMapSelectionDimensions(mapSelection),
    [mapSelection]
  );
  const selectionCorners = useMemo(
    () =>
      getStreetDesignMapSelectionCorners(mapSelection).map(
        point => [point.lat, point.lon] as [number, number]
      ),
    [mapSelection]
  );
  const rotateHandlePosition = useMemo(() => {
    const point = getStreetDesignMapSelectionRotateHandle(mapSelection);
    return [point.lat, point.lon] as [number, number];
  }, [mapSelection]);

  const bounds =
    leafletModule != null
      ? leafletModule.latLngBounds([bbox.south, bbox.west], [bbox.north, bbox.east])
      : null;

  const resizeHandles = useMemo(
    () =>
      [
        { handle: 'nw', position: selectionCorners[0] },
        {
          handle: 'n',
          position: [
            (selectionCorners[0][0] + selectionCorners[1][0]) / 2,
            (selectionCorners[0][1] + selectionCorners[1][1]) / 2,
          ],
        },
        { handle: 'ne', position: selectionCorners[1] },
        {
          handle: 'e',
          position: [
            (selectionCorners[1][0] + selectionCorners[2][0]) / 2,
            (selectionCorners[1][1] + selectionCorners[2][1]) / 2,
          ],
        },
        { handle: 'se', position: selectionCorners[2] },
        {
          handle: 's',
          position: [
            (selectionCorners[2][0] + selectionCorners[3][0]) / 2,
            (selectionCorners[2][1] + selectionCorners[3][1]) / 2,
          ],
        },
        { handle: 'sw', position: selectionCorners[3] },
        {
          handle: 'w',
          position: [
            (selectionCorners[3][0] + selectionCorners[0][0]) / 2,
            (selectionCorners[3][1] + selectionCorners[0][1]) / 2,
          ],
        },
      ] as {
        handle: StreetDesignBboxResizeHandle;
        position: [number, number];
      }[],
    [selectionCorners]
  );

  const handleBboxMove = (nextCenter: StreetDesignGeoPoint) => {
    reverseRequestIdRef.current += 1;
    userDrivenLocationSearchFieldRef.current = null;
    onMapSelectionChange(moveStreetDesignMapSelectionToCenter(mapSelection, nextCenter));
  };

  const handleBboxResize = (handle: StreetDesignBboxResizeHandle, point: StreetDesignGeoPoint) => {
    onMapSelectionChange(
      resizeStreetDesignMapSelectionByHandle({ selection: mapSelection, handle, point })
    );
  };

  const handleWidthMetersChange = (widthMeters: number) => {
    onMapSelectionChange(
      resizeStreetDesignMapSelectionMeters({
        selection: mapSelection,
        widthMeters,
        heightMeters: dimensions.heightMeters,
      })
    );
  };

  const handleHeightMetersChange = (heightMeters: number) => {
    onMapSelectionChange(
      resizeStreetDesignMapSelectionMeters({
        selection: mapSelection,
        widthMeters: dimensions.widthMeters,
        heightMeters,
      })
    );
  };

  const handleRotationDegreesChange = (rotationDeg: number) => {
    onMapSelectionChange(
      createStreetDesignMapSelection({
        ...mapSelection,
        rotationDeg,
      })
    );
  };

  const handleRotationDrag = (point: StreetDesignGeoPoint) => {
    onMapSelectionChange(rotateStreetDesignMapSelectionToPoint({ selection: mapSelection, point }));
  };

  const handleLocationSearchFieldChange = useCallback((field: GeoAddressField, value: string) => {
    reverseRequestIdRef.current += 1;
    if (value.trim()) {
      userDrivenLocationSearchFieldRef.current = field;
    } else if (userDrivenLocationSearchFieldRef.current === field) {
      userDrivenLocationSearchFieldRef.current = null;
    }
    setLocationSearchValues(previousValues => ({
      ...previousValues,
      [field]: value,
    }));
  }, []);

  const handleLocationResolvedAddress = useCallback(
    (result: GeoResolvedAddress | null, field: GeoAddressField | null) => {
      if (readOnly) return;
      if (!field || userDrivenLocationSearchFieldRef.current !== field) return;

      const coordinates = toGeoCoordinates(result);
      if (!coordinates) return;

      userDrivenLocationSearchFieldRef.current = null;

      const nextCenter = {
        lat: coordinates.latitude,
        lon: coordinates.longitude,
      };
      const currentSelection = mapSelectionRef.current;

      if (!isSameGeoPoint(currentSelection.center, nextCenter)) {
        onMapSelectionChange(moveStreetDesignMapSelectionToCenter(currentSelection, nextCenter));
        setMapViewportFocusKey(key => key + 1);
      }

      if (result) {
        onSelectionAddressChange(createStreetDesignSelectionAddress(result, locationSearchValues));
      }
    },
    [locationSearchValues, onMapSelectionChange, onSelectionAddressChange, readOnly]
  );

  const handleBboxMoveEnd = useCallback(
    async (nextCenter: StreetDesignGeoPoint) => {
      if (readOnly) return;

      const requestId = ++reverseRequestIdRef.current;
      try {
        const { result } = await geoapifyReverseFn({
          data: {
            latitude: nextCenter.lat,
            longitude: nextCenter.lon,
            language,
          },
        });
        if (reverseRequestIdRef.current !== requestId || !result) return;

        const nextAddress = createStreetDesignSelectionAddress(result);
        userDrivenLocationSearchFieldRef.current = null;
        setLocationSearchValues(mapStreetDesignSelectionAddressToValues(nextAddress));
        setLocationSearchResetKey(key => key + 1);
        onSelectionAddressChange(nextAddress);
      } catch {
        if (reverseRequestIdRef.current === requestId) {
          onSelectionAddressChange(undefined);
        }
      }
    },
    [language, onSelectionAddressChange, readOnly]
  );

  const mapLoading =
    !loadFailed &&
    (!reactLeafletModule ||
      !leafletModule ||
      !markerIcon ||
      !resizeMarkerIcon ||
      !rotateMarkerIcon);
  const mapUnavailable = loadFailed;

  return {
    center,
    isLoadingOsm,
    osmError,
    readOnly,
    onLoadOsm,
    locationSearchValues,
    locationSearchLabels,
    locationSearchPlaceholders,
    locationSearchResetKey,
    mapViewportFocusKey,
    onLocationSearchFieldChange: handleLocationSearchFieldChange,
    onLocationSearchResolved: handleLocationResolvedAddress,
    onLocationSearchReset: () => {
      reverseRequestIdRef.current += 1;
      userDrivenLocationSearchFieldRef.current = null;
      setLocationSearchValues(EMPTY_STREET_DESIGN_ADDRESS_VALUES);
      setLocationSearchResetKey(key => key + 1);
      onSelectionAddressChange(undefined);
    },
    reactLeafletModule,
    markerIcon,
    resizeMarkerIcon,
    rotateMarkerIcon,
    position,
    bounds,
    selectionCorners,
    rotateHandlePosition,
    resizeHandles,
    widthMeters: dimensions.widthMeters,
    heightMeters: dimensions.heightMeters,
    rotationDeg: dimensions.rotationDeg,
    onBboxMove: handleBboxMove,
    onBboxMoveEnd: handleBboxMoveEnd,
    onBboxResize: handleBboxResize,
    onSelectionRotate: handleRotationDrag,
    onWidthMetersChange: handleWidthMetersChange,
    onHeightMetersChange: handleHeightMetersChange,
    onRotationDegreesChange: handleRotationDegreesChange,
    mapLoading,
    mapUnavailable,
  };
}
