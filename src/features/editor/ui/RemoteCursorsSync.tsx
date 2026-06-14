/**
 * Remote Cursors Sync Component
 *
 * Renders inside a <Plate> context. Broadcasts the local user's selection
 * and applies remote cursor positions via CursorOverlayPlugin.
 */

import { useRemoteCursorsSyncController } from '@/features/editor/hooks/useRemoteCursorsSyncController';

interface RemoteCursorsSyncProps {
  entityId: string;
  userId?: string;
  userName?: string;
  userColor?: string;
  enabled?: boolean;
  onActiveCursorsChange?: (userIds: Set<string>) => void;
}

export function RemoteCursorsSync({
  entityId,
  userId,
  userName,
  userColor,
  enabled = true,
  onActiveCursorsChange,
}: RemoteCursorsSyncProps) {
  useRemoteCursorsSyncController({
    entityId,
    userId,
    userName,
    userColor,
    enabled,
    onActiveCursorsChange,
  });

  return null;
}
