import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReadonlyJSONValue } from '@rocicorp/zero';
import { useAuth } from '@/providers/auth-provider';
import { generateDistinctUserColorMap } from '@/features/editor/logic/editor-helpers';
import { useEditorPresence } from '@/features/editor/hooks/useEditorPresence';
import type { EditorCollaborator } from '@/features/editor/types';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { overpassStreetSceneFn } from '@/server/overpass-street-scene';
import { useAmendmentActions } from '@/zero/amendments/useAmendmentActions';
import { useAmendmentState } from '@/zero/amendments/useAmendmentState';
import { useDocumentActions } from '@/zero/documents/useDocumentActions';
import { useUserState } from '@/zero/users/useUserState';
import {
  getBranchEditingMode,
  getBranchEditingModeDisabledReasons,
  resolveSelectedBranchId,
} from '@/features/amendments/logic/amendmentBranchDisplay';
import {
  isTerminalEditingMode,
  normalizeEditingMode,
  type NonTerminalEditingMode,
} from '@/zero/amendments/editing-mode-policy';
import {
  getStreetDesignChangeRequests,
  type StreetDesignChangeRequest,
} from '../logic/streetDesignChangeRequests';
import { getStreetDesignAccess } from '../logic/streetDesignPermissions';
import type {
  StreetDesignBoundingBox,
  StreetDesignGeoPoint,
  StreetDesignMapSelection,
  StreetDesignOsmSnapshot,
  StreetDesignOrigin,
} from '../types';
import {
  STREET_DESIGN_COST_CATALOG_VERSION,
  STREET_DESIGN_CURRENCY,
} from '../logic/streetDesignObjectRegistry';
import {
  createStreetDesignMapSelectionFromBbox,
  createStreetDesignMapSelectionFromCenterRadius,
  getStreetDesignMapSelectionBoundingBox,
} from '../logic/streetDesignBbox';
import {
  createEmptyStreetDesignState,
  parseStoredStreetDesignState,
} from '../state/streetDesignReducer';
import { getStreetDesignOriginFromAmendmentLocation } from '../logic/streetDesignAmendmentLocation';
import { getStreetDesignOsmLayerVisibility } from '../logic/streetDesignOsm';
import { useStreetDesignEditorState } from './useStreetDesignEditorState';

function originFromCenter(center: StreetDesignGeoPoint): StreetDesignOrigin {
  return {
    ...center,
    label: translateText('features.amendments.streetscape.sample.selectedStreetSpace'),
  };
}

function asReadonlyJsonValue(value: unknown): ReadonlyJSONValue {
  return value as ReadonlyJSONValue;
}

function createSampleOsmSnapshot(
  center: StreetDesignGeoPoint,
  bbox: StreetDesignBoundingBox
): StreetDesignOsmSnapshot {
  const latStep = 0.00045;
  const lonStep = 0.00065;

  return {
    fetchedAt: Date.now(),
    bbox,
    features: [
      {
        id: 'sample-road-main',
        kind: 'road',
        geometryKind: 'line',
        label: translateText('features.amendments.streetscape.sample.mainRoad'),
        widthMeters: 4.8,
        points: [
          { lat: center.lat - latStep, lon: center.lon - lonStep },
          { lat: center.lat + latStep, lon: center.lon + lonStep },
        ],
        source: 'sample',
      },
      {
        id: 'sample-road-side',
        kind: 'road',
        geometryKind: 'line',
        label: translateText('features.amendments.streetscape.sample.sideRoad'),
        widthMeters: 4.8,
        points: [
          { lat: center.lat + latStep * 0.2, lon: center.lon - lonStep },
          { lat: center.lat - latStep * 0.15, lon: center.lon + lonStep },
        ],
        source: 'sample',
      },
      {
        id: 'sample-building-left',
        kind: 'building',
        geometryKind: 'polygon',
        label: translateText('features.amendments.streetscape.sample.existingBuilding'),
        height: 15,
        points: [
          { lat: center.lat - 0.00035, lon: center.lon - 0.0005 },
          { lat: center.lat - 0.00015, lon: center.lon - 0.00032 },
          { lat: center.lat - 0.00003, lon: center.lon - 0.00047 },
          { lat: center.lat - 0.00023, lon: center.lon - 0.00065 },
          { lat: center.lat - 0.00035, lon: center.lon - 0.0005 },
        ],
        source: 'sample',
      },
      {
        id: 'sample-building-right',
        kind: 'building',
        geometryKind: 'polygon',
        label: translateText('features.amendments.streetscape.sample.residentialBuilding'),
        height: 12,
        points: [
          { lat: center.lat + 0.00012, lon: center.lon + 0.00028 },
          { lat: center.lat + 0.00032, lon: center.lon + 0.00047 },
          { lat: center.lat + 0.0002, lon: center.lon + 0.00062 },
          { lat: center.lat, lon: center.lon + 0.00042 },
          { lat: center.lat + 0.00012, lon: center.lon + 0.00028 },
        ],
        source: 'sample',
      },
      {
        id: 'sample-green',
        kind: 'green',
        geometryKind: 'polygon',
        label: translateText('features.amendments.streetscape.sample.greenSpace'),
        points: [
          { lat: center.lat + 0.00018, lon: center.lon - 0.00055 },
          { lat: center.lat + 0.00036, lon: center.lon - 0.00036 },
          { lat: center.lat + 0.00026, lon: center.lon - 0.00018 },
          { lat: center.lat + 0.00008, lon: center.lon - 0.00035 },
          { lat: center.lat + 0.00018, lon: center.lon - 0.00055 },
        ],
        source: 'sample',
      },
    ],
  };
}

