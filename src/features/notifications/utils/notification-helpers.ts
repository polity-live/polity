/**
 * Notification Helper Functions
 *
 * Utilities for creating notifications on behalf of entities
 * and sending notifications to entity recipients.
 *
 * On the client, uses a Zero mutator dispatch set via setNotificationDispatch().
 * On the server (server-notify.ts), falls back to Supabase with service_role.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { shouldDispatchNotification } from '@/features/notifications/logic/notificationTypeSettingMap';
import type { NotificationSettings } from '@/features/notifications/types/notification-settings.types';
import type { NotificationType } from '@/features/notifications/types/notification.types';

// ── Dispatch pattern ─────────────────────────────────────────────────────────
// On the client, a Zero-backed dispatch is injected at app startup.
// On the server, we fall back to Supabase with the service_role key.

export interface CreateNotificationInput {
  id: string;
  recipient_id: string | null;
  sender_id: string | null;
  title: string | null;
  message: string | null;
  type: string | null;
  action_url: string | null;
  is_read: boolean;
  related_entity_type: string | null;
  on_behalf_of_entity_type: string | null;
  on_behalf_of_entity_id: string | null;
  recipient_entity_type: string | null;
  recipient_entity_id: string | null;
  related_user_id: string | null;
  related_group_id: string | null;
  related_amendment_id: string | null;
  related_event_id: string | null;
  related_blog_id: string | null;
  on_behalf_of_group_id: string | null;
  on_behalf_of_event_id: string | null;
  on_behalf_of_amendment_id: string | null;
  on_behalf_of_blog_id: string | null;
  recipient_group_id: string | null;
  recipient_event_id: string | null;
  recipient_amendment_id: string | null;
  recipient_blog_id: string | null;
  category: string | null;
}

type NotificationDispatchFn = (args: CreateNotificationInput) => Promise<void>;

let _clientDispatch: NotificationDispatchFn | null = null;

/**
 * Set the dispatch function used to create notifications.
 * Called once from useNotificationDispatch() at app startup.
 */
export function setNotificationDispatch(fn: NotificationDispatchFn | null): void {
  _clientDispatch = fn;
}

// ── Server-side Supabase fallback ────────────────────────────────────────────
// Used when _clientDispatch is null (i.e. on the server in server-notify.ts).

let _supabase: SupabaseClient | null = null;
function getServerSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for server-side notifications'
      );
    }
    _supabase = createClient(url, key);
  }
  return _supabase;
}

export type EntityType = 'group' | 'event' | 'amendment' | 'blog' | 'user';

export interface NotificationConfig {
  // Sender information
  senderId: string; // The user performing the action

  // Recipient information (either user or entity)
  recipientUserId?: string;
  recipientEntityType?: EntityType;
  recipientEntityId?: string;

  // Entity on behalf of which notification is sent
  onBehalfOfEntityType?: EntityType;
  onBehalfOfEntityId?: string;

  // Notification content
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;

  // Related entities for navigation
  relatedEntityType?: string;
  relatedGroupId?: string;
  relatedEventId?: string;
  relatedAmendmentId?: string;
  relatedBlogId?: string;
  relatedUserId?: string;
}

/**
 * Maps a camelCase NotificationConfig to snake_case CreateNotificationInput.
 */
function mapConfigToInput(
  config: NotificationConfig,
  notificationId: string
): CreateNotificationInput {
  const input: CreateNotificationInput = {
    id: notificationId,
    type: config.type,
    title: config.title,
    message: config.message,
    action_url: config.actionUrl ?? null,
    is_read: false,
    related_entity_type: config.relatedEntityType ?? null,
    sender_id: config.senderId,
    recipient_id: config.recipientUserId ?? null,
    on_behalf_of_entity_type: config.onBehalfOfEntityType ?? null,
    on_behalf_of_entity_id: config.onBehalfOfEntityId ?? null,
    recipient_entity_type: config.recipientEntityType ?? null,
    recipient_entity_id: config.recipientEntityId ?? null,
    related_user_id: config.relatedUserId ?? null,
    related_group_id: config.relatedGroupId ?? null,
    related_amendment_id: config.relatedAmendmentId ?? null,
    related_event_id: config.relatedEventId ?? null,
    related_blog_id: config.relatedBlogId ?? null,
    on_behalf_of_group_id: null,
    on_behalf_of_event_id: null,
    on_behalf_of_amendment_id: null,
    on_behalf_of_blog_id: null,
    recipient_group_id: null,
    recipient_event_id: null,
    recipient_amendment_id: null,
    recipient_blog_id: null,
    category: null,
  };

  // Map onBehalfOf entity to specific FK columns
  if (config.onBehalfOfEntityType && config.onBehalfOfEntityId) {
    const entityType = config.onBehalfOfEntityType as 'group' | 'event' | 'amendment' | 'blog';
    const keyMap = {
      group: 'on_behalf_of_group_id',
      event: 'on_behalf_of_event_id',
      amendment: 'on_behalf_of_amendment_id',
      blog: 'on_behalf_of_blog_id',
    } as const;
    if (keyMap[entityType]) {
      input[keyMap[entityType]] = config.onBehalfOfEntityId;
    }
  }

  // Map recipient entity to specific FK columns
  if (config.recipientEntityType && config.recipientEntityId) {
    const entityType = config.recipientEntityType as 'group' | 'event' | 'amendment' | 'blog';
    const keyMap = {
      group: 'recipient_group_id',
      event: 'recipient_event_id',
      amendment: 'recipient_amendment_id',
      blog: 'recipient_blog_id',
    } as const;
    if (keyMap[entityType]) {
      input[keyMap[entityType]] = config.recipientEntityId;
    }
  }

  return input;
}

const SELF_PERSONAL_COPY_TYPES = new Set<NotificationType>([
  'membership_request',
  'membership_withdrawn',
  'group_request_withdrawn',
  'group_invitation_accepted',
  'group_invitation_declined',
  'participation_request',
  'participation_withdrawn',
  'event_request_withdrawn',
  'event_invitation_accepted',
  'event_invitation_declined',
  'collaboration_request',
  'collaboration_withdrawn',
  'collaboration_request_withdrawn',
  'collaboration_invitation_accepted',
  'collaboration_invitation_declined',
  'blog_writer_request',
  'blog_writer_left',
  'blog_request_withdrawn',
  'blog_invitation_accepted',
  'blog_invitation_declined',
]);

function replaceActorNameWithYou(message: string, actorName: string): string {
  const escapedName = actorName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return message
    .replace(new RegExp(`^${escapedName}\\b`), 'You')
    .replace(/^You has\b/, 'You have')
    .replace(/^You wants\b/, 'You want')
    .replace(/^You is\b/, 'You are')
    .replace(/^You was\b/, 'You were');
}

async function getRecipientNotificationSettings(
  userId: string
): Promise<NotificationSettings | null> {
  const { data, error } = await getServerSupabase()
    .from('notification_setting')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[Notification] Failed to load recipient notification settings:', error);
    return null;
  }

  return (data as NotificationSettings | null) ?? null;
}

async function personalizeNotificationConfig(
  config: NotificationConfig
): Promise<NotificationConfig> {
  if (!config.recipientUserId || config.recipientUserId !== config.senderId) {
    return config;
  }

  const { data: sender, error } = await getServerSupabase()
    .from('user')
    .select('first_name, last_name, email')
    .eq('id', config.senderId)
    .maybeSingle();

  if (error) {
    console.error('[Notification] Failed to load sender for personalization:', error);
    return config;
  }

  const actorName =
    [sender?.first_name, sender?.last_name].filter(Boolean).join(' ') || sender?.email || null;
  if (!actorName) {
    return config;
  }

  return {
    ...config,
    message: replaceActorNameWithYou(config.message, actorName),
  };
}

async function insertServerNotification(config: NotificationConfig, notificationId: string) {
  if (config.recipientUserId) {
    const settings = await getRecipientNotificationSettings(config.recipientUserId);
    if (!shouldDispatchNotification(config.type, settings)) {
      return false;
    }
  }

  const personalizedConfig = await personalizeNotificationConfig(config);
  const input = mapConfigToInput(personalizedConfig, notificationId);
  const { error } = await getServerSupabase().from('notification').insert(input);

  if (error) {
    console.error('[Notification] Failed to create notification:', error);
    return false;
  }

  return true;
}

/**
 * Creates a notification.
 *
 * On the client (dispatch configured), inserts via Zero mutator.
 * On the server (no dispatch), inserts via Supabase service_role.
 */
export async function createNotification(config: NotificationConfig): Promise<string> {
  const notificationId = crypto.randomUUID();
  const input = mapConfigToInput(config, notificationId);

  if (_clientDispatch) {
    // ── Client-side: insert via Zero mutator ──────────────────────────
    try {
      await _clientDispatch(input);
    } catch (err) {
      console.error('[Notification] Failed to create notification:', err);
    }

    // Trigger push notification (client-side only, fire-and-forget)
    if (config.recipientUserId && config.recipientUserId !== config.senderId) {
      sendPushNotification(config.recipientUserId, {
        title: config.title,
        message: config.message,
        actionUrl: config.actionUrl,
        notificationId,
        type: config.type,
      }).catch(error => {
        console.error('[Notification] Failed to send push notification:', error);
      });
    }
  } else {
    // ── Server-side: insert via Supabase service_role ─────────────────
    await insertServerNotification(config, notificationId);

    if (
      config.recipientEntityType &&
      config.recipientEntityId &&
      SELF_PERSONAL_COPY_TYPES.has(config.type)
    ) {
      await insertServerNotification(
        {
          ...config,
          recipientUserId: config.senderId,
          recipientEntityType: undefined,
          recipientEntityId: undefined,
          onBehalfOfEntityType: config.onBehalfOfEntityType ?? config.recipientEntityType,
          onBehalfOfEntityId: config.onBehalfOfEntityId ?? config.recipientEntityId,
        },
        crypto.randomUUID()
      );
    }
  }

  return notificationId;
}

/**
 * Send push notification via TanStack server function
 */
async function sendPushNotification(
  userId: string,
  notification: {
    title: string;
    message: string;
    actionUrl?: string;
    notificationId?: string;
    type?: string;
  }
): Promise<void> {
  try {
    const { pushSendFn } = await import('@/server/push-send');
    const result = await pushSendFn({
      data: {
        userId,
        notification,
      },
    });
    console.log('[Notification] Push notification sent:', result);
  } catch (error) {
    console.error('[Notification] Error sending push notification:', error);
    throw error;
  }
}

/**
 * Send notification when a user is invited to a group
 */
export async function notifyGroupInvite(params: {
  senderId: string;
  recipientUserId: string;
  groupId: string;
  groupName: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'group',
    onBehalfOfEntityId: params.groupId,
    type: 'group_invite',
    title: 'Group Invitation',
    message: `You've been invited to join ${params.groupName}`,
    actionUrl: `/group/${params.groupId}/memberships`,
    relatedEntityType: 'group',
    relatedGroupId: params.groupId,
  });
}

/**
 * Send notification when membership is approved
 */
export async function notifyMembershipApproved(params: {
  senderId: string;
  recipientUserId: string;
  groupId: string;
  groupName: string;
}) {
  // Personal notification to the approved user
  await createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'group',
    onBehalfOfEntityId: params.groupId,
    type: 'membership_approved',
    title: 'Membership Approved',
    message: `Your request to join ${params.groupName} has been approved`,
    actionUrl: `/group/${params.groupId}`,
    relatedEntityType: 'group',
    relatedGroupId: params.groupId,
  });

  // Entity notification (action log) to the group
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'group',
    recipientEntityId: params.groupId,
    type: 'membership_approved',
    title: 'Membership Approved',
    message: `A membership request in ${params.groupName} has been approved`,
    actionUrl: `/group/${params.groupId}/memberships`,
    relatedEntityType: 'group',
    relatedGroupId: params.groupId,
    relatedUserId: params.recipientUserId,
  });
}

