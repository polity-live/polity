import { FormControlInput, FormControlLabel } from '@/features/shared/ui/form';
/**
 * Blog Edit Component
 *
 * Complete blog editing UI with authorization checks,
 * loading states, and form management.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import { hasMinLength } from '@/features/shared/logic/inputValidation';
import { ValidatedInputField } from '@/features/shared/ui/form/ValidatedInputField';
import { VisibilityInput } from '@/features/create/ui/inputs/VisibilityInput';
import { Loader2 } from 'lucide-react';
import { MediaUpload } from '@/features/file-upload/ui/MediaUpload';
import { HashtagEditor } from '@/features/shared/ui/hashtags';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { PageSkeleton } from '@/features/shared/ui/feedback';
import { SettingsActionBar, SettingsPage, SettingsTabs } from '@/features/shared/ui/form';
import { TabsContent } from '@/features/shared/ui/ui/tabs';
export interface BlogEditViewProps {
  blogId: any;
  navigate: any;
  t: any;
  formData: any;
  setFormData: any;
  updateField: any;
  removeImage: any;
  handleSubmit: any;
  isSubmitting: any;
  blog: any;
  isLoading: any;
  navigateToBlog: any;
  activeTab: 'general' | 'tags';
  onTabChange?: (tab: 'general' | 'tags') => void;
}

export function BlogEditView({
  blogId,
  navigate,
  t,
  formData,
  setFormData,
  updateField,
  removeImage,
  handleSubmit,
  isSubmitting,
  blog,
  isLoading,
  navigateToBlog,
  activeTab,
  onTabChange,
}: BlogEditViewProps) {
  // Loading state
  if (isLoading) {
    return <PageSkeleton variant="settings" label={t('features.blogs.editPage.loading')} />;
  }

  // Not found state
  if (!blog) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-lg font-semibold">{t('features.blogs.editPage.notFound')}</p>
          <p className="text-muted-foreground">
            {t('features.blogs.editPage.notFoundDescription')}
          </p>
          <div className="mt-6">
            <Button
              data-action-id="blogs.edit.back-to-blogs"
              onClick={() => navigate({ to: '/home' })}
              variant="default"
            >
              {t('features.blogs.editPage.backToBlogs')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Main edit form
  return (
    <SettingsPage
      title={t('features.blogs.editPage.title')}
      description={t('features.blogs.editPage.description')}
      size="wide"
    >
      <form
        data-action-id="blogs.edit.save.form-submit"
        onSubmit={handleSubmit}
        className="space-y-6"
      >
        <SettingsTabs
          value={activeTab}
          onValueChange={onTabChange}
          tabs={[
            { value: 'general', label: t('pages.blog.settingsTabs.general') },
            { value: 'tags', label: t('pages.blog.settingsTabs.tags') },
          ]}
        >
          <TabsContent value="general" className="space-y-6">
            {/* Blog Image Section */}
            <MediaUpload
              currentImage={formData.imageURL}
              onImageChange={(url: string) => updateField('imageURL', url)}
              currentVideo={formData.videoURL}
              onVideoChange={(url: string) => updateField('videoURL', url)}
              onImageRemove={removeImage}
              cleanupOnRemove
              exclusiveMedia
              entityType="blogs"
              entityId={blogId}
              imageLabel={t('features.blogs.editPage.blogImage')}
              imageDescription={t('features.blogs.editPage.blogImageDescription')}
              videoLabel={t('common.actions.uploadVideo')}
              videoDescription={t('common.media.videoDescription')}
            />

            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>{t('features.blogs.editPage.basicInfo')}</CardTitle>
                <CardDescription>
                  {t('features.blogs.editPage.basicInfoDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ValidatedInputField
                  id="title"
                  label={t('features.blogs.editPage.blogTitleRequired')}
                  value={formData.title}
                  onChange={value => updateField('title', value)}
                  placeholder={t('features.blogs.editPage.blogTitlePlaceholder')}
                  validator={value => hasMinLength(value, 3)}
                  hint={t('common.validation.titleHint')}
                  required
                />
                <div className="space-y-2">
                  <FormControlLabel htmlFor="date">
                    {translateText('generated.inline.0277_date_eb9a4bc1')}
                  </FormControlLabel>
                  <FormControlInput
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={e => updateField('date', e.target.value)}
                    required
                  />
                </div>
                <VisibilityInput
                  value={formData.visibility}
                  onChange={v => updateField('visibility', v)}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tags */}
          <TabsContent value="tags" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('features.blogs.editPage.tags')}</CardTitle>
                <CardDescription>{t('features.blogs.editPage.tagsDescription')}</CardDescription>
              </CardHeader>
              <CardContent>
                <HashtagEditor
                  value={formData.hashtags}
                  onChange={hashtags => setFormData({ ...formData, hashtags })}
                  placeholder={t('features.blogs.editPage.addTagPlaceholder')}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </SettingsTabs>

        {/* Action Buttons */}
        <SettingsActionBar className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            data-action-id="blogs.edit.cancel"
            type="button"
            variant="outline"
            onClick={navigateToBlog}
            disabled={isSubmitting}
          >
            {t('features.blogs.editPage.cancel')}
          </Button>
          <Button data-action-id="blogs.edit.save" type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('features.blogs.editPage.saving')}
              </>
            ) : (
              t('features.blogs.editPage.saveChanges')
            )}
          </Button>
        </SettingsActionBar>
      </form>
    </SettingsPage>
  );
}
