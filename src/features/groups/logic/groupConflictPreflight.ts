import { z } from 'zod';

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

const networkLinkRightPreflightSchema = z.object({
  id: z.string().optional(),
  right_key: z.enum([
    'informationRight',
    'amendmentRight',
    'rightToSpeak',
    'activeVotingRight',
    'passiveVotingRight',
  ]),
  direction: z.enum(['forward', 'backward', 'bidirectional']),
  status: z.enum(['active', 'requested', 'pending', 'rejected']).optional(),
  initiator_group_id: z.string().nullable().optional(),
});

const networkLinkMembershipRulePreflightSchema = z.object({
  membership_mode: z.enum(['none', 'all_members', 'role_members', 'selected_source_groups']),
  role_id: z.string().nullable().optional(),
  source_group_ids: z.array(z.string()).nullable().optional(),
});

const networkLinkMembershipRulesPreflightSchema = z.object({
  forward: networkLinkMembershipRulePreflightSchema,
  backward: networkLinkMembershipRulePreflightSchema,
});

export const groupConflictNetworkLinkUpsertPreflightSchema = z.object({
  kind: z.literal('network_link_upsert'),
  link_id: z.string().optional(),
  source_group_id: z.string(),
  target_group_id: z.string(),
  structural_relation: z.enum(['parent_child', 'sibling']),
  rights: z.array(networkLinkRightPreflightSchema),
  membership_rules: networkLinkMembershipRulesPreflightSchema.optional(),
  membership_rule: networkLinkMembershipRulePreflightSchema.optional(),
});

export const groupConflictPreflightSchema = z
  .discriminatedUnion('kind', [
    groupConflictMembershipPreflightSchema,
    groupConflictNetworkLinkUpsertPreflightSchema,
  ])
  .superRefine((value, ctx) => {
    if (value.kind === 'membership_activation' && !value.group_id && !value.membership_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'group_id or membership_id is required',
        path: ['group_id'],
      });
    }

    if (value.kind === 'network_link_upsert' && value.source_group_id === value.target_group_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'source_group_id and target_group_id must differ',
        path: ['target_group_id'],
      });
    }

    if (
      value.kind === 'network_link_upsert' &&
      value.rights.length === 0 &&
      (!value.membership_rule || value.membership_rule.membership_mode === 'none') &&
      (!value.membership_rules ||
        (value.membership_rules.forward.membership_mode === 'none' &&
          value.membership_rules.backward.membership_mode === 'none'))
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'at least one right or a membership rule is required',
        path: ['rights'],
      });
    }
  });

export type GroupConflictDraftRelationship = z.infer<typeof groupConflictDraftRelationshipSchema>;
export type GroupConflictMembershipPreflight = z.infer<
  typeof groupConflictMembershipPreflightSchema
>;
export type GroupConflictNetworkLinkUpsertPreflight = z.infer<
  typeof groupConflictNetworkLinkUpsertPreflightSchema
>;
export type GroupConflictPreflightInput = z.infer<typeof groupConflictPreflightSchema>;