/**
 * Send notification when membership is rejected
 */
export async function notifyMembershipRejected(params: {
  senderId: string;
  recipientUserId: string;
  groupId: string;
  groupName: string;
}) {
  // Personal notification to the rejected user
  await createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'group',
    onBehalfOfEntityId: params.groupId,
    type: 'membership_rejected',
    title: 'Membership Request Rejected',
    message: `Your request to join ${params.groupName} has been rejected`,
    relatedEntityType: 'group',
    relatedGroupId: params.groupId,
  });

  // Entity notification (action log) to the group
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'group',
    recipientEntityId: params.groupId,
    type: 'membership_rejected',
    title: 'Membership Request Rejected',
    message: `A membership request in ${params.groupName} has been rejected`,
    actionUrl: `/group/${params.groupId}/memberships`,
    relatedEntityType: 'group',
    relatedGroupId: params.groupId,
    relatedUserId: params.recipientUserId,
  });
}

/**
 * Send notification when membership role is changed
 */
export async function notifyMembershipRoleChanged(params: {
  senderId: string;
  recipientUserId: string;
  groupId: string;
  groupName: string;
  newRole: string;
}) {
  // Personal notification to the affected user
  await createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'group',
    onBehalfOfEntityId: params.groupId,
    type: 'membership_role_changed',
    title: 'Role Changed',
    message: `Your role in ${params.groupName} has been changed to ${params.newRole}`,
    actionUrl: `/group/${params.groupId}`,
    relatedEntityType: 'group',
    relatedGroupId: params.groupId,
  });

  // Entity notification (action log) to the group
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'group',
    recipientEntityId: params.groupId,
    type: 'membership_role_changed',
    title: 'Role Changed',
    message: `A member's role in ${params.groupName} has been changed`,
    actionUrl: `/group/${params.groupId}/memberships`,
    relatedEntityType: 'group',
    relatedGroupId: params.groupId,
    relatedUserId: params.recipientUserId,
  });
}

/**
 * Send notification when member is removed
 */
export async function notifyMembershipRemoved(params: {
  senderId: string;
  recipientUserId: string;
  groupId: string;
  groupName: string;
}) {
  // Personal notification to the removed user
  await createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'group',
    onBehalfOfEntityId: params.groupId,
    type: 'member_removed',
    title: 'Removed from Group',
    message: `You have been removed from ${params.groupName}`,
    relatedEntityType: 'group',
    relatedGroupId: params.groupId,
  });

  // Entity notification (action log) to the group
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'group',
    recipientEntityId: params.groupId,
    type: 'member_removed',
    title: 'Member Removed',
    message: `A member has been removed from ${params.groupName}`,
    actionUrl: `/group/${params.groupId}/memberships`,
    relatedEntityType: 'group',
    relatedGroupId: params.groupId,
    relatedUserId: params.recipientUserId,
  });
}

/**
 * Send notification to group when a member withdraws
 */
export async function notifyMembershipWithdrawn(params: {
  senderId: string;
  senderName: string;
  groupId: string;
  groupName: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'group',
    recipientEntityId: params.groupId,
    type: 'membership_withdrawn',
    title: 'Member Left Group',
    message: `${params.senderName} has left ${params.groupName}`,
    actionUrl: `/group/${params.groupId}/memberships`,
    relatedEntityType: 'group',
    relatedGroupId: params.groupId,
    relatedUserId: params.senderId,
  });
}

/**
 * Send notification to group when a user requests membership
 */
export async function notifyMembershipRequest(params: {
  senderId: string;
  senderName: string;
  groupId: string;
  groupName: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'group',
    recipientEntityId: params.groupId,
    type: 'membership_request',
    title: 'Membership Request',
    message: `${params.senderName} has requested to join ${params.groupName}`,
    actionUrl: `/group/${params.groupId}/memberships`,
    relatedEntityType: 'group',
    relatedGroupId: params.groupId,
    relatedUserId: params.senderId,
  });
}

/**
 * Send notification when a user is invited to an event
 */
export async function notifyEventInvite(params: {
  senderId: string;
  recipientUserId: string;
  eventId: string;
  eventTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'event',
    onBehalfOfEntityId: params.eventId,
    type: 'event_invite',
    title: 'Event Invitation',
    message: `You've been invited to ${params.eventTitle}`,
    actionUrl: `/user/${params.recipientUserId}/memberships`,
    relatedEntityType: 'event',
    relatedEventId: params.eventId,
  });
}

/**
 * Send notification when participation is approved
 */
export async function notifyParticipationApproved(params: {
  senderId: string;
  recipientUserId: string;
  eventId: string;
  eventTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'event',
    onBehalfOfEntityId: params.eventId,
    type: 'participation_approved',
    title: 'Participation Approved',
    message: `Your request to participate in ${params.eventTitle} has been approved`,
    actionUrl: `/event/${params.eventId}`,
    relatedEntityType: 'event',
    relatedEventId: params.eventId,
  });
}

/**
 * Send notification when participation is rejected
 */
export async function notifyParticipationRejected(params: {
  senderId: string;
  recipientUserId: string;
  eventId: string;
  eventTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'event',
    onBehalfOfEntityId: params.eventId,
    type: 'participation_rejected',
    title: 'Participation Request Rejected',
    message: `Your request to participate in ${params.eventTitle} has been rejected`,
    relatedEntityType: 'event',
    relatedEventId: params.eventId,
  });
}

/**
 * Send notification when participant role is changed
 */
export async function notifyParticipationRoleChanged(params: {
  senderId: string;
  recipientUserId: string;
  eventId: string;
  eventTitle: string;
  newRole: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'event',
    onBehalfOfEntityId: params.eventId,
    type: 'participation_role_changed',
    title: 'Role Changed',
    message: `Your role in ${params.eventTitle} has been changed to ${params.newRole}`,
    actionUrl: `/event/${params.eventId}`,
    relatedEntityType: 'event',
    relatedEventId: params.eventId,
  });
}

/**
 * Send notification when participant is removed
 */
export async function notifyParticipationRemoved(params: {
  senderId: string;
  recipientUserId: string;
  eventId: string;
  eventTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'event',
    onBehalfOfEntityId: params.eventId,
    type: 'participant_removed',
    title: 'Removed from Event',
    message: `You have been removed from ${params.eventTitle}`,
    relatedEntityType: 'event',
    relatedEventId: params.eventId,
  });
}

/**
 * Send notification to event when a participant withdraws
 */
export async function notifyParticipationWithdrawn(params: {
  senderId: string;
  senderName: string;
  eventId: string;
  eventTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'event',
    recipientEntityId: params.eventId,
    type: 'participation_withdrawn',
    title: 'Participant Withdrew',
    message: `${params.senderName} has withdrawn from ${params.eventTitle}`,
    actionUrl: `/event/${params.eventId}/participants`,
    relatedEntityType: 'event',
    relatedEventId: params.eventId,
    relatedUserId: params.senderId,
  });
}

/**
 * Send notification to event when a user requests participation
 */
export async function notifyParticipationRequest(params: {
  senderId: string;
  senderName: string;
  eventId: string;
  eventTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'event',
    recipientEntityId: params.eventId,
    type: 'participation_request',
    title: 'Participation Request',
    message: `${params.senderName} has requested to participate in ${params.eventTitle}`,
    actionUrl: `/event/${params.eventId}/participants`,
    relatedEntityType: 'event',
    relatedEventId: params.eventId,
    relatedUserId: params.senderId,
  });
}

/**
 * Send notification to a user when an event is created in a group they're a member of
 */
export async function notifyGroupEventCreated(params: {
  senderId: string;
  recipientUserId: string;
  groupId: string;
  groupName: string;
  eventId: string;
  eventTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'group',
    onBehalfOfEntityId: params.groupId,
    type: 'group_new_event',
    title: 'New Event',
    message: `${params.groupName} has created a new event: ${params.eventTitle}`,
    actionUrl: `/event/${params.eventId}`,
    relatedEntityType: 'event',
    relatedEventId: params.eventId,
    relatedGroupId: params.groupId,
  });
}

/**
 * Send notification when a user is invited to collaborate on an amendment
 */
export async function notifyCollaborationInvite(params: {
  senderId: string;
  recipientUserId: string;
  amendmentId: string;
  amendmentTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'amendment',
    onBehalfOfEntityId: params.amendmentId,
    type: 'collaboration_invite',
    title: 'Collaboration Invitation',
    message: `You've been invited to collaborate on ${params.amendmentTitle}`,
    actionUrl: `/amendment/${params.amendmentId}/collaborators`,
    relatedEntityType: 'amendment',
    relatedAmendmentId: params.amendmentId,
  });
}

/**
 * Send notification when collaboration is approved
 */
export async function notifyCollaborationApproved(params: {
  senderId: string;
  recipientUserId: string;
  amendmentId: string;
  amendmentTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'amendment',
    onBehalfOfEntityId: params.amendmentId,
    type: 'collaboration_approved',
    title: 'Collaboration Approved',
    message: `Your request to collaborate on ${params.amendmentTitle} has been approved`,
    actionUrl: `/amendment/${params.amendmentId}`,
    relatedEntityType: 'amendment',
    relatedAmendmentId: params.amendmentId,
  });
}

/**
 * Send notification when collaboration is rejected
 */
export async function notifyCollaborationRejected(params: {
  senderId: string;
  recipientUserId: string;
  amendmentId: string;
  amendmentTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'amendment',
    onBehalfOfEntityId: params.amendmentId,
    type: 'collaboration_rejected',
    title: 'Collaboration Request Rejected',
    message: `Your request to collaborate on ${params.amendmentTitle} has been rejected`,
    relatedEntityType: 'amendment',
    relatedAmendmentId: params.amendmentId,
  });
}

/**
 * Send notification when collaborator role is changed
 */
export async function notifyCollaborationRoleChanged(params: {
  senderId: string;
  recipientUserId: string;
  amendmentId: string;
  amendmentTitle: string;
  newRole: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'amendment',
    onBehalfOfEntityId: params.amendmentId,
    type: 'collaboration_role_changed',
    title: 'Role Changed',
    message: `Your role in ${params.amendmentTitle} has been changed to ${params.newRole}`,
    actionUrl: `/amendment/${params.amendmentId}`,
    relatedEntityType: 'amendment',
    relatedAmendmentId: params.amendmentId,
  });
}

/**
 * Send notification when collaborator is removed
 */
export async function notifyCollaborationRemoved(params: {
  senderId: string;
  recipientUserId: string;
  amendmentId: string;
  amendmentTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'amendment',
    onBehalfOfEntityId: params.amendmentId,
    type: 'collaborator_removed',
    title: 'Removed from Amendment',
    message: `You have been removed from ${params.amendmentTitle}`,
    relatedEntityType: 'amendment',
    relatedAmendmentId: params.amendmentId,
  });
}

/**
 * Send notification to amendment when a collaborator withdraws
 */
export async function notifyCollaborationWithdrawn(params: {
  senderId: string;
  senderName: string;
  amendmentId: string;
  amendmentTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'amendment',
    recipientEntityId: params.amendmentId,
    type: 'collaboration_withdrawn',
    title: 'Collaborator Withdrew',
    message: `${params.senderName} has withdrawn from ${params.amendmentTitle}`,
    actionUrl: `/amendment/${params.amendmentId}/collaborators`,
    relatedEntityType: 'amendment',
    relatedAmendmentId: params.amendmentId,
    relatedUserId: params.senderId,
  });
}

/**
 * Send notification to amendment when a user requests collaboration
 */
