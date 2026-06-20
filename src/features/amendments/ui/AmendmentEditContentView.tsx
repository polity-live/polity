'use client';
import { featureThemeClassName } from '@/features/shared/theme';
import { FormControlTextarea, FormControlLabel, FormControlInput } from '@/features/shared/ui/form';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import { ChevronDown, Loader2 } from 'lucide-react';
import { ImageUpload } from '@/features/file-upload/ui/ImageUpload.tsx';
import { VideoUpload } from '@/features/file-upload/ui/VideoUpload.tsx';
import { HashtagEditor } from '@/features/shared/ui/hashtags';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/features/shared/ui/ui/dropdown-menu.tsx';
import { VisibilityInput } from '@/features/create/ui/inputs/VisibilityInput';
import { isEventPhase, isTerminalStatus } from '@/zero/rbac/workflow-constants';
import { CreateReviewCard, SummaryField } from '@/features/shared/ui/form';
import { hasMinLength, isOptionalMinLength } from '@/features/shared/logic/inputValidation';
import { ValidatedInputField } from '@/features/shared/ui/form/ValidatedInputField';
import { EditingModeMenuItems } from '@/features/shared/ui/status';
export interface AmendmentEditContentViewProps {
  amendmentId: any;
  amendment: any;
  currentUserId: any;
  isLoading: any;
  mode: any;
  agendaItemId: any;
  isCreating: any;
  navigate: any;
  t: any;
  updateAmendment: any;
  createAmendment: any;
  commonActions: any;
  amendmentHashtags: any;
  allHashtags: any;
  formData: any;
  setFormData: any;
  workflowStatusOption: any;
  workflowMenuValue: any;
  controllingEvent: any;
  isSubmitting: any;
  setIsSubmitting: any;
  showReview: any;
  setShowReview: any;
  formRef: any;
  initializedRef: any;
  hashtagsInitializedRef: any;
  handleWorkflowStatusChange: any;
  handleRemoveImage: any;
  handleSubmit: any;
  onFormSubmit: any;
  confirmCreate: any;
}

