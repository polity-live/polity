'use client';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { toast } from '@/features/shared/ui/ui/sonner';
import { useAmendmentActions } from '@/zero/amendments/useAmendmentActions';
import { useAmendmentState } from '@/zero/amendments/useAmendmentState';
import { useDocumentActions } from '@/zero/documents/useDocumentActions';
import { useDocumentState } from '@/zero/documents/useDocumentState';
import { useCommonState, useCommonActions } from '@/zero/common';
import { waitForClientApply } from '@/zero/mutate-with-server-check';
import { type Visibility } from '@/features/auth/logic/checkEntityAccess';
import {
  AMENDMENT_EDITING_MODE_ORDER,
  normalizeEditingMode,
  type EditingMode,
} from '@/zero/amendments/editing-mode-policy';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { createTimelineEvent } from '@/features/timeline/utils/createTimelineEvent';
import { getEditingModeOption, type SelectableEditingMode } from '@/features/shared/ui/status';
import { deriveControllingEventForSettings } from '@/features/amendments/logic/amendmentSettingsEventPhase';
import { formatLocation } from '@/features/shared/logic/locationHelpers';
import type { GeoCoordinates } from '@/features/shared/logic/geoCoordinates';
import type { GeoAddressField } from '@/features/shared/ui/form/GeoAddressInputField';
import {
  getBranchEditingModeDisabledReasons,
  getBranchEditingMode,
  getBranchPathLabel,
  getOrderedBranches,
  isBranchEditable,
  resolveSelectedBranchId,
} from '@/features/amendments/logic/amendmentBranchDisplay';
type InternalCRVotingCloseTrigger = 'all_collaborators_voted' | 'after_minutes';
type InternalCRResolutionVisibility = 'public' | 'collaborators';

const DEFAULT_INTERNAL_CR_VOTING_CLOSE_TRIGGER: InternalCRVotingCloseTrigger =
  'all_collaborators_voted';
const DEFAULT_INTERNAL_CR_VOTING_DURATION_MINUTES = 5;
const DEFAULT_INTERNAL_CR_RESOLUTION_VISIBILITY: InternalCRResolutionVisibility = 'public';

function normalizeInternalCRVotingCloseTrigger(
  value: string | null | undefined
): InternalCRVotingCloseTrigger {
  return value === 'after_minutes' ? 'after_minutes' : DEFAULT_INTERNAL_CR_VOTING_CLOSE_TRIGGER;
}

function normalizeInternalCRResolutionVisibility(
  value: string | null | undefined
): InternalCRResolutionVisibility {
  return value === 'collaborators' ? 'collaborators' : DEFAULT_INTERNAL_CR_RESOLUTION_VISIBILITY;
}

interface AmendmentEditContentProps {
  amendmentId: string;
  amendment: ReturnType<typeof useAmendmentState>['amendment'];
  amendmentProcess?: ReturnType<typeof useAmendmentState>['amendmentProcess'];
  currentUserId: string;
  isLoading: boolean;
  mode?: 'create' | 'edit';
  agendaItemId?: string;
}