export async function notifyCollaborationRequest(params: {
  senderId: string;
  senderName: string;
  amendmentId: string;
  amendmentTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'amendment',
    recipientEntityId: params.amendmentId,
    type: 'collaboration_request',
    title: 'Collaboration Request',
    message: `${params.senderName} has requested to collaborate on ${params.amendmentTitle}`,
    actionUrl: `/amendment/${params.amendmentId}/collaborators`,
    relatedEntityType: 'amendment',
    relatedAmendmentId: params.amendmentId,
    relatedUserId: params.senderId,
  });
}

// ============================================================================
// GROUP ADMIN NOTIFICATIONS
// ============================================================================

/**
 * Send notification when a member is promoted to admin
 */
export async function notifyAdminPromoted(params: {
  senderId: string;
  recipientUserId: string;
  groupId: string;
  groupName: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'group',
    onBehalfOfEntityId: params.groupId,
    type: 'group_admin_promoted',
    title: 'Promoted to Admin',
    message: `You have been promoted to admin in ${params.groupName}`,
    actionUrl: `/group/${params.groupId}`,
    relatedEntityType: 'group',
    relatedGroupId: params.groupId,
  });
}

/**
 * Send notification when an admin is demoted to member
 */
export async function notifyAdminDemoted(params: {
  senderId: string;
  recipientUserId: string;
  groupId: string;
  groupName: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'group',
    onBehalfOfEntityId: params.groupId,
    type: 'group_admin_demoted',
    title: 'Demoted to Member',
    message: `You have been demoted to member in ${params.groupName}`,
    actionUrl: `/group/${params.groupId}`,
    relatedEntityType: 'group',
    relatedGroupId: params.groupId,
  });
}

/**
 * Send notification when a role is created
 */
export async function notifyAccessRoleCreated(params: {
  senderId: string;
  groupId: string;
  groupName: string;
  roleName: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'group',
    recipientEntityId: params.groupId,
    type: 'group_access_role_created',
    title: 'New Role Created',
    message: `A new role "${params.roleName}" has been created in ${params.groupName}`,
    actionUrl: `/group/${params.groupId}/memberships`,
    relatedEntityType: 'group',
    relatedGroupId: params.groupId,
  });
}

/**
 * Send notification when a role is deleted
 */
export async function notifyAccessRoleDeleted(params: {
  senderId: string;
  groupId: string;
  groupName: string;
  roleName: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'group',
    recipientEntityId: params.groupId,
    type: 'group_access_role_deleted',
    title: 'Role Deleted',
    message: `The role "${params.roleName}" has been deleted from ${params.groupName}`,
    actionUrl: `/group/${params.groupId}/memberships`,
    relatedEntityType: 'group',
    relatedGroupId: params.groupId,
  });
}

/**
 * Send notification when role action rights are updated
 */
export async function notifyActionRightsChanged(params: {
  senderId: string;
  groupId: string;
  groupName: string;
  roleName: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'group',
    recipientEntityId: params.groupId,
    type: 'group_access_role_updated',
    title: 'Role Permissions Updated',
    message: `The permissions for "${params.roleName}" have been updated in ${params.groupName}`,
    actionUrl: `/group/${params.groupId}/memberships`,
    relatedEntityType: 'group',
    relatedGroupId: params.groupId,
  });
}

// ============================================================================
// GROUP RESOURCE NOTIFICATIONS
// ============================================================================

/**
 * Send notification when a link is added to the group
 */
export async function notifyLinkAdded(params: {
  senderId: string;
  groupId: string;
  groupName: string;
  linkTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'group',
    recipientEntityId: params.groupId,
    type: 'group_link_added',
    title: 'New Link Added',
    message: `A new link "${params.linkTitle}" has been added to ${params.groupName}`,
    actionUrl: `/group/${params.groupId}`,
    relatedEntityType: 'group',
    relatedGroupId: params.groupId,
  });
}

/**
 * Send notification when a link is removed from the group
 */
export async function notifyLinkRemoved(params: {
  senderId: string;
  groupId: string;
  groupName: string;
  linkTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'group',
    recipientEntityId: params.groupId,
    type: 'group_link_removed',
    title: 'Link Removed',
    message: `The link "${params.linkTitle}" has been removed from ${params.groupName}`,
    actionUrl: `/group/${params.groupId}`,
    relatedEntityType: 'group',
    relatedGroupId: params.groupId,
  });
}

/**
 * Send notification when a document is added to the group
 */
export async function notifyDocumentCreated(params: {
  senderId: string;
  groupId: string;
  groupName: string;
  documentTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'group',
    recipientEntityId: params.groupId,
    type: 'group_document_added',
    title: 'New Document Added',
    message: `A new document "${params.documentTitle}" has been added to ${params.groupName}`,
    actionUrl: `/group/${params.groupId}`,
    relatedEntityType: 'group',
    relatedGroupId: params.groupId,
  });
}

/**
 * Send notification when a document is removed from the group
 */
export async function notifyDocumentDeleted(params: {
  senderId: string;
  groupId: string;
  groupName: string;
  documentTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'group',
    recipientEntityId: params.groupId,
    type: 'group_document_removed',
    title: 'Document Removed',
    message: `The document "${params.documentTitle}" has been removed from ${params.groupName}`,
    actionUrl: `/group/${params.groupId}`,
    relatedEntityType: 'group',
    relatedGroupId: params.groupId,
  });
}

/**
 * Send notification when a user is invited to collaborate on a standalone document
 */
export async function notifyDocumentCollaboratorInvited(params: {
  senderId: string;
  recipientUserId: string;
  documentId: string;
  documentTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    type: 'document_collaborator_invited',
    title: 'Document Collaboration Invite',
    message: `You've been invited to collaborate on "${params.documentTitle}"`,
    actionUrl: `/editor/${params.documentId}`,
  });
}

/**
 * Send notification when a new subscriber joins the group
 */
export async function notifyGroupNewSubscriber(params: {
  senderId: string;
  senderName: string;
  groupId: string;
  groupName: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'group',
    recipientEntityId: params.groupId,
    type: 'group_new_subscriber',
    title: 'New Subscriber',
    message: `${params.senderName} has subscribed to ${params.groupName}`,
    actionUrl: `/group/${params.groupId}`,
    relatedEntityType: 'group',
    relatedGroupId: params.groupId,
    relatedUserId: params.senderId,
  });
}

// ============================================================================
// GROUP ROLE NOTIFICATIONS
// ============================================================================

/**
 * Send notification when a role is created
 */
export async function notifyRoleCreated(params: {
  senderId: string;
  recipientUserId: string;
  groupId: string;
  groupName: string;
  roleTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'group',
    onBehalfOfEntityId: params.groupId,
    type: 'group_role_created',
    title: 'New Role Created',
    message: `A new role "${params.roleTitle}" has been created in ${params.groupName}`,
    actionUrl: `/group/${params.groupId}`,
    relatedEntityType: 'group',
    relatedGroupId: params.groupId,
  });
}

/**
 * Send notification to a group when a role is created
 */
export async function notifyGroupRoleCreated(params: {
  senderId: string;
  groupId: string;
  groupName: string;
  roleTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'group',
    recipientEntityId: params.groupId,
    type: 'group_role_created',
    title: 'New Role Created',
    message: `A new role "${params.roleTitle}" has been created in ${params.groupName}`,
    actionUrl: `/group/${params.groupId}`,
    relatedEntityType: 'group',
    relatedGroupId: params.groupId,
  });
}

/**
 * Send notification when a role is deleted
 */
export async function notifyRoleDeleted(params: {
  senderId: string;
  recipientUserId: string;
  groupId: string;
  groupName: string;
  roleTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'group',
    onBehalfOfEntityId: params.groupId,
    type: 'group_role_deleted',
    title: 'Role Deleted',
    message: `The role "${params.roleTitle}" has been deleted from ${params.groupName}`,
    actionUrl: `/group/${params.groupId}`,
    relatedEntityType: 'group',
    relatedGroupId: params.groupId,
  });
}

/**
 * Send notification when a user is assigned to a role
 */
export async function notifyRoleAssigned(params: {
  senderId: string;
  recipientUserId: string;
  groupId: string;
  groupName: string;
  roleTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'group',
    onBehalfOfEntityId: params.groupId,
    type: 'group_role_assigned',
    title: 'Role Assigned',
    message: `You have been assigned to the role "${params.roleTitle}" in ${params.groupName}`,
    actionUrl: `/group/${params.groupId}`,
    relatedEntityType: 'group',
    relatedGroupId: params.groupId,
  });
}

/**
 * Send notification when a user is removed from a role
 */
export async function notifyRoleVacated(params: {
  senderId: string;
  recipientUserId: string;
  groupId: string;
  groupName: string;
  roleTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'group',
    onBehalfOfEntityId: params.groupId,
    type: 'group_role_vacated',
    title: 'Role Vacated',
    message: `You have been removed from the role "${params.roleTitle}" in ${params.groupName}`,
    actionUrl: `/group/${params.groupId}`,
    relatedEntityType: 'group',
    relatedGroupId: params.groupId,
  });
}

/**
 * Send notification when an election is created for a role
 */
export async function notifyElectionCreated(params: {
  senderId: string;
  recipientUserId: string;
  groupId: string;
  groupName: string;
  roleTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'group',
    onBehalfOfEntityId: params.groupId,
    type: 'group_election_created',
    title: 'Election Created',
    message: `An election has been created for "${params.roleTitle}" in ${params.groupName}`,
    actionUrl: `/group/${params.groupId}`,
    relatedEntityType: 'group',
    relatedGroupId: params.groupId,
  });
}

// ============================================================================
// GROUP RELATIONSHIP NOTIFICATIONS
// ============================================================================

/**
 * Send notification when a group relationship is requested
 */
export async function notifyRelationshipRequested(params: {
  senderId: string;
  sourceGroupId: string;
  sourceGroupName: string;
  targetGroupId: string;
  targetGroupName: string;
  relationshipType: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'group',
    recipientEntityId: params.targetGroupId,
    type: 'network_link_request',
    title: 'Relationship Request',
    message: `${params.sourceGroupName} has requested a ${params.relationshipType} relationship with ${params.targetGroupName}`,
    actionUrl: `/group/${params.targetGroupId}/network`,
    relatedEntityType: 'group',
    relatedGroupId: params.sourceGroupId,
  });
}

/**
 * Send notification when a group relationship is approved
 */
export async function notifyRelationshipApproved(params: {
  senderId: string;
  sourceGroupId: string;
  sourceGroupName: string;
  targetGroupId: string;
  targetGroupName: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'group',
    recipientEntityId: params.sourceGroupId,
    type: 'network_link_approved',
    title: 'Relationship Approved',
    message: `${params.targetGroupName} has approved the relationship request`,
    actionUrl: `/group/${params.sourceGroupId}/network`,
    relatedEntityType: 'group',
    relatedGroupId: params.targetGroupId,
  });
}

/**
 * Send notification when a group relationship is rejected
 */
export async function notifyRelationshipRejected(params: {
  senderId: string;
  sourceGroupId: string;
  sourceGroupName: string;
  targetGroupId: string;
  targetGroupName: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'group',
    recipientEntityId: params.sourceGroupId,
    type: 'network_link_rejected',
    title: 'Relationship Rejected',
    message: `${params.targetGroupName} has rejected the relationship request`,
    actionUrl: `/group/${params.sourceGroupId}/network`,
    relatedEntityType: 'group',
    relatedGroupId: params.targetGroupId,
  });
}

// ============================================================================
// GROUP TODO NOTIFICATIONS
// ============================================================================

/**
 * Send notification when a todo is assigned
 */
