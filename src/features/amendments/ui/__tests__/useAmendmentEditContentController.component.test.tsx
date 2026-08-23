/* @vitest-environment jsdom */

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const hookMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  updateAmendment: vi.fn(async () => undefined),
  createAmendment: vi.fn(async () => undefined),
  updateProcessBranch: vi.fn(async () => undefined),
  updateDocument: vi.fn(() => 'update-document-result'),
  waitForClientApply: vi.fn(async (result: unknown) => {
    if (result instanceof Promise) await result;
  }),
  syncEntityHashtags: vi.fn(async () => undefined),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  createTimelineEvent: vi.fn(async () => undefined),
  documentEditingMode: 'edit' as string | null,
  document: null as any,
  amendmentHashtags: [] as any[],
  allHashtags: [] as any[],
  controllingEvent: null as any,
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => hookMocks.navigate,
}));

vi.mock('@/zero/amendments/useAmendmentActions', () => ({
  useAmendmentActions: () => ({
    updateAmendment: hookMocks.updateAmendment,
    createAmendment: hookMocks.createAmendment,
    updateProcessBranch: hookMocks.updateProcessBranch,
  }),
}));

vi.mock('@/zero/documents/useDocumentActions', () => ({
  useDocumentActions: () => ({
    updateDocument: hookMocks.updateDocument,
  }),
}));

vi.mock('@/zero/documents/useDocumentState', () => ({
  useDocumentState: () => ({
    document:
      hookMocks.document ??
      ({ id: 'document-1', editing_mode: hookMocks.documentEditingMode } as any),
  }),
}));

vi.mock('@/zero/common', () => ({
  useCommonState: () => ({
    amendmentHashtags: hookMocks.amendmentHashtags,
    allHashtags: hookMocks.allHashtags,
  }),
  useCommonActions: () => ({
    syncEntityHashtags: hookMocks.syncEntityHashtags,
  }),
}));

vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: (result: unknown) => hookMocks.waitForClientApply(result),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (
    key: string,
    paramsOrFallback?: string | Record<string, unknown>,
    fallback?: string
  ) => (typeof paramsOrFallback === 'string' ? paramsOrFallback : (fallback ?? key)),
  useTranslation: () => ({
    t: (key: string, paramsOrFallback?: string | Record<string, unknown>, fallback?: string) =>
      typeof paramsOrFallback === 'string' ? paramsOrFallback : (fallback ?? key),
  }),
}));

vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: {
    error: (...args: unknown[]) => hookMocks.toastError(...args),
    success: (...args: unknown[]) => hookMocks.toastSuccess(...args),
  },
}));

vi.mock('@/features/timeline/utils/createTimelineEvent', () => ({
  createTimelineEvent: (...args: unknown[]) =>
    (hookMocks.createTimelineEvent as (...values: unknown[]) => unknown)(...args),
}));

vi.mock('@/features/amendments/logic/amendmentSettingsEventPhase', () => ({
  deriveControllingEventForSettings: () => hookMocks.controllingEvent,
}));

import {
  amendmentEditContentControllerInternals,
  useAmendmentEditContentController,
} from '../useAmendmentEditContentController';

const amendment = {
  id: 'amendment-1',
  title: 'A1',
  preamble: 'A1 subtitle',
  code: 'A-1',
  image_url: null,
  video_url: null,
  internal_cr_voting_close_trigger: 'all_collaborators_voted',
  internal_cr_voting_duration_minutes: null,
  internal_cr_resolution_visibility: 'public',
  visibility: 'public',
  document_id: 'document-1',
  tags: [],
};

function buildProcess(branchMode = 'suggest_internal') {
  return {
    current_process_run: {
      active_branch_id: 'branch-b',
      branches: [
        {
          id: 'branch-a',
          title: 'Branch A',
          editing_mode: 'edit',
          status: 'scheduled',
          resolution: null,
          created_at: 1,
          step_runs: [],
        },
        {
          id: 'branch-b',
          title: 'Branch B',
          editing_mode: branchMode,
          status: 'scheduled',
          resolution: null,
          created_at: 2,
          step_runs: [],
        },
      ],
    },
  };
}

afterEach(() => {
  cleanup();
  hookMocks.documentEditingMode = 'edit';
  hookMocks.document = null;
  hookMocks.amendmentHashtags = [];
  hookMocks.allHashtags = [];
  hookMocks.controllingEvent = null;
  Object.values(hookMocks).forEach(value => {
    const maybeMock = value as { mockClear?: () => void } | null;
    maybeMock?.mockClear?.();
  });
});

