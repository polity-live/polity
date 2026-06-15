import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useAuth } from '@/providers/auth-provider';
import { useBlogActions } from '@/zero/blogs/useBlogActions';
import { useCommonState, useCommonActions } from '@/zero/common';
import { useGroupById, useGroupState } from '@/zero/groups/useGroupState';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { toast } from '@/features/shared/ui/ui/sonner';
import { VisibilityInput } from '../ui/inputs/VisibilityInput';
import { HashtagEditor } from '@/features/shared/ui/hashtags';
import { ImageUpload } from '@/features/file-upload/ui/ImageUpload.tsx';
import { CreateSummaryStep } from '../ui/CreateSummaryStep';
import { mergeCreateSearchParams } from '../logic/createSearchParams';
import { createTimelineEvent } from '@/features/timeline/utils/createTimelineEvent';
import { serverConfirmed } from '@/zero/mutate-with-server-check';
import { extractHashtagTags } from '@/zero/common/hashtagHelpers';
import type { CreateFormConfig, CreateSubmitContext } from '../types/create-form.types';
import {
  createBlockedSubmitOutcome,
  createRouteSubmitTarget,
  createSuccessSubmitOutcome,
} from '../logic/createSubmitTargets';

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
  const commonActions = useCommonActions();
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

  const [blogId] = useState(() => crypto.randomUUID());
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [visibility, setVisibility] = useState<'public' | 'authenticated' | 'private'>('public');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [imageURL, setImageURL] = useState('');
  const [groupId, setGroupId] = useState<string | null>(() => groupIdParam || null);
  const [groupName, setGroupName] = useState<string>('');
  const { group } = useGroupById(groupId ?? undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
      to: '/create/blog-entry',
      search: mergeCreateSearchParams(searchParams, {
        groupId: nextGroupId || undefined,
      }),
      replace: true,
    });
  };

  const handleSubmit = async (context?: CreateSubmitContext) => {
    if (!user?.id || !title.trim()) return createBlockedSubmitOutcome();
    setIsSubmitting(true);

    try {
      context?.reportProgress({ key: 'create', status: 'active' });

      const createBlogResults = createBlogFull({
        blog: {
          id: blogId,
          title: title.trim(),
          description: '',
          content: null,
          date,
          image_url: imageURL,
          visibility,
          like_count: 0,
          comment_count: 0,
          upvotes: 0,
          downvotes: 0,
          editing_mode: '',
          discussions: null,
          group_id: groupId,
        },
      });
      await serverConfirmed(createBlogResults.blogResult);
      context?.reportProgress({ key: 'create', status: 'complete' });
      context?.reportProgress({ key: 'sync', status: 'active' });

      await Promise.all([
        hashtags.length > 0
          ? commonActions.syncEntityHashtags('blog', blogId, hashtags, [], allHashtags ?? [])
          : Promise.resolve(),
        visibility === 'public'
          ? createTimelineEvent({
              data: {
                eventType: 'created',
                entityType: 'blog',
                entityId: blogId,
                actorId: user.id,
                title: translateText('generated.inline.0055_new_blog_post_value2775_8f2fb838', {
                  value2775: title.trim(),
                }),
                description: translateText(
                  'generated.inline.0044_a_new_blog_post_has_been_published_055ff55e'
                ),
              },
            })
          : Promise.resolve(),
      ]);

      toast.success(t('pages.create.success.created'));
      context?.reportProgress({ key: 'sync', status: 'complete' });
      context?.reportProgress({ key: 'ready', status: 'active' });
      setIsSubmitting(false);
      if (groupId) {
        return createSuccessSubmitOutcome(
          createRouteSubmitTarget('blog', {
            to: '/group/$id/blog/$entryId',
            params: { id: groupId, entryId: blogId },
          })
        );
      }

      return createSuccessSubmitOutcome(
        createRouteSubmitTarget('blog', {
          to: '/user/$id/blog/$entryId',
          params: { id: user.id, entryId: blogId },
        })
      );
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
        { key: 'create', label: 'Erstellt Blog' },
        { key: 'sync', label: 'Synchronisiert Rollen und Timeline' },
        { key: 'ready', label: 'Bereitet Blogseite vor' },
      ],
      steps: [
        {
          label: t('pages.create.blog.basicInfo'),
          isValid: () => !!title.trim(),
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
              key: 'image',
              kind: 'customComponent',
              component: ImageUpload,
              props: {
                currentImage: imageURL,
                onImageChange: (url: string) => setImageURL(url),
                cleanupOnRemove: true,
                entityType: 'blogs',
                entityId: blogId,
                label: t('pages.create.blog.coverImage'),
                description: t('pages.create.blog.coverImageDescription'),
              },
            },
            {
              key: 'group',
              kind: 'typeahead',
              label: t('pages.create.blog.attachTo'),
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
                filterFn: item => memberGroupIds.has(item.id),
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
          isValid: () => !!title.trim(),
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
                media: imageURL
                  ? { imageUrl: imageURL, imageAlt: title || 'Blog cover image' }
                  : undefined,
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
                        ? [{ label: t('pages.create.blog.coverImage'), value: 'Attached' }]
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
      isSubmitting,
      blogId,
      groupId,
      groupName,
      t,
      memberGroupIds,
      syncGroupSearch,
    ]
  );

  return config;
}
