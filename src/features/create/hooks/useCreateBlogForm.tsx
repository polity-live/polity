import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useAuth } from '@/providers/auth-provider';
import { useBlogActions } from '@/zero/blogs/useBlogActions';
import { useCommonState } from '@/zero/common';
import { useGroupById } from '@/zero/groups/useGroupState';
import { useCreatableGroupIds } from '@/zero/rbac';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { toast } from '@/features/shared/ui/ui/sonner';
import { VisibilityInput } from '../ui/inputs/VisibilityInput';
import { HashtagEditor } from '@/features/shared/ui/hashtags';
import { MediaUpload } from '@/features/file-upload/ui/MediaUpload';
import { CreateSummaryStep } from '../ui/CreateSummaryStep';
import { mergeCreateSearchParams } from '../logic/createSearchParams';
import { extractHashtagTags } from '@/zero/common/hashtagHelpers';
import type { CreateFormConfig, CreateSubmitContext } from '../types/create-form.types';
import {
  createBlockedSubmitOutcome,
  createRouteSubmitTarget,
  createSuccessSubmitOutcome,
} from '../logic/createSubmitTargets';
import { consumeCreateRestoreDraft, trackCreateFinalization } from '../logic/createFinalization';
import { formatLocalDateInput } from '@/features/shared/logic/localDateTime';

interface CreateBlogSearch {
  groupId?: string;
}

