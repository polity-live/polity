import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePresence } from '@/presence/usePresence';
import type { StreetDesignComparisonLayer, StreetDesignLocalPoint } from '../types';

const CURSOR_TOPIC = 'street-cursor';
const CURSOR_BROADCAST_THROTTLE_MS = 100;
const CURSOR_INACTIVITY_TIMEOUT_MS = 10_000;

export interface StreetDesignRemoteCursor {
  userId: string;
  name: string;
  color: string;
  position: StreetDesignLocalPoint;
  layer: StreetDesignComparisonLayer;
}

interface UseStreetDesignRemoteCursorsOptions {
  entityId: string;
  userId?: string;
  userName?: string;
  userColor?: string;
  enabled?: boolean;
}

interface CursorBroadcastPayload {
  senderId: string;
  userName: string;
  userColor: string;
  position: StreetDesignLocalPoint | null;
  layer: StreetDesignComparisonLayer;
}

export function useStreetDesignRemoteCursors({
  entityId,
  userId,
  userName,
  userColor,
  enabled = true,
}: UseStreetDesignRemoteCursorsOptions) {
  const [remoteCursors, setRemoteCursors] = useState<StreetDesignRemoteCursor[]>([]);
  const lastBroadcastTimeRef = useRef<number | null>(null);
  const pendingBroadcastRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inactivityTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const latestPayloadRef = useRef<CursorBroadcastPayload | null>(null);
  const { publishTopic, subscribeTopic, isConnected } = usePresence(
    entityId ? `editor:${entityId}` : '',
    { enabled: enabled && Boolean(entityId) && Boolean(userId) }
  );

  const removeRemoteCursor = useCallback((senderId: string) => {
    const timeout = inactivityTimeoutsRef.current.get(senderId);
    if (timeout) clearTimeout(timeout);
    inactivityTimeoutsRef.current.delete(senderId);
    setRemoteCursors(current => current.filter(cursor => cursor.userId !== senderId));
  }, []);

  useEffect(() => {
    if (!enabled || !entityId || !userId) return undefined;

    return subscribeTopic(CURSOR_TOPIC, rawPayload => {
      const payload = parseCursorPayload(rawPayload);
      if (!payload || payload.senderId === userId) return;

      if (!payload.position) {
        removeRemoteCursor(payload.senderId);
        return;
      }
      const position = payload.position;

      setRemoteCursors(current => {
        const nextCursor: StreetDesignRemoteCursor = {
          userId: payload.senderId,
          name: payload.userName,
          color: payload.userColor,
          position,
          layer: payload.layer,
        };
        const existingIndex = current.findIndex(cursor => cursor.userId === payload.senderId);
        if (existingIndex < 0) return [...current, nextCursor];
        const next = [...current];
        next[existingIndex] = nextCursor;
        return next;
      });

      const existingTimeout = inactivityTimeoutsRef.current.get(payload.senderId);
      if (existingTimeout) clearTimeout(existingTimeout);
      inactivityTimeoutsRef.current.set(
        payload.senderId,
        setTimeout(() => removeRemoteCursor(payload.senderId), CURSOR_INACTIVITY_TIMEOUT_MS)
      );
    });
  }, [enabled, entityId, removeRemoteCursor, subscribeTopic, userId]);

  const sendPayload = useCallback(
    (payload: CursorBroadcastPayload) => {
      if (!isConnected) return;
      publishTopic(CURSOR_TOPIC, payload as unknown as Record<string, unknown>);
      lastBroadcastTimeRef.current = Date.now();
    },
    [isConnected, publishTopic]
  );

  const broadcastCursor = useCallback(
    (position: StreetDesignLocalPoint | null, layer: StreetDesignComparisonLayer = 'design') => {
      if (!enabled || !userId) return;

      const payload: CursorBroadcastPayload = {
        senderId: userId,
        userName: userName || 'Anonymous',
        userColor: userColor || '#888888',
        position,
        layer,
      };
      latestPayloadRef.current = payload;

      if (!position) {
        if (pendingBroadcastRef.current) clearTimeout(pendingBroadcastRef.current);
        pendingBroadcastRef.current = null;
        sendPayload(payload);
        return;
      }

      const elapsed =
        lastBroadcastTimeRef.current == null ? null : Date.now() - lastBroadcastTimeRef.current;
      if (elapsed == null || elapsed >= CURSOR_BROADCAST_THROTTLE_MS) {
        if (pendingBroadcastRef.current) clearTimeout(pendingBroadcastRef.current);
        pendingBroadcastRef.current = null;
        sendPayload(payload);
        return;
      }

      if (pendingBroadcastRef.current) clearTimeout(pendingBroadcastRef.current);
      pendingBroadcastRef.current = setTimeout(() => {
        pendingBroadcastRef.current = null;
        if (latestPayloadRef.current) sendPayload(latestPayloadRef.current);
      }, CURSOR_BROADCAST_THROTTLE_MS - elapsed);
    },
    [enabled, sendPayload, userColor, userId, userName]
  );

  useEffect(
    () => () => {
      if (pendingBroadcastRef.current) clearTimeout(pendingBroadcastRef.current);
      for (const timeout of inactivityTimeoutsRef.current.values()) clearTimeout(timeout);
      inactivityTimeoutsRef.current.clear();
    },
    []
  );

  const activeCursorUserIds = useMemo(
    () => new Set(remoteCursors.map(cursor => cursor.userId)),
    [remoteCursors]
  );

  return { remoteCursors, activeCursorUserIds, broadcastCursor };
}

function parseCursorPayload(payload: Record<string, unknown>): CursorBroadcastPayload | null {
  const senderId = typeof payload.senderId === 'string' ? payload.senderId : '';
  const userName = typeof payload.userName === 'string' ? payload.userName : '';
  const userColor = typeof payload.userColor === 'string' ? payload.userColor : '';
  const layer = payload.layer === 'original' || payload.layer === 'design' ? payload.layer : null;
  const rawPosition = payload.position;

  if (!senderId || !userName || !userColor || !layer) return null;
  if (rawPosition === null) return { senderId, userName, userColor, position: null, layer };
  if (!rawPosition || typeof rawPosition !== 'object') return null;

  const { x, z } = rawPosition as { x?: unknown; z?: unknown };
  if (
    typeof x !== 'number' ||
    !Number.isFinite(x) ||
    typeof z !== 'number' ||
    !Number.isFinite(z)
  ) {
    return null;
  }

  return { senderId, userName, userColor, position: { x, z }, layer };
}
