/* @vitest-environment jsdom */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const initializeProcessPath = vi.fn();
vi.mock('@/zero/amendments/useAmendmentActions', () => ({
  useAmendmentActions: () => ({ initializeProcessPath }),
}));

import { useCreateAmendmentPath } from '../useCreateAmendmentPath';

describe('useCreateAmendmentPath A04 branch accountability', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('returns null for an empty path', async () => {
    const { result } = renderHook(() => useCreateAmendmentPath());
    await expect(
      result.current.createAmendmentPath({
        amendmentId: 'amendment',
        amendmentTitle: 'Title',
        amendmentReason: null,
        enrichedPath: [],
      })
    ).resolves.toBeNull();
    expect(initializeProcessPath).not.toHaveBeenCalled();
  });

  it('uses all default options and null source references', async () => {
    initializeProcessPath.mockReturnValue('default-result');
    const { result } = renderHook(() => useCreateAmendmentPath());
    let value: any;
    await act(async () => {
      value = await result.current.createAmendmentPath({
        amendmentId: 'amendment',
        amendmentTitle: 'Title',
        amendmentReason: null,
        enrichedPath: [{ groupId: 'group' }] as any,
      });
    });
    expect(value).toBe('default-result');
    expect(initializeProcessPath).toHaveBeenCalledWith(
      expect.objectContaining({
        source_group_id: null,
        workflow_id: null,
        path_mode: 'hierarchy',
        evaluation_mode: 'none',
        evaluation_date: null,
        evaluation_offset_months: null,
        evaluation_offset_years: null,
      })
    );
  });

  it('forwards every explicit process and evaluation option', async () => {
    initializeProcessPath.mockReturnValue('explicit-result');
    const { result } = renderHook(() => useCreateAmendmentPath());
    await act(async () => {
      await result.current.createAmendmentPath({
        amendmentId: 'amendment',
        amendmentTitle: 'Title',
        amendmentReason: 'Reason',
        enrichedPath: [{ groupId: 'group' }] as any,
        sourceGroupId: 'source',
        workflowId: 'workflow',
        pathMode: 'workflow',
        evaluationMode: 'fixed_date',
        evaluationDate: 123,
        evaluationOffsetMonths: 2,
        evaluationOffsetYears: 1,
      });
    });
    expect(initializeProcessPath).toHaveBeenCalledWith(
      expect.objectContaining({
        source_group_id: 'source',
        workflow_id: 'workflow',
        path_mode: 'workflow',
        evaluation_mode: 'fixed_date',
        evaluation_date: 123,
        evaluation_offset_months: 2,
        evaluation_offset_years: 1,
      })
    );
  });
});