export function useStreetDesignPageController(amendmentId: string) {
  const { user } = useAuth();
  const { user: userRecord } = useUserState({ userId: user?.id });
  const {
    amendment,
    amendmentDocsCollabs,
    amendmentProcess,
    documents,
    changeRequestsWithVotes,
    collaborators,
    primaryStreetDesign,
    isLoading,
  } = useAmendmentState({
    amendmentId,
    userId: user?.id,
    includeDocsAndCollabs: true,
    includeProcessData: true,
    includeDocuments: true,
    includeChangeRequestsWithVotes: true,
    includeStreetDesign: true,
  });
  const { createStreetDesign, updateProcessBranch, updateStreetDesign } = useAmendmentActions();
  const { updateDocument } = useDocumentActions();
  const amendmentLocationOrigin = useMemo(
    () => getStreetDesignOriginFromAmendmentLocation(amendment),
    [
      amendment?.city,
      amendment?.country,
      amendment?.house_number,
      amendment?.latitude,
      amendment?.longitude,
      amendment?.post_code,
      amendment?.region,
      amendment?.street,
      amendment?.title,
    ]
  );
  const persistedDesign = useMemo(
    () =>
      parseStoredStreetDesignState(primaryStreetDesign?.design_state) ??
      createEmptyStreetDesignState(amendmentLocationOrigin ?? undefined),
    [amendmentLocationOrigin, primaryStreetDesign?.design_state]
  );
  const editor = useStreetDesignEditorState(persistedDesign);
  const [selectedMapSelection, setSelectedMapSelection] = useState<StreetDesignMapSelection>(
    persistedDesign.mapSelection ??
      createStreetDesignMapSelectionFromBbox(
        persistedDesign.osmSnapshot?.bbox ??
          getStreetDesignMapSelectionBoundingBox(
            createStreetDesignMapSelectionFromCenterRadius(persistedDesign.origin)
          )
      )
  );
  const [isLoadingOsm, setIsLoadingOsm] = useState(false);
  const [osmError, setOsmError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    editor.replaceDesign(persistedDesign, false);
    setSelectedMapSelection(
      persistedDesign.mapSelection ??
        createStreetDesignMapSelectionFromBbox(
          persistedDesign.osmSnapshot?.bbox ??
            getStreetDesignMapSelectionBoundingBox(
              createStreetDesignMapSelectionFromCenterRadius(persistedDesign.origin)
            )
        )
    );
  }, [editor.replaceDesign, persistedDesign]);

  const amendmentModeContext = amendmentDocsCollabs ?? amendment;
  const processBranches =
    amendmentDocsCollabs?.current_process_run?.branches ??
    amendmentProcess?.current_process_run?.branches ??
    amendment?.current_process_run?.branches ??
    [];
  const activeBranchId =
    amendmentDocsCollabs?.current_process_run?.active_branch_id ??
    amendmentProcess?.current_process_run?.active_branch_id ??
    amendment?.current_process_run?.active_branch_id ??
    null;
  const activeProcessBranch =
    amendmentDocsCollabs?.current_process_run?.active_branch ??
    amendmentProcess?.current_process_run?.active_branch ??
    null;
  const selectedProcessBranchId = resolveSelectedBranchId({
    branches: processBranches,
    requestedBranchId: null,
    activeBranchId,
  });
  const selectedProcessBranch =
    processBranches.find(branch => branch.id === selectedProcessBranchId) ?? activeProcessBranch;
  const primaryDocument =
    amendmentDocsCollabs?.document ??
    documents.find(document => document.id === amendment?.document_id) ??
    documents[0] ??
    null;
  const hasProcessBranch = Boolean(activeBranchId || activeProcessBranch || processBranches.length);
  const rawEditingMode = selectedProcessBranch
    ? getBranchEditingMode(selectedProcessBranch)
    : normalizeEditingMode(primaryDocument?.editing_mode);
  const mode: NonTerminalEditingMode = isTerminalEditingMode(rawEditingMode)
    ? 'view'
    : rawEditingMode;
  const modeDisabledReasons = getBranchEditingModeDisabledReasons(selectedProcessBranch);
  const { canEdit, canChangeMode, readOnly } = useMemo(
    () =>
      getStreetDesignAccess({
        amendment: amendmentModeContext,
        hasDocumentModeTarget: Boolean(primaryDocument?.id),
        hasProcessBranch,
        selectedProcessBranch,
        userId: user?.id,
      }),
    [amendmentModeContext, hasProcessBranch, primaryDocument?.id, selectedProcessBranch, user?.id]
  );
  const collaborationDocumentId =
    selectedProcessBranch?.document_id ?? primaryDocument?.id ?? amendment?.document_id ?? null;
  const currentUserName =
    [userRecord?.first_name, userRecord?.last_name].filter(Boolean).join(' ').trim() ||
    userRecord?.email ||
    user?.email ||
    'Anonymous';
  const editorCollaborators = useMemo(
    () => mapStreetDesignCollaborators(collaborators, amendment?.created_by),
    [amendment?.created_by, collaborators]
  );
  const existingCollaboratorIds = useMemo(
    () => editorCollaborators.map(collaborator => collaborator.user.id),
    [editorCollaborators]
  );
  const presenceColorByUserId = useMemo(() => {
    const userIds = new Set<string>();
    if (user?.id) userIds.add(user.id);
    editorCollaborators.forEach(collaborator => userIds.add(collaborator.user.id));
    return generateDistinctUserColorMap(userIds);
  }, [editorCollaborators, user?.id]);
  const { onlinePeers, userColor } = useEditorPresence({
    entityId: `street-design:${primaryStreetDesign?.id ?? amendmentId}`,
    userId: user?.id,
    userName: currentUserName,
    userAvatar: userRecord?.avatar ?? undefined,
    userColorByUserId: presenceColorByUserId,
    enabled: Boolean(user?.id),
  });
  const onlinePeerMap = useMemo(() => {
    return new Map(onlinePeers.map(peer => [peer.userId, peer]));
  }, [onlinePeers]);
  const activeCursorUserIds = useMemo(() => new Set<string>(), []);
  const streetChangeRequests = useMemo(
    () =>
      getStreetDesignChangeRequests(
        (changeRequestsWithVotes.length > 0
          ? changeRequestsWithVotes
          : amendment?.change_requests) as readonly StreetDesignChangeRequest[] | null | undefined
      ),
    [amendment?.change_requests, changeRequestsWithVotes]
  );

  const selectedCenter = selectedMapSelection.center;
  const selectedBbox = useMemo(
    () => getStreetDesignMapSelectionBoundingBox(selectedMapSelection),
    [selectedMapSelection]
  );
  const placementDraft = editor.state.placementDraft;
  const placementPreview = placementDraft?.preview ?? null;
  const canFinishPathPlacement =
    placementDraft?.mode === 'path' && placementDraft.points.length >= 2;
  const osmLayerVisibility = getStreetDesignOsmLayerVisibility(editor.design.osmLayerVisibility);
  const showStreetMarkings = editor.design.showStreetMarkings ?? true;

  const handleLoadOsm = useCallback(async () => {
    setIsLoadingOsm(true);
    setOsmError(null);

    try {
      const snapshot = await overpassStreetSceneFn({ data: { bbox: selectedBbox } });

      editor.replaceDesign(
        {
          ...editor.design,
          origin: originFromCenter(selectedCenter),
          mapSelection: selectedMapSelection,
          osmLayerVisibility: getStreetDesignOsmLayerVisibility(editor.design.osmLayerVisibility),
          hiddenOsmWayIds: [],
          hiddenOsmFeatureIds: [],
          osmSnapshot: snapshot,
          comparisonMode: 'overlay',
        },
        true
      );
    } catch (error) {
      setOsmError(
        error instanceof Error
          ? error.message
          : translateText('features.amendments.streetscape.errors.loadOsmFailed')
      );
    } finally {
      setIsLoadingOsm(false);
    }
  }, [editor, selectedBbox, selectedCenter, selectedMapSelection]);

  const handleLoadSample = useCallback(() => {
    const snapshot = createSampleOsmSnapshot(selectedCenter, selectedBbox);
    editor.replaceDesign(
      {
        ...editor.design,
        origin: originFromCenter(selectedCenter),
        mapSelection: selectedMapSelection,
        osmLayerVisibility: getStreetDesignOsmLayerVisibility(editor.design.osmLayerVisibility),
        hiddenOsmWayIds: [],
        hiddenOsmFeatureIds: [],
        osmSnapshot: snapshot,
        comparisonMode: 'overlay',
      },
      true
    );
    setOsmError(null);
  }, [editor, selectedBbox, selectedCenter, selectedMapSelection]);

  const handleSave = useCallback(async () => {
    if (readOnly) return;

    setIsSaving(true);
    setSaveError(null);

    const payload = {
      amendment_id: amendmentId,
      title: amendment?.title
        ? translateText('features.amendments.streetscape.savedTitleWithAmendment', {
            title: amendment.title,
          })
        : translateText('features.amendments.streetscape.defaultTitle'),
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
        error instanceof Error
          ? error.message
          : translateText('features.amendments.streetscape.errors.saveFailed')
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
    readOnly,
    selectedBbox,
    updateStreetDesign,
  ]);

  const handleModeChange = useCallback(
    async (nextMode: NonTerminalEditingMode) => {
      if (!canChangeMode) return;

      if (selectedProcessBranch?.id) {
        await Promise.resolve(
          updateProcessBranch({
            id: selectedProcessBranch.id,
            editing_mode: nextMode,
          })
        );
        return;
      }

      if (primaryDocument?.id) {
        await Promise.resolve(
          updateDocument({
            id: primaryDocument.id,
            editing_mode: nextMode,
          })
        );
      }
    },
    [
      canChangeMode,
      primaryDocument?.id,
      selectedProcessBranch?.id,
      updateDocument,
      updateProcessBranch,
    ]
  );

  return {
    activeCursorUserIds,
    amendment,
    amendmentId,
    isLoading,
    canEdit,
    canChangeMode,
    collaborationDocumentId,
    currentUserId: user?.id,
    editorCollaborators,
    existingCollaboratorIds,
    mode,
    modeDisabledReasons,
    onModeChange: handleModeChange,
    onlinePeerMap,
    presenceColorByUserId,
    readOnly,
    selectedCenter,
    selectedBbox,
    selectedMapSelection,
    placementPreview,
    placementPreviewType: placementDraft?.type ?? null,
    placementStart: placementDraft?.start ?? null,
    placementMode: placementDraft?.mode ?? null,
    placementPointCount: placementDraft?.points.length ?? 0,
    canFinishPathPlacement,
    osmLayerVisibility,
    showStreetMarkings,
    onSelectedMapSelectionChange: setSelectedMapSelection,
    isLoadingOsm,
    osmError,
    onLoadOsm: handleLoadOsm,
    onLoadSample: handleLoadSample,
    isSaving,
    saveError,
    onSave: handleSave,
    costCatalogCurrency: STREET_DESIGN_CURRENCY,
    streetChangeRequests,
    userColor,
    ...editor,
  };
}

