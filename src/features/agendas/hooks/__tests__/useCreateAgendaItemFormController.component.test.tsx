/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  search: {} as Record<string, string | undefined>,
  user: { id: 'user-1' } as { id: string } | null,
  navigate: vi.fn(),
  createAgendaItem: vi.fn((args: unknown) => ({ kind: 'agenda', args })),
  createElection: vi.fn((args: unknown) => ({ kind: 'election', args })),
  createVote: vi.fn((args: unknown) => ({ kind: 'vote', args })),
  createVoteChoice: vi.fn((args: unknown) => ({ kind: 'choice', args })),
  waitForClientApply: vi.fn(async (_result: unknown) => undefined),
  combineMutationResults: vi.fn((results: unknown[]) => ({ combined: results })),
  trackMutationFinalization: vi.fn(),
  toastError: vi.fn(),
  events: [{ id: 'event-1' }],
  amendments: [{ id: 'amendment-1' }],
  roles: [{ id: 'role-1' }],
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
  useSearch: () => mocks.search,
}));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/zero/agendas/useAgendaActions', () => ({
  useAgendaActions: () => ({ createAgendaItem: mocks.createAgendaItem }),
}));
vi.mock('@/zero/elections/useElectionActions', () => ({
  useElectionActions: () => ({ createElection: mocks.createElection }),
}));
vi.mock('@/zero/votes/useVoteActions', () => ({
  useVoteActions: () => ({
    createVote: mocks.createVote,
    createVoteChoice: mocks.createVoteChoice,
  }),
}));
vi.mock('@/zero/events/useEventState', () => ({
  useAllEvents: () => ({ events: mocks.events }),
  useAllAmendments: () => ({ amendments: mocks.amendments }),
  useRolesWithGroups: () => ({ roles: mocks.roles }),
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { error: mocks.toastError },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: (result: unknown) => mocks.waitForClientApply(result),
}));
vi.mock('@/features/notifications/utils/mutation-finalization', () => ({
  combineMutationResults: (results: unknown[]) => mocks.combineMutationResults(results),
  trackMutationFinalization: (args: unknown) => mocks.trackMutationFinalization(args),
}));

import { useCreateAgendaItemFormController } from '../useCreateAgendaItemFormController';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.search = {};
  mocks.user = { id: 'user-1' };
  mocks.waitForClientApply.mockResolvedValue(undefined);
  vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001');
});