export async function notifyTodoAssigned(params: {
  senderId: string;
  recipientUserId: string;
  groupId: string;
  groupName: string;
  todoTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'group',
    onBehalfOfEntityId: params.groupId,
    type: 'group_todo_assigned',
    title: 'Task Assigned',
    message: `You have been assigned "${params.todoTitle}" in ${params.groupName}`,
    actionUrl: `/group/${params.groupId}/todos`,
    relatedEntityType: 'group',
    relatedGroupId: params.groupId,
  });
}

/**
 * Send notification when a todo is updated
 */
export async function notifyTodoUpdated(params: {
  senderId: string;
  recipientUserId: string;
  groupId: string;
  groupName: string;
  todoTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'group',
    onBehalfOfEntityId: params.groupId,
    type: 'group_todo_updated',
    title: 'Task Updated',
    message: `The task "${params.todoTitle}" in ${params.groupName} has been updated`,
    actionUrl: `/group/${params.groupId}/todos`,
    relatedEntityType: 'group',
    relatedGroupId: params.groupId,
  });
}

/**
 * Send notification when a todo is deleted
 */
export async function notifyTodoDeleted(params: {
  senderId: string;
  recipientUserId: string;
  groupId: string;
  groupName: string;
  todoTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'group',
    onBehalfOfEntityId: params.groupId,
    type: 'group_todo_deleted',
    title: 'Task Deleted',
    message: `The task "${params.todoTitle}" in ${params.groupName} has been deleted`,
    actionUrl: `/group/${params.groupId}/todos`,
    relatedEntityType: 'group',
    relatedGroupId: params.groupId,
  });
}

// ============================================================================
// GROUP PAYMENT NOTIFICATIONS
// ============================================================================

/**
 * Send notification when a payment is created
 */
export async function notifyPaymentCreated(params: {
  senderId: string;
  groupId: string;
  groupName: string;
  paymentDescription: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'group',
    recipientEntityId: params.groupId,
    type: 'group_payment_created',
    title: 'Payment Created',
    message: `A new payment "${params.paymentDescription}" has been created in ${params.groupName}`,
    actionUrl: `/group/${params.groupId}`,
    relatedEntityType: 'group',
    relatedGroupId: params.groupId,
  });
}

/**
 * Send notification when a payment is deleted
 */
export async function notifyPaymentDeleted(params: {
  senderId: string;
  groupId: string;
  groupName: string;
  paymentDescription: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'group',
    recipientEntityId: params.groupId,
    type: 'group_payment_deleted',
    title: 'Payment Deleted',
    message: `The payment "${params.paymentDescription}" has been deleted from ${params.groupName}`,
    actionUrl: `/group/${params.groupId}`,
    relatedEntityType: 'group',
    relatedGroupId: params.groupId,
  });
}

// ============================================================================
// EVENT NOTIFICATIONS
// ============================================================================

/**
 * Send notification when a participant is promoted to organizer
 */
export async function notifyOrganizerPromoted(params: {
  senderId: string;
  recipientUserId: string;
  eventId: string;
  eventTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'event',
    onBehalfOfEntityId: params.eventId,
    type: 'event_organizer_promoted',
    title: 'Promoted to Organizer',
    message: `You have been promoted to organizer in ${params.eventTitle}`,
    actionUrl: `/event/${params.eventId}`,
    relatedEntityType: 'event',
    relatedEventId: params.eventId,
  });
}

/**
 * Send notification when an organizer is demoted
 */
export async function notifyOrganizerDemoted(params: {
  senderId: string;
  recipientUserId: string;
  eventId: string;
  eventTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'event',
    onBehalfOfEntityId: params.eventId,
    type: 'event_organizer_demoted',
    title: 'Demoted from Organizer',
    message: `You have been demoted from organizer in ${params.eventTitle}`,
    actionUrl: `/event/${params.eventId}`,
    relatedEntityType: 'event',
    relatedEventId: params.eventId,
  });
}

/**
 * Send notification when an agenda item is created
 */
export async function notifyAgendaItemCreated(params: {
  senderId: string;
  eventId: string;
  eventTitle: string;
  agendaItemTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'event',
    recipientEntityId: params.eventId,
    type: 'event_agenda_item_created',
    title: 'Agenda Item Added',
    message: `"${params.agendaItemTitle}" has been added to ${params.eventTitle}`,
    actionUrl: `/event/${params.eventId}`,
    relatedEntityType: 'event',
    relatedEventId: params.eventId,
  });
}

/**
 * Send notification when an agenda item is deleted
 */
export async function notifyAgendaItemDeleted(params: {
  senderId: string;
  eventId: string;
  eventTitle: string;
  agendaItemTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'event',
    recipientEntityId: params.eventId,
    type: 'event_agenda_item_deleted',
    title: 'Agenda Item Removed',
    message: `"${params.agendaItemTitle}" has been removed from ${params.eventTitle}`,
    actionUrl: `/event/${params.eventId}`,
    relatedEntityType: 'event',
    relatedEventId: params.eventId,
  });
}

/**
 * Send notification when an agenda item is transferred to another event
 * Sends notifications to both source and target event participants
 */
export async function notifyAgendaItemTransferred(params: {
  senderId: string;
  sourceEventId: string;
  sourceEventTitle: string;
  targetEventId: string;
  targetEventTitle: string;
  agendaItemTitle: string;
}): Promise<string[]> {
  // Notify source event participants
  const id1 = await createNotification({
    senderId: params.senderId,
    recipientEntityType: 'event',
    recipientEntityId: params.sourceEventId,
    type: 'event_agenda_item_transferred',
    title: 'Agenda Item Moved',
    message: `"${params.agendaItemTitle}" has been moved to ${params.targetEventTitle}`,
    actionUrl: `/event/${params.targetEventId}/agenda`,
    relatedEntityType: 'event',
    relatedEventId: params.targetEventId,
  });

  // Notify target event participants
  const id2 = await createNotification({
    senderId: params.senderId,
    recipientEntityType: 'event',
    recipientEntityId: params.targetEventId,
    type: 'event_agenda_item_transferred',
    title: 'Agenda Item Added',
    message: `"${params.agendaItemTitle}" has been moved from ${params.sourceEventTitle}`,
    actionUrl: `/event/${params.targetEventId}/agenda`,
    relatedEntityType: 'event',
    relatedEventId: params.sourceEventId,
  });

  return [id1, id2];
}

/**
 * Send notification when event schedule changes
 */
export async function notifyScheduleChanged(params: {
  senderId: string;
  eventId: string;
  eventTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'event',
    recipientEntityId: params.eventId,
    type: 'event_schedule_changed',
    title: 'Schedule Changed',
    message: `The schedule for ${params.eventTitle} has been updated`,
    actionUrl: `/event/${params.eventId}`,
    relatedEntityType: 'event',
    relatedEventId: params.eventId,
  });
}

/**
 * Send notification when a candidate is added to an election
 */
export async function notifyCandidateAdded(params: {
  senderId: string;
  eventId: string;
  eventTitle: string;
  candidateName: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'event',
    recipientEntityId: params.eventId,
    type: 'event_candidate_added',
    title: 'Candidate Added',
    message: `${params.candidateName} has been added as a candidate in ${params.eventTitle}`,
    actionUrl: `/event/${params.eventId}`,
    relatedEntityType: 'event',
    relatedEventId: params.eventId,
  });
}

/**
 * Send notification when an election starts
 */
export async function notifyElectionStarted(params: {
  senderId: string;
  eventId: string;
  eventTitle: string;
  electionTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'event',
    recipientEntityId: params.eventId,
    type: 'event_election_started',
    title: 'Election Started',
    message: `Voting has started for "${params.electionTitle}" in ${params.eventTitle}`,
    actionUrl: `/event/${params.eventId}`,
    relatedEntityType: 'event',
    relatedEventId: params.eventId,
  });
}

/**
 * Send notification when an election ends
 */
export async function notifyElectionEnded(params: {
  senderId: string;
  eventId: string;
  eventTitle: string;
  electionTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'event',
    recipientEntityId: params.eventId,
    type: 'event_election_ended',
    title: 'Election Ended',
    message: `Voting has ended for "${params.electionTitle}" in ${params.eventTitle}`,
    actionUrl: `/event/${params.eventId}`,
    relatedEntityType: 'event',
    relatedEventId: params.eventId,
  });
}

/**
 * Send notification when an event role is created
 */
export async function notifyEventRoleCreated(params: {
  senderId: string;
  eventId: string;
  eventTitle: string;
  roleTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'event',
    recipientEntityId: params.eventId,
    type: 'event_role_created',
    title: 'Role Created',
    message: `A new role "${params.roleTitle}" has been created in ${params.eventTitle}`,
    actionUrl: `/event/${params.eventId}`,
    relatedEntityType: 'event',
    relatedEventId: params.eventId,
  });
}

/**
 * Send notification when an event role is deleted
 */
export async function notifyEventRoleDeleted(params: {
  senderId: string;
  eventId: string;
  eventTitle: string;
  roleTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'event',
    recipientEntityId: params.eventId,
    type: 'event_role_deleted',
    title: 'Role Deleted',
    message: `The role "${params.roleTitle}" has been deleted from ${params.eventTitle}`,
    actionUrl: `/event/${params.eventId}`,
    relatedEntityType: 'event',
    relatedEventId: params.eventId,
  });
}

/**
 * Send notification when delegates are finalized
 */
export async function notifyDelegatesFinalized(params: {
  senderId: string;
  eventId: string;
  eventTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'event',
    recipientEntityId: params.eventId,
    type: 'event_delegates_finalized',
    title: 'Delegates Finalized',
    message: `Delegates have been finalized for ${params.eventTitle}`,
    actionUrl: `/event/${params.eventId}`,
    relatedEntityType: 'event',
    relatedEventId: params.eventId,
  });
}

/**
 * Send notification when a delegate is nominated
 */
export async function notifyDelegateNominated(params: {
  senderId: string;
  recipientUserId: string;
  eventId: string;
  eventTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'event',
    onBehalfOfEntityId: params.eventId,
    type: 'event_delegate_nominated',
    title: 'Delegate Nominated',
    message: `You have been nominated as a delegate for ${params.eventTitle}`,
    actionUrl: `/event/${params.eventId}`,
    relatedEntityType: 'event',
    relatedEventId: params.eventId,
  });
}

/**
 * Send notification when a meeting is booked
 */
export async function notifyMeetingBooked(params: {
  senderId: string;
  senderName: string;
  recipientUserId: string;
  eventId?: string;
  eventTitle?: string;
  meetingTime: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: params.eventId ? 'event' : undefined,
    onBehalfOfEntityId: params.eventId,
    type: 'event_meeting_booked',
    title: 'Meeting Booked',
    message: `${params.senderName} has booked a meeting with you${params.eventTitle ? ` for ${params.eventTitle}` : ''} at ${params.meetingTime}`,
    actionUrl: params.eventId ? `/event/${params.eventId}` : '/calendar',
    relatedEntityType: params.eventId ? 'event' : undefined,
    relatedEventId: params.eventId,
  });
}

/**
 * Send notification when a meeting is cancelled
 */
export async function notifyMeetingCancelled(params: {
  senderId: string;
  senderName: string;
  recipientUserId: string;
  eventId?: string;
  eventTitle?: string;
  meetingTime: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: params.eventId ? 'event' : undefined,
    onBehalfOfEntityId: params.eventId,
    type: 'event_meeting_cancelled',
    title: 'Meeting Cancelled',
    message: `${params.senderName} has cancelled the meeting${params.eventTitle ? ` for ${params.eventTitle}` : ''} at ${params.meetingTime}`,
    actionUrl: params.eventId ? `/event/${params.eventId}` : '/calendar',
    relatedEntityType: params.eventId ? 'event' : undefined,
    relatedEventId: params.eventId,
  });
}

/**
 * Send notification when a speaker is added
 */
