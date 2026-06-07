import { describe, expect, it } from 'vitest';
import {
  createAmendmentSearchSchema,
  normalizeCreateAmendmentSearch,
} from '@/features/create/logic/createAmendmentSearch';

describe('createAmendmentSearch', () => {
  it('keeps legacy groupId readable as targetGroupId', () => {
    const parsed = createAmendmentSearchSchema.parse({
      groupId: 'target-1',
      evaluationMode: 'none',
    });

    expect(normalizeCreateAmendmentSearch(parsed)).toMatchObject({
      groupId: 'target-1',
      targetGroupId: 'target-1',
      pathMode: 'hierarchy',
      evaluationMode: 'none',
    });
  });

  it('preserves explicit process and evaluation search values', () => {
    const parsed = createAmendmentSearchSchema.parse({
      sourceGroupId: 'source-1',
      targetGroupId: 'target-1',
      pathMode: 'workflow',
      workflowId: 'wf-1',
      evaluationMode: 'relative_to_vote',
      evaluationOffsetMonths: '3',
      evaluationOffsetYears: '1',
    });

    expect(normalizeCreateAmendmentSearch(parsed)).toMatchObject({
      sourceGroupId: 'source-1',
      targetGroupId: 'target-1',
      pathMode: 'workflow',
      workflowId: 'wf-1',
      evaluationMode: 'relative_to_vote',
      evaluationOffsetMonths: 3,
      evaluationOffsetYears: 1,
    });
  });
});
