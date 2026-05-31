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

export const groupConflictRelationshipPreflightSchema = z.object({
  kind: z.literal('relationship_activation'),
  relationship_ids: z.array(z.string()).optional(),
  draft_relationships: z.array(groupConflictDraftRelationshipSchema).optional(),
});

export const groupConflictSiblingConfigurationPreflightSchema = z.object({
  kind: z.literal('sibling_configuration'),
  group_id: z.string(),
  group_type: z.string(),
  connected_group_id: z.string().nullable().optional(),
  sibling_membership_mode: z.string().nullable().optional(),
  sibling_role_id: z.string().nullable().optional(),
  parliament_source_group_ids: z.array(z.string()).default([]),
});

export const groupConflictPreflightSchema = z
  .discriminatedUnion('kind', [
    groupConflictMembershipPreflightSchema,
    groupConflictRelationshipPreflightSchema,
    groupConflictSiblingConfigurationPreflightSchema,
  ])
  .superRefine((value, ctx) => {
    if (value.kind === 'membership_activation' && !value.group_id && !value.membership_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'group_id or membership_id is required',
        path: ['group_id'],
      });
    }

    if (
      value.kind === 'relationship_activation' &&
      (value.relationship_ids?.length ?? 0) === 0 &&
      (value.draft_relationships?.length ?? 0) === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'relationship_ids or draft_relationships is required',
        path: ['relationship_ids'],
      });
    }
  });

export type GroupConflictDraftRelationship = z.infer<typeof groupConflictDraftRelationshipSchema>;
export type GroupConflictMembershipPreflight = z.infer<
  typeof groupConflictMembershipPreflightSchema
>;
export type GroupConflictRelationshipPreflight = z.infer<
  typeof groupConflictRelationshipPreflightSchema
>;
export type GroupConflictSiblingConfigurationPreflight = z.infer<
  typeof groupConflictSiblingConfigurationPreflightSchema
>;
export type GroupConflictPreflightInput = z.infer<typeof groupConflictPreflightSchema>;
