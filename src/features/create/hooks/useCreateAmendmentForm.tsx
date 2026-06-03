import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useAuth } from '@/providers/auth-provider';
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
  location_name?: string | null;
  description?: string | null;
  participant_count?: number | null;
}

interface CreateAmendmentSearch {
  groupId?: string;
}

export function useCreateAmendmentForm(): CreateFormConfig {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const searchParams = useSearch({ strict: false }) as CreateAmendmentSearch;
  const groupIdParam = searchParams.groupId ?? '';
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
    }[];
    pathMode: 'hierarchy' | 'workflow';
    workflowId: string | null;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const visibilityLabel =
    visibility === 'public'
      ? t('pages.create.common.public')
      : visibility === 'authenticated'
        ? t('pages.create.common.authenticated')
        : t('pages.create.common.private');

  const { allHashtags } = useCommonState({ loadAllHashtags: true });

  const syncGroupSearch = useCallback(
    (nextGroupId: string) => {
      navigate({
        to: '/create/amendment',
        search: mergeCreateSearchParams(searchParams, {
          groupId: nextGroupId || undefined,
        }),
        replace: true,
        resetScroll: false,
      });
    },
    [navigate, searchParams]
  );

  const handleGroupSelectionChange = useCallback(
    (groupId: string | null) => {
      syncGroupSearch(groupId ?? '');
    },
    [syncGroupSearch]
  );

  const handleTargetSelection = useCallback((selection: TargetGroupEventSelection | null) => {
    if (!selection) {
      setTargetSelection(null);
      return;
    }

    setTargetSelection({
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
            location_name: selection.eventData.location_name ?? null,
            description:
              typeof selection.eventData.description === 'string'
                ? selection.eventData.description
                : null,
            participant_count: selection.eventData.participant_count ?? null,
          }
        : null,
      pathWithEvents: selection.pathWithEvents,
      pathMode: selection.pathMode,
      workflowId: selection.workflowId,
    });
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
          targetSelection.eventData?.start_date ?? null
        );

        await createAmendmentPath({
          amendmentId,
          amendmentTitle: title.trim(),
          amendmentReason: null,
          enrichedPath,
          workflowId: targetSelection.workflowId,
          pathMode: targetSelection.pathMode,
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
                  onGroupSelectionChange={handleGroupSelectionChange}
                  onSelect={handleTargetSelection}
                  selectedGroupId={targetSelection?.groupId ?? groupIdParam}
                  selectedEventId={targetSelection?.eventId ?? undefined}
                />
              ) : (
                <p className="text-muted-foreground text-sm">{t('pages.create.common.loading')}</p>
              )}

              {targetSelection && (
                <TargetGroupEventDisplay
                  groupData={targetSelection.groupData}
                  eventData={targetSelection.eventData}
                  pathWithEvents={targetSelection.pathWithEvents}
                />
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
                        ]
                      : []),
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
      groupIdParam,
      isSubmitting,
      amendmentId,
      handleGroupSelectionChange,
      handleTargetSelection,
      syncGroupSearch,
      t,
      user?.id,
    ]
  );

  return config;
}
