import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type {
  CityDesignComparisonLayer,
  CityDesignLocalPoint,
  CityDesignStateV1,
  CityDesignObjectCategory,
} from '../types';
import type { CityDesignSceneController } from '../logic/cityDesignScene';
import { getCityDesignObjectDefinition } from '../logic/cityDesignObjectRegistry';
import {
  getDesignStreetNetwork,
  getOsmStreetNetwork,
  measureStreetCrossSection,
  type StreetMeasurement,
} from '../logic/cityDesignStreetNetwork';

export interface CityDesignSelectionRef {
  id: string;
  layer: CityDesignComparisonLayer;
}
export function useCityDesignMeasurements({
  design,
  selectedObjectId,
  selectedOsmWayId,
  onObjectSelect,
  onOsmWaySelect,
  hiddenObjectIds,
  hiddenObjectCategories,
  sceneControllerRef,
}: {
  design: CityDesignStateV1;
  selectedObjectId: string | null;
  selectedOsmWayId: string | null;
  onObjectSelect: (id: string | null) => void;
  onOsmWaySelect: (id: string | null) => void;
  hiddenObjectIds: string[];
  hiddenObjectCategories: CityDesignObjectCategory[];
  sceneControllerRef: RefObject<CityDesignSceneController | null>;
}) {
  const [selection, setSelection] = useState<CityDesignSelectionRef[]>([]);
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const [multiSelectActive, setMultiSelectActive] = useState(false);
  const [measurementActive, setMeasurementActive] = useState(false);
  const [measurement, setMeasurement] = useState<StreetMeasurement | null>(null);
  const [awaitingEnd, setAwaitingEnd] = useState(false);
  const [measurementLayer, setMeasurementLayer] = useState<CityDesignComparisonLayer>('design');
  const [measurementLevel, setMeasurementLevel] = useState<string | undefined>();
  const designNetwork = useMemo(
    () =>
      getDesignStreetNetwork(
        design.objects.filter(
          object =>
            !hiddenObjectIds.includes(object.id) &&
            !hiddenObjectCategories.includes(getCityDesignObjectDefinition(object.type).category)
        )
      ),
    [design.objects, hiddenObjectIds, hiddenObjectCategories]
  );
  const originalNetwork = useMemo(
    () => getOsmStreetNetwork(design),
    [
      design.osmSnapshot,
      design.origin,
      design.osmLayerVisibility,
      design.hiddenOsmWayIds,
      design.hiddenOsmFeatureIds,
      design.objects,
    ]
  );
  const networks = { design: designNetwork, original: originalNetwork };
  useEffect(() => {
    const id = selectedObjectId ?? selectedOsmWayId;
    if (!id) {
      setSelection(current => (current.length === 0 ? current : []));
      return;
    }
    const layer: CityDesignComparisonLayer = selectedObjectId ? 'design' : 'original';
    setSelection(current =>
      current.some(item => item.id === id && item.layer === layer) ? current : [{ id, layer }]
    );
  }, [selectedObjectId, selectedOsmWayId]);
  useEffect(() => {
    setMeasurement(null);
    setAwaitingEnd(false);
  }, [design.comparisonMode, design.origin]);
  const select = useCallback(
    (id: string | null, layer: CityDesignComparisonLayer, additive = false) => {
      const current = selectionRef.current;
      const next =
        id == null
          ? []
          : additive || multiSelectActive
            ? current.some(item => item.id === id && item.layer === layer)
              ? current.filter(item => item.id !== id || item.layer !== layer)
              : [...current.filter(item => item.layer === layer), { id, layer }]
            : [{ id, layer }];
      selectionRef.current = next;
      setSelection(next);
      const primary = next[next.length - 1];
      if (primary?.layer === 'original') onOsmWaySelect(primary.id);
      else if (primary?.layer === 'design') onObjectSelect(primary.id);
      else {
        onObjectSelect(null);
        onOsmWaySelect(null);
      }
    },
    [multiSelectActive, onObjectSelect, onOsmWaySelect]
  );
  const selectObject = useCallback(
    (id: string | null, additive = false) => select(id, 'design', additive),
    [select]
  );
  const selectOsm = useCallback(
    (id: string | null, additive = false) => select(id, 'original', additive),
    [select]
  );
  const onMeasurementPoint = useCallback(
    (point: CityDesignLocalPoint, clickedLayer: CityDesignComparisonLayer) => {
      const layer =
        design.comparisonMode === 'split'
          ? clickedLayer
          : design.comparisonMode === 'original'
            ? 'original'
            : design.comparisonMode === 'new_design'
              ? 'design'
              : measurementLayer;
      if (awaitingEnd && measurement) {
        if (measurement.layer !== layer) return;
        setMeasurement({ ...measurement, end: point });
        setAwaitingEnd(false);
      } else {
        const levels = [
          ...new Set([...networks[layer].features.values()].map(feature => feature.source.level)),
        ];
        setMeasurement({ start: point, end: point, layer, level: measurementLevel ?? levels[0] });
        setAwaitingEnd(true);
      }
    },
    [
      awaitingEnd,
      measurement,
      measurementLayer,
      measurementLevel,
      design.comparisonMode,
      designNetwork,
      originalNetwork,
    ]
  );
  const moveEndpoint = useCallback(
    (endpoint: 'start' | 'end', clientX: number, clientY: number) => {
      if (!measurement) return;
      const point = sceneControllerRef.current?.getGroundPointAtClient?.(
        clientX,
        clientY,
        measurement.layer
      );
      if (point) setMeasurement({ ...measurement, [endpoint]: point });
    },
    [measurement, sceneControllerRef]
  );
  const result = useMemo(
    () =>
      measurement
        ? measureStreetCrossSection(
            measurement.layer === 'design' ? designNetwork : originalNetwork,
            measurement
          )
        : null,
    [measurement, designNetwork, originalNetwork]
  );
  const selectedWidths = selection.flatMap(ref => {
    const feature = networks[ref.layer].features.get(ref.id);
    return feature && !feature.source.polygon
      ? [
          {
            ...ref,
            width: feature.source.width,
            estimated: feature.source.estimated,
            kind: feature.source.kind,
          },
        ]
      : [];
  });
  const selectedObjectIds = useMemo(
    () => selection.filter(ref => ref.layer === 'design').map(ref => ref.id),
    [selection]
  );
  const selectedOsmWayIds = useMemo(
    () => selection.filter(ref => ref.layer === 'original').map(ref => ref.id),
    [selection]
  );
  const visibleLayer =
    design.comparisonMode === 'original'
      ? 'original'
      : design.comparisonMode === 'new_design'
        ? 'design'
        : (measurement?.layer ?? measurementLayer);
  const levels = [
    ...new Set([...networks[visibleLayer].features.values()].map(feature => feature.source.level)),
  ];
  return {
    selection,
    selectedWidths,
    selectedObjectIds,
    selectedOsmWayIds,
    selectObject,
    selectOsm,
    multiSelectActive,
    setMultiSelectActive,
    measurementActive,
    setMeasurementActive,
    measurement,
    measurementResult: result,
    awaitingEnd,
    onMeasurementPoint,
    moveEndpoint,
    measurementLayer,
    setMeasurementLayer: (layer: CityDesignComparisonLayer) => {
      setMeasurementLayer(layer);
      setMeasurement(null);
      setAwaitingEnd(false);
      setMeasurementLevel(undefined);
    },
    measurementLevel: measurement?.level ?? measurementLevel,
    levels,
    setMeasurementLevel: (level: string) => {
      setMeasurementLevel(level);
      setMeasurement(current => (current ? { ...current, level } : null));
    },
    clearMeasurement: () => {
      setMeasurement(null);
      setAwaitingEnd(false);
    },
  };
}
export type CityDesignMeasurements = ReturnType<typeof useCityDesignMeasurements>;
