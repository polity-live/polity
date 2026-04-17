import { useState, useEffect, useCallback, useRef } from "react";
import * as channelManager from "./channelManager";

export interface PeerData {
  userId: string;
  name: string;
  avatar?: string;
  color: string;
}

interface UsePresenceOptions {
  initialData?: Partial<PeerData>;
  enabled?: boolean;
}

type TopicCallback = (payload: Record<string, unknown>) => void;

interface UsePresenceReturn {
  peers: PeerData[];
  publishPresence: (data: Partial<PeerData>) => void;
  publishTopic: (topic: string, payload: Record<string, unknown>) => void;
  subscribeTopic: (topic: string, callback: TopicCallback) => () => void;
  isConnected: boolean;
}

export function usePresence(
  roomId: string,
  options: UsePresenceOptions = {}
): UsePresenceReturn {
  const { initialData, enabled = true } = options;
  const [peers, setPeers] = useState<PeerData[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const currentDataRef = useRef<Partial<PeerData> | undefined>(initialData);
  const roomIdRef = useRef(roomId);

  // Keep ref in sync so publishPresence always has latest data
  useEffect(() => {
    currentDataRef.current = initialData;
  }, [initialData]);

  useEffect(() => {
    if (!enabled || !roomId) return;
    roomIdRef.current = roomId;

    const presenceKey = initialData?.userId ?? "anon";
    const managed = channelManager.acquire(roomId, presenceKey);

    // Register for presence sync updates
    const unsubPresence = channelManager.onPresenceSync(roomId, (newPeers) => {
      setPeers(newPeers);
    });

    // Register for connection status updates
    const unsubStatus = channelManager.onStatusChange(roomId, (connected) => {
      setIsConnected(connected);
      if (connected && currentDataRef.current) {
        managed.channel.track(currentDataRef.current);
      }
    });

    // If channel is already subscribed (from a prior acquire), sync immediately
    if (managed.isSubscribed) {
      setIsConnected(true);
      if (currentDataRef.current) {
        managed.channel.track(currentDataRef.current);
      }
    }

    return () => {
      unsubPresence();
      unsubStatus();
      channelManager.release(roomId);
    };
  }, [roomId, enabled]);

  const publishPresence = useCallback(
    (data: Partial<PeerData>) => {
      currentDataRef.current = { ...currentDataRef.current, ...data };
      const channel = channelManager.getChannel(roomIdRef.current);
      channel?.track(currentDataRef.current);
    },
    []
  );

  const publishTopic = useCallback(
    (topic: string, payload: Record<string, unknown>) => {
      const channel = channelManager.getChannel(roomIdRef.current);
      channel?.send({
        type: "broadcast",
        event: topic,
        payload,
      });
    },
    []
  );

  const subscribeTopic = useCallback(
    (topic: string, callback: TopicCallback): (() => void) => {
      return channelManager.subscribeTopic(roomIdRef.current, topic, callback);
    },
    []
  );

  return { peers, publishPresence, publishTopic, subscribeTopic, isConnected };
}
