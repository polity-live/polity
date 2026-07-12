'use client';
import { featureThemeClassName } from '@/features/shared/theme';
import { PageSkeleton } from '@/features/shared/ui/feedback';
import {
  FormControlTextarea,
  FormControlLabel,
  FormControlInput,
  SettingsActionBar,
  SettingsPage,
  SettingsTabs,
} from '@/features/shared/ui/form';
import { TabsContent } from '@/features/shared/ui/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import { ChevronDown, GitBranch, Loader2 } from 'lucide-react';
import { MediaUpload } from '@/features/file-upload/ui/MediaUpload';
import { HashtagEditor } from '@/features/shared/ui/hashtags';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/features/shared/ui/ui/dropdown-menu.tsx';
import { VisibilityInput } from '@/features/create/ui/inputs/VisibilityInput';
import { isEventPhase, isTerminalEditingMode } from '@/zero/amendments/editing-mode-policy';
import { CreateReviewCard, SummaryField } from '@/features/shared/ui/form';
import { hasMinLength, isOptionalMinLength } from '@/features/shared/logic/inputValidation';
import { ValidatedInputField } from '@/features/shared/ui/form/ValidatedInputField';
import { EditingModeMenuItems } from '@/features/shared/ui/status';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/features/shared/ui/ui/select';
import { GeoAddressPicker } from '@/features/shared/ui/form/GeoAddressPicker';
import { geoLocationShapeFromFields } from '@/features/shared/logic/geoLocationShape';
export interface AmendmentEditContentViewProps {
  amendmentId: any;
  amendment: any;
  currentUserId: any;
  isLoading: any;
  mode: any;
  agendaItemId: any;
  isCreating: any;
  activeTab: 'general' | 'workflow' | 'location';
  onTabChange: (tab: 'general' | 'workflow' | 'location') => void;
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
  workflowModeDisabledReasons: any;
  controllingEvent: any;
  workflowBranchOptions: any;
  selectedWorkflowBranchId: any;
  selectedWorkflowBranchLabel: any;
  selectedWorkflowBranchEditable: any;
  setSelectedWorkflowBranchId: any;
  isSubmitting: any;
  setIsSubmitting: any;
  showReview: any;
  setShowReview: any;
  formRef: any;
  initializedRef: any;
  hashtagsInitializedRef: any;
  handleWorkflowStatusChange: any;
  handleRemoveImage: any;
  handleLocationFieldChange: any;
  handleLocationCoordinatesChange: any;
  handleLocationShapeChange: any;
  locationSummary: any;
  handleSubmit: any;
  onFormSubmit: any;
  confirmCreate: any;
}