export function useCreateBlogForm(): CreateFormConfig {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const searchParams = useSearch({ strict: false }) as CreateBlogSearch;
  const groupIdParam = searchParams.groupId ?? '';
  const { user } = useAuth();
  const { createBlogFull } = useBlogActions();
  const { userHashtags } = useCommonState({
    user_id: user?.id,
  });
  const preferredHashtagSuggestions = useMemo(
    () => extractHashtagTags(userHashtags),
    [userHashtags]
  );
  const { creatableGroupIds: blogCreatableGroupIds, isLoading: groupPermissionLoading } =
    useCreatableGroupIds('blogs');

  const [blogId] = useState(() => crypto.randomUUID());
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(() => formatLocalDateInput(new Date()));
  const [visibility, setVisibility] = useState<'public' | 'authenticated' | 'private'>('public');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [imageURL, setImageURL] = useState('');
  const [videoURL, setVideoURL] = useState('');
  const [groupId, setGroupId] = useState<string | null>(() => groupIdParam || null);
  const [groupName, setGroupName] = useState<string>('');
  const { group } = useGroupById(groupId ?? undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const selectedGroupPermissionPending = Boolean(groupId && groupPermissionLoading);
  const selectedGroupPermissionDenied = Boolean(
    groupId && !groupPermissionLoading && !blogCreatableGroupIds.has(groupId)
  );
  const selectedGroupIsValid =
    !groupId || (!selectedGroupPermissionPending && !selectedGroupPermissionDenied);
  const groupPermissionInvalidReason = selectedGroupPermissionPending
    ? t('pages.create.blog.validation.groupPermissionPending')
    : selectedGroupPermissionDenied
      ? t('pages.create.blog.validation.groupPermissionDenied')
      : null;
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
    const restoreDraft = consumeCreateRestoreDraft<{
      title?: string;
      date?: string;
      imageURL?: string;
      videoURL?: string;
      visibility?: 'public' | 'authenticated' | 'private';
      groupId?: string | null;
      hashtags?: string[];
    }>('blog');
    if (!restoreDraft) return;

    setTitle(restoreDraft.formState.title ?? '');
    setDate(restoreDraft.formState.date ?? formatLocalDateInput(new Date()));
    setImageURL(restoreDraft.formState.imageURL ?? '');
    setVideoURL(restoreDraft.formState.videoURL ?? '');
    setVisibility(restoreDraft.formState.visibility ?? 'public');
    setGroupId(restoreDraft.formState.groupId ?? null);
    setHashtags(restoreDraft.formState.hashtags ?? []);
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
      to: '/create/blog-entry',
      search: mergeCreateSearchParams(searchParams, {
        groupId: nextGroupId || undefined,
      }),
      replace: true,
    });
  };

  const handleSubmit = async (context?: CreateSubmitContext) => {
    if (!user?.id || !title.trim()) return createBlockedSubmitOutcome();
    if (!selectedGroupIsValid) {
      toast.error(groupPermissionInvalidReason ?? t('pages.create.error.createFailed'));
      return createBlockedSubmitOutcome();
    }
    setIsSubmitting(true);

    try {
      context?.reportProgress({ key: 'create', status: 'active' });

      const createBlogPayload = {
        blog: {
          id: blogId,
          title: title.trim(),
          description: '',
          content: null,
          date,
          image_url: imageURL || null,
          video_url: videoURL || null,
          visibility,
          like_count: 0,
          comment_count: 0,
          upvotes: 0,
          downvotes: 0,
          editing_mode: '',
          discussions: null,
          group_id: groupId,
        },
        hashtags,
        timeline_event:
          visibility === 'public'
            ? {
                id: crypto.randomUUID(),
                event_type: 'created',
                entity_type: 'blog',
                entity_id: blogId,
                actor_id: user.id,
                title: translateText('generated.inline.0055_new_blog_post_value2775_8f2fb838', {
                  value2775: title.trim(),
                }),
                description: translateText(
                  'generated.inline.0044_a_new_blog_post_has_been_published_055ff55e'
                ),
                metadata: null,
                image_url: imageURL || '',
                video_url: videoURL || '',
                video_thumbnail_url: '',
                content_type: 'blog',
                tags: null,
                stats: null,
                vote_status: '',
                election_status: '',
                ends_at: 0,
                user_id: null,
                group_id: groupId || null,
                amendment_id: null,
                event_id: null,
                todo_id: null,
                blog_id: blogId,
                statement_id: null,
                election_id: null,
                amendment_vote_id: null,
              }
            : null,
      };
      const createBlogResults = createBlogFull(createBlogPayload, {
        notificationMode: 'silent',
      });
      await createBlogResults.blogResult.client;
      context?.reportProgress({ key: 'create', status: 'complete' });
      context?.reportProgress({ key: 'sync', status: 'active' });

      context?.reportProgress({ key: 'sync', status: 'complete' });
      context?.reportProgress({ key: 'ready', status: 'active' });
      setIsSubmitting(false);

      if (groupId) {
        const target = createRouteSubmitTarget('blog', {
          to: '/group/$id/blog/$entryId',
          params: { id: groupId, entryId: blogId },
        });
        trackCreateFinalization({
          result: createBlogResults.blogResult,
          draft: {
            id: `blog:${blogId}`,
            entityType: 'blog',
            entityId: blogId,
            createPath: '/create/blog-entry',
            formState: { title, date, imageURL, videoURL, visibility, groupId, hashtags },
            mutationPayload: createBlogPayload,
            target,
          },
        });
        return createSuccessSubmitOutcome(target);
      }

      const target = createRouteSubmitTarget('blog', {
        to: '/user/$id/blog/$entryId',
        params: { id: user.id, entryId: blogId },
      });
      trackCreateFinalization({
        result: createBlogResults.blogResult,
        draft: {
          id: `blog:${blogId}`,
          entityType: 'blog',
          entityId: blogId,
          createPath: '/create/blog-entry',
          formState: { title, date, imageURL, videoURL, visibility, groupId, hashtags },
          mutationPayload: createBlogPayload,
          target,
        },
      });
      return createSuccessSubmitOutcome(target);
    } catch (error) {
      toast.error(t('pages.create.error.createFailed'));
      setIsSubmitting(false);
      throw error;
    }
  };

  const config = useMemo(
    (): CreateFormConfig => ({
      entityType: 'blog',
      title: 'pages.create.blog.title',
      isSubmitting,
      onSubmit: handleSubmit,
      submissionSteps: [
        { key: 'create', label: t('pages.create.progress.submission.steps.blog.create') },
        { key: 'sync', label: t('pages.create.progress.submission.steps.blog.sync') },
        { key: 'ready', label: t('pages.create.progress.submission.steps.blog.ready') },
      ],
      steps: [
        {
          label: t('pages.create.blog.basicInfo'),
          isValid: () => !!title.trim() && selectedGroupIsValid,
          getInvalidReason: () =>
            !title.trim()
              ? t('pages.create.validation.titleRequired')
              : groupPermissionInvalidReason,
          fields: [
            {
              key: 'title',
              kind: 'text',
              label: t('pages.create.blog.titleLabel'),
              required: true,
              hint: t('pages.create.blog.tips.title'),
              value: title,
              onValueChange: setTitle,
              placeholder: t('pages.create.blog.titlePlaceholder'),
            },
            {
              key: 'date',
              kind: 'text',
              label: t('pages.create.blog.dateLabel'),
              hint: t('pages.create.blog.tips.date'),
              value: date,
              onValueChange: setDate,
              type: 'date',
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
                entityType: 'blogs',
                entityId: blogId,
                imageLabel: t('pages.create.blog.coverImage'),
                imageDescription: t('pages.create.blog.coverImageDescription'),
                videoLabel: t('common.actions.uploadVideo'),
                videoDescription: t('common.media.videoDescription'),
              },
            },
            {
              key: 'group',
              kind: 'typeahead',
              label: t('pages.create.blog.attachTo'),
              invalid: selectedGroupPermissionDenied,
              error: selectedGroupPermissionDenied ? groupPermissionInvalidReason : undefined,
              props: {
                entityTypes: ['group'],
                value: groupId ?? undefined,
                onChange: item => {
                  const nextGroupId = item?.id ?? null;
                  setGroupId(nextGroupId);
                  setGroupName(item?.label ?? '');
                  syncGroupSearch(nextGroupId);
                },
                placeholder: t('pages.create.blog.groupPlaceholder'),
                filterFn: item => blogCreatableGroupIds.has(item.id),
              },
            },
          ],
        },
        {
          label: t('pages.create.blog.visibilityAndTags'),
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
                placeholder: t('pages.create.blog.hashtagPlaceholder'),
                preferredSuggestions: preferredHashtagSuggestions,
              },
            },
          ],
        },
        {
          label: t('pages.create.common.review'),
          isValid: () => !!title.trim() && selectedGroupIsValid,
          getInvalidReason: () =>
            !title.trim()
              ? t('pages.create.validation.titleRequired')
              : groupPermissionInvalidReason,
          fields: [
            {
              key: 'review',
              kind: 'customComponent',
              component: CreateSummaryStep,
              props: {
                entityType: 'blog',
                badge: t('pages.create.blog.reviewBadge'),
                secondaryBadge: visibilityLabel,
                title: title || t('pages.create.blog.titlePlaceholder'),
                media: {
                  imageUrl: imageURL || undefined,
                  imageAlt: title || t('pages.create.blog.coverImageAlt'),
                  videoUrl: videoURL || undefined,
                },
                hashtags: hashtags.length > 0 ? hashtags : undefined,
                sections: [
                  {
                    title: t('pages.create.blog.basicInfo'),
                    fields: [
                      { label: t('pages.create.blog.dateLabel'), value: date },
                      ...(groupName
                        ? [
                            {
                              label: t('pages.create.blog.attachTo'),
                              value: groupName,
                            },
                          ]
                        : []),
                    ],
                  },
                  {
                    title: t('pages.create.blog.visibilityAndTags'),
                    fields: [
                      {
                        label: t('pages.create.common.visibility'),
                        value: visibilityLabel,
                      },
                      ...(imageURL
                        ? [
                            {
                              label: t('pages.create.blog.coverImage'),
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
      date,
      visibility,
      visibilityLabel,
      hashtags,
      preferredHashtagSuggestions,
      imageURL,
      videoURL,
      isSubmitting,
      blogId,
      groupId,
      groupName,
      groupPermissionInvalidReason,
      t,
      blogCreatableGroupIds,
      selectedGroupIsValid,
      selectedGroupPermissionDenied,
      syncGroupSearch,
    ]
  );

  return config;
}
