/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: { id: 'user-1' } as { id: string } | undefined,
  pathname: '/create/amendment',
  search: {
    sourceGroupId: undefined,
    targetGroupId: undefined,
    pathMode: 'hierarchy',
    workflowId: undefined,
    evaluationMode: 'none',
    evaluationDate: undefined,
    evaluationOffsetMonths: 0,
    evaluationOffsetYears: 0,
  } as any,
  restore: null as any,
  navigate: vi.fn(),
  createFullAmendment: vi.fn(),
  waitForOptimisticCreate: vi.fn(),
  trackCreateFinalization: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
  useRouter: () => ({ latestLocation: { pathname: mocks.pathname } }),
  useSearch: () => mocks.search,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) =>
    key === 'generated.inline.0030_public_61c9b2b1'
      ? 'Öffentlich'
      : key === 'generated.inline.0031_authenticated_8fda38ce'
        ? 'Authentifiziert'
        : key,
}));

vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/zero/amendments/useAmendmentActions', () => ({
  useAmendmentActions: () => ({ createFullAmendment: mocks.createFullAmendment }),
}));
vi.mock('@/zero/common', () => ({ useCommonState: () => ({ userHashtags: [] }) }));
vi.mock('@/zero/common/hashtagHelpers', () => ({ extractHashtagTags: () => ['civic'] }));

vi.mock('@/features/create/logic/createAmendmentSearch', () => ({
  normalizeCreateAmendmentSearch: () => mocks.search,
}));
vi.mock('@/features/create/logic/createSearchParams', () => ({
  mergeCreateSearchParams: (previous: any, updates: any) => ({ ...previous, ...updates }),
}));
vi.mock('@/features/amendments/logic/amendmentPathHelpers', () => ({
  enrichPathSegments: (segments: any[]) =>
    segments.map(segment => ({ ...segment, enriched: true })),
}));
vi.mock('@/features/amendments/logic/implementationEvaluation', () => ({
  formatImplementationEvaluationSummary: (value: any) =>
    `${value.mode}:${value.fixedDate}:${value.offsetMonths}:${value.offsetYears}`,
}));
vi.mock('@/features/shared/logic/geoLocationShape', () => ({
  geoLocationFieldsFromShape: (shape: any) => ({
    location_kind: shape?.kind ?? null,
    location_place_id: shape?.id ?? null,
    location_boundary_source: null,
    location_geometry: null,
    location_bounds: null,
  }),
}));
vi.mock('@/features/shared/logic/localDateTime', () => ({
  toLocalTimestamp: (date: string) => `local:${date}`,
}));
vi.mock('@/features/create/logic/createSubmitTargets', () => ({
  createBlockedSubmitOutcome: () => ({ status: 'blocked' }),
  createRouteSubmitTarget: (_entity: string, target: unknown) => target,
  createSuccessSubmitOutcome: (target: unknown) => ({ status: 'success', target }),
}));
vi.mock('@/features/create/logic/createFinalization', () => ({
  consumeCreateRestoreDraft: () => mocks.restore,
  waitForOptimisticCreate: (...args: unknown[]) => mocks.waitForOptimisticCreate(...args),
  trackCreateFinalization: (...args: unknown[]) => mocks.trackCreateFinalization(...args),
}));

import { useCreateAmendmentForm } from '../useCreateAmendmentForm';

function field(config: any, key: string) {
  for (const step of config.steps) {
    const direct = step.fields?.find((candidate: any) => candidate.key === key);
    if (direct) return direct;
    for (const section of step.sections ?? []) {
      const nested = section.fields?.find((candidate: any) => candidate.key === key);
      if (nested) return nested;
    }
  }
  throw new Error(`Missing field ${key}`);
}

function selection(overrides: Record<string, unknown> = {}) {
  return {
    sourceGroupId: 'source-1',
    groupId: 'target-1',
    groupData: {
      id: 'target-1',
      name: 'Target Group',
      description: 'Group description',
      member_count: 10,
      event_count: 2,
      amendment_count: 3,
    },
    eventId: 'event-1',
    eventData: {
      id: 'event-1',
      title: 'Target Event',
      start_date: 1,
      end_date: 2,
      location_name: 'Hall',
      description: 'Event description',
      participant_count: 5,
    },
    pathWithEvents: [
      { groupId: 'source-1', groupName: 'Source', eventId: null, eventTitle: null },
      {
        groupId: 'target-1',
        groupName: 'Target Group',
        eventId: 'event-1',
        eventTitle: 'Target Event',
      },
    ],
    missingEventSteps: [{ groupId: 'source-1', groupName: 'Source' }],
    pathMode: 'workflow',
    workflowId: 'workflow-1',
    ...overrides,
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: 'user-1' };
  mocks.pathname = '/create/amendment';
  mocks.search = {
    sourceGroupId: undefined,
    targetGroupId: undefined,
    pathMode: 'hierarchy',
    workflowId: undefined,
    evaluationMode: 'none',
    evaluationDate: undefined,
    evaluationOffsetMonths: 0,
    evaluationOffsetYears: 0,
  };
  mocks.restore = null;
  mocks.navigate.mockResolvedValue(undefined);
  mocks.createFullAmendment.mockReturnValue({ mutate: Promise.resolve() });
  mocks.waitForOptimisticCreate.mockResolvedValue(undefined);
});