export async function notifySpeakerAdded(params: {
  senderId: string;
  recipientUserId: string;
  eventId: string;
  eventTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'event',
    onBehalfOfEntityId: params.eventId,
    type: 'event_speaker_added',
    title: 'Added to Speaker List',
    message: `You have been added to the speaker list for ${params.eventTitle}`,
    actionUrl: `/event/${params.eventId}`,
    relatedEntityType: 'event',
    relatedEventId: params.eventId,
  });
}

/**
 * Send notification when a user joins the speaker list
 */
export async function notifySpeakerListJoined(params: {
  senderId: string;
  senderName: string;
  eventId: string;
  eventTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'event',
    recipientEntityId: params.eventId,
    type: 'event_speaker_added',
    title: 'Speaker Joined',
    message: `${params.senderName} has joined the speaker list for ${params.eventTitle}`,
    actionUrl: `/event/${params.eventId}`,
    relatedEntityType: 'event',
    relatedEventId: params.eventId,
  });
}

/**
 * Send notification when a new subscriber joins the event
 */
export async function notifyEventNewSubscriber(params: {
  senderId: string;
  senderName: string;
  eventId: string;
  eventTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'event',
    recipientEntityId: params.eventId,
    type: 'event_new_subscriber',
    title: 'New Subscriber',
    message: `${params.senderName} has subscribed to ${params.eventTitle}`,
    actionUrl: `/event/${params.eventId}`,
    relatedEntityType: 'event',
    relatedEventId: params.eventId,
    relatedUserId: params.senderId,
  });
}

// ============================================================================
// AGENDA AND VOTING NOTIFICATIONS
// ============================================================================

/**
 * Send notification when an agenda item is activated
 */
export async function notifyAgendaItemActivated(params: {
  senderId: string;
  eventId: string;
  eventTitle: string;
  agendaItemId: string;
  agendaItemTitle: string;
  agendaItemType: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'event',
    recipientEntityId: params.eventId,
    type: 'agenda_item_activated',
    title: 'Agenda Item Activated',
    message: `${params.agendaItemTitle} is now active at ${params.eventTitle}`,
    actionUrl: `/event/${params.eventId}/stream`,
    relatedEntityType: 'event',
    relatedEventId: params.eventId,
  });
}

/**
 * Send notification when voting phase starts
 */
export async function notifyVotingPhaseStarted(params: {
  senderId: string;
  eventId: string;
  eventTitle: string;
  agendaItemTitle: string;
  votingType: string;
  timeLimit?: number;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'event',
    recipientEntityId: params.eventId,
    type: 'voting_phase_started',
    title: 'Voting Has Begun',
    message: `Voting for ${params.agendaItemTitle} has started${params.timeLimit ? ` (${Math.floor(params.timeLimit / 60)} minutes)` : ''}`,
    actionUrl: `/event/${params.eventId}/stream`,
    relatedEntityType: 'event',
    relatedEventId: params.eventId,
  });
}

/**
 * Send notification when voting is ending soon
 */
export async function notifyVotingPhaseEndingSoon(params: {
  senderId: string;
  eventId: string;
  eventTitle: string;
  agendaItemTitle: string;
  minutesRemaining: number;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'event',
    recipientEntityId: params.eventId,
    type: 'voting_phase_ending_soon',
    title: 'Voting Ending Soon',
    message: `Voting for ${params.agendaItemTitle} ends in ${params.minutesRemaining} minutes`,
    actionUrl: `/event/${params.eventId}/stream`,
    relatedEntityType: 'event',
    relatedEventId: params.eventId,
  });
}

/**
 * Send notification when voting is completed
 */
export async function notifyVotingCompleted(params: {
  senderId: string;
  eventId: string;
  eventTitle: string;
  agendaItemTitle: string;
  result: 'passed' | 'rejected' | 'tie';
  acceptVotes: number;
  rejectVotes: number;
}) {
  const resultText =
    params.result === 'passed'
      ? 'accepted'
      : params.result === 'rejected'
        ? 'rejected'
        : 'resulted in a tie';
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'event',
    recipientEntityId: params.eventId,
    type: 'voting_completed',
    title: 'Voting Completed',
    message: `${params.agendaItemTitle} was ${resultText} (${params.acceptVotes} for, ${params.rejectVotes} against)`,
    actionUrl: `/event/${params.eventId}/agenda`,
    relatedEntityType: 'event',
    relatedEventId: params.eventId,
  });
}

/**
 * Send notification when an amendment is forwarded to next event
 */
export async function notifyAmendmentForwarded(params: {
  senderId: string;
  amendmentId: string;
  amendmentTitle: string;
  sourceEventTitle: string;
  targetEventId: string;
  targetEventTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'amendment',
    recipientEntityId: params.amendmentId,
    type: 'amendment_forwarded',
    title: 'Amendment Forwarded',
    message: `${params.amendmentTitle} has been forwarded from ${params.sourceEventTitle} to ${params.targetEventTitle}`,
    actionUrl: `/event/${params.targetEventId}/agenda`,
    relatedEntityType: 'amendment',
    relatedAmendmentId: params.amendmentId,
  });
}

/**
 * Send notification when an election result is determined
 */
export async function notifyElectionResult(params: {
  senderId: string;
  eventId: string;
  eventTitle: string;
  roleTitle: string;
  winnerName: string;
  winnerId: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'event',
    recipientEntityId: params.eventId,
    type: 'election_result',
    title: 'Election Result',
    message: `${params.winnerName} has been elected as ${params.roleTitle}`,
    actionUrl: `/event/${params.eventId}/roles`,
    relatedEntityType: 'event',
    relatedEventId: params.eventId,
    relatedUserId: params.winnerId,
  });
}

/**
 * Send notification when a revote is scheduled
 */
export async function notifyRevoteScheduled(params: {
  senderId: string;
  groupId: string;
  groupName: string;
  roleTitle: string;
  scheduledDate: string;
  eventId?: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'group',
    recipientEntityId: params.groupId,
    type: 'revote_scheduled',
    title: 'Revote Scheduled',
    message: `A revote for ${params.roleTitle} has been scheduled for ${params.scheduledDate}`,
    actionUrl: params.eventId
      ? `/event/${params.eventId}/agenda`
      : `/group/${params.groupId}/memberships`,
    relatedEntityType: 'group',
    relatedGroupId: params.groupId,
    relatedEventId: params.eventId,
  });
}

/**
 * Send notification when an event is cancelled
 */
export async function notifyEventCancelled(params: {
  senderId: string;
  eventId: string;
  eventTitle: string;
  cancellationReason?: string;
  reassignmentEventId?: string;
  reassignmentEventTitle?: string;
}) {
  const message = params.reassignmentEventId
    ? `${params.eventTitle} has been cancelled. Agenda items have been moved to ${params.reassignmentEventTitle}.`
    : `${params.eventTitle} has been cancelled.${params.cancellationReason ? ` Reason: ${params.cancellationReason}` : ''}`;

  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'event',
    recipientEntityId: params.eventId,
    type: 'event_cancelled',
    title: 'Event Cancelled',
    message,
    actionUrl: params.reassignmentEventId ? `/event/${params.reassignmentEventId}` : undefined,
    relatedEntityType: 'event',
    relatedEventId: params.eventId,
  });
}

/**
 * Send notification when agenda items are reassigned to another event
 */
export async function notifyAgendaItemsReassigned(params: {
  senderId: string;
  sourceEventId: string;
  sourceEventTitle: string;
  targetEventId: string;
  targetEventTitle: string;
  itemCount: number;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'event',
    recipientEntityId: params.targetEventId,
    type: 'agenda_items_reassigned',
    title: 'Agenda Items Reassigned',
    message: `${params.itemCount} agenda item(s) from ${params.sourceEventTitle} have been added to ${params.targetEventTitle}`,
    actionUrl: `/event/${params.targetEventId}/agenda`,
    relatedEntityType: 'event',
    relatedEventId: params.targetEventId,
  });
}

/**
 * Send notification when amendment path needs recalculation
 */
export async function notifyAmendmentPathRecalculationRequired(params: {
  senderId: string;
  amendmentId: string;
  amendmentTitle: string;
  reason: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'amendment',
    recipientEntityId: params.amendmentId,
    type: 'amendment_path_recalculation_required',
    title: 'Path Recalculation Required',
    message: `The path for ${params.amendmentTitle} needs to be recalculated. ${params.reason}`,
    actionUrl: `/amendment/${params.amendmentId}/process`,
    relatedEntityType: 'amendment',
    relatedAmendmentId: params.amendmentId,
  });
}

// ============================================================================
// SUPPORTER CONFIRMATION NOTIFICATIONS
// ============================================================================

/**
 * Send notification when a group needs to confirm support after a change request
 */
export async function notifySupportConfirmationRequired(params: {
  senderId: string;
  groupId: string;
  groupName: string;
  amendmentId: string;
  amendmentTitle: string;
  changeRequestTitle: string;
  agendaItemId?: string;
  eventId?: string;
  eventTitle?: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'group',
    recipientEntityId: params.groupId,
    type: 'support_confirmation_required',
    title: 'Support Confirmation Required',
    message: `A change was accepted on ${params.amendmentTitle}. ${params.groupName} needs to confirm continued support.`,
    actionUrl: params.eventId
      ? `/event/${params.eventId}/agenda`
      : `/amendment/${params.amendmentId}`,
    relatedEntityType: 'group',
    relatedGroupId: params.groupId,
    relatedAmendmentId: params.amendmentId,
  });
}

/**
 * Send notification when a group confirms support for an amendment
 */
export async function notifySupportConfirmed(params: {
  senderId: string;
  amendmentId: string;
  amendmentTitle: string;
  groupId: string;
  groupName: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'amendment',
    recipientEntityId: params.amendmentId,
    type: 'support_confirmed',
    title: 'Support Confirmed',
    message: `${params.groupName} has confirmed their support for ${params.amendmentTitle}`,
    actionUrl: `/amendment/${params.amendmentId}`,
    relatedEntityType: 'amendment',
    relatedAmendmentId: params.amendmentId,
    relatedGroupId: params.groupId,
  });
}

/**
 * Send notification when a group declines support for an amendment
 */
export async function notifySupportDeclined(params: {
  senderId: string;
  amendmentId: string;
  amendmentTitle: string;
  groupId: string;
  groupName: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'amendment',
    recipientEntityId: params.amendmentId,
    type: 'support_declined',
    title: 'Support Declined',
    message: `${params.groupName} has withdrawn their support for ${params.amendmentTitle}`,
    actionUrl: `/amendment/${params.amendmentId}`,
    relatedEntityType: 'amendment',
    relatedAmendmentId: params.amendmentId,
    relatedGroupId: params.groupId,
  });
}

// ============================================================================
// AMENDMENT NOTIFICATIONS
// ============================================================================

/**
 * Send notification when workflow status changes
 */
export async function notifyWorkflowChanged(params: {
  senderId: string;
  amendmentId: string;
  amendmentTitle: string;
  newStatus: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'amendment',
    recipientEntityId: params.amendmentId,
    type: 'amendment_workflow_changed',
    title: 'Workflow Status Changed',
    message: `The status of ${params.amendmentTitle} has changed to ${params.newStatus}`,
    actionUrl: `/amendment/${params.amendmentId}`,
    relatedEntityType: 'amendment',
    relatedAmendmentId: params.amendmentId,
  });
}

/**
 * Send notification when amendment advances through path
 */
export async function notifyPathAdvanced(params: {
  senderId: string;
  amendmentId: string;
  amendmentTitle: string;
  segmentName: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'amendment',
    recipientEntityId: params.amendmentId,
    type: 'amendment_path_advanced',
    title: 'Path Advanced',
    message: `${params.amendmentTitle} has advanced to ${params.segmentName}`,
    actionUrl: `/amendment/${params.amendmentId}`,
    relatedEntityType: 'amendment',
    relatedAmendmentId: params.amendmentId,
  });
}