export function useAmendmentEditContentController({
  amendmentId,
  amendment,
  amendmentProcess,
  currentUserId,
  isLoading,
  mode,
  agendaItemId,
}: AmendmentEditContentProps) {
  const isCreating = mode === 'create' || !amendment;

  const navigate = useNavigate();

  const { t } = useTranslation();

  const { updateAmendment, createAmendment, updateProcessBranch } = useAmendmentActions();
  const { updateDocument } = useDocumentActions();

  const commonActions = useCommonActions();

  const { amendmentHashtags, allHashtags } = useCommonState({
    amendment_id: amendmentId,
    loadAllHashtags: true,
  });
  const amendmentDocumentId = amendment?.document_id ?? null;
  const { document: amendmentDocument } = useDocumentState({
    documentId: amendmentDocumentId ?? undefined,
  });

  const [formData, setFormData] = useState({
    title: '',
    subtitle: '',
    code: '',
    imageURL: '',
    videoURL: '',
    videoThumbnailURL: '',
    workflowStatus: 'edit' as EditingMode,
    internalCRVotingCloseTrigger:
      DEFAULT_INTERNAL_CR_VOTING_CLOSE_TRIGGER as InternalCRVotingCloseTrigger,
    internalCRVotingDurationMinutes: DEFAULT_INTERNAL_CR_VOTING_DURATION_MINUTES,
    internalCRResolutionVisibility: DEFAULT_INTERNAL_CR_RESOLUTION_VISIBILITY,
    visibility: 'public' as Visibility,
    hashtags: [] as string[],
    country: '',
    region: '',
    post_code: '',
    city: '',
    street: '',
    house_number: '',
    latitude: null as number | null,
    longitude: null as number | null,
  });

  const workflowBranches = useMemo(
    () => getOrderedBranches(amendmentProcess?.current_process_run?.branches ?? []),
    [amendmentProcess?.current_process_run?.branches]
  );
  const activeWorkflowBranchId = amendmentProcess?.current_process_run?.active_branch_id ?? null;
  const [selectedWorkflowBranchId, setSelectedWorkflowBranchId] = useState<string | null>(null);
  const [pendingWorkflowMode, setPendingWorkflowMode] = useState<{
    branchId: string;
    mode: EditingMode;
  } | null>(null);
  const selectedWorkflowBranch = useMemo(
    () => workflowBranches.find(branch => branch.id === selectedWorkflowBranchId) ?? null,
    [selectedWorkflowBranchId, workflowBranches]
  );
  const workflowModeSourceKey = selectedWorkflowBranchId
    ? `branch:${selectedWorkflowBranchId}`
    : amendmentDocumentId
      ? `document:${amendmentDocumentId}`
      : null;
  const workflowSourceMode = selectedWorkflowBranch
    ? getBranchEditingMode(selectedWorkflowBranch)
    : normalizeEditingMode(amendmentDocument?.editing_mode);
  const selectedWorkflowBranchEditable =
    isCreating ||
    (selectedWorkflowBranch
      ? isBranchEditable(selectedWorkflowBranch)
      : Boolean(amendmentDocumentId));
  const workflowBranchOptions = useMemo(
    () =>
      workflowBranches.map(branch => ({
        id: branch.id,
        label: getBranchPathLabel(branch),
        editingMode: getBranchEditingMode(branch),
      })),
    [workflowBranches]
  );
  const selectedWorkflowBranchLabel = selectedWorkflowBranch
    ? getBranchPathLabel(selectedWorkflowBranch)
    : null;
  const workflowModeDisabledReasons = useMemo(
    () =>
      selectedWorkflowBranch ? getBranchEditingModeDisabledReasons(selectedWorkflowBranch) : {},
    [selectedWorkflowBranch]
  );

  const workflowStatusOption = getEditingModeOption(formData.workflowStatus, t);
  const controllingEvent = useMemo(() => {
    const event = deriveControllingEventForSettings(amendmentProcess, formData.workflowStatus);
    if (!event) return null;

    return {
      ...event,
      title: event.title ?? t('features.amendments.editContent.eventFallback'),
    };
  }, [amendmentProcess, formData.workflowStatus, t]);

  const workflowMenuValue = (
    (AMENDMENT_EDITING_MODE_ORDER as readonly EditingMode[]).includes(formData.workflowStatus)
      ? formData.workflowStatus
      : 'view'
  ) as SelectableEditingMode;

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showReview, setShowReview] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);

  const initializedRef = useRef(false);

  const hashtagsInitializedRef = useRef(false);

  // Initialize hashtags from junction data once available
  useEffect(() => {
    if (amendmentHashtags && amendmentHashtags.length > 0 && !hashtagsInitializedRef.current) {
      hashtagsInitializedRef.current = true;
      const tags = amendmentHashtags.map(j => j.hashtag?.tag).filter((t): t is string => !!t);
      setFormData(prev => ({ ...prev, hashtags: tags }));
    }
  }, [amendmentHashtags]);

  useEffect(() => {
    if (amendment && !initializedRef.current) {
      initializedRef.current = true;
      setFormData({
        title: amendment.title || '',
        subtitle: '',
        code: amendment.code || '',
        imageURL: amendment.image_url || '',
        videoURL: '',
        videoThumbnailURL: '',
        workflowStatus: workflowSourceMode,
        internalCRVotingCloseTrigger: normalizeInternalCRVotingCloseTrigger(
          amendment.internal_cr_voting_close_trigger
        ),
        internalCRVotingDurationMinutes:
          amendment.internal_cr_voting_duration_minutes ??
          DEFAULT_INTERNAL_CR_VOTING_DURATION_MINUTES,
        internalCRResolutionVisibility: normalizeInternalCRResolutionVisibility(
          amendment.internal_cr_resolution_visibility
        ),
        visibility: (amendment.visibility as Visibility) ?? 'public',
        hashtags: amendmentHashtags
          ? amendmentHashtags.map(j => j.hashtag?.tag).filter((t): t is string => !!t)
          : Array.isArray(amendment.tags)
            ? amendment.tags
            : [],
        country: amendment.country ?? '',
        region: amendment.region ?? '',
        post_code: amendment.post_code ?? '',
        city: amendment.city ?? '',
        street: amendment.street ?? '',
        house_number: amendment.house_number ?? '',
        latitude: amendment.latitude ?? null,
        longitude: amendment.longitude ?? null,
      });
    }
  }, [amendment, workflowSourceMode]);

  useEffect(() => {
    if (!amendment || !initializedRef.current) return;

    if (pendingWorkflowMode?.branchId === workflowModeSourceKey) {
      if (workflowSourceMode === pendingWorkflowMode.mode) {
        setPendingWorkflowMode(null);
      } else {
        return;
      }
    }

    setFormData(prev =>
      prev.workflowStatus === workflowSourceMode
        ? prev
        : { ...prev, workflowStatus: workflowSourceMode }
    );
  }, [amendment?.id, pendingWorkflowMode, workflowModeSourceKey, workflowSourceMode]);

  useEffect(() => {
    if (workflowBranches.length === 0) {
      if (selectedWorkflowBranchId !== null) {
        setSelectedWorkflowBranchId(null);
      }
      return;
    }

    const nextBranchId = resolveSelectedBranchId({
      branches: workflowBranches,
      requestedBranchId: selectedWorkflowBranchId,
      activeBranchId: activeWorkflowBranchId,
    });

    if (nextBranchId !== selectedWorkflowBranchId) {
      setSelectedWorkflowBranchId(nextBranchId);
    }
  }, [activeWorkflowBranchId, selectedWorkflowBranchId, workflowBranches]);

  const handleWorkflowStatusChange = useCallback(
    async (value: SelectableEditingMode) => {
      if (value === formData.workflowStatus) return;

      const nextWorkflowStatus = value as EditingMode;
      const previousWorkflowStatus = formData.workflowStatus;
      console.info('[AmendmentEditContent] Changing workflow status from settings', {
        amendmentId,
        newMode: value,
        previousMode: previousWorkflowStatus,
      });
      setFormData(prev => ({ ...prev, workflowStatus: nextWorkflowStatus }));

      if (isCreating || !amendment) {
        return;
      }
      if (!selectedWorkflowBranchId && !amendmentDocumentId) {
        setFormData(prev => ({ ...prev, workflowStatus: previousWorkflowStatus }));
        toast.error(t('features.amendments.editContent.updateFailed'));
        return;
      }

      setPendingWorkflowMode({
        branchId: workflowModeSourceKey ?? 'unknown',
        mode: nextWorkflowStatus,
      });

      let modePersisted = false;
      try {
        if (selectedWorkflowBranchId) {
          await waitForClientApply(
            updateProcessBranch({
              id: selectedWorkflowBranchId,
              editing_mode: value,
            })
          );
        } else {
          await waitForClientApply(
            updateDocument({
              id: amendmentDocumentId as string,
              editing_mode: value,
            })
          );
        }
        modePersisted = true;
        await waitForClientApply(
          updateAmendment({
            id: amendmentId,
            internal_cr_voting_close_trigger: formData.internalCRVotingCloseTrigger,
            internal_cr_voting_duration_minutes:
              formData.internalCRVotingCloseTrigger === 'after_minutes'
                ? formData.internalCRVotingDurationMinutes
                : null,
            internal_cr_resolution_visibility: formData.internalCRResolutionVisibility,
          })
        );
        console.info('[AmendmentEditContent] Workflow status persisted from settings', {
          amendmentId,
          processBranchId: selectedWorkflowBranchId,
          documentId: selectedWorkflowBranchId ? undefined : amendmentDocumentId,
          newMode: value,
          previousMode: previousWorkflowStatus,
        });
      } catch (error) {
        if (!modePersisted) {
          setPendingWorkflowMode(current =>
            current?.branchId === workflowModeSourceKey ? null : current
          );
          setFormData(prev => ({ ...prev, workflowStatus: previousWorkflowStatus }));
        }
        console.error('[AmendmentEditContent] Failed to persist workflow status from settings', {
          amendmentId,
          newMode: value,
          previousMode: previousWorkflowStatus,
          error,
        });
      }
    },
    [
      amendment,
      amendmentId,
      formData.internalCRVotingCloseTrigger,
      formData.internalCRVotingDurationMinutes,
      formData.internalCRResolutionVisibility,
      formData.workflowStatus,
      isCreating,
      amendmentDocumentId,
      selectedWorkflowBranchId,
      updateAmendment,
      updateDocument,
      updateProcessBranch,
      workflowModeSourceKey,
    ]
  );

  const handleRemoveImage = useCallback(() => {
    if (isCreating) {
      return;
    }

    updateAmendment({
      id: amendmentId,
      image_url: null,
    });
  }, [amendmentId, isCreating, updateAmendment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (isCreating) {
        await waitForClientApply(
          createAmendment({
            id: amendmentId,
            title: formData.title || null,
            code: formData.code || null,
            reason: null,
            category: null,
            preamble: null,
            group_id: null,
            event_id: null,
            clone_source_id: null,
            document_id: null,
            tags: formData.hashtags.length > 0 ? formData.hashtags : null,
            visibility: formData.visibility,
            internal_cr_voting_close_trigger: formData.internalCRVotingCloseTrigger,
            internal_cr_voting_duration_minutes:
              formData.internalCRVotingCloseTrigger === 'after_minutes'
                ? formData.internalCRVotingDurationMinutes
                : null,
            internal_cr_resolution_visibility: formData.internalCRResolutionVisibility,
            discussions: null,
            image_url: formData.imageURL || null,
            country: formData.country || null,
            region: formData.region || null,
            post_code: formData.post_code || null,
            city: formData.city || null,
            street: formData.street || null,
            house_number: formData.house_number || null,
            latitude: formData.latitude,
            longitude: formData.longitude,
            x: null,
            youtube: null,
            linkedin: null,
            website: null,
          })
        );
      } else {
        if (!amendment) {
          toast.error(t('features.amendments.editContent.updateFailed'));
          return;
        }
        await waitForClientApply(
          updateAmendment({
            id: amendmentId,
            title: formData.title,
            code: formData.code,
            internal_cr_voting_close_trigger: formData.internalCRVotingCloseTrigger,
            internal_cr_voting_duration_minutes:
              formData.internalCRVotingCloseTrigger === 'after_minutes'
                ? formData.internalCRVotingDurationMinutes
                : null,
            internal_cr_resolution_visibility: formData.internalCRResolutionVisibility,
            visibility: formData.visibility,
            tags: formData.hashtags,
            image_url: formData.imageURL || null,
            country: formData.country || null,
            region: formData.region || null,
            post_code: formData.post_code || null,
            city: formData.city || null,
            street: formData.street || null,
            house_number: formData.house_number || null,
            latitude: formData.latitude,
            longitude: formData.longitude,
          })
        );
      }

      // Sync hashtags via junction tables
      await commonActions.syncEntityHashtags(
        'amendment',
        amendmentId,
        formData.hashtags,
        amendmentHashtags ?? [],
        allHashtags ?? []
      );

      // Only create timeline events for public amendments in edit mode
      if (!isCreating && amendment?.visibility === 'public') {
        if (formData.imageURL && formData.imageURL !== amendment.image_url) {
          await createTimelineEvent({
            data: {
              eventType: 'image_uploaded',
              entityType: 'amendment',
              entityId: amendmentId,
              actorId: currentUserId,
              title: t('features.timeline.imageUploadedTitle'),
              description: t('features.timeline.imageUploadedDescription', {
                title: formData.title,
              }),
              contentType: 'image',
              status: {},
            },
          });
        }
        if (formData.videoURL) {
          await createTimelineEvent({
            data: {
              eventType: 'video_uploaded',
              entityType: 'amendment',
              entityId: amendmentId,
              actorId: currentUserId,
              title: t('features.timeline.videoUploadedTitle'),
              description: t('features.timeline.videoUploadedDescription', {
                title: formData.title,
              }),
              contentType: 'video',
              status: {},
            },
          });
        }
      }
      toast.success(
        isCreating
          ? t('pages.create.success.created')
          : t('features.amendments.editContent.updateSuccess')
      );
      navigate({ to: `/amendment/${amendmentId}` });
    } catch (error) {
      toast.error(t('features.amendments.editContent.updateFailed'));
      console.error('Update error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const onFormSubmit = (e: React.FormEvent) => {
    if (isCreating && !showReview) {
      e.preventDefault();
      setShowReview(true);
      return;
    }
    handleSubmit(e);
  };

  const confirmCreate = () => {
    if (formRef.current) {
      formRef.current.requestSubmit();
    }
  };

  const handleLocationFieldChange = useCallback((field: GeoAddressField, value: string) => {
    setFormData(previousData => ({
      ...previousData,
      [field]: value,
    }));
  }, []);

  const handleLocationCoordinatesChange = useCallback((coordinates: GeoCoordinates | null) => {
    setFormData(previousData => ({
      ...previousData,
      latitude: coordinates?.latitude ?? null,
      longitude: coordinates?.longitude ?? null,
    }));
  }, []);

  const locationSummary = useMemo(
    () =>
      formatLocation({
        country: formData.country,
        region: formData.region,
        post_code: formData.post_code,
        city: formData.city,
        street: formData.street,
        house_number: formData.house_number,
      }),
    [
      formData.city,
      formData.country,
      formData.house_number,
      formData.post_code,
      formData.region,
      formData.street,
    ]
  );

  return {
    amendmentId,
    amendment,
    amendmentProcess,
    currentUserId,
    isLoading,
    mode,
    agendaItemId,
    isCreating,
    navigate,
    t,
    updateAmendment,
    createAmendment,
    commonActions,
    amendmentHashtags,
    allHashtags,
    formData,
    setFormData,
    workflowStatusOption,
    workflowMenuValue,
    workflowModeDisabledReasons,
    controllingEvent,
    workflowBranchOptions,
    selectedWorkflowBranchId,
    selectedWorkflowBranchLabel,
    selectedWorkflowBranchEditable,
    setSelectedWorkflowBranchId,
    isSubmitting,
    setIsSubmitting,
    showReview,
    setShowReview,
    formRef,
    initializedRef,
    hashtagsInitializedRef,
    handleWorkflowStatusChange,
    handleRemoveImage,
    handleLocationFieldChange,
    handleLocationCoordinatesChange,
    locationSummary,
    handleSubmit,
    onFormSubmit,
    confirmCreate,
  };
}
