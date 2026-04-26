/**
 * Event Edit Component
 *
 * Complete event editing UI with authorization checks,
 * loading states, and form management.
 */

import { useNavigate } from '@tanstack/react-router';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import { Label } from '@/features/shared/ui/ui/label';
import { VisibilityInput } from '@/features/create/ui/inputs/VisibilityInput';
import { Loader2, XCircle } from 'lucide-react';
import { ImageUpload } from '@/features/file-upload/ui/ImageUpload.tsx';
import { HashtagEditor } from '@/features/shared/ui/ui/hashtag-editor';
import { Badge } from '@/features/shared/ui/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/features/shared/ui/ui/tabs';
import { useEventUpdate } from '../hooks/useEventUpdate';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { CancelEventDialog } from './CancelEventDialog';
import { usePermissions } from '@/zero/rbac';
import { useState, useRef } from 'react';
import { CreateReviewCard, SummaryField } from '@/features/shared/ui/ui/create-review-card';
import { useUserGroupsWithManageEvents } from '@/zero/groups/useGroupState';
import { TypeaheadSearch } from '@/features/shared/ui/typeahead';
import type { TypeaheadItem } from '@/features/shared/logic/typeaheadHelpers';
import { formatNamedLocation } from '@/features/shared/logic/locationHelpers';
import {
  hasMinLength,
  isOptionalMinLength,
  isPositiveInteger,
  isValidOptionalUrlLike,
} from '@/features/shared/logic/inputValidation';
import { GeoAddressPicker } from '@/features/shared/ui/form/GeoAddressPicker';
import { MiniPlateEditor } from '@/features/shared/ui/form/MiniPlateEditor';
import { ValidatedInputField } from '@/features/shared/ui/form/ValidatedInputField';

interface EventEditProps {
  eventId: string;
  mode?: 'create' | 'edit';
}