/**
 * Send notification when an amendment is cloned
 */
export async function notifyAmendmentCloned(params: {
  senderId: string;
  senderName: string;
  originalAmendmentId: string;
  originalAmendmentTitle: string;
  newAmendmentId: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'amendment',
    recipientEntityId: params.originalAmendmentId,
    type: 'amendment_cloned',
    title: 'Amendment Cloned',
    message: `${params.senderName} has cloned ${params.originalAmendmentTitle}`,
    actionUrl: `/amendment/${params.newAmendmentId}`,
    relatedEntityType: 'amendment',
    relatedAmendmentId: params.newAmendmentId,
  });
}

/**
 * Send notification when a group adds support
 */
export async function notifyGroupSupportAdded(params: {
  senderId: string;
  amendmentId: string;
  amendmentTitle: string;
  groupName: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'amendment',
    recipientEntityId: params.amendmentId,
    type: 'amendment_group_support',
    title: 'Group Support Added',
    message: `${params.groupName} has added support for ${params.amendmentTitle}`,
    actionUrl: `/amendment/${params.amendmentId}`,
    relatedEntityType: 'amendment',
    relatedAmendmentId: params.amendmentId,
  });
}

/**
 * Send notification when a comment is added
 */
export async function notifyAmendmentCommentAdded(params: {
  senderId: string;
  senderName: string;
  amendmentId: string;
  amendmentTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'amendment',
    recipientEntityId: params.amendmentId,
    type: 'amendment_comment_added',
    title: 'New Comment',
    message: `${params.senderName} commented on ${params.amendmentTitle}`,
    actionUrl: `/amendment/${params.amendmentId}`,
    relatedEntityType: 'amendment',
    relatedAmendmentId: params.amendmentId,
    relatedUserId: params.senderId,
  });
}

/**
 * Send notification when a change request is created
 */
export async function notifyChangeRequestCreated(params: {
  senderId: string;
  senderName: string;
  amendmentId: string;
  amendmentTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'amendment',
    recipientEntityId: params.amendmentId,
    type: 'change_request_created',
    title: 'Change Request Created',
    message: `${params.senderName} has created a change request for ${params.amendmentTitle}`,
    actionUrl: `/amendment/${params.amendmentId}/change-requests`,
    relatedEntityType: 'amendment',
    relatedAmendmentId: params.amendmentId,
    relatedUserId: params.senderId,
  });
}

/**
 * Send notification when a change request is accepted
 */
export async function notifyChangeRequestAccepted(params: {
  senderId: string;
  recipientUserId: string;
  amendmentId: string;
  amendmentTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'amendment',
    onBehalfOfEntityId: params.amendmentId,
    type: 'change_request_accepted',
    title: 'Change Request Accepted',
    message: `Your change request for ${params.amendmentTitle} has been accepted`,
    actionUrl: `/amendment/${params.amendmentId}`,
    relatedEntityType: 'amendment',
    relatedAmendmentId: params.amendmentId,
  });
}

/**
 * Send notification when a change request is rejected
 */
export async function notifyChangeRequestRejected(params: {
  senderId: string;
  recipientUserId: string;
  amendmentId: string;
  amendmentTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'amendment',
    onBehalfOfEntityId: params.amendmentId,
    type: 'change_request_rejected',
    title: 'Change Request Rejected',
    message: `Your change request for ${params.amendmentTitle} has been rejected`,
    actionUrl: `/amendment/${params.amendmentId}`,
    relatedEntityType: 'amendment',
    relatedAmendmentId: params.amendmentId,
  });
}

/**
 * Send notification when a vote is cast on a change request
 */
export async function notifyChangeRequestVoteCast(params: {
  senderId: string;
  senderName: string;
  recipientUserId: string;
  changeRequestId: string;
  amendmentId: string;
  amendmentTitle: string;
  voteType: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'amendment',
    onBehalfOfEntityId: params.amendmentId,
    type: 'change_request_vote_cast',
    title: 'Vote Cast on Change Request',
    message: `${params.senderName} voted "${params.voteType}" on your change request for ${params.amendmentTitle}`,
    actionUrl: `/amendment/${params.amendmentId}/change-requests`,
    relatedEntityType: 'amendment',
    relatedAmendmentId: params.amendmentId,
  });
}

/**
 * Send notification when a new version is created
 */
export async function notifyVersionCreated(params: {
  senderId: string;
  amendmentId: string;
  amendmentTitle: string;
  version: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'amendment',
    recipientEntityId: params.amendmentId,
    type: 'amendment_version_created',
    title: 'New Version Created',
    message: `Version ${params.version} of ${params.amendmentTitle} has been created`,
    actionUrl: `/amendment/${params.amendmentId}`,
    relatedEntityType: 'amendment',
    relatedAmendmentId: params.amendmentId,
  });
}

/**
 * Send notification when a voting session starts
 */
export async function notifyVotingSessionStarted(params: {
  senderId: string;
  amendmentId: string;
  amendmentTitle: string;
  eventId?: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'amendment',
    recipientEntityId: params.amendmentId,
    type: 'voting_session_started',
    title: 'Voting Session Started',
    message: `Voting has started for ${params.amendmentTitle}`,
    actionUrl: params.eventId ? `/event/${params.eventId}` : `/amendment/${params.amendmentId}`,
    relatedEntityType: 'amendment',
    relatedAmendmentId: params.amendmentId,
    relatedEventId: params.eventId,
  });
}

/**
 * Send notification when a voting session completes
 */
export async function notifyVotingSessionCompleted(params: {
  senderId: string;
  amendmentId: string;
  amendmentTitle: string;
  eventId?: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'amendment',
    recipientEntityId: params.amendmentId,
    type: 'voting_session_completed',
    title: 'Voting Session Completed',
    message: `Voting has completed for ${params.amendmentTitle}`,
    actionUrl: params.eventId ? `/event/${params.eventId}` : `/amendment/${params.amendmentId}`,
    relatedEntityType: 'amendment',
    relatedAmendmentId: params.amendmentId,
    relatedEventId: params.eventId,
  });
}

/**
 * Send notification when a support vote is cast
 */
export async function notifyAmendmentVoted(params: {
  senderId: string;
  senderName: string;
  recipientUserId: string;
  amendmentId: string;
  amendmentTitle: string;
  voteType: 'upvote' | 'downvote';
}) {
  return createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'amendment',
    onBehalfOfEntityId: params.amendmentId,
    type: 'amendment_vote_cast',
    title: params.voteType === 'upvote' ? 'Amendment Upvoted' : 'Amendment Downvoted',
    message: `${params.senderName} has ${params.voteType}d ${params.amendmentTitle}`,
    actionUrl: `/amendment/${params.amendmentId}`,
    relatedEntityType: 'amendment',
    relatedAmendmentId: params.amendmentId,
  });
}

/**
 * Send notification when a new subscriber joins the amendment
 */
export async function notifyAmendmentNewSubscriber(params: {
  senderId: string;
  senderName: string;
  amendmentId: string;
  amendmentTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'amendment',
    recipientEntityId: params.amendmentId,
    type: 'amendment_new_subscriber',
    title: 'New Subscriber',
    message: `${params.senderName} has subscribed to ${params.amendmentTitle}`,
    actionUrl: `/amendment/${params.amendmentId}`,
    relatedEntityType: 'amendment',
    relatedAmendmentId: params.amendmentId,
    relatedUserId: params.senderId,
  });
}

// ============================================================================
// BLOG NOTIFICATIONS
// ============================================================================

function buildBlogUrl(blogId: string, groupId?: string, ownerId?: string, suffix = ''): string {
  if (groupId) return `/group/${groupId}/blog/${blogId}${suffix}`;
  if (ownerId) return `/user/${ownerId}/blog/${blogId}${suffix}`;
  return `/blog/${blogId}${suffix}`;
}

/**
 * Send notification when a new subscriber joins the blog
 */
export async function notifyBlogNewSubscriber(params: {
  senderId: string;
  senderName: string;
  blogId: string;
  blogTitle: string;
  groupId?: string;
  ownerId?: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'blog',
    recipientEntityId: params.blogId,
    type: 'blog_new_subscriber',
    title: 'New Subscriber',
    message: `${params.senderName} has subscribed to ${params.blogTitle}`,
    actionUrl: buildBlogUrl(params.blogId, params.groupId, params.ownerId),
    relatedEntityType: 'blog',
    relatedBlogId: params.blogId,
    relatedUserId: params.senderId,
  });
}

/**
 * Send notification when a blog receives a vote
 */
export async function notifyBlogVoted(params: {
  senderId: string;
  senderName: string;
  recipientUserId?: string;
  blogId: string;
  blogTitle: string;
  voteType: 'upvote' | 'downvote';
  groupId?: string;
  ownerId?: string;
}) {
  if (params.recipientUserId && params.recipientUserId !== params.senderId) {
    await createNotification({
      senderId: params.senderId,
      recipientUserId: params.recipientUserId,
      onBehalfOfEntityType: 'blog',
      onBehalfOfEntityId: params.blogId,
      type: 'blog_vote_cast',
      title: params.voteType === 'upvote' ? 'Blog Upvoted' : 'Blog Downvoted',
      message: `${params.senderName} has ${params.voteType}d ${params.blogTitle}`,
      actionUrl: buildBlogUrl(params.blogId, params.groupId, params.ownerId),
      relatedEntityType: 'blog',
      relatedBlogId: params.blogId,
    });
  }

  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'blog',
    recipientEntityId: params.blogId,
    type: 'blog_vote_cast',
    title: params.voteType === 'upvote' ? 'Blog Upvoted' : 'Blog Downvoted',
    message: `${params.senderName} has ${params.voteType}d ${params.blogTitle}`,
    actionUrl: buildBlogUrl(params.blogId, params.groupId, params.ownerId),
    relatedEntityType: 'blog',
    relatedBlogId: params.blogId,
    relatedUserId: params.senderId,
  });
}

/**
 * Send notification when a writer joins the blog
 */
export async function notifyBloggerJoined(params: {
  senderId: string;
  senderName?: string;
  recipientUserId?: string;
  blogId: string;
  blogTitle: string;
  groupId?: string;
  ownerId?: string;
}) {
  if (params.recipientUserId) {
    await createNotification({
      senderId: params.senderId,
      recipientUserId: params.recipientUserId,
      onBehalfOfEntityType: 'blog',
      onBehalfOfEntityId: params.blogId,
      type: 'blog_writer_joined',
      title: 'Writer Approved',
      message: `You are now a writer for ${params.blogTitle}`,
      actionUrl: buildBlogUrl(params.blogId, params.groupId, params.ownerId),
      relatedEntityType: 'blog',
      relatedBlogId: params.blogId,
    });
  }

  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'blog',
    recipientEntityId: params.blogId,
    type: 'blog_writer_joined',
    title: 'Writer Joined',
    message: params.senderName
      ? `${params.senderName} has joined ${params.blogTitle} as a writer`
      : `A new writer has joined ${params.blogTitle}`,
    actionUrl: buildBlogUrl(params.blogId, params.groupId, params.ownerId),
    relatedEntityType: 'blog',
    relatedBlogId: params.blogId,
    relatedUserId: params.recipientUserId ?? params.senderId,
  });
}

/**
 * Send notification when a blogger's role is changed
 */
