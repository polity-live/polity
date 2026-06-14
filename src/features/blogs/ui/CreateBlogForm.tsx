'use client';

import { BadgeControl } from '@/features/shared/ui/status';
import { FormControlInput, FormControlLabel } from '@/features/shared/ui/form';
import { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselApi,
} from '@/features/shared/ui/ui/carousel';
import { HashtagEditor } from '@/features/shared/ui/hashtags';
import { VisibilitySelector } from '@/features/shared/ui/form';
import { TooltipProvider } from '@/features/shared/ui/ui/tooltip';
import { useBlogActions } from '@/zero/blogs/useBlogActions';
import { useAuth } from '@/providers/auth-provider';
import { toast } from '@/features/shared/ui/ui/sonner';
import { PageWrapper } from '@/layout/page-wrapper';
import { createTimelineEvent } from '@/features/timeline/utils/createTimelineEvent';
import { ImageUpload } from '@/features/file-upload/ui/ImageUpload.tsx';
import { useCommonState, useCommonActions } from '@/zero/common';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

export function CreateBlogForm() {
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

  return (
    <PageWrapper className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>
            {translateText('generated.inline.0275_create_a_new_blog_post_cb5b1e3f')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Carousel setApi={setCarouselApi} opts={{ watchDrag: false }}>
            <CarouselContent>
              {/* Step 1: Basic Information */}
              <CarouselItem>
                <div className="space-y-4 p-4">
                  <div className="space-y-2">
                    <FormControlLabel htmlFor="blog-title">
                      {translateText('generated.inline.0028_title_768e0c1c')}
                    </FormControlLabel>
                    <FormControlInput
                      id="blog-title"
                      placeholder={translateText('generated.inline.0276_enter_blog_title_37b29848')}
                      value={formData.title}
                      onChange={e => setFormData({ ...formData, title: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <FormControlLabel htmlFor="blog-date">
                      {translateText('generated.inline.0277_date_eb9a4bc1')}
                    </FormControlLabel>
                    <FormControlInput
                      id="blog-date"
                      type="date"
                      value={formData.date}
                      onChange={e => setFormData({ ...formData, date: e.target.value })}
                      required
                    />
                  </div>
                  <ImageUpload
                    currentImage={formData.imageURL}
                    onImageChange={(url: string) => setFormData({ ...formData, imageURL: url })}
                    cleanupOnRemove
                    entityType="blogs"
                    entityId={blogId}
                    label={translateText('generated.inline.0278_cover_image_dbc62fcb')}
                    description={translateText(
                      'generated.inline.0279_upload_a_cover_image_for_your_blog_post_91a4eeda'
                    )}
                  />
                </div>
              </CarouselItem>

              {/* Step 2: Visibility & Hashtags */}
              <CarouselItem>
                <div className="space-y-4 p-4">
                  <TooltipProvider>
                    <VisibilitySelector
                      value={formData.visibility}
                      onChange={visibility => setFormData({ ...formData, visibility })}
                    />

                    {/* Hashtags */}
                    <div className="mt-4 space-y-2">
                      <HashtagEditor
                        value={formData.hashtags}
                        onChange={hashtags => setFormData({ ...formData, hashtags })}
                        placeholder={translateText(
                          'generated.inline.0280_add_hashtags_e_g_politics_community_f9cf31f0'
                        )}
                      />
                    </div>
                  </TooltipProvider>
                </div>
              </CarouselItem>

              {/* Step 3: Review */}
              <CarouselItem>
                <div className="p-4">
                  <Card surface="warmGradient" className="overflow-hidden">
                    <CardHeader>
                      <div className="mb-2 flex items-center justify-between">
                        <BadgeControl variant="default" size="xs">
                          {translateText('generated.inline.0281_blog_post_6c8d4a5b')}
                        </BadgeControl>
                        <BadgeControl variant="outline" size="xs">
                          {formData.visibility}
                        </BadgeControl>
                      </div>
                      {formData.hashtags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {formData.hashtags.map((tag, index) => (
                            <BadgeControl key={index} variant="secondary" size="xs">
                              #{tag}
                            </BadgeControl>
                          ))}
                        </div>
                      )}
                      <CardTitle className="text-lg">
                        {formData.title ||
                          translateText('generated.inline.0038_untitled_blog_post_e14c152e')}
                      </CardTitle>
                      <CardDescription>{formData.date}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <strong>
                          {translateText('generated.inline.0282_visibility_bb42ff6a')}
                        </strong>
                        <span className="text-muted-foreground">{formData.visibility}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CarouselItem>
            </CarouselContent>
          </Carousel>
          <div className="mt-4 flex justify-center gap-2">
            {[0, 1, 2].map(index => (
              <Button
                key={index}
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => carouselApi?.scrollTo(index)}
                className={`h-2 w-2 rounded-full p-0 transition-colors ${
                  currentStep === index ? 'bg-primary' : 'bg-muted-foreground/30'
                }`}
                aria-label={`Go to step ${index + 1}`}
              />
            ))}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => carouselApi?.scrollPrev()}
            disabled={currentStep === 0}
          >
            {translateText('generated.inline.0046_previous_50f94286')}
          </Button>
          {currentStep < 2 ? (
            <Button
              type="button"
              onClick={() => carouselApi?.scrollNext()}
              disabled={currentStep === 0 && !formData.title}
            >
              {translateText('generated.inline.0047_next_bc981983')}
            </Button>
          ) : (
            <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting
                ? translateText('generated.inline.0013_creating_28ea7667')
                : translateText('generated.inline.0039_create_blog_post_94626f08')}
            </Button>
          )}
        </CardFooter>
      </Card>
    </PageWrapper>
  );
}
