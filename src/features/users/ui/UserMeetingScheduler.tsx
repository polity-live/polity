'use client';

import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { format } from 'date-fns';
import { useMeetPage } from '@/features/meet/hooks/useMeetPage';
import { richTextToPlainText } from '@/features/shared/logic/richText';
import { UserMeetingSchedulerView } from './UserMeetingSchedulerView';

interface UserMeetingSchedulerProps {
  userId: string;
}

export function UserMeetingScheduler({ userId }: UserMeetingSchedulerProps) {
  const {
    isAuthenticated,
    isOwner,
    isLoading,
    owner,
    meetings,
    view,
    setView,
    selectedDate,
    setSelectedDate,
    currentViewTitle,
    goToPrevious,
    goToNext,
    goToToday,
    allInstances,
    filteredInstances,
    getInstancesForDate,
    isBookingDialogOpen,
    setIsBookingDialogOpen,
    selectedInstance,
    handleBookMeeting,
    handleCancelBooking,
    handleUpdateMeeting,
    handleDeleteMeeting,
    openBookingDialog,
  } = useMeetPage(userId);
  const navigate = useNavigate();

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDate, setEditDate] = useState<Date | undefined>(undefined);
  const [editTime, setEditTime] = useState('09:00');
  const [editDuration, setEditDuration] = useState('60');
  const [editType, setEditType] = useState<'one-on-one' | 'public-meeting'>('one-on-one');
  const [editMaxBookings, setEditMaxBookings] = useState('1');
  const [editLocation, setEditLocation] = useState('');
  const [editLocationUrl, setEditLocationUrl] = useState('');
  const [editingRecurringSeries, setEditingRecurringSeries] = useState(false);
  const trimmedEditTitle = editTitle.trim();
  const canSaveMeeting =
    Boolean(editDate) &&
    trimmedEditTitle.length > 0 &&
    Boolean(editTime) &&
    Number(editDuration) >= 15;

  const resetEditForm = () => {
    setEditingMeetingId(null);
    setEditTitle('');
    setEditDescription('');
    setEditDate(undefined);
    setEditTime('09:00');
    setEditDuration('60');
    setEditType('one-on-one');
    setEditMaxBookings('1');
    setEditLocation('');
    setEditLocationUrl('');
    setEditingRecurringSeries(false);
  };

  const openCreateEventFlow = () => {
    navigate({
      to: '/create/event',
      search: { eventType: 'meeting' },
    });
  };

  const openEditDialog = (instance: {
    parentEventId: string;
    startDate: number;
    endDate: number;
    title: string;
  }) => {
    const meeting = meetings.find(row => row.id === instance.parentEventId);
    if (!meeting) return;

    const startDate = new Date(meeting.start_date ?? instance.startDate);
    const endDate = new Date(meeting.end_date ?? instance.endDate);
    const durationMinutes = Math.max(
      15,
      Math.round((endDate.getTime() - startDate.getTime()) / 60000) || 60
    );

    setEditingMeetingId(meeting.id);
    setEditTitle(meeting.title ?? instance.title);
    setEditDescription(richTextToPlainText(meeting.description));
    setEditDate(startDate);
    setEditTime(format(startDate, 'HH:mm'));
    setEditDuration(String(durationMinutes));
    setEditType((meeting.meeting_type as 'one-on-one' | 'public-meeting') ?? 'one-on-one');
    setEditMaxBookings(String(meeting.max_bookings ?? 1));
    setEditLocation(meeting.location_name ?? '');
    setEditLocationUrl(meeting.location_url ?? '');
    setEditingRecurringSeries(Boolean(meeting.is_recurring));
    setIsEditDialogOpen(true);
  };

  const handleSubmitEdit = async () => {
    if (!editingMeetingId || !editDate || !canSaveMeeting) return;

    const [hours, minutes] = editTime.split(':');
    const startDate = new Date(editDate);
    startDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    await handleUpdateMeeting({
      id: editingMeetingId,
      startDate,
      title: trimmedEditTitle,
      description: editDescription,
      meetingType: editType,
      durationMinutes: parseInt(editDuration),
      maxBookings: editType === 'one-on-one' ? 1 : parseInt(editMaxBookings) || 10,
      location: editLocation,
      locationUrl: editLocationUrl,
    });

    setIsEditDialogOpen(false);
    resetEditForm();
  };

  const handleEditDialogOpenChange = (open: boolean) => {
    setIsEditDialogOpen(open);
    if (!open) {
      resetEditForm();
    }
  };

  return (
    <UserMeetingSchedulerView
      allInstances={allInstances}
      canSaveMeeting={canSaveMeeting}
      currentViewTitle={currentViewTitle}
      editDate={editDate}
      editDescription={editDescription}
      editDuration={editDuration}
      editLocation={editLocation}
      editLocationUrl={editLocationUrl}
      editMaxBookings={editMaxBookings}
      editTime={editTime}
      editTitle={editTitle}
      editType={editType}
      editingMeetingId={editingMeetingId}
      editingRecurringSeries={editingRecurringSeries}
      filteredInstances={filteredInstances}
      getInstancesForDate={getInstancesForDate}
      goToNext={goToNext}
      goToPrevious={goToPrevious}
      goToToday={goToToday}
      handleBookMeeting={handleBookMeeting}
      handleCancelBooking={handleCancelBooking}
      handleDeleteMeeting={handleDeleteMeeting}
      handleEditDialogOpenChange={handleEditDialogOpenChange}
      handleSubmitEdit={handleSubmitEdit}
      handleUpdateMeeting={handleUpdateMeeting}
      isBookingDialogOpen={isBookingDialogOpen}
      isEditDialogOpen={isEditDialogOpen}
      isLoading={isLoading}
      isAuthenticated={isAuthenticated}
      isOwner={isOwner}
      meetings={meetings}
      navigate={navigate}
      openBookingDialog={openBookingDialog}
      openCreateEventFlow={openCreateEventFlow}
      openEditDialog={openEditDialog}
      owner={owner}
      resetEditForm={resetEditForm}
      selectedDate={selectedDate}
      selectedInstance={selectedInstance}
      setEditDate={setEditDate}
      setEditDescription={setEditDescription}
      setEditDuration={setEditDuration}
      setEditLocation={setEditLocation}
      setEditLocationUrl={setEditLocationUrl}
      setEditMaxBookings={setEditMaxBookings}
      setEditTime={setEditTime}
      setEditTitle={setEditTitle}
      setEditType={setEditType}
      setEditingMeetingId={setEditingMeetingId}
      setEditingRecurringSeries={setEditingRecurringSeries}
      setIsBookingDialogOpen={setIsBookingDialogOpen}
      setIsEditDialogOpen={setIsEditDialogOpen}
      setSelectedDate={setSelectedDate}
      setView={setView}
      trimmedEditTitle={trimmedEditTitle}
      userId={userId}
      view={view}
    />
  );
}