export function AmendmentEditContentView({
  amendmentId,
  amendment,
  isLoading,
  isCreating,
  activeTab,
  onTabChange,
  navigate,
  t,
  formData,
  setFormData,
  workflowStatusOption,
  workflowMenuValue,
  workflowModeDisabledReasons,
  controllingEvent,
  workflowBranchOptions,
  selectedWorkflowBranchId,
  selectedWorkflowBranchLabel,
  selectedWorkflowBranchEditable,
  setSelectedWorkflowBranchId,
  isSubmitting,
  showReview,
  setShowReview,
  formRef,
  handleWorkflowStatusChange,
  handleRemoveImage,
  handleLocationFieldChange,
  handleLocationCoordinatesChange,
  handleLocationShapeChange,
  locationSummary,
  handleSubmit,
  onFormSubmit,
  confirmCreate,
}: AmendmentEditContentViewProps) {
  if (isLoading) {
    return <PageSkeleton variant="settings" label={t('features.amendments.editContent.loading')} />;
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
            title={formData.title || t('features.amendments.editContent.untitled')}
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
            {locationSummary ? (
              <SummaryField
                label={t('features.amendments.editContent.locationTitle')}
                value={locationSummary}
              />
            ) : null}
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
    <SettingsPage
      title={
        isCreating
          ? t('pages.create.amendment.title')
          : t('features.amendments.editContent.pageTitle')
      }
      description={
        isCreating
          ? t('pages.create.amendment.description')
          : t('features.amendments.editContent.pageDescription')
      }
      headingMode={isCreating ? 'visible' : 'sr-only'}
    >
      <form ref={formRef} onSubmit={onFormSubmit} className="space-y-6">
        <SettingsTabs
          value={activeTab}
          onValueChange={onTabChange}
          tabs={[
            { value: 'general', label: t('pages.amendment.settingsTabs.general') },
            { value: 'workflow', label: t('pages.amendment.settingsTabs.workflow') },
            { value: 'location', label: t('pages.amendment.settingsTabs.location') },
          ]}
        >
          <TabsContent value="general" className="space-y-6">
            <MediaUpload
              currentImage={formData.imageURL}
              onImageChange={(url: string) => setFormData({ ...formData, imageURL: url })}
              currentVideo={formData.videoURL}
              onVideoChange={(url: string) => setFormData({ ...formData, videoURL: url })}
              onImageRemove={isCreating ? undefined : handleRemoveImage}
              cleanupOnRemove
              exclusiveMedia
              entityType="amendments"
              entityId={amendmentId}
              imageLabel={t('features.amendments.editContent.amendmentImage')}
              imageDescription={t('features.amendments.editContent.amendmentImageDescription')}
              videoLabel={t('features.amendments.editContent.amendmentVideo')}
              videoDescription={t('features.amendments.editContent.amendmentVideoDescription')}
            />

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
          </TabsContent>

          <TabsContent value="location" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('features.amendments.editContent.locationTitle')}</CardTitle>
                <CardDescription>
                  {t('features.amendments.editContent.locationDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <GeoAddressPicker
                  idPrefix="amendment-location"
                  values={{
                    country: formData.country,
                    region: formData.region,
                    city: formData.city,
                    post_code: formData.post_code,
                    street: formData.street,
                    house_number: formData.house_number,
                  }}
                  coordinates={
                    formData.latitude !== null && formData.longitude !== null
                      ? { latitude: formData.latitude, longitude: formData.longitude }
                      : null
                  }
                  onCoordinatesChange={handleLocationCoordinatesChange}
                  shape={geoLocationShapeFromFields(formData)}
                  onShapeChange={handleLocationShapeChange}
                  onFieldChange={handleLocationFieldChange}
                  labels={{
                    country: t('features.amendments.editContent.locationCountryLabel'),
                    region: t('features.amendments.editContent.locationRegionLabel'),
                    city: t('features.amendments.editContent.locationCityLabel'),
                    post_code: t('features.amendments.editContent.locationPostCodeLabel'),
                    street: t('features.amendments.editContent.locationStreetLabel'),
                    house_number: t('features.amendments.editContent.locationHouseNumberLabel'),
                  }}
                  placeholders={{
                    country: t('features.amendments.editContent.locationCountryPlaceholder'),
                    region: t('features.amendments.editContent.locationRegionPlaceholder'),
                    city: t('features.amendments.editContent.locationCityPlaceholder'),
                    post_code: t('features.amendments.editContent.locationPostCodePlaceholder'),
                    street: t('features.amendments.editContent.locationStreetPlaceholder'),
                    house_number: t(
                      'features.amendments.editContent.locationHouseNumberPlaceholder'
                    ),
                  }}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="workflow" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('features.amendments.editContent.workflowSettings')}</CardTitle>
                <CardDescription>
                  {t('features.amendments.editContent.workflowSettingsDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!isCreating && workflowBranchOptions?.length > 0 ? (
                  <div className="space-y-2">
                    <FormControlLabel htmlFor="workflowBranch">
                      {t('features.amendments.editContent.workflowBranchLabel', {
                        defaultValue: 'Branch',
                      })}
                    </FormControlLabel>
                    <Select
                      value={selectedWorkflowBranchId ?? ''}
                      onValueChange={setSelectedWorkflowBranchId}
                    >
                      <SelectTrigger id="workflowBranch" className="w-full">
                        <span className="flex min-w-0 items-center gap-2">
                          <GitBranch className="text-muted-foreground h-4 w-4 shrink-0" />
                          <span className="truncate">
                            {selectedWorkflowBranchLabel ??
                              t('features.amendments.editContent.workflowBranchPlaceholder', {
                                defaultValue: 'Branch wählen',
                              })}
                          </span>
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        {workflowBranchOptions.map((branch: any) => (
                          <SelectItem key={branch.id} value={branch.id} textValue={branch.label}>
                            <span className="truncate">{branch.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
                <div className="space-y-2">
                  <FormControlLabel htmlFor="workflowStatus">
                    {t('features.amendments.editContent.workflowStatusLabel')}
                  </FormControlLabel>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-between"
                        disabled={
                          isTerminalEditingMode(formData.workflowStatus) ||
                          !selectedWorkflowBranchEditable
                        }
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            className={`h-2.5 w-2.5 shrink-0 rounded-full ${workflowStatusOption.colorClass}`}
                          />
                          <workflowStatusOption.Icon className="h-4 w-4 shrink-0" />
                          <span className="truncate">
                            {selectedWorkflowBranchLabel
                              ? `${selectedWorkflowBranchLabel}: ${workflowStatusOption.label}`
                              : workflowStatusOption.label}
                          </span>
                        </span>
                        <ChevronDown className="h-4 w-4 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-80">
                      <EditingModeMenuItems
                        value={workflowMenuValue}
                        disabledModeReasons={workflowModeDisabledReasons}
                        onValueChange={handleWorkflowStatusChange}
                      />
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <p className="text-muted-foreground text-xs">
                    {workflowStatusOption.description}
                  </p>
                  {isEventPhase(formData.workflowStatus) && (
                    <p
                      className={featureThemeClassName('amendmentAmendmentEditContentWarningText')}
                    >
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
                        label: t(
                          'features.amendments.editContent.internalCRVotingAfterMinutesLabel'
                        ),
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
                      {t(
                        'features.amendments.editContent.internalCRResolutionVisibilityDescription'
                      )}
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
                    <p
                      className={featureThemeClassName(
                        'amendmentAmendmentEditContentInfoTextAlpha'
                      )}
                    >
                      {t('features.amendments.editContent.eventPhaseDescription', {
                        eventTitle: controllingEvent.title,
                      })}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </SettingsTabs>

        <SettingsActionBar className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate({ to: isCreating ? '/create' : `/amendment/${amendmentId}` })}
            disabled={isSubmitting}
          >
            {t('features.amendments.editContent.cancel')}
          </Button>
          <Button type="submit" disabled={isSubmitting}>
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
        </SettingsActionBar>
      </form>
    </SettingsPage>
  );
}
