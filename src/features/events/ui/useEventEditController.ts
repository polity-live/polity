/**
 * Event Edit Component
 *
 * Complete event editing UI with authorization checks,
 * loading states, and form management.
 */

import { useNavigate } from '@tanstack/react-router';
import { useEventUpdate } from '../hooks/useEventUpdate';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { usePermissions } from '@/zero/rbac';
import { useState, useRef, useMemo, useEffect } from 'react';
import { useAllGroups, useUserGroupsWithManageEvents } from '@/zero/groups/useGroupState';
import { toTypeaheadItems } from '@/features/shared/ui/typeahead/toTypeaheadItems';
import { formatNamedLocation } from '@/features/shared/logic/locationHelpers';
import { hasOpenElectorateSnapshot } from '@/zero/events/attendance-mode';
interface EventEditProps {
  eventId: string;
  mode?: 'create' | 'edit';
  defaultTab?: 'basic-info' | 'time-series' | 'event-type';
  onTabChange?: (tab: 'basic-info' | 'time-series' | 'event-type') => void;
}

export function useEventEditController({
  eventId,
  mode = 'edit',
  defaultTab,
  onTabChange,
}: EventEditProps) {
  const navigate = useNavigate();

  const { t } = useTranslation();

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const [showReview, setShowReview] = useState(false);
  const [activeTab, setActiveTab] = useState(defaultTab ?? 'basic-info');

  useEffect(() => setActiveTab(defaultTab ?? 'basic-info'), [defaultTab]);

  const handleTabChange = (tab: 'basic-info' | 'time-series' | 'event-type') => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  const formRef = useRef<HTMLFormElement>(null);

  const { can } = usePermissions({ eventId });

  const { manageEventGroupIds } = useUserGroupsWithManageEvents();

  const { groups } = useAllGroups();

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
    timeSeriesValidationError,
  } = useEventUpdate(eventId, mode);

  const attendanceModeLocked = useMemo(
    () =>
      mode === 'edit' &&
      Boolean(
        event?.agenda_items?.some(
          agendaItem =>
            hasOpenElectorateSnapshot(agendaItem.votes) ||
            hasOpenElectorateSnapshot(agendaItem.election)
        )
      ),
    [event?.agenda_items, mode]
  );

  const locationSummary = formatNamedLocation(formData.locationName, {
    country: formData.country,
    region: formData.region,
    post_code: formData.postCode,
    city: formData.city,
    street: formData.street,
    house_number: formData.houseNumber,
  });

  const visibilityLabel =
    formData.visibility === translateText('generated.inline.0030_public_61c9b2b1')
      ? t('pages.create.common.public')
      : formData.visibility === translateText('generated.inline.0031_authenticated_8fda38ce')
        ? t('pages.create.common.authenticated')
        : t('pages.create.common.private');

  const attendanceModeLabel =
    formData.attendanceMode === translateText('generated.inline.0035_online_2dbc2fd2')
      ? 'Online'
      : formData.attendanceMode === translateText('generated.inline.0036_hybrid_e2ac482d')
        ? 'Hybrid'
        : 'Offline';

  const timeSeriesValidationMessage =
    timeSeriesValidationError === 'missing-start-date'
      ? t('features.events.editPage.timeSeries.validation.startDateRequired')
      : timeSeriesValidationError === 'missing-weekdays'
        ? t('features.events.editPage.timeSeries.validation.weekdaysRequired')
        : null;

  const selectableGroups = useMemo(() => {
    const manageable = groups.filter(group => manageEventGroupIds.has(group.id));

    if (!formData.groupId) {
      return manageable;
    }

    if (manageable.some(group => group.id === formData.groupId)) {
      return manageable;
    }

    const selectedGroup = groups.find(group => group.id === formData.groupId);
    return selectedGroup ? [selectedGroup, ...manageable] : manageable;
  }, [groups, manageEventGroupIds, formData.groupId]);

  const groupTypeaheadItems = useMemo(
    () =>
      toTypeaheadItems(
        selectableGroups,
        'group',
        group => group.name || 'Group',
        group =>
          typeof group.description === 'string' ? group.description.substring(0, 60) : undefined,
        undefined,
        group => `/group/${group.id}`
      ),
    [selectableGroups]
  );

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

  return {
    eventId,
    mode,
    activeTab,
    onTabChange: handleTabChange,
    navigate,
    t,
    cancelDialogOpen,
    setCancelDialogOpen,
    showReview,
    setShowReview,
    formRef,
    can,
    manageEventGroupIds,
    groups,
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
    attendanceModeLocked,
    timeSeriesValidationError,
    locationSummary,
    visibilityLabel,
    attendanceModeLabel,
    timeSeriesValidationMessage,
    selectableGroups,
    groupTypeaheadItems,
    onFormSubmit,
    confirmCreate,
  };
}
