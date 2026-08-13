import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  parse: vi.fn(),
  buildRecurring: vi.fn(),
  formatDate: vi.fn(),
  timestamp: vi.fn(),
  translate: vi.fn(),
}));

vi.mock('@/features/events/logic/rruleHelpers', () => ({
  parseRRuleToFormState: mocks.parse,
}));

vi.mock('@/features/events/logic/buildRecurringEventFields', () => ({
  buildRecurringEventFields: mocks.buildRecurring,
}));

vi.mock('@/features/shared/logic/localDateTime', () => ({
  formatLocalDateInput: mocks.formatDate,
  toLocalTimestamp: mocks.timestamp,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: mocks.translate,
}));

import {
  emptyRoleEditorForm,
  formatRoleTermLabel,
  roleEditorFormToMutation,
  roleEditorFormToMutationWithOptions,
  roleToEditorForm,
  toDateInput,
} from '../roleFormHelpers';
import type { GroupRole, RoleEditorFormState } from '../../types/group.types';

function role(overrides: Record<string, unknown> = {}) {
  return {
    id: 'role-1',
    name: null,
    description: null,
    assignee_kind: null,
    assignment_mode: null,
    visibility: null,
    is_recurring: false,
    recurrence_rule: null,
    recurrence_interval: null,
    term_start_date: null,
    scheduled_revote_date: null,
    default_request_role: null,
    default_invite_role: null,
    ...overrides,
  } as unknown as GroupRole;
}

function form(overrides: Partial<RoleEditorFormState> = {}): RoleEditorFormState {
  return { ...emptyRoleEditorForm(), name: ' Role ', description: ' Description ', ...overrides };
}

beforeEach(() => {
  mocks.parse.mockReset();
  mocks.parse.mockImplementation(value => {
    if (value === 'four') return { pattern: 'four-yearly', interval: 2 };
    if (value === 'year') return { pattern: 'yearly', interval: 3 };
    if (value === 'throw') throw new Error('invalid rrule');
    return { pattern: 'monthly', interval: 4 };
  });
  mocks.buildRecurring.mockReset();
  mocks.buildRecurring.mockImplementation(value => ({ recurring_contract: value }));
  mocks.formatDate.mockReset();
  mocks.formatDate.mockImplementation(value => (value == null ? '' : `date:${value}`));
  mocks.timestamp.mockReset();
  mocks.timestamp.mockImplementation(value => (value ? `timestamp:${value}` : null));
  mocks.translate.mockReset();
  mocks.translate.mockImplementation((key, args) =>
    args ? `${key}:${JSON.stringify(args)}` : key
  );
});

describe('role form defaults and mapping', () => {
  it('creates the complete empty form contract', () => {
    expect(emptyRoleEditorForm()).toEqual({
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
    });
  });

  it('maps fallback role fields without recurrence', () => {
    expect(roleToEditorForm(role())).toEqual(emptyRoleEditorForm());
  });

  it.each([
    ['four', true, 'four-yearly', 2],
    ['year', true, 'yearly', 3],
    ['monthly', true, 'yearly', 4],
    ['monthly', false, 'none', 4],
  ] as const)('maps recurrence %s recurring=%s', (rule, isRecurring, pattern, interval) => {
    expect(
      roleToEditorForm(
        role({
          name: 'Chair',
          description: 'Description',
          assignee_kind: 'guest',
          assignment_mode: 'elected',
          visibility: 'authenticated',
          is_recurring: isRecurring,
          recurrence_rule: rule,
          recurrence_interval: 7,
          term_start_date: 100,
          scheduled_revote_date: 200,
          default_request_role: 1,
          default_invite_role: 0,
        })
      )
    ).toMatchObject({
      name: 'Chair',
      description: 'Description',
      assignee_kind: 'guest',
      assignment_mode: 'elected',
      visibility: 'authenticated',
      term_pattern: pattern,
      term_interval: interval,
      term_start_date: 'date:100',
      scheduled_revote_date: 'date:200',
      default_request_role: true,
      default_invite_role: false,
    });
  });

  it('preserves private visibility and falls back invalid role enums', () => {
    expect(roleToEditorForm(role({ visibility: 'private' })).visibility).toBe('private');
    expect(
      roleToEditorForm(
        role({ assignee_kind: 'invalid', assignment_mode: 'invalid', visibility: 'invalid' })
      )
    ).toMatchObject({ assignee_kind: 'member', assignment_mode: 'assigned', visibility: 'public' });
  });
});

