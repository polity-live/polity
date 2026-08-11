/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: { id: 'user-1' } as { id: string } | undefined,
  search: {} as { groupId?: string },
  memberships: [{ group_id: 'group-1' }],
  restore: null as any,
  navigate: vi.fn(),
  createFullStatement: vi.fn(),
  waitForOptimisticCreate: vi.fn(),
  trackCreateFinalization: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
  useSearch: () => mocks.search,
}));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/zero/statements/useStatementActions', () => ({
  useStatementActions: () => ({ createFullStatement: mocks.createFullStatement }),
}));
vi.mock('@/zero/common/useCommonState', () => ({
  useCommonState: () => ({ userHashtags: [] }),
}));
vi.mock('@/zero/common/hashtagHelpers', () => ({ extractHashtagTags: () => ['civic'] }));
vi.mock('@/zero/groups/useGroupState', () => ({
  useGroupState: () => ({ currentUserMembershipsWithGroups: mocks.memberships }),
  useGroupById: (id?: string) => ({
    group: id && id !== 'missing' ? { id, name: `Group ${id}` } : undefined,
  }),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) =>
    key === 'generated.inline.0030_public_61c9b2b1'
      ? 'public'
      : key === 'generated.inline.0031_authenticated_8fda38ce'
        ? 'authenticated'
        : key,
}));
vi.mock('@/features/create/logic/createSearchParams', () => ({
  mergeCreateSearchParams: (previous: any, updates: any) => ({ ...previous, ...updates }),
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

import { useCreateStatementForm } from '../useCreateStatementForm';

function field(config: any, key: string) {
  for (const step of config.steps) {
    const found = step.fields.find((candidate: any) => candidate.key === key);
    if (found) return found;
  }
  throw new Error(`Missing ${key}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: 'user-1' };
  mocks.search = {};
  mocks.memberships = [{ group_id: 'group-1' }];
  mocks.restore = null;
  mocks.navigate.mockResolvedValue(undefined);
  mocks.createFullStatement.mockReturnValue({ mutate: Promise.resolve() });
  mocks.waitForOptimisticCreate.mockResolvedValue(undefined);
});

describe('useCreateStatementForm', () => {
  it('updates content, group, media, survey, story, hashtags, and visibility review state', () => {
    const { result } = renderHook(() => useCreateStatementForm());
    expect(result.current.steps.at(-1)?.isValid()).toBe(false);
    expect(result.current.steps.at(-1)?.getInvalidReason?.()).toBe(
      'pages.create.statement.validation.contentRequired'
    );
    result.current.steps.forEach(step => expect(step.isValid()).toBeTypeOf('boolean'));

    act(() => {
      field(result.current, 'title').onValueChange('T'.repeat(130));
      field(result.current, 'text').onValueChange('Text');
    });
    expect(field(result.current, 'title').value).toHaveLength(120);
    expect(result.current.steps.at(-1)?.isValid()).toBe(true);

    const group = () => field(result.current, 'group').props;
    expect(group().filterFn({ id: 'group-1' })).toBe(true);
    expect(group().filterFn({ id: 'group-2' })).toBe(false);
    act(() => group().onChange({ id: 'group-1', label: 'Selected Group' }));
    expect(group().value).toBe('group-1');
    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({ to: '/create/statement', replace: true })
    );
    act(() => group().onChange(null));
    expect(group().value).toBeUndefined();

    act(() => {
      field(result.current, 'media').props.onImageChange('image.png');
      field(result.current, 'media').props.onVideoChange('video.mp4');
      field(result.current, 'story').props.onCheckedChange(true);
      field(result.current, 'hashtags').props.onChange(['civic']);
      field(result.current, 'visibility').props.onChange('authenticated');
      field(result.current, 'survey').props.onSurveyQuestionChange('Question?');
      field(result.current, 'survey').props.onSurveyOptionsChange(['Yes', ' ', 'No']);
      field(result.current, 'survey').props.onSurveyDurationHoursChange(48);
    });
    const review = field(result.current, 'review').props;
    expect(review.secondaryBadge).toBe('features.statements.story.badge');
    expect(review.media).toMatchObject({ imageUrl: 'image.png', videoUrl: 'video.mp4' });
    expect(review.hashtags).toEqual(['civic']);
    expect(review.sections).toHaveLength(2);

    act(() => {
      field(result.current, 'story').props.onCheckedChange(false);
      field(result.current, 'visibility').props.onChange('private');
      field(result.current, 'survey').props.onSurveyOptionsChange(['Yes', '']);
    });
    expect(field(result.current, 'review').props.sections).toHaveLength(1);
  });

  it('syncs prefilled group names and clears stale names', () => {
    mocks.search = { groupId: 'group-1' };
    const { result, rerender } = renderHook(() => useCreateStatementForm());
    expect(field(result.current, 'review').props.sections[0].fields[0].value).toBe('Group group-1');
    mocks.search = {};
    rerender();
    expect(field(result.current, 'group').props.value).toBeUndefined();
    expect(
      field(result.current, 'review').props.sections[0].fields.some(
        (entry: any) => entry.label === 'pages.create.statement.attachTo'
      )
    ).toBe(false);

    mocks.search = { groupId: 'missing' };
    rerender();
    expect(field(result.current, 'group').props.value).toBe('missing');
  });

  it('restores full and sparse drafts and exposes the over-limit validation boundary', () => {
    mocks.restore = {
      formState: {
        title: 'Restored',
        text: 'X'.repeat(281),
        groupId: 'group-1',
        imageUrl: 'image',
        videoUrl: 'video',
        isStory: true,
        surveyQuestion: 'Question',
        surveyOptions: ['A', 'B'],
        surveyDurationHours: 72,
        hashtags: ['restored'],
        visibility: 'private',
      },
    };
    const full = renderHook(() => useCreateStatementForm());
    expect(full.result.current.steps[0].isValid()).toBe(false);
    expect(full.result.current.steps[0].getInvalidReason?.()).toContain('textTooLong');
    expect(field(full.result.current, 'characters-remaining').props.isWarning).toBe(true);
    full.unmount();

    mocks.restore = { formState: {} };
    const sparse = renderHook(() => useCreateStatementForm());
    expect(field(sparse.result.current, 'text').value).toBe('');
    expect(field(sparse.result.current, 'survey').props.surveyOptions).toEqual(['', '']);
    expect(field(sparse.result.current, 'survey').props.surveyDurationHours).toBe(24);
  });

  it('blocks unauthorized and empty submissions then submits and retries a complete survey', async () => {
    mocks.user = undefined;
    const unauthorized = renderHook(() => useCreateStatementForm());
    await expect(unauthorized.result.current.onSubmit()).resolves.toEqual({ status: 'blocked' });
    unauthorized.unmount();

    mocks.user = { id: 'user-1' };
    const { result } = renderHook(() => useCreateStatementForm());
    await expect(result.current.onSubmit()).resolves.toEqual({ status: 'blocked' });
    act(() => {
      field(result.current, 'text').onValueChange('Statement text');
      field(result.current, 'title').onValueChange('Headline');
      field(result.current, 'survey').props.onSurveyQuestionChange('Question?');
      field(result.current, 'survey').props.onSurveyOptionsChange([' Yes ', '', ' No ']);
      field(result.current, 'survey').props.onSurveyDurationHoursChange(12);
    });
    const reportProgress = vi.fn();
    const outcome = await act(async () =>
      result.current.onSubmit({ reportProgress, setRecoveryTarget: vi.fn() })
    );
    expect(outcome).toMatchObject({ status: 'success' });
    expect(mocks.createFullStatement).toHaveBeenCalledWith(
      expect.objectContaining({
        statement: expect.objectContaining({ title: 'Headline', text: 'Statement text' }),
        survey: expect.objectContaining({
          record: expect.objectContaining({ question: 'Question?' }),
          options: [
            expect.objectContaining({ label: 'Yes', position: 0 }),
            expect.objectContaining({ label: 'No', position: 1 }),
          ],
        }),
      }),
      { notificationMode: 'silent' }
    );
    expect(reportProgress).toHaveBeenCalledWith({ key: 'ready', status: 'active' });
    mocks.trackCreateFinalization.mock.calls[0][0].retry();
    expect(mocks.createFullStatement).toHaveBeenCalledTimes(2);
  });

  it('submits media-only payload fallbacks and resets submitting after rejection', async () => {
    const { result } = renderHook(() => useCreateStatementForm());
    act(() => field(result.current, 'media').props.onImageChange('image.png'));
    await act(async () => result.current.onSubmit());
    expect(mocks.createFullStatement).toHaveBeenLastCalledWith(
      expect.objectContaining({
        statement: expect.objectContaining({ title: null, text: null, video_url: null }),
        survey: null,
      }),
      { notificationMode: 'silent' }
    );

    mocks.waitForOptimisticCreate.mockRejectedValueOnce(new Error('sync failed'));
    await expect(result.current.onSubmit()).rejects.toThrow('sync failed');
    expect(result.current.isSubmitting).toBe(false);
  });
});
