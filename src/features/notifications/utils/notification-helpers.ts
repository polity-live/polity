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
import { translate as translateText } from '@/features/shared/hooks/use-translation';

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

const ACTIVE_GROUP_MANAGER_STATUSES = new Set(['active', 'member', 'admin']);
const ACTIVE_GROUP_GUEST_MANAGER_STATUSES = new Set(['active']);
const ACTIVE_EVENT_PARTICIPANT_STATUSES = new Set(['active', 'confirmed', 'member', 'admin']);
const ACTIVE_AMENDMENT_COLLABORATOR_MANAGER_STATUSES = new Set([
  'active',
  'collaborator',
  'member',
  'admin',
]);
const RELATIONSHIP_APPROVAL_DEDUPE_WINDOW_MS = 60_000;

function buildGroupRelationshipManageUrl(groupId: string): string {
  return `/group/${groupId}/network?tab=manage-network`;
}

interface RelationshipActionRightLike {
  resource?: string | null;
  action?: string | null;
  group_id?: string | null;
  event_id?: string | null;
  amendment_id?: string | null;
}

interface RelationshipRoleLike {
  action_rights?: readonly RelationshipActionRightLike[] | null;
}

interface RelationshipRoleLinkLike {
  role?: RelationshipRoleLike | null;
}

interface RelationshipMembershipLike {
  user_id?: string | null;
  status?: string | null;
  membership_roles?: readonly RelationshipRoleLinkLike[] | null;
}

interface RelationshipGuestAccessLike {
  user_id?: string | null;
  status?: string | null;
  guest_roles?: readonly RelationshipRoleLinkLike[] | null;
}

interface EventParticipantAudienceLike {
  user_id?: string | null;
  status?: string | null;
  participant_roles?: readonly RelationshipRoleLinkLike[] | null;
}

interface AmendmentCollaboratorManagerLike {
  user_id?: string | null;
  status?: string | null;
  role?: RelationshipRoleLike | null;
}

export interface RelationshipManagerGroupLike {
  owner_id?: string | null;
  memberships?: readonly RelationshipMembershipLike[] | null;
  guest_accesses?: readonly RelationshipGuestAccessLike[] | null;
}

export interface EventParticipantManagerEventLike {
  creator_id?: string | null;
  participants?: readonly EventParticipantAudienceLike[] | null;
}

export interface AmendmentCollaboratorManagerAmendmentLike {
  created_by_id?: string | null;
  collaborators?: readonly AmendmentCollaboratorManagerLike[] | null;
}

function roleCanManageGroupRelationships(role: RelationshipRoleLike | null | undefined) {
  return (role?.action_rights ?? []).some(
    right => right.resource === 'groupRelationships' && right.action === 'manage'
  );
}

function roleCanManageGroupMemberships(role: RelationshipRoleLike | null | undefined) {
  return (role?.action_rights ?? []).some(
    right =>
      (right.resource === 'groups' || right.resource === 'groupMemberships') &&
      (right.action === 'manage' || right.action === 'manage_members')
  );
}

function roleCanManageEventParticipants(role: RelationshipRoleLike | null | undefined) {
  return (role?.action_rights ?? []).some(
    right =>
      right.resource === 'events' &&
      (right.action === 'manage' || right.action === 'manage_participants')
  );
}

function roleCanManageAmendmentCollaborators(role: RelationshipRoleLike | null | undefined) {
  return (role?.action_rights ?? []).some(
    right => right.resource === 'amendments' && right.action === 'manage'
  );
}

function roleCanManageProcessTaskEvents(
  role: RelationshipRoleLike | null | undefined,
  groupId: string
) {
  return (role?.action_rights ?? []).some(
    right =>
      right.resource === 'events' &&
      (right.action === 'manage' || right.action === 'manage_votes') &&
      right.group_id === groupId
  );
}

export function collectRelationshipManagerRecipientIds(
  group: RelationshipManagerGroupLike | null | undefined,
  senderId?: string | null
) {
  const recipients = new Set<string>();
  const addRecipient = (userId: string | null | undefined) => {
    if (userId && userId !== senderId) {
      recipients.add(userId);
    }
  };

  addRecipient(group?.owner_id);

  for (const membership of group?.memberships ?? []) {
    if (!ACTIVE_GROUP_MANAGER_STATUSES.has(membership.status ?? '')) {
      continue;
    }
    if (membership.membership_roles?.some(link => roleCanManageGroupRelationships(link.role))) {
      addRecipient(membership.user_id);
    }
  }

  for (const guestAccess of group?.guest_accesses ?? []) {
    if (!ACTIVE_GROUP_GUEST_MANAGER_STATUSES.has(guestAccess.status ?? '')) {
      continue;
    }
    if (guestAccess.guest_roles?.some(link => roleCanManageGroupRelationships(link.role))) {
      addRecipient(guestAccess.user_id);
    }
  }

  return [...recipients];
}

export function collectGroupMembershipManagerRecipientIds(
  group: RelationshipManagerGroupLike | null | undefined,
  senderId?: string | null
) {
  const recipients = new Set<string>();
  const addRecipient = (userId: string | null | undefined) => {
    if (userId && userId !== senderId) {
      recipients.add(userId);
    }
  };

  addRecipient(group?.owner_id);

  for (const membership of group?.memberships ?? []) {
    if (!ACTIVE_GROUP_MANAGER_STATUSES.has(membership.status ?? '')) {
      continue;
    }
    if (membership.membership_roles?.some(link => roleCanManageGroupMemberships(link.role))) {
      addRecipient(membership.user_id);
    }
  }

  for (const guestAccess of group?.guest_accesses ?? []) {
    if (!ACTIVE_GROUP_GUEST_MANAGER_STATUSES.has(guestAccess.status ?? '')) {
      continue;
    }
    if (guestAccess.guest_roles?.some(link => roleCanManageGroupMemberships(link.role))) {
      addRecipient(guestAccess.user_id);
    }
  }

  return [...recipients];
}

export function collectEventParticipantManagerRecipientIds(
  event: EventParticipantManagerEventLike | null | undefined,
  senderId?: string | null
) {
  const recipients = new Set<string>();
  const addRecipient = (userId: string | null | undefined) => {
    if (userId && userId !== senderId) {
      recipients.add(userId);
    }
  };

  addRecipient(event?.creator_id);

  for (const participant of event?.participants ?? []) {
    if (!ACTIVE_EVENT_PARTICIPANT_STATUSES.has(participant.status ?? '')) {
      continue;
    }
    if (participant.participant_roles?.some(link => roleCanManageEventParticipants(link.role))) {
      addRecipient(participant.user_id);
    }
  }

  return [...recipients];
}

export function collectAmendmentCollaboratorManagerRecipientIds(
  amendment: AmendmentCollaboratorManagerAmendmentLike | null | undefined,
  senderId?: string | null
) {
  const recipients = new Set<string>();
  const addRecipient = (userId: string | null | undefined) => {
    if (userId && userId !== senderId) {
      recipients.add(userId);
    }
  };

  addRecipient(amendment?.created_by_id);

  for (const collaborator of amendment?.collaborators ?? []) {
    if (!ACTIVE_AMENDMENT_COLLABORATOR_MANAGER_STATUSES.has(collaborator.status ?? '')) {
      continue;
    }
    if (roleCanManageAmendmentCollaborators(collaborator.role)) {
      addRecipient(collaborator.user_id);
    }
  }

  return [...recipients];
}

export function collectProcessTaskEventManagerRecipientIds(
  group: RelationshipManagerGroupLike | null | undefined,
  groupId: string,
  senderId?: string | null
) {
  const recipients = new Set<string>();
  const addRecipient = (userId: string | null | undefined) => {
    if (userId && userId !== senderId) {
      recipients.add(userId);
    }
  };

  addRecipient(group?.owner_id);

  for (const membership of group?.memberships ?? []) {
    if (!ACTIVE_GROUP_MANAGER_STATUSES.has(membership.status ?? '')) {
      continue;
    }
    if (
      membership.membership_roles?.some(link => roleCanManageProcessTaskEvents(link.role, groupId))
    ) {
      addRecipient(membership.user_id);
    }
  }

  for (const guestAccess of group?.guest_accesses ?? []) {
    if (!ACTIVE_GROUP_GUEST_MANAGER_STATUSES.has(guestAccess.status ?? '')) {
      continue;
    }
    if (guestAccess.guest_roles?.some(link => roleCanManageProcessTaskEvents(link.role, groupId))) {
      addRecipient(guestAccess.user_id);
    }
  }

  return [...recipients];
}

export function collectEventParticipantRecipientIds(
  participants: readonly EventParticipantAudienceLike[] | null | undefined
) {
  const recipients = new Set<string>();

  for (const participant of participants ?? []) {
    if (participant.user_id && ACTIVE_EVENT_PARTICIPANT_STATUSES.has(participant.status ?? '')) {
      recipients.add(participant.user_id);
    }
  }

  return [...recipients];
}

export function collectGroupMemberRecipientIds(
  group: RelationshipManagerGroupLike | null | undefined
) {
  const recipients = new Set<string>();
  const addRecipient = (userId: string | null | undefined) => {
    if (userId) {
      recipients.add(userId);
    }
  };

  addRecipient(group?.owner_id);

  for (const membership of group?.memberships ?? []) {
    if (membership.user_id && ACTIVE_GROUP_MANAGER_STATUSES.has(membership.status ?? '')) {
      recipients.add(membership.user_id);
    }
  }

  return [...recipients];
}

async function loadGroupRelationshipManagerRecipientIds(groupId: string, senderId: string) {
  const supabase = getServerSupabase();
  const { data: group, error: groupError } = await supabase
    .from('group')
    .select('owner_id')
    .eq('id', groupId)
    .maybeSingle();

  if (groupError) {
    console.error(
      '[Notification] Failed to load group owner for relationship notification:',
      groupError
    );
  }

  const recipients = new Set(
    collectRelationshipManagerRecipientIds(
      { owner_id: (group as { owner_id?: string | null } | null)?.owner_id },
      senderId
    )
  );

  const { data: memberships, error: membershipsError } = await supabase
    .from('group_membership')
    .select('id, user_id, status')
    .eq('group_id', groupId)
    .in('status', [...ACTIVE_GROUP_MANAGER_STATUSES]);

  if (membershipsError) {
    console.error(
      '[Notification] Failed to load group memberships for relationship notification:',
      membershipsError
    );
  }

  const membershipRows = (memberships ?? []) as {
    id: string;
    user_id?: string | null;
    status?: string | null;
  }[];
  const membershipIds = membershipRows.map(membership => membership.id);
  if (membershipIds.length > 0) {
    const { data: roleLinks, error: roleLinksError } = await supabase
      .from('group_membership_role')
      .select('group_membership_id, role_id')
      .in('group_membership_id', membershipIds);

    if (roleLinksError) {
      console.error(
        '[Notification] Failed to load membership roles for relationship notification:',
        roleLinksError
      );
    }

    const links = (roleLinks ?? []) as {
      group_membership_id: string;
      role_id?: string | null;
    }[];
    const managingRoleIds = await loadManagingRelationshipRoleIds(
      links.map(link => link.role_id).filter((roleId): roleId is string => Boolean(roleId))
    );
    const membershipsById = new Map(membershipRows.map(membership => [membership.id, membership]));
    for (const link of links) {
      if (link.role_id && managingRoleIds.has(link.role_id)) {
        const userId = membershipsById.get(link.group_membership_id)?.user_id;
        if (userId && userId !== senderId) {
          recipients.add(userId);
        }
      }
    }
  }

  const { data: guestAccesses, error: guestAccessesError } = await supabase
    .from('group_guest_access')
    .select('id, user_id, status')
    .eq('group_id', groupId)
    .in('status', [...ACTIVE_GROUP_GUEST_MANAGER_STATUSES]);

  if (guestAccessesError) {
    console.error(
      '[Notification] Failed to load group guests for relationship notification:',
      guestAccessesError
    );
  }

  const guestRows = (guestAccesses ?? []) as {
    id: string;
    user_id?: string | null;
    status?: string | null;
  }[];
  const guestAccessIds = guestRows.map(guestAccess => guestAccess.id);
  if (guestAccessIds.length > 0) {
    const { data: guestRoleLinks, error: guestRoleLinksError } = await supabase
      .from('group_guest_role')
      .select('group_guest_access_id, role_id')
      .in('group_guest_access_id', guestAccessIds);

    if (guestRoleLinksError) {
      console.error(
        '[Notification] Failed to load guest roles for relationship notification:',
        guestRoleLinksError
      );
    }

    const links = (guestRoleLinks ?? []) as {
      group_guest_access_id: string;
      role_id?: string | null;
    }[];
    const managingRoleIds = await loadManagingRelationshipRoleIds(
      links.map(link => link.role_id).filter((roleId): roleId is string => Boolean(roleId))
    );
    const guestsById = new Map(guestRows.map(guestAccess => [guestAccess.id, guestAccess]));
    for (const link of links) {
      if (link.role_id && managingRoleIds.has(link.role_id)) {
        const userId = guestsById.get(link.group_guest_access_id)?.user_id;
        if (userId && userId !== senderId) {
          recipients.add(userId);
        }
      }
    }
  }

  return [...recipients];
}

function filterExcludedRecipientIds(
  recipientIds: readonly string[],
  excludeUserIds?: readonly string[]
) {
  if (!excludeUserIds?.length) {
    return [...recipientIds];
  }

  const excluded = new Set(excludeUserIds);
  return recipientIds.filter(userId => !excluded.has(userId));
}

