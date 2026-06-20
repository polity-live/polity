'use client';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { toast } from '@/features/shared/ui/ui/sonner';
import { useAmendmentActions } from '@/zero/amendments/useAmendmentActions';
import { useAmendmentState } from '@/zero/amendments/useAmendmentState';
import { useCommonState, useCommonActions } from '@/zero/common';
import type { EditingMode } from '@/zero/rbac/workflow-constants';
import { type Visibility } from '@/features/auth/logic/checkEntityAccess';
import { AMENDMENT_EDITING_MODE_ORDER, normalizeEditingMode } from '@/zero/rbac/workflow-constants';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { createTimelineEvent } from '@/features/timeline/utils/createTimelineEvent';
import { getEditingModeOption, type SelectableEditingMode } from '@/features/shared/ui/status';
import { deriveControllingEventForSettings } from '@/features/amendments/logic/amendmentSettingsEventPhase';
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

  const { updateAmendment, createAmendment } = useAmendmentActions();

  const commonActions = useCommonActions();

  const { amendmentHashtags, allHashtags } = useCommonState({
    amendment_id: amendmentId,
    loadAllHashtags: true,
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
  });

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
        workflowStatus: normalizeEditingMode(amendment.editing_mode),
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
      });
    }
  }, [amendment]);

  useEffect(() => {
    if (!amendment || !initializedRef.current) return;

    const workflowStatus = normalizeEditingMode(amendment.editing_mode);

    setFormData(prev =>
      prev.workflowStatus === workflowStatus ? prev : { ...prev, workflowStatus }
    );
  }, [amendment?.editing_mode]);

  const handleWorkflowStatusChange = useCallback(
    async (value: SelectableEditingMode) => {
      if (value === formData.workflowStatus) return;

      const previousWorkflowStatus = formData.workflowStatus;
      console.info('[AmendmentEditContent] Changing workflow status from settings', {
        amendmentId,
        newMode: value,
        previousMode: previousWorkflowStatus,
      });
      setFormData(prev => ({ ...prev, workflowStatus: value as EditingMode }));

      if (isCreating || !amendment) {
        return;
      }

      try {
        await updateAmendment({
          id: amendmentId,
          editing_mode: value,
          internal_cr_voting_close_trigger: formData.internalCRVotingCloseTrigger,
          internal_cr_voting_duration_minutes:
            formData.internalCRVotingCloseTrigger === 'after_minutes'
              ? formData.internalCRVotingDurationMinutes
              : null,
          internal_cr_resolution_visibility: formData.internalCRResolutionVisibility,
        });
        console.info('[AmendmentEditContent] Workflow status persisted from settings', {
          amendmentId,
          newMode: value,
          previousMode: previousWorkflowStatus,
        });
      } catch (error) {
        setFormData(prev => ({ ...prev, workflowStatus: previousWorkflowStatus }));
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
      updateAmendment,
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
        await createAmendment({
          id: amendmentId,
          title: formData.title || null,
          code: formData.code || null,
          editing_mode: formData.workflowStatus || null,
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
          x: null,
          youtube: null,
          linkedin: null,
          website: null,
        });
      } else {
        if (!amendment) {
          toast.error(t('features.amendments.editContent.updateFailed'));
          return;
        }
        await updateAmendment({
          id: amendmentId,
          title: formData.title,
          code: formData.code,
          editing_mode: formData.workflowStatus,
          internal_cr_voting_close_trigger: formData.internalCRVotingCloseTrigger,
          internal_cr_voting_duration_minutes:
            formData.internalCRVotingCloseTrigger === 'after_minutes'
              ? formData.internalCRVotingDurationMinutes
              : null,
          internal_cr_resolution_visibility: formData.internalCRResolutionVisibility,
          visibility: formData.visibility,
          tags: formData.hashtags,
          image_url: formData.imageURL || null,
        });
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
    controllingEvent,
    isSubmitting,
    setIsSubmitting,
    showReview,
    setShowReview,
    formRef,
    initializedRef,
    hashtagsInitializedRef,
    handleWorkflowStatusChange,
    handleRemoveImage,
    handleSubmit,
    onFormSubmit,
    confirmCreate,
  };
}
