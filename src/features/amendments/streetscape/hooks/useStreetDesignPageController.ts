import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReadonlyJSONValue } from '@rocicorp/zero';
import { useAuth } from '@/providers/auth-provider';
import { overpassStreetSceneFn } from '@/server/overpass-street-scene';
import { useAmendmentActions } from '@/zero/amendments/useAmendmentActions';
import { useAmendmentState } from '@/zero/amendments/useAmendmentState';
import type {
  StreetDesignBoundingBox,
  StreetDesignGeoPoint,
  StreetDesignOsmSnapshot,
  StreetDesignOrigin,
} from '../types';
import {
  STREET_DESIGN_COST_CATALOG_VERSION,
  STREET_DESIGN_CURRENCY,
} from '../logic/streetDesignObjectRegistry';
import {
  createEmptyStreetDesignState,
  parseStoredStreetDesignState,
} from '../state/streetDesignReducer';
import { useStreetDesignEditorState } from './useStreetDesignEditorState';

function bboxFromCenter(center: StreetDesignGeoPoint, radiusMeters = 140): StreetDesignBoundingBox {
  const latDelta = radiusMeters / 111_320;
  const lonDelta = radiusMeters / (111_320 * Math.cos((center.lat * Math.PI) / 180));

  return {
    south: center.lat - latDelta,
    west: center.lon - lonDelta,
    north: center.lat + latDelta,
    east: center.lon + lonDelta,
  };
}

function originFromCenter(center: StreetDesignGeoPoint): StreetDesignOrigin {
  return {
    ...center,
    label: 'Gewaehlter Strassenraum',
  };
}

function asReadonlyJsonValue(value: unknown): ReadonlyJSONValue {
  return value as ReadonlyJSONValue;
}

function createSampleOsmSnapshot(center: StreetDesignGeoPoint): StreetDesignOsmSnapshot {
  const bbox = bboxFromCenter(center);
  const latStep = 0.00045;
  const lonStep = 0.00065;

  return {
    fetchedAt: Date.now(),
    bbox,
    ways: [
      {
        id: 'sample-road-main',
        kind: 'road',
        label: 'Musterstrasse',
        points: [
          { lat: center.lat - latStep, lon: center.lon - lonStep },
          { lat: center.lat + latStep, lon: center.lon + lonStep },
        ],
      },
      {
        id: 'sample-road-side',
        kind: 'road',
        label: 'Querstrasse',
        points: [
          { lat: center.lat + latStep * 0.2, lon: center.lon - lonStep },
          { lat: center.lat - latStep * 0.15, lon: center.lon + lonStep },
        ],
      },
      {
        id: 'sample-building-left',
        kind: 'building',
        label: 'Bestandsgebaeude',
        height: 15,
        points: [
          { lat: center.lat - 0.00035, lon: center.lon - 0.0005 },
          { lat: center.lat - 0.00015, lon: center.lon - 0.00032 },
          { lat: center.lat - 0.00003, lon: center.lon - 0.00047 },
          { lat: center.lat - 0.00023, lon: center.lon - 0.00065 },
          { lat: center.lat - 0.00035, lon: center.lon - 0.0005 },
        ],
      },
      {
        id: 'sample-building-right',
        kind: 'building',
        label: 'Wohnhaus',
        height: 12,
        points: [
          { lat: center.lat + 0.00012, lon: center.lon + 0.00028 },
          { lat: center.lat + 0.00032, lon: center.lon + 0.00047 },
          { lat: center.lat + 0.0002, lon: center.lon + 0.00062 },
          { lat: center.lat, lon: center.lon + 0.00042 },
          { lat: center.lat + 0.00012, lon: center.lon + 0.00028 },
        ],
      },
      {
        id: 'sample-green',
        kind: 'green',
        label: 'Gruenflaeche',
        points: [
          { lat: center.lat + 0.00018, lon: center.lon - 0.00055 },
          { lat: center.lat + 0.00036, lon: center.lon - 0.00036 },
          { lat: center.lat + 0.00026, lon: center.lon - 0.00018 },
          { lat: center.lat + 0.00008, lon: center.lon - 0.00035 },
          { lat: center.lat + 0.00018, lon: center.lon - 0.00055 },
        ],
      },
    ],
  };
}

