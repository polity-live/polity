import { z } from 'zod';

const dateInputPattern = /^\d{4}-\d{2}-\d{2}$/;

export const createAmendmentPathModeValues = ['hierarchy', 'workflow'] as const;
export const createAmendmentEvaluationModeValues = [
  'none',
  'fixed_date',
  'relative_to_vote',
] as const;

export const createAmendmentSearchSchema = z.object({
  groupId: z.string().optional(),
  sourceGroupId: z.string().optional(),
  targetGroupId: z.string().optional(),
  pathMode: z.enum(createAmendmentPathModeValues).optional(),
  workflowId: z.string().optional(),
  evaluationMode: z.enum(createAmendmentEvaluationModeValues).optional(),
  evaluationDate: z.string().regex(dateInputPattern).optional(),
  evaluationOffsetMonths: z.coerce.number().int().min(0).max(120).optional(),
  evaluationOffsetYears: z.coerce.number().int().min(0).max(20).optional(),
});

export type CreateAmendmentPathMode = (typeof createAmendmentPathModeValues)[number];
export type CreateAmendmentEvaluationMode = (typeof createAmendmentEvaluationModeValues)[number];
export type CreateAmendmentSearch = z.infer<typeof createAmendmentSearchSchema>;

export function normalizeCreateAmendmentSearch(search: CreateAmendmentSearch) {
  const targetGroupId = search.targetGroupId ?? search.groupId;

  return {
    ...search,
    groupId: targetGroupId,
    targetGroupId,
    pathMode: search.pathMode ?? 'hierarchy',
    evaluationMode: search.evaluationMode ?? 'none',
    evaluationOffsetMonths: search.evaluationOffsetMonths ?? 0,
    evaluationOffsetYears: search.evaluationOffsetYears ?? 0,
  };
}
