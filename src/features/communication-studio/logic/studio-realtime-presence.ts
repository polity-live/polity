import { z } from 'zod';
import * as channels from '@/presence/channelManager';

const cursorMessage = z.object({
  userId: z.string().uuid(),
  cursor: z
    .object({ pageId: z.string().uuid(), x: z.number().finite(), y: z.number().finite() })
    .optional(),
  selection: z.array(z.string().max(200)).max(100),
});
interface PresenceOptions {
  projectId: string;
  workspaceId?: string;
  user: { id: string; name: string };
  setPeers: (peers: Record<string, unknown>[]) => void;
  cursor: { current: { pageId: string; x: number; y: number } | undefined };
  selection: { current: string[] };
  publish: { current: () => void };
}
export function studioPresence(options: PresenceOptions): () => void {
  const { projectId, workspaceId, user, setPeers, cursor, selection, publish } = options;
  const room = `studio:${projectId}:${workspaceId ?? 'main'}`;
  const managed = channels.acquire(room, user.id, true);
  const positions = new Map<string, { cursor?: unknown; selection: string[]; at: number }>();
  let peers: Record<string, unknown>[] = [];
  let pending: ReturnType<typeof setTimeout> | undefined;
  let lastSent = -Infinity;
  const render = () =>
    setPeers(
      peers.map(peer => {
        const position = positions.get(String(peer.userId));
        return { ...peer, ...(position && Date.now() - position.at < 10_000 ? position : {}) };
      })
    );
  const send = () => {
    pending = undefined;
    if (!managed.isSubscribed) return;
    lastSent = Date.now();
    void managed.channel.send({
      type: 'broadcast',
      event: 'studio-cursor',
      payload: {
        userId: user.id,
        cursor: cursor.current,
        selection: selection.current.slice(0, 100),
      },
    });
  };
  publish.current = () => {
    if (pending) return;
    const wait = 100 - (Date.now() - lastSent);
    if (wait <= 0) send();
    else pending = setTimeout(send, wait);
  };
  const track = () => {
    void managed.channel.track({ userId: user.id, name: user.name, color: '#B88A3B' });
    send();
  };
  const unsubscribePeers = channels.onPresenceSync(room, next => {
    peers = next
      .filter(peer => peer.userId !== user.id)
      .map(peer => ({
        userId: peer.userId,
        user: { id: peer.userId, name: peer.name, avatar: peer.avatar, color: peer.color },
      }));
    for (const id of positions.keys())
      if (!peers.some(peer => peer.userId === id)) positions.delete(id);
    render();
  });
  const unsubscribeCursor = channels.subscribeTopic(room, 'studio-cursor', raw => {
    const parsed = cursorMessage.safeParse(raw);
    if (!parsed.success || parsed.data.userId === user.id) return;
    positions.set(parsed.data.userId, {
      cursor: parsed.data.cursor,
      selection: parsed.data.selection,
      at: Date.now(),
    });
    render();
  });
  const unsubscribeStatus = channels.onStatusChange(room, connected => {
    if (connected) track();
    else {
      positions.clear();
      peers = [];
      render();
    }
  });
  if (managed.isSubscribed) track();
  const heartbeat = setInterval(send, 5000);
  const expiry = setInterval(render, 1000);
  return () => {
    if (pending) clearTimeout(pending);
    clearInterval(heartbeat);
    clearInterval(expiry);
    unsubscribePeers();
    unsubscribeCursor();
    unsubscribeStatus();
    publish.current = () => undefined;
    channels.release(room);
    setPeers([]);
  };
}
