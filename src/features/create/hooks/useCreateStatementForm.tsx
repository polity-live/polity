import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useAuth } from '@/providers/auth-provider';
import { useStatementActions } from '@/zero/statements/useStatementActions';
import { useCommonState } from '@/zero/common/useCommonState';
import { extractHashtagTags } from '@/zero/common/hashtagHelpers';
import { useGroupById, useGroupState } from '@/zero/groups/useGroupState';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { VisibilityInput } from '../ui/inputs/VisibilityInput';
import { HashtagEditor } from '@/features/shared/ui/hashtags';
import { MediaUpload } from '@/features/file-upload/ui/MediaUpload';
import { CreateSummaryStep } from '../ui/CreateSummaryStep';
import { mergeCreateSearchParams } from '../logic/createSearchParams';
import { getCreateVisibilityLabelKey } from '../logic/createVisibility';
import { CreateCharacterCountNotice } from '../ui/CreateInlineNotice';
import { StatementSurveyInput } from '../ui/inputs/StatementSurveyInput';
import { StatementStoryToggle } from '../ui/inputs/StatementStoryToggle';
import type { CreateFormConfig, CreateSubmitContext } from '../types/create-form.types';
import {
  createBlockedSubmitOutcome,
  createRouteSubmitTarget,
  createSuccessSubmitOutcome,
} from '../logic/createSubmitTargets';
import {
  deriveStatementMediaType,
  getStatementHeadline,
  hasStatementContent,
} from '@/zero/statements/content';
import {
  consumeCreateRestoreDraft,
  trackCreateFinalization,
  waitForOptimisticCreate,
} from '../logic/createFinalization';

const MAX_CHARS = 280;

interface CreateStatementSearch {
  groupId?: string;
}

