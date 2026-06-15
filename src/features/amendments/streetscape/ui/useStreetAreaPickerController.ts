import { useEffect, useMemo, useState } from 'react';
import type { DivIcon } from 'leaflet';
import type {
  StreetDesignBoundingBox,
  StreetDesignGeoPoint,
  StreetDesignMapSelection,
} from '../types';
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
  onMapSelectionChange: (selection: StreetDesignMapSelection) => void;
  onLoadOsm: () => void;
  onLoadSample: () => void;
}
type ReactLeafletModule = typeof import('react-leaflet');
type LeafletModule = typeof import('leaflet');

export function useStreetAreaPickerController({
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
  const [reactLeafletModule, setReactLeafletModule] = useState<ReactLeafletModule | null>(null);

  const [leafletModule, setLeafletModule] = useState<LeafletModule | null>(null);

  const [loadFailed, setLoadFailed] = useState(false);

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

  const mapUnavailable =
    loadFailed ||
    !reactLeafletModule ||
    !leafletModule ||
    !markerIcon ||
    !resizeMarkerIcon ||
    !rotateMarkerIcon;

  return {
    center,
    isLoadingOsm,
    osmError,
    readOnly,
    onLoadOsm,
    onLoadSample,
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
    onBboxResize: handleBboxResize,
    onSelectionRotate: handleRotationDrag,
    onWidthMetersChange: handleWidthMetersChange,
    onHeightMetersChange: handleHeightMetersChange,
    onRotationDegreesChange: handleRotationDegreesChange,
    mapUnavailable,
  };
}
