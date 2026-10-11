import type { Connection, ConnectionState } from '@rocicorp/zero';
import { afterEach, expect, it, vi } from 'vitest';
import { recoverReloadConnection } from '../connection-recovery';

const race: ConnectionState = {
  name: 'error',
  reason: 'No validated connection is available for shared query work.',
};
function fixture(initial: ConnectionState = { name: 'connecting' }, synchronous = false) {
  let listener!: (state: ConnectionState) => void;
  const unsubscribe = vi.fn();
  const connection: Connection = {
    state: {
      current: initial,
      subscribe: callback => {
        listener = callback;
        if (synchronous) callback(initial);
        return unsubscribe;
      },
    },
    connect: vi.fn(async () => undefined),
  };
  const stop = recoverReloadConnection(connection);
  return { connection, unsubscribe, emit: (state: ConnectionState) => listener(state), stop };
}
afterEach(() => vi.useRealTimers());

it('releases a client already closed when subscription delivers its initial state', () => {
  const f = fixture({ name: 'closed', reason: 'Disposed' }, true);
  expect(f.unsubscribe).toHaveBeenCalledOnce();
  expect(f.connection.connect).not.toHaveBeenCalled();
});

it('contains a failed reconnect and releases a disposed subscription', async () => {
  vi.useFakeTimers();
  const f = fixture(race);
  vi.mocked(f.connection.connect).mockRejectedValueOnce(new Error('Connection still paused'));
  await vi.advanceTimersByTimeAsync(50);
  expect(f.connection.connect).toHaveBeenCalledOnce();
  f.stop();
  expect(f.unsubscribe).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(1000);
  expect(f.connection.connect).toHaveBeenCalledOnce();
});

it('resumes the exact reload race with the existing token and bounds repeated failures', async () => {
  vi.useFakeTimers();
  const f = fixture(race);
  f.emit(race);
  await vi.advanceTimersByTimeAsync(50);
  expect(f.connection.connect).toHaveBeenCalledExactlyOnceWith();
  f.emit(race);
  await vi.advanceTimersByTimeAsync(100);
  f.emit(race);
  await vi.advanceTimersByTimeAsync(200);
  f.emit(race);
  await vi.advanceTimersByTimeAsync(1000);
  expect(f.connection.connect).toHaveBeenCalledTimes(3);
  f.stop();
});

it.each<ConnectionState>([
  { name: 'needs-auth', reason: { type: 'zero-cache', reason: 'Unauthorized' } },
  { name: 'error', reason: 'Invalid mutation ID' },
  { name: 'error', reason: 'InvalidConnectionRequest' },
  { name: 'disconnected', reason: 'Offline' },
])('does not retry unrelated $name failures', async state => {
  vi.useFakeTimers();
  const f = fixture(state);
  await vi.advanceTimersByTimeAsync(1000);
  expect(f.connection.connect).not.toHaveBeenCalled();
  f.stop();
});

it.each<ConnectionState>([{ name: 'connected' }, { name: 'closed', reason: 'Disposed' }])(
  'cancels a queued retry when the client becomes $name',
  async state => {
    vi.useFakeTimers();
    const f = fixture(race);
    f.emit(state);
    await vi.advanceTimersByTimeAsync(1000);
    expect(f.connection.connect).not.toHaveBeenCalled();
    if (state.name === 'closed') expect(f.unsubscribe).toHaveBeenCalledOnce();
    f.stop();
  }
);