async function loadGroupMembershipManagerRecipientIds(
  groupId: string,
  senderId: string,
  excludeUserIds?: readonly string[]
) {
  const supabase = getServerSupabase();
  const { data: group, error: groupError } = await supabase
    .from('group')
    .select('owner_id')
    .eq('id', groupId)
    .maybeSingle();

  if (groupError) {
    console.error(
      '[Notification] Failed to load group owner for manager notification:',
      groupError
    );
  }

  const recipients = new Set(
    collectGroupMembershipManagerRecipientIds(
      { owner_id: (group as { owner_id?: string | null } | null)?.owner_id },
      senderId
    )
  );

  const { data: memberships, error: membershipsError } = await supabase
    .from('group_membership')
    .select('id, user_id, status')
    .eq('group_id', groupId)
    .in('status', [...ACTIVE_GROUP_MANAGER_STATUSES]);

  if (membershipsError) {
    console.error(
      '[Notification] Failed to load group memberships for manager notification:',
      membershipsError
    );
  }

  const membershipRows = (memberships ?? []) as {
    id: string;
    user_id?: string | null;
    status?: string | null;
  }[];
  const membershipIds = membershipRows.map(membership => membership.id);
  if (membershipIds.length > 0) {
    const { data: roleLinks, error: roleLinksError } = await supabase
      .from('group_membership_role')
      .select('group_membership_id, role_id')
      .in('group_membership_id', membershipIds);

    if (roleLinksError) {
      console.error(
        '[Notification] Failed to load membership roles for manager notification:',
        roleLinksError
      );
    }

    const links = (roleLinks ?? []) as {
      group_membership_id: string;
      role_id?: string | null;
    }[];
    const managingRoleIds = await loadGroupMembershipManagerRoleIds(
      links.map(link => link.role_id).filter((roleId): roleId is string => Boolean(roleId)),
      groupId
    );
    const membershipsById = new Map(membershipRows.map(membership => [membership.id, membership]));
    for (const link of links) {
      if (link.role_id && managingRoleIds.has(link.role_id)) {
        const userId = membershipsById.get(link.group_membership_id)?.user_id;
        if (userId && userId !== senderId) {
          recipients.add(userId);
        }
      }
    }
  }

  const { data: guestAccesses, error: guestAccessesError } = await supabase
    .from('group_guest_access')
    .select('id, user_id, status')
    .eq('group_id', groupId)
    .in('status', [...ACTIVE_GROUP_GUEST_MANAGER_STATUSES]);

  if (guestAccessesError) {
    console.error(
      '[Notification] Failed to load group guests for manager notification:',
      guestAccessesError
    );
  }

  const guestRows = (guestAccesses ?? []) as {
    id: string;
    user_id?: string | null;
    status?: string | null;
  }[];
  const guestAccessIds = guestRows.map(guestAccess => guestAccess.id);
  if (guestAccessIds.length > 0) {
    const { data: guestRoleLinks, error: guestRoleLinksError } = await supabase
      .from('group_guest_role')
      .select('group_guest_access_id, role_id')
      .in('group_guest_access_id', guestAccessIds);

    if (guestRoleLinksError) {
      console.error(
        '[Notification] Failed to load guest roles for manager notification:',
        guestRoleLinksError
      );
    }

    const links = (guestRoleLinks ?? []) as {
      group_guest_access_id: string;
      role_id?: string | null;
    }[];
    const managingRoleIds = await loadGroupMembershipManagerRoleIds(
      links.map(link => link.role_id).filter((roleId): roleId is string => Boolean(roleId)),
      groupId
    );
    const guestsById = new Map(guestRows.map(guestAccess => [guestAccess.id, guestAccess]));
    for (const link of links) {
      if (link.role_id && managingRoleIds.has(link.role_id)) {
        const userId = guestsById.get(link.group_guest_access_id)?.user_id;
        if (userId && userId !== senderId) {
          recipients.add(userId);
        }
      }
    }
  }

  return filterExcludedRecipientIds([...recipients], excludeUserIds);
}

async function loadEventParticipantManagerRecipientIds(
  eventId: string,
  senderId: string,
  excludeUserIds?: readonly string[]
) {
  const supabase = getServerSupabase();
  const { data: event, error: eventError } = await supabase
    .from('event')
    .select('creator_id')
    .eq('id', eventId)
    .maybeSingle();

  if (eventError) {
    console.error(
      '[Notification] Failed to load event creator for manager notification:',
      eventError
    );
  }

  const recipients = new Set(
    collectEventParticipantManagerRecipientIds(
      { creator_id: (event as { creator_id?: string | null } | null)?.creator_id },
      senderId
    )
  );

  const { data: participants, error: participantsError } = await supabase
    .from('event_participant')
    .select('id, user_id, status')
    .eq('event_id', eventId)
    .in('status', [...ACTIVE_EVENT_PARTICIPANT_STATUSES]);

  if (participantsError) {
    console.error(
      '[Notification] Failed to load event participants for manager notification:',
      participantsError
    );
  }

  const participantRows = (participants ?? []) as {
    id: string;
    user_id?: string | null;
    status?: string | null;
  }[];
  const participantIds = participantRows.map(participant => participant.id);
  if (participantIds.length > 0) {
    const { data: roleLinks, error: roleLinksError } = await supabase
      .from('event_participant_role')
      .select('event_participant_id, role_id')
      .in('event_participant_id', participantIds);

    if (roleLinksError) {
      console.error(
        '[Notification] Failed to load participant roles for manager notification:',
        roleLinksError
      );
    }

    const links = (roleLinks ?? []) as {
      event_participant_id: string;
      role_id?: string | null;
    }[];
    const managingRoleIds = await loadEventParticipantManagerRoleIds(
      links.map(link => link.role_id).filter((roleId): roleId is string => Boolean(roleId)),
      eventId
    );
    const participantsById = new Map(
      participantRows.map(participant => [participant.id, participant])
    );
    for (const link of links) {
      if (link.role_id && managingRoleIds.has(link.role_id)) {
        const userId = participantsById.get(link.event_participant_id)?.user_id;
        if (userId && userId !== senderId) {
          recipients.add(userId);
        }
      }
    }
  }

  return filterExcludedRecipientIds([...recipients], excludeUserIds);
}

async function loadAmendmentCollaboratorManagerRecipientIds(
  amendmentId: string,
  senderId: string,
  excludeUserIds?: readonly string[]
) {
  const supabase = getServerSupabase();
  const { data: amendment, error: amendmentError } = await supabase
    .from('amendment')
    .select('created_by_id')
    .eq('id', amendmentId)
    .maybeSingle();

  if (amendmentError) {
    console.error(
      '[Notification] Failed to load amendment author for manager notification:',
      amendmentError
    );
  }

  const recipients = new Set(
    collectAmendmentCollaboratorManagerRecipientIds(
      { created_by_id: (amendment as { created_by_id?: string | null } | null)?.created_by_id },
      senderId
    )
  );

  const { data: collaborators, error: collaboratorsError } = await supabase
    .from('amendment_collaborator')
    .select('user_id, status, role_id')
    .eq('amendment_id', amendmentId)
    .in('status', [...ACTIVE_AMENDMENT_COLLABORATOR_MANAGER_STATUSES]);

  if (collaboratorsError) {
    console.error(
      '[Notification] Failed to load amendment collaborators for manager notification:',
      collaboratorsError
    );
  }

  const collaboratorRows = (collaborators ?? []) as {
    user_id?: string | null;
    status?: string | null;
    role_id?: string | null;
  }[];
  const managingRoleIds = await loadAmendmentCollaboratorManagerRoleIds(
    collaboratorRows
      .map(collaborator => collaborator.role_id)
      .filter((roleId): roleId is string => Boolean(roleId)),
    amendmentId
  );

  for (const collaborator of collaboratorRows) {
    if (
      collaborator.user_id &&
      collaborator.user_id !== senderId &&
      collaborator.role_id &&
      managingRoleIds.has(collaborator.role_id)
    ) {
      recipients.add(collaborator.user_id);
    }
  }

  return filterExcludedRecipientIds([...recipients], excludeUserIds);
}

async function loadProcessTaskEventManagerRecipientIds(groupId: string, senderId: string) {
  const supabase = getServerSupabase();
  const { data: group, error: groupError } = await supabase
    .from('group')
    .select('owner_id')
    .eq('id', groupId)
    .maybeSingle();

  if (groupError) {
    console.error(
      '[Notification] Failed to load group owner for process task notification:',
      groupError
    );
  }

  const recipients = new Set(
    collectProcessTaskEventManagerRecipientIds(
      { owner_id: (group as { owner_id?: string | null } | null)?.owner_id },
      groupId,
      senderId
    )
  );

  const { data: memberships, error: membershipsError } = await supabase
    .from('group_membership')
    .select('id, user_id, status')
    .eq('group_id', groupId)
    .in('status', [...ACTIVE_GROUP_MANAGER_STATUSES]);

  if (membershipsError) {
    console.error(
      '[Notification] Failed to load group memberships for process task notification:',
      membershipsError
    );
  }

  const membershipRows = (memberships ?? []) as {
    id: string;
    user_id?: string | null;
    status?: string | null;
  }[];
  const membershipIds = membershipRows.map(membership => membership.id);
  if (membershipIds.length > 0) {
    const { data: roleLinks, error: roleLinksError } = await supabase
      .from('group_membership_role')
      .select('group_membership_id, role_id')
      .in('group_membership_id', membershipIds);

    if (roleLinksError) {
      console.error(
        '[Notification] Failed to load membership roles for process task notification:',
        roleLinksError
      );
    }

    const links = (roleLinks ?? []) as {
      group_membership_id: string;
      role_id?: string | null;
    }[];
    const managingRoleIds = await loadProcessTaskEventManagerRoleIds(
      links.map(link => link.role_id).filter((roleId): roleId is string => Boolean(roleId)),
      groupId
    );
    const membershipsById = new Map(membershipRows.map(membership => [membership.id, membership]));
    for (const link of links) {
      if (link.role_id && managingRoleIds.has(link.role_id)) {
        const userId = membershipsById.get(link.group_membership_id)?.user_id;
        if (userId && userId !== senderId) {
          recipients.add(userId);
        }
      }
    }
  }

  const { data: guestAccesses, error: guestAccessesError } = await supabase
    .from('group_guest_access')
    .select('id, user_id, status')
    .eq('group_id', groupId)
    .in('status', [...ACTIVE_GROUP_GUEST_MANAGER_STATUSES]);

  if (guestAccessesError) {
    console.error(
      '[Notification] Failed to load group guests for process task notification:',
      guestAccessesError
    );
  }

  const guestRows = (guestAccesses ?? []) as {
    id: string;
    user_id?: string | null;
    status?: string | null;
  }[];
  const guestAccessIds = guestRows.map(guestAccess => guestAccess.id);
  if (guestAccessIds.length > 0) {
    const { data: guestRoleLinks, error: guestRoleLinksError } = await supabase
      .from('group_guest_role')
      .select('group_guest_access_id, role_id')
      .in('group_guest_access_id', guestAccessIds);

    if (guestRoleLinksError) {
      console.error(
        '[Notification] Failed to load guest roles for process task notification:',
        guestRoleLinksError
      );
    }

    const links = (guestRoleLinks ?? []) as {
      group_guest_access_id: string;
      role_id?: string | null;
    }[];
    const managingRoleIds = await loadProcessTaskEventManagerRoleIds(
      links.map(link => link.role_id).filter((roleId): roleId is string => Boolean(roleId)),
      groupId
    );
    const guestsById = new Map(guestRows.map(guestAccess => [guestAccess.id, guestAccess]));
    for (const link of links) {
      if (link.role_id && managingRoleIds.has(link.role_id)) {
        const userId = guestsById.get(link.group_guest_access_id)?.user_id;
        if (userId && userId !== senderId) {
          recipients.add(userId);
        }
      }
    }
  }

  return [...recipients];
}

async function loadEventParticipantRecipientIds(eventId: string) {
  const { data, error } = await getServerSupabase()
    .from('event_participant')
    .select('user_id, status')
    .eq('event_id', eventId)
    .in('status', [...ACTIVE_EVENT_PARTICIPANT_STATUSES]);

  if (error) {
    console.error('[Notification] Failed to load event participants for notification:', error);
    return [];
  }

  return collectEventParticipantRecipientIds(
    (data ?? []) as { user_id?: string | null; status?: string | null }[]
  );
}

async function loadGroupMemberRecipientIds(groupId: string) {
  const supabase = getServerSupabase();
  const { data: group, error: groupError } = await supabase
    .from('group')
    .select('owner_id')
    .eq('id', groupId)
    .maybeSingle();

  if (groupError) {
    console.error('[Notification] Failed to load group owner for member notification:', groupError);
  }

  const { data: memberships, error: membershipsError } = await supabase
    .from('group_membership')
    .select('user_id, status')
    .eq('group_id', groupId)
    .in('status', [...ACTIVE_GROUP_MANAGER_STATUSES]);

  if (membershipsError) {
    console.error(
      '[Notification] Failed to load group memberships for member notification:',
      membershipsError
    );
  }

  return collectGroupMemberRecipientIds({
    owner_id: (group as { owner_id?: string | null } | null)?.owner_id,
    memberships: (memberships ?? []) as {
      user_id?: string | null;
      status?: string | null;
    }[],
  });
}

async function loadManagingRelationshipRoleIds(roleIds: readonly string[]) {
  const uniqueRoleIds = [...new Set(roleIds)];
  if (uniqueRoleIds.length === 0) {
    return new Set<string>();
  }

  const { data, error } = await getServerSupabase()
    .from('action_right')
    .select('role_id')
    .in('role_id', uniqueRoleIds)
    .eq('resource', 'groupRelationships')
    .eq('action', 'manage');

  if (error) {
    console.error(
      '[Notification] Failed to load relationship action rights for notification recipients:',
      error
    );
    return new Set<string>();
  }

  return new Set(
    ((data ?? []) as { role_id?: string | null }[])
      .map(row => row.role_id)
      .filter((roleId): roleId is string => Boolean(roleId))
  );
}

async function loadGroupMembershipManagerRoleIds(roleIds: readonly string[], groupId: string) {
  const uniqueRoleIds = [...new Set(roleIds)];
  if (uniqueRoleIds.length === 0) {
    return new Set<string>();
  }

  const { data, error } = await getServerSupabase()
    .from('action_right')
    .select('role_id')
    .in('role_id', uniqueRoleIds)
    .eq('group_id', groupId)
    .in('resource', ['groups', 'groupMemberships'])
    .in('action', ['manage', 'manage_members']);

  if (error) {
    console.error(
      '[Notification] Failed to load group manager action rights for notification recipients:',
      error
    );
    return new Set<string>();
  }

  return new Set(
    ((data ?? []) as { role_id?: string | null }[])
      .map(row => row.role_id)
      .filter((roleId): roleId is string => Boolean(roleId))
  );
}

async function loadEventParticipantManagerRoleIds(roleIds: readonly string[], eventId: string) {
  const uniqueRoleIds = [...new Set(roleIds)];
  if (uniqueRoleIds.length === 0) {
    return new Set<string>();
  }

  const { data, error } = await getServerSupabase()
    .from('action_right')
    .select('role_id')
    .in('role_id', uniqueRoleIds)
    .eq('event_id', eventId)
    .eq('resource', 'events')
    .in('action', ['manage', 'manage_participants']);

  if (error) {
    console.error(
      '[Notification] Failed to load event manager action rights for notification recipients:',
      error
    );
    return new Set<string>();
  }

  return new Set(
    ((data ?? []) as { role_id?: string | null }[])
      .map(row => row.role_id)
      .filter((roleId): roleId is string => Boolean(roleId))
  );
}

