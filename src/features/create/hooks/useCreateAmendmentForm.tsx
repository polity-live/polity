import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/features/shared/ui/ui/button';
import { Label } from '@/features/shared/ui/ui/label';
import { ImageUpload } from '@/features/file-upload/ui/ImageUpload.tsx';
import { HashtagEditor } from '@/features/shared/ui/ui/hashtag-editor';
import { SummaryPillList } from '@/features/shared/ui/ui/create-review-card';
import { VisibilityInput } from '../ui/inputs/VisibilityInput';
import { CreateSummaryStep } from '../ui/CreateSummaryStep';
import { CreateInputField } from '../ui/CreateFields';
import {
  TargetGroupEventSelector,
  TargetGroupEventDisplay,
  type TargetGroupEventSelection,
} from '@/features/amendments/ui/TargetGroupEventSelector';
import { useAmendmentActions } from '@/zero/amendments/useAmendmentActions';
import { useDocumentActions } from '@/zero/documents/useDocumentActions';
import { useCommonState, useCommonActions } from '@/zero/common';
import { enrichPathSegments } from '@/features/amendments/logic/amendmentPathHelpers';
import { useCreateAmendmentPath } from '@/features/amendments/hooks/useCreateAmendmentPath';
import { serverConfirmed } from '@/zero/mutate-with-server-check';
import { mergeCreateSearchParams } from '../logic/createSearchParams';
import {
  type CreateAmendmentEvaluationMode,
  type CreateAmendmentSearch,
  normalizeCreateAmendmentSearch,
} from '../logic/createAmendmentSearch';
import type { CreateFormConfig } from '../types/create-form.types';

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
  const { createAmendment } = useAmendmentActions();
  const { createDocument, addCollaborator } = useDocumentActions();
  const commonActions = useCommonActions();
  const { createAmendmentPath } = useCreateAmendmentPath();

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
    pathWithEvents: {
      groupId: string;
      groupName: string;
      eventId: string | null;
      eventTitle: string;
      eventStartDate: number | null;
      eventEndDate?: number | null;
      requiredAfter?: number | null;
      requiredBefore?: number | null;
    }[];
    missingEventSteps: {
      groupId: string;
      groupName: string;
    }[];
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
    visibility === 'public'
      ? t('pages.create.common.public')
      : visibility === 'authenticated'
        ? t('pages.create.common.authenticated')
        : t('pages.create.common.private');

  const { allHashtags } = useCommonState({ loadAllHashtags: true });

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

  const evaluationSummary =
    evaluationMode === 'fixed_date'
      ? evaluationDate || 'Kein Datum'
      : evaluationMode === 'relative_to_vote'
        ? `${evaluationOffsetYears || '0'} Jahre, ${evaluationOffsetMonths || '0'} Monate nach Annahme`
        : 'Keine Evaluierung geplant';

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
      missingEventSteps: selection.missingEventSteps.map(segment => ({
        groupId: segment.groupId,
        groupName: segment.groupName,
      })),
      pathMode: selection.pathMode,
      workflowId: selection.workflowId,
    });
    setPathMode(selection.pathMode);
    setWorkflowId(selection.workflowId ?? '');
  }, []);

  const handleSubmit = async () => {
    if (!title.trim() || !user?.id) return;
    setIsSubmitting(true);
    try {
      const normalizedGroupId = targetSelection?.groupId ? targetSelection.groupId : null;
      const normalizedEventId = targetSelection?.eventId ? targetSelection.eventId : null;
      const documentId = crypto.randomUUID();

      // Create document first so amendment can reference it
      const createDocumentResult = createDocument({
        id: documentId,
        amendment_id: null,
        content: [
          { type: 'h1', children: [{ text: title.trim() }] },
          { type: 'p', children: [{ text: '' }] },
        ],
        editing_mode: 'collaborative',
      });
      await serverConfirmed(createDocumentResult);

      const createAmendmentResult = createAmendment({
        id: amendmentId,
        title: title.trim(),
        code: subtitle || null,
        editing_mode: 'edit',
        reason: null,
        category: null,
        preamble: null,
        group_id: normalizedGroupId,
        event_id: normalizedEventId,
        clone_source_id: null,
        document_id: documentId,
        tags: hashtags.length > 0 ? hashtags : null,
        visibility,
        discussions: null,
        image_url: imageURL || null,
        x: null,
        youtube: null,
        linkedin: null,
        website: null,
      });
      await serverConfirmed(createAmendmentResult);

      // Add creator as document collaborator
      const addCollaboratorResult = addCollaborator({
        id: crypto.randomUUID(),
        document_id: documentId,
        user_id: user.id,
        role_id: null,
        status: 'active',
        visibility: 'public',
      });
      await serverConfirmed(addCollaboratorResult);

      if (hashtags.length > 0) {
        await commonActions.syncEntityHashtags(
          'amendment',
          amendmentId,
          hashtags,
          [],
          allHashtags ?? []
        );
      }

      // Create amendment path with agenda items and votes if target was selected
      if (targetSelection?.pathWithEvents.length) {
        const enrichedPath = enrichPathSegments(
          targetSelection.pathWithEvents,
          targetSelection.groupId,
          targetSelection.eventId ?? '',
          targetSelection.eventData?.title ?? null,
          targetSelection.eventData?.start_date ?? null,
          targetSelection.eventData?.end_date ?? null
        );

        await createAmendmentPath({
          amendmentId,
          amendmentTitle: title.trim(),
          amendmentReason: null,
          enrichedPath,
          sourceGroupId: targetSelection.sourceGroupId,
          workflowId: targetSelection.workflowId,
          pathMode: targetSelection.pathMode,
          evaluationMode,
          evaluationDate:
            evaluationMode === 'fixed_date' && evaluationDate
              ? new Date(`${evaluationDate}T00:00:00`).getTime()
              : null,
          evaluationOffsetMonths:
            evaluationMode === 'relative_to_vote'
              ? Number.parseInt(evaluationOffsetMonths, 10) || 0
              : null,
          evaluationOffsetYears:
            evaluationMode === 'relative_to_vote'
              ? Number.parseInt(evaluationOffsetYears, 10) || 0
              : null,
        });
      }

      navigate({ to: `/amendment/${amendmentId}` });
    } catch {
      setIsSubmitting(false);
    }
  };

  const config = useMemo(
    (): CreateFormConfig => ({
      entityType: 'amendment',
      title: 'pages.create.amendment.title',
      isSubmitting,
      onSubmit: handleSubmit,
      steps: [
        {
          label: t('pages.create.amendment.basicInfo'),
          isValid: () => !!title.trim(),
          content: (
            <div className="space-y-4">
              <CreateInputField
                label={t('pages.create.amendment.titleLabel')}
                required
                hint={t('pages.create.amendment.tips.title')}
                value={title}
                onValueChange={setTitle}
                placeholder={t('pages.create.amendment.titlePlaceholder')}
              />
              <CreateInputField
                label={t('pages.create.amendment.subtitleOptional')}
                hint={t('pages.create.amendment.tips.subtitle')}
                value={subtitle}
                onValueChange={setSubtitle}
                placeholder={t('pages.create.amendment.subtitlePlaceholder')}
              />
              <ImageUpload
                currentImage={imageURL}
                onImageChange={(url: string) => setImageURL(url)}
                cleanupOnRemove
                entityType="amendments"
                entityId={amendmentId}
                label={t('pages.create.amendment.imageLabel')}
                description={t('pages.create.amendment.imageDescription')}
              />
            </div>
          ),
        },
        {
          label: t('pages.create.amendment.targetGroupEvent'),
          isValid: () => true,
          optional: true,
          content: (
            <div className="space-y-4">
              <p className="text-muted-foreground text-xs">
                {t('pages.create.amendment.tips.targetGroupEvent')}
              </p>
              {user?.id ? (
                <TargetGroupEventSelector
                  userId={user.id}
                  allowGroupWithoutEvent
                  layoutScope="create-amendment"
                  onSourceGroupSelectionChange={handleSourceGroupSelectionChange}
                  onGroupSelectionChange={handleGroupSelectionChange}
                  onPathModeChange={handlePathModeChange}
                  onWorkflowSelectionChange={handleWorkflowSelectionChange}
                  onSelect={handleTargetSelection}
                  selectedSourceGroupId={targetSelection?.sourceGroupId ?? sourceGroupIdParam}
                  selectedGroupId={targetSelection?.groupId ?? targetGroupIdParam}
                  selectedEventId={targetSelection?.eventId ?? undefined}
                  selectedPathMode={pathMode}
                  selectedWorkflowId={workflowId || undefined}
                />
              ) : (
                <p className="text-muted-foreground text-sm">{t('pages.create.common.loading')}</p>
              )}

              {targetSelection && (
                <div className="space-y-3">
                  <TargetGroupEventDisplay
                    groupData={targetSelection.groupData}
                    eventData={targetSelection.eventData}
                    pathWithEvents={targetSelection.pathWithEvents}
                  />
                  {targetSelection.missingEventSteps.length > 0 && (
                    <div className="rounded-md border border-dashed p-3 text-sm">
                      <p className="font-medium">Offene Event-Schritte</p>
                      <p className="text-muted-foreground mt-1">
                        Fuer diese Gruppen wird beim Erstellen automatisch ein `schedule_event`-Task
                        erzeugt:
                      </p>
                      <SummaryPillList
                        items={targetSelection.missingEventSteps.map(step => step.groupName)}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          ),
        },
        {
          label: 'Evaluierung',
          isValid: () => evaluationMode !== 'fixed_date' || Boolean(evaluationDate),
          optional: true,
          content: (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Evaluierungsmodus</Label>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ['none', 'Keine Evaluierung'],
                      ['fixed_date', 'Fixes Datum'],
                      ['relative_to_vote', 'Relativ zur Annahme'],
                    ] as const
                  ).map(([mode, label]) => (
                    <Button
                      key={mode}
                      type="button"
                      variant={evaluationMode === mode ? 'default' : 'outline'}
                      onClick={() => {
                        setEvaluationMode(mode);
                        syncSearch({ evaluationMode: mode });
                      }}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>

              {evaluationMode === 'fixed_date' && (
                <CreateInputField
                  label="Evaluierungsdatum"
                  type="date"
                  required
                  value={evaluationDate}
                  onValueChange={value => {
                    setEvaluationDate(value);
                    syncSearch({ evaluationDate: value || undefined });
                  }}
                />
              )}

              {evaluationMode === 'relative_to_vote' && (
                <div className="grid gap-4 md:grid-cols-2">
                  <CreateInputField
                    label="Monate nach Annahme"
                    type="number"
                    min={0}
                    value={evaluationOffsetMonths}
                    onValueChange={value => {
                      setEvaluationOffsetMonths(value);
                      syncSearch({
                        evaluationOffsetMonths: value ? Number.parseInt(value, 10) : undefined,
                      });
                    }}
                  />
                  <CreateInputField
                    label="Jahre nach Annahme"
                    type="number"
                    min={0}
                    value={evaluationOffsetYears}
                    onValueChange={value => {
                      setEvaluationOffsetYears(value);
                      syncSearch({
                        evaluationOffsetYears: value ? Number.parseInt(value, 10) : undefined,
                      });
                    }}
                  />
                </div>
              )}
            </div>
          ),
        },
        {
          label: t('pages.create.amendment.visibilityAndTags'),
          isValid: () => true,
          optional: true,
          content: (
            <div className="space-y-4">
              <VisibilityInput value={visibility} onChange={setVisibility} />
              <HashtagEditor
                value={hashtags}
                onChange={setHashtags}
                placeholder={t('pages.create.amendment.hashtagPlaceholder')}
              />
            </div>
          ),
        },
        {
          label: t('pages.create.common.review'),
          isValid: () => !!title.trim(),
          content: (
            <CreateSummaryStep
              entityType="amendment"
              badge={t('pages.create.amendment.reviewBadge')}
              title={title || t('pages.create.amendment.titlePlaceholder')}
              subtitle={subtitle || undefined}
              media={
                imageURL ? { imageUrl: imageURL, imageAlt: title || 'Amendment image' } : undefined
              }
              hashtags={hashtags.length > 0 ? hashtags : undefined}
              sections={[
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
                            label: 'Startgruppe',
                            value:
                              targetSelection.pathWithEvents[0]?.groupName ??
                              targetSelection.groupData.name ??
                              '',
                          },
                          ...(targetSelection.eventData && targetSelection.pathWithEvents.length > 0
                            ? [
                                {
                                  label: 'Path',
                                  value: (
                                    <SummaryPillList
                                      items={targetSelection.pathWithEvents.map(
                                        segment =>
                                          `${segment.groupName}: ${segment.eventTitle || t('pages.create.common.notSelected')}`
                                      )}
                                    />
                                  ),
                                },
                              ]
                            : []),
                          ...(targetSelection.missingEventSteps.length > 0
                            ? [
                                {
                                  label: 'Offene Event-Schritte',
                                  value: (
                                    <SummaryPillList
                                      items={targetSelection.missingEventSteps.map(
                                        step => step.groupName
                                      )}
                                    />
                                  ),
                                },
                              ]
                            : []),
                        ]
                      : []),
                  ],
                },
                {
                  title: 'Evaluierung',
                  fields: [
                    {
                      label: 'Modus',
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
                      ? [{ label: t('pages.create.amendment.imageLabel'), value: 'Attached' }]
                      : []),
                  ],
                },
              ]}
            />
          ),
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
