import { z } from 'zod';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

export const invitationTokenPattern = /^[A-Za-z0-9_-]{43}$/;
export function parseInvitationEmails(input: string | string[]) {
  const entries = (Array.isArray(input) ? input.join('\n') : input)
    .split(/[\n\r,;]+/)
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
  const emails: string[] = [],
    invalid: string[] = [],
    duplicates: string[] = [];
  const seen = new Set<string>();
  for (const email of entries) {
    if (!z.email().safeParse(email).success) invalid.push(email);
    else if (seen.has(email)) duplicates.push(email);
    else {
      seen.add(email);
      emails.push(email);
    }
  }
  return { emails, invalid, duplicates };
}

export type InvitationDeliveryStatus =
  'sending' | 'sent' | 'delivered' | 'bounced' | 'complained' | 'failed' | 'unknown';
export interface EmailInvitationRow {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  role_names: string[];
  expires_at: string | null;
  state: 'pending' | 'accepted' | 'revoked' | 'expired';
  delivery_status: InvitationDeliveryStatus;
  last_attempt_at: string | null;
  accepted_at: string | null;
}
export interface InvitationResult {
  email: string;
  firstName?: string;
  lastName?: string;
  status: 'ready' | 'member' | 'invited' | InvitationDeliveryStatus;
  invitationId?: string;
}
export interface InvitationPreview {
  available: number;
  results: InvitationResult[];
}
export interface PublicInvitation {
  groupName: string;
  inviterName: string;
  maskedEmail: string;
  roles: string[];
  expiresAt: string | null;
  state: EmailInvitationRow['state'];
  matchesEmail: boolean;
  emailConfirmed: boolean;
}
export interface InvitationRecipient {
  email: string;
  firstName?: string;
  lastName?: string;
}
export function parseInvitationRecipients(input: {
  emails?: string | string[];
  recipients?: InvitationRecipient[];
}) {
  const legacy = input.emails === undefined ? undefined : parseInvitationEmails(input.emails);
  const source: InvitationRecipient[] =
    input.recipients ?? legacy?.emails.map(email => ({ email })) ?? [];
  const recipients = new Map<string, InvitationRecipient>();
  const invalid = [...(legacy?.invalid ?? [])];
  const duplicates = [...(legacy?.duplicates ?? [])];
  const conflictingNames: string[] = [];
  for (const entry of source) {
    const email = entry.email.trim().toLowerCase();
    if (!z.email().safeParse(email).success) {
      invalid.push(email);
      continue;
    }
    const next = {
      email,
      firstName: entry.firstName?.trim() || undefined,
      lastName: entry.lastName?.trim() || undefined,
    };
    const previous = recipients.get(email);
    if (previous) {
      duplicates.push(email);
      if (
        (previous.firstName && next.firstName && previous.firstName !== next.firstName) ||
        (previous.lastName && next.lastName && previous.lastName !== next.lastName)
      )
        conflictingNames.push(email);
      recipients.set(email, {
        email,
        firstName: previous.firstName || next.firstName,
        lastName: previous.lastName || next.lastName,
      });
    } else recipients.set(email, next);
  }
  return { recipients: [...recipients.values()], invalid, duplicates, conflictingNames };
}
const recipientSchema = z.object({
  email: z.string().max(320),
  firstName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
});
export const invitationRequestSchema = z
  .object({
    emails: z.union([z.string().max(32_000), z.array(z.string().max(320)).max(500)]).optional(),
    recipients: z.array(recipientSchema).min(1).max(500).optional(),
    roleIds: z.array(z.uuid()).min(1).max(50),
    language: z.enum(['de', 'en']).default('de'),
    idempotencyKey: z.uuid().optional(),
  })
  .refine(input => (input.emails !== undefined) !== (input.recipients !== undefined), {
    error: () => translateText('features.groups.emailInvitations.chooseOneRecipientFormat'),
    path: ['recipients'],
  });
export const invitationManagementSchema = z.discriminatedUnion('action', [
  invitationRequestSchema.safeExtend({ action: z.enum(['preview', 'create']) }),
  z.object({
    action: z.literal('revoke'),
    invitationId: z.uuid(),
    idempotencyKey: z.uuid().optional(),
  }),
  z.object({
    action: z.literal('resend'),
    invitationId: z.uuid(),
    idempotencyKey: z.uuid().optional(),
  }),
]);