async function loadAmendmentCollaboratorManagerRoleIds(
  roleIds: readonly string[],
  amendmentId: string
) {
  const uniqueRoleIds = [...new Set(roleIds)];
  if (uniqueRoleIds.length === 0) {
    return new Set<string>();
  }

  const { data, error } = await getServerSupabase()
    .from('action_right')
    .select('role_id')
    .in('role_id', uniqueRoleIds)
    .eq('amendment_id', amendmentId)
    .eq('resource', 'amendments')
    .eq('action', 'manage');

  if (error) {
    console.error(
      '[Notification] Failed to load amendment manager action rights for notification recipients:',
      error
    );
    return new Set<string>();
  }

  return new Set(
    ((data ?? []) as { role_id?: string | null }[])
      .map(row => row.role_id)
      .filter((roleId): roleId is string => Boolean(roleId))
  );
}

async function loadProcessTaskEventManagerRoleIds(roleIds: readonly string[], groupId: string) {
  const uniqueRoleIds = [...new Set(roleIds)];
  if (uniqueRoleIds.length === 0) {
    return new Set<string>();
  }

  const { data, error } = await getServerSupabase()
    .from('action_right')
    .select('role_id')
    .in('role_id', uniqueRoleIds)
    .eq('group_id', groupId)
    .eq('resource', 'events')
    .in('action', ['manage', 'manage_votes']);

  if (error) {
    console.error(
      '[Notification] Failed to load process task event action rights for notification recipients:',
      error
    );
    return new Set<string>();
  }

  return new Set(
    ((data ?? []) as { role_id?: string | null }[])
      .map(row => row.role_id)
      .filter((roleId): roleId is string => Boolean(roleId))
  );
}

function applyNullableFilter(query: any, column: string, value: string | null | undefined) {
  return value ? query.eq(column, value) : query.is(column, null);
}

async function findRecentRelationshipNotification(
  config: NotificationConfig,
  dedupeWindowMs: number
) {
  const cutoff = new Date(Date.now() - dedupeWindowMs).toISOString();
  let query = getServerSupabase()
    .from('notification')
    .select('id, recipient_entity_type')
    .eq('type', config.type)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(1);

  query = applyNullableFilter(query, 'action_url', config.actionUrl ?? null);
  query = applyNullableFilter(query, 'related_group_id', config.relatedGroupId ?? null);

  if (config.recipientUserId) {
    query = query.eq('recipient_id', config.recipientUserId).is('recipient_group_id', null);
  } else if (config.recipientEntityType === 'group' && config.recipientEntityId) {
    query = query
      .eq('recipient_entity_type', 'group')
      .eq('recipient_group_id', config.recipientEntityId);
  } else {
    return null;
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    console.error('[Notification] Failed to find recent relationship notification:', error);
    return null;
  }

  return (data as { id: string; recipient_entity_type?: string | null } | null) ?? null;
}

async function upsertServerRelationshipNotification(
  config: NotificationConfig,
  options?: { dedupeWindowMs?: number }
) {
  if (config.recipientUserId) {
    const settings = await getRecipientNotificationSettings(config.recipientUserId);
    if (!shouldDispatchNotification(config.type, settings)) {
      return null;
    }
  }

  const recent =
    options?.dedupeWindowMs != null
      ? await findRecentRelationshipNotification(config, options.dedupeWindowMs)
      : null;

  if (!recent) {
    return insertServerNotification(config, crypto.randomUUID());
  }

  const personalizedConfig = await personalizeNotificationConfig(config);
  const { error } = await getServerSupabase()
    .from('notification')
    .update({
      title: personalizedConfig.title,
      message: personalizedConfig.message,
      is_read: false,
      created_at: new Date().toISOString(),
    })
    .eq('id', recent.id);

  if (error) {
    console.error('[Notification] Failed to update relationship notification:', error);
    return false;
  }

  if (recent.recipient_entity_type) {
    const { error: readError } = await getServerSupabase()
      .from('notification_read')
      .delete()
      .eq('notification_id', recent.id);

    if (readError) {
      console.error(
        '[Notification] Failed to reset relationship notification read state:',
        readError
      );
    }
  }

  return true;
}

async function notifyRelationshipGroupAudience(
  config: NotificationConfig & {
    recipientEntityType: 'group';
    recipientEntityId: string;
  },
  options?: { dedupeWindowMs?: number }
) {
  await upsertServerRelationshipNotification(config, options);

  const recipientUserIds = await loadGroupRelationshipManagerRecipientIds(
    config.recipientEntityId,
    config.senderId
  );

  await Promise.all(
    recipientUserIds.map(recipientUserId =>
      upsertServerRelationshipNotification(
        {
          ...config,
          recipientUserId,
          recipientEntityType: undefined,
          recipientEntityId: undefined,
          onBehalfOfEntityType: config.onBehalfOfEntityType ?? 'group',
          onBehalfOfEntityId: config.onBehalfOfEntityId ?? config.recipientEntityId,
        },
        options
      )
    )
  );
}

async function notifyGroupMembershipManagerAudience(
  config: NotificationConfig & {
    recipientEntityType: 'group';
    recipientEntityId: string;
  },
  options?: { excludeUserIds?: readonly string[] }
) {
  const groupNotificationId = await createNotification(config);

  if (_clientDispatch) {
    return groupNotificationId;
  }

  const recipientUserIds = await loadGroupMembershipManagerRecipientIds(
    config.recipientEntityId,
    config.senderId,
    options?.excludeUserIds
  );

  await Promise.all(
    recipientUserIds.map(recipientUserId =>
      createNotification({
        ...config,
        recipientUserId,
        recipientEntityType: undefined,
        recipientEntityId: undefined,
        onBehalfOfEntityType: config.onBehalfOfEntityType ?? 'group',
        onBehalfOfEntityId: config.onBehalfOfEntityId ?? config.recipientEntityId,
      })
    )
  );

  return groupNotificationId;
}

async function notifyGroupMemberAudience(
  config: NotificationConfig & {
    recipientEntityType: 'group';
    recipientEntityId: string;
  }
) {
  const groupNotificationId = await createNotification(config);

  if (_clientDispatch) {
    return groupNotificationId;
  }

  const recipientUserIds = await loadGroupMemberRecipientIds(config.recipientEntityId);

  await Promise.all(
    recipientUserIds.map(recipientUserId =>
      createNotification({
        ...config,
        recipientUserId,
        recipientEntityType: undefined,
        recipientEntityId: undefined,
        onBehalfOfEntityType: config.onBehalfOfEntityType ?? 'group',
        onBehalfOfEntityId: config.onBehalfOfEntityId ?? config.recipientEntityId,
      })
    )
  );

  return groupNotificationId;
}

async function notifyEventManagerAudience(
  config: NotificationConfig & {
    recipientEntityType: 'event';
    recipientEntityId: string;
  },
  options?: { excludeUserIds?: readonly string[] }
) {
  const eventNotificationId = await createNotification(config);

  if (_clientDispatch) {
    return eventNotificationId;
  }

  const recipientUserIds = await loadEventParticipantManagerRecipientIds(
    config.recipientEntityId,
    config.senderId,
    options?.excludeUserIds
  );

  await Promise.all(
    recipientUserIds.map(recipientUserId =>
      createNotification({
        ...config,
        recipientUserId,
        recipientEntityType: undefined,
        recipientEntityId: undefined,
        onBehalfOfEntityType: config.onBehalfOfEntityType ?? 'event',
        onBehalfOfEntityId: config.onBehalfOfEntityId ?? config.recipientEntityId,
      })
    )
  );

  return eventNotificationId;
}

async function notifyAmendmentManagerAudience(
  config: NotificationConfig & {
    recipientEntityType: 'amendment';
    recipientEntityId: string;
  },
  options?: { excludeUserIds?: readonly string[] }
) {
  const amendmentNotificationId = await createNotification(config);

  if (_clientDispatch) {
    return amendmentNotificationId;
  }

  const recipientUserIds = await loadAmendmentCollaboratorManagerRecipientIds(
    config.recipientEntityId,
    config.senderId,
    options?.excludeUserIds
  );

  await Promise.all(
    recipientUserIds.map(recipientUserId =>
      createNotification({
        ...config,
        recipientUserId,
        recipientEntityType: undefined,
        recipientEntityId: undefined,
        onBehalfOfEntityType: config.onBehalfOfEntityType ?? 'amendment',
        onBehalfOfEntityId: config.onBehalfOfEntityId ?? config.recipientEntityId,
      })
    )
  );

  return amendmentNotificationId;
}

async function notifyEventParticipantAudience(
  config: NotificationConfig & {
    recipientEntityType: 'event';
    recipientEntityId: string;
  }
) {
  const eventNotificationId = await createNotification(config);

  if (_clientDispatch) {
    return eventNotificationId;
  }

  const recipientUserIds = await loadEventParticipantRecipientIds(config.recipientEntityId);

  await Promise.all(
    recipientUserIds.map(recipientUserId =>
      createNotification({
        ...config,
        recipientUserId,
        recipientEntityType: undefined,
        recipientEntityId: undefined,
        onBehalfOfEntityType: config.onBehalfOfEntityType ?? 'event',
        onBehalfOfEntityId: config.onBehalfOfEntityId ?? config.recipientEntityId,
      })
    )
  );

  return eventNotificationId;
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
  await createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'group',
    onBehalfOfEntityId: params.groupId,
    type: 'group_invite',
    title: translateText('generated.inline.0201_group_invitation_3afe15fe'),
    message: translateText('generated.inline.0202_you_ve_been_invited_to_join_groupname_c44a7ef2', {
      groupName: params.groupName,
    }),
    actionUrl: `/user/${params.recipientUserId}/memberships`,
    relatedEntityType: 'group',
    relatedGroupId: params.groupId,
  });

  return notifyGroupMembershipManagerAudience(
    {
      senderId: params.senderId,
      recipientEntityType: 'group',
      recipientEntityId: params.groupId,
      type: 'group_invite',
      title: translateText('generated.inline.0201_group_invitation_3afe15fe'),
      message: translateText(
        'generated.inline.0202_you_ve_been_invited_to_join_groupname_c44a7ef2',
        {
          groupName: params.groupName,
        }
      ),
      actionUrl: `/group/${params.groupId}/memberships`,
      relatedEntityType: 'group',
      relatedGroupId: params.groupId,
      relatedUserId: params.recipientUserId,
    },
    { excludeUserIds: [params.recipientUserId] }
  );
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
    title: translateText('generated.inline.0203_membership_approved_a127fbbf'),
    message: translateText(
      'generated.inline.0204_your_request_to_join_groupname_has_been_appro_8014ede6',
      { groupName: params.groupName }
    ),
    actionUrl: `/group/${params.groupId}`,
    relatedEntityType: 'group',
    relatedGroupId: params.groupId,
  });

  // Entity notification (action log) to the group and managers
  return notifyGroupMembershipManagerAudience(
    {
      senderId: params.senderId,
      recipientEntityType: 'group',
      recipientEntityId: params.groupId,
      type: 'membership_approved',
      title: translateText('generated.inline.0203_membership_approved_a127fbbf'),
      message: translateText(
        'generated.inline.0205_a_membership_request_in_groupname_has_been_ap_b9fe8010',
        { groupName: params.groupName }
      ),
      actionUrl: `/group/${params.groupId}/memberships`,
      relatedEntityType: 'group',
      relatedGroupId: params.groupId,
      relatedUserId: params.recipientUserId,
    },
    { excludeUserIds: [params.recipientUserId] }
  );
}