export function useCreateStatementForm(): CreateFormConfig {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const searchParams = useSearch({ strict: false }) as CreateStatementSearch;
  const groupIdParam = searchParams.groupId ?? '';
  const { user } = useAuth();
  const { createFullStatement } = useStatementActions();
  const { userHashtags } = useCommonState({
    user_id: user?.id,
  });
  const preferredHashtagSuggestions = useMemo(
    () => extractHashtagTags(userHashtags),
    [userHashtags]
  );
  const { currentUserMembershipsWithGroups } = useGroupState({
    includeCurrentUserMembershipsWithGroups: true,
  });

  const memberGroupIds = useMemo(
    () => new Set(currentUserMembershipsWithGroups.map(m => m.group_id)),
    [currentUserMembershipsWithGroups]
  );

  const [statementId] = useState(() => crypto.randomUUID());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1: Title, text + group
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [groupId, setGroupId] = useState<string | null>(() => groupIdParam || null);
  const [groupName, setGroupName] = useState('');
  const { group } = useGroupById(groupId ?? undefined);

  // Step 2: Media + Survey
  const [imageUrl, setImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [isStory, setIsStory] = useState(false);
  const [surveyQuestion, setSurveyQuestion] = useState('');
  const [surveyOptions, setSurveyOptions] = useState<string[]>(['', '']);
  const [surveyDurationHours, setSurveyDurationHours] = useState(24);

  // Step 3: Hashtags
  const [hashtags, setHashtags] = useState<string[]>([]);

  // Step 4: Visibility
  const [visibility, setVisibility] = useState<'public' | 'authenticated' | 'private'>('public');

  const charsRemaining = MAX_CHARS - text.length;
  const hasContent = hasStatementContent({
    title,
    text,
    image_url: imageUrl,
    video_url: videoUrl,
  });
  const textInvalidReason =
    text.length > MAX_CHARS
      ? t('pages.create.statement.validation.textTooLong', { count: MAX_CHARS })
      : null;
  const statementContentInvalidReason = !hasContent
    ? t('pages.create.statement.validation.contentRequired')
    : null;
  const statementInvalidReason = textInvalidReason ?? statementContentInvalidReason;

  const hasSurvey = surveyQuestion.trim() && surveyOptions.filter(o => o.trim()).length >= 2;
  const visibilityLabel = t(getCreateVisibilityLabelKey(visibility));

  useEffect(() => {
    setGroupId(groupIdParam || null);
  }, [groupIdParam]);

  useEffect(() => {
    const restoreDraft = consumeCreateRestoreDraft<{
      title?: string;
      text?: string;
      groupId?: string | null;
      imageUrl?: string;
      videoUrl?: string;
      isStory?: boolean;
      surveyQuestion?: string;
      surveyOptions?: string[];
      surveyDurationHours?: number;
      hashtags?: string[];
      visibility?: 'public' | 'authenticated' | 'private';
    }>('statement');
    if (!restoreDraft) return;

    setTitle(restoreDraft.formState.title ?? '');
    setText(restoreDraft.formState.text ?? '');
    setGroupId(restoreDraft.formState.groupId ?? null);
    setImageUrl(restoreDraft.formState.imageUrl ?? '');
    setVideoUrl(restoreDraft.formState.videoUrl ?? '');
    setIsStory(restoreDraft.formState.isStory ?? false);
    setSurveyQuestion(restoreDraft.formState.surveyQuestion ?? '');
    setSurveyOptions(restoreDraft.formState.surveyOptions ?? ['', '']);
    setSurveyDurationHours(restoreDraft.formState.surveyDurationHours ?? 24);
    setHashtags(restoreDraft.formState.hashtags ?? []);
    setVisibility(restoreDraft.formState.visibility ?? 'public');
  }, []);

  useEffect(() => {
    if (!groupId) {
      if (groupName) {
        setGroupName('');
      }
      return;
    }

    const nextGroupName = group?.name ?? '';
    if (nextGroupName && groupName !== nextGroupName) {
      setGroupName(nextGroupName);
    }
  }, [group?.name, groupId, groupName]);

  const syncGroupSearch = (nextGroupId: string | null) => {
    navigate({
      to: '/create/statement',
      search: mergeCreateSearchParams(searchParams, {
        groupId: nextGroupId || undefined,
      }),
      replace: true,
    });
  };

  const handleSubmit = async (context?: CreateSubmitContext) => {
    if (!user) return createBlockedSubmitOutcome();
    if (!hasContent || textInvalidReason) return createBlockedSubmitOutcome();
    setIsSubmitting(true);
    try {
      context?.reportProgress({ key: 'create', status: 'active' });
      const surveyId = hasSurvey ? crypto.randomUUID() : null;
      const validSurveyOptions = surveyOptions.filter(option => option.trim());
      const statementPayload = {
        statement: {
          id: statementId,
          group_id: groupId,
          title: title.trim() || null,
          text: text.trim() || null,
          image_url: imageUrl || null,
          video_url: videoUrl || null,
          media_type: deriveStatementMediaType(imageUrl || null, videoUrl || null),
          is_story: isStory,
          expires_at: null,
          visibility,
        },
        hashtags,
        survey:
          hasSurvey && surveyId
            ? {
                record: {
                  id: surveyId,
                  statement_id: statementId,
                  question: surveyQuestion.trim(),
                  ends_at: Date.now() + surveyDurationHours * 60 * 60 * 1000,
                },
                options: validSurveyOptions.map((option, index) => ({
                  id: crypto.randomUUID(),
                  survey_id: surveyId,
                  label: option.trim(),
                  position: index,
                })),
              }
            : null,
      };
      const statementTarget = createRouteSubmitTarget('statement', {
        to: '/statement/$id',
        params: { id: statementId },
      });
      const statementResult = createFullStatement(statementPayload, {
        notificationMode: 'silent',
      });

      await waitForOptimisticCreate(statementResult);
      context?.reportProgress({ key: 'create', status: 'complete' });
      context?.reportProgress({ key: 'sync', status: 'complete' });
      context?.reportProgress({ key: 'ready', status: 'active' });
      trackCreateFinalization({
        result: statementResult,
        draft: {
          id: `statement:${statementId}`,
          entityType: 'statement',
          entityId: statementId,
          createPath: '/create/statement',
          formState: {
            title,
            text,
            groupId,
            imageUrl,
            videoUrl,
            isStory,
            surveyQuestion,
            surveyOptions,
            surveyDurationHours,
            hashtags,
            visibility,
          },
          mutationPayload: statementPayload,
          target: statementTarget,
        },
        retry: () => {
          const retryResult = createFullStatement(statementPayload, {
            notificationMode: 'silent',
          });
          trackCreateFinalization({
            result: retryResult,
            draft: {
              id: `statement:${statementId}`,
              entityType: 'statement',
              entityId: statementId,
              createPath: '/create/statement',
              formState: {
                title,
                text,
                groupId,
                imageUrl,
                videoUrl,
                isStory,
                surveyQuestion,
                surveyOptions,
                surveyDurationHours,
                hashtags,
                visibility,
              },
              mutationPayload: statementPayload,
              target: statementTarget,
            },
          });
        },
      });

      return createSuccessSubmitOutcome(statementTarget);
    } finally {
      setIsSubmitting(false);
    }
  };

  const config = useMemo(
    (): CreateFormConfig => ({
      entityType: 'statement',
      title: 'pages.create.statement.title',
      isSubmitting,
      onSubmit: handleSubmit,
      submissionSteps: [
        { key: 'create', label: t('pages.create.progress.submission.steps.statement.create') },
        { key: 'sync', label: t('pages.create.progress.submission.steps.statement.sync') },
        { key: 'ready', label: t('pages.create.progress.submission.steps.statement.ready') },
      ],
      steps: [
        {
          label: t('pages.create.statement.textLabel'),
          isValid: () => text.length <= MAX_CHARS,
          getInvalidReason: () => textInvalidReason,
          fields: [
            {
              key: 'title',
              kind: 'text',
              label: t('pages.create.statement.titleLabel'),
              required: false,
              hint: t('pages.create.statement.titleHint'),
              value: title,
              onValueChange: value => setTitle(value.slice(0, 120)),
              placeholder: t('pages.create.statement.titlePlaceholder'),
              maxLength: 120,
            },
            {
              key: 'text',
              kind: 'text',
              multiline: true,
              label: t('pages.create.statement.textLabel'),
              required: false,
              hint: t('pages.create.statement.tips.text'),
              value: text,
              onValueChange: value => setText(value.slice(0, MAX_CHARS)),
              placeholder: t('pages.create.statement.textPlaceholder'),
              rows: 4,
              maxLength: MAX_CHARS,
            },
            {
              key: 'characters-remaining',
              kind: 'customComponent',
              component: CreateCharacterCountNotice,
              props: {
                text: t('features.statements.charsRemaining', { count: charsRemaining }),
                isWarning: charsRemaining < 20,
              },
            },
            {
              key: 'group',
              kind: 'typeahead',
              label: t('pages.create.statement.attachTo'),
              props: {
                entityTypes: ['group'],
                value: groupId ?? undefined,
                onChange: item => {
                  const nextGroupId = item?.id ?? null;
                  setGroupId(nextGroupId);
                  setGroupName(item?.label ?? '');
                  syncGroupSearch(nextGroupId);
                },
                placeholder: t('pages.create.statement.groupPlaceholder'),
                filterFn: item => memberGroupIds.has(item.id),
              },
            },
          ],
        },
        {
          label: t('features.statements.survey.addSurvey'),
          isValid: () => true,
          optional: true,
          fields: [
            {
              key: 'media',
              kind: 'customComponent',
              component: MediaUpload,
              props: {
                currentImage: imageUrl,
                onImageChange: (url: string) => setImageUrl(url),
                currentVideo: videoUrl,
                onVideoChange: (url: string) => setVideoUrl(url),
                entityType: 'statements',
                entityId: statementId,
                exclusiveMedia: true,
                imageLabel: t('pages.create.statement.imageUrl'),
                imageDescription: t('pages.create.statement.imageDescription'),
                videoLabel: t('pages.create.statement.videoUrl'),
                videoDescription: t('pages.create.statement.videoDescription'),
              },
            },
            {
              key: 'story',
              kind: 'customComponent',
              component: StatementStoryToggle,
              props: {
                checked: isStory,
                onCheckedChange: setIsStory,
                label: t('features.statements.story.label'),
                description: t('features.statements.story.description'),
              },
            },
            {
              key: 'survey',
              kind: 'customComponent',
              component: StatementSurveyInput,
              props: {
                title: t('features.statements.survey.addSurvey'),
                questionLabel: t('features.statements.survey.question'),
                optionLabel: t('features.statements.survey.option'),
                durationLabel: t('features.statements.survey.duration'),
                addOptionLabel: translateText('generated.inline.0339_add_option_39780ac3'),
                surveyQuestion,
                surveyOptions,
                surveyDurationHours,
                onSurveyQuestionChange: setSurveyQuestion,
                onSurveyOptionsChange: setSurveyOptions,
                onSurveyDurationHoursChange: setSurveyDurationHours,
              },
            },
          ],
        },
        {
          label: t('pages.create.statement.hashtagsLabel'),
          isValid: () => true,
          optional: true,
          fields: [
            {
              key: 'hashtags',
              kind: 'customComponent',
              component: HashtagEditor,
              props: {
                value: hashtags,
                onChange: setHashtags,
                placeholder: t('pages.create.statement.hashtagPlaceholder'),
                preferredSuggestions: preferredHashtagSuggestions,
              },
            },
          ],
        },
        {
          label: t('pages.create.common.visibility'),
          isValid: () => true,
          fields: [
            {
              key: 'visibility',
              kind: 'customComponent',
              component: VisibilityInput,
              props: { value: visibility, onChange: setVisibility },
            },
          ],
        },
        {
          label: t('pages.create.common.review'),
          isValid: () => hasContent && !textInvalidReason,
          getInvalidReason: () => statementInvalidReason,
          fields: [
            {
              key: 'review',
              kind: 'customComponent',
              component: CreateSummaryStep,
              props: {
                entityType: 'statement',
                badge: t('pages.create.statement.reviewBadge'),
                title: getStatementHeadline({
                  title,
                  text,
                  image_url: imageUrl,
                  video_url: videoUrl,
                }),
                subtitle: text || undefined,
                secondaryBadge: isStory ? t('features.statements.story.badge') : visibilityLabel,
                media: {
                  imageUrl: imageUrl || undefined,
                  imageAlt: t('pages.create.statement.reviewBadge'),
                  videoUrl: videoUrl || undefined,
                },
                hashtags: hashtags.length > 0 ? hashtags : undefined,
                sections: [
                  {
                    title: t('pages.create.statement.textLabel'),
                    fields: [
                      ...(groupName
                        ? [{ label: t('pages.create.statement.attachTo'), value: groupName }]
                        : []),
                      { label: t('pages.create.common.visibility'), value: visibilityLabel },
                      ...(title.trim()
                        ? [
                            {
                              label: t('pages.create.statement.titleLabel'),
                              value: title.trim(),
                            },
                          ]
                        : []),
                      ...(isStory
                        ? [
                            {
                              label: t('features.statements.story.label'),
                              value: t('features.statements.story.badge'),
                            },
                          ]
                        : []),
                      ...(imageUrl
                        ? [
                            {
                              label: t('pages.create.statement.imageUrl'),
                              value: t('common.attached'),
                            },
                          ]
                        : []),
                      ...(videoUrl
                        ? [
                            {
                              label: t('pages.create.statement.videoUrl'),
                              value: t('common.attached'),
                            },
                          ]
                        : []),
                    ],
                  },
                  ...(hasSurvey
                    ? [
                        {
                          title: t('features.statements.survey.addSurvey'),
                          fields: [
                            {
                              label: t('features.statements.survey.question'),
                              value: surveyQuestion,
                            },
                            {
                              label: t('features.statements.survey.duration'),
                              value: String(surveyDurationHours),
                            },
                            {
                              label: t('features.statements.survey.option'),
                              value: surveyOptions.filter(option => option.trim()).join(', '),
                            },
                          ],
                        },
                      ]
                    : []),
                ],
              },
            },
          ],
        },
      ],
    }),
    [
      text,
      title,
      groupId,
      groupName,
      imageUrl,
      videoUrl,
      isStory,
      surveyQuestion,
      surveyOptions,
      surveyDurationHours,
      hashtags,
      preferredHashtagSuggestions,
      visibility,
      visibilityLabel,
      isSubmitting,
      charsRemaining,
      hasContent,
      hasSurvey,
      textInvalidReason,
      statementInvalidReason,
      t,
      syncGroupSearch,
    ]
  );

  return config;
}
