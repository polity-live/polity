import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { PeerData } from './usePresence';

type TopicCallback = (payload: Record<string, unknown>) => void;
type PresenceSyncCallback = (peers: PeerData[]) => void;
type StatusCallback = (connected: boolean) => void;

interface ManagedChannel {
  supabase: SupabaseClient;
  channel: RealtimeChannel;
  refCount: number;
  isSubscribed: boolean;
  presenceSyncListeners: Set<PresenceSyncCallback>;
  statusListeners: Set<StatusCallback>;
  topicListeners: Map<string, Set<TopicCallback>>;
}

const channels = new Map<string, ManagedChannel>();
const noopUnsubscribe = () => undefined;

function extractPeers(channel: RealtimeChannel): PeerData[] {
  const state = channel.presenceState<PeerData>();
  const allPeers: PeerData[] = [];
  for (const presences of Object.values(state)) {
    for (const p of presences) {
      if (p.userId) {
        allPeers.push({
          userId: p.userId,
          name: p.name || 'Anonymous',
          avatar: p.avatar,
          color: p.color || '#888888',
        });
      }
    }
  }
  return allPeers;
}

function notifyPresenceSync(managed: ManagedChannel) {
  const peers = extractPeers(managed.channel);
  for (const cb of managed.presenceSyncListeners) {
    cb(peers);
  }
}

function notifyStatus(managed: ManagedChannel, connected: boolean) {
  managed.isSubscribed = connected;
  for (const cb of managed.statusListeners) {
    cb(connected);
  }
}

function notifyBroadcast(managed: ManagedChannel, event: string, payload: Record<string, unknown>) {
  const listeners = managed.topicListeners.get(event);
  if (listeners) {
    for (const cb of listeners) {
      cb(payload);
    }
  }
}

export function acquire(roomId: string, presenceKey: string): ManagedChannel {
  const existing = channels.get(roomId);
  if (existing) {
    existing.refCount++;
    return existing;
  }

  const supabase = createClient();
  const channel = supabase.channel(`presence:${roomId}`, {
    config: { presence: { key: presenceKey } },
  });

  const managed: ManagedChannel = {
    supabase,
    channel,
    refCount: 1,
    isSubscribed: false,
    presenceSyncListeners: new Set(),
    statusListeners: new Set(),
    topicListeners: new Map(),
  };

  channel.on('presence', { event: 'sync' }, () => {
    notifyPresenceSync(managed);
  });

  channel.on('broadcast', { event: '*' }, message => {
    const event = (message as { event?: string }).event;
    if (!event) return;
    const payload = (message as { payload?: Record<string, unknown> }).payload ?? {};
    notifyBroadcast(managed, event, payload);
  });

  channel.subscribe(async status => {
    if (status === 'SUBSCRIBED') {
      notifyStatus(managed, true);
    } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
      notifyStatus(managed, false);
    }
  });

  channels.set(roomId, managed);
  return managed;
}

export function release(roomId: string) {
  const managed = channels.get(roomId);
  if (!managed) return;

  managed.refCount--;
  if (managed.refCount <= 0) {
    managed.supabase.removeChannel(managed.channel);
    managed.presenceSyncListeners.clear();
    managed.statusListeners.clear();
    managed.topicListeners.clear();
    channels.delete(roomId);
  }
}

export function onPresenceSync(roomId: string, callback: PresenceSyncCallback): () => void {
  const managed = channels.get(roomId);
  if (!managed) return noopUnsubscribe;
  managed.presenceSyncListeners.add(callback);
  return () => {
    managed.presenceSyncListeners.delete(callback);
  };
}

export function onStatusChange(roomId: string, callback: StatusCallback): () => void {
  const managed = channels.get(roomId);
  if (!managed) return noopUnsubscribe;
  managed.statusListeners.add(callback);
  return () => {
    managed.statusListeners.delete(callback);
  };
}

export function subscribeTopic(roomId: string, topic: string, callback: TopicCallback): () => void {
  const managed = channels.get(roomId);
  if (!managed) return noopUnsubscribe;
  let listeners = managed.topicListeners.get(topic);
  if (!listeners) {
    listeners = new Set();
    managed.topicListeners.set(topic, listeners);
  }
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
    if (listeners.size === 0) {
      managed.topicListeners.delete(topic);
    }
  };
}

export function getChannel(roomId: string): RealtimeChannel | null {
  return channels.get(roomId)?.channel ?? null;
}

export function isConnected(roomId: string): boolean {
  return channels.get(roomId)?.isSubscribed ?? false;
}