export async function notifyGuestAccessApproved(params: {
  senderId: string;
  recipientUserId: string;
  groupId: string;
  groupName: string;
}) {
  await createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'group',
    onBehalfOfEntityId: params.groupId,
    type: 'membership_approved',
    title: translateText('generated.inline.0203_membership_approved_a127fbbf'),
    message: translateText(
      'generated.inline.0204_your_request_to_join_groupname_has_been_appro_8014ede6',
      { groupName: params.groupName }
    ),
    actionUrl: `/group/${params.groupId}`,
    relatedEntityType: 'group',
    relatedGroupId: params.groupId,
  });

  return notifyGroupMembershipManagerAudience(
    {
      senderId: params.senderId,
      recipientEntityType: 'group',
      recipientEntityId: params.groupId,
      type: 'membership_approved',
      title: translateText('generated.inline.0203_membership_approved_a127fbbf'),
      message: `A guest access request in ${params.groupName} has been approved.`,
      actionUrl: `/group/${params.groupId}/memberships`,
      relatedEntityType: 'group',
      relatedGroupId: params.groupId,
      relatedUserId: params.recipientUserId,
    },
    { excludeUserIds: [params.recipientUserId] }
  );
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
    title: translateText('generated.inline.0206_membership_request_rejected_9fd79626'),
    message: translateText(
      'generated.inline.0207_your_request_to_join_groupname_has_been_rejec_27291915',
      { groupName: params.groupName }
    ),
    relatedEntityType: 'group',
    relatedGroupId: params.groupId,
  });

  // Entity notification (action log) to the group and managers
  return notifyGroupMembershipManagerAudience(
    {
      senderId: params.senderId,
      recipientEntityType: 'group',
      recipientEntityId: params.groupId,
      type: 'membership_rejected',
      title: translateText('generated.inline.0206_membership_request_rejected_9fd79626'),
      message: translateText(
        'generated.inline.0208_a_membership_request_in_groupname_has_been_re_a1c26341',
        { groupName: params.groupName }
      ),
      actionUrl: `/group/${params.groupId}/memberships`,
      relatedEntityType: 'group',
      relatedGroupId: params.groupId,
      relatedUserId: params.recipientUserId,
    },
    { excludeUserIds: [params.recipientUserId] }
  );
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
    title: translateText('generated.inline.0209_role_changed_08011f35'),
    message: translateText(
      'generated.inline.0210_your_role_in_groupname_has_been_changed_to_ne_ba73b7a5',
      { groupName: params.groupName, newRole: params.newRole }
    ),
    actionUrl: `/group/${params.groupId}`,
    relatedEntityType: 'group',
    relatedGroupId: params.groupId,
  });

  // Entity notification (action log) to the group and managers
  return notifyGroupMembershipManagerAudience(
    {
      senderId: params.senderId,
      recipientEntityType: 'group',
      recipientEntityId: params.groupId,
      type: 'membership_role_changed',
      title: translateText('generated.inline.0209_role_changed_08011f35'),
      message: translateText(
        'generated.inline.0211_a_member_s_role_in_groupname_has_been_changed_b027577f',
        { groupName: params.groupName }
      ),
      actionUrl: `/group/${params.groupId}/memberships`,
      relatedEntityType: 'group',
      relatedGroupId: params.groupId,
      relatedUserId: params.recipientUserId,
    },
    { excludeUserIds: [params.recipientUserId] }
  );
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
    title: translateText('generated.inline.0212_removed_from_group_b1e83b77'),
    message: translateText('generated.inline.0213_you_have_been_removed_from_groupname_e50d8fca', {
      groupName: params.groupName,
    }),
    relatedEntityType: 'group',
    relatedGroupId: params.groupId,
  });

  // Entity notification (action log) to the group and managers
  return notifyGroupMembershipManagerAudience(
    {
      senderId: params.senderId,
      recipientEntityType: 'group',
      recipientEntityId: params.groupId,
      type: 'member_removed',
      title: translateText('generated.inline.0214_member_removed_f9078b1f'),
      message: translateText(
        'generated.inline.0215_a_member_has_been_removed_from_groupname_7badeb49',
        { groupName: params.groupName }
      ),
      actionUrl: `/group/${params.groupId}/memberships`,
      relatedEntityType: 'group',
      relatedGroupId: params.groupId,
      relatedUserId: params.recipientUserId,
    },
    { excludeUserIds: [params.recipientUserId] }
  );
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
  return notifyGroupMembershipManagerAudience({
    senderId: params.senderId,
    recipientEntityType: 'group',
    recipientEntityId: params.groupId,
    type: 'membership_withdrawn',
    title: translateText('generated.inline.0216_member_left_group_1978def2'),
    message: translateText('generated.inline.0217_sendername_has_left_groupname_c75fe974', {
      senderName: params.senderName,
      groupName: params.groupName,
    }),
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
  return notifyGroupMembershipManagerAudience({
    senderId: params.senderId,
    recipientEntityType: 'group',
    recipientEntityId: params.groupId,
    type: 'membership_request',
    title: translateText('generated.inline.0218_membership_request_bbfcdecb'),
    message: translateText(
      'generated.inline.0219_sendername_has_requested_to_join_groupname_547b42e2',
      { senderName: params.senderName, groupName: params.groupName }
    ),
    actionUrl: `/group/${params.groupId}/memberships`,
    relatedEntityType: 'group',
    relatedGroupId: params.groupId,
    relatedUserId: params.senderId,
  });
}

export async function notifyGuestAccessRequest(params: {
  senderId: string;
  senderName: string;
  groupId: string;
  groupName: string;
}) {
  return notifyGroupMembershipManagerAudience({
    senderId: params.senderId,
    recipientEntityType: 'group',
    recipientEntityId: params.groupId,
    type: 'membership_request',
    title: translateText('generated.inline.0218_membership_request_bbfcdecb'),
    message: `${params.senderName} has requested guest access to ${params.groupName}.`,
    actionUrl: `/group/${params.groupId}/memberships`,
    relatedEntityType: 'group',
    relatedGroupId: params.groupId,
    relatedUserId: params.senderId,
  });
}

export async function notifyGuestAccessInvite(params: {
  senderId: string;
  recipientUserId: string;
  groupId: string;
  groupName: string;
}) {
  await createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'group',
    onBehalfOfEntityId: params.groupId,
    type: 'group_invite',
    title: translateText('generated.inline.0201_group_invitation_3afe15fe'),
    message: translateText('generated.inline.0202_you_ve_been_invited_to_join_groupname_c44a7ef2', {
      groupName: params.groupName,
    }),
    actionUrl: `/user/${params.recipientUserId}/memberships`,
    relatedEntityType: 'group',
    relatedGroupId: params.groupId,
  });

  return notifyGroupMembershipManagerAudience(
    {
      senderId: params.senderId,
      recipientEntityType: 'group',
      recipientEntityId: params.groupId,
      type: 'group_invite',
      title: translateText('generated.inline.0201_group_invitation_3afe15fe'),
      message: `A guest has been invited to ${params.groupName}.`,
      actionUrl: `/group/${params.groupId}/memberships`,
      relatedEntityType: 'group',
      relatedGroupId: params.groupId,
      relatedUserId: params.recipientUserId,
    },
    { excludeUserIds: [params.recipientUserId] }
  );
}

export async function notifyGuestAccessRoleChanged(params: {
  senderId: string;
  recipientUserId: string;
  groupId: string;
  groupName: string;
  newRole: string;
}) {
  await createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'group',
    onBehalfOfEntityId: params.groupId,
    type: 'membership_role_changed',
    title: translateText('generated.inline.0209_role_changed_08011f35'),
    message: translateText(
      'generated.inline.0210_your_role_in_groupname_has_been_changed_to_ne_ba73b7a5',
      {
        groupName: params.groupName,
        newRole: params.newRole,
      }
    ),
    actionUrl: `/group/${params.groupId}`,
    relatedEntityType: 'group',
    relatedGroupId: params.groupId,
  });

  return notifyGroupMembershipManagerAudience(
    {
      senderId: params.senderId,
      recipientEntityType: 'group',
      recipientEntityId: params.groupId,
      type: 'membership_role_changed',
      title: translateText('generated.inline.0209_role_changed_08011f35'),
      message: `A guest role in ${params.groupName} has been changed.`,
      actionUrl: `/group/${params.groupId}/memberships`,
      relatedEntityType: 'group',
      relatedGroupId: params.groupId,
      relatedUserId: params.recipientUserId,
    },
    { excludeUserIds: [params.recipientUserId] }
  );
}

export async function notifyGuestAccessRemoved(params: {
  senderId: string;
  recipientUserId: string;
  groupId: string;
  groupName: string;
}) {
  await createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'group',
    onBehalfOfEntityId: params.groupId,
    type: 'member_removed',
    title: translateText('generated.inline.0212_removed_from_group_b1e83b77'),
    message: translateText('generated.inline.0213_you_have_been_removed_from_groupname_e50d8fca', {
      groupName: params.groupName,
    }),
    relatedEntityType: 'group',
    relatedGroupId: params.groupId,
  });

  return notifyGroupMembershipManagerAudience(
    {
      senderId: params.senderId,
      recipientEntityType: 'group',
      recipientEntityId: params.groupId,
      type: 'member_removed',
      title: translateText('generated.inline.0214_member_removed_f9078b1f'),
      message: `A guest has been removed from ${params.groupName}.`,
      actionUrl: `/group/${params.groupId}/memberships`,
      relatedEntityType: 'group',
      relatedGroupId: params.groupId,
      relatedUserId: params.recipientUserId,
    },
    { excludeUserIds: [params.recipientUserId] }
  );
}

export async function notifyGuestAccessWithdrawn(params: {
  senderId: string;
  senderName: string;
  groupId: string;
  groupName: string;
}) {
  return notifyGroupMembershipManagerAudience({
    senderId: params.senderId,
    recipientEntityType: 'group',
    recipientEntityId: params.groupId,
    type: 'membership_withdrawn',
    title: translateText('generated.inline.0216_member_left_group_1978def2'),
    message: `${params.senderName} has left guest access to ${params.groupName}.`,
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
  await createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'event',
    onBehalfOfEntityId: params.eventId,
    type: 'event_invite',
    title: translateText('generated.inline.0220_event_invitation_1bdc1b8f'),
    message: translateText('generated.inline.0221_you_ve_been_invited_to_eventtitle_ab9cba01', {
      eventTitle: params.eventTitle,
    }),
    actionUrl: `/user/${params.recipientUserId}/memberships`,
    relatedEntityType: 'event',
    relatedEventId: params.eventId,
  });

  return notifyEventManagerAudience(
    {
      senderId: params.senderId,
      recipientEntityType: 'event',
      recipientEntityId: params.eventId,
      type: 'event_invite',
      title: translateText('generated.inline.0220_event_invitation_1bdc1b8f'),
      message: translateText('generated.inline.0221_you_ve_been_invited_to_eventtitle_ab9cba01', {
        eventTitle: params.eventTitle,
      }),
      actionUrl: `/event/${params.eventId}/participants`,
      relatedEntityType: 'event',
      relatedEventId: params.eventId,
      relatedUserId: params.recipientUserId,
    },
    { excludeUserIds: [params.recipientUserId] }
  );
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
  await createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'event',
    onBehalfOfEntityId: params.eventId,
    type: 'participation_approved',
    title: translateText('generated.inline.0222_participation_approved_a6a048de'),
    message: translateText(
      'generated.inline.0223_your_request_to_participate_in_eventtitle_has_d76fd204',
      { eventTitle: params.eventTitle }
    ),
    actionUrl: `/event/${params.eventId}`,
    relatedEntityType: 'event',
    relatedEventId: params.eventId,
  });

  return notifyEventManagerAudience(
    {
      senderId: params.senderId,
      recipientEntityType: 'event',
      recipientEntityId: params.eventId,
      type: 'participation_approved',
      title: translateText('generated.inline.0222_participation_approved_a6a048de'),
      message: `A participation request in ${params.eventTitle} has been approved.`,
      actionUrl: `/event/${params.eventId}/participants`,
      relatedEntityType: 'event',
      relatedEventId: params.eventId,
      relatedUserId: params.recipientUserId,
    },
    { excludeUserIds: [params.recipientUserId] }
  );
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
  await createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'event',
    onBehalfOfEntityId: params.eventId,
    type: 'participation_rejected',
    title: translateText('generated.inline.0224_participation_request_rejected_7db189bc'),
    message: translateText(
      'generated.inline.0225_your_request_to_participate_in_eventtitle_has_8b2be205',
      { eventTitle: params.eventTitle }
    ),
    relatedEntityType: 'event',
    relatedEventId: params.eventId,
  });

  return notifyEventManagerAudience(
    {
      senderId: params.senderId,
      recipientEntityType: 'event',
      recipientEntityId: params.eventId,
      type: 'participation_rejected',
      title: translateText('generated.inline.0224_participation_request_rejected_7db189bc'),
      message: `A participation request in ${params.eventTitle} has been rejected.`,
      actionUrl: `/event/${params.eventId}/participants`,
      relatedEntityType: 'event',
      relatedEventId: params.eventId,
      relatedUserId: params.recipientUserId,
    },
    { excludeUserIds: [params.recipientUserId] }
  );
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
  await createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'event',
    onBehalfOfEntityId: params.eventId,
    type: 'participation_role_changed',
    title: translateText('generated.inline.0209_role_changed_08011f35'),
    message: translateText(
      'generated.inline.0226_your_role_in_eventtitle_has_been_changed_to_n_606aa63c',
      { eventTitle: params.eventTitle, newRole: params.newRole }
    ),
    actionUrl: `/event/${params.eventId}`,
    relatedEntityType: 'event',
    relatedEventId: params.eventId,
  });

  return notifyEventManagerAudience(
    {
      senderId: params.senderId,
      recipientEntityType: 'event',
      recipientEntityId: params.eventId,
      type: 'participation_role_changed',
      title: translateText('generated.inline.0209_role_changed_08011f35'),
      message: translateText(
        'generated.inline.0227_a_participant_s_role_in_eventtitle_has_been_c_c6fa953c',
        { eventTitle: params.eventTitle, newRole: params.newRole }
      ),
      actionUrl: `/event/${params.eventId}/participants`,
      relatedEntityType: 'event',
      relatedEventId: params.eventId,
      relatedUserId: params.recipientUserId,
    },
    { excludeUserIds: [params.recipientUserId] }
  );
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
  await createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'event',
    onBehalfOfEntityId: params.eventId,
    type: 'participant_removed',
    title: translateText('generated.inline.0228_removed_from_event_3aa364a1'),
    message: translateText('generated.inline.0229_you_have_been_removed_from_eventtitle_5e3d926a', {
      eventTitle: params.eventTitle,
    }),
    relatedEntityType: 'event',
    relatedEventId: params.eventId,
  });

  return notifyEventManagerAudience(
    {
      senderId: params.senderId,
      recipientEntityType: 'event',
      recipientEntityId: params.eventId,
      type: 'participant_removed',
      title: translateText('generated.inline.0228_removed_from_event_3aa364a1'),
      message: `A participant has been removed from ${params.eventTitle}.`,
      actionUrl: `/event/${params.eventId}/participants`,
      relatedEntityType: 'event',
      relatedEventId: params.eventId,
      relatedUserId: params.recipientUserId,
    },
    { excludeUserIds: [params.recipientUserId] }
  );
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
  return notifyEventManagerAudience({
    senderId: params.senderId,
    recipientEntityType: 'event',
    recipientEntityId: params.eventId,
    type: 'participation_withdrawn',
    title: translateText('generated.inline.0230_participant_withdrew_623502d5'),
    message: translateText(
      'generated.inline.0231_sendername_has_withdrawn_from_eventtitle_559e642a',
      { senderName: params.senderName, eventTitle: params.eventTitle }
    ),
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
  return notifyEventManagerAudience({
    senderId: params.senderId,
    recipientEntityType: 'event',
    recipientEntityId: params.eventId,
    type: 'participation_request',
    title: translateText('generated.inline.0232_participation_request_3e078420'),
    message: translateText(
      'generated.inline.0233_sendername_has_requested_to_participate_in_ev_79bdde4c',
      { senderName: params.senderName, eventTitle: params.eventTitle }
    ),
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
    title: translateText('generated.inline.0234_new_event_6396b65c'),
    message: translateText(
      'generated.inline.0235_groupname_has_created_a_new_event_eventtitle_152b5c3d',
      { groupName: params.groupName, eventTitle: params.eventTitle }
    ),
    actionUrl: `/event/${params.eventId}`,
    relatedEntityType: 'event',
    relatedEventId: params.eventId,
    relatedGroupId: params.groupId,
  });
}

/**
 * Send notification to group members when an event is assigned to their group
 */
export async function notifyGroupEventAssigned(params: {
  senderId: string;
  groupId: string;
  groupName: string;
  eventId: string;
  eventTitle: string;
}) {
  return notifyGroupMemberAudience({
    senderId: params.senderId,
    recipientEntityType: 'group',
    recipientEntityId: params.groupId,
    type: 'group_event_assigned',
    title: 'Event assigned to group',
    message: `${params.eventTitle} has been assigned to ${params.groupName}.`,
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
  await createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'amendment',
    onBehalfOfEntityId: params.amendmentId,
    type: 'collaboration_invite',
    title: translateText('generated.inline.0236_collaboration_invitation_de4beb09'),
    message: translateText(
      'generated.inline.0237_you_ve_been_invited_to_collaborate_on_amendme_b9f7b5f9',
      { amendmentTitle: params.amendmentTitle }
    ),
    actionUrl: `/user/${params.recipientUserId}/memberships`,
    relatedEntityType: 'amendment',
    relatedAmendmentId: params.amendmentId,
  });

  return notifyAmendmentManagerAudience(
    {
      senderId: params.senderId,
      recipientEntityType: 'amendment',
      recipientEntityId: params.amendmentId,
      type: 'collaboration_invite',
      title: translateText('generated.inline.0236_collaboration_invitation_de4beb09'),
      message: `A collaborator has been invited to ${params.amendmentTitle}.`,
      actionUrl: `/amendment/${params.amendmentId}/collaborators`,
      relatedEntityType: 'amendment',
      relatedAmendmentId: params.amendmentId,
      relatedUserId: params.recipientUserId,
    },
    { excludeUserIds: [params.recipientUserId] }
  );
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
  await createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'amendment',
    onBehalfOfEntityId: params.amendmentId,
    type: 'collaboration_approved',
    title: translateText('generated.inline.0238_collaboration_approved_d0f11ac2'),
    message: translateText(
      'generated.inline.0239_your_request_to_collaborate_on_amendmenttitle_f4979b73',
      { amendmentTitle: params.amendmentTitle }
    ),
    actionUrl: `/amendment/${params.amendmentId}`,
    relatedEntityType: 'amendment',
    relatedAmendmentId: params.amendmentId,
  });

  return notifyAmendmentManagerAudience(
    {
      senderId: params.senderId,
      recipientEntityType: 'amendment',
      recipientEntityId: params.amendmentId,
      type: 'collaboration_approved',
      title: translateText('generated.inline.0238_collaboration_approved_d0f11ac2'),
      message: `A collaboration request for ${params.amendmentTitle} has been approved.`,
      actionUrl: `/amendment/${params.amendmentId}/collaborators`,
      relatedEntityType: 'amendment',
      relatedAmendmentId: params.amendmentId,
      relatedUserId: params.recipientUserId,
    },
    { excludeUserIds: [params.recipientUserId] }
  );
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
  await createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'amendment',
    onBehalfOfEntityId: params.amendmentId,
    type: 'collaboration_rejected',
    title: translateText('generated.inline.0240_collaboration_request_rejected_82754325'),
    message: translateText(
      'generated.inline.0241_your_request_to_collaborate_on_amendmenttitle_8d14ccc9',
      { amendmentTitle: params.amendmentTitle }
    ),
    relatedEntityType: 'amendment',
    relatedAmendmentId: params.amendmentId,
  });

  return notifyAmendmentManagerAudience(
    {
      senderId: params.senderId,
      recipientEntityType: 'amendment',
      recipientEntityId: params.amendmentId,
      type: 'collaboration_rejected',
      title: translateText('generated.inline.0240_collaboration_request_rejected_82754325'),
      message: `A collaboration request for ${params.amendmentTitle} has been rejected.`,
      actionUrl: `/amendment/${params.amendmentId}/collaborators`,
      relatedEntityType: 'amendment',
      relatedAmendmentId: params.amendmentId,
      relatedUserId: params.recipientUserId,
    },
    { excludeUserIds: [params.recipientUserId] }
  );
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
  await createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'amendment',
    onBehalfOfEntityId: params.amendmentId,
    type: 'collaboration_role_changed',
    title: translateText('generated.inline.0209_role_changed_08011f35'),
    message: translateText(
      'generated.inline.0242_your_role_in_amendmenttitle_has_been_changed__e3006434',
      { amendmentTitle: params.amendmentTitle, newRole: params.newRole }
    ),
    actionUrl: `/amendment/${params.amendmentId}`,
    relatedEntityType: 'amendment',
    relatedAmendmentId: params.amendmentId,
  });

  return notifyAmendmentManagerAudience(
    {
      senderId: params.senderId,
      recipientEntityType: 'amendment',
      recipientEntityId: params.amendmentId,
      type: 'collaboration_role_changed',
      title: translateText('generated.inline.0209_role_changed_08011f35'),
      message: translateText(
        'generated.inline.0243_a_collaborator_s_role_in_amendmenttitle_has_b_2b1e9b8f',
        { amendmentTitle: params.amendmentTitle, newRole: params.newRole }
      ),
      actionUrl: `/amendment/${params.amendmentId}/collaborators`,
      relatedEntityType: 'amendment',
      relatedAmendmentId: params.amendmentId,
      relatedUserId: params.recipientUserId,
    },
    { excludeUserIds: [params.recipientUserId] }
  );
}