export function AmendmentEditContentView({
  amendmentId,
  amendment,
  isLoading,
  isCreating,
  navigate,
  t,
  formData,
  setFormData,
  workflowStatusOption,
  workflowMenuValue,
  controllingEvent,
  isSubmitting,
  showReview,
  setShowReview,
  formRef,
  handleWorkflowStatusChange,
  handleRemoveImage,
  handleSubmit,
  onFormSubmit,
  confirmCreate,
}: AmendmentEditContentViewProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
        <p className="text-muted-foreground">{t('features.amendments.editContent.loading')}</p>
      </div>
    );
  }

  if (!isCreating && !amendment) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-lg font-semibold">{t('features.amendments.editContent.notFound')}</p>
          <p className="text-muted-foreground">
            {t('features.amendments.editContent.noDataExists')}
          </p>
          <div className="mt-6">
            <Button onClick={() => navigate({ to: `/` })} variant="default">
              {t('features.amendments.editContent.backToHome')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isCreating && showReview) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-3xl font-bold">{t('pages.create.common.review')}</h1>
        </div>
        <div className="max-w-2xl">
          <CreateReviewCard
            entityType="amendment"
            badge={t('pages.create.amendment.reviewBadge')}
            secondaryBadge={workflowStatusOption.label}
            title={formData.title || 'Untitled Amendment'}
            subtitle={formData.subtitle || undefined}
            hashtags={formData.hashtags}
            media={{
              imageUrl: formData.imageURL || undefined,
              imageAlt: formData.title || 'Amendment image',
              videoUrl: formData.videoURL || undefined,
            }}
          >
            {formData.code && (
              <SummaryField
                label={t('features.amendments.editContent.codeLabel')}
                value={
                  formData.code.length > 200 ? formData.code.slice(0, 200) + '…' : formData.code
                }
              />
            )}
            <SummaryField
              label={t('features.amendments.editContent.workflowStatusLabel')}
              value={workflowStatusOption.label}
            />
          </CreateReviewCard>
          <div className="mt-6 flex gap-3">
            <Button variant="outline" onClick={() => setShowReview(false)}>
              {t('pages.create.previous')}
            </Button>
            <Button onClick={confirmCreate} disabled={isSubmitting} className="flex-1">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('pages.create.common.creating')}
                </>
              ) : (
                t('pages.create.amendment.createButton')
              )}
            </Button>
          </div>
        </div>
        {/* Hidden form to allow real submission */}
        <form ref={formRef} onSubmit={handleSubmit} className="hidden" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">
          {isCreating
            ? t('pages.create.amendment.title')
            : t('features.amendments.editContent.pageTitle')}
        </h1>
        <p className="text-muted-foreground">
          {isCreating
            ? t('pages.create.amendment.description')
            : t('features.amendments.editContent.pageDescription')}
        </p>
      </div>

      <form ref={formRef} onSubmit={onFormSubmit} className="space-y-6">
        <ImageUpload
          currentImage={formData.imageURL}
          onImageChange={(url: string) => setFormData({ ...formData, imageURL: url })}
          onImageRemove={isCreating ? undefined : handleRemoveImage}
          cleanupOnRemove
          entityType="amendments"
          entityId={amendmentId}
          label={t('features.amendments.editContent.amendmentImage')}
          description={t('features.amendments.editContent.amendmentImageDescription')}
        />

        <VideoUpload
          currentVideo={formData.videoURL}
          currentThumbnail={formData.videoThumbnailURL}
          onVideoChange={(url: string) => setFormData({ ...formData, videoURL: url })}
          label={t('features.amendments.editContent.amendmentVideo')}
          description={t('features.amendments.editContent.amendmentVideoDescription')}
        />

        {formData.videoURL && (
          <ImageUpload
            currentImage={formData.videoThumbnailURL}
            onImageChange={(url: string) => setFormData({ ...formData, videoThumbnailURL: url })}
            cleanupOnRemove
            entityType="amendments"
            entityId={amendmentId}
            label={t('features.amendments.editContent.videoThumbnail')}
            description={t('features.amendments.editContent.videoThumbnailDescription')}
          />
        )}

        <Card>
          <CardHeader>
            <CardTitle>{t('features.amendments.editContent.basicInfo')}</CardTitle>
            <CardDescription>
              {t('features.amendments.editContent.basicInfoDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ValidatedInputField
              id="title"
              label={t('features.amendments.editContent.titleLabel')}
              value={formData.title}
              onChange={value => setFormData({ ...formData, title: value })}
              placeholder={t('features.amendments.editContent.titlePlaceholder')}
              validator={value => hasMinLength(value, 3)}
              hint={t('common.validation.titleHint')}
              required
            />
            <ValidatedInputField
              id="subtitle"
              label={t('features.amendments.editContent.subtitleLabel')}
              value={formData.subtitle}
              onChange={value => setFormData({ ...formData, subtitle: value })}
              placeholder={t('features.amendments.editContent.subtitlePlaceholder')}
              validator={value => isOptionalMinLength(value, 3)}
              hint={t('common.validation.subtitleHint')}
            />
            <div className="space-y-2">
              <FormControlLabel htmlFor="code">
                {t('features.amendments.editContent.codeLabel')}
              </FormControlLabel>
              <FormControlTextarea
                id="code"
                value={formData.code}
                onChange={e => setFormData({ ...formData, code: e.target.value })}
                placeholder={t('features.amendments.editContent.codePlaceholder')}
                rows={10}
              />
            </div>
            <VisibilityInput
              value={formData.visibility}
              onChange={v => setFormData({ ...formData, visibility: v })}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('features.amendments.editContent.workflowSettings')}</CardTitle>
            <CardDescription>
              {t('features.amendments.editContent.workflowSettingsDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <FormControlLabel htmlFor="workflowStatus">
                {t('features.amendments.editContent.workflowStatusLabel')}
              </FormControlLabel>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                    disabled={isTerminalStatus(formData.workflowStatus)}
                  >
                    <span className="flex items-center gap-2">
                      <div
                        className={`h-2.5 w-2.5 rounded-full ${workflowStatusOption.colorClass}`}
                      />
                      <workflowStatusOption.Icon className="h-4 w-4" />
                      <span>{workflowStatusOption.label}</span>
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-80">
                  <EditingModeMenuItems
                    value={workflowMenuValue}
                    onValueChange={handleWorkflowStatusChange}
                  />
                </DropdownMenuContent>
              </DropdownMenu>
              <p className="text-muted-foreground text-xs">{workflowStatusOption.description}</p>
              {isEventPhase(formData.workflowStatus) && (
                <p className={featureThemeClassName('amendmentAmendmentEditContentWarningText')}>
                  {t('features.amendments.editContent.eventPhaseWarning')}
                </p>
              )}
            </div>

            <div className="space-y-3 rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormControlLabel htmlFor="internalCRVotingCloseTrigger">
                  {t('features.amendments.editContent.internalCRVotingCloseTitle')}
                </FormControlLabel>
                <p className="text-muted-foreground text-xs">
                  {t('features.amendments.editContent.internalCRVotingCloseDescription')}
                </p>
              </div>
              <div className="grid gap-2">
                {[
                  {
                    value: 'all_collaborators_voted',
                    label: t(
                      'features.amendments.editContent.internalCRVotingAllCollaboratorsLabel'
                    ),
                    description: t(
                      'features.amendments.editContent.internalCRVotingAllCollaboratorsDescription'
                    ),
                  },
                  {
                    value: 'after_minutes',
                    label: t('features.amendments.editContent.internalCRVotingAfterMinutesLabel'),
                    description: t(
                      'features.amendments.editContent.internalCRVotingAfterMinutesDescription'
                    ),
                  },
                ].map(option => {
                  const selected = formData.internalCRVotingCloseTrigger === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`rounded-md border p-3 text-left transition-colors ${
                        selected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                      }`}
                      onClick={() =>
                        setFormData({
                          ...formData,
                          internalCRVotingCloseTrigger: option.value,
                        })
                      }
                    >
                      <span className="block text-sm font-medium">{option.label}</span>
                      <span className="text-muted-foreground mt-1 block text-xs">
                        {option.description}
                      </span>
                    </button>
                  );
                })}
              </div>

              {formData.internalCRVotingCloseTrigger === 'after_minutes' && (
                <div className="max-w-xs space-y-2">
                  <FormControlLabel htmlFor="internalCRVotingDurationMinutes">
                    {t('features.amendments.editContent.internalCRVotingDurationMinutes')}
                  </FormControlLabel>
                  <FormControlInput
                    id="internalCRVotingDurationMinutes"
                    type="number"
                    min="1"
                    value={String(formData.internalCRVotingDurationMinutes)}
                    onChange={event =>
                      setFormData({
                        ...formData,
                        internalCRVotingDurationMinutes: Math.max(
                          1,
                          Number.parseInt(event.target.value, 10) || 1
                        ),
                      })
                    }
                  />
                </div>
              )}

              <p className="text-muted-foreground bg-muted/30 rounded-md border p-3 text-xs">
                {t('features.amendments.editContent.internalCRVotingEventFallback')}
              </p>
            </div>

            <div className="space-y-3 rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormControlLabel htmlFor="internalCRResolutionVisibility">
                  {t('features.amendments.editContent.internalCRResolutionVisibilityTitle')}
                </FormControlLabel>
                <p className="text-muted-foreground text-xs">
                  {t('features.amendments.editContent.internalCRResolutionVisibilityDescription')}
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  {
                    value: 'public',
                    label: t(
                      'features.amendments.editContent.internalCRResolutionVisibilityPublicLabel'
                    ),
                    description: t(
                      'features.amendments.editContent.internalCRResolutionVisibilityPublicDescription'
                    ),
                  },
                  {
                    value: 'collaborators',
                    label: t(
                      'features.amendments.editContent.internalCRResolutionVisibilityCollaboratorsLabel'
                    ),
                    description: t(
                      'features.amendments.editContent.internalCRResolutionVisibilityCollaboratorsDescription'
                    ),
                  },
                ].map(option => {
                  const selected = formData.internalCRResolutionVisibility === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`rounded-md border p-3 text-left transition-colors ${
                        selected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                      }`}
                      onClick={() =>
                        setFormData({
                          ...formData,
                          internalCRResolutionVisibility: option.value,
                        })
                      }
                    >
                      <span className="block text-sm font-medium">{option.label}</span>
                      <span className="text-muted-foreground mt-1 block text-xs">
                        {option.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {controllingEvent && (
              <div className={featureThemeClassName('amendmentAmendmentEditContentInfoPanel')}>
                <p className={featureThemeClassName('amendmentAmendmentEditContentInfoText')}>
                  {t('features.amendments.editContent.eventPhase')}
                </p>
                <p className={featureThemeClassName('amendmentAmendmentEditContentInfoTextAlpha')}>
                  {t('features.amendments.editContent.eventPhaseDescription', {
                    eventTitle: controllingEvent.title,
                  })}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('features.amendments.editContent.tagsTitle')}</CardTitle>
            <CardDescription>
              {t('features.amendments.editContent.tagsDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <HashtagEditor
              value={formData.hashtags}
              onChange={tags => setFormData({ ...formData, hashtags: tags })}
              label={t('features.amendments.editContent.tagsTitle')}
              showLabel={false}
              placeholder={t('features.amendments.editContent.addTagPlaceholder')}
            />
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate({ to: isCreating ? '/create' : `/amendment/${amendmentId}` })}
            disabled={isSubmitting}
          >
            {t('features.amendments.editContent.cancel')}
          </Button>
          <Button type="submit" disabled={isSubmitting} className="flex-1">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isCreating
                  ? t('pages.create.common.creating')
                  : t('features.amendments.editContent.saving')}
              </>
            ) : isCreating ? (
              t('pages.create.next')
            ) : (
              t('features.amendments.editContent.saveChanges')
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
