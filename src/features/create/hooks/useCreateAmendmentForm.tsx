import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { useAuth } from '@/providers/auth-provider';
import { ImageUpload } from '@/features/file-upload/ui/ImageUpload.tsx';
import { HashtagEditor } from '@/features/shared/ui/hashtags';
import { VisibilityInput } from '../ui/inputs/VisibilityInput';
import { CreateSummaryStep } from '../ui/CreateSummaryStep';
import type { TargetGroupEventSelection } from '@/features/amendments/ui/TargetGroupEventSelector';
import { AmendmentEvaluationModeInput } from '../ui/inputs/AmendmentEvaluationModeInput';
import { AmendmentTargetSelectionField } from '../ui/inputs/AmendmentTargetSelectionField';
import { useAmendmentActions } from '@/zero/amendments/useAmendmentActions';
import { useCommonState } from '@/zero/common';
import {
  enrichPathSegments,
  type PathWithEventSegment,
} from '@/features/amendments/logic/amendmentPathHelpers';
import { extractHashtagTags } from '@/zero/common/hashtagHelpers';
import { mergeCreateSearchParams } from '../logic/createSearchParams';
import {
  type CreateAmendmentEvaluationMode,
  type CreateAmendmentSearch,
  normalizeCreateAmendmentSearch,
} from '../logic/createAmendmentSearch';
import type { CreateFormConfig, CreateSubmitContext } from '../types/create-form.types';
import { formatImplementationEvaluationSummary } from '@/features/amendments/logic/implementationEvaluation';
import {
  createBlockedSubmitOutcome,
  createRouteSubmitTarget,
  createSuccessSubmitOutcome,
} from '../logic/createSubmitTargets';
import { trackCreateFinalization, waitForOptimisticCreate } from '../logic/createFinalization';

interface CreateTargetGroupData {
  id: string;
  name?: string | null;
  description?: string | null;
  member_count?: number | null;
  event_count?: number | null;
  amendment_count?: number | null;
}

interface CreateTargetEventData {
  id: string;
  title?: string | null;
  start_date?: number | null;
  end_date?: number | null;
  location_name?: string | null;
  description?: string | null;
  participant_count?: number | null;
}

