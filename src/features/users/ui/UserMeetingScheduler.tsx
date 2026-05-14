'use client';

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
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/features/shared/ui/ui/dialog';
import { Input } from '@/features/shared/ui/ui/input';
import { Label } from '@/features/shared/ui/ui/label';
import { Textarea } from '@/features/shared/ui/ui/textarea';
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
    setEditDescription(meeting.description ?? '');
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
        <div className="text-muted-foreground text-lg">Loading meetings...</div>
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
              Offer a meeting
            </Button>
          ) : undefined
        }
      />

      <p className="text-muted-foreground mb-8 max-w-3xl">
        {isOwner
          ? 'Create meeting offers that other people can discover now and book later.'
          : `Browse the meeting offers ${owner?.first_name || 'this user'} has published and book an available time that fits.`}
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
          {isOwner && <TabsTrigger value="manage">Meeting Offers</TabsTrigger>}
          <TabsTrigger value="bookings">
            {isOwner ? 'Booked With You' : 'My Booked Meetings'}
          </TabsTrigger>
        </TabsList>

        {isOwner && (
          <TabsContent value="manage" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>All Meeting Offers</CardTitle>
                <CardDescription>
                  Review the meetings you are offering for other people to book.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {meetings.length === 0 && (
                  <div className="mb-4">
                    <Button onClick={openCreateEventFlow}>
                      <Plus className="mr-2 h-4 w-4" />
                      Offer a Meeting
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
              <CardTitle>{isOwner ? 'Bookings on Your Offers' : 'My Booked Meetings'}</CardTitle>
              <CardDescription>
                {isOwner
                  ? 'See which people have already booked the meeting offers you published.'
                  : 'Review the meetings you have booked from this schedule.'}
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
                    No booked meetings yet
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Booking Dialog */}
      <Dialog open={isBookingDialogOpen} onOpenChange={setIsBookingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Book Meeting Offer</DialogTitle>
            <DialogDescription>
              Confirm your booking for the offered meeting {selectedInstance?.title}
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
                      Open online meeting link
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  {selectedInstance.bookingCount > 0 && (
                    <div className="text-muted-foreground text-sm">
                      {selectedInstance.bookingCount} / {selectedInstance.maxBookings} spots taken
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBookingDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => selectedInstance && handleBookMeeting(selectedInstance)}
              disabled={
                !selectedInstance ||
                selectedInstance.isBookedByMe ||
                selectedInstance.bookingCount >= selectedInstance.maxBookings
              }
            >
              Confirm Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={handleEditDialogOpenChange}>
        <DialogContent className="!flex !max-h-[calc(100vh-2rem)] !max-w-2xl !flex-col !overflow-hidden sm:!max-w-2xl">
          <DialogHeader className="border-b px-6 pt-6 pr-14 pb-4">
            <DialogTitle>Edit Meeting Offer</DialogTitle>
            <DialogDescription>
              Update this meeting offer and save your changes.
              {editingRecurringSeries
                ? ' Changes to time, title, and location apply to the whole recurring offer.'
                : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-4 pb-2">
              <div className="space-y-2">
                <Label>Meeting Type</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={editType === 'one-on-one' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setEditType('one-on-one')}
                  >
                    1-on-1 offer
                  </Button>
                  <Button
                    type="button"
                    variant={editType === 'public-meeting' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setEditType('public-meeting')}
                  >
                    <Users className="mr-2 h-4 w-4" />
                    Public session
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-meeting-title">Title</Label>
                <Input
                  id="edit-meeting-title"
                  value={editTitle}
                  onChange={event => setEditTitle(event.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-meeting-description">Description</Label>
                <Textarea
                  id="edit-meeting-description"
                  value={editDescription}
                  onChange={event => setEditDescription(event.target.value)}
                  rows={3}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-meeting-location">Location</Label>
                  <Input
                    id="edit-meeting-location"
                    value={editLocation}
                    onChange={event => setEditLocation(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-meeting-location-url">Online Meeting URL</Label>
                  <Input
                    id="edit-meeting-location-url"
                    type="url"
                    value={editLocationUrl}
                    onChange={event => setEditLocationUrl(event.target.value)}
                  />
                </div>
              </div>

              {editType === 'public-meeting' && (
                <div className="space-y-2">
                  <Label htmlFor="edit-max-bookings">Max Participants</Label>
                  <Input
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
                <Label>Date</Label>
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
                  <Label htmlFor="edit-meeting-time">Start Time</Label>
                  <Input
                    id="edit-meeting-time"
                    type="time"
                    value={editTime}
                    onChange={event => setEditTime(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-meeting-duration">Duration (min)</Label>
                  <Input
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
                Cancel
              </Button>
              <Button onClick={handleSubmitEdit} disabled={!canSaveMeeting}>
                Save Meeting
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
