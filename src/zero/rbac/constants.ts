/**
 * RBAC Constants
 *
 * Permission inheritance mappings and default role templates.
 * Ported from db/rbac/constants.ts — no InstantDB dependencies.
 */

import type { ActionType, ResourceType } from './types';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

/**
 * Permission inheritance: defines which actions imply other actions.
 * E.g., 'manage' implies 'view', 'create', 'update', 'delete'.
 */
export const PERMISSION_IMPLIES: Partial<Record<ActionType, ActionType[]>> = {
  manage: ['view', 'create', 'update', 'delete'],
  moderate: ['view'],
  manage_members: ['view', 'invite_members'],
  manage_roles: ['view'],
  manage_participants: ['view'],
  manage_speakers: ['view'],
  manage_votes: ['view'],
  speak: ['view'],
  manageNotifications: ['viewNotifications'],
};

/**
 * Default role templates for new groups.
 * These can be used to auto-generate roles when a group is created.
 */
export const DEFAULT_GROUP_ROLES = [
  {
    name: 'Admin',
    description: translateText('generated.inline.0685_full_group_control_d3256bf2'),
    default_request_role: false,
    default_invite_role: false,
    permissions: [
      { resource: 'agendaItems' as ResourceType, action: 'manage' as ActionType },
      { resource: 'agendaItems' as ResourceType, action: 'view' as ActionType },
      { resource: 'amendments' as ResourceType, action: 'manage' as ActionType },
      { resource: 'amendments' as ResourceType, action: 'view' as ActionType },
      { resource: 'blogs' as ResourceType, action: 'manage' as ActionType },
      { resource: 'blogs' as ResourceType, action: 'view' as ActionType },
      { resource: 'comments' as ResourceType, action: 'moderate' as ActionType },
      { resource: 'elections' as ResourceType, action: 'manage' as ActionType },
      { resource: 'events' as ResourceType, action: 'manage' as ActionType },
      { resource: 'events' as ResourceType, action: 'manage_participants' as ActionType },
      { resource: 'events' as ResourceType, action: 'manage_speakers' as ActionType },
      { resource: 'events' as ResourceType, action: 'manage_votes' as ActionType },
      { resource: 'events' as ResourceType, action: 'active_voting' as ActionType },
      { resource: 'events' as ResourceType, action: 'passive_voting' as ActionType },
      { resource: 'events' as ResourceType, action: 'view' as ActionType },
      { resource: 'groupDocuments' as ResourceType, action: 'manage' as ActionType },
      { resource: 'groupDocuments' as ResourceType, action: 'view' as ActionType },
      { resource: 'groupLinks' as ResourceType, action: 'manage' as ActionType },
      { resource: 'groupLinks' as ResourceType, action: 'view' as ActionType },
      { resource: 'groupMemberships' as ResourceType, action: 'manage' as ActionType },
      { resource: 'groupMemberships' as ResourceType, action: 'view' as ActionType },
      {
        resource: 'groupNotifications' as ResourceType,
        action: 'manageNotifications' as ActionType,
      },
      {
        resource: 'groupNotifications' as ResourceType,
        action: 'viewNotifications' as ActionType,
      },
      { resource: 'groupPayments' as ResourceType, action: 'manage' as ActionType },
      { resource: 'groupPayments' as ResourceType, action: 'view' as ActionType },
      { resource: 'groupRoles' as ResourceType, action: 'manage' as ActionType },
      { resource: 'groupRoles' as ResourceType, action: 'view' as ActionType },
      { resource: 'groupRelationships' as ResourceType, action: 'manage' as ActionType },
      { resource: 'groupRelationships' as ResourceType, action: 'view' as ActionType },
      { resource: 'groupAccessRoles' as ResourceType, action: 'manage' as ActionType },
      { resource: 'groupAccessRoles' as ResourceType, action: 'view' as ActionType },
      { resource: 'groups' as ResourceType, action: 'manage' as ActionType },
      { resource: 'groups' as ResourceType, action: 'view' as ActionType },
      { resource: 'groupTodos' as ResourceType, action: 'manage' as ActionType },
      { resource: 'groupTodos' as ResourceType, action: 'view' as ActionType },
      { resource: 'messages' as ResourceType, action: 'manage' as ActionType },
      { resource: 'messages' as ResourceType, action: 'view' as ActionType },
    ],
  },
  {
    name: 'Moderator',
    description: translateText('generated.inline.0686_content_moderation_6f456137'),
    default_request_role: false,
    default_invite_role: false,
    permissions: [
      { resource: 'amendments' as ResourceType, action: 'moderate' as ActionType },
      { resource: 'comments' as ResourceType, action: 'moderate' as ActionType },
      { resource: 'events' as ResourceType, action: 'manage' as ActionType },
      {
        resource: 'groupNotifications' as ResourceType,
        action: 'viewNotifications' as ActionType,
      },
    ],
  },
  {
    name: 'Member',
    description: translateText('generated.inline.0687_standard_member_access_8f885847'),
    default_request_role: true,
    default_invite_role: true,
    permissions: [
      { resource: 'amendments' as ResourceType, action: 'create' as ActionType },
      { resource: 'amendments' as ResourceType, action: 'view' as ActionType },
      { resource: 'amendments' as ResourceType, action: 'vote' as ActionType },
      { resource: 'events' as ResourceType, action: 'view' as ActionType },
      {
        resource: 'groupNotifications' as ResourceType,
        action: 'viewNotifications' as ActionType,
      },
      { resource: 'messages' as ResourceType, action: 'manage' as ActionType },
    ],
  },
];

