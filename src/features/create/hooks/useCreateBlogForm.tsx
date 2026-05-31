import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useAuth } from '@/providers/auth-provider';
import { useBlogActions } from '@/zero/blogs/useBlogActions';
import { useCommonState, useCommonActions } from '@/zero/common';
import { useGroupById, useGroupState } from '@/zero/groups/useGroupState';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { toast } from 'sonner';
import { VisibilityInput } from '../ui/inputs/VisibilityInput';
import { HashtagEditor } from '@/features/shared/ui/ui/hashtag-editor';
import { ImageUpload } from '@/features/file-upload/ui/ImageUpload.tsx';
import { CreateSummaryStep } from '../ui/CreateSummaryStep';
import { CreateInputField, CreateTypeaheadField } from '../ui/CreateFields';
import { mergeCreateSearchParams } from '../logic/createSearchParams';
import { createTimelineEvent } from '@/features/timeline/utils/createTimelineEvent';
import { serverConfirmed } from '@/zero/mutate-with-server-check';
import type { CreateFormConfig } from '../types/create-form.types';

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
  const { allHashtags } = useCommonState({ loadAllHashtags: true });
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
    visibility === 'public'
      ? t('pages.create.common.public')
      : visibility === 'authenticated'
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

  const handleSubmit = async () => {
    if (!user?.id || !title.trim()) return;
    setIsSubmitting(true);

    try {
      const ownerRoleId = crypto.randomUUID();
      const writerRoleId = crypto.randomUUID();
      const bloggerId = crypto.randomUUID();
      const ownerManageBlogsId = crypto.randomUUID();
      const ownerManageBloggersId = crypto.randomUUID();
      const writerUpdateRightId = crypto.randomUUID();

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
        roles: [
          {
            id: ownerRoleId,
            name: 'Owner',
            description: 'Blog owner with full permissions',
            scope: 'blog',
            group_id: null,
            event_id: null,
            amendment_id: null,
            blog_id: blogId,
            sort_order: 1,
          },
          {
            id: writerRoleId,
            name: 'Writer',
            description: 'Blog writer with edit access',
            scope: 'blog',
            group_id: null,
            event_id: null,
            amendment_id: null,
            blog_id: blogId,
            sort_order: 0,
          },
        ],
        actionRights: [
          {
            id: ownerManageBlogsId,
            resource: 'blogs',
            action: 'manage',
            role_id: ownerRoleId,
            group_id: null,
            event_id: null,
            amendment_id: null,
            blog_id: blogId,
          },
          {
            id: ownerManageBloggersId,
            resource: 'blogBloggers',
            action: 'manage',
            role_id: ownerRoleId,
            group_id: null,
            event_id: null,
            amendment_id: null,
            blog_id: blogId,
          },
          {
            id: writerUpdateRightId,
            resource: 'blogs',
            action: 'update',
            role_id: writerRoleId,
            group_id: null,
            event_id: null,
            amendment_id: null,
            blog_id: blogId,
          },
        ],
        entry: {
          id: bloggerId,
          blog_id: blogId,
          user_id: user.id,
          role_id: ownerRoleId,
          status: 'member',
          visibility,
        },
      });
      await Promise.all([
        serverConfirmed(createBlogResults.blogResult),
        ...createBlogResults.roleResults.map(serverConfirmed),
        ...createBlogResults.actionRightResults.map(serverConfirmed),
        serverConfirmed(createBlogResults.entryResult),
      ]);

      if (hashtags.length > 0) {
        await commonActions.syncEntityHashtags('blog', blogId, hashtags, [], allHashtags ?? []);
      }

      if (visibility === 'public') {
        await createTimelineEvent({
          data: {
            eventType: 'created',
            entityType: 'blog',
            entityId: blogId,
            actorId: user.id,
            title: `New blog post: ${title.trim()}`,
            description: 'A new blog post has been published',
          },
        });
      }

      toast.success(t('pages.create.success.created'));
      if (groupId) {
        navigate({ to: '/group/$id/blog/$entryId', params: { id: groupId, entryId: blogId } });
      } else {
        navigate({ to: '/user/$id/blog/$entryId', params: { id: user.id, entryId: blogId } });
      }
    } catch {
      toast.error(t('pages.create.error.createFailed'));
      setIsSubmitting(false);
    }
  };

  const config = useMemo(
    (): CreateFormConfig => ({
      entityType: 'blog',
      title: 'pages.create.blog.title',
      isSubmitting,
      onSubmit: handleSubmit,
      steps: [
        {
          label: t('pages.create.blog.basicInfo'),
          isValid: () => !!title.trim(),
          content: (
            <div className="space-y-4">
              <CreateInputField
                label={t('pages.create.blog.titleLabel')}
                required
                hint={t('pages.create.blog.tips.title')}
                value={title}
                onValueChange={setTitle}
                placeholder={t('pages.create.blog.titlePlaceholder')}
              />
              <CreateInputField
                label={t('pages.create.blog.dateLabel')}
                hint={t('pages.create.blog.tips.date')}
                value={date}
                onValueChange={setDate}
                type="date"
              />
              <ImageUpload
                currentImage={imageURL}
                onImageChange={(url: string) => setImageURL(url)}
                cleanupOnRemove
                entityType="blogs"
                entityId={blogId}
                label={t('pages.create.blog.coverImage')}
                description={t('pages.create.blog.coverImageDescription')}
              />
              <CreateTypeaheadField
                label={t('pages.create.blog.attachTo', 'Attach to group (optional)')}
                entityTypes={['group']}
                value={groupId ?? undefined}
                onChange={item => {
                  const nextGroupId = item?.id ?? null;
                  setGroupId(nextGroupId);
                  setGroupName(item?.label ?? '');
                  syncGroupSearch(nextGroupId);
                }}
                placeholder={t('pages.create.blog.groupPlaceholder', 'Search groups...')}
                filterFn={item => memberGroupIds.has(item.id)}
              />
            </div>
          ),
        },
        {
          label: t('pages.create.blog.visibilityAndTags'),
          isValid: () => true,
          optional: true,
          content: (
            <div className="space-y-4">
              <VisibilityInput value={visibility} onChange={setVisibility} />
              <HashtagEditor
                value={hashtags}
                onChange={setHashtags}
                placeholder={t('pages.create.blog.hashtagPlaceholder')}
              />
            </div>
          ),
        },
        {
          label: t('pages.create.common.review'),
          isValid: () => !!title.trim(),
          content: (
            <CreateSummaryStep
              entityType="blog"
              badge={t('pages.create.blog.reviewBadge')}
              secondaryBadge={visibilityLabel}
              title={title || t('pages.create.blog.titlePlaceholder')}
              media={
                imageURL ? { imageUrl: imageURL, imageAlt: title || 'Blog cover image' } : undefined
              }
              hashtags={hashtags.length > 0 ? hashtags : undefined}
              sections={[
                {
                  title: t('pages.create.blog.basicInfo'),
                  fields: [
                    { label: t('pages.create.blog.dateLabel'), value: date },
                    ...(groupName
                      ? [
                          {
                            label: t('pages.create.blog.attachTo', 'Attach to group'),
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
              ]}
            />
          ),
        },
      ],
    }),
    [
      title,
      date,
      visibility,
      visibilityLabel,
      hashtags,
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
