import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useRouter, useSearch } from '@tanstack/react-router';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { useAuth } from '@/providers/auth-provider';
import { MediaUpload } from '@/features/file-upload/ui/MediaUpload';
import { HashtagEditor } from '@/features/shared/ui/hashtags';
import { VisibilityInput } from '../ui/inputs/VisibilityInput';
import { AmendmentLocationInput } from '../ui/inputs/AmendmentLocationInput';
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
import { getCreateVisibilityLabelKey } from '../logic/createVisibility';
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
import {
  consumeCreateRestoreDraft,
  trackCreateFinalization,
  waitForOptimisticCreate,
} from '../logic/createFinalization';
import { formatLocation } from '@/features/shared/logic/locationHelpers';
import {
  geoLocationFieldsFromShape,
  type GeoLocationShape,
} from '@/features/shared/logic/geoLocationShape';
import { toLocalTimestamp } from '@/features/shared/logic/localDateTime';

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
  const router = useRouter();
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
  const [videoURL, setVideoURL] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'authenticated' | 'private'>('public');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const [post_code, setPostCode] = useState('');
  const [city, setCity] = useState('');
  const [street, setStreet] = useState('');
  const [house_number, setHouseNumber] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationShape, setLocationShape] = useState<GeoLocationShape | null>(null);
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
  const suppressSearchSyncRef = useRef(false);
  const pendingSearchNavigationsRef = useRef(new Set<Promise<void>>());
  useEffect(() => {
    const restoreDraft = consumeCreateRestoreDraft<
      Partial<{
        title: string;
        subtitle: string;
        imageURL: string;
        videoURL: string;
        visibility: 'public' | 'authenticated' | 'private';
        hashtags: string[];
        country: string;
        region: string;
        post_code: string;
        city: string;
        street: string;
        house_number: string;
        latitude: number | null;
        longitude: number | null;
        locationShape: GeoLocationShape | null;
        targetSelection: typeof targetSelection;
        pathMode: 'hierarchy' | 'workflow';
        workflowId: string;
        evaluationMode: CreateAmendmentEvaluationMode;
        evaluationDate: string;
        evaluationOffsetMonths: string;
        evaluationOffsetYears: string;
      }>
    >('amendment');
    if (!restoreDraft) return;
    const state = restoreDraft.formState;

    setTitle(state.title ?? '');
    setSubtitle(state.subtitle ?? '');
    setImageURL(state.imageURL ?? '');
    setVideoURL(state.videoURL ?? '');
    setVisibility(state.visibility ?? 'public');
    setHashtags(state.hashtags ?? []);
    setCountry(state.country ?? '');
    setRegion(state.region ?? '');
    setPostCode(state.post_code ?? '');
    setCity(state.city ?? '');
    setStreet(state.street ?? '');
    setHouseNumber(state.house_number ?? '');
    setLatitude(state.latitude ?? null);
    setLongitude(state.longitude ?? null);
    setLocationShape(state.locationShape ?? null);
    setTargetSelection(state.targetSelection ?? null);
    setPathMode(state.pathMode ?? searchParams.pathMode);
    setWorkflowId(state.workflowId ?? searchParams.workflowId ?? '');
    setEvaluationMode(state.evaluationMode ?? searchParams.evaluationMode);
    setEvaluationDate(state.evaluationDate ?? searchParams.evaluationDate ?? '');
    setEvaluationOffsetMonths(
      state.evaluationOffsetMonths ?? String(searchParams.evaluationOffsetMonths)
    );
    setEvaluationOffsetYears(
      state.evaluationOffsetYears ?? String(searchParams.evaluationOffsetYears)
    );
  }, [searchParams]);
  const visibilityLabel = t(getCreateVisibilityLabelKey(visibility));
  const locationSummary = formatLocation({
    country,
    region,
    post_code,
    city,
    street,
    house_number,
  });

  const { userHashtags } = useCommonState({
    user_id: user?.id,
  });
  const preferredHashtagSuggestions = useMemo(
    () => extractHashtagTags(userHashtags),
    [userHashtags]
  );

  const syncSearch = useCallback(
    (updates: Partial<CreateAmendmentSearch>) => {
      if (suppressSearchSyncRef.current) {
        return;
      }
      if (router.latestLocation.pathname !== '/create/amendment') {
        return;
      }

      const navigation = navigate({
        to: '/create/amendment',
        search: previousSearch =>
          mergeCreateSearchParams(previousSearch as CreateAmendmentSearch, updates),
        replace: true,
        resetScroll: false,
      });
      pendingSearchNavigationsRef.current.add(navigation);
      void navigation.then(
        () => pendingSearchNavigationsRef.current.delete(navigation),
        () => pendingSearchNavigationsRef.current.delete(navigation)
      );
    },
    [navigate, router]
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
    suppressSearchSyncRef.current = true;
    setIsSubmitting(true);
    try {
      while (pendingSearchNavigationsRef.current.size > 0) {
        await Promise.allSettled([...pendingSearchNavigationsRef.current]);
      }
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
                  ? toLocalTimestamp(evaluationDate)
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
      const locationFields = geoLocationFieldsFromShape(locationShape);
      const createAmendmentPayload = {
        amendment: {
          id: amendmentId,
          title: title.trim(),
          code: null,
          reason: null,
          category: null,
          preamble: subtitle || null,
          group_id: normalizedGroupId,
          event_id: normalizedEventId,
          clone_source_id: null,
          document_id: null,
          tags: hashtags.length > 0 ? hashtags : null,
          visibility,
          discussions: null,
          image_url: imageURL || null,
          video_url: videoURL || null,
          country: country || null,
          region: region || null,
          post_code: post_code || null,
          city: city || null,
          street: street || null,
          house_number: house_number || null,
          latitude,
          longitude,
          location_kind: locationFields.location_kind,
          location_place_id: locationFields.location_place_id,
          location_boundary_source: locationFields.location_boundary_source,
          location_geometry: locationFields.location_geometry,
          location_bounds: locationFields.location_bounds,
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
      const createAmendmentResult = createFullAmendment(createAmendmentPayload, {
        notificationMode: 'silent',
      });
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
            videoURL,
            visibility,
            hashtags,
            country,
            region,
            post_code,
            city,
            street,
            house_number,
            latitude,
            longitude,
            locationShape,
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
          const retryResult = createFullAmendment(createAmendmentPayload, {
            notificationMode: 'silent',
          });
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
                videoURL,
                visibility,
                hashtags,
                country,
                region,
                post_code,
                city,
                street,
                house_number,
                latitude,
                longitude,
                locationShape,
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
      suppressSearchSyncRef.current = false;
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
              key: 'media',
              kind: 'customComponent',
              component: MediaUpload,
              props: {
                currentImage: imageURL,
                onImageChange: (url: string) => setImageURL(url),
                currentVideo: videoURL,
                onVideoChange: (url: string) => setVideoURL(url),
                cleanupOnRemove: true,
                exclusiveMedia: true,
                entityType: 'amendments',
                entityId: amendmentId,
                imageLabel: t('pages.create.amendment.imageLabel'),
                imageDescription: t('pages.create.amendment.imageDescription'),
                videoLabel: t('common.actions.uploadVideo'),
                videoDescription: t('common.media.videoDescription'),
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
          label: t('pages.create.amendment.location'),
          isValid: () => true,
          optional: true,
          fields: [
            {
              key: 'location',
              kind: 'customComponent',
              component: AmendmentLocationInput,
              props: {
                hint: t('pages.create.amendment.tips.location'),
                values: {
                  country,
                  region,
                  city,
                  post_code,
                  street,
                  house_number,
                  latitude,
                  longitude,
                },
                shape: locationShape,
                onShapeChange: setLocationShape,
                labels: {
                  country: t('pages.create.amendment.countryLabel'),
                  region: t('pages.create.amendment.regionLabel'),
                  city: t('pages.create.amendment.cityLabel'),
                  post_code: t('pages.create.amendment.postCodeLabel'),
                  street: t('pages.create.amendment.streetLabel'),
                  house_number: t('pages.create.amendment.houseNumberLabel'),
                },
                placeholders: {
                  country: t('pages.create.amendment.countryPlaceholder'),
                  region: t('pages.create.amendment.regionPlaceholder'),
                  city: t('pages.create.amendment.cityPlaceholder'),
                  post_code: t('pages.create.amendment.postCodePlaceholder'),
                  street: t('pages.create.amendment.streetPlaceholder'),
                  house_number: t('pages.create.amendment.houseNumberPlaceholder'),
                },
                onCoordinatesChange: (
                  coordinates: { latitude: number; longitude: number } | null
                ) => {
                  setLatitude(coordinates?.latitude ?? null);
                  setLongitude(coordinates?.longitude ?? null);
                },
                onFieldChange: (
                  field: 'country' | 'region' | 'city' | 'post_code' | 'street' | 'house_number',
                  value: string
                ) => {
                  switch (field) {
                    case 'country':
                      setCountry(value);
                      break;
                    case 'region':
                      setRegion(value);
                      break;
                    case 'city':
                      setCity(value);
                      break;
                    case 'post_code':
                      setPostCode(value);
                      break;
                    case 'street':
                      setStreet(value);
                      break;
                    case 'house_number':
                      setHouseNumber(value);
                      break;
                  }
                },
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
                media: {
                  imageUrl: imageURL || undefined,
                  imageAlt: title || t('pages.create.amendment.imageAlt'),
                  videoUrl: videoURL || undefined,
                },
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
                  ...(locationSummary
                    ? [
                        {
                          title: t('pages.create.amendment.location'),
                          fields: [
                            {
                              label: t('pages.create.amendment.location'),
                              value: locationSummary,
                            },
                          ],
                        },
                      ]
                    : []),
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
                      ...(videoURL
                        ? [
                            {
                              label: t('common.actions.uploadVideo'),
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
      videoURL,
      visibility,
      visibilityLabel,
      hashtags,
      country,
      region,
      post_code,
      city,
      street,
      house_number,
      latitude,
      longitude,
      locationShape,
      locationSummary,
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
