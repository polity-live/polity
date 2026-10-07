import { z } from 'zod';

export const projectContextReferenceSchema = z.strictObject({
  kind: z.enum([
    'studio_project',
    'amendment',
    'workspace',
    'branch',
    'frame',
    'element',
    'text_selection',
    'city_design',
    'city_object',
    'city_feature',
  ]),
  id: z.string().min(1).max(200),
  label: z.string().min(1).max(300),
  origin: z.enum(['automatic', 'manual']),
  workspaceId: z.string().uuid().nullable().optional(),
  branchId: z.string().uuid().nullable().optional(),
  parentId: z.string().max(200).optional(),
});
export type ProjectContextReference = z.infer<typeof projectContextReferenceSchema>;
export const contextReferenceKey = (ref: ProjectContextReference) =>
  `${ref.kind}:${ref.workspaceId ?? ref.branchId ?? 'canonical'}:${ref.id}`;
export const fixedContextReference = (ref: ProjectContextReference) =>
  ['studio_project', 'amendment', 'workspace', 'branch', 'city_design'].includes(ref.kind);

export function mergeContextReferences(
  automatic: readonly ProjectContextReference[],
  manual: readonly ProjectContextReference[],
  excluded: ReadonlySet<string>
) {
  const unique = new Map<string, ProjectContextReference>();
  for (const ref of automatic)
    if (!excluded.has(contextReferenceKey(ref))) unique.set(contextReferenceKey(ref), ref);
  for (const ref of manual) unique.set(contextReferenceKey(ref), ref);
  return [...unique.values()];
}