export function EventEdit({ eventId, mode = 'edit' }: EventEditProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const { can } = usePermissions({ eventId });
  const { manageEventGroupIds } = useUserGroupsWithManageEvents();
  const canDeleteEvent = mode === 'edit' && can('delete', 'events');

  const {
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
  } = useEventUpdate(eventId, mode);
  const locationSummary = formatNamedLocation(formData.locationName, {
    country: formData.country,
    region: formData.region,
    post_code: formData.postCode,
    city: formData.city,
    street: formData.street,
    house_number: formData.houseNumber,
  });

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

  // Main edit form
  const onFormSubmit = (e: React.FormEvent) => {
    if (isCreating && !showReview) {
      e.preventDefault();
      setShowReview(true);
      return;
    }
    handleSubmit(e);
  };

  const confirmCreate = () => {
    // Trigger the real submit by dispatching a submit event on the form
    if (formRef.current) {
      formRef.current.requestSubmit();
    }
  };

  if (isCreating && showReview) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-3xl font-bold">{t('pages.create.common.review')}</h1>
        </div>
        <div className="max-w-2xl">
          <CreateReviewCard
            badge={t('pages.create.event.reviewBadge')}
            secondaryBadge={
              formData.visibility === 'public'
                ? t('pages.create.common.public')
                : t('pages.create.common.private')
            }
            title={formData.title || 'Untitled Event'}
            subtitle={formData.description || undefined}
            hashtags={formData.tags}
            gradient="from-blue-100 to-cyan-100 dark:from-blue-900/40 dark:to-cyan-900/50"
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
            {formData.locationType === 'physical' && locationSummary && (
              <SummaryField
                label={t('features.events.editPage.locationCapacity.location')}
                value={locationSummary}
              />
            )}
            {formData.locationType === 'online' && formData.onlineLink && (
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
        {/* Event Image Section */}
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

        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>{t('features.events.editPage.basicInfo.title')}</CardTitle>
            <CardDescription>{t('features.events.editPage.basicInfo.description')}</CardDescription>
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
              <Label htmlFor="description">{t('features.events.editPage.eventDescription')}</Label>
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
            {!isCreating && event?.event_type && (
              <div className="space-y-2">
                <Label>{t('pages.create.event.eventType')}</Label>
                <div>
                  <Badge variant="outline">
                    {t(
                      `pages.create.event.eventTypes.${event.event_type === 'delegate_assembly' ? 'delegateAssembly' : event.event_type === 'general_assembly' ? 'generalAssembly' : event.event_type === 'on_invite' ? 'onInvite' : 'open'}`
                    )}
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Date & Time Information */}
        <Card>
          <CardHeader>
            <CardTitle>{t('pages.create.event.associatedGroup')}</CardTitle>
            <CardDescription>{t('pages.create.event.tips.group')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="groupId">{t('pages.create.event.associatedGroupLabel')}</Label>
            <TypeaheadSearch
              entityTypes={['group']}
              value={formData.groupId || undefined}
              onChange={(item: TypeaheadItem | null) => updateField('groupId', item?.id ?? '')}
              filterFn={(item: TypeaheadItem) => manageEventGroupIds.has(item.id)}
              placeholder={t('pages.create.event.associatedGroupPlaceholder')}
            />
          </CardContent>
        </Card>

        {/* Date & Time Information */}
        <Card>
          <CardHeader>
            <CardTitle>{t('features.events.editPage.dateTime.title')}</CardTitle>
            <CardDescription>{t('features.events.editPage.dateTime.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <ValidatedInputField
                id="startDate"
                type="date"
                label={t('features.events.editPage.dateTime.startDate')}
                value={formData.startDate}
                onChange={value => updateField('startDate', value)}
                validator={value => hasMinLength(value, 1)}
                hint={t('common.validation.dateHint')}
                required
              />
              <ValidatedInputField
                id="startTime"
                type="time"
                label={t('features.events.editPage.dateTime.startTime')}
                value={formData.startTime}
                onChange={value => updateField('startTime', value)}
                validator={value => isOptionalMinLength(value, 1)}
                hint={t('common.validation.timeHint')}
              />
              <ValidatedInputField
                id="endDate"
                type="date"
                label={t('features.events.editPage.dateTime.endDate')}
                value={formData.endDate}
                onChange={value => updateField('endDate', value)}
                validator={value => isOptionalMinLength(value, 1)}
                hint={t('common.validation.dateHint')}
              />
              <ValidatedInputField
                id="endTime"
                type="time"
                label={t('features.events.editPage.dateTime.endTime')}
                value={formData.endTime}
                onChange={value => updateField('endTime', value)}
                validator={value => isOptionalMinLength(value, 1)}
                hint={t('common.validation.timeHint')}
              />
            </div>
          </CardContent>
        </Card>

        {/* Location & Capacity */}
        <Card>
          <CardHeader>
            <CardTitle>{t('features.events.editPage.locationCapacity.title')}</CardTitle>
            <CardDescription>
              {t('features.events.editPage.locationCapacity.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs
              value={formData.locationType}
              onValueChange={value => updateField('locationType', value as 'physical' | 'online')}
            >
              <TabsList className="w-full">
                <TabsTrigger value="physical" className="flex-1">
                  {t('pages.create.event.locationTypes.physical')}
                </TabsTrigger>
                <TabsTrigger value="online" className="flex-1">
                  {t('pages.create.event.locationTypes.online')}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="physical" className="space-y-4 pt-2">
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
              </TabsContent>
              <TabsContent value="online" className="space-y-4 pt-2">
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
              </TabsContent>
            </Tabs>
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

        {/* Tags */}
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

        {/* Deadlines */}
        <Card>
          <CardHeader>
            <CardTitle>{t('features.events.deadlines.title', 'Deadlines')}</CardTitle>
            <CardDescription>
              {t(
                'features.events.deadlines.settingsDescription',
                'Set deadlines for registration, amendments, and candidacy.'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ValidatedInputField
              id="registrationDeadline"
              type="datetime-local"
              label={t('features.events.deadlines.registration', 'Registration Deadline')}
              value={formData.registrationDeadline}
              onChange={value => updateField('registrationDeadline', value)}
              validator={value => isOptionalMinLength(value, 1)}
              hint={t('common.validation.dateTimeHint')}
            />
            <ValidatedInputField
              id="amendmentDeadline"
              type="datetime-local"
              label={t('features.events.deadlines.amendment', 'Amendment Deadline')}
              value={formData.amendmentDeadline}
              onChange={value => updateField('amendmentDeadline', value)}
              validator={value => isOptionalMinLength(value, 1)}
              hint={t('common.validation.dateTimeHint')}
            />
            <ValidatedInputField
              id="candidacyDeadline"
              type="datetime-local"
              label={t('features.events.deadlines.candidacy', 'Candidacy Deadline')}
              value={formData.candidacyDeadline}
              onChange={value => updateField('candidacyDeadline', value)}
              validator={value => isOptionalMinLength(value, 1)}
              hint={t('common.validation.dateTimeHint')}
            />
          </CardContent>
        </Card>

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
              {t('features.events.cancel.cancelEvent', 'Cancel Event')}
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
