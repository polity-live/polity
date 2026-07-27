import { z } from 'zod';

export const groupConflictKindSchema = z.enum([
  'hierarchy_member_overlap',
  'hierarchy_duplicate_path',
  'sibling_source_overlap',
  'sibling_connected_membership_missing',
  'permission_blocked_resolution',
]);

export const groupConflictResolutionCodeSchema = z.enum([
  'align_membership_before_activation',
  'leave_other_subgroup',
  'choose_other_group',
  'contact_admin',
  'leave_other_source_group',
  'contact_source_admins',
  'clarify_source_memberships',
  'align_memberships',
  'contact_other_group',
  'remove_duplicate_path',
  'contact_responsible_group',
  'clean_source_groups',
]);

export const groupConflictUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  handle: z.string().nullable().optional(),
  avatar_url: z.string().nullable().optional(),
});

export const groupConflictGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  group_type: z.string().nullable().optional(),
});

export const groupConflictPathSchema = z.object({
  base_group_id: z.string(),
  target_group_id: z.string(),
  group_ids: z.array(z.string()),
  group_names: z.array(z.string()),
});

export const groupConflictResolutionSchema = z.object({
  // Optional for payloads created by older clients and persisted retry queues.
  code: groupConflictResolutionCodeSchema.optional(),
  label: z.string(),
  description: z.string(),
  self_service: z.boolean(),
  group_id: z.string().nullable().optional(),
  required_role: z.string().nullable().optional(),
});

export const groupConflictDetailsSchema = z.object({
  users: z.array(groupConflictUserSchema).default([]),
  groups: z.array(groupConflictGroupSchema).default([]),
  source_groups: z.array(groupConflictGroupSchema).default([]),
  paths: z.array(groupConflictPathSchema).default([]),
  target_group: groupConflictGroupSchema.nullable().optional(),
  blocked_by_group: groupConflictGroupSchema.nullable().optional(),
});

export const groupConflictSchema = z.object({
  kind: groupConflictKindSchema,
  blocking: z.boolean(),
  summary: z.string(),
  explanation: z.string(),
  details: groupConflictDetailsSchema,
  resolutions: z.array(groupConflictResolutionSchema).default([]),
});

export const groupConflictResponseSchema = z.object({
  blocking: z.boolean(),
  summary: z.string().nullable().optional(),
  conflicts: z.array(groupConflictSchema).default([]),
});

export type GroupConflictKind = z.infer<typeof groupConflictKindSchema>;
export type GroupConflictResolutionCode = z.infer<typeof groupConflictResolutionCodeSchema>;
export type GroupConflictUser = z.infer<typeof groupConflictUserSchema>;
export type GroupConflictGroup = z.infer<typeof groupConflictGroupSchema>;
export type GroupConflictPath = z.infer<typeof groupConflictPathSchema>;
export type GroupConflictResolution = z.infer<typeof groupConflictResolutionSchema>;
export type GroupConflictDetails = z.infer<typeof groupConflictDetailsSchema>;
export type GroupConflict = z.infer<typeof groupConflictSchema>;
export type GroupConflictResponse = z.infer<typeof groupConflictResponseSchema>;

export const GROUP_CONFLICT_ERROR_PREFIX = '__GROUP_CONFLICT__:';

export function buildGroupConflictResponse(
  conflicts: readonly GroupConflict[]
): GroupConflictResponse {
  const normalizedConflicts = groupConflictResponseSchema.shape.conflicts.parse(conflicts);
  return {
    blocking: normalizedConflicts.some(conflict => conflict.blocking),
    summary: normalizedConflicts[0]?.summary ?? null,
    conflicts: normalizedConflicts,
  };
}

export function mergeGroupConflictResponses(
  responses: readonly (GroupConflictResponse | null | undefined)[]
): GroupConflictResponse {
  const conflicts = responses.flatMap(response => response?.conflicts ?? []);
  return buildGroupConflictResponse(conflicts);
}

export function encodeGroupConflictResponse(response: GroupConflictResponse): string {
  return `${GROUP_CONFLICT_ERROR_PREFIX}${JSON.stringify(groupConflictResponseSchema.parse(response))}`;
}

export function parseGroupConflictResponseMessage(
  message: string | null | undefined
): GroupConflictResponse | null {
  if (!message || !message.startsWith(GROUP_CONFLICT_ERROR_PREFIX)) {
    return null;
  }

  const payload = message.slice(GROUP_CONFLICT_ERROR_PREFIX.length);
  try {
    return groupConflictResponseSchema.parse(JSON.parse(payload));
  } catch {
    return null;
  }
}

export class GroupConflictError extends Error {
  readonly response: GroupConflictResponse;

  constructor(response: GroupConflictResponse) {
    super(response.summary ?? response.conflicts[0]?.summary ?? 'Group conflict');
    this.name = 'GroupConflictError';
    this.response = response;
  }
}

export function toGroupConflictError(error: unknown): GroupConflictError | null {
  if (error instanceof GroupConflictError) {
    return error;
  }

  if (!(error instanceof Error)) {
    return null;
  }

  const response = parseGroupConflictResponseMessage(error.message);
  if (!response) {
    return null;
  }

  return new GroupConflictError(response);
}

export function throwGroupConflictResponse(response: GroupConflictResponse): never {
  throw new Error(encodeGroupConflictResponse(response));
}
