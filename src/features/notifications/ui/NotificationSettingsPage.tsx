'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { Label } from '@/features/shared/ui/ui/label';
import { Switch } from '@/features/shared/ui/ui/switch';
import { Button } from '@/features/shared/ui/ui/button';
import { Tabs, TabsContent, TabsTrigger } from '@/features/shared/ui/ui/tabs';
import { ScrollableTabsList } from '@/features/shared/ui/ui/scrollable-tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/features/shared/ui/ui/select';
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
import { useNotificationSettings } from '../hooks/useNotificationSettings';
import { TimelineRefreshFrequency } from '../types/notification-settings.types';
import { PushNotificationToggle } from '@/features/notifications/ui/push-notification-toggle.tsx';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface NotificationSettingsPageProps {
  userId: string;
}

interface SettingItemProps {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  adminOnly?: boolean;
}

function SettingItem({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  adminOnly,
}: SettingItemProps) {
  return (
    <div className="flex items-center justify-between space-x-4 py-3">
      <div className="flex-1 space-y-0.5">
        <Label className="text-sm font-medium">
          {label}
          {adminOnly && (
            <span className="bg-muted text-muted-foreground ml-2 rounded-full px-2 py-0.5 text-xs">
              {translateText('generated.inline.0804_admin_only_da21f2ed')}
            </span>
          )}
        </Label>
        {description && <p className="text-muted-foreground text-xs">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}

export function NotificationSettingsPage({ userId }: NotificationSettingsPageProps) {
  const {
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
    resetToDefaults,
  } = useNotificationSettings(userId);

  const [resetting, setResetting] = useState(false);

  const handleReset = async () => {
    setResetting(true);
    await resetToDefaults();
    setResetting(false);
  };

  if (isLoading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {translateText('generated.inline.0805_notification_settings_e0a9fb92')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {translateText(
              'generated.inline.0806_manage_how_you_receive_notifications_for_diff_d8da58b7'
            )}
          </p>
        </div>
        <Button variant="outline" onClick={handleReset} disabled={resetting || isUpdating}>
          {resetting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="mr-2 h-4 w-4" />
          )}
          {translateText('generated.inline.0807_reset_to_defaults_ddefe47d')}
        </Button>
      </div>

      <Tabs defaultValue="delivery" className="w-full">
        <ScrollableTabsList className="mb-6">
          <TabsTrigger value="delivery" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            {translateText('generated.inline.0808_delivery_9631af52')}
          </TabsTrigger>
          <TabsTrigger value="groups" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {translateText('generated.inline.0611_groups_ae9629f4')}
          </TabsTrigger>
          <TabsTrigger value="events" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {translateText('generated.inline.0605_events_c5497bca')}
          </TabsTrigger>
          <TabsTrigger value="amendments" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {translateText('generated.inline.0809_amendments_90086687')}
          </TabsTrigger>
          <TabsTrigger value="blogs" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            {translateText('generated.inline.0300_blogs_5ef44397')}
          </TabsTrigger>
          <TabsTrigger value="todos" className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4" />
            {translateText('generated.inline.0733_todos_a4114a83')}
          </TabsTrigger>
          <TabsTrigger value="social" className="flex items-center gap-2">
            <Heart className="h-4 w-4" />
            {translateText('generated.inline.0810_social_41a57508')}
          </TabsTrigger>
          <TabsTrigger value="timeline" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {translateText('generated.inline.0811_timeline_018514a3')}
          </TabsTrigger>
        </ScrollableTabsList>

        {/* Delivery Settings */}
        <TabsContent value="delivery">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                {translateText('generated.inline.0812_delivery_settings_259efcfa')}
              </CardTitle>
              <CardDescription>
                {translateText(
                  'generated.inline.0813_control_how_notifications_are_delivered_to_yo_9dedf987'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between space-x-4 py-3">
                <div className="flex-1 space-y-0.5">
                  <Label className="text-sm font-medium">
                    {translateText('generated.inline.0814_push_notifications_b8fe58ff')}
                  </Label>
                  <p className="text-muted-foreground text-xs">
                    {translateText(
                      'generated.inline.0815_receive_browser_push_notifications_even_when__28e15171'
                    )}
                  </p>
                </div>
                <PushNotificationToggle variant="minimal" />
              </div>
              <Separator />
              <SettingItem
                label={translateText('generated.inline.0816_in_app_notifications_d8bf4e09')}
                description={translateText(
                  'generated.inline.0817_show_notifications_within_the_app_306714f6'
                )}
                checked={settings.deliverySettings.inAppNotifications}
                onCheckedChange={checked => updateDeliverySettings({ inAppNotifications: checked })}
                disabled={isUpdating}
              />
              <Separator />
              <SettingItem
                label={translateText('generated.inline.0818_email_notifications_12811307')}
                description={translateText(
                  'generated.inline.0819_receive_notification_digests_via_email_coming_62975129'
                )}
                checked={settings.deliverySettings.emailNotifications}
                onCheckedChange={checked => updateDeliverySettings({ emailNotifications: checked })}
                disabled={true} // Email not yet implemented
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Group Notifications */}
        <TabsContent value="groups">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {translateText('generated.inline.0820_group_notifications_90800fc3')}
              </CardTitle>
              <CardDescription>
                {translateText(
                  'generated.inline.0821_notifications_for_groups_you_re_a_member_of_78d00dbe'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="divide-y">
              <SettingItem
                label={translateText('generated.inline.0822_tasks_assigned_3a2dc9de')}
                description={translateText(
                  'generated.inline.0823_when_a_task_is_assigned_to_you_in_a_group_226fbb49'
                )}
                checked={settings.groupNotifications.tasksAssigned}
                onCheckedChange={checked => updateGroupNotifications({ tasksAssigned: checked })}
                disabled={isUpdating}
              />
              <SettingItem
                label={translateText('generated.inline.0824_payment_notifications_deb0db12')}
                description={translateText(
                  'generated.inline.0825_payment_related_updates_24883e7c'
                )}
                checked={settings.groupNotifications.paymentNotifications}
                onCheckedChange={checked =>
                  updateGroupNotifications({ paymentNotifications: checked })
                }
                disabled={isUpdating}
              />
              <SettingItem
                label={translateText('generated.inline.0826_new_events_9d40e7f9')}
                description={translateText(
                  'generated.inline.0827_when_new_events_are_created_in_the_group_d7a87ce9'
                )}
                checked={settings.groupNotifications.newEvents}
                onCheckedChange={checked => updateGroupNotifications({ newEvents: checked })}
                disabled={isUpdating}
              />
              <SettingItem
                label={translateText('generated.inline.0828_new_amendments_588af3bb')}
                description={translateText(
                  'generated.inline.0829_when_new_amendments_are_linked_to_the_group_5cedeb3a'
                )}
                checked={settings.groupNotifications.newAmendments}
                onCheckedChange={checked => updateGroupNotifications({ newAmendments: checked })}
                disabled={isUpdating}
              />
              <SettingItem
                label={translateText('generated.inline.0830_new_relationships_41910da3')}
                description={translateText(
                  'generated.inline.0831_when_parent_child_group_relationships_are_for_5ed4a115'
                )}
                checked={settings.groupNotifications.newRelationships}
                onCheckedChange={checked => updateGroupNotifications({ newRelationships: checked })}
                disabled={isUpdating}
              />
              <SettingItem
                label={translateText('generated.inline.0832_new_roles_2495f23f')}
                description={translateText(
                  'generated.inline.0833_when_new_roles_are_created_64e8e34d'
                )}
                checked={settings.groupNotifications.newRoles}
                onCheckedChange={checked => updateGroupNotifications({ newRoles: checked })}
                disabled={isUpdating}
              />
              <SettingItem
                label={translateText('generated.inline.0834_new_documents_f40d3f79')}
                description={translateText(
                  'generated.inline.0835_when_documents_are_shared_31e98073'
                )}
                checked={settings.groupNotifications.newDocuments}
                onCheckedChange={checked => updateGroupNotifications({ newDocuments: checked })}
                disabled={isUpdating}
              />
              <SettingItem
                label={translateText('generated.inline.0836_new_members_32742f55')}
                description={translateText('generated.inline.0837_when_new_members_join_61b9dc44')}
                checked={settings.groupNotifications.newMembers}
                onCheckedChange={checked => updateGroupNotifications({ newMembers: checked })}
                disabled={isUpdating}
                adminOnly
              />
              <SettingItem
                label={translateText('generated.inline.0838_role_updates_9db1af1f')}
                description={translateText(
                  'generated.inline.0839_when_roles_are_promoted_or_demoted_5b1b1908'
                )}
                checked={settings.groupNotifications.roleUpdates}
                onCheckedChange={checked => updateGroupNotifications({ roleUpdates: checked })}
                disabled={isUpdating}
              />
              <SettingItem
                label={translateText('generated.inline.0840_new_subscribers_e1ff135b')}
                description={translateText(
                  'generated.inline.0841_when_users_subscribe_to_the_group_6c5b2406'
                )}
                checked={settings.groupNotifications.newSubscribers}
                onCheckedChange={checked => updateGroupNotifications({ newSubscribers: checked })}
                disabled={isUpdating}
                adminOnly
              />
              <SettingItem
                label={translateText('generated.inline.0842_profile_updates_4177b0a1')}
                description={translateText(
                  'generated.inline.0843_when_group_details_are_updated_4860dac6'
                )}
                checked={settings.groupNotifications.profileUpdates}
                onCheckedChange={checked => updateGroupNotifications({ profileUpdates: checked })}
                disabled={isUpdating}
              />
              <SettingItem
                label={translateText('generated.inline.0844_membership_requests_2e174c99')}
                description={translateText(
                  'generated.inline.0845_when_users_request_to_join_e6622f32'
                )}
                checked={settings.groupNotifications.membershipRequests}
                onCheckedChange={checked =>
                  updateGroupNotifications({ membershipRequests: checked })
                }
                disabled={isUpdating}
                adminOnly
              />
              <SettingItem
                label={translateText('generated.inline.0846_membership_invitations_a407bc71')}
                description={translateText(
                  'generated.inline.0847_when_you_re_invited_to_join_75d42df2'
                )}
                checked={settings.groupNotifications.membershipInvitations}
                onCheckedChange={checked =>
                  updateGroupNotifications({ membershipInvitations: checked })
                }
                disabled={isUpdating}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Event Notifications */}
        <TabsContent value="events">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {translateText('generated.inline.0848_event_notifications_4b39a92b')}
              </CardTitle>
              <CardDescription>
                {translateText(
                  'generated.inline.0849_notifications_for_events_you_re_participating_3376b695'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="divide-y">
              <SettingItem
                label={translateText('generated.inline.0850_agenda_items_6abfe1af')}
                description={translateText(
                  'generated.inline.0851_when_agenda_items_are_added_or_changed_2296f662'
                )}
                checked={settings.eventNotifications.agendaItems}
                onCheckedChange={checked => updateEventNotifications({ agendaItems: checked })}
                disabled={isUpdating}
              />
              <SettingItem
                label={translateText('generated.inline.0852_elections_7213288b')}
                description={translateText(
                  'generated.inline.0853_election_events_and_results_2220b176'
                )}
                checked={settings.eventNotifications.elections}
                onCheckedChange={checked => updateEventNotifications({ elections: checked })}
                disabled={isUpdating}
              />
              <SettingItem
                label={translateText('generated.inline.0854_votes_b66c4b27')}
                description={translateText(
                  'generated.inline.0855_voting_sessions_and_results_a73924f1'
                )}
                checked={settings.eventNotifications.votes}
                onCheckedChange={checked => updateEventNotifications({ votes: checked })}
                disabled={isUpdating}
              />
              <SettingItem
                label={translateText('generated.inline.0856_schedule_changes_64e73d47')}
                description={translateText(
                  'generated.inline.0857_when_event_date_or_time_changes_41e87bc5'
                )}
                checked={settings.eventNotifications.scheduleChanges}
                onCheckedChange={checked => updateEventNotifications({ scheduleChanges: checked })}
                disabled={isUpdating}
              />
              <SettingItem
                label={translateText('generated.inline.0858_new_participants_9c6afc9b')}
                description={translateText(
                  'generated.inline.0859_when_new_participants_join_332b797a'
                )}
                checked={settings.eventNotifications.newParticipants}
                onCheckedChange={checked => updateEventNotifications({ newParticipants: checked })}
                disabled={isUpdating}
                adminOnly
              />
              <SettingItem
                label={translateText('generated.inline.0838_role_updates_9db1af1f')}
                description={translateText(
                  'generated.inline.0860_when_participant_roles_change_38e83ff8'
                )}
                checked={settings.eventNotifications.roleUpdates}
                onCheckedChange={checked => updateEventNotifications({ roleUpdates: checked })}
                disabled={isUpdating}
              />
              <SettingItem
                label={translateText('generated.inline.0861_role_changes_bcb8987f')}
                description={translateText(
                  'generated.inline.0862_when_roles_are_filled_or_vacated_cbaae9b7'
                )}
                checked={settings.eventNotifications.roleChanges}
                onCheckedChange={checked => updateEventNotifications({ roleChanges: checked })}
                disabled={isUpdating}
              />
              <SettingItem
                label={translateText('generated.inline.0842_profile_updates_4177b0a1')}
                description={translateText(
                  'generated.inline.0863_when_event_details_are_updated_73fef40d'
                )}
                checked={settings.eventNotifications.profileUpdates}
                onCheckedChange={checked => updateEventNotifications({ profileUpdates: checked })}
                disabled={isUpdating}
              />
              <SettingItem
                label={translateText('generated.inline.0840_new_subscribers_e1ff135b')}
                description={translateText(
                  'generated.inline.0864_when_users_subscribe_to_the_event_b795ecdc'
                )}
                checked={settings.eventNotifications.newSubscribers}
                onCheckedChange={checked => updateEventNotifications({ newSubscribers: checked })}
                disabled={isUpdating}
                adminOnly
              />
              <SettingItem
                label={translateText('generated.inline.0865_participation_requests_8ab2ea2e')}
                description={translateText(
                  'generated.inline.0866_when_users_request_to_participate_b25dbfcf'
                )}
                checked={settings.eventNotifications.participationRequests}
                onCheckedChange={checked =>
                  updateEventNotifications({ participationRequests: checked })
                }
                disabled={isUpdating}
                adminOnly
              />
              <SettingItem
                label={translateText('generated.inline.0867_participation_invitations_cf502cba')}
                description={translateText(
                  'generated.inline.0868_when_you_re_invited_to_participate_ef2715a0'
                )}
                checked={settings.eventNotifications.participationInvitations}
                onCheckedChange={checked =>
                  updateEventNotifications({ participationInvitations: checked })
                }
                disabled={isUpdating}
              />
              <SettingItem
                label={translateText('generated.inline.0869_delegate_nominations_16799094')}
                description={translateText(
                  'generated.inline.0870_delegate_nomination_events_d7ea449b'
                )}
                checked={settings.eventNotifications.delegateNominations}
                onCheckedChange={checked =>
                  updateEventNotifications({ delegateNominations: checked })
                }
                disabled={isUpdating}
              />
              <SettingItem
                label={translateText('generated.inline.0871_speaker_list_additions_36886dbd')}
                description={translateText(
                  'generated.inline.0872_when_you_re_added_to_speaker_list_9d4d08c6'
                )}
                checked={settings.eventNotifications.speakerListAdditions}
                onCheckedChange={checked =>
                  updateEventNotifications({ speakerListAdditions: checked })
                }
                disabled={isUpdating}
              />
              <SettingItem
                label={translateText('generated.inline.0873_meeting_bookings_93dc043a')}
                description={translateText('generated.inline.0874_meeting_slot_bookings_491d9151')}
                checked={settings.eventNotifications.meetingBookings}
                onCheckedChange={checked => updateEventNotifications({ meetingBookings: checked })}
                disabled={isUpdating}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Amendment Notifications */}
        <TabsContent value="amendments">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {translateText('generated.inline.0875_amendment_notifications_1a613549')}
              </CardTitle>
              <CardDescription>
                {translateText(
                  'generated.inline.0876_notifications_for_amendments_you_re_collabora_6a0452af'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="divide-y">
              <SettingItem
                label={translateText('generated.inline.0285_change_requests_af9a9fa4')}
                description={translateText(
                  'generated.inline.0877_when_change_requests_are_created_0d9fe1e2'
                )}
                checked={settings.amendmentNotifications.changeRequests}
                onCheckedChange={checked =>
                  updateAmendmentNotifications({ changeRequests: checked })
                }
                disabled={isUpdating}
              />
              <SettingItem
                label={translateText('generated.inline.0878_change_request_decisions_8a33f028')}
                description={translateText(
                  'generated.inline.0879_when_change_requests_are_accepted_or_rejected_4aabc583'
                )}
                checked={settings.amendmentNotifications.changeRequestDecisions}
                onCheckedChange={checked =>
                  updateAmendmentNotifications({ changeRequestDecisions: checked })
                }
                disabled={isUpdating}
              />
              <SettingItem
                label={translateText('generated.inline.0880_new_collaborators_cd6011b3')}
                description={translateText(
                  'generated.inline.0881_when_collaborators_join_8918df62'
                )}
                checked={settings.amendmentNotifications.newCollaborators}
                onCheckedChange={checked =>
                  updateAmendmentNotifications({ newCollaborators: checked })
                }
                disabled={isUpdating}
                adminOnly
              />
              <SettingItem
                label={translateText('generated.inline.0838_role_updates_9db1af1f')}
                description={translateText(
                  'generated.inline.0882_when_collaborator_roles_change_8c2bb906'
                )}
                checked={settings.amendmentNotifications.roleUpdates}
                onCheckedChange={checked => updateAmendmentNotifications({ roleUpdates: checked })}
                disabled={isUpdating}
              />
              <SettingItem
                label="Upvotes/Downvotes"
                description={translateText(
                  'generated.inline.0883_when_your_amendment_receives_votes_f1e77bea'
                )}
                checked={settings.amendmentNotifications.upvotesDownvotes}
                onCheckedChange={checked =>
                  updateAmendmentNotifications({ upvotesDownvotes: checked })
                }
                disabled={isUpdating}
                adminOnly
              />
              <SettingItem
                label={translateText('generated.inline.0840_new_subscribers_e1ff135b')}
                description={translateText(
                  'generated.inline.0884_when_users_subscribe_to_the_amendment_c5ce70aa'
                )}
                checked={settings.amendmentNotifications.newSubscribers}
                onCheckedChange={checked =>
                  updateAmendmentNotifications({ newSubscribers: checked })
                }
                disabled={isUpdating}
                adminOnly
              />
              <SettingItem
                label={translateText('generated.inline.0885_process_progress_bc67cd64')}
                description={translateText(
                  'generated.inline.0886_when_the_amendment_advances_through_governanc_f24a82da'
                )}
                checked={settings.amendmentNotifications.processProgress}
                onCheckedChange={checked =>
                  updateAmendmentNotifications({ processProgress: checked })
                }
                disabled={isUpdating}
              />
              <SettingItem
                label={translateText('generated.inline.0887_supporting_groups_cf7fea68')}
                description={translateText(
                  'generated.inline.0888_when_groups_add_support_bc7a12be'
                )}
                checked={settings.amendmentNotifications.supportingGroups}
                onCheckedChange={checked =>
                  updateAmendmentNotifications({ supportingGroups: checked })
                }
                disabled={isUpdating}
              />
              <SettingItem
                label={translateText('generated.inline.0889_clones_7a5a99d8')}
                description={translateText(
                  'generated.inline.0890_when_your_amendment_is_cloned_1a876145'
                )}
                checked={settings.amendmentNotifications.clones}
                onCheckedChange={checked => updateAmendmentNotifications({ clones: checked })}
                disabled={isUpdating}
              />
              <SettingItem
                label={translateText('generated.inline.0387_discussions_0474a6c6')}
                description={translateText(
                  'generated.inline.0891_comments_and_discussion_threads_838b6ff1'
                )}
                checked={settings.amendmentNotifications.discussions}
                onCheckedChange={checked => updateAmendmentNotifications({ discussions: checked })}
                disabled={isUpdating}
              />
              <SettingItem
                label={translateText('generated.inline.0842_profile_updates_4177b0a1')}
                description={translateText(
                  'generated.inline.0892_when_amendment_details_change_b53e9a7d'
                )}
                checked={settings.amendmentNotifications.profileUpdates}
                onCheckedChange={checked =>
                  updateAmendmentNotifications({ profileUpdates: checked })
                }
                disabled={isUpdating}
              />
              <SettingItem
                label={translateText('generated.inline.0893_workflow_changes_2a0b380d')}
                description={translateText(
                  'generated.inline.0894_when_workflow_status_changes_1c30bb6a'
                )}
                checked={settings.amendmentNotifications.workflowChanges}
                onCheckedChange={checked =>
                  updateAmendmentNotifications({ workflowChanges: checked })
                }
                disabled={isUpdating}
              />
              <SettingItem
                label={translateText('generated.inline.0895_collaboration_requests_532afcf3')}
                description={translateText(
                  'generated.inline.0896_when_users_request_to_collaborate_5b6ad65e'
                )}
                checked={settings.amendmentNotifications.collaborationRequests}
                onCheckedChange={checked =>
                  updateAmendmentNotifications({ collaborationRequests: checked })
                }
                disabled={isUpdating}
                adminOnly
              />
              <SettingItem
                label={translateText('generated.inline.0897_collaboration_invitations_7fe3c15d')}
                description={translateText(
                  'generated.inline.0898_when_you_re_invited_to_collaborate_24a9f3b3'
                )}
                checked={settings.amendmentNotifications.collaborationInvitations}
                onCheckedChange={checked =>
                  updateAmendmentNotifications({ collaborationInvitations: checked })
                }
                disabled={isUpdating}
              />
              <SettingItem
                label={translateText('generated.inline.0899_voting_sessions_56b3baec')}
                description={translateText('generated.inline.0900_voting_session_events_15130392')}
                checked={settings.amendmentNotifications.votingSessions}
                onCheckedChange={checked =>
                  updateAmendmentNotifications({ votingSessions: checked })
                }
                disabled={isUpdating}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Blog Notifications */}
        <TabsContent value="blogs">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                {translateText('generated.inline.0901_blog_notifications_7251115e')}
              </CardTitle>
              <CardDescription>
                {translateText(
                  'generated.inline.0902_notifications_for_blogs_you_re_writing_for_b616ab45'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="divide-y">
              <SettingItem
                label={translateText('generated.inline.0840_new_subscribers_e1ff135b')}
                description={translateText(
                  'generated.inline.0903_when_users_subscribe_to_the_blog_dbe90d09'
                )}
                checked={settings.blogNotifications.newSubscribers}
                onCheckedChange={checked => updateBlogNotifications({ newSubscribers: checked })}
                disabled={isUpdating}
                adminOnly
              />
              <SettingItem
                label="Upvotes/Downvotes"
                description={translateText(
                  'generated.inline.0904_when_your_posts_receive_votes_ba917e74'
                )}
                checked={settings.blogNotifications.upvotesDownvotes}
                onCheckedChange={checked => updateBlogNotifications({ upvotesDownvotes: checked })}
                disabled={isUpdating}
                adminOnly
              />
              <SettingItem
                label={translateText('generated.inline.0842_profile_updates_4177b0a1')}
                description={translateText(
                  'generated.inline.0905_when_blog_details_change_6ba42528'
                )}
                checked={settings.blogNotifications.profileUpdates}
                onCheckedChange={checked => updateBlogNotifications({ profileUpdates: checked })}
                disabled={isUpdating}
              />
              <SettingItem
                label={translateText('generated.inline.0906_new_writers_d070c860')}
                description={translateText('generated.inline.0907_when_new_writers_join_3c54f67c')}
                checked={settings.blogNotifications.newWriters}
                onCheckedChange={checked => updateBlogNotifications({ newWriters: checked })}
                disabled={isUpdating}
                adminOnly
              />
              <SettingItem
                label={translateText('generated.inline.0838_role_updates_9db1af1f')}
                description={translateText(
                  'generated.inline.0908_when_writer_roles_change_0c66a060'
                )}
                checked={settings.blogNotifications.roleUpdates}
                onCheckedChange={checked => updateBlogNotifications({ roleUpdates: checked })}
                disabled={isUpdating}
              />
              <SettingItem
                label={translateText('generated.inline.0909_comments_fce06e20')}
                description={translateText('generated.inline.0910_comments_on_blog_posts_0326d1c4')}
                checked={settings.blogNotifications.comments}
                onCheckedChange={checked => updateBlogNotifications({ comments: checked })}
                disabled={isUpdating}
              />
              <SettingItem
                label={translateText('generated.inline.0911_writer_requests_34302dca')}
                description={translateText(
                  'generated.inline.0912_when_users_request_to_write_cd06ca5d'
                )}
                checked={settings.blogNotifications.writerRequests}
                onCheckedChange={checked => updateBlogNotifications({ writerRequests: checked })}
                disabled={isUpdating}
                adminOnly
              />
              <SettingItem
                label={translateText('generated.inline.0913_writer_invitations_3c61e2ad')}
                description={translateText(
                  'generated.inline.0914_when_you_re_invited_to_write_895172f1'
                )}
                checked={settings.blogNotifications.writerInvitations}
                onCheckedChange={checked => updateBlogNotifications({ writerInvitations: checked })}
                disabled={isUpdating}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Todo Notifications */}
        <TabsContent value="todos">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckSquare className="h-5 w-5" />
                {translateText('generated.inline.0915_todo_notifications_88889acd')}
              </CardTitle>
              <CardDescription>
                {translateText(
                  'generated.inline.0916_notifications_for_your_tasks_and_assignments_9fc45b40'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="divide-y">
              <SettingItem
                label={translateText('generated.inline.0917_task_assigned_e55fb748')}
                description={translateText(
                  'generated.inline.0918_when_a_task_is_assigned_to_you_7fa51c55'
                )}
                checked={settings.todoNotifications.taskAssigned}
                onCheckedChange={checked => updateTodoNotifications({ taskAssigned: checked })}
                disabled={isUpdating}
              />
              <SettingItem
                label={translateText('generated.inline.0919_task_updated_1da9a8df')}
                description={translateText(
                  'generated.inline.0920_when_task_details_change_5b1ccd8e'
                )}
                checked={settings.todoNotifications.taskUpdated}
                onCheckedChange={checked => updateTodoNotifications({ taskUpdated: checked })}
                disabled={isUpdating}
              />
              <SettingItem
                label={translateText('generated.inline.0921_task_completed_3ce609d4')}
                description={translateText(
                  'generated.inline.0922_when_tasks_you_created_are_completed_e2282c64'
                )}
                checked={settings.todoNotifications.taskCompleted}
                onCheckedChange={checked => updateTodoNotifications({ taskCompleted: checked })}
                disabled={isUpdating}
              />
              <SettingItem
                label={translateText('generated.inline.0923_due_date_reminders_767cde77')}
                description={translateText(
                  'generated.inline.0924_reminders_before_tasks_are_due_6f6d591c'
                )}
                checked={settings.todoNotifications.dueDateReminders}
                onCheckedChange={checked => updateTodoNotifications({ dueDateReminders: checked })}
                disabled={isUpdating}
              />
              <SettingItem
                label={translateText('generated.inline.0925_overdue_alerts_5587e23e')}
                description={translateText(
                  'generated.inline.0926_alerts_when_tasks_are_overdue_edf3195c'
                )}
                checked={settings.todoNotifications.overdueAlerts}
                onCheckedChange={checked => updateTodoNotifications({ overdueAlerts: checked })}
                disabled={isUpdating}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Social Notifications */}
        <TabsContent value="social">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5" />
                {translateText('generated.inline.0927_social_notifications_73cbde12')}
              </CardTitle>
              <CardDescription>
                {translateText(
                  'generated.inline.0928_notifications_for_social_interactions_7e0430d9'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="divide-y">
              <SettingItem
                label={translateText('generated.inline.0929_new_followers_1324e4ec')}
                description={translateText(
                  'generated.inline.0930_when_someone_follows_you_a0cf8c42'
                )}
                checked={settings.socialNotifications.newFollowers}
                onCheckedChange={checked => updateSocialNotifications({ newFollowers: checked })}
                disabled={isUpdating}
              />
              <SettingItem
                label={translateText('generated.inline.0931_mentions_85e12bc6')}
                description={translateText(
                  'generated.inline.0932_when_you_re_mentioned_in_content_a7ed88df'
                )}
                checked={settings.socialNotifications.mentions}
                onCheckedChange={checked => updateSocialNotifications({ mentions: checked })}
                disabled={isUpdating}
              />
              <SettingItem
                label={translateText('generated.inline.0933_direct_messages_f1b1f5c2')}
                description={translateText('generated.inline.0934_new_direct_messages_5e58c172')}
                checked={settings.socialNotifications.directMessages}
                onCheckedChange={checked => updateSocialNotifications({ directMessages: checked })}
                disabled={isUpdating}
              />
              <SettingItem
                label={translateText('generated.inline.0935_conversation_requests_0a10be26')}
                description={translateText(
                  'generated.inline.0936_when_someone_wants_to_start_a_conversation_fcf67e82'
                )}
                checked={settings.socialNotifications.conversationRequests}
                onCheckedChange={checked =>
                  updateSocialNotifications({ conversationRequests: checked })
                }
                disabled={isUpdating}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timeline Settings */}
        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                {translateText('generated.inline.0937_timeline_settings_b92fbc1e')}
              </CardTitle>
              <CardDescription>
                {translateText(
                  'generated.inline.0938_configure_your_timeline_feed_preferences_9a22cd1d'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <SettingItem
                label={translateText('generated.inline.0939_show_timeline_on_homepage_5f55bbdb')}
                description={translateText(
                  'generated.inline.0940_display_your_subscribed_content_feed_on_the_h_b7a5c53f'
                )}
                checked={settings.timelineSettings.showOnHomepage}
                onCheckedChange={checked => updateTimelineSettings({ showOnHomepage: checked })}
                disabled={isUpdating}
              />
              <Separator />
              <div className="flex items-center justify-between space-x-4 py-3">
                <div className="flex-1 space-y-0.5">
                  <Label className="text-sm font-medium">
                    {translateText('generated.inline.0941_refresh_frequency_23798dc4')}
                  </Label>
                  <p className="text-muted-foreground text-xs">
                    {translateText(
                      'generated.inline.0942_how_often_the_timeline_automatically_refreshe_52ada5c8'
                    )}
                  </p>
                </div>
                <Select
                  value={settings.timelineSettings.refreshFrequency}
                  onValueChange={(value: TimelineRefreshFrequency) =>
                    updateTimelineSettings({ refreshFrequency: value })
                  }
                  disabled={isUpdating}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="realtime">
                      {translateText('generated.inline.0943_real_time_cc635525')}
                    </SelectItem>
                    <SelectItem value="every5min">
                      {translateText('generated.inline.0944_every_5_minutes_d4f3e0d1')}
                    </SelectItem>
                    <SelectItem value="every15min">
                      {translateText('generated.inline.0945_every_15_minutes_c7bafbc9')}
                    </SelectItem>
                    <SelectItem value="manual">
                      {translateText('generated.inline.0946_manual_only_aaf64b3f')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
