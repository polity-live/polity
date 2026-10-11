import { describe, expect, it } from 'vitest';
import { emailInvitations as de } from '@/i18n/locales/de/features/groups/emailInvitations';
import { emailInvitations as en } from '@/i18n/locales/en/features/groups/emailInvitations';
import {
  invitationManagementSchema,
  invitationTokenPattern,
  parseInvitationEmails,
  parseInvitationRecipients,
} from '../emailInvitations';

describe('email invitation input', () => {
  it('accepts exactly one recipient format and rejects oversized names', () => {
    const common = { action: 'preview', roleIds: [crypto.randomUUID()] };
    expect(
      invitationManagementSchema.safeParse({ ...common, emails: ['a@example.com'] }).success
    ).toBe(true);
    expect(
      invitationManagementSchema.safeParse({
        ...common,
        recipients: [{ email: 'a@example.com', firstName: ' Ada ' }],
      }).success
    ).toBe(true);
    expect(invitationManagementSchema.safeParse({ ...common }).success).toBe(false);
    expect(
      invitationManagementSchema.safeParse({
        ...common,
        emails: ['a@example.com'],
        recipients: [{ email: 'a@example.com' }],
      }).success
    ).toBe(false);
    expect(
      invitationManagementSchema.safeParse({
        ...common,
        recipients: [{ email: 'a@example.com', lastName: 'a'.repeat(101) }],
      }).success
    ).toBe(false);
  });
  it('normalizes named recipients, merges complementary names and reports contradictions', () => {
    expect(
      parseInvitationRecipients({
        recipients: [
          { email: ' A@EXAMPLE.COM ', firstName: ' Ada ' },
          { email: 'a@example.com', lastName: ' Lovelace ' },
          { email: 'b@example.com', firstName: '  ' },
        ],
      })
    ).toMatchObject({
      recipients: [
        { email: 'a@example.com', firstName: 'Ada', lastName: 'Lovelace' },
        { email: 'b@example.com', firstName: undefined },
      ],
      duplicates: ['a@example.com'],
      conflictingNames: [],
    });
    expect(
      parseInvitationRecipients({
        recipients: [
          { email: 'a@example.com', firstName: 'Ada' },
          { email: 'A@EXAMPLE.COM', firstName: 'Grace' },
        ],
      }).conflictingNames
    ).toEqual(['a@example.com']);
  });
  it('keeps every invitation state and error translated in German and English', () => {
    function leaves(value: Record<string, unknown>, prefix = ''): Record<string, string> {
      return Object.fromEntries(
        Object.entries(value).flatMap(([key, entry]) =>
          typeof entry === 'string'
            ? [[prefix + key, entry]]
            : Object.entries(leaves(entry as Record<string, unknown>, prefix + key + '.'))
        )
      );
    }
    const german = leaves(de),
      english = leaves(en);
    expect(Object.keys(german).sort()).toEqual(Object.keys(english).sort());
    for (const [key, text] of Object.entries(german)) {
      expect(text.trim().length).toBeGreaterThan(0);
      expect(text.match(/{{\w+}}/g) ?? []).toEqual(english[key].match(/{{\w+}}/g) ?? []);
    }
  });
  it('splits mixed lists, normalizes comparisons and preserves provider-specific aliases', () => {
    expect(
      parseInvitationEmails(
        ' Person@Example.com; person@example.com\nfirst.last+group@gmail.com, bad-address'
      )
    ).toEqual({
      emails: ['person@example.com', 'first.last+group@gmail.com'],
      duplicates: ['person@example.com'],
      invalid: ['bad-address'],
    });
  });
  it('rejects empty roles, oversized input and arbitrary token strings', () => {
    expect(
      invitationManagementSchema.safeParse({
        action: 'create',
        emails: 'a@example.com',
        roleIds: [],
      }).success
    ).toBe(false);
    expect(
      invitationManagementSchema.safeParse({
        action: 'create',
        emails: 'a'.repeat(32_001),
        roleIds: [crypto.randomUUID()],
      }).success
    ).toBe(false);
    expect(invitationTokenPattern.test('a'.repeat(43))).toBe(true);
    expect(invitationTokenPattern.test('../' + 'a'.repeat(40))).toBe(false);
  });
});