describe('useCreateAgendaItemFormController', () => {
  it.each([
    ['without event search', undefined, ''],
    ['with event search', 'event-1', 'event-1'],
  ])('initializes %s and exposes related options', (_label, eventId, expected) => {
    mocks.search = { eventId };

    const { result } = renderHook(() => useCreateAgendaItemFormController());

    expect(result.current.formData).toMatchObject({
      eventId: expected,
      type: 'discussion',
      order: 1,
    });
    expect(result.current.userEvents).toBe(mocks.events);
    expect(result.current.userAmendments).toBe(mocks.amendments);
    expect(result.current.userRoles).toBe(mocks.roles);
    expect(result.current.currentStep).toBe(0);
  });

  it('tracks carousel selection changes', () => {
    let select: (() => void) | undefined;
    const carousel = {
      on: vi.fn((_event: string, callback: () => void) => {
        select = callback;
      }),
      selectedScrollSnap: vi.fn(() => 2),
    };
    const { result } = renderHook(() => useCreateAgendaItemFormController());

    act(() => result.current.setCarouselApi(carousel as never));
    act(() => select?.());

    expect(carousel.on).toHaveBeenCalledWith('select', expect.any(Function));
    expect(result.current.currentStep).toBe(2);
  });

  it('rejects unauthenticated submission and restores submit state', async () => {
    mocks.user = null;
    mocks.search = { eventId: 'event-1' };
    const { result } = renderHook(() => useCreateAgendaItemFormController());

    await act(() => result.current.handleSubmit());

    expect(mocks.toastError).toHaveBeenCalled();
    expect(mocks.createAgendaItem).not.toHaveBeenCalled();
    expect(result.current.isSubmitting).toBe(false);
  });

  it('rejects submission without an event', async () => {
    const { result } = renderHook(() => useCreateAgendaItemFormController());

    await act(() => result.current.handleSubmit());

    expect(mocks.toastError).toHaveBeenCalled();
    expect(mocks.createAgendaItem).not.toHaveBeenCalled();
    expect(result.current.isSubmitting).toBe(false);
  });

  it('creates a basic agenda item using empty optional defaults', async () => {
    mocks.search = { eventId: 'event-1' };
    const { result } = renderHook(() => useCreateAgendaItemFormController());

    await act(() => result.current.handleSubmit());

    expect(mocks.createAgendaItem).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '00000000-0000-4000-8000-000000000001',
        description: '',
        duration: 0,
        amendment_id: '',
        event_id: 'event-1',
      }),
      { notificationMode: 'silent' }
    );
    expect(mocks.createElection).not.toHaveBeenCalled();
    expect(mocks.createVote).not.toHaveBeenCalled();
    expect(mocks.trackMutationFinalization).toHaveBeenCalledWith({
      result: { combined: [expect.objectContaining({ kind: 'agenda' })] },
      entityKind: 'agendaItem',
      operationId: '00000000-0000-4000-8000-000000000001',
    });
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/event/event-1/agenda' });
  });

  it('creates a populated election after its agenda item', async () => {
    mocks.search = { eventId: 'event-1' };
    const { result } = renderHook(() => useCreateAgendaItemFormController());
    act(() =>
      result.current.setFormData(previous => ({
        ...previous,
        type: 'election',
        title: 'Board',
        description: 'Elect the board',
        duration: '45',
        amendmentId: 'amendment-1',
        roleId: 'role-1',
      }))
    );

    await act(() => result.current.handleSubmit());

    expect(mocks.createAgendaItem).toHaveBeenCalledWith(
      expect.objectContaining({ duration: 45, amendment_id: 'amendment-1' }),
      { notificationMode: 'silent' }
    );
    expect(mocks.createElection).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Board',
        description: 'Elect the board',
        role_id: 'role-1',
        agenda_item_id: '00000000-0000-4000-8000-000000000001',
      }),
      { notificationMode: 'silent' }
    );
    expect(mocks.waitForClientApply).toHaveBeenCalledTimes(2);
  });

  it('creates an election with nullable optional values', async () => {
    mocks.search = { eventId: 'event-1' };
    const { result } = renderHook(() => useCreateAgendaItemFormController());
    act(() => result.current.setFormData(previous => ({ ...previous, type: 'election' })));

    await act(() => result.current.handleSubmit());

    expect(mocks.createElection).toHaveBeenCalledWith(
      expect.objectContaining({ description: null, role_id: null }),
      { notificationMode: 'silent' }
    );
  });

  it.each([
    ['nullable amendment', '', null],
    ['linked amendment', 'amendment-1', 'amendment-1'],
  ])('creates a vote with %s and three ordered choices', async (_label, amendmentId, expected) => {
    mocks.search = { eventId: 'event-1' };
    const { result } = renderHook(() => useCreateAgendaItemFormController());
    act(() =>
      result.current.setFormData(previous => ({
        ...previous,
        type: 'vote',
        description: amendmentId ? 'Decision' : '',
        amendmentId,
      }))
    );

    await act(() => result.current.handleSubmit());

    expect(mocks.createVote).toHaveBeenCalledWith(
      expect.objectContaining({
        description: amendmentId ? 'Decision' : null,
        amendment_id: expected,
      }),
      { notificationMode: 'silent' }
    );
    expect(mocks.createVoteChoice.mock.calls.map(([choice]) => choice)).toEqual([
      expect.objectContaining({ label: 'Yes', order_index: 1 }),
      expect.objectContaining({ label: 'No', order_index: 2 }),
      expect.objectContaining({ label: 'Abstain', order_index: 3 }),
    ]);
    expect(mocks.waitForClientApply).toHaveBeenCalledTimes(5);
  });

  it('reports a creation failure and restores submit state', async () => {
    mocks.search = { eventId: 'event-1' };
    mocks.waitForClientApply.mockRejectedValueOnce(new Error('create failed'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { result } = renderHook(() => useCreateAgendaItemFormController());

    await act(() => result.current.handleSubmit());

    expect(consoleError).toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalled();
    expect(result.current.isSubmitting).toBe(false);
    expect(mocks.navigate).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
