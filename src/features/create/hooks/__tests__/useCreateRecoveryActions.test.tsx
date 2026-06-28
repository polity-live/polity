/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCreateRecoveryActions } from '../useCreateRecoveryActions';
import type { CreateRecoveryDraft } from '../../logic/createFinalization';

const mutate = vi.fn();

vi.mock('@rocicorp/zero/react', () => ({
  useZero: () => ({ mutate }),
}));

vi.mock('@/features/notifications/utils/gated-toast', () => ({
  gatedToast: {
    dismiss: vi.fn(),
    error: vi.fn(),
    finalizationSuccess: vi.fn(),
    loading: vi.fn(),
  },
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (_key: string, fallback?: string) => fallback ?? _key,
}));

vi.mock('@/zero/mutators', () => ({
  mutators: {
    groups: { createFull: (payload: unknown) => ({ type: 'groups.createFull', payload }) },
    events: { createFull: (payload: unknown) => ({ type: 'events.createFull', payload }) },
    amendments: { createFull: (payload: unknown) => ({ type: 'amendments.createFull', payload }) },
    blogs: { createFull: (payload: unknown) => ({ type: 'blogs.createFull', payload }) },
    statements: { createFull: (payload: unknown) => ({ type: 'statements.createFull', payload }) },
    todos: { createFull: (payload: unknown) => ({ type: 'todos.createFull', payload }) },
    agendas: { createFull: (payload: unknown) => ({ type: 'agendas.createFull', payload }) },
    payments: {
      createPayment: (payload: unknown) => ({ type: 'payments.createPayment', payload }),
    },
    elections: {
      addCandidate: (payload: unknown) => ({ type: 'elections.addCandidate', payload }),
    },
  },
}));

function createDraft(overrides: Partial<CreateRecoveryDraft>): CreateRecoveryDraft {
  return {
    id: 'statement:statement-1',
    entityType: 'statement',
    entityId: 'statement-1',
    createPath: '/create/statement',
    formState: {},
    mutationPayload: { id: 'statement-1' },
    target: {
      kind: 'route',
      entityType: 'statement',
      to: '/statement/$id',
      params: { id: 'statement-1' },
    },
    submittedAt: Date.now(),
    status: 'failed',
    ...overrides,
  };
}

describe('useCreateRecoveryActions', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.clearAllMocks();
    mutate.mockReturnValue({
      client: Promise.resolve(),
      server: new Promise(() => undefined),
    });
  });

  it.each([
    ['statement', '/create/statement', 'statements.createFull'],
    ['todo', '/create/todo', 'todos.createFull'],
    ['agenda_item', '/create/agenda-item', 'agendas.createFull'],
    ['payment', '/create/payment', 'payments.createPayment'],
  ] as const)('retries %s drafts through the saved payload', (entityType, createPath, type) => {
    const draft = createDraft({
      id: `${entityType}:entity-1`,
      entityType,
      entityId: 'entity-1',
      createPath,
      mutationPayload: { id: 'entity-1', marker: entityType },
    });
    const { result } = renderHook(() => useCreateRecoveryActions(draft));

    expect(result.current.canRetry).toBe(true);

    act(() => {
      result.current.retry();
    });

    expect(mutate).toHaveBeenCalledWith({
      type,
      payload: { id: 'entity-1', marker: entityType },
    });
  });

  it('retries election-candidate drafts through the candidate mutator', () => {
    const draft = createDraft({
      id: 'election:candidate-1',
      entityType: 'election',
      entityId: 'candidate-1',
      createPath: '/create/election-candidate',
      mutationPayload: { id: 'candidate-1', election_id: 'election-1' },
    });
    const { result } = renderHook(() => useCreateRecoveryActions(draft));

    expect(result.current.canRetry).toBe(true);

    act(() => {
      result.current.retry();
    });

    expect(mutate).toHaveBeenCalledWith({
      type: 'elections.addCandidate',
      payload: { id: 'candidate-1', election_id: 'election-1' },
    });
  });

  it('does not retry generic election drafts without the candidate create path', () => {
    const draft = createDraft({
      id: 'election:election-1',
      entityType: 'election',
      entityId: 'election-1',
      createPath: '/create/election',
    });
    const { result } = renderHook(() => useCreateRecoveryActions(draft));

    expect(result.current.canRetry).toBe(false);

    act(() => {
      result.current.retry();
    });

    expect(mutate).not.toHaveBeenCalled();
  });
});
