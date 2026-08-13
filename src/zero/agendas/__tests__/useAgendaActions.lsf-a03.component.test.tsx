/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  mutate: vi.fn((mutation: unknown) => ({ mutation })),
  onServerError: vi.fn((_result: unknown, callback: (message: string) => void) =>
    callback('server-error')
  ),
  trackCreation: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@rocicorp/zero/react', () => ({
  useZero: () => ({ mutate: mocks.mutate }),
}));

vi.mock('@/zero/mutators', () => ({
  mutators: {
    agendas: new Proxy(
      {},
      {
        get: (_target, name) => (args: unknown) => ({ name, args }),
      }
    ),
  },
}));

vi.mock('@/zero/mutate-with-server-check', () => ({
  onServerError: mocks.onServerError,
}));

vi.mock('@/features/notifications/utils/gated-toast', () => ({
  gatedToast: { success: mocks.success, error: mocks.error },
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/features/notifications/utils/mutation-finalization', () => ({
  trackCreationUnlessSilent: mocks.trackCreation,
}));

import { useAgendaActions } from '../useAgendaActions';

beforeEach(() => vi.clearAllMocks());

it('invokes every agenda action and every optimistic error callback', () => {
  const { result } = renderHook(() => useAgendaActions());
  const actions = result.current;
  const args = { id: 'entity-id' } as never;

  expect(actions.createAgendaItem(args)).toBeDefined();
  expect(
    actions.createFullAgendaItem({ agenda_items: [{ id: 'agenda-item-id' }] } as never)
  ).toBeDefined();
  expect(actions.createFullAgendaItem({ agenda_items: [] } as never)).toBeDefined();
  expect(actions.updateAgendaItem(args)).toBeDefined();
  expect(actions.deleteAgendaItem('agenda-item-id')).toBeDefined();
  expect(actions.reorderAgendaItems(args)).toBeDefined();
  expect(actions.addSpeaker(args)).toBeDefined();
  expect(actions.updateSpeaker(args)).toBeDefined();
  expect(actions.removeSpeaker('speaker-id')).toBeDefined();
  expect(actions.createAgendaItemChangeRequest(args)).toBeDefined();
  expect(actions.updateAgendaItemChangeRequest(args)).toBeDefined();
  expect(actions.reorderAgendaItemChangeRequests(args)).toBeDefined();
  expect(actions.deleteAgendaItemChangeRequest('change-request-id')).toBeDefined();
  expect(actions.initializeChangeRequestVoting(args)).toBeDefined();
  expect(actions.initializeChangeRequestVoting(args, { silent: true })).toBeDefined();
  expect(actions.ensureEventSuggestionChangeRequestVotes(args)).toBeDefined();
  expect(actions.processCRVoteResult(args)).toBeDefined();

  expect(mocks.mutate).toHaveBeenCalledTimes(17);
  expect(mocks.trackCreation).toHaveBeenCalledTimes(4);
  expect(mocks.onServerError).toHaveBeenCalledTimes(12);
  expect(mocks.success).toHaveBeenCalledTimes(4);
  expect(mocks.error).toHaveBeenCalledTimes(12);
});
