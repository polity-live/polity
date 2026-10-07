import { afterEach, expect, it, vi } from 'vitest';
const io = vi.hoisted(() => ({
  acquire: vi.fn(),
  release: vi.fn(),
  peers: undefined as any,
  cursor: undefined as any,
  status: undefined as any,
  stop: vi.fn(),
}));
vi.mock('@/presence/channelManager', () => ({
  acquire: io.acquire,
  release: io.release,
  onPresenceSync: (_r: unknown, fn: unknown) => {
    io.peers = fn;
    return io.stop;
  },
  subscribeTopic: (_r: unknown, _t: unknown, fn: unknown) => {
    io.cursor = fn;
    return io.stop;
  },
  onStatusChange: (_r: unknown, fn: unknown) => {
    io.status = fn;
    return io.stop;
  },
}));
import { studioPresence } from '../studio-realtime-presence';
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});
it.each([true, false])(
  'uses private workspace channels, throttles cursors, expires positions and cleans up with connected=%s',
  async connected => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    const id = crypto.randomUUID(),
      other = crypto.randomUUID(),
      page = crypto.randomUUID();
    const managed = { isSubscribed: connected, channel: { send: vi.fn(), track: vi.fn() } };
    io.acquire.mockReturnValue(managed);
    const options = {
      projectId: 'p',
      workspaceId: connected ? 'workspace' : undefined,
      user: { id, name: 'Ada' },
      setPeers: vi.fn(),
      cursor: { current: { pageId: page, x: 1, y: 2 } },
      selection: { current: ['element'] },
      publish: { current: () => undefined },
    };
    const cleanup = studioPresence(options);
    expect(io.acquire).toHaveBeenCalledWith(
      `studio:p:${connected ? 'workspace' : 'main'}`,
      id,
      true
    );
    if (!connected) {
      options.publish.current();
      expect(managed.channel.send).not.toHaveBeenCalled();
      managed.isSubscribed = true;
      io.status(true);
    }
    io.peers([
      { userId: id, name: 'Self' },
      { userId: other, name: 'Peer', color: 'red' },
    ]);
    io.cursor({ invalid: true });
    io.cursor({ userId: id, selection: [] });
    io.cursor({ userId: other, cursor: { pageId: page, x: 4, y: 5 }, selection: ['node'] });
    io.peers([{ userId: other, name: 'Peer' }]);
    expect(options.setPeers.mock.lastCall?.[0][0].cursor).toEqual({ pageId: page, x: 4, y: 5 });
    const sent = managed.channel.send.mock.calls.length;
    options.publish.current();
    options.publish.current();
    await vi.advanceTimersByTimeAsync(99);
    expect(managed.channel.send).toHaveBeenCalledTimes(sent);
    await vi.advanceTimersByTimeAsync(1);
    expect(managed.channel.send).toHaveBeenCalledTimes(sent + 1);
    await vi.advanceTimersByTimeAsync(100);
    options.publish.current();
    io.cursor({ userId: other, selection: [] });
    await vi.advanceTimersByTimeAsync(11_000);
    expect(options.setPeers.mock.lastCall?.[0][0].cursor).toBeUndefined();
    io.peers([{ userId: crypto.randomUUID(), name: 'Different peer' }]);
    io.status(false);
    managed.isSubscribed = false;
    options.publish.current();
    await vi.advanceTimersByTimeAsync(5000);
    managed.isSubscribed = true;
    io.status(true);
    if (connected) options.publish.current();
    cleanup();
    options.publish.current();
    expect(io.stop).toHaveBeenCalledTimes(3);
    expect(io.release).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  }
);
