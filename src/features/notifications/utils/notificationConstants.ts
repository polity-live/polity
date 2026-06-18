import { featureThemeClassName } from '@/features/shared/theme';
import {
  Bell,
  Calendar,
  MessageSquare,
  UserPlus,
  Users,
  UserMinus,
  UserCheck,
  UserX,
  Shield,
  ShieldCheck,
  ShieldX,
  FileText,
  File,
  FilePlus,
  FileX,
  Link,
  LinkIcon,
  Unlink,
  Star,
  Vote,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Workflow,
  GitBranch,
  Copy,
  Target,
  CreditCard,
  Briefcase,
  Edit,
  Trash2,
  Hash,
  Megaphone,
  BookOpen,
  type LucideIcon,
} from 'lucide-react';
import { NotificationType } from '../types/notification.types';

// ── Icon Mapping ─────────────────────────────────────────────────────

const NOTIFICATION_ICON_MAP: Record<string, LucideIcon> = {
  // Legacy
  group_invite: Users,
  event_invite: Calendar,
  message: MessageSquare,
  follow: UserPlus,
  mention: Bell,
  event_update: Calendar,
  group_update: Users,

  // Group — Membership
  membership_request: UserPlus,
  membership_approved: UserCheck,
  membership_rejected: UserX,
  membership_invite: UserPlus,
  membership_role_changed: Shield,
  membership_withdrawn: UserMinus,
  member_removed: UserMinus,
  group_invitation_accepted: UserCheck,
  group_invitation_declined: UserX,
  group_request_withdrawn: UserMinus,

  // Group — Content
  group_new_event: Calendar,
  group_event_assigned: Calendar,
  group_new_amendment: FileText,
  group_amendment_support_confirmed: CheckCircle,
  group_profile_updated: Edit,
  group_new_subscriber: Star,
  group_link_added: LinkIcon,
  group_link_removed: Unlink,
  group_document_added: FilePlus,
  group_document_removed: FileX,
  document_collaborator_invited: FilePlus,

  // Group — Admin
  group_admin_promoted: ShieldCheck,
  group_admin_demoted: ShieldX,
  group_access_role_created: Shield,
  group_access_role_deleted: Shield,
  group_access_role_updated: Shield,

  // Group — Todos
  group_todo_assigned: CheckCircle,
  group_todo_updated: Edit,
  group_todo_deleted: Trash2,
  group_process_task_created: Workflow,

  // Group — Payments
  group_payment_created: CreditCard,
  group_payment_deleted: CreditCard,

  // Group — Relationships
  group_connection_request: Link,
  group_connection_approved: Link,
  group_connection_rejected: Unlink,

  // Group — Roles & Elections
  group_role_created: Briefcase,
  group_role_deleted: Briefcase,
  group_role_assigned: Briefcase,
  group_role_vacated: Briefcase,
  group_election_created: Vote,
  group_election_results: Vote,

  // Event — Participation
  participation_request: UserPlus,
  participation_approved: UserCheck,
  participation_rejected: UserX,
  participation_invite: UserPlus,
  participation_role_changed: Shield,
  participation_withdrawn: UserMinus,
  participant_removed: UserMinus,
  event_invitation_accepted: UserCheck,
  event_invitation_declined: UserX,
  event_request_withdrawn: UserMinus,

  // Event — Content
  event_profile_updated: Edit,
  event_new_subscriber: Star,
  event_organizer_promoted: ShieldCheck,
  event_organizer_demoted: ShieldX,
  event_agenda_item_created: FileText,
  event_agenda_item_deleted: FileX,
  event_agenda_item_transferred: Workflow,
  event_change_request_created: FilePlus,
  event_schedule_changed: Calendar,

  // Event — Elections & Roles
  event_candidate_added: UserPlus,
  event_election_started: Vote,
  event_election_ended: Vote,
  event_role_created: Briefcase,
  event_role_deleted: Briefcase,
  event_role_updated: Shield,
  event_delegates_finalized: Users,
  event_delegate_nominated: UserCheck,

  // Event — Meetings & Speakers
  event_meeting_booked: Calendar,
  event_meeting_cancelled: XCircle,
  event_speaker_added: Megaphone,
  agenda_item_activated: CheckCircle,
  voting_phase_started: Vote,
  voting_phase_ending_soon: Clock,
  voting_completed: CheckCircle,
  amendment_forwarded: GitBranch,
  election_result: Vote,
  revote_scheduled: Vote,
  event_cancelled: XCircle,
  agenda_items_reassigned: Workflow,
  amendment_path_recalculation_required: AlertTriangle,

  // Amendment — Collaboration
  collaboration_request: UserPlus,
  collaboration_approved: UserCheck,
  collaboration_rejected: UserX,
  collaboration_invite: UserPlus,
  collaboration_role_changed: Shield,
  collaboration_withdrawn: UserMinus,
  collaborator_removed: UserMinus,
  collaboration_invitation_accepted: UserCheck,
  collaboration_invitation_declined: UserX,
  collaboration_request_withdrawn: UserMinus,

  // Amendment — Content
  amendment_profile_updated: Edit,
  amendment_new_subscriber: Star,
  amendment_owner_promoted: ShieldCheck,
  amendment_owner_demoted: ShieldX,
  amendment_role_updated: Shield,
  amendment_workflow_changed: Workflow,
  amendment_path_advanced: GitBranch,
  amendment_cloned: Copy,
  amendment_group_support: Users,
  amendment_target_set: Target,
  support_confirmation_required: AlertTriangle,
  support_confirmed: CheckCircle,
  support_declined: XCircle,
  amendment_comment_added: MessageSquare,

  // Amendment — Change Requests
  change_request_created: FilePlus,
  change_request_accepted: CheckCircle,
  change_request_rejected: XCircle,
  change_request_vote_cast: Vote,
  amendment_version_created: File,

  // Amendment — Voting
  voting_session_started: Vote,
  voting_session_completed: Vote,
  amendment_vote_cast: Vote,
  amendment_rejected: XCircle,

  // Blog
  blog_new_subscriber: Star,
  blog_vote_cast: Vote,
  blog_updated: Edit,
  blog_published: BookOpen,
  blog_deleted: Trash2,
  blog_writer_joined: UserPlus,
  blog_role_changed: Shield,
  blog_comment_added: MessageSquare,
  blog_writer_request: UserPlus,
  blog_writer_invite: UserPlus,
  blog_writer_removed: UserMinus,
  blog_role_created: Shield,
  blog_role_deleted: Shield,
  blog_invitation_accepted: UserCheck,
  blog_invitation_declined: UserX,
  blog_request_withdrawn: UserMinus,
  blog_writer_left: UserMinus,

  // Todos
  todo_assigned: CheckCircle,
  todo_updated: Edit,
  todo_completed: CheckCircle,
  todo_deleted: Trash2,
  todo_due_soon: Clock,
  todo_overdue: AlertTriangle,

  // Statements
  statement_response: MessageSquare,
  statement_mention: Bell,

  // Social
  new_follower: UserPlus,
  profile_mention: Bell,
  direct_message: MessageSquare,
  conversation_request: MessageSquare,
  conversation_accepted: MessageSquare,

  // Additional
  role_assigned: Briefcase,
  role_removed: Briefcase,
  election_results_published: Vote,
  subscription_status_changed: Bell,
  payment_succeeded: CreditCard,
  payment_failed: CreditCard,
  file_shared: File,
  hashtag_mentioned: Hash,
  recurring_event_updated: Calendar,
};