/**
 * Default role templates for blogs.
 */
export const DEFAULT_BLOG_ROLES = [
  {
    name: 'Owner',
    description: translateText('generated.inline.0688_full_blog_control_3d088c6f'),
    permissions: [
      { resource: 'blogs' as ResourceType, action: 'manage' as ActionType },
      { resource: 'blogBloggers' as ResourceType, action: 'manage' as ActionType },
      { resource: 'notifications' as ResourceType, action: 'manageNotifications' as ActionType },
      { resource: 'notifications' as ResourceType, action: 'viewNotifications' as ActionType },
    ],
  },
  {
    name: 'Writer',
    description: translateText('generated.inline.0689_can_write_and_edit_posts_db54dea6'),
    permissions: [
      { resource: 'blogs' as ResourceType, action: 'view' as ActionType },
      { resource: 'blogs' as ResourceType, action: 'update' as ActionType },
      { resource: 'notifications' as ResourceType, action: 'viewNotifications' as ActionType },
    ],
  },
];

/**
 * Available action rights for amendment-scoped roles.
 * This is the single source of truth for amendment collaborator permissions.
 */
export const AMENDMENT_ACTION_RIGHTS = [
  {
    resource: 'amendments' as ResourceType,
    action: 'manage' as ActionType,
    label: translateText('generated.inline.0690_manage_amendment_7d54584e'),
  },
  {
    resource: 'amendments' as ResourceType,
    action: 'view' as ActionType,
    label: translateText('generated.inline.0691_view_amendment_42f008b5'),
  },
  {
    resource: 'amendments' as ResourceType,
    action: 'create' as ActionType,
    label: translateText('generated.inline.0692_create_amendment_69f55168'),
  },
  {
    resource: 'amendments' as ResourceType,
    action: 'update' as ActionType,
    label: translateText('generated.inline.0693_update_amendment_9b8d4830'),
  },
  {
    resource: 'amendments' as ResourceType,
    action: 'delete' as ActionType,
    label: translateText('generated.inline.0694_delete_amendment_82c674a0'),
  },
  {
    resource: 'amendments' as ResourceType,
    action: 'vote' as ActionType,
    label: translateText('generated.inline.0695_vote_on_amendment_fb12d164'),
  },
  {
    resource: 'amendments' as ResourceType,
    action: 'moderate' as ActionType,
    label: translateText('generated.inline.0696_moderate_amendment_6f7c4368'),
  },
  {
    resource: 'documents' as ResourceType,
    action: 'view' as ActionType,
    label: translateText('generated.inline.0697_view_document_10005c03'),
  },
  {
    resource: 'documents' as ResourceType,
    action: 'update' as ActionType,
    label: translateText('generated.inline.0698_edit_document_d56ae084'),
  },
  {
    resource: 'threads' as ResourceType,
    action: 'create' as ActionType,
    label: translateText('generated.inline.0699_create_threads_e706fc17'),
  },
  {
    resource: 'threads' as ResourceType,
    action: 'update' as ActionType,
    label: translateText('generated.inline.0700_update_threads_aa8b062c'),
  },
  {
    resource: 'threads' as ResourceType,
    action: 'delete' as ActionType,
    label: translateText('generated.inline.0701_delete_threads_dd7b0100'),
  },
  {
    resource: 'comments' as ResourceType,
    action: 'create' as ActionType,
    label: translateText('generated.inline.0702_create_comments_26dd0972'),
  },
  {
    resource: 'comments' as ResourceType,
    action: 'update' as ActionType,
    label: translateText('generated.inline.0703_update_comments_299d1f52'),
  },
  {
    resource: 'comments' as ResourceType,
    action: 'delete' as ActionType,
    label: translateText('generated.inline.0704_delete_comments_80b0f8af'),
  },
  {
    resource: 'notifications' as ResourceType,
    action: 'manageNotifications' as ActionType,
    label: translateText('generated.inline.0040_manage_notifications_32133a0a'),
  },
  {
    resource: 'notifications' as ResourceType,
    action: 'viewNotifications' as ActionType,
    label: translateText('generated.inline.0039_view_notifications_26280ee0'),
  },
] as const;