/**
 * Send notification when a collaborator is promoted to amendment owner/author
 */
export async function notifyAmendmentOwnerPromoted(params: {
  senderId: string;
  recipientUserId: string;
  amendmentId: string;
  amendmentTitle: string;
}) {
  await createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'amendment',
    onBehalfOfEntityId: params.amendmentId,
    type: 'amendment_owner_promoted',
    title: translateText('generated.inline.0244_promoted_to_owner_949212e9'),
    message: translateText(
      'generated.inline.0245_you_have_been_promoted_to_owner_of_amendmentt_7a34239d',
      { amendmentTitle: params.amendmentTitle }
    ),
    actionUrl: `/amendment/${params.amendmentId}`,
    relatedEntityType: 'amendment',
    relatedAmendmentId: params.amendmentId,
  });

  return notifyAmendmentManagerAudience(
    {
      senderId: params.senderId,
      recipientEntityType: 'amendment',
      recipientEntityId: params.amendmentId,
      type: 'amendment_owner_promoted',
      title: translateText('generated.inline.0246_owner_promoted_0b242b3c'),
      message: translateText(
        'generated.inline.0247_a_collaborator_has_been_promoted_to_owner_of__783c97f0',
        { amendmentTitle: params.amendmentTitle }
      ),
      actionUrl: `/amendment/${params.amendmentId}/collaborators`,
      relatedEntityType: 'amendment',
      relatedAmendmentId: params.amendmentId,
      relatedUserId: params.recipientUserId,
    },
    { excludeUserIds: [params.recipientUserId] }
  );
}

/**
 * Send notification when an amendment owner/author is demoted
 */
export async function notifyAmendmentOwnerDemoted(params: {
  senderId: string;
  recipientUserId: string;
  amendmentId: string;
  amendmentTitle: string;
}) {
  await createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'amendment',
    onBehalfOfEntityId: params.amendmentId,
    type: 'amendment_owner_demoted',
    title: translateText('generated.inline.0248_demoted_from_owner_2022375c'),
    message: translateText(
      'generated.inline.0249_you_have_been_demoted_from_owner_of_amendment_5e6a84b9',
      { amendmentTitle: params.amendmentTitle }
    ),
    actionUrl: `/amendment/${params.amendmentId}`,
    relatedEntityType: 'amendment',
    relatedAmendmentId: params.amendmentId,
  });

  return notifyAmendmentManagerAudience(
    {
      senderId: params.senderId,
      recipientEntityType: 'amendment',
      recipientEntityId: params.amendmentId,
      type: 'amendment_owner_demoted',
      title: translateText('generated.inline.0250_owner_demoted_cc125907'),
      message: translateText(
        'generated.inline.0251_a_collaborator_has_been_demoted_from_owner_of_bc931d6c',
        { amendmentTitle: params.amendmentTitle }
      ),
      actionUrl: `/amendment/${params.amendmentId}/collaborators`,
      relatedEntityType: 'amendment',
      relatedAmendmentId: params.amendmentId,
      relatedUserId: params.recipientUserId,
    },
    { excludeUserIds: [params.recipientUserId] }
  );
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
  await createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'amendment',
    onBehalfOfEntityId: params.amendmentId,
    type: 'collaborator_removed',
    title: translateText('generated.inline.0252_removed_from_amendment_7a038fd7'),
    message: translateText(
      'generated.inline.0253_you_have_been_removed_from_amendmenttitle_fbb763d7',
      { amendmentTitle: params.amendmentTitle }
    ),
    relatedEntityType: 'amendment',
    relatedAmendmentId: params.amendmentId,
  });

  return notifyAmendmentManagerAudience(
    {
      senderId: params.senderId,
      recipientEntityType: 'amendment',
      recipientEntityId: params.amendmentId,
      type: 'collaborator_removed',
      title: translateText('generated.inline.0252_removed_from_amendment_7a038fd7'),
      message: `A collaborator has been removed from ${params.amendmentTitle}.`,
      actionUrl: `/amendment/${params.amendmentId}/collaborators`,
      relatedEntityType: 'amendment',
      relatedAmendmentId: params.amendmentId,
      relatedUserId: params.recipientUserId,
    },
    { excludeUserIds: [params.recipientUserId] }
  );
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
  return notifyAmendmentManagerAudience({
    senderId: params.senderId,
    recipientEntityType: 'amendment',
    recipientEntityId: params.amendmentId,
    type: 'collaboration_withdrawn',
    title: translateText('generated.inline.0254_collaborator_withdrew_0fc0e219'),
    message: translateText(
      'generated.inline.0255_sendername_has_withdrawn_from_amendmenttitle_e6cd3e0f',
      { senderName: params.senderName, amendmentTitle: params.amendmentTitle }
    ),
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
  return notifyAmendmentManagerAudience({
    senderId: params.senderId,
    recipientEntityType: 'amendment',
    recipientEntityId: params.amendmentId,
    type: 'collaboration_request',
    title: translateText('generated.inline.0256_collaboration_request_7b6c6e6a'),
    message: translateText(
      'generated.inline.0257_sendername_has_requested_to_collaborate_on_am_b7254455',
      { senderName: params.senderName, amendmentTitle: params.amendmentTitle }
    ),
    actionUrl: `/amendment/${params.amendmentId}/collaborators`,
    relatedEntityType: 'amendment',
    relatedAmendmentId: params.amendmentId,
    relatedUserId: params.senderId,
  });
}

/**
 * Send notification when an amendment role's action rights are updated
 */
export async function notifyAmendmentRoleUpdated(params: {
  senderId: string;
  amendmentId: string;
  amendmentTitle: string;
  roleName: string;
}) {
  return notifyAmendmentManagerAudience({
    senderId: params.senderId,
    recipientEntityType: 'amendment',
    recipientEntityId: params.amendmentId,
    type: 'amendment_role_updated',
    title: translateText('generated.inline.0418_role_updated_ede48dff'),
    message: `The permissions for ${params.roleName} have been updated in ${params.amendmentTitle}.`,
    actionUrl: `/amendment/${params.amendmentId}/collaborators`,
    relatedEntityType: 'amendment',
    relatedAmendmentId: params.amendmentId,
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
  await createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'group',
    onBehalfOfEntityId: params.groupId,
    type: 'group_admin_promoted',
    title: translateText('generated.inline.0258_promoted_to_admin_764d40eb'),
    message: translateText(
      'generated.inline.0259_you_have_been_promoted_to_admin_in_groupname_08dd9e1d',
      { groupName: params.groupName }
    ),
    actionUrl: `/group/${params.groupId}`,
    relatedEntityType: 'group',
    relatedGroupId: params.groupId,
  });

  return notifyGroupMembershipManagerAudience(
    {
      senderId: params.senderId,
      recipientEntityType: 'group',
      recipientEntityId: params.groupId,
      type: 'group_admin_promoted',
      title: translateText('generated.inline.0260_admin_promoted_8f9557c7'),
      message: translateText(
        'generated.inline.0261_a_member_has_been_promoted_to_admin_in_groupn_1d9a2cef',
        { groupName: params.groupName }
      ),
      actionUrl: `/group/${params.groupId}/memberships`,
      relatedEntityType: 'group',
      relatedGroupId: params.groupId,
      relatedUserId: params.recipientUserId,
    },
    { excludeUserIds: [params.recipientUserId] }
  );
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
  await createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'group',
    onBehalfOfEntityId: params.groupId,
    type: 'group_admin_demoted',
    title: translateText('generated.inline.0262_demoted_to_member_e321df4a'),
    message: translateText(
      'generated.inline.0263_you_have_been_demoted_to_member_in_groupname_93ac4bb5',
      { groupName: params.groupName }
    ),
    actionUrl: `/group/${params.groupId}`,
    relatedEntityType: 'group',
    relatedGroupId: params.groupId,
  });

  return notifyGroupMembershipManagerAudience(
    {
      senderId: params.senderId,
      recipientEntityType: 'group',
      recipientEntityId: params.groupId,
      type: 'group_admin_demoted',
      title: translateText('generated.inline.0264_admin_demoted_a12ec36e'),
      message: translateText(
        'generated.inline.0265_an_admin_has_been_demoted_to_member_in_groupn_91d6a811',
        { groupName: params.groupName }
      ),
      actionUrl: `/group/${params.groupId}/memberships`,
      relatedEntityType: 'group',
      relatedGroupId: params.groupId,
      relatedUserId: params.recipientUserId,
    },
    { excludeUserIds: [params.recipientUserId] }
  );
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
    title: translateText('generated.inline.0266_new_role_created_8d846bec'),
    message: translateText(
      'generated.inline.0267_a_new_role_rolename_has_been_created_in_group_a1a89e76',
      { roleName: params.roleName, groupName: params.groupName }
    ),
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
    title: translateText('generated.inline.0268_role_deleted_ac20674d'),
    message: translateText(
      'generated.inline.0269_the_role_rolename_has_been_deleted_from_group_62c600a1',
      { roleName: params.roleName, groupName: params.groupName }
    ),
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
  return notifyGroupMembershipManagerAudience({
    senderId: params.senderId,
    recipientEntityType: 'group',
    recipientEntityId: params.groupId,
    type: 'group_access_role_updated',
    title: translateText('generated.inline.0270_role_permissions_updated_36c903a7'),
    message: translateText(
      'generated.inline.0271_the_permissions_for_rolename_have_been_update_2c7e86ae',
      { roleName: params.roleName, groupName: params.groupName }
    ),
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
    title: translateText('generated.inline.0272_new_link_added_e6a39ac7'),
    message: translateText(
      'generated.inline.0273_a_new_link_linktitle_has_been_added_to_groupn_6ab72143',
      { linkTitle: params.linkTitle, groupName: params.groupName }
    ),
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
    title: translateText('generated.inline.0274_link_removed_aa34aee2'),
    message: translateText(
      'generated.inline.0275_the_link_linktitle_has_been_removed_from_grou_46c055ec',
      { linkTitle: params.linkTitle, groupName: params.groupName }
    ),
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
    title: translateText('generated.inline.0276_new_document_added_8dbc99d9'),
    message: translateText(
      'generated.inline.0277_a_new_document_documenttitle_has_been_added_t_ad348321',
      { documentTitle: params.documentTitle, groupName: params.groupName }
    ),
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
    title: translateText('generated.inline.0278_document_removed_e41e9077'),
    message: translateText(
      'generated.inline.0279_the_document_documenttitle_has_been_removed_f_66e48723',
      { documentTitle: params.documentTitle, groupName: params.groupName }
    ),
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
    title: translateText('generated.inline.0280_document_collaboration_invite_221ebe23'),
    message: translateText(
      'generated.inline.0281_you_ve_been_invited_to_collaborate_on_documen_6618794f',
      { documentTitle: params.documentTitle }
    ),
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
    title: translateText('generated.inline.0282_new_subscriber_325d57f5'),
    message: translateText(
      'generated.inline.0283_sendername_has_subscribed_to_groupname_04d8a8ee',
      { senderName: params.senderName, groupName: params.groupName }
    ),
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
    title: translateText('generated.inline.0266_new_role_created_8d846bec'),
    message: translateText(
      'generated.inline.0284_a_new_role_roletitle_has_been_created_in_grou_9e2be697',
      { roleTitle: params.roleTitle, groupName: params.groupName }
    ),
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
    title: translateText('generated.inline.0266_new_role_created_8d846bec'),
    message: translateText(
      'generated.inline.0284_a_new_role_roletitle_has_been_created_in_grou_9e2be697',
      { roleTitle: params.roleTitle, groupName: params.groupName }
    ),
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
    title: translateText('generated.inline.0268_role_deleted_ac20674d'),
    message: translateText(
      'generated.inline.0285_the_role_roletitle_has_been_deleted_from_grou_4e86ccb0',
      { roleTitle: params.roleTitle, groupName: params.groupName }
    ),
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
    title: translateText('generated.inline.0286_role_assigned_57742acc'),
    message: translateText(
      'generated.inline.0287_you_have_been_assigned_to_the_role_roletitle__1fe02da1',
      { roleTitle: params.roleTitle, groupName: params.groupName }
    ),
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
    title: translateText('generated.inline.0288_role_vacated_4cb5da04'),
    message: translateText(
      'generated.inline.0289_you_have_been_removed_from_the_role_roletitle_b27d4056',
      { roleTitle: params.roleTitle, groupName: params.groupName }
    ),
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
    title: translateText('generated.inline.0290_election_created_b057dfe7'),
    message: translateText(
      'generated.inline.0291_an_election_has_been_created_for_roletitle_in_8480a7fe',
      { roleTitle: params.roleTitle, groupName: params.groupName }
    ),
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
  recipientGroupId?: string | null;
}) {
  const recipientGroupId = params.recipientGroupId || params.targetGroupId;
  const relatedGroupId =
    recipientGroupId === params.sourceGroupId ? params.targetGroupId : params.sourceGroupId;

  return notifyRelationshipGroupAudience({
    senderId: params.senderId,
    recipientEntityType: 'group',
    recipientEntityId: recipientGroupId,
    type: 'group_connection_request',
    title: translateText('generated.inline.0292_relationship_request_bf705eeb'),
    message: translateText(
      'generated.inline.0293_sourcegroupname_has_requested_a_relationshipt_3f6eebc2',
      {
        sourceGroupName: params.sourceGroupName,
        relationshipType: params.relationshipType,
        targetGroupName: params.targetGroupName,
      }
    ),
    actionUrl: buildGroupRelationshipManageUrl(recipientGroupId),
    relatedEntityType: 'group',
    relatedGroupId,
    onBehalfOfEntityType: 'group',
    onBehalfOfEntityId: recipientGroupId,
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
  return notifyRelationshipGroupAudience(
    {
      senderId: params.senderId,
      recipientEntityType: 'group',
      recipientEntityId: params.sourceGroupId,
      type: 'group_connection_approved',
      title: translateText('generated.inline.0294_relationship_approved_6481e419'),
      message: translateText(
        'generated.inline.0295_targetgroupname_has_approved_the_relationship_34ae443b',
        { targetGroupName: params.targetGroupName }
      ),
      actionUrl: buildGroupRelationshipManageUrl(params.sourceGroupId),
      relatedEntityType: 'group',
      relatedGroupId: params.targetGroupId,
      onBehalfOfEntityType: 'group',
      onBehalfOfEntityId: params.sourceGroupId,
    },
    { dedupeWindowMs: RELATIONSHIP_APPROVAL_DEDUPE_WINDOW_MS }
  );
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
    type: 'group_connection_rejected',
    title: translateText('generated.inline.0296_relationship_rejected_d79d00f5'),
    message: translateText(
      'generated.inline.0297_targetgroupname_has_rejected_the_relationship_7e2ac392',
      { targetGroupName: params.targetGroupName }
    ),
    actionUrl: buildGroupRelationshipManageUrl(params.sourceGroupId),
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
    title: translateText('generated.inline.0298_task_assigned_e55fb748'),
    message: translateText(
      'generated.inline.0299_you_have_been_assigned_todotitle_in_groupname_11bf8f9d',
      { todoTitle: params.todoTitle, groupName: params.groupName }
    ),
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
    title: translateText('generated.inline.0300_task_updated_1da9a8df'),
    message: translateText(
      'generated.inline.0301_the_task_todotitle_in_groupname_has_been_upda_e4cfbf98',
      { todoTitle: params.todoTitle, groupName: params.groupName }
    ),
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
    title: translateText('generated.inline.0302_task_deleted_5909bb84'),
    message: translateText(
      'generated.inline.0303_the_task_todotitle_in_groupname_has_been_dele_0bfe20e9',
      { todoTitle: params.todoTitle, groupName: params.groupName }
    ),
    actionUrl: `/group/${params.groupId}/todos`,
    relatedEntityType: 'group',
    relatedGroupId: params.groupId,
  });
}

