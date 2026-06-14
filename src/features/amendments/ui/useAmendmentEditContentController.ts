'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { toast } from '@/features/shared/ui/ui/sonner';
import { useAmendmentActions } from '@/zero/amendments/useAmendmentActions';
import { useAmendmentState } from '@/zero/amendments/useAmendmentState';
import { useAgendaActions } from '@/zero/agendas/useAgendaActions';
import { useCommonState, useCommonActions } from '@/zero/common';
import type { EditingMode } from '@/zero/rbac/workflow-constants';
import { type Visibility } from '@/features/auth/logic/checkEntityAccess';
import { SELECTABLE_MODES, normalizeEditingMode } from '@/zero/rbac/workflow-constants';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { createTimelineEvent } from '@/features/timeline/utils/createTimelineEvent';
import { getEditingModeOption, type SelectableEditingMode } from '@/features/shared/ui/status';
interface AmendmentEditContentProps {
  amendmentId: string;
  amendment: ReturnType<typeof useAmendmentState>['amendment'];
  currentUserId: string;
  isLoading: boolean;
  mode?: 'create' | 'edit';
  agendaItemId?: string;
}

export function useAmendmentEditContentController({
  amendmentId,
  amendment,
  currentUserId,
  isLoading,
  mode,
  agendaItemId,
}: AmendmentEditContentProps) {
  const isCreating = mode === 'create' || !amendment;

  const navigate = useNavigate();

  const { t } = useTranslation();

  const { updateAmendment, createAmendment, updateEditingMode } = useAmendmentActions();

  const { initializeChangeRequestVoting } = useAgendaActions();

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
    autoCloseVoting: false,
    visibility: 'public' as Visibility,
    date: '',
    supporters: 0,
    hashtags: [] as string[],
  });

  const workflowStatusOption = getEditingModeOption(formData.workflowStatus, t);

  const workflowMenuValue = (
    SELECTABLE_MODES.includes(formData.workflowStatus) ? formData.workflowStatus : 'view'
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
        autoCloseVoting: false, // Will be loaded from document settings
        visibility: (amendment.visibility as Visibility) ?? 'public',
        date: new Date().toLocaleDateString(),
        supporters: 0,
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
        await updateEditingMode(amendmentId, value);
        console.info('[AmendmentEditContent] Workflow status persisted from settings', {
          amendmentId,
          newMode: value,
          previousMode: previousWorkflowStatus,
        });

        // Initialize CR voting when transitioning to vote_event
        if (value === 'vote_event' && agendaItemId) {
          console.info('[AmendmentEditContent] Initializing CR voting', {
            amendmentId,
            agendaItemId,
          });
          await initializeChangeRequestVoting({
            amendment_id: amendmentId,
            agenda_item_id: agendaItemId,
            voting_context: 'event',
          });
          console.info('[AmendmentEditContent] CR voting initialized', {
            amendmentId,
            agendaItemId,
          });
        } else if (value === 'vote_event' && !agendaItemId) {
          console.warn(
            '[AmendmentEditContent] Cannot initialize CR voting — no agenda item linked to this amendment',
            {
              amendmentId,
            }
          );
        }
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
      agendaItemId,
      formData.workflowStatus,
      isCreating,
      updateEditingMode,
      initializeChangeRequestVoting,
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
          visibility: formData.visibility,
          supporters: formData.supporters,
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
    currentUserId,
    isLoading,
    mode,
    agendaItemId,
    isCreating,
    navigate,
    t,
    updateAmendment,
    createAmendment,
    updateEditingMode,
    initializeChangeRequestVoting,
    commonActions,
    amendmentHashtags,
    allHashtags,
    formData,
    setFormData,
    workflowStatusOption,
    workflowMenuValue,
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