export function useCreateAmendmentForm(): CreateFormConfig {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const rawSearchParams = useSearch({ strict: false }) as CreateAmendmentSearch;
  const searchParams = normalizeCreateAmendmentSearch(rawSearchParams);
  const sourceGroupIdParam = searchParams.sourceGroupId ?? '';
  const targetGroupIdParam = searchParams.targetGroupId ?? '';
  const { user } = useAuth();
  const { createFullAmendment } = useAmendmentActions();

  const [amendmentId] = useState(() => crypto.randomUUID());
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [imageURL, setImageURL] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'authenticated' | 'private'>('public');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [targetSelection, setTargetSelection] = useState<{
    sourceGroupId: string;
    groupId: string;
    groupData: CreateTargetGroupData;
    eventId: string | null;
    eventData: CreateTargetEventData | null;
    pathWithEvents: PathWithEventSegment[];
    missingEventSteps: PathWithEventSegment[];
    pathMode: 'hierarchy' | 'workflow';
    workflowId: string | null;
  } | null>(null);
  const [pathMode, setPathMode] = useState<'hierarchy' | 'workflow'>(searchParams.pathMode);
  const [workflowId, setWorkflowId] = useState(searchParams.workflowId ?? '');
  const [evaluationMode, setEvaluationMode] = useState<CreateAmendmentEvaluationMode>(
    searchParams.evaluationMode
  );
  const [evaluationDate, setEvaluationDate] = useState(searchParams.evaluationDate ?? '');
  const [evaluationOffsetMonths, setEvaluationOffsetMonths] = useState(
    String(searchParams.evaluationOffsetMonths)
  );
  const [evaluationOffsetYears, setEvaluationOffsetYears] = useState(
    String(searchParams.evaluationOffsetYears)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const visibilityLabel =
    visibility === translateText('generated.inline.0030_public_61c9b2b1')
      ? t('pages.create.common.public')
      : visibility === translateText('generated.inline.0031_authenticated_8fda38ce')
        ? t('pages.create.common.authenticated')
        : t('pages.create.common.private');

  const { userHashtags } = useCommonState({
    user_id: user?.id,
  });
  const preferredHashtagSuggestions = useMemo(
    () => extractHashtagTags(userHashtags),
    [userHashtags]
  );

  const syncSearch = useCallback(
    (updates: Partial<CreateAmendmentSearch>) => {
      navigate({
        to: '/create/amendment',
        search: previousSearch =>
          mergeCreateSearchParams(previousSearch as CreateAmendmentSearch, updates),
        replace: true,
        resetScroll: false,
      });
    },
    [navigate]
  );

  const handleSourceGroupSelectionChange = useCallback(
    (nextSourceGroupId: string | null) => {
      syncSearch({ sourceGroupId: nextSourceGroupId ?? undefined });
    },
    [syncSearch]
  );

  const handleGroupSelectionChange = useCallback(
    (groupId: string | null) => {
      syncSearch({
        groupId: groupId ?? undefined,
        targetGroupId: groupId ?? undefined,
      });
    },
    [syncSearch]
  );

  const handlePathModeChange = useCallback(
    (nextPathMode: 'hierarchy' | 'workflow') => {
      setPathMode(nextPathMode);
      if (nextPathMode === 'hierarchy') {
        setWorkflowId('');
      }
      syncSearch({
        pathMode: nextPathMode,
        workflowId: nextPathMode === 'workflow' ? workflowId || undefined : undefined,
      });
    },
    [syncSearch, workflowId]
  );

  const handleWorkflowSelectionChange = useCallback(
    (nextWorkflowId: string | null) => {
      const normalizedWorkflowId = nextWorkflowId ?? '';
      setWorkflowId(normalizedWorkflowId);
      syncSearch({
        workflowId: normalizedWorkflowId || undefined,
      });
    },
    [syncSearch]
  );

  const evaluationSummary = formatImplementationEvaluationSummary({
    mode: evaluationMode,
    fixedDate: evaluationDate || null,
    offsetMonths: Number.parseInt(evaluationOffsetMonths, 10) || 0,
    offsetYears: Number.parseInt(evaluationOffsetYears, 10) || 0,
  });
  const evaluationInvalidReason =
    evaluationMode === 'fixed_date' && !evaluationDate
      ? t('pages.create.amendment.validation.evaluationDateRequired')
      : null;
  const amendmentInvalidReason = !title.trim()
    ? t('pages.create.validation.titleRequired')
    : evaluationInvalidReason;

  const handleTargetSelection = useCallback((selection: TargetGroupEventSelection | null) => {
    if (!selection) {
      setTargetSelection(null);
      return;
    }

    setTargetSelection({
      sourceGroupId: selection.sourceGroupId,
      groupId: selection.groupId,
      groupData: {
        id: selection.groupData.id,
        name: selection.groupData.name ?? null,
        description:
          typeof selection.groupData.description === 'string'
            ? selection.groupData.description
            : null,
        member_count: selection.groupData.member_count ?? null,
        event_count: selection.groupData.event_count ?? null,
        amendment_count: selection.groupData.amendment_count ?? null,
      },
      eventId: selection.eventId,
      eventData: selection.eventData
        ? {
            id: selection.eventData.id,
            title: selection.eventData.title ?? null,
            start_date: selection.eventData.start_date ?? null,
            end_date: selection.eventData.end_date ?? null,
            location_name: selection.eventData.location_name ?? null,
            description:
              typeof selection.eventData.description === 'string'
                ? selection.eventData.description
                : null,
            participant_count: selection.eventData.participant_count ?? null,
          }
        : null,
      pathWithEvents: selection.pathWithEvents,
      missingEventSteps: selection.missingEventSteps,
      pathMode: selection.pathMode,
      workflowId: selection.workflowId,
    });
    setPathMode(selection.pathMode);
    setWorkflowId(selection.workflowId ?? '');
  }, []);

  const handleSubmit = async (context?: CreateSubmitContext) => {
    if (!title.trim() || !user?.id) return createBlockedSubmitOutcome();
    if (evaluationInvalidReason) return createBlockedSubmitOutcome();
    setIsSubmitting(true);
    try {
      context?.reportProgress({ key: 'create', status: 'active' });
      const normalizedGroupId = targetSelection?.groupId ? targetSelection.groupId : null;
      const normalizedEventId = targetSelection?.eventId ? targetSelection.eventId : null;
      const documentId = crypto.randomUUID();
      const enrichedPath = targetSelection?.pathWithEvents.length
        ? enrichPathSegments(
            targetSelection.pathWithEvents,
            targetSelection.groupId,
            targetSelection.eventId ?? '',
            targetSelection.eventData?.title ?? null,
            targetSelection.eventData?.start_date ?? null,
            targetSelection.eventData?.end_date ?? null
          )
        : [];
      const processPath =
        targetSelection && enrichedPath.length > 0
          ? {
              amendment_id: amendmentId,
              amendment_title: title.trim(),
              amendment_reason: null,
              enriched_path: enrichedPath,
              source_group_id: targetSelection.sourceGroupId,
              workflow_id: targetSelection.workflowId,
              path_mode: targetSelection.pathMode,
              evaluation_mode: evaluationMode,
              evaluation_date:
                evaluationMode === 'fixed_date' && evaluationDate
                  ? new Date(`${evaluationDate}T00:00:00`).getTime()
                  : null,
              evaluation_offset_months:
                evaluationMode === 'relative_to_vote'
                  ? Number.parseInt(evaluationOffsetMonths, 10) || 0
                  : null,
              evaluation_offset_years:
                evaluationMode === 'relative_to_vote'
                  ? Number.parseInt(evaluationOffsetYears, 10) || 0
                  : null,
            }
          : null;
      const createAmendmentPayload = {
        amendment: {
          id: amendmentId,
          title: title.trim(),
          code: subtitle || null,
          reason: null,
          category: null,
          preamble: null,
          group_id: normalizedGroupId,
          event_id: normalizedEventId,
          clone_source_id: null,
          document_id: null,
          tags: hashtags.length > 0 ? hashtags : null,
          visibility,
          discussions: null,
          image_url: imageURL || null,
          x: null,
          youtube: null,
          linkedin: null,
          website: null,
        },
        document: {
          id: documentId,
          amendment_id: amendmentId,
          content: [
            { type: 'h1', children: [{ text: title.trim() }] },
            { type: 'p', children: [{ text: '' }] },
          ],
          editing_mode: 'edit',
        },
        document_collaborator: {
          id: crypto.randomUUID(),
          document_id: documentId,
          user_id: user.id,
          role_id: null,
          status: 'active',
          visibility: 'public',
        },
        hashtags,
        process_path: processPath,
      };
      const amendmentTarget = createRouteSubmitTarget('amendment', {
        to: '/amendment/$id',
        params: { id: amendmentId },
      });
      const createAmendmentResult = createFullAmendment(createAmendmentPayload);
      await waitForOptimisticCreate(createAmendmentResult);

      context?.setRecoveryTarget(amendmentTarget);
      context?.reportProgress({ key: 'create', status: 'complete' });
      context?.reportProgress({ key: 'sync', status: 'complete' });
      context?.reportProgress({ key: 'ready', status: 'active' });
      trackCreateFinalization({
        result: createAmendmentResult,
        draft: {
          id: `amendment:${amendmentId}`,
          entityType: 'amendment',
          entityId: amendmentId,
          createPath: '/create/amendment',
          formState: {
            title,
            subtitle,
            imageURL,
            visibility,
            hashtags,
            targetSelection,
            pathMode,
            workflowId,
            evaluationMode,
            evaluationDate,
            evaluationOffsetMonths,
            evaluationOffsetYears,
          },
          mutationPayload: createAmendmentPayload,
          target: amendmentTarget,
        },
        retry: () => {
          const retryResult = createFullAmendment(createAmendmentPayload);
          trackCreateFinalization({
            result: retryResult,
            draft: {
              id: `amendment:${amendmentId}`,
              entityType: 'amendment',
              entityId: amendmentId,
              createPath: '/create/amendment',
              formState: {
                title,
                subtitle,
                imageURL,
                visibility,
                hashtags,
                targetSelection,
                pathMode,
                workflowId,
                evaluationMode,
                evaluationDate,
                evaluationOffsetMonths,
                evaluationOffsetYears,
              },
              mutationPayload: createAmendmentPayload,
              target: amendmentTarget,
            },
          });
        },
      });
      setIsSubmitting(false);
      return createSuccessSubmitOutcome(amendmentTarget);
    } catch (error) {
      setIsSubmitting(false);
      throw error;
    }
  };

  const config = useMemo(
    (): CreateFormConfig => ({
      entityType: 'amendment',
      title: 'pages.create.amendment.title',
      isSubmitting,
      onSubmit: handleSubmit,
      submissionSteps: [
        { key: 'create', label: t('pages.create.progress.submission.steps.amendment.create') },
        { key: 'sync', label: t('pages.create.progress.submission.steps.amendment.sync') },
        { key: 'ready', label: t('pages.create.progress.submission.steps.amendment.ready') },
      ],
      steps: [
        {
          label: t('pages.create.amendment.basicInfo'),
          isValid: () => !!title.trim(),
          getInvalidReason: () =>
            !title.trim() ? t('pages.create.validation.titleRequired') : null,
          fields: [
            {
              key: 'title',
              kind: 'text',
              label: t('pages.create.amendment.titleLabel'),
              required: true,
              hint: t('pages.create.amendment.tips.title'),
              value: title,
              onValueChange: setTitle,
              placeholder: t('pages.create.amendment.titlePlaceholder'),
            },
            {
              key: 'subtitle',
              kind: 'text',
              label: t('pages.create.amendment.subtitleOptional'),
              hint: t('pages.create.amendment.tips.subtitle'),
              value: subtitle,
              onValueChange: setSubtitle,
              placeholder: t('pages.create.amendment.subtitlePlaceholder'),
            },
            {
              key: 'image',
              kind: 'customComponent',
              component: ImageUpload,
              props: {
                currentImage: imageURL,
                onImageChange: (url: string) => setImageURL(url),
                cleanupOnRemove: true,
                entityType: 'amendments',
                entityId: amendmentId,
                label: t('pages.create.amendment.imageLabel'),
                description: t('pages.create.amendment.imageDescription'),
              },
            },
          ],
        },
        {
          label: t('pages.create.amendment.targetGroupEvent'),
          isValid: () => true,
          optional: true,
          fields: [
            {
              key: 'target',
              kind: 'customComponent',
              component: AmendmentTargetSelectionField,
              props: {
                hint: t('pages.create.amendment.tips.targetGroupEvent'),
                loadingLabel: t('pages.create.common.loading'),
                userId: user?.id,
                targetSelection,
                sourceGroupIdParam,
                targetGroupIdParam,
                pathMode,
                workflowId,
                openEventStepsLabel: translateText(
                  'generated.inline.0318_offene_event_schritte_6d65e743'
                ),
                missingEventStepsDescription: translateText(
                  'generated.inline.0319_fuer_diese_gruppen_wird_beim_erstellen_automa_ead2264c'
                ),
                onSourceGroupSelectionChange: handleSourceGroupSelectionChange,
                onGroupSelectionChange: handleGroupSelectionChange,
                onPathModeChange: handlePathModeChange,
                onWorkflowSelectionChange: handleWorkflowSelectionChange,
                onSelect: handleTargetSelection,
              },
            },
          ],
        },
        {
          label: translateText('generated.inline.0050_evaluierung_581efef4'),
          isValid: () => evaluationMode !== 'fixed_date' || Boolean(evaluationDate),
          getInvalidReason: () => evaluationInvalidReason,
          optional: true,
          sections: [
            {
              key: 'mode',
              fields: [
                {
                  key: 'mode-buttons',
                  kind: 'customComponent',
                  component: AmendmentEvaluationModeInput,
                  props: {
                    label: translateText('generated.inline.0320_evaluierungsmodus_37f2926b'),
                    options: [
                      { value: 'none', label: t('pages.create.amendment.evaluationModes.none') },
                      {
                        value: 'fixed_date',
                        label: t('pages.create.amendment.evaluationModes.fixedDate'),
                      },
                      {
                        value: 'relative_to_vote',
                        label: t('pages.create.amendment.evaluationModes.relativeAcceptance'),
                      },
                    ],
                    value: evaluationMode,
                    onChange: (mode: CreateAmendmentEvaluationMode) => {
                      setEvaluationMode(mode);
                      syncSearch({ evaluationMode: mode });
                    },
                  },
                },
              ],
            },
            ...(evaluationMode === 'fixed_date'
              ? [
                  {
                    key: 'fixed-date',
                    fields: [
                      {
                        key: 'evaluation-date',
                        kind: 'text' as const,
                        label: translateText('generated.inline.0321_evaluierungsdatum_6b3d2c9b'),
                        type: 'date' as const,
                        required: true,
                        value: evaluationDate,
                        onValueChange: (value: string) => {
                          setEvaluationDate(value);
                          syncSearch({ evaluationDate: value || undefined });
                        },
                      },
                    ],
                  },
                ]
              : []),
            ...(evaluationMode === 'relative_to_vote'
              ? [
                  {
                    key: 'relative-offset',
                    layout: 'grid' as const,
                    fields: [
                      {
                        key: 'evaluation-offset-months',
                        kind: 'text' as const,
                        label: translateText('generated.inline.0322_monate_nach_annahme_9ccb5844'),
                        type: 'number' as const,
                        min: 0,
                        value: evaluationOffsetMonths,
                        onValueChange: (value: string) => {
                          setEvaluationOffsetMonths(value);
                          syncSearch({
                            evaluationOffsetMonths: value ? Number.parseInt(value, 10) : undefined,
                          });
                        },
                      },
                      {
                        key: 'evaluation-offset-years',
                        kind: 'text' as const,
                        label: translateText('generated.inline.0323_jahre_nach_annahme_42482627'),
                        type: 'number' as const,
                        min: 0,
                        value: evaluationOffsetYears,
                        onValueChange: (value: string) => {
                          setEvaluationOffsetYears(value);
                          syncSearch({
                            evaluationOffsetYears: value ? Number.parseInt(value, 10) : undefined,
                          });
                        },
                      },
                    ],
                  },
                ]
              : []),
          ],
        },
        {
          label: t('pages.create.amendment.visibilityAndTags'),
          isValid: () => true,
          optional: true,
          fields: [
            {
              key: 'visibility',
              kind: 'customComponent',
              component: VisibilityInput,
              props: { value: visibility, onChange: setVisibility },
            },
            {
              key: 'hashtags',
              kind: 'customComponent',
              component: HashtagEditor,
              props: {
                value: hashtags,
                onChange: setHashtags,
                placeholder: t('pages.create.amendment.hashtagPlaceholder'),
                preferredSuggestions: preferredHashtagSuggestions,
              },
            },
          ],
        },
        {
          label: t('pages.create.common.review'),
          isValid: () => !!title.trim() && !evaluationInvalidReason,
          getInvalidReason: () => amendmentInvalidReason,
          fields: [
            {
              key: 'review',
              kind: 'customComponent',
              component: CreateSummaryStep,
              props: {
                entityType: 'amendment',
                badge: t('pages.create.amendment.reviewBadge'),
                title: title || t('pages.create.amendment.titlePlaceholder'),
                subtitle: subtitle || undefined,
                media: imageURL
                  ? { imageUrl: imageURL, imageAlt: title || t('pages.create.amendment.imageAlt') }
                  : undefined,
                hashtags: hashtags.length > 0 ? hashtags : undefined,
                sections: [
                  {
                    title: t('pages.create.amendment.targetGroupEvent'),
                    fields: [
                      ...(targetSelection
                        ? [
                            {
                              label: t('pages.create.amendment.target'),
                              value: targetSelection.eventData
                                ? `${String(targetSelection.groupData.name ?? '')} -> ${String(targetSelection.eventData.title ?? '')}`
                                : String(targetSelection.groupData.name ?? ''),
                            },
                            {
                              label: translateText('generated.inline.0051_startgruppe_27591dc9'),
                              value:
                                targetSelection.pathWithEvents[0]?.groupName ??
                                targetSelection.groupData.name ??
                                '',
                            },
                            ...(targetSelection.eventData &&
                            targetSelection.pathWithEvents.length > 0
                              ? [
                                  {
                                    label: translateText('generated.inline.0052_path_519e3913'),
                                    value: targetSelection.pathWithEvents
                                      .map(
                                        segment =>
                                          `${segment.groupName}: ${segment.eventTitle || t('pages.create.common.notSelected')}`
                                      )
                                      .join(', '),
                                  },
                                ]
                              : []),
                            ...(targetSelection.missingEventSteps.length > 0
                              ? [
                                  {
                                    label: translateText(
                                      'generated.inline.0053_offene_event_schritte_6d65e743'
                                    ),
                                    value: targetSelection.missingEventSteps
                                      .map(step => step.groupName)
                                      .join(', '),
                                  },
                                ]
                              : []),
                          ]
                        : []),
                    ],
                  },
                  {
                    title: translateText('generated.inline.0050_evaluierung_581efef4'),
                    fields: [
                      {
                        label: translateText('generated.inline.0054_modus_a7f116c3'),
                        value: evaluationSummary,
                      },
                    ],
                  },
                  {
                    title: t('pages.create.amendment.visibilityAndTags'),
                    fields: [
                      {
                        label: t('pages.create.common.visibility'),
                        value: visibilityLabel,
                      },
                      ...(imageURL
                        ? [
                            {
                              label: t('pages.create.amendment.imageLabel'),
                              value: t('common.attached'),
                            },
                          ]
                        : []),
                    ],
                  },
                ],
              },
            },
          ],
        },
      ],
    }),
    [
      title,
      subtitle,
      imageURL,
      visibility,
      visibilityLabel,
      hashtags,
      preferredHashtagSuggestions,
      targetSelection,
      sourceGroupIdParam,
      targetGroupIdParam,
      pathMode,
      workflowId,
      evaluationMode,
      evaluationDate,
      evaluationOffsetMonths,
      evaluationOffsetYears,
      evaluationSummary,
      evaluationInvalidReason,
      amendmentInvalidReason,
      isSubmitting,
      amendmentId,
      handleSourceGroupSelectionChange,
      handleGroupSelectionChange,
      handlePathModeChange,
      handleWorkflowSelectionChange,
      handleTargetSelection,
      t,
      user?.id,
    ]
  );

  return config;
}