/**
 * Default role templates for amendments.
 */
export const DEFAULT_AMENDMENT_ROLES = [
  {
    name: 'Author',
    description: translateText('generated.inline.0705_full_amendment_control_1c7c4f92'),
    permissions: AMENDMENT_ACTION_RIGHTS.map(({ resource, action }) => ({ resource, action })),
  },
  {
    name: 'Collaborator',
    description: translateText('generated.inline.0706_can_edit_the_amendment_297b4425'),
    permissions: [
      { resource: 'amendments' as ResourceType, action: 'view' as ActionType },
      { resource: 'amendments' as ResourceType, action: 'update' as ActionType },
      { resource: 'notifications' as ResourceType, action: 'viewNotifications' as ActionType },
    ],
  },
];

/**
 * Default role templates for events.
 */
export const DEFAULT_EVENT_ROLES = [
  {
    name: 'Organizer',
    description: translateText(
      'generated.inline.0707_event_organizer_with_full_permissions_36e8b4f3'
    ),
    default_request_role: false,
    default_invite_role: false,
    assignee_kind: 'member' as const,
    permissions: [
      { resource: 'events' as ResourceType, action: 'view' as ActionType },
      { resource: 'events' as ResourceType, action: 'update' as ActionType },
      { resource: 'events' as ResourceType, action: 'delete' as ActionType },
      { resource: 'events' as ResourceType, action: 'manage' as ActionType },
      { resource: 'events' as ResourceType, action: 'manage_participants' as ActionType },
      { resource: 'events' as ResourceType, action: 'manage_speakers' as ActionType },
      { resource: 'events' as ResourceType, action: 'manage_votes' as ActionType },
      { resource: 'events' as ResourceType, action: 'active_voting' as ActionType },
      { resource: 'events' as ResourceType, action: 'passive_voting' as ActionType },
      { resource: 'agendaItems' as ResourceType, action: 'view' as ActionType },
      { resource: 'agendaItems' as ResourceType, action: 'create' as ActionType },
      { resource: 'agendaItems' as ResourceType, action: 'update' as ActionType },
      { resource: 'agendaItems' as ResourceType, action: 'delete' as ActionType },
      { resource: 'agendaItems' as ResourceType, action: 'manage' as ActionType },
      {
        resource: 'notifications' as ResourceType,
        action: 'manageNotifications' as ActionType,
      },
      {
        resource: 'notifications' as ResourceType,
        action: 'viewNotifications' as ActionType,
      },
    ],
  },
  {
    name: 'Voter',
    description: translateText(
      'generated.inline.0708_event_participant_with_voting_rights_94966362'
    ),
    default_request_role: false,
    default_invite_role: false,
    assignee_kind: 'member' as const,
    permissions: [
      { resource: 'events' as ResourceType, action: 'view' as ActionType },
      { resource: 'events' as ResourceType, action: 'active_voting' as ActionType },
      { resource: 'agendaItems' as ResourceType, action: 'view' as ActionType },
      {
        resource: 'notifications' as ResourceType,
        action: 'viewNotifications' as ActionType,
      },
    ],
  },
  {
    name: 'Participant',
    description: translateText('generated.inline.0709_regular_event_participant_2b5345a2'),
    default_request_role: true,
    default_invite_role: true,
    assignee_kind: 'member' as const,
    permissions: [
      { resource: 'events' as ResourceType, action: 'view' as ActionType },
      { resource: 'events' as ResourceType, action: 'active_voting' as ActionType },
      { resource: 'events' as ResourceType, action: 'passive_voting' as ActionType },
      { resource: 'agendaItems' as ResourceType, action: 'view' as ActionType },
      {
        resource: 'notifications' as ResourceType,
        action: 'viewNotifications' as ActionType,
      },
    ],
  },
];