export async function notifyBloggerRoleChanged(params: {
  senderId: string;
  recipientUserId: string;
  blogId: string;
  blogTitle: string;
  newRole: string;
  groupId?: string;
  ownerId?: string;
}) {
  await createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'blog',
    onBehalfOfEntityId: params.blogId,
    type: 'blog_role_changed',
    title: 'Role Changed',
    message: `Your role in ${params.blogTitle} has been changed to ${params.newRole}`,
    actionUrl: buildBlogUrl(params.blogId, params.groupId, params.ownerId),
    relatedEntityType: 'blog',
    relatedBlogId: params.blogId,
  });

  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'blog',
    recipientEntityId: params.blogId,
    type: 'blog_role_changed',
    title: 'Role Changed',
    message: `A writer's role in ${params.blogTitle} has been changed to ${params.newRole}`,
    actionUrl: buildBlogUrl(params.blogId, params.groupId, params.ownerId, '/bloggers'),
    relatedEntityType: 'blog',
    relatedBlogId: params.blogId,
    relatedUserId: params.recipientUserId,
  });
}

/**
 * Send notification when a comment is added to a blog
 */
export async function notifyBlogCommentAdded(params: {
  senderId: string;
  senderName: string;
  blogId: string;
  blogTitle: string;
  groupId?: string;
  ownerId?: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'blog',
    recipientEntityId: params.blogId,
    type: 'blog_comment_added',
    title: 'New Comment',
    message: `${params.senderName} commented on ${params.blogTitle}`,
    actionUrl: buildBlogUrl(params.blogId, params.groupId, params.ownerId),
    relatedEntityType: 'blog',
    relatedBlogId: params.blogId,
    relatedUserId: params.senderId,
  });
}

/**
 * Send notification when a writer request is received
 */
export async function notifyBlogWriterRequest(params: {
  senderId: string;
  senderName: string;
  blogId: string;
  blogTitle: string;
  groupId?: string;
  ownerId?: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'blog',
    recipientEntityId: params.blogId,
    type: 'blog_writer_request',
    title: 'Writer Request',
    message: `${params.senderName} has requested to write for ${params.blogTitle}`,
    actionUrl: buildBlogUrl(params.blogId, params.groupId, params.ownerId),
    relatedEntityType: 'blog',
    relatedBlogId: params.blogId,
    relatedUserId: params.senderId,
  });
}

/**
 * Send notification when a user is invited to write for a blog
 */
export async function notifyBloggerInvited(params: {
  senderId: string;
  recipientUserId: string;
  blogId: string;
  blogTitle: string;
  groupId?: string;
  ownerId?: string;
}) {
  await createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'blog',
    onBehalfOfEntityId: params.blogId,
    type: 'blog_writer_invite',
    title: 'Writer Invitation',
    message: `You've been invited to write for ${params.blogTitle}`,
    actionUrl: buildBlogUrl(params.blogId, params.groupId, params.ownerId),
    relatedEntityType: 'blog',
    relatedBlogId: params.blogId,
  });

  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'blog',
    recipientEntityId: params.blogId,
    type: 'blog_writer_invite',
    title: 'Writer Invited',
    message: `A writer invitation has been sent for ${params.blogTitle}`,
    actionUrl: buildBlogUrl(params.blogId, params.groupId, params.ownerId, '/bloggers'),
    relatedEntityType: 'blog',
    relatedBlogId: params.blogId,
    relatedUserId: params.recipientUserId,
  });
}

/**
 * Send notification when a blogger is removed from a blog
 */
export async function notifyBloggerRemoved(params: {
  senderId: string;
  recipientUserId: string;
  blogId: string;
  blogTitle: string;
  groupId?: string;
  ownerId?: string;
}) {
  await createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'blog',
    onBehalfOfEntityId: params.blogId,
    type: 'blog_writer_removed',
    title: 'Removed from Blog',
    message: `You have been removed from ${params.blogTitle}`,
    actionUrl: buildBlogUrl(params.blogId, params.groupId, params.ownerId),
    relatedEntityType: 'blog',
    relatedBlogId: params.blogId,
  });

  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'blog',
    recipientEntityId: params.blogId,
    type: 'blog_writer_removed',
    title: 'Writer Removed',
    message: `A writer has been removed from ${params.blogTitle}`,
    actionUrl: buildBlogUrl(params.blogId, params.groupId, params.ownerId, '/bloggers'),
    relatedEntityType: 'blog',
    relatedBlogId: params.blogId,
    relatedUserId: params.recipientUserId,
  });
}

export async function notifyBlogWriterApproved(params: Parameters<typeof notifyBloggerJoined>[0]) {
  return notifyBloggerJoined(params);
}

export async function notifyBlogWriterRemoved(params: Parameters<typeof notifyBloggerRemoved>[0]) {
  return notifyBloggerRemoved(params);
}

/**
 * Send notification when a blog role is created
 */
export async function notifyBlogRoleCreated(params: {
  senderId: string;
  blogId: string;
  blogTitle: string;
  roleName: string;
  groupId?: string;
  ownerId?: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'blog',
    recipientEntityId: params.blogId,
    type: 'blog_role_created',
    title: 'New Role Created',
    message: `A new role "${params.roleName}" has been created in ${params.blogTitle}`,
    actionUrl: buildBlogUrl(params.blogId, params.groupId, params.ownerId, '/bloggers'),
    relatedEntityType: 'blog',
    relatedBlogId: params.blogId,
  });
}

/**
 * Send notification when a blog role is deleted
 */
export async function notifyBlogRoleDeleted(params: {
  senderId: string;
  blogId: string;
  blogTitle: string;
  roleName: string;
  groupId?: string;
  ownerId?: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'blog',
    recipientEntityId: params.blogId,
    type: 'blog_role_deleted',
    title: 'Role Deleted',
    message: `The role "${params.roleName}" has been deleted from ${params.blogTitle}`,
    actionUrl: buildBlogUrl(params.blogId, params.groupId, params.ownerId, '/bloggers'),
    relatedEntityType: 'blog',
    relatedBlogId: params.blogId,
  });
}

export async function notifyBlogRoleUpdated(params: {
  senderId: string;
  blogId: string;
  blogTitle: string;
  roleName: string;
  groupId?: string;
  ownerId?: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'blog',
    recipientEntityId: params.blogId,
    type: 'blog_role_changed',
    title: 'Role Updated',
    message: `The role "${params.roleName}" has been updated in ${params.blogTitle}`,
    actionUrl: buildBlogUrl(params.blogId, params.groupId, params.ownerId, '/bloggers'),
    relatedEntityType: 'blog',
    relatedBlogId: params.blogId,
  });
}

// ============================================================================
// TODO NOTIFICATIONS
// ============================================================================

/**
 * Send notification when a todo is assigned (standalone)
 */
export async function notifyStandaloneTodoAssigned(params: {
  senderId: string;
  recipientUserId: string;
  todoId: string;
  todoTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    type: 'todo_assigned',
    title: 'Task Assigned',
    message: `You have been assigned "${params.todoTitle}"`,
    actionUrl: `/todos`,
  });
}

/**
 * Send notification when a todo is completed
 */
export async function notifyTodoCompleted(params: {
  senderId: string;
  senderName: string;
  recipientUserId: string;
  todoTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    type: 'todo_completed',
    title: 'Task Completed',
    message: `${params.senderName} has completed "${params.todoTitle}"`,
    actionUrl: `/todos`,
  });
}

/**
 * Send notification when a standalone todo is deleted
 */
export async function notifyStandaloneTodoDeleted(params: {
  senderId: string;
  senderName: string;
  recipientUserId: string;
  todoTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    type: 'todo_deleted',
    title: 'Task Deleted',
    message: `${params.senderName} has deleted "${params.todoTitle}"`,
    actionUrl: `/todos`,
  });
}

/**
 * Send notification when a todo is due soon
 */
export async function notifyTodoDueSoon(params: {
  senderId: string;
  recipientUserId: string;
  todoTitle: string;
  dueIn: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    type: 'todo_due_soon',
    title: 'Task Due Soon',
    message: `"${params.todoTitle}" is due in ${params.dueIn}`,
    actionUrl: `/todos`,
  });
}

/**
 * Send notification when a todo is overdue
 */
export async function notifyTodoOverdue(params: {
  senderId: string;
  recipientUserId: string;
  todoTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    type: 'todo_overdue',
    title: 'Task Overdue',
    message: `"${params.todoTitle}" is overdue`,
    actionUrl: `/todos`,
  });
}

// ============================================================================
// USER/SOCIAL NOTIFICATIONS
// ============================================================================

/**
 * Send notification when a user gets a new follower
 */
export async function notifyNewFollower(params: {
  senderId: string;
  senderName: string;
  recipientUserId: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    type: 'new_follower',
    title: 'New Follower',
    message: `${params.senderName} started following you`,
    actionUrl: `/user/${params.senderId}`,
    relatedUserId: params.senderId,
  });
}

/**
 * Send notification when a direct message is received
 */
function buildMessagesConversationActionUrl(conversationId: string) {
  return `/messages?conversationId=${encodeURIComponent(conversationId)}`;
}

export async function notifyDirectMessage(params: {
  senderId: string;
  senderName: string;
  recipientUserId: string;
  conversationId: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    type: 'direct_message',
    title: 'New Message',
    message: `${params.senderName} sent you a message`,
    actionUrl: buildMessagesConversationActionUrl(params.conversationId),
    relatedUserId: params.senderId,
  });
}

/**
 * Send notification when a conversation request is received
 */
export async function notifyConversationRequest(params: {
  conversationId: string;
  senderId: string;
  senderName: string;
  recipientUserId: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    type: 'conversation_request',
    title: 'Conversation Request',
    message: `${params.senderName} wants to start a conversation with you`,
    actionUrl: buildMessagesConversationActionUrl(params.conversationId),
    relatedUserId: params.senderId,
  });
}

/**
 * Send notification when a conversation request is accepted
 */
export async function notifyConversationAccepted(params: {
  senderId: string;
  senderName: string;
  recipientUserId: string;
  conversationId: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    type: 'conversation_accepted',
    title: 'Conversation Accepted',
    message: `${params.senderName} accepted your conversation request`,
    actionUrl: buildMessagesConversationActionUrl(params.conversationId),
    relatedUserId: params.senderId,
  });
}

// ============================================================================
// USER RESPONSE NOTIFICATIONS (Phase 12.4)
// Notifications sent to entity admins/owners when users respond to invitations
// ============================================================================

// --- GROUP INVITATION RESPONSES ---

/**
 * Send notification to group when a user accepts an invitation
 */
export async function notifyGroupInvitationAccepted(params: {
  senderId: string;
  senderName: string;
  groupId: string;
  groupName: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'group',
    recipientEntityId: params.groupId,
    type: 'group_invitation_accepted',
    title: 'Invitation Accepted',
    message: `${params.senderName} has accepted the invitation to join ${params.groupName}`,
    actionUrl: `/group/${params.groupId}/memberships`,
    relatedEntityType: 'group',
    relatedGroupId: params.groupId,
    relatedUserId: params.senderId,
  });
}

/**
 * Send notification to group when a user declines an invitation
 */
export async function notifyGroupInvitationDeclined(params: {
  senderId: string;
  senderName: string;
  groupId: string;
  groupName: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'group',
    recipientEntityId: params.groupId,
    type: 'group_invitation_declined',
    title: 'Invitation Declined',
    message: `${params.senderName} has declined the invitation to join ${params.groupName}`,
    actionUrl: `/group/${params.groupId}/memberships`,
    relatedEntityType: 'group',
    relatedGroupId: params.groupId,
    relatedUserId: params.senderId,
  });
}

/**
 * Send notification to group when a user withdraws their membership request
 */
export async function notifyGroupRequestWithdrawn(params: {
  senderId: string;
  senderName: string;
  groupId: string;
  groupName: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'group',
    recipientEntityId: params.groupId,
    type: 'group_request_withdrawn',
    title: 'Request Withdrawn',
    message: `${params.senderName} has withdrawn their request to join ${params.groupName}`,
    actionUrl: `/group/${params.groupId}/memberships`,
    relatedEntityType: 'group',
    relatedGroupId: params.groupId,
    relatedUserId: params.senderId,
  });
}

