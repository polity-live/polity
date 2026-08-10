import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  isBranchEditable,
  resolveSelectedBranchId,
} from '@/features/amendments/logic/amendmentBranchDisplay';
import {
  isSuggestingMode,
  isTerminalEditingMode,
  isVotingMode,
  normalizeEditingMode,
  type NonTerminalEditingMode,
} from '@/zero/amendments/editing-mode-policy';
import {
  formatCityDesignChangeRequestIdentifier,
  formatCityDesignChangeRequestTitle,
  getCityDesignChangeRequests,
  getCityDesignChangeRequestDiscussionId,
  isOpenCityDesignChangeRequest,
  type CityDesignChangeRequest,
  type CityDesignChangeRequestColorMode,
} from '../logic/cityDesignChangeRequests';
import { getCityDesignAccess } from '../logic/cityDesignPermissions';
import type {
  CityDesignGeoPoint,
  CityDesignMapSelection,
  CityDesignOrigin,
  CityDesignSelectionAddress,
} from '../types';
import {
  createCityDesignMapSelectionFromBbox,
  createCityDesignMapSelectionFromCenterRadius,
  getCityDesignMapSelectionBoundingBox,
} from '../logic/cityDesignBbox';
import { createEmptyCityDesignState, parseStoredCityDesignState } from '../state/cityDesignReducer';
import {
  createCityDesignChangeRequestPayloads,
  createCityDesignPersistenceSnapshot,
} from '../logic/cityDesignChangeRequestDiff';
import { getCityDesignOriginFromAmendmentLocation } from '../logic/cityDesignAmendmentLocation';
import {
  getCityDesignOsmLayerVisibility,
  isCityDesignFallbackSnapshot,
} from '../logic/cityDesignOsm';
import { useCityDesignEditorState } from './useCityDesignEditorState';
import { serverConfirmed, waitForClientApply } from '@/zero/mutate-with-server-check';
import { gatedToast as toast } from '@/features/notifications/utils/gated-toast';
import { usePermissions } from '@/zero/rbac/usePermissions';
import { formatCityDesignSelectionAddress } from '../logic/cityDesignSelectionAddress';
import { useCityDesignRemoteCursors } from './useCityDesignRemoteCursors';
import { usePreferenceState } from '@/zero/preferences/usePreferenceState';
import {
  APP_TUTORIAL_OSM_LOAD_FAILED_ACTION,
  reportAppTutorialAction,
} from '@/features/app-tutorial/events';
import {
  APP_TUTORIAL_CITY_DESIGN_ADDRESS,
  APP_TUTORIAL_CITY_DESIGN_CENTER,
  APP_TUTORIAL_CITY_DESIGN_MAP_SELECTION,
  createAppTutorialOsmSnapshot,
} from '@/features/app-tutorial/city-design-fixture';

const OSM_LOAD_ERROR_TOAST_ID = 'city-design-osm-load-error';

function originFromCenter(center: CityDesignGeoPoint, label?: string): CityDesignOrigin {
  return {
    ...center,
    ...(label ? { label } : {}),
  };
}

function isSameCenter(left: CityDesignGeoPoint, right: CityDesignGeoPoint) {
  return left.lat === right.lat && left.lon === right.lon;
}

