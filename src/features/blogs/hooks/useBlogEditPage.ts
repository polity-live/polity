import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { toast } from '@/features/shared/ui/ui/sonner';
import { useBlogState } from '@/zero/blogs/useBlogState';
import { useBlogActions } from '@/zero/blogs/useBlogActions';
import { useCommonState, useCommonActions } from '@/zero/common';
import { createTimelineEvent } from '@/features/timeline/utils/createTimelineEvent';
import { type Visibility } from '@/features/auth/logic/checkEntityAccess';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { waitForClientApply } from '@/zero/mutate-with-server-check';
import { formatLocalDateInput } from '@/features/shared/logic/localDateTime';

export interface BlogFormData {
  title: string;
  date: string;
  imageURL: string;
  videoURL: string;
  visibility: Visibility;
  hashtags: string[];
}

function createInitialBlogFormData(): BlogFormData {
  return {
    title: '',
    date: formatLocalDateInput(new Date()),
    imageURL: '',
    videoURL: '',
    visibility: 'public',
    hashtags: [],
  };
}

/**
 * Hook for blog update functionality
 */
export function useBlogEditPage(
  blogId: string,
  actorId?: string,
  routeContext: { groupId?: string; userId?: string } = {}
) {
  const navigate = useNavigate();
  const { updateBlog } = useBlogActions();
  const commonActions = useCommonActions();

  const [formData, setFormData] = useState<BlogFormData>(createInitialBlogFormData);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch blog data
  const { blogWithHashtags, isLoading: isBlogLoading } = useBlogState({
    blogId,
    includeHashtags: true,
  });
  const {
    blogHashtags,
    allHashtags,
    isLoading: isCommonLoading,
  } = useCommonState({
    blog_id: blogId,
    loadAllHashtags: true,
  });
  const isLoading = isBlogLoading || isCommonLoading;

  const blog = blogWithHashtags;

  const initializedRef = useRef<string | null>(null);
  const hashtagsInitializedRef = useRef<string | null>(null);
  const formEntityIdRef = useRef(blogId);

  useEffect(() => {
    if (formEntityIdRef.current === blogId) return;

    formEntityIdRef.current = blogId;
    initializedRef.current = null;
    hashtagsInitializedRef.current = null;
    setFormData(createInitialBlogFormData());
  }, [blogId]);

  // Initialize form data only once when blog first loads
  useEffect(() => {
    if (blog && blog.id === blogId && initializedRef.current !== blogId) {
      initializedRef.current = blogId;
      const existingTags = (blogHashtags ?? [])
        .map(j => j.hashtag?.tag)
        .filter((t): t is string => !!t);
      setFormData({
        title: blog.title || '',
        date: blog.date || formatLocalDateInput(new Date()),
        imageURL: blog.image_url || '',
        videoURL: blog.video_url || '',
        visibility: (blog.visibility as Visibility) ?? 'public',
        hashtags: existingTags.length > 0 ? existingTags : [],
      });
    }
  }, [blog, blogHashtags, blogId]);

  // Initialize hashtags from junction data once available (may load after blog)
  useEffect(() => {
    if (!isCommonLoading && blog?.id === blogId && hashtagsInitializedRef.current !== blogId) {
      hashtagsInitializedRef.current = blogId;
      const tags = (blogHashtags ?? []).map(j => j.hashtag?.tag).filter((t): t is string => !!t);
      setFormData(prev => ({ ...prev, hashtags: tags }));
    }
  }, [blog, blogHashtags, blogId, isCommonLoading]);

  // Update a single field
  const updateField = <K extends keyof BlogFormData>(field: K, value: BlogFormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const removeImage = () => {
    updateField('imageURL', '');
  };

  const navigateToBlog = () => {
    const groupId = routeContext.groupId ?? blog?.group_id;
    const userId = routeContext.userId ?? actorId;

    if (groupId) {
      navigate({
        to: '/group/$id/blog/$entryId',
        params: { id: groupId, entryId: blogId },
      });
      return;
    }

    if (userId) {
      navigate({ to: '/user/$id/blog/$entryId', params: { id: userId, entryId: blogId } });
      return;
    }

    navigate({ to: '/blog/$id', params: { id: blogId } });
  };

  // Submit handler
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (!blog) {
        toast.error(translateText('generated.inline.0220_no_blog_data_to_update_2e040d48'));
        return;
      }

      await waitForClientApply(
        updateBlog({
          id: blogId,
          title: formData.title,
          date: formData.date,
          image_url: formData.imageURL || null,
          video_url: formData.videoURL || null,
          visibility: formData.visibility,
        })
      );

      // Timeline remains best-effort on the client; notifications are server-driven.
      try {
        if (formData.visibility === 'public' && actorId) {
          if (formData.imageURL && formData.imageURL !== blog.image_url) {
            void createTimelineEvent({
              data: {
                eventType: 'image_uploaded',
                entityType: 'blog',
                entityId: blogId,
                actorId,
                title: translateText('generated.inline.0034_title_image_updated_36acb476', {
                  title: formData.title,
                }),
                description: translateText(
                  'generated.inline.0035_a_new_image_was_uploaded_to_this_blog_post_c0b0e0ce'
                ),
                contentType: 'image',
              },
            });
          }
          if (formData.videoURL && formData.videoURL !== blog.video_url) {
            void createTimelineEvent({
              data: {
                eventType: 'video_uploaded',
                entityType: 'blog',
                entityId: blogId,
                actorId,
                title: translateText('features.timeline.videoUploadedTitle'),
                description: translateText('features.timeline.videoUploadedDescription', {
                  title: formData.title,
                }),
                contentType: 'video',
              },
            });
          }
        }
      } catch {
        /* timeline delivery is best-effort */
      }

      // Sync hashtags via junction tables
      await commonActions.syncEntityHashtags(
        'blog',
        blogId,
        formData.hashtags,
        blogHashtags ?? [],
        allHashtags ?? []
      );

      toast.success(translateText('generated.inline.0221_blog_updated_successfully_8a7cc27d'));
      navigateToBlog();
    } catch (error) {
      console.error('Update error:', error);
      toast.error(translateText('generated.inline.0222_failed_to_update_blog_68056f92'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    formData,
    setFormData,
    updateField,
    removeImage,
    handleSubmit,
    isSubmitting,
    blog,
    isLoading,
    navigateToBlog,
  };
}
