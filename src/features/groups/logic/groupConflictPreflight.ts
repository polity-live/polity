import { z } from 'zod';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

export const groupConflictDraftRelationshipSchema = z.object({
  id: z.string(),
  group_id: z.string(),
  related_group_id: z.string(),
  relationship_type: z.string().nullable(),
  with_right: z.string().nullable(),
  status: z.string().nullable(),
  initiator_group_id: z.string().nullable().optional(),
});

export const groupConflictMembershipPreflightSchema = z.object({
  kind: z.literal('membership_activation'),
  group_id: z.string().optional(),
  membership_id: z.string().optional(),
  user_id: z.string().optional(),
});

const groupRightGrantPreflightSchema = z.object({
  id: z.string().optional(),
  right_key: z.enum([
    'informationRight',
    'amendmentRight',
    'rightToSpeak',
    'activeVotingRight',
    'passiveVotingRight',
  ]),
  holder_group_id: z.string(),
  scope_group_id: z.string(),
  status: z.enum(['active', 'requested', 'pending', 'rejected']).optional(),
  initiator_group_id: z.string().nullable().optional(),
});

const groupMembershipRulePreflightSchema = z.object({
  member_source_group_id: z.string(),
  member_target_group_id: z.string(),
  membership_mode: z.enum(['all_members', 'role_members', 'selected_source_groups']),
  required_source_role_id: z.string().nullable().optional(),
  eligible_origin_group_ids: z.array(z.string()).optional(),
});

export const groupConflictGroupConnectionUpsertPreflightSchema = z.object({
  kind: z.literal('group_connection_upsert'),
  connection_id: z.string().optional(),
  group_a_id: z.string(),
  group_b_id: z.string(),
  connection_type: z.enum(['hierarchy', 'peer']),
  parent_group_id: z.string().nullable(),
  child_group_id: z.string().nullable(),
  grants: z.array(groupRightGrantPreflightSchema),
  membership_rule: groupMembershipRulePreflightSchema.nullable().optional(),
});

export const groupConflictPreflightSchema = z
  .discriminatedUnion('kind', [
    groupConflictMembershipPreflightSchema,
    groupConflictGroupConnectionUpsertPreflightSchema,
  ])
  .superRefine((value, ctx) => {
    if (value.kind === 'membership_activation' && !value.group_id && !value.membership_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: translateText(
          'generated.inline.0147_group_id_or_membership_id_is_required_662be372'
        ),
        path: ['group_id'],
      });
    }

    if (value.kind === 'group_connection_upsert' && value.group_a_id === value.group_b_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: translateText(
          'generated.inline.0148_group_a_id_and_group_b_id_must_differ_53fcc395'
        ),
        path: ['group_b_id'],
      });
    }
  });

export type GroupConflictDraftRelationship = z.infer<typeof groupConflictDraftRelationshipSchema>;
export type GroupConflictMembershipPreflight = z.infer<
  typeof groupConflictMembershipPreflightSchema
>;
export type GroupConflictGroupConnectionUpsertPreflight = z.infer<
  typeof groupConflictGroupConnectionUpsertPreflightSchema
>;
export type GroupConflictPreflightInput = z.infer<typeof groupConflictPreflightSchema>;