function mapStreetDesignCollaborators(
  collaborators: readonly unknown[] | undefined,
  owner: unknown
): EditorCollaborator[] {
  const mapped = new Map<string, EditorCollaborator>();
  const addCollaborator = (row: unknown, fallbackStatus?: EditorCollaborator['status']) => {
    const record = asRecord(row);
    const userRecord = asRecord(record?.user ?? row);
    const id = getString(userRecord?.id);
    if (!id) return;

    const firstName = getString(userRecord?.first_name);
    const lastName = getString(userRecord?.last_name);
    const name =
      getString(userRecord?.name) ??
      [firstName, lastName].filter(Boolean).join(' ').trim() ??
      getString(userRecord?.email) ??
      'Unknown User';

    mapped.set(id, {
      id: getString(record?.id) ?? id,
      user: {
        id,
        name,
        firstName,
        lastName,
        email: getString(userRecord?.email),
        avatarUrl: getString(userRecord?.avatar),
      },
      role: getString(asRecord(record?.role)?.name),
      roleActionRights: asRecord(record?.role)
        ?.action_rights as EditorCollaborator['roleActionRights'],
      canEdit: true,
      status: normalizeCollaboratorStatus(getString(record?.status), fallbackStatus),
    });
  };

  addCollaborator(owner, 'owner');
  (collaborators ?? []).forEach(collaborator => addCollaborator(collaborator));
  return Array.from(mapped.values());
}

function normalizeCollaboratorStatus(
  status: string | undefined,
  fallback: EditorCollaborator['status'] = 'collaborator'
): EditorCollaborator['status'] {
  if (
    status === 'owner' ||
    status === 'admin' ||
    status === 'collaborator' ||
    status === 'member' ||
    status === 'viewer'
  ) {
    return status;
  }
  if (status === 'active') return 'collaborator';
  return fallback;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