describe('useAmendmentEditContentController', () => {
  it('normalizes settings, initializes sparse records, tabs, hashtags, locations, and review state', async () => {
    expect(
      amendmentEditContentControllerInternals.normalizeInternalCRVotingCloseTrigger('after_minutes')
    ).toBe('after_minutes');
    expect(
      amendmentEditContentControllerInternals.normalizeInternalCRVotingCloseTrigger('invalid')
    ).toBe('all_collaborators_voted');
    expect(
      amendmentEditContentControllerInternals.normalizeInternalCRResolutionVisibility(
        'collaborators'
      )
    ).toBe('collaborators');
    expect(
      amendmentEditContentControllerInternals.normalizeInternalCRResolutionVisibility(null)
    ).toBe('public');
    expect(
      amendmentEditContentControllerInternals.clearPendingWorkflowModeForSource(
        { branchId: 'a', mode: 'edit' },
        'a'
      )
    ).toBeNull();
    expect(
      amendmentEditContentControllerInternals.clearPendingWorkflowModeForSource(
        { branchId: 'b', mode: 'edit' },
        'a'
      )
    ).toEqual({ branchId: 'b', mode: 'edit' });

    hookMocks.amendmentHashtags = [
      { hashtag: { tag: 'one' } },
      { hashtag: null },
      { hashtag: { tag: null } },
    ];
    hookMocks.allHashtags = [{ id: 'tag-one', tag: 'one' }];
    hookMocks.document = null;
    hookMocks.controllingEvent = { id: 'event', title: null };
    const onTabChange = vi.fn();
    const sparseAmendment = {
      ...amendment,
      title: null,
      preamble: null,
      code: null,
      image_url: null,
      video_url: null,
      internal_cr_voting_close_trigger: 'invalid',
      internal_cr_voting_duration_minutes: null,
      internal_cr_resolution_visibility: 'invalid',
      visibility: null,
      tags: ['legacy'],
      country: null,
      region: null,
      post_code: null,
      city: null,
      street: null,
      house_number: null,
      latitude: null,
      longitude: null,
      location_kind: null,
      location_place_id: null,
      location_boundary_source: null,
      location_geometry: null,
      location_bounds: null,
    };
    const { result, rerender } = renderHook(props => useAmendmentEditContentController(props), {
      initialProps: {
        amendmentId: 'amendment-1',
        amendment: sparseAmendment,
        amendmentProcess: buildProcess('invalid'),
        currentUserId: 'user-1',
        isLoading: false,
        mode: 'edit' as const,
        activeTab: 'workflow' as const,
        onTabChange,
      } as any,
    });
    await waitFor(() => expect(result.current.formData.hashtags).toEqual(['one']));
    expect(result.current.formData).toMatchObject({
      title: '',
      subtitle: '',
      code: '',
      imageURL: '',
      videoURL: '',
      internalCRVotingCloseTrigger: 'all_collaborators_voted',
      internalCRVotingDurationMinutes: 5,
      internalCRResolutionVisibility: 'public',
      visibility: 'public',
      country: '',
      region: '',
    });
    expect(result.current.workflowMenuValue).toBe('edit');
    expect(result.current.controllingEvent?.title).toBe(
      'features.amendments.editContent.eventFallback'
    );

    act(() => result.current.onTabChange('location'));
    expect(onTabChange).toHaveBeenCalledWith('location');
    rerender({
      amendmentId: 'amendment-1',
      amendment: sparseAmendment,
      amendmentProcess: buildProcess('invalid'),
      currentUserId: 'user-1',
      isLoading: false,
      mode: 'edit',
      activeTab: undefined,
      onTabChange,
    } as any);
    await waitFor(() => expect(result.current.activeTab).toBe('general'));

    act(() => {
      result.current.handleLocationFieldChange('city', 'Berlin');
      result.current.handleLocationCoordinatesChange({ latitude: 1, longitude: 2 });
      result.current.handleLocationShapeChange(null);
    });
    expect(result.current.formData).toMatchObject({ city: 'Berlin', latitude: 1, longitude: 2 });
    act(() => result.current.handleLocationCoordinatesChange(null));
    expect(result.current.formData).toMatchObject({ latitude: null, longitude: null });
    expect(result.current.locationSummary).toContain('Berlin');

    const preventDefault = vi.fn();
    act(() => result.current.onFormSubmit({ preventDefault } as never));
    expect(result.current.showReview).toBe(false);
    const requestSubmit = vi.fn();
    (result.current.formRef as any).current = { requestSubmit };
    act(() => result.current.confirmCreate());
    expect(requestSubmit).toHaveBeenCalled();

    hookMocks.amendmentHashtags = null as never;
    const legacyTags = renderHook(() =>
      useAmendmentEditContentController({
        amendmentId: 'legacy',
        amendment: { ...amendment, id: 'legacy', tags: ['legacy'] },
        amendmentProcess: null,
        currentUserId: 'user-1',
        isLoading: false,
        mode: 'edit',
      } as any)
    );
    await waitFor(() => expect(legacyTags.result.current.formData.hashtags).toEqual(['legacy']));
    const invalidTags = renderHook(() =>
      useAmendmentEditContentController({
        amendmentId: 'invalid-tags',
        amendment: { ...amendment, id: 'invalid-tags', tags: 'invalid' },
        amendmentProcess: null,
        currentUserId: 'user-1',
        isLoading: false,
        mode: 'edit',
      } as any)
    );
    await waitFor(() => expect(invalidTags.result.current.formData.hashtags).toEqual([]));
  });

  it('keeps a pending branch mode change visible during amendment refreshes', async () => {
    let resolveBranchUpdate: (() => void) | undefined;
    hookMocks.updateProcessBranch.mockImplementationOnce(
      () =>
        new Promise<undefined>(resolve => {
          resolveBranchUpdate = () => resolve(undefined);
        })
    );

    const initialProps = {
      amendmentId: 'amendment-1',
      amendment,
      amendmentProcess: buildProcess(),
      currentUserId: 'user-1',
      isLoading: false,
      mode: 'edit' as const,
    };

    const { result, rerender } = renderHook(props => useAmendmentEditContentController(props), {
      initialProps: initialProps as any,
    });

    await waitFor(() => {
      expect(result.current.selectedWorkflowBranchId).toBe('branch-b');
      expect(result.current.formData.workflowStatus).toBe('suggest_internal');
    });
    await act(async () => result.current.handleWorkflowStatusChange('suggest_internal'));

    let changePromise: Promise<void> = Promise.resolve();
    await act(async () => {
      changePromise = result.current.handleWorkflowStatusChange('vote_internal');
      await Promise.resolve();
    });

    expect(result.current.formData.workflowStatus).toBe('vote_internal');

    rerender({
      ...initialProps,
      amendment: {
        ...amendment,
        code: 'A-1-refresh',
      },
    });

    expect(result.current.formData.workflowStatus).toBe('vote_internal');

    await act(async () => {
      resolveBranchUpdate?.();
      await changePromise;
    });

    rerender({
      ...initialProps,
      amendmentProcess: buildProcess('vote_internal'),
    });
    await waitFor(() => expect(result.current.formData.workflowStatus).toBe('vote_internal'));

    rerender({
      ...initialProps,
      amendmentProcess: { current_process_run: { active_branch_id: null, branches: [] } },
    });
    await waitFor(() => expect(result.current.selectedWorkflowBranchId).toBeNull());

    expect(hookMocks.updateProcessBranch).toHaveBeenCalledWith({
      id: 'branch-b',
      editing_mode: 'vote_internal',
    });
    expect(hookMocks.updateDocument).not.toHaveBeenCalled();
  });

  it('resets and hydrates all settings and hashtags when the amendment id changes', async () => {
    hookMocks.amendmentHashtags = [{ hashtag: { tag: 'first' } }];
    const initialProps = {
      amendmentId: 'amendment-1',
      amendment,
      amendmentProcess: buildProcess(),
      currentUserId: 'user-1',
      isLoading: false,
      mode: 'edit' as const,
    };
    const view = renderHook(props => useAmendmentEditContentController(props), {
      initialProps: initialProps as any,
    });
    await waitFor(() => expect(view.result.current.formData.hashtags).toEqual(['first']));

    hookMocks.amendmentHashtags = [{ hashtag: { tag: 'second' } }];
    view.rerender({
      ...initialProps,
      amendmentId: 'amendment-2',
      amendment: {
        ...amendment,
        id: 'amendment-2',
        title: 'A2',
        preamble: 'Second subtitle',
        code: 'Second text',
        visibility: 'authenticated',
      },
    } as any);

    await waitFor(() =>
      expect(view.result.current.formData).toMatchObject({
        title: 'A2',
        subtitle: 'Second subtitle',
        code: 'Second text',
        visibility: 'authenticated',
        hashtags: ['second'],
      })
    );
  });

  it('persists workflow status to the amendment document when no branch exists yet', async () => {
    hookMocks.documentEditingMode = 'suggest_internal';
    const initialProps = {
      amendmentId: 'amendment-1',
      amendment,
      amendmentProcess: {
        current_process_run: {
          active_branch_id: null,
          branches: [],
        },
      },
      currentUserId: 'user-1',
      isLoading: false,
      mode: 'edit' as const,
    };

    const { result } = renderHook(props => useAmendmentEditContentController(props), {
      initialProps: initialProps as any,
    });

    await waitFor(() => {
      expect(result.current.selectedWorkflowBranchId).toBe(null);
      expect(result.current.formData.workflowStatus).toBe('suggest_internal');
    });

    act(() =>
      result.current.setFormData(previous => ({
        ...previous,
        internalCRVotingCloseTrigger: 'after_minutes',
        internalCRVotingDurationMinutes: 8,
      }))
    );

    await act(async () => {
      await result.current.handleWorkflowStatusChange('vote_internal');
    });

    expect(result.current.formData.workflowStatus).toBe('vote_internal');
    expect(hookMocks.updateProcessBranch).not.toHaveBeenCalled();
    expect(hookMocks.updateDocument).toHaveBeenCalledWith({
      id: 'document-1',
      editing_mode: 'vote_internal',
    });
    expect(hookMocks.waitForClientApply).toHaveBeenCalledWith('update-document-result');
  });

  it('covers create review, populated create submission, image removal guard, and hashtag sync fallbacks', async () => {
    const { result } = renderHook(() =>
      useAmendmentEditContentController({
        amendmentId: 'new-amendment',
        amendment: null,
        amendmentProcess: null,
        currentUserId: 'user-1',
        isLoading: false,
        mode: 'create',
      } as any)
    );
    expect(result.current.isCreating).toBe(true);
    act(() => result.current.handleRemoveImage());
    expect(hookMocks.updateAmendment).not.toHaveBeenCalled();
    await act(async () => result.current.handleWorkflowStatusChange('view'));
    expect(result.current.formData.workflowStatus).toBe('view');

    act(() =>
      result.current.setFormData(previous => ({
        ...previous,
        title: 'Created',
        subtitle: 'Created subtitle',
        code: 'C-1',
        imageURL: 'image',
        videoURL: 'video',
        internalCRVotingCloseTrigger: 'after_minutes',
        internalCRVotingDurationMinutes: 12,
        internalCRResolutionVisibility: 'collaborators',
        visibility: 'private',
        hashtags: ['one'],
        country: 'DE',
        region: 'BE',
        post_code: '10115',
        city: 'Berlin',
        street: 'Street',
        house_number: '1',
        latitude: 1,
        longitude: 2,
      }))
    );
    const preventDefault = vi.fn();
    act(() => result.current.onFormSubmit({ preventDefault } as never));
    expect(result.current.showReview).toBe(true);
    act(() => result.current.confirmCreate());
    act(() => result.current.onFormSubmit({ preventDefault } as never));
    await waitFor(() => expect(hookMocks.createAmendment).toHaveBeenCalled());
    expect(hookMocks.createAmendment).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Created',
        preamble: 'Created subtitle',
        code: 'C-1',
        tags: ['one'],
        internal_cr_voting_duration_minutes: 12,
        image_url: 'image',
        country: 'DE',
      })
    );
    expect(hookMocks.syncEntityHashtags).toHaveBeenCalledWith(
      'amendment',
      'new-amendment',
      ['one'],
      [],
      []
    );
    expect(hookMocks.navigate).toHaveBeenCalledWith({ to: '/amendment/new-amendment' });

    hookMocks.amendmentHashtags = null as never;
    hookMocks.allHashtags = null as never;
    const emptyCreate = renderHook(() =>
      useAmendmentEditContentController({
        amendmentId: 'empty-amendment',
        amendment: null,
        amendmentProcess: null,
        currentUserId: 'user-1',
        isLoading: false,
        mode: 'create',
      } as any)
    );
    await act(async () =>
      emptyCreate.result.current.handleSubmit({ preventDefault: vi.fn() } as never)
    );
    expect(hookMocks.createAmendment).toHaveBeenCalledWith(
      expect.objectContaining({
        title: null,
        preamble: null,
        code: null,
        tags: null,
        internal_cr_voting_duration_minutes: null,
        image_url: null,
        country: null,
      })
    );
    expect(hookMocks.syncEntityHashtags).toHaveBeenLastCalledWith(
      'amendment',
      'empty-amendment',
      [],
      [],
      []
    );

    hookMocks.createAmendment.mockRejectedValueOnce(new Error('create failed'));
    await act(async () =>
      emptyCreate.result.current.handleSubmit({ preventDefault: vi.fn() } as never)
    );
  });

  it('covers edit submission, public media timeline events, remove-image persistence, and errors', async () => {
    const { result } = renderHook(() =>
      useAmendmentEditContentController({
        amendmentId: 'amendment-1',
        amendment,
        amendmentProcess: buildProcess(),
        currentUserId: 'user-1',
        isLoading: false,
        mode: 'edit',
      } as any)
    );
    await waitFor(() => expect(result.current.formData.title).toBe('A1'));
    act(() => {
      result.current.handleRemoveImage();
      result.current.setFormData(previous => ({
        ...previous,
        title: '',
        subtitle: 'Updated subtitle',
        code: '',
        imageURL: 'new-image',
        videoURL: 'new-video',
        visibility: 'private',
        hashtags: [],
        internalCRVotingCloseTrigger: 'after_minutes',
        internalCRVotingDurationMinutes: 9,
      }));
    });
    expect(hookMocks.updateAmendment).toHaveBeenCalledWith({
      id: 'amendment-1',
      image_url: null,
    });
    await act(async () => result.current.handleSubmit({ preventDefault: vi.fn() } as never));
    expect(hookMocks.updateAmendment).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '',
        preamble: 'Updated subtitle',
        code: '',
        image_url: 'new-image',
        internal_cr_voting_duration_minutes: 9,
      })
    );
    expect(hookMocks.createTimelineEvent).not.toHaveBeenCalled();
    expect(hookMocks.toastSuccess).toHaveBeenCalled();

    act(() =>
      result.current.setFormData(previous => ({
        ...previous,
        visibility: 'public',
        internalCRVotingCloseTrigger: 'all_collaborators_voted',
      }))
    );
    await act(async () => result.current.handleSubmit({ preventDefault: vi.fn() } as never));
    expect(hookMocks.updateAmendment).toHaveBeenLastCalledWith(
      expect.objectContaining({ internal_cr_voting_duration_minutes: null })
    );
    expect(hookMocks.createTimelineEvent).toHaveBeenCalledTimes(2);

    hookMocks.updateAmendment.mockRejectedValueOnce(new Error('update failed'));
    await act(async () => result.current.handleSubmit({ preventDefault: vi.fn() } as never));
    expect(hookMocks.toastError).toHaveBeenCalled();
  });

  it('rolls back unavailable and failed workflow mode changes while keeping a persisted mode', async () => {
    const noTargetAmendment = { ...amendment, document_id: null };
    const noTarget = renderHook(() =>
      useAmendmentEditContentController({
        amendmentId: 'amendment-1',
        amendment: noTargetAmendment,
        amendmentProcess: { current_process_run: { branches: [], active_branch_id: null } },
        currentUserId: 'user-1',
        isLoading: false,
        mode: 'edit',
      } as any)
    );
    await act(async () => noTarget.result.current.handleWorkflowStatusChange('view'));
    expect(noTarget.result.current.formData.workflowStatus).toBe('edit');
    expect(hookMocks.toastError).toHaveBeenCalled();
    noTarget.unmount();

    hookMocks.updateProcessBranch.mockRejectedValueOnce(new Error('branch failed'));
    const failedBranch = renderHook(() =>
      useAmendmentEditContentController({
        amendmentId: 'amendment-1',
        amendment,
        amendmentProcess: buildProcess(),
        currentUserId: 'user-1',
        isLoading: false,
        mode: 'edit',
      } as any)
    );
    await waitFor(() =>
      expect(failedBranch.result.current.selectedWorkflowBranchId).toBe('branch-b')
    );
    await act(async () => failedBranch.result.current.handleWorkflowStatusChange('vote_internal'));
    expect(failedBranch.result.current.formData.workflowStatus).toBe('suggest_internal');
    failedBranch.unmount();

    hookMocks.updateAmendment.mockRejectedValueOnce(new Error('settings failed'));
    const persistedBranch = renderHook(() =>
      useAmendmentEditContentController({
        amendmentId: 'amendment-1',
        amendment,
        amendmentProcess: buildProcess(),
        currentUserId: 'user-1',
        isLoading: false,
        mode: 'edit',
      } as any)
    );
    await waitFor(() =>
      expect(persistedBranch.result.current.selectedWorkflowBranchId).toBe('branch-b')
    );
    await act(async () =>
      persistedBranch.result.current.handleWorkflowStatusChange('vote_internal')
    );
    expect(persistedBranch.result.current.formData.workflowStatus).toBe('vote_internal');
  });
});