// ── Color Mapping ────────────────────────────────────────────────────

const NOTIFICATION_COLOR_MAP: Record<string, string> = {
  // Legacy
  group_invite: featureThemeClassName('discussionsCommentTreeInfoText'),
  event_invite: featureThemeClassName('notificationNotificationAccentText'),
  message: featureThemeClassName('notificationNotificationSuccessText'),
  follow: featureThemeClassName('notificationNotificationAccentTextAlpha'),
  mention: featureThemeClassName('discussionsCommentTreeWarningText'),
  event_update: featureThemeClassName('notificationNotificationAccentTextBeta'),
  group_update: featureThemeClassName('notificationNotificationInfoText'),

  // Group — Membership (blue tones)
  membership_request: featureThemeClassName('discussionsCommentTreeInfoText'),
  membership_approved: featureThemeClassName('notificationNotificationSuccessText'),
  membership_rejected: featureThemeClassName('notificationNotificationDangerText'),
  membership_invite: featureThemeClassName('notificationNotificationInfoTextAlpha'),
  membership_role_changed: featureThemeClassName('notificationNotificationNeutralText'),
  membership_withdrawn: featureThemeClassName('notificationNotificationNeutralText'),
  member_removed: featureThemeClassName('notificationNotificationDangerText'),
  group_invitation_accepted: featureThemeClassName('notificationNotificationSuccessText'),
  group_invitation_declined: featureThemeClassName('notificationNotificationDangerText'),
  group_request_withdrawn: featureThemeClassName('notificationNotificationNeutralText'),

  // Group — Content (cyan tones)
  group_new_event: featureThemeClassName('notificationNotificationAccentText'),
  group_event_assigned: featureThemeClassName('notificationNotificationAccentText'),
  group_new_amendment: featureThemeClassName('notificationNotificationWarningText'),
  group_amendment_support_confirmed: featureThemeClassName('notificationNotificationSuccessText'),
  group_profile_updated: featureThemeClassName('notificationNotificationInfoText'),
  group_new_subscriber: featureThemeClassName('notificationNotificationWarningTextAlpha'),
  group_link_added: featureThemeClassName('notificationNotificationInfoTextBeta'),
  group_link_removed: featureThemeClassName('notificationNotificationNeutralText'),
  group_document_added: featureThemeClassName('notificationNotificationInfoTextBeta'),
  group_document_removed: featureThemeClassName('notificationNotificationNeutralText'),
  document_collaborator_invited: featureThemeClassName('notificationNotificationInfoText'),

  // Group — Admin (slate tones)
  group_admin_promoted: featureThemeClassName('notificationNotificationSuccessTextAlpha'),
  group_admin_demoted: featureThemeClassName('discussionsCommentTreeWarningText'),
  group_access_role_created: featureThemeClassName('notificationNotificationNeutralText'),
  group_access_role_deleted: featureThemeClassName('notificationNotificationNeutralText'),
  group_access_role_updated: featureThemeClassName('notificationNotificationNeutralText'),

  // Group — Todos
  group_todo_assigned: featureThemeClassName('discussionsCommentTreeInfoText'),
  group_todo_updated: featureThemeClassName('notificationNotificationInfoTextAlpha'),
  group_todo_deleted: featureThemeClassName('notificationNotificationDangerText'),
  group_process_task_created: featureThemeClassName('discussionsCommentTreeInfoText'),

  // Group — Payments
  group_payment_created: featureThemeClassName('notificationNotificationSuccessTextAlpha'),
  group_payment_deleted: featureThemeClassName('notificationNotificationDangerText'),

  // Group — Relationships
  group_connection_request: featureThemeClassName('discussionsCommentTreeInfoText'),
  group_connection_approved: featureThemeClassName('notificationNotificationSuccessText'),
  group_connection_rejected: featureThemeClassName('notificationNotificationDangerText'),

  // Group — Roles & Elections
  group_role_created: featureThemeClassName('notificationNotificationAccentTextGamma'),
  group_role_deleted: featureThemeClassName('notificationNotificationNeutralText'),
  group_role_assigned: featureThemeClassName('notificationNotificationAccentTextGamma'),
  group_role_vacated: featureThemeClassName('notificationNotificationNeutralText'),
  group_election_created: featureThemeClassName('notificationNotificationAccentTextGamma'),
  group_election_results: featureThemeClassName('notificationNotificationAccentTextGamma'),

  // Event — Participation (purple tones)
  participation_request: featureThemeClassName('notificationNotificationAccentText'),
  participation_approved: featureThemeClassName('notificationNotificationSuccessText'),
  participation_rejected: featureThemeClassName('notificationNotificationDangerText'),
  participation_invite: featureThemeClassName('notificationNotificationAccentTextDelta'),
  participation_role_changed: featureThemeClassName('notificationNotificationNeutralText'),
  participation_withdrawn: featureThemeClassName('notificationNotificationNeutralText'),
  participant_removed: featureThemeClassName('notificationNotificationDangerText'),
  event_invitation_accepted: featureThemeClassName('notificationNotificationSuccessText'),
  event_invitation_declined: featureThemeClassName('notificationNotificationDangerText'),
  event_request_withdrawn: featureThemeClassName('notificationNotificationNeutralText'),

  // Event — Content (indigo tones)
  event_profile_updated: featureThemeClassName('notificationNotificationAccentTextBeta'),
  event_new_subscriber: featureThemeClassName('notificationNotificationWarningTextAlpha'),
  event_organizer_promoted: featureThemeClassName('notificationNotificationSuccessTextAlpha'),
  event_organizer_demoted: featureThemeClassName('discussionsCommentTreeWarningText'),
  event_agenda_item_created: featureThemeClassName('notificationNotificationAccentTextEpsilon'),
  event_agenda_item_deleted: featureThemeClassName('notificationNotificationNeutralText'),
  event_agenda_item_transferred: featureThemeClassName('notificationNotificationAccentTextEpsilon'),
  event_change_request_created: featureThemeClassName('notificationNotificationWarningText'),
  event_schedule_changed: featureThemeClassName('notificationNotificationAccentTextBeta'),

  // Event — Elections & Roles
  event_candidate_added: featureThemeClassName('notificationNotificationAccentTextGamma'),
  event_election_started: featureThemeClassName('notificationNotificationAccentTextGamma'),
  event_election_ended: featureThemeClassName('notificationNotificationAccentTextGamma'),
  event_role_created: featureThemeClassName('notificationNotificationAccentTextGamma'),
  event_role_deleted: featureThemeClassName('notificationNotificationNeutralText'),
  event_role_updated: featureThemeClassName('notificationNotificationNeutralText'),
  event_delegates_finalized: featureThemeClassName('notificationNotificationAccentTextGamma'),
  event_delegate_nominated: featureThemeClassName('notificationNotificationAccentTextZeta'),

  // Event — Meetings & Speakers
  event_meeting_booked: featureThemeClassName('notificationNotificationAccentText'),
  event_meeting_cancelled: featureThemeClassName('notificationNotificationDangerText'),
  event_speaker_added: featureThemeClassName('notificationNotificationAccentTextDelta'),
  agenda_item_activated: featureThemeClassName('notificationNotificationSuccessTextAlpha'),
  voting_phase_started: featureThemeClassName('notificationNotificationAccentTextGamma'),
  voting_phase_ending_soon: featureThemeClassName('discussionsCommentTreeWarningText'),
  voting_completed: featureThemeClassName('notificationNotificationSuccessTextAlpha'),
  amendment_forwarded: featureThemeClassName('notificationNotificationWarningText'),
  election_result: featureThemeClassName('notificationNotificationAccentTextGamma'),
  revote_scheduled: featureThemeClassName('notificationNotificationAccentTextGamma'),
  event_cancelled: featureThemeClassName('notificationNotificationDangerText'),
  agenda_items_reassigned: featureThemeClassName('notificationNotificationAccentTextBeta'),
  amendment_path_recalculation_required: featureThemeClassName('discussionsCommentTreeWarningText'),

  // Amendment — Collaboration (amber tones)
  collaboration_request: featureThemeClassName('notificationNotificationWarningText'),
  collaboration_approved: featureThemeClassName('notificationNotificationSuccessText'),
  collaboration_rejected: featureThemeClassName('notificationNotificationDangerText'),
  collaboration_invite: featureThemeClassName('notificationNotificationWarningTextBeta'),
  collaboration_role_changed: featureThemeClassName('notificationNotificationNeutralText'),
  collaboration_withdrawn: featureThemeClassName('notificationNotificationNeutralText'),
  collaborator_removed: featureThemeClassName('notificationNotificationDangerText'),
  collaboration_invitation_accepted: featureThemeClassName('notificationNotificationSuccessText'),
  collaboration_invitation_declined: featureThemeClassName('notificationNotificationDangerText'),
  collaboration_request_withdrawn: featureThemeClassName('notificationNotificationNeutralText'),

  // Amendment — Content (amber/orange tones)
  amendment_profile_updated: featureThemeClassName('notificationNotificationWarningText'),
  amendment_new_subscriber: featureThemeClassName('notificationNotificationWarningTextAlpha'),
  amendment_owner_promoted: featureThemeClassName('notificationNotificationSuccessTextAlpha'),
  amendment_owner_demoted: featureThemeClassName('discussionsCommentTreeWarningText'),
  amendment_role_updated: featureThemeClassName('notificationNotificationNeutralText'),
  amendment_workflow_changed: featureThemeClassName('notificationNotificationWarningTextBeta'),
  amendment_path_advanced: featureThemeClassName('notificationNotificationWarningTextBeta'),
  amendment_cloned: featureThemeClassName('notificationNotificationWarningTextBeta'),
  amendment_group_support: featureThemeClassName('discussionsCommentTreeInfoText'),
  amendment_target_set: featureThemeClassName('notificationNotificationWarningText'),
  support_confirmation_required: featureThemeClassName('discussionsCommentTreeWarningText'),
  support_confirmed: featureThemeClassName('notificationNotificationSuccessText'),
  support_declined: featureThemeClassName('notificationNotificationDangerText'),
  amendment_comment_added: featureThemeClassName('notificationNotificationSuccessText'),

  // Amendment — Change Requests
  change_request_created: featureThemeClassName('notificationNotificationWarningText'),
  change_request_accepted: featureThemeClassName('notificationNotificationSuccessText'),
  change_request_rejected: featureThemeClassName('notificationNotificationDangerText'),
  change_request_vote_cast: featureThemeClassName('notificationNotificationAccentTextGamma'),
  amendment_version_created: featureThemeClassName('notificationNotificationWarningTextBeta'),

  // Amendment — Voting
  voting_session_started: featureThemeClassName('notificationNotificationAccentTextGamma'),
  voting_session_completed: featureThemeClassName('notificationNotificationAccentTextGamma'),
  amendment_vote_cast: featureThemeClassName('notificationNotificationAccentTextGamma'),
  amendment_rejected: featureThemeClassName('notificationNotificationDangerText'),

  // Blog (rose tones)
  blog_new_subscriber: featureThemeClassName('notificationNotificationWarningTextAlpha'),
  blog_vote_cast: featureThemeClassName('notificationNotificationAccentTextGamma'),
  blog_updated: featureThemeClassName('notificationNotificationDangerTextAlpha'),
  blog_published: featureThemeClassName('notificationNotificationDangerTextAlpha'),
  blog_deleted: featureThemeClassName('notificationNotificationDangerText'),
  blog_writer_joined: featureThemeClassName('notificationNotificationDangerTextBeta'),
  blog_role_changed: featureThemeClassName('notificationNotificationNeutralText'),
  blog_comment_added: featureThemeClassName('notificationNotificationSuccessText'),
  blog_writer_request: featureThemeClassName('notificationNotificationDangerTextAlpha'),
  blog_writer_invite: featureThemeClassName('notificationNotificationDangerTextBeta'),
  blog_writer_removed: featureThemeClassName('notificationNotificationDangerText'),
  blog_role_created: featureThemeClassName('notificationNotificationNeutralText'),
  blog_role_deleted: featureThemeClassName('notificationNotificationNeutralText'),
  blog_invitation_accepted: featureThemeClassName('notificationNotificationSuccessText'),
  blog_invitation_declined: featureThemeClassName('notificationNotificationDangerText'),
  blog_request_withdrawn: featureThemeClassName('notificationNotificationNeutralText'),
  blog_writer_left: featureThemeClassName('notificationNotificationNeutralText'),

  // Todos (blue tones)
  todo_assigned: featureThemeClassName('discussionsCommentTreeInfoText'),
  todo_updated: featureThemeClassName('notificationNotificationInfoTextAlpha'),
  todo_completed: featureThemeClassName('notificationNotificationSuccessText'),
  todo_deleted: featureThemeClassName('notificationNotificationDangerText'),
  todo_due_soon: featureThemeClassName('discussionsCommentTreeWarningText'),
  todo_overdue: featureThemeClassName('notificationNotificationDangerText'),

  // Statements
  statement_response: featureThemeClassName('notificationNotificationSuccessText'),
  statement_mention: featureThemeClassName('discussionsCommentTreeWarningText'),

  // Social (pink tones)
  new_follower: featureThemeClassName('notificationNotificationAccentTextAlpha'),
  profile_mention: featureThemeClassName('discussionsCommentTreeWarningText'),
  direct_message: featureThemeClassName('notificationNotificationSuccessText'),
  conversation_request: featureThemeClassName('discussionsCommentTreeInfoText'),
  conversation_accepted: featureThemeClassName('notificationNotificationSuccessText'),

  // Additional
  role_assigned: featureThemeClassName('notificationNotificationAccentTextGamma'),
  role_removed: featureThemeClassName('notificationNotificationNeutralText'),
  election_results_published: featureThemeClassName('notificationNotificationAccentTextGamma'),
  subscription_status_changed: featureThemeClassName('notificationNotificationWarningTextAlpha'),
  payment_succeeded: featureThemeClassName('notificationNotificationSuccessTextAlpha'),
  payment_failed: featureThemeClassName('notificationNotificationDangerText'),
  file_shared: featureThemeClassName('notificationNotificationInfoText'),
  hashtag_mentioned: featureThemeClassName('discussionsCommentTreeWarningText'),
  recurring_event_updated: featureThemeClassName('notificationNotificationAccentTextBeta'),
};