describe('useCreateAmendmentForm state and search synchronization', () => {
  it('validates and updates basic, media, location, visibility, evaluation, and target fields', async () => {
    const { result, rerender } = renderHook(() => useCreateAmendmentForm());
    expect(result.current.steps[0].isValid()).toBe(false);
    expect(result.current.steps[0].getInvalidReason?.()).toBe(
      'pages.create.validation.titleRequired'
    );
    result.current.steps.forEach(step => expect(step.isValid()).toBeTypeOf('boolean'));

    act(() => {
      field(result.current, 'title').onValueChange('  Amendment  ');
      field(result.current, 'subtitle').onValueChange('Code');
      field(result.current, 'media').props.onImageChange('image.png');
      field(result.current, 'media').props.onVideoChange('video.mp4');
      field(result.current, 'visibility').props.onChange('authenticated');
      field(result.current, 'hashtags').props.onChange(['civic']);
    });
    expect(result.current.steps[0].isValid()).toBe(true);
    expect(result.current.steps[0].getInvalidReason?.()).toBeNull();
    expect(result.current.steps.at(-1)?.isValid()).toBe(true);
    expect(result.current.steps.at(-1)?.getInvalidReason?.()).toBeNull();

    const location = () => field(result.current, 'location').props;
    for (const [name, value] of [
      ['country', 'DE'],
      ['region', 'HE'],
      ['city', 'Darmstadt'],
      ['post_code', '64283'],
      ['street', 'Street'],
      ['house_number', '1'],
    ]) {
      act(() => location().onFieldChange(name, value));
    }
    act(() => location().onCoordinatesChange({ latitude: 1, longitude: 2 }));
    expect(location().values).toMatchObject({ latitude: 1, longitude: 2, city: 'Darmstadt' });
    act(() => location().onCoordinatesChange(null));
    act(() => location().onShapeChange({ kind: 'place', id: 'place-1' }));

    const target = () => field(result.current, 'target').props;
    target().onSourceGroupSelectionChange(null);
    target().onSourceGroupSelectionChange('source-1');
    target().onGroupSelectionChange(null);
    target().onGroupSelectionChange('target-1');
    target().onWorkflowSelectionChange(null);
    target().onWorkflowSelectionChange('workflow-1');
    target().onPathModeChange('workflow');
    target().onPathModeChange('hierarchy');
    await Promise.resolve();
    expect(mocks.navigate).toHaveBeenCalled();
    const searchUpdater = mocks.navigate.mock.calls[0][0].search;
    expect(searchUpdater({ retained: true })).toEqual(
      expect.objectContaining({ retained: true, sourceGroupId: undefined })
    );

    act(() => target().onSelect(selection()));
    expect(target().targetSelection.eventData.title).toBe('Target Event');
    const reviewFields = field(result.current, 'review').props.sections.flatMap(
      (section: any) => section.fields
    );
    expect(reviewFields).toContainEqual({
      label: 'pages.create.common.visibility',
      value: 'pages.create.common.authenticated',
    });
    expect(field(result.current, 'review').props.sections[0].fields.length).toBeGreaterThan(2);
    act(() => target().onSelect(null));
    expect(target().targetSelection).toBeNull();

    act(() => field(result.current, 'mode-buttons').props.onChange('fixed_date'));
    expect(result.current.steps.at(-3)?.isValid()).toBe(false);
    expect(result.current.steps.at(-3)?.getInvalidReason?.()).toBe(
      'pages.create.amendment.validation.evaluationDateRequired'
    );
    expect(result.current.steps.at(-1)?.isValid()).toBe(false);
    expect(result.current.steps.at(-1)?.getInvalidReason?.()).toBe(
      'pages.create.amendment.validation.evaluationDateRequired'
    );
    act(() => field(result.current, 'evaluation-date').onValueChange('2027-01-01'));
    expect(result.current.steps.at(-3)?.isValid()).toBe(true);
    act(() => field(result.current, 'evaluation-date').onValueChange(''));

    act(() => field(result.current, 'mode-buttons').props.onChange('relative_to_vote'));
    act(() => {
      field(result.current, 'evaluation-offset-months').onValueChange('6');
      field(result.current, 'evaluation-offset-years').onValueChange('2');
    });
    act(() => {
      field(result.current, 'evaluation-offset-months').onValueChange('');
      field(result.current, 'evaluation-offset-years').onValueChange('');
    });

    mocks.pathname = '/elsewhere';
    rerender();
    const calls = mocks.navigate.mock.calls.length;
    target().onGroupSelectionChange('ignored');
    expect(mocks.navigate).toHaveBeenCalledTimes(calls);
  });

  it('removes settled and rejected navigation promises from the pending set', async () => {
    let resolve!: () => void;
    mocks.navigate.mockReturnValueOnce(new Promise<void>(done => (resolve = done)));
    const { result } = renderHook(() => useCreateAmendmentForm());
    field(result.current, 'target').props.onGroupSelectionChange('one');
    resolve();
    await Promise.resolve();

    let reject!: (error: Error) => void;
    mocks.navigate.mockReturnValueOnce(new Promise<void>((_done, fail) => (reject = fail)));
    field(result.current, 'target').props.onGroupSelectionChange('two');
    reject(new Error('ignored navigation'));
    await Promise.resolve();
  });

  it('restores complete and sparse drafts with search-derived fallbacks', () => {
    mocks.search = {
      sourceGroupId: 'source-param',
      targetGroupId: 'target-param',
      pathMode: 'workflow',
      workflowId: 'workflow-param',
      evaluationMode: 'fixed_date',
      evaluationDate: '2027-01-01',
      evaluationOffsetMonths: 3,
      evaluationOffsetYears: 1,
    };
    mocks.restore = {
      formState: {
        title: 'Restored',
        subtitle: 'Code',
        imageURL: 'image',
        videoURL: 'video',
        visibility: 'private',
        hashtags: ['restored'],
        country: 'DE',
        region: 'HE',
        post_code: '1',
        city: 'City',
        street: 'Street',
        house_number: '2',
        latitude: 1,
        longitude: 2,
        locationShape: { kind: 'place' },
        targetSelection: selection(),
        pathMode: 'hierarchy',
        workflowId: 'restored-workflow',
        evaluationMode: 'relative_to_vote',
        evaluationDate: '2028-01-01',
        evaluationOffsetMonths: '4',
        evaluationOffsetYears: '2',
      },
    };
    const full = renderHook(() => useCreateAmendmentForm());
    expect(field(full.result.current, 'title').value).toBe('Restored');
    expect(field(full.result.current, 'target').props.sourceGroupIdParam).toBe('source-param');
    full.unmount();

    mocks.search = {
      sourceGroupId: undefined,
      targetGroupId: undefined,
      pathMode: 'hierarchy',
      workflowId: undefined,
      evaluationMode: 'none',
      evaluationDate: undefined,
      evaluationOffsetMonths: 0,
      evaluationOffsetYears: 0,
    };
    mocks.restore = { formState: {} };
    const sparse = renderHook(() => useCreateAmendmentForm());
    expect(field(sparse.result.current, 'title').value).toBe('');
    expect(field(sparse.result.current, 'target').props.pathMode).toBe('hierarchy');
  });
});

