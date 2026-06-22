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

const NOTIFICATION_ICON_MAP = {
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
} satisfies Record<NotificationType, LucideIcon>;

// ── Public API ───────────────────────────────────────────────────────

/**
 * Get the icon for a notification type. Falls back to Bell.
 */
export function getNotificationIcon(type: NotificationType): LucideIcon {
  return NOTIFICATION_ICON_MAP[type] ?? Bell;
}
