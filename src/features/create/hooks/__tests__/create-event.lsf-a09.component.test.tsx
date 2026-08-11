/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ createFullEvent: vi.fn() }));

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn(), useSearch: () => ({}) }));
vi.mock('@rocicorp/zero/react', () => ({ useQuery: () => [[], { type: 'complete' }] }));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: { id: 'user' } }) }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/zero/events/useEventActions', () => ({
  useEventActions: () => ({ createFullEvent: mocks.createFullEvent }),
}));
vi.mock('@/zero/common', () => ({ useCommonState: () => ({ allHashtags: [], userHashtags: [] }) }));
vi.mock('@/zero/groups/useGroupState', () => ({ useGroupById: () => ({ group: undefined }) }));
vi.mock('@/zero/rbac', () => ({
  useCreatableGroupIds: () => ({ creatableGroupIds: new Set(), isLoading: false }),
}));
vi.mock('@/zero/amendments/useAmendmentActions', () => ({
  useAmendmentActions: () => ({ completeProcessTaskWithEvent: vi.fn() }),
}));
vi.mock('@/zero/queries', () => ({
  queries: { amendments: { openProcessTasksByGroup: vi.fn() } },
}));
vi.mock('@/zero/common/hashtagHelpers', () => ({ extractHashtagTags: () => [] }));
vi.mock('@/features/shared/ui/ui/sonner', () => ({ toast: { error: vi.fn() } }));
vi.mock('../../logic/createFinalization', () => ({
  consumeCreateRestoreDraft: () => null,
  trackCreateFinalization: vi.fn(),
}));

import { useCreateEventForm } from '../useCreateEventForm';

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000009');
  mocks.createFullEvent.mockReturnValue({ client: Promise.resolve(), server: Promise.resolve() });
});

function field(config: ReturnType<typeof useCreateEventForm>, key: string) {
  return config.steps
    .flatMap(step => step.fields ?? [])
    .find(candidate => candidate.key === key) as any;
}

it('executes every previously uncalled event step validator', () => {
  const { result } = renderHook(() => useCreateEventForm());
  expect(result.current.steps[0].isValid()).toBe(false);
  expect(result.current.steps[0].getInvalidReason?.()).toBe(
    'pages.create.validation.titleRequired'
  );
  expect(
    result.current.steps.find(step => step.label === 'pages.create.event.eventType')?.isValid()
  ).toBe(true);
  expect(
    result.current.steps.find(step => step.label === 'pages.create.event.location')?.isValid()
  ).toBe(true);
  expect(
    result.current.steps.find(step => step.label === 'pages.create.event.settings')?.isValid()
  ).toBe(true);

  act(() => field(result.current, 'event-type').props.onChange('meeting'));
  expect(
    result.current.steps
      .find(step => step.label === 'pages.create.event.meetingSettings')
      ?.isValid()
  ).toBe(true);

  act(() => field(result.current, 'event-type').props.onChange('delegate_assembly'));
  expect(
    result.current.steps
      .find(step => step.label === 'pages.create.event.delegateAllocation')
      ?.isValid()
  ).toBe(true);
});

it('restores submitting state when event mutation setup throws', async () => {
  mocks.createFullEvent.mockImplementation(() => {
    throw new Error('event failed');
  });
  const { result } = renderHook(() => useCreateEventForm());
  act(() => field(result.current, 'title').onValueChange('Event'));
  act(() => {
    const onDateTimeChange = field(result.current, 'time-series').props.onDateTimeChange;
    onDateTimeChange('startDate', '2026-08-10');
    onDateTimeChange('startTime', '10:00');
    onDateTimeChange('endDate', '2026-08-10');
    onDateTimeChange('endTime', '11:00');
  });
  await expect(result.current.onSubmit?.()).rejects.toThrow('event failed');
  expect(result.current.isSubmitting).toBe(false);
});