describe('useCreateAmendmentForm submission', () => {
  it('blocks missing users, titles, and incomplete fixed evaluation dates', async () => {
    const { result, rerender } = renderHook(() => useCreateAmendmentForm());
    await expect(result.current.onSubmit()).resolves.toEqual({ status: 'blocked' });
    act(() => field(result.current, 'title').onValueChange('Amendment'));
    mocks.user = undefined;
    rerender();
    await expect(result.current.onSubmit()).resolves.toEqual({ status: 'blocked' });
    mocks.user = { id: 'user-1' };
    rerender();
    act(() => field(result.current, 'mode-buttons').props.onChange('fixed_date'));
    await expect(result.current.onSubmit()).resolves.toEqual({ status: 'blocked' });
  });

  it('waits for search, submits a full fixed-date process, reports progress, and retries', async () => {
    let resolveNavigation!: () => void;
    mocks.navigate.mockReturnValueOnce(new Promise<void>(done => (resolveNavigation = done)));
    const { result } = renderHook(() => useCreateAmendmentForm());
    act(() => {
      field(result.current, 'title').onValueChange(' Full Amendment ');
      field(result.current, 'subtitle').onValueChange('Code');
      field(result.current, 'media').props.onImageChange('image');
      field(result.current, 'media').props.onVideoChange('video');
      field(result.current, 'hashtags').props.onChange(['civic']);
      field(result.current, 'target').props.onSelect(selection());
      field(result.current, 'mode-buttons').props.onChange('fixed_date');
    });
    act(() => field(result.current, 'evaluation-date').onValueChange('2027-01-01'));
    field(result.current, 'target').props.onGroupSelectionChange('target-1');

    const reportProgress = vi.fn();
    const setRecoveryTarget = vi.fn();
    let submit!: Promise<unknown>;
    act(() => {
      submit = result.current.onSubmit({ reportProgress, setRecoveryTarget });
    });
    expect(mocks.createFullAmendment).not.toHaveBeenCalled();
    resolveNavigation();
    await act(async () => submit);

    expect(mocks.createFullAmendment).toHaveBeenCalledWith(
      expect.objectContaining({
        amendment: expect.objectContaining({
          title: 'Full Amendment',
          preamble: 'Code',
          code: null,
          group_id: 'target-1',
          event_id: 'event-1',
          tags: ['civic'],
          image_url: 'image',
          video_url: 'video',
        }),
        process_path: expect.objectContaining({
          path_mode: 'workflow',
          evaluation_mode: 'fixed_date',
          evaluation_date: 'local:2027-01-01',
          evaluation_offset_months: null,
          evaluation_offset_years: null,
        }),
      }),
      { notificationMode: 'silent' }
    );
    expect(reportProgress).toHaveBeenCalledWith({ key: 'ready', status: 'active' });
    expect(setRecoveryTarget).toHaveBeenCalled();
    const tracked = mocks.trackCreateFinalization.mock.calls[0][0];
    tracked.retry();
    expect(mocks.createFullAmendment).toHaveBeenCalledTimes(2);

    const calls = mocks.navigate.mock.calls.length;
    field(result.current, 'target').props.onGroupSelectionChange('suppressed');
    expect(mocks.navigate).toHaveBeenCalledTimes(calls);
  });

  it('submits minimal and relative evaluation payload fallbacks', async () => {
    const { result } = renderHook(() => useCreateAmendmentForm());
    act(() => {
      field(result.current, 'title').onValueChange('Minimal');
      field(result.current, 'mode-buttons').props.onChange('relative_to_vote');
    });
    act(() => {
      field(result.current, 'evaluation-offset-months').onValueChange('bad');
      field(result.current, 'evaluation-offset-years').onValueChange('');
    });
    await act(async () => result.current.onSubmit());
    expect(mocks.createFullAmendment).toHaveBeenLastCalledWith(
      expect.objectContaining({ process_path: null }),
      { notificationMode: 'silent' }
    );

    act(() =>
      field(result.current, 'target').props.onSelect(
        selection({
          eventId: null,
          eventData: null,
          pathWithEvents: [],
          missingEventSteps: [],
          groupData: {
            id: 'target',
            name: null,
            description: null,
            member_count: null,
            event_count: null,
            amendment_count: null,
          },
        })
      )
    );
    expect(field(result.current, 'review').props.sections[0].fields[0].value).toBe('');
    expect(field(result.current, 'review').props.sections[0].fields[1].value).toBe('');

    act(() => {
      field(result.current, 'target').props.onSelect(
        selection({
          groupId: '',
          eventId: null,
          eventData: {
            id: 'event-empty',
            title: undefined,
            start_date: undefined,
            end_date: undefined,
            location_name: undefined,
            description: { rich: true },
            participant_count: undefined,
          },
          pathWithEvents: [
            { groupId: 'target', groupName: 'Target', eventId: null, eventTitle: null },
          ],
          missingEventSteps: [],
          workflowId: null,
          groupData: {
            id: 'target',
            name: null,
            description: { rich: true },
            member_count: null,
            event_count: null,
            amendment_count: null,
          },
        })
      );
    });
    expect(field(result.current, 'review').props.sections[0].fields[0].value).toBe(' -> ');
    await act(async () => result.current.onSubmit());
    expect(mocks.createFullAmendment).toHaveBeenLastCalledWith(
      expect.objectContaining({
        amendment: expect.objectContaining({
          code: null,
          group_id: null,
          event_id: null,
          tags: null,
          image_url: null,
          video_url: null,
          country: null,
        }),
        process_path: expect.objectContaining({
          evaluation_mode: 'relative_to_vote',
          evaluation_date: null,
          evaluation_offset_months: 0,
          evaluation_offset_years: 0,
        }),
      }),
      { notificationMode: 'silent' }
    );
  });

  it('resets suppression and submitting state when optimistic sync fails', async () => {
    const { result } = renderHook(() => useCreateAmendmentForm());
    act(() => field(result.current, 'title').onValueChange('Failure'));
    mocks.waitForOptimisticCreate.mockRejectedValueOnce(new Error('sync failed'));
    await expect(result.current.onSubmit()).rejects.toThrow('sync failed');
    expect(result.current.isSubmitting).toBe(false);
    field(result.current, 'target').props.onGroupSelectionChange('after-failure');
    expect(mocks.navigate).toHaveBeenCalled();
  });
});
