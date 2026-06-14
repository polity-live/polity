import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PermissionError } from '../../rbac/errors';
import { votingPasswordServerMutators } from '../server-mutators';
import { votingPasswordSharedMutators } from '../shared-mutators';

type VotingPasswordMutatorInput = Parameters<
  typeof votingPasswordSharedMutators.setVotingPassword.fn
>[0];
type VotingPasswordMutatorTx = VotingPasswordMutatorInput['tx'];
type VotingPasswordMutatorCtx = VotingPasswordMutatorInput['ctx'];

function createTx(location: VotingPasswordMutatorTx['location'] = 'server') {
  return {
    clientID: 'client-1',
    mutationID: 1,
    reason: 'test',
    location,
    run: vi.fn(),
    mutate: {
      voting_password: {
        insert: vi.fn(),
        update: vi.fn(),
      },
    },
  };
}

function createCtx(userID = 'user-1'): VotingPasswordMutatorCtx {
  return {
    userID,
    email: `${userID}@example.com`,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('voting password mutator authorization', () => {
  it('rejects anonymous server password setup before touching storage', async () => {
    const tx = createTx('server');

    await expect(
      votingPasswordServerMutators.setVotingPassword.fn({
        tx: tx as never,
        ctx: createCtx('anon'),
        args: { password: '1234' },
      })
    ).rejects.toThrow(PermissionError);

    expect(tx.run).not.toHaveBeenCalled();
    expect(tx.mutate.voting_password.insert).not.toHaveBeenCalled();
    expect(tx.mutate.voting_password.update).not.toHaveBeenCalled();
  });

  it('rejects anonymous server password verification before touching storage', async () => {
    const tx = createTx('server');

    await expect(
      votingPasswordServerMutators.verifyVotingPassword.fn({
        tx: tx as never,
        ctx: createCtx('anon'),
        args: { password: '1234' },
      })
    ).rejects.toThrow(PermissionError);

    expect(tx.run).not.toHaveBeenCalled();
  });

  it('keeps shared client password setup optimistic', async () => {
    const tx = createTx('client');
    tx.run.mockResolvedValue(null);

    await expect(
      votingPasswordSharedMutators.setVotingPassword.fn({
        tx: tx as never,
        ctx: createCtx('anon'),
        args: { password: '1234' },
      })
    ).resolves.toBeUndefined();

    expect(tx.mutate.voting_password.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'anon',
        password_hash: '***',
      })
    );
  });

  it('rejects anonymous shared server fallback before optimistic writes', async () => {
    const tx = createTx('server');

    await expect(
      votingPasswordSharedMutators.setVotingPassword.fn({
        tx: tx as never,
        ctx: createCtx('anon'),
        args: { password: '1234' },
      })
    ).rejects.toThrow(PermissionError);

    expect(tx.run).not.toHaveBeenCalled();
    expect(tx.mutate.voting_password.insert).not.toHaveBeenCalled();
  });
});
