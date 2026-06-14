import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useAuth } from '@/providers/auth-provider';
import { useStatementMutations } from '@/features/statements/hooks/useStatementMutations';
import { useCommonActions } from '@/zero/common/useCommonActions';
import { useCommonState } from '@/zero/common/useCommonState';
import { useGroupById, useGroupState } from '@/zero/groups/useGroupState';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { Label } from '@/features/shared/ui/ui/label';
import { VisibilityInput } from '../ui/inputs/VisibilityInput';
import { HashtagEditor } from '@/features/shared/ui/ui/hashtag-editor';
import { SummaryPillList } from '@/features/shared/ui/ui/create-review-card';
import { MediaUpload } from '@/features/file-upload/ui/MediaUpload';
import { CreateSummaryStep } from '../ui/CreateSummaryStep';
import { CreateInputField, CreateTextareaField, CreateTypeaheadField } from '../ui/CreateFields';
import { mergeCreateSearchParams } from '../logic/createSearchParams';
import type { CreateFormConfig } from '../types/create-form.types';

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
  const { allHashtags } = useCommonState({ loadAllHashtags: true });
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

  const handleSubmit = async () => {
    if (!user) return;
    const result = await createStatement(user.id, text.trim(), {
      groupId,
      imageUrl: imageUrl || null,
      videoUrl: videoUrl || null,
      visibility,
    });

    if (result.success && result.statementId) {
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
        for (let i = 0; i < validOptions.length; i++) {
          await createSurveyOption({
            id: crypto.randomUUID(),
            survey_id: surveyId,
            label: validOptions[i].trim(),
            position: i,
          });
        }
      }

      navigate({ to: '/statement/$id', params: { id: result.statementId } });
    }
  };

  const config = useMemo(
    (): CreateFormConfig => ({
      entityType: 'statement',
      title: 'pages.create.statement.title',
      isSubmitting: isLoading,
      onSubmit: handleSubmit,
      steps: [
        {
          label: t('pages.create.statement.textLabel'),
          isValid: () => !!text.trim() && text.length <= MAX_CHARS,
          content: (
            <div className="space-y-4">
              <div className="space-y-2">
                <CreateTextareaField
                  label={t('pages.create.statement.textLabel')}
                  required
                  hint={t('pages.create.statement.tips.text')}
                  value={text}
                  onValueChange={value => setText(value.slice(0, MAX_CHARS))}
                  placeholder={t('pages.create.statement.textPlaceholder')}
                  rows={4}
                  maxLength={MAX_CHARS}
                />
                <p
                  className={`text-xs ${charsRemaining < 20 ? 'text-destructive' : 'text-muted-foreground'}`}
                >
                  {t('features.statements.charsRemaining', { count: charsRemaining })}
                </p>
              </div>
              <CreateTypeaheadField
                label={t('pages.create.statement.attachTo')}
                entityTypes={['group']}
                value={groupId ?? undefined}
                onChange={item => {
                  const nextGroupId = item?.id ?? null;
                  setGroupId(nextGroupId);
                  setGroupName(item?.label ?? '');
                  syncGroupSearch(nextGroupId);
                }}
                placeholder={t('pages.create.statement.groupPlaceholder')}
                filterFn={item => memberGroupIds.has(item.id)}
              />
            </div>
          ),
        },
        {
          label: t('features.statements.survey.addSurvey'),
          isValid: () => true,
          optional: true,
          content: (
            <div className="space-y-4">
              <MediaUpload
                currentImage={imageUrl}
                onImageChange={(url: string) => setImageUrl(url)}
                currentVideo={videoUrl}
                onVideoChange={(url: string) => setVideoUrl(url)}
                entityType="statements"
                entityId={statementId}
                imageLabel={t('pages.create.statement.imageUrl')}
                imageDescription={t('pages.create.statement.imageDescription')}
                videoLabel={t('pages.create.statement.videoUrl')}
                videoDescription={t('pages.create.statement.videoDescription')}
              />
              <div className="space-y-2 rounded-lg border p-4">
                <Label className="text-base font-semibold">
                  {t('features.statements.survey.addSurvey')}
                </Label>
                <CreateInputField
                  label={t('features.statements.survey.question')}
                  value={surveyQuestion}
                  onValueChange={setSurveyQuestion}
                  placeholder={t('features.statements.survey.question')}
                />
                {surveyOptions.map((opt, idx) => (
                  <CreateInputField
                    key={idx}
                    label={`${t('features.statements.survey.option')} ${idx + 1}`}
                    value={opt}
                    onValueChange={value => {
                      const newOpts = [...surveyOptions];
                      newOpts[idx] = value;
                      setSurveyOptions(newOpts);
                    }}
                    placeholder={`${t('features.statements.survey.option')} ${idx + 1}`}
                  />
                ))}
                {surveyOptions.length < 4 && (
                  <button
                    type="button"
                    className="text-primary text-sm hover:underline"
                    onClick={() => setSurveyOptions([...surveyOptions, ''])}
                  >
                    {translateText('generated.inline.0339_add_option_39780ac3')}
                  </button>
                )}
                <div className="space-y-2">
                  <CreateInputField
                    label={t('features.statements.survey.duration')}
                    type="number"
                    min={1}
                    max={168}
                    value={surveyDurationHours}
                    onValueChange={value => setSurveyDurationHours(Number(value) || 1)}
                  />
                </div>
              </div>
            </div>
          ),
        },
        {
          label: t('pages.create.statement.hashtagsLabel'),
          isValid: () => true,
          optional: true,
          content: (
            <HashtagEditor
              value={hashtags}
              onChange={setHashtags}
              placeholder={t('pages.create.statement.hashtagPlaceholder')}
            />
          ),
        },
        {
          label: t('pages.create.common.visibility'),
          isValid: () => true,
          content: <VisibilityInput value={visibility} onChange={setVisibility} />,
        },
        {
          label: t('pages.create.common.review'),
          isValid: () => !!text.trim(),
          content: (
            <CreateSummaryStep
              entityType="statement"
              badge={t('pages.create.statement.reviewBadge')}
              title={t('pages.create.statement.reviewBadge')}
              subtitle={text || undefined}
              secondaryBadge={visibilityLabel}
              media={{
                imageUrl: imageUrl || undefined,
                imageAlt: t('pages.create.statement.reviewBadge'),
                videoUrl: videoUrl || undefined,
              }}
              hashtags={hashtags.length > 0 ? hashtags : undefined}
              sections={[
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
                            value: (
                              <SummaryPillList
                                items={surveyOptions.filter(option => option.trim())}
                              />
                            ),
                          },
                        ],
                      },
                    ]
                  : []),
              ]}
            />
          ),
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
