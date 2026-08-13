import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PermissionError } from '../../rbac/errors';
import { verifyPassword, votingPasswordServerMutators } from '../server-mutators';
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

  it('inserts and updates hashed passwords on the server', async () => {
    const insertTx = createTx('server');
    insertTx.run.mockResolvedValue(null);

    await votingPasswordServerMutators.setVotingPassword.fn({
      tx: insertTx as never,
      ctx: createCtx(),
      args: { password: '1234' },
    });

    const inserted = insertTx.mutate.voting_password.insert.mock.calls[0]?.[0];
    expect(inserted).toEqual(expect.objectContaining({ user_id: 'user-1' }));
    expect(inserted.password_hash).not.toBe('1234');
    await expect(verifyPassword('1234', inserted.password_hash)).resolves.toBe(true);
    await expect(verifyPassword('9999', inserted.password_hash)).resolves.toBe(false);

    const updateTx = createTx('server');
    updateTx.run.mockResolvedValue({ id: 'password-1' });
    await votingPasswordServerMutators.setVotingPassword.fn({
      tx: updateTx as never,
      ctx: createCtx(),
      args: { password: '5678' },
    });
    expect(updateTx.mutate.voting_password.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'password-1' })
    );
    expect(updateTx.mutate.voting_password.insert).not.toHaveBeenCalled();
  });

  it('rejects malformed password hashes without deriving a key', async () => {
    await expect(verifyPassword('1234', ':hash')).resolves.toBe(false);
    await expect(verifyPassword('1234', 'salt:')).resolves.toBe(false);
  });

  it('rejects missing and invalid password records and stamps successful verification', async () => {
    const missingTx = createTx('server');
    missingTx.run.mockResolvedValue(null);
    await expect(
      votingPasswordServerMutators.verifyVotingPassword.fn({
        tx: missingTx as never,
        ctx: createCtx(),
        args: { password: '1234' },
      })
    ).rejects.toThrow();

    const setupTx = createTx('server');
    setupTx.run.mockResolvedValue(null);
    await votingPasswordServerMutators.setVotingPassword.fn({
      tx: setupTx as never,
      ctx: createCtx(),
      args: { password: '1234' },
    });
    const passwordHash = setupTx.mutate.voting_password.insert.mock.calls[0]?.[0].password_hash;

    const invalidTx = createTx('server');
    invalidTx.run.mockResolvedValue({ id: 'password-1', password_hash: passwordHash });
    await expect(
      votingPasswordServerMutators.verifyVotingPassword.fn({
        tx: invalidTx as never,
        ctx: createCtx(),
        args: { password: '9999' },
      })
    ).rejects.toThrow();
    expect(invalidTx.mutate.voting_password.update).not.toHaveBeenCalled();

    const validTx = createTx('server');
    validTx.run.mockResolvedValue({ id: 'password-1', password_hash: passwordHash });
    await votingPasswordServerMutators.verifyVotingPassword.fn({
      tx: validTx as never,
      ctx: createCtx(),
      args: { password: '1234' },
    });
    expect(validTx.mutate.voting_password.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'password-1', last_verified_at: expect.any(Number) })
    );
  });

  it('updates an existing optimistic password and keeps verification a client no-op', async () => {
    const tx = createTx('client');
    tx.run.mockResolvedValue({ id: 'password-1' });

    await votingPasswordSharedMutators.setVotingPassword.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: { password: '1234' },
    });
    expect(tx.mutate.voting_password.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'password-1', password_hash: '***' })
    );
    expect(tx.mutate.voting_password.insert).not.toHaveBeenCalled();

    await expect(
      votingPasswordSharedMutators.verifyVotingPassword.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: { password: '1234' },
      })
    ).resolves.toBeUndefined();
  });
});