// --- EVENT INVITATION RESPONSES ---

/**
 * Send notification to event when a user accepts an invitation
 */
export async function notifyEventInvitationAccepted(params: {
  senderId: string;
  senderName: string;
  eventId: string;
  eventTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'event',
    recipientEntityId: params.eventId,
    type: 'event_invitation_accepted',
    title: 'Invitation Accepted',
    message: `${params.senderName} has accepted the invitation to ${params.eventTitle}`,
    actionUrl: `/event/${params.eventId}/participants`,
    relatedEntityType: 'event',
    relatedEventId: params.eventId,
    relatedUserId: params.senderId,
  });
}

/**
 * Send notification to event when a user declines an invitation
 */
export async function notifyEventInvitationDeclined(params: {
  senderId: string;
  senderName: string;
  eventId: string;
  eventTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'event',
    recipientEntityId: params.eventId,
    type: 'event_invitation_declined',
    title: 'Invitation Declined',
    message: `${params.senderName} has declined the invitation to ${params.eventTitle}`,
    actionUrl: `/event/${params.eventId}/participants`,
    relatedEntityType: 'event',
    relatedEventId: params.eventId,
    relatedUserId: params.senderId,
  });
}

/**
 * Send notification to event when a user withdraws their participation request
 */
export async function notifyEventRequestWithdrawn(params: {
  senderId: string;
  senderName: string;
  eventId: string;
  eventTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'event',
    recipientEntityId: params.eventId,
    type: 'event_request_withdrawn',
    title: 'Request Withdrawn',
    message: `${params.senderName} has withdrawn their request to participate in ${params.eventTitle}`,
    actionUrl: `/event/${params.eventId}/participants`,
    relatedEntityType: 'event',
    relatedEventId: params.eventId,
    relatedUserId: params.senderId,
  });
}

// --- AMENDMENT COLLABORATION INVITATION RESPONSES ---

/**
 * Send notification to amendment when a user accepts a collaboration invitation
 */
export async function notifyCollaborationInvitationAccepted(params: {
  senderId: string;
  senderName: string;
  amendmentId: string;
  amendmentTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'amendment',
    recipientEntityId: params.amendmentId,
    type: 'collaboration_invitation_accepted',
    title: 'Invitation Accepted',
    message: `${params.senderName} has accepted the invitation to collaborate on ${params.amendmentTitle}`,
    actionUrl: `/amendment/${params.amendmentId}/collaborators`,
    relatedEntityType: 'amendment',
    relatedAmendmentId: params.amendmentId,
    relatedUserId: params.senderId,
  });
}

/**
 * Send notification to amendment when a user declines a collaboration invitation
 */
export async function notifyCollaborationInvitationDeclined(params: {
  senderId: string;
  senderName: string;
  amendmentId: string;
  amendmentTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'amendment',
    recipientEntityId: params.amendmentId,
    type: 'collaboration_invitation_declined',
    title: 'Invitation Declined',
    message: `${params.senderName} has declined the invitation to collaborate on ${params.amendmentTitle}`,
    actionUrl: `/amendment/${params.amendmentId}/collaborators`,
    relatedEntityType: 'amendment',
    relatedAmendmentId: params.amendmentId,
    relatedUserId: params.senderId,
  });
}

/**
 * Send notification to amendment when a user withdraws their collaboration request
 */
export async function notifyCollaborationRequestWithdrawn(params: {
  senderId: string;
  senderName: string;
  amendmentId: string;
  amendmentTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'amendment',
    recipientEntityId: params.amendmentId,
    type: 'collaboration_request_withdrawn',
    title: 'Request Withdrawn',
    message: `${params.senderName} has withdrawn their request to collaborate on ${params.amendmentTitle}`,
    actionUrl: `/amendment/${params.amendmentId}/collaborators`,
    relatedEntityType: 'amendment',
    relatedAmendmentId: params.amendmentId,
    relatedUserId: params.senderId,
  });
}

// --- BLOG INVITATION RESPONSES ---

/**
 * Send notification to blog when a user accepts an invitation to write
 */
export async function notifyBlogInvitationAccepted(params: {
  senderId: string;
  senderName: string;
  blogId: string;
  blogTitle: string;
  groupId?: string;
  ownerId?: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'blog',
    recipientEntityId: params.blogId,
    type: 'blog_invitation_accepted',
    title: 'Invitation Accepted',
    message: `${params.senderName} has accepted the invitation to write for ${params.blogTitle}`,
    actionUrl: buildBlogUrl(params.blogId, params.groupId, params.ownerId, '/bloggers'),
    relatedEntityType: 'blog',
    relatedBlogId: params.blogId,
    relatedUserId: params.senderId,
  });
}

/**
 * Send notification to blog when a user declines an invitation to write
 */
export async function notifyBlogInvitationDeclined(params: {
  senderId: string;
  senderName: string;
  blogId: string;
  blogTitle: string;
  groupId?: string;
  ownerId?: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'blog',
    recipientEntityId: params.blogId,
    type: 'blog_invitation_declined',
    title: 'Invitation Declined',
    message: `${params.senderName} has declined the invitation to write for ${params.blogTitle}`,
    actionUrl: buildBlogUrl(params.blogId, params.groupId, params.ownerId, '/bloggers'),
    relatedEntityType: 'blog',
    relatedBlogId: params.blogId,
    relatedUserId: params.senderId,
  });
}

/**
 * Send notification to blog when a user withdraws their writer request
 */
export async function notifyBlogRequestWithdrawn(params: {
  senderId: string;
  senderName: string;
  blogId: string;
  blogTitle: string;
  groupId?: string;
  ownerId?: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'blog',
    recipientEntityId: params.blogId,
    type: 'blog_request_withdrawn',
    title: 'Request Withdrawn',
    message: `${params.senderName} has withdrawn their request to write for ${params.blogTitle}`,
    actionUrl: buildBlogUrl(params.blogId, params.groupId, params.ownerId, '/bloggers'),
    relatedEntityType: 'blog',
    relatedBlogId: params.blogId,
    relatedUserId: params.senderId,
  });
}

/**
 * Send notification to blog when a writer leaves
 */
export async function notifyBlogWriterLeft(params: {
  senderId: string;
  senderName: string;
  blogId: string;
  blogTitle: string;
  groupId?: string;
  ownerId?: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'blog',
    recipientEntityId: params.blogId,
    type: 'blog_writer_left',
    title: 'Writer Left',
    message: `${params.senderName} has left ${params.blogTitle}`,
    actionUrl: buildBlogUrl(params.blogId, params.groupId, params.ownerId, '/bloggers'),
    relatedEntityType: 'blog',
    relatedBlogId: params.blogId,
    relatedUserId: params.senderId,
  });
}

// ============================================================================
// PROFILE UPDATE NOTIFICATIONS
// ============================================================================

/**
 * Send notification when an amendment's profile is updated
 */
export async function notifyAmendmentProfileUpdated(params: {
  senderId: string;
  amendmentId: string;
  amendmentTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'amendment',
    recipientEntityId: params.amendmentId,
    type: 'amendment_profile_updated',
    title: 'Amendment Updated',
    message: `${params.amendmentTitle} has been updated`,
    actionUrl: `/amendment/${params.amendmentId}`,
    relatedEntityType: 'amendment',
    relatedAmendmentId: params.amendmentId,
  });
}

/**
 * Send notification when an amendment's target group/event is set
 */
export async function notifyAmendmentTargetSet(params: {
  senderId: string;
  amendmentId: string;
  amendmentTitle: string;
  groupId?: string;
  groupName?: string;
  eventId?: string;
  eventTitle?: string;
}) {
  const target = params.eventTitle || params.groupName || 'unknown';
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'amendment',
    recipientEntityId: params.amendmentId,
    type: 'amendment_target_set',
    title: 'Target Set',
    message: `${params.amendmentTitle} has been targeted at ${target}`,
    actionUrl: `/amendment/${params.amendmentId}/process`,
    relatedEntityType: 'amendment',
    relatedAmendmentId: params.amendmentId,
    relatedGroupId: params.groupId,
    relatedEventId: params.eventId,
  });
}

/**
 * Send notification when an amendment is rejected at vote
 */
export async function notifyAmendmentRejected(params: {
  senderId: string;
  amendmentId: string;
  amendmentTitle: string;
  eventId?: string;
  eventTitle?: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'amendment',
    recipientEntityId: params.amendmentId,
    type: 'amendment_rejected',
    title: 'Amendment Rejected',
    message: `${params.amendmentTitle} has been rejected${params.eventTitle ? ` at ${params.eventTitle}` : ''}`,
    actionUrl: `/amendment/${params.amendmentId}`,
    relatedEntityType: 'amendment',
    relatedAmendmentId: params.amendmentId,
    relatedEventId: params.eventId,
  });
}

/**
 * Send notification when a blog is updated
 */
export async function notifyBlogUpdated(params: {
  senderId: string;
  blogId: string;
  blogTitle: string;
  groupId?: string;
  ownerId?: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'blog',
    recipientEntityId: params.blogId,
    type: 'blog_updated',
    title: 'Blog Updated',
    message: `${params.blogTitle} has been updated`,
    actionUrl: buildBlogUrl(params.blogId, params.groupId, params.ownerId),
    relatedEntityType: 'blog',
    relatedBlogId: params.blogId,
  });
}

/**
 * Send notification when a blog is deleted
 */
export async function notifyBlogDeleted(params: {
  senderId: string;
  blogId: string;
  blogTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'blog',
    recipientEntityId: params.blogId,
    type: 'blog_deleted',
    title: 'Blog Deleted',
    message: `${params.blogTitle} has been deleted`,
    relatedEntityType: 'blog',
    relatedBlogId: params.blogId,
  });
}

/**
 * Send notification when a blog is published or made public
 */
export async function notifyBlogPublished(params: {
  senderId: string;
  blogId: string;
  blogTitle: string;
  groupId?: string;
  ownerId?: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'blog',
    recipientEntityId: params.blogId,
    type: 'blog_published',
    title: 'Blog Published',
    message: `${params.blogTitle} has been published`,
    actionUrl: buildBlogUrl(params.blogId, params.groupId, params.ownerId),
    relatedEntityType: 'blog',
    relatedBlogId: params.blogId,
  });
}

/**
 * Send notification when a group's profile is updated
 */
export async function notifyGroupProfileUpdated(params: {
  senderId: string;
  groupId: string;
  groupName: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'group',
    recipientEntityId: params.groupId,
    type: 'group_profile_updated',
    title: 'Group Updated',
    message: `${params.groupName} has been updated`,
    actionUrl: `/group/${params.groupId}`,
    relatedEntityType: 'group',
    relatedGroupId: params.groupId,
  });
}

/**
 * Send notification when an event's profile is updated
 */
export async function notifyEventProfileUpdated(params: {
  senderId: string;
  eventId: string;
  eventTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'event',
    recipientEntityId: params.eventId,
    type: 'event_profile_updated',
    title: 'Event Updated',
    message: `${params.eventTitle} has been updated`,
    actionUrl: `/event/${params.eventId}`,
    relatedEntityType: 'event',
    relatedEventId: params.eventId,
  });
}

/**
 * Send notification when a new amendment is linked to a group
 */
export async function notifyGroupNewAmendment(params: {
  senderId: string;
  groupId: string;
  groupName: string;
  amendmentId: string;
  amendmentTitle: string;
}) {
  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'group',
    recipientEntityId: params.groupId,
    type: 'group_new_amendment',
    title: 'New Amendment',
    message: `A new amendment "${params.amendmentTitle}" has been linked to ${params.groupName}`,
    actionUrl: `/amendment/${params.amendmentId}`,
    relatedEntityType: 'amendment',
    relatedAmendmentId: params.amendmentId,
    relatedGroupId: params.groupId,
  });
}
