import { buildRecurringEventFields } from '@/features/events/logic/buildRecurringEventFields';
import { parseRRuleToFormState } from '@/features/events/logic/rruleHelpers';
import type { GroupRole, RoleEditorFormState } from '../types/group.types';

interface RoleEditorMutationOptions {
  allowGuestRequestDefault?: boolean;
  allowGuestInviteDefault?: boolean;
  includeRecurringFields?: boolean;
}

export function emptyRoleEditorForm(): RoleEditorFormState {
  return {
    name: '',
    description: '',
    assignee_kind: 'member',
    assignment_mode: 'assigned',
    visibility: 'public',
    term_pattern: 'none',
    term_interval: 1,
    term_start_date: '',
    scheduled_revote_date: '',
    default_request_role: false,
    default_invite_role: false,
  };
}

export function roleToEditorForm(role: GroupRole): RoleEditorFormState {
  const recurrence = role.recurrence_rule ? parseRRuleToFormState(role.recurrence_rule) : null;

  return {
    name: role.name ?? '',
    description: role.description ?? '',
    assignee_kind: role.assignee_kind === 'guest' ? 'guest' : 'member',
    assignment_mode: role.assignment_mode === 'elected' ? 'elected' : 'assigned',
    visibility:
      role.visibility === 'authenticated' || role.visibility === 'private'
        ? role.visibility
        : 'public',
    term_pattern:
      recurrence?.pattern === 'four-yearly' || recurrence?.pattern === 'yearly'
        ? recurrence.pattern
        : role.is_recurring
          ? 'yearly'
          : 'none',
    term_interval: recurrence?.interval ?? role.recurrence_interval ?? 1,
    term_start_date: toDateInput(role.term_start_date),
    scheduled_revote_date: toDateInput(role.scheduled_revote_date),
    default_request_role: Boolean(role.default_request_role),
    default_invite_role: Boolean(role.default_invite_role),
  };
}

export function roleEditorFormToMutation(form: RoleEditorFormState) {
  return roleEditorFormToMutationWithOptions(form);
}

export function roleEditorFormToMutationWithOptions(
  form: RoleEditorFormState,
  options: RoleEditorMutationOptions = {}
) {
  const {
    allowGuestRequestDefault = false,
    allowGuestInviteDefault = false,
    includeRecurringFields = true,
  } = options;
  const recurrence =
    form.term_pattern === 'none'
      ? null
      : {
          pattern: form.term_pattern,
          interval: Math.max(1, form.term_interval || 1),
          weekdays: [],
          endDate: null,
        };

  return {
    name: form.name.trim(),
    description: form.description.trim() || null,
    assignee_kind: form.assignee_kind,
    assignment_mode: form.assignment_mode,
    visibility: form.visibility,
    term_start_date: includeRecurringFields ? toTimestamp(form.term_start_date) : null,
    scheduled_revote_date: includeRecurringFields ? toTimestamp(form.scheduled_revote_date) : null,
    default_request_role:
      form.assignee_kind === 'guest' && !allowGuestRequestDefault
        ? false
        : form.default_request_role,
    default_invite_role:
      form.assignee_kind === 'guest' && !allowGuestInviteDefault ? false : form.default_invite_role,
    ...buildRecurringEventFields({
      isRecurring: includeRecurringFields && form.term_pattern !== 'none',
      recurrence,
    }),
  };
}

export function formatRoleTermLabel(
  role: Pick<
    GroupRole,
    'is_recurring' | 'recurrence_rule' | 'recurrence_interval' | 'scheduled_revote_date'
  >
) {
  if (!role.is_recurring) {
    return role.scheduled_revote_date
      ? `Revote ${toDateInput(role.scheduled_revote_date)}`
      : 'Open term';
  }

  if (role.recurrence_rule) {
    try {
      const recurrence = parseRRuleToFormState(role.recurrence_rule);
      if (recurrence.pattern === 'four-yearly') {
        return recurrence.interval > 1 ? `Every ${recurrence.interval * 4} years` : 'Every 4 years';
      }
      if (recurrence.pattern === 'yearly') {
        return recurrence.interval > 1 ? `Every ${recurrence.interval} years` : 'Every year';
      }
    } catch {
      return role.recurrence_rule;
    }
  }

  return role.recurrence_interval && role.recurrence_interval > 1
    ? `Every ${role.recurrence_interval} years`
    : 'Recurring term';
}

export function toDateInput(value: number | null | undefined) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

function toTimestamp(value: string) {
  if (!value) return null;
  return new Date(`${value}T00:00:00`).getTime();
}