export function useCityDesignPageController(amendmentId: string) {
  const { user } = useAuth();
  const { displayCurrency, isLoading: isPreferenceLoading } = usePreferenceState();
  const initialDesignCurrencyRef = useRef<string | null>(null);
  if (!isPreferenceLoading && initialDesignCurrencyRef.current === null) {
    initialDesignCurrencyRef.current = displayCurrency;
  }
  const { user: userRecord } = useUserState({ userId: user?.id });
  const {
    amendment,
    amendmentDocsCollabs,
    amendmentProcess,
    documents,
    changeRequestsWithVotes,
    collaborators,
    primaryCityDesign,
    isLoading,
  } = useAmendmentState({
    amendmentId,
    userId: user?.id,
    includeDocsAndCollabs: true,
    includeProcessData: true,
    includeDocuments: true,
    includeChangeRequestsWithVotes: true,
    includeCityDesign: true,
  });
  const {
    createCityDesignChangeRequests,
    createCityDesign,
    finalizeInternalChangeRequestVote,
    updateAmendment,
    updateChangeRequest,
    updateProcessBranch,
    updateCityDesign,
    voteOnChangeRequest,
  } = useAmendmentActions();
  const { updateDocument } = useDocumentActions();
  const amendmentLocationOrigin = useMemo(
    () => getCityDesignOriginFromAmendmentLocation(amendment),
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
      parseStoredCityDesignState(primaryCityDesign?.design_state) ??
      createEmptyCityDesignState(
        amendmentLocationOrigin ?? undefined,
        initialDesignCurrencyRef.current ?? 'EUR'
      ),
    [amendmentLocationOrigin, isPreferenceLoading, primaryCityDesign?.design_state]
  );
  const editor = useCityDesignEditorState(persistedDesign);
  const [isLoadingOsm, setIsLoadingOsm] = useState(false);
  const [osmError, setOsmError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [changeRequestColorMode, setChangeRequestColorMode] =
    useState<CityDesignChangeRequestColorMode>('natural');

  useEffect(() => {
    editor.replaceDesign(persistedDesign, false);
  }, [editor.replaceDesign, persistedDesign]);

  useEffect(() => {
    if (
      amendment?.tutorial_run_id &&
      editor.state.isDirty &&
      editor.design.objects.some(
        object => object.type === 'tree' && object.geometry.kind === 'path_corridor'
      )
    ) {
      reportAppTutorialAction({
        type: 'mutation',
        event: 'city-design.tree-row-added',
      });
    }
  }, [amendment?.tutorial_run_id, editor.design.objects, editor.state.isDirty]);

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
  const selectedBranchStepRuns =
    (
      selectedProcessBranch as
        | {
            step_runs?: readonly {
              event_id?: string | null;
              status?: string | null;
            }[];
          }
        | null
        | undefined
    )?.step_runs ?? [];
  const currentProcessEventId =
    selectedBranchStepRuns.find(
      step =>
        Boolean(step.event_id) &&
        !['approved', 'rejected', 'merged', 'withdrawn', 'completed'].includes(step.status ?? '')
    )?.event_id ??
    selectedBranchStepRuns.find(step => Boolean(step.event_id))?.event_id ??
    amendmentProcess?.event_id ??
    amendment?.event_id ??
    undefined;
  const eventPermissions = usePermissions({ eventId: currentProcessEventId ?? undefined });
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
  const cityDesignAccess = useMemo(
    () =>
      getCityDesignAccess({
        amendment: amendmentModeContext,
        hasDocumentModeTarget: Boolean(primaryDocument?.id),
        hasProcessBranch,
        selectedProcessBranch,
        userId: user?.id,
        hasActiveEventVotingRight: eventPermissions.canVote(),
      }),
    [
      amendmentModeContext,
      eventPermissions,
      hasProcessBranch,
      primaryDocument?.id,
      selectedProcessBranch,
      user?.id,
    ]
  );
  const branchAllowsDesignMutation =
    !hasProcessBranch ||
    (Boolean(selectedProcessBranch?.id) && isBranchEditable(selectedProcessBranch));
  const canMutateDesign =
    branchAllowsDesignMutation &&
    ((mode === 'edit' && cityDesignAccess.canEditDirectly) ||
      (mode === 'suggest_internal' && cityDesignAccess.canSuggestInternally) ||
      (mode === 'suggest_event' && cityDesignAccess.canSuggestInEvent));
  const canEditMapContext =
    branchAllowsDesignMutation && mode === 'edit' && cityDesignAccess.canEditDirectly;
  const readOnly = !canMutateDesign;
  const canVoteOnStreetChangeRequests = cityDesignAccess.canEdit && isVotingMode(mode);
  const canFinalizeStreetChangeRequests = cityDesignAccess.canEdit && mode === 'vote_internal';
  const canEdit = cityDesignAccess.canEdit;
  const canChangeMode = cityDesignAccess.canChangeMode;
  const collaborationDocumentId =
    selectedProcessBranch?.document_id ?? primaryDocument?.id ?? amendment?.document_id ?? null;
  const currentUserName =
    [userRecord?.first_name, userRecord?.last_name].filter(Boolean).join(' ').trim() ||
    userRecord?.email ||
    user?.email ||
    'Anonymous';
  const editorCollaborators = useMemo(
    () => mapCityDesignCollaborators(collaborators, amendment?.created_by),
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
  const presenceEntityId = `city-design:${primaryCityDesign?.id ?? amendmentId}`;
  const { onlinePeers, userColor } = useEditorPresence({
    entityId: presenceEntityId,
    userId: user?.id,
    userName: currentUserName,
    userAvatar: userRecord?.avatar ?? undefined,
    userColorByUserId: presenceColorByUserId,
    enabled: Boolean(user?.id),
  });
  const onlinePeerMap = useMemo(() => {
    return new Map(onlinePeers.map(peer => [peer.userId, peer]));
  }, [onlinePeers]);
  const { remoteCursors, activeCursorUserIds, broadcastCursor } = useCityDesignRemoteCursors({
    entityId: presenceEntityId,
    userId: user?.id,
    userName: currentUserName,
    userColor,
    enabled: Boolean(user?.id),
  });
  const streetChangeRequests = useMemo(
    () =>
      getCityDesignChangeRequests(
        (changeRequestsWithVotes.length > 0
          ? changeRequestsWithVotes
          : amendment?.change_requests) as readonly CityDesignChangeRequest[] | null | undefined
      ),
    [amendment?.change_requests, changeRequestsWithVotes]
  );
  const visibleStreetChangeRequests = useMemo(
    () => streetChangeRequests.filter(isOpenCityDesignChangeRequest),
    [streetChangeRequests]
  );
  const cityDesignDiscussions = useMemo(
    () =>
      getCityDesignDiscussionArray(
        selectedProcessBranch?.id
          ? (selectedProcessBranch as { discussions?: unknown }).discussions
          : (amendment as { discussions?: unknown } | null | undefined)?.discussions
      ),
    [amendment, selectedProcessBranch]
  );

  const selectedMapSelection = useMemo<CityDesignMapSelection>(
    () =>
      editor.design.mapSelection ??
      createCityDesignMapSelectionFromBbox(
        editor.design.osmSnapshot?.bbox ??
          getCityDesignMapSelectionBoundingBox(
            createCityDesignMapSelectionFromCenterRadius(editor.design.origin)
          )
      ),
    [editor.design.mapSelection, editor.design.origin, editor.design.osmSnapshot?.bbox]
  );
  const selectedCenter = selectedMapSelection.center;
  const selectionAddressLabel = formatCityDesignSelectionAddress(
    editor.design.selectionAddress,
    editor.design.origin.label ?? amendmentLocationOrigin?.label,
    selectedCenter
  );
  const selectedBbox = useMemo(
    () => getCityDesignMapSelectionBoundingBox(selectedMapSelection),
    [selectedMapSelection]
  );
  const placementDraft = editor.state.placementDraft;
  const placementPreview = placementDraft?.preview ?? null;
  const canFinishPathPlacement =
    placementDraft?.mode === 'path' && placementDraft.points.length >= 2;
  const osmLayerVisibility = getCityDesignOsmLayerVisibility(editor.design.osmLayerVisibility);
  const showStreetMarkings = editor.design.showStreetMarkings ?? true;

  const handleSelectedMapSelectionChange = useCallback(
    (selection: CityDesignMapSelection) => {
      if (!canEditMapContext) return;
      const keepAddress = isSameCenter(selectedMapSelection.center, selection.center);
      editor.updateMapContext(
        selection,
        keepAddress ? editor.design.selectionAddress : undefined,
        true
      );
    },
    [canEditMapContext, editor, selectedMapSelection.center]
  );

  const handleSelectionAddressChange = useCallback(
    (address?: CityDesignSelectionAddress) => {
      if (!canEditMapContext) return;
      editor.updateSelectionAddress(address);
    },
    [canEditMapContext, editor]
  );

  const handleHideOsmWay = useCallback(
    (osmWayId: string) => {
      if (!canEditMapContext) return;
      editor.hideOsmWay(osmWayId);
    },
    [canEditMapContext, editor]
  );

  const handleLoadOsm = useCallback(async () => {
    if (!canEditMapContext) return;

    setIsLoadingOsm(true);
    setOsmError(null);

    try {
      const isTutorialLoad = Boolean(amendment?.tutorial_run_id);
      const snapshot = isTutorialLoad
        ? createAppTutorialOsmSnapshot()
        : await overpassStreetSceneFn({ data: { bbox: selectedBbox } });

      if (!isTutorialLoad && isCityDesignFallbackSnapshot(snapshot)) {
        throw new Error(translateText('features.amendments.cityDesign.errors.loadOsmFailed'));
      }

      const loadedCenter = isTutorialLoad ? APP_TUTORIAL_CITY_DESIGN_CENTER : selectedCenter;
      const loadedSelection = isTutorialLoad
        ? {
            ...APP_TUTORIAL_CITY_DESIGN_MAP_SELECTION,
            center: { ...APP_TUTORIAL_CITY_DESIGN_CENTER },
          }
        : selectedMapSelection;
      const loadedAddressLabel = isTutorialLoad
        ? APP_TUTORIAL_CITY_DESIGN_ADDRESS.formatted
        : selectionAddressLabel;

      editor.replaceDesign(
        {
          ...editor.design,
          origin: originFromCenter(loadedCenter, loadedAddressLabel),
          mapSelection: loadedSelection,
          ...(isTutorialLoad ? { selectionAddress: { ...APP_TUTORIAL_CITY_DESIGN_ADDRESS } } : {}),
          osmLayerVisibility: getCityDesignOsmLayerVisibility(editor.design.osmLayerVisibility),
          hiddenOsmWayIds: [],
          hiddenOsmFeatureIds: [],
          osmSnapshot: snapshot,
          comparisonMode: 'overlay',
        },
        true
      );
      if (isTutorialLoad) {
        reportAppTutorialAction({
          type: 'action',
          event: 'city-design.osm-loaded',
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : translateText('features.amendments.cityDesign.errors.loadOsmFailed');
      setOsmError(errorMessage);
      toast.error(errorMessage, {
        id: OSM_LOAD_ERROR_TOAST_ID,
        testId: 'city-design-osm-load-error-toast',
      });
      if (amendment?.tutorial_run_id) {
        reportAppTutorialAction({
          type: 'action',
          event: APP_TUTORIAL_OSM_LOAD_FAILED_ACTION,
        });
      }
    } finally {
      setIsLoadingOsm(false);
    }
  }, [
    amendment?.tutorial_run_id,
    canEditMapContext,
    editor,
    selectedBbox,
    selectedCenter,
    selectedMapSelection,
    selectionAddressLabel,
  ]);

  const designForPersistence = useMemo(
    () => ({
      ...editor.design,
      comparisonMode: persistedDesign.comparisonMode,
      osmLayerVisibility: persistedDesign.osmLayerVisibility,
      showStreetMarkings: persistedDesign.showStreetMarkings,
    }),
    [editor.design, persistedDesign]
  );

  const handleSave = useCallback(async () => {
    if (readOnly) return;

    setIsSaving(true);
    setSaveError(null);

    const title = amendment?.title
      ? translateText('features.amendments.cityDesign.savedTitleWithAmendment', {
          title: amendment.title,
        })
      : translateText('features.amendments.cityDesign.defaultTitle');

    try {
      if (isSuggestingMode(mode)) {
        const changeRequestPayloads = createCityDesignChangeRequestPayloads({
          amendmentId,
          processBranchId: selectedProcessBranch?.id ?? null,
          cityDesignId: primaryCityDesign?.id ?? null,
          baseDesign: persistedDesign,
          draftDesign: designForPersistence,
        });

        if (changeRequestPayloads.length === 0) {
          return;
        }

        const result = createCityDesignChangeRequests({
          amendment_id: amendmentId,
          process_branch_id: selectedProcessBranch?.id ?? null,
          requests: changeRequestPayloads,
        } as unknown as Parameters<typeof createCityDesignChangeRequests>[0]);
        await waitForClientApply(result);
        await serverConfirmed(result);

        editor.replaceDesign(persistedDesign, false);
        toast.success(translateText('features.amendments.toasts.changeRequestCreated'));
        if (amendment?.tutorial_run_id) {
          reportAppTutorialAction({
            type: 'mutation',
            event: 'city-design.saved',
          });
        }
        return;
      }

      const persistence = createCityDesignPersistenceSnapshot(designForPersistence);
      const payload = {
        amendment_id: amendmentId,
        title,
        bbox: persistence.bbox,
        center_lat: persistence.center_lat,
        center_lon: persistence.center_lon,
        osm_snapshot: persistence.osm_snapshot,
        design_state: persistence.design_state,
        currency: persistence.currency,
        estimated_total_cost_minor: persistence.estimated_total_cost_minor,
        cost_catalog_version: persistence.cost_catalog_version,
        cost_summary: persistence.cost_summary,
      };

      if (primaryCityDesign?.id) {
        const result = updateCityDesign({
          id: primaryCityDesign.id,
          process_branch_id: selectedProcessBranch?.id ?? null,
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
        await waitForClientApply(result);
        await serverConfirmed(result);
      } else {
        const result = createCityDesign({
          id: crypto.randomUUID(),
          process_branch_id: selectedProcessBranch?.id ?? null,
          ...payload,
        });
        await waitForClientApply(result);
        await serverConfirmed(result);
      }

      editor.replaceDesign(designForPersistence, false);
      if (amendment?.tutorial_run_id) {
        reportAppTutorialAction({
          type: 'mutation',
          event: 'city-design.saved',
        });
      }
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : translateText('features.amendments.cityDesign.errors.saveFailed')
      );
    } finally {
      setIsSaving(false);
    }
  }, [
    amendment?.title,
    amendment?.tutorial_run_id,
    amendmentId,
    createCityDesignChangeRequests,
    createCityDesign,
    designForPersistence,
    editor,
    mode,
    persistedDesign,
    primaryCityDesign?.id,
    readOnly,
    selectedProcessBranch?.id,
    updateCityDesign,
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

  const handleChangeRequestVote = useCallback(
    async (changeRequestId: string, vote: 'accept' | 'reject' | 'abstain') => {
      if (!canVoteOnStreetChangeRequests) return;

      await voteOnChangeRequest({
        id: crypto.randomUUID(),
        change_request_id: changeRequestId,
        vote,
      });
    },
    [canVoteOnStreetChangeRequests, voteOnChangeRequest]
  );

  const handleChangeRequestTitleChange = useCallback(
    async (changeRequestId: string, title: string) => {
      await Promise.resolve(
        updateChangeRequest({
          id: changeRequestId,
          title: title.trim() || null,
        })
      );
    },
    [updateChangeRequest]
  );

  const handleFinalizeStreetChangeRequestVote = useCallback(
    async (changeRequestId: string) => {
      if (!canFinalizeStreetChangeRequests) return;

      await Promise.resolve(
        finalizeInternalChangeRequestVote({
          change_request_id: changeRequestId,
        })
      );
    },
    [canFinalizeStreetChangeRequests, finalizeInternalChangeRequestVote]
  );

  const handleChangeRequestCommentSubmit = useCallback(
    async (changeRequestId: string, text: string) => {
      const trimmedText = text.trim();
      if (!trimmedText || !user?.id) return;

      const changeRequest =
        streetChangeRequests.find(request => request.id === changeRequestId) ??
        ({
          id: changeRequestId,
        } as CityDesignChangeRequest);
      const discussionId = getCityDesignChangeRequestDiscussionId(changeRequest);
      const now = new Date().toISOString();
      const comment = {
        id: crypto.randomUUID(),
        contentRich: [{ type: 'p', children: [{ text: trimmedText }] }],
        createdAt: now,
        discussionId,
        isEdited: false,
        userId: user.id,
      };
      const discussionExists = cityDesignDiscussions.some(
        discussion => discussion.id === discussionId
      );
      const nextDiscussions = discussionExists
        ? cityDesignDiscussions.map(discussion =>
            discussion.id === discussionId
              ? {
                  ...discussion,
                  comments: [...(discussion.comments ?? []), comment],
                }
              : discussion
          )
        : [
            ...cityDesignDiscussions,
            {
              id: discussionId,
              comments: [comment],
              createdAt: now,
              isResolved: false,
              userId: user.id,
              title: formatCityDesignChangeRequestTitle(changeRequest),
              crId: formatCityDesignChangeRequestIdentifier(changeRequest),
              displayCrId: formatCityDesignChangeRequestIdentifier(changeRequest),
              changeRequestEntityId: changeRequest.id,
              changeRequestStatus: changeRequest.status ?? null,
              processBranchId: selectedProcessBranch?.id ?? null,
            },
          ];
      const serializedDiscussions = JSON.parse(JSON.stringify(nextDiscussions));

      if (selectedProcessBranch?.id) {
        await Promise.resolve(
          updateProcessBranch({
            id: selectedProcessBranch.id,
            discussions: serializedDiscussions,
          })
        );
        return;
      }

      await Promise.resolve(
        updateAmendment({
          id: amendmentId,
          discussions: serializedDiscussions,
        })
      );
    },
    [
      amendmentId,
      selectedProcessBranch?.id,
      streetChangeRequests,
      cityDesignDiscussions,
      updateAmendment,
      updateProcessBranch,
      user?.id,
    ]
  );

  return {
    activeCursorUserIds,
    amendment,
    amendmentId,
    isLoading: isLoading || isPreferenceLoading,
    showActionBars: Boolean(user),
    canEdit,
    canChangeMode,
    canVoteOnStreetChangeRequests,
    canFinalizeStreetChangeRequests,
    collaborationDocumentId,
    currentUserId: user?.id,
    currentUserAvatarUrl: userRecord?.avatar,
    currentUserDisplayName: currentUserName,
    editorCollaborators,
    existingCollaboratorIds,
    mode,
    modeDisabledReasons,
    onModeChange: handleModeChange,
    onChangeRequestVote: handleChangeRequestVote,
    onChangeRequestTitleChange: handleChangeRequestTitleChange,
    onChangeRequestFinalize: handleFinalizeStreetChangeRequestVote,
    onChangeRequestCommentSubmit: handleChangeRequestCommentSubmit,
    onlinePeerMap,
    presenceColorByUserId,
    remoteCursors,
    broadcastCursor,
    readOnly,
    canEditMapContext,
    selectedCenter,
    selectedBbox,
    selectedMapSelection,
    selectionAddress: editor.design.selectionAddress,
    selectionAddressLabel,
    placementPreview,
    placementPreviewType: placementDraft?.type ?? null,
    placementStart: placementDraft?.start ?? null,
    placementMode: placementDraft?.mode ?? null,
    placementPointCount: placementDraft?.points.length ?? 0,
    canFinishPathPlacement,
    osmLayerVisibility,
    showStreetMarkings,
    onSelectedMapSelectionChange: handleSelectedMapSelectionChange,
    onSelectionAddressChange: handleSelectionAddressChange,
    isLoadingOsm,
    osmError,
    onLoadOsm: handleLoadOsm,
    isSaving,
    saveError,
    changeRequestColorMode,
    onChangeRequestColorModeChange: setChangeRequestColorMode,
    onSave: handleSave,
    costCatalogCurrency: editor.design.currency,
    allStreetChangeRequests: streetChangeRequests,
    streetChangeRequests: visibleStreetChangeRequests,
    cityDesignDiscussions,
    userColor,
    ...editor,
    hideOsmWay: handleHideOsmWay,
  };
}

interface CityDesignDiscussion {
  id: string;
  comments?: readonly CityDesignCommentLike[] | null;
  [key: string]: unknown;
}

interface CityDesignCommentLike {
  id?: string | null;
  contentRich?: unknown;
  createdAt?: string | number | Date | null;
  discussionId?: string | null;
  isEdited?: boolean | null;
  userId?: string | null;
  user_id?: string | null;
}

function getCityDesignDiscussionArray(value: unknown): CityDesignDiscussion[] {
  return Array.isArray(value) ? (value as CityDesignDiscussion[]) : [];
}

function mapCityDesignCollaborators(
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
      getString(userRecord?.name) ||
      [firstName, lastName].filter(Boolean).join(' ').trim() ||
      getString(userRecord?.email) ||
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

export const cityDesignPageControllerInternals = {
  originFromCenter,
  isSameCenter,
  getCityDesignDiscussionArray,
  mapCityDesignCollaborators,
  normalizeCollaboratorStatus,
  asRecord,
  getString,
};
