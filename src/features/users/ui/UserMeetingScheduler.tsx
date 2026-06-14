'use client';

import { FormControlInput, FormControlTextarea, FormControlLabel } from '@/features/shared/ui/form';
import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import { Calendar } from '@/features/shared/ui/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/features/shared/ui/ui/tabs';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/features/shared/ui/ui/dialog';
import { startOfDay, isPast } from 'date-fns';
import {
  Calendar as CalendarIcon,
  Clock,
  ExternalLink,
  MapPin,
  Users,
  Video,
  Plus,
} from 'lucide-react';
import { format } from 'date-fns';
import { useMeetPage } from '@/features/meet/hooks/useMeetPage';
import { MeetingInstanceCard } from '@/features/meet/ui/MeetingInstanceCard';
import { SharedCalendarHeader } from '@/features/events/ui/calendar/SharedCalendarHeader';
import {
  MeetingListView,
  MeetingMonthView,
  MeetingWeekView,
} from '@/features/meet/ui/MeetingCalendarViews';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { richTextToPlainText } from '@/features/shared/logic/richText';

interface UserMeetingSchedulerProps {
  userId: string;
}

export function UserMeetingScheduler({ userId }: UserMeetingSchedulerProps) {
  const {
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
      title: trimmedEditTitle,
      description: editDescription,
      meetingType: editType,
      startDate,
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground text-lg">
          {translateText('generated.inline.1205_loading_meetings_cc9cc88a')}
        </div>
      </div>
    );
  }

  // Booked instances (for bookings tab)
  const bookedInstances = allInstances.filter(inst =>
    isOwner ? inst.bookingCount > 0 : inst.isBookedByMe
  );
  const selectedInstanceOnlineUrl = selectedInstance?.locationUrl ?? selectedInstance?.streamUrl;

  return (
    <div>
      <SharedCalendarHeader
        viewMode={view}
        setViewMode={setView}
        currentViewTitle={currentViewTitle}
        onPrevious={goToPrevious}
        onNext={goToNext}
        onToday={goToToday}
        title={
          isOwner
            ? 'Manage your meeting offers'
            : `Book a meeting with ${owner?.first_name || 'User'}`
        }
        actions={
          isOwner ? (
            <Button onClick={openCreateEventFlow}>
              <Plus className="mr-2 h-4 w-4" />
              {translateText('generated.inline.1206_offer_a_meeting_815bf49a')}
            </Button>
          ) : undefined
        }
      />

      <p className="text-muted-foreground mb-8 max-w-3xl">
        {isOwner
          ? translateText(
              'generated.inline.0149_create_meeting_offers_that_other_people_can_d_8fecf2f5'
            )
          : translateText(
              'generated.inline.0182_browse_the_meeting_offers_valuee1a5_has_publi_1575f449',
              {
                valuee1a5:
                  owner?.first_name || translateText('generated.inline.0150_this_user_a0fbee4e'),
              }
            )}
      </p>

      {view === 'list' && (
        <MeetingListView
          instances={filteredInstances}
          selectedDate={selectedDate}
          isOwner={isOwner}
          onBook={openBookingDialog}
          onCancel={handleCancelBooking}
          onDelete={handleDeleteMeeting}
          onSelectInstance={isOwner ? openEditDialog : openBookingDialog}
        />
      )}

      {view === 'week' && (
        <MeetingWeekView
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
          getInstancesForDate={getInstancesForDate}
          onSelectInstance={isOwner ? openEditDialog : openBookingDialog}
        />
      )}

      {view === 'month' && (
        <MeetingMonthView
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
          getInstancesForDate={getInstancesForDate}
          onSelectInstance={isOwner ? openEditDialog : openBookingDialog}
        />
      )}

      {/* Tabs: Manage Meetings / Bookings */}
      <Tabs defaultValue={isOwner ? 'manage' : 'bookings'} className="mt-6 space-y-6">
        <TabsList>
          {isOwner && (
            <TabsTrigger value="manage">
              {translateText('generated.inline.1207_meeting_offers_86d14c14')}
            </TabsTrigger>
          )}
          <TabsTrigger value="bookings">
            {isOwner
              ? translateText('generated.inline.0151_booked_with_you_0111015e')
              : translateText('generated.inline.0152_my_booked_meetings_ecb1cc54')}
          </TabsTrigger>
        </TabsList>

        {isOwner && (
          <TabsContent value="manage" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>
                  {translateText('generated.inline.1208_all_meeting_offers_ae7b767d')}
                </CardTitle>
                <CardDescription>
                  {translateText(
                    'generated.inline.1209_review_the_meetings_you_are_offering_for_othe_ed7d259e'
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {meetings.length === 0 && (
                  <div className="mb-4">
                    <Button onClick={openCreateEventFlow}>
                      <Plus className="mr-2 h-4 w-4" />
                      {translateText('generated.inline.1210_offer_a_meeting_3aa52ce6')}
                    </Button>
                  </div>
                )}
                <div className="space-y-3">
                  {allInstances
                    .filter(inst => inst.endDate > Date.now())
                    .map(inst => (
                      <MeetingInstanceCard
                        key={inst.id}
                        instance={inst}
                        isOwner={isOwner}
                        onBook={openBookingDialog}
                        onCancel={handleCancelBooking}
                        onDelete={handleDeleteMeeting}
                        onSelect={openEditDialog}
                      />
                    ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="bookings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>
                {isOwner
                  ? translateText('generated.inline.0153_bookings_on_your_offers_5cb3760c')
                  : translateText('generated.inline.0152_my_booked_meetings_ecb1cc54')}
              </CardTitle>
              <CardDescription>
                {isOwner
                  ? translateText(
                      'generated.inline.0154_see_which_people_have_already_booked_the_meet_dc4cb80f'
                    )
                  : translateText(
                      'generated.inline.0155_review_the_meetings_you_have_booked_from_this_fa2b6402'
                    )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {bookedInstances.length > 0 ? (
                  bookedInstances.map(inst => (
                    <MeetingInstanceCard
                      key={inst.id}
                      instance={inst}
                      isOwner={isOwner}
                      onBook={openBookingDialog}
                      onCancel={handleCancelBooking}
                      onDelete={handleDeleteMeeting}
                      onSelect={isOwner ? openEditDialog : undefined}
                    />
                  ))
                ) : (
                  <p className="text-muted-foreground py-8 text-center text-sm">
                    {translateText('generated.inline.1211_no_booked_meetings_yet_a0644b3d')}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Booking Dialog */}
      <Dialog open={isBookingDialogOpen} onOpenChange={setIsBookingDialogOpen}>
        <ScrollableDialogContent>
          <DialogHeader>
            <DialogTitle>
              {translateText('generated.inline.1212_book_meeting_offer_114d8cc1')}
            </DialogTitle>
            <DialogDescription>
              {translateText(
                'generated.inline.1213_confirm_your_booking_for_the_offered_meeting_ad8187df'
              )}
              {selectedInstance?.title}
            </DialogDescription>
          </DialogHeader>
          {selectedInstance && (
            <div className="space-y-4">
              <div className="rounded-lg border p-4">
                <div className="space-y-2">
                  <h4 className="font-semibold">{selectedInstance.title}</h4>
                  <div className="flex items-center gap-2 text-sm">
                    <CalendarIcon className="h-4 w-4" />
                    {format(new Date(selectedInstance.startDate), 'PPP')}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4" />
                    {format(new Date(selectedInstance.startDate), 'p')} -{' '}
                    {format(new Date(selectedInstance.endDate), 'p')}
                  </div>
                  {selectedInstance.locationName && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4" />
                      {selectedInstance.locationName}
                    </div>
                  )}
                  {selectedInstanceOnlineUrl && (
                    <a
                      href={selectedInstanceOnlineUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline"
                    >
                      <Video className="h-4 w-4" />
                      {translateText('generated.inline.1162_open_online_meeting_link_ec74dc3b')}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  {selectedInstance.bookingCount > 0 && (
                    <div className="text-muted-foreground text-sm">
                      {selectedInstance.bookingCount} / {selectedInstance.maxBookings}
                      {translateText('generated.inline.1214_spots_taken_5f65673d')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBookingDialogOpen(false)}>
              {translateText('generated.inline.0065_cancel_77dfd213')}
            </Button>
            <Button
              onClick={() => selectedInstance && handleBookMeeting(selectedInstance)}
              disabled={
                !selectedInstance ||
                selectedInstance.isBookedByMe ||
                selectedInstance.bookingCount >= selectedInstance.maxBookings
              }
            >
              {translateText('generated.inline.1215_confirm_booking_eb9e1e0e')}
            </Button>
          </DialogFooter>
        </ScrollableDialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={handleEditDialogOpenChange}>
        <ScrollableDialogContent className="!flex !max-h-[calc(100vh-2rem)] !max-w-2xl !flex-col !overflow-hidden sm:!max-w-2xl">
          <DialogHeader separator className="px-6 pt-6 pr-14 pb-4">
            <DialogTitle>
              {translateText('generated.inline.1216_edit_meeting_offer_cbc09a1f')}
            </DialogTitle>
            <DialogDescription>
              {translateText(
                'generated.inline.1217_update_this_meeting_offer_and_save_your_chang_c7ead161'
              )}
              {editingRecurringSeries
                ? translateText(
                    'generated.inline.0156_changes_to_time_title_and_location_apply_to_t_7b584001'
                  )
                : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-4 pb-2">
              <div className="space-y-2">
                <FormControlLabel>
                  {translateText('generated.inline.1218_meeting_type_a3a5c802')}
                </FormControlLabel>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={editType === 'one-on-one' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setEditType('one-on-one')}
                  >
                    {translateText('generated.inline.1219_1_on_1_offer_747789b9')}
                  </Button>
                  <Button
                    type="button"
                    variant={editType === 'public-meeting' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setEditType('public-meeting')}
                  >
                    <Users className="mr-2 h-4 w-4" />
                    {translateText('generated.inline.1220_public_session_ecb9bdca')}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <FormControlLabel htmlFor="edit-meeting-title">
                  {translateText('generated.inline.0028_title_768e0c1c')}
                </FormControlLabel>
                <FormControlInput
                  id="edit-meeting-title"
                  value={editTitle}
                  onChange={event => setEditTitle(event.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <FormControlLabel htmlFor="edit-meeting-description">
                  {translateText('generated.inline.0030_description_55f8ebc8')}
                </FormControlLabel>
                <FormControlTextarea
                  id="edit-meeting-description"
                  value={editDescription}
                  onChange={event => setEditDescription(event.target.value)}
                  rows={3}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <FormControlLabel htmlFor="edit-meeting-location">
                    {translateText('generated.inline.1221_location_d219c681')}
                  </FormControlLabel>
                  <FormControlInput
                    id="edit-meeting-location"
                    value={editLocation}
                    onChange={event => setEditLocation(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <FormControlLabel htmlFor="edit-meeting-location-url">
                    {translateText('generated.inline.1222_online_meeting_url_cd6a1657')}
                  </FormControlLabel>
                  <FormControlInput
                    id="edit-meeting-location-url"
                    type="url"
                    value={editLocationUrl}
                    onChange={event => setEditLocationUrl(event.target.value)}
                  />
                </div>
              </div>

              {editType === 'public-meeting' && (
                <div className="space-y-2">
                  <FormControlLabel htmlFor="edit-max-bookings">
                    {translateText('generated.inline.1223_max_participants_fe3a4998')}
                  </FormControlLabel>
                  <FormControlInput
                    id="edit-max-bookings"
                    type="number"
                    min="1"
                    max="100"
                    value={editMaxBookings}
                    onChange={event => setEditMaxBookings(event.target.value)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <FormControlLabel>
                  {translateText('generated.inline.0277_date_eb9a4bc1')}
                </FormControlLabel>
                <Calendar
                  mode="single"
                  selected={editDate}
                  onSelect={setEditDate}
                  className="rounded-md border"
                  disabled={date => isPast(startOfDay(date))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <FormControlLabel htmlFor="edit-meeting-time">
                    {translateText('generated.inline.1224_start_time_41c1074d')}
                  </FormControlLabel>
                  <FormControlInput
                    id="edit-meeting-time"
                    type="time"
                    value={editTime}
                    onChange={event => setEditTime(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <FormControlLabel htmlFor="edit-meeting-duration">
                    {translateText('generated.inline.1225_duration_min_b9d7d9c7')}
                  </FormControlLabel>
                  <FormControlInput
                    id="edit-meeting-duration"
                    type="number"
                    min="15"
                    step="15"
                    value={editDuration}
                    onChange={event => setEditDuration(event.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t px-6 py-4">
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  handleEditDialogOpenChange(false);
                }}
              >
                {translateText('generated.inline.0065_cancel_77dfd213')}
              </Button>
              <Button onClick={handleSubmitEdit} disabled={!canSaveMeeting}>
                {translateText('generated.inline.1226_save_meeting_78284a44')}
              </Button>
            </DialogFooter>
          </div>
        </ScrollableDialogContent>
      </Dialog>
    </div>
  );
}
