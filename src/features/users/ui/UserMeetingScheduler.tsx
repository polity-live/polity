'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import { Calendar } from '@/features/shared/ui/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/features/shared/ui/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { ScrollArea } from '@/features/shared/ui/ui/scroll-area';
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
import { Switch } from '@/features/shared/ui/ui/switch';
import { startOfDay, isPast } from 'date-fns';
import {
  Calendar as CalendarIcon,
  Clock,
  ExternalLink,
  MapPin,
  Users,
  Video,
  Plus,
  Repeat,
} from 'lucide-react';
import { format } from 'date-fns';
import { useMeetPage } from '@/features/meet/hooks/useMeetPage';
import { MeetingInstanceCard } from '@/features/meet/ui/MeetingInstanceCard';
import type { RecurrencePattern } from '@/features/events/logic/rruleHelpers';
import { SharedCalendarHeader } from '@/features/events/ui/calendar/SharedCalendarHeader';
import { MeetingListView, MeetingMonthView, MeetingWeekView } from '@/features/meet/ui/MeetingCalendarViews';

interface UserMeetingSchedulerProps {
  userId: string;
}

export function UserMeetingScheduler({ userId }: UserMeetingSchedulerProps) {
  const {
    currentUser,
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
    nextPublicMeeting,
    getInstancesForDate,
    isCreateDialogOpen,
    setIsCreateDialogOpen,
    isBookingDialogOpen,
    setIsBookingDialogOpen,
    selectedInstance,
    handleBookMeeting,
    handleCancelBooking,
    handleCreateMeeting,
    handleUpdateMeeting,
    handleDeleteMeeting,
    openBookingDialog,
  } = useMeetPage(userId);

  // Create meeting form state
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newDate, setNewDate] = useState<Date | undefined>(new Date());
  const [newTime, setNewTime] = useState('09:00');
  const [newDuration, setNewDuration] = useState('60');
  const [newType, setNewType] = useState<'one-on-one' | 'public-meeting'>('one-on-one');
  const [newMaxBookings, setNewMaxBookings] = useState('1');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringPattern, setRecurringPattern] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [recurringEndDate, setRecurringEndDate] = useState<Date | undefined>(undefined);
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([0, 1, 2, 3, 4]); // Mon-Fri (rrule 0-indexed)
  const [newLocation, setNewLocation] = useState('');
  const [newLocationUrl, setNewLocationUrl] = useState('');
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

  const trimmedTitle = newTitle.trim();
  const canCreateMeeting =
    Boolean(newDate) &&
    trimmedTitle.length > 0 &&
    Boolean(newTime) &&
    Number(newDuration) >= 15 &&
    (!isRecurring || recurringPattern !== 'weekly' || selectedWeekdays.length > 0);
  const trimmedEditTitle = editTitle.trim();
  const canSaveMeeting =
    Boolean(editDate) &&
    trimmedEditTitle.length > 0 &&
    Boolean(editTime) &&
    Number(editDuration) >= 15;

  const resetForm = () => {
    setNewTitle('');
    setNewDescription('');
    setNewDate(new Date());
    setNewTime('09:00');
    setNewDuration('60');
    setNewType('one-on-one');
    setNewMaxBookings('1');
    setIsRecurring(false);
    setRecurringPattern('weekly');
    setRecurringEndDate(undefined);
    setSelectedWeekdays([0, 1, 2, 3, 4]);
    setNewLocation('');
    setNewLocationUrl('');
  };

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

  const openEditDialog = (instance: { parentEventId: string; startDate: number; endDate: number; title: string }) => {
    const meeting = meetings.find(row => row.id === instance.parentEventId);
    if (!meeting) return;

    const startDate = new Date(meeting.start_date ?? instance.startDate);
    const endDate = new Date(meeting.end_date ?? instance.endDate);
    const durationMinutes = Math.max(15, Math.round((endDate.getTime() - startDate.getTime()) / 60000) || 60);

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

  const handleSubmitCreate = async () => {
    if (!newDate || !currentUser || !canCreateMeeting) return;

    const [hours, minutes] = newTime.split(':');
    const startDate = new Date(newDate);
    startDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    await handleCreateMeeting({
      title: trimmedTitle,
      description: newDescription,
      meetingType: newType,
      startDate,
      durationMinutes: parseInt(newDuration),
      maxBookings: newType === 'one-on-one' ? 1 : parseInt(newMaxBookings) || 10,
      location: newLocation,
      locationUrl: newLocationUrl,
      isRecurring,
      recurrence: isRecurring
        ? {
            pattern: recurringPattern as RecurrencePattern,
            interval: 1,
            weekdays: recurringPattern === 'weekly' ? selectedWeekdays : [],
            endDate: recurringEndDate ? recurringEndDate.toISOString().split('T')[0] : null,
          }
        : undefined,
    });

    resetForm();
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-lg text-muted-foreground">Loading meetings...</div>
      </div>
    );
  }

  // Booked instances (for bookings tab)
  const bookedInstances = allInstances.filter(inst =>
    isOwner ? inst.bookingCount > 0 : inst.isBookedByMe,
  );
  const nextPublicMeetingOnlineUrl = nextPublicMeeting?.locationUrl ?? nextPublicMeeting?.streamUrl;
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
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Offer a meeting
            </Button>
          ) : undefined
        }
      />

      <p className="mb-8 max-w-3xl text-muted-foreground">
        {isOwner
          ? 'Create meeting offers that other people can discover now and book later.'
          : `Browse the meeting offers ${owner?.first_name || 'this user'} has published and book an available time that fits.`}
      </p>

      {/* Next Public Meeting Card */}
      {nextPublicMeeting && (
        <Card
          className={`mb-6 border-primary/20 bg-primary/5 ${isOwner ? 'cursor-pointer transition-colors hover:border-primary hover:bg-primary/10' : ''}`}
          onClick={() => {
            if (isOwner) {
              openEditDialog(nextPublicMeeting);
            }
          }}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Next Public Meeting Offer
            </CardTitle>
            <CardDescription>Upcoming open session offered for people to book and join.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <h3 className="font-semibold">{nextPublicMeeting.title}</h3>
                {nextPublicMeeting.description && (
                  <p className="text-sm text-muted-foreground">{nextPublicMeeting.description}</p>
                )}
                <div className="flex flex-wrap gap-3 text-sm">
                  <div className="flex items-center gap-1">
                    <CalendarIcon className="h-4 w-4" />
                    {format(new Date(nextPublicMeeting.startDate), 'PPP')}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {format(new Date(nextPublicMeeting.startDate), 'p')} -{' '}
                    {format(new Date(nextPublicMeeting.endDate), 'p')}
                  </div>
                  {nextPublicMeeting.locationName && (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {nextPublicMeeting.locationName}
                    </div>
                  )}
                  {nextPublicMeetingOnlineUrl && (
                    <a
                      href={nextPublicMeetingOnlineUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                      onClick={event => event.stopPropagation()}
                    >
                      <Video className="h-4 w-4" />
                      Open online meeting link
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>

                {nextPublicMeeting.bookingCount > 0 && (
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {nextPublicMeeting.participants
                        .filter(p => p.user_id !== nextPublicMeeting.creator?.id)
                        .slice(0, 5)
                        .map(p => (
                          <Avatar key={p.id} className="h-8 w-8 border-2 border-background">
                            <AvatarImage src={p.user?.avatar ?? undefined} />
                            <AvatarFallback className="text-xs">
                              {p.user?.first_name?.[0]?.toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {nextPublicMeeting.bookingCount} attending
                    </span>
                  </div>
                )}
              </div>
              {!isOwner && !nextPublicMeeting.isBookedByMe && (
                <Button onClick={() => openBookingDialog(nextPublicMeeting)}>
                  <Video className="mr-2 h-4 w-4" />
                  Book Meeting
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

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
          <TabsTrigger value="bookings">{isOwner ? 'Booked With You' : 'My Booked Meetings'}</TabsTrigger>
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
                <div className="mb-4">
                  <Button onClick={() => setIsCreateDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Offer a Meeting
                  </Button>
                </div>
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
                  <p className="py-8 text-center text-sm text-muted-foreground">
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
                      className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
                    >
                      <Video className="h-4 w-4" />
                      Open online meeting link
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  {selectedInstance.bookingCount > 0 && (
                    <div className="text-sm text-muted-foreground">
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

      {/* Create Meeting Dialog */}
      <Dialog
        open={isCreateDialogOpen}
        onOpenChange={open => {
          setIsCreateDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col">
          <DialogHeader>
            <DialogTitle>Offer Meeting</DialogTitle>
            <DialogDescription>
              Create {isRecurring ? 'a recurring' : 'a'} meeting offer that other people can book later.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="min-h-0 flex-1 pr-4">
            <div className="space-y-4 pb-6">
              <div className="space-y-2">
                <Label>Meeting Type</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={newType === 'one-on-one' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setNewType('one-on-one')}
                  >
                    1-on-1 offer
                  </Button>
                  <Button
                    type="button"
                    variant={newType === 'public-meeting' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setNewType('public-meeting')}
                  >
                    <Users className="mr-2 h-4 w-4" />
                    Public session
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Switch id="recurring" checked={isRecurring} onCheckedChange={setIsRecurring} />
                  <Label htmlFor="recurring" className="flex cursor-pointer items-center gap-2">
                    <Repeat className="h-4 w-4" />
                    Recurring meeting offer
                  </Label>
                </div>
              </div>

              {isRecurring && (
                <div className="space-y-4 rounded-lg border bg-muted/50 p-4">
                  <div className="space-y-2">
                    <Label>Recurrence Pattern</Label>
                    <div className="flex gap-2">
                      {(['daily', 'weekly', 'monthly'] as const).map(p => (
                        <Button
                          key={p}
                          type="button"
                          size="sm"
                          variant={recurringPattern === p ? 'default' : 'outline'}
                          onClick={() => setRecurringPattern(p)}
                        >
                          {p.charAt(0).toUpperCase() + p.slice(1)}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {recurringPattern === 'weekly' && (
                    <div className="space-y-2">
                      <Label>Weekdays</Label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { label: 'Mon', value: 0 },
                          { label: 'Tue', value: 1 },
                          { label: 'Wed', value: 2 },
                          { label: 'Thu', value: 3 },
                          { label: 'Fri', value: 4 },
                          { label: 'Sat', value: 5 },
                          { label: 'Sun', value: 6 },
                        ].map(day => (
                          <Button
                            key={day.value}
                            type="button"
                            size="sm"
                            variant={selectedWeekdays.includes(day.value) ? 'default' : 'outline'}
                            onClick={() => {
                              setSelectedWeekdays(prev =>
                                prev.includes(day.value)
                                  ? prev.filter(d => d !== day.value)
                                  : [...prev, day.value],
                              );
                            }}
                          >
                            {day.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>End Date (Optional)</Label>
                    <Calendar
                      mode="single"
                      selected={recurringEndDate}
                      onSelect={setRecurringEndDate}
                      className="rounded-md border"
                      disabled={date => isPast(startOfDay(date))}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="meeting-title">Title</Label>
                <Input
                  id="meeting-title"
                  placeholder={newType === 'public-meeting' ? 'Public office hours' : 'Intro meeting'}
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  A clear title is required before you can publish this meeting offer.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="meeting-description">Description</Label>
                <Textarea
                  id="meeting-description"
                  placeholder="Tell people what this offered meeting is for and what they should prepare."
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="meeting-location">Location</Label>
                  <Input
                    id="meeting-location"
                    placeholder="Office, cafe, call-in studio, ..."
                    value={newLocation}
                    onChange={e => setNewLocation(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="meeting-location-url">Online Meeting URL</Label>
                  <Input
                    id="meeting-location-url"
                    type="url"
                    placeholder="https://..."
                    value={newLocationUrl}
                    onChange={e => setNewLocationUrl(e.target.value)}
                  />
                </div>
              </div>

              {newType === 'public-meeting' && (
                <div className="space-y-2">
                  <Label htmlFor="max-bookings">Max Participants</Label>
                  <Input
                    id="max-bookings"
                    type="number"
                    min="1"
                    max="100"
                    value={newMaxBookings}
                    onChange={e => setNewMaxBookings(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>{isRecurring ? 'Start Date' : 'Date'}</Label>
                <Calendar
                  mode="single"
                  selected={newDate}
                  onSelect={setNewDate}
                  className="rounded-md border"
                  disabled={date => isPast(startOfDay(date))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="meeting-time">Start Time</Label>
                  <Input
                    id="meeting-time"
                    type="time"
                    value={newTime}
                    onChange={e => setNewTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="meeting-duration">Duration (min)</Label>
                  <Input
                    id="meeting-duration"
                    type="number"
                    min="15"
                    step="15"
                    value={newDuration}
                    onChange={e => setNewDuration(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmitCreate} disabled={!canCreateMeeting}>
              Create meeting offer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isEditDialogOpen}
        onOpenChange={open => {
          setIsEditDialogOpen(open);
          if (!open) resetEditForm();
        }}
      >
        <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col">
          <DialogHeader>
            <DialogTitle>Edit Meeting Offer</DialogTitle>
            <DialogDescription>
              Update this meeting offer and save your changes.
              {editingRecurringSeries ? ' Changes to time, title, and location apply to the whole recurring offer.' : ''}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="min-h-0 flex-1 pr-4">
            <div className="space-y-4 pb-6">
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
          </ScrollArea>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false);
                resetEditForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmitEdit} disabled={!canSaveMeeting}>
              Save Meeting
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