// ── Public API ───────────────────────────────────────────────────────

/** @deprecated Use getNotificationIcon() instead */
export const notificationIcons: Partial<Record<NotificationType, LucideIcon>> = {
  group_invite: Users,
  event_invite: Calendar,
  message: MessageSquare,
  follow: UserPlus,
  mention: Bell,
  event_update: Calendar,
  group_update: Users,
};

/** @deprecated Use getNotificationColor() instead */
export const notificationColors: Partial<Record<NotificationType, string>> = {
  group_invite: featureThemeClassName('discussionsCommentTreeInfoText'),
  event_invite: featureThemeClassName('notificationNotificationAccentText'),
  message: featureThemeClassName('notificationNotificationSuccessText'),
  follow: featureThemeClassName('notificationNotificationAccentTextAlpha'),
  mention: featureThemeClassName('discussionsCommentTreeWarningText'),
  event_update: featureThemeClassName('notificationNotificationAccentTextBeta'),
  group_update: featureThemeClassName('notificationNotificationInfoText'),
};

/**
 * Get the icon for a notification type. Falls back to Bell.
 */
export function getNotificationIcon(type: NotificationType): LucideIcon {
  return NOTIFICATION_ICON_MAP[type] ?? Bell;
}

/**
 * Get the color class for a notification type. Falls back to the shared neutral text tone.
 */
export function getNotificationColor(type: NotificationType): string {
  return (
    NOTIFICATION_COLOR_MAP[type] ?? featureThemeClassName('notificationNotificationNeutralText')
  );
}
