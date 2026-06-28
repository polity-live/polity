'use client';

import { BadgeControl } from '@/features/shared/ui/status';
import { FormControlInput, FormControlLabel } from '@/features/shared/ui/form';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import { Carousel, CarouselContent, CarouselItem } from '@/features/shared/ui/ui/carousel';
import { HashtagEditor } from '@/features/shared/ui/hashtags';
import { VisibilitySelector } from '@/features/shared/ui/form';
import { TooltipProvider } from '@/features/shared/ui/ui/tooltip';
import { PageWrapper } from '@/layout/page-wrapper';
import { ImageUpload } from '@/features/file-upload/ui/ImageUpload.tsx';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
export interface CreateBlogFormViewProps {
  navigate: any;
  user: any;
  createBlogFull: any;
  blogId: any;
  formData: any;
  setFormData: any;
  isSubmitting: any;
  setIsSubmitting: any;
  carouselApi: any;
  setCarouselApi: any;
  currentStep: any;
  setCurrentStep: any;
  handleSubmit: any;
}

export function CreateBlogFormView({
  blogId,
  formData,
  setFormData,
  isSubmitting,
  carouselApi,
  setCarouselApi,
  currentStep,
  handleSubmit,
}: CreateBlogFormViewProps) {
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
                          {formData.hashtags.map((tag: string, index: number) => (
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
            {[0, 1, 2].map((index: any) => (
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