/**
 * Send notification when a process task is created for a group.
 */
export async function notifyProcessTaskCreated(params: {
  senderId: string;
  groupId: string;
  groupName: string;
  taskTitle: string;
}) {
  const actionUrl = `/group/${params.groupId}/memberships?tab=openAssignments`;
  const config: NotificationConfig = {
    senderId: params.senderId,
    recipientEntityType: 'group',
    recipientEntityId: params.groupId,
    type: 'group_process_task_created',
    title: translateText('generated.inline.9001_neuer_auftrag_5f7c1b2a'),
    message: translateText(
      'generated.inline.9002_in_groupname_wartet_ein_neuer_auftrag_tasktitle_63c4f1b8',
      { groupName: params.groupName, taskTitle: params.taskTitle }
    ),
    actionUrl,
    relatedEntityType: 'group',
    relatedGroupId: params.groupId,
  };

  const groupNotificationId = await createNotification(config);
  const recipientUserIds = await loadProcessTaskEventManagerRecipientIds(
    params.groupId,
    params.senderId
  );

  await Promise.all(
    recipientUserIds.map(recipientUserId =>
      createNotification({
        ...config,
        recipientUserId,
        recipientEntityType: undefined,
        recipientEntityId: undefined,
        onBehalfOfEntityType: 'group',
        onBehalfOfEntityId: params.groupId,
      })
    )
  );

  return groupNotificationId;
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
    title: translateText('generated.inline.0304_payment_created_3909340c'),
    message: translateText(
      'generated.inline.0305_a_new_payment_paymentdescription_has_been_cre_41676a81',
      { paymentDescription: params.paymentDescription, groupName: params.groupName }
    ),
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
    title: translateText('generated.inline.0306_payment_deleted_3434c3ab'),
    message: translateText(
      'generated.inline.0307_the_payment_paymentdescription_has_been_delet_f66608dd',
      { paymentDescription: params.paymentDescription, groupName: params.groupName }
    ),
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
  await createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'event',
    onBehalfOfEntityId: params.eventId,
    type: 'event_organizer_promoted',
    title: translateText('generated.inline.0308_promoted_to_organizer_e3da9ef6'),
    message: translateText(
      'generated.inline.0309_you_have_been_promoted_to_organizer_in_eventt_ef413b4a',
      { eventTitle: params.eventTitle }
    ),
    actionUrl: `/event/${params.eventId}`,
    relatedEntityType: 'event',
    relatedEventId: params.eventId,
  });

  return notifyEventManagerAudience(
    {
      senderId: params.senderId,
      recipientEntityType: 'event',
      recipientEntityId: params.eventId,
      type: 'event_organizer_promoted',
      title: translateText('generated.inline.0310_organizer_promoted_7fd41cd1'),
      message: translateText(
        'generated.inline.0311_a_participant_has_been_promoted_to_organizer__cff7ef52',
        { eventTitle: params.eventTitle }
      ),
      actionUrl: `/event/${params.eventId}/participants`,
      relatedEntityType: 'event',
      relatedEventId: params.eventId,
      relatedUserId: params.recipientUserId,
    },
    { excludeUserIds: [params.recipientUserId] }
  );
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
  await createNotification({
    senderId: params.senderId,
    recipientUserId: params.recipientUserId,
    onBehalfOfEntityType: 'event',
    onBehalfOfEntityId: params.eventId,
    type: 'event_organizer_demoted',
    title: translateText('generated.inline.0312_demoted_from_organizer_0dd7233d'),
    message: translateText(
      'generated.inline.0313_you_have_been_demoted_from_organizer_in_event_967565ae',
      { eventTitle: params.eventTitle }
    ),
    actionUrl: `/event/${params.eventId}`,
    relatedEntityType: 'event',
    relatedEventId: params.eventId,
  });

  return notifyEventManagerAudience(
    {
      senderId: params.senderId,
      recipientEntityType: 'event',
      recipientEntityId: params.eventId,
      type: 'event_organizer_demoted',
      title: translateText('generated.inline.0314_organizer_demoted_a9eca1ad'),
      message: translateText(
        'generated.inline.0315_an_organizer_has_been_demoted_in_eventtitle_ae372619',
        { eventTitle: params.eventTitle }
      ),
      actionUrl: `/event/${params.eventId}/participants`,
      relatedEntityType: 'event',
      relatedEventId: params.eventId,
      relatedUserId: params.recipientUserId,
    },
    { excludeUserIds: [params.recipientUserId] }
  );
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
  return notifyEventParticipantAudience({
    senderId: params.senderId,
    recipientEntityType: 'event',
    recipientEntityId: params.eventId,
    type: 'event_agenda_item_created',
    title: translateText('generated.inline.0316_agenda_item_added_712c8f7b'),
    message: translateText(
      'generated.inline.0317_agendaitemtitle_has_been_added_to_eventtitle_71702300',
      { agendaItemTitle: params.agendaItemTitle, eventTitle: params.eventTitle }
    ),
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
  return notifyEventParticipantAudience({
    senderId: params.senderId,
    recipientEntityType: 'event',
    recipientEntityId: params.eventId,
    type: 'event_agenda_item_deleted',
    title: translateText('generated.inline.0318_agenda_item_removed_4458fcac'),
    message: translateText(
      'generated.inline.0319_agendaitemtitle_has_been_removed_from_eventti_11c4de4d',
      { agendaItemTitle: params.agendaItemTitle, eventTitle: params.eventTitle }
    ),
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
    title: translateText('generated.inline.0320_agenda_item_moved_a7ce17c2'),
    message: translateText(
      'generated.inline.0321_agendaitemtitle_has_been_moved_to_targetevent_96ec27c3',
      { agendaItemTitle: params.agendaItemTitle, targetEventTitle: params.targetEventTitle }
    ),
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
    title: translateText('generated.inline.0316_agenda_item_added_712c8f7b'),
    message: translateText(
      'generated.inline.0322_agendaitemtitle_has_been_moved_from_sourceeve_fe2e151c',
      { agendaItemTitle: params.agendaItemTitle, sourceEventTitle: params.sourceEventTitle }
    ),
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
  return notifyEventParticipantAudience({
    senderId: params.senderId,
    recipientEntityType: 'event',
    recipientEntityId: params.eventId,
    type: 'event_schedule_changed',
    title: translateText('generated.inline.0323_schedule_changed_592f7245'),
    message: translateText(
      'generated.inline.0324_the_schedule_for_eventtitle_has_been_updated_1751533e',
      { eventTitle: params.eventTitle }
    ),
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
  return notifyEventParticipantAudience({
    senderId: params.senderId,
    recipientEntityType: 'event',
    recipientEntityId: params.eventId,
    type: 'event_candidate_added',
    title: translateText('generated.inline.0325_candidate_added_95b4caba'),
    message: translateText(
      'generated.inline.0326_candidatename_has_been_added_as_a_candidate_i_73d1d5e0',
      { candidateName: params.candidateName, eventTitle: params.eventTitle }
    ),
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
  return notifyEventParticipantAudience({
    senderId: params.senderId,
    recipientEntityType: 'event',
    recipientEntityId: params.eventId,
    type: 'event_election_started',
    title: translateText('generated.inline.0327_election_started_14c92cd2'),
    message: translateText(
      'generated.inline.0328_voting_has_started_for_electiontitle_in_event_dcb2f3c8',
      { electionTitle: params.electionTitle, eventTitle: params.eventTitle }
    ),
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
  return notifyEventParticipantAudience({
    senderId: params.senderId,
    recipientEntityType: 'event',
    recipientEntityId: params.eventId,
    type: 'event_election_ended',
    title: translateText('generated.inline.0329_election_ended_25c3a9a2'),
    message: translateText(
      'generated.inline.0330_voting_has_ended_for_electiontitle_in_eventti_af6cdd32',
      { electionTitle: params.electionTitle, eventTitle: params.eventTitle }
    ),
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
    title: translateText('generated.inline.0331_role_created_a7153118'),
    message: translateText(
      'generated.inline.0332_a_new_role_roletitle_has_been_created_in_even_a725e0ae',
      { roleTitle: params.roleTitle, eventTitle: params.eventTitle }
    ),
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
    title: translateText('generated.inline.0268_role_deleted_ac20674d'),
    message: translateText(
      'generated.inline.0333_the_role_roletitle_has_been_deleted_from_even_aeaf5d1a',
      { roleTitle: params.roleTitle, eventTitle: params.eventTitle }
    ),
    actionUrl: `/event/${params.eventId}`,
    relatedEntityType: 'event',
    relatedEventId: params.eventId,
  });
}

/**
 * Send notification when an event role's action rights are updated
 */
export async function notifyEventRoleUpdated(params: {
  senderId: string;
  eventId: string;
  eventTitle: string;
  roleTitle: string;
}) {
  return notifyEventManagerAudience({
    senderId: params.senderId,
    recipientEntityType: 'event',
    recipientEntityId: params.eventId,
    type: 'event_role_updated',
    title: translateText('generated.inline.0418_role_updated_ede48dff'),
    message: `The permissions for ${params.roleTitle} have been updated in ${params.eventTitle}.`,
    actionUrl: `/event/${params.eventId}/participants`,
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
    title: translateText('generated.inline.0334_delegates_finalized_938f8195'),
    message: translateText(
      'generated.inline.0335_delegates_have_been_finalized_for_eventtitle_6f6905a5',
      { eventTitle: params.eventTitle }
    ),
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
    title: translateText('generated.inline.0336_delegate_nominated_22807be9'),
    message: translateText(
      'generated.inline.0337_you_have_been_nominated_as_a_delegate_for_eve_879cbe4b',
      { eventTitle: params.eventTitle }
    ),
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
    title: translateText('generated.inline.0338_meeting_booked_4fcb2217'),
    message: translateText(
      'generated.inline.0339_sendername_has_booked_a_meeting_with_you_valu_365a4da6',
      {
        senderName: params.senderName,
        valuec6f3: params.eventTitle ? ` for ${params.eventTitle}` : '',
        meetingTime: params.meetingTime,
      }
    ),
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
    title: translateText('generated.inline.0340_meeting_cancelled_a5e050bf'),
    message: translateText(
      'generated.inline.0341_sendername_has_cancelled_the_meeting_valuec6f_c2ffbabf',
      {
        senderName: params.senderName,
        valuec6f3: params.eventTitle ? ` for ${params.eventTitle}` : '',
        meetingTime: params.meetingTime,
      }
    ),
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
    title: translateText('generated.inline.0342_added_to_speaker_list_3ddeaeb0'),
    message: translateText(
      'generated.inline.0343_you_have_been_added_to_the_speaker_list_for_e_7fc2d58e',
      { eventTitle: params.eventTitle }
    ),
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
    title: translateText('generated.inline.0344_speaker_joined_3dafa9d3'),
    message: translateText(
      'generated.inline.0345_sendername_has_joined_the_speaker_list_for_ev_98195520',
      { senderName: params.senderName, eventTitle: params.eventTitle }
    ),
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
    title: translateText('generated.inline.0282_new_subscriber_325d57f5'),
    message: translateText(
      'generated.inline.0346_sendername_has_subscribed_to_eventtitle_3dc01439',
      { senderName: params.senderName, eventTitle: params.eventTitle }
    ),
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
    title: translateText('generated.inline.0347_agenda_item_activated_bc71111a'),
    message: translateText(
      'generated.inline.0348_agendaitemtitle_is_now_active_at_eventtitle_8da6468c',
      { agendaItemTitle: params.agendaItemTitle, eventTitle: params.eventTitle }
    ),
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
  return notifyEventParticipantAudience({
    senderId: params.senderId,
    recipientEntityType: 'event',
    recipientEntityId: params.eventId,
    type: 'voting_phase_started',
    title: translateText('generated.inline.0349_voting_has_begun_4b41f90b'),
    message: translateText(
      'generated.inline.0350_voting_for_agendaitemtitle_has_started_value5_7499d1f8',
      {
        agendaItemTitle: params.agendaItemTitle,
        value50d6: params.timeLimit ? ` (${Math.floor(params.timeLimit / 60)} minutes)` : '',
      }
    ),
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
    title: translateText('generated.inline.0351_voting_ending_soon_dc220907'),
    message: translateText(
      'generated.inline.0352_voting_for_agendaitemtitle_ends_in_minutesrem_311fa06c',
      { agendaItemTitle: params.agendaItemTitle, minutesRemaining: params.minutesRemaining }
    ),
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
      ? translateText('generated.inline.0127_accepted_51c817ab')
      : params.result === 'rejected'
        ? translateText('generated.inline.0128_rejected_1f087a59')
        : translateText('generated.inline.0129_resulted_in_a_tie_03c92e81');
  return notifyEventParticipantAudience({
    senderId: params.senderId,
    recipientEntityType: 'event',
    recipientEntityId: params.eventId,
    type: 'voting_completed',
    title: translateText('generated.inline.0353_voting_completed_bd48f8ed'),
    message: translateText(
      'generated.inline.0354_agendaitemtitle_was_resulttext_acceptvotes_fo_72aa7991',
      {
        agendaItemTitle: params.agendaItemTitle,
        resultText: resultText,
        acceptVotes: params.acceptVotes,
        rejectVotes: params.rejectVotes,
      }
    ),
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
    title: translateText('generated.inline.0355_amendment_forwarded_2dce165c'),
    message: translateText(
      'generated.inline.0356_amendmenttitle_has_been_forwarded_from_source_cd3c0755',
      {
        amendmentTitle: params.amendmentTitle,
        sourceEventTitle: params.sourceEventTitle,
        targetEventTitle: params.targetEventTitle,
      }
    ),
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
    title: translateText('generated.inline.0357_election_result_5743abde'),
    message: translateText(
      'generated.inline.0358_winnername_has_been_elected_as_roletitle_7a95dc81',
      { winnerName: params.winnerName, roleTitle: params.roleTitle }
    ),
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
    title: translateText('generated.inline.0359_revote_scheduled_48676dfd'),
    message: translateText(
      'generated.inline.0360_a_revote_for_roletitle_has_been_scheduled_for_4e61e14b',
      { roleTitle: params.roleTitle, scheduledDate: params.scheduledDate }
    ),
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
    ? translateText(
        'generated.inline.0130_eventtitle_has_been_cancelled_agenda_items_ha_c60a9af6',
        { eventTitle: params.eventTitle, reassignmentEventTitle: params.reassignmentEventTitle }
      )
    : translateText('generated.inline.0131_eventtitle_has_been_cancelled_value2029_a58bcd67', {
        eventTitle: params.eventTitle,
        value2029: params.cancellationReason ? ` Reason: ${params.cancellationReason}` : '',
      });

  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'event',
    recipientEntityId: params.eventId,
    type: 'event_cancelled',
    title: translateText('generated.inline.0361_event_cancelled_b66d2550'),
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
    title: translateText('generated.inline.0362_agenda_items_reassigned_71934d73'),
    message: translateText(
      'generated.inline.0363_itemcount_agenda_item_s_from_sourceeventtitle_cc411e44',
      {
        itemCount: params.itemCount,
        sourceEventTitle: params.sourceEventTitle,
        targetEventTitle: params.targetEventTitle,
      }
    ),
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
    title: translateText('generated.inline.0364_path_recalculation_required_b6c14117'),
    message: translateText(
      'generated.inline.0365_the_path_for_amendmenttitle_needs_to_be_recal_e82e4050',
      { amendmentTitle: params.amendmentTitle, reason: params.reason }
    ),
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
    title: translateText('generated.inline.0366_support_confirmation_required_cb700d6f'),
    message: translateText(
      'generated.inline.0367_a_change_was_accepted_on_amendmenttitle_group_f89d78b2',
      { amendmentTitle: params.amendmentTitle, groupName: params.groupName }
    ),
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
    title: translateText('generated.inline.0368_support_confirmed_a88de2c8'),
    message: translateText(
      'generated.inline.0369_groupname_has_confirmed_their_support_for_ame_2c1855a7',
      { groupName: params.groupName, amendmentTitle: params.amendmentTitle }
    ),
    actionUrl: `/amendment/${params.amendmentId}`,
    relatedEntityType: 'amendment',
    relatedAmendmentId: params.amendmentId,
    relatedGroupId: params.groupId,
  });
}

/**
 * Send notification to group members when their group confirms support for an amendment
 */
export async function notifyGroupAmendmentSupportConfirmed(params: {
  senderId: string;
  amendmentId: string;
  amendmentTitle: string;
  groupId: string;
  groupName: string;
  eventId?: string;
  eventTitle?: string;
}) {
  const message = params.eventTitle
    ? `${params.eventTitle} confirmed that ${params.groupName} supports ${params.amendmentTitle}.`
    : `${params.groupName} confirmed support for ${params.amendmentTitle}.`;

  return notifyGroupMemberAudience({
    senderId: params.senderId,
    recipientEntityType: 'group',
    recipientEntityId: params.groupId,
    type: 'group_amendment_support_confirmed',
    title: 'Amendment support confirmed',
    message,
    actionUrl: params.eventId
      ? `/event/${params.eventId}/agenda`
      : `/amendment/${params.amendmentId}`,
    relatedEntityType: 'amendment',
    relatedAmendmentId: params.amendmentId,
    relatedGroupId: params.groupId,
    relatedEventId: params.eventId,
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
    title: translateText('generated.inline.0370_support_declined_2a207a91'),
    message: translateText(
      'generated.inline.0371_groupname_has_withdrawn_their_support_for_ame_b5e2a884',
      { groupName: params.groupName, amendmentTitle: params.amendmentTitle }
    ),
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
    title: translateText('generated.inline.0372_workflow_status_changed_4185bb6a'),
    message: translateText(
      'generated.inline.0373_the_status_of_amendmenttitle_has_changed_to_n_fc1ed128',
      { amendmentTitle: params.amendmentTitle, newStatus: params.newStatus }
    ),
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
    title: translateText('generated.inline.0374_path_advanced_7628ccaf'),
    message: translateText(
      'generated.inline.0375_amendmenttitle_has_advanced_to_segmentname_f9fba19c',
      { amendmentTitle: params.amendmentTitle, segmentName: params.segmentName }
    ),
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
    title: translateText('generated.inline.0376_amendment_cloned_a6235fba'),
    message: translateText(
      'generated.inline.0377_sendername_has_cloned_originalamendmenttitle_9e586236',
      { senderName: params.senderName, originalAmendmentTitle: params.originalAmendmentTitle }
    ),
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
    title: translateText('generated.inline.0378_group_support_added_2e4869c8'),
    message: translateText(
      'generated.inline.0379_groupname_has_added_support_for_amendmenttitl_8eaca2c3',
      { groupName: params.groupName, amendmentTitle: params.amendmentTitle }
    ),
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
    title: translateText('generated.inline.0380_new_comment_392e915c'),
    message: translateText(
      'generated.inline.0381_sendername_commented_on_amendmenttitle_b366b64c',
      { senderName: params.senderName, amendmentTitle: params.amendmentTitle }
    ),
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
    title: translateText('generated.inline.0382_change_request_created_93edbe54'),
    message: translateText(
      'generated.inline.0383_sendername_has_created_a_change_request_for_a_d95b5647',
      { senderName: params.senderName, amendmentTitle: params.amendmentTitle }
    ),
    actionUrl: `/amendment/${params.amendmentId}/change-requests`,
    relatedEntityType: 'amendment',
    relatedAmendmentId: params.amendmentId,
    relatedUserId: params.senderId,
  });
}

/**
 * Send notification to an event audience when a change request is created
 * for an amendment linked to that event.
 */
export async function notifyEventChangeRequestCreated(params: {
  senderId: string;
  senderName: string;
  eventId: string;
  eventTitle: string;
  amendmentId: string;
  amendmentTitle: string;
}) {
  return notifyEventParticipantAudience({
    senderId: params.senderId,
    recipientEntityType: 'event',
    recipientEntityId: params.eventId,
    type: 'event_change_request_created',
    title: translateText('generated.inline.0382_change_request_created_93edbe54'),
    message: translateText(
      'generated.inline.0383_sendername_has_created_a_change_request_for_a_d95b5647',
      { senderName: params.senderName, amendmentTitle: params.amendmentTitle }
    ),
    actionUrl: `/amendment/${params.amendmentId}/change-requests`,
    relatedEntityType: 'amendment',
    relatedAmendmentId: params.amendmentId,
    relatedEventId: params.eventId,
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
    title: translateText('generated.inline.0384_change_request_accepted_83f8e051'),
    message: translateText(
      'generated.inline.0385_your_change_request_for_amendmenttitle_has_be_5f1861a6',
      { amendmentTitle: params.amendmentTitle }
    ),
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
    title: translateText('generated.inline.0386_change_request_rejected_373339dd'),
    message: translateText(
      'generated.inline.0387_your_change_request_for_amendmenttitle_has_be_e25d5e42',
      { amendmentTitle: params.amendmentTitle }
    ),
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
    title: translateText('generated.inline.0388_vote_cast_on_change_request_760f929a'),
    message: translateText(
      'generated.inline.0389_sendername_voted_votetype_on_your_change_requ_40cf8f12',
      {
        senderName: params.senderName,
        voteType: params.voteType,
        amendmentTitle: params.amendmentTitle,
      }
    ),
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
    title: translateText('generated.inline.0390_new_version_created_76d05ffb'),
    message: translateText(
      'generated.inline.0391_version_version_of_amendmenttitle_has_been_cr_4705187d',
      { version: params.version, amendmentTitle: params.amendmentTitle }
    ),
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
    title: translateText('generated.inline.0392_voting_session_started_91408a23'),
    message: translateText('generated.inline.0393_voting_has_started_for_amendmenttitle_fe529a68', {
      amendmentTitle: params.amendmentTitle,
    }),
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
    title: translateText('generated.inline.0394_voting_session_completed_e1475ca2'),
    message: translateText(
      'generated.inline.0395_voting_has_completed_for_amendmenttitle_b4a46b3a',
      { amendmentTitle: params.amendmentTitle }
    ),
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
    message: translateText(
      'generated.inline.0396_sendername_has_votetype_d_amendmenttitle_8190a4fe',
      {
        senderName: params.senderName,
        voteType: params.voteType,
        amendmentTitle: params.amendmentTitle,
      }
    ),
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
    title: translateText('generated.inline.0282_new_subscriber_325d57f5'),
    message: translateText(
      'generated.inline.0397_sendername_has_subscribed_to_amendmenttitle_98ae38ec',
      { senderName: params.senderName, amendmentTitle: params.amendmentTitle }
    ),
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
    title: translateText('generated.inline.0282_new_subscriber_325d57f5'),
    message: translateText(
      'generated.inline.0398_sendername_has_subscribed_to_blogtitle_259cb884',
      { senderName: params.senderName, blogTitle: params.blogTitle }
    ),
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
      message: translateText('generated.inline.0399_sendername_has_votetype_d_blogtitle_ebc5ed35', {
        senderName: params.senderName,
        voteType: params.voteType,
        blogTitle: params.blogTitle,
      }),
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
    message: translateText('generated.inline.0399_sendername_has_votetype_d_blogtitle_ebc5ed35', {
      senderName: params.senderName,
      voteType: params.voteType,
      blogTitle: params.blogTitle,
    }),
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
      title: translateText('generated.inline.0400_writer_approved_fe632d72'),
      message: translateText('generated.inline.0401_you_are_now_a_writer_for_blogtitle_a9a89a7a', {
        blogTitle: params.blogTitle,
      }),
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
    title: translateText('generated.inline.0402_writer_joined_5b6593ed'),
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
    title: translateText('generated.inline.0209_role_changed_08011f35'),
    message: translateText(
      'generated.inline.0403_your_role_in_blogtitle_has_been_changed_to_ne_84c8ab92',
      { blogTitle: params.blogTitle, newRole: params.newRole }
    ),
    actionUrl: buildBlogUrl(params.blogId, params.groupId, params.ownerId),
    relatedEntityType: 'blog',
    relatedBlogId: params.blogId,
  });

  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'blog',
    recipientEntityId: params.blogId,
    type: 'blog_role_changed',
    title: translateText('generated.inline.0209_role_changed_08011f35'),
    message: translateText(
      'generated.inline.0404_a_writer_s_role_in_blogtitle_has_been_changed_a7f65972',
      { blogTitle: params.blogTitle, newRole: params.newRole }
    ),
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
    title: translateText('generated.inline.0380_new_comment_392e915c'),
    message: translateText('generated.inline.0405_sendername_commented_on_blogtitle_eed590c0', {
      senderName: params.senderName,
      blogTitle: params.blogTitle,
    }),
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
    title: translateText('generated.inline.0406_writer_request_d8665c58'),
    message: translateText(
      'generated.inline.0407_sendername_has_requested_to_write_for_blogtit_ae9447b5',
      { senderName: params.senderName, blogTitle: params.blogTitle }
    ),
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
    title: translateText('generated.inline.0408_writer_invitation_99c91770'),
    message: translateText(
      'generated.inline.0409_you_ve_been_invited_to_write_for_blogtitle_9d57fc29',
      { blogTitle: params.blogTitle }
    ),
    actionUrl: buildBlogUrl(params.blogId, params.groupId, params.ownerId),
    relatedEntityType: 'blog',
    relatedBlogId: params.blogId,
  });

  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'blog',
    recipientEntityId: params.blogId,
    type: 'blog_writer_invite',
    title: translateText('generated.inline.0410_writer_invited_62b6f8a4'),
    message: translateText(
      'generated.inline.0411_a_writer_invitation_has_been_sent_for_blogtit_5d25a285',
      { blogTitle: params.blogTitle }
    ),
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
    title: translateText('generated.inline.0412_removed_from_blog_007ce38f'),
    message: translateText('generated.inline.0413_you_have_been_removed_from_blogtitle_265a2498', {
      blogTitle: params.blogTitle,
    }),
    actionUrl: buildBlogUrl(params.blogId, params.groupId, params.ownerId),
    relatedEntityType: 'blog',
    relatedBlogId: params.blogId,
  });

  return createNotification({
    senderId: params.senderId,
    recipientEntityType: 'blog',
    recipientEntityId: params.blogId,
    type: 'blog_writer_removed',
    title: translateText('generated.inline.0414_writer_removed_8255beaa'),
    message: translateText(
      'generated.inline.0415_a_writer_has_been_removed_from_blogtitle_331c7578',
      { blogTitle: params.blogTitle }
    ),
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
    title: translateText('generated.inline.0266_new_role_created_8d846bec'),
    message: translateText(
      'generated.inline.0416_a_new_role_rolename_has_been_created_in_blogt_7fe34f7e',
      { roleName: params.roleName, blogTitle: params.blogTitle }
    ),
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
    title: translateText('generated.inline.0268_role_deleted_ac20674d'),
    message: translateText(
      'generated.inline.0417_the_role_rolename_has_been_deleted_from_blogt_1e1cb1e2',
      { roleName: params.roleName, blogTitle: params.blogTitle }
    ),
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
    title: translateText('generated.inline.0418_role_updated_ede48dff'),
    message: translateText(
      'generated.inline.0419_the_role_rolename_has_been_updated_in_blogtit_e45a54a8',
      { roleName: params.roleName, blogTitle: params.blogTitle }
    ),
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
    title: translateText('generated.inline.0298_task_assigned_e55fb748'),
    message: translateText('generated.inline.0420_you_have_been_assigned_todotitle_dbaf4438', {
      todoTitle: params.todoTitle,
    }),
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
    title: translateText('generated.inline.0421_task_completed_3ce609d4'),
    message: translateText('generated.inline.0422_sendername_has_completed_todotitle_9e80794c', {
      senderName: params.senderName,
      todoTitle: params.todoTitle,
    }),
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
    title: translateText('generated.inline.0302_task_deleted_5909bb84'),
    message: translateText('generated.inline.0423_sendername_has_deleted_todotitle_d02cf6fe', {
      senderName: params.senderName,
      todoTitle: params.todoTitle,
    }),
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
    title: translateText('generated.inline.0424_task_due_soon_dd4ed377'),
    message: translateText('generated.inline.0425_todotitle_is_due_in_duein_1da1e709', {
      todoTitle: params.todoTitle,
      dueIn: params.dueIn,
    }),
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
    title: translateText('generated.inline.0426_task_overdue_a20686e7'),
    message: translateText('generated.inline.0427_todotitle_is_overdue_000e6737', {
      todoTitle: params.todoTitle,
    }),
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
    title: translateText('generated.inline.0428_new_follower_8b9e650c'),
    message: translateText('generated.inline.0429_sendername_started_following_you_0ccde702', {
      senderName: params.senderName,
    }),
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
    title: translateText('generated.inline.0430_new_message_1c3b20d3'),
    message: translateText('generated.inline.0431_sendername_sent_you_a_message_ad5147cb', {
      senderName: params.senderName,
    }),
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
    title: translateText('generated.inline.0432_conversation_request_cc212486'),
    message: translateText(
      'generated.inline.0433_sendername_wants_to_start_a_conversation_with_1cf59fd1',
      { senderName: params.senderName }
    ),
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
    title: translateText('generated.inline.0434_conversation_accepted_77e0a743'),
    message: translateText(
      'generated.inline.0435_sendername_accepted_your_conversation_request_fa9622dc',
      { senderName: params.senderName }
    ),
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
  return notifyGroupMembershipManagerAudience({
    senderId: params.senderId,
    recipientEntityType: 'group',
    recipientEntityId: params.groupId,
    type: 'group_invitation_accepted',
    title: translateText('generated.inline.0436_invitation_accepted_d822e43c'),
    message: translateText(
      'generated.inline.0437_sendername_has_accepted_the_invitation_to_joi_b52afbf5',
      { senderName: params.senderName, groupName: params.groupName }
    ),
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
  return notifyGroupMembershipManagerAudience({
    senderId: params.senderId,
    recipientEntityType: 'group',
    recipientEntityId: params.groupId,
    type: 'group_invitation_declined',
    title: translateText('generated.inline.0438_invitation_declined_241a5042'),
    message: translateText(
      'generated.inline.0439_sendername_has_declined_the_invitation_to_joi_7a23112f',
      { senderName: params.senderName, groupName: params.groupName }
    ),
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
  return notifyGroupMembershipManagerAudience({
    senderId: params.senderId,
    recipientEntityType: 'group',
    recipientEntityId: params.groupId,
    type: 'group_request_withdrawn',
    title: translateText('generated.inline.0440_request_withdrawn_9f2d0e6d'),
    message: translateText(
      'generated.inline.0441_sendername_has_withdrawn_their_request_to_joi_2b63ef1c',
      { senderName: params.senderName, groupName: params.groupName }
    ),
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
  return notifyEventManagerAudience({
    senderId: params.senderId,
    recipientEntityType: 'event',
    recipientEntityId: params.eventId,
    type: 'event_invitation_accepted',
    title: translateText('generated.inline.0436_invitation_accepted_d822e43c'),
    message: translateText(
      'generated.inline.0442_sendername_has_accepted_the_invitation_to_eve_72fe46e9',
      { senderName: params.senderName, eventTitle: params.eventTitle }
    ),
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
  return notifyEventManagerAudience({
    senderId: params.senderId,
    recipientEntityType: 'event',
    recipientEntityId: params.eventId,
    type: 'event_invitation_declined',
    title: translateText('generated.inline.0438_invitation_declined_241a5042'),
    message: translateText(
      'generated.inline.0443_sendername_has_declined_the_invitation_to_eve_62c07ce2',
      { senderName: params.senderName, eventTitle: params.eventTitle }
    ),
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
  return notifyEventManagerAudience({
    senderId: params.senderId,
    recipientEntityType: 'event',
    recipientEntityId: params.eventId,
    type: 'event_request_withdrawn',
    title: translateText('generated.inline.0440_request_withdrawn_9f2d0e6d'),
    message: translateText(
      'generated.inline.0444_sendername_has_withdrawn_their_request_to_par_96ae53ff',
      { senderName: params.senderName, eventTitle: params.eventTitle }
    ),
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
  return notifyAmendmentManagerAudience({
    senderId: params.senderId,
    recipientEntityType: 'amendment',
    recipientEntityId: params.amendmentId,
    type: 'collaboration_invitation_accepted',
    title: translateText('generated.inline.0436_invitation_accepted_d822e43c'),
    message: translateText(
      'generated.inline.0445_sendername_has_accepted_the_invitation_to_col_6549ab0a',
      { senderName: params.senderName, amendmentTitle: params.amendmentTitle }
    ),
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
  return notifyAmendmentManagerAudience({
    senderId: params.senderId,
    recipientEntityType: 'amendment',
    recipientEntityId: params.amendmentId,
    type: 'collaboration_invitation_declined',
    title: translateText('generated.inline.0438_invitation_declined_241a5042'),
    message: translateText(
      'generated.inline.0446_sendername_has_declined_the_invitation_to_col_315c818f',
      { senderName: params.senderName, amendmentTitle: params.amendmentTitle }
    ),
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
  return notifyAmendmentManagerAudience({
    senderId: params.senderId,
    recipientEntityType: 'amendment',
    recipientEntityId: params.amendmentId,
    type: 'collaboration_request_withdrawn',
    title: translateText('generated.inline.0440_request_withdrawn_9f2d0e6d'),
    message: translateText(
      'generated.inline.0447_sendername_has_withdrawn_their_request_to_col_2c7830b5',
      { senderName: params.senderName, amendmentTitle: params.amendmentTitle }
    ),
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
    title: translateText('generated.inline.0436_invitation_accepted_d822e43c'),
    message: translateText(
      'generated.inline.0448_sendername_has_accepted_the_invitation_to_wri_bd6ea7ef',
      { senderName: params.senderName, blogTitle: params.blogTitle }
    ),
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
    title: translateText('generated.inline.0438_invitation_declined_241a5042'),
    message: translateText(
      'generated.inline.0449_sendername_has_declined_the_invitation_to_wri_40ee476f',
      { senderName: params.senderName, blogTitle: params.blogTitle }
    ),
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
    title: translateText('generated.inline.0440_request_withdrawn_9f2d0e6d'),
    message: translateText(
      'generated.inline.0450_sendername_has_withdrawn_their_request_to_wri_f8892c02',
      { senderName: params.senderName, blogTitle: params.blogTitle }
    ),
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
    title: translateText('generated.inline.0451_writer_left_48f8f90a'),
    message: translateText('generated.inline.0452_sendername_has_left_blogtitle_c39c4bdf', {
      senderName: params.senderName,
      blogTitle: params.blogTitle,
    }),
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
    title: translateText('generated.inline.0453_amendment_updated_494ef8bc'),
    message: translateText('generated.inline.0454_amendmenttitle_has_been_updated_a54424c0', {
      amendmentTitle: params.amendmentTitle,
    }),
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
    title: translateText('generated.inline.0455_target_set_c7101ece'),
    message: translateText(
      'generated.inline.0456_amendmenttitle_has_been_targeted_at_target_c8b3c9d7',
      { amendmentTitle: params.amendmentTitle, target: target }
    ),
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
    title: translateText('generated.inline.0457_amendment_rejected_082d510c'),
    message: translateText(
      'generated.inline.0458_amendmenttitle_has_been_rejected_value935e_79bef498',
      {
        amendmentTitle: params.amendmentTitle,
        value935e: params.eventTitle ? ` at ${params.eventTitle}` : '',
      }
    ),
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
    title: translateText('generated.inline.0459_blog_updated_e86c655d'),
    message: translateText('generated.inline.0460_blogtitle_has_been_updated_ae7bafc8', {
      blogTitle: params.blogTitle,
    }),
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
    title: translateText('generated.inline.0461_blog_deleted_3a34f700'),
    message: translateText('generated.inline.0462_blogtitle_has_been_deleted_23f060db', {
      blogTitle: params.blogTitle,
    }),
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
    title: translateText('generated.inline.0463_blog_published_0101bd05'),
    message: translateText('generated.inline.0464_blogtitle_has_been_published_2731324a', {
      blogTitle: params.blogTitle,
    }),
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
    title: translateText('generated.inline.0465_group_updated_da5298de'),
    message: translateText('generated.inline.0466_groupname_has_been_updated_de126c73', {
      groupName: params.groupName,
    }),
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
    title: translateText('generated.inline.0467_event_updated_55a0d58e'),
    message: translateText('generated.inline.0468_eventtitle_has_been_updated_aea70752', {
      eventTitle: params.eventTitle,
    }),
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
    title: translateText('generated.inline.0469_new_amendment_8b469d78'),
    message: translateText(
      'generated.inline.0470_a_new_amendment_amendmenttitle_has_been_linke_cc88882c',
      { amendmentTitle: params.amendmentTitle, groupName: params.groupName }
    ),
    actionUrl: `/amendment/${params.amendmentId}`,
    relatedEntityType: 'amendment',
    relatedAmendmentId: params.amendmentId,
    relatedGroupId: params.groupId,
  });
}