describe('role form mutation mapping', () => {
  it('maps defaults, trims text, and disables recurrence for none', () => {
    const mutation = roleEditorFormToMutation(form({ term_pattern: 'none' }));
    expect(mutation).toMatchObject({
      name: 'Role',
      description: 'Description',
      term_start_date: null,
      scheduled_revote_date: null,
      default_request_role: false,
      default_invite_role: false,
      recurring_contract: { isRecurring: false, recurrence: null },
    });
  });

  it.each([
    [2, 2],
    [0, 1],
    [-2, 1],
  ])('clamps recurrence interval %s to %s', (termInterval, expected) => {
    roleEditorFormToMutation(form({ term_pattern: 'yearly', term_interval: termInterval }));
    expect(mocks.buildRecurring).toHaveBeenLastCalledWith({
      isRecurring: true,
      recurrence: { pattern: 'yearly', interval: expected, weekdays: [], endDate: null },
    });
  });

  it('can omit recurring dates and fields', () => {
    const mutation = roleEditorFormToMutationWithOptions(
      form({
        term_pattern: 'yearly',
        term_start_date: '2026-01-01',
        scheduled_revote_date: '2027-01-01',
      }),
      { includeRecurringFields: false }
    );
    expect(mutation).toMatchObject({
      term_start_date: null,
      scheduled_revote_date: null,
      recurring_contract: { isRecurring: false },
    });
    expect(mocks.timestamp).not.toHaveBeenCalled();
  });

  it.each([
    ['guest', false, false, false],
    ['guest', true, true, true],
    ['member', false, true, true],
    ['member', true, false, false],
  ] as const)(
    'maps %s defaults when guest defaults are allowed=%s',
    (assigneeKind, allowGuestDefaults, expectedRequest, expectedInvite) => {
      const mutation = roleEditorFormToMutationWithOptions(
        form({
          assignee_kind: assigneeKind,
          default_request_role: true,
          default_invite_role: true,
        }),
        {
          allowGuestRequestDefault: allowGuestDefaults,
          allowGuestInviteDefault: allowGuestDefaults,
        }
      );
      expect(mutation.default_request_role).toBe(expectedRequest);
      expect(mutation.default_invite_role).toBe(expectedInvite);
    }
  );

  it('maps an empty description and populated recurring timestamps', () => {
    expect(
      roleEditorFormToMutation(
        form({
          description: ' ',
          term_pattern: 'yearly',
          term_start_date: 'start',
          scheduled_revote_date: 'revote',
        })
      )
    ).toMatchObject({
      description: null,
      term_start_date: 'timestamp:start',
      scheduled_revote_date: 'timestamp:revote',
    });
  });
});

describe('formatRoleTermLabel', () => {
  it('formats open and scheduled non-recurring roles', () => {
    expect(formatRoleTermLabel(role({ is_recurring: false }))).toBe(
      'features.groups.roleTerms.open'
    );
    expect(formatRoleTermLabel(role({ is_recurring: false, scheduled_revote_date: 100 }))).toBe(
      'features.groups.roleTerms.revote:{"date":"date:100"}'
    );
  });

  it.each([
    ['four', 'features.groups.roleTerms.everyYears:{"count":8}'],
    ['year', 'features.groups.roleTerms.everyYears:{"count":3}'],
  ])('formats supported recurrence rule %s', (ruleValue, expected) => {
    expect(formatRoleTermLabel(role({ is_recurring: true, recurrence_rule: ruleValue }))).toBe(
      expected
    );
  });

  it('returns an invalid recurrence rule verbatim', () => {
    expect(formatRoleTermLabel(role({ is_recurring: true, recurrence_rule: 'throw' }))).toBe(
      'throw'
    );
  });

  it.each([
    ['monthly', 5, 'features.groups.roleTerms.everyYears:{"count":5}'],
    [null, 2, 'features.groups.roleTerms.everyYears:{"count":2}'],
    [null, 1, 'features.groups.roleTerms.recurring'],
    [null, null, 'features.groups.roleTerms.recurring'],
  ])('falls back from rule=%j interval=%j', (ruleValue, interval, expected) => {
    expect(
      formatRoleTermLabel(
        role({ is_recurring: true, recurrence_rule: ruleValue, recurrence_interval: interval })
      )
    ).toBe(expected);
  });

  it('delegates date input formatting', () => {
    expect(toDateInput(undefined)).toBe('');
    expect(toDateInput(123)).toBe('date:123');
  });
});
