import { useEffect, useRef } from 'react';
import { useEditorRef } from 'platejs/react';

import { useRemoteCursors } from '@/features/editor/hooks/useRemoteCursors';

interface UseRemoteCursorsSyncControllerOptions {
  entityId: string;
  userId?: string;
  userName?: string;
  userColor?: string;
  enabled: boolean;
  onActiveCursorsChange?: (userIds: Set<string>) => void;
}

export function useRemoteCursorsSyncController({
  entityId,
  userId,
  userName,
  userColor,
  enabled,
  onActiveCursorsChange,
}: UseRemoteCursorsSyncControllerOptions) {
  const editor = useEditorRef();
  const { broadcastCursor } = useRemoteCursors({
    entityId,
    userId,
    userName,
    userColor,
    enabled,
    onActiveCursorsChange,
  });

  const broadcastCursorRef = useRef(broadcastCursor);
  useEffect(() => {
    broadcastCursorRef.current = broadcastCursor;
  }, [broadcastCursor]);

  useEffect(() => {
    if (!enabled || !editor || !userId) return;

    const interval = setInterval(() => {
      broadcastCursorRef.current(editor.selection);
    }, 150);

    return () => clearInterval(interval);
  }, [enabled, editor, userId]);
}