export const DEFAULT_ASSEMBLY_EVENT_GUEST_ROLE = {
  name: 'Gast',
  description: translateText(
    'generated.inline.0710_guest_participant_for_assembly_events_31390391'
  ),
  default_request_role: true,
  default_invite_role: true,
  assignee_kind: 'guest' as const,
  permissions: [
    { resource: 'events' as ResourceType, action: 'view' as ActionType },
    { resource: 'agendaItems' as ResourceType, action: 'view' as ActionType },
    {
      resource: 'notifications' as ResourceType,
      action: 'viewNotifications' as ActionType,
    },
  ],
} as const;

/**
 * Available action rights for group membership management UI.
 * Used to display permission options when creating or editing roles.
 * Sorted alphabetically by resource, then by action (manage before view).
 */
export const ACTION_RIGHTS = [
  // agendaItems
  {
    resource: 'agendaItems',
    action: 'manage',
    label: translateText('generated.inline.0711_manage_agenda_items_3fd07330'),
  },
  {
    resource: 'agendaItems',
    action: 'view',
    label: translateText('generated.inline.0104_view_agenda_items_aa984b00'),
  },
  // amendments
  {
    resource: 'amendments',
    action: 'manage',
    label: translateText('generated.inline.0712_manage_amendments_cba10b00'),
  },
  {
    resource: 'amendments',
    action: 'view',
    label: translateText('generated.inline.0713_view_amendments_f8f2f1c8'),
  },
  // blogs
  {
    resource: 'blogs',
    action: 'manage',
    label: translateText('generated.inline.0714_manage_blogs_037c6223'),
  },
  {
    resource: 'blogs',
    action: 'view',
    label: translateText('generated.inline.0715_view_blogs_66e2af49'),
  },
  // comments
  {
    resource: 'comments',
    action: 'moderate',
    label: translateText('generated.inline.0716_moderate_comments_6ed2d6ac'),
  },
  // elections
  {
    resource: 'elections',
    action: 'manage',
    label: translateText('generated.inline.0717_manage_elections_5a389c45'),
  },
  // events
  {
    resource: 'events',
    action: 'manage',
    label: translateText('generated.inline.0718_manage_events_90a2cf72'),
  },
  {
    resource: 'events',
    action: 'manage_participants',
    label: translateText('generated.inline.0719_manage_event_participants_46fc1417'),
  },
  {
    resource: 'events',
    action: 'manage_speakers',
    label: translateText('generated.inline.0099_manage_speakers_7c299ed7'),
  },
  {
    resource: 'events',
    action: 'manage_votes',
    label: translateText('generated.inline.0100_manage_votes_48682559'),
  },
  {
    resource: 'events',
    action: 'speak',
    label: translateText('generated.inline.0101_speak_in_events_47b45d28'),
  },
  {
    resource: 'events',
    action: 'active_voting',
    label: translateText('generated.inline.0102_active_voting_rights_c85cd127'),
  },
  {
    resource: 'events',
    action: 'passive_voting',
    label: translateText('generated.inline.0103_passive_voting_rights_can_be_candidate_c6e8a741'),
  },
  {
    resource: 'events',
    action: 'view',
    label: translateText('generated.inline.0720_view_events_a77e6dec'),
  },
  // groupDocuments
  {
    resource: 'groupDocuments',
    action: 'manage',
    label: translateText('generated.inline.0721_manage_documents_6a3b8033'),
  },
  {
    resource: 'groupDocuments',
    action: 'view',
    label: translateText('generated.inline.0722_view_documents_f5f5d899'),
  },
  // groupLinks
  {
    resource: 'groupLinks',
    action: 'manage',
    label: translateText('generated.inline.0723_manage_links_2f0a05cf'),
  },
  {
    resource: 'groupLinks',
    action: 'view',
    label: translateText('generated.inline.0724_view_links_104adf3c'),
  },
  // groupMemberships
  {
    resource: 'groupMemberships',
    action: 'manage',
    label: translateText('generated.inline.0725_manage_members_0fa9d904'),
  },
  {
    resource: 'groupMemberships',
    action: 'view',
    label: translateText('generated.inline.0726_view_members_9c28220b'),
  },
  // groupNotifications
  {
    resource: 'groupNotifications',
    action: 'manageNotifications',
    label: translateText('generated.inline.0040_manage_notifications_32133a0a'),
  },
  {
    resource: 'groupNotifications',
    action: 'viewNotifications',
    label: translateText('generated.inline.0039_view_notifications_26280ee0'),
  },
  // groupPayments
  {
    resource: 'groupPayments',
    action: 'manage',
    label: translateText('generated.inline.0727_manage_payments_0ed16f23'),
  },
  {
    resource: 'groupPayments',
    action: 'view',
    label: translateText('generated.inline.0728_view_payments_5b9306d2'),
  },
  // groupRoles
  {
    resource: 'groupRoles',
    action: 'manage',
    label: translateText('generated.inline.0729_manage_incumbents_c3778a3e'),
  },
  {
    resource: 'groupRoles',
    action: 'view',
    label: translateText('generated.inline.0730_view_incumbents_30863e06'),
  },
  // groupRelationships
  {
    resource: 'groupRelationships',
    action: 'manage',
    label: translateText('generated.inline.0731_manage_group_relationships_5ad9c80c'),
  },
  {
    resource: 'groupRelationships',
    action: 'view',
    label: translateText('generated.inline.0732_view_group_relationships_45ef1eb8'),
  },
  // groupAccessRoles
  {
    resource: 'groupAccessRoles',
    action: 'manage',
    label: translateText('generated.inline.0012_manage_roles_5f9b8531'),
  },
  {
    resource: 'groupAccessRoles',
    action: 'view',
    label: translateText('generated.inline.0733_view_roles_7e61cb75'),
  },
  // groups
  {
    resource: 'groups',
    action: 'manage',
    label: translateText('generated.inline.0734_manage_group_settings_baaa58bf'),
  },
  {
    resource: 'groups',
    action: 'view',
    label: translateText('generated.inline.0735_view_group_715a7e9b'),
  },
  // groupTodos
  {
    resource: 'groupTodos',
    action: 'manage',
    label: translateText('generated.inline.0736_manage_todos_910e55fa'),
  },
  {
    resource: 'groupTodos',
    action: 'view',
    label: translateText('generated.inline.0737_view_todos_a8a2b202'),
  },
  // messages
  {
    resource: 'messages',
    action: 'manage',
    label: translateText('generated.inline.0738_manage_messages_df85be10'),
  },
  {
    resource: 'messages',
    action: 'view',
    label: translateText('generated.inline.0739_view_messages_65780866'),
  },
] as const;

export const EVENT_ACTION_RIGHTS = ACTION_RIGHTS.filter(
  right =>
    (right.resource === 'agendaItems' && ['manage', 'view'].includes(right.action)) ||
    (right.resource === 'elections' && right.action === 'manage') ||
    (right.resource === 'events' &&
      [
        'manage',
        'manage_participants',
        'manage_speakers',
        'manage_votes',
        'speak',
        'active_voting',
        'passive_voting',
      ].includes(right.action))
);
