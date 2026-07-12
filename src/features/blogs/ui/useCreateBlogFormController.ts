'use client';

import { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { CarouselApi } from '@/features/shared/ui/ui/carousel';
import { useBlogActions } from '@/zero/blogs/useBlogActions';
import { useAuth } from '@/providers/auth-provider';
import { toast } from '@/features/shared/ui/ui/sonner';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { waitForClientApply } from '@/zero/mutate-with-server-check';
export function useCreateBlogFormController() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { createBlogFull } = useBlogActions();

  const [blogId] = useState(() => crypto.randomUUID());
  const [formData, setFormData] = useState({
    title: '',
    date: new Date().toISOString().split('T')[0],
    visibility: 'public' as 'public' | 'authenticated' | 'private',
    hashtags: [] as string[],
    imageURL: '',
    videoURL: '',
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

      const createBlogResults = createBlogFull({
        blog: {
          id: blogId,
          title: formData.title,
          description: '',
          content: null,
          date: formData.date,
          image_url: formData.imageURL || null,
          video_url: formData.videoURL || null,
          visibility: formData.visibility,
          like_count: 0,
          comment_count: 0,
          upvotes: 0,
          downvotes: 0,
          editing_mode: '',
          discussions: null,
          group_id: null,
        },
        hashtags: formData.hashtags,
        timeline_event:
          formData.visibility === 'public'
            ? {
                id: crypto.randomUUID(),
                event_type: 'created',
                entity_type: 'blog',
                entity_id: blogId,
                actor_id: user.id,
                title: translateText('generated.inline.0043_new_blog_post_title_f664b3ba', {
                  title: formData.title,
                }),
                description: translateText(
                  'generated.inline.0044_a_new_blog_post_has_been_published_055ff55e'
                ),
                metadata: null,
                image_url: formData.imageURL || '',
                video_url: formData.videoURL || '',
                video_thumbnail_url: '',
                content_type: 'blog',
                tags: null,
                stats: null,
                vote_status: '',
                election_status: '',
                ends_at: 0,
                user_id: null,
                group_id: null,
                amendment_id: null,
                event_id: null,
                todo_id: null,
                blog_id: blogId,
                statement_id: null,
                election_id: null,
                amendment_vote_id: null,
              }
            : null,
      });
      await waitForClientApply(createBlogResults.blogResult);

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