export function useStreetDesignPageController(amendmentId: string) {
  const { user } = useAuth();
  const { amendment, primaryStreetDesign, isCollaborator, isAdmin, isLoading } = useAmendmentState({
    amendmentId,
    userId: user?.id,
    includeStreetDesign: true,
  });
  const { createStreetDesign, updateStreetDesign } = useAmendmentActions();
  const persistedDesign = useMemo(
    () =>
      parseStoredStreetDesignState(primaryStreetDesign?.design_state) ??
      createEmptyStreetDesignState(),
    [primaryStreetDesign?.design_state]
  );
  const editor = useStreetDesignEditorState(persistedDesign);
  const [selectedCenter, setSelectedCenter] = useState<StreetDesignGeoPoint>(
    persistedDesign.origin
  );
  const [isLoadingOsm, setIsLoadingOsm] = useState(false);
  const [osmError, setOsmError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    editor.replaceDesign(persistedDesign, false);
    setSelectedCenter(persistedDesign.origin);
  }, [editor.replaceDesign, persistedDesign]);

  const canEdit = Boolean(
    user && (isCollaborator || isAdmin || amendment?.created_by_id === user.id)
  );

  const selectedBbox = useMemo(() => bboxFromCenter(selectedCenter), [selectedCenter]);

  const handleLoadOsm = useCallback(async () => {
    setIsLoadingOsm(true);
    setOsmError(null);

    try {
      const snapshot = await overpassStreetSceneFn({ data: { bbox: selectedBbox } });
      editor.replaceDesign(
        {
          ...editor.design,
          origin: originFromCenter(selectedCenter),
          osmSnapshot: snapshot,
        },
        true
      );
    } catch (error) {
      setOsmError(
        error instanceof Error ? error.message : 'OSM-Daten konnten nicht geladen werden.'
      );
    } finally {
      setIsLoadingOsm(false);
    }
  }, [editor, selectedBbox, selectedCenter]);

  const handleLoadSample = useCallback(() => {
    const snapshot = createSampleOsmSnapshot(selectedCenter);
    editor.replaceDesign(
      {
        ...editor.design,
        origin: originFromCenter(selectedCenter),
        osmSnapshot: snapshot,
      },
      true
    );
    setOsmError(null);
  }, [editor, selectedCenter]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaveError(null);

    const payload = {
      amendment_id: amendmentId,
      title: amendment?.title ? `${amendment.title} - Strassenentwurf` : 'Strassenentwurf',
      bbox: asReadonlyJsonValue(editor.design.osmSnapshot?.bbox ?? selectedBbox),
      center_lat: editor.design.origin.lat,
      center_lon: editor.design.origin.lon,
      osm_snapshot: asReadonlyJsonValue(editor.design.osmSnapshot),
      design_state: asReadonlyJsonValue(editor.design),
      currency: editor.costSummary.currency,
      estimated_total_cost_minor: editor.costSummary.totalCostMinor,
      cost_catalog_version: STREET_DESIGN_COST_CATALOG_VERSION,
      cost_summary: asReadonlyJsonValue(editor.costSummary),
    };

    try {
      if (primaryStreetDesign?.id) {
        await updateStreetDesign({
          id: primaryStreetDesign.id,
          title: payload.title,
          bbox: payload.bbox,
          center_lat: payload.center_lat,
          center_lon: payload.center_lon,
          osm_snapshot: payload.osm_snapshot,
          design_state: payload.design_state,
          currency: payload.currency,
          estimated_total_cost_minor: payload.estimated_total_cost_minor,
          cost_catalog_version: payload.cost_catalog_version,
          cost_summary: payload.cost_summary,
        });
      } else {
        await createStreetDesign({
          id: crypto.randomUUID(),
          ...payload,
        });
      }

      editor.replaceDesign(editor.design, false);
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : 'Entwurf konnte nicht gespeichert werden.'
      );
    } finally {
      setIsSaving(false);
    }
  }, [
    amendment?.title,
    amendmentId,
    createStreetDesign,
    editor,
    primaryStreetDesign?.id,
    selectedBbox,
    updateStreetDesign,
  ]);

  return {
    amendment,
    isLoading,
    canEdit,
    selectedCenter,
    selectedBbox,
    onSelectedCenterChange: setSelectedCenter,
    isLoadingOsm,
    osmError,
    onLoadOsm: handleLoadOsm,
    onLoadSample: handleLoadSample,
    isSaving,
    saveError,
    onSave: handleSave,
    costCatalogCurrency: STREET_DESIGN_CURRENCY,
    ...editor,
  };
}
