import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  request: {} as Request | undefined,
  getSession: vi.fn(),
  createContext: vi.fn((id: string, email: string) => ({ userID: id, email })),
  executeRead: vi.fn(async (callback: (tx: object) => unknown) => callback({ id: 'tx' })),
  resolve: vi.fn(),
}));

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => {
    let validator = (value: unknown) => value;
    const chain = {
      validator(next: (value: unknown) => unknown) {
        validator = next;
        return chain;
      },
      handler(handler: (input: any) => unknown) {
        return (input: any) => handler({ ...input, data: validator(input.data) });
      },
    };
    return chain;
  },
}));
vi.mock('@tanstack/react-start/server', () => ({ getRequest: () => mocks.request }));
vi.mock('@/lib/supabase/server', () => ({ getSession: mocks.getSession }));
vi.mock('@/server/zero-mutate', () => ({
  createZeroContext: mocks.createContext,
  executeZeroRead: mocks.executeRead,
}));
vi.mock('../group-conflict-validation', () => ({ resolveGroupConflictPreflight: mocks.resolve }));

import { groupConflictPreflightFn } from '../group-conflict-preflight';

const input = { kind: 'membership_activation', group_id: 'group-1', user_id: 'user-1' };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.request = {} as Request;
  mocks.getSession.mockResolvedValue({ user: { id: 'user-1', email: 'user@example.test' } });
  mocks.resolve.mockResolvedValue({ blocking: false, conflicts: [] });
});

describe('groupConflictPreflightFn', () => {
  it('requires request context', async () => {
    mocks.request = undefined;
    await expect((groupConflictPreflightFn as any)({ data: input })).rejects.toThrow(
      'Request context unavailable.'
    );
  });

  it('passes authenticated context, transaction and validated input to the resolver', async () => {
    await expect((groupConflictPreflightFn as any)({ data: input })).resolves.toEqual({
      blocking: false,
      conflicts: [],
    });
    expect(mocks.getSession).toHaveBeenCalledWith(mocks.request);
    expect(mocks.createContext).toHaveBeenCalledWith('user-1', 'user@example.test');
    expect(mocks.resolve).toHaveBeenCalledWith(
      { id: 'tx' },
      expect.objectContaining({ userID: 'user-1' }),
      input
    );
  });

  it('uses anonymous ID and empty email when no session exists', async () => {
    mocks.getSession.mockResolvedValue(undefined);
    await (groupConflictPreflightFn as any)({ data: input });
    expect(mocks.createContext).toHaveBeenCalledWith('anon', '');
  });

  it('rejects malformed preflight input before reading', () => {
    expect(() => (groupConflictPreflightFn as any)({ data: { kind: 'unknown' } })).toThrow();
    expect(mocks.executeRead).not.toHaveBeenCalled();
  });
});
