'use client';

import {
  FormControlLabel,
  FormControlSelect,
  FormControlSelectContent,
  FormControlSelectItem,
  FormControlSelectTrigger,
  FormControlSelectValue,
} from '@/features/shared/ui/form';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import { Separator } from '@/features/shared/ui/ui/separator';
import {
  Users,
  Calendar,
  FileText,
  BookOpen,
  CheckSquare,
  Heart,
  Send,
  Clock,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import { TimelineRefreshFrequency } from '../types/notification-settings.types';
import { PushNotificationToggle } from '@/features/notifications/ui/push-notification-toggle';
import { SettingItem } from './SettingItem';
export interface NotificationSettingsContentViewProps {
  userId: any;
  t: any;
  settings: any;
  isLoading: any;
  isUpdating: any;
  updateGroupNotifications: any;
  updateEventNotifications: any;
  updateAmendmentNotifications: any;
  updateBlogNotifications: any;
  updateTodoNotifications: any;
  updateSocialNotifications: any;
  updateDeliverySettings: any;
  updateTimelineSettings: any;
  resetToDefaults: any;
  resetting: any;
  setResetting: any;
  handleReset: any;
}

export function NotificationSettingsContentView({
  t,
  settings,
  isLoading,
  isUpdating,
  updateGroupNotifications,
  updateEventNotifications,
  updateAmendmentNotifications,
  updateBlogNotifications,
  updateTodoNotifications,
  updateSocialNotifications,
  updateDeliverySettings,
  updateTimelineSettings,
  resetting,
  handleReset,
}: NotificationSettingsContentViewProps) {
  if (isLoading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Reset button */}
      <div className="flex justify-end">
        <Button variant="outline" onClick={handleReset} disabled={resetting || isUpdating}>
          {resetting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="mr-2 h-4 w-4" />
          )}
          {t('pages.notifications.settingsPage.resetToDefaults')}
        </Button>
      </div>

      {/* Delivery Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            {t('pages.notifications.settingsPage.delivery.title')}
          </CardTitle>
          <CardDescription>
            {t('pages.notifications.settingsPage.delivery.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between space-x-4 py-3">
            <div className="flex-1 space-y-0.5">
              <FormControlLabel className="text-sm font-medium">
                {t('pages.notifications.settingsPage.delivery.push')}
              </FormControlLabel>
              <p className="text-muted-foreground text-xs">
                {t('pages.notifications.settingsPage.delivery.pushDescription')}
              </p>
            </div>
            <PushNotificationToggle variant="minimal" />
          </div>
          <Separator />
          <SettingItem
            label={t('pages.notifications.settingsPage.delivery.inApp')}
            description={t('pages.notifications.settingsPage.delivery.inAppDescription')}
            checked={settings.deliverySettings.inAppNotifications}
            onCheckedChange={checked => {
              updateDeliverySettings({ inAppNotifications: checked });
              // Request browser notification permission when enabling
              // (user gesture → Chrome shows the real dialog)
              if (checked && typeof window !== 'undefined' && 'Notification' in window) {
                if (Notification.permission === 'default') {
                  Notification.requestPermission();
                }
              }
            }}
            disabled={isUpdating}
          />
          <Separator />
          <SettingItem
            label={t('pages.notifications.settingsPage.delivery.email')}
            description={t('pages.notifications.settingsPage.delivery.emailDescription')}
            checked={settings.deliverySettings.emailNotifications}
            onCheckedChange={checked => updateDeliverySettings({ emailNotifications: checked })}
            disabled={true}
          />
        </CardContent>
      </Card>

      {/* Group Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t('pages.notifications.settingsPage.groups.title')}
          </CardTitle>
          <CardDescription>
            {t('pages.notifications.settingsPage.groups.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          <SettingItem
            label={t('pages.notifications.settingsPage.groups.tasksAssigned')}
            description={t('pages.notifications.settingsPage.groups.tasksAssignedDesc')}
            checked={settings.groupNotifications.tasksAssigned}
            onCheckedChange={checked => updateGroupNotifications({ tasksAssigned: checked })}
            disabled={isUpdating}
          />
          <SettingItem
            label={t('pages.notifications.settingsPage.groups.paymentNotifications')}
            description={t('pages.notifications.settingsPage.groups.paymentNotificationsDesc')}
            checked={settings.groupNotifications.paymentNotifications}
            onCheckedChange={checked => updateGroupNotifications({ paymentNotifications: checked })}
            disabled={isUpdating}
          />
          <SettingItem
            label={t('pages.notifications.settingsPage.groups.newEvents')}
            description={t('pages.notifications.settingsPage.groups.newEventsDesc')}
            checked={settings.groupNotifications.newEvents}
            onCheckedChange={checked => updateGroupNotifications({ newEvents: checked })}
            disabled={isUpdating}
          />
          <SettingItem
            label={t('pages.notifications.settingsPage.groups.newAmendments')}
            description={t('pages.notifications.settingsPage.groups.newAmendmentsDesc')}
            checked={settings.groupNotifications.newAmendments}
            onCheckedChange={checked => updateGroupNotifications({ newAmendments: checked })}
            disabled={isUpdating}
          />
          <SettingItem
            label={t('pages.notifications.settingsPage.groups.newRelationships')}
            description={t('pages.notifications.settingsPage.groups.newRelationshipsDesc')}
            checked={settings.groupNotifications.newRelationships}
            onCheckedChange={checked => updateGroupNotifications({ newRelationships: checked })}
            disabled={isUpdating}
          />
          <SettingItem
            label={t('pages.notifications.settingsPage.groups.newRoles')}
            description={t('pages.notifications.settingsPage.groups.newRolesDesc')}
            checked={settings.groupNotifications.newRoles}
            onCheckedChange={checked => updateGroupNotifications({ newRoles: checked })}
            disabled={isUpdating}
          />
          <SettingItem
            label={t('pages.notifications.settingsPage.groups.newDocuments')}
            description={t('pages.notifications.settingsPage.groups.newDocumentsDesc')}
            checked={settings.groupNotifications.newDocuments}
            onCheckedChange={checked => updateGroupNotifications({ newDocuments: checked })}
            disabled={isUpdating}
          />
          <SettingItem
            label={t('pages.notifications.settingsPage.groups.newMembers')}
            description={t('pages.notifications.settingsPage.groups.newMembersDesc')}
            checked={settings.groupNotifications.newMembers}
            onCheckedChange={checked => updateGroupNotifications({ newMembers: checked })}
            disabled={isUpdating}
            adminOnly
          />
          <SettingItem
            label={t('pages.notifications.settingsPage.groups.roleUpdates')}
            description={t('pages.notifications.settingsPage.groups.roleUpdatesDesc')}
            checked={settings.groupNotifications.roleUpdates}
            onCheckedChange={checked => updateGroupNotifications({ roleUpdates: checked })}
            disabled={isUpdating}
          />
          <SettingItem
            label={t('pages.notifications.settingsPage.groups.newSubscribers')}
            description={t('pages.notifications.settingsPage.groups.newSubscribersDesc')}
            checked={settings.groupNotifications.newSubscribers}
            onCheckedChange={checked => updateGroupNotifications({ newSubscribers: checked })}
            disabled={isUpdating}
            adminOnly
          />
          <SettingItem
            label={t('pages.notifications.settingsPage.groups.profileUpdates')}
            description={t('pages.notifications.settingsPage.groups.profileUpdatesDesc')}
            checked={settings.groupNotifications.profileUpdates}
            onCheckedChange={checked => updateGroupNotifications({ profileUpdates: checked })}
            disabled={isUpdating}
          />
          <SettingItem
            label={t('pages.notifications.settingsPage.groups.membershipRequests')}
            description={t('pages.notifications.settingsPage.groups.membershipRequestsDesc')}
            checked={settings.groupNotifications.membershipRequests}
            onCheckedChange={checked => updateGroupNotifications({ membershipRequests: checked })}
            disabled={isUpdating}
            adminOnly
          />
          <SettingItem
            label={t('pages.notifications.settingsPage.groups.membershipInvitations')}
            description={t('pages.notifications.settingsPage.groups.membershipInvitationsDesc')}
            checked={settings.groupNotifications.membershipInvitations}
            onCheckedChange={checked =>
              updateGroupNotifications({ membershipInvitations: checked })
            }
            disabled={isUpdating}
          />
        </CardContent>
      </Card>

      {/* Event Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {t('pages.notifications.settingsPage.events.title')}
          </CardTitle>
          <CardDescription>
            {t('pages.notifications.settingsPage.events.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          <SettingItem
            label={t('pages.notifications.settingsPage.events.agendaItems')}
            description={t('pages.notifications.settingsPage.events.agendaItemsDesc')}
            checked={settings.eventNotifications.agendaItems}
            onCheckedChange={checked => updateEventNotifications({ agendaItems: checked })}
            disabled={isUpdating}
          />
          <SettingItem
            label={t('pages.notifications.settingsPage.events.elections')}
            description={t('pages.notifications.settingsPage.events.electionsDesc')}
            checked={settings.eventNotifications.elections}
            onCheckedChange={checked => updateEventNotifications({ elections: checked })}
            disabled={isUpdating}
          />
          <SettingItem
            label={t('pages.notifications.settingsPage.events.votes')}
            description={t('pages.notifications.settingsPage.events.votesDesc')}
            checked={settings.eventNotifications.votes}
            onCheckedChange={checked => updateEventNotifications({ votes: checked })}
            disabled={isUpdating}
          />
          <SettingItem
            label={t('pages.notifications.settingsPage.events.scheduleChanges')}
            description={t('pages.notifications.settingsPage.events.scheduleChangesDesc')}
            checked={settings.eventNotifications.scheduleChanges}
            onCheckedChange={checked => updateEventNotifications({ scheduleChanges: checked })}
            disabled={isUpdating}
          />
          <SettingItem
            label={t('pages.notifications.settingsPage.events.newParticipants')}
            description={t('pages.notifications.settingsPage.events.newParticipantsDesc')}
            checked={settings.eventNotifications.newParticipants}
            onCheckedChange={checked => updateEventNotifications({ newParticipants: checked })}
            disabled={isUpdating}
            adminOnly
          />
          <SettingItem
            label={t('pages.notifications.settingsPage.events.roleUpdates')}
            description={t('pages.notifications.settingsPage.events.roleUpdatesDesc')}
            checked={settings.eventNotifications.roleUpdates}
            onCheckedChange={checked => updateEventNotifications({ roleUpdates: checked })}
            disabled={isUpdating}
          />
          <SettingItem
            label={t('pages.notifications.settingsPage.events.roleChanges')}
            description={t('pages.notifications.settingsPage.events.roleChangesDesc')}
            checked={settings.eventNotifications.roleChanges}
            onCheckedChange={checked => updateEventNotifications({ roleChanges: checked })}
            disabled={isUpdating}
          />
          <SettingItem
            label={t('pages.notifications.settingsPage.events.profileUpdates')}
            description={t('pages.notifications.settingsPage.events.profileUpdatesDesc')}
            checked={settings.eventNotifications.profileUpdates}
            onCheckedChange={checked => updateEventNotifications({ profileUpdates: checked })}
            disabled={isUpdating}
          />
          <SettingItem
            label={t('pages.notifications.settingsPage.events.newSubscribers')}
            description={t('pages.notifications.settingsPage.events.newSubscribersDesc')}
            checked={settings.eventNotifications.newSubscribers}
            onCheckedChange={checked => updateEventNotifications({ newSubscribers: checked })}
            disabled={isUpdating}
            adminOnly
          />
          <SettingItem
            label={t('pages.notifications.settingsPage.events.participationRequests')}
            description={t('pages.notifications.settingsPage.events.participationRequestsDesc')}
            checked={settings.eventNotifications.participationRequests}
            onCheckedChange={checked =>
              updateEventNotifications({ participationRequests: checked })
            }
            disabled={isUpdating}
            adminOnly
          />
          <SettingItem
            label={t('pages.notifications.settingsPage.events.participationInvitations')}
            description={t('pages.notifications.settingsPage.events.participationInvitationsDesc')}
            checked={settings.eventNotifications.participationInvitations}
            onCheckedChange={checked =>
              updateEventNotifications({ participationInvitations: checked })
            }
            disabled={isUpdating}
          />
          <SettingItem
            label={t('pages.notifications.settingsPage.events.delegateNominations')}
            description={t('pages.notifications.settingsPage.events.delegateNominationsDesc')}
            checked={settings.eventNotifications.delegateNominations}
            onCheckedChange={checked => updateEventNotifications({ delegateNominations: checked })}
            disabled={isUpdating}
          />
          <SettingItem
            label={t('pages.notifications.settingsPage.events.speakerListAdditions')}
            description={t('pages.notifications.settingsPage.events.speakerListAdditionsDesc')}
            checked={settings.eventNotifications.speakerListAdditions}
            onCheckedChange={checked => updateEventNotifications({ speakerListAdditions: checked })}
            disabled={isUpdating}
          />
          <SettingItem
            label={t('pages.notifications.settingsPage.events.meetingBookings')}
            description={t('pages.notifications.settingsPage.events.meetingBookingsDesc')}
            checked={settings.eventNotifications.meetingBookings}
            onCheckedChange={checked => updateEventNotifications({ meetingBookings: checked })}
            disabled={isUpdating}
          />
        </CardContent>
      </Card>

      {/* Amendment Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t('pages.notifications.settingsPage.amendments.title')}
          </CardTitle>
          <CardDescription>
            {t('pages.notifications.settingsPage.amendments.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          <SettingItem
            label={t('pages.notifications.settingsPage.amendments.changeRequests')}
            description={t('pages.notifications.settingsPage.amendments.changeRequestsDesc')}
            checked={settings.amendmentNotifications.changeRequests}
            onCheckedChange={checked => updateAmendmentNotifications({ changeRequests: checked })}
            disabled={isUpdating}
          />
          <SettingItem
            label={t('pages.notifications.settingsPage.amendments.changeRequestDecisions')}
            description={t(
              'pages.notifications.settingsPage.amendments.changeRequestDecisionsDesc'
            )}
            checked={settings.amendmentNotifications.changeRequestDecisions}
            onCheckedChange={checked =>
              updateAmendmentNotifications({ changeRequestDecisions: checked })
            }
            disabled={isUpdating}
          />
          <SettingItem
            label={t('pages.notifications.settingsPage.amendments.newCollaborators')}
            description={t('pages.notifications.settingsPage.amendments.newCollaboratorsDesc')}
            checked={settings.amendmentNotifications.newCollaborators}
            onCheckedChange={checked => updateAmendmentNotifications({ newCollaborators: checked })}
            disabled={isUpdating}
            adminOnly
          />
          <SettingItem
            label={t('pages.notifications.settingsPage.amendments.roleUpdates')}
            description={t('pages.notifications.settingsPage.amendments.roleUpdatesDesc')}
            checked={settings.amendmentNotifications.roleUpdates}
            onCheckedChange={checked => updateAmendmentNotifications({ roleUpdates: checked })}
            disabled={isUpdating}
          />
          <SettingItem
            label={t('pages.notifications.settingsPage.amendments.upvotesDownvotes')}
            description={t('pages.notifications.settingsPage.amendments.upvotesDownvotesDesc')}
            checked={settings.amendmentNotifications.upvotesDownvotes}
            onCheckedChange={checked => updateAmendmentNotifications({ upvotesDownvotes: checked })}
            disabled={isUpdating}
            adminOnly
          />
          <SettingItem
            label={t('pages.notifications.settingsPage.amendments.newSubscribers')}
            description={t('pages.notifications.settingsPage.amendments.newSubscribersDesc')}
            checked={settings.amendmentNotifications.newSubscribers}
            onCheckedChange={checked => updateAmendmentNotifications({ newSubscribers: checked })}
            disabled={isUpdating}
            adminOnly
          />
          <SettingItem
            label={t('pages.notifications.settingsPage.amendments.processProgress')}
            description={t('pages.notifications.settingsPage.amendments.processProgressDesc')}
            checked={settings.amendmentNotifications.processProgress}
            onCheckedChange={checked => updateAmendmentNotifications({ processProgress: checked })}
            disabled={isUpdating}
          />
          <SettingItem
            label={t('pages.notifications.settingsPage.amendments.supportingGroups')}
            description={t('pages.notifications.settingsPage.amendments.supportingGroupsDesc')}
            checked={settings.amendmentNotifications.supportingGroups}
            onCheckedChange={checked => updateAmendmentNotifications({ supportingGroups: checked })}
            disabled={isUpdating}
          />
          <SettingItem
            label={t('pages.notifications.settingsPage.amendments.clones')}
            description={t('pages.notifications.settingsPage.amendments.clonesDesc')}
            checked={settings.amendmentNotifications.clones}
            onCheckedChange={checked => updateAmendmentNotifications({ clones: checked })}
            disabled={isUpdating}
          />
          <SettingItem
            label={t('pages.notifications.settingsPage.amendments.discussions')}
            description={t('pages.notifications.settingsPage.amendments.discussionsDesc')}
            checked={settings.amendmentNotifications.discussions}
            onCheckedChange={checked => updateAmendmentNotifications({ discussions: checked })}
            disabled={isUpdating}
          />
          <SettingItem
            label={t('pages.notifications.settingsPage.amendments.profileUpdates')}
            description={t('pages.notifications.settingsPage.amendments.profileUpdatesDesc')}
            checked={settings.amendmentNotifications.profileUpdates}
            onCheckedChange={checked => updateAmendmentNotifications({ profileUpdates: checked })}
            disabled={isUpdating}
          />
          <SettingItem
            label={t('pages.notifications.settingsPage.amendments.workflowChanges')}
            description={t('pages.notifications.settingsPage.amendments.workflowChangesDesc')}
            checked={settings.amendmentNotifications.workflowChanges}
            onCheckedChange={checked => updateAmendmentNotifications({ workflowChanges: checked })}
            disabled={isUpdating}
          />
          <SettingItem
            label={t('pages.notifications.settingsPage.amendments.collaborationRequests')}
            description={t('pages.notifications.settingsPage.amendments.collaborationRequestsDesc')}
            checked={settings.amendmentNotifications.collaborationRequests}
            onCheckedChange={checked =>
              updateAmendmentNotifications({ collaborationRequests: checked })
            }
            disabled={isUpdating}
            adminOnly
          />
          <SettingItem
            label={t('pages.notifications.settingsPage.amendments.collaborationInvitations')}
            description={t(
              'pages.notifications.settingsPage.amendments.collaborationInvitationsDesc'
            )}
            checked={settings.amendmentNotifications.collaborationInvitations}
            onCheckedChange={checked =>
              updateAmendmentNotifications({ collaborationInvitations: checked })
            }
            disabled={isUpdating}
          />
          <SettingItem
            label={t('pages.notifications.settingsPage.amendments.votingSessions')}
            description={t('pages.notifications.settingsPage.amendments.votingSessionsDesc')}
            checked={settings.amendmentNotifications.votingSessions}
            onCheckedChange={checked => updateAmendmentNotifications({ votingSessions: checked })}
            disabled={isUpdating}
          />
        </CardContent>
      </Card>

      {/* Blog Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            {t('pages.notifications.settingsPage.blogs.title')}
          </CardTitle>
          <CardDescription>
            {t('pages.notifications.settingsPage.blogs.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          <SettingItem
            label={t('pages.notifications.settingsPage.blogs.newSubscribers')}
            description={t('pages.notifications.settingsPage.blogs.newSubscribersDesc')}
            checked={settings.blogNotifications.newSubscribers}
            onCheckedChange={checked => updateBlogNotifications({ newSubscribers: checked })}
            disabled={isUpdating}
            adminOnly
          />
          <SettingItem
            label={t('pages.notifications.settingsPage.blogs.upvotesDownvotes')}
            description={t('pages.notifications.settingsPage.blogs.upvotesDownvotesDesc')}
            checked={settings.blogNotifications.upvotesDownvotes}
            onCheckedChange={checked => updateBlogNotifications({ upvotesDownvotes: checked })}
            disabled={isUpdating}
            adminOnly
          />
          <SettingItem
            label={t('pages.notifications.settingsPage.blogs.profileUpdates')}
            description={t('pages.notifications.settingsPage.blogs.profileUpdatesDesc')}
            checked={settings.blogNotifications.profileUpdates}
            onCheckedChange={checked => updateBlogNotifications({ profileUpdates: checked })}
            disabled={isUpdating}
          />
          <SettingItem
            label={t('pages.notifications.settingsPage.blogs.newWriters')}
            description={t('pages.notifications.settingsPage.blogs.newWritersDesc')}
            checked={settings.blogNotifications.newWriters}
            onCheckedChange={checked => updateBlogNotifications({ newWriters: checked })}
            disabled={isUpdating}
            adminOnly
          />
          <SettingItem
            label={t('pages.notifications.settingsPage.blogs.roleUpdates')}
            description={t('pages.notifications.settingsPage.blogs.roleUpdatesDesc')}
            checked={settings.blogNotifications.roleUpdates}
            onCheckedChange={checked => updateBlogNotifications({ roleUpdates: checked })}
            disabled={isUpdating}
          />
          <SettingItem
            label={t('pages.notifications.settingsPage.blogs.comments')}
            description={t('pages.notifications.settingsPage.blogs.commentsDesc')}
            checked={settings.blogNotifications.comments}
            onCheckedChange={checked => updateBlogNotifications({ comments: checked })}
            disabled={isUpdating}
          />
          <SettingItem
            label={t('pages.notifications.settingsPage.blogs.writerRequests')}
            description={t('pages.notifications.settingsPage.blogs.writerRequestsDesc')}
            checked={settings.blogNotifications.writerRequests}
            onCheckedChange={checked => updateBlogNotifications({ writerRequests: checked })}
            disabled={isUpdating}
            adminOnly
          />
          <SettingItem
            label={t('pages.notifications.settingsPage.blogs.writerInvitations')}
            description={t('pages.notifications.settingsPage.blogs.writerInvitationsDesc')}
            checked={settings.blogNotifications.writerInvitations}
            onCheckedChange={checked => updateBlogNotifications({ writerInvitations: checked })}
            disabled={isUpdating}
          />
        </CardContent>
      </Card>

      {/* Todo Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5" />
            {t('pages.notifications.settingsPage.todos.title')}
          </CardTitle>
          <CardDescription>
            {t('pages.notifications.settingsPage.todos.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          <SettingItem
            label={t('pages.notifications.settingsPage.todos.taskAssigned')}
            description={t('pages.notifications.settingsPage.todos.taskAssignedDesc')}
            checked={settings.todoNotifications.taskAssigned}
            onCheckedChange={checked => updateTodoNotifications({ taskAssigned: checked })}
            disabled={isUpdating}
          />
          <SettingItem
            label={t('pages.notifications.settingsPage.todos.taskUpdated')}
            description={t('pages.notifications.settingsPage.todos.taskUpdatedDesc')}
            checked={settings.todoNotifications.taskUpdated}
            onCheckedChange={checked => updateTodoNotifications({ taskUpdated: checked })}
            disabled={isUpdating}
          />
          <SettingItem
            label={t('pages.notifications.settingsPage.todos.taskCompleted')}
            description={t('pages.notifications.settingsPage.todos.taskCompletedDesc')}
            checked={settings.todoNotifications.taskCompleted}
            onCheckedChange={checked => updateTodoNotifications({ taskCompleted: checked })}
            disabled={isUpdating}
          />
          <SettingItem
            label={t('pages.notifications.settingsPage.todos.dueDateReminders')}
            description={t('pages.notifications.settingsPage.todos.dueDateRemindersDesc')}
            checked={settings.todoNotifications.dueDateReminders}
            onCheckedChange={checked => updateTodoNotifications({ dueDateReminders: checked })}
            disabled={isUpdating}
          />
          <SettingItem
            label={t('pages.notifications.settingsPage.todos.overdueAlerts')}
            description={t('pages.notifications.settingsPage.todos.overdueAlertsDesc')}
            checked={settings.todoNotifications.overdueAlerts}
            onCheckedChange={checked => updateTodoNotifications({ overdueAlerts: checked })}
            disabled={isUpdating}
          />
        </CardContent>
      </Card>

      {/* Social Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5" />
            {t('pages.notifications.settingsPage.social.title')}
          </CardTitle>
          <CardDescription>
            {t('pages.notifications.settingsPage.social.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          <SettingItem
            label={t('pages.notifications.settingsPage.social.newFollowers')}
            description={t('pages.notifications.settingsPage.social.newFollowersDesc')}
            checked={settings.socialNotifications.newFollowers}
            onCheckedChange={checked => updateSocialNotifications({ newFollowers: checked })}
            disabled={isUpdating}
          />
          <SettingItem
            label={t('pages.notifications.settingsPage.social.mentions')}
            description={t('pages.notifications.settingsPage.social.mentionsDesc')}
            checked={settings.socialNotifications.mentions}
            onCheckedChange={checked => updateSocialNotifications({ mentions: checked })}
            disabled={isUpdating}
          />
          <SettingItem
            label={t('pages.notifications.settingsPage.social.directMessages')}
            description={t('pages.notifications.settingsPage.social.directMessagesDesc')}
            checked={settings.socialNotifications.directMessages}
            onCheckedChange={checked => updateSocialNotifications({ directMessages: checked })}
            disabled={isUpdating}
          />
          <SettingItem
            label={t('pages.notifications.settingsPage.social.conversationRequests')}
            description={t('pages.notifications.settingsPage.social.conversationRequestsDesc')}
            checked={settings.socialNotifications.conversationRequests}
            onCheckedChange={checked =>
              updateSocialNotifications({ conversationRequests: checked })
            }
            disabled={isUpdating}
          />
        </CardContent>
      </Card>

      {/* Timeline Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {t('pages.notifications.settingsPage.timeline.title')}
          </CardTitle>
          <CardDescription>
            {t('pages.notifications.settingsPage.timeline.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <SettingItem
            label={t('pages.notifications.settingsPage.timeline.showOnHomepage')}
            description={t('pages.notifications.settingsPage.timeline.showOnHomepageDesc')}
            checked={settings.timelineSettings.showOnHomepage}
            onCheckedChange={checked => updateTimelineSettings({ showOnHomepage: checked })}
            disabled={isUpdating}
          />
          <Separator />
          <div className="flex items-center justify-between space-x-4 py-3">
            <div className="flex-1 space-y-0.5">
              <FormControlLabel className="text-sm font-medium">
                {t('pages.notifications.settingsPage.timeline.refreshFrequency')}
              </FormControlLabel>
              <p className="text-muted-foreground text-xs">
                {t('pages.notifications.settingsPage.timeline.refreshFrequencyDesc')}
              </p>
            </div>
            <FormControlSelect
              value={settings.timelineSettings.refreshFrequency}
              onValueChange={(value: TimelineRefreshFrequency) =>
                updateTimelineSettings({ refreshFrequency: value })
              }
              disabled={isUpdating}
            >
              <FormControlSelectTrigger className="w-40">
                <FormControlSelectValue />
              </FormControlSelectTrigger>
              <FormControlSelectContent>
                <FormControlSelectItem value="realtime">
                  {t('pages.notifications.settingsPage.timeline.realtime')}
                </FormControlSelectItem>
                <FormControlSelectItem value="every5min">
                  {t('pages.notifications.settingsPage.timeline.every5min')}
                </FormControlSelectItem>
                <FormControlSelectItem value="every15min">
                  {t('pages.notifications.settingsPage.timeline.every15min')}
                </FormControlSelectItem>
                <FormControlSelectItem value="manual">
                  {t('pages.notifications.settingsPage.timeline.manualOnly')}
                </FormControlSelectItem>
              </FormControlSelectContent>
            </FormControlSelect>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
