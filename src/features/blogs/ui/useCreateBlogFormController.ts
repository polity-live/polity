'use client';

import { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { CarouselApi } from '@/features/shared/ui/ui/carousel';
import { useBlogActions } from '@/zero/blogs/useBlogActions';
import { useAuth } from '@/providers/auth-provider';
import { toast } from '@/features/shared/ui/ui/sonner';
import { createTimelineEvent } from '@/features/timeline/utils/createTimelineEvent';
import { useCommonState, useCommonActions } from '@/zero/common';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
export function useCreateBlogFormController() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { createBlogFull } = useBlogActions();
  const commonActions = useCommonActions();
  const { allHashtags } = useCommonState({ loadAllHashtags: true });

  const [blogId] = useState(() => crypto.randomUUID());
  const [formData, setFormData] = useState({
    title: '',
    date: new Date().toISOString().split('T')[0],
    visibility: 'public' as 'public' | 'authenticated' | 'private',
    hashtags: [] as string[],
    imageURL: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (!carouselApi) {
      return;
    }

    carouselApi.on('select', () => {
      setCurrentStep(carouselApi.selectedScrollSnap());
    });
  }, [carouselApi]);

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      if (!user?.id) {
        toast.error(
          translateText(
            'generated.inline.0272_you_must_be_logged_in_to_create_a_blog_post_eb3475fe'
          )
        );
        setIsSubmitting(false);
        return;
      }

      // blogId already generated upfront for ImageUpload path

      // Create roles for the blog
      const ownerRoleId = crypto.randomUUID();
      const writerRoleId = crypto.randomUUID();

      // Create the blogger entry for the creator (as Owner)
      const bloggerId = crypto.randomUUID();

      // Create action rights for Owner role
      const ownerManageBlogsId = crypto.randomUUID();
      const ownerManageBloggersId = crypto.randomUUID();

      // Create action right for Writer role
      const writerUpdateRightId = crypto.randomUUID();

      await createBlogFull({
        blog: {
          id: blogId,
          title: formData.title,
          description: '',
          content: null,
          date: formData.date,
          image_url: formData.imageURL,
          visibility: formData.visibility,
          like_count: 0,
          comment_count: 0,
          upvotes: 0,
          downvotes: 0,
          editing_mode: '',
          discussions: null,
          group_id: null,
        },
        roles: [
          {
            id: ownerRoleId,
            name: 'Owner',
            description: translateText(
              'generated.inline.0041_blog_owner_with_full_permissions_2ffcc97f'
            ),
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
            description: translateText(
              'generated.inline.0042_blog_writer_with_edit_access_43b09221'
            ),
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
          visibility: formData.visibility,
        },
      });

      // Sync hashtags via junction tables
      if (formData.hashtags.length > 0) {
        await commonActions.syncEntityHashtags(
          'blog',
          blogId,
          formData.hashtags,
          [],
          allHashtags ?? []
        );
      }

      // Add timeline event for public blogs
      if (formData.visibility === 'public') {
        await createTimelineEvent({
          data: {
            eventType: 'created',
            entityType: 'blog',
            entityId: blogId,
            actorId: user.id,
            title: translateText('generated.inline.0043_new_blog_post_title_f664b3ba', {
              title: formData.title,
            }),
            description: translateText(
              'generated.inline.0044_a_new_blog_post_has_been_published_055ff55e'
            ),
          },
        });
      }

      toast.success(translateText('generated.inline.0273_blog_post_created_successfully_b4732330'));
      navigate({ to: '/user/$id/blog/$entryId', params: { id: user.id, entryId: blogId } });
    } catch (error) {
      console.error('Failed to create blog post:', error);
      toast.error(
        translateText('generated.inline.0274_failed_to_create_blog_post_please_try_again_df40668e')
      );
      setIsSubmitting(false);
    }
  };
  return {
    navigate,
    user,
    createBlogFull,
    commonActions,
    allHashtags,
    blogId,
    formData,
    setFormData,
    isSubmitting,
    setIsSubmitting,
    carouselApi,
    setCarouselApi,
    currentStep,
    setCurrentStep,
    handleSubmit,
  };
}
