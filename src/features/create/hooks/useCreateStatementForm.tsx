import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useAuth } from '@/providers/auth-provider';
import { useStatementMutations } from '@/features/statements/hooks/useStatementMutations';
import { useCommonActions } from '@/zero/common/useCommonActions';
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
import { CreateCharacterCountNotice } from '../ui/CreateInlineNotice';
import { StatementSurveyInput } from '../ui/inputs/StatementSurveyInput';
import type { CreateFormConfig, CreateSubmitContext } from '../types/create-form.types';
import {
  createBlockedSubmitOutcome,
  createRouteSubmitTarget,
  createSuccessSubmitOutcome,
} from '../logic/createSubmitTargets';

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
  const { createStatement, createSurvey, createSurveyOption, isLoading } = useStatementMutations();
  const { syncEntityHashtags } = useCommonActions();
  const { allHashtags, userHashtags } = useCommonState({
    user_id: user?.id,
    loadAllHashtags: true,
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

  // Step 1: Text + group
  const [text, setText] = useState('');
  const [groupId, setGroupId] = useState<string | null>(() => groupIdParam || null);
  const [groupName, setGroupName] = useState('');
  const { group } = useGroupById(groupId ?? undefined);

  // Step 2: Media + Survey
  const [imageUrl, setImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [surveyQuestion, setSurveyQuestion] = useState('');
  const [surveyOptions, setSurveyOptions] = useState<string[]>(['', '']);
  const [surveyDurationHours, setSurveyDurationHours] = useState(24);

  // Step 3: Hashtags
  const [hashtags, setHashtags] = useState<string[]>([]);

  // Step 4: Visibility
  const [visibility, setVisibility] = useState<'public' | 'authenticated' | 'private'>('public');

  const charsRemaining = MAX_CHARS - text.length;

  const hasSurvey = surveyQuestion.trim() && surveyOptions.filter(o => o.trim()).length >= 2;
  const visibilityLabel =
    visibility === translateText('generated.inline.0030_public_61c9b2b1')
      ? t('pages.create.common.public')
      : visibility === translateText('generated.inline.0031_authenticated_8fda38ce')
        ? t('pages.create.common.authenticated')
        : t('pages.create.common.private');

  useEffect(() => {
    setGroupId(groupIdParam || null);
  }, [groupIdParam]);

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
    context?.reportProgress({ key: 'create', status: 'active' });
    const result = await createStatement(text.trim(), {
      groupId,
      imageUrl: imageUrl || null,
      videoUrl: videoUrl || null,
      visibility,
    });

    if (result.success && result.statementId) {
      context?.reportProgress({ key: 'create', status: 'complete' });
      context?.reportProgress({ key: 'sync', status: 'active' });
      // Sync hashtags
      if (hashtags.length > 0) {
        await syncEntityHashtags('statement', result.statementId, hashtags, [], allHashtags ?? []);
      }

      // Create survey if present
      if (hasSurvey) {
        const surveyId = crypto.randomUUID();
        const endsAt = Date.now() + surveyDurationHours * 60 * 60 * 1000;
        await createSurvey({
          id: surveyId,
          statement_id: result.statementId,
          question: surveyQuestion.trim(),
          ends_at: endsAt,
        });
        const validOptions = surveyOptions.filter(o => o.trim());
        await Promise.all(
          validOptions.map((option, index) =>
            createSurveyOption({
              id: crypto.randomUUID(),
              survey_id: surveyId,
              label: option.trim(),
              position: index,
            })
          )
        );
      }

      context?.reportProgress({ key: 'sync', status: 'complete' });
      context?.reportProgress({ key: 'ready', status: 'active' });
      return createSuccessSubmitOutcome(
        createRouteSubmitTarget('statement', {
          to: '/statement/$id',
          params: { id: result.statementId },
        })
      );
    }

    throw new Error(t('pages.create.error.createFailed'));
  };

  const config = useMemo(
    (): CreateFormConfig => ({
      entityType: 'statement',
      title: 'pages.create.statement.title',
      isSubmitting: isLoading,
      onSubmit: handleSubmit,
      submissionSteps: [
        { key: 'create', label: 'Erstellt Aussage' },
        { key: 'sync', label: 'Synchronisiert Hashtags und Umfrage' },
        { key: 'ready', label: 'Bereitet Aussage vor' },
      ],
      steps: [
        {
          label: t('pages.create.statement.textLabel'),
          isValid: () => !!text.trim() && text.length <= MAX_CHARS,
          fields: [
            {
              key: 'text',
              kind: 'text',
              multiline: true,
              label: t('pages.create.statement.textLabel'),
              required: true,
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
                imageLabel: t('pages.create.statement.imageUrl'),
                imageDescription: t('pages.create.statement.imageDescription'),
                videoLabel: t('pages.create.statement.videoUrl'),
                videoDescription: t('pages.create.statement.videoDescription'),
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
          isValid: () => !!text.trim(),
          fields: [
            {
              key: 'review',
              kind: 'customComponent',
              component: CreateSummaryStep,
              props: {
                entityType: 'statement',
                badge: t('pages.create.statement.reviewBadge'),
                title: t('pages.create.statement.reviewBadge'),
                subtitle: text || undefined,
                secondaryBadge: visibilityLabel,
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
                      ...(imageUrl
                        ? [
                            {
                              label: t('pages.create.statement.imageUrl'),
                              value: 'Attached',
                            },
                          ]
                        : []),
                      ...(videoUrl
                        ? [
                            {
                              label: t('pages.create.statement.videoUrl'),
                              value: 'Attached',
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
      groupId,
      groupName,
      imageUrl,
      videoUrl,
      surveyQuestion,
      surveyOptions,
      surveyDurationHours,
      hashtags,
      preferredHashtagSuggestions,
      visibility,
      visibilityLabel,
      isLoading,
      charsRemaining,
      hasSurvey,
      t,
      syncGroupSearch,
    ]
  );

  return config;
}
