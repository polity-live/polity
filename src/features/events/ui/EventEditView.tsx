import { featureThemeClassName } from '@/features/shared/theme';
import { BadgeControl } from '@/features/shared/ui/status';
import { FormControlLabel } from '@/features/shared/ui/form';
/**
 * Event Edit Component
 *
 * Complete event editing UI with authorization checks,
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
import { VisibilityInput } from '@/features/create/ui/inputs/VisibilityInput';
import { DelegateAllocationInput } from '@/features/create/ui/inputs/DelegateAllocationInput';
import { ElectionModeInput } from '@/features/elections/ui/ElectionModeInput';
import { Loader2, XCircle } from 'lucide-react';
import { ImageUpload } from '@/features/file-upload/ui/ImageUpload.tsx';
import { HashtagEditor } from '@/features/shared/ui/hashtags';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/features/shared/ui/ui/tabs';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { CancelEventDialog } from './CancelEventDialog';
import { CreateReviewCard, SummaryField } from '@/features/shared/ui/form';
import { TypeaheadSearch } from '@/features/shared/ui/typeahead';
import type { TypeaheadItem } from '@/features/shared/logic/typeaheadHelpers';
import {
  hasMinLength,
  isOptionalMinLength,
  isPositiveInteger,
  isValidOptionalUrlLike,
} from '@/features/shared/logic/inputValidation';
import { GeoAddressPicker } from '@/features/shared/ui/form/GeoAddressPicker';
import { MiniPlateEditor } from '@/features/shared/ui/form/MiniPlateEditor';
import { ValidatedInputField } from '@/features/shared/ui/form/ValidatedInputField';
import { getEventTypeTranslationKey } from '@/features/events/logic/getEventTypeTranslationKey';
import { EventTimeSeriesSection } from './EventTimeSeriesSection';
export interface EventEditViewProps {
  eventId: any;
  mode: any;
  defaultTab: any;
  navigate: any;
  t: any;
  cancelDialogOpen: any;
  setCancelDialogOpen: any;
  showReview: any;
  setShowReview: any;
  formRef: any;
  can: any;
  manageEventGroupIds: any;
  groups: any;
  canDeleteEvent: any;
  formData: any;
  setFormData: any;
  updateDescriptionContent: any;
  updateField: any;
  removeImage: any;
  handleSubmit: any;
  isSubmitting: any;
  event: any;
  isLoading: any;
  isCreating: any;
  timeSeriesValidationError: any;
  locationSummary: any;
  visibilityLabel: any;
  attendanceModeLabel: any;
  timeSeriesValidationMessage: any;
  selectableGroups: any;
  groupTypeaheadItems: any;
  onFormSubmit: any;
  confirmCreate: any;
}

export function EventEditView({
  eventId,
  defaultTab,
  navigate,
  t,
  cancelDialogOpen,
  setCancelDialogOpen,
  showReview,
  setShowReview,
  formRef,
  canDeleteEvent,
  formData,
  setFormData,
  updateDescriptionContent,
  updateField,
  removeImage,
  handleSubmit,
  isSubmitting,
  event,
  isLoading,
  isCreating,
  locationSummary,
  visibilityLabel,
  attendanceModeLabel,
  timeSeriesValidationMessage,
  groupTypeaheadItems,
  onFormSubmit,
  confirmCreate,
}: EventEditViewProps) {
  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
        <p className="text-muted-foreground">{t('features.events.editPage.loading')}</p>
      </div>
    );
  }

  // Not found state (only in edit mode)
  if (!isCreating && !event) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-lg font-semibold">{t('features.events.editPage.notFound')}</p>
          <p className="text-muted-foreground">
            {t('features.events.editPage.notFoundDescription')}
          </p>
          <div className="mt-6">
            <Button onClick={() => navigate({ to: `/calendar` })} variant="default">
              {t('features.events.backToCalendar')}
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
            entityType="event"
            badge={t('pages.create.event.reviewBadge')}
            secondaryBadge={visibilityLabel}
            title={formData.title || 'Untitled Event'}
            subtitle={formData.description || undefined}
            hashtags={formData.tags}
            media={
              formData.imageURL
                ? { imageUrl: formData.imageURL, imageAlt: formData.title || 'Event image' }
                : undefined
            }
          >
            {formData.startDate && (
              <SummaryField
                label={t('features.events.editPage.dateTime.startDate')}
                value={formData.startDate}
              />
            )}
            {formData.endDate && (
              <SummaryField
                label={t('features.events.editPage.dateTime.endDate')}
                value={formData.endDate}
              />
            )}
            <SummaryField label={t('pages.create.event.location')} value={attendanceModeLabel} />
            {formData.attendanceMode !== 'online' && locationSummary && (
              <SummaryField
                label={t('features.events.editPage.locationCapacity.location')}
                value={locationSummary}
              />
            )}
            {formData.attendanceMode !== 'offline' && formData.onlineLink && (
              <SummaryField
                label={t('pages.create.event.meetingLink')}
                value={formData.onlineLink}
              />
            )}
            {formData.capacity && (
              <SummaryField
                label={t('features.events.editPage.locationCapacity.capacity')}
                value={formData.capacity}
              />
            )}
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
                t('pages.create.event.createButton')
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
          {isCreating ? t('pages.create.event.title') : t('features.events.editPage.title')}
        </h1>
        <p className="text-muted-foreground">
          {isCreating
            ? t('pages.create.event.description')
            : t('features.events.editPage.subtitle')}
        </p>
      </div>

      <form ref={formRef} onSubmit={onFormSubmit} className="space-y-6">
        <Tabs defaultValue={defaultTab || 'basic-info'} className="space-y-6">
          <TabsList className="bg-muted/60 h-auto w-full flex-wrap justify-start gap-2 rounded-xl p-1">
            <TabsTrigger value="basic-info" className="flex-1 rounded-lg sm:flex-none">
              {t('pages.event.settingsTabs.basicInfo')}
            </TabsTrigger>
            <TabsTrigger value="time-series" className="flex-1 rounded-lg sm:flex-none">
              {t('pages.event.settingsTabs.timeSeries')}
            </TabsTrigger>
            <TabsTrigger value="event-type" className="flex-1 rounded-lg sm:flex-none">
              {translateText('generated.inline.0486_eventtyp_662805d4')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="basic-info" className="space-y-6">
            <ImageUpload
              currentImage={formData.imageURL}
              onImageChange={(url: string) => updateField('imageURL', url)}
              onImageRemove={isCreating ? undefined : removeImage}
              cleanupOnRemove
              entityType="events"
              entityId={eventId}
              label={t('features.events.editPage.image.label')}
              description={t('features.events.editPage.image.description')}
            />

            <Card>
              <CardHeader>
                <CardTitle>{t('features.events.editPage.basicInfo.title')}</CardTitle>
                <CardDescription>
                  {t('features.events.editPage.basicInfo.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ValidatedInputField
                  id="title"
                  label={t('features.events.editPage.eventTitle')}
                  value={formData.title}
                  onChange={value => updateField('title', value)}
                  placeholder={t('features.events.editPage.eventTitlePlaceholder')}
                  validator={value => hasMinLength(value, 3)}
                  hint={t('common.validation.titleHint')}
                  required
                />
                <div className="space-y-2">
                  <FormControlLabel htmlFor="description">
                    {t('features.events.editPage.eventDescription')}
                  </FormControlLabel>
                  <MiniPlateEditor
                    id="description"
                    value={formData.descriptionContent}
                    onChange={updateDescriptionContent}
                    placeholder={t('features.events.editPage.eventDescriptionPlaceholder')}
                  />
                </div>
                <VisibilityInput
                  value={formData.visibility}
                  onChange={v => updateField('visibility', v)}
                />
                <ValidatedInputField
                  id="defaultFinalVoteDurationMinutes"
                  label={translateText(
                    'generated.inline.2001_default_final_vote_duration_minutes',
                    'Default final vote duration'
                  )}
                  value={formData.defaultFinalVoteDurationMinutes}
                  onChange={value => updateField('defaultFinalVoteDurationMinutes', value)}
                  placeholder={translateText(
                    'generated.inline.2002_no_auto_close',
                    'No auto-close'
                  )}
                  validator={value => value.trim().length === 0 || isPositiveInteger(value)}
                  hint={translateText(
                    'generated.inline.2003_default_final_vote_duration_hint',
                    'Minutes; leave empty for manual closing.'
                  )}
                  type="number"
                  inputMode="numeric"
                  min="1"
                />
                {!isCreating && event?.event_type && (
                  <div className="space-y-2">
                    <FormControlLabel>{t('pages.create.event.eventType')}</FormControlLabel>
                    <div>
                      <BadgeControl variant="outline">
                        {t(
                          `pages.create.event.eventTypes.${getEventTypeTranslationKey(event.event_type)}`
                        )}
                      </BadgeControl>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('pages.create.event.associatedGroup')}</CardTitle>
                <CardDescription>{t('pages.create.event.tips.group')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <FormControlLabel htmlFor="groupId">
                  {t('pages.create.event.associatedGroupLabel')}
                </FormControlLabel>
                <TypeaheadSearch
                  items={groupTypeaheadItems}
                  value={formData.groupId || undefined}
                  onChange={(item: TypeaheadItem | null) => updateField('groupId', item?.id ?? '')}
                  placeholder={t('pages.create.event.associatedGroupPlaceholder')}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('features.events.editPage.locationCapacity.title')}</CardTitle>
                <CardDescription>
                  {t('features.events.editPage.locationCapacity.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <FormControlLabel>
                    {translateText('generated.inline.0327_attendance_mode_507f30a9')}
                  </FormControlLabel>
                  <div className="flex flex-wrap gap-2">
                    {(['online', 'hybrid', 'offline'] as const).map((modeOption: any) => (
                      <Button
                        key={modeOption}
                        type="button"
                        variant={formData.attendanceMode === modeOption ? 'default' : 'outline'}
                        onClick={() => updateField('attendanceMode', modeOption)}
                      >
                        {modeOption === 'online'
                          ? translateText('generated.inline.0046_online_c3e839df')
                          : modeOption === 'hybrid'
                            ? translateText('generated.inline.0047_hybrid_8e01f6bc')
                            : translateText('generated.inline.0048_offline_e01fa717')}
                      </Button>
                    ))}
                  </div>
                </div>
                {formData.attendanceMode !== 'online' ? (
                  <div className="space-y-4 rounded-xl border p-4">
                    <ValidatedInputField
                      id="locationName"
                      label={t('pages.create.event.venueName')}
                      value={formData.locationName}
                      onChange={value => updateField('locationName', value)}
                      placeholder={t('pages.create.event.venueNamePlaceholder')}
                      validator={value => isOptionalMinLength(value, 3)}
                      hint={t('common.validation.locationNameHint')}
                    />
                    <GeoAddressPicker
                      idPrefix="event-location"
                      values={{
                        country: formData.country,
                        region: formData.region,
                        city: formData.city,
                        post_code: formData.postCode,
                        street: formData.street,
                        house_number: formData.houseNumber,
                      }}
                      coordinates={
                        formData.latitude !== null && formData.longitude !== null
                          ? { latitude: formData.latitude, longitude: formData.longitude }
                          : null
                      }
                      onCoordinatesChange={coordinates => {
                        updateField('latitude', coordinates?.latitude ?? null);
                        updateField('longitude', coordinates?.longitude ?? null);
                      }}
                      onFieldChange={(field, value) => {
                        switch (field) {
                          case 'country':
                            updateField('country', value);
                            break;
                          case 'region':
                            updateField('region', value);
                            break;
                          case 'city':
                            updateField('city', value);
                            break;
                          case 'post_code':
                            updateField('postCode', value);
                            break;
                          case 'street':
                            updateField('street', value);
                            break;
                          case 'house_number':
                            updateField('houseNumber', value);
                            break;
                        }
                      }}
                      labels={{
                        country: t('pages.create.event.country'),
                        region: t('pages.create.event.region'),
                        city: t('pages.create.event.city'),
                        post_code: t('pages.create.event.postalCode'),
                        street: t('pages.create.event.street'),
                        house_number: t('pages.create.event.houseNumber'),
                      }}
                      placeholders={{
                        country: t('pages.create.event.country'),
                        region: t('pages.create.event.region'),
                        city: t('pages.create.event.city'),
                        post_code: t('pages.create.event.postalCode'),
                        street: t('pages.create.event.street'),
                        house_number: t('pages.create.event.houseNumber'),
                      }}
                    />
                  </div>
                ) : null}
                {formData.attendanceMode !== 'offline' ? (
                  <div className="space-y-4 rounded-xl border p-4">
                    <ValidatedInputField
                      id="onlineLink"
                      type="url"
                      label={t('pages.create.event.meetingLink')}
                      value={formData.onlineLink}
                      onChange={value => updateField('onlineLink', value)}
                      placeholder={t('pages.create.event.meetingLinkPlaceholder')}
                      validator={isValidOptionalUrlLike}
                      hint={t('common.validation.onlineLinkHint')}
                      autoComplete="url"
                    />
                  </div>
                ) : null}
                <ValidatedInputField
                  id="capacity"
                  type="number"
                  min="1"
                  label={t('features.events.editPage.locationCapacity.capacity')}
                  value={formData.capacity}
                  onChange={value => updateField('capacity', value)}
                  placeholder={t('features.events.editPage.locationCapacity.capacityPlaceholder')}
                  validator={isPositiveInteger}
                  hint={t('common.validation.positiveIntegerHint')}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('features.events.editPage.tags.title')}</CardTitle>
                <CardDescription>{t('features.events.editPage.tags.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                <HashtagEditor
                  value={formData.tags}
                  onChange={tags => setFormData({ ...formData, tags })}
                  label={t('features.events.editPage.tags.title')}
                  showLabel={false}
                  placeholder={t('features.events.editPage.tags.placeholder')}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="time-series" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('features.events.editPage.timeSeries.title')}</CardTitle>
                <CardDescription>
                  {t('features.events.editPage.timeSeries.description')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EventTimeSeriesSection
                  startDate={formData.startDate}
                  startTime={formData.startTime}
                  endDate={formData.endDate}
                  endTime={formData.endTime}
                  onDateTimeChange={(field, value) => updateField(field, value)}
                  recurrencePattern={formData.recurrencePattern}
                  onRecurrencePatternChange={value => updateField('recurrencePattern', value)}
                  recurrenceEndDate={formData.recurrenceEndDate}
                  onRecurrenceEndDateChange={value => updateField('recurrenceEndDate', value)}
                  recurrenceInterval={formData.recurrenceInterval}
                  onRecurrenceIntervalChange={value => updateField('recurrenceInterval', value)}
                  recurrenceWeekdays={formData.recurrenceWeekdays}
                  onRecurrenceWeekdaysChange={value => updateField('recurrenceWeekdays', value)}
                  validationMessage={timeSeriesValidationMessage}
                  deadlines={[
                    {
                      id: 'registrationDeadline',
                      label: t('features.events.deadlines.registration'),
                      value: formData.registrationDeadline,
                      onChange: value => updateField('registrationDeadline', value),
                      hint: t('common.validation.dateTimeHint'),
                    },
                    {
                      id: 'amendmentDeadline',
                      label: t('features.events.deadlines.amendment'),
                      value: formData.amendmentDeadline,
                      onChange: value => updateField('amendmentDeadline', value),
                      hint: t('common.validation.dateTimeHint'),
                    },
                    {
                      id: 'candidacyDeadline',
                      label: t('features.events.deadlines.candidacy'),
                      value: formData.candidacyDeadline,
                      onChange: value => updateField('candidacyDeadline', value),
                      hint: t('common.validation.dateTimeHint'),
                    },
                  ]}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="event-type" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{translateText('generated.inline.0486_eventtyp_662805d4')}</CardTitle>
                <CardDescription>
                  {translateText(
                    'generated.inline.0487_review_the_fixed_event_type_and_adjust_the_se_265b2487'
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {event?.event_type ? (
                  <div className="space-y-2">
                    <FormControlLabel>{t('pages.create.event.eventType')}</FormControlLabel>
                    <BadgeControl variant="outline">
                      {t(
                        `pages.create.event.eventTypes.${getEventTypeTranslationKey(event.event_type)}`
                      )}
                    </BadgeControl>
                  </div>
                ) : null}

                {event?.event_type === 'general_assembly' ? (
                  <div className={featureThemeClassName('eventEventEditSuccessBadge')}>
                    {translateText(
                      'generated.inline.0488_all_active_members_of_the_linked_group_are_in_768156c8'
                    )}
                  </div>
                ) : null}

                {event?.event_type === 'delegate_assembly' ? (
                  <div className="space-y-4">
                    <DelegateAllocationInput
                      value={{
                        allocationMode: formData.delegateAllocationMode,
                        totalDelegates: Math.max(
                          1,
                          Number.parseInt(formData.delegateTotalSeats, 10) || 1
                        ),
                        delegateRatio: Math.max(
                          1,
                          Number.parseInt(formData.delegateMembersPerSeat, 10) || 1
                        ),
                      }}
                      onChange={config => {
                        updateField('delegateAllocationMode', config.allocationMode);
                        updateField('delegateTotalSeats', String(config.totalDelegates));
                        updateField('delegateMembersPerSeat', String(config.delegateRatio));
                      }}
                    />
                    <ElectionModeInput
                      value={formData.delegateElectionMode}
                      onChange={value => updateField('delegateElectionMode', value)}
                      label={translateText('generated.inline.0325_delegiertenwahl_f860c1a3')}
                      hint={translateText(
                        'generated.inline.0489_lege_fest_ob_untergruppen_ihre_delegierten_st_274a60f4'
                      )}
                      descriptions={{
                        list: 'Eine Listenwahl mit mehreren Stimmen fuer die zu vergebenden Positionen.',
                        single: 'Je Delegiertensitz wird eine eigene Einzelwahl angelegt.',
                      }}
                    />
                    <ValidatedInputField
                      id="delegatesNominationDeadline"
                      type="datetime-local"
                      label={translateText(
                        'generated.inline.0490_delegierten_nominierungsfrist_e9b338fa'
                      )}
                      value={formData.delegatesNominationDeadline}
                      onChange={value => updateField('delegatesNominationDeadline', value)}
                      hint={t('common.validation.dateTimeHint')}
                    />
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate({ to: isCreating ? '/create' : `/event/${eventId}` })}
            disabled={isSubmitting}
          >
            {t('features.events.cancelLabel')}
          </Button>

          {/* Cancel Event Button - only for users with delete permission in edit mode */}
          {!isCreating && canDeleteEvent && (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setCancelDialogOpen(true)}
              disabled={isSubmitting}
            >
              <XCircle className="mr-2 h-4 w-4" />
              {t('features.events.cancel.cancelEvent')}
            </Button>
          )}

          <Button type="submit" disabled={isSubmitting} className="flex-1">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isCreating
                  ? t('pages.create.common.creating')
                  : t('features.events.editPage.saving')}
              </>
            ) : isCreating ? (
              t('pages.create.next')
            ) : (
              t('features.events.editPage.saveChanges')
            )}
          </Button>
        </div>
      </form>

      {/* Cancel Event Dialog */}
      {canDeleteEvent && (
        <CancelEventDialog
          eventId={eventId}
          open={cancelDialogOpen}
          onOpenChange={setCancelDialogOpen}
        />
      )}
    </div>
  );
}
